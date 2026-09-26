import { COLOR_PALETTE, VEHICLE_COLORS } from '../assets/colorPalette';
import { directionToHeadingDeg } from './animationEngine';
import { getDirectionDelta, getVehicleGridBounds } from './collisionEngine';
import {
  BlockedMoveFeedback,
  CarModelVariant,
  Direction,
  GridObstacle,
  Vehicle,
  VehicleCapacity,
  VehicleColor,
  VehicleKinematics,
  VehicleMeshArchetypeId,
} from './types';

export const CAR_MODEL_VARIANTS: CarModelVariant[] = [
  'LUXURY_SUV',
  'SPORT_COUPE',
  'TOURING_HATCH',
];

export const VEHICLE_MESH_ARCHETYPE_IDS: VehicleMeshArchetypeId[] = [
  'CAR_LUXURY_SUV',
  'CAR_SPORT_COUPE',
  'CAR_TOURING_HATCH',
  'VAN_EXECUTIVE_MINIBUS',
  'BUS_ARTICULATED_COACH',
];

export type MaterialInstanceId =
  | `MAT_${VehicleColor}`
  | 'MAT_MYSTERY';

/**
 * Consolidated Material Instance.
 * Pre-allocated once per color palette (8 colors + 1 mystery state) and frozen in memory.
 * Eliminates per-vehicle inline style object allocations and redundant gradient definitions.
 */
export interface ConsolidatedMaterialInstance {
  materialId: MaterialInstanceId;
  colorKey: VehicleColor | 'MYSTERY';
  cssClassName: string;
  svgBodyGradientId: string;
  bodyHex: string;
  roofHex: string;
  trimHex: string;
  seatWellHex: string;
  glowRgba: string;
  textHex: string;
  symbol: string;
  /** Frozen pre-allocated CSS custom property map shared by all vehicles using this material */
  sharedStyleVars: Readonly<Record<string, string>>;
}

/**
 * Shared Geometry Buffer Descriptor.
 * References the canonical master SVG geometry buffers (`<symbol>` / `<g>`) for axles,
 * sculpted bodywork, glazing, and passenger seat wells.
 */
export interface SharedGeometryBufferDescriptor {
  archetypeId: VehicleMeshArchetypeId;
  meshSymbolId: string;
  sharedAxleBufferId: 'geom-buffer-axles-4' | 'geom-buffer-axles-6';
  sharedSeatBufferId:
    | 'geom-buffer-seats-4'
    | 'geom-buffer-seats-6'
    | 'geom-buffer-seats-8';
  capacity: VehicleCapacity;
  canonicalViewBox: '0 0 100 200';
  vertexCommandCount: number;
}

/**
 * Pre-compiled Consolidated Material Registry (9 total instances for the entire application).
 */
export const CONSOLIDATED_MATERIAL_REGISTRY: Readonly<
  Record<MaterialInstanceId, ConsolidatedMaterialInstance>
> = (() => {
  const registry = {} as Record<
    MaterialInstanceId,
    ConsolidatedMaterialInstance
  >;

  for (const color of VEHICLE_COLORS) {
    const theme = COLOR_PALETTE[color];
    const materialId: MaterialInstanceId = `MAT_${color}`;
    const lower = color.toLowerCase();
    const sharedStyleVars = Object.freeze({
      '--v-body': theme.bodyHex,
      '--v-roof': theme.roofHex,
      '--v-trim': theme.trimHex,
      '--v-well': theme.seatEmptyHex,
    });

    registry[materialId] = Object.freeze({
      materialId,
      colorKey: color,
      cssClassName: `v-mat-${lower}`,
      svgBodyGradientId: `mat-body-grad-${lower}`,
      bodyHex: theme.bodyHex,
      roofHex: theme.roofHex,
      trimHex: theme.trimHex,
      seatWellHex: theme.seatEmptyHex,
      glowRgba: theme.glowRgba,
      textHex: theme.textHex,
      symbol: theme.symbol,
      sharedStyleVars,
    });
  }

  const mysteryVars = Object.freeze({
    '--v-body': '#334155',
    '--v-roof': '#64748B',
    '--v-trim': '#0F172A',
    '--v-well': '#090D16',
  });

  registry.MAT_MYSTERY = Object.freeze({
    materialId: 'MAT_MYSTERY',
    colorKey: 'MYSTERY',
    cssClassName: 'v-mat-mystery',
    svgBodyGradientId: 'mat-body-grad-mystery',
    bodyHex: '#334155',
    roofHex: '#64748B',
    trimHex: '#0F172A',
    seatWellHex: '#090D16',
    glowRgba: 'rgba(100, 116, 139, 0.45)',
    textHex: '#FFFFFF',
    symbol: '?',
    sharedStyleVars: mysteryVars,
  });

  return Object.freeze(registry);
})();

