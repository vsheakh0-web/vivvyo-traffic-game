import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Crown,
  Eye,
  Home,
  Map,
  Music,
  Play,
  RotateCcw,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TOTAL_LEVELS } from '../game/levelGenerator';
import { GameStatus } from '../game/types';

interface ResultModalsProps {
  status: GameStatus;
  levelNumber: number;
  boardedCount: number;
  totalPassengers: number;
  moveCount: number;
  lastRewardCoins: number;
  lastRewardStars: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
  colorblindMode: boolean;
  canRecoverWithVip: boolean;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onRecoverWithVip: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onChangeSfxVolume: (vol: number) => void;
  onChangeMusicVolume: (vol: number) => void;
  onToggleColorblind: () => void;
  onOpenLevelSelect: () => void;
  onReturnToMainMenu: () => void;
}

export const ResultModals: React.FC<ResultModalsProps> = ({
  status,
  levelNumber,
  boardedCount,
  totalPassengers,
  moveCount,
  lastRewardCoins,
  lastRewardStars,
  soundEnabled,
  musicEnabled,
  sfxVolume,
  musicVolume,
  colorblindMode,
  canRecoverWithVip,
  onResume,
  onRestart,
  onNextLevel,
  onRecoverWithVip,
  onToggleSound,
  onToggleMusic,
  onChangeSfxVolume,
  onChangeMusicVolume,
  onToggleColorblind,
  onOpenLevelSelect,
  onReturnToMainMenu,
}) => {
  if (
    status !== 'PAUSED' &&
    status !== 'LEVEL_COMPLETED' &&
    status !== 'LEVEL_FAILED'
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[360px] bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-center max-h-[90dvh] overflow-y-auto">
        {/* 1. PAUSE MENU */}
        {status === 'PAUSED' && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Game Paused</h2>
            <p className="text-xs text-slate-400 mb-3.5 tabular-nums">
              Level {levelNumber} · {boardedCount}/{totalPassengers} Passengers Boarded
            </p>

            <div className="space-y-2 mb-4 text-left">
              {/* SFX Toggle & Volume Slider */}
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="flex items-center gap-2"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Sound Effects (SFX)</span>
                  </button>
                  <span
                    className={`tabular-nums font-bold ${
                      soundEnabled ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {soundEnabled ? `${Math.round(sfxVolume * 100)}%` : 'OFF'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sfxVolume * 100)}
                  onChange={(e) =>
                    onChangeSfxVolume(Number(e.target.value) / 100)
                  }
                  className="w-full accent-emerald-400 cursor-pointer h-1.5"
                  aria-label="Pause Menu SFX Volume"
                />
              </div>

              {/* Music Toggle & Volume Slider */}
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <button
                    type="button"
                    onClick={onToggleMusic}
                    className="flex items-center gap-2"
                  >
                    <Music
                      className={`w-4 h-4 ${
                        musicEnabled ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Transit Ambience / Music</span>
                  </button>
                  <span
                    className={`tabular-nums font-bold ${
                      musicEnabled ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    {musicEnabled ? `${Math.round(musicVolume * 100)}%` : 'OFF'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(musicVolume * 100)}
                  onChange={(e) =>
                    onChangeMusicVolume(Number(e.target.value) / 100)
                  }
                  className="w-full accent-amber-400 cursor-pointer h-1.5"
                  aria-label="Pause Menu Music Volume"
                />
              </div>

              <button
                type="button"
                onClick={onToggleColorblind}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  Colorblind Symbols
                </span>
                <span
                  className={colorblindMode ? 'text-sky-400 font-bold' : 'text-slate-500'}
                >
                  {colorblindMode ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenLevelSelect}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-amber-400" />
                  Level Selection Map
                </span>
                <span className="text-slate-400">Open</span>
              </button>

              <button
                type="button"
                onClick={onReturnToMainMenu}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-rose-400" />
                  Return to Main Menu
                </span>
                <span className="text-slate-400">Exit</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onRestart}
                className="min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={onResume}
                className="min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. VICTORY SCREEN */}
        {status === 'LEVEL_COMPLETED' && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-8 h-8 ${
                    s <= lastRewardStars
                      ? 'text-amber-400 fill-amber-400 drop-shadow'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <h2 className="text-xl font-extrabold text-white mb-1">
              Level {levelNumber} Complete!
            </h2>
            <p className="text-xs text-slate-400 mb-4 tabular-nums">
              All {totalPassengers} passengers boarded across {moveCount} buses!
            </p>

            <div className="py-3 px-4 rounded-2xl bg-slate-800/90 border border-slate-700 mb-5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                {lastRewardCoins > 0 ? 'Coins Earned' : 'Level Reward'}
              </span>
              {lastRewardCoins > 0 ? (
                <span className="text-base font-extrabold text-amber-400 flex items-center gap-1 tabular-nums">
                  <Coins className="w-4 h-4" /> +{lastRewardCoins}
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-400 tabular-nums">
                  Already Claimed (+0)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <button
                type="button"
                onClick={onRestart}
                className="min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Replay</span>
              </button>
              <button
                type="button"
                onClick={onNextLevel}
                className="min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-emerald-950/50"
              >
                <span>
                  {levelNumber < TOTAL_LEVELS
                    ? `Next Level (${levelNumber + 1})`
                    : 'Play Level 1'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onReturnToMainMenu}
              className="w-full min-h-[44px] rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Main Menu</span>
            </button>
          </div>
        )}

        {/* 3. FAILURE SCREEN */}
        {status === 'LEVEL_FAILED' && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-extrabold text-white mb-1">
              Out of Parking Space!
            </h2>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              All active parking bays are full and none of the parked vehicles match the next passenger waiting at the gate.
            </p>

            <div className="space-y-2.5">
              {canRecoverWithVip && (
                <button
                  type="button"
                  onClick={onRecoverWithVip}
                  className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Crown className="w-4 h-4" />
                  <span>Move 1 Bay Bus to VIP Slot & Continue</span>
                </button>
              )}

              <button
                type="button"
                onClick={onRestart}
                className="w-full min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Level {levelNumber}</span>
              </button>

              <button
                type="button"
                onClick={onOpenLevelSelect}
                className="w-full min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Map className="w-4 h-4 text-amber-400" />
                <span>Return to Level Menu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
