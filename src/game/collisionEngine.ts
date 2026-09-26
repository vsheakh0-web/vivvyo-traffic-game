import {
  Direction,
  GridObstacle,
  GridPoint,
  Vehicle,
} from './types';

/**
 * Returns the unit vector for a vehicle's forward travel direction.
 */
export function getDirectionDelta(direction: Direction): GridPoint {
  switch (direction) {
    case 'UP':
      return { x: 0, y: -1 };
    case 'DOWN':
      return { x: 0, y: 1 };
    case 'LEFT':
      return { x: -1, y: 0 };
    case 'RIGHT':
      return { x: 1, y: 0 };
  }
}

/**
 * Returns the ordered array of grid cells occupied by a vehicle,
 * starting at the front bumper (gridX, gridY) and extending backward
 * opposite to its facing direction for `vehicle.length` cells.
 */
export function getVehicleOccupiedCells(
  vehicle: Pick<Vehicle, 'gridX' | 'gridY' | 'length' | 'direction'>
): GridPoint[] {
  const forward = getDirectionDelta(vehicle.direction);
  const cells: GridPoint[] = [];
  for (let i = 0; i < vehicle.length; i++) {
    cells.push({
      x: vehicle.gridX - forward.x * i,
      y: vehicle.gridY - forward.y * i,
    });
  }
  return cells;
}

/**
 * Returns the bounding box in grid coordinates (inclusive minX..maxX, minY..maxY)
 * in O(1) without intermediate array allocations.
 */
export function getVehicleGridBounds(
  vehicle: Pick<Vehicle, 'gridX' | 'gridY' | 'length' | 'direction'>
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthCells: number;
  heightCells: number;
} {
  const forward = getDirectionDelta(vehicle.direction);
  const tailX = vehicle.gridX - forward.x * (vehicle.length - 1);
  const tailY = vehicle.gridY - forward.y * (vehicle.length - 1);
  const minX = Math.min(vehicle.gridX, tailX);
  const maxX = Math.max(vehicle.gridX, tailX);
  const minY = Math.min(vehicle.gridY, tailY);
  const maxY = Math.max(vehicle.gridY, tailY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    widthCells: maxX - minX + 1,
    heightCells: maxY - minY + 1,
  };
}

export interface CellOccupant {
  type: 'VEHICLE' | 'OBSTACLE';
  id: string;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Builds a spatial map of all currently occupied cells on the parking grid.
 * Only vehicles in `PARKED_IN_LOT` state occupy parking lot grid cells.
 */
export function buildOccupancyMap(
  vehicles: Vehicle[],
  obstacles: GridObstacle[]
): Map<string, CellOccupant> {
  const map = new Map<string, CellOccupant>();

  for (const obs of obstacles) {
    map.set(cellKey(obs.x, obs.y), {
      type: 'OBSTACLE',
      id: obs.id,
    });
  }

  for (const v of vehicles) {
    if (v.state !== 'PARKED_IN_LOT') continue;
    const forward = getDirectionDelta(v.direction);
    for (let i = 0; i < v.length; i++) {
      const cx = v.gridX - forward.x * i;
      const cy = v.gridY - forward.y * i;
      map.set(cellKey(cx, cy), {
        type: 'VEHICLE',
        id: v.id,
      });
    }
  }

  return map;
}

export interface ExitRayResult {
  isBlocked: boolean;
  blockerVehicleId: string | null;
  blockerObstacleId: string | null;
  blockedAtCell: GridPoint | null;
  rayCellsToPerimeter: GridPoint[];
}

/**
 * Traces a ray from the front bumper of `targetVehicle` along `targetVehicle.direction`
 * until it exits the parking lot grid (`0..gridWidth-1`, `0..gridHeight-1`).
 * Accepts an optional `precomputedOccupancy` map to avoid redundant allocations in batch checks.
 */
export function checkVehicleExitPath(
  targetVehicle: Vehicle,
  allVehicles: Vehicle[],
  obstacles: GridObstacle[],
  gridWidth: number,
  gridHeight: number,
  precomputedOccupancy?: Map<string, CellOccupant>
): ExitRayResult {
  const occupancy =
    precomputedOccupancy ?? buildOccupancyMap(allVehicles, obstacles);
  const delta = getDirectionDelta(targetVehicle.direction);
  const rayCells: GridPoint[] = [];

  let currX = targetVehicle.gridX + delta.x;
  let currY = targetVehicle.gridY + delta.y;

  while (currX >= 0 && currX < gridWidth && currY >= 0 && currY < gridHeight) {
    const occupant = occupancy.get(cellKey(currX, currY));
    if (
      occupant &&
      !(occupant.type === 'VEHICLE' && occupant.id === targetVehicle.id)
    ) {
      return {
        isBlocked: true,
        blockerVehicleId: occupant.type === 'VEHICLE' ? occupant.id : null,
        blockerObstacleId: occupant.type === 'OBSTACLE' ? occupant.id : null,
        blockedAtCell: { x: currX, y: currY },
        rayCellsToPerimeter: rayCells,
      };
    }
    rayCells.push({ x: currX, y: currY });
    currX += delta.x;
    currY += delta.y;
  }

  return {
    isBlocked: false,
    blockerVehicleId: null,
    blockerObstacleId: null,
    blockedAtCell: null,
    rayCellsToPerimeter: rayCells,
  };
}

/**
 * Reveals any `PARKED_IN_LOT` Mystery vehicles (`isMystery === true`)
 * that currently have an unobstructed line-of-sight exit path to the perimeter road.
 * Shares a single occupancy map across all checks and skips allocation when no mystery buses exist.
 */
export function revealUnblockedMysteryVehicles(
  vehicles: Vehicle[],
  obstacles: GridObstacle[],
  gridWidth: number,
  gridHeight: number
): Vehicle[] {
  const hasMystery = vehicles.some(
    (v) => v.state === 'PARKED_IN_LOT' && v.isMystery
  );
  if (!hasMystery) {
    return vehicles;
  }

  const sharedOccupancy = buildOccupancyMap(vehicles, obstacles);
  let anyRevealed = false;

  const updated = vehicles.map((v) => {
    if (v.state === 'PARKED_IN_LOT' && v.isMystery) {
      const ray = checkVehicleExitPath(
        v,
        vehicles,
        obstacles,
        gridWidth,
        gridHeight,
        sharedOccupancy
      );
      if (!ray.isBlocked) {
        anyRevealed = true;
        return { ...v, isMystery: false };
      }
    }
    return v;
  });

  return anyRevealed ? updated : vehicles;
}
