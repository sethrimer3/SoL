/**
 * Building entities for SoL game
 * Extracted from game-core.ts
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import type { Player } from './player';
import type { Unit } from './unit';
import type { Asteroid } from './asteroid';
import type { StellarForge } from './stellar-forge';
import type { SolarMirror } from './solar-mirror';
import type { SpaceDustParticle, MuzzleFlash, BulletCasing, BouncingBullet } from './particles';

export type CombatTarget = Unit | StellarForge | Building | SolarMirror;

/**
 * Base class for all buildings
 */
export class Building {
    health: number;
    maxHealth: number;
    attackCooldown: number = 0;
    target: CombatTarget | null = null;
    buildProgress: number = 0; // 0 to 1, building is complete at 1
    isComplete: boolean = false;
    isSelected: boolean = false;
    
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
        enemies: CombatTarget[],
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
    protected isTargetDead(target: CombatTarget): boolean {
        if ('health' in target) {
            return target.health <= 0;
        }
        return false;
    }

    /**
     * Find nearest enemy
     */
    protected findNearestEnemy(enemies: CombatTarget[]): CombatTarget | null {
        let nearest: CombatTarget | null = null;
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
    attack(target: CombatTarget): void {
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

    /**
     * Check if a point is within the building's radius
     */
    containsPoint(point: Vector2D): boolean {
        const distance = this.position.distanceTo(point);
        return distance <= this.radius;
    }

    /**
     * Check if this building can shoot (has a gun)
     */
    canShoot(): boolean {
        // Only buildings with attack range and damage can shoot
        return this.attackRange > 0 && this.attackDamage > 0;
    }
}

/**
 * Cannon Building - Offensive building for Radiant faction
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
    attack(target: CombatTarget): void {
        // Apply damage
        super.attack(target);

        // Calculate angle to target
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const angle = Math.atan2(dy, dx);

        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = {
            position: new Vector2D(this.position.x, this.position.y),
            angle
        } as MuzzleFlash;

        // Create bullet casing with slight angle deviation
        const casingAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const casingSpeed = Constants.BULLET_CASING_SPEED_MIN + 
                           Math.random() * (Constants.BULLET_CASING_SPEED_MAX - Constants.BULLET_CASING_SPEED_MIN);
        this.lastShotEffects.casing = {
            position: new Vector2D(this.position.x, this.position.y),
            velocity: new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed)
        } as BulletCasing;

        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + (Math.random() - 0.5) * 1.0;
        const bounceSpeed = Constants.BOUNCING_BULLET_SPEED_MIN + 
                           Math.random() * (Constants.BOUNCING_BULLET_SPEED_MAX - Constants.BOUNCING_BULLET_SPEED_MIN);
        this.lastShotEffects.bouncingBullet = {
            position: new Vector2D(target.position.x, target.position.y),
            velocity: new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed)
        } as BouncingBullet;
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
 * Gatling Tower Building - Offensive building for Radiant faction
 * Copy of Cannon/Minigun with identical effects
 */
export class GatlingTower extends Building {
    private lastShotEffects: { 
        muzzleFlash?: MuzzleFlash, 
        casing?: BulletCasing, 
        bouncingBullet?: BouncingBullet 
    } = {};

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.GATLING_MAX_HEALTH,
            Constants.GATLING_RADIUS,
            Constants.GATLING_ATTACK_RANGE,
            Constants.GATLING_ATTACK_DAMAGE,
            Constants.GATLING_ATTACK_SPEED
        );
    }

    /**
     * Attack with visual effects like Marine
     */
    attack(target: CombatTarget): void {
        // Apply damage
        super.attack(target);

        // Calculate angle to target
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const angle = Math.atan2(dy, dx);

        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = {
            position: new Vector2D(this.position.x, this.position.y),
            angle
        } as MuzzleFlash;

        // Create bullet casing with slight angle deviation
        const casingAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const casingSpeed = Constants.BULLET_CASING_SPEED_MIN + 
                           Math.random() * (Constants.BULLET_CASING_SPEED_MAX - Constants.BULLET_CASING_SPEED_MIN);
        this.lastShotEffects.casing = {
            position: new Vector2D(this.position.x, this.position.y),
            velocity: new Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed)
        } as BulletCasing;

        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + (Math.random() - 0.5) * 1.0;
        const bounceSpeed = Constants.BOUNCING_BULLET_SPEED_MIN + 
                           Math.random() * (Constants.BOUNCING_BULLET_SPEED_MAX - Constants.BOUNCING_BULLET_SPEED_MIN);
        this.lastShotEffects.bouncingBullet = {
            position: new Vector2D(target.position.x, target.position.y),
            velocity: new Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed)
        } as BouncingBullet;
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
/**
 * Space Dust Swirler Building - Defensive building that absorbs projectiles
 * Swirls space dust in counter-clockwise orbits and absorbs projectiles within its influence radius.
 * The radius starts at half the max and grows over time, but shrinks when projectiles are absorbed.
 */
export class SpaceDustSwirler extends Building {
    currentInfluenceRadius: number; // Current active radius that grows/shrinks
    targetInfluenceRadius: number; // Target radius we're growing/shrinking towards

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
        
