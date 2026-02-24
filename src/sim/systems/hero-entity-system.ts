/**
 * Hero Entity System
 * Handles hero-specific entity updates (projectiles, orbs, waves, etc.) extracted from game-state.ts
 *
 * Extracted from game-state.ts as part of Phase 7 refactoring
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Asteroid } from '../entities/asteroid';
import { DamageNumber } from '../entities/damage-number';
import {
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    AbilityBullet,
    MinionProjectile,
} from '../entities/particles';
import {
    CombatTarget,
    CrescentWave,
    NovaBomb,
    NovaScatterBullet,
    MiniMothership,
    StickyBomb,
    StickyLaser,
    DisintegrationParticle,
    RadiantOrb,
    VelarisOrb,
    AurumOrb,
    AurumShieldHit,
    SplendorSunSphere,
    SplendorSunlightZone,
    SplendorLaserSegment,
    DashSlash,
    BlinkShockwave,
    ShadowDecoy,
    ShadowDecoyParticle,
    ChronoFreezeCircle,
    Dash,
    Nova,
    Sly,
    MortarProjectile,
    InfluenceBallProjectile,
} from '../../game-core';
import { getGameRNG } from '../../seeded-random';

/**
 * Context required by HeroEntitySystem.update
 */
export interface HeroEntityContext {
    // Hero entity arrays (read/write)
    crescentWaves: InstanceType<typeof CrescentWave>[];
    novaBombs: InstanceType<typeof NovaBomb>[];
    novaScatterBullets: InstanceType<typeof NovaScatterBullet>[];
    miniMotherships: InstanceType<typeof MiniMothership>[];
    miniMothershipExplosions: { position: Vector2D; owner: Player; timestamp: number }[];
    shadowDecoys: InstanceType<typeof ShadowDecoy>[];
    shadowDecoyParticles: InstanceType<typeof ShadowDecoyParticle>[];
    stickyBombs: InstanceType<typeof StickyBomb>[];
    stickyLasers: InstanceType<typeof StickyLaser>[];
    disintegrationParticles: InstanceType<typeof DisintegrationParticle>[];
    radiantOrbs: InstanceType<typeof RadiantOrb>[];
    velarisOrbs: InstanceType<typeof VelarisOrb>[];
    aurumOrbs: InstanceType<typeof AurumOrb>[];
    aurumShieldHits: InstanceType<typeof AurumShieldHit>[];
    splendorSunSpheres: InstanceType<typeof SplendorSunSphere>[];
    splendorSunlightZones: InstanceType<typeof SplendorSunlightZone>[];
    splendorLaserSegments: InstanceType<typeof SplendorLaserSegment>[];
    dashSlashes: InstanceType<typeof DashSlash>[];
    blinkShockwaves: InstanceType<typeof BlinkShockwave>[];
    chronoFreezeCircles: InstanceType<typeof ChronoFreezeCircle>[];

    // Cross-system arrays (for crescent wave projectile erasure)
    abilityBullets: AbilityBullet[];
    minionProjectiles: MinionProjectile[];
    mortarProjectiles: InstanceType<typeof MortarProjectile>[];
    influenceBallProjectiles: InstanceType<typeof InfluenceBallProjectile>[];
    bouncingBullets: BouncingBullet[];

    // Effect arrays written to by mini-mothership shots
    muzzleFlashes: MuzzleFlash[];
    bulletCasings: BulletCasing[];

    // Damage tracking
    damageNumbers: DamageNumber[];
    gameTime: number;

    // World data
    players: Player[];
    asteroids: Asteroid[];
    mapSize: number;

    // Helper method
    getSplendorSphereObstacles(): { position: Vector2D; radius: number }[];
}

export class HeroEntitySystem {
    static update(ctx: HeroEntityContext, deltaTime: number): void {
        // Update crescent waves and handle stunning
        for (const wave of ctx.crescentWaves) {
            wave.update(deltaTime);

            // Check for units in wave and stun them
            for (const player of ctx.players) {
                for (const unit of player.units) {
                    // Only stun units that haven't been affected by this wave yet
                    if (!wave.affectedUnits.has(unit) && wave.isPointInWave(unit.position)) {
                        unit.applyStun(Constants.TANK_STUN_DURATION);
                        wave.affectedUnits.add(unit);
                    }
                }
            }

            // Erase projectiles in wave
            ctx.abilityBullets = ctx.abilityBullets.filter(bullet => {
                if (wave.isPointInWave(bullet.position)) {
                    return false; // Remove projectile
                }
                return true;
            });

            ctx.minionProjectiles = ctx.minionProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });

