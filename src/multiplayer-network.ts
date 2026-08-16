/**
 * Multiplayer Network Manager
 * 
 * High-level manager for Colyseus-backed multiplayer with deterministic lockstep.
 * Handles match lifecycle, room membership, command synchronization, and state verification.
 * 
 * MATCH LIFECYCLE:
 * 1. Create Match → Host creates Colyseus room
 * 2. Join Match → Clients join Colyseus room by ID / match code
 * 3. Start Match → Host signals start, server broadcasts synchronized game seed and player list
 * 4. Play → GameCommands flow through ColyseusTransport, deterministic simulation advances tick by tick
 * 5. End Match → Clean room teardown and resource disposal
 */

import { Client as ColyseusClient, Room } from '@colyseus/sdk';
import { ColyseusTransport } from './colyseus-transport';
import { 
    GameCommand, 
    CommandQueue, 
    CommandValidator 
} from './transport';
import { 
    SeededRandom, 
    setGameRNG, 
    generateMatchSeed 
} from './seeded-random';
import { 
    StateVerifier, 
    StateVerificationEvent, 
    DesyncEvent 
} from './state-verification';
import { CommandSigner } from './command-signer';
import { getOrCreatePlayerId, getOrGenerateUsername } from './player-identity';
import { 
    ProtocolMessage, 
    MatchInfo, 
    PlayerMetadata, 
    MatchStartPayload, 
    StateHashMessage 
} from './shared/multiplayer-protocol';

/** Type aliases for backward compatibility with UI components */
export type Match = MatchInfo;
export type MatchPlayer = PlayerMetadata;

/**
 * Match creation options
 */
export interface CreateMatchOptions {
    matchName: string;
    username?: string;
    maxPlayers?: number;
    tickRate?: number;
    gameSeed?: number;
    gameSettings?: Record<string, any>;
}

/**
 * Network events
 */
export enum NetworkEvent {
    MATCH_CREATED = 'match_created',
    PLAYER_JOINED = 'player_joined',
    PLAYER_LEFT = 'player_left',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    MATCH_STARTED = 'match_started',
    MATCH_ENDED = 'match_ended',
    COMMAND_RECEIVED = 'command_received',
    DESYNC_DETECTED = 'desync_detected',
    RECONNECTING = 'reconnecting',
    RECONNECTED = 'reconnected',
    ERROR = 'error'
}

export type NetworkEventCallback = (data?: any) => void;

/**
 * Default Colyseus server endpoint
 */
function getDefaultServerUrl(): string {
    if (typeof process !== 'undefined' && process.env && process.env.COLYSEUS_SERVER_URL) {
        return process.env.COLYSEUS_SERVER_URL;
    }
    if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname || 'localhost';
        // If loaded from dev server on port 8080/etc., default Colyseus port is 2567
        return `${protocol}//${hostname}:2567`;
    }
    return 'ws://localhost:2567';
}

export class MultiplayerNetworkManager {
    private client: ColyseusClient;
    private serverUrl: string;
    private localPlayerId: string;
    private localUsername: string;

    private room: Room | null = null;
    private currentMatch: MatchInfo | null = null;
    private isHost: boolean = false;

    // Transport layer
    private transport: ColyseusTransport | null = null;

    // Command queue and verification
    private commandQueue: CommandQueue | null = null;
    private commandValidator: CommandValidator = new CommandValidator();
    private stateVerifier: StateVerifier | null = null;

    // Deterministic RNG
    private gameRNG: SeededRandom | null = null;

    // Anti-cheat HMAC signing
    private signingKey: CryptoKey | null = null;
    private signingEnabled: boolean = false;

    // Event listeners
    private eventListeners: Map<NetworkEvent, NetworkEventCallback[]> = new Map();

    // State
    private isActive: boolean = false;
    private currentTick: number = 0;
    private isTransportReady: boolean = false;
    private pendingCommands: GameCommand[] = [];

