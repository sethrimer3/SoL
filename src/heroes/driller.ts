import type { Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';

type DrillerHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createDrillerHero = (deps: DrillerHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Driller hero unit (Aurum faction) - drills through asteroids
     */
    class Driller extends Unit {
        isDrilling: boolean = false;
        isHidden: boolean = false; // Hidden when inside asteroid
        drillDirection: Vector2D | null = null;
        drillVelocity: Vector2D = new Vector2D(0, 0);
        hiddenInAsteroid: Asteroid | null = null;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.DRILLER_MAX_HEALTH,
                Constants.DRILLER_ATTACK_RANGE,
                Constants.DRILLER_ATTACK_DAMAGE,
                Constants.DRILLER_ATTACK_SPEED,
                Constants.DRILLER_ABILITY_COOLDOWN
            );
            this.isHero = true; // Driller is a hero unit for Aurum faction
        }

        /**
         * Driller has no normal attack - only the drilling ability
         */
        attack(target: CombatTarget): void {
            // Driller does not have a normal attack - it only attacks via drilling ability
            // This is intentional per the unit design
        }

        /**
         * Use Driller's drilling ability
         */
        useAbility(direction: Vector2D): boolean {
            // Check if already drilling
            if (this.isDrilling) {
                return false;
            }

            if (!super.useAbility(direction)) {
                return false;
            }

            // Start drilling
            this.isDrilling = true;
            this.isHidden = false;
            this.drillDirection = direction.normalize();
            this.drillVelocity = new Vector2D(
                this.drillDirection.x * Constants.DRILLER_DRILL_SPEED,
                this.drillDirection.y * Constants.DRILLER_DRILL_SPEED
            );

            return true;
        }

        /**
         * Update drilling movement
         */
        updateDrilling(deltaTime: number): void {
            if (this.isDrilling && this.drillVelocity) {
                this.position.x += this.drillVelocity.x * deltaTime;
                this.position.y += this.drillVelocity.y * deltaTime;
            }
        }

        /**
         * Stop drilling and start cooldown
         */
        stopDrilling(): void {
            this.isDrilling = false;
            this.drillVelocity = new Vector2D(0, 0);
            // Cooldown timer already set by useAbility
        }

        /**
         * Hide in asteroid
         */
        hideInAsteroid(asteroid: Asteroid): void {
            this.isHidden = true;
            this.hiddenInAsteroid = asteroid;
            this.position = new Vector2D(asteroid.position.x, asteroid.position.y);
        }

        /**
         * Check if driller is hidden
         */
        isHiddenInAsteroid(): boolean {
            return this.isHidden;
        }
    }

    return { Driller };
};
