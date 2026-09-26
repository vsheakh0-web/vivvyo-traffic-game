# Bus Jam Mobile — Complete Development & Upgrade Plan (`COMPLETE_DEVELOPMENT_PLAN.md`)

**Target Platform:** Android Mobile & Mobile Touch Viewports (Portrait `9:16` Mobile-Only Interface; zero desktop-specific gameplay chrome).  
**Baseline Stack:** React 19 + TypeScript 7 + Vite 8 + Tailwind CSS 4 + HTML5 Canvas / SVG 2.5D Renderer + Web Audio API.  
**Reference Audit:** Based directly on `docs/PROJECT_AUDIT.md`, `docs/GAME_ARCHITECTURE.md`, and `docs/UPGRADE_ROADMAP.md`.

---

## Technology Assessment & Architectural Preservation

As documented in `docs/PROJECT_AUDIT.md`, the existing repository is a TypeScript + React 19 + Vite 8 web application where `src/App.tsx` is currently an empty stub (`<div></div>`).
- **Preservation Principle:** We preserve `package.json`, `vite.config.ts`, `tsconfig.json`, and `src/main.tsx`, building the entire Bus Jam mobile engine cleanly inside `src/game/`, `src/assets/`, `src/components/`, and `src/tests/`.
- **3D Rendering Limitation & Realistic Alternative:** Neither Unity nor Three.js is installed in the baseline `package.json`. Installing a heavy 3D physics/model pipeline without pre-existing `.glb` assets adds bundle bloat and memory pressure on budget Android devices. Instead, we implement a **high-craft 2.5D Isometric/Elevated Top-Down Layered Renderer** (using hardware-accelerated SVG/Canvas + CSS 3D perspective depth, directional roof shading, real-time ambient shadows, and open-top visible passenger seating) that achieves the recognizable Bus Jam 3D diorama aesthetic at a locked 60 FPS on mobile devices.
- **Android Packaging Path:** The Vite build outputs a mobile-locked WebApp/PWA (`dist/`) that runs natively in Android Chrome WebViews and can be wrapped into an Android `.apk`/`.aab` in one command via Capacitor (`@capacitor/android`) without altering a single line of gameplay code.

---

## Detailed Plan Across All 20 Required Systems

---

### 1. Core Gameplay Architecture

* **Purpose:** Provide a deterministic, engine-agnostic state machine and command reducer that governs all Bus Jam entities (vehicles, passengers, bays, obstacles, boosters, and game states) without UI race conditions.
* **Existing Implementation:** None (`src/App.tsx` returns `<div></div>`).
* **Required Improvements:** Create a pure TypeScript state engine (`src/game/types.ts`, `src/game/gameEngine.ts`) implementing explicit state transitions (`LOADING`, `READY`, `PLAYING`, `PAUSED`, `LEVEL_COMPLETED`, `LEVEL_FAILED`), atomic move validation, and immutable state snapshots for instant level restart.
* **Files Likely to Change:**
  - `src/game/types.ts` (new)
  - `src/game/gameEngine.ts` (new)
  - `src/App.tsx` (update)
* **Dependencies on Other Systems:** None (foundational layer).
* **Implementation Steps:**
  1. Define strict TypeScript interfaces for `Vehicle`, `Passenger`, `ParkingBay`, `GridObstacle`, `LevelData`, and `GameState`.
  2. Implement pure state transition functions: `createGameStateFromLevel`, `selectAndMoveVehicle`, `stepBoardingTick`, `completeVehicleTransit`, `setGameStatus`, and `restartLevelState`.
  3. Enforce idempotency guards so duplicate events or rapid taps during animations cannot corrupt state.
* **Acceptance Criteria:**
  - All 6 required game states (`LOADING`, `READY`, `PLAYING`, `PAUSED`, `LEVEL_COMPLETED`, `LEVEL_FAILED`) transition deterministically.
  - Game logic runs both headlessly in automated tests and interactively in React.
* **Tests Required:**
  - State machine lifecycle tests (`LOADING -> READY -> PLAYING -> PAUSED -> PLAYING -> LEVEL_COMPLETED / LEVEL_FAILED`).
  - Idempotency tests verifying actions are ignored when status is `PAUSED`, `LEVEL_COMPLETED`, or `LEVEL_FAILED`.

---

### 2. Vehicle Movement and Traffic Blocking

