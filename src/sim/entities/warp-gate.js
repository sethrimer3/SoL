"use strict";
/**
 * Warp Gate entity - Player-conjured portal for tactical repositioning
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
exports.WarpGate = void 0;
const Constants = __importStar(require("../../constants"));
/**
 * Warp gate being conjured by player
 */
class WarpGate {
    constructor(position, owner) {
        this.position = position;
        this.owner = owner;
        this.chargeTime = 0; // Deprecated - kept for compatibility
        this.accumulatedEnergy = 0; // Energy accumulated from mirrors
        this.isCharging = false;
        this.isComplete = false;
        this.isCancelling = false;
        this.hasDissipated = false;
        this.completionRemainingSec = 0;
        this.health = 100;
        this.hasEmittedShockwave = false; // Track if shockwave was emitted
        this.hasReceivedEnergyThisTick = false;
    }
    /**
     * Update warp gate charging - now energy-based
     */
    update(deltaTime) {
        if (this.hasDissipated) {
            return;
        }
        if (this.isCancelling) {
            const cancelDecay = Constants.WARP_GATE_CANCEL_DECAY_ENERGY_PER_SEC * deltaTime;
            this.accumulatedEnergy = Math.max(0, this.accumulatedEnergy - cancelDecay);
            this.chargeTime = (this.accumulatedEnergy / Constants.WARP_GATE_ENERGY_REQUIRED) * Constants.WARP_GATE_CHARGE_TIME;
            if (this.accumulatedEnergy <= 0) {
                this.isCharging = false;
                this.isComplete = false;
                this.isCancelling = false;
                this.hasDissipated = true;
            }
            return;
        }
        if (this.isComplete) {
            this.completionRemainingSec = Math.max(0, this.completionRemainingSec - deltaTime);
            if (this.completionRemainingSec <= 0) {
                this.startCancellation();
            }
            return;
        }
        if (!this.isCharging) {
            return;
        }
        // For backward compatibility, still update chargeTime based on energy progress
        this.chargeTime = (this.accumulatedEnergy / Constants.WARP_GATE_ENERGY_REQUIRED) * Constants.WARP_GATE_CHARGE_TIME;
        // Check if fully charged based on energy
        if (this.accumulatedEnergy >= Constants.WARP_GATE_ENERGY_REQUIRED) {
            this.isComplete = true;
            this.isCharging = false;
            this.completionRemainingSec = Constants.WARP_GATE_COMPLETION_WINDOW_SEC;
        }
    }
    /**
     * Add energy to the warp gate from mirrors
     */
    addEnergy(amount) {
        if (!this.isCharging || this.isComplete || this.isCancelling || this.hasDissipated) {
            return;
        }
        this.hasReceivedEnergyThisTick = true;
        this.accumulatedEnergy += amount;
        // Update chargeTime for visual compatibility (approximate progress)
        this.chargeTime = (this.accumulatedEnergy / Constants.WARP_GATE_ENERGY_REQUIRED) * Constants.WARP_GATE_CHARGE_TIME;
    }
    /**
     * Start charging the warp gate
     */
    startCharging() {
        this.isCharging = true;
        this.isCancelling = false;
        this.hasDissipated = false;
        this.chargeTime = 0;
        this.accumulatedEnergy = 0;
        this.completionRemainingSec = 0;
    }
    /**
     * Take damage and potentially dissipate
     */
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.cancel();
            return true; // Gate destroyed
        }
        return false;
    }
    /**
     * Cancel/dissipate the warp gate
     */
    cancel() {
        this.startCancellation();
    }
    startCancellation() {
        if (this.isCancelling || this.hasDissipated) {
            return;
        }
        this.isCancelling = true;
        this.isCharging = false;
        this.isComplete = false;
        this.completionRemainingSec = 0;
    }
    resetEnergyReceipt() {
        this.hasReceivedEnergyThisTick = false;
    }
    /**
     * Check if shockwave should be emitted (at 1 second mark)
     */
    shouldEmitShockwave() {
        if (this.hasEmittedShockwave) {
            return false;
        }
        if (this.chargeTime >= 1.0) {
            this.hasEmittedShockwave = true;
            return true;
        }
        return false;
    }
}
exports.WarpGate = WarpGate;
