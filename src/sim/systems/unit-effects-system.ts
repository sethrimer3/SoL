/**
 * Unit Effects System
 * Collects per-unit visual and gameplay effects and processes hero-specific abilities.
 *
 * Extracted from game-state.ts as part of Phase 15 refactoring.
 * Handles the per-unit effects-collection block that was inlined in the main
 * game loop: gathering shot effects, projectiles, orbs, and running hero ability
 * logic for every unit on each tick.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Unit } from '../entities/unit';
import { Starling } from '../entities/starling';
import { Building, SpaceDustSwirler, CombatTarget } from '../entities/buildings';
import {
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    LaserBeam,
    ImpactParticle,
} from '../entities/particles';
import {
    Marine,
    Mothership,
    MiniMothership,
    Grave,
    InfluenceBall,
    InfluenceBallProjectile,
    Mortar,
    MortarProjectile,
    Tank,
    CrescentWave,
    Nova,
    NovaBomb,
    Sly,
    StickyBomb,
    StickyLaser,
    DisintegrationParticle,
    Radiant,
    RadiantOrb,
    VelarisHero,
    VelarisOrb,
    Splendor,
    SplendorSunSphere,
    SplendorLaserSegment,
    AurumHero,
    AurumOrb,
    Dash,
    DashSlash,
    Blink,
    BlinkShockwave,
    Shadow,
    ShadowDecoy,
    Chrono,
    ChronoFreezeCircle,
    Ray,
    TurretDeployer,
    Spotlight,
    Driller,
    Dagger,
} from '../../game-core';
import { HeroAbilityContext, HeroAbilitySystem } from './hero-ability-system';
import { PhysicsContext, PhysicsSystem } from './physics-system';

/**
 * Context required by UnitEffectsSystem.collectEffectsForUnit.
 * Extends HeroAbilityContext (for ability sub-system calls) and
 * PhysicsContext (for beam fluid-force calls).
 */
export interface UnitEffectsContext extends HeroAbilityContext, PhysicsContext {
    // Shot effects
    muzzleFlashes: MuzzleFlash[];
    bulletCasings: BulletCasing[];
    bouncingBullets: BouncingBullet[];

    // Projectile / beam arrays
    laserBeams: LaserBeam[];
    impactParticles: ImpactParticle[];
    influenceBallProjectiles: InstanceType<typeof InfluenceBallProjectile>[];
    mortarProjectiles: InstanceType<typeof MortarProjectile>[];

    // Hero entity arrays (effects spawned this tick)
    crescentWaves: InstanceType<typeof CrescentWave>[];
    novaBombs: InstanceType<typeof NovaBomb>[];
    stickyBombs: InstanceType<typeof StickyBomb>[];
    stickyLasers: InstanceType<typeof StickyLaser>[];
    disintegrationParticles: InstanceType<typeof DisintegrationParticle>[];
    radiantOrbs: InstanceType<typeof RadiantOrb>[];
    velarisOrbs: InstanceType<typeof VelarisOrb>[];
    aurumOrbs: InstanceType<typeof AurumOrb>[];
    splendorSunSpheres: InstanceType<typeof SplendorSunSphere>[];
    splendorLaserSegments: InstanceType<typeof SplendorLaserSegment>[];
    dashSlashes: InstanceType<typeof DashSlash>[];
    blinkShockwaves: InstanceType<typeof BlinkShockwave>[];
    shadowDecoys: InstanceType<typeof ShadowDecoy>[];
    chronoFreezeCircles: InstanceType<typeof ChronoFreezeCircle>[];
    miniMotherships: InstanceType<typeof MiniMothership>[];

    // Method needed for Ray beam fluid-force colour
    getPlayerImpactColor(player: Player): string;
}

/**
 * Unit Effects System – collects per-unit shot/ability effects and runs
 * hero-specific per-tick logic that was previously inlined in game-state.ts.
 */
