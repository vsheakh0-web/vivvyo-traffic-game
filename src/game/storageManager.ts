import { TOTAL_LEVELS } from './levelGenerator';
import { BoosterType, EnvironmentThemeId, PlayerSaveData } from './types';

export const CURRENT_SAVE_VERSION = 2;
export const STORAGE_KEY = 'bus_jam_mobile_save_v1';
export const BACKUP_STORAGE_KEY = 'bus_jam_mobile_save_backup_v2';

export const BOOSTER_COIN_COSTS: Record<BoosterType, number> = {
  VIP: 100,
  PICK: 120,
  SHUFFLE: 80,
};

export const EXTRA_BAY_COIN_COST = 150;

export interface StorageDiagnostics {
  totalWrites: number;
  duplicateWritesSkipped: number;
  migrationsRun: number;
  corruptedRecoveries: number;
  rejectedIncompleteWrites: number;
}

const diagnostics: StorageDiagnostics = {
  totalWrites: 0,
  duplicateWritesSkipped: 0,
  migrationsRun: 0,
  corruptedRecoveries: 0,
  rejectedIncompleteWrites: 0,
};

export function getStorageDiagnostics(): StorageDiagnostics {
  return { ...diagnostics };
}

export function resetStorageDiagnostics(): void {
  diagnostics.totalWrites = 0;
  diagnostics.duplicateWritesSkipped = 0;
  diagnostics.migrationsRun = 0;
  diagnostics.corruptedRecoveries = 0;
  diagnostics.rejectedIncompleteWrites = 0;
  lastSavedCanonicalJson = '';
  simulateStorageFailureForTest = false;
  memoryFallbackSave = createDefaultSaveData();
}

export function createDefaultSaveData(): PlayerSaveData {
  return {
    schemaVersion: CURRENT_SAVE_VERSION,
    unlockedLevel: 1,
    currentLevel: 1,
    coins: 300,
    starsByLevel: {},
    completedLevels: {},
    rewardedLevels: {},
    boosters: {
      VIP: 3,
      PICK: 3,
      SHUFFLE: 3,
    },
    extraBaysUnlocked: 0,
    soundEnabled: true,
    musicEnabled: true,
    sfxVolume: 0.85,
    musicVolume: 0.45,
    colorblindMode: true,
    preferredTheme: 'AUTO',
    qaUnlockAllLevels: false,
    lastSavedAt: Date.now(),
  };
}

let memoryFallbackSave: PlayerSaveData = createDefaultSaveData();
let lastSavedCanonicalJson = '';
let simulateStorageFailureForTest = false;

/**
 * Enables or disables simulated storage failure for automated testing of save error handling.
 */
export function setSimulateStorageFailure(enabled: boolean): void {
  simulateStorageFailureForTest = enabled;
}

function clampFiniteInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function clampUnitFloat(val: unknown, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, Number(num.toFixed(2))));
}

const VALID_THEMES = new Set<string>([
  'AUTO',
  'MODERN_CITY',
  'SUBURBAN_STREETS',
  'COASTAL_ROADS',
  'INDUSTRIAL_DISTRICT',
  'GREEN_PARK',
  'NIGHTTIME_CITY',
]);

/**
 * Computes a deterministic canonical string of all gameplay-significant save fields
 * (excluding timestamps) to prevent duplicate save writes when nothing changed.
 */
function computeCanonicalSaveSignature(data: PlayerSaveData): string {
  return JSON.stringify({
    v: data.schemaVersion ?? CURRENT_SAVE_VERSION,
    u: data.unlockedLevel,
    c: data.currentLevel,
    coins: data.coins,
    stars: data.starsByLevel,
    completed: data.completedLevels ?? {},
    rewarded: data.rewardedLevels ?? {},
    boosters: data.boosters,
    bays: data.extraBaysUnlocked,
    snd: data.soundEnabled,
    mus: data.musicEnabled ?? true,
    sfxV: data.sfxVolume ?? 0.85,
    musV: data.musicVolume ?? 0.45,
    cb: data.colorblindMode,
    theme: data.preferredTheme,
    qa: data.qaUnlockAllLevels,
  });
}

