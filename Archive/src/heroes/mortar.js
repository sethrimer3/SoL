"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMortarHero = void 0;
const createMortarHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Mortar Projectile - projectile that deals splash damage on impact
     */
    class MortarProjectile {
        constructor(position, velocity, owner, damage, splashRadius) {
            this.position = position;
            this.owner = owner;
            this.damage = damage;
            this.splashRadius = splashRadius;
            this.lifetime = 0;
            this.maxLifetime = 3.0; // 3 seconds max flight time
            this.velocity = velocity;
        }
        /**
         * Update projectile position
         */
        update(deltaTime) {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }
        /**
         * Check if projectile should be removed
         */
        shouldDespawn() {
            return this.lifetime >= this.maxLifetime;
        }
        /**
         * Check if projectile hits a target
         */
        checkHit(target) {
            const distance = this.position.distanceTo(target.position);
            return distance < 15; // Hit radius slightly larger than standard
        }
        /**
         * Apply splash damage to all targets within splash radius
         * Returns array of targets that took damage
         */
        applySplashDamage(targets) {
            const damagedTargets = [];
            for (const target of targets) {
                const distance = this.position.distanceTo(target.position);
                if (distance <= this.splashRadius) {
                    // Calculate damage falloff based on distance
                    const damageMultiplier = 1.0 - (distance / this.splashRadius) * (1.0 - Constants.MORTAR_SPLASH_DAMAGE_FALLOFF);
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
     * Mortar hero unit (Radiant faction) - stationary artillery
     * Must be set up by swiping in a direction before it can attack
     * Detects enemies in a 150-degree cone and fires splash damage rounds at low fire rate
     */
    class Mortar extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.MORTAR_MAX_HEALTH, Constants.MORTAR_ATTACK_RANGE, Constants.MORTAR_ATTACK_DAMAGE, Constants.MORTAR_ATTACK_SPEED, Constants.MORTAR_ABILITY_COOLDOWN);
            this.isSetup = false; // Not active until set up
            this.facingDirection = null; // Direction mortar is facing after setup
            this.lastShotProjectiles = [];
            this.isHero = true; // Mortar is a hero unit for Radiant faction
        }
        /**
         * Use ability: Set up the mortar facing a specific direction
         * This enables the mortar to start attacking enemies in its cone
         */
        useAbility(direction) {
            // Store the facing direction (normalized)
            this.facingDirection = direction.normalize();
            this.isSetup = true;
            // Mark ability as used (though it has no cooldown)
            return true;
        }
        /**
         * Override update to only find enemies within the detection cone
         */
        update(deltaTime, enemies, allUnits, asteroids = []) {
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
        getEnemiesInCone(enemies) {
            if (!this.facingDirection) {
                return [];
            }
            const enemiesInCone = [];
            const facingAngle = Math.atan2(this.facingDirection.y, this.facingDirection.x);
            const halfConeAngle = Constants.MORTAR_DETECTION_CONE_ANGLE / 2;
            for (const enemy of enemies) {
                // Calculate angle to enemy
                const dx = enemy.position.x - this.position.x;
                const dy = enemy.position.y - this.position.y;
                const angleToEnemy = Math.atan2(dy, dx);
                // Calculate angle difference (accounting for wrap-around)
                let angleDiff = angleToEnemy - facingAngle;
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI)
                    angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI)
                    angleDiff += 2 * Math.PI;
                // Check if enemy is within the cone
                if (Math.abs(angleDiff) <= halfConeAngle) {
                    enemiesInCone.push(enemy);
                }
            }
            return enemiesInCone;
        }
        /**
         * Attack with mortar projectile that has splash damage
         */
        attack(target) {
            // Don't apply damage directly - projectile will handle it
            // Just create the projectile
            // Calculate angle to target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const angle = Math.atan2(dy, dx);
            // Create projectile velocity
            const speed = Constants.MORTAR_PROJECTILE_SPEED;
            const velocity = new Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
            // Create mortar projectile with splash damage
            const projectile = new MortarProjectile(new Vector2D(this.position.x, this.position.y), velocity, this.owner, this.attackDamage, Constants.MORTAR_SPLASH_RADIUS);
            this.lastShotProjectiles.push(projectile);
        }
        /**
         * Get and clear projectiles from last shot (for game state to manage)
         */
        getAndClearLastShotProjectiles() {
            const projectiles = this.lastShotProjectiles;
            this.lastShotProjectiles = [];
            return projectiles;
        }
        /**
         * Check if mortar is set up and ready to fire
         */
        isReadyToFire() {
            return this.isSetup && this.facingDirection !== null;
        }
        /**
         * Get the facing direction of the mortar
         */
        getFacingDirection() {
            return this.facingDirection;
        }
    }
    return { Mortar, MortarProjectile };
};
exports.createMortarHero = createMortarHero;
