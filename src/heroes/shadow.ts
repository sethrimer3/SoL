import type { CombatTarget, Player, Unit, Vector2D, Asteroid } from '../game-core';
import { getGameRNG } from '../seeded-random';

type ShadowHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createShadowHero = (deps: ShadowHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Shadow Decoy - A copy spawned by Shadow's ability
     * Has 3x health, draws fire, doesn't attack, becomes transparent when hit
     */
    class ShadowDecoy {
        position: Vector2D;
        velocity: Vector2D;
        owner: Player;
        health: number;
        maxHealth: number;
        opacity: number = 1.0; // Current opacity (1.0 = fully opaque, 0.75 = hit)
        targetOpacity: number = 1.0; // Target opacity to fade towards
        lifetime: number = 0;
        shouldDespawn: boolean = false;
        rotation: number; // Facing direction

        constructor(position: Vector2D, velocity: Vector2D, owner: Player, heroMaxHealth: number) {
            this.position = position;
            this.velocity = velocity;
            this.owner = owner;
            this.maxHealth = heroMaxHealth * Constants.SHADOW_DECOY_HEALTH_MULTIPLIER;
            this.health = this.maxHealth;
            // Set initial rotation based on velocity direction
            this.rotation = Math.atan2(velocity.y, velocity.x) + Math.PI / 2;
        }

        update(deltaTime: number): void {
            // Update lifetime
            this.lifetime += deltaTime;

            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            // Update opacity - fade towards target opacity
            if (this.opacity < this.targetOpacity) {
                this.opacity = Math.min(this.targetOpacity, this.opacity + Constants.SHADOW_DECOY_FADE_SPEED * deltaTime);
            }
        }

        takeDamage(damage: number): void {
            this.health -= damage;
            
            // Flash to 75% opacity on hit
            this.opacity = Constants.SHADOW_DECOY_HIT_OPACITY;
            this.targetOpacity = 1.0; // Will fade back to 100%
            
            if (this.health <= 0) {
                this.shouldDespawn = true;
            }
        }

        /**
         * Check collision with boundaries, asteroids, or structures
         */
        checkCollision(boundary: number, asteroids: Asteroid[], structures: any[]): boolean {
            // Check map boundaries
            if (this.position.x <= -boundary || this.position.x >= boundary ||
                this.position.y <= -boundary || this.position.y >= boundary) {
                return true;
            }

            // Check asteroids
            for (const asteroid of asteroids) {
                if (asteroid.containsPoint && asteroid.containsPoint(this.position)) {
                    return true;
                }
            }

            // Check structures (buildings)
            const collisionRadius = Constants.SHADOW_DECOY_COLLISION_RADIUS;
            for (const structure of structures) {
                const distance = this.position.distanceTo(structure.position);
                if (distance < structure.radius + collisionRadius) {
                    return true;
                }
            }

            return false;
        }
    }

    /**
     * Particle for decoy despawn effect
     */
    class ShadowDecoyParticle {
        position: Vector2D;
        velocity: Vector2D;
        lifetime: number = 0;
        maxLifetime: number;
        size: number;

        constructor(position: Vector2D, velocity: Vector2D) {
            this.position = new Vector2D(position.x, position.y);
            this.velocity = velocity;
            this.maxLifetime = Constants.SHADOW_DECOY_PARTICLE_LIFETIME;
            this.size = Constants.SHADOW_DECOY_PARTICLE_SIZE;
        }

        update(deltaTime: number): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }

        shouldDespawn(): boolean {
            return this.lifetime >= this.maxLifetime;
        }

        getOpacity(): number {
            // Fade out over lifetime
            return 1.0 - (this.lifetime / this.maxLifetime);
        }
    }

    /**
     * Shadow hero - Velaris faction
     * Fires a constant beam with increasing damage on sustained fire
     * Ability spawns a decoy copy
     */
    class Shadow extends Unit {
        private currentBeamTarget: CombatTarget | null = null;
        private beamDuration: number = 0; // How long we've been beaming current target
        private decoyToSpawn: ShadowDecoy | null = null;
        public currentDamageMultiplier: number = 1.0; // For display

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.SHADOW_MAX_HEALTH,
                Constants.SHADOW_ATTACK_RANGE,
                Constants.SHADOW_ATTACK_DAMAGE,
                Constants.SHADOW_ATTACK_SPEED,
                Constants.SHADOW_ABILITY_COOLDOWN,
                Constants.SHADOW_COLLISION_RADIUS_PX
            );
            this.isHero = true;
        }

        /**
         * Override update to track beam duration
         */
        update(
            deltaTime: number,
            enemies: CombatTarget[],
            allUnits: Unit[],
            asteroids: Asteroid[] = []
        ): void {
            // Update beam duration tracking
            if (this.target && !this.isTargetDead(this.target)) {
                // Check if we're still targeting the same enemy
                if (this.currentBeamTarget === this.target) {
                    const distance = this.position.distanceTo(this.target.position);
                    if (distance <= this.attackRange) {
                        // Still beaming same target in range - increase duration
                        this.beamDuration += deltaTime;
                    } else {
                        // Target out of range - reset
                        this.currentBeamTarget = null;
                        this.beamDuration = 0;
                    }
                } else {
                    // New target - reset duration
                    this.currentBeamTarget = this.target;
                    this.beamDuration = 0;
                }
            } else {
                // No target - reset
                this.currentBeamTarget = null;
                this.beamDuration = 0;
            }

            // Calculate current damage multiplier
            this.currentDamageMultiplier = Math.min(
                Constants.SHADOW_BEAM_MAX_MULTIPLIER,
                1.0 + (this.beamDuration * Constants.SHADOW_BEAM_MULTIPLIER_PER_SECOND)
            );

            // Call parent update
            super.update(deltaTime, enemies, allUnits, asteroids);
        }

        /**
         * Override attack to apply damage multiplier
         */
        attack(target: CombatTarget): void {
            // Apply damage with multiplier
            const damage = this.attackDamage * this.currentDamageMultiplier;
            target.health -= damage;

            // Reset cooldown (don't call super.attack as it applies base damage)
            this.attackCooldown = 1.0 / this.attackSpeed;
        }

        /**
         * Use Shadow's ability: Spawn a decoy copy
         */
        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            // Calculate velocity based on arrow length (direction magnitude)
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const speed = Math.min(
                arrowLength * Constants.SHADOW_DECOY_SPEED_MULTIPLIER,
                Constants.SHADOW_DECOY_MAX_SPEED
            );

            // Normalize direction
            const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const normalizedX = length > 0 ? direction.x / length : 0;
            const normalizedY = length > 0 ? direction.y / length : 0;

            const velocity = new Vector2D(
                normalizedX * speed,
                normalizedY * speed
            );

            // Create decoy at hero's position
            this.decoyToSpawn = new ShadowDecoy(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner,
                this.maxHealth
            );

            return true;
        }

        /**
         * Get and clear pending decoy
         */
        getAndClearDecoy(): ShadowDecoy | null {
            const decoy = this.decoyToSpawn;
            this.decoyToSpawn = null;
            return decoy;
        }

        /**
         * Get the beam target for rendering
         */
        getBeamTarget(): CombatTarget | null {
            return this.currentBeamTarget;
        }
    }

    return { Shadow, ShadowDecoy, ShadowDecoyParticle };
};
