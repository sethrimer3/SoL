/**
 * Asteroid entity - Polygon obstacle that blocks light and casts shadows
 */

import { Vector2D } from '../math';
import { getGameRNG } from '../../seeded-random';

/**
 * Asteroid - Polygon obstacle that blocks light and casts shadows
 */
export class Asteroid {
    vertices: Vector2D[] = [];
    rotation: number = 0;
    rotationSpeed: number;

    constructor(
        public position: Vector2D,
        public sides: number, // 3-9 sides (triangle to nonagon)
        public size: number
    ) {
        this.generateVertices();
        const rng = getGameRNG();
        this.rotationSpeed = rng.nextFloat(-0.25, 0.25); // Random rotation speed
    }

    /**
     * Generate polygon vertices
     */
    private generateVertices(): void {
        this.vertices = [];
        const rng = getGameRNG();
        for (let i = 0; i < this.sides; i++) {
            const angle = (Math.PI * 2 * i) / this.sides;
            // Add some randomness to make asteroids less uniform
            const radiusVariation = rng.nextFloat(0.8, 1.2);
            const radius = this.size * radiusVariation;
            this.vertices.push(new Vector2D(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            ));
        }
    }

    /**
     * Get world-space vertices (with position and rotation)
     */
    getWorldVertices(): Vector2D[] {
        return this.vertices.map(v => {
            const cos = Math.cos(this.rotation);
            const sin = Math.sin(this.rotation);
            return new Vector2D(
                this.position.x + v.x * cos - v.y * sin,
                this.position.y + v.x * sin + v.y * cos
            );
        });
    }

    /**
     * Update asteroid rotation
     */
    update(deltaTime: number): void {
        this.rotation += this.rotationSpeed * deltaTime;
    }

    /**
     * Check if a point is inside the asteroid (for collision detection)
     */
    containsPoint(point: Vector2D): boolean {
        const worldVertices = this.getWorldVertices();
        let inside = false;
        
        for (let i = 0, j = worldVertices.length - 1; i < worldVertices.length; j = i++) {
            const xi = worldVertices[i].x, yi = worldVertices[i].y;
            const xj = worldVertices[j].x, yj = worldVertices[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
}
