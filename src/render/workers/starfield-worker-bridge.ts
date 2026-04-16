type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

type StarfieldWorkerRenderMessage = {
    type: 'render';
    cameraX: number;
    cameraY: number;
    screenWidthPx: number;
    screenHeightPx: number;
    graphicsQuality: GraphicsQuality;
    nowSec: number;
    /** Viewport width before overscan inflation (echoed back in the frame message). */
    viewportWidthPx: number;
    /** Viewport height before overscan inflation (echoed back in the frame message). */
    viewportHeightPx: number;
};

type StarfieldWorkerResizeMessage = {
    type: 'resize';
    screenWidthPx: number;
    screenHeightPx: number;
};

type StarfieldWorkerFrameMessage = {
    type: 'frame';
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    /** Overscan-inflated canvas width that the worker rendered to. */
    screenWidthPx: number;
    /** Overscan-inflated canvas height that the worker rendered to. */
    screenHeightPx: number;
    /** Viewport (non-overscan) width at the time the frame was requested. */
    viewportWidthPx: number;
    /** Viewport (non-overscan) height at the time the frame was requested. */
    viewportHeightPx: number;
};

export type StarfieldWorkerFrame = {
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    /** Overscan-inflated canvas width that was rendered. */
    screenWidthPx: number;
    /** Overscan-inflated canvas height that was rendered. */
    screenHeightPx: number;
    /** Viewport width used when requesting this frame (without overscan). */
    viewportWidthPx: number;
    /** Viewport height used when requesting this frame (without overscan). */
    viewportHeightPx: number;
};

export class StarfieldWorkerBridge {
    /**
     * Fraction of each viewport dimension added as overscan on both sides.
     * 0.15 = 15 % → worker renders at 1.3× the viewport in each dimension.
     * Parallax factors range 0.12–0.53; using an effective factor of 0.25 the
     * overscan budget covers ~(0.15 × viewport / 0.25) world pixels of panning
     * before a stale frame would show edges — well over a second of fast panning.
     * 15% was chosen to minimise extra GPU memory (1.69× area) while still
     * providing ample buffer for typical game panning speeds.
     */
    public static readonly OVERSCAN_FRACTION = 0.15;

    /**
     * Weighted-average parallax factor across all star layers (weighted by star
     * count).  Used to approximate the per-layer translation when repositioning
     * a stale overscan frame during panning.
     * Exact per-layer values: 0.12, 0.17, 0.22, 0.27, 0.32, 0.38, 0.45, 0.53.
     * Weighted mean (by count 1300/1000/850/650/450/300/180/110) ≈ 0.22.
     * Rounded up slightly to 0.25 so the translation better covers the visually
     * prominent (brighter, larger) foreground stars.
     */
    public static readonly EFFECTIVE_PARALLAX_FACTOR = 0.25;

    private readonly worker: Worker | null;
    private latestFrame: StarfieldWorkerFrame | null = null;
    private lastSentWidthPx = 0;
    private lastSentHeightPx = 0;
    private isWorkerOperational = false;

    public static isSupported(): boolean {
        return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
    }

    constructor() {
        if (!StarfieldWorkerBridge.isSupported()) {
            this.worker = null;
            return;
        }

        this.worker = new Worker(
            new URL('./starfield-worker.ts', import.meta.url),
            { type: 'module' }
        );
        this.isWorkerOperational = true;
        this.worker.onmessage = (event: MessageEvent<StarfieldWorkerFrameMessage>) => {
            if (event.data.type !== 'frame') {
                return;
            }

            this.latestFrame?.bitmap.close();
            this.latestFrame = {
                bitmap: event.data.bitmap,
                cameraX: event.data.cameraX,
                cameraY: event.data.cameraY,
                screenWidthPx: event.data.screenWidthPx,
                screenHeightPx: event.data.screenHeightPx,
                viewportWidthPx: event.data.viewportWidthPx,
                viewportHeightPx: event.data.viewportHeightPx,
            };
        };
        this.worker.onerror = () => {
            this.dispose();
        };
    }

    public requestFrame(
        cameraX: number,
        cameraY: number,
        screenWidthPx: number,
        screenHeightPx: number,
        graphicsQuality: GraphicsQuality
    ): void {
        if (!this.worker || !this.isWorkerOperational) {
            return;
        }

        // Inflate canvas dimensions with overscan so the main thread can translate
        // the bitmap to compensate for camera movement between frames.
        const f = StarfieldWorkerBridge.OVERSCAN_FRACTION;
        const overscanX = Math.ceil(screenWidthPx  * f);
        const overscanY = Math.ceil(screenHeightPx * f);
        const workerWidthPx  = screenWidthPx  + 2 * overscanX;
        const workerHeightPx = screenHeightPx + 2 * overscanY;

        const dimensionsChanged = workerWidthPx !== this.lastSentWidthPx || workerHeightPx !== this.lastSentHeightPx;
        if (dimensionsChanged) {
            const resizeMessage: StarfieldWorkerResizeMessage = {
                type: 'resize',
                screenWidthPx: workerWidthPx,
                screenHeightPx: workerHeightPx,
            };
            this.worker.postMessage(resizeMessage);
        }

        const renderMessage: StarfieldWorkerRenderMessage = {
            type: 'render',
            cameraX,
            cameraY,
            screenWidthPx: workerWidthPx,
            screenHeightPx: workerHeightPx,
            graphicsQuality,
            nowSec: performance.now() * 0.001,
            viewportWidthPx: screenWidthPx,
            viewportHeightPx: screenHeightPx,
        };
        this.worker.postMessage(renderMessage);
        this.lastSentWidthPx  = workerWidthPx;
        this.lastSentHeightPx = workerHeightPx;
    }

    public getLatestFrame(): StarfieldWorkerFrame | null {
        return this.latestFrame;
    }

    public dispose(): void {
        this.isWorkerOperational = false;
        this.worker?.terminate();
        this.latestFrame?.bitmap.close();
        this.latestFrame = null;
    }
}
