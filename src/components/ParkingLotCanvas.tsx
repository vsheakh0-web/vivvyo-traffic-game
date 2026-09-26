import React, { useEffect, useMemo, useState } from 'react';
import { Construction, Smartphone } from 'lucide-react';
import { EnvironmentThemeSpec } from '../assets/environmentThemes';
import {
  OpenTopVehicleVisual,
  VehicleMasterMeshAtlas,
} from '../assets/vehicleSprites';
import {
  buildInstancedVehicleScene,
   ConsolidatedMaterialBatch,
} from '../game/instancedVehicleRenderer';
import {
  BlockedMoveFeedback,
  GridObstacle,
  Vehicle,
  VehicleKinematics,
} from '../game/types';

interface ParkingLotCanvasProps {
  gridWidth: number;
  gridHeight: number;
  vehicles: Vehicle[];
  obstacles: GridObstacle[];
  kinematicsByVehicleId: Record<string, VehicleKinematics>;
  themeSpec: EnvironmentThemeSpec;
  selectedVehicleId: string | null;
  blockedFeedback: BlockedMoveFeedback | null;
  showSymbols: boolean;
  activeBoosterMode: 'NONE' | 'VIP_SELECT';
  onSelectVehicle: (vehicleId: string) => void;
}

/**
 * Instanced 3D/2.5D Parking Lot Board Renderer (`.parking-lot-canvas-element`).
 *
 * Refactored Vehicle Rendering Pipeline:
 * 1. Shared Geometry Buffers (`SHARED_GEOMETRY_BUFFER_REGISTRY` + `<VehicleMasterMeshAtlas />`):
 *    All 5 vehicle archetypes (Luxury SUV, GT Sport Coupe, Touring Hatchback, Executive Minibus,
 *    and Double-Axle Coach Bus) and shared 4/6-axle sub-meshes are buffered once in `<defs>`.
 * 2. Consolidated Material Instances (`CONSOLIDATED_MATERIAL_REGISTRY` + `materialBatches`):
 *    Vehicles are grouped by material batch (`<g className={matBatch.material.cssClassName}>`)
 *    inside a single unified scene-space `<svg>` buffer so material custom properties (`--v-body`,
 *    `--v-roof`, `--v-trim`, `--v-well`) are bound once per color batch rather than per vehicle.
 * 3. Lightweight Hit-Target Overlays (`sharedBufferLinked={true}`):
 *    Per-vehicle DOM buttons only render the lightweight cabin seat matrix and selection ring,
 *    eliminating per-vehicle `<svg>` root allocations and shadow filter passes.
 */
