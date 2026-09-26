/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COLOR_PALETTE } from './assets/colorPalette';
import { getEnvironmentThemeForLevel } from './assets/environmentThemes';
import { BoosterDock } from './components/BoosterDock';
import { LevelSelectModal } from './components/LevelSelectModal';
import { MainMenuScreen } from './components/MainMenuScreen';
import { ParkingBaysView } from './components/ParkingBaysView';
import { ParkingLotCanvas } from './components/ParkingLotCanvas';
import { PassengerQueueView } from './components/PassengerQueueView';
import { ResultModals } from './components/ResultModals';
import { TopHud } from './components/TopHud';
import { VisualEffectsLayer } from './components/VisualEffectsLayer';
import {
  AnimationControllerState,
  buildVehicleBayPath,
  cancelAndResetAnimations,
  createAnimationController,
  setVehicleDoorTargetState,
  startPassengerBoardingAnimation,
  startVehicleMotionAnimation,
  stepAnimationSystem,
  triggerVehicleSuspensionImpulse,
} from './game/animationEngine';
import { audioManager } from './game/audioManager';
import {
  findAvailableVipBay,
  findEligibleVehicleForFrontPassenger,
  stepPassengerBoarding,
} from './game/boardingEngine';
import {
  applyPickBooster,
  applyShuffleBooster,
  applyVipBoosterToVehicle,
  cancelVipBoosterMode,
  completeVehicleArrival,
  createGameStateFromLevel,
  restartLevelState,
  selectAndMoveVehicle,
  setGameStatus,
  toggleVipBoosterMode,
  unlockNextStandardBay,
} from './game/gameEngine';
import { generateLevel, TOTAL_LEVELS } from './game/levelGenerator';
import {
  BOOSTER_COIN_COSTS,
  canLaunchLevel,
  checkBoosterAvailability,
  consumeBoosterFromSave,
  EXTRA_BAY_COIN_COST,
  flushSaveOnAppInterruption,
  loadSaveData,
  recordLevelCompletionInSave,
  savePlayerData,
  spendCoinsFromSave,
} from './game/storageManager';
import {
  BoosterType,
  EnvironmentThemeId,
  GameState,
  PlayerSaveData,
  VisualEffectItem,
} from './game/types';

const MAX_ACTIVE_VFX = 8;