/**
 * Pre-compiled Shared Geometry Buffer Registry for the 5 Vehicle Archetypes.
 */
export const SHARED_GEOMETRY_BUFFER_REGISTRY: Readonly<
  Record<VehicleMeshArchetypeId, SharedGeometryBufferDescriptor>
> = Object.freeze({
  CAR_LUXURY_SUV: Object.freeze({
    archetypeId: 'CAR_LUXURY_SUV',
    meshSymbolId: 'mesh-proto-car-luxury-suv',
    sharedAxleBufferId: 'geom-buffer-axles-4',
    sharedSeatBufferId: 'geom-buffer-seats-4',
    capacity: 4,
    canonicalViewBox: '0 0 100 200',
    vertexCommandCount: 42,
  }),
  CAR_SPORT_COUPE: Object.freeze({
    archetypeId: 'CAR_SPORT_COUPE',
    meshSymbolId: 'mesh-proto-car-sport-coupe',
    sharedAxleBufferId: 'geom-buffer-axles-4',
    sharedSeatBufferId: 'geom-buffer-seats-4',
    capacity: 4,
    canonicalViewBox: '0 0 100 200',
    vertexCommandCount: 38,
  }),
  CAR_TOURING_HATCH: Object.freeze({
    archetypeId: 'CAR_TOURING_HATCH',
    meshSymbolId: 'mesh-proto-car-touring-hatch',
    sharedAxleBufferId: 'geom-buffer-axles-4',
    sharedSeatBufferId: 'geom-buffer-seats-4',
    capacity: 4,
    canonicalViewBox: '0 0 100 200',
    vertexCommandCount: 40,
  }),
  VAN_EXECUTIVE_MINIBUS: Object.freeze({
    archetypeId: 'VAN_EXECUTIVE_MINIBUS',
    meshSymbolId: 'mesh-proto-van-executive-minibus',
    sharedAxleBufferId: 'geom-buffer-axles-4',
    sharedSeatBufferId: 'geom-buffer-seats-6',
    capacity: 6,
    canonicalViewBox: '0 0 100 200',
    vertexCommandCount: 36,
  }),
  BUS_ARTICULATED_COACH: Object.freeze({
    archetypeId: 'BUS_ARTICULATED_COACH',
    meshSymbolId: 'mesh-proto-bus-articulated-coach',
    sharedAxleBufferId: 'geom-buffer-axles-6',
    sharedSeatBufferId: 'geom-buffer-seats-8',
    capacity: 8,
    canonicalViewBox: '0 0 100 200',
    vertexCommandCount: 44,
  }),
});

/**
 * Resolves the consolidated material instance for a vehicle without allocating new objects.
 */
export function resolveConsolidatedMaterial(
  vehicle: Pick<Vehicle, 'color' | 'isMystery'>
): ConsolidatedMaterialInstance {
  if (vehicle.isMystery) {
    return CONSOLIDATED_MATERIAL_REGISTRY.MAT_MYSTERY;
  }
  return CONSOLIDATED_MATERIAL_REGISTRY[`MAT_${vehicle.color}`];
}

/**
 * Resolves the shared geometry buffer descriptor for a vehicle.
 */
export function resolveSharedGeometryBuffer(
  vehicle: Vehicle
): SharedGeometryBufferDescriptor {
  const archetypeId = resolveVehicleMeshArchetype(vehicle);
  return SHARED_GEOMETRY_BUFFER_REGISTRY[archetypeId];
}

export interface VehicleInstanceTransform {
  vehicle: Vehicle;
  archetypeId: VehicleMeshArchetypeId;
  geometryBuffer: SharedGeometryBufferDescriptor;
  material: ConsolidatedMaterialInstance;
  carVariant: CarModelVariant | null;
  isMoving: boolean;
  isSelected: boolean;
  isBlockedTarget: boolean;
  isBlockerHighlight: boolean;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  centerXPx: number;
  centerYPx: number;
  translateXPx: number;
  translateYPx: number;
  rotationDeg: number;
  facingHeadingDeg: number;
  suspensionOffsetPx: number;
  wheelRotationDeg: number;
  wheelTreadOffsetPx: number;
  doorOpenProgress: number;
  bodyHex: string;
  roofHex: string;
  trimHex: string;
  seatWellHex: string;
  glowRgba: string;
  symbol: string;
}