            ctx.mortarProjectiles = ctx.mortarProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });

            ctx.influenceBallProjectiles = ctx.influenceBallProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });

            ctx.bouncingBullets = ctx.bouncingBullets.filter(bullet => {
                if (wave.isPointInWave(bullet.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
        }
        ctx.crescentWaves = ctx.crescentWaves.filter(wave => !wave.shouldDespawn());

        // Update Nova bombs
        for (const bomb of ctx.novaBombs) {
            bomb.update(deltaTime);

            // Check for bounces off asteroids
            for (const asteroid of ctx.asteroids) {
                const distance = bomb.position.distanceTo(asteroid.position);
                if (distance < asteroid.size + Constants.NOVA_BOMB_RADIUS) {
                    // Calculate normal vector from asteroid center to bomb
                    const dx = bomb.position.x - asteroid.position.x;
                    const dy = bomb.position.y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        bomb.bounce(normalX, normalY);

                        // Push bomb outside asteroid
                        bomb.position.x = asteroid.position.x + normalX * (asteroid.size + Constants.NOVA_BOMB_RADIUS);
                        bomb.position.y = asteroid.position.y + normalY * (asteroid.size + Constants.NOVA_BOMB_RADIUS);
                    }
                }
            }

            // Check for bounces off map edges
            const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
            if (bomb.position.x <= -boundary) {
                bomb.bounce(1, 0); // Bounce off left edge
                bomb.position.x = -boundary;
            } else if (bomb.position.x >= boundary) {
                bomb.bounce(-1, 0); // Bounce off right edge
                bomb.position.x = boundary;
            }
            if (bomb.position.y <= -boundary) {
                bomb.bounce(0, 1); // Bounce off top edge
                bomb.position.y = -boundary;
            } else if (bomb.position.y >= boundary) {
                bomb.bounce(0, -1); // Bounce off bottom edge
                bomb.position.y = boundary;
            }

            // Check if bomb is hit by enemy abilities (ability bullets, mortar projectiles, etc.)
            for (const bullet of ctx.abilityBullets) {
                if (bullet.owner !== bomb.owner) {
                    const distance = bomb.position.distanceTo(bullet.position);
                    if (distance < Constants.NOVA_BOMB_RADIUS) {
                        bomb.takeDamage(); // Premature explosion
                        break;
                    }
                }
            }

            for (const projectile of ctx.mortarProjectiles) {
                if (projectile.owner !== bomb.owner) {
                    const distance = bomb.position.distanceTo(projectile.position);
                    if (distance < Constants.NOVA_BOMB_RADIUS) {
                        bomb.takeDamage(); // Premature explosion
                        break;
                    }
                }
            }

            // Check if bomb should explode
            if (bomb.shouldExplode()) {
                const scatterDir = bomb.getScatterDirection();
                if (scatterDir) {
                    // Create scatter bullets in a 30-degree arc
                    const baseAngle = Math.atan2(scatterDir.y, scatterDir.x);
                    const halfArc = Constants.NOVA_BOMB_SCATTER_ARC / 2;

                    for (let i = 0; i < Constants.NOVA_BOMB_SCATTER_BULLET_COUNT; i++) {
                        const t = i / (Constants.NOVA_BOMB_SCATTER_BULLET_COUNT - 1);
                        const angle = baseAngle - halfArc + t * Constants.NOVA_BOMB_SCATTER_ARC;

                        const velocity = new Vector2D(
                            Math.cos(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED,
                            Math.sin(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED
                        );

                        ctx.novaScatterBullets.push(
                            new NovaScatterBullet(
                                new Vector2D(bomb.position.x, bomb.position.y),
                                velocity,
                                bomb.owner
                            )
                        );
                    }

                    // Apply explosion damage to nearby enemies
                    for (const player of ctx.players) {
                        if (player === bomb.owner) continue;

                        for (const unit of player.units) {
                            const distance = bomb.position.distanceTo(unit.position);
                            if (distance <= Constants.NOVA_BOMB_EXPLOSION_RADIUS) {
                                unit.health -= Constants.NOVA_BOMB_EXPLOSION_DAMAGE;
                            }
                        }

                        for (const building of player.buildings) {
                            const distance = bomb.position.distanceTo(building.position);
                            if (distance <= Constants.NOVA_BOMB_EXPLOSION_RADIUS) {
                                building.health -= Constants.NOVA_BOMB_EXPLOSION_DAMAGE;
                            }
                        }
                    }

                    // Clear bomb reference from Nova hero
                    if (bomb.novaUnit && bomb.novaUnit.getActiveBomb() === bomb) {
                        bomb.novaUnit.clearActiveBomb();
                    }
                }
            }
        }
        ctx.novaBombs = ctx.novaBombs.filter(bomb => !bomb.shouldExplode());

        // Update Nova scatter bullets
        for (const bullet of ctx.novaScatterBullets) {
            bullet.update(deltaTime);

            // Check for hits on enemy units
            for (const player of ctx.players) {
                if (player === bullet.owner) continue;

                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        unit.health -= bullet.damage;
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }
            }
        }
        ctx.novaScatterBullets = ctx.novaScatterBullets.filter(bullet => !bullet.shouldDespawn());

        // Update Mini-Motherships
        for (const mini of ctx.miniMotherships) {
            // Collect enemy targets for AI targeting
            const enemyTargets: CombatTarget[] = [];
            for (const player of ctx.players) {
                if (player === mini.owner) continue;

                // Add enemy units
                for (const unit of player.units) {
                    enemyTargets.push(unit);
                }

                // Add enemy buildings
                for (const building of player.buildings) {
                    enemyTargets.push(building);
                }

                // Add enemy forge
                if (player.stellarForge) {
                    enemyTargets.push(player.stellarForge);
                }
            }

            // Update mini-mothership (movement, targeting, attacking)
            mini.update(deltaTime, enemyTargets);

            // Collect shot effects
            const effects = mini.getAndClearLastShotEffects();
            if (effects.muzzleFlash) {
                ctx.muzzleFlashes.push(effects.muzzleFlash);
            }
            if (effects.casing) {
                ctx.bulletCasings.push(effects.casing);
            }
            if (effects.bouncingBullet) {
                ctx.bouncingBullets.push(effects.bouncingBullet);
            }

            // Check collision with environment
            const allBuildings: any[] = [];
            for (const player of ctx.players) {
                allBuildings.push(...player.buildings);
                if (player.stellarForge) {
                    allBuildings.push(player.stellarForge);
                }
            }

            if (mini.checkCollision(Constants.MAP_PLAYABLE_BOUNDARY, ctx.asteroids, allBuildings)) {
                mini.explode();
            }

            // If exploded, create explosion
            if (mini.exploded) {
                ctx.miniMothershipExplosions.push({
                    position: new Vector2D(mini.position.x, mini.position.y),
                    owner: mini.owner,
                    timestamp: ctx.gameTime
                });
            }
        }

        // Apply splash damage from mini-mothership explosions
        for (const explosion of ctx.miniMothershipExplosions) {
            const allTargets: CombatTarget[] = [];
            for (const player of ctx.players) {
                // Add all units
                for (const unit of player.units) {
                    allTargets.push(unit);
                }

                // Add all buildings
                for (const building of player.buildings) {
                    allTargets.push(building);
                }

                // Add forge
                if (player.stellarForge) {
                    allTargets.push(player.stellarForge);
                }
            }

            // Apply splash damage to all targets in range (friendly and enemy)
            for (const target of allTargets) {
                const distance = explosion.position.distanceTo(target.position);
                if (distance <= Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS) {
                    // Calculate damage with falloff
                    const damageMultiplier = 1.0 - (distance / Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS) * (1.0 - Constants.MOTHERSHIP_MINI_EXPLOSION_FALLOFF);
                    const damage = Constants.MOTHERSHIP_MINI_EXPLOSION_DAMAGE * damageMultiplier;
                    target.health -= damage;

                    // Create damage number
                    ctx.damageNumbers.push(new DamageNumber(
                        new Vector2D(target.position.x, target.position.y),
                        Math.round(damage),
                        ctx.gameTime
                    ));
                }
            }
        }

        // Clean up old explosions (older than 1 second)
        ctx.miniMothershipExplosions = ctx.miniMothershipExplosions.filter(exp => ctx.gameTime - exp.timestamp < 1.0);

        // Remove despawned mini-motherships
        ctx.miniMotherships = ctx.miniMotherships.filter(mini => !mini.shouldDespawn);

        // Update Shadow Decoys
        for (const decoy of ctx.shadowDecoys) {
            // Update decoy
            decoy.update(deltaTime);

            // Check collision with environment
            const allBuildings: Array<{ position: Vector2D; radius: number }> = [];
            for (const player of ctx.players) {
                allBuildings.push(...player.buildings);
                if (player.stellarForge) {
                    allBuildings.push(player.stellarForge);
                }
            }

            if (decoy.checkCollision(Constants.MAP_PLAYABLE_BOUNDARY, ctx.asteroids, allBuildings)) {
                decoy.shouldDespawn = true;

                // Create swarm of erratic particles
                const rng = getGameRNG();
                for (let i = 0; i < Constants.SHADOW_DECOY_PARTICLE_COUNT; i++) {
                    const angle = rng.nextFloat(0, Math.PI * 2);
                    const speed = rng.nextFloat(Constants.SHADOW_DECOY_PARTICLE_SPEED * 0.5, Constants.SHADOW_DECOY_PARTICLE_SPEED * 1.5);
                    const velocity = new Vector2D(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed
                    );
                    ctx.shadowDecoyParticles.push(new ShadowDecoyParticle(decoy.position, velocity));
                }
            }
        }

        // Shadow decoys can take damage from projectiles and attacks
        for (const decoy of ctx.shadowDecoys) {
            if (decoy.shouldDespawn) continue;

            // Check damage from ability bullets
            for (const bullet of ctx.abilityBullets) {
                if (bullet.owner === decoy.owner) continue; // Don't damage own decoys

                const distance = decoy.position.distanceTo(bullet.position);
                if (distance < Constants.SHADOW_DECOY_COLLISION_RADIUS) {
                    decoy.takeDamage(bullet.damage);
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal

                    // Create damage number
                    ctx.damageNumbers.push(new DamageNumber(
                        new Vector2D(decoy.position.x, decoy.position.y),
                        Math.round(bullet.damage),
                        ctx.gameTime
                    ));
                }
            }

            // If decoy died, create despawn particles
            if (decoy.shouldDespawn && decoy.health <= 0) {
                const rng = getGameRNG();
                for (let i = 0; i < Constants.SHADOW_DECOY_PARTICLE_COUNT; i++) {
                    const angle = rng.nextFloat(0, Math.PI * 2);
                    const speed = rng.nextFloat(Constants.SHADOW_DECOY_PARTICLE_SPEED * 0.5, Constants.SHADOW_DECOY_PARTICLE_SPEED * 1.5);
                    const velocity = new Vector2D(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed
                    );
                    ctx.shadowDecoyParticles.push(new ShadowDecoyParticle(decoy.position, velocity));
                }
            }
        }

        // Remove despawned decoys
        ctx.shadowDecoys = ctx.shadowDecoys.filter(decoy => !decoy.shouldDespawn);

        // Update Sticky Bombs
        for (const bomb of ctx.stickyBombs) {
            bomb.update(deltaTime);

            // If not stuck, check for sticking to surfaces
            if (!bomb.isStuck) {
                // Check for sticking to asteroids
                for (const asteroid of ctx.asteroids) {
                    const distance = bomb.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size + Constants.STICKY_BOMB_STICK_DISTANCE) {
                        // Calculate normal vector from asteroid center to bomb (outward direction)
                        const dx = bomb.position.x - asteroid.position.x;
                        const dy = bomb.position.y - asteroid.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            const normal = new Vector2D(dx / dist, dy / dist);
                            bomb.stickToSurface('asteroid', normal, asteroid);
                            // Position bomb on surface
                            bomb.position.x = asteroid.position.x + normal.x * (asteroid.size + Constants.STICKY_BOMB_RADIUS);
                            bomb.position.y = asteroid.position.y + normal.y * (asteroid.size + Constants.STICKY_BOMB_RADIUS);
                        }
                        break;
                    }
                }

                // Check for sticking to structures (buildings, mirrors, forge)
                if (!bomb.isStuck) {
                    for (const player of ctx.players) {
                        // Check buildings
                        for (const building of player.buildings) {
                            const distance = bomb.position.distanceTo(building.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                // Calculate normal vector from building to bomb
                                const dx = bomb.position.x - building.position.x;
                                const dy = bomb.position.y - building.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, building);
                                }
                                break;
                            }
                        }

                        if (bomb.isStuck) break;

                        // Check solar mirrors
                        for (const mirror of player.solarMirrors) {
                            const distance = bomb.position.distanceTo(mirror.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - mirror.position.x;
                                const dy = bomb.position.y - mirror.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, mirror);
                                }
                                break;
                            }
                        }

                        if (bomb.isStuck) break;

                        // Check stellar forge
                        if (player.stellarForge) {
                            const distance = bomb.position.distanceTo(player.stellarForge.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - player.stellarForge.position.x;
                                const dy = bomb.position.y - player.stellarForge.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, player.stellarForge);
                                }
                                break;
                            }
                        }

                        if (bomb.isStuck) break;
                    }
                }

                // Check for sticking to map edges (playing field boundary)
                if (!bomb.isStuck) {
                    const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
                    const edgeThreshold = Constants.STICKY_BOMB_STICK_DISTANCE;

                    if (bomb.position.x <= -boundary + edgeThreshold) {
                        // Stick to left edge
                        bomb.stickToSurface('edge', new Vector2D(1, 0));
                        bomb.position.x = -boundary + Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.x >= boundary - edgeThreshold) {
                        // Stick to right edge
                        bomb.stickToSurface('edge', new Vector2D(-1, 0));
                        bomb.position.x = boundary - Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.y <= -boundary + edgeThreshold) {
                        // Stick to top edge
                        bomb.stickToSurface('edge', new Vector2D(0, 1));
                        bomb.position.y = -boundary + Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.y >= boundary - edgeThreshold) {
                        // Stick to bottom edge
                        bomb.stickToSurface('edge', new Vector2D(0, -1));
                        bomb.position.y = boundary - Constants.STICKY_BOMB_RADIUS;
                    }
                }
            }

            // Check if bomb should disintegrate
            if (bomb.shouldDisintegrate()) {
                // Notify owner and create particles
                bomb.slyOwner.onBombDestroyed(bomb);
            }
        }
        ctx.stickyBombs = ctx.stickyBombs.filter(bomb => !bomb.shouldDespawn());

        // Update Sticky Lasers
        for (const laser of ctx.stickyLasers) {
            laser.update(deltaTime);

            // Check for hits on enemy units and structures
            for (const player of ctx.players) {
                if (player === laser.owner) continue;

                // Check units
                for (const unit of player.units) {
                    if (laser.checkHit(unit)) {
                        unit.health -= laser.damage;
                        ctx.damageNumbers.push(new DamageNumber(
                            unit.position,
                            laser.damage,
                            ctx.gameTime
                        ));
                    }
                }

                // Check buildings
                for (const building of player.buildings) {
                    if (laser.checkHit(building)) {
                        building.health -= laser.damage;
                        ctx.damageNumbers.push(new DamageNumber(
                            building.position,
                            laser.damage,
                            ctx.gameTime
                        ));
                    }
                }

                // Check solar mirrors
                for (const mirror of player.solarMirrors) {
                    if (laser.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(laser.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        ctx.damageNumbers.push(new DamageNumber(
                            mirror.position,
                            mirrorDamage,
                            ctx.gameTime
                        ));
                    }
                }

                // Check stellar forge
                if (player.stellarForge && laser.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= laser.damage;
                    ctx.damageNumbers.push(new DamageNumber(
                        player.stellarForge.position,
                        laser.damage,
                        ctx.gameTime
                    ));
                }
            }
        }
        ctx.stickyLasers = ctx.stickyLasers.filter(laser => !laser.shouldDespawn());

        // Update Radiant orbs
        for (const orb of ctx.radiantOrbs) {
            orb.update(deltaTime, ctx.asteroids);
        }
        // Remove stopped orbs
        ctx.radiantOrbs = ctx.radiantOrbs.filter(orb => !orb.isStopped());

        // Apply laser damage between Radiant orbs
        for (let i = 0; i < ctx.radiantOrbs.length; i++) {
            for (let j = i + 1; j < ctx.radiantOrbs.length; j++) {
                const orb1 = ctx.radiantOrbs[i];
                const orb2 = ctx.radiantOrbs[j];

                // Only connect orbs from same owner
                if (orb1.owner !== orb2.owner) continue;

                const distance = orb1.position.distanceTo(orb2.position);
                const maxRange = Math.min(orb1.getRange(), orb2.getRange());

                if (distance <= maxRange) {
                    // There's a laser between these orbs - check for units crossing it
                    for (const player of ctx.players) {
                        if (player === orb1.owner) continue; // Don't damage own units

                        for (const unit of player.units) {
                            // Calculate distance from unit to line segment between orbs
                            const lineDistSq = HeroEntitySystem.pointToLineSegmentDistanceSquared(
                                unit.position,
                                orb1.position,
                                orb2.position
                            );

                            const laserWidth = 5; // Laser field width in pixels
                            if (lineDistSq < laserWidth * laserWidth) {
                                const damage = Constants.RADIANT_LASER_DAMAGE_PER_SEC * deltaTime;
                                unit.health -= damage;
                                ctx.damageNumbers.push(new DamageNumber(
                                    unit.position,
                                    damage,
                                    ctx.gameTime
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Update Velaris orbs
        for (const orb of ctx.velarisOrbs) {
            orb.update(deltaTime, ctx.asteroids);
        }
        ctx.velarisOrbs = ctx.velarisOrbs.filter(orb => !orb.isStopped());

        // Update Aurum orbs
        for (const orb of ctx.aurumOrbs) {
            orb.update(deltaTime, ctx.asteroids);
        }
        // Remove destroyed or stopped orbs
        ctx.aurumOrbs = ctx.aurumOrbs.filter(orb => !orb.isDestroyed() && !orb.isStopped());

        // Update Aurum shield hits
        for (const hit of ctx.aurumShieldHits) {
            if (hit.update(deltaTime)) {
                // Mark for removal
            }
        }
        ctx.aurumShieldHits = ctx.aurumShieldHits.filter(hit => hit.getProgress() < 1.0);

        for (const sphere of ctx.splendorSunSpheres) {
            sphere.update(deltaTime, ctx.asteroids, ctx.getSplendorSphereObstacles());
            if (sphere.shouldExplode) {
                ctx.splendorSunlightZones.push(new SplendorSunlightZone(
                    new Vector2D(sphere.position.x, sphere.position.y),
                    sphere.owner
                ));
            }
        }
        ctx.splendorSunSpheres = ctx.splendorSunSpheres.filter((sphere) => !sphere.shouldExplode);

        for (const zone of ctx.splendorSunlightZones) {
            zone.update(deltaTime);
        }
        ctx.splendorSunlightZones = ctx.splendorSunlightZones.filter((zone) => !zone.isExpired());

        for (const segment of ctx.splendorLaserSegments) {
            segment.update(deltaTime);
        }
        ctx.splendorLaserSegments = ctx.splendorLaserSegments.filter((segment) => !segment.isExpired());

        // Update Dash slashes
        for (const slash of ctx.dashSlashes) {
            slash.update(deltaTime);

            // Bounce off asteroids
            for (const asteroid of ctx.asteroids) {
                if (asteroid.containsPoint(slash.position)) {
                    // Calculate bounce direction (reflect off normal)
                    const dx = slash.position.x - asteroid.position.x;
                    const dy = slash.position.y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        slash.bounce(normalX, normalY);

                        // Push slash out of asteroid
                        const pushDist = asteroid.size + 5 - dist;
                        if (pushDist > 0) {
                            slash.position.x += normalX * pushDist;
                            slash.position.y += normalY * pushDist;
                        }
                    }
                    break;
                }
            }

            // Bounce off map edges
            const mapEdge = ctx.mapSize / 2;
            if (slash.position.x <= -mapEdge || slash.position.x >= mapEdge) {
                const normalX = slash.position.x <= -mapEdge ? 1 : -1;
                slash.bounce(normalX, 0);
                slash.position.x = Math.max(-mapEdge, Math.min(mapEdge, slash.position.x));
            }
            if (slash.position.y <= -mapEdge || slash.position.y >= mapEdge) {
                const normalY = slash.position.y <= -mapEdge ? 1 : -1;
                slash.bounce(0, normalY);
                slash.position.y = Math.max(-mapEdge, Math.min(mapEdge, slash.position.y));
            }

            // Damage units that haven't been hit yet
            for (const player of ctx.players) {
                if (player === slash.owner) continue; // Don't damage own units

                for (const unit of player.units) {
                    if (!slash.affectedUnits.has(unit) && slash.isUnitInSlash(unit)) {
                        unit.takeDamage(Constants.DASH_SLASH_DAMAGE);
                        slash.affectedUnits.add(unit);
                        ctx.damageNumbers.push(new DamageNumber(
                            unit.position,
                            Constants.DASH_SLASH_DAMAGE,
                            ctx.gameTime
                        ));
                    }
                }

                // Damage structures
                for (const building of player.buildings) {
                    if (!slash.affectedUnits.has(building as any) && slash.position.distanceTo(building.position) < Constants.DASH_SLASH_RADIUS) {
                        building.takeDamage(Constants.DASH_SLASH_DAMAGE);
                        slash.affectedUnits.add(building as any);
                        ctx.damageNumbers.push(new DamageNumber(
                            building.position,
                            Constants.DASH_SLASH_DAMAGE,
                            ctx.gameTime
                        ));
                    }
                }
            }
        }

        // Remove finished dash slashes and update hero dashing state
        ctx.dashSlashes = ctx.dashSlashes.filter(slash => {
            const shouldDespawn = slash.shouldDespawn();
            if (shouldDespawn && slash.heroUnit instanceof Dash) {
                slash.heroUnit.setDashing(false);
            }
            return !shouldDespawn;
        });

        // Update Blink shockwaves
        for (const shockwave of ctx.blinkShockwaves) {
            shockwave.update(deltaTime);

            // Stun and damage units that haven't been hit yet
            for (const player of ctx.players) {
                if (player === shockwave.owner) continue; // Don't affect own units

                for (const unit of player.units) {
                    if (!shockwave.affectedUnits.has(unit) && shockwave.isUnitInShockwave(unit)) {
                        unit.takeDamage(Constants.BLINK_SHOCKWAVE_DAMAGE);
                        unit.applyStun(Constants.BLINK_STUN_DURATION);
                        shockwave.affectedUnits.add(unit);
                        ctx.damageNumbers.push(new DamageNumber(
                            unit.position,
                            Constants.BLINK_SHOCKWAVE_DAMAGE,
                            ctx.gameTime
                        ));
                    }
                }
            }
        }

        // Remove expired shockwaves
        ctx.blinkShockwaves = ctx.blinkShockwaves.filter(shockwave => !shockwave.shouldDespawn());

        // First, clear all frozen flags
        for (const player of ctx.players) {
            for (const unit of player.units) {
                unit.isFrozen = false;
            }
        }

        // Update Chrono freeze circles
        for (const freezeCircle of ctx.chronoFreezeCircles) {
            freezeCircle.update(deltaTime);

            // Freeze all units within the circle
            for (const player of ctx.players) {
                for (const unit of player.units) {
                    if (freezeCircle.isPositionInCircle(unit.position)) {
                        if (!freezeCircle.affectedUnits.has(unit)) {
                            freezeCircle.affectedUnits.add(unit);
                        }
                        // Mark unit as frozen (invulnerable, can't be targeted)
                        unit.isFrozen = true;
                        // Keep units frozen while in circle (using stun to prevent movement/attacking)
                        unit.stunDuration = Math.max(unit.stunDuration, 0.1);
                    }
                }

                // Freeze buildings (prevent them from attacking)
                for (const building of player.buildings) {
                    if (freezeCircle.isPositionInCircle(building.position)) {
                        if (!freezeCircle.affectedBuildings.has(building)) {
                            freezeCircle.affectedBuildings.add(building);
                        }
                        // Buildings are "frozen" by preventing them from attacking
                        // Most buildings have attackCooldown property
                        if (building.attackCooldown !== undefined) {
                            building.attackCooldown = Math.max(building.attackCooldown, 0.1);
                        }
                    }
                }
            }
        }

        // Remove expired freeze circles
        ctx.chronoFreezeCircles = ctx.chronoFreezeCircles.filter(circle => !circle.shouldDespawn());
    }

    private static pointToLineSegmentDistanceSquared(
        point: Vector2D,
        lineStart: Vector2D,
        lineEnd: Vector2D
    ): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) {
            // Line segment is a point
            const px = point.x - lineStart.x;
            const py = point.y - lineStart.y;
            return px * px + py * py;
        }

        // Project point onto line segment
        const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
        const closestX = lineStart.x + t * dx;
        const closestY = lineStart.y + t * dy;

        const distX = point.x - closestX;
        const distY = point.y - closestY;
        return distX * distX + distY * distY;
    }
}
