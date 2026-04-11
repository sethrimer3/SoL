import { SunRenderer, SunRayGameData } from '../sun-renderer';
import { Vector2D } from '../../game-core';

type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type SerializableSun = {
    id: string;
    positionX: number;
    positionY: number;
    radius: number;
    type: string;
};

export type SerializableAsteroid = {
    positionX: number;
    positionY: number;
    worldVertices: ReadonlyArray<{ x: number; y: number }>;
};

export type SunRayWorkerRenderMessage = {
    type: 'render';
    suns: SerializableSun[];
    asteroids: SerializableAsteroid[];
    cameraX: number;
    cameraY: number;
    zoomLevel: number;
    canvasWidthPx: number;
    canvasHeightPx: number;
    viewMinX: number;
    viewMinY: number;
    viewMaxX: number;
    viewMaxY: number;
    graphicsQuality: GraphicsQuality;
    isFancyGraphicsEnabled: boolean;
    gameTimeSec: number;
    sunRayRadiusBucketSize: number;
    sunRayBloomRadiusMultiplier: number;
};

export type SunRayWorkerResizeMessage = {
    type: 'resize';
    canvasWidthPx: number;
    canvasHeightPx: number;
};

type SunRayWorkerMessage = SunRayWorkerRenderMessage | SunRayWorkerResizeMessage;

type SunRayWorkerFrameMessage = {
    type: 'frame';
    bitmap: ImageBitmap;
    view: {
        cameraX: number;
        cameraY: number;
        zoomLevel: number;
        canvasWidthPx: number;
        canvasHeightPx: number;
    };
};

interface SunRayWorkerScope {
    addEventListener(type: 'message', listener: (event: MessageEvent<SunRayWorkerMessage>) => void): void;
    postMessage(message: SunRayWorkerFrameMessage, transfer: Transferable[]): void;
}

const workerScope = self as unknown as SunRayWorkerScope;

const renderer = new SunRenderer((w, h) => new OffscreenCanvas(w, h));

let outputCanvas = new OffscreenCanvas(1, 1);
let outputCtx = outputCanvas.getContext('2d');

// Local radial gradient cache keyed by cacheKey string.
const gradientCache = new Map<string, CanvasGradient>();

const ensureOutputContext = (
    canvasWidthPx: number,
    canvasHeightPx: number
): OffscreenCanvasRenderingContext2D | null => {
    if (outputCanvas.width !== canvasWidthPx || outputCanvas.height !== canvasHeightPx) {
        outputCanvas = new OffscreenCanvas(canvasWidthPx, canvasHeightPx);
        outputCtx = outputCanvas.getContext('2d');
        // Invalidate gradient cache when canvas changes (gradients are context-specific).
        gradientCache.clear();
    }
    return outputCtx;
};

workerScope.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'resize') {
        ensureOutputContext(message.canvasWidthPx, message.canvasHeightPx);
        return;
    }

    const {
        suns, asteroids,
        cameraX, cameraY, zoomLevel,
        canvasWidthPx, canvasHeightPx,
        viewMinX, viewMinY, viewMaxX, viewMaxY,
        graphicsQuality, isFancyGraphicsEnabled, gameTimeSec,
        sunRayRadiusBucketSize, sunRayBloomRadiusMultiplier,
    } = message;

    const context = ensureOutputContext(canvasWidthPx, canvasHeightPx);
    if (!context) {
        return;
    }

    // Reconstruct world-to-screen helpers from serialized view parameters.
    const viewportCenterX = canvasWidthPx * 0.5;
    const viewportCenterY = canvasHeightPx * 0.5;

    const worldToScreen = (worldPos: { x: number; y: number }): Vector2D => new Vector2D(
        viewportCenterX + (worldPos.x - cameraX) * zoomLevel,
        viewportCenterY + (worldPos.y - cameraY) * zoomLevel
    );

    const worldToScreenCoords = (worldX: number, worldY: number, out: Vector2D): void => {
        out.x = viewportCenterX + (worldX - cameraX) * zoomLevel;
        out.y = viewportCenterY + (worldY - cameraY) * zoomLevel;
    };

    const isWithinViewBounds = (worldPos: { x: number; y: number }, margin: number = 0): boolean =>
        worldPos.x >= viewMinX - margin &&
        worldPos.x <= viewMaxX + margin &&
        worldPos.y >= viewMinY - margin &&
        worldPos.y <= viewMaxY + margin;

    // Gradient cache backed by the worker output canvas context.
    const getCachedRadialGradient = (
        cacheKey: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        colorStops: Array<{ offset: number; color: string }>
    ): CanvasGradient => {
        const existing = gradientCache.get(cacheKey);
        if (existing) {
            return existing;
        }
        const gradient = context.createRadialGradient(x0, y0, r0, x1, y1, r1);
        for (const stop of colorStops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        gradientCache.set(cacheKey, gradient);
        return gradient;
    };

    // Build a minimal game-data object from the serialized payload.
    const gameData: SunRayGameData = {
        suns: suns.map(s => ({
            type: s.type,
            position: new Vector2D(s.positionX, s.positionY),
            radius: s.radius,
        })),
        asteroids: asteroids.map(a => {
            const pos = new Vector2D(a.positionX, a.positionY);
            // Pre-build Vector2D vertices so getWorldVertices() is allocation-free after first call.
            const verts = a.worldVertices.map(v => new Vector2D(v.x, v.y));
            return {
                position: pos,
                getWorldVertices: () => verts,
            };
        }),
        gameTime: gameTimeSec,
    };

    context.clearRect(0, 0, canvasWidthPx, canvasHeightPx);

    renderer.drawSunRays(
        context,
        gameData,
        canvasWidthPx,
        canvasHeightPx,
        graphicsQuality,
        isFancyGraphicsEnabled,
        worldToScreen,
        worldToScreenCoords,
        isWithinViewBounds,
        getCachedRadialGradient,
        sunRayRadiusBucketSize,
        sunRayBloomRadiusMultiplier
    );

    // Ultra sun particle layers (embers + dust) are included in the same bitmap.
    if (graphicsQuality === 'ultra' && suns.some(s => s.type !== 'lad')) {
        renderer.drawUltraSunParticleLayers(
            context,
            gameData,
            zoomLevel,
            canvasWidthPx,
            canvasHeightPx,
            graphicsQuality,
            worldToScreenCoords
        );
    }

    // Clear the per-frame shadow quad cache so it is rebuilt from fresh asteroid data next frame.
    renderer.clearFrameCache();

    const bitmap = outputCanvas.transferToImageBitmap();
    workerScope.postMessage({
        type: 'frame',
        bitmap,
        view: {
            cameraX,
            cameraY,
            zoomLevel,
            canvasWidthPx,
            canvasHeightPx,
        },
    }, [bitmap]);
});
