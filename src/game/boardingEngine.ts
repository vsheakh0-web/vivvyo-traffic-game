import {
  BoardingStepResult,
  GameState,
  ParkingBay,
  Passenger,
  Vehicle,
} from './types';

/**
 * Creates the initial array of parking bays:
 * - 1 dedicated VIP Bay (`bay-vip`, index -1)
 * - 6 Standard Bays (`bay-0`..`bay-5`), where the first `unlockedStandardBays` (default 4) are unlocked.
 */
export function createInitialBays(unlockedStandardBays: number = 4): ParkingBay[] {
  const clampedUnlocked = Math.max(1, Math.min(6, unlockedStandardBays));
  const bays: ParkingBay[] = [];

  for (let i = 0; i < 6; i++) {
    bays.push({
      id: `bay-${i}`,
      index: i,
      isVip: false,
      isUnlocked: i < clampedUnlocked,
      vehicleId: null,
      reservedByVehicleId: null,
    });
  }

  bays.push({
    id: 'bay-vip',
    index: 99,
    isVip: true,
    isUnlocked: true,
    vehicleId: null,
    reservedByVehicleId: null,
  });

  return bays;
}

/**
 * Finds the first unlocked standard bay that is neither occupied nor reserved.
 */
export function findAvailableStandardBay(bays: ParkingBay[]): ParkingBay | null {
  for (const bay of bays) {
    if (
      !bay.isVip &&
      bay.isUnlocked &&
      bay.vehicleId === null &&
      bay.reservedByVehicleId === null
    ) {
      return bay;
    }
  }
  return null;
}

/**
 * Finds the dedicated VIP bay if it is currently unoccupied and unreserved.
 */
export function findAvailableVipBay(bays: ParkingBay[]): ParkingBay | null {
  const vipBay = bays.find((b) => b.isVip);
  if (
    vipBay &&
    vipBay.isUnlocked &&
    vipBay.vehicleId === null &&
    vipBay.reservedByVehicleId === null
  ) {
    return vipBay;
  }
  return null;
}

/**
 * Finds the best eligible vehicle in `IN_BAY` state for the front passenger (`passengerQueue[0]`).
 * Rules:
 * 1. Vehicle must be in `IN_BAY` state.
 * 2. `vehicle.color === frontPassenger.color`.
 * 3. `vehicle.occupiedSeats < vehicle.capacity`.
 * 4. `vehicle.boardedPassengerIds` does not already contain `frontPassenger.id`.
 * 5. Prioritizes the vehicle with the highest `occupiedSeats` (fewest remaining seats)
 *    so nearly-full vehicles complete and free their parking bay first.
 */
export function findEligibleVehicleForFrontPassenger(
  frontPassenger: Passenger | undefined,
  vehicles: Vehicle[],
  bays: ParkingBay[]
): Vehicle | null {
  if (!frontPassenger || frontPassenger.boarded) {
    return null;
  }

  const occupiedBayVehicleIds = new Set(
    bays.map((b) => b.vehicleId).filter((id): id is string => id !== null)
  );

  const candidates = vehicles.filter(
    (v) =>
      v.state === 'IN_BAY' &&
      occupiedBayVehicleIds.has(v.id) &&
      v.color === frontPassenger.color &&
      v.occupiedSeats < v.capacity &&
      !v.boardedPassengerIds.includes(frontPassenger.id)
  );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const remainingA = a.capacity - a.occupiedSeats;
    const remainingB = b.capacity - b.occupiedSeats;
    if (remainingA !== remainingB) {
      return remainingA - remainingB;
    }
    return a.id.localeCompare(b.id);
  });

  return candidates[0];
}

/**
 * Evaluates whether the current game state has reached:
 * - Victory (`LEVEL_COMPLETED`): All passengers have boarded and all vehicles have cleared.
 * - Unrecoverable Failure (`LEVEL_FAILED`): All unlocked standard bays are occupied by `IN_BAY`
 *   vehicles, no vehicles are in transit (`MOVING_TO_BAY` or `DEPARTING`), no parked vehicle is
 *   at full capacity, and the front waiting passenger matches zero vehicles in any bay.
 */
