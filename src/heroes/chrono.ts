import type { CombatTarget, Player, Unit, Vector2D } from '../game-core';

type ChronoDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createChronoHero = (deps: ChronoDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Freeze circle effect - freezes all units within radius
     * Frozen units cannot move, attack, take damage, or be targeted
     */
    class ChronoFreezeCircle {
        lifetime: number = 0;
        affectedUnits: Set<Unit> = new Set(); // Track affected units
        affectedBuildings: Set<any> = new Set(); // Track affected buildings

        constructor(
            public position: Vector2D,
            public radius: number,
            public owner: Player,
            public duration: number
        ) {}

        update(deltaTime: number): void {
            this.lifetime += deltaTime;
        }

        shouldDespawn(): boolean {
            return this.lifetime >= this.duration;
        }

        /**
         * Check if a position is within the freeze circle
         */
        isPositionInCircle(position: Vector2D): boolean {
            const distance = this.position.distanceTo(position);
            return distance <= this.radius;
        }

        /**
         * Get visual progress for rendering (0 to 1)
         */
        getVisualProgress(): number {
            return this.lifetime / this.duration;
        }
    }

    /**
     * Chrono hero - freezes enemies with normal attack, creates freeze circles with ability
     */
    class Chrono extends Unit {
        private freezeCircleToCreate: ChronoFreezeCircle | null = null;
        private lastAbilityRadius: number = 0; // Track last ability radius for cooldown scaling

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.CHRONO_MAX_HEALTH,
                Constants.CHRONO_ATTACK_RANGE,
                Constants.CHRONO_ATTACK_DAMAGE,
                Constants.CHRONO_ATTACK_SPEED,
                Constants.CHRONO_ABILITY_BASE_COOLDOWN
            );
            this.isHero = true;
        }

        /**
         * Override attack to freeze target instead of dealing damage
         */
        attack(target: CombatTarget): void {
            // Only units can be frozen (not buildings)
            if ('stunDuration' in target && typeof target.stunDuration === 'number') {
                // Apply freeze (using stun duration) to units
                const unit = target as Unit;
                unit.stunDuration = Math.max(
                    unit.stunDuration,
                    Constants.CHRONO_FREEZE_DURATION
                );
            }
        }

        /**
         * Use ability: Create a freeze circle
         */
        useAbility(direction: Vector2D): boolean {
            // Calculate radius based on arrow length
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const radius = Math.min(
                Math.max(
                    arrowLength * Constants.CHRONO_ABILITY_RADIUS_MULTIPLIER,
                    Constants.CHRONO_ABILITY_MIN_RADIUS
                ),
                Constants.CHRONO_ABILITY_MAX_RADIUS
            );

            // Store radius for cooldown calculation
            this.lastAbilityRadius = radius;

            // Calculate dynamic cooldown based on radius
            const cooldownMultiplier = 1.0 + (radius - Constants.CHRONO_ABILITY_MIN_RADIUS) * 
                                        Constants.CHRONO_ABILITY_COOLDOWN_PER_RADIUS;
            this.abilityCooldownTime = Constants.CHRONO_ABILITY_BASE_COOLDOWN * cooldownMultiplier;

            if (!super.useAbility(direction)) {
                return false;
            }

            this.freezeCircleToCreate = new ChronoFreezeCircle(
                new Vector2D(this.position.x, this.position.y),
                radius,
                this.owner,
                Constants.CHRONO_FREEZE_CIRCLE_DURATION
            );

            return true;
        }

        /**
         * Get and clear pending freeze circle
         */
        getAndClearFreezeCircle(): ChronoFreezeCircle | null {
            const circle = this.freezeCircleToCreate;
            this.freezeCircleToCreate = null;
            return circle;
        }

        /**
         * Get last ability radius for UI display
         */
        getLastAbilityRadius(): number {
            return this.lastAbilityRadius;
        }
    }

    return { Chrono, ChronoFreezeCircle };
};
