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
     * Generate Solarium based on light received
     */
    generateSolarium(deltaTime: number): number {
        const baseGenerationRate = 10.0; // Sol per second
        return baseGenerationRate * this.efficiency * deltaTime;
    }
}

/**
 * Stellar Forge - Main base that produces units
 */
export class StellarForge {
    health: number = 1000.0;
    isReceivingLight: boolean = false;
    unitQueue: string[] = [];

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

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
 * Base Unit class
 */
export class Unit {
    health: number;
    maxHealth: number;
    attackCooldown: number = 0;
    target: Unit | StellarForge | null = null;
    rallyPoint: Vector2D | null = null;
    
    constructor(
        public position: Vector2D,
        public owner: Player,
        maxHealth: number,
        public attackRange: number,
        public attackDamage: number,
        public attackSpeed: number // attacks per second
    ) {
        this.health = maxHealth;
        this.maxHealth = maxHealth;
    }

    /**
     * Update unit logic
     */
    update(deltaTime: number, enemies: (Unit | StellarForge)[]): void {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Move toward rally point if set
        if (this.rallyPoint) {
            const distance = this.position.distanceTo(this.rallyPoint);
            if (distance > Constants.UNIT_ARRIVAL_THRESHOLD) {
                // Calculate direction vector
                const dx = this.rallyPoint.x - this.position.x;
                const dy = this.rallyPoint.y - this.position.y;
                
                // Normalize and move (reuse distance to avoid redundant calculation)
                const moveDistance = Constants.UNIT_MOVE_SPEED * deltaTime;
                this.position.x += (dx / distance) * moveDistance;
                this.position.y += (dy / distance) * moveDistance;
            } else {
                // Arrived at rally point
                this.rallyPoint = null;
            }
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
    private isTargetDead(target: Unit | StellarForge): boolean {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }

    /**
     * Find nearest enemy
     */
    private findNearestEnemy(enemies: (Unit | StellarForge)[]): Unit | StellarForge | null {
        let nearest: Unit | StellarForge | null = null;
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
    attack(target: Unit | StellarForge): void {
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
            Constants.MARINE_ATTACK_SPEED
        );
    }

    /**
     * Attack with visual effects
     */
    attack(target: Unit | StellarForge): void {
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
}

/**
 * Projectile that orbits a Grave unit with gravitational attraction
 */
export class GraveProjectile {
    velocity: Vector2D;
    lifetime: number = 0;
    isAttacking: boolean = false;
    targetEnemy: Unit | StellarForge | null = null;
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
    launchAtTarget(target: Unit | StellarForge): void {
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
            Constants.GRAVE_ATTACK_RANGE,
            Constants.GRAVE_ATTACK_DAMAGE,
            Constants.GRAVE_ATTACK_SPEED
        );
        
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
    update(deltaTime: number, enemies: (Unit | StellarForge)[]): void {
        // Update base unit logic
        super.update(deltaTime, enemies);
        
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
    attack(target: Unit | StellarForge): void {
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
    update(deltaTime: number, isStillHolding: boolean): void {
        if (!this.isCharging || this.isComplete) {
            return;
        }

        if (!isStillHolding) {
            // Player let go, cancel the warp gate
            this.cancel();
            return;
        }

        this.chargeTime += deltaTime;

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
    gameTime: number = 0.0;
    isRunning: boolean = false;

    /**
     * Update game state
     */
    update(deltaTime: number): void {
        this.gameTime += deltaTime;

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
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns, this.asteroids);
            }

            // Generate Solarium from mirrors
            for (const mirror of player.solarMirrors) {
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
            const enemies: (Unit | StellarForge)[] = [];
            for (const otherPlayer of this.players) {
                if (otherPlayer !== player && !otherPlayer.isDefeated()) {
                    enemies.push(...otherPlayer.units);
                    if (otherPlayer.stellarForge) {
                        enemies.push(otherPlayer.stellarForge);
                    }
                }
            }

            // Update each unit
            for (const unit of player.units) {
                unit.update(deltaTime, enemies);

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
            }

            // Remove dead units
            player.units = player.units.filter(unit => !unit.isDead());
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
        for (let i = 0; i < count; i++) {
            // Random position avoiding the center (where players start)
            const angle = Math.random() * Math.PI * 2;
            const distance = 200 + Math.random() * (Math.min(width, height) / 2 - 300);
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Random polygon sides (3-9)
            const sides = 3 + Math.floor(Math.random() * 7);
            
            // Random size (30-80)
            const size = 30 + Math.random() * 50;
            
            this.asteroids.push(new Asteroid(new Vector2D(x, y), sides, size));
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

    // Create players with starting positions
    const startingPositions: Array<[Vector2D, Vector2D[]]> = [
        [new Vector2D(-500, 0), [new Vector2D(-450, 0), new Vector2D(-400, 0)]],
        [new Vector2D(500, 0), [new Vector2D(450, 0), new Vector2D(400, 0)]],
    ];

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= startingPositions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
        const [forgePos, mirrorPositions] = startingPositions[i];
        game.initializePlayer(player, forgePos, mirrorPositions);
        
        // Add some initial marine units for testing (positioned closer to center for combat)
        const marineOffset = i === 0 ? 200 : -200; // Closer to center
        player.units.push(new Marine(new Vector2D(forgePos.x + marineOffset, forgePos.y - 80), player));
        player.units.push(new Marine(new Vector2D(forgePos.x + marineOffset, forgePos.y), player));
        player.units.push(new Marine(new Vector2D(forgePos.x + marineOffset, forgePos.y + 80), player));
        
        // Add Grave units for testing (positioned slightly behind marines)
        const graveOffset = i === 0 ? 150 : -150; // Behind the marines
        player.units.push(new Grave(new Vector2D(forgePos.x + graveOffset, forgePos.y - 50), player));
        player.units.push(new Grave(new Vector2D(forgePos.x + graveOffset, forgePos.y + 50), player));
        
        game.players.push(player);
    }

    // Initialize space dust particles
    game.initializeSpaceDust(1000, 2000, 2000);

    // Initialize asteroids
    game.initializeAsteroids(10, 2000, 2000);

    game.isRunning = true;
    return game;
}
