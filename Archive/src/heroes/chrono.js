"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChronoHero = void 0;
const createChronoHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Freeze circle effect - freezes all units within radius
     * Frozen units cannot move, attack, take damage, or be targeted
     */
    class ChronoFreezeCircle {
        constructor(position, radius, owner, duration) {
            this.position = position;
            this.radius = radius;
            this.owner = owner;
            this.duration = duration;
            this.lifetime = 0;
            this.affectedUnits = new Set(); // Track affected units
            this.affectedBuildings = new Set(); // Track affected buildings
        }
        update(deltaTime) {
            this.lifetime += deltaTime;
        }
        shouldDespawn() {
            return this.lifetime >= this.duration;
        }
        /**
         * Check if a position is within the freeze circle
         */
        isPositionInCircle(position) {
            const distance = this.position.distanceTo(position);
            return distance <= this.radius;
        }
        /**
         * Get visual progress for rendering (0 to 1)
         */
        getVisualProgress() {
            return this.lifetime / this.duration;
        }
    }
    /**
     * Chrono hero - freezes enemies with normal attack, creates freeze circles with ability
     */
    class Chrono extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.CHRONO_MAX_HEALTH, Constants.CHRONO_ATTACK_RANGE, Constants.CHRONO_ATTACK_DAMAGE, Constants.CHRONO_ATTACK_SPEED, Constants.CHRONO_ABILITY_BASE_COOLDOWN);
            this.freezeCircleToCreate = null;
            this.lastAbilityRadius = 0; // Track last ability radius for cooldown scaling
            this.isHero = true;
        }
        /**
         * Override attack to freeze target instead of dealing damage
         */
        attack(target) {
            // Only units can be frozen (not buildings)
            if ('stunDuration' in target && typeof target.stunDuration === 'number') {
                // Apply freeze (using stun duration) to units
                const unit = target;
                unit.stunDuration = Math.max(unit.stunDuration, Constants.CHRONO_FREEZE_DURATION);
            }
        }
        /**
         * Use ability: Create a freeze circle
         */
        useAbility(direction) {
            // Calculate radius based on arrow length
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const radius = Math.min(Math.max(arrowLength * Constants.CHRONO_ABILITY_RADIUS_MULTIPLIER, Constants.CHRONO_ABILITY_MIN_RADIUS), Constants.CHRONO_ABILITY_MAX_RADIUS);
            // Store radius for cooldown calculation
            this.lastAbilityRadius = radius;
            // Calculate dynamic cooldown based on radius
            const cooldownMultiplier = 1.0 + (radius - Constants.CHRONO_ABILITY_MIN_RADIUS) *
                Constants.CHRONO_ABILITY_COOLDOWN_PER_RADIUS;
            this.abilityCooldownTime = Constants.CHRONO_ABILITY_BASE_COOLDOWN * cooldownMultiplier;
            if (!super.useAbility(direction)) {
                return false;
            }
            this.freezeCircleToCreate = new ChronoFreezeCircle(new Vector2D(this.position.x, this.position.y), radius, this.owner, Constants.CHRONO_FREEZE_CIRCLE_DURATION);
            return true;
        }
        /**
         * Get and clear pending freeze circle
         */
        getAndClearFreezeCircle() {
            const circle = this.freezeCircleToCreate;
            this.freezeCircleToCreate = null;
            return circle;
        }
        /**
         * Get last ability radius for UI display
         */
        getLastAbilityRadius() {
            return this.lastAbilityRadius;
        }
    }
    return { Chrono, ChronoFreezeCircle };
};
exports.createChronoHero = createChronoHero;
