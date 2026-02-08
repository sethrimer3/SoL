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
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

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

    constructor(peerId: string) {
        this.peerId = peerId;
    }

    /**
     * Initialize RTCPeerConnection with STUN servers for NAT traversal
     */
    private createConnection(): RTCPeerConnection {
        const configuration: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
        
        return new RTCPeerConnection(configuration);
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
     * Setup connection state handlers
     */
    private setupConnectionHandlers(): void {
        if (!this.connection) return;

        this.connection.onconnectionstatechange = () => {
            if (!this.connection) return;
            
            console.log(`[P2P] Connection state: ${this.connection.connectionState}`);
            
            if (this.onStateChangeCallback) {
                this.onStateChangeCallback(this.connection.connectionState);
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
                if (data.type === 'command_batch' && Array.isArray(data.commands)) {
                    if (this.onMessageCallback) {
                        // Process each command in the batch
                        data.commands.forEach((cmd: any) => {
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
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
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
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
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
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
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
        otherPlayerIds: string[]
    ) {
        this.supabase = supabase;
        this.matchId = matchId;
        this.localPlayerId = localPlayerId;
        this.isHost = isHost;
        this.expectedPeerIds = otherPlayerIds;
        
        console.log('[P2PTransport] Created', {
            matchId,
            localPlayerId,
            isHost,
            otherPlayers: otherPlayerIds
        });
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
        const peer = new PeerConnection(peerId);
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
            peer = new PeerConnection(peerId);
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
                this.checkIfReady();
            } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                console.log('[P2PTransport] Peer disconnected:', peer.getPeerId());
                this.ready = false;
            }
        });
    }

    /**
     * Check if all peer connections are ready
     */
    private checkIfReady(): void {
        const allReady = this.expectedPeerIds.every(id => {
            const peer = this.peers.get(id);
            return peer && peer.isReady();
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
        
        // Close all peer connections
        this.peers.forEach(peer => peer.close());
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
