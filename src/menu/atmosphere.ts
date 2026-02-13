/**
 * Menu atmosphere layer with sun and asteroids
 */

import { MenuAsteroid, MenuAsteroidPoint } from './background-particles';

export class MenuAtmosphereLayer {
    private static readonly ASTEROID_COUNT = 14;
    private static readonly ASTEROID_MIN_RADIUS_PX = 6;
    private static readonly ASTEROID_MAX_RADIUS_PX = 16;
    private static readonly ASTEROID_SPEED_MIN = 0.06;
    private static readonly ASTEROID_SPEED_MAX = 0.18;
    private static readonly ASTEROID_ROTATION_MIN_RAD = 0.004;
    private static readonly ASTEROID_ROTATION_MAX_RAD = 0.014;
    private static readonly SUN_RADIUS_PX = 120;
    private static readonly SUN_GLOW_RADIUS_PX = 320;
    private static readonly STAR_PARALLAX_LAYERS = 4;
    private static readonly STAR_BASE_DRIFT_PX = 0.055;
    private static readonly STAR_SIZE_MIN_PX = 0.45;
    private static readonly STAR_SIZE_MAX_PX = 3.4;
    private static readonly STAR_SIZE_POWER_ALPHA = 1.82;
    private static readonly STAR_FLICKER_BASE_HZ = 0.16;
    private static readonly STAR_FLICKER_AMPLITUDE = 0.03;
    private static readonly STAR_DENSITY_NOISE_SCALE = 0.0048;
    private static readonly STAR_DENSITY_THRESHOLD = 0.38;
    private static readonly STAR_PLACEMENT_MAX_ATTEMPTS = 30000;
    private static readonly STAR_POINT_BUDGET_LOW = 1400;
    private static readonly STAR_POINT_BUDGET_MEDIUM = 2200;
    private static readonly STAR_POINT_BUDGET_HIGH = 3400;
    private static readonly STAR_POINT_BUDGET_ULTRA = 5200;
    private static readonly STAR_LAYER_PARALLAX_SCALE = [0.02, 0.04, 0.07, 0.11] as const;
    private static readonly SUN_OFFSET_X_PX = -28;
    private static readonly SUN_OFFSET_Y_PX = -22;
    private static readonly SHADOW_LENGTH_BASE_PX = 120;
    private static readonly SHADOW_LENGTH_MULTIPLIER = 7.5;
    private static readonly BOUNDS_MARGIN_PX = 80;
    private static readonly LOW_QUALITY_TARGET_FPS = 30; // Target 30 FPS on low quality
    private static readonly LOW_QUALITY_FRAME_TIME_MS = 1000 / 30;

    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private asteroids: MenuAsteroid[] = [];
    private animationFrameId: number | null = null;
    private isActive: boolean = false;
    private widthPx: number = 0;
    private heightPx: number = 0;
    private sunSprite: HTMLImageElement;
    private opacity: number = 0.2;
    private graphicsQuality: 'low' | 'medium' | 'high' | 'ultra' = 'ultra';
    private lastFrameTimeMs: number = 0;
    private stars: {
        x: number;
        y: number;
        sizePx: number;
        layerIndex: number;
        phase: number;
        brightness: number;
        colorRgb: [number, number, number];
        flickerHz: number;
        hasChromaticAberration: boolean;
    }[] = [];
    private readonly starCoreCacheByTemperature: HTMLCanvasElement[];
    private readonly starHaloCacheByTemperature: HTMLCanvasElement[];
    // Cached gradients to avoid per-frame allocation
    private sunWhiteHotCoreGradient: CanvasGradient | null = null;
    private sunGlowGradient: CanvasGradient | null = null;
    private sunPlasmaGradient: CanvasGradient | null = null;
    private asteroidLightGradient: CanvasGradient | null = null;

