/**
 * Mirror System
 * Handles mirror initialization, per-frame updates, and light-on-structure calculations.
 *
 * Extracted from game-state.ts as part of Phase 12–14 refactoring.
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Sun } from '../entities/sun';
import { Asteroid } from '../entities/asteroid';
import { SolarMirror, MirrorMovementContext } from '../entities/solar-mirror';
import { StellarForge } from '../entities/stellar-forge';
import { Building } from '../entities/buildings';
import { WarpGate } from '../entities/warp-gate';
import { SparkleParticle } from '../entities/particles';
import { PhysicsContext, PhysicsSystem } from './physics-system';
import { Unit } from '../entities/unit';
import { VisionSystem } from './vision-system';
import { VelarisOrb, ShroudCube, OccludeShadowCone } from '../../game-core';
import { createHeroUnit } from '../../game-core';
import { getGameRNG } from '../../seeded-random';

/**
 * Context interface for MirrorSystem operations.
 * Extends MirrorMovementContext (for mirror.setTarget() compatibility) and
 * PhysicsContext (for dust-push during mirror movement).
 * GameState satisfies this interface structurally.
 */
export interface MirrorSystemContext extends MirrorMovementContext, PhysicsContext {
    warpGates: WarpGate[];
    velarisOrbs: InstanceType<typeof VelarisOrb>[];
    shroudCubes: InstanceType<typeof ShroudCube>[];
    occludeShadowCones: InstanceType<typeof OccludeShadowCone>[];
    sparkleParticles: SparkleParticle[];
    isPointWithinPlayerInfluence(player: Player, point: Vector2D): boolean;
    getPlayerImpactColor(player: Player): string;
}

/**
 * Mirror System – static methods for mirror initialization and light calculations.
 */
