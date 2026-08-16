/**
 * Comprehensive Colyseus Multiplayer Test Suite
 * 
 * Validates:
 * 1. Colyseus Server startup & room definition
 * 2. Host creates match with persistent player ID & random match code
 * 3. Client joins match by short match code
 * 4. Player membership & ready status synchronization
 * 5. Synchronized match start with identical game seed and tick rate
 * 6. Bi-directional GameCommand transmission and CommandQueue deterministic ordering
 * 7. State hash exchange and verification (no desync)
 * 8. Reconnection within grace window (Colyseus 0.17 onDrop / onReconnect lifecycle)
 * 9. Rejection of malformed & unauthorized commands (sender mismatch, negative tick, oversized payload, malformed batch)
 * 10. Room resiliency: valid commands succeed immediately after malformed traffic
 * 11. Clean match teardown and server disposal
 */

import { startServer, gameServer } from './server/src/index';
import { MultiplayerNetworkManager, NetworkEvent } from './src/multiplayer-network';
import { GameCommand } from './src/transport';
import { SeededRandom } from './src/seeded-random';
import { getOrCreatePlayerId } from './src/player-identity';
import { ProtocolMessage } from './src/shared/multiplayer-protocol';

const TEST_PORT = 2569;
const SERVER_URL = `ws://localhost:${TEST_PORT}`;

