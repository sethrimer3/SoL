import { createStandardGame, Faction, Minigun, Vector2D } from './src/game-core';
import { SeededRandom, setGameRNG } from './src/seeded-random';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

console.log('=== Mirror Forge Relink Test ===');
setGameRNG(new SeededRandom(12345));
const frameDeltaMs = 16;
const firstBuildingOffsetPx = 120;
const secondBuildingOffsetPx = 180;

const game = createStandardGame([
    ['Player 1', Faction.RADIANT],
    ['Player 2', Faction.VELARIS]
]);
game.isCountdownActive = false;

const player = game.players[0];
const forge = player.stellarForge;
if (!forge) {
    throw new Error('Expected player to have a stellar forge');
}

const mirror = player.solarMirrors[0];
assert(!!mirror, 'Expected player to have at least one mirror');

const completedMinigun = new Minigun(
    new Vector2D(forge.position.x + firstBuildingOffsetPx, forge.position.y),
    player
);
completedMinigun.isComplete = true;
player.buildings.push(completedMinigun);

for (const playerMirror of player.solarMirrors) {
    playerMirror.setLinkedStructure(completedMinigun);
}
game.update(frameDeltaMs / 1000);

assert(
    mirror.getLinkedStructure(forge) === forge,
    'Expected mirror linked to a completed building to relink back to forge'
);
assert(
    player.solarMirrors[1].getLinkedStructure(forge) === forge,
    'Expected all mirrors linked to a completed building to relink back to forge'
);

const incompleteMinigun = new Minigun(
    new Vector2D(forge.position.x + secondBuildingOffsetPx, forge.position.y),
    player
);
player.buildings.push(incompleteMinigun);
mirror.setLinkedStructure(incompleteMinigun);
game.update(frameDeltaMs / 1000);

assert(
    mirror.getLinkedStructure(forge) === incompleteMinigun,
    'Expected mirror linked to an incomplete building to remain linked'
);

console.log('✅ Mirror relink behavior is correct.');
