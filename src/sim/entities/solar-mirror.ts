/**
 * Solar Mirror - Reflects light from suns to structures
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import type { Sun } from './sun';
import type { Player } from './player';
import type { StellarForge } from './stellar-forge';
import type { Building } from './buildings';
import type { Asteroid } from './asteroid';
import type { GameState } from '../game-state';

export class SolarMirror {
    health: number = Constants.MIRROR_MAX_HEALTH;
    efficiency: number = 1.0; // 0.0 to 1.0
    isSelected: boolean = false;
    linkedStructure: StellarForge | Building | null = null;
    targetPosition: Vector2D | null = null;
    velocity: Vector2D = new Vector2D(0, 0);
    reflectionAngle: number = 0; // Angle in radians for the flat surface rotation
    closestSunDistance: number = Infinity; // Distance to closest visible sun
    moveOrder: number = 0; // Movement order indicator (0 = no order)

    // Movement constants for mirrors (slower than Stellar Forge)
    private readonly MAX_SPEED = 50; // Pixels per second - slower than forge
    private readonly ACCELERATION = 25; // Pixels per second squared
    private readonly DECELERATION = 50; // Pixels per second squared
    private readonly ARRIVAL_THRESHOLD = 2; // Distance to consider arrived at target
    private readonly SLOW_RADIUS_PX = 60; // Distance to begin slow approach
    private readonly AVOIDANCE_BLEND_FACTOR = 0.6; // How much to blend avoidance with direct path
    private readonly ROTATION_SPEED_RAD_PER_SEC = Math.PI; // Radians per second
    private readonly ROTATION_SNAP_THRESHOLD_RAD = 0.01; // Snap when nearly aligned

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Check if ray from mirror to target is blocked by asteroids
     * Helper method to avoid code duplication
     */
    private isPathClear(target: Vector2D, asteroids: Asteroid[] = []): boolean {
        const direction = new Vector2D(
            target.x - this.position.x,
            target.y - this.position.y
        ).normalize();
        
        const ray = new LightRay(this.position, direction);
        const distance = this.position.distanceTo(target);
        
        for (const asteroid of asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distance) {
                return false; // Path is blocked
            }
        }
        
        return true; // Path is clear
    }

    private isCircleBlockingRay(
        direction: Vector2D,
        distanceToTarget: number,
        circlePosition: Vector2D,
        circleRadius: number
    ): boolean {
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
    hasLineOfSightToLight(lightSources: Sun[], asteroids: Asteroid[] = []): boolean {
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
    hasLineOfSightToForge(
        forge: StellarForge,
        asteroids: Asteroid[] = [],
        players: Player[] = []
    ): boolean {
        return this.hasLineOfSightToStructure(forge, asteroids, players);
    }

    hasLineOfSightToStructure(
        structure: StellarForge | Building,
        asteroids: Asteroid[] = [],
        players: Player[] = []
    ): boolean {
        const direction = new Vector2D(
            structure.position.x - this.position.x,
            structure.position.y - this.position.y
        ).normalize();
        const distanceToStructure = this.position.distanceTo(structure.position);
        const ray = new LightRay(this.position, direction);

        for (const asteroid of asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distanceToStructure) {
                return false;
            }
        }

        const mirrorRadiusPx = 20;

        for (const player of players) {
            for (const mirror of player.solarMirrors) {
                if (mirror === this) continue;
                if (this.isCircleBlockingRay(direction, distanceToStructure, mirror.position, mirrorRadiusPx)) {
                    return false;
                }
            }

            for (const building of player.buildings) {
                if (building === structure) continue;
                if (this.isCircleBlockingRay(direction, distanceToStructure, building.position, building.radius)) {
                    return false;
                }
            }

            if (player.stellarForge && player.stellarForge !== structure) {
                if (this.isCircleBlockingRay(direction, distanceToStructure, player.stellarForge.position, player.stellarForge.radius)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Get the closest visible sun (for visual indicators)
     */
    getClosestVisibleSun(lightSources: Sun[], asteroids: Asteroid[] = []): Sun | null {
        let closestSun: Sun | null = null;
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
    getClosestSun(lightSources: Sun[]): Sun | null {
        let closestSun: Sun | null = null;
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
    generateEnergy(deltaTime: number): number {
        return this.getEnergyRatePerSec() * deltaTime;
    }

    /**
     * Get energy generation rate per second
     */
    getEnergyRatePerSec(): number {
        const baseGenerationRatePerSec = 10.0;

        // Apply distance-based multiplier (closer = more efficient)
        // At distance 0: MIRROR_PROXIMITY_MULTIPLIER, at MIRROR_MAX_GLOW_DISTANCE: 1x multiplier
        const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER - (this.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE));

        return baseGenerationRatePerSec * this.efficiency * distanceMultiplier;
    }

    /**
     * Set target position for mirror movement
     */
    setTarget(target: Vector2D): void {
        this.targetPosition = target;
    }

    setLinkedStructure(structure: StellarForge | Building | null): void {
        this.linkedStructure = structure;
    }

    getLinkedStructure(fallbackForge: StellarForge | null): StellarForge | Building | null {
        return this.linkedStructure ?? fallbackForge;
    }

    /**
     * Update mirror reflection angle based on closest sun and linked structure
     */
    updateReflectionAngle(
        structure: StellarForge | Building | null,
        suns: Sun[],
        asteroids: Asteroid[] = [],
        deltaTime: number
    ): void {
        if (!structure) return;
        
        const closestSun = this.getClosestVisibleSun(suns, asteroids);
        if (!closestSun) {
            this.closestSunDistance = Infinity;
            return;
        }
        
        // Store distance to closest sun for brightness and generation calculations
        this.closestSunDistance = this.position.distanceTo(closestSun.position);
        
        // Calculate the reflection angle as if reflecting light from sun to forge
        // The mirror surface should be perpendicular to the bisector of sun-mirror-forge angle
        const sunDirection = new Vector2D(
            closestSun.position.x - this.position.x,
            closestSun.position.y - this.position.y
        ).normalize();
        
        const forgeDirection = new Vector2D(
            structure.position.x - this.position.x,
            structure.position.y - this.position.y
        ).normalize();
        
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
        } else {
            this.reflectionAngle += Math.sign(angleDelta) * maxStep;
        }
    }

    private getShortestAngleDelta(currentAngle: number, targetAngle: number): number {
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
    update(deltaTime: number, gameState: GameState | null = null): void {
        if (!this.targetPosition) return;
        
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        
        // If we're close enough to target, stop smoothly
        if (distanceToTarget < this.ARRIVAL_THRESHOLD) {
            this.position = this.targetPosition;
            this.targetPosition = null;
            this.velocity = new Vector2D(0, 0);
            return;
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
        } else {
            // Calculate distance needed to decelerate to stop
            const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            const decelerationDistance = (currentSpeed * currentSpeed) / (2 * this.DECELERATION);
            
            // Should we accelerate or decelerate?
            if (distanceToTarget > decelerationDistance && currentSpeed < this.MAX_SPEED) {
                // Accelerate toward target
                this.velocity.x += directionX * this.ACCELERATION * deltaTime;
                this.velocity.y += directionY * this.ACCELERATION * deltaTime;
            } else {
                // Decelerate - improved deceleration to prevent overshooting
                if (currentSpeed > 0.1) {
                    const decelerationAmount = this.DECELERATION * deltaTime;
                    const decelerationFactor = Math.max(0, (currentSpeed - decelerationAmount) / currentSpeed);
                    this.velocity.x *= decelerationFactor;
                    this.velocity.y *= decelerationFactor;
                } else {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                }
            }
            
            // Cap speed at MAX_SPEED
            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (speed > this.MAX_SPEED) {
                this.velocity.x = (this.velocity.x / speed) * this.MAX_SPEED;
                this.velocity.y = (this.velocity.y / speed) * this.MAX_SPEED;
            }
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * Calculate obstacle avoidance direction for smooth pathfinding
     */
    private calculateObstacleAvoidance(gameState: GameState): Vector2D | null {
        let avoidX = 0;
        let avoidY = 0;
        let avoidCount = 0;
        const avoidanceRange = 60; // Look ahead distance

        // Check nearby obstacles
        for (const sun of gameState.suns) {
            const dx = this.position.x - sun.position.x;
            const dy = this.position.y - sun.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = sun.radius + 30;
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
                if (mirror === this) continue;
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
                const minDist = forge.radius + 30;
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
                return new Vector2D(avoidX / length, avoidY / length);
            }
        }

        return null;
    }

    /**
     * Check if a point is within the mirror's clickable area
     */
    containsPoint(point: Vector2D): boolean {
        const distance = this.position.distanceTo(point);
        return distance < 20; // Match the rendering size
    }
}
