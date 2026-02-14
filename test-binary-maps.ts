/**
 * Test script for binary sun maps and improved asteroid collision detection
 */

import { GameState, createStandardGame } from './src/sim/game-state';
import { Sun } from './src/sim/entities/sun';
import { Vector2D } from './src/sim/math';
import { Faction } from './src/sim/entities/player';
import { setGameRNG, SeededRandom } from './src/seeded-random';

// Test 1: Verify Sun orbital mechanics
console.log('\n=== Test 1: Sun Orbital Mechanics ===');
const orbitCenter = new Vector2D(0, 0);
const orbitRadius = 150;
const orbitSpeed = 0.05;

const sun1 = new Sun(
    new Vector2D(0, 0), 1.0, 100.0, 'normal',
    orbitCenter, orbitRadius, orbitSpeed, 0
);

const sun2 = new Sun(
    new Vector2D(0, 0), 1.0, 100.0, 'normal',
    orbitCenter, orbitRadius, orbitSpeed, Math.PI
);

console.log('Sun 1 initial position:', sun1.position);
console.log('Sun 2 initial position:', sun2.position);

// Check that suns are on opposite sides
const distance = Math.sqrt(
    Math.pow(sun1.position.x - sun2.position.x, 2) +
    Math.pow(sun1.position.y - sun2.position.y, 2)
);
console.log('Distance between suns (should be ~300):', distance);

if (Math.abs(distance - 300) < 1) {
    console.log('✓ Suns are correctly positioned on opposite sides of orbit');
} else {
    console.log('✗ ERROR: Suns are not correctly positioned');
}

// Update for 1 second
sun1.update(1.0);
sun2.update(1.0);

console.log('Sun 1 position after 1s:', sun1.position);
console.log('Sun 2 position after 1s:', sun2.position);

// Check that suns have moved
const sun1Moved = Math.abs(sun1.position.x - 150) > 0.1 || Math.abs(sun1.position.y) > 0.1;
const sun2Moved = Math.abs(sun2.position.x + 150) > 0.1 || Math.abs(sun2.position.y) > 0.1;

if (sun1Moved && sun2Moved) {
    console.log('✓ Suns are orbiting correctly');
} else {
    console.log('✗ ERROR: Suns did not move as expected');
}

// Test 2: Verify asteroid collision detection
console.log('\n=== Test 2: Asteroid Collision Detection ===');
setGameRNG(new SeededRandom(12345));
const game = createStandardGame([['Player 1', Faction.AURUM], ['Player 2', Faction.VELARIS]]);

console.log('Number of asteroids created:', game.asteroids.length);

// Check that no asteroids overlap
let overlaps = 0;
for (let i = 0; i < game.asteroids.length; i++) {
    for (let j = i + 1; j < game.asteroids.length; j++) {
        const a1 = game.asteroids[i];
        const a2 = game.asteroids[j];
        const dx = a1.position.x - a2.position.x;
        const dy = a1.position.y - a2.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius1 = a1.size * 1.32;
        const maxRadius2 = a2.size * 1.32;
        const requiredGap = maxRadius1 + maxRadius2;
        
        if (dist < requiredGap) {
            overlaps++;
            console.log(`✗ Asteroids ${i} and ${j} overlap! Distance: ${dist}, Required: ${requiredGap}`);
        }
    }
}

if (overlaps === 0) {
    console.log('✓ No asteroid overlaps detected');
} else {
    console.log(`✗ ERROR: Found ${overlaps} asteroid overlaps`);
}

// Test 3: Verify exclusion zones around player bases
console.log('\n=== Test 3: Base Exclusion Zones ===');
const exclusionRadius = 250;
let violationsFound = 0;

for (const player of game.players) {
    if (!player.stellarForge) continue;
    
    const basePos = player.stellarForge.position;
    console.log(`\nChecking ${player.name} base at (${basePos.x.toFixed(0)}, ${basePos.y.toFixed(0)})`);
    
    for (let i = 0; i < game.asteroids.length; i++) {
        const asteroid = game.asteroids[i];
        const dx = asteroid.position.x - basePos.x;
        const dy = asteroid.position.y - basePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = asteroid.size * 1.32;
        const requiredDist = exclusionRadius + maxRadius;
        
        if (dist < requiredDist) {
            violationsFound++;
            console.log(`  ✗ Asteroid ${i} too close! Distance: ${dist.toFixed(1)}, Required: ${requiredDist.toFixed(1)}`);
        }
    }
}

if (violationsFound === 0) {
    console.log('✓ All asteroids respect base exclusion zones');
} else {
    console.log(`✗ ERROR: Found ${violationsFound} exclusion zone violations`);
}

// Test 4: Verify game state updates suns
console.log('\n=== Test 4: Game State Sun Updates ===');
setGameRNG(new SeededRandom(54321));
const testGame = new GameState();
testGame.suns.push(new Sun(
    new Vector2D(0, 0), 1.0, 100.0, 'normal',
    new Vector2D(0, 0), 100, 0.1, 0
));

const initialX = testGame.suns[0].position.x;
const initialY = testGame.suns[0].position.y;

// Run game update for a few steps
for (let i = 0; i < 10; i++) {
    testGame.update(0.1); // 0.1 second per step
}

const finalX = testGame.suns[0].position.x;
const finalY = testGame.suns[0].position.y;

const moved = Math.abs(finalX - initialX) > 1 || Math.abs(finalY - initialY) > 1;

console.log(`Initial sun position: (${initialX.toFixed(2)}, ${initialY.toFixed(2)})`);
console.log(`Final sun position: (${finalX.toFixed(2)}, ${finalY.toFixed(2)})`);

if (moved) {
    console.log('✓ Game state correctly updates sun positions');
} else {
    console.log('✗ ERROR: Sun did not move during game updates');
}

console.log('\n=== Test Complete ===\n');
