import { createStandardGame, Faction, Minigun, Vector2D } from './src/game-core';
import { SeededRandom, setGameRNG } from './src/seeded-random';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

console.log('=== Mirror Forge Relink Test ===');
setGameRNG(new SeededRandom(12345));

const game = createStandardGame([
    ['Player 1', Faction.RADIANT],
    ['Player 2', Faction.VELARIS]
]);
game.isCountdownActive = false;

const player = game.players[0];
const forge = player.stellarForge;
assert(forge !== null, 'Expected player to have a stellar forge');

const mirror = player.solarMirrors[0];
assert(!!mirror, 'Expected player to have at least one mirror');

const completeBuilding = new Minigun(
    new Vector2D(forge!.position.x + 120, forge!.position.y),
    player
);
completeBuilding.isComplete = true;
player.buildings.push(completeBuilding);

mirror.setLinkedStructure(completeBuilding);
game.update(1 / 60);

assert(
    mirror.getLinkedStructure(forge) === forge,
    'Expected mirror linked to a completed building to relink back to forge'
);

const incompleteBuilding = new Minigun(
    new Vector2D(forge!.position.x + 180, forge!.position.y),
    player
);
player.buildings.push(incompleteBuilding);
mirror.setLinkedStructure(incompleteBuilding);
game.update(1 / 60);

assert(
    mirror.getLinkedStructure(forge) === incompleteBuilding,
    'Expected mirror linked to an incomplete building to remain linked'
);

console.log('✅ Mirror relink behavior is correct.');
