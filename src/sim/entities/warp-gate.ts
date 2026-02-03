/**
 * Warp Gate entity - Player-conjured portal for tactical repositioning
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import type { Player } from './player';

/**
 * Warp gate being conjured by player
 */
export class WarpGate {
    chargeTime: number = 0; // Deprecated - kept for compatibility
    accumulatedEnergy: number = 0; // Energy accumulated from mirrors
    isCharging: boolean = false;
    isComplete: boolean = false;
    isCancelling: boolean = false;
    hasDissipated: boolean = false;
    completionRemainingSec: number = 0;
    health: number = 100;
    hasEmittedShockwave: boolean = false; // Track if shockwave was emitted
    hasReceivedEnergyThisTick: boolean = false;
    
    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Update warp gate charging - now energy-based
     */
    update(deltaTime: number): void {
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
    addEnergy(amount: number): void {
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
    startCharging(): void {
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
    takeDamage(amount: number): boolean {
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
    cancel(): void {
        this.startCancellation();
    }

    startCancellation(): void {
        if (this.isCancelling || this.hasDissipated) {
            return;
        }
        this.isCancelling = true;
        this.isCharging = false;
        this.isComplete = false;
        this.completionRemainingSec = 0;
    }

    resetEnergyReceipt(): void {
        this.hasReceivedEnergyThisTick = false;
    }

    /**
     * Check if shockwave should be emitted (at 1 second mark)
     */
    shouldEmitShockwave(): boolean {
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
