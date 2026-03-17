/**
 * Photon entity - Bright, glowing particles ejected from suns
 *
 * Photons are deterministic particles that:
 * - Eject from suns using the golden angle for a pseudo-random distribution
 * - Repel other photons at medium range
 * - Are absorbed by hero units via gravity-like suction
 * - Power hero abilities (heroes need photons to cast instead of time-based cooldowns)
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';

export class Photon {
    lifetimeSec: number = 0;

    constructor(
        public position: Vector2D,
        public velocity: Vector2D
    ) {}

    /**
     * Update photon position based on velocity
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetimeSec += deltaTime;
    }

    /**
     * Check if photon should be removed
     */
    shouldDespawn(mapSize: number): boolean {
        if (this.lifetimeSec > Constants.PHOTON_LIFETIME_SEC) {
            return true;
        }
        // Remove if far outside map bounds
        const margin = 200;
        if (this.position.x < -margin || this.position.x > mapSize + margin ||
            this.position.y < -margin || this.position.y > mapSize + margin) {
            return true;
        }
        return false;
    }
}
