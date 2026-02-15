"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashHero = void 0;
const createDashHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    // Forward declaration for type checking
    class Dash extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.DASH_MAX_HEALTH, 0, // No normal attack range
            0, // No normal attack damage
            0, // No normal attack speed
            Constants.DASH_ABILITY_COOLDOWN);
            this.dashSlashToCreate = null;
            this.isDashing = false;
            this.currentDashSlash = null;
            this.isHero = true;
        }
        attack(target) {
            // Dash hero doesn't have normal attacks
        }
        update(deltaTime, enemies, allUnits, asteroids = []) {
            // Update cooldowns
            if (this.attackCooldown > 0) {
                this.attackCooldown -= deltaTime;
            }
            if (this.abilityCooldown > 0) {
                this.abilityCooldown -= deltaTime;
            }
            // Update stun duration - if stunned, can't do anything else
            if (this.stunDuration > 0) {
                this.stunDuration -= deltaTime;
                return;
            }
            // If dashing, update position to follow the dash slash
            if (this.isDashing && this.currentDashSlash) {
                this.position.x = this.currentDashSlash.position.x;
                this.position.y = this.currentDashSlash.position.y;
                // Face the direction of movement
                const direction = this.currentDashSlash.getDirection();
                this.rotation = Math.atan2(direction.y, direction.x) + Math.PI / 2;
            }
            else {
                // Normal movement when not dashing
                this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits, asteroids);
                // Update rotation based on movement or face nearest enemy
                if (this.rallyPoint) {
                    const dx = this.rallyPoint.x - this.position.x;
                    const dy = this.rallyPoint.y - this.position.y;
                    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                        const targetRotation = Math.atan2(dy, dx) + Math.PI / 2;
                        const rotationDelta = this.getShortestAngleDelta(this.rotation, targetRotation);
                        const maxRotationStep = Constants.UNIT_TURN_SPEED_RAD_PER_SEC * deltaTime;
                        if (Math.abs(rotationDelta) <= maxRotationStep) {
                            this.rotation = targetRotation;
                        }
                        else {
                            this.rotation += Math.sign(rotationDelta) * maxRotationStep;
                        }
                        this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                    }
                }
            }
        }
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate dash distance based on arrow length
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const dashDistance = Math.min(Math.max(arrowLength * Constants.DASH_DISTANCE_MULTIPLIER, Constants.DASH_MIN_DISTANCE), Constants.DASH_MAX_DISTANCE);
            // Normalize direction
            const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const normalizedX = length > 0 ? direction.x / length : 1;
            const normalizedY = length > 0 ? direction.y / length : 0;
            // Create dash slash with calculated velocity
            const velocity = new Vector2D(normalizedX * Constants.DASH_SPEED, normalizedY * Constants.DASH_SPEED);
            this.dashSlashToCreate = new DashSlash(new Vector2D(this.position.x, this.position.y), velocity, dashDistance, this.owner, this);
            return true;
        }
        getAndClearDashSlash() {
            const slash = this.dashSlashToCreate;
            this.dashSlashToCreate = null;
            return slash;
        }
        setDashing(isDashing, dashSlash = null) {
            this.isDashing = isDashing;
            this.currentDashSlash = dashSlash;
        }
        isDashingNow() {
            return this.isDashing;
        }
        takeDamage(damage) {
            if (!this.isDashing) {
                super.takeDamage(damage);
            }
            // If dashing, take no damage (invincible)
        }
    }
    /**
     * Dash slash effect - represents the hero during a dash
     * The hero becomes invincible during the dash and damages all units it passes through
     */
    class DashSlash {
        constructor(position, velocity, targetDistance, // How far the dash should go
        owner, heroUnit // Reference to the hero unit
        ) {
            this.position = position;
            this.velocity = velocity;
            this.targetDistance = targetDistance;
            this.owner = owner;
            this.heroUnit = heroUnit;
            this.lifetime = 0;
            this.distanceTraveled = 0;
            this.affectedUnits = new Set(); // Track which units have been damaged
            this.bounceCount = 0;
        }
        update(deltaTime) {
            const moveDistance = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) * deltaTime;
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.distanceTraveled += moveDistance;
            this.lifetime += deltaTime;
        }
        shouldDespawn() {
            return this.distanceTraveled >= this.targetDistance;
        }
        /**
         * Bounce off a surface with given normal direction
         */
        bounce(normalX, normalY) {
            // Reflect velocity using normal vector
            const dotProduct = this.velocity.x * normalX + this.velocity.y * normalY;
            this.velocity.x = this.velocity.x - 2 * dotProduct * normalX;
            this.velocity.y = this.velocity.y - 2 * dotProduct * normalY;
            this.bounceCount++;
        }
        /**
         * Check if a unit is within the slash hitbox
         */
        isUnitInSlash(unit) {
            const distance = this.position.distanceTo(unit.position);
            return distance < Constants.DASH_SLASH_RADIUS;
        }
        /**
         * Get current direction as normalized vector
         */
        getDirection() {
            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (speed > 0) {
                return new Vector2D(this.velocity.x / speed, this.velocity.y / speed);
            }
            return new Vector2D(1, 0);
        }
    }
    return { Dash, DashSlash };
};
exports.createDashHero = createDashHero;
