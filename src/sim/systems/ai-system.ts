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
import { AiMirrorSystem } from './ai-mirror-system';
import { AiStructureSystem } from './ai-structure-system';
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
            AiMirrorSystem.updateAiMirrorsForPlayer(player, context);
            AiMirrorSystem.updateAiMirrorPurchaseForPlayer(player, context);
            this.updateAiDefenseForPlayer(player, enemies, context);
            this.updateAiHeroProductionForPlayer(player, context);
            AiStructureSystem.updateAiStructuresForPlayer(player, enemies, context);
        }
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

        const threat = AiStructureSystem.findAiThreat(player, enemies);

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
                const enemyForge = AiStructureSystem.getEnemyForgeForPlayer(player, context);
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
            const enemyForge = AiStructureSystem.getEnemyForgeForPlayer(player, context);
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