* **Purpose:** Calculate multi-cell vehicle footprints on the parking lot grid, validate line-of-sight exit rays along each vehicle's facing direction, move unblocked vehicles along the perimeter road to a bay, and block obstructed vehicles with clear visual feedback.
* **Existing Implementation:** None.
* **Required Improvements:** Implement a spatial grid occupancy map and directional raycaster (`src/game/collisionEngine.ts`) that checks every cell between a vehicle's front bumper and the perimeter road exit.
* **Files Likely to Change:**
  - `src/game/collisionEngine.ts` (new)
  - `src/game/gameEngine.ts` (new)
* **Dependencies on Other Systems:** System 1 (Core Gameplay Architecture), System 4 (Parking Bay Management).
* **Implementation Steps:**
  1. Compute occupied grid cells for each vehicle based on `(gridX, gridY)`, `length` (`2`, `3`, or `4`), and `direction` (`UP`, `DOWN`, `LEFT`, `RIGHT`).
  2. Implement `checkVehicleExitPath(vehicle, vehicles, obstacles, gridWidth, gridHeight)` to trace the forward ray to the grid edge.
  3. If blocked by another `PARKED_IN_LOT` vehicle or `GridObstacle`, return the blocking entity ID and collision cell without moving the vehicle.
  4. If clear and a bay is available, transition the vehicle to `MOVING_TO_BAY` (or `IN_BAY` in instant resolution), free its grid cells immediately, and compute its perimeter road path.
* **Acceptance Criteria:**
  - Vehicles never pass through other vehicles, passengers, or barriers.
  - Blocked vehicles remain in their exact grid cells and trigger a directional recoil shake + blocker highlight.
* **Tests Required:**
  - Valid unblocked exit moves in all 4 directions (`UP`, `DOWN`, `LEFT`, `RIGHT`).
  - Blocked path detection when another vehicle or obstacle sits directly or 3 cells ahead on the exit ray.
  - Verification that blocked moves leave grid occupancy and bay state completely unchanged.

---

### 3. Passenger Matching and Boarding

* **Purpose:** Match waiting passengers from the front of the FIFO queue to color-matched vehicles parked in active bays, track seat occupancy accurately, prevent double-boarding, and trigger vehicle departure when full.
* **Existing Implementation:** None.
* **Required Improvements:** Implement `src/game/boardingEngine.ts` with strict passenger ID deduplication, FIFO color matching, priority routing to the fullest matching bus, and automatic departure on capacity completion.
* **Files Likely to Change:**
  - `src/game/boardingEngine.ts` (new)
  - `src/game/gameEngine.ts` (new)
* **Dependencies on Other Systems:** System 1 (Core Gameplay Architecture), System 4 (Parking Bay Management).
* **Implementation Steps:**
  1. Inspect `passengerQueue[0]` (front waiting passenger).
  2. Filter bays for vehicles in `IN_BAY` state where `vehicle.color === passengerQueue[0].color` and `vehicle.occupiedSeats < vehicle.capacity`.
  3. Sort candidate vehicles descending by `occupiedSeats` (so a bus with 3/4 seats fills and frees its bay before a bus with 0/4 seats).
  4. Atomically pop `passengerQueue[0]`, append `passenger.id` to `vehicle.boardedPassengerIds` (rejecting if already present), and increment `vehicle.occupiedSeats`.
  5. When `vehicle.occupiedSeats === vehicle.capacity`, transition the vehicle to `DEPARTING` -> `CLEARED` and vacate its bay.
* **Acceptance Criteria:**
  - Passengers only board vehicles matching their exact color in `IN_BAY` state.
  - A vehicle never exceeds its `capacity` (`4`, `6`, or `8`).
  - No passenger is ever loaded more than once.
* **Tests Required:**
  - Color matching and non-matching rejection tests.
  - Vehicle capacity enforcement (`4`, `6`, and `8` seat limits) and automatic bay release upon reaching capacity.
  - Duplicate boarding prevention guard test.

---

### 4. Parking Bay Management

* **Purpose:** Manage available, reserved, occupied, locked, and VIP holding bays so vehicles moving from the lot have a guaranteed single-occupancy staging slot for passenger boarding.
* **Existing Implementation:** None.
* **Required Improvements:** Implement atomic bay allocation, reservation tracking during transit, and bay release on departure.
* **Files Likely to Change:**
  - `src/game/boardingEngine.ts` (new)
  - `src/game/gameEngine.ts` (new)
  - `src/components/ParkingBaysView.tsx` (new)
