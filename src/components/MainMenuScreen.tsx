import React, { useEffect, useState } from 'react';
import {
  Bus,
  CheckCircle2,
  Coins,
  Eye,
  Globe,
  Map,
  Music,
  Play,
  Settings,
  ShieldCheck,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ENVIRONMENT_THEME_IDS,
  ENVIRONMENT_THEMES,
  getEnvironmentThemeForLevel,
} from '../assets/environmentThemes';
import {
  OpenTopVehicleVisual,
  PassengerToken,
  VehicleMasterMeshAtlas,
} from '../assets/vehicleSprites';
import { audioManager } from '../game/audioManager';
import { TOTAL_LEVELS } from '../game/levelGenerator';
import {
  EnvironmentThemeId,
  Vehicle,
  VehicleKinematics,
} from '../game/types';
import { runAllCoreGameplayTests } from '../tests/coreGameplay.test';

interface MainMenuScreenProps {
  currentLevel: number;
  unlockedLevel: number;
  coins: number;
  starsByLevel: Record<number, number>;
  soundEnabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
  colorblindMode: boolean;
  preferredTheme: EnvironmentThemeId | 'AUTO';
  onPlayCurrentLevel: () => void;
  onOpenLevelSelect: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onChangeSfxVolume: (vol: number) => void;
  onChangeMusicVolume: (vol: number) => void;
  onToggleColorblind: () => void;
  onSelectPreferredTheme: (theme: EnvironmentThemeId | 'AUTO') => void;
}

const SHOWCASE_SUV: Vehicle = {
  id: 'menu-showcase-suv',
  color: 'BLUE',
  capacity: 4,
  occupiedSeats: 2,
  boardedPassengerIds: ['c1', 'c2'],
  gridX: 0,
  gridY: 0,
  length: 2,
  direction: 'RIGHT',
  state: 'IN_BAY',
  assignedBayId: 'bay-0',
  carVariant: 'LUXURY_SUV',
};

const SHOWCASE_COUPE: Vehicle = {
  id: 'menu-showcase-coupe',
  color: 'RED',
  capacity: 4,
  occupiedSeats: 3,
  boardedPassengerIds: ['s1', 's2', 's3'],
  gridX: 1,
  gridY: 0,
  length: 2,
  direction: 'RIGHT',
  state: 'IN_BAY',
  assignedBayId: 'bay-1',
  carVariant: 'SPORT_COUPE',
};

const SHOWCASE_HATCH: Vehicle = {
  id: 'menu-showcase-hatch',
  color: 'CYAN',
  capacity: 4,
  occupiedSeats: 2,
  boardedPassengerIds: ['h1', 'h2'],
  gridX: 2,
  gridY: 0,
  length: 2,
  direction: 'RIGHT',
  state: 'IN_BAY',
  assignedBayId: 'bay-2',
  carVariant: 'TOURING_HATCH',
};

