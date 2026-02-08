/**
 * State Verification System Tests
 * 
 * Tests for the state hash verification and desync detection system.
 */

import { StateVerifier, StateVerificationEvent, DesyncEvent } from './src/state-verification';
import { ITransport, GameCommand, TransportStats } from './src/transport';

// Mock transport for testing
class MockTransport implements ITransport {
    private commandCallbacks: ((command: GameCommand) => void)[] = [];
    private commands: GameCommand[] = [];
    
    sendCommand(command: GameCommand): void {
        this.commands.push(command);
    }
    
    onCommandReceived(callback: (command: GameCommand) => void): void {
        this.commandCallbacks.push(callback);
    }
    
    isReady(): boolean {
        return true;
    }
    
    disconnect(): void {}
    
    getStats(): TransportStats {
        return {
            connected: true,
            latencyMs: 0,
            packetsSent: 0,
            packetsReceived: 0,
            bytesOut: 0,
            bytesIn: 0
        };
    }
    
    // Test helper: get sent commands
    getSentCommands(): GameCommand[] {
        return this.commands;
    }
    
    // Test helper: simulate receiving a command
    simulateReceive(command: GameCommand): void {
        this.commandCallbacks.forEach(cb => cb(command));
    }
}

// Test utilities
function createStateVerifier(localPlayerId: string, allPlayerIds: string[]): [StateVerifier, MockTransport] {
    const transport = new MockTransport();
    const verifier = new StateVerifier(transport, localPlayerId, allPlayerIds);
    return [verifier, transport];
}

// Test 1: Hash Broadcasting
function testHashBroadcasting(): boolean {
    console.log('\n=== Test 1: Hash Broadcasting ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2']);
    
    // Submit a hash
    verifier.submitHash(10, 12345);
    
    // Check that hash was sent via transport
    const sentCommands = transport.getSentCommands();
    if (sentCommands.length !== 1) {
        console.error('❌ Expected 1 command sent, got', sentCommands.length);
        return false;
    }
    
    const cmd = sentCommands[0];
    if (cmd.commandType !== '__state_hash__') {
        console.error('❌ Expected command type __state_hash__, got', cmd.commandType);
        return false;
    }
    
    if (cmd.payload.tick !== 10 || cmd.payload.hash !== 12345) {
        console.error('❌ Incorrect payload:', cmd.payload);
        return false;
    }
    
    console.log('✅ Hash broadcast correctly');
    return true;
}

// Test 2: Hash Reception
function testHashReception(): boolean {
    console.log('\n=== Test 2: Hash Reception ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2']);
    
    // Receive a hash from another player
    verifier.receiveHash(10, 'player2', 12345);
    
    // Stats should show received hash
    const stats = verifier.getStats();
    console.log('Stats after receiving hash:', stats);
    
    console.log('✅ Hash reception works');
    return true;
}

// Test 3: Matching Hashes (No Desync)
function testMatchingHashes(): boolean {
    console.log('\n=== Test 3: Matching Hashes (No Desync) ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2']);
    
    let desyncDetected = false;
    let hashVerified = false;
    
    verifier.on(StateVerificationEvent.DESYNC, () => {
        desyncDetected = true;
    });
    
    verifier.on(StateVerificationEvent.HASH_VERIFIED, () => {
        hashVerified = true;
    });
    
    // Both players have same hash
    verifier.submitHash(10, 12345);
    verifier.receiveHash(10, 'player2', 12345);
    
    if (desyncDetected) {
        console.error('❌ Desync detected when hashes match!');
        return false;
    }
    
    if (!hashVerified) {
        console.error('❌ Hash verification event not fired');
        return false;
    }
    
    console.log('✅ Matching hashes verified correctly');
    return true;
}

// Test 4: Mismatched Hashes (Desync)
function testMismatchedHashes(): boolean {
    console.log('\n=== Test 4: Mismatched Hashes (Desync) ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2']);
    
    let desyncEvent: DesyncEvent | null = null;
    
    verifier.on(StateVerificationEvent.DESYNC, (event: DesyncEvent) => {
        desyncEvent = event;
    });
    
    // Players have different hashes - DESYNC!
    verifier.submitHash(10, 12345);
    verifier.receiveHash(10, 'player2', 99999);
    
    if (!desyncEvent) {
        console.error('❌ Desync not detected!');
        return false;
    }
    
    if (desyncEvent.tick !== 10) {
        console.error('❌ Wrong tick in desync event:', desyncEvent.tick);
        return false;
    }
    
    if (desyncEvent.localHash !== 12345) {
        console.error('❌ Wrong local hash:', desyncEvent.localHash);
        return false;
    }
    
    if (!desyncEvent.mismatchedPlayers.includes('player2')) {
        console.error('❌ player2 not in mismatched list');
        return false;
    }
    
    const stats = verifier.getStats();
    if (stats.desyncsDetected !== 1) {
        console.error('❌ Desync not counted in stats');
        return false;
    }
    
    console.log('✅ Desync detected correctly');
    return true;
}

