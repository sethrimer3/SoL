/**
 * AI System
 * Handles all AI logic for computer-controlled players
 * 
 * Extracted from game-state.ts as part of Phase 3 refactoring
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player, Faction } from '../entities/player';
import { Sun } from '../entities/sun';
import { Asteroid } from '../entities/asteroid';
import { SolarMirror } from '../entities/solar-mirror';
import { StellarForge } from '../entities/stellar-forge';
import { Building, Minigun, SpaceDustSwirler, SubsidiaryFactory, CombatTarget } from '../entities/buildings';
import { Unit } from '../entities/unit';
import { Starling } from '../entities/starling';
import { StarlingMergeGate } from '../entities/starling-merge-gate';
import {
    Marine,
    Mothership,
    Grave,
    Ray,
    InfluenceBall,
    TurretDeployer,
    Driller,
    Dagger,
    Beam,
    Mortar,
    Preist,
    Spotlight,
    Tank,
    Nova,
    Sly,
    Radiant,
    VelarisHero,
    Chrono,
    AurumHero,
    Dash,
    Blink,
    Splendor,
    Shadow
} from '../../game-core';

/**
 * AI context interface - defines what AISystem needs from GameState
 */
export interface AIContext {
    gameTime: number;
    players: Player[];
    suns: Sun[];
    asteroids: Asteroid[];
    starlingMergeGates: StarlingMergeGate[];
    
    // Helper methods
    getEnemiesForPlayer(player: Player): CombatTarget[];
    getClosestSunToPoint(point: Vector2D): Sun | null;
    isPointWithinPlayerInfluence(player: Player, point: Vector2D): boolean;
    checkCollision(position: Vector2D, radius: number): boolean;
    isInfluenceSourceActive(source: Building | StellarForge): boolean;
    getInfluenceRadiusForSource(source: Building | StellarForge): number;
    isPointInShadow(point: Vector2D): boolean;
    getHeroUnitCost(player: Player): number;
}

/**
 * AI System - handles all AI player logic
 */
