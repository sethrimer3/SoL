/**
 * ProjectileCombatSystem
 * Handles projectile updates and collision detection extracted from game-state.ts
 *
 * Extracted from game-state.ts as part of Phase 7 refactoring
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Asteroid } from '../entities/asteroid';
import { DamageNumber } from '../entities/damage-number';
import {
    SpaceDustParticle,
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    AbilityBullet,
    MinionProjectile,
} from '../entities/particles';
import {
    MortarProjectile,
    InfluenceZone,
    InfluenceBallProjectile,
    AurumOrb,
    AurumShieldHit,
    Tank,
    ShieldTower,
    SpaceDustSwirler,
    CombatTarget,
} from '../../game-core';
import { PhysicsSystem } from '../systems/physics-system';
import { Unit } from '../entities/unit';
import { StarlingMergeGate } from '../entities/starling-merge-gate';

/**
 * Context required by ProjectileCombatSystem.update
 */
export interface ProjectileCombatContext {
    // Arrays (read/write)
    muzzleFlashes: MuzzleFlash[];
    bulletCasings: BulletCasing[];
    bouncingBullets: BouncingBullet[];
    abilityBullets: AbilityBullet[];
    mortarProjectiles: InstanceType<typeof MortarProjectile>[];
    minionProjectiles: MinionProjectile[];
    influenceZones: InstanceType<typeof InfluenceZone>[];
    influenceBallProjectiles: InstanceType<typeof InfluenceBallProjectile>[];
    aurumShieldHits: InstanceType<typeof AurumShieldHit>[];
    damageNumbers: DamageNumber[];

    // Arrays (readonly)
    spaceDust: SpaceDustParticle[];
    aurumOrbs: InstanceType<typeof AurumOrb>[];
    players: Player[];
    starlingMergeGates: StarlingMergeGate[];
    asteroids: Asteroid[];

    // Spatial hash (required by PhysicsSystem)
    dustSpatialHash: Map<number, number[]>;
    dustSpatialHashKeys: number[];

    // Scalar values
    gameTime: number;

    // Methods
    getPlayerImpactColor(player: Player): string;
    addDamageNumber(
        position: Vector2D,
        damage: number,
        maxHealth: number,
        currentHealth: number,
        unitKey?: string | null,
        sourcePlayer?: Player | null,
        incomingDirection?: Vector2D | null,
        isBlocked?: boolean
    ): void;
}

