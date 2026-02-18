"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBeamHero = void 0;
const createBeamHero = (deps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;
    /**
     * Beam hero unit (Radiant faction) - sniper with distance-based damage
     * Fires a thin beam that does more damage the further away the target is
     */
    class Beam extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.BEAM_MAX_HEALTH, Constants.BEAM_ATTACK_RANGE, Constants.BEAM_ATTACK_DAMAGE, Constants.BEAM_ATTACK_SPEED, Constants.BEAM_ABILITY_COOLDOWN);
            this.lastBeamDamage = 0; // For displaying multiplier
            this.lastBeamDistance = 0; // For calculating multiplier
            this.lastBeamMultiplier = 0; // For display above unit
            this.lastBeamTime = 0; // When the last beam was fired
            this.isHero = true; // Beam is a hero unit for Radiant faction
        }
        /**
         * Use Beam's ability: long-range sniper beam with distance-based damage
         * Deals more damage the further away the target is
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Calculate beam direction
            const beamDir = direction.normalize();
            // Create a thin beam projectile that travels in a straight line
            const speed = 1000; // Very fast beam speed
            const velocity = new Vector2D(beamDir.x * speed, beamDir.y * speed);
            // Create ability bullet for the beam
            const bullet = new AbilityBullet(new Vector2D(this.position.x, this.position.y), velocity, this.owner, Constants.BEAM_ABILITY_BASE_DAMAGE // Base damage, will be modified on hit
            );
            // Set long range for the sniper beam
            bullet.maxRange = Constants.BEAM_ABILITY_MAX_RANGE;
            // Mark this as a beam projectile for special damage calculation
            bullet.isBeamProjectile = true;
            bullet.beamOwner = this;
            this.lastAbilityEffects.push(bullet);
            return true;
        }
    }
    return { Beam };
};
exports.createBeamHero = createBeamHero;
