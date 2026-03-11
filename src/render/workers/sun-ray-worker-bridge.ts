import type { SerializableSun, SerializableAsteroid, SunRayWorkerRenderMessage, SunRayWorkerResizeMessage } from './sun-ray-worker';

type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

type SunRayWorkerFrameMessage = {
    type: 'frame';
    bitmap: ImageBitmap;
};

/**
 * Minimal game-data shape consumed by the bridge (matches SunRayGameData but allows live objects).
 * The bridge reads only `type`, `position.x/y`, and `radius` from suns, and
 * `position.x/y` + `getWorldVertices()` from asteroids.
 */
export interface SunRayBridgeGameData {
    readonly suns: ReadonlyArray<{
        readonly type: string;
        readonly position: { readonly x: number; readonly y: number };
        readonly radius: number;
    }>;
    readonly asteroids: ReadonlyArray<{
        readonly position: { readonly x: number; readonly y: number };
        getWorldVertices(): ReadonlyArray<{ readonly x: number; readonly y: number }>;
    }>;
}

export interface SunRayViewData {
    readonly cameraX: number;
    readonly cameraY: number;
    readonly zoomLevel: number;
    readonly canvasWidthPx: number;
    readonly canvasHeightPx: number;
    readonly viewMinX: number;
    readonly viewMinY: number;
    readonly viewMaxX: number;
    readonly viewMaxY: number;
    readonly graphicsQuality: GraphicsQuality;
    readonly isFancyGraphicsEnabled: boolean;
    readonly gameTimeSec: number;
    readonly sunRayRadiusBucketSize: number;
    readonly sunRayBloomRadiusMultiplier: number;
}

export class SunRayWorkerBridge {
    private readonly worker: Worker | null;
    private latestBitmap: ImageBitmap | null = null;
    private lastSentWidthPx = 0;
    private lastSentHeightPx = 0;
    private isWorkerOperational = false;

    public static isSupported(): boolean {
        return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
    }

    constructor() {
        if (!SunRayWorkerBridge.isSupported()) {
            this.worker = null;
            return;
        }

        this.worker = new Worker(
            new URL('./sun-ray-worker.ts', import.meta.url),
            { type: 'module' }
        );
        this.isWorkerOperational = true;
        this.worker.onmessage = (event: MessageEvent<SunRayWorkerFrameMessage>) => {
            if (event.data.type !== 'frame') {
                return;
            }
            this.latestBitmap?.close();
            this.latestBitmap = event.data.bitmap;
        };
        this.worker.onerror = () => {
            this.dispose();
        };
    }

    /**
     * Serialize the game snapshot and send a render request to the worker.
     * Returns immediately; the resulting bitmap is available via getLatestBitmap() on the next frame.
     */
    public requestFrame(game: SunRayBridgeGameData, view: SunRayViewData): void {
        if (!this.worker || !this.isWorkerOperational) {
            return;
        }

        const { canvasWidthPx, canvasHeightPx } = view;
        const dimensionsChanged = canvasWidthPx !== this.lastSentWidthPx || canvasHeightPx !== this.lastSentHeightPx;
        if (dimensionsChanged) {
            const resizeMessage: SunRayWorkerResizeMessage = {
                type: 'resize',
                canvasWidthPx,
                canvasHeightPx,
            };
            this.worker.postMessage(resizeMessage);
            this.lastSentWidthPx = canvasWidthPx;
            this.lastSentHeightPx = canvasHeightPx;
        }

        // Serialize suns.
        const suns: SerializableSun[] = game.suns.map(s => ({
            id: `${s.position.x}_${s.position.y}`,
            positionX: s.position.x,
            positionY: s.position.y,
            radius: s.radius,
            type: s.type,
        }));

        // Serialize asteroids — snapshot world-space vertices to plain objects.
        const asteroids: SerializableAsteroid[] = game.asteroids.map(a => {
            const verts = a.getWorldVertices();
            const worldVertices: Array<{ x: number; y: number }> = new Array(verts.length);
            for (let i = 0; i < verts.length; i++) {
                worldVertices[i] = { x: verts[i].x, y: verts[i].y };
            }
            return {
                positionX: a.position.x,
                positionY: a.position.y,
                worldVertices,
            };
        });

        const renderMessage: SunRayWorkerRenderMessage = {
            type: 'render',
            suns,
            asteroids,
            ...view,
        };
        this.worker.postMessage(renderMessage);
    }

    /** Returns the most recently delivered ImageBitmap, or null if no frame has arrived yet. */
    public getLatestBitmap(): ImageBitmap | null {
        return this.latestBitmap;
    }

    /** Terminate the worker and release any held ImageBitmap. */
    public dispose(): void {
        this.isWorkerOperational = false;
        this.worker?.terminate();
        this.latestBitmap?.close();
        this.latestBitmap = null;
    }
}
