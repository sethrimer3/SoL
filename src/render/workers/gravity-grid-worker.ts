/**
 * Gravity Grid Worker
 *
 * Off-main-thread rendering of the gravity-well distortion grid.
 * The worker receives a serialised snapshot of the game entities that
 * produce gravity sources, renders the grid to an OffscreenCanvas
 * (with overscan so the main thread can shift the bitmap during panning
 * without revealing uncovered edges), and transfers the resulting
 * ImageBitmap back to the main thread.
 *
 * The algorithm mirrors GravityGridRenderer exactly; keeping it inline
 * avoids importing live-game-object types into the worker scope.
 */

// ─── Shared types (also exported for the bridge) ─────────────────────────────

export type GGQuality = 'low' | 'medium' | 'high' | 'ultra';

export type GGSerializableSun      = { x: number; y: number; radius: number };
export type GGSerializableAsteroid = { x: number; y: number; size: number };
export type GGSerializablePhoton   = { x: number; y: number };
export type GGSerializableWarpGate = { x: number; y: number };
export type GGSerializableUnit     = { x: number; y: number; isHero: boolean };
export type GGSerializableEntity   = { x: number; y: number; radius: number };

export type GGSerializablePlayer = {
    /** Pre-parsed player colour RGB (0–255 each). */
    colorR: number;
    colorG: number;
    colorB: number;
    isDefeated: boolean;
    forge: GGSerializableEntity | null;
    buildings: GGSerializableEntity[];
    mirrors: GGSerializableEntity[];
    units: GGSerializableUnit[];
};

export type GravityGridWorkerRenderMessage = {
    type: 'render';
    suns: GGSerializableSun[];
    asteroids: GGSerializableAsteroid[];
    photons: GGSerializablePhoton[];
    warpGates: GGSerializableWarpGate[];
    players: GGSerializablePlayer[];
    cameraX: number;
    cameraY: number;
    zoomLevel: number;
    /** Overscan-inflated canvas width (worker renders to this size). */
    canvasWidthPx: number;
    /** Overscan-inflated canvas height (worker renders to this size). */
    canvasHeightPx: number;
    graphicsQuality: GGQuality;
};

export type GravityGridWorkerResizeMessage = {
    type: 'resize';
    canvasWidthPx: number;
    canvasHeightPx: number;
};

type GravityGridWorkerMessage = GravityGridWorkerRenderMessage | GravityGridWorkerResizeMessage;

type GravityGridWorkerFrameMessage = {
    type: 'frame';
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    zoomLevel: number;
    canvasWidthPx: number;
    canvasHeightPx: number;
};

interface GravityGridWorkerScope {
    addEventListener(type: 'message', listener: (event: MessageEvent<GravityGridWorkerMessage>) => void): void;
    postMessage(message: GravityGridWorkerFrameMessage, transfer: Transferable[]): void;
}

// ─── Constants (mirrors gravity-grid-renderer.ts) ────────────────────────────

const GRID_SPACING_WORLD_PX  = 14;
const GRID_SPACING_HIGH_PX   = 18;
const GRID_SPACING_MEDIUM_PX = 28;

const MAX_EXTRA_OPACITY      = 0.25;
const MAX_DISPLACEMENT_CAP_PX = 20;
const REF_DISP_PX            = 12.0;

// NOTE: These constants are mirrors of the values in gravity-grid-renderer.ts.
// If gravity mechanics change, update both files to keep them in sync.
const MIRROR_GRAVITY_RADIUS_PX  = 20;   // SOLAR_MIRROR_COLLISION_RADIUS
const HERO_GRAVITY_RADIUS_PX    = 22;
const STARLING_GRAVITY_RADIUS_PX = 10;  // UNIT_RADIUS_PX

const PHOTON_GRAVITY_INFLUENCE_PX    = 60;
const PHOTON_GRAVITY_DISPLACEMENT_PX = 8;

const WARP_GATE_GRAVITY_INFLUENCE_PX    = 400;
const WARP_GATE_GRAVITY_DISPLACEMENT_PX = 60;

const SOURCE_INFLUENCE_MULTIPLIER   = 4;
const SOURCE_DISPLACEMENT_MULTIPLIER = 0.25;

const ENV_GOLD_R = 184;
const ENV_GOLD_G = 134;
const ENV_GOLD_B = 11;

const LINE_WIDTH_SCALE = 0.8;
const ALPHA_LEVELS = 32;

const BASE_R = 255;
const BASE_G = 220;
const BASE_B = 180;

