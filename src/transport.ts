/**
 * Transport Abstraction Layer
 * 
 * This module provides a clean interface between game logic and network transport.
 * It allows for easy migration from P2P to server-based relay without changing game code.
 * 
 * DESIGN PRINCIPLES:
 * 1. Game logic sends commands, never game state
 * 2. Commands are tick-based and deterministically ordered
 * 3. Transport can be swapped (P2P → Server Relay) without changing consumers
 * 4. All peers simulate the same commands in the same order
 */

/**
 * Game command structure (as defined in requirements)
 * All gameplay actions are represented as commands with tick timestamps
 */
export interface GameCommand {
    tick: number;           // Which game tick this command applies to
    playerId: string;       // Who issued this command
    commandType: string;    // Type of command (e.g., 'move_unit', 'build', 'attack')
    payload: any;          // Command-specific data (use discriminated union in game code)
    // NOTE: payload is 'any' for flexibility. Game code should use proper types:
    // type MoveCommand = GameCommand & { commandType: 'move_unit', payload: { unitId: number, x: number, y: number } };
}

/**
 * Transport interface - abstracts the underlying network layer
 * Implementations: P2PTransport, ServerRelayTransport (future)
 */
export interface ITransport {
    /**
     * Send a command to other players
     * @param command - The game command to send
     */
    sendCommand(command: GameCommand): void;

    /**
     * Register callback for received commands
     * @param callback - Function to call when command is received
     */
    onCommandReceived(callback: (command: GameCommand) => void): void;

    /**
     * Check if transport is connected and ready
     */
    isReady(): boolean;

    /**
     * Close the transport connection
     */
    disconnect(): void;

    /**
     * Get current network statistics (optional, for debugging)
     */
    getStats?(): TransportStats;
}

/**
 * Optional statistics for monitoring transport health
 */
export interface TransportStats {
    connected: boolean;
    latencyMs: number;
    packetsSent: number;
    packetsReceived: number;
    bytesOut: number;
    bytesIn: number;
}

/**
 * Command queue manager - handles tick-based command buffering and ordering
 * Ensures deterministic execution by running commands in tick order
 * 
 * CRITICAL FOR DETERMINISM:
 * - Commands are queued by tick number
 * - Simulation only advances when all required commands for a tick are present
 * - If commands are missing, timeout policy is applied
 * 
 * OPTIMIZATIONS:
 * - Pre-allocated arrays for command storage
 * - Efficient Map usage with periodic cleanup
 * - Optimized sorting using cached player ID comparisons
 */
export class CommandQueue {
    // Queue of commands by tick number
    private commandsByTick: Map<number, GameCommand[]> = new Map();
    
    // Expected players (must receive command from each per tick)
    private expectedPlayers: Set<string> = new Set();
    
    // Current tick being processed
    private currentTick: number = 0;
    
    // Timeout settings
    private readonly COMMAND_TIMEOUT_TICKS = 5; // Wait up to 5 ticks for missing commands
    private readonly MAX_FUTURE_TICKS = 10;     // Don't buffer commands too far ahead
    
    // Statistics
    private missedCommandsCount = 0;
    private totalCommandsProcessed = 0;
    
    // Optimization: Reusable array for sorting to reduce allocations
    private sortedCommands: GameCommand[] = [];
    
    // Optimization: Cache for player ID comparisons
    private playerIdCache = new Map<string, number>();

    constructor(playerIds: string[]) {
        this.expectedPlayers = new Set(playerIds);
        // Pre-populate player ID cache for faster sorting
        playerIds.forEach((id, index) => {
            this.playerIdCache.set(id, index);
        });
    }

    /**
     * Add a command to the queue
     * @param command - Command to queue
     * @returns true if command was queued, false if rejected (too old/far)
     */
    addCommand(command: GameCommand): boolean {
        // Reject commands for ticks we've already processed
        if (command.tick < this.currentTick) {
            console.warn(`Command for old tick ${command.tick} rejected (current: ${this.currentTick})`);
            return false;
        }

        // Reject commands too far in the future (prevents memory exhaustion)
        if (command.tick > this.currentTick + this.MAX_FUTURE_TICKS) {
            console.warn(`Command for tick ${command.tick} too far ahead (current: ${this.currentTick})`);
            return false;
        }

        // Get or create array for this tick
        let tickCommands = this.commandsByTick.get(command.tick);
        if (!tickCommands) {
            // Pre-allocate array with expected size to reduce reallocations
            tickCommands = [];
            this.commandsByTick.set(command.tick, tickCommands);
        }
        tickCommands.push(command);
        
        return true;
    }

    /**
     * Check if we have all commands for the given tick
     * @param tick - Tick number to check
     */
    hasAllCommandsForTick(tick: number): boolean {
        const commands = this.commandsByTick.get(tick);
        if (!commands) return this.expectedPlayers.size === 0; // No players = no commands needed
        
        const receivedPlayers = new Set(commands.map(cmd => cmd.playerId));
        return this.expectedPlayers.size === receivedPlayers.size &&
               [...this.expectedPlayers].every(id => receivedPlayers.has(id));
    }

    /**
     * Get commands for the next tick if available
     * @returns Commands for next tick, or null if not ready
     * 
     * TIMEOUT POLICY:
     * - If commands are missing and timeout exceeded, returns partial commands
     * - Missing commands are logged and counted
     * - Game continues with available commands (degraded experience)
     */
    getNextTickCommands(): GameCommand[] | null {
        const targetTick = this.currentTick;
        
        // Check if we have all commands
        if (this.hasAllCommandsForTick(targetTick)) {
            return this.consumeTickCommands(targetTick);
        }

        // Check if we should timeout and proceed anyway
        const queuedTicks = Array.from(this.commandsByTick.keys());
        if (queuedTicks.length > 0) {
            const oldestAvailableTick = Math.min(...queuedTicks);
            if (targetTick - oldestAvailableTick >= this.COMMAND_TIMEOUT_TICKS) {
            
                // Timeout - proceed with partial commands
                console.warn(`Command timeout at tick ${targetTick}, proceeding with partial commands`);
                this.missedCommandsCount++;
                return this.consumeTickCommands(targetTick);
            }
        }

        // Not ready yet
        return null;
    }

