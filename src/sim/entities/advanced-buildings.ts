/**
 * Advanced Building entities for SoL game
 * Contains: StrikerTower, LockOnLaserTower, ShieldTower
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import type { Player } from './player';
import type { Unit } from './unit';
import type { Asteroid } from './asteroid';
import { LaserBeam } from './particles';
import { Building, CombatTarget } from './buildings';

/**
 * Striker Tower - Manual-fire missile tower for Velaris faction
 * Reloads a missile every 10 seconds that the player must manually fire
 * Can only target areas that are in shade (not visible) and not visible by player units
 */
export class StrikerTower extends Building {
    private reloadTimer: number = 0;
    private missileReady: boolean = true;
    isAwaitingTarget: boolean = false; // True when player has clicked tower and is selecting target
    countdownTimer: number = 0; // Countdown timer when target is selected (see COUNTDOWN_DURATION)
    targetPosition: Vector2D | null = null; // Target position for missile strike
    private readonly COUNTDOWN_DURATION = 5.0; // Countdown duration in seconds

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.STRIKER_TOWER_MAX_HEALTH,
            Constants.STRIKER_TOWER_RADIUS,
            Constants.STRIKER_TOWER_ATTACK_RANGE,
            Constants.STRIKER_TOWER_ATTACK_DAMAGE,
            Constants.STRIKER_TOWER_ATTACK_SPEED
        );
        this.energyRequired = Constants.STRIKER_TOWER_COST;
    }

    /**
     * Update reload timer and countdown
     */
    update(
        deltaTime: number,
        enemies: CombatTarget[],
        allUnits: Unit[],
        asteroids: Asteroid[] = [],
        structures: CombatTarget[] = [],
        mapBoundaryPx: number = Constants.MAP_PLAYABLE_BOUNDARY
    ): void {
        // Don't call super.update() as we don't want auto-attack behavior
        
        // Only reload when complete
        if (!this.isComplete) return;

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
    isMissileReady(): boolean {
        return this.isComplete && this.missileReady;
    }

    /**
     * Check if tower is in countdown mode
     */
    isInCountdown(): boolean {
        return this.countdownTimer > 0 && this.targetPosition !== null;
    }

    /**
     * Get remaining countdown time
     */
    getRemainingCountdown(): number {
        return Math.max(0, this.countdownTimer);
    }

    /**
     * Start countdown for missile strike at target position
     */
    startCountdown(targetPosition: Vector2D): void {
        this.targetPosition = targetPosition;
        this.countdownTimer = this.COUNTDOWN_DURATION;
        this.isAwaitingTarget = false;
    }

    /**
     * Cancel countdown
     */
    cancelCountdown(): void {
        this.targetPosition = null;
        this.countdownTimer = 0;
        this.isAwaitingTarget = false;
    }

    /**
     * Check if a position is a valid target (in range, in shade, not visible by player units)
     */
    isValidTarget(
        targetPosition: Vector2D,
        isPositionInShade: (pos: Vector2D) => boolean,
        isPositionVisibleByPlayerUnits: (pos: Vector2D, playerUnits: Unit[]) => boolean,
        playerUnits: Unit[]
    ): boolean {
        // Check if target is in range
        const distance = this.position.distanceTo(targetPosition);
        if (distance > this.attackRange) return false;

        // Check if target is in shade (not visible)
        if (!isPositionInShade(targetPosition)) return false;

        // Check if target is not visible by player units
        if (isPositionVisibleByPlayerUnits(targetPosition, playerUnits)) return false;

        return true;
    }

    /**
     * Fire missile at target position
     * Returns true if missile was fired, false if not ready or conditions not met
     */
    fireMissile(
        targetPosition: Vector2D,
        enemies: CombatTarget[],
        isPositionInShade: (pos: Vector2D) => boolean,
        isPositionVisibleByPlayerUnits: (pos: Vector2D, playerUnits: Unit[]) => boolean,
        playerUnits: Unit[]
    ): boolean {
        if (!this.isMissileReady()) return false;

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
    getReloadProgress(): number {
        if (this.missileReady) return 1.0;
        return Math.min(1.0, this.reloadTimer / Constants.STRIKER_TOWER_RELOAD_TIME);
    }
}

/**
 * Lock-on Laser Tower - Lock-on laser tower for Velaris faction
 * Locks onto an enemy within range, and if they don't leave, fires a laser
 * that does massive damage to all enemies in that direction
 */
export class LockOnLaserTower extends Building {
    private lockedTarget: CombatTarget | null = null;
    private lockOnTimer: number = 0;
    private lastShotLasers: LaserBeam[] = [];

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.LOCKON_TOWER_MAX_HEALTH,
            Constants.LOCKON_TOWER_RADIUS,
            Constants.LOCKON_TOWER_ATTACK_RANGE,
            Constants.LOCKON_TOWER_ATTACK_DAMAGE,
            Constants.LOCKON_TOWER_ATTACK_SPEED
        );
        this.energyRequired = Constants.LOCKON_TOWER_COST;
    }

    /**
     * Update lock-on targeting and firing
     */
    update(
        deltaTime: number,
        enemies: CombatTarget[],
        allUnits: Unit[],
        asteroids: Asteroid[] = [],
        structures: CombatTarget[] = [],
        mapBoundaryPx: number = Constants.MAP_PLAYABLE_BOUNDARY
    ): void {
        // Don't call super.update() as we have custom targeting logic
        
        // Only operate when complete
        if (!this.isComplete) return;

        // Check if locked target is still valid (alive and in range)
        if (this.lockedTarget) {
            const targetStillValid = 
                !this.isTargetDead(this.lockedTarget) &&
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
        } else {
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
    private fireLaser(
        target: CombatTarget,
        enemies: CombatTarget[],
        structures: CombatTarget[],
        asteroids: Asteroid[],
        mapBoundaryPx: number
    ): void {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Calculate laser end point (boundary or obstacle)
        const boundaryDistance = this.getRayBoundaryDistance(
            this.position.x,
            this.position.y,
            dirX,
            dirY,
            mapBoundaryPx
        );
        let stopDistance = boundaryDistance;
        let stopStructure: CombatTarget | null = null;

        // Check for structures blocking the laser
        for (const structure of structures) {
            const radius = this.getStructureRadius(structure);
            const hitDistance = this.getRayCircleHitDistance(
                this.position.x,
                this.position.y,
                dirX,
                dirY,
                structure.position.x,
                structure.position.y,
                radius
            );
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = structure;
            }
        }

        // Check for asteroids blocking the laser
        for (const asteroid of asteroids) {
            const hitDistance = this.getRayCircleHitDistance(
                this.position.x,
                this.position.y,
                dirX,
                dirY,
                asteroid.position.x,
                asteroid.position.y,
                asteroid.size
            );
            if (hitDistance !== null && hitDistance < stopDistance) {
                stopDistance = hitDistance;
                stopStructure = null;
            }
        }

        const endPos = new Vector2D(
            this.position.x + dirX * stopDistance,
            this.position.y + dirY * stopDistance
        );

        // Create laser beam for rendering
        const laserBeam = new LaserBeam(
            new Vector2D(this.position.x, this.position.y),
            new Vector2D(endPos.x, endPos.y),
            this.owner,
            this.attackDamage,
            Constants.LOCKON_TOWER_LASER_WIDTH_PX
        );
        this.lastShotLasers.push(laserBeam);

        // Damage all enemies along the laser beam
        const beamHalfWidth = Constants.LOCKON_TOWER_LASER_WIDTH_PX * 0.5;
        for (const enemy of enemies) {
            if (!('collisionRadiusPx' in enemy)) continue;
            
            const toUnitX = enemy.position.x - this.position.x;
            const toUnitY = enemy.position.y - this.position.y;
            const projection = toUnitX * dirX + toUnitY * dirY;
            if (projection < 0 || projection > stopDistance) continue;
            
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
    getLockedTarget(): CombatTarget | null {
        return this.lockedTarget;
    }

    /**
     * Get lock-on progress (0 to 1)
     */
    getLockOnProgress(): number {
        if (!this.lockedTarget) return 0;
        return Math.min(1.0, this.lockOnTimer / Constants.LOCKON_TOWER_LOCKON_TIME);
    }

    /**
     * Get laser beams from last shot (for rendering)
     */
    getAndClearLastShotLasers(): LaserBeam[] {
        const lasers = this.lastShotLasers;
        this.lastShotLasers = [];
        return lasers;
    }

    private getRayBoundaryDistance(
        startX: number,
        startY: number,
        dirX: number,
        dirY: number,
        boundary: number
    ): number {
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

    private getRayCircleHitDistance(
        startX: number,
        startY: number,
        dirX: number,
        dirY: number,
        centerX: number,
        centerY: number,
        radius: number
    ): number | null {
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

    private getStructureRadius(structure: CombatTarget): number {
        if ('radius' in structure) {
            return structure.radius;
        }
        // Fallback for SolarMirror and other structures without explicit radius property
        return Constants.MIRROR_CLICK_RADIUS_PX;
    }
}

/**
 * Shield Tower Building - Defensive building for Radiant faction
 * Projects a shield that blocks enemies but allows friendly units to pass through
 */
export class ShieldTower extends Building {
    shieldHealth: number; // Current shield health
    maxShieldHealth: number; // Maximum shield health
    shieldActive: boolean; // Whether shield is currently active
    regenerationTimer: number; // Timer for shield regeneration cooldown
    shieldRadius: number; // Radius of shield projection

    constructor(position: Vector2D, owner: Player) {
        super(
            position,
            owner,
            Constants.SHIELD_TOWER_MAX_HEALTH,
            Constants.SHIELD_TOWER_RADIUS,
            Constants.SHIELD_TOWER_ATTACK_RANGE,
            Constants.SHIELD_TOWER_ATTACK_DAMAGE,
            Constants.SHIELD_TOWER_ATTACK_SPEED
        );
        
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
    update(
        deltaTime: number,
        enemies: CombatTarget[],
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        super.update(deltaTime, enemies, allUnits, asteroids);

        // Only process shield logic when building is complete
        if (!this.isComplete) return;

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
    damageShield(damage: number): boolean {
        if (!this.shieldActive || !this.isComplete) return false;

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
    isEnemyBlocked(enemyPosition: Vector2D): boolean {
        if (!this.shieldActive || !this.isComplete) return false;
        
        const dx = enemyPosition.x - this.position.x;
        const dy = enemyPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= this.shieldRadius;
    }

    /**
     * Get shield health percentage (0-1)
     */
    getShieldHealthPercent(): number {
        return this.shieldHealth / this.maxShieldHealth;
    }
}