// ─── Pre-built colour LUT ─────────────────────────────────────────────────────

function buildColorLut(): string[] {
    const lut: string[] = new Array(ALPHA_LEVELS);
    for (let i = 0; i < ALPHA_LEVELS; i++) {
        const t = i / (ALPHA_LEVELS - 1);
        const alpha = t * MAX_EXTRA_OPACITY;
        lut[i] = `rgba(${BASE_R},${BASE_G},${BASE_B},${alpha.toFixed(3)})`;
    }
    return lut;
}

const COLOR_LUT = buildColorLut();

// ─── Internal gravity-source type ────────────────────────────────────────────

interface GravitySource {
    worldX: number;
    worldY: number;
    influenceRadiusWorld: number;
    influenceRadiusSq: number;
    invInfluenceRadius: number;
    maxDisplacementWorld: number;
    blendR: number;
    blendG: number;
    blendB: number;
}

// ─── Worker-local renderer ────────────────────────────────────────────────────

/** Reusable arrays / scratch — allocated once, reused every frame. */
const allSources:  GravitySource[] = [];
const viewSources: GravitySource[] = [];
const lineVerticesX: number[] = [];
const lineVerticesY: number[] = [];
const lineAlphaIdx:  number[] = [];
const dispResult = { dispWorldX: 0, dispWorldY: 0, stretch: 0 };

function pushSource(
    worldX: number, worldY: number,
    radiusPx: number,
    r: number, g: number, b: number
): void {
    const influenceRadiusWorld = radiusPx * SOURCE_INFLUENCE_MULTIPLIER;
    const maxDisplacementWorld = radiusPx * SOURCE_DISPLACEMENT_MULTIPLIER;
    allSources.push({
        worldX, worldY,
        influenceRadiusWorld,
        influenceRadiusSq: influenceRadiusWorld * influenceRadiusWorld,
        invInfluenceRadius: 1 / influenceRadiusWorld,
        maxDisplacementWorld,
        blendR: r, blendG: g, blendB: b,
    });
}

function pushSourceCustom(
    worldX: number, worldY: number,
    influenceRadiusWorld: number, maxDisplacementWorld: number,
    r: number, g: number, b: number
): void {
    allSources.push({
        worldX, worldY,
        influenceRadiusWorld,
        influenceRadiusSq: influenceRadiusWorld * influenceRadiusWorld,
        invInfluenceRadius: 1 / influenceRadiusWorld,
        maxDisplacementWorld,
        blendR: r, blendG: g, blendB: b,
    });
}

function collectSources(msg: GravityGridWorkerRenderMessage): void {
    allSources.length = 0;

    for (let i = 0; i < msg.suns.length; i++) {
        const s = msg.suns[i];
        pushSource(s.x, s.y, s.radius, ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B);
    }
    for (let i = 0; i < msg.asteroids.length; i++) {
        const a = msg.asteroids[i];
        pushSource(a.x, a.y, a.size, ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B);
    }
    for (let i = 0; i < msg.photons.length; i++) {
        const p = msg.photons[i];
        pushSourceCustom(
            p.x, p.y,
            PHOTON_GRAVITY_INFLUENCE_PX, PHOTON_GRAVITY_DISPLACEMENT_PX,
            ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B
        );
    }
    for (let i = 0; i < msg.warpGates.length; i++) {
        const g = msg.warpGates[i];
        pushSourceCustom(
            g.x, g.y,
            WARP_GATE_GRAVITY_INFLUENCE_PX, WARP_GATE_GRAVITY_DISPLACEMENT_PX,
            ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B
        );
    }
    for (let p = 0; p < msg.players.length; p++) {
        const player = msg.players[p];
        if (player.isDefeated) continue;
        const cr = player.colorR;
        const cg = player.colorG;
        const cb = player.colorB;

        if (player.forge) {
            const f = player.forge;
            pushSource(f.x, f.y, f.radius, cr, cg, cb);
        }
        for (let i = 0; i < player.buildings.length; i++) {
            const b = player.buildings[i];
            pushSource(b.x, b.y, b.radius, cr, cg, cb);
        }
        for (let i = 0; i < player.mirrors.length; i++) {
            const m = player.mirrors[i];
            pushSource(m.x, m.y, MIRROR_GRAVITY_RADIUS_PX, cr, cg, cb);
        }
        for (let i = 0; i < player.units.length; i++) {
            const u = player.units[i];
            const r = u.isHero ? HERO_GRAVITY_RADIUS_PX : STARLING_GRAVITY_RADIUS_PX;
            pushSource(u.x, u.y, r, cr, cg, cb);
        }
    }
}