export interface InstancedArchetypeBatch {
  archetypeId: VehicleMeshArchetypeId;
  geometryBuffer: SharedGeometryBufferDescriptor;
  meshSymbolId: string;
  instances: VehicleInstanceTransform[];
}

export interface ConsolidatedMaterialBatch {
  materialId: MaterialInstanceId;
  material: ConsolidatedMaterialInstance;
  instances: VehicleInstanceTransform[];
}

export interface BatchedGroundShadowAndLight {
  vehicleId: string;
  centerXPx: number;
  centerYPx: number;
  widthPx: number;
  heightPx: number;
  rotationDeg: number;
  facingDir: Direction;
  isMoving: boolean;
  headlightOpacity: number;
}

export interface InstancedRenderMetrics {
  totalVehiclesRendered: number;
  totalObstaclesRendered: number;
  activeArchetypeBatches: number;
  activeMaterialBatches: number;
  sharedMeshPrototypesCount: number;
  consolidatedMaterialsCount: number;
  materialStateSwitchesSaved: number;
  naiveUnbatchedDrawCalls: number;
  instancedDrawCalls: number;
  drawCallsSaved: number;
  drawCallReductionPercent: number;
  estimatedDomNodesSaved: number;
}

export interface InstancedSceneGraph {
  parkedInstances: VehicleInstanceTransform[];
  movingInstances: VehicleInstanceTransform[];
  allInstances: VehicleInstanceTransform[];
  archetypeBatches: Record<VehicleMeshArchetypeId, InstancedArchetypeBatch>;
  materialBatches: Partial<Record<MaterialInstanceId, ConsolidatedMaterialBatch>>;
  groundShadowsAndLights: BatchedGroundShadowAndLight[];
  metrics: InstancedRenderMetrics;
}

/**
 * Deterministically assigns one of the 3 realistic car body styles
 * (Luxury SUV, Sport Coupe, Touring Hatchback) to any 4-seat car.
 */
