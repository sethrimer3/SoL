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

export interface MapConfig {
    id: string;
    name: string;
    description: string;
    numSuns: number;
    numAsteroids: number;
    mapSize: number;
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
