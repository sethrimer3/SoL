import type { Player, Unit, Vector2D, Asteroid } from '../game-core';
import type { CombatTarget } from '../sim/entities/buildings';

export type SplendorObstacle = {
    position: Vector2D;
    radius: number;
};

type SplendorHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createSplendorHero = (deps: SplendorHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    class SplendorLaserSegment {
        lifetime: number = 0;

        constructor(
            public startPos: Vector2D,
            public endPos: Vector2D,
            public owner: Player,
            public durationSec: number = Constants.SPLENDOR_LASER_VISUAL_DURATION_SEC
        ) {}

        update(deltaTime: number): void {
            this.lifetime += deltaTime;
        }

        isExpired(): boolean {
            return this.lifetime >= this.durationSec;
        }
    }

    class SplendorSunlightZone {
        lifetime: number = 0;

        constructor(
            public position: Vector2D,
            public owner: Player,
            public radius: number = Constants.SPLENDOR_SUNLIGHT_ZONE_RADIUS,
            public durationSec: number = Constants.SPLENDOR_SUNLIGHT_ZONE_DURATION_SEC
        ) {}

        update(deltaTime: number): void {
            this.lifetime += deltaTime;
        }

        isExpired(): boolean {
            return this.lifetime >= this.durationSec;
        }

        containsPoint(point: Vector2D): boolean {
            return this.position.distanceTo(point) <= this.radius;
        }
    }

    class SplendorSunSphere {
        lifetime: number = 0;
        shouldExplode: boolean = false;

        constructor(
            public position: Vector2D,
            public velocity: Vector2D,
            public owner: Player,
            public decelerationPerSec: number = Constants.SPLENDOR_SUN_SPHERE_DECELERATION
        ) {}

        update(deltaTime: number, asteroids: Asteroid[], obstacles: SplendorObstacle[]): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;

            const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (currentSpeed > 0) {
                const newSpeed = Math.max(0, currentSpeed - this.decelerationPerSec * deltaTime);
                const speedRatio = newSpeed / currentSpeed;
                this.velocity.x *= speedRatio;
                this.velocity.y *= speedRatio;
            }

            this.bounceAgainstAsteroids(asteroids);
            this.bounceAgainstObstacles(obstacles);

            this.lifetime += deltaTime;
            if (this.lifetime >= Constants.SPLENDOR_SUN_SPHERE_MAX_LIFETIME_SEC || this.getCurrentSpeed() <= Constants.SPLENDOR_SUN_SPHERE_STOP_SPEED_PX_PER_SEC) {
                this.shouldExplode = true;
            }
        }

        private bounceAgainstAsteroids(asteroids: Asteroid[]): void {
            for (const asteroid of asteroids) {
                if (asteroid.containsPoint(this.position)) {
                    this.reflectFromCircle(asteroid.position, asteroid.size + Constants.SPLENDOR_SUN_SPHERE_RADIUS);
                    break;
                }
            }
        }

        private bounceAgainstObstacles(obstacles: SplendorObstacle[]): void {
            for (const obstacle of obstacles) {
                const distance = this.position.distanceTo(obstacle.position);
                const collisionDistance = obstacle.radius + Constants.SPLENDOR_SUN_SPHERE_RADIUS;
                if (distance <= collisionDistance) {
                    this.reflectFromCircle(obstacle.position, collisionDistance);
                    break;
                }
            }
        }

        private reflectFromCircle(center: Vector2D, collisionDistance: number): void {
            const dx = this.position.x - center.x;
            const dy = this.position.y - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= 0) {
                return;
            }

            const normalX = dx / dist;
            const normalY = dy / dist;
            const dot = this.velocity.x * normalX + this.velocity.y * normalY;
            this.velocity.x -= 2 * dot * normalX;
            this.velocity.y -= 2 * dot * normalY;
            this.velocity.x *= Constants.SPLENDOR_SUN_SPHERE_BOUNCE_DAMPING;
            this.velocity.y *= Constants.SPLENDOR_SUN_SPHERE_BOUNCE_DAMPING;

            const pushDist = collisionDistance - dist;
            if (pushDist > 0) {
                this.position.x += normalX * pushDist;
                this.position.y += normalY * pushDist;
            }
        }

        getCurrentSpeed(): number {
            return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        }
    }

    class Splendor extends Unit {
        private sunSphereToCreate: SplendorSunSphere | null = null;
        private pendingLaserSegment: SplendorLaserSegment | null = null;
        private isChargingLaserAttack: boolean = false;
        private laserChargeRemainingSec: number = 0;
        private laserDirection: Vector2D = new Vector2D(0, -1);

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.SPLENDOR_MAX_HEALTH,
                Constants.SPLENDOR_ATTACK_RANGE,
                Constants.SPLENDOR_ATTACK_DAMAGE,
                Constants.SPLENDOR_ATTACK_SPEED,
                Constants.SPLENDOR_ABILITY_COOLDOWN
            );
            this.isHero = true;
        }

        update(deltaTime: number, enemies: CombatTarget[], allUnits: Unit[], asteroids: Asteroid[] = []): void {
            if (this.isChargingLaserAttack) {
                this.laserChargeRemainingSec -= deltaTime;
                if (this.laserChargeRemainingSec <= 0) {
                    this.firePiercingLaser(enemies);
                }
            }

            super.update(deltaTime, enemies, allUnits, asteroids);
        }

        attack(target: CombatTarget): void {
            if (this.isChargingLaserAttack) {
                return;
            }

            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0) {
                return;
            }

            this.laserDirection = new Vector2D(dx / distance, dy / distance);
            this.isChargingLaserAttack = true;
            this.laserChargeRemainingSec = Constants.SPLENDOR_CHARGE_TIME_SEC;
        }

        private firePiercingLaser(enemies: CombatTarget[]): void {
            this.isChargingLaserAttack = false;
            this.laserChargeRemainingSec = 0;

            const startPos = new Vector2D(
                this.position.x + this.laserDirection.x * Constants.SPLENDOR_LASER_NOSE_OFFSET,
                this.position.y + this.laserDirection.y * Constants.SPLENDOR_LASER_NOSE_OFFSET
            );
            const endPos = new Vector2D(
                startPos.x + this.laserDirection.x * Constants.SPLENDOR_ATTACK_RANGE,
                startPos.y + this.laserDirection.y * Constants.SPLENDOR_ATTACK_RANGE
            );

            const lineX = endPos.x - startPos.x;
            const lineY = endPos.y - startPos.y;
            const lineLengthSq = lineX * lineX + lineY * lineY;
            if (lineLengthSq <= 0) {
                return;
            }

            for (const enemy of enemies) {
                if (!('health' in enemy) || enemy.health <= 0) {
                    continue;
                }

                const toEnemyX = enemy.position.x - startPos.x;
                const toEnemyY = enemy.position.y - startPos.y;
                const projection = (toEnemyX * lineX + toEnemyY * lineY) / lineLengthSq;
                if (projection < 0 || projection > 1) {
                    continue;
                }

                const closestX = startPos.x + lineX * projection;
                const closestY = startPos.y + lineY * projection;
                const perpX = enemy.position.x - closestX;
                const perpY = enemy.position.y - closestY;
                const distanceToLine = Math.sqrt(perpX * perpX + perpY * perpY);

                if (distanceToLine <= Constants.SPLENDOR_LASER_WIDTH_PX) {
                    enemy.health -= this.attackDamage;
                }
            }

            this.pendingLaserSegment = new SplendorLaserSegment(startPos, endPos, this.owner);
        }

        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const speed = Math.min(
                arrowLength * Constants.SPLENDOR_SUN_SPHERE_SPEED_MULTIPLIER,
                Constants.SPLENDOR_SUN_SPHERE_MAX_SPEED
            );
            const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const normalizedX = length > 0 ? direction.x / length : 0;
            const normalizedY = length > 0 ? direction.y / length : 0;

            this.sunSphereToCreate = new SplendorSunSphere(
                new Vector2D(this.position.x, this.position.y),
                new Vector2D(normalizedX * speed, normalizedY * speed),
                this.owner
            );

            return true;
        }

        getAndClearSunSphere(): SplendorSunSphere | null {
            const sphere = this.sunSphereToCreate;
            this.sunSphereToCreate = null;
            return sphere;
        }

        getAndClearLaserSegment(): SplendorLaserSegment | null {
            const segment = this.pendingLaserSegment;
            this.pendingLaserSegment = null;
            return segment;
        }

        isChargingAttack(): boolean {
            return this.isChargingLaserAttack;
        }

        getChargeProgress(): number {
            if (!this.isChargingLaserAttack) {
                return 0;
            }
            const chargeElapsedSec = Constants.SPLENDOR_CHARGE_TIME_SEC - this.laserChargeRemainingSec;
            return Math.max(0, Math.min(1, chargeElapsedSec / Constants.SPLENDOR_CHARGE_TIME_SEC));
        }

        getChargeDirection(): Vector2D {
            return this.laserDirection;
        }
    }

    return { Splendor, SplendorSunSphere, SplendorSunlightZone, SplendorLaserSegment };
};
