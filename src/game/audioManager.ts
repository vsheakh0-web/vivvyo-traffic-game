import { BoosterType } from './types';

export type SoundCueType =
  | 'BUTTON_TAP'
  | 'VEHICLE_MOVE'
  | 'VEHICLE_STOP'
  | 'PASSENGER_BOARD'
  | 'SUCCESSFUL_MATCH'
  | 'BOOSTER_ACTIVATE'
  | 'COIN_COLLECT'
  | 'LEVEL_COMPLETE'
  | 'LEVEL_FAILURE'
  | 'BLOCKED_HORN';

export interface AudioDiagnostics {
  enabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
  isPaused: boolean;
  triggeredCounts: Record<SoundCueType, number>;
  throttledDuplicatesSkipped: number;
  mutedSkips: number;
}

const CUE_COOLDOWN_MS: Record<SoundCueType, number> = {
  BUTTON_TAP: 35,
  VEHICLE_MOVE: 55,
  VEHICLE_STOP: 60,
  PASSENGER_BOARD: 45,
  SUCCESSFUL_MATCH: 85,
  BOOSTER_ACTIVATE: 90,
  COIN_COLLECT: 65,
  LEVEL_COMPLETE: 250,
  LEVEL_FAILURE: 250,
  BLOCKED_HORN: 95,
};

function createEmptyCounts(): Record<SoundCueType, number> {
  return {
    BUTTON_TAP: 0,
    VEHICLE_MOVE: 0,
    VEHICLE_STOP: 0,
    PASSENGER_BOARD: 0,
    SUCCESSFUL_MATCH: 0,
    BOOSTER_ACTIVATE: 0,
    COIN_COLLECT: 0,
    LEVEL_COMPLETE: 0,
    LEVEL_FAILURE: 0,
    BLOCKED_HORN: 0,
  };
}

