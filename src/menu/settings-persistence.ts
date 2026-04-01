/**
 * Settings Persistence Manager
 * Saves and loads player settings to/from localStorage
 */

const SETTINGS_STORAGE_KEY = 'sol_settings';

/** The subset of GameSettings that are persisted across sessions. */
export interface PersistedSettings {
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
    soundVolume: number;
    musicVolume: number;
    isBattleStatsInfoEnabled: boolean;
    screenShakeEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    allyColor: string;
    enemy2Color: string;
    colorScheme: string;
    damageDisplayMode: 'damage' | 'remaining-life';
    healthDisplayMode: 'bar' | 'number';
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isExperimentalGraphicsEnabled: boolean;
    isStarNestEnabled: boolean;
    isAdaptiveQualityEnabled: boolean;
    useSvgSprites: boolean;
    isPauseOnFocusLossEnabled: boolean;
    resolution: string;
    isPixelModeEnabled: boolean;
}

const VALID_GRAPHICS_QUALITIES: ReadonlyArray<string> = ['low', 'medium', 'high', 'ultra'];
const VALID_DIFFICULTIES: ReadonlyArray<string> = ['easy', 'normal', 'hard'];
const VALID_DAMAGE_MODES: ReadonlyArray<string> = ['damage', 'remaining-life'];
const VALID_HEALTH_MODES: ReadonlyArray<string> = ['bar', 'number'];
const VALID_RESOLUTIONS: ReadonlyArray<string> = [
    'native',
    '640x360',
    '960x540',
    '1280x720',
    '1600x900',
    '1920x1080',
    '2560x1440',
    '3840x2160',
];

/**
 * Load persisted settings from localStorage.
 * Returns null if no saved settings exist or the stored data is invalid.
 */
export function loadPersistedSettings(): Partial<PersistedSettings> | null {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }
        return validatePersistedSettings(parsed as Record<string, unknown>);
    } catch {
        return null;
    }
}

/**
 * Save the given settings to localStorage.
 */
export function savePersistedSettings(settings: PersistedSettings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Silently ignore storage quota errors
    }
}

/**
 * Extract the persistable subset from a full settings object.
 * Accepts any object that has at least the PersistedSettings fields.
 */
export function extractPersistedSettings(settings: PersistedSettings): PersistedSettings {
    return {
        difficulty: settings.difficulty,
        soundEnabled: settings.soundEnabled,
        musicEnabled: settings.musicEnabled,
        soundVolume: settings.soundVolume,
        musicVolume: settings.musicVolume,
        isBattleStatsInfoEnabled: settings.isBattleStatsInfoEnabled,
        screenShakeEnabled: settings.screenShakeEnabled,
        playerColor: settings.playerColor,
        enemyColor: settings.enemyColor,
        allyColor: settings.allyColor,
        enemy2Color: settings.enemy2Color,
        colorScheme: settings.colorScheme,
        damageDisplayMode: settings.damageDisplayMode,
        healthDisplayMode: settings.healthDisplayMode,
        graphicsQuality: settings.graphicsQuality,
        isExperimentalGraphicsEnabled: settings.isExperimentalGraphicsEnabled,
        isStarNestEnabled: settings.isStarNestEnabled,
        isAdaptiveQualityEnabled: settings.isAdaptiveQualityEnabled,
        useSvgSprites: settings.useSvgSprites,
        isPauseOnFocusLossEnabled: settings.isPauseOnFocusLossEnabled,
        resolution: settings.resolution,
        isPixelModeEnabled: settings.isPixelModeEnabled,
    };
}

/**
 * Check whether previously saved settings exist in localStorage.
 */
export function hasSavedSettings(): boolean {
    return localStorage.getItem(SETTINGS_STORAGE_KEY) !== null;
}

/**
 * Validate parsed settings, returning only the fields that pass validation.
 */
function validatePersistedSettings(data: Record<string, unknown>): Partial<PersistedSettings> {
    const result: Partial<PersistedSettings> = {};

    if (typeof data.difficulty === 'string' && VALID_DIFFICULTIES.indexOf(data.difficulty) !== -1) {
        result.difficulty = data.difficulty as PersistedSettings['difficulty'];
    }
    if (typeof data.soundEnabled === 'boolean') {
        result.soundEnabled = data.soundEnabled;
    }
    if (typeof data.musicEnabled === 'boolean') {
        result.musicEnabled = data.musicEnabled;
    }
    if (typeof data.soundVolume === 'number' && data.soundVolume >= 0 && data.soundVolume <= 100) {
        result.soundVolume = data.soundVolume;
    }
    if (typeof data.musicVolume === 'number' && data.musicVolume >= 0 && data.musicVolume <= 100) {
        result.musicVolume = data.musicVolume;
    }
    if (typeof data.isBattleStatsInfoEnabled === 'boolean') {
        result.isBattleStatsInfoEnabled = data.isBattleStatsInfoEnabled;
    }
    if (typeof data.screenShakeEnabled === 'boolean') {
        result.screenShakeEnabled = data.screenShakeEnabled;
    }
    if (typeof data.playerColor === 'string') {
        result.playerColor = data.playerColor;
    }
    if (typeof data.enemyColor === 'string') {
        result.enemyColor = data.enemyColor;
    }
    if (typeof data.allyColor === 'string') {
        result.allyColor = data.allyColor;
    }
    if (typeof data.enemy2Color === 'string') {
        result.enemy2Color = data.enemy2Color;
    }
    if (typeof data.colorScheme === 'string') {
        result.colorScheme = data.colorScheme;
    }
    if (typeof data.damageDisplayMode === 'string' && VALID_DAMAGE_MODES.indexOf(data.damageDisplayMode) !== -1) {
        result.damageDisplayMode = data.damageDisplayMode as PersistedSettings['damageDisplayMode'];
    }
    if (typeof data.healthDisplayMode === 'string' && VALID_HEALTH_MODES.indexOf(data.healthDisplayMode) !== -1) {
        result.healthDisplayMode = data.healthDisplayMode as PersistedSettings['healthDisplayMode'];
    }
    if (typeof data.graphicsQuality === 'string' && VALID_GRAPHICS_QUALITIES.indexOf(data.graphicsQuality) !== -1) {
        result.graphicsQuality = data.graphicsQuality as PersistedSettings['graphicsQuality'];
    }
    if (typeof data.isExperimentalGraphicsEnabled === 'boolean') {
        result.isExperimentalGraphicsEnabled = data.isExperimentalGraphicsEnabled;
    }
    if (typeof data.isStarNestEnabled === 'boolean') {
        result.isStarNestEnabled = data.isStarNestEnabled;
    }
    if (typeof data.isAdaptiveQualityEnabled === 'boolean') {
        result.isAdaptiveQualityEnabled = data.isAdaptiveQualityEnabled;
    }
    if (typeof data.useSvgSprites === 'boolean') {
        result.useSvgSprites = data.useSvgSprites;
    }
    if (typeof data.isPauseOnFocusLossEnabled === 'boolean') {
        result.isPauseOnFocusLossEnabled = data.isPauseOnFocusLossEnabled;
    }
    if (typeof data.resolution === 'string' && VALID_RESOLUTIONS.indexOf(data.resolution) !== -1) {
        result.resolution = data.resolution;
    }
    if (typeof data.isPixelModeEnabled === 'boolean') {
        result.isPixelModeEnabled = data.isPixelModeEnabled;
    }

    return result;
}
