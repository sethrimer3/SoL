/**
 * Starling minion unit for SoL game
 * Basic minion unit that follows paths and attacks enemies
 */
import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Unit } from './unit';
import { LaserBeam } from './particles';
import { StellarForge } from './stellar-forge';
import { getGameRNG } from '../../seeded-random';
export class Starling extends Unit {
    constructor(position, owner, assignedPath = []) {
        super(position, owner, Constants.STARLING_MAX_HEALTH, Constants.STARLING_ATTACK_RANGE, Constants.STARLING_ATTACK_DAMAGE, Constants.STARLING_ATTACK_SPEED, Constants.STARLING_BLINK_COOLDOWN_SEC, Constants.STARLING_COLLISION_RADIUS_PX);
        this.explorationTarget = null;
        this.explorationTimer = 0;
        this.currentPathWaypointIndex = 0; // Current waypoint index in the assigned path
        this.assignedPath = [];
        this.hasManualOrder = false;
        this.lastShotLasers = [];
        this.pathHash = ''; // Unique identifier for the assigned path
        this.hasReachedFinalWaypoint = false; // True when starling reaches the last waypoint
        this.currentMoveSpeedPxPerSec = Constants.STARLING_MOVE_SPEED;
        this.spriteLevel = 1; // Sprite level (1-4)
        this.assignedPath = assignedPath.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
        this.pathHash = this.generatePathHash(this.assignedPath);
    }
    /**
     * Generate a unique hash for the assigned path to identify starlings with the same movement instructions
     */
    generatePathHash(path) {
        if (path.length === 0) {
            return 'no-path';
        }
        // Hash every waypoint so mid-path geometry changes invalidate the cache key.
        let checksum = 2166136261;
        for (let i = 0; i < path.length; i++) {
            const waypoint = path[i];
            const xCentiPx = Math.round(waypoint.x * 100);
            const yCentiPx = Math.round(waypoint.y * 100);
            checksum = Math.imul(checksum ^ xCentiPx, 16777619);
            checksum = Math.imul(checksum ^ yCentiPx, 16777619);
        }
        return `path:${path.length}:${(checksum >>> 0).toString(16)}`;
    }
    setManualRallyPoint(target) {
        this.tryBlinkToward(target);
        this.rallyPoint = target;
        this.hasManualOrder = true;
        // Reset the final waypoint flag since we're now moving to a new destination
        this.hasReachedFinalWaypoint = false;
    }
    setManualTarget(target, rallyPoint) {
        this.manualTarget = target;
        this.target = target;
        this.clearMovementOrders();
        this.hasManualOrder = true;
        this.hasReachedFinalWaypoint = false;
        if (rallyPoint) {
            this.setManualRallyPoint(rallyPoint);
        }
    }
    setPath(path) {
        this.assignedPath = path.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
        this.pathHash = this.generatePathHash(this.assignedPath);
        this.currentPathWaypointIndex = 0;
        this.hasManualOrder = true;
        this.hasReachedFinalWaypoint = false;
        this.rallyPoint = null; // Clear rally point when following a path
    }
    tryBlinkToward(target) {
        if (!this.owner.hasBlinkUpgrade || this.abilityCooldown > 0) {
            return;
        }
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distanceToTarget <= 0) {
            return;
        }
        const blinkDistance = Math.min(Constants.STARLING_BLINK_DISTANCE_PX, distanceToTarget);
        const directionX = dx / distanceToTarget;
        const directionY = dy / distanceToTarget;
        this.position.x += directionX * blinkDistance;
        this.position.y += directionY * blinkDistance;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.abilityCooldown = this.abilityCooldownTime;
    }
    getAssignedPathLength() {
        return this.assignedPath.length;
    }
    getPathHash() {
        return this.pathHash;
    }
    getHasReachedFinalWaypoint() {
        return this.hasReachedFinalWaypoint;
    }
    getCurrentPathWaypointIndex() {
        return this.currentPathWaypointIndex;
    }
    getCurrentMoveSpeedPxPerSec() {
        return this.currentMoveSpeedPxPerSec;
    }
    hasActiveManualOrder() {
        return this.hasManualOrder;
    }
    clearManualOrders() {
        this.hasManualOrder = false;
        this.clearManualTarget();
        this.clearMovementOrders();
        this.hasReachedFinalWaypoint = false;
    }
    getAndClearLastShotProjectiles() {
        // Legacy method - no longer used for lasers
        return [];
    }
    getAndClearLastShotLasers() {
        const lasers = this.lastShotLasers;
        this.lastShotLasers = [];
        return lasers;
    }
    /**
     * Update starling AI behavior (call this before regular update)
     */
    updateAI(gameState, enemies) {
        if (this.hasManualOrder) {
            return;
        }
        // Use the assigned minion path
        if (this.assignedPath.length > 0) {
            // Follow the base's path
            const targetWaypoint = this.assignedPath[this.currentPathWaypointIndex];
            const rallyTarget = this.getStandoffPointForWaypoint(gameState, targetWaypoint) ?? targetWaypoint;
            // Check if we've reached the current waypoint
            if (this.position.distanceTo(rallyTarget) < Constants.UNIT_ARRIVAL_THRESHOLD * Constants.PATH_WAYPOINT_ARRIVAL_MULTIPLIER) {
                // Move to next waypoint if there is one
                if (this.currentPathWaypointIndex < this.assignedPath.length - 1) {
                    this.currentPathWaypointIndex++;
                    const nextWaypoint = this.assignedPath[this.currentPathWaypointIndex];
                    this.rallyPoint = this.getStandoffPointForWaypoint(gameState, nextWaypoint) ?? nextWaypoint;
                }
                else {
                    // We've reached the end of the path, stay here (pile up)
                    this.rallyPoint = rallyTarget;
                    this.hasReachedFinalWaypoint = true;
                    return;
                }
            }
            else {
                // Set rally point to current waypoint
                this.rallyPoint = rallyTarget;
            }
        }
        else {
            // No path defined, fall back to original AI behavior
            // No need to update exploration timer here, it's updated in the main update loop
            // AI behavior: prioritize enemy base, then buildings, then explore
            let targetPosition = null;
            let targetRadiusPx = null;
            // 1. Try to target enemy base if visible
            for (const enemy of enemies) {
                if (enemy instanceof StellarForge && enemy.owner !== this.owner) {
                    // Check if enemy base is visible (not in shadow)
                    if (gameState.isObjectVisibleToPlayer(enemy.position, this.owner)) {
                        targetPosition = enemy.position;
                        targetRadiusPx = enemy.radius;
                        break;
                    }
                }
            }
            // 2. If no visible enemy base, target visible enemy buildings (mirrors)
            if (!targetPosition) {
                for (const player of gameState.players) {
                    if (player !== this.owner) {
                        for (const mirror of player.solarMirrors) {
                            if (gameState.isObjectVisibleToPlayer(mirror.position, this.owner)) {
                                targetPosition = mirror.position;
                                break;
                            }
                        }
                        if (targetPosition)
                            break;
                    }
                }
            }
            // 3. If no visible structures, explore shadows randomly
            if (!targetPosition) {
                // Generate new random exploration target every few seconds or if we've reached current target
                if (this.explorationTimer <= 0 || !this.explorationTarget ||
                    this.position.distanceTo(this.explorationTarget) < Constants.UNIT_ARRIVAL_THRESHOLD) {
                    // Pick a random position in shadow
                    const rng = getGameRNG();
                    const angle = rng.nextAngle();
                    const distance = rng.nextFloat(300, 800);
                    this.explorationTarget = new Vector2D(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
                    this.explorationTimer = Constants.STARLING_EXPLORATION_CHANGE_INTERVAL;
                }
                targetPosition = this.explorationTarget;
            }
            // Set rally point for movement
            if (targetPosition) {
                if (targetRadiusPx) {
                    this.rallyPoint = this.getStructureStandoffPoint(targetPosition, targetRadiusPx);
                }
                else {
                    this.rallyPoint = targetPosition;
                }
            }
        }
    }
    getStandoffPointForWaypoint(gameState, waypoint) {
        for (const player of gameState.players) {
            if (player.stellarForge) {
                const forgeDistance = waypoint.distanceTo(player.stellarForge.position);
                if (forgeDistance < player.stellarForge.radius + this.collisionRadiusPx) {
                    return this.getStructureStandoffPoint(player.stellarForge.position, player.stellarForge.radius);
                }
            }
            for (const building of player.buildings) {
                const buildingDistance = waypoint.distanceTo(building.position);
                if (buildingDistance < building.radius + this.collisionRadiusPx) {
                    return this.getStructureStandoffPoint(building.position, building.radius);
                }
            }
        }
        return null;
    }
    getGroupStopRadiusPx(allUnits) {
        let stoppedCount = 0;
        for (let i = 0; i < allUnits.length; i++) {
            const otherUnit = allUnits[i];
            if (!(otherUnit instanceof Starling) || otherUnit.owner !== this.owner || otherUnit.isDead()) {
                continue;
            }
            if (otherUnit.pathHash !== this.pathHash || !otherUnit.hasReachedFinalWaypoint) {
                continue;
            }
            stoppedCount += 1;
        }
        return Constants.STARLING_GROUP_STOP_BASE_RADIUS_PX +
            Constants.STARLING_GROUP_STOP_SPACING_PX * Math.sqrt(stoppedCount);
    }
    /**
     * Override moveTowardRallyPoint to implement group stopping behavior
     * Starlings at their final waypoint stop within an expanding radius based on how many groupmates have arrived
     */
    moveTowardRallyPoint(deltaTime, moveSpeed, allUnits, asteroids = []) {
        // Check if we should stop based on group arrival radius at the final waypoint
        // This only applies when we're heading to the final waypoint (not intermediate waypoints)
        if (this.assignedPath.length > 0 &&
            this.currentPathWaypointIndex === this.assignedPath.length - 1 &&
            !this.hasReachedFinalWaypoint &&
            this.rallyPoint !== null) {
            const stopRadiusPx = this.getGroupStopRadiusPx(allUnits);
            const distanceToRally = this.position.distanceTo(this.rallyPoint);
            if (distanceToRally <= stopRadiusPx) {
                this.rallyPoint = null;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.hasReachedFinalWaypoint = true;
                return;
            }
        }
        // Call parent implementation for normal movement
        super.moveTowardRallyPoint(deltaTime, moveSpeed, allUnits, asteroids);
    }
    /**
     * Override update to use custom movement speed
     */
    update(deltaTime, enemies, allUnits = [], asteroids = []) {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        // Update ability cooldown
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= deltaTime;
        }
        // Update exploration timer
        this.explorationTimer -= deltaTime;
        if (this.owner.hasRegenUpgrade && this.owner.stellarForge && this.health < this.maxHealth) {
            const distanceToForge = this.position.distanceTo(this.owner.stellarForge.position);
            if (distanceToForge <= Constants.INFLUENCE_RADIUS) {
                this.health = Math.min(this.maxHealth, this.health + Constants.STARLING_REGEN_RATE_PER_SEC * deltaTime);
            }
        }
        if (this.owner.hasStrafeUpgrade) {
            this.currentMoveSpeedPxPerSec = Constants.STARLING_MOVE_SPEED;
        }
        else if (this.currentMoveSpeedPxPerSec < Constants.STARLING_MOVE_SPEED) {
            this.currentMoveSpeedPxPerSec = Math.min(Constants.STARLING_MOVE_SPEED, this.currentMoveSpeedPxPerSec + Constants.STARLING_MOVE_ACCELERATION_PX_PER_SEC * deltaTime);
        }
        this.moveTowardRallyPoint(deltaTime, this.currentMoveSpeedPxPerSec, allUnits, asteroids);
        // Use base class methods for targeting and attacking
        // Find target if don't have one or current target is dead
        if (!this.target || this.isTargetDead(this.target)) {
            this.target = this.findNearestEnemy(enemies);
        }
        // Attack if target in range and cooldown ready
        if (this.target && this.attackCooldown <= 0) {
            const distance = this.position.distanceTo(this.target.position);
            if (distance <= this.attackRange) {
                this.attack(this.target);
                this.attackCooldown = 1.0 / this.attackSpeed;
            }
        }
    }
    getAttackDamage() {
        return this.attackDamage + (this.owner.hasAttackUpgrade ? Constants.STARLING_ATTACK_UPGRADE_BONUS : 0);
    }
    attack(target) {
        const attackDamage = this.getAttackDamage();
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) {
            return;
        }
        let finalDamage = attackDamage;
        if (target instanceof StellarForge) {
            finalDamage = Math.max(0, attackDamage - Constants.STELLAR_FORGE_STARLING_DEFENSE);
        }
        // Create laser beam for visual effect
        const laserBeam = new LaserBeam(new Vector2D(this.position.x, this.position.y), new Vector2D(target.position.x, target.position.y), this.owner, finalDamage);
        this.lastShotLasers.push(laserBeam);
        // Deal instant damage to target
        if (target instanceof StellarForge) {
            target.health -= finalDamage;
        }
        else if ('takeDamage' in target) {
            target.takeDamage(finalDamage);
        }
        if (!this.owner.hasStrafeUpgrade) {
            this.currentMoveSpeedPxPerSec = 0;
        }
    }
}
