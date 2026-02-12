/**
 * Online Network Module for Supabase-based Multiplayer
 * Implements fast, accurate RTS networking with minimal data transmission
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseConfig, isSupabaseConfigured } from './supabase-config';
import { 
    GameCommand, 
    NetworkMessage, 
    MessageType, 
    PlayerInfo, 
    LobbyInfo,
    NetworkEvent,
    NetworkEventCallback
} from './network';

/**
 * Game room state stored in Supabase
 */
export interface GameRoom {
    id: string;
    name: string;
    host_id: string;
    status: 'waiting' | 'playing' | 'finished';
    max_players: number;
    created_at: string;
    game_settings: any;
    game_mode?: '1v1' | '2v2' | 'custom'; // Game mode type
}

/**
 * Player state in a game room
 */
export interface RoomPlayer {
    room_id: string;
    player_id: string;
    username: string;
    is_host: boolean;
    is_ready: boolean;
    faction: string | null;
    joined_at: string;
    team_id?: number | null; // Team assignment (0 or 1 for 2v2, null for spectators)
    is_spectator?: boolean; // Whether player is spectating
    slot_type?: 'player' | 'ai' | 'spectator' | 'empty'; // Type of slot
    ai_difficulty?: 'easy' | 'normal' | 'hard'; // AI difficulty if slot is AI
    player_color?: string; // Custom color for this player
}

/**
 * Command message optimized for minimal bandwidth
 * Uses short keys and efficient encoding
 */
export interface CompactCommand {
    t: number;        // tick
    p: string;        // playerId (short UUID)
    c: string;        // command type (abbreviated)
    d: any;           // data (minimized)
}

/**
 * Online Network Manager using Supabase Realtime
 */
export class OnlineNetworkManager {
    private supabase: SupabaseClient | null = null;
    private channel: RealtimeChannel | null = null;
    private localPlayerId: string;
    private currentRoom: GameRoom | null = null;
    private eventListeners: Map<NetworkEvent, NetworkEventCallback[]> = new Map();
    private isHost: boolean = false;
    private connected: boolean = false;
    private commandQueue: GameCommand[] = [];
    private lastSyncTime: number = 0;
    private readonly SYNC_INTERVAL_MS = 50; // 20 updates per second for RTS

    constructor(playerId: string) {
        this.localPlayerId = playerId;
        this.initializeSupabase();
    }

    /**
     * Initialize Supabase client
     */
    private initializeSupabase(): void {
        if (!isSupabaseConfigured()) {
            console.error('Supabase not configured. Online play unavailable.');
            return;
        }

        const config = getSupabaseConfig();
        this.supabase = createClient(config.url, config.anonKey, {
            realtime: {
                params: {
                    eventsPerSecond: 20 // Optimize for RTS gameplay
                }
            }
        });
        
        console.log('Supabase client initialized');
    }

    /**
     * Check if online networking is available
     */
    isAvailable(): boolean {
        return this.supabase !== null && isSupabaseConfigured();
    }

    /**
     * Create a new game room (host)
     */
    async createRoom(roomName: string, username: string, maxPlayers: number = 2): Promise<GameRoom | null> {
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return null;
        }

