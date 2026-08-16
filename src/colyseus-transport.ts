/**
 * Colyseus Transport Layer
 * 
 * Implements ITransport over a Colyseus Room connection.
 * Relays deterministic game commands without exposing Colyseus Room internals
 * to the simulation layer.
 * 
 * ARCHITECTURE:
 *  - Commands flow through Colyseus WebSocket room messages
 *  - High-cadence batching (~16ms flush / max 50 commands) to minimize packet overhead
 *  - Dispatches commands to deterministic CommandQueue
 */

import { Room } from '@colyseus/sdk';
import { ITransport, GameCommand, TransportStats } from './transport';
import { ProtocolMessage } from './shared/multiplayer-protocol';

export class ColyseusTransport implements ITransport {
    private room: Room | null = null;
    private localPlayerId: string;
    private isConnected: boolean = false;

    // Callbacks
    private commandCallback: ((command: GameCommand) => void) | null = null;
    private onReadyCallbacks: (() => void)[] = [];

    // Command batching for network efficiency
    private commandBatch: GameCommand[] = [];
    private batchTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly BATCH_INTERVAL_MS = 16; // ~60 FPS flush
    private readonly MAX_BATCH_SIZE = 50;

    // Network statistics
    private stats: TransportStats = {
        connected: false,
        latencyMs: 0,
        packetsSent: 0,
        packetsReceived: 0,
        bytesOut: 0,
        bytesIn: 0
    };

    constructor(room: Room, localPlayerId: string) {
        this.room = room;
        this.localPlayerId = localPlayerId;
        this.attachRoomHandlers();
    }

    /**
     * Wire Colyseus Room event handlers
     */
    private attachRoomHandlers(): void {
        if (!this.room) return;

        // Mark ready when room connection is established
        this.isConnected = true;
        this.stats.connected = true;

        // Listen for individual command relay
        this.room.onMessage(ProtocolMessage.COMMAND, (command: GameCommand) => {
            if (!command || command.playerId === this.localPlayerId) {
                return; // Ignore echo
            }

            const serialized = JSON.stringify(command);
            this.stats.bytesIn += serialized.length;
            this.stats.packetsReceived++;

            if (this.commandCallback) {
                this.commandCallback(command);
            }
        });

        // Listen for batched command relay
        this.room.onMessage(ProtocolMessage.COMMAND_BATCH, (batch: { from: string; commands: GameCommand[] }) => {
            if (!batch || batch.from === this.localPlayerId || !Array.isArray(batch.commands)) {
                return; // Ignore echo
            }

            for (const cmd of batch.commands) {
                const serialized = JSON.stringify(cmd);
                this.stats.bytesIn += serialized.length;
                this.stats.packetsReceived++;

                if (this.commandCallback) {
                    this.commandCallback(cmd);
                }
            }
        });

        // Room error / close handlers
        this.room.onError((code, message) => {
            console.error(`[ColyseusTransport] Room error ${code}: ${message}`);
        });

        this.room.onLeave((code) => {
            console.log(`[ColyseusTransport] Left room (code: ${code})`);
            this.isConnected = false;
            this.stats.connected = false;
        });

        // Trigger onReady callbacks
        this.onReadyCallbacks.forEach(cb => {
            try { cb(); } catch (err) { console.error('[ColyseusTransport] Error in onReady callback:', err); }
        });
    }

    /**
     * ITransport: Send a command to all other players
     */
    sendCommand(command: GameCommand): void {
        if (!this.isConnected || !this.room) {
            console.warn('[ColyseusTransport] Cannot send command: transport not connected');
            return;
        }

        this.commandBatch.push(command);

        if (this.commandBatch.length >= this.MAX_BATCH_SIZE) {
            this.flushCommandBatch();
            return;
        }

        if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushCommandBatch();
            }, this.BATCH_INTERVAL_MS);
        }
    }

    /**
     * Flush queued command batch to server
     */
    private flushCommandBatch(): void {
        if (this.commandBatch.length === 0 || !this.room) return;

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        const commandsToSend = this.commandBatch.splice(0);

        if (commandsToSend.length === 1) {
            const cmd = commandsToSend[0];
            const serialized = JSON.stringify(cmd);
            this.stats.bytesOut += serialized.length;
            this.stats.packetsSent++;
            this.room.send(ProtocolMessage.COMMAND, cmd);
        } else {
            const batchPayload = {
                from: this.localPlayerId,
                commands: commandsToSend
            };
            const serialized = JSON.stringify(batchPayload);
            this.stats.bytesOut += serialized.length;
            this.stats.packetsSent++;
            this.room.send(ProtocolMessage.COMMAND_BATCH, batchPayload);
        }
    }

    /**
     * ITransport: Register callback for received commands
     */
    onCommandReceived(callback: (command: GameCommand) => void): void {
        this.commandCallback = callback;
    }

    /**
     * ITransport: Check if transport is ready
     */
    isReady(): boolean {
        return this.isConnected && this.room !== null;
    }

    /**
     * Register callback when transport is ready
     */
    onReady(callback: () => void): void {
        if (this.isReady()) {
            callback();
        } else {
            this.onReadyCallbacks.push(callback);
        }
    }

    /**
     * ITransport: Disconnect from room
     */
    disconnect(): void {
        this.flushCommandBatch();

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        if (this.room) {
            try {
                this.room.leave();
            } catch (err) {
                console.warn('[ColyseusTransport] Error leaving room:', err);
            }
            this.room = null;
        }

        this.isConnected = false;
        this.stats.connected = false;
    }

    /**
     * ITransport: Get transport stats
     */
    getStats(): TransportStats {
        return {
            ...this.stats,
            connected: this.isReady()
        };
    }
}
