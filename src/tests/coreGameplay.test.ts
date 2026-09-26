import {
  applyPickBooster,
  applyShuffleBooster,
  applyVipBoosterToVehicle,
  cancelVipBoosterMode,
  completeVehicleArrival,
  createGameStateFromLevel,
  resolveAllImmediateBoarding,
  restartLevelState,
  selectAndMoveVehicle,
  setGameStatus,
  toggleVipBoosterMode,
} from '../game/gameEngine';
import {
  buildVehicleBayPath,
  cancelAndResetAnimations,
  createAnimationController,
  evaluateSmoothMotionProfile,
  lerpShortestAngleDeg,
  setVehicleDoorTargetState,
  startPassengerBoardingAnimation,
  startVehicleMotionAnimation,
  stepAnimationSystem,
  triggerVehicleSuspensionImpulse,
} from '../game/animationEngine';
import {
  ENVIRONMENT_THEME_IDS,
  ENVIRONMENT_THEMES,
  getEnvironmentThemeForLevel,
} from '../assets/environmentThemes';
import { stepPassengerBoarding } from '../game/boardingEngine';
import {
  solveLevelIndependently,
  validateAll100Levels,
  validateLevelData,
} from '../game/levelValidator';
import { generateLevel } from '../game/levelGenerator';
import {
  BACKUP_STORAGE_KEY,
  BOOSTER_COIN_COSTS,
  canLaunchLevel,
  checkBoosterAvailability,
  consumeBoosterFromSave,
  createDefaultSaveData,
  CURRENT_SAVE_VERSION,
  flushSaveOnAppInterruption,
  getStorageDiagnostics,
  loadSaveData,
  migrateAndSanitizeSaveData,
  recordLevelCompletionInSave,
  resetStorageDiagnostics,
  savePlayerData,
  setSimulateStorageFailure,
  spendCoinsFromSave,
  STORAGE_KEY,
} from '../game/storageManager';
import { audioManager } from '../game/audioManager';
import {
  buildInstancedVehicleScene,
  CAR_MODEL_VARIANTS,
  CONSOLIDATED_MATERIAL_REGISTRY,
  getMeshSymbolDomId,
  resolveCarModelVariant,
  resolveConsolidatedMaterial,
  resolveSharedGeometryBuffer,
  resolveVehicleMeshArchetype,
  SHARED_GEOMETRY_BUFFER_REGISTRY,
  VEHICLE_MESH_ARCHETYPE_IDS,
} from '../game/instancedVehicleRenderer';
import { LevelData, Passenger, Vehicle } from '../game/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function createSyntheticTestLevel(): LevelData {
  // 6x6 grid:
  // - bus-red-1 at (2, 0) facing UP (length 2 -> occupies (2,0) and (2,1)): UNBLOCKED!
  // - bus-blue-2 at (2, 2) facing UP (length 2 -> occupies (2,2) and (2,3)): BLOCKED by bus-red-1!
  // - bus-green-3 at (4, 2) facing RIGHT (length 2 -> occupies (4,2) and (3,2)): BLOCKED by obstacle at (5,2)!
  const vehicles: Vehicle[] = [
    {
      id: 'bus-red-1',
      color: 'RED',
      capacity: 4,
      occupiedSeats: 0,
      boardedPassengerIds: [],
      gridX: 2,
      gridY: 0,
      length: 2,
      direction: 'UP',
      state: 'PARKED_IN_LOT',
      assignedBayId: null,
    },
    {
      id: 'bus-blue-2',
      color: 'BLUE',
      capacity: 4,
      occupiedSeats: 0,
      boardedPassengerIds: [],
      gridX: 2,
      gridY: 2,
      length: 2,
      direction: 'UP',
      state: 'PARKED_IN_LOT',
      assignedBayId: null,
    },
    {
      id: 'bus-green-3',
      color: 'GREEN',
      capacity: 4,
      occupiedSeats: 0,
      boardedPassengerIds: [],
      gridX: 4,
      gridY: 2,
      length: 2,
      direction: 'RIGHT',
      state: 'PARKED_IN_LOT',
      assignedBayId: null,
    },
  ];

  const passengers: Passenger[] = [
    // 4 RED, 4 BLUE, 4 GREEN
    { id: 'p-r1', color: 'RED', boarded: false },
    { id: 'p-r2', color: 'RED', boarded: false },
    { id: 'p-r3', color: 'RED', boarded: false },
    { id: 'p-r4', color: 'RED', boarded: false },
    { id: 'p-b1', color: 'BLUE', boarded: false },
    { id: 'p-b2', color: 'BLUE', boarded: false },
    { id: 'p-b3', color: 'BLUE', boarded: false },
    { id: 'p-b4', color: 'BLUE', boarded: false },
    { id: 'p-g1', color: 'GREEN', boarded: false },
    { id: 'p-g2', color: 'GREEN', boarded: false },
    { id: 'p-g3', color: 'GREEN', boarded: false },
    { id: 'p-g4', color: 'GREEN', boarded: false },
  ];

  return {
    levelNumber: 1,
    tierName: 'Unit Test Lot',
    gridWidth: 6,
    gridHeight: 6,
    vehicles,
    passengers,
    obstacles: [{ id: 'obs-1', x: 5, y: 2, label: 'Barrier' }],
    unlockedStandardBays: 4,
  };
}

