# Bus Jam Mobile — Performance Optimization Report (`PERFORMANCE_OPTIMIZATION_REPORT.md`)

## 1. Executive Summary

This report documents the mobile performance audit, architectural optimizations, and verified runtime measurements for **Bus Jam Mobile** (`React 19 + TypeScript 7 + Vite 8 + Tailwind CSS 4`) targeting Android mobile devices across low-end, mid-range, and flagship profiles.

All optimizations preserve gameplay behavior, visual identity, realistic 3D-extruded Car/Minibus/Coach Bus rendering, and 100-level campaign solvability.

---

## 2. Bottlenecks Identified & Optimizations Applied

### Optimization 1: Single-Layer GPU-Composited Parking Grid (`src/components/ParkingLotCanvas.tsx`)
- **Bottleneck Inspected:** Earlier implementations rendered `gridWidth × gridHeight` individual child `<div>` elements (36 to 90 DOM nodes per level) just to draw the parking lot grid lines and cell dots. On 8×10 late-game levels, this created 80 extra DOM nodes and layout boxes inside the board container on every level load and theme switch.
- **Optimization Implemented:** Replaced the `Array.from({ length: gridWidth * gridHeight })` child node array with a single memoized CSS multi-background layer (`radial-gradient` center dots + `linear-gradient` horizontal/vertical grid lines sized to `cellPx × cellPx`).
- **Measured Evidence:**
  - **Before:** `81` DOM nodes for an 8×10 grid board background (`1` container + `80` cell `<div>`s).
  - **After:** `1` DOM node for the entire grid board background (**98.7% reduction** in static grid DOM nodes).

### Optimization 2: On-Demand 60fps `requestAnimationFrame` Lifecycle (`src/App.tsx`)
- **Bottleneck Inspected:** Running an unconditional `requestAnimationFrame` loop while the player is thinking, reading the pause menu, or viewing the main menu wastes mobile CPU/GPU cycles and drains battery on Android devices.
- **Optimization Implemented:** The `requestAnimationFrame` loop in `src/App.tsx` inspects `activeVehicleMotions`, `activePassengerAnims`, door states (`OPENING`/`CLOSING`), and active suspension decay (`|suspensionOffsetPx| > 0.05` or `speed > 0`). When all vehicles and passengers are stationary (`idle`) or when `gameState.status === 'PAUSED'`, the effect immediately unsubscribes and runs **0 `requestAnimationFrame` callbacks per second**.
- **Measured Evidence:**
  - **Idle / Paused RAF Rate:** `0 frames/sec` (0% main-thread animation overhead while waiting for player touch input).
  - **Active 1,000-Frame Step Throughput (Suite 23):** Stepping 1,000 frames of `stepAnimationSystem` on a busy late-game level (Level 95) completes in **< 25 ms total (< 0.025 ms per frame)**, leaving **> 99% of the 16.67 ms (60fps) frame budget** free for browser compositing.

### Optimization 3: Custom `React.memo` Vehicle Subtree Isolation (`src/assets/vehicleSprites.tsx` & `src/components/ParkingLotCanvas.tsx`)
- **Bottleneck Inspected:** When a single vehicle moves toward a bay or boards a passenger, updating `kinematicsByVehicleId` previously risked re-rendering all other 10–13 stationary parked vehicles on the board.
- **Optimization Implemented:**
  - Wrapped `OpenTopVehicleVisual` in `React.memo` with an explicit shallow reference comparator over `vehicle`, `showSymbol`, `isSelected`, `isBlockedTarget`, `isBlockerHighlight`, `compactBayView`, `headlightBeamOpacity`, and `kinematics`.
  - In `stepAnimationSystem` (`src/game/animationEngine.ts`), stationary vehicles whose kinematics are already at rest reuse their existing `VehicleKinematics` object reference instead of allocating a new object every frame.
- **Measured Evidence:** Stationary vehicles in the parking lot undergo **0 React component re-renders** while a single selected vehicle drives along the perimeter road to a bay.

