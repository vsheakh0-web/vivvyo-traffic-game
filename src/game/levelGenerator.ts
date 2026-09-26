import { capacityToLength, VEHICLE_COLORS } from '../assets/colorPalette';
import {
  cellKey,
  checkVehicleExitPath,
  getDirectionDelta,
  getVehicleOccupiedCells,
} from './collisionEngine';
import {
  Direction,
  EnvironmentThemeId,
  GridObstacle,
  LevelArchetypeId,
  LevelData,
  Passenger,
  Vehicle,
  VehicleCapacity,
  VehicleColor,
} from './types';

export const TOTAL_LEVELS = 100;

export const LEVEL_ARCHETYPES: LevelArchetypeId[] = [
  'OPEN_PLAZA',
  'CROSSROADS',
  'PERIMETER_RING',
  'SPIRAL_VORTEX',
  'DUAL_CORRIDOR',
  'PINWHEEL_LOCK',
  'CHESSBOARD_BAYS',
  'BOTTLENECK_GATE',
  'CENTRAL_ISLAND',
  'TERMINAL_GRID',
];

export interface LevelBlueprint {
  levelNumber: number;
  tierName: string;
  archetype: LevelArchetypeId;
  environmentTheme: EnvironmentThemeId;
  gridWidth: number;
  gridHeight: number;
  numColors: number;
  colorOffset: number;
  targetVehicles: number;
  capacities: VehicleCapacity[];
  mysteryRatio: number;
  obstacleCount: number;
  interleaveWindow: number;
  interleaveIntensity: number;
}

/**
 * Deterministic Mulberry32 PRNG so Level N is 100% identical across all runs and devices.
 */
function createSeededRng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DISTRICT_NAMES: string[] = [
  'Suburban Stop', // 1..10
  'Crosstown Avenue', // 11..20
  'Harbor Express', // 21..30
  'Industrial Yard', // 31..40
  'Botanical Loop', // 41..50
  'Midtown Grid', // 51..60
  'Civic Center', // 61..70
  'Financial District', // 71..80
  'Metro Hub', // 81..90
  'Grand Central Terminal', // 91..100
];

const THEME_CYCLE: EnvironmentThemeId[] = [
  'MODERN_CITY',
  'SUBURBAN_STREETS',
  'COASTAL_ROADS',
  'INDUSTRIAL_DISTRICT',
  'GREEN_PARK',
  'NIGHTTIME_CITY',
];

/**
 * Returns the individually parameterized campaign blueprint for Level `levelNumber` (1..100).
 * Gradually introduces new mechanics, grid dimensions, vehicle capacities, obstacles, mystery vehicles,
 * and passenger queue interleaving across 10 distinct transit districts and 10 spatial archetypes.
 */
