import {
  checkVehicleExitPath,
  revealUnblockedMysteryVehicles,
} from './collisionEngine';
import {
  createInitialBays,
  evaluateWinAndFailureState,
  findAvailableStandardBay,
  findAvailableVipBay,
  stepPassengerBoarding,
} from './boardingEngine';
import {
  BoardingStepResult,
  GameState,
  GameStatus,
  LevelData,
  LevelSnapshot,
  MoveResult,
  Passenger,
  PickBoosterResult,
  ShuffleBoosterResult,
  Vehicle,
} from './types';

function cloneVehicles(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.map((v) => ({
    ...v,
    boardedPassengerIds: [...v.boardedPassengerIds],
  }));
}

function clonePassengers(passengers: Passenger[]): Passenger[] {
  return passengers.map((p) => ({ ...p }));
}

/**
 * Creates a clean initial GameState from a LevelData definition.
 */
export function createGameStateFromLevel(
  level: LevelData,
  initialStatus: GameStatus = 'PLAYING'
): GameState {
  const revealedVehicles = revealUnblockedMysteryVehicles(
    cloneVehicles(level.vehicles),
    level.obstacles,
    level.gridWidth,
    level.gridHeight
  );

  const envTheme = level.environmentTheme ?? 'MODERN_CITY';

  const snapshot: LevelSnapshot = {
    levelNumber: level.levelNumber,
    tierName: level.tierName,
    archetype: level.archetype,
    environmentTheme: envTheme,
    gridWidth: level.gridWidth,
    gridHeight: level.gridHeight,
    vehicles: cloneVehicles(revealedVehicles),
    passengers: clonePassengers(level.passengers),
    obstacles: level.obstacles.map((o) => ({ ...o })),
    unlockedStandardBays: level.unlockedStandardBays,
  };

  return {
    levelNumber: level.levelNumber,
    tierName: level.tierName,
    archetype: level.archetype,
    environmentTheme: envTheme,
    status: initialStatus,
    gridWidth: level.gridWidth,
    gridHeight: level.gridHeight,
    vehicles: cloneVehicles(revealedVehicles),
    passengerQueue: clonePassengers(level.passengers),
    totalPassengers: level.passengers.length,
    boardedPassengersCount: 0,
    bays: createInitialBays(level.unlockedStandardBays),
    obstacles: level.obstacles.map((o) => ({ ...o })),
    selectedVehicleId: null,
    blockedFeedback: null,
    activeBoosterMode: 'NONE',
    moveCount: 0,
    boostersUsedCount: 0,
    victoryTriggerCount: 0,
    failureTriggerCount: 0,
    rewardClaimed: false,
    lastActionMessage: null,
    initialSnapshot: snapshot,
  };
}

/**
 * Transitions the game state between valid lifecycle statuses (`LOADING`, `READY`, `PLAYING`, `PAUSED`).
 */
export function setGameStatus(
  state: GameState,
  targetStatus: GameStatus
): GameState {
  if (state.status === targetStatus) return state;
  return {
    ...state,
    status: targetStatus,
    activeBoosterMode:
      targetStatus === 'PAUSED' ? 'NONE' : state.activeBoosterMode,
  };
}

/**
 * Restores the exact initial level state from `state.initialSnapshot`.
 * Resets vehicle positions, capacities, passenger queue, bay occupancy, and temporary effects.
 */
export function restartLevelState(
  state: GameState,
  targetStatus: GameStatus = 'PLAYING'
): GameState {
  const snap = state.initialSnapshot;
  return {
    levelNumber: snap.levelNumber,
    tierName: snap.tierName,
    archetype: snap.archetype,
    environmentTheme:
      snap.environmentTheme ?? state.environmentTheme ?? 'MODERN_CITY',
    status: targetStatus,
    gridWidth: snap.gridWidth,
    gridHeight: snap.gridHeight,
    vehicles: cloneVehicles(snap.vehicles),
    passengerQueue: clonePassengers(snap.passengers),
    totalPassengers: snap.passengers.length,
    boardedPassengersCount: 0,
    bays: createInitialBays(snap.unlockedStandardBays),
    obstacles: snap.obstacles.map((o) => ({ ...o })),
    selectedVehicleId: null,
    blockedFeedback: null,
    activeBoosterMode: 'NONE',
    moveCount: 0,
    boostersUsedCount: 0,
    victoryTriggerCount: 0,
    failureTriggerCount: 0,
    rewardClaimed: false,
    lastActionMessage: 'Level restarted',
    initialSnapshot: {
      ...snap,
      vehicles: cloneVehicles(snap.vehicles),
      passengers: clonePassengers(snap.passengers),
      obstacles: snap.obstacles.map((o) => ({ ...o })),
    },
  };
}

