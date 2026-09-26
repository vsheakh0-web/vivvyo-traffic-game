import {
  Direction,
  DoorState,
  GridPoint,
  Vehicle,
  VehicleColor,
  VehicleKinematics,
} from './types';

export interface Waypoint {
  x: number;
  y: number;
}

export interface ActiveVehicleMotion {
  animId: string;
  vehicleId: string;
  generationId: number;
  phase: 'TO_BAY' | 'DEPARTING';
  waypoints: Waypoint[];
  segmentLengths: number[];
  totalLength: number;
  elapsedMs: number;
  durationMs: number;
  progress: number; // 0..1
  kinematics: VehicleKinematics;
  completed: boolean;
  completionFired: boolean;
}

export interface ActivePassengerBoardingAnim {
  animId: string;
  passengerId: string;
  passengerColor: VehicleColor;
  targetVehicleId: string;
  targetBayIndex: number;
  seatIndex: number;
  generationId: number;
  stage: 'OPENING_DOOR' | 'APPROACHING_DOOR' | 'STEPPING_IN' | 'SEATED';
  startPoint: Waypoint;
  doorEntrancePoint: Waypoint;
  seatPoint: Waypoint;
  currentPoint: Waypoint;
  elapsedMs: number;
  durationMs: number;
  progress: number; // 0..1
  completed: boolean;
  completionFired: boolean;
}

export interface AnimationControllerState {
  generationId: number;
  nextSeq: number;
  kinematicsByVehicleId: Record<string, VehicleKinematics>;
  activeVehicleMotions: Record<string, ActiveVehicleMotion>;
  activePassengerAnims: ActivePassengerBoardingAnim[];
}

export interface AnimationStepEvents {
  arrivedVehicleIds: string[];
  departedVehicleIds: string[];
  seatedPassengers: {
    passengerId: string;
    targetVehicleId: string;
    seatIndex: number;
  }[];
}

const WHEEL_DEG_PER_DISTANCE_UNIT = 48;
const MAX_SUSPENSION_OFFSET_PX = 2.5;

/**
 * Maps a cardinal grid direction to a standard clockwise heading angle in degrees:
 * UP = 0, RIGHT = 90, DOWN = 180, LEFT = 270.
 */
export function directionToHeadingDeg(direction: Direction): number {
  switch (direction) {
    case 'UP':
      return 0;
    case 'RIGHT':
      return 90;
    case 'DOWN':
      return 180;
    case 'LEFT':
      return 270;
  }
}

/**
 * Normalizes any angle in degrees into [0, 360).
 */
export function normalizeAngleDeg(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Interpolates between two angles in degrees along the shortest rotational arc,
 * preventing unnatural 270-degree spins when turning across 0/360 boundaries.
 */
export function lerpShortestAngleDeg(
  fromDeg: number,
  toDeg: number,
  t: number
): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const diff = ((toDeg - fromDeg + 540) % 360) - 180;
  return normalizeAngleDeg(fromDeg + diff * clampedT);
}

/**
 * Smooth C1-continuous acceleration and deceleration curve (Hermite cubic):
 * - Position: s(t) = 3t^2 - 2t^3
 * - Normalized Velocity: v(t) = ds/dt = 6t(1 - t)
 * Starts at speed 0, accelerates smoothly to mid-path, and decelerates to 0 at t = 1.
 */
export function evaluateSmoothMotionProfile(t: number): {
  distanceFraction: number;
  normalizedSpeed: number;
  normalizedAccel: number;
} {
  const u = Math.max(0, Math.min(1, t));
  const distanceFraction = 3 * u * u - 2 * u * u * u;
  const normalizedSpeed = 6 * u * (1 - u);
  const normalizedAccel = 6 - 12 * u;
  return { distanceFraction, normalizedSpeed, normalizedAccel };
}

/**
 * Creates the default stationary kinematics for a vehicle at rest.
 */
export function createInitialVehicleKinematics(
  vehicle: Pick<Vehicle, 'gridX' | 'gridY' | 'direction'>
): VehicleKinematics {
  return {
    x: vehicle.gridX,
    y: vehicle.gridY,
    headingDeg: directionToHeadingDeg(vehicle.direction),
    speed: 0,
    wheelRotationDeg: 0,
    suspensionOffsetPx: 0,
    suspensionVelocity: 0,
    doorState: 'CLOSED',
    doorOpenProgress: 0,
  };
}

