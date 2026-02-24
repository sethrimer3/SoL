/**
 * Mirror System
 * Handles mirror initialization and light-on-structure calculations extracted from game-state.ts.
 *
 * Extracted from game-state.ts as part of Phase 12 refactoring.
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Sun } from '../entities/sun';
import { Asteroid } from '../entities/asteroid';
import { SolarMirror, MirrorMovementContext } from '../entities/solar-mirror';
import { StellarForge } from '../entities/stellar-forge';
import { Building } from '../entities/buildings';

/**
 * Context interface for MirrorSystem operations.
 * Defines the minimum fields required from GameState.
 * GameState satisfies this interface structurally.
 *
 * Extends MirrorMovementContext (which adds checkCollision) so that
 * initializeMirrorMovement can pass this context directly to mirror.setTarget().
 * Additional system-level fields can be added here as the system grows.
 */
export interface MirrorSystemContext extends MirrorMovementContext {}

/**
 * Mirror System – static methods for mirror initialization and light calculations.
 */
export class MirrorSystem {
    /**
     * Initialize mirror movement at the start of countdown.
     * Moves mirrors perpendicular to the sun-forge axis so they can reach sunlight.
     *
     * Extracted from GameState.initializeMirrorMovement().
     */
    static initializeMirrorMovement(game: MirrorSystemContext): void {
        if (game.suns.length === 0) return;

        const sun = game.suns[0]; // Use first sun as reference

        for (const player of game.players) {
            if (!player.stellarForge || player.solarMirrors.length < 2) continue;

            const forgePos = player.stellarForge.position;

            // Calculate angle from sun to forge
            const dx = forgePos.x - sun.position.x;
            const dy = forgePos.y - sun.position.y;
            const angleToForge = Math.atan2(dy, dx);

            // Calculate perpendicular angles (left and right relative to sun-to-forge direction)
            const leftAngle = angleToForge + Math.PI / 2;
            const rightAngle = angleToForge - Math.PI / 2;

            // Try to find valid positions for mirrors, avoiding asteroids
            if (player.solarMirrors.length >= 1) {
                // Try to place left mirror perpendicular to sun-forge line
                let leftTarget = new Vector2D(
                    forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );

                // If target is blocked, try to find alternative position
                if (game.checkCollision(leftTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new Vector2D(
                            forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult,
                            forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult
                        );
                        if (!game.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            leftTarget = altTarget;
                            break;
                        }
                    }
                }

                player.solarMirrors[0].setTarget(leftTarget, game);
            }

            if (player.solarMirrors.length >= 2) {
                // Try to place right mirror perpendicular to sun-forge line
                let rightTarget = new Vector2D(
                    forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );

                // If target is blocked, try to find alternative position
                if (game.checkCollision(rightTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new Vector2D(
                            forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult,
                            forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult
                        );
                        if (!game.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            rightTarget = altTarget;
                            break;
                        }
                    }
                }

                player.solarMirrors[1].setTarget(rightTarget, game);
            }
        }
    }

    /**
     * Calculate the total light a player's mirrors are delivering to a specific structure.
     * Returns a multiplier value (>= 0) representing aggregate light intensity.
     *
     * Extracted from GameState.getMirrorLightOnStructure().
     */
    static getMirrorLightOnStructure(
        game: { suns: Sun[]; asteroids: Asteroid[] },
        player: Player,
        structure: Building | StellarForge
    ): number {
        let totalLight = 0;

        for (const mirror of player.solarMirrors) {
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
            if (linkedStructure !== structure) continue;
            if (!mirror.hasLineOfSightToLight(game.suns, game.asteroids)) continue;

            const ray = new LightRay(
                mirror.position,
                new Vector2D(
                    structure.position.x - mirror.position.x,
                    structure.position.y - mirror.position.y
                ).normalize(),
                1.0
            );

            let hasLineOfSight = true;
            for (const asteroid of game.asteroids) {
                if (ray.intersectsPolygon(asteroid.getWorldVertices())) {
                    hasLineOfSight = false;
                    break;
                }
            }

            if (hasLineOfSight) {
                let closestSun: Sun | null = null;
                let closestSunDist = Infinity;
                for (const sun of game.suns) {
                    const dist = mirror.position.distanceTo(sun.position);
                    if (dist < closestSunDist) {
                        closestSunDist = dist;
                        closestSun = sun;
                    }
                }

                if (closestSun) {
                    const distanceMultiplier = Math.max(
                        1.0,
                        Constants.MIRROR_PROXIMITY_MULTIPLIER * (1.0 - Math.min(1.0, closestSunDist / Constants.MIRROR_MAX_GLOW_DISTANCE))
                    );
                    totalLight += distanceMultiplier;
                }
            }
        }

        return totalLight;
    }
}
