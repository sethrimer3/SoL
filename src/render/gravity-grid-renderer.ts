/**
 * GravityGridRenderer - Renders a faint grid with gravity-well distortion effects.
 *
 * A very faint light-orange grid is drawn over the playing field.  Each game
 * entity (structures, heroes, solar mirrors, starlings, the sun, and asteroids)
 * pulls the nearby grid lines toward it, creating a gravity-well visual.  The
 * deeper the stretch at any grid vertex, the more the colour at that point shifts
 * from the base light-orange toward the source's assigned colour:
 *   - Player-owned entities  → that player's colour
 *   - Suns / asteroids        → deep gold (#B8860B)
 *
 * Each source's influence radius equals twice its diameter (4 × radius).
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
    /** Maximum displacement (world units) at the source centre. */
    maxDisplacementWorld: number;
    /** Hex colour to blend toward at full stretch (e.g. player colour or gold). */
    blendColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Spacing of grid lines in world pixels. */
const GRID_SPACING_WORLD_PX = 80;

/** Base opacity for the grid (light orange at 10% opacity). */
const BASE_OPACITY = 0.10;

/** Colour used for suns / environment objects. */
const ENV_GOLD_COLOR = '#B8860B';

/** How much the opacity can rise at maximum stretch (additive on top of BASE_OPACITY). */
const MAX_EXTRA_OPACITY = 0.18;

/** Radius of the solar mirror for gravity-well purposes (world pixels). */
const MIRROR_GRAVITY_RADIUS_PX = Constants.SOLAR_MIRROR_COLLISION_RADIUS;

/** Base hero radius for gravity-well purposes (world pixels). */
const HERO_GRAVITY_RADIUS_PX = 22;

/** Starling radius for gravity-well purposes (world pixels). */
const STARLING_GRAVITY_RADIUS_PX = Constants.UNIT_RADIUS_PX;

// ─── Renderer class ───────────────────────────────────────────────────────────

export class GravityGridRenderer {
    // Reusable scratch vectors to avoid per-frame allocations.
    private readonly _scratchVec: Vector2D = new Vector2D(0, 0);

    // Reusable sources array – populated each frame.
    private readonly _sources: GravitySource[] = [];

