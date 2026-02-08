"use strict";
/**
 * Particle systems and effects for SoL game simulation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeathParticle = exports.SparkleParticle = exports.ImpactParticle = exports.LaserBeam = exports.MinionProjectile = exports.AbilityBullet = exports.BouncingBullet = exports.MuzzleFlash = exports.BulletCasing = exports.ForgeCrunch = exports.SpaceDustParticle = void 0;
const math_1 = require("../math");
const Constants = __importStar(require("../../constants"));
const seeded_random_1 = require("../../seeded-random");
class SpaceDustParticle {
    constructor(position, velocity, palette) {
        this.position = position;
        this.glowState = Constants.DUST_GLOW_STATE_NORMAL;
        this.glowTransition = 0; // 0-1 transition between states
        this.targetGlowState = Constants.DUST_GLOW_STATE_NORMAL;
        this.lastMovementTime = 0; // Time since last significant movement
        this.impactColor = null;
        this.impactBlend = 0;
        this.impactTargetBlend = 0;
        this.impactHoldTimeSec = 0;
        this.baseColor = SpaceDustParticle.generateBaseColor(palette);
        this.currentColor = this.baseColor;
        // Initialize with very slow random velocity
        if (velocity) {
            this.velocity = velocity;
        }
        else {
            const rng = (0, seeded_random_1.getGameRNG)();
            this.velocity = new math_1.Vector2D(rng.nextFloat(-1, 1), rng.nextFloat(-1, 1));
        }
    }
    /**
     * Update particle position based on velocity
     */
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        // Check if particle is moving significantly
        const speed = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
        if (speed > Constants.DUST_FAST_MOVEMENT_THRESHOLD) {
            // Fast movement - trigger full glow
            this.targetGlowState = Constants.DUST_GLOW_STATE_FULL;
            this.lastMovementTime = Date.now();
        }
        else if (speed > Constants.DUST_SLOW_MOVEMENT_THRESHOLD) {
            // Some movement - maintain current glow or go to slight glow
            if (this.glowState < Constants.DUST_GLOW_STATE_SLIGHT) {
                this.targetGlowState = Constants.DUST_GLOW_STATE_SLIGHT;
            }
            this.lastMovementTime = Date.now();
        }
        else {
            // Slow/no movement - fade back to normal based on time since last movement
            const timeSinceMovement = Date.now() - this.lastMovementTime;
            if (timeSinceMovement > Constants.DUST_FADE_TO_NORMAL_DELAY_MS) {
                // After 2 seconds of slow movement, start fading to normal
                this.targetGlowState = Constants.DUST_GLOW_STATE_NORMAL;
            }
            else if (timeSinceMovement > Constants.DUST_FADE_TO_SLIGHT_DELAY_MS && this.glowState === Constants.DUST_GLOW_STATE_FULL) {
                // After 1 second, fade from full glow to slight glow
                this.targetGlowState = Constants.DUST_GLOW_STATE_SLIGHT;
            }
        }
        // Smooth transition between glow states
        const transitionSpeed = this.glowState < this.targetGlowState ? Constants.DUST_GLOW_TRANSITION_SPEED_UP : Constants.DUST_GLOW_TRANSITION_SPEED_DOWN;
        if (this.glowState < this.targetGlowState) {
            this.glowTransition += deltaTime * transitionSpeed;
            if (this.glowTransition >= 1.0) {
                this.glowState = this.targetGlowState;
                this.glowTransition = 0;
            }
        }
        else if (this.glowState > this.targetGlowState) {
            this.glowTransition += deltaTime * transitionSpeed;
            if (this.glowTransition >= 1.0) {
                this.glowState = this.targetGlowState;
                this.glowTransition = 0;
            }
        }
        this.updateImpactBlend(deltaTime);
        // Apply friction to gradually slow down
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
        const driftSpeed = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
        if (driftSpeed < Constants.DUST_MIN_VELOCITY) {
            if (driftSpeed === 0) {
                this.velocity.x = Constants.DUST_MIN_VELOCITY;
                this.velocity.y = 0;
            }
            else {
                const driftScale = Constants.DUST_MIN_VELOCITY / driftSpeed;
                this.velocity.x *= driftScale;
                this.velocity.y *= driftScale;
            }
        }
    }
    /**
     * Apply force to particle (from units or attacks)
     */
    applyForce(force) {
        this.velocity.x += force.x;
        this.velocity.y += force.y;
    }
    /**
     * Apply a brief color impulse from a nearby unit or attack.
     */
    applyImpactColor(impactColor, intensity) {
        if (!impactColor || intensity <= 0) {
            return;
        }
        this.impactColor = impactColor;
        this.impactTargetBlend = Math.max(this.impactTargetBlend, Math.min(1, intensity));
        this.impactHoldTimeSec = Constants.DUST_COLOR_IMPACT_HOLD_SEC;
    }
    /**
     * Update color based on influence
     */
    updateColor(influenceColor, blendFactor) {
        let blendedColor = this.baseColor;
        if (influenceColor && blendFactor > 0) {
            // Blend from gray to influence color
            blendedColor = this.blendColors(this.baseColor, influenceColor, blendFactor);
        }
        if (this.impactColor && this.impactBlend > 0) {
            this.currentColor = this.blendColors(blendedColor, this.impactColor, this.impactBlend);
        }
        else {
            this.currentColor = blendedColor;
        }
    }
    /**
     * Blend two hex colors
     */
    blendColors(color1, color2, factor) {
        // Validate hex color format
        if (!color1 || !color2 || !color1.startsWith('#') || !color2.startsWith('#')) {
            return this.baseColor;
        }
        // Simple hex color blending
        const c1 = parseInt(color1.slice(1), 16);
        const c2 = parseInt(color2.slice(1), 16);
        if (isNaN(c1) || isNaN(c2)) {
            return this.baseColor;
        }
        const r1 = (c1 >> 16) & 0xff;
        const g1 = (c1 >> 8) & 0xff;
        const b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff;
        const g2 = (c2 >> 8) & 0xff;
        const b2 = c2 & 0xff;
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    updateImpactBlend(deltaTime) {
        if (this.impactHoldTimeSec > 0) {
            this.impactHoldTimeSec = Math.max(0, this.impactHoldTimeSec - deltaTime);
        }
        const targetBlend = this.impactHoldTimeSec > 0 ? this.impactTargetBlend : 0;
        const fadeSpeed = targetBlend > this.impactBlend
            ? Constants.DUST_COLOR_FADE_IN_SPEED
            : Constants.DUST_COLOR_FADE_OUT_SPEED;
        const blendDelta = fadeSpeed * deltaTime;
        if (this.impactBlend < targetBlend) {
            this.impactBlend = Math.min(targetBlend, this.impactBlend + blendDelta);
        }
        else if (this.impactBlend > targetBlend) {
            this.impactBlend = Math.max(targetBlend, this.impactBlend - blendDelta);
        }
        if (targetBlend === 0 && this.impactBlend === 0) {
            this.impactTargetBlend = 0;
            this.impactColor = null;
        }
    }
    static generateBaseColor(palette) {
        const rng = (0, seeded_random_1.getGameRNG)();
        if (palette && palette.neutral.length > 0) {
            const paletteRoll = rng.next();
            const useAccent = paletteRoll > 0.7 && palette.accent.length > 0;
            const selection = useAccent ? palette.accent : palette.neutral;
            const colorIndex = rng.nextInt(0, selection.length - 1);
            return selection[colorIndex];
        }
        const baseShade = rng.nextFloat(85, 195);
        let r = baseShade;
        let g = baseShade;
        let b = baseShade;
        const tintRoll = rng.next();
        if (tintRoll < 0.18) {
            r = baseShade - 8;
            g = baseShade - 4;
            b = baseShade + 14;
        }
        else if (tintRoll < 0.28) {
            r = baseShade + 10;
            g = baseShade - 10;
            b = baseShade + 12;
        }
        const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
        const red = clamp(r);
        const green = clamp(g);
        const blue = clamp(b);
        return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
    }
}
exports.SpaceDustParticle = SpaceDustParticle;
/**
 * Forge crunch effect - periodic event that sucks in dust then pushes it out
 * Used when the forge "crunches" to spawn minions
 */
