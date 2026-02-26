/**
 * AI Structure System
 * Handles all AI structure/building placement logic, plus threat detection.
 *
 * Extracted from ai-system.ts as part of Phase 22 refactoring.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player, Faction } from '../entities/player';
import { StellarForge } from '../entities/stellar-forge';
import { SolarMirror } from '../entities/solar-mirror';
import { Building, Minigun, SpaceDustSwirler, SubsidiaryFactory, CombatTarget } from '../entities/buildings';
import type { AIContext } from './ai-system';
import { AiMirrorSystem } from './ai-mirror-system';

export class AiStructureSystem {

    /**
     * Find AI threat near player's base or mirrors
     */
    static findAiThreat(
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
     * Get enemy forge for a player
     */
    static getEnemyForgeForPlayer(player: Player, context: AIContext): StellarForge | null {
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
            AiMirrorSystem.assignAiMirrorsToIncompleteBuilding(player);
        }
    }

    /**
     * Get the anchor point for AI structure placement
     */
    private static getAiStructureAnchor(player: Player): Vector2D | null {
        if (!player.stellarForge) {
            return null;
        }

        if (player.solarMirrors.length === 0) {
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
}
