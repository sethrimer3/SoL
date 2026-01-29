/**
 * Network Module for LAN Play
 * Implements WebRTC peer-to-peer networking for local multiplayer
 */

/**
 * Game command that can be sent over network
 */
export interface GameCommand {
    tick: number;
    playerId: string;
    command: string;
    data: any;
}

/**
 * Network message types
 */
export enum MessageType {
    GAME_COMMAND = 'game_command',
    GAME_STATE = 'game_state',
    PLAYER_JOIN = 'player_join',
    PLAYER_LEAVE = 'player_leave',
    LOBBY_UPDATE = 'lobby_update',
    GAME_START = 'game_start',
    PING = 'ping',
    PONG = 'pong'
}

/**
 * Network message structure
 */
export interface NetworkMessage {
    type: MessageType;
    senderId: string;
    timestamp: number;
    data: any;
}

/**
 * Player information
 */
export interface PlayerInfo {
    id: string;
    username: string;
    isHost: boolean;
    isReady: boolean;
}

/**
 * Lobby information
 */
export interface LobbyInfo {
    id: string;
    name: string;
    hostId: string;
    players: PlayerInfo[];
    maxPlayers: number;
    gameStarted: boolean;
}

/**
 * Network events
 */
export enum NetworkEvent {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    MESSAGE_RECEIVED = 'message_received',
    PLAYER_JOINED = 'player_joined',
    PLAYER_LEFT = 'player_left',
    ERROR = 'error'
}

/**
 * Callback type for network events
 */
export type NetworkEventCallback = (data?: any) => void;

/**
 * WebRTC Peer Connection Manager
 */
export class PeerConnection {
    private connection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private peerId: string;
    private onMessageCallback: ((message: NetworkMessage) => void) | null = null;
    private onConnectedCallback: (() => void) | null = null;
    private onDisconnectedCallback: (() => void) | null = null;

    constructor(peerId: string) {
        this.peerId = peerId;
    }

    /**
     * Initialize RTCPeerConnection with ICE servers
     */
    private createPeerConnection(): RTCPeerConnection {
        // Using public STUN servers for NAT traversal
        const configuration: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        return new RTCPeerConnection(configuration);
    }

    /**
     * Create offer (host side)
     */
    async createOffer(): Promise<RTCSessionDescriptionInit> {
        this.connection = this.createPeerConnection();
        this.setupConnectionHandlers();

        // Create data channel for game communication
        this.dataChannel = this.connection.createDataChannel('gameData', {
            ordered: true,
            maxRetransmits: 3
        });
        this.setupDataChannelHandlers(this.dataChannel);

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);
        
        return offer;
    }

    /**
     * Create answer (client side)
     */
    async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        this.connection = this.createPeerConnection();
        this.setupConnectionHandlers();

        // Set up data channel when received
        this.connection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers(this.dataChannel);
        };

        await this.connection.setRemoteDescription(offer);
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);
        
        return answer;
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
     * Add ICE candidate
     */
    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not initialized');
        }
        await this.connection.addIceCandidate(candidate);
    }

    /**
     * Set up connection event handlers
     */
    private setupConnectionHandlers(): void {
        if (!this.connection) return;

        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                // ICE candidate should be exchanged via signaling
                console.log('ICE candidate:', event.candidate);
            }
        };

        this.connection.onconnectionstatechange = () => {
            if (!this.connection) return;
            
            console.log('Connection state:', this.connection.connectionState);
            
            if (this.connection.connectionState === 'connected') {
                if (this.onConnectedCallback) {
                    this.onConnectedCallback();
                }
            } else if (this.connection.connectionState === 'disconnected' || 
                       this.connection.connectionState === 'failed' ||
                       this.connection.connectionState === 'closed') {
                if (this.onDisconnectedCallback) {
                    this.onDisconnectedCallback();
                }
            }
        };
    }

    /**
     * Set up data channel event handlers
     */
    private setupDataChannelHandlers(channel: RTCDataChannel): void {
        channel.onopen = () => {
            console.log('Data channel opened with peer:', this.peerId);
        };

        channel.onclose = () => {
            console.log('Data channel closed with peer:', this.peerId);
        };

        channel.onerror = (error) => {
            console.error('Data channel error:', error);
        };

        channel.onmessage = (event) => {
            try {
                const message: NetworkMessage = JSON.parse(event.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback(message);
                }
            } catch (error) {
                console.error('Failed to parse network message:', error);
            }
        };
    }

    /**
     * Send message to peer
     */
    sendMessage(message: NetworkMessage): void {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.warn('Data channel not open, cannot send message');
            return;
        }

        try {
            this.dataChannel.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    /**
     * Set callback for received messages
     */
    onMessage(callback: (message: NetworkMessage) => void): void {
        this.onMessageCallback = callback;
    }

    /**
     * Set callback for connection established
     */
    onConnected(callback: () => void): void {
        this.onConnectedCallback = callback;
    }

    /**
     * Set callback for disconnection
     */
    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback;
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
     * Check if connected
     */
    isConnected(): boolean {
        return this.dataChannel !== null && this.dataChannel.readyState === 'open';
    }

    getPeerId(): string {
        return this.peerId;
    }
}

