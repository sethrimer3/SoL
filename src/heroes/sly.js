"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSlyHero = void 0;
const seeded_random_1 = require("../seeded-random");
const createSlyHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * DisintegrationParticle - erratic particle emitted when sticky bomb expires
     */
    class DisintegrationParticle {
        constructor(position, velocity, owner) {
            this.position = position;
            this.owner = owner;
            this.lifetime = 0;
            this.maxLifetime = Constants.STICKY_BOMB_DISINTEGRATE_PARTICLE_LIFETIME;
            this.velocity = velocity;
        }
        /**
         * Update particle position
         */
        update(deltaTime) {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }
        /**
         * Check if particle should be removed
         */
        shouldDespawn() {
            return this.lifetime >= this.maxLifetime;
        }
    }
    /**
     * StickyLaser - laser beam fired from sticky bomb
     */
    class StickyLaser {
        constructor(startPosition, direction, // Normalized direction vector
        owner, damage, width, range) {
            this.startPosition = startPosition;
            this.direction = direction;
            this.owner = owner;
            this.damage = damage;
            this.width = width;
            this.range = range;
            this.lifetime = 0;
            this.maxLifetime = Constants.STICKY_BOMB_LASER_DURATION;
        }
        /**
         * Update laser lifetime
         */
        update(deltaTime) {
            this.lifetime += deltaTime;
        }
        /**
         * Check if laser should be removed
         */
        shouldDespawn() {
            return this.lifetime >= this.maxLifetime;
        }
        /**
         * Get the end position of the laser
         */
        getEndPosition() {
            return new Vector2D(this.startPosition.x + this.direction.x * this.range, this.startPosition.y + this.direction.y * this.range);
        }
        /**
         * Check if laser hits a target (distance from line segment)
         */
        checkHit(target) {
            const endPos = this.getEndPosition();
            // Calculate distance from point to line segment
            const dx = endPos.x - this.startPosition.x;
            const dy = endPos.y - this.startPosition.y;
            const lengthSquared = dx * dx + dy * dy;
            if (lengthSquared === 0) {
                // Laser has no length
                const dist = this.startPosition.distanceTo(target.position);
                return dist < this.width / 2;
            }
            // Calculate projection of target onto laser line
            const t = Math.max(0, Math.min(1, ((target.position.x - this.startPosition.x) * dx +
                (target.position.y - this.startPosition.y) * dy) / lengthSquared));
            // Find closest point on line segment
            const closestX = this.startPosition.x + t * dx;
            const closestY = this.startPosition.y + t * dy;
            // Check distance to closest point
            const distX = target.position.x - closestX;
            const distY = target.position.y - closestY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            return distance < this.width / 2;
        }
    }
    /**
     * StickyBomb - projectile that sticks to surfaces and fires lasers
     */
    class StickyBomb {
        constructor(position, velocity, owner, slyOwner) {
            this.position = position;
            this.owner = owner;
            this.slyOwner = slyOwner;
            this.lifetime = 0;
            this.isStuck = false;
            this.stuckTo = null;
            this.stuckSurface = null;
            this.surfaceNormal = null; // Direction outward from surface
            this.isArmed = false;
            this.armedTime = 0;
            this.hasTriggered = false;
            this.bounceCount = 0;
            this.velocity = velocity;
        }
        /**
         * Update bomb position and state
         */
        update(deltaTime) {
            this.lifetime += deltaTime;
            // Update arming timer
            if (!this.isArmed) {
                this.armedTime += deltaTime;
                if (this.armedTime >= Constants.STICKY_BOMB_ARM_TIME) {
                    this.isArmed = true;
                }
            }
            // If stuck, don't move
            if (this.isStuck) {
                return;
            }
            // Apply deceleration
            const currentSpeed = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
            if (currentSpeed > Constants.STICKY_BOMB_MIN_SPEED) {
                const deceleration = Constants.STICKY_BOMB_DECELERATION * deltaTime;
                const newSpeed = Math.max(Constants.STICKY_BOMB_MIN_SPEED, currentSpeed - deceleration);
                const scale = newSpeed / currentSpeed;
                this.velocity.x *= scale;
                this.velocity.y *= scale;
            }
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
        }
        /**
         * Stick the bomb to a surface
         */
        stickToSurface(surfaceType, normal, attachedTo = null) {
            this.isStuck = true;
            this.stuckSurface = surfaceType;
            this.stuckTo = attachedTo;
            // Ensure normal is not a zero vector before normalizing
            const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
            if (length > 0.001) {
                this.surfaceNormal = new Vector2D(normal.x / length, normal.y / length);
            }
            else {
                // Fallback to upward direction if normal is zero
                this.surfaceNormal = new Vector2D(0, -1);
            }
            this.velocity = new Vector2D(0, 0);
        }
        /**
         * Check if bomb should disintegrate
         */
        shouldDisintegrate() {
            return !this.isStuck && this.lifetime >= Constants.STICKY_BOMB_MAX_LIFETIME;
        }
        /**
         * Check if bomb should be removed
         */
        shouldDespawn() {
            return this.hasTriggered || this.shouldDisintegrate();
        }
        /**
         * Trigger lasers from the bomb
         * Returns array of lasers to spawn
         */
        triggerLasers() {
            if (!this.isArmed || !this.isStuck || this.hasTriggered || !this.surfaceNormal) {
                return [];
            }
            this.hasTriggered = true;
            const lasers = [];
            // Main wide laser directly outward from surface
            lasers.push(new StickyLaser(new Vector2D(this.position.x, this.position.y), new Vector2D(this.surfaceNormal.x, this.surfaceNormal.y), this.owner, Constants.STICKY_BOMB_WIDE_LASER_DAMAGE, Constants.STICKY_BOMB_WIDE_LASER_WIDTH, Constants.STICKY_BOMB_LASER_RANGE));
            // Calculate angle of surface normal
            const normalAngle = Math.atan2(this.surfaceNormal.y, this.surfaceNormal.x);
            // Left diagonal laser (45 degrees counterclockwise)
            const leftAngle = normalAngle + Constants.STICKY_BOMB_LASER_ANGLE;
            lasers.push(new StickyLaser(new Vector2D(this.position.x, this.position.y), new Vector2D(Math.cos(leftAngle), Math.sin(leftAngle)), this.owner, Constants.STICKY_BOMB_DIAGONAL_LASER_DAMAGE, Constants.STICKY_BOMB_DIAGONAL_LASER_WIDTH, Constants.STICKY_BOMB_LASER_RANGE));
            // Right diagonal laser (45 degrees clockwise)
            const rightAngle = normalAngle - Constants.STICKY_BOMB_LASER_ANGLE;
            lasers.push(new StickyLaser(new Vector2D(this.position.x, this.position.y), new Vector2D(Math.cos(rightAngle), Math.sin(rightAngle)), this.owner, Constants.STICKY_BOMB_DIAGONAL_LASER_DAMAGE, Constants.STICKY_BOMB_DIAGONAL_LASER_WIDTH, Constants.STICKY_BOMB_LASER_RANGE));
            return lasers;
        }
        /**
         * Create disintegration particles
         */
        createDisintegrationParticles() {
            const particles = [];
            const count = Constants.STICKY_BOMB_DISINTEGRATE_PARTICLE_COUNT;
            const rng = (0, seeded_random_1.getGameRNG)();
            for (let i = 0; i < count; i++) {
                // Random erratic direction
                const angle = rng.nextAngle();
                const speed = Constants.STICKY_BOMB_DISINTEGRATE_PARTICLE_SPEED * rng.nextFloat(0.5, 1.0);
                const velocity = new Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
                particles.push(new DisintegrationParticle(new Vector2D(this.position.x, this.position.y), velocity, this.owner));
            }
            return particles;
        }
    }
    /**
     * Sly hero unit - sticky laser bomb specialist
     * Throws sticky bombs that attach to surfaces and fire lasers
     */
    class Sly extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.SLY_MAX_HEALTH, Constants.SLY_ATTACK_RANGE, Constants.SLY_ATTACK_DAMAGE, Constants.SLY_ATTACK_SPEED, Constants.SLY_ABILITY_COOLDOWN);
            this.activeBomb = null; // Currently active bomb
            this.bombToCreate = null; // Bomb to create on next game update
            this.lasersToCreate = []; // Lasers to create on next game update
            this.particlesToCreate = []; // Particles to create on next game update
            this.isHero = true; // Sly is a hero unit
        }
        /**
         * Use Sly's ability: throw sticky bomb or trigger existing one
         */
        useAbility(direction) {
            // If there's an active bomb that's armed and stuck, trigger it
            if (this.activeBomb !== null && this.activeBomb.isArmed && this.activeBomb.isStuck) {
                // Trigger the bomb to fire lasers
                const lasers = this.activeBomb.triggerLasers();
                this.lasersToCreate.push(...lasers);
                this.activeBomb = null; // Clear active bomb reference
                return true;
            }
            // If no active bomb, throw a new one
            if (this.activeBomb === null) {
                // Calculate throw direction
                const throwDir = direction.normalize();
                const speed = Constants.STICKY_BOMB_INITIAL_SPEED;
                const velocity = new Vector2D(throwDir.x * speed, throwDir.y * speed);
                // Create new sticky bomb
                const bomb = new StickyBomb(new Vector2D(this.position.x, this.position.y), velocity, this.owner, this);
                this.bombToCreate = bomb;
                this.activeBomb = bomb;
                return true;
            }
            return false;
        }
        /**
         * Get and clear bomb to create (for game state to manage)
         */
        getAndClearBombToCreate() {
            const bomb = this.bombToCreate;
            this.bombToCreate = null;
            return bomb;
        }
        /**
         * Get and clear lasers to create (for game state to manage)
         */
        getAndClearLasersToCreate() {
            const lasers = this.lasersToCreate;
            this.lasersToCreate = [];
            return lasers;
        }
        /**
         * Get and clear particles to create (for game state to manage)
         */
        getAndClearParticlesToCreate() {
            const particles = this.particlesToCreate;
            this.particlesToCreate = [];
            return particles;
        }
        /**
         * Notify that active bomb was destroyed
         */
        onBombDestroyed(bomb) {
            if (this.activeBomb === bomb) {
                // Create disintegration particles
                this.particlesToCreate.push(...bomb.createDisintegrationParticles());
                this.activeBomb = null;
            }
        }
    }
    return { Sly, StickyBomb, StickyLaser, DisintegrationParticle };
};
exports.createSlyHero = createSlyHero;
