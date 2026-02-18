/**
 * Particle System
 * Handles all particle effects (death particles, damage numbers, visual effects)
 * 
 * Extracted from game-state.ts as part of Phase 3 refactoring
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Asteroid } from '../entities/asteroid';
import { Building } from '../entities/buildings';
import { Unit } from '../entities/unit';
import { SolarMirror } from '../entities/solar-mirror';
import { DamageNumber } from '../entities/damage-number';
import { 
    DeathParticle, 
    ImpactParticle, 
    SparkleParticle
} from '../entities/particles';
import { DisintegrationParticle, ShadowDecoyParticle } from '../../game-core';
import { getGameRNG } from '../../seeded-random';

/**
 * Particle context interface - defines what ParticleSystem needs from GameState
 */
export interface ParticleContext {
    asteroids: Asteroid[];
    players: Player[];
    mapSize: number;
    gameTime: number;
    deathParticles: DeathParticle[];
    damageNumbers: DamageNumber[];
    impactParticles: ImpactParticle[];
    sparkleParticles: SparkleParticle[];
    disintegrationParticles: InstanceType<typeof DisintegrationParticle>[];
    shadowDecoyParticles: InstanceType<typeof ShadowDecoyParticle>[];
}

/**
 * Particle System - handles all particle creation and updates
 */
export class ParticleSystem {
    /**
     * Create death particles for an entity that has just died
     * PUBLIC method - used by game loop when entities die
     */
    static createDeathParticles(context: ParticleContext, entity: Unit | Building, color: string): void {
        const approximateRadiusPx = entity instanceof Building
            ? entity.radius
            : Math.max(entity.collisionRadiusPx, entity.isHero ? Constants.HERO_BUTTON_RADIUS_PX * 0.8 : entity.collisionRadiusPx);
        ParticleSystem.spawnDeathParticles(context, entity.position, color, approximateRadiusPx, entity instanceof Unit && entity.isHero);
    }

    /**
     * Create death particles for a destroyed mirror
     * PUBLIC method - used by game loop when mirrors are destroyed
     */
    static createDeathParticlesForMirror(context: ParticleContext, mirror: SolarMirror, color: string): void {
        ParticleSystem.spawnDeathParticles(context, mirror.position, color, Constants.MIRROR_CLICK_RADIUS_PX, false);
    }

    /**
     * Spawn death particles at a position with given parameters
     * PRIVATE helper method
     */
    private static spawnDeathParticles(
        context: ParticleContext,
        position: Vector2D, 
        color: string, 
        approximateRadiusPx: number, 
        isHero: boolean
    ): void {
        const rng = getGameRNG();
        const radiusFactor = Math.max(0.6, approximateRadiusPx / Constants.UNIT_RADIUS_PX);
        const sizeFactor = Math.max(0.85, Math.min(3.2, radiusFactor));

        const baseMinCount = isHero ? 14 : 6;
        const baseMaxCount = isHero ? 24 : 12;
        const particleCount = Math.max(
            4,
            Math.round(rng.nextInt(baseMinCount, baseMaxCount) * (0.8 + sizeFactor * 0.75))
        );
        const baseSize = Math.max(2.2, (6 + approximateRadiusPx * 0.28) * Constants.DEATH_PARTICLE_SIZE_SCALE);

        const fadeStartTime = rng.nextFloat(5, 15);

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + rng.nextFloat(-0.25, 0.25);
            const speed = rng.nextFloat(48, 155) * (0.7 + sizeFactor * 0.25);

            const velocity = new Vector2D(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );

            const fragment = document.createElement('canvas');
            const size = rng.nextFloat(baseSize, baseSize * 2.0);
            fragment.width = size;
            fragment.height = size;
            const ctx = fragment.getContext('2d');
            if (ctx) {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, size, size);
            }

            const particle = new DeathParticle(
                new Vector2D(position.x, position.y),
                velocity,
                rng.nextAngle(),
                fragment,
                fadeStartTime
            );