/**
 * Selects a vehicle on mobile touch input and attempts to move it to an available Parking Bay.
 *
 * Options:
 * - `instantArrival: true` (default `false` for UI animations, `true` for synchronous steps):
 *   Immediately places the vehicle in `IN_BAY` state instead of `MOVING_TO_BAY`.
 */
export function selectAndMoveVehicle(
  state: GameState,
  vehicleId: string,
  options: { instantArrival?: boolean } = {}
): MoveResult {
  // Automatically transition READY -> PLAYING on first valid player tap
  const workingState =
    state.status === 'READY' ? { ...state, status: 'PLAYING' as const } : state;

  if (workingState.status !== 'PLAYING') {
    return {
      nextState: state,
      outcome: 'INVALID_STATE',
    };
  }

  // If VIP Booster Selection Mode is active, route tap to VIP booster handler
  if (workingState.activeBoosterMode === 'VIP_SELECT') {
    return applyVipBoosterToVehicle(workingState, vehicleId, options);
  }

  const targetVehicle = workingState.vehicles.find((v) => v.id === vehicleId);
  if (!targetVehicle || targetVehicle.state !== 'PARKED_IN_LOT') {
    return {
      nextState: workingState,
      outcome: 'INVALID_VEHICLE',
    };
  }

  // Check if an unlocked standard bay is available BEFORE moving
  const availableBay = findAvailableStandardBay(workingState.bays);
  if (!availableBay) {
    return {
      nextState: {
        ...workingState,
        selectedVehicleId: vehicleId,
        lastActionMessage: 'All parking bays are currently occupied!',
      },
      outcome: 'NO_FREE_BAY',
    };
  }

  // Check line-of-sight exit path along the vehicle's facing direction
  const rayCheck = checkVehicleExitPath(
    targetVehicle,
    workingState.vehicles,
    workingState.obstacles,
    workingState.gridWidth,
    workingState.gridHeight
  );

  if (rayCheck.isBlocked && rayCheck.blockedAtCell) {
    return {
      nextState: {
        ...workingState,
        selectedVehicleId: vehicleId,
        blockedFeedback: {
          vehicleId,
          blockerVehicleId: rayCheck.blockerVehicleId,
          blockerObstacleId: rayCheck.blockerObstacleId,
          blockedCell: rayCheck.blockedAtCell,
          direction: targetVehicle.direction,
          timestamp: Date.now(),
        },
        lastActionMessage: rayCheck.blockerVehicleId
          ? 'Path blocked by another vehicle!'
          : 'Path blocked by a barrier!',
      },
      outcome: rayCheck.blockerVehicleId
        ? 'BLOCKED_BY_VEHICLE'
        : 'BLOCKED_BY_OBSTACLE',
      blockerVehicleId: rayCheck.blockerVehicleId,
      blockerObstacleId: rayCheck.blockerObstacleId,
    };
  }

  // Path is clear and bay is available!
  const instant = options.instantArrival ?? false;
  const nextVehicleState = instant
    ? ('IN_BAY' as const)
    : ('MOVING_TO_BAY' as const);

  let updatedVehicles = workingState.vehicles.map((v) => {
    if (v.id !== vehicleId) return v;
    return {
      ...v,
      state: nextVehicleState,
      assignedBayId: availableBay.id,
      isMystery: false,
    };
  });

  // Reveal any Mystery vehicles whose exit path just became unblocked
  updatedVehicles = revealUnblockedMysteryVehicles(
    updatedVehicles,
    workingState.obstacles,
    workingState.gridWidth,
    workingState.gridHeight
  );

  const updatedBays = workingState.bays.map((bay) => {
    if (bay.id !== availableBay.id) return bay;
    return {
      ...bay,
      vehicleId: instant ? vehicleId : null,
      reservedByVehicleId: instant ? null : vehicleId,
    };
  });

  let nextState: GameState = {
    ...workingState,
    vehicles: updatedVehicles,
    bays: updatedBays,
    selectedVehicleId: vehicleId,
    blockedFeedback: null,
    moveCount: workingState.moveCount + 1,
    lastActionMessage: null,
  };

  if (instant) {
    const evalResult = evaluateWinAndFailureState(nextState);
    nextState = evalResult.nextState;
  }

  return {
    nextState,
    outcome: 'MOVED_TO_BAY',
    targetBayId: availableBay.id,
  };
}

