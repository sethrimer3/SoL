/**
 * Test for asteroid rotation knockback feature.
 * This test verifies that units and solar mirrors get knocked away
 * when asteroids rotate and collide with them, rather than getting stuck.
 */
import { GameState, Player, Vector2D, Faction, Marine } from './src/game-core';
import { Asteroid } from './src/sim/entities/asteroid';
import * as Constants from './src/constants';
import { setGameRNG, SeededRandom } from './src/seeded-random';

// Initialize game RNG
setGameRNG(new SeededRandom(12345));

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
game.initializePlayer(player2, new Vector2D(400, 0), []);

// Create an asteroid with rotation speed at position (0, 0)
const asteroid = new Asteroid(new Vector2D(0, 0), 8, 60);
// Give it a noticeable rotation speed
asteroid.rotationSpeed = 0.5; // radians per second
game.asteroids.push(asteroid);

// Place a unit and a mirror close to the edge of the asteroid
// They will be inside the asteroid after rotation
const unitPos = new Vector2D(55, 0); // Just outside the asteroid initially
const unit = new Marine(unitPos, player1);
player1.units.push(unit);

const mirrorPos = new Vector2D(0, 55); // Just outside the asteroid initially
const mirror = player1.solarMirrors[0];
mirror.position = mirrorPos;

console.log('=== Asteroid Rotation Knockback Test ===');
console.log(`Initial asteroid rotation: ${asteroid.rotation.toFixed(3)} rad`);
console.log(`Initial unit position: (${unit.position.x.toFixed(1)}, ${unit.position.y.toFixed(1)})`);
console.log(`Initial mirror position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`Unit knockback velocity: (${unit.knockbackVelocity.x.toFixed(1)}, ${unit.knockbackVelocity.y.toFixed(1)})`);
console.log(`Mirror knockback velocity: (${mirror.knockbackVelocity.x.toFixed(1)}, ${mirror.knockbackVelocity.y.toFixed(1)})`);

// Run simulation for a few frames to let asteroid rotate
for (let i = 0; i < 10; i++) {
    game.update(1 / 60);
}

console.log('\n--- After 10 ticks (rotation should have occurred) ---');
console.log(`Asteroid rotation: ${asteroid.rotation.toFixed(3)} rad (change: ${(asteroid.rotation).toFixed(3)} rad)`);
console.log(`Unit position: (${unit.position.x.toFixed(1)}, ${unit.position.y.toFixed(1)})`);
console.log(`Mirror position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`Unit knockback velocity: (${unit.knockbackVelocity.x.toFixed(1)}, ${unit.knockbackVelocity.y.toFixed(1)})`);
console.log(`Mirror knockback velocity: (${mirror.knockbackVelocity.x.toFixed(1)}, ${mirror.knockbackVelocity.y.toFixed(1)})`);

// Check that unit and mirror are NOT inside the asteroid
const unitInAsteroid = asteroid.containsPoint(unit.position);
const mirrorInAsteroid = asteroid.containsPoint(mirror.position);

console.log(`\nUnit inside asteroid: ${unitInAsteroid}`);
console.log(`Mirror inside asteroid: ${mirrorInAsteroid}`);

// Continue for more frames to see knockback deceleration
for (let i = 0; i < 30; i++) {
    game.update(1 / 60);
}

console.log('\n--- After 40 total ticks (knockback should be decelerating) ---');
console.log(`Unit position: (${unit.position.x.toFixed(1)}, ${unit.position.y.toFixed(1)})`);
console.log(`Mirror position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`Unit knockback velocity: (${unit.knockbackVelocity.x.toFixed(1)}, ${unit.knockbackVelocity.y.toFixed(1)})`);
console.log(`Mirror knockback velocity: (${mirror.knockbackVelocity.x.toFixed(1)}, ${mirror.knockbackVelocity.y.toFixed(1)})`);

// Validation
if (!unitInAsteroid && !mirrorInAsteroid) {
    console.log('\n✅ TEST PASSED: Units and mirrors are not stuck inside rotating asteroids');
} else {
    console.log('\n❌ TEST FAILED: Units or mirrors are still inside asteroids');
}
