/**
 * Basic test for replay recording and playback functionality
 */
import { GameState, Player, Vector2D, Faction } from './src/game-core';
import { ReplayRecorder, ReplayPlayer, ReplayPlayerInfo, ReplaySpeed } from './src/replay';
import { SeededRandom, setGameRNG } from './src/seeded-random';
import * as Constants from './src/constants';

const originalRandom = Math.random;
// Note: Math.random override not needed since we use setGameRNG

console.log('=== Replay System Test ===\n');

// Step 1: Create a game and record some commands
console.log('1. Setting up game with seed...');
const gameSeed = 12345;
setGameRNG(new SeededRandom(gameSeed));

const game = new GameState();
game.isCountdownActive = false;
game.countdownTime = 0;
game.localPlayerIndex = 0;

const player = new Player('Player-1', Faction.RADIANT);
const opponent = new Player('Player-2', Faction.AURUM);
player.energy = 5000;
opponent.energy = 5000;

game.players.push(player, opponent);
game.initializePlayer(player, new Vector2D(-200, 0), [new Vector2D(-150, 0), new Vector2D(-150, 50)]);
game.initializePlayer(opponent, new Vector2D(200, 0), [new Vector2D(150, 0)]);

// Step 2: Set up replay recorder
console.log('2. Starting replay recorder...');
const players: ReplayPlayerInfo[] = [
    {
        playerId: 'p1',
        playerName: 'Player-1',
        faction: Faction.RADIANT,
        isLocal: true
    },
    {
        playerId: 'p2',
        playerName: 'Player-2',
        faction: Faction.AURUM,
        isLocal: false
    }
];

const mapInfo = {
    forgePositions: [new Vector2D(-200, 0), new Vector2D(200, 0)],
    mirrorPositions: [[new Vector2D(-150, 0), new Vector2D(-150, 50)], [new Vector2D(150, 0)]],
    suns: [new Vector2D(0, 0)]
};

const recorder = new ReplayRecorder(gameSeed, players, 'singleplayer', mapInfo);
recorder.start();

// Step 3: Simulate some gameplay with commands
console.log('3. Simulating gameplay...');
const commands = [
    {
        tick: 0,
        playerId: 'p1',
        command: 'mirror_move',
        data: {
            mirrorIndices: [0],
            targetX: -100,
            targetY: 0,
            moveOrder: 1
        }
    },
    {
        tick: 30,
        playerId: 'p1',
        command: 'mirror_move',
        data: {
            mirrorIndices: [1],
            targetX: -100,
            targetY: 50,
            moveOrder: 2
        }
    },
    {
        tick: 60,
        playerId: 'p1',
        command: 'mirror_link',
        data: {
            mirrorIndex: 0,
            targetType: 'forge'
        }
    }
];

// Record and execute commands
for (const cmd of commands) {
    recorder.recordCommand(cmd);
    game.receiveNetworkCommand(cmd);
}

// Run simulation
for (let tick = 0; tick < 120; tick++) {
    game.processPendingNetworkCommands();
    game.update(1 / 60);
}

const mirror = player.solarMirrors[0];
console.log(`   Mirror 0 position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`   Player energy: ${player.energy.toFixed(0)}`);

// Step 4: Stop recording and get replay data
console.log('4. Stopping recorder...');
const replayData = recorder.stop();
console.log(`   Recorded ${replayData.commands.length} commands`);
console.log(`   Duration: ${replayData.metadata.duration.toFixed(2)}s`);

// Step 5: Replay the recorded game
console.log('5. Playing back replay...');
setGameRNG(new SeededRandom(gameSeed)); // Reset RNG for replay

const replayPlayer = new ReplayPlayer(replayData);
const replayGame = replayPlayer.initializeGame();
replayPlayer.play();

// Simulate replay playback
for (let tick = 0; tick < 120; tick++) {
    replayPlayer.update(1000 / 60); // 60 FPS
}

const replayState = replayPlayer.getState();
console.log(`   Replay progress: ${replayState.currentTime.toFixed(2)}s / ${replayState.totalTime.toFixed(2)}s`);
console.log(`   Replay ticks: ${replayState.currentTick} / ${replayState.totalTicks}`);

// Step 6: Compare final states
const replayMirror = replayGame!.players[0].solarMirrors[0];
console.log('\n6. Comparing results:');
console.log(`   Original mirror position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`   Replay mirror position: (${replayMirror.position.x.toFixed(1)}, ${replayMirror.position.y.toFixed(1)})`);
console.log(`   Original player energy: ${player.energy.toFixed(0)}`);
console.log(`   Replay player energy: ${replayGame!.players[0].energy.toFixed(0)}`);

// Check if positions match (within tolerance)
const posMatch = Math.abs(mirror.position.x - replayMirror.position.x) < 0.1 &&
                 Math.abs(mirror.position.y - replayMirror.position.y) < 0.1;
const energyMatch = Math.abs(player.energy - replayGame!.players[0].energy) < 1;

console.log('\n=== Test Results ===');
console.log(`Position match: ${posMatch ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Energy match: ${energyMatch ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Overall: ${posMatch && energyMatch ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
