/**
 * Test for starling frontal arc shooting behavior
 * Tests that moving starlings only shoot targets in 180-degree frontal arc
 */

import { GameState, Player, Faction, Starling, StellarForge, Vector2D } from './src/game-core';
import { setGameRNG, SeededRandom } from './src/seeded-random';
import * as Constants from './src/constants';

// Initialize RNG for testing
setGameRNG(new SeededRandom('test-seed-12345'));

// Test 1: Stationary starling can shoot in any direction
function testStationaryStarlingShoots360(): boolean {
    console.log('\n=== Test 1: Stationary Starling 360-degree shooting ===');
    
    const game = new GameState();
    const player1 = new Player('Player1', Faction.AURUM);
    const player2 = new Player('Player2', Faction.AURUM);
    game.players = [player1, player2];
    
    // Create player 1's forge and starling
    const forge1 = new StellarForge(new Vector2D(0, 0), player1);
    player1.stellarForge = forge1;
    const starling = new Starling(new Vector2D(100, 100), player1);
    player1.units.push(starling);
    
    // Create player 2's forge (target)
    const forge2 = new StellarForge(new Vector2D(200, 100), player2);
    player2.stellarForge = forge2;
    
    // Ensure starling is stationary
    starling.velocity.x = 0;
    starling.velocity.y = 0;
    
    // Test shooting at target behind (should work for stationary)
    const targetBehind = new StellarForge(new Vector2D(50, 100), player2);
    const canShootBehind = (starling as any).canShootTarget(targetBehind);
    
    console.log('Starling velocity:', starling.velocity);
    console.log('Can shoot target behind when stationary:', canShootBehind);
    
    if (!canShootBehind) {
        console.error('FAIL: Stationary starling should be able to shoot in any direction');
        return false;
    }
    
    console.log('PASS: Stationary starling can shoot 360 degrees');
    return true;
}

// Test 2: Moving starling can shoot targets in front
function testMovingStarlingShootsInFront(): boolean {
    console.log('\n=== Test 2: Moving Starling shoots targets in front ===');
    
    const game = new GameState();
    const player1 = new Player('Player1', Faction.AURUM);
    const player2 = new Player('Player2', Faction.AURUM);
    game.players = [player1, player2];
    
    // Create starling moving to the right (+x direction)
    const starling = new Starling(new Vector2D(100, 100), player1);
    player1.units.push(starling);
    starling.velocity.x = 50; // Moving right
    starling.velocity.y = 0;
    
    // Create target in front (to the right)
    const targetAhead = new StellarForge(new Vector2D(200, 100), player2);
    const canShootAhead = (starling as any).canShootTarget(targetAhead);
    
    console.log('Starling position:', starling.position);
    console.log('Starling velocity:', starling.velocity);
    console.log('Target position (ahead):', targetAhead.position);
    console.log('Can shoot target ahead:', canShootAhead);
    
    if (!canShootAhead) {
        console.error('FAIL: Moving starling should be able to shoot targets ahead');
        return false;
    }
    
    console.log('PASS: Moving starling can shoot targets in front');
    return true;
}

// Test 3: Moving starling cannot shoot targets behind
function testMovingStarlingCannotShootBehind(): boolean {
    console.log('\n=== Test 3: Moving Starling cannot shoot targets behind ===');
    
    const game = new GameState();
    const player1 = new Player('Player1', Faction.AURUM);
    const player2 = new Player('Player2', Faction.AURUM);
    game.players = [player1, player2];
    
    // Create starling moving to the right (+x direction)
    const starling = new Starling(new Vector2D(100, 100), player1);
    player1.units.push(starling);
    starling.velocity.x = 50; // Moving right
    starling.velocity.y = 0;
    
    // Create target behind (to the left)
    const targetBehind = new StellarForge(new Vector2D(50, 100), player2);
    const canShootBehind = (starling as any).canShootTarget(targetBehind);
    
    console.log('Starling position:', starling.position);
    console.log('Starling velocity:', starling.velocity);
    console.log('Target position (behind):', targetBehind.position);
    console.log('Can shoot target behind:', canShootBehind);
    
    if (canShootBehind) {
        console.error('FAIL: Moving starling should NOT be able to shoot targets behind');
        return false;
    }
    
    console.log('PASS: Moving starling cannot shoot targets behind');
    return true;
}

