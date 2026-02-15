"use strict";
/**
 * Network Module for LAN Play
 * Implements WebRTC peer-to-peer networking for local multiplayer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANSignaling = exports.NetworkManager = exports.PeerConnection = exports.NetworkEvent = exports.MessageType = void 0;
/**
 * Network message types
 */
var MessageType;
(function (MessageType) {
    MessageType["GAME_COMMAND"] = "game_command";
    MessageType["GAME_STATE"] = "game_state";
    MessageType["PLAYER_JOIN"] = "player_join";
    MessageType["PLAYER_LEAVE"] = "player_leave";
    MessageType["LOBBY_UPDATE"] = "lobby_update";
    MessageType["GAME_START"] = "game_start";
    MessageType["PING"] = "ping";
    MessageType["PONG"] = "pong";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * Network events
 */
var NetworkEvent;
(function (NetworkEvent) {
    NetworkEvent["CONNECTED"] = "connected";
    NetworkEvent["DISCONNECTED"] = "disconnected";
    NetworkEvent["MESSAGE_RECEIVED"] = "message_received";
    NetworkEvent["PLAYER_JOINED"] = "player_joined";
    NetworkEvent["PLAYER_LEFT"] = "player_left";
    NetworkEvent["ERROR"] = "error";
})(NetworkEvent || (exports.NetworkEvent = NetworkEvent = {}));
/**
 * WebRTC Peer Connection Manager
 */
class PeerConnection {
    constructor(peerId) {
        this.connection = null;
        this.dataChannel = null;
        this.onMessageCallback = null;
        this.onConnectedCallback = null;
        this.onDisconnectedCallback = null;
        this.peerId = peerId;
    }
    /**
     * Initialize RTCPeerConnection with ICE servers
     */
    createPeerConnection() {
        // Using public STUN servers for NAT traversal
        const configuration = {
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
    async createOffer() {
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
        // Wait for ICE gathering to complete
        await this.waitForIceGathering();
        return this.connection.localDescription;
    }
    /**
     * Create answer (client side)
     */
    async createAnswer(offer) {
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
        // Wait for ICE gathering to complete
        await this.waitForIceGathering();
        return this.connection.localDescription;
    }
    /**
     * Wait for ICE gathering to complete
     */
    waitForIceGathering() {
        if (!this.connection) {
            return Promise.reject(new Error('Connection not initialized'));
        }
        return new Promise((resolve) => {
            if (this.connection.iceGatheringState === 'complete') {
                resolve();
                return;
            }
            const checkState = () => {
                if (this.connection.iceGatheringState === 'complete') {
                    this.connection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };
            this.connection.addEventListener('icegatheringstatechange', checkState);
        });
    }
    /**
     * Complete connection with answer (host side)
     */
    async setAnswer(answer) {
        if (!this.connection) {
            throw new Error('Connection not initialized');
        }
        await this.connection.setRemoteDescription(answer);
    }
    /**
     * Add ICE candidate
     */
    async addIceCandidate(candidate) {
        if (!this.connection) {
            throw new Error('Connection not initialized');
        }
        await this.connection.addIceCandidate(candidate);
    }
    /**
     * Set up connection event handlers
     */
    setupConnectionHandlers() {
        if (!this.connection)
            return;
        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                // ICE candidate should be exchanged via signaling
                console.log('ICE candidate:', event.candidate);
            }
        };
        this.connection.onconnectionstatechange = () => {
            if (!this.connection)
                return;
            console.log('Connection state:', this.connection.connectionState);
            if (this.connection.connectionState === 'connected') {
                if (this.onConnectedCallback) {
                    this.onConnectedCallback();
                }
            }
            else if (this.connection.connectionState === 'disconnected' ||
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
    setupDataChannelHandlers(channel) {
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
                const message = JSON.parse(event.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback(message);
                }
            }
            catch (error) {
                console.error('Failed to parse network message:', error);
            }
        };
    }
    /**
     * Send message to peer
     */
    sendMessage(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.warn('Data channel not open, cannot send message');
            return;
        }
        try {
            this.dataChannel.send(JSON.stringify(message));
        }
        catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    /**
     * Set callback for received messages
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }
    /**
     * Set callback for connection established
     */
    onConnected(callback) {
        this.onConnectedCallback = callback;
    }
    /**
     * Set callback for disconnection
     */
    onDisconnected(callback) {
        this.onDisconnectedCallback = callback;
    }
    /**
     * Close connection
     */
    close() {
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
    isConnected() {
        return this.dataChannel !== null && this.dataChannel.readyState === 'open';
    }
    getPeerId() {
        return this.peerId;
    }
}
exports.PeerConnection = PeerConnection;
/**
 * Network Manager for handling multiple peer connections
 */
class NetworkManager {
    constructor(playerId) {
        this.peers = new Map();
        this.eventListeners = new Map();
        this.lobby = null;
        this.isHost = false;
        this.localPlayerId = playerId;
    }
    /**
     * Create a new lobby (host)
     */
    createLobby(lobbyName, username, maxPlayers = 2) {
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
    async connectToPeer(peerId, offer) {
        const peer = new PeerConnection(peerId);
        this.setupPeerHandlers(peer);
        const answer = await peer.createAnswer(offer);
        this.peers.set(peerId, peer);
        return answer;
    }
    /**
     * Host creates offer for new peer
     */
    async createOfferForPeer(peerId) {
        const peer = new PeerConnection(peerId);
        this.setupPeerHandlers(peer);
        const offer = await peer.createOffer();
        this.peers.set(peerId, peer);
        return offer;
    }
    /**
     * Complete connection with answer
     */
    async completeConnection(peerId, answer) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`No peer connection found for ${peerId}`);
        }
        await peer.setAnswer(answer);
    }
    /**
     * Set up event handlers for a peer
     */
    setupPeerHandlers(peer) {
        peer.onMessage((message) => {
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
    handleMessage(peerId, message) {
        console.log('Received message from', peerId, ':', message);
        switch (message.type) {
            case MessageType.PLAYER_JOIN:
                if (this.isHost && this.lobby) {
                    // Host adds player to lobby
                    const playerInfo = message.data;
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
    sendToPeer(peerId, message) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.sendMessage(message);
        }
        else {
            console.warn(`Cannot send to peer ${peerId}: not connected`);
        }
    }
    /**
     * Broadcast message to all connected peers
     */
    broadcast(message) {
        this.peers.forEach((peer) => {
            peer.sendMessage(message);
        });
    }
    /**
     * Broadcast lobby update to all peers
     */
    broadcastLobbyUpdate() {
        if (!this.lobby)
            return;
        const message = {
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
    sendGameCommand(command) {
        const message = {
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
    startGame() {
        if (!this.isHost || !this.lobby) {
            console.warn('Only host can start the game');
            return;
        }
        this.lobby.gameStarted = true;
        const message = {
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
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    /**
     * Emit event to listeners
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
    /**
     * Remove peer connection
     */
    removePeer(peerId) {
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
    disconnect() {
        this.peers.forEach((peer) => {
            peer.close();
        });
        this.peers.clear();
        this.lobby = null;
        this.isHost = false;
        // Clear event listeners to prevent memory leaks
        this.eventListeners.clear();
    }
    /**
     * Generate unique lobby ID
     */
    generateLobbyId() {
        return `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
    /**
     * Get current lobby info
     */
    getLobby() {
        return this.lobby;
    }
    /**
     * Get local player ID
     */
    getLocalPlayerId() {
        return this.localPlayerId;
    }
    /**
     * Check if this client is the host
     */
    isLobbyHost() {
        return this.isHost;
    }
    /**
     * Get number of connected peers
     */
    getPeerCount() {
        return this.peers.size;
    }
    /**
     * Get all connected peer IDs
     */
    getPeerIds() {
        return Array.from(this.peers.keys());
    }
}
exports.NetworkManager = NetworkManager;
/**
 * Simple signaling mechanism for LAN play
 * Uses copy-paste signaling for initial connection setup
 */
class LANSignaling {
    /**
     * Generate connection code for host
     */
    static async generateHostCode(offer, playerId, username) {
        const data = {
            type: 'offer',
            sdp: offer,
            playerId: playerId,
            username: username
        };
        return btoa(JSON.stringify(data));
    }
    /**
     * Parse host connection code
     */
    static parseHostCode(code) {
        try {
            const data = JSON.parse(atob(code));
            if (data.type !== 'offer') {
                throw new Error('Invalid connection code: not an offer');
            }
            return {
                offer: data.sdp,
                playerId: data.playerId || 'host',
                username: data.username || 'Host'
            };
        }
        catch (error) {
            throw new Error('Invalid connection code format');
        }
    }
    /**
     * Generate answer code for client
     */
    static async generateAnswerCode(answer, playerId, username) {
        const data = {
            type: 'answer',
            sdp: answer,
            playerId: playerId,
            username: username
        };
        return btoa(JSON.stringify(data));
    }
    /**
     * Parse client answer code
     */
    static parseAnswerCode(code) {
        try {
            const data = JSON.parse(atob(code));
            if (data.type !== 'answer') {
                throw new Error('Invalid connection code: not an answer');
            }
            return {
                answer: data.sdp,
                playerId: data.playerId || 'client',
                username: data.username || 'Client'
            };
        }
        catch (error) {
            throw new Error('Invalid connection code format');
        }
    }
}
exports.LANSignaling = LANSignaling;
