/**
 * SoL (Speed of Light) - Core Game Module
 * A 2D real-time strategy game with light-based mechanics
 */

import * as Constants from './constants';

/**
 * Three playable factions in the game
 */
export enum Faction {
    RADIANT = "Radiant",
    AURUM = "Aurum",
    SOLARI = "Solari"
}

/**
 * 2D position/direction vector
 */
export class Vector2D {
    constructor(public x: number, public y: number) {}

    /**
     * Calculate distance to another vector
     */
    distanceTo(other: Vector2D): number {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    /**
     * Return normalized vector
     */
    normalize(): Vector2D {
        const magnitude = Math.sqrt(this.x ** 2 + this.y ** 2);
        if (magnitude === 0) {
            return new Vector2D(0, 0);
        }
        return new Vector2D(this.x / magnitude, this.y / magnitude);
    }
}

/**
 * Represents a ray of light for ray tracing
 */
export class LightRay {
    constructor(
        public origin: Vector2D,
        public direction: Vector2D,
        public intensity: number = 1.0
    ) {}

    /**
     * Check if ray intersects with a circular object
     */
    intersects(position: Vector2D, radius: number): boolean {
        // Ray-circle intersection using vector math
        const oc = new Vector2D(this.origin.x - position.x, this.origin.y - position.y);
        const a = this.direction.x * this.direction.x + this.direction.y * this.direction.y;
        const b = 2.0 * (oc.x * this.direction.x + oc.y * this.direction.y);
        const c = oc.x * oc.x + oc.y * oc.y - radius * radius;
        const discriminant = b * b - 4 * a * c;
        return discriminant >= 0;
    }

    /**
     * Check if ray intersects with a polygon and return the distance to the closest intersection
     */
    intersectsPolygon(vertices: Vector2D[]): boolean {
        // Check each edge of the polygon
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            
            if (this.intersectsLineSegment(v1, v2) !== null) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get the distance to the closest intersection with a polygon, or null if no intersection
     */
    getIntersectionDistance(vertices: Vector2D[]): number | null {
        let closestDistance: number | null = null;
        
        // Check each edge of the polygon
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            
            const distance = this.intersectsLineSegment(v1, v2);
            if (distance !== null) {
                if (closestDistance === null || distance < closestDistance) {
                    closestDistance = distance;
                }
            }
        }
        
        return closestDistance;
    }

    /**
     * Check if ray intersects with a line segment and return the distance, or null if no intersection
     */
    private intersectsLineSegment(p1: Vector2D, p2: Vector2D): number | null {
        const v1 = new Vector2D(p2.x - p1.x, p2.y - p1.y);
        const v2 = new Vector2D(p1.x - this.origin.x, p1.y - this.origin.y);
        const cross1 = this.direction.x * v1.y - this.direction.y * v1.x;
        
        if (Math.abs(cross1) < 0.0001) return null; // Parallel
        
        const t1 = (v2.x * v1.y - v2.y * v1.x) / cross1;
        const t2 = (v2.x * this.direction.y - v2.y * this.direction.x) / cross1;
        
        if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
            return t1; // Return the distance along the ray
        }
        
        return null;
    }
}

/**
 * Asteroid - Polygon obstacle that blocks light and casts shadows
 */
export class Asteroid {
    vertices: Vector2D[] = [];
    rotation: number = 0;
    rotationSpeed: number;

    constructor(
        public position: Vector2D,
        public sides: number, // 3-9 sides (triangle to nonagon)
        public size: number
    ) {
        this.generateVertices();
        this.rotationSpeed = (Math.random() - 0.5) * 0.5; // Random rotation speed
    }

    /**
     * Generate polygon vertices
     */
    private generateVertices(): void {
        this.vertices = [];
        for (let i = 0; i < this.sides; i++) {
            const angle = (Math.PI * 2 * i) / this.sides;
            // Add some randomness to make asteroids less uniform
            const radiusVariation = 0.8 + Math.random() * 0.4;
            const radius = this.size * radiusVariation;
            this.vertices.push(new Vector2D(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            ));
        }
    }

    /**
     * Get world-space vertices (with position and rotation)
     */
    getWorldVertices(): Vector2D[] {
        return this.vertices.map(v => {
            const cos = Math.cos(this.rotation);
            const sin = Math.sin(this.rotation);
            return new Vector2D(
                this.position.x + v.x * cos - v.y * sin,
                this.position.y + v.x * sin + v.y * cos
            );
        });
    }

    /**
     * Update asteroid rotation
     */
    update(deltaTime: number): void {
        this.rotation += this.rotationSpeed * deltaTime;
    }