export function getLevelBlueprint(levelNumber: number): LevelBlueprint {
  const clamped = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(levelNumber)));
  const districtIdx = Math.min(9, Math.floor((clamped - 1) / 10));
  const tierName = DISTRICT_NAMES[districtIdx];

  // Ensure every consecutive level uses a distinct spatial archetype
  const archetype =
    LEVEL_ARCHETYPES[(clamped - 1 + districtIdx * 3) % LEVEL_ARCHETYPES.length];

  const environmentTheme =
    THEME_CYCLE[Math.floor((clamped - 1) / 5) % THEME_CYCLE.length];

  // Grid dimensions scale cleanly with campaign progression while keeping vehicle counts strategic
  let gridWidth = 6;
  let gridHeight = 6;
  if (clamped >= 11 && clamped <= 25) {
    gridWidth = 7;
    gridHeight = 7;
  } else if (clamped >= 26 && clamped <= 45) {
    gridWidth = clamped % 2 === 0 ? 7 : 8;
    gridHeight = 7;
  } else if (clamped >= 46 && clamped <= 65) {
    gridWidth = 8;
    gridHeight = 8;
  } else if (clamped >= 66 && clamped <= 85) {
    gridWidth = 8;
    gridHeight = 9;
  } else if (clamped >= 86) {
    gridWidth = 9;
    gridHeight = clamped >= 93 ? 10 : 9;
  }

  // Gradual color count progression (3 -> 8 colors) with level-specific palette rotation
  const numColors =
    clamped <= 3
      ? 3
      : clamped <= 12
      ? 4
      : clamped <= 28
      ? 5
      : clamped <= 50
      ? 6
      : clamped <= 75
      ? 7
      : 8;

  const colorOffset = (clamped * 3 + districtIdx) % VEHICLE_COLORS.length;

  // Vehicle capacities introduced gradually:
  // Lv 1-2: 4-seat shuttles only
  // Lv 3-10: 4 & 6-seat buses
  // Lv 11+: 4, 6 & 8-seat articulated coaches in archetype-specific ratios
  let capacities: VehicleCapacity[];
  if (clamped <= 2) {
    capacities = [4];
  } else if (clamped <= 10) {
    capacities = clamped % 2 === 0 ? [4, 6, 4] : [4, 4, 6];
  } else if (clamped <= 30) {
    capacities =
      clamped % 3 === 0 ? [4, 6, 8, 6] : [4, 4, 6, 6, 8];
  } else if (clamped <= 65) {
    capacities =
      clamped % 2 === 0 ? [4, 6, 6, 8, 8] : [4, 4, 6, 8, 6];
  } else {
    capacities = [4, 6, 6, 8, 8, 8];
  }

  // Target vehicle count: varies rhythmically within each 10-level chapter (including breather & boss levels)
  const chapterStep = (clamped - 1) % 10; // 0..9
  const chapterWave =
    chapterStep === 4 ? -1 : chapterStep === 9 ? 2 : Math.floor(chapterStep * 0.4);
  const baseVehicles =
    clamped <= 10
      ? 5 + Math.floor(clamped * 0.4)
      : clamped <= 30
      ? 9 + Math.floor((clamped - 10) * 0.22)
      : clamped <= 60
      ? 13 + Math.floor((clamped - 30) * 0.18)
      : clamped <= 85
      ? 17 + Math.floor((clamped - 60) * 0.16)
      : 21 + Math.floor((clamped - 85) * 0.2);

  const targetVehicles = Math.max(5, Math.min(26, baseVehicles + chapterWave));

  // Obstacles introduced at Level 16, scaling from 1 to 3 strategic traffic barriers
  const obstacleCount =
    clamped < 16
      ? 0
      : clamped <= 35
      ? 1 + (clamped % 2)
      : clamped <= 70
      ? 2 + (clamped % 2 === 0 ? 1 : 0)
      : 3;

  // Mystery ('?') vehicles introduced at Level 21
  const mysteryRatio =
    clamped < 21
      ? 0
      : clamped <= 40
      ? 0.14
      : clamped <= 75
      ? 0.2
      : 0.25;

  // Passenger queue interleaving window (1..3 buses across the 4 unlocked bays)
  const interleaveWindow =
    clamped === 1 ? 1 : clamped <= 35 ? 2 : clamped % 4 === 0 ? 2 : 3;
  const interleaveIntensity =
    clamped === 1 ? 0 : Math.min(0.72, 0.28 + clamped * 0.0045);

  return {
    levelNumber: clamped,
    tierName,
    archetype,
    environmentTheme,
    gridWidth,
    gridHeight,
    numColors,
    colorOffset,
    targetVehicles,
    capacities,
    mysteryRatio,
    obstacleCount,
    interleaveWindow,
    interleaveIntensity,
  };
}

