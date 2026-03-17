/**
 * Star Nest Renderer
 *
 * Implements a "Star Nest" flying-through-space effect inspired by the
 * XScreenSaver Star Nest screensaver (Shadertoy: https://www.shadertoy.com/view/XlfGRj).
 *
 * Creates the illusion of flying forward through a volumetric star field by
 * projecting stars from 3D space (x, y, z) onto the 2D screen using simple
 * perspective division. Stars approach the camera over time and are reset to
 * a far depth when they pass behind the viewer.
 *
 * This renderer is purely cosmetic and uses wall-clock time (performance.now)
 * which is acceptable for render-only code.
 */

interface StarNestStar {
    /** World-space X offset from centre, range roughly [-0.45, 0.45] */
    x: number;
    /** World-space Y offset from centre, range roughly [-0.45, 0.45] */
    y: number;
    /** Depth: 1 = far away, MIN_DEPTH = at the camera */
    z: number;
    /** 0–1 brightness multiplier */
    brightness: number;
    /** 0 = blue, 1 = purple, 2 = bright white cluster */
    colorIndex: number;
}

interface NebulaSpot {
    /** Horizontal position as fraction of canvas width */
    xFrac: number;
    /** Vertical position as fraction of canvas height */
    yFrac: number;
    /** Radius as fraction of min(width, height) */
    rFrac: number;
    /** Red channel (0–255) */
    r: number;
    /** Green channel (0–255) */
    g: number;
    /** Blue channel (0–255) */
    b: number;
    /** Peak opacity of the nebula gradient */
    alpha: number;
}

export class StarNestRenderer {
    private static readonly STAR_COUNT = 700;
    private static readonly MAX_DEPTH = 1.0;
    private static readonly MIN_DEPTH = 0.002;
    /** Depth units consumed per second (controls fly-through speed) */
    private static readonly SPEED_PER_SEC = 0.06;
    /** Fraction of min(width,height) used as the perspective focal length */
    private static readonly FOCAL_LENGTH_FACTOR = 0.52;
    /** Side length in pixels of each pre-rendered star sprite canvas */
    private static readonly SPRITE_SIZE_PX = 32;

    private stars: StarNestStar[];
    private lastUpdateMs: number = -1;

    // Offscreen nebula cache – redrawn only when dimensions change
    private nebulaCache: HTMLCanvasElement | null = null;
    private nebulaCacheWidthPx: number = 0;
    private nebulaCacheHeightPx: number = 0;

    // Pre-rendered star sprites indexed by colorIndex (0-2)
    private readonly starSprites: HTMLCanvasElement[];

    constructor() {
        this.stars = [];
        this.starSprites = [
            this.createStarSprite([60, 120, 255]),
            this.createStarSprite([180, 80, 255]),
            this.createStarSprite([220, 235, 255]),
        ];
        this.initializeStars();
    }

    // ---------------------------------------------------------------------------
    // Initialisation
    // ---------------------------------------------------------------------------

    private initializeStars(): void {
        this.stars = [];
        for (let i = 0; i < StarNestRenderer.STAR_COUNT; i++) {
            this.stars.push(this.createStar(true));
        }
    }