function filterSourcesToViewport(
    minX: number, maxX: number, minY: number, maxY: number
): void {
    viewSources.length = 0;
    for (let i = 0, len = allSources.length; i < len; i++) {
        const src = allSources[i];
        const r = src.influenceRadiusWorld;
        if (src.worldX + r < minX || src.worldX - r > maxX) continue;
        if (src.worldY + r < minY || src.worldY - r > maxY) continue;
        viewSources.push(src);
    }
}

function displace(worldX: number, worldY: number): void {
    let dx = 0;
    let dy = 0;
    for (let i = 0, len = viewSources.length; i < len; i++) {
        const src = viewSources[i];
        const ddx = src.worldX - worldX;
        const ddy = src.worldY - worldY;
        const distSq = ddx * ddx + ddy * ddy;
        if (distSq >= src.influenceRadiusSq) continue;
        const dist = Math.sqrt(distSq);
        const t = 1.0 - dist * src.invInfluenceRadius;
        const falloff = t * t * t;
        const strength = (falloff * src.maxDisplacementWorld) / (dist + 0.1);
        dx += ddx * strength;
        dy += ddy * strength;
    }
    const dispMagSq = dx * dx + dy * dy;
    if (dispMagSq > MAX_DISPLACEMENT_CAP_PX * MAX_DISPLACEMENT_CAP_PX) {
        const scale = MAX_DISPLACEMENT_CAP_PX / Math.sqrt(dispMagSq);
        dx *= scale;
        dy *= scale;
    }
    const dispMag = Math.sqrt(dx * dx + dy * dy);
    dispResult.stretch     = Math.min(1.0, dispMag / REF_DISP_PX);
    dispResult.dispWorldX  = worldX + dx;
    dispResult.dispWorldY  = worldY + dy;
}

function drawLines(
    ctx: OffscreenCanvasRenderingContext2D,
    cameraX: number, cameraY: number,
    zoom: number,
    canvasWidth: number, canvasHeight: number,
    startGridX: number, endGridX: number,
    startGridY: number, endGridY: number,
    isVertical: boolean,
    spacing: number
): void {
    const viewportCenterX = canvasWidth  * 0.5;
    const viewportCenterY = canvasHeight * 0.5;

    const outerStart = isVertical ? startGridX : startGridY;
    const outerEnd   = isVertical ? endGridX   : endGridY;
    const innerStart = isVertical ? startGridY : startGridX;
    const innerEnd   = isVertical ? endGridY   : endGridX;

    for (let outer = outerStart; outer <= outerEnd; outer += spacing) {
        // Per-line early skip: check if any source could influence this line.
        let hasNearby = false;
        for (let s = 0; s < viewSources.length; s++) {
            const src = viewSources[s];
            const perpDist = isVertical
                ? Math.abs(src.worldX - outer)
                : Math.abs(src.worldY - outer);
            if (perpDist < src.influenceRadiusWorld) {
                hasNearby = true;
                break;
            }
        }
        if (!hasNearby) continue;

        lineVerticesX.length = 0;
        lineVerticesY.length = 0;
        lineAlphaIdx.length  = 0;

        for (let inner = innerStart; inner <= innerEnd; inner += spacing) {
            const worldX = isVertical ? outer : inner;
            const worldY = isVertical ? inner : outer;

            displace(worldX, worldY);
            const stretch = dispResult.stretch;

            if (stretch < 0.001) {
                lineVerticesX.push(NaN);
                lineVerticesY.push(NaN);
                lineAlphaIdx.push(-1);
                continue;
            }

            const tSmooth = stretch * stretch * (3 - 2 * stretch);
            const alphaIdx = Math.min(ALPHA_LEVELS - 1, (tSmooth * (ALPHA_LEVELS - 1) + 0.5) | 0);

            // World → screen
            const screenX = viewportCenterX + (dispResult.dispWorldX - cameraX) * zoom;
            const screenY = viewportCenterY + (dispResult.dispWorldY - cameraY) * zoom;

            lineVerticesX.push(screenX);
            lineVerticesY.push(screenY);
            lineAlphaIdx.push(alphaIdx);
        }

        const count = lineVerticesX.length;
        if (count < 2) continue;

        let inBatch   = false;
        let batchAlpha = -1;

        for (let i = 0; i < count; i++) {
            const curX = lineVerticesX[i];
            const curA = lineAlphaIdx[i];

            if (curA < 0) {
                if (inBatch) { ctx.stroke(); inBatch = false; }
                continue;
            }
            if (!inBatch) {
                batchAlpha = curA;
                ctx.strokeStyle = COLOR_LUT[curA];
                ctx.beginPath();
                ctx.moveTo(curX, lineVerticesY[i]);
                inBatch = true;
            } else if (curA !== batchAlpha) {
                ctx.stroke();
                batchAlpha = curA;
                ctx.strokeStyle = COLOR_LUT[curA];
                ctx.beginPath();
                ctx.moveTo(lineVerticesX[i - 1], lineVerticesY[i - 1]);
                ctx.lineTo(curX, lineVerticesY[i]);
            } else {
                ctx.lineTo(curX, lineVerticesY[i]);
            }
        }
        if (inBatch) ctx.stroke();
    }
}

