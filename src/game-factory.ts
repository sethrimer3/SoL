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
import { MapJSON } from './menu/types';

/**
 * Create suns from map JSON data.
 * Falls through to legacy id-based branching when JSON is absent.
 */
function applySunsFromJSON(game: GameState, json: MapJSON): void {
    game.suns = [];
    for (const s of json.suns) {
        if (s.orbitCenterX !== undefined && s.orbitCenterY !== undefined && s.orbitRadius !== undefined) {
            game.suns.push(new Sun(
                new Vector2D(s.x, s.y),
                s.intensity,
                s.radius,
                s.type,
                new Vector2D(s.orbitCenterX, s.orbitCenterY),
                s.orbitRadius,
                s.orbitSpeed ?? 0,
                s.initialOrbitAngleRad ?? 0
            ));
        } else {
            game.suns.push(new Sun(
                new Vector2D(s.x, s.y),
                s.intensity,
                s.radius,
                s.type
            ));
        }
    }
}

/**
 * Create fixed (non-random) asteroids from map JSON data.
 */
function applyFixedAsteroidsFromJSON(game: GameState, json: MapJSON): void {
    for (const a of json.asteroids) {
        game.asteroids.push(new Asteroid(new Vector2D(a.x, a.y), a.sides, a.size));
    }
}

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
    const json = map.json;

    // Set map size
    game.mapSize = json ? Math.max(json.mapWidth, json.mapHeight) : map.mapSize;

    // ── Suns ─────────────────────────────────────────────────────────────
    if (json) {
        applySunsFromJSON(game, json);
    } else {
        // Legacy id-based fallback
        game.suns = [];

        if (map.id === '2v2-dual-umbra') {
            game.suns.push(new Sun(new Vector2D(-260, 0), 1.0, 100.0));
            game.suns.push(new Sun(new Vector2D(260, 0), 1.0, 100.0));
        } else if (map.id === 'twin-suns') {
            game.suns.push(new Sun(new Vector2D(-300, -300), 1.0, 100.0));
            game.suns.push(new Sun(new Vector2D(300, 300), 1.0, 100.0));
        } else if (map.id === 'binary-center') {
            const orbitCenter = new Vector2D(0, 0);
            const orbitRadius = 150;
            const orbitSpeed = 0.05;
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'normal', orbitCenter, orbitRadius, orbitSpeed, 0));
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'normal', orbitCenter, orbitRadius, orbitSpeed, Math.PI));
        } else if (map.id === 'binary-ring') {
            const orbitCenter = new Vector2D(0, 0);
            const orbitRadius = 1400;
            const orbitSpeed = 0.08;
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'normal', orbitCenter, orbitRadius, orbitSpeed, 0));
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'normal', orbitCenter, orbitRadius, orbitSpeed, Math.PI));
        } else if (map.id === 'test-level') {
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        } else if (map.id === 'lad') {
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'lad'));
        } else {
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        }
    }

    // ── Player spawns (test-level has special handling) ──────────────────
    if (json && json.id === 'test-level') {
        // Test-level specific init with mirrored bases and no asteroids
        const leftForgePosition = json.spawns[0]
            ? new Vector2D(json.spawns[0].x, json.spawns[0].y)
            : new Vector2D(-700, 0);
        const rightForgePosition = json.spawns[1]
            ? new Vector2D(json.spawns[1].x, json.spawns[1].y)
            : new Vector2D(700, 0);
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

    if (!json && map.id === 'test-level') {
        // Legacy test-level fallback
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

    // ── Asteroids ────────────────────────────────────────────────────────
    const strategicAsteroids = game.asteroids.slice(-2);
    game.asteroids = [];

    if (json) {
        // Place fixed asteroids from JSON
        applyFixedAsteroidsFromJSON(game, json);

        // Add random asteroids if requested
        if (json.randomAsteroidCount > 0) {
            const exclusionZones = game.players
                .filter(p => p.stellarForge)
                .map(p => ({
                    position: p.stellarForge!.position,
                    radius: 250
                }));
            game.initializeAsteroids(json.randomAsteroidCount, json.mapWidth, json.mapHeight, exclusionZones);
        }
    } else if (map.id === '2v2-umbra') {
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
        const exclusionZones = game.players
            .filter(p => p.stellarForge)
            .map(p => ({
                position: p.stellarForge!.position,
                radius: 250
            }));

        game.initializeAsteroids(map.numAsteroids, map.mapSize, map.mapSize, exclusionZones);

        if (map.id === 'standard') {
            game.asteroids.push(...strategicAsteroids);
        }
    }

    // Reinitialize space dust
    game.spaceDust = [];
    const mapSizePx = json ? Math.max(json.mapWidth, json.mapHeight) : map.mapSize;
    const particleCount = map.id === 'test-level' ? 3000 : Constants.SPACE_DUST_PARTICLE_COUNT;
    game.initializeSpaceDust(particleCount, mapSizePx, mapSizePx, colorScheme?.spaceDustPalette);

    return game;
}
