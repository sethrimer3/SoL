/**
 * Type definitions for P2P Multiplayer System
 * 
 * This file provides strong typing for command payloads and game settings
 * to replace 'any' types with proper discriminated unions.
 */

/**
 * Game settings that can be configured when creating a match
 */
export interface GameSettings {
    /** Game mode variant (if multiple modes supported) */
    gameMode?: 'standard' | 'custom' | '2v2';
    
    /** Starting resources for players */
    startingEnergy?: number;
    
    /** Game speed multiplier (1.0 = normal) */
    gameSpeed?: number;
    
    /** Map size configuration */
    mapWidth?: number;
    mapHeight?: number;
    
    /** Number of asteroids to spawn */
    asteroidCount?: number;
    
    /** Victory conditions */
    victoryCondition?: 'destroy_forge' | 'economic' | 'time_limit';
    
    /** Time limit in minutes (if using time_limit victory) */
    timeLimitMinutes?: number;
    
    /** Allow spectators */
    allowSpectators?: boolean;
    
    /** Custom game rules */
    customRules?: {
        [key: string]: boolean | number | string;
    };

    /** Team configuration for team games */
    teamConfig?: {
        enabled: boolean;
        maxPlayersPerTeam: number;
    };
}

/**
 * Base command payload interface
 */
export interface BaseCommandPayload {
    /** Timestamp when command was created (for debugging) */
    timestamp?: number;
}

/**
 * Unit movement command payload
 */
export interface UnitMovePayload extends BaseCommandPayload {
    /** IDs of units to move */
    unitIds: string[] | number[];
    
    /** Target X coordinate */
    targetX: number;
    
    /** Target Y coordinate */
    targetY: number;
    
    /** Movement order number (for sorting multiple move commands) */
    moveOrder?: number;
    
    /** Whether this is an attack-move or regular move */
    attackMove?: boolean;
}

/**
 * Unit target structure command payload
 */
export interface UnitTargetStructurePayload extends BaseCommandPayload {
    /** IDs of units to command */
    unitIds: string[] | number[];
    
    /** Target player index */
    targetPlayerIndex: number;
    
    /** Type of structure to target */
    structureType: 'forge' | 'building' | 'mirror';
    
    /** Index of structure in player's array */
    structureIndex: number;
    
    /** Movement order number */
    moveOrder?: number;
}

/**
 * Building construction command payload
 */
export interface BuildBuildingPayload extends BaseCommandPayload {
    /** Type of building to construct */
    buildingType: string;
    
    /** X coordinate for building placement */
    x: number;
    
    /** Y coordinate for building placement */
    y: number;
    
    /** Optional building configuration */
    config?: {
        [key: string]: boolean | number | string;
    };
}

/**
 * Hero production command payload
 */
export interface ProduceHeroPayload extends BaseCommandPayload {
    /** Type of hero to produce */
    heroType: string;
    
    /** Optional spawn position override */
    spawnPosition?: {
        x: number;
        y: number;
    };
}

/**
 * Unit ability command payload
 */
export interface UnitAbilityPayload extends BaseCommandPayload {
    /** ID of unit using ability */
    unitId: string | number;
    
    /** Ability slot (if unit has multiple abilities) */
    abilityIndex?: number;
    
    /** Direction for directional abilities */
    direction?: {
        x: number;
        y: number;
    };
    
    /** Target position for area abilities */
    targetPosition?: {
        x: number;
        y: number;
    };
    
    /** Target unit ID for targeted abilities */
    targetUnitId?: string | number;
}

/**
 * Mirror control command payload
 */
export interface MirrorControlPayload extends BaseCommandPayload {
    /** Index of mirror to control */
    mirrorIndex: number;
    
    /** Action to perform */
    action: 'select' | 'link' | 'move' | 'rotate';
    
    /** Link target (if action is 'link') */
    linkTarget?: {
        type: 'forge' | 'building';
        index?: number;
    };
    
    /** Position (if action is 'move') */
    position?: {
        x: number;
        y: number;
    };
    
    /** Rotation angle in radians (if action is 'rotate') */
    rotation?: number;
}

/**
 * Forge movement command payload
 */
export interface ForgeMovePayload extends BaseCommandPayload {
    /** Target X coordinate */
    targetX: number;
    
    /** Target Y coordinate */
    targetY: number;
}

/**
 * Chat message command payload
 */
