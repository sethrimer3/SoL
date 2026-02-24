/**
 * State Hash Computation
 *
 * Computes a deterministic hash of the game state for multiplayer desync detection.
 * The hash covers all simulation-critical fields so that any divergence between
 * peers is detected at the next STATE_HASH_TICK_INTERVAL tick.
 *
 * Extracted from GameState.updateStateHash() as part of Phase 8 refactoring.
 */

import { Player } from './entities/player';
import { StellarForge } from './entities/stellar-forge';
import { Building, SubsidiaryFactory } from './entities/buildings';
import { SolarMirror } from './entities/solar-mirror';
import { Starling } from './entities/starling';
import { StarlingMergeGate } from './entities/starling-merge-gate';
import { WarpGate } from './entities/warp-gate';
import { Unit } from './entities/unit';
import {
    SpaceDustParticle,
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    MinionProjectile,
} from './entities/particles';
import { Spotlight, Grave } from '../game-core';
import * as Constants from '../constants';

/**
 * Minimal context interface for state hash computation.
 * GameState satisfies this interface via structural typing.
 */
export interface StateHashContext {
    gameTime: number;
    suns: unknown[];
    asteroids: unknown[];
    spaceDust: SpaceDustParticle[];
    players: Player[];
    starlingMergeGates: InstanceType<typeof StarlingMergeGate>[];
    warpGates: WarpGate[];
    minionProjectiles: MinionProjectile[];
    muzzleFlashes: MuzzleFlash[];
    bulletCasings: BulletCasing[];
    bouncingBullets: BouncingBullet[];
}

/**
 * Compute a FNV-1a-inspired hash over all simulation-critical state fields.
 * Returns the hash as an unsigned 32-bit integer.
 */