/**
 * Completes the road transit animation for a vehicle in `MOVING_TO_BAY` state,
 * transitioning it into `IN_BAY` inside its reserved Parking Bay.
 */
export function completeVehicleArrival(
  state: GameState,
  vehicleId: string
): GameState {
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  if (
    !vehicle ||
    vehicle.state !== 'MOVING_TO_BAY' ||
    !vehicle.assignedBayId
  ) {
    return state;
  }

  const updatedVehicles = state.vehicles.map((v) =>
    v.id === vehicleId ? { ...v, state: 'IN_BAY' as const } : v
  );

  const updatedBays = state.bays.map((bay) => {
    if (bay.id !== vehicle.assignedBayId) return bay;
    return {
      ...bay,
      vehicleId: vehicleId,
      reservedByVehicleId: null,
    };
  });

  const arrivedState: GameState = {
    ...state,
    vehicles: updatedVehicles,
    bays: updatedBays,
  };

  return evaluateWinAndFailureState(arrivedState).nextState;
}

/**
 * Runs all currently eligible passenger boarding steps until no further immediate
 * matches exist or the level completes/fails. Useful for deterministic tests and fast-forward.
 */
export function resolveAllImmediateBoarding(state: GameState): {
  nextState: GameState;
  totalBoardedThisWave: number;
  departedVehicleIds: string[];
} {
  let current = state;
  let totalBoarded = 0;
  const departed: string[] = [];

  // Guard max iterations by total passengers + 5
  const maxSteps = current.passengerQueue.length + 5;
  for (let i = 0; i < maxSteps; i++) {
    if (current.status !== 'PLAYING') break;
    const step: BoardingStepResult = stepPassengerBoarding(current);
    current = step.nextState;
    if (step.boardedPassengerId) {
      totalBoarded++;
    }
    if (step.departedVehicleIds.length > 0) {
      departed.push(...step.departedVehicleIds);
    }
    if (!step.boardedPassengerId) {
      break;
    }
  }

  return {
    nextState: current,
    totalBoardedThisWave: totalBoarded,
    departedVehicleIds: departed,
  };
}

/**
 * Toggles VIP Booster selection mode (or cancels it if already in `VIP_SELECT` mode).
 * Does not deduct booster inventory until a valid target vehicle is actually moved.
 */
export function toggleVipBoosterMode(state: GameState): GameState {
  if (state.status !== 'PLAYING' && state.status !== 'LEVEL_FAILED') {
    return state;
  }
  if (state.activeBoosterMode === 'VIP_SELECT') {
    return cancelVipBoosterMode(state);
  }
  const vipBay = findAvailableVipBay(state.bays);
  if (!vipBay) {
    return {
      ...state,
      activeBoosterMode: 'NONE',
      lastActionMessage: 'VIP Bay is already occupied!',
    };
  }
  return {
    ...state,
    status: 'PLAYING',
    activeBoosterMode: 'VIP_SELECT',
    lastActionMessage:
      'VIP Active: Tap any bus in the lot or a bay to move it to the VIP Bay (or tap VIP again to cancel).',
  };
}

/**
 * Cancels VIP Booster selection mode without consuming any inventory or coins.
 */
export function cancelVipBoosterMode(state: GameState): GameState {
  if (state.activeBoosterMode === 'NONE') {
    return state;
  }
  return {
    ...state,
    activeBoosterMode: 'NONE',
    lastActionMessage: 'VIP Booster canceled.',
  };
}

/**
 * Applies the VIP Booster to a specific vehicle:
 * - Can airlift ANY `PARKED_IN_LOT` vehicle (even if blocked!) directly into the VIP Bay.
 * - Or can shift an `IN_BAY` vehicle from a standard bay into the VIP Bay (freeing the standard bay).
 */
