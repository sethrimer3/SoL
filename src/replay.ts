/**
 * Match Replay System
 * 
 * Records and plays back game matches using the deterministic command system.
 * 
 * DESIGN:
 * - Record all game commands during gameplay
 * - Store match seed, player info, and command sequence
 * - Replay by recreating game state and processing commands in order
 * - Supports variable playback speed and pausing
 */

import { GameCommand } from './network';
import { GameState, Player, Faction, Vector2D } from './game-core';
import { SeededRandom, setGameRNG } from './seeded-random';

/**
 * Metadata about a replay
 */
export interface ReplayMetadata {
    version: string;           // Replay format version
    timestamp: number;         // Unix timestamp when match started
    seed: number;              // Game seed used for RNG
    duration: number;          // Match duration in seconds
    players: ReplayPlayerInfo[];
    gameMode: string;          // 'singleplayer', 'lan', 'p2p', 'online'
    mapInfo?: {
        forgePositions: Vector2D[];
        mirrorPositions: Vector2D[][];
        suns?: Vector2D[];
    };
    mapName?: string;          // Name of the map played
    matchResult?: MatchResult; // Match outcome and MMR changes
}

export interface ReplayPlayerInfo {
    playerId: string;
    playerName: string;
    faction: Faction;
    isLocal: boolean;
    mmr?: number;              // Player's MMR at match start
    mmrChange?: number;        // MMR change from this match
}

/**
 * Match result information
 */
export interface MatchResult {
    winnerId: string;          // Player ID of the winner
    winnerName: string;        // Player name of the winner
    loserId?: string;          // Player ID of the loser (for 1v1)
    loserName?: string;        // Player name of the loser (for 1v1)
    wasForfeit: boolean;       // Whether match ended in forfeit
}

/**
 * Complete replay data structure
 */
export interface ReplayData {
    metadata: ReplayMetadata;
    commands: GameCommand[];
}

/**
 * Records gameplay commands for later replay
 */
export class ReplayRecorder {
    private commands: GameCommand[] = [];
    private metadata: ReplayMetadata;
    private startTime: number;
    private isRecording: boolean = false;

    constructor(
        seed: number,
        players: ReplayPlayerInfo[],
        gameMode: string = 'singleplayer',
        mapInfo?: ReplayMetadata['mapInfo'],
        mapName?: string
    ) {
        this.startTime = Date.now();
        this.metadata = {
            version: '1.0',
            timestamp: this.startTime,
            seed: seed,
            duration: 0,
            players: players,
            gameMode: gameMode,
            mapInfo: mapInfo,
            mapName: mapName
        };
    }

    /**
     * Start recording commands
     */
    start(): void {
        this.isRecording = true;
        this.startTime = Date.now();
    }

    /**
     * Stop recording and finalize metadata
     */
    stop(): ReplayData {
        this.isRecording = false;
        this.metadata.duration = (Date.now() - this.startTime) / 1000;
        
        return {
            metadata: this.metadata,
            commands: [...this.commands] // Return a copy
        };
    }

    /**
     * Record a command
     */
    recordCommand(command: GameCommand): void {
        if (this.isRecording) {
            this.commands.push({ ...command });
        }
    }

    /**
     * Check if currently recording
     */
    isActive(): boolean {
        return this.isRecording;
    }

    /**
     * Get current command count
     */
    getCommandCount(): number {
        return this.commands.length;
    }
}

/**
 * Playback speed options
 */
export enum ReplaySpeed {
    PAUSE = 0,
    SLOW = 0.5,
    NORMAL = 1.0,
    FAST = 2.0,
    SUPER_FAST = 4.0
}

/**
 * Current playback state
 */
export interface ReplayPlaybackState {
    currentTick: number;
    totalTicks: number;
    isPlaying: boolean;
    speed: ReplaySpeed;
    currentTime: number;  // Current time in seconds
    totalTime: number;    // Total replay time in seconds
}

/**
 * Plays back recorded matches
 */
export class ReplayPlayer {
    private replay: ReplayData;
    private game: GameState | null = null;
    private currentCommandIndex: number = 0;
    private currentTick: number = 0;
    private isPlaying: boolean = false;
    private speed: ReplaySpeed = ReplaySpeed.NORMAL;
    private tickAccumulator: number = 0;
    private readonly TICK_INTERVAL_MS: number = 1000 / 60; // 60 ticks/second