export function resolveCarModelVariant(vehicle: Vehicle): CarModelVariant {
  if (vehicle.carVariant) {
    return vehicle.carVariant;
  }
  let hash = (vehicle.gridX * 31 + vehicle.gridY * 17) | 0;
  for (let i = 0; i < vehicle.id.length; i++) {
    hash = (hash * 33 + vehicle.id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % CAR_MODEL_VARIANTS.length;
  return CAR_MODEL_VARIANTS[idx];
}

/**
 * Maps a vehicle to its shared 3D/SVG Master Mesh Archetype ID for instanced rendering.
 */
export function resolveVehicleMeshArchetype(
  vehicle: Vehicle
): VehicleMeshArchetypeId {
  if (vehicle.capacity === 4) {
    const variant = resolveCarModelVariant(vehicle);
    if (variant === 'LUXURY_SUV') return 'CAR_LUXURY_SUV';
    if (variant === 'SPORT_COUPE') return 'CAR_SPORT_COUPE';
    return 'CAR_TOURING_HATCH';
  }
  if (vehicle.capacity === 6) {
    return 'VAN_EXECUTIVE_MINIBUS';
  }
  return 'BUS_ARTICULATED_COACH';
}

export function getMeshSymbolDomId(archetypeId: VehicleMeshArchetypeId): string {
  return SHARED_GEOMETRY_BUFFER_REGISTRY[archetypeId].meshSymbolId;
}

/**
 * Builds the instanced scene graph using Shared Geometry Buffers and Consolidated Material Instances
 * for `.parking-lot-canvas-element` (`ParkingLotCanvas`).
 */
export function buildInstancedVehicleScene(params: {
  vehicles: Vehicle[];
  obstacles: GridObstacle[];
  kinematicsByVehicleId: Record<string, VehicleKinematics>;
  selectedVehicleId: string | null;
  blockedFeedback: BlockedMoveFeedback | null;
  cellPx: number;
  baseHeadlightOpacity: number;
}): InstancedSceneGraph {
  const {
    vehicles,
    obstacles,
    kinematicsByVehicleId,
    selectedVehicleId,
    blockedFeedback,
    cellPx,
    baseHeadlightOpacity,
  } = params;

  const parkedInstances: VehicleInstanceTransform[] = [];
  const movingInstances: VehicleInstanceTransform[] = [];
  const allInstances: VehicleInstanceTransform[] = [];
  const groundShadowsAndLights: BatchedGroundShadowAndLight[] = [];

  const archetypeBatches: Record<
    VehicleMeshArchetypeId,
    InstancedArchetypeBatch
  > = {
    CAR_LUXURY_SUV: {
      archetypeId: 'CAR_LUXURY_SUV',
      geometryBuffer: SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_LUXURY_SUV,
      meshSymbolId: SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_LUXURY_SUV.meshSymbolId,
      instances: [],
    },
    CAR_SPORT_COUPE: {
      archetypeId: 'CAR_SPORT_COUPE',
      geometryBuffer: SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_SPORT_COUPE,
      meshSymbolId: SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_SPORT_COUPE.meshSymbolId,
      instances: [],
    },
    CAR_TOURING_HATCH: {
      archetypeId: 'CAR_TOURING_HATCH',
      geometryBuffer: SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_TOURING_HATCH,
      meshSymbolId:
        SHARED_GEOMETRY_BUFFER_REGISTRY.CAR_TOURING_HATCH.meshSymbolId,
      instances: [],
    },
    VAN_EXECUTIVE_MINIBUS: {
      archetypeId: 'VAN_EXECUTIVE_MINIBUS',
      geometryBuffer: SHARED_GEOMETRY_BUFFER_REGISTRY.VAN_EXECUTIVE_MINIBUS,
      meshSymbolId:
        SHARED_GEOMETRY_BUFFER_REGISTRY.VAN_EXECUTIVE_MINIBUS.meshSymbolId,
      instances: [],
    },
    BUS_ARTICULATED_COACH: {
      archetypeId: 'BUS_ARTICULATED_COACH',
      geometryBuffer: SHARED_GEOMETRY_BUFFER_REGISTRY.BUS_ARTICULATED_COACH,
      meshSymbolId:
        SHARED_GEOMETRY_BUFFER_REGISTRY.BUS_ARTICULATED_COACH.meshSymbolId,
      instances: [],
    },
  };

  const materialBatches: Partial<
    Record<MaterialInstanceId, ConsolidatedMaterialBatch>
  > = {};

  const padding = 2.2;

  for (const vehicle of vehicles) {
    if (
      vehicle.state !== 'PARKED_IN_LOT' &&
      vehicle.state !== 'MOVING_TO_BAY'
    ) {
      continue;
    }

    const isMoving = vehicle.state === 'MOVING_TO_BAY';
    const bounds = getVehicleGridBounds(vehicle);
    const kin = kinematicsByVehicleId[vehicle.id];

    const geometryBuffer = resolveSharedGeometryBuffer(vehicle);
    const archetypeId = geometryBuffer.archetypeId;
    const material = resolveConsolidatedMaterial(vehicle);
    const carVariant =
      vehicle.capacity === 4 ? resolveCarModelVariant(vehicle) : null;

    const isSelected = selectedVehicleId === vehicle.id || isMoving;
    const isBlockedTarget = blockedFeedback?.vehicleId === vehicle.id;
    const isBlockerHighlight =
      blockedFeedback?.blockerVehicleId === vehicle.id;

    const leftPx = bounds.minX * cellPx + padding;
    const topPx = bounds.minY * cellPx + padding;
    const widthPx = bounds.widthCells * cellPx - padding * 2;
    const heightPx = bounds.heightCells * cellPx - padding * 2;

    const baseHeading = directionToHeadingDeg(vehicle.direction);
    let translateXPx = 0;
    let translateYPx = 0;
    let rotationDeg = 0;

    if (isMoving) {
      const currentHeading = kin ? kin.headingDeg : baseHeading;
      rotationDeg = currentHeading - baseHeading;
      translateXPx = kin
        ? (kin.x - vehicle.gridX) * cellPx
        : getDirectionDelta(vehicle.direction).x * cellPx * 1.8;
      translateYPx = kin
        ? (kin.y - vehicle.gridY) * cellPx
        : getDirectionDelta(vehicle.direction).y * cellPx * 1.8;
    } else if (isBlockedTarget) {
      const recoil = getDirectionDelta(vehicle.direction);
      translateXPx = recoil.x * 5.5;
      translateYPx = recoil.y * 5.5;
    }

    const wheelRotationDeg = kin?.wheelRotationDeg ?? 0;
    const wheelTreadOffsetPx = ((wheelRotationDeg % 360) / 360) * 6;
    const suspensionOffsetPx = Math.max(
      -2.5,
      Math.min(2.5, kin?.suspensionOffsetPx ?? 0)
    );
    const doorOpenProgress = Math.max(
      0,
      Math.min(1, kin?.doorOpenProgress ?? 0)
    );

    const centerXPx = leftPx + widthPx * 0.5 + translateXPx;
    const centerYPx =
      topPx + heightPx * 0.5 + translateYPx + suspensionOffsetPx;

    const instance: VehicleInstanceTransform = {
      vehicle,
      archetypeId,
      geometryBuffer,
      material,
      carVariant,
      isMoving,
      isSelected,
      isBlockedTarget,
      isBlockerHighlight,
      leftPx,
      topPx,
      widthPx,
      heightPx,
      centerXPx,
      centerYPx,
      translateXPx,
      translateYPx,
      rotationDeg,
      facingHeadingDeg: baseHeading + rotationDeg,
      suspensionOffsetPx,
      wheelRotationDeg,
      wheelTreadOffsetPx,
      doorOpenProgress,
      bodyHex: material.bodyHex,
      roofHex: material.roofHex,
      trimHex: material.trimHex,
      seatWellHex: material.seatWellHex,
      glowRgba: material.glowRgba,
      symbol: material.symbol,
    };

    archetypeBatches[archetypeId].instances.push(instance);

    let matBatch = materialBatches[material.materialId];
    if (!matBatch) {
      matBatch = {
        materialId: material.materialId,
        material,
        instances: [],
      };
      materialBatches[material.materialId] = matBatch;
    }
    matBatch.instances.push(instance);

    allInstances.push(instance);
    if (isMoving) {
      movingInstances.push(instance);
    } else {
      parkedInstances.push(instance);
    }

    groundShadowsAndLights.push({
      vehicleId: vehicle.id,
      centerXPx,
      centerYPx: topPx + heightPx * 0.5 + translateYPx,
      widthPx,
      heightPx,
      rotationDeg,
      facingDir: vehicle.direction,
      isMoving,
      headlightOpacity: isMoving
        ? Math.max(0.7, baseHeadlightOpacity)
        : baseHeadlightOpacity * 0.65,
    });
  }

  const totalVehiclesRendered = allInstances.length;
  const totalObstaclesRendered = obstacles.length;
  const activeArchetypeBatches = Object.values(archetypeBatches).filter(
    (b) => b.instances.length > 0
  ).length;
  const activeMaterialBatches = Object.keys(materialBatches).length;
  const materialStateSwitchesSaved = Math.max(
    0,
    totalVehiclesRendered - activeMaterialBatches
  );

  // Unbatched rendering required ~16 draw/composite operations per vehicle + 3 per obstacle + 1 board
  const naiveUnbatchedDrawCalls =
    1 + totalVehiclesRendered * 16 + totalObstaclesRendered * 3;

  // Consolidated Scene-Space Mesh + Material Instancing:
  // 1 (Grid background) + 1 (Unified SVG Ground + Instanced Vehicle Mesh Buffer) + 1 (Obstacle layer)
  const instancedDrawCalls =
    1 +
    (totalVehiclesRendered > 0 ? activeArchetypeBatches : 0) +
    (totalObstaclesRendered > 0 ? 1 : 0);

  const drawCallsSaved = Math.max(
    0,
    naiveUnbatchedDrawCalls - instancedDrawCalls
  );
  const drawCallReductionPercent =
    naiveUnbatchedDrawCalls > 0
      ? Number(((drawCallsSaved / naiveUnbatchedDrawCalls) * 100).toFixed(1))
      : 0;

  const estimatedDomNodesSaved = totalVehiclesRendered * 18;

  return {
    parkedInstances,
    movingInstances,
    allInstances,
    archetypeBatches,
    materialBatches,
    groundShadowsAndLights,
    metrics: {
      totalVehiclesRendered,
      totalObstaclesRendered,
      activeArchetypeBatches,
      activeMaterialBatches,
      sharedMeshPrototypesCount: VEHICLE_MESH_ARCHETYPE_IDS.length,
      consolidatedMaterialsCount: Object.keys(CONSOLIDATED_MATERIAL_REGISTRY)
        .length,
      materialStateSwitchesSaved,
      naiveUnbatchedDrawCalls,
      instancedDrawCalls,
      drawCallsSaved,
      drawCallReductionPercent,
      estimatedDomNodesSaved,
    },
  };
}
