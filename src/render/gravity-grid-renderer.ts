/**
 * GravityGridRenderer - Renders a faint grid with gravity-well distortion effects.
 *
 * A faint grid is drawn over the playing field.  Each game entity (structures,
 * heroes, solar mirrors, starlings, the sun, asteroids, photons, and warp gates)
 * pulls the nearby grid lines toward it, creating a gravity-well visual.  The
 * deeper the stretch at any grid vertex, the more the colour at that point shifts
 * from the base colour toward the source's assigned colour:
 *   - Player-owned entities  → that player's colour
 *   - Suns / asteroids        → deep gold (#B8860B)
 *
 * Opacity is 0% when there is no gravity influence and rises to 25% at extreme
 * distortion.  Displacement is capped to produce a gentle "stretch into the
 * background" rather than violent warping.
 *
 * Optimised for performance:
 *   - Pre-parsed RGB on sources (no hex parsing in hot loop)
 *   - Mutable scratch result for displacement (no per-vertex allocation)
 *   - Quantised alpha → pre-built colour LUT (minimal string creation)
 *   - Per-line early-skip when no source is in range
 *   - Viewport-filtered sources
 *   - No per-vertex sunlight ray tests
 */

import { GameState, Player, Vector2D } from '../game-core';
import * as Constants from '../constants';
import { getCanvasScreenWidthPx, getCanvasScreenHeightPx } from './canvas-metrics';

// ─── Public context interface ─────────────────────────────────────────────────

