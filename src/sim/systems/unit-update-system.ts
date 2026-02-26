/**
 * UnitUpdateSystem - Handles per-player unit updates each tick.
 *
 * Responsibilities per player per tick:
 * - Build the enemies-list for targeting (units, buildings, mirrors, merge gates, forges, shadow decoys)
 * - Starling AI update (updateAI)
 * - Generic unit.update (movement, targeting)
 * - Aurum hero sunlight speed boost
 * - Shield-tower push-back for enemy units
 * - Starling dust push and Grave fluid forces (space-dust interactions)
 * - Delegate to UnitEffectsSystem.collectEffectsForUnit (projectile/ability effects)
 * - Starling merge-gate and sacrifice updates
 * - Unit death cleanup with death particles
 * - Delegate to BuildingUpdateSystem for building combat / production
 *
 * Extracted from game-state.ts as part of Phase 18 refactoring.
 */

import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Unit } from '../entities/unit';
import { Starling } from '../entities/starling';
import { Building, CombatTarget } from '../entities/buildings';
import { ShieldTower } from '../entities/advanced-buildings';
import { StellarForge } from '../entities/stellar-forge';
import { StarlingMergeGate } from '../entities/starling-merge-gate';
import { Vector2D } from '../math';import { PhysicsSystem, PhysicsContext } from './physics-system';
import { ParticleSystem, ParticleContext } from './particle-system';
import { StarlingSystem } from './starling-system';
import { UnitEffectsContext, UnitEffectsSystem } from './unit-effects-system';
import { BuildingUpdateContext, BuildingUpdateSystem } from './building-update-system';
import {
    Grave,
    SplendorSunlightZone,
    ShadowDecoy,
    Faction,
} from '../../game-core';
import { VisionSystem } from './vision-system';

/**
 * Context required by UnitUpdateSystem.
 * Extends UnitEffectsContext and BuildingUpdateContext (so one GameState reference satisfies all),
 * plus the additional fields needed for the unit loop logic.
 */
export interface UnitUpdateContext extends UnitEffectsContext, BuildingUpdateContext {
    /** Splendor sunlight zones used for Aurum hero isUnitInSunlight check */
    splendorSunlightZones: InstanceType<typeof SplendorSunlightZone>[];
    /** Starling merge gates used to build the enemy-targets list */
    starlingMergeGates: StarlingMergeGate[];
    /** Explosion positions emitted when merge gates release */
    starlingMergeGateExplosions: Vector2D[];
    /** Shadow decoys are added as pseudo-enemies for targeting */
    shadowDecoys: InstanceType<typeof ShadowDecoy>[];
    /** True while the pre-game countdown is active (units are frozen) */
    isCountdownActive: boolean;
    /** Delegate to VisionSystem for Starling AI visibility queries */
    isObjectVisibleToPlayer(pos: Vector2D, player: Player, object?: CombatTarget): boolean;
}

export class UnitUpdateSystem {
    /**
     * Build the list of enemy targets for a player in this tick.
     * Includes units, buildings, mirrors, starling merge gates, forges, and shadow decoys.
     */
    private static buildEnemiesForPlayer(
        ctx: UnitUpdateContext,
        player: Player
    ): CombatTarget[] {
        const enemies: CombatTarget[] = [];

        for (const otherPlayer of ctx.players) {
            if (otherPlayer === player) continue;
            if (otherPlayer.isDefeated()) continue;
            // Skip teammates in team games (3+ players)
            if (ctx.players.length >= 3 && otherPlayer.teamId === player.teamId) continue;

            enemies.push(...otherPlayer.units);
            enemies.push(...otherPlayer.buildings);
            for (const mirror of otherPlayer.solarMirrors) {
                if (mirror.health > 0) {
                    enemies.push(mirror);
                }
            }
            for (const gate of ctx.starlingMergeGates) {
                if (gate.owner === otherPlayer && gate.health > 0) {
                    enemies.push(gate);
                }
            }
            if (otherPlayer.stellarForge) {
                enemies.push(otherPlayer.stellarForge);
            }
            // Shadow decoys count as targetable entities
            for (const decoy of ctx.shadowDecoys) {
                if (decoy.owner === otherPlayer && !decoy.shouldDespawn) {
                    enemies.push(decoy as any);
                }
            }
        }

        return enemies;
    }

