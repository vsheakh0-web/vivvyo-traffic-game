export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type VehicleColor =
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'AMBER'
  | 'PURPLE'
  | 'CYAN'
  | 'PINK'
  | 'ORANGE';

export type VehicleCapacity = 4 | 6 | 8;
export type VehicleLength = 2 | 3 | 4;

export type CarModelVariant =
  | 'SPORT_COUPE'
  | 'LUXURY_SUV'
  | 'TOURING_HATCH';

export type VehicleMeshArchetypeId =
  | 'CAR_SPORT_COUPE'
  | 'CAR_LUXURY_SUV'
  | 'CAR_TOURING_HATCH'
  | 'VAN_EXECUTIVE_MINIBUS'
  | 'BUS_ARTICULATED_COACH';

export type VehicleState =
  | 'PARKED_IN_LOT'
  | 'MOVING_TO_BAY'
  | 'IN_BAY'
  | 'DEPARTING'
  | 'CLEARED';

export type DoorState = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';

export type GameStatus =
  | 'LOADING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETED'
  | 'LEVEL_FAILED';

export type AppScreen = 'MAIN_MENU' | 'GAMEPLAY';

export type BoosterType = 'VIP' | 'PICK' | 'SHUFFLE';

export type EnvironmentThemeId =
  | 'MODERN_CITY'
  | 'SUBURBAN_STREETS'
  | 'COASTAL_ROADS'
  | 'INDUSTRIAL_DISTRICT'
  | 'GREEN_PARK'
  | 'NIGHTTIME_CITY';

export type LevelArchetypeId =
  | 'OPEN_PLAZA'
  | 'CROSSROADS'
  | 'PERIMETER_RING'
  | 'SPIRAL_VORTEX'
  | 'DUAL_CORRIDOR'
  | 'PINWHEEL_LOCK'
  | 'CHESSBOARD_BAYS'
  | 'BOTTLENECK_GATE'
  | 'CENTRAL_ISLAND'
  | 'TERMINAL_GRID';

export interface GridPoint {
  x: number;
  y: number;
}

export interface VehicleKinematics {
  x: number; // Normalized or pixel X coordinate along trajectory
  y: number; // Normalized or pixel Y coordinate along trajectory
  headingDeg: number; // Smoothly interpolated orientation angle (0=UP, 90=RIGHT, 180=DOWN, 270=LEFT)
  speed: number; // Instantaneous speed (units/sec); 0 when stationary
  wheelRotationDeg: number; // Cumulative wheel rotation angle; only changes when speed > 0
  suspensionOffsetPx: number; // Subtle vertical suspension displacement (-2.5..+2.5px)
  suspensionVelocity: number; // Spring velocity for damped harmonic suspension
  doorState: DoorState;
  doorOpenProgress: number; // 0 (fully closed) to 1 (fully open)
}

export interface Vehicle {
  id: string;
  color: VehicleColor;
  capacity: VehicleCapacity;
  occupiedSeats: number;
  boardedPassengerIds: string[];
  gridX: number; // Anchor (head/front bumper) X cell in the parking lot
  gridY: number; // Anchor (head/front bumper) Y cell in the parking lot
  length: VehicleLength; // Number of grid cells occupied extending backward from head
  direction: Direction; // Facing / exit direction
  state: VehicleState;
  assignedBayId: string | null;
  isMystery?: boolean; // Hidden color until unblocked or shuffled
  carVariant?: CarModelVariant; // Optional explicit car body style (Sport Coupe, Luxury SUV, Touring Hatch)
}

export interface Passenger {
  id: string;
  color: VehicleColor;
  boarded: boolean;
}

export interface ParkingBay {
  id: string;
  index: number;
  isVip: boolean;
  isUnlocked: boolean;
  vehicleId: string | null;
  reservedByVehicleId: string | null;
}