export default function App() {
  const [saveData, setSaveData] = useState<PlayerSaveData>(() => {
    const loaded = loadSaveData();
    audioManager.setEnabled(loaded.soundEnabled);
    audioManager.setMusicEnabled(loaded.musicEnabled ?? true);
    audioManager.setSfxVolume(loaded.sfxVolume ?? 0.85);
    audioManager.setMusicVolume(loaded.musicVolume ?? 0.45);
    return loaded;
  });

  // Synchronous ref to saveData so rapid repeated touch inputs never read stale closure balances
  const saveDataRef = useRef<PlayerSaveData>(saveData);
  useEffect(() => {
    saveDataRef.current = saveData;
  }, [saveData]);

  const [screenMode, setScreenMode] = useState<'MAIN_MENU' | 'GAMEPLAY'>(
    'GAMEPLAY'
  );

  const [gameState, setGameState] = useState<GameState>(() => {
    const initialSave = loadSaveData();
    const levelData = generateLevel(initialSave.currentLevel);
    levelData.unlockedStandardBays = Math.min(
      6,
      4 + initialSave.extraBaysUnlocked
    );
    return createGameStateFromLevel(levelData, 'PLAYING');
  });

  const [animController, setAnimController] =
    useState<AnimationControllerState>(() =>
      createAnimationController(gameState.vehicles)
    );

  const [visualEffects, setVisualEffects] = useState<VisualEffectItem[]>([]);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [lastReward, setLastReward] = useState<{
    coins: number;
    stars: number;
  }>({
    coins: 0,
    stars: 3,
  });

  // Track active transit/effect timeouts so we can cancel them cleanly on restart or level change
  const transitTimersRef = useRef<Set<number>>(new Set());
  const rewardClaimedRef = useRef<boolean>(false);
  const fxSeqRef = useRef<number>(1);

  const clearAllTransitTimers = useCallback(() => {
    for (const timerId of transitTimersRef.current) {
      window.clearTimeout(timerId);
    }
    transitTimersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearAllTransitTimers();
    };
  }, [clearAllTransitTimers]);

  // Synchronize audio manager pause state with gameplay status
  useEffect(() => {
    audioManager.setPaused(gameState.status === 'PAUSED');
  }, [gameState.status]);

  // Android Lifecycle & Focus Loss Handling:
  // Automatically flushes save data, suspends audio, and pauses active gameplay when app is backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSaveOnAppInterruption();
        audioManager.setPaused(true);
        setGameState((prev) =>
          prev.status === 'PLAYING' ? setGameStatus(prev, 'PAUSED') : prev
        );
      } else if (document.visibilityState === 'visible') {
        setGameState((prev) => {
          audioManager.setPaused(prev.status === 'PAUSED');
          return prev;
        });
      }
    };

    const handlePageHide = () => {
      flushSaveOnAppInterruption();
      audioManager.setPaused(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Spawn lightweight compositor-only visual effect (capped at MAX_ACTIVE_VFX = 8)
  const spawnVisualEffect = useCallback(
    (
      type: VisualEffectItem['type'],
      xPercent: number,
      yPercent: number,
      colorHex: string,
      label?: string
    ) => {
      const id = `vfx-${Date.now()}-${fxSeqRef.current++}`;
      const newFx: VisualEffectItem = {
        id,
        type,
        xPercent,
        yPercent,
        colorHex,
        label,
        createdAt: Date.now(),
      };
      setVisualEffects((prev) => [
        ...prev.slice(-(MAX_ACTIVE_VFX - 1)),
        newFx,
      ]);

      const cleanupTimer = window.setTimeout(() => {
        transitTimersRef.current.delete(cleanupTimer);
        setVisualEffects((prev) => prev.filter((item) => item.id !== id));
      }, 600);
      transitTimersRef.current.add(cleanupTimer);
    },
    []
  );

  // On-demand 60fps animation loop: ONLY runs while vehicle motions, passenger boarding,
  // door transitions, or suspension decay are active (saves mobile battery & CPU when idle or paused)
  useEffect(() => {
    if (gameState.status === 'PAUSED' || screenMode !== 'GAMEPLAY') {
      return;
    }

    const hasActiveVehicleMotions =
      Object.keys(animController.activeVehicleMotions).length > 0;
    const hasActivePassengerAnims =
      animController.activePassengerAnims.length > 0;
    const hasActiveDoorsOrSuspension = Object.values(
      animController.kinematicsByVehicleId
    ).some(
      (k) =>
        k.doorState === 'OPENING' ||
        k.doorState === 'CLOSING' ||
        Math.abs(k.suspensionOffsetPx) > 0.05 ||
        k.speed > 0
    );

    if (
      !hasActiveVehicleMotions &&
      !hasActivePassengerAnims &&
      !hasActiveDoorsOrSuspension
    ) {
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dtMs = Math.min(48, Math.max(8, now - lastTime));
      lastTime = now;

      setAnimController((prev) => {
        const { nextController, events } = stepAnimationSystem(prev, dtMs);
        if (events.arrivedVehicleIds.length > 0) {
          audioManager.playVehicleStop();
          setGameState((gs) => {
            let updated = gs;
            for (const vid of events.arrivedVehicleIds) {
              updated = completeVehicleArrival(updated, vid);
            }
            return updated;
          });
        }
        return nextController;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    screenMode,
    gameState.status,
    animController.activeVehicleMotions,
    animController.activePassengerAnims,
    animController.kinematicsByVehicleId,
  ]);

  // Load a specific level (enforcing level unlock rules) and reset animation state
  const loadSpecificLevel = useCallback(
    (levelNumber: number) => {
      const clamped = Math.max(1, Math.min(TOTAL_LEVELS, levelNumber));
      if (!canLaunchLevel(saveDataRef.current, clamped)) {
        audioManager.playBlockedHorn();
        setGameState((prev) => ({
          ...prev,
          lastActionMessage: `Level ${clamped} is locked! Complete Level ${saveDataRef.current.unlockedLevel} first.`,
        }));
        return;
      }

      clearAllTransitTimers();
      rewardClaimedRef.current = false;
      setVisualEffects([]);

      const levelData = generateLevel(clamped);
      levelData.unlockedStandardBays = Math.min(
        6,
        4 + saveDataRef.current.extraBaysUnlocked
      );

      const loadingState = createGameStateFromLevel(levelData, 'LOADING');
      const playingState = setGameStatus(loadingState, 'PLAYING');
      setGameState(playingState);
      setAnimController((prev) =>
        cancelAndResetAnimations(prev, playingState.vehicles)
      );
      setScreenMode('GAMEPLAY');

      const nextSave: PlayerSaveData = {
        ...saveDataRef.current,
        currentLevel: clamped,
      };
      saveDataRef.current = nextSave;
      savePlayerData(nextSave);
      setSaveData(nextSave);
    },
    [clearAllTransitTimers]
  );

  // Continuous FIFO Passenger Boarding Loop while status === 'PLAYING'
  useEffect(() => {
    if (screenMode !== 'GAMEPLAY' || gameState.status !== 'PLAYING') return;

    const frontPassenger = gameState.passengerQueue[0];
    const eligibleBus = findEligibleVehicleForFrontPassenger(
      frontPassenger,
      gameState.vehicles,
      gameState.bays
    );

    const anyMoving = gameState.vehicles.some(
      (v) => v.state === 'MOVING_TO_BAY'
    );
    const unlockedStandard = gameState.bays.filter(
      (b) => !b.isVip && b.isUnlocked
    );
    const allStandardFull =
      unlockedStandard.length > 0 &&
      unlockedStandard.every((b) => b.vehicleId !== null);

    if (!eligibleBus && !(allStandardFull && !anyMoving)) {
      return;
    }

    // Start visual passenger walk-to-door animation immediately while waiting for the boarding step
    if (frontPassenger && eligibleBus) {
      const bayIdx = Math.max(
        0,
        gameState.bays.findIndex((b) => b.id === eligibleBus.assignedBayId)
      );
      setAnimController((prev) =>
        startPassengerBoardingAnimation(prev, {
          passengerId: frontPassenger.id,
          passengerColor: frontPassenger.color,
          targetVehicleId: eligibleBus.id,
          targetBayIndex: bayIdx,
          seatIndex: eligibleBus.occupiedSeats,
          durationMs: 110,
        })
      );
    }

    const timerId = window.setTimeout(() => {
      setGameState((prev) => {
        if (prev.status !== 'PLAYING') return prev;
        const step = stepPassengerBoarding(prev);

        if (step.boardedPassengerId && step.targetVehicleId) {
          const targetBus = step.nextState.vehicles.find(
            (v) => v.id === step.targetVehicleId
          );
          const bayIndex = Math.max(
            0,
            prev.bays.findIndex((b) => b.vehicleId === step.targetVehicleId)
          );
          const bayXPercent = 14 + bayIndex * 15;

          audioManager.playPassengerBoard(
            targetBus ? targetBus.occupiedSeats - 1 : 0
          );

          if (targetBus) {
            const colorHex = COLOR_PALETTE[targetBus.color].bodyHex;
            spawnVisualEffect(
              'PASSENGER_BOARD_POP',
              bayXPercent,
              21,
              colorHex,
              `${targetBus.occupiedSeats}/${targetBus.capacity}`
            );

            // Pulse vehicle suspension & keep door open during boarding
            setAnimController((ac) => {
              const withDoor = setVehicleDoorTargetState(
                ac,
                targetBus.id,
                step.departedVehicleIds.includes(targetBus.id)
                  ? 'CLOSING'
                  : 'OPEN'
              );
              return triggerVehicleSuspensionImpulse(
                withDoor,
                targetBus.id,
                1.25
              );
            });
          }
        }

        if (step.departedVehicleIds.length > 0) {
          audioManager.playSuccessfulMatch();
          for (const depId of step.departedVehicleIds) {
            const depBus = step.nextState.vehicles.find((v) => v.id === depId);
            const hex = depBus ? COLOR_PALETTE[depBus.color].bodyHex : '#10B981';
            spawnVisualEffect('BUS_FULL_MATCH', 50, 22, hex, 'FULL MATCH! ✓');
            spawnVisualEffect('VEHICLE_DEPART_PUFF', 75, 22, hex);
          }
        }

        if (step.didFailLevel) {
          audioManager.playFailure();
          spawnVisualEffect(
            'LEVEL_FAILED_ALERT',
            50,
            35,
            '#E11D48',
            'BAYS JAMMED!'
          );
        }

        return step.nextState;
      });
    }, 115);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    screenMode,
    gameState.status,
    gameState.passengerQueue,
    gameState.vehicles,
    gameState.bays,
    spawnVisualEffect,
  ]);

  // Handle single-trigger Level Completion reward & progression persistence
  useEffect(() => {
    if (
      gameState.status === 'LEVEL_COMPLETED' &&
      gameState.victoryTriggerCount === 1 &&
      !gameState.rewardClaimed &&
      !rewardClaimedRef.current
    ) {
      rewardClaimedRef.current = true;
      audioManager.playVictory();

      const { updatedSave, coinsEarned, starsEarned } =
        recordLevelCompletionInSave(
          saveDataRef.current,
          gameState.levelNumber,
          gameState.boostersUsedCount
        );
      saveDataRef.current = updatedSave;
      setSaveData(updatedSave);
      setLastReward({ coins: coinsEarned, stars: starsEarned });
      setGameState((prev) => ({ ...prev, rewardClaimed: true }));

      spawnVisualEffect(
        'LEVEL_COMPLETE_BURST',
        50,
        42,
        '#10B981',
        `LEVEL ${gameState.levelNumber} CLEARED!`
      );
      if (coinsEarned > 0) {
        audioManager.playCoinCollect();
        spawnVisualEffect(
          'COIN_COLLECT',
          58,
          10,
          '#F59E0B',
          `+${coinsEarned} Coins`
        );
      }
    }
  }, [
    gameState.status,
    gameState.victoryTriggerCount,
    gameState.rewardClaimed,
    gameState.levelNumber,
    gameState.boostersUsedCount,
    spawnVisualEffect,
  ]);

  // Clear transient blocked recoil feedback after 450ms
  useEffect(() => {
    if (!gameState.blockedFeedback) return;
    const t = window.setTimeout(() => {
      setGameState((prev) =>
        prev.blockedFeedback ? { ...prev, blockedFeedback: null } : prev
      );
    }, 450);
    return () => window.clearTimeout(t);
  }, [gameState.blockedFeedback]);

  // Helper to atomically consume a booster from inventory or coins ONLY after booster action succeeds
  const tryConsumeBooster = useCallback(
    (type: BoosterType): boolean => {
      const res = consumeBoosterFromSave(saveDataRef.current, type);
      if (!res.success) {
        audioManager.playBlockedHorn();
        setGameState((prev) => ({
          ...prev,
          lastActionMessage:
            res.reason || `Need ${BOOSTER_COIN_COSTS[type]}c for ${type}!`,
        }));
        return false;
      }

      saveDataRef.current = res.updatedSave;
      setSaveData(res.updatedSave);

      if (res.coinsSpent > 0) {
        audioManager.playCoinCollect();
        spawnVisualEffect(
          'COIN_COLLECT',
          58,
          10,
          '#FB7185',
          `-${res.coinsSpent} Coins`
        );
      }
      return true;
    },
    [spawnVisualEffect]
  );

  // Player taps a vehicle in the parking lot
  const handleSelectLotVehicle = useCallback(
    (vehicleId: string) => {
      const wasVipMode = gameState.activeBoosterMode === 'VIP_SELECT';
      const targetVehicle = gameState.vehicles.find((v) => v.id === vehicleId);

      // If in VIP_SELECT mode, verify booster availability before committing
      if (wasVipMode) {
        const avail = checkBoosterAvailability(saveDataRef.current, 'VIP');
        if (!avail.canActivate) {
          audioManager.playBlockedHorn();
          setGameState((prev) => ({
            ...cancelVipBoosterMode(prev),
            lastActionMessage: `Need ${BOOSTER_COIN_COSTS.VIP} coins or a VIP charge!`,
          }));
          return;
        }
      }

      const moveResult = selectAndMoveVehicle(gameState, vehicleId, {
        instantArrival: false,
      });

      if (
        moveResult.outcome === 'BLOCKED_BY_VEHICLE' ||
        moveResult.outcome === 'BLOCKED_BY_OBSTACLE' ||
        moveResult.outcome === 'NO_FREE_BAY'
      ) {
        audioManager.playBlockedHorn();
        setGameState(moveResult.nextState);
        if (targetVehicle) {
          setAnimController((prev) =>
            triggerVehicleSuspensionImpulse(prev, targetVehicle.id, -1.8)
          );
        }
        return;
      }

      if (moveResult.outcome === 'MOVED_TO_VIP_BAY' && wasVipMode) {
        if (!tryConsumeBooster('VIP')) return;
        audioManager.playBoosterActivate('VIP');
        spawnVisualEffect('BOOSTER_FLASH', 84, 21, '#F59E0B', 'VIP AIRLIFT!');
      } else if (moveResult.outcome === 'MOVED_TO_BAY') {
        audioManager.playVehicleMove();
        if (targetVehicle) {
          spawnVisualEffect(
            'VEHICLE_MOVE_TRAIL',
            50,
            55,
            COLOR_PALETTE[targetVehicle.color].bodyHex,
            'DRIVING'
          );
        }
      } else {
        return;
      }

      setGameState(moveResult.nextState);

      // Build smooth perimeter-road path and start vehicle motion animation
      if (targetVehicle) {
        const bayIdx = Math.max(
          0,
          moveResult.nextState.bays.findIndex(
            (b) => b.id === moveResult.targetBayId
          )
        );
        const bayDestX = Math.min(
          gameState.gridWidth - 1,
          Math.max(0, bayIdx * 1.1)
        );
        const waypoints = buildVehicleBayPath(
          targetVehicle,
          gameState.gridWidth,
          gameState.gridHeight,
          { x: bayDestX, y: -1.1 }
        );

        setAnimController((prev) =>
          startVehicleMotionAnimation(
            prev,
            targetVehicle,
            waypoints,
            'TO_BAY',
            220
          )
        );
      }

      // Fallback safety timer in case tab is backgrounded and requestAnimationFrame pauses
      const arrivalTimer = window.setTimeout(() => {
        transitTimersRef.current.delete(arrivalTimer);
        setGameState((prev) => {
          const vehicleBefore = prev.vehicles.find((v) => v.id === vehicleId);
          if (vehicleBefore && vehicleBefore.state === 'MOVING_TO_BAY') {
            audioManager.playVehicleStop();
            spawnVisualEffect('VEHICLE_STOP_BRAKE', 35, 22, '#FDE047', 'PARKED');
          }
          return completeVehicleArrival(prev, vehicleId);
        });
        setAnimController((prev) =>
          setVehicleDoorTargetState(prev, vehicleId, 'OPENING')
        );
      }, 240);

      transitTimersRef.current.add(arrivalTimer);
    },
    [gameState, tryConsumeBooster, spawnVisualEffect]
  );

  // Player taps a vehicle in a standard bay while VIP Mode is active
  const handleSelectBayVehicleForVip = useCallback(
    (vehicleId: string) => {
      if (gameState.activeBoosterMode !== 'VIP_SELECT') return;
      const avail = checkBoosterAvailability(saveDataRef.current, 'VIP');
      if (!avail.canActivate) {
        audioManager.playBlockedHorn();
        setGameState((prev) => ({
          ...cancelVipBoosterMode(prev),
          lastActionMessage: `Need ${BOOSTER_COIN_COSTS.VIP} coins or a VIP charge!`,
        }));
        return;
      }

      const res = applyVipBoosterToVehicle(gameState, vehicleId, {
        instantArrival: true,
      });
      if (res.outcome === 'MOVED_TO_VIP_BAY') {
        if (!tryConsumeBooster('VIP')) return;
        audioManager.playBoosterActivate('VIP');
        spawnVisualEffect('BOOSTER_FLASH', 84, 21, '#F59E0B', 'VIP SLOT!');
        setGameState(res.nextState);
      }
    },
    [gameState, tryConsumeBooster, spawnVisualEffect]
  );

  // Restart current level cleanly and cancel all active animations & effects
  const handleRestartLevel = useCallback(() => {
    audioManager.playButtonTap();
    clearAllTransitTimers();
    rewardClaimedRef.current = false;
    setVisualEffects([]);
    setGameState((prev) => {
      const next = restartLevelState(prev, 'PLAYING');
      setAnimController((ac) => cancelAndResetAnimations(ac, next.vehicles));
      return next;
    });
  }, [clearAllTransitTimers]);

  // Toggle Pause <-> Playing
  const handleTogglePause = useCallback(() => {
    audioManager.playButtonTap();
    setVisualEffects([]);
    setGameState((prev) => {
      if (prev.status === 'PAUSED') {
        return setGameStatus(prev, 'PLAYING');
      }
      if (prev.status === 'PLAYING' || prev.status === 'READY') {
        return setGameStatus(prev, 'PAUSED');
      }
      return prev;
    });
  }, []);

  // Boosters
  const handleUseVipBooster = useCallback(() => {
    audioManager.playButtonTap();
    if (gameState.activeBoosterMode === 'VIP_SELECT') {
      setGameState((prev) => cancelVipBoosterMode(prev));
      return;
    }
    const avail = checkBoosterAvailability(saveDataRef.current, 'VIP');
    if (!avail.canActivate) {
      audioManager.playBlockedHorn();
      setGameState((prev) => ({
        ...prev,
        lastActionMessage: `Not enough coins! Need ${BOOSTER_COIN_COSTS.VIP}c for VIP Slot.`,
      }));
      return;
    }
    setGameState((prev) => toggleVipBoosterMode(prev));
  }, [gameState.activeBoosterMode]);

  const handleCancelVipBooster = useCallback(() => {
    audioManager.playButtonTap();
    setGameState((prev) => cancelVipBoosterMode(prev));
  }, []);

  const handleUsePickBooster = useCallback(() => {
    const avail = checkBoosterAvailability(saveDataRef.current, 'PICK');
    if (!avail.canActivate) {
      audioManager.playBlockedHorn();
      setGameState((prev) => ({
        ...prev,
        lastActionMessage: `Not enough coins! Need ${BOOSTER_COIN_COSTS.PICK}c for Pick Booster.`,
      }));
      return;
    }
    const res = applyPickBooster(gameState);
    if (!res.applied) {
      audioManager.playBlockedHorn();
      setGameState(res.nextState);
      return;
    }
    if (!tryConsumeBooster('PICK')) return;
    audioManager.playBoosterActivate('PICK');
    spawnVisualEffect(
      'BOOSTER_FLASH',
      50,
      21,
      '#38BDF8',
      `PICKED +${res.pickedPassengerIds.length}!`
    );
    setGameState(res.nextState);
  }, [gameState, tryConsumeBooster, spawnVisualEffect]);

  const handleUseShuffleBooster = useCallback(() => {
    const avail = checkBoosterAvailability(saveDataRef.current, 'SHUFFLE');
    if (!avail.canActivate) {
      audioManager.playBlockedHorn();
      setGameState((prev) => ({
        ...prev,
        lastActionMessage: `Not enough coins! Need ${BOOSTER_COIN_COSTS.SHUFFLE}c for Shuffle Booster.`,
      }));
      return;
    }
    const res = applyShuffleBooster(gameState);
    if (!res.applied) {
      audioManager.playBlockedHorn();
      setGameState(res.nextState);
      return;
    }
    if (!tryConsumeBooster('SHUFFLE')) return;
    audioManager.playBoosterActivate('SHUFFLE');
    spawnVisualEffect('BOOSTER_FLASH', 50, 56, '#C084FC', 'COLORS SHUFFLED!');
    setGameState(res.nextState);
  }, [gameState, tryConsumeBooster, spawnVisualEffect]);

  const handleUnlockExtraBay = useCallback(() => {
    const res = unlockNextStandardBay(gameState);
    if (!res.unlockedBayId) return;

    const spendRes = spendCoinsFromSave(
      saveDataRef.current,
      EXTRA_BAY_COIN_COST
    );
    if (!spendRes.success) {
      audioManager.playBlockedHorn();
      setGameState((prev) => ({
        ...prev,
        lastActionMessage:
          spendRes.reason || `Need ${EXTRA_BAY_COIN_COST} coins for Extra Bay!`,
      }));
      return;
    }

    const updatedSave: PlayerSaveData = {
      ...spendRes.updatedSave,
      extraBaysUnlocked: Math.min(
        2,
        spendRes.updatedSave.extraBaysUnlocked + 1
      ),
    };
    saveDataRef.current = updatedSave;
    savePlayerData(updatedSave);
    setSaveData(updatedSave);

    audioManager.playBoosterActivate();
    audioManager.playCoinCollect();
    spawnVisualEffect(
      'COIN_COLLECT',
      58,
      10,
      '#FB7185',
      `-${EXTRA_BAY_COIN_COST} Coins`
    );
    spawnVisualEffect(
      'BOOSTER_FLASH',
      70,
      21,
      '#10B981',
      'EXTRA BAY UNLOCKED!'
    );
    setGameState(res.nextState);
  }, [gameState, spawnVisualEffect]);

  // Recover from a full-bay jam using VIP slot
  const handleRecoverWithVipFromModal = useCallback(() => {
    const vipBay = findAvailableVipBay(gameState.bays);
    const inBayBus = gameState.vehicles.find(
      (v) => v.state === 'IN_BAY' && v.assignedBayId !== 'bay-vip'
    );
    if (!vipBay || !inBayBus) return;

    const avail = checkBoosterAvailability(saveDataRef.current, 'VIP');
    if (!avail.canActivate) {
      audioManager.playBlockedHorn();
      return;
    }

    const res = applyVipBoosterToVehicle(gameState, inBayBus.id, {
      instantArrival: true,
    });
    if (res.outcome !== 'MOVED_TO_VIP_BAY') return;
    if (!tryConsumeBooster('VIP')) return;

    audioManager.playBoosterActivate('VIP');
    spawnVisualEffect('BOOSTER_FLASH', 84, 21, '#F59E0B', 'VIP RECOVERY!');
    setGameState(res.nextState);
    setAnimController((prev) =>
      setVehicleDoorTargetState(prev, inBayBus.id, 'OPENING')
    );
  }, [gameState, tryConsumeBooster, spawnVisualEffect]);

  const handleToggleSound = useCallback(() => {
    setSaveData((prev) => {
      const nextEnabled = !prev.soundEnabled;
      audioManager.setEnabled(nextEnabled);
      const updated = { ...prev, soundEnabled: nextEnabled };
      saveDataRef.current = updated;
      savePlayerData(updated);
      return updated;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    setSaveData((prev) => {
      const nextMusic = !(prev.musicEnabled ?? true);
      audioManager.setMusicEnabled(nextMusic);
      const updated = { ...prev, musicEnabled: nextMusic };
      saveDataRef.current = updated;
      savePlayerData(updated);
      return updated;
    });
  }, []);

  const handleChangeSfxVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, Number(vol.toFixed(2))));
    audioManager.setSfxVolume(clamped);
    setSaveData((prev) => {
      const updated = {
        ...prev,
        sfxVolume: clamped,
        soundEnabled: clamped > 0.01 ? true : prev.soundEnabled,
      };
      saveDataRef.current = updated;
      savePlayerData(updated);
      return updated;
    });
  }, []);

  const handleChangeMusicVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, Number(vol.toFixed(2))));
    audioManager.setMusicVolume(clamped);
    setSaveData((prev) => {
      const updated = {
        ...prev,
        musicVolume: clamped,
        musicEnabled: clamped > 0.01 ? true : prev.musicEnabled,
      };
      saveDataRef.current = updated;
      savePlayerData(updated);
      return updated;
    });
  }, []);

  const handleToggleColorblind = useCallback(() => {
    setSaveData((prev) => {
      const updated = {
        ...prev,
        colorblindMode: !prev.colorblindMode,
      };
      saveDataRef.current = updated;
      savePlayerData(updated);
      return updated;
    });
  }, []);

  const handleSelectPreferredTheme = useCallback(
    (theme: EnvironmentThemeId | 'AUTO') => {
      setSaveData((prev) => {
        const updated = { ...prev, preferredTheme: theme };
        saveDataRef.current = updated;
        savePlayerData(updated);
        return updated;
      });
    },
    []
  );

  const canRecoverWithVip =
    Boolean(findAvailableVipBay(gameState.bays)) &&
    (saveData.boosters.VIP > 0 || saveData.coins >= BOOSTER_COIN_COSTS.VIP);

  const activeThemeSpec = getEnvironmentThemeForLevel(
    gameState.levelNumber,
    saveData.preferredTheme
  );

  return (
    <div
      className="w-full h-[100dvh] flex items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: activeThemeSpec.shellBgHex }}
    >
      {/* Locked 9:16 Portrait Mobile Viewport Container */}
      <div
        className="w-full max-w-[430px] h-full sm:border-x sm:border-slate-800 flex flex-col justify-between overflow-hidden relative shadow-2xl transition-colors duration-300"
        style={{
          backgroundColor: activeThemeSpec.shellBgHex,
          backgroundImage: activeThemeSpec.ambientLightGradient,
        }}
      >
        {screenMode === 'MAIN_MENU' ? (
          <MainMenuScreen
            currentLevel={saveData.currentLevel}
            unlockedLevel={saveData.unlockedLevel}
            coins={saveData.coins}
            starsByLevel={saveData.starsByLevel}
            soundEnabled={saveData.soundEnabled}
            musicEnabled={saveData.musicEnabled ?? true}
            sfxVolume={saveData.sfxVolume ?? 0.85}
            musicVolume={saveData.musicVolume ?? 0.45}
            colorblindMode={saveData.colorblindMode}
            preferredTheme={saveData.preferredTheme}
            onPlayCurrentLevel={() => {
              if (
                gameState.levelNumber !== saveData.currentLevel ||
                gameState.status === 'LEVEL_COMPLETED' ||
                gameState.status === 'LEVEL_FAILED'
              ) {
                loadSpecificLevel(saveData.currentLevel);
              } else {
                setGameState((prev) =>
                  prev.status === 'PAUSED' ? setGameStatus(prev, 'PLAYING') : prev
                );
                setScreenMode('GAMEPLAY');
              }
            }}
            onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
            onToggleSound={handleToggleSound}
            onToggleMusic={handleToggleMusic}
            onChangeSfxVolume={handleChangeSfxVolume}
            onChangeMusicVolume={handleChangeMusicVolume}
            onToggleColorblind={handleToggleColorblind}
            onSelectPreferredTheme={handleSelectPreferredTheme}
          />
        ) : (
          <>
            {/* 1. Compact Mobile Top HUD */}
            <TopHud
              levelNumber={gameState.levelNumber}
              themeSpec={activeThemeSpec}
              status={gameState.status}
              boardedCount={gameState.boardedPassengersCount}
              totalPassengers={gameState.totalPassengers}
              coins={saveData.coins}
              onReturnToMainMenu={() => {
                audioManager.playButtonTap();
                clearAllTransitTimers();
                setVisualEffects([]);
                setScreenMode('MAIN_MENU');
              }}
              onOpenLevelSelect={() => {
                audioManager.playButtonTap();
                setIsLevelSelectOpen(true);
              }}
              onTogglePause={handleTogglePause}
              onQuickRestart={handleRestartLevel}
            />

            {/* 2. FIFO Passenger Queue & Bus Stop Gate */}
            <PassengerQueueView
              queue={gameState.passengerQueue}
              activeBoardingAnims={animController.activePassengerAnims}
              showSymbols={saveData.colorblindMode}
              themeSpec={activeThemeSpec}
            />

            {/* 3. Active & VIP Parking Bays */}
            <ParkingBaysView
              bays={gameState.bays}
              vehicles={gameState.vehicles}
              kinematicsByVehicleId={animController.kinematicsByVehicleId}
              themeSpec={activeThemeSpec}
              showSymbols={saveData.colorblindMode}
              activeBoosterMode={gameState.activeBoosterMode}
              coins={saveData.coins}
              onSelectBayVehicleForVip={handleSelectBayVehicleForVip}
              onUnlockExtraBay={handleUnlockExtraBay}
            />

            {/* 4. Interactive Realistic 3D Car & Bus Parking Lot Board */}
            <ParkingLotCanvas
              gridWidth={gameState.gridWidth}
              gridHeight={gameState.gridHeight}
              vehicles={gameState.vehicles}
              obstacles={gameState.obstacles}
              kinematicsByVehicleId={animController.kinematicsByVehicleId}
              themeSpec={activeThemeSpec}
              selectedVehicleId={gameState.selectedVehicleId}
              blockedFeedback={gameState.blockedFeedback}
              showSymbols={saveData.colorblindMode}
              activeBoosterMode={gameState.activeBoosterMode}
              onSelectVehicle={handleSelectLotVehicle}
            />

            {/* 5. Bottom Thumb-Zone Booster Dock */}
            <BoosterDock
              status={gameState.status}
              boosters={saveData.boosters}
              coins={saveData.coins}
              activeBoosterMode={gameState.activeBoosterMode}
              lastActionMessage={gameState.lastActionMessage}
              onStartReadyLevel={() => {
                audioManager.playButtonTap();
                setGameState((prev) => setGameStatus(prev, 'PLAYING'));
              }}
              onUseVipBooster={handleUseVipBooster}
              onCancelVipBooster={handleCancelVipBooster}
              onUsePickBooster={handleUsePickBooster}
              onUseShuffleBooster={handleUseShuffleBooster}
            />

            {/* 6. Lightweight Visual Effects Layer */}
            <VisualEffectsLayer effects={visualEffects} />

            {/* 7. Pause, Victory, and Failure Modals */}
            <ResultModals
              status={gameState.status}
              levelNumber={gameState.levelNumber}
              boardedCount={gameState.boardedPassengersCount}
              totalPassengers={gameState.totalPassengers}
              moveCount={gameState.moveCount}
              lastRewardCoins={lastReward.coins}
              lastRewardStars={lastReward.stars}
              soundEnabled={saveData.soundEnabled}
              musicEnabled={saveData.musicEnabled ?? true}
              sfxVolume={saveData.sfxVolume ?? 0.85}
              musicVolume={saveData.musicVolume ?? 0.45}
              colorblindMode={saveData.colorblindMode}
              canRecoverWithVip={canRecoverWithVip}
              onResume={() => {
                audioManager.playButtonTap();
                setGameState((prev) => setGameStatus(prev, 'PLAYING'));
              }}
              onRestart={handleRestartLevel}
              onNextLevel={() => {
                audioManager.playButtonTap();
                const nextLvl =
                  gameState.levelNumber < TOTAL_LEVELS
                    ? gameState.levelNumber + 1
                    : 1;
                loadSpecificLevel(nextLvl);
              }}
              onRecoverWithVip={handleRecoverWithVipFromModal}
              onToggleSound={handleToggleSound}
              onToggleMusic={handleToggleMusic}
              onChangeSfxVolume={handleChangeSfxVolume}
              onChangeMusicVolume={handleChangeMusicVolume}
              onToggleColorblind={handleToggleColorblind}
              onOpenLevelSelect={() => {
                audioManager.playButtonTap();
                setIsLevelSelectOpen(true);
              }}
              onReturnToMainMenu={() => {
                audioManager.playButtonTap();
                clearAllTransitTimers();
                setVisualEffects([]);
                setScreenMode('MAIN_MENU');
              }}
            />
          </>
        )}

        {/* 8. 100-Level Transit Map & In-App Test Verifier Modal */}
        <LevelSelectModal
          isOpen={isLevelSelectOpen}
          currentLevel={gameState.levelNumber}
          unlockedLevel={saveData.unlockedLevel}
          starsByLevel={saveData.starsByLevel}
          qaUnlockAll={saveData.qaUnlockAllLevels}
          onSelectLevel={loadSpecificLevel}
          onToggleQaUnlockAll={() => {
            audioManager.playButtonTap();
            setSaveData((prev) => {
              const updated = {
                ...prev,
                qaUnlockAllLevels: !prev.qaUnlockAllLevels,
              };
              saveDataRef.current = updated;
              savePlayerData(updated);
              return updated;
            });
          }}
          onClose={() => {
            audioManager.playButtonTap();
            setIsLevelSelectOpen(false);
          }}
        />
      </div>
    </div>
  );
}
