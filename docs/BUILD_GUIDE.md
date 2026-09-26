# Bus Jam Mobile — Android Build & Release Guide (`BUILD_GUIDE.md`)

## 1. Technology Stack & Build System Identification

Before configuring Android packaging, the project was inspected to identify its exact technology stack:
- **Language & UI Framework:** TypeScript 7.0 + React 19.0 (`src/App.tsx`, `src/main.tsx`)
- **Build Bundler:** Vite 8.3 (`vite.config.ts`, `npm run build` -> outputs static production bundle to `/dist`)
- **Styling:** Tailwind CSS 4.3 (`@tailwindcss/vite`)
- **Android Native Packaging Architecture:** Capacitor Android WebView Wrapper (`capacitor.config.ts` + `/android` Gradle project) & Installable Portrait Web App (`public/manifest.webmanifest` + `public/icon.svg`).

---

## 2. Android Application Configuration Summary

| Parameter | Configured Value | Location |
| :--- | :--- | :--- |
| **Application Name** | `Bus Jam Mobile` (`short_name: "Bus Jam"`) | `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml`, `public/manifest.webmanifest` |
| **Application ID (`package`)** | `com.transitpuzzle.busjammobile` | `capacitor.config.ts`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml` |
| **Debug Application ID** | `com.transitpuzzle.busjammobile.debug` | `android/app/build.gradle` (`applicationIdSuffix ".debug"`) |
| **Version Code / Name** | `versionCode 1` / `versionName "1.0.0"` | `android/app/build.gradle` |
| **Minimum Android SDK** | `minSdkVersion = 24` (Android 7.0 Nougat) | `android/variables.gradle` |
| **Target & Compile SDK** | `targetSdkVersion = 35` / `compileSdkVersion = 35` (Android 15) | `android/variables.gradle` |
| **Screen Orientation** | Locked Portrait (`android:screenOrientation="portrait"`) | `android/app/src/main/AndroidManifest.xml`, `public/manifest.webmanifest` |
| **Permissions** | Minimal (`android.permission.INTERNET` only; `usesCleartextTraffic="false"`) | `android/app/src/main/AndroidManifest.xml` |
| **Application Icon** | Vector & Adaptive Launcher Icons (`@mipmap/ic_launcher`, `@mipmap/ic_launcher_round`, `/public/icon.svg`) | `android/app/src/main/res/mipmap-anydpi-v26/`, `public/icon.svg` |

---

## 3. Required Development Tools

To build the web bundle, run automated verification, and compile native Android `.apk` / `.aab` packages on a development workstation or CI runner:

1. **Node.js:** `v20.x` or `v22.x` LTS (with `npm`)
2. **Java Development Kit (JDK):** **JDK 17** (`JAVA_HOME` configured; required by Android Gradle Plugin `8.7.2`)
3. **Android SDK (via Android Studio Ladybug+ or `sdkmanager` CLI):**
   - Android SDK Platform `35` (Android 15)
   - Android SDK Build-Tools `35.0.0`
   - Android SDK Platform-Tools (`adb`)
4. **Capacitor CLI (for syncing `/dist` into `/android`):**
   ```bash
   npm install -D @capacitor/cli @capacitor/core @capacitor/android
   ```

---

## 4. Step-by-Step Build Instructions

### Step 1: Run Automated Tests, Typecheck & Build Web Production Bundle (`/dist`)
*(Verified and executed directly in the workspace environment)*

```bash
# 1. Run all 24 automated gameplay, 100-level solver, save system, audio, and performance test suites
npm test

# 2. Run TypeScript compiler static type verification
npm run lint

