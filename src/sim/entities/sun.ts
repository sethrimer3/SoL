/**
 * Sun entity - Emits light for solar mirrors to reflect
 */

import { Vector2D, LightRay } from '../math';

/**
 * Sun - Main light source in the game
 */
export class Sun {
    // Orbital motion properties
    public orbitCenter: Vector2D | null = null;  // Center point to orbit around (null for stationary)
    public orbitRadius: number = 0;               // Distance from orbit center
    public orbitSpeed: number = 0;                // Angular speed in radians per second
    private orbitAngle: number = 0;               // Current angle in orbit

    constructor(
        public position: Vector2D,
        public intensity: number = 1.0,
        public radius: number = 100.0,
        public type: 'normal' | 'lad' = 'normal',  // Type for special suns like LaD
        orbitCenter?: Vector2D,
        orbitRadius?: number,
        orbitSpeed?: number,
        initialOrbitAngle?: number
    ) {
        if (orbitCenter) {
            this.orbitCenter = orbitCenter;
            this.orbitRadius = orbitRadius || 0;
            this.orbitSpeed = orbitSpeed || 0;
            this.orbitAngle = initialOrbitAngle !== undefined ? initialOrbitAngle : 0;
            // Set initial position based on orbit parameters
            this.updatePositionFromOrbit();
        }
    }

    /**
     * Update position based on orbital parameters
     */
    private updatePositionFromOrbit(): void {
        if (this.orbitCenter) {
            this.position = new Vector2D(
                this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius,
                this.orbitCenter.y + Math.sin(this.orbitAngle) * this.orbitRadius
            );
        }
    }

    /**
     * Update sun (for orbital motion)
     */
    update(deltaTime: number): void {
        if (this.orbitCenter && this.orbitSpeed !== 0) {
            this.orbitAngle += this.orbitSpeed * deltaTime;
            // Keep angle in range [0, 2π) - single modulo is sufficient since angle only increments
            this.orbitAngle = this.orbitAngle % (Math.PI * 2);
            this.updatePositionFromOrbit();
        }
    }

    /**
     * Emit a light ray in specified direction
     */
    emitLight(direction: Vector2D): LightRay {
        return new LightRay(this.position, direction, this.intensity);
    }
}
