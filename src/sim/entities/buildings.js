"use strict";
/**
 * Building entities for SoL game
 * Extracted from game-core.ts
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
exports.ShieldTower = exports.LockOnLaserTower = exports.StrikerTower = exports.SubsidiaryFactory = exports.SpaceDustSwirler = exports.GatlingTower = exports.Minigun = exports.Building = void 0;
const math_1 = require("../math");
const Constants = __importStar(require("../../constants"));
const particles_1 = require("./particles");
const seeded_random_1 = require("../../seeded-random");
/**
 * Base class for all buildings
 */
class Building {
    constructor(position, owner, maxHealth, radius, attackRange, attackDamage, attackSpeed // attacks per second
    ) {
        this.position = position;
        this.owner = owner;
        this.radius = radius;
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackSpeed = attackSpeed;
        this.attackCooldown = 0;
        this.target = null;
        this.buildProgress = 0; // 0 to 1, building is complete at 1
        this.accumulatedEnergy = 0; // Energy accumulated from mirrors during construction
        this.energyRequired = 0; // Total energy required to complete construction
        this.isComplete = false;
        this.isSelected = false;
        this.isReceivingLight = false;
        this.incomingLightPerSec = 0;
        this.health = maxHealth;
        this.maxHealth = maxHealth;
    }
    /**
     * Update building logic
     */
    update(deltaTime, enemies, allUnits, asteroids = [], structures = [], mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
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
                this.attack(this.target, enemies, structures, asteroids, mapBoundaryPx);
                this.attackCooldown = 1.0 / this.attackSpeed;
            }
        }
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
    attack(target, _enemies = [], _structures = [], _asteroids = [], _mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
        // Base implementation
        if ('health' in target) {
            target.health -= this.attackDamage;
        }
    }
    /**
     * Take damage
     */
    takeDamage(amount) {
        this.health -= amount;
    }
    /**
     * Check if building is destroyed
     */
    isDestroyed() {
        return this.health <= 0;
    }
    /**
     * Add build progress (from energy or mirror light)
     */
    addBuildProgress(amount) {
        if (this.isComplete)
            return;
        this.buildProgress += amount;
        if (this.buildProgress >= 1.0) {
            this.buildProgress = 1.0;
            this.isComplete = true;
        }
    }
    /**
     * Add energy to building during construction
     */
    addEnergy(amount) {
        if (this.isComplete)
            return;
        this.accumulatedEnergy += amount;
        // Update build progress based on energy
        if (this.energyRequired > 0) {
            this.buildProgress = Math.min(1.0, this.accumulatedEnergy / this.energyRequired);
            if (this.buildProgress >= 1.0) {
                this.isComplete = true;
            }
        }
    }
    /**
     * Check if a point is within the building's radius
     */
    containsPoint(point) {
        const distance = this.position.distanceTo(point);
        return distance <= this.radius;
    }
    /**
     * Check if this building can shoot (has a gun)
     */
    canShoot() {
        // Only buildings with attack range and damage can shoot
        return this.attackRange > 0 && this.attackDamage > 0;
    }
}
exports.Building = Building;
/**
 * Cannon Building - Offensive building for Radiant faction
 * Fast-shooting defensive turret with visual effects like Marine
 */
