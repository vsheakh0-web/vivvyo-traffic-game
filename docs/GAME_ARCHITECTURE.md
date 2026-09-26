# Bus Jam Mobile — Game Architecture (`GAME_ARCHITECTURE.md`)

**Document Purpose:**  
1. Document the **exact current architecture** of the repository as inspected on disk.  
2. Define the **target production architecture** for upgrading the project into a 100-level mobile-only Bus Jam puzzle game while preserving the existing React 19 + TypeScript + Vite 8 + Tailwind CSS 4 technology stack.

---

## Part 1: Current Repository Architecture (As-Is)

### 1. Current Directory & File Map

```text
/
├── .env.example          # Environment variable template (GEMINI_API_KEY, APP_URL)
├── .gitignore            # Git ignore patterns
├── bun.lock              # Package lockfile
├── index.html            # Single-page HTML shell mounting #root
├── metadata.json         # AI Studio applet metadata (currently empty strings)
├── package.json          # Project scripts (dev, build, preview, clean, lint) & dependencies
├── tsconfig.json         # TypeScript ES2022 + react-jsx configuration
├── vite.config.ts        # Vite 8 bundler config with React & Tailwind v4 plugins
└── src/
    ├── main.tsx          # React 19 StrictMode root mount
    ├── App.tsx           # Empty placeholder component: export default function App() { return <div></div>; }
    └── index.css         # Tailwind v4 entry: @import "tailwindcss";
```

### 2. Current Data Flow & Runtime Lifecycle

```text
index.html (#root)
  └── src/main.tsx (createRoot)
        └── src/App.tsx (renders empty <div></div>)
```

- **State Management:** None implemented.
- **Asset Pipeline:** Vite static asset bundler configured, no assets present.
- **Engine Limitations of Current Stack:**
  - The current stack is a web-first React 19 + Vite SPA rather than Unity or native Kotlin/Jetpack Compose.
  - However, React 19 + TypeScript + HTML5 Canvas / WebGL + Tailwind CSS + Web Audio API is fully capable of delivering a rock-solid 60 FPS mobile Bus Jam game inside mobile browsers, WebViews, PWAs, and AI Studio's preview runtime **without** migrating to an external non-web engine.

---

## Part 2: Target Architecture for the Bus Jam Mobile Upgrade

To honor the organizational principles in the **Bus Jam Mobile — Folder Structure Starter** while keeping Vite/React/TypeScript files in their standard locations (`src/`), the upgraded codebase maps cleanly to modular domain boundaries:

```text
/
├── docs/
│   ├── PROJECT_AUDIT.md          # Full audit of initial repository state
│   ├── GAME_ARCHITECTURE.md      # Current + target technical architecture
│   └── UPGRADE_ROADMAP.md        # Prioritized 100-level engineering roadmap
├── src/
│   ├── assets/                   # Visual & procedural SVG/Canvas sprite definitions, color palettes, themes
│   │   ├── vehicleSprites.ts     # Isometric/top-down 2.5D vehicle renderers (4-seat Van, 6-seat Bus, 8-seat Coach)
│   │   └── colorPalette.ts       # High-contrast color + colorblind symbol definitions (8 distinct passenger/bus colors)
│   ├── game/                     # Pure TypeScript gameplay systems (decoupled from React UI)
│   │   ├── types.ts              # Core data contracts (Vehicle, Passenger, ParkingBay, LevelConfig, GameState)
│   │   ├── collisionEngine.ts    # Grid spatial occupancy, directional raycasting & traffic-blocking checks
│   │   ├── boardingEngine.ts     # FIFO passenger queue matching, seat filling, departure triggers, deadlock detection
│   │   ├── levelGenerator.ts     # Deterministic 100-level generator + hand-tuned milestone levels & difficulty curve
│   │   ├── levelValidator.ts     # Reverse-construction & BFS/greedy solvability verifier + seat-parity invariant check
│   │   ├── audioManager.ts       # Web Audio API procedural sound effects (engine rev, horn, pop boarding, win fanfare)
│   │   └── storageManager.ts     # Persistent save state (unlocked level, stars, coins, boosters, audio/haptic settings)
│   ├── components/               # Mobile-first UI & Interactive Viewport components
│   │   ├── MobileShell.tsx       # Locked 9:16 mobile viewport container with touch-action & safe-area protection
│   │   ├── TopHud.tsx            # Compact level header, passenger counter, coin balance, and pause/settings trigger
│   │   ├── PassengerQueueView.tsx# Animated snake/line queue showing upcoming passengers and active boarding zone
│   │   ├── ParkingBaysView.tsx   # 4–7 active & VIP holding bays with capacity progress & waiting vehicles
│   │   ├── ParkingLotCanvas.tsx  # Interactive 2.5D parking lot board with directional vehicles, obstacles & exit roads
│   │   ├── BoosterDock.tsx       # Thumb-zone bottom bar: Undo, VIP Slot, Shuffle Vehicles, Sort Passengers
│   │   ├── LevelSelectModal.tsx  # 100-level progression map with difficulty tiers and completion stars
│   │   └── ResultModals.tsx      # Level Complete (coin reward Breakdown) & Out of Space / Revive / Retry modals
│   ├── tests/                    # Automated validation & unit test suite
│   │   └── validateAllLevels.ts  # Verifies all 100 levels pass seat-count parity and exit-path solvability
│   ├── App.tsx                   # Root state machine orchestrator (HOME -> PLAYING -> PAUSED -> VICTORY / JAMMED)
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Tailwind v4 + custom mobile touch & keyframe utilities
```

---

## Part 3: Core Gameplay Subsystem Specifications

