"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTankHero = void 0;
const createTankHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Crescent wave projectile that stuns units and erases projectiles
     */
    class CrescentWave {
        constructor(position, direction, // Normalized direction vector
        angle, // Center angle of the wave
        owner) {
            this.position = position;
            this.direction = direction;
            this.angle = angle;
            this.owner = owner;
            this.lifetime = 0;
            this.distanceTraveled = 0;
            this.affectedUnits = new Set(); // Track which units have been stunned
        }
        update(deltaTime) {
            const moveDistance = Constants.TANK_WAVE_SPEED * deltaTime;
            this.position.x += this.direction.x * moveDistance;
            this.position.y += this.direction.y * moveDistance;
            this.distanceTraveled += moveDistance;
            this.lifetime += deltaTime;
        }
        shouldDespawn() {
            return this.distanceTraveled >= Constants.TANK_WAVE_RANGE;
        }
        /**
         * Check if a point is within the crescent wave's arc
         */
        isPointInWave(point) {
            const dx = point.x - this.position.x;
            const dy = point.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Check if within wave width
            if (distance > Constants.TANK_WAVE_WIDTH) {
                return false;
            }
            // Check if within the 90-degree arc in front of the wave
            const pointAngle = Math.atan2(dy, dx);
            const angleDiff = this.normalizeAngle(pointAngle - this.angle);
            // Within 45 degrees on either side (90 degrees total)
            return Math.abs(angleDiff) <= Constants.TANK_WAVE_ANGLE / 2;
        }
        normalizeAngle(angle) {
            while (angle > Math.PI)
                angle -= 2 * Math.PI;
            while (angle < -Math.PI)
                angle += 2 * Math.PI;
            return angle;
        }
    }
    /**
     * Tank hero unit - extremely tough defensive hero with projectile shield
     * Doesn't attack but has a crescent wave ability that stuns and erases projectiles
     */
    class Tank extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.TANK_MAX_HEALTH, Constants.TANK_ATTACK_RANGE, Constants.TANK_ATTACK_DAMAGE, Constants.TANK_ATTACK_SPEED, Constants.TANK_ABILITY_COOLDOWN, Constants.TANK_COLLISION_RADIUS_PX);
            this.crescentWave = null;
            this.isHero = true;
        }
        /**
         * Tank doesn't attack
         */
        attack(target) {
            // Tank doesn't attack
        }
        /**
         * Override update to skip normal attack behavior
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
            this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits, asteroids);
            // Update rotation based on movement or face nearest enemy
            if (this.rallyPoint) {
                // Face movement direction
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
                    // Normalize rotation to [0, 2π)
                    this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                }
            }
            else {
                // Face nearest enemy when not moving
                const nearestEnemy = this.findNearestEnemy(enemies);
                if (nearestEnemy && !this.isTargetDead(nearestEnemy)) {
                    const dx = nearestEnemy.position.x - this.position.x;
                    const dy = nearestEnemy.position.y - this.position.y;
                    const targetRotation = Math.atan2(dy, dx) + Math.PI / 2;
                    const rotationDelta = this.getShortestAngleDelta(this.rotation, targetRotation);
                    const maxRotationStep = Constants.UNIT_TURN_SPEED_RAD_PER_SEC * deltaTime;
                    if (Math.abs(rotationDelta) <= maxRotationStep) {
                        this.rotation = targetRotation;
                    }
                    else {
                        this.rotation += Math.sign(rotationDelta) * maxRotationStep;
                    }
                    // Normalize rotation to [0, 2π)
                    this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                }
            }
            // Update crescent wave
            if (this.crescentWave) {
                this.crescentWave.update(deltaTime);
                if (this.crescentWave.shouldDespawn()) {
                    this.crescentWave = null;
                }
            }
        }
        /**
         * Use special ability: Crescent Wave
         * Sends a slow 90-degree wave that erases projectiles and stuns units
         */
        useAbility(direction) {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate angle from direction
            const angle = Math.atan2(direction.y, direction.x);
            // Create crescent wave
            this.crescentWave = new CrescentWave(new Vector2D(this.position.x, this.position.y), direction.normalize(), angle, this.owner);
            return true;
        }
        /**
         * Get the current crescent wave
         */
        getCrescentWave() {
            return this.crescentWave;
        }
        /**
         * Check if a position is within the shield radius
         */
        isPositionInShield(position) {
            const distance = this.position.distanceTo(position);
            return distance <= Constants.TANK_SHIELD_RADIUS;
        }
    }
    return { Tank, CrescentWave };
};
exports.createTankHero = createTankHero;
