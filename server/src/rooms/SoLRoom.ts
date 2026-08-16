import { Room, Client } from 'colyseus';
import { 
    ProtocolMessage, 
    MatchInfo, 
    PlayerMetadata, 
    CreateRoomOptions, 
    JoinRoomOptions, 
    MatchStartPayload, 
    StateHashMessage 
} from '../../../src/shared/multiplayer-protocol';
import { GameCommand } from '../../../src/transport';

/**
 * Maximum command payload size allowed by the server (in characters/bytes)
 */
const MAX_COMMAND_PAYLOAD_SIZE = 4096;

/**
 * Maximum commands allowed in a single batch
 */
const MAX_BATCH_COMMANDS = 100;

/**
 * Colyseus SoLRoom
 * 
 * Manages multiplayer match session lifecycle, room membership, short match codes,
 * game seed / settings synchronization, and command validation/relaying.
 */
export class SoLRoom extends Room {
    private matchInfo!: MatchInfo;
    private players: Map<string, PlayerMetadata> = new Map();
    private sessionToPlayerId: Map<string, string> = new Map();

    /** Reconnection grace window in seconds */
    private readonly RECONNECTION_TIMEOUT_SEC = 20;

    onCreate(options: CreateRoomOptions): void {
        const gameSeed = options.gameSeed || Math.floor(Math.random() * 1000000000);
        const matchCode = this.generateShortMatchCode(this.roomId);

        this.maxClients = options.maxPlayers || 2;
        this.autoDispose = true;

        this.matchInfo = {
            id: this.roomId,
            matchCode: matchCode,
            hostPlayerId: options.playerId || '',
            status: 'open',
            gameSeed: gameSeed,
            tickRate: options.tickRate || 30,
            maxPlayers: this.maxClients,
            matchName: options.matchName || 'SoL Match',
            gameSettings: options.gameSettings || {},
            players: [],
            createdAt: Date.now()
        };

        this.setMetadata({
            matchCode: matchCode,
            matchName: this.matchInfo.matchName,
            hostPlayerId: this.matchInfo.hostPlayerId,
            status: 'open',
            maxPlayers: this.maxClients
        });

        this.setupMessageHandlers();
        console.log(`[SoLRoom] Room created: ${this.roomId} (code: ${matchCode}, seed: ${gameSeed})`);
    }

    private generateShortMatchCode(roomId: string): string {
        // Human-friendly 6-character match code derived from roomId uppercase
        const clean = roomId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return clean.substring(0, 6).padEnd(6, 'X');
    }

    private setupMessageHandlers(): void {
        // Handle single command relay
        this.onMessage(ProtocolMessage.COMMAND, (client: Client, command: GameCommand) => {
            const playerId = this.sessionToPlayerId.get(client.sessionId);
            if (!playerId || !this.validateCommand(command, playerId)) {
                return;
            }

            // Broadcast command to all other connected clients
            this.broadcast(ProtocolMessage.COMMAND, command, { except: client });
        });

        // Handle batched commands relay
        this.onMessage(ProtocolMessage.COMMAND_BATCH, (client: Client, batch: { from: string; commands: GameCommand[] }) => {
            const playerId = this.sessionToPlayerId.get(client.sessionId);
            if (!playerId || !batch || !Array.isArray(batch.commands) || batch.commands.length > MAX_BATCH_COMMANDS) {
                return;
            }

            const validCommands: GameCommand[] = [];
            for (const cmd of batch.commands) {
                if (this.validateCommand(cmd, playerId)) {
                    validCommands.push(cmd);
                }
            }

            if (validCommands.length > 0) {
                this.broadcast(ProtocolMessage.COMMAND_BATCH, {
                    from: playerId,
                    commands: validCommands
                }, { except: client });
            }
        });

        // Handle state verification hash relay
        this.onMessage(ProtocolMessage.STATE_HASH, (client: Client, payload: StateHashMessage) => {
            const playerId = this.sessionToPlayerId.get(client.sessionId);
            if (!playerId || typeof payload?.tick !== 'number' || typeof payload?.hash !== 'number') {
                return;
            }

            // Ensure sender is properly attributed
            payload.playerId = playerId;
            this.broadcast(ProtocolMessage.STATE_HASH, payload, { except: client });
        });

        // Handle player ready toggle
        this.onMessage(ProtocolMessage.PLAYER_READY, (client: Client, message: { isReady: boolean }) => {
            const playerId = this.sessionToPlayerId.get(client.sessionId);
            if (!playerId) return;

            const player = this.players.get(playerId);
            if (player) {
                player.isReady = Boolean(message?.isReady);
                this.broadcastMatchUpdate();
            }
        });

        // Handle host starting match
        this.onMessage(ProtocolMessage.START_MATCH, (client: Client) => {
            const playerId = this.sessionToPlayerId.get(client.sessionId);
            if (playerId !== this.matchInfo.hostPlayerId) {
                client.send(ProtocolMessage.ERROR, { message: 'Only host can start the match.' });
                return;
            }

            if (this.matchInfo.status === 'active') {
                return;
            }

            this.matchInfo.status = 'active';
            this.setMetadata({ status: 'active' });

            const startPayload: MatchStartPayload = {
                matchId: this.roomId,
                gameSeed: this.matchInfo.gameSeed,
                tickRate: this.matchInfo.tickRate,
                playerIds: Array.from(this.players.keys()),
                players: Array.from(this.players.values()),
                startTime: Date.now(),
                gameSettings: this.matchInfo.gameSettings
            };

            console.log(`[SoLRoom] Match started in room ${this.roomId}`);
            this.broadcast(ProtocolMessage.MATCH_START, startPayload);
        });
    }

