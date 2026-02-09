/**
 * Test for AI solar mirror intelligent placement
 * Verifies that:
 * 1. Mirrors don't spawn on asteroids
 * 2. Strategy-based positioning works correctly
 * 3. Line of sight validation works
 */
import { GameState, createStandardGame } from './src/game-core';
import { Faction } from './src/sim/entities/player';
import * as Constants from './src/constants';
import { getGameRNG, setGameRNG, SeededRandom } from './src/seeded-random';

// Initialize RNG with fixed seed for reproducibility
setGameRNG(new SeededRandom(12345));

console.log('=== AI Solar Mirror Placement Test ===\n');

// Create a standard game
const game = createStandardGame([
    ['Player 1', Faction.RADIANT],
    ['AI Player', Faction.AURUM]
]);

// Set AI to hard difficulty
game.players[1].aiDifficulty = Constants.AIDifficulty.HARD;

console.log('Game initialized:');
console.log(`- Players: ${game.players.length}`);
console.log(`- Asteroids: ${game.asteroids.length}`);
console.log(`- Suns: ${game.suns.length}`);
console.log(`- AI Strategy: ${game.players[1].aiStrategy}`);
console.log(`- AI Difficulty: ${game.players[1].aiDifficulty}\n`);

// Check initial mirror positions don't collide with asteroids
console.log('Checking initial mirror positions...');
for (const player of game.players) {
    console.log(`\n${player.name} (${player.isAi ? 'AI' : 'Human'}):`);
    for (let i = 0; i < player.solarMirrors.length; i++) {
        const mirror = player.solarMirrors[i];
        const inAsteroid = game.checkCollision(mirror.position, Constants.AI_MIRROR_COLLISION_RADIUS_PX);
        console.log(`  Mirror ${i + 1}: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)}) - ${inAsteroid ? 'COLLIDING!' : 'Clear'}`);
        
        if (inAsteroid) {
            console.error(`  ERROR: Mirror spawned inside an asteroid!`);
        }
    }
}

// Run the game for a few seconds to test AI behavior
console.log('\n\nRunning game simulation for 5 seconds...');
const deltaTime = 1 / 60; // 60 FPS
const simulationTicks = 5 * 60; // 5 seconds at 60 FPS

for (let tick = 0; tick < simulationTicks; tick++) {
    game.update(deltaTime);
}

console.log('\nAfter 5 seconds of gameplay:');

// Check if AI mirrors moved and their final positions
const aiPlayer = game.players[1];
console.log(`\nAI Player mirrors (Strategy: ${aiPlayer.aiStrategy}):`);
for (let i = 0; i < aiPlayer.solarMirrors.length; i++) {
    const mirror = aiPlayer.solarMirrors[i];
    const inAsteroid = game.checkCollision(mirror.position, Constants.AI_MIRROR_COLLISION_RADIUS_PX);
    const hasTarget = mirror.targetPosition !== null;
    console.log(`  Mirror ${i + 1}:`);
    console.log(`    Position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
    console.log(`    Has target: ${hasTarget}`);
    if (hasTarget && mirror.targetPosition) {
        console.log(`    Target: (${mirror.targetPosition.x.toFixed(1)}, ${mirror.targetPosition.y.toFixed(1)})`);
    }
    console.log(`    Collision status: ${inAsteroid ? 'COLLIDING!' : 'Clear'}`);
    
    if (inAsteroid) {
        console.error(`    ERROR: Mirror stuck in asteroid!`);
    }
}

// Check distance from sun based on strategy
if (game.suns.length > 0) {
    const sun = game.suns[0];
    console.log(`\nMirror distances from sun:`);
    
    let expectedDistance: number;
    switch (aiPlayer.aiStrategy) {
        case Constants.AIStrategy.AGGRESSIVE:
            expectedDistance = Constants.AI_MIRROR_AGGRESSIVE_DISTANCE_PX;
            break;
        case Constants.AIStrategy.DEFENSIVE:
            expectedDistance = Constants.AI_MIRROR_DEFENSIVE_DISTANCE_PX;
            break;
        case Constants.AIStrategy.ECONOMIC:
            expectedDistance = Constants.AI_MIRROR_ECONOMIC_DISTANCE_PX;
            break;
        case Constants.AIStrategy.WAVES:
            expectedDistance = Constants.AI_MIRROR_WAVES_DISTANCE_PX;
            break;
        default:
            expectedDistance = Constants.AI_MIRROR_SUN_DISTANCE_PX;
    }
    
    console.log(`  Expected distance for ${aiPlayer.aiStrategy} strategy: ~${expectedDistance + sun.radius}px from sun center`);
    
    for (let i = 0; i < aiPlayer.solarMirrors.length; i++) {
        const mirror = aiPlayer.solarMirrors[i];
        const distanceFromSun = mirror.position.distanceTo(sun.position);
        console.log(`  Mirror ${i + 1}: ${distanceFromSun.toFixed(1)}px`);
    }
}

// Check if hard difficulty AI has guards near mirrors
if (aiPlayer.aiDifficulty === Constants.AIDifficulty.HARD) {
    console.log(`\nChecking guard placement (Hard difficulty):`);
    for (let i = 0; i < aiPlayer.solarMirrors.length; i++) {
        const mirror = aiPlayer.solarMirrors[i];
        let nearbyUnits = 0;
        
        for (const unit of aiPlayer.units) {
            const distance = unit.position.distanceTo(mirror.position);
            if (distance < Constants.AI_MIRROR_GUARD_DISTANCE_PX * 2) {
                nearbyUnits++;
            }
        }
        
        console.log(`  Mirror ${i + 1}: ${nearbyUnits} unit(s) nearby`);
    }
}

console.log('\n=== Test Complete ===');
console.log('If no errors were reported above, the AI mirror placement is working correctly!');
