/**
 * Starfield Renderer - Parallax star layers and background nebula rendering
 * 
 * Manages two starfield systems:
 * 1. Reworked Parallax Stars - Cinematic orange palette stars rendered behind asteroids
 * 2. Traditional Star Layers - Power-law distributed stars with temperature-based colors (legacy, currently unused)
 * 
 * Features:
 * - Seeded deterministic star generation
 * - Multi-layer parallax depth
 * - Star core and halo caching for performance
 * - Chromatic aberration effects
 * - Shadow overlay support
 * - Nebula gradient backgrounds
 */

import { Vector2D, GameState, Asteroid } from '../game-core';
import * as Constants from '../constants';
import { valueNoise2D, fractalNoise2D } from './noise-utilities';

type StarData = {
    x: number;
    y: number;
    sizePx: number;
    haloScale: number;
    brightness: number;
    colorRgb: [number, number, number];
    flickerHz: number;
    phase: number;
    hasChromaticAberration: boolean;
};

type ReworkedStarData = StarData & {
    colorIndex: number;
};

type StarLayer = {
    stars: StarData[];
    parallaxFactor: number;
    brightnessScale: number;
    blurVariance: number;
};

type ReworkedStarLayer = {
    stars: ReworkedStarData[];
    parallaxFactor: number;
};

export class StarfieldRenderer {
    // Cinematic orange palette for reworked parallax stars
    private readonly cinematicOrangePaletteRgb: Array<[number, number, number]> = [
        [255, 178, 26],
        [255, 191, 104],
        [249, 216, 162],
        [255, 235, 198],
        [255, 246, 228],
        [241, 245, 251],
        [232, 239, 255],
    ];

    // Star layers (reworked parallax system - active)
    private reworkedParallaxStarLayers: ReworkedStarLayer[] = [];
    private readonly reworkedStarCoreCacheByPalette: HTMLCanvasElement[];
    private readonly reworkedStarHaloCacheByPalette: HTMLCanvasElement[];

    // Star layers (traditional temperature-based system - legacy, unused)
    private starLayers: StarLayer[] = [];
    private readonly starColorTemperatureLut: Array<[number, number, number]>;
    private readonly starCoreCacheByTemperature: HTMLCanvasElement[];
    private readonly starHaloCacheByTemperature: HTMLCanvasElement[];

    // Starfield cache (for traditional system)
    private starfieldCacheCanvas: HTMLCanvasElement | null = null;
    private starfieldCacheCtx: CanvasRenderingContext2D | null = null;
    private starfieldCacheWidth = 0;
    private starfieldCacheHeight = 0;
    private starfieldCacheCameraX = Number.NaN;
    private starfieldCacheCameraY = Number.NaN;

    // Gradient cache (shared)
    private gradientCache = new Map<string, CanvasGradient>();

    constructor() {
        // Initialize temperature-based caches (for traditional system)
        this.starColorTemperatureLut = this.createStarTemperatureLookup();
        this.starCoreCacheByTemperature = this.createStarCoreCacheByTemperature();
        this.starHaloCacheByTemperature = this.createStarHaloCacheByTemperature();

        // Initialize palette-based caches (for reworked system)
        this.reworkedStarCoreCacheByPalette = this.createReworkedStarCoreCacheByPalette();
        this.reworkedStarHaloCacheByPalette = this.createReworkedStarHaloCacheByPalette();

        // Initialize reworked parallax stars (active system)
        this.initializeReworkedParallaxStarLayers();

        // Note: initializeStarLayers() is not called by default as the traditional system is unused
    }

