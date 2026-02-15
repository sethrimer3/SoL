"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMothershipHero = void 0;
const seeded_random_1 = require("../seeded-random");
const createMothershipHero = (deps) => {
    const { Unit, Vector2D, Constants, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet } = deps;
    /**
     * MiniMothership - Small autonomous units spawned by Mothership ability
     * They seek and attack enemies, then explode on death or collision
     */
    class MiniMothership {
        constructor(position, initialVelocity, owner) {
            this.lastShotEffects = {};
            this.position = position;
            this.velocity = initialVelocity;
            this.owner = owner;
            this.health = Constants.MOTHERSHIP_MINI_HEALTH;
            this.lifetime = 0;
            this.timeSinceLastAttack = 0;
            this.shouldDespawn = false;
            this.exploded = false;
        }
        update(deltaTime, targets) {
            // Update lifetime
            this.lifetime += deltaTime;
            if (this.lifetime >= Constants.MOTHERSHIP_MINI_LIFETIME) {
                this.explode();
                return;
            }
            // Update attack timer
            this.timeSinceLastAttack += deltaTime;
            // Find and attack nearest target
            const nearestTarget = this.findNearestTarget(targets);
            if (nearestTarget) {
                const distance = this.position.distanceTo(nearestTarget.position);
                // If in range, shoot at target
                if (distance <= Constants.MOTHERSHIP_MINI_ATTACK_RANGE) {
                    if (this.timeSinceLastAttack >= 1.0 / Constants.MOTHERSHIP_MINI_ATTACK_SPEED) {
                        this.attack(nearestTarget);
                        this.timeSinceLastAttack = 0;
                    }
                }
                // Move towards target
                const dx = nearestTarget.position.x - this.position.x;
                const dy = nearestTarget.position.y - this.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.velocity.x = (dx / dist) * Constants.MOTHERSHIP_MINI_SPEED;
                    this.velocity.y = (dy / dist) * Constants.MOTHERSHIP_MINI_SPEED;
                }
            }
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
        }
        findNearestTarget(targets) {
            let nearest = null;
            let minDistance = Infinity;
            for (const target of targets) {
                const distance = this.position.distanceTo(target.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = target;
                }
            }
            return nearest;
        }
        attack(target) {
            // Apply damage (like starlings)
            target.health -= Constants.MOTHERSHIP_MINI_ATTACK_DAMAGE;
            // Calculate angle to target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const angle = Math.atan2(dy, dx);
            // Create muzzle flash (Marine-style visuals)
            this.lastShotEffects.muzzleFlash = new MuzzleFlash(new Vector2D(this.position.x, this.position.y), angle);
            // Create bullet casing with slight angle deviation
            const rng = (0, seeded_random_1.getGameRNG)();
            const casingAngle = angle + Math.PI / 2 + rng.nextFloat(-0.25, 0.25); // Eject to the side
            const casingSpeed = rng.nextFloat(Constants.BULLET_CASING_SPEED_MIN, Constants.BULLET_CASING_SPEED_MAX);
            this.lastShotEffects.casing = new BulletCasing(new Vector2D(this.position.x, this.position.y), new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed));
            // Create bouncing bullet at target position
            const bounceAngle = angle + Math.PI + rng.nextFloat(-0.5, 0.5); // Bounce away from impact
            const bounceSpeed = rng.nextFloat(Constants.BOUNCING_BULLET_SPEED_MIN, Constants.BOUNCING_BULLET_SPEED_MAX);
            this.lastShotEffects.bouncingBullet = new BouncingBullet(new Vector2D(target.position.x, target.position.y), new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed));
        }
        getAndClearLastShotEffects() {
            const effects = this.lastShotEffects;
            this.lastShotEffects = {};
            return effects;
        }
        takeDamage(damage) {
            this.health -= damage;
            if (this.health <= 0) {
                this.explode();
            }
        }
        explode() {
            if (!this.exploded) {
                this.exploded = true;
                this.shouldDespawn = true;
            }
        }
        // Helper to check collision with environment
        checkCollision(boundary, asteroids, buildings) {
            // Check map boundaries
            if (this.position.x <= -boundary || this.position.x >= boundary ||
                this.position.y <= -boundary || this.position.y >= boundary) {
                return true;
            }
            // Check asteroids
            for (const asteroid of asteroids) {
                if (asteroid.containsPoint && asteroid.containsPoint(this.position)) {
                    return true;
                }
            }
            // Check buildings
            const collisionRadius = Constants.MOTHERSHIP_MINI_COLLISION_RADIUS;
            for (const building of buildings) {
                const distance = this.position.distanceTo(building.position);
                if (distance < building.radius + collisionRadius) {
                    return true;
                }
            }
            return false;
        }
    }
    /**
     * Mothership - Radiant hero that shoots like Marine but half as fast
     * Ability spawns 3 mini-motherships in triangle formation
     */
    class Mothership extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.MOTHERSHIP_MAX_HEALTH, Constants.MOTHERSHIP_ATTACK_RANGE, Constants.MOTHERSHIP_ATTACK_DAMAGE, Constants.MOTHERSHIP_ATTACK_SPEED, Constants.MOTHERSHIP_ABILITY_COOLDOWN);
            this.lastShotEffects = {};
            this.miniMothershipsToSpawn = [];
            this.isHero = true; // Mothership is a hero unit for Radiant faction
        }
        /**
         * Attack with visual effects (like Marine)
         */
        attack(target) {
            // Apply damage
            super.attack(target);
            // Calculate angle to target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const angle = Math.atan2(dy, dx);
            // Create muzzle flash
            this.lastShotEffects.muzzleFlash = new MuzzleFlash(new Vector2D(this.position.x, this.position.y), angle);
            // Create bullet casing with slight angle deviation
            const rng = (0, seeded_random_1.getGameRNG)();
            const casingAngle = angle + Math.PI / 2 + rng.nextFloat(-0.25, 0.25); // Eject to the side
            const casingSpeed = rng.nextFloat(Constants.BULLET_CASING_SPEED_MIN, Constants.BULLET_CASING_SPEED_MAX);
            this.lastShotEffects.casing = new BulletCasing(new Vector2D(this.position.x, this.position.y), new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed));
            // Create bouncing bullet at target position
            const bounceAngle = angle + Math.PI + rng.nextFloat(-0.5, 0.5); // Bounce away from impact
            const bounceSpeed = rng.nextFloat(Constants.BOUNCING_BULLET_SPEED_MIN, Constants.BOUNCING_BULLET_SPEED_MAX);
            this.lastShotEffects.bouncingBullet = new BouncingBullet(new Vector2D(target.position.x, target.position.y), new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed));
        }
        /**
         * Get effects from last shot (for game state to manage)
         */
        getAndClearLastShotEffects() {
            const effects = this.lastShotEffects;
            this.lastShotEffects = {};
            return effects;
        }
        /**
         * Use special ability: Spawn Mini-Motherships
         * Spawns 3 mini-motherships in a triangle formation
         */
        useAbility(direction) {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate angle from direction
            const angle = Math.atan2(direction.y, direction.x);
            // Spawn 3 mini-motherships in triangle formation
            const count = Constants.MOTHERSHIP_MINI_COUNT;
            const radius = Constants.MOTHERSHIP_MINI_FORMATION_RADIUS;
            for (let i = 0; i < count; i++) {
                // Calculate position in triangle (120 degrees apart)
                const miniAngle = angle + (i * 2 * Math.PI / count);
                const spawnX = this.position.x + Math.cos(miniAngle) * radius;
                const spawnY = this.position.y + Math.sin(miniAngle) * radius;
                // Calculate initial velocity toward spawn direction
                const speed = Constants.MOTHERSHIP_MINI_SPEED;
                const velocity = new Vector2D(Math.cos(miniAngle) * speed, Math.sin(miniAngle) * speed);
                // Create mini-mothership
                const mini = new MiniMothership(new Vector2D(spawnX, spawnY), velocity, this.owner);
                this.miniMothershipsToSpawn.push(mini);
            }
            return true;
        }
        /**
         * Get and clear spawned mini-motherships (for game state to manage)
         */
        getAndClearMiniMotherships() {
            const minis = this.miniMothershipsToSpawn;
            this.miniMothershipsToSpawn = [];
            return minis;
        }
    }
    return { Mothership, MiniMothership };
};
exports.createMothershipHero = createMothershipHero;
