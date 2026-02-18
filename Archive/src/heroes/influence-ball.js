"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInfluenceBallHero = void 0;
const createInfluenceBallHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Influence zone created by InfluenceBall ability
     */
    class InfluenceZone {
        constructor(position, owner, radius = Constants.INFLUENCE_BALL_EXPLOSION_RADIUS, duration = Constants.INFLUENCE_BALL_DURATION) {
            this.position = position;
            this.owner = owner;
            this.radius = radius;
            this.duration = duration;
            this.lifetime = 0;
        }
        update(deltaTime) {
            this.lifetime += deltaTime;
            return this.lifetime >= this.duration;
        }
        isExpired() {
            return this.lifetime >= this.duration;
        }
    }
    /**
     * Influence Ball projectile
     */
    class InfluenceBallProjectile {
        constructor(position, velocity, owner) {
            this.position = position;
            this.owner = owner;
            this.lifetime = 0;
            this.maxLifetime = 5.0; // Max 5 seconds before auto-explode
            this.velocity = velocity;
        }
        update(deltaTime) {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }
        shouldExplode() {
            return this.lifetime >= this.maxLifetime;
        }
    }
    /**
     * Influence Ball hero unit (Velaris faction) - creates temporary influence zones
     */
    class InfluenceBall extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.INFLUENCE_BALL_MAX_HEALTH, Constants.INFLUENCE_BALL_ATTACK_RANGE, Constants.INFLUENCE_BALL_ATTACK_DAMAGE, Constants.INFLUENCE_BALL_ATTACK_SPEED, Constants.INFLUENCE_BALL_ABILITY_COOLDOWN);
            this.projectileToCreate = null;
            this.isHero = true; // InfluenceBall is a hero unit for Velaris faction
        }
        /**
         * Use Influence Ball's area control ability
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Create influence ball projectile
            const velocity = new Vector2D(direction.x * Constants.INFLUENCE_BALL_PROJECTILE_SPEED, direction.y * Constants.INFLUENCE_BALL_PROJECTILE_SPEED);
            this.projectileToCreate = new InfluenceBallProjectile(new Vector2D(this.position.x, this.position.y), velocity, this.owner);
            return true;
        }
        /**
         * Get and clear pending projectile
         */
        getAndClearProjectile() {
            const proj = this.projectileToCreate;
            this.projectileToCreate = null;
            return proj;
        }
    }
    return { InfluenceBall, InfluenceZone, InfluenceBallProjectile };
};
exports.createInfluenceBallHero = createInfluenceBallHero;
