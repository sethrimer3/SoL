/**
 * Full-cycle replay test: record a match, save it, then load and verify
 */
import { GameState, Player, Vector2D, Faction } from './src/game-core';
import { ReplayManager, LocalReplayStorage, ReplayPlayerInfo } from './src/replay';
import * as Constants from './src/constants';

console.log('=== Replay Full-Cycle Test ===\n');

// Set up game
const game = new GameState();
game.isCountdownActive = false;
game.countdownTime = 0;
game.localPlayerIndex = 0;

const player1 = new Player('Player-1', Faction.RADIANT);
const player2 = new Player('Player-2', Faction.AURUM);
player1.energy = 5000;
player2.energy = 5000;

game.players.push(player1, player2);
game.initializePlayer(player1, new Vector2D(-200, 0), [new Vector2D(-150, 0)]);
game.initializePlayer(player2, new Vector2D(200, 0), [new Vector2D(150, 0)]);

// Set up replay manager
const replayManager = new ReplayManager();
game.replayManager = replayManager;

const players: ReplayPlayerInfo[] = [
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
const matchId = 'test_match_' + Date.now();
const gameSeed = 12345;
replayManager.startRecording(matchId, gameSeed, players, { mapSize: 2000 });

console.log('Recording started...');
console.log(`Match ID: ${matchId}`);
console.log(`Game Seed: ${gameSeed}`);
console.log(`Players: ${players.map(p => p.username).join(' vs ')}\n`);

// Simulate some game commands
const testCommands = [
    {
        tick: 10,
        playerId: 'player_0',
        command: 'mirror_move',
        data: {
            mirrorIndices: [0],
            targetX: -100,
            targetY: 50,
            moveOrder: 1
        }
    },
    {
        tick: 50,
        playerId: 'player_1',
        command: 'mirror_move',
        data: {
            mirrorIndices: [0],
            targetX: 100,
            targetY: -50,
            moveOrder: 2
        }
    },
    {
        tick: 100,
        playerId: 'player_0',
        command: 'hero_purchase',
        data: {
            heroId: 'radiant-marine'
        }
    }
];

// Record commands
for (const cmd of testCommands) {
    replayManager.recordCommand(cmd);
}

console.log(`Recorded ${testCommands.length} commands`);

// Simulate game progression and record state hashes
let tick = 0;
for (let i = 0; i < 120; i++) {
    game.update(1 / 60);
    
    // Record state hash at intervals
    if (tick % Constants.STATE_HASH_TICK_INTERVAL === 0) {
        replayManager.recordStateHash(tick, game.stateHash);
    }
    
    tick++;
}

console.log(`Simulated ${tick} ticks\n`);

// Mark winner and stop recording
players[0].isWinner = true;
const replayData = replayManager.stopRecording();

if (replayData) {
    console.log('Recording stopped successfully');
    console.log(`Duration: ${replayData.duration.toFixed(2)}s`);
    console.log(`Commands recorded: ${replayData.commands.length}`);
    console.log(`State hashes: ${replayData.stateHashes.length}\n`);
    
    // Test saving to storage
    const storage = new LocalReplayStorage();
    
    console.log('Saving replay to localStorage...');
    storage.saveReplay(replayData).then(() => {
        console.log('✓ Replay saved successfully\n');
        
        // Test loading replays
        return storage.listReplays();
    }).then((replays) => {
        console.log(`✓ Found ${replays.length} replay(s) in storage`);
        
        if (replays.length > 0) {
            const lastReplay = replays[replays.length - 1];
            console.log(`  Latest replay: ${lastReplay.id}`);
            console.log(`  Players: ${lastReplay.players.map(p => p.username).join(' vs ')}`);
            console.log(`  Winner: ${lastReplay.players.find(p => p.isWinner)?.username || 'None'}`);
            console.log(`  Commands: ${lastReplay.commands.length}`);
            console.log(`  State hashes: ${lastReplay.stateHashes.length}\n`);
            
            // Test loading specific replay
            return storage.loadReplay(lastReplay.id);
        }
        return null;
    }).then((loadedReplay) => {
        if (loadedReplay) {
            console.log('✓ Replay loaded successfully');
            console.log(`  Match ID: ${loadedReplay.matchId}`);
            console.log(`  Game seed: ${loadedReplay.gameSeed}`);
            
            // Test replay manager loading
            const playbackManager = new ReplayManager();
            playbackManager.loadReplay(loadedReplay);
            
            console.log('\n✓ Replay loaded into playback manager');
            console.log(`  Total commands: ${playbackManager.getTotalCommands()}`);
            console.log(`  Playback state: ${playbackManager.getPlaybackState()}`);
            
            // Test getting commands for specific ticks
            const commands10 = playbackManager.getCommandsForTick(10);
            const commands50 = playbackManager.getCommandsForTick(50);
            const commands100 = playbackManager.getCommandsForTick(100);
            
            console.log(`\n  Commands at tick 10: ${commands10.length}`);
            console.log(`  Commands at tick 50: ${commands50.length}`);
            console.log(`  Commands at tick 100: ${commands100.length}`);
            
            // Test export to JSON
            const json = playbackManager.exportToJSON();
            console.log(`\n✓ Exported to JSON (${json.length} bytes)`);
            
            // Test import from JSON
            const reimportManager = new ReplayManager();
            reimportManager.importFromJSON(json);
            console.log('✓ Re-imported from JSON');
            console.log(`  Commands: ${reimportManager.getTotalCommands()}`);
            
            console.log('\n=== All Tests Passed ===');
        }
    }).catch((err) => {
        console.error('❌ Test failed:', err);
    });
} else {
    console.error('❌ Failed to stop recording');
}