        // Start with half the max radius
        const initialRadius = Constants.SWIRLER_INFLUENCE_RADIUS * Constants.SWIRLER_INITIAL_RADIUS_MULTIPLIER;
        this.currentInfluenceRadius = initialRadius;
        this.targetInfluenceRadius = initialRadius;
    }

    /**
     * Update swirler state (called each frame)
     */
    update(
        deltaTime: number,
        enemies: CombatTarget[],
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        super.update(deltaTime, enemies, allUnits, asteroids);

        // Only grow radius if building is complete
        if (this.isComplete) {
            // Grow target radius towards max over time
            if (this.targetInfluenceRadius < Constants.SWIRLER_INFLUENCE_RADIUS) {
                this.targetInfluenceRadius = Math.min(
                    this.targetInfluenceRadius + Constants.SWIRLER_GROWTH_RATE_PER_SEC * deltaTime,
                    Constants.SWIRLER_INFLUENCE_RADIUS
                );
            }

            // Smoothly interpolate current radius towards target radius
            const radiusDiff = this.targetInfluenceRadius - this.currentInfluenceRadius;
            if (Math.abs(radiusDiff) > 0.1) {
                // Smooth transition: move 20% of the way to target each frame (exponential smoothing)
                this.currentInfluenceRadius += radiusDiff * 0.2;
            } else {
                this.currentInfluenceRadius = this.targetInfluenceRadius;
            }
        }
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

            // Only affect particles within current influence radius
            if (distance > this.currentInfluenceRadius || distance < 1) continue;

            // Calculate tangential (counter-clockwise) direction
            // Counter-clockwise perpendicular: (dy, -dx) normalized
            const tangentX = dy / distance;
            const tangentY = -dx / distance;

            // Calculate speed based on distance (faster closer to tower)
            const normalizedDistance = distance / this.currentInfluenceRadius;
            const speedMultiplier = Constants.SWIRLER_DUST_SPEED_MULTIPLIER * (1 - normalizedDistance);
            const orbitSpeed = Constants.SWIRLER_DUST_ORBIT_SPEED_BASE * (1 + speedMultiplier);

            // Apply tangential velocity (straight orbit, not spiral)
            particle.velocity.x = tangentX * orbitSpeed;
            particle.velocity.y = tangentY * orbitSpeed;
        }
    }

    /**
     * Check if a projectile should be absorbed
     * Returns true if projectile was absorbed (should be removed from game)
     */
    absorbProjectile(projectile: any): boolean {
        if (!this.isComplete) return false;

        const dx = projectile.position.x - this.position.x;
        const dy = projectile.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only absorb projectiles within current influence radius
        if (distance > this.currentInfluenceRadius) return false;

        // Shrink the target radius based on projectile damage
        // Different projectile types store damage differently
        let projectileDamage = 5; // Default damage
        if ('damage' in projectile && typeof projectile.damage === 'number') {
            projectileDamage = projectile.damage;
        } else if (projectile.constructor.name === 'GraveProjectile') {
            // Grave projectiles use GRAVE_ATTACK_DAMAGE
            projectileDamage = Constants.GRAVE_ATTACK_DAMAGE;
        } else if (projectile.constructor.name === 'InfluenceBallProjectile') {
            // Influence ball projectiles don't do direct damage, use a default value
            projectileDamage = 10;
        }
        
        const shrinkAmount = Constants.SWIRLER_SHRINK_BASE_RATE + (projectileDamage * Constants.SWIRLER_SHRINK_DAMAGE_MULTIPLIER);
        
        this.targetInfluenceRadius = Math.max(
            this.targetInfluenceRadius - shrinkAmount,
            Constants.SWIRLER_MIN_INFLUENCE_RADIUS
        );

        return true; // Projectile absorbed
    }

    /**
     * Legacy method for backward compatibility - now calls absorbProjectile
     */
    deflectProjectile(projectile: any): boolean {
        return this.absorbProjectile(projectile);
    }
}

/**
 * Foundry Building - Production building
 * Can produce solar mirrors and special units. Only one can exist at a time.
 */
export class SubsidiaryFactory extends Building {
    private productionTimer: number = 0;
    productionQueue: string[] = []; // Queue of items to produce
    currentProduction: string | null = null; // Currently producing item
    productionProgress: number = 0; // Progress of current production (0-1)

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
    update(deltaTime: number, enemies: CombatTarget[], allUnits: Unit[]): void {
        // Only produce when complete
        if (!this.isComplete) return;

        // Start production if idle
        if (!this.currentProduction && this.productionQueue.length > 0) {
            this.currentProduction = this.productionQueue.shift() || null;
            this.productionProgress = 0;
        }

        // Advance production
        if (this.currentProduction) {
            const productionTime = this.getProductionTime(this.currentProduction);
            this.productionProgress += deltaTime / productionTime;
            
            if (this.productionProgress >= 1.0) {
                // Production complete
                this.productionProgress = 0;
                this.currentProduction = null;
            }
        }
    }
    
    /**
     * Enqueue an item for production
     */
    enqueueProduction(itemType: string): void {
        this.productionQueue.push(itemType);
    }
    
    /**
     * Get the completed item and clear it
     */
    getCompletedProduction(): string | null {
        if (this.currentProduction && this.productionProgress >= 1.0) {
            const completed = this.currentProduction;
            this.currentProduction = null;
            this.productionProgress = 0;
            return completed;
        }
        return null;
    }
    
    /**
     * Get production time for an item type
     */
    private getProductionTime(itemType: string): number {
        if (itemType === 'solar-mirror') {
            return Constants.BUILDING_BUILD_TIME;
        }
        return Constants.SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL;
    }
}
