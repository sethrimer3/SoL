/**
 * Pure utility functions for rendering calculations
 * These functions have no dependencies on renderer state and can be unit tested easily
 */

import { Player } from '../game-core';
import * as Constants from '../constants';

/**
 * Calculate positions for radially distributed buttons around a center point
 * @param buttonCount - Number of buttons to position
 * @returns Array of normalized direction vectors {x, y} for button positions
 */
export function getRadialButtonOffsets(buttonCount: number): Array<{ x: number; y: number }> {
    if (buttonCount <= 0) {
        return [];
    }
    const positions: Array<{ x: number; y: number }> = [];
    const startAngleRad = -Math.PI / 2; // Start at top (12 o'clock position)
    const stepAngleRad = (Math.PI * 2) / buttonCount; // Even distribution around circle

    for (let i = 0; i < buttonCount; i++) {
        const angleRad = startAngleRad + stepAngleRad * i;
        positions.push({ x: Math.cos(angleRad), y: Math.sin(angleRad) });
    }
    return positions;
}

/**
 * Calculate hero unit cost based on player's alive hero count
 * Cost increases with each hero produced (standard RTS scaling)
 * @param player - Player to calculate cost for
 * @returns Cost in energy for next hero unit
 */
export function getHeroUnitCost(player: Player): number {
    const aliveHeroCount = player.units.filter((unit) => unit.isHero).length;
    return Constants.HERO_UNIT_BASE_COST + aliveHeroCount * Constants.HERO_UNIT_COST_INCREMENT;
}

/**
 * Map hero display name to unit type identifier
 * @param heroName - Display name shown in UI
 * @returns Internal unit type string, or null if not recognized
 */
export function getHeroUnitType(heroName: string): string | null {
    switch (heroName) {
        case 'Marine':
        case 'Mothership':
        case 'Grave':
        case 'Ray':
        case 'Dagger':
        case 'Beam':
        case 'Driller':
        case 'Spotlight':
        case 'Splendor':
        case 'Sly':
        case 'Shadow':
        case 'Chrono':
            return heroName;
        case 'Influence Ball':
            return 'InfluenceBall';
        case 'Turret Deployer':
            return 'TurretDeployer';
        default:
            return null;
    }
}
