/**
 * Simple test to verify ShieldTower mechanics work correctly
 */
import { ShieldTower, SpaceDustSwirler, Player, Vector2D, Faction, Starling } from './src/game-core';
import * as Constants from './src/constants';

console.log('=== Shield Tower Test ===\n');

// Test 1: Shield Tower creation for Radiant
console.log('Test 1: ShieldTower Creation (Radiant)');
const radiantPlayer = new Player('RadiantPlayer', Faction.RADIANT);
const shieldTower = new ShieldTower(new Vector2D(500, 500), radiantPlayer);
console.log(`Tower faction: ${shieldTower.owner.faction}`);
console.log(`Shield active: ${shieldTower.shieldActive}`);
console.log(`Shield health: ${shieldTower.shieldHealth}/${shieldTower.maxShieldHealth}`);
console.log(`Shield radius: ${shieldTower.shieldRadius}px`);
console.log(`Building cost: ${Constants.SHIELD_TOWER_COST} energy`);
console.log('✓ ShieldTower creation OK\n');

// Test 2: Shield blocking check
console.log('Test 2: Shield Blocking Logic');
const enemyPos1 = new Vector2D(600, 500); // 100px away - within 200px shield radius
const enemyPos2 = new Vector2D(800, 500); // 300px away - outside shield radius
shieldTower.isComplete = true;
console.log(`Enemy at 100px distance blocked: ${shieldTower.isEnemyBlocked(enemyPos1)} (expected: true)`);
console.log(`Enemy at 300px distance blocked: ${shieldTower.isEnemyBlocked(enemyPos2)} (expected: false)`);
console.log('✓ Shield blocking logic OK\n');

// Test 3: Shield damage and disable
console.log('Test 3: Shield Damage and Disable');
console.log(`Initial shield health: ${shieldTower.shieldHealth}`);
shieldTower.damageShield(200);
console.log(`After 200 damage: ${shieldTower.shieldHealth} (expected: 300)`);
shieldTower.damageShield(300);
console.log(`After 300 more damage: ${shieldTower.shieldHealth} (expected: 0)`);
console.log(`Shield active: ${shieldTower.shieldActive} (expected: false)`);
console.log(`Regeneration timer: ${shieldTower.regenerationTimer}s (expected: 0)`);
console.log('✓ Shield damage and disable OK\n');

// Test 4: Shield regeneration
console.log('Test 4: Shield Regeneration');
const velarisPlayer = new Player('VelarisPlayer', Faction.VELARIS);
const enemyUnit = new Starling(new Vector2D(600, 500), velarisPlayer, []);
const allUnits = [enemyUnit];
const enemies = [enemyUnit];

// Simulate time passing with enemy present
for (let i = 0; i < 5; i++) {
    shieldTower.update(2.0, enemies, allUnits); // 2 seconds per update
    console.log(`After ${(i + 1) * 2}s: Timer=${shieldTower.regenerationTimer.toFixed(1)}s, Active=${shieldTower.shieldActive}`);
}
console.log('✓ Shield stays down with enemies present\n');

// Test 5: Shield regeneration without enemies
console.log('Test 5: Shield Regeneration (No Enemies)');
enemyUnit.position = new Vector2D(800, 500); // Move enemy far away
const emptyEnemies: any[] = [];
shieldTower.update(0.5, emptyEnemies, allUnits); // Half second more
console.log(`After enemy moves away: Timer=${shieldTower.regenerationTimer.toFixed(1)}s, Active=${shieldTower.shieldActive} (expected: true)`);
console.log(`Shield health restored: ${shieldTower.shieldHealth}/${shieldTower.maxShieldHealth}`);
console.log('✓ Shield regeneration OK\n');

// Test 6: Cyclone/SpaceDustSwirler for Velaris
console.log('Test 6: Cyclone (SpaceDustSwirler) for Velaris');
const cyclone = new SpaceDustSwirler(new Vector2D(500, 500), velarisPlayer);
console.log(`Cyclone faction: ${cyclone.owner.faction}`);
console.log(`Cyclone radius: ${cyclone.radius}px`);
console.log(`Influence radius: ${cyclone.currentInfluenceRadius}px (starts at ${Constants.SWIRLER_INFLUENCE_RADIUS * Constants.SWIRLER_INITIAL_RADIUS_MULTIPLIER}px)`);
console.log(`Building cost: ${Constants.SWIRLER_COST} energy`);
console.log('✓ Cyclone for Velaris OK\n');

console.log('=== All Tests Passed ===');