export function computeStateHash(state: StateHashContext): number {
    let hash = 2166136261;

    const mix = (value: number): void => {
        const normalizedValue = Math.floor(value * 100);
        hash = Math.imul(hash ^ normalizedValue, 16777619);
    };

    const mixInt = (value: number): void => {
        hash = Math.imul(hash ^ value, 16777619);
    };

    const mixString = (value: string): void => {
        mixInt(value.length);
        for (let i = 0; i < value.length; i++) {
            mixInt(value.charCodeAt(i));
        }
    };

    mix(state.gameTime);
    mix(state.suns.length);
    mix(state.asteroids.length);
    mix(Constants.DUST_MIN_VELOCITY);
    mixInt(state.spaceDust.length);
    for (const particle of state.spaceDust) {
        mix(particle.position.x);
        mix(particle.position.y);
        mix(particle.velocity.x);
        mix(particle.velocity.y);
        mix(particle.glowTransition);
        mixInt(particle.glowState);
        mixInt(particle.targetGlowState);
        mix(particle.impactBlend);
        mix(particle.impactTargetBlend);
        mix(particle.impactHoldTimeSec);
        mixString(particle.baseColor);
        mixString(particle.impactColor ?? '');
    }

    for (const player of state.players) {
        mix(player.energy);
        mixInt(player.isAi ? 1 : 0);
        mix(player.aiNextMirrorCommandSec);
        mix(player.aiNextDefenseCommandSec);
        mix(player.aiNextHeroCommandSec);
        mix(player.aiNextStructureCommandSec);
        mix(player.aiNextMirrorPurchaseCommandSec);
        mixString(player.aiStrategy);
        mixString(player.aiDifficulty);
        mixInt(player.hasStrafeUpgrade ? 1 : 0);
        mixInt(player.hasRegenUpgrade ? 1 : 0);
        mixInt(player.hasBlinkUpgrade ? 1 : 0);
        mixInt(player.hasAttackUpgrade ? 1 : 0);
        mixInt(player.units.length);

        if (player.stellarForge) {
            mix(player.stellarForge.position.x);
            mix(player.stellarForge.position.y);
            mix(player.stellarForge.health);
            mixInt(player.stellarForge.unitQueue.length);
            for (const unitType of player.stellarForge.unitQueue) {
                mixString(unitType);
            }
            mixString(player.stellarForge.heroProductionUnitType ?? '');
            mix(player.stellarForge.heroProductionRemainingSec);
            mix(player.stellarForge.heroProductionDurationSec);
            mix(player.stellarForge.crunchTimer);
            mix(player.stellarForge.rotation);
            if (player.stellarForge.targetPosition) {
                mix(player.stellarForge.targetPosition.x);
                mix(player.stellarForge.targetPosition.y);
            } else {
                mix(-1);
                mix(-1);
            }
            mix(player.stellarForge.velocity.x);
            mix(player.stellarForge.velocity.y);
        } else {
            mix(-1);
        }

        for (const mirror of player.solarMirrors) {
            mix(mirror.position.x);
            mix(mirror.position.y);
            mix(mirror.health);
            mix(mirror.efficiency);
            mix(mirror.reflectionAngle);
            if (mirror.linkedStructure) {
                if (mirror.linkedStructure instanceof StellarForge) {
                    mixInt(1);
                } else {
                    mixInt(2);
                }
                mix(mirror.linkedStructure.position.x);
                mix(mirror.linkedStructure.position.y);
            } else {
                mixInt(0);
                mix(-1);
                mix(-1);
            }
            if (mirror.targetPosition) {
                mix(mirror.targetPosition.x);
                mix(mirror.targetPosition.y);
            } else {
                mix(-1);
                mix(-1);
            }
            mix(mirror.velocity.x);
            mix(mirror.velocity.y);
        }

        for (const unit of player.units) {
            mixUnitFields(unit, state, mix, mixInt, mixString);
        }

        for (const building of player.buildings) {
            mix(building.position.x);
            mix(building.position.y);
            mix(building.health);
            mix(building.isComplete ? 1 : 0);
            if (building instanceof SubsidiaryFactory) {
                mix(building.productionProgress);
                mixString(building.currentProduction ?? '');
                mixInt(building.productionQueue.length);
                for (const itemType of building.productionQueue) {
                    mixString(itemType);
                }
            }
        }
    }

    mixInt(state.starlingMergeGates.length);
    for (const gate of state.starlingMergeGates) {
        mix(gate.position.x);
        mix(gate.position.y);
        mix(gate.remainingSec);
        mix(gate.health);
        mixInt(gate.absorbedCount);
        mixInt(gate.assignedStarlings.length);
        mixInt(state.players.indexOf(gate.owner));
    }

    mixInt(state.warpGates.length);
    for (const gate of state.warpGates) {
        mix(gate.position.x);
        mix(gate.position.y);
        mix(gate.chargeTime);
        mix(gate.accumulatedEnergy);
        mixInt(gate.isCharging ? 1 : 0);
        mixInt(gate.isComplete ? 1 : 0);
        mixInt(gate.isCancelling ? 1 : 0);
        mixInt(gate.hasDissipated ? 1 : 0);
        mix(gate.completionRemainingSec);
        mix(gate.health);
        mixInt(state.players.indexOf(gate.owner));
    }

    mixInt(state.minionProjectiles.length);
    for (const projectile of state.minionProjectiles) {
        mix(projectile.position.x);
        mix(projectile.position.y);
        mix(projectile.velocity.x);
        mix(projectile.velocity.y);
        mix(projectile.damage);
        mix(projectile.distanceTraveledPx);
        mix(projectile.maxRangePx);
        mixInt(state.players.indexOf(projectile.owner));
    }

    mixInt(state.muzzleFlashes.length);
    for (const flash of state.muzzleFlashes) {
        mix(flash.position.x);
        mix(flash.position.y);
        mix(flash.angle);
        mix(flash.lifetime);
        mix(flash.maxLifetime);
    }

    mixInt(state.bulletCasings.length);
    for (const casing of state.bulletCasings) {
        mix(casing.position.x);
        mix(casing.position.y);
        mix(casing.velocity.x);
        mix(casing.velocity.y);
        mix(casing.rotation);
        mix(casing.rotationSpeed);
        mix(casing.lifetime);
        mix(casing.maxLifetime);
    }

    mixInt(state.bouncingBullets.length);
    for (const bullet of state.bouncingBullets) {
        mix(bullet.position.x);
        mix(bullet.position.y);
        mix(bullet.velocity.x);
        mix(bullet.velocity.y);
        mix(bullet.lifetime);
        mix(bullet.maxLifetime);
    }

    return hash >>> 0;
}

