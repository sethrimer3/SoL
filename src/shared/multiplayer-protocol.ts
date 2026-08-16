/**
 * Shared Multiplayer Protocol
 * 
 * Defines message types, interfaces, and data structures shared between
 * the Colyseus server and game clients.
 * 
 * DESIGN PRINCIPLES:
 * - Pure TypeScript (Node.js and Browser compatible)
 * - Zero DOM, Canvas, React, or browser-only dependencies
 * - Strongly-typed message contracts
 */

/**
 * Protocol message identifiers exchanged over Colyseus rooms
 */
export enum ProtocolMessage {
    /** Relay a single GameCommand */
    COMMAND = 'cmd',
    
    /** Relay a batch of GameCommands */
    COMMAND_BATCH = 'cmd_batch',
    
    /** Relay state verification hash for desync detection */
    STATE_HASH = 'state_hash',
    
    /** Host signals match start */
    START_MATCH = 'start_match',
    
    /** Player readiness toggle */
    PLAYER_READY = 'player_ready',
    
    /** Server broadcasts match start data (seed, tick rate, players) */
    MATCH_START = 'match_start',
    
    /** Server broadcasts match metadata updates (players joined, ready status, etc.) */
    MATCH_UPDATE = 'match_update',
    
    /** Error notification */
    ERROR = 'error'
}

/**
 * Match status enum
 */
export type MatchStatus = 'open' | 'starting' | 'active' | 'ended';

/**
 * Player role in a match
 */
export type PlayerRole = 'host' | 'client';

/**
 * Metadata for a player inside a match
 */
export interface PlayerMetadata {
    playerId: string;
    username: string;
    role: PlayerRole;
    connected: boolean;
    isReady: boolean;
    faction: string | null;
    joinedAt?: number;
}

/**
 * Match metadata and configuration
 */
export interface MatchInfo {
    id: string;
    matchCode: string;
    hostPlayerId: string;
    status: MatchStatus;
    gameSeed: number;
    tickRate: number;
    maxPlayers: number;
    matchName: string;
    gameSettings: Record<string, any>;
    players: PlayerMetadata[];
    createdAt: number;
}

/**
 * Options provided when creating a match
 */
export interface CreateRoomOptions {
    matchName: string;
    username: string;
    playerId: string;
    maxPlayers?: number;
    tickRate?: number;
    gameSeed?: number;
    gameSettings?: Record<string, any>;
}

/**
 * Options provided when joining a match
 */
export interface JoinRoomOptions {
    username: string;
    playerId: string;
    faction?: string | null;
}

/**
 * Payload broadcast when a match starts
 */
export interface MatchStartPayload {
    matchId: string;
    gameSeed: number;
    tickRate: number;
    playerIds: string[];
    players: PlayerMetadata[];
    startTime: number;
    gameSettings: Record<string, any>;
}

/**
 * State hash message for desync detection
 */
export interface StateHashMessage {
    tick: number;
    playerId: string;
    hash: number;
}
