"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraveHero = void 0;
const seeded_random_1 = require("../seeded-random");
const createGraveHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Small particle that follows a target (Grave or BlackHole) by gravity
     */
    class GraveSmallParticle {
        constructor(position, owner) {
            this.position = position;
            this.owner = owner;
            this.hasExploded = false;
            // Random initial velocity for natural spawning
            const rng = (0, seeded_random_1.getGameRNG)();
            const angle = rng.nextAngle();
            const speed = rng.nextFloat(20, 50);
            this.velocity = new Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        /**
         * Update small particle movement - attracted to target by gravity
         */
        update(deltaTime, attractorPosition) {
            // Calculate direction to attractor
            const dx = attractorPosition.x - this.position.x;
            const dy = attractorPosition.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0.1) {
                // Apply gravity-like attraction force
                const force = Constants.GRAVE_SMALL_PARTICLE_ATTRACTION_FORCE / Math.max(distance, 10);
                this.velocity.x += (dx / distance) * force * deltaTime;
                this.velocity.y += (dy / distance) * force * deltaTime;
            }
            // Apply drag to prevent infinite acceleration
            this.velocity.x *= Constants.GRAVE_SMALL_PARTICLE_DRAG;
            this.velocity.y *= Constants.GRAVE_SMALL_PARTICLE_DRAG;
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
        }
        /**
         * Check if particle collides with a target
         */
        checkCollision(target) {
            const distance = this.position.distanceTo(target.position);
            const hitRadius = 10; // Collision detection radius
            return distance < hitRadius;
        }
        /**
         * Apply splash damage to all targets within splash radius
         * Returns array of targets that took damage
         */
        applySplashDamage(targets) {
            const damagedTargets = [];
            for (const target of targets) {
                const distance = this.position.distanceTo(target.position);
                if (distance <= Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS) {
                    // Calculate damage falloff based on distance
                    const damageMultiplier = 1.0 - (distance / Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS) * (1.0 - Constants.GRAVE_SMALL_PARTICLE_SPLASH_FALLOFF);
                    const finalDamage = Constants.GRAVE_SMALL_PARTICLE_DAMAGE * damageMultiplier;
                    // Apply damage
                    if ('health' in target) {
                        target.health -= finalDamage;
                        damagedTargets.push(target);
                    }
                }
            }
            return damagedTargets;
        }
    }
    /**
     * Black Hole vortex particle - attracts all small particles
     */
    class GraveBlackHole {
        constructor(position, direction, owner) {
            this.position = position;
            this.owner = owner;
            this.lifetime = 0;
            // Launch in the ability direction
            this.velocity = new Vector2D(direction.x * Constants.GRAVE_BLACK_HOLE_SPEED, direction.y * Constants.GRAVE_BLACK_HOLE_SPEED);
        }
        /**
         * Update black hole position
         */
        update(deltaTime) {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }
        /**
         * Check if black hole should despawn
         */
        shouldDespawn() {
            return this.lifetime >= Constants.GRAVE_BLACK_HOLE_DURATION;
        }
    }
    /**
     * Large projectile that forms polygon corners when not attacking
     */
    class GraveProjectile {
        constructor(position, velocity, owner, index) {
            this.position = position;
            this.owner = owner;
            this.index = index;
            this.lifetime = 0;
            this.isAttacking = false;
            this.targetEnemy = null;
            this.trail = []; // Trail of positions
            this.velocity = velocity;
            this.targetAngle = (index / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
        }
        /**
         * Update projectile position - form polygon when not attacking, seek target when attacking
         */
        update(deltaTime, gravePosition) {
            if (!this.isAttacking) {
                // Form polygon shape - move toward target position on polygon
                const targetX = gravePosition.x + Math.cos(this.targetAngle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const targetY = gravePosition.y + Math.sin(this.targetAngle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const dx = targetX - this.position.x;
                const dy = targetY - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 0) {
                    // Smoothly move toward target position
                    const speed = Constants.GRAVE_PROJECTILE_MIN_SPEED;
                    const moveDistance = Math.min(speed * deltaTime, distance);
                    this.position.x += (dx / distance) * moveDistance;
                    this.position.y += (dy / distance) * moveDistance;
                    // Update velocity for consistent movement
                    this.velocity.x = (dx / distance) * speed;
                    this.velocity.y = (dy / distance) * speed;
                }
            }
            else {
                // Attacking - move toward target
                this.position.x += this.velocity.x * deltaTime;
                this.position.y += this.velocity.y * deltaTime;
            }
            // Update trail when attacking
            if (this.isAttacking) {
                this.trail.push(new Vector2D(this.position.x, this.position.y));
                if (this.trail.length > Constants.GRAVE_PROJECTILE_TRAIL_LENGTH) {
                    this.trail.shift(); // Remove oldest trail point
                }
                this.lifetime += deltaTime;
                // Return to formation after a certain lifetime (for ability shots without target)
                if (!this.targetEnemy && this.lifetime > 2.0) {
                    this.returnToOrbit();
                }
            }
            // Check if hit target
            if (this.isAttacking && this.targetEnemy) {
                const distance = this.position.distanceTo(this.targetEnemy.position);
                if (distance < Constants.GRAVE_PROJECTILE_HIT_DISTANCE) {
                    // Hit the target
                    if ('health' in this.targetEnemy) {
                        this.targetEnemy.health -= Constants.GRAVE_ATTACK_DAMAGE;
                    }
                    // Return to polygon formation
                    this.returnToOrbit();
                }
            }
        }
        /**
         * Launch projectile toward target
         */
        launchAtTarget(target) {
            this.isAttacking = true;
            this.targetEnemy = target;
            this.trail = [];
            this.lifetime = 0;
            // Set velocity toward target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                const dirX = dx / distance;
                const dirY = dy / distance;
                this.velocity.x = dirX * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
                this.velocity.y = dirY * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
            }
        }
        /**
         * Launch projectile in a direction (for ability use)
         */
        launchInDirection(direction) {
            this.isAttacking = true;
            this.targetEnemy = null; // No specific target
            this.trail = [];
            this.lifetime = 0;
            // Set velocity in the given direction
            this.velocity.x = direction.x * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
            this.velocity.y = direction.y * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
        }
        /**
         * Reset projectile to orbit mode
         */
        returnToOrbit() {
            this.isAttacking = false;
            this.targetEnemy = null;
            this.trail = [];
            this.lifetime = 0;
        }
    }
    /**
     * Grave unit - has orbiting projectiles and small particles (Velaris faction hero)
     */
    class Grave extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.GRAVE_MAX_HEALTH, Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER, // Hero units have reduced range
            Constants.GRAVE_ATTACK_DAMAGE, Constants.GRAVE_ATTACK_SPEED, 5.0 // Default ability cooldown
            );
            this.projectiles = [];
            this.smallParticles = [];
            this.smallParticleCount = 0; // Start with no particles
            this.projectileLaunchCooldown = 0;
            this.smallParticleRegenTimer = 0;
            this.isUsingAbility = false; // True while ability arrow is being dragged
            this.blackHole = null; // Active black hole
            this.explosionPositions = []; // Track explosions for rendering/screen shake
            this.isHero = true; // Grave is a hero unit for Velaris faction
            // Initialize large projectiles in polygon formation
            for (let i = 0; i < Constants.GRAVE_NUM_PROJECTILES; i++) {
                const angle = (i / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
                const offsetX = Math.cos(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const offsetY = Math.sin(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                this.projectiles.push(new GraveProjectile(new Vector2D(position.x + offsetX, position.y + offsetY), new Vector2D(0, 0), owner, i));
            }
        }
        /**
         * Spawn a new small particle
         */
        spawnSmallParticle() {
            // Spawn near the Grave unit
            const rng = (0, seeded_random_1.getGameRNG)();
            const angle = rng.nextAngle();
            const distance = rng.nextFloat(20, 50);
            const position = new Vector2D(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
            this.smallParticles.push(new GraveSmallParticle(position, this.owner));
            this.smallParticleCount++;
        }
        /**
         * Update grave and its projectiles
         */
        update(deltaTime, enemies, allUnits, asteroids = []) {
            // Update base unit logic
            super.update(deltaTime, enemies, allUnits, asteroids);
            // Clear explosion positions from previous frame
            this.explosionPositions = [];
            // Regenerate small particles over time (1 per second)
            if (this.smallParticleCount < Constants.GRAVE_MAX_SMALL_PARTICLES) {
                this.smallParticleRegenTimer += deltaTime;
                const regenInterval = 1.0 / Constants.GRAVE_SMALL_PARTICLE_REGEN_RATE;
                while (this.smallParticleRegenTimer >= regenInterval && this.smallParticleCount < Constants.GRAVE_MAX_SMALL_PARTICLES) {
                    this.spawnSmallParticle();
                    this.smallParticleRegenTimer -= regenInterval;
                }
            }
            // Update projectile launch cooldown
            if (this.projectileLaunchCooldown > 0) {
                this.projectileLaunchCooldown -= deltaTime;
            }
            // Update black hole if active
            if (this.blackHole) {
                this.blackHole.update(deltaTime);
                // Check if black hole should despawn
                if (this.blackHole.shouldDespawn()) {
                    this.blackHole = null;
                }
            }
            // Determine attractor position (black hole or Grave)
            const attractorPosition = this.blackHole ? this.blackHole.position : this.position;
            // Update all large projectiles
            for (const projectile of this.projectiles) {
                projectile.update(deltaTime, this.position);
            }
            // Update all small particles
            for (const smallParticle of this.smallParticles) {
                smallParticle.update(deltaTime, attractorPosition);
            }
            // Check for small particle collisions with enemies
            const particlesToRemove = [];
            for (let i = 0; i < this.smallParticles.length; i++) {
                const particle = this.smallParticles[i];
                // Check collision with each enemy
                for (const enemy of enemies) {
                    if ('health' in enemy && enemy.health > 0) {
                        if (particle.checkCollision(enemy)) {
                            // Apply splash damage
                            particle.applySplashDamage(enemies);
                            // Mark particle for removal
                            particlesToRemove.push(i);
                            // Record explosion position for screen shake
                            this.explosionPositions.push(new Vector2D(particle.position.x, particle.position.y));
                            break; // Particle exploded, stop checking
                        }
                    }
                }
            }
            // Remove exploded particles (reverse order to maintain indices)
            for (let i = particlesToRemove.length - 1; i >= 0; i--) {
                const index = particlesToRemove[i];
                this.smallParticles.splice(index, 1);
                this.smallParticleCount--;
            }
            // Launch projectiles at enemies if conditions are met
            if (this.canLaunchProjectile()) {
                const distance = this.position.distanceTo(this.target.position);
                if (distance <= this.attackRange) {
                    // Find an available projectile (not currently attacking)
                    const availableProjectile = this.projectiles.find((projectile) => !projectile.isAttacking);
                    if (availableProjectile) {
                        availableProjectile.launchAtTarget(this.target);
                        this.projectileLaunchCooldown = 1.0 / this.attackSpeed;
                    }
                }
            }
        }
        /**
         * Check if the Grave can launch a projectile
         */
        canLaunchProjectile() {
            return !this.isUsingAbility
                && this.target !== null
                && this.projectileLaunchCooldown <= 0;
        }
        /**
         * Grave doesn't use the base attack (projectiles do the damage)
         */
        attack(target) {
            // Projectiles handle the actual attacking
        }
        /**
         * Use special ability - launch black hole vortex
         */
        useAbility(direction) {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }
            // Create black hole
            this.blackHole = new GraveBlackHole(new Vector2D(this.position.x, this.position.y), direction, this.owner);
            // Ability was used
            this.isUsingAbility = false;
            return true;
        }
        /**
         * Called when ability arrow drag starts
         */
        startAbilityDrag() {
            this.isUsingAbility = true;
        }
        /**
         * Called when ability arrow drag ends
         */
        endAbilityDrag() {
            this.isUsingAbility = false;
        }
        /**
         * Get all projectiles for rendering
         */
        getProjectiles() {
            return this.projectiles;
        }
        /**
         * Get all small particles for rendering
         */
        getSmallParticles() {
            return this.smallParticles;
        }
        /**
         * Get current small particle count
         */
        getSmallParticleCount() {
            return this.smallParticleCount;
        }
        /**
         * Get active black hole
         */
        getBlackHole() {
            return this.blackHole;
        }
        /**
         * Get explosion positions for this frame (for screen shake)
         */
        getExplosionPositions() {
            return this.explosionPositions;
        }
    }
    return { Grave, GraveProjectile, GraveSmallParticle, GraveBlackHole };
};
exports.createGraveHero = createGraveHero;
