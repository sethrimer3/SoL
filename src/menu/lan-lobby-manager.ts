/**
 * LAN Lobby Manager
 * Manages local area network lobby discovery and lifecycle
 */

const LAN_LOBBY_STORAGE_KEY = 'sol-lan-lobbies';
const LAN_LOBBY_EXPIRY_MS = 15000; // 15 seconds
const LAN_LOBBY_REFRESH_MS = 2000; // 2 seconds
const LAN_LOBBY_HEARTBEAT_MS = 5000; // 5 seconds

export interface LanLobbyEntry {
    hostPlayerId: string;
    lobbyName: string;
    hostUsername: string;
    connectionCode: string;
    maxPlayerCount: number;
    playerCount: number;
    lastSeenMs: number;
    createdMs: number;
}

export class LanLobbyManager {
    private heartbeatTimeout: number | null = null;
    private refreshTimeout: number | null = null;

    /**
     * Load LAN lobby entries from local storage
     */
    loadEntries(): LanLobbyEntry[] {
        const storedValue = localStorage.getItem(LAN_LOBBY_STORAGE_KEY);
        if (!storedValue) {
            return [];
        }
        try {
            const parsedValue = JSON.parse(storedValue) as LanLobbyEntry[];
            if (!Array.isArray(parsedValue)) {
                return [];
            }
            return parsedValue;
        } catch (error) {
            console.warn('Failed to parse LAN lobby list from storage:', error);
            return [];
        }
    }

    /**
     * Persist LAN lobby entries to local storage
     */
    persistEntries(entries: LanLobbyEntry[]): void {
        localStorage.setItem(LAN_LOBBY_STORAGE_KEY, JSON.stringify(entries));
    }

    /**
     * Remove expired lobby entries
     */
    pruneEntries(entries: LanLobbyEntry[], nowMs: number): LanLobbyEntry[] {
        const prunedEntries = entries.filter((entry) => nowMs - entry.lastSeenMs <= LAN_LOBBY_EXPIRY_MS);
        if (prunedEntries.length !== entries.length) {
            this.persistEntries(prunedEntries);
        }
        return prunedEntries;
    }

    /**
     * Register or update a LAN lobby entry
     */
    registerEntry(entry: Omit<LanLobbyEntry, 'lastSeenMs' | 'createdMs'>): void {
        const nowMs = Date.now();
        const entries = this.loadEntries();
        const updatedEntries = entries.filter((existingEntry) => existingEntry.hostPlayerId !== entry.hostPlayerId);
        const existingEntry = entries.find((existingEntry) => existingEntry.hostPlayerId === entry.hostPlayerId);
        updatedEntries.push({
            ...entry,
            createdMs: existingEntry?.createdMs ?? nowMs,
            lastSeenMs: nowMs
        });
        this.persistEntries(updatedEntries);
    }

    /**
     * Remove a LAN lobby entry
     */
    unregisterEntry(hostPlayerId: string): void {
        const entries = this.loadEntries();
        const updatedEntries = entries.filter((entry) => entry.hostPlayerId !== hostPlayerId);
        if (updatedEntries.length !== entries.length) {
            this.persistEntries(updatedEntries);
        }
    }

    /**
     * Start periodic heartbeat to keep lobby alive
     */
    startHeartbeat(entry: Omit<LanLobbyEntry, 'lastSeenMs' | 'createdMs'>): void {
        this.stopHeartbeat();
        const heartbeat = () => {
            this.registerEntry(entry);
            this.heartbeatTimeout = window.setTimeout(heartbeat, LAN_LOBBY_HEARTBEAT_MS);
        };
        heartbeat();
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat(): void {
        if (this.heartbeatTimeout !== null) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    /**
     * Get fresh list of lobbies (pruned and sorted)
     */
    getFreshLobbies(): LanLobbyEntry[] {
        const nowMs = Date.now();
        return this.pruneEntries(this.loadEntries(), nowMs)
            .sort((left, right) => right.lastSeenMs - left.lastSeenMs);
    }

    /**
     * Schedule periodic refresh with callback
     */
    scheduleRefresh(callback: () => void): void {
        this.stopRefresh();
        const refresh = () => {
            callback();
            this.refreshTimeout = window.setTimeout(refresh, LAN_LOBBY_REFRESH_MS);
        };
        this.refreshTimeout = window.setTimeout(refresh, LAN_LOBBY_REFRESH_MS);
    }

    /**
     * Stop scheduled refresh
     */
    stopRefresh(): void {
        if (this.refreshTimeout !== null) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
    }

    /**
     * Clean up all timers
     */
    cleanup(): void {
        this.stopHeartbeat();
        this.stopRefresh();
    }
}
