import React from 'react';
import { Crown, Magnet, Play, Shuffle, XCircle } from 'lucide-react';
import { BOOSTER_COIN_COSTS } from '../game/storageManager';
import { BoosterType, GameStatus } from '../game/types';

interface BoosterDockProps {
  status: GameStatus;
  boosters: {
    VIP: number;
    PICK: number;
    SHUFFLE: number;
  };
  coins: number;
  activeBoosterMode: 'NONE' | 'VIP_SELECT';
  lastActionMessage: string | null;
  onStartReadyLevel: () => void;
  onUseVipBooster: () => void;
  onCancelVipBooster: () => void;
  onUsePickBooster: () => void;
  onUseShuffleBooster: () => void;
}

export const BoosterDock: React.FC<BoosterDockProps> = ({
  status,
  boosters,
  coins,
  activeBoosterMode,
  lastActionMessage,
  onStartReadyLevel,
  onUseVipBooster,
  onCancelVipBooster,
  onUsePickBooster,
  onUseShuffleBooster,
}) => {
  const canAfford = (type: BoosterType) =>
    boosters[type] > 0 || coins >= BOOSTER_COIN_COSTS[type];

  const renderCountOrPrice = (type: BoosterType) => {
    const count = boosters[type];
    if (count > 0) {
      return (
        <span className="text-[11px] font-bold text-emerald-300 tabular-nums">
          {count} left
        </span>
      );
    }
    const cost = BOOSTER_COIN_COSTS[type];
    return (
      <span
        className={`text-[11px] font-bold tabular-nums ${
          coins >= cost ? 'text-amber-300' : 'text-rose-400'
        }`}
      >
        {cost}c
      </span>
    );
  };

  return (
    <footer className="w-full px-3 pt-1.5 pb-3 bg-slate-900/95 border-t border-slate-800 shrink-0 select-none z-20">
      {/* Feedback & Active Mode Cancel Banner */}
      <div className="min-h-[22px] mb-1.5 flex items-center justify-between gap-2 text-center">
        {status === 'READY' ? (
          <button
            type="button"
            onClick={onStartReadyLevel}
            className="mx-auto px-3 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shadow"
          >
            <Play className="w-3 h-3" /> Tap any unblocked bus or Start
          </button>
        ) : activeBoosterMode === 'VIP_SELECT' ? (
          <div className="w-full flex items-center justify-between gap-2 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/60">
            <span className="text-[11px] font-bold text-amber-200 truncate">
              VIP Mode: Tap any lot or bay bus to airlift
            </span>
            <button
              type="button"
              onClick={onCancelVipBooster}
              className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 text-amber-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0"
            >
              <XCircle className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <span className="mx-auto text-[11px] font-medium text-slate-300 truncate max-w-full">
            {lastActionMessage ||
              'Tap an unblocked bus to drive it to a Parking Bay'}
          </span>
        )}
      </div>

      {/* 3 Primary Boosters in Ergonomic Thumb Zone (>= 48px height) */}
      <div className="grid grid-cols-3 gap-2">
        {/* 1. VIP Booster */}
        <button
          type="button"
          onClick={onUseVipBooster}
          className={`min-h-[48px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition-all active:scale-95 ${
            activeBoosterMode === 'VIP_SELECT'
              ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400'
              : canAfford('VIP')
              ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-100'
              : 'bg-slate-900/70 border-slate-800 text-slate-400 opacity-75'
          }`}
          aria-label="VIP Booster"
        >
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-xs font-bold whitespace-nowrap">
                {activeBoosterMode === 'VIP_SELECT' ? 'Cancel VIP' : 'VIP Slot'}
              </div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                Airlift bus
              </div>
            </div>
          </div>
          {renderCountOrPrice('VIP')}
        </button>

        {/* 2. PICK Booster */}
        <button
          type="button"
          onClick={onUsePickBooster}
          className={`min-h-[48px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition-all active:scale-95 ${
            canAfford('PICK')
              ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-100'
              : 'bg-slate-900/70 border-slate-800 text-slate-400 opacity-75'
          }`}
          aria-label="Pick Booster"
        >
          <div className="flex items-center gap-1.5">
            <Magnet className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-xs font-bold whitespace-nowrap">Pick</div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                Fill bay bus
              </div>
            </div>
          </div>
          {renderCountOrPrice('PICK')}
        </button>

        {/* 3. SHUFFLE Booster */}
        <button
          type="button"
          onClick={onUseShuffleBooster}
          className={`min-h-[48px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition-all active:scale-95 ${
            canAfford('SHUFFLE')
              ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-100'
              : 'bg-slate-900/70 border-slate-800 text-slate-400 opacity-75'
          }`}
          aria-label="Shuffle Booster"
        >
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="text-left leading-tight">
              <div className="text-xs font-bold whitespace-nowrap">Shuffle</div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                Swap colors
              </div>
            </div>
          </div>
          {renderCountOrPrice('SHUFFLE')}
        </button>
      </div>
    </footer>
  );
};