    // Reusable per-line vertex arrays.
    private readonly _lineVerticesX: number[] = [];
    private readonly _lineVerticesY: number[] = [];
    private readonly _lineColors: string[] = [];

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
            // No sources → draw the plain base grid and return.
            this._drawPlainGrid(game, context, screenWidth, screenHeight);
            return;
        }

        // ── Compute world-space viewport bounds ───────────────────────────────
        const halfW = screenWidth / (2 * zoom);
        const halfH = screenHeight / (2 * zoom);
        const camX = context.camera.x;
        const camY = context.camera.y;

        const margin = GRID_SPACING_WORLD_PX * 1.5;
        const worldMinX = camX - halfW - margin;
        const worldMaxX = camX + halfW + margin;
        const worldMinY = camY - halfH - margin;
        const worldMaxY = camY + halfH + margin;

        const startGridX = Math.floor(worldMinX / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;
        const endGridX = Math.ceil(worldMaxX / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;
        const startGridY = Math.floor(worldMinY / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;
        const endGridY = Math.ceil(worldMaxY / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;

        // ── Draw displaced grid ───────────────────────────────────────────────
        ctx.save();
        ctx.lineWidth = Math.max(0.5, zoom * 0.5);
        ctx.lineCap = 'round';

        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, true);
        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, false);

        ctx.restore();
    }

    // ─── Source collection ────────────────────────────────────────────────────

    private _collectSources(game: GameState, playerColorMap: Map<Player, string>): void {
        const sources = this._sources;
        sources.length = 0;

        // Suns
        for (const sun of game.suns) {
            this._pushSource(sun.position.x, sun.position.y, sun.radius, ENV_GOLD_COLOR);
        }

        // Asteroids
        for (const asteroid of game.asteroids) {
            this._pushSource(asteroid.position.x, asteroid.position.y, asteroid.size, ENV_GOLD_COLOR);
        }

        // Per-player entities
        for (const player of game.players) {
            if (player.isDefeated()) continue;

            const color = playerColorMap.get(player) ?? '#FFFFFF';

            // Stellar Forge
            if (player.stellarForge) {
                const forge = player.stellarForge;
                this._pushSource(forge.position.x, forge.position.y, forge.radius, color);
            }

            // Buildings (towers etc.)
            for (const building of player.buildings) {
                this._pushSource(building.position.x, building.position.y, building.radius, color);
            }

            // Solar Mirrors
            for (const mirror of player.solarMirrors) {
                this._pushSource(mirror.position.x, mirror.position.y, MIRROR_GRAVITY_RADIUS_PX, color);
            }

            // Units (heroes and starlings)
            for (const unit of player.units) {
                const r = unit.isHero ? HERO_GRAVITY_RADIUS_PX : STARLING_GRAVITY_RADIUS_PX;
                this._pushSource(unit.position.x, unit.position.y, r, color);
            }
        }
    }

    private _pushSource(worldX: number, worldY: number, radiusPx: number, blendColor: string): void {
        // influenceRadius = 2 × diameter = 4 × radius (as specified)
        const influenceRadiusWorld = radiusPx * 4;
        // Maximum displacement: 40% of the object's radius
        const maxDisplacementWorld = radiusPx * 0.4;
        this._sources.push({
            worldX,
            worldY,
            influenceRadiusWorld,
            maxDisplacementWorld,
            blendColor,
        });
    }

    // ─── Grid drawing ─────────────────────────────────────────────────────────

    /**
     * Draw vertical (isVertical=true) or horizontal (isVertical=false) grid lines
     * with gravity-well displacement and colour blending.
     */
    private _drawLines(
        context: GravityGridContext,
        startGridX: number,
        endGridX: number,
        startGridY: number,
        endGridY: number,
        isVertical: boolean
    ): void {
        const { ctx } = context;

        // Outer loop: each grid line (constant-x for vertical, constant-y for horizontal)
        const outerStart = isVertical ? startGridX : startGridY;
        const outerEnd = isVertical ? endGridX : endGridY;
        const innerStart = isVertical ? startGridY : startGridX;
        const innerEnd = isVertical ? endGridY : endGridX;

        for (let outer = outerStart; outer <= outerEnd; outer += GRID_SPACING_WORLD_PX) {
            // Collect displaced vertices along this line
            const vx = this._lineVerticesX;
            const vy = this._lineVerticesY;
            const vc = this._lineColors;
            vx.length = 0;
            vy.length = 0;
            vc.length = 0;

            for (let inner = innerStart; inner <= innerEnd; inner += GRID_SPACING_WORLD_PX) {
                const worldX = isVertical ? outer : inner;
                const worldY = isVertical ? inner : outer;

                const result = this._displace(worldX, worldY);

                // Convert displaced world position to screen
                this._scratchVec.x = result.dispWorldX;
                this._scratchVec.y = result.dispWorldY;
                const screen = context.worldToScreen(this._scratchVec);

                vx.push(screen.x);
                vy.push(screen.y);
                vc.push(this._blendedColor(result.stretch, result.blendR, result.blendG, result.blendB));
            }

            // Draw segments – each adjacent pair of vertices forms one segment.
            // We batch segments with the same colour to minimise draw calls.
            const count = vx.length;
            if (count < 2) continue;

            let batchColor = vc[0];
            ctx.beginPath();
            ctx.moveTo(vx[0], vy[0]);

            for (let i = 1; i < count; i++) {
                const segColor = vc[i];
                if (segColor === batchColor) {
                    ctx.lineTo(vx[i], vy[i]);
                } else {
                    // Flush the current batch
                    ctx.strokeStyle = batchColor;
                    ctx.stroke();
                    // Start a new batch
                    batchColor = segColor;
                    ctx.beginPath();
                    ctx.moveTo(vx[i - 1], vy[i - 1]);
                    ctx.lineTo(vx[i], vy[i]);
                }
            }
            // Flush final batch
            ctx.strokeStyle = batchColor;
            ctx.stroke();
        }
    }

    /**
     * Compute the displaced world position for a grid vertex at (worldX, worldY).
     * Returns the displaced coords plus a blended colour component (stretch 0-1
     * and weighted average RGB of influencing sources).
     */
    private _displace(worldX: number, worldY: number): {
        dispWorldX: number;
        dispWorldY: number;
        stretch: number;
        blendR: number;
        blendG: number;
        blendB: number;
    } {
        let dx = 0;
        let dy = 0;
        let weightedR = 0;
        let weightedG = 0;
        let weightedB = 0;
        let totalWeight = 0;

        for (const src of this._sources) {
            const ddx = src.worldX - worldX;
            const ddy = src.worldY - worldY;
            const distSq = ddx * ddx + ddy * ddy;
            const influenceSq = src.influenceRadiusWorld * src.influenceRadiusWorld;

            if (distSq >= influenceSq) continue;

            const dist = Math.sqrt(distSq);
            const t = 1.0 - dist / src.influenceRadiusWorld; // 1 at centre, 0 at edge
            const falloff = t * t * t; // cubic falloff

            // Displacement toward source
            const strength = (falloff * src.maxDisplacementWorld) / (dist + 0.1);
            dx += ddx * strength;
            dy += ddy * strength;

            // Colour contribution
            const colorWeight = falloff;
            const rgb = this._hexToRgb(src.blendColor);
            weightedR += rgb.r * colorWeight;
            weightedG += rgb.g * colorWeight;
            weightedB += rgb.b * colorWeight;
            totalWeight += colorWeight;
        }

        const dispMag = Math.sqrt(dx * dx + dy * dy);
        // Normalise stretch to 0-1 using a reference displacement distance
        // Normalise stretch to 0-1 using a reference displacement distance (world pixels)
        const refDispPx = 15.0; // world pixels – tune for visual feel
        const stretch = Math.min(1.0, dispMag / refDispPx);

        // Weighted average source colour (falls back to base orange if no influence)
        const blendR = totalWeight > 0 ? weightedR / totalWeight : 255;
        const blendG = totalWeight > 0 ? weightedG / totalWeight : 165;
        const blendB = totalWeight > 0 ? weightedB / totalWeight : 0;

        return {
            dispWorldX: worldX + dx,
            dispWorldY: worldY + dy,
            stretch,
            blendR,
            blendG,
            blendB,
        };
    }

    // ─── Colour helpers ───────────────────────────────────────────────────────

    /**
     * Return an rgba string blended from the base light-orange toward the
     * influence source colour, based on the stretch factor (0-1).
     */
    private _blendedColor(
        stretch: number,
        srcR: number,
        srcG: number,
        srcB: number
    ): string {
        // Base orange: rgb(255, 165, 0)
        const baseR = 255;
        const baseG = 165;
        const baseB = 0;

        // Smoothstep stretch for a nicer visual transition
        const t = stretch * stretch * (3 - 2 * stretch);

        const r = Math.round(baseR + (srcR - baseR) * t);
        const g = Math.round(baseG + (srcG - baseG) * t);
        const b = Math.round(baseB + (srcB - baseB) * t);

        // Opacity increases slightly with stretch
        const alpha = BASE_OPACITY + t * MAX_EXTRA_OPACITY;

        return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    }

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

    // ─── Fallback: plain grid ─────────────────────────────────────────────────

    private _drawPlainGrid(
        game: GameState,
        context: GravityGridContext,
        screenWidthPx: number,
        screenHeightPx: number
    ): void {
        const { ctx, zoom } = context;
        const camX = context.camera.x;
        const camY = context.camera.y;

        const halfW = screenWidthPx / (2 * zoom);
        const halfH = screenHeightPx / (2 * zoom);

        const worldMinX = camX - halfW;
        const worldMaxX = camX + halfW;
        const worldMinY = camY - halfH;
        const worldMaxY = camY + halfH;

        const startX = Math.floor(worldMinX / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;
        const startY = Math.floor(worldMinY / GRID_SPACING_WORLD_PX) * GRID_SPACING_WORLD_PX;

        ctx.save();
        ctx.strokeStyle = `rgba(255, 165, 0, ${BASE_OPACITY})`;
        ctx.lineWidth = Math.max(0.5, zoom * 0.5);
        ctx.beginPath();

        for (let worldLineX = startX; worldLineX <= worldMaxX; worldLineX += GRID_SPACING_WORLD_PX) {
            this._scratchVec.x = worldLineX;
            this._scratchVec.y = worldMinY;
            const top = context.worldToScreen(this._scratchVec);
            this._scratchVec.y = worldMaxY;
            const bot = context.worldToScreen(this._scratchVec);
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(bot.x, bot.y);
        }
        for (let worldLineY = startY; worldLineY <= worldMaxY; worldLineY += GRID_SPACING_WORLD_PX) {
            this._scratchVec.x = worldMinX;
            this._scratchVec.y = worldLineY;
            const left = context.worldToScreen(this._scratchVec);
            this._scratchVec.x = worldMaxX;
            const right = context.worldToScreen(this._scratchVec);
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
        }

        ctx.stroke();
        ctx.restore();
    }
}