/**
 * Creates a clean AnimationControllerState for a set of vehicles.
 */
export function createAnimationController(
  vehicles: Vehicle[] = []
): AnimationControllerState {
  const kinematicsByVehicleId: Record<string, VehicleKinematics> = {};
  for (const v of vehicles) {
    kinematicsByVehicleId[v.id] = createInitialVehicleKinematics(v);
  }
  return {
    generationId: 1,
    nextSeq: 1,
    kinematicsByVehicleId,
    activeVehicleMotions: {},
    activePassengerAnims: [],
  };
}

/**
 * Builds a multi-waypoint perimeter road path from a vehicle's lot position
 * to its assigned parking bay coordinates, ensuring the vehicle exits along its
 * facing direction, turns smoothly onto the perimeter road, and stops precisely at the bay.
 */
export function buildVehicleBayPath(
  vehicle: Pick<Vehicle, 'gridX' | 'gridY' | 'direction'>,
  gridWidth: number,
  gridHeight: number,
  bayDestination: Waypoint
): Waypoint[] {
  const start: Waypoint = { x: vehicle.gridX, y: vehicle.gridY };
  const waypoints: Waypoint[] = [start];

  // Perimeter road ring sits 1 unit outside the grid bounds:
  // Top road: y = -1, Bottom road: y = gridHeight, Left road: x = -1, Right road: x = gridWidth
  if (vehicle.direction === 'UP') {
    waypoints.push({ x: start.x, y: -1 });
  } else if (vehicle.direction === 'DOWN') {
    waypoints.push({ x: start.x, y: gridHeight });
    // Turn onto left or right perimeter road up to top road (y = -1)
    const sideX = start.x < gridWidth / 2 ? -1 : gridWidth;
    waypoints.push({ x: sideX, y: gridHeight });
    waypoints.push({ x: sideX, y: -1 });
  } else if (vehicle.direction === 'LEFT') {
    waypoints.push({ x: -1, y: start.y });
    waypoints.push({ x: -1, y: -1 });
  } else if (vehicle.direction === 'RIGHT') {
    waypoints.push({ x: gridWidth, y: start.y });
    waypoints.push({ x: gridWidth, y: -1 });
  }

  // Final approach along the top transit lane into the exact bay slot
  const lastWp = waypoints[waypoints.length - 1];
  if (Math.abs(lastWp.x - bayDestination.x) > 0.01 || Math.abs(lastWp.y - bayDestination.y) > 0.01) {
    waypoints.push({ x: bayDestination.x, y: bayDestination.y });
  }

  return waypoints;
}

function computeSegmentLengths(waypoints: Waypoint[]): {
  segmentLengths: number[];
  totalLength: number;
} {
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
  }
  return { segmentLengths, totalLength };
}

/**
 * Samples position and tangent heading angle along a multi-waypoint polyline at arc-length fraction `s` (0..1).
 */
export function sampleWaypointPath(
  waypoints: Waypoint[],
  segmentLengths: number[],
  totalLength: number,
  distanceFraction: number
): { point: Waypoint; tangentHeadingDeg: number } {
  if (waypoints.length === 0) {
    return { point: { x: 0, y: 0 }, tangentHeadingDeg: 0 };
  }
  if (waypoints.length === 1 || totalLength <= 1e-6) {
    return { point: { ...waypoints[waypoints.length - 1] }, tangentHeadingDeg: 90 };
  }

  const clampedFrac = Math.max(0, Math.min(1, distanceFraction));
  if (clampedFrac >= 1) {
    const lastIdx = waypoints.length - 1;
    const prev = waypoints[lastIdx - 1];
    const last = waypoints[lastIdx];
    const heading = normalizeAngleDeg(
      (Math.atan2(last.x - prev.x, -(last.y - prev.y)) * 180) / Math.PI
    );
    return { point: { ...last }, tangentHeadingDeg: heading };
  }

  const targetDist = clampedFrac * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const localT = segLen > 1e-6 ? (targetDist - accumulated) / segLen : 1;
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const px = a.x + (b.x - a.x) * localT;
      const py = a.y + (b.y - a.y) * localT;
      const segHeading = normalizeAngleDeg(
        (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
      );

      // Smoothly blend heading into the next segment near corners (last 25% of segment)
      let blendedHeading = segHeading;
      if (i + 1 < segmentLengths.length && localT > 0.75) {
        const c = waypoints[i + 2];
        const nextHeading = normalizeAngleDeg(
          (Math.atan2(c.x - b.x, -(c.y - b.y)) * 180) / Math.PI
        );
        const cornerBlend = (localT - 0.75) / 0.25;
        blendedHeading = lerpShortestAngleDeg(segHeading, nextHeading, cornerBlend * 0.5);
      }

      return {
        point: { x: px, y: py },
        tangentHeadingDeg: blendedHeading,
      };
    }
    accumulated += segLen;
  }

  return {
    point: { ...waypoints[waypoints.length - 1] },
    tangentHeadingDeg: 90,
  };
}

