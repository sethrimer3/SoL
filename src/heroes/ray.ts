import type { Player, Unit, Vector2D } from '../game-core';

type RayHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createRayHero = (deps: RayHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Ray beam segment for bouncing beam ability
     */
    class RayBeamSegment {
        lifetime: number = 0;
        maxLifetime: number = 0.5; // 0.5 seconds per segment

        constructor(
            public startPos: Vector2D,
            public endPos: Vector2D,
            public owner: Player
        ) {}

        update(deltaTime: number): boolean {
            this.lifetime += deltaTime;
            return this.lifetime >= this.maxLifetime;
        }
    }

    /**
     * Ray hero unit (Solari faction) - shoots bouncing beam
     */
    class Ray extends Unit {
        private beamSegments: RayBeamSegment[] = [];
        drillDirection: Vector2D | null = null; // Used temporarily to store ability direction

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.RAY_MAX_HEALTH,
                Constants.RAY_ATTACK_RANGE,
                Constants.RAY_ATTACK_DAMAGE,
                Constants.RAY_ATTACK_SPEED,
                Constants.RAY_ABILITY_COOLDOWN
            );
            this.isHero = true; // Ray is a hero unit for Solari faction
        }

        /**
         * Use Ray's bouncing beam ability
         */
        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            // Store direction for GameState to process
            this.drillDirection = direction;

            return true;
        }

        /**
         * Get beam segments for rendering
         */
        getBeamSegments(): RayBeamSegment[] {
            return this.beamSegments;
        }

        /**
         * Set beam segments (called by GameState after calculating bounces)
         */
        setBeamSegments(segments: RayBeamSegment[]): void {
            this.beamSegments = segments;
        }

        /**
         * Update beam segments
         */
        updateBeamSegments(deltaTime: number): void {
            this.beamSegments = this.beamSegments.filter((segment) => !segment.update(deltaTime));
        }
    }

    return { Ray, RayBeamSegment };
};