export interface GravityGridContext {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    /** World-space camera centre. */
    camera: Vector2D;
    zoom: number;
    /** Convert a world position to canvas screen coordinates. */
    worldToScreen(worldPos: Vector2D): Vector2D;
    /** Player colour for the local (viewing) player. */
    playerColor: string;
    /** Enemy player colour. */
    enemyColor: string;
    /** Player currently being viewed (null in spectator mode). */
    viewingPlayer: Player | null;
    /** Graphics quality setting – used to scale grid density. */
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface GravitySource {
    worldX: number;
    worldY: number;
    /** Radius (world units) within which this source influences the grid. */
    influenceRadiusWorld: number;
    /** Squared influence radius (pre-computed). */
    influenceRadiusSq: number;
    /** 1 / influenceRadiusWorld (pre-computed). */
    invInfluenceRadius: number;
    /** Maximum displacement (world units) at the source centre. */
    maxDisplacementWorld: number;
    /** Pre-parsed blend colour RGB components (0-255). */
    blendR: number;
    blendG: number;
    blendB: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base grid spacing in world pixels (twice as fine as original 27 px). */
const GRID_SPACING_WORLD_PX = 14;

/** Grid spacing used for high quality (slightly coarser than ultra). */
const GRID_SPACING_HIGH_PX = 18;

/** Grid spacing used for medium quality (coarser to save performance). */
const GRID_SPACING_MEDIUM_PX = 28;

/** Maximum opacity at full stretch. */
const MAX_EXTRA_OPACITY = 0.25;

/** Hard cap on total displacement magnitude (world px) to prevent violent warping. */
const MAX_DISPLACEMENT_CAP_PX = 20;

/** Reference displacement for normalising stretch to 0-1.
 *  Chosen so that typical displacements (sun ~25px capped to 20, photon 8px)
 *  map to a visually pleasing 0.6–1.0 stretch range. */
const REF_DISP_PX = 12.0;

/** Radius of the solar mirror for gravity-well purposes (world pixels). */
const MIRROR_GRAVITY_RADIUS_PX = Constants.SOLAR_MIRROR_COLLISION_RADIUS;

/** Base hero radius for gravity-well purposes (world pixels). */
const HERO_GRAVITY_RADIUS_PX = 22;

/** Starling radius for gravity-well purposes (world pixels). */
const STARLING_GRAVITY_RADIUS_PX = Constants.UNIT_RADIUS_PX;

/** Gravity influence radius for photons (world px). */
const PHOTON_GRAVITY_INFLUENCE_PX = 60;

/** Maximum grid displacement caused by a photon (world px). */
const PHOTON_GRAVITY_DISPLACEMENT_PX = 8;

/** Gravity influence radius for warp gates (world px). */
const WARP_GATE_GRAVITY_INFLUENCE_PX = 400;

/** Maximum grid displacement caused by a warp gate (world px). */
const WARP_GATE_GRAVITY_DISPLACEMENT_PX = 60;

/** Influence multiplier for generic sources (influence = radius × this). */
const SOURCE_INFLUENCE_MULTIPLIER = 4;

/** Max displacement multiplier for generic sources (displacement = radius × this). */
const SOURCE_DISPLACEMENT_MULTIPLIER = 0.25;

/** Deep gold colour RGB for suns / environment objects. */
const ENV_GOLD_R = 184;
const ENV_GOLD_G = 134;
const ENV_GOLD_B = 11;

/** Line width scale factor (thinner than 1.0 to keep fine grid subtle). */
const LINE_WIDTH_SCALE = 0.8;

/** Number of quantised alpha levels for colour LUT. */
const ALPHA_LEVELS = 32;

/** Base colour for the grid (warm pale gold). */
const BASE_R = 255;
const BASE_G = 220;
const BASE_B = 180;

// ─── Pre-built colour LUT ─────────────────────────────────────────────────────

/**
 * Build a look-up table of rgba strings for each quantised alpha level.
 * This avoids per-vertex string construction entirely.
 */
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

// ─── Renderer class ───────────────────────────────────────────────────────────

export class GravityGridRenderer {
    // Reusable scratch vector to avoid per-frame allocations.
    private readonly _scratchVec: Vector2D = new Vector2D(0, 0);

    // Reusable sources array – populated each frame, then filtered.
    private readonly _sources: GravitySource[] = [];

    // Viewport-filtered sources for the current frame.
    private readonly _viewSources: GravitySource[] = [];

    // Mutable scratch result for _displace (avoids per-vertex allocation).
    private readonly _dispResult = { dispWorldX: 0, dispWorldY: 0, stretch: 0 };

    // Reusable per-line vertex arrays.
    private readonly _lineVerticesX: number[] = [];
    private readonly _lineVerticesY: number[] = [];
    private readonly _lineAlphaIdx: number[] = [];

    // ── Public draw entry point ───────────────────────────────────────────────

    public drawGravityGrid(
        game: GameState,
        playerColorMap: Map<Player, string>,
        context: GravityGridContext
    ): void {
        const { ctx, canvas, zoom, graphicsQuality } = context;

        // Skip on low quality to preserve performance.
        if (graphicsQuality === 'low') {
            return;
        }

        const screenWidth = getCanvasScreenWidthPx(canvas);
        const screenHeight = getCanvasScreenHeightPx(canvas);

        // ── Collect gravity sources ───────────────────────────────────────────
        this._collectSources(game, playerColorMap);

        if (this._sources.length === 0) {
            return;
        }

        // ── Compute world-space viewport bounds ───────────────────────────────
        const spacing = graphicsQuality === 'medium' ? GRID_SPACING_MEDIUM_PX
            : graphicsQuality === 'high' ? GRID_SPACING_HIGH_PX
            : GRID_SPACING_WORLD_PX;

        const halfW = screenWidth / (2 * zoom);
        const halfH = screenHeight / (2 * zoom);
        const camX = context.camera.x;
        const camY = context.camera.y;

        const margin = spacing * 1.5;
        const worldMinX = camX - halfW - margin;
        const worldMaxX = camX + halfW + margin;
        const worldMinY = camY - halfH - margin;
        const worldMaxY = camY + halfH + margin;

        // ── Filter sources to those overlapping viewport ──────────────────────
        this._filterSourcesToViewport(worldMinX, worldMaxX, worldMinY, worldMaxY);

        if (this._viewSources.length === 0) {
            return;
        }

        const startGridX = Math.floor(worldMinX / spacing) * spacing;
        const endGridX = Math.ceil(worldMaxX / spacing) * spacing;
        const startGridY = Math.floor(worldMinY / spacing) * spacing;
        const endGridY = Math.ceil(worldMaxY / spacing) * spacing;

        // ── Draw displaced grid ───────────────────────────────────────────────
        ctx.save();
        ctx.lineWidth = Math.max(1.0, zoom * LINE_WIDTH_SCALE);
        ctx.lineCap = 'butt';

        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, true, spacing);
        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, false, spacing);

        ctx.restore();
    }

    // ─── Source collection ────────────────────────────────────────────────────

