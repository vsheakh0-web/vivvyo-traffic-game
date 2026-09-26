# Bus Jam Mobile — Upgrade Roadmap (`UPGRADE_ROADMAP.md`)

**Objective:** Upgrade the current barebones React 19 + TypeScript + Vite 8 scaffold into a complete, polished, mobile-only **Bus Jam** puzzle game with **100 deterministic playable levels**, tactile 2.5D vehicle graphics, smooth animations, Web Audio sound effects, working boosters, persistent progression, and automated solvability validation.

---

## Prioritized Upgrade Phases

### Phase 1: Core Data Contracts, Deterministic 100-Level Engine & Solvability Validator
**Priority:** P0 (Critical Foundation)

1. **Define Domain Types (`src/game/types.ts`):**
   - Vehicle types (`Mini Van` 4-seat/2-tile, `City Bus` 6-seat/3-tile, `Mega Coach` 8-seat/4-tile).
   - 8 distinct high-contrast color themes with paired colorblind-safe symbols (`Star`, `Circle`, `Triangle`, `Diamond`, `Hexagon`, `Bolt`, `Heart`, `Shield`).
   - Grid coordinates, orientations (`UP`, `DOWN`, `LEFT`, `RIGHT`), parking bay states, booster inventory, and player progression schema.
2. **Build Collision & Raycast Engine (`src/game/collisionEngine.ts`):**
   - Cell occupancy map builder (`Map<string, string>`).
   - Directional raycaster (`checkExitPath`) returning `{ isClear: boolean, blockerVehicleId?: string, pathCells: GridPoint[] }`.
3. **Build 100-Level Constructive Generator & Solver (`src/game/levelGenerator.ts` & `src/game/levelValidator.ts`):**
   - Implement seeded deterministic generation for **Levels 1 through 100**, structured into 5 distinct progression tiers:
     - **Levels 1–10 (Onboarding & Basics):** $6 \times 6$ lot, 3–4 colors, 6–10 vehicles, generous passenger grouping.
     - **Levels 11–30 (Suburban Transit):** $7 \times 7$ lot, 4–5 colors, 10–15 vehicles, mixed 4/6/8-seat buses, tighter queue interleaving.
     - **Levels 31–60 (Downtown Rush Hour):** $8 \times 8$ lot, 5–6 colors, 15–20 vehicles, Mystery (`?`) buses that reveal their color when unblocked.
     - **Levels 61–85 (Metro Terminal Gridlock):** $8 \times 9$ lot, 6–7 colors, 20–26 vehicles, central traffic islands/barriers, deep dependency chains.
     - **Levels 86–100 (Grand Central Masterworks):** $9 \times 10$ lot, up to 8 colors, 26–32 vehicles (140–190 passengers per level), high strategic bay management.
   - Enforce automated invariant checks on every level: exact seat-to-passenger count parity and 0-deadlock constructive extraction order.

---

### Phase 2: Boarding State Machine, Economy, Boosters & Persistence
**Priority:** P0 (Core Gameplay Loop)

1. **FIFO Boarding & Bay Controller (`src/game/boardingEngine.ts`):**
   - Manage 4 default active bays + 1 VIP booster bay + 2 coin-unlockable bays.
   - Continuous boarding tick (`80ms–110ms` per passenger) that automatically routes the front passenger into the best matching bay vehicle (prioritizing the fullest matching vehicle so bays clear rapidly).
   - Automatic bus departure animation when `occupiedSeats === capacity`.
   - Accurate deadlock detector when all bays are full and `queue[0]` matches no parked vehicle.
2. **Boosters & Coin Economy:**
   - **Undo Move:** Returns the most recently parked bus from its bay (if no passengers have boarded it yet, or refunds its boarded passengers back to the front of the queue) back to its original lot coordinates.
   - **VIP Parking Bay:** Moves a selected bay vehicle (or the next tapped vehicle) into a dedicated VIP overflow bay to break a deadlock.
   - **Shuffle Lot Vehicles:** Randomly swaps the colors of remaining `PARKED_IN_LOT` vehicles of identical seating capacities while preserving exact passenger parity.
   - **VIP Passenger Magnet (Sort Queue):** Pulls matching passengers from deeper in the queue to immediately fill the most occupied bus currently in a bay.
3. **Persistence (`src/game/storageManager.ts`):**
   - Save current unlocked level (1–100), per-level completion stars/moves, coin balance, booster counts, colorblind mode toggle, and sound/haptic preferences in `localStorage`.

---

### Phase 3: Tactile 2.5D Visuals, Animations & Audio Synthesizer
**Priority:** P1 (Visual Polish & Game Feel)

1. **Custom 2.5D Isometric/Top-Down Vehicle Renderer (`src/assets/vehicleSprites.ts`):**
   - Crisp vector/canvas-styled buses with 3D roof depth, headlights, windshields, side mirrors, directional arrows on the roof, and **individual open-top passenger seats** that visibly fill with matching passenger heads as they board.
   - Distinct silhouette proportions for 4-seat (2-cell), 6-seat (3-cell), and 8-seat (4-cell) vehicles.
   - Mystery bus tarp/question-mark visual that peels away when its exit path clears or adjacent buses move.
2. **Smooth 60 FPS Animations:**
   - Perimeter road path animation from lot exit to the assigned parking bay.
   - Blocked-vehicle recoil bump + blocker flash highlight when tapping an obstructed bus.
   - Jumping passenger boarding arc with floating `+1` seat counter and confetti/exhaust puff on full bus departure.
3. **Web Audio API Sound Engine (`src/game/audioManager.ts`):**
   - Zero-external-asset procedural sound synthesizer generating crisp tactile audio cues:
     - Bus tap / engine start purr
     - Blocked bus double-honk / thud
     - Ascending pitch passenger boarding pops (`C5 -> D5 -> E5 -> G5 -> C6` combo scale)
     - Full bus departure chime & air-brake whoosh
     - Level victory fanfare & coin clink

---

### Phase 4: Mobile-Only Interface, Ergonomics & Level Browser
**Priority:** P1 (Mobile UX & Compatibility)

1. **Mobile Viewport Shell (`src/components/MobileShell.tsx` & `index.html`):**
   - Lock touch ergonomics (`touch-action: manipulation`, `user-select: none`) in a dedicated `9:16` mobile device frame (`max-w-[430px] h-[100dvh]`) so it plays natively on mobile screens and renders as a sleek mobile viewport on desktop previews.
   - Enforce $\ge 44 \times 44\text{px}$ touch targets and $<15\%$ sticky header/footer height so at least 85% of the screen is dedicated to the active puzzle board, bays, and passenger walkway.
2. **100-Level Selector & Debug/QA Inspector (`src/components/LevelSelectModal.tsx`):**
   - Interactive 100-level roadmap allowing instant jump to any unlocked level (plus a "Developer Unlock All 100 Levels & Run Solvability Check" toggle so QA can immediately playtest Level 1, Level 50, or Level 100).

---

### Phase 5: Automated Level Validation & Build Verification
**Priority:** P2 (Quality Assurance)

1. **Automated 100-Level Verification Suite (`src/tests/validateAllLevels.ts`):**
   - Verify all 100 levels generate in $<50\text{ms}$, satisfy strict seat-to-passenger color equality, have zero overlapping grid cells, and possess a verified non-blocking extraction sequence.
2. **Build & Lint Verification:**
   - Run `tsc --noEmit` (`lint_applet`) and `vite build` (`compile_applet`) to ensure zero TypeScript or bundle errors.
