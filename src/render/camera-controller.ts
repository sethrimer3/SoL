/**
 * Camera Utilities
 * Pure helper functions for camera position clamping and zoom bounds calculations.
 *
 * Extracted from renderer.ts as part of Phase 10 refactoring.
 */

import { Vector2D } from '../game-core';
import * as Constants from '../constants';

/**
 * Clamp camera position to level boundaries.
 * @param pos - Camera position in world coordinates
 * @param viewportWidthPx - Viewport width in screen pixels
 * @param viewportHeightPx - Viewport height in screen pixels
 * @param zoom - Current zoom level
 * @returns Clamped camera position
 */
export function clampCameraToLevelBounds(
    pos: Vector2D,
    viewportWidthPx: number,
    viewportHeightPx: number,
    zoom: number
): Vector2D {
    const viewWidth = viewportWidthPx / zoom;
    const viewHeight = viewportHeightPx / zoom;

    const halfMapSize = Constants.MAP_SIZE / 2;
    const maxX = halfMapSize - viewWidth / 2;
    const maxY = halfMapSize - viewHeight / 2;
    const minX = -maxX;
    const minY = -maxY;

    const clampedX = Math.max(minX, Math.min(maxX, pos.x));
    const clampedY = Math.max(minY, Math.min(maxY, pos.y));

    return new Vector2D(clampedX, clampedY);
}

/**
 * Calculate the minimum zoom level that keeps the camera within map bounds.
 * @param viewportWidthPx - Viewport width in screen pixels
 * @param viewportHeightPx - Viewport height in screen pixels
 * @returns Minimum zoom level
 */
export function getMinZoomForBounds(
    viewportWidthPx: number,
    viewportHeightPx: number
): number {
    const minZoomWidth = viewportWidthPx / Constants.MAP_SIZE;
    const minZoomHeight = viewportHeightPx / Constants.MAP_SIZE;
    return Math.max(0.5, minZoomWidth, minZoomHeight);
}
