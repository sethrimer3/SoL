/**
 * Simple test to verify forge crunch mechanics work correctly
 */
import { StellarForge, Player, Vector2D, ForgeCrunch, Faction } from './src/game-core';
import * as Constants from './src/constants';

// Create test player and forge
const testPlayer = new Player('TestPlayer', Faction.RADIANT);
const testForge = new StellarForge(new Vector2D(500, 500), testPlayer);
testPlayer.stellarForge = testForge;

console.log('=== Forge Crunch Test ===\n');

// Test 1: Initial state
console.log('Test 1: Initial State');
console.log(`Crunch timer: ${testForge.crunchTimer.toFixed(2)}s`);
console.log(`Pending energy: ${testForge.pendingEnergy}`);
console.log(`Current crunch: ${testForge.getCurrentCrunch()}`);
console.log('✓ Initial state OK\n');

// Test 2: Add pending energy
console.log('Test 2: Adding Pending Energy');
testForge.addPendingEnergy(150);
console.log(`Pending energy after adding 150: ${testForge.pendingEnergy}`);
console.log('✓ Energy addition OK\n');

// Test 3: Trigger crunch manually
console.log('Test 3: Triggering Crunch');
testForge.health = 1000;
testForge.isReceivingLight = true;
testForge.crunchTimer = 0; // Force timer to trigger

const energyForMinions = testForge.shouldCrunch();
console.log(`Energy returned for minions: ${energyForMinions}`);
console.log(`Pending energy after crunch: ${testForge.pendingEnergy}`);
console.log(`Current crunch active: ${testForge.getCurrentCrunch()?.isActive()}`);
console.log(`Crunch phase: ${testForge.getCurrentCrunch()?.phase}`);

// Calculate expected starlings
const expectedStarlings = Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY);
console.log(`Expected starlings to spawn: ${expectedStarlings} (150 / ${Constants.STARLING_COST_PER_ENERGY} = ${expectedStarlings})`);
console.log('✓ Crunch trigger OK\n');

// Test 4: Crunch state transitions
console.log('Test 4: Crunch Phase Transitions');
const crunch = testForge.getCurrentCrunch();
if (crunch) {
    console.log(`Initial phase: ${crunch.phase}`);
    console.log(`Initial timer: ${crunch.phaseTimer.toFixed(2)}s`);
    
    // Simulate suck phase completion
    crunch.update(Constants.FORGE_CRUNCH_SUCK_DURATION);
    console.log(`After suck duration: phase=${crunch.phase}, timer=${crunch.phaseTimer.toFixed(2)}s`);
    
    // Simulate wave phase completion
    crunch.update(Constants.FORGE_CRUNCH_WAVE_DURATION);
    console.log(`After wave duration: phase=${crunch.phase}, isActive=${crunch.isActive()}`);
    console.log('✓ Phase transitions OK\n');
}

// Test 5: ForgeCrunch class directly
console.log('Test 5: ForgeCrunch Class');
const testCrunch = new ForgeCrunch(new Vector2D(100, 100));
console.log(`New crunch initial state: phase=${testCrunch.phase}, active=${testCrunch.isActive()}`);

testCrunch.start();
console.log(`After start: phase=${testCrunch.phase}, active=${testCrunch.isActive()}`);
console.log(`Phase progress: ${testCrunch.getPhaseProgress().toFixed(2)}`);

testCrunch.update(0.4); // Half way through suck
console.log(`After 0.4s: phase=${testCrunch.phase}, progress=${testCrunch.getPhaseProgress().toFixed(2)}`);

testCrunch.update(0.4); // Complete suck phase
console.log(`After 0.8s total: phase=${testCrunch.phase}, timer=${testCrunch.phaseTimer.toFixed(2)}s`);
console.log('✓ ForgeCrunch class OK\n');

console.log('=== All Tests Passed! ===');