* **Dependencies on Other Systems:** System 1 (Core Gameplay Architecture), System 2 (Vehicle Movement).
* **Implementation Steps:**
  1. Initialize 4 unlocked standard bays (`bay-0`..`bay-3`), 1 VIP booster bay (`bay-vip`), and 2 coin-unlockable expansion bays (`bay-4`, `bay-5`).
  2. Implement `findAvailableStandardBay(bays)` checking `isUnlocked && !isVip && vehicleId === null && reservedByVehicleId === null`.
  3. Reserve the bay immediately when a vehicle enters `MOVING_TO_BAY`, convert reservation to `vehicleId` on `IN_BAY` arrival, and clear both fields when the vehicle departs.
* **Acceptance Criteria:**
  - Multiple vehicles can never occupy or reserve the same bay simultaneously, even under rapid multi-touch input.
  - When all unlocked bays are occupied or reserved, tapping another lot vehicle is cleanly rejected with a "Bays Full" indicator.
* **Tests Required:**
  - Single-bay occupancy invariant test under sequential and rapid parallel move attempts.
  - Bay release and reuse test after a vehicle fills and departs.

---

### 5. Level Loading and Level Progression

* **Purpose:** Load any of the 100 playable levels deterministically, initialize its entities, reveal mystery vehicles as neighbors clear, and advance the player through levels 1 to 100.
* **Existing Implementation:** None.
* **Required Improvements:** Build `src/game/levelGenerator.ts` providing 100 deterministic, progressively challenging levels and a level loader that transitions cleanly from `LOADING` -> `READY` -> `PLAYING`.
* **Files Likely to Change:**
  - `src/game/levelGenerator.ts` (new)
  - `src/game/gameEngine.ts` (new)
* **Dependencies on Other Systems:** System 1 (Core Gameplay Architecture), System 14 (Save System), System 15 (Level Validation).
* **Implementation Steps:**
  1. Implement a seeded PRNG (`mulberry32`) so each level `1..100` produces the exact same layout across all sessions and devices.
  2. Configure 5 difficulty tiers across the 100 levels (scaling grid dimensions from $6\times 6$ to $9\times 10$, colors from 3 to 8, vehicle count from 6 to 28, and introducing obstacles and Mystery `?` buses).
  3. Store a deep clone of the initial level state in `state.initialLevelSnapshot` for zero-drift restarts.
* **Acceptance Criteria:**
  - All 100 levels load in $<20\text{ms}$ and transition from `LOADING` to `READY` / `PLAYING`.
  - Completing Level $N$ unlocks Level $N+1$ up to Level 100.
* **Tests Required:**
  - Deterministic generation test verifying Level $N$ produces identical vehicles and passenger queues on repeated loads.
  - Level progression test verifying unlocking of subsequent levels.

---

### 6. Level Completion and Failure

* **Purpose:** Accurately detect when a level is won (all passengers boarded and all vehicles cleared) or genuinely lost (all unlocked bays occupied by non-full vehicles with zero color match for the front passenger and no vehicles in transit).
* **Existing Implementation:** None.
* **Required Improvements:** Implement strict post-settlement win and deadlock evaluators in `src/game/boardingEngine.ts` and `src/game/gameEngine.ts`.
* **Files Likely to Change:**
  - `src/game/boardingEngine.ts` (new)
  - `src/game/gameEngine.ts` (new)
* **Dependencies on Other Systems:** System 3 (Passenger Matching), System 4 (Parking Bay Management).
* **Implementation Steps:**
  1. **Victory Check:** Verify `passengerQueue.length === 0`, every vehicle is `CLEARED`, and `status !== 'LEVEL_COMPLETED'`. Transition to `LEVEL_COMPLETED` exactly once and increment `victoryTriggerCount` (guaranteed to equal `1`).
  2. **Failure (Deadlock) Check:** Verify:
     - `status === 'PLAYING'`
     - Zero vehicles are in `MOVING_TO_BAY` or `DEPARTING` state.
     - Every unlocked standard bay has a vehicle in `IN_BAY` state.
     - No vehicle currently in any bay (`IN_BAY`) has `occupiedSeats === capacity`.
     - No vehicle currently in any bay (`IN_BAY`, including VIP bay) matches `passengerQueue[0].color`.
  3. Only when all 5 conditions hold simultaneously does the engine transition to `LEVEL_FAILED`.
