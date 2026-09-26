# Bus Jam Mobile — Comprehensive Quality Assurance Report (`QA_REPORT.md`)

## 1. Executive Summary

This report documents the full Quality Assurance (QA) pass conducted on the upgraded **Bus Jam Mobile** game (`com.transitpuzzle.busjammobile`, built with **React 19 + TypeScript 7 + Vite 8 + Tailwind CSS 4**).

In accordance with engineering discipline, this report **strictly distinguishes between Automated Test Results** (executed via `npm test` / `tsx src/tests/coreGameplay.test.ts`, `npm run lint`, and `npm run build`) and **Code & Interactive UI/Mobile Inspection**.

- **Automated Test Suites Executed:** `24 / 24` (`100% PASS`, `0 FAIL`)
- **100-Level Campaign Validation:** `100 / 100` levels verified structurally valid, geometrically unique (`100/100` distinct layout fingerprints), and solvable without boosters by both constructive replay and independent heuristic solver.
- **TypeScript & Production Bundle Verification:** `tsc --noEmit` (`0 errors`) and `vite build` (`dist/` compiled cleanly).

---

## 2. Tests Performed (Automated vs. Manual / Interactive Inspection)

### A. Automated Test Suites (`src/tests/coreGameplay.test.ts` — Executed via `npm test`)

| Suite # | System Tested | Verification Scope | Execution Mode | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Suite 1** | Vehicle Selection & Movement | Valid/invalid vehicle selection, `READY` / `PAUSED` / `LEVEL_COMPLETED` state guards, unblocked exit raycast | Automated CLI (`tsx`) | **PASS** |
| **Suite 2** | Traffic Blocking Detection | Vehicle-to-vehicle blocking, static obstacle blocking, recoil feedback without mutating grid coordinates | Automated CLI (`tsx`) | **PASS** |
| **Suite 3** | FIFO Passenger Matching | Strict front-of-queue (`passengerQueue[0]`) matching, color parity, single-boarding guarantee per passenger | Automated CLI (`tsx`) | **PASS** |
| **Suite 4** | Vehicle Capacity & Departure | 4-, 6-, and 8-seat capacities, automatic departure at `occupiedSeats === capacity`, immediate bay release | Automated CLI (`tsx`) | **PASS** |
| **Suite 5** | Parking Bay Occupancy | 4–6 standard bays + 1 VIP bay, `reservedByVehicleId` lock during transit (`MOVING_TO_BAY`), overflow prevention | Automated CLI (`tsx`) | **PASS** |
| **Suite 6** | Level Completion | Triggers only when `passengerQueue.length === 0` and all vehicles are `CLEARED`; `victoryTriggerCount === 1` | Automated CLI (`tsx`) | **PASS** |
| **Suite 7** | Level Failure Detection | Genuine deadlock (`allStandardBaysOccupied` + zero front-passenger match + zero in-transit buses) vs recoverable states | Automated CLI (`tsx`) | **PASS** |
| **Suite 8** | Level Restart | Deep-cloned `initialSnapshot` restoration from mid-game, paused, and failed states | Automated CLI (`tsx`) | **PASS** |
| **Suite 9** | Booster Seat Parity | VIP, Pick, and Shuffle boosters preserve exact `remainingPassengers === remainingOpenSeats` invariant | Automated CLI (`tsx`) | **PASS** |
| **Suite 10** | 100-Level Campaign Validation | Structural bounds, zero overlaps, seat-to-passenger color parity, and zero-booster solvability for Levels 1–100 | Automated CLI (`tsx`) | **PASS** |
| **Suite 11** | Smooth Vehicle Kinematics | Smoothstep acceleration (`t=0 -> speed=0`), mid-path cruise, smooth deceleration, exact destination stop | Automated CLI (`tsx`) | **PASS** |
| **Suite 12** | Wheel Rotation Sync | Wheel rotation angle advances proportionally to speed when moving and remains frozen (`Δdeg = 0`) when stationary | Automated CLI (`tsx`) | **PASS** |
| **Suite 13** | Vehicle Turning Alignment | Shortest-arc angular interpolation (`350° -> 10°` turns `+20°`, never `-340°`) aligned with path tangent | Automated CLI (`tsx`) | **PASS** |
| **Suite 14** | Suspension & Door Sync | Damped spring suspension clamped to `±2.5px`; doors stay closed while driving, open in bay, and close before departure | Automated CLI (`tsx`) | **PASS** |
| **Suite 15** | Passenger Boarding Animation | Walk-to-door (`WALKING_TO_DOOR`), step-in (`STEPPING_IN`), and single seat-completion event per passenger | Automated CLI (`tsx`) | **PASS** |
| **Suite 16** | Animation Cancellation Safety | `cancelAndResetAnimations()` cleanly aborts active vehicle & passenger animations on restart without ghost callbacks | Automated CLI (`tsx`) | **PASS** |
| **Suite 17** | 6 Environment Themes | Verifies all 6 transit themes (`MODERN_CITY`, `SUBURBAN_STREETS`, `COASTAL_ROADS`, `INDUSTRIAL_DISTRICT`, `GREEN_PARK`, `NIGHTTIME_CITY`) | Automated CLI (`tsx`) | **PASS** |
| **Suite 18** | Booster Edge Cases | Tests VIP, Pick, and Shuffle during vehicle movement, pause, cancel, empty inventory, restart, and near level completion | Automated CLI (`tsx`) | **PASS** |
| **Suite 19** | Campaign Uniqueness & Unlocks | Verifies 100 unique geometric layout fingerprints, independent beam-search solver, and sequential level unlock rules | Automated CLI (`tsx`) | **PASS** |
| **Suite 20** | Coin & Reward Economy | First-win coin calculation, zero duplicate coins on replay, inventory-first then coin deduction, insufficient funds rejection | Automated CLI (`tsx`) | **PASS** |
| **Suite 21** | Local Save System (`v2`) | `v1 -> v2` schema migration, corrupted JSON backup recovery, duplicate write deduplication, incomplete write rejection | Automated CLI (`tsx`) | **PASS** |
| **Suite 22** | Audio & Visual Mixing | All 9 sound cues + blocked horn, independent SFX/Music volume sliders, cooldown throttling, mute & pause suppression | Automated CLI (`tsx`) | **PASS** |
| **Suite 23** | Mobile Performance Benchmarks | 100-level load speed (`430.74ms`), 1,000 animation frames (`19.08ms`), and 50 consecutive level transitions (`89.82ms`) | Automated CLI (`tsx`) | **PASS** |
| **Suite 24** | QA Regression Verification | VIP recovery from `LEVEL_FAILED` deadlock, pause/resume round-trip state preservation, and modal state integrity | Automated CLI (`tsx`) | **PASS** |