/**
 * Starts a smooth vehicle movement animation along `waypoints` (e.g., from lot to bay or bay departure).
 * Ensures doors are closed before moving.
 */
export function startVehicleMotionAnimation(
  controller: AnimationControllerState,
  vehicle: Pick<Vehicle, 'id' | 'gridX' | 'gridY' | 'direction'>,
  waypoints: Waypoint[],
  phase: 'TO_BAY' | 'DEPARTING',
  durationMs: number = 280
): AnimationControllerState {
  const existingKin =
    controller.kinematicsByVehicleId[vehicle.id] ||
    createInitialVehicleKinematics(vehicle);

  const { segmentLengths, totalLength } = computeSegmentLengths(waypoints);
  const startPoint = waypoints[0] || { x: vehicle.gridX, y: vehicle.gridY };

  const initialKinematics: VehicleKinematics = {
    ...existingKin,
    x: startPoint.x,
    y: startPoint.y,
    speed: 0,
    doorState: 'CLOSED',
    doorOpenProgress: 0,
  };

  const animId = `vmot-${controller.generationId}-${controller.nextSeq}`;
  const motion: ActiveVehicleMotion = {
    animId,
    vehicleId: vehicle.id,
    generationId: controller.generationId,
    phase,
    waypoints,
    segmentLengths,
    totalLength,
    elapsedMs: 0,
    durationMs: Math.max(40, durationMs),
    progress: 0,
    kinematics: initialKinematics,
    completed: false,
    completionFired: false,
  };

  return {
    ...controller,
    nextSeq: controller.nextSeq + 1,
    kinematicsByVehicleId: {
      ...controller.kinematicsByVehicleId,
      [vehicle.id]: initialKinematics,
    },
    activeVehicleMotions: {
      ...controller.activeVehicleMotions,
      [vehicle.id]: motion,
    },
  };
}

/**
 * Sets or animates a vehicle's doors (`OPENING`, `OPEN`, `CLOSING`, `CLOSED`).
 */
export function setVehicleDoorTargetState(
  controller: AnimationControllerState,
  vehicleId: string,
  targetDoorState: DoorState
): AnimationControllerState {
  const kin = controller.kinematicsByVehicleId[vehicleId];
  if (!kin) return controller;

  const updatedKin: VehicleKinematics = {
    ...kin,
    doorState: targetDoorState,
    doorOpenProgress:
      targetDoorState === 'OPEN'
        ? 1
        : targetDoorState === 'CLOSED'
        ? 0
        : kin.doorOpenProgress,
  };

  return {
    ...controller,
    kinematicsByVehicleId: {
      ...controller.kinematicsByVehicleId,
      [vehicleId]: updatedKin,
    },
  };
}

/**
 * Applies a subtle suspension impulse to a stationary or boarding vehicle (clamped to [-2.5px, +2.5px]).
 */
export function triggerVehicleSuspensionImpulse(
  controller: AnimationControllerState,
  vehicleId: string,
  impulsePx: number = 1.4
): AnimationControllerState {
  const kin = controller.kinematicsByVehicleId[vehicleId];
  if (!kin) return controller;

  const clampedOffset = Math.max(
    -MAX_SUSPENSION_OFFSET_PX,
    Math.min(MAX_SUSPENSION_OFFSET_PX, kin.suspensionOffsetPx + impulsePx)
  );

  return {
    ...controller,
    kinematicsByVehicleId: {
      ...controller.kinematicsByVehicleId,
      [vehicleId]: {
        ...kin,
        suspensionOffsetPx: clampedOffset,
        suspensionVelocity: -impulsePx * 4,
      },
    },
  };
}