            context.deathParticles.push(particle);
        }
    }

    /**
     * Update all death particles (physics, collision, cleanup)
     * PRIVATE method - called by updateVisualEffectParticles
     */
    static updateDeathParticles(context: ParticleContext, deltaTime: number): void {
        const collisionTargets: Array<{ position: Vector2D; radius: number }> = [];

        // Collect all collision targets
        for (const asteroid of context.asteroids) {
            collisionTargets.push({ position: asteroid.position, radius: asteroid.size });
        }

        for (const player of context.players) {
            if (player.stellarForge && !player.isDefeated()) {
                collisionTargets.push({ position: player.stellarForge.position, radius: player.stellarForge.radius });
            }
            for (const building of player.buildings) {
                if (!building.isDestroyed()) {
                    collisionTargets.push({ position: building.position, radius: building.radius });
                }
            }
            for (const mirror of player.solarMirrors) {
                if (mirror.health > 0) {
                    collisionTargets.push({ position: mirror.position, radius: Constants.MIRROR_CLICK_RADIUS_PX });
                }
            }
            for (const unit of player.units) {
                if (!unit.isDead()) {
                    collisionTargets.push({ position: unit.position, radius: unit.collisionRadiusPx });
                }
            }
        }

        const mapHalf = context.mapSize / 2;

        // Update each death particle
        for (const deathParticle of context.deathParticles) {
            deathParticle.update(deltaTime);

            const particleRadius = Math.max(0.75, ((deathParticle.spriteFragment?.width ?? 2) * 0.5));

            // Map edge collision
            if (deathParticle.position.x - particleRadius < -mapHalf) {
                deathParticle.position.x = -mapHalf + particleRadius;
                deathParticle.bounce(1, 0, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            } else if (deathParticle.position.x + particleRadius > mapHalf) {
                deathParticle.position.x = mapHalf - particleRadius;
                deathParticle.bounce(-1, 0, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }

            if (deathParticle.position.y - particleRadius < -mapHalf) {
                deathParticle.position.y = -mapHalf + particleRadius;
                deathParticle.bounce(0, 1, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            } else if (deathParticle.position.y + particleRadius > mapHalf) {
                deathParticle.position.y = mapHalf - particleRadius;
                deathParticle.bounce(0, -1, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }

            // Collision with game objects
            for (const target of collisionTargets) {
                const collisionDist = target.radius + particleRadius;
                const dx = deathParticle.position.x - target.position.x;
                const dy = deathParticle.position.y - target.position.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < collisionDist * collisionDist && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const overlap = collisionDist - dist;
                    deathParticle.position.x += nx * overlap;
                    deathParticle.position.y += ny * overlap;

                    deathParticle.bounce(nx, ny, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
                }
            }
        }

        // Remove expired death particles
        context.deathParticles = context.deathParticles.filter(
            deathParticle => deathParticle.lifetime < deathParticle.fadeStartTime + 1.0 // Keep for 1 second after fade starts
        );
    }

    /**
     * Update all visual effect particles (impact, sparkle, disintegration, shadow decoy, death, damage numbers)
     * PUBLIC method - called by game loop
     */
    static updateVisualEffectParticles(context: ParticleContext, deltaTime: number): void {
        // Update impact particles (visual effects only)
        for (const particle of context.impactParticles) {
            particle.update(deltaTime);
        }
        context.impactParticles = context.impactParticles.filter(particle => !particle.shouldDespawn());
        
        // Update sparkle particles (regeneration visual effects)
        for (const sparkle of context.sparkleParticles) {
            sparkle.update(deltaTime);
        }
        context.sparkleParticles = context.sparkleParticles.filter(sparkle => !sparkle.shouldDespawn());
        
        // Update death particles (breaking apart effect)
        ParticleSystem.updateDeathParticles(context, deltaTime);
        
        // Update disintegration particles
        for (const particle of context.disintegrationParticles) {
            particle.update(deltaTime);
        }
        context.disintegrationParticles = context.disintegrationParticles.filter(particle => !particle.shouldDespawn());
        
        // Update shadow decoy particles
        for (const particle of context.shadowDecoyParticles) {
            particle.update(deltaTime);
        }
        context.shadowDecoyParticles = context.shadowDecoyParticles.filter(p => !p.shouldDespawn());
    }

    /**
     * Update damage numbers and remove expired ones
     * PUBLIC method - called by game loop
     */
    static updateDamageNumbers(context: ParticleContext, deltaTime: number): void {
        for (const damageNumber of context.damageNumbers) {
            damageNumber.update(deltaTime);
        }
        // Remove expired damage numbers
        context.damageNumbers = context.damageNumbers.filter(dn => !dn.isExpired(context.gameTime));
    }
}
