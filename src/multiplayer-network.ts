/**
 * Multiplayer Network Manager
 * 
 * High-level manager for P2P multiplayer with deterministic lockstep.
 * Handles match lifecycle, command synchronization, and network coordination.
 * 
 * MATCH LIFECYCLE:
 * 1. Create Match → Host creates match in Supabase
 * 2. Join Match → Clients join and exchange connection data
 * 3. Connect → P2P connections established via WebRTC signaling
 * 4. Start Match → Game begins with synchronized seed
 * 5. Play → Commands flow through P2P, simulation advances tick by tick
 * 6. End Match → Clean up and record results
 * 
 * PHASE 2 MIGRATION PATH:
 * - Replace P2PTransport with ServerRelayTransport
 * - Enable lockstep_enabled flag in match settings
 * - Add periodic state hash verification
 * - Implement cheat detection
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { P2PTransport } from './p2p-transport';
import { 
    ITransport, 
    GameCommand, 
    CommandQueue, 
    CommandValidator 
} from './transport';
import { 
    SeededRandom, 
    setGameRNG, 
    generateMatchSeed 
} from './seeded-random';

/**
 * Match metadata stored in Supabase
 */
export interface Match {
    id: string;
    created_at: string;
    status: 'open' | 'connecting' | 'active' | 'ended';
    host_player_id: string;
    game_seed: number;
    tick_rate: number;
    lockstep_enabled: boolean;
    max_players: number;
    match_name: string;
    game_settings: any;
}

/**
 * Player in a match
 */
export interface MatchPlayer {
    id: string;
    match_id: string;
    player_id: string;
    role: 'host' | 'client';
    connected: boolean;
    username: string;
    faction: string | null;
}

/**
 * Match creation options
 */
export interface CreateMatchOptions {
    matchName: string;
    username: string;
    maxPlayers?: number;
    tickRate?: number;
    lockstepEnabled?: boolean;
    gameSeed?: number;
    gameSettings?: any;
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
    ERROR = 'error'
}

export type NetworkEventCallback = (data?: any) => void;

/**
 * Main multiplayer network manager
 */
export class MultiplayerNetworkManager {
    private supabase: SupabaseClient;
    private localPlayerId: string;
    private currentMatch: Match | null = null;
    private isHost: boolean = false;
    
    // Transport layer (P2P or Server Relay)
    private transport: ITransport | null = null;
    
    // Command management
    private commandQueue: CommandQueue | null = null;
    private commandValidator: CommandValidator = new CommandValidator();
    
    // RNG for determinism
    private gameRNG: SeededRandom | null = null;
    
    // Event listeners
    private eventListeners: Map<NetworkEvent, NetworkEventCallback[]> = new Map();
    
    // State
    private isActive: boolean = false;
    private currentTick: number = 0;

    constructor(supabaseUrl: string, supabaseAnonKey: string, playerId: string) {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
        this.localPlayerId = playerId;
        
        console.log('[MultiplayerNetworkManager] Initialized', {
            playerId
        });
    }

    /**
     * Create a new match (host)
     */
    async createMatch(options: CreateMatchOptions): Promise<Match | null> {
        try {
            console.log('[MultiplayerNetworkManager] Creating match...', options);
            
            this.isHost = true;
            const gameSeed = options.gameSeed || generateMatchSeed();
            
            // Create match in Supabase
            const { data: match, error: matchError } = await this.supabase
                .from('matches')
                .insert([{
                    status: 'open',
                    host_player_id: this.localPlayerId,
                    game_seed: gameSeed,
                    tick_rate: options.tickRate || 30,
                    lockstep_enabled: options.lockstepEnabled || false,
                    max_players: options.maxPlayers || 2,
                    match_name: options.matchName,
                    game_settings: options.gameSettings || {}
                }])
                .select()
                .single();

            if (matchError) {
                console.error('[MultiplayerNetworkManager] Failed to create match:', matchError);
                this.emit(NetworkEvent.ERROR, { error: matchError });
                return null;
            }

            this.currentMatch = match;

            // Add host as player
            const { error: playerError } = await this.supabase
                .from('match_players')
                .insert([{
                    match_id: match.id,
                    player_id: this.localPlayerId,
                    role: 'host',
                    connected: false,
                    username: options.username
                }]);

            if (playerError) {
                console.error('[MultiplayerNetworkManager] Failed to add host player:', playerError);
                this.emit(NetworkEvent.ERROR, { error: playerError });
                return null;
            }

            // Initialize RNG with match seed
            this.gameRNG = new SeededRandom(gameSeed);
            setGameRNG(this.gameRNG);

            console.log('[MultiplayerNetworkManager] Match created:', match.id, 'seed:', gameSeed);
            this.emit(NetworkEvent.MATCH_CREATED, { match });
            
            // Start listening for players joining
            this.startListeningForPlayers();

            return match;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error creating match:', error);
            this.emit(NetworkEvent.ERROR, { error });
            return null;
        }
    }

