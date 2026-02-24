/**
 * GlowRenderer
 * Provides glow, bloom and selection indicator rendering utilities
 * extracted from the GameRenderer class.
 *
 * Extracted from renderer.ts as part of Phase 9 refactoring
 */

import { withAlpha, darkenColor, adjustColorBrightness } from './color-utilities';

export interface GlowRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
}

type UnitGlowRenderCache = {
    texture: HTMLCanvasElement;
    radiusPx: number;
};

export class GlowRenderer {
    private readonly unitGlowRenderCache = new Map<string, UnitGlowRenderCache>();
    private readonly gradientCache = new Map<string, CanvasGradient>();

    private readonly UNIT_GLOW_ALPHA = 0.2;

    /**
     * Draw a fancy bloom glow effect at a screen position.
     */
    drawFancyBloom(
        screenPos: { x: number; y: number },
        radius: number,
        color: string,
        intensity: number,
        ctx: CanvasRenderingContext2D
    ): void {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, Math.min(1, intensity));
        ctx.shadowColor = color;
        ctx.shadowBlur = radius * 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw a cached glow halo around a unit using a pre-rendered texture.
     */
    drawCachedUnitGlow(
        screenPos: { x: number; y: number },
        radiusPx: number,
        color: string,
        alphaScale: number = 1,
        ctx: CanvasRenderingContext2D
    ): void {
        const clampedRadiusPx = Math.max(6, Math.round(radiusPx));
        const glowTexture = this.getOrCreateUnitGlowTexture(clampedRadiusPx, color);
        const drawSize = glowTexture.width;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, Math.min(1, this.UNIT_GLOW_ALPHA * alphaScale));
        ctx.drawImage(
            glowTexture,
            screenPos.x - drawSize * 0.5,
            screenPos.y - drawSize * 0.5,
            drawSize,
            drawSize
        );
        ctx.restore();
    }

    /**
     * Draw a colored aura behind a unit in LaD (Light and Dark) mode.
     */
    drawLadAura(
        screenPos: { x: number; y: number },
        radius: number,
        baseColor: string,
        unitSide: 'light' | 'dark',
        ctx: CanvasRenderingContext2D
    ): void {
        ctx.save();

        let adjustedColor = baseColor;
        if (unitSide === 'light') {
            adjustedColor = darkenColor(baseColor, 0.7);
        } else {
            adjustedColor = adjustColorBrightness(baseColor, 1.3);
        }

        const gradient = ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, radius * 1.8
        );
        gradient.addColorStop(0, adjustedColor + '80');
        gradient.addColorStop(0.5, adjustedColor + '60');
        gradient.addColorStop(0.8, adjustedColor + '30');
        gradient.addColorStop(1, adjustedColor + '00');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draw the universal unit/structure selection ring.
     */
    drawBuildingSelectionIndicator(
        screenPos: { x: number; y: number },
        radius: number,
        context: GlowRendererContext
    ): void {
        const { ctx, zoom } = context;

        const selectionRadius = radius + Math.max(2, zoom * 2.5);
        const ringThickness = Math.max(1.5, zoom * 1.8);

        const radiusBucket = Math.round(selectionRadius / 5) * 5;
        const thicknessBucket = Math.round(ringThickness * 10) / 10;
        const cacheKey = `building-selection-${radiusBucket}-${thicknessBucket}`;

        const innerR = Math.max(0, radiusBucket - thicknessBucket * 0.4);
        const outerR = radiusBucket + thicknessBucket * 2.4;

        const gradient = this.getCachedRadialGradient(
            ctx,
            cacheKey,
            0, 0, innerR,
            0, 0, outerR,
            [
                { offset: 0, color: 'rgba(255, 215, 0, 0.95)' },
                { offset: 0.6, color: 'rgba(255, 255, 255, 0.85)' },
                { offset: 1, color: 'rgba(255, 255, 255, 0)' }
            ]
        );

        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = thicknessBucket;
        ctx.beginPath();
        ctx.arc(0, 0, radiusBucket, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Get or create a cached radial gradient bound to the given canvas context.
     */
    getCachedRadialGradient(
        ctx: CanvasRenderingContext2D,
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{ offset: number; color: string }>
    ): CanvasGradient {
        const cached = this.gradientCache.get(key);
        if (cached) {
            return cached;
        }

        const gradient = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        this.gradientCache.set(key, gradient);
        return gradient;
    }

    private getOrCreateUnitGlowTexture(radiusPx: number, color: string): HTMLCanvasElement {
        const cacheKey = `${radiusPx}:${color}`;
        const cached = this.unitGlowRenderCache.get(cacheKey);
        if (cached) {
            return cached.texture;
        }

        const textureRadiusPx = Math.max(2, Math.round(radiusPx * 1.8));
        const textureSize = textureRadiusPx * 2;
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = textureSize;
        glowCanvas.height = textureSize;
        const glowCtx = glowCanvas.getContext('2d');

        if (!glowCtx) {
            return glowCanvas;
        }

        const gradient = glowCtx.createRadialGradient(
            textureRadiusPx, textureRadiusPx, 0,
            textureRadiusPx, textureRadiusPx, textureRadiusPx
        );
        gradient.addColorStop(0, withAlpha(color, 0.58));
        gradient.addColorStop(0.42, withAlpha(color, 0.22));
        gradient.addColorStop(1, withAlpha(color, 0));

        glowCtx.fillStyle = gradient;
        glowCtx.beginPath();
        glowCtx.arc(textureRadiusPx, textureRadiusPx, textureRadiusPx, 0, Math.PI * 2);
        glowCtx.fill();

        this.unitGlowRenderCache.set(cacheKey, { texture: glowCanvas, radiusPx });
        return glowCanvas;
    }
}
