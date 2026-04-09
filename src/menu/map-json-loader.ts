/**
 * Map JSON Loader
 * Loads map definitions from JSON files in ASSETS/maps/
 * and converts them into MapConfig objects used by the menu system.
 */

import { MapConfig, MapJSON } from './types';

/** Bundled map filenames – every map shipped with the game lives here. */
const BUILTIN_MAP_FILES: string[] = [
    'standard.json',
    'test-level.json',
    'twin-suns.json',
    'binary-center.json',
    'binary-ring.json',
    'asteroid-field.json',
    'open-space.json',
    '2v2-umbra.json',
    '2v2-dual-umbra.json',
    'lad.json',
];

/**
 * Convert a raw MapJSON object into the MapConfig expected by the menu/game.
 */
export function mapJSONToConfig(json: MapJSON): MapConfig {
    return {
        id: json.id,
        name: json.name,
        description: json.description,
        numSuns: json.suns.length,
        numAsteroids: json.asteroids.length + json.randomAsteroidCount,
        mapSize: Math.max(json.mapWidth, json.mapHeight),
        json,
    };
}

/**
 * Load a single map JSON file from ASSETS/maps/<filename>.
 * Returns null if the file cannot be fetched or parsed.
 */
async function loadMapFile(filename: string): Promise<MapJSON | null> {
    try {
        const response = await fetch(`ASSETS/maps/${filename}`);
        if (!response.ok) {
            return null;
        }
        const data: unknown = await response.json();
        if (!isValidMapJSON(data)) {
            return null;
        }
        return data as MapJSON;
    } catch {
        return null;
    }
}

/**
 * Very lightweight runtime validation for a MapJSON object.
 * Validates top-level fields and basic structure of array elements.
 */
function isValidMapJSON(data: unknown): data is MapJSON {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const obj = data as Record<string, unknown>;
    if (
        typeof obj.id !== 'string' ||
        typeof obj.name !== 'string' ||
        typeof obj.description !== 'string' ||
        typeof obj.playerCount !== 'number' ||
        typeof obj.mapWidth !== 'number' ||
        typeof obj.mapHeight !== 'number' ||
        typeof obj.isLaD !== 'boolean' ||
        !Array.isArray(obj.suns) ||
        !Array.isArray(obj.spawns) ||
        !Array.isArray(obj.asteroids) ||
        typeof obj.randomAsteroidCount !== 'number'
    ) {
        return false;
    }

    // Validate sun entries
    for (const sun of obj.suns) {
        if (typeof sun !== 'object' || sun === null) { return false; }
        const s = sun as Record<string, unknown>;
        if (typeof s.x !== 'number' || typeof s.y !== 'number' ||
            typeof s.radius !== 'number' || typeof s.intensity !== 'number') {
            return false;
        }
    }

    // Validate spawn entries
    for (const spawn of obj.spawns) {
        if (typeof spawn !== 'object' || spawn === null) { return false; }
        const sp = spawn as Record<string, unknown>;
        if (typeof sp.x !== 'number' || typeof sp.y !== 'number') {
            return false;
        }
    }

    // Validate asteroid entries
    for (const asteroid of obj.asteroids) {
        if (typeof asteroid !== 'object' || asteroid === null) { return false; }
        const a = asteroid as Record<string, unknown>;
        if (typeof a.x !== 'number' || typeof a.y !== 'number' ||
            typeof a.size !== 'number' || typeof a.sides !== 'number') {
            return false;
        }
    }

    return true;
}

/**
 * Load all builtin maps from ASSETS/maps/ and return them as MapConfig[].
 * Falls back to an empty array on total failure.
 */
export async function loadBuiltinMaps(): Promise<MapConfig[]> {
    const results = await Promise.all(BUILTIN_MAP_FILES.map(loadMapFile));
    const configs: MapConfig[] = [];
    for (const json of results) {
        if (json) {
            configs.push(mapJSONToConfig(json));
        }
    }
    return configs;
}

/**
 * Convert a user-imported JSON string into a MapConfig.
 * Returns null if the JSON is invalid.
 */
export function importMapFromJSON(jsonString: string): MapConfig | null {
    try {
        const data: unknown = JSON.parse(jsonString);
        if (!isValidMapJSON(data)) {
            return null;
        }
        return mapJSONToConfig(data as MapJSON);
    } catch {
        return null;
    }
}
