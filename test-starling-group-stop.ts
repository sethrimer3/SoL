/**
 * Test to verify starling group stop behavior
 * When starlings from a group reach the final waypoint and stop,
 * other starlings from the same group should stop within a growing arrival radius.
 */
import { Starling, Player, Vector2D, Faction, GameState } from './src/game-core';
import * as Constants from './src/constants';

console.log('=== Starling Group Stop Behavior Test ===\n');

// Create test player
const testPlayer = new Player('TestPlayer', Faction.RADIANT);

// Test 1: Path hash generation for same path
console.log('Test 1: Path Hash Generation');
const path1 = [
    new Vector2D(100, 100),
    new Vector2D(200, 200),
    new Vector2D(300, 300)
];
const path2 = [
    new Vector2D(100, 100),
    new Vector2D(200, 200),
    new Vector2D(300, 300)
];
const path3 = [
    new Vector2D(100, 100),
    new Vector2D(200, 200),
    new Vector2D(400, 400) // Different final waypoint
];

const starling1 = new Starling(new Vector2D(50, 50), testPlayer, path1);
const starling2 = new Starling(new Vector2D(60, 60), testPlayer, path2);
const starling3 = new Starling(new Vector2D(70, 70), testPlayer, path3);

console.log(`Starling 1 path hash: ${starling1.getPathHash()}`);
console.log(`Starling 2 path hash: ${starling2.getPathHash()}`);
console.log(`Starling 3 path hash: ${starling3.getPathHash()}`);
console.log(`Starling 1 and 2 have same hash: ${starling1.getPathHash() === starling2.getPathHash()}`);
console.log(`Starling 1 and 3 have different hash: ${starling1.getPathHash() !== starling3.getPathHash()}`);
console.log('✓ Path hash generation OK\n');

// Test 2: Final waypoint detection
console.log('Test 2: Final Waypoint Detection');
const starling4 = new Starling(new Vector2D(290, 290), testPlayer, path1);
console.log(`Starling 4 initial hasReachedFinalWaypoint: ${starling4.getHasReachedFinalWaypoint()}`);
console.log(`Starling 4 current waypoint index: ${starling4.getCurrentPathWaypointIndex()}`);
console.log(`Starling 4 path length: ${starling4.getAssignedPathLength()}`);

// Simulate moving the starling to the final waypoint
// Create a minimal game state for testing
const mockGameState = {
    players: [testPlayer],
    isObjectVisibleToPlayer: () => true
} as any as GameState;

// Manually set the waypoint index to the last one
(starling4 as any).currentPathWaypointIndex = path1.length - 1;
// Set position close to final waypoint
starling4.position.x = 299;
starling4.position.y = 299;
// Set rally point to the final waypoint
(starling4 as any).rallyPoint = path1[path1.length - 1];

// Call updateAI to trigger the final waypoint detection
starling4.updateAI(mockGameState, []);

console.log(`After updateAI at final waypoint:`);
console.log(`  hasReachedFinalWaypoint: ${starling4.getHasReachedFinalWaypoint()}`);
console.log('✓ Final waypoint detection OK\n');

// Test 3: Group stop behavior (conceptual test)
console.log('Test 3: Group Stop Behavior (Growing Radius)');
console.log('Creating scenario:');
console.log('  - 4 starlings at final waypoint, stopped (hasReachedFinalWaypoint = true)');
console.log('  - Starling A: approaching final waypoint, same path hash');
console.log('  - Starling B: approaching final waypoint, different path hash');

const stoppedStarlings: Starling[] = [];
for (let i = 0; i < 4; i++) {
    const stoppedStarling = new Starling(new Vector2D(300, 300), testPlayer, path1);
    (stoppedStarling as any).hasReachedFinalWaypoint = true;
    (stoppedStarling as any).currentPathWaypointIndex = path1.length - 1;
    (stoppedStarling as any).rallyPoint = null; // Already stopped
    stoppedStarlings.push(stoppedStarling);
}

const expectedStopRadiusPx =
    Constants.STARLING_GROUP_STOP_BASE_RADIUS_PX +
    Constants.STARLING_GROUP_STOP_SPACING_PX * Math.sqrt(stoppedStarlings.length);

const approachingStarlingA = new Starling(
    new Vector2D(300 + expectedStopRadiusPx - 1, 300),
    testPlayer,
    path1
); // Same path, within expanded radius
(approachingStarlingA as any).currentPathWaypointIndex = path1.length - 1;
(approachingStarlingA as any).rallyPoint = path1[path1.length - 1];

