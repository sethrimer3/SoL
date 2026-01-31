/**
 * Particle menu layer for interactive menu effects
 */

import { Particle, ParticleTarget } from './background-particles';

export class ParticleMenuLayer {
    private static readonly REFRESH_INTERVAL_MS = 140;
    private static readonly POSITION_SMOOTHING = 0.08 / 14;
    private static readonly DRIFT_SPEED = 0.0007 / 6;
    private static readonly DRIFT_RADIUS_MIN_PX = 0.03;
    private static readonly DRIFT_RADIUS_MAX_PX = 0.11;
    private static readonly COLOR_SMOOTHING = 0.08;
    private static readonly PARTICLE_SIZE_PX = 1.6;
    private static readonly RELOCATE_MIN_DISTANCE_PX = 4;
    private static readonly RELOCATE_MAX_DISTANCE_PX = 12;
    private static readonly BASE_PARTICLE_OPACITY = 0.15;
    private static readonly PEAK_PARTICLE_OPACITY = 0.4;
    private static readonly TRANSITION_DURATION_MS = 600;

    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private offscreenCanvas: HTMLCanvasElement;
    private offscreenContext: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private animationFrameId: number | null = null;
    private isActive: boolean = false;
    private needsTargetRefresh: boolean = false;
    private lastTargetRefreshMs: number = 0;
    private targetRefreshContainer: HTMLElement | null = null;
    private densityMultiplier: number = 1;
    private desiredParticleCount: number = 0;
    private menuContentElement: HTMLElement | null = null;
    private particleOpacity: number = ParticleMenuLayer.BASE_PARTICLE_OPACITY;
    private menuOpacity: number = 1;
    private transitionStartMs: number | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '2';

        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Unable to create menu particle canvas context.');
        }
        this.context = context;

        this.offscreenCanvas = document.createElement('canvas');
        const offscreenContext = this.offscreenCanvas.getContext('2d');
        if (!offscreenContext) {
            throw new Error('Unable to create offscreen particle canvas context.');
        }
        this.offscreenContext = offscreenContext;

        this.container.appendChild(this.canvas);
        // Defer initial resize to ensure container has layout dimensions
        requestAnimationFrame(() => {
            try {
                this.resize();
            } catch (error) {
                console.error('Failed to resize particle canvas:', error);
            }
        });
        this.start();
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
        const rect = this.container.getBoundingClientRect();
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    public setMenuContentElement(element: HTMLElement): void {
        this.menuContentElement = element;
        this.applyMenuOpacity();
    }

    public requestTargetRefresh(container: HTMLElement): void {
        this.needsTargetRefresh = true;
        this.targetRefreshContainer = container;
    }

    public clearTargets(): void {
        this.setTargets([]);
    }

    public setDensityMultiplier(multiplier: number): void {
        this.densityMultiplier = Math.max(0.5, multiplier);
    }

    public startTransition(): void {
        this.transitionStartMs = performance.now();
    }

    private animate(): void {
        if (!this.isActive) {
            return;
        }

        const nowMs = performance.now();
        if (
            this.needsTargetRefresh
            && this.targetRefreshContainer
            && nowMs - this.lastTargetRefreshMs >= ParticleMenuLayer.REFRESH_INTERVAL_MS
        ) {
            this.updateTargetsFromElements(this.targetRefreshContainer);
            this.lastTargetRefreshMs = nowMs;
            this.needsTargetRefresh = false;
        }

        this.updateParticles(nowMs);
        this.renderParticles();
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    private updateTargetsFromElements(container: HTMLElement): void {
        const targets = this.collectTargets(container);
        this.setTargets(targets);
    }

    private setTargets(targets: ParticleTarget[]): void {
        const updatedParticles: Particle[] = [];
        const targetCount = targets.length;

        if (targetCount === 0) {
            this.particles = updatedParticles;
            this.desiredParticleCount = 0;
            return;
        }

        this.desiredParticleCount = targetCount;

        const desiredCount = this.desiredParticleCount;
        const existingParticles = this.particles.slice();
        if (existingParticles.length > desiredCount) {
            existingParticles.length = desiredCount;
        }

        while (existingParticles.length < desiredCount) {
            const seed = targets[existingParticles.length % targetCount];
            existingParticles.push(this.createParticle(seed.x, seed.y, seed.color));
        }

        for (let i = 0; i < desiredCount; i++) {
            const target = targets[i % targetCount];
            const particle = existingParticles[i];
            const relocatedTarget = this.getRelocatedTarget(target);
            particle.targetX = relocatedTarget.x;
            particle.targetY = relocatedTarget.y;
            particle.baseTargetX = relocatedTarget.x;
            particle.baseTargetY = relocatedTarget.y;
            const targetColor = this.parseColor(target.color);
            particle.targetColorR = targetColor.r;
            particle.targetColorG = targetColor.g;
            particle.targetColorB = targetColor.b;
            particle.sizePx = ParticleMenuLayer.PARTICLE_SIZE_PX;
            updatedParticles.push(particle);
        }

        this.particles = updatedParticles;
    }

    private createParticle(x: number, y: number, color: string): Particle {
        const driftPhase = Math.random() * Math.PI * 2;
        const driftRadiusPx = ParticleMenuLayer.DRIFT_RADIUS_MIN_PX
            + Math.random() * (ParticleMenuLayer.DRIFT_RADIUS_MAX_PX - ParticleMenuLayer.DRIFT_RADIUS_MIN_PX);
        const speedMultiplier = 0.8 + Math.random() * 0.4; // Random value between 0.8 and 1.2
        const parsedColor = this.parseColor(color);
        return {
            x,
            y,
            velocityX: 0,
            velocityY: 0,
            targetX: x,
            targetY: y,
            baseTargetX: x,
            baseTargetY: y,
            colorR: parsedColor.r,
            colorG: parsedColor.g,
            colorB: parsedColor.b,
            targetColorR: parsedColor.r,
            targetColorG: parsedColor.g,
            targetColorB: parsedColor.b,
            sizePx: ParticleMenuLayer.PARTICLE_SIZE_PX,
            driftPhase,
            driftRadiusPx,
            speedMultiplier,
        };
    }

    private getRelocatedTarget(target: ParticleTarget): { x: number; y: number } {
        const minDistancePx = ParticleMenuLayer.RELOCATE_MIN_DISTANCE_PX;
        const maxDistancePx = ParticleMenuLayer.RELOCATE_MAX_DISTANCE_PX;
        const distancePx = minDistancePx + Math.random() * (maxDistancePx - minDistancePx);
        const angleRad = Math.random() * Math.PI * 2;
        return {
            x: target.x + Math.cos(angleRad) * distancePx,
            y: target.y + Math.sin(angleRad) * distancePx,
        };
    }

    private updateParticles(nowMs: number): void {
        this.updateTransition(nowMs);
        const driftTime = nowMs * ParticleMenuLayer.DRIFT_SPEED;
        for (const particle of this.particles) {
            const particleDriftTime = driftTime * particle.speedMultiplier;
            const driftX = Math.cos(particle.driftPhase + particleDriftTime) * particle.driftRadiusPx;
            const driftY = Math.sin(particle.driftPhase + particleDriftTime) * particle.driftRadiusPx;

            particle.baseTargetX = particle.targetX + driftX;
            particle.baseTargetY = particle.targetY + driftY;

            const deltaX = particle.baseTargetX - particle.x;
            const deltaY = particle.baseTargetY - particle.y;

            const positionSmoothing = ParticleMenuLayer.POSITION_SMOOTHING * particle.speedMultiplier;
            particle.velocityX += deltaX * positionSmoothing;
            particle.velocityY += deltaY * positionSmoothing;

            particle.velocityX *= 0.82;
            particle.velocityY *= 0.82;

            particle.x += particle.velocityX;
            particle.y += particle.velocityY;

            particle.colorR += (particle.targetColorR - particle.colorR) * ParticleMenuLayer.COLOR_SMOOTHING;
            particle.colorG += (particle.targetColorG - particle.colorG) * ParticleMenuLayer.COLOR_SMOOTHING;
            particle.colorB += (particle.targetColorB - particle.colorB) * ParticleMenuLayer.COLOR_SMOOTHING;
        }
    }

    private updateTransition(nowMs: number): void {
        if (this.transitionStartMs === null) {
            this.particleOpacity = ParticleMenuLayer.BASE_PARTICLE_OPACITY;
            this.menuOpacity = 1;
            this.applyMenuOpacity();
            return;
        }

        const elapsedMs = nowMs - this.transitionStartMs;
        const totalDurationMs = ParticleMenuLayer.TRANSITION_DURATION_MS;
        const halfDurationMs = totalDurationMs / 2;

        if (elapsedMs >= totalDurationMs) {
            this.transitionStartMs = null;
            this.particleOpacity = ParticleMenuLayer.BASE_PARTICLE_OPACITY;
            this.menuOpacity = 1;
            this.applyMenuOpacity();
            return;
        }

        if (elapsedMs <= halfDurationMs) {
            const progress = elapsedMs / halfDurationMs;
            this.particleOpacity = ParticleMenuLayer.BASE_PARTICLE_OPACITY
                + (ParticleMenuLayer.PEAK_PARTICLE_OPACITY - ParticleMenuLayer.BASE_PARTICLE_OPACITY) * progress;
            this.menuOpacity = 1 - progress;
        } else {
            const progress = (elapsedMs - halfDurationMs) / halfDurationMs;
            this.particleOpacity = ParticleMenuLayer.PEAK_PARTICLE_OPACITY
                + (ParticleMenuLayer.BASE_PARTICLE_OPACITY - ParticleMenuLayer.PEAK_PARTICLE_OPACITY) * progress;
            this.menuOpacity = progress;
        }

        this.applyMenuOpacity();
    }

    private applyMenuOpacity(): void {
        if (this.menuContentElement) {
            this.menuContentElement.style.opacity = this.menuOpacity.toFixed(3);
        }
    }

    private renderParticles(): void {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        this.context.clearRect(0, 0, width, height);
        this.context.globalCompositeOperation = 'lighter';
        this.context.globalAlpha = this.particleOpacity;

        for (const particle of this.particles) {
            const red = Math.min(255, Math.max(0, Math.round(particle.colorR)));
            const green = Math.min(255, Math.max(0, Math.round(particle.colorG)));
            const blue = Math.min(255, Math.max(0, Math.round(particle.colorB)));
            this.context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.sizePx, 0, Math.PI * 2);
            this.context.fill();
        }

        this.context.globalAlpha = 1;
        this.context.globalCompositeOperation = 'source-over';
    }

    private collectTargets(container: HTMLElement): ParticleTarget[] {
        const elements = Array.from(
            container.querySelectorAll<HTMLElement>('[data-particle-text], [data-particle-box]')
        );
        const targets: ParticleTarget[] = [];

        for (const element of elements) {
            if (element.dataset.particleText !== undefined) {
                targets.push(...this.collectTextTargets(element));
            }
            if (element.dataset.particleBox !== undefined) {
                targets.push(...this.collectBoxTargets(element));
            }
        }

        return targets;
    }

    private collectTextTargets(element: HTMLElement): ParticleTarget[] {
        const text = element.textContent?.trim();
        if (!text) {
            return [];
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return [];
        }

        const computedStyle = window.getComputedStyle(element);
        const fontSizePx = Number.parseFloat(computedStyle.fontSize) || 16;
        const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
        const fontWeight = computedStyle.fontWeight || '600';
        const textColor = element.dataset.particleColor || '#FFFFFF';
        const baseSpacingPx = Math.max(3, Math.round(fontSizePx / 7.5));
        const spacingPx = Math.max(2, Math.round(baseSpacingPx / this.densityMultiplier));

        this.offscreenCanvas.width = Math.ceil(rect.width);
        this.offscreenCanvas.height = Math.ceil(rect.height);

        this.offscreenContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        this.offscreenContext.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
        this.offscreenContext.textAlign = 'center';
        this.offscreenContext.textBaseline = 'middle';
        this.offscreenContext.fillStyle = '#FFFFFF';
        this.offscreenContext.fillText(text, this.offscreenCanvas.width / 2, this.offscreenCanvas.height / 2);

        const imageData = this.offscreenContext.getImageData(
            0,
            0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height
        );
        const data = imageData.data;
        const targets: ParticleTarget[] = [];
        const startX = spacingPx / 2;
        const startY = spacingPx / 2;

        for (let y = startY; y < this.offscreenCanvas.height; y += spacingPx) {
            for (let x = startX; x < this.offscreenCanvas.width; x += spacingPx) {
                const index = (Math.floor(y) * this.offscreenCanvas.width + Math.floor(x)) * 4 + 3;
                if (data[index] > 80) {
                    targets.push({
                        x: rect.left + x,
                        y: rect.top + y,
                        color: textColor,
                    });
                }
            }
        }

        return targets;
    }

    private collectBoxTargets(element: HTMLElement): ParticleTarget[] {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return [];
        }

        const color = element.dataset.particleColor || '#FFFFFF';
        const baseSpacingPx = Math.max(6, Math.round(Math.min(rect.width, rect.height) / 12));
        const spacingPx = Math.max(3, Math.round(baseSpacingPx / this.densityMultiplier));
        const targets: ParticleTarget[] = [];

        const left = rect.left;
        const right = rect.right;
        const top = rect.top;
        const bottom = rect.bottom;

        for (let x = left; x <= right; x += spacingPx) {
            targets.push({ x, y: top, color });
            targets.push({ x, y: bottom, color });
        }
        for (let y = top; y <= bottom; y += spacingPx) {
            targets.push({ x: left, y, color });
            targets.push({ x: right, y, color });
        }

        return targets;
    }

    private parseColor(color: string): { r: number; g: number; b: number } {
        const trimmed = color.trim();
        if (trimmed.startsWith('#')) {
            const hex = trimmed.slice(1);
            if (hex.length === 3) {
                const r = Number.parseInt(hex[0] + hex[0], 16);
                const g = Number.parseInt(hex[1] + hex[1], 16);
                const b = Number.parseInt(hex[2] + hex[2], 16);
                return { r, g, b };
            }
            if (hex.length === 6) {
                const r = Number.parseInt(hex.slice(0, 2), 16);
                const g = Number.parseInt(hex.slice(2, 4), 16);
                const b = Number.parseInt(hex.slice(4, 6), 16);
                return { r, g, b };
            }
        }
        return { r: 255, g: 255, b: 255 };
    }
}
