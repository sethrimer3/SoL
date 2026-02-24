/**
 * VisibilityAlphaTracker
 * Manages per-entity smooth alpha transitions for enemy visibility fading
 * and shade glow effects, extracted from GameRenderer.
 *
 * Extracted from renderer.ts as part of Phase 9 refactoring
 */

export class VisibilityAlphaTracker {
    private readonly entityAlpha = new WeakMap<object, number>();
    private readonly shadeGlowAlpha = new WeakMap<object, number>();
    private lastUpdateSec = Number.NaN;
    private frameDeltaSec = 0;

    private readonly VISIBILITY_FADE_SPEED_PER_SEC = 20;
    private readonly SHADE_GLOW_FADE_IN_SPEED_PER_SEC = 4.2;
    private readonly SHADE_GLOW_FADE_OUT_SPEED_PER_SEC = 6.5;

    /**
     * Must be called once per frame before reading alpha values.
     */
    updateFrameDelta(gameTimeSec: number): void {
        if (Number.isNaN(this.lastUpdateSec)) {
            this.frameDeltaSec = 0;
            this.lastUpdateSec = gameTimeSec;
            return;
        }

        this.frameDeltaSec = Math.max(0, gameTimeSec - this.lastUpdateSec);
        this.lastUpdateSec = gameTimeSec;
    }

    /**
     * Get the smoothly-interpolated alpha for an entity based on its current visibility.
     * Returns a value between 0 (fully hidden) and 1 (fully visible).
     */
    getEntityVisibilityAlpha(entity: object, isVisible: boolean): number {
        const currentAlpha = this.entityAlpha.get(entity) ?? (isVisible ? 1 : 0);
        const dtSec = this.frameDeltaSec;
        const maxStep = this.VISIBILITY_FADE_SPEED_PER_SEC * dtSec;
        const targetAlpha = isVisible ? 1 : 0;
        const alphaDelta = targetAlpha - currentAlpha;
        const nextAlpha = Math.abs(alphaDelta) <= maxStep
            ? targetAlpha
            : currentAlpha + Math.sign(alphaDelta) * maxStep;
        this.entityAlpha.set(entity, nextAlpha);
        return nextAlpha;
    }

    /**
     * Get the smoothly-interpolated shade glow alpha for an entity.
     * Returns a value between 0 (no glow) and 1 (full glow).
     */
    getEntityShadeGlowAlpha(entity: object, shouldGlowInShade: boolean): number {
        const currentAlpha = this.shadeGlowAlpha.get(entity) ?? 0;
        const dtSec = this.frameDeltaSec;
        const fadeSpeedPerSec = shouldGlowInShade
            ? this.SHADE_GLOW_FADE_IN_SPEED_PER_SEC
            : this.SHADE_GLOW_FADE_OUT_SPEED_PER_SEC;
        const maxStep = fadeSpeedPerSec * dtSec;
        const targetAlpha = shouldGlowInShade ? 1 : 0;
        const alphaDelta = targetAlpha - currentAlpha;
        const nextAlpha = Math.abs(alphaDelta) <= maxStep
            ? targetAlpha
            : currentAlpha + Math.sign(alphaDelta) * maxStep;
        this.shadeGlowAlpha.set(entity, nextAlpha);
        return nextAlpha;
    }
}
