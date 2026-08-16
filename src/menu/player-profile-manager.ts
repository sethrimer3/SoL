/**
 * Player Profile Manager
 * Manages player username and ID persistence
 */

import { 
    getOrCreatePlayerId as getId, 
    getOrGenerateUsername as getUsername, 
    setPlayerUsername,
    generateDefaultUsername
} from '../player-identity';

export class PlayerProfileManager {
    /**
     * Generate a random username
     */
    generateRandomUsername(): string {
        return generateDefaultUsername();
    }

    /**
     * Get username from localStorage or generate a new one
     */
    getOrGenerateUsername(): string {
        return getUsername();
    }

    /**
     * Get or generate a unique player ID for online play
     */
    getOrGeneratePlayerId(): string {
        return getId();
    }

    /**
     * Save username to localStorage
     */
    saveUsername(username: string): void {
        setPlayerUsername(username);
    }

    /**
     * Validate and sanitize username
     */
    validateUsername(username: string): string {
        const sanitized = username.trim().substring(0, 20);
        if (sanitized.length < 1) {
            return this.generateRandomUsername();
        }
        return sanitized;
    }
}