export function evaluateWinAndFailureState(state: GameState): {
  nextState: GameState;
  didCompleteLevel: boolean;
  didFailLevel: boolean;
} {
  if (state.status !== 'PLAYING' && state.status !== 'READY') {
    return { nextState: state, didCompleteLevel: false, didFailLevel: false };
  }

  const allPassengersBoarded = state.passengerQueue.length === 0;
  const allVehiclesCleared = state.vehicles.every((v) => v.state === 'CLEARED');

  if (allPassengersBoarded && allVehiclesCleared) {
    return {
      nextState: {
        ...state,
        status: 'LEVEL_COMPLETED',
        selectedVehicleId: null,
        activeBoosterMode: 'NONE',
        victoryTriggerCount: state.victoryTriggerCount + 1,
        lastActionMessage: 'All passengers transported!',
      },
      didCompleteLevel: true,
      didFailLevel: false,
    };
  }

  // Never evaluate failure while any vehicle is still in transit to a bay or departing
  const anyVehicleInTransit = state.vehicles.some(
    (v) => v.state === 'MOVING_TO_BAY' || v.state === 'DEPARTING'
  );
  if (anyVehicleInTransit) {
    return { nextState: state, didCompleteLevel: false, didFailLevel: false };
  }

  // Check if any unlocked standard bay is still available
  const unlockedStandardBays = state.bays.filter((b) => !b.isVip && b.isUnlocked);
  const allStandardBaysOccupied =
    unlockedStandardBays.length > 0 &&
    unlockedStandardBays.every((b) => b.vehicleId !== null);

  if (!allStandardBaysOccupied) {
    return { nextState: state, didCompleteLevel: false, didFailLevel: false };
  }

  // Check if the front passenger can still board ANY vehicle currently in a bay (including VIP bay)
  const frontPassenger = state.passengerQueue[0];
  const eligibleVehicle = findEligibleVehicleForFrontPassenger(
    frontPassenger,
    state.vehicles,
    state.bays
  );

  if (eligibleVehicle) {
    return { nextState: state, didCompleteLevel: false, didFailLevel: false };
  }

  // Also ensure no vehicle in a bay is already full and waiting to depart
  const anyFullVehicleInBay = state.vehicles.some(
    (v) => v.state === 'IN_BAY' && v.occupiedSeats >= v.capacity
  );
  if (anyFullVehicleInBay) {
    return { nextState: state, didCompleteLevel: false, didFailLevel: false };
  }

  // Genuine unrecoverable deadlock reached
  return {
    nextState: {
      ...state,
      status: 'LEVEL_FAILED',
      selectedVehicleId: null,
      activeBoosterMode: 'NONE',
      failureTriggerCount: state.failureTriggerCount + 1,
      lastActionMessage: 'All parking bays are full and no bus matches the next passenger!',
    },
    didCompleteLevel: false,
    didFailLevel: true,
  };
}

/**
 * Executes a single atomic passenger boarding step from the front of the FIFO queue.
 * If a vehicle reaches full capacity (`occupiedSeats === capacity`), it immediately releases
 * its parking bay and transitions to `CLEARED` (or `DEPARTING` -> `CLEARED`).
 */
export function stepPassengerBoarding(state: GameState): BoardingStepResult {
  if (state.status !== 'PLAYING') {
    return {
      nextState: state,
      boardedPassengerId: null,
      targetVehicleId: null,
      departedVehicleIds: [],
      didCompleteLevel: false,
      didFailLevel: false,
    };
  }

  const frontPassenger = state.passengerQueue[0];
  const targetVehicle = findEligibleVehicleForFrontPassenger(
    frontPassenger,
    state.vehicles,
    state.bays
  );

  if (!frontPassenger || !targetVehicle) {
    // Even if no passenger can board right now, check if any already-full vehicle needs to depart
    const evalResult = evaluateWinAndFailureState(state);
    return {
      nextState: evalResult.nextState,
      boardedPassengerId: null,
      targetVehicleId: null,
      departedVehicleIds: [],
      didCompleteLevel: evalResult.didCompleteLevel,
      didFailLevel: evalResult.didFailLevel,
    };
  }

  const remainingQueue = state.passengerQueue.slice(1);
  const departedVehicleIds: string[] = [];

  const updatedVehicles = state.vehicles.map((v) => {
    if (v.id !== targetVehicle.id) return v;
    const nextOccupied = v.occupiedSeats + 1;
    const nextBoardedIds = [...v.boardedPassengerIds, frontPassenger.id];
    const isNowFull = nextOccupied >= v.capacity;
    if (isNowFull) {
      departedVehicleIds.push(v.id);
    }
    return {
      ...v,
      occupiedSeats: nextOccupied,
      boardedPassengerIds: nextBoardedIds,
      state: isNowFull ? ('CLEARED' as const) : ('IN_BAY' as const),
      assignedBayId: isNowFull ? null : v.assignedBayId,
    };
  });

  const departedSet = new Set(departedVehicleIds);
  const updatedBays = state.bays.map((bay) => {
    if (bay.vehicleId && departedSet.has(bay.vehicleId)) {
      return {
        ...bay,
        vehicleId: null,
        reservedByVehicleId: null,
      };
    }
    return bay;
  });

  const intermediateState: GameState = {
    ...state,
    vehicles: updatedVehicles,
    passengerQueue: remainingQueue,
    boardedPassengersCount: state.boardedPassengersCount + 1,
    bays: updatedBays,
  };

  const evalResult = evaluateWinAndFailureState(intermediateState);

  return {
    nextState: evalResult.nextState,
    boardedPassengerId: frontPassenger.id,
    targetVehicleId: targetVehicle.id,
    departedVehicleIds,
    didCompleteLevel: evalResult.didCompleteLevel,
    didFailLevel: evalResult.didFailLevel,
  };
}
