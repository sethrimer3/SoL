/**
 * Vision & Light System
 * Handles shadow casting, line of sight, and visibility rules
 * 
 * Extracted from game-state.ts as part of Phase 3 refactoring
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Sun } from '../entities/sun';
import { Asteroid } from '../entities/asteroid';
import { StellarForge } from '../entities/stellar-forge';
import { Building, SubsidiaryFactory, CombatTarget } from '../entities/buildings';
import { Dagger, Spotlight } from '../../game-core';

// Type for Splendor sunlight zones (avoid circular dependency)
interface SplendorSunlightZone {
    containsPoint(point: Vector2D): boolean;
    owner: Player;
}

// Type for Velaris orbs (avoid circular dependency)
interface VelarisOrb {
    position: Vector2D;
    owner: Player;
    getRange(): number;
}

/**
 * Vision System - handles all visibility and shadow calculations
 */
export class VisionSystem {
    /**
     * Get influence radius for a source (forge, building)
     */
    static getInfluenceRadiusForSource(source: StellarForge | Building): number {
        if (source instanceof StellarForge || source instanceof SubsidiaryFactory) {
            return Constants.INFLUENCE_RADIUS;
        }
        return Constants.INFLUENCE_RADIUS * Constants.BUILDING_INFLUENCE_RADIUS_MULTIPLIER;
    }

    /**
     * Check if an influence source is active
     */
    static isInfluenceSourceActive(source: StellarForge | Building): boolean {
        if (source.health <= 0) {
            return false;
        }
        if (source instanceof StellarForge) {
            return source.isReceivingLight;
        }
        return true;
    }

