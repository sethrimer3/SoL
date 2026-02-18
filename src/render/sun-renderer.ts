/**
 * SunRenderer - Handles all sun-related rendering including sun bodies, rays, shadows, particles, and lens flares.
 * This class is responsible for drawing suns with their animated effects, volumetric shafts,
 * particle layers, shadow casting, and bloom effects.
 */

import { Sun, Vector2D, GameState, Asteroid } from '../game-core';
import * as Constants from '../constants';
import { ColorScheme } from '../menu';
import { renderLensFlare } from '../rendering/LensFlare';

// Type definitions for sun rendering
type SunRenderCache = {
    plasmaLayerA: HTMLCanvasElement;
    plasmaLayerB: HTMLCanvasElement;
    shaftTextureOuter: HTMLCanvasElement;
    shaftTextureInner: HTMLCanvasElement;
};

type UltraSunEmberStatic = {
    seed: number;
    speedOutward: number;
    outwardOffset: number;
    orbitAngle: number;
    swirlSeedPhase: number;
    swirlSpeed: number;
    swirlAmplitudeOffset: number;
    swirlAmplitudeScale: number;
    radiusTotalScale: number;
    arcBendSeedPhase: number;
    arcBendSpeed: number;
    arcBendAmplitudeOffset: number;
    arcBendAmplitudeScale: number;
    sizeTotal: number;
    alphaTotal: number;
    emberRed: number;
    emberGreen: number;
    emberBlue: number;
    glowTexture: HTMLCanvasElement;
    coreTexture: HTMLCanvasElement;
};

type UltraSunParticleCache = {
    emberStatics: UltraSunEmberStatic[];
};

type ShadowQuad = {
    sv1x: number;
    sv1y: number;
    sv2x: number;
    sv2y: number;
    ss1x: number;
    ss1y: number;
    ss2x: number;
    ss2y: number;
};

type ShaftGradientPair = {
    softEdge: CanvasGradient;
    spine: CanvasGradient;
};

export class SunRenderer {
    // Constants
    private readonly ULTRA_SUN_BLOOM_STEPS = 4;
    private readonly SHAFT_LENGTH_BUCKET_SIZE = 50;
    private readonly SHAFT_LAYER_OUTER = 'outer';
    private readonly SHAFT_LAYER_INNER = 'inner';
    private readonly ASTEROID_SHADOW_COLOR = 'rgba(13, 10, 25, 0.86)';
    
    // Caches
    private sunRenderCacheByRadiusBucket = new Map<number, SunRenderCache>();
    private ultraSunParticleCacheBySun = new WeakMap<Sun, UltraSunParticleCache>();
    private sunShadowQuadFrameCache = new WeakMap<Sun, ShadowQuad[]>();
    private sunShaftGradientCache = new Map<string, ShaftGradientPair>();
    private shadowGradientColorStops = new Map<string, string[]>();
    
    // Reusable coordinate vectors for performance
    private sunRayScreenPosA = new Vector2D(0, 0);
    private sunRayScreenPosB = new Vector2D(0, 0);
    private sunRayScreenPosC = new Vector2D(0, 0);
    private sunRayScreenPosD = new Vector2D(0, 0);
    private ultraSunScreenPos = new Vector2D(0, 0);
    
    /**
     * Draw a sun (main entry point)
     */
    public drawSun(
        ctx: CanvasRenderingContext2D,
        sun: Sun,
        screenPos: Vector2D,
        screenRadius: number,
        gameTimeSec: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        isFancyGraphicsEnabled: boolean,
        colorScheme: ColorScheme,
        sunSprite: HTMLImageElement | null,
        drawFancyBloom: (screenPos: Vector2D, radius: number, color: string, intensity: number) => void,
        withAlpha: (color: string, alpha: number) => string
    ): void {
        if (sun.type === 'lad') {
            this.drawLadSun(ctx, screenPos, screenRadius, withAlpha);
            return;
        }

        if (graphicsQuality === 'ultra') {
            this.drawUltraSun(
                ctx,
                screenPos,
                screenRadius,
                gameTimeSec,
                sun
            );
            return;
        }

        if (isFancyGraphicsEnabled) {
            const bloomRadius = screenRadius * 1.35;
            drawFancyBloom(screenPos, bloomRadius, colorScheme.sunGlow.outerGlow1, 0.7);
        }

        // Draw sun glow (outer glow)
        const gradient = ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, colorScheme.sunGlow.outerGlow1);
        gradient.addColorStop(0.5, colorScheme.sunGlow.outerGlow2);
        gradient.addColorStop(0.8, colorScheme.sunGlow.outerGlow3);
        gradient.addColorStop(1, colorScheme.sunGlow.outerGlow4);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        ctx.fill();

        if (sunSprite && sunSprite.complete && sunSprite.naturalWidth > 0) {
            const diameterPx = screenRadius * 2;
            ctx.drawImage(
                sunSprite,
                screenPos.x - screenRadius,
                screenPos.y - screenRadius,
                diameterPx,
                diameterPx
            );
            return;
        }