const SHOWCASE_COACH: Vehicle = {
  id: 'menu-showcase-bus',
  color: 'AMBER',
  capacity: 8,
  occupiedSeats: 5,
  boardedPassengerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
  gridX: 0,
  gridY: 1,
  length: 4,
  direction: 'RIGHT',
  state: 'IN_BAY',
  assignedBayId: 'bay-3',
};

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  currentLevel,
  unlockedLevel,
  coins,
  starsByLevel,
  soundEnabled,
  musicEnabled,
  sfxVolume,
  musicVolume,
  colorblindMode,
  preferredTheme,
  onPlayCurrentLevel,
  onOpenLevelSelect,
  onToggleSound,
  onToggleMusic,
  onChangeSfxVolume,
  onChangeMusicVolume,
  onToggleColorblind,
  onSelectPreferredTheme,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showcaseTick, setShowcaseTick] = useState(0);
  const [qaSummary, setQaSummary] = useState<{
    passed: number;
    failed: number;
  } | null>(null);

  const activeTheme = getEnvironmentThemeForLevel(currentLevel, preferredTheme);

  // Subtle showcase animation on the Main Menu diorama
  useEffect(() => {
    const id = window.setInterval(() => {
      setShowcaseTick((t) => (t + 1) % 120);
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  const isShowcaseDriving = showcaseTick < 70;
  const showcaseKinematics: VehicleKinematics = {
    x: 0,
    y: 0,
    headingDeg: 90,
    speed: isShowcaseDriving ? 3.5 : 0,
    wheelRotationDeg: isShowcaseDriving ? (showcaseTick * 24) % 360 : 0,
    suspensionOffsetPx: isShowcaseDriving
      ? Math.sin(showcaseTick * 0.35) * 1.1
      : 0,
    suspensionVelocity: 0,
    doorState: isShowcaseDriving ? 'CLOSED' : 'OPEN',
    doorOpenProgress: isShowcaseDriving ? 0 : 1,
  };

  const totalStarsEarned = Object.values(starsByLevel).reduce(
    (sum, s) => sum + s,
    0
  );
  const completedLevelsCount = Object.values(starsByLevel).filter(
    (s) => s > 0
  ).length;

  return (
    <div
      className="w-full h-full flex flex-col justify-between p-4 select-none relative overflow-hidden"
      style={{
        backgroundColor: activeTheme.shellBgHex,
        backgroundImage: activeTheme.ambientLightGradient,
      }}
    >
      {/* Mount Shared SVG Master Mesh Prototype Atlas Once */}
      <VehicleMasterMeshAtlas />

      {/* 1. Top Mobile Utility Bar: Audio Controls, Coin Balance & Settings */}
      <header className="w-full flex items-center justify-between gap-2 z-10 pt-1">
        <button
          type="button"
          onClick={() => {
            audioManager.playButtonTap();
            onToggleSound();
          }}
          className="min-w-[44px] min-h-[44px] px-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-1.5 text-xs font-bold text-slate-200 active:scale-95 transition-transform shadow-md"
          aria-label={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400" />
          )}
          <span>{soundEnabled ? 'SFX ON' : 'Muted'}</span>
        </button>

        {/* Coin Balance Display */}
        <div className="min-h-[44px] px-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-1.5 text-amber-400 font-extrabold text-sm tabular-nums shadow-md">
          <Coins className="w-4 h-4 shrink-0" />
          <span>{coins}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            audioManager.playButtonTap();
            setIsSettingsOpen(true);
          }}
          className="min-w-[44px] min-h-[44px] rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-slate-200 active:scale-95 transition-transform shadow-md"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* 2. Brand Identity & Realistic Car + Coach Bus Diorama Showcase */}
      <main className="flex-1 flex flex-col items-center justify-center text-center my-2 z-10">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
          <Bus className="w-4 h-4" />
          <span>{activeTheme.name} Transit Authority</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1 drop-shadow">
          BUS JAM MOBILE
        </h1>
        <p className="text-xs text-slate-300 max-w-[270px] mb-4 leading-relaxed">
          Unblock realistic city cars, shuttles, and articulated buses across 100 mobile stops.
        </p>

        {/* Live 3D-Extruded Car & Coach Bus Diorama Card */}
        <div
          className="w-full max-w-[335px] rounded-3xl p-3.5 border-2 shadow-2xl mb-4"
          style={{
            backgroundColor: activeTheme.roadSurfaceHex,
            borderColor: activeTheme.roadBorderHex,
          }}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-2">
            <span className="font-semibold">{activeTheme.subtitle}</span>
            <span className="tabular-nums font-bold text-emerald-400">
              {isShowcaseDriving
                ? 'Driving · Wheels Active'
                : 'Bay Stop · Doors Open'}
            </span>
          </div>

          <div
            className="w-full rounded-2xl border p-2.5 flex flex-col gap-2 relative overflow-hidden"
            style={{
              backgroundColor: activeTheme.lotAsphaltHex,
              borderColor: activeTheme.roadBorderHex,
            }}
          >
            {/* Row 1: The 3 Instanced Car Models (Luxury SUV, GT Sport Coupe, Touring Hatchback) */}
            <div className="grid grid-cols-3 gap-1.5 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-full h-9">
                  <OpenTopVehicleVisual
                    vehicle={{
                      ...SHOWCASE_SUV,
                      occupiedSeats: isShowcaseDriving ? 2 : 3,
                    }}
                    showSymbol={colorblindMode}
                    kinematics={showcaseKinematics}
                    headlightBeamOpacity={activeTheme.headlightBeamOpacity}
                    instancedMode={true}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  Luxury SUV
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="w-full h-9">
                  <OpenTopVehicleVisual
                    vehicle={{
                      ...SHOWCASE_COUPE,
                      occupiedSeats: isShowcaseDriving ? 3 : 4,
                    }}
                    showSymbol={colorblindMode}
                    kinematics={showcaseKinematics}
                    headlightBeamOpacity={activeTheme.headlightBeamOpacity}
                    instancedMode={true}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  GT Sport Coupe
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="w-full h-9">
                  <OpenTopVehicleVisual
                    vehicle={{
                      ...SHOWCASE_HATCH,
                      occupiedSeats: isShowcaseDriving ? 1 : 2,
                    }}
                    showSymbol={colorblindMode}
                    kinematics={showcaseKinematics}
                    headlightBeamOpacity={activeTheme.headlightBeamOpacity}
                    instancedMode={true}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  Touring Hatch
                </span>
              </div>
            </div>

            {/* Row 2: Realistic 8-Seat Double-Axle City Coach Bus */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1 shrink-0">
                <PassengerToken
                  color="AMBER"
                  isFront={!isShowcaseDriving}
                  showSymbol={colorblindMode}
                  size="sm"
                />
                <span className="text-[10px] font-bold text-slate-300">
                  8p Coach Bus
                </span>
              </div>
              <div className="w-40 h-10">
                <OpenTopVehicleVisual
                  vehicle={{
                    ...SHOWCASE_COACH,
                    occupiedSeats: isShowcaseDriving ? 5 : 6,
                  }}
                  showSymbol={colorblindMode}
                  kinematics={showcaseKinematics}
                  headlightBeamOpacity={activeTheme.headlightBeamOpacity}
                  instancedMode={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progression Telemetry Summary */}
        <div className="flex items-center justify-center gap-3 text-xs text-slate-300 tabular-nums">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {completedLevelsCount}/{TOTAL_LEVELS} Cleared
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            {totalStarsEarned}/{TOTAL_LEVELS * 3} Stars
          </span>
        </div>
      </main>

      {/* 3. Primary Thumb-Zone Navigation Actions */}
      <footer className="w-full space-y-2.5 pb-2 z-10">
        <button
          type="button"
          onClick={() => {
            audioManager.playButtonTap();
            onPlayCurrentLevel();
          }}
          className="w-full min-h-[54px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition-all text-slate-950 font-extrabold text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>Play Level {currentLevel}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            audioManager.playButtonTap();
            onOpenLevelSelect();
          }}
          className="w-full min-h-[48px] rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-[0.98] transition-all border border-slate-700 text-slate-100 font-bold text-xs flex items-center justify-between px-4"
        >
          <span className="flex items-center gap-2">
            <Map className="w-4 h-4 text-amber-400" />
            <span>100-Level Progression Map</span>
          </span>
          <span className="text-slate-400 tabular-nums">
            Unlocked: {unlockedLevel}/100
          </span>
        </button>
      </footer>

      {/* 4. Mobile Settings & Audio Mixer Sheet */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-[430px] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Audio Mixer, Themes & Settings
                </h2>
                <p className="text-xs text-slate-400">
                  Saved automatically to persistent local storage (v2)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  audioManager.playButtonTap();
                  setIsSettingsOpen(false);
                }}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center text-slate-300"
                aria-label="Close Settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audio Mixer Controls (Separate SFX & Music Volume) */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      audioManager.playButtonTap();
                      onToggleSound();
                    }}
                    className="flex items-center gap-2"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Sound Effects (SFX)</span>
                  </button>
                  <span className="tabular-nums text-emerald-400 font-bold">
                    {soundEnabled ? `${Math.round(sfxVolume * 100)}%` : 'MUTED'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sfxVolume * 100)}
                  onChange={(e) =>
                    onChangeSfxVolume(Number(e.target.value) / 100)
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                  aria-label="Sound Effects Volume"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      audioManager.playButtonTap();
                      onToggleMusic();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Music
                      className={`w-4 h-4 ${
                        musicEnabled ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Transit Ambience / Music</span>
                  </button>
                  <span className="tabular-nums text-amber-400 font-bold">
                    {musicEnabled
                      ? `${Math.round(musicVolume * 100)}%`
                      : 'MUTED'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(musicVolume * 100)}
                  onChange={(e) =>
                    onChangeMusicVolume(Number(e.target.value) / 100)
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                  aria-label="Music Volume"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  audioManager.playButtonTap();
                  onToggleColorblind();
                }}
                className="w-full min-h-[46px] px-4 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-100"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  High-Contrast Colorblind Symbols
                </span>
                <span
                  className={
                    colorblindMode
                      ? 'text-sky-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {colorblindMode ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Environment Theme Selector (6 Distinct Themes + Auto) */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Environment Theme</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonTap();
                    onSelectPreferredTheme('AUTO');
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                    preferredTheme === 'AUTO'
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <div>Auto by Level</div>
                  <div className="text-[10px] text-slate-400">
                    Cycles all 6 worlds
                  </div>
                </button>
                {ENVIRONMENT_THEME_IDS.map((themeId) => {
                  const spec = ENVIRONMENT_THEMES[themeId];
                  const isSelected = preferredTheme === themeId;
                  return (
                    <button
                      key={themeId}
                      type="button"
                      onClick={() => {
                        audioManager.playButtonTap();
                        onSelectPreferredTheme(themeId);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="truncate">{spec.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {spec.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Diagnostic Verification Button */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  audioManager.playButtonTap();
                  const res = runAllCoreGameplayTests();
                  setQaSummary({ passed: res.passed, failed: res.failed });
                }}
                className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {qaSummary
                    ? `Verified: ${qaSummary.passed}/${
                        qaSummary.passed + qaSummary.failed
                      } Automated Tests Passed`
                    : 'Run Automated Gameplay, Save & Performance Tests'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