    /**
     * Check if a point is within a player's influence radius
     */
    static isPointWithinPlayerInfluence(player: Player, point: Vector2D): boolean {
        if (player.isDefeated()) {
            return false;
        }

        const forge = player.stellarForge;
        if (forge && this.isInfluenceSourceActive(forge)) {
            const distanceToForge = forge.position.distanceTo(point);
            if (distanceToForge <= this.getInfluenceRadiusForSource(forge)) {
                return true;
            }
        }

        for (const building of player.buildings) {
            if (!this.isInfluenceSourceActive(building)) {
                continue;
            }
            const distanceToBuilding = building.position.distanceTo(point);
            if (distanceToBuilding <= this.getInfluenceRadiusForSource(building)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a point is in shadow cast by asteroids from all suns
     * Returns true if the point is in shadow from all light sources
     */
    static isPointInShadow(
        point: Vector2D,
        suns: Sun[],
        asteroids: Asteroid[],
        splendorZones: SplendorSunlightZone[]
    ): boolean {
        // Splendor zones always provide light
        for (const zone of splendorZones) {
            if (zone.containsPoint(point)) {
                return false;
            }
        }

        // If no suns, everything is in shadow
        if (suns.length === 0) return true;
        
        // Point must have line of sight to at least one sun to not be in shadow
        for (const sun of suns) {
            const direction = new Vector2D(
                sun.position.x - point.x,
                sun.position.y - point.y
            ).normalize();
            
            const ray = new LightRay(point, direction);
            const distanceToSun = point.distanceTo(sun.position);
            
            let hasLineOfSight = true;
            for (const asteroid of asteroids) {
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
     * Check if a unit is in sunlight (either not in shadow or in a Splendor zone)
     */
    static isUnitInSunlight(
        unitPosition: Vector2D,
        unitOwner: Player,
        suns: Sun[],
        asteroids: Asteroid[],
        splendorZones: SplendorSunlightZone[]
    ): boolean {
        if (!this.isPointInShadow(unitPosition, suns, asteroids, splendorZones)) {
            return true;
        }

        for (const zone of splendorZones) {
            if (zone.owner === unitOwner && zone.containsPoint(unitPosition)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an enemy object is visible to a player
     * Objects are visible if:
     * - They are NOT in shadow (in light), OR
     * - They are in shadow but within proximity range of player unit, OR
     * - They are in shadow but within player's influence radius
     */
    static isObjectVisibleToPlayer(
        objectPos: Vector2D,
        player: Player,
        suns: Sun[],
        asteroids: Asteroid[],
        splendorZones: SplendorSunlightZone[],
        object?: CombatTarget
    ): boolean {
        // Special LaD (Light and Dark) visibility logic
        const ladSun = suns.find(s => s.type === 'lad');
        if (ladSun) {
            return this.isObjectVisibleInLadMode(objectPos, player, object, ladSun);
        }
        
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof Dagger) {
            // Type narrowing: object is now known to be Dagger
            const dagger = object as InstanceType<typeof Dagger>;
            // Dagger is only visible to enemies if not cloaked
            if (dagger.isCloakedToEnemies() && dagger.owner !== player) {
                return false; // Cloaked Daggers are invisible to enemies
            }
        }
        
        // Check if object is in shadow
        const inShadow = this.isPointInShadow(objectPos, suns, asteroids, splendorZones);
        
        // If not in shadow, always visible
        if (!inShadow) {
            return true;
        }

        // Splendor sunlight zones also reveal objects
        for (const zone of splendorZones) {
            if (zone.containsPoint(objectPos)) {
                return true;
            }
        }
        
        // In shadow - check proximity to player units (using their line of sight)
        for (const unit of player.units) {
            const distance = unit.position.distanceTo(objectPos);
            const visibilityRange = unit.lineOfSight || Constants.VISIBILITY_PROXIMITY_RANGE;
            if (distance <= visibilityRange) {
                return true;
            }
        }
        
        // In shadow - check if within player's influence
        if (this.isPointWithinPlayerInfluence(player, objectPos)) {
            return true;
        }

        // Check if revealed by Spotlight
        if (this.isObjectRevealedBySpotlight(objectPos, player)) {
            return true;
        }
        
        return false; // Not visible: in shadow and not within proximity or influence range
    }

    /**
     * Helper method to determine which side of LaD sun a position is on
     */
    static getLadSide(position: Vector2D, ladSun: Sun): 'light' | 'dark' {
        return position.x < ladSun.position.x ? 'light' : 'dark';
    }

    /**
     * Check visibility in LaD (Light and Dark) mode
     * Units are invisible to the enemy until they cross into enemy territory
     */
    private static isObjectVisibleInLadMode(
        objectPos: Vector2D,
        player: Player,
        object: CombatTarget | undefined,
        ladSun: Sun
    ): boolean {
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof Dagger) {
            const dagger = object as InstanceType<typeof Dagger>;
            if (dagger.isCloakedToEnemies() && dagger.owner !== player) {
                return false;
            }
        }
        
        // Determine which side each player is on based on their forge position
        // Default to 'light' if forge is not yet initialized (early game state)
        const playerSide = player.stellarForge 
            ? this.getLadSide(player.stellarForge.position, ladSun)
            : 'light';
        
        // Determine which side the object is on
        const objectSide = this.getLadSide(objectPos, ladSun);
        
        // If object has an owner
        if (object && 'owner' in object && object.owner) {
            const objectOwner = object.owner as Player;
            // Own units are always visible
            if (objectOwner === player) {
                return true;
            }
            
            // Enemy units are only visible if they're on the player's side
            if (objectSide === playerSide) {
                return true;
            }

            return this.isObjectRevealedBySpotlight(objectPos, player);
        }
        
        // Non-owned objects (buildings, etc.) use default visibility
        return true;
    }

    /**
     * Check if an object is revealed by a player's Spotlight units
     */
    private static isObjectRevealedBySpotlight(objectPos: Vector2D, player: Player): boolean {
        for (const unit of player.units) {
            if (!(unit instanceof Spotlight)) {
                continue;
            }
            // Type narrowing: unit is now known to be Spotlight
            const spotlight = unit as InstanceType<typeof Spotlight>;
            if (!spotlight.isSpotlightActive() || !spotlight.spotlightDirection) {
                continue;
            }
            const effectiveRangePx = spotlight.spotlightRangePx * spotlight.spotlightLengthFactor;
            if (effectiveRangePx <= 0) {
                continue;
            }
            if (this.isPositionInSpotlightCone(spotlight, objectPos, effectiveRangePx)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a position is within a spotlight's cone
     */
    private static isPositionInSpotlightCone(
        spotlight: InstanceType<typeof Spotlight>,
        position: Vector2D,
        rangePx: number
    ): boolean {
        const direction = spotlight.spotlightDirection;
        if (!direction) {
            return false;
        }

        const dx = position.x - spotlight.position.x;
        const dy = position.y - spotlight.position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > rangePx * rangePx) {
            return false;
        }

        const facingAngle = Math.atan2(direction.y, direction.x);
        const angleToTarget = Math.atan2(dy, dx);
        let angleDiff = angleToTarget - facingAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        return Math.abs(angleDiff) <= Constants.SPOTLIGHT_CONE_ANGLE_RAD / 2;
    }

    /**
     * Check if light is blocked by Velaris field between two orbs
     */
    static isLightBlockedByVelarisField(
        start: Vector2D,
        end: Vector2D,
        velarisOrbs: VelarisOrb[]
    ): boolean {
        // Check all pairs of Velaris orbs
        for (let i = 0; i < velarisOrbs.length; i++) {
            for (let j = i + 1; j < velarisOrbs.length; j++) {
                const orb1 = velarisOrbs[i];
                const orb2 = velarisOrbs[j];
                
                // Only check orbs from the same owner
                if (orb1.owner !== orb2.owner) continue;
                
                const distance = orb1.position.distanceTo(orb2.position);
                const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                
                if (distance <= maxRange) {
                    // Check if light path intersects this orb field
                    if (this.lineSegmentsIntersect(start, end, orb1.position, orb2.position)) {
                        return true; // Light is blocked
                    }
                }
            }
        }
        
        return false; // Light is not blocked
    }

    /**
     * Check if two line segments intersect
     */
    static lineSegmentsIntersect(
        p1: Vector2D, p2: Vector2D,
        p3: Vector2D, p4: Vector2D
    ): boolean {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        
        const denominator = d1x * d2y - d1y * d2x;
        
        // Lines are parallel
        if (Math.abs(denominator) < 0.0001) {
            return false;
        }
        
        const d3x = p1.x - p3.x;
        const d3y = p1.y - p3.y;
        
        const t1 = (d3x * d2y - d3y * d2x) / denominator;
        const t2 = (d3x * d1y - d3y * d1x) / denominator;
        
        // Check if intersection point is within both line segments
        return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
    }
}