    /**
     * Check if a point is inside the asteroid (for collision detection)
     */
    containsPoint(point: Vector2D): boolean {
        const worldVertices = this.getWorldVertices();
        let inside = false;
        
        for (let i = 0, j = worldVertices.length - 1; i < worldVertices.length; j = i++) {
            const xi = worldVertices[i].x, yi = worldVertices[i].y;
            const xj = worldVertices[j].x, yj = worldVertices[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
}

/**
 * Solar Mirror - reflects light to generate Energy
 */
export class SolarMirror {
    health: number = 100.0;
    efficiency: number = 1.0; // 0.0 to 1.0
    isSelected: boolean = false;
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
        const direction = new Vector2D(
            forge.position.x - this.position.x,
            forge.position.y - this.position.y
        ).normalize();
        const distanceToForge = this.position.distanceTo(forge.position);
        const ray = new LightRay(this.position, direction);

        for (const asteroid of asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distanceToForge) {
                return false;
            }
        }

        const mirrorRadiusPx = 20;

        for (const player of players) {
            for (const mirror of player.solarMirrors) {
                if (mirror === this) continue;
                if (this.isCircleBlockingRay(direction, distanceToForge, mirror.position, mirrorRadiusPx)) {
                    return false;
                }
            }

            for (const building of player.buildings) {
                if (this.isCircleBlockingRay(direction, distanceToForge, building.position, building.radius)) {
                    return false;
                }
            }

            if (player.stellarForge && player.stellarForge !== forge) {
                if (this.isCircleBlockingRay(direction, distanceToForge, player.stellarForge.position, player.stellarForge.radius)) {
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

    /**
     * Update mirror reflection angle based on closest sun and forge
     */
    updateReflectionAngle(forge: StellarForge | null, suns: Sun[], asteroids: Asteroid[] = [], deltaTime: number): void {
        if (!forge) return;
        
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
            forge.position.x - this.position.x,
            forge.position.y - this.position.y
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

/**
 * Stellar Forge - Main base that produces units
 */
export class StellarForge {
    health: number = 1000.0;
    isReceivingLight: boolean = false;
    unitQueue: string[] = [];
    heroProductionUnitType: string | null = null;
    heroProductionRemainingSec: number = 0;
    heroProductionDurationSec: number = 0;
    isSelected: boolean = false;
    targetPosition: Vector2D | null = null;
    velocity: Vector2D = new Vector2D(0, 0);
    private readonly maxSpeed: number = 50; // pixels per second
    private readonly acceleration: number = 30; // pixels per second^2
    private readonly deceleration: number = 50; // pixels per second^2
    private readonly slowRadiusPx: number = 80; // Distance to begin slow approach
    private readonly AVOIDANCE_BLEND_FACTOR = 0.6; // How much to blend avoidance with direct path
    readonly radius: number = 40; // For rendering and selection
    crunchTimer: number = 0; // Timer until next crunch
    currentCrunch: ForgeCrunch | null = null; // Active crunch effect
    pendingEnergy: number = 0; // Energy accumulated since last crunch
    minionPath: Vector2D[] = []; // Path that minions will follow
    moveOrder: number = 0; // Movement order indicator (0 = no order)
    rotation: number = 0; // Current rotation angle in radians

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {
        // Initialize crunch timer with random offset to stagger crunches
        this.crunchTimer = Math.random() * Constants.FORGE_CRUNCH_INTERVAL;
    }
    
    /**
     * Set the path for minions to follow
     */
    setMinionPath(waypoints: Vector2D[]): void {
        this.minionPath = waypoints.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
    }
    
    /**
     * Initialize default path to enemy base position
     */
    initializeDefaultPath(enemyBasePosition: Vector2D): void {
        // Create a path from this base to the enemy base
        this.minionPath = [new Vector2D(enemyBasePosition.x, enemyBasePosition.y)];
    }

    /**
     * Check if forge can produce units (needs light)
     */
    canProduceUnits(): boolean {
        return this.isReceivingLight && this.health > 0;
    }

    /**
     * Attempt to produce a unit
     */
    produceUnit(unitType: string, cost: number, playerEnergy: number): boolean {
        if (!this.canProduceUnits()) {
            return false;
        }
        if (playerEnergy < cost) {
            return false;
        }
        this.unitQueue.push(unitType);
        return true;
    }

    enqueueHeroUnit(unitType: string): void {
        this.unitQueue.push(unitType);
    }

    startHeroProductionIfIdle(): void {
        if (this.heroProductionUnitType || this.unitQueue.length === 0) {
            return;
        }
        const nextUnitType = this.unitQueue.shift();
        if (!nextUnitType) {
            return;
        }
        this.heroProductionUnitType = nextUnitType;
        this.heroProductionDurationSec = Constants.HERO_PRODUCTION_TIME_SEC;
        this.heroProductionRemainingSec = Constants.HERO_PRODUCTION_TIME_SEC;
    }

    advanceHeroProduction(deltaTime: number): string | null {
        this.startHeroProductionIfIdle();
        if (!this.heroProductionUnitType) {
            return null;
        }
        if (!this.canProduceUnits()) {
            return null;
        }
        this.heroProductionRemainingSec = Math.max(0, this.heroProductionRemainingSec - deltaTime);
        if (this.heroProductionRemainingSec > 0) {
            return null;
        }
        const completedUnitType = this.heroProductionUnitType;
        this.heroProductionUnitType = null;
        this.heroProductionDurationSec = 0;
        this.heroProductionRemainingSec = 0;
        return completedUnitType;
    }

    /**
     * Update whether forge is receiving light from mirrors
     */
    updateLightStatus(mirrors: SolarMirror[], suns: Sun[], asteroids: Asteroid[] = [], players: Player[] = []): void {
        this.isReceivingLight = false;
        for (const mirror of mirrors) {
            if (mirror.hasLineOfSightToLight(suns, asteroids) &&
                mirror.hasLineOfSightToForge(this, asteroids, players)) {
                this.isReceivingLight = true;
                break;
            }
        }
    }

    /**
     * Update forge movement and crunch effects with obstacle avoidance
     */
    update(deltaTime: number, gameState: GameState | null = null): void {
        // Update crunch timer
        if (this.health > 0 && this.isReceivingLight) {
            this.crunchTimer -= deltaTime;
        }

        // Update active crunch effect
        if (this.currentCrunch) {
            this.currentCrunch.update(deltaTime);
            if (!this.currentCrunch.isActive()) {
                this.currentCrunch = null;
            }
        }

        if (!this.targetPosition) {
            // No target, apply deceleration
            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (speed > 0.1) {
                const decelAmount = this.deceleration * deltaTime;
                const factor = Math.max(0, (speed - decelAmount) / speed);
                this.velocity.x *= factor;
                this.velocity.y *= factor;
            } else {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        } else {
            // Moving toward target
            const dx = this.targetPosition.x - this.position.x;
            const dy = this.targetPosition.y - this.position.y;
            const distanceToTarget = Math.sqrt(dx ** 2 + dy ** 2);

            if (distanceToTarget < 5) {
                // Reached target
                this.position.x = this.targetPosition.x;
                this.position.y = this.targetPosition.y;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.targetPosition = null;
            } else {
                // Calculate desired velocity direction
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

                if (distanceToTarget <= this.slowRadiusPx) {
                    const slowFactor = Math.max(0, distanceToTarget / this.slowRadiusPx);
                    const desiredSpeed = this.maxSpeed * slowFactor;
                    this.velocity.x = directionX * desiredSpeed;
                    this.velocity.y = directionY * desiredSpeed;
                } else {
                    // Apply acceleration toward target
                    this.velocity.x += directionX * this.acceleration * deltaTime;
                    this.velocity.y += directionY * this.acceleration * deltaTime;

                    // Clamp to max speed
                    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
                    if (currentSpeed > this.maxSpeed) {
                        this.velocity.x = (this.velocity.x / currentSpeed) * this.maxSpeed;
                        this.velocity.y = (this.velocity.y / currentSpeed) * this.maxSpeed;
                    }
                }
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
        const avoidanceRange = 80; // Look ahead distance

        // Check nearby obstacles
        for (const sun of gameState.suns) {
            const dx = this.position.x - sun.position.x;
            const dy = this.position.y - sun.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = sun.radius + this.radius + 10;
            if (dist < minDist + avoidanceRange) {
                const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                avoidX += (dx / dist) * avoidStrength;
                avoidY += (dy / dist) * avoidStrength;
                avoidCount++;
            }
        }

        // Check other forges and mirrors
        for (const player of gameState.players) {
            // Check other stellar forges
            if (player.stellarForge && player.stellarForge !== this) {
                const forge = player.stellarForge;
                const dx = this.position.x - forge.position.x;
                const dy = this.position.y - forge.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.radius + forge.radius + 10;
                if (dist < minDist + avoidanceRange && dist > 0) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }

            // Check mirrors
            for (const mirror of player.solarMirrors) {
                const dx = this.position.x - mirror.position.x;
                const dy = this.position.y - mirror.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.radius + 30;
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
     * Check if a crunch should happen and trigger it if ready
     * Returns the amount of energy to use for spawning minions
     */
    shouldCrunch(): number {
        if (this.crunchTimer <= 0 && this.health > 0 && this.isReceivingLight) {
            this.crunchTimer = Constants.FORGE_CRUNCH_INTERVAL;
            this.currentCrunch = new ForgeCrunch(new Vector2D(this.position.x, this.position.y));
            this.currentCrunch.start();
            
            // Rotate forge by 1/6 turn (60 degrees = π/3 radians)
            this.rotation += Math.PI / 3;
            // Keep rotation within 0 to 2π
            if (this.rotation >= Math.PI * 2) {
                this.rotation -= Math.PI * 2;
            }
            
            // Return the pending energy for minion spawning
            const energyForMinions = this.pendingEnergy;
            this.pendingEnergy = 0;
            return energyForMinions;
        }
        return 0;
    }

    /**
     * Add energy to pending amount (called when mirrors generate energy)
     */
    addPendingEnergy(amount: number): void {
        this.pendingEnergy += amount;
    }

    /**
     * Get the current crunch effect if active
     */
    getCurrentCrunch(): ForgeCrunch | null {
        return this.currentCrunch;
    }

    /**
     * Set movement target
     */
    setTarget(target: Vector2D): void {
        this.targetPosition = new Vector2D(target.x, target.y);
    }

    /**
     * Toggle selection state
     */
    toggleSelection(): void {
        this.isSelected = !this.isSelected;
    }

    /**
     * Check if a point is inside the forge (for click detection)
     */
    containsPoint(point: Vector2D): boolean {
        const distance = this.position.distanceTo(point);
        return distance <= this.radius;
    }
}

/**
 * Base class for all buildings
 */
export class Building {
    health: number;
    maxHealth: number;
    attackCooldown: number = 0;
    target: Unit | StellarForge | Building | null = null;
    buildProgress: number = 0; // 0 to 1, building is complete at 1
    isComplete: boolean = false;
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        maxHealth: number,
        public radius: number,
        public attackRange: number,
        public attackDamage: number,
        public attackSpeed: number // attacks per second
    ) {
        this.health = maxHealth;
        this.maxHealth = maxHealth;
    }

    /**
     * Update building logic
     */
    update(
        deltaTime: number,
        enemies: (Unit | StellarForge | Building)[],
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Only attack if building is complete
        if (!this.isComplete) {
            return;
        }

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

    /**
     * Check if target is dead
     */
    protected isTargetDead(target: Unit | StellarForge | Building): boolean {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }

    /**
     * Find nearest enemy
     */
    protected findNearestEnemy(enemies: (Unit | StellarForge | Building)[]): Unit | StellarForge | Building | null {
        let nearest: Unit | StellarForge | Building | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if ('health' in enemy && enemy.health <= 0) continue;
            
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
    attack(target: Unit | StellarForge | Building): void {
        // Base implementation
        if ('health' in target) {
            target.health -= this.attackDamage;
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount: number): void {
        this.health -= amount;
    }

    /**
     * Check if building is destroyed
     */
    isDestroyed(): boolean {
        return this.health <= 0;
    }

    /**
     * Add build progress (from energy or mirror light)
     */
    addBuildProgress(amount: number): void {
        if (this.isComplete) return;
        
        this.buildProgress += amount;
        if (this.buildProgress >= 1.0) {
            this.buildProgress = 1.0;
            this.isComplete = true;
        }
    }
}

/**
 * Minigun Building - Offensive building for Radiant faction
 * Fast-shooting defensive turret with visual effects like Marine
 */
export class Minigun extends Building {
    private lastShotEffects: { 
        muzzleFlash?: MuzzleFlash, 
        casing?: BulletCasing, 
        bouncingBullet?: BouncingBullet 
    } = {};

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.MINIGUN_MAX_HEALTH,
            Constants.MINIGUN_RADIUS,
            Constants.MINIGUN_ATTACK_RANGE,
            Constants.MINIGUN_ATTACK_DAMAGE,
            Constants.MINIGUN_ATTACK_SPEED
        );
    }

    /**
     * Attack with visual effects like Marine
     */
    attack(target: Unit | StellarForge | Building): void {
        // Apply damage
        super.attack(target);

        // Calculate angle to target
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const angle = Math.atan2(dy, dx);

        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = new MuzzleFlash(
            new Vector2D(this.position.x, this.position.y),
            angle
        );

        // Create bullet casing with slight angle deviation
        const casingAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const casingSpeed = Constants.BULLET_CASING_SPEED_MIN + 
                           Math.random() * (Constants.BULLET_CASING_SPEED_MAX - Constants.BULLET_CASING_SPEED_MIN);
        this.lastShotEffects.casing = new BulletCasing(
            new Vector2D(this.position.x, this.position.y),
            new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed)
        );

        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + (Math.random() - 0.5) * 1.0;
        const bounceSpeed = Constants.BOUNCING_BULLET_SPEED_MIN + 
                           Math.random() * (Constants.BOUNCING_BULLET_SPEED_MAX - Constants.BOUNCING_BULLET_SPEED_MIN);
        this.lastShotEffects.bouncingBullet = new BouncingBullet(
            new Vector2D(target.position.x, target.position.y),
            new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed)
        );
    }

    /**
     * Get effects from last shot (for game state to manage)
     */
    getAndClearLastShotEffects(): { 
        muzzleFlash?: MuzzleFlash, 
        casing?: BulletCasing, 
        bouncingBullet?: BouncingBullet 
    } {
        const effects = this.lastShotEffects;
        this.lastShotEffects = {};
        return effects;
    }
}

/**
 * Space Dust Swirler Building - Defensive building for Radiant faction
 * Swirls space dust in counter-clockwise orbits and deflects non-melee projectiles
 */
export class SpaceDustSwirler extends Building {
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.SWIRLER_MAX_HEALTH,
            Constants.SWIRLER_RADIUS,
            Constants.SWIRLER_ATTACK_RANGE,
            Constants.SWIRLER_ATTACK_DAMAGE,
            Constants.SWIRLER_ATTACK_SPEED
        );
    }

    /**
     * Apply swirling force to space dust particles within influence radius
     */
    applyDustSwirl(particles: SpaceDustParticle[], deltaTime: number): void {
        if (!this.isComplete) return;

        for (const particle of particles) {
            const dx = particle.position.x - this.position.x;
            const dy = particle.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only affect particles within influence radius
            if (distance > Constants.SWIRLER_INFLUENCE_RADIUS || distance < 1) continue;

            // Calculate tangential (counter-clockwise) direction
            // Counter-clockwise perpendicular: (dy, -dx) normalized
            const tangentX = dy / distance;
            const tangentY = -dx / distance;

            // Calculate speed based on distance (faster closer to tower)
            const normalizedDistance = distance / Constants.SWIRLER_INFLUENCE_RADIUS;
            const speedMultiplier = Constants.SWIRLER_DUST_SPEED_MULTIPLIER * (1 - normalizedDistance);
            const orbitSpeed = Constants.SWIRLER_DUST_ORBIT_SPEED_BASE * (1 + speedMultiplier);

            // Apply tangential velocity (straight orbit, not spiral)
            particle.velocity.x = tangentX * orbitSpeed;
            particle.velocity.y = tangentY * orbitSpeed;
        }
    }

    /**
     * Check if a projectile should be deflected and apply deflection
     * Returns true if projectile was deflected
     */
    deflectProjectile(projectile: MinionProjectile | GraveProjectile | InfluenceBallProjectile): boolean {
        if (!this.isComplete) return false;

        const dx = projectile.position.x - this.position.x;
        const dy = projectile.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only deflect projectiles within influence radius
        if (distance > Constants.SWIRLER_INFLUENCE_RADIUS) return false;

        // Deflect by rotating velocity counter-clockwise by 90 degrees
        const currentVelX = projectile.velocity.x;
        const currentVelY = projectile.velocity.y;
        
        // 90 degree counter-clockwise rotation: (x, y) -> (-y, x)
        projectile.velocity.x = -currentVelY;
        projectile.velocity.y = currentVelX;

        return true;
    }
}

/**
 * Subsidiary Factory Building - Production building
 * Can produce solar mirrors and special units. Only one can exist at a time.
 */
export class SubsidiaryFactory extends Building {
    private productionTimer: number = 0;

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.SUBSIDIARY_FACTORY_MAX_HEALTH,
            Constants.SUBSIDIARY_FACTORY_RADIUS,
            Constants.SUBSIDIARY_FACTORY_ATTACK_RANGE,
            Constants.SUBSIDIARY_FACTORY_ATTACK_DAMAGE,
            Constants.SUBSIDIARY_FACTORY_ATTACK_SPEED
        );
    }

    /**
     * Update production timer
     * Note: SubsidiaryFactory is a production building with no attack capability,
     * so we don't call super.update() which handles attack logic.
     */
    update(deltaTime: number, enemies: (Unit | StellarForge | Building)[], allUnits: Unit[]): void {
        // Only produce when complete
        if (!this.isComplete) return;

        this.productionTimer += deltaTime;
        
        // Production happens at intervals (placeholder for future implementation)
        if (this.productionTimer >= Constants.SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL) {
            this.productionTimer = 0;
            // TODO: Implement solar mirror and special unit production
        }
    }
}

/**
 * Sun/Star - Light source
 */
/**
 * Represents a color particle within the sun fractal
 */
export interface SunColorParticle {
    position: Vector2D;
    startColor: { r: number; g: number; b: number };
    currentColor: { r: number; g: number; b: number };
    targetColor: { r: number; g: number; b: number };
    transitionProgress: number;
    transitionSpeed: number;
    size: number;
}

export class Sun {
    public colorParticles: SunColorParticle[] = [];

    constructor(
        public position: Vector2D,
        public intensity: number = 1.0,
        public radius: number = 100.0
    ) {
        this.initializeColorParticles();
    }

    /**
     * Initialize color particles distributed within the sun
     */
    private initializeColorParticles(): void {
        const numParticles = 150; // Number of colored spaces in the fractal
        
        for (let i = 0; i < numParticles; i++) {
            // Distribute particles randomly within the sun's radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * this.radius * 0.8; // 80% of radius
            
            const particlePos = new Vector2D(
                this.position.x + Math.cos(angle) * distance,
                this.position.y + Math.sin(angle) * distance
            );
            
            const initialColor = this.getWeightedRandomColor();
            
            this.colorParticles.push({
                position: particlePos,
                startColor: { ...initialColor },
                currentColor: { ...initialColor },
                targetColor: { ...initialColor },
                transitionProgress: 1.0,
                transitionSpeed: 0.001 + Math.random() * 0.002, // Slow random speed
                size: 1.5 + Math.random() * 2.5 // Random size for visual variety
            });
        }
    }

    /**
     * Get a weighted random sun color (orange/red common, extremes rare)
     */
    private getWeightedRandomColor(): { r: number; g: number; b: number } {
        const rand = Math.random();
        
        // Weighted distribution
        if (rand < 0.35) {
            // Light orange (common)
            return { r: 255, g: 140 + Math.random() * 40, b: 50 + Math.random() * 30 };
        } else if (rand < 0.70) {
            // Red-orange (common)
            return { r: 255, g: 80 + Math.random() * 60, b: 30 + Math.random() * 30 };
        } else if (rand < 0.85) {
            // Deep red (less common)
            return { r: 200 + Math.random() * 55, g: 40 + Math.random() * 40, b: 20 + Math.random() * 20 };
        } else if (rand < 0.93) {
            // Warm yellow (rare)
            return { r: 255, g: 220 + Math.random() * 35, b: 100 + Math.random() * 50 };
        } else if (rand < 0.97) {
            // Dark red (rare)
            return { r: 150 + Math.random() * 50, g: 20 + Math.random() * 30, b: 10 + Math.random() * 20 };
        } else {
            // Dark grey (very rare)
            return { r: 60 + Math.random() * 40, g: 50 + Math.random() * 30, b: 45 + Math.random() * 30 };
        }
    }

    /**
     * Update color particle animations
     */
    public updateColorParticles(deltaTime: number): void {
        for (const particle of this.colorParticles) {
            particle.transitionProgress += particle.transitionSpeed * deltaTime;
            
            if (particle.transitionProgress >= 1.0) {
                // Transition complete, pick new target color
                particle.transitionProgress = 0;
                particle.startColor = { ...particle.targetColor };
                particle.currentColor = { ...particle.targetColor };
                particle.targetColor = this.getWeightedRandomColor();
                particle.transitionSpeed = 0.001 + Math.random() * 0.002; // New random speed
            } else {
                // Interpolate between start and target color using linear interpolation
                const t = particle.transitionProgress;
                particle.currentColor.r = particle.startColor.r + (particle.targetColor.r - particle.startColor.r) * t;
                particle.currentColor.g = particle.startColor.g + (particle.targetColor.g - particle.startColor.g) * t;
                particle.currentColor.b = particle.startColor.b + (particle.targetColor.b - particle.startColor.b) * t;
            }
        }
    }

    /**
     * Emit a light ray in specified direction
     */
    emitLight(direction: Vector2D): LightRay {
        return new LightRay(this.position, direction, this.intensity);
    }
}

/**
 * Player in the game
 */
export class Player {
    energy: number = 100.0; // Starting currency
    stellarForge: StellarForge | null = null;
    solarMirrors: SolarMirror[] = [];
    units: Unit[] = [];
    buildings: Building[] = []; // Offensive and defensive buildings
    isAi: boolean = false;
    aiNextMirrorCommandSec: number = 0;
    aiNextDefenseCommandSec: number = 0;
    aiNextHeroCommandSec: number = 0;
    aiNextStructureCommandSec: number = 0;
    aiNextMirrorPurchaseCommandSec: number = 0;
    aiStrategy: Constants.AIStrategy = Constants.AIStrategy.ECONOMIC; // AI build strategy (randomly assigned in createStandardGame for AI players)
    
    // Statistics tracking
    unitsCreated: number = 0;
    unitsLost: number = 0;
    energyGathered: number = 0;

    constructor(
        public name: string,
        public faction: Faction
    ) {}

    /**
     * Check if player is defeated
     */
    isDefeated(): boolean {
        return this.stellarForge === null || this.stellarForge.health <= 0;
    }

    /**
     * Add Energy to player's resources
     */
    addEnergy(amount: number): void {
        this.energy += amount;
        this.energyGathered += amount;
    }

    /**
     * Attempt to spend Energy
     */
    spendEnergy(amount: number): boolean {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }
}

/**
 * Space dust particle that gets affected by influences and forces
 */
export interface SpaceDustPalette {
    neutral: string[];
    accent: string[];
}

export class SpaceDustParticle {
    velocity: Vector2D;
    baseColor: string;
    currentColor: string;
    glowState: number = Constants.DUST_GLOW_STATE_NORMAL;
    glowTransition: number = 0; // 0-1 transition between states
    targetGlowState: number = Constants.DUST_GLOW_STATE_NORMAL;
    lastMovementTime: number = 0; // Time since last significant movement
    
    constructor(
        public position: Vector2D,
        velocity?: Vector2D,
        palette?: SpaceDustPalette
    ) {
        this.baseColor = SpaceDustParticle.generateBaseColor(palette);
        this.currentColor = this.baseColor;
        // Initialize with very slow random velocity
        if (velocity) {
            this.velocity = velocity;
        } else {
            this.velocity = new Vector2D(
                (Math.random() - 0.5) * 2,  // -1 to 1
                (Math.random() - 0.5) * 2
            );
        }
    }

    /**
     * Update particle position based on velocity
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Check if particle is moving significantly
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > Constants.DUST_FAST_MOVEMENT_THRESHOLD) {
            // Fast movement - trigger full glow
            this.targetGlowState = Constants.DUST_GLOW_STATE_FULL;
            this.lastMovementTime = Date.now();
        } else if (speed > Constants.DUST_SLOW_MOVEMENT_THRESHOLD) {
            // Some movement - maintain current glow or go to slight glow
            if (this.glowState < Constants.DUST_GLOW_STATE_SLIGHT) {
                this.targetGlowState = Constants.DUST_GLOW_STATE_SLIGHT;
            }
            this.lastMovementTime = Date.now();
        } else {
            // Slow/no movement - fade back to normal based on time since last movement
            const timeSinceMovement = Date.now() - this.lastMovementTime;
            if (timeSinceMovement > Constants.DUST_FADE_TO_NORMAL_DELAY_MS) {
                // After 2 seconds of slow movement, start fading to normal
                this.targetGlowState = Constants.DUST_GLOW_STATE_NORMAL;
            } else if (timeSinceMovement > Constants.DUST_FADE_TO_SLIGHT_DELAY_MS && this.glowState === Constants.DUST_GLOW_STATE_FULL) {
                // After 1 second, fade from full glow to slight glow
                this.targetGlowState = Constants.DUST_GLOW_STATE_SLIGHT;
            }
        }
        
        // Smooth transition between glow states
        const transitionSpeed = this.glowState < this.targetGlowState ? Constants.DUST_GLOW_TRANSITION_SPEED_UP : Constants.DUST_GLOW_TRANSITION_SPEED_DOWN;
        if (this.glowState < this.targetGlowState) {
            this.glowTransition += deltaTime * transitionSpeed;
            if (this.glowTransition >= 1.0) {
                this.glowState = this.targetGlowState;
                this.glowTransition = 0;
            }
        } else if (this.glowState > this.targetGlowState) {
            this.glowTransition += deltaTime * transitionSpeed;
            if (this.glowTransition >= 1.0) {
                this.glowState = this.targetGlowState;
                this.glowTransition = 0;
            }
        }
        
        // Apply friction to gradually slow down
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;

        const driftSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (driftSpeed < Constants.DUST_MIN_VELOCITY) {
            if (driftSpeed === 0) {
                this.velocity.x = Constants.DUST_MIN_VELOCITY;
                this.velocity.y = 0;
            } else {
                const driftScale = Constants.DUST_MIN_VELOCITY / driftSpeed;
                this.velocity.x *= driftScale;
                this.velocity.y *= driftScale;
            }
        }
    }

    /**
     * Apply force to particle (from units or attacks)
     */
    applyForce(force: Vector2D): void {
        this.velocity.x += force.x;
        this.velocity.y += force.y;
    }

    /**
     * Update color based on influence
     */
    updateColor(influenceColor: string | null, blendFactor: number): void {
        if (influenceColor && blendFactor > 0) {
            // Blend from gray to influence color
            this.currentColor = this.blendColors(this.baseColor, influenceColor, blendFactor);
        } else {
            this.currentColor = this.baseColor;
        }
    }

    /**
     * Blend two hex colors
     */
    private blendColors(color1: string, color2: string, factor: number): string {
        // Validate hex color format
        if (!color1 || !color2 || !color1.startsWith('#') || !color2.startsWith('#')) {
            return this.baseColor;
        }
        
        // Simple hex color blending
        const c1 = parseInt(color1.slice(1), 16);
        const c2 = parseInt(color2.slice(1), 16);
        
        if (isNaN(c1) || isNaN(c2)) {
            return this.baseColor;
        }
        
        const r1 = (c1 >> 16) & 0xff;
        const g1 = (c1 >> 8) & 0xff;
        const b1 = c1 & 0xff;
        
        const r2 = (c2 >> 16) & 0xff;
        const g2 = (c2 >> 8) & 0xff;
        const b2 = c2 & 0xff;
        
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    private static generateBaseColor(palette?: SpaceDustPalette): string {
        if (palette && palette.neutral.length > 0) {
            const paletteRoll = Math.random();
            const useAccent = paletteRoll > 0.7 && palette.accent.length > 0;
            const selection = useAccent ? palette.accent : palette.neutral;
            const colorIndex = Math.floor(Math.random() * selection.length);
            return selection[colorIndex];
        }

        const baseShade = 85 + Math.random() * 110;
        let r = baseShade;
        let g = baseShade;
        let b = baseShade;
        const tintRoll = Math.random();

        if (tintRoll < 0.18) {
            r = baseShade - 8;
            g = baseShade - 4;
            b = baseShade + 14;
        } else if (tintRoll < 0.28) {
            r = baseShade + 10;
            g = baseShade - 10;
            b = baseShade + 12;
        }

        const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
        const red = clamp(r);
        const green = clamp(g);
        const blue = clamp(b);

        return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
    }
}

/**
 * Forge crunch effect - periodic event that sucks in dust then pushes it out
 * Used when the forge "crunches" to spawn minions
 */
export class ForgeCrunch {
    phase: 'suck' | 'wave' | 'idle' = 'idle';
    phaseTimer: number = 0;
    
    constructor(
        public position: Vector2D
    ) {}

    /**
     * Start a new crunch cycle
     */
    start(): void {
        this.phase = 'suck';
        this.phaseTimer = Constants.FORGE_CRUNCH_SUCK_DURATION;
    }

    /**
     * Update crunch phase timers
     */
    update(deltaTime: number): void {
        if (this.phase === 'idle') return;

        this.phaseTimer -= deltaTime;
        
        if (this.phaseTimer <= 0) {
            if (this.phase === 'suck') {
                // Transition from suck to wave
                this.phase = 'wave';
                this.phaseTimer = Constants.FORGE_CRUNCH_WAVE_DURATION;
            } else if (this.phase === 'wave') {
                // Crunch complete
                this.phase = 'idle';
                this.phaseTimer = 0;
            }
        }
    }

    /**
     * Check if crunch is active
     */
    isActive(): boolean {
        return this.phase !== 'idle';
    }

    /**
     * Get current phase progress (0-1)
     */
    getPhaseProgress(): number {
        if (this.phase === 'idle') return 0;
        const totalDuration = this.phase === 'suck' 
            ? Constants.FORGE_CRUNCH_SUCK_DURATION 
            : Constants.FORGE_CRUNCH_WAVE_DURATION;
        return 1.0 - (this.phaseTimer / totalDuration);
    }
}

/**
 * Bullet casing that ejects from weapons and interacts with space dust
 */
export class BulletCasing {
    velocity: Vector2D;
    rotation: number = 0;
    rotationSpeed: number;
    lifetime: number = 0;
    maxLifetime: number = Constants.BULLET_CASING_LIFETIME;
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D
    ) {
        this.velocity = velocity;
        this.rotationSpeed = (Math.random() - 0.5) * 10; // Random spin
    }

    /**
     * Update casing position and physics
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
        
        // Apply friction
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        
        this.lifetime += deltaTime;
    }

    /**
     * Check if casing should be removed
     */
    shouldDespawn(): boolean {
        return this.lifetime >= this.maxLifetime;
    }

    /**
     * Apply collision response when hitting spacedust
     */
    applyCollision(force: Vector2D): void {
        this.velocity.x += force.x * Constants.CASING_COLLISION_DAMPING;
        this.velocity.y += force.y * Constants.CASING_COLLISION_DAMPING;
    }
}

/**
 * Muzzle flash effect when firing
 */
export class MuzzleFlash {
    lifetime: number = 0;
    maxLifetime: number = Constants.MUZZLE_FLASH_DURATION;
    
    constructor(
        public position: Vector2D,
        public angle: number
    ) {}

    /**
     * Update flash lifetime
     */
    update(deltaTime: number): void {
        this.lifetime += deltaTime;
    }

    /**
     * Check if flash should be removed
     */
    shouldDespawn(): boolean {
        return this.lifetime >= this.maxLifetime;
    }
}

/**
 * Bouncing bullet that appears when hitting an enemy
 */
export class BouncingBullet {
    velocity: Vector2D;
    lifetime: number = 0;
    maxLifetime: number = Constants.BOUNCING_BULLET_LIFETIME;
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D
    ) {
        this.velocity = velocity;
    }

    /**
     * Update bullet position
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Apply gravity-like effect
        this.velocity.y += 100 * deltaTime;
        
        // Apply friction
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
        
        this.lifetime += deltaTime;
    }

    /**
     * Check if bullet should be removed
     */
    shouldDespawn(): boolean {
        return this.lifetime >= this.maxLifetime;
    }
}

/**
 * Ability bullet for special attacks
 */
export class AbilityBullet {
    velocity: Vector2D;
    lifetime: number = 0;
    maxLifetime: number = Constants.MARINE_ABILITY_BULLET_LIFETIME;
    maxRange: number = Infinity; // Optional max range in pixels (default: no limit)
    startPosition: Vector2D;
    
    // Optional properties for Beam sniper projectile
    isBeamProjectile?: boolean;
    beamOwner?: Beam;
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D,
        public owner: Player,
        public damage: number = Constants.MARINE_ABILITY_BULLET_DAMAGE
    ) {
        this.velocity = velocity;
        this.startPosition = new Vector2D(position.x, position.y);
    }

    /**
     * Update bullet position
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetime += deltaTime;
    }

    /**
     * Check if bullet should be removed
     */
    shouldDespawn(): boolean {
        // Check lifetime
        if (this.lifetime >= this.maxLifetime) {
            return true;
        }
        
        // Check max range
        const distanceTraveled = this.startPosition.distanceTo(this.position);
        if (distanceTraveled >= this.maxRange) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if bullet hits a target
     */
    checkHit(target: Unit | StellarForge): boolean {
        const distance = this.position.distanceTo(target.position);
        return distance < 10; // Hit radius
    }
}

/**
 * Minion projectile fired by Starlings
 */
export class MinionProjectile {
    velocity: Vector2D;
    distanceTraveledPx: number = 0;
    maxRangePx: number;

    constructor(
        public position: Vector2D,
        velocity: Vector2D,
        public owner: Player,
        public damage: number,
        maxRangePx: number = Constants.STARLING_PROJECTILE_MAX_RANGE_PX
    ) {
        this.velocity = velocity;
        this.maxRangePx = maxRangePx;
    }

    update(deltaTime: number): void {
        const moveX = this.velocity.x * deltaTime;
        const moveY = this.velocity.y * deltaTime;
        this.position.x += moveX;
        this.position.y += moveY;
        this.distanceTraveledPx += Math.sqrt(moveX * moveX + moveY * moveY);
    }

    shouldDespawn(): boolean {
        return this.distanceTraveledPx >= this.maxRangePx;
    }

    checkHit(target: Unit | StellarForge | Building): boolean {
        const distance = this.position.distanceTo(target.position);
        return distance < Constants.STARLING_PROJECTILE_HIT_RADIUS_PX;
    }
}

/**
 * Base Unit class
 */
export class Unit {
    health: number;
    maxHealth: number;
    attackCooldown: number = 0;
    abilityCooldown: number = 0; // Cooldown for special ability
    target: Unit | StellarForge | Building | null = null;
    rallyPoint: Vector2D | null = null;
    protected lastAbilityEffects: AbilityBullet[] = [];
    isHero: boolean = false; // Flag to mark unit as hero
    moveOrder: number = 0; // Movement order indicator (0 = no order)
    collisionRadiusPx: number;
    rotation: number = 0; // Current facing angle in radians
    velocity: Vector2D = new Vector2D(0, 0);
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        maxHealth: number,
        public attackRange: number,
        public attackDamage: number,
        public attackSpeed: number, // attacks per second
        public abilityCooldownTime: number = 5.0, // Default ability cooldown time
        collisionRadiusPx: number = Constants.UNIT_RADIUS_PX
    ) {
        this.health = maxHealth;
        this.maxHealth = maxHealth;
        this.collisionRadiusPx = collisionRadiusPx;
    }

    /**
     * Update unit logic
     */
    update(
        deltaTime: number,
        enemies: (Unit | StellarForge | Building)[],
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Update ability cooldown
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= deltaTime;
        }

        this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits, asteroids);

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

    protected moveTowardRallyPoint(
        deltaTime: number,
        moveSpeed: number,
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        if (!this.rallyPoint) {
            this.velocity.x = 0;
            this.velocity.y = 0;
            return;
        }

        const dx = this.rallyPoint.x - this.position.x;
        const dy = this.rallyPoint.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distanceToTarget <= Constants.UNIT_ARRIVAL_THRESHOLD) {
            this.rallyPoint = null;
            this.velocity.x = 0;
            this.velocity.y = 0;
            return;
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
                } else if (!this.isHero && otherUnit.isHero) {
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
            const targetRotation = Math.atan2(directionY, directionX);
            const rotationDelta = this.getShortestAngleDelta(this.rotation, targetRotation);
            const maxRotationStep = Constants.UNIT_TURN_SPEED_RAD_PER_SEC * deltaTime;
            
            if (Math.abs(rotationDelta) <= maxRotationStep) {
                this.rotation = targetRotation;
            } else {
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
    private getShortestAngleDelta(from: number, to: number): number {
        let delta = to - from;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        return delta;
    }

    /**
     * Check if target is dead
     */
    protected isTargetDead(target: Unit | StellarForge | Building): boolean {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }

    /**
     * Find nearest enemy
     */
    protected findNearestEnemy(enemies: (Unit | StellarForge | Building)[]): Unit | StellarForge | Building | null {
        let nearest: Unit | StellarForge | Building | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if ('health' in enemy && enemy.health <= 0) continue;
            
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
    attack(target: Unit | StellarForge | Building): void {
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
    useAbility(direction: Vector2D): boolean {
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
    getAndClearLastAbilityEffects(): AbilityBullet[] {
        const effects = this.lastAbilityEffects;
        this.lastAbilityEffects = [];
        return effects;
    }

    /**
     * Take damage
     */
    takeDamage(amount: number): void {
        this.health -= amount;
    }

    /**
     * Check if unit is dead
     */
    isDead(): boolean {
        return this.health <= 0;
    }
}

/**
 * Marine unit - fast shooting with visual effects
 */
export class Marine extends Unit {
    private lastShotEffects: { 
        muzzleFlash?: MuzzleFlash, 
        casing?: BulletCasing, 
        bouncingBullet?: BouncingBullet 
    } = {};

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.MARINE_MAX_HEALTH,
            Constants.MARINE_ATTACK_RANGE,
            Constants.MARINE_ATTACK_DAMAGE,
            Constants.MARINE_ATTACK_SPEED,
            Constants.MARINE_ABILITY_COOLDOWN
        );
        this.isHero = true; // Marine is a hero unit for Radiant faction
    }

    /**
     * Attack with visual effects
     */
    attack(target: Unit | StellarForge | Building): void {
        // Apply damage
        super.attack(target);

        // Calculate angle to target
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const angle = Math.atan2(dy, dx);

        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = new MuzzleFlash(
            new Vector2D(this.position.x, this.position.y),
            angle
        );

        // Create bullet casing with slight angle deviation
        const casingAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Eject to the side
        const casingSpeed = Constants.BULLET_CASING_SPEED_MIN + 
                           Math.random() * (Constants.BULLET_CASING_SPEED_MAX - Constants.BULLET_CASING_SPEED_MIN);
        this.lastShotEffects.casing = new BulletCasing(
            new Vector2D(this.position.x, this.position.y),
            new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed)
        );

        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + (Math.random() - 0.5) * 1.0; // Bounce away from impact
        const bounceSpeed = Constants.BOUNCING_BULLET_SPEED_MIN + 
                           Math.random() * (Constants.BOUNCING_BULLET_SPEED_MAX - Constants.BOUNCING_BULLET_SPEED_MIN);
        this.lastShotEffects.bouncingBullet = new BouncingBullet(
            new Vector2D(target.position.x, target.position.y),
            new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed)
        );
    }

    /**
     * Get effects from last shot (for game state to manage)
     */
    getAndClearLastShotEffects(): { 
        muzzleFlash?: MuzzleFlash, 
        casing?: BulletCasing, 
        bouncingBullet?: BouncingBullet 
    } {
        const effects = this.lastShotEffects;
        this.lastShotEffects = {};
        return effects;
    }

    /**
     * Use special ability: Bullet Storm
     * Fires a spread of bullets in the specified direction
     */
    useAbility(direction: Vector2D): boolean {
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
            const velocity = new Vector2D(
                Math.cos(bulletAngle) * speed,
                Math.sin(bulletAngle) * speed
            );
            
            // Create bullet
            const bullet = new AbilityBullet(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner
            );
            
            this.lastAbilityEffects.push(bullet);
        }

        return true;
    }
}

/**
 * Projectile that orbits a Grave unit with gravitational attraction
 */
export class GraveProjectile {
    velocity: Vector2D;
    lifetime: number = 0;
    isAttacking: boolean = false;
    targetEnemy: Unit | StellarForge | Building | null = null;
    trail: Vector2D[] = []; // Trail of positions
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D,
        public owner: Player
    ) {
        this.velocity = velocity;
    }

    /**
     * Update projectile position with gravitational attraction to grave
     */
    update(deltaTime: number, gravePosition: Vector2D): void {
        if (!this.isAttacking) {
            // Apply gravitational attraction to grave
            const dx = gravePosition.x - this.position.x;
            const dy = gravePosition.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // Normalize direction
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                // Apply attraction force
                const force = Constants.GRAVE_PROJECTILE_ATTRACTION_FORCE;
                this.velocity.x += dirX * force * deltaTime;
                this.velocity.y += dirY * force * deltaTime;
                
                // Maintain minimum speed to keep orbiting
                const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
                if (speed < Constants.GRAVE_PROJECTILE_MIN_SPEED) {
                    const scale = Constants.GRAVE_PROJECTILE_MIN_SPEED / speed;
                    this.velocity.x *= scale;
                    this.velocity.y *= scale;
                }
            }
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Update trail when attacking
        if (this.isAttacking) {
            this.trail.push(new Vector2D(this.position.x, this.position.y));
            if (this.trail.length > Constants.GRAVE_PROJECTILE_TRAIL_LENGTH) {
                this.trail.shift(); // Remove oldest trail point
            }
            this.lifetime += deltaTime;
        }
        
        // Check if hit target
        if (this.isAttacking && this.targetEnemy) {
            const distance = this.position.distanceTo(this.targetEnemy.position);
            if (distance < Constants.GRAVE_PROJECTILE_HIT_DISTANCE) {
                // Hit the target
                if ('health' in this.targetEnemy) {
                    this.targetEnemy.health -= Constants.GRAVE_ATTACK_DAMAGE;
                }
                // Mark for removal by returning to grave
                this.isAttacking = false;
                this.trail = [];
                this.targetEnemy = null;
            }
        }
    }

    /**
     * Launch projectile toward target
     */
    launchAtTarget(target: Unit | StellarForge | Building): void {
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
     * Reset projectile to orbit mode
     */
    returnToOrbit(): void {
        this.isAttacking = false;
        this.trail = [];
        this.targetEnemy = null;
    }
}

/**
 * Grave unit - has orbiting projectiles that attack enemies
 */
export class Grave extends Unit {
    projectiles: GraveProjectile[] = [];
    projectileLaunchCooldown: number = 0;
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.GRAVE_MAX_HEALTH,
            Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER, // Hero units have reduced range
            Constants.GRAVE_ATTACK_DAMAGE,
            Constants.GRAVE_ATTACK_SPEED,
            5.0 // Default ability cooldown
        );
        this.isHero = true; // Grave is a hero unit for Aurum faction
        
        // Initialize orbiting projectiles
        for (let i = 0; i < Constants.GRAVE_NUM_PROJECTILES; i++) {
            const angle = (i / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
            const offsetX = Math.cos(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
            const offsetY = Math.sin(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
            
            // Give initial tangential velocity for orbit
            const tangentVelX = -Math.sin(angle) * Constants.GRAVE_PROJECTILE_MIN_SPEED;
            const tangentVelY = Math.cos(angle) * Constants.GRAVE_PROJECTILE_MIN_SPEED;
            
            this.projectiles.push(new GraveProjectile(
                new Vector2D(position.x + offsetX, position.y + offsetY),
                new Vector2D(tangentVelX, tangentVelY),
                owner
            ));
        }
    }

    /**
     * Update grave and its projectiles
     */
    update(deltaTime: number, enemies: (Unit | StellarForge)[], allUnits: Unit[], asteroids: Asteroid[] = []): void {
        // Update base unit logic
        super.update(deltaTime, enemies, allUnits, asteroids);
        
        // Update projectile launch cooldown
        if (this.projectileLaunchCooldown > 0) {
            this.projectileLaunchCooldown -= deltaTime;
        }
        
        // Update all projectiles
        for (const projectile of this.projectiles) {
            projectile.update(deltaTime, this.position);
        }
        
        // Launch projectiles at enemies if in range
        if (this.target && this.projectileLaunchCooldown <= 0) {
            const distance = this.position.distanceTo(this.target.position);
            if (distance <= this.attackRange) {
                // Find an available projectile (not currently attacking)
                const availableProjectile = this.projectiles.find(p => !p.isAttacking);
                if (availableProjectile) {
                    availableProjectile.launchAtTarget(this.target);
                    this.projectileLaunchCooldown = 1.0 / this.attackSpeed;
                }
            }
        }
    }

    /**
     * Grave doesn't use the base attack (projectiles do the damage)
     */
    attack(target: Unit | StellarForge | Building): void {
        // Projectiles handle the actual attacking
    }

    /**
     * Get all projectiles for rendering
     */
    getProjectiles(): GraveProjectile[] {
        return this.projectiles;
    }
}

/**
 * Starling unit - minion that spawns from stellar forge and has AI behavior
 */
export class Starling extends Unit {
    private explorationTarget: Vector2D | null = null;
    private explorationTimer: number = 0;
    private currentPathWaypointIndex: number = 0; // Current waypoint index in the assigned path
    private assignedPath: Vector2D[] = [];
    private hasManualOrder: boolean = false;
    private lastShotProjectiles: MinionProjectile[] = [];
    
    constructor(position: Vector2D, owner: Player, assignedPath: Vector2D[] = []) {
        super(
            position,
            owner,
            Constants.STARLING_MAX_HEALTH,
            Constants.STARLING_ATTACK_RANGE,
            Constants.STARLING_ATTACK_DAMAGE,
            Constants.STARLING_ATTACK_SPEED,
            0, // No special ability
            Constants.STARLING_COLLISION_RADIUS_PX
        );
        this.assignedPath = assignedPath.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
    }

    setManualRallyPoint(target: Vector2D): void {
        this.rallyPoint = target;
        this.hasManualOrder = true;
    }

    getAssignedPathLength(): number {
        return this.assignedPath.length;
    }

    getCurrentPathWaypointIndex(): number {
        return this.currentPathWaypointIndex;
    }

    hasActiveManualOrder(): boolean {
        return this.hasManualOrder;
    }

    getAndClearLastShotProjectiles(): MinionProjectile[] {
        const projectiles = this.lastShotProjectiles;
        this.lastShotProjectiles = [];
        return projectiles;
    }

    /**
     * Update starling AI behavior (call this before regular update)
     */
    updateAI(gameState: GameState, enemies: (Unit | StellarForge | Building)[]): void {
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
                } else {
                    // We've reached the end of the path, stay here (pile up)
                    this.rallyPoint = rallyTarget;
                    return;
                }
            } else {
                // Set rally point to current waypoint
                this.rallyPoint = rallyTarget;
            }
        } else {
            // No path defined, fall back to original AI behavior
            // No need to update exploration timer here, it's updated in the main update loop

            // AI behavior: prioritize enemy base, then buildings, then explore
            let targetPosition: Vector2D | null = null;
            let targetRadiusPx: number | null = null;

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
                        if (targetPosition) break;
                    }
                }
            }

            // 3. If no visible structures, explore shadows randomly
            if (!targetPosition) {
                // Generate new random exploration target every few seconds or if we've reached current target
                if (this.explorationTimer <= 0 || !this.explorationTarget ||
                    this.position.distanceTo(this.explorationTarget) < Constants.UNIT_ARRIVAL_THRESHOLD) {
                    // Pick a random position in shadow
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 300 + Math.random() * 500;
                    this.explorationTarget = new Vector2D(
                        this.position.x + Math.cos(angle) * distance,
                        this.position.y + Math.sin(angle) * distance
                    );
                    this.explorationTimer = Constants.STARLING_EXPLORATION_CHANGE_INTERVAL;
                }
                targetPosition = this.explorationTarget;
            }

            // Set rally point for movement
            if (targetPosition) {
                if (targetRadiusPx) {
                    this.rallyPoint = this.getStructureStandoffPoint(targetPosition, targetRadiusPx);
                } else {
                    this.rallyPoint = targetPosition;
                }
            }
        }
    }

    private getStandoffPointForWaypoint(gameState: GameState, waypoint: Vector2D): Vector2D | null {
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

    private getStructureStandoffPoint(targetPosition: Vector2D, targetRadiusPx: number): Vector2D {
        const offsetX = this.position.x - targetPosition.x;
        const offsetY = this.position.y - targetPosition.y;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        const minDistance = targetRadiusPx + this.collisionRadiusPx + Constants.UNIT_STRUCTURE_STANDOFF_PX;

        if (distance <= 0) {
            return new Vector2D(targetPosition.x + minDistance, targetPosition.y);
        }

        const scale = minDistance / distance;
        return new Vector2D(
            targetPosition.x + offsetX * scale,
            targetPosition.y + offsetY * scale
        );
    }

    /**
     * Override update to use custom movement speed
     */
    update(
        deltaTime: number,
        enemies: (Unit | StellarForge | Building)[],
        allUnits: Unit[] = [],
        asteroids: Asteroid[] = []
    ): void {
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

        this.moveTowardRallyPoint(deltaTime, Constants.STARLING_MOVE_SPEED, allUnits, asteroids);

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

    attack(target: Unit | StellarForge | Building): void {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) {
            return;
        }
        const velocity = new Vector2D(
            (dx / distance) * Constants.STARLING_PROJECTILE_SPEED,
            (dy / distance) * Constants.STARLING_PROJECTILE_SPEED
        );
        this.lastShotProjectiles.push(new MinionProjectile(
            new Vector2D(this.position.x, this.position.y),
            velocity,
            this.owner,
            this.attackDamage
        ));
    }
}

