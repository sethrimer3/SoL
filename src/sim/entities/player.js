"use strict";
/**
 * Player entity - Represents a player in the game
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = exports.Faction = void 0;
const Constants = __importStar(require("../../constants"));
/**
 * Three playable factions in the game
 */
var Faction;
(function (Faction) {
    Faction["RADIANT"] = "Radiant";
    Faction["AURUM"] = "Aurum";
    Faction["VELARIS"] = "Velaris";
})(Faction || (exports.Faction = Faction = {}));
/**
 * Player in the game
 */
class Player {
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
exports.Player = Player;
