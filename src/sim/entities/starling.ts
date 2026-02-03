/**
 * Starling minion unit for SoL game
 * Basic minion unit that follows paths and attacks enemies
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Unit } from './unit';
import { LaserBeam, MinionProjectile } from './particles';
import { StellarForge } from './stellar-forge';
import { Building } from './buildings';
import type { Player } from './player';
import type { CombatTarget } from './buildings';
import type { Asteroid } from './asteroid';
import type { GameState } from '../game-state';

export class Starling extends Unit {
    private explorationTarget: Vector2D | null = null;
    private explorationTimer: number = 0;
    private currentPathWaypointIndex: number = 0; // Current waypoint index in the assigned path
    private assignedPath: Vector2D[] = [];
    private hasManualOrder: boolean = false;
    private lastShotLasers: LaserBeam[] = [];
    private pathHash: string = ''; // Unique identifier for the assigned path
    private hasReachedFinalWaypoint: boolean = false; // True when starling reaches the last waypoint
    public spriteLevel: number = 1; // Sprite level (1-4, changes based on starling upgrades)
    
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
        this.pathHash = this.generatePathHash(this.assignedPath);
    }
    
    /**
     * Generate a unique hash for the assigned path to identify starlings with the same movement instructions
     */
    private generatePathHash(path: Vector2D[]): string {
        if (path.length === 0) {
            return 'no-path';
        }
        // Create hash from path waypoints (rounded to avoid floating point issues)
        return path.map(waypoint => 
            `${Math.round(waypoint.x)},${Math.round(waypoint.y)}`
        ).join('|');
    }

    setManualRallyPoint(target: Vector2D): void {
        this.rallyPoint = target;
        this.hasManualOrder = true;
        // Reset the final waypoint flag since we're now moving to a new destination
        this.hasReachedFinalWaypoint = false;
    }

    setManualTarget(target: CombatTarget, rallyPoint: Vector2D | null): void {
        this.manualTarget = target;
        this.target = target;
        this.clearMovementOrders();
        this.hasManualOrder = true;
        this.hasReachedFinalWaypoint = false;
        if (rallyPoint) {
            this.setManualRallyPoint(rallyPoint);
        }
    }

    setPath(path: Vector2D[]): void {
        this.assignedPath = path.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
        this.pathHash = this.generatePathHash(this.assignedPath);
        this.currentPathWaypointIndex = 0;
        this.hasManualOrder = true;
        this.hasReachedFinalWaypoint = false;
        this.rallyPoint = null; // Clear rally point when following a path
    }

    getAssignedPathLength(): number {
        return this.assignedPath.length;
    }
    
    getPathHash(): string {
        return this.pathHash;
    }
    
    getHasReachedFinalWaypoint(): boolean {
        return this.hasReachedFinalWaypoint;
    }

    getCurrentPathWaypointIndex(): number {
        return this.currentPathWaypointIndex;
    }

    hasActiveManualOrder(): boolean {
        return this.hasManualOrder;
    }

    getAndClearLastShotProjectiles(): MinionProjectile[] {
        // Legacy method - no longer used for lasers
        return [];
    }
    
    getAndClearLastShotLasers(): LaserBeam[] {
        const lasers = this.lastShotLasers;
        this.lastShotLasers = [];
        return lasers;
    }

    /**
     * Update starling AI behavior (call this before regular update)
     */
    updateAI(gameState: GameState, enemies: CombatTarget[]): void {
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
                    this.hasReachedFinalWaypoint = true;
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

    /**
     * Override moveTowardRallyPoint to implement group stopping behavior
     * Starlings at their final waypoint will stop when touching other stopped starlings from the same group
     */
    protected moveTowardRallyPoint(
        deltaTime: number,
        moveSpeed: number,
        allUnits: Unit[],
        asteroids: Asteroid[] = []
    ): void {
        // Check if we should stop due to touching a stopped starling from our group
        // This only applies when we're heading to the final waypoint (not intermediate waypoints)
        if (this.assignedPath.length > 0 && 
            this.currentPathWaypointIndex === this.assignedPath.length - 1 &&
            !this.hasReachedFinalWaypoint &&
            this.rallyPoint !== null) {
            
            // Check for collision with other stopped starlings from the same group
            const stopDistance = Constants.UNIT_AVOIDANCE_RANGE_PX; // Use avoidance range as collision detection range
            
            for (let i = 0; i < allUnits.length; i++) {
                const otherUnit = allUnits[i];
                
                // Skip if not a starling, is self, is dead, or is not from the same team
                if (!(otherUnit instanceof Starling) || otherUnit === this || otherUnit.isDead() || otherUnit.owner !== this.owner) {
                    continue;
                }
                
                // Check if other starling is from the same group (same path hash)
                if (otherUnit.pathHash !== this.pathHash) {
                    continue;
                }
                
                // Check if other starling has reached its final waypoint and stopped
                if (!otherUnit.hasReachedFinalWaypoint) {
                    continue;
                }
                
                // Check if we're close enough to the stopped starling
                const offsetX = this.position.x - otherUnit.position.x;
                const offsetY = this.position.y - otherUnit.position.y;
                const distanceSq = offsetX * offsetX + offsetY * offsetY;
                
                if (distanceSq < stopDistance * stopDistance) {
                    // Stop this starling - we've touched a stopped starling from our group
                    this.rallyPoint = null;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.hasReachedFinalWaypoint = true;
                    return;
                }
            }
        }
        
        // Call parent implementation for normal movement
        super.moveTowardRallyPoint(deltaTime, moveSpeed, allUnits, asteroids);
    }

    /**
     * Override update to use custom movement speed
     */
    update(
        deltaTime: number,
        enemies: CombatTarget[],
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

    attack(target: CombatTarget): void {
        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) {
            return;
        }
        
        // Create laser beam for visual effect
        const laserBeam = new LaserBeam(
            new Vector2D(this.position.x, this.position.y),
            new Vector2D(target.position.x, target.position.y),
            this.owner,
            this.attackDamage
        );
        this.lastShotLasers.push(laserBeam);
        
        // Deal instant damage to target
        if ('takeDamage' in target) {
            target.takeDamage(this.attackDamage);
        }
    }
}
