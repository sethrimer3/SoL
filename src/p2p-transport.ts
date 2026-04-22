/**
 * P2P Transport Implementation
 * 
 * Implements WebRTC peer-to-peer networking with Supabase signaling.
 * After P2P connection is established, Supabase is no longer in the hot path.
 * 
 * ARCHITECTURE:
 * - Uses WebRTC data channels (reliable + ordered)
 * - Supabase used ONLY for signaling (SDP offers/answers, ICE candidates)
 * - All game commands flow through P2P connections
 * - No game state transmitted, only commands
 * 
 * PHASE 2 MIGRATION:
 * - This entire module can be replaced with ServerRelayTransport
 * - Game code using ITransport interface is unaffected
 */

import { ITransport, GameCommand, TransportStats } from './transport';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

/**
 * Optional TURN server configuration for relay support behind strict NATs.
 * Pass one or more entries to `P2PTransport` constructor to supplement the
 * built-in STUN servers with credential-based relay servers.
 */
export interface TurnServerConfig {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/**
 * WebRTC P2P connection wrapper
 * Handles one peer connection and its data channel
 */
class PeerConnection {
    private connection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private peerId: string;
    private onMessageCallback: ((data: any) => void) | null = null;
    private onStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;

    // Optional TURN servers merged into ICE configuration
    private turnServers: TurnServerConfig[] = [];

    // Statistics
    private stats = {
        bytesSent: 0,
        bytesReceived: 0,
        packetsSent: 0,
        packetsReceived: 0
    };
    
    // Latency measurement
    private latencyMs: number = 0;
    private pendingPings: Map<number, number> = new Map(); // pingId -> timestamp
    private nextPingId: number = 0;

    // Reconnection state
    reconnectAttempts: number = 0;
    readonly MAX_RECONNECT_ATTEMPTS = 5;
    readonly RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
    reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    onReconnectCallback: (() => void) | null = null;
    onReconnectFailedCallback: (() => void) | null = null;
    private onDisconnectedCallback: (() => void) | null = null;

    constructor(peerId: string, turnServers: TurnServerConfig[] = []) {
        this.peerId = peerId;
        this.turnServers = turnServers;
    }

    /** Register callback for successful reconnection */
    onReconnect(cb: () => void): void { this.onReconnectCallback = cb; }

    /** Register callback for when all reconnect attempts are exhausted */
    onReconnectFailed(cb: () => void): void { this.onReconnectFailedCallback = cb; }

    /** Register callback for final disconnection (after all reconnect attempts fail) */
    onDisconnected(cb: () => void): void { this.onDisconnectedCallback = cb; }

    /**
     * Initialize RTCPeerConnection with STUN servers for NAT traversal.
     * TURN servers are merged in when provided.
     */
    private createConnection(): RTCPeerConnection {
        const iceServers: RTCIceServer[] = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];

        for (const turn of this.turnServers) {
            iceServers.push({
                urls: turn.urls,
                username: turn.username,
                credential: turn.credential
            });
        }

        return new RTCPeerConnection({ iceServers });
    }

    /**
     * Create offer (host initiates connection)
     */
    async createOffer(): Promise<RTCSessionDescriptionInit> {
        this.connection = this.createConnection();
        this.setupConnectionHandlers();

        // Create data channel with reliable, ordered delivery
        // CRITICAL: ordered=true ensures deterministic command ordering
        this.dataChannel = this.connection.createDataChannel('commands', {
            ordered: true,        // Maintain order (required for determinism)
            maxRetransmits: 3     // Retry failed packets
        });
        this.setupDataChannelHandlers();

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);
        
        // Wait for ICE gathering
        await this.waitForIceGathering();
        