class Minigun extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.MINIGUN_MAX_HEALTH, Constants.MINIGUN_RADIUS, Constants.MINIGUN_ATTACK_RANGE, Constants.MINIGUN_ATTACK_DAMAGE, Constants.MINIGUN_ATTACK_SPEED);
        this.lastShotEffects = {};
        this.lastShotLasers = [];
        this.energyRequired = Constants.MINIGUN_COST;
    }
    /**
     * Attack with visual effects like Marine
     */
    attack(target, enemies = [], structures = [], asteroids = [], mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) {
            return;
        }
        const dirX = dx / distance;
        const dirY = dy / distance;
        const boundaryDistance = this.getRayBoundaryDistance(this.position.x, this.position.y, dirX, dirY, mapBoundaryPx);
        let stopDistance = boundaryDistance;
        let stopStructure = null;
        for (const structure of structures) {
            const radius = this.getStructureRadius(structure);
            const hitDistance = this.getRayCircleHitDistance(this.position.x, this.position.y, dirX, dirY, structure.position.x, structure.position.y, radius);
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = structure;
            }
        }
        for (const asteroid of asteroids) {
            const hitDistance = this.getRayCircleHitDistance(this.position.x, this.position.y, dirX, dirY, asteroid.position.x, asteroid.position.y, asteroid.size);
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = null;
            }
        }
        const endPos = new math_1.Vector2D(this.position.x + dirX * stopDistance, this.position.y + dirY * stopDistance);
        const laserBeam = new particles_1.LaserBeam(new math_1.Vector2D(this.position.x, this.position.y), new math_1.Vector2D(endPos.x, endPos.y), this.owner, this.attackDamage, Constants.MINIGUN_LASER_WIDTH_PX);
        this.lastShotLasers.push(laserBeam);
        const beamHalfWidth = Constants.MINIGUN_LASER_WIDTH_PX * 0.5;
        const beamHalfWidthSq = beamHalfWidth * beamHalfWidth;
        for (const enemy of enemies) {
            if (!('collisionRadiusPx' in enemy)) {
                continue;
            }
            const toUnitX = enemy.position.x - this.position.x;
            const toUnitY = enemy.position.y - this.position.y;
            const projection = toUnitX * dirX + toUnitY * dirY;
            if (projection < 0 || projection > stopDistance) {
                continue;
            }
            const closestX = this.position.x + dirX * projection;
            const closestY = this.position.y + dirY * projection;
            const offsetX = enemy.position.x - closestX;
            const offsetY = enemy.position.y - closestY;
            const distanceSq = offsetX * offsetX + offsetY * offsetY;
            const effectiveRadius = beamHalfWidth + enemy.collisionRadiusPx;
            if (distanceSq <= effectiveRadius * effectiveRadius) {
                enemy.takeDamage(this.attackDamage);
            }
        }
        if (stopStructure && 'owner' in stopStructure && stopStructure.owner !== this.owner) {
            if ('health' in stopStructure) {
                stopStructure.health -= this.attackDamage;
            }
        }
        // Calculate angle to target
        const angle = Math.atan2(dy, dx);
        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = new particles_1.MuzzleFlash(new math_1.Vector2D(this.position.x, this.position.y), angle);
        // Create bullet casing with slight angle deviation
        const rng = (0, seeded_random_1.getGameRNG)();
        const casingAngle = angle + Math.PI / 2 + rng.nextFloat(-0.25, 0.25);
        const casingSpeed = rng.nextFloat(Constants.BULLET_CASING_SPEED_MIN, Constants.BULLET_CASING_SPEED_MAX);
        this.lastShotEffects.casing = new particles_1.BulletCasing(new math_1.Vector2D(this.position.x, this.position.y), new math_1.Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed));
        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + rng.nextFloat(-0.5, 0.5);
        const bounceSpeed = rng.nextFloat(Constants.BOUNCING_BULLET_SPEED_MIN, Constants.BOUNCING_BULLET_SPEED_MAX);
        this.lastShotEffects.bouncingBullet = new particles_1.BouncingBullet(new math_1.Vector2D(target.position.x, target.position.y), new math_1.Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed));
    }
    /**
     * Get effects from last shot (for game state to manage)
     */
    getAndClearLastShotEffects() {
        const effects = this.lastShotEffects;
        this.lastShotEffects = {};
        return effects;
    }
    getAndClearLastShotLasers() {
        const lasers = this.lastShotLasers;
        this.lastShotLasers = [];
        return lasers;
    }
    getRayBoundaryDistance(startX, startY, dirX, dirY, boundary) {
        let closestDistance = Infinity;
        if (Math.abs(dirX) > 0.001) {
            const tPos = (boundary - startX) / dirX;
            if (tPos > 0 && tPos < closestDistance) {
                closestDistance = tPos;
            }
            const tNeg = (-boundary - startX) / dirX;
            if (tNeg > 0 && tNeg < closestDistance) {
                closestDistance = tNeg;
            }
        }
        if (Math.abs(dirY) > 0.001) {
            const tPos = (boundary - startY) / dirY;
            if (tPos > 0 && tPos < closestDistance) {
                closestDistance = tPos;
            }
            const tNeg = (-boundary - startY) / dirY;
            if (tNeg > 0 && tNeg < closestDistance) {
                closestDistance = tNeg;
            }
        }
        return closestDistance === Infinity ? 0 : closestDistance;
    }
    getRayCircleHitDistance(startX, startY, dirX, dirY, centerX, centerY, radius) {
        const toCenterX = centerX - startX;
        const toCenterY = centerY - startY;
        const projection = toCenterX * dirX + toCenterY * dirY;
        if (projection < 0) {
            return null;
        }
        const closestX = startX + dirX * projection;
        const closestY = startY + dirY * projection;
        const offsetX = centerX - closestX;
        const offsetY = centerY - closestY;
        const distanceSq = offsetX * offsetX + offsetY * offsetY;
        const radiusSq = radius * radius;
        if (distanceSq > radiusSq) {
            return null;
        }
        const offset = Math.sqrt(radiusSq - distanceSq);
        const hitDistance = projection - offset;
        return hitDistance >= 0 ? hitDistance : projection + offset;
    }
    getStructureRadius(structure) {
        if ('radius' in structure) {
            return structure.radius;
        }
        // Fallback for SolarMirror and other structures without explicit radius property
        return Constants.MIRROR_CLICK_RADIUS_PX;
    }
}
exports.Minigun = Minigun;
/**
 * Gatling Tower Building - Offensive building for Radiant faction
 * Copy of Cannon/Minigun with identical effects
 */
