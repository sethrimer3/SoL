"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRayHero = void 0;
const createRayHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Ray beam segment for bouncing beam ability
     */
    class RayBeamSegment {
        constructor(startPos, endPos, owner) {
            this.startPos = startPos;
            this.endPos = endPos;
            this.owner = owner;
            this.lifetime = 0;
            this.maxLifetime = 0.5; // 0.5 seconds per segment
        }
        update(deltaTime) {
            this.lifetime += deltaTime;
            return this.lifetime >= this.maxLifetime;
        }
    }
    /**
     * Ray hero unit (Velaris faction) - shoots bouncing beam
     */
    class Ray extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.RAY_MAX_HEALTH, Constants.RAY_ATTACK_RANGE, Constants.RAY_ATTACK_DAMAGE, Constants.RAY_ATTACK_SPEED, Constants.RAY_ABILITY_COOLDOWN);
            this.beamSegments = [];
            this.drillDirection = null; // Used temporarily to store ability direction
            this.isHero = true; // Ray is a hero unit for Velaris faction
        }
        /**
         * Use Ray's bouncing beam ability
         */
        useAbility(direction) {
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
        getBeamSegments() {
            return this.beamSegments;
        }
        /**
         * Set beam segments (called by GameState after calculating bounces)
         */
        setBeamSegments(segments) {
            this.beamSegments = segments;
        }
        /**
         * Update beam segments
         */
        updateBeamSegments(deltaTime) {
            this.beamSegments = this.beamSegments.filter((segment) => !segment.update(deltaTime));
        }
    }
    return { Ray, RayBeamSegment };
};
exports.createRayHero = createRayHero;
