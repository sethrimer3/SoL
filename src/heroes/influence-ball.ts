import type { Player, Unit, Vector2D } from '../game-core';

type InfluenceBallHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createInfluenceBallHero = (deps: InfluenceBallHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Influence zone created by InfluenceBall ability
     */
    class InfluenceZone {
        lifetime: number = 0;

        constructor(
            public position: Vector2D,
            public owner: Player,
            public radius: number = Constants.INFLUENCE_BALL_EXPLOSION_RADIUS,
            public duration: number = Constants.INFLUENCE_BALL_DURATION
        ) {}

        update(deltaTime: number): boolean {
            this.lifetime += deltaTime;
            return this.lifetime >= this.duration;
        }

        isExpired(): boolean {
            return this.lifetime >= this.duration;
        }
    }

    /**
     * Influence Ball projectile
     */
    class InfluenceBallProjectile {
        velocity: Vector2D;
        lifetime: number = 0;
        maxLifetime: number = 5.0; // Max 5 seconds before auto-explode

        constructor(
            public position: Vector2D,
            velocity: Vector2D,
            public owner: Player
        ) {
            this.velocity = velocity;
        }

        update(deltaTime: number): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }

        shouldExplode(): boolean {
            return this.lifetime >= this.maxLifetime;
        }
    }

    /**
     * Influence Ball hero unit (Velaris faction) - creates temporary influence zones
     */
    class InfluenceBall extends Unit {
        private projectileToCreate: InfluenceBallProjectile | null = null;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.INFLUENCE_BALL_MAX_HEALTH,
                Constants.INFLUENCE_BALL_ATTACK_RANGE,
                Constants.INFLUENCE_BALL_ATTACK_DAMAGE,
                Constants.INFLUENCE_BALL_ATTACK_SPEED,
                Constants.INFLUENCE_BALL_ABILITY_COOLDOWN
            );
            this.isHero = true; // InfluenceBall is a hero unit for Velaris faction
        }

        /**
         * Use Influence Ball's area control ability
         */
        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            // Create influence ball projectile
            const velocity = new Vector2D(
                direction.x * Constants.INFLUENCE_BALL_PROJECTILE_SPEED,
                direction.y * Constants.INFLUENCE_BALL_PROJECTILE_SPEED
            );

            this.projectileToCreate = new InfluenceBallProjectile(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner
            );

            return true;
        }

        /**
         * Get and clear pending projectile
         */
        getAndClearProjectile(): InfluenceBallProjectile | null {
            const proj = this.projectileToCreate;
            this.projectileToCreate = null;
            return proj;
        }
    }

    return { InfluenceBall, InfluenceZone, InfluenceBallProjectile };
};
