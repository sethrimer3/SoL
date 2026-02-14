"use strict";
/**
 * Sun entity - Emits light for solar mirrors to reflect
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sun = void 0;
const math_1 = require("../math");
/**
 * Sun - Main light source in the game
 */
class Sun {
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
        return new math_1.LightRay(this.position, direction, this.intensity);
    }
}
exports.Sun = Sun;