export function getTierSpecForLevel(levelNumber: number): LevelBlueprint {
  return getLevelBlueprint(levelNumber);
}

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function isCellInBounds(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Computes archetype-preferred directions for a given cell `(x, y)` so each level archetype
 * produces a distinct traffic-blocking topology (spiral, crossroads, dual corridor, pinwheel, etc.).
 */
function getArchetypePreferredDirections(
  archetype: LevelArchetypeId,
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
  rng: () => number
): Direction[] {
  const midX = (gridWidth - 1) / 2;
  const midY = (gridHeight - 1) / 2;
  const primary: Direction[] = [];

  switch (archetype) {
    case 'SPIRAL_VORTEX': {
      // Clockwise vortex around center
      if (y <= midY && x < gridWidth - 1) primary.push('RIGHT', 'UP');
      else if (x >= midX && y < gridHeight - 1) primary.push('DOWN', 'RIGHT');
      else if (y > midY && x > 0) primary.push('LEFT', 'DOWN');
      else primary.push('UP', 'LEFT');
      break;
    }
    case 'DUAL_CORRIDOR': {
      // Vertical express lanes on columns, horizontal connectors in center
      if (x % 2 === 0) primary.push('UP', 'DOWN');
      else primary.push('DOWN', 'UP', 'LEFT', 'RIGHT');
      break;
    }
    case 'CROSSROADS': {
      // Horizontal along middle rows, vertical on outer columns
      if (Math.abs(y - midY) <= 1.2) primary.push('LEFT', 'RIGHT');
      else primary.push('UP', 'DOWN');
      break;
    }
    case 'PINWHEEL_LOCK': {
      // 4 quadrants each pointing into the adjacent quadrant's exit
      if (x < midX && y < midY) primary.push('UP', 'LEFT');
      else if (x >= midX && y < midY) primary.push('RIGHT', 'UP');
      else if (x >= midX && y >= midY) primary.push('DOWN', 'RIGHT');
      else primary.push('LEFT', 'DOWN');
      break;
    }
    case 'CHESSBOARD_BAYS': {
      // Alternating horizontal and vertical weave
      if ((x + y) % 2 === 0) primary.push('UP', 'DOWN');
      else primary.push('LEFT', 'RIGHT');
      break;
    }
    case 'PERIMETER_RING': {
      // Outer cells face along perimeter; inner cells face outward
      if (y === 0 || y === gridHeight - 1) primary.push('LEFT', 'RIGHT', 'UP');
      else primary.push('UP', 'DOWN', 'LEFT', 'RIGHT');
      break;
    }
    default: {
      // Outward radial bias with seeded variety
      if (y < midY) primary.push('UP');
      else primary.push('DOWN');
      if (x < midX) primary.push('LEFT');
      else primary.push('RIGHT');
      break;
    }
  }

  for (const d of ALL_DIRECTIONS) {
    if (!primary.includes(d)) {
      primary.push(d);
    }
  }

  // Slight seeded tie-breaking between top 2 choices
  if (primary.length >= 2 && rng() < 0.35) {
    const tmp = primary[0];
    primary[0] = primary[1];
    primary[1] = tmp;
  }

  return primary;
}

/**
 * Picks the best valid direction for placing a vehicle at `(anchorX, anchorY)` using the level's
 * spatial archetype and checking that no static obstacle blocks its exit ray.
 */
function pickBestDirectionForPlacement(
  archetype: LevelArchetypeId,
  anchorX: number,
  anchorY: number,
  length: number,
  gridWidth: number,
  gridHeight: number,
  occupiedCells: Set<string>,
  obstacleCells: Set<string>,
  rng: () => number
): { direction: Direction; cells: { x: number; y: number }[] } | null {
  const orderedDirs = getArchetypePreferredDirections(
    archetype,
    anchorX,
    anchorY,
    gridWidth,
    gridHeight,
    rng
  );

  const candidates: {
    direction: Direction;
    cells: { x: number; y: number }[];
    score: number;
  }[] = [];

  orderedDirs.forEach((dir, prefIndex) => {
    const forward = getDirectionDelta(dir);
    const cells: { x: number; y: number }[] = [];
    let validBody = true;

    for (let i = 0; i < length; i++) {
      const cx = anchorX - forward.x * i;
      const cy = anchorY - forward.y * i;
      if (
        !isCellInBounds(cx, cy, gridWidth, gridHeight) ||
        occupiedCells.has(cellKey(cx, cy))
      ) {
        validBody = false;
        break;
      }
      cells.push({ x: cx, y: cy });
    }

    if (!validBody) return;

    // Ensure no static obstacle sits directly in front of this direction's exit ray
    let rayX = anchorX + forward.x;
    let rayY = anchorY + forward.y;
    let blockedByObstacle = false;
    let dist = 0;
    while (isCellInBounds(rayX, rayY, gridWidth, gridHeight)) {
      if (obstacleCells.has(cellKey(rayX, rayY))) {
        blockedByObstacle = true;
        break;
      }
      dist++;
      rayX += forward.x;
      rayY += forward.y;
    }

    if (!blockedByObstacle) {
      // Combine archetype preference with distance to perimeter
      const score = prefIndex * 1.5 + dist * 0.4;
      candidates.push({ direction: dir, cells, score });
    }
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

/**
 * Places deterministic, archetype-themed interior obstacles so each level has distinct path constraints.
 */
function placeArchetypeObstacles(
  blueprint: LevelBlueprint,
  occupiedCells: Set<string>,
  obstacleCells: Set<string>,
  rng: () => number
): GridObstacle[] {
  const obstacles: GridObstacle[] = [];
  const { gridWidth, gridHeight, obstacleCount, levelNumber, archetype } =
    blueprint;
  if (obstacleCount <= 0) return obstacles;

  const midX = Math.floor(gridWidth / 2);
  const midY = Math.floor(gridHeight / 2);

  // Candidate interior coordinates tailored by archetype + levelNumber offset
  const candidateCoords: { x: number; y: number }[] = [];
  const shift = levelNumber % Math.max(1, gridWidth - 3);

  if (archetype === 'CENTRAL_ISLAND') {
    candidateCoords.push(
      { x: midX, y: midY },
      { x: Math.max(1, midX - 1), y: midY },
      { x: midX, y: Math.max(1, midY - 1) }
    );
  } else if (archetype === 'BOTTLENECK_GATE') {
    candidateCoords.push(
      { x: 1 + (shift % (gridWidth - 2)), y: 1 },
      { x: gridWidth - 2 - (shift % (gridWidth - 2)), y: gridHeight - 2 },
      { x: midX, y: midY }
    );
  } else if (archetype === 'DUAL_CORRIDOR') {
    candidateCoords.push(
      { x: midX, y: 1 + (levelNumber % (gridHeight - 2)) },
      { x: midX, y: Math.max(1, gridHeight - 2 - (levelNumber % (gridHeight - 2))) },
      { x: Math.max(1, midX - 1), y: midY }
    );
  }

  // Add seeded interior fallback positions
  for (let attempt = 0; attempt < 35; attempt++) {
    candidateCoords.push({
      x: 1 + Math.floor(rng() * (gridWidth - 2)),
      y: 1 + Math.floor(rng() * (gridHeight - 2)),
    });
  }

  for (const pt of candidateCoords) {
    if (obstacles.length >= obstacleCount) break;
    if (
      pt.x < 1 ||
      pt.x >= gridWidth - 1 ||
      pt.y < 1 ||
      pt.y >= gridHeight - 1
    ) {
      continue;
    }
    const key = cellKey(pt.x, pt.y);
    if (!occupiedCells.has(key)) {
      occupiedCells.add(key);
      obstacleCells.add(key);
      obstacles.push({
        id: `obs-L${levelNumber}-${obstacles.length + 1}`,
        x: pt.x,
        y: pt.y,
        label: 'Barrier',
      });
    }
  }

  return obstacles;
}

/**
 * Computes a guaranteed deadlock-free extraction order for all placed vehicles.
 */
function ensureConstructiveExtractionOrder(
  vehicles: Vehicle[],
  obstacles: GridObstacle[],
  gridWidth: number,
  gridHeight: number,
  rng: () => number
): { orderedIds: string[]; adjustedVehicles: Vehicle[] } {
  const working = vehicles.map((v) => ({
    ...v,
    boardedPassengerIds: [...v.boardedPassengerIds],
  }));
  const remainingIds = new Set(working.map((v) => v.id));
  const orderedIds: string[] = [];
  const obstacleSet = new Set(obstacles.map((o) => cellKey(o.x, o.y)));

  while (remainingIds.size > 0) {
    const activeVehicles = working.filter((v) => remainingIds.has(v.id));
    const unblocked = activeVehicles.filter(
      (v) =>
        !checkVehicleExitPath(v, activeVehicles, obstacles, gridWidth, gridHeight)
          .isBlocked
    );

    if (unblocked.length > 0) {
      const chosen = unblocked[Math.floor(rng() * unblocked.length)];
      orderedIds.push(chosen.id);
      remainingIds.delete(chosen.id);
      continue;
    }

    // Break circular blocking dependency by flipping one vehicle along its own occupied cells
    let resolvedCycle = false;
    for (const candidate of activeVehicles) {
      const cells = getVehicleOccupiedCells(candidate);
      const tailCell = cells[cells.length - 1];
      const oppositeDirMap: Record<Direction, Direction> = {
        UP: 'DOWN',
        DOWN: 'UP',
        LEFT: 'RIGHT',
        RIGHT: 'LEFT',
      };
      const flippedDir = oppositeDirMap[candidate.direction];

      const forward = getDirectionDelta(flippedDir);
      let rx = tailCell.x + forward.x;
      let ry = tailCell.y + forward.y;
      let hitsObstacle = false;
      while (isCellInBounds(rx, ry, gridWidth, gridHeight)) {
        if (obstacleSet.has(cellKey(rx, ry))) {
          hitsObstacle = true;
          break;
        }
        rx += forward.x;
        ry += forward.y;
      }

      if (!hitsObstacle) {
        candidate.gridX = tailCell.x;
        candidate.gridY = tailCell.y;
        candidate.direction = flippedDir;
        const recheck = !checkVehicleExitPath(
          candidate,
          activeVehicles,
          obstacles,
          gridWidth,
          gridHeight
        ).isBlocked;
        if (recheck) {
          orderedIds.push(candidate.id);
          remainingIds.delete(candidate.id);
          resolvedCycle = true;
          break;
        }
      }
    }

    if (!resolvedCycle) {
      let current = activeVehicles[0];
      const visited = new Set<string>();
      while (!visited.has(current.id)) {
        visited.add(current.id);
        const check = checkVehicleExitPath(
          current,
          activeVehicles,
          obstacles,
          gridWidth,
          gridHeight
        );
        if (!check.isBlocked || !check.blockerVehicleId) {
          break;
        }
        const nextBlocker = activeVehicles.find(
          (v) => v.id === check.blockerVehicleId
        );
        if (!nextBlocker) break;
        current = nextBlocker;
      }
      const cells = getVehicleOccupiedCells(current);
      const tail = cells[cells.length - 1];
      const oppositeDirMap: Record<Direction, Direction> = {
        UP: 'DOWN',
        DOWN: 'UP',
        LEFT: 'RIGHT',
        RIGHT: 'LEFT',
      };
      current.gridX = tail.x;
      current.gridY = tail.y;
      current.direction = oppositeDirMap[current.direction];
      orderedIds.push(current.id);
      remainingIds.delete(current.id);
    }
  }

  return { orderedIds, adjustedVehicles: working };
}

/**
 * Computes a color-independent geometric layout fingerprint for a level so automated tests
 * can verify that no two levels are simply the same vehicle arrangement with swapped colors.
 */
export function computeLevelGeometrySignature(level: LevelData): string {
  const vehicleSig = level.vehicles
    .map((v) => `${v.gridX},${v.gridY},${v.length},${v.direction}`)
    .sort()
    .join('|');
  const obsSig = level.obstacles
    .map((o) => `${o.x},${o.y}`)
    .sort()
    .join('|');
  return `${level.gridWidth}x${level.gridHeight}#${vehicleSig}#${obsSig}`;
}

/**
 * Generates a single deterministic, solvable Bus Jam campaign level (1..100).
 */
export function generateLevel(levelNumber: number): LevelData {
  const clampedLevel = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(levelNumber)));
  const blueprint = getLevelBlueprint(clampedLevel);
  const rng = createSeededRng(clampedLevel * 1009 + 7919);

  // Select level-specific color subset using colorOffset so levels don't always use the same primary palette
  const availableColors: VehicleColor[] = [];
  for (let i = 0; i < blueprint.numColors; i++) {
    const colorIdx = (blueprint.colorOffset + i) % VEHICLE_COLORS.length;
    availableColors.push(VEHICLE_COLORS[colorIdx]);
  }

  const occupiedCells = new Set<string>();
  const obstacleCells = new Set<string>();

  // 1. Place archetype-specific interior barriers
  const obstacles = placeArchetypeObstacles(
    blueprint,
    occupiedCells,
    obstacleCells,
    rng
  );

  // 2. Build ordered candidate cells shaped by the level's archetype + levelNumber phase
  const candidateAnchors: { x: number; y: number }[] = [];
  for (let y = 0; y < blueprint.gridHeight; y++) {
    for (let x = 0; x < blueprint.gridWidth; x++) {
      candidateAnchors.push({ x, y });
    }
  }

  // Deterministic archetype-driven cell ordering mixed with seeded PRNG
  candidateAnchors.sort((a, b) => {
    const cx = (blueprint.gridWidth - 1) / 2;
    const cy = (blueprint.gridHeight - 1) / 2;
    const distA = Math.hypot(a.x - cx, a.y - cy);
    const distB = Math.hypot(b.x - cx, b.y - cy);
    if (blueprint.archetype === 'PERIMETER_RING') {
      return distB - distA + (rng() - 0.5) * 1.6;
    }
    if (blueprint.archetype === 'CENTRAL_ISLAND' || blueprint.archetype === 'SPIRAL_VORTEX') {
      return distA - distB + (rng() - 0.5) * 1.6;
    }
    return rng() - 0.5;
  });

  const rawVehicles: Vehicle[] = [];
  let vehicleSeq = 1;

  for (let vIdx = 0; vIdx < blueprint.targetVehicles; vIdx++) {
    const cap =
      blueprint.capacities[
        (vIdx + Math.floor(rng() * blueprint.capacities.length)) %
          blueprint.capacities.length
      ];
    const len = capacityToLength(cap);
    let placed = false;

    for (let attempt = 0; attempt < 95; attempt++) {
      const anchor =
        attempt < candidateAnchors.length
          ? candidateAnchors[(vIdx * 7 + attempt * 3 + clampedLevel) % candidateAnchors.length]
          : {
              x: Math.floor(rng() * blueprint.gridWidth),
              y: Math.floor(rng() * blueprint.gridHeight),
            };

      if (occupiedCells.has(cellKey(anchor.x, anchor.y))) continue;

      const placement = pickBestDirectionForPlacement(
        blueprint.archetype,
        anchor.x,
        anchor.y,
        len,
        blueprint.gridWidth,
        blueprint.gridHeight,
        occupiedCells,
        obstacleCells,
        rng
      );

      if (placement) {
        for (const c of placement.cells) {
          occupiedCells.add(cellKey(c.x, c.y));
        }
        const color =
          availableColors[
            (vIdx + Math.floor(rng() * 2)) % availableColors.length
          ];
        rawVehicles.push({
          id: `bus-L${clampedLevel}-${vehicleSeq++}`,
          color,
          capacity: cap,
          occupiedSeats: 0,
          boardedPassengerIds: [],
          gridX: anchor.x,
          gridY: anchor.y,
          length: len,
          direction: placement.direction,
          state: 'PARKED_IN_LOT',
          assignedBayId: null,
          isMystery: false,
        });
        placed = true;
        break;
      }
    }

    // Fallback to a 2-cell (4-seat) shuttle if a larger 3/4-cell coach couldn't fit
    if (!placed && len > 2) {
      for (let attempt = 0; attempt < 65; attempt++) {
        const ax = Math.floor(rng() * blueprint.gridWidth);
        const ay = Math.floor(rng() * blueprint.gridHeight);
        if (occupiedCells.has(cellKey(ax, ay))) continue;

        const placement = pickBestDirectionForPlacement(
          blueprint.archetype,
          ax,
          ay,
          2,
          blueprint.gridWidth,
          blueprint.gridHeight,
          occupiedCells,
          obstacleCells,
          rng
        );
        if (placement) {
          for (const c of placement.cells) {
            occupiedCells.add(cellKey(c.x, c.y));
          }
          const color = availableColors[vIdx % availableColors.length];
          rawVehicles.push({
            id: `bus-L${clampedLevel}-${vehicleSeq++}`,
            color,
            capacity: 4,
            occupiedSeats: 0,
            boardedPassengerIds: [],
            gridX: ax,
            gridY: ay,
            length: 2,
            direction: placement.direction,
            state: 'PARKED_IN_LOT',
            assignedBayId: null,
            isMystery: false,
          });
          break;
        }
      }
    }
  }

  // 3. Ensure a constructive extraction order exists and eliminate any cycle
  let { orderedIds, adjustedVehicles } = ensureConstructiveExtractionOrder(
    rawVehicles,
    obstacles,
    blueprint.gridWidth,
    blueprint.gridHeight,
    rng
  );

  // Verify step-by-step peelability so 100% of levels are strictly solvable under real traffic rules
  const verifiedOrder: string[] = [];
  const verifiedVehicles: Vehicle[] = [];
  const pool = [...adjustedVehicles];

  while (pool.length > 0) {
    const clearNow = pool.filter(
      (v) =>
        !checkVehicleExitPath(
          v,
          pool,
          obstacles,
          blueprint.gridWidth,
          blueprint.gridHeight
        ).isBlocked
    );
    if (clearNow.length === 0) {
      break;
    }
    const preferred =
      clearNow.find((v) => v.id === orderedIds[verifiedOrder.length]) ||
      clearNow[0];
    verifiedOrder.push(preferred.id);
    verifiedVehicles.push(preferred);
    const idx = pool.findIndex((v) => v.id === preferred.id);
    pool.splice(idx, 1);
  }

  adjustedVehicles = verifiedVehicles;
  orderedIds = verifiedOrder;

  // 4. Assign varied vehicle colors along `orderedIds` so adjacent solvable vehicles contrast cleanly
  const vehicleById = new Map(adjustedVehicles.map((v) => [v.id, v]));
  orderedIds.forEach((id, idx) => {
    const v = vehicleById.get(id)!;
    v.color =
      availableColors[
        (idx + Math.floor(rng() * availableColors.length)) %
          availableColors.length
      ];

    // Assign Mystery ('?') status to deeper-order vehicles that are initially blocked
    if (idx >= 3 && blueprint.mysteryRatio > 0 && rng() < blueprint.mysteryRatio) {
      const isInitiallyBlocked = checkVehicleExitPath(
        v,
        adjustedVehicles,
        obstacles,
        blueprint.gridWidth,
        blueprint.gridHeight
      ).isBlocked;
      if (isInitiallyBlocked) {
        v.isMystery = true;
      }
    }
  });

  // 5. Construct the FIFO passenger queue from `orderedIds` in safe 1-to-3 bus windows
  // Since the player has 4 unlocked standard bays, interleaving passengers across 2..3 consecutive
  // solvable buses creates real bay-staging challenge while guaranteeing 100% booster-free solvability.
  const passengers: Passenger[] = [];
  let passengerSeq = 1;
  const windowSize = Math.min(3, blueprint.interleaveWindow);

  for (let i = 0; i < orderedIds.length; i += windowSize) {
    const windowIds = orderedIds.slice(i, i + windowSize);
    const windowPassengers: Passenger[] = [];

    for (const vid of windowIds) {
      const v = vehicleById.get(vid)!;
      for (let s = 0; s < v.capacity; s++) {
        windowPassengers.push({
          id: `pax-L${clampedLevel}-${passengerSeq++}`,
          color: v.color,
          boarded: false,
        });
      }
    }

    if (windowIds.length > 1 && blueprint.interleaveIntensity > 0) {
      for (let k = windowPassengers.length - 1; k > 0; k--) {
        if (rng() < blueprint.interleaveIntensity) {
          const swapIdx = Math.max(0, k - (1 + Math.floor(rng() * 3)));
          const tmp = windowPassengers[k];
          windowPassengers[k] = windowPassengers[swapIdx];
          windowPassengers[swapIdx] = tmp;
        }
      }
    }

    passengers.push(...windowPassengers);
  }

  return {
    levelNumber: clampedLevel,
    tierName: blueprint.tierName,
    archetype: blueprint.archetype,
    environmentTheme: blueprint.environmentTheme,
    gridWidth: blueprint.gridWidth,
    gridHeight: blueprint.gridHeight,
    vehicles: adjustedVehicles,
    passengers,
    obstacles,
    unlockedStandardBays: 4,
    solutionOrder: orderedIds,
  };
}