* **Acceptance Criteria:**
  - Victory triggers **exactly once** when the final bus clears.
  - Suboptimal moves that still leave an open bay or a matching bus in a bay **never** trigger premature failure.
* **Tests Required:**
  - Victory detection and single-trigger guarantee test.
  - True deadlock failure test vs. recoverable state non-failure test.

---

### 7. Boosters: VIP, Pick, and Shuffle

* **Purpose:** Provide three tactical mobile puzzle boosters—**VIP** (VIP Parking Slot / Airlift), **Pick** (Passenger Magnet / Color Pick), and **Shuffle** (Vehicle Color Rearrangement)—that help players recover from tight board states without breaking level invariants.
* **Existing Implementation:** None.
* **Required Improvements:** Implement deterministic functions for `useVipBooster`, `usePickBooster`, and `useShuffleBooster` in `src/game/gameEngine.ts` and interactive controls in `src/components/BoosterDock.tsx`.
* **Files Likely to Change:**
  - `src/game/gameEngine.ts` (new)
  - `src/components/BoosterDock.tsx` (new)
* **Dependencies on Other Systems:** System 3 (Passenger Matching), System 4 (Parking Bays), System 8 (Coins & Rewards).
* **Implementation Steps:**
  1. **VIP Booster:** Allows the player to move a vehicle from a regular bay into the dedicated `VIP Bay` (freeing a regular bay, even recovering from a `LEVEL_FAILED` jam!) OR tap any vehicle in the lot (even if blocked) to airlift it straight into the `VIP Bay`.
  2. **Pick Booster:** Targets the most-occupied vehicle currently parked in a bay (or front queue color) and pulls matching-color passengers from anywhere in `passengerQueue` to immediately fill its remaining seats and dispatch it.
  3. **Shuffle Booster:** Permutes the colors of all remaining `PARKED_IN_LOT` vehicles grouped by identical seat capacity (`4`, `6`, `8`) and reveals any Mystery vehicles, strictly preserving the exact seat-to-passenger color parity invariant.
* **Acceptance Criteria:**
  - All three boosters preserve exact passenger-to-seat parity so a level never becomes mathematically unfinishable after using a booster.
  - Inventory decrements (or deducts coins if inventory is 0) and updates persistently.
* **Tests Required:**
  - Unit tests for `VIP`, `Pick`, and `Shuffle` verifying seat-to-passenger color invariant preservation before and after booster activation.

---

### 8. Coins and Rewards

* **Purpose:** Reward players for completing levels and efficient play, enabling them to purchase additional boosters, unlock extra parking bays, or revive from a full-bay deadlock.
* **Existing Implementation:** None.
* **Required Improvements:** Implement coin balance tracking, level completion reward calculation (base reward + efficiency bonus), and booster/bay shop transactions.
* **Files Likely to Change:**
  - `src/game/storageManager.ts` (new)
  - `src/game/gameEngine.ts` (new)
  - `src/components/ResultModals.tsx` (new)
* **Dependencies on Other Systems:** System 6 (Level Completion), System 7 (Boosters), System 14 (Save System).
* **Implementation Steps:**
  1. Award `50 + levelIndex * 5` coins upon first completion of a level (and `25` coins on replay), plus a `+20` coin star bonus for completing without boosters.
  2. Allow spending coins to replenish `VIP` (100 coins), `Pick` (120 coins), `Shuffle` (80 coins), or unlock an extra temporary bay on a hard level (150 coins).
* **Acceptance Criteria:**
  - Coins are awarded exactly once per victory transition and persisted immediately.
  - Insufficient coin balances disable purchase buttons cleanly without negative balances.
* **Tests Required:**
  - Coin reward calculation and single-award guard test on level completion.

---

### 9. Main Menu and Level Selection

* **Purpose:** Provide a sleek mobile-only launch screen and a 100-level scrollable transit map showing difficulty tiers, star ratings, and instant level launch.
* **Existing Implementation:** None.
* **Required Improvements:** Build a mobile-first title view and interactive 100-level selector modal/drawer (`src/components/LevelSelectModal.tsx`).
* **Files Likely to Change:**
  - `src/components/LevelSelectModal.tsx` (new)
  - `src/App.tsx` (update)
