"use strict";
/**
 * Solar Mirror - Reflects light from suns to structures
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolarMirror = void 0;
const math_1 = require("../math");
const Constants = __importStar(require("../../constants"));
class SolarMirror {
    constructor(position, owner) {
        this.position = position;
        this.owner = owner;
        this.health = Constants.MIRROR_MAX_HEALTH;
        this.maxHealth = Constants.MIRROR_MAX_HEALTH;
        this.efficiency = 1.0; // 0.0 to 1.0
        this.isSelected = false;
        this.linkedStructure = null;
        this.targetPosition = null;
        this.velocity = new math_1.Vector2D(0, 0);
        this.knockbackVelocity = new math_1.Vector2D(0, 0); // Velocity from asteroid rotation knockback
        this.reflectionAngle = 0; // Angle in radians for the flat surface rotation
        this.closestSunDistance = Infinity; // Distance to closest visible sun
        this.moveOrder = 0; // Movement order indicator (0 = no order)
        // Pathfinding waypoints for obstacle avoidance
        this.waypoints = [];
        this.finalTarget = null;
        // Movement constants for mirrors (slower than Stellar Forge)
        this.MAX_SPEED = 50; // Pixels per second - slower than forge
        this.ACCELERATION = 25; // Pixels per second squared
        this.DECELERATION = 50; // Pixels per second squared
        this.ARRIVAL_THRESHOLD = 2; // Distance to consider arrived at target
        this.SLOW_RADIUS_PX = 60; // Distance to begin slow approach
        this.AVOIDANCE_BLEND_FACTOR = 0.6; // How much to blend avoidance with direct path
        this.ROTATION_SPEED_RAD_PER_SEC = Math.PI * 0.25; // Radians per second
        this.ROTATION_SNAP_THRESHOLD_RAD = 0.01; // Snap when nearly aligned
        // Pathfinding constants
        this.MAX_PATHFINDING_ITERATIONS = 5; // Maximum iterations for waypoint generation
        this.ASTEROID_CLEARANCE = 20; // Extra clearance for asteroids (matches original reactive avoidance)
        this.BUILDING_CLEARANCE = 20; // Extra clearance for buildings (matches original reactive avoidance)
        this.SUN_CLEARANCE = 30; // Extra clearance for suns (matches original reactive avoidance)
        this.FORGE_CLEARANCE = 30; // Extra clearance for stellar forges (matches original reactive avoidance)
        this.WAYPOINT_CLEARANCE_MULTIPLIER = 1.2; // Multiplier for waypoint clearance
        this.REACTIVE_AVOIDANCE_RANGE = 60; // Look ahead distance for reactive avoidance
    }
    /**
     * Check if ray from mirror to target is blocked by asteroids
     * Helper method to avoid code duplication
     */
    isPathClear(target, asteroids = []) {
        const direction = new math_1.Vector2D(target.x - this.position.x, target.y - this.position.y).normalize();
        const ray = new math_1.LightRay(this.position, direction);
        const distance = this.position.distanceTo(target);
        for (const asteroid of asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distance) {
                return false; // Path is blocked
            }
        }
        return true; // Path is clear
    }
    isCircleBlockingRay(direction, distanceToTarget, circlePosition, circleRadius) {
        const toCircleX = circlePosition.x - this.position.x;
        const toCircleY = circlePosition.y - this.position.y;
        const projection = toCircleX * direction.x + toCircleY * direction.y;
        if (projection <= 0 || projection >= distanceToTarget) {
            return false;
        }
        const closestX = this.position.x + direction.x * projection;
        const closestY = this.position.y + direction.y * projection;
        const offsetX = circlePosition.x - closestX;
        const offsetY = circlePosition.y - closestY;
        const distanceSq = offsetX * offsetX + offsetY * offsetY;
        return distanceSq <= circleRadius * circleRadius;
    }
    /**
     * Check if mirror has clear view of any light source
     * Returns true if at least one sun is visible
     */
    hasLineOfSightToLight(lightSources, asteroids = []) {
        for (const sun of lightSources) {
            if (this.isPathClear(sun.position, asteroids)) {
                return true; // Found at least one clear path to a sun
            }
        }
        return false;
    }
    /**
     * Check if mirror has clear path to Stellar Forge
     * Returns true if path is not blocked by asteroids
     */
    hasLineOfSightToForge(forge, asteroids = [], players = []) {
        return this.hasLineOfSightToStructure(forge, asteroids, players);
    }
    hasLineOfSightToStructure(structure, asteroids = [], players = []) {
        const direction = new math_1.Vector2D(structure.position.x - this.position.x, structure.position.y - this.position.y).normalize();
        const distanceToStructure = this.position.distanceTo(structure.position);
        const ray = new math_1.LightRay(this.position, direction);
        for (const asteroid of asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distanceToStructure) {
                return false;
            }
        }
        const mirrorRadiusPx = 20;
        for (const player of players) {
            // Skip mirror-to-mirror blocking checks as mirrors are transparent to each other's light rays
            for (const building of player.buildings) {
                if (building === structure)
                    continue;
                if (this.isCircleBlockingRay(direction, distanceToStructure, building.position, building.radius)) {
                    return false;
                }
            }
            if (player.stellarForge && player.stellarForge !== structure) {
                if (this.isCircleBlockingRay(direction, distanceToStructure, player.stellarForge.position, player.stellarForge.radius)) {
                    return false;
                }
            }
            // Check warp gates (don't block if it's our target)
            // WarpGates use WARP_GATE_RADIUS constant for collision checking
        }
        return true;
    }
    /**
     * Get the closest visible sun (for visual indicators)
     */
    getClosestVisibleSun(lightSources, asteroids = []) {
        let closestSun = null;
        let closestDistance = Infinity;
        for (const sun of lightSources) {
            if (this.isPathClear(sun.position, asteroids)) {
                const distance = this.position.distanceTo(sun.position);
                if (distance < closestDistance) {
                    closestSun = sun;
                    closestDistance = distance;
                }
            }
        }
        return closestSun;
    }
    /**
     * Get the closest sun regardless of line of sight
     */
    getClosestSun(lightSources) {
        let closestSun = null;
        let closestDistance = Infinity;
        for (const sun of lightSources) {
            const distance = this.position.distanceTo(sun.position);
            if (distance < closestDistance) {
                closestSun = sun;
                closestDistance = distance;
            }
        }
        return closestSun;
    }
    /**
     * Generate Energy based on light received and distance to closest sun
     */
    generateEnergy(deltaTime) {
        return this.getEnergyRatePerSec() * deltaTime;
    }
    /**
     * Get energy generation rate per second
     */
    getEnergyRatePerSec() {
        const baseGenerationRatePerSec = 10.0;
        // Apply distance-based multiplier (closer = more efficient)
        // At distance 0: MIRROR_PROXIMITY_MULTIPLIER, at MIRROR_MAX_GLOW_DISTANCE: 1x multiplier
        const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER - (this.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE));
        return baseGenerationRatePerSec * this.efficiency * distanceMultiplier;
    }
    /**
     * Find obstacles blocking the direct path from start to end
     * Returns the first blocking obstacle found, or null if path is clear
     */
    findBlockingObstacle(start, end, gameState) {
        if (!gameState)
            return null;
        const direction = new math_1.Vector2D(end.x - start.x, end.y - start.y);
        const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (distance < 0.1)
            return null;
        direction.x /= distance;
        direction.y /= distance;
        // Check asteroids
        for (const asteroid of gameState.asteroids) {
            const ray = new math_1.LightRay(start, direction);
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distance) {
                return { type: 'asteroid', obstacle: asteroid };
            }
        }
        // Check buildings
        for (const player of gameState.players) {
            for (const building of player.buildings) {
                if (this.isCircleBlockingRay(direction, distance, building.position, building.radius + this.BUILDING_CLEARANCE)) {
                    return { type: 'building', obstacle: building };
                }
            }
            // Check stellar forge
            if (player.stellarForge) {
                const forge = player.stellarForge;
                if (this.isCircleBlockingRay(direction, distance, forge.position, forge.radius + this.FORGE_CLEARANCE)) {
                    return { type: 'forge', obstacle: forge };
                }
            }
        }
        // Check suns
        for (const sun of gameState.suns) {
            if (this.isCircleBlockingRay(direction, distance, sun.position, sun.radius + this.SUN_CLEARANCE)) {
                return { type: 'sun', obstacle: sun };
            }
        }
        return null;
    }
    /**
     * Generate waypoints to navigate around an obstacle
     */
    generateWaypointsAroundObstacle(start, end, obstacleInfo) {
        const obstacle = obstacleInfo.obstacle;
        let obstaclePos;
        let obstacleRadius;
        // Get obstacle position and radius
        if (obstacleInfo.type === 'asteroid') {
            obstaclePos = obstacle.position;
            obstacleRadius = obstacle.size + this.ASTEROID_CLEARANCE;
        }
        else {
            obstaclePos = obstacle.position;
            obstacleRadius = obstacle.radius + this.BUILDING_CLEARANCE;
        }
        // Vector from obstacle to start
        const toStartX = start.x - obstaclePos.x;
        const toStartY = start.y - obstaclePos.y;
        // Vector from obstacle to end
        const toEndX = end.x - obstaclePos.x;
        const toEndY = end.y - obstaclePos.y;
        // Calculate perpendicular offsets (left and right of obstacle)
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const toMidX = midX - obstaclePos.x;
        const toMidY = midY - obstaclePos.y;
        const toMidDist = Math.sqrt(toMidX * toMidX + toMidY * toMidY);
        if (toMidDist < 0.1)
            return []; // Shouldn't happen, but safety check
        // Get perpendicular direction
        const perpX = -toMidY / toMidDist;
        const perpY = toMidX / toMidDist;
        // Create two candidate waypoints (left and right of obstacle)
        const clearance = obstacleRadius * this.WAYPOINT_CLEARANCE_MULTIPLIER;
        const waypoint1 = new math_1.Vector2D(obstaclePos.x + perpX * clearance, obstaclePos.y + perpY * clearance);
        const waypoint2 = new math_1.Vector2D(obstaclePos.x - perpX * clearance, obstaclePos.y - perpY * clearance);
        // Choose the waypoint that results in a shorter total path
        const dist1 = start.distanceTo(waypoint1) + waypoint1.distanceTo(end);
        const dist2 = start.distanceTo(waypoint2) + waypoint2.distanceTo(end);
        return dist1 < dist2 ? [waypoint1] : [waypoint2];
    }
    /**
     * Compute path with waypoints to avoid obstacles
     */
    computePathWithWaypoints(target, gameState) {
        this.waypoints = [];
        this.finalTarget = target;
        if (!gameState) {
            this.targetPosition = target;
            return;
        }
        let currentStart = this.position;
        let currentEnd = target;
        const maxIterations = this.MAX_PATHFINDING_ITERATIONS;
        let iteration = 0;
        while (iteration < maxIterations) {
            const blockingObstacle = this.findBlockingObstacle(currentStart, currentEnd, gameState);
            if (!blockingObstacle) {
                // Path is clear to target
                break;
            }
            // Generate waypoint to go around obstacle
            const newWaypoints = this.generateWaypointsAroundObstacle(currentStart, currentEnd, blockingObstacle);
            if (newWaypoints.length > 0) {
                this.waypoints.push(...newWaypoints);
                currentStart = newWaypoints[newWaypoints.length - 1];
            }
            else {
                // Couldn't generate waypoint, just try direct path
                break;
            }
            iteration++;
        }
        // Set first waypoint or final target as current target
        if (this.waypoints.length > 0) {
            this.targetPosition = this.waypoints[0];
        }
        else {
            this.targetPosition = target;
        }
    }
    /**
     * Set target position for mirror movement with pathfinding
     */
    setTarget(target, gameState = null) {
        this.computePathWithWaypoints(target, gameState);
    }
    setLinkedStructure(structure) {
        this.linkedStructure = structure;
    }
    getLinkedStructure(fallbackForge) {
        var _a;
        return (_a = this.linkedStructure) !== null && _a !== void 0 ? _a : fallbackForge;
    }
    /**
     * Update mirror reflection angle based on closest sun and linked structure
     */
    updateReflectionAngle(structure, suns, asteroids = [], deltaTime) {
        if (!structure)
            return;
        const closestSun = this.getClosestVisibleSun(suns, asteroids);
        if (!closestSun) {
            this.closestSunDistance = Infinity;
            return;
        }
        // Store distance to closest sun for brightness and generation calculations
        this.closestSunDistance = this.position.distanceTo(closestSun.position);
        // Calculate the reflection angle as if reflecting light from sun to forge
        // The mirror surface should be perpendicular to the bisector of sun-mirror-forge angle
        const sunDirection = new math_1.Vector2D(closestSun.position.x - this.position.x, closestSun.position.y - this.position.y).normalize();
        const forgeDirection = new math_1.Vector2D(structure.position.x - this.position.x, structure.position.y - this.position.y).normalize();
        // The bisector direction (average of both directions)
        const bisectorX = sunDirection.x + forgeDirection.x;
        const bisectorY = sunDirection.y + forgeDirection.y;
        // The mirror surface should be perpendicular to the bisector
        // So we rotate by 90 degrees
        const bisectorLength = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY);
        const bisectorAngle = bisectorLength > 0
            ? Math.atan2(bisectorY, bisectorX)
            : Math.atan2(sunDirection.y, sunDirection.x);
        const targetReflectionAngle = bisectorAngle + Math.PI / 2;
        const angleDelta = this.getShortestAngleDelta(this.reflectionAngle, targetReflectionAngle);
        const maxStep = this.ROTATION_SPEED_RAD_PER_SEC * deltaTime;
        if (Math.abs(angleDelta) <= Math.max(this.ROTATION_SNAP_THRESHOLD_RAD, maxStep)) {
            this.reflectionAngle = targetReflectionAngle;
        }
        else {
            this.reflectionAngle += Math.sign(angleDelta) * maxStep;
        }
    }
    getShortestAngleDelta(currentAngle, targetAngle) {
        let delta = targetAngle - currentAngle;
        while (delta > Math.PI) {
            delta -= Math.PI * 2;
        }
        while (delta < -Math.PI) {
            delta += Math.PI * 2;
        }
        return delta;
    }
    /**
     * Update mirror position based on target and velocity with obstacle avoidance
     */
    update(deltaTime, gameState = null) {
        if (!this.targetPosition) {
            // Still apply and decelerate knockback velocity even when not moving
            this.position.x += this.knockbackVelocity.x * deltaTime;
            this.position.y += this.knockbackVelocity.y * deltaTime;
            const knockbackSpeed = Math.sqrt(Math.pow(this.knockbackVelocity.x, 2) + Math.pow(this.knockbackVelocity.y, 2));
            if (knockbackSpeed > 0) {
                const deceleration = Constants.ASTEROID_ROTATION_KNOCKBACK_DECELERATION * deltaTime;
                if (knockbackSpeed <= deceleration) {
                    this.knockbackVelocity.x = 0;
                    this.knockbackVelocity.y = 0;
                }
                else {
                    const decelerationFactor = (knockbackSpeed - deceleration) / knockbackSpeed;
                    this.knockbackVelocity.x *= decelerationFactor;
                    this.knockbackVelocity.y *= decelerationFactor;
                }
            }
            return;
        }
        if (gameState) {
            // Check if current target is inside an asteroid (shouldn't happen with pathfinding, but safety check)
            for (const asteroid of gameState.asteroids) {
                if (asteroid.containsPoint(this.targetPosition)) {
                    // Clear entire path if target is invalid
                    this.targetPosition = null;
                    this.finalTarget = null;
                    this.waypoints = [];
                    this.velocity = new math_1.Vector2D(0, 0);
                    return;
                }
            }
        }
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        // If we're close enough to current target (waypoint or final target)
        if (distanceToTarget < this.ARRIVAL_THRESHOLD) {
            // Check if there are more waypoints to navigate through
            if (this.waypoints.length > 0) {
                // Remove the waypoint we just reached
                this.waypoints.shift();
                // Set next waypoint or final target
                if (this.waypoints.length > 0) {
                    this.targetPosition = this.waypoints[0];
                }
                else if (this.finalTarget) {
                    this.targetPosition = this.finalTarget;
                    this.finalTarget = null;
                }
                else {
                    // Reached final destination
                    this.position = this.targetPosition;
                    this.targetPosition = null;
                    this.velocity = new math_1.Vector2D(0, 0);
                }
                return;
            }
            else {
                // No more waypoints, reached final destination
                this.position = this.targetPosition;
                this.targetPosition = null;
                this.finalTarget = null;
                this.velocity = new math_1.Vector2D(0, 0);
                return;
            }
        }
        // Calculate desired direction
        let directionX = dx / distanceToTarget;
        let directionY = dy / distanceToTarget;
        // Add obstacle avoidance if gameState is provided
        if (gameState) {
            const avoidanceDir = this.calculateObstacleAvoidance(gameState);
            if (avoidanceDir) {
                directionX += avoidanceDir.x * this.AVOIDANCE_BLEND_FACTOR;
                directionY += avoidanceDir.y * this.AVOIDANCE_BLEND_FACTOR;
                const length = Math.sqrt(directionX * directionX + directionY * directionY);
                if (length > 0) {
                    directionX /= length;
                    directionY /= length;
                }
            }
        }
        if (distanceToTarget <= this.SLOW_RADIUS_PX) {
            const slowFactor = Math.max(0, distanceToTarget / this.SLOW_RADIUS_PX);
            const desiredSpeed = this.MAX_SPEED * slowFactor;
            this.velocity.x = directionX * desiredSpeed;
            this.velocity.y = directionY * desiredSpeed;
        }
        else {
            // Calculate distance needed to decelerate to stop
            const currentSpeed = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
            const decelerationDistance = (currentSpeed * currentSpeed) / (2 * this.DECELERATION);
            // Should we accelerate or decelerate?
            if (distanceToTarget > decelerationDistance && currentSpeed < this.MAX_SPEED) {
                // Accelerate toward target
                this.velocity.x += directionX * this.ACCELERATION * deltaTime;
                this.velocity.y += directionY * this.ACCELERATION * deltaTime;
            }
            else {
                // Decelerate - improved deceleration to prevent overshooting
                if (currentSpeed > 0.1) {
                    const decelerationAmount = this.DECELERATION * deltaTime;
                    const decelerationFactor = Math.max(0, (currentSpeed - decelerationAmount) / currentSpeed);
                    this.velocity.x *= decelerationFactor;
                    this.velocity.y *= decelerationFactor;
                }
                else {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                }
            }
            // Cap speed at MAX_SPEED
            const speed = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
            if (speed > this.MAX_SPEED) {
                this.velocity.x = (this.velocity.x / speed) * this.MAX_SPEED;
                this.velocity.y = (this.velocity.y / speed) * this.MAX_SPEED;
            }
        }
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        // Apply knockback velocity from asteroid rotation
        this.position.x += this.knockbackVelocity.x * deltaTime;
        this.position.y += this.knockbackVelocity.y * deltaTime;
        // Decelerate knockback velocity
        const knockbackSpeed = Math.sqrt(Math.pow(this.knockbackVelocity.x, 2) + Math.pow(this.knockbackVelocity.y, 2));
        if (knockbackSpeed > 0) {
            const deceleration = Constants.ASTEROID_ROTATION_KNOCKBACK_DECELERATION * deltaTime;
            if (knockbackSpeed <= deceleration) {
                this.knockbackVelocity.x = 0;
                this.knockbackVelocity.y = 0;
            }
            else {
                const decelerationFactor = (knockbackSpeed - deceleration) / knockbackSpeed;
                this.knockbackVelocity.x *= decelerationFactor;
                this.knockbackVelocity.y *= decelerationFactor;
            }
        }
    }
    /**
     * Calculate obstacle avoidance direction for smooth pathfinding
     */
    calculateObstacleAvoidance(gameState) {
        let avoidX = 0;
        let avoidY = 0;
        let avoidCount = 0;
        const avoidanceRange = this.REACTIVE_AVOIDANCE_RANGE;
        // Check asteroids (approximate with radius)
        for (const asteroid of gameState.asteroids) {
            const dx = this.position.x - asteroid.position.x;
            const dy = this.position.y - asteroid.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = asteroid.size + this.ASTEROID_CLEARANCE;
            if (dist > 0 && dist < minDist + avoidanceRange) {
                const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                avoidX += (dx / dist) * avoidStrength;
                avoidY += (dy / dist) * avoidStrength;
                avoidCount++;
            }
        }
        // Check nearby obstacles
        for (const sun of gameState.suns) {
            const dx = this.position.x - sun.position.x;
            const dy = this.position.y - sun.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = sun.radius + this.SUN_CLEARANCE;
            if (dist < minDist + avoidanceRange) {
                const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                avoidX += (dx / dist) * avoidStrength;
                avoidY += (dy / dist) * avoidStrength;
                avoidCount++;
            }
        }
        // Check other mirrors (avoid colliding with friendly mirrors)
        for (const player of gameState.players) {
            for (const mirror of player.solarMirrors) {
                if (mirror === this)
                    continue;
                const dx = this.position.x - mirror.position.x;
                const dy = this.position.y - mirror.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = 40; // 20 + 20 for two mirrors
                if (dist < minDist + avoidanceRange && dist > 0) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }
            // Check stellar forges
            if (player.stellarForge) {
                const forge = player.stellarForge;
                const dx = this.position.x - forge.position.x;
                const dy = this.position.y - forge.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = forge.radius + this.FORGE_CLEARANCE;
                if (dist < minDist + avoidanceRange) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }
            // Check buildings
            for (const building of player.buildings) {
                const dx = this.position.x - building.position.x;
                const dy = this.position.y - building.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = building.radius + this.BUILDING_CLEARANCE;
                if (dist < minDist + avoidanceRange) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }
        }
        if (avoidCount > 0) {
            const length = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
            if (length > 0) {
                return new math_1.Vector2D(avoidX / length, avoidY / length);
            }
        }
        return null;
    }
    /**
     * Take damage
     */
    takeDamage(amount) {
        this.health -= amount;
    }
    /**
     * Check if a point is within the mirror's clickable area
     */
    containsPoint(point) {
        const distance = this.position.distanceTo(point);
        return distance < Constants.MIRROR_CLICK_RADIUS_PX; // Match the rendering size
    }
}
exports.SolarMirror = SolarMirror;
