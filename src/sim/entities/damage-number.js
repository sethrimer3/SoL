/**
 * Damage number - Visual feedback for damage dealt
 */
import { Vector2D } from '../math';
import { getGameRNG } from '../../seeded-random';
/**
 * Floating damage/health number
 */
export class DamageNumber {
    constructor(position, damage, creationTime, maxHealth = 100, remainingHealth = 0, unitId = null) {
        this.position = new Vector2D(position.x, position.y);
        this.damage = Math.round(damage);
        this.remainingHealth = Math.round(remainingHealth);
        this.creationTime = creationTime;
        this.maxHealth = maxHealth;
        this.unitId = unitId;
        // Random horizontal drift
        const rng = getGameRNG();
        this.velocity = new Vector2D(rng.nextFloat(-10, 10), -50 // Upward velocity
        );
    }
    /**
     * Update position based on velocity
     */
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }
    /**
     * Check if damage number has expired (2 second lifetime)
     */
    isExpired(currentTime) {
        return currentTime - this.creationTime > 2.0;
    }
    /**
     * Get opacity based on age (fade out over time)
     */
    getOpacity(currentTime) {
        const age = currentTime - this.creationTime;
        const lifetime = 2.0;
        return Math.max(0, 1 - age / lifetime);
    }
}