* **Dependencies on Other Systems:** System 5 (Level Loading), System 14 (Save System).
* **Implementation Steps:**
  1. Create a clean mobile home/header view with immediate access to the active level, coin counter, and 100-level transit map drawer.
  2. Group the 100 levels into 5 themed transit zones (1–10 Onboarding, 11–30 Suburban, 31–60 Downtown, 61–85 Metro, 86–100 Grand Central) with a QA/Test toggle to unlock and test any of the 100 levels immediately.
* **Acceptance Criteria:**
  - Players can browse all 100 levels, view their star ratings, and launch any unlocked level with a single tap ($\ge 44\text{px}$ touch targets).
* **Tests Required:**
  - Level selection state transition test (`LEVEL_COMPLETED / PLAYING -> loadLevel(N) -> READY / PLAYING`).

---

### 10. Pause, Restart, Victory, and Failure Screens

* **Purpose:** Present responsive mobile modal sheets for pausing settings, restarting the current level cleanly, celebrating level completion, and recovering from or retrying after a parking bay jam.
* **Existing Implementation:** None.
* **Required Improvements:** Implement `src/components/ResultModals.tsx` and deterministic `restartLevelState` in `src/game/gameEngine.ts`.
* **Files Likely to Change:**
  - `src/components/ResultModals.tsx` (new)
  - `src/game/gameEngine.ts` (new)
* **Dependencies on Other Systems:** System 1 (Core Gameplay Architecture), System 6 (Level Completion/Failure), System 8 (Coins).
* **Implementation Steps:**
  1. **Pause Sheet:** Displays audio/haptic/colorblind toggles, level stats, "Resume", "Restart Level", and "Level Map".
  2. **Restart Action:** Restores `initialLevelSnapshot` cleanly, resetting all vehicles to `PARKED_IN_LOT` with `occupiedSeats = 0`, restoring the full `passengerQueue`, clearing all bays, and resetting transient animations/timers.
  3. **Victory Sheet:** Displays stars earned, passengers transported, coin reward breakdown, and a single-tap "Next Level" CTA.
  4. **Failure (Out of Bays) Sheet:** Offers "Use VIP Slot / Revive" (if available or affordable with coins) or "Try Again" (instant restart).
* **Acceptance Criteria:**
  - Restarting a level restores the exact initial state with zero duplicated passengers, vehicles, or event listeners.
* **Tests Required:**
  - Deep-equality restart verification test after partial moves, blocked moves, and mid-boarding states.

---

### 11. 3D Models, Materials, Lighting, and Environments

* **Purpose:** Deliver the signature elevated 3D/2.5D Bus Jam visual identity—color-coded open-top transit vehicles, tactile asphalt parking lot with lane markings, sidewalk stop shelter, and clear passenger figures.
* **Existing Implementation:** None.
* **Required Improvements:** Implement a hardware-accelerated 2.5D isometric/elevated renderer (`src/assets/vehicleSprites.ts`, `src/assets/colorPalette.ts`, `src/components/ParkingLotCanvas.tsx`) with extruded chassis bevels, specular windshield highlights, drop shadows, and visible interior passenger seats.
* **Files Likely to Change:**
  - `src/assets/colorPalette.ts` (new)
  - `src/assets/vehicleSprites.ts` (new)
  - `src/components/ParkingLotCanvas.tsx` (new)
* **Dependencies on Other Systems:** System 2 (Vehicle Movement), System 3 (Passenger Matching).
* **Implementation Steps:**
  1. Define 8 vibrant, daylight-legible vehicle & passenger material palettes (`RED`, `BLUE`, `GREEN`, `AMBER`, `PURPLE`, `CYAN`, `PINK`, `ORANGE`), each paired with a distinct geometric emblem (`★`, `●`, `▲`, `◆`, `⬡`, `⚡`, `♥`, `■`) so state is never conveyed by hue alone.
  2. Render 3 distinct vehicle chassis models (`4-seat Mini-Shuttle`, `6-seat City Bus`, `8-seat Articulated Coach`) with directional windshields, headlights, roof direction arrows, and recessed seat wells that populate with 3D-shaded passenger heads as they board.
  3. Render the asphalt parking grid, perimeter exit road, directional lane chevrons, and concrete barrier obstacles.
* **Acceptance Criteria:**
  - Every vehicle's color, symbol, facing direction, seat capacity, and current seat occupancy are immediately legible on a 375px mobile screen.
