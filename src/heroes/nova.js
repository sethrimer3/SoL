"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNovaHero = void 0;
const seeded_random_1 = require("../seeded-random");
const createNovaHero = (deps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;
    /**
     * Scatter bullet fired from Nova bomb explosion
     */
    class NovaScatterBullet {
        constructor(position, velocity, owner, damage = Constants.NOVA_BOMB_SCATTER_BULLET_DAMAGE, maxLifetime = Constants.NOVA_BOMB_SCATTER_BULLET_LIFETIME) {
            this.position = position;
            this.velocity = velocity;
            this.owner = owner;
            this.damage = damage;
            this.maxLifetime = maxLifetime;
            this.lifetime = 0;
        }
        update(deltaTime) {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }
        shouldDespawn() {
            return this.lifetime >= this.maxLifetime;
        }
        /**
         * Check if bullet hits a target
         */
        checkHit(target) {
            const distance = this.position.distanceTo(target.position);
            return distance < 15; // Hit radius
        }
    }
    /**
     * Nova's remote bomb projectile
     */
    class NovaBomb {
        constructor(position, velocity, owner, novaUnit) {
            this.position = position;
            this.owner = owner;
            this.lifetime = 0;
            this.bounceCount = 0;
            this.isArmed = false;
            this.scatterDirection = null;
            this.velocity = velocity;
            this.novaUnit = novaUnit;
        }
        /**
         * Update bomb position and physics
         */
        update(deltaTime) {
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            // Apply deceleration
            const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y);
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
        bounce(normalX, normalY) {
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
        trigger(direction) {
            if (this.isArmed) {
                this.scatterDirection = direction.normalize();
            }
        }
        /**
         * Check if bomb should explode (triggered or damaged)
         */
        shouldExplode() {
            return this.scatterDirection !== null;
        }
        /**
         * Get the scatter direction for explosion
         */
        getScatterDirection() {
            return this.scatterDirection;
        }
        /**
         * Force premature explosion (from taking damage)
         */
        takeDamage() {
            const rng = (0, seeded_random_1.getGameRNG)();
            // Explode in random direction if not armed yet
            if (!this.isArmed) {
                const randomAngle = rng.nextAngle();
                this.scatterDirection = new Vector2D(Math.cos(randomAngle), Math.sin(randomAngle));
            }
            else if (this.scatterDirection === null) {
                // If armed but not triggered, explode in current velocity direction
                const speed = Math.sqrt(this.velocity.x * this.velocity.x +
                    this.velocity.y * this.velocity.y);
                if (speed > 0) {
                    this.scatterDirection = new Vector2D(this.velocity.x / speed, this.velocity.y / speed);
                }
                else {
                    // Bomb is stationary, explode in random direction
                    const randomAngle = rng.nextAngle();
                    this.scatterDirection = new Vector2D(Math.cos(randomAngle), Math.sin(randomAngle));
                }
            }
        }
    }
    /**
     * Nova hero unit (Velaris faction) - remote bomb specialist
     */
    class Nova extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.NOVA_MAX_HEALTH, Constants.NOVA_ATTACK_RANGE, Constants.NOVA_ATTACK_DAMAGE, Constants.NOVA_ATTACK_SPEED, Constants.NOVA_ABILITY_COOLDOWN);
            this.activeBomb = null;
            this.bombToCreate = null;
            this.isHero = true; // Nova is a hero unit for Velaris faction
        }
        /**
         * Use Nova's ability - throw bomb or trigger existing bomb
         */
        useAbility(direction) {
            // If there's an active bomb, trigger it
            if (this.activeBomb !== null && this.activeBomb.isArmed) {
                this.activeBomb.trigger(direction);
                return true;
            }
            // Otherwise, throw a new bomb
            if (!super.useAbility(direction)) {
                return false;
            }
            const velocity = new Vector2D(direction.x * Constants.NOVA_BOMB_INITIAL_SPEED, direction.y * Constants.NOVA_BOMB_INITIAL_SPEED);
            this.bombToCreate = new NovaBomb(new Vector2D(this.position.x, this.position.y), velocity, this.owner, this);
            return true;
        }
        /**
         * Get and clear pending bomb (for GameState to manage)
         */
        getAndClearBomb() {
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
        clearActiveBomb() {
            this.activeBomb = null;
        }
        /**
         * Get the currently active bomb
         */
        getActiveBomb() {
            return this.activeBomb;
        }
    }
    return { Nova, NovaBomb, NovaScatterBullet };
};
exports.createNovaHero = createNovaHero;