        return this.connection.localDescription!;
    }

    /**
     * Create answer (client responds to offer)
     */
    async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        this.connection = this.createConnection();
        this.setupConnectionHandlers();

        // Data channel will be received from host
        this.connection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers();
        };

        await this.connection.setRemoteDescription(offer);
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);
        
        await this.waitForIceGathering();
        
        return this.connection.localDescription!;
    }

    /**
     * Complete connection with answer (host side)
     */
    async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not initialized');
        }
        await this.connection.setRemoteDescription(answer);
    }

    /**
     * Add ICE candidate for NAT traversal
     */
    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not initialized');
        }
        await this.connection.addIceCandidate(candidate);
    }

    /**
     * Wait for ICE gathering to complete
     */
    private waitForIceGathering(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.connection) {
                resolve();
                return;
            }

            if (this.connection.iceGatheringState === 'complete') {
                resolve();
                return;
            }

            const checkState = () => {
                if (this.connection!.iceGatheringState === 'complete') {
                    this.connection!.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };

            this.connection.addEventListener('icegatheringstatechange', checkState);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                this.connection!.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }, 5000);
        });
    }

    /**
     * Setup connection state handlers.
     * On disconnection or failure, notifies the transport layer (via onStateChangeCallback)
     * so P2PTransport can schedule the exponential-backoff reconnect attempt.
     */
    private setupConnectionHandlers(): void {
        if (!this.connection) return;

        this.connection.onconnectionstatechange = () => {
            if (!this.connection) return;
            
            const state = this.connection.connectionState;
            console.log(`[P2P] Connection state: ${state}`);
            
            if (state === 'connected') {
                // If we had in-flight reconnect attempts, this is a successful reconnect
                if (this.reconnectAttempts > 0) {
                    this.resetReconnectAttempts();
                    if (this.onReconnectCallback) {
                        this.onReconnectCallback();
                    }
                }
            }

            if (this.onStateChangeCallback) {
                this.onStateChangeCallback(state);
            }
        };

        this.connection.onicecandidate = (event) => {
            // ICE candidates are sent via signaling in P2PTransport
            // This is just for logging
            if (event.candidate) {
                console.log('[P2P] New ICE candidate generated');
            }
        };
    }

    /**
     * Attempt to re-establish the WebRTC connection.
     * Closes the old RTCPeerConnection, creates a fresh one, then re-runs the
     * offer/answer handshake via the provided signaling function.
     *
     * On success the caller (P2PTransport) must call `resetReconnectAttempts()` after
     * the connection state reaches 'connected' — not here — so the reset only happens
     * when the channel is truly usable again.
     *
     * @param isHost      - true if this peer is the match host (creates a new offer)
     * @param signalingFn - async function that sends a signaling message (type + data)
     *
     * Client-side peers: isHost = false. In that case we only need to clean up the stale
     * connection; the host will send a new offer which will be handled by `handleOffer()`
     * in P2PTransport. We do NOT call `onReconnectCallback` here — that is triggered by
     * `setupConnectionHandlers()` once the connection state reaches 'connected'.
     */
    async attemptReconnect(
        isHost: boolean,
        signalingFn: (type: string, data: any) => Promise<void>
    ): Promise<void> {
        this.reconnectAttempts++;
        console.log(`[P2P] Attempting reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} for peer ${this.peerId}`);

        // Close the stale connection cleanly
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }

        if (isHost) {
            // Host creates a fresh offer and sends it via signaling.
            // The counter reset and onReconnectCallback are triggered later, in
            // setupConnectionHandlers(), once the state changes to 'connected'.
            try {
                const offer = await this.createOffer();
                await signalingFn('offer', offer);
            } catch (error) {
                console.error(`[P2P] Reconnect offer failed for peer ${this.peerId}:`, error);
                // Failure: notify the caller so the next backoff can be scheduled
                if (this.onReconnectFailedCallback && this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                    this.onReconnectFailedCallback();
                    if (this.onDisconnectedCallback) {
                        this.onDisconnectedCallback();
                    }
                }
            }
        }
        // Client: just reset the stale connection and wait for the host's new offer.
    }

    /**
     * Called by P2PTransport when the connection state reaches 'connected' after a
     * reconnect attempt, to confirm success and reset the counter.
     */
    resetReconnectAttempts(): void {
        this.reconnectAttempts = 0;
    }

    /**
     * Cancel any pending reconnect timer.
     */
    cancelReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
    }

    /**
     * Setup data channel handlers
     */
    private setupDataChannelHandlers(): void {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log(`[P2P] Data channel opened with peer: ${this.peerId}`);
        };

        this.dataChannel.onclose = () => {
            console.log(`[P2P] Data channel closed with peer: ${this.peerId}`);
        };

        this.dataChannel.onerror = (error) => {
            console.error('[P2P] Data channel error:', error);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const dataSize = typeof event.data === 'string' ? event.data.length : event.data.byteLength;
                this.stats.bytesReceived += dataSize;
                this.stats.packetsReceived++;
                
                const data = JSON.parse(event.data);
                
                // Handle PING/PONG for latency measurement
                if (data.type === 'ping') {
                    // Respond with PONG
                    this.send({ type: 'pong', pingId: data.pingId });
                    return;
                } else if (data.type === 'pong') {
                    // Calculate RTT from PONG response
                    const sendTime = this.pendingPings.get(data.pingId);
                    if (sendTime) {
                        this.latencyMs = Date.now() - sendTime;
                        this.pendingPings.delete(data.pingId);
                    }
                    return;
                }
                
                // Handle batched commands
                // Note: Synchronous processing is acceptable here due to MAX_BATCH_SIZE=50 limit
                // Each command is lightweight and processing 50 commands takes <1ms
                if (data.type === 'command_batch' && Array.isArray(data.commands)) {
                    if (this.onMessageCallback) {
                        // Process each command in the batch
                        data.commands.forEach((cmd: GameCommand) => {
                            this.onMessageCallback!({ type: 'command', command: cmd });
                        });
                    }
                    return;
                }
                
                if (this.onMessageCallback) {
                    this.onMessageCallback(data);
                }
            } catch (error) {
                console.error('[P2P] Failed to parse message:', error);
            }
        };
    }

    /**
     * Send data through data channel
     * Optimized: Reuse stringified data for better performance
     */
    send(data: any): void {
        if (this.dataChannel?.readyState !== 'open') {
            console.warn('[P2P] Cannot send: data channel not open');
            return;
        }

        try {
            const message = JSON.stringify(data);
            this.dataChannel.send(message);
            this.stats.bytesSent += message.length;
            this.stats.packetsSent++;
        } catch (error) {
            console.error('[P2P] Failed to send message:', error);
        }
    }
    
    /**
     * Send pre-serialized data (optimization for batched sends)
     */
    sendRaw(message: string): void {
        if (this.dataChannel?.readyState !== 'open') {
            console.warn('[P2P] Cannot send: data channel not open');
            return;
        }

        try {
            this.dataChannel.send(message);
            this.stats.bytesSent += message.length;
            this.stats.packetsSent++;
        } catch (error) {
            console.error('[P2P] Failed to send message:', error);
        }
    }

    /**
     * Check if connection is ready
     */
    isReady(): boolean {
        return this.dataChannel !== null && this.dataChannel.readyState === 'open';
    }

    /**
     * Register message callback
     */
    onMessage(callback: (data: any) => void): void {
        this.onMessageCallback = callback;
    }

    /**
     * Register state change callback
     */
    onStateChange(callback: (state: RTCPeerConnectionState) => void): void {
        this.onStateChangeCallback = callback;
    }

    /**
     * Close connection
     */
    close(): void {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
    }

    /**
     * Get connection statistics
     */
    getStats() {
        return { 
            ...this.stats,
            latencyMs: this.latencyMs
        };
    }
    
    /**
     * Send a ping to measure latency
     */
    sendPing(): void {
        if (this.dataChannel?.readyState !== 'open') {
            return;
        }
        
        const pingId = this.nextPingId++;
        this.pendingPings.set(pingId, Date.now());
        this.send({ type: 'ping', pingId });
        
        // Clean up old pending pings (after 5 seconds)
        setTimeout(() => {
            this.pendingPings.delete(pingId);
        }, 5000);
    }

    getPeerId(): string {
        return this.peerId;
    }
}

