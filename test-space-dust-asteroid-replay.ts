/**
 * Deterministic replay snippet for space dust vs rotating asteroid collision response.
 * Command list: none (pure simulation step verification)
 */
import { GameState, Vector2D } from './src/game-core';
import { Asteroid } from './src/sim/entities/asteroid';
import { SpaceDustParticle } from './src/sim/entities/particles';
import * as Constants from './src/constants';
import { SeededRandom, setGameRNG } from './src/seeded-random';

const originalRandom = Math.random;
Math.random = () => 0.314159;

setGameRNG(new SeededRandom(123456));

const game = new GameState();
game.isCountdownActive = false;
game.countdownTime = 0;

const asteroid = new Asteroid(new Vector2D(0, 0), 12, 40);
asteroid.rotationSpeed = 0.9;
game.asteroids = [asteroid];

const particle = new SpaceDustParticle(
    new Vector2D(30, 0),
    new Vector2D(-15, 0)
);
game.spaceDust = [particle];

for (let i = 0; i < Constants.STATE_HASH_TICK_INTERVAL; i++) {
    game.update(1 / 60);
}

console.log('=== Space Dust Asteroid Collision Replay ===');
console.log(`Dust position: (${particle.position.x.toFixed(2)}, ${particle.position.y.toFixed(2)})`);
console.log(`Dust velocity: (${particle.velocity.x.toFixed(2)}, ${particle.velocity.y.toFixed(2)})`);
console.log(`Asteroid rotation: ${asteroid.rotation.toFixed(3)}`);
console.log(`State hash: ${game.stateHash}`);

Math.random = originalRandom;
