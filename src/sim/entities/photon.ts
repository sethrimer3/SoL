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
     * Update photon position, apply friction, and bounce off map walls.
     */
    update(deltaTime: number, mapSize: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetimeSec += deltaTime;

        // Bounce off map walls (map spans -mapHalfSize to +mapHalfSize)
        const mapHalfSize = mapSize / 2;
        if (this.position.x < -mapHalfSize) {
            this.position.x = -mapHalfSize;
            this.velocity.x = Math.abs(this.velocity.x) * Constants.PHOTON_WALL_BOUNCE_RESTITUTION;
        } else if (this.position.x > mapHalfSize) {
            this.position.x = mapHalfSize;
            this.velocity.x = -Math.abs(this.velocity.x) * Constants.PHOTON_WALL_BOUNCE_RESTITUTION;
        }
        if (this.position.y < -mapHalfSize) {
            this.position.y = -mapHalfSize;
            this.velocity.y = Math.abs(this.velocity.y) * Constants.PHOTON_WALL_BOUNCE_RESTITUTION;
        } else if (this.position.y > mapHalfSize) {
            this.position.y = mapHalfSize;
            this.velocity.y = -Math.abs(this.velocity.y) * Constants.PHOTON_WALL_BOUNCE_RESTITUTION;
        }

        // Apply friction to gradually decelerate toward a stop
        if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
            if (speed > 0.01) {
                const newSpeed = Math.max(0, speed - Constants.PHOTON_FRICTION_PX_PER_SEC_SQ * deltaTime);
                const factor = newSpeed / speed;
                this.velocity.x *= factor;
                this.velocity.y *= factor;
            } else {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        }
    }

    /**
     * Check if photon should be removed
     */
    shouldDespawn(): boolean {
        return this.lifetimeSec > Constants.PHOTON_LIFETIME_SEC;
    }
}
