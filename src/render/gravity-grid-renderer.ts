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
 * When a vertex is in sunlight the base colour is a blazing pale yellow (almost
 * white); in shadow it is a bright orange.  Opacity is 0% when there is no
 * gravity influence and rises to 30% at extreme distortion.
 *
 * Each source's influence radius equals 8 × radius (doubled from original).
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

/** Spacing of grid lines in world pixels (3× denser than original 80 px). */
const GRID_SPACING_WORLD_PX = 27;

/** Base opacity when there is no gravity influence (fully invisible). */
const BASE_OPACITY = 0.0;

/** Colour used for suns / environment objects. */
const ENV_GOLD_COLOR = '#B8860B';

/** Maximum opacity at full stretch (0 base + up to 30% at extreme gravity). */
const MAX_EXTRA_OPACITY = 0.30;

/** Radius of the solar mirror for gravity-well purposes (world pixels). */
const MIRROR_GRAVITY_RADIUS_PX = Constants.SOLAR_MIRROR_COLLISION_RADIUS;

/** Base hero radius for gravity-well purposes (world pixels). */
const HERO_GRAVITY_RADIUS_PX = 22;

/** Starling radius for gravity-well purposes (world pixels). */
const STARLING_GRAVITY_RADIUS_PX = Constants.UNIT_RADIUS_PX;

/** Gravity influence radius for photons – immense, belying their tiny size (world px). */
const PHOTON_GRAVITY_INFLUENCE_PX = 200;

/** Maximum grid displacement caused by a photon (world px). */
const PHOTON_GRAVITY_DISPLACEMENT_PX = 80;

/** Gravity influence radius for warp gates – immense relative to their size (world px). */
const WARP_GATE_GRAVITY_INFLUENCE_PX = 600;