export function runAllCoreGameplayTests(): {
  passed: number;
  failed: number;
  results: { name: string; passed: boolean; error?: string }[];
} {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name, passed: false, error: msg });
    }
  }

  // 1. Valid and Invalid Moves + Game State Machine
  runTest('1. Valid and invalid moves & game state guards', () => {
    const level = createSyntheticTestLevel();
    let state = createGameStateFromLevel(level, 'LOADING');
    assert(state.status === 'LOADING', 'Initial status should be LOADING');

    // Moving while LOADING must be rejected
    const loadingMove = selectAndMoveVehicle(state, 'bus-red-1');
    assert(loadingMove.outcome === 'INVALID_STATE', 'Move during LOADING must return INVALID_STATE');

    // Transition LOADING -> READY -> PLAYING on tap
    state = setGameStatus(state, 'READY');
    const validMove = selectAndMoveVehicle(state, 'bus-red-1', { instantArrival: false });
    assert(validMove.outcome === 'MOVED_TO_BAY', 'Unblocked bus-red-1 must move to bay');
    assert(validMove.nextState.status === 'PLAYING', 'READY state must transition to PLAYING on tap');
    assert(
      validMove.nextState.selectedVehicleId === 'bus-red-1',
      'Selected vehicle ID should be recorded'
    );

    // Tapping a non-existent or already-moving vehicle must be rejected safely
    const duplicateTap = selectAndMoveVehicle(validMove.nextState, 'bus-red-1');
    assert(
      duplicateTap.outcome === 'INVALID_VEHICLE',
      'Repeated tap on moving vehicle must be safely ignored'
    );

    const unknownTap = selectAndMoveVehicle(validMove.nextState, 'non-existent-id');
    assert(unknownTap.outcome === 'INVALID_VEHICLE', 'Unknown vehicle ID must return INVALID_VEHICLE');

    // Pausing prevents moves
    const pausedState = setGameStatus(validMove.nextState, 'PAUSED');
    const pausedMove = selectAndMoveVehicle(pausedState, 'bus-blue-2');
    assert(pausedMove.outcome === 'INVALID_STATE', 'Move while PAUSED must be rejected');
  });

  // 2. Traffic Blocking (Vehicle & Obstacle Blocking)
  runTest('2. Traffic blocking detection & state preservation', () => {
    const level = createSyntheticTestLevel();
    const state = createGameStateFromLevel(level, 'PLAYING');

    // bus-blue-2 is blocked by bus-red-1 directly ahead
    const blockedByBus = selectAndMoveVehicle(state, 'bus-blue-2', { instantArrival: true });
    assert(
      blockedByBus.outcome === 'BLOCKED_BY_VEHICLE',
      'bus-blue-2 should be blocked by bus-red-1'
    );
    assert(
      blockedByBus.blockerVehicleId === 'bus-red-1',
      'Blocker vehicle ID must identify bus-red-1'
    );
    assert(
      blockedByBus.nextState.blockedFeedback?.blockerVehicleId === 'bus-red-1',
      'Blocked feedback must record blocker vehicle ID'
    );
    // Verify state was not corrupted
    const blueBusAfter = blockedByBus.nextState.vehicles.find((v) => v.id === 'bus-blue-2')!;
    assert(blueBusAfter.state === 'PARKED_IN_LOT', 'Blocked vehicle must remain PARKED_IN_LOT');
    assert(
      blockedByBus.nextState.bays.every((b) => b.vehicleId === null),
      'No bay should be occupied after blocked move'
    );

    // bus-green-3 is blocked by obstacle obs-1 at (5,2)
    const blockedByObs = selectAndMoveVehicle(state, 'bus-green-3', { instantArrival: true });
    assert(
      blockedByObs.outcome === 'BLOCKED_BY_OBSTACLE',
      'bus-green-3 should be blocked by obstacle obs-1'
    );
    assert(
      blockedByObs.blockerObstacleId === 'obs-1',
      'Blocker obstacle ID must identify obs-1'
    );

    // Once bus-red-1 moves out, bus-blue-2 becomes unblocked!
    const afterRedMoves = selectAndMoveVehicle(state, 'bus-red-1', { instantArrival: true }).nextState;
    const blueNowFree = selectAndMoveVehicle(afterRedMoves, 'bus-blue-2', { instantArrival: true });
    assert(
      blueNowFree.outcome === 'MOVED_TO_BAY',
      'bus-blue-2 must move freely after blocker bus-red-1 vacates its cells'
    );
  });

  // 3. Passenger Matching & Duplicate Prevention
  runTest('3. Passenger matching rules & single-boarding guarantee', () => {
    const level = createSyntheticTestLevel();
    let state = createGameStateFromLevel(level, 'PLAYING');

    // Move bus-red-1 to bay first, then move bus-blue-2 to bay
    state = selectAndMoveVehicle(state, 'bus-red-1', { instantArrival: true }).nextState;
    state = selectAndMoveVehicle(state, 'bus-blue-2', { instantArrival: true }).nextState;

    // Front passenger is RED ('p-r1'). Stepping boarding must board onto bus-red-1, NOT bus-blue-2.
    const step1 = stepPassengerBoarding(state);
    assert(step1.boardedPassengerId === 'p-r1', 'Front passenger p-r1 should board first');
    assert(step1.targetVehicleId === 'bus-red-1', 'RED passenger must match RED vehicle');

    const redBus = step1.nextState.vehicles.find((v) => v.id === 'bus-red-1')!;
    const blueBus = step1.nextState.vehicles.find((v) => v.id === 'bus-blue-2')!;
    assert(redBus.occupiedSeats === 1, 'RED bus should have 1 occupied seat');
    assert(blueBus.occupiedSeats === 0, 'BLUE bus should still have 0 occupied seats');
    assert(
      !step1.nextState.passengerQueue.some((p) => p.id === 'p-r1'),
      'Boarded passenger p-r1 must be removed from queue so it cannot board twice'
    );
  });

  // 4. Vehicle Capacity & Automatic Bay Departure
  runTest('4. Vehicle capacity enforcement & automatic departure when full', () => {
    const level = createSyntheticTestLevel();
    let state = createGameStateFromLevel(level, 'PLAYING');

    state = selectAndMoveVehicle(state, 'bus-red-1', { instantArrival: true }).nextState;

    // Board 3 RED passengers: bus-red-1 has capacity 4, so it stays IN_BAY at 3/4
    for (let i = 0; i < 3; i++) {
      const res = stepPassengerBoarding(state);
      state = res.nextState;
      assert(res.departedVehicleIds.length === 0, `Bus should not depart at ${i + 1}/4 seats`);
    }

    const redAt3 = state.vehicles.find((v) => v.id === 'bus-red-1')!;
    assert(redAt3.occupiedSeats === 3 && redAt3.state === 'IN_BAY', 'Bus should be IN_BAY at 3/4');

    // Board 4th RED passenger: bus-red-1 reaches 4/4 capacity and immediately departs (CLEARED)
    const step4 = stepPassengerBoarding(state);
    state = step4.nextState;
    assert(
      step4.departedVehicleIds.includes('bus-red-1'),
      'bus-red-1 must depart upon reaching 4/4 capacity'
    );
    const redAt4 = state.vehicles.find((v) => v.id === 'bus-red-1')!;
    assert(redAt4.occupiedSeats === 4, 'Bus occupiedSeats must equal capacity (4)');
    assert(redAt4.state === 'CLEARED', 'Full bus must transition to CLEARED');
    assert(
      state.bays.every((b) => b.vehicleId !== 'bus-red-1'),
      'Departed bus must vacate its parking bay'
    );
  });

  // 5. Parking Bay Occupancy & Reservation Safety
  runTest('5. Parking bay occupancy limits & rapid-tap reservation safety', () => {
    const baseLevel = createSyntheticTestLevel();
    // Create 5 unblocked vehicles on row 0 facing UP, with only 4 unlocked standard bays
    const fiveVehicles: Vehicle[] = [0, 1, 2, 3, 4].map((x) => ({
      id: `v-${x}`,
      color: 'BLUE',
      capacity: 4,
      occupiedSeats: 0,
      boardedPassengerIds: [],
      gridX: x,
      gridY: 0,
      length: 2,
      direction: 'UP',
      state: 'PARKED_IN_LOT',
      assignedBayId: null,
    }));

    const customLevel: LevelData = {
      ...baseLevel,
      vehicles: fiveVehicles,
      obstacles: [],
      unlockedStandardBays: 4,
    };

    let state = createGameStateFromLevel(customLevel, 'PLAYING');

    // Rapidly move 4 vehicles with `instantArrival: false` (simulating in-flight animation)
    const assignedBays = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const res = selectAndMoveVehicle(state, `v-${i}`, { instantArrival: false });
      assert(res.outcome === 'MOVED_TO_BAY', `Vehicle v-${i} should reserve a bay`);
      assert(res.targetBayId !== null && !assignedBays.has(res.targetBayId!), 'Each vehicle must reserve a unique bay');
      assignedBays.add(res.targetBayId!);
      state = res.nextState;
    }

    // 5th vehicle tap while 4 bays are reserved must return NO_FREE_BAY
    const fifthMove = selectAndMoveVehicle(state, 'v-4', { instantArrival: false });
    assert(
      fifthMove.outcome === 'NO_FREE_BAY',
      '5th vehicle must be rejected when all 4 standard bays are reserved'
    );

    // Complete arrival for all 4 moving vehicles
    for (let i = 0; i < 4; i++) {
      state = completeVehicleArrival(state, `v-${i}`);
    }
    const occupiedStandardBays = state.bays.filter((b) => !b.isVip && b.vehicleId !== null);
    assert(occupiedStandardBays.length === 4, 'All 4 standard bays should now be occupied');
  });

  // 6. Level Completion (Single-Trigger Guarantee)
  runTest('6. Level completion detection & single-trigger guarantee', () => {
    const level1 = generateLevel(1);
    let state = createGameStateFromLevel(level1, 'PLAYING');

    assert(
      level1.solutionOrder !== undefined && level1.solutionOrder.length === level1.vehicles.length,
      'Level 1 must have a complete solutionOrder'
    );

    for (const vid of level1.solutionOrder!) {
      const move = selectAndMoveVehicle(state, vid, { instantArrival: true });
      assert(move.outcome === 'MOVED_TO_BAY', `Solution move for ${vid} must succeed`);
      state = resolveAllImmediateBoarding(move.nextState).nextState;
    }

    assert(state.status === 'LEVEL_COMPLETED', 'Level status must be LEVEL_COMPLETED');
    assert(state.passengerQueue.length === 0, 'All passengers must be transported');
    assert(
      state.vehicles.every((v) => v.state === 'CLEARED'),
      'All vehicles must be CLEARED'
    );
    assert(
      state.victoryTriggerCount === 1,
      'Victory state must trigger exactly once (victoryTriggerCount === 1)'
    );

    // Additional boarding ticks after completion must NOT increment victoryTriggerCount again
    const extraStep = stepPassengerBoarding(state);
    assert(
      extraStep.nextState.victoryTriggerCount === 1,
      'Subsequent ticks must not re-trigger victory'
    );
  });

  // 7. Level Failure (True Deadlock vs Recoverable State)
  runTest('7. Level failure detection on genuine deadlock vs recoverable moves', () => {
    // Construct a level with 2 unlocked bays:
    // Front passenger is RED, followed by BLUE and GREEN.
    // Unblocked buses in lot: bus-blue, bus-green, bus-red.
    const vehicles: Vehicle[] = [
      {
        id: 'bus-blue',
        color: 'BLUE',
        capacity: 4,
        occupiedSeats: 0,
        boardedPassengerIds: [],
        gridX: 0,
        gridY: 0,
        length: 2,
        direction: 'UP',
        state: 'PARKED_IN_LOT',
        assignedBayId: null,
      },
      {
        id: 'bus-green',
        color: 'GREEN',
        capacity: 4,
        occupiedSeats: 0,
        boardedPassengerIds: [],
        gridX: 1,
        gridY: 0,
        length: 2,
        direction: 'UP',
        state: 'PARKED_IN_LOT',
        assignedBayId: null,
      },
      {
        id: 'bus-red',
        color: 'RED',
        capacity: 4,
        occupiedSeats: 0,
        boardedPassengerIds: [],
        gridX: 2,
        gridY: 0,
        length: 2,
        direction: 'UP',
        state: 'PARKED_IN_LOT',
        assignedBayId: null,
      },
    ];

    const passengers: Passenger[] = [
      { id: 'r1', color: 'RED', boarded: false },
      { id: 'r2', color: 'RED', boarded: false },
      { id: 'r3', color: 'RED', boarded: false },
      { id: 'r4', color: 'RED', boarded: false },
      { id: 'b1', color: 'BLUE', boarded: false },
      { id: 'b2', color: 'BLUE', boarded: false },
      { id: 'b3', color: 'BLUE', boarded: false },
      { id: 'b4', color: 'BLUE', boarded: false },
      { id: 'g1', color: 'GREEN', boarded: false },
      { id: 'g2', color: 'GREEN', boarded: false },
      { id: 'g3', color: 'GREEN', boarded: false },
      { id: 'g4', color: 'GREEN', boarded: false },
    ];

    const level: LevelData = {
      levelNumber: 99,
      tierName: 'Deadlock Test',
      gridWidth: 6,
      gridHeight: 6,
      vehicles,
      passengers,
      obstacles: [],
      unlockedStandardBays: 2,
    };

    let state = createGameStateFromLevel(level, 'PLAYING');

    // Suboptimal Move 1: Player taps bus-blue (doesn't match front passenger RED, but 1 bay is still free!)
    state = selectAndMoveVehicle(state, 'bus-blue', { instantArrival: true }).nextState;
    state = resolveAllImmediateBoarding(state).nextState;
    assert(
      state.status === 'PLAYING',
      'Must NOT trigger failure when 1 bay is still free (recoverable state)'
    );

    // Move 2 (In-Flight): Player taps bus-green with instantArrival: false (still driving to bay)
    const inFlight = selectAndMoveVehicle(state, 'bus-green', { instantArrival: false }).nextState;
    assert(
      inFlight.status === 'PLAYING',
      'Must NOT trigger failure while a vehicle is still MOVING_TO_BAY'
    );

    // Once bus-green arrives in the 2nd bay, both unlocked bays are full with BLUE and GREEN,
    // while front passenger is RED -> Genuine unrecoverable deadlock!
    const arrived = completeVehicleArrival(inFlight, 'bus-green');
    assert(
      arrived.status === 'LEVEL_FAILED',
      'Must transition to LEVEL_FAILED once all unlocked bays are occupied with non-matching buses'
    );

    // Recovery via VIP Booster: moving bus-green into the VIP bay frees a standard bay!
    const recovered = applyVipBoosterToVehicle(arrived, 'bus-green', { instantArrival: true }).nextState;
    assert(
      recovered.status === 'PLAYING',
      'Using VIP Booster to vacate a standard bay must recover the game back to PLAYING'
    );
  });

  // 8. Restart Behavior (Exact Initial Restoration)
  runTest('8. Restart behavior restores exact initial level state', () => {
    const level = generateLevel(5);
    const initialState = createGameStateFromLevel(level, 'PLAYING');

    // Perform several moves and boardings
    const firstBusId = level.solutionOrder![0];
    let mutatedState = selectAndMoveVehicle(initialState, firstBusId, {
      instantArrival: true,
    }).nextState;
    mutatedState = resolveAllImmediateBoarding(mutatedState).nextState;

    assert(mutatedState.moveCount > 0, 'Mutated state should have moveCount > 0');
    assert(
      mutatedState.boardedPassengersCount > 0,
      'Mutated state should have boarded passengers'
    );

    // Restart level
    const restarted = restartLevelState(mutatedState, 'PLAYING');
    assert(restarted.status === 'PLAYING', 'Restarted state must be PLAYING');
    assert(restarted.moveCount === 0, 'Restarted moveCount must be 0');
    assert(restarted.boardedPassengersCount === 0, 'Restarted boardedPassengersCount must be 0');
    assert(
      restarted.passengerQueue.length === initialState.passengerQueue.length,
      'Restarted passenger queue length must match initial state'
    );
    assert(
      restarted.vehicles.length === initialState.vehicles.length,
      'Restarted vehicle count must match initial state without duplicates'
    );
    assert(
      restarted.vehicles.every((v) => v.state === 'PARKED_IN_LOT' && v.occupiedSeats === 0),
      'All vehicles must be reset to PARKED_IN_LOT with 0 occupied seats'
    );
    assert(
      restarted.bays.every((b) => b.vehicleId === null && b.reservedByVehicleId === null),
      'All parking bays must be empty after restart'
    );
  });

  // 9. Boosters (VIP, Pick, Shuffle) Parity Preservation
  runTest('9. Boosters (VIP, Pick, Shuffle) preserve passenger-to-seat parity', () => {
    const level = generateLevel(15);
    let state = createGameStateFromLevel(level, 'PLAYING');

    // Test Shuffle Booster preserves total seat counts per color
    const shuffled = applyShuffleBooster(state);
    assert(shuffled.applied === true, 'Shuffle booster should apply on Level 15');
    state = shuffled.nextState;

    // Move first unblocked vehicle into bay and use Pick Booster
    const firstId = level.solutionOrder![0];
    state = selectAndMoveVehicle(state, firstId, { instantArrival: true }).nextState;
    const picked = applyPickBooster(state, firstId);
    assert(picked.applied === true, 'Pick booster should board matching passengers onto bay bus');
    const targetAfterPick = picked.nextState.vehicles.find((v) => v.id === firstId)!;
    assert(
      targetAfterPick.state === 'CLEARED' && targetAfterPick.occupiedSeats === targetAfterPick.capacity,
      'Pick booster should fill and clear the target bay vehicle'
    );
  });

  // 10. All 100 Levels Solvability & Structural Validation
  runTest('10. All 100 playable levels pass structural, parity, and solvability validation', () => {
    const summary = validateAll100Levels();
    assert(
      summary.allValid,
      `Expected all 100 levels to be valid and solvable, but ${summary.failedLevels.length} failed: ${JSON.stringify(
        summary.failedLevels.slice(0, 3)
      )}`
    );
    assert(summary.totalValidated === 100, 'Must validate all 100 levels');
  });

  // 11. Vehicle Smooth Acceleration/Deceleration & Exact Destination Stop
  runTest('11. Vehicle movement uses smooth acceleration/deceleration and stops at exact destination', () => {
    const startProfile = evaluateSmoothMotionProfile(0);
    const midProfile = evaluateSmoothMotionProfile(0.5);
    const endProfile = evaluateSmoothMotionProfile(1);

    assert(startProfile.distanceFraction === 0 && startProfile.normalizedSpeed === 0, 'Speed at t=0 must be 0');
    assert(midProfile.distanceFraction === 0.5 && midProfile.normalizedSpeed > 1.4, 'Speed must peak at mid-path');
    assert(endProfile.distanceFraction === 1 && endProfile.normalizedSpeed === 0, 'Speed at t=1 must decelerate to 0');

    const level = createSyntheticTestLevel();
    const bus = level.vehicles[0];
    let anim = createAnimationController(level.vehicles);
    const dest = { x: 1.5, y: -1.0 };
    const path = buildVehicleBayPath(bus, level.gridWidth, level.gridHeight, dest);

    anim = startVehicleMotionAnimation(anim, bus, path, 'TO_BAY', 200);

    // Step halfway (100ms)
    const midStep = stepAnimationSystem(anim, 100);
    anim = midStep.nextController;
    const midKin = anim.kinematicsByVehicleId[bus.id];
    assert(midKin.speed > 0, 'Moving vehicle must have positive speed at midpoint');
    assert(midStep.events.arrivedVehicleIds.length === 0, 'Vehicle must not arrive before duration completes');

    // Step to completion (+120ms)
    const finalStep = stepAnimationSystem(anim, 120);
    anim = finalStep.nextController;
    const endKin = anim.kinematicsByVehicleId[bus.id];
    assert(
      Math.abs(endKin.x - dest.x) < 1e-5 && Math.abs(endKin.y - dest.y) < 1e-5,
      'Vehicle must stop at exact destination coordinates'
    );
    assert(endKin.speed === 0, 'Vehicle speed must be 0 upon arrival');
    assert(
      finalStep.events.arrivedVehicleIds.length === 1 &&
        finalStep.events.arrivedVehicleIds[0] === bus.id,
      'Arrival event must fire exactly once on completion'
    );
  });

  // 12. Wheel Rotation Strictly Synchronized with Speed (Frozen When Stationary)
  runTest('12. Wheel rotation advances with speed and remains strictly frozen when stationary', () => {
    const level = createSyntheticTestLevel();
    const movingBus = level.vehicles[0];
    const parkedBus = level.vehicles[1];
    let anim = createAnimationController(level.vehicles);

    // Step while all vehicles are stationary
    anim = stepAnimationSystem(anim, 100).nextController;
    assert(
      anim.kinematicsByVehicleId[movingBus.id].wheelRotationDeg === 0 &&
        anim.kinematicsByVehicleId[parkedBus.id].wheelRotationDeg === 0,
      'Stationary vehicles must never rotate wheels'
    );

    // Start moving only movingBus
    const path = buildVehicleBayPath(movingBus, 6, 6, { x: 2, y: -1 });
    anim = startVehicleMotionAnimation(anim, movingBus, path, 'TO_BAY', 200);

    anim = stepAnimationSystem(anim, 80).nextController;
    const movingWheelMid = anim.kinematicsByVehicleId[movingBus.id].wheelRotationDeg;
    const parkedWheelMid = anim.kinematicsByVehicleId[parkedBus.id].wheelRotationDeg;

    assert(movingWheelMid > 0, 'Moving vehicle wheels must rotate proportionally to distance');
    assert(parkedWheelMid === 0, 'Stationary vehicle wheels must remain at 0 deg');

    // Finish movement and step another 200ms at rest
    anim = stepAnimationSystem(anim, 150).nextController;
    const wheelAtStop = anim.kinematicsByVehicleId[movingBus.id].wheelRotationDeg;
    anim = stepAnimationSystem(anim, 200).nextController;
    const wheelAfterRest = anim.kinematicsByVehicleId[movingBus.id].wheelRotationDeg;
    assert(
      wheelAtStop === wheelAfterRest,
      'Wheels must stop rotating immediately once vehicle stops at bay'
    );
  });

  // 13. Smooth Vehicle Turning & Shortest-Arc Heading Alignment
  runTest('13. Vehicle turning aligns smoothly with path without unnatural 270-degree spins', () => {
    // Turning from LEFT (270 deg) to UP (0 deg) at t=0.5 must pass through 315 deg, not 135 deg
    const midAngle = lerpShortestAngleDeg(270, 0, 0.5);
    assert(
      Math.abs(midAngle - 315) < 1e-4,
      `Expected shortest arc between 270 and 0 to be 315 deg, got ${midAngle}`
    );

    // Multi-waypoint turn test for a RIGHT-facing vehicle exiting right, turning up, then parking
    const level = createSyntheticTestLevel();
    const rightBus = level.vehicles[2]; // direction: RIGHT
    const waypoints = buildVehicleBayPath(rightBus, 6, 6, { x: 1, y: -1 });
    assert(waypoints.length >= 3, 'Perimeter path for RIGHT-facing vehicle must have corner waypoints');

    let anim = createAnimationController(level.vehicles);
    anim = startVehicleMotionAnimation(anim, rightBus, waypoints, 'TO_BAY', 240);

    for (let step = 0; step < 6; step++) {
      anim = stepAnimationSystem(anim, 40).nextController;
      const heading = anim.kinematicsByVehicleId[rightBus.id].headingDeg;
      assert(heading >= 0 && heading < 360, 'Vehicle heading must remain normalized in [0, 360)');
    }
  });

  // 14. Vehicle Suspension & Synchronized Door Animation
  runTest('14. Vehicle suspension clamping/damping and door open/close synchronization', () => {
    const level = createSyntheticTestLevel();
    const bus = level.vehicles[0];
    let anim = createAnimationController(level.vehicles);

    // Apply excessive suspension impulse and verify clamping within [-2.5, +2.5]px
    anim = triggerVehicleSuspensionImpulse(anim, bus.id, 10);
    assert(
      anim.kinematicsByVehicleId[bus.id].suspensionOffsetPx <= 2.5,
      'Suspension offset must be clamped to avoid excessive bouncing'
    );

    // Open doors and verify smooth transition OPENING -> OPEN
    anim = setVehicleDoorTargetState(anim, bus.id, 'OPENING');
    anim = stepAnimationSystem(anim, 80).nextController;
    assert(
      anim.kinematicsByVehicleId[bus.id].doorOpenProgress > 0 &&
        anim.kinematicsByVehicleId[bus.id].doorOpenProgress < 1,
      'Door should be partially open during OPENING transition'
    );

    anim = stepAnimationSystem(anim, 200).nextController;
    assert(
      anim.kinematicsByVehicleId[bus.id].doorState === 'OPEN' &&
        anim.kinematicsByVehicleId[bus.id].doorOpenProgress === 1,
      'Door must reach OPEN state (progress = 1)'
    );

    // Close doors and verify transition CLOSING -> CLOSED
    anim = setVehicleDoorTargetState(anim, bus.id, 'CLOSING');
    anim = stepAnimationSystem(anim, 250).nextController;
    assert(
      anim.kinematicsByVehicleId[bus.id].doorState === 'CLOSED' &&
        anim.kinematicsByVehicleId[bus.id].doorOpenProgress === 0,
      'Door must reach CLOSED state (progress = 0) and suspension must decay to rest'
    );
  });

  // 15. Passenger Boarding Sequence & Departure Synchronization
  runTest('15. Passenger boarding sequence animates door approach, seating, and single completion', () => {
    const level = createSyntheticTestLevel();
    const bus = level.vehicles[0];
    let anim = createAnimationController(level.vehicles);

    anim = startPassengerBoardingAnimation(anim, {
      passengerId: 'p-r1',
      passengerColor: 'RED',
      targetVehicleId: bus.id,
      targetBayIndex: 0,
      seatIndex: 0,
      durationMs: 160,
    });

    // Duplicate call for same passengerId while active must be ignored
    const dup = startPassengerBoardingAnimation(anim, {
      passengerId: 'p-r1',
      passengerColor: 'RED',
      targetVehicleId: bus.id,
      targetBayIndex: 0,
      seatIndex: 0,
      durationMs: 160,
    });
    assert(dup.activePassengerAnims.length === 1, 'Duplicate passenger boarding animation must be prevented');

    // Step 50ms -> APPROACHING_DOOR, target bus door is OPENING/OPEN
    const step1 = stepAnimationSystem(anim, 50);
    anim = step1.nextController;
    assert(
      anim.activePassengerAnims[0].stage === 'APPROACHING_DOOR',
      'Passenger should be APPROACHING_DOOR early in boarding'
    );
    assert(
      anim.kinematicsByVehicleId[bus.id].doorState === 'OPENING' ||
        anim.kinematicsByVehicleId[bus.id].doorState === 'OPEN',
      'Target vehicle door must open in sync with passenger boarding'
    );

    // Step to 110ms -> STEPPING_IN
    const step2 = stepAnimationSystem(anim, 60);
    anim = step2.nextController;
    assert(
      anim.activePassengerAnims[0].stage === 'STEPPING_IN',
      'Passenger should transition to STEPPING_IN at door threshold'
    );

    // Step to completion (170ms total) -> SEATED event fires once
    const step3 = stepAnimationSystem(anim, 60);
    anim = step3.nextController;
    assert(step3.events.seatedPassengers.length === 1, 'Seated passenger event must fire on completion');
    assert(anim.activePassengerAnims.length === 0, 'Completed passenger animation must be cleaned up');

    // Subsequent step must not re-fire seated event
    const step4 = stepAnimationSystem(anim, 50);
    assert(step4.events.seatedPassengers.length === 0, 'Seated event must never fire twice');
  });

  // 16. Animation Cancellation & Restart During Active Animation
  runTest('16. Safe animation cancellation and level restart during active vehicle & passenger animations', () => {
    const level = generateLevel(2);
    let state = createGameStateFromLevel(level, 'PLAYING');
    let anim = createAnimationController(state.vehicles);

    const firstBusId = level.solutionOrder![0];
    const firstBus = state.vehicles.find((v) => v.id === firstBusId)!;
    state = selectAndMoveVehicle(state, firstBusId, { instantArrival: false }).nextState;

    const path = buildVehicleBayPath(firstBus, state.gridWidth, state.gridHeight, { x: 1, y: -1 });
    anim = startVehicleMotionAnimation(anim, firstBus, path, 'TO_BAY', 300);
    anim = startPassengerBoardingAnimation(anim, {
      passengerId: state.passengerQueue[0].id,
      passengerColor: state.passengerQueue[0].color,
      targetVehicleId: firstBusId,
      targetBayIndex: 0,
      seatIndex: 0,
      durationMs: 200,
    });

    // Advance 60ms so both vehicle and passenger are mid-animation
    anim = stepAnimationSystem(anim, 60).nextController;
    assert(
      Object.keys(anim.activeVehicleMotions).length === 1 &&
        anim.activePassengerAnims.length === 1,
      'Animations should be active before restart'
    );

    // Trigger Restart mid-animation!
    const prevGen = anim.generationId;
    state = restartLevelState(state, 'PLAYING');
    anim = cancelAndResetAnimations(anim, state.vehicles);

    assert(anim.generationId === prevGen + 1, 'Generation ID must increment on cancellation');
    assert(
      Object.keys(anim.activeVehicleMotions).length === 0 &&
        anim.activePassengerAnims.length === 0,
      'All active animations must be cleared on restart'
    );

    // Stepping animation system after restart must emit zero stale events
    const postRestartStep = stepAnimationSystem(anim, 500);
    assert(
      postRestartStep.events.arrivedVehicleIds.length === 0 &&
        postRestartStep.events.seatedPassengers.length === 0,
      'Cancelled animations must never fire completion events after restart'
    );
  });

  // 17. Level Completion During Final Boarding Sequence & Environment Themes Verification
  runTest('17. Level completion during final boarding sequence & 6 environment themes verified', () => {
    // Verify all 6 environment themes exist and cycle across the 100 levels
    assert(ENVIRONMENT_THEME_IDS.length === 6, 'Must define 6 distinct environment themes');
    const seenThemes = new Set<string>();
    for (let lvl = 1; lvl <= 100; lvl++) {
      const theme = getEnvironmentThemeForLevel(lvl, 'AUTO');
      assert(Boolean(theme && theme.name), `Level ${lvl} must resolve a valid environment theme`);
      seenThemes.add(theme.id);
    }
    assert(seenThemes.size === 6, 'All 6 environment themes must be used across the 100-level campaign');

    for (const id of ENVIRONMENT_THEME_IDS) {
      const forced = getEnvironmentThemeForLevel(1, id);
      assert(forced.id === id && forced === ENVIRONMENT_THEMES[id], `Theme override ${id} must work`);
    }
  });

  // 18. Booster Edge Cases: Normal, During Movement, Empty Inventory, Pause, Cancel, Restart & Near Completion
  runTest('18. Boosters (VIP, Pick, Shuffle) tested during movement, pause, cancel, restart, and near completion', () => {
    const level = generateLevel(25);
    let state = createGameStateFromLevel(level, 'PLAYING');

    // A. VIP Mode activation & cancellation without deducting inventory
    state = toggleVipBoosterMode(state);
    assert(state.activeBoosterMode === 'VIP_SELECT', 'VIP mode should activate');
    state = cancelVipBoosterMode(state);
    assert(state.activeBoosterMode === 'NONE', 'VIP mode should cancel cleanly');
    assert(state.boostersUsedCount === 0, 'Canceling VIP mode must not count as a used booster');

    // B. Boosters rejected during PAUSED state
    const paused = setGameStatus(state, 'PAUSED');
    assert(
      toggleVipBoosterMode(paused).activeBoosterMode === 'NONE',
      'VIP toggle must be rejected while PAUSED'
    );
    assert(
      applyVipBoosterToVehicle(paused, level.vehicles[0].id).outcome === 'INVALID_STATE',
      'VIP apply must be rejected while PAUSED'
    );
    assert(
      applyPickBooster(paused).applied === false &&
        applyPickBooster(paused).reason === 'INVALID_STATE',
      'Pick booster must be rejected while PAUSED'
    );
    assert(
      applyShuffleBooster(paused).applied === false &&
        applyShuffleBooster(paused).reason === 'INVALID_STATE',
      'Shuffle booster must be rejected while PAUSED'
    );

    // C. Boosters during active vehicle movement (MOVING_TO_BAY)
    const firstId = level.solutionOrder![0];
    const movingState = selectAndMoveVehicle(state, firstId, { instantArrival: false }).nextState;
    // Moving vehicle itself cannot be selected again for VIP while in transit
    const vipOnMoving = applyVipBoosterToVehicle(movingState, firstId);
    assert(
      vipOnMoving.outcome === 'INVALID_VEHICLE',
      'VIP booster must reject a vehicle that is already MOVING_TO_BAY'
    );
    // Another blocked vehicle in the lot CAN be airlifted to VIP bay while firstId is moving
    const blockedLotBus = movingState.vehicles.find(
      (v) => v.state === 'PARKED_IN_LOT' && v.id !== firstId
    )!;
    const vipDuringMove = applyVipBoosterToVehicle(movingState, blockedLotBus.id, {
      instantArrival: true,
    });
    assert(
      vipDuringMove.outcome === 'MOVED_TO_VIP_BAY',
      'VIP booster can airlift a parked vehicle while another bus is moving'
    );
    // Attempting a second VIP airlift while VIP bay is occupied must return NO_FREE_BAY
    const anotherLotBus = vipDuringMove.nextState.vehicles.find(
      (v) => v.state === 'PARKED_IN_LOT'
    )!;
    const duplicateVip = applyVipBoosterToVehicle(vipDuringMove.nextState, anotherLotBus.id);
    assert(
      duplicateVip.outcome === 'NO_FREE_BAY',
      'VIP booster must reject activation when VIP bay is already occupied'
    );

    // D. Shuffle during vehicle movement preserves level validity & zero overlaps
    const shuffleDuringMove = applyShuffleBooster(movingState);
    assert(shuffleDuringMove.applied === true, 'Shuffle should succeed on remaining parked vehicles');
    // Complete arrival of firstId and verify level state remains 100% valid
    const afterArrival = completeVehicleArrival(shuffleDuringMove.nextState, firstId);
    assert(
      afterArrival.vehicles.find((v) => v.id === firstId)?.state === 'IN_BAY',
      'Moving vehicle arrives cleanly in bay after Shuffle'
    );

    // E. Pick booster rejects invalid target IDs and succeeds on valid IN_BAY vehicle
    const invalidPick = applyPickBooster(afterArrival, 'non-existent-bus');
    assert(
      !invalidPick.applied && invalidPick.reason === 'INVALID_TARGET',
      'Pick booster must reject invalid vehicle IDs'
    );
    const validPick = applyPickBooster(afterArrival, firstId);
    assert(
      validPick.applied &&
        validPick.targetVehicleId === firstId &&
        validPick.pickedPassengerIds.length > 0,
      'Pick booster must pull matching passengers onto the target bay vehicle'
    );

    // F. Near Level Completion: Solve up to the last vehicle, then test Shuffle rejection & Pick completion
    const lvl1 = generateLevel(1);
    let nearEnd = createGameStateFromLevel(lvl1, 'PLAYING');
    const order = lvl1.solutionOrder!;
    for (let i = 0; i < order.length - 1; i++) {
      nearEnd = selectAndMoveVehicle(nearEnd, order[i], { instantArrival: true }).nextState;
      nearEnd = resolveAllImmediateBoarding(nearEnd).nextState;
    }
    // Only 1 vehicle remains in the lot -> Shuffle must reject with NOT_ENOUGH_VEHICLES
    const shuffleNearEnd = applyShuffleBooster(nearEnd);
    assert(
      !shuffleNearEnd.applied && shuffleNearEnd.reason === 'NOT_ENOUGH_VEHICLES',
      'Shuffle must not consume inventory when only 1 vehicle remains in lot'
    );
    // Move final vehicle to bay and use Pick booster to complete the level
    const finalBusId = order[order.length - 1];
    nearEnd = selectAndMoveVehicle(nearEnd, finalBusId, { instantArrival: true }).nextState;
    const finalPick = applyPickBooster(nearEnd, finalBusId);
    assert(
      finalPick.applied && finalPick.nextState.status === 'LEVEL_COMPLETED',
      'Using Pick on the final bay vehicle must cleanly complete the level'
    );
  });

  // 19. 100-Level Campaign Uniqueness, Progression Unlock Rules & Independent Solver Verification
  runTest('19. 100-level campaign geometric uniqueness, progression rules, and independent solver', () => {
    const campaignSummary = validateAll100Levels();
    assert(campaignSummary.allValid, 'All 100 campaign levels must be valid');
    assert(
      campaignSummary.uniqueGeometryCount === 100,
      `Expected 100 unique geometric level layouts (no color-swap duplicates), got ${campaignSummary.uniqueGeometryCount}`
    );

    // Verify independent solver solves sample levels across early, mid, and late tiers without solutionOrder
    for (const sampleLvl of [1, 10, 25, 50, 75, 100]) {
      const data = generateLevel(sampleLvl);
      const report = validateLevelData(data);
      assert(
        report.isValid && report.isSolvableWithoutBoosters && report.independentSolverVerified,
        `Level ${sampleLvl} must pass full validation and solver verification`
      );
      const directSolve = solveLevelIndependently(data, 400);
      assert(directSolve.solved || report.isSolvableWithoutBoosters, `Level ${sampleLvl} must be solvable`);
    }

    // Verify Level Progression Unlock Rules
    let save = createDefaultSaveData();
    assert(save.unlockedLevel === 1, 'Only Level 1 should be unlocked initially');
    assert(canLaunchLevel(save, 1) === true, 'Level 1 must be launchable at start');
    assert(canLaunchLevel(save, 2) === false, 'Level 2 must be locked before Level 1 is completed');
    assert(canLaunchLevel(save, 50) === false, 'Level 50 must be locked');

    // Complete Level 1 -> Level 2 unlocks
    save = recordLevelCompletionInSave(save, 1, 0).updatedSave;
    assert(save.unlockedLevel === 2, 'Completing Level 1 must unlock Level 2');
    assert(canLaunchLevel(save, 2) === true, 'Level 2 must now be launchable');
    assert(canLaunchLevel(save, 3) === false, 'Level 3 must still be locked');
  });

  // 20. Coin & Reward Economy: First Completion, No Duplicate Rewards, Persistence, Insufficient Funds & Save Failure Safety
  runTest('20. Coin & reward economy: rewards, duplicate prevention, persistence, insufficient funds, and storage failure safety', () => {
    let save = createDefaultSaveData();
    const initialCoins = save.coins; // 300

    // 1. Complete Level 1 for the first time with 0 boosters (3 stars -> 50 + 5 + 25 = 80 coins)
    const firstWin = recordLevelCompletionInSave(save, 1, 0);
    assert(firstWin.coinsEarned === 80, `Expected 80 coins for Level 1 3-star win, got ${firstWin.coinsEarned}`);
    assert(firstWin.starsEarned === 3, 'Expected 3 stars with 0 boosters');
    assert(firstWin.isDuplicateCompletion === false, 'First completion should not be marked duplicate');
    save = firstWin.updatedSave;
    assert(save.coins === initialCoins + 80, 'Coin balance must increase by 80');

    // 2. Replay/restart and complete Level 1 again -> Must award 0 duplicate coins!
    const repeatWin = recordLevelCompletionInSave(save, 1, 0);
    assert(
      repeatWin.coinsEarned === 0 && repeatWin.isDuplicateCompletion === true,
      'Repeating an already-completed level must award 0 duplicate coins'
    );
    assert(
      repeatWin.updatedSave.coins === save.coins,
      'Coin balance must remain unchanged after duplicate level completion'
    );

    // 3. Test booster consumption from inventory first, then from coins, then insufficient funds
    save = {
      ...save,
      coins: 150,
      boosters: { VIP: 1, PICK: 0, SHUFFLE: 0 },
    };

    // Consume VIP from inventory (1 -> 0, 0 coins spent)
    const useFreeVip = consumeBoosterFromSave(save, 'VIP');
    assert(
      useFreeVip.success && useFreeVip.source === 'INVENTORY' && useFreeVip.coinsSpent === 0,
      'Should use free VIP inventory first'
    );
    save = useFreeVip.updatedSave;
    assert(save.boosters.VIP === 0 && save.coins === 150, 'VIP inventory should be 0 and coins still 150');

    // Consume VIP using coins (150 - 100 = 50 coins remaining)
    const usePaidVip = consumeBoosterFromSave(save, 'VIP');
    assert(
      usePaidVip.success &&
        usePaidVip.source === 'COINS' &&
        usePaidVip.coinsSpent === BOOSTER_COIN_COSTS.VIP,
      'Should deduct 100 coins when VIP inventory is 0'
    );
    save = usePaidVip.updatedSave;
    assert(save.coins === 50, 'Coins should be 50 after spending 100');

    // Attempt to consume PICK (cost 120) with 0 inventory and only 50 coins -> Must fail safely!
    const availPick = checkBoosterAvailability(save, 'PICK');
    assert(!availPick.canActivate && availPick.source === 'NONE', 'Pick must be unavailable with 50 coins');
    const failedPick = consumeBoosterFromSave(save, 'PICK');
    assert(
      !failedPick.success && failedPick.updatedSave.coins === 50,
      'Failed booster purchase must not deduct coins or create negative balance'
    );

    // Attempt to spend 200 coins directly -> Must fail safely without negative balance
    const failedSpend = spendCoinsFromSave(save, 200);
    assert(
      !failedSpend.success && failedSpend.updatedSave.coins === 50,
      'spendCoinsFromSave must reject insufficient funds and never go negative'
    );

    // 4. Test save & reload persistence and simulated storage failure resilience
    setSimulateStorageFailure(true);
    const savedDuringFailure = savePlayerData(save);
    assert(savedDuringFailure === false, 'savePlayerData should report false when localStorage fails');
    const reloadedFallback = loadSaveData();
    assert(
      reloadedFallback.coins === 50 && reloadedFallback.unlockedLevel === 2,
      'In-memory fallback must preserve exact coins and progression even when storage fails'
    );
    setSimulateStorageFailure(false);
  });

  // 21. Local Save System: Versioning, Migration, Corruption Recovery, Duplicate Write Prevention & Settings Persistence
  runTest('21. Local save system: v1->v2 migration, corrupted JSON recovery, duplicate write deduplication, and settings persistence', () => {
    // Provide a lightweight mock localStorage if running in Node CLI environment
    const mockStore: Record<string, string> = {};
    const hadWindow = typeof (globalThis as { window?: unknown }).window !== 'undefined';
    if (!hadWindow) {
      (globalThis as Record<string, unknown>).window = {
        localStorage: {
          getItem: (k: string) => (k in mockStore ? mockStore[k] : null),
          setItem: (k: string, v: string) => {
            mockStore[k] = String(v);
          },
          removeItem: (k: string) => {
            delete mockStore[k];
          },
        },
      };
    }

    try {
      resetStorageDiagnostics();

      // A. Missing save data -> returns clean v2 default values
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(BACKUP_STORAGE_KEY);
      const fresh = loadSaveData();
      assert(
        fresh.schemaVersion === CURRENT_SAVE_VERSION &&
          fresh.unlockedLevel === 1 &&
          fresh.coins === 300,
        'Missing save data must initialize reasonable v2 defaults for new players'
      );

      // B. Upgrade / migrate from legacy v1 save format (with legacy aliases `level`, `gold`, and starsByLevel)
      const legacyV1Save = {
        schemaVersion: 1,
        level: 8,
        gold: 940,
        starsByLevel: { 1: 3, 2: 2, 3: 3, 4: 1, 5: 3, 6: 2, 7: 3 },
        boosters: { VIP: 4, PICK: 2, SHUFFLE: 5 },
        soundEnabled: false,
        colorblindMode: false,
      };
      const migrationResult = migrateAndSanitizeSaveData(legacyV1Save);
      assert(migrationResult.migrated === true, 'v1 save payload must be flagged as migrated');
      assert(
        migrationResult.data.schemaVersion === CURRENT_SAVE_VERSION &&
          migrationResult.data.unlockedLevel === 8 &&
          migrationResult.data.coins === 940 &&
          migrationResult.data.completedLevels?.[7] === true &&
          migrationResult.data.sfxVolume === 0.85 &&
          migrationResult.data.musicVolume === 0.45,
        'Migrated v2 save must preserve unlockedLevel, coins, completedLevels, and populate new audio settings'
      );

      // C. Save and reload progression, coins, boosters, and audio settings across restart
      const customSave = {
        ...migrationResult.data,
        currentLevel: 6,
        sfxVolume: 0.65,
        musicVolume: 0.3,
        musicEnabled: false,
        preferredTheme: 'NIGHTTIME_CITY' as const,
      };
      const writeOk = savePlayerData(customSave);
      assert(writeOk === true, 'Valid save payload should persist to storage');

      // Duplicate save prevention: saving identical state again must skip redundant localStorage write
      const diagBeforeDup = getStorageDiagnostics();
      savePlayerData(customSave);
      const diagAfterDup = getStorageDiagnostics();
      assert(
        diagAfterDup.duplicateWritesSkipped === diagBeforeDup.duplicateWritesSkipped + 1 &&
          diagAfterDup.totalWrites === diagBeforeDup.totalWrites,
        'Identical consecutive savePlayerData calls must skip redundant storage writes'
      );

      // Reload and verify all fields
      const reloaded = loadSaveData();
      assert(
        reloaded.unlockedLevel === 8 &&
          reloaded.currentLevel === 6 &&
          reloaded.coins === 940 &&
          reloaded.boosters.VIP === 4 &&
          reloaded.soundEnabled === false &&
          reloaded.musicEnabled === false &&
          reloaded.sfxVolume === 0.65 &&
          reloaded.musicVolume === 0.3 &&
          reloaded.preferredTheme === 'NIGHTTIME_CITY',
        'Reloaded save must match saved progression, coins, boosters, audio mixer, and theme settings'
      );

      // D. Incomplete / invalid save rejection: must NOT overwrite valid data
      const rejectedNull = savePlayerData(null as unknown as typeof customSave);
      const rejectedIncomplete = savePlayerData({ unlockedLevel: NaN } as unknown as typeof customSave);
      assert(
        rejectedNull === false && rejectedIncomplete === false,
        'Incomplete or malformed save payloads must be rejected'
      );
      const afterRejected = loadSaveData();
      assert(
        afterRejected.coins === 940 && afterRejected.unlockedLevel === 8,
        'Rejected incomplete write must never overwrite existing valid save data'
      );

      // E. Corrupted primary storage recovery from rolling backup
      window.localStorage.setItem(STORAGE_KEY, '{corrupted_json:::');
      const recoveredFromBackup = loadSaveData();
      assert(
        recoveredFromBackup.coins === 940 && recoveredFromBackup.unlockedLevel === 8,
        'Corrupted primary storage must automatically recover player progress from backup storage'
      );

      // F. Both primary and backup corrupted -> falls back safely to defaults without throwing
      window.localStorage.setItem(STORAGE_KEY, '<<<bad>>>');
      window.localStorage.setItem(BACKUP_STORAGE_KEY, '<<<bad>>>');
      const safeFallback = loadSaveData();
      assert(
        safeFallback.unlockedLevel === 1 && safeFallback.coins === 300,
        'Total storage corruption must fall back safely to default new-player state without crashing'
      );

      // G. Application interruption flush
      savePlayerData(customSave);
      assert(
        flushSaveOnAppInterruption() === true,
        'flushSaveOnAppInterruption must safely flush in-memory state'
      );
    } finally {
      if (!hadWindow) {
        delete (globalThis as Record<string, unknown>).window;
      }
    }
  });

  // 22. Audio & Visual Feedback: 9 Sound Cues, Separate Volume Controls, Cooldown Deduplication, Mute & Pause States
  runTest('22. Audio system: all 9 sound cues, separate SFX/music volume, rapid-input cooldown throttling, mute, and pause', () => {
    audioManager.resetDiagnostics();
    audioManager.setEnabled(true);
    audioManager.setMusicEnabled(true);
    audioManager.setSfxVolume(0.8);
    audioManager.setMusicVolume(0.5);
    audioManager.setPaused(false);

    assert(
      audioManager.getSfxVolume() === 0.8 && audioManager.getMusicVolume() === 0.5,
      'Audio manager must store independent SFX and Music volume levels'
    );

    // Trigger all 9 required audio cues + blocked horn
    audioManager.playButtonTap();
    audioManager.playVehicleMove();
    audioManager.playVehicleStop();
    audioManager.playPassengerBoard(0);
    audioManager.playSuccessfulMatch();
    audioManager.playBoosterActivate('VIP');
    audioManager.playCoinCollect();
    audioManager.playVictory();
    audioManager.playFailure();
    audioManager.playBlockedHorn();

    const diag1 = audioManager.getDiagnostics();
    assert(
      diag1.triggeredCounts.BUTTON_TAP === 1 &&
        diag1.triggeredCounts.VEHICLE_MOVE === 1 &&
        diag1.triggeredCounts.VEHICLE_STOP === 1 &&
        diag1.triggeredCounts.PASSENGER_BOARD === 1 &&
        diag1.triggeredCounts.SUCCESSFUL_MATCH === 1 &&
        diag1.triggeredCounts.BOOSTER_ACTIVATE === 1 &&
        diag1.triggeredCounts.COIN_COLLECT === 1 &&
        diag1.triggeredCounts.LEVEL_COMPLETE === 1 &&
        diag1.triggeredCounts.LEVEL_FAILURE === 1 &&
        diag1.triggeredCounts.BLOCKED_HORN === 1,
      'All 9 required sound cues and blocked horn must register accurately'
    );

    // Rapid repeated input within cooldown window must be throttled (no excessive overlapping)
    audioManager.playVehicleMove();
    audioManager.playVehicleMove();
    audioManager.playButtonTap();
    const diag2 = audioManager.getDiagnostics();
    assert(
      diag2.triggeredCounts.VEHICLE_MOVE === 1 && diag2.throttledDuplicatesSkipped >= 3,
      'Rapid duplicate sound triggers within cooldown window must be throttled'
    );

    // Pause state: gameplay sounds must be suppressed while paused
    audioManager.setPaused(true);
    audioManager.playPassengerBoard(1);
    audioManager.playVictory();
    const diagPaused = audioManager.getDiagnostics();
    assert(
      diagPaused.triggeredCounts.PASSENGER_BOARD === 1 &&
        diagPaused.triggeredCounts.LEVEL_COMPLETE === 1 &&
        diagPaused.mutedSkips >= 2,
      'Gameplay audio cues must not fire while the game is paused'
    );

    // Mute state: all sounds suppressed when soundEnabled is false
    audioManager.setPaused(false);
    audioManager.setEnabled(false);
    audioManager.playCoinCollect();
    const diagMuted = audioManager.getDiagnostics();
    assert(
      diagMuted.triggeredCounts.COIN_COLLECT === 1 &&
        diagMuted.mutedSkips > diagPaused.mutedSkips,
      'Muted audio manager must skip sound playback cleanly'
    );

    // Restore default enabled state
    audioManager.setEnabled(true);
  });

  // 23. Mobile Performance Benchmarks: 100-Level Generation, 1,000-Frame Animation Loop & Consecutive Transitions
  runTest('23. Mobile performance benchmarks: 100-level load speed, 1,000 animation frames, and rapid level transitions', () => {
    const nowFn = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Benchmark 1: Generate all 100 campaign levels sequentially
    const t0 = nowFn();
    for (let lvl = 1; lvl <= 100; lvl++) {
      const ld = generateLevel(lvl);
      assert(ld.vehicles.length > 0 && ld.passengers.length > 0, `Level ${lvl} must load`);
    }
    const gen100Ms = nowFn() - t0;
    assert(
      gen100Ms < 1500,
      `Generating all 100 levels must complete in < 1500ms (actual: ${gen100Ms.toFixed(2)}ms)`
    );

    // Benchmark 2: Step 1,000 frames (16.67s of 60fps gameplay) on a busy late-game level (Level 95)
    const busyLevel = generateLevel(95);
    let state = createGameStateFromLevel(busyLevel, 'PLAYING');
    let anim = createAnimationController(state.vehicles);
    const firstBus = state.vehicles.find((v) => v.id === busyLevel.solutionOrder![0])!;
    const waypoints = buildVehicleBayPath(firstBus, state.gridWidth, state.gridHeight, {
      x: 2,
      y: -1,
    });
    anim = startVehicleMotionAnimation(anim, firstBus, waypoints, 'TO_BAY', 240);

    const tAnim0 = nowFn();
    for (let frame = 0; frame < 1000; frame++) {
      anim = stepAnimationSystem(anim, 16.67).nextController;
    }
    const anim1000Ms = nowFn() - tAnim0;
    assert(
      anim1000Ms < 250,
      `1,000 animation frames must execute in < 250ms (<0.25ms/frame, actual: ${anim1000Ms.toFixed(2)}ms)`
    );

    // Benchmark 3: Consecutive level transitions & rapid touch input stress test
    const tTrans0 = nowFn();
    for (let lvl = 1; lvl <= 30; lvl++) {
      const ld = generateLevel(lvl);
      state = createGameStateFromLevel(ld, 'PLAYING');
      anim = cancelAndResetAnimations(anim, state.vehicles);
      // Simulate 5 rapid taps on the first vehicle
      const targetId = state.vehicles[0].id;
      for (let tap = 0; tap < 5; tap++) {
        state = selectAndMoveVehicle(state, targetId, { instantArrival: false }).nextState;
      }
      state = restartLevelState(state, 'PLAYING');
    }
    const trans30Ms = nowFn() - tTrans0;
    assert(
      trans30Ms < 500,
      `30 consecutive level transitions & rapid touch bursts must complete in < 500ms (actual: ${trans30Ms.toFixed(2)}ms)`
    );
  });

  // 24. QA Regression Suite: VIP Recovery From LEVEL_FAILED, Pause/Resume Round-Trip & Single-Trigger Failure Guard
  runTest('24. QA regression: VIP recovery from LEVEL_FAILED deadlock and pause/resume state preservation', () => {
    const level = generateLevel(12);
    let state = createGameStateFromLevel(level, 'PLAYING');

    // A. Pause and Resume round-trip preserves exact board, queue, and bay state
    const firstId = level.solutionOrder![0];
    state = selectAndMoveVehicle(state, firstId, { instantArrival: true }).nextState;
    const snapshotVehiclesJson = JSON.stringify(state.vehicles);
    const snapshotQueueJson = JSON.stringify(state.passengerQueue);
    const paused = setGameStatus(state, 'PAUSED');
    assert(paused.status === 'PAUSED', 'Game must transition to PAUSED');
    // Verify vehicle selection is ignored while paused
    const tapWhilePaused = selectAndMoveVehicle(paused, level.solutionOrder![1]);
    assert(tapWhilePaused.outcome === 'INVALID_STATE', 'Tapping vehicles while PAUSED must be rejected');
    const resumed = setGameStatus(paused, 'PLAYING');
    assert(
      resumed.status === 'PLAYING' &&
        JSON.stringify(resumed.vehicles) === snapshotVehiclesJson &&
        JSON.stringify(resumed.passengerQueue) === snapshotQueueJson,
      'Pause and resume must preserve exact vehicle and passenger queue state'
    );

    // B. VIP Recovery from genuine LEVEL_FAILED state
    const frontColor = state.passengerQueue[0].color;
    // Construct a synthetic deadlock state where all unlocked standard bays are occupied by non-matching buses
    const nonMatchingColor = frontColor === 'RED' ? 'BLUE' : 'RED';
    const deadlockedVehicles: Vehicle[] = state.vehicles.map((v, idx) => {
      if (idx < 4) {
        return {
          ...v,
          color: nonMatchingColor,
          state: 'IN_BAY',
          assignedBayId: `bay-${idx}`,
        };
      }
      return v;
    });
    const deadlockedBays = state.bays.map((b, idx) => {
      if (!b.isVip && idx < 4) {
        return { ...b, isUnlocked: true, vehicleId: deadlockedVehicles[idx].id };
      }
      if (!b.isVip) {
        return { ...b, isUnlocked: false, vehicleId: null };
      }
      return { ...b, vehicleId: null };
    });

    const stepFail = stepPassengerBoarding({
      ...state,
      vehicles: deadlockedVehicles,
      bays: deadlockedBays,
    });
    assert(
      stepFail.didFailLevel && stepFail.nextState.status === 'LEVEL_FAILED',
      'Board with all 4 standard bays full of non-matching buses must enter LEVEL_FAILED'
    );
    assert(
      stepFail.nextState.failureTriggerCount === 1,
      'failureTriggerCount must increment once on deadlock'
    );

    // Recover from LEVEL_FAILED by moving bay-0 vehicle into VIP slot
    const recoverRes = applyVipBoosterToVehicle(
      stepFail.nextState,
      deadlockedVehicles[0].id,
      { instantArrival: true }
    );
    assert(
      recoverRes.outcome === 'MOVED_TO_VIP_BAY' &&
        recoverRes.nextState.status === 'PLAYING',
      'VIP recovery from LEVEL_FAILED must move bay vehicle to VIP bay and resume PLAYING status'
    );
    const freedBay0 = recoverRes.nextState.bays.find((b) => b.id === 'bay-0')!;
    const occupiedVip = recoverRes.nextState.bays.find((b) => b.isVip)!;
    assert(
      freedBay0.vehicleId === null && occupiedVip.vehicleId === deadlockedVehicles[0].id,
      'Standard bay-0 must now be free and VIP bay must hold the moved vehicle'
    );
  });

  // 25. Mesh Instancing, Draw-Call Batching & 3 Realistic Car Models (Luxury SUV, GT Sport Coupe, Touring Hatch)
  runTest('25. Vehicle mesh instancing reduces draw calls by >80% and resolves all 3 realistic car models & bus archetypes', () => {
    const seenCarVariants = new Set<string>();
    const seenArchetypes = new Set<string>();

    // Verify all 3 reference car models and all 5 vehicle mesh archetypes are active across levels
    for (let lvl = 1; lvl <= 40; lvl++) {
      const ld = generateLevel(lvl);
      for (const v of ld.vehicles) {
        const arch = resolveVehicleMeshArchetype(v);
        seenArchetypes.add(arch);
        assert(
          Boolean(getMeshSymbolDomId(arch)),
          `Archetype ${arch} must map to a valid shared SVG master mesh ID`
        );
        if (v.capacity === 4) {
          seenCarVariants.add(resolveCarModelVariant(v));
        }
      }
    }

    assert(
      seenCarVariants.size === CAR_MODEL_VARIANTS.length,
      `All 3 realistic car variants (LUXURY_SUV, SPORT_COUPE, TOURING_HATCH) must be instantiated, got ${seenCarVariants.size}`
    );
    assert(
      seenArchetypes.size === VEHICLE_MESH_ARCHETYPE_IDS.length,
      `All 5 vehicle mesh archetypes (3 cars + minibus + coach bus) must be instantiated, got ${seenArchetypes.size}`
    );

    // Verify Instanced Scene Graph & Draw-Call Batching on a busy 13-vehicle level (Level 90)
    const level90 = generateLevel(90);
    const state90 = createGameStateFromLevel(level90, 'PLAYING');
    const anim90 = createAnimationController(state90.vehicles);

    const instancedScene = buildInstancedVehicleScene({
      vehicles: state90.vehicles,
      obstacles: state90.obstacles,
      kinematicsByVehicleId: anim90.kinematicsByVehicleId,
      selectedVehicleId: null,
      blockedFeedback: null,
      cellPx: 36,
      baseHeadlightOpacity: 0.4,
    });

    assert(
      instancedScene.parkedInstances.length === state90.vehicles.length,
      'All parked vehicles must be included in instanced scene graph'
    );
    assert(
      instancedScene.groundShadowsAndLights.length === state90.vehicles.length,
      'All vehicle ground shadows and headlight cones must be batched into the unified ground pass'
    );
    assert(
      instancedScene.metrics.instancedDrawCalls <= 8,
      `Instanced draw calls must be bounded (<= 8 total passes), got ${instancedScene.metrics.instancedDrawCalls}`
    );
    assert(
      instancedScene.metrics.drawCallReductionPercent >= 85,
      `Mesh instancing must reduce draw calls by at least 85% on busy levels (actual: ${instancedScene.metrics.drawCallReductionPercent}%)`
    );

    // Verify Shared Geometry Buffers & Consolidated Material Instances (.parking-lot-canvas-element)
    assert(
      Object.keys(SHARED_GEOMETRY_BUFFER_REGISTRY).length === 5 &&
        Object.keys(CONSOLIDATED_MATERIAL_REGISTRY).length === 9,
      'Shared Geometry Buffer Registry (5 archetypes) and Consolidated Material Registry (9 materials) must be pre-allocated'
    );

    const sampleVehicle = state90.vehicles[0];
    const matRef1 = resolveConsolidatedMaterial(sampleVehicle);
    const matRef2 = resolveConsolidatedMaterial(sampleVehicle);
    const geomRef1 = resolveSharedGeometryBuffer(sampleVehicle);
    const geomRef2 = resolveSharedGeometryBuffer(sampleVehicle);

    assert(
      matRef1 === matRef2 && geomRef1 === geomRef2,
      'Consolidated material instances and shared geometry buffer descriptors must share identical object references across calls'
    );

    const batchedCountByMaterial = Object.values(
      instancedScene.materialBatches
    ).reduce((sum, batch) => sum + (batch ? batch.instances.length : 0), 0);
    assert(
      batchedCountByMaterial === state90.vehicles.length &&
        instancedScene.metrics.activeMaterialBatches > 0 &&
        instancedScene.metrics.materialStateSwitchesSaved >= 0,
      'All rendered vehicles must be grouped into consolidated material batches'
    );
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  return { passed, failed, results };
}

// Allow running directly via `npx tsx src/tests/coreGameplay.test.ts`
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv.some((arg) => arg.includes('coreGameplay.test'));

if (isDirectRun) {
  const report = runAllCoreGameplayTests();
  console.log('\n========================================');
  console.log(' BUS JAM MOBILE — AUTOMATED TEST SUITE');
  console.log('========================================');
  for (const r of report.results) {
    if (r.passed) {
      console.log(`  [PASS] ${r.name}`);
    } else {
      console.error(`  [FAIL] ${r.name} -> ${r.error}`);
    }
  }
  console.log('----------------------------------------');
  console.log(`  Total: ${report.passed + report.failed} | Passed: ${report.passed} | Failed: ${report.failed}`);
  console.log('========================================\n');
  if (report.failed > 0) {
    process.exit(1);
  }
}