        // Stub fallback when no sprite is available.
        ctx.strokeStyle = colorScheme.sunGlow.outerGlow1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Draw ultra quality sun with animated plasma layers
     */
    private drawUltraSun(
        ctx: CanvasRenderingContext2D,
        screenPos: Vector2D,
        screenRadius: number,
        gameTimeSec: number,
        sun: Sun
    ): void {
        const sunRenderCache = this.getOrCreateSunRenderCache(screenRadius);
        const pulseAmount = 1 + Math.sin(gameTimeSec * 1.2) * 0.012;
        const corePulseAmount = 1 + Math.sin(gameTimeSec * (Math.PI * 2 / 5)) * 0.018;
        const microFlicker = 1 + Math.sin(gameTimeSec * 8.0 + sun.position.x * 0.01 + sun.position.y * 0.015) * 0.015;
        const animatedRadius = screenRadius * pulseAmount;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const corona = ctx.createRadialGradient(screenPos.x, screenPos.y, animatedRadius * 0.25, screenPos.x, screenPos.y, animatedRadius * 2.8);
        corona.addColorStop(0, 'rgba(255, 246, 210, 0.52)');
        corona.addColorStop(0.28, 'rgba(255, 207, 116, 0.35)');
        corona.addColorStop(1, 'rgba(255, 170, 90, 0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, animatedRadius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, animatedRadius, 0, Math.PI * 2);
        ctx.clip();

        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(gameTimeSec * 0.04);
        ctx.globalAlpha = 0.84 * microFlicker;
        ctx.drawImage(
            sunRenderCache.plasmaLayerA,
            -animatedRadius,
            -animatedRadius,
            animatedRadius * 2,
            animatedRadius * 2
        );
        ctx.restore();

        const driftX = Math.sin(gameTimeSec * 0.09) * animatedRadius * 0.09;
        const driftY = Math.cos(gameTimeSec * 0.07) * animatedRadius * 0.09;
        ctx.save();
        ctx.translate(screenPos.x + driftX, screenPos.y + driftY);
        ctx.rotate(-gameTimeSec * 0.032);
        ctx.globalAlpha = 0.66;
        ctx.drawImage(
            sunRenderCache.plasmaLayerB,
            -animatedRadius,
            -animatedRadius,
            animatedRadius * 2,
            animatedRadius * 2
        );
        ctx.restore();

        ctx.restore();

        const coreRadius = animatedRadius * 0.34 * corePulseAmount;
        const hardCore = ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, coreRadius);
        hardCore.addColorStop(0, 'rgba(255, 255, 255, 1)');
        hardCore.addColorStop(0.3, 'rgba(255, 255, 248, 0.98)');
        hardCore.addColorStop(0.68, 'rgba(255, 246, 206, 0.9)');
        hardCore.addColorStop(1, 'rgba(255, 236, 170, 0.14)');
        ctx.fillStyle = hardCore;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        const whiteDiscRadius = animatedRadius * 0.16 * corePulseAmount;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, whiteDiscRadius, 0, Math.PI * 2);
        ctx.fill();