class GatlingTower extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.GATLING_MAX_HEALTH, Constants.GATLING_RADIUS, Constants.GATLING_ATTACK_RANGE, Constants.GATLING_ATTACK_DAMAGE, Constants.GATLING_ATTACK_SPEED);
        this.lastShotEffects = {};
        this.energyRequired = Constants.GATLING_COST;
    }
    /**
     * Attack with visual effects like Marine
     */
    attack(target, _enemies = [], _structures = [], _asteroids = [], _mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
        // Apply damage
        super.attack(target);
        // Calculate angle to target
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const angle = Math.atan2(dy, dx);
        // Create muzzle flash
        this.lastShotEffects.muzzleFlash = new particles_1.MuzzleFlash(new math_1.Vector2D(this.position.x, this.position.y), angle);
        // Create bullet casing with slight angle deviation
        const rng = (0, seeded_random_1.getGameRNG)();
        const casingAngle = angle + Math.PI / 2 + rng.nextFloat(-0.25, 0.25);
        const casingSpeed = rng.nextFloat(Constants.BULLET_CASING_SPEED_MIN, Constants.BULLET_CASING_SPEED_MAX);
        this.lastShotEffects.casing = new particles_1.BulletCasing(new math_1.Vector2D(this.position.x, this.position.y), new math_1.Vector2D(Math.cos(casingAngle) * casingSpeed, Math.sin(casingAngle) * casingSpeed));
        // Create bouncing bullet at target position
        const bounceAngle = angle + Math.PI + rng.nextFloat(-0.5, 0.5);
        const bounceSpeed = rng.nextFloat(Constants.BOUNCING_BULLET_SPEED_MIN, Constants.BOUNCING_BULLET_SPEED_MAX);
        this.lastShotEffects.bouncingBullet = new particles_1.BouncingBullet(new math_1.Vector2D(target.position.x, target.position.y), new math_1.Vector2D(Math.cos(bounceAngle) * bounceSpeed, Math.sin(bounceAngle) * bounceSpeed));
    }
    /**
     * Get effects from last shot (for game state to manage)
     */
    getAndClearLastShotEffects() {
        const effects = this.lastShotEffects;
        this.lastShotEffects = {};
        return effects;
    }
}
exports.GatlingTower = GatlingTower;
/**
 * Space Dust Swirler Building - Defensive building for Radiant faction
 * Swirls space dust in counter-clockwise orbits and deflects non-melee projectiles
 */
/**
 * Space Dust Swirler Building - Defensive building that absorbs projectiles
 * Swirls space dust in counter-clockwise orbits and absorbs projectiles within its influence radius.
 * The radius starts at half the max and grows over time, but shrinks when projectiles are absorbed.
 */
