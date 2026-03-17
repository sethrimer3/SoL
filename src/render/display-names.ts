/**
 * Display name utilities for game entities
 * Pure functions that map entity types to human-readable display names.
 */

import { Building, GatlingTower, Minigun, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower } from '../game-core';

/**
 * Get display name for a building type
 */
export function getBuildingDisplayName(building: Building): string {
    if (building instanceof GatlingTower) {
        return 'Gatling Tower';
    } else if (building instanceof Minigun) {
        return 'Cannon';
    } else if (building instanceof SpaceDustSwirler) {
        return 'Cyclone';
    } else if (building instanceof SubsidiaryFactory) {
        return 'Foundry';
    } else if (building instanceof StrikerTower) {
        return 'Striker Tower';
    } else if (building instanceof LockOnLaserTower) {
        return 'Lock-on Tower';
    } else if (building instanceof ShieldTower) {
        return 'Shield Tower';
    }
    return 'Building';
}

/**
 * Production unit type → display name mapping.
 * Declared once at module scope to avoid per-call allocation.
 */
const PRODUCTION_NAME_MAP: { [key: string]: string } = {
    'marine': 'Marine',
    'grave': 'Grave',
    'ray': 'Ray',
    'influenceball': 'Influence Ball',
    'turretdeployer': 'Turret Deployer',
    'driller': 'Driller',
    'dagger': 'Dagger',
    'beam': 'Beam',
    'spotlight': 'Spotlight',
    'splendor': 'Splendor',
    'shroud': 'Shroud',
    'solar-mirror': 'Solar Mirror',
    'strafe-upgrade': 'Strafe Upgrade',
    'regen-upgrade': 'Regen Upgrade',
    'attack-upgrade': '+1 ATK',
    'blink-upgrade': 'Blink Upgrade'
};

/**
 * Get display name for a production unit type
 */
export function getProductionDisplayName(unitType: string): string {
    return PRODUCTION_NAME_MAP[unitType.toLowerCase()] || unitType;
}