        const surfaceGradient = ctx.createRadialGradient(screenPos.x, screenPos.y, animatedRadius * 0.15, screenPos.x, screenPos.y, animatedRadius);
        surfaceGradient.addColorStop(0, 'rgba(255, 247, 190, 0.6)');
        surfaceGradient.addColorStop(0.65, 'rgba(255, 180, 75, 0.42)');
        surfaceGradient.addColorStop(1, 'rgba(255, 124, 45, 0.2)');
        ctx.fillStyle = surfaceGradient;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, animatedRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        this.drawUltraSunBloom(ctx, screenPos, animatedRadius, 'ultra');
    }

    /**
     * Draw bloom layers around ultra sun
     */
    private drawUltraSunBloom(
        ctx: CanvasRenderingContext2D,
        screenPos: Vector2D,
        screenRadius: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        getCachedRadialGradient?: (
            cacheKey: string,
            x0: number, y0: number, r0: number,
            x1: number, y1: number, r1: number,
            colorStops: Array<{ offset: number; color: string }>
        ) => CanvasGradient
    ): void {
        // Skip expensive bloom rendering on low/medium quality
        if (graphicsQuality === 'low' || graphicsQuality === 'medium') {
            return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        for (let stepIndex = 0; stepIndex < this.ULTRA_SUN_BLOOM_STEPS; stepIndex++) {
            const stepT = stepIndex / Math.max(1, this.ULTRA_SUN_BLOOM_STEPS - 1);
            const radius = screenRadius * (1.15 + stepT * 2.65);
            const alpha = 0.2 * (1 - stepT);
            
            // Quantize radius for caching - use for both gradient and drawing
            const radiusBucket = Math.round(radius / 16) * 16;
            const innerRadius = radiusBucket * 0.22;
            
            let bloom: CanvasGradient;
            if (getCachedRadialGradient) {
                const cacheKey = `ultra-sun-bloom-${radiusBucket}-${stepIndex}`;
                bloom = getCachedRadialGradient(
                    cacheKey,
                    0, 0, innerRadius,
                    0, 0, radiusBucket,
                    [
                        { offset: 0, color: `rgba(255, 250, 225, ${Math.min(0.5, alpha * 2.2).toFixed(4)})` },
                        { offset: 0.45, color: `rgba(255, 200, 115, ${alpha.toFixed(4)})` },
                        { offset: 1, color: 'rgba(255, 140, 70, 0)' }
                    ]
                );
            } else {
                bloom = ctx.createRadialGradient(
                    screenPos.x, screenPos.y, innerRadius,
                    screenPos.x, screenPos.y, radiusBucket
                );
                bloom.addColorStop(0, `rgba(255, 250, 225, ${Math.min(0.5, alpha * 2.2).toFixed(4)})`);
                bloom.addColorStop(0.45, `rgba(255, 200, 115, ${alpha.toFixed(4)})`);
                bloom.addColorStop(1, 'rgba(255, 140, 70, 0)');
            }
            
            ctx.save();
            ctx.translate(screenPos.x, screenPos.y);
            ctx.fillStyle = bloom;
            ctx.beginPath();
            ctx.arc(0, 0, radiusBucket, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Horizontal stretch gradient
        ctx.globalAlpha = 0.23;
        const stretchRadiusBucket = Math.round(screenRadius * 2.9 / 16) * 16;
        const stretchMinorAxis = Math.round(screenRadius * 1.85 / 16) * 16;
        
        let horizontalStretch: CanvasGradient;
        if (getCachedRadialGradient) {
            const stretchCacheKey = `ultra-sun-bloom-stretch-${stretchRadiusBucket}-${stretchMinorAxis}`;
            horizontalStretch = getCachedRadialGradient(
                stretchCacheKey,
                0, 0, stretchRadiusBucket * (0.3 / 2.9),
                0, 0, stretchRadiusBucket,
                [
                    { offset: 0, color: 'rgba(255, 242, 186, 0.42)' },
                    { offset: 0.4, color: 'rgba(255, 212, 120, 0.18)' },
                    { offset: 1, color: 'rgba(255, 170, 95, 0)' }
                ]
            );
        } else {
            horizontalStretch = ctx.createRadialGradient(
                screenPos.x, screenPos.y, stretchRadiusBucket * (0.3 / 2.9),
                screenPos.x, screenPos.y, stretchRadiusBucket
            );
            horizontalStretch.addColorStop(0, 'rgba(255, 242, 186, 0.42)');
            horizontalStretch.addColorStop(0.4, 'rgba(255, 212, 120, 0.18)');
            horizontalStretch.addColorStop(1, 'rgba(255, 170, 95, 0)');
        }
        
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.beginPath();
        ctx.ellipse(0, 0, stretchRadiusBucket, stretchMinorAxis, 0, 0, Math.PI * 2);
        ctx.fillStyle = horizontalStretch;
        ctx.fill();
        ctx.restore();
        
        ctx.restore();
    }

    /**
     * Get or create cached sun render textures (plasma layers and shaft textures)
     */
    private getOrCreateSunRenderCache(
        screenRadius: number,
        hashNormalized?: (inputValue: number) => number,
        hashSigned?: (inputValue: number) => number
    ): SunRenderCache {
        const radiusBucket = Math.max(48, Math.round(screenRadius / 16) * 16);
        const existingCache = this.sunRenderCacheByRadiusBucket.get(radiusBucket);
        if (existingCache) {
            return existingCache;
        }

        // Use simple fallback hash functions if not provided
        const defaultHashNormalized = (v: number) => (Math.abs(Math.sin(v * 12.9898 + 78.233) * 43758.5453) % 1);
        const defaultHashSigned = (v: number) => defaultHashNormalized(v) * 2 - 1;
        const hashNorm = hashNormalized || defaultHashNormalized;
        const hashSign = hashSigned || defaultHashSigned;

        const textureSize = Math.max(128, radiusBucket * 2);
        const buildPlasmaLayer = (seedOffset: number): HTMLCanvasElement => {
            const textureCanvas = document.createElement('canvas');
            textureCanvas.width = textureSize;
            textureCanvas.height = textureSize;
            const textureContext = textureCanvas.getContext('2d');
            if (!textureContext) {
                return textureCanvas;
            }

            const imageData = textureContext.createImageData(textureSize, textureSize);
            const pixelData = imageData.data;
            const center = textureSize * 0.5;
            const invSize = 1 / textureSize;
            for (let y = 0; y < textureSize; y++) {
                for (let x = 0; x < textureSize; x++) {
                    const dx = (x - center) * invSize;
                    const dy = (y - center) * invSize;
                    const radialDistance = Math.sqrt(dx * dx + dy * dy);
                    const radialFalloff = Math.max(0, 1 - radialDistance * 2.0);
                    const n1 = hashNorm((x + seedOffset * 17.0) * 0.093 + (y + seedOffset * 13.0) * 0.061);
                    const n2 = hashNorm((x - seedOffset * 19.0) * 0.143 + (y - seedOffset * 11.0) * 0.109);
                    const plasma = Math.max(0, Math.min(1, n1 * 0.6 + n2 * 0.4));
                    const brightness = Math.pow(radialFalloff, 0.72) * (0.62 + plasma * 0.68);
                    const pixelIndex = (y * textureSize + x) * 4;
                    pixelData[pixelIndex + 0] = Math.min(255, 255 * (0.96 + brightness * 0.04));
                    pixelData[pixelIndex + 1] = Math.min(255, 145 + brightness * 110);
                    pixelData[pixelIndex + 2] = Math.min(255, 38 + brightness * 70);
                    pixelData[pixelIndex + 3] = Math.floor(255 * Math.max(0, radialFalloff));
                }
            }

            textureContext.putImageData(imageData, 0, 0);
            textureContext.globalCompositeOperation = 'lighter';
            const whiteCore = textureContext.createRadialGradient(center, center, 0, center, center, textureSize * 0.24);
            whiteCore.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            whiteCore.addColorStop(1, 'rgba(255, 255, 255, 0)');
            textureContext.fillStyle = whiteCore;
            textureContext.beginPath();
            textureContext.arc(center, center, textureSize * 0.24, 0, Math.PI * 2);
            textureContext.fill();
            return textureCanvas;
        };

        const buildShaftTexture = (isOuterLayer: boolean): HTMLCanvasElement => {
            const shaftTexture = document.createElement('canvas');
            shaftTexture.width = 1024;
            shaftTexture.height = 1024;
            const shaftContext = shaftTexture.getContext('2d');
            if (!shaftContext) {
                return shaftTexture;
            }

            const shaftCenterX = shaftTexture.width / 2;
            const shaftCenterY = shaftTexture.height / 2;
            shaftContext.translate(shaftCenterX, shaftCenterY);
            shaftContext.globalCompositeOperation = 'lighter';
            const shaftCount = isOuterLayer ? 32 : 20;
            
            for (let shaftIndex = 0; shaftIndex < shaftCount; shaftIndex++) {
                const angle = (Math.PI * 2 * shaftIndex) / shaftCount + hashSign(shaftIndex * 7.1 + (isOuterLayer ? 3 : 11)) * 0.09;
                const shaftLength = (isOuterLayer ? 430 : 320) + hashNorm(shaftIndex * 17.9) * (isOuterLayer ? 300 : 220);
                const shaftWidth = (isOuterLayer ? 22 : 16) + hashNorm(shaftIndex * 9.3 + 4.7) * (isOuterLayer ? 48 : 26);
                
                // Bucket shaft length to reduce unique gradients using named constant
                const lengthBucket = Math.round(shaftLength / this.SHAFT_LENGTH_BUCKET_SIZE) * this.SHAFT_LENGTH_BUCKET_SIZE;
                
                // Create string-based cache key to avoid numeric collisions
                const layerType = isOuterLayer ? this.SHAFT_LAYER_OUTER : this.SHAFT_LAYER_INNER;
                const cacheKey = `${lengthBucket}-${layerType}`;
                
                let gradients = this.sunShaftGradientCache.get(cacheKey);
                if (!gradients) {
                    const softEdgeGradient = shaftContext.createLinearGradient(0, 0, lengthBucket, 0);
                    softEdgeGradient.addColorStop(0, isOuterLayer ? 'rgba(255, 178, 26, 0.42)' : 'rgba(255, 163, 26, 0.48)');
                    softEdgeGradient.addColorStop(0.16, isOuterLayer ? 'rgba(255, 138, 20, 0.4)' : 'rgba(255, 116, 18, 0.42)');
                    softEdgeGradient.addColorStop(0.46, isOuterLayer ? 'rgba(242, 92, 15, 0.28)' : 'rgba(217, 71, 12, 0.3)');
                    softEdgeGradient.addColorStop(0.78, 'rgba(183, 55, 10, 0.14)');
                    softEdgeGradient.addColorStop(1, 'rgba(183, 55, 10, 0)');
                    
                    const spineGradient = shaftContext.createLinearGradient(0, 0, lengthBucket * 0.92, 0);
                    spineGradient.addColorStop(0, isOuterLayer ? 'rgba(255, 178, 26, 0.46)' : 'rgba(255, 178, 26, 0.56)');
                    spineGradient.addColorStop(0.25, isOuterLayer ? 'rgba(255, 163, 26, 0.42)' : 'rgba(255, 163, 26, 0.48)');
                    spineGradient.addColorStop(0.58, isOuterLayer ? 'rgba(255, 116, 18, 0.3)' : 'rgba(242, 92, 15, 0.36)');
                    spineGradient.addColorStop(1, 'rgba(217, 71, 12, 0)');
                    
                    gradients = { softEdge: softEdgeGradient, spine: spineGradient };
                    this.sunShaftGradientCache.set(cacheKey, gradients);
                }
                
                shaftContext.save();
                shaftContext.rotate(angle);

                shaftContext.fillStyle = gradients.softEdge;
                shaftContext.beginPath();
                shaftContext.ellipse(shaftLength * 0.5, 0, shaftLength * 0.52, shaftWidth * 0.5, 0, 0, Math.PI * 2);
                shaftContext.fill();

                shaftContext.fillStyle = gradients.spine;
                shaftContext.beginPath();
                shaftContext.ellipse(shaftLength * 0.45, 0, shaftLength * 0.47, Math.max(2, shaftWidth * 0.13), 0, 0, Math.PI * 2);
                shaftContext.fill();

                shaftContext.restore();
            }

            return shaftTexture;
        };

        const generatedCache: SunRenderCache = {
            plasmaLayerA: buildPlasmaLayer(1),
            plasmaLayerB: buildPlasmaLayer(2),
            shaftTextureOuter: buildShaftTexture(true),
            shaftTextureInner: buildShaftTexture(false)
        };
        this.sunRenderCacheByRadiusBucket.set(radiusBucket, generatedCache);
        return generatedCache;
    }

    /**
     * Draw Light and Dark (LaD) split sun
     */
    private drawLadSun(
        ctx: CanvasRenderingContext2D,
        screenPos: Vector2D,
        screenRadius: number,
        withAlpha: (color: string, alpha: number) => string
    ): void {
        // Save context state
        ctx.save();

        // Draw left half (white)
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = withAlpha('#0D0A19', 0.55);
        ctx.fillRect(screenPos.x - screenRadius, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context to draw right half
        ctx.restore();
        ctx.save();

        // Draw right half (black)
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = this.ASTEROID_SHADOW_COLOR;
        ctx.fillRect(screenPos.x, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context
        ctx.restore();

        // Draw dividing line between light and dark
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y - screenRadius);
        ctx.lineTo(screenPos.x, screenPos.y + screenRadius);
        ctx.stroke();

        // Draw circle outline around the sun
        ctx.strokeStyle = Constants.LAD_SUN_OUTLINE_COLOR;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Draw cinematic lens flare for visible suns in screen space
     */
    public drawLensFlare(
        ctx: CanvasRenderingContext2D,
        sun: Sun,
        screenPos: Vector2D,
        screenRadius: number,
        canvasWidth: number,
        canvasHeight: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
    ): void {
        // Skip lens flare on low/medium quality for performance
        if (graphicsQuality === 'low' || graphicsQuality === 'medium') {
            return;
        }

        const maxDistance = Math.hypot(canvasWidth * 0.5, canvasHeight * 0.5);
        const distanceFromCenter = Math.hypot(screenPos.x - canvasWidth * 0.5, screenPos.y - canvasHeight * 0.5);

        // Skip expensive flare work when the sun is far outside the viewport envelope.
        if (distanceFromCenter > maxDistance + screenRadius * 2) {
            return;
        }

        renderLensFlare(ctx, screenPos.x, screenPos.y, screenRadius, canvasWidth, canvasHeight);
    }

    /**
     * Append shadow quads from vertices for shadow casting
     */
    private appendShadowQuadsFromVertices(
        sun: Sun,
        worldVertices: Vector2D[],
        quads: ShadowQuad[],
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void
    ): void {
        const sunX = sun.position.x;
        const sunY = sun.position.y;
        const vertexCount = worldVertices.length;
        const sv1 = this.sunRayScreenPosA;
        const sv2 = this.sunRayScreenPosB;
        const ss1 = this.sunRayScreenPosC;
        const ss2 = this.sunRayScreenPosD;

        for (let i = 0; i < vertexCount; i++) {
            const v1 = worldVertices[i];
            const v2 = worldVertices[(i + 1) % vertexCount];
            const edgeCenterX = (v1.x + v2.x) * 0.5;
            const edgeCenterY = (v1.y + v2.y) * 0.5;
            const toSunX = sunX - edgeCenterX;
            const toSunY = sunY - edgeCenterY;
            const edgeNormalX = -(v2.y - v1.y);
            const edgeNormalY = v2.x - v1.x;
            const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

            if (dot >= 0) {
                continue;
            }

            const dirFromSun1X = v1.x - sunX;
            const dirFromSun1Y = v1.y - sunY;
            const dirFromSun2X = v2.x - sunX;
            const dirFromSun2Y = v2.y - sunY;
            const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
            const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
            const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
            const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
            const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
            const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
            const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
            const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

            worldToScreenCoords(v1.x, v1.y, sv1);
            worldToScreenCoords(v2.x, v2.y, sv2);
            worldToScreenCoords(shadow1X, shadow1Y, ss1);
            worldToScreenCoords(shadow2X, shadow2Y, ss2);

            quads.push({
                sv1x: sv1.x,
                sv1y: sv1.y,
                sv2x: sv2.x,
                sv2y: sv2.y,
                ss1x: ss1.x,
                ss1y: ss1.y,
                ss2x: ss2.x,
                ss2y: ss2.y,
            });
        }
    }

    /**
     * Build sun shadow quads for all asteroids
     */
    private buildSunShadowQuads(
        sun: Sun,
        game: GameState,
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void
    ): ShadowQuad[] {
        const quads: ShadowQuad[] = [];

        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            this.appendShadowQuadsFromVertices(sun, worldVertices, quads, worldToScreenCoords);
        }

        return quads;
    }

    /**
     * Get cached sun shadow quads
     */
    public getSunShadowQuadsCached(
        sun: Sun,
        game: GameState,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void
    ): ShadowQuad[] {
        // Skip shadow calculations entirely on low quality for performance
        if (graphicsQuality === 'low') {
            return [];
        }

        const cached = this.sunShadowQuadFrameCache.get(sun);
        if (cached) {
            return cached;
        }

        const generated = this.buildSunShadowQuads(sun, game, worldToScreenCoords);
        this.sunShadowQuadFrameCache.set(sun, generated);
        return generated;
    }

    /**
     * Draw sun rays with raytracing (brightens field and casts shadows)
     */
    public drawSunRays(
        ctx: CanvasRenderingContext2D,
        game: GameState,
        canvasWidth: number,
        canvasHeight: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        isFancyGraphicsEnabled: boolean,
        worldToScreen: (worldPos: Vector2D) => Vector2D,
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void,
        isWithinViewBounds: (worldPos: Vector2D, margin: number) => boolean,
        getCachedRadialGradient: (
            cacheKey: string,
            x0: number, y0: number, r0: number,
            x1: number, y1: number, r1: number,
            colorStops: Array<{ offset: number; color: string }>
        ) => CanvasGradient,
        ensureLightingLayer: () => CanvasRenderingContext2D,
        ensureLightingSunPassLayer: () => CanvasRenderingContext2D,
        lightingLayerCanvas: HTMLCanvasElement,
        sunRayRadiusBucketSize: number,
        sunRayBloomRadiusMultiplier: number
    ): void {
        // Check if we have a LaD sun for special rendering
        const ladSun = game.suns.find(s => s.type === 'lad');
        
        if (ladSun) {
            this.drawLadSunRays(ctx, game, ladSun, worldToScreen, worldToScreenCoords, isWithinViewBounds, canvasWidth, canvasHeight);
        } else {
            this.drawNormalSunRays(
                ctx,
                game,
                canvasWidth,
                canvasHeight,
                graphicsQuality,
                isFancyGraphicsEnabled,
                worldToScreen,
                worldToScreenCoords,
                getCachedRadialGradient,
                ensureLightingLayer,
                ensureLightingSunPassLayer,
                lightingLayerCanvas,
                sunRayRadiusBucketSize,
                sunRayBloomRadiusMultiplier
            );
        }
    }

    /**
     * Draw normal sun rays (not LaD)
     */
    private drawNormalSunRays(
        targetCtx: CanvasRenderingContext2D,
        game: GameState,
        canvasWidth: number,
        canvasHeight: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        isFancyGraphicsEnabled: boolean,
        worldToScreen: (worldPos: Vector2D) => Vector2D,
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void,
        getCachedRadialGradient: (
            cacheKey: string,
            x0: number, y0: number, r0: number,
            x1: number, y1: number, r1: number,
            colorStops: Array<{ offset: number; color: string }>
        ) => CanvasGradient,
        ensureLightingLayer: () => CanvasRenderingContext2D,
        ensureLightingSunPassLayer: () => CanvasRenderingContext2D,
        lightingLayerCanvas: HTMLCanvasElement,
        sunRayRadiusBucketSize: number,
        sunRayBloomRadiusMultiplier: number
    ): void {
        const lightingCtx = ensureLightingLayer();

        // Draw ambient lighting layers for each sun (brighter closer to sun)
        for (const sun of game.suns) {
            const sunPassCtx = ensureLightingSunPassLayer();

            const sunScreenPos = worldToScreen(sun.position);
            const maxRadius = Math.max(canvasWidth, canvasHeight) * 2;
            const shadowQuads = this.getSunShadowQuadsCached(sun, game, graphicsQuality, worldToScreenCoords);

            // Create cached radial gradient centered on the sun using named constant for bucket size
            const radiusBucket = Math.round(maxRadius / sunRayRadiusBucketSize) * sunRayRadiusBucketSize;
            const cacheKey = `sun-ray-ambient-${radiusBucket}`;
            const gradient = getCachedRadialGradient(
                cacheKey,
                0, 0, 0,
                0, 0, radiusBucket,
                [
                    { offset: 0, color: 'rgba(255, 192, 96, 0.42)' },
                    { offset: 0.18, color: 'rgba(255, 166, 70, 0.28)' },
                    { offset: 0.42, color: 'rgba(255, 140, 56, 0.16)' },
                    { offset: 1, color: 'rgba(255, 120, 45, 0)' }
                ]
            );

            sunPassCtx.save();
            sunPassCtx.translate(sunScreenPos.x, sunScreenPos.y);

            sunPassCtx.fillStyle = gradient;
            sunPassCtx.fillRect(-sunScreenPos.x, -sunScreenPos.y, canvasWidth, canvasHeight);
            sunPassCtx.restore();

            if (isFancyGraphicsEnabled) {
                const bloomRadiusBucket = Math.round((maxRadius * sunRayBloomRadiusMultiplier) / sunRayRadiusBucketSize) * sunRayRadiusBucketSize;
                const bloomCacheKey = `sun-ray-bloom-${bloomRadiusBucket}`;
                const bloomGradient = getCachedRadialGradient(
                    bloomCacheKey,
                    0, 0, 0,
                    0, 0, bloomRadiusBucket,
                    [
                        { offset: 0, color: 'rgba(255, 232, 178, 0.68)' },
                        { offset: 0.16, color: 'rgba(255, 190, 104, 0.44)' },
                        { offset: 0.38, color: 'rgba(255, 146, 74, 0.24)' },
                        { offset: 1, color: 'rgba(255, 122, 58, 0)' }
                    ]
                );
                sunPassCtx.save();
                sunPassCtx.translate(sunScreenPos.x, sunScreenPos.y);
                sunPassCtx.globalCompositeOperation = 'screen';
                sunPassCtx.fillStyle = bloomGradient;
                sunPassCtx.fillRect(-sunScreenPos.x, -sunScreenPos.y, canvasWidth, canvasHeight);
                sunPassCtx.restore();
            }

            if (graphicsQuality === 'ultra') {
                this.drawUltraVolumetricShafts(sunPassCtx, sun, game.gameTime, shadowQuads, worldToScreen);
            }

            if (shadowQuads.length > 0) {
                // Cut out any area occluded from this sun so the background remains visible through shadows.
                sunPassCtx.save();
                sunPassCtx.globalCompositeOperation = 'destination-out';
                sunPassCtx.fillStyle = 'rgba(0, 0, 0, 1)';
                for (const quad of shadowQuads) {
                    sunPassCtx.beginPath();
                    sunPassCtx.moveTo(quad.sv1x, quad.sv1y);
                    sunPassCtx.lineTo(quad.sv2x, quad.sv2y);
                    sunPassCtx.lineTo(quad.ss2x, quad.ss2y);
                    sunPassCtx.lineTo(quad.ss1x, quad.ss1y);
                    sunPassCtx.closePath();
                    sunPassCtx.fill();
                }
                sunPassCtx.restore();
            }

            lightingCtx.save();
            lightingCtx.globalCompositeOperation = 'lighter';
            const sunPassCanvas = sunPassCtx.canvas;
            lightingCtx.drawImage(sunPassCanvas, 0, 0);
            lightingCtx.restore();
        }

        targetCtx.drawImage(lightingLayerCanvas, 0, 0);
    }

    /**
     * Draw ultra quality volumetric shafts
     */
    private drawUltraVolumetricShafts(
        ctx: CanvasRenderingContext2D,
        sun: Sun,
        gameTimeSec: number,
        shadowQuads: ShadowQuad[],
        worldToScreen: (worldPos: Vector2D) => Vector2D
    ): void {
        const sunScreenPos = worldToScreen(sun.position);
        const screenRadius = sun.radius; // Assumed to be already in screen space or needs zoom multiplier
        const sunRenderCache = this.getOrCreateSunRenderCache(screenRadius);
        const shaftScale = 1.95 + Math.sin(gameTimeSec * 0.07) * 0.03;
        const shimmerAlpha = 0.08 + (Math.sin(gameTimeSec * 0.62 + sun.position.x * 0.003) + 1) * 0.04;

        ctx.save();
        ctx.translate(sunScreenPos.x, sunScreenPos.y);
        ctx.rotate(gameTimeSec * 0.01 + Math.sin(gameTimeSec * 0.05) * 0.015);
        ctx.globalCompositeOperation = 'lighter';
        // Reduce blur on non-ultra quality settings for performance
        const blurAmount = 'blur(11px)';
        ctx.filter = blurAmount;
        ctx.globalAlpha = 0.4;
        const shaftSize = 1024 * shaftScale;
        ctx.drawImage(sunRenderCache.shaftTextureOuter, -shaftSize / 2, -shaftSize / 2, shaftSize, shaftSize);

        ctx.rotate(-gameTimeSec * 0.017);
        ctx.globalAlpha = Math.min(0.4, 0.32 + shimmerAlpha);
        const innerSize = shaftSize * 0.72;
        ctx.drawImage(sunRenderCache.shaftTextureInner, -innerSize / 2, -innerSize / 2, innerSize, innerSize);

        ctx.restore();

        if (shadowQuads.length === 0) {
            return;
        }

        // Remove shafts inside asteroid shade to prevent ultra shafts leaking through occlusion.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        for (const quad of shadowQuads) {
            ctx.beginPath();
            ctx.moveTo(quad.sv1x, quad.sv1y);
            ctx.lineTo(quad.sv2x, quad.sv2y);
            ctx.lineTo(quad.ss2x, quad.ss2y);
            ctx.lineTo(quad.ss1x, quad.ss1y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * Draw LaD sun rays (split lighting)
     */
    private drawLadSunRays(
        ctx: CanvasRenderingContext2D,
        game: GameState,
        sun: Sun,
        worldToScreen: (worldPos: Vector2D) => Vector2D,
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void,
        isWithinViewBounds: (worldPos: Vector2D, margin: number) => boolean,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        const sunScreenPos = worldToScreen(sun.position);
        
        // Draw left half (white light)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, sunScreenPos.x, canvasHeight);
        ctx.clip();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
        
        // Draw right half (black "light")
        ctx.save();
        ctx.beginPath();
        ctx.rect(sunScreenPos.x, 0, canvasWidth - sunScreenPos.x, canvasHeight);
        ctx.clip();
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
        
        // Draw asteroid shadows - dark shadows on left (white) side, light shadows on right (dark) side.
        // Each quad uses a directional gradient so shadow strength naturally fades with distance.
        ctx.save();
        const sunX = sun.position.x;
        const sunY = sun.position.y;
        const sv1 = this.sunRayScreenPosA;
        const sv2 = this.sunRayScreenPosB;
        const ss1 = this.sunRayScreenPosC;
        const ss2 = this.sunRayScreenPosD;

        // Add viewport culling margin for shadows
        const shadowViewportMargin = 300; // Shadows can extend beyond asteroids
        
        for (const asteroid of game.asteroids) {
            // Skip off-screen asteroids
            if (!isWithinViewBounds(asteroid.position, shadowViewportMargin)) {
                continue;
            }
            
            const worldVertices = asteroid.getWorldVertices();
            const vertexCount = worldVertices.length;

            // For each edge of the asteroid, cast a shadow
            for (let i = 0; i < vertexCount; i++) {
                const v1 = worldVertices[i];
                const v2 = worldVertices[(i + 1) % vertexCount];

                // Calculate if this edge faces away from the sun
                const edgeCenterX = (v1.x + v2.x) * 0.5;
                const edgeCenterY = (v1.y + v2.y) * 0.5;
                const toSunX = sunX - edgeCenterX;
                const toSunY = sunY - edgeCenterY;
                const edgeNormalX = -(v2.y - v1.y);
                const edgeNormalY = v2.x - v1.x;
                const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

                if (dot < 0) {
                    // This edge is facing away from the sun, cast shadow
                    const dirFromSun1X = v1.x - sunX;
                    const dirFromSun1Y = v1.y - sunY;
                    const dirFromSun2X = v2.x - sunX;
                    const dirFromSun2Y = v2.y - sunY;
                    const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
                    const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
                    const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
                    const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
                    const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
                    const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
                    const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
                    const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

                    // Determine which side of the field the shadow is on
                    const shadowCenterX = (shadow1X + shadow2X) * 0.5;
                    const isOnLightSide = shadowCenterX < sunX;

                    if (isOnLightSide) {
                        worldToScreenCoords(v1.x, v1.y, sv1);
                        worldToScreenCoords(v2.x, v2.y, sv2);
                        worldToScreenCoords(shadow1X, shadow1Y, ss1);
                        worldToScreenCoords(shadow2X, shadow2Y, ss2);

                        this.fillSoftShadowQuad(ctx, sv1, sv2, ss2, ss1, 'rgb(0, 0, 0)', 0.38, 0.14);
                    }
                }
            }
        }
        ctx.restore();

        ctx.save();

        for (const asteroid of game.asteroids) {
            // Skip off-screen asteroids (use same culling margin)
            if (!isWithinViewBounds(asteroid.position, shadowViewportMargin)) {
                continue;
            }
            
            const worldVertices = asteroid.getWorldVertices();
            const vertexCount = worldVertices.length;

            // For each edge of the asteroid, cast a shadow
            for (let i = 0; i < vertexCount; i++) {
                const v1 = worldVertices[i];
                const v2 = worldVertices[(i + 1) % vertexCount];

                // Calculate if this edge faces away from the sun
                const edgeCenterX = (v1.x + v2.x) * 0.5;
                const edgeCenterY = (v1.y + v2.y) * 0.5;
                const toSunX = sunX - edgeCenterX;
                const toSunY = sunY - edgeCenterY;
                const edgeNormalX = -(v2.y - v1.y);
                const edgeNormalY = v2.x - v1.x;
                const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

                if (dot < 0) {
                    // This edge is facing away from the sun, cast shadow
                    const dirFromSun1X = v1.x - sunX;
                    const dirFromSun1Y = v1.y - sunY;
                    const dirFromSun2X = v2.x - sunX;
                    const dirFromSun2Y = v2.y - sunY;
                    const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
                    const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
                    const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
                    const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
                    const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
                    const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
                    const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
                    const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

                    // Determine which side of the field the shadow is on
                    const shadowCenterX = (shadow1X + shadow2X) * 0.5;
                    const isOnLightSide = shadowCenterX < sunX;

                    if (!isOnLightSide) {
                        worldToScreenCoords(v1.x, v1.y, sv1);
                        worldToScreenCoords(v2.x, v2.y, sv2);
                        worldToScreenCoords(shadow1X, shadow1Y, ss1);
                        worldToScreenCoords(shadow2X, shadow2Y, ss2);

                        this.fillSoftShadowQuad(ctx, sv1, sv2, ss2, ss1, 'rgb(255, 255, 255)', 0.36, 0.13);
                    }
                }
            }
        }
        ctx.restore();
    }

    /**
     * Fill a shadow quad with gradient fading
     */
    private fillSoftShadowQuad(
        ctx: CanvasRenderingContext2D,
        nearA: { x: number; y: number },
        nearB: { x: number; y: number },
        farA: { x: number; y: number },
        farB: { x: number; y: number },
        color: string,
        nearAlpha: number,
        midAlpha: number
    ): void {
        const nearMidX = (nearA.x + nearB.x) * 0.5;
        const nearMidY = (nearA.y + nearB.y) * 0.5;
        const farMidX = (farA.x + farB.x) * 0.5;
        const farMidY = (farA.y + farB.y) * 0.5;

        // Cache key based on alpha values and color (gradient parameters)
        // Length varies but alpha composition is consistent
        const gradientKey = `shadow-gradient-${color}-${nearAlpha}-${midAlpha}`;
        
        // Check if we have the color stop configuration cached
        let colorStops = this.shadowGradientColorStops.get(gradientKey);
        if (!colorStops) {
            const rgbaPrefix = color.replace('rgb(', 'rgba(').slice(0, -1);
            colorStops = [
                `${rgbaPrefix}, ${nearAlpha})`,
                `${rgbaPrefix}, ${midAlpha})`,
                `${rgbaPrefix}, 0)`
            ];
            this.shadowGradientColorStops.set(gradientKey, colorStops);
        }
        
        // Create gradient at actual position (avoids complex transforms)
        const gradient = ctx.createLinearGradient(nearMidX, nearMidY, farMidX, farMidY);
        gradient.addColorStop(0, colorStops[0]);
        gradient.addColorStop(0.6, colorStops[1]);
        gradient.addColorStop(1, colorStops[2]);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(nearA.x, nearA.y);
        ctx.lineTo(nearB.x, nearB.y);
        ctx.lineTo(farA.x, farA.y);
        ctx.lineTo(farB.x, farB.y);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw ultra sun particle layers (embers and light dust)
     */
    public drawUltraSunParticleLayers(
        ctx: CanvasRenderingContext2D,
        game: GameState,
        zoom: number,
        canvasWidth: number,
        canvasHeight: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        worldToScreenCoords: (worldX: number, worldY: number, out: Vector2D) => void,
        getOrCreateUltraSunParticleCache: (sun: Sun) => UltraSunParticleCache,
        getOrCreateUltraLightDustStatics: () => UltraLightDustStatic[]
    ): void {
        // Only render ultra sun particle layers on ultra quality setting
        if (graphicsQuality !== 'ultra') {
            return;
        }

        if (game.suns.length === 0) {
            return;
        }

        const gameTimeSec = game.gameTime;
        const dpr = window.devicePixelRatio || 1;
        const viewportWidth = canvasWidth / dpr;
        const viewportHeight = canvasHeight / dpr;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const sun of game.suns) {
            if (sun.type === 'lad') {
                continue;
            }

            const particleCache = getOrCreateUltraSunParticleCache(sun);

            worldToScreenCoords(sun.position.x, sun.position.y, this.ultraSunScreenPos);
            const sunScreenPos = this.ultraSunScreenPos;
            const screenRadius = sun.radius * zoom;

            for (const ember of particleCache.emberStatics) {
                const outwardT = (gameTimeSec * ember.speedOutward + ember.outwardOffset) % 1;
                const swirl = Math.sin(gameTimeSec * ember.swirlSpeed + ember.swirlSeedPhase + outwardT * 8.4)
                    * (ember.swirlAmplitudeOffset + outwardT * ember.swirlAmplitudeScale);
                const curveAngle = ember.orbitAngle + swirl;
                const radius = screenRadius * (0.35 + outwardT * ember.radiusTotalScale);
                const arcBend = Math.sin(gameTimeSec * ember.arcBendSpeed + ember.arcBendSeedPhase)
                    * screenRadius * (ember.arcBendAmplitudeOffset + outwardT * ember.arcBendAmplitudeScale);
                const curveSin = Math.sin(curveAngle);
                const curveCos = Math.cos(curveAngle);
                const tangentX = -curveSin;
                const tangentY = curveCos;
                const x = sunScreenPos.x + curveCos * radius + tangentX * arcBend;
                const y = sunScreenPos.y + curveSin * radius + tangentY * arcBend;
                const size = ember.sizeTotal * (1 - outwardT * 0.2);
                const fadeIn = Math.min(1, outwardT * 6);
                const fadeOut = Math.max(0, 1 - outwardT);
                const alpha = ember.alphaTotal * fadeIn * fadeOut * fadeOut;

                const glowRadius = size * zoom * 1.4;
                const emberBoundsRadius = glowRadius * 2.4;
                if (
                    x + emberBoundsRadius < 0
                    || x - emberBoundsRadius > viewportWidth
                    || y + emberBoundsRadius < 0
                    || y - emberBoundsRadius > viewportHeight
                ) {
                    continue;
                }

                this.drawUltraSunEmber(ctx, x, y, glowRadius, alpha, ember.glowTexture, ember.coreTexture);
            }
        }

        const dustStatics = getOrCreateUltraLightDustStatics();
        for (let dustIndex = 0; dustIndex < dustStatics.length; dustIndex += 1) {
            const dustStatic = dustStatics[dustIndex];
            const driftX = (gameTimeSec * dustStatic.driftXSpeed + dustStatic.seed) % viewportWidth;
            const driftY = (gameTimeSec * dustStatic.driftYSpeed + dustStatic.seed * 1.7) % viewportHeight;
            const halfSize = dustStatic.textureHalfSize;

            if (
                driftX + halfSize < 0
                || driftX - halfSize > viewportWidth
                || driftY + halfSize < 0
                || driftY - halfSize > viewportHeight
            ) {
                continue;
            }

            ctx.drawImage(dustStatic.texture, driftX - halfSize, driftY - halfSize);
        }

        ctx.restore();
    }

    /**
     * Draw a single ultra sun ember particle
     */
    private drawUltraSunEmber(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        glowRadius: number,
        alpha: number,
        glowTexture: HTMLCanvasElement,
        coreTexture: HTMLCanvasElement
    ): void {
        const glowSize = glowRadius * 4.8;
        const glowHalfSize = glowSize * 0.5;
        ctx.globalAlpha = alpha;
        ctx.drawImage(glowTexture, x - glowHalfSize, y - glowHalfSize, glowSize, glowSize);

        const coreSize = glowRadius / 1.4;
        const coreHalfSize = coreSize * 0.5;
        ctx.drawImage(coreTexture, x - coreHalfSize, y - coreHalfSize, coreSize, coreSize);
    }

    /**
     * Clear per-frame shadow cache
     */
    public clearFrameCache(): void {
        this.sunShadowQuadFrameCache = new WeakMap<Sun, ShadowQuad[]>();
    }
}

// Type for ultra light dust particles (used by renderer, not sun renderer directly)
type UltraLightDustStatic = {
    seed: number;
    driftXSpeed: number;
    driftYSpeed: number;
    size: number;
    textureHalfSize: number;
    texture: HTMLCanvasElement;
};