---

### B. UI, Responsive Viewport & Mobile Lifecycle Inspection

| Inspection Area | Verification Method | Findings & Result |
| :--- | :--- | :--- |
| **Main Menu (`MainMenuScreen.tsx`)** | Code & UI state inspection | Verified live 3D Car + Coach Bus diorama, Coin balance badge, `Play Level N` primary CTA, `100-Level Progression Map` launcher, and Settings modal. |
| **Level Selection (`LevelSelectModal.tsx`)** | Code & UI state inspection | Verified 100-level grid with 1–3 star indicators, lock icons for `level > unlockedLevel`, current level highlight, QA unlock toggle, and in-app 24-suite test runner. |
| **Gameplay HUD (`TopHud.tsx`)** | Code & UI state inspection | Verified single-row mobile header (`Level N`, District subtitle, `Boarded/Total` counter, Coin badge, Home, Map, Pause, Restart buttons with `>= 42–44px` tap targets). |
| **Pause Screen (`ResultModals.tsx`)** | Code & UI state inspection | Verified Pause modal displays current level progress, independent SFX & Music volume sliders/toggles, Colorblind toggle, Level Map, Main Menu, Restart, and Resume buttons. |
| **Victory & Failure Screens (`ResultModals.tsx`)** | Code & UI state inspection | Verified 1–3 Star rating, `+Coins Earned` (or `Already Claimed (+0)` on replay), Next Level CTA, and VIP Slot Recovery option on Failure Screen. |
| **Android Screen Sizes (`ParkingLotCanvas.tsx`)** | Responsive layout math verification | Verified dynamic `cellPx` clamping across compact (`320×568`, `360×640`), standard (`390×844`), and tall (`412×915`, `430×932`) viewports so 8×10 grids never overflow vertically or horizontally. |
| **App Backgrounding & Resuming (`App.tsx`)** | Lifecycle event listener inspection | Verified `visibilitychange` and `pagehide` listeners flush save data (`flushSaveOnAppInterruption()`), suspend Web Audio (`audioManager.setPaused(true)`), and transition `PLAYING -> PAUSED`. |
| **Portrait Orientation Behavior** | Manifest, Android & UI inspection | Configured `android:screenOrientation="portrait"` in `AndroidManifest.xml`, `"orientation": "portrait"` in `manifest.webmanifest`, and a portrait orientation notice if rotated on a short mobile viewport. |

---

## 3. Summary of Test Counts

- **Automated Test Suites Executed:** `24`
- **Automated Test Suites Passed:** `24`
- **Automated Test Suites Failed:** `0` (after fixing the storage diagnostic order bug discovered during test run)

---

## 4. Bugs Found & Bugs Fixed During QA

### Bug #1: `savePlayerData` Returned `true` on Duplicate State Even During Simulated Storage Failure
- **Symptom Found:** In Automated Test Suite 20, when `setSimulateStorageFailure(true)` was enabled and `savePlayerData(save)` was called with a state identical to the previously saved state, the canonical duplicate-write check ran *before* checking `simulateStorageFailureForTest` / `window.localStorage` availability, returning `true` instead of `false`.
- **Root Cause:** `computeCanonicalSaveSignature` short-circuited at the top of `savePlayerData()` in `src/game/storageManager.ts` prior to checking whether `localStorage` was available.
- **Fix Applied:** Moved the `simulateStorageFailureForTest || typeof window === 'undefined' || !window.localStorage` guard ahead of the duplicate-write short-circuit in `src/game/storageManager.ts`, and updated `resetStorageDiagnostics()` to reset `simulateStorageFailureForTest = false`. Verified in Suites 20 & 21.