// Test assertions helper
let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${testName}`);
    } else {
        console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    }
}

async function runTests() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║  SoL Colyseus Multiplayer Test Suite               ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    let serverInstance: any = null;

    try {
        // 1. Start Colyseus Game Server
        console.log('--- Step 1: Starting Colyseus Test Server ---');
        serverInstance = await startServer(TEST_PORT);
        assert(serverInstance !== null, 'Server listening on test port ' + TEST_PORT);

        // 2. Initialize Player Identities
        console.log('\n--- Step 2: Local Player Identity Verification ---');
        const hostPlayerId = 'test-host-id-' + Math.random().toString(36).substring(2, 8);
        const clientPlayerId = 'test-client-id-' + Math.random().toString(36).substring(2, 8);
        const localDefaultId = getOrCreatePlayerId();

        assert(typeof localDefaultId === 'string' && localDefaultId.length > 0, 'Local persistent player ID generated');
        assert(hostPlayerId !== clientPlayerId, 'Independent player IDs generated');

        // 3. Create Host and Client Managers
        console.log('\n--- Step 3: Initializing Network Managers ---');
        const hostManager = new MultiplayerNetworkManager(SERVER_URL, hostPlayerId);
        const clientManager = new MultiplayerNetworkManager(SERVER_URL, clientPlayerId);
        assert(hostManager.getLocalPlayerId() === hostPlayerId, 'Host manager configured with host player ID');
        assert(clientManager.getLocalPlayerId() === clientPlayerId, 'Client manager configured with client player ID');

        // 4. Host Creates Match
        console.log('\n--- Step 4: Host Creates Match Room ---');
        let hostMatchCreated = false;
        hostManager.on(NetworkEvent.MATCH_CREATED, () => {
            hostMatchCreated = true;
        });

        const createdMatch = await hostManager.createMatch({
            matchName: 'Test Arena 1v1',
            username: 'HostCommander',
            maxPlayers: 2,
            tickRate: 30,
            gameSeed: 424242
        });

        assert(createdMatch !== null, 'Match created on server');
        assert(hostMatchCreated, 'Host received MATCH_CREATED event');
        assert(createdMatch?.gameSeed === 424242, 'Match game seed set correctly');
        assert(createdMatch?.matchCode && createdMatch.matchCode.length >= 4, 'Match code generated', createdMatch?.matchCode);
        assert(createdMatch?.players.length === 1, 'Host registered as initial player');
        assert(createdMatch?.players[0].role === 'host', 'Host assigned host role');

        const matchCode = createdMatch!.matchCode;

        // 5. Client Joins Match by Match Code
        console.log('\n--- Step 5: Client Joins Match Room ---');
        let clientJoined = false;
        let hostSawClientJoin = false;

        hostManager.on(NetworkEvent.PLAYER_JOINED, () => {
            hostSawClientJoin = true;
        });

        clientJoined = await clientManager.joinMatch(matchCode, 'ClientChallenger');
        assert(clientJoined, 'Client joined match by match code');

        // Wait a short moment for membership broadcast
        await new Promise(resolve => setTimeout(resolve, 100));
        assert(hostSawClientJoin, 'Host received PLAYER_JOINED notification');

        // 6. Host Starts Match (Synchronized Start)
        console.log('\n--- Step 6: Synchronized Match Start ---');
        let hostStarted = false;
        let clientStarted = false;
        let hostSeed = 0;
        let clientSeed = 0;

        hostManager.on(NetworkEvent.MATCH_STARTED, (data) => {
            hostStarted = true;
            hostSeed = data.seed;
        });

        clientManager.on(NetworkEvent.MATCH_STARTED, (data) => {
            clientStarted = true;
            clientSeed = data.seed;
        });

        const startSuccess = await hostManager.startMatch();
        assert(startSuccess, 'Host issued startMatch request');

        // Wait for match_start broadcast
        await new Promise(resolve => setTimeout(resolve, 150));

        assert(hostStarted, 'Host received MATCH_STARTED event');
        assert(clientStarted, 'Client received MATCH_STARTED event');
        assert(hostSeed === 424242 && clientSeed === 424242, 'Both peers initialized with identical match seed (424242)');

        // Test seeded RNG determinism across peers
        const hostRng = new SeededRandom(hostSeed);
        const clientRng = new SeededRandom(clientSeed);
        let rngMatched = true;
        for (let i = 0; i < 50; i++) {
            if (hostRng.next() !== clientRng.next()) {
                rngMatched = false;
                break;
            }
        }
        assert(rngMatched, 'Deterministic PRNG produces identical sequence on both peers');

        // 7. Bi-directional GameCommand Transmission & CommandQueue
        console.log('\n--- Step 7: Bi-directional Command Relay & Queue Ordering ---');
        let hostReceivedCommands: GameCommand[] = [];
        let clientReceivedCommands: GameCommand[] = [];

        hostManager.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            hostReceivedCommands.push(data.command);
        });

        clientManager.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            clientReceivedCommands.push(data.command);
        });

        // Host sends a unit move command for tick 0
        hostManager.sendCommand('unit_move', { unitId: 101, targetX: 500, targetY: 300 });

        // Client sends a mirror rotation command for tick 0
        clientManager.sendCommand('mirror_rotate', { mirrorIndex: 2, angle: 1.57 });

        // Wait for batch flush and network relay (~50ms)
        await new Promise(resolve => setTimeout(resolve, 80));

        assert(clientReceivedCommands.length === 1, 'Client received command from host', JSON.stringify(clientReceivedCommands));
        assert(hostReceivedCommands.length === 1, 'Host received command from client', JSON.stringify(hostReceivedCommands));

        // Advance simulation tick on both peers
        const hostTick0Commands = hostManager.getNextTickCommands();
        const clientTick0Commands = clientManager.getNextTickCommands();

        assert(hostTick0Commands !== null && hostTick0Commands.length === 2, 'Host command queue has all 2 commands for tick 0');
        assert(clientTick0Commands !== null && clientTick0Commands.length === 2, 'Client command queue has all 2 commands for tick 0');

        hostManager.advanceTick();
        clientManager.advanceTick();

        assert(hostManager.getCurrentTick() === 1, 'Host simulation tick advanced to 1');
        assert(clientManager.getCurrentTick() === 1, 'Client simulation tick advanced to 1');

        // 8. State Hash Submission & Desync Verification
        console.log('\n--- Step 8: State Hash Relay & Desync Detection ---');
        let desyncDetected = false;
        hostManager.on(NetworkEvent.DESYNC_DETECTED, () => {
            desyncDetected = true;
        });
        clientManager.on(NetworkEvent.DESYNC_DETECTED, () => {
            desyncDetected = true;
        });

        // Both peers submit identical state hash for tick 1
        const STATE_HASH_TICK_1 = 987654321;
        hostManager.submitStateHash(STATE_HASH_TICK_1);
        clientManager.submitStateHash(STATE_HASH_TICK_1);

        await new Promise(resolve => setTimeout(resolve, 80));
        assert(!desyncDetected, 'No desync detected when state hashes match');

        // 9. Malformed & Unauthorized Command Rejection Tests (Issue 3)
        console.log('\n--- Step 9: Malformed & Unauthorized Command Rejection ---');
        const clientRawRoom = clientManager.getRoom();
        assert(clientRawRoom !== null, 'Client raw room connection available');

        let hostReceivedAfterMalformed = 0;
        hostReceivedCommands = [];

        // Test 9a: Missing / empty playerId
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: 1,
            playerId: '',
            commandType: 'test_attack',
            payload: { target: 1 }
        });

        // Test 9b: Unauthorized playerId (Client spoofing Host's playerId)
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: 1,
            playerId: hostPlayerId, // Spoofed!
            commandType: 'spoofed_surrender',
            payload: {}
        });

        // Test 9c: Negative / invalid tick
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: -5,
            playerId: clientPlayerId,
            commandType: 'invalid_tick_action',
            payload: {}
        });
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: NaN,
            playerId: clientPlayerId,
            commandType: 'nan_tick_action',
            payload: {}
        });

        // Test 9d: Malformed commandType (empty or non-string)
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: 1,
            playerId: clientPlayerId,
            commandType: '',
            payload: {}
        });

        // Test 9e: Oversized payload (> 4096 bytes)
        const hugePayload = 'X'.repeat(6000);
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: 1,
            playerId: clientPlayerId,
            commandType: 'oversized_command',
            payload: { bigData: hugePayload }
        });

        // Test 9f: Malformed command batch (non-array, invalid commands, oversized batch)
        clientRawRoom!.send(ProtocolMessage.COMMAND_BATCH, {
            from: clientPlayerId,
            commands: 'not-an-array'
        });
        clientRawRoom!.send(ProtocolMessage.COMMAND_BATCH, {
            from: clientPlayerId,
            commands: [
                { tick: -1, playerId: clientPlayerId, commandType: 'bad_batch_cmd' },
                { tick: 1, playerId: hostPlayerId, commandType: 'spoofed_batch_cmd' }
            ]
        });

        // Wait for all invalid messages to reach server and be filtered out
        await new Promise(resolve => setTimeout(resolve, 120));

        assert(hostReceivedCommands.length === 0, 'All malformed & spoofed commands rejected by server without relaying');

        // Test 9g: Resiliency check - immediately send a valid command
        console.log('\n--- Step 10: Resiliency Check - Valid Command Succeeds After Malformed Traffic ---');
        clientRawRoom!.send(ProtocolMessage.COMMAND, {
            tick: 1,
            playerId: clientPlayerId,
            commandType: 'legitimate_ability',
            payload: { abilityId: 42 }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        assert(hostReceivedCommands.length === 1, 'Valid command delivered successfully to host');
        assert(hostReceivedCommands[0]?.commandType === 'legitimate_ability', 'Delivered command matches expected legitimate payload');

        // 11. Reconnection within Grace Window Tests (Issue 1)
        console.log('\n--- Step 11: Reconnection within Grace Window ---');
        // Teardown first match cleanly
        await hostManager.disconnect();
        await clientManager.disconnect();

        // Create a new match specifically for reconnection test
        const hostReconnectId = 'reconnect-host-' + Math.random().toString(36).substring(2, 8);
        const clientReconnectId = 'reconnect-client-' + Math.random().toString(36).substring(2, 8);

        const host2 = new MultiplayerNetworkManager(SERVER_URL, hostReconnectId);
        const client2 = new MultiplayerNetworkManager(SERVER_URL, clientReconnectId);

        const match2 = await host2.createMatch({
            matchName: 'Reconnection Test Match',
            username: 'PersistentHost',
            maxPlayers: 2,
            tickRate: 30,
            gameSeed: 777888
        });

        assert(match2 !== null, 'Reconnection test match created');
        const join2 = await client2.joinMatch(match2!.matchCode, 'DroppingClient');
        assert(join2, 'Client joined reconnection test match');

        await host2.startMatch();
        await new Promise(resolve => setTimeout(resolve, 150));

        const originalClientRoom = client2.getRoom();
        assert(originalClientRoom !== null, 'Client room is active before drop');
        const reconnectionToken = originalClientRoom!.reconnectionToken;
        assert(typeof reconnectionToken === 'string' && reconnectionToken.length > 0, 'Client possesses valid reconnectionToken');

        // Simulate unexpected connection loss (dropping connection without sending leave)
        console.log('  -> Simulating unexpected connection drop on client...');
        originalClientRoom!.connection.close();

        // Wait a short moment for server onDrop to fire
        await new Promise(resolve => setTimeout(resolve, 150));

        // Attempt reconnection using the token
        console.log('  -> Reconnecting using token within grace window...');
        const reconnectSuccess = await client2.reconnectMatch(reconnectionToken);
        assert(reconnectSuccess, 'Client reconnected successfully within grace window');

        const reconnectedRoom = client2.getRoom();
        assert(reconnectedRoom !== null, 'Client has active reconnected room');
        assert(client2.isInMatch(), 'Client state reflects active match after reconnection');

        // Verify multiplayer communication continues normally after reconnection
        let hostSawPostReconnectCmd = false;
        let clientSawPostReconnectCmd = false;

        host2.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            if (data.command.commandType === 'post_reconnect_from_client') {
                hostSawPostReconnectCmd = true;
            }
        });

        client2.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            if (data.command.commandType === 'post_reconnect_from_host') {
                clientSawPostReconnectCmd = true;
            }
        });

        // Host sends command to client
        host2.sendCommand('post_reconnect_from_host', { message: 'Welcome back!' });
        // Reconnected client sends command to host
        client2.sendCommand('post_reconnect_from_client', { message: 'I am back!' });

        await new Promise(resolve => setTimeout(resolve, 120));

        assert(clientSawPostReconnectCmd, 'Reconnected client received command from host');
        assert(hostSawPostReconnectCmd, 'Host received command from reconnected client');

        // Clean match teardown
        await host2.disconnect();
        await client2.disconnect();

    } catch (error) {
        console.error('Test execution error:', error);
        assert(false, 'Exception occurred during test execution', String(error));
    } finally {
        if (serverInstance) {
            try {
                if (serverInstance.transport?.shutdown) {
                    await serverInstance.transport.shutdown();
                } else if (serverInstance.transport?.server?.close) {
                    await new Promise<void>((resolve) => serverInstance.transport.server.close(() => resolve()));
                }
            } catch {
                // Ignore shutdown errors in test
            }
            console.log('\n[SoL Server] Test server shut down cleanly.');
        }
    }

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log(`║  Test Results: ${passedTests}/${totalTests} Passed                       ║`);
    console.log('╚════════════════════════════════════════════════════╝\n');

    if (passedTests === totalTests) {
        console.log('🎉 ALL COLYSEUS MULTIPLAYER TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.error('❌ SOME TESTS FAILED!\n');
        process.exit(1);
    }
}

runTests();
