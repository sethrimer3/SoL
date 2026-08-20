/**
 * soft-light - Reusable "volumetric light fakery" helpers.
 *
 * Instead of drawing a beam or glow as a single hard-edged shape, these helpers build
 * the shape out of many nested, low-alpha layers (each wider/more transparent than the
 * last) so the composited result reads as a soft, blurred field of light without paying
 * for a real per-pixel blur on every draw call.
 *
 * Two pieces are exported:
 *  - `LightBuffer`: a persistent, reused offscreen canvas that all soft-light draws for
 *    a frame can be rendered into (optionally at a reduced resolution for perf), then
 *    composited back onto the main canvas exactly once with a real `filter: blur(...)`
 *    and an additive/screen blend mode. Allocated once; only resized when the main
 *    canvas resizes.
 *  - `drawSoftBeam` / `drawSoftGlow`: stateless nested-layer draw functions that can be
 *    called against a LightBuffer's context OR directly against a normal canvas context
 *    (useful for effects that only draw a handful of beams per frame, where standing up
 *    a whole separate light buffer isn't worth the bookkeeping).
 *
 * Follows the dual HTMLCanvasElement/OffscreenCanvas context pattern used by
 * SunRenderer (see `SunCanvasType`/`Sun2DContextType` in sun-renderer.ts) so this module
 * works identically on the main thread and inside a render worker.
 */

// Canvas/context types shared across main-thread and worker rendering.
export type SoftLightCanvasType = HTMLCanvasElement | OffscreenCanvas;
export type SoftLight2DContextType = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Tunable defaults - all technique parameters live here so callers (and future
// effects) can override individual knobs without duplicating magic numbers.
// ---------------------------------------------------------------------------

/** Number of nested layers drawn per beam/glow. Spec range: 8-16. */
export const DEFAULT_LAYERS = 12;
/** Alpha of the innermost (or single reference) layer before falloff shaping. Spec range: 0.005-0.07. */
export const DEFAULT_BASE_ALPHA = 0.045;
/** How much wider the outermost layer is than the core, as a multiple of the nominal width/radius. */
export const DEFAULT_WIDTH_SCALE_MAX = 3.2;
/** Exponent shaping the per-layer alpha falloff: alpha_t = baseAlpha * (1 - t)^falloffPower. Spec range: 2-3. */
export const DEFAULT_FALLOFF_POWER = 2.4;
/** Blur radius (px) applied once when compositing the light buffer onto the main canvas. */
export const DEFAULT_BLUR_PX = 8;
/** Resolution scale for the light buffer relative to the main canvas (1 = full res, 0.5 = half, etc). */
export const DEFAULT_RESOLUTION_SCALE = 0.5;
/** Composite alpha applied to the whole light buffer when drawn onto the main canvas. */
export const DEFAULT_COMPOSITE_ALPHA = 1;
/** Default blend mode used when compositing the light buffer back onto the main canvas. */
export const DEFAULT_COMPOSITE_BLEND: GlobalCompositeOperation = 'screen';
/** Default blend mode used while drawing nested layers into a light buffer/context. */
export const DEFAULT_LAYER_BLEND: GlobalCompositeOperation = 'lighter';
/** Angular frequency (rad/sec) of the default slow sway/pulse animation. */
export const DEFAULT_SWAY_SPEED = 0.6;
/** Amplitude of the default sway, as a fraction of beam width / glow radius. */
export const DEFAULT_SWAY_AMPLITUDE = 0.08;

// ---------------------------------------------------------------------------
// LightBuffer - persistent offscreen canvas for accumulating soft-light draws.
// ---------------------------------------------------------------------------

export interface LightBufferCompositeOptions {
    /** Blur radius in px (CSS filter units, applied at main-canvas scale). */
    blur?: number;
    /** Overall alpha multiplier for the composite. */
    alpha?: number;
    /** globalCompositeOperation used for the composite draw. */
    blend?: GlobalCompositeOperation;
}

/**
 * Owns a single reusable offscreen canvas that soft-light effects render into over the
 * course of a frame. The canvas is allocated once and only resized (never reallocated
 * from scratch) when the tracked main-canvas dimensions change, so steady-state frames
 * do zero canvas allocation.
 */
export class LightBuffer {
    private canvas: SoftLightCanvasType | null = null;
    private ctx: SoftLight2DContextType | null = null;
    private trackedMainWidth = 0;
    private trackedMainHeight = 0;

    constructor(
        private readonly resolutionScale: number = DEFAULT_RESOLUTION_SCALE,
        private readonly canvasFactory: (widthPx: number, heightPx: number) => SoftLightCanvasType =
            (w, h) => {
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                return c;
            }
    ) {}

    /**
     * Ensure the buffer matches the current main canvas size (scaled by resolutionScale),
     * clear it, and set its transform so callers can draw using main-canvas coordinates
     * directly (the buffer's internal downscale is handled transparently via `scale`).
     * Returns the buffer's 2D context, ready to draw into.
     */
    public beginFrame(mainCanvasWidthPx: number, mainCanvasHeightPx: number): SoftLight2DContextType {
        const bufferWidth = Math.max(1, Math.round(mainCanvasWidthPx * this.resolutionScale));
        const bufferHeight = Math.max(1, Math.round(mainCanvasHeightPx * this.resolutionScale));

        if (!this.canvas) {
            this.canvas = this.canvasFactory(bufferWidth, bufferHeight);
            this.ctx = this.canvas.getContext('2d') as SoftLight2DContextType | null;
        }
        if (!this.ctx || !this.canvas) {
            throw new Error('Failed to initialize LightBuffer context');
        }
        if (
            this.trackedMainWidth !== mainCanvasWidthPx
            || this.trackedMainHeight !== mainCanvasHeightPx
            || this.canvas.width !== bufferWidth
            || this.canvas.height !== bufferHeight
        ) {
            this.canvas.width = bufferWidth;
            this.canvas.height = bufferHeight;
            this.trackedMainWidth = mainCanvasWidthPx;
            this.trackedMainHeight = mainCanvasHeightPx;
        }

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, bufferWidth, bufferHeight);
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        // Scale so draw calls can use main-canvas coordinates even though the backing
        // store is smaller when resolutionScale < 1.
        this.ctx.scale(this.resolutionScale, this.resolutionScale);
        return this.ctx;
    }

    /** The buffer's current context (only valid after `beginFrame`). */
    public getContext(): SoftLight2DContextType {
        if (!this.ctx) {
            throw new Error('LightBuffer.getContext called before beginFrame');
        }
        return this.ctx;
    }

    /** Composite the accumulated light buffer onto the main canvas exactly once. */
    public composite(mainCtx: SoftLight2DContextType, options: LightBufferCompositeOptions = {}): void {
        if (!this.canvas) {
            return;
        }
        const blurPx = options.blur ?? DEFAULT_BLUR_PX;
        const alpha = options.alpha ?? DEFAULT_COMPOSITE_ALPHA;
        const blend = options.blend ?? DEFAULT_COMPOSITE_BLEND;

        mainCtx.save();
        mainCtx.globalCompositeOperation = blend;
        mainCtx.globalAlpha = alpha;
        mainCtx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
        mainCtx.drawImage(
            this.canvas,
            0, 0, this.canvas.width, this.canvas.height,
            0, 0, this.trackedMainWidth, this.trackedMainHeight
        );
        mainCtx.filter = 'none';
        mainCtx.restore();
    }
}