export class AISystem {
    /**
     * Main AI update orchestrator
     */
    static updateAi(deltaTime: number, context: AIContext): void {
        for (const player of context.players) {
            if (!player.isAi || player.isDefeated()) {
                continue;
            }

            const enemies = context.getEnemiesForPlayer(player);
            this.updateAiMirrorsForPlayer(player, context);
            this.updateAiMirrorPurchaseForPlayer(player, context);
            this.updateAiDefenseForPlayer(player, enemies, context);
            this.updateAiHeroProductionForPlayer(player, context);
            this.updateAiStructuresForPlayer(player, enemies, context);
        }
    }

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
    private static assignAiMirrorsToIncompleteBuilding(player: Player): void {
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

    /**
     * Update AI defense strategy
     */
    static updateAiDefenseForPlayer(
        player: Player,
        enemies: CombatTarget[],
        context: AIContext
    ): void {
        if (context.gameTime < player.aiNextDefenseCommandSec) {
            return;
        }
        player.aiNextDefenseCommandSec = context.gameTime + Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC;

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
                const enemyForge = this.getEnemyForgeForPlayer(player, context);
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
            const enemyForge = this.getEnemyForgeForPlayer(player, context);
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
    
    /**
     * Get enemy forge for a player
     */
    private static getEnemyForgeForPlayer(player: Player, context: AIContext): StellarForge | null {
        for (const otherPlayer of context.players) {
            // Skip self and defeated players
            if (otherPlayer === player || otherPlayer.isDefeated()) continue;
            
            // Skip teammates in team games (3+ players)
            if (context.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                continue;
            }
            
            if (otherPlayer.stellarForge) {
                return otherPlayer.stellarForge;
            }
        }
        return null;
    }

    /**
     * Update AI hero production
     */
    static updateAiHeroProductionForPlayer(player: Player, context: AIContext): void {
        if (context.gameTime < player.aiNextHeroCommandSec) {
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
        
        player.aiNextHeroCommandSec = context.gameTime + heroProductionInterval;

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
            player.stellarForge.enqueueHeroUnit(heroType, context.getHeroUnitCost(player));
            return;
        }
    }

    /**
     * Update AI structure (building) placement
     */
    static updateAiStructuresForPlayer(
        player: Player,
        enemies: CombatTarget[],
        context: AIContext
    ): void {
        if (context.gameTime < player.aiNextStructureCommandSec) {
            return;
        }
        player.aiNextStructureCommandSec = context.gameTime + Constants.AI_STRUCTURE_COMMAND_INTERVAL_SEC;

        if (!player.stellarForge) {
            return;
        }

        const minigunCount = player.buildings.filter((building) => building instanceof Minigun).length;
        const swirlerCount = player.buildings.filter((building) => building instanceof SpaceDustSwirler).length;
        const hasSubsidiaryFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);

        let buildType: 'minigun' | 'swirler' | 'subsidiaryFactory' | null = null;
        
        // Strategy-based building priorities
        // Note: Radiant-specific buildings (minigun, swirler) are only available to Radiant faction
        const canBuildRadiantStructures = player.faction === Faction.RADIANT;
        
        switch (player.aiStrategy) {
            case Constants.AIStrategy.ECONOMIC:
                // Economic: Build factory first, then minimal defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                break;
                
            case Constants.AIStrategy.DEFENSIVE:
                // Defensive: Prioritize defenses heavily
                if (canBuildRadiantStructures && swirlerCount < 2 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 5 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.AGGRESSIVE:
                // Aggressive: Build factory early, skip most defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.WAVES:
                // Waves: Balanced approach with factory priority
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 2 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
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
        let didBuildStructure = false;

        switch (buildType) {
            case 'subsidiaryFactory':
                placement = this.findAiStructurePlacement(anchor, Constants.SUBSIDIARY_FACTORY_RADIUS, player, context, threat?.enemy.position);
                if (placement && player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                    player.buildings.push(new SubsidiaryFactory(placement, player));
                    didBuildStructure = true;
                }
                break;
            case 'swirler':
                placement = this.findAiStructurePlacement(anchor, Constants.SWIRLER_RADIUS, player, context, threat?.enemy.position);
                if (placement && player.spendEnergy(Constants.SWIRLER_COST)) {
                    player.buildings.push(new SpaceDustSwirler(placement, player));
                    didBuildStructure = true;
                }
                break;
            case 'minigun':
                placement = this.findAiStructurePlacement(anchor, Constants.MINIGUN_RADIUS, player, context, threat?.enemy.position);
                if (placement && player.spendEnergy(Constants.MINIGUN_COST)) {
                    player.buildings.push(new Minigun(placement, player));
                    didBuildStructure = true;
                }
                break;
        }

        if (didBuildStructure) {
            this.assignAiMirrorsToIncompleteBuilding(player);
        }
    }

    /**
     * Get the anchor point for AI structure placement
     */
    private static getAiStructureAnchor(player: Player): Vector2D | null {
        if (!player.stellarForge) {
            return null;
        }

        if (player.solarMirrors.length === 0 || player.solarMirrors.length === 0) {
            return player.stellarForge.position;
        }

        let bestMirror: SolarMirror | null = null;
        let bestDistance = Infinity;
        for (const mirror of player.solarMirrors) {
            const closestSun = mirror.getClosestSun([]);
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

    /**
     * Find a placement for an AI structure
     */
    static findAiStructurePlacement(
        anchor: Vector2D,
        radiusPx: number,
        player: Player,
        context: AIContext,
        threatPosition?: Vector2D
    ): Vector2D | null {
        const preferredTarget = threatPosition ?? this.getEnemyForgeForPlayer(player, context)?.position ?? anchor;
        const preferredDirection = Math.atan2(preferredTarget.y - anchor.y, preferredTarget.x - anchor.x);
        const activeInfluenceSources = this.getActiveInfluenceSourcesForPlayer(player, context);

        let bestCandidate: Vector2D | null = null;
        let bestScore = -Infinity;

        for (const source of activeInfluenceSources) {
            const directionToTarget = Math.atan2(
                preferredTarget.y - source.position.y,
                preferredTarget.x - source.position.x
            );

            // Candidate distances intentionally hug the influence edge first to keep expanding territory.
            const distanceAttempts = [
                source.radius - radiusPx - 8,
                source.radius - radiusPx - 28,
                source.radius - radiusPx - 52
            ];

            for (const candidateDistance of distanceAttempts) {
                if (candidateDistance <= radiusPx) {
                    continue;
                }

                for (let i = 0; i < 12; i++) {
                    const angleRad = directionToTarget + (Math.PI / 6) * i;
                    const candidate = new Vector2D(
                        source.position.x + Math.cos(angleRad) * candidateDistance,
                        source.position.y + Math.sin(angleRad) * candidateDistance
                    );

                    if (!context.isPointWithinPlayerInfluence(player, candidate)) {
                        continue;
                    }
                    if (context.checkCollision(candidate, radiusPx)) {
                        continue;
                    }

                    const score = this.scoreAiStructurePlacement(candidate, player, preferredTarget, source.radius, context, threatPosition);
                    if (score > bestScore) {
                        bestScore = score;
                        bestCandidate = candidate;
                    }
                }
            }
        }

        if (bestCandidate) {
            return bestCandidate;
        }

        // Fallback ring search around anchor if influence-edge search was blocked by collisions.
        const baseAngleRad = player.buildings.length * Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD;
        const distancePx = Constants.AI_STRUCTURE_PLACEMENT_DISTANCE_PX + radiusPx;
        for (let i = 0; i < 8; i++) {
            const angleRad = baseAngleRad + Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD * i + preferredDirection;
            const candidate = new Vector2D(
                anchor.x + Math.cos(angleRad) * distancePx,
                anchor.y + Math.sin(angleRad) * distancePx
            );
            if (!context.isPointWithinPlayerInfluence(player, candidate)) {
                continue;
            }
            if (!context.checkCollision(candidate, radiusPx)) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * Get active influence sources for a player
     */
    static getActiveInfluenceSourcesForPlayer(player: Player, context: AIContext): { position: Vector2D; radius: number }[] {
        const sources: { position: Vector2D; radius: number }[] = [];

        if (player.stellarForge && context.isInfluenceSourceActive(player.stellarForge)) {
            sources.push({
                position: player.stellarForge.position,
                radius: context.getInfluenceRadiusForSource(player.stellarForge)
            });
        }

        for (const building of player.buildings) {
            if (!context.isInfluenceSourceActive(building)) {
                continue;
            }
            sources.push({
                position: building.position,
                radius: context.getInfluenceRadiusForSource(building)
            });
        }

        return sources;
    }

    /**
     * Score an AI structure placement
     */
    private static scoreAiStructurePlacement(
        candidate: Vector2D,
        player: Player,
        preferredTarget: Vector2D,
        sourceRadius: number,
        context: AIContext,
        threatPosition?: Vector2D
    ): number {
        const forgePosition = player.stellarForge?.position;
        const distanceToForge = forgePosition ? candidate.distanceTo(forgePosition) : 0;
        const distanceToTarget = candidate.distanceTo(preferredTarget);

        let nearestEdgeSlack = sourceRadius;
        for (const source of this.getActiveInfluenceSourcesForPlayer(player, context)) {
            const distanceToSource = candidate.distanceTo(source.position);
            if (distanceToSource <= source.radius) {
                nearestEdgeSlack = Math.min(nearestEdgeSlack, source.radius - distanceToSource);
            }
        }

        const edgeExpansionScore = -nearestEdgeSlack * 3.0;
        const territorialScore = distanceToForge * 0.25;
        const targetScore = threatPosition ? -distanceToTarget * 0.35 : -distanceToTarget * 0.12;

        const shadeWeight = this.getAiShadePlacementWeight(player.aiDifficulty);
        const shadeScore = context.isPointInShadow(candidate) ? shadeWeight : 0;

        return edgeExpansionScore + territorialScore + targetScore + shadeScore;
    }

    /**
     * Get shade placement weight based on AI difficulty
     */
    private static getAiShadePlacementWeight(difficulty: Constants.AIDifficulty): number {
        switch (difficulty) {
            case Constants.AIDifficulty.HARD:
                return 120;
            case Constants.AIDifficulty.NORMAL:
                return 45;
            case Constants.AIDifficulty.EASY:
            default:
                return 10;
        }
    }

    /**
     * Find AI threat near player's base or mirrors
     */
    private static findAiThreat(
        player: Player,
        enemies: CombatTarget[]
    ): { enemy: CombatTarget; guardPoint: Vector2D } | null {
        if (!player.stellarForge) {
            return null;
        }

        const guardPoints: Vector2D[] = [player.stellarForge.position];
        for (const mirror of player.solarMirrors) {
            guardPoints.push(mirror.position);
        }

        let closestThreat: CombatTarget | null = null;
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

    /**
     * Get AI hero types for a faction
     */
    private static getAiHeroTypesForFaction(faction: Faction): string[] {
        switch (faction) {
            case Faction.RADIANT:
                return ['Marine', 'Mothership', 'Dagger', 'Beam', 'Mortar', 'Preist', 'Tank', 'Spotlight', 'Radiant'];
            case Faction.AURUM:
                return ['Driller', 'AurumHero', 'Dash', 'Blink', 'Splendor'];
            case Faction.VELARIS:
                return ['Grave', 'Ray', 'InfluenceBall', 'TurretDeployer', 'VelarisHero', 'Shadow', 'Chrono'];
            default:
                return [];
        }
    }

    /**
     * Check if a hero unit of a specific type is alive
     */
    private static isHeroUnitAlive(player: Player, heroUnitType: string): boolean {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }

    /**
     * Check if a hero unit is queued or producing in the forge
     */
    private static isHeroUnitQueuedOrProducing(forge: StellarForge, heroUnitType: string): boolean {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }

    /**
     * Check if a unit is of a specific hero type
     */
    private static isHeroUnitOfType(unit: Unit, heroUnitType: string): boolean {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof Marine;
            case 'Mothership':
                return unit instanceof Mothership;
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
            case 'Mortar':
                return unit instanceof Mortar;
            case 'Preist':
                return unit instanceof Preist;
            case 'Tank':
                return unit instanceof Tank;
            case 'Spotlight':
                return unit instanceof Spotlight;
            case 'Nova':
                return unit instanceof Nova;
            case 'Sly':
                return unit instanceof Sly;
            case 'Radiant':
                return unit instanceof Radiant;
            case 'VelarisHero':
                return unit instanceof VelarisHero;
            case 'Chrono':
                return unit instanceof Chrono;
            case 'AurumHero':
                return unit instanceof AurumHero;
            case 'Dash':
                return unit instanceof Dash;
            case 'Blink':
                return unit instanceof Blink;
            case 'Splendor':
                return unit instanceof Splendor;
            case 'Shadow':
                return unit instanceof Shadow;
            default:
                return false;
        }
    }
}