    constructor(replay: ReplayData) {
        this.replay = replay;
    }

    /**
     * Initialize game state from replay metadata
     */
    initializeGame(): GameState {
        const game = new GameState();
        
        // Set up seeded RNG with replay seed
        setGameRNG(new SeededRandom(this.replay.metadata.seed));
        
        // Disable countdown for replay
        game.isCountdownActive = false;
        game.countdownTime = 0;
        
        // Create players from metadata
        for (let i = 0; i < this.replay.metadata.players.length; i++) {
            const playerInfo = this.replay.metadata.players[i];
            const player = new Player(playerInfo.playerName, playerInfo.faction);
            game.players.push(player);
            
            // Player constructor sets initial energy to 100.0
            // No need to override unless replay metadata stores custom starting energy
        }

        // Initialize player positions if available
        if (this.replay.metadata.mapInfo) {
            const mapInfo = this.replay.metadata.mapInfo;
            for (let i = 0; i < game.players.length; i++) {
                const forgePos = mapInfo.forgePositions[i];
                const mirrorPos = mapInfo.mirrorPositions[i] || [];
                game.initializePlayer(game.players[i], forgePos, mirrorPos);
            }
        }

        this.game = game;
        return game;
    }

    /**
     * Start or resume playback
     */
    play(): void {
        if (!this.game) {
            this.initializeGame();
        }
        this.isPlaying = true;
    }

    /**
     * Pause playback
     */
    pause(): void {
        this.isPlaying = false;
    }

    /**
     * Set playback speed
     */
    setSpeed(speed: ReplaySpeed): void {
        this.speed = speed;
        if (speed === ReplaySpeed.PAUSE) {
            this.pause();
        } else if (!this.isPlaying) {
            this.play();
        }
    }

    /**
     * Seek to specific tick (limited support - can only seek forward)
     */
    seekToTick(targetTick: number): void {
        if (!this.game) {
            this.initializeGame();
        }

        // Can only seek forward in current implementation
        while (this.currentTick < targetTick && this.currentCommandIndex < this.replay.commands.length) {
            this.processNextCommands();
            this.game!.update(1 / 60);
            this.currentTick++;
        }
    }

    /**
     * Process commands for the current tick
     */
    private processNextCommands(): void {
        if (!this.game) return;

        // Process all commands for current tick
        while (
            this.currentCommandIndex < this.replay.commands.length &&
            this.replay.commands[this.currentCommandIndex].tick === this.currentTick
        ) {
            const command = this.replay.commands[this.currentCommandIndex];
            this.game.receiveNetworkCommand(command);
            this.currentCommandIndex++;
        }

        this.game.processPendingNetworkCommands();
    }

    /**
     * Update replay playback (call this from game loop)
     * @param deltaTimeMs - Time elapsed since last update in milliseconds
     */
    update(deltaTimeMs: number): void {
        if (!this.isPlaying || !this.game || this.speed === ReplaySpeed.PAUSE) {
            return;
        }

        // Apply speed multiplier
        const adjustedDelta = deltaTimeMs * this.speed;
        this.tickAccumulator += adjustedDelta;

        // Process ticks
        while (this.tickAccumulator >= this.TICK_INTERVAL_MS) {
            this.processNextCommands();
            this.game.update(1 / 60);
            this.currentTick++;
            this.tickAccumulator -= this.TICK_INTERVAL_MS;

            // Stop at end of replay
            if (this.currentCommandIndex >= this.replay.commands.length && 
                this.currentTick >= this.getMaxTick()) {
                this.isPlaying = false;
                break;
            }
        }
    }

    /**
     * Get maximum tick number in replay
     */
    private getMaxTick(): number {
        if (this.replay.commands.length === 0) {
            return 0;
        }
        return this.replay.commands[this.replay.commands.length - 1].tick;
    }

    /**
     * Get current playback state
     */
    getState(): ReplayPlaybackState {
        const maxTick = this.getMaxTick();
        const ticksPerSecond = 60;
        
        return {
            currentTick: this.currentTick,
            totalTicks: maxTick,
            isPlaying: this.isPlaying,
            speed: this.speed,
            currentTime: this.currentTick / ticksPerSecond,
            totalTime: maxTick / ticksPerSecond
        };
    }

    /**
     * Get the game state (for rendering)
     */
    getGame(): GameState | null {
        return this.game;
    }

