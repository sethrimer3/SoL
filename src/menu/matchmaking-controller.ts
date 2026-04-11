/**
 * MatchmakingController
 * Manages matchmaking polling intervals and match candidate discovery.
 *
 * Extracted from menu.ts as part of Phase 10 refactoring.
 */

import { Faction } from '../game-core';
import { OnlineNetworkManager } from '../online-network';
import { getPlayerMMRData } from '../replay';
import type { GameSettings } from '../menu';

export interface MatchmakingCallbacks {
    getOnlineNetworkManager: () => OnlineNetworkManager | null;
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
    }

    /**
     * Start 2v2 matchmaking polling.
     * Polls every 5 seconds for matchmaking candidates and starts the game when 4 players are found.
     */
    start2v2Polling(callbacks: MatchmakingCallbacks): void {
        this.isSearching = true;
        const mmrData = getPlayerMMRData();

        // TODO: Replace with Supabase real-time subscriptions for better UX
        console.log('Starting matchmaking search...');

        this.pollInterval = window.setInterval(async () => {
            const onlineNetworkManager = callbacks.getOnlineNetworkManager();
            if (!onlineNetworkManager) {
                return;
            }

            // Check if still in queue
            const inQueue = await onlineNetworkManager.isInMatchmakingQueue();
            if (!inQueue) {
                // No longer in queue, stop polling
                this.stopPolling();
                return;
            }

            // Find potential matches
            const candidates = await onlineNetworkManager.findMatchmakingCandidates(mmrData.mmr2v2);

            if (candidates.length >= 3) {
                // Found enough players for 2v2 (need 3 others + us = 4 total)
                console.log('Match found! Candidates:', candidates);

                // Stop polling
                this.stopPolling();

                // Leave matchmaking queue
                await onlineNetworkManager.leaveMatchmakingQueue();

                // Create balanced teams based on MMR
                const settings = callbacks.getSettings();
                const allPlayers = [
                    { username: callbacks.getUsername(), mmr: mmrData.mmr2v2, faction: settings.selectedFaction || Faction.RADIANT, isLocal: true },
                    ...candidates.slice(0, 3).map((c: { username: string; mmr: number; faction: string }) => ({ username: c.username, mmr: c.mmr, faction: c.faction as Faction, isLocal: false }))
                ];

                // Sort by MMR and alternate teams for balance
                allPlayers.sort((a, b) => b.mmr - a.mmr);

                // Create player configs (highest MMR with lowest, etc.)
                // Ensure we have exactly 4 players
                if (allPlayers.length === 4) {
                    const playerConfigs: Array<[string, Faction, number, 'player' | 'ai', 'easy' | 'normal' | 'hard', boolean]> = [
                        [allPlayers[0].username, allPlayers[0].faction, 0, 'player', 'normal', allPlayers[0].isLocal],
                        [allPlayers[3].username, allPlayers[3].faction, 0, 'player', 'normal', allPlayers[3].isLocal],
                        [allPlayers[1].username, allPlayers[1].faction, 1, 'player', 'normal', allPlayers[1].isLocal],
                        [allPlayers[2].username, allPlayers[2].faction, 1, 'player', 'normal', allPlayers[2].isLocal]
                    ];

                    // Update settings
                    settings.gameMode = '2v2-matchmaking';

                    // Hide menu and start game
                    callbacks.hideMenu();

                    // Dispatch event to start 4-player game
                    const event = new CustomEvent('start4PlayerGame', {
                        detail: {
                            playerConfigs: playerConfigs,
                            settings: settings,
                            roomId: null // No room for matchmaking
                        }
                    });
                    window.dispatchEvent(event);

                    return;
                }
            }
        }, 5000); // Poll every 5 seconds
    }

    /**
     * Start 1v1 matchmaking polling.
     * Polls every 5 seconds for a 1v1 opponent.
     */
    start1v1Polling(callbacks: MatchmakingCallbacks): void {
        this.isSearching = true;
        const mmrData = getPlayerMMRData();

        console.log('Starting 1v1 matchmaking search...');

        this.pollInterval = window.setInterval(async () => {
            const onlineNetworkManager = callbacks.getOnlineNetworkManager();
            if (!onlineNetworkManager) {
                return;
            }

            // Check if still in queue
            const inQueue = await onlineNetworkManager.isInMatchmakingQueue();
            if (!inQueue) {
                this.stopPolling();
                return;
            }

            // Find potential 1v1 match
            const candidates = await onlineNetworkManager.findMatchmakingCandidates(mmrData.mmr, '1v1');

            if (candidates.length >= 1) {
                // Found a 1v1 opponent
                console.log('1v1 match found! Opponent:', candidates[0]);

                // Stop polling
                this.stopPolling();

                // Leave matchmaking queue
                await onlineNetworkManager.leaveMatchmakingQueue();

                // Start a standard 1v1 online game
                const settings = callbacks.getSettings();
                settings.gameMode = 'online';
                callbacks.setOnlineMode('ranked');

                callbacks.hideMenu();
                if (callbacks.onStartCallback) {
                    callbacks.onStartCallback(settings);
                }
            }
        }, 5000); // Poll every 5 seconds
    }
}
