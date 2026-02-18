"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVelarisHero = void 0;
const createVelarisHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Orb projectile for Velaris hero
     * Same physics as Radiant but creates light-blocking fields
     */
    class VelarisOrb {
        constructor(position, velocity, owner) {
            this.position = position;
            this.velocity = velocity;
            this.owner = owner;
            this.lifetime = 0;
            this.deceleration = Constants.VELARIS_ORB_DECELERATION;
        }
        update(deltaTime, asteroids) {
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            // Apply deceleration
            const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (currentSpeed > 0) {
                const newSpeed = Math.max(0, currentSpeed - this.deceleration * deltaTime);
                const speedRatio = newSpeed / currentSpeed;
                this.velocity.x *= speedRatio;
                this.velocity.y *= speedRatio;
            }
            // Bounce off asteroids
            for (const asteroid of asteroids) {
                if (asteroid.containsPoint(this.position)) {
                    // Calculate bounce direction (reflect off normal)
                    const dx = this.position.x - asteroid.position.x;
                    const dy = this.position.y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        // Reflect velocity
                        const dot = this.velocity.x * normalX + this.velocity.y * normalY;
                        this.velocity.x -= 2 * dot * normalX;
                        this.velocity.y -= 2 * dot * normalY;
                        // Apply bounce damping
                        this.velocity.x *= Constants.VELARIS_ORB_BOUNCE_DAMPING;
                        this.velocity.y *= Constants.VELARIS_ORB_BOUNCE_DAMPING;
                        // Push orb out of asteroid
                        const pushDist = asteroid.size + 5 - dist;
                        if (pushDist > 0) {
                            this.position.x += normalX * pushDist;
                            this.position.y += normalY * pushDist;
                        }
                    }
                    break;
                }
            }
            this.lifetime += deltaTime;
        }
        getCurrentSpeed() {
            return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        }
        getInitialSpeed() {
            return this.getCurrentSpeed() + this.deceleration * this.lifetime;
        }
        getRange() {
            const speed = this.getCurrentSpeed();
            const maxSpeed = Constants.VELARIS_ORB_MAX_SPEED;
            const speedRatio = speed / maxSpeed;
            return Constants.VELARIS_ORB_MIN_RANGE +
                (Constants.VELARIS_ORB_MAX_RANGE - Constants.VELARIS_ORB_MIN_RANGE) * speedRatio;
        }
        isStopped() {
            return this.getCurrentSpeed() < 1.0;
        }
    }
    /**
     * Velaris hero - fires orbs that create light-blocking fields
     * Does not attack normally
     */
    class VelarisHero extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.VELARIS_HERO_MAX_HEALTH, 0, // No attack range - doesn't attack
            0, // No attack damage
            0, // No attack speed
            Constants.VELARIS_HERO_ABILITY_COOLDOWN);
            this.orbToCreate = null;
            this.isHero = true;
        }
        // Override attack to do nothing
        attack(target) {
            // Velaris hero doesn't attack
        }
        /**
         * Use ability: Launch an orb
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate velocity based on direction length (arrow length)
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const speed = Math.min(arrowLength * Constants.VELARIS_ORB_SPEED_MULTIPLIER, Constants.VELARIS_ORB_MAX_SPEED);
            // Normalize direction
            const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const normalizedX = length > 0 ? direction.x / length : 0;
            const normalizedY = length > 0 ? direction.y / length : 0;
            const velocity = new Vector2D(normalizedX * speed, normalizedY * speed);
            this.orbToCreate = new VelarisOrb(new Vector2D(this.position.x, this.position.y), velocity, this.owner);
            return true;
        }
        /**
         * Get and clear pending orb
         */
        getAndClearOrb() {
            const orb = this.orbToCreate;
            this.orbToCreate = null;
            return orb;
        }
    }
    return { VelarisHero, VelarisOrb };
};
exports.createVelarisHero = createVelarisHero;
