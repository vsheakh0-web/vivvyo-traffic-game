import React from 'react';
import { COLOR_PALETTE } from './colorPalette';
import {
  CONSOLIDATED_MATERIAL_REGISTRY,
  resolveCarModelVariant,
  resolveConsolidatedMaterial,
  resolveSharedGeometryBuffer,
} from '../game/instancedVehicleRenderer';
import {
  CarModelVariant,
  Direction,
  Vehicle,
  VehicleColor,
  VehicleKinematics,
} from '../game/types';

/**
 * Consolidated Material Instance CSS Rules generated once from `CONSOLIDATED_MATERIAL_REGISTRY`.
 * Binds material properties at the class/group level (`.v-mat-red`, `.v-mat-blue`, etc.)
 * to eliminate per-vehicle inline style object overhead.
 */
const CONSOLIDATED_MATERIAL_CSS = Object.values(CONSOLIDATED_MATERIAL_REGISTRY)
  .map(
    (mat) =>
      `.${mat.cssClassName}{--v-body:${mat.bodyHex};--v-roof:${mat.roofHex};--v-trim:${mat.trimHex};--v-well:${mat.seatWellHex};}`
  )
  .join('\n');

/**
 * Shared Master SVG Geometry Buffer & Consolidated Material Atlas (`<defs>`).
 *
 * Architecture:
 * 1. Shared Sub-Geometry Buffers (`#geom-buffer-axles-4`, `#geom-buffer-axles-6`, `#geom-buffer-wiper-pair`):
 *    Reused across multiple vehicle archetypes so wheel/tire and wiper vertices are buffered once.
 * 2. Shared Archetype Mesh Buffers (`#mesh-proto-car-luxury-suv`, `#mesh-proto-car-sport-coupe`,
 *    `#mesh-proto-car-touring-hatch`, `#mesh-proto-van-executive-minibus`, `#mesh-proto-bus-articulated-coach`).
 * 3. Consolidated Material Classes (`.v-mat-*`) and Shared Glass Shaders (`#mesh-glass-windshield`, `#mesh-glass-dark-tint`).
 */
