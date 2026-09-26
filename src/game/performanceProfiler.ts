import {
  buildVehicleBayPath,
  cancelAndResetAnimations,
  createAnimationController,
  startPassengerBoardingAnimation,
  startVehicleMotionAnimation,
  stepAnimationSystem,
} from './animationEngine';
import {
  createGameStateFromLevel,
  resolveAllImmediateBoarding,
  restartLevelState,
  selectAndMoveVehicle,
} from './gameEngine';
import { generateLevel } from './levelGenerator';

export interface PerformanceBenchmarkReport {
  targetFrameBudgetMs: number;
  level100GenerationMs: number;
  highDensityLevel100FullSolveMs: number;
  avgGameplayMoveAndBoardMs: number;
  maxGameplayMoveAndBoardMs: number;
  avgAnimationFrameStepMs: number;
  maxAnimationFrameStepMs: number;
  repeated50RestartsTotalMs: number;
  longSession15LevelsTotalMs: number;
  leakedMotionsAfterRestart: number;
  meets60FpsTarget: boolean;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Profiles representative gameplay, high-density Level 100 execution, 60fps animation stepping,
 * repeated level restarts, and multi-level long sessions.
 */
export function runPerformanceBenchmarks(): PerformanceBenchmarkReport {
  const targetFrameBudgetMs = 16.67; // 60 FPS = 16.67ms per frame

  // 1. Profile Level 100 generation & full solve (high vehicle & passenger density)
  const tGenStart = nowMs();
  const level100 = generateLevel(100);
  const level100GenerationMs = Number((nowMs() - tGenStart).toFixed(3));

  let state100 = createGameStateFromLevel(level100, 'PLAYING');
  const moveStepTimes: number[] = [];
  const tSolveStart = nowMs();

  for (const vid of level100.solutionOrder || []) {
    const tStep0 = nowMs();
    const moveRes = selectAndMoveVehicle(state100, vid, {
      instantArrival: true,
    });
    state100 = resolveAllImmediateBoarding(moveRes.nextState).nextState;
    moveStepTimes.push(nowMs() - tStep0);
  }
  const highDensityLevel100FullSolveMs = Number(
    (nowMs() - tSolveStart).toFixed(3)
  );

  const avgGameplayMoveAndBoardMs = Number(
    (
      moveStepTimes.reduce((sum, v) => sum + v, 0) /
      Math.max(1, moveStepTimes.length)
    ).toFixed(4)
  );
  const maxGameplayMoveAndBoardMs = Number(
    Math.max(0, ...moveStepTimes).toFixed(4)
  );

  // 2. Profile 60fps Animation Frame Stepping under concurrent vehicle & passenger load
  const animSampleLevel = generateLevel(85);
  let animCtrl = createAnimationController(animSampleLevel.vehicles);
  for (let i = 0; i < Math.min(4, animSampleLevel.vehicles.length); i++) {
    const v = animSampleLevel.vehicles[i];
    const path = buildVehicleBayPath(
      v,
      animSampleLevel.gridWidth,
      animSampleLevel.gridHeight,
      { x: i * 1.2, y: -1 }
    );
    animCtrl = startVehicleMotionAnimation(animCtrl, v, path, 'TO_BAY', 280);
    animCtrl = startPassengerBoardingAnimation(animCtrl, {
      passengerId: `perf-pax-${i}`,
      passengerColor: v.color,
      targetVehicleId: v.id,
      targetBayIndex: i,
      seatIndex: 0,
      durationMs: 200,
    });
  }

  const animFrameTimes: number[] = [];
  for (let frame = 0; frame < 30; frame++) {
    const t0 = nowMs();
    animCtrl = stepAnimationSystem(animCtrl, 16.67).nextController;
    animFrameTimes.push(nowMs() - t0);
  }

  const avgAnimationFrameStepMs = Number(
    (
      animFrameTimes.reduce((sum, v) => sum + v, 0) / animFrameTimes.length
    ).toFixed(4)
  );
  const maxAnimationFrameStepMs = Number(
    Math.max(0, ...animFrameTimes).toFixed(4)
  );

  // 3. Profile 50 repeated restarts during active gameplay & animations (memory & cleanup stability)
  let restartState = createGameStateFromLevel(level100, 'PLAYING');
  let restartAnim = createAnimationController(restartState.vehicles);
  const tRestart0 = nowMs();

  for (let r = 0; r < 50; r++) {
    const firstId = level100.solutionOrder![0];
    const firstBus = restartState.vehicles[0];
    restartState = selectAndMoveVehicle(restartState, firstId, {
      instantArrival: false,
    }).nextState;
    restartAnim = startVehicleMotionAnimation(
      restartAnim,
      firstBus,
      [
        { x: firstBus.gridX, y: firstBus.gridY },
        { x: 1, y: -1 },
      ],
      'TO_BAY',
      240
    );
    restartAnim = stepAnimationSystem(restartAnim, 32).nextController;

    // Restart and cancel
    restartState = restartLevelState(restartState, 'PLAYING');
    restartAnim = cancelAndResetAnimations(restartAnim, restartState.vehicles);
  }
  const repeated50RestartsTotalMs = Number((nowMs() - tRestart0).toFixed(3));
  const leakedMotionsAfterRestart =
    Object.keys(restartAnim.activeVehicleMotions).length +
    restartAnim.activePassengerAnims.length;

  // 4. Profile Long Play Session (15 levels across campaign tiers)
  const sessionLevels = [1, 5, 12, 20, 28, 35, 42, 50, 58, 65, 72, 80, 88, 95, 100];
  const tSession0 = nowMs();
  for (const lvlNum of sessionLevels) {
    const lvl = generateLevel(lvlNum);
    let st = createGameStateFromLevel(lvl, 'PLAYING');
    for (const vid of lvl.solutionOrder || []) {
      const m = selectAndMoveVehicle(st, vid, { instantArrival: true });
      st = resolveAllImmediateBoarding(m.nextState).nextState;
    }
  }
  const longSession15LevelsTotalMs = Number((nowMs() - tSession0).toFixed(3));

  const meets60FpsTarget =
    avgGameplayMoveAndBoardMs < targetFrameBudgetMs &&
    avgAnimationFrameStepMs < targetFrameBudgetMs &&
    leakedMotionsAfterRestart === 0;

  return {
    targetFrameBudgetMs,
    level100GenerationMs,
    highDensityLevel100FullSolveMs,
    avgGameplayMoveAndBoardMs,
    maxGameplayMoveAndBoardMs,
    avgAnimationFrameStepMs,
    maxAnimationFrameStepMs,
    repeated50RestartsTotalMs,
    longSession15LevelsTotalMs,
    leakedMotionsAfterRestart,
    meets60FpsTarget,
  };
}
