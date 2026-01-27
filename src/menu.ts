/**
 * Main Menu for SoL game
 */

import * as Constants from './constants';
import { Faction } from './game-core';

export interface MenuOption {
    id: string;
    name: string;
    description: string;
    icon?: string;
}

interface FactionCarouselOption {
    id: Faction;
    name: string;
    description: string;
    color: string;
}

export interface MapConfig {
    id: string;
    name: string;
    description: string;
    numSuns: number;
    numAsteroids: number;
    mapSize: number;
}

export interface HeroUnit {
    id: string;
    name: string;
    description: string;
    faction: Faction;
    // Combat stats
    maxHealth: number;
    attackDamage: number;
    attackSpeed: number; // attacks per second
    attackRange: number;
    attackIgnoresDefense: boolean;
    // Defensive stats
    defense: number; // percentage damage reduction (0-100)
    regen: number; // percentage of health recovered in influence field (0-100)
    // Ability
    abilityDescription: string;
}

export interface BaseLoadout {
    id: string;
    name: string;
    description: string;
    faction: Faction;
}

export interface SpawnLoadout {
    id: string;
    name: string;
    description: string;
    faction: Faction;
}

interface ParticleTarget {
    x: number;
    y: number;
    color: string;
}

interface Particle {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    targetX: number;
    targetY: number;
    baseTargetX: number;
    baseTargetY: number;
    colorR: number;
    colorG: number;
    colorB: number;
    targetColorR: number;
    targetColorG: number;
    targetColorB: number;
    sizePx: number;
    driftPhase: number;
    driftRadiusPx: number;
    speedMultiplier: number; // Random multiplier for natural motion (0.8-1.2)
}

interface BackgroundParticle {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    colorR: number;
    colorG: number;
    colorB: number;
    targetColorR: number;
    targetColorG: number;
    targetColorB: number;
    radius: number;
}

class BackgroundParticleLayer {
    private static readonly PARTICLE_COUNT = 8;
    private static readonly PARTICLE_RADIUS = 250;
    private static readonly MAX_VELOCITY = 0.3;
    private static readonly FRICTION = 0.98;
    private static readonly COLOR_TRANSITION_SPEED = 0.002;
    private static readonly ATTRACTION_STRENGTH = 0.15;
    private static readonly COLOR_CHANGE_INTERVAL_MS = 8000;
    
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private particles: BackgroundParticle[] = [];
    private attractionMatrix: number[][] = [];
    private animationFrameId: number | null = null;
    private isActive: boolean = false;
    private lastColorChangeMs: number = 0;
    
    private readonly gradientColors = [
        [138, 43, 226],   // Blue Violet
        [147, 51, 234],   // Purple
        [219, 39, 119],   // Pink
        [236, 72, 153],   // Light Pink
        [59, 130, 246],   // Blue
        [14, 165, 233],   // Sky Blue
        [168, 85, 247],   // Violet
        [192, 132, 252]   // Light Purple
    ];
    
    constructor(container: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '-1';
        
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Unable to create background particle canvas context. This may be due to browser compatibility or system limitations.');
        }
        this.context = context;
        
        container.appendChild(this.canvas);
        
        this.resize();
        this.initializeParticles();
        this.initializeAttractionMatrix();
        this.start();
    }
    
    private initializeParticles(): void {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.particles = [];
        for (let i = 0; i < BackgroundParticleLayer.PARTICLE_COUNT; i++) {
            const color = this.gradientColors[i % this.gradientColors.length];
            const particle: BackgroundParticle = {
                x: Math.random() * width,
                y: Math.random() * height,
                velocityX: (Math.random() - 0.5) * 0.5,
                velocityY: (Math.random() - 0.5) * 0.5,
                colorR: color[0],
                colorG: color[1],
                colorB: color[2],
                targetColorR: color[0],
                targetColorG: color[1],
                targetColorB: color[2],
                radius: BackgroundParticleLayer.PARTICLE_RADIUS
            };
            this.particles.push(particle);
        }
    }
    
    private initializeAttractionMatrix(): void {
        this.attractionMatrix = [];
        for (let i = 0; i < BackgroundParticleLayer.PARTICLE_COUNT; i++) {
            this.attractionMatrix[i] = [];
            for (let j = 0; j < BackgroundParticleLayer.PARTICLE_COUNT; j++) {
                if (i === j) {
                    this.attractionMatrix[i][j] = 0;
                } else {
                    // Random attraction (-0.5 to 0.5): negative = repulsion, positive = attraction
                    this.attractionMatrix[i][j] = (Math.random() - 0.5) * BackgroundParticleLayer.ATTRACTION_STRENGTH;
                }
            }
        }
    }
    
    public resize(): void {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.canvas.width = Math.round(width * devicePixelRatio);
        this.canvas.height = Math.round(height * devicePixelRatio);
        this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    
    public start(): void {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.lastColorChangeMs = performance.now();
        this.animate();
    }
    
    public stop(): void {
        this.isActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    private animate(): void {
        if (!this.isActive) {
            return;
        }
        
        const nowMs = performance.now();
        
        // Periodically change target colors for smooth transitions
        if (nowMs - this.lastColorChangeMs >= BackgroundParticleLayer.COLOR_CHANGE_INTERVAL_MS) {
            this.updateTargetColors();
            this.lastColorChangeMs = nowMs;
        }
        
        this.updateParticles();
        this.render();
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    private updateTargetColors(): void {
        for (let i = 0; i < this.particles.length; i++) {
            const colorIndex = Math.floor(Math.random() * this.gradientColors.length);
            const color = this.gradientColors[colorIndex];
            this.particles[i].targetColorR = color[0];
            this.particles[i].targetColorG = color[1];
            this.particles[i].targetColorB = color[2];
        }
    }
    
    private updateParticles(): void {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Apply attraction/repulsion forces
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            
            for (let j = 0; j < this.particles.length; j++) {
                if (i === j) continue;
                
                const p2 = this.particles[j];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const force = this.attractionMatrix[i][j];
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;
                    
                    p1.velocityX += forceX;
                    p1.velocityY += forceY;
                }
            }
            
            // Apply friction
            p1.velocityX *= BackgroundParticleLayer.FRICTION;
            p1.velocityY *= BackgroundParticleLayer.FRICTION;
            
            // Limit velocity
            const speed = Math.sqrt(p1.velocityX * p1.velocityX + p1.velocityY * p1.velocityY);
            if (speed > BackgroundParticleLayer.MAX_VELOCITY) {
                p1.velocityX = (p1.velocityX / speed) * BackgroundParticleLayer.MAX_VELOCITY;
                p1.velocityY = (p1.velocityY / speed) * BackgroundParticleLayer.MAX_VELOCITY;
            }
            
            // Update position
            p1.x += p1.velocityX;
            p1.y += p1.velocityY;
            
            // Wrap around screen edges
            if (p1.x < -p1.radius) p1.x = width + p1.radius;
            if (p1.x > width + p1.radius) p1.x = -p1.radius;
            if (p1.y < -p1.radius) p1.y = height + p1.radius;
            if (p1.y > height + p1.radius) p1.y = -p1.radius;
            
            // Smoothly transition colors
            p1.colorR += (p1.targetColorR - p1.colorR) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
            p1.colorG += (p1.targetColorG - p1.colorG) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
            p1.colorB += (p1.targetColorB - p1.colorB) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
        }
    }
    
    private render(): void {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Clear with black background
        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, width, height);
        
        // Draw particles with blur effect (reduced blur for better performance)
        this.context.filter = 'blur(60px)';
        this.context.globalCompositeOperation = 'screen';
        
        for (const particle of this.particles) {
            const gradient = this.context.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.radius
            );
            
            const r = Math.round(particle.colorR);
            const g = Math.round(particle.colorG);
            const b = Math.round(particle.colorB);
            
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            
            this.context.fillStyle = gradient;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.context.fill();
        }
        
        this.context.filter = 'none';
        this.context.globalCompositeOperation = 'source-over';
    }
    
    public destroy(): void {
        this.stop();
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }
}

