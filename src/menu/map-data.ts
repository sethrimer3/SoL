/**
 * Map configuration data for the menu system
 */

import { MapConfig, BaseLoadout, SpawnLoadout } from './types';
import { Faction } from '../game-core';

export const AVAILABLE_MAPS: MapConfig[] = [
    {
        id: 'standard',
        name: 'Standard Battle',
        description: 'Classic 1v1 map with a single sun at the center. Balanced gameplay with moderate obstacles.',
        numSuns: 1,
        numAsteroids: 10,
        mapSize: 2000
    },
    {
        id: 'test-level',
        name: 'Test Level',
        description: 'Minimal layout for AI testing with a single sun, mirrored bases, and no asteroids.',
        numSuns: 1,
        numAsteroids: 0,
        mapSize: 2000
    },
    {
        id: 'twin-suns',
        name: 'Twin Suns',
        description: 'Two suns create complex lighting patterns. Control multiple light sources for economic dominance.',
        numSuns: 2,
        numAsteroids: 12,
        mapSize: 2500
    },
    {
        id: 'binary-center',
        name: 'Binary Center',
        description: 'Two suns slowly orbit each other at the center of the map. Dynamic lighting creates shifting tactical opportunities.',
        numSuns: 2,
        numAsteroids: 12,
        mapSize: 2500
    },
    {
        id: 'binary-ring',
        name: 'Binary Ring',
        description: 'Two suns orbit around a dense asteroid field. Players spawn inside the field while suns circle the perimeter.',
        numSuns: 2,
        numAsteroids: 30,
        mapSize: 3500
    },
    {
        id: 'asteroid-field',
        name: 'Asteroid Field',
        description: 'Dense asteroid field creates tactical challenges. Careful mirror placement is crucial.',
        numSuns: 1,
        numAsteroids: 20,
        mapSize: 2000
    },
    {
        id: 'open-space',
        name: 'Open Space',
        description: 'Minimal obstacles in a vast arena. Pure strategic combat with fewer terrain advantages.',
        numSuns: 1,
        numAsteroids: 5,
        mapSize: 3000
    },
    {
        id: '2v2-umbra',
        name: '2v2 Umbra Basin',
        description: 'Dedicated 2v2 arena with one sun. Fixed giant asteroids cast consistent spawn shadows for all four players.',
        numSuns: 1,
        numAsteroids: 4,
        mapSize: 2400
    },
    {
        id: '2v2-dual-umbra',
        name: '2v2 Dual Umbra',
        description: 'Dedicated 2v2 arena with two suns. Symmetric asteroid cover creates consistent shadowed spawn lanes.',
        numSuns: 2,
        numAsteroids: 6,
        mapSize: 2600
    },
    {
        id: 'lad',
        name: 'LaD',
        description: 'Light and Dark - A split battlefield with a dual sun. White light on one side, black "light" on the other. Units are invisible until they cross into enemy territory.',
        numSuns: 1,
        numAsteroids: 8,
        mapSize: 2000
    }
];

export const BASE_LOADOUTS: BaseLoadout[] = [
    // Radiant faction bases
    { id: 'radiant-standard', name: 'Standard Forge', description: 'Balanced base with standard production', faction: Faction.RADIANT },
    // Aurum faction bases
    { id: 'aurum-standard', name: 'Standard Vault', description: 'Balanced base with standard production', faction: Faction.AURUM },
    // Velaris faction bases
    { id: 'velaris-standard', name: 'Standard Temple', description: 'Balanced base with standard production', faction: Faction.VELARIS },
];

export const SPAWN_LOADOUTS: SpawnLoadout[] = [
    // Radiant faction spawns
    { id: 'radiant-standard', name: 'Standard Starlings', description: 'Balanced minions with standard stats', faction: Faction.RADIANT },
    // Aurum faction spawns
    { id: 'aurum-standard', name: 'Standard Drones', description: 'Balanced minions with standard stats', faction: Faction.AURUM },
    // Velaris faction spawns
    { id: 'velaris-standard', name: 'Standard Zealots', description: 'Balanced minions with standard stats', faction: Faction.VELARIS },
];
