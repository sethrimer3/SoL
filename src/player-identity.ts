/**
 * Player Identity Utility
 * 
 * Manages persistent local player identity without external database or authentication services.
 * Generates an immutable UUID on first launch and reuses it on subsequent launches.
 */

const PLAYER_ID_KEY = 'sol.playerId';
const USERNAME_KEY = 'sol.username';

// In-memory fallback for test/server/SSR environments without localStorage
let inMemoryPlayerId: string | null = null;
let inMemoryUsername: string | null = null;

/**
 * Generate a random UUID safely across environments
 */
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback if crypto.randomUUID is not available
    return 'sol-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a default random username
 */
export function generateDefaultUsername(): string {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    return `Player#${randomNum}`;
}

/**
 * Get or create an immutable persistent player ID.
 * Stored in localStorage under `sol.playerId`.
 */
export function getOrCreatePlayerId(): string {
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(PLAYER_ID_KEY);
            if (stored && stored.trim().length > 0) {
                return stored.trim();
            }
            const newId = generateUUID();
            localStorage.setItem(PLAYER_ID_KEY, newId);
            return newId;
        }
    } catch {
        // LocalStorage access may fail in private browsing or restricted iframes
    }

    if (!inMemoryPlayerId) {
        inMemoryPlayerId = generateUUID();
    }
    return inMemoryPlayerId;
}

/**
 * Get or generate the player's display username.
 */
export function getOrGenerateUsername(): string {
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(USERNAME_KEY);
            if (stored && stored.trim().length > 0) {
                return stored.trim();
            }
            const newUsername = generateDefaultUsername();
            localStorage.setItem(USERNAME_KEY, newUsername);
            return newUsername;
        }
    } catch {
        // Fallback to in-memory
    }

    if (!inMemoryUsername) {
        inMemoryUsername = generateDefaultUsername();
    }
    return inMemoryUsername;
}

/**
 * Save player's display username.
 */
export function setPlayerUsername(username: string): void {
    const sanitized = username.trim().substring(0, 20);
    if (!sanitized) return;

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(USERNAME_KEY, sanitized);
        }
    } catch {
        // Ignore storage errors
    }
    inMemoryUsername = sanitized;
}

/**
 * Clear cached identity (primarily for automated testing)
 */
export function resetLocalIdentity(): void {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PLAYER_ID_KEY);
            localStorage.removeItem(USERNAME_KEY);
        }
    } catch {
        // Ignore
    }
    inMemoryPlayerId = null;
    inMemoryUsername = null;
}
