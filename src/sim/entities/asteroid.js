"use strict";
/**
 * Asteroid entity - Polygon obstacle that blocks light and casts shadows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Asteroid = void 0;
const math_1 = require("../math");
const seeded_random_1 = require("../../seeded-random");
/**
 * Asteroid - Polygon obstacle that blocks light and casts shadows
 */
class Asteroid {
    constructor(position, sides, // 3-9 sides (triangle to nonagon)
    size) {
        this.position = position;
        this.sides = sides;
        this.size = size;
        this.vertices = [];
        this.rotation = 0;
        this.generateVertices();
        const rng = (0, seeded_random_1.getGameRNG)();
        this.rotationSpeed = rng.nextFloat(-0.25, 0.25); // Random rotation speed
    }
    /**
     * Generate polygon vertices
     */
    generateVertices() {
        this.vertices = [];
        const rng = (0, seeded_random_1.getGameRNG)();
        for (let i = 0; i < this.sides; i++) {
            const angle = (Math.PI * 2 * i) / this.sides;
            // Add some randomness to make asteroids less uniform
            const radiusVariation = rng.nextFloat(0.8, 1.2);
            const radius = this.size * radiusVariation;
            this.vertices.push(new math_1.Vector2D(Math.cos(angle) * radius, Math.sin(angle) * radius));
        }
    }
    /**
     * Get world-space vertices (with position and rotation)
     */
    getWorldVertices() {
        return this.vertices.map(v => {
            const cos = Math.cos(this.rotation);
            const sin = Math.sin(this.rotation);
            return new math_1.Vector2D(this.position.x + v.x * cos - v.y * sin, this.position.y + v.x * sin + v.y * cos);
        });
    }
    /**
     * Update asteroid rotation
     */
    update(deltaTime) {
        this.rotation += this.rotationSpeed * deltaTime;
    }
    /**
     * Check if a point is inside the asteroid (for collision detection)
     */
    containsPoint(point) {
        const worldVertices = this.getWorldVertices();
        let inside = false;
        for (let i = 0, j = worldVertices.length - 1; i < worldVertices.length; j = i++) {
            const xi = worldVertices[i].x, yi = worldVertices[i].y;
            const xj = worldVertices[j].x, yj = worldVertices[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect)
                inside = !inside;
        }
        return inside;
    }
}
exports.Asteroid = Asteroid;