### 1. Coordinate System, Vehicle Footprints & Traffic Blocking (`collisionEngine.ts`)

- **Grid Topology:** Each level defines an $W \times H$ parking grid (ranging from $6 \times 6$ in early tutorial levels up to $10 \times 12$ in master levels) surrounded by a perimeter transit road leading to the **Parking Bays**.
- **Vehicle Entity Contract:**
  ```typescript
  export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  export type VehicleColor = 'RED' | 'BLUE' | 'GREEN' | 'AMBER' | 'PURPLE' | 'CYAN' | 'PINK' | 'ORANGE';
  export type VehicleCapacity = 4 | 6 | 8; // 4 = Mini-Shuttle (2 cells), 6 = City Bus (3 cells), 8 = Mega Coach (4 cells)

  export interface Vehicle {
    id: string;
    color: VehicleColor;
    capacity: VehicleCapacity;
    occupiedSeats: number;
    gridX: number;         // Head/anchor X coordinate on grid
    gridY: number;         // Head/anchor Y coordinate on grid
    length: 2 | 3 | 4;     // Grid cells occupied along orientation axis
    direction: Direction;  // Exit travel direction
    state: 'PARKED_IN_LOT' | 'MOVING_TO_BAY' | 'IN_BAY' | 'DEPARTING' | 'CLEARED';
    isMystery?: boolean;   // Question-mark bus whose color reveals only when unblocked
    isLocked?: boolean;    // Garage/barrier mechanics introduced in higher levels
  }
  ```
- **Line-of-Sight Blocking Algorithm:**
  - When a player taps a vehicle in `PARKED_IN_LOT` state, `canVehicleExit(vehicle, allVehicles, obstacles, gridBounds)` traces a ray from the front cell of `vehicle` along `vehicle.direction` to the perimeter road edge.
  - If any cell along that ray is occupied by another `PARKED_IN_LOT` vehicle or static obstacle, the move is **blocked**:
    - The tapped vehicle plays a directional bump/recoil animation toward the blocker.
    - The blocking vehicle flashes briefly to give clear visual feedback.
    - A subtle low-pitched horn/bump SFX plays.
  - If the ray reaches the perimeter road unimpeded **and** at least one Parking Bay is free, the vehicle transitions to `MOVING_TO_BAY`, immediately freeing its grid cells and animating along the perimeter road into the leftmost available bay.

### 2. Parking Bays & FIFO Passenger Boarding (`boardingEngine.ts`)

- **Parking Bays:**
  - Standard bays: `4` active bays (plus `1` VIP/Booster bay and `2` coin-unlockable/ad-free expansion bays, totaling up to `7` bays).
  - Each bay holds at most one vehicle in `IN_BAY` state.
- **FIFO Passenger Queue:**
  - The level specifies an ordered array of passengers `PassengerColor[]` waiting along the sidewalk walkway.
  - **Deterministic Boarding Loop:**
    1. Whenever a vehicle arrives in a bay (`IN_BAY`) or a passenger finishes stepping onto a bus, the boarding engine checks `queue[0]` (the front passenger).
    2. It scans all vehicles currently in `IN_BAY` state that match `queue[0].color` and have `occupiedSeats < capacity`.
    3. To maximize player help, if multiple bays have vehicles of the same color, the engine prioritizes the vehicle with the **fewest remaining empty seats** (so it fills and departs fastest, freeing a bay!).
    4. The front passenger pops from `queue[0]`, animates into the target vehicle seat, and increments `occupiedSeats`.
    5. As soon as `occupiedSeats === capacity`, the vehicle state transitions to `DEPARTING`, plays a celebratory chime/engine rev, drives off-screen to the right, and frees its Parking Bay slot.

### 3. Win & Failure (Deadlock) Resolution

- **Victory Condition:** `queue.length === 0` and all vehicles have departed (`CLEARED`).
- **Jam / Failure Condition:**
  - Evaluated only after all in-flight vehicles (`MOVING_TO_BAY`) have settled into `IN_BAY` and all currently possible passenger boardings have completed.
  - If **all unlocked bays are occupied** by `IN_BAY` vehicles, **none** of those vehicles are full, and `queue[0].color` does **not** match any `IN_BAY` vehicle's color, a **Parking Lot Jam** is triggered.
  - The player is offered either:
    1. **Use VIP Slot / Clear Bay Booster** (or spend coins to open an extra bay / shuffle passengers) to continue, OR
    2. **Retry Level** (instant zero-reload reset).

### 4. 100-Level Architecture & Solvability Guarantee (`levelGenerator.ts` & `levelValidator.ts`)

- Every one of the **100 playable levels** is generated deterministically from its level number (`levelIndex: 1..100`) using a **Reverse-Peel Constructive Algorithm**:
  1. Vehicles of varied sizes (`2`, `3`, `4` cells; `4`, `6`, `8` seats) are placed on the grid without overlap.
  2. A valid **extraction order** $V_1, V_2, \dots, V_k$ is computed by iteratively peeling vehicles that currently have an unobstructed line-of-sight exit ray to the perimeter road (assigning or adjusting exit directions so zero cyclic deadlocks can occur).
  3. The **Passenger FIFO Queue** is constructed directly from the valid vehicle extraction sequence $V_1, V_2, \dots, V_k$ with controlled local window permutations (bounded by `unlockedBays - 1`), **mathematically guaranteeing**:
     - Exact seat parity: $\forall \text{color } c, \sum \text{Passengers}(c) = \sum \text{Seats}(c)$.
     - 100% solvability without boosters using standard 4 bays.
     - Progressive difficulty across 100 levels (introducing more colors, larger grids, tighter queue batching, mystery buses, and multi-layer blocking).
