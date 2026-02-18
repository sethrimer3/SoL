"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpotlightHero = void 0;
const createSpotlightHero = (deps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;
    /**
     * Spotlight hero unit - reveals enemies in a narrow cone and fires rapid shots.
     */
    class Spotlight extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.SPOTLIGHT_MAX_HEALTH, Constants.SPOTLIGHT_ATTACK_RANGE, Constants.SPOTLIGHT_ATTACK_DAMAGE, Constants.SPOTLIGHT_ATTACK_SPEED, Constants.SPOTLIGHT_ABILITY_COOLDOWN);
            this.spotlightDirection = null;
            this.spotlightState = 'inactive';
            this.spotlightStateElapsedSec = 0;
            this.spotlightFireCooldownSec = 0;
            this.spotlightLengthFactor = 0;
            this.spotlightRangePx = 0;
            this.isHero = true;
        }
        /**
         * Spotlight has no normal attack.
         */
        attack(target) {
            // No-op: Spotlight relies on its ability cone.
        }
        useAbility(direction) {
            if (this.spotlightState !== 'inactive') {
                return false;
            }
            if (!super.useAbility(direction)) {
                return false;
            }
            this.spotlightDirection = direction.normalize();
            this.spotlightState = 'setup';
            this.spotlightStateElapsedSec = 0;
            this.spotlightFireCooldownSec = 0;
            this.spotlightLengthFactor = 0;
            return true;
        }
        updateSpotlightState(deltaTime) {
            if (this.spotlightState === 'inactive') {
                return;
            }
            this.spotlightStateElapsedSec += deltaTime;
            if (this.spotlightState === 'setup') {
                const setupDurationSec = Constants.SPOTLIGHT_SETUP_TIME_SEC;
                this.spotlightLengthFactor = Math.min(1, this.spotlightStateElapsedSec / setupDurationSec);
                if (this.spotlightStateElapsedSec >= setupDurationSec) {
                    this.spotlightState = 'active';
                    this.spotlightStateElapsedSec = 0;
                    this.spotlightLengthFactor = 1;
                }
            }
            else if (this.spotlightState === 'active') {
                this.spotlightLengthFactor = 1;
                if (this.spotlightStateElapsedSec >= Constants.SPOTLIGHT_ACTIVE_TIME_SEC) {
                    this.spotlightState = 'teardown';
                    this.spotlightStateElapsedSec = 0;
                }
            }
            else if (this.spotlightState === 'teardown') {
                const teardownDurationSec = Constants.SPOTLIGHT_TEARDOWN_TIME_SEC;
                const progress = Math.min(1, this.spotlightStateElapsedSec / teardownDurationSec);
                this.spotlightLengthFactor = Math.max(0, 1 - progress);
                if (this.spotlightStateElapsedSec >= teardownDurationSec) {
                    this.spotlightState = 'inactive';
                    this.spotlightDirection = null;
                    this.spotlightLengthFactor = 0;
                    this.spotlightRangePx = 0;
                    this.spotlightFireCooldownSec = 0;
                }
            }
            if (this.spotlightFireCooldownSec > 0) {
                this.spotlightFireCooldownSec -= deltaTime;
            }
        }
        isSpotlightActive() {
            return this.spotlightState !== 'inactive';
        }
        isSpotlightSetupComplete() {
            return this.spotlightState === 'active' || this.spotlightState === 'teardown';
        }
        getSpotlightStateCode() {
            switch (this.spotlightState) {
                case 'setup':
                    return 1;
                case 'active':
                    return 2;
                case 'teardown':
                    return 3;
                default:
                    return 0;
            }
        }
        setSpotlightRangePx(rangePx) {
            this.spotlightRangePx = rangePx;
        }
        canFireSpotlight() {
            return this.isSpotlightSetupComplete() && this.spotlightFireCooldownSec <= 0;
        }
        fireSpotlightAtTargets(targets, maxRangePx) {
            const bullets = [];
            const fireIntervalSec = 1 / Constants.SPOTLIGHT_FIRE_RATE_PER_SEC;
            this.spotlightFireCooldownSec = fireIntervalSec;
            for (const target of targets) {
                const dx = target.position.x - this.position.x;
                const dy = target.position.y - this.position.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq <= 0.0001) {
                    continue;
                }
                const invDistance = 1 / Math.sqrt(distanceSq);
                const velocity = new Vector2D(dx * invDistance * Constants.SPOTLIGHT_BULLET_SPEED, dy * invDistance * Constants.SPOTLIGHT_BULLET_SPEED);
                const bullet = new AbilityBullet(new Vector2D(this.position.x, this.position.y), velocity, this.owner, Constants.SPOTLIGHT_BULLET_DAMAGE);
                bullet.maxLifetime = Constants.SPOTLIGHT_BULLET_LIFETIME_SEC;
                bullet.maxRange = maxRangePx;
                bullet.isSpotlightBullet = true;
                bullet.renderWidthPx = Constants.SPOTLIGHT_BULLET_WIDTH_PX;
                bullet.renderLengthPx = Constants.SPOTLIGHT_BULLET_LENGTH_PX;
                bullet.hitRadiusPx = Constants.SPOTLIGHT_BULLET_HIT_RADIUS_PX;
                bullets.push(bullet);
            }
            return bullets;
        }
    }
    return { Spotlight };
};
exports.createSpotlightHero = createSpotlightHero;
