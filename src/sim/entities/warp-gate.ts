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
    health: number = 100;
    hasEmittedShockwave: boolean = false; // Track if shockwave was emitted
    
    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Update warp gate charging - now energy-based
     */
    update(deltaTime: number, isStillHolding: boolean, chargeMultiplier: number = 1.0): void {
        if (!this.isCharging || this.isComplete) {
            return;
        }

        // For backward compatibility, still update chargeTime but it's not used for completion
        this.chargeTime += deltaTime * chargeMultiplier;

        // Check if fully charged based on energy
        if (this.accumulatedEnergy >= Constants.WARP_GATE_ENERGY_REQUIRED) {
            this.isComplete = true;
            this.isCharging = false;
        }
    }

    /**
     * Add energy to the warp gate from mirrors
     */
    addEnergy(amount: number): void {
        if (!this.isCharging || this.isComplete) {
            return;
        }
        this.accumulatedEnergy += amount;
        
        // Update chargeTime for visual compatibility (approximate progress)
        this.chargeTime = (this.accumulatedEnergy / Constants.WARP_GATE_ENERGY_REQUIRED) * Constants.WARP_GATE_CHARGE_TIME;
    }

    /**
     * Start charging the warp gate
     */
    startCharging(): void {
        this.isCharging = true;
        this.chargeTime = 0;
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
        this.isCharging = false;
        this.isComplete = false;
        // Scatter particles will be handled in game state
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