    /**
     * Check if replay has ended
     */
    isEnded(): boolean {
        return this.currentCommandIndex >= this.replay.commands.length && 
               this.currentTick >= this.getMaxTick();
    }

    /**
     * Reset replay to beginning
     */
    reset(): void {
        this.currentCommandIndex = 0;
        this.currentTick = 0;
        this.tickAccumulator = 0;
        this.isPlaying = false;
        this.game = null;
    }
}

/**
 * Save replay data to JSON string
 */
export function serializeReplay(replay: ReplayData): string {
    return JSON.stringify(replay, null, 2);
}

/**
 * Load replay data from JSON string
 */
export function deserializeReplay(json: string): ReplayData {
    return JSON.parse(json);
}

/**
 * Save replay to browser's local storage
 */
export function saveReplayToStorage(replay: ReplayData, name: string): void {
    const key = `sol_replay_${name}`;
    localStorage.setItem(key, serializeReplay(replay));
}

/**
 * Load replay from browser's local storage
 */
export function loadReplayFromStorage(name: string): ReplayData | null {
    const key = `sol_replay_${name}`;
    const data = localStorage.getItem(key);
    if (!data) {
        return null;
    }
    return deserializeReplay(data);
}

/**
 * List all replays in local storage
 */
export function listReplaysInStorage(): string[] {
    const replays: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sol_replay_')) {
            replays.push(key.substring('sol_replay_'.length));
        }
    }
    return replays;
}

/**
 * Delete replay from local storage
 */
export function deleteReplayFromStorage(name: string): void {
    const key = `sol_replay_${name}`;
    localStorage.removeItem(key);
}

/**
 * Download replay as a file
 */