/**
 * Network Manager for handling multiple peer connections
 */
export class NetworkManager {
    private localPlayerId: string;
    private peers: Map<string, PeerConnection> = new Map();
    private eventListeners: Map<NetworkEvent, NetworkEventCallback[]> = new Map();
    private lobby: LobbyInfo | null = null;
    private isHost: boolean = false;

    constructor(playerId: string) {
        this.localPlayerId = playerId;
    }

    /**
     * Create a new lobby (host)
     */
    createLobby(lobbyName: string, username: string, maxPlayers: number = 2): LobbyInfo {
        this.isHost = true;
        
        this.lobby = {
            id: this.generateLobbyId(),
            name: lobbyName,
            hostId: this.localPlayerId,
            players: [{
                id: this.localPlayerId,
                username: username,
                isHost: true,
                isReady: true
            }],
            maxPlayers: maxPlayers,
            gameStarted: false
        };

        return this.lobby;
    }

    /**
     * Connect to a peer (initiates WebRTC connection)
     */
    async connectToPeer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        const peer = new PeerConnection(peerId);
        this.setupPeerHandlers(peer);
        
        const answer = await peer.createAnswer(offer);
        this.peers.set(peerId, peer);
        
        return answer;
    }

    /**
     * Host creates offer for new peer
     */
    async createOfferForPeer(peerId: string): Promise<RTCSessionDescriptionInit> {
        const peer = new PeerConnection(peerId);
        this.setupPeerHandlers(peer);
        
        const offer = await peer.createOffer();
        this.peers.set(peerId, peer);
        
        return offer;
    }

    /**
     * Complete connection with answer
     */
    async completeConnection(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`No peer connection found for ${peerId}`);
        }
        await peer.setAnswer(answer);
    }

    /**
     * Set up event handlers for a peer
     */
    private setupPeerHandlers(peer: PeerConnection): void {
        peer.onMessage((message: NetworkMessage) => {
            this.handleMessage(peer.getPeerId(), message);
        });

        peer.onConnected(() => {
            console.log('Peer connected:', peer.getPeerId());
            this.emit(NetworkEvent.CONNECTED, { peerId: peer.getPeerId() });
        });

        peer.onDisconnected(() => {
            console.log('Peer disconnected:', peer.getPeerId());
            this.removePeer(peer.getPeerId());
            this.emit(NetworkEvent.DISCONNECTED, { peerId: peer.getPeerId() });
        });
    }

    /**
     * Handle incoming message from peer
     */
    private handleMessage(peerId: string, message: NetworkMessage): void {
        console.log('Received message from', peerId, ':', message);

        switch (message.type) {
            case MessageType.PLAYER_JOIN:
                if (this.isHost && this.lobby) {
                    // Host adds player to lobby
                    const playerInfo: PlayerInfo = message.data;
                    this.lobby.players.push(playerInfo);
                    this.broadcastLobbyUpdate();
                }
                break;

            case MessageType.LOBBY_UPDATE:
                // Update local lobby state
                this.lobby = message.data;
                this.emit(NetworkEvent.PLAYER_JOINED, message.data);
                break;

            case MessageType.GAME_START:
                // Game is starting
                if (this.lobby) {
                    this.lobby.gameStarted = true;
                }
                break;

            case MessageType.GAME_COMMAND:
                // Forward game command to listeners
                this.emit(NetworkEvent.MESSAGE_RECEIVED, message);
                break;

            default:
                this.emit(NetworkEvent.MESSAGE_RECEIVED, message);
                break;
        }
    }

    /**
     * Send message to specific peer
     */
    sendToPeer(peerId: string, message: NetworkMessage): void {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.sendMessage(message);
        } else {
            console.warn(`Cannot send to peer ${peerId}: not connected`);
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    broadcast(message: NetworkMessage): void {
        this.peers.forEach((peer) => {
            peer.sendMessage(message);
        });
    }

    /**
     * Broadcast lobby update to all peers
     */
    private broadcastLobbyUpdate(): void {
        if (!this.lobby) return;

        const message: NetworkMessage = {
            type: MessageType.LOBBY_UPDATE,
            senderId: this.localPlayerId,
            timestamp: Date.now(),
            data: this.lobby
        };

        this.broadcast(message);
    }

    /**
     * Send game command to all peers
     */
    sendGameCommand(command: GameCommand): void {
        const message: NetworkMessage = {
            type: MessageType.GAME_COMMAND,
            senderId: this.localPlayerId,
            timestamp: Date.now(),
            data: command
        };

        this.broadcast(message);
    }

    /**
     * Start the game (host only)
     */
    startGame(): void {
        if (!this.isHost || !this.lobby) {
            console.warn('Only host can start the game');
            return;
        }

        this.lobby.gameStarted = true;

        const message: NetworkMessage = {
            type: MessageType.GAME_START,
            senderId: this.localPlayerId,
            timestamp: Date.now(),
            data: this.lobby
        };

        this.broadcast(message);
    }

    /**
     * Register event listener
     */
    on(event: NetworkEvent, callback: NetworkEventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    /**
     * Emit event to listeners
     */
    private emit(event: NetworkEvent, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    /**
     * Remove peer connection
     */
    private removePeer(peerId: string): void {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.close();
            this.peers.delete(peerId);
        }

        // Remove from lobby if exists
        if (this.lobby) {
            this.lobby.players = this.lobby.players.filter(p => p.id !== peerId);
            if (this.isHost) {
                this.broadcastLobbyUpdate();
            }
        }
    }

    /**
     * Disconnect from all peers and close lobby
     */
    disconnect(): void {
        this.peers.forEach((peer) => {
            peer.close();
        });
        this.peers.clear();
        this.lobby = null;
        this.isHost = false;
    }

    /**
     * Generate unique lobby ID
     */
    private generateLobbyId(): string {
        return `lobby_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current lobby info
     */
    getLobby(): LobbyInfo | null {
        return this.lobby;
    }

    /**
     * Get local player ID
     */
    getLocalPlayerId(): string {
        return this.localPlayerId;
    }

    /**
     * Check if this client is the host
     */
    isLobbyHost(): boolean {
        return this.isHost;
    }

    /**
     * Get number of connected peers
     */
    getPeerCount(): number {
        return this.peers.size;
    }

    /**
     * Get all connected peer IDs
     */
    getPeerIds(): string[] {
        return Array.from(this.peers.keys());
    }
}

/**
 * Simple signaling mechanism for LAN play
 * Uses copy-paste signaling for initial connection setup
 */
export class LANSignaling {
    /**
     * Generate connection code for host
     */
    static async generateHostCode(offer: RTCSessionDescriptionInit): Promise<string> {
        const data = {
            type: 'offer',
            sdp: offer
        };
        return btoa(JSON.stringify(data));
    }

    /**
     * Parse host connection code
     */
    static parseHostCode(code: string): RTCSessionDescriptionInit {
        try {
            const data = JSON.parse(atob(code));
            if (data.type !== 'offer') {
                throw new Error('Invalid connection code: not an offer');
            }
            return data.sdp;
        } catch (error) {
            throw new Error('Invalid connection code format');
        }
    }

    /**
     * Generate answer code for client
     */
    static async generateAnswerCode(answer: RTCSessionDescriptionInit): Promise<string> {
        const data = {
            type: 'answer',
            sdp: answer
        };
        return btoa(JSON.stringify(data));
    }

    /**
     * Parse client answer code
     */
    static parseAnswerCode(code: string): RTCSessionDescriptionInit {
        try {
            const data = JSON.parse(atob(code));
            if (data.type !== 'answer') {
                throw new Error('Invalid connection code: not an answer');
            }
            return data.sdp;
        } catch (error) {
            throw new Error('Invalid connection code format');
        }
    }
}