    /**
     * List available matches
     */
    async listMatches(): Promise<Match[]> {
        const { data, error } = await this.supabase
            .from('matches')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[MultiplayerNetworkManager] Failed to list matches:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Join an existing match
     */
    async joinMatch(matchId: string, username: string): Promise<boolean> {
        try {
            console.log('[MultiplayerNetworkManager] Joining match:', matchId);
            
            // Get match info
            const { data: match, error: matchError } = await this.supabase
                .from('matches')
                .select('*')
                .eq('id', matchId)
                .single();

            if (matchError || !match) {
                console.error('[MultiplayerNetworkManager] Match not found:', matchError);
                this.emit(NetworkEvent.ERROR, { error: 'Match not found' });
                return false;
            }

            // Check if match is joinable
            if (match.status !== 'open') {
                console.error('[MultiplayerNetworkManager] Match not open for joining');
                this.emit(NetworkEvent.ERROR, { error: 'Match not open' });
                return false;
            }

            // Check player count
            const { data: players, error: playersError } = await this.supabase
                .from('match_players')
                .select('*')
                .eq('match_id', matchId);

            if (playersError || !players) {
                console.error('[MultiplayerNetworkManager] Failed to get players:', playersError);
                return false;
            }

            if (players.length >= match.max_players) {
                console.error('[MultiplayerNetworkManager] Match is full');
                this.emit(NetworkEvent.ERROR, { error: 'Match is full' });
                return false;
            }

            this.currentMatch = match;
            this.isHost = false;

            // Add player to match
            const { error: playerError } = await this.supabase
                .from('match_players')
                .insert([{
                    match_id: matchId,
                    player_id: this.localPlayerId,
                    role: 'client',
                    connected: false,
                    username: username
                }]);

            if (playerError) {
                console.error('[MultiplayerNetworkManager] Failed to join match:', playerError);
                this.emit(NetworkEvent.ERROR, { error: playerError });
                return false;
            }

            // Initialize RNG with match seed
            this.gameRNG = new SeededRandom(match.game_seed);
            setGameRNG(this.gameRNG);

            console.log('[MultiplayerNetworkManager] Joined match:', matchId);
            this.emit(NetworkEvent.PLAYER_JOINED, { matchId, playerId: this.localPlayerId });

            return true;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error joining match:', error);
            this.emit(NetworkEvent.ERROR, { error });
            return false;
        }
    }

    /**
     * Start listening for players joining (host only)
     */
    private startListeningForPlayers(): void {
        if (!this.isHost || !this.currentMatch) return;

        // Subscribe to match_players changes
        const channel = this.supabase
            .channel(`match:${this.currentMatch.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'match_players',
                    filter: `match_id=eq.${this.currentMatch.id}`
                },
                (payload) => {
                    console.log('[MultiplayerNetworkManager] Player joined:', payload.new);
                    this.emit(NetworkEvent.PLAYER_JOINED, payload.new);
                }
            )
            .subscribe();
    }

    /**
     * Start the match - establish P2P connections
     */
    async startMatch(): Promise<boolean> {
        if (!this.currentMatch) {
            console.error('[MultiplayerNetworkManager] No active match');
            return false;
        }

        try {
            console.log('[MultiplayerNetworkManager] Starting match...');
            
            // Get all players
            const { data: players, error: playersError } = await this.supabase
                .from('match_players')
                .select('*')
                .eq('match_id', this.currentMatch.id);

            if (playersError || !players) {
                console.error('[MultiplayerNetworkManager] Failed to get players:', playersError);
                return false;
            }

            // Update match status
            if (this.isHost) {
                await this.supabase
                    .from('matches')
                    .update({ status: 'connecting' })
                    .eq('id', this.currentMatch.id);
            }

            this.emit(NetworkEvent.CONNECTING);

            // Get other player IDs
            const otherPlayerIds = players
                .filter(p => p.player_id !== this.localPlayerId)
                .map(p => p.player_id);

            // Initialize command queue
            const allPlayerIds = players.map(p => p.player_id);
            this.commandQueue = new CommandQueue(allPlayerIds);

            // Initialize P2P transport
            // TODO Phase 2: Replace with ServerRelayTransport based on match settings
            this.transport = new P2PTransport(
                this.supabase,
                this.currentMatch.id,
                this.localPlayerId,
                this.isHost,
                otherPlayerIds
            );

            // Setup command handling
            this.transport.onCommandReceived((command: GameCommand) => {
                this.handleReceivedCommand(command);
            });

            // Initialize P2P connections
            await (this.transport as P2PTransport).initialize();

            // Wait for connections to establish
            (this.transport as P2PTransport).onReady(() => {
                this.onTransportReady();
            });

            return true;
        } catch (error) {
            console.error('[MultiplayerNetworkManager] Error starting match:', error);
            this.emit(NetworkEvent.ERROR, { error });
            return false;
        }
    }

    /**
     * Called when transport is ready (all P2P connections established)
     */
    private async onTransportReady(): Promise<void> {
        console.log('[MultiplayerNetworkManager] Transport ready!');
        
        if (this.isHost && this.currentMatch) {
            // Host updates match status to active
            await this.supabase
                .from('matches')
                .update({ status: 'active' })
                .eq('id', this.currentMatch.id);
        }

        this.isActive = true;
        this.emit(NetworkEvent.CONNECTED);
        this.emit(NetworkEvent.MATCH_STARTED, { 
            matchId: this.currentMatch?.id,
            seed: this.currentMatch?.game_seed
        });
    }

    /**
     * Handle received command from network
     */
    private handleReceivedCommand(command: GameCommand): void {
        // Validate command
        if (!this.commandValidator.validate(command)) {
            console.error('[MultiplayerNetworkManager] Invalid command received:', command);
            return;
        }

        // Add to queue
        if (this.commandQueue) {
            this.commandQueue.addCommand(command);
        }

        this.emit(NetworkEvent.COMMAND_RECEIVED, { command });
    }

    /**
     * Send a game command to all players
     */
    sendCommand(commandType: string, payload: any): void {
        if (!this.transport || !this.transport.isReady()) {
            console.warn('[MultiplayerNetworkManager] Cannot send command: transport not ready');
            return;
        }

        const command: GameCommand = {
            tick: this.currentTick,
            playerId: this.localPlayerId,
            commandType: commandType,
            payload: payload
        };

        // Validate before sending
        if (!this.commandValidator.validate(command)) {
            console.error('[MultiplayerNetworkManager] Cannot send invalid command:', command);
            return;
        }

        // Add to own queue
        if (this.commandQueue) {
            this.commandQueue.addCommand(command);
        }

        // Send to others via transport
        this.transport.sendCommand(command);
    }

    /**
     * Get commands for next tick (for deterministic simulation)
     * Returns null if not ready to advance (waiting for commands)
     */
    getNextTickCommands(): GameCommand[] | null {
        if (!this.commandQueue) {
            return [];
        }

        return this.commandQueue.getNextTickCommands();
    }

    /**
     * Advance to next tick
     */
    advanceTick(): void {
        this.currentTick++;
        
        // TODO Phase 2: Generate state hash every N ticks for verification
        // if (this.currentTick % STATE_HASH_INTERVAL === 0) {
        //     const hash = generateStateHash(gameState);
        //     this.verifyStateHash(hash);
        // }
    }

    /**
     * TODO Phase 2: Verify state hash with other players
     * 
     * @deprecated Not implemented in Phase 1. Marked for Phase 2 development.
     * 
     * Future implementation:
     * 1. Send hash to server or exchange with peers
     * 2. Compare hashes
     * 3. If mismatch, trigger desync recovery or cheat detection
     */
    private verifyStateHash(hash: string): void {
        console.log('[MultiplayerNetworkManager] TODO Phase 2: Verify state hash:', hash);
    }

    /**
     * End the match
     */
    async endMatch(reason?: string): Promise<void> {
        console.log('[MultiplayerNetworkManager] Ending match...', reason);
        
        this.isActive = false;

        // Update match status
        if (this.currentMatch && this.isHost) {
            await this.supabase
                .from('matches')
                .update({ status: 'ended' })
                .eq('id', this.currentMatch.id);
        }

        // Disconnect transport
        if (this.transport) {
            this.transport.disconnect();
            this.transport = null;
        }

        // Clear command queue
        if (this.commandQueue) {
            this.commandQueue.clear();
            this.commandQueue = null;
        }

        this.emit(NetworkEvent.MATCH_ENDED, { reason });
    }

    /**
     * Disconnect from current match
     */
    async disconnect(): Promise<void> {
        await this.endMatch('player_disconnect');
    }

    /**
     * Get current match info
     */
    getCurrentMatch(): Match | null {
        return this.currentMatch;
    }

    /**
     * Check if currently in an active match
     */
    isInMatch(): boolean {
        return this.isActive;
    }

    /**
     * Get current game seed
     */
    getGameSeed(): number | null {
        return this.currentMatch?.game_seed || null;
    }

    /**
     * Get current tick
     */
    getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Get command queue statistics
     */
    getQueueStats() {
        return this.commandQueue?.getStats() || null;
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        return this.transport?.getStats?.() || null;
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
     * Unregister event listener
     */
    off(event: NetworkEvent, callback: NetworkEventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     */
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
