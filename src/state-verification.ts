/**
 * State Verification System
 * 
 * Provides state hash exchange and verification for multiplayer games
 * to detect desync issues between clients.
 * 
 * HOW IT WORKS:
 * 1. Each client computes a state hash periodically (every N ticks)
 * 2. Clients exchange their state hashes
 * 3. If hashes don't match, a desync is detected
 * 4. Desync events are logged and can trigger recovery mechanisms
 * 
 * USAGE:
 * ```typescript
 * const verifier = new StateVerifier(transport, localPlayerId, allPlayerIds);
 * verifier.on('desync', (data) => {
 *   console.error('Desync detected!', data);
 *   // Trigger recovery or pause game
 * });
 * 
 * // In game loop:
 * if (tick % VERIFY_INTERVAL === 0) {
 *   verifier.submitHash(tick, gameState.stateHash);
 * }
 * ```
 */

import { ITransport } from './transport';

/**
 * State hash message for exchange between peers
 */
interface StateHashMessage {
    type: 'state_hash';
    tick: number;
    playerId: string;
    hash: number;
}

/**
 * Desync detection event data
 */
export interface DesyncEvent {
    tick: number;
    localHash: number;
    remoteHashes: Map<string, number>;
    mismatchedPlayers: string[];
}

/**
 * State verification event types
 */
export enum StateVerificationEvent {
    DESYNC = 'desync',
    HASH_VERIFIED = 'hash_verified'
}

export type StateVerificationCallback = (data: any) => void;

/**
 * State hash verifier - exchanges and compares state hashes across peers
 */
export class StateVerifier {
    private transport: ITransport;
    private localPlayerId: string;
    private expectedPlayers: Set<string>;
    
    // Hash storage: tick -> playerId -> hash
    private receivedHashes: Map<number, Map<string, number>> = new Map();
    private localHashes: Map<number, number> = new Map();
    
    // Event listeners
    private eventListeners: Map<StateVerificationEvent, StateVerificationCallback[]> = new Map();
    
    // Configuration
    private readonly HASH_TIMEOUT_TICKS = 10; // Wait max 10 ticks for all hashes
    private readonly MAX_STORED_TICKS = 100;  // Keep only last 100 ticks
    
    // Statistics
    private stats = {
        hashesExchanged: 0,
        desyncsDetected: 0,
        lastVerifiedTick: 0
    };

    constructor(transport: ITransport, localPlayerId: string, allPlayerIds: string[]) {
        this.transport = transport;
        this.localPlayerId = localPlayerId;
        this.expectedPlayers = new Set(allPlayerIds);
        
        // Register to receive state hash messages
        // Note: This assumes transport has a way to handle non-command messages
        // For now, we'll piggyback on command system by using a special command type
    }

    /**
     * Submit local state hash for a tick
     * This will broadcast the hash to all other players and check for desyncs
     */
    submitHash(tick: number, hash: number): void {
        // Store local hash
        this.localHashes.set(tick, hash);
        
        // Broadcast hash to all players via transport
        // We use a special command type for state hash exchange
        const message: StateHashMessage = {
            type: 'state_hash',
            tick: tick,
            playerId: this.localPlayerId,
            hash: hash
        };
        
        // Send via transport (as a special "command")
        this.transport.sendCommand({
            tick: tick,
            playerId: this.localPlayerId,
            commandType: '__state_hash__',
            payload: message
        });
        
        this.stats.hashesExchanged++;
        
        // Check if we can verify this tick now
        this.checkTick(tick);
        
        // Cleanup old hashes
        this.cleanupOldHashes(tick);
    }

    /**
     * Receive a state hash from another player
     * Call this when receiving a state hash message from the network
     */
    receiveHash(tick: number, playerId: string, hash: number): void {
        if (!this.receivedHashes.has(tick)) {
            this.receivedHashes.set(tick, new Map());
        }
        
        const tickHashes = this.receivedHashes.get(tick)!;
        tickHashes.set(playerId, hash);
        
        // Check if we can verify this tick now
        this.checkTick(tick);
    }

    /**
     * Check if we have all hashes for a tick and verify them
     */
    private checkTick(tick: number): void {
        const localHash = this.localHashes.get(tick);
        if (localHash === undefined) {
            return; // Don't have local hash yet
        }
        
        const tickHashes = this.receivedHashes.get(tick);
        if (!tickHashes) {
            return; // No remote hashes yet
        }
        
        // Check if we have all player hashes
        const receivedPlayerIds = new Set(tickHashes.keys());
        const missingPlayers = [...this.expectedPlayers]
            .filter(id => id !== this.localPlayerId && !receivedPlayerIds.has(id));
        
        if (missingPlayers.length > 0) {
            // Don't have all hashes yet
            return;
        }
        
        // We have all hashes! Verify them
        this.verifyTick(tick, localHash, tickHashes);
    }

    /**
     * Verify all hashes match for a tick
     */
    private verifyTick(tick: number, localHash: number, remoteHashes: Map<string, number>): void {
        const mismatchedPlayers: string[] = [];
        
        // Compare local hash with each remote hash
        for (const [playerId, remoteHash] of remoteHashes) {
            if (remoteHash !== localHash) {
                mismatchedPlayers.push(playerId);
            }
        }
        
        if (mismatchedPlayers.length > 0) {
            // DESYNC DETECTED!
            console.error(`[StateVerifier] DESYNC detected at tick ${tick}!`);
            console.error(`  Local hash (${this.localPlayerId}): ${localHash}`);
            for (const [playerId, hash] of remoteHashes) {
                console.error(`  Remote hash (${playerId}): ${hash}`);
            }
            
            this.stats.desyncsDetected++;
            
            const event: DesyncEvent = {
                tick: tick,
                localHash: localHash,
                remoteHashes: new Map(remoteHashes),
                mismatchedPlayers: mismatchedPlayers
            };
            
            this.emit(StateVerificationEvent.DESYNC, event);
        } else {
            // All hashes match - verified!
            this.stats.lastVerifiedTick = tick;
            this.emit(StateVerificationEvent.HASH_VERIFIED, { tick, hash: localHash });
        }
    }

    /**
     * Clean up old stored hashes to prevent memory growth
     */
    private cleanupOldHashes(currentTick: number): void {
        const minTick = currentTick - this.MAX_STORED_TICKS;
        
        // Clean up local hashes
        for (const tick of this.localHashes.keys()) {
            if (tick < minTick) {
                this.localHashes.delete(tick);
            }
        }
        
        // Clean up received hashes
        for (const tick of this.receivedHashes.keys()) {
            if (tick < minTick) {
                this.receivedHashes.delete(tick);
            }
        }
    }

    /**
     * Get verification statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Register event listener
     */
    on(event: StateVerificationEvent, callback: StateVerificationCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    /**
     * Unregister event listener
     */
    off(event: StateVerificationEvent, callback: StateVerificationCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     */
    private emit(event: StateVerificationEvent, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[StateVerifier] Error in event listener:', error);
                }
            });
        }
    }
}