/**
 * Procedural Web Audio API sound effects & mixing engine for Bus Jam Mobile.
 * - Supports all 9 required gameplay and UI sound cues.
 * - Provides independent SFX and Music/Ambience volume & mute controls.
 * - Enforces per-cue cooldown deduplication and polyphony limits so overlapping sounds never clip.
 * - Respects game pause and Android background lifecycle states.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private musicEnabled: boolean = true;
  private sfxVolume: number = 0.85;
  private musicVolume: number = 0.45;
  private isPaused: boolean = false;
  private activeVoiceCount: number = 0;
  private readonly maxConcurrentVoices: number = 6;

  private lastCueTimestamp: Partial<Record<SoundCueType, number>> = {};
  private triggeredCounts: Record<SoundCueType, number> = createEmptyCounts();
  private throttledDuplicatesSkipped: number = 0;
  private mutedSkips: number = 0;

  public setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = Boolean(enabled);
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setSfxVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.sfxVolume = Math.max(0, Math.min(1, Number(volume.toFixed(2))));
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setMusicVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.musicVolume = Math.max(0, Math.min(1, Number(volume.toFixed(2))));
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = Boolean(paused);
    if (this.ctx) {
      if (this.isPaused && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      } else if (!this.isPaused && this.enabled && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  public getDiagnostics(): AudioDiagnostics {
    return {
      enabled: this.enabled,
      musicEnabled: this.musicEnabled,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      isPaused: this.isPaused,
      triggeredCounts: { ...this.triggeredCounts },
      throttledDuplicatesSkipped: this.throttledDuplicatesSkipped,
      mutedSkips: this.mutedSkips,
    };
  }

  public resetDiagnostics(): void {
    this.triggeredCounts = createEmptyCounts();
    this.lastCueTimestamp = {};
    this.throttledDuplicatesSkipped = 0;
    this.mutedSkips = 0;
    this.isPaused = false;
  }

  /**
   * Validates whether a sound cue should play right now based on mute state,
   * pause state (only BUTTON_TAP is allowed while paused), and per-cue cooldown deduplication.
   */
  private canTriggerCue(cue: SoundCueType): boolean {
    if (!this.enabled || this.sfxVolume <= 0.001) {
      this.mutedSkips++;
      return false;
    }

    if (this.isPaused && cue !== 'BUTTON_TAP') {
      this.mutedSkips++;
      return false;
    }

    const nowMs =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastMs = this.lastCueTimestamp[cue];
    const cooldown = CUE_COOLDOWN_MS[cue] ?? 50;

    if (lastMs !== undefined && nowMs - lastMs < cooldown) {
      this.throttledDuplicatesSkipped++;
      return false;
    }

    this.lastCueTimestamp[cue] = nowMs;
    this.triggeredCounts[cue] = (this.triggeredCounts[cue] || 0) + 1;
    return true;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended' && !this.isPaused) {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private playTone(params: {
    type: OscillatorType;
    startFreq: number;
    endFreq?: number;
    durationSec: number;
    delaySec?: number;
    baseGain: number;
  }): void {
    const ctx = this.getContext();
    if (!ctx || this.activeVoiceCount >= this.maxConcurrentVoices) return;

    try {
      const delay = params.delaySec ?? 0;
      const now = ctx.currentTime + delay;
      const effectiveGain = Math.max(
        0.001,
        Math.min(0.4, params.baseGain * this.sfxVolume)
      );

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = params.type;
      osc.frequency.setValueAtTime(params.startFreq, now);
      if (params.endFreq && params.endFreq !== params.startFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          params.endFreq,
          now + params.durationSec * 0.9
        );
      }

      gain.gain.setValueAtTime(effectiveGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + params.durationSec);

      this.activeVoiceCount++;
      osc.onended = () => {
        this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
      };

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + params.durationSec + 0.01);
    } catch {
      // Ignore Web Audio errors
    }
  }

  // 1. Button Interaction
  public playButtonTap(): void {
    if (!this.canTriggerCue('BUTTON_TAP')) return;
    this.playTone({
      type: 'sine',
      startFreq: 540,
      endFreq: 720,
      durationSec: 0.045,
      baseGain: 0.09,
    });
  }

  // 2. Vehicle Movement (Engine rev & gear engagement)
  public playVehicleSelect(): void {
    this.playVehicleMove();
  }

  public playVehicleMove(): void {
    if (!this.canTriggerCue('VEHICLE_MOVE')) return;
    this.playTone({
      type: 'triangle',
      startFreq: 175,
      endFreq: 350,
      durationSec: 0.12,
      baseGain: 0.14,
    });
  }

  // 3. Vehicle Stopping (Soft pneumatic bay stop)
  public playVehicleStop(): void {
    if (!this.canTriggerCue('VEHICLE_STOP')) return;
    this.playTone({
      type: 'sine',
      startFreq: 260,
      endFreq: 140,
      durationSec: 0.075,
      baseGain: 0.1,
    });
  }

  // 4. Passenger Boarding (Ascending harmonic scale)
  public playPassengerBoard(seatIndex: number = 0): void {
    if (!this.canTriggerCue('PASSENGER_BOARD')) return;
    const scale = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5,
    ];
    const freq = scale[Math.max(0, Math.min(seatIndex, scale.length - 1))];
    this.playTone({
      type: 'sine',
      startFreq: freq * 0.92,
      endFreq: freq,
      durationSec: 0.08,
      baseGain: 0.13,
    });
  }

  // 5. Successful Matching & Full-Bus Departure
  public playBusDepart(): void {
    this.playSuccessfulMatch();
  }

  public playSuccessfulMatch(): void {
    if (!this.canTriggerCue('SUCCESSFUL_MATCH')) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone({
        type: 'triangle',
        startFreq: freq,
        durationSec: 0.13,
        delaySec: idx * 0.04,
        baseGain: 0.12,
      });
    });
  }

  // 6. Booster Activation (Distinct sweep per booster type)
  public playBoosterActivate(type?: BoosterType): void {
    if (!this.canTriggerCue('BOOSTER_ACTIVATE')) return;
    const startFreq = type === 'VIP' ? 440 : type === 'PICK' ? 392 : 349.23;
    const endFreq = type === 'VIP' ? 987.77 : type === 'PICK' ? 880 : 783.99;
    this.playTone({
      type: 'sine',
      startFreq,
      endFreq,
      durationSec: 0.19,
      baseGain: 0.15,
    });
  }

  // 7. Coin Collection (Metallic dual-chime clink)
  public playCoinCollect(): void {
    if (!this.canTriggerCue('COIN_COLLECT')) return;
    this.playTone({
      type: 'sine',
      startFreq: 1174.66,
      endFreq: 1567.98,
      durationSec: 0.09,
      baseGain: 0.12,
    });
    this.playTone({
      type: 'triangle',
      startFreq: 1567.98,
      endFreq: 2093.0,
      durationSec: 0.12,
      delaySec: 0.045,
      baseGain: 0.11,
    });
  }

  // 8. Level Completion (Victory fanfare)
  public playVictory(): void {
    if (!this.canTriggerCue('LEVEL_COMPLETE')) return;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((freq, idx) => {
      this.playTone({
        type: 'triangle',
        startFreq: freq,
        durationSec: 0.28,
        delaySec: idx * 0.065,
        baseGain: 0.14,
      });
    });
  }

  // 9. Level Failure & Blocked Horn
  public playFailure(): void {
    if (!this.canTriggerCue('LEVEL_FAILURE')) return;
    const notes = [330, 293.66, 261.63, 220];
    notes.forEach((freq, idx) => {
      this.playTone({
        type: 'sawtooth',
        startFreq: freq,
        durationSec: 0.17,
        delaySec: idx * 0.085,
        baseGain: 0.1,
      });
    });
  }

  public playBlockedHorn(): void {
    if (!this.canTriggerCue('BLOCKED_HORN')) return;
    [0, 0.085].forEach((offset) => {
      this.playTone({
        type: 'sawtooth',
        startFreq: 148,
        endFreq: 132,
        durationSec: 0.07,
        delaySec: offset,
        baseGain: 0.11,
      });
    });
  }
}

export const audioManager = new AudioManager();
