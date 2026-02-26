/**
 * Physics System
 * Handles all physics simulation and collision logic
 * 
 * Extracted from game-state.ts as part of Phase 3 refactoring
 */

import { Vector2D, applyKnockbackVelocity } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Asteroid } from '../entities/asteroid';
import { SolarMirror } from '../entities/solar-mirror';
import { StellarForge } from '../entities/stellar-forge';
import { Building } from '../entities/buildings';
import { Unit } from '../entities/unit';
import { SpaceDustParticle } from '../entities/particles';

/**
 * Physics context interface - defines what PhysicsSystem needs from GameState
 */
export interface PhysicsContext {
    asteroids: Asteroid[];
    spaceDust: SpaceDustParticle[];
    players: Player[];
    dustSpatialHash: Map<number, number[]>;
    dustSpatialHashKeys: number[];
}

/**
 * Physics System - handles all physics and collision calculations
 */
export class PhysicsSystem {
    // Collision resolution constants
    private static readonly MAX_PUSH_DISTANCE = 10; // Maximum push distance for collision resolution
    private static readonly PUSH_MULTIPLIER = 15; // Multiplier for push strength calculation

    /**
     * Check for collision at a position
     * PUBLIC method - used by AI, commands, pathfinding, etc.
     */
    static checkCollision(
        context: PhysicsContext,
        position: Vector2D,
        unitRadius: number = Constants.UNIT_RADIUS_PX,
        ignoredObject: SolarMirror | StellarForge | Building | null = null
    ): boolean {
        // Suns no longer block movement or placement

        // Check collision with asteroids
        for (const asteroid of context.asteroids) {
            if (asteroid.containsPoint(position)) {
                return true; // Inside asteroid
            }
        }

        // Check collision with all players' buildings
        for (const player of context.players) {
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

    /**
     * Resolve collisions between units
     */
    static resolveUnitCollisions(allUnits: Unit[]): void {
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

    /**
     * Resolve collisions between units and obstacles (asteroids, buildings, etc.)
     */
    static resolveUnitObstacleCollisions(context: PhysicsContext, allUnits: Unit[]): void {
        for (const unit of allUnits) {
            if (unit.isDead()) {
                continue;
            }

            const oldX = unit.position.x;
            const oldY = unit.position.y;

            if (this.checkCollision(context, unit.position, unit.collisionRadiusPx)) {
                // Smooth collision: Find the nearest obstacle and push away from it gently
                let pushX = 0;
                let pushY = 0;
                let pushCount = 0;

                // Check all obstacles and accumulate push directions
                // Suns no longer block movement

                // Check asteroids
                for (const asteroid of context.asteroids) {
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
                for (const player of context.players) {
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
                for (const player of context.players) {
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
                for (const player of context.players) {
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
                        unit.position.x = oldX + (pushX / pushLength) * pushDistance;
                        unit.position.y = oldY + (pushY / pushLength) * pushDistance;
                    }
                }

                // If still in collision after push, stop the unit
                if (this.checkCollision(context, unit.position, unit.collisionRadiusPx)) {
                    unit.position.x = oldX;
                    unit.position.y = oldY;
                    if (unit.rallyPoint && this.checkCollision(context, unit.rallyPoint, unit.collisionRadiusPx)) {
                        unit.rallyPoint = null;
                    }
                }
            }

            this.clampUnitOutsideStructures(context, unit);
        }
    }

    /**
     * Apply knockback from rotating asteroids
     */
    static applyAsteroidRotationKnockback(context: PhysicsContext): void {
        // Check each asteroid for collisions with units and solar mirrors
        for (const asteroid of context.asteroids) {
            // Check all players' units
            for (const player of context.players) {
                // Check units
                for (const unit of player.units) {
                    // Broad-phase check: skip if unit is definitely outside asteroid
                    // Use 1.4x size as safety margin since asteroid vertices can extend up to 1.32x base size
                    const distance = unit.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size * 1.4 + unit.collisionRadiusPx) {
                        // Use precise polygon check
                        if (asteroid.containsPoint(unit.position)) {
                            // Apply knockback away from asteroid center
                            applyKnockbackVelocity(
                                unit.position,
                                unit.knockbackVelocity,
                                asteroid.position,
                                Constants.ASTEROID_KNOCKBACK_INITIAL_VELOCITY
                            );
                        }
                    }
                }
                
                // Check solar mirrors
                for (const mirror of player.solarMirrors) {
                    // Broad-phase check: skip if mirror is definitely outside asteroid
                    const distance = mirror.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size * 1.4 + Constants.SOLAR_MIRROR_COLLISION_RADIUS) {
                        // Use precise polygon check
                        if (asteroid.containsPoint(mirror.position)) {
                            // Apply knockback away from asteroid center
                            applyKnockbackVelocity(
                                mirror.position,
                                mirror.knockbackVelocity,
                                asteroid.position,
                                Constants.ASTEROID_KNOCKBACK_INITIAL_VELOCITY
                            );
                        }
                    }
                }
            }
        }
    }

    /**
     * Clamp unit position to stay outside structures
     */
    static clampUnitOutsideStructures(context: PhysicsContext, unit: Unit): void {
        for (const player of context.players) {
            if (player.stellarForge) {
                this.pushUnitOutsideCircle(unit, player.stellarForge.position, player.stellarForge.radius);
            }

            for (const building of player.buildings) {
                this.pushUnitOutsideCircle(unit, building.position, building.radius);
            }
        }
    }

    /**
     * Push unit outside a circular obstacle
     */
    static pushUnitOutsideCircle(unit: Unit, center: Vector2D, radius: number): void {
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
     * Apply repulsion forces between dust particles
     */
    static applyDustRepulsion(context: PhysicsContext, deltaTime: number): void {
        const cellSize = Constants.DUST_REPULSION_CELL_SIZE_PX;
        const repulsionRadiusPx = Constants.DUST_REPULSION_RADIUS_PX;
        const repulsionRadiusSq = repulsionRadiusPx * repulsionRadiusPx;
        const repulsionStrength = Constants.DUST_REPULSION_STRENGTH;

        for (let i = 0; i < context.dustSpatialHashKeys.length; i++) {
            const key = context.dustSpatialHashKeys[i];
            const bucket = context.dustSpatialHash.get(key);
            if (bucket) {
                bucket.length = 0;
            }
        }
        context.dustSpatialHashKeys.length = 0;

        for (let i = 0; i < context.spaceDust.length; i++) {
            const particle = context.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            const key = (cellX << 16) ^ (cellY & 0xffff);
            let bucket = context.dustSpatialHash.get(key);
            if (!bucket) {
                bucket = [];
                context.dustSpatialHash.set(key, bucket);
            }
            if (bucket.length === 0) {
                context.dustSpatialHashKeys.push(key);
            }
            bucket.push(i);
        }

        for (let i = 0; i < context.spaceDust.length; i++) {
            const particle = context.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            let forceX = 0;
            let forceY = 0;

            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const neighborKey = ((cellX + offsetX) << 16) ^ ((cellY + offsetY) & 0xffff);
                    const bucket = context.dustSpatialHash.get(neighborKey);
                    if (!bucket) {
                        continue;
                    }

                    for (let j = 0; j < bucket.length; j++) {
                        const neighborIndex = bucket[j];
                        if (neighborIndex === i) {
                            continue;
                        }
                        const neighbor = context.spaceDust[neighborIndex];
                        const dx = particle.position.x - neighbor.position.x;
                        const dy = particle.position.y - neighbor.position.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > 0 && distSq < repulsionRadiusSq) {
                            const dist = Math.sqrt(distSq);
                            const proximity = 1 - dist / repulsionRadiusPx;
                            const strength = proximity * proximity * repulsionStrength;
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

    /**
     * Resolve collision between dust particle and asteroids
     */
    static resolveDustAsteroidCollision(context: PhysicsContext, particle: SpaceDustParticle, deltaTime: number): void {
        const collisionPaddingPx = Constants.DUST_ASTEROID_COLLISION_PADDING_PX;
        const restitution = Constants.DUST_ASTEROID_BOUNCE_RESTITUTION;
        const tangentialPushMultiplier = Constants.DUST_ASTEROID_TANGENTIAL_PUSH_MULTIPLIER;
        const rotationCollisionPushMultiplier = Constants.DUST_ASTEROID_ROTATION_COLLISION_PUSH_MULTIPLIER;

        for (let asteroidIndex = 0; asteroidIndex < context.asteroids.length; asteroidIndex++) {
            const asteroid = context.asteroids[asteroidIndex];
            const dx = particle.position.x - asteroid.position.x;
            const dy = particle.position.y - asteroid.position.y;
            const distanceSq = dx * dx + dy * dy;
            const collisionRadius = asteroid.size + collisionPaddingPx;
            const collisionRadiusSq = collisionRadius * collisionRadius;

            if (distanceSq > collisionRadiusSq) {
                continue;
            }

            const distance = Math.sqrt(distanceSq);
            const normalX = distance > 0.0001 ? dx / distance : 1;
            const normalY = distance > 0.0001 ? dy / distance : 0;
            const penetrationDepth = collisionRadius - distance;

            if (penetrationDepth > 0) {
                particle.position.x += normalX * penetrationDepth;
                particle.position.y += normalY * penetrationDepth;
            }

            const normalVelocity = particle.velocity.x * normalX + particle.velocity.y * normalY;
            if (normalVelocity < 0) {
                particle.velocity.x -= (1 + restitution) * normalVelocity * normalX;
                particle.velocity.y -= (1 + restitution) * normalVelocity * normalY;
            }

            const tangentialDirectionX = -normalY;
            const tangentialDirectionY = normalX;
            const tangentialSpeed = asteroid.rotationSpeed * collisionRadius;
            particle.velocity.x += tangentialDirectionX * tangentialSpeed * tangentialPushMultiplier * deltaTime;
            particle.velocity.y += tangentialDirectionY * tangentialSpeed * tangentialPushMultiplier * deltaTime;

            if (penetrationDepth > 0) {
                const collisionPushSpeed = Math.abs(tangentialSpeed) * rotationCollisionPushMultiplier;
                particle.velocity.x += normalX * collisionPushSpeed;
                particle.velocity.y += normalY * collisionPushSpeed;
            }
        }
    }

    /**
     * Apply dust push from a moving entity (helper for fluid forces)
     */
    static applyDustPushFromMovingEntity(
        context: PhysicsContext,
        position: Vector2D,
        velocity: Vector2D,
        radiusPx: number,
        forceMultiplier: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (speed <= 0) {
            return;
        }
        const effectiveSpeed = Math.max(speed, Constants.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC);
        this.applyFluidForceFromMovingObject(
            context,
            position,
            velocity,
            radiusPx,
            effectiveSpeed * forceMultiplier,
            impactColor,
            deltaTime
        );
    }

    /**
     * Apply fluid force from a moving object to dust particles
     */
    static applyFluidForceFromMovingObject(
        context: PhysicsContext,
        position: Vector2D,
        velocity: Vector2D,
        radius: number,
        strength: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        const velMagSq = velocity.x * velocity.x + velocity.y * velocity.y;
        if (velMagSq <= 0) return;
        const velMag = Math.sqrt(velMagSq);
        const velNormX = velocity.x / velMag;
        const velNormY = velocity.y / velMag;
        const forwardComponent = Constants.FLUID_FORWARD_COMPONENT;
        const radialComponent = Constants.FLUID_RADIAL_COMPONENT;
        const minDist = Constants.FLUID_MIN_DISTANCE;
        const radiusSq = radius * radius;

        for (const particle of context.spaceDust) {
            const dx = particle.position.x - position.x;
            const dy = particle.position.y - position.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= radiusSq || distSq < minDist * minDist) continue;

            const distance = Math.sqrt(distSq);
            const invDist = 1 / distance;
            const dirX = dx * invDist;
            const dirY = dy * invDist;

            const pushX = velNormX * forwardComponent + dirX * radialComponent;
            const pushY = velNormY * forwardComponent + dirY * radialComponent;

            // Force falls off with distance (inverse square for more realistic fluid behavior)
            const distanceFactor = 1.0 - (distance / radius);
            const forceMagnitude = strength * distanceFactor * distanceFactor;

            if (impactColor) {
                const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                if (impactStrength > 0) {
                    particle.applyImpactColor(impactColor, impactStrength);
                }
            }

            particle.applyForceXY(pushX * forceMagnitude * deltaTime, pushY * forceMagnitude * deltaTime);
        }
    }

    /**
     * Apply fluid force from a beam to dust particles
     */
    static applyFluidForceFromBeam(
        context: PhysicsContext,
        startPos: Vector2D,
        endPos: Vector2D,
        radius: number,
        strength: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        // Calculate beam direction
        const bDx = endPos.x - startPos.x;
        const bDy = endPos.y - startPos.y;
        const beamLength = Math.sqrt(bDx * bDx + bDy * bDy);
        if (beamLength < Constants.FLUID_MIN_DISTANCE) return;

        const invBeamLength = 1 / beamLength;
        const beamDirX = bDx * invBeamLength;
        const beamDirY = bDy * invBeamLength;
        const alongBeamComponent = Constants.BEAM_ALONG_COMPONENT;
        const perpendicularComponent = Constants.BEAM_PERPENDICULAR_COMPONENT;
        const minDist = Constants.FLUID_MIN_DISTANCE;
        const radiusSq = radius * radius;

        for (const particle of context.spaceDust) {
            // Project particle onto beam line (find closest point on segment)
            const tpX = particle.position.x - startPos.x;
            const tpY = particle.position.y - startPos.y;
            const projection = tpX * beamDirX + tpY * beamDirY;
            const clampedProjection = Math.max(0, Math.min(beamLength, projection));

            // Closest point on beam to particle
            const cpX = startPos.x + beamDirX * clampedProjection;
            const cpY = startPos.y + beamDirY * clampedProjection;

            const dx = particle.position.x - cpX;
            const dy = particle.position.y - cpY;
            const distSq = dx * dx + dy * dy;
            if (distSq >= radiusSq || distSq < minDist * minDist) continue;

            const distance = Math.sqrt(distSq);
            const invDist = 1 / distance;
            const dirX = dx * invDist;
            const dirY = dy * invDist;

            const pushX = beamDirX * alongBeamComponent + dirX * perpendicularComponent;
            const pushY = beamDirY * alongBeamComponent + dirY * perpendicularComponent;

            // Force falls off with distance from beam
            const distanceFactor = 1.0 - (distance / radius);
            const forceMagnitude = strength * distanceFactor * distanceFactor;

            if (impactColor) {
                const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                if (impactStrength > 0) {
                    particle.applyImpactColor(impactColor, impactStrength);
                }
            }

            particle.applyForceXY(pushX * forceMagnitude * deltaTime, pushY * forceMagnitude * deltaTime);
        }
    }
}
