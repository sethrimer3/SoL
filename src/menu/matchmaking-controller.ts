/**
 * MatchmakingController
 * Manages matchmaking and room search for multiplayer.
 */

import { Faction } from '../game-core';
import { MultiplayerNetworkManager } from '../multiplayer-network';
import type { GameSettings } from '../menu';

export interface MatchmakingCallbacks {
    getMultiplayerNetworkManager: () => MultiplayerNetworkManager | null;
    getSettings: () => GameSettings;
    getUsername: () => string;
    getSelectedFaction: () => Faction | null;
    hideMenu: () => void;
    onStartCallback: ((settings: GameSettings) => void) | null;
    setOnlineMode: (mode: 'ranked' | 'unranked') => void;
}

export class MatchmakingController {
    private pollInterval: number | null = null;
    private isSearching: boolean = false;

    get isMatchmakingSearching(): boolean {
        return this.isSearching;
    }

    set isMatchmakingSearching(value: boolean) {
        this.isSearching = value;
    }

    /**
     * Stop any active matchmaking polling.
     */
    stopPolling(): void {
        if (this.pollInterval !== null) {
            window.clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isSearching = false;
    }

    /**
     * Start 2v2 matchmaking polling.
     */
    start2v2Polling(callbacks: MatchmakingCallbacks): void {
        this.isSearching = true;
        console.log('[MatchmakingController] Starting 2v2 search on Colyseus...');

        this.pollInterval = window.setInterval(async () => {
            const network = callbacks.getMultiplayerNetworkManager();
            if (!network) {
                return;
            }

            try {
                const matches = await network.listMatches();
                const candidate = matches.find(m => m.status === 'open' && (m.players.length < m.maxPlayers));

                if (candidate) {
                    this.stopPolling();
                    await network.joinMatch(candidate.id, callbacks.getUsername());
                }
            } catch (err) {
                console.error('[MatchmakingController] Matchmaking poll error:', err);
            }
        }, 5000);
    }

    /**
     * Start 1v1 matchmaking polling.
     */
    start1v1Polling(callbacks: MatchmakingCallbacks): void {
        this.isSearching = true;
        console.log('[MatchmakingController] Starting 1v1 search on Colyseus...');

        this.pollInterval = window.setInterval(async () => {
            const network = callbacks.getMultiplayerNetworkManager();
            if (!network) {
                return;
            }

            try {
                const matches = await network.listMatches();
                const candidate = matches.find(m => m.status === 'open' && m.maxPlayers === 2 && (m.players.length === 1));

                if (candidate) {
                    this.stopPolling();
                    const joined = await network.joinMatch(candidate.id, callbacks.getUsername());
                    if (joined) {
                        const settings = callbacks.getSettings();
                        settings.gameMode = 'online';
                        callbacks.setOnlineMode('ranked');
                        callbacks.hideMenu();
                        if (callbacks.onStartCallback) {
                            callbacks.onStartCallback(settings);
                        }
                    }
                }
            } catch (err) {
                console.error('[MatchmakingController] 1v1 matchmaking poll error:', err);
            }
        }, 5000);
    }
}
