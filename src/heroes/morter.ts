import type { CombatTarget, Player, Unit, Vector2D } from '../game-core';

type MorterHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createMorterHero = (deps: MorterHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Morter Projectile - projectile that deals splash damage on impact
     */
    class MorterProjectile {
        velocity: Vector2D;
        lifetime: number = 0;
        maxLifetime: number = 3.0; // 3 seconds max flight time

        constructor(
            public position: Vector2D,
            velocity: Vector2D,
            public owner: Player,
            public damage: number,
            public splashRadius: number
        ) {
            this.velocity = velocity;
        }

        /**
         * Update projectile position
         */
        update(deltaTime: number): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }

        /**
         * Check if projectile should be removed
         */
        shouldDespawn(): boolean {
            return this.lifetime >= this.maxLifetime;
        }

        /**
         * Check if projectile hits a target
         */
        checkHit(target: CombatTarget): boolean {
            const distance = this.position.distanceTo(target.position);
            return distance < 15; // Hit radius slightly larger than standard
        }

        /**
         * Apply splash damage to all targets within splash radius
         * Returns array of targets that took damage
         */
        applySplashDamage(targets: CombatTarget[]): CombatTarget[] {
            const damagedTargets: CombatTarget[] = [];
            
            for (const target of targets) {
                const distance = this.position.distanceTo(target.position);
                
                if (distance <= this.splashRadius) {
                    // Calculate damage falloff based on distance
                    const damageMultiplier = 1.0 - (distance / this.splashRadius) * (1.0 - Constants.MORTER_SPLASH_DAMAGE_FALLOFF);
                    const finalDamage = this.damage * damageMultiplier;
                    
                    // Apply damage
                    if ('health' in target) {
                        target.health -= finalDamage;
                        damagedTargets.push(target);
                    }
                }
            }
            
            return damagedTargets;
        }
    }

    /**
     * Morter hero unit (Radiant faction) - stationary artillery
     * Must be set up by swiping in a direction before it can attack
     * Detects enemies in a 150-degree cone and fires splash damage rounds at low fire rate
     */
    class Morter extends Unit {
        isSetup: boolean = false; // Not active until set up
        facingDirection: Vector2D | null = null; // Direction morter is facing after setup
        lastShotProjectiles: MorterProjectile[] = [];

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.MORTER_MAX_HEALTH,
                Constants.MORTER_ATTACK_RANGE,
                Constants.MORTER_ATTACK_DAMAGE,
                Constants.MORTER_ATTACK_SPEED,
                Constants.MORTER_ABILITY_COOLDOWN
            );
            this.isHero = true; // Morter is a hero unit for Radiant faction
        }

        /**
         * Use ability: Set up the morter facing a specific direction
         * This enables the morter to start attacking enemies in its cone
         */
        useAbility(direction: Vector2D): boolean {
            // Store the facing direction (normalized)
            this.facingDirection = direction.normalize();
            this.isSetup = true;
            
            // Mark ability as used (though it has no cooldown)
            return true;
        }

        /**
         * Override update to only find enemies within the detection cone
         */
        override update(
            deltaTime: number,
            enemies: CombatTarget[],
            allUnits: Unit[],
            asteroids: any[] = []
        ): void {
            // If not set up yet, don't attack
            if (!this.isSetup || !this.facingDirection) {
                // Just update cooldown
                if (this.attackCooldown > 0) {
                    this.attackCooldown -= deltaTime;
                }
                if (this.abilityCooldown > 0) {
                    this.abilityCooldown -= deltaTime;
                }
                return;
            }

            // Filter enemies to only those in the detection cone
            const enemiesInCone = this.getEnemiesInCone(enemies);

            // Call parent update with filtered enemy list
            super.update(deltaTime, enemiesInCone, allUnits, asteroids);
        }

        /**
         * Filter enemies to only those within the detection cone
         */
        private getEnemiesInCone(enemies: CombatTarget[]): CombatTarget[] {
            if (!this.facingDirection) {
                return [];
            }

            const enemiesInCone: CombatTarget[] = [];
            const facingAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
            const halfConeAngle = Constants.MORTER_DETECTION_CONE_ANGLE / 2;

            for (const enemy of enemies) {
                // Calculate angle to enemy
                const dx = enemy.position.x - this.position.x;
                const dy = enemy.position.y - this.position.y;
                const angleToEnemy = Math.atan2(dy, dx);

                // Calculate angle difference (accounting for wrap-around)
                let angleDiff = angleToEnemy - facingAngle;
                
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                // Check if enemy is within the cone
                if (Math.abs(angleDiff) <= halfConeAngle) {
                    enemiesInCone.push(enemy);
                }
            }

            return enemiesInCone;
        }

        /**
         * Attack with morter projectile that has splash damage
         */
        override attack(target: CombatTarget): void {
            // Don't apply damage directly - projectile will handle it
            // Just create the projectile

            // Calculate angle to target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const angle = Math.atan2(dy, dx);

            // Create projectile velocity
            const speed = Constants.MORTER_PROJECTILE_SPEED;
            const velocity = new Vector2D(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );

            // Create morter projectile with splash damage
            const projectile = new MorterProjectile(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner,
                this.attackDamage,
                Constants.MORTER_SPLASH_RADIUS
            );

            this.lastShotProjectiles.push(projectile);
        }

        /**
         * Get and clear projectiles from last shot (for game state to manage)
         */
        getAndClearLastShotProjectiles(): MorterProjectile[] {
            const projectiles = this.lastShotProjectiles;
            this.lastShotProjectiles = [];
            return projectiles;
        }

        /**
         * Check if morter is set up and ready to fire
         */
        isReadyToFire(): boolean {
            return this.isSetup && this.facingDirection !== null;
        }

        /**
         * Get the facing direction of the morter
         */
        getFacingDirection(): Vector2D | null {
            return this.facingDirection;
        }
    }

    return { Morter, MorterProjectile };
};
