/**
 * Sun entity - Emits light for solar mirrors to reflect
 */

import { Vector2D, LightRay } from '../math';

/**
 * Sun - Main light source in the game
 */
export class Sun {
    constructor(
        public position: Vector2D,
        public intensity: number = 1.0,
        public radius: number = 100.0,
        public type: 'normal' | 'lad' = 'normal'  // Type for special suns like LaD
    ) {}

    /**
     * Emit a light ray in specified direction
     */
    emitLight(direction: Vector2D): LightRay {
        return new LightRay(this.position, direction, this.intensity);
    }
}