class SpaceDustSwirler extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.SWIRLER_MAX_HEALTH, Constants.SWIRLER_RADIUS, Constants.SWIRLER_ATTACK_RANGE, Constants.SWIRLER_ATTACK_DAMAGE, Constants.SWIRLER_ATTACK_SPEED);
        this.energyRequired = Constants.SWIRLER_COST;
        // Start with half the max radius
        const initialRadius = Constants.SWIRLER_INFLUENCE_RADIUS * Constants.SWIRLER_INITIAL_RADIUS_MULTIPLIER;
        this.currentInfluenceRadius = initialRadius;
        this.targetInfluenceRadius = initialRadius;
    }
    /**
     * Update swirler state (called each frame)
     */
    update(deltaTime, enemies, allUnits, asteroids = []) {
        super.update(deltaTime, enemies, allUnits, asteroids);
        // Only grow radius if building is complete
        if (this.isComplete) {
            // Grow target radius towards max over time
            if (this.targetInfluenceRadius < Constants.SWIRLER_INFLUENCE_RADIUS) {
                this.targetInfluenceRadius = Math.min(this.targetInfluenceRadius + Constants.SWIRLER_GROWTH_RATE_PER_SEC * deltaTime, Constants.SWIRLER_INFLUENCE_RADIUS);
            }
            // Smoothly interpolate current radius towards target radius
            const radiusDiff = this.targetInfluenceRadius - this.currentInfluenceRadius;
            if (Math.abs(radiusDiff) > 0.1) {
                // Smooth transition: move 20% of the way to target each frame (exponential smoothing)
                this.currentInfluenceRadius += radiusDiff * 0.2;
            }
            else {
                this.currentInfluenceRadius = this.targetInfluenceRadius;
            }
        }
    }
    /**
     * Apply swirling force to space dust particles within influence radius
     */
    applyDustSwirl(particles, deltaTime) {
        if (!this.isComplete)
            return;
        for (const particle of particles) {
            const dx = particle.position.x - this.position.x;
            const dy = particle.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Only affect particles within current influence radius
            if (distance > this.currentInfluenceRadius || distance < 1)
                continue;
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
    absorbProjectile(projectile) {
        if (!this.isComplete)
            return false;
        const dx = projectile.position.x - this.position.x;
        const dy = projectile.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Only absorb projectiles within current influence radius
        if (distance > this.currentInfluenceRadius)
            return false;
        // Shrink the target radius based on projectile damage
        // Different projectile types store damage differently
        let projectileDamage = 5; // Default damage
        if ('damage' in projectile && typeof projectile.damage === 'number') {
            projectileDamage = projectile.damage;
        }
        else if (projectile.constructor.name === 'GraveProjectile') {
            // Grave projectiles use GRAVE_ATTACK_DAMAGE
            projectileDamage = Constants.GRAVE_ATTACK_DAMAGE;
        }
        else if (projectile.constructor.name === 'InfluenceBallProjectile') {
            // Influence ball projectiles don't do direct damage, use a default value
            projectileDamage = 10;
        }
        const shrinkAmount = Constants.SWIRLER_SHRINK_BASE_RATE + (projectileDamage * Constants.SWIRLER_SHRINK_DAMAGE_MULTIPLIER);
        this.targetInfluenceRadius = Math.max(this.targetInfluenceRadius - shrinkAmount, Constants.SWIRLER_MIN_INFLUENCE_RADIUS);
        return true; // Projectile absorbed
    }
    /**
     * Legacy method for backward compatibility - now calls absorbProjectile
     */
    deflectProjectile(projectile) {
        return this.absorbProjectile(projectile);
    }
}
exports.SpaceDustSwirler = SpaceDustSwirler;
/**
 * Foundry Building - Production building
 * Handles production and upgrades. Only one can exist at a time.
 */
class SubsidiaryFactory extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.SUBSIDIARY_FACTORY_MAX_HEALTH, Constants.SUBSIDIARY_FACTORY_RADIUS, Constants.SUBSIDIARY_FACTORY_ATTACK_RANGE, Constants.SUBSIDIARY_FACTORY_ATTACK_DAMAGE, Constants.SUBSIDIARY_FACTORY_ATTACK_SPEED);
        this.productionTimer = 0;
        this.completedProduction = null;
        this.productionQueue = []; // Queue of items to produce
        this.currentProduction = null; // Currently producing item
        this.productionProgress = 0; // Progress of current production (0-1)
        this.energyRequired = Constants.SUBSIDIARY_FACTORY_COST;
    }
    /**
     * Update production timer
     * Note: SubsidiaryFactory is a production building with no attack capability,
     * so we don't call super.update() which handles attack logic.
     */
    update(deltaTime, enemies, allUnits) {
        // Only produce when complete
        if (!this.isComplete)
            return;
        // Start production if idle
        if (!this.currentProduction && this.productionQueue.length > 0) {
            this.currentProduction = this.productionQueue.shift() || null;
            this.productionProgress = 0;
        }
        // Advance production
        if (this.currentProduction && this.isReceivingLight && this.incomingLightPerSec > 0) {
            const productionTime = this.getProductionTime(this.currentProduction);
            this.addProductionProgress(deltaTime / productionTime);
        }
    }
    /**
     * Enqueue an item for production
     */
    enqueueProduction(itemType) {
        this.productionQueue.push(itemType);
    }
    /**
     * Get the completed item and clear it
     */
    getCompletedProduction() {
        const completed = this.completedProduction;
        if (completed) {
            this.completedProduction = null;
        }
        return completed;
    }
    /**
     * Add production progress (from time or mirror light)
     */
    addProductionProgress(amount) {
        if (!this.currentProduction)
            return;
        this.productionProgress += amount;
        if (this.productionProgress >= 1.0) {
            this.productionProgress = 0;
            this.completedProduction = this.currentProduction;
            this.currentProduction = null;
        }
    }
    /**
     * Add production progress based on an energy boost (e.g., sacrificed starlings).
     */
    addProductionEnergyBoost(energyAmount) {
        if (!this.currentProduction)
            return;
        const energyRequired = this.getProductionEnergyCost(this.currentProduction);
        if (energyRequired <= 0) {
            return;
        }
        this.addProductionProgress(energyAmount / energyRequired);
    }
    /**
     * Get production time for an item type
     */
    getProductionTime(itemType) {
        if (itemType === 'solar-mirror') {
            return Constants.BUILDING_BUILD_TIME;
        }
        return Constants.SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL;
    }
    getProductionEnergyCost(itemType) {
        if (itemType === Constants.FOUNDRY_STRAFE_UPGRADE_ITEM) {
            return Constants.FOUNDRY_STRAFE_UPGRADE_COST;
        }
        if (itemType === Constants.FOUNDRY_REGEN_UPGRADE_ITEM) {
            return Constants.FOUNDRY_REGEN_UPGRADE_COST;
        }
        if (itemType === Constants.FOUNDRY_ATTACK_UPGRADE_ITEM) {
            return Constants.FOUNDRY_ATTACK_UPGRADE_COST;
        }
        if (itemType === Constants.FOUNDRY_BLINK_UPGRADE_ITEM) {
            return Constants.FOUNDRY_BLINK_UPGRADE_COST;
        }
        return Constants.SUBSIDIARY_FACTORY_COST;
    }
    /**
     * Check if Strafe upgrade is available
     */
    canUpgradeStrafe() {
        return this.isComplete && !this.owner.hasStrafeUpgrade;
    }
    /**
     * Check if Strafe upgrade can be queued for production
     */
    canQueueStrafeUpgrade() {
        return this.canUpgradeStrafe() && !this.hasProductionItem(Constants.FOUNDRY_STRAFE_UPGRADE_ITEM);
    }
    /**
     * Check if Regen upgrade is available
     */
    canUpgradeRegen() {
        return this.isComplete && !this.owner.hasRegenUpgrade;
    }
    /**
     * Check if Blink upgrade is available
     */
    canUpgradeBlink() {
        return this.isComplete && !this.owner.hasBlinkUpgrade;
    }
    /**
     * Check if +1 ATK upgrade is available
     */
    canUpgradeAttack() {
        return this.isComplete && !this.owner.hasAttackUpgrade;
    }
    /**
     * Check if Regen upgrade can be queued for production
     */
    canQueueRegenUpgrade() {
        return this.canUpgradeRegen() && !this.hasProductionItem(Constants.FOUNDRY_REGEN_UPGRADE_ITEM);
    }
    /**
     * Check if Blink upgrade can be queued for production
     */
    canQueueBlinkUpgrade() {
        return this.canUpgradeBlink() && !this.hasProductionItem(Constants.FOUNDRY_BLINK_UPGRADE_ITEM);
    }
    /**
     * Check if +1 ATK upgrade can be queued for production
     */
    canQueueAttackUpgrade() {
        return this.canUpgradeAttack() && !this.hasProductionItem(Constants.FOUNDRY_ATTACK_UPGRADE_ITEM);
    }
    /**
     * Check if a production item is already queued or active
     */
    hasProductionItem(itemType) {
        return this.currentProduction === itemType || this.productionQueue.includes(itemType);
    }
    /**
     * Upgrade starlings with Strafe
     */
    upgradeStrafe() {
        if (!this.canUpgradeStrafe())
            return false;
        this.owner.hasStrafeUpgrade = true;
        return true;
    }
    /**
     * Upgrade starlings with Regen
     */
    upgradeRegen() {
        if (!this.canUpgradeRegen())
            return false;
        this.owner.hasRegenUpgrade = true;
        return true;
    }
    /**
     * Upgrade starlings with Blink
     */
    upgradeBlink() {
        if (!this.canUpgradeBlink())
            return false;
        this.owner.hasBlinkUpgrade = true;
        return true;
    }
    /**
     * Upgrade starlings with +1 ATK
     */
    upgradeAttack() {
        if (!this.canUpgradeAttack())
            return false;
        this.owner.hasAttackUpgrade = true;
        return true;
    }
}
exports.SubsidiaryFactory = SubsidiaryFactory;
/**
 * Striker Tower - Manual-fire missile tower for Velaris faction
 * Reloads a missile every 10 seconds that the player must manually fire
 * Can only target areas that are in shade (not visible) and not visible by player units
 */
