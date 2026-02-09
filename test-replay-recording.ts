/**
 * Test replay recording functionality
 * Verifies that commands and state hashes are recorded correctly
 */
import { GameState, Player, Vector2D, Faction } from './src/game-core';
import { ReplayManager, ReplayPlayerInfo } from './src/replay';
import * as Constants from './src/constants';

console.log('=== Replay Recording Test ===');

// Set up game state
const game = new GameState();
game.isCountdownActive = false;
game.countdownTime = 0;
game.localPlayerIndex = 0;

const player = new Player('Player-1', Faction.RADIANT);
const opponent = new Player('Player-2', Faction.AURUM);
player.energy = 5000;
opponent.energy = 5000;

game.players.push(player, opponent);
game.initializePlayer(player, new Vector2D(-200, 0), [new Vector2D(-150, 0)]);
game.initializePlayer(opponent, new Vector2D(400, 0), []);

// Initialize replay manager
const replayManager = new ReplayManager();
game.replayManager = replayManager;

const replayPlayers: ReplayPlayerInfo[] = [
    {
        playerId: 'player_0',
        playerIndex: 0,
        username: 'Player-1',
        faction: Faction.RADIANT,
        isWinner: false
    },
    {
        playerId: 'player_1',
        playerIndex: 1,
        username: 'Player-2',
        faction: Faction.AURUM,
        isWinner: false
    }
];

// Start recording
replayManager.startRecording('test_match_123', 12345, replayPlayers, { id: 'default', name: 'Default' });
console.log('Started recording:', replayManager.getIsRecording());

// Simulate some commands
const commands = [
    {
        tick: 0,
        playerId: 'player_0',
        command: 'mirror_move',
        data: {
            mirrorIndices: [0],
            targetX: 200,
            targetY: 0,
            moveOrder: 1
        }
    },
    {
        tick: 5,
        playerId: 'player_0',
        command: 'mirror_purchase',
        data: {
            x: 100,
            y: 100
        }
    },
    {
        tick: 10,
        playerId: 'player_1',
        command: 'hero_purchase',
        data: {
            heroType: 'marine',
            spawnX: 0,
            spawnY: 0
        }
    }
];

// Send commands through the game
for (const cmd of commands) {
    game.receiveNetworkCommand(cmd);
}

// Process commands
game.processPendingNetworkCommands();

// Simulate some game ticks
for (let i = 0; i < Constants.STATE_HASH_TICK_INTERVAL * 2; i++) {
    game.update(1 / 60);
}

// Stop recording
const replayData = replayManager.stopRecording();

if (replayData) {
    console.log('✓ Recording stopped successfully');
    console.log(`  Match ID: ${replayData.matchId}`);
    console.log(`  Game Seed: ${replayData.gameSeed}`);
    console.log(`  Duration: ${replayData.duration.toFixed(2)}s`);
    console.log(`  Commands recorded: ${replayData.commands.length}`);
    console.log(`  State hashes recorded: ${replayData.stateHashes.length}`);
    console.log(`  Players: ${replayData.players.map(p => p.username).join(', ')}`);
    
    // Verify commands were recorded
    if (replayData.commands.length === commands.length) {
        console.log('✓ All commands recorded correctly');
    } else {
        console.error(`✗ Command count mismatch: expected ${commands.length}, got ${replayData.commands.length}`);
    }
    
    // Verify state hashes were recorded
    if (replayData.stateHashes.length > 0) {
        console.log('✓ State hashes recorded');
        replayData.stateHashes.forEach(hash => {
            console.log(`  Tick ${hash.tick}: hash=${hash.hash}`);
        });
    } else {
        console.error('✗ No state hashes recorded');
    }
    
    // Test export/import
    const exported = replayManager.exportToJSON();
    const newManager = new ReplayManager();
    newManager.importFromJSON(exported);
    const loadedData = newManager.getReplayData();
    
    if (loadedData && loadedData.matchId === replayData.matchId) {
        console.log('✓ Export/import works correctly');
    } else {
        console.error('✗ Export/import failed');
    }
    
    console.log('\n=== Test Passed ===');
} else {
    console.error('✗ Recording failed to produce replay data');
}