// ---------------------------------------------------------------------------
// Nested-layer draw helpers.
// ---------------------------------------------------------------------------

/** RGB triplet used for soft-light color falloff (alpha carries per-layer via colorStops). */
export type SoftLightColorStop = { readonly offset: number; readonly color: string };

export interface SoftBeamOptions {
    /** Beam origin, in the same coordinate space as the context's current transform. */
    x: number;
    y: number;
    /** Beam direction, radians. */
    angle: number;
    /** Beam length. */
    length: number;
    /** Nominal (core) beam width; outer layers grow up to widthScaleMax * width. */
    width: number;
    /** Base color for the beam, e.g. 'rgba(255,180,90,1)' or '#ffb45a'. Alpha channel is ignored/overridden per layer. */
    color: string;
    /** Optional secondary color the gradient fades toward at the far end; defaults to a transparent version of `color`. */
    endColor?: string;
    layers?: number;
    baseAlpha?: number;
    widthScaleMax?: number;
    falloffPower?: number;
    blend?: GlobalCompositeOperation;
    /** Seconds elapsed, for animated sway. Omit (or pair with sway=0) for a static beam. */
    time?: number;
    /** Stable per-instance seed so multiple beams don't sway in lockstep. */
    seed?: number;
    /** Sway amplitude as a fraction of width (0 disables animation). */
    sway?: number;
    /** Sway angular speed, rad/sec. */
    swaySpeed?: number;
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const full = hex.length === 3
            ? hex.split('').map(c => c + c).join('')
            : hex;
        const intVal = parseInt(full, 16);
        return {
            r: (intVal >> 16) & 255,
            g: (intVal >> 8) & 255,
            b: intVal & 255,
        };
    }
    const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (match) {
        return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
    }
    // Fallback: warm white, so an unparsable color still renders something visible.
    return { r: 255, g: 255, b: 255 };
}

