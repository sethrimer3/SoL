/**
 * PlayerStructureSystem - Handles per-player structure updates each tick.
 *
 * Responsibilities:
 * - Mirror destruction cleanup (death particles)
 * - Stellar Forge light status, movement, collision, and dust push
 * - Forge crunch: spawning Starlings when the forge has surplus energy
 * - Building light reset (per-tick bookkeeping before mirror sweep)
 * - Delegating mirror movement to MirrorSystem
 *
 * Extracted from game-state.ts as part of Phase 17 refactoring.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Starling } from '../entities/starling';
import { SolarMirror } from '../entities/solar-mirror';
import { PhysicsSystem } from '../systems/physics-system';
import { ParticleSystem, ParticleContext } from '../systems/particle-system';
import { MirrorSystem, MirrorSystemContext } from '../systems/mirror-system';
import { StarlingSystem } from '../systems/starling-system';

/**
 * Minimal context required by PlayerStructureSystem.
 * Extends MirrorSystemContext (which extends PhysicsContext + MirrorMovementContext)
 * and ParticleContext so death-particle helpers and mirror helpers are available.
 */
export interface PlayerStructureContext extends MirrorSystemContext, ParticleContext {
    isCountdownActive: boolean;
    getPlayerImpactColor(player: Player): string;
}

export class PlayerStructureSystem {
    /**
     * Update all structure-related state for one player per tick.
     * Called inside the per-player loop in GameState.update().
     */
    static updateStructuresForPlayer(
        ctx: PlayerStructureContext,
        player: Player,
        deltaTime: number
    ): void {
        // ----- Mirror destruction -----
        if (player.solarMirrors.length > 0) {
            const destroyedMirrors = player.solarMirrors.filter(mirror => mirror.health <= 0);
            if (destroyedMirrors.length > 0) {
                const color = ctx.getPlayerImpactColor(player);
                for (const mirror of destroyedMirrors) {
                    ParticleSystem.createDeathParticlesForMirror(ctx, mirror, color);
                }
            }
            player.solarMirrors = player.solarMirrors.filter(mirror => mirror.health > 0);
        }

        // ----- Stellar Forge update -----
        if (player.stellarForge) {
            const oldForgePos = new Vector2D(
                player.stellarForge.position.x,
                player.stellarForge.position.y
            );
            player.stellarForge.updateLightStatus(
                player.solarMirrors,
                ctx.suns,
                ctx.asteroids,
                ctx.players
            );

            if (!ctx.isCountdownActive) {
                // Update forge movement (includes obstacle avoidance)
                player.stellarForge.update(deltaTime, ctx);

                // Check collision and revert if needed
                if (ctx.checkCollision(
                    player.stellarForge.position,
                    player.stellarForge.radius,
                    player.stellarForge
                )) {
                    player.stellarForge.position = oldForgePos;
                    player.stellarForge.targetPosition = null;
                    player.stellarForge.velocity = new Vector2D(0, 0);
                }

                // Forge dust push
                PhysicsSystem.applyDustPushFromMovingEntity(
                    ctx,
                    player.stellarForge.position,
                    player.stellarForge.velocity,
                    Constants.FORGE_DUST_PUSH_RADIUS_PX,
                    Constants.FORGE_DUST_PUSH_FORCE_MULTIPLIER,
                    ctx.getPlayerImpactColor(player),
                    deltaTime
                );
            }

            // ----- Forge crunch: spawn Starlings from surplus energy -----
            if (!ctx.isCountdownActive) {
                const energyForMinions = player.stellarForge.shouldCrunch();
                if (energyForMinions > 0) {
                    const currentStarlingCount = StarlingSystem.getStarlingCountForPlayer(player);
                    const availableStarlingSlots = Math.max(
                        0,
                        Constants.STARLING_MAX_COUNT - currentStarlingCount
                    );
                    const numStarlings = Math.min(
                        Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY),
                        availableStarlingSlots
                    );
                    const usedEnergy = numStarlings * Constants.STARLING_COST_PER_ENERGY;
                    const unusedEnergy = Math.max(0, energyForMinions - usedEnergy);
                    if (unusedEnergy > 0) {
                        player.stellarForge.addPendingEnergy(unusedEnergy);
                    }

                    if (numStarlings > 0) {
                        for (let i = 0; i < numStarlings; i++) {
                            const angle = (Math.PI * 2 * i) / numStarlings;
                            const spawnRadius =
                                player.stellarForge.radius +
                                Constants.STARLING_COLLISION_RADIUS_PX +
                                5;
                            const spawnPosition = new Vector2D(
                                player.stellarForge.position.x + Math.cos(angle) * spawnRadius,
                                player.stellarForge.position.y + Math.sin(angle) * spawnRadius
                            );
                            const starling = new Starling(
                                spawnPosition,
                                player,
                                player.stellarForge.minionPath ?? []
                            );
                            player.units.push(starling);
                            player.unitsCreated++;
                        }

                        console.log(
                            `${player.name} forge crunch spawned ${numStarlings} Starlings` +
                            ` with ${energyForMinions.toFixed(0)} energy`
                        );
                    }
                }
            }
        }

        // ----- Building light reset (before mirror sweep) -----
        for (const building of player.buildings) {
            building.isReceivingLight = false;
            building.incomingLightPerSec = 0;
        }

        // ----- Mirror movement + reflection angle (delegates to MirrorSystem) -----
        MirrorSystem.updateMirrorsForPlayer(ctx, player, deltaTime);
    }
}
