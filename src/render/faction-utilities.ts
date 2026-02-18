/**
 * Faction-related utility functions
 * Pure functions for faction colors and identifiers
 */

import { Faction } from '../game-core';

/**
 * Get the primary color for a faction
 * @param faction - The faction to get color for
 * @returns Hex color string for the faction
 */
export function getFactionColor(faction: Faction): string {
    switch (faction) {
        case Faction.RADIANT:
            return '#FFD700'; // Gold
        case Faction.AURUM:
            return '#DAA520'; // Goldenrod
        case Faction.VELARIS:
            return '#9C27B0'; // Purple
        default:
            return '#FFFFFF';
    }
}

/**
 * Get Velaris ancient script grapheme sprite path for a letter
 * @param letter - Single letter character (A-Z)
 * @param graphemeSpritePaths - Array of sprite paths for A-Z
 * @returns Sprite path for the letter, or null if invalid
 */
export function getVelarisGraphemeSpritePath(
    letter: string,
    graphemeSpritePaths: string[]
): string | null {
    if (!letter) {
        return null;
    }
    const upper = letter.toUpperCase();
    const index = upper.charCodeAt(0) - 65; // ASCII 'A' = 65
    if (index < 0 || index >= graphemeSpritePaths.length) {
        return null;
    }
    return graphemeSpritePaths[index];
}
