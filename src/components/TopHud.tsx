import React from 'react';
import { Coins, Home, MapPin, Pause, Play, RotateCcw } from 'lucide-react';
import { EnvironmentThemeSpec } from '../assets/environmentThemes';
import { GameStatus } from '../game/types';

interface TopHudProps {
  levelNumber: number;
  themeSpec: EnvironmentThemeSpec;
  status: GameStatus;
  boardedCount: number;
  totalPassengers: number;
  coins: number;
  onReturnToMainMenu: () => void;
  onOpenLevelSelect: () => void;
  onTogglePause: () => void;
  onQuickRestart: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  levelNumber,
  themeSpec,
  status,
  boardedCount,
  totalPassengers,
  coins,
  onReturnToMainMenu,
  onOpenLevelSelect,
  onTogglePause,
  onQuickRestart,
}) => {
  const remainingPassengers = Math.max(0, totalPassengers - boardedCount);

  return (
    <header
      className="w-full px-2.5 pt-2 pb-1.5 border-b border-slate-800/90 flex items-center justify-between gap-1.5 shrink-0 select-none z-20"
      style={{ backgroundColor: themeSpec.hudSurfaceHex }}
    >
      {/* Zone 1: Home & Level Selector Trigger */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReturnToMainMenu}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 transition-transform flex items-center justify-center text-slate-200 border border-slate-700/80"
          aria-label="Main Menu"
          title="Main Menu"
        >
          <Home className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenLevelSelect}
          className="min-h-[44px] px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-800 active:scale-95 transition-transform flex items-center gap-1.5 text-left border border-slate-700/80"
          title="Open 100-Level Transit Map"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="leading-tight">
            <div className="text-xs font-bold text-white whitespace-nowrap tabular-nums">
              Lv. {levelNumber}{' '}
              <span className="text-slate-400 font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[88px]">
              {themeSpec.name}
            </div>
          </div>
        </button>
      </div>

      {/* Zone 2: Passenger Counter & Coin Telemetry (Unboxed clean metrics with separators) */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 tabular-nums">
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] text-slate-400 font-medium">Waiting</span>
          <span className="text-xs font-extrabold text-white tabular-nums">
            {remainingPassengers}
            <span className="text-slate-500 text-[10px]">/{totalPassengers}</span>
          </span>
        </div>
        <span className="text-slate-700" aria-hidden="true">
          ·
        </span>
        <div className="flex items-center gap-1 text-amber-400 font-extrabold tabular-nums">
          <Coins className="w-3.5 h-3.5 shrink-0" />
          <span>{coins}</span>
        </div>
      </div>

      {/* Zone 3: Quick Restart & Pause Controls (>= 44x44px touch targets) */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onQuickRestart}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 transition-transform flex items-center justify-center text-slate-200 border border-slate-700/80"
          aria-label="Restart Level"
          title="Restart Level"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 transition-transform flex items-center justify-center text-slate-200 border border-slate-700/80"
          aria-label={status === 'PAUSED' ? 'Resume Game' : 'Pause Game'}
          title={status === 'PAUSED' ? 'Resume Game' : 'Pause Game'}
        >
          {status === 'PAUSED' ? (
            <Play className="w-4 h-4 text-emerald-400" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