function renderFrame(
    ctx: OffscreenCanvasRenderingContext2D,
    msg: GravityGridWorkerRenderMessage
): void {
    const { cameraX, cameraY, zoomLevel, canvasWidthPx, canvasHeightPx, graphicsQuality } = msg;

    ctx.clearRect(0, 0, canvasWidthPx, canvasHeightPx);

    if (graphicsQuality === 'low') return;

    collectSources(msg);
    if (allSources.length === 0) return;

    const spacing = graphicsQuality === 'medium' ? GRID_SPACING_MEDIUM_PX
                  : graphicsQuality === 'high'   ? GRID_SPACING_HIGH_PX
                  : GRID_SPACING_WORLD_PX;

    const halfW = canvasWidthPx  / (2 * zoomLevel);
    const halfH = canvasHeightPx / (2 * zoomLevel);

    const margin    = spacing * 1.5;
    const worldMinX = cameraX - halfW - margin;
    const worldMaxX = cameraX + halfW + margin;
    const worldMinY = cameraY - halfH - margin;
    const worldMaxY = cameraY + halfH + margin;

    filterSourcesToViewport(worldMinX, worldMaxX, worldMinY, worldMaxY);
    if (viewSources.length === 0) return;

    const startGridX = Math.floor(worldMinX / spacing) * spacing;
    const endGridX   = Math.ceil(worldMaxX  / spacing) * spacing;
    const startGridY = Math.floor(worldMinY / spacing) * spacing;
    const endGridY   = Math.ceil(worldMaxY  / spacing) * spacing;

    ctx.save();
    ctx.lineWidth = Math.max(1.0, zoomLevel * LINE_WIDTH_SCALE);
    ctx.lineCap   = 'butt';

    drawLines(ctx, cameraX, cameraY, zoomLevel, canvasWidthPx, canvasHeightPx,
              startGridX, endGridX, startGridY, endGridY, true,  spacing);
    drawLines(ctx, cameraX, cameraY, zoomLevel, canvasWidthPx, canvasHeightPx,
              startGridX, endGridX, startGridY, endGridY, false, spacing);

    ctx.restore();
}

// ─── Worker entry point ───────────────────────────────────────────────────────

const workerScope = self as unknown as GravityGridWorkerScope;

let outputCanvas = new OffscreenCanvas(1, 1);
let outputCtx: OffscreenCanvasRenderingContext2D | null = outputCanvas.getContext('2d');

function ensureOutputContext(
    widthPx: number, heightPx: number
): OffscreenCanvasRenderingContext2D | null {
    if (outputCanvas.width !== widthPx || outputCanvas.height !== heightPx) {
        outputCanvas = new OffscreenCanvas(widthPx, heightPx);
        outputCtx    = outputCanvas.getContext('2d');
    }
    return outputCtx;
}

workerScope.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'resize') {
        ensureOutputContext(message.canvasWidthPx, message.canvasHeightPx);
        return;
    }

    const ctx = ensureOutputContext(message.canvasWidthPx, message.canvasHeightPx);
    if (!ctx) return;

    renderFrame(ctx, message);

    const bitmap = outputCanvas.transferToImageBitmap();
    workerScope.postMessage(
        {
            type: 'frame',
            bitmap,
            cameraX:      message.cameraX,
            cameraY:      message.cameraY,
            zoomLevel:    message.zoomLevel,
            canvasWidthPx:  message.canvasWidthPx,
            canvasHeightPx: message.canvasHeightPx,
        },
        [bitmap]
    );
});