class ParticleMenuLayer {
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

export interface GameSettings {
    selectedMap: MapConfig;
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
    isBattleStatsInfoEnabled: boolean;
    selectedFaction: Faction | null;
    selectedHeroes: string[]; // Hero IDs
    selectedHeroNames: string[];
    playerColor: string;
    enemyColor: string;
    selectedBaseLoadout: string | null; // Base loadout ID
    selectedSpawnLoadout: string | null; // Spawn loadout ID
}

export class MainMenu {
    private menuElement: HTMLElement;
    private contentElement!: HTMLElement;
    private backgroundParticleLayer: BackgroundParticleLayer | null = null;
    private menuParticleLayer: ParticleMenuLayer | null = null;
    private resizeHandler: (() => void) | null = null;
    private onStartCallback: ((settings: GameSettings) => void) | null = null;
    private currentScreen: 'main' | 'maps' | 'settings' | 'faction-select' | 'loadout-customization' | 'loadout-select' = 'main';
    private settings: GameSettings;
    private carouselMenu: CarouselMenuView | null = null;
    private factionCarousel: FactionCarouselView | null = null;
    
    // Hero unit data with complete stats
    private heroUnits: HeroUnit[] = [
        // Radiant faction heroes
        { 
            id: 'radiant-marine', name: 'Marine', description: 'Rapid-fire ranged specialist', faction: Faction.RADIANT,
            maxHealth: Constants.MARINE_MAX_HEALTH, attackDamage: Constants.MARINE_ATTACK_DAMAGE, attackSpeed: Constants.MARINE_ATTACK_SPEED,
            attackRange: Constants.MARINE_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 4,
            abilityDescription: 'Bullet storm: fires a spread of shots toward a target direction'
        },
        { 
            id: 'radiant-grave', name: 'Grave', description: 'Gravitic sentinel with orbiting projectiles', faction: Faction.RADIANT,
            maxHealth: Constants.GRAVE_MAX_HEALTH, attackDamage: Constants.GRAVE_ATTACK_DAMAGE, attackSpeed: Constants.GRAVE_ATTACK_SPEED,
            attackRange: Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER,
            attackIgnoresDefense: false, defense: 18, regen: 3,
            abilityDescription: 'Orbits gravitic shards that launch at targets and return'
        },
        {
            id: 'radiant-ray', name: 'Ray', description: 'Bouncing beam marks targets', faction: Faction.RADIANT,
            maxHealth: Constants.RAY_MAX_HEALTH, attackDamage: Constants.RAY_ATTACK_DAMAGE, attackSpeed: Constants.RAY_ATTACK_SPEED,
            attackRange: Constants.RAY_ATTACK_RANGE, attackIgnoresDefense: true, defense: 8, regen: 5,
            abilityDescription: 'Solar ricochet: beam bounces between multiple enemies'
        },
        {
            id: 'radiant-influence-ball', name: 'Influence Ball', description: 'Deploys temporary influence zones', faction: Faction.RADIANT,
            maxHealth: Constants.INFLUENCE_BALL_MAX_HEALTH, attackDamage: Constants.INFLUENCE_BALL_ATTACK_DAMAGE, attackSpeed: Constants.INFLUENCE_BALL_ATTACK_SPEED,
            attackRange: Constants.INFLUENCE_BALL_ATTACK_RANGE, attackIgnoresDefense: false, defense: 12, regen: 6,
            abilityDescription: 'Influence surge: expand an influence zone at target location'
        },
        {
            id: 'radiant-turret-deployer', name: 'Turret Deployer', description: 'Deploys automated turrets on asteroids', faction: Faction.RADIANT,
            maxHealth: Constants.TURRET_DEPLOYER_MAX_HEALTH, attackDamage: Constants.TURRET_DEPLOYER_ATTACK_DAMAGE, attackSpeed: Constants.TURRET_DEPLOYER_ATTACK_SPEED,
            attackRange: Constants.TURRET_DEPLOYER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 4,
            abilityDescription: 'Deploy turret: places a turret on a nearby asteroid'
        },
        {
            id: 'radiant-driller', name: 'Driller', description: 'Burrows through asteroids to flank', faction: Faction.RADIANT,
            maxHealth: Constants.DRILLER_MAX_HEALTH, attackDamage: Constants.DRILLER_ATTACK_DAMAGE, attackSpeed: Constants.DRILLER_ATTACK_SPEED,
            attackRange: Constants.DRILLER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 16, regen: 3,
            abilityDescription: 'Drill charge: tunnels through an asteroid toward the target'
        },
        {
            id: 'radiant-dagger', name: 'Dagger', description: 'Cloaked assassin with burst damage', faction: Faction.RADIANT,
            maxHealth: Constants.DAGGER_MAX_HEALTH, attackDamage: Constants.DAGGER_ATTACK_DAMAGE, attackSpeed: Constants.DAGGER_ATTACK_SPEED,
            attackRange: Constants.DAGGER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 5, regen: 3,
            abilityDescription: 'Shadow strike: short-range burst attack, reveals Dagger for 8 seconds'
        },
        {
            id: 'radiant-beam', name: 'Beam', description: 'Sniper with distance-based damage multiplier', faction: Faction.RADIANT,
            maxHealth: Constants.BEAM_MAX_HEALTH, attackDamage: Constants.BEAM_ATTACK_DAMAGE, attackSpeed: Constants.BEAM_ATTACK_SPEED,
            attackRange: Constants.BEAM_ATTACK_RANGE, attackIgnoresDefense: true, defense: 6, regen: 3,
            abilityDescription: 'Precision shot: long-range beam that does more damage at greater distances'
        }
    ];
    
    private availableMaps: MapConfig[] = [
        {
            id: 'standard',
            name: 'Standard Battle',
            description: 'Classic 1v1 map with a single sun at the center. Balanced gameplay with moderate obstacles.',
            numSuns: 1,
            numAsteroids: 10,
            mapSize: 2000
        },
        {
            id: 'twin-suns',
            name: 'Twin Suns',
            description: 'Two suns create complex lighting patterns. Control multiple light sources for economic dominance.',
            numSuns: 2,
            numAsteroids: 12,
            mapSize: 2500
        },
        {
            id: 'asteroid-field',
            name: 'Asteroid Field',
            description: 'Dense asteroid field creates tactical challenges. Careful mirror placement is crucial.',
            numSuns: 1,
            numAsteroids: 20,
            mapSize: 2000
        },
        {
            id: 'open-space',
            name: 'Open Space',
            description: 'Minimal obstacles in a vast arena. Pure strategic combat with fewer terrain advantages.',
            numSuns: 1,
            numAsteroids: 5,
            mapSize: 3000
        }
    ];

    private baseLoadouts: BaseLoadout[] = [
        // Radiant faction bases
        { id: 'radiant-standard', name: 'Standard Forge', description: 'Balanced base with standard production', faction: Faction.RADIANT },
        { id: 'radiant-fortified', name: 'Fortified Forge', description: 'Enhanced defensive capabilities with thicker armor', faction: Faction.RADIANT },
        { id: 'radiant-rapid', name: 'Rapid Forge', description: 'Faster production speed at the cost of durability', faction: Faction.RADIANT },
        // Aurum faction bases
        { id: 'aurum-standard', name: 'Standard Vault', description: 'Balanced base with standard production', faction: Faction.AURUM },
        { id: 'aurum-wealth', name: 'Wealth Vault', description: 'Increased resource generation capacity', faction: Faction.AURUM },
        { id: 'aurum-compact', name: 'Compact Vault', description: 'Smaller footprint, easier to defend', faction: Faction.AURUM },
        // Solari faction bases
        { id: 'solari-standard', name: 'Standard Temple', description: 'Balanced base with standard production', faction: Faction.SOLARI },
        { id: 'solari-solar', name: 'Solar Temple', description: 'Enhanced solar collection efficiency', faction: Faction.SOLARI },
        { id: 'solari-titan', name: 'Titan Temple', description: 'Massive health pool, slower to build', faction: Faction.SOLARI },
    ];