/**
 * Hash all simulation-critical fields of a single unit.
 * Broken out as a helper to keep computeStateHash readable.
 */
function mixUnitFields(
    unit: Unit,
    state: StateHashContext,
    mix: (v: number) => void,
    mixInt: (v: number) => void,
    mixString: (v: string) => void
): void {
    mix(unit.position.x);
    mix(unit.position.y);
    mix(unit.velocity.x);
    mix(unit.velocity.y);
    mix(unit.rotation);
    mix(unit.health);
    mix(unit.isHero ? 1 : 0);
    mix(unit.collisionRadiusPx);
    mixInt(unit.moveOrder);
    if (unit.rallyPoint) {
        mix(unit.rallyPoint.x);
        mix(unit.rallyPoint.y);
    } else {
        mix(-1);
        mix(-1);
    }
    const manualTarget = unit.getManualTarget();
    if (manualTarget) {
        mixInt(1);
        if (manualTarget instanceof StellarForge) {
            mixInt(1);
        } else if (manualTarget instanceof Building) {
            mixInt(2);
        } else if (manualTarget instanceof SolarMirror) {
            mixInt(3);
        } else {
            mixInt(4);
        }
        mix(manualTarget.position.x);
        mix(manualTarget.position.y);
        if ('owner' in manualTarget && manualTarget.owner) {
            mixInt(state.players.indexOf(manualTarget.owner as Player));
        } else {
            mixInt(-1);
        }
    } else {
        mixInt(0);
        mix(-1);
        mix(-1);
        mixInt(-1);
    }
    if (unit instanceof Starling) {
        mixInt(unit.getAssignedPathLength());
        mixInt(unit.getCurrentPathWaypointIndex());
        mixInt(unit.hasActiveManualOrder() ? 1 : 0);
        mix(unit.getCurrentMoveSpeedPxPerSec());
        mix(unit.abilityCooldown);
        mixInt(unit.getHasReachedFinalWaypoint() ? 1 : 0);
        mixString(unit.getPathHash());
    }
    if (unit instanceof Spotlight) {
        mixInt(unit.getSpotlightStateCode());
        mix(unit.spotlightStateElapsedSec);
        mix(unit.spotlightFireCooldownSec);
        mix(unit.spotlightLengthFactor);
        mix(unit.spotlightRangePx);
        if (unit.spotlightDirection) {
            mix(unit.spotlightDirection.x);
            mix(unit.spotlightDirection.y);
        } else {
            mix(-1);
            mix(-1);
        }
    }
    if (unit instanceof Grave) {
        mix(unit.getSmallParticleCount());
        mix(unit.projectileLaunchCooldown);
        mix(unit.smallParticleRegenTimer);
        mixInt(unit.isUsingAbility ? 1 : 0);
        const graveProjectiles = unit.getProjectiles();
        mixInt(graveProjectiles.length);
        for (const graveProjectile of graveProjectiles) {
            mix(graveProjectile.position.x);
            mix(graveProjectile.position.y);
            mix(graveProjectile.velocity.x);
            mix(graveProjectile.velocity.y);
            mix(graveProjectile.lifetime);
            mix(graveProjectile.targetAngle);
            mixInt(graveProjectile.isAttacking ? 1 : 0);
            if (graveProjectile.targetEnemy) {
                mixInt(1);
                mix(graveProjectile.targetEnemy.position.x);
                mix(graveProjectile.targetEnemy.position.y);
            } else {
                mixInt(0);
                mix(-1);
                mix(-1);
            }
        }
    }
}