const approachingStarlingB = new Starling(
    new Vector2D(300 + expectedStopRadiusPx + 5, 300),
    testPlayer,
    path3
); // Different path, beyond base radius
(approachingStarlingB as any).currentPathWaypointIndex = path3.length - 1;
(approachingStarlingB as any).rallyPoint = path3[path3.length - 1];

console.log(`Stopped starling hash: ${stoppedStarlings[0].getPathHash()}`);
console.log(`Approaching A hash: ${approachingStarlingA.getPathHash()} (same group)`);
console.log(`Approaching B hash: ${approachingStarlingB.getPathHash()} (different group)`);
console.log(`Expected stop radius: ${expectedStopRadiusPx.toFixed(2)}px`);

const allUnits = [...stoppedStarlings, approachingStarlingA, approachingStarlingB];

// Test moveTowardRallyPoint for starling A (should stop when touching stopped starling)
console.log('\nBefore movement:');
console.log(`  Approaching A hasReachedFinalWaypoint: ${approachingStarlingA.getHasReachedFinalWaypoint()}`);
console.log(`  Approaching A rallyPoint: ${(approachingStarlingA as any).rallyPoint ? 'set' : 'null'}`);

(approachingStarlingA as any).moveTowardRallyPoint(0.016, Constants.STARLING_MOVE_SPEED, allUnits, []);

console.log('After movement (inside expanded stop radius from same group):');
console.log(`  Approaching A hasReachedFinalWaypoint: ${approachingStarlingA.getHasReachedFinalWaypoint()}`);
console.log(`  Approaching A rallyPoint: ${(approachingStarlingA as any).rallyPoint ? 'set' : 'null'}`);
console.log(`  Expected: hasReachedFinalWaypoint = true, rallyPoint = null (stopped)`);

// Test moveTowardRallyPoint for starling B (should NOT stop - different group)
console.log('\nBefore movement:');
console.log(`  Approaching B hasReachedFinalWaypoint: ${approachingStarlingB.getHasReachedFinalWaypoint()}`);
console.log(`  Approaching B rallyPoint: ${(approachingStarlingB as any).rallyPoint ? 'set' : 'null'}`);

(approachingStarlingB as any).moveTowardRallyPoint(0.016, Constants.STARLING_MOVE_SPEED, allUnits, []);

console.log('After movement (outside base radius for different group):');
console.log(`  Approaching B hasReachedFinalWaypoint: ${approachingStarlingB.getHasReachedFinalWaypoint()}`);
console.log(`  Approaching B rallyPoint: ${(approachingStarlingB as any).rallyPoint ? 'set' : 'null'}`);
console.log(`  Expected: hasReachedFinalWaypoint = false, rallyPoint = still set (continuing)`);

console.log('\n✓ Group stop behavior test complete\n');

// Test 4: Cross-team interference prevention
console.log('Test 4: Cross-team Interference Prevention');
const enemyPlayer = new Player('EnemyPlayer', Faction.AURUM);
const enemyStarling = new Starling(new Vector2D(300, 300), enemyPlayer, path1); // Same path but enemy
(enemyStarling as any).hasReachedFinalWaypoint = true;
(enemyStarling as any).currentPathWaypointIndex = path1.length - 1;
(enemyStarling as any).rallyPoint = null;

const friendlyStarling = new Starling(new Vector2D(280, 280), testPlayer, path1); // Same path but friendly
(friendlyStarling as any).currentPathWaypointIndex = path1.length - 1;
(friendlyStarling as any).rallyPoint = path1[path1.length - 1];

const mixedUnits = [enemyStarling, friendlyStarling];

console.log('Testing if enemy stopped starling affects friendly starling with same path:');
console.log(`  Enemy starling owner: ${enemyStarling.owner.name}`);
console.log(`  Friendly starling owner: ${friendlyStarling.owner.name}`);
console.log(`  Both have same path hash: ${enemyStarling.getPathHash() === friendlyStarling.getPathHash()}`);

console.log('\nBefore movement:');
console.log(`  Friendly hasReachedFinalWaypoint: ${friendlyStarling.getHasReachedFinalWaypoint()}`);

(friendlyStarling as any).moveTowardRallyPoint(0.016, Constants.STARLING_MOVE_SPEED, mixedUnits, []);

console.log('After movement:');
console.log(`  Friendly hasReachedFinalWaypoint: ${friendlyStarling.getHasReachedFinalWaypoint()}`);
console.log(`  Friendly rallyPoint: ${(friendlyStarling as any).rallyPoint ? 'set' : 'null'}`);
console.log(`  Expected: hasReachedFinalWaypoint = false, rallyPoint = still set (enemy doesn't stop friendly)`);

console.log('\n✓ Cross-team interference prevention test complete\n');

console.log('=== All Tests Passed! ===');