        try {
            this.isHost = true;

            // Create room in database
            const { data: room, error: roomError } = await this.supabase
                .from('game_rooms')
                .insert([{
                    name: roomName,
                    host_id: this.localPlayerId,
                    status: 'waiting',
                    max_players: maxPlayers,
                    game_settings: {}
                }])
                .select()
                .single();

            if (roomError) {
                console.error('Failed to create room:', roomError);
                return null;
            }

            this.currentRoom = room;

            // Add host as player
            const { error: playerError } = await this.supabase
                .from('room_players')
                .insert([{
                    room_id: room.id,
                    player_id: this.localPlayerId,
                    username: username,
                    is_host: true,
                    is_ready: true
                }]);

            if (playerError) {
                console.error('Failed to add host player:', playerError);
                return null;
            }

            // Subscribe to room channel
            await this.subscribeToRoom(room.id);

            console.log('Room created:', room.id);
            return room;
        } catch (error) {
            console.error('Error creating room:', error);
            return null;
        }
    }

    /**
     * Join an existing game room
     */
    async joinRoom(roomId: string, username: string): Promise<boolean> {
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return false;
        }

        try {
            // Get room info
            const { data: room, error: roomError } = await this.supabase
                .from('game_rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (roomError || !room) {
                console.error('Room not found:', roomError);
                return false;
            }

            // Check if room is available
            if (room.status !== 'waiting') {
                console.error('Room is not available for joining');
                return false;
            }

            // Check player count
            const { data: players, error: playersError } = await this.supabase
                .from('room_players')
                .select('*')
                .eq('room_id', roomId);

            if (playersError || !players) {
                console.error('Failed to get room players:', playersError);
                return false;
            }

            if (players.length >= room.max_players) {
                console.error('Room is full');
                return false;
            }

            this.currentRoom = room;
            this.isHost = false;

            // Add player to room
            const { error: playerError } = await this.supabase
                .from('room_players')
                .insert([{
                    room_id: roomId,
                    player_id: this.localPlayerId,
                    username: username,
                    is_host: false,
                    is_ready: false
                }]);

            if (playerError) {
                console.error('Failed to join room:', playerError);
                return false;
            }

            // Subscribe to room channel
            await this.subscribeToRoom(roomId);

            console.log('Joined room:', roomId);
            return true;
        } catch (error) {
            console.error('Error joining room:', error);
            return false;
        }
    }

    /**
     * Subscribe to a room's realtime channel
     */
    private async subscribeToRoom(roomId: string): Promise<void> {
        if (!this.supabase) return;

        // Unsubscribe from previous channel
        if (this.channel) {
            await this.supabase.removeChannel(this.channel);
        }

        // Create new channel for this room
        this.channel = this.supabase.channel(`game-room:${roomId}`, {
            config: {
                broadcast: {
                    ack: false, // Disable acks for lower latency
                    self: false // Don't receive own messages
                }
            }
        });

        // Handle incoming game commands
        this.channel.on('broadcast', { event: 'game_command' }, (payload) => {
            this.handleGameCommand(payload.payload as CompactCommand);
        });

        // Handle game state updates
        this.channel.on('broadcast', { event: 'game_state' }, (payload) => {
            this.emit(NetworkEvent.MESSAGE_RECEIVED, {
                type: MessageType.GAME_STATE,
                data: payload.payload
            });
        });

        // Handle player events
        this.channel.on('broadcast', { event: 'player_event' }, (payload) => {
            this.handlePlayerEvent(payload.payload);
        });

        // Handle game start
        this.channel.on('broadcast', { event: 'game_start' }, (payload) => {
            this.emit(NetworkEvent.MESSAGE_RECEIVED, {
                type: MessageType.GAME_START,
                data: payload.payload
            });
        });

        // Subscribe and handle status
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.connected = true;
                console.log('Connected to room channel');
                this.emit(NetworkEvent.CONNECTED, { roomId });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                this.connected = false;
                console.error('Channel connection error:', status);
                this.emit(NetworkEvent.ERROR, { status });
            }
        });
    }

    /**
     * Send a game command with minimal bandwidth
     */
    async sendGameCommand(command: GameCommand): Promise<void> {
        if (!this.channel || !this.connected) {
            console.warn('Not connected to room, queueing command');
            this.commandQueue.push(command);
            return;
        }

        // Convert to compact format
        const compact: CompactCommand = this.compactCommand(command);

        // Send via broadcast (fast, no ack)
        await this.channel.send({
            type: 'broadcast',
            event: 'game_command',
            payload: compact
        });

        // Process all queued commands if any (prevents bottleneck)
        while (this.commandQueue.length > 0) {
            const queued = this.commandQueue.shift();
            if (queued && this.connected) {
                const queuedCompact = this.compactCommand(queued);
                await this.channel.send({
                    type: 'broadcast',
                    event: 'game_command',
                    payload: queuedCompact
                });
            } else {
                break;
            }
        }
    }

    /**
     * Batch send multiple commands for efficiency
     */
    async sendCommandBatch(commands: GameCommand[]): Promise<void> {
        if (!this.channel || !this.connected) {
            console.warn('Not connected to room');
            return;
        }

        // Convert all to compact format
        const compactCommands = commands.map(cmd => this.compactCommand(cmd));

        // Send as single message
        await this.channel.send({
            type: 'broadcast',
            event: 'game_command_batch',
            payload: compactCommands
        });
    }

    /**
     * Convert command to compact format for minimal bandwidth
     */
    private compactCommand(command: GameCommand): CompactCommand {
        return {
            t: command.tick,
            p: this.shortenId(command.playerId),
            c: this.abbreviateCommand(command.command),
            d: this.minimizeData(command.data)
        };
    }

    /**
     * Expand compact command back to full format
     */
    private expandCommand(compact: CompactCommand): GameCommand {
        return {
            tick: compact.t,
            playerId: this.expandId(compact.p),
            command: this.expandCommandType(compact.c),
            data: compact.d
        };
    }

    /**
     * Abbreviate command type for bandwidth savings
     */
    private abbreviateCommand(command: string): string {
        const abbreviations: { [key: string]: string } = {
            'unit_move': 'um',
            'unit_ability': 'ua',
            'unit_path': 'up',
            'unit_target_structure': 'ut',
            'hero_purchase': 'hp',
            'building_purchase': 'bp',
            'mirror_purchase': 'mp',
            'mirror_move': 'mm',
            'mirror_link': 'ml',
            'starling_merge': 'sm',
            'foundry_blink_upgrade': 'fbu',
            'foundry_attack_upgrade': 'fau',
            'forge_move': 'fm',
            'set_rally_path': 'sr'
        };
        return abbreviations[command] || command;
    }

    /**
     * Expand abbreviated command type
     */
    private expandCommandType(abbr: string): string {
        const expansions: { [key: string]: string } = {
            'um': 'unit_move',
            'ua': 'unit_ability',
            'up': 'unit_path',
            'ut': 'unit_target_structure',
            'hp': 'hero_purchase',
            'bp': 'building_purchase',
            'mp': 'mirror_purchase',
            'mm': 'mirror_move',
            'ml': 'mirror_link',
            'sm': 'starling_merge',
            'fbu': 'foundry_blink_upgrade',
            'fau': 'foundry_attack_upgrade',
            'fm': 'forge_move',
            'sr': 'set_rally_path'
        };
        return expansions[abbr] || abbr;
    }

    /**
     * Shorten player ID for bandwidth savings
     * Note: In production, maintain a bidirectional mapping of short <-> full IDs
     * For now, we return the full ID to avoid collision issues
     */
    private shortenId(id: string): string {
        // TODO: Implement proper ID mapping for production use
        // For beta/development, return full ID to ensure correctness
        return id;
    }

    /**
     * Expand shortened player ID
     * Note: Should use maintained mapping in production
     */
    private expandId(shortId: string): string {
        // TODO: Implement proper ID expansion from mapping
        // For beta/development, ID is already full
        return shortId;
    }

    /**
     * Minimize data by removing unnecessary fields and reducing precision selectively
     */
    private minimizeData(data: any): any {
        if (!data) return data;
        
        // For arrays, minimize each element
        if (Array.isArray(data)) {
            return data.map(item => this.minimizeData(item));
        }
        
        // For objects, selectively apply precision reduction
        if (typeof data === 'object') {
            const minimized: any = {};
            for (const key in data) {
                const value = data[key];
                
                // Only reduce precision for coordinate-like fields
                if (typeof value === 'number' && this.shouldReducePrecision(key)) {
                    // Round positions to 1 decimal place for RTS
                    minimized[key] = Math.round(value * 10) / 10;
                } else if (typeof value === 'object') {
                    minimized[key] = this.minimizeData(value);
                } else {
                    minimized[key] = value;
                }
            }
            return minimized;
        }
        
        return data;
    }

    /**
     * Check if a field should have reduced precision
     */
    private shouldReducePrecision(key: string): boolean {
        // Only reduce precision for position/coordinate fields
        const positionFields = ['x', 'y', 'targetX', 'targetY', 'posX', 'posY', 'rotation'];
        return positionFields.includes(key);
    }

    /**
     * Handle incoming game command
     */
    private handleGameCommand(compact: CompactCommand): void {
        const command = this.expandCommand(compact);
        
        this.emit(NetworkEvent.MESSAGE_RECEIVED, {
            type: MessageType.GAME_COMMAND,
            senderId: command.playerId,
            timestamp: Date.now(),
            data: command
        });
    }

    /**
     * Handle player events (join, leave, ready)
     */
    private handlePlayerEvent(event: any): void {
        switch (event.type) {
            case 'joined':
                this.emit(NetworkEvent.PLAYER_JOINED, event.data);
                break;
            case 'left':
                this.emit(NetworkEvent.PLAYER_LEFT, event.data);
                break;
            case 'ready':
                // Emit lobby update
                this.emit(NetworkEvent.MESSAGE_RECEIVED, {
                    type: MessageType.LOBBY_UPDATE,
                    data: event.data
                });
                break;
        }
    }

    /**
     * Start the game (host only)
     */
    async startGame(): Promise<boolean> {
        if (!this.isHost || !this.channel || !this.currentRoom) {
            console.warn('Only host can start game');
            return false;
        }

        if (!this.supabase) return false;

        try {
            // Update room status
            const { error } = await this.supabase
                .from('game_rooms')
                .update({ status: 'playing' })
                .eq('id', this.currentRoom.id);

            if (error) {
                console.error('Failed to start game:', error);
                return false;
            }

            // Broadcast game start
            await this.channel.send({
                type: 'broadcast',
                event: 'game_start',
                payload: {
                    roomId: this.currentRoom.id,
                    timestamp: Date.now()
                }
            });

            return true;
        } catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    }

    /**
     * Set player ready status
     */
    async setReady(ready: boolean): Promise<boolean> {
        if (!this.supabase || !this.currentRoom) return false;

        try {
            const { error } = await this.supabase
                .from('room_players')
                .update({ is_ready: ready })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId);

            if (error) {
                console.error('Failed to set ready status:', error);
                return false;
            }

            // Broadcast ready status change
            if (this.channel) {
                await this.channel.send({
                    type: 'broadcast',
                    event: 'player_event',
                    payload: {
                        type: 'ready',
                        data: {
                            playerId: this.localPlayerId,
                            ready: ready
                        }
                    }
                });
            }

            return true;
        } catch (error) {
            console.error('Error setting ready status:', error);
            return false;
        }
    }

    /**
     * Get list of available rooms
     */
    async listRooms(): Promise<GameRoom[]> {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('game_rooms')
                .select('*')
                .eq('status', 'waiting')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Failed to list rooms:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error listing rooms:', error);
            return [];
        }
    }

    /**
     * Get players in current room
     */
    async getRoomPlayers(): Promise<RoomPlayer[]> {
        if (!this.supabase || !this.currentRoom) return [];

        try {
            const { data, error } = await this.supabase
                .from('room_players')
                .select('*')
                .eq('room_id', this.currentRoom.id);

            if (error) {
                console.error('Failed to get room players:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error getting room players:', error);
            return [];
        }
    }

    /**
     * Leave current room
     */
    async leaveRoom(): Promise<void> {
        if (!this.supabase || !this.currentRoom) return;

        try {
            // Remove player from room
            await this.supabase
                .from('room_players')
                .delete()
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId);

            // If host, delete room
            if (this.isHost) {
                await this.supabase
                    .from('game_rooms')
                    .delete()
                    .eq('id', this.currentRoom.id);
            }

            // Unsubscribe from channel
            if (this.channel) {
                await this.supabase.removeChannel(this.channel);
                this.channel = null;
            }

            this.currentRoom = null;
            this.connected = false;
            this.isHost = false;
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect(): Promise<void> {
        await this.leaveRoom();
        this.eventListeners.clear();
        this.commandQueue = [];
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
     * Get current room info
     */
    getCurrentRoom(): GameRoom | null {
        return this.currentRoom;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Check if user is host
     */
    getIsHost(): boolean {
        return this.isHost;
    }

    /**
     * Toggle ready status for current player
     */
    async toggleReady(): Promise<boolean> {
        if (!this.supabase || !this.currentRoom) {
            console.error('Not in a room');
            return false;
        }

        try {
            // Get current ready status
            const { data: currentPlayer, error: fetchError } = await this.supabase
                .from('room_players')
                .select('is_ready')
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId)
                .single();

            if (fetchError || !currentPlayer) {
                console.error('Failed to get current ready status:', fetchError);
                return false;
            }

            // Toggle ready status
            const newReadyStatus = !currentPlayer.is_ready;
            const { error } = await this.supabase
                .from('room_players')
                .update({ is_ready: newReadyStatus })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId);

            if (error) {
                console.error('Failed to toggle ready:', error);
                return false;
            }

            console.log(`Ready status changed to: ${newReadyStatus}`);
            return true;
        } catch (error) {
            console.error('Error toggling ready:', error);
            return false;
        }
    }

    /**
     * Add an AI player to the lobby (host only)
     */
    async addAIPlayer(aiPlayerId: string, teamId: number): Promise<boolean> {
        if (!this.supabase || !this.isHost || !this.currentRoom) {
            console.error('Not authorized to add AI');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .insert([{
                    room_id: this.currentRoom.id,
                    player_id: aiPlayerId,
                    username: `AI Player`,
                    is_host: false,
                    is_ready: true,
                    team_id: teamId,
                    slot_type: 'ai',
                    ai_difficulty: 'normal',
                    faction: 'RADIANT'
                }]);

            if (error) {
                console.error('Failed to add AI player:', error);
                return false;
            }

            console.log('AI player added');
            return true;
        } catch (error) {
            console.error('Error adding AI player:', error);
            return false;
        }
    }

    /**
     * Remove a player or AI from the lobby (host only)
     */
    async removePlayer(playerId: string): Promise<boolean> {
        if (!this.supabase || !this.isHost || !this.currentRoom) {
            console.error('Not authorized to remove player');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .delete()
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', playerId);

            if (error) {
                console.error('Failed to remove player:', error);
                return false;
            }

            console.log('Player removed');
            return true;
        } catch (error) {
            console.error('Error removing player:', error);
            return false;
        }
    }

    /**
     * Check if user is host
     */
    isRoomHost(): boolean {
        return this.isHost;
    }

    /**
     * Get local player ID
     */
    getLocalPlayerId(): string {
        return this.localPlayerId;
    }

    // ============================================================================
    // 2v2 CUSTOM LOBBY METHODS
    // ============================================================================

    /**
     * Create a custom 2v2 lobby
     */
    async createCustomLobby(lobbyName: string, username: string): Promise<GameRoom | null> {
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return null;
        }

        try {
            this.isHost = true;

            // Create room with 2v2 mode and 4 max players
            const { data: room, error: roomError } = await this.supabase
                .from('game_rooms')
                .insert([{
                    name: lobbyName,
                    host_id: this.localPlayerId,
                    status: 'waiting',
                    max_players: 4,
                    game_mode: 'custom',
                    game_settings: {
                        teamConfig: {
                            enabled: true,
                            maxPlayersPerTeam: 2
                        }
                    }
                }])
                .select()
                .single();

            if (roomError) {
                console.error('Failed to create custom lobby:', roomError);
                return null;
            }

            this.currentRoom = room;

            // Add host as player on team 0
            const { error: playerError } = await this.supabase
                .from('room_players')
                .insert([{
                    room_id: room.id,
                    player_id: this.localPlayerId,
                    username: username,
                    is_host: true,
                    is_ready: false,
                    team_id: 0,
                    slot_type: 'player'
                }]);

            if (playerError) {
                console.error('Failed to add host player:', playerError);
                return null;
            }

            // Subscribe to room channel
            await this.subscribeToRoom(room.id);

            console.log('Custom lobby created:', room.id);
            return room;
        } catch (error) {
            console.error('Error creating custom lobby:', error);
            return null;
        }
    }

    /**
     * List custom lobbies (2v2 and custom games)
     */
    async listCustomLobbies(): Promise<GameRoom[]> {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('game_rooms')
                .select('*')
                .in('game_mode', ['2v2', 'custom'])
                .eq('status', 'waiting')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Failed to list custom lobbies:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error listing custom lobbies:', error);
            return [];
        }
    }

    /**
     * Set player's team in the lobby (host only)
     */
    async setPlayerTeam(playerId: string, teamId: number): Promise<boolean> {
        if (!this.supabase || !this.isHost || !this.currentRoom) {
            console.error('Not authorized to set team');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .update({ team_id: teamId })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', playerId);

            if (error) {
                console.error('Failed to set player team:', error);
                return false;
            }

            // Broadcast team change
            if (this.channel) {
                await this.channel.send({
                    type: 'broadcast',
                    event: 'player_event',
                    payload: {
                        type: 'team_changed',
                        data: { playerId, teamId }
                    }
                });
            }

            return true;
        } catch (error) {
            console.error('Error setting player team:', error);
            return false;
        }
    }

    /**
     * Set slot type (player, AI, spectator) - host only
     */
    async setSlotType(playerId: string, slotType: 'player' | 'ai' | 'spectator'): Promise<boolean> {
        if (!this.supabase || !this.isHost || !this.currentRoom) {
            console.error('Not authorized to set slot type');
            return false;
        }

        try {
            const updates: any = { slot_type: slotType };
            
            // If setting to spectator, clear team_id
            if (slotType === 'spectator') {
                updates.is_spectator = true;
                updates.team_id = null;
            } else {
                updates.is_spectator = false;
            }

            const { error } = await this.supabase
                .from('room_players')
                .update(updates)
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', playerId);

            if (error) {
                console.error('Failed to set slot type:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error setting slot type:', error);
            return false;
        }
    }

    /**
     * Set AI difficulty for an AI slot (host only)
     */
    async setAIDifficulty(playerId: string, difficulty: 'easy' | 'normal' | 'hard'): Promise<boolean> {
        if (!this.supabase || !this.isHost || !this.currentRoom) {
            console.error('Not authorized to set AI difficulty');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .update({ ai_difficulty: difficulty })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', playerId)
                .eq('slot_type', 'ai');

            if (error) {
                console.error('Failed to set AI difficulty:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error setting AI difficulty:', error);
            return false;
        }
    }

    /**
     * Set player color
     */
    async setPlayerColor(color: string): Promise<boolean> {
        if (!this.supabase || !this.currentRoom) {
            console.error('Not in a room');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .update({ player_color: color })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId);

            if (error) {
                console.error('Failed to set player color:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error setting player color:', error);
            return false;
        }
    }

    /**
     * Set player faction
     */
    async setPlayerFaction(faction: string): Promise<boolean> {
        if (!this.supabase || !this.currentRoom) {
            console.error('Not in a room');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('room_players')
                .update({ faction: faction })
                .eq('room_id', this.currentRoom.id)
                .eq('player_id', this.localPlayerId);

            if (error) {
                console.error('Failed to set player faction:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error setting player faction:', error);
            return false;
        }
    }

    // ============================================================================
    // 2v2 MATCHMAKING METHODS
    // ============================================================================

    /**
     * Join the 2v2 matchmaking queue
     */
    async joinMatchmakingQueue(username: string, mmr: number, faction: string): Promise<boolean> {
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('matchmaking_queue')
                .insert([{
                    player_id: this.localPlayerId,
                    username: username,
                    mmr: mmr,
                    game_mode: '2v2',
                    faction: faction,
                    status: 'searching'
                }]);

            if (error) {
                console.error('Failed to join matchmaking queue:', error);
                return false;
            }

            console.log('Joined 2v2 matchmaking queue');
            return true;
        } catch (error) {
            console.error('Error joining matchmaking queue:', error);
            return false;
        }
    }

    /**
     * Leave the matchmaking queue
     */
    async leaveMatchmakingQueue(): Promise<boolean> {
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return false;
        }

        try {
            const { error } = await this.supabase
                .from('matchmaking_queue')
                .delete()
                .eq('player_id', this.localPlayerId);

            if (error) {
                console.error('Failed to leave matchmaking queue:', error);
                return false;
            }

            console.log('Left matchmaking queue');
            return true;
        } catch (error) {
            console.error('Error leaving matchmaking queue:', error);
            return false;
        }
    }

    /**
     * Check if player is in matchmaking queue
     */
    async isInMatchmakingQueue(): Promise<boolean> {
        if (!this.supabase) return false;

        try {
            const { data, error } = await this.supabase
                .from('matchmaking_queue')
                .select('*')
                .eq('player_id', this.localPlayerId)
                .eq('status', 'searching')
                .single();

            if (error) {
                return false;
            }

            return data !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Find matchmaking candidates (simplified matching)
     */
    async findMatchmakingCandidates(mmr: number): Promise<any[]> {
        if (!this.supabase) return [];

        try {
            // Simple MMR-based matching (±100 MMR range)
            const { data, error } = await this.supabase
                .from('matchmaking_queue')
                .select('*')
                .eq('game_mode', '2v2')
                .eq('status', 'searching')
                .neq('player_id', this.localPlayerId)
                .gte('mmr', mmr - 100)
                .lte('mmr', mmr + 100)
                .order('joined_at', { ascending: true })
                .limit(3); // Need 3 other players for 2v2

            if (error) {
                console.error('Failed to find matchmaking candidates:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error finding matchmaking candidates:', error);
            return [];
        }
    }
}
