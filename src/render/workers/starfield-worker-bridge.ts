type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

type StarfieldWorkerRenderMessage = {
    type: 'render';
    cameraX: number;
    cameraY: number;
    screenWidthPx: number;
    screenHeightPx: number;
    graphicsQuality: GraphicsQuality;
    nowSec: number;
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
    screenWidthPx: number;
    screenHeightPx: number;
};

export type StarfieldWorkerFrame = {
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    screenWidthPx: number;
    screenHeightPx: number;
};

export class StarfieldWorkerBridge {
    private readonly worker: Worker | null;
    private latestFrame: StarfieldWorkerFrame | null = null;
    private lastSentCameraX = Number.NaN;
    private lastSentCameraY = Number.NaN;
    private lastSentQuality: GraphicsQuality | '' = '';
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

        const dimensionsChanged = screenWidthPx !== this.lastSentWidthPx || screenHeightPx !== this.lastSentHeightPx;
        if (dimensionsChanged) {
            const resizeMessage: StarfieldWorkerResizeMessage = {
                type: 'resize',
                screenWidthPx,
                screenHeightPx,
            };
            this.worker.postMessage(resizeMessage);
        }

        const renderMessage: StarfieldWorkerRenderMessage = {
            type: 'render',
            cameraX,
            cameraY,
            screenWidthPx,
            screenHeightPx,
            graphicsQuality,
            nowSec: performance.now() * 0.001,
        };
        this.worker.postMessage(renderMessage);
        this.lastSentCameraX = cameraX;
        this.lastSentCameraY = cameraY;
        this.lastSentQuality = graphicsQuality;
        this.lastSentWidthPx = screenWidthPx;
        this.lastSentHeightPx = screenHeightPx;
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
