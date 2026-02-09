/**
 * Sun entity - Emits light for solar mirrors to reflect
 */
import { LightRay } from '../math';
/**
 * Sun - Main light source in the game
 */
export class Sun {
    constructor(position, intensity = 1.0, radius = 100.0, type = 'normal' // Type for special suns like LaD
    ) {
        this.position = position;
        this.intensity = intensity;
        this.radius = radius;
        this.type = type;
    }
    /**
     * Emit a light ray in specified direction
     */
    emitLight(direction) {
        return new LightRay(this.position, direction, this.intensity);
    }
}