    private spawnLoadouts: SpawnLoadout[] = [
        // Radiant faction spawns
        { id: 'radiant-standard', name: 'Standard Starlings', description: 'Balanced minions with standard stats', faction: Faction.RADIANT },
        { id: 'radiant-swarm', name: 'Swarm Starlings', description: 'More units but weaker individually', faction: Faction.RADIANT },
        { id: 'radiant-elite', name: 'Elite Starlings', description: 'Fewer units but stronger and more durable', faction: Faction.RADIANT },
        // Aurum faction spawns
        { id: 'aurum-standard', name: 'Standard Drones', description: 'Balanced minions with standard stats', faction: Faction.AURUM },
        { id: 'aurum-harvester', name: 'Harvester Drones', description: 'Gather resources more efficiently', faction: Faction.AURUM },
        { id: 'aurum-assault', name: 'Assault Drones', description: 'Higher damage output for aggressive play', faction: Faction.AURUM },
        // Solari faction spawns
        { id: 'solari-standard', name: 'Standard Zealots', description: 'Balanced minions with standard stats', faction: Faction.SOLARI },
        { id: 'solari-guardian', name: 'Guardian Zealots', description: 'Tankier units focused on defense', faction: Faction.SOLARI },
        { id: 'solari-blazing', name: 'Blazing Zealots', description: 'Fast-moving units with fire damage', faction: Faction.SOLARI },
    ];

    constructor() {
        // Initialize default settings
        this.settings = {
            selectedMap: this.availableMaps[0],
            difficulty: 'normal',
            soundEnabled: true,
            musicEnabled: true,
            isBattleStatsInfoEnabled: false,
            selectedFaction: null,
            selectedHeroes: [],
            selectedHeroNames: [],
            playerColor: '#66B3FF', // Somewhat light blue
            enemyColor: '#FF6B6B',   // Slightly light red
            selectedBaseLoadout: null,
            selectedSpawnLoadout: null
        };
        
        this.menuElement = this.createMenuElement();
        document.body.appendChild(this.menuElement);
    }

    private createMenuElement(): HTMLElement {
        const menu = document.createElement('div');
        menu.id = 'mainMenu';
        menu.style.position = 'fixed';
        menu.style.top = '0';
        menu.style.left = '0';
        menu.style.width = '100%';
        menu.style.height = '100%';
        menu.style.boxSizing = 'border-box';
        menu.style.backgroundColor = 'transparent';
        menu.style.zIndex = '1000';
        menu.style.fontFamily = '"Doto", Arial, sans-serif';
        menu.style.fontWeight = '300';
        menu.style.fontSize = '24px';
        menu.style.color = '#FFFFFF';
        menu.style.overflowY = 'auto';
        menu.style.overflowX = 'hidden';
        menu.style.isolation = 'isolate';

        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.zIndex = '1';
        content.style.width = '100%';
        content.style.minHeight = '100%';
        content.style.padding = '24px 16px';
        content.style.boxSizing = 'border-box';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.justifyContent = 'center';
        content.style.alignItems = 'center';
        menu.appendChild(content);

        this.contentElement = content;
        this.backgroundParticleLayer = new BackgroundParticleLayer(menu);
        this.menuParticleLayer = new ParticleMenuLayer(menu);
        this.menuParticleLayer.setMenuContentElement(content);

        // Render main screen content into the menu element
        this.renderMainScreenContent(content);

        this.resizeHandler = () => {
            this.backgroundParticleLayer?.resize();
            if (!this.menuParticleLayer) {
                return;
            }
            this.menuParticleLayer.resize();
            this.menuParticleLayer.requestTargetRefresh(this.contentElement);
        };
        window.addEventListener('resize', this.resizeHandler);
        menu.addEventListener('scroll', () => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        
        return menu;
    }

    private getSelectedHeroNames(): string[] {
        return this.heroUnits
            .filter(hero => this.settings.selectedHeroes.includes(hero.id))
            .map(hero => hero.name);
    }

    private clearMenu(): void {
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.factionCarousel) {
            this.factionCarousel.destroy();
            this.factionCarousel = null;
        }
        if (this.contentElement) {
            this.contentElement.innerHTML = '';
        }
    }

    private setMenuParticleDensity(multiplier: number): void {
        const densityScale = 2;
        this.menuParticleLayer?.setDensityMultiplier(multiplier * densityScale);
    }

    private startMenuTransition(): void {
        this.menuParticleLayer?.startTransition();
    }

    private renderMainScreen(container: HTMLElement): void {
        this.clearMenu();
        this.renderMainScreenContent(container);
    }

