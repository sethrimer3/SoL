import type { CombatTarget, Player, Unit, Vector2D } from '../game-core';

type OccludeHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createOccludeHero = (deps: OccludeHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Shadow beam fired by Occlude
     * Visible as a dark shadowy laser when the hero is in sunlight.
     * The beam visually disappears when it hits shadow and only damages
     * targets that are also in sunlight.
     */
    class OccludeShadowBeam {
        lifetime: number = 0;
        readonly maxLifetimeSec: number = Constants.OCCLUDE_BEAM_LIFETIME_SEC;

        constructor(
            public startPos: Vector2D,
            public endPos: Vector2D,
            public owner: Player,
            /** Whether the beam origin was in sunlight (affects visibility) */
            public startsInSun: boolean
        ) {}

        /** Returns true when the beam should be removed */
        update(deltaTimeSec: number): boolean {
            this.lifetime += deltaTimeSec;
            return this.lifetime >= this.maxLifetimeSec;
        }

        getOpacity(): number {
            return 1.0 - (this.lifetime / this.maxLifetimeSec);
        }
    }

    /**
     * Directional cone of shadow created by Occlude's ability.
     * Anything inside the cone acts as if it is in naturally occurring shadow
     * (e.g. solar mirrors inside the cone stop reflecting sunlight).
     */
    class OccludeShadowCone {
        lifetime: number = 0;

        constructor(
            public position: Vector2D,
            /** Normalised direction the cone points toward */
            public direction: Vector2D,
            /** Half-angle of the cone in radians */
            public halfAngleRad: number,
            public rangePx: number,
            public maxLifetimeSec: number,
            public owner: Player
        ) {}

        /**
         * Returns true if `point` lies inside the shadow cone.
         */
        containsPoint(point: Vector2D): boolean {
            const dx = point.x - this.position.x;
            const dy = point.y - this.position.y;
            const distSq = dx * dx + dy * dy;
            const rangeSq = this.rangePx * this.rangePx;
            if (distSq > rangeSq) {
                return false;
            }
            if (distSq === 0) {
                return true; // Origin is inside the cone
            }
            // Compute dot product without full sqrt to check forward half-space first
            const dot = dx * this.direction.x + dy * this.direction.y;
            if (dot <= 0) {
                return false; // Point is behind the cone origin
            }
            // Now check exact angle (requires sqrt for normalisation)
            const dist = Math.sqrt(distSq);
            const cosAngle = dot / dist; // dot / (dist * 1) since direction is normalised
            const clampedCos = Math.max(-1, Math.min(1, cosAngle));
            return Math.acos(clampedCos) <= this.halfAngleRad;
        }

        /** Returns true when the cone should be removed */
        update(deltaTimeSec: number): boolean {
            this.lifetime += deltaTimeSec;
            return this.lifetime >= this.maxLifetimeSec;
        }

        getRemainingFraction(): number {
            return Math.max(0, 1.0 - (this.lifetime / this.maxLifetimeSec));
        }
    }

    /**
     * Occlude hero unit (Velaris faction)
     *
     * Attacks with beams of shadow that are only effective when both Occlude and
     * the target are in sunlight.  When Occlude is in shadow the beam fires but
     * is invisible and deals no damage.  When the target is in shadow the beam
     * visually disappears at the shadow boundary and deals no damage.
     *
     * Ability: project a 15° shadow cone outward.  Anything inside the cone
     * acts as if it is in naturally occurring shadow for the cone's duration.
     */
    class Occlude extends Unit {
        /** Last target attacked this tick – processed by UnitEffectsSystem. */
        private pendingAttackTarget: CombatTarget | null = null;
        /** Shadow beam visual effects managed by the system. */
        public shadowBeams: OccludeShadowBeam[] = [];
        /** Pending shadow cone created by ability – consumed by UnitEffectsSystem. */
        private pendingShadowCone: OccludeShadowCone | null = null;

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.OCCLUDE_MAX_HEALTH,
                Constants.OCCLUDE_ATTACK_RANGE,
                Constants.OCCLUDE_ATTACK_DAMAGE,
                Constants.OCCLUDE_ATTACK_SPEED,
                Constants.OCCLUDE_ABILITY_COOLDOWN
            );
            this.isHero = true;
        }

        /**
         * Override attack to defer damage – the system applies it after checking
         * whether both Occlude and the target are in sunlight.
         */
        override attack(target: CombatTarget): void {
            this.pendingAttackTarget = target;
            // Do not modify target.health here; UnitEffectsSystem handles it.
        }

        /** Called by UnitEffectsSystem – returns and clears the pending target. */
        getAndClearPendingAttack(): CombatTarget | null {
            const target = this.pendingAttackTarget;
            this.pendingAttackTarget = null;
            return target;
        }

        /**
         * Activate Occlude's shadow cone ability.
         * The direction vector indicates which way the cone should point.
         */
        override useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            const normDir = len > 0
                ? new Vector2D(direction.x / len, direction.y / len)
                : new Vector2D(1, 0);

            this.pendingShadowCone = new OccludeShadowCone(
                new Vector2D(this.position.x, this.position.y),
                normDir,
                Constants.OCCLUDE_SHADOW_CONE_ANGLE_RAD / 2,
                Constants.OCCLUDE_SHADOW_CONE_RANGE_PX,
                Constants.OCCLUDE_SHADOW_CONE_DURATION_SEC,
                this.owner
            );

            return true;
        }

        /** Called by UnitEffectsSystem – returns and clears the pending cone. */
        getAndClearShadowCone(): OccludeShadowCone | null {
            const cone = this.pendingShadowCone;
            this.pendingShadowCone = null;
            return cone;
        }

        /** Advance shadow beam lifetimes; call once per tick from UnitEffectsSystem. */
        updateShadowBeams(deltaTimeSec: number): void {
            this.shadowBeams = this.shadowBeams.filter(beam => !beam.update(deltaTimeSec));
        }
    }

    return { Occlude, OccludeShadowBeam, OccludeShadowCone };
};
