/**
 * GravityGridWorkerBridge
 *
 * Manages the off-main-thread gravity-grid worker.  The bridge serialises
 * the relevant slice of game state each frame, inflates the canvas with
 * overscan so the main thread can translate the bitmap during camera panning
 * without revealing empty edges, and exposes the latest completed frame for
 * blitting.
 *
 * The overscan / blit pattern is identical to SunRayWorkerBridge so the
 * renderer can use the same translation formula for both layers.
 */

import type { GameState, Player } from '../../game-core';
import type {
    GGQuality,
    GGSerializableSun,
    GGSerializableAsteroid,
    GGSerializablePhoton,
    GGSerializableWarpGate,
    GGSerializablePlayer,
    GravityGridWorkerRenderMessage,
    GravityGridWorkerResizeMessage,
} from './gravity-grid-worker';

export type GravityGridWorkerFrame = {
    bitmap:        ImageBitmap;
    cameraX:       number;
    cameraY:       number;
    zoomLevel:     number;
    canvasWidthPx:  number;
    canvasHeightPx: number;
};

type GravityGridWorkerFrameMessage = {
    type: 'frame';
    bitmap:        ImageBitmap;
    cameraX:       number;
    cameraY:       number;
    zoomLevel:     number;
    canvasWidthPx:  number;
    canvasHeightPx: number;
};

type OutboundMessage = GravityGridWorkerRenderMessage | GravityGridWorkerResizeMessage;

/** Hex-string → pre-parsed RGB components cache (avoids per-frame parseInt). */
const hexRgbCache = new Map<string, { r: number; g: number; b: number }>();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cached = hexRgbCache.get(hex);
    if (cached) return cached;
    const val = Number.parseInt(hex.replace('#', ''), 16);
    const result = { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff };
    hexRgbCache.set(hex, result);
    return result;
}

export class GravityGridWorkerBridge {
    /**
     * Fraction of each viewport dimension added as overscan on both sides.
     * 0.30 = 30 % → the worker canvas is 1.6× the viewport in each dimension
     * (2.56× total area).  This gives ~(0.30 × viewport) pixels of translation
     * budget before the main thread needs to fall back to synchronous rendering.
     * 30% was chosen because the grid is expensive to render synchronously at
     * ultra quality (~10–15 ms), so a generous buffer minimises fallback frequency
     * even during aggressive panning.  The sun-ray worker uses 25% for comparison.
     */
    public static readonly OVERSCAN_FRACTION = 0.30;

    private readonly worker: Worker | null;
    private latestFrame: GravityGridWorkerFrame | null = null;
    private lastSentWidthPx  = 0;
    private lastSentHeightPx = 0;
    private isWorkerOperational = false;

    public static isSupported(): boolean {
        return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
    }

    constructor() {
        if (!GravityGridWorkerBridge.isSupported()) {
            this.worker = null;
            return;
        }
        this.worker = new Worker(
            new URL('./gravity-grid-worker.ts', import.meta.url),
            { type: 'module' }
        );
        this.isWorkerOperational = true;

        this.worker.onmessage = (event: MessageEvent<GravityGridWorkerFrameMessage>) => {
            if (event.data.type !== 'frame') return;
            this.latestFrame?.bitmap.close();
            this.latestFrame = {
                bitmap:        event.data.bitmap,
                cameraX:       event.data.cameraX,
                cameraY:       event.data.cameraY,
                zoomLevel:     event.data.zoomLevel,
                canvasWidthPx:  event.data.canvasWidthPx,
                canvasHeightPx: event.data.canvasHeightPx,
            };
        };
        this.worker.onerror = () => { this.dispose(); };
    }