    private validateCommand(command: any, expectedPlayerId: string): boolean {
        if (!command || typeof command !== 'object') {
            return false;
        }

        if (typeof command.tick !== 'number' || !Number.isFinite(command.tick) || command.tick < 0 || !Number.isInteger(command.tick)) {
            return false;
        }

        if (typeof command.commandType !== 'string' || command.commandType.trim().length === 0) {
            return false;
        }

        if (typeof command.playerId !== 'string' || !command.playerId || command.playerId !== expectedPlayerId) {
            console.warn(`[SoLRoom] Command sender mismatch: ${command?.playerId} vs session ${expectedPlayerId}`);
            return false;
        }

        if (command.payload !== undefined && command.payload !== null) {
            try {
                const serialized = JSON.stringify(command.payload);
                if (serialized.length > MAX_COMMAND_PAYLOAD_SIZE) {
                    console.warn(`[SoLRoom] Command payload exceeded maximum size (${serialized.length})`);
                    return false;
                }
            } catch {
                return false;
            }
        }

        return true;
    }

    onAuth(_client: Client, options: JoinRoomOptions | CreateRoomOptions): boolean {
        if (!options || !options.playerId) {
            return false;
        }
        return true;
    }

    onJoin(client: Client, options: JoinRoomOptions | CreateRoomOptions): void {
        const playerId = options.playerId;
        const isHost = this.players.size === 0 || playerId === this.matchInfo.hostPlayerId;

        if (isHost && !this.matchInfo.hostPlayerId) {
            this.matchInfo.hostPlayerId = playerId;
        }

        this.sessionToPlayerId.set(client.sessionId, playerId);

        const playerMeta: PlayerMetadata = {
            playerId: playerId,
            username: options.username || `Player_${playerId.substring(0, 4)}`,
            role: isHost ? 'host' : 'client',
            connected: true,
            isReady: isHost, // Host is ready by default
            faction: (options as JoinRoomOptions).faction || null,
            joinedAt: Date.now()
        };

        this.players.set(playerId, playerMeta);
        this.updateRoomState();

        console.log(`[SoLRoom] Player joined: ${playerMeta.username} (${playerId}) as ${playerMeta.role}`);
        this.broadcastMatchUpdate();
    }

    /**
     * Called when a client connection drops unexpectedly (network loss / disconnect without leaving).
     */
    async onDrop(client: Client, code?: number): Promise<void> {
        const playerId = this.sessionToPlayerId.get(client.sessionId);
        if (!playerId) return;

        const player = this.players.get(playerId);
        if (!player) return;

        player.connected = false;
        this.broadcastMatchUpdate();

        console.log(`[SoLRoom] Player ${player.username} (${playerId}) dropped (code: ${code}). Waiting for reconnection (${this.RECONNECTION_TIMEOUT_SEC}s)...`);

        try {
            await this.allowReconnection(client, this.RECONNECTION_TIMEOUT_SEC);
        } catch {
            console.log(`[SoLRoom] Reconnection window expired for player ${player.username}`);
        }
    }

    /**
     * Called when a client successfully reconnects within the reconnection window.
     */
    async onReconnect(client: Client): Promise<void> {
        const playerId = this.sessionToPlayerId.get(client.sessionId);
        if (!playerId) {
            console.warn(`[SoLRoom] onReconnect called but no playerId found for sessionId: ${client.sessionId}`);
            return;
        }

        const player = this.players.get(playerId);
        if (!player) {
            console.warn(`[SoLRoom] onReconnect called but player not found: ${playerId}`);
            return;
        }

        player.connected = true;
        console.log(`[SoLRoom] Player ${player.username} (${playerId}) successfully reconnected!`);
        this.broadcastMatchUpdate();
    }

    /**
     * Called when a client permanently leaves the room (consented departure or after reconnection window expired).
     */
    async onLeave(client: Client, code?: number): Promise<void> {
        const playerId = this.sessionToPlayerId.get(client.sessionId);
        if (!playerId) return;

        const player = this.players.get(playerId);
        console.log(`[SoLRoom] Player ${player?.username || playerId} left permanently (code: ${code})`);

        this.removePlayer(playerId, client.sessionId);
    }

    private removePlayer(playerId: string, sessionId: string): void {
        this.sessionToPlayerId.delete(sessionId);
        this.players.delete(playerId);

        // If host left and others remain in open lobby, elect new host
        if (this.matchInfo.hostPlayerId === playerId && this.players.size > 0 && this.matchInfo.status === 'open') {
            const firstRemaining = Array.from(this.players.values())[0];
            firstRemaining.role = 'host';
            firstRemaining.isReady = true;
            this.matchInfo.hostPlayerId = firstRemaining.playerId;
            console.log(`[SoLRoom] Host reassigned to ${firstRemaining.username}`);
        }

        this.updateRoomState();
        this.broadcastMatchUpdate();

        // If no players remain, room will automatically be disposed by Colyseus
    }

    private updateRoomState(): void {
        this.matchInfo.players = Array.from(this.players.values());
        this.setMetadata({
            playerCount: this.players.size,
            status: this.matchInfo.status,
            hostPlayerId: this.matchInfo.hostPlayerId
        });
    }

    private broadcastMatchUpdate(): void {
        this.updateRoomState();
        this.broadcast(ProtocolMessage.MATCH_UPDATE, {
            match: this.matchInfo
        });
    }

    onDispose(): void {
        console.log(`[SoLRoom] Room disposed: ${this.roomId}`);
        this.players.clear();
        this.sessionToPlayerId.clear();
    }
}
