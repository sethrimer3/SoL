/**
 * Unit base class for SoL game
 * Base class for all combat units (heroes and minions)
 */
import { Vector2D } from '../math';
import * as Constants from '../../constants';
/**
 * Base class for all units in the game
 */
export class Unit {
    constructor(position, owner, maxHealth, attackRange, attackDamage, attackSpeed, // attacks per second
    abilityCooldownTime = 5.0, // Default ability cooldown time
    collisionRadiusPx = Constants.UNIT_RADIUS_PX) {
        this.position = position;
        this.owner = owner;
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackSpeed = attackSpeed;
        this.abilityCooldownTime = abilityCooldownTime;
        this.attackCooldown = 0;
        this.abilityCooldown = 0; // Cooldown for special ability
        this.target = null;
        this.manualTarget = null;
        this.rallyPoint = null;
        this.lastAbilityEffects = [];
        this.isHero = false; // Flag to mark unit as hero
        this.moveOrder = 0; // Movement order indicator (0 = no order)
        this.isSelected = false; // Selection state for UI
        this.rotation = 0; // Current facing angle in radians
        this.velocity = new Vector2D(0, 0);
        this.waypoints = []; // Path waypoints to follow
        this.currentWaypointIndex = 0; // Current waypoint in path
        this.stunDuration = 0; // Duration of stun effect in seconds
        this.health = maxHealth;
        this.maxHealth = maxHealth;
        this.collisionRadiusPx = collisionRadiusPx;
    }
    setManualTarget(target, rallyPoint) {
        this.manualTarget = target;
        this.target = target;
        this.clearMovementOrders();
        if (rallyPoint) {
            this.rallyPoint = new Vector2D(rallyPoint.x, rallyPoint.y);
        }
    }
    clearManualTarget() {
        this.manualTarget = null;
        this.target = null;
    }
    getManualTarget() {
        return this.manualTarget;
    }
    clearMovementOrders() {
        this.rallyPoint = null;
        this.waypoints = [];
        this.currentWaypointIndex = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
    }
    /**
     * Update unit logic
     */
    update(deltaTime, enemies, allUnits, asteroids = []) {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        // Update ability cooldown
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= deltaTime;
        }
        // Update stun duration
        if (this.stunDuration > 0) {
            this.stunDuration -= deltaTime;
            // While stunned, can't move or attack
            return;
        }
        this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits, asteroids);
        if (this.manualTarget && this.isTargetDead(this.manualTarget)) {
            this.manualTarget = null;
            this.target = null;
            this.clearMovementOrders();
        }
        // Find target if don't have one or current target is dead
        if (!this.target || this.isTargetDead(this.target)) {
            if (this.manualTarget) {
                this.target = this.manualTarget;
            }
            else {
                this.target = this.findNearestEnemy(enemies);
            }
        }
        // Attack if target in range and cooldown ready
        if (this.target && this.attackCooldown <= 0) {
            const distance = this.position.distanceTo(this.target.position);
            if (distance <= this.attackRange) {
                this.attack(this.target);
                this.attackCooldown = 1.0 / this.attackSpeed;
            }
        }
        // Rotate to face target when attacking (overrides movement rotation)
        if (this.target && !this.isTargetDead(this.target)) {
            const distance = this.position.distanceTo(this.target.position);
            if (distance <= this.attackRange) {
                const dx = this.target.position.x - this.position.x;
                const dy = this.target.position.y - this.position.y;
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
    }
    /**
     * Set a path for the unit to follow through multiple waypoints
     */
    setPath(waypoints) {
        this.waypoints = waypoints.map(wp => new Vector2D(wp.x, wp.y));
        this.currentWaypointIndex = 0;
        if (this.waypoints.length > 0) {
            this.rallyPoint = this.waypoints[0];
        }
    }
    getStructureStandoffPoint(targetPosition, targetRadiusPx) {
        const offsetX = this.position.x - targetPosition.x;
        const offsetY = this.position.y - targetPosition.y;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        const minDistance = targetRadiusPx + this.collisionRadiusPx + Constants.UNIT_STRUCTURE_STANDOFF_PX;
        if (distance <= 0) {
            return new Vector2D(targetPosition.x + minDistance, targetPosition.y);
        }
        const scale = minDistance / distance;
        return new Vector2D(targetPosition.x + offsetX * scale, targetPosition.y + offsetY * scale);
    }
    moveTowardRallyPoint(deltaTime, moveSpeed, allUnits, asteroids = []) {
        if (!this.rallyPoint) {
            this.velocity.x = 0;
            this.velocity.y = 0;
            return;
        }
        const dx = this.rallyPoint.x - this.position.x;
        const dy = this.rallyPoint.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distanceToTarget <= Constants.UNIT_ARRIVAL_THRESHOLD) {
            // Check if there are more waypoints to follow
            if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length - 1) {
                // Move to next waypoint
                this.currentWaypointIndex++;
                this.rallyPoint = this.waypoints[this.currentWaypointIndex];
                return;
            }
            else {
                // No more waypoints, clear everything
                this.rallyPoint = null;
                this.waypoints = [];
                this.currentWaypointIndex = 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
        }
        let directionX = dx / distanceToTarget;
        let directionY = dy / distanceToTarget;
        const avoidanceRangePx = Constants.UNIT_AVOIDANCE_RANGE_PX;
        const avoidanceRangeSq = avoidanceRangePx * avoidanceRangePx;
        let avoidanceX = 0;
        let avoidanceY = 0;
        for (let i = 0; i < allUnits.length; i++) {
            const otherUnit = allUnits[i];
            if (otherUnit === this || otherUnit.isDead()) {
                continue;
            }
            const offsetX = this.position.x - otherUnit.position.x;
            const offsetY = this.position.y - otherUnit.position.y;
            const distanceSq = offsetX * offsetX + offsetY * offsetY;
            if (distanceSq > 0 && distanceSq < avoidanceRangeSq) {
                const distance = Math.sqrt(distanceSq);
                const strength = (avoidanceRangePx - distance) / avoidanceRangePx;
                let weight = strength;
                if (this.isHero && !otherUnit.isHero) {
                    weight *= Constants.UNIT_HERO_AVOIDANCE_MULTIPLIER;
                }
                else if (!this.isHero && otherUnit.isHero) {
                    weight *= Constants.UNIT_MINION_YIELD_MULTIPLIER;
                }
                avoidanceX += (offsetX / distance) * weight;
                avoidanceY += (offsetY / distance) * weight;
            }
        }
        const avoidanceLength = Math.sqrt(avoidanceX * avoidanceX + avoidanceY * avoidanceY);
        if (avoidanceLength > 0) {
            avoidanceX /= avoidanceLength;
            avoidanceY /= avoidanceLength;
        }
        let asteroidAvoidanceX = 0;
        let asteroidAvoidanceY = 0;
        const lookaheadPx = Constants.UNIT_ASTEROID_AVOIDANCE_LOOKAHEAD_PX;
        const bufferPx = Constants.UNIT_ASTEROID_AVOIDANCE_BUFFER_PX;
        for (let i = 0; i < asteroids.length; i++) {
            const asteroid = asteroids[i];
            const toAsteroidX = asteroid.position.x - this.position.x;
            const toAsteroidY = asteroid.position.y - this.position.y;
            const projection = toAsteroidX * directionX + toAsteroidY * directionY;
            const avoidanceRadius = asteroid.size + this.collisionRadiusPx + bufferPx;
            const avoidanceRadiusSq = avoidanceRadius * avoidanceRadius;
            if (projection > 0 && projection < lookaheadPx) {
                const perpendicularX = toAsteroidX - directionX * projection;
                const perpendicularY = toAsteroidY - directionY * projection;
                const perpendicularDistanceSq = perpendicularX * perpendicularX + perpendicularY * perpendicularY;
                if (perpendicularDistanceSq < avoidanceRadiusSq) {
                    const cross = directionX * toAsteroidY - directionY * toAsteroidX;
                    const steerX = cross > 0 ? directionY : -directionY;
                    const steerY = cross > 0 ? -directionX : directionX;
                    const strength = (avoidanceRadius - Math.sqrt(perpendicularDistanceSq)) / avoidanceRadius;
                    asteroidAvoidanceX += steerX * strength;
                    asteroidAvoidanceY += steerY * strength;
                }
            }
            const offsetX = this.position.x - asteroid.position.x;
            const offsetY = this.position.y - asteroid.position.y;
            const distanceSq = offsetX * offsetX + offsetY * offsetY;
            if (distanceSq < avoidanceRadiusSq) {
                const distance = Math.sqrt(distanceSq);
                if (distance > 0) {
                    const pushStrength = (avoidanceRadius - distance) / avoidanceRadius;
                    asteroidAvoidanceX += (offsetX / distance) * pushStrength;
                    asteroidAvoidanceY += (offsetY / distance) * pushStrength;
                }
            }
        }
        const asteroidAvoidanceLength = Math.sqrt(asteroidAvoidanceX * asteroidAvoidanceX + asteroidAvoidanceY * asteroidAvoidanceY);
        if (asteroidAvoidanceLength > 0) {
            asteroidAvoidanceX /= asteroidAvoidanceLength;
            asteroidAvoidanceY /= asteroidAvoidanceLength;
        }
        directionX += avoidanceX * Constants.UNIT_AVOIDANCE_STRENGTH;
        directionY += avoidanceY * Constants.UNIT_AVOIDANCE_STRENGTH;
        directionX += asteroidAvoidanceX * Constants.UNIT_ASTEROID_AVOIDANCE_STRENGTH;
        directionY += asteroidAvoidanceY * Constants.UNIT_ASTEROID_AVOIDANCE_STRENGTH;
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength > 0) {
            directionX /= directionLength;
            directionY /= directionLength;
        }
        // Update rotation to face movement direction with smooth turning
        if (directionLength > 0) {
            // Add π/2 so the TOP of the sprite is treated as the FRONT (not the bottom/right side)
            const targetRotation = Math.atan2(directionY, directionX) + Math.PI / 2;
            const rotationDelta = this.getShortestAngleDelta(this.rotation, targetRotation);
            const maxRotationStep = Constants.UNIT_TURN_SPEED_RAD_PER_SEC * deltaTime;
            if (Math.abs(rotationDelta) <= maxRotationStep) {
                this.rotation = targetRotation;
            }
            else {
                this.rotation += Math.sign(rotationDelta) * maxRotationStep;
            }
            // Normalize rotation to [0, 2π) using modulo
            this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        }
        const moveDistance = moveSpeed * deltaTime;
        const moveX = directionX * moveDistance;
        const moveY = directionY * moveDistance;
        this.position.x += moveX;
        this.position.y += moveY;
        this.velocity.x = directionX * moveSpeed;
        this.velocity.y = directionY * moveSpeed;
        // Clamp position to playable map boundaries (keep units out of dark border fade zone)
        const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
        this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
        this.position.y = Math.max(-boundary, Math.min(boundary, this.position.y));
    }
    /**
     * Get shortest angle delta between two angles (in radians)
     */
    getShortestAngleDelta(from, to) {
        let delta = to - from;
        while (delta > Math.PI)
            delta -= Math.PI * 2;
        while (delta < -Math.PI)
            delta += Math.PI * 2;
        return delta;
    }
    /**
     * Check if target is dead
     */
    isTargetDead(target) {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }
    /**
     * Find nearest enemy
     */
    findNearestEnemy(enemies) {
        let nearest = null;
        let minDistance = Infinity;
        for (const enemy of enemies) {
            if ('health' in enemy && enemy.health <= 0)
                continue;
            const distance = this.position.distanceTo(enemy.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = enemy;
            }
        }
        return nearest;
    }
    /**
     * Attack target (to be overridden by subclasses)
     */
    attack(target) {
        // Base implementation
        if ('health' in target) {
            target.health -= this.attackDamage;
        }
    }
    /**
     * Use special ability in a direction (to be overridden by subclasses)
     * @param direction The normalized direction vector for the ability
     * @returns true if ability was used, false if on cooldown
     */
    useAbility(direction) {
        // Check if ability is ready
        if (this.abilityCooldown > 0) {
            return false;
        }
        // Set cooldown
        this.abilityCooldown = this.abilityCooldownTime;
        // Base implementation does nothing
        return true;
    }
    /**
     * Get effects from last ability use (for game state to manage)
     */
    getAndClearLastAbilityEffects() {
        const effects = this.lastAbilityEffects;
        this.lastAbilityEffects = [];
        return effects;
    }
    /**
     * Apply stun effect to unit
     */
    applyStun(duration) {
        this.stunDuration = Math.max(this.stunDuration, duration);
    }
    /**
     * Check if unit is stunned
     */
    isStunned() {
        return this.stunDuration > 0;
    }
    /**
     * Take damage
     */
    takeDamage(amount) {
        this.health -= amount;
    }
    /**
     * Check if unit is dead
     */
    isDead() {
        return this.health <= 0;
    }
}