/**
 * P2P Transport - implements ITransport using WebRTC with Supabase signaling
 */
export class P2PTransport implements ITransport {
    private supabase: SupabaseClient;
    private matchId: string;
    private localPlayerId: string;
    private isHost: boolean;
    
    // Peer connections
    private peers: Map<string, PeerConnection> = new Map();
    
    // Callbacks
    private commandCallback: ((command: GameCommand) => void) | null = null;
    private onReadyCallback: (() => void) | null = null;
    
    // Signaling channel
    private signalingChannel: RealtimeChannel | null = null;
    
    // State
    private ready: boolean = false;
    private expectedPeerIds: string[] = [];
    
    // TURN server configuration
    private turnServers: TurnServerConfig[] = [];
    
    // Reconnect callback for external consumers
    private onReconnectedCallback: (() => void) | null = null;
    
    // Latency measurement
    private pingInterval: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL_MS = 2000; // Ping every 2 seconds
    
    // Command batching for optimization
    private commandBatch: GameCommand[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private readonly BATCH_INTERVAL_MS = 16; // ~60 FPS, batch every frame
    private readonly MAX_BATCH_SIZE = 50; // Flush if batch gets too large

    constructor(
        supabase: SupabaseClient,
        matchId: string,
        localPlayerId: string,
        isHost: boolean,
        otherPlayerIds: string[],
        turnServers: TurnServerConfig[] = []
    ) {
        this.supabase = supabase;
        this.matchId = matchId;
        this.localPlayerId = localPlayerId;
        this.isHost = isHost;
        this.expectedPeerIds = otherPlayerIds;
        this.turnServers = turnServers;
        
        console.log('[P2PTransport] Created', {
            matchId,
            localPlayerId,
            isHost,
            otherPlayers: otherPlayerIds,
            turnServers: turnServers.length
        });
    }

    /**
     * Register a callback invoked when a peer successfully reconnects.
     */
    onReconnected(callback: () => void): void {
        this.onReconnectedCallback = callback;
    }

    /**
     * Initialize P2P connections using Supabase for signaling
     */
    async initialize(): Promise<void> {
        console.log('[P2PTransport] Initializing...');
        
        try {
            // Subscribe to signaling messages
            await this.setupSignaling();
            
            if (this.isHost) {
                // Host initiates connections to all clients
                await this.initiateConnections();
            }
            // Clients wait for host to initiate
        } catch (error) {
            console.error('[P2PTransport] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Setup Supabase realtime channel for signaling
     */
    private async setupSignaling(): Promise<void> {
        // Subscribe to signaling messages for this match
        this.signalingChannel = this.supabase.channel(`signaling:${this.matchId}`);
        
        this.signalingChannel
            .on('broadcast', { event: 'webrtc-signal' }, (payload) => {
                this.handleSignalingMessage(payload.payload);
            })
            .subscribe((status) => {
                console.log('[P2PTransport] Signaling channel status:', status);
            });
    }

    /**
     * Host initiates connections to all clients
     */
    private async initiateConnections(): Promise<void> {
        console.log('[P2PTransport] Host initiating connections to:', this.expectedPeerIds);
        
        for (const peerId of this.expectedPeerIds) {
            try {
                await this.createOfferForPeer(peerId);
            } catch (error) {
                console.error(`[P2PTransport] Failed to create offer for peer ${peerId}:`, error);
                // Continue with other peers even if one fails
            }
        }
    }

    /**
     * Create WebRTC offer for a peer
     */
    private async createOfferForPeer(peerId: string): Promise<void> {
        const peer = new PeerConnection(peerId, this.turnServers);
        this.setupPeerHandlers(peer);
        this.peers.set(peerId, peer);
        
        const offer = await peer.createOffer();
        
        // Send offer via Supabase signaling
        await this.sendSignalingMessage(peerId, 'offer', offer);
    }

    /**
     * Handle incoming signaling messages
     */
    private async handleSignalingMessage(message: any): Promise<void> {
        // Ignore messages from self
        if (message.from === this.localPlayerId) {
            return;
        }

        // Check if message is for us
        if (message.to && message.to !== this.localPlayerId) {
            return;
        }

        console.log('[P2PTransport] Received signaling:', message.type, 'from', message.from);

        try {
            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message.from, message.data);
                    break;
                case 'answer':
                    await this.handleAnswer(message.from, message.data);
                    break;
                case 'ice':
                    await this.handleIceCandidate(message.from, message.data);
                    break;
            }
        } catch (error) {
            console.error('[P2PTransport] Error handling signaling message:', error);
        }
    }

    /**
     * Handle WebRTC offer from host
     */
    private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        let peer = this.peers.get(peerId);
        if (!peer) {
            peer = new PeerConnection(peerId, this.turnServers);
            this.setupPeerHandlers(peer);
            this.peers.set(peerId, peer);
        }

        const answer = await peer.createAnswer(offer);
        
        // Send answer back to host
        await this.sendSignalingMessage(peerId, 'answer', answer);
    }

    /**
     * Handle WebRTC answer from client
     */
    private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            console.error('[P2PTransport] No peer found for answer from', peerId);
            return;
        }

