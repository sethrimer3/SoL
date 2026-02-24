/**
 * World Initialization System
 * Handles deterministic generation of world objects (space dust, asteroids).
 *
 * Extracted from game-state.ts as part of Phase 13 refactoring.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Asteroid } from '../entities/asteroid';
import { SpaceDustParticle, SpaceDustPalette } from '../entities/particles';
import { getGameRNG } from '../../seeded-random';

/**
 * World Initialization System – handles creation of the game world's passive objects.
 * All methods are deterministic given the same RNG seed.
 */
export class WorldInitializationSystem {
    /**
     * Initialize space dust particles into the provided array.
     * The provided array is cleared before population.
     *
     * Extracted from GameState.initializeSpaceDust().
     */
    static initializeSpaceDust(
        spaceDustArray: SpaceDustParticle[],
        count: number,
        width: number,
        height: number,
        palette?: SpaceDustPalette
    ): void {
        spaceDustArray.length = 0;

        const clusterCount = Constants.DUST_CLUSTER_COUNT;
        const clusterRadiusPx = Constants.DUST_CLUSTER_RADIUS_PX;
        const clusterSpawnRatio = Constants.DUST_CLUSTER_SPAWN_RATIO;
        const clusterCenters: Vector2D[] = [];
        const rng = getGameRNG();

        for (let i = 0; i < clusterCount; i++) {
            const centerX = rng.nextFloat(-width / 2, width / 2);
            const centerY = rng.nextFloat(-height / 2, height / 2);
            clusterCenters.push(new Vector2D(centerX, centerY));
        }

        for (let i = 0; i < count; i++) {
            const useCluster = rng.next() < clusterSpawnRatio;
            let x = 0;
            let y = 0;

            if (useCluster && clusterCenters.length > 0) {
                const centerIndex = rng.nextInt(0, clusterCenters.length - 1);
                const center = clusterCenters[centerIndex];
                const angle = rng.nextAngle();
                const distance = Math.sqrt(rng.next()) * clusterRadiusPx;
                x = center.x + Math.cos(angle) * distance;
                y = center.y + Math.sin(angle) * distance;
            } else {
                x = rng.nextFloat(-width / 2, width / 2);
                y = rng.nextFloat(-height / 2, height / 2);
            }
            spaceDustArray.push(new SpaceDustParticle(new Vector2D(x, y), /* velocity= */ undefined, palette));
        }
    }

    /**
     * Initialize asteroids into the provided array at random positions,
     * respecting exclusion zones around player structures.
     * The provided array is cleared before population.
     *
     * Extracted from GameState.initializeAsteroids().
     */
    static initializeAsteroids(
        asteroidsArray: Asteroid[],
        count: number,
        width: number,
        height: number,
        exclusionZones?: Array<{ position: Vector2D; radius: number }>
    ): void {
        asteroidsArray.length = 0;

        const maxAttempts = 50; // Maximum attempts to find a valid position
        const rng = getGameRNG();

        for (let i = 0; i < count; i++) {
            let validPosition = false;
            let attempts = 0;
            let x = 0, y = 0, size = 0;

            while (!validPosition && attempts < maxAttempts) {
                // Random position avoiding the center (where players start)
                const angle = rng.nextAngle();
                const distance = rng.nextFloat(200, Math.min(width, height) / 2 - 100);
                x = Math.cos(angle) * distance;
                y = Math.sin(angle) * distance;

                // Random size (30-80)
                size = rng.nextFloat(Constants.ASTEROID_MIN_SIZE, 80);

                validPosition = true;

                // Check if this position has enough gap from existing asteroids
                // Gap must be at least the sum of both asteroid radii (accounting for rotation)
                // Use size * 1.32 as maximum radius (from asteroid generation vertex radiusScale max)
                const maxRadius = size * 1.32;
                for (const asteroid of asteroidsArray) {
                    const dx = x - asteroid.position.x;
                    const dy = y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const existingMaxRadius = asteroid.size * 1.32;
                    const requiredGap = maxRadius + existingMaxRadius;

                    if (dist < requiredGap) {
                        validPosition = false;
                        break;
                    }
                }

                // Check if this position is within any exclusion zones
                if (validPosition && exclusionZones) {
                    for (const zone of exclusionZones) {
                        const dx = x - zone.position.x;
                        const dy = y - zone.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const requiredGap = maxRadius + zone.radius;

                        if (dist < requiredGap) {
                            validPosition = false;
                            break;
                        }
                    }
                }

                attempts++;
            }

            // If we found a valid position, add the asteroid
            if (validPosition) {
                // Random polygon sides for faceted low-poly silhouette (12-24)
                const sides = rng.nextInt(12, 24);
                asteroidsArray.push(new Asteroid(new Vector2D(x, y), sides, size));
            }
        }
    }
}
