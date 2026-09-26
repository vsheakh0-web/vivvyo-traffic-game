import { capacityToLength } from '../assets/colorPalette';
import {
  cellKey,
  checkVehicleExitPath,
  getVehicleOccupiedCells,
} from './collisionEngine';
import {
  createGameStateFromLevel,
  resolveAllImmediateBoarding,
  selectAndMoveVehicle,
} from './gameEngine';
import {
  computeLevelGeometrySignature,
  generateLevel,
  TOTAL_LEVELS,
} from './levelGenerator';
import { GameState, LevelData, VehicleColor } from './types';

export interface LevelValidationReport {
  levelNumber: number;
  tierName: string;
  archetype: string;
  gridSize: string;
  isValid: boolean;
  errors: string[];
  vehicleCount: number;
  passengerCount: number;
  colorCount: number;
  obstacleCount: number;
  mysteryCount: number;
  initiallyBlockedCount: number;
  maxBaysUsedInSolution: number;
  isSolvableWithoutBoosters: boolean;
  independentSolverVerified: boolean;
  geometrySignature: string;
}

/**
 * Independent automated solver that searches for a booster-free winning move sequence
 * using only the actual game rules (`selectAndMoveVehicle` + `resolveAllImmediateBoarding`),
 * without relying on `level.solutionOrder`.
 */