export class ProjectileCombatSystem {
    private static pointToLineSegmentDistanceSquared(
        point: Vector2D,
        lineStart: Vector2D,
        lineEnd: Vector2D
    ): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // Line segment is a point
            const px = point.x - lineStart.x;
            const py = point.y - lineStart.y;
            return px * px + py * py;
        }

        // Calculate projection parameter
        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
        ));

        // Calculate closest point on line segment
        const closestX = lineStart.x + t * dx;
        const closestY = lineStart.y + t * dy;

        // Return squared distance
        const distX = point.x - closestX;
        const distY = point.y - closestY;
        return distX * distX + distY * distY;
    }

    private static getClosestPointOnLineSegment(
        point: Vector2D,
        lineStart: Vector2D,
        lineEnd: Vector2D
    ): Vector2D {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return new Vector2D(lineStart.x, lineStart.y);
        }

        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
        ));

        return new Vector2D(
            lineStart.x + t * dx,
            lineStart.y + t * dy
        );
    }

    static update(ctx: ProjectileCombatContext, deltaTime: number): void {
        // Update muzzle flashes
        for (const flash of ctx.muzzleFlashes) {
            flash.update(deltaTime);
        }
        ctx.muzzleFlashes = ctx.muzzleFlashes.filter(flash => !flash.shouldDespawn());

        // Update bullet casings and interact with space dust
        for (const casing of ctx.bulletCasings) {
            casing.update(deltaTime);

            // Check collision with space dust particles
            for (const particle of ctx.spaceDust) {
                const distance = casing.position.distanceTo(particle.position);
                if (distance < Constants.CASING_SPACEDUST_COLLISION_DISTANCE) {
                    // Apply force to both casing and particle
                    const direction = new Vector2D(
                        particle.position.x - casing.position.x,
                        particle.position.y - casing.position.y
                    ).normalize();

                    particle.applyForce(new Vector2D(
                        direction.x * Constants.CASING_SPACEDUST_FORCE,
                        direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));

                    // Apply counter-force to casing (damping applied in applyCollision method)
                    casing.applyCollision(new Vector2D(
                        -direction.x * Constants.CASING_SPACEDUST_FORCE,
                        -direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));
                }
            }
        }
        ctx.bulletCasings = ctx.bulletCasings.filter(casing => !casing.shouldDespawn());

        // Update bouncing bullets
        for (const bullet of ctx.bouncingBullets) {
            bullet.update(deltaTime);
        }
        ctx.bouncingBullets = ctx.bouncingBullets.filter(bullet => !bullet.shouldDespawn());

        // Update ability bullets and check for hits
        for (const bullet of ctx.abilityBullets) {
            bullet.update(deltaTime);

            // Check if projectile is blocked by Tank shields
            let isBlocked = false;
            for (const player of ctx.players) {
                for (const unit of player.units) {
                    if (unit instanceof Tank && unit.isPositionInShield(bullet.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (bullet.owner !== player) {
                            isBlocked = true;
                            bullet.lifetime = bullet.maxLifetime; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked) break;
            }
            if (isBlocked) continue;

            // Check if projectile is blocked by Aurum shields
            let blockedByAurum = false;
            for (const player of ctx.players) {
                // Skip friendly fire
                if (player === bullet.owner) continue;

                // Check all Aurum orbs for this player
                const playerAurumOrbs = ctx.aurumOrbs.filter(orb => orb.owner === player);

                // Check if projectile crosses any shield field
                for (let i = 0; i < playerAurumOrbs.length; i++) {
                    for (let j = i + 1; j < playerAurumOrbs.length; j++) {
                        const orb1 = playerAurumOrbs[i];
                        const orb2 = playerAurumOrbs[j];

                        const distance = orb1.position.distanceTo(orb2.position);
                        const maxRange = Math.min(orb1.getRange(), orb2.getRange());

                        if (distance <= maxRange) {
                            // Calculate distance from bullet to shield line
                            const distSq = ProjectileCombatSystem.pointToLineSegmentDistanceSquared(
                                bullet.position,
                                orb1.position,
                                orb2.position
                            );

                            // Shield starts offset from orbs
                            const shieldOffset = Constants.AURUM_SHIELD_OFFSET;
                            const distToOrb1 = bullet.position.distanceTo(orb1.position);
                            const distToOrb2 = bullet.position.distanceTo(orb2.position);

                            // Only block if not too close to orbs (leave them vulnerable)
                            if (distToOrb1 > shieldOffset && distToOrb2 > shieldOffset) {
                                const shieldWidth = 10; // Shield field width in pixels
                                if (distSq < shieldWidth * shieldWidth) {
                                    // Create shield hit effect
                                    const closestPoint = ProjectileCombatSystem.getClosestPointOnLineSegment(
                                        bullet.position,
                                        orb1.position,
                                        orb2.position
                                    );
                                    ctx.aurumShieldHits.push(new AurumShieldHit(closestPoint, player));

                                    blockedByAurum = true;
                                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                                    break;
                                }
                            }
                        }
                    }
                    if (blockedByAurum) break;
                }
                if (blockedByAurum) break;
            }
            if (blockedByAurum) continue;

            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of ctx.players) {
                for (const building of player.buildings) {
                    if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
                        // Shield blocks enemy projectiles but not friendly fire
                        if (bullet.owner !== player && building.isEnemyBlocked(bullet.position)) {
                            // Damage the shield instead of letting projectile through
                            building.damageShield(bullet.damage);
                            bullet.lifetime = bullet.maxLifetime; // Mark for removal
                            blockedByShield = true;
                            break;
                        }
                    }
                }
                if (blockedByShield) break;
            }
            if (blockedByShield) continue;

            // Check if healing bomb reached max range or lifetime - if so, explode
            if (bullet.isHealingBomb && bullet.healingBombOwner && bullet.shouldDespawn()) {
                bullet.healingBombOwner.explodeHealingBomb(bullet.position);
            }

            // Apply fluid-like force to space dust particles
            const bulletSpeed = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
            PhysicsSystem.applyFluidForceFromMovingObject(
                ctx,
                bullet.position,
                bullet.velocity,
                Constants.ABILITY_BULLET_EFFECT_RADIUS,
                bulletSpeed * Constants.ABILITY_BULLET_FORCE_MULTIPLIER,
                ctx.getPlayerImpactColor(bullet.owner),
                deltaTime
            );

            // Check hits against enemies
            for (const player of ctx.players) {
                // Skip if same team as bullet
                if (player === bullet.owner) {
                    continue;
                }

                // Skip hit detection for healing bombs (they explode on max range/lifetime)
                if (bullet.isHealingBomb) {
                    continue;
                }

                // Check hits on units
                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        let finalDamage = bullet.damage;

                        // Check if this is a Beam projectile for distance-based damage
                        if (bullet.isBeamProjectile && bullet.beamOwner) {
                            const beamOwner = bullet.beamOwner;
                            const distance = beamOwner.position.distanceTo(unit.position);
                            const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                            finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);

                            // Store info for display above Beam unit
                            beamOwner.lastBeamDamage = finalDamage;
                            beamOwner.lastBeamDistance = distance;
                            beamOwner.lastBeamMultiplier = multiplier;
                            beamOwner.lastBeamTime = ctx.gameTime;
                        }

                        const previousHealth = unit.health;
                        unit.takeDamage(finalDamage);
                        const actualDamage = Math.max(0, previousHealth - unit.health);
                        const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                        ctx.addDamageNumber(
                            unit.position,
                            actualDamage,
                            unit.maxHealth,
                            unit.health,
                            unitKey,
                            bullet.owner,
                            bullet.velocity,
                            actualDamage <= 0
                        );
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }

                if (bullet.shouldDespawn()) {
                    continue;
                }

                for (const mirror of player.solarMirrors) {
                    if (mirror.health <= 0) {
                        continue;
                    }
                    if (bullet.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(bullet.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        ctx.addDamageNumber(
                            mirror.position,
                            mirrorDamage,
                            Constants.MIRROR_MAX_HEALTH,
                            mirror.health,
                            mirrorKey,
                            bullet.owner,
                            bullet.velocity
                        );
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }

                if (bullet.shouldDespawn()) {
                    continue;
                }

                for (const gate of ctx.starlingMergeGates) {
                    if (gate.owner !== player || gate.health <= 0) {
                        continue;
                    }
                    if (bullet.checkHit(gate)) {
                        gate.health -= bullet.damage;
                        const gateKey = `merge_gate_${gate.position.x}_${gate.position.y}_${player.name}`;
                        ctx.addDamageNumber(
                            gate.position,
                            bullet.damage,
                            gate.maxHealth,
                            gate.health,
                            gateKey,
                            bullet.owner,
                            bullet.velocity
                        );
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }

                if (bullet.shouldDespawn()) {
                    continue;
                }

                // Check hits on Stellar Forge
                if (player.stellarForge && bullet.checkHit(player.stellarForge)) {
                    let finalDamage = bullet.damage;

                    // Check if this is a Beam projectile for distance-based damage
                    if (bullet.isBeamProjectile && bullet.beamOwner) {
                        const beamOwner = bullet.beamOwner;
                        const distance = beamOwner.position.distanceTo(player.stellarForge.position);
                        const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                        finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);

                        // Store info for display above Beam unit
                        beamOwner.lastBeamDamage = finalDamage;
                        beamOwner.lastBeamDistance = distance;
                        beamOwner.lastBeamMultiplier = multiplier;
                        beamOwner.lastBeamTime = ctx.gameTime;
                    }

                    player.stellarForge.health -= finalDamage;
                    // Create damage number
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    ctx.addDamageNumber(
                        player.stellarForge.position,
                        finalDamage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey,
                        bullet.owner,
                        bullet.velocity
                    );
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                }
            }
        }
        ctx.abilityBullets = ctx.abilityBullets.filter(bullet => !bullet.shouldDespawn());

        // Update mortar projectiles and check for splash damage hits
        for (const projectile of ctx.mortarProjectiles) {
            projectile.update(deltaTime);

            // Check hits against enemies
            let shouldExplode = false;
            for (const player of ctx.players) {
                // Skip if same team as projectile
                if (player === projectile.owner) {
                    continue;
                }

                // Check if projectile hit any unit
                for (const unit of player.units) {
                    if (projectile.checkHit(unit)) {
                        shouldExplode = true;
                        break;
                    }
                }

                if (shouldExplode) {
                    break;
                }
            }

            // If projectile hit something or reached max lifetime, apply splash damage
            if (shouldExplode || projectile.shouldDespawn()) {
                // Collect all enemy targets for splash damage
                const allEnemyTargets: CombatTarget[] = [];

                for (const player of ctx.players) {
                    if (player === projectile.owner) {
                        continue;
                    }

                    // Add units as potential targets
                    allEnemyTargets.push(...player.units);

                    // Add forge as potential target
                    if (player.stellarForge && player.stellarForge.health > 0) {
                        allEnemyTargets.push(player.stellarForge);
                    }

                    // Add buildings as potential targets
                    for (const building of player.buildings) {
                        if (building.health > 0) {
                            allEnemyTargets.push(building);
                        }
                    }
                }

                // Apply splash damage to all targets in range
                const damagedTargets = projectile.applySplashDamage(allEnemyTargets);

                // Create damage numbers for all damaged targets
                for (const target of damagedTargets) {
                    const distance = projectile.position.distanceTo(target.position);
                    const damageMultiplier = 1.0 - (distance / projectile.splashRadius) * (1.0 - Constants.MORTAR_SPLASH_DAMAGE_FALLOFF);
                    const finalDamage = Math.round(projectile.damage * damageMultiplier);

                    if (target instanceof Unit) {
                        const unitKey = `unit_${target.position.x}_${target.position.y}_${target.owner.name}`;
                        ctx.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            unitKey,
                            projectile.owner,
                            projectile.velocity
                        );
                    } else if ('isBuilding' in target && target.isBuilding) {
                        const buildingKey = `building_${target.position.x}_${target.position.y}`;
                        ctx.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            buildingKey,
                            projectile.owner,
                            projectile.velocity
                        );
                    } else if ('isForge' in target && target.isForge) {
                        const forgeKey = `forge_${target.position.x}_${target.position.y}`;
                        ctx.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            forgeKey,
                            projectile.owner,
                            projectile.velocity
                        );
                    }
                }

                // Mark projectile for removal
                projectile.lifetime = projectile.maxLifetime;
            }
        }
        ctx.mortarProjectiles = ctx.mortarProjectiles.filter(projectile => !projectile.shouldDespawn());

        // Update minion projectiles and check for hits
        for (const projectile of ctx.minionProjectiles) {
            projectile.update(deltaTime);

            // Check if projectile is blocked by Tank shields
            let isBlocked = false;
            for (const player of ctx.players) {
                for (const unit of player.units) {
                    if (unit instanceof Tank && unit.isPositionInShield(projectile.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (projectile.owner !== player) {
                            isBlocked = true;
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked) break;
            }
            if (isBlocked) continue;

            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of ctx.players) {
                for (const building of player.buildings) {
                    if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
                        // Shield blocks enemy projectiles but not friendly fire
                        if (projectile.owner !== player && building.isEnemyBlocked(projectile.position)) {
                            // Damage the shield instead of letting projectile through
                            const projectileDamage = 'damage' in projectile ? (projectile.damage as number) : Constants.DEFAULT_PROJECTILE_DAMAGE;
                            building.damageShield(projectileDamage);
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            blockedByShield = true;
                            break;
                        }
                    }
                }
                if (blockedByShield) break;
            }
            if (blockedByShield) continue;

            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            PhysicsSystem.applyFluidForceFromMovingObject(
                ctx,
                projectile.position,
                projectile.velocity,
                Constants.MINION_PROJECTILE_EFFECT_RADIUS,
                projectileSpeed * Constants.MINION_PROJECTILE_FORCE_MULTIPLIER,
                ctx.getPlayerImpactColor(projectile.owner),
                deltaTime
            );

            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of ctx.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner) continue;

                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting distance to max
                            projectile.distanceTraveledPx = projectile.maxRangePx;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed) break;
            }
            if (wasAbsorbed) continue;

            // Check hits on Aurum orbs (they can take damage)
            let hitOrb = false;
            for (const orb of ctx.aurumOrbs) {
                // Don't hit own orbs
                if (orb.owner === projectile.owner) continue;

                const distance = projectile.position.distanceTo(orb.position);
                if (distance < Constants.AURUM_ORB_RADIUS) {
                    const projectileDamage = 'damage' in projectile ? (projectile.damage as number) : Constants.DEFAULT_PROJECTILE_DAMAGE;
                    orb.takeDamage(projectileDamage);
                    ctx.damageNumbers.push(new DamageNumber(
                        orb.position,
                        projectileDamage,
                        ctx.gameTime
                    ));
                    projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                    hitOrb = true;
                    break;
                }
            }
            if (hitOrb) continue;

            let hasHit = false;

            for (const player of ctx.players) {
                if (player === projectile.owner) {
                    continue;
                }

                for (const unit of player.units) {
                    if (projectile.checkHit(unit)) {
                        const previousHealth = unit.health;
                        unit.takeDamage(projectile.damage);
                        const actualDamage = Math.max(0, previousHealth - unit.health);
                        const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                        ctx.addDamageNumber(
                            unit.position,
                            actualDamage,
                            unit.maxHealth,
                            unit.health,
                            unitKey,
                            projectile.owner,
                            projectile.velocity,
                            actualDamage <= 0
                        );
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                for (const mirror of player.solarMirrors) {
                    if (mirror.health <= 0) {
                        continue;
                    }
                    if (projectile.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(projectile.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        ctx.addDamageNumber(
                            mirror.position,
                            mirrorDamage,
                            Constants.MIRROR_MAX_HEALTH,
                            mirror.health,
                            mirrorKey,
                            projectile.owner,
                            projectile.velocity
                        );
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                for (const gate of ctx.starlingMergeGates) {
                    if (gate.owner !== player || gate.health <= 0) {
                        continue;
                    }
                    if (projectile.checkHit(gate)) {
                        gate.health -= projectile.damage;
                        const gateKey = `merge_gate_${gate.position.x}_${gate.position.y}_${player.name}`;
                        ctx.addDamageNumber(
                            gate.position,
                            projectile.damage,
                            gate.maxHealth,
                            gate.health,
                            gateKey,
                            projectile.owner,
                            projectile.velocity
                        );
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                for (const building of player.buildings) {
                    if (projectile.checkHit(building)) {
                        building.health -= projectile.damage;
                        // Create damage number
                        const buildingKey = `building_${building.position.x}_${building.position.y}_${player.name}`;
                        ctx.addDamageNumber(
                            building.position,
                            projectile.damage,
                            building.maxHealth,
                            building.health,
                            buildingKey,
                            projectile.owner,
                            projectile.velocity
                        );
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                if (player.stellarForge && projectile.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= projectile.damage;
                    // Create damage number
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    ctx.addDamageNumber(
                        player.stellarForge.position,
                        projectile.damage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey,
                        projectile.owner,
                        projectile.velocity
                    );
                    hasHit = true;
                    break;
                }
            }

            if (hasHit) {
                projectile.distanceTraveledPx = projectile.maxRangePx;
            }
        }
        ctx.minionProjectiles = ctx.minionProjectiles.filter(projectile => !projectile.shouldDespawn());

        // Update influence zones
        ctx.influenceZones = ctx.influenceZones.filter(zone => !zone.update(deltaTime));

        // Update influence ball projectiles
        for (const projectile of ctx.influenceBallProjectiles) {
            projectile.update(deltaTime);

            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            PhysicsSystem.applyFluidForceFromMovingObject(
                ctx,
                projectile.position,
                projectile.velocity,
                Constants.INFLUENCE_BALL_EFFECT_RADIUS,
                projectileSpeed * Constants.INFLUENCE_BALL_FORCE_MULTIPLIER,
                ctx.getPlayerImpactColor(projectile.owner),
                deltaTime
            );

            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of ctx.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner) continue;

                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting lifetime to max
                            projectile.lifetime = projectile.maxLifetime;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed) break;
            }
            if (wasAbsorbed) continue;

            // Check if should explode (max lifetime reached)
            if (projectile.shouldExplode()) {
                // Create influence zone
                const zone = new InfluenceZone(
                    new Vector2D(projectile.position.x, projectile.position.y),
                    projectile.owner
                );
                ctx.influenceZones.push(zone);
            }
        }
        ctx.influenceBallProjectiles = ctx.influenceBallProjectiles.filter(p => !p.shouldExplode());
    }
}
