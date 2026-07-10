/**
 * ScreenShakeController
 * Manages screen shake effects (explosions, splash damage).
 * 
 * Extracted from renderer.ts as part of Phase 10 refactoring.
 */

import * as Constants from '../constants';

export class ScreenShakeController {
    public isEnabled: boolean = true;
    private intensity: number = 0;
    private timer: number = 0;
    private readonly shakenExplosions: WeakSet<object> = new WeakSet();

    /** Current shake intensity (0 when not shaking). */
    getIntensity(): number {
        return this.intensity;
    }

    /** Check if an explosion has already triggered shake. */
    hasShaken(explosion: object): boolean {
        return this.shakenExplosions.has(explosion);
    }

    /** Mark an explosion as having triggered shake. */
    markShaken(explosion: object): void {
        this.shakenExplosions.add(explosion);
    }

    /** Get the underlying WeakSet for passing to external render contexts. */
    getShakenExplosions(): WeakSet<object> {
        return this.shakenExplosions;
    }

    /**
     * Trigger screen shake effect.
     */
    trigger(intensity: number = Constants.SCREEN_SHAKE_INTENSITY): void {
        if (!this.isEnabled) return;
        this.intensity = Math.max(this.intensity, intensity);
        this.timer = Constants.SCREEN_SHAKE_DURATION;
    }

    /**
     * Update screen shake effect (call once per frame).
     */
    update(deltaTime: number): void {
        if (this.timer > 0) {
            this.timer -= deltaTime;
            this.intensity *= Constants.SCREEN_SHAKE_DECAY;
            if (this.timer <= 0 || this.intensity < 0.1) {
                this.intensity = 0;
                this.timer = 0;
            }
        }
    }
}