    private createStar(isInitial: boolean): StarNestStar {
        const z = isInitial
            ? StarNestRenderer.MIN_DEPTH + Math.random() * (StarNestRenderer.MAX_DEPTH - StarNestRenderer.MIN_DEPTH)
            : StarNestRenderer.MAX_DEPTH * (0.9 + Math.random() * 0.1);

        // Clustered distribution inspired by the kaliset fractal in Star Nest:
        // ~65 % of stars are near the centre (dense core), ~35 % spread wider.
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() < 0.65
            ? Math.random() * Math.random() * 0.38
            : 0.08 + Math.random() * 0.38;

        // Color distribution: mostly blue, some purple, a few bright white
        const rand = Math.random();
        const colorIndex = rand < 0.55 ? 0 : rand < 0.80 ? 1 : 2;

        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            z,
            brightness: 0.55 + Math.random() * 0.45,
            colorIndex,
        };
    }

    /**
     * Creates a small pre-rendered glow sprite for a given RGB colour.
     * The sprite has a bright core and a soft radial halo – drawing it via
     * drawImage is much cheaper than creating per-star gradients each frame.
     */
    private createStarSprite(rgb: [number, number, number]): HTMLCanvasElement {
        const size = StarNestRenderer.SPRITE_SIZE_PX;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const cx = size * 0.5;
        const cy = size * 0.5;
        const [r, g, b] = rgb;

        // Outer halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
        halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
        halo.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.12)`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, size, size);

        // Bright core
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.28);
        core.addColorStop(0, `rgba(255,255,255,1)`);
        core.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.9)`);
        core.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, cx * 0.28, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Advance the star field simulation by one frame.
     * Call this once per animation frame before `draw()`.
     *
     * @param nowMs  Current wall-clock time in milliseconds (e.g. performance.now())
     */
    public update(nowMs: number): void {
        if (this.lastUpdateMs < 0) {
            this.lastUpdateMs = nowMs;
            return;
        }
        const dtMs = nowMs - this.lastUpdateMs;
        this.lastUpdateMs = nowMs;

        const step = StarNestRenderer.SPEED_PER_SEC * (dtMs * 0.001);
        for (let i = 0; i < this.stars.length; i++) {
            this.stars[i].z -= step;
            if (this.stars[i].z <= StarNestRenderer.MIN_DEPTH) {
                this.stars[i] = this.createStar(false);
            }
        }
    }

    /**
     * Render the Star Nest effect into `ctx`.
     * Draws a black deep-space background, subtle nebula glows, and the
     * perspective-projected flying star field.
     *
     * @param ctx          Target 2D rendering context
     * @param widthPx      Canvas logical width in pixels
     * @param heightPx     Canvas logical height in pixels
     * @param globalAlpha  Overall opacity (0–1); used for fade-in transitions
     */
    public draw(
        ctx: CanvasRenderingContext2D,
        widthPx: number,
        heightPx: number,
        globalAlpha: number = 1
    ): void {
        ctx.save();
        ctx.globalAlpha = globalAlpha;

        // Deep space background
        ctx.fillStyle = '#020010';
        ctx.fillRect(0, 0, widthPx, heightPx);

        // Nebula background – drawn from a cached offscreen canvas
        this.drawNebula(ctx, widthPx, heightPx);

        // Flying stars
        const centerX = widthPx * 0.5;
        const centerY = heightPx * 0.5;
        const focalPx = Math.min(widthPx, heightPx) * StarNestRenderer.FOCAL_LENGTH_FACTOR;

        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            const projX = (star.x / star.z) * focalPx + centerX;
            const projY = (star.y / star.z) * focalPx + centerY;

            // Cull stars that are off-screen
            if (projX < -8 || projX > widthPx + 8 || projY < -8 || projY > heightPx + 8) {
                continue;
            }

            // Depth factor: 0 when far, approaches 1 when very close
            const depthFactor = 1.0 - star.z;
            const starAlpha = Math.min(1, depthFactor * depthFactor * 2.2 * star.brightness) * globalAlpha;
            if (starAlpha < 0.018) {
                continue;
            }

            // Size grows non-linearly as the star approaches
            const sizePx = Math.max(0.4, depthFactor * depthFactor * 4.5 * star.brightness);

            const sprite = this.starSprites[star.colorIndex];
            const halfSprite = sizePx * (StarNestRenderer.SPRITE_SIZE_PX / 2);
            ctx.globalAlpha = starAlpha;
            ctx.drawImage(sprite, projX - halfSprite, projY - halfSprite, halfSprite * 2, halfSprite * 2);
        }

        ctx.restore();
    }

    // ---------------------------------------------------------------------------
    // Nebula
    // ---------------------------------------------------------------------------

    private drawNebula(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number): void {
        if (
            this.nebulaCache === null ||
            this.nebulaCacheWidthPx !== widthPx ||
            this.nebulaCacheHeightPx !== heightPx
        ) {
            this.nebulaCache = this.renderNebulaToOffscreen(widthPx, heightPx);
            this.nebulaCacheWidthPx = widthPx;
            this.nebulaCacheHeightPx = heightPx;
        }
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 1;
        ctx.drawImage(this.nebulaCache, 0, 0, widthPx, heightPx);
        ctx.globalCompositeOperation = 'source-over';
    }

    private renderNebulaToOffscreen(widthPx: number, heightPx: number): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, widthPx);
        canvas.height = Math.max(1, heightPx);
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        // Three nebula "nests" – positions and colours inspired by Star Nest palette
        const nebulaSpots: NebulaSpot[] = [
            { xFrac: 0.50, yFrac: 0.50, rFrac: 0.55, r: 15,  g: 10,  b: 90,  alpha: 0.22 },
            { xFrac: 0.28, yFrac: 0.68, rFrac: 0.35, r: 50,  g: 5,   b: 80,  alpha: 0.14 },
            { xFrac: 0.72, yFrac: 0.32, rFrac: 0.40, r: 8,   g: 25,  b: 110, alpha: 0.16 },
            { xFrac: 0.60, yFrac: 0.75, rFrac: 0.30, r: 80,  g: 10,  b: 60,  alpha: 0.10 },
        ];

        for (const neb of nebulaSpots) {
            const cx = neb.xFrac * widthPx;
            const cy = neb.yFrac * heightPx;
            const radius = neb.rFrac * Math.min(widthPx, heightPx);
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0,   `rgba(${neb.r}, ${neb.g}, ${neb.b}, ${neb.alpha})`);
            grad.addColorStop(0.5, `rgba(${neb.r}, ${neb.g}, ${neb.b}, ${neb.alpha * 0.35})`);
            grad.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        return canvas;
    }
}