    /**
     * Update all units for a single player in this tick.
     * Called inside the per-player loop in GameState.update().
     */
    static updateUnitsForPlayer(
        ctx: UnitUpdateContext,
        player: Player,
        allUnits: Unit[],
        allStructures: CombatTarget[],
        deltaTime: number
    ): void {
        const enemies = UnitUpdateSystem.buildEnemiesForPlayer(ctx, player);

        // Update each unit (only after countdown)
        if (!ctx.isCountdownActive) {
            for (const unit of player.units) {
                // Starlings need special AI update before regular update
                if (unit instanceof Starling) {
                    unit.updateAI(ctx, enemies);
                }

                unit.update(deltaTime, enemies, allUnits, ctx.asteroids);

                // Aurum hero sunlight speed boost
                if (unit.isHero && unit.owner.faction === Faction.AURUM) {
                    const inSunlight = VisionSystem.isUnitInSunlight(
                        unit.position,
                        unit.owner,
                        ctx.suns,
                        ctx.asteroids,
                        ctx.splendorSunlightZones
                    );
                    if (inSunlight) {
                        unit.position.x += unit.velocity.x * deltaTime * (Constants.AURUM_HERO_SUNLIGHT_SPEED_MULTIPLIER - 1);
                        unit.position.y += unit.velocity.y * deltaTime * (Constants.AURUM_HERO_SUNLIGHT_SPEED_MULTIPLIER - 1);
                    }
                }

                // Apply shield blocking from enemy ShieldTowers (not allied ones)
                for (const enemyPlayer of ctx.players) {
                    if (enemyPlayer === unit.owner) continue;
                    if (ctx.players.length >= 3 && enemyPlayer.teamId === unit.owner.teamId) continue;

                    for (const building of enemyPlayer.buildings) {
                        if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
                            const dx = unit.position.x - building.position.x;
                            const dy = unit.position.y - building.position.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance < building.shieldRadius) {
                                const pushDistance = building.shieldRadius - distance;
                                if (distance > Constants.SHIELD_CENTER_COLLISION_THRESHOLD) {
                                    const dirX = dx / distance;
                                    const dirY = dy / distance;
                                    unit.position.x += dirX * pushDistance;
                                    unit.position.y += dirY * pushDistance;
                                } else {
                                    unit.position.x += pushDistance;
                                }
                                unit.velocity.x = 0;
                                unit.velocity.y = 0;
                            }
                        }
                    }
                }

                // Starling dust push
                if (unit instanceof Starling) {
                    PhysicsSystem.applyDustPushFromMovingEntity(
                        ctx,
                        unit.position,
                        unit.velocity,
                        Constants.STARLING_DUST_PUSH_RADIUS_PX,
                        Constants.STARLING_DUST_PUSH_FORCE_MULTIPLIER,
                        ctx.getPlayerImpactColor(unit.owner),
                        deltaTime
                    );
                }

                // Grave fluid forces from projectiles
                if (unit instanceof Grave) {
                    for (const projectile of unit.getProjectiles()) {
                        if (projectile.isAttacking) {
                            const projectileSpeed = Math.sqrt(
                                projectile.velocity.x ** 2 + projectile.velocity.y ** 2
                            );
                            PhysicsSystem.applyFluidForceFromMovingObject(
                                ctx,
                                projectile.position,
                                projectile.velocity,
                                Constants.GRAVE_PROJECTILE_EFFECT_RADIUS,
                                projectileSpeed * Constants.GRAVE_PROJECTILE_FORCE_MULTIPLIER,
                                ctx.getPlayerImpactColor(unit.owner),
                                deltaTime
                            );
                        }
                    }
                }

                // Collect projectile/ability effects
                UnitEffectsSystem.collectEffectsForUnit(unit, ctx, enemies, deltaTime);
            }
        } // End countdown check

        if (!ctx.isCountdownActive) {
            StarlingSystem.updateStarlingMergeGatesForPlayer(ctx, player, deltaTime);
        }

        if (!ctx.isCountdownActive) {
            StarlingSystem.processStarlingSacrificesForPlayer(player);
        }

        // Remove dead units and track losses
        const deadUnits = player.units.filter(unit => unit.isDead());
        for (const deadUnit of deadUnits) {
            const color = ctx.getPlayerImpactColor(player);
            ParticleSystem.createDeathParticles(ctx, deadUnit, color);
        }
        player.unitsLost += deadUnits.length;
        player.units = player.units.filter(unit => !unit.isDead());

        // Update each building (only after countdown)
        if (!ctx.isCountdownActive) {
            BuildingUpdateSystem.updateBuildingsForPlayer(
                ctx,
                player,
                enemies,
                allUnits,
                allStructures,
                deltaTime
            );
        }
    }
}
