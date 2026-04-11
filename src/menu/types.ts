/**
 * Type definitions for menu system
 */

import { Faction } from '../game-core';

export interface MenuOption {
    id: string;
    name: string;
    description: string;
    subLabel?: string;
    subLabelColor?: string;
    icon?: string;
    previewMap?: MapConfig;
}

export interface FactionCarouselOption {
    id: Faction;
    name: string;
    description: string;
    color: string;
}

/** Serialisable sun placement inside a map JSON file. */
export interface MapSunJSON {
    x: number;
    y: number;
    radius: number;
    intensity: number;
    type: 'normal' | 'lad';
    orbitCenterX?: number;
    orbitCenterY?: number;
    orbitRadius?: number;
    orbitSpeed?: number;
    initialOrbitAngleRad?: number;
}

/** Serialisable asteroid placement inside a map JSON file. */
export interface MapAsteroidJSON {
    x: number;
    y: number;
    size: number;
    sides: number;
}

/** Serialisable spawn position inside a map JSON file. */
export interface MapSpawnJSON {
    x: number;
    y: number;
}

/** Full JSON schema for a map file stored in ASSETS/maps/. */
export interface MapJSON {
    id: string;
    name: string;
    description: string;
    playerCount: number;
    mapWidth: number;
    mapHeight: number;
    isLaD: boolean;
    suns: MapSunJSON[];
    spawns: MapSpawnJSON[];
    asteroids: MapAsteroidJSON[];
    randomAsteroidCount: number;
}

export interface MapConfig {
    id: string;
    name: string;
    description: string;
    numSuns: number;
    numAsteroids: number;
    mapSize: number;
    /** Full JSON data when loaded from a map file. */
    json?: MapJSON;
}

export interface HeroUnit {
    id: string;
    name: string;
    description: string;
    faction: Faction;
    // Combat stats
    maxHealth: number;
    attackDamage: number;
    attackSpeed: number; // attacks per second
    attackRange: number;
    attackIgnoresDefense: boolean;
    // Defensive stats
    defense: number; // percentage damage reduction (0-100)
    regen: number; // percentage of health recovered in influence field (0-100)
    // Ability
    abilityDescription: string;
    // Optional sprite path for menu display
    spritePath?: string;
}

export interface BaseLoadout {
    id: string;
    name: string;
    description: string;
    faction: Faction;
}

export interface SpawnLoadout {
    id: string;
    name: string;
    description: string;
    faction: Faction;
}
