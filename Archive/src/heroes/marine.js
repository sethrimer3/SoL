"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMarineHero = void 0;
const seeded_random_1 = require("../seeded-random");
const createMarineHero = (deps) => {
    const { Unit, Vector2D, Constants, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet } = deps;
    class Marine extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.MARINE_MAX_HEALTH, Constants.MARINE_ATTACK_RANGE, Constants.MARINE_ATTACK_DAMAGE, Constants.MARINE_ATTACK_SPEED, Constants.MARINE_ABILITY_COOLDOWN);
            this.lastShotEffects = {};
            this.isHero = true; // Marine is a hero unit for Radiant faction
        }
        /**
         * Attack with visual effects
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
         * Use special ability: Bullet Storm
         * Fires a spread of bullets in the specified direction
         */
        useAbility(direction) {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate base angle from direction
            const baseAngle = Math.atan2(direction.y, direction.x);
            // Create bullets with spread
            const spreadAngle = Constants.MARINE_ABILITY_SPREAD_ANGLE;
            const bulletCount = Constants.MARINE_ABILITY_BULLET_COUNT;
            for (let i = 0; i < bulletCount; i++) {
                // Calculate angle for this bullet within the spread
                // Distribute bullets evenly within the spread angle
                // Use max to avoid division by zero if bulletCount is 1
                const angleOffset = (i / Math.max(bulletCount - 1, 1) - 0.5) * spreadAngle * 2;
                const bulletAngle = baseAngle + angleOffset;
                // Calculate velocity
                const speed = Constants.MARINE_ABILITY_BULLET_SPEED;
                const velocity = new Vector2D(Math.cos(bulletAngle) * speed, Math.sin(bulletAngle) * speed);
                // Create bullet
                const bullet = new AbilityBullet(new Vector2D(this.position.x, this.position.y), velocity, this.owner);
                this.lastAbilityEffects.push(bullet);
            }
            return true;
        }
    }
    return { Marine };
};
exports.createMarineHero = createMarineHero;