class StrikerTower extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.STRIKER_TOWER_MAX_HEALTH, Constants.STRIKER_TOWER_RADIUS, Constants.STRIKER_TOWER_ATTACK_RANGE, Constants.STRIKER_TOWER_ATTACK_DAMAGE, Constants.STRIKER_TOWER_ATTACK_SPEED);
        this.reloadTimer = 0;
        this.missileReady = true;
        this.isAwaitingTarget = false; // True when player has clicked tower and is selecting target
        this.countdownTimer = 0; // Countdown timer when target is selected (see COUNTDOWN_DURATION)
        this.targetPosition = null; // Target position for missile strike
        this.COUNTDOWN_DURATION = 5.0; // Countdown duration in seconds
        this.energyRequired = Constants.STRIKER_TOWER_COST;
    }
    /**
     * Update reload timer and countdown
     */
    update(deltaTime, enemies, allUnits, asteroids = [], structures = [], mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
        // Don't call super.update() as we don't want auto-attack behavior
        // Only reload when complete
        if (!this.isComplete)
            return;
        // Update countdown if target is selected
        if (this.targetPosition !== null && this.countdownTimer > 0) {
            this.countdownTimer -= deltaTime;
            // Countdown will be handled by game-state.ts when it reaches <= 0
        }
        // Update reload timer if missile not ready
        if (!this.missileReady) {
            this.reloadTimer += deltaTime;
            if (this.reloadTimer >= Constants.STRIKER_TOWER_RELOAD_TIME) {
                this.missileReady = true;
                this.reloadTimer = 0;
            }
        }
    }
    /**
     * Check if missile is ready to fire
     */
    isMissileReady() {
        return this.isComplete && this.missileReady;
    }
    /**
     * Check if tower is in countdown mode
     */
    isInCountdown() {
        return this.countdownTimer > 0 && this.targetPosition !== null;
    }
    /**
     * Get remaining countdown time
     */
    getRemainingCountdown() {
        return Math.max(0, this.countdownTimer);
    }
    /**
     * Start countdown for missile strike at target position
     */
    startCountdown(targetPosition) {
        this.targetPosition = targetPosition;
        this.countdownTimer = this.COUNTDOWN_DURATION;
        this.isAwaitingTarget = false;
    }
    /**
     * Cancel countdown
     */
    cancelCountdown() {
        this.targetPosition = null;
        this.countdownTimer = 0;
        this.isAwaitingTarget = false;
    }
    /**
     * Check if a position is a valid target (in range, in shade, not visible by player units)
     */
    isValidTarget(targetPosition, isPositionInShade, isPositionVisibleByPlayerUnits, playerUnits) {
        // Check if target is in range
        const distance = this.position.distanceTo(targetPosition);
        if (distance > this.attackRange)
            return false;
        // Check if target is in shade (not visible)
        if (!isPositionInShade(targetPosition))
            return false;
        // Check if target is not visible by player units
        if (isPositionVisibleByPlayerUnits(targetPosition, playerUnits))
            return false;
        return true;
    }
    /**
     * Fire missile at target position
     * Returns true if missile was fired, false if not ready or conditions not met
     */
    fireMissile(targetPosition, enemies, isPositionInShade, isPositionVisibleByPlayerUnits, playerUnits) {
        if (!this.isMissileReady())
            return false;
        // Validate target (this should already be validated, but double check)
        if (!this.isValidTarget(targetPosition, isPositionInShade, isPositionVisibleByPlayerUnits, playerUnits)) {
            return false;
        }
        // Fire missile - damage all enemies in explosion radius
        for (const enemy of enemies) {
            const distanceToEnemy = targetPosition.distanceTo(enemy.position);
            if (distanceToEnemy <= Constants.STRIKER_TOWER_EXPLOSION_RADIUS) {
                if ('health' in enemy) {
                    enemy.health -= this.attackDamage;
                }
            }
        }
        // Missile fired, start reload and clear countdown state
        this.missileReady = false;
        this.reloadTimer = 0;
        this.targetPosition = null;
        this.countdownTimer = 0;
        this.isAwaitingTarget = false;
        return true;
    }
    /**
     * Get reload progress (0 to 1)
     */
    getReloadProgress() {
        if (this.missileReady)
            return 1.0;
        return Math.min(1.0, this.reloadTimer / Constants.STRIKER_TOWER_RELOAD_TIME);
    }
}
exports.StrikerTower = StrikerTower;
/**
 * Lock-on Laser Tower - Lock-on laser tower for Velaris faction
 * Locks onto an enemy within range, and if they don't leave, fires a laser
 * that does massive damage to all enemies in that direction
 */
