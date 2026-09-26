import React from 'react';
import { COLOR_PALETTE } from '../assets/colorPalette';
import { EnvironmentThemeSpec } from '../assets/environmentThemes';
import { PassengerToken } from '../assets/vehicleSprites';
import { ActivePassengerBoardingAnim } from '../game/animationEngine';
import { Passenger } from '../game/types';

interface PassengerQueueViewProps {
  queue: Passenger[];
  activeBoardingAnims: ActivePassengerBoardingAnim[];
  showSymbols: boolean;
  themeSpec: EnvironmentThemeSpec;
}

export const PassengerQueueView: React.FC<PassengerQueueViewProps> = ({
  queue,
  activeBoardingAnims,
  showSymbols,
  themeSpec,
}) => {
  const frontPassenger = queue[0];
  const visibleUpcoming = queue.slice(1, 13);
  const overflowCount = Math.max(0, queue.length - 13);
  const activeWalkingPax = activeBoardingAnims[0];

  return (
    <section
      className="w-full px-3 py-1.5 border-b border-slate-800/80 shrink-0 select-none relative"
      style={{ backgroundColor: themeSpec.sidewalkBgHex }}
      aria-label="Passenger Boarding Queue"
    >
      <div className="flex items-center gap-2.5">
        {/* Active Boarding Gate (Front Passenger + Walking to Door Indicator) */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-slate-700/80 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-400">
              {activeWalkingPax ? 'Boarding Bus' : 'Boarding Gate'}
            </span>
            <span className="text-xs font-bold text-white whitespace-nowrap">
              {activeWalkingPax
                ? `${COLOR_PALETTE[activeWalkingPax.passengerColor].name.split(' ')[0]} → Door`
                : frontPassenger
                ? COLOR_PALETTE[frontPassenger.color].name.split(' ')[0]
                : 'Cleared'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-600 flex items-center justify-center relative">
            {activeWalkingPax ? (
              <div
                style={{
                  transform: `translate3d(0, ${
                    -Math.round(activeWalkingPax.progress * 6)
                  }px, 0) scale(${1 - activeWalkingPax.progress * 0.15})`,
                }}
                className="transition-transform duration-75"
              >
                <PassengerToken
                  color={activeWalkingPax.passengerColor}
                  isFront={true}
                  isWalking={true}
                  showSymbol={showSymbols}
                  size="md"
                />
              </div>
            ) : frontPassenger ? (
              <PassengerToken
                color={frontPassenger.color}
                isFront={true}
                showSymbol={showSymbols}
                size="md"
              />
            ) : (
              <span className="text-xs text-emerald-400 font-bold">✓</span>
            )}
          </div>
        </div>

        {/* Sidewalk FIFO Queue Snake */}
        <div className="flex-1 overflow-hidden">
          <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
            <span>Sidewalk Queue (FIFO)</span>
            <span className="tabular-nums text-slate-300 font-medium">
              {queue.length} waiting
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-h-[28px] overflow-hidden">
            {visibleUpcoming.map((pax) => (
              <PassengerToken
                key={pax.id}
                color={pax.color}
                showSymbol={showSymbols}
                size="sm"
              />
            ))}
            {overflowCount > 0 && (
              <span className="text-[11px] font-bold text-slate-300 pl-1 whitespace-nowrap tabular-nums">
                +{overflowCount}
              </span>
            )}
            {queue.length === 0 && !activeWalkingPax && (
              <span className="text-xs text-emerald-400 font-semibold">
                All passengers boarded!
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