// Test 4: Moving starling can shoot targets at 90-degree angles
function testMovingStarlingShootsAtSides(): boolean {
    console.log('\n=== Test 4: Moving Starling shoots at 90-degree sides ===');
    
    const game = new GameState();
    const player1 = new Player('Player1', Faction.AURUM);
    const player2 = new Player('Player2', Faction.AURUM);
    game.players = [player1, player2];
    
    // Create starling moving to the right (+x direction)
    const starling = new Starling(new Vector2D(100, 100), player1);
    player1.units.push(starling);
    starling.velocity.x = 50; // Moving right
    starling.velocity.y = 0;
    
    // Create target at 90 degrees (directly above)
    const targetSide = new StellarForge(new Vector2D(100, 50), player2);
    const canShootSide = (starling as any).canShootTarget(targetSide);
    
    console.log('Starling position:', starling.position);
    console.log('Starling velocity:', starling.velocity);
    console.log('Target position (perpendicular):', targetSide.position);
    console.log('Can shoot target at side (90 degrees):', canShootSide);
    
    if (!canShootSide) {
        console.error('FAIL: Moving starling should be able to shoot targets at 90 degrees');
        return false;
    }
    
    console.log('PASS: Moving starling can shoot at 90-degree angles');
    return true;
}

// Test 5: Moving starling cannot shoot targets at 91+ degrees
function testMovingStarlingCannotShootPastSides(): boolean {
    console.log('\n=== Test 5: Moving Starling cannot shoot past 90 degrees ===');
    
    const game = new GameState();
    const player1 = new Player('Player1', Faction.AURUM);
    const player2 = new Player('Player2', Faction.AURUM);
    game.players = [player1, player2];
    
    // Create starling moving to the right (+x direction)
    const starling = new Starling(new Vector2D(100, 100), player1);
    player1.units.push(starling);
    starling.velocity.x = 50; // Moving right
    starling.velocity.y = 0;
    
    // Create target at slightly behind the perpendicular (slightly past 90 degrees)
    const targetBehindSide = new StellarForge(new Vector2D(90, 50), player2);
    const canShootBehindSide = (starling as any).canShootTarget(targetBehindSide);
    
    console.log('Starling position:', starling.position);
    console.log('Starling velocity:', starling.velocity);
    console.log('Target position (slightly past 90 degrees):', targetBehindSide.position);
    console.log('Can shoot target slightly behind perpendicular:', canShootBehindSide);
    
    if (canShootBehindSide) {
        console.error('FAIL: Moving starling should NOT be able to shoot targets past 90 degrees');
        return false;
    }
    
    console.log('PASS: Moving starling cannot shoot past 90 degrees');
    return true;
}

// Test 6: Line of sight is 20% more than attack range
function testLineOfSightRange(): boolean {
    console.log('\n=== Test 6: Line of sight is 20% more than attack range ===');
    
    const player = new Player('Player1', Faction.AURUM);
    const starling = new Starling(new Vector2D(0, 0), player);
    
    const expectedLineOfSight = Constants.STARLING_ATTACK_RANGE * Constants.UNIT_LINE_OF_SIGHT_MULTIPLIER;
    
    console.log('Attack range:', starling.attackRange);
    console.log('Line of sight:', starling.lineOfSight);
    console.log('Expected line of sight:', expectedLineOfSight);
    console.log('Multiplier:', Constants.UNIT_LINE_OF_SIGHT_MULTIPLIER);
    
    if (Math.abs(starling.lineOfSight - expectedLineOfSight) > 0.01) {
        console.error('FAIL: Line of sight should be 20% more than attack range');
        return false;
    }
    
    console.log('PASS: Line of sight is correctly calculated');
    return true;
}

// Run all tests
function runAllTests(): void {
    console.log('========================================');
    console.log('Testing Starling Frontal Arc Shooting');
    console.log('========================================');
    
    const tests = [
        testStationaryStarlingShoots360,
        testMovingStarlingShootsInFront,
        testMovingStarlingCannotShootBehind,
        testMovingStarlingShootsAtSides,
        testMovingStarlingCannotShootPastSides,
        testLineOfSightRange,
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error('Test threw exception:', error);
            failed++;
        }
    }
    
    console.log('\n========================================');
    console.log('Test Results:');
    console.log(`Passed: ${passed}/${tests.length}`);
    console.log(`Failed: ${failed}/${tests.length}`);
    console.log('========================================');
    
    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runAllTests();
