import type { Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';

type GraveHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createGraveHero = (deps: GraveHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Projectile that orbits a Grave unit with gravitational attraction
     */
    class GraveProjectile {
        velocity: Vector2D;
        lifetime: number = 0;
        isAttacking: boolean = false;
        targetEnemy: CombatTarget | null = null;
        trail: Vector2D[] = []; // Trail of positions

        constructor(
            public position: Vector2D,
            velocity: Vector2D,
            public owner: Player
        ) {
            this.velocity = velocity;
        }

        /**
         * Update projectile position with gravitational attraction to grave
         */
        update(deltaTime: number, gravePosition: Vector2D): void {
            if (!this.isAttacking) {
                // Apply gravitational attraction to grave
                const dx = gravePosition.x - this.position.x;
                const dy = gravePosition.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    // Normalize direction
                    const dirX = dx / distance;
                    const dirY = dy / distance;

                    // Apply attraction force
                    const force = Constants.GRAVE_PROJECTILE_ATTRACTION_FORCE;
                    this.velocity.x += dirX * force * deltaTime;
                    this.velocity.y += dirY * force * deltaTime;

                    // Maintain minimum speed to keep orbiting
                    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
                    if (speed < Constants.GRAVE_PROJECTILE_MIN_SPEED) {
                        const scale = Constants.GRAVE_PROJECTILE_MIN_SPEED / speed;
                        this.velocity.x *= scale;
                        this.velocity.y *= scale;
                    }
                }
            }

            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            // Update trail when attacking
            if (this.isAttacking) {
                this.trail.push(new Vector2D(this.position.x, this.position.y));
                if (this.trail.length > Constants.GRAVE_PROJECTILE_TRAIL_LENGTH) {
                    this.trail.shift(); // Remove oldest trail point
                }
                this.lifetime += deltaTime;
            }

            // Check if hit target
            if (this.isAttacking && this.targetEnemy) {
                const distance = this.position.distanceTo(this.targetEnemy.position);
                if (distance < Constants.GRAVE_PROJECTILE_HIT_DISTANCE) {
                    // Hit the target
                    if ('health' in this.targetEnemy) {
                        this.targetEnemy.health -= Constants.GRAVE_ATTACK_DAMAGE;
                    }
                    // Mark for removal by returning to grave
                    this.isAttacking = false;
                    this.trail = [];
                    this.targetEnemy = null;
                }
            }
        }

        /**
         * Launch projectile toward target
         */
        launchAtTarget(target: CombatTarget): void {
            this.isAttacking = true;
            this.targetEnemy = target;
            this.trail = [];
            this.lifetime = 0;

            // Set velocity toward target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const dirX = dx / distance;
                const dirY = dy / distance;
                this.velocity.x = dirX * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
                this.velocity.y = dirY * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
            }
        }

        /**
         * Reset projectile to orbit mode
         */
        returnToOrbit(): void {
            this.isAttacking = false;
            this.targetEnemy = null;
            this.trail = [];
            this.lifetime = 0;
        }
    }

    /**
     * Grave unit - has orbiting projectiles that attack enemies
     */
    class Grave extends Unit {
        projectiles: GraveProjectile[] = [];
        projectileLaunchCooldown: number = 0;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.GRAVE_MAX_HEALTH,
                Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER, // Hero units have reduced range
                Constants.GRAVE_ATTACK_DAMAGE,
                Constants.GRAVE_ATTACK_SPEED,
                5.0 // Default ability cooldown
            );
            this.isHero = true; // Grave is a hero unit for Aurum faction

            // Initialize orbiting projectiles
            for (let i = 0; i < Constants.GRAVE_NUM_PROJECTILES; i++) {
                const angle = (i / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
                const offsetX = Math.cos(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const offsetY = Math.sin(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;

                // Give initial tangential velocity for orbit
                const tangentVelX = -Math.sin(angle) * Constants.GRAVE_PROJECTILE_MIN_SPEED;
                const tangentVelY = Math.cos(angle) * Constants.GRAVE_PROJECTILE_MIN_SPEED;

                this.projectiles.push(
                    new GraveProjectile(
                        new Vector2D(position.x + offsetX, position.y + offsetY),
                        new Vector2D(tangentVelX, tangentVelY),
                        owner
                    )
                );
            }
        }

        /**
         * Update grave and its projectiles
         */
        update(deltaTime: number, enemies: CombatTarget[], allUnits: Unit[], asteroids: Asteroid[] = []): void {
            // Update base unit logic
            super.update(deltaTime, enemies, allUnits, asteroids);

            // Update projectile launch cooldown
            if (this.projectileLaunchCooldown > 0) {
                this.projectileLaunchCooldown -= deltaTime;
            }

            // Update all projectiles
            for (const projectile of this.projectiles) {
                projectile.update(deltaTime, this.position);
            }

            // Launch projectiles at enemies if in range
            if (this.target && this.projectileLaunchCooldown <= 0) {
                const distance = this.position.distanceTo(this.target.position);
                if (distance <= this.attackRange) {
                    // Find an available projectile (not currently attacking)
                    const availableProjectile = this.projectiles.find((projectile) => !projectile.isAttacking);
                    if (availableProjectile) {
                        availableProjectile.launchAtTarget(this.target);
                        this.projectileLaunchCooldown = 1.0 / this.attackSpeed;
                    }
                }
            }
        }

        /**
         * Grave doesn't use the base attack (projectiles do the damage)
         */
        attack(target: CombatTarget): void {
            // Projectiles handle the actual attacking
        }

        /**
         * Get all projectiles for rendering
         */
        getProjectiles(): GraveProjectile[] {
            return this.projectiles;
        }
    }

    return { Grave, GraveProjectile };
};
