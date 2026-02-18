"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDaggerHero = void 0;
const createDaggerHero = (deps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;
    /**
     * Dagger hero unit (Radiant faction) - cloaked assassin
     * Always cloaked and invisible to enemies. Cannot see enemies until ability is used.
     * Becomes visible for 8 seconds after using ability.
     */
    class Dagger extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.DAGGER_MAX_HEALTH, Constants.DAGGER_ATTACK_RANGE, Constants.DAGGER_ATTACK_DAMAGE, Constants.DAGGER_ATTACK_SPEED, Constants.DAGGER_ABILITY_COOLDOWN);
            this.isCloaked = true; // Always cloaked unless ability was recently used
            this.visibilityTimer = 0; // Time remaining while visible after ability use
            this.canSeeEnemies = false; // Can only see enemies after using ability
            this.enemyVisionTimer = 0; // Time remaining with enemy vision
            this.isHero = true; // Dagger is a hero unit for Radiant faction
        }
        /**
         * Update visibility and enemy vision timers
         */
        updateTimers(deltaTime) {
            // Update visibility timer (visible to enemies after ability use)
            if (this.visibilityTimer > 0) {
                this.visibilityTimer -= deltaTime;
                if (this.visibilityTimer <= 0) {
                    this.visibilityTimer = 0;
                    this.isCloaked = true; // Return to cloaked state
                }
            }
            // Update enemy vision timer (can see enemies after ability use)
            if (this.enemyVisionTimer > 0) {
                this.enemyVisionTimer -= deltaTime;
                if (this.enemyVisionTimer <= 0) {
                    this.enemyVisionTimer = 0;
                    this.canSeeEnemies = false; // Lose ability to see enemies
                }
            }
        }
        /**
         * Use Dagger's ability: short-range directional attack
         * Deals damage in a cone and reveals the Dagger for 8 seconds
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Reveal Dagger for 8 seconds
            this.isCloaked = false;
            this.visibilityTimer = Constants.DAGGER_VISIBILITY_DURATION;
            // Grant enemy vision for 8 seconds
            this.canSeeEnemies = true;
            this.enemyVisionTimer = Constants.DAGGER_VISIBILITY_DURATION;
            // Calculate attack direction
            const attackDir = direction.normalize();
            const attackAngle = Math.atan2(attackDir.y, attackDir.x);
            // Create a short-range directional attack projectile
            const speed = 400; // Fast projectile speed
            const velocity = new Vector2D(Math.cos(attackAngle) * speed, Math.sin(attackAngle) * speed);
            // Create ability bullet
            const bullet = new AbilityBullet(new Vector2D(this.position.x, this.position.y), velocity, this.owner, Constants.DAGGER_ABILITY_DAMAGE);
            // Set short range for the projectile
            bullet.maxRange = Constants.DAGGER_ABILITY_RANGE;
            this.lastAbilityEffects.push(bullet);
            return true;
        }
        /**
         * Override update to filter enemies based on vision
         */
        update(deltaTime, enemies, allUnits, asteroids = []) {
            // Filter enemies - Dagger can only see enemies if it has enemy vision
            let visibleEnemies = enemies;
            if (!this.canSeeEnemies) {
                visibleEnemies = []; // Cannot see any enemies when lacking enemy vision
            }
            // Call parent update with filtered enemy list
            super.update(deltaTime, visibleEnemies, allUnits, asteroids);
        }
        /**
         * Check if this Dagger is cloaked (invisible to enemies)
         */
        isCloakedToEnemies() {
            return this.isCloaked;
        }
        /**
         * Check if this Dagger can currently see enemies
         */
        hasEnemyVision() {
            return this.canSeeEnemies;
        }
    }
    return { Dagger };
};
exports.createDaggerHero = createDaggerHero;