    constructor(serverUrl?: string, playerId?: string) {
        this.serverUrl = serverUrl || getDefaultServerUrl();
        this.localPlayerId = playerId || getOrCreatePlayerId();
        this.localUsername = getOrGenerateUsername();
        this.client = new ColyseusClient(this.serverUrl);

        console.log('[MultiplayerNetworkManager] Initialized with Colyseus endpoint:', this.serverUrl, {
            playerId: this.localPlayerId
        });
    }

    /**
     * Create a new match as host
     */
    async createMatch(options: CreateMatchOptions): Promise<MatchInfo | null> {
        try {
            console.log('[MultiplayerNetworkManager] Creating match on Colyseus server...', options);
            this.emit(NetworkEvent.CONNECTING);

            const username = options.username || this.localUsername;
            const gameSeed = typeof options.gameSeed === 'number' ? options.gameSeed : generateMatchSeed();

            const createOptions = {
                matchName: options.matchName || `${username}'s Match`,
                username: username,
                playerId: this.localPlayerId,
                maxPlayers: options.maxPlayers || 2,
                tickRate: options.tickRate || 30,
                gameSeed: gameSeed,
                gameSettings: options.gameSettings || {}
            };

            this.room = await this.client.create('sol_room', createOptions);
            this.isHost = true;

            this.setupRoomHandlers(this.room);

            const roomId = this.room.roomId || (this.room as any).id || '';
            const matchCode = roomId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6).padEnd(6, 'X');
            this.currentMatch = {
                id: roomId,
                matchCode: matchCode,
                hostPlayerId: this.localPlayerId,
                status: 'open',
                gameSeed: gameSeed,
                tickRate: options.tickRate || 30,
                maxPlayers: options.maxPlayers || 2,
                matchName: options.matchName || `${username}'s Match`,
                gameSettings: options.gameSettings || {},
                players: [{
                    playerId: this.localPlayerId,
                    username: username,
                    role: 'host',
                    connected: true,
                    isReady: true,
                    faction: null
                }],
                createdAt: Date.now()
            };

            // Initialize RNG with match seed
            this.gameRNG = new SeededRandom(gameSeed);
            setGameRNG(this.gameRNG);

            console.log(`[MultiplayerNetworkManager] Match created: ${roomId} (code: ${matchCode}, seed: ${gameSeed})`);
            this.emit(NetworkEvent.MATCH_CREATED, { match: this.currentMatch });

            return this.currentMatch;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error creating match:', error);
            const userMessage = 'Failed to create match on game server. Please ensure the Colyseus server is running.';
            this.emit(NetworkEvent.ERROR, { error, message: userMessage });
            return null;
        }
    }

    /**
     * Join an existing match by Room ID or Match Code
     */
    async joinMatch(roomIdOrCode: string, username?: string): Promise<boolean> {
        try {
            console.log('[MultiplayerNetworkManager] Joining match:', roomIdOrCode);
            this.emit(NetworkEvent.CONNECTING);

            const displayUsername = username || this.localUsername;
            let targetRoomId = roomIdOrCode.trim();

            // If a short match code was provided (length <= 6), look up the matching room
            if (targetRoomId.length <= 6) {
                const foundMatch = await this.findMatchByShortId(targetRoomId);
                if (!foundMatch) {
                    const userMessage = `Match code "${targetRoomId}" not found or expired.`;
                    this.emit(NetworkEvent.ERROR, { error: 'Match not found', message: userMessage });
                    return false;
                }
                targetRoomId = foundMatch.id;
            }

            this.room = await this.client.joinById(targetRoomId, {
                username: displayUsername,
                playerId: this.localPlayerId
            });

            this.isHost = false;
            this.setupRoomHandlers(this.room);

            console.log('[MultiplayerNetworkManager] Successfully joined room:', this.room.roomId || (this.room as any).id);
            return true;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error joining match:', error);
            const userMessage = 'Failed to join match. It may be full or no longer available.';
            this.emit(NetworkEvent.ERROR, { error, message: userMessage });
            return false;
        }
    }

    /**
     * List open/available matches from Colyseus
     */
    async listMatches(): Promise<MatchInfo[]> {
        try {
            const httpUrl = this.serverUrl.replace(/^ws/, 'http');
            const response = await fetch(`${httpUrl}/api/matches`);
            if (!response.ok) return [];
            const availableRooms: any[] = await response.json();
            return availableRooms.map(room => {
                const metadata = room.metadata || {};
                const roomId = room.roomId || room.id || '';
                return {
                    id: roomId,
                    matchCode: metadata.matchCode || roomId.substring(0, 6).toUpperCase(),
                    hostPlayerId: metadata.hostPlayerId || '',
                    status: metadata.status || 'open',
                    gameSeed: 0,
                    tickRate: 30,
                    maxPlayers: room.maxClients || 2,
                    matchName: metadata.matchName || 'SoL Match',
                    gameSettings: {},
                    players: [],
                    createdAt: Date.now()
                };
            });
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Failed to query available matches:', error);
            return [];
        }
    }

    /**
     * Resolve a short match code prefix to a matching room
     */
    async findMatchByShortId(shortMatchId: string): Promise<MatchInfo | null> {
        const normalized = shortMatchId.trim().toUpperCase();
        if (normalized.length < 3) return null;

        try {
            const rooms = await this.listMatches();
            const matching = rooms.filter(m => 
                m.matchCode.toUpperCase().startsWith(normalized) || 
                m.id.toUpperCase().startsWith(normalized)
            );

            if (matching.length === 0) return null;
            if (matching.length > 1) {
                this.emit(NetworkEvent.ERROR, {
                    error: 'Ambiguous match code',
                    message: 'Match code is ambiguous. Please enter more characters.'
                });
                return null;
            }
            return matching[0];
        } catch {
            return null;
        }
    }

    /**
     * Wire room listeners for state updates, match start, command relay, etc.
     */
    private setupRoomHandlers(room: Room): void {
        // Create Colyseus transport
        this.transport = new ColyseusTransport(room, this.localPlayerId);
        this.transport.onCommandReceived((command: GameCommand) => {
            this.handleReceivedCommand(command);
        });

        // Listen for match metadata updates (players joined, ready status, etc.)
        room.onMessage(ProtocolMessage.MATCH_UPDATE, (payload: { match: MatchInfo }) => {
            if (payload?.match) {
                const prevCount = this.currentMatch?.players?.length || 0;
                this.currentMatch = payload.match;

                const newCount = this.currentMatch.players?.length || 0;
                if (newCount > prevCount) {
                    const latestPlayer = this.currentMatch.players[this.currentMatch.players.length - 1];
                    this.emit(NetworkEvent.PLAYER_JOINED, latestPlayer);
                } else if (newCount < prevCount) {
                    this.emit(NetworkEvent.PLAYER_LEFT, { playerCount: newCount });
                }
            }
        });

        // Listen for synchronized match start broadcast from server
        room.onMessage(ProtocolMessage.MATCH_START, (payload: MatchStartPayload) => {
            this.handleMatchStarted(payload);
        });

        // Listen for state verification hash relay
        room.onMessage(ProtocolMessage.STATE_HASH, (payload: StateHashMessage) => {
            if (this.stateVerifier && payload && payload.playerId !== this.localPlayerId) {
                this.stateVerifier.receiveHash(payload.tick, payload.playerId, payload.hash);
            }
        });

        // Listen for server errors
        room.onMessage(ProtocolMessage.ERROR, (payload: { message: string }) => {
            this.emit(NetworkEvent.ERROR, { message: payload.message });
        });

        // Handle connection loss & reconnection
        room.onLeave((code) => {
            console.log(`[MultiplayerNetworkManager] Room left with code ${code}`);
            this.emit(NetworkEvent.DISCONNECTED);
        });

        room.onError((code, message) => {
            console.error(`[MultiplayerNetworkManager] Room error ${code}: ${message}`);
            this.emit(NetworkEvent.ERROR, { code: String(code), message });
        });
    }

    /**
     * Start the match (Host triggers server broadcast)
     */
    async startMatch(): Promise<boolean> {
        if (!this.room) {
            console.error('[MultiplayerNetworkManager] Cannot start match: not in a room');
            return false;
        }

        if (!this.isHost) {
            console.warn('[MultiplayerNetworkManager] Only the host can trigger match start');
            return false;
        }

        try {
            console.log('[MultiplayerNetworkManager] Host requesting match start...');
            this.room.send(ProtocolMessage.START_MATCH, {});
            return true;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error sending start match request:', error);
            return false;
        }
    }

    /**
     * Handle synchronized match start payload
     */
    private async handleMatchStarted(payload: MatchStartPayload): Promise<void> {
        console.log('[MultiplayerNetworkManager] Match started with synchronized seed:', payload.gameSeed);

        // Initialize shared seed
        this.gameRNG = new SeededRandom(payload.gameSeed);
        setGameRNG(this.gameRNG);

        // Initialize command queue with all participating players
        const allPlayerIds = payload.playerIds && payload.playerIds.length > 0
            ? payload.playerIds
            : payload.players.map(p => p.playerId);

        this.commandQueue = new CommandQueue(allPlayerIds);

        // Initialize StateVerifier for desync detection
        if (this.transport) {
            this.stateVerifier = new StateVerifier(
                this.transport,
                this.localPlayerId,
                allPlayerIds
            );

            this.stateVerifier.on(StateVerificationEvent.DESYNC, (event: DesyncEvent) => {
                console.error('[MultiplayerNetworkManager] DESYNC DETECTED!', event);
                this.emit(NetworkEvent.DESYNC_DETECTED, event);
            });
        }

        // Derive anti-cheat signing key
        try {
            this.signingKey = await CommandSigner.deriveKey(payload.gameSeed);
            this.commandValidator.setSigningKey(this.signingKey);
            this.signingEnabled = true;
        } catch (err) {
            console.warn('[MultiplayerNetworkManager] Failed to derive command signing key:', err);
            this.signingEnabled = false;
        }

        // Flush any pending commands
        if (this.pendingCommands.length > 0 && this.transport) {
            for (const cmd of this.pendingCommands) {
                if (this.commandQueue) this.commandQueue.addCommand(cmd);
                this.transport.sendCommand(cmd);
            }
            this.pendingCommands = [];
        }

        this.isActive = true;
        this.isTransportReady = true;

        this.emit(NetworkEvent.CONNECTED);
        this.emit(NetworkEvent.MATCH_STARTED, {
            matchId: payload.matchId,
            seed: payload.gameSeed,
            playerIds: allPlayerIds,
            startTime: payload.startTime
        });
    }

    /**
     * Handle received command from network transport
     */
    private handleReceivedCommand(command: GameCommand): void {
        // Internal state verification messages are handled directly by StateVerifier
        if (command.commandType === '__state_hash__') {
            return;
        }

        // Validate command structure and rate limit
        if (!this.commandValidator.validate(command)) {
            console.error('[MultiplayerNetworkManager] Invalid command received, dropping:', command);
            return;
        }

        // Fast-path signature check
        if (this.signingEnabled && !this.commandValidator.verifySignature(command)) {
            console.error('[MultiplayerNetworkManager] Command rejected (missing signature):', command.commandType);
            return;
        }

        // Async cryptographic HMAC verification if signing is enabled
        if (this.signingEnabled && this.signingKey && command.signature) {
            CommandSigner.verify(command, command.signature, this.signingKey).then(valid => {
                if (valid) {
                    if (this.commandQueue) {
                        this.commandQueue.addCommand(command);
                    }
                    this.emit(NetworkEvent.COMMAND_RECEIVED, { command });
                } else {
                    console.error('[MultiplayerNetworkManager] Command failed HMAC verification, dropping:', command.commandType);
                }
            }).catch(err => {
                console.warn('[MultiplayerNetworkManager] Signature verification error:', err);
            });
            return;
        }

        // Add to local command queue
        if (this.commandQueue) {
            this.commandQueue.addCommand(command);
        }
        this.emit(NetworkEvent.COMMAND_RECEIVED, { command });
    }

    /**
     * Send a game command to all players
     */
    sendCommand(commandType: string, payload: any): void {
        const command: GameCommand = {
            tick: this.currentTick,
            playerId: this.localPlayerId,
            commandType: commandType,
            payload: payload
        };

        if (!this.commandValidator.validate(command)) {
            console.error('[MultiplayerNetworkManager] Cannot send invalid command:', command);
            return;
        }

        if (this.signingEnabled && this.signingKey) {
            CommandSigner.sign(command, this.signingKey).then(signature => {
                command.signature = signature;
                this.dispatchCommand(command);
            }).catch(err => {
                console.warn('[MultiplayerNetworkManager] Failed to sign command, sending unsigned:', err);
                this.dispatchCommand(command);
            });
            return;
        }

        this.dispatchCommand(command);
    }

    private dispatchCommand(command: GameCommand): void {
        if (!this.transport?.isReady()) {
            this.pendingCommands.push(command);
            return;
        }

        if (this.commandQueue) {
            this.commandQueue.addCommand(command);
        }

        this.transport.sendCommand(command);
    }

    /**
     * Get deterministic commands for the next simulation tick
     */
    getNextTickCommands(): GameCommand[] | null {
        if (!this.commandQueue) {
            return [];
        }
        return this.commandQueue.getNextTickCommands();
    }

    /**
     * Advance simulation tick counter
     */
    advanceTick(): void {
        this.currentTick++;
    }

    /**
     * Submit state hash for periodic desync verification
     */
    submitStateHash(stateHash: number): void {
        if (this.stateVerifier && this.room) {
            this.stateVerifier.submitHash(this.currentTick, stateHash);
            const message: StateHashMessage = {
                tick: this.currentTick,
                playerId: this.localPlayerId,
                hash: stateHash
            };
            this.room.send(ProtocolMessage.STATE_HASH, message);
        }
    }

    getStateVerificationStats() {
        return this.stateVerifier?.getStats() || null;
    }

    /**
     * End match and clean up
     */
    async endMatch(reason?: string): Promise<void> {
        console.log('[MultiplayerNetworkManager] Ending match...', reason);
        this.isActive = false;
        this.isTransportReady = false;
        this.pendingCommands = [];

        if (this.transport) {
            this.transport.disconnect();
            this.transport = null;
        }

        if (this.room) {
            try {
                this.room.leave();
            } catch {
                // Ignore
            }
            this.room = null;
        }

        if (this.commandQueue) {
            this.commandQueue.clear();
            this.commandQueue = null;
        }

        this.stateVerifier = null;
        this.signingKey = null;
        this.signingEnabled = false;

        this.emit(NetworkEvent.MATCH_ENDED, { reason });
    }

    /**
     * Disconnect from current match
     */
    async disconnect(): Promise<void> {
        await this.endMatch('player_disconnect');
    }

    getCurrentMatch(): MatchInfo | null {
        return this.currentMatch;
    }

    isInMatch(): boolean {
        return this.isActive;
    }

    getGameSeed(): number | null {
        return this.currentMatch?.gameSeed || null;
    }

    getCurrentTick(): number {
        return this.currentTick;
    }

    getQueueStats() {
        return this.commandQueue?.getStats() || null;
    }

    getNetworkStats() {
        return this.transport?.getStats() || null;
    }

    getLocalPlayerId(): string {
        return this.localPlayerId;
    }

    /**
     * Check if network transport is ready to send commands
     */
    isReady(): boolean {
        return this.isTransportReady;
    }

    on(event: NetworkEvent, callback: NetworkEventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    off(event: NetworkEvent, callback: NetworkEventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emit(event: NetworkEvent, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[MultiplayerNetworkManager] Error in event listener:', error);
                }
            });
        }
    }
}