export class MirrorSystem {
    private static separateOverlappingMirrorsForPlayer(game: MirrorSystemContext, player: Player, deltaTime: number): void {
        const mirrors = player.solarMirrors;
        if (mirrors.length < 2) {
            return;
        }

        const mirrorRadiusPx = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        const minDistancePx = mirrorRadiusPx * 2;
        const minDistanceSq = minDistancePx * minDistancePx;
        const pushSpeedPxPerSec = 50;

        for (let firstMirrorIndex = 0; firstMirrorIndex < mirrors.length - 1; firstMirrorIndex++) {
            const firstMirror = mirrors[firstMirrorIndex];
            for (let secondMirrorIndex = firstMirrorIndex + 1; secondMirrorIndex < mirrors.length; secondMirrorIndex++) {
                const secondMirror = mirrors[secondMirrorIndex];
                const deltaX = secondMirror.position.x - firstMirror.position.x;
                const deltaY = secondMirror.position.y - firstMirror.position.y;
                const distanceSq = deltaX * deltaX + deltaY * deltaY;

                if (distanceSq >= minDistanceSq) {
                    continue;
                }

                const distancePx = Math.sqrt(Math.max(distanceSq, 0.0001));
                let normalX = deltaX / distancePx;
                let normalY = deltaY / distancePx;
                if (distancePx < 0.01) {
                    normalX = 1;
                    normalY = 0;
                }

                const overlapPx = minDistancePx - distancePx;
                const separationStepPx = Math.min(overlapPx * 0.5, pushSpeedPxPerSec * deltaTime);
                if (separationStepPx <= 0) {
                    continue;
                }

                const firstCandidate = new Vector2D(
                    firstMirror.position.x - normalX * separationStepPx,
                    firstMirror.position.y - normalY * separationStepPx
                );
                if (!game.checkCollision(firstCandidate, mirrorRadiusPx, firstMirror)) {
                    firstMirror.position = firstCandidate;
                }

                const secondCandidate = new Vector2D(
                    secondMirror.position.x + normalX * separationStepPx,
                    secondMirror.position.y + normalY * separationStepPx
                );
                if (!game.checkCollision(secondCandidate, mirrorRadiusPx, secondMirror)) {
                    secondMirror.position = secondCandidate;
                }
            }
        }
    }

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
        game: { suns: Sun[]; asteroids: Asteroid[]; shroudCubes?: { getAllBlockingVertexArrays(): Vector2D[][] }[] },
        player: Player,
        structure: Building | StellarForge
    ): number {
        let totalLight = 0;

        // Collect all stopped shroud cube polygon blockers
        const shroudBlockers: { getWorldVertices(): Vector2D[] }[] = [];
        if (game.shroudCubes) {
            for (const cube of game.shroudCubes) {
                for (const verts of cube.getAllBlockingVertexArrays()) {
                    shroudBlockers.push({ getWorldVertices: () => verts });
                }
            }
        }

        for (const mirror of player.solarMirrors) {
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
            if (linkedStructure !== structure) continue;
            if (!mirror.hasLineOfSightToLight(game.suns, game.asteroids, shroudBlockers)) continue;

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
                for (const blocker of shroudBlockers) {
                    if (ray.intersectsPolygon(blocker.getWorldVertices())) {
                        hasLineOfSight = false;
                        break;
                    }
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

    /**
     * Update all solar mirrors for a player for one simulation tick.
     * Handles movement, collision, dust-push, energy generation, and regen sparkles.
     *
     * Extracted from GameState.update() as part of Phase 14 refactoring.
     */
    static updateMirrorsForPlayer(
        game: MirrorSystemContext,
        player: Player,
        deltaTime: number
    ): void {
        // Collect all stopped shroud cube polygon blockers once per player update
        const shroudBlockers: { getWorldVertices(): Vector2D[] }[] = [];
        for (const cube of game.shroudCubes) {
            for (const verts of cube.getAllBlockingVertexArrays()) {
                shroudBlockers.push({ getWorldVertices: () => verts });
            }
        }

        for (const mirror of player.solarMirrors) {
            const oldMirrorPos = new Vector2D(mirror.position.x, mirror.position.y);
            mirror.update(deltaTime, game);

            // Check collision for mirror
            if (game.checkCollision(mirror.position, 20, mirror)) {
                // Revert to old position and stop movement
                mirror.position = oldMirrorPos;
                mirror.velocity = new Vector2D(0, 0);
            }

            PhysicsSystem.applyDustPushFromMovingEntity(
                game,
                mirror.position,
                mirror.velocity,
                Constants.MIRROR_DUST_PUSH_RADIUS_PX,
                Constants.MIRROR_DUST_PUSH_FORCE_MULTIPLIER,
                game.getPlayerImpactColor(player),
                deltaTime
            );

            if (mirror.linkedStructure instanceof Building && mirror.linkedStructure.isDestroyed()) {
                mirror.setLinkedStructure(null);
            }
            if (mirror.linkedStructure instanceof StellarForge && mirror.linkedStructure !== player.stellarForge) {
                mirror.setLinkedStructure(null);
            }

            const initialLinkedStructure = mirror.getLinkedStructure(player.stellarForge);
            const shouldRelinkToForge = initialLinkedStructure instanceof Building &&
                initialLinkedStructure.isComplete &&
                player.stellarForge !== null;
            if (shouldRelinkToForge) {
                mirror.setLinkedStructure(player.stellarForge);
            }
            const linkedStructure = shouldRelinkToForge ? player.stellarForge : initialLinkedStructure;
            mirror.updateReflectionAngle(linkedStructure, game.suns, game.asteroids, deltaTime);

            // Check if light path is blocked by Velaris orb fields
            const isBlockedByVelarisField = VisionSystem.isLightBlockedByVelarisField(
                mirror.position,
                linkedStructure ? linkedStructure.position : mirror.position,
                game.velarisOrbs
            );

            // Check if mirror is inside an Occlude shadow cone (treats it as in shadow)
            const isInOccludeShadow = game.occludeShadowCones.some(cone => cone.containsPoint(mirror.position));

            // Generate energy and apply to linked structure
            if (!isBlockedByVelarisField && !isInOccludeShadow && mirror.hasLineOfSightToLight(game.suns, game.asteroids, shroudBlockers) && linkedStructure) {
                const energyGenerated = mirror.generateEnergy(deltaTime);

                if (linkedStructure instanceof StellarForge &&
                    player.stellarForge &&
                    mirror.hasLineOfSightToForge(player.stellarForge, game.asteroids, game.players)) {
                    const completedForgeItems = player.stellarForge.advanceProductionByEnergy(energyGenerated);
                    for (const completedItem of completedForgeItems) {
                        if (completedItem.productionType === 'hero' && completedItem.heroUnitType) {
                            const allUnits: Unit[] = [];
                            for (const p of game.players) {
                                for (const u of p.units) allUnits.push(u);
                            }
                            const spawnPosition = PhysicsSystem.findFreeSpawnPosition(
                                player.stellarForge.position,
                                player.stellarForge.radius,
                                Constants.UNIT_RADIUS_PX,
                                allUnits
                            );
                            const heroUnit = createHeroUnit(completedItem.heroUnitType, spawnPosition, player);
                            if (heroUnit) {
                                player.units.push(heroUnit);
                                player.unitsCreated++;
                                console.log(`${player.name} forged hero ${completedItem.heroUnitType}`);
                            }
                        } else if (completedItem.productionType === 'mirror' && completedItem.spawnPosition) {
                            if (player.solarMirrors.length < Constants.MAX_SOLAR_MIRRORS_PER_PLAYER) {
                                player.solarMirrors.push(new SolarMirror(
                                    new Vector2D(completedItem.spawnPosition.x, completedItem.spawnPosition.y),
                                    player
                                ));
                            }
                        }
                    }

                    // Add to player's spendable energy pool (non-forge actions)
                    player.addEnergy(energyGenerated);
                } else if (linkedStructure instanceof Building &&
                           mirror.hasLineOfSightToStructure(linkedStructure, game.asteroids, game.players)) {
                    linkedStructure.isReceivingLight = true;
                    linkedStructure.incomingLightPerSec += mirror.getEnergyRatePerSec();
                    // Provide energy to building being constructed
                    if (!linkedStructure.isComplete) {
                        linkedStructure.addEnergy(energyGenerated);
                    }
                } else if (linkedStructure instanceof WarpGate &&
                           mirror.hasLineOfSightToStructure(linkedStructure, game.asteroids, game.players)) {
                    // Provide energy to warp gate
                    const wasIncomplete = !linkedStructure.isComplete;
                    if (linkedStructure.isCharging && !linkedStructure.isComplete) {
                        linkedStructure.addEnergy(energyGenerated);
                    }
                    // If warp gate just completed, redirect mirror to main base
                    if (wasIncomplete && linkedStructure.isComplete && player.stellarForge) {
                        mirror.setLinkedStructure(player.stellarForge);
                    }
                }
            }

            // Mirror health regeneration within player's influence radius
            if (player.stellarForge && mirror.health < Constants.MIRROR_MAX_HEALTH) {
                if (game.isPointWithinPlayerInfluence(player, mirror.position)) {
                    mirror.health = Math.min(
                        Constants.MIRROR_MAX_HEALTH,
                        mirror.health + Constants.MIRROR_REGEN_PER_SEC * deltaTime
                    );

                    // Spawn sparkle particles for regeneration visual effect (~2-3 per second)
                    const rng = getGameRNG();
                    if (rng.next() < deltaTime * 2.5) {
                        const angle = rng.nextAngle();
                        const distance = rng.nextFloat(0, 25);
                        const sparklePos = new Vector2D(
                            mirror.position.x + Math.cos(angle) * distance,
                            mirror.position.y + Math.sin(angle) * distance
                        );
                        const velocity = new Vector2D(
                            rng.nextFloat(-15, 15),
                            rng.nextFloat(-15, 15) - 20 // Slight upward bias
                        );
                        const playerColor = game.getPlayerImpactColor(player);
                        game.sparkleParticles.push(new SparkleParticle(
                            sparklePos,
                            velocity,
                            0.8, // lifetime in seconds
                            playerColor,
                            rng.nextFloat(2, 4) // size 2-4
                        ));
                    }
                }
            }
        }

        this.separateOverlappingMirrorsForPlayer(game, player, deltaTime);
    }
}
