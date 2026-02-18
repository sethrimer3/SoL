/**
 * Player Profile Manager
 * Manages player username and ID persistence
 */

const USERNAME_STORAGE_KEY = 'sol_username';
const PLAYER_ID_STORAGE_KEY = 'sol_player_id';

export class PlayerProfileManager {
    /**
     * Generate a random username
     */
    generateRandomUsername(): string {
        const randomNumber = Math.floor(Math.random() * 10000);
        return `player#${randomNumber.toString().padStart(4, '0')}`;
    }

    /**
     * Get username from localStorage or generate a new one
     */
    getOrGenerateUsername(): string {
        const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
        if (storedUsername && storedUsername.trim() !== '') {
            return storedUsername;
        }
        const newUsername = this.generateRandomUsername();
        localStorage.setItem(USERNAME_STORAGE_KEY, newUsername);
        return newUsername;
    }

    /**
     * Get or generate a unique player ID for online play
     */
    getOrGeneratePlayerId(): string {
        const storedPlayerId = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
        if (storedPlayerId && storedPlayerId.trim() !== '') {
            return storedPlayerId;
        }
        // Generate a UUID using crypto API if available, otherwise fallback
        let newPlayerId: string;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            newPlayerId = crypto.randomUUID();
        } else {
            // Fallback for older browsers
            newPlayerId = 'player_' + Date.now() + '_' + 
                Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem(PLAYER_ID_STORAGE_KEY, newPlayerId);
        return newPlayerId;
    }

    /**
     * Save username to localStorage
     */
    saveUsername(username: string): void {
        localStorage.setItem(USERNAME_STORAGE_KEY, username);
    }

    /**
     * Validate and sanitize username
     */
    validateUsername(username: string): string {
        // Trim and limit length
        let sanitized = username.trim().substring(0, 20);
        
        // If empty or invalid, generate random username
        if (sanitized.length < 1) {
            return this.generateRandomUsername();
        }
        
        return sanitized;
    }
}
