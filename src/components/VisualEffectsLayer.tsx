import React from 'react';
import { VisualEffectItem } from '../game/types';

interface VisualEffectsLayerProps {
  effects: VisualEffectItem[];
}

/**
 * Lightweight, compositor-only (transform + opacity) visual effects layer
 * for vehicle movement trails, bay stop indicators, passenger boarding pops,
 * full-bus match badges, booster activations, coin collection, victory, and failure.
 * Strictly enforces `pointer-events-none` so mobile touch input is never blocked.
 */
export const VisualEffectsLayer: React.FC<VisualEffectsLayerProps> = React.memo(
  ({ effects }) => {
    if (effects.length === 0) return null;

    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden z-30 select-none"
        aria-hidden="true"
      >
        {effects.map((fx) => (
          <div
            key={fx.id}
            style={{
              position: 'absolute',
              left: `${fx.xPercent}%`,
              top: `${fx.yPercent}%`,
              transform: 'translate3d(-50%, -50%, 0)',
            }}
            className="pointer-events-none animate-bounce"
          >
            {fx.type === 'VEHICLE_MOVE_TRAIL' && (
              <div className="flex items-center gap-1 opacity-80">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: fx.colorHex }}
                />
                <span className="text-[9px] font-extrabold text-white drop-shadow">
                  {fx.label || 'GO!'}
                </span>
              </div>
            )}

            {fx.type === 'VEHICLE_STOP_BRAKE' && (
              <div className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-amber-300/70 text-[9px] font-bold text-amber-200 shadow-sm whitespace-nowrap">
                {fx.label || 'PARKED'}
              </div>
            )}

            {fx.type === 'PASSENGER_BOARD_POP' && (
              <div
                className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold text-white shadow-md whitespace-nowrap"
                style={{
                  backgroundColor: fx.colorHex,
                  border: '1px solid rgba(255,255,255,0.65)',
                }}
              >
                {fx.label || '+1'}
              </div>
            )}

            {fx.type === 'BUS_FULL_MATCH' && (
              <div
                className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold text-white shadow-lg whitespace-nowrap ring-2 ring-white/80"
                style={{
                  backgroundColor: fx.colorHex,
                }}
              >
                {fx.label || 'FULL BUS!'}
              </div>
            )}

            {fx.type === 'VEHICLE_DEPART_PUFF' && (
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300/60 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-slate-400/50" />
              </div>
            )}

            {fx.type === 'BOOSTER_FLASH' && (
              <div
                className="px-2.5 py-1 rounded-xl text-xs font-extrabold text-slate-950 shadow-xl whitespace-nowrap"
                style={{
                  backgroundColor: fx.colorHex,
                  boxShadow: `0 0 16px ${fx.colorHex}`,
                }}
              >
                {fx.label || 'BOOSTER!'}
              </div>
            )}

            {fx.type === 'COIN_COLLECT' && (
              <div className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg whitespace-nowrap">
                {fx.label || '+Coins'}
              </div>
            )}

            {fx.type === 'LEVEL_COMPLETE_BURST' && (
              <div className="px-3 py-1 rounded-xl bg-emerald-500 text-white text-xs font-extrabold shadow-xl ring-2 ring-amber-300 whitespace-nowrap">
                {fx.label || 'CLEARED!'}
              </div>
            )}

            {fx.type === 'LEVEL_FAILED_ALERT' && (
              <div className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-xl ring-2 ring-rose-300 whitespace-nowrap">
                {fx.label || 'BAY JAMMED!'}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);