/**
 * Migrates any raw v0/v1 or partial save object into a complete, validated v2 `PlayerSaveData` object.
 */
export function migrateAndSanitizeSaveData(
  rawInput: unknown,
  fallbackBase?: PlayerSaveData
): { data: PlayerSaveData; migrated: boolean } {
  const defaults = fallbackBase ? { ...fallbackBase } : createDefaultSaveData();
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { data: createDefaultSaveData(), migrated: false };
  }

  const raw = rawInput as Record<string, unknown>;
  const inputVersion = Number(raw.schemaVersion ?? 1);
  const migrated = inputVersion < CURRENT_SAVE_VERSION;
  if (migrated) {
    diagnostics.migrationsRun++;
  }

  // Support v0/v1 legacy field aliases (e.g. `level` -> `unlockedLevel`, `gold` -> `coins`)
  const rawUnlocked = raw.unlockedLevel ?? raw.level ?? defaults.unlockedLevel;
  const rawCurrent = raw.currentLevel ?? rawUnlocked ?? defaults.currentLevel;
  const rawCoins = raw.coins ?? raw.gold ?? defaults.coins;

  const starsByLevel: Record<number, number> = {};
  if (raw.starsByLevel && typeof raw.starsByLevel === 'object') {
    for (const [k, v] of Object.entries(raw.starsByLevel as Record<string, unknown>)) {
      const lvl = Number(k);
      const stars = Number(v);
      if (
        Number.isInteger(lvl) &&
        lvl >= 1 &&
        lvl <= TOTAL_LEVELS &&
        Number.isFinite(stars) &&
        stars > 0
      ) {
        starsByLevel[lvl] = Math.min(3, Math.max(1, Math.floor(stars)));
      }
    }
  }

  const completedLevels: Record<number, boolean> = {};
  if (raw.completedLevels && typeof raw.completedLevels === 'object') {
    for (const [k, v] of Object.entries(raw.completedLevels as Record<string, unknown>)) {
      const lvl = Number(k);
      if (Number.isInteger(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS && Boolean(v)) {
        completedLevels[lvl] = true;
      }
    }
  }

  const rewardedLevels: Record<number, boolean> = {};
  if (raw.rewardedLevels && typeof raw.rewardedLevels === 'object') {
    for (const [k, v] of Object.entries(raw.rewardedLevels as Record<string, unknown>)) {
      const lvl = Number(k);
      if (Number.isInteger(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS && Boolean(v)) {
        rewardedLevels[lvl] = true;
      }
    }
  }

  // Ensure any level with stars > 0 is marked completed and rewarded
  let highestCompleted = 0;
  for (const [lvlKey, stars] of Object.entries(starsByLevel)) {
    const lvl = Number(lvlKey);
    if (stars > 0) {
      completedLevels[lvl] = true;
      rewardedLevels[lvl] = true;
      if (lvl > highestCompleted) {
        highestCompleted = lvl;
      }
    }
  }
  for (const [lvlKey, isDone] of Object.entries(completedLevels)) {
    const lvl = Number(lvlKey);
    if (isDone && lvl > highestCompleted) {
      highestCompleted = lvl;
      if (!starsByLevel[lvl]) {
        starsByLevel[lvl] = 3;
      }
      rewardedLevels[lvl] = true;
    }
  }

  const unlockedLevel = Math.max(
    clampFiniteInt(rawUnlocked, 1, TOTAL_LEVELS, defaults.unlockedLevel),
    Math.min(TOTAL_LEVELS, highestCompleted + 1)
  );
  const currentLevel = clampFiniteInt(
    rawCurrent,
    1,
    TOTAL_LEVELS,
    Math.min(unlockedLevel, defaults.currentLevel)
  );

  const rawBoosters =
    raw.boosters && typeof raw.boosters === 'object'
      ? (raw.boosters as Record<string, unknown>)
      : {};

  const preferredThemeRaw = String(raw.preferredTheme ?? defaults.preferredTheme);
  const preferredTheme = (
    VALID_THEMES.has(preferredThemeRaw) ? preferredThemeRaw : 'AUTO'
  ) as EnvironmentThemeId | 'AUTO';

  const sanitized: PlayerSaveData = {
    schemaVersion: CURRENT_SAVE_VERSION,
    unlockedLevel,
    currentLevel,
    coins: clampFiniteInt(rawCoins, 0, 9999999, defaults.coins),
    starsByLevel,
    completedLevels,
    rewardedLevels,
    boosters: {
      VIP: clampFiniteInt(rawBoosters.VIP, 0, 999, defaults.boosters.VIP),
      PICK: clampFiniteInt(rawBoosters.PICK, 0, 999, defaults.boosters.PICK),
      SHUFFLE: clampFiniteInt(
        rawBoosters.SHUFFLE,
        0,
        999,
        defaults.boosters.SHUFFLE
      ),
    },
    extraBaysUnlocked: clampFiniteInt(
      raw.extraBaysUnlocked,
      0,
      2,
      defaults.extraBaysUnlocked
    ),
    soundEnabled:
      typeof raw.soundEnabled === 'boolean'
        ? raw.soundEnabled
        : defaults.soundEnabled,
    musicEnabled:
      typeof raw.musicEnabled === 'boolean'
        ? raw.musicEnabled
        : defaults.musicEnabled ?? true,
    sfxVolume: clampUnitFloat(raw.sfxVolume, defaults.sfxVolume ?? 0.85),
    musicVolume: clampUnitFloat(raw.musicVolume, defaults.musicVolume ?? 0.45),
    colorblindMode:
      typeof raw.colorblindMode === 'boolean'
        ? raw.colorblindMode
        : defaults.colorblindMode,
    preferredTheme,
    qaUnlockAllLevels:
      typeof raw.qaUnlockAllLevels === 'boolean'
        ? raw.qaUnlockAllLevels
        : defaults.qaUnlockAllLevels,
    lastSavedAt: Date.now(),
  };

  return { data: sanitized, migrated };
}

/**
 * Loads player save data from persistent storage, automatically migrating v1 data
 * or recovering from backup/defaults if primary storage is missing or corrupted.
 */
export function loadSaveData(): PlayerSaveData {
  if (
    simulateStorageFailureForTest ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return {
      ...memoryFallbackSave,
      starsByLevel: { ...memoryFallbackSave.starsByLevel },
      completedLevels: { ...(memoryFallbackSave.completedLevels ?? {}) },
      rewardedLevels: { ...(memoryFallbackSave.rewardedLevels ?? {}) },
      boosters: { ...memoryFallbackSave.boosters },
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const backupRaw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
      if (backupRaw) {
        const parsedBackup = JSON.parse(backupRaw);
        const { data } = migrateAndSanitizeSaveData(parsedBackup);
        memoryFallbackSave = data;
        lastSavedCanonicalJson = computeCanonicalSaveSignature(data);
        return data;
      }
      const fresh = createDefaultSaveData();
      memoryFallbackSave = fresh;
      return fresh;
    }

    const parsed = JSON.parse(raw);
    const { data, migrated } = migrateAndSanitizeSaveData(parsed);
    memoryFallbackSave = data;
    lastSavedCanonicalJson = computeCanonicalSaveSignature(data);

    // Persist migrated v2 format back to storage immediately
    if (migrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(data));
    }

    return data;
  } catch {
    diagnostics.corruptedRecoveries++;
    // Attempt recovery from rolling backup key before falling back to defaults
    try {
      const backupRaw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
      if (backupRaw) {
        const parsedBackup = JSON.parse(backupRaw);
        const { data } = migrateAndSanitizeSaveData(parsedBackup);
        memoryFallbackSave = data;
        lastSavedCanonicalJson = computeCanonicalSaveSignature(data);
        return data;
      }
    } catch {
      // Backup also unreadable
    }
    const safeDefault = createDefaultSaveData();
    memoryFallbackSave = safeDefault;
    return safeDefault;
  }
}