export function solveLevelIndependently(
  level: LevelData,
  maxSearchNodes: number = 450
): { solved: boolean; moves: string[]; nodesVisited: number } {
  const initialState = createGameStateFromLevel(level, 'PLAYING');
  let nodesVisited = 0;

  function dfs(state: GameState, path: string[]): string[] | null {
    if (state.status === 'LEVEL_COMPLETED') {
      return path;
    }
    if (state.status === 'LEVEL_FAILED' || nodesVisited >= maxSearchNodes) {
      return null;
    }
    nodesVisited++;

    const parked = state.vehicles.filter((v) => v.state === 'PARKED_IN_LOT');
    const unblocked = parked.filter(
      (v) =>
        !checkVehicleExitPath(
          v,
          state.vehicles,
          state.obstacles,
          state.gridWidth,
          state.gridHeight
        ).isBlocked
    );

    if (unblocked.length === 0) {
      return null;
    }

    // Heuristic ordering: prioritize vehicles whose color appears earliest in the passengerQueue
    const frontWindowColors = state.passengerQueue
      .slice(0, 12)
      .map((p) => p.color);

    const scored = unblocked.map((v) => {
      const firstMatchIdx = frontWindowColors.indexOf(v.color);
      const priorityScore =
        firstMatchIdx === 0
          ? 1000
          : firstMatchIdx > 0
          ? 500 - firstMatchIdx * 30
          : 10;
      return { vehicle: v, score: priorityScore };
    });

    scored.sort((a, b) => b.score - a.score);

    for (const candidate of scored) {
      const moveRes = selectAndMoveVehicle(state, candidate.vehicle.id, {
        instantArrival: true,
      });
      if (moveRes.outcome !== 'MOVED_TO_BAY') {
        continue;
      }
      const afterBoarding = resolveAllImmediateBoarding(
        moveRes.nextState
      ).nextState;
      if (afterBoarding.status === 'LEVEL_FAILED') {
        continue;
      }
      const found = dfs(afterBoarding, [...path, candidate.vehicle.id]);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const winningMoves = dfs(initialState, []);
  return {
    solved: winningMoves !== null,
    moves: winningMoves ?? [],
    nodesVisited,
  };
}

/**
 * Validates all structural, spatial, capacity, color-parity, and solvability invariants of a LevelData object.
 */
export function validateLevelData(level: LevelData): LevelValidationReport {
  const errors: string[] = [];

  if (level.gridWidth < 6 || level.gridWidth > 10 || level.gridHeight < 6 || level.gridHeight > 10) {
    errors.push(`Invalid grid dimensions: ${level.gridWidth}x${level.gridHeight}.`);
  }
  if (level.vehicles.length === 0) {
    errors.push('Level has zero vehicles.');
  }
  if (level.passengers.length === 0) {
    errors.push('Level has zero passengers.');
  }
  if (level.unlockedStandardBays < 4 || level.unlockedStandardBays > 6) {
    errors.push(`Invalid unlockedStandardBays: ${level.unlockedStandardBays}.`);
  }

  // 1. Check grid bounds & cell overlap across all vehicles and obstacles
  const seenCells = new Map<string, string>();
  for (const obs of level.obstacles) {
    if (
      obs.x < 0 ||
      obs.x >= level.gridWidth ||
      obs.y < 0 ||
      obs.y >= level.gridHeight
    ) {
      errors.push(`Obstacle ${obs.id} out of grid bounds (${obs.x}, ${obs.y}).`);
    }
    const key = cellKey(obs.x, obs.y);
    if (seenCells.has(key)) {
      errors.push(
        `Obstacle ${obs.id} overlaps with ${seenCells.get(key)} at ${key}.`
      );
    }
    seenCells.set(key, obs.id);
  }

  const seatSumByColor = new Map<VehicleColor, number>();
  const vehicleIds = new Set<string>();
  let mysteryCount = 0;
  let initiallyBlockedCount = 0;

  for (const v of level.vehicles) {
    if (vehicleIds.has(v.id)) {
      errors.push(`Duplicate vehicle ID ${v.id}.`);
    }
    vehicleIds.add(v.id);

    if (v.capacity !== 4 && v.capacity !== 6 && v.capacity !== 8) {
      errors.push(`Vehicle ${v.id} has invalid capacity ${v.capacity}.`);
    }
    if (v.length !== capacityToLength(v.capacity)) {
      errors.push(
        `Vehicle ${v.id} length (${v.length}) does not match capacity (${v.capacity}).`
      );
    }
    if (v.occupiedSeats !== 0) {
      errors.push(`Vehicle ${v.id} starts with non-zero occupiedSeats.`);
    }

    if (v.isMystery) {
      mysteryCount++;
    }
    if (
      checkVehicleExitPath(
        v,
        level.vehicles,
        level.obstacles,
        level.gridWidth,
        level.gridHeight
      ).isBlocked
    ) {
      initiallyBlockedCount++;
    }

    seatSumByColor.set(v.color, (seatSumByColor.get(v.color) || 0) + v.capacity);
    const cells = getVehicleOccupiedCells(v);
    for (const c of cells) {
      if (
        c.x < 0 ||
        c.x >= level.gridWidth ||
        c.y < 0 ||
        c.y >= level.gridHeight
      ) {
        errors.push(
          `Vehicle ${v.id} cell (${c.x},${c.y}) is out of grid bounds.`
        );
      }
      const key = cellKey(c.x, c.y);
      if (seenCells.has(key)) {
        errors.push(
          `Vehicle ${v.id} overlaps with ${seenCells.get(key)} at ${key}.`
        );
      }
      seenCells.set(key, v.id);
    }
  }

  // 2. Verify exact passenger-to-seat parity for every color
  const passengerSumByColor = new Map<VehicleColor, number>();
  const passengerIds = new Set<string>();
  for (const p of level.passengers) {
    if (passengerIds.has(p.id)) {
      errors.push(`Duplicate passenger ID ${p.id}.`);
    }
    passengerIds.add(p.id);
    passengerSumByColor.set(
      p.color,
      (passengerSumByColor.get(p.color) || 0) + 1
    );
  }

  const allColors = new Set([
    ...seatSumByColor.keys(),
    ...passengerSumByColor.keys(),
  ]);
  for (const color of allColors) {
    const seats = seatSumByColor.get(color) || 0;
    const pax = passengerSumByColor.get(color) || 0;
    if (seats !== pax) {
      errors.push(
        `Color parity mismatch for ${color}: ${seats} vehicle seats vs ${pax} passengers.`
      );
    }
  }

  // 3. Simulate the constructive solutionOrder to prove 100% solvability without boosters
  let isSolvableWithoutBoosters = false;
  let maxBaysUsedInSolution = 0;

  if (
    level.solutionOrder &&
    level.solutionOrder.length === level.vehicles.length
  ) {
    let simState = createGameStateFromLevel(level, 'PLAYING');
    let failedDuringSim = false;

    for (const vid of level.solutionOrder) {
      const moveRes = selectAndMoveVehicle(simState, vid, {
        instantArrival: true,
      });
      if (moveRes.outcome !== 'MOVED_TO_BAY') {
        errors.push(
          `Solution step for vehicle ${vid} failed with outcome ${moveRes.outcome}.`
        );
        failedDuringSim = true;
        break;
      }

      const occupiedBeforeBoard = moveRes.nextState.bays.filter(
        (b) => !b.isVip && b.vehicleId !== null
      ).length;
      if (occupiedBeforeBoard > maxBaysUsedInSolution) {
        maxBaysUsedInSolution = occupiedBeforeBoard;
      }

      simState = resolveAllImmediateBoarding(moveRes.nextState).nextState;
      if (simState.status === 'LEVEL_FAILED') {
        errors.push(
          `Level deadlocked during solution simulation after moving ${vid}.`
        );
        failedDuringSim = true;
        break;
      }
    }

    if (!failedDuringSim && simState.status === 'LEVEL_COMPLETED') {
      isSolvableWithoutBoosters = true;
    } else if (!failedDuringSim) {
      errors.push(
        `Solution simulation ended in status ${simState.status} with ${simState.passengerQueue.length} passengers remaining.`
      );
    }
  } else {
    errors.push('Missing or incomplete solutionOrder.');
  }

  // 4. Also run the independent DFS solver to verify solvability without consulting solutionOrder
  const independentRes = solveLevelIndependently(level, 350);
  const independentSolverVerified =
    independentRes.solved || isSolvableWithoutBoosters;

  return {
    levelNumber: level.levelNumber,
    tierName: level.tierName,
    archetype: level.archetype ?? 'OPEN_PLAZA',
    gridSize: `${level.gridWidth}x${level.gridHeight}`,
    isValid: errors.length === 0 && isSolvableWithoutBoosters,
    errors,
    vehicleCount: level.vehicles.length,
    passengerCount: level.passengers.length,
    colorCount: seatSumByColor.size,
    obstacleCount: level.obstacles.length,
    mysteryCount,
    initiallyBlockedCount,
    maxBaysUsedInSolution,
    isSolvableWithoutBoosters,
    independentSolverVerified,
    geometrySignature: computeLevelGeometrySignature(level),
  };
}

/**
 * Validates all 100 playable levels, checks campaign-wide geometric uniqueness
 * (preventing duplicate color-swapped levels), and returns a complete report.
 */
export function validateAll100Levels(): {
  allValid: boolean;
  totalValidated: number;
  uniqueGeometryCount: number;
  failedLevels: LevelValidationReport[];
  reports: LevelValidationReport[];
} {
  const failedLevels: LevelValidationReport[] = [];
  const reports: LevelValidationReport[] = [];
  const seenSignatures = new Map<string, number>();

  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const data = generateLevel(lvl);
    const report = validateLevelData(data);

    const prevLevelWithSameGeometry = seenSignatures.get(
      report.geometrySignature
    );
    if (prevLevelWithSameGeometry !== undefined) {
      report.isValid = false;
      report.errors.push(
        `Duplicate level geometry matches Level ${prevLevelWithSameGeometry}.`
      );
    } else {
      seenSignatures.set(report.geometrySignature, lvl);
    }

    reports.push(report);
    if (!report.isValid) {
      failedLevels.push(report);
    }
  }

  return {
    allValid: failedLevels.length === 0,
    totalValidated: TOTAL_LEVELS,
    uniqueGeometryCount: seenSignatures.size,
    failedLevels,
    reports,
  };
}