    /**
     * Consume and remove commands for a specific tick
     * Optimized for performance with cached sorting
     */
    private consumeTickCommands(tick: number): GameCommand[] {
        const commands = this.commandsByTick.get(tick) || [];
        this.commandsByTick.delete(tick);
        this.currentTick = tick + 1;
        this.totalCommandsProcessed += commands.length;
        
        // Optimized sorting: Use cached player ID indices for faster comparison
        if (commands.length > 1) {
            commands.sort((a, b) => {
                const aIndex = this.playerIdCache.get(a.playerId) ?? 999;
                const bIndex = this.playerIdCache.get(b.playerId) ?? 999;
                return aIndex - bIndex;
            });
        }
        
        // Periodic cleanup: Remove old tick data to prevent memory leaks
        if (tick % 100 === 0) {
            this.cleanupOldTicks(tick);
        }
        
        return commands;
    }
    
    /**
     * Clean up old tick data to prevent memory leaks
     */
    private cleanupOldTicks(currentTick: number): void {
        const minTick = currentTick - 10; // Keep only recent ticks
        for (const tick of this.commandsByTick.keys()) {
            if (tick < minTick) {
                this.commandsByTick.delete(tick);
            }
        }
    }

    /**
     * Get current tick number
     */
    getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            currentTick: this.currentTick,
            queuedTicks: this.commandsByTick.size,
            missedCommands: this.missedCommandsCount,
            totalProcessed: this.totalCommandsProcessed,
            expectedPlayers: this.expectedPlayers.size
        };
    }

    /**
     * Clear all queued commands (for cleanup/reset)
     */
    clear(): void {
        this.commandsByTick.clear();
        this.currentTick = 0;
    }

    /**
     * Update expected players (for player join/leave)
     */
    setExpectedPlayers(playerIds: string[]): void {
        this.expectedPlayers = new Set(playerIds);
        // Update player ID cache
        this.playerIdCache.clear();
        playerIds.forEach((id, index) => {
            this.playerIdCache.set(id, index);
        });
    }
}

/**
 * Command validator - centralized validation for all commands
 * Ensures commands are well-formed before processing
 * 
 * OPTIMIZATIONS:
 * - Efficient rate limit tracking with periodic cleanup
 * - Optimized payload size checking
 * 
 * TODO Phase 2: Add cryptographic signatures for anti-cheat
 * TODO Phase 2: Add rate limiting per player
 * TODO Phase 2: Add command hash for verification
 */
export class CommandValidator {
    private readonly MAX_PAYLOAD_SIZE = 1024; // Max payload size in bytes
    private commandCounts = new Map<string, number>(); // Commands per player
    private readonly COMMANDS_PER_TICK_LIMIT = 100; // Rate limit
    private lastCleanupTick = 0;
    private readonly CLEANUP_INTERVAL = 100; // Clean up every 100 ticks

    /**
     * Validate a command before adding to queue
     * @returns true if valid, false if invalid
     */
    validate(command: GameCommand): boolean {
        // Check required fields
        if (typeof command.tick !== 'number' ||
            typeof command.playerId !== 'string' ||
            typeof command.commandType !== 'string') {
            console.error('Invalid command structure:', command);
            return false;
        }

        // Check tick is non-negative
        if (command.tick < 0) {
            console.error('Invalid tick (negative):', command.tick);
            return false;
        }

        // Check payload size (optimized - only stringify if needed for size check)
        if (command.payload) {
            const payloadStr = JSON.stringify(command.payload);
            if (payloadStr.length > this.MAX_PAYLOAD_SIZE) {
                console.error(`Payload too large: ${payloadStr.length} bytes`);
                return false;
            }
        }

        // Rate limiting check
        const key = `${command.playerId}-${command.tick}`;
        const count = this.commandCounts.get(key) || 0;
        if (count >= this.COMMANDS_PER_TICK_LIMIT) {
            console.error(`Rate limit exceeded for player ${command.playerId} at tick ${command.tick}`);
            return false;
        }
        this.commandCounts.set(key, count + 1);

        // Periodic cleanup to prevent memory growth
        if (command.tick - this.lastCleanupTick >= this.CLEANUP_INTERVAL) {
            this.cleanupOldEntries(command.tick);
        }

        return true;
    }

    /**
     * Clean up old rate limit entries
     */
    private cleanupOldEntries(currentTick: number): void {
        const minTick = currentTick - this.CLEANUP_INTERVAL;
        for (const [key] of this.commandCounts) {
            const tickNum = parseInt(key.split('-')[1]);
            if (tickNum < minTick) {
                this.commandCounts.delete(key);
            }
        }
        this.lastCleanupTick = currentTick;
    }

    /**
     * TODO Phase 2: Verify command signature (anti-cheat)
     */
    verifySignature?(command: GameCommand, signature: string): boolean {
        // Future implementation
        return true;
    }

    /**
     * TODO Phase 2: Verify command is legal in current game state
     * @param command - Command to verify
     * @param gameState - Current game state (use proper GameState interface in implementation)
     */
    verifyLegality?(command: GameCommand, gameState: unknown): boolean {
        // Future implementation
        return true;
    }
}
