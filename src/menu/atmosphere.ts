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
    private static readonly SUN_OFFSET_X_PX = -28;
    private static readonly SUN_OFFSET_Y_PX = -22;
    private static readonly SHADOW_LENGTH_BASE_PX = 120;
    private static readonly SHADOW_LENGTH_MULTIPLIER = 7.5;
    private static readonly BOUNDS_MARGIN_PX = 80;

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

        this.container.appendChild(this.canvas);
        this.resize();
        this.initializeAsteroids();
        // Don't auto-start - let resumeMenuAnimations() start it after menu is in DOM
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
        this.renderSunGlow();
        this.renderAsteroids();
    }

    private renderSunGlow(): void {
        const sunCenter = this.getSunCenter();
        const gradient = this.context.createRadialGradient(
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_RADIUS_PX * 0.35,
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_GLOW_RADIUS_PX
        );
        gradient.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
        gradient.addColorStop(0.4, 'rgba(255, 200, 120, 0.5)');
        gradient.addColorStop(0.7, 'rgba(255, 150, 80, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 120, 40, 0)');

        this.context.fillStyle = gradient;
        this.context.beginPath();
        this.context.arc(
            sunCenter.x,
            sunCenter.y,
            MenuAtmosphereLayer.SUN_GLOW_RADIUS_PX,
            0,
            Math.PI * 2
        );
        this.context.fill();

        if (this.sunSprite.complete && this.sunSprite.naturalWidth > 0) {
            const diameterPx = MenuAtmosphereLayer.SUN_RADIUS_PX * 2;
            this.context.drawImage(
                this.sunSprite,
                sunCenter.x - MenuAtmosphereLayer.SUN_RADIUS_PX,
                sunCenter.y - MenuAtmosphereLayer.SUN_RADIUS_PX,
                diameterPx,
                diameterPx
            );
        } else {
            this.context.fillStyle = 'rgba(255, 215, 120, 0.95)';
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
    }

    private renderAsteroids(): void {
        const sunCenter = this.getSunCenter();
        for (const asteroid of this.asteroids) {
            const points = this.getAsteroidPoints(asteroid);
            // Dropshadow removed per requirements
            this.renderAsteroidBody(asteroid, points);
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

    private renderAsteroidBody(asteroid: MenuAsteroid, points: { x: number; y: number }[]): void {
        this.context.fillStyle = 'rgba(170, 160, 140, 0.8)';
        this.context.beginPath();
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (i === 0) {
                this.context.moveTo(point.x, point.y);
            } else {
                this.context.lineTo(point.x, point.y);
            }
        }
        this.context.closePath();
        this.context.fill();

        this.context.strokeStyle = 'rgba(120, 105, 90, 0.65)';
        this.context.lineWidth = 1;
        this.context.stroke();
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

    private getAsteroidPoints(asteroid: MenuAsteroid): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const basePoints = asteroid.points;
        for (let i = 0; i < basePoints.length; i++) {
            const point = basePoints[i];
            const angleRad = point.angleRad + asteroid.rotationRad;
            const radiusPx = asteroid.radiusPx * point.radiusScale;
            points.push({
                x: asteroid.x + Math.cos(angleRad) * radiusPx,
                y: asteroid.y + Math.sin(angleRad) * radiusPx,
            });
        }
        return points;
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
