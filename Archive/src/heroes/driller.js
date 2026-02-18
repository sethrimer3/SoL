"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDrillerHero = void 0;
const createDrillerHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Driller hero unit (Aurum faction) - drills through asteroids
     */
    class Driller extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.DRILLER_MAX_HEALTH, Constants.DRILLER_ATTACK_RANGE, Constants.DRILLER_ATTACK_DAMAGE, Constants.DRILLER_ATTACK_SPEED, Constants.DRILLER_ABILITY_COOLDOWN);
            this.isDrilling = false;
            this.isHidden = false; // Hidden when inside asteroid
            this.drillDirection = null;
            this.drillVelocity = new Vector2D(0, 0);
            this.hiddenInAsteroid = null;
            this.isHero = true; // Driller is a hero unit for Aurum faction
        }
        /**
         * Driller has no normal attack - only the drilling ability
         */
        attack(target) {
            // Driller does not have a normal attack - it only attacks via drilling ability
            // This is intentional per the unit design
        }
        /**
         * Use Driller's drilling ability
         */
        useAbility(direction) {
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
            this.drillVelocity = new Vector2D(this.drillDirection.x * Constants.DRILLER_DRILL_SPEED, this.drillDirection.y * Constants.DRILLER_DRILL_SPEED);
            return true;
        }
        /**
         * Update drilling movement
         */
        updateDrilling(deltaTime) {
            if (this.isDrilling && this.drillVelocity) {
                this.position.x += this.drillVelocity.x * deltaTime;
                this.position.y += this.drillVelocity.y * deltaTime;
            }
        }
        /**
         * Stop drilling and start cooldown
         */
        stopDrilling() {
            this.isDrilling = false;
            this.drillVelocity = new Vector2D(0, 0);
            // Cooldown timer already set by useAbility
        }
        /**
         * Hide in asteroid
         */
        hideInAsteroid(asteroid) {
            this.isHidden = true;
            this.hiddenInAsteroid = asteroid;
            this.position = new Vector2D(asteroid.position.x, asteroid.position.y);
        }
        /**
         * Check if driller is hidden
         */
        isHiddenInAsteroid() {
            return this.isHidden;
        }
    }
    return { Driller };
};
exports.createDrillerHero = createDrillerHero;