class LockOnLaserTower extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.LOCKON_TOWER_MAX_HEALTH, Constants.LOCKON_TOWER_RADIUS, Constants.LOCKON_TOWER_ATTACK_RANGE, Constants.LOCKON_TOWER_ATTACK_DAMAGE, Constants.LOCKON_TOWER_ATTACK_SPEED);
        this.lockedTarget = null;
        this.lockOnTimer = 0;
        this.lastShotLasers = [];
        this.energyRequired = Constants.LOCKON_TOWER_COST;
    }
    /**
     * Update lock-on targeting and firing
     */
    update(deltaTime, enemies, allUnits, asteroids = [], structures = [], mapBoundaryPx = Constants.MAP_PLAYABLE_BOUNDARY) {
        // Don't call super.update() as we have custom targeting logic
        // Only operate when complete
        if (!this.isComplete)
            return;
        // Check if locked target is still valid (alive and in range)
        if (this.lockedTarget) {
            const targetStillValid = !this.isTargetDead(this.lockedTarget) &&
                this.position.distanceTo(this.lockedTarget.position) <= this.attackRange;
            if (!targetStillValid) {
                // Target left range or died, cancel lock-on
                this.lockedTarget = null;
                this.lockOnTimer = 0;
                return;
            }
            // Continue locking on
            this.lockOnTimer += deltaTime;
            // If lock-on complete, fire laser
            if (this.lockOnTimer >= Constants.LOCKON_TOWER_LOCKON_TIME) {
                this.fireLaser(this.lockedTarget, enemies, structures, asteroids, mapBoundaryPx);
                // Reset after firing
                this.lockedTarget = null;
                this.lockOnTimer = 0;
            }
        }
        else {
            // Find new target to lock on to
            this.lockedTarget = this.findNearestEnemy(enemies);
            if (this.lockedTarget) {
                this.lockOnTimer = 0;
            }
        }
    }
    /**
     * Fire laser at locked target, damaging all enemies in the direction
     */
    fireLaser(target, enemies, structures, asteroids, mapBoundaryPx) {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0)
            return;
        const dirX = dx / distance;
        const dirY = dy / distance;
        // Calculate laser end point (boundary or obstacle)
        const boundaryDistance = this.getRayBoundaryDistance(this.position.x, this.position.y, dirX, dirY, mapBoundaryPx);
        let stopDistance = boundaryDistance;
        let stopStructure = null;
        // Check for structures blocking the laser
        for (const structure of structures) {
            const radius = this.getStructureRadius(structure);
            const hitDistance = this.getRayCircleHitDistance(this.position.x, this.position.y, dirX, dirY, structure.position.x, structure.position.y, radius);
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = structure;
            }
        }
        // Check for asteroids blocking the laser
        for (const asteroid of asteroids) {
            const hitDistance = this.getRayCircleHitDistance(this.position.x, this.position.y, dirX, dirY, asteroid.position.x, asteroid.position.y, asteroid.size);
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = null;
            }
        }
        const endPos = new math_1.Vector2D(this.position.x + dirX * stopDistance, this.position.y + dirY * stopDistance);
        // Create laser beam for rendering
        const laserBeam = new particles_1.LaserBeam(new math_1.Vector2D(this.position.x, this.position.y), new math_1.Vector2D(endPos.x, endPos.y), this.owner, this.attackDamage, Constants.LOCKON_TOWER_LASER_WIDTH_PX);
        this.lastShotLasers.push(laserBeam);
        // Damage all enemies along the laser beam
        const beamHalfWidth = Constants.LOCKON_TOWER_LASER_WIDTH_PX * 0.5;
        for (const enemy of enemies) {
            if (!('collisionRadiusPx' in enemy))
                continue;
            const toUnitX = enemy.position.x - this.position.x;
            const toUnitY = enemy.position.y - this.position.y;
            const projection = toUnitX * dirX + toUnitY * dirY;
            if (projection < 0 || projection > stopDistance)
                continue;
            const closestX = this.position.x + dirX * projection;
            const closestY = this.position.y + dirY * projection;
            const offsetX = enemy.position.x - closestX;
            const offsetY = enemy.position.y - closestY;
            const distanceSq = offsetX * offsetX + offsetY * offsetY;
            const effectiveRadius = beamHalfWidth + enemy.collisionRadiusPx;
            if (distanceSq <= effectiveRadius * effectiveRadius) {
                enemy.takeDamage(this.attackDamage);
            }
        }
        // Damage structure if hit
        if (stopStructure && 'owner' in stopStructure && stopStructure.owner !== this.owner) {
            if ('health' in stopStructure) {
                stopStructure.health -= this.attackDamage;
            }
        }
    }
    /**
     * Get the current locked target
     */
    getLockedTarget() {
        return this.lockedTarget;
    }
    /**
     * Get lock-on progress (0 to 1)
     */
    getLockOnProgress() {
        if (!this.lockedTarget)
            return 0;
        return Math.min(1.0, this.lockOnTimer / Constants.LOCKON_TOWER_LOCKON_TIME);
    }
    /**
     * Get laser beams from last shot (for rendering)
     */
    getAndClearLastShotLasers() {
        const lasers = this.lastShotLasers;
        this.lastShotLasers = [];
        return lasers;
    }
    getRayBoundaryDistance(startX, startY, dirX, dirY, boundary) {
        let closestDistance = Infinity;
        if (Math.abs(dirX) > 0.001) {
            const tPos = (boundary - startX) / dirX;
            if (tPos > 0 && tPos < closestDistance) {
                closestDistance = tPos;
            }
            const tNeg = (-boundary - startX) / dirX;
            if (tNeg > 0 && tNeg < closestDistance) {
                closestDistance = tNeg;
            }
        }
        if (Math.abs(dirY) > 0.001) {
            const tPos = (boundary - startY) / dirY;
            if (tPos > 0 && tPos < closestDistance) {
                closestDistance = tPos;
            }
            const tNeg = (-boundary - startY) / dirY;
            if (tNeg > 0 && tNeg < closestDistance) {
                closestDistance = tNeg;
            }
        }
        return closestDistance === Infinity ? 0 : closestDistance;
    }
    getRayCircleHitDistance(startX, startY, dirX, dirY, centerX, centerY, radius) {
        const toCenterX = centerX - startX;
        const toCenterY = centerY - startY;
        const projection = toCenterX * dirX + toCenterY * dirY;
        if (projection < 0) {
            return null;
        }
        const closestX = startX + dirX * projection;
        const closestY = startY + dirY * projection;
        const offsetX = centerX - closestX;
        const offsetY = centerY - closestY;
        const distanceSq = offsetX * offsetX + offsetY * offsetY;
        const radiusSq = radius * radius;
        if (distanceSq > radiusSq) {
            return null;
        }
        const offset = Math.sqrt(radiusSq - distanceSq);
        const hitDistance = projection - offset;
        return hitDistance >= 0 ? hitDistance : projection + offset;
    }
    getStructureRadius(structure) {
        if ('radius' in structure) {
            return structure.radius;
        }
        // Fallback for SolarMirror and other structures without explicit radius property
        return Constants.MIRROR_CLICK_RADIUS_PX;
    }
}
exports.LockOnLaserTower = LockOnLaserTower;
/**
 * Shield Tower Building - Defensive building for Radiant faction
 * Projects a shield that blocks enemies but allows friendly units to pass through
 */
