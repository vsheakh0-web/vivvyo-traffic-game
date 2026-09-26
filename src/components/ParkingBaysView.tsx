import React from 'react';
import { Crown, Lock } from 'lucide-react';
import { EnvironmentThemeSpec } from '../assets/environmentThemes';
import { OpenTopVehicleVisual } from '../assets/vehicleSprites';
import { EXTRA_BAY_COIN_COST } from '../game/storageManager';
import { ParkingBay, Vehicle, VehicleKinematics } from '../game/types';

interface ParkingBaysViewProps {
  bays: ParkingBay[];
  vehicles: Vehicle[];
  kinematicsByVehicleId: Record<string, VehicleKinematics>;
  themeSpec: EnvironmentThemeSpec;
  showSymbols: boolean;
  activeBoosterMode: 'NONE' | 'VIP_SELECT';
  coins: number;
  onSelectBayVehicleForVip: (vehicleId: string) => void;
  onUnlockExtraBay: () => void;
}

export const ParkingBaysView: React.FC<ParkingBaysViewProps> = ({
  bays,
  vehicles,
  kinematicsByVehicleId,
  themeSpec,
  showSymbols,
  activeBoosterMode,
  coins,
  onSelectBayVehicleForVip,
  onUnlockExtraBay,
}) => {
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const standardBays = bays.filter((b) => !b.isVip);
  const vipBay = bays.find((b) => b.isVip);

  const unlockedStandard = standardBays.filter((b) => b.isUnlocked);
  const nextLockedBay = standardBays.find((b) => !b.isUnlocked);

  return (
    <section
      className="w-full px-3 py-1.5 border-b border-slate-800 shrink-0 select-none"
      style={{ backgroundColor: themeSpec.bayBgHex }}
      aria-label="Transit Parking Bays"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
        <span className="tabular-nums">
          Parking Bays ({unlockedStandard.filter((b) => b.vehicleId !== null).length}/
          {unlockedStandard.length} Occupied)
        </span>
        {activeBoosterMode === 'VIP_SELECT' ? (
          <span className="text-amber-300 font-semibold animate-pulse">
            Tap any bay or lot bus for VIP Bay
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">
            Doors open for matching passengers
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {unlockedStandard.map((bay) => {
          const parkedVehicle = bay.vehicleId
            ? vehicleById.get(bay.vehicleId)
            : undefined;
          const reservedVehicle = bay.reservedByVehicleId
            ? vehicleById.get(bay.reservedByVehicleId)
            : undefined;
          const kin = parkedVehicle
            ? kinematicsByVehicleId[parkedVehicle.id]
            : undefined;
          const canShiftToVip =
            activeBoosterMode === 'VIP_SELECT' &&
            parkedVehicle &&
            vipBay &&
            !vipBay.vehicleId;

          return (
            <div
              key={bay.id}
              onClick={() => {
                if (canShiftToVip && parkedVehicle) {
                  onSelectBayVehicleForVip(parkedVehicle.id);
                }
              }}
              className={`relative h-14 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-1 transition-all ${
                parkedVehicle
                  ? 'border-slate-500 bg-slate-900/90'
                  : reservedVehicle
                  ? 'border-sky-400/70 bg-sky-950/35'
                  : 'border-slate-700/80 bg-slate-950/55'
              } ${
                canShiftToVip
                  ? 'cursor-pointer ring-2 ring-amber-400 scale-[1.03]'
                  : ''
              }`}
            >
              {parkedVehicle ? (
                <div className="w-full h-full flex flex-col items-center justify-between">
                  <div className="w-full h-8">
                    <OpenTopVehicleVisual
                      vehicle={parkedVehicle}
                      showSymbol={showSymbols}
                      compactBayView={true}
                      kinematics={kin}
                      headlightBeamOpacity={themeSpec.headlightBeamOpacity}
                    />
                  </div>
                  <div className="flex items-center gap-1 leading-none">
                    <span className="text-[10px] font-bold text-white tabular-nums">
                      {parkedVehicle.occupiedSeats}/{parkedVehicle.capacity}
                    </span>
                    {kin && kin.doorOpenProgress > 0.2 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-300"
                        title="Boarding Door Open"
                      />
                    )}
                  </div>
                </div>
              ) : reservedVehicle ? (
                <span className="text-[9px] font-bold text-sky-300 animate-pulse text-center leading-tight">
                  Arriving...
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                  P{bay.index + 1}
                </span>
              )}
            </div>
          );
        })}

        {/* Optional Next Expandable Bay Slot */}
        {nextLockedBay && (
          <button
            type="button"
            onClick={onUnlockExtraBay}
            disabled={coins < EXTRA_BAY_COIN_COST}
            className={`h-14 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-1 transition-transform active:scale-95 ${
              coins >= EXTRA_BAY_COIN_COST
                ? 'border-emerald-500/70 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/45'
                : 'border-slate-800 bg-slate-950/40 text-slate-600 opacity-70'
            }`}
            title={`Unlock extra parking bay for ${EXTRA_BAY_COIN_COST} coins`}
          >
            <Lock className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[9px] font-bold leading-none whitespace-nowrap tabular-nums">
              +{EXTRA_BAY_COIN_COST}c
            </span>
          </button>
        )}

        {/* Dedicated Golden VIP Bay */}
        {vipBay && (
          <div
            className={`relative h-14 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-1 ${
              vipBay.vehicleId
                ? 'border-amber-400 bg-amber-950/45'
                : 'border-amber-500/60 bg-amber-950/20'
            }`}
            title="VIP Parking Bay"
          >
            {vipBay.vehicleId && vehicleById.get(vipBay.vehicleId) ? (
              <div className="w-full h-full flex flex-col items-center justify-between">
                <div className="w-full h-8">
                  <OpenTopVehicleVisual
                    vehicle={vehicleById.get(vipBay.vehicleId)!}
                    showSymbol={showSymbols}
                    compactBayView={true}
                    kinematics={kinematicsByVehicleId[vipBay.vehicleId]}
                    headlightBeamOpacity={themeSpec.headlightBeamOpacity}
                  />
                </div>
                <span className="text-[10px] font-bold text-amber-300 tabular-nums leading-none">
                  {vehicleById.get(vipBay.vehicleId)!.occupiedSeats}/
                  {vehicleById.get(vipBay.vehicleId)!.capacity}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-amber-400/85">
                <Crown className="w-3.5 h-3.5 mb-0.5" />
                <span className="text-[9px] font-bold leading-none">VIP</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
