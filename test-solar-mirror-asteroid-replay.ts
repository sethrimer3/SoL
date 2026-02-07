/**
 * Deterministic replay snippet for solar mirror asteroid avoidance.
 * Command list (tick -> command):
 *  - 0: mirror_move (order mirror to move past an asteroid)
 */
import { GameState, Player, Vector2D, Faction } from './src/game-core';
import { Asteroid } from './src/sim/entities/asteroid';
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
game.initializePlayer(player, new Vector2D(-200, 0), [new Vector2D(-150, 0)]);
game.initializePlayer(opponent, new Vector2D(400, 0), []);

game.asteroids.push(new Asteroid(new Vector2D(0, 0), 6, 45));

const commands = [
    {
        tick: 0,
        playerId: 'p1',
        command: 'mirror_move',
        data: {
            mirrorIndices: [0],
            targetX: 200,
            targetY: 0,
            moveOrder: 1
        }
    }
];

game.receiveNetworkCommand(commands[0]);
game.processPendingNetworkCommands();

for (let i = 0; i < Constants.STATE_HASH_TICK_INTERVAL; i++) {
    game.update(1 / 60);
}

const mirror = player.solarMirrors[0];
console.log('=== Solar Mirror Asteroid Replay ===');
console.log(`Mirror position: (${mirror.position.x.toFixed(1)}, ${mirror.position.y.toFixed(1)})`);
console.log(`Target position: (${mirror.targetPosition?.x ?? 0}, ${mirror.targetPosition?.y ?? 0})`);
console.log(`State hash: ${game.stateHash}`);

Math.random = originalRandom;
