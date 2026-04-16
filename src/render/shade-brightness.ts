/**
 * Shade brightness utilities – calculates proximity-based brightness boosts
 * for entities near the viewing player's units/structures when in shadow.
 * Extracted from GameRenderer to reduce monolithic file size.
 */

import { Vector2D, Player, GameState } from '../game-core';
import * as Constants from '../constants';
import { adjustColorBrightness } from './color-utilities';

/**
 * Calculate brightness boost for a position in shade based on proximity
 * to the given player's units/structures.
 * Returns a factor from 0 (no boost) to 1 (maximum boost).
 */
export function getShadeBrightnessBoost(position: Vector2D, _game: GameState, player: Player): number {
    if (!player) {
        return 0;
    }

    let minDistance = Infinity;

    // Check distance to player units
    for (const unit of player.units) {
        const distance = unit.position.distanceTo(position);
        if (distance < minDistance) {
            minDistance = distance;
            // Early exit if we're already very close (optimization)
            if (minDistance < 10) {
                return 1.0;
            }
        }
    }

    // Check distance to player forge
    if (player.stellarForge) {
        const distance = player.stellarForge.position.distanceTo(position);
        if (distance < minDistance) {
            minDistance = distance;
            if (minDistance < 10) {
                return 1.0;
            }
        }
    }

    // Check distance to player buildings (mirrors, etc.)
    for (const building of player.buildings) {
        const distance = building.position.distanceTo(position);
        if (distance < minDistance) {
            minDistance = distance;
            if (minDistance < 10) {
                return 1.0;
            }
        }
    }

    // Calculate brightness boost based on distance (smooth falloff)
    if (minDistance >= Constants.SHADE_BRIGHTNESS_RADIUS) {
        return 0;
    }

    // Smooth falloff: 1.0 at distance 0, 0.0 at SHADE_BRIGHTNESS_RADIUS
    const falloff = 1.0 - (minDistance / Constants.SHADE_BRIGHTNESS_RADIUS);
    return falloff * falloff; // Quadratic falloff for smoother transition
}

/**
 * Apply shade brightening effect to a color based on proximity to the
 * viewing player's units.  Only applies the boost if the position is
 * actually in shade.
 */
export function applyShadeBrightening(
    color: string,
    position: Vector2D,
    game: GameState,
    isInShade: boolean,
    viewingPlayer: Player | null
): string {
    if (!isInShade || !viewingPlayer) {
        return color;
    }

    const brightnessBoost = getShadeBrightnessBoost(position, game, viewingPlayer);
    if (brightnessBoost <= 0) {
        return color;
    }

    // Apply brightness boost (1.0 = original, higher = brighter)
    const boostFactor = 1.0 + (Constants.SHADE_BRIGHTNESS_BOOST * brightnessBoost);
    return adjustColorBrightness(color, boostFactor);
}
