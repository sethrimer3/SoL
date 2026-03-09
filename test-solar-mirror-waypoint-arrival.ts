/**
 * Deterministic replay snippet for solar mirror waypoint arrival tolerance.
 * Command list (simulated path points):
 *  - waypoint 1: intermediate path point should be considered reached within small radius
 *  - waypoint 2: final destination should still require exact arrival threshold
 */
import { Faction, Player, SolarMirror, Vector2D } from './src/game-core';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

const player = new Player('p1', Faction.RADIANT);

const mirrorIntermediate = new SolarMirror(new Vector2D(0, 0), player);
const intermediateWaypoint = new Vector2D(10, 0);
const finalTarget = new Vector2D(20, 0);
(mirrorIntermediate as any).targetPosition = intermediateWaypoint;
(mirrorIntermediate as any).waypoints = [intermediateWaypoint];
(mirrorIntermediate as any).finalTarget = finalTarget;
mirrorIntermediate.position = new Vector2D(8, 0); // 2px away from waypoint
mirrorIntermediate.update(0);

assert(
    mirrorIntermediate.targetPosition === finalTarget,
    'Expected intermediate waypoint to be considered reached within tolerance radius'
);

const mirrorFinal = new SolarMirror(new Vector2D(0, 0), player);
const strictFinalTarget = new Vector2D(10, 0);
(mirrorFinal as any).targetPosition = strictFinalTarget;
(mirrorFinal as any).waypoints = [];
(mirrorFinal as any).finalTarget = null;
mirrorFinal.position = new Vector2D(8, 0); // 2px away from final target
mirrorFinal.update(0);

assert(
    mirrorFinal.targetPosition === strictFinalTarget,
    'Expected final target to remain strict and not complete at 2px distance'
);

console.log('Solar mirror waypoint arrival tolerance regression passed.');
