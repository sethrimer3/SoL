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

// P2P implementation
export {
    P2PTransport
} from './p2p-transport';

// Deterministic RNG
export {
    SeededRandom,
    setGameRNG,
    getGameRNG,
    isGameRNGInitialized,
    generateMatchSeed
} from './seeded-random';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { 
 *     MultiplayerNetworkManager, 
 *     NetworkEvent 
 * } from './multiplayer';
 * 
 * const network = new MultiplayerNetworkManager(
 *     supabaseUrl, 
 *     supabaseKey, 
 *     playerId
 * );
 * 
 * // Host a match
 * const match = await network.createMatch({
 *     matchName: "My Game",
 *     username: "Player1",
 *     maxPlayers: 2
 * });
 * 
 * // Or join a match
 * await network.joinMatch(matchId, "Player2");
 * 
 * // Start the match
 * await network.startMatch();
 * 
 * // Send commands
 * network.sendCommand('move_unit', { unitId: 5, x: 100, y: 200 });
 * 
 * // Get commands for simulation
 * const commands = network.getNextTickCommands();
 * if (commands) {
 *     commands.forEach(cmd => executeCommand(cmd));
 *     network.advanceTick();
 * }
 * ```
 */