export function applyVipBoosterToVehicle(
  state: GameState,
  vehicleId: string,
  options: { instantArrival?: boolean } = { instantArrival: true }
): MoveResult {
  if (state.status !== 'PLAYING' && state.status !== 'LEVEL_FAILED') {
    return {
      nextState: state,
      outcome: 'INVALID_STATE',
    };
  }

  const vipBay = findAvailableVipBay(state.bays);
  if (!vipBay) {
    return {
      nextState: {
        ...state,
        activeBoosterMode: 'NONE',
        lastActionMessage: 'VIP Bay is already occupied!',
      },
      outcome: 'NO_FREE_BAY',
    };
  }

  const target = state.vehicles.find((v) => v.id === vehicleId);
  if (
    !target ||
    (target.state !== 'PARKED_IN_LOT' && target.state !== 'IN_BAY') ||
    target.assignedBayId === vipBay.id
  ) {
    return {
      nextState: {
        ...state,
        lastActionMessage: 'Select a valid parked or bay bus for the VIP Slot!',
      },
      outcome: 'INVALID_VEHICLE',
    };
  }

  const instant = options.instantArrival ?? true;
  const previousBayId = target.assignedBayId;

  let updatedVehicles = state.vehicles.map((v) => {
    if (v.id !== vehicleId) return v;
    return {
      ...v,
      state: instant ? ('IN_BAY' as const) : ('MOVING_TO_BAY' as const),
      assignedBayId: vipBay.id,
      isMystery: false,
    };
  });

  updatedVehicles = revealUnblockedMysteryVehicles(
    updatedVehicles,
    state.obstacles,
    state.gridWidth,
    state.gridHeight
  );

  const updatedBays = state.bays.map((bay) => {
    if (bay.id === previousBayId) {
      return { ...bay, vehicleId: null, reservedByVehicleId: null };
    }
    if (bay.id === vipBay.id) {
      return {
        ...bay,
        vehicleId: instant ? vehicleId : null,
        reservedByVehicleId: instant ? null : vehicleId,
      };
    }
    return bay;
  });

  const nextState: GameState = {
    ...state,
    status: 'PLAYING',
    vehicles: updatedVehicles,
    bays: updatedBays,
    selectedVehicleId: vehicleId,
    blockedFeedback: null,
    activeBoosterMode: 'NONE',
    boostersUsedCount: state.boostersUsedCount + 1,
    lastActionMessage: 'VIP Airlift moved bus to the VIP Parking Bay!',
  };

  return {
    nextState: instant
      ? evaluateWinAndFailureState(nextState).nextState
      : nextState,
    outcome: 'MOVED_TO_VIP_BAY',
    targetBayId: vipBay.id,
  };
}

/**
 * PICK Booster (Passenger Magnet):
 * Selects a vehicle currently in a bay (`IN_BAY` with `occupiedSeats < capacity`) and pulls
 * matching-color passengers from anywhere in `passengerQueue` directly onto that vehicle
 * until it reaches full capacity and departs!
 */
