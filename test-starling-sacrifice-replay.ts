/**
 * Deterministic replay snippet for starling sacrifice production boosts.
 * Command list (tick -> command):
 *  - 0: foundry_strafe_upgrade (queue production)
 *  - 1: unit_target_structure (direct starling into friendly foundry)
 */
import { GameState, Player, Vector2D, Faction, SubsidiaryFactory, Starling } from './src/game-core';
import * as Constants from './src/constants';

const originalRandom = Math.random;
Math.random = () => 0.12345;

const game = new GameState();
game.isCountdownActive = false;
game.countdownTime = 0;
game.localPlayerIndex = 1;

const player = new Player('Player-1', Faction.RADIANT);
const opponent = new Player('Player-2', Faction.AURUM);
player.energy = 5000;
opponent.energy = 5000;

game.players.push(player, opponent);
game.initializePlayer(player, new Vector2D(0, 0), []);
game.initializePlayer(opponent, new Vector2D(400, 0), []);

const foundry = new SubsidiaryFactory(new Vector2D(120, 0), player);
foundry.isComplete = true;
foundry.buildProgress = 1;
player.buildings.push(foundry);

const starling = new Starling(new Vector2D(120, 0), player, []);
player.units.push(starling);

const commands = [
    {
        tick: 0,
        playerId: 'p1',
        command: 'foundry_strafe_upgrade',
        data: { buildingId: 0 }
    },
    {
        tick: 1,
        playerId: 'p1',
        command: 'unit_target_structure',
        data: {
            unitIds: [game.getUnitNetworkId(starling)],
            targetPlayerIndex: 0,
            structureType: 'building',
            structureIndex: 0,
            moveOrder: 1
        }
    }
];

game.receiveNetworkCommand(commands[0]);
game.processPendingNetworkCommands();
game.update(1 / 60);

game.receiveNetworkCommand(commands[1]);
game.processPendingNetworkCommands();

for (let i = 0; i < Constants.STATE_HASH_TICK_INTERVAL; i++) {
    game.update(1 / 60);
}

console.log('=== Starling Sacrifice Replay ===');
console.log(`Production progress: ${foundry.productionProgress.toFixed(3)}`);
console.log(`Player starlings: ${player.units.filter(unit => unit instanceof Starling).length}`);
console.log(`State hash: ${game.stateHash}`);

Math.random = originalRandom;