/**
 * Enqueues a synchronized passenger boarding animation toward `targetVehicleId`'s side entrance door.
 * Automatically transitions the target vehicle's doors to `OPENING` / `OPEN`.
 */
export function startPassengerBoardingAnimation(
  controller: AnimationControllerState,
  params: {
    passengerId: string;
    passengerColor: VehicleColor;
    targetVehicleId: string;
    targetBayIndex: number;
    seatIndex: number;
    startPoint?: Waypoint;
    doorEntrancePoint?: Waypoint;
    seatPoint?: Waypoint;
    durationMs?: number;
  }
): AnimationControllerState {
  // Prevent duplicate animation for the same passengerId
  if (
    controller.activePassengerAnims.some(
      (a) => a.passengerId === params.passengerId && !a.completed
    )
  ) {
    return controller;
  }

  const startPoint = params.startPoint || { x: 0, y: 0 };
  const doorEntrancePoint = params.doorEntrancePoint || {
    x: (params.targetBayIndex + 0.5) * 1.5,
    y: -0.8,
  };
  const seatPoint = params.seatPoint || {
    x: doorEntrancePoint.x + 0.2,
    y: -1.0,
  };

  const existingKin = controller.kinematicsByVehicleId[params.targetVehicleId];
  const updatedKinematicsMap = { ...controller.kinematicsByVehicleId };

  if (existingKin) {
    updatedKinematicsMap[params.targetVehicleId] = {
      ...existingKin,
      doorState: existingKin.doorOpenProgress >= 1 ? 'OPEN' : 'OPENING',
    };
  }

  const anim: ActivePassengerBoardingAnim = {
    animId: `pax-anim-${controller.generationId}-${controller.nextSeq}`,
    passengerId: params.passengerId,
    passengerColor: params.passengerColor,
    targetVehicleId: params.targetVehicleId,
    targetBayIndex: params.targetBayIndex,
    seatIndex: params.seatIndex,
    generationId: controller.generationId,
    stage: 'OPENING_DOOR',
    startPoint,
    doorEntrancePoint,
    seatPoint,
    currentPoint: { ...startPoint },
    elapsedMs: 0,
    durationMs: Math.max(40, params.durationMs ?? 160),
    progress: 0,
    completed: false,
    completionFired: false,
  };

  return {
    ...controller,
    nextSeq: controller.nextSeq + 1,
    kinematicsByVehicleId: updatedKinematicsMap,
    activePassengerAnims: [...controller.activePassengerAnims, anim],
  };
}

/**
 * Advances all active vehicle movements, wheel rotations, smooth turns, suspension springs,
 * door opening/closing states, and passenger boarding trajectories by `dtMs` milliseconds.
 *
 * Guarantees:
 * - Stationary vehicles (`speed === 0`) never rotate their wheels.
 * - Completed animations fire their completion event in `events` AT MOST ONCE.
 * - Vehicles stop at their exact final waypoint coordinates (`dest.x, dest.y`) with `speed === 0`.
 */