/**
 * Warp gate being conjured by player
 */
export class WarpGate {
    chargeTime: number = 0;
    isCharging: boolean = false;
    isComplete: boolean = false;
    health: number = 100;
    hasEmittedShockwave: boolean = false; // Track if shockwave was emitted
    
    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Update warp gate charging
     */
    update(deltaTime: number, isStillHolding: boolean, chargeMultiplier: number = 1.0): void {
        if (!this.isCharging || this.isComplete) {
            return;
        }

        if (!isStillHolding) {
            // Player let go, cancel the warp gate
            this.cancel();
            return;
        }

        this.chargeTime += deltaTime * chargeMultiplier;

        // Check if fully charged
        if (this.chargeTime >= Constants.WARP_GATE_CHARGE_TIME) {
            this.isComplete = true;
            this.isCharging = false;
        }
    }

    /**
     * Start charging the warp gate
     */
    startCharging(): void {
        this.isCharging = true;
        this.chargeTime = 0;
    }

    /**
     * Take damage and potentially dissipate
     */
    takeDamage(amount: number): boolean {
        this.health -= amount;
        if (this.health <= 0) {
            this.cancel();
            return true; // Gate destroyed
        }
        return false;
    }

    /**
     * Cancel/dissipate the warp gate
     */
    cancel(): void {
        this.isCharging = false;
        this.isComplete = false;
        // Scatter particles will be handled in game state
    }

    /**
     * Check if shockwave should be emitted (at 1 second mark)
     */
    shouldEmitShockwave(): boolean {
        if (this.hasEmittedShockwave) {
            return false;
        }
        if (this.chargeTime >= 1.0) {
            this.hasEmittedShockwave = true;
            return true;
        }
        return false;
    }
}

/**
 * Ray beam segment for bouncing beam ability
 */
export class RayBeamSegment {
    lifetime: number = 0;
    maxLifetime: number = 0.5; // 0.5 seconds per segment
    
    constructor(
        public startPos: Vector2D,
        public endPos: Vector2D,
        public owner: Player
    ) {}
    
    update(deltaTime: number): boolean {
        this.lifetime += deltaTime;
        return this.lifetime >= this.maxLifetime;
    }
}

/**
 * Ray hero unit (Solari faction) - shoots bouncing beam
 */
export class Ray extends Unit {
    private beamSegments: RayBeamSegment[] = [];
    drillDirection: Vector2D | null = null; // Used temporarily to store ability direction
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.RAY_MAX_HEALTH,
            Constants.RAY_ATTACK_RANGE,
            Constants.RAY_ATTACK_DAMAGE,
            Constants.RAY_ATTACK_SPEED,
            Constants.RAY_ABILITY_COOLDOWN
        );
        this.isHero = true; // Ray is a hero unit for Solari faction
    }
    
    /**
     * Use Ray's bouncing beam ability
     */
    useAbility(direction: Vector2D): boolean {
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Store direction for GameState to process
        this.drillDirection = direction;
        
        return true;
    }
    
    /**
     * Get beam segments for rendering
     */
    getBeamSegments(): RayBeamSegment[] {
        return this.beamSegments;
    }
    
    /**
     * Set beam segments (called by GameState after calculating bounces)
     */
    setBeamSegments(segments: RayBeamSegment[]): void {
        this.beamSegments = segments;
    }
    
    /**
     * Update beam segments
     */
    updateBeamSegments(deltaTime: number): void {
        this.beamSegments = this.beamSegments.filter(segment => !segment.update(deltaTime));
    }
}