class ForgeCrunch {
    constructor(position) {
        this.position = position;
        this.phase = 'idle';
        this.phaseTimer = 0;
    }
    /**
     * Start a new crunch cycle
     */
    start() {
        this.phase = 'suck';
        this.phaseTimer = Constants.FORGE_CRUNCH_SUCK_DURATION;
    }
    /**
     * Update crunch phase timers
     */
    update(deltaTime) {
        if (this.phase === 'idle')
            return;
        this.phaseTimer -= deltaTime;
        if (this.phaseTimer <= 0) {
            if (this.phase === 'suck') {
                // Transition from suck to wave
                this.phase = 'wave';
                this.phaseTimer = Constants.FORGE_CRUNCH_WAVE_DURATION;
            }
            else if (this.phase === 'wave') {
                // Crunch complete
                this.phase = 'idle';
                this.phaseTimer = 0;
            }
        }
    }
    /**
     * Check if crunch is active
     */
    isActive() {
        return this.phase !== 'idle';
    }
    /**
     * Get current phase progress (0-1)
     */
    getPhaseProgress() {
        if (this.phase === 'idle')
            return 0;
        const totalDuration = this.phase === 'suck'
            ? Constants.FORGE_CRUNCH_SUCK_DURATION
            : Constants.FORGE_CRUNCH_WAVE_DURATION;
        return 1.0 - (this.phaseTimer / totalDuration);
    }
}
exports.ForgeCrunch = ForgeCrunch;
/**
 * Bullet casing that ejects from weapons and interacts with space dust
 */