/** Maximum grid displacement caused by a warp gate (world px). */
const WARP_GATE_GRAVITY_DISPLACEMENT_PX = 200;

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

    // Temporary reference to game state during a draw call (avoids threading through every helper).
    private _currentGame: GameState | null = null;

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
        this._currentGame = game;
        this._collectSources(game, playerColorMap);

        if (this._sources.length === 0) {
            // No gravity sources → grid is at 0% opacity, nothing to draw.
            this._currentGame = null;
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
        ctx.lineWidth = Math.max(1.0, zoom * 1.0);
        ctx.lineCap = 'round';

        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, true);
        this._drawLines(context, startGridX, endGridX, startGridY, endGridY, false);

        ctx.restore();
        this._currentGame = null;
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

        // Photons – immense gravity that belies their tiny size
        for (const photon of game.photons) {
            this._pushSourceCustom(
                photon.position.x,
                photon.position.y,
                PHOTON_GRAVITY_INFLUENCE_PX,
                PHOTON_GRAVITY_DISPLACEMENT_PX,
                ENV_GOLD_COLOR
            );
        }

        // Warp gates – immense gravity relative to their size (only when active)
        for (const gate of game.warpGates) {
            if (!gate.hasDissipated) {
                this._pushSourceCustom(
                    gate.position.x,
                    gate.position.y,
                    WARP_GATE_GRAVITY_INFLUENCE_PX,
                    WARP_GATE_GRAVITY_DISPLACEMENT_PX,
                    ENV_GOLD_COLOR
                );
            }
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
        // influenceRadius = 8 × radius (doubled from original 4×)
        const influenceRadiusWorld = radiusPx * 8;
        // Maximum displacement: 80% of the object's radius (doubled from original 40%)
        const maxDisplacementWorld = radiusPx * 0.8;
        this._sources.push({
            worldX,
            worldY,
            influenceRadiusWorld,
            maxDisplacementWorld,
            blendColor,
        });
    }

    private _pushSourceCustom(
        worldX: number,
        worldY: number,
        influenceRadiusWorld: number,
        maxDisplacementWorld: number,
        blendColor: string
    ): void {
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

                // Skip invisible vertices (zero stretch → opacity 0) to reduce draw calls.
                if (result.stretch < 0.001) {
                    // Still record a NaN sentinel so we don't draw a segment here.
                    vx.push(NaN);
                    vy.push(NaN);
                    vc.push('');
                    continue;
                }

                // Determine sunlight state for colour selection.
                const inSunlight = this._isInSunlight(worldX, worldY);

                // Convert displaced world position to screen
                this._scratchVec.x = result.dispWorldX;
                this._scratchVec.y = result.dispWorldY;
                const screen = context.worldToScreen(this._scratchVec);

                vx.push(screen.x);
                vy.push(screen.y);
                vc.push(this._blendedColor(result.stretch, result.blendR, result.blendG, result.blendB, inSunlight));
            }

            // Draw segments – each adjacent pair of vertices forms one segment.
            // We batch segments with the same colour to minimise draw calls.
            // NaN sentinels (invisible vertices) break the path to avoid
            // inadvertently connecting segments across invisible areas.
            const count = vx.length;
            if (count < 2) continue;

            let inBatch = false;
            let batchColor = '';

            for (let i = 0; i < count; i++) {
                const curX = vx[i];
                const curColor = vc[i];

                if (Number.isNaN(curX) || curColor === '') {
                    // Flush and close any open batch at this break point.
                    if (inBatch) {
                        ctx.strokeStyle = batchColor;
                        ctx.stroke();
                        inBatch = false;
                        batchColor = '';
                    }
                    continue;
                }

                if (!inBatch) {
                    batchColor = curColor;
                    ctx.beginPath();
                    ctx.moveTo(curX, vy[i]);
                    inBatch = true;
                } else if (curColor !== batchColor) {
                    // Colour change – flush the old batch and start a new one.
                    ctx.strokeStyle = batchColor;
                    ctx.stroke();
                    batchColor = curColor;
                    ctx.beginPath();
                    ctx.moveTo(vx[i - 1], vy[i - 1]);
                    ctx.lineTo(curX, vy[i]);
                } else {
                    ctx.lineTo(curX, vy[i]);
                }
            }

            // Flush the final batch.
            if (inBatch) {
                ctx.strokeStyle = batchColor;
                ctx.stroke();
            }
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
     * Return an rgba string blended from the base colour toward the influence
     * source colour, based on the stretch factor (0–1).
     *
     * In sunlight the base is a blazing pale yellow (almost white).
     * In shadow the base is a bright orange.
     */
    private _blendedColor(
        stretch: number,
        srcR: number,
        srcG: number,
        srcB: number,
        isInSunlight: boolean
    ): string {
        // Sunlit: blazing pale yellow almost white; shadow: bright orange
        const baseR = 255;
        const baseG = isInSunlight ? 255 : 120;
        const baseB = isInSunlight ? 230 :   0;

        // Smoothstep stretch for a nicer visual transition
        const t = stretch * stretch * (3 - 2 * stretch);

        const r = Math.round(baseR + (srcR - baseR) * t);
        const g = Math.round(baseG + (srcG - baseG) * t);
        const b = Math.round(baseB + (srcB - baseB) * t);

        // Opacity is 0 at zero stretch and rises to MAX_EXTRA_OPACITY at full stretch.
        const alpha = BASE_OPACITY + t * MAX_EXTRA_OPACITY;

        return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    }

    /**
     * Quick approximate sunlight check for a world-space point.
     *
     * Uses circle-approximation for asteroid occlusion rather than the full
     * polygon intersection used by VisionSystem, keeping per-vertex cost low.
     * Returns true if at least one sun has line-of-sight to the point.
     */
    private _isInSunlight(worldX: number, worldY: number): boolean {
        const game = this._currentGame;
        if (!game || game.suns.length === 0) return false;

        for (const sun of game.suns) {
            const dx = sun.position.x - worldX;
            const dy = sun.position.y - worldY;
            const distToSun = Math.sqrt(dx * dx + dy * dy);
            if (distToSun < 0.001) return true;

            const invDist = 1 / distToSun;
            const dirX = dx * invDist;
            const dirY = dy * invDist;

            let blocked = false;
            for (const asteroid of game.asteroids) {
                // Project the asteroid centre onto the ray from vertex → sun.
                const ax = asteroid.position.x - worldX;
                const ay = asteroid.position.y - worldY;
                const t = ax * dirX + ay * dirY;
                if (t < 0 || t > distToSun) continue;
                // Closest point on the ray to the asteroid centre
                const perp2 = (ax - dirX * t) * (ax - dirX * t) + (ay - dirY * t) * (ay - dirY * t);
                if (perp2 < asteroid.size * asteroid.size) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) return true;
        }

        return false;
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
}