export const VehicleMasterMeshAtlas: React.FC = React.memo(() => (
  <svg
    className="sr-only pointer-events-none fixed w-0 h-0 overflow-hidden"
    aria-hidden="true"
  >
    <style>{CONSOLIDATED_MATERIAL_CSS}</style>
    <defs>
      {/* Consolidated Glass Material Gradients */}
      <linearGradient
        id="mesh-glass-windshield"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.92" />
        <stop offset="38%" stopColor="#38BDF8" stopOpacity="0.68" />
        <stop offset="100%" stopColor="#0F172A" stopOpacity="0.95" />
      </linearGradient>

      <linearGradient
        id="mesh-glass-dark-tint"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#334155" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#0F172A" stopOpacity="0.96" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
      </linearGradient>

      {/* =====================================================================
          SHARED SUB-GEOMETRY BUFFERS (Axles, Tires & Wiper Assemblies)
         ===================================================================== */}
      {/* Shared 4-Wheel Axle Geometry Buffer (Reused by SUV, Coupe, Hatchback & Minibus) */}
      <g id="geom-buffer-axles-4">
        <rect
          x="4.5"
          y="26"
          width="9.5"
          height="29"
          rx="3.8"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="86"
          y="26"
          width="9.5"
          height="29"
          rx="3.8"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="4.5"
          y="138"
          width="9.5"
          height="31"
          rx="3.8"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="86"
          y="138"
          width="9.5"
          height="31"
          rx="3.8"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
      </g>

      {/* Shared 6-Wheel Double-Axle Geometry Buffer (Reused by Heavy Coach Buses) */}
      <g id="geom-buffer-axles-6">
        <rect
          x="3"
          y="20"
          width="10"
          height="26"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="87"
          y="20"
          width="10"
          height="26"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="122"
          width="10"
          height="24"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="87"
          y="122"
          width="10"
          height="24"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="152"
          width="10"
          height="24"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
        <rect
          x="87"
          y="152"
          width="10"
          height="24"
          rx="3.5"
          fill="#090D16"
          stroke="#475569"
          strokeWidth="1.5"
        />
      </g>

      {/* Shared Dual Windshield Wiper Geometry Buffer */}
      <path
        id="geom-buffer-wiper-pair"
        d="M 22 50 L 49 47 M 48 50 L 76 47"
        stroke="#020617"
        strokeWidth="2.3"
        strokeLinecap="round"
      />

      {/* =====================================================================
          1. LUXURY EXECUTIVE SUV / CROSSOVER (`#mesh-proto-car-luxury-suv`)
         ===================================================================== */}
      <symbol id="mesh-proto-car-luxury-suv" viewBox="0 0 100 200">
        <use href="#geom-buffer-axles-4" />

        <path
          d="M 22 10 Q 50 3 78 10 Q 92 18 92 42 L 93 158 Q 92 184 76 191 Q 50 196 24 191 Q 8 184 7 158 L 8 42 Q 8 18 22 10 Z"
          fill="var(--v-body, #2563EB)"
          stroke="var(--v-roof, #93C5FD)"
          strokeWidth="2.4"
        />
        <path
          d="M 18 44 Q 50 38 82 44 L 78 15 Q 50 9 22 15 Z"
          fill="var(--v-roof, #93C5FD)"
          fillOpacity="0.24"
        />
        <path
          d="M 27 42 L 31 15 M 50 40 L 50 13 M 73 42 L 69 15"
          stroke="var(--v-trim, #1E3A8A)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          d="M 30 9 Q 50 6 70 9 L 67 14 Q 50 11 33 14 Z"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        <path
          d="M 13 24 Q 16 12 28 11 L 25 20 Q 17 22 13 24 Z M 87 24 Q 84 12 72 11 L 75 20 Q 83 22 87 24 Z"
          fill="#FEF08A"
          stroke="#FFFFFF"
          strokeWidth="1"
        />
        <path
          d="M 9 58 L 1 53 Q 0 60 3 64 L 9 63 Z M 91 58 L 99 53 Q 100 60 97 64 L 91 63 Z"
          fill="var(--v-body, #2563EB)"
          stroke="var(--v-roof, #93C5FD)"
          strokeWidth="1.4"
        />
        <path
          d="M 16 45 Q 50 39 84 45 L 79 71 Q 50 67 21 71 Z"
          fill="url(#mesh-glass-windshield)"
          stroke="#E2E8F0"
          strokeWidth="1.4"
        />
        <circle
          cx="34"
          cy="59"
          r="5.8"
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
          opacity="0.65"
        />
        <rect
          x="44"
          y="53"
          width="12"
          height="7"
          rx="1.5"
          fill="#0F172A"
          opacity="0.45"
        />
        <path
          d="M 12 64 L 18 72 L 18 154 L 12 162 Z M 88 64 L 82 72 L 82 154 L 88 162 Z"
          fill="url(#mesh-glass-dark-tint)"
          stroke="#94A3B8"
          strokeWidth="0.9"
        />
        <path
          d="M 21 73 L 21 162 M 79 73 L 79 162"
          stroke="#E2E8F0"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M 22 164 Q 50 161 78 164 L 74 183 Q 50 187 26 183 Z"
          fill="url(#mesh-glass-dark-tint)"
          stroke="#94A3B8"
          strokeWidth="1.1"
        />
        <path
          d="M 50 151 L 47.5 160 L 52.5 160 Z"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="0.8"
        />
        <path
          d="M 12 176 Q 16 189 32 191 L 30 185 Q 19 183 15 174 Z M 88 176 Q 84 189 68 191 L 70 185 Q 81 183 85 174 Z"
          fill="#F43F5E"
          stroke="#FFE4E6"
          strokeWidth="0.8"
        />
      </symbol>

      {/* =====================================================================
          2. GT SPORT COUPE / FASTBACK (`#mesh-proto-car-sport-coupe`)
         ===================================================================== */}
      <symbol id="mesh-proto-car-sport-coupe" viewBox="0 0 100 200">
        <use href="#geom-buffer-axles-4" />

        <path
          d="M 26 11 Q 50 2 74 11 Q 91 22 91 48 L 89 102 L 92 154 Q 91 182 73 191 Q 50 197 27 191 Q 9 182 8 154 L 11 102 L 9 48 Q 9 22 26 11 Z"
          fill="var(--v-body, #EF4444)"
          stroke="var(--v-roof, #FCA5A5)"
          strokeWidth="2.4"
        />
        <path
          d="M 12 31 Q 14 15 27 12 L 23 27 Q 16 29 12 31 Z M 88 31 Q 86 15 73 12 L 77 27 Q 84 29 88 31 Z"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        <circle cx="19" cy="22" r="3.2" fill="#FEF08A" />
        <circle cx="81" cy="22" r="3.2" fill="#FEF08A" />
        <path
          d="M 38 54 L 42 15 M 62 54 L 58 15"
          stroke="var(--v-roof, #FCA5A5)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M 36 54 L 40 15 M 64 54 L 60 15"
          stroke="var(--v-trim, #991B1B)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M 10 64 L 1 59 Q 1 66 4 68 L 10 68 Z M 90 64 L 99 59 Q 99 66 96 68 L 90 68 Z"
          fill="#0F172A"
          stroke="#475569"
          strokeWidth="1"
        />
        <path
          d="M 16 54 Q 50 47 84 54 L 77 77 Q 50 72 23 77 Z"
          fill="url(#mesh-glass-dark-tint)"
          stroke="#CBD5E1"
          strokeWidth="1.4"
        />
        <path
          d="M 13 66 L 20 76 L 21 150 L 14 140 Z M 87 66 L 80 76 L 79 150 L 86 140 Z"
          fill="url(#mesh-glass-dark-tint)"
        />
        <path
          d="M 24 148 Q 50 145 76 148 L 74 173 Q 50 183 26 173 Z"
          fill="url(#mesh-glass-dark-tint)"
          stroke="#94A3B8"
          strokeWidth="1.1"
        />
        <path
          d="M 16 183 Q 50 193 84 183"
          fill="none"
          stroke="#F43F5E"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </symbol>

      {/* =====================================================================
          3. MODERN TOURING HATCHBACK (`#mesh-proto-car-touring-hatch`)
         ===================================================================== */}
      <symbol id="mesh-proto-car-touring-hatch" viewBox="0 0 100 200">
        <use href="#geom-buffer-axles-4" />

        <path
          d="M 24 11 Q 50 3 76 11 Q 91 20 91 44 L 91 158 Q 90 184 74 191 Q 50 196 26 191 Q 10 184 9 158 L 9 44 Q 9 20 24 11 Z"
          fill="var(--v-body, #10B981)"
          stroke="var(--v-roof, #6EE7B7)"
          strokeWidth="2.4"
        />
        <path
          d="M 13 28 Q 18 13 43 11 L 41 17 Q 22 19 16 30 Z M 87 28 Q 82 13 57 11 L 59 17 Q 78 19 84 30 Z"
          fill="#334155"
          stroke="#FEF08A"
          strokeWidth="1.2"
        />
        <circle
          cx="50"
          cy="11.5"
          r="3.6"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="1.3"
        />
        <path
          d="M 18 48 Q 24 24 34 16 M 82 48 Q 76 24 66 16"
          fill="none"
          stroke="var(--v-trim, #065F46)"
          strokeWidth="1.6"
          opacity="0.65"
        />
        <path
          d="M 10 61 L 1 56 Q 0 62 3 65 L 10 65 Z M 90 61 L 99 56 Q 100 62 97 65 L 90 65 Z"
          fill="#0F172A"
          stroke="#94A3B8"
          strokeWidth="1"
        />
        <path
          d="M 17 49 Q 50 44 83 49 L 77 75 Q 50 71 23 75 Z"
          fill="url(#mesh-glass-windshield)"
          stroke="#E2E8F0"
          strokeWidth="1.4"
        />
        <use href="#geom-buffer-wiper-pair" />
        <path
          d="M 13 64 L 19 74 L 19 152 L 13 142 Z M 87 64 L 81 74 L 81 152 L 87 142 Z"
          fill="url(#mesh-glass-dark-tint)"
        />
        <path
          d="M 12 110 L 20 110 M 80 110 L 88 110"
          stroke="#020617"
          strokeWidth="3.2"
        />
        <rect x="48.2" y="152" width="3.6" height="7" rx="1.8" fill="#0F172A" />
        <path
          d="M 21 163 Q 50 159 79 163 L 73 184 Q 50 188 27 184 Z"
          fill="url(#mesh-glass-dark-tint)"
          stroke="#94A3B8"
          strokeWidth="1.1"
        />
        <path
          d="M 11 171 Q 14 186 27 189 L 25 182 Q 16 179 14 169 Z M 89 171 Q 86 186 73 189 L 75 182 Q 84 179 86 169 Z"
          fill="#EF4444"
          stroke="#FECACA"
          strokeWidth="0.9"
        />
      </symbol>

      {/* =====================================================================
          4. EXECUTIVE 6-SEAT SHUTTLE MINIBUS (`#mesh-proto-van-executive-minibus`)
         ===================================================================== */}
      <symbol id="mesh-proto-van-executive-minibus" viewBox="0 0 100 200">
        <use href="#geom-buffer-axles-4" />

        <rect
          x="8"
          y="6"
          width="84"
          height="188"
          rx="22"
          fill="var(--v-body, #F59E0B)"
          stroke="var(--v-roof, #FDE047)"
          strokeWidth="2.5"
        />
        <rect
          x="26"
          y="7"
          width="48"
          height="5"
          rx="2.5"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="0.9"
        />
        <circle cx="19" cy="11" r="4" fill="#FEF08A" />
        <circle cx="81" cy="11" r="4" fill="#FEF08A" />
        <path
          d="M 14 18 Q 50 13 86 18 L 82 42 Q 50 39 18 42 Z"
          fill="url(#mesh-glass-windshield)"
          stroke="#FFFFFF"
          strokeWidth="1.4"
        />
        <path
          d="M 10 48 L 15 48 L 15 166 L 10 166 Z M 85 48 L 90 48 L 90 166 L 85 166 Z M 18 174 L 82 174 L 82 186 L 18 186 Z"
          fill="url(#mesh-glass-dark-tint)"
        />
        <path
          d="M 16 189 L 34 189 L 34 193 L 16 193 Z M 66 189 L 84 189 L 84 193 L 66 193 Z"
          fill="#F43F5E"
        />
      </symbol>

      {/* =====================================================================
          5. HEAVY 8-SEAT DOUBLE-AXLE CITY COACH BUS (`#mesh-proto-bus-articulated-coach`)
         ===================================================================== */}
      <symbol id="mesh-proto-bus-articulated-coach" viewBox="0 0 100 200">
        <use href="#geom-buffer-axles-6" />

        <rect
          x="7"
          y="4"
          width="86"
          height="192"
          rx="18"
          fill="var(--v-body, #EF4444)"
          stroke="var(--v-roof, #FCA5A5)"
          strokeWidth="2.6"
        />
        <path
          d="M 7 18 L 0 12 L 0 23 L 7 24 Z M 93 18 L 100 12 L 100 23 L 93 24 Z"
          fill="#0F172A"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        <rect
          x="24"
          y="5.5"
          width="52"
          height="5"
          rx="2"
          fill="#090D16"
          stroke="#FDE047"
          strokeWidth="0.8"
        />
        <circle cx="16" cy="9" r="3.8" fill="#FEF08A" />
        <circle cx="84" cy="9" r="3.8" fill="#FEF08A" />
        <path
          d="M 12 14 Q 50 10 88 14 L 85 35 Q 50 32 15 35 Z"
          fill="url(#mesh-glass-windshield)"
          stroke="#FFFFFF"
          strokeWidth="1.4"
        />
        <path
          d="M 9.5 40 L 14 40 L 14 174 L 9.5 174 Z M 86 40 L 90.5 40 L 90.5 174 L 86 174 Z"
          fill="url(#mesh-glass-dark-tint)"
        />
        <rect
          x="26"
          y="177"
          width="48"
          height="10"
          rx="3"
          fill="#0F172A"
          opacity="0.65"
        />
        <path
          d="M 14 190 L 34 190 L 34 194.5 L 14 194.5 Z M 66 190 L 86 190 L 86 194.5 L 66 194.5 Z"
          fill="#F43F5E"
          stroke="#FFE4E6"
          strokeWidth="0.7"
        />
      </symbol>
    </defs>
  </svg>
));

