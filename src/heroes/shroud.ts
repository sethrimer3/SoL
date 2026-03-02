import type { Player, Unit, Vector2D, CombatTarget } from '../game-core';

type ShroudHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createShroudHero = (deps: ShroudHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Tiny cube - spawned from ShroudSmallCube when fully unfolded.
     * Blocks sunlight for enemy solar mirrors.
     */
    class ShroudTinyCube {
        halfSizePx: number = Constants.SHROUD_TINY_CUBE_HALF_SIZE_PX;
        unfoldProgress: number = 0; // 0..1
        startPos: Vector2D;
        finalPos: Vector2D;
        lifetime: number = 0;

        constructor(
            startX: number,
            startY: number,
            finalX: number,
            finalY: number
        ) {
            this.startPos = new Vector2D(startX, startY);
            this.finalPos = new Vector2D(finalX, finalY);
        }

        get position(): Vector2D {
            const t = this.unfoldProgress;
            return new Vector2D(
                this.startPos.x + (this.finalPos.x - this.startPos.x) * t,
                this.startPos.y + (this.finalPos.y - this.startPos.y) * t
            );
        }

        update(deltaTime: number): void {
            if (this.unfoldProgress < 1) {
                this.unfoldProgress = Math.min(
                    1,
                    this.unfoldProgress + deltaTime / Constants.SHROUD_UNFOLD_DURATION_SEC
                );
            }
            this.lifetime += deltaTime;
        }

        getWorldVertices(): Vector2D[] {
            const cx = this.startPos.x + (this.finalPos.x - this.startPos.x) * this.unfoldProgress;
            const cy = this.startPos.y + (this.finalPos.y - this.startPos.y) * this.unfoldProgress;
            const h = this.halfSizePx;
            return [
                new Vector2D(cx - h, cy - h),
                new Vector2D(cx + h, cy - h),
                new Vector2D(cx + h, cy + h),
                new Vector2D(cx - h, cy + h),
            ];
        }
    }

    /**
     * Small cube - spawned from ShroudCube when the main cube stops.
     * After fully unfolding it spawns ShroudTinyCubes.
     * Blocks sunlight for enemy solar mirrors.
     */
    class ShroudSmallCube {
        halfSizePx: number = Constants.SHROUD_SMALL_CUBE_HALF_SIZE_PX;
        unfoldProgress: number = 0; // 0..1
        startPos: Vector2D;
        finalPos: Vector2D;
        lifetime: number = 0;
        tinyCubes: ShroudTinyCube[] = [];
        tinyCubesSpawned: boolean = false;

        /** parentFaceDir: unit vector pointing away from the parent cube center (used to exclude back-face tiny cubes). */
        parentFaceDir: Vector2D;

        constructor(
            startX: number,
            startY: number,
            finalX: number,
            finalY: number,
            parentFaceDirX: number,
            parentFaceDirY: number
        ) {
            this.startPos = new Vector2D(startX, startY);
            this.finalPos = new Vector2D(finalX, finalY);
            this.parentFaceDir = new Vector2D(parentFaceDirX, parentFaceDirY);
        }

        get currentX(): number {
            return this.startPos.x + (this.finalPos.x - this.startPos.x) * this.unfoldProgress;
        }

        get currentY(): number {
            return this.startPos.y + (this.finalPos.y - this.startPos.y) * this.unfoldProgress;
        }

        /** True when the small cube is fully in its final position. */
        isFullyUnfolded(): boolean {
            return this.unfoldProgress >= 1;
        }

        update(deltaTime: number): void {
            if (this.unfoldProgress < 1) {
                this.unfoldProgress = Math.min(
                    1,
                    this.unfoldProgress + deltaTime / Constants.SHROUD_UNFOLD_DURATION_SEC
                );
            }

            // Spawn tiny cubes when fully unfolded
            if (this.isFullyUnfolded() && !this.tinyCubesSpawned) {
                this.spawnTinyCubes();
                this.tinyCubesSpawned = true;
            }

            for (const tiny of this.tinyCubes) {
                tiny.update(deltaTime);
            }

            this.lifetime += deltaTime;
        }

        private spawnTinyCubes(): void {
            const cx = this.finalPos.x;
            const cy = this.finalPos.y;
            const s = this.halfSizePx;           // 14
            const t = Constants.SHROUD_TINY_CUBE_HALF_SIZE_PX; // 7
            const gap = s + t;                   // distance from small cube center to tiny cube center

            // 4 cardinal directions for tiny cubes
            const dirs = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
            ];

            for (const dir of dirs) {
                // Skip the face pointing toward the parent cube
                const dot = dir.dx * (-this.parentFaceDir.x) + dir.dy * (-this.parentFaceDir.y);
                if (dot > 0.5) continue; // pointing back toward parent - skip

                const finalX = cx + dir.dx * gap;
                const finalY = cy + dir.dy * gap;
                this.tinyCubes.push(new ShroudTinyCube(cx, cy, finalX, finalY));
            }
        }

        getWorldVertices(): Vector2D[] {
            const cx = this.currentX;
            const cy = this.currentY;
            const h = this.halfSizePx;
            return [
                new Vector2D(cx - h, cy - h),
                new Vector2D(cx + h, cy - h),
                new Vector2D(cx + h, cy + h),
                new Vector2D(cx - h, cy + h),
            ];
        }

        /** Return all polygon vertex arrays for this small cube and its tiny children. */
        getAllBlockingVertexArrays(): Vector2D[][] {
            const result: Vector2D[][] = [this.getWorldVertices()];
            for (const tiny of this.tinyCubes) {
                result.push(tiny.getWorldVertices());
            }
            return result;
        }
    }

    /**
     * ShroudCube - the main projectile fired by the Shroud hero.
     *
     * - Starts with fast velocity, decelerates quickly.
     * - Does damage to enemy units and structures proportional to current velocity.
     * - When stopped, unfolds ShroudSmallCubes, which in turn unfold ShroudTinyCubes.
     * - All stopped cubes block sunlight for solar mirrors.
     */
    class ShroudCube {
        halfSizePx: number = Constants.SHROUD_CUBE_HALF_SIZE_PX;
        lifetime: number = 0;
        initialSpeedPxPerSec: number;
        smallCubes: ShroudSmallCube[] = [];
        childrenSpawned: boolean = false;
        owner: Player;

        constructor(
            public position: Vector2D,
            public velocity: Vector2D,
            owner: Player
        ) {
            this.owner = owner;
            this.initialSpeedPxPerSec = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        }

        getCurrentSpeed(): number {
            return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        }

        /** Fraction of initial speed remaining (0..1). Used for damage scaling. */
        getDamageFraction(): number {
            if (this.initialSpeedPxPerSec <= 0) return 0;
            return Math.min(1, this.getCurrentSpeed() / this.initialSpeedPxPerSec);
        }

        isStopped(): boolean {
            return this.getCurrentSpeed() < Constants.SHROUD_CUBE_STOP_SPEED;
        }

        isExpired(): boolean {
            return this.isStopped() && this.lifetime > Constants.SHROUD_CUBE_LIFETIME_SEC;
        }

        update(deltaTime: number): void {
            if (!this.isStopped()) {
                // Move
                this.position.x += this.velocity.x * deltaTime;
                this.position.y += this.velocity.y * deltaTime;

                // Decelerate
                const currentSpeed = this.getCurrentSpeed();
                if (currentSpeed > 0) {
                    const newSpeed = Math.max(0, currentSpeed - Constants.SHROUD_CUBE_DECELERATION * deltaTime);
                    const ratio = newSpeed / currentSpeed;
                    this.velocity.x *= ratio;
                    this.velocity.y *= ratio;
                }
            } else if (!this.childrenSpawned) {
                this.spawnSmallCubes();
                this.childrenSpawned = true;
            }

            for (const small of this.smallCubes) {
                small.update(deltaTime);
            }

            this.lifetime += deltaTime;
        }

        private spawnSmallCubes(): void {
            const cx = this.position.x;
            const cy = this.position.y;
            const s = this.halfSizePx;                            // 28
            const sc = Constants.SHROUD_SMALL_CUBE_HALF_SIZE_PX;  // 14
            const gap = s + sc;                                    // 42

            const dirs = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
            ];

            for (const dir of dirs) {
                const finalX = cx + dir.dx * gap;
                const finalY = cy + dir.dy * gap;
                this.smallCubes.push(new ShroudSmallCube(
                    cx, cy, finalX, finalY, dir.dx, dir.dy
                ));
            }
        }

        getWorldVertices(): Vector2D[] {
            const cx = this.position.x;
            const cy = this.position.y;
            const h = this.halfSizePx;
            return [
                new Vector2D(cx - h, cy - h),
                new Vector2D(cx + h, cy - h),
                new Vector2D(cx + h, cy + h),
                new Vector2D(cx - h, cy + h),
            ];
        }

        /**
         * Returns all polygon vertex arrays for this cube and all child/grandchild cubes.
         * Only returns cubes that are fully stopped (for light blocking).
         */
        getAllBlockingVertexArrays(): Vector2D[][] {
            if (!this.isStopped()) return [];
            const result: Vector2D[][] = [this.getWorldVertices()];
            for (const small of this.smallCubes) {
                for (const verts of small.getAllBlockingVertexArrays()) {
                    result.push(verts);
                }
            }
            return result;
        }
    }

    /**
     * Shroud hero - Aurum faction.
     * Fires large, heavy cubes that decelerate quickly and do velocity-proportional damage.
     * When stopped the cubes unfold smaller and smaller sub-cubes that block sunlight.
     */
    class Shroud extends Unit {
        private cubeToCreate: ShroudCube | null = null;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.SHROUD_MAX_HEALTH,
                Constants.SHROUD_ATTACK_RANGE,
                Constants.SHROUD_ATTACK_DAMAGE,
                Constants.SHROUD_ATTACK_SPEED,
                Constants.SHROUD_ABILITY_COOLDOWN
            );
            this.isHero = true;
        }

        // Shroud does not attack normally
        attack(_target: CombatTarget): void {}

        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            const arrowLength = Math.sqrt(direction.x ** 2 + direction.y ** 2);
            const speed = Math.min(
                arrowLength * Constants.SHROUD_CUBE_SPEED_MULTIPLIER,
                Constants.SHROUD_CUBE_INITIAL_SPEED
            );

            const len = arrowLength > 0 ? arrowLength : 1;
            const vx = (direction.x / len) * speed;
            const vy = (direction.y / len) * speed;

            this.cubeToCreate = new ShroudCube(
                new Vector2D(this.position.x, this.position.y),
                new Vector2D(vx, vy),
                this.owner
            );

            return true;
        }

        getAndClearCube(): ShroudCube | null {
            const cube = this.cubeToCreate;
            this.cubeToCreate = null;
            return cube;
        }
    }

    return { Shroud, ShroudCube, ShroudSmallCube, ShroudTinyCube };
};
