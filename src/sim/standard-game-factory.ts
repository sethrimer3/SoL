/**
 * Standard Game Factory
 * Creates a standard game setup for the default map configuration.
 *
 * Extracted from game-state.ts as part of Phase 16 refactoring.
 */

import { Vector2D } from './math';
import * as Constants from '../constants';
import { Player, Faction } from './entities/player';
import { Sun } from './entities/sun';
import { Asteroid } from './entities/asteroid';
import { SpaceDustPalette } from './entities/particles';
import { getGameRNG } from '../seeded-random';
import { GameState } from './game-state';

/**
 * Create a standard game setup.
 * Configures players, positions, mirrors, asteroids, and space dust
 * for the default symmetric map.
 */
export function createStandardGame(playerNames: Array<[string, Faction]>, spaceDustPalette?: SpaceDustPalette): GameState {
    const game = new GameState();

    // Add sun at center
    game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));

    // Create players with starting positions
    // For 2 players: bottom-left and top-right (diagonal)
    // For 4 players (2v2): all four corners (team 0 on one diagonal, team 1 on other)
    const rng = getGameRNG();
    
    let positions: Vector2D[];
    let teamAssignments: number[];
    
    if (playerNames.length === 2) {
        // Standard 1v1: bottom-left and top-right
        const bottomLeft = new Vector2D(-700, 700);
        const topRight = new Vector2D(700, -700);
        
        // Randomly decide player assignment
        const randomizePositions = rng.next() < 0.5;
        positions = randomizePositions 
            ? [bottomLeft, topRight]
            : [topRight, bottomLeft];
        
        teamAssignments = [0, 0]; // Both assigned team 0 (team logic disabled for 1v1)
    } else if (playerNames.length >= 4) {
        // 2v2 game: Four corners
        // Team 0: top-left and bottom-right (one diagonal)
        // Team 1: top-right and bottom-left (other diagonal)
        const topLeft = new Vector2D(-700, -700);
        const topRight = new Vector2D(700, -700);
        const bottomLeft = new Vector2D(-700, 700);
        const bottomRight = new Vector2D(700, 700);
        
        // Randomly assign which team gets which diagonal
        const randomizeTeams = rng.next() < 0.5;
        
        if (randomizeTeams) {
            positions = [topLeft, bottomRight, topRight, bottomLeft];
            teamAssignments = [0, 0, 1, 1];
        } else {
            positions = [topRight, bottomLeft, topLeft, bottomRight];
            teamAssignments = [0, 0, 1, 1];
        }
    } else {
        // 3 players - treat as FFA with positions around a circle
        const bottomLeft = new Vector2D(-700, 700);
        const topRight = new Vector2D(700, -700);
        const top = new Vector2D(0, -700);
        positions = [bottomLeft, topRight, top];
        teamAssignments = [0, 1, 2]; // Each on own team
    }

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= positions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
        player.isAi = i !== 0;
        player.teamId = teamAssignments[i];
        
        // Assign random AI strategy for AI players
        if (player.isAi) {
            const strategies = [
                Constants.AIStrategy.ECONOMIC,
                Constants.AIStrategy.DEFENSIVE,
                Constants.AIStrategy.AGGRESSIVE,
                Constants.AIStrategy.WAVES
            ];
            player.aiStrategy = rng.choice(strategies)!;
        }
        
        const forgePos = positions[i];
        
        const mirrorSpawnDistance = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorPositions = [
            new Vector2D(
                forgePos.x - mirrorSpawnDistance,
                forgePos.y
            ),
            new Vector2D(
                forgePos.x + mirrorSpawnDistance,
                forgePos.y
            )
        ];
        game.initializePlayer(player, forgePos, mirrorPositions);
        
        // Hero units (Marine and Grave) are no longer spawned automatically
        // They must be obtained through other game mechanics
        
        game.players.push(player);
    }
    
    // Update player name map after all players have been added
    game.updatePlayerNameMap();
    
    // Initialize default minion paths (each forge targets an enemy's spawn location)
    if (game.players.length >= 2) {
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            
            // Find an enemy player (different team in team games, or next player in 1v1)
            let enemyPlayer: Player | null = null;
            
            if (game.players.length >= 3) {
                // Team game or FFA: target a player on a different team
                enemyPlayer = game.players.find(p => 
                    p !== player && p.teamId !== player.teamId
                ) || null;
            } else {
                // 1v1: target the other player
                const enemyIndex = (i + 1) % game.players.length;
                enemyPlayer = game.players[enemyIndex];
            }
            
            if (player.stellarForge && enemyPlayer && enemyPlayer.stellarForge) {
                player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
            }
        }
    }

    // Initialize space dust particles
    game.initializeSpaceDust(Constants.SPACE_DUST_PARTICLE_COUNT, 2000, 2000, spaceDustPalette);

    // Add two large strategic asteroids that cast shadows on the bases.
    // We reserve their space before random asteroid generation so no random asteroid can overlap them.
    const strategicAsteroidRadius = Constants.STRATEGIC_ASTEROID_SIZE * 1.32;

    const bottomLeftShadowAngle = -Math.PI / 4; // -45 degrees (top-right quadrant)
    const bottomLeftAsteroidPos = new Vector2D(
        Math.cos(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );

    const topRightShadowAngle = (3 * Math.PI) / 4; // 135 degrees (bottom-left quadrant)
    const topRightAsteroidPos = new Vector2D(
        Math.cos(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );

    // Create exclusion zones around stellar forge spawn positions and strategic asteroid anchors.
    const exclusionZones = game.players
        .filter(p => p.stellarForge)
        .map(p => ({
            position: p.stellarForge!.position,
            radius: 250 // Exclusion zone radius around each base
        }));

    exclusionZones.push(
        { position: bottomLeftAsteroidPos, radius: strategicAsteroidRadius },
        { position: topRightAsteroidPos, radius: strategicAsteroidRadius }
    );

    // Initialize random asteroids with exclusion zones
    game.initializeAsteroids(10, 2000, 2000, exclusionZones);

    game.asteroids.push(new Asteroid(bottomLeftAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));
    game.asteroids.push(new Asteroid(topRightAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));

    game.isRunning = true;
    return game;
}