    private _collectSources(game: GameState, playerColorMap: Map<Player, string>): void {
        const sources = this._sources;
        sources.length = 0;

        // Suns
        for (let i = 0, len = game.suns.length; i < len; i++) {
            const sun = game.suns[i];
            this._pushSource(sun.position.x, sun.position.y, sun.radius, ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B);
        }

        // Asteroids
        for (let i = 0, len = game.asteroids.length; i < len; i++) {
            const asteroid = game.asteroids[i];
            this._pushSource(asteroid.position.x, asteroid.position.y, asteroid.size, ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B);
        }

        // Photons – subtle gravity
        for (let i = 0, len = game.photons.length; i < len; i++) {
            const photon = game.photons[i];
            this._pushSourceCustom(
                photon.position.x, photon.position.y,
                PHOTON_GRAVITY_INFLUENCE_PX, PHOTON_GRAVITY_DISPLACEMENT_PX,
                ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B
            );
        }

        // Warp gates (only when active)
        for (let i = 0, len = game.warpGates.length; i < len; i++) {
            const gate = game.warpGates[i];
            if (!gate.hasDissipated) {
                this._pushSourceCustom(
                    gate.position.x, gate.position.y,
                    WARP_GATE_GRAVITY_INFLUENCE_PX, WARP_GATE_GRAVITY_DISPLACEMENT_PX,
                    ENV_GOLD_R, ENV_GOLD_G, ENV_GOLD_B
                );
            }
        }

        // Per-player entities
        for (let p = 0, pLen = game.players.length; p < pLen; p++) {
            const player = game.players[p];
            if (player.isDefeated()) continue;

            const colorHex = playerColorMap.get(player) ?? '#FFFFFF';
            const rgb = this._hexToRgb(colorHex);
            const cr = rgb.r;
            const cg = rgb.g;
            const cb = rgb.b;

            // Stellar Forge
            if (player.stellarForge) {
                const forge = player.stellarForge;
                this._pushSource(forge.position.x, forge.position.y, forge.radius, cr, cg, cb);
            }

            // Buildings
            for (let i = 0, len = player.buildings.length; i < len; i++) {
                const building = player.buildings[i];
                this._pushSource(building.position.x, building.position.y, building.radius, cr, cg, cb);
            }

            // Solar Mirrors
            for (let i = 0, len = player.solarMirrors.length; i < len; i++) {
                const mirror = player.solarMirrors[i];
                this._pushSource(mirror.position.x, mirror.position.y, MIRROR_GRAVITY_RADIUS_PX, cr, cg, cb);
            }

            // Units (heroes and starlings)
            for (let i = 0, len = player.units.length; i < len; i++) {
                const unit = player.units[i];
                const r = unit.isHero ? HERO_GRAVITY_RADIUS_PX : STARLING_GRAVITY_RADIUS_PX;
                this._pushSource(unit.position.x, unit.position.y, r, cr, cg, cb);
            }
        }
    }

    private _pushSource(worldX: number, worldY: number, radiusPx: number, r: number, g: number, b: number): void {
        const influenceRadiusWorld = radiusPx * SOURCE_INFLUENCE_MULTIPLIER;
        const maxDisplacementWorld = radiusPx * SOURCE_DISPLACEMENT_MULTIPLIER;
        this._sources.push({
            worldX, worldY,
            influenceRadiusWorld,
            influenceRadiusSq: influenceRadiusWorld * influenceRadiusWorld,
            invInfluenceRadius: 1 / influenceRadiusWorld,
            maxDisplacementWorld,
            blendR: r, blendG: g, blendB: b,
        });
    }

    private _pushSourceCustom(
        worldX: number, worldY: number,
        influenceRadiusWorld: number, maxDisplacementWorld: number,
        r: number, g: number, b: number
    ): void {
        this._sources.push({
            worldX, worldY,
            influenceRadiusWorld,
            influenceRadiusSq: influenceRadiusWorld * influenceRadiusWorld,
            invInfluenceRadius: 1 / influenceRadiusWorld,
            maxDisplacementWorld,
            blendR: r, blendG: g, blendB: b,
        });
    }

    // ─── Viewport filtering ───────────────────────────────────────────────────

    private _filterSourcesToViewport(
        minX: number, maxX: number, minY: number, maxY: number
    ): void {
        const out = this._viewSources;
        out.length = 0;
        for (let i = 0, len = this._sources.length; i < len; i++) {
            const src = this._sources[i];
            const r = src.influenceRadiusWorld;
            if (src.worldX + r < minX || src.worldX - r > maxX) continue;
            if (src.worldY + r < minY || src.worldY - r > maxY) continue;
            out.push(src);
        }
    }

    // ─── Grid drawing ─────────────────────────────────────────────────────────