    constructor(container: HTMLElement, sunSpritePath: string) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '0';
        this.canvas.style.opacity = this.opacity.toString();

        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Unable to create menu atmosphere canvas context.');
        }
        this.context = context;

        this.sunSprite = new Image();
        this.sunSprite.src = sunSpritePath;
        this.starCoreCacheByTemperature = this.createStarCoreCacheByTemperature();
        this.starHaloCacheByTemperature = this.createStarHaloCacheByTemperature();

        this.container.appendChild(this.canvas);
        this.resize();
        this.initializeAsteroids();
        this.initializeStars();
        // Don't auto-start - let resumeMenuAnimations() start it after menu is in DOM
    }

    public setGraphicsQuality(quality: 'low' | 'medium' | 'high' | 'ultra'): void {
        if (this.graphicsQuality === quality) {
            return;
        }
        this.graphicsQuality = quality;
        this.initializeStars();
    }

    public start(): void {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.animate();
    }

    public stop(): void {
        this.isActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public resize(): void {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.widthPx = width;
        this.heightPx = height;
        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        this.initializeStars();
        this.initializeCachedGradients();
    }

    public destroy(): void {
        this.stop();
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }

    public setOpacity(opacity: number): void {
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        if (this.opacity === clampedOpacity) {
            return;
        }
        this.opacity = clampedOpacity;
        this.canvas.style.opacity = this.opacity.toString();
    }

    public getSunCenterNormalized(): { x: number; y: number } {
        const sunCenter = this.getSunCenter();
        const safeWidthPx = Math.max(1, this.widthPx);
        const safeHeightPx = Math.max(1, this.heightPx);
        return {
            x: Math.max(0, Math.min(1, sunCenter.x / safeWidthPx)),
            y: Math.max(0, Math.min(1, sunCenter.y / safeHeightPx)),
        };
    }

    private initializeCachedGradients(): void {
        const sunCenter = this.getSunCenter();

        // Cache sun white hot core gradient
        this.sunWhiteHotCoreGradient = this.context.createRadialGradient(
            sunCenter.x,
            sunCenter.y,
            0,
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_RADIUS_PX * 0.48
        );
        this.sunWhiteHotCoreGradient.addColorStop(0, '#FFF8E6');
        this.sunWhiteHotCoreGradient.addColorStop(0.65, '#FFF2B0');
        this.sunWhiteHotCoreGradient.addColorStop(1, 'rgba(255, 210, 90, 0)');

        // Cache sun glow gradient
        this.sunGlowGradient = this.context.createRadialGradient(
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_RADIUS_PX * 0.35,
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_GLOW_RADIUS_PX
        );
        this.sunGlowGradient.addColorStop(0, 'rgba(255, 214, 90, 0.95)');
        this.sunGlowGradient.addColorStop(0.3, 'rgba(255, 179, 71, 0.65)');
        this.sunGlowGradient.addColorStop(0.55, 'rgba(255, 158, 58, 0.45)');
        this.sunGlowGradient.addColorStop(0.75, 'rgba(255, 122, 26, 0.28)');
        this.sunGlowGradient.addColorStop(1, 'rgba(230, 92, 0, 0)');

        // Cache sun plasma gradient (fallback when sprite not loaded)
        this.sunPlasmaGradient = this.context.createRadialGradient(
            sunCenter.x,
            sunCenter.y,
            0,
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_RADIUS_PX
        );
        this.sunPlasmaGradient.addColorStop(0, '#FFD65A');
        this.sunPlasmaGradient.addColorStop(0.55, '#FFB347');
        this.sunPlasmaGradient.addColorStop(1, '#FF8C2E');

        // Cache asteroid light gradient using normalized coordinates
        // The gradient is created with -1 to 1 coordinates and will scale with context transforms
        this.asteroidLightGradient = this.context.createLinearGradient(-1, -1, 1, 1);
        this.asteroidLightGradient.addColorStop(0, '#FFC46B');
        this.asteroidLightGradient.addColorStop(1, '#1A2238');
    }

    private initializeAsteroids(): void {
        this.asteroids = [];
        for (let i = 0; i < MenuAtmosphereLayer.ASTEROID_COUNT; i++) {
            this.asteroids.push(this.createAsteroid());
        }
    }

    private createAsteroid(): MenuAsteroid {
        const radiusPx = this.randomRange(
            MenuAtmosphereLayer.ASTEROID_MIN_RADIUS_PX,
            MenuAtmosphereLayer.ASTEROID_MAX_RADIUS_PX
        );
        const position = this.createSpawnPosition();
        const velocity = this.createVelocity();
        const rotationSpeedRad = this.randomRange(
            MenuAtmosphereLayer.ASTEROID_ROTATION_MIN_RAD,
            MenuAtmosphereLayer.ASTEROID_ROTATION_MAX_RAD
        );
        const points: MenuAsteroidPoint[] = [];
        const pointCount = 7 + Math.floor(Math.random() * 4);
        for (let i = 0; i < pointCount; i++) {
            points.push({
                angleRad: (Math.PI * 2 * i) / pointCount,
                radiusScale: 0.7 + Math.random() * 0.5,
            });
        }
        return {
            x: position.x,
            y: position.y,
            radiusPx,
            velocityX: velocity.x,
            velocityY: velocity.y,
            rotationRad: Math.random() * Math.PI * 2,
            rotationSpeedRad: rotationSpeedRad * (Math.random() > 0.5 ? 1 : -1),
            points,
        };
    }

    private createSpawnPosition(): { x: number; y: number } {
        const margin = MenuAtmosphereLayer.BOUNDS_MARGIN_PX;
        const sideRoll = Math.random();
        if (sideRoll < 0.5) {
            return {
                x: this.randomRange(-margin, this.widthPx + margin),
                y: this.randomRange(-margin * 0.6, this.heightPx * 0.7),
            };
        }
        return {
            x: this.randomRange(-margin, this.widthPx * 0.7),
            y: this.randomRange(-margin, this.heightPx + margin),
        };
    }

    private createVelocity(): { x: number; y: number } {
        const speed = this.randomRange(
            MenuAtmosphereLayer.ASTEROID_SPEED_MIN,
            MenuAtmosphereLayer.ASTEROID_SPEED_MAX
        );
        const angleRad = Math.random() * Math.PI * 2;
        return {
            x: Math.cos(angleRad) * speed,
            y: Math.sin(angleRad) * speed,
        };
    }

    private animate(): void {
        if (!this.isActive) {
            return;
        }
        
        // Throttle frame rate on low quality setting to reduce CPU load
        if (this.graphicsQuality === 'low') {
            const nowMs = performance.now();
            const deltaMs = nowMs - this.lastFrameTimeMs;
            
            if (deltaMs < MenuAtmosphereLayer.LOW_QUALITY_FRAME_TIME_MS) {
                this.animationFrameId = requestAnimationFrame(() => this.animate());
                return;
            }
            this.lastFrameTimeMs = nowMs;
        }
        
        this.updateAsteroids();
        this.render();
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    private updateAsteroids(): void {
        const margin = MenuAtmosphereLayer.BOUNDS_MARGIN_PX;
        const minX = -margin;
        const minY = -margin;
        const maxX = this.widthPx + margin;
        const maxY = this.heightPx + margin;

        for (const asteroid of this.asteroids) {
            asteroid.x += asteroid.velocityX;
            asteroid.y += asteroid.velocityY;
            asteroid.rotationRad += asteroid.rotationSpeedRad;

            if (asteroid.x < minX || asteroid.x > maxX || asteroid.y < minY || asteroid.y > maxY) {
                const spawn = this.createSpawnPosition();
                const velocity = this.createVelocity();
                asteroid.x = spawn.x;
                asteroid.y = spawn.y;
                asteroid.velocityX = velocity.x;
                asteroid.velocityY = velocity.y;
            }
        }
    }

    private render(): void {
        this.context.clearRect(0, 0, this.widthPx, this.heightPx);
        this.renderStars();
        this.renderSunGlow();
        this.renderAsteroids();
    }

    private initializeStars(): void {
        this.stars = [];
        const starCount = this.getStarCountForGraphicsQuality();
        const minWidth = Math.max(1, this.widthPx);
        const minHeight = Math.max(1, this.heightPx);
        let attempts = 0;

        while (this.stars.length < starCount && attempts < MenuAtmosphereLayer.STAR_PLACEMENT_MAX_ATTEMPTS) {
            attempts++;
            const x = Math.random() * minWidth;
            const y = Math.random() * minHeight;
            const density = this.sampleDensityNoise(x, y, minWidth, minHeight);
            if (density < MenuAtmosphereLayer.STAR_DENSITY_THRESHOLD && Math.random() > 0.06) {
                continue;
            }

            const brightness = this.randomRange(0.42, 1.0) * (0.7 + density * 0.3);
            const sizePx = this.randomStarSizePx();
            const colorTemperatureK = this.sampleColorTemperatureK(brightness);
            const colorRgb = this.kelvinToRgb(colorTemperatureK);

            this.stars.push({
                x,
                y,
                sizePx,
                layerIndex: Math.floor(Math.random() * MenuAtmosphereLayer.STAR_PARALLAX_LAYERS),
                phase: Math.random() * Math.PI * 2,
                brightness,
                colorRgb,
                flickerHz: MenuAtmosphereLayer.STAR_FLICKER_BASE_HZ + Math.random() * 0.14,
                hasChromaticAberration: sizePx > 2.15 && brightness > 0.82 && Math.random() > 0.4,
            });
        }
    }

    private renderStars(): void {
        const nowMs = performance.now();
        const sunCenter = this.getSunCenter();
        const sunParallaxOriginX = this.widthPx * 0.5;
        const sunParallaxOriginY = this.heightPx * 0.5;
        const sunParallaxDeltaX = sunCenter.x - sunParallaxOriginX;
        const sunParallaxDeltaY = sunCenter.y - sunParallaxOriginY;

        // Pre-compute loop invariants for performance
        const flickerTimeBase = (nowMs * 0.001) * Math.PI * 2;
        const driftMultiplier = nowMs * MenuAtmosphereLayer.STAR_BASE_DRIFT_PX;
        const shouldRenderChromaticAberration = this.graphicsQuality !== 'low';

        this.context.save();
        this.context.globalCompositeOperation = 'lighter';

        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            const depthScale = (star.layerIndex + 1) / MenuAtmosphereLayer.STAR_PARALLAX_LAYERS;
            const parallaxScale = MenuAtmosphereLayer.STAR_LAYER_PARALLAX_SCALE[star.layerIndex] ?? 0.05;
            const parallaxOffsetX = sunParallaxDeltaX * parallaxScale;
            const parallaxOffsetY = sunParallaxDeltaY * parallaxScale;

            const flicker = 1 + MenuAtmosphereLayer.STAR_FLICKER_AMPLITUDE
                * Math.sin(star.phase + flickerTimeBase * star.flickerHz);
            const alpha = star.brightness * flicker * (0.4 + depthScale * 0.6);

            const renderedX = (star.x + parallaxOffsetX + driftMultiplier * depthScale) % this.widthPx;
            const renderedY = (star.y + parallaxOffsetY) % this.heightPx;
            const sizePx = star.sizePx * (0.8 + depthScale * 0.6);
            const cacheIndex = this.getTemperatureCacheIndex(star.colorRgb);
            const coreCacheCanvas = this.starCoreCacheByTemperature[cacheIndex];
            const haloCacheCanvas = this.starHaloCacheByTemperature[cacheIndex];

            this.context.globalAlpha = alpha * (0.56 + depthScale * 0.44);
            const haloRadiusPx = sizePx * (3.2 + depthScale * 1.8);
            this.context.drawImage(
                haloCacheCanvas,
                renderedX - haloRadiusPx,
                renderedY - haloRadiusPx,
                haloRadiusPx * 2,
                haloRadiusPx * 2
            );

            this.context.globalAlpha = alpha;
            const coreRadiusPx = sizePx * 0.95;
            this.context.drawImage(
                coreCacheCanvas,
                renderedX - coreRadiusPx,
                renderedY - coreRadiusPx,
                coreRadiusPx * 2,
                coreRadiusPx * 2
            );

            // Skip chromatic aberration on low quality for better performance
            if (star.hasChromaticAberration && shouldRenderChromaticAberration) {
                this.renderChromaticAberration(renderedX, renderedY, sizePx, alpha * 0.17, star.colorRgb);
            }
        }

        this.context.restore();
        this.context.globalAlpha = 1;
    }

    private createStarCoreCacheByTemperature(): HTMLCanvasElement[] {
        return [
            this.createStarCoreCacheCanvas([255, 191, 130]),
            this.createStarCoreCacheCanvas([255, 226, 181]),
            this.createStarCoreCacheCanvas([245, 245, 255]),
            this.createStarCoreCacheCanvas([215, 229, 255]),
        ];
    }

    private createStarHaloCacheByTemperature(): HTMLCanvasElement[] {
        return [
            this.createStarHaloCacheCanvas([255, 184, 120]),
            this.createStarHaloCacheCanvas([255, 214, 154]),
            this.createStarHaloCacheCanvas([236, 239, 255]),
            this.createStarHaloCacheCanvas([202, 219, 255]),
        ];
    }

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

    private renderChromaticAberration(
        x: number,
        y: number,
        sizePx: number,
        alpha: number,
        colorRgb: [number, number, number]
    ): void {
        const offsetPx = Math.min(0.45, sizePx * 0.1);
        this.context.globalAlpha = alpha;
        this.context.fillStyle = `rgba(${Math.min(255, colorRgb[0] + 20)}, 92, 92, 0.65)`;
        this.context.beginPath();
        this.context.arc(x - offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
        this.context.fill();

        this.context.fillStyle = `rgba(118, ${Math.min(255, colorRgb[1] + 16)}, 255, 0.62)`;
        this.context.beginPath();
        this.context.arc(x + offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
        this.context.fill();
    }

    private getStarCountForGraphicsQuality(): number {
        switch (this.graphicsQuality) {
            case 'low':
                return MenuAtmosphereLayer.STAR_POINT_BUDGET_LOW;
            case 'medium':
                return MenuAtmosphereLayer.STAR_POINT_BUDGET_MEDIUM;
            case 'high':
                return MenuAtmosphereLayer.STAR_POINT_BUDGET_HIGH;
            case 'ultra':
            default:
                return MenuAtmosphereLayer.STAR_POINT_BUDGET_ULTRA;
        }
    }

    private randomStarSizePx(): number {
        const randomValue = Math.random();
        const clampedRandomValue = Math.min(0.9994, Math.max(0.0001, randomValue));
        const powerValue = MenuAtmosphereLayer.STAR_SIZE_MIN_PX
            * Math.pow(1 - clampedRandomValue, -1 / MenuAtmosphereLayer.STAR_SIZE_POWER_ALPHA);
        return Math.min(MenuAtmosphereLayer.STAR_SIZE_MAX_PX, powerValue);
    }

    private sampleColorTemperatureK(brightness: number): number {
        const randomRoll = Math.random();
        if (randomRoll < 0.58) {
            return this.randomRange(4500, 6000);
        }
        if (randomRoll < 0.85) {
            return this.randomRange(3800, 4700);
        }
        if (brightness > 0.86) {
            return this.randomRange(6200, 8600);
        }
        return this.randomRange(5600, 7300);
    }

    private kelvinToRgb(temperatureK: number): [number, number, number] {
        const clampedK = Math.max(3000, Math.min(9000, temperatureK));
        if (clampedK < 4200) {
            return [255, 190, 128];
        }
        if (clampedK < 5600) {
            return [255, 226, 181];
        }
        if (clampedK < 7200) {
            return [245, 245, 255];
        }
        return [212, 227, 255];
    }

    private getTemperatureCacheIndex(colorRgb: [number, number, number]): number {
        if (colorRgb[2] > 250 && colorRgb[0] < 230) {
            return 3;
        }
        if (colorRgb[1] > 236) {
            return 2;
        }
        if (colorRgb[1] > 210) {
            return 1;
        }
        return 0;
    }

    private sampleDensityNoise(x: number, y: number, widthPx: number, heightPx: number): number {
        const nx = x * MenuAtmosphereLayer.STAR_DENSITY_NOISE_SCALE;
        const ny = y * MenuAtmosphereLayer.STAR_DENSITY_NOISE_SCALE;
        const octave1 = this.valueNoise2D(nx, ny);
        const octave2 = this.valueNoise2D(nx * 2.05, ny * 2.05) * 0.5;
        const octave3 = this.valueNoise2D(nx * 4.1, ny * 4.1) * 0.25;
        const ridge = 1 - Math.abs(this.valueNoise2D(nx * 0.55 + 11.7, ny * 0.55 - 7.3) * 2 - 1);
        const edgeDistanceX = Math.min(x / widthPx, (widthPx - x) / widthPx);
        const edgeDistanceY = Math.min(y / heightPx, (heightPx - y) / heightPx);
        const edgeFadeX = Math.min(1, Math.max(0.22, edgeDistanceX) * 2.1);
        const edgeFadeY = Math.min(1, Math.max(0.22, edgeDistanceY) * 2.1);
        return Math.min(1, (octave1 + octave2 + octave3) / 1.75 * 0.8 + ridge * 0.2) * edgeFadeX * edgeFadeY;
    }

    private valueNoise2D(x: number, y: number): number {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const sx = x - x0;
        const sy = y - y0;
        const fx = sx * sx * (3 - 2 * sx);
        const fy = sy * sy * (3 - 2 * sy);

        const n00 = this.hashNoise(x0, y0);
        const n10 = this.hashNoise(x1, y0);
        const n01 = this.hashNoise(x0, y1);
        const n11 = this.hashNoise(x1, y1);

        const ix0 = n00 + (n10 - n00) * fx;
        const ix1 = n01 + (n11 - n01) * fx;
        return ix0 + (ix1 - ix0) * fy;
    }

    private hashNoise(x: number, y: number): number {
        let hash = x * 374761393 + y * 668265263;
        hash = (hash ^ (hash >> 13)) * 1274126177;
        hash ^= hash >> 16;
        return (hash >>> 0) / 4294967295;
    }

    private renderSunGlow(): void {
        const sunCenter = this.getSunCenter();
        this.context.save();
        this.context.globalCompositeOperation = 'lighter';

        // Use cached white hot core gradient
        if (this.sunWhiteHotCoreGradient) {
            this.context.fillStyle = this.sunWhiteHotCoreGradient;
            this.context.beginPath();
            this.context.arc(sunCenter.x, sunCenter.y, MenuAtmosphereLayer.SUN_RADIUS_PX * 0.52, 0, Math.PI * 2);
            this.context.fill();
        }

        // Use cached sun glow gradient
        if (this.sunGlowGradient) {
            this.context.fillStyle = this.sunGlowGradient;
            this.context.beginPath();
            this.context.arc(
                sunCenter.x,
                sunCenter.y,
                MenuAtmosphereLayer.SUN_GLOW_RADIUS_PX,
                0,
                Math.PI * 2
            );
            this.context.fill();
        }

        if (this.sunSprite.complete && this.sunSprite.naturalWidth > 0) {
            const diameterPx = MenuAtmosphereLayer.SUN_RADIUS_PX * 2;
            this.context.drawImage(
                this.sunSprite,
                sunCenter.x - MenuAtmosphereLayer.SUN_RADIUS_PX,
                sunCenter.y - MenuAtmosphereLayer.SUN_RADIUS_PX,
                diameterPx,
                diameterPx
            );
        } else if (this.sunPlasmaGradient) {
            // Use cached plasma gradient fallback
            this.context.fillStyle = this.sunPlasmaGradient;
            this.context.beginPath();
            this.context.arc(
                sunCenter.x,
                sunCenter.y,
                MenuAtmosphereLayer.SUN_RADIUS_PX,
                0,
                Math.PI * 2
            );
            this.context.fill();
        }

        this.context.restore();
    }

    private renderAsteroids(): void {
        // Add viewport culling with margin to skip off-screen asteroids
        const cullMargin = 50; // Small margin to ensure smooth transitions
        const minX = -cullMargin;
        const minY = -cullMargin;
        const maxX = this.widthPx + cullMargin;
        const maxY = this.heightPx + cullMargin;
        
        for (const asteroid of this.asteroids) {
            // Skip rendering if asteroid is outside viewport
            if (asteroid.x + asteroid.radiusPx < minX || 
                asteroid.x - asteroid.radiusPx > maxX ||
                asteroid.y + asteroid.radiusPx < minY || 
                asteroid.y - asteroid.radiusPx > maxY) {
                continue;
            }
            
            // Dropshadow removed per requirements
            this.renderAsteroidBody(asteroid);
        }
    }

    private renderAsteroidShadow(
        asteroid: MenuAsteroid,
        points: { x: number; y: number }[],
        sunCenter: { x: number; y: number }
    ): void {
        const shadowOffset = this.getShadowOffset(asteroid, sunCenter);
        const shadowLength =
            MenuAtmosphereLayer.SHADOW_LENGTH_BASE_PX +
            asteroid.radiusPx * MenuAtmosphereLayer.SHADOW_LENGTH_MULTIPLIER;

        this.context.fillStyle = 'rgba(20, 14, 12, 0.45)';
        this.context.beginPath();
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (i === 0) {
                this.context.moveTo(point.x, point.y);
            } else {
                this.context.lineTo(point.x, point.y);
            }
        }
        for (let i = points.length - 1; i >= 0; i--) {
            const point = points[i];
            this.context.lineTo(
                point.x + shadowOffset.x * shadowLength,
                point.y + shadowOffset.y * shadowLength
            );
        }
        this.context.closePath();
        this.context.fill();
    }

    private renderAsteroidBody(asteroid: MenuAsteroid): void {
        // Save context and apply transform for the gradient
        this.context.save();
        this.context.translate(asteroid.x, asteroid.y);
        // Scale the context to match asteroid size so the normalized gradient scales correctly
        this.context.scale(asteroid.radiusPx, asteroid.radiusPx);
        
        // Use cached asteroid gradient (now properly scaled)
        if (this.asteroidLightGradient) {
            this.context.fillStyle = this.asteroidLightGradient;
        }
        
        this.context.beginPath();
        const basePoints = asteroid.points;
        for (let i = 0; i < basePoints.length; i++) {
            const point = basePoints[i];
            const angleRad = point.angleRad + asteroid.rotationRad;
            const radiusScale = point.radiusScale;
            const x = Math.cos(angleRad) * radiusScale;
            const y = Math.sin(angleRad) * radiusScale;
            if (i === 0) {
                this.context.moveTo(x, y);
            } else {
                this.context.lineTo(x, y);
            }
        }
        this.context.closePath();
        this.context.fill();

        this.context.strokeStyle = 'rgba(255, 196, 107, 0.35)';
        // Since context is scaled by asteroid.radiusPx, divide lineWidth to maintain 1px visual width
        this.context.lineWidth = 1 / asteroid.radiusPx;
        this.context.stroke();
        
        this.context.restore();
    }

    private getSunCenter(): { x: number; y: number } {
        return {
            x: MenuAtmosphereLayer.SUN_RADIUS_PX + MenuAtmosphereLayer.SUN_OFFSET_X_PX,
            y: MenuAtmosphereLayer.SUN_RADIUS_PX + MenuAtmosphereLayer.SUN_OFFSET_Y_PX,
        };
    }

    private getShadowOffset(asteroid: MenuAsteroid, sunCenter: { x: number; y: number }): { x: number; y: number } {
        const deltaX = asteroid.x - sunCenter.x;
        const deltaY = asteroid.y - sunCenter.y;
        const distance = Math.max(1, Math.hypot(deltaX, deltaY));
        const normX = deltaX / distance;
        const normY = deltaY / distance;
        return {
            x: normX,
            y: normY,
        };
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
