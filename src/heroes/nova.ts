import type { Player, Unit, Vector2D, CombatTarget } from '../game-core';

type NovaHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
    AbilityBullet: any;
};

export const createNovaHero = (deps: NovaHeroDeps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;

    /**
     * Scatter bullet fired from Nova bomb explosion
     */
    class NovaScatterBullet {
        lifetime: number = 0;

        constructor(
            public position: Vector2D,
            public velocity: Vector2D,
            public owner: Player,
            public damage: number = Constants.NOVA_BOMB_SCATTER_BULLET_DAMAGE,
            public maxLifetime: number = Constants.NOVA_BOMB_SCATTER_BULLET_LIFETIME
        ) {}

        update(deltaTime: number): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }

        shouldDespawn(): boolean {
            return this.lifetime >= this.maxLifetime;
        }

        /**
         * Check if bullet hits a target
         */
        checkHit(target: CombatTarget): boolean {
            const distance = this.position.distanceTo(target.position);
            return distance < 15; // Hit radius
        }
    }

    /**
     * Nova's remote bomb projectile
     */
    class NovaBomb {
        velocity: Vector2D;
        lifetime: number = 0;
        bounceCount: number = 0;
        isArmed: boolean = false;
        scatterDirection: Vector2D | null = null;
        novaUnit: any; // Reference to the Nova unit that created this bomb

        constructor(
            public position: Vector2D,
            velocity: Vector2D,
            public owner: Player,
            novaUnit: any
        ) {
            this.velocity = velocity;
            this.novaUnit = novaUnit;
        }

        /**
         * Update bomb position and physics
         */
        update(deltaTime: number): void {
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            // Apply deceleration
            const currentSpeed = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y
            );
            
            if (currentSpeed > Constants.NOVA_BOMB_MIN_SPEED) {
                const deceleration = Constants.NOVA_BOMB_DECELERATION * deltaTime;
                const newSpeed = Math.max(Constants.NOVA_BOMB_MIN_SPEED, currentSpeed - deceleration);
                const speedRatio = newSpeed / currentSpeed;
                this.velocity.x *= speedRatio;
                this.velocity.y *= speedRatio;
            }

            // Update lifetime and arming status
            this.lifetime += deltaTime;
            if (this.lifetime >= Constants.NOVA_BOMB_ARMING_TIME) {
                this.isArmed = true;
            }
        }

        /**
         * Bounce off a surface with given normal direction
         */
        bounce(normalX: number, normalY: number): void {
            if (this.bounceCount >= Constants.NOVA_BOMB_MAX_BOUNCES) {
                return;
            }

            // Reflect velocity using normal vector
            const dotProduct = this.velocity.x * normalX + this.velocity.y * normalY;
            this.velocity.x = this.velocity.x - 2 * dotProduct * normalX;
            this.velocity.y = this.velocity.y - 2 * dotProduct * normalY;

            // Apply damping
            this.velocity.x *= Constants.NOVA_BOMB_BOUNCE_DAMPING;
            this.velocity.y *= Constants.NOVA_BOMB_BOUNCE_DAMPING;

            this.bounceCount++;
        }

        /**
         * Trigger the bomb to explode with scatter direction
         */
        trigger(direction: Vector2D): void {
            if (this.isArmed) {
                this.scatterDirection = direction.normalize();
            }
        }

        /**
         * Check if bomb should explode (triggered or damaged)
         */
        shouldExplode(): boolean {
            return this.scatterDirection !== null;
        }

        /**
         * Get the scatter direction for explosion
         */
        getScatterDirection(): Vector2D | null {
            return this.scatterDirection;
        }

        /**
         * Force premature explosion (from taking damage)
         */
        takeDamage(): void {
            // Explode in random direction if not armed yet
            if (!this.isArmed) {
                const randomAngle = Math.random() * Math.PI * 2;
                this.scatterDirection = new Vector2D(
                    Math.cos(randomAngle),
                    Math.sin(randomAngle)
                );
            } else if (this.scatterDirection === null) {
                // If armed but not triggered, explode in current velocity direction
                const speed = Math.sqrt(
                    this.velocity.x * this.velocity.x + 
                    this.velocity.y * this.velocity.y
                );
                if (speed > 0) {
                    this.scatterDirection = new Vector2D(
                        this.velocity.x / speed,
                        this.velocity.y / speed
                    );
                } else {
                    // Bomb is stationary, explode in random direction
                    const randomAngle = Math.random() * Math.PI * 2;
                    this.scatterDirection = new Vector2D(
                        Math.cos(randomAngle),
                        Math.sin(randomAngle)
                    );
                }
            }
        }
    }

    /**
     * Nova hero unit (Velaris faction) - remote bomb specialist
     */
    class Nova extends Unit {
        private activeBomb: NovaBomb | null = null;
        private bombToCreate: NovaBomb | null = null;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.NOVA_MAX_HEALTH,
                Constants.NOVA_ATTACK_RANGE,
                Constants.NOVA_ATTACK_DAMAGE,
                Constants.NOVA_ATTACK_SPEED,
                Constants.NOVA_ABILITY_COOLDOWN
            );
            this.isHero = true; // Nova is a hero unit for Velaris faction
        }

        /**
         * Use Nova's ability - throw bomb or trigger existing bomb
         */
        useAbility(direction: Vector2D): boolean {
            // If there's an active bomb, trigger it
            if (this.activeBomb !== null && this.activeBomb.isArmed) {
                this.activeBomb.trigger(direction);
                return true;
            }

            // Otherwise, throw a new bomb
            if (!super.useAbility(direction)) {
                return false;
            }

            const velocity = new Vector2D(
                direction.x * Constants.NOVA_BOMB_INITIAL_SPEED,
                direction.y * Constants.NOVA_BOMB_INITIAL_SPEED
            );

            this.bombToCreate = new NovaBomb(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner,
                this
            );

            return true;
        }

        /**
         * Get and clear pending bomb (for GameState to manage)
         */
        getAndClearBomb(): NovaBomb | null {
            const bomb = this.bombToCreate;
            this.bombToCreate = null;
            if (bomb) {
                this.activeBomb = bomb;
            }
            return bomb;
        }

        /**
         * Clear active bomb reference when it explodes
         */
        clearActiveBomb(): void {
            this.activeBomb = null;
        }

        /**
         * Get the currently active bomb
         */
        getActiveBomb(): NovaBomb | null {
            return this.activeBomb;
        }
    }

    return { Nova, NovaBomb, NovaScatterBullet };
};
