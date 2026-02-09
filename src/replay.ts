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
}

export interface ReplayPlayerInfo {
    playerId: string;
    playerName: string;
    faction: Faction;
    isLocal: boolean;
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
        mapInfo?: ReplayMetadata['mapInfo']
    ) {
        this.startTime = Date.now();
        this.metadata = {
            version: '1.0',
            timestamp: this.startTime,
            seed: seed,
            duration: 0,
            players: players,
            gameMode: gameMode,
            mapInfo: mapInfo
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
