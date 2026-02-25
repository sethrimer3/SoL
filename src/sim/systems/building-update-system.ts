/**
 * Building Update System
 * Handles per-player building updates: combat, effect collection, production,
 * construction, and cleanup.
 *
 * Extracted from game-state.ts as part of Phase 15 refactoring.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Unit } from '../entities/unit';
import { StellarForge } from '../entities/stellar-forge';
import {
    Building,
    CombatTarget,
    Minigun,
    GatlingTower,
    LockOnLaserTower,
    SubsidiaryFactory,
    StrikerTower,
} from '../entities/buildings';
import {
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    LaserBeam,
} from '../entities/particles';
import { ParticleContext, ParticleSystem } from './particle-system';

/**
 * Context required by BuildingUpdateSystem.updateBuildingsForPlayer.
 * Extends ParticleContext so death-particle helpers can be called directly.
 */
export interface BuildingUpdateContext extends ParticleContext {
    // Shot effect arrays (written to during building updates)
    muzzleFlashes: MuzzleFlash[];
    bulletCasings: BulletCasing[];
    bouncingBullets: BouncingBullet[];
    laserBeams: LaserBeam[];

    // Striker-tower explosion tracking
    strikerTowerExplosions: { position: Vector2D; timestamp: number }[];

    // Methods needed for building logic
    isPointInShadow(pos: Vector2D): boolean;
    isPositionVisibleByPlayerUnits(pos: Vector2D, playerUnits: Unit[]): boolean;
    isPointWithinPlayerInfluence(player: Player, point: Vector2D): boolean;
    getMirrorLightOnStructure(player: Player, structure: Building | StellarForge): number;
    getPlayerImpactColor(player: Player): string;
}

/**
 * Building Update System – processes buildings for one player per tick.
 * Covers combat updates, effect collection, foundry production, construction
 * progress, and removal of destroyed buildings.
 */
export class BuildingUpdateSystem {
    /**
     * Update all buildings owned by the given player for one tick.
     *
     * @param ctx           - Context providing game-state arrays and helpers.
     * @param player        - The player whose buildings to update.
     * @param enemies       - Enemy targets for building targeting AI.
     * @param allUnits      - All living units (needed by building.update).
     * @param allStructures - All living structures (needed by building.update).
     * @param deltaTime     - Elapsed seconds since last tick.
     */
    static updateBuildingsForPlayer(
        ctx: BuildingUpdateContext,
        player: Player,
        enemies: CombatTarget[],
        allUnits: Unit[],
        allStructures: CombatTarget[],
        deltaTime: number
    ): void {
        // Update each building (only after countdown – caller must guard this)
        for (const building of player.buildings) {
            building.update(deltaTime, enemies, allUnits, ctx.asteroids, allStructures, Constants.MAP_PLAYABLE_BOUNDARY);

            // Check if StrikerTower countdown completed
            if (building instanceof StrikerTower && building.targetPosition && building.countdownTimer <= 0.001 && building.isMissileReady()) {
                // Countdown complete, fire the missile!
                const targetPos = building.targetPosition;
                const fired = building.fireMissile(
                    targetPos,
                    enemies,
                    (pos) => ctx.isPointInShadow(pos),
                    (pos, playerUnits) => ctx.isPositionVisibleByPlayerUnits(pos, playerUnits),
                    player.units
                );

                // Track explosion for visual effect and trigger screen shake
                if (fired) {
                    ctx.strikerTowerExplosions.push({
                        position: targetPos,
                        timestamp: ctx.gameTime
                    });
                }
            }

            // If building is a Cannon or Gatling Tower, collect its effects
            if (building instanceof Minigun || building instanceof GatlingTower) {
                const effects = building.getAndClearLastShotEffects();
                if (effects.muzzleFlash) {
                    ctx.muzzleFlashes.push(effects.muzzleFlash);
                }
                if (effects.casing) {
                    ctx.bulletCasings.push(effects.casing);
                }
                if (effects.bouncingBullet) {
                    ctx.bouncingBullets.push(effects.bouncingBullet);
                }
            }

            if (building instanceof Minigun || building instanceof LockOnLaserTower) {
                const lasers = building.getAndClearLastShotLasers();
                if (lasers.length > 0) {
                    ctx.laserBeams.push(...lasers);
                }
            }

            // If building is a Foundry, check for completed production
            if (building instanceof SubsidiaryFactory) {
                if (building.currentProduction) {
                    const totalLight = ctx.getMirrorLightOnStructure(player, building);
                    if (totalLight > 0) {
                        const buildRate = (totalLight / 10.0) * (1.0 / Constants.BUILDING_BUILD_TIME);
                        const buildProgress = buildRate * deltaTime;
                        building.addProductionProgress(buildProgress);
                    }
                }
                const completedProduction = building.getCompletedProduction();
                if (completedProduction === Constants.FOUNDRY_STRAFE_UPGRADE_ITEM) {
                    building.upgradeStrafe();
                } else if (completedProduction === Constants.FOUNDRY_REGEN_UPGRADE_ITEM) {
                    building.upgradeRegen();
                } else if (completedProduction === Constants.FOUNDRY_ATTACK_UPGRADE_ITEM) {
                    building.upgradeAttack();
                } else if (completedProduction === Constants.FOUNDRY_BLINK_UPGRADE_ITEM) {
                    building.upgradeBlink();
                }
            }
        }

        // Update building construction (only after countdown – caller must guard this)
        for (const building of player.buildings) {
            if (building.isComplete) continue; // Skip completed buildings

            // Check if building is inside player's influence (near stellar forge)
            const isInInfluence = ctx.isPointWithinPlayerInfluence(player, building.position);

            if (isInInfluence && player.stellarForge) {
                // Building inside influence: take energy from forge
                const buildRate = 1.0 / Constants.BUILDING_BUILD_TIME;
                const buildProgress = buildRate * deltaTime;
                building.addBuildProgress(buildProgress);
            } else {
                // Building outside influence: powered by mirrors shining on it
                const totalLight = ctx.getMirrorLightOnStructure(player, building);

                // Convert light to build progress
                if (totalLight > 0) {
                    const buildRate = (totalLight / 10.0) * (1.0 / Constants.BUILDING_BUILD_TIME);
                    const buildProgress = buildRate * deltaTime;
                    building.addBuildProgress(buildProgress);
                }
            }
        }

        // Remove destroyed buildings
        const destroyedBuildings = player.buildings.filter(building => building.isDestroyed());
        for (const building of destroyedBuildings) {
            // Create death particles for visual effect
            const color = ctx.getPlayerImpactColor(player);
            ParticleSystem.createDeathParticles(ctx, building, color);
        }
        player.buildings = player.buildings.filter(building => !building.isDestroyed());
    }
}
