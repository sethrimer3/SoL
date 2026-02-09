/**
 * Replay Manager
 * 
 * Handles recording and playback of match replays using deterministic command recording.
 * Replays are stored as a sequence of player commands with initial game configuration.
 */

import { GameCommand } from './network';
import { Faction } from './game-core';

/**
 * Replay metadata and configuration
 */
export interface ReplayData {
    id: string;
    matchId: string;
    gameSeed: number;
    startTime: Date;
    endTime: Date | null;
    duration: number; // In seconds
    playerCount: number;
    players: ReplayPlayerInfo[];
    mapConfig: any;
    commands: GameCommand[];
    stateHashes: ReplayStateHash[];
    version: string;
}

/**
 * Player information in replay
 */
export interface ReplayPlayerInfo {
    playerId: string;
    playerIndex: number;
    username: string;
    faction: Faction;
    isWinner: boolean;
}

/**
 * State hash checkpoint for verification
 */
export interface ReplayStateHash {
    tick: number;
    hash: number;
    timestamp: number;
}

/**
 * Replay playback state
 */
export enum ReplayPlaybackState {
    STOPPED = 'stopped',
    PLAYING = 'playing',
    PAUSED = 'paused',
    SEEKING = 'seeking',
    ENDED = 'ended'
}

/**
 * Manages replay recording and playback
 */
export class ReplayManager {
    private recordedCommands: GameCommand[] = [];
    private recordedStateHashes: ReplayStateHash[] = [];
    private isRecording: boolean = false;
    private replayData: ReplayData | null = null;
    private playbackState: ReplayPlaybackState = ReplayPlaybackState.STOPPED;
    private currentCommandIndex: number = 0;
    private playbackSpeed: number = 1.0;
    private startTime: Date | null = null;
    private currentTick: number = 0;
    private lastHashCheckTick: number = 0;

    /**
     * Start recording a match
     */
    startRecording(matchId: string, gameSeed: number, players: ReplayPlayerInfo[], mapConfig: any): void {
        this.isRecording = true;
        this.recordedCommands = [];
        this.recordedStateHashes = [];
        this.startTime = new Date();
        
        this.replayData = {
            id: this.generateReplayId(),
            matchId,
            gameSeed,
            startTime: this.startTime,
            endTime: null,
            duration: 0,
            playerCount: players.length,
            players,
            mapConfig,
            commands: [],
            stateHashes: [],
            version: '1.0'
        };
    }

    /**
     * Record a command during match
     */
    recordCommand(command: GameCommand): void {
        if (this.isRecording) {
            this.recordedCommands.push({ ...command });
        }
    }