    /**
     * Serialise the game snapshot and post a render request to the worker.
     * Returns immediately; the result is available via getLatestFrame() once the
     * worker finishes.
     *
     * @param game             Live game state (read-only access).
     * @param playerColorMap   Map from Player → hex colour string.
     * @param cameraX          Camera X in world coordinates.
     * @param cameraY          Camera Y in world coordinates.
     * @param zoomLevel        Current zoom level.
     * @param viewportWidthPx  Viewport width in CSS pixels.
     * @param viewportHeightPx Viewport height in CSS pixels.
     * @param graphicsQuality  Current quality setting.
     */
    public requestFrame(
        game: GameState,
        playerColorMap: Map<Player, string>,
        cameraX:       number,
        cameraY:       number,
        zoomLevel:     number,
        viewportWidthPx:  number,
        viewportHeightPx: number,
        graphicsQuality: GGQuality
    ): void {
        if (!this.worker || !this.isWorkerOperational) return;

        // Inflate canvas dimensions with overscan.
        const f = GravityGridWorkerBridge.OVERSCAN_FRACTION;
        const overscanX = Math.ceil(viewportWidthPx  * f);
        const overscanY = Math.ceil(viewportHeightPx * f);
        const workerW = viewportWidthPx  + 2 * overscanX;
        const workerH = viewportHeightPx + 2 * overscanY;

        if (workerW !== this.lastSentWidthPx || workerH !== this.lastSentHeightPx) {
            const resize: GravityGridWorkerResizeMessage = {
                type: 'resize',
                canvasWidthPx:  workerW,
                canvasHeightPx: workerH,
            };
            this.worker.postMessage(resize as OutboundMessage);
            this.lastSentWidthPx  = workerW;
            this.lastSentHeightPx = workerH;
        }

        // ── Serialise game entities ───────────────────────────────────────────

        const suns: GGSerializableSun[] = [];
        for (let i = 0; i < game.suns.length; i++) {
            const s = game.suns[i];
            suns.push({ x: s.position.x, y: s.position.y, radius: s.radius });
        }

        const asteroids: GGSerializableAsteroid[] = [];
        for (let i = 0; i < game.asteroids.length; i++) {
            const a = game.asteroids[i];
            asteroids.push({ x: a.position.x, y: a.position.y, size: a.size });
        }

        const photons: GGSerializablePhoton[] = [];
        for (let i = 0; i < game.photons.length; i++) {
            const p = game.photons[i];
            photons.push({ x: p.position.x, y: p.position.y });
        }

        const warpGates: GGSerializableWarpGate[] = [];
        for (let i = 0; i < game.warpGates.length; i++) {
            const g = game.warpGates[i];
            if (!g.hasDissipated) {
                warpGates.push({ x: g.position.x, y: g.position.y });
            }
        }

        const players: GGSerializablePlayer[] = [];
        for (let p = 0; p < game.players.length; p++) {
            const player = game.players[p];
            const colorHex = playerColorMap.get(player) ?? '#FFFFFF';
            const rgb = hexToRgb(colorHex);

            const buildings: Array<{ x: number; y: number; radius: number }> = [];
            for (let i = 0; i < player.buildings.length; i++) {
                const b = player.buildings[i];
                buildings.push({ x: b.position.x, y: b.position.y, radius: b.radius });
            }

            const mirrors: Array<{ x: number; y: number; radius: number }> = [];
            for (let i = 0; i < player.solarMirrors.length; i++) {
                const m = player.solarMirrors[i];
                mirrors.push({ x: m.position.x, y: m.position.y, radius: 0 });
            }

            const units: Array<{ x: number; y: number; isHero: boolean }> = [];
            for (let i = 0; i < player.units.length; i++) {
                const u = player.units[i];
                units.push({ x: u.position.x, y: u.position.y, isHero: u.isHero });
            }

            players.push({
                colorR:     rgb.r,
                colorG:     rgb.g,
                colorB:     rgb.b,
                isDefeated: player.isDefeated(),
                forge:      player.stellarForge
                    ? { x: player.stellarForge.position.x, y: player.stellarForge.position.y, radius: player.stellarForge.radius }
                    : null,
                buildings,
                mirrors,
                units,
            });
        }

        const render: GravityGridWorkerRenderMessage = {
            type: 'render',
            suns,
            asteroids,
            photons,
            warpGates,
            players,
            cameraX,
            cameraY,
            zoomLevel,
            canvasWidthPx:  workerW,
            canvasHeightPx: workerH,
            graphicsQuality,
        };
        this.worker.postMessage(render as OutboundMessage);
    }

    /** Returns the most recently completed worker frame, or null if none yet. */
    public getLatestFrame(): GravityGridWorkerFrame | null {
        return this.latestFrame;
    }

    /** Terminate the worker and release any held ImageBitmap. */
    public dispose(): void {
        this.isWorkerOperational = false;
        this.worker?.terminate();
        this.latestFrame?.bitmap.close();
        this.latestFrame = null;
    }
}