class BulletCasing {
    constructor(position, velocity) {
        this.position = position;
        this.rotation = 0;
        this.lifetime = 0;
        this.maxLifetime = Constants.BULLET_CASING_LIFETIME;
        this.velocity = velocity;
        const rng = (0, seeded_random_1.getGameRNG)();
        this.rotationSpeed = rng.nextFloat(-5, 5); // Random spin
    }
    /**
     * Update casing position and physics
     */
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
        // Apply friction
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        this.lifetime += deltaTime;
    }
    /**
     * Check if casing should be removed
     */
    shouldDespawn() {
        return this.lifetime >= this.maxLifetime;
    }
    /**
     * Apply collision response when hitting spacedust
     */
    applyCollision(force) {
        this.velocity.x += force.x * Constants.CASING_COLLISION_DAMPING;
        this.velocity.y += force.y * Constants.CASING_COLLISION_DAMPING;
    }
}
exports.BulletCasing = BulletCasing;
/**
 * Muzzle flash effect when firing
 */
class MuzzleFlash {
    constructor(position, angle) {
        this.position = position;
        this.angle = angle;
        this.lifetime = 0;
        this.maxLifetime = Constants.MUZZLE_FLASH_DURATION;
    }
    /**
     * Update flash lifetime
     */
    update(deltaTime) {
        this.lifetime += deltaTime;
    }
    /**
     * Check if flash should be removed
     */
    shouldDespawn() {
        return this.lifetime >= this.maxLifetime;
    }
}
exports.MuzzleFlash = MuzzleFlash;
/**
 * Bouncing bullet that appears when hitting an enemy
 */
class BouncingBullet {
    constructor(position, velocity) {
        this.position = position;
        this.lifetime = 0;
        this.maxLifetime = Constants.BOUNCING_BULLET_LIFETIME;
        this.velocity = velocity;
    }
    /**
     * Update bullet position
     */
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        // Apply gravity-like effect
        this.velocity.y += 100 * deltaTime;
        // Apply friction
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
        this.lifetime += deltaTime;
    }
    /**
     * Check if bullet should be removed
     */
    shouldDespawn() {
        return this.lifetime >= this.maxLifetime;
    }
}
exports.BouncingBullet = BouncingBullet;
/**
 * Ability bullet for special attacks
 */
class AbilityBullet {
    constructor(position, velocity, owner, damage = Constants.MARINE_ABILITY_BULLET_DAMAGE) {
        this.position = position;
        this.owner = owner;
        this.damage = damage;
        this.lifetime = 0;
        this.maxLifetime = Constants.MARINE_ABILITY_BULLET_LIFETIME;
        this.maxRange = Infinity; // Optional max range in pixels (default: no limit)
        this.hitRadiusPx = 10;
        this.velocity = velocity;
        this.startPosition = new math_1.Vector2D(position.x, position.y);
    }
    /**
     * Update bullet position
     */
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetime += deltaTime;
    }
    /**
     * Check if bullet should be removed
     */
    shouldDespawn() {
        // Check lifetime
        if (this.lifetime >= this.maxLifetime) {
            return true;
        }
        // Check max range
        const distanceTraveled = this.startPosition.distanceTo(this.position);
        if (distanceTraveled >= this.maxRange) {
            return true;
        }
        return false;
    }
    /**
     * Check if bullet hits a target
     */
    checkHit(target) {
        const distance = this.position.distanceTo(target.position);
        return distance < this.hitRadiusPx; // Hit radius
    }
}
exports.AbilityBullet = AbilityBullet;
/**
 * Minion projectile fired by Starlings
 */
class MinionProjectile {
    constructor(position, velocity, owner, damage, maxRangePx = Constants.STARLING_PROJECTILE_MAX_RANGE_PX) {
        this.position = position;
        this.owner = owner;
        this.damage = damage;
        this.distanceTraveledPx = 0;
        this.velocity = velocity;
        this.maxRangePx = maxRangePx;
    }
    update(deltaTime) {
        const moveX = this.velocity.x * deltaTime;
        const moveY = this.velocity.y * deltaTime;
        this.position.x += moveX;
        this.position.y += moveY;
        this.distanceTraveledPx += Math.sqrt(moveX * moveX + moveY * moveY);
    }
    shouldDespawn() {
        return this.distanceTraveledPx >= this.maxRangePx;
    }
    checkHit(target) {
        const distance = this.position.distanceTo(target.position);
        return distance < Constants.STARLING_PROJECTILE_HIT_RADIUS_PX;
    }
}
exports.MinionProjectile = MinionProjectile;
/**
 * Laser beam fired by Starlings (instant hit-scan weapon)
 */