    /**
     * Initialize reworked parallax star layers with cinematic orange palette
     * Uses seeded RNG for deterministic generation
     */
    private initializeReworkedParallaxStarLayers(): void {
        let seed = 7331;
        const seededRandom = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        const layerConfigs = [
            { count: 2400, parallaxFactor: 0.22, sizeMinPx: 0.8, sizeMaxPx: 2.1 },
            { count: 1700, parallaxFactor: 0.3, sizeMinPx: 1.0, sizeMaxPx: 2.5 },
            { count: 1100, parallaxFactor: 0.38, sizeMinPx: 1.2, sizeMaxPx: 2.9 },
        ];
        for (const layerConfig of layerConfigs) {
            const stars: ReworkedStarData[] = [];

            for (let i = 0; i < layerConfig.count; i++) {
                const sizePx = layerConfig.sizeMinPx + seededRandom() * (layerConfig.sizeMaxPx - layerConfig.sizeMinPx);
                const brightness = 0.48 + seededRandom() * 0.5;
                const colorIndex = this.sampleReworkedParallaxPaletteIndex(seededRandom());

                stars.push({
                    x: seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2,
                    y: seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2,
                    sizePx,
                    haloScale: 3.6 + seededRandom() * 2.4,
                    brightness,
                    colorRgb: this.cinematicOrangePaletteRgb[colorIndex],
                    colorIndex,
                    flickerHz: 0.08 + seededRandom() * 0.1,
                    phase: seededRandom() * Math.PI * 2,
                    hasChromaticAberration: sizePx > 2.05 && brightness > 0.8 && seededRandom() > 0.45,
                });
            }

            this.reworkedParallaxStarLayers.push({
                stars,
                parallaxFactor: layerConfig.parallaxFactor,
            });
        }
    }

    /**
     * Sample palette index for reworked parallax stars
     * Uses weighted distribution for color variety
     */
    private sampleReworkedParallaxPaletteIndex(randomSample: number): number {
        if (randomSample < 0.2) {
            return 0;
        }
        if (randomSample < 0.36) {
            return 1;
        }
        if (randomSample < 0.52) {
            return 2;
        }
        if (randomSample < 0.68) {
            return 3;
        }
        if (randomSample < 0.82) {
            return 4;
        }
        if (randomSample < 0.92) {
            return 5;
        }
        return 6;
    }

    /**
     * Create star core caches for reworked palette
     */
    private createReworkedStarCoreCacheByPalette(): HTMLCanvasElement[] {
        return this.cinematicOrangePaletteRgb.map((colorRgb) => this.createStarCoreCacheCanvas(colorRgb));
    }

    /**
     * Create star halo caches for reworked palette
     */
    private createReworkedStarHaloCacheByPalette(): HTMLCanvasElement[] {
        return this.cinematicOrangePaletteRgb.map((colorRgb) => this.createStarHaloCacheCanvas(colorRgb));
    }

