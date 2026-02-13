const SUN_CORE_COLOR_STOPS: ReadonlyArray<readonly [number, string]> = [
    [0.0, '#FFF4CC'],
    [0.08, '#FFB21A'],
    [0.25, '#FF8A14'],
    [0.55, '#F25C0F'],
    [1.0, 'rgba(242, 92, 15, 0)']
];

const BLOOM_RADIUS_MULTIPLIERS: ReadonlyArray<number> = [1.0, 1.4, 2.0];
const BLOOM_ALPHA_MULTIPLIERS: ReadonlyArray<number> = [0.42, 0.24, 0.14];

const GHOST_T_VALUES: ReadonlyArray<number> = [0.2, 0.35, 0.5, 0.65, 0.8, 1.0];
const GHOST_RADII_MULTIPLIERS: ReadonlyArray<number> = [0.92, 0.8, 0.68, 0.56, 0.48, 0.4];
const GHOST_ALPHA_MULTIPLIERS: ReadonlyArray<number> = [0.26, 0.22, 0.18, 0.15, 0.12, 0.1];

const CHROMATIC_OFFSET_RED_PX = 2;
const CHROMATIC_OFFSET_BLUE_PX = -2;
const CHROMATIC_ALPHA = 0.09;
const HEX_ALPHA_VALUES: ReadonlyArray<number> = [0.06, 0.08, 0.1, 0.12];
const EDGE_INTENSITY_RADIUS_FACTOR = 0.85;
const EDGE_INTENSITY_POWER = 1.4;
const GHOST_COLOR_WARM = '255, 138, 20';

const HEX_PATH = createHexPath();

interface CachedSunGradientState {
    x: number;
    y: number;
    radius: number;
    gradientByLayer: CanvasGradient[];
}

const cachedSunGradientByContext = new WeakMap<CanvasRenderingContext2D, CachedSunGradientState>();

function createHexPath(): Path2D {
    const path = new Path2D();
    const sides = 6;
    for (let sideIndex = 0; sideIndex < sides; sideIndex++) {
        const angleRad = (Math.PI * 2 * sideIndex) / sides - Math.PI / 2;
        const x = Math.cos(angleRad);
        const y = Math.sin(angleRad);
        if (sideIndex === 0) {
            path.moveTo(x, y);
        } else {
            path.lineTo(x, y);
        }
    }
    path.closePath();
    return path;
}

function createSunGradient(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): CanvasGradient {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    for (let stopIndex = 0; stopIndex < SUN_CORE_COLOR_STOPS.length; stopIndex++) {
        const stop = SUN_CORE_COLOR_STOPS[stopIndex];
        gradient.addColorStop(stop[0], stop[1]);
    }
    return gradient;
}

function getSunGradients(
    ctx: CanvasRenderingContext2D,
    sunX: number,
    sunY: number,
    sunRadius: number
): CanvasGradient[] {
    const cachedSunGradientState = cachedSunGradientByContext.get(ctx);
    if (
        cachedSunGradientState &&
        cachedSunGradientState.x === sunX &&
        cachedSunGradientState.y === sunY &&
        cachedSunGradientState.radius === sunRadius
    ) {
        return cachedSunGradientState.gradientByLayer;
    }

    const gradientByLayer: CanvasGradient[] = [];
    for (let layerIndex = 0; layerIndex < BLOOM_RADIUS_MULTIPLIERS.length; layerIndex++) {
        const bloomRadius = sunRadius * BLOOM_RADIUS_MULTIPLIERS[layerIndex];
        gradientByLayer[layerIndex] = createSunGradient(ctx, sunX, sunY, bloomRadius);
    }

    cachedSunGradientByContext.set(ctx, {
        x: sunX,
        y: sunY,
        radius: sunRadius,
        gradientByLayer
    });

    return gradientByLayer;
}