/**
 * Validates and persists `PlayerSaveData`.
 * - Rejects null/incomplete payloads to avoid overwriting valid progress.
 * - Deduplicates identical consecutive writes to avoid redundant storage I/O.
 * - Writes both primary and backup storage keys safely.
 */
export function savePlayerData(data: PlayerSaveData): boolean {
  if (
    !data ||
    typeof data !== 'object' ||
    typeof data.unlockedLevel !== 'number' ||
    typeof data.coins !== 'number' ||
    !Number.isFinite(data.unlockedLevel) ||
    !Number.isFinite(data.coins) ||
    !data.boosters ||
    typeof data.boosters !== 'object'
  ) {
    diagnostics.rejectedIncompleteWrites++;
    return false;
  }

  const { data: sanitized } = migrateAndSanitizeSaveData(
    data,
    memoryFallbackSave
  );

  memoryFallbackSave = sanitized;

  if (
    simulateStorageFailureForTest ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return false;
  }

  // Deduplicate identical consecutive writes to localStorage
  const canonical = computeCanonicalSaveSignature(sanitized);
  if (canonical === lastSavedCanonicalJson) {
    diagnostics.duplicateWritesSkipped++;
    return true;
  }

  lastSavedCanonicalJson = canonical;

  try {
    const serialized = JSON.stringify(sanitized);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    window.localStorage.setItem(BACKUP_STORAGE_KEY, serialized);
    diagnostics.totalWrites++;
    return true;
  } catch {
    // Gracefully keep memoryFallbackSave intact on quota or security errors
    return false;
  }
}