export function downloadReplay(replay: ReplayData, filename: string): void {
    const json = serializeReplay(replay);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Upload/load replay from file
 */
export function uploadReplay(file: File): Promise<ReplayData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                const replay = deserializeReplay(json);
                resolve(replay);
            } catch (error) {
                reject(new Error('Invalid replay file format'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Match History Entry
 * Represents a single match in the player's history
 */
export interface MatchHistoryEntry {
    id: string;                    // Unique match ID (timestamp-based)
    timestamp: number;             // When the match was played
    replayKey: string;             // Key to retrieve replay from storage
    localPlayerName: string;       // Local player's name
    localPlayerFaction: Faction;   // Local player's faction
    opponentName: string;          // Opponent's name
    opponentFaction: Faction;      // Opponent's faction
    mapName: string;               // Map that was played
    gameMode: string;              // Game mode (singleplayer, lan, p2p, online)
    isVictory: boolean;            // Whether local player won
    duration: number;              // Match duration in seconds
    localPlayerMMR: number;        // Local player's MMR before match
    opponentMMR?: number;          // Opponent's MMR before match (if available)
    mmrChange: number;             // MMR change for local player
}

/**
 * Player MMR data
 */
export interface PlayerMMRData {
    mmr: number;                   // Current MMR rating for 1v1
    mmr2v2: number;                // Current MMR rating for 2v2
    wins: number;                  // Total 1v1 wins
    losses: number;                // Total 1v1 losses
    gamesPlayed: number;           // Total 1v1 games played
    wins2v2: number;               // Total 2v2 wins
    losses2v2: number;             // Total 2v2 losses
    gamesPlayed2v2: number;        // Total 2v2 games played
}

/**
 * Calculate MMR change using Elo rating system
 * @param playerMMR - Current player MMR
 * @param opponentMMR - Opponent's MMR
 * @param isWin - Whether player won
 * @param kFactor - K-factor (rating volatility, default 32)
 * @returns MMR change (positive for win, negative for loss)
 */
export function calculateMMRChange(
    playerMMR: number,
    opponentMMR: number,
    isWin: boolean,
    kFactor: number = 32
): number {
    // Calculate expected score using Elo formula
    // The constants 10 and 400 are standard Elo rating system values:
    // - 10 is the base for the power calculation
    // - 400 is the rating difference that corresponds to a 10:1 odds ratio
    const expectedScore = 1 / (1 + Math.pow(10, (opponentMMR - playerMMR) / 400));
    
    // Actual score: 1 for win, 0 for loss
    const actualScore = isWin ? 1 : 0;
    
    // Calculate MMR change
    const mmrChange = Math.round(kFactor * (actualScore - expectedScore));
    
    return mmrChange;
}

/**
 * Get or initialize player MMR data from localStorage
 */
export function getPlayerMMRData(): PlayerMMRData {
    const key = 'sol_player_mmr';
    const data = localStorage.getItem(key);
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            // Migrate old data format to new format with 2v2 support
            return {
                mmr: parsed.mmr ?? 1000,
                mmr2v2: parsed.mmr2v2 ?? 1000,
                wins: parsed.wins ?? 0,
                losses: parsed.losses ?? 0,
                gamesPlayed: parsed.gamesPlayed ?? 0,
                wins2v2: parsed.wins2v2 ?? 0,
                losses2v2: parsed.losses2v2 ?? 0,
                gamesPlayed2v2: parsed.gamesPlayed2v2 ?? 0
            };
        } catch {
            // Corrupted data, return default
        }
    }
    
    // Default starting MMR
    return {
        mmr: 1000,
        mmr2v2: 1000,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        wins2v2: 0,
        losses2v2: 0,
        gamesPlayed2v2: 0
    };
}

/**
 * Save player MMR data to localStorage
 */
export function savePlayerMMRData(data: PlayerMMRData): void {
    const key = 'sol_player_mmr';
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Update player MMR after a match
 */
export function updatePlayerMMR(opponentMMR: number, isWin: boolean): { newMMR: number; mmrChange: number } {
    const mmrData = getPlayerMMRData();
    const mmrChange = calculateMMRChange(mmrData.mmr, opponentMMR, isWin);
    
    mmrData.mmr += mmrChange;
    mmrData.gamesPlayed++;
    if (isWin) {
        mmrData.wins++;
    } else {
        mmrData.losses++;
    }
    
    savePlayerMMRData(mmrData);
    
    return {
        newMMR: mmrData.mmr,
        mmrChange: mmrChange
    };
}

/**
 * Update player 2v2 MMR after a team match
 * 
 * Each player's MMR is updated individually based on their current rating
 * vs the enemy team's average rating. Call this function once for each player
 * on both teams after the match concludes.
 * 
 * Example: In a 2v2 match:
 * - Team A wins: Player1 (1000 MMR) and Player2 (1200 MMR)
 * - Team B loses: Player3 (1100 MMR) and Player4 (1000 MMR)
 * - Enemy average = 1050
 * - Call updatePlayer2v2MMR(1050, true) for Player1 and Player2
 * - Call updatePlayer2v2MMR(1100, false) for Player3 and Player4
 * 
 * @param enemyTeamMMR - Average MMR of the enemy team
 * @param isWin - Whether the player's team won
 * @returns Object with new MMR and change amount for this player
 */
export function updatePlayer2v2MMR(enemyTeamMMR: number, isWin: boolean): { newMMR: number; mmrChange: number } {
    const mmrData = getPlayerMMRData();
    const mmrChange = calculateMMRChange(mmrData.mmr2v2, enemyTeamMMR, isWin);
    
    mmrData.mmr2v2 += mmrChange;
    mmrData.gamesPlayed2v2++;
    if (isWin) {
        mmrData.wins2v2++;
    } else {
        mmrData.losses2v2++;
    }
    
    savePlayerMMRData(mmrData);
    
    return {
        newMMR: mmrData.mmr2v2,
        mmrChange: mmrChange
    };
}

/**
 * Save match to history
 */
export function saveMatchToHistory(entry: MatchHistoryEntry): void {
    const history = getMatchHistory();
    history.unshift(entry); // Add to beginning
    
    // Keep only last 100 matches
    const maxMatches = 100;
    if (history.length > maxMatches) {
        history.splice(maxMatches);
    }
    
    const key = 'sol_match_history';
    localStorage.setItem(key, JSON.stringify(history));
}

/**
 * Get match history from localStorage
 */
export function getMatchHistory(): MatchHistoryEntry[] {
    const key = 'sol_match_history';
    const data = localStorage.getItem(key);
    
    if (data) {
        try {
            return JSON.parse(data);
        } catch {
            return [];
        }
    }
    
    return [];
}

/**
 * Clear all match history
 */
export function clearMatchHistory(): void {
    const key = 'sol_match_history';
    localStorage.removeItem(key);
}

/**
 * Delete a specific match from history
 */
export function deleteMatchFromHistory(matchId: string): void {
    const history = getMatchHistory();
    const filtered = history.filter(m => m.id !== matchId);
    const key = 'sol_match_history';
    localStorage.setItem(key, JSON.stringify(filtered));
}