    /**
     * Record a state hash checkpoint
     */
    recordStateHash(tick: number, hash: number): void {
        if (this.isRecording) {
            this.recordedStateHashes.push({
                tick,
                hash,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Stop recording and finalize replay data
     */
    stopRecording(): ReplayData | null {
        if (!this.isRecording || !this.replayData) {
            return null;
        }

        this.isRecording = false;
        const endTime = new Date();
        
        this.replayData.endTime = endTime;
        this.replayData.duration = (endTime.getTime() - this.replayData.startTime.getTime()) / 1000;
        this.replayData.commands = this.recordedCommands;
        this.replayData.stateHashes = this.recordedStateHashes;

        return this.replayData;
    }

    /**
     * Load replay data for playback
     */
    loadReplay(replayData: ReplayData): void {
        this.replayData = replayData;
        this.currentCommandIndex = 0;
        this.playbackState = ReplayPlaybackState.STOPPED;
    }

    /**
     * Get the next command(s) for the current tick
     */
    getCommandsForTick(tick: number): GameCommand[] {
        if (!this.replayData) {
            return [];
        }

        const commands: GameCommand[] = [];
        while (this.currentCommandIndex < this.replayData.commands.length) {
            const cmd = this.replayData.commands[this.currentCommandIndex];
            if (cmd.tick === tick) {
                commands.push(cmd);
                this.currentCommandIndex++;
            } else if (cmd.tick > tick) {
                break;
            } else {
                // Skip commands from past ticks (shouldn't happen in normal playback)
                this.currentCommandIndex++;
            }
        }
        
        return commands;
    }

    /**
     * Seek to a specific tick in the replay
     */
    seekToTick(targetTick: number): void {
        if (!this.replayData) {
            return;
        }

        // Find the first command at or after the target tick
        this.currentCommandIndex = 0;
        for (let i = 0; i < this.replayData.commands.length; i++) {
            if (this.replayData.commands[i].tick >= targetTick) {
                this.currentCommandIndex = i;
                break;
            }
        }
    }

    /**
     * Get replay metadata
     */
    getReplayData(): ReplayData | null {
        return this.replayData;
    }

    /**
     * Check if currently recording
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Get playback state
     */
    getPlaybackState(): ReplayPlaybackState {
        return this.playbackState;
    }

    /**
     * Set playback state
     */
    setPlaybackState(state: ReplayPlaybackState): void {
        this.playbackState = state;
    }

    /**
     * Get playback speed
     */
    getPlaybackSpeed(): number {
        return this.playbackSpeed;
    }

    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed: number): void {
        this.playbackSpeed = Math.max(0.25, Math.min(4.0, speed));
    }

    /**
     * Check if replay is complete
     */
    isReplayComplete(): boolean {
        if (!this.replayData) {
            return false;
        }
        return this.currentCommandIndex >= this.replayData.commands.length;
    }

    /**
     * Get current command index
     */
    getCurrentCommandIndex(): number {
        return this.currentCommandIndex;
    }

    /**
     * Get total commands
     */
    getTotalCommands(): number {
        return this.replayData ? this.replayData.commands.length : 0;
    }

    /**
     * Get current tick
     */
    getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Set current tick
     */
    setCurrentTick(tick: number): void {
        this.currentTick = tick;
    }

    /**
     * Get playback progress (0-1)
     */
    getProgress(): number {
        if (!this.replayData || this.replayData.commands.length === 0) {
            return 0;
        }
        const lastCommand = this.replayData.commands[this.replayData.commands.length - 1];
        const totalTicks = lastCommand.tick;
        return totalTicks > 0 ? Math.min(1, this.currentTick / totalTicks) : 0;
    }

    /**
     * Get remaining time estimate in seconds
     */
    getRemainingTime(): number {
        if (!this.replayData) {
            return 0;
        }
        const progress = this.getProgress();
        const elapsed = this.currentTick / 30; // Assuming 30 ticks per second
        const total = this.replayData.duration;
        return Math.max(0, total - elapsed);
    }

    /**
     * Verify state hash at current tick
     */
    verifyStateHash(currentTick: number, currentHash: number): boolean {
        if (!this.replayData || this.replayData.stateHashes.length === 0) {
            return true; // No hashes to verify
        }

        // Find the closest state hash for this tick
        const hashCheckpoint = this.replayData.stateHashes.find(h => h.tick === currentTick);
        
        if (hashCheckpoint) {
            this.lastHashCheckTick = currentTick;
            if (hashCheckpoint.hash !== currentHash) {
                console.error(`State hash mismatch at tick ${currentTick}!`, {
                    expected: hashCheckpoint.hash,
                    actual: currentHash
                });
                return false;
            }
        }

        return true;
    }

    /**
     * Reset playback to beginning
     */
    reset(): void {
        this.currentCommandIndex = 0;
        this.currentTick = 0;
        this.playbackState = ReplayPlaybackState.STOPPED;
    }

    /**
     * Generate a unique replay ID
     */
    private generateReplayId(): string {
        return `replay_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Export replay to JSON
     */
    exportToJSON(): string {
        if (!this.replayData) {
            throw new Error('No replay data to export');
        }
        return JSON.stringify(this.replayData, null, 2);
    }

    /**
     * Import replay from JSON
     */
    importFromJSON(json: string): void {
        const data = JSON.parse(json);
        // Convert date strings back to Date objects
        data.startTime = new Date(data.startTime);
        if (data.endTime) {
            data.endTime = new Date(data.endTime);
        }
        this.loadReplay(data);
    }
}

/**
 * Replay storage interface
 */
export interface IReplayStorage {
    /**
     * Save replay data
     */
    saveReplay(replay: ReplayData): Promise<void>;

    /**
     * Load replay by ID
     */
    loadReplay(replayId: string): Promise<ReplayData | null>;

    /**
     * List all replays
     */
    listReplays(): Promise<ReplayData[]>;

    /**
     * Delete replay
     */
    deleteReplay(replayId: string): Promise<void>;
}

/**
 * Local storage implementation of replay storage
 */
export class LocalReplayStorage implements IReplayStorage {
    private readonly STORAGE_KEY = 'sol_replays';

    async saveReplay(replay: ReplayData): Promise<void> {
        const replays = await this.listReplays();
        replays.push(replay);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(replays));
    }

    async loadReplay(replayId: string): Promise<ReplayData | null> {
        const replays = await this.listReplays();
        const replay = replays.find(r => r.id === replayId);
        
        if (!replay) {
            return null;
        }

        // Convert date strings back to Date objects
        replay.startTime = new Date(replay.startTime);
        if (replay.endTime) {
            replay.endTime = new Date(replay.endTime);
        }

        return replay;
    }

    async listReplays(): Promise<ReplayData[]> {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data) {
            return [];
        }
        
        try {
            const replays = JSON.parse(data);
            // Convert date strings to Date objects
            return replays.map((r: any) => ({
                ...r,
                startTime: new Date(r.startTime),
                endTime: r.endTime ? new Date(r.endTime) : null
            }));
        } catch (e) {
            console.error('Failed to parse replays from storage:', e);
            return [];
        }
    }

    async deleteReplay(replayId: string): Promise<void> {
        const replays = await this.listReplays();
        const filtered = replays.filter(r => r.id !== replayId);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
}