export class UnitEffectsSystem {
    /**
     * Collect all visual and gameplay effects produced by a unit on this tick,
     * and run hero-specific per-tick ability logic.
     *
     * Called once per unit inside the main player-unit loop of GameState.update().
     *
     * @param unit    - The unit to process.
     * @param ctx     - Context providing all game-state arrays and helper methods.
     * @param enemies - Enemy targets visible to this unit's player.
     * @param deltaTime - Elapsed seconds since last tick.
     */
    static collectEffectsForUnit(
        unit: Unit,
        ctx: UnitEffectsContext,
        enemies: CombatTarget[],
        deltaTime: number
    ): void {
        // If unit is a Marine, collect its effects
        if (unit instanceof Marine) {
            const effects = unit.getAndClearLastShotEffects();
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

        // If unit is a Mothership, collect its effects
        if (unit instanceof Mothership) {
            const effects = unit.getAndClearLastShotEffects();
            if (effects.muzzleFlash) {
                ctx.muzzleFlashes.push(effects.muzzleFlash);
            }
            if (effects.casing) {
                ctx.bulletCasings.push(effects.casing);
            }
            if (effects.bouncingBullet) {
                ctx.bouncingBullets.push(effects.bouncingBullet);
            }

            // Collect spawned mini-motherships
            const minis = unit.getAndClearMiniMotherships();
            ctx.miniMotherships.push(...minis);
        }

        // Collect ability effects from all units
        const abilityEffects = unit.getAndClearLastAbilityEffects();
        ctx.abilityBullets.push(...abilityEffects);

        if (unit instanceof Starling) {
            const lasers = unit.getAndClearLastShotLasers();
            if (lasers.length > 0) {
                ctx.laserBeams.push(...lasers);

                // Spawn impact particles at laser endpoints
                for (const laser of lasers) {
                    for (let i = 0; i < Constants.STARLING_LASER_IMPACT_PARTICLES; i++) {
                        const angle = (Math.PI * 2 * i) / Constants.STARLING_LASER_IMPACT_PARTICLES;
                        const velocity = new Vector2D(
                            Math.cos(angle) * Constants.STARLING_LASER_PARTICLE_SPEED,
                            Math.sin(angle) * Constants.STARLING_LASER_PARTICLE_SPEED
                        );
                        ctx.impactParticles.push(new ImpactParticle(
                            new Vector2D(laser.endPos.x, laser.endPos.y),
                            velocity,
                            Constants.STARLING_LASER_PARTICLE_LIFETIME,
                            laser.owner.faction
                        ));
                    }
                }
            }
        }

        // Handle InfluenceBall projectiles specifically
        if (unit instanceof InfluenceBall) {
            const projectile = unit.getAndClearProjectile();
            if (projectile) {
                ctx.influenceBallProjectiles.push(projectile);
            }
        }

        // Handle Mortar projectiles
        if (unit instanceof Mortar) {
            const projectiles = unit.getAndClearLastShotProjectiles();
            if (projectiles.length > 0) {
                ctx.mortarProjectiles.push(...projectiles);
            }
        }

        // Handle Tank crescent wave
        if (unit instanceof Tank) {
            const wave = unit.getCrescentWave();
            if (wave && !ctx.crescentWaves.includes(wave)) {
                ctx.crescentWaves.push(wave);
            }
        }

        // Handle Nova bomb
        if (unit instanceof Nova) {
            const bomb = unit.getAndClearBomb();
            if (bomb) {
                ctx.novaBombs.push(bomb);
            }
        }

        // Handle Sly sticky bomb and lasers
        if (unit instanceof Sly) {
            const bomb = unit.getAndClearBombToCreate();
            if (bomb) {
                ctx.stickyBombs.push(bomb);
            }
            const lasers = unit.getAndClearLasersToCreate();
            if (lasers.length > 0) {
                ctx.stickyLasers.push(...lasers);
            }
            const particles = unit.getAndClearParticlesToCreate();
            if (particles.length > 0) {
                ctx.disintegrationParticles.push(...particles);
            }
        }

        // Handle Radiant orbs
        if (unit instanceof Radiant) {
            const orb = unit.getAndClearOrb();
            if (orb) {
                ctx.radiantOrbs.push(orb);
                // Remove oldest orb if we have more than max
                if (ctx.radiantOrbs.filter(o => o.owner === unit.owner).length > Constants.RADIANT_MAX_ORBS) {
                    const ownerOrbs = ctx.radiantOrbs.filter(o => o.owner === unit.owner);
                    const oldestOrb = ownerOrbs[0];
                    const index = ctx.radiantOrbs.indexOf(oldestOrb);
                    if (index > -1) {
                        ctx.radiantOrbs.splice(index, 1);
                    }
                }
            }
        }

        // Handle Velaris orbs
        if (unit instanceof VelarisHero) {
            const orb = unit.getAndClearOrb();
            if (orb) {
                ctx.velarisOrbs.push(orb);
                // Remove oldest orb if we have more than max
                if (ctx.velarisOrbs.filter(o => o.owner === unit.owner).length > Constants.VELARIS_MAX_ORBS) {
                    const ownerOrbs = ctx.velarisOrbs.filter(o => o.owner === unit.owner);
                    const oldestOrb = ownerOrbs[0];
                    const index = ctx.velarisOrbs.indexOf(oldestOrb);
                    if (index > -1) {
                        ctx.velarisOrbs.splice(index, 1);
                    }
                }
            }
        }

        // Handle Splendor sunlight spheres and laser visuals
        if (unit instanceof Splendor) {
            const sphere = unit.getAndClearSunSphere();
            if (sphere) {
                ctx.splendorSunSpheres.push(sphere);
            }
            const laserSegment = unit.getAndClearLaserSegment();
            if (laserSegment) {
                ctx.splendorLaserSegments.push(laserSegment);
            }
        }

        // Handle Aurum orbs
        if (unit instanceof AurumHero) {
            const orb = unit.getAndClearOrb();
            if (orb) {
                ctx.aurumOrbs.push(orb);
                // Remove oldest orb if we have more than max
                if (ctx.aurumOrbs.filter(o => o.owner === unit.owner).length > Constants.AURUM_MAX_ORBS) {
                    const ownerOrbs = ctx.aurumOrbs.filter(o => o.owner === unit.owner);
                    const oldestOrb = ownerOrbs[0];
                    const index = ctx.aurumOrbs.indexOf(oldestOrb);
                    if (index > -1) {
                        ctx.aurumOrbs.splice(index, 1);
                    }
                }
            }
        }

        // Handle Dash slashes
        if (unit instanceof Dash) {
            const slash = unit.getAndClearDashSlash();
            if (slash) {
                ctx.dashSlashes.push(slash);
                // Mark unit as dashing
                unit.setDashing(true, slash);
            }
        }

        // Handle Blink shockwaves
        if (unit instanceof Blink) {
            const shockwave = unit.getAndClearShockwave();
            if (shockwave) {
                ctx.blinkShockwaves.push(shockwave);
            }
        }

        // Handle Shadow decoys
        if (unit instanceof Shadow) {
            const decoy = unit.getAndClearDecoy();
            if (decoy) {
                ctx.shadowDecoys.push(decoy);
            }
        }

        // Handle Chrono freeze circles
        if (unit instanceof Chrono) {
            const freezeCircle = unit.getAndClearFreezeCircle();
            if (freezeCircle) {
                ctx.chronoFreezeCircles.push(freezeCircle);
            }
        }

        // Handle Ray beam updates
        if (unit instanceof Ray) {
            unit.updateBeamSegments(deltaTime);

            // Apply fluid forces from active beam segments
            for (const segment of unit.getBeamSegments()) {
                PhysicsSystem.applyFluidForceFromBeam(
                    ctx,
                    segment.startPos,
                    segment.endPos,
                    Constants.BEAM_EFFECT_RADIUS,
                    Constants.BEAM_FORCE_STRENGTH,
                    ctx.getPlayerImpactColor(unit.owner),
                    deltaTime
                );
            }

            // Process Ray ability if just used (check if cooldown is near max)
            if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1 && unit.drillDirection) {
                HeroAbilitySystem.processRayBeamAbility(unit, ctx);
                unit.drillDirection = null; // Clear after processing
            }
        }

        // Handle TurretDeployer ability
        if (unit instanceof TurretDeployer) {
            // Check if ability was just used (check if cooldown is near max)
            if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1) {
                HeroAbilitySystem.processTurretDeployment(unit, ctx);
            }
        }

