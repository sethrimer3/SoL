import { StarfieldRenderer } from '../starfield-renderer';
import { Vector2D } from '../../game-core';

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

type StarfieldWorkerMessage = StarfieldWorkerRenderMessage | StarfieldWorkerResizeMessage;

type StarfieldWorkerFrameMessage = {
    type: 'frame';
    bitmap: ImageBitmap;
    cameraX: number;
    cameraY: number;
    screenWidthPx: number;
    screenHeightPx: number;
};

interface StarfieldWorkerScope {
    addEventListener(type: 'message', listener: (event: MessageEvent<StarfieldWorkerMessage>) => void): void;
    postMessage(message: StarfieldWorkerFrameMessage, transfer: Transferable[]): void;
}

const workerScope = self as unknown as StarfieldWorkerScope;
const renderer = new StarfieldRenderer((widthPx, heightPx) => new OffscreenCanvas(widthPx, heightPx));

let outputCanvas = new OffscreenCanvas(1, 1);
let outputCtx = outputCanvas.getContext('2d');

const ensureOutputContext = (
    screenWidthPx: number,
    screenHeightPx: number
): OffscreenCanvasRenderingContext2D | null => {
    if (outputCanvas.width !== screenWidthPx || outputCanvas.height !== screenHeightPx) {
        outputCanvas = new OffscreenCanvas(screenWidthPx, screenHeightPx);
        outputCtx = outputCanvas.getContext('2d');
    }

    return outputCtx;
};

workerScope.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'resize') {
        ensureOutputContext(message.screenWidthPx, message.screenHeightPx);
        return;
    }

    const { cameraX, cameraY, screenWidthPx, screenHeightPx, graphicsQuality, nowSec } = message;
    // Reserved for future worker-side animation timing if star flicker is decoupled from performance.now().
    void nowSec;

    const context = ensureOutputContext(screenWidthPx, screenHeightPx);
    if (!context) {
        return;
    }

    context.clearRect(0, 0, screenWidthPx, screenHeightPx);
    renderer.drawReworkedParallaxStars(
        context,
        new Vector2D(cameraX, cameraY),
        screenWidthPx,
        screenHeightPx,
        graphicsQuality
    );

    const bitmap = outputCanvas.transferToImageBitmap();
    workerScope.postMessage({
        type: 'frame',
        bitmap,
        cameraX,
        cameraY,
        screenWidthPx,
        screenHeightPx,
    }, [bitmap]);
});
