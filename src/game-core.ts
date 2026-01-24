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
 * Solar Mirror - reflects light to generate Solarium
 */
export class SolarMirror {
    health: number = 100.0;
    efficiency: number = 1.0; // 0.0 to 1.0
    isSelected: boolean = false;
    targetPosition: Vector2D | null = null;
    velocity: Vector2D = new Vector2D(0, 0);
    reflectionAngle: number = 0; // Angle in radians for the flat surface rotation
    closestSunDistance: number = Infinity; // Distance to closest visible sun

    // Movement constants for mirrors (slower than Stellar Forge)
    private readonly MAX_SPEED = 50; // Pixels per second - slower than forge
    private readonly ACCELERATION = 25; // Pixels per second squared
    private readonly DECELERATION = 50; // Pixels per second squared

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
    hasLineOfSightToForge(forge: StellarForge, asteroids: Asteroid[] = []): boolean {
        return this.isPathClear(forge.position, asteroids);
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
     * Generate Solarium based on light received and distance to closest sun
     */
    generateSolarium(deltaTime: number): number {
        const baseGenerationRate = 10.0; // Sol per second
        
        // Apply distance-based multiplier (closer = more efficient)
        // At distance 0: MIRROR_PROXIMITY_MULTIPLIER, at MIRROR_MAX_GLOW_DISTANCE: 1x multiplier
        const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER - (this.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE));
        
        return baseGenerationRate * this.efficiency * distanceMultiplier * deltaTime;
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
    updateReflectionAngle(forge: StellarForge | null, suns: Sun[], asteroids: Asteroid[] = []): void {
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
        this.reflectionAngle = Math.atan2(bisectorY, bisectorX);
    }

    /**
     * Update mirror position based on target and velocity
     */
    update(deltaTime: number): void {
        if (!this.targetPosition) return;
        
        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        
        // If we're close enough to target, stop
        if (distanceToTarget < 5) {
            this.position = this.targetPosition;
            this.targetPosition = null;
            this.velocity = new Vector2D(0, 0);
            return;
        }
        
        // Calculate desired direction
        const directionX = dx / distanceToTarget;
        const directionY = dy / distanceToTarget;
        
        // Calculate distance needed to decelerate to stop
        const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        const decelerationDistance = (currentSpeed * currentSpeed) / (2 * this.DECELERATION);
        
        // Should we accelerate or decelerate?
        if (distanceToTarget > decelerationDistance && currentSpeed < this.MAX_SPEED) {
            // Accelerate toward target
            this.velocity.x += directionX * this.ACCELERATION * deltaTime;
            this.velocity.y += directionY * this.ACCELERATION * deltaTime;
        } else {
            // Decelerate
            const decelerationFactor = Math.max(0, 1 - (this.DECELERATION * deltaTime) / currentSpeed);
            this.velocity.x *= decelerationFactor;
            this.velocity.y *= decelerationFactor;
        }
        
        // Cap speed at MAX_SPEED
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.MAX_SPEED) {
            this.velocity.x = (this.velocity.x / speed) * this.MAX_SPEED;
            this.velocity.y = (this.velocity.y / speed) * this.MAX_SPEED;
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
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
    isSelected: boolean = false;
    targetPosition: Vector2D | null = null;
    velocity: Vector2D = new Vector2D(0, 0);
    private readonly maxSpeed: number = 50; // pixels per second
    private readonly acceleration: number = 30; // pixels per second^2
    private readonly deceleration: number = 50; // pixels per second^2
    readonly radius: number = 40; // For rendering and selection
    starlingSpawnTimer: number = 0; // Timer for spawning starlings

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {
        // Initialize starling spawn timer with random offset to stagger spawns
        this.starlingSpawnTimer = Math.random() * Constants.STARLING_SPAWN_INTERVAL;
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
    produceUnit(unitType: string, cost: number, playerSolarium: number): boolean {
        if (!this.canProduceUnits()) {
            return false;
        }
        if (playerSolarium < cost) {
            return false;
        }
        this.unitQueue.push(unitType);
        return true;
    }

    /**
     * Update whether forge is receiving light from mirrors
     */
    updateLightStatus(mirrors: SolarMirror[], suns: Sun[], asteroids: Asteroid[] = []): void {
        this.isReceivingLight = false;
        for (const mirror of mirrors) {
            if (mirror.hasLineOfSightToLight(suns, asteroids) &&
                mirror.hasLineOfSightToForge(this, asteroids)) {
                this.isReceivingLight = true;
                break;
            }
        }
    }

    /**
     * Update forge movement and starling spawning
     */
    update(deltaTime: number): void {
        // Update starling spawn timer
        if (this.health > 0 && this.isReceivingLight) {
            this.starlingSpawnTimer -= deltaTime;
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
                const directionX = dx / distanceToTarget;
                const directionY = dy / distanceToTarget;

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

        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * Check if starling should be spawned and reset timer
     */
    shouldSpawnStarling(): boolean {
        if (this.starlingSpawnTimer <= 0 && this.health > 0 && this.isReceivingLight) {
            this.starlingSpawnTimer = Constants.STARLING_SPAWN_INTERVAL;
            return true;
        }
        return false;
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
    update(deltaTime: number, enemies: (Unit | StellarForge | Building)[], allUnits: Unit[]): void {
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
     * Add build progress (from solarium or mirror light)
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
 * Sun/Star - Light source
 */
export class Sun {
    constructor(
        public position: Vector2D,
        public intensity: number = 1.0,
        public radius: number = 100.0
    ) {}

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
    solarium: number = 100.0; // Starting currency
    stellarForge: StellarForge | null = null;
    solarMirrors: SolarMirror[] = [];
    units: Unit[] = [];
    buildings: Building[] = []; // Offensive and defensive buildings

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
     * Add Solarium to player's resources
     */
    addSolarium(amount: number): void {
        this.solarium += amount;
    }

    /**
     * Attempt to spend Solarium
     */
    spendSolarium(amount: number): boolean {
        if (this.solarium >= amount) {
            this.solarium -= amount;
            return true;
        }
        return false;
    }
}

/**
 * Space dust particle that gets affected by influences and forces
 */
export class SpaceDustParticle {
    velocity: Vector2D;
    baseColor: string = '#888888'; // Gray by default
    currentColor: string = '#888888';
    
    constructor(
        public position: Vector2D,
        velocity?: Vector2D
    ) {
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
        
        // Apply friction to gradually slow down
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
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
    
    constructor(
        public position: Vector2D,
        velocity: Vector2D,
        public owner: Player,
        public damage: number = Constants.MARINE_ABILITY_BULLET_DAMAGE
    ) {
        this.velocity = velocity;
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
        return this.lifetime >= this.maxLifetime;
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
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        maxHealth: number,
        public attackRange: number,
        public attackDamage: number,
        public attackSpeed: number, // attacks per second
        public abilityCooldownTime: number = 5.0 // Default ability cooldown time
    ) {
        this.health = maxHealth;
        this.maxHealth = maxHealth;
    }

    /**
     * Update unit logic
     */
    update(deltaTime: number, enemies: (Unit | StellarForge | Building)[], allUnits: Unit[]): void {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Update ability cooldown
        if (this.abilityCooldown > 0) {
            this.abilityCooldown -= deltaTime;
        }

        this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits);

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

    protected moveTowardRallyPoint(deltaTime: number, moveSpeed: number, allUnits: Unit[]): void {
        if (!this.rallyPoint) {
            return;
        }

        const dx = this.rallyPoint.x - this.position.x;
        const dy = this.rallyPoint.y - this.position.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distanceToTarget <= Constants.UNIT_ARRIVAL_THRESHOLD) {
            this.rallyPoint = null;
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

        directionX += avoidanceX * Constants.UNIT_AVOIDANCE_STRENGTH;
        directionY += avoidanceY * Constants.UNIT_AVOIDANCE_STRENGTH;

        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength > 0) {
            directionX /= directionLength;
            directionY /= directionLength;
        }

        const moveDistance = moveSpeed * deltaTime;
        this.position.x += directionX * moveDistance;
        this.position.y += directionY * moveDistance;
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
    update(deltaTime: number, enemies: (Unit | StellarForge)[], allUnits: Unit[]): void {
        // Update base unit logic
        super.update(deltaTime, enemies, allUnits);
        
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
    
    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.STARLING_MAX_HEALTH,
            Constants.STARLING_ATTACK_RANGE,
            Constants.STARLING_ATTACK_DAMAGE,
            Constants.STARLING_ATTACK_SPEED,
            0 // No special ability
        );
    }

    /**
     * Update starling AI behavior (call this before regular update)
     */
    updateAI(gameState: GameState, enemies: (Unit | StellarForge | Building)[]): void {
        // No need to update exploration timer here, it's updated in the main update loop

        // AI behavior: prioritize enemy base, then buildings, then explore
        let targetPosition: Vector2D | null = null;

        // 1. Try to target enemy base if visible
        for (const enemy of enemies) {
            if (enemy instanceof StellarForge && enemy.owner !== this.owner) {
                // Check if enemy base is visible (not in shadow)
                if (gameState.isObjectVisibleToPlayer(enemy.position, this.owner)) {
                    targetPosition = enemy.position;
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
            this.rallyPoint = targetPosition;
        }
    }

    /**
     * Override update to use custom movement speed
     */
    update(deltaTime: number, enemies: (Unit | StellarForge | Building)[]): void {
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

        this.moveTowardRallyPoint(deltaTime, Constants.STARLING_MOVE_SPEED, allUnits);

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
    influenceZones: InfluenceZone[] = [];
    influenceBallProjectiles: InfluenceBallProjectile[] = [];
    deployedTurrets: DeployedTurret[] = [];
    gameTime: number = 0.0;
    stateHash: number = 0;
    stateHashTickCounter: number = 0;
    isRunning: boolean = false;
    countdownTime: number = Constants.COUNTDOWN_DURATION; // Countdown from 3 seconds
    isCountdownActive: boolean = true; // Start with countdown active
    mirrorsMovedToSun: boolean = false; // Track if mirrors have been moved

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

        // Update asteroids
        for (const asteroid of this.asteroids) {
            asteroid.update(deltaTime);
        }

        // Update each player
        for (const player of this.players) {
            if (player.isDefeated()) {
                continue;
            }

            // Update light status for Stellar Forge
            if (player.stellarForge) {
                const oldForgePos = new Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns, this.asteroids);
                
                // Only allow forge movement after countdown
                if (!this.isCountdownActive) {
                    player.stellarForge.update(deltaTime); // Update forge movement
                    
                    // Check collision for forge (larger radius)
                    if (this.checkCollision(player.stellarForge.position, player.stellarForge.radius, player.stellarForge)) {
                        // Revert to old position and stop movement
                        player.stellarForge.position = oldForgePos;
                        player.stellarForge.targetPosition = null;
                        player.stellarForge.velocity = new Vector2D(0, 0);
                    }
                }
                
                // Spawn starlings if timer is ready (only after countdown)
                if (!this.isCountdownActive && player.stellarForge.shouldSpawnStarling()) {
                    const spawnOffset = 60; // Spawn 60 pixels away from forge
                    const angle = Math.random() * Math.PI * 2;
                    const spawnPosition = new Vector2D(
                        player.stellarForge.position.x + Math.cos(angle) * spawnOffset,
                        player.stellarForge.position.y + Math.sin(angle) * spawnOffset
                    );
                    const starling = new Starling(spawnPosition, player);
                    player.units.push(starling);
                    console.log(`${player.name} spawned a Starling at (${spawnPosition.x.toFixed(0)}, ${spawnPosition.y.toFixed(0)})`);
                }
            }

            // Update solar mirrors - position and reflection angle
            // Mirrors can move during countdown to reach the sun
            for (const mirror of player.solarMirrors) {
                const oldMirrorPos = new Vector2D(mirror.position.x, mirror.position.y);
                mirror.update(deltaTime); // Update mirror movement
                
                // Check collision for mirror
                if (this.checkCollision(mirror.position, 20, mirror)) {
                    // Revert to old position and stop movement
                    mirror.position = oldMirrorPos;
                    mirror.targetPosition = null;
                    mirror.velocity = new Vector2D(0, 0);
                }
                
                mirror.updateReflectionAngle(player.stellarForge, this.suns, this.asteroids);
                
                // Generate solarium even during countdown once mirrors reach position
                if (mirror.hasLineOfSightToLight(this.suns, this.asteroids) &&
                    player.stellarForge &&
                    mirror.hasLineOfSightToForge(player.stellarForge, this.asteroids)) {
                    const solariumGenerated = mirror.generateSolarium(deltaTime);
                    player.addSolarium(solariumGenerated);
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
                    
                    unit.update(deltaTime, enemies, allUnits);

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
            }
            } // End of countdown check

            // Remove dead units
            player.units = player.units.filter(unit => !unit.isDead());

            // Update each building (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    building.update(deltaTime, enemies);

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
                    // Building inside influence: take solarium from forge
                    // Calculate build progress per second (inverse of build time)
                    const buildRate = 1.0 / Constants.BUILDING_BUILD_TIME;
                    const buildProgress = buildRate * deltaTime;
                    
                    // TODO: Split solarium between buildings and hero units
                    // For now, buildings get solarium if available
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

            // Check hits against enemies
            for (const player of this.players) {
                // Skip if same team as bullet
                if (player === bullet.owner) {
                    continue;
                }

                // Check hits on units
                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        unit.takeDamage(bullet.damage);
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }

                // Check hits on Stellar Forge
                if (player.stellarForge && bullet.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= bullet.damage;
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                }
            }
        }
        this.abilityBullets = this.abilityBullets.filter(bullet => !bullet.shouldDespawn());
        
        // Update influence zones
        this.influenceZones = this.influenceZones.filter(zone => !zone.update(deltaTime));
        
        // Update influence ball projectiles
        for (const projectile of this.influenceBallProjectiles) {
            projectile.update(deltaTime);
            
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
    }

    /**
     * Update space dust particles with physics and color influences
     */
    private updateSpaceDust(deltaTime: number): void {
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
    isObjectVisibleToPlayer(objectPos: Vector2D, player: Player): boolean {
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
        const mapSize = 2000; // Approximate map size
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
                }
            }
            
            // Check collision with buildings (double damage, pass through)
            for (const building of player.buildings) {
                const distance = driller.position.distanceTo(building.position);
                if (distance < 40) {
                    building.takeDamage(Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER);
                    // Continue drilling through building
                }
            }
            
            // Check collision with forge
            if (player.stellarForge) {
                const distance = driller.position.distanceTo(player.stellarForge.position);
                if (distance < player.stellarForge.radius + 10) {
                    player.stellarForge.health -= Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    // Continue drilling through
                }
            }
        }
        
        // Check collision with map edges (decelerate and stop)
        const mapSize = 2000;
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
        const unitRadiusPx = Constants.UNIT_RADIUS_PX;
        const minDistance = unitRadiusPx * 2;
        const minDistanceSq = minDistance * minDistance;

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

            if (this.checkCollision(unit.position, Constants.UNIT_RADIUS_PX)) {
                let foundValidPosition = false;
                const searchRadius = 15;
                const searchSteps = 8;

                for (let i = 0; i < searchSteps; i++) {
                    const angle = (i / searchSteps) * Math.PI * 2;
                    const testX = oldPosition.x + Math.cos(angle) * searchRadius;
                    const testY = oldPosition.y + Math.sin(angle) * searchRadius;
                    const testPos = new Vector2D(testX, testY);

                    if (!this.checkCollision(testPos, Constants.UNIT_RADIUS_PX)) {
                        unit.position = testPos;
                        foundValidPosition = true;
                        break;
                    }
                }

                if (!foundValidPosition) {
                    unit.rallyPoint = null;
                }
            }
        }
    }

    /**
     * Check if a position would collide with any obstacle (sun, asteroid, or building)
     * Returns true if collision detected
     */
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

        mix(this.gameTime);
        mix(this.suns.length);
        mix(this.asteroids.length);

        for (const player of this.players) {
            mix(player.solarium);

            if (player.stellarForge) {
                mix(player.stellarForge.position.x);
                mix(player.stellarForge.position.y);
                mix(player.stellarForge.health);
            } else {
                mix(-1);
            }

            for (const mirror of player.solarMirrors) {
                mix(mirror.position.x);
                mix(mirror.position.y);
                mix(mirror.health);
            }

            for (const unit of player.units) {
                mix(unit.position.x);
                mix(unit.position.y);
                mix(unit.health);
                mix(unit.isHero ? 1 : 0);
            }

            for (const building of player.buildings) {
                mix(building.position.x);
                mix(building.position.y);
                mix(building.health);
                mix(building.isComplete ? 1 : 0);
            }
        }

        this.stateHash = hash >>> 0;
    }

    /**
     * Initialize space dust particles
     */
    initializeSpaceDust(count: number, width: number, height: number): void {
        this.spaceDust = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * height;
            this.spaceDust.push(new SpaceDustParticle(new Vector2D(x, y)));
        }
    }

    /**
     * Initialize asteroids at random positions
     */
    initializeAsteroids(count: number, width: number, height: number): void {
        this.asteroids = [];
        const minGap = 100; // Minimum distance between asteroid centers
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
                size = 30 + Math.random() * 50;
                
                // Check if this position has enough gap from existing asteroids
                validPosition = true;
                for (const asteroid of this.asteroids) {
                    const dx = x - asteroid.position.x;
                    const dy = y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const requiredGap = minGap + size + asteroid.size;
                    
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
export function createStandardGame(playerNames: Array<[string, Faction]>): GameState {
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
        
        // TEMPORARY: Add test hero units
        if (i === 0) { // Player 1 gets Solari heroes
            const rayPos = new Vector2D(forgePos.x + 100, forgePos.y);
            player.units.push(new Ray(rayPos, player));
            
            const influenceBallPos = new Vector2D(forgePos.x + 150, forgePos.y);
            player.units.push(new InfluenceBall(influenceBallPos, player));
            
            const turretDeployerPos = new Vector2D(forgePos.x + 200, forgePos.y);
            player.units.push(new TurretDeployer(turretDeployerPos, player));
        } else if (i === 1) { // Player 2 gets Aurum hero
            const drillerPos = new Vector2D(forgePos.x - 100, forgePos.y);
            const driller = new Driller(drillerPos, player);
            player.units.push(driller);
            
            // Start driller hidden in an asteroid near the base
            // Find an asteroid near the base
            for (const asteroid of game.asteroids) {
                const distance = asteroid.position.distanceTo(forgePos);
                if (distance < 400 && distance > 100) {
                    driller.hideInAsteroid(asteroid);
                    break;
                }
            }
        }
        
        game.players.push(player);
    }

    // Initialize space dust particles
    game.initializeSpaceDust(1000, 2000, 2000);

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