# 3. Compile minified production web bundle into /dist
npm run build
```
- **Verified Status in Workspace:** `npm test` (`24/24 PASS`), `npm run lint` (`0 errors`), and `npm run build` (`dist/` generated cleanly) all succeeded.

### Step 2: Sync Production Web Assets (`/dist`) into Android Project
On a workstation with Capacitor CLI installed:
```bash
npx cap sync android
```
*(Alternatively, copy the contents of `/dist` into `android/app/src/main/assets/public/`).*

### Step 3: Build Output 1 — Debug APK for Local Testing
From the `/android` directory on a host with JDK 17 and Android SDK 35:
```bash
cd android
./gradlew assembleDebug
```
- **Output Location:**
  `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 4: Configure Secure Release Signing (Required for Release APK & AAB)
**SECURITY POLICY:**
- Signing passwords and private `.jks` / `.keystore` files are **never hardcoded** in `build.gradle` and are **blocked from git commits** via `.gitignore`.
- Generate a release keystore outside the repository (or use your organization's secret manager):
  ```bash
  keytool -genkey -v -keystore ~/keys/bus-jam-release.jks \
    -keyalg RSA -keysize 2048 -validity 10000 -alias busjam-release
  ```
- Provide credentials via **either** environment variables (recommended for CI/CD):
  ```bash
  export ANDROID_KEYSTORE_PATH="$HOME/keys/bus-jam-release.jks"
  export ANDROID_KEYSTORE_PASSWORD="<your-keystore-password>"
  export ANDROID_KEY_ALIAS="busjam-release"
  export ANDROID_KEY_PASSWORD="<your-key-password>"
  ```
  **or** by copying `android/keystore.properties.example` to `android/keystore.properties` (which is git-ignored).

### Step 5: Build Output 2 — Signed Release APK (Direct Installation)
```bash
cd android
./gradlew assembleRelease
```
- **Output Location:**
  `android/app/build/outputs/apk/release/app-release.apk`

### Step 6: Build Output 3 — Signed Release Android App Bundle (AAB for Google Play)
```bash
cd android
./gradlew bundleRelease
```
- **Output Location:**
  `android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. On-Device Installation & Testing Instructions

### Installing the Debug APK via `adb`
1. Connect an Android device (with USB Debugging enabled) or start an Android Emulator (API 24–35).
2. Install and launch the debug build:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   adb shell am start -n com.transitpuzzle.busjammobile.debug/com.transitpuzzle.busjammobile.MainActivity
   ```

### On-Device Verification Checklist
1. **Launch & Orientation:** Confirm the app launches in **Portrait** mode with the dark `#020617` splash screen and remains locked to Portrait when rotating the phone.
2. **Representative Campaign Levels:** Play through Level 1 (Onboarding), Level 15 (Minibuses), Level 45 (Heavy 8-seat Coach Buses), and Level 80+ (Mystery Vehicles) or run the built-in **24-Suite Automated Verifier** inside **Main Menu -> Settings -> Run Automated Gameplay, Save & Performance Tests**.
3. **Save Persistence & Backgrounding:** Complete a level, adjust SFX/Music volume sliders in Settings, press the Android Home button (triggering `visibilitychange` -> `flushSaveOnAppInterruption()`), force-close the app, and relaunch to verify coins, unlocked levels, stars, and audio settings persist.
4. **Crash & Logcat Inspection:** Monitor `adb logcat | grep -i "busjammobile"` during level transitions and rapid touch input to confirm zero unhandled exceptions.

---

## 6. Final Google Play Release Preparation Checklist

- [x] `applicationId` set to `com.transitpuzzle.busjammobile` (`versionCode 1`, `versionName "1.0.0"`).
- [x] `minSdkVersion 24` and `targetSdkVersion 35` (meets Google Play API 35 target requirement).
- [x] R8/ProGuard code shrinking (`minifyEnabled true`) and resource shrinking (`shrinkResources true`) configured in `android/app/build.gradle`.
- [x] Signing credentials externalized via environment variables / untracked `keystore.properties` and excluded in `.gitignore`.
- [x] All 100 campaign levels validated for zero overlaps, exact seat parity, geometric uniqueness, and zero-booster solvability (`docs/LEVEL_VALIDATION_REPORT.md`).
- [x] All 24 automated test suites passing (`docs/QA_REPORT.md`).