class ShieldTower extends Building {
    constructor(position, owner) {
        super(position, owner, Constants.SHIELD_TOWER_MAX_HEALTH, Constants.SHIELD_TOWER_RADIUS, Constants.SHIELD_TOWER_ATTACK_RANGE, Constants.SHIELD_TOWER_ATTACK_DAMAGE, Constants.SHIELD_TOWER_ATTACK_SPEED);
        this.energyRequired = Constants.SHIELD_TOWER_COST;
        this.maxShieldHealth = Constants.SHIELD_TOWER_SHIELD_HEALTH;
        this.shieldHealth = this.maxShieldHealth;
        this.shieldActive = true;
        this.regenerationTimer = 0;
        this.shieldRadius = Constants.SHIELD_TOWER_SHIELD_RADIUS;
    }
    /**
     * Update shield tower state (called each frame)
     */
    update(deltaTime, enemies, allUnits, asteroids = []) {
        super.update(deltaTime, enemies, allUnits, asteroids);
        // Only process shield logic when building is complete
        if (!this.isComplete)
            return;
        // If shield is down, handle regeneration timer
        if (!this.shieldActive) {
            this.regenerationTimer += deltaTime;
            // Check if we can reactivate the shield
            if (this.regenerationTimer >= Constants.SHIELD_TOWER_REGENERATION_TIME) {
                // Check if there are any enemies within shield radius
                const hasEnemiesInRadius = enemies.some(enemy => {
                    const dx = enemy.position.x - this.position.x;
                    const dy = enemy.position.y - this.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    return distance <= this.shieldRadius;
                });
                // Only reactivate if no enemies are present
                if (!hasEnemiesInRadius) {
                    this.shieldActive = true;
                    this.shieldHealth = this.maxShieldHealth;
                    this.regenerationTimer = 0;
                }
            }
        }
    }
    /**
     * Damage the shield. Returns true if shield absorbed the damage, false if shield is down.
     */
    damageShield(damage) {
        if (!this.shieldActive || !this.isComplete)
            return false;
        this.shieldHealth -= damage;
        if (this.shieldHealth <= 0) {
            this.shieldHealth = 0;
            this.shieldActive = false;
            this.regenerationTimer = 0;
        }
        return true;
    }
    /**
     * Check if an enemy is blocked by the shield
     */
    isEnemyBlocked(enemyPosition) {
        if (!this.shieldActive || !this.isComplete)
            return false;
        const dx = enemyPosition.x - this.position.x;
        const dy = enemyPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.shieldRadius;
    }
    /**
     * Get shield health percentage (0-1)
     */
    getShieldHealthPercent() {
        return this.shieldHealth / this.maxShieldHealth;
    }
}
exports.ShieldTower = ShieldTower;