* **Tests Required:**
  - Color palette & capacity-to-length mapping verification tests.

---

### 12. Vehicle Animations, Passenger Animations, and Visual Effects

* **Purpose:** Provide smooth 60 FPS compositor-friendly visual feedback for vehicle selection, perimeter road driving, blocked recoil bumps, sequential passenger boarding hops, and full-bus departures.
* **Existing Implementation:** `motion` (`^12.23.24`) is installed in `package.json` but unused.
* **Required Improvements:** Implement compositor-only (`transform`, `opacity`) animations for vehicle transit, blocked shakes, passenger boarding arcs, and departure effects.
* **Files Likely to Change:**
  - `src/components/ParkingLotCanvas.tsx` (new)
  - `src/components/ParkingBaysView.tsx` (new)
  - `src/components/PassengerQueueView.tsx` (new)
  - `src/index.css` (update)
* **Dependencies on Other Systems:** System 2 (Vehicle Movement), System 3 (Passenger Boarding), System 10 (Restart).
* **Implementation Steps:**
  1. Animate unblocked vehicles sliding out of their grid lane and into their reserved parking bay ($\le 220\text{ms}$).
  2. Animate blocked vehicles lunging $6\text{px}$ along their facing vector and recoiling back while flashing the obstructing vehicle's border.
  3. Animate boarding passengers hopping from the front of the sidewalk queue into the matching bay bus with a seat-fill pop animation.
* **Acceptance Criteria:**
  - Animations never desynchronize gameplay state; rapid taps during an active animation are safely queued/processed via atomic state locks.
* **Tests Required:**
  - Animation lock / mid-transit state consistency test verifying rapid moves during `MOVING_TO_BAY` do not double-book bays or corrupt boarding.

---

### 13. Audio and Sound Effects

* **Purpose:** Provide responsive, zero-latency tactile sound effects (engine ignition, blocked horn, ascending pitch passenger boarding pops, bus departure chime, victory fanfare) without relying on external `.mp3` network fetches.
* **Existing Implementation:** None.
* **Required Improvements:** Build a procedural Web Audio API sound synthesizer (`src/game/audioManager.ts`) with mute persistence and automatic mobile AudioContext unlock on first touch.
* **Files Likely to Change:**
  - `src/game/audioManager.ts` (new)
* **Dependencies on Other Systems:** System 14 (Save System for mute toggle).
* **Implementation Steps:**
  1. Create a singleton `AudioManager` using `window.AudioContext` with safe fallback in headless test environments (`typeof window === 'undefined'`).
  2. Synthesize distinct procedural waveforms for: `playSelect()`, `playBlockedHorn()`, `playPassengerBoard(comboIndex)`, `playBusDepart()`, `playBooster()`, `playVictory()`, and `playFailure()`.
* **Acceptance Criteria:**
  - Sound effects trigger with zero network latency on mobile touch and degrade gracefully when muted or run in headless Node/TSX tests.
* **Tests Required:**
  - Headless execution safety test ensuring `audioManager` never throws when `AudioContext` is absent.

---

### 14. Save System and Progression Persistence

* **Purpose:** Persist player progression (highest unlocked level across 1–100, per-level star ratings, coin balance, booster counts, audio/colorblind settings) across sessions.
* **Existing Implementation:** None.
* **Required Improvements:** Implement `src/game/storageManager.ts` backed by `localStorage` with schema validation and safe in-memory fallback.
* **Files Likely to Change:**
  - `src/game/storageManager.ts` (new)
* **Dependencies on Other Systems:** System 5 (Level Progression), System 7 (Boosters), System 8 (Coins).
* **Implementation Steps:**
  1. Define `PlayerSaveData` schema with default starter inventory (`250` coins, `2` VIP, `2` Pick, `2` Shuffle boosters, Level 1 unlocked).
  2. Implement `loadSaveData()`, `savePlayerData()`, `recordLevelWin()`, and `resetSaveData()`.
* **Acceptance Criteria:**
  - Reloading the app preserves unlocked levels, stars, coins, and remaining boosters accurately.
* **Tests Required:**
  - Save/load round-trip serialization and progression update tests.

---

### 15. Level Data and Level Validation