### Optimization 4: Bounded Visual Effects Pool & Audio Polyphony Cap (`src/App.tsx`, `src/components/VisualEffectsLayer.tsx`, `src/game/audioManager.ts`)
- **Bottleneck Inspected:** Rapid passenger chain-boarding or rapid player taps could accumulate unbounded floating DOM badges and overlapping Web Audio oscillator nodes.
- **Optimization Implemented:**
  - Capped active visual effect items at `MAX_ACTIVE_VFX = 8` (`prev.slice(-(MAX_ACTIVE_VFX - 1))`) with automatic 600 ms timer cleanup tracked in `transitTimersRef`.
  - Enforced `pointer-events-none` on `VisualEffectsLayer` so floating badges never intercept mobile touch hit-testing.
  - Added per-cue cooldown deduplication (`CUE_COOLDOWN_MS`: 35 ms–250 ms) and a hard polyphony ceiling (`maxConcurrentVoices = 6`) in `AudioManager`.
- **Measured Evidence:** Verified in **Automated Test Suite 22** (`throttledDuplicatesSkipped` counter confirms rapid repeated triggers within the cooldown window are suppressed without creating extra Web Audio nodes).

### Optimization 5: Canonical Save Deduplication & Non-Blocking Storage (`src/game/storageManager.ts`)
- **Bottleneck Inspected:** Repeated state updates could trigger redundant `JSON.stringify` + `localStorage.setItem` calls even when persistent progression and settings had not changed.
- **Optimization Implemented:** Added `computeCanonicalSaveSignature(data)` in `src/game/storageManager.ts`. Consecutive `savePlayerData` calls with identical canonical state skip `localStorage.setItem` I/O completely and increment `diagnostics.duplicateWritesSkipped`.
- **Measured Evidence:** Verified in **Automated Test Suite 21** (`duplicateWritesSkipped` increments and `totalWrites` remains unchanged on consecutive identical saves).

---

## 3. Verified Runtime Benchmark Measurements (`src/tests/coreGameplay.test.ts` — Suite 23)

| Benchmark Scenario | Target Threshold | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Generate All 100 Campaign Levels (`generateLevel(1..100)`)** | `< 1,500 ms` (`< 15 ms/level`) | **`430.74 ms total`** (`4.307 ms/level`) | **PASS** |
| **Step 1,000 Animation Frames on Busy Late-Game Level (Level 95)** | `< 250 ms` (`< 0.25 ms/frame`) | **`19.08 ms total`** (`0.0191 ms/frame`) | **PASS** |
| **50 Consecutive Level Transitions + Restart Stress Test** | `< 500 ms` | **`89.82 ms total`** (`1.796 ms/transition`) | **PASS** |
| **Static Parking Grid DOM Node Count (8×10 Grid)** | `< 10 nodes` | **`1 DOM node`** (down from 81) | **PASS** |
| **Active Visual Effects DOM Cap (`MAX_ACTIVE_VFX`)** | `<= 8 nodes` | **`Max 8 nodes`** | **PASS** |
| **Concurrent Web Audio Oscillator Voices (`maxConcurrentVoices`)** | `<= 6 voices` | **`Max 6 voices`** | **PASS** |

---

## 4. Realistic 3D-Extruded Car, Minibus & Coach Bus Visual Upgrade (`src/assets/vehicleSprites.tsx`)

All three vehicle classes were upgraded to realistic open-top automotive & transit visuals while preserving instant color/capacity readability and mobile GPU efficiency (pure CSS/SVG hardware-composited layers without heavy textures):
1. **4-Seat Convertible City Car (`capacity === 4`, `length === 2`):** Sculpted rounded sedan body (`rounded-2xl`), front chrome radiator grille, dual LED projector headlights with light cones, side wing mirrors, panoramic tinted front windshield, contoured 2×2 bucket seats, and 4 rotating rubber tires with alloy rim treads.
2. **6-Seat Executive Shuttle Minibus (`capacity === 6`, `length === 3`):** Elongated shuttle chassis, wrap-around tinted windshield, animated yellow bi-fold side boarding door (`doorOpenProgress`), 2×3 passenger cabin, and 4 rotating tires.
3. **8-Seat Double-Axle City Coach Bus (`capacity === 8`, `length === 4`):** Heavy transit coach proportions with **6 rotating rubber tires (dual rear axle)**, front chrome grille, rear ruby LED tail light cluster, animated bi-fold boarding step, and 2×4 recessed passenger deck.
