/**
 * Shroud Cube Renderer
 * Renders Shroud hero cubes: main cubes, small cubes, and tiny cubes.
 * Cubes are drawn as dark rectangles when stopped (blocking sunlight)
 * and as glowing purple shapes when moving.
 */

import { Vector2D, GameState, ShroudCube } from '../game-core';

export interface ShroudRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    worldToScreen(worldPos: Vector2D): Vector2D;
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;
}

export class ShroudRenderer {
    /**
     * Draw all Shroud cubes (main cubes, small cubes, and tiny cubes).
     * Main cubes are drawn as solid dark squares when moving, transitioning to translucent when stopped.
     * Child cubes animate outward from the stopped position.
     */
    drawShroudCubes(game: GameState, context: ShroudRendererContext): void {
        const { ctx } = context;

        for (const cube of game.shroudCubes) {
            if (!context.isWithinViewBounds(cube.position, cube.halfSizePx * 6)) continue;

            const isStopped = cube.isStopped();
            this.drawShroudCubeRect(ctx, cube.position.x, cube.position.y, cube.halfSizePx, isStopped, 1.0, context);

            if (isStopped) {
                // Draw child small cubes
                for (const small of cube.smallCubes) {
                    const cx = small.currentX;
                    const cy = small.currentY;
                    const alpha = 0.85;
                    this.drawShroudCubeRect(ctx, cx, cy, small.halfSizePx, true, alpha, context);

                    // Draw tiny cubes
                    for (const tiny of small.tinyCubes) {
                        const tcx = tiny.startPos.x + (tiny.finalPos.x - tiny.startPos.x) * tiny.unfoldProgress;
                        const tcy = tiny.startPos.y + (tiny.finalPos.y - tiny.startPos.y) * tiny.unfoldProgress;
                        this.drawShroudCubeRect(ctx, tcx, tcy, tiny.halfSizePx, true, 0.7, context);
                    }
                }
            }
        }
    }

    private drawShroudCubeRect(
        ctx: CanvasRenderingContext2D,
        worldX: number,
        worldY: number,
        halfSizePx: number,
        isStopped: boolean,
        alpha: number,
        context: ShroudRendererContext
    ): void {
        const screenPos = context.worldToScreen(new Vector2D(worldX, worldY));
        const halfScreen = halfSizePx * context.zoom;

        ctx.save();
        ctx.globalAlpha = alpha;

        if (isStopped) {
            // Stopped cubes: dark semi-transparent fill with outline (blocks sunlight visually)
            ctx.fillStyle = 'rgba(20, 15, 35, 0.82)';
            ctx.strokeStyle = '#6633AA';
            ctx.lineWidth = Math.max(1, 1.5 * context.zoom);
        } else {
            // Moving cubes: glowing golden/purple look proportional to speed
            ctx.fillStyle = 'rgba(80, 40, 120, 0.9)';
            ctx.strokeStyle = '#CC88FF';
            ctx.lineWidth = Math.max(1, 2 * context.zoom);
        }

        ctx.fillRect(
            screenPos.x - halfScreen,
            screenPos.y - halfScreen,
            halfScreen * 2,
            halfScreen * 2
        );
        ctx.strokeRect(
            screenPos.x - halfScreen,
            screenPos.y - halfScreen,
            halfScreen * 2,
            halfScreen * 2
        );

        ctx.restore();
    }
}