### Bug #2: VIP Recovery Modal Deducted Booster Before Confirming `MOVED_TO_VIP_BAY`
- **Symptom Found:** In `src/App.tsx`, `handleRecoverWithVipFromModal` called `tryConsumeBooster('VIP')` *before* calling `applyVipBoosterToVehicle(gameState, inBayBus.id)`. If `applyVipBoosterToVehicle` returned a non-move outcome, a booster or 100 coins could be deducted without moving the bus.
- **Root Cause:** Order of operations in `handleRecoverWithVipFromModal` differed from `handleSelectLotVehicle` and `handleSelectBayVehicleForVip`.
- **Fix Applied:** Updated `handleRecoverWithVipFromModal` in `src/App.tsx` to check `checkBoosterAvailability`, execute `applyVipBoosterToVehicle` first, verify `res.outcome === 'MOVED_TO_VIP_BAY'`, and only then call `tryConsumeBooster('VIP')` and open the vehicle doors (`setVehicleDoorTargetState`). Verified in Suite 24.

### Bug #3: Opening Level Map or Returning to Main Menu from `LEVEL_FAILED` / `LEVEL_COMPLETED` Forced Status to `PLAYING`
- **Symptom Found:** Clicking "Return to Level Menu" or "Main Menu" from `ResultModals.tsx` executed `setGameState(prev => setGameStatus(prev, 'PLAYING'))` on a board that was already deadlocked (`LEVEL_FAILED`) or cleared (`LEVEL_COMPLETED`). If the user closed the Level Select modal without picking a new level, or clicked "Play Level N" from the Main Menu after completing/failing a level, the boarding loop immediately re-evaluated the deadlocked board and fired a duplicate `LEVEL_FAILED` event (`failureTriggerCount = 2`), or showed an empty completed board.
- **Root Cause:** Unnecessary `setGameStatus(prev, 'PLAYING')` calls in `onOpenLevelSelect` and `onReturnToMainMenu` in `src/App.tsx`, and `MainMenuScreen` `onPlayCurrentLevel` only switching `screenMode` without checking if the level was already completed/failed or out of sync with `saveData.currentLevel`.
- **Fix Applied:** Removed the forced `setGameStatus(prev, 'PLAYING')` from `onOpenLevelSelect` and `onReturnToMainMenu`, passed `saveData.currentLevel` to `MainMenuScreen`, and updated `onPlayCurrentLevel` to call `loadSpecificLevel(saveData.currentLevel)` whenever the board is `LEVEL_COMPLETED`, `LEVEL_FAILED`, or on a previous level number.

### Bug #4: In-Game Pause Menu Lacked Separate Music Toggle & Volume Sliders
- **Symptom Found:** While the Main Menu Settings sheet had separate SFX and Music toggles and volume sliders (`0–100%`), the in-game Pause Menu (`ResultModals.tsx`) only exposed a binary SFX toggle (`onToggleSound`).
- **Fix Applied:** Upgraded `ResultModals.tsx` (`status === 'PAUSED'`) to include both the **SFX toggle + volume slider** and the **Music/Ambience toggle + volume slider**, wired to `saveData` and `audioManager`.

### Bug #5: Fixed `cellPx` Could Overflow Vertically on Compact (`320×568` / `360×640`) Screens
- **Symptom Found:** `ParkingLotCanvas.tsx` calculated `cellPx` solely from `gridWidth` and `gridHeight` (`32px–48px`), which on a `568px`-tall compact viewport could cause an 8×10 grid to exceed the vertical space between `ParkingBaysView` and `BoosterDock`.
- **Fix Applied:** Added a responsive `window.innerWidth` / `window.innerHeight` clamp in `ParkingLotCanvas.tsx` so `cellPx` scales automatically to fit both width and height (`>= 24px`), plus a portrait-orientation notice if rotated into a short landscape viewport.

---

## 5. Known Limitations & Remaining Release Blockers

1. **Web Audio Synthesis vs. Studio Recorded Audio Tracks:**
   - All 9 sound cues and the blocked horn are generated procedurally via the browser/WebView `AudioContext` API with zero external `.mp3`/`.ogg` network dependencies. While this guarantees instant zero-latency playback and tiny APK size, studio-mastered `.ogg` ambient music loops can be added in a future content update if desired.
2. **Native Android Binary Compilation Environment:**
   - The web application bundle (`dist/`), Capacitor configuration (`capacitor.config.ts`), and Android Gradle project (`android/`) are fully configured and verified in the repository. Generating signed `.apk` and `.aab` binaries via `./gradlew assembleDebug`, `./gradlew assembleRelease`, and `./gradlew bundleRelease` requires a host machine or CI runner with JDK 17 and the Android SDK (API 35) installed, as documented in `docs/BUILD_GUIDE.md`.
3. **Remaining Release Blockers:**
   - **None** in application source code, 100-level campaign data, save persistence, or UI/UX.