    /**
     * Draw vertical (isVertical=true) or horizontal (isVertical=false) grid lines
     * with gravity-well displacement.  Uses quantised alpha and batched paths.
     */
    private _drawLines(
        context: GravityGridContext,
        startGridX: number,
        endGridX: number,
        startGridY: number,
        endGridY: number,
        isVertical: boolean,
        spacing: number
    ): void {
        const { ctx } = context;
        const sources = this._viewSources;
        const srcLen = sources.length;

        const outerStart = isVertical ? startGridX : startGridY;
        const outerEnd = isVertical ? endGridX : endGridY;
        const innerStart = isVertical ? startGridY : startGridX;
        const innerEnd = isVertical ? endGridY : endGridX;

        for (let outer = outerStart; outer <= outerEnd; outer += spacing) {
            // Per-line early skip: check if any source could influence this line.
            let hasNearby = false;
            for (let s = 0; s < srcLen; s++) {
                const src = sources[s];
                const perpDist = isVertical
                    ? Math.abs(src.worldX - outer)
                    : Math.abs(src.worldY - outer);
                if (perpDist < src.influenceRadiusWorld) {
                    hasNearby = true;
                    break;
                }
            }
            if (!hasNearby) continue;

            // Collect displaced vertices along this line.
            const vx = this._lineVerticesX;
            const vy = this._lineVerticesY;
            const va = this._lineAlphaIdx;
            vx.length = 0;
            vy.length = 0;
            va.length = 0;

            for (let inner = innerStart; inner <= innerEnd; inner += spacing) {
                const worldX = isVertical ? outer : inner;
                const worldY = isVertical ? inner : outer;

                this._displace(worldX, worldY);
                const stretch = this._dispResult.stretch;

                if (stretch < 0.001) {
                    vx.push(NaN);
                    vy.push(NaN);
                    va.push(-1);
                    continue;
                }

                // Smoothstep interpolation for a smoother alpha transition.
                const t = stretch * stretch * (3 - 2 * stretch);
                const alphaIdx = Math.min(ALPHA_LEVELS - 1, (t * (ALPHA_LEVELS - 1) + 0.5) | 0);

                // Convert displaced world position to screen.
                this._scratchVec.x = this._dispResult.dispWorldX;
                this._scratchVec.y = this._dispResult.dispWorldY;
                const screen = context.worldToScreen(this._scratchVec);

                vx.push(screen.x);
                vy.push(screen.y);
                va.push(alphaIdx);
            }

            // Draw segments batched by quantised alpha level.
            const count = vx.length;
            if (count < 2) continue;

            let inBatch = false;
            let batchAlpha = -1;

            for (let i = 0; i < count; i++) {
                const curX = vx[i];
                const curA = va[i];

                if (curA < 0) {
                    if (inBatch) {
                        ctx.stroke();
                        inBatch = false;
                    }
                    continue;
                }

                if (!inBatch) {
                    batchAlpha = curA;
                    ctx.strokeStyle = COLOR_LUT[curA];
                    ctx.beginPath();
                    ctx.moveTo(curX, vy[i]);
                    inBatch = true;
                } else if (curA !== batchAlpha) {
                    ctx.stroke();
                    batchAlpha = curA;
                    ctx.strokeStyle = COLOR_LUT[curA];
                    ctx.beginPath();
                    ctx.moveTo(vx[i - 1], vy[i - 1]);
                    ctx.lineTo(curX, vy[i]);
                } else {
                    ctx.lineTo(curX, vy[i]);
                }
            }

            if (inBatch) {
                ctx.stroke();
            }
        }
    }

    /**
     * Compute the displaced world position for a grid vertex at (worldX, worldY).
     * Writes results to the mutable _dispResult scratch (no allocation).
     */
    private _displace(worldX: number, worldY: number): void {
        let dx = 0;
        let dy = 0;

        const sources = this._viewSources;
        for (let i = 0, len = sources.length; i < len; i++) {
            const src = sources[i];
            const ddx = src.worldX - worldX;
            const ddy = src.worldY - worldY;
            const distSq = ddx * ddx + ddy * ddy;

            if (distSq >= src.influenceRadiusSq) continue;

            const dist = Math.sqrt(distSq);
            const t = 1.0 - dist * src.invInfluenceRadius; // 1 at centre, 0 at edge
            const falloff = t * t * t; // cubic falloff

            // Displacement toward source
            const strength = (falloff * src.maxDisplacementWorld) / (dist + 0.1);
            dx += ddx * strength;
            dy += ddy * strength;
        }

        // Cap displacement to prevent violent warping.
        const dispMagSq = dx * dx + dy * dy;
        if (dispMagSq > MAX_DISPLACEMENT_CAP_PX * MAX_DISPLACEMENT_CAP_PX) {
            const scale = MAX_DISPLACEMENT_CAP_PX / Math.sqrt(dispMagSq);
            dx *= scale;
            dy *= scale;
        }

        const dispMag = Math.sqrt(dx * dx + dy * dy);
        const stretch = Math.min(1.0, dispMag / REF_DISP_PX);

        const out = this._dispResult;
        out.dispWorldX = worldX + dx;
        out.dispWorldY = worldY + dy;
        out.stretch = stretch;
    }

    // ─── Colour helpers ───────────────────────────────────────────────────────

    /** Simple hex colour to RGB. Caches results to avoid repeated parsing. */
    private readonly _rgbCache = new Map<string, { r: number; g: number; b: number }>();

    private _hexToRgb(hex: string): { r: number; g: number; b: number } {
        const cached = this._rgbCache.get(hex);
        if (cached) return cached;
        const val = Number.parseInt(hex.replace('#', ''), 16);
        const result = {
            r: (val >> 16) & 0xff,
            g: (val >> 8) & 0xff,
            b: val & 0xff,
        };
        this._rgbCache.set(hex, result);
        return result;
    }
}