export interface GridObstacle {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface BlockedMoveFeedback {
  vehicleId: string;
  blockerVehicleId: string | null;
  blockerObstacleId: string | null;
  blockedCell: GridPoint;
  direction: Direction;
  timestamp: number;
}

export interface LevelData {
  levelNumber: number;
  tierName: string;
  archetype?: LevelArchetypeId;
  environmentTheme?: EnvironmentThemeId;
  gridWidth: number;
  gridHeight: number;
  vehicles: Vehicle[];
  passengers: Passenger[];
  obstacles: GridObstacle[];
  unlockedStandardBays: number;
  solutionOrder?: string[]; // Verified constructive extraction sequence of vehicle IDs
}

export interface LevelSnapshot {
  levelNumber: number;
  tierName: string;
  archetype?: LevelArchetypeId;
  environmentTheme?: EnvironmentThemeId;
  gridWidth: number;
  gridHeight: number;
  vehicles: Vehicle[];
  passengers: Passenger[];
  obstacles: GridObstacle[];
  unlockedStandardBays: number;
}

export interface GameState {
  levelNumber: number;
  tierName: string;
  archetype?: LevelArchetypeId;
  environmentTheme: EnvironmentThemeId;
  status: GameStatus;
  gridWidth: number;
  gridHeight: number;
  vehicles: Vehicle[];
  passengerQueue: Passenger[];
  totalPassengers: number;
  boardedPassengersCount: number;
  bays: ParkingBay[];
  obstacles: GridObstacle[];
  selectedVehicleId: string | null;
  blockedFeedback: BlockedMoveFeedback | null;
  activeBoosterMode: 'NONE' | 'VIP_SELECT';
  moveCount: number;
  boostersUsedCount: number;
  victoryTriggerCount: number;
  failureTriggerCount: number;
  rewardClaimed?: boolean;
  lastActionMessage: string | null;
  initialSnapshot: LevelSnapshot;
}

export interface MoveResult {
  nextState: GameState;
  outcome:
    | 'MOVED_TO_BAY'
    | 'MOVED_TO_VIP_BAY'
    | 'BLOCKED_BY_VEHICLE'
    | 'BLOCKED_BY_OBSTACLE'
    | 'NO_FREE_BAY'
    | 'INVALID_STATE'
    | 'INVALID_VEHICLE';
  blockerVehicleId?: string | null;
  blockerObstacleId?: string | null;
  targetBayId?: string | null;
}

export interface PickBoosterResult {
  nextState: GameState;
  applied: boolean;
  reason?: string;
  targetVehicleId: string | null;
  pickedPassengerIds: string[];
  departed: boolean;
}

export interface ShuffleBoosterResult {
  nextState: GameState;
  applied: boolean;
  reason?: string;
  swappedVehicleCount: number;
  revealedMysteryCount: number;
}

export interface BoardingStepResult {
  nextState: GameState;
  boardedPassengerId: string | null;
  targetVehicleId: string | null;
  departedVehicleIds: string[];
  didCompleteLevel: boolean;
  didFailLevel: boolean;
}

export type VisualEffectType =
  | 'VEHICLE_MOVE_TRAIL'
  | 'VEHICLE_STOP_BRAKE'
  | 'VEHICLE_DEPART_PUFF'
  | 'PASSENGER_BOARD_POP'
  | 'BUS_FULL_MATCH'
  | 'LEVEL_COMPLETE_BURST'
  | 'LEVEL_FAILED_ALERT'
  | 'COIN_COLLECT'
  | 'BOOSTER_FLASH';

export interface VisualEffectItem {
  id: string;
  type: VisualEffectType;
  label?: string;
  colorHex: string;
  xPercent: number;
  yPercent: number;
  createdAt: number;
}

export interface PlayerSaveData {
  schemaVersion?: number;
  unlockedLevel: number;
  currentLevel: number;
  coins: number;
  starsByLevel: Record<number, number>;
  completedLevels?: Record<number, boolean>;
  rewardedLevels?: Record<number, boolean>;
  boosters: {
    VIP: number;
    PICK: number;
    SHUFFLE: number;
  };
  extraBaysUnlocked: number; // 0..2 permanent/session extra bays
  soundEnabled: boolean;
  musicEnabled?: boolean;
  sfxVolume?: number; // 0..1
  musicVolume?: number; // 0..1
  colorblindMode: boolean;
  preferredTheme: EnvironmentThemeId | 'AUTO';
  qaUnlockAllLevels: boolean;
  lastSavedAt?: number;
}