export function stepAnimationSystem(
  controller: AnimationControllerState,
  dtMs: number
): {
  nextController: AnimationControllerState;
  events: AnimationStepEvents;
} {
  const safeDtMs = Math.max(0, dtMs);
  const dtSec = safeDtMs / 1000;

  const events: AnimationStepEvents = {
    arrivedVehicleIds: [],
    departedVehicleIds: [],
    seatedPassengers: [],
  };

  if (safeDtMs === 0) {
    return { nextController: controller, events };
  }

  const nextKinematics: Record<string, VehicleKinematics> = {
    ...controller.kinematicsByVehicleId,
  };
  const nextVehicleMotions: Record<string, ActiveVehicleMotion> = {};

  // 1. Step active vehicle motions (acceleration, deceleration, turning, wheel rotation, suspension)
  for (const [vehicleId, motion] of Object.entries(controller.activeVehicleMotions)) {
    if (motion.generationId !== controller.generationId) {
      continue;
    }

    if (motion.completed) {
      continue;
    }

    const prevProfile = evaluateSmoothMotionProfile(motion.progress);
    const prevDist = prevProfile.distanceFraction * motion.totalLength;

    const nextElapsed = Math.min(motion.durationMs, motion.elapsedMs + safeDtMs);
    const nextProgress = nextElapsed / motion.durationMs;
    const isNowComplete = nextProgress >= 1;

    const profile = evaluateSmoothMotionProfile(nextProgress);
    const currentDist = profile.distanceFraction * motion.totalLength;
    const deltaDist = Math.max(0, currentDist - prevDist);

    const sampled = sampleWaypointPath(
      motion.waypoints,
      motion.segmentLengths,
      motion.totalLength,
      profile.distanceFraction
    );

    const instantSpeed =
      isNowComplete || dtSec <= 0 ? 0 : deltaDist / dtSec;

    // Wheels ONLY rotate when instantaneous speed > 0 (deltaDist > 0)
    const nextWheelDeg =
      instantSpeed > 0
        ? (motion.kinematics.wheelRotationDeg +
            deltaDist * WHEEL_DEG_PER_DISTANCE_UNIT) %
          3600
        : motion.kinematics.wheelRotationDeg;

    // Smooth angular heading alignment with path tangent
    const turnBlend = Math.min(1, safeDtMs / 65);
    const nextHeadingDeg = isNowComplete
      ? sampled.tangentHeadingDeg
      : lerpShortestAngleDeg(
          motion.kinematics.headingDeg,
          sampled.tangentHeadingDeg,
          turnBlend
        );

    // Subtle suspension pitch proportional to acceleration, clamped to [-2.5, +2.5]px, 0 when stopped
    const rawSuspension = isNowComplete
      ? 0
      : Math.max(
          -MAX_SUSPENSION_OFFSET_PX,
          Math.min(MAX_SUSPENSION_OFFSET_PX, profile.normalizedAccel * 0.28)
        );

    const finalPoint = isNowComplete
      ? motion.waypoints[motion.waypoints.length - 1]
      : sampled.point;

    const updatedKin: VehicleKinematics = {
      ...motion.kinematics,
      x: finalPoint.x,
      y: finalPoint.y,
      headingDeg: nextHeadingDeg,
      speed: instantSpeed,
      wheelRotationDeg: nextWheelDeg,
      suspensionOffsetPx: rawSuspension,
      suspensionVelocity: 0,
      doorState: isNowComplete && motion.phase === 'TO_BAY' ? 'OPENING' : 'CLOSED',
      doorOpenProgress: 0,
    };

    nextKinematics[vehicleId] = updatedKin;

    const updatedMotion: ActiveVehicleMotion = {
      ...motion,
      elapsedMs: nextElapsed,
      progress: nextProgress,
      kinematics: updatedKin,
      completed: isNowComplete,
      completionFired: isNowComplete ? true : motion.completionFired,
    };

    if (isNowComplete && !motion.completionFired) {
      if (motion.phase === 'TO_BAY') {
        events.arrivedVehicleIds.push(vehicleId);
      } else {
        events.departedVehicleIds.push(vehicleId);
      }
    } else if (!isNowComplete) {
      nextVehicleMotions[vehicleId] = updatedMotion;
    }
  }

  // 2. Step door animations & stationary suspension damping for all stationary vehicles
  const doorRatePerSec = 6.5; // Opens/closes in ~150ms
  for (const [vehicleId, kin] of Object.entries(nextKinematics)) {
    if (nextVehicleMotions[vehicleId]) {
      continue; // Already updated above
    }

    let nextDoorProgress = kin.doorOpenProgress;
    let nextDoorState = kin.doorState;

    if (kin.doorState === 'OPENING') {
      nextDoorProgress = Math.min(1, kin.doorOpenProgress + doorRatePerSec * dtSec);
      if (nextDoorProgress >= 1) {
        nextDoorState = 'OPEN';
      }
    } else if (kin.doorState === 'CLOSING') {
      nextDoorProgress = Math.max(0, kin.doorOpenProgress - doorRatePerSec * dtSec);
      if (nextDoorProgress <= 0) {
        nextDoorState = 'CLOSED';
      }
    }

    // Critically damped spring decay for stationary suspension offset; wheels stay strictly frozen (speed = 0)
    const decay = Math.exp(-12 * dtSec);
    const nextSuspOffset =
      Math.abs(kin.suspensionOffsetPx) < 0.05 ? 0 : kin.suspensionOffsetPx * decay;

    if (
      nextDoorProgress !== kin.doorOpenProgress ||
      nextDoorState !== kin.doorState ||
      nextSuspOffset !== kin.suspensionOffsetPx ||
      kin.speed !== 0
    ) {
      nextKinematics[vehicleId] = {
        ...kin,
        speed: 0, // Stationary guarantee
        doorState: nextDoorState,
        doorOpenProgress: nextDoorProgress,
        suspensionOffsetPx: nextSuspOffset,
      };
    }
  }

  // 3. Step active passenger boarding sequences (synchronized with target bus doors!)
  const nextPassengerAnims: ActivePassengerBoardingAnim[] = [];

  for (const paxAnim of controller.activePassengerAnims) {
    if (paxAnim.generationId !== controller.generationId || paxAnim.completed) {
      continue;
    }

    // Ensure target vehicle's door is opening/open while passenger approaches
    const targetKin = nextKinematics[paxAnim.targetVehicleId];
    if (targetKin && targetKin.doorState === 'CLOSED') {
      nextKinematics[paxAnim.targetVehicleId] = {
        ...targetKin,
        doorState: 'OPENING',
      };
    }

    const nextElapsed = Math.min(paxAnim.durationMs, paxAnim.elapsedMs + safeDtMs);
    const nextProgress = nextElapsed / paxAnim.durationMs;
    const isNowSeated = nextProgress >= 1;

    let currentPoint: Waypoint;
    let stage: ActivePassengerBoardingAnim['stage'];

    if (nextProgress < 0.55) {
      stage = 'APPROACHING_DOOR';
      const localT = nextProgress / 0.55;
      const smoothT = evaluateSmoothMotionProfile(localT).distanceFraction;
      currentPoint = {
        x:
          paxAnim.startPoint.x +
          (paxAnim.doorEntrancePoint.x - paxAnim.startPoint.x) * smoothT,
        y:
          paxAnim.startPoint.y +
          (paxAnim.doorEntrancePoint.y - paxAnim.startPoint.y) * smoothT,
      };
    } else if (!isNowSeated) {
      stage = 'STEPPING_IN';
      const localT = (nextProgress - 0.55) / 0.45;
      const smoothT = evaluateSmoothMotionProfile(localT).distanceFraction;
      currentPoint = {
        x:
          paxAnim.doorEntrancePoint.x +
          (paxAnim.seatPoint.x - paxAnim.doorEntrancePoint.x) * smoothT,
        y:
          paxAnim.doorEntrancePoint.y +
          (paxAnim.seatPoint.y - paxAnim.doorEntrancePoint.y) * smoothT,
      };
    } else {
      stage = 'SEATED';
      currentPoint = { ...paxAnim.seatPoint };
    }

    if (isNowSeated && !paxAnim.completionFired) {
      events.seatedPassengers.push({
        passengerId: paxAnim.passengerId,
        targetVehicleId: paxAnim.targetVehicleId,
        seatIndex: paxAnim.seatIndex,
      });

      // Trigger a subtle suspension dip on the target vehicle as the passenger sits down
      const busKin = nextKinematics[paxAnim.targetVehicleId];
      if (busKin) {
        nextKinematics[paxAnim.targetVehicleId] = {
          ...busKin,
          doorState: 'OPEN',
          doorOpenProgress: 1,
          suspensionOffsetPx: Math.min(
            MAX_SUSPENSION_OFFSET_PX,
            busKin.suspensionOffsetPx + 1.2
          ),
        };
      }
    } else if (!isNowSeated) {
      nextPassengerAnims.push({
        ...paxAnim,
        elapsedMs: nextElapsed,
        progress: nextProgress,
        stage,
        currentPoint,
      });
    }
  }

  return {
    nextController: {
      ...controller,
      kinematicsByVehicleId: nextKinematics,
      activeVehicleMotions: nextVehicleMotions,
      activePassengerAnims: nextPassengerAnims,
    },
    events,
  };
}

/**
 * Safely cancels all in-flight vehicle, door, wheel, suspension, and passenger animations
 * and resets vehicle kinematics to match the provided `vehicles` list (e.g., on level restart or transition).
 */
export function cancelAndResetAnimations(
  controller: AnimationControllerState,
  vehicles: Vehicle[]
): AnimationControllerState {
  const kinematicsByVehicleId: Record<string, VehicleKinematics> = {};
  for (const v of vehicles) {
    kinematicsByVehicleId[v.id] = createInitialVehicleKinematics(v);
  }
  return {
    generationId: controller.generationId + 1,
    nextSeq: 1,
    kinematicsByVehicleId,
    activeVehicleMotions: {},
    activePassengerAnims: [],
  };
}