export function applyPickBooster(
  state: GameState,
  preferredVehicleId?: string
): PickBoosterResult {
  if (state.status !== 'PLAYING' && state.status !== 'LEVEL_FAILED') {
    return {
      nextState: state,
      applied: false,
      reason: 'INVALID_STATE',
      targetVehicleId: null,
      pickedPassengerIds: [],
      departed: false,
    };
  }

  const inBayVehicles = state.vehicles.filter(
    (v) => v.state === 'IN_BAY' && v.occupiedSeats < v.capacity
  );

  if (preferredVehicleId !== undefined) {
    const explicitTarget = inBayVehicles.find(
      (v) => v.id === preferredVehicleId
    );
    if (!explicitTarget) {
      return {
        nextState: {
          ...state,
          lastActionMessage:
            'Selected vehicle is not parked in a bay or is already full!',
        },
        applied: false,
        reason: 'INVALID_TARGET',
        targetVehicleId: null,
        pickedPassengerIds: [],
        departed: false,
      };
    }
  }

  if (inBayVehicles.length === 0) {
    return {
      nextState: {
        ...state,
        lastActionMessage: 'Park a bus in a bay first to use Passenger Pick!',
      },
      applied: false,
      reason: 'NO_ELIGIBLE_BAY_VEHICLE',
      targetVehicleId: null,
      pickedPassengerIds: [],
      departed: false,
    };
  }

  const frontColor = state.passengerQueue[0]?.color;
  // Prioritize: 1) preferredVehicleId, 2) bay bus matching front passenger color, 3) fullest bay bus
  const sorted = [...inBayVehicles].sort((a, b) => {
    const aMatchesFront = a.color === frontColor ? 1 : 0;
    const bMatchesFront = b.color === frontColor ? 1 : 0;
    if (aMatchesFront !== bMatchesFront) {
      return bMatchesFront - aMatchesFront;
    }
    return b.occupiedSeats - a.occupiedSeats;
  });

  const targetVehicle =
    (preferredVehicleId &&
      inBayVehicles.find((v) => v.id === preferredVehicleId)) ||
    sorted[0];

  const seatsNeeded = targetVehicle.capacity - targetVehicle.occupiedSeats;
  const pickedPassengers: Passenger[] = [];
  const remainingQueue: Passenger[] = [];

  for (const p of state.passengerQueue) {
    if (
      p.color === targetVehicle.color &&
      pickedPassengers.length < seatsNeeded &&
      !targetVehicle.boardedPassengerIds.includes(p.id)
    ) {
      pickedPassengers.push(p);
    } else {
      remainingQueue.push(p);
    }
  }

  if (pickedPassengers.length === 0) {
    return {
      nextState: {
        ...state,
        lastActionMessage: 'No matching passengers left in queue!',
      },
      applied: false,
      reason: 'NO_MATCHING_PASSENGERS',
      targetVehicleId: targetVehicle.id,
      pickedPassengerIds: [],
      departed: false,
    };
  }

  const newOccupied = targetVehicle.occupiedSeats + pickedPassengers.length;
  const isNowFull = newOccupied >= targetVehicle.capacity;
  const pickedIds = pickedPassengers.map((p) => p.id);

  const updatedVehicles = state.vehicles.map((v) => {
    if (v.id !== targetVehicle.id) return v;
    return {
      ...v,
      occupiedSeats: newOccupied,
      boardedPassengerIds: [...v.boardedPassengerIds, ...pickedIds],
      state: isNowFull ? ('CLEARED' as const) : ('IN_BAY' as const),
      assignedBayId: isNowFull ? null : v.assignedBayId,
    };
  });

  const updatedBays = state.bays.map((bay) => {
    if (isNowFull && bay.vehicleId === targetVehicle.id) {
      return { ...bay, vehicleId: null, reservedByVehicleId: null };
    }
    return bay;
  });

  const intermediateState: GameState = {
    ...state,
    status: 'PLAYING',
    vehicles: updatedVehicles,
    passengerQueue: remainingQueue,
    boardedPassengersCount:
      state.boardedPassengersCount + pickedPassengers.length,
    bays: updatedBays,
    activeBoosterMode: 'NONE',
    boostersUsedCount: state.boostersUsedCount + 1,
    lastActionMessage: `Pick Booster boarded ${pickedPassengers.length} ${targetVehicle.color} passengers!`,
  };

  return {
    nextState: evaluateWinAndFailureState(intermediateState).nextState,
    applied: true,
    targetVehicleId: targetVehicle.id,
    pickedPassengerIds: pickedIds,
    departed: isNowFull,
  };
}

/**
 * SHUFFLE Booster:
 * Rearranges the colors of all `PARKED_IN_LOT` vehicles grouped by identical `capacity`
 * (`4`, `6`, `8`) and reveals all Mystery vehicles.
 * Because vehicles only swap colors with other `PARKED_IN_LOT` vehicles of the exact same
 * seat capacity, the total number of available seats for every color remains 100% invariant
 * and zero overlapping or out-of-bounds positions can ever occur!
 */
