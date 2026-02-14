/**
 * Math and geometry primitives for SoL game simulation
 */

/**
 * 2D position/direction vector
 */
export class Vector2D {
    constructor(public x: number, public y: number) {}

    /**
     * Calculate distance to another vector
     */
    distanceTo(other: Vector2D): number {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    /**
     * Return normalized vector
     */
    normalize(): Vector2D {
        const magnitude = Math.sqrt(this.x ** 2 + this.y ** 2);
        if (magnitude === 0) {
            return new Vector2D(0, 0);
        }
        return new Vector2D(this.x / magnitude, this.y / magnitude);
    }
}

/**
 * Represents a ray of light for ray tracing
 */
export class LightRay {
    constructor(
        public origin: Vector2D,
        public direction: Vector2D,
        public intensity: number = 1.0
    ) {}

    /**
     * Check if ray intersects with a circular object
     */
    intersects(position: Vector2D, radius: number): boolean {
        // Ray-circle intersection using vector math
        const oc = new Vector2D(this.origin.x - position.x, this.origin.y - position.y);
        const a = this.direction.x * this.direction.x + this.direction.y * this.direction.y;
        const b = 2.0 * (oc.x * this.direction.x + oc.y * this.direction.y);
        const c = oc.x * oc.x + oc.y * oc.y - radius * radius;
        const discriminant = b * b - 4 * a * c;
        return discriminant >= 0;
    }

    /**
     * Check if ray intersects with a polygon and return the distance to the closest intersection
     */
    intersectsPolygon(vertices: Vector2D[]): boolean {
        // Check each edge of the polygon
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            
            if (this.intersectsLineSegment(v1, v2) !== null) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get the distance to the closest intersection with a polygon, or null if no intersection
     */
    getIntersectionDistance(vertices: Vector2D[]): number | null {
        let closestDistance: number | null = null;
        
        // Check each edge of the polygon
        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            
            const distance = this.intersectsLineSegment(v1, v2);
            if (distance !== null) {
                if (closestDistance === null || distance < closestDistance) {
                    closestDistance = distance;
                }
            }
        }
        
        return closestDistance;
    }

    /**
     * Check if ray intersects with a line segment and return the distance, or null if no intersection
     */
    private intersectsLineSegment(p1: Vector2D, p2: Vector2D): number | null {
        const v1 = new Vector2D(p2.x - p1.x, p2.y - p1.y);
        const v2 = new Vector2D(p1.x - this.origin.x, p1.y - this.origin.y);
        const cross1 = this.direction.x * v1.y - this.direction.y * v1.x;
        
        if (Math.abs(cross1) < 0.0001) return null; // Parallel
        
        const t1 = (v2.x * v1.y - v2.y * v1.x) / cross1;
        const t2 = (v2.x * this.direction.y - v2.y * this.direction.x) / cross1;
        
        if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
            return t1; // Return the distance along the ray
        }
        
        return null;
    }
}

/**
 * Apply knockback velocity to an entity from asteroid rotation collision
 * @param entityPos Current entity position
 * @param entityKnockbackVelocity Entity's knockback velocity vector to modify
 * @param asteroidCenter Position of the asteroid center
 * @param initialSpeed Initial knockback speed in pixels per second
 */
export function applyKnockbackVelocity(
    entityPos: Vector2D,
    entityKnockbackVelocity: Vector2D,
    asteroidCenter: Vector2D,
    initialSpeed: number
): void {
    // Calculate direction away from asteroid center
    const directionX = entityPos.x - asteroidCenter.x;
    const directionY = entityPos.y - asteroidCenter.y;
    const distance = Math.sqrt(directionX * directionX + directionY * directionY);
    
    // Normalize direction (handle edge case where entity is exactly at asteroid center)
    if (distance > 0.001) {
        const normalizedX = directionX / distance;
        const normalizedY = directionY / distance;
        
        // Set knockback velocity
        entityKnockbackVelocity.x = normalizedX * initialSpeed;
        entityKnockbackVelocity.y = normalizedY * initialSpeed;
    } else {
        // If at center, push in a random direction
        const angle = Math.random() * Math.PI * 2;
        entityKnockbackVelocity.x = Math.cos(angle) * initialSpeed;
        entityKnockbackVelocity.y = Math.sin(angle) * initialSpeed;
    }
}

/**
 * Apply knockback deceleration to an entity and update its position
 * @param position Entity position to update
 * @param knockbackVelocity Entity's knockback velocity vector to update
 * @param deltaTime Time elapsed since last update in seconds
 * @param deceleration Deceleration rate in pixels per second squared
 */
export function updateKnockbackMotion(
    position: Vector2D,
    knockbackVelocity: Vector2D,
    deltaTime: number,
    deceleration: number
): void {
    if (knockbackVelocity.x === 0 && knockbackVelocity.y === 0) {
        return;
    }
    
    // Apply knockback movement
    position.x += knockbackVelocity.x * deltaTime;
    position.y += knockbackVelocity.y * deltaTime;
    
    // Apply deceleration to knockback velocity
    const knockbackSpeed = Math.sqrt(
        knockbackVelocity.x * knockbackVelocity.x +
        knockbackVelocity.y * knockbackVelocity.y
    );
    
    if (knockbackSpeed > 0) {
        const decelerationAmount = deceleration * deltaTime;
        const newSpeed = Math.max(0, knockbackSpeed - decelerationAmount);
        const speedRatio = newSpeed / knockbackSpeed;
        knockbackVelocity.x *= speedRatio;
        knockbackVelocity.y *= speedRatio;
        
        // If knockback is very small, set to zero to avoid floating point issues
        if (newSpeed < 0.1) {
            knockbackVelocity.x = 0;
            knockbackVelocity.y = 0;
        }
    }
}
