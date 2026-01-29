import type { AbilityBullet, Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';

type DaggerHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
    AbilityBullet: typeof AbilityBullet;
};

export const createDaggerHero = (deps: DaggerHeroDeps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;

    /**
     * Dagger hero unit (Radiant faction) - cloaked assassin
     * Always cloaked and invisible to enemies. Cannot see enemies until ability is used.
     * Becomes visible for 8 seconds after using ability.
     */
    class Dagger extends Unit {
        isCloaked: boolean = true; // Always cloaked unless ability was recently used
        visibilityTimer: number = 0; // Time remaining while visible after ability use
        canSeeEnemies: boolean = false; // Can only see enemies after using ability
        enemyVisionTimer: number = 0; // Time remaining with enemy vision

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.DAGGER_MAX_HEALTH,
                Constants.DAGGER_ATTACK_RANGE,
                Constants.DAGGER_ATTACK_DAMAGE,
                Constants.DAGGER_ATTACK_SPEED,
                Constants.DAGGER_ABILITY_COOLDOWN
            );
            this.isHero = true; // Dagger is a hero unit for Radiant faction
        }

        /**
         * Update visibility and enemy vision timers
         */
        updateTimers(deltaTime: number): void {
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
        useAbility(direction: Vector2D): boolean {
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
            const velocity = new Vector2D(
                Math.cos(attackAngle) * speed,
                Math.sin(attackAngle) * speed
            );

            // Create ability bullet
            const bullet = new AbilityBullet(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner,
                Constants.DAGGER_ABILITY_DAMAGE
            );

            // Set short range for the projectile
            bullet.maxRange = Constants.DAGGER_ABILITY_RANGE;

            this.lastAbilityEffects.push(bullet);

            return true;
        }

        /**
         * Override update to filter enemies based on vision
         */
        update(
            deltaTime: number,
            enemies: CombatTarget[],
            allUnits: Unit[],
            asteroids: Asteroid[] = []
        ): void {
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
        isCloakedToEnemies(): boolean {
            return this.isCloaked;
        }

        /**
         * Check if this Dagger can currently see enemies
         */
        hasEnemyVision(): boolean {
            return this.canSeeEnemies;
        }
    }

    return { Dagger };
};