interface PassengerTokenProps {
  color: VehicleColor;
  isFront?: boolean;
  isWalking?: boolean;
  showSymbol?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PassengerToken: React.FC<PassengerTokenProps> = React.memo(
  ({
    color,
    isFront = false,
    isWalking = false,
    showSymbol = true,
    size = 'md',
  }) => {
    const theme = COLOR_PALETTE[color];
    const dim =
      size === 'lg'
        ? 'w-9 h-9 text-xs'
        : size === 'sm'
        ? 'w-6 h-6 text-[10px]'
        : 'w-7 h-7 text-[11px]';

    return (
      <div
        className={`relative rounded-full flex items-center justify-center font-extrabold select-none transition-transform duration-150 ${dim} ${
          isFront ? 'ring-2 ring-white scale-110 z-10' : ''
        } ${isWalking ? 'scale-110 ring-2 ring-amber-200 shadow-lg' : ''}`}
        style={{
          background: `radial-gradient(circle at 32% 28%, ${theme.roofHex}, ${theme.bodyHex} 68%, ${theme.trimHex} 100%)`,
          border: `1.5px solid ${theme.roofHex}`,
          boxShadow: isFront
            ? `0 0 12px ${theme.glowRgba}, 0 3px 0 ${theme.trimHex}, 0 5px 8px rgba(0,0,0,0.45)`
            : `0 2.5px 0 ${theme.trimHex}, 0 4px 6px rgba(0,0,0,0.35)`,
          color: theme.textHex,
        }}
        title={`${theme.name} Passenger`}
      >
        <span className="absolute inset-0.5 rounded-full border border-white/25 pointer-events-none" />
        <span
          className="absolute top-0.5 left-1.5 w-2 h-1 rounded-full opacity-70 pointer-events-none"
          style={{ backgroundColor: '#FFFFFF' }}
        />
        <span className="relative z-10 drop-shadow-sm">
          {showSymbol ? theme.symbol : ''}
        </span>
      </div>
    );
  }
);

interface DirectionArrowProps {
  direction: Direction;
  className?: string;
}

export const DirectionArrowIcon: React.FC<DirectionArrowProps> = React.memo(
  ({ direction, className = 'w-3.5 h-3.5' }) => {
    const rotation =
      direction === 'UP'
        ? 'rotate-0'
        : direction === 'RIGHT'
        ? 'rotate-90'
        : direction === 'DOWN'
        ? 'rotate-180'
        : '-rotate-90';

    return (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`${className} ${rotation} shrink-0`}
        aria-hidden="true"
      >
        <path d="M10 3L16 10H12.5V17H7.5V10H4L10 3Z" />
      </svg>
    );
  }
);

