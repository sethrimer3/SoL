"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlinkHero = void 0;
const createBlinkHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Shockwave effect from blink - stuns and damages units
     * The shorter the blink distance, the larger the shockwave
     */
    class BlinkShockwave {
        constructor(position, radius, // Shockwave radius - inversely related to blink distance
        owner) {
            this.position = position;
            this.radius = radius;
            this.owner = owner;
            this.lifetime = 0;
            this.affectedUnits = new Set(); // Track which units have been hit
        }
        update(deltaTime) {
            this.lifetime += deltaTime;
        }
        shouldDespawn() {
            // Shockwave is instantaneous, despawn after first frame
            return this.lifetime > Constants.BLINK_SHOCKWAVE_HIT_WINDOW;
        }
        /**
         * Check if a unit is within the shockwave radius
         */
        isUnitInShockwave(unit) {
            const distance = this.position.distanceTo(unit.position);
            return distance <= this.radius;
        }
        /**
         * Get visual progress for rendering (0 to 1)
         */
        getVisualProgress() {
            return Math.min(this.lifetime / Constants.BLINK_SHOCKWAVE_VISUAL_DURATION, 1.0);
        }
    }
    /**
     * Blink hero - teleports and creates a stunning shockwave
     * Shorter blinks create larger shockwaves
     */
    class Blink extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.BLINK_MAX_HEALTH, 0, // No normal attack range
            0, // No normal attack damage
            0, // No normal attack speed
            Constants.BLINK_ABILITY_COOLDOWN);
            this.shockwaveToCreate = null;
            this.isHero = true;
        }
        /**
         * Blink hero doesn't attack normally
         */
        attack(target) {
            // Blink hero doesn't have normal attacks
        }
        /**
         * Override update for standard hero behavior
         */
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
            // Normal movement
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
        /**
         * Use special ability: Blink with Shockwave
         * Teleports in the direction and distance of the arrow drawn
         * Creates a shockwave that stuns and damages - shorter blinks = larger shockwaves
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate blink distance based on arrow length
            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const blinkDistance = Math.min(Math.max(arrowLength * Constants.BLINK_DISTANCE_MULTIPLIER, Constants.BLINK_MIN_DISTANCE), Constants.BLINK_MAX_DISTANCE);
            // Normalize direction
            const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const normalizedX = length > 0 ? direction.x / length : 1;
            const normalizedY = length > 0 ? direction.y / length : 0;
            // Calculate new position
            const newX = this.position.x + normalizedX * blinkDistance;
            const newY = this.position.y + normalizedY * blinkDistance;
            // Calculate shockwave radius - inverse relationship with blink distance
            // Shorter blinks = larger shockwaves
            const distanceRatio = blinkDistance / Constants.BLINK_MAX_DISTANCE;
            const shockwaveRadius = Constants.BLINK_SHOCKWAVE_MIN_RADIUS +
                (Constants.BLINK_SHOCKWAVE_MAX_RADIUS - Constants.BLINK_SHOCKWAVE_MIN_RADIUS) * (1 - distanceRatio);
            // Teleport to new position
            this.position.x = newX;
            this.position.y = newY;
            // Update rotation to face the blink direction
            this.rotation = Math.atan2(normalizedY, normalizedX) + Math.PI / 2;
            // Create shockwave at the destination
            this.shockwaveToCreate = new BlinkShockwave(new Vector2D(this.position.x, this.position.y), shockwaveRadius, this.owner);
            return true;
        }
        /**
         * Get and clear pending shockwave
         */
        getAndClearShockwave() {
            const shockwave = this.shockwaveToCreate;
            this.shockwaveToCreate = null;
            return shockwave;
        }
    }
    return { Blink, BlinkShockwave };
};
exports.createBlinkHero = createBlinkHero;
