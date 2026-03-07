export function getCanvasScreenWidthPx(canvas: HTMLCanvasElement): number {
    if (canvas.clientWidth > 0) {
        return canvas.clientWidth;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    return canvas.width / devicePixelRatio;
}

export function getCanvasScreenHeightPx(canvas: HTMLCanvasElement): number {
    if (canvas.clientHeight > 0) {
        return canvas.clientHeight;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    return canvas.height / devicePixelRatio;
}
