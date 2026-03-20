import type { SerializableSun, SerializableAsteroid, SunRayWorkerRenderMessage, SunRayWorkerResizeMessage } from './sun-ray-worker';

type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

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

export type SunRayWorkerFrame = {
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    zoomLevel: number;
    canvasWidthPx: number;
    canvasHeightPx: number;
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
    /**
     * Fraction of viewport to render beyond each edge so panning doesn't reveal
     * unlit regions before the next worker frame arrives. 0.25 = 25% on each side,
     * giving 1.5× each dimension (2.25× total pixel area) rendered in the worker.
     */
    public static readonly OVERSCAN_FRACTION = 0.25;

    private readonly worker: Worker | null;
    private latestFrame: SunRayWorkerFrame | null = null;
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
            this.latestFrame?.bitmap.close();
            this.latestFrame = {
                bitmap: event.data.bitmap,
                cameraX: event.data.view.cameraX,
                cameraY: event.data.view.cameraY,
                zoomLevel: event.data.view.zoomLevel,
                canvasWidthPx: event.data.view.canvasWidthPx,
                canvasHeightPx: event.data.view.canvasHeightPx,
            };
        };
        this.worker.onerror = () => {
            this.dispose();
        };
    }

    /**
     * Serialize the game snapshot and send a render request to the worker.
     * Returns immediately; the resulting frame metadata is available via getLatestFrame() on the next frame.
     */
    public requestFrame(game: SunRayBridgeGameData, view: SunRayViewData): void {
        if (!this.worker || !this.isWorkerOperational) {
            return;
        }

        // Inflate canvas dimensions with overscan so the worker renders beyond
        // the viewport edges, providing buffer content during camera panning.
        const overscanFraction = SunRayWorkerBridge.OVERSCAN_FRACTION;
        const overscanX = Math.ceil(view.canvasWidthPx * overscanFraction);
        const overscanY = Math.ceil(view.canvasHeightPx * overscanFraction);
        const workerWidthPx = view.canvasWidthPx + 2 * overscanX;
        const workerHeightPx = view.canvasHeightPx + 2 * overscanY;

        const dimensionsChanged = workerWidthPx !== this.lastSentWidthPx || workerHeightPx !== this.lastSentHeightPx;
        if (dimensionsChanged) {
            const resizeMessage: SunRayWorkerResizeMessage = {
                type: 'resize',
                canvasWidthPx: workerWidthPx,
                canvasHeightPx: workerHeightPx,
            };
            this.worker.postMessage(resizeMessage);
            this.lastSentWidthPx = workerWidthPx;
            this.lastSentHeightPx = workerHeightPx;
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

        // Extend view bounds to cover the overscan area for proper shadow culling.
        const viewExtensionX = overscanX / view.zoomLevel;
        const viewExtensionY = overscanY / view.zoomLevel;

        const renderMessage: SunRayWorkerRenderMessage = {
            type: 'render',
            suns,
            asteroids,
            ...view,
            canvasWidthPx: workerWidthPx,
            canvasHeightPx: workerHeightPx,
            viewMinX: view.viewMinX - viewExtensionX,
            viewMinY: view.viewMinY - viewExtensionY,
            viewMaxX: view.viewMaxX + viewExtensionX,
            viewMaxY: view.viewMaxY + viewExtensionY,
        };
        this.worker.postMessage(renderMessage);
    }

    /** Returns the most recently delivered worker frame, or null if no frame has arrived yet. */
    public getLatestFrame(): SunRayWorkerFrame | null {
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