export interface ChatMessagePayload extends BaseCommandPayload {
    /** Chat message text */
    message: string;
    
    /** Message type (all, team, whisper) */
    channel?: 'all' | 'team' | 'whisper';
    
    /** Target player for whisper */
    targetPlayerId?: string;
}

/**
 * Surrender/resign command payload
 */
export interface SurrenderPayload extends BaseCommandPayload {
    /** Confirmation flag (to prevent accidental surrender) */
    confirmed: boolean;
}

/**
 * Discriminated union of all command payload types
 * Use this to get type-safe command payloads
 */
export type CommandPayload =
    | { type: 'unit_move'; data: UnitMovePayload }
    | { type: 'unit_target_structure'; data: UnitTargetStructurePayload }
    | { type: 'build_building'; data: BuildBuildingPayload }
    | { type: 'produce_hero'; data: ProduceHeroPayload }
    | { type: 'unit_ability'; data: UnitAbilityPayload }
    | { type: 'mirror_control'; data: MirrorControlPayload }
    | { type: 'forge_move'; data: ForgeMovePayload }
    | { type: 'chat_message'; data: ChatMessagePayload }
    | { type: 'surrender'; data: SurrenderPayload };

/**
 * Type guard to check if payload matches a specific command type
 */
export function isCommandPayload<T extends CommandPayload['type']>(
    commandType: string,
    expectedType: T
): commandType is T {
    return commandType === expectedType;
}

/**
 * Helper to extract payload type for a given command type
 */
export type PayloadForCommand<T extends CommandPayload['type']> = 
    Extract<CommandPayload, { type: T }>['data'];

/**
 * Network event data types
 */
export interface MatchCreatedEventData {
    matchId: string;
    matchCode: string;
    hostPlayerId: string;
}

export interface PlayerJoinedEventData {
    playerId: string;
    username: string;
    playerCount: number;
}

export interface PlayerLeftEventData {
    playerId: string;
    username: string;
    playerCount: number;
}

export interface MatchStartedEventData {
    gameSeed: number;
    playerIds: string[];
    startTime: number;
}

export interface MatchEndedEventData {
    winnerId?: string;
    reason: 'victory' | 'disconnect' | 'surrender' | 'timeout';
    duration: number;
}

export interface ErrorEventData {
    code: string;
    message: string;
    details?: unknown;
}

/**
 * Discriminated union for network event data
 */
export type NetworkEventData =
    | { event: 'match_created'; data: MatchCreatedEventData }
    | { event: 'player_joined'; data: PlayerJoinedEventData }
    | { event: 'player_left'; data: PlayerLeftEventData }
    | { event: 'match_started'; data: MatchStartedEventData }
    | { event: 'match_ended'; data: MatchEndedEventData }
    | { event: 'error'; data: ErrorEventData }
    | { event: 'connected' | 'disconnected' | 'connecting'; data?: undefined };

/**
 * Type-safe network event callback
 */
export type TypedNetworkEventCallback<T extends NetworkEventData['event']> = (
    data: Extract<NetworkEventData, { event: T }>['data']
) => void;

/**
 * Signaling message types for WebRTC
 */
export interface SignalingMessage {
    id: string;
    match_id: string;
    from_player: string;
    to_player: string;
    message_type: 'offer' | 'answer' | 'ice-candidate';
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
    created_at: string;
}

/**
 * Transport statistics for monitoring
 */
export interface TransportStatistics {
    /** Is transport connected */
    connected: boolean;
    
    /** Round-trip latency in milliseconds */
    latencyMs: number;
    
    /** Total packets sent */
    packetsSent: number;
    
    /** Total packets received */
    packetsReceived: number;
    
    /** Total bytes sent */
    bytesOut: number;
    
    /** Total bytes received */
    bytesIn: number;
    
    /** Packet loss rate (0-1) */
    packetLossRate?: number;
    
    /** Current bandwidth usage (bytes per second) */
    currentBandwidth?: number;
}

/**
 * Command queue statistics
 */
export interface CommandQueueStatistics {
    /** Current tick being processed */
    currentTick: number;
    
    /** Number of commands waiting in queue */
    queueDepth: number;
    
    /** Number of commands processed so far */
    totalCommandsProcessed: number;
    
    /** Number of commands that timed out */
    missedCommandsCount: number;
    
    /** Expected players in this match */
    expectedPlayers: string[];
    
    /** Average commands per tick */
    averageCommandsPerTick: number;
}