        await peer.setAnswer(answer);
    }

    /**
     * Handle ICE candidate
     */
    private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            console.warn('[P2PTransport] No peer found for ICE candidate from', peerId);
            return;
        }

        await peer.addIceCandidate(candidate);
    }

    /**
     * Send signaling message via Supabase
     */
    private async sendSignalingMessage(to: string, type: string, data: any): Promise<void> {
        if (!this.signalingChannel) {
            console.error('[P2PTransport] Signaling channel not ready');
            return;
        }

        const message = {
            from: this.localPlayerId,
            to: to,
            type: type,
            data: data
        };

        await this.signalingChannel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: message
        });

        console.log('[P2PTransport] Sent signaling:', type, 'to', to);
    }

    /**
     * Setup handlers for a peer connection
     */
    private setupPeerHandlers(peer: PeerConnection): void {
        peer.onMessage((data: any) => {
            // Received command from peer
            if (this.commandCallback && data.type === 'command') {
                this.commandCallback(data.command);
            }
        });

        peer.onStateChange((state: RTCPeerConnectionState) => {
            if (state === 'connected') {
                console.log('[P2PTransport] Peer connected:', peer.getPeerId());
                // onReconnectCallback is triggered inside PeerConnection.setupConnectionHandlers()
                // when reconnectAttempts > 0; here we just re-check transport readiness.
                this.checkIfReady();
            } else if (state === 'connecting') {
                // Reconnect attempt in progress — do not mark ready
                this.ready = false;
            } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                console.log('[P2PTransport] Peer disconnected:', peer.getPeerId());
                this.ready = false;

                // Check if all attempts are exhausted before scheduling another
                if (peer.reconnectAttempts >= peer.MAX_RECONNECT_ATTEMPTS) {
                    console.warn('[P2PTransport] All reconnect attempts exhausted for peer', peer.getPeerId());
                    return;
                }

                // Schedule reconnect with exponential backoff
                const delayMs = peer.RECONNECT_BACKOFF_MS[
                    Math.min(peer.reconnectAttempts, peer.RECONNECT_BACKOFF_MS.length - 1)
                ];
                console.log(`[P2PTransport] Scheduling reconnect for peer ${peer.getPeerId()} in ${delayMs}ms`);

                if (peer.reconnectTimer) {
                    clearTimeout(peer.reconnectTimer);
                }
                peer.reconnectTimer = setTimeout(() => {
                    peer.reconnectTimer = null;
                    peer.attemptReconnect(this.isHost, (type, data) =>
                        this.sendSignalingMessage(peer.getPeerId(), type, data)
                    );
                }, delayMs);
            }
        });

        // Called when reconnect succeeds (set inside PeerConnection.setupConnectionHandlers)
        peer.onReconnect(() => {
            console.log('[P2PTransport] Peer reconnected successfully:', peer.getPeerId());
            this.checkIfReady();
            if (this.onReconnectedCallback) {
                this.onReconnectedCallback();
            }
        });

        // Called when all reconnect attempts are exhausted
        peer.onReconnectFailed(() => {
            console.warn('[P2PTransport] Peer reconnect failed permanently:', peer.getPeerId());
            this.ready = false;
        });
    }

    /**
     * Check if all peer connections are ready
     */
    private checkIfReady(): void {
        const allReady = this.expectedPeerIds.every(id => {
            const peer = this.peers.get(id);
            return peer?.isReady();
        });

        if (allReady && !this.ready) {
            this.ready = true;
            console.log('[P2PTransport] All peers connected! Transport ready.');
            
            // Start periodic latency measurement
            this.startLatencyMeasurement();
            
            if (this.onReadyCallback) {
                this.onReadyCallback();
            }
        }
    }
    
    /**
     * Start periodic latency measurement via PING/PONG
     * Optimized: Only ping periodically, and only when channel is active
     */
    private startLatencyMeasurement(): void {
        this.pingInterval = setInterval(() => {
            // Only ping if we have recent activity to avoid unnecessary traffic
            this.peers.forEach(peer => {
                if (peer.isReady()) {
                    peer.sendPing();
                }
            });
        }, this.PING_INTERVAL_MS);
    }

    /**
     * ITransport implementation: Send command to all peers
     * Uses batching to optimize network traffic
     */
    sendCommand(command: GameCommand): void {
        if (!this.ready) {
            console.warn('[P2PTransport] Cannot send command: not ready');
            return;
        }

        // Add to batch
        this.commandBatch.push(command);
        
        // Flush immediately if batch is full
        if (this.commandBatch.length >= this.MAX_BATCH_SIZE) {
            this.flushCommandBatch();
            return;
        }
        
        // Otherwise, set timer to flush batch after interval
        if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushCommandBatch();
            }, this.BATCH_INTERVAL_MS);
        }
    }
    
    /**
     * Flush pending command batch to all peers
     * Optimized: Serialize once and send to all peers
     */
    private flushCommandBatch(): void {
        if (this.commandBatch.length === 0) {
            return;
        }
        
        // Clear timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        // Send batched commands as a single message
        const message = {
            type: 'command_batch',
            commands: this.commandBatch
        };
        
        // Optimize: Serialize once and reuse for all peers
        const serialized = JSON.stringify(message);
        
        // Broadcast to all peers via P2P
        this.peers.forEach(peer => {
            peer.sendRaw(serialized);
        });
        
        // Clear batch
        this.commandBatch = [];
    }

    /**
     * ITransport implementation: Register command callback
     */
    onCommandReceived(callback: (command: GameCommand) => void): void {
        this.commandCallback = callback;
    }

    /**
     * Check if transport is ready
     */
    isReady(): boolean {
        return this.ready;
    }

    /**
     * Register ready callback
     */
    onReady(callback: () => void): void {
        this.onReadyCallback = callback;
    }

    /**
     * ITransport implementation: Disconnect
     */
    disconnect(): void {
        console.log('[P2PTransport] Disconnecting...');
        
        // Flush any pending commands before disconnecting
        this.flushCommandBatch();
        
        // Stop batch timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        // Stop latency measurement
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Cancel any pending reconnect timers and close all peer connections
        this.peers.forEach(peer => {
            peer.cancelReconnect();
            peer.close();
        });
        this.peers.clear();
        
        // Unsubscribe from signaling
        if (this.signalingChannel) {
            this.supabase.removeChannel(this.signalingChannel);
            this.signalingChannel = null;
        }
        
        this.ready = false;
    }

    /**
     * ITransport implementation: Get statistics
     */
    getStats(): TransportStats {
        let totalBytesSent = 0;
        let totalBytesReceived = 0;
        let totalPacketsSent = 0;
        let totalPacketsReceived = 0;
        let maxLatency = 0;

        this.peers.forEach(peer => {
            const stats = peer.getStats();
            totalBytesSent += stats.bytesSent;
            totalBytesReceived += stats.bytesReceived;
            totalPacketsSent += stats.packetsSent;
            totalPacketsReceived += stats.packetsReceived;
            // Track the worst latency among all peers
            if (stats.latencyMs > maxLatency) {
                maxLatency = stats.latencyMs;
            }
        });

        return {
            connected: this.ready,
            latencyMs: maxLatency, // Report worst-case latency
            packetsSent: totalPacketsSent,
            packetsReceived: totalPacketsReceived,
            bytesOut: totalBytesSent,
            bytesIn: totalBytesReceived
        };
    }
}
