/**
 * AI Mirror System
 * Handles all AI mirror-related logic: positioning, purchasing, and guard assignment.
 *
 * Extracted from ai-system.ts as part of Phase 22 refactoring.
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Sun } from '../entities/sun';
import { StellarForge } from '../entities/stellar-forge';
import { Unit } from '../entities/unit';
import { Starling } from '../entities/starling';
import type { AIContext } from './ai-system';

export class AiMirrorSystem {
    /**
     * Update AI mirror positioning and management
     */
    static updateAiMirrorsForPlayer(player: Player, context: AIContext): void {
        if (context.gameTime < player.aiNextMirrorCommandSec) {
            return;
        }
        player.aiNextMirrorCommandSec = context.gameTime + Constants.AI_MIRROR_COMMAND_INTERVAL_SEC;

        if (!player.stellarForge || player.solarMirrors.length === 0) {
            return;
        }

        const sun = context.getClosestSunToPoint(player.stellarForge.position);
        if (!sun) {
            return;
        }

        // Determine mirror distance based on AI strategy
        let radiusFromSun: number;
        switch (player.aiStrategy) {
            case Constants.AIStrategy.AGGRESSIVE:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_AGGRESSIVE_DISTANCE_PX;
                break;
            case Constants.AIStrategy.DEFENSIVE:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_DEFENSIVE_DISTANCE_PX;
                break;
            case Constants.AIStrategy.ECONOMIC:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_ECONOMIC_DISTANCE_PX;
                break;
            case Constants.AIStrategy.WAVES:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_WAVES_DISTANCE_PX;
                break;
            default:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_SUN_DISTANCE_PX;
        }

        const mirrorCount = player.solarMirrors.length;
        const baseAngleRad = Math.atan2(
            player.stellarForge.position.y - sun.position.y,
            player.stellarForge.position.x - sun.position.x
        );
        const startAngleRad = baseAngleRad - (Constants.AI_MIRROR_ARC_SPACING_RAD * (mirrorCount - 1)) / 2;

        for (let i = 0; i < mirrorCount; i++) {
            const mirror = player.solarMirrors[i];
            const angleRad = startAngleRad + Constants.AI_MIRROR_ARC_SPACING_RAD * i;
            
            // Try to find a valid position for the mirror
            const target = this.findValidMirrorPosition(
                sun,
                angleRad,
                radiusFromSun,
                player.stellarForge,
                context
            );
            
            if (target) {
                const distance = mirror.position.distanceTo(target);
                if (distance > Constants.AI_MIRROR_REPOSITION_THRESHOLD_PX) {
                    mirror.setTarget(target, context as any);
                }
            }
        }
        
        // For hard difficulty, position defensive units near mirrors
        if (player.aiDifficulty === Constants.AIDifficulty.HARD) {
            this.positionGuardsNearMirrors(player, context);
        }
    }

    /**
     * Find a valid mirror position that avoids asteroids and has line of sight to sun and base
     */
    private static findValidMirrorPosition(
        sun: Sun,
        preferredAngle: number,
        preferredRadius: number,
        stellarForge: StellarForge,
        context: AIContext
    ): Vector2D | null {
        const mirrorRadius = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        
        // Try multiple radius and angle combinations to find a valid position
        // The search pattern varies both closer/farther and left/right from preferred position
        for (let radiusAttempt = 0; radiusAttempt < Constants.AI_MIRROR_PLACEMENT_ATTEMPTS; radiusAttempt++) {
            // Vary radius: starts closer (-60), then moves through preferred (0) to farther (+60)
            // This explores positions both closer to sun and farther from sun
            const radius = preferredRadius + (radiusAttempt * Constants.AI_MIRROR_RADIUS_VARIATION_STEP_PX) - Constants.AI_MIRROR_RADIUS_VARIATION_OFFSET_PX;
            
            for (let angleAttempt = 0; angleAttempt < Constants.AI_MIRROR_PLACEMENT_ATTEMPTS; angleAttempt++) {
                // Vary angle: starts left (-0.6 rad), then moves through preferred (0) to right (+0.6 rad)
                // This explores positions in an arc around the preferred angle
                const angleDelta = (angleAttempt * Constants.AI_MIRROR_ANGLE_VARIATION_STEP_RAD) - Constants.AI_MIRROR_ANGLE_VARIATION_OFFSET_RAD;
                const angle = preferredAngle + angleDelta;
                
                const candidate = new Vector2D(
                    sun.position.x + Math.cos(angle) * radius,
                    sun.position.y + Math.sin(angle) * radius
                );
                
                // Check if position is valid (not in asteroid)
                if (context.checkCollision(candidate, mirrorRadius)) {
                    continue;
                }
                
                // Check if mirror would have line of sight to sun
                if (!this.hasLineOfSight(candidate, sun.position, mirrorRadius, context)) {
                    continue;
                }
                
                // Check if mirror would have line of sight to forge
                if (!this.hasLineOfSight(candidate, stellarForge.position, mirrorRadius, context)) {
                    continue;
                }
                
                // Found a valid position
                return candidate;
            }
        }
        
        // No valid position found
        return null;
    }

    /**
     * Check if there's a clear line of sight between two points
     */
    private static hasLineOfSight(from: Vector2D, to: Vector2D, objectRadius: number = 0, context: AIContext): boolean {
        const direction = new Vector2D(
            to.x - from.x,
            to.y - from.y
        ).normalize();
        
        const ray = new LightRay(from, direction);
        const distance = from.distanceTo(to);
        
        for (const asteroid of context.asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distance - objectRadius) {
                return false; // Path is blocked
            }
        }
        
        return true; // Path is clear
    }

    /**
     * Check if a unit is eligible to be a guard (hero or starling)
     */
    private static isGuardEligible(unit: Unit): boolean {
        return unit.isHero || unit instanceof Starling;
    }

    /**
     * Position defensive units near mirrors for hard difficulty AI
     */
    private static positionGuardsNearMirrors(player: Player, context: AIContext): void {
        // Only run this occasionally to avoid excessive computation
        // Check every 5 seconds to reassess mirror guard positions
        const guardCheckInterval = 5.0;
        const timeSinceLastDefense = context.gameTime - (player.aiNextDefenseCommandSec - Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC);
        if (timeSinceLastDefense < guardCheckInterval) {
            return;
        }
        
        // Find unguarded mirrors (mirrors without nearby defensive units)
        for (const mirror of player.solarMirrors) {
            let hasNearbyGuard = false;
            const guardRadius = Constants.AI_MIRROR_GUARD_DISTANCE_PX;
            
            // Check if there's already a unit or building near this mirror
            for (const unit of player.units) {
                if (this.isGuardEligible(unit)) {
                    const distance = unit.position.distanceTo(mirror.position);
                    if (distance < guardRadius * 2) {
                        hasNearbyGuard = true;
                        break;
                    }
                }
            }
            
            if (!hasNearbyGuard) {
                for (const building of player.buildings) {
                    const distance = building.position.distanceTo(mirror.position);
                    if (distance < guardRadius * 2) {
                        hasNearbyGuard = true;
                        break;
                    }
                }
            }
            
            // If mirror is unguarded, set rally points for some units to guard it
            if (!hasNearbyGuard) {
                let guardsAssigned = 0;
                const maxGuards = 2; // Assign up to 2 units per mirror
                
                for (const unit of player.units) {
                    if (guardsAssigned >= maxGuards) break;
                    
                    // Assign starlings or hero units to guard
                    if (this.isGuardEligible(unit)) {
                        // Check if unit is far from mirror (to avoid reassigning guards constantly)
                        const distance = unit.position.distanceTo(mirror.position);
                        if (distance > guardRadius * 3) {
                            // Set rally point near mirror
                            const guardPos = new Vector2D(
                                mirror.position.x,
                                mirror.position.y
                            );
                            
                            if (unit.isHero) {
                                unit.rallyPoint = guardPos;
                            } else if (unit instanceof Starling) {
                                unit.setManualRallyPoint(guardPos);
                            }
                            guardsAssigned++;
                        }
                    }
                }
            }
        }
    }

    /**
     * Update AI mirror purchase logic
     */
    static updateAiMirrorPurchaseForPlayer(player: Player, context: AIContext): void {
        if (context.gameTime < player.aiNextMirrorPurchaseCommandSec) {
            return;
        }
        player.aiNextMirrorPurchaseCommandSec = context.gameTime + Constants.AI_MIRROR_PURCHASE_INTERVAL_SEC;

        if (!player.stellarForge) {
            return;
        }

        if (player.solarMirrors.length >= Constants.AI_MAX_MIRRORS) {
            return;
        }

        const spawnPosition = this.findMirrorSpawnPositionNearForge(player.stellarForge, context);
        player.stellarForge.enqueueMirror(Constants.STELLAR_FORGE_SOLAR_MIRROR_COST, spawnPosition);

        this.assignAiMirrorsToIncompleteBuilding(player);
    }

    /**
     * Assign AI mirrors to incomplete buildings
     */
    static assignAiMirrorsToIncompleteBuilding(player: Player): void {
        const incompleteBuilding = player.buildings.find((building) => !building.isComplete && !building.isDestroyed());
        if (!incompleteBuilding) {
            return;
        }

        for (const mirror of player.solarMirrors) {
            if (mirror.linkedStructure !== null && mirror.linkedStructure !== player.stellarForge) {
                continue;
            }
            mirror.setLinkedStructure(incompleteBuilding);
        }
    }

    /**
     * Find a mirror spawn position near the forge
     */
    private static findMirrorSpawnPositionNearForge(stellarForge: StellarForge, context: AIContext): Vector2D {
        const baseRadiusPx = stellarForge.radius + Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorRadiusPx = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        const angleStepRad = Math.PI / 6;

        for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
            const ringRadiusPx = baseRadiusPx + ringIndex * (mirrorRadiusPx + 12);
            for (let angleIndex = 0; angleIndex < 12; angleIndex++) {
                const angleRad = angleStepRad * angleIndex;
                const candidate = new Vector2D(
                    stellarForge.position.x + Math.cos(angleRad) * ringRadiusPx,
                    stellarForge.position.y + Math.sin(angleRad) * ringRadiusPx
                );
                if (!context.checkCollision(candidate, mirrorRadiusPx)) {
                    return candidate;
                }
            }
        }

        return new Vector2D(stellarForge.position.x, stellarForge.position.y);
    }
}