export function applyShuffleBooster(state: GameState): ShuffleBoosterResult {
  if (state.status !== 'PLAYING') {
    return {
      nextState: state,
      applied: false,
      reason: 'INVALID_STATE',
      swappedVehicleCount: 0,
      revealedMysteryCount: 0,
    };
  }

  const parkedVehicles = state.vehicles.filter(
    (v) => v.state === 'PARKED_IN_LOT'
  );
  if (parkedVehicles.length <= 1) {
    return {
      nextState: {
        ...state,
        lastActionMessage: 'Need at least 2 buses in the lot to shuffle!',
      },
      applied: false,
      reason: 'NOT_ENOUGH_VEHICLES',
      swappedVehicleCount: 0,
      revealedMysteryCount: 0,
    };
  }

  // Group parked vehicles by capacity so seat parity per color is strictly preserved
  const byCapacity = new Map<number, Vehicle[]>();
  for (const v of parkedVehicles) {
    const group = byCapacity.get(v.capacity) || [];
    group.push(v);
    byCapacity.set(v.capacity, group);
  }

  // Prioritize placing the front passenger's color onto a currently unblocked vehicle
  const desiredColor = state.passengerQueue[0]?.color;
  const newColorByVehicleId = new Map<string, Vehicle['color']>();

  for (const [, group] of byCapacity.entries()) {
    const colors = group.map((v) => v.color);
    // Deterministic cyclic rotation + swap so the shuffle noticeably changes vehicle colors
    if (colors.length > 1) {
      const first = colors.shift()!;
      colors.push(first);

      // If all rotated elements happened to match original positions (e.g. A, B, A, B shifted by 2),
      // find any pair with distinct colors and swap them so colors genuinely rearrange
      const anyChanged = group.some((v, idx) => v.color !== colors[idx]);
      if (!anyChanged) {
        const diffIdx = colors.findIndex((c) => c !== colors[0]);
        if (diffIdx > 0) {
          const tmp = colors[0];
          colors[0] = colors[diffIdx];
          colors[diffIdx] = tmp;
        }
      }
    }

    if (desiredColor) {
      const desiredIdx = colors.indexOf(desiredColor);
      if (desiredIdx !== -1) {
        const unblockedVehicleIdx = group.findIndex(
          (v) =>
            !checkVehicleExitPath(
              v,
              state.vehicles,
              state.obstacles,
              state.gridWidth,
              state.gridHeight
            ).isBlocked
        );
        if (unblockedVehicleIdx !== -1 && unblockedVehicleIdx !== desiredIdx) {
          const temp = colors[unblockedVehicleIdx];
          colors[unblockedVehicleIdx] = colors[desiredIdx];
          colors[desiredIdx] = temp;
        }
      }
    }

    group.forEach((v, idx) => {
      newColorByVehicleId.set(v.id, colors[idx]);
    });
  }

  let swappedVehicleCount = 0;
  let revealedMysteryCount = 0;

  const updatedVehicles = state.vehicles.map((v) => {
    if (v.state !== 'PARKED_IN_LOT') return v;
    const swappedColor = newColorByVehicleId.get(v.id) ?? v.color;
    if (swappedColor !== v.color) {
      swappedVehicleCount++;
    }
    if (v.isMystery) {
      revealedMysteryCount++;
    }
    return {
      ...v,
      color: swappedColor,
      isMystery: false,
    };
  });

  if (swappedVehicleCount === 0 && revealedMysteryCount === 0) {
    return {
      nextState: {
        ...state,
        lastActionMessage:
          'Remaining buses in the lot already share the same color and capacity!',
      },
      applied: false,
      reason: 'NO_COLOR_VARIATION',
      swappedVehicleCount: 0,
      revealedMysteryCount: 0,
    };
  }

  return {
    nextState: {
      ...state,
      vehicles: updatedVehicles,
      activeBoosterMode: 'NONE',
      boostersUsedCount: state.boostersUsedCount + 1,
      lastActionMessage: `Shuffled ${swappedVehicleCount} buses${
        revealedMysteryCount > 0
          ? ` and revealed ${revealedMysteryCount} mystery bus(es)`
          : ''
      }!`,
    },
    applied: true,
    swappedVehicleCount,
    revealedMysteryCount,
  };
}

/**
 * Unlocks the next locked standard parking bay (`bay-4` or `bay-5`).
 */
export function unlockNextStandardBay(state: GameState): {
  nextState: GameState;
  unlockedBayId: string | null;
} {
  const lockedBay = state.bays.find((b) => !b.isVip && !b.isUnlocked);
  if (!lockedBay) {
    return { nextState: state, unlockedBayId: null };
  }

  const updatedBays = state.bays.map((b) =>
    b.id === lockedBay.id ? { ...b, isUnlocked: true } : b
  );

  const nextState: GameState = {
    ...state,
    status: state.status === 'LEVEL_FAILED' ? 'PLAYING' : state.status,
    bays: updatedBays,
    lastActionMessage: `Unlocked Extra Parking Bay #${lockedBay.index + 1}!`,
  };

  return {
    nextState: evaluateWinAndFailureState(nextState).nextState,
    unlockedBayId: lockedBay.id,
  };
}
