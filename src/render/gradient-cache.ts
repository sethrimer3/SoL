/**
 * GradientCache
 * Caches radial and linear CanvasGradient instances to avoid per-frame re-creation.
 *
 * NOTE: Gradients are bound to the canvas coordinate system at creation time.
 * Only use this for gradients that don't depend on screen positions (e.g., textures at origin).
 * Include viewport/zoom state in the key if gradients depend on dynamic positions.
 *
 * Extracted from renderer.ts as part of Phase 10 refactoring.
 */

export class GradientCache {
    private readonly cache = new Map<string, CanvasGradient>();

    /** Direct cache lookup – for call-sites that manage gradient creation themselves. */
    get(key: string): CanvasGradient | undefined {
        return this.cache.get(key);
    }

    /** Direct cache store – for call-sites that manage gradient creation themselves. */
    set(key: string, gradient: CanvasGradient): this {
        this.cache.set(key, gradient);
        return this;
    }

    /**
     * Get or create a cached radial gradient.
     */
    getCachedRadialGradient(
        ctx: CanvasRenderingContext2D,
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        const cached = this.cache.get(key);
        if (cached) {
            return cached;
        }

        const gradient = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        this.cache.set(key, gradient);
        return gradient;
    }

    /**
     * Get or create a cached linear gradient.
     */
    getCachedLinearGradient(
        ctx: CanvasRenderingContext2D,
        key: string,
        x0: number, y0: number,
        x1: number, y1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        const cached = this.cache.get(key);
        if (cached) {
            return cached;
        }

        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        this.cache.set(key, gradient);
        return gradient;
    }
}
