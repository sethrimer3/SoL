/**
 * Player entity - Represents a player in the game
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import type { StellarForge } from './stellar-forge';
import type { SolarMirror } from './solar-mirror';
import type { Unit } from './unit';
import type { Building } from './buildings';

/**
 * Three playable factions in the game
 */
export enum Faction {
    RADIANT = "Radiant",
    AURUM = "Aurum",
    VELARIS = "Velaris"
}

/**
 * Player in the game
 */
export class Player {
    energy: number = 100.0; // Starting currency
    stellarForge: StellarForge | null = null;
    solarMirrors: SolarMirror[] = [];
    units: Unit[] = [];
    buildings: Building[] = []; // Offensive and defensive buildings
    isAi: boolean = false;
    aiNextMirrorCommandSec: number = 0;
    aiNextDefenseCommandSec: number = 0;
    aiNextHeroCommandSec: number = 0;
    aiNextStructureCommandSec: number = 0;
    aiNextMirrorPurchaseCommandSec: number = 0;
    aiStrategy: Constants.AIStrategy = Constants.AIStrategy.ECONOMIC; // AI build strategy (randomly assigned in createStandardGame for AI players)
    aiDifficulty: Constants.AIDifficulty = Constants.AIDifficulty.NORMAL; // AI difficulty level
    hasStrafeUpgrade: boolean = false;
    hasRegenUpgrade: boolean = false;
    hasBlinkUpgrade: boolean = false;
    hasAttackUpgrade: boolean = false;
    
    // Statistics tracking
    unitsCreated: number = 0;
    unitsLost: number = 0;
    energyGathered: number = 0;

    constructor(
        public name: string,
        public faction: Faction
    ) {}

    /**
     * Check if player is defeated
     */
    isDefeated(): boolean {
        return this.stellarForge === null || this.stellarForge.health <= 0;
    }

    /**
     * Add Energy to player's resources
     */
    addEnergy(amount: number): void {
        this.energy += amount;
        this.energyGathered += amount;
    }

    /**
     * Attempt to spend Energy
     */
    spendEnergy(amount: number): boolean {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }
}