/**
 * Influence zone created by InfluenceBall ability
 */
export class InfluenceZone {
    lifetime: number = 0;
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        public radius: number = Constants.INFLUENCE_BALL_EXPLOSION_RADIUS,
        public duration: number = Constants.INFLUENCE_BALL_DURATION
    ) {}
    
    update(deltaTime: number): boolean {
        this.lifetime += deltaTime;
        return this.lifetime >= this.duration;
    }
    
    isExpired(): boolean {
        return this.lifetime >= this.duration;
    }
}

/**
 * Influence Ball projectile
 */
export class InfluenceBallProjectile {
    velocity: Vector2D;
    lifetime: number = 0;
    maxLifetime: number = 5.0; // Max 5 seconds before auto-explode
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D,
        public owner: Player
    ) {
        this.velocity = velocity;
    }
    
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetime += deltaTime;
    }
    
    shouldExplode(): boolean {
        return this.lifetime >= this.maxLifetime;
    }
}

/**
 * Influence Ball hero unit (Solari faction) - creates temporary influence zones
 */
export class InfluenceBall extends Unit {
    private projectileToCreate: InfluenceBallProjectile | null = null;
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.INFLUENCE_BALL_MAX_HEALTH,
            Constants.INFLUENCE_BALL_ATTACK_RANGE,
            Constants.INFLUENCE_BALL_ATTACK_DAMAGE,
            Constants.INFLUENCE_BALL_ATTACK_SPEED,
            Constants.INFLUENCE_BALL_ABILITY_COOLDOWN
        );
        this.isHero = true; // InfluenceBall is a hero unit for Solari faction
    }
    
    /**
     * Use Influence Ball's area control ability
     */
    useAbility(direction: Vector2D): boolean {
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Create influence ball projectile
        const velocity = new Vector2D(
            direction.x * Constants.INFLUENCE_BALL_PROJECTILE_SPEED,
            direction.y * Constants.INFLUENCE_BALL_PROJECTILE_SPEED
        );
        
        this.projectileToCreate = new InfluenceBallProjectile(
            new Vector2D(this.position.x, this.position.y),
            velocity,
            this.owner
        );
        
        return true;
    }
    
    /**
     * Get and clear pending projectile
     */
    getAndClearProjectile(): InfluenceBallProjectile | null {
        const proj = this.projectileToCreate;
        this.projectileToCreate = null;
        return proj;
    }
}

/**
 * Deployed turret that attaches to asteroids
 */
export class DeployedTurret {
    health: number;
    maxHealth: number = Constants.DEPLOYED_TURRET_MAX_HEALTH;
    attackCooldown: number = 0;
    target: Unit | StellarForge | Building | null = null;
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        public attachedToAsteroid: Asteroid | null = null
    ) {
        this.health = this.maxHealth;
    }
    
    update(deltaTime: number, enemies: (Unit | StellarForge | Building)[]): void {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Find target if don't have one or current target is dead
        if (!this.target || this.isTargetDead(this.target)) {
            this.target = this.findNearestEnemy(enemies);
        }
        
        // Attack if target in range and cooldown ready
        if (this.target && this.attackCooldown <= 0) {
            const distance = this.position.distanceTo(this.target.position);
            if (distance <= Constants.DEPLOYED_TURRET_ATTACK_RANGE) {
                this.attack(this.target);
                this.attackCooldown = 1.0 / Constants.DEPLOYED_TURRET_ATTACK_SPEED;
            }
        }
    }
    
    private isTargetDead(target: Unit | StellarForge | Building): boolean {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }
    
    private findNearestEnemy(enemies: (Unit | StellarForge | Building)[]): Unit | StellarForge | Building | null {
        let nearest: Unit | StellarForge | Building | null = null;
        let minDistance = Infinity;
        
        for (const enemy of enemies) {
            if ('health' in enemy && enemy.health <= 0) continue;
            
            const distance = this.position.distanceTo(enemy.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = enemy;
            }
        }
        
        return nearest;
    }
    
    attack(target: Unit | StellarForge | Building): void {
        if ('health' in target) {
            target.health -= Constants.DEPLOYED_TURRET_ATTACK_DAMAGE;
        }
    }
    
    takeDamage(amount: number): void {
        this.health -= amount;
    }
    
    isDead(): boolean {
        return this.health <= 0;
    }
}

/**
 * Turret Deployer hero unit (Solari faction) - deploys turrets on asteroids
 */
export class TurretDeployer extends Unit {
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.TURRET_DEPLOYER_MAX_HEALTH,
            Constants.TURRET_DEPLOYER_ATTACK_RANGE,
            Constants.TURRET_DEPLOYER_ATTACK_DAMAGE,
            Constants.TURRET_DEPLOYER_ATTACK_SPEED,
            Constants.TURRET_DEPLOYER_ABILITY_COOLDOWN
        );
        this.isHero = true; // TurretDeployer is a hero unit for Solari faction
    }
    
    /**
     * Use Turret Deployer's turret placement ability
     * The turret deployment will be handled by GameState which has access to asteroids
     */
    useAbility(direction: Vector2D): boolean {
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Signal that ability was used, GameState will handle turret placement
        return true;
    }
}

/**
 * Driller hero unit (Aurum faction) - drills through asteroids
 */
export class Driller extends Unit {
    isDrilling: boolean = false;
    isHidden: boolean = false; // Hidden when inside asteroid
    drillDirection: Vector2D | null = null;
    drillVelocity: Vector2D = new Vector2D(0, 0);
    hiddenInAsteroid: Asteroid | null = null;
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.DRILLER_MAX_HEALTH,
            Constants.DRILLER_ATTACK_RANGE,
            Constants.DRILLER_ATTACK_DAMAGE,
            Constants.DRILLER_ATTACK_SPEED,
            Constants.DRILLER_ABILITY_COOLDOWN
        );
        this.isHero = true; // Driller is a hero unit for Aurum faction
    }
    
    /**
     * Driller has no normal attack - only the drilling ability
     */
    attack(target: Unit | StellarForge | Building): void {
        // Driller does not have a normal attack - it only attacks via drilling ability
        // This is intentional per the unit design
    }
    
    /**
     * Use Driller's drilling ability
     */
    useAbility(direction: Vector2D): boolean {
        // Check if already drilling
        if (this.isDrilling) {
            return false;
        }
        
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Start drilling
        this.isDrilling = true;
        this.isHidden = false;
        this.drillDirection = direction.normalize();
        this.drillVelocity = new Vector2D(
            this.drillDirection.x * Constants.DRILLER_DRILL_SPEED,
            this.drillDirection.y * Constants.DRILLER_DRILL_SPEED
        );
        
        return true;
    }
    
    /**
     * Update drilling movement
     */
    updateDrilling(deltaTime: number): void {
        if (this.isDrilling && this.drillVelocity) {
            this.position.x += this.drillVelocity.x * deltaTime;
            this.position.y += this.drillVelocity.y * deltaTime;
        }
    }
    
    /**
     * Stop drilling and start cooldown
     */
    stopDrilling(): void {
        this.isDrilling = false;
        this.drillVelocity = new Vector2D(0, 0);
        // Cooldown timer already set by useAbility
    }
    
    /**
     * Hide in asteroid
     */
    hideInAsteroid(asteroid: Asteroid): void {
        this.isHidden = true;
        this.hiddenInAsteroid = asteroid;
        this.position = new Vector2D(asteroid.position.x, asteroid.position.y);
    }
    
    /**
     * Check if driller is hidden
     */
    isHiddenInAsteroid(): boolean {
        return this.isHidden;
    }
}

/**
 * Dagger hero unit (Radiant faction) - cloaked assassin
 * Always cloaked and invisible to enemies. Cannot see enemies until ability is used.
 * Becomes visible for 8 seconds after using ability.
 */
export class Dagger extends Unit {
    isCloaked: boolean = true; // Always cloaked unless ability was recently used
    visibilityTimer: number = 0; // Time remaining while visible after ability use
    canSeeEnemies: boolean = false; // Can only see enemies after using ability
    enemyVisionTimer: number = 0; // Time remaining with enemy vision
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.DAGGER_MAX_HEALTH,
            Constants.DAGGER_ATTACK_RANGE,
            Constants.DAGGER_ATTACK_DAMAGE,
            Constants.DAGGER_ATTACK_SPEED,
            Constants.DAGGER_ABILITY_COOLDOWN
        );
        this.isHero = true; // Dagger is a hero unit for Radiant faction
    }
    
    /**
     * Update visibility and enemy vision timers
     */
    updateTimers(deltaTime: number): void {
        // Update visibility timer (visible to enemies after ability use)
        if (this.visibilityTimer > 0) {
            this.visibilityTimer -= deltaTime;
            if (this.visibilityTimer <= 0) {
                this.visibilityTimer = 0;
                this.isCloaked = true; // Return to cloaked state
            }
        }
        
        // Update enemy vision timer (can see enemies after ability use)
        if (this.enemyVisionTimer > 0) {
            this.enemyVisionTimer -= deltaTime;
            if (this.enemyVisionTimer <= 0) {
                this.enemyVisionTimer = 0;
                this.canSeeEnemies = false; // Lose ability to see enemies
            }
        }
    }
    
    /**
     * Use Dagger's ability: short-range directional attack
     * Deals damage in a cone and reveals the Dagger for 8 seconds
     */
    useAbility(direction: Vector2D): boolean {
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Reveal Dagger for 8 seconds
        this.isCloaked = false;
        this.visibilityTimer = Constants.DAGGER_VISIBILITY_DURATION;
        
        // Grant enemy vision for 8 seconds
        this.canSeeEnemies = true;
        this.enemyVisionTimer = Constants.DAGGER_VISIBILITY_DURATION;
        
        // Calculate attack direction
        const attackDir = direction.normalize();
        const attackAngle = Math.atan2(attackDir.y, attackDir.x);
        
        // Create a short-range directional attack projectile
        const speed = 400; // Fast projectile speed
        const velocity = new Vector2D(
            Math.cos(attackAngle) * speed,
            Math.sin(attackAngle) * speed
        );
        
        // Create ability bullet
        const bullet = new AbilityBullet(
            new Vector2D(this.position.x, this.position.y),
            velocity,
            this.owner,
            Constants.DAGGER_ABILITY_DAMAGE
        );
        
        // Set short range for the projectile
        bullet.maxRange = Constants.DAGGER_ABILITY_RANGE;
        
        this.lastAbilityEffects.push(bullet);
        
        return true;
    }
    
    /**
     * Override update to filter enemies based on vision
     */
    update(
        deltaTime: number,
        enemies: (Unit | StellarForge | Building)[],
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        // Filter enemies - Dagger can only see enemies if it has enemy vision
        let visibleEnemies = enemies;
        if (!this.canSeeEnemies) {
            visibleEnemies = []; // Cannot see any enemies when lacking enemy vision
        }
        
        // Call parent update with filtered enemy list
        super.update(deltaTime, visibleEnemies, allUnits, asteroids);
    }
    
    /**
     * Check if this Dagger is cloaked (invisible to enemies)
     */
    isCloakedToEnemies(): boolean {
        return this.isCloaked;
    }
    
    /**
     * Check if this Dagger can currently see enemies
     */
    hasEnemyVision(): boolean {
        return this.canSeeEnemies;
    }
}

/**
 * Beam hero unit (Radiant faction) - sniper with distance-based damage
 * Fires a thin beam that does more damage the further away the target is
 */
export class Beam extends Unit {
    public lastBeamDamage: number = 0; // For displaying multiplier
    public lastBeamDistance: number = 0; // For calculating multiplier
    public lastBeamMultiplier: number = 0; // For display above unit
    public lastBeamTime: number = 0; // When the last beam was fired
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.BEAM_MAX_HEALTH,
            Constants.BEAM_ATTACK_RANGE,
            Constants.BEAM_ATTACK_DAMAGE,
            Constants.BEAM_ATTACK_SPEED,
            Constants.BEAM_ABILITY_COOLDOWN
        );
        this.isHero = true; // Beam is a hero unit for Radiant faction
    }
    
    /**
     * Use Beam's ability: long-range sniper beam with distance-based damage
     * Deals more damage the further away the target is
     */
    useAbility(direction: Vector2D): boolean {
        if (!super.useAbility(direction)) {
            return false;
        }
        
        // Calculate beam direction
        const beamDir = direction.normalize();
        
        // Create a thin beam projectile that travels in a straight line
        const speed = 1000; // Very fast beam speed
        const velocity = new Vector2D(
            beamDir.x * speed,
            beamDir.y * speed
        );
        
        // Create ability bullet for the beam
        const bullet = new AbilityBullet(
            new Vector2D(this.position.x, this.position.y),
            velocity,
            this.owner,
            Constants.BEAM_ABILITY_BASE_DAMAGE // Base damage, will be modified on hit
        );
        
        // Set long range for the sniper beam
        bullet.maxRange = Constants.BEAM_ABILITY_MAX_RANGE;
        
        // Mark this as a beam projectile for special damage calculation
        bullet.isBeamProjectile = true;
        bullet.beamOwner = this;
        
        this.lastAbilityEffects.push(bullet);
        
        return true;
    }
}

/**
 * Damage number that floats upward and fades out
 */
export class DamageNumber {
    public position: Vector2D;
    public damage: number;
    public creationTime: number;
    public velocity: Vector2D;
    public maxHealth: number; // For calculating size proportional to health

    constructor(
        position: Vector2D,
        damage: number,
        creationTime: number,
        maxHealth: number = 100
    ) {
        this.position = new Vector2D(position.x, position.y);
        this.damage = Math.round(damage);
        this.creationTime = creationTime;
        this.maxHealth = maxHealth;
        // Random horizontal drift
        this.velocity = new Vector2D(
            (Math.random() - 0.5) * 20,
            -50 // Upward velocity
        );
    }

    /**
     * Update position based on velocity
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * Check if damage number has expired (2 second lifetime)
     */
    isExpired(currentTime: number): boolean {
        return currentTime - this.creationTime > 2.0;
    }

    /**
     * Get opacity based on age (fade out over time)
     */
    getOpacity(currentTime: number): number {
        const age = currentTime - this.creationTime;
        const lifetime = 2.0;
        return Math.max(0, 1 - age / lifetime);
    }
}

/**
 * Main game state
 */
export class GameState {
    players: Player[] = [];
    suns: Sun[] = [];
    spaceDust: SpaceDustParticle[] = [];
    warpGates: WarpGate[] = [];
    asteroids: Asteroid[] = [];
    muzzleFlashes: MuzzleFlash[] = [];
    bulletCasings: BulletCasing[] = [];
    bouncingBullets: BouncingBullet[] = [];
    abilityBullets: AbilityBullet[] = [];
    minionProjectiles: MinionProjectile[] = [];
    influenceZones: InfluenceZone[] = [];
    influenceBallProjectiles: InfluenceBallProjectile[] = [];
    deployedTurrets: DeployedTurret[] = [];
    damageNumbers: DamageNumber[] = [];
    gameTime: number = 0.0;
    stateHash: number = 0;
    stateHashTickCounter: number = 0;
    isRunning: boolean = false;
    countdownTime: number = Constants.COUNTDOWN_DURATION; // Countdown from 3 seconds
    isCountdownActive: boolean = true; // Start with countdown active
    mirrorsMovedToSun: boolean = false; // Track if mirrors have been moved
    mapSize: number = 2000; // Map size in world units

    // Collision resolution constants
    private readonly MAX_PUSH_DISTANCE = 10; // Maximum push distance for collision resolution
    private readonly PUSH_MULTIPLIER = 15; // Multiplier for push strength calculation
    private readonly dustSpatialHash: Map<number, number[]> = new Map();
    private readonly dustSpatialHashKeys: number[] = [];

    /**
     * Update game state
     */
    update(deltaTime: number): void {
        this.gameTime += deltaTime;

        // Handle countdown
        if (this.isCountdownActive) {
            this.countdownTime -= deltaTime;
            
            // Initialize mirror movement at the start of countdown
            if (!this.mirrorsMovedToSun) {
                this.initializeMirrorMovement();
                this.mirrorsMovedToSun = true;
            }
            
            // End countdown when timer reaches 0
            if (this.countdownTime <= 0) {
                this.isCountdownActive = false;
                this.countdownTime = 0;
            }
        }

        // Update sun color particles for fractal color fading
        for (const sun of this.suns) {
            sun.updateColorParticles(deltaTime);
        }

        // Update asteroids
        for (const asteroid of this.asteroids) {
            asteroid.update(deltaTime);
        }

        if (!this.isCountdownActive) {
            this.updateAi(deltaTime);
        }

        // Update each player
        for (const player of this.players) {
            if (player.isDefeated()) {
                continue;
            }

            // Update light status for Stellar Forge
            if (player.stellarForge) {
                const oldForgePos = new Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns, this.asteroids, this.players);
                
                // Only allow forge movement after countdown
                if (!this.isCountdownActive) {
                    player.stellarForge.update(deltaTime, this); // Update forge movement with gameState
                    
                    // Check collision for forge (larger radius)
                    if (this.checkCollision(player.stellarForge.position, player.stellarForge.radius, player.stellarForge)) {
                        // Revert to old position and stop movement
                        player.stellarForge.position = oldForgePos;
                        player.stellarForge.targetPosition = null;
                        player.stellarForge.velocity = new Vector2D(0, 0);
                    }

                    this.applyDustPushFromMovingEntity(
                        player.stellarForge.position,
                        player.stellarForge.velocity,
                        Constants.FORGE_DUST_PUSH_RADIUS_PX,
                        Constants.FORGE_DUST_PUSH_FORCE_MULTIPLIER,
                        deltaTime
                    );
                }
                
                // Check for forge crunch (spawns minions with excess energy)
                if (!this.isCountdownActive) {
                    const energyForMinions = player.stellarForge.shouldCrunch();
                    if (energyForMinions > 0) {
                        // Calculate number of starlings to spawn based on energy
                        const numStarlings = Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY);
                        
                        // Spawn starlings at the wave edge during wave phase
                        for (let i = 0; i < numStarlings; i++) {
                            const angle = (Math.PI * 2 * i) / numStarlings; // Evenly distribute around forge
                            const spawnRadius = Constants.FORGE_CRUNCH_WAVE_RADIUS * 0.7; // Spawn at 70% of wave radius
                            const spawnPosition = new Vector2D(
                                player.stellarForge.position.x + Math.cos(angle) * spawnRadius,
                                player.stellarForge.position.y + Math.sin(angle) * spawnRadius
                            );
                            const starling = new Starling(spawnPosition, player, player.stellarForge?.minionPath ?? []);
                            player.units.push(starling);
                            player.unitsCreated++;
                        }
                        
                        if (numStarlings > 0) {
                            console.log(`${player.name} forge crunch spawned ${numStarlings} Starlings with ${energyForMinions.toFixed(0)} energy`);
                        }
                    }
                }

                if (!this.isCountdownActive) {
                    const completedHeroType = player.stellarForge.advanceHeroProduction(deltaTime);
                    if (completedHeroType) {
                        const spawnAngleRad = (player.unitsCreated % 8) * (Math.PI / 4);
                        const spawnRadius = player.stellarForge.radius + Constants.UNIT_RADIUS_PX + 5;
                        const spawnPosition = new Vector2D(
                            player.stellarForge.position.x + Math.cos(spawnAngleRad) * spawnRadius,
                            player.stellarForge.position.y + Math.sin(spawnAngleRad) * spawnRadius
                        );
                        const heroUnit = this.createHeroUnit(completedHeroType, spawnPosition, player);
                        if (heroUnit) {
                            player.units.push(heroUnit);
                            player.unitsCreated++;
                            console.log(`${player.name} forged hero ${completedHeroType}`);
                        }
                    }
                }
            }

