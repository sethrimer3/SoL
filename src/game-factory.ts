/**
 * Game Factory
 * Creates GameState instances from GameSettings
 *
 * Extracted from main.ts as part of refactoring
 */

import { GameSettings } from './menu';
import { COLOR_SCHEMES } from './menu/color-schemes';
import { createStandardGame, GameState, Vector2D } from './game-core';
import { Sun, Asteroid } from './game-core';
import { Faction } from './game-core';
import * as Constants from './constants';

/**
 * Create a GameState configured for a 1v1 single-player game based on provided settings.
 */
export function createGameFromSettings(settings: GameSettings): GameState {
    const playerFaction = settings.selectedFaction ?? Faction.RADIANT;
    const aiFaction = Faction.RADIANT;
    const colorScheme = COLOR_SCHEMES[settings.colorScheme];
    const game = createStandardGame([
        ['Player 1', playerFaction],
        ['Player 2', aiFaction]
    ], colorScheme?.spaceDustPalette);

    // Clear and recreate based on map settings
    const map = settings.selectedMap;

    // Set map size
    game.mapSize = map.mapSize;

    // Clear existing suns and add new ones based on map
    game.suns = [];

    if (map.id === '2v2-dual-umbra') {
        game.suns.push(new Sun(new Vector2D(-260, 0), 1.0, 100.0));
        game.suns.push(new Sun(new Vector2D(260, 0), 1.0, 100.0));
    } else if (map.id === 'twin-suns') {
        // Two suns positioned diagonally
        game.suns.push(new Sun(new Vector2D(-300, -300), 1.0, 100.0));
        game.suns.push(new Sun(new Vector2D(300, 300), 1.0, 100.0));
    } else if (map.id === 'binary-center') {
        // Two suns orbiting each other at map center
        const orbitCenter = new Vector2D(0, 0);
        const orbitRadius = 150;
        const orbitSpeed = 0.05; // Radians per second (very slow)
        game.suns.push(new Sun(
            new Vector2D(0, 0), 1.0, 100.0, 'normal',
            orbitCenter, orbitRadius, orbitSpeed, 0
        ));
        game.suns.push(new Sun(
            new Vector2D(0, 0), 1.0, 100.0, 'normal',
            orbitCenter, orbitRadius, orbitSpeed, Math.PI
        ));
    } else if (map.id === 'binary-ring') {
        // Two suns orbiting on the outside of the map
        const orbitCenter = new Vector2D(0, 0);
        const orbitRadius = 1400;
        const orbitSpeed = 0.08; // Radians per second
        game.suns.push(new Sun(
            new Vector2D(0, 0), 1.0, 100.0, 'normal',
            orbitCenter, orbitRadius, orbitSpeed, 0
        ));
        game.suns.push(new Sun(
            new Vector2D(0, 0), 1.0, 100.0, 'normal',
            orbitCenter, orbitRadius, orbitSpeed, Math.PI
        ));
    } else if (map.id === 'test-level') {
        // Single sun at center for test level
        game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
    } else if (map.id === 'lad') {
        // LaD (Light and Dark) - special dual-nature sun
        game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'lad'));
    } else {
        // Single sun at center (default for all other maps)
        game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
    }

    if (map.id === 'test-level') {
        const leftForgePosition = new Vector2D(-700, 0);
        const rightForgePosition = new Vector2D(700, 0);
        const mirrorOffset = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorPositionsLeft = [
            new Vector2D(leftForgePosition.x, leftForgePosition.y - mirrorOffset),
            new Vector2D(leftForgePosition.x, leftForgePosition.y + mirrorOffset)
        ];
        const mirrorPositionsRight = [
            new Vector2D(rightForgePosition.x, rightForgePosition.y - mirrorOffset),
            new Vector2D(rightForgePosition.x, rightForgePosition.y + mirrorOffset)
        ];

        const playerPositions = [leftForgePosition, rightForgePosition];
        const mirrorPositions = [mirrorPositionsLeft, mirrorPositionsRight];

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const forgePosition = playerPositions[i] ?? leftForgePosition;
            const mirrorPositionSet = mirrorPositions[i] ?? mirrorPositionsLeft;
            player.stellarForge = null;
            player.solarMirrors = [];
            game.initializePlayer(player, forgePosition, mirrorPositionSet);
        }

        if (game.players.length >= 2) {
            const player = game.players[0];
            const enemyPlayer = game.players[1];
            if (player.stellarForge && enemyPlayer.stellarForge) {
                player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
                enemyPlayer.stellarForge.initializeDefaultPath(player.stellarForge.position);
            }
        }

        game.asteroids = [];
        game.spaceDust = [];
        return game;
    }

    // Reinitialize asteroids based on map (keeps strategic asteroids from createStandardGame)
    // Clear only the random asteroids (first 10), keep the strategic ones (last 2)
    const strategicAsteroids = game.asteroids.slice(-2); // Keep last 2 strategic asteroids
    game.asteroids = [];

    if (map.id === '2v2-umbra') {
        const largeSize = Constants.STRATEGIC_ASTEROID_SIZE * 1.15;
        const asteroidPositions = [
            new Vector2D(-320, -220),
            new Vector2D(-320, 220),
            new Vector2D(320, -220),
            new Vector2D(320, 220)
        ];
        for (const pos of asteroidPositions) {
            game.asteroids.push(new Asteroid(pos, 7, largeSize));
        }
    } else if (map.id === '2v2-dual-umbra') {
        const largeSize = Constants.STRATEGIC_ASTEROID_SIZE * 1.15;
        const asteroidPositions = [
            new Vector2D(-520, -260),
            new Vector2D(-520, 260),
            new Vector2D(520, -260),
            new Vector2D(520, 260),
            new Vector2D(0, -220),
            new Vector2D(0, 220)
        ];
        for (const pos of asteroidPositions) {
            game.asteroids.push(new Asteroid(pos, 7, largeSize));
        }
    } else {
        // Create exclusion zones around stellar forge spawn positions
        const exclusionZones = game.players
            .filter(p => p.stellarForge)
            .map(p => ({
                position: p.stellarForge!.position,
                radius: 250 // Exclusion zone radius around each base
            }));

        game.initializeAsteroids(map.numAsteroids, map.mapSize, map.mapSize, exclusionZones);

        // For standard map, add strategic asteroids back
        if (map.id === 'standard') {
            game.asteroids.push(...strategicAsteroids);
        }
    }

    // Reinitialize space dust
    game.spaceDust = [];
    const particleCount = map.id === 'test-level' ? 3000 : Constants.SPACE_DUST_PARTICLE_COUNT;
    game.initializeSpaceDust(particleCount, map.mapSize, map.mapSize, colorScheme?.spaceDustPalette);

    return game;
}