    /**
     * Draw reworked parallax stars (active system)
     * Renders cinematic orange stars with parallax depth
     */
    public drawReworkedParallaxStars(
        ctx: CanvasRenderingContext2D,
        parallaxCamera: Vector2D,
        screenWidth: number,
        screenHeight: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
    ): void {
        const centerX = screenWidth * 0.5;
        const centerY = screenHeight * 0.5;
        const wrapSpanX = centerX * 2 + Constants.STAR_WRAP_SIZE;
        const wrapSpanY = centerY * 2 + Constants.STAR_WRAP_SIZE;
        const cameraX = parallaxCamera.x;
        const cameraY = parallaxCamera.y;
        const nowSeconds = performance.now() * 0.001;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const layer of this.reworkedParallaxStarLayers) {
            const parallaxX = cameraX * layer.parallaxFactor;
            const parallaxY = cameraY * layer.parallaxFactor;
            const depthScale = Math.min(1, 0.48 + layer.parallaxFactor * 1.08);
            
            // Pre-compute depth-based alpha and size multipliers
            const depthAlpha = 0.5 + depthScale * 0.5;
            const depthSizeMultiplier = 0.84 + depthScale * 0.62;
            const haloAlphaMultiplier = 0.56 + depthScale * 0.44;

            for (const star of layer.stars) {
                const screenX = centerX + (star.x - parallaxX);
                const screenY = centerY + (star.y - parallaxY);
                const wrappedX = ((screenX + centerX) % wrapSpanX) - centerX;
                const wrappedY = ((screenY + centerY) % wrapSpanY) - centerY;

                if (wrappedX < -140 || wrappedX > screenWidth + 140 || wrappedY < -140 || wrappedY > screenHeight + 140) {
                    continue;
                }

                const flicker = 1 + 0.03 * Math.sin(star.phase + nowSeconds * Math.PI * 2 * star.flickerHz);
                const alpha = star.brightness * flicker * depthAlpha;
                const renderedSizePx = star.sizePx * depthSizeMultiplier;
                const cacheIndex = star.colorIndex;

                const haloRadiusPx = renderedSizePx * star.haloScale;
                ctx.globalAlpha = alpha * haloAlphaMultiplier;
                ctx.drawImage(
                    this.reworkedStarHaloCacheByPalette[cacheIndex],
                    wrappedX - haloRadiusPx,
                    wrappedY - haloRadiusPx,
                    haloRadiusPx * 2,
                    haloRadiusPx * 2
                );

                const coreRadiusPx = renderedSizePx * 0.95;
                ctx.globalAlpha = alpha;
                ctx.drawImage(
                    this.reworkedStarCoreCacheByPalette[cacheIndex],
                    wrappedX - coreRadiusPx,
                    wrappedY - coreRadiusPx,
                    coreRadiusPx * 2,
                    coreRadiusPx * 2
                );

                // Only render chromatic aberration on medium+ quality
                if (star.hasChromaticAberration && graphicsQuality !== 'low') {
                    this.renderStarChromaticAberration(ctx, wrappedX, wrappedY, renderedSizePx, alpha * 0.17, star.colorRgb);
                }
            }
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * Initialize traditional star layers with clustered, power-law-distributed stars for realistic depth
     * (Legacy system, currently unused)
     */
    public initializeStarLayers(): void {
        let seed = 42;
        const seededRandom = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        const minSpacing = 5;
        const gridCell = minSpacing / Math.SQRT2;
        const gridSize = Math.ceil(Constants.STAR_WRAP_SIZE / gridCell);

        for (const layerConfig of Constants.STAR_LAYER_CONFIGS) {
            const stars: StarData[] = [];

            const grid = new Int32Array(gridSize * gridSize).fill(-1);
            const noiseScale = 0.004 + seededRandom() * 0.006;
            let attempts = 0;
            const maxAttempts = layerConfig.count * 22;

            while (stars.length < layerConfig.count && attempts < maxAttempts) {
                attempts++;
                const x = seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2;
                const y = seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2;

                const density = fractalNoise2D((x + Constants.STAR_WRAP_SIZE * 0.5) * noiseScale, (y + Constants.STAR_WRAP_SIZE * 0.5) * noiseScale, 4);
                const ridge = Math.abs(valueNoise2D(x * noiseScale * 0.35 + 19.2, y * noiseScale * 0.35 - 7.1) * 2 - 1);
                const clusterBias = density * 0.8 + (1 - ridge) * 0.2;
                if (clusterBias < 0.48 + seededRandom() * 0.12) {
                    continue;
                }

                const gx = Math.max(0, Math.min(gridSize - 1, Math.floor((x + Constants.STAR_WRAP_SIZE / 2) / gridCell)));
                const gy = Math.max(0, Math.min(gridSize - 1, Math.floor((y + Constants.STAR_WRAP_SIZE / 2) / gridCell)));

                let canPlace = true;
                for (let oy = -1; oy <= 1 && canPlace; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const nx = gx + ox;
                        const ny = gy + oy;
                        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) {
                            continue;
                        }
                        const starIndex = grid[ny * gridSize + nx];
                        if (starIndex >= 0) {
                            const other = stars[starIndex];
                            const dx = x - other.x;
                            const dy = y - other.y;
                            if ((dx * dx + dy * dy) < minSpacing * minSpacing) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                }

                if (!canPlace) {
                    continue;
                }

                const sizePx = this.samplePowerLawSize(layerConfig.sizeRange[0], layerConfig.sizeRange[1], 1.82, seededRandom());
                const brightness = (0.42 + seededRandom() * 0.58) * (0.72 + clusterBias * 0.28) * layerConfig.brightnessScale;
                const colorTemperatureK = this.sampleStarTemperatureK(seededRandom());
                const color = this.starColorTemperatureLut[Math.max(0, Math.min(this.starColorTemperatureLut.length - 1, Math.round((colorTemperatureK - 3000) / 50)))];

                stars.push({
                    x,
                    y,
                    sizePx,
                    haloScale: 3.2 + seededRandom() * 2.2,
                    brightness,
                    colorRgb: color,
                    flickerHz: 0.16 + seededRandom() * 0.14,
                    phase: seededRandom() * Math.PI * 2,
                    hasChromaticAberration: sizePx > 2.15 && brightness > 0.82 && seededRandom() > 0.4,
                });

                grid[gy * gridSize + gx] = stars.length - 1;
            }

            this.starLayers.push({
                stars,
                parallaxFactor: layerConfig.parallaxFactor,
                brightnessScale: layerConfig.brightnessScale,
                blurVariance: layerConfig.blurVariance
            });
        }
    }

    /**
     * Sample star size using power-law distribution for realistic depth
     */
    private samplePowerLawSize(minSize: number, maxSize: number, alpha: number, randomSample: number): number {
        const safeR = Math.max(0.000001, Math.min(0.999999, randomSample));
        const size = minSize * Math.pow(1 - safeR, -1 / alpha);
        return Math.min(maxSize, size);
    }

    /**
     * Sample star temperature with weighted distribution
     */
    private sampleStarTemperatureK(randomSample: number): number {
        if (randomSample < 0.58) {
            return 4500 + randomSample / 0.58 * 1500;
        }
        if (randomSample < 0.85) {
            return 3800 + ((randomSample - 0.58) / 0.27) * 900;
        }
        return 6000 + ((randomSample - 0.85) / 0.15) * 2600;
    }

    /**
     * Create lookup table for star colors by temperature
     */
    private createStarTemperatureLookup(): Array<[number, number, number]> {
        const lut: Array<[number, number, number]> = [];
        for (let kelvin = 3000; kelvin <= 9000; kelvin += 50) {
            const t = (kelvin - 3000) / 6000;
            const r = Math.round(255 * (1.0 - Math.max(0, t - 0.55) * 0.14));
            const g = Math.round(170 + 75 * Math.min(1, t * 1.1));
            const b = Math.round(120 + 135 * Math.pow(t, 0.82));
            lut.push([r, g, b]);
        }
        return lut;
    }

    /**
     * Draw traditional starfield with nebula background (cached)
     * (Legacy system, currently unused)
     */
    public drawStarfield(
        ctx: CanvasRenderingContext2D,
        parallaxCamera: Vector2D,
        screenWidth: number,
        screenHeight: number
    ): void {
        if (!this.starfieldCacheCanvas) {
            this.starfieldCacheCanvas = document.createElement('canvas');
            this.starfieldCacheCtx = this.starfieldCacheCanvas.getContext('2d');
        }

        if (!this.starfieldCacheCanvas || !this.starfieldCacheCtx) {
            return;
        }

        if (this.starfieldCacheWidth !== screenWidth || this.starfieldCacheHeight !== screenHeight) {
            this.starfieldCacheCanvas.width = screenWidth;
            this.starfieldCacheCanvas.height = screenHeight;
            this.starfieldCacheWidth = screenWidth;
            this.starfieldCacheHeight = screenHeight;
        }

        const cameraX = parallaxCamera.x;
        const cameraY = parallaxCamera.y;
        const nowSeconds = performance.now() * 0.001;
        const needsRefresh = cameraX !== this.starfieldCacheCameraX ||
            cameraY !== this.starfieldCacheCameraY ||
            this.starfieldCacheWidth !== screenWidth ||
            this.starfieldCacheHeight !== screenHeight;

        if (needsRefresh) {
            const cacheCtx = this.starfieldCacheCtx;
            const centerX = screenWidth / 2;
            const centerY = screenHeight / 2;
            const wrapSpanX = centerX * 2 + Constants.STAR_WRAP_SIZE;
            const wrapSpanY = centerY * 2 + Constants.STAR_WRAP_SIZE;

            cacheCtx.globalCompositeOperation = 'source-over';
            cacheCtx.clearRect(0, 0, screenWidth, screenHeight);

            // Cache nebula gradient by screen dimensions to avoid recreation on every camera move
            const nebulaKey = `nebula-${screenWidth}-${screenHeight}`;
            let nebulaGradient = this.gradientCache.get(nebulaKey);
            if (!nebulaGradient) {
                nebulaGradient = cacheCtx.createLinearGradient(0, 0, screenWidth, screenHeight);
                nebulaGradient.addColorStop(0, 'rgba(54, 38, 90, 0.035)');
                nebulaGradient.addColorStop(0.5, 'rgba(28, 50, 92, 0.025)');
                nebulaGradient.addColorStop(1, 'rgba(72, 34, 58, 0.03)');
                this.gradientCache.set(nebulaKey, nebulaGradient);
            }
            cacheCtx.fillStyle = nebulaGradient;
            cacheCtx.fillRect(0, 0, screenWidth, screenHeight);

            cacheCtx.globalCompositeOperation = 'lighter';

            for (const layer of this.starLayers) {
                const parallaxX = cameraX * layer.parallaxFactor;
                const parallaxY = cameraY * layer.parallaxFactor;
                const depthScale = Math.min(1, 0.4 + layer.parallaxFactor * 1.2);

                for (const star of layer.stars) {
                    const screenX = centerX + (star.x - parallaxX);
                    const screenY = centerY + (star.y - parallaxY);
                    const wrappedX = ((screenX + centerX) % wrapSpanX) - centerX;
                    const wrappedY = ((screenY + centerY) % wrapSpanY) - centerY;

                    if (wrappedX >= -140 && wrappedX <= screenWidth + 140 &&
                        wrappedY >= -140 && wrappedY <= screenHeight + 140) {
                        const flicker = 1 + 0.03 * Math.sin(star.phase + nowSeconds * Math.PI * 2 * star.flickerHz);
                        const alpha = star.brightness * flicker * (0.44 + depthScale * 0.56);
                        const renderedSizePx = star.sizePx * (0.82 + depthScale * 0.64);
                        const cacheIndex = this.getTemperatureCacheIndex(star.colorRgb);

                        const haloRadiusPx = renderedSizePx * star.haloScale;
                        cacheCtx.globalAlpha = alpha * (0.54 + depthScale * 0.46);
                        cacheCtx.drawImage(
                            this.starHaloCacheByTemperature[cacheIndex],
                            wrappedX - haloRadiusPx,
                            wrappedY - haloRadiusPx,
                            haloRadiusPx * 2,
                            haloRadiusPx * 2
                        );

                        const coreRadiusPx = renderedSizePx * 0.95;
                        cacheCtx.globalAlpha = alpha;
                        cacheCtx.drawImage(
                            this.starCoreCacheByTemperature[cacheIndex],
                            wrappedX - coreRadiusPx,
                            wrappedY - coreRadiusPx,
                            coreRadiusPx * 2,
                            coreRadiusPx * 2
                        );

                        if (star.hasChromaticAberration) {
                            this.renderStarChromaticAberration(cacheCtx, wrappedX, wrappedY, renderedSizePx, alpha * 0.17, star.colorRgb);
                        }
                    }
                }
            }

            cacheCtx.filter = 'none';
            cacheCtx.globalAlpha = 1;
            cacheCtx.globalCompositeOperation = 'source-over';
            this.starfieldCacheCameraX = cameraX;
            this.starfieldCacheCameraY = cameraY;
        }

        ctx.drawImage(this.starfieldCacheCanvas, 0, 0, screenWidth, screenHeight);
    }

    /**
     * Create star core caches for temperature-based system
     */
    private createStarCoreCacheByTemperature(): HTMLCanvasElement[] {
        return [
            this.createStarCoreCacheCanvas([255, 191, 130]),
            this.createStarCoreCacheCanvas([255, 226, 181]),
            this.createStarCoreCacheCanvas([245, 245, 255]),
            this.createStarCoreCacheCanvas([215, 229, 255]),
        ];
    }

    /**
     * Create star halo caches for temperature-based system
     */
    private createStarHaloCacheByTemperature(): HTMLCanvasElement[] {
        return [
            this.createStarHaloCacheCanvas([255, 184, 120]),
            this.createStarHaloCacheCanvas([255, 214, 154]),
            this.createStarHaloCacheCanvas([236, 239, 255]),
            this.createStarHaloCacheCanvas([202, 219, 255]),
        ];
    }

    /**
     * Create star core cache canvas with radial gradient
     */
    private createStarCoreCacheCanvas(colorRgb: [number, number, number]): HTMLCanvasElement {
        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = 64;
        cacheCanvas.height = 64;
        const cacheContext = cacheCanvas.getContext('2d');
        if (!cacheContext) {
            return cacheCanvas;
        }

        const centerPx = cacheCanvas.width * 0.5;
        const coreGradient = cacheContext.createRadialGradient(centerPx, centerPx, 0, centerPx, centerPx, centerPx);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        coreGradient.addColorStop(0.18, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.95)`);
        coreGradient.addColorStop(0.5, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.44)`);
        coreGradient.addColorStop(1, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0)`);

        cacheContext.fillStyle = coreGradient;
        cacheContext.beginPath();
        cacheContext.arc(centerPx, centerPx, centerPx, 0, Math.PI * 2);
        cacheContext.fill();
        return cacheCanvas;
    }

    /**
     * Create star halo cache canvas with radial gradient
     */
    private createStarHaloCacheCanvas(colorRgb: [number, number, number]): HTMLCanvasElement {
        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = 96;
        cacheCanvas.height = 96;
        const cacheContext = cacheCanvas.getContext('2d');
        if (!cacheContext) {
            return cacheCanvas;
        }

        const centerPx = cacheCanvas.width * 0.5;
        const haloGradient = cacheContext.createRadialGradient(centerPx, centerPx, 0, centerPx, centerPx, centerPx);
        haloGradient.addColorStop(0, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.36)`);
        haloGradient.addColorStop(0.3, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.18)`);
        haloGradient.addColorStop(0.75, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.05)`);
        haloGradient.addColorStop(1, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0)`);

        cacheContext.fillStyle = haloGradient;
        cacheContext.beginPath();
        cacheContext.arc(centerPx, centerPx, centerPx, 0, Math.PI * 2);
        cacheContext.fill();
        return cacheCanvas;
    }

    /**
     * Get temperature cache index from RGB color
     */
    private getTemperatureCacheIndex(colorRgb: [number, number, number]): number {
        if (colorRgb[2] > 242 && colorRgb[1] > 226) {
            return 3;
        }
        if (colorRgb[2] > 210) {
            return 2;
        }
        if (colorRgb[1] > 198) {
            return 1;
        }
        return 0;
    }

    /**
     * Render chromatic aberration effect for bright stars
     */
    private renderStarChromaticAberration(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        sizePx: number,
        alpha: number,
        colorRgb: [number, number, number],
    ): void {
        const offsetPx = Math.min(0.45, sizePx * 0.1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(${Math.min(255, colorRgb[0] + 20)}, 92, 92, 0.65)`;
        ctx.beginPath();
        ctx.arc(x - offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(118, ${Math.min(255, colorRgb[1] + 16)}, 255, 0.62)`;
        ctx.beginPath();
        ctx.arc(x + offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw shadow overlay on starfield based on sun positions
     * Uses evenodd clipping to exclude asteroids from shadows
     */
    public drawShadowStarfieldOverlay(
        ctx: CanvasRenderingContext2D,
        game: GameState,
        canvas: HTMLCanvasElement,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        getSunShadowQuadsFn: (sun: any, game: GameState) => any[],
        worldToScreenCoordsFn: (x: number, y: number, out: Vector2D) => void
    ): void {
        if (!this.starfieldCacheCanvas || game.suns.length === 0) {
            return;
        }

        ctx.save();
        ctx.beginPath();

        let hasShadowGeometry = false;
        for (const sun of game.suns) {
            const shadowQuads = getSunShadowQuadsFn(sun, game);
            for (const quad of shadowQuads) {
                hasShadowGeometry = true;
                ctx.moveTo(quad.sv1x, quad.sv1y);
                ctx.lineTo(quad.sv2x, quad.sv2y);
                ctx.lineTo(quad.ss2x, quad.ss2y);
                ctx.lineTo(quad.ss1x, quad.ss1y);
                ctx.closePath();
            }
        }

        if (!hasShadowGeometry) {
            ctx.restore();
            return;
        }

        // Exclude asteroid bodies from this shadow overlay pass so they are only
        // darkened when occluded by other asteroids, never by their own shadow geometry.
        this.appendAsteroidPolygonsToCurrentPath(ctx, game, worldToScreenCoordsFn);
        ctx.clip('evenodd');
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = graphicsQuality === 'ultra' ? 0.82 : 0.68;

        const dpr = window.devicePixelRatio || 1;
        const screenWidth = canvas.width / dpr;
        const screenHeight = canvas.height / dpr;
        ctx.drawImage(this.starfieldCacheCanvas, 0, 0, screenWidth, screenHeight);
        ctx.restore();
    }

    /**
     * Append asteroid polygons to current canvas path
     * Helper for shadow overlay exclusion
     */
    private appendAsteroidPolygonsToCurrentPath(
        ctx: CanvasRenderingContext2D,
        game: GameState,
        worldToScreenCoordsFn: (x: number, y: number, out: Vector2D) => void
    ): void {
        const sv = new Vector2D(0, 0);

        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            if (worldVertices.length === 0) {
                continue;
            }

            worldToScreenCoordsFn(worldVertices[0].x, worldVertices[0].y, sv);
            ctx.moveTo(sv.x, sv.y);
            for (let i = 1; i < worldVertices.length; i++) {
                worldToScreenCoordsFn(worldVertices[i].x, worldVertices[i].y, sv);
                ctx.lineTo(sv.x, sv.y);
            }
            ctx.closePath();
        }
    }
}
