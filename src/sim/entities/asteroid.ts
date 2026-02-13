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
        public sides: number,
        public size: number
    ) {
        this.sides = Math.max(12, Math.min(24, Math.floor(this.sides)));
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

        let attempts = 0;
        while (attempts < 8) {
            const candidateVertices: Vector2D[] = [];
            const angleStep = (Math.PI * 2) / this.sides;

            for (let i = 0; i < this.sides; i++) {
                const angleJitter = rng.nextFloat(-angleStep * 0.32, angleStep * 0.32);
                const angle = angleStep * i + angleJitter;
                const radiusScale = rng.nextFloat(0.68, 1.32);
                const radius = this.size * radiusScale;
                candidateVertices.push(new Vector2D(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                ));
            }

            candidateVertices.sort((pointA, pointB) => Math.atan2(pointA.y, pointA.x) - Math.atan2(pointB.y, pointB.x));
            if (this.isConvexPolygon(candidateVertices)) {
                this.vertices = candidateVertices;
                return;
            }

            attempts++;
        }

        for (let i = 0; i < this.sides; i++) {
            const angle = (Math.PI * 2 * i) / this.sides;
            const radius = this.size * rng.nextFloat(0.75, 1.25);
            this.vertices.push(new Vector2D(Math.cos(angle) * radius, Math.sin(angle) * radius));
        }
    }

    private isConvexPolygon(vertices: Vector2D[]): boolean {
        if (vertices.length < 3) {
            return false;
        }

        let hasPositiveCross = false;
        let hasNegativeCross = false;
        const vertexCount = vertices.length;

        for (let i = 0; i < vertexCount; i++) {
            const pointA = vertices[i];
            const pointB = vertices[(i + 1) % vertexCount];
            const pointC = vertices[(i + 2) % vertexCount];
            const edgeABx = pointB.x - pointA.x;
            const edgeABy = pointB.y - pointA.y;
            const edgeBCx = pointC.x - pointB.x;
            const edgeBCy = pointC.y - pointB.y;
            const crossProduct = edgeABx * edgeBCy - edgeABy * edgeBCx;

            if (crossProduct > 0.0001) {
                hasPositiveCross = true;
            } else if (crossProduct < -0.0001) {
                hasNegativeCross = true;
            }

            if (hasPositiveCross && hasNegativeCross) {
                return false;
            }
        }

        return true;
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
