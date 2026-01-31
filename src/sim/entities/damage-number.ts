/**
 * Damage number - Visual feedback for damage dealt
 */

import { Vector2D } from '../math';

/**
 * Floating damage/health number
 */
export class DamageNumber {
    public position: Vector2D;
    public damage: number;
    public remainingHealth: number; // For remaining-life mode
    public creationTime: number;
    public velocity: Vector2D;
    public maxHealth: number; // For calculating size proportional to health
    public unitId: string | null; // Track which unit this belongs to (for replacement)

    constructor(
        position: Vector2D,
        damage: number,
        creationTime: number,
        maxHealth: number = 100,
        remainingHealth: number = 0,
        unitId: string | null = null
    ) {
        this.position = new Vector2D(position.x, position.y);
        this.damage = Math.round(damage);
        this.remainingHealth = Math.round(remainingHealth);
        this.creationTime = creationTime;
        this.maxHealth = maxHealth;
        this.unitId = unitId;
        // Random horizontal drift
        this.velocity = new Vector2D(
            (Math.random() - 0.5) * 20,
            -50 // Upward velocity
        );
    }

    /**
     * Update position based on velocity
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * Check if damage number has expired (2 second lifetime)
     */
    isExpired(currentTime: number): boolean {
        return currentTime - this.creationTime > 2.0;
    }

    /**
     * Get opacity based on age (fade out over time)
     */
    getOpacity(currentTime: number): number {
        const age = currentTime - this.creationTime;
        const lifetime = 2.0;
        return Math.max(0, 1 - age / lifetime);
    }
}
