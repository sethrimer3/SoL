/**
 * Deterministic replay snippet for solar mirror waypoint arrival tolerance.
 * Command list (simulated path points):
 *  - waypoint 1: intermediate path point should be considered reached within small radius
 *  - waypoint 2: final destination should still require exact arrival threshold
 */
import { Faction, Player, SolarMirror, Vector2D } from './src/game-core';
import { Asteroid } from './src/sim/entities/asteroid';
import type { MirrorMovementContext } from './src/sim/entities/solar-mirror';
import { SeededRandom, setGameRNG } from './src/seeded-random';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

const player = new Player('p1', Faction.RADIANT);
setGameRNG(new SeededRandom(123456));
const INTERMEDIATE_WAYPOINT_TEST_DISTANCE_PX = 5;
const FINAL_TARGET_OFFSET_PX = 2;

const movementContext: MirrorMovementContext = {
    suns: [],
    asteroids: [new Asteroid(new Vector2D(40, 0), 6, 45)],
    players: [player],
    checkCollision: () => false
};

const mirrorIntermediate = new SolarMirror(new Vector2D(0, 0), player);
mirrorIntermediate.setTarget(new Vector2D(80, 0), movementContext);
const queuedPathPoints = mirrorIntermediate.getQueuedPathPoints();
assert(queuedPathPoints.length >= 2, 'Expected pathfinding to generate an intermediate waypoint');

const firstWaypoint = queuedPathPoints[0];
mirrorIntermediate.position = new Vector2D(firstWaypoint.x - INTERMEDIATE_WAYPOINT_TEST_DISTANCE_PX, firstWaypoint.y);
mirrorIntermediate.update(1 / 60, movementContext);

assert(
    mirrorIntermediate.targetPosition !== firstWaypoint,
    'Expected intermediate waypoint to be considered reached within tolerance radius'
);

const mirrorFinal = new SolarMirror(new Vector2D(0, 0), player);
const noObstacleContext: MirrorMovementContext = {
    suns: [],
    asteroids: [],
    players: [player],
    checkCollision: () => false
};
const strictFinalTarget = new Vector2D(10, 0);
mirrorFinal.setTarget(strictFinalTarget, noObstacleContext);
mirrorFinal.position = new Vector2D(strictFinalTarget.x - FINAL_TARGET_OFFSET_PX, strictFinalTarget.y);
mirrorFinal.update(1 / 60, noObstacleContext);

assert(
    mirrorFinal.targetPosition === strictFinalTarget,
    'Expected final target to remain strict and not complete at 2px distance'
);

console.log('Solar mirror waypoint arrival tolerance regression passed.');