    private renderMainScreenContent(container: HTMLElement): void {
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;
        
        // Title
        const title = document.createElement('h1');
        title.textContent = 'SoL';
        title.style.fontSize = isCompactLayout ? '56px' : '88px';
        title.style.marginBottom = '10px';
        title.style.color = '#FFD700';
        title.style.textShadow = 'none';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Speed of Light RTS';
        subtitle.style.fontSize = isCompactLayout ? '24px' : '32px';
        subtitle.style.marginBottom = '30px';
        subtitle.style.color = '#AAAAAA';
        subtitle.style.textAlign = 'center';
        subtitle.style.maxWidth = '100%';
        subtitle.style.fontWeight = '300';
        subtitle.dataset.particleText = 'true';
        subtitle.dataset.particleColor = '#AAAAAA';
        container.appendChild(subtitle);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Select a menu option below';
        description.style.fontSize = isCompactLayout ? '24px' : '28px';
        description.style.marginBottom = '40px';
        description.style.maxWidth = '500px';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.5';
        description.style.color = '#C5C5C5';
        description.style.fontWeight = '300';
        description.dataset.particleText = 'true';
        description.dataset.particleColor = '#C5C5C5';
        container.appendChild(description);

        // Create carousel menu container
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
        carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
        carouselContainer.style.marginBottom = '40px';
        container.appendChild(carouselContainer);

        // Create carousel menu with main menu options
        const menuOptions: MenuOption[] = [
            {
                id: 'loadout',
                name: 'LOADOUT',
                description: 'Select faction & heroes'
            },
            {
                id: 'start',
                name: 'START',
                description: 'Begin game'
            },
            {
                id: 'maps',
                name: 'MAPS',
                description: 'Select map'
            },
            {
                id: 'settings',
                name: 'SETTINGS',
                description: 'Configure game'
            }
        ];

        this.carouselMenu = new CarouselMenuView(carouselContainer, menuOptions);
        this.carouselMenu.onRender(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onNavigate(() => {
            this.startMenuTransition();
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onSelect((option: MenuOption) => {
            switch (option.id) {
                case 'loadout':
                    this.currentScreen = 'faction-select';
                    this.startMenuTransition();
                    this.renderFactionSelectionScreen(this.contentElement);
                    break;
                case 'start':
                    this.hide();
                    if (this.onStartCallback) {
                        this.settings.selectedHeroNames = this.getSelectedHeroNames();
                        this.onStartCallback(this.settings);
                    }
                    break;
                case 'maps':
                    this.currentScreen = 'maps';
                    this.startMenuTransition();
                    this.renderMapSelectionScreen(this.contentElement);
                    break;
                case 'settings':
                    this.currentScreen = 'settings';
                    this.startMenuTransition();
                    this.renderSettingsScreen(this.contentElement);
                    break;
            }
        });

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderMapSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Map';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Map grid
        const mapGrid = document.createElement('div');
        mapGrid.style.display = 'grid';
        mapGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${isCompactLayout ? 220 : 300}px, 1fr))`;
        mapGrid.style.gap = '20px';
        mapGrid.style.maxWidth = '900px';
        mapGrid.style.padding = '20px';
        mapGrid.style.marginBottom = '30px';

        for (const map of this.availableMaps) {
            const mapCard = document.createElement('div');
            mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            mapCard.style.border = '2px solid transparent';
            mapCard.style.borderRadius = '10px';
            mapCard.style.padding = '20px';
            mapCard.style.cursor = 'pointer';
            mapCard.style.transition = 'all 0.3s';
            mapCard.dataset.particleBox = 'true';
            mapCard.dataset.particleColor = map.id === this.settings.selectedMap.id ? '#FFD700' : '#66B3FF';

            mapCard.addEventListener('mouseenter', () => {
                if (map.id !== this.settings.selectedMap.id) {
                    mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    mapCard.style.transform = 'scale(1.02)';
                }
            });

            mapCard.addEventListener('mouseleave', () => {
                mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                mapCard.style.transform = 'scale(1)';
            });

            mapCard.addEventListener('click', () => {
                this.settings.selectedMap = map;
                this.renderMapSelectionScreen(this.contentElement);
            });

            // Map name
            const mapName = document.createElement('h3');
            mapName.textContent = map.name;
            mapName.style.fontSize = '28px';
            mapName.style.marginBottom = '10px';
            mapName.style.color = map.id === this.settings.selectedMap.id ? '#FFD700' : '#FFFFFF';
            mapName.style.fontWeight = '300';
            mapName.dataset.particleText = 'true';
            mapName.dataset.particleColor = map.id === this.settings.selectedMap.id ? '#FFF2B3' : '#E0F2FF';
            mapCard.appendChild(mapName);

            // Map description
            const mapDesc = document.createElement('p');
            mapDesc.textContent = map.description;
            mapDesc.style.fontSize = '24px';
            mapDesc.style.lineHeight = '1.5';
            mapDesc.style.marginBottom = '15px';
            mapDesc.style.color = '#CCCCCC';
            mapDesc.style.fontWeight = '300';
            mapDesc.dataset.particleText = 'true';
            mapDesc.dataset.particleColor = '#CCCCCC';
            mapCard.appendChild(mapDesc);

            // Map stats
            const mapStats = document.createElement('div');
            mapStats.style.fontSize = '24px';
            mapStats.style.color = '#888888';
            mapStats.innerHTML = `
                <div>⭐ Suns: ${map.numSuns}</div>
                <div>🌑 Asteroids: ${map.numAsteroids}</div>
                <div>📏 Size: ${map.mapSize}px</div>
            `;
            mapCard.appendChild(mapStats);

            mapGrid.appendChild(mapCard);
        }

        container.appendChild(mapGrid);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        container.appendChild(backButton);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderSettingsScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Settings container
        const settingsContainer = document.createElement('div');
        settingsContainer.style.maxWidth = '500px';
        settingsContainer.style.width = '100%';
        settingsContainer.style.padding = '20px';

        // Difficulty setting
        const difficultySection = this.createSettingSection(
            'Difficulty',
            this.createSelect(
                ['easy', 'normal', 'hard'],
                this.settings.difficulty,
                (value) => {
                    this.settings.difficulty = value as 'easy' | 'normal' | 'hard';
                }
            )
        );
        settingsContainer.appendChild(difficultySection);

        // Sound setting
        const soundSection = this.createSettingSection(
            'Sound Effects',
            this.createToggle(
                this.settings.soundEnabled,
                (value) => {
                    this.settings.soundEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(soundSection);

        // Music setting
        const musicSection = this.createSettingSection(
            'Music',
            this.createToggle(
                this.settings.musicEnabled,
                (value) => {
                    this.settings.musicEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(musicSection);

        const battleStatsSection = this.createSettingSection(
            'Battle Stats Info',
            this.createToggle(
                this.settings.isBattleStatsInfoEnabled,
                (value) => {
                    this.settings.isBattleStatsInfoEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(battleStatsSection);

        // Player Color setting
        const playerColorSection = this.createSettingSection(
            'Player Color',
            this.createColorPicker(
                this.settings.playerColor,
                (value) => {
                    this.settings.playerColor = value;
                }
            )
        );
        settingsContainer.appendChild(playerColorSection);

        // Enemy Color setting
        const enemyColorSection = this.createSettingSection(
            'Enemy Color',
            this.createColorPicker(
                this.settings.enemyColor,
                (value) => {
                    this.settings.enemyColor = value;
                }
            )
        );
        settingsContainer.appendChild(enemyColorSection);

        container.appendChild(settingsContainer);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        backButton.style.marginTop = '30px';
        container.appendChild(backButton);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderFactionSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Your Faction';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Faction carousel
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
        carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
        carouselContainer.style.marginBottom = '30px';
        container.appendChild(carouselContainer);

        const factions: FactionCarouselOption[] = [
            { 
                id: Faction.RADIANT, 
                name: 'Radiant', 
                description: 'Masters of light manipulation. Enhanced mirror efficiency and faster light-based attacks.',
                color: '#00AAFF'
            },
            { 
                id: Faction.AURUM, 
                name: 'Aurum', 
                description: 'Wealth-oriented civilization. Economic bonuses and resource multiplication.',
                color: '#FFD700'
            },
            { 
                id: Faction.SOLARI, 
                name: 'Solari', 
                description: 'Sun-worshipping empire. Stronger structures and enhanced solar collection.',
                color: '#FF6600'
            }
        ];
        const selectedIndex = factions.findIndex((faction) => faction.id === this.settings.selectedFaction);
        const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;
        if (!this.settings.selectedFaction && factions.length > 0) {
            this.settings.selectedFaction = factions[initialIndex].id;
        }

        this.factionCarousel = new FactionCarouselView(carouselContainer, factions, initialIndex);
        this.factionCarousel.onSelectionChange((option) => {
            if (this.settings.selectedFaction !== option.id) {
                this.settings.selectedFaction = option.id;
                this.settings.selectedHeroes = []; // Reset hero selection when faction changes
            }
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.factionCarousel.onRender(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Continue button to loadout customization (only enabled if faction is selected)
        if (this.settings.selectedFaction) {
            const continueButton = this.createButton('CUSTOMIZE LOADOUT', () => {
                this.currentScreen = 'loadout-customization';
                this.startMenuTransition();
                this.renderLoadoutCustomizationScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(continueButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderLoadoutCustomizationScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        if (!this.settings.selectedFaction) {
            // Should not happen, but safety fallback
            this.currentScreen = 'faction-select';
            this.renderFactionSelectionScreen(container);
            return;
        }

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Customize Loadout';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = 'bold';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Get faction-specific loadouts
        const factionBaseLoadouts = this.baseLoadouts.filter(l => l.faction === this.settings.selectedFaction);
        const factionSpawnLoadouts = this.spawnLoadouts.filter(l => l.faction === this.settings.selectedFaction);

        // Set defaults if not selected
        if (!this.settings.selectedBaseLoadout && factionBaseLoadouts.length > 0) {
            this.settings.selectedBaseLoadout = factionBaseLoadouts[0].id;
        }
        if (!this.settings.selectedSpawnLoadout && factionSpawnLoadouts.length > 0) {
            this.settings.selectedSpawnLoadout = factionSpawnLoadouts[0].id;
        }

        // Main content container
        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'column';
        contentContainer.style.gap = '40px';
        contentContainer.style.width = '100%';
        contentContainer.style.maxWidth = isCompactLayout ? '100%' : '800px';
        contentContainer.style.padding = isCompactLayout ? '0 10px' : '0 20px';
        container.appendChild(contentContainer);

        // Base Loadout Section
        this.createLoadoutSection(
            contentContainer,
            'Base Loadout',
            factionBaseLoadouts,
            this.settings.selectedBaseLoadout,
            (loadoutId) => { this.settings.selectedBaseLoadout = loadoutId; },
            isCompactLayout
        );

        // Spawn Loadout Section
        this.createLoadoutSection(
            contentContainer,
            'Spawn Loadout',
            factionSpawnLoadouts,
            this.settings.selectedSpawnLoadout,
            (loadoutId) => { this.settings.selectedSpawnLoadout = loadoutId; },
            isCompactLayout
        );

        // Hero Loadout Section (link to hero selection)
        const heroSection = document.createElement('div');
        heroSection.style.marginTop = '20px';
        const heroTitle = document.createElement('h3');
        heroTitle.textContent = 'Hero Loadout';
        heroTitle.style.fontSize = isCompactLayout ? '24px' : '32px';
        heroTitle.style.color = '#00AAFF';
        heroTitle.style.marginBottom = '15px';
        heroTitle.style.fontWeight = 'bold';
        heroTitle.dataset.particleText = 'true';
        heroTitle.dataset.particleColor = '#00AAFF';
        heroSection.appendChild(heroTitle);

        const heroDesc = document.createElement('div');
        heroDesc.textContent = this.settings.selectedHeroes.length > 0 
            ? `Selected: ${this.settings.selectedHeroNames.join(', ')}`
            : 'No heroes selected yet';
        heroDesc.style.fontSize = '20px';
        heroDesc.style.color = '#CCCCCC';
        heroDesc.style.marginBottom = '15px';
        heroSection.appendChild(heroDesc);

        const selectHeroesBtn = this.createButton('SELECT HEROES', () => {
            this.currentScreen = 'loadout-select';
            this.startMenuTransition();
            this.renderLoadoutSelectionScreen(this.contentElement);
        }, '#00FF88');
        heroSection.appendChild(selectHeroesBtn);
        contentContainer.appendChild(heroSection);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '30px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'faction-select';
            this.startMenuTransition();
            this.renderFactionSelectionScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private createLoadoutSection(
        container: HTMLElement,
        title: string,
        loadouts: (BaseLoadout | SpawnLoadout)[],
        selectedId: string | null,
        onSelect: (id: string) => void,
        isCompact: boolean
    ): void {
        const section = document.createElement('div');
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = title;
        sectionTitle.style.fontSize = isCompact ? '24px' : '32px';
        sectionTitle.style.color = '#00AAFF';
        sectionTitle.style.marginBottom = '15px';
        sectionTitle.style.fontWeight = 'bold';
        sectionTitle.dataset.particleText = 'true';
        sectionTitle.dataset.particleColor = '#00AAFF';
        section.appendChild(sectionTitle);

        const optionsContainer = document.createElement('div');
        optionsContainer.style.display = 'flex';
        optionsContainer.style.flexDirection = 'column';
        optionsContainer.style.gap = '10px';

        loadouts.forEach(loadout => {
            const isSelected = loadout.id === selectedId;
            const optionDiv = document.createElement('div');
            optionDiv.style.padding = '15px';
            optionDiv.style.backgroundColor = isSelected ? 'rgba(0, 170, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)';
            optionDiv.style.border = isSelected ? '2px solid #00AAFF' : '2px solid rgba(255, 255, 255, 0.2)';
            optionDiv.style.borderRadius = '8px';
            optionDiv.style.cursor = 'pointer';
            optionDiv.style.transition = 'all 0.2s';

            const nameDiv = document.createElement('div');
            nameDiv.textContent = loadout.name;
            nameDiv.style.fontSize = '22px';
            nameDiv.style.color = isSelected ? '#00AAFF' : '#FFFFFF';
            nameDiv.style.fontWeight = 'bold';
            nameDiv.style.marginBottom = '5px';
            nameDiv.dataset.particleText = 'true';
            nameDiv.dataset.particleColor = isSelected ? '#00AAFF' : '#FFFFFF';
            optionDiv.appendChild(nameDiv);

            const descDiv = document.createElement('div');
            descDiv.textContent = loadout.description;
            descDiv.style.fontSize = '18px';
            descDiv.style.color = '#CCCCCC';
            optionDiv.appendChild(descDiv);

            optionDiv.addEventListener('click', () => {
                onSelect(loadout.id);
                this.renderLoadoutCustomizationScreen(this.contentElement);
            });

            optionDiv.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    optionDiv.style.backgroundColor = 'rgba(0, 170, 255, 0.1)';
                    optionDiv.style.borderColor = '#00AAFF';
                }
            });

            optionDiv.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    optionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                    optionDiv.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
            });

            optionsContainer.appendChild(optionDiv);
        });

        section.appendChild(optionsContainer);
        container.appendChild(section);
    }

    private renderLoadoutSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        if (!this.settings.selectedFaction) {
            // Shouldn't happen, but handle gracefully
            this.renderFactionSelectionScreen(container);
            return;
        }

        // Title
        const title = document.createElement('h2');
        title.textContent = `Select 4 Heroes - ${this.settings.selectedFaction}`;
        title.style.fontSize = isCompactLayout ? '28px' : '42px';
        title.style.marginBottom = isCompactLayout ? '15px' : '20px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Selection counter
        const counter = document.createElement('div');
        counter.textContent = `Selected: ${this.settings.selectedHeroes.length} / 4`;
        counter.style.fontSize = isCompactLayout ? '24px' : '26px';
        counter.style.marginBottom = isCompactLayout ? '20px' : '30px';
        counter.style.color = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        counter.style.fontWeight = '300';
        counter.dataset.particleText = 'true';
        counter.dataset.particleColor = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        container.appendChild(counter);

        // Hero grid
        const heroGrid = document.createElement('div');
        heroGrid.style.display = 'grid';
        heroGrid.style.gridTemplateColumns = isCompactLayout
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fit, minmax(280px, 1fr))';
        heroGrid.style.gap = '15px';
        heroGrid.style.maxWidth = '1200px';
        heroGrid.style.padding = '20px';
        heroGrid.style.marginBottom = '20px';
        heroGrid.style.maxHeight = isCompactLayout ? 'none' : '600px';
        heroGrid.style.overflowY = isCompactLayout ? 'visible' : 'auto';

        // Filter heroes by selected faction
        const factionHeroes = this.heroUnits.filter(hero => hero.faction === this.settings.selectedFaction);

        for (const hero of factionHeroes) {
            const isSelected = this.settings.selectedHeroes.includes(hero.id);
            const canSelect = isSelected || this.settings.selectedHeroes.length < 4;

            const heroCard = document.createElement('div');
            heroCard.style.backgroundColor = isSelected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            heroCard.style.border = '2px solid transparent';
            heroCard.style.borderRadius = '10px';
            heroCard.style.padding = '15px';
            heroCard.style.cursor = canSelect ? 'pointer' : 'not-allowed';
            heroCard.style.transition = 'all 0.3s';
            heroCard.style.opacity = canSelect ? '1' : '0.5';
            heroCard.style.minHeight = '300px';
            heroCard.dataset.particleBox = 'true';
            heroCard.dataset.particleColor = isSelected ? '#00FF88' : '#66B3FF';

            if (canSelect) {
                heroCard.addEventListener('mouseenter', () => {
                    if (!isSelected) {
                        heroCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        heroCard.style.transform = 'scale(1.02)';
                    }
                });

                heroCard.addEventListener('mouseleave', () => {
                    heroCard.style.backgroundColor = isSelected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)';
                    heroCard.style.transform = 'scale(1)';
                });

                heroCard.addEventListener('click', () => {
                    if (isSelected) {
                        // Deselect hero
                        this.settings.selectedHeroes = this.settings.selectedHeroes.filter(id => id !== hero.id);
                    } else if (this.settings.selectedHeroes.length < 4) {
                        // Select hero
                        this.settings.selectedHeroes.push(hero.id);
                    }
                    this.renderLoadoutSelectionScreen(this.contentElement);
                });
            }

            // Hero name
            const heroName = document.createElement('h4');
            heroName.textContent = hero.name;
            heroName.style.fontSize = '24px';
            heroName.style.marginBottom = '8px';
            heroName.style.color = isSelected ? '#00FF88' : '#E0F2FF';
            heroName.style.fontWeight = '300';
            heroName.dataset.particleText = 'true';
            heroName.dataset.particleColor = isSelected ? '#00FF88' : '#E0F2FF';
            heroCard.appendChild(heroName);

            // Hero description
            const heroDesc = document.createElement('p');
            heroDesc.textContent = hero.description;
            heroDesc.style.fontSize = '24px';
            heroDesc.style.lineHeight = '1.4';
            heroDesc.style.color = '#AAAAAA';
            heroDesc.style.marginBottom = '10px';
            heroDesc.style.fontWeight = '300';
            heroDesc.dataset.particleText = 'true';
            heroDesc.dataset.particleColor = '#AAAAAA';
            heroCard.appendChild(heroDesc);

            // Stats section
            const statsContainer = document.createElement('div');
            statsContainer.style.fontSize = '24px';
            statsContainer.style.lineHeight = '1.6';
            statsContainer.style.color = '#CCCCCC';
            statsContainer.style.marginBottom = '8px';
            statsContainer.style.padding = '8px';
            statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            statsContainer.style.borderRadius = '5px';
            statsContainer.style.fontWeight = '300';

            // Create stat rows
            const healthStat = document.createElement('div');
            healthStat.textContent = `HP: ${hero.maxHealth}`;
            healthStat.style.color = '#CCCCCC';
            healthStat.style.fontWeight = 'bold';
            healthStat.dataset.particleText = 'true';
            healthStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(healthStat);

            const regenStat = document.createElement('div');
            regenStat.textContent = `RGN: ${hero.regen}%`;
            regenStat.style.color = '#CCCCCC';
            regenStat.style.fontWeight = 'bold';
            regenStat.dataset.particleText = 'true';
            regenStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(regenStat);

            const defenseStat = document.createElement('div');
            defenseStat.textContent = `DEF: ${hero.defense}%`;
            defenseStat.style.color = '#CCCCCC';
            defenseStat.style.fontWeight = 'bold';
            defenseStat.dataset.particleText = 'true';
            defenseStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(defenseStat);

            const attackStat = document.createElement('div');
            const attackSuffix = hero.attackIgnoresDefense ? ' (ignores defense)' : '';
            attackStat.textContent = `ATK: ${hero.attackDamage}${attackSuffix}`;
            attackStat.style.color = '#CCCCCC';
            attackStat.style.fontWeight = 'bold';
            attackStat.dataset.particleText = 'true';
            attackStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackStat);

            const attackSpeedStat = document.createElement('div');
            attackSpeedStat.textContent = `SPD: ${hero.attackSpeed}/s`;
            attackSpeedStat.style.color = '#CCCCCC';
            attackSpeedStat.style.fontWeight = 'bold';
            attackSpeedStat.dataset.particleText = 'true';
            attackSpeedStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackSpeedStat);

            const rangeStat = document.createElement('div');
            rangeStat.textContent = `RNG: ${hero.attackRange}`;
            rangeStat.style.color = '#CCCCCC';
            rangeStat.style.fontWeight = 'bold';
            rangeStat.dataset.particleText = 'true';
            rangeStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(rangeStat);

            heroCard.appendChild(statsContainer);

            // Ability description
            const abilityDesc = document.createElement('div');
            abilityDesc.style.fontSize = '24px';
            abilityDesc.style.lineHeight = '1.4';
            abilityDesc.style.color = '#FFD700';
            abilityDesc.style.marginBottom = '8px';
            abilityDesc.style.fontStyle = 'italic';
            abilityDesc.style.fontWeight = 'bold';
            abilityDesc.textContent = `${hero.abilityDescription}`;
            abilityDesc.dataset.particleText = 'true';
            abilityDesc.dataset.particleColor = '#FFD700';
            heroCard.appendChild(abilityDesc);

            // Selection indicator
            if (isSelected) {
                const indicator = document.createElement('div');
                indicator.textContent = '✓ Selected';
                indicator.style.fontSize = '24px';
                indicator.style.marginTop = '8px';
                indicator.style.color = '#00FF88';
                indicator.style.fontWeight = '300';
                indicator.dataset.particleText = 'true';
                indicator.dataset.particleColor = '#00FF88';
                heroCard.appendChild(indicator);
            }

            heroGrid.appendChild(heroCard);
        }

        container.appendChild(heroGrid);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Confirm button (only enabled if 4 heroes selected)
        if (this.settings.selectedHeroes.length === 4) {
            const confirmButton = this.createButton('CONFIRM LOADOUT', () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(confirmButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'loadout-customization';
            this.startMenuTransition();
            this.renderLoadoutCustomizationScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private createButton(text: string, onClick: () => void, color: string = '#FFD700'): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.fontSize = '24px';
        button.style.padding = '15px 40px';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        button.style.color = color === '#666666' ? '#FFFFFF' : color;
        button.style.border = '2px solid transparent';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = '300';
        button.style.fontFamily = 'inherit';
        button.style.transition = 'all 0.3s';
        button.dataset.particleBox = 'true';
        button.dataset.particleColor = color;
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', onClick);
        
        return button;
    }

    private createSettingSection(label: string, control: HTMLElement): HTMLElement {
        const section = document.createElement('div');
        section.style.marginBottom = '30px';
        section.style.display = 'flex';
        section.style.justifyContent = 'space-between';
        section.style.alignItems = 'center';

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.fontSize = '24px';
        labelElement.style.color = '#FFFFFF';
        labelElement.style.fontWeight = '300';
        labelElement.dataset.particleText = 'true';
        labelElement.dataset.particleColor = '#FFFFFF';

        section.appendChild(labelElement);
        section.appendChild(control);

        return section;
    }

    private createSelect(options: string[], currentValue: string, onChange: (value: string) => void): HTMLSelectElement {
        const select = document.createElement('select');
        select.style.fontSize = '24px';
        select.style.padding = '8px 15px';
        select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        select.style.color = '#FFFFFF';
        select.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        select.style.borderRadius = '5px';
        select.style.cursor = 'pointer';
        select.style.fontFamily = 'inherit';
        select.style.fontWeight = '300';

        for (const option of options) {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
            optionElement.selected = option === currentValue;
            optionElement.style.backgroundColor = Constants.UI_BACKGROUND_COLOR;
            select.appendChild(optionElement);
        }

        select.addEventListener('change', () => {
            onChange(select.value);
        });

        return select;
    }

    private createToggle(currentValue: boolean, onChange: (value: boolean) => void): HTMLElement {
        const toggleContainer = document.createElement('div');
        toggleContainer.style.display = 'flex';
        toggleContainer.style.alignItems = 'center';
        toggleContainer.style.gap = '10px';

        const toggle = document.createElement('div');
        toggle.style.width = '60px';
        toggle.style.height = '30px';
        toggle.style.backgroundColor = currentValue ? '#00FF88' : '#666666';
        toggle.style.borderRadius = '15px';
        toggle.style.position = 'relative';
        toggle.style.cursor = 'pointer';
        toggle.style.transition = 'all 0.3s';

        const knob = document.createElement('div');
        knob.style.width = '26px';
        knob.style.height = '26px';
        knob.style.backgroundColor = '#FFFFFF';
        knob.style.borderRadius = '50%';
        knob.style.position = 'absolute';
        knob.style.top = '2px';
        knob.style.left = currentValue ? '32px' : '2px';
        knob.style.transition = 'all 0.3s';

        toggle.appendChild(knob);

        toggle.addEventListener('click', () => {
            const newValue = !currentValue;
            currentValue = newValue;
            toggle.style.backgroundColor = newValue ? '#00FF88' : '#666666';
            knob.style.left = newValue ? '32px' : '2px';
            onChange(newValue);
        });

        toggleContainer.appendChild(toggle);

        return toggleContainer;
    }

    private createColorPicker(currentValue: string, onChange: (value: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';

        // Color preview box
        const preview = document.createElement('div');
        preview.style.width = '40px';
        preview.style.height = '40px';
        preview.style.backgroundColor = currentValue;
        preview.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        preview.style.borderRadius = '5px';
        preview.style.cursor = 'pointer';

        // Hidden color input
        const input = document.createElement('input');
        input.type = 'color';
        input.value = currentValue;
        input.style.opacity = '0';
        input.style.width = '0';
        input.style.height = '0';
        input.style.position = 'absolute';

        input.addEventListener('change', () => {
            preview.style.backgroundColor = input.value;
            onChange(input.value);
        });

        preview.addEventListener('click', () => {
            input.click();
        });

        container.appendChild(preview);
        container.appendChild(input);

        return container;
    }

    /**
     * Set callback for when start button is clicked
     */
    onStart(callback: (settings: GameSettings) => void): void {
        this.onStartCallback = callback;
    }

    /**
     * Hide the menu
     */
    hide(): void {
        this.menuElement.style.display = 'none';
        this.backgroundParticleLayer?.stop();
        this.menuParticleLayer?.stop();
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'block';
        this.currentScreen = 'main';
        this.renderMainScreen(this.contentElement);
        this.backgroundParticleLayer?.start();
        this.menuParticleLayer?.start();
    }

    /**
     * Remove the menu from DOM
     */
    destroy(): void {
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.factionCarousel) {
            this.factionCarousel.destroy();
            this.factionCarousel = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        this.backgroundParticleLayer?.destroy();
        this.menuParticleLayer?.stop();
        if (this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
    }

    /**
     * Get current settings
     */
    getSettings(): GameSettings {
        return this.settings;
    }
}

/**
 * Faction carousel view - displays factions in a horizontal carousel
 */
class FactionCarouselView {
    private static readonly ITEM_SPACING_PX = 220;
    private static readonly BASE_SIZE_PX = 320;
    private static readonly TEXT_SCALE = 2.4;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    private static readonly SWIPE_THRESHOLD_PX = 50;

    private container: HTMLElement;
    private options: FactionCarouselOption[];
    private currentIndex: number;
    private targetIndex: number;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private lastDragDeltaX: number = 0;
    private velocity: number = 0;
    private hasDragged: boolean = false;
    private isCompactLayout: boolean = false;
    private resizeHandler: (() => void) | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private onSelectionChangeCallback: ((option: FactionCarouselOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private animationFrameId: number | null = null;

    constructor(container: HTMLElement, options: FactionCarouselOption[], initialIndex: number) {
        this.container = container;
        this.options = options;
        this.currentIndex = Math.max(0, Math.min(options.length - 1, initialIndex));
        this.targetIndex = this.currentIndex;
        this.setupContainer();
        this.setupEventHandlers();
        this.scrollOffset = -this.currentIndex * this.getItemSpacingPx();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.updateLayoutMetrics();
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y';
    }

    private setupEventHandlers(): void {
        this.resizeHandler = () => {
            this.updateLayoutMetrics();
        };
        window.addEventListener('resize', this.resizeHandler);

        this.keydownHandler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'arrowleft' || key === 'a') {
                this.moveSelection(-1);
                event.preventDefault();
            }
            if (key === 'arrowright' || key === 'd') {
                this.moveSelection(1);
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);

        this.container.addEventListener('mousedown', (event: MouseEvent) => {
            this.startDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mousemove', (event: MouseEvent) => {
            if (this.isDragging) {
                this.updateDrag(event.clientX);
                event.preventDefault();
            }
        });

        this.container.addEventListener('mouseup', (event: MouseEvent) => {
            this.endDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.endDrag(this.dragStartX);
            }
        });

        this.container.addEventListener('touchstart', (event: TouchEvent) => {
            if (event.touches.length === 1) {
                this.startDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (event: TouchEvent) => {
            if (this.isDragging && event.touches.length === 1) {
                this.updateDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (event: TouchEvent) => {
            if (this.isDragging) {
                const touch = event.changedTouches[0];
                this.endDrag(touch.clientX);
                event.preventDefault();
            }
        }, { passive: false });
    }

    private startDrag(x: number): void {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartOffset = this.scrollOffset;
        this.velocity = 0;
        this.hasDragged = false;
        this.lastDragDeltaX = 0;
        this.container.style.cursor = 'grabbing';
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;

        const deltaX = x - this.dragStartX;
        this.lastDragDeltaX = deltaX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * FactionCarouselView.VELOCITY_MULTIPLIER;

        if (Math.abs(deltaX) > Constants.CLICK_DRAG_THRESHOLD) {
            this.hasDragged = true;
        }
    }

    private endDrag(x: number): void {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.container.style.cursor = 'grab';

        if (!this.hasDragged) {
            this.handleClick(x);
            return;
        }

        const itemWidthPx = this.getItemSpacingPx();
        const deltaX = this.lastDragDeltaX;
        if (Math.abs(deltaX) >= FactionCarouselView.SWIPE_THRESHOLD_PX) {
            const direction = deltaX < 0 ? 1 : -1;
            this.setCurrentIndex(this.currentIndex + direction);
            return;
        }

        const targetIndexFloat = -this.scrollOffset / itemWidthPx;
        const targetIndex = Math.round(targetIndexFloat + this.velocity * FactionCarouselView.VELOCITY_FACTOR);
        this.setCurrentIndex(targetIndex);
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / this.getItemSpacingPx());
        this.setCurrentIndex(clickedOffset);
    }

    private moveSelection(direction: number): void {
        this.setCurrentIndex(this.currentIndex + direction);
    }

    private setCurrentIndex(nextIndex: number): void {
        const clampedIndex = Math.max(0, Math.min(this.options.length - 1, nextIndex));
        if (clampedIndex === this.currentIndex) {
            this.targetIndex = clampedIndex;
            return;
        }

        this.targetIndex = clampedIndex;
        this.currentIndex = clampedIndex;
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.options[this.currentIndex]);
        }
    }

    private startAnimation(): void {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    private updateLayoutMetrics(): void {
        this.isCompactLayout = window.innerWidth < 600;
        const targetHeight = this.isCompactLayout ? '360px' : '480px';
        if (this.container.style.height !== targetHeight) {
            this.container.style.height = targetHeight;
        }
    }

    private getLayoutScale(): number {
        return this.isCompactLayout ? 0.6 : 0.9;
    }

    private getItemSpacingPx(): number {
        return FactionCarouselView.ITEM_SPACING_PX * this.getLayoutScale();
    }

    private update(): void {
        this.updateLayoutMetrics();
        const targetScrollOffset = -this.currentIndex * this.getItemSpacingPx();
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * FactionCarouselView.SMOOTH_INTERPOLATION_FACTOR;

        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= FactionCarouselView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
    }

    private render(): void {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const layoutScale = this.getLayoutScale();
        const itemSpacingPx = this.getItemSpacingPx();
        const baseSizePx = FactionCarouselView.BASE_SIZE_PX * layoutScale;
        const textScale = FactionCarouselView.TEXT_SCALE * layoutScale;

        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            const x = centerX + this.scrollOffset + i * itemSpacingPx;

            let scale = 1.0;
            let opacity = 1.0;
            if (distance === 0) {
                scale = 1.0;
                opacity = 1.0;
            } else if (distance === 1) {
                scale = 0.72;
                opacity = 0.85;
            } else if (distance === 2) {
                scale = 0.5;
                opacity = 0.55;
            } else {
                scale = Math.max(0.3, 1.0 - distance * 0.25);
                opacity = Math.max(0.3, 1.0 - distance * 0.25);
            }

            const sizePx = baseSizePx * scale;
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - sizePx / 2}px`;
            optionElement.style.top = `${centerY - sizePx / 2}px`;
            optionElement.style.width = `${sizePx}px`;
            optionElement.style.height = `${sizePx}px`;
            optionElement.style.backgroundColor = distance === 0 ? 'rgba(12, 14, 22, 0.98)' : 'rgba(12, 14, 22, 0.85)';
            optionElement.style.border = distance === 0 ? `2px solid ${option.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none';
            optionElement.style.color = '#FFFFFF';
            optionElement.style.fontWeight = '300';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = `${24 * layoutScale}px`;
            optionElement.style.boxSizing = 'border-box';
            optionElement.style.zIndex = (100 - distance).toString();
            optionElement.style.overflow = 'hidden';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? option.color : '#66B3FF';

            const nameElement = document.createElement('div');
            nameElement.textContent = option.name.toUpperCase();
            nameElement.style.fontSize = `${Math.max(16, 20 * scale) * textScale}px`;
            nameElement.style.marginBottom = distance === 0 ? '14px' : '0';
            nameElement.style.color = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            optionElement.appendChild(nameElement);

            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.lineHeight = '1.4';
                descElement.style.fontWeight = '300';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }

            this.container.appendChild(optionElement);
        }

        const instructionElement = document.createElement('div');
        instructionElement.textContent = 'Swipe, drag, or use \u2190/\u2192 (A/D) \u2022 Tap side tiles to browse';
        instructionElement.style.position = 'absolute';
        instructionElement.style.bottom = '20px';
        instructionElement.style.left = '50%';
        instructionElement.style.transform = 'translateX(-50%)';
        instructionElement.style.color = '#AAAAAA';
        instructionElement.style.fontSize = `${22 * layoutScale}px`;
        instructionElement.style.fontWeight = '300';
        instructionElement.style.pointerEvents = 'none';
        instructionElement.dataset.particleText = 'true';
        instructionElement.dataset.particleColor = '#AAAAAA';
        this.container.appendChild(instructionElement);

        if (this.onRenderCallback) {
            this.onRenderCallback();
        }
    }

    public onSelectionChange(callback: (option: FactionCarouselOption) => void): void {
        this.onSelectionChangeCallback = callback;
    }

    public onRender(callback: () => void): void {
        this.onRenderCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
    }
}

/**
 * Carousel menu view - displays menu options in a horizontal carousel
 */
class CarouselMenuView {
    // Animation constants
    private static readonly ITEM_WIDTH = 600;
    private static readonly BASE_SIZE = 360;
    private static readonly TEXT_SCALE = 3;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    private static readonly SWIPE_THRESHOLD_PX = 50;
    
    private container: HTMLElement;
    private options: MenuOption[];
    private currentIndex: number = 0;
    private targetIndex: number = 0;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private lastDragDeltaX: number = 0;
    private velocity: number = 0;
    private onSelectCallback: ((option: MenuOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private onNavigateCallback: ((nextIndex: number) => void) | null = null;
    private animationFrameId: number | null = null;
    private hasDragged: boolean = false;
    private isCompactLayout: boolean = false;
    private resizeHandler: (() => void) | null = null;

    constructor(container: HTMLElement, options: MenuOption[]) {
        this.container = container;
        this.options = options;
        this.setupContainer();
        this.setupEventHandlers();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.updateLayoutMetrics();
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y'; // Allow vertical scrolling but handle horizontal ourselves
    }

    private setupEventHandlers(): void {
        this.resizeHandler = () => {
            this.updateLayoutMetrics();
        };
        window.addEventListener('resize', this.resizeHandler);

        // Mouse events
        this.container.addEventListener('mousedown', (e: MouseEvent) => {
            this.startDrag(e.clientX);
            e.preventDefault();
        });

        this.container.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.isDragging) {
                this.updateDrag(e.clientX);
                e.preventDefault();
            }
        });

        this.container.addEventListener('mouseup', (e: MouseEvent) => {
            this.endDrag(e.clientX);
            e.preventDefault();
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.endDrag(this.dragStartX);
            }
        });

        // Touch events
        this.container.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                this.startDrag(e.touches[0].clientX);
                e.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (e: TouchEvent) => {
            if (this.isDragging && e.touches.length === 1) {
                this.updateDrag(e.touches[0].clientX);
                e.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (e: TouchEvent) => {
            if (this.isDragging) {
                const touch = e.changedTouches[0];
                this.endDrag(touch.clientX);
                e.preventDefault();
            }
        }, { passive: false });
    }

    private startDrag(x: number): void {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartOffset = this.scrollOffset;
        this.velocity = 0;
        this.hasDragged = false;
        this.lastDragDeltaX = 0;
        this.container.style.cursor = 'grabbing';
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartX;
        this.lastDragDeltaX = deltaX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * CarouselMenuView.VELOCITY_MULTIPLIER; // Track velocity for momentum
        
        // Track if we've dragged significantly
        if (Math.abs(deltaX) > Constants.CLICK_DRAG_THRESHOLD) {
            this.hasDragged = true;
        }
    }

    private endDrag(x: number): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.style.cursor = 'grab';
        
        // If not dragged significantly, treat as a click/tap
        if (!this.hasDragged) {
            this.handleClick(x);
            return;
        }
        
        const itemWidth = this.getItemWidthPx();
        const deltaX = this.lastDragDeltaX;
        if (Math.abs(deltaX) >= CarouselMenuView.SWIPE_THRESHOLD_PX) {
            const direction = deltaX < 0 ? 1 : -1;
            const targetIndex = Math.max(0, Math.min(this.options.length - 1, this.currentIndex + direction));
            this.setCurrentIndex(targetIndex);
            return;
        }

        // Snap to nearest option based on current position and velocity
        const targetIndexFloat = -this.scrollOffset / itemWidth;
        let targetIndex = Math.round(targetIndexFloat + this.velocity * CarouselMenuView.VELOCITY_FACTOR);

        // Clamp to valid range
        targetIndex = Math.max(0, Math.min(this.options.length - 1, targetIndex));
        this.setCurrentIndex(targetIndex);
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        
        // Determine which option was clicked based on position
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / this.getItemWidthPx());
        const clickedIndex = Math.max(0, Math.min(this.options.length - 1, clickedOffset));
        
        if (clickedIndex === this.currentIndex) {
            // Clicked on center option - select it
            if (this.onSelectCallback) {
                this.onSelectCallback(this.options[this.currentIndex]);
            }
        } else {
            // Clicked on different option - slide to it
            this.setCurrentIndex(clickedIndex);
        }
    }

    private setCurrentIndex(nextIndex: number): void {
        if (nextIndex === this.currentIndex) {
            this.targetIndex = nextIndex;
            return;
        }

        this.targetIndex = nextIndex;
        this.currentIndex = nextIndex;
        if (this.onNavigateCallback) {
            this.onNavigateCallback(nextIndex);
        }
    }

    private startAnimation(): void {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    private updateLayoutMetrics(): void {
        const isCompactLayout = window.innerWidth < 600;
        this.isCompactLayout = isCompactLayout;
        const targetHeight = this.isCompactLayout ? '360px' : '600px';
        if (this.container.style.height !== targetHeight) {
            this.container.style.height = targetHeight;
        }
    }

    private getLayoutScale(): number {
        return this.isCompactLayout ? 0.5 : 1;
    }

    private getItemWidthPx(): number {
        return CarouselMenuView.ITEM_WIDTH * this.getLayoutScale();
    }

    private update(): void {
        this.updateLayoutMetrics();
        // Smooth scrolling towards target
        const targetScrollOffset = -this.currentIndex * this.getItemWidthPx();
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * CarouselMenuView.SMOOTH_INTERPOLATION_FACTOR;
        
        // Apply velocity decay when not dragging
        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= CarouselMenuView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
    }

    private render(): void {
        // Clear container
        this.container.innerHTML = '';
        
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const layoutScale = this.getLayoutScale();
        const itemWidth = this.getItemWidthPx();
        const baseSize = CarouselMenuView.BASE_SIZE * layoutScale;
        const textScale = CarouselMenuView.TEXT_SCALE * layoutScale;

        // Render each option
        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            
            // Calculate position
            const x = centerX + this.scrollOffset + i * itemWidth;
            
            // Calculate size and opacity based on distance from center
            let scale = 1.0;
            let opacity = 1.0;
            
            if (distance === 0) {
                scale = 1.0;
                opacity = 1.0;
            } else if (distance === 1) {
                scale = 0.75;
                opacity = 0.75;
            } else if (distance === 2) {
                scale = 0.5;
                opacity = 0.5;
            } else {
                scale = Math.max(0.25, 1.0 - distance * 0.25);
                opacity = Math.max(0.25, 1.0 - distance * 0.25);
            }
            
            const size = baseSize * scale;
            
            // Create option element
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - size / 2}px`;
            optionElement.style.top = `${centerY - size / 2}px`;
            optionElement.style.width = `${size}px`;
            optionElement.style.height = `${size}px`;
            optionElement.style.backgroundColor = 'transparent';
            optionElement.style.border = '2px solid transparent';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.transition = 'background-color 0.2s';
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none'; // Let container handle events
            optionElement.style.color = '#000000';
            optionElement.style.fontWeight = '300';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = '30px';
            optionElement.style.boxSizing = 'border-box';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? '#FFD700' : '#00AAFF';
            
            // Add option name
            const nameElement = document.createElement('div');
            nameElement.textContent = option.name;
            nameElement.style.fontSize = `${Math.max(14, 18 * scale) * textScale}px`;
            nameElement.style.marginBottom = '15px';
            nameElement.style.color = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            optionElement.appendChild(nameElement);
            
            // Add option description (only for center item)
            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.overflow = 'hidden';
                descElement.style.textOverflow = 'ellipsis';
                descElement.style.fontWeight = '300';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }
            
            this.container.appendChild(optionElement);
        }
        
        // Add instruction text
        const instructionElement = document.createElement('div');
        instructionElement.textContent = 'Swipe or drag to browse • Tap center to select';
        instructionElement.style.position = 'absolute';
        instructionElement.style.bottom = '20px';
        instructionElement.style.left = '50%';
        instructionElement.style.transform = 'translateX(-50%)';
        instructionElement.style.color = '#AAAAAA';
        instructionElement.style.fontSize = `${24 * layoutScale}px`;
        instructionElement.style.fontWeight = '300';
        instructionElement.style.pointerEvents = 'none';
        instructionElement.dataset.particleText = 'true';
        instructionElement.dataset.particleColor = '#AAAAAA';
        this.container.appendChild(instructionElement);

        if (this.onRenderCallback) {
            this.onRenderCallback();
        }
    }

    public onSelect(callback: (option: MenuOption) => void): void {
        this.onSelectCallback = callback;
    }

    public onRender(callback: () => void): void {
        this.onRenderCallback = callback;
    }

    public onNavigate(callback: (nextIndex: number) => void): void {
        this.onNavigateCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
}
