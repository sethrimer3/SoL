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
    constructor(position, intensity = 1.0, radius = 100.0, type = 'normal', // Type for special suns like LaD
    orbitCenter, orbitRadius, orbitSpeed, initialOrbitAngle) {
        this.position = position;
        this.intensity = intensity;
        this.radius = radius;
        this.type = type;
        // Orbital motion properties
        this.orbitCenter = null; // Center point to orbit around (null for stationary)
        this.orbitRadius = 0; // Distance from orbit center
        this.orbitSpeed = 0; // Angular speed in radians per second
        this.orbitAngle = 0; // Current angle in orbit
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
    updatePositionFromOrbit() {
        if (this.orbitCenter) {
            this.position = new math_1.Vector2D(this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius, this.orbitCenter.y + Math.sin(this.orbitAngle) * this.orbitRadius);
        }
    }
    /**
     * Update sun (for orbital motion)
     */
    update(deltaTime) {
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
    emitLight(direction) {
        return new math_1.LightRay(this.position, direction, this.intensity);
    }
}
exports.Sun = Sun;