export const ParkingLotCanvas: React.FC<ParkingLotCanvasProps> = React.memo(
  ({
    gridWidth,
    gridHeight,
    vehicles,
    obstacles,
    kinematicsByVehicleId,
    themeSpec,
    selectedVehicleId,
    blockedFeedback,
    showSymbols,
    activeBoosterMode,
    onSelectVehicle,
  }) => {
    const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
      w: typeof window !== 'undefined' ? window.innerWidth : 390,
      h: typeof window !== 'undefined' ? window.innerHeight : 844,
    }));

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleResize = () => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const baseCellPx =
      gridHeight >= 10
        ? 32
        : gridHeight >= 9
        ? 35
        : gridWidth >= 8
        ? 39
        : gridWidth >= 7
        ? 44
        : 48;

    const effectiveWidth = Math.min(430, viewport.w);
    const maxCellByWidth = Math.floor((effectiveWidth - 48) / gridWidth);
    const maxCellByHeight = Math.floor(
      Math.max(180, viewport.h - 315) / gridHeight
    );
    const cellPx = Math.max(
      24,
      Math.min(baseCellPx, maxCellByWidth, maxCellByHeight)
    );

    const boardWidthPx = gridWidth * cellPx;
    const boardHeightPx = gridHeight * cellPx;
    const isShortLandscape = viewport.w > viewport.h && viewport.h < 460;

    // Build Instanced Scene Graph with Shared Geometry Buffers & Consolidated Material Batches
    const instancedScene = useMemo(
      () =>
        buildInstancedVehicleScene({
          vehicles,
          obstacles,
          kinematicsByVehicleId,
          selectedVehicleId,
          blockedFeedback,
          cellPx,
          baseHeadlightOpacity: themeSpec.headlightBeamOpacity,
        }),
      [
        vehicles,
        obstacles,
        kinematicsByVehicleId,
        selectedVehicleId,
        blockedFeedback,
        cellPx,
        themeSpec.headlightBeamOpacity,
      ]
    );

    const activeMaterialBatches = useMemo(
      () =>
        Object.values(instancedScene.materialBatches).filter(
          (b): b is ConsolidatedMaterialBatch => Boolean(b && b.instances.length > 0)
        ),
      [instancedScene.materialBatches]
    );

    // Single GPU-composited background pattern replacing 36..90 child DOM grid cells
    const gridBackgroundStyle = useMemo(
      () => ({
        width: `${boardWidthPx}px`,
        height: `${boardHeightPx}px`,
        backgroundColor: themeSpec.lotAsphaltHex,
        borderColor: themeSpec.roadBorderHex,
        backgroundImage: `
          radial-gradient(circle, ${themeSpec.lotDotHex} 1.5px, transparent 1.5px),
          linear-gradient(to right, ${themeSpec.lotGridLineHex} 1px, transparent 1px),
          linear-gradient(to bottom, ${themeSpec.lotGridLineHex} 1px, transparent 1px)
        `,
        backgroundSize: `${cellPx}px ${cellPx}px`,
        backgroundPosition: '0 0',
      }),
      [boardWidthPx, boardHeightPx, cellPx, themeSpec]
    );

    return (
      <main
        className="parking-lot-canvas-element flex-1 w-full flex flex-col items-center justify-center px-2 py-1 overflow-hidden select-none relative"
        aria-label="Bus Jam Parking Lot Board"
        data-instanced-draw-calls={instancedScene.metrics.instancedDrawCalls}
        data-active-material-batches={instancedScene.metrics.activeMaterialBatches}
        data-shared-geometry-buffers={instancedScene.metrics.sharedMeshPrototypesCount}
        data-draw-call-reduction={`${instancedScene.metrics.drawCallReductionPercent}%`}
      >
        {/* Mount Shared SVG Geometry Buffer & Consolidated Material Atlas Once */}
        <VehicleMasterMeshAtlas />

        {isShortLandscape && (
          <div className="mb-1 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 text-[10px] font-bold text-amber-200 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Best experienced in Portrait orientation</span>
          </div>
        )}

        {/* Environment-Themed Perimeter Transit Road Frame */}
        <div
          className="relative rounded-3xl p-3 border-2 shadow-2xl flex items-center justify-center transition-colors duration-300"
          style={{
            backgroundColor: themeSpec.roadSurfaceHex,
            borderColor: themeSpec.roadBorderHex,
            boxShadow:
              'inset 0 2px 12px rgba(0,0,0,0.65), 0 10px 25px rgba(0,0,0,0.45)',
          }}
        >
          {/* Perimeter Road Dashed Centerline */}
          <div
            className="absolute inset-1.5 rounded-2xl border border-dashed pointer-events-none"
            style={{ borderColor: themeSpec.roadCenterlineHex }}
          />

          {/* Inner Asphalt Parking Grid */}
          <div
            className="relative rounded-2xl border overflow-visible transition-colors duration-300"
            style={gridBackgroundStyle}
          >
            {/* PASS 1: Unified Scene-Space SVG Buffer (Ground Shadows, Headlight Cones & Consolidated Material Vehicle Geometry) */}
            <svg
              width={boardWidthPx}
              height={boardHeightPx}
              viewBox={`0 0 ${boardWidthPx} ${boardHeightPx}`}
              className="parking-lot-shared-geometry-buffer absolute inset-0 pointer-events-none z-0 overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="batched-headlight-up"
                  x1="0%"
                  y1="100%"
                  x2="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="batched-headlight-down"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="batched-headlight-left"
                  x1="100%"
                  y1="0%"
                  x2="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="batched-headlight-right"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 1A. Batched Ground Contact Shadows & Headlight Cones */}
              <g data-layer="batched-ground-shadows-and-lights">
                {instancedScene.groundShadowsAndLights.map((item) => {
                  const halfW = item.widthPx * 0.5;
                  const halfH = item.heightPx * 0.5;
                  const x = item.centerXPx - halfW;
                  const y = item.centerYPx - halfH;
                  const rotTransform =
                    item.rotationDeg !== 0
                      ? `rotate(${item.rotationDeg} ${item.centerXPx} ${item.centerYPx})`
                      : undefined;

                  const showBeam =
                    item.isMoving || item.headlightOpacity > 0.22;

                  return (
                    <g key={`sh-${item.vehicleId}`} transform={rotTransform}>
                      <rect
                        x={x + 1.5}
                        y={y + 3.5}
                        width={item.widthPx}
                        height={item.heightPx}
                        rx={10}
                        fill="rgba(2, 6, 23, 0.55)"
                      />
                      {showBeam && item.facingDir === 'UP' && (
                        <rect
                          x={x + item.widthPx * 0.14}
                          y={y - 11}
                          width={item.widthPx * 0.72}
                          height={12}
                          fill="url(#batched-headlight-up)"
                          opacity={item.headlightOpacity}
                        />
                      )}
                      {showBeam && item.facingDir === 'DOWN' && (
                        <rect
                          x={x + item.widthPx * 0.14}
                          y={y + item.heightPx - 1}
                          width={item.widthPx * 0.72}
                          height={12}
                          fill="url(#batched-headlight-down)"
                          opacity={item.headlightOpacity}
                        />
                      )}
                      {showBeam && item.facingDir === 'LEFT' && (
                        <rect
                          x={x - 11}
                          y={y + item.heightPx * 0.14}
                          width={12}
                          height={item.heightPx * 0.72}
                          fill="url(#batched-headlight-left)"
                          opacity={item.headlightOpacity}
                        />
                      )}
                      {showBeam && item.facingDir === 'RIGHT' && (
                        <rect
                          x={x + item.widthPx - 1}
                          y={y + item.heightPx * 0.14}
                          width={12}
                          height={item.heightPx * 0.72}
                          fill="url(#batched-headlight-right)"
                          opacity={item.headlightOpacity}
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* 1B. Consolidated Material Batches -> Shared Geometry Buffer Instances */}
              <g data-layer="consolidated-material-geometry-batches">
                {activeMaterialBatches.map((matBatch) => (
                  <g
                    key={matBatch.materialId}
                    className={matBatch.material.cssClassName}
                    data-material-batch={matBatch.materialId}
                  >
                    {matBatch.instances.map((inst) => {
                      const isHorizontal =
                        inst.vehicle.direction === 'LEFT' ||
                        inst.vehicle.direction === 'RIGHT';
                      const unrotatedW = isHorizontal
                        ? inst.heightPx
                        : inst.widthPx;
                      const unrotatedH = isHorizontal
                        ? inst.widthPx
                        : inst.heightPx;
                      const drawX = inst.centerXPx - unrotatedW * 0.5;
                      const drawY = inst.centerYPx - unrotatedH * 0.5;
                      const rotTransform =
                        inst.facingHeadingDeg !== 0
                          ? `rotate(${inst.facingHeadingDeg} ${inst.centerXPx} ${inst.centerYPx})`
                          : undefined;

                      return (
                        <use
                          key={`geom-${inst.vehicle.id}`}
                          href={`#${inst.geometryBuffer.meshSymbolId}`}
                          x={drawX}
                          y={drawY}
                          width={unrotatedW}
                          height={unrotatedH}
                          transform={rotTransform}
                        />
                      );
                    })}
                  </g>
                ))}
              </g>
            </svg>

            {/* PASS 2: Static Environment Obstacles */}
            {obstacles.map((obs) => (
              <div
                key={obs.id}
                style={{
                  position: 'absolute',
                  left: `${obs.x * cellPx + 3}px`,
                  top: `${obs.y * cellPx + 3}px`,
                  width: `${cellPx - 6}px`,
                  height: `${cellPx - 6}px`,
                  backgroundColor:
                    blockedFeedback?.blockerObstacleId === obs.id
                      ? '#881337'
                      : themeSpec.obstacleBadgeHex,
                  borderColor:
                    blockedFeedback?.blockerObstacleId === obs.id
                      ? '#FB7185'
                      : themeSpec.obstacleBorderHex,
                }}
                className={`rounded-lg border-2 flex items-center justify-center shadow-md pointer-events-none transition-transform z-10 ${
                  blockedFeedback?.blockerObstacleId === obs.id
                    ? 'scale-110'
                    : ''
                }`}
                title="Traffic Barrier"
              >
                <Construction className="w-4 h-4 text-amber-300" />
              </div>
            ))}

            {/* PASS 3: Lightweight Parked Vehicle Hit-Target & Cabin Seat Overlays (`sharedBufferLinked={true}`) */}
            {instancedScene.parkedInstances.map((inst) => {
              const { vehicle } = inst;
              const variantLabel =
                inst.carVariant === 'LUXURY_SUV'
                  ? 'luxury SUV'
                  : inst.carVariant === 'SPORT_COUPE'
                  ? 'sport coupe'
                  : inst.carVariant === 'TOURING_HATCH'
                  ? 'touring hatchback'
                  : vehicle.capacity === 6
                  ? 'executive minibus'
                  : 'city coach bus';

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectVehicle(vehicle.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${inst.leftPx}px`,
                    top: `${inst.topPx}px`,
                    width: `${inst.widthPx}px`,
                    height: `${inst.heightPx}px`,
                    transform: inst.isBlockedTarget
                      ? `translate3d(${inst.translateXPx}px, ${inst.translateYPx}px, 0)`
                      : inst.isSelected
                      ? 'scale(1.03)'
                      : undefined,
                    touchAction: 'manipulation',
                  }}
                  className={`p-0 bg-transparent border-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl transition-transform duration-150 z-10 ${
                    activeBoosterMode === 'VIP_SELECT'
                      ? 'ring-2 ring-amber-400/90 animate-pulse'
                      : ''
                  }`}
                  aria-label={`${vehicle.color} ${variantLabel} capacity ${vehicle.capacity} facing ${vehicle.direction}`}
                >
                  <OpenTopVehicleVisual
                    vehicle={vehicle}
                    showSymbol={showSymbols}
                    isSelected={inst.isSelected}
                    isBlockedTarget={inst.isBlockedTarget}
                    isBlockerHighlight={inst.isBlockerHighlight}
                    kinematics={kinematicsByVehicleId[vehicle.id]}
                    headlightBeamOpacity={themeSpec.headlightBeamOpacity}
                    instancedMode={true}
                    sharedBufferLinked={true}
                  />
                </button>
              );
            })}

            {/* PASS 4: Lightweight Moving Vehicle Cabin Overlays (`sharedBufferLinked={true}`) */}
            {instancedScene.movingInstances.map((inst) => {
              const { vehicle } = inst;
              return (
                <div
                  key={vehicle.id}
                  style={{
                    position: 'absolute',
                    left: `${inst.leftPx}px`,
                    top: `${inst.topPx}px`,
                    width: `${inst.widthPx}px`,
                    height: `${inst.heightPx}px`,
                    transform: `translate3d(${inst.translateXPx}px, ${inst.translateYPx}px, 0) rotate(${inst.rotationDeg}deg)`,
                  }}
                  className="pointer-events-none z-30"
                >
                  <OpenTopVehicleVisual
                    vehicle={vehicle}
                    showSymbol={showSymbols}
                    isSelected={true}
                    kinematics={kinematicsByVehicleId[vehicle.id]}
                    headlightBeamOpacity={Math.max(
                      0.55,
                      themeSpec.headlightBeamOpacity
                    )}
                    instancedMode={true}
                    sharedBufferLinked={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }
);