class LaserBeam {
    constructor(startPos, endPos, owner, damage, widthPx = Constants.STARLING_LASER_WIDTH_PX) {
        this.startPos = startPos;
        this.endPos = endPos;
        this.owner = owner;
        this.damage = damage;
        this.widthPx = widthPx;
        this.lifetime = 0;
        this.maxLifetime = 0.1; // 100ms visible duration
    }
    update(deltaTime) {
        this.lifetime += deltaTime;
        return this.lifetime >= this.maxLifetime;
    }
}
exports.LaserBeam = LaserBeam;
/**
 * Impact particle spawned at laser beam endpoint
 */
class ImpactParticle {
    constructor(position, velocity, maxLifetime, faction) {
        this.position = position;
        this.velocity = velocity;
        this.maxLifetime = maxLifetime;
        this.faction = faction;
        this.lifetime = 0;
    }
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetime += deltaTime;
    }
    shouldDespawn() {
        return this.lifetime >= this.maxLifetime;
    }
}
exports.ImpactParticle = ImpactParticle;
/**
 * Sparkle particle for regenerating units/structures
 */
class SparkleParticle {
    constructor(position, velocity, maxLifetime, color, size = 2) {
        this.position = position;
        this.velocity = velocity;
        this.maxLifetime = maxLifetime;
        this.color = color;
        this.size = size;
        this.lifetime = 0;
    }
    update(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.lifetime += deltaTime;
        // Slow down velocity over time
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
    }
    getOpacity() {
        // Fade out over lifetime
        return Math.max(0, 1 - (this.lifetime / this.maxLifetime));
    }
    shouldDespawn() {
        return this.lifetime >= this.maxLifetime;
    }
}
exports.SparkleParticle = SparkleParticle;
/**
 * Death particle - represents a piece of a destroyed unit/structure
 * Flies apart from the death location and fades over time
 */
class DeathParticle {
    constructor(position, velocity, rotation, spriteFragment, fadeStartTime) {
        this.lifetime = 0;
        this.spriteFragment = null;
        this.opacity = 1.0;
        this.position = new math_1.Vector2D(position.x, position.y);
        this.velocity = velocity;
        this.rotation = rotation;
        const rng = (0, seeded_random_1.getGameRNG)();
        this.rotationSpeed = rng.nextFloat(-2, 2); // Random rotation speed
        this.spriteFragment = spriteFragment;
        this.fadeStartTime = fadeStartTime;
    }
    update(deltaTime) {
        this.lifetime += deltaTime;
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        // Update rotation
        this.rotation += this.rotationSpeed * deltaTime;
        // Apply velocity damping (particles slow down over time)
        this.velocity.x *= DeathParticle.VELOCITY_DAMPING;
        this.velocity.y *= DeathParticle.VELOCITY_DAMPING;
        // Calculate opacity based on lifetime
        if (this.lifetime < DeathParticle.INITIAL_FADE_DURATION) {
            // Initial fade to 30% over first 0.5 seconds
            this.opacity = 1.0 - (DeathParticle.OPACITY_DROP * (this.lifetime / DeathParticle.INITIAL_FADE_DURATION));
        }
        else if (this.lifetime < this.fadeStartTime) {
            // Stay at 30% opacity
            this.opacity = DeathParticle.STABLE_OPACITY;
        }
        else {
            // Fade from 30% to 0% over 1 second
            const fadeProgress = (this.lifetime - this.fadeStartTime) / DeathParticle.FINAL_FADE_DURATION;
            this.opacity = Math.max(0, DeathParticle.STABLE_OPACITY * (1 - fadeProgress));
        }
    }
    shouldDespawn() {
        return this.lifetime >= this.fadeStartTime + DeathParticle.FINAL_FADE_DURATION;
    }
}
exports.DeathParticle = DeathParticle;
DeathParticle.VELOCITY_DAMPING = 0.98; // Particles slow down to 98% of velocity each frame
DeathParticle.INITIAL_FADE_DURATION = 0.5; // Fade from 100% to 30% over 0.5 seconds
DeathParticle.OPACITY_DROP = 0.7; // Drop from 100% to 30% (70% reduction)
DeathParticle.STABLE_OPACITY = 0.3; // Hold at 30% opacity during stable phase
DeathParticle.FINAL_FADE_DURATION = 1.0; // Fade from 30% to 0% over 1 second
