/**
 * Multiplayer Networking Module Exports
 * 
 * Central export point for all multiplayer networking functionality.
 * Import from here to use the multiplayer system.
 */

// Core networking
export {
    MultiplayerNetworkManager,
    NetworkEvent,
    Match,
    MatchPlayer,
    CreateMatchOptions,
    NetworkEventCallback
} from './multiplayer-network';

// Transport layer
export {
    ITransport,
    GameCommand,
    CommandQueue,
    CommandValidator,
    TransportStats
} from './transport';

// Colyseus transport implementation
export {
    ColyseusTransport
} from './colyseus-transport';

// Player identity
export {
    getOrCreatePlayerId,
    getOrGenerateUsername,
    setPlayerUsername
} from './player-identity';

// Shared protocol
export {
    ProtocolMessage,
    MatchInfo,
    PlayerMetadata,
    MatchStatus,
    MatchStartPayload
} from './shared/multiplayer-protocol';

// Deterministic RNG
export {
    SeededRandom,
    setGameRNG,
    getGameRNG,
    isGameRNGInitialized,
    generateMatchSeed
} from './seeded-random';
