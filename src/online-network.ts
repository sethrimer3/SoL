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

        // Process queued commands if any
        if (this.commandQueue.length > 0) {
            const queued = this.commandQueue.shift();
            if (queued) {
                await this.sendGameCommand(queued);
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
            'hero_purchase': 'hp',
            'building_purchase': 'bp',
            'mirror_purchase': 'mp',
            'mirror_move': 'mm',
            'mirror_link': 'ml',
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
            'hp': 'hero_purchase',
            'bp': 'building_purchase',
            'mp': 'mirror_purchase',
            'mm': 'mirror_move',
            'ml': 'mirror_link',
            'fm': 'forge_move',
            'sr': 'set_rally_path'
        };
        return expansions[abbr] || abbr;
    }

    /**
     * Shorten player ID for bandwidth savings
     */
    private shortenId(id: string): string {
        // Take first 8 characters of ID (should be unique enough)
        return id.substring(0, 8);
    }

    /**
     * Expand shortened player ID
     */
    private expandId(shortId: string): string {
        // In practice, maintain a mapping of short IDs to full IDs
        return shortId; // Simplified for now
    }

    /**
     * Minimize data by removing unnecessary fields
     */
    private minimizeData(data: any): any {
        if (!data) return data;
        
        // Remove precision from numbers where possible
        if (typeof data === 'object' && !Array.isArray(data)) {
            const minimized: any = {};
            for (const key in data) {
                const value = data[key];
                if (typeof value === 'number') {
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
    isRoomHost(): boolean {
        return this.isHost;
    }

    /**
     * Get local player ID
     */
    getLocalPlayerId(): string {
        return this.localPlayerId;
    }
}