function drawSunCore(
    ctx: CanvasRenderingContext2D,
    sunX: number,
    sunY: number,
    sunRadius: number,
    edgeIntensity: number
): void {
    const gradientByLayer = getSunGradients(ctx, sunX, sunY, sunRadius);
    for (let layerIndex = 0; layerIndex < BLOOM_RADIUS_MULTIPLIERS.length; layerIndex++) {
        const bloomRadius = sunRadius * BLOOM_RADIUS_MULTIPLIERS[layerIndex];
        ctx.globalAlpha = BLOOM_ALPHA_MULTIPLIERS[layerIndex] * edgeIntensity;
        ctx.fillStyle = gradientByLayer[layerIndex];
        ctx.beginPath();
        ctx.arc(sunX, sunY, bloomRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGhost(
    ctx: CanvasRenderingContext2D,
    ghostX: number,
    ghostY: number,
    ghostRadius: number,
    ghostAlpha: number
): void {
    const gradient = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, ghostRadius);
    gradient.addColorStop(0, `rgba(${GHOST_COLOR_WARM}, ${ghostAlpha})`);
    gradient.addColorStop(0.45, `rgba(${GHOST_COLOR_WARM}, ${ghostAlpha * 0.42})`);
    gradient.addColorStop(1, `rgba(${GHOST_COLOR_WARM}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ghostX, ghostY, ghostRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawChromaticGhost(
    ctx: CanvasRenderingContext2D,
    ghostX: number,
    ghostY: number,
    ghostRadius: number,
    ghostAlpha: number
): void {
    const finalAlpha = Math.min(ghostAlpha, CHROMATIC_ALPHA);
    drawChannelGhost(ctx, ghostX + CHROMATIC_OFFSET_RED_PX, ghostY, ghostRadius, `rgba(255, 82, 72, ${finalAlpha})`);
    drawChannelGhost(ctx, ghostX, ghostY, ghostRadius, `rgba(120, 255, 120, ${finalAlpha * 0.9})`);
    drawChannelGhost(ctx, ghostX + CHROMATIC_OFFSET_BLUE_PX, ghostY, ghostRadius, `rgba(74, 144, 255, ${finalAlpha})`);
}

function drawChannelGhost(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string
): void {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawHex(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    alpha: number
): void {
    ctx.save();
    ctx.translate(x, y);
    const rotationOffsetRad = ((x * 0.013 + y * 0.017) % (Math.PI * 2)) - Math.PI;
    ctx.rotate(rotationOffsetRad);
    ctx.scale(radius, radius);
    ctx.fillStyle = `rgba(${GHOST_COLOR_WARM}, ${alpha})`;
    ctx.fill(HEX_PATH);
    ctx.restore();
}

export function renderLensFlare(
    ctx: CanvasRenderingContext2D,
    sunX: number,
    sunY: number,
    sunRadius: number,
    canvasWidth: number,
    canvasHeight: number
): void {
    const centerX = canvasWidth * 0.5;
    const centerY = canvasHeight * 0.5;

    const dx = sunX - centerX;
    const dy = sunY - centerY;

    const maxDistance = Math.hypot(centerX, centerY);
    const sunDistance = Math.hypot(dx, dy);
    const distanceRatio = maxDistance > 0 ? Math.min(sunDistance / maxDistance, 1) : 0;
    const edgeIntensity = 1 + Math.pow(distanceRatio, EDGE_INTENSITY_POWER) * EDGE_INTENSITY_RADIUS_FACTOR;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Section 1: radial sun core + bloom stack.
    drawSunCore(ctx, sunX, sunY, sunRadius, edgeIntensity);

    // Section 2: lens ghost chain through inverse center vector.
    for (let ghostIndex = 0; ghostIndex < GHOST_T_VALUES.length; ghostIndex++) {
        const t = GHOST_T_VALUES[ghostIndex];
        const ghostX = centerX - dx * t;
        const ghostY = centerY - dy * t;
        const ghostRadius = sunRadius * GHOST_RADII_MULTIPLIERS[ghostIndex] * edgeIntensity;
        const ghostAlpha = GHOST_ALPHA_MULTIPLIERS[ghostIndex] * edgeIntensity;

        drawGhost(ctx, ghostX, ghostY, ghostRadius, ghostAlpha);

        // Section 3: optional chromatic aberration for near-center ghosts.
        if (ghostIndex < 2) {
            drawChromaticGhost(ctx, ghostX, ghostY, ghostRadius * 0.9, ghostAlpha);
        }

        // Section 4: faint hex aperture overlays for trailing ghosts.
        if (ghostIndex >= 2) {
            const hexIndex = ghostIndex - 2;
            drawHex(
                ctx,
                ghostX,
                ghostY,
                ghostRadius * 0.92,
                HEX_ALPHA_VALUES[hexIndex] * edgeIntensity
            );
        }
    }

    ctx.restore();
}