* **Purpose:** Guarantee that all **100 playable levels** are mathematically valid, have zero overlapping vehicles, maintain exact passenger-to-seat parity per color, and possess at least one verified unblocked extraction sequence.
* **Existing Implementation:** None.
* **Required Improvements:** Implement a **Reverse-Peel Constructive Generator** (`src/game/levelGenerator.ts`) and an automated **Level Validator** (`src/game/levelValidator.ts`).
* **Files Likely to Change:**
  - `src/game/levelGenerator.ts` (new)
  - `src/game/levelValidator.ts` (new)
* **Dependencies on Other Systems:** System 2 (Collision Engine), System 3 (Boarding Engine).
* **Implementation Steps:**
  1. Place non-overlapping vehicles of lengths `2`, `3`, and `4` on the level grid.
  2. Iteratively peel vehicles that have an unobstructed exit ray to the perimeter road; if a subset forms a cycle, re-orient a perimeter-facing vehicle until a complete extraction order $V_1, V_2, \dots, V_k$ is verified.
  3. Generate the passenger queue directly from the capacities and colors of $V_1, V_2, \dots, V_k$ with bounded window shuffling so the level is 100% solvable using the 4 standard bays.
  4. Validate every level with `validateLevelData(level)` checking cell bounds, zero overlap, seat parity, and constructive solvability.
* **Acceptance Criteria:**
  - All 100 levels (`1..100`) pass `validateLevelData` with zero errors.
* **Tests Required:**
  - Automated validation test iterating through all 100 levels (`Level 1` to `Level 100`) verifying zero overlaps, exact seat parity, and a valid extraction sequence.

---

### 16. Mobile Touch Controls and Responsive UI

* **Purpose:** Enforce a strict mobile-only portrait experience (`375px–430px` ergonomic frame) with one-handed thumb navigation, $\ge 44\times 44\text{px}$ hit targets, zero desktop chrome, and immunity to double-tap zoom or accidental scroll.
* **Existing Implementation:** Unstyled desktop-default HTML shell.
* **Required Improvements:** Update `index.html`, `src/index.css`, and `src/components/MobileShell.tsx` to lock touch ergonomics and structure the screen into Top HUD ($<8\%$ height), Passenger Queue + Parking Bays, Interactive Parking Lot Board, and Bottom Booster Dock ($<10\%$ height).
* **Files Likely to Change:**
  - `index.html` (update)
  - `metadata.json` (update)
  - `src/index.css` (update)
  - `src/components/MobileShell.tsx` (new)