/**
 * Flushes the current in-memory save state to `localStorage` on Android app backgrounding or interruption.
 */
export function flushSaveOnAppInterruption(): boolean {
  if (
    simulateStorageFailureForTest ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return false;
  }
  try {
    const serialized = JSON.stringify({
      ...memoryFallbackSave,
      lastSavedAt: Date.now(),
    });
    window.localStorage.setItem(STORAGE_KEY, serialized);
    window.localStorage.setItem(BACKUP_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a level number is unlocked and allowed to be launched.
 */
export function canLaunchLevel(
  save: PlayerSaveData,
  levelNumber: number
): boolean {
  if (levelNumber < 1 || levelNumber > TOTAL_LEVELS) {
    return false;
  }
  return Boolean(save.qaUnlockAllLevels || levelNumber <= save.unlockedLevel);
}

/**
 * Computes the coin and star reward for completing a level.
 * Strictly prevents duplicate coin rewards for a level that has already been completed.
 */
export function calculateLevelReward(
  levelNumber: number,
  boostersUsedCount: number,
  alreadyCompletedBefore: boolean
): {
  coinsEarned: number;
  starsEarned: 1 | 2 | 3;
  isDuplicateCompletion: boolean;
} {
  const starsEarned: 1 | 2 | 3 =
    boostersUsedCount === 0 ? 3 : boostersUsedCount === 1 ? 2 : 1;

  if (alreadyCompletedBefore) {
    return {
      coinsEarned: 0,
      starsEarned,
      isDuplicateCompletion: true,
    };
  }

  const baseCoins = 50 + levelNumber * 5;
  const starBonus = starsEarned === 3 ? 25 : starsEarned === 2 ? 10 : 0;
  return {
    coinsEarned: baseCoins + starBonus,
    starsEarned,
    isDuplicateCompletion: false,
  };
}

/**
 * Records level completion in persistent save data, unlocking the next sequential level
 * and awarding coins ONLY on the first completion of `levelNumber` (preventing duplicate farming).
 */
export function recordLevelCompletionInSave(
  save: PlayerSaveData,
  levelNumber: number,
  boostersUsedCount: number
): {
  updatedSave: PlayerSaveData;
  coinsEarned: number;
  starsEarned: 1 | 2 | 3;
  isDuplicateCompletion: boolean;
} {
  const previousStars = save.starsByLevel[levelNumber] || 0;
  const alreadyCompleted =
    previousStars > 0 ||
    Boolean(save.completedLevels?.[levelNumber]) ||
    Boolean(save.rewardedLevels?.[levelNumber]);

  const { coinsEarned, starsEarned, isDuplicateCompletion } =
    calculateLevelReward(levelNumber, boostersUsedCount, alreadyCompleted);

  const nextLevel = Math.min(TOTAL_LEVELS, levelNumber + 1);
  const updatedSave: PlayerSaveData = {
    ...save,
    schemaVersion: CURRENT_SAVE_VERSION,
    unlockedLevel: Math.max(save.unlockedLevel, nextLevel),
    currentLevel: nextLevel,
    coins: Math.max(0, save.coins + coinsEarned),
    starsByLevel: {
      ...save.starsByLevel,
      [levelNumber]: Math.max(previousStars, starsEarned),
    },
    completedLevels: {
      ...(save.completedLevels ?? {}),
      [levelNumber]: true,
    },
    rewardedLevels: {
      ...(save.rewardedLevels ?? {}),
      [levelNumber]: true,
    },
  };

  savePlayerData(updatedSave);
  return {
    updatedSave,
    coinsEarned,
    starsEarned,
    isDuplicateCompletion,
  };
}

/**
 * Checks whether the player can activate a given booster via free inventory or paid coins.
 */
export function checkBoosterAvailability(
  save: PlayerSaveData,
  type: BoosterType
): {
  canActivate: boolean;
  source: 'INVENTORY' | 'COINS' | 'NONE';
  coinCost: number;
  inventoryCount: number;
} {
  const inventoryCount = Math.max(0, save.boosters[type] ?? 0);
  const coinCost = BOOSTER_COIN_COSTS[type];
  if (inventoryCount > 0) {
    return {
      canActivate: true,
      source: 'INVENTORY',
      coinCost: 0,
      inventoryCount,
    };
  }
  if (save.coins >= coinCost) {
    return {
      canActivate: true,
      source: 'COINS',
      coinCost,
      inventoryCount: 0,
    };
  }
  return {
    canActivate: false,
    source: 'NONE',
    coinCost,
    inventoryCount: 0,
  };
}

/**
 * Deducts 1 booster from inventory (or deducts its coin cost if inventory is 0).
 * Never produces negative inventory or negative coin balances.
 */
export function consumeBoosterFromSave(
  save: PlayerSaveData,
  type: BoosterType
): {
  success: boolean;
  updatedSave: PlayerSaveData;
  source: 'INVENTORY' | 'COINS' | 'NONE';
  coinsSpent: number;
  reason?: string;
} {
  const availability = checkBoosterAvailability(save, type);
  if (!availability.canActivate) {
    return {
      success: false,
      updatedSave: save,
      source: 'NONE',
      coinsSpent: 0,
      reason: `Need ${BOOSTER_COIN_COSTS[type]} coins or a ${type} booster!`,
    };
  }

  if (availability.source === 'INVENTORY') {
    const updatedSave: PlayerSaveData = {
      ...save,
      boosters: {
        ...save.boosters,
        [type]: Math.max(0, save.boosters[type] - 1),
      },
    };
    savePlayerData(updatedSave);
    return {
      success: true,
      updatedSave,
      source: 'INVENTORY',
      coinsSpent: 0,
    };
  }

  const cost = BOOSTER_COIN_COSTS[type];
  if (save.coins < cost) {
    return {
      success: false,
      updatedSave: save,
      source: 'NONE',
      coinsSpent: 0,
      reason: `Insufficient coins (${save.coins}/${cost})!`,
    };
  }

  const updatedSave: PlayerSaveData = {
    ...save,
    coins: Math.max(0, save.coins - cost),
  };
  savePlayerData(updatedSave);
  return {
    success: true,
    updatedSave,
    source: 'COINS',
    coinsSpent: cost,
  };
}

/**
 * Safely deducts coins (e.g., for unlocking an extra parking bay), guaranteeing no negative balance.
 */
export function spendCoinsFromSave(
  save: PlayerSaveData,
  amount: number
): {
  success: boolean;
  updatedSave: PlayerSaveData;
  coinsSpent: number;
  reason?: string;
} {
  const safeAmount = Math.floor(amount);
  if (safeAmount <= 0) {
    return {
      success: false,
      updatedSave: save,
      coinsSpent: 0,
      reason: 'Invalid coin amount',
    };
  }
  if (save.coins < safeAmount) {
    return {
      success: false,
      updatedSave: save,
      coinsSpent: 0,
      reason: `Need ${safeAmount} coins (have ${save.coins})!`,
    };
  }

  const updatedSave: PlayerSaveData = {
    ...save,
    coins: Math.max(0, save.coins - safeAmount),
  };
  savePlayerData(updatedSave);
  return {
    success: true,
    updatedSave,
    coinsSpent: safeAmount,
  };
}
