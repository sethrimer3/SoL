/**
 * Server Relay Transport
 *
 * Fallback ITransport implementation that routes all game commands through a
 * Supabase Realtime broadcast channel instead of WebRTC data channels.
 *
 * Used when:
 *  - `lockstep_enabled` is true in the match settings, OR
 *  - WebRTC P2P fails due to strict NAT / firewall restrictions.
 *
 * ARCHITECTURE:
 *  - Channel topic: `relay:${matchId}`
 *  - Each broadcast carries `{ from: localPlayerId, command: GameCommand }`
 *  - Messages from self are filtered out
 *  - Same command-batching pattern as P2PTransport (BATCH_INTERVAL_MS=16,
 *    MAX_BATCH_SIZE=50) for network efficiency
 *
 * TRADE-OFFS vs P2P:
 *  + Works behind any NAT/firewall
 *  + No WebRTC setup required
 *  - All traffic routed through Supabase (higher latency, server cost)
 *  - Supabase Realtime throughput limits apply
 */

import { ITransport, GameCommand, TransportStats } from './transport';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

/** Supabase broadcast event name for relay messages */
const RELAY_EVENT = 'relay_command';

/**
 * Single command message format broadcast over the relay channel
 */
interface RelayMessage {
    from: string;
    command: GameCommand;
}

/**
 * Batched command message format broadcast over the relay channel
 */
interface RelayBatchMessage {
    from: string;
    commands: GameCommand[];
}

/**
 * ServerRelayTransport — ITransport backed by Supabase Realtime broadcast.
 */
export class ServerRelayTransport implements ITransport {
    private supabase: SupabaseClient;
    private matchId: string;
    private localPlayerId: string;

    // Realtime channel
    private relayChannel: RealtimeChannel | null = null;

    // State
    private ready: boolean = false;

    // Callbacks
    private commandCallback: ((command: GameCommand) => void) | null = null;
    private onReadyCallback: (() => void) | null = null;

    // Command batching (mirrors P2PTransport)
    private commandBatch: GameCommand[] = [];
    private batchTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly BATCH_INTERVAL_MS = 16; // ~60 FPS flush cadence
    private readonly MAX_BATCH_SIZE = 50;    // Flush immediately when full

    // Statistics
    private stats = {
        bytesSent: 0,
        bytesReceived: 0,
        packetsSent: 0,
        packetsReceived: 0
    };

    constructor(
        supabase: SupabaseClient,
        matchId: string,
        localPlayerId: string
    ) {
        this.supabase = supabase;
        this.matchId = matchId;
        this.localPlayerId = localPlayerId;

        console.log('[ServerRelayTransport] Created', { matchId, localPlayerId });
    }

    /**
     * Subscribe to the relay channel and mark transport as ready.
     */
    async initialize(): Promise<void> {
        console.log('[ServerRelayTransport] Initializing relay channel...');

        return new Promise((resolve, reject) => {
            this.relayChannel = this.supabase.channel(`relay:${this.matchId}`);

            this.relayChannel
                .on('broadcast', { event: RELAY_EVENT }, (payload) => {
                    this.handleIncomingMessage(payload.payload as RelayBatchMessage | RelayMessage);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('[ServerRelayTransport] Relay channel ready');
                        this.ready = true;
                        if (this.onReadyCallback) {
                            this.onReadyCallback();
                        }
                        resolve();
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        const err = new Error(`[ServerRelayTransport] Channel subscription failed: ${status}`);
                        console.error(err.message);
                        reject(err);
                    }
                });
        });
    }

    /**
     * Handle an incoming broadcast message.
     * Filters out messages from self and dispatches commands to the callback.
     */
    private handleIncomingMessage(payload: RelayBatchMessage | RelayMessage): void {
        // Ignore messages from self
        if (payload.from === this.localPlayerId) {
            return;
        }

        const commands: GameCommand[] = 'commands' in payload
            ? payload.commands
            : [payload.command];

        for (const cmd of commands) {
            const serialized = JSON.stringify(cmd);
            this.stats.bytesReceived += serialized.length;
            this.stats.packetsReceived++;

            if (this.commandCallback) {
                this.commandCallback(cmd);
            }
        }
    }

    /**
     * ITransport: Send a command to all other players via the relay channel.
     * Uses batching to reduce broadcast calls.
     */
    sendCommand(command: GameCommand): void {
        if (!this.ready || !this.relayChannel) {
            console.warn('[ServerRelayTransport] Cannot send command: not ready');
            return;
        }

        this.commandBatch.push(command);

        if (this.commandBatch.length >= this.MAX_BATCH_SIZE) {
            this.flushCommandBatch();
            return;
        }

        this.batchTimer ??= setTimeout(() => {
                this.flushCommandBatch();
            }, this.BATCH_INTERVAL_MS);
    }

    /**
     * Flush the pending command batch as a single broadcast message.
     */
    private flushCommandBatch(): void {
        if (this.commandBatch.length === 0) return;

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        const message: RelayBatchMessage = {
            from: this.localPlayerId,
            commands: this.commandBatch.splice(0) // move all items out
        };

        const serialized = JSON.stringify(message);
        this.stats.bytesSent += serialized.length;
        this.stats.packetsSent++;

        this.relayChannel!.send({
            type: 'broadcast',
            event: RELAY_EVENT,
            payload: message
        }).catch((err: unknown) => {
            console.error('[ServerRelayTransport] Failed to send batch:', err);
        });
    }

    /**
     * ITransport: Register callback for received commands.
     */
    onCommandReceived(callback: (command: GameCommand) => void): void {
        this.commandCallback = callback;
    }

    /**
     * ITransport: Check if the relay channel is ready.
     */
    isReady(): boolean {
        return this.ready;
    }

    /**
     * Register a callback to be called when the transport is ready.
     */
    onReady(callback: () => void): void {
        this.onReadyCallback = callback;
        if (this.ready) {
            // Already ready — call immediately
            callback();
        }
    }

    /**
     * ITransport: Disconnect and clean up.
     */
    disconnect(): void {
        console.log('[ServerRelayTransport] Disconnecting...');

        this.flushCommandBatch();

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        if (this.relayChannel) {
            this.supabase.removeChannel(this.relayChannel);
            this.relayChannel = null;
        }

        this.ready = false;
    }

    /**
     * ITransport: Return current transport statistics.
     */
    getStats(): TransportStats {
        return {
            connected: this.ready,
            latencyMs: 0, // Supabase relay latency not directly measurable here
            packetsSent: this.stats.packetsSent,
            packetsReceived: this.stats.packetsReceived,
            bytesOut: this.stats.bytesSent,
            bytesIn: this.stats.bytesReceived
        };
    }
}