* **Dependencies on Other Systems:** Systems 1, 2, 7, 9, 10.
* **Implementation Steps:**
  1. Configure `viewport` meta tag with `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.
  2. Apply `touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent;` across interactive board elements.
  3. Scale grid cell size dynamically (`clamp(34px, ... , 56px)`) so grids from $6\times 6$ up to $9\times 10$ fit comfortably inside the mobile viewport without scrolling.
* **Acceptance Criteria:**
  - Entire game fits within a single non-scrolling `100dvh` mobile portrait viewport with all primary actions in the natural thumb zone.
* **Tests Required:**
  - Rapid multi-tap stress test verifying zero duplicate dispatches or state race conditions.

---

### 17. Performance Optimization

* **Purpose:** Maintain 60 FPS frame pacing and low memory overhead across long play sessions on mobile devices.
* **Existing Implementation:** N/A.
* **Required Improvements:** Window the visible passenger queue DOM nodes (rendering only the front 18 visible waiting passengers + total counter badge while keeping the full array in memory), memoize grid cell lookups, and clean up all `setTimeout`/`requestAnimationFrame` handles on unmount or restart.
* **Files Likely to Change:**
  - `src/components/PassengerQueueView.tsx` (new)
  - `src/components/ParkingLotCanvas.tsx` (new)
  - `src/App.tsx` (update)
* **Dependencies on Other Systems:** Systems 3, 11, 12.
* **Implementation Steps:**
  1. Render at most the first 16–20 passengers in the animated sidewalk snake DOM while displaying a `+N waiting` badge for the remainder of the queue.
  2. Use a single managed interval/tick for passenger boarding and transit settlement with automatic cleanup on pause/restart.
* **Acceptance Criteria:**
  - Level 100 (with 150+ passengers) renders with the same low DOM node count and instant tap latency as Level 1.
* **Tests Required:**
  - High-entity benchmark test running Level 100 state transitions in $<10\text{ms}$.

---

### 18. Android Packaging and Deployment

* **Purpose:** Ensure the web bundle is ready for mobile WebView deployment, Progressive Web App (PWA) home-screen installation, and Capacitor Android APK/AAB packaging.
* **Existing Implementation:** Vite web build only (`vite build`).
* **Required Improvements:** Configure mobile web-app meta tags (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, `theme-color`) in `index.html` and document the Capacitor Android build pipeline.
* **Files Likely to Change:**
  - `index.html` (update)
  - `metadata.json` (update)
* **Dependencies on Other Systems:** System 16 (Mobile Touch UI).
* **Implementation Steps:**
  1. Add mobile fullscreen & theme-color meta tags to `index.html`.
  2. Verify `npm run build` outputs a clean static bundle in `dist/` compatible with Capacitor (`npx cap init BusJam com.busjam.mobile --web-dir=dist && npx cap add android`).
* **Acceptance Criteria:**
  - `vite build` succeeds with zero errors and outputs a self-contained mobile web bundle.
* **Tests Required:**
  - Production build compilation check (`compile_applet`).

---

### 19. Automated Tests

* **Purpose:** Continuously verify all core Bus Jam gameplay rules—valid/invalid moves, blocked paths, passenger matching, vehicle capacity, bay occupancy, level completion, level failure, booster invariants, and restart behavior—plus 100-level solvability.
* **Existing Implementation:** None.
* **Required Improvements:** Create a comprehensive automated test suite (`src/tests/coreGameplay.test.ts`) runnable via `npx tsx src/tests/coreGameplay.test.ts` and wire `"test": "tsx src/tests/coreGameplay.test.ts"` in `package.json`.
* **Files Likely to Change:**
  - `src/tests/coreGameplay.test.ts` (new)
  - `package.json` (update `"test"` script)
* **Dependencies on Other Systems:** Systems 1–15.
* **Implementation Steps:**
  1. Write deterministic assertions covering all 8 required test categories plus booster and 100-level validation tests.
  2. Execute the test runner and verify 100% pass rate.
* **Acceptance Criteria:**
  - `npm test` (`npx tsx src/tests/coreGameplay.test.ts`) passes 100% of test cases with zero failures.
* **Tests Required:**
  - Valid & invalid moves, blocked paths, passenger matching, vehicle capacity, bay occupancy, level completion, level failure, restart behavior, booster parity, and 100-level solvability.

---

### 20. Final Release Preparation

* **Purpose:** Verify type safety, lint cleanliness, production bundling, metadata synchronization, and in-app diagnostics before release.
* **Existing Implementation:** Unconfigured template metadata.
* **Required Improvements:** Synchronize `metadata.json` and `index.html`, run `lint_applet` (`tsc --noEmit`), run `compile_applet` (`vite build`), and verify all automated tests pass.
* **Files Likely to Change:**
  - `metadata.json`
  - `index.html`
* **Dependencies on Other Systems:** All systems (1–19).
* **Implementation Steps:**
  1. Run automated test suite (`npx tsx src/tests/coreGameplay.test.ts`).
  2. Run TypeScript compiler verification (`lint_applet`).
  3. Run production Vite build (`compile_applet`).
* **Acceptance Criteria:**
  - Zero test failures, zero TypeScript errors, and a clean production build.
* **Tests Required:**
  - Full regression run of `npm test`, `npm run lint`, and `npm run build`.

---

## Staged Implementation Roadmap

- **Stage 1:** Core Domain Types, Color/Symbol Palette, and Spatial Collision/Raycasting Engine (`src/game/types.ts`, `src/assets/colorPalette.ts`, `src/game/collisionEngine.ts`).
- **Stage 2:** Parking Bay Controller, FIFO Passenger Boarding Engine, and Win/Deadlock State Machine (`src/game/boardingEngine.ts`, `src/game/gameEngine.ts`).
- **Stage 3:** 100-Level Constructive Generator, Solvability Validator, Audio Synthesizer, and Save Manager (`src/game/levelGenerator.ts`, `src/game/levelValidator.ts`, `src/game/audioManager.ts`, `src/game/storageManager.ts`).
- **Stage 4:** Mobile-Only UI Components, 2.5D Open-Top Vehicle Renderer, Boosters (`VIP`, `Pick`, `Shuffle`), and Level Browser (`src/assets/vehicleSprites.ts`, `src/components/*`, `src/App.tsx`).
- **Stage 5:** Automated Test Suite Execution (`src/tests/coreGameplay.test.ts`), Linting, and Build Verification.