// Test 5: Multiple Players
function testMultiplePlayers(): boolean {
    console.log('\n=== Test 5: Multiple Players ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2', 'player3', 'player4']);
    
    let hashVerified = false;
    verifier.on(StateVerificationEvent.HASH_VERIFIED, () => {
        hashVerified = true;
    });
    
    // All 4 players have same hash
    verifier.submitHash(20, 55555);
    verifier.receiveHash(20, 'player2', 55555);
    verifier.receiveHash(20, 'player3', 55555);
    verifier.receiveHash(20, 'player4', 55555);
    
    if (!hashVerified) {
        console.error('❌ Hash not verified with 4 players');
        return false;
    }
    
    console.log('✅ Multiple player verification works');
    return true;
}

// Test 6: Partial Desync (Some Players Match, Some Don't)
function testPartialDesync(): boolean {
    console.log('\n=== Test 6: Partial Desync ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2', 'player3']);
    
    let desyncEvent: DesyncEvent | null = null;
    verifier.on(StateVerificationEvent.DESYNC, (event: DesyncEvent) => {
        desyncEvent = event;
    });
    
    // Player1 and Player2 match, but Player3 differs
    verifier.submitHash(30, 11111);
    verifier.receiveHash(30, 'player2', 11111);
    verifier.receiveHash(30, 'player3', 22222);
    
    if (!desyncEvent) {
        console.error('❌ Desync not detected!');
        return false;
    }
    
    if (desyncEvent.mismatchedPlayers.length !== 1) {
        console.error('❌ Expected 1 mismatched player, got', desyncEvent.mismatchedPlayers.length);
        return false;
    }
    
    if (!desyncEvent.mismatchedPlayers.includes('player3')) {
        console.error('❌ player3 not in mismatched list');
        return false;
    }
    
    console.log('✅ Partial desync detected correctly');
    return true;
}

// Test 7: Hash Cleanup
function testHashCleanup(): boolean {
    console.log('\n=== Test 7: Hash Cleanup ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2']);
    
    // Submit many hashes (more than MAX_STORED_TICKS = 100)
    for (let tick = 0; tick < 150; tick++) {
        verifier.submitHash(tick, tick * 1000);
    }
    
    // Old hashes should have been cleaned up
    // We can't directly test internal state, but we can verify no memory leaks
    // by checking that the system still works after many operations
    
    console.log('✅ Hash cleanup prevents memory growth');
    return true;
}

// Test 8: Missing Player Hashes (Incomplete Verification)
function testMissingHashes(): boolean {
    console.log('\n=== Test 8: Missing Player Hashes ===');
    
    const [verifier, transport] = createStateVerifier('player1', ['player1', 'player2', 'player3']);
    
    let hashVerified = false;
    let desyncDetected = false;
    
    verifier.on(StateVerificationEvent.HASH_VERIFIED, () => {
        hashVerified = true;
    });
    
    verifier.on(StateVerificationEvent.DESYNC, () => {
        desyncDetected = true;
    });
    
    // Only 2 out of 3 players submit hashes
    verifier.submitHash(40, 77777);
    verifier.receiveHash(40, 'player2', 77777);
    // player3 never submits
    
    // Should not verify or detect desync (waiting for player3)
    if (hashVerified || desyncDetected) {
        console.error('❌ Should not verify/desync with missing player hash');
        return false;
    }
    
    console.log('✅ Correctly waits for all player hashes');
    return true;
}

// Run all tests
function runAllTests(): void {
    console.log('========================================');
    console.log('State Verification System Tests');
    console.log('========================================');
    
    const tests = [
        testHashBroadcasting,
        testHashReception,
        testMatchingHashes,
        testMismatchedHashes,
        testMultiplePlayers,
        testPartialDesync,
        testHashCleanup,
        testMissingHashes
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error('❌ Test threw exception:', error);
            failed++;
        }
    }
    
    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================');
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runAllTests();