            // Update solar mirrors - position and reflection angle
            // Mirrors can move during countdown to reach the sun
            for (const mirror of player.solarMirrors) {
                const oldMirrorPos = new Vector2D(mirror.position.x, mirror.position.y);
                mirror.update(deltaTime, this); // Update mirror movement with gameState
                
                // Check collision for mirror
                if (this.checkCollision(mirror.position, 20, mirror)) {
                    // Revert to old position and stop movement
                    mirror.position = oldMirrorPos;
                    mirror.targetPosition = null;
                    mirror.velocity = new Vector2D(0, 0);
                }

                this.applyDustPushFromMovingEntity(
                    mirror.position,
                    mirror.velocity,
                    Constants.MIRROR_DUST_PUSH_RADIUS_PX,
                    Constants.MIRROR_DUST_PUSH_FORCE_MULTIPLIER,
                    deltaTime
                );
                
                mirror.updateReflectionAngle(player.stellarForge, this.suns, this.asteroids, deltaTime);
                
                // Generate energy even during countdown once mirrors reach position
                if (mirror.hasLineOfSightToLight(this.suns, this.asteroids) &&
                    player.stellarForge &&
                    mirror.hasLineOfSightToForge(player.stellarForge, this.asteroids, this.players)) {
                    const energyGenerated = mirror.generateEnergy(deltaTime);
                    // Add to forge's pending energy pool for next crunch
                    player.stellarForge.addPendingEnergy(energyGenerated);
                }
            }
        }

        // Update space dust particles
        this.updateSpaceDust(deltaTime);

        // Update units and collect enemies for targeting
        const allUnits: Unit[] = [];
        const allStructures: StellarForge[] = [];
        
        for (const player of this.players) {
            if (!player.isDefeated()) {
                allUnits.push(...player.units);
                if (player.stellarForge) {
                    allStructures.push(player.stellarForge);
                }
            }
        }

        // Update each player's units
        for (const player of this.players) {
            if (player.isDefeated()) continue;

            // Get enemies (units and structures not owned by this player)
            const enemies: (Unit | StellarForge | Building)[] = [];
            for (const otherPlayer of this.players) {
                if (otherPlayer !== player && !otherPlayer.isDefeated()) {
                    enemies.push(...otherPlayer.units);
                    enemies.push(...otherPlayer.buildings);
                    if (otherPlayer.stellarForge) {
                        enemies.push(otherPlayer.stellarForge);
                    }
                }
            }

            // Update each unit (only after countdown)
            if (!this.isCountdownActive) {
                for (const unit of player.units) {
                    // Starlings need special AI update before regular update
                    if (unit instanceof Starling) {
                        unit.updateAI(this, enemies);
                    }
                    
                    unit.update(deltaTime, enemies, allUnits, this.asteroids);

                    if (unit instanceof Starling) {
                        this.applyDustPushFromMovingEntity(
                            unit.position,
                            unit.velocity,
                            Constants.STARLING_DUST_PUSH_RADIUS_PX,
                            Constants.STARLING_DUST_PUSH_FORCE_MULTIPLIER,
                            deltaTime
                        );
                    }
                    
                    // Apply fluid forces from Grave projectiles
                    if (unit instanceof Grave) {
                        for (const projectile of unit.getProjectiles()) {
                            if (projectile.isAttacking) {
                                // Attacking projectiles push dust as they fly
                                const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
                                this.applyFluidForceFromMovingObject(
                                    projectile.position,
                                    projectile.velocity,
                                    Constants.GRAVE_PROJECTILE_EFFECT_RADIUS,
                                    projectileSpeed * Constants.GRAVE_PROJECTILE_FORCE_MULTIPLIER,
                                    deltaTime
                                );
                            }
                        }
                    }

                // If unit is a Marine, collect its effects
                if (unit instanceof Marine) {
                    const effects = unit.getAndClearLastShotEffects();
                    if (effects.muzzleFlash) {
                        this.muzzleFlashes.push(effects.muzzleFlash);
                    }
                    if (effects.casing) {
                        this.bulletCasings.push(effects.casing);
                    }
                    if (effects.bouncingBullet) {
                        this.bouncingBullets.push(effects.bouncingBullet);
                    }
                }

                // Collect ability effects from all units
                const abilityEffects = unit.getAndClearLastAbilityEffects();
                this.abilityBullets.push(...abilityEffects);

                if (unit instanceof Starling) {
                    const projectiles = unit.getAndClearLastShotProjectiles();
                    if (projectiles.length > 0) {
                        this.minionProjectiles.push(...projectiles);
                    }
                }
                
                // Handle InfluenceBall projectiles specifically
                if (unit instanceof InfluenceBall) {
                    const projectile = unit.getAndClearProjectile();
                    if (projectile) {
                        this.influenceBallProjectiles.push(projectile);
                    }
                }
                
                // Handle Ray beam updates
                if (unit instanceof Ray) {
                    unit.updateBeamSegments(deltaTime);
                    
                    // Apply fluid forces from active beam segments
                    for (const segment of unit.getBeamSegments()) {
                        this.applyFluidForceFromBeam(
                            segment.startPos,
                            segment.endPos,
                            Constants.BEAM_EFFECT_RADIUS,
                            Constants.BEAM_FORCE_STRENGTH,
                            deltaTime
                        );
                    }
                    
                    // Process Ray ability if just used (check if cooldown is near max)
                    if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1 && unit.drillDirection) {
                        this.processRayBeamAbility(unit);
                        unit.drillDirection = null; // Clear after processing
                    }
                }
                
                // Handle TurretDeployer ability
                if (unit instanceof TurretDeployer) {
                    // Check if ability was just used (check if cooldown is near max)
                    if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1) {
                        this.processTurretDeployment(unit);
                    }
                }
                
                // Handle Driller movement and collision
                if (unit instanceof Driller && unit.isDrilling) {
                    unit.updateDrilling(deltaTime);
                    this.processDrillerCollisions(unit, deltaTime);
                }
                
                // Handle Dagger timers
                if (unit instanceof Dagger) {
                    unit.updateTimers(deltaTime);
                }
                
                // Handle Grave projectile deflection
                if (unit instanceof Grave) {
                    for (const projectile of unit.getProjectiles()) {
                        if (projectile.isAttacking) {
                            // Check for deflection by Space Dust Swirler buildings
                            for (const player of this.players) {
                                for (const building of player.buildings) {
                                    if (building instanceof SpaceDustSwirler) {
                                        building.deflectProjectile(projectile);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            } // End of countdown check

            // Remove dead units and track losses
            const deadUnits = player.units.filter(unit => unit.isDead());
            player.unitsLost += deadUnits.length;
            player.units = player.units.filter(unit => !unit.isDead());

            // Update each building (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    building.update(deltaTime, enemies, allUnits);

                // If building is a Minigun, collect its effects
                if (building instanceof Minigun) {
                    const effects = building.getAndClearLastShotEffects();
                    if (effects.muzzleFlash) {
                        this.muzzleFlashes.push(effects.muzzleFlash);
                    }
                    if (effects.casing) {
                        this.bulletCasings.push(effects.casing);
                    }
                    if (effects.bouncingBullet) {
                        this.bouncingBullets.push(effects.bouncingBullet);
                    }
                }
            }
            } // End of countdown check for buildings

            // Update building construction (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    if (building.isComplete) continue; // Skip completed buildings
                
                // Check if building is inside player's influence (near stellar forge)
                const isInInfluence = player.stellarForge && 
                                     building.position.distanceTo(player.stellarForge.position) <= Constants.INFLUENCE_RADIUS;
                
                if (isInInfluence && player.stellarForge) {
                    // Building inside influence: take energy from forge
                    // Calculate build progress per second (inverse of build time)
                    const buildRate = 1.0 / Constants.BUILDING_BUILD_TIME;
                    const buildProgress = buildRate * deltaTime;
                    
                    // TODO: Split energy between buildings and hero units
                    // For now, buildings get energy if available
                    building.addBuildProgress(buildProgress);
                } else {
                    // Building outside influence: powered by mirrors shining on it
                    // Calculate total light from all mirrors pointing at this building
                    let totalLight = 0;
                    
                    for (const mirror of player.solarMirrors) {
                        // Check if mirror has line of sight to light source
                        if (!mirror.hasLineOfSightToLight(this.suns, this.asteroids)) continue;
                        
                        // Check if mirror has line of sight to building
                        const ray = new LightRay(
                            mirror.position,
                            new Vector2D(
                                building.position.x - mirror.position.x,
                                building.position.y - mirror.position.y
                            ).normalize(),
                            1.0
                        );
                        
                        let hasLineOfSight = true;
                        for (const asteroid of this.asteroids) {
                            if (ray.intersectsPolygon(asteroid.getWorldVertices())) {
                                hasLineOfSight = false;
                                break;
                            }
                        }
                        
                        if (hasLineOfSight) {
                            // Mirror can shine on building - calculate efficiency based on distance from light
                            const closestSun = this.suns.reduce((closest, sun) => {
                                const distToSun = mirror.position.distanceTo(sun.position);
                                const distToClosest = closest ? mirror.position.distanceTo(closest.position) : Infinity;
                                return distToSun < distToClosest ? sun : closest;
                            }, null as Sun | null);
                            
                            if (closestSun) {
                                const distanceToSun = mirror.position.distanceTo(closestSun.position);
                                const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER * (1.0 - Math.min(1.0, distanceToSun / Constants.MIRROR_MAX_GLOW_DISTANCE)));
                                totalLight += distanceMultiplier;
                            }
                        }
                    }
                    
                    // Convert light to build progress
                    if (totalLight > 0) {
                        const buildRate = (totalLight / 10.0) * (1.0 / Constants.BUILDING_BUILD_TIME);
                        const buildProgress = buildRate * deltaTime;
                        building.addBuildProgress(buildProgress);
                    }
                }
            }
            } // End of countdown check for building construction

            // Remove destroyed buildings
            player.buildings = player.buildings.filter(building => !building.isDestroyed());
        }

        if (!this.isCountdownActive) {
            this.resolveUnitCollisions(allUnits);
            this.resolveUnitObstacleCollisions(allUnits);
        }

        this.stateHashTickCounter += 1;
        if (this.stateHashTickCounter % Constants.STATE_HASH_TICK_INTERVAL === 0) {
            this.updateStateHash();
        }

        // Update muzzle flashes
        for (const flash of this.muzzleFlashes) {
            flash.update(deltaTime);
        }
        this.muzzleFlashes = this.muzzleFlashes.filter(flash => !flash.shouldDespawn());

        // Update bullet casings and interact with space dust
        for (const casing of this.bulletCasings) {
            casing.update(deltaTime);

            // Check collision with space dust particles
            for (const particle of this.spaceDust) {
                const distance = casing.position.distanceTo(particle.position);
                if (distance < Constants.CASING_SPACEDUST_COLLISION_DISTANCE) {
                    // Apply force to both casing and particle
                    const direction = new Vector2D(
                        particle.position.x - casing.position.x,
                        particle.position.y - casing.position.y
                    ).normalize();
                    
                    particle.applyForce(new Vector2D(
                        direction.x * Constants.CASING_SPACEDUST_FORCE,
                        direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));
                    
                    // Apply counter-force to casing (damping applied in applyCollision method)
                    casing.applyCollision(new Vector2D(
                        -direction.x * Constants.CASING_SPACEDUST_FORCE,
                        -direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));
                }
            }
        }
        this.bulletCasings = this.bulletCasings.filter(casing => !casing.shouldDespawn());

        // Update bouncing bullets
        for (const bullet of this.bouncingBullets) {
            bullet.update(deltaTime);
        }
        this.bouncingBullets = this.bouncingBullets.filter(bullet => !bullet.shouldDespawn());

        // Update ability bullets and check for hits
        for (const bullet of this.abilityBullets) {
            bullet.update(deltaTime);
            
            // Apply fluid-like force to space dust particles
            const bulletSpeed = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                bullet.position,
                bullet.velocity,
                Constants.ABILITY_BULLET_EFFECT_RADIUS,
                bulletSpeed * Constants.ABILITY_BULLET_FORCE_MULTIPLIER,
                deltaTime
            );

            // Check hits against enemies
            for (const player of this.players) {
                // Skip if same team as bullet
                if (player === bullet.owner) {
                    continue;
                }

                // Check hits on units
                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        let finalDamage = bullet.damage;
                        
                        // Check if this is a Beam projectile for distance-based damage
                        if (bullet.isBeamProjectile && bullet.beamOwner) {
                            const beamOwner = bullet.beamOwner;
                            const distance = beamOwner.position.distanceTo(unit.position);
                            const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                            finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);
                            
                            // Store info for display above Beam unit
                            beamOwner.lastBeamDamage = finalDamage;
                            beamOwner.lastBeamDistance = distance;
                            beamOwner.lastBeamMultiplier = multiplier;
                            beamOwner.lastBeamTime = this.gameTime;
                        }
                        
                        unit.takeDamage(finalDamage);
                        // Create damage number
                        this.damageNumbers.push(new DamageNumber(
                            unit.position,
                            finalDamage,
                            this.gameTime,
                            unit.maxHealth
                        ));
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }

                // Check hits on Stellar Forge
                if (player.stellarForge && bullet.checkHit(player.stellarForge)) {
                    let finalDamage = bullet.damage;
                    
                    // Check if this is a Beam projectile for distance-based damage
                    if (bullet.isBeamProjectile && bullet.beamOwner) {
                        const beamOwner = bullet.beamOwner;
                        const distance = beamOwner.position.distanceTo(player.stellarForge.position);
                        const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                        finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);
                        
                        // Store info for display above Beam unit
                        beamOwner.lastBeamDamage = finalDamage;
                        beamOwner.lastBeamDistance = distance;
                        beamOwner.lastBeamMultiplier = multiplier;
                        beamOwner.lastBeamTime = this.gameTime;
                    }
                    
                    player.stellarForge.health -= finalDamage;
                    // Create damage number
                    this.damageNumbers.push(new DamageNumber(
                        player.stellarForge.position,
                        finalDamage,
                        this.gameTime,
                        Constants.STELLAR_FORGE_MAX_HEALTH
                    ));
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                }
            }
        }
        this.abilityBullets = this.abilityBullets.filter(bullet => !bullet.shouldDespawn());

        // Update minion projectiles and check for hits
        for (const projectile of this.minionProjectiles) {
            projectile.update(deltaTime);
            
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                projectile.position,
                projectile.velocity,
                Constants.MINION_PROJECTILE_EFFECT_RADIUS,
                projectileSpeed * Constants.MINION_PROJECTILE_FORCE_MULTIPLIER,
                deltaTime
            );

            // Check for deflection by Space Dust Swirler buildings
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        building.deflectProjectile(projectile);
                    }
                }
            }

            let hasHit = false;

            for (const player of this.players) {
                if (player === projectile.owner) {
                    continue;
                }

                for (const unit of player.units) {
                    if (projectile.checkHit(unit)) {
                        unit.takeDamage(projectile.damage);
                        // Create damage number
                        this.damageNumbers.push(new DamageNumber(
                            unit.position,
                            projectile.damage,
                            this.gameTime,
                            unit.maxHealth
                        ));
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                for (const building of player.buildings) {
                    if (projectile.checkHit(building)) {
                        building.health -= projectile.damage;
                        // Create damage number
                        this.damageNumbers.push(new DamageNumber(
                            building.position,
                            projectile.damage,
                            this.gameTime,
                            building.maxHealth
                        ));
                        hasHit = true;
                        break;
                    }
                }

                if (hasHit) {
                    break;
                }

                if (player.stellarForge && projectile.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= projectile.damage;
                    // Create damage number
                    this.damageNumbers.push(new DamageNumber(
                        player.stellarForge.position,
                        projectile.damage,
                        this.gameTime,
                        Constants.STELLAR_FORGE_MAX_HEALTH
                    ));
                    hasHit = true;
                    break;
                }
            }

            if (hasHit) {
                projectile.distanceTraveledPx = projectile.maxRangePx;
            }
        }
        this.minionProjectiles = this.minionProjectiles.filter(projectile => !projectile.shouldDespawn());
        
        // Update influence zones
        this.influenceZones = this.influenceZones.filter(zone => !zone.update(deltaTime));
        
        // Update influence ball projectiles
        for (const projectile of this.influenceBallProjectiles) {
            projectile.update(deltaTime);
            
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                projectile.position,
                projectile.velocity,
                Constants.INFLUENCE_BALL_EFFECT_RADIUS,
                projectileSpeed * Constants.INFLUENCE_BALL_FORCE_MULTIPLIER,
                deltaTime
            );

            // Check for deflection by Space Dust Swirler buildings
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        building.deflectProjectile(projectile);
                    }
                }
            }
            
            // Check if should explode (max lifetime reached)
            if (projectile.shouldExplode()) {
                // Create influence zone
                const zone = new InfluenceZone(
                    new Vector2D(projectile.position.x, projectile.position.y),
                    projectile.owner
                );
                this.influenceZones.push(zone);
            }
        }
        this.influenceBallProjectiles = this.influenceBallProjectiles.filter(p => !p.shouldExplode());
        
        // Update deployed turrets
        const allUnitsAndStructures: (Unit | StellarForge | Building)[] = [];
        for (const player of this.players) {
            if (!player.isDefeated()) {
                allUnitsAndStructures.push(...player.units);
                allUnitsAndStructures.push(...player.buildings);
                if (player.stellarForge) {
                    allUnitsAndStructures.push(player.stellarForge);
                }
            }
        }
        
        for (const turret of this.deployedTurrets) {
            // Get enemies for this turret
            const enemies = allUnitsAndStructures.filter(e => {
                if (e instanceof Unit || e instanceof Building) {
                    return e.owner !== turret.owner;
                } else if (e instanceof StellarForge) {
                    return e.owner !== turret.owner;
                }
                return false;
            });
            
            turret.update(deltaTime, enemies);
        }
        this.deployedTurrets = this.deployedTurrets.filter(turret => !turret.isDead());

        // Update damage numbers
        for (const damageNumber of this.damageNumbers) {
            damageNumber.update(deltaTime);
        }
        // Remove expired damage numbers
        this.damageNumbers = this.damageNumbers.filter(dn => !dn.isExpired(this.gameTime));
    }

    /**
     * Update space dust particles with physics and color influences
     */
    private updateSpaceDust(deltaTime: number): void {
        this.applyDustRepulsion(deltaTime);

        for (const particle of this.spaceDust) {
            // Update particle position
            particle.update(deltaTime);

            // Check for influence from player bases
            let closestInfluence: { color: string, distance: number } | null = null;

            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (player.stellarForge && !player.isDefeated()) {
                    const distance = particle.position.distanceTo(player.stellarForge.position);
                    
                    if (distance < Constants.INFLUENCE_RADIUS) {
                        const color = i === 0 ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                        if (!closestInfluence || distance < closestInfluence.distance) {
                            closestInfluence = { color, distance };
                        }
                    }
                }
            }

            // Update particle color based on influence
            if (closestInfluence) {
                const blendFactor = 1.0 - (closestInfluence.distance / Constants.INFLUENCE_RADIUS);
                particle.updateColor(closestInfluence.color, blendFactor);
            } else {
                particle.updateColor(null, 0);
            }
        }

        // Apply forces from warp gates (spiral effect)
        for (const gate of this.warpGates) {
            if (gate.isCharging && gate.chargeTime >= Constants.WARP_GATE_INITIAL_DELAY) {
                for (const particle of this.spaceDust) {
                    const distance = particle.position.distanceTo(gate.position);
                    if (distance < Constants.WARP_GATE_SPIRAL_RADIUS && distance > Constants.WARP_GATE_SPIRAL_MIN_DISTANCE) {
                        // Calculate spiral force
                        const direction = new Vector2D(
                            gate.position.x - particle.position.x,
                            gate.position.y - particle.position.y
                        ).normalize();
                        
                        // Add tangential component for spiral
                        const tangent = new Vector2D(-direction.y, direction.x);
                        const force = new Vector2D(
                            direction.x * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.x * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT,
                            direction.y * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.y * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT
                        );
                        
                        particle.applyForce(new Vector2D(
                            force.x * deltaTime / distance,
                            force.y * deltaTime / distance
                        ));
                    }
                }
            }
        }

        // Apply forces from forge crunches (suck in, then wave out)
        for (const player of this.players) {
            if (player.stellarForge && !player.isDefeated()) {
                const crunch = player.stellarForge.getCurrentCrunch();
                if (crunch && crunch.isActive()) {
                    for (const particle of this.spaceDust) {
                        const distance = particle.position.distanceTo(crunch.position);
                        
                        if (crunch.phase === 'suck' && distance < Constants.FORGE_CRUNCH_SUCK_RADIUS) {
                            // Suck phase: pull dust toward forge
                            if (distance > 5) { // Minimum distance to avoid division by zero
                                const direction = new Vector2D(
                                    crunch.position.x - particle.position.x,
                                    crunch.position.y - particle.position.y
                                ).normalize();
                                
                                // Force decreases with distance
                                const forceMagnitude = Constants.FORGE_CRUNCH_SUCK_FORCE / Math.sqrt(distance);
                                particle.applyForce(new Vector2D(
                                    direction.x * forceMagnitude * deltaTime,
                                    direction.y * forceMagnitude * deltaTime
                                ));
                            }
                        } else if (crunch.phase === 'wave' && distance < Constants.FORGE_CRUNCH_WAVE_RADIUS) {
                            // Wave phase: push dust away from forge
                            if (distance > 5) { // Minimum distance to avoid division by zero
                                const direction = new Vector2D(
                                    particle.position.x - crunch.position.x,
                                    particle.position.y - crunch.position.y
                                ).normalize();
                                
                                // Wave effect: stronger push at the wavefront
                                const waveProgress = crunch.getPhaseProgress();
                                const wavePosition = waveProgress * Constants.FORGE_CRUNCH_WAVE_RADIUS;
                                const distanceToWave = Math.abs(distance - wavePosition);
                                const waveSharpness = 50; // How focused the wave is
                                const waveStrength = Math.exp(-distanceToWave / waveSharpness);
                                
                                const forceMagnitude = Constants.FORGE_CRUNCH_WAVE_FORCE * waveStrength;
                                particle.applyForce(new Vector2D(
                                    direction.x * forceMagnitude * deltaTime,
                                    direction.y * forceMagnitude * deltaTime
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Apply forces from Space Dust Swirler buildings (counter-clockwise orbits)
        for (const player of this.players) {
            for (const building of player.buildings) {
                if (building instanceof SpaceDustSwirler) {
                    building.applyDustSwirl(this.spaceDust, deltaTime);
                }
            }
        }
    }

    private applyDustRepulsion(deltaTime: number): void {
        const cellSize = Constants.DUST_REPULSION_CELL_SIZE_PX;
        const repulsionRadiusPx = Constants.DUST_REPULSION_RADIUS_PX;
        const repulsionRadiusSq = repulsionRadiusPx * repulsionRadiusPx;
        const repulsionStrength = Constants.DUST_REPULSION_STRENGTH;

        for (let i = 0; i < this.dustSpatialHashKeys.length; i++) {
            const key = this.dustSpatialHashKeys[i];
            const bucket = this.dustSpatialHash.get(key);
            if (bucket) {
                bucket.length = 0;
            }
        }
        this.dustSpatialHashKeys.length = 0;

        for (let i = 0; i < this.spaceDust.length; i++) {
            const particle = this.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            const key = (cellX << 16) ^ (cellY & 0xffff);
            let bucket = this.dustSpatialHash.get(key);
            if (!bucket) {
                bucket = [];
                this.dustSpatialHash.set(key, bucket);
            }
            if (bucket.length === 0) {
                this.dustSpatialHashKeys.push(key);
            }
            bucket.push(i);
        }

        for (let i = 0; i < this.spaceDust.length; i++) {
            const particle = this.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            let forceX = 0;
            let forceY = 0;

            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const neighborKey = ((cellX + offsetX) << 16) ^ ((cellY + offsetY) & 0xffff);
                    const bucket = this.dustSpatialHash.get(neighborKey);
                    if (!bucket) {
                        continue;
                    }

                    for (let j = 0; j < bucket.length; j++) {
                        const neighborIndex = bucket[j];
                        if (neighborIndex === i) {
                            continue;
                        }
                        const neighbor = this.spaceDust[neighborIndex];
                        const dx = particle.position.x - neighbor.position.x;
                        const dy = particle.position.y - neighbor.position.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > 0 && distSq < repulsionRadiusSq) {
                            const dist = Math.sqrt(distSq);
                            const strength = (1 - dist / repulsionRadiusPx) * repulsionStrength;
                            forceX += (dx / dist) * strength;
                            forceY += (dy / dist) * strength;
                        }
                    }
                }
            }

            if (forceX !== 0 || forceY !== 0) {
                particle.velocity.x += forceX * deltaTime;
                particle.velocity.y += forceY * deltaTime;
            }
        }
    }

    private updateAi(deltaTime: number): void {
        for (const player of this.players) {
            if (!player.isAi || player.isDefeated()) {
                continue;
            }

            const enemies = this.getEnemiesForPlayer(player);
            this.updateAiMirrorsForPlayer(player);
            this.updateAiMirrorPurchaseForPlayer(player);
            this.updateAiDefenseForPlayer(player, enemies);
            this.updateAiHeroProductionForPlayer(player);
            this.updateAiStructuresForPlayer(player, enemies);
        }
    }

    private getEnemiesForPlayer(player: Player): (Unit | StellarForge | Building)[] {
        const enemies: (Unit | StellarForge | Building)[] = [];
        for (const otherPlayer of this.players) {
            if (otherPlayer !== player && !otherPlayer.isDefeated()) {
                enemies.push(...otherPlayer.units);
                enemies.push(...otherPlayer.buildings);
                if (otherPlayer.stellarForge) {
                    enemies.push(otherPlayer.stellarForge);
                }
            }
        }
        return enemies;
    }

    private updateAiMirrorsForPlayer(player: Player): void {
        if (this.gameTime < player.aiNextMirrorCommandSec) {
            return;
        }
        player.aiNextMirrorCommandSec = this.gameTime + Constants.AI_MIRROR_COMMAND_INTERVAL_SEC;

        if (!player.stellarForge || player.solarMirrors.length === 0) {
            return;
        }

        const sun = this.getClosestSunToPoint(player.stellarForge.position);
        if (!sun) {
            return;
        }

        const mirrorCount = player.solarMirrors.length;
        const baseAngleRad = Math.atan2(
            player.stellarForge.position.y - sun.position.y,
            player.stellarForge.position.x - sun.position.x
        );
        const startAngleRad = baseAngleRad - (Constants.AI_MIRROR_ARC_SPACING_RAD * (mirrorCount - 1)) / 2;
        const radiusPx = sun.radius + Constants.AI_MIRROR_SUN_DISTANCE_PX;

        for (let i = 0; i < mirrorCount; i++) {
            const mirror = player.solarMirrors[i];
            const angleRad = startAngleRad + Constants.AI_MIRROR_ARC_SPACING_RAD * i;
            const target = new Vector2D(
                sun.position.x + Math.cos(angleRad) * radiusPx,
                sun.position.y + Math.sin(angleRad) * radiusPx
            );
            const distance = mirror.position.distanceTo(target);
            if (distance > Constants.AI_MIRROR_REPOSITION_THRESHOLD_PX) {
                mirror.setTarget(target);
            }
        }
    }

    private updateAiMirrorPurchaseForPlayer(player: Player): void {
        if (this.gameTime < player.aiNextMirrorPurchaseCommandSec) {
            return;
        }
        player.aiNextMirrorPurchaseCommandSec = this.gameTime + Constants.AI_MIRROR_PURCHASE_INTERVAL_SEC;

        // Check if we should buy more mirrors based on strategy
        if (!player.stellarForge) {
            return;
        }

        const currentMirrorCount = player.solarMirrors.length;
        
        // Determine mirror count target based on AI strategy
        let targetMirrorCount = 2; // Default minimum
        switch (player.aiStrategy) {
            case Constants.AIStrategy.ECONOMIC:
                targetMirrorCount = Constants.AI_MAX_MIRRORS; // Max out mirrors
                break;
            case Constants.AIStrategy.DEFENSIVE:
                targetMirrorCount = 4; // Moderate mirrors for balanced economy
                break;
            case Constants.AIStrategy.AGGRESSIVE:
                targetMirrorCount = 3; // Fewer mirrors, spend on units
                break;
            case Constants.AIStrategy.WAVES:
                targetMirrorCount = 4; // Need economy for wave production
                break;
        }

        // Don't buy more mirrors than target
        if (currentMirrorCount >= targetMirrorCount) {
            return;
        }

        // Check if we can afford a mirror
        if (player.energy < Constants.SOLAR_MIRROR_COST) {
            return;
        }

        // Find a good position for the new mirror
        const sun = this.getClosestSunToPoint(player.stellarForge.position);
        if (!sun) {
            return;
        }

        // Calculate position around the sun
        const baseAngleRad = Math.atan2(
            player.stellarForge.position.y - sun.position.y,
            player.stellarForge.position.x - sun.position.x
        );
        const mirrorIndex = currentMirrorCount;
        const startAngleRad = baseAngleRad - (Constants.AI_MIRROR_ARC_SPACING_RAD * targetMirrorCount) / 2;
        const angleRad = startAngleRad + Constants.AI_MIRROR_ARC_SPACING_RAD * mirrorIndex;
        const radiusPx = sun.radius + Constants.AI_MIRROR_SUN_DISTANCE_PX;
        
        const mirrorPosition = new Vector2D(
            sun.position.x + Math.cos(angleRad) * radiusPx,
            sun.position.y + Math.sin(angleRad) * radiusPx
        );

        // Purchase the mirror
        if (player.spendEnergy(Constants.SOLAR_MIRROR_COST)) {
            const newMirror = new SolarMirror(mirrorPosition, player);
            player.solarMirrors.push(newMirror);
        }
    }

    private updateAiDefenseForPlayer(
        player: Player,
        enemies: (Unit | StellarForge | Building)[]
    ): void {
        if (this.gameTime < player.aiNextDefenseCommandSec) {
            return;
        }
        player.aiNextDefenseCommandSec = this.gameTime + Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC;

        const threat = this.findAiThreat(player, enemies);

        if (threat) {
            const threatPosition = threat.enemy.position;
            for (const unit of player.units) {
                if (unit.isHero) {
                    unit.rallyPoint = new Vector2D(threatPosition.x, threatPosition.y);
                } else if (unit instanceof Starling) {
                    unit.setManualRallyPoint(new Vector2D(threatPosition.x, threatPosition.y));
                }
            }
            return;
        }

        if (!player.stellarForge) {
            return;
        }

        // Strategy-based defense behavior
        if (player.aiStrategy === Constants.AIStrategy.WAVES) {
            // Waves strategy: Accumulate units at base until reaching threshold
            const unitCount = player.units.length;
            const waveThreshold = Constants.AI_WAVES_ATTACK_THRESHOLD;
            
            if (unitCount >= waveThreshold) {
                // Send all units to attack enemy base
                const enemyForge = this.getEnemyForgeForPlayer(player);
                if (enemyForge) {
                    for (const unit of player.units) {
                        if (unit.isHero || unit instanceof Starling) {
                            unit.rallyPoint = new Vector2D(enemyForge.position.x, enemyForge.position.y);
                            if (unit instanceof Starling) {
                                unit.setManualRallyPoint(new Vector2D(enemyForge.position.x, enemyForge.position.y));
                            }
                        }
                    }
                    return;
                }
            } else {
                // Accumulate at base
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new Vector2D(
                            player.stellarForge.position.x,
                            player.stellarForge.position.y
                        );
                    } else if (unit instanceof Starling) {
                        unit.setManualRallyPoint(new Vector2D(
                            player.stellarForge.position.x,
                            player.stellarForge.position.y
                        ));
                    }
                }
                return;
            }
        } else if (player.aiStrategy === Constants.AIStrategy.AGGRESSIVE) {
            // Aggressive strategy: Always push to enemy base
            const enemyForge = this.getEnemyForgeForPlayer(player);
            if (enemyForge) {
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new Vector2D(enemyForge.position.x, enemyForge.position.y);
                    } else if (unit instanceof Starling) {
                        unit.setManualRallyPoint(new Vector2D(enemyForge.position.x, enemyForge.position.y));
                    }
                }
                return;
            }
        }

        // Default behavior (for ECONOMIC and DEFENSIVE): Defend mirrors and base
        const mirrorCount = player.solarMirrors.length;
        let mirrorIndex = 0;

        for (const unit of player.units) {
            if (unit.isHero) {
                unit.rallyPoint = new Vector2D(
                    player.stellarForge.position.x,
                    player.stellarForge.position.y
                );
            } else if (unit instanceof Starling) {
                if (mirrorIndex < mirrorCount) {
                    const mirror = player.solarMirrors[mirrorIndex];
                    unit.setManualRallyPoint(new Vector2D(mirror.position.x, mirror.position.y));
                    mirrorIndex += 1;
                } else {
                    unit.setManualRallyPoint(new Vector2D(
                        player.stellarForge.position.x,
                        player.stellarForge.position.y
                    ));
                }
            }
        }
    }
    
    private getEnemyForgeForPlayer(player: Player): StellarForge | null {
        for (const otherPlayer of this.players) {
            if (otherPlayer !== player && !otherPlayer.isDefeated() && otherPlayer.stellarForge) {
                return otherPlayer.stellarForge;
            }
        }
        return null;
    }

    private updateAiHeroProductionForPlayer(player: Player): void {
        if (this.gameTime < player.aiNextHeroCommandSec) {
            return;
        }
        
        // Strategy-based hero production intervals
        let heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC;
        switch (player.aiStrategy) {
            case Constants.AIStrategy.AGGRESSIVE:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_AGGRESSIVE_HERO_MULTIPLIER;
                break;
            case Constants.AIStrategy.ECONOMIC:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_ECONOMIC_HERO_MULTIPLIER;
                break;
            case Constants.AIStrategy.WAVES:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_WAVES_HERO_MULTIPLIER;
                break;
            default:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC;
        }
        
        player.aiNextHeroCommandSec = this.gameTime + heroProductionInterval;

        if (!player.stellarForge || !player.stellarForge.canProduceUnits()) {
            return;
        }

        const heroTypes = this.getAiHeroTypesForFaction(player.faction);
        for (const heroType of heroTypes) {
            if (this.isHeroUnitAlive(player, heroType)) {
                continue;
            }
            if (this.isHeroUnitQueuedOrProducing(player.stellarForge, heroType)) {
                continue;
            }
            if (!player.spendEnergy(Constants.HERO_UNIT_COST)) {
                return;
            }
            player.stellarForge.enqueueHeroUnit(heroType);
            player.stellarForge.startHeroProductionIfIdle();
            return;
        }
    }

    private updateAiStructuresForPlayer(
        player: Player,
        enemies: (Unit | StellarForge | Building)[]
    ): void {
        if (this.gameTime < player.aiNextStructureCommandSec) {
            return;
        }
        player.aiNextStructureCommandSec = this.gameTime + Constants.AI_STRUCTURE_COMMAND_INTERVAL_SEC;

        if (!player.stellarForge) {
            return;
        }

        const minigunCount = player.buildings.filter((building) => building instanceof Minigun).length;
        const swirlerCount = player.buildings.filter((building) => building instanceof SpaceDustSwirler).length;
        const hasSubsidiaryFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);

        let buildType: 'minigun' | 'swirler' | 'subsidiaryFactory' | null = null;
        
        // Strategy-based building priorities
        switch (player.aiStrategy) {
            case Constants.AIStrategy.ECONOMIC:
                // Economic: Build factory first, then minimal defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                break;
                
            case Constants.AIStrategy.DEFENSIVE:
                // Defensive: Prioritize defenses heavily
                if (swirlerCount < 2 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (minigunCount < 5 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.AGGRESSIVE:
                // Aggressive: Build factory early, skip most defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.WAVES:
                // Waves: Balanced approach with factory priority
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (minigunCount < 2 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
        }

        if (!buildType) {
            return;
        }

        const threat = this.findAiThreat(player, enemies);
        const anchor = threat?.guardPoint ?? this.getAiStructureAnchor(player);
        if (!anchor) {
            return;
        }

        let placement: Vector2D | null = null;

        switch (buildType) {
            case 'subsidiaryFactory':
                placement = this.findAiStructurePlacement(anchor, Constants.SUBSIDIARY_FACTORY_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                    player.buildings.push(new SubsidiaryFactory(placement, player));
                }
                break;
            case 'swirler':
                placement = this.findAiStructurePlacement(anchor, Constants.SWIRLER_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SWIRLER_COST)) {
                    player.buildings.push(new SpaceDustSwirler(placement, player));
                }
                break;
            case 'minigun':
                placement = this.findAiStructurePlacement(anchor, Constants.MINIGUN_RADIUS, player);
                if (placement && player.spendEnergy(Constants.MINIGUN_COST)) {
                    player.buildings.push(new Minigun(placement, player));
                }
                break;
        }
    }

    private getAiStructureAnchor(player: Player): Vector2D | null {
        if (!player.stellarForge) {
            return null;
        }

        if (player.solarMirrors.length === 0 || this.suns.length === 0) {
            return player.stellarForge.position;
        }

        let bestMirror: SolarMirror | null = null;
        let bestDistance = Infinity;
        for (const mirror of player.solarMirrors) {
            const closestSun = mirror.getClosestSun(this.suns);
            if (!closestSun) {
                continue;
            }
            const distance = mirror.position.distanceTo(closestSun.position);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMirror = mirror;
            }
        }

        return bestMirror ? bestMirror.position : player.stellarForge.position;
    }

    private findAiStructurePlacement(anchor: Vector2D, radiusPx: number, player: Player): Vector2D | null {
        const baseAngleRad = player.buildings.length * Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD;
        const distancePx = Constants.AI_STRUCTURE_PLACEMENT_DISTANCE_PX + radiusPx;
        for (let i = 0; i < 8; i++) {
            const angleRad = baseAngleRad + Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD * i;
            const candidate = new Vector2D(
                anchor.x + Math.cos(angleRad) * distancePx,
                anchor.y + Math.sin(angleRad) * distancePx
            );
            if (!this.checkCollision(candidate, radiusPx)) {
                return candidate;
            }
        }
        return null;
    }

    private findAiThreat(
        player: Player,
        enemies: (Unit | StellarForge | Building)[]
    ): { enemy: Unit | StellarForge | Building; guardPoint: Vector2D } | null {
        if (!player.stellarForge) {
            return null;
        }

        const guardPoints: Vector2D[] = [player.stellarForge.position];
        for (const mirror of player.solarMirrors) {
            guardPoints.push(mirror.position);
        }

        let closestThreat: Unit | StellarForge | Building | null = null;
        let closestGuardPoint: Vector2D | null = null;
        let closestDistanceSq = Infinity;
        const defenseRadiusSq = Constants.AI_DEFENSE_RADIUS_PX * Constants.AI_DEFENSE_RADIUS_PX;

        for (const guardPoint of guardPoints) {
            for (const enemy of enemies) {
                if ('health' in enemy && enemy.health <= 0) {
                    continue;
                }
                const dx = enemy.position.x - guardPoint.x;
                const dy = enemy.position.y - guardPoint.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq <= defenseRadiusSq && distanceSq < closestDistanceSq) {
                    closestDistanceSq = distanceSq;
                    closestThreat = enemy;
                    closestGuardPoint = guardPoint;
                }
            }
        }

        if (!closestThreat || !closestGuardPoint) {
            return null;
        }

        return { enemy: closestThreat, guardPoint: closestGuardPoint };
    }

    private getClosestSunToPoint(point: Vector2D): Sun | null {
        let closestSun: Sun | null = null;
        let closestDistance = Infinity;
        for (const sun of this.suns) {
            const distance = point.distanceTo(sun.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSun = sun;
            }
        }
        return closestSun;
    }

    private getAiHeroTypesForFaction(faction: Faction): string[] {
        switch (faction) {
            case Faction.RADIANT:
                return ['Marine', 'Dagger', 'Beam'];
            case Faction.AURUM:
                return ['Grave', 'Driller'];
            case Faction.SOLARI:
                return ['Ray', 'InfluenceBall', 'TurretDeployer'];
            default:
                return [];
        }
    }

    private isHeroUnitOfType(unit: Unit, heroUnitType: string): boolean {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof Marine;
            case 'Grave':
                return unit instanceof Grave;
            case 'Ray':
                return unit instanceof Ray;
            case 'InfluenceBall':
                return unit instanceof InfluenceBall;
            case 'TurretDeployer':
                return unit instanceof TurretDeployer;
            case 'Driller':
                return unit instanceof Driller;
            case 'Dagger':
                return unit instanceof Dagger;
            case 'Beam':
                return unit instanceof Beam;
            default:
                return false;
        }
    }

    private isHeroUnitAlive(player: Player, heroUnitType: string): boolean {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }

    private isHeroUnitQueuedOrProducing(forge: StellarForge, heroUnitType: string): boolean {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }

    private applyDustPushFromMovingEntity(
        position: Vector2D,
        velocity: Vector2D,
        radiusPx: number,
        forceMultiplier: number,
        deltaTime: number
    ): void {
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (speed <= 0) {
            return;
        }
        const effectiveSpeed = Math.max(speed, Constants.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC);
        this.applyFluidForceFromMovingObject(
            position,
            velocity,
            radiusPx,
            effectiveSpeed * forceMultiplier,
            deltaTime
        );
    }

    /**
     * Apply fluid-like forces to particles from a moving object (projectile)
     * Particles closer to the object get pushed more, with falloff based on distance
     * 
     * @param position - World position of the moving object (pixels)
     * @param velocity - Velocity vector of the moving object (pixels/second)
     * @param radius - Effect radius in pixels (particles beyond this distance are not affected)
     * @param strength - Base force strength (higher values create stronger displacement)
     * @param deltaTime - Time delta in seconds for frame-independent physics
     */
    private applyFluidForceFromMovingObject(
        position: Vector2D,
        velocity: Vector2D,
        radius: number,
        strength: number,
        deltaTime: number
    ): void {
        for (const particle of this.spaceDust) {
            const distance = particle.position.distanceTo(position);
            
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Calculate direction from object to particle
                const directionToParticle = new Vector2D(
                    particle.position.x - position.x,
                    particle.position.y - position.y
                ).normalize();
                
                // Combine forward motion with radial push
                const velocityNorm = velocity.normalize();
                
                // Mix of forward push and radial displacement (like fluid being displaced)
                const forwardComponent = Constants.FLUID_FORWARD_COMPONENT;
                const radialComponent = Constants.FLUID_RADIAL_COMPONENT;
                
                const pushDirection = new Vector2D(
                    velocityNorm.x * forwardComponent + directionToParticle.x * radialComponent,
                    velocityNorm.y * forwardComponent + directionToParticle.y * radialComponent
                );
                
                // Force falls off with distance (inverse square for more realistic fluid behavior)
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;
                
                particle.applyForce(new Vector2D(
                    pushDirection.x * forceMagnitude * deltaTime,
                    pushDirection.y * forceMagnitude * deltaTime
                ));
            }
        }
    }

    /**
     * Apply fluid-like forces to particles from a beam segment
     * Creates a line-based displacement field along the beam
     * 
     * @param startPos - Starting position of the beam segment (pixels)
     * @param endPos - Ending position of the beam segment (pixels)
     * @param radius - Effect radius around the beam line in pixels
     * @param strength - Base force strength (higher values create stronger displacement)
     * @param deltaTime - Time delta in seconds for frame-independent physics
     */
    private applyFluidForceFromBeam(
        startPos: Vector2D,
        endPos: Vector2D,
        radius: number,
        strength: number,
        deltaTime: number
    ): void {
        // Calculate beam direction
        const beamLength = startPos.distanceTo(endPos);
        if (beamLength < Constants.FLUID_MIN_DISTANCE) return;
        
        const beamDirection = new Vector2D(
            endPos.x - startPos.x,
            endPos.y - startPos.y
        ).normalize();
        
        for (const particle of this.spaceDust) {
            // Find closest point on line segment to particle
            const toParticle = new Vector2D(
                particle.position.x - startPos.x,
                particle.position.y - startPos.y
            );
            
            // Project particle position onto beam line
            const projection = toParticle.x * beamDirection.x + toParticle.y * beamDirection.y;
            const clampedProjection = Math.max(0, Math.min(beamLength, projection));
            
            // Closest point on beam to particle
            const closestPoint = new Vector2D(
                startPos.x + beamDirection.x * clampedProjection,
                startPos.y + beamDirection.y * clampedProjection
            );
            
            const distance = particle.position.distanceTo(closestPoint);
            
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Direction from beam to particle (perpendicular push)
                const directionToParticle = new Vector2D(
                    particle.position.x - closestPoint.x,
                    particle.position.y - closestPoint.y
                ).normalize();
                
                // Combine beam direction with radial push
                // Particles along beam get pushed forward and outward
                const alongBeamComponent = Constants.BEAM_ALONG_COMPONENT;
                const perpendicularComponent = Constants.BEAM_PERPENDICULAR_COMPONENT;
                
                const pushDirection = new Vector2D(
                    beamDirection.x * alongBeamComponent + directionToParticle.x * perpendicularComponent,
                    beamDirection.y * alongBeamComponent + directionToParticle.y * perpendicularComponent
                );
                
                // Force falls off with distance from beam
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;
                
                particle.applyForce(new Vector2D(
                    pushDirection.x * forceMagnitude * deltaTime,
                    pushDirection.y * forceMagnitude * deltaTime
                ));
            }
        }
    }

    /**
     * Initialize mirror movement at the start of countdown
     * Moves mirrors outward perpendicular to base position
     */
    initializeMirrorMovement(): void {
        if (this.suns.length === 0) return;
        
        const sun = this.suns[0]; // Use first sun as reference
        
        for (const player of this.players) {
            if (!player.stellarForge || player.solarMirrors.length < 2) continue;
            
            const forgePos = player.stellarForge.position;
            
            // Calculate angle from sun to forge
            const dx = forgePos.x - sun.position.x;
            const dy = forgePos.y - sun.position.y;
            const angleToForge = Math.atan2(dy, dx);
            
            // Calculate perpendicular angles (left and right relative to sun-to-forge direction)
            const leftAngle = angleToForge + Math.PI / 2;
            const rightAngle = angleToForge - Math.PI / 2;
            
            // Set target positions for the two mirrors
            if (player.solarMirrors.length >= 1) {
                const leftTarget = new Vector2D(
                    forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );
                player.solarMirrors[0].setTarget(leftTarget);
            }
            
            if (player.solarMirrors.length >= 2) {
                const rightTarget = new Vector2D(
                    forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );
                player.solarMirrors[1].setTarget(rightTarget);
            }
        }
    }

    /**
     * Check if a point is in shadow cast by asteroids from all suns
     * Returns true if the point is in shadow from all light sources
     */
    isPointInShadow(point: Vector2D): boolean {
        // If no suns, everything is in shadow
        if (this.suns.length === 0) return true;
        
        // Point must have line of sight to at least one sun to not be in shadow
        for (const sun of this.suns) {
            const direction = new Vector2D(
                sun.position.x - point.x,
                sun.position.y - point.y
            ).normalize();
            
            const ray = new LightRay(point, direction);
            const distanceToSun = point.distanceTo(sun.position);
            
            let hasLineOfSight = true;
            for (const asteroid of this.asteroids) {
                const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
                if (intersectionDist !== null && intersectionDist < distanceToSun) {
                    hasLineOfSight = false;
                    break;
                }
            }
            
            if (hasLineOfSight) {
                return false; // Can see at least one sun, not in shadow
            }
        }
        
        return true; // Cannot see any sun, in shadow
    }

    /**
     * Check if an enemy object is visible to a player
     * Objects are visible if:
     * - They are NOT in shadow (in light), OR
     * - They are in shadow but within proximity range of player unit, OR
     * - They are in shadow but within player's influence radius
     */
    isObjectVisibleToPlayer(objectPos: Vector2D, player: Player, object?: Unit | StellarForge | Building): boolean {
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof Dagger) {
            // Dagger is only visible to enemies if not cloaked
            if (object.isCloakedToEnemies() && object.owner !== player) {
                return false; // Cloaked Daggers are invisible to enemies
            }
        }
        
        // Check if object is in shadow
        const inShadow = this.isPointInShadow(objectPos);
        
        // If not in shadow, always visible
        if (!inShadow) {
            return true;
        }
        
        // In shadow - check proximity to player units
        for (const unit of player.units) {
            const distance = unit.position.distanceTo(objectPos);
            if (distance <= Constants.VISIBILITY_PROXIMITY_RANGE) {
                return true;
            }
        }
        
        // In shadow - check if within player's influence
        if (player.stellarForge) {
            const distanceToForge = player.stellarForge.position.distanceTo(objectPos);
            if (distanceToForge <= Constants.INFLUENCE_RADIUS) {
                return true;
            }
        }
        
        return false; // Not visible: in shadow and not within proximity or influence range
    }
    
    /**
     * Process Ray's bouncing beam ability
     */
    private processRayBeamAbility(ray: Ray): void {
        if (!ray.drillDirection) {
            return;
        }
        
        const segments: RayBeamSegment[] = [];
        let currentPos = new Vector2D(ray.position.x, ray.position.y);
        let currentDir = ray.drillDirection.normalize();
        let bounces = 0;
        const maxDistance = 2000; // Max beam travel distance
        
        while (bounces < Constants.RAY_BEAM_MAX_BOUNCES) {
            // Cast ray to find next hit
            let closestHit: { pos: Vector2D, type: string, target?: any } | null = null;
            let closestDistance = maxDistance;
            
            // Check asteroids
            for (const asteroid of this.asteroids) {
                const hitPos = this.rayIntersectsAsteroid(currentPos, currentDir, asteroid);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'asteroid' };
                    }
                }
            }
            
            // Check enemy units
            for (const player of this.players) {
                if (player === ray.owner) continue;
                
                for (const unit of player.units) {
                    const hitPos = this.rayIntersectsUnit(currentPos, currentDir, unit.position);
                    if (hitPos) {
                        const distance = currentPos.distanceTo(hitPos);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestHit = { pos: hitPos, type: 'unit', target: unit };
                        }
                    }
                }
                
                // Check enemy forge
                if (player.stellarForge) {
                    const hitPos = this.rayIntersectsUnit(currentPos, currentDir, player.stellarForge.position, player.stellarForge.radius);
                    if (hitPos) {
                        const distance = currentPos.distanceTo(hitPos);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestHit = { pos: hitPos, type: 'forge', target: player.stellarForge };
                        }
                    }
                }
            }
            
            // Check suns
            for (const sun of this.suns) {
                const hitPos = this.rayIntersectsUnit(currentPos, currentDir, sun.position, sun.radius);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'sun' };
                    }
                }
            }
            
            // Check map edges
            const edgeHit = this.rayIntersectsEdge(currentPos, currentDir);
            if (edgeHit && currentPos.distanceTo(edgeHit) < closestDistance) {
                closestDistance = currentPos.distanceTo(edgeHit);
                closestHit = { pos: edgeHit, type: 'edge' };
            }
            
            if (!closestHit) {
                // No hit, beam continues to max distance
                const endPos = new Vector2D(
                    currentPos.x + currentDir.x * maxDistance,
                    currentPos.y + currentDir.y * maxDistance
                );
                segments.push(new RayBeamSegment(currentPos, endPos, ray.owner));
                break;
            }
            
            // Add segment to hit point
            segments.push(new RayBeamSegment(currentPos, closestHit.pos, ray.owner));
            
            // Handle hit
            if (closestHit.type === 'unit' || closestHit.type === 'forge') {
                // Damage and stop
                if (closestHit.target) {
                    closestHit.target.takeDamage(Constants.RAY_BEAM_DAMAGE);
                    // Create damage number
                    const maxHealth = closestHit.type === 'forge' 
                        ? Constants.STELLAR_FORGE_MAX_HEALTH 
                        : (closestHit.target as Unit).maxHealth;
                    this.damageNumbers.push(new DamageNumber(
                        closestHit.target.position,
                        Constants.RAY_BEAM_DAMAGE,
                        this.gameTime,
                        maxHealth
                    ));
                }
                break;
            } else if (closestHit.type === 'sun' || closestHit.type === 'edge') {
                // Stop at sun or edge
                break;
            } else if (closestHit.type === 'asteroid') {
                // Bounce off asteroid
                bounces++;
                currentPos = closestHit.pos;
                // Calculate reflection direction (simplified)
                currentDir = new Vector2D(-currentDir.x, -currentDir.y); // Simple bounce for now
            }
        }
        
        ray.setBeamSegments(segments);
    }
    
    /**
     * Check if ray intersects with an asteroid
     */
    private rayIntersectsAsteroid(origin: Vector2D, direction: Vector2D, asteroid: Asteroid): Vector2D | null {
        // Simplified ray-polygon intersection
        // For now, treat asteroid as circle
        const toAsteroid = new Vector2D(
            asteroid.position.x - origin.x,
            asteroid.position.y - origin.y
        );
        const projection = toAsteroid.x * direction.x + toAsteroid.y * direction.y;
        
        if (projection < 0) return null; // Behind ray
        
        const closestPoint = new Vector2D(
            origin.x + direction.x * projection,
            origin.y + direction.y * projection
        );
        
        const distance = closestPoint.distanceTo(asteroid.position);
        if (distance < 60) { // Approximate asteroid radius
            return closestPoint;
        }
        
        return null;
    }
    
    /**
     * Check if ray intersects with a circular unit
     */
    private rayIntersectsUnit(origin: Vector2D, direction: Vector2D, targetPos: Vector2D, radius: number = 8): Vector2D | null {
        const toTarget = new Vector2D(
            targetPos.x - origin.x,
            targetPos.y - origin.y
        );
        const projection = toTarget.x * direction.x + toTarget.y * direction.y;
        
        if (projection < 0) return null; // Behind ray
        
        const closestPoint = new Vector2D(
            origin.x + direction.x * projection,
            origin.y + direction.y * projection
        );
        
        const distance = closestPoint.distanceTo(targetPos);
        if (distance < radius) {
            return closestPoint;
        }
        
        return null;
    }
    
    /**
     * Check if ray intersects with map edge
     */
    private rayIntersectsEdge(origin: Vector2D, direction: Vector2D): Vector2D | null {
        const mapSize = this.mapSize;
        let closestHit: Vector2D | null = null;
        let closestDist = Infinity;
        
        // Check all four edges
        const edges = [
            { x: 0, normal: new Vector2D(1, 0) },
            { x: mapSize, normal: new Vector2D(-1, 0) },
            { y: 0, normal: new Vector2D(0, 1) },
            { y: mapSize, normal: new Vector2D(0, -1) }
        ];
        
        for (const edge of edges) {
            let hitPos: Vector2D | null = null;
            
            if ('x' in edge && edge.x !== undefined) {
                if (Math.abs(direction.x) > 0.001) {
                    const t = (edge.x - origin.x) / direction.x;
                    if (t > 0) {
                        hitPos = new Vector2D(edge.x, origin.y + direction.y * t);
                    }
                }
            } else if ('y' in edge && edge.y !== undefined) {
                if (Math.abs(direction.y) > 0.001) {
                    const t = (edge.y - origin.y) / direction.y;
                    if (t > 0) {
                        hitPos = new Vector2D(origin.x + direction.x * t, edge.y);
                    }
                }
            }
            
            if (hitPos) {
                const dist = origin.distanceTo(hitPos);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = hitPos;
                }
            }
        }
        
        return closestHit;
    }
    
    /**
     * Process turret deployment for TurretDeployer
     */
    private processTurretDeployment(deployer: TurretDeployer): void {
        // Find nearest asteroid
        let nearestAsteroid: Asteroid | null = null;
        let minDistance = Infinity;
        
        for (const asteroid of this.asteroids) {
            const distance = deployer.position.distanceTo(asteroid.position);
            if (distance < minDistance && distance < 200) { // Within 200 pixels
                minDistance = distance;
                nearestAsteroid = asteroid;
            }
        }
        
        if (nearestAsteroid) {
            // Deploy turret at asteroid position
            const turret = new DeployedTurret(
                new Vector2D(nearestAsteroid.position.x, nearestAsteroid.position.y),
                deployer.owner,
                nearestAsteroid
            );
            this.deployedTurrets.push(turret);
        }
    }
    
    /**
     * Process Driller collisions
     */
    private processDrillerCollisions(driller: Driller, deltaTime: number): void {
        // Check collision with suns (dies)
        for (const sun of this.suns) {
            const distance = driller.position.distanceTo(sun.position);
            if (distance < sun.radius + 10) {
                driller.health = 0; // Dies
                driller.stopDrilling();
                return;
            }
        }
        
        // Check collision with asteroids (burrows)
        for (const asteroid of this.asteroids) {
            if (asteroid.containsPoint(driller.position)) {
                driller.hideInAsteroid(asteroid);
                driller.stopDrilling();
                return;
            }
        }
        
        // Check collision with enemy units
        for (const player of this.players) {
            if (player === driller.owner) continue;
            
            for (const unit of player.units) {
                const distance = driller.position.distanceTo(unit.position);
                if (distance < 15) {
                    unit.takeDamage(Constants.DRILLER_DRILL_DAMAGE);
                    // Create damage number
                    this.damageNumbers.push(new DamageNumber(
                        unit.position,
                        Constants.DRILLER_DRILL_DAMAGE,
                        this.gameTime,
                        unit.maxHealth
                    ));
                }
            }
            
            // Check collision with buildings (double damage, pass through)
            for (const building of player.buildings) {
                const distance = driller.position.distanceTo(building.position);
                if (distance < 40) {
                    const damage = Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    building.takeDamage(damage);
                    // Create damage number
                    this.damageNumbers.push(new DamageNumber(
                        building.position,
                        damage,
                        this.gameTime,
                        building.maxHealth
                    ));
                    // Continue drilling through building
                }
            }
            
            // Check collision with forge
            if (player.stellarForge) {
                const distance = driller.position.distanceTo(player.stellarForge.position);
                if (distance < player.stellarForge.radius + 10) {
                    const damage = Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    player.stellarForge.health -= damage;
                    // Create damage number
                    this.damageNumbers.push(new DamageNumber(
                        player.stellarForge.position,
                        damage,
                        this.gameTime,
                        Constants.STELLAR_FORGE_MAX_HEALTH
                    ));
                    // Continue drilling through
                }
            }
        }
        
        // Check collision with map edges (decelerate and stop)
        const mapSize = this.mapSize;
        if (driller.position.x < 0 || driller.position.x > mapSize ||
            driller.position.y < 0 || driller.position.y > mapSize) {
            // Apply deceleration
            const speed = Math.sqrt(driller.drillVelocity.x ** 2 + driller.drillVelocity.y ** 2);
            if (speed > 0) {
                const decelAmount = Constants.DRILLER_DECELERATION * deltaTime;
                const newSpeed = Math.max(0, speed - decelAmount);
                if (newSpeed === 0) {
                    driller.stopDrilling();
                } else {
                    driller.drillVelocity.x = (driller.drillVelocity.x / speed) * newSpeed;
                    driller.drillVelocity.y = (driller.drillVelocity.y / speed) * newSpeed;
                }
            }
            
            // Keep within bounds
            driller.position.x = Math.max(0, Math.min(mapSize, driller.position.x));
            driller.position.y = Math.max(0, Math.min(mapSize, driller.position.y));
        }
    }

    private resolveUnitCollisions(allUnits: Unit[]): void {
        for (let i = 0; i < allUnits.length; i++) {
            const unitA = allUnits[i];
            if (unitA.isDead()) {
                continue;
            }

            for (let j = i + 1; j < allUnits.length; j++) {
                const unitB = allUnits[j];
                if (unitB.isDead()) {
                    continue;
                }

                let deltaX = unitB.position.x - unitA.position.x;
                let deltaY = unitB.position.y - unitA.position.y;
                let distanceSq = deltaX * deltaX + deltaY * deltaY;

                if (distanceSq === 0) {
                    deltaX = i % 2 === 0 ? 1 : -1;
                    deltaY = 0;
                    distanceSq = 1;
                }

                const minDistance = unitA.collisionRadiusPx + unitB.collisionRadiusPx;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq) {
                    const distance = Math.sqrt(distanceSq);
                    const overlap = minDistance - distance;
                    const pushX = (deltaX / distance) * overlap;
                    const pushY = (deltaY / distance) * overlap;

                    if (unitA.isHero && !unitB.isHero) {
                        unitB.position.x += pushX;
                        unitB.position.y += pushY;
                    } else if (!unitA.isHero && unitB.isHero) {
                        unitA.position.x -= pushX;
                        unitA.position.y -= pushY;
                    } else {
                        unitA.position.x -= pushX * 0.5;
                        unitA.position.y -= pushY * 0.5;
                        unitB.position.x += pushX * 0.5;
                        unitB.position.y += pushY * 0.5;
                    }
                }
            }
        }
    }

    private resolveUnitObstacleCollisions(allUnits: Unit[]): void {
        for (const unit of allUnits) {
            if (unit.isDead()) {
                continue;
            }

            const oldPosition = new Vector2D(unit.position.x, unit.position.y);

            if (this.checkCollision(unit.position, unit.collisionRadiusPx)) {
                // Smooth collision: Find the nearest obstacle and push away from it gently
                let pushX = 0;
                let pushY = 0;
                let pushCount = 0;

                // Check all obstacles and accumulate push directions
                // Check suns
                for (const sun of this.suns) {
                    const dx = unit.position.x - sun.position.x;
                    const dy = unit.position.y - sun.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = sun.radius + unit.collisionRadiusPx;
                    if (dist < minDist) {
                        const pushStrength = (minDist - dist) / minDist;
                        pushX += (dx / dist) * pushStrength;
                        pushY += (dy / dist) * pushStrength;
                        pushCount++;
                    }
                }

                // Check asteroids
                for (const asteroid of this.asteroids) {
                    const dx = unit.position.x - asteroid.position.x;
                    const dy = unit.position.y - asteroid.position.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = asteroid.size + unit.collisionRadiusPx + Constants.UNIT_ASTEROID_AVOIDANCE_BUFFER_PX;
                    const minDistSq = minDist * minDist;
                    if (distSq < minDistSq || asteroid.containsPoint(unit.position)) {
                        const dist = Math.sqrt(distSq) || 1;
                        const pushStrength = (minDist - dist) / minDist;
                        pushX += (dx / dist) * pushStrength;
                        pushY += (dy / dist) * pushStrength;
                        pushCount++;
                    }
                }

                // Check stellar forges
                for (const player of this.players) {
                    if (player.stellarForge) {
                        const forge = player.stellarForge;
                        const dx = unit.position.x - forge.position.x;
                        const dy = unit.position.y - forge.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = forge.radius + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }

                // Check solar mirrors
                for (const player of this.players) {
                    for (const mirror of player.solarMirrors) {
                        if (mirror.owner === unit.owner) continue;
                        const dx = unit.position.x - mirror.position.x;
                        const dy = unit.position.y - mirror.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = 20 + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }

                // Check buildings
                for (const player of this.players) {
                    for (const building of player.buildings) {
                        const dx = unit.position.x - building.position.x;
                        const dy = unit.position.y - building.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = building.radius + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }

                // Apply smooth push away from obstacles
                if (pushCount > 0) {
                    const pushLength = Math.sqrt(pushX * pushX + pushY * pushY);
                    if (pushLength > 0) {
                        // Normalize and apply gentle push
                        const pushDistance = Math.min(this.MAX_PUSH_DISTANCE, pushLength * this.PUSH_MULTIPLIER);
                        unit.position.x = oldPosition.x + (pushX / pushLength) * pushDistance;
                        unit.position.y = oldPosition.y + (pushY / pushLength) * pushDistance;
                    }
                }

                // If still in collision after push, stop the unit
                if (this.checkCollision(unit.position, unit.collisionRadiusPx)) {
                    unit.position = oldPosition;
                    if (unit.rallyPoint && this.checkCollision(unit.rallyPoint, unit.collisionRadiusPx)) {
                        unit.rallyPoint = null;
                    }
                }
            }

            this.clampUnitOutsideStructures(unit);
        }
    }

    private clampUnitOutsideStructures(unit: Unit): void {
        for (const player of this.players) {
            if (player.stellarForge) {
                this.pushUnitOutsideCircle(unit, player.stellarForge.position, player.stellarForge.radius);
            }

            for (const building of player.buildings) {
                this.pushUnitOutsideCircle(unit, building.position, building.radius);
            }
        }
    }

    private pushUnitOutsideCircle(unit: Unit, center: Vector2D, radius: number): void {
        const minDistance = radius + unit.collisionRadiusPx + Constants.UNIT_STRUCTURE_STANDOFF_PX;
        const offsetX = unit.position.x - center.x;
        const offsetY = unit.position.y - center.y;
        const distanceSq = offsetX * offsetX + offsetY * offsetY;
        const minDistanceSq = minDistance * minDistance;

        if (distanceSq < minDistanceSq) {
            const distance = Math.sqrt(distanceSq);
            if (distance > 0) {
                const scale = minDistance / distance;
                unit.position.x = center.x + offsetX * scale;
                unit.position.y = center.y + offsetY * scale;
            } else {
                unit.position.x = center.x + minDistance;
                unit.position.y = center.y;
            }
        }
    }

    /**
     * Check if a position would collide with any obstacle (sun, asteroid, or building)
     * Returns true if collision detected
     */
    private createHeroUnit(unitType: string, spawnPosition: Vector2D, owner: Player): Unit | null {
        switch (unitType) {
            case 'Marine':
                return new Marine(spawnPosition, owner);
            case 'Grave':
                return new Grave(spawnPosition, owner);
            case 'Ray':
                return new Ray(spawnPosition, owner);
            case 'InfluenceBall':
                return new InfluenceBall(spawnPosition, owner);
            case 'TurretDeployer':
                return new TurretDeployer(spawnPosition, owner);
            case 'Driller':
                return new Driller(spawnPosition, owner);
            case 'Dagger':
                return new Dagger(spawnPosition, owner);
            case 'Beam':
                return new Beam(spawnPosition, owner);
            default:
                return null;
        }
    }

    checkCollision(
        position: Vector2D,
        unitRadius: number = Constants.UNIT_RADIUS_PX,
        ignoredObject: SolarMirror | StellarForge | Building | null = null
    ): boolean {
        // Check collision with suns
        for (const sun of this.suns) {
            const distance = position.distanceTo(sun.position);
            if (distance < sun.radius + unitRadius) {
                return true; // Collision with sun
            }
        }

        // Check collision with asteroids
        for (const asteroid of this.asteroids) {
            if (asteroid.containsPoint(position)) {
                return true; // Inside asteroid
            }
        }

        // Check collision with all players' buildings
        for (const player of this.players) {
            // Check collision with stellar forge
            if (player.stellarForge) {
                if (player.stellarForge === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(player.stellarForge.position);
                if (distance < player.stellarForge.radius + unitRadius) {
                    return true; // Collision with forge
                }
            }

            // Check collision with solar mirrors (using approximate radius)
            for (const mirror of player.solarMirrors) {
                if (mirror === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(mirror.position);
                if (distance < 20 + unitRadius) { // Mirror has ~20 pixel radius
                    return true; // Collision with mirror
                }
            }

            // Check collision with buildings
            for (const building of player.buildings) {
                if (building === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(building.position);
                if (distance < building.radius + unitRadius) {
                    return true; // Collision with building
                }
            }
        }

        return false; // No collision
    }

    private updateStateHash(): void {
        let hash = 2166136261;

        const mix = (value: number): void => {
            const normalizedValue = Math.floor(value * 100);
            hash = Math.imul(hash ^ normalizedValue, 16777619);
        };

        const mixInt = (value: number): void => {
            hash = Math.imul(hash ^ value, 16777619);
        };

        const mixString = (value: string): void => {
            mixInt(value.length);
            for (let i = 0; i < value.length; i++) {
                mixInt(value.charCodeAt(i));
            }
        };

        mix(this.gameTime);
        mix(this.suns.length);
        mix(this.asteroids.length);
        mixInt(this.spaceDust.length);
        for (const particle of this.spaceDust) {
            mix(particle.position.x);
            mix(particle.position.y);
            mix(particle.velocity.x);
            mix(particle.velocity.y);
            mix(particle.glowTransition);
            mixInt(particle.glowState);
            mixInt(particle.targetGlowState);
            mixString(particle.baseColor);
        }

        for (const player of this.players) {
            mix(player.energy);
            mixInt(player.isAi ? 1 : 0);
            mix(player.aiNextMirrorCommandSec);
            mix(player.aiNextDefenseCommandSec);
            mix(player.aiNextHeroCommandSec);
            mix(player.aiNextStructureCommandSec);
            mix(player.aiNextMirrorPurchaseCommandSec);
            mixString(player.aiStrategy);

            if (player.stellarForge) {
                mix(player.stellarForge.position.x);
                mix(player.stellarForge.position.y);
                mix(player.stellarForge.health);
                mixInt(player.stellarForge.unitQueue.length);
                for (const unitType of player.stellarForge.unitQueue) {
                    mixString(unitType);
                }
                mixString(player.stellarForge.heroProductionUnitType ?? '');
                mix(player.stellarForge.heroProductionRemainingSec);
                mix(player.stellarForge.heroProductionDurationSec);
                mix(player.stellarForge.crunchTimer);
                mix(player.stellarForge.rotation);
                if (player.stellarForge.targetPosition) {
                    mix(player.stellarForge.targetPosition.x);
                    mix(player.stellarForge.targetPosition.y);
                } else {
                    mix(-1);
                    mix(-1);
                }
                mix(player.stellarForge.velocity.x);
                mix(player.stellarForge.velocity.y);
            } else {
                mix(-1);
            }

            for (const mirror of player.solarMirrors) {
                mix(mirror.position.x);
                mix(mirror.position.y);
                mix(mirror.health);
                mix(mirror.efficiency);
                mix(mirror.reflectionAngle);
                if (mirror.targetPosition) {
                    mix(mirror.targetPosition.x);
                    mix(mirror.targetPosition.y);
                } else {
                    mix(-1);
                    mix(-1);
                }
                mix(mirror.velocity.x);
                mix(mirror.velocity.y);
            }

            for (const unit of player.units) {
                mix(unit.position.x);
                mix(unit.position.y);
                mix(unit.velocity.x);
                mix(unit.velocity.y);
                mix(unit.health);
                mix(unit.isHero ? 1 : 0);
                mix(unit.collisionRadiusPx);
                mixInt(unit.moveOrder);
                if (unit.rallyPoint) {
                    mix(unit.rallyPoint.x);
                    mix(unit.rallyPoint.y);
                } else {
                    mix(-1);
                    mix(-1);
                }
                if (unit instanceof Starling) {
                    mixInt(unit.getAssignedPathLength());
                    mixInt(unit.getCurrentPathWaypointIndex());
                    mixInt(unit.hasActiveManualOrder() ? 1 : 0);
                }
            }

            for (const building of player.buildings) {
                mix(building.position.x);
                mix(building.position.y);
                mix(building.health);
                mix(building.isComplete ? 1 : 0);
            }
        }

        mixInt(this.minionProjectiles.length);
        for (const projectile of this.minionProjectiles) {
            mix(projectile.position.x);
            mix(projectile.position.y);
            mix(projectile.velocity.x);
            mix(projectile.velocity.y);
            mix(projectile.damage);
            mix(projectile.distanceTraveledPx);
            mix(projectile.maxRangePx);
            mixInt(this.players.indexOf(projectile.owner));
        }

        this.stateHash = hash >>> 0;
    }

    /**
     * Initialize space dust particles
     */
    initializeSpaceDust(count: number, width: number, height: number, palette?: SpaceDustPalette): void {
        this.spaceDust = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * height;
            this.spaceDust.push(new SpaceDustParticle(new Vector2D(x, y), undefined, palette));
        }
    }

    /**
     * Initialize asteroids at random positions
     */
    initializeAsteroids(count: number, width: number, height: number): void {
        this.asteroids = [];
        const maxAttempts = 50; // Maximum attempts to find a valid position
        
        for (let i = 0; i < count; i++) {
            let validPosition = false;
            let attempts = 0;
            let x = 0, y = 0, size = 0;
            
            while (!validPosition && attempts < maxAttempts) {
                // Random position avoiding the center (where players start)
                const angle = Math.random() * Math.PI * 2;
                const distance = 200 + Math.random() * (Math.min(width, height) / 2 - 300);
                x = Math.cos(angle) * distance;
                y = Math.sin(angle) * distance;
                
                // Random size (30-80)
                size = Constants.ASTEROID_MIN_SIZE + Math.random() * (80 - Constants.ASTEROID_MIN_SIZE);
                
                // Check if this position has enough gap from existing asteroids
                // Gap must be at least the sum of both asteroid radii
                validPosition = true;
                for (const asteroid of this.asteroids) {
                    const dx = x - asteroid.position.x;
                    const dy = y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const requiredGap = size + asteroid.size;
                    
                    if (dist < requiredGap) {
                        validPosition = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            // If we found a valid position, add the asteroid
            if (validPosition) {
                // Random polygon sides (3-9)
                const sides = 3 + Math.floor(Math.random() * 7);
                this.asteroids.push(new Asteroid(new Vector2D(x, y), sides, size));
            }
        }
    }

    /**
     * Check if any player has won
     */
    checkVictoryConditions(): Player | null {
        const activePlayers = this.players.filter(p => !p.isDefeated());
        if (activePlayers.length === 1) {
            return activePlayers[0];
        }
        return null;
    }

    /**
     * Initialize a player with starting structures
     */
    initializePlayer(player: Player, forgePosition: Vector2D, mirrorPositions: Vector2D[]): void {
        // Create Stellar Forge
        player.stellarForge = new StellarForge(forgePosition, player);

        // Create starting Solar Mirrors
        for (const pos of mirrorPositions) {
            const mirror = new SolarMirror(pos, player);
            player.solarMirrors.push(mirror);
        }
    }
}

/**
 * Create a standard game setup
 */
export function createStandardGame(playerNames: Array<[string, Faction]>, spaceDustPalette?: SpaceDustPalette): GameState {
    const game = new GameState();

    // Add sun at center
    game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));

    // Create players with starting positions in bottom-left and top-right
    // Randomly assign which player gets which position
    const bottomLeft = new Vector2D(-700, 700);
    const topRight = new Vector2D(700, -700);
    
    // Randomly decide player assignment
    const randomizePositions = Math.random() < 0.5;
    const positions = randomizePositions 
        ? [bottomLeft, topRight]
        : [topRight, bottomLeft];

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= positions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
        player.isAi = i !== 0;
        
        // Assign random AI strategy for AI players
        if (player.isAi) {
            const strategies = [
                Constants.AIStrategy.ECONOMIC,
                Constants.AIStrategy.DEFENSIVE,
                Constants.AIStrategy.AGGRESSIVE,
                Constants.AIStrategy.WAVES
            ];
            player.aiStrategy = strategies[Math.floor(Math.random() * strategies.length)];
        }
        
        const forgePos = positions[i];
        
        const mirrorSpawnDistance = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorPositions = [
            new Vector2D(
                forgePos.x - mirrorSpawnDistance,
                forgePos.y
            ),
            new Vector2D(
                forgePos.x + mirrorSpawnDistance,
                forgePos.y
            )
        ];
        game.initializePlayer(player, forgePos, mirrorPositions);
        
        // Hero units (Marine and Grave) are no longer spawned automatically
        // They must be obtained through other game mechanics
        
        game.players.push(player);
    }
    
    // Initialize default minion paths (each forge targets the enemy's spawn location)
    if (game.players.length >= 2) {
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const enemyIndex = (i + 1) % game.players.length;
            const enemyPlayer = game.players[enemyIndex];
            
            if (player.stellarForge && enemyPlayer.stellarForge) {
                player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
            }
        }
    }

    // Initialize space dust particles
    game.initializeSpaceDust(Constants.SPACE_DUST_PARTICLE_COUNT, 2000, 2000, spaceDustPalette);

    // Initialize random asteroids
    game.initializeAsteroids(10, 2000, 2000);
    
    // Add two large strategic asteroids that cast shadows on the bases
    // Position them close to the sun to cast shadows toward bottom-left and top-right
    // Bottom-left shadow: asteroid positioned at top-right of sun (angle ~-45 degrees or 315 degrees)
    const bottomLeftShadowAngle = -Math.PI / 4; // -45 degrees (top-right quadrant)
    const bottomLeftAsteroidPos = new Vector2D(
        Math.cos(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );
    game.asteroids.push(new Asteroid(bottomLeftAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));
    
    // Top-right shadow: asteroid positioned at bottom-left of sun (angle ~135 degrees)
    const topRightShadowAngle = (3 * Math.PI) / 4; // 135 degrees (bottom-left quadrant)
    const topRightAsteroidPos = new Vector2D(
        Math.cos(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );
    game.asteroids.push(new Asteroid(topRightAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));

    game.isRunning = true;
    return game;
}