function rgba(r: number, g: number, b: number, a: number): string {
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

/**
 * Draw a soft-edged beam as N nested, low-alpha, gradient-filled quads of increasing
 * width and decreasing alpha (alpha_t = baseAlpha * (1 - t)^falloffPower). Intended to
 * be called into a LightBuffer's context (for later blur+screen compositing) or
 * directly into a normal context (in which case the caller may still want to wrap the
 * call in its own single `ctx.filter = 'blur(...)'` pass for extra softness).
 */
export function drawSoftBeam(ctx: SoftLight2DContextType, options: SoftBeamOptions): void {
    const {
        x, y, angle, length, width, color,
        endColor,
        layers = DEFAULT_LAYERS,
        baseAlpha = DEFAULT_BASE_ALPHA,
        widthScaleMax = DEFAULT_WIDTH_SCALE_MAX,
        falloffPower = DEFAULT_FALLOFF_POWER,
        blend = DEFAULT_LAYER_BLEND,
        time = 0,
        seed = 0,
        sway = 0,
        swaySpeed = DEFAULT_SWAY_SPEED,
    } = options;

    if (length <= 0 || width <= 0 || layers <= 0) {
        return;
    }

    const { r, g, b } = parseColorToRgb(color);
    const endRgb = endColor ? parseColorToRgb(endColor) : null;

    const swayOffset = sway > 0
        ? Math.sin(time * swaySpeed + seed * 6.2831) * sway * width
        : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = blend;

    // Along-beam gradient reused by every layer: bright/opaque at the source, fading to
    // (optionally recolored) transparency at the far end.
    const spineGradient = ctx.createLinearGradient(0, 0, length, 0);
    spineGradient.addColorStop(0, rgba(r, g, b, 1));
    spineGradient.addColorStop(0.6, rgba(r, g, b, 0.7));
    if (endRgb) {
        spineGradient.addColorStop(1, rgba(endRgb.r, endRgb.g, endRgb.b, 0));
    } else {
        spineGradient.addColorStop(1, rgba(r, g, b, 0));
    }

    for (let layerIndex = 0; layerIndex < layers; layerIndex++) {
        const t = layerIndex / Math.max(1, layers - 1);
        const layerAlpha = baseAlpha * Math.pow(1 - t, falloffPower);
        if (layerAlpha <= 0.0002) {
            continue;
        }
        const layerWidth = width * (1 + (widthScaleMax - 1) * t);
        const halfWidth = layerWidth * 0.5;

        ctx.globalAlpha = layerAlpha;
        ctx.fillStyle = spineGradient;
        ctx.beginPath();
        ctx.moveTo(0, -halfWidth + swayOffset);
        ctx.lineTo(length, -halfWidth * 0.35 + swayOffset);
        ctx.lineTo(length, halfWidth * 0.35 + swayOffset);
        ctx.lineTo(0, halfWidth + swayOffset);
        ctx.closePath();
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}

export interface SoftGlowOptions {
    x: number;
    y: number;
    /** Outer radius of the glow. */
    radius: number;
    color: string;
    layers?: number;
    baseAlpha?: number;
    falloffPower?: number;
    blend?: GlobalCompositeOperation;
    time?: number;
    seed?: number;
    /** Pulse amplitude as a fraction of radius (0 disables animation). */
    pulse?: number;
    pulseSpeed?: number;
}

/**
 * Draw a soft radial glow as N nested, low-alpha filled circles shrinking from `radius`
 * down to the core, each layer's alpha following the same (1-t)^falloffPower curve used
 * by drawSoftBeam.
 */
export function drawSoftGlow(ctx: SoftLight2DContextType, options: SoftGlowOptions): void {
    const {
        x, y, radius, color,
        layers = DEFAULT_LAYERS,
        baseAlpha = DEFAULT_BASE_ALPHA,
        falloffPower = DEFAULT_FALLOFF_POWER,
        blend = DEFAULT_LAYER_BLEND,
        time = 0,
        seed = 0,
        pulse = 0,
        pulseSpeed = DEFAULT_SWAY_SPEED,
    } = options;

    if (radius <= 0 || layers <= 0) {
        return;
    }

    const { r, g, b } = parseColorToRgb(color);
    const pulseScale = pulse > 0
        ? 1 + Math.sin(time * pulseSpeed + seed * 6.2831) * pulse
        : 1;
    const effectiveRadius = radius * pulseScale;

    ctx.save();
    ctx.globalCompositeOperation = blend;

    for (let layerIndex = 0; layerIndex < layers; layerIndex++) {
        const t = layerIndex / Math.max(1, layers - 1);
        const layerAlpha = baseAlpha * Math.pow(1 - t, falloffPower);
        if (layerAlpha <= 0.0002) {
            continue;
        }
        // Outermost layer (t=0) is largest/faintest; innermost (t=1) is smallest/brightest,
        // matching the beam's "wider = more transparent" falloff.
        const layerRadius = effectiveRadius * (1 - t * 0.82);

        ctx.globalAlpha = layerAlpha;
        ctx.fillStyle = rgba(r, g, b, 1);
        ctx.beginPath();
        ctx.arc(x, y, layerRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}