        // Handle Spotlight ability updates and firing
        if (unit instanceof Spotlight) {
            HeroAbilitySystem.updateSpotlightAbility(unit, enemies, deltaTime, ctx);
        }

        // Handle Driller movement and collision
        if (unit instanceof Driller && unit.isDrilling) {
            unit.updateDrilling(deltaTime);
            HeroAbilitySystem.processDrillerCollisions(unit, deltaTime, ctx);
        }

        // Handle Dagger timers
        if (unit instanceof Dagger) {
            unit.updateTimers(deltaTime);
        }

        // Handle Grave projectile absorption
        if (unit instanceof Grave) {
            for (const projectile of unit.getProjectiles()) {
                if (projectile.isAttacking) {
                    // Check for absorption by Space Dust Swirler buildings
                    let wasAbsorbed = false;
                    for (const player of ctx.players) {
                        for (const building of player.buildings) {
                            if (building instanceof SpaceDustSwirler) {
                                // Don't absorb friendly projectiles
                                if (building.owner === projectile.owner) continue;

                                if (building.absorbProjectile(projectile)) {
                                    // Make projectile return to grave (stop attacking)
                                    projectile.isAttacking = false;
                                    projectile.trail = [];
                                    projectile.targetEnemy = null;
                                    wasAbsorbed = true;
                                    break;
                                }
                            }
                        }
                        if (wasAbsorbed) break;
                    }
                }
            }
        }
    }
}