interface OpenTopVehicleVisualProps {
  vehicle: Vehicle;
  showSymbol: boolean;
  isSelected?: boolean;
  isBlockedTarget?: boolean;
  isBlockerHighlight?: boolean;
  compactBayView?: boolean;
  kinematics?: VehicleKinematics;
  headlightBeamOpacity?: number;
  /**
   * When true, omits standalone shadows/headlights because `.parking-lot-canvas-element`
   * batches them into the shared scene buffer.
   */
  instancedMode?: boolean;
  /**
   * When true, the vehicle's 3D/SVG body mesh is already rendered in `.parking-lot-canvas-element`'s
   * unified shared geometry buffer, so this component only renders the lightweight cabin seat HUD.
   */
  sharedBufferLinked?: boolean;
  carVariantOverride?: CarModelVariant;
}

/**
 * Renders a vehicle using Shared Geometry Buffers (`SHARED_GEOMETRY_BUFFER_REGISTRY`)
 * and Consolidated Material Instances (`CONSOLIDATED_MATERIAL_REGISTRY`).
 */
const OpenTopVehicleVisualComponent: React.FC<OpenTopVehicleVisualProps> = ({
  vehicle,
  showSymbol,
  isSelected = false,
  isBlockedTarget = false,
  isBlockerHighlight = false,
  compactBayView = false,
  kinematics,
  headlightBeamOpacity = 0.2,
  instancedMode = false,
  sharedBufferLinked = false,
  carVariantOverride,
}) => {
  const facingDir: Direction = compactBayView ? 'RIGHT' : vehicle.direction;
  const isHorizontal =
    compactBayView || facingDir === 'LEFT' || facingDir === 'RIGHT';

  const effectiveVehicle =
    carVariantOverride && vehicle.capacity === 4
      ? { ...vehicle, carVariant: carVariantOverride }
      : vehicle;

  const geometryBuffer = resolveSharedGeometryBuffer(effectiveVehicle);
  const material = resolveConsolidatedMaterial(effectiveVehicle);
  const carVariant =
    effectiveVehicle.capacity === 4
      ? resolveCarModelVariant(effectiveVehicle)
      : null;

  const seatArray = Array.from(
    { length: vehicle.capacity },
    (_, i) => i < vehicle.occupiedSeats
  );

  const isMoving = (kinematics?.speed ?? 0) > 0.01;
  const suspensionPx = Math.max(
    -2.5,
    Math.min(2.5, kinematics?.suspensionOffsetPx ?? 0)
  );
  const doorOpen = Math.max(0, Math.min(1, kinematics?.doorOpenProgress ?? 0));

  const svgTransform =
    facingDir === 'UP'
      ? undefined
      : facingDir === 'DOWN'
      ? 'rotate(180 50 100)'
      : facingDir === 'RIGHT'
      ? 'translate(200 0) rotate(90)'
      : 'translate(0 100) rotate(-90)';

  const svgViewBox = isHorizontal ? '0 0 200 100' : '0 0 100 200';

  return (
    <div
      className={`relative w-full h-full select-none flex items-center justify-center rounded-xl ${
        material.cssClassName
      } ${isSelected ? 'ring-2 ring-white' : ''} ${
        isBlockerHighlight ? 'ring-2 ring-amber-300 animate-pulse' : ''
      } ${isBlockedTarget ? 'ring-2 ring-rose-400' : ''}`}
      style={{
        transform:
          !sharedBufferLinked && suspensionPx !== 0
            ? `translate3d(0, ${suspensionPx}px, 0)`
            : undefined,
        boxShadow:
          instancedMode || sharedBufferLinked
            ? undefined
            : isSelected
            ? `0 0 12px ${material.glowRgba}, 0 3px 0 ${material.trimHex}`
            : `0 3px 0 ${material.trimHex}, 0 4px 8px rgba(0,0,0,0.42)`,
      }}
      data-mesh-archetype={geometryBuffer.archetypeId}
      data-material-id={material.materialId}
      data-car-variant={carVariant ?? 'BUS'}
    >
      {/* Standalone Headlight Cone (Only when rendered outside `.parking-lot-canvas-element`) */}
      {!instancedMode &&
        !sharedBufferLinked &&
        !compactBayView &&
        (isMoving || headlightBeamOpacity > 0.3) && (
          <div
            className="absolute pointer-events-none z-0"
            style={{
              opacity: isMoving
                ? Math.max(0.65, headlightBeamOpacity)
                : headlightBeamOpacity * 0.6,
              ...(facingDir === 'UP'
                ? {
                    top: '-10px',
                    left: '14%',
                    right: '14%',
                    height: '11px',
                    background:
                      'linear-gradient(to top, rgba(254, 249, 195, 0.82), transparent)',
                  }
                : facingDir === 'DOWN'
                ? {
                    bottom: '-10px',
                    left: '14%',
                    right: '14%',
                    height: '11px',
                    background:
                      'linear-gradient(to bottom, rgba(254, 249, 195, 0.82), transparent)',
                  }
                : facingDir === 'LEFT'
                ? {
                    left: '-10px',
                    top: '14%',
                    bottom: '14%',
                    width: '11px',
                    background:
                      'linear-gradient(to left, rgba(254, 249, 195, 0.82), transparent)',
                  }
                : {
                    right: '-10px',
                    top: '14%',
                    bottom: '14%',
                    width: '11px',
                    background:
                      'linear-gradient(to right, rgba(254, 249, 195, 0.82), transparent)',
                  }),
            }}
          />
        )}

      {/* Standalone Shared Geometry Instance (Omitted when already drawn in `.parking-lot-canvas-element` unified buffer) */}
      {!sharedBufferLinked && (
        <svg
          viewBox={svgViewBox}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          aria-hidden="true"
        >
          <use
            href={`#${geometryBuffer.meshSymbolId}`}
            transform={svgTransform}
          />
        </svg>
      )}

      {/* Animated Bi-Fold Side Boarding Door Indicator */}
      {doorOpen > 0.05 && (
        <div
          className="absolute pointer-events-none z-20 rounded-full"
          style={
            isHorizontal
              ? {
                  top: '1px',
                  left: '32%',
                  width: '32%',
                  height: '4px',
                  backgroundColor: '#FDE047',
                  boxShadow: '0 0 8px rgba(253, 224, 71, 0.95)',
                  transform: `scaleX(${1 - doorOpen * 0.4})`,
                }
              : {
                  right: '1px',
                  top: '32%',
                  height: '32%',
                  width: '4px',
                  backgroundColor: '#FDE047',
                  boxShadow: '0 0 8px rgba(253, 224, 71, 0.95)',
                  transform: `scaleY(${1 - doorOpen * 0.4})`,
                }
          }
        />
      )}

      {/* Open-Top Sunroof / Passenger Cabin Matrix & Direction Emblem */}
      {vehicle.isMystery ? (
        <div className="relative z-10 flex flex-col items-center justify-center text-white font-bold bg-slate-900/80 px-1.5 py-0.5 rounded-md border border-slate-500/60">
          <span className="text-xs leading-none drop-shadow">?</span>
          <span className="text-[9px] opacity-85 tabular-nums">
            {vehicle.capacity}p
          </span>
        </div>
      ) : (
        <div
          className={`relative z-10 flex items-center justify-center rounded-md bg-slate-950/55 border border-white/20 ${
            isHorizontal
              ? 'flex-row gap-1 px-1 py-0.5'
              : 'flex-col gap-0.5 px-0.5 py-1'
          }`}
        >
          <div
            className={`flex items-center justify-center text-white drop-shadow ${
              isHorizontal ? 'flex-col gap-0' : 'flex-row gap-0.5'
            }`}
          >
            {!compactBayView && (
              <DirectionArrowIcon
                direction={vehicle.direction}
                className="w-3 h-3 text-white drop-shadow"
              />
            )}
            {showSymbol && (
              <span className="text-[9px] font-extrabold leading-none opacity-95">
                {material.symbol}
              </span>
            )}
          </div>

          <div
            className="grid gap-0.5 p-0.5 rounded border border-black/40"
            style={{
              backgroundColor: material.seatWellHex,
              gridTemplateColumns: isHorizontal
                ? `repeat(${vehicle.capacity / 2}, minmax(0, 1fr))`
                : 'repeat(2, minmax(0, 1fr))',
            }}
          >
            {seatArray.map((isOccupied, idx) => (
              <span
                key={idx}
                className="w-2 h-2 rounded-[3px] block"
                style={{
                  backgroundColor: isOccupied
                    ? '#FFFFFF'
                    : 'rgba(255,255,255,0.22)',
                  border: isOccupied
                    ? `1px solid ${material.roofHex}`
                    : '1px solid rgba(255,255,255,0.12)',
                  transform: isOccupied ? 'scale(1.1)' : 'scale(0.92)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const OpenTopVehicleVisual = React.memo(
  OpenTopVehicleVisualComponent,
  (prev, next) =>
    prev.vehicle === next.vehicle &&
    prev.showSymbol === next.showSymbol &&
    prev.isSelected === next.isSelected &&
    prev.isBlockedTarget === next.isBlockedTarget &&
    prev.isBlockerHighlight === next.isBlockerHighlight &&
    prev.compactBayView === next.compactBayView &&
    prev.headlightBeamOpacity === next.headlightBeamOpacity &&
    prev.instancedMode === next.instancedMode &&
    prev.sharedBufferLinked === next.sharedBufferLinked &&
    prev.carVariantOverride === next.carVariantOverride &&
    prev.kinematics === next.kinematics
);
