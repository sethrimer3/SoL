/**
 * Player entity - Represents a player in the game
 */
import * as Constants from '../../constants';
/**
 * Three playable factions in the game
 */
export var Faction;
(function (Faction) {
    Faction["RADIANT"] = "Radiant";
    Faction["AURUM"] = "Aurum";
    Faction["VELARIS"] = "Velaris";
})(Faction || (Faction = {}));
/**
 * Player in the game
 */
export class Player {
    constructor(name, faction) {
        this.name = name;
        this.faction = faction;
        this.energy = 100.0; // Starting currency
        this.stellarForge = null;
        this.solarMirrors = [];
        this.units = [];
        this.buildings = []; // Offensive and defensive buildings
        this.isAi = false;
        this.aiNextMirrorCommandSec = 0;
        this.aiNextDefenseCommandSec = 0;
        this.aiNextHeroCommandSec = 0;
        this.aiNextStructureCommandSec = 0;
        this.aiNextMirrorPurchaseCommandSec = 0;
        this.aiStrategy = Constants.AIStrategy.ECONOMIC; // AI build strategy (randomly assigned in createStandardGame for AI players)
        this.aiDifficulty = Constants.AIDifficulty.NORMAL; // AI difficulty level
        this.hasStrafeUpgrade = false;
        this.hasRegenUpgrade = false;
        this.hasBlinkUpgrade = false;
        this.hasAttackUpgrade = false;
        // Statistics tracking
        this.unitsCreated = 0;
        this.unitsLost = 0;
        this.energyGathered = 0;
    }
    /**
     * Check if player is defeated
     */
    isDefeated() {
        return this.stellarForge === null || this.stellarForge.health <= 0;
    }
    /**
     * Add Energy to player's resources
     */
    addEnergy(amount) {
        this.energy += amount;
        this.energyGathered += amount;
    }
    /**
     * Attempt to spend Energy
     */
    spendEnergy(amount) {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }
}
