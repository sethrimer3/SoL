/**
 * Background particle system for menu
 */

export interface ParticleTarget {
    x: number;
    y: number;
    color: string;
}

export interface Particle {
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
    colorWarmthShift: number;
    colorLightnessShift: number;
    colorSaturationShift: number;
}

export interface BackgroundParticle {
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

export interface MenuAsteroidPoint {
    angleRad: number;
    radiusScale: number;
}

export interface MenuAsteroid {
    x: number;
    y: number;
    radiusPx: number;
    velocityX: number;
    velocityY: number;
    rotationRad: number;
    rotationSpeedRad: number;
    points: MenuAsteroidPoint[];
}

export class BackgroundParticleLayer {
    private static readonly PARTICLE_COUNT = 8;
    private static readonly PARTICLE_RADIUS_MOBILE_PX = 37.5;
    private static readonly PARTICLE_RADIUS_DESKTOP_PX = 75;
    private static readonly MAX_VELOCITY = 0.3;
    private static readonly MIN_VELOCITY = 0.02;
    private static readonly FRICTION = 0.98;
    private static readonly COLOR_TRANSITION_SPEED = 0.002;
    private static readonly ATTRACTION_STRENGTH = 0.15;
    private static readonly COLOR_CHANGE_INTERVAL_MS = 8000;
    private static readonly EDGE_REPULSION_DISTANCE = 300;
    private static readonly EDGE_REPULSION_STRENGTH = 0.05;
    private static readonly EDGE_GLOW_DISTANCE = 400;
    // Normalization factor for edge glow intensity scaled by particle count
    // Higher particle count requires higher normalization to maintain visual consistency
    private static readonly EDGE_GLOW_NORMALIZATION = BackgroundParticleLayer.PARTICLE_COUNT * 350;
    
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private particles: BackgroundParticle[] = [];
    private attractionMatrix: number[][] = [];
    private animationFrameId: number | null = null;
    private isActive: boolean = false;
    private lastColorChangeMs: number = 0;
    private edgeGlows: { top: number[]; right: number[]; bottom: number[]; left: number[] } = {
        top: [0, 0, 0],
        right: [0, 0, 0],
        bottom: [0, 0, 0],
        left: [0, 0, 0]
    };
    // Cached canvas dimensions to avoid DPR division every frame
    private cachedWidthPx: number = 0;
    private cachedHeightPx: number = 0;
    private graphicsQuality: 'low' | 'medium' | 'high' | 'ultra' = 'ultra';
    // Cached gradients for particles to reduce per-frame allocation
    private particleGradientCache: Map<string, CanvasGradient> = new Map();
    
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
        // Don't auto-start - let resumeMenuAnimations() start it after menu is in DOM
    }
    
    private initializeParticles(): void {
        // Use cached dimensions or fallback
        const width = this.cachedWidthPx || window.innerWidth;
        const height = this.cachedHeightPx || window.innerHeight;
        const particleRadiusPx = this.getParticleRadiusPx();

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
                radius: particleRadiusPx
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
        // Cache dimensions for rendering
        this.cachedWidthPx = width;
        this.cachedHeightPx = height;
        this.updateParticleRadii();
    }
    
    public setGraphicsQuality(quality: 'low' | 'medium' | 'high' | 'ultra'): void {
        this.graphicsQuality = quality;
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
        // Use cached dimensions
        const width = this.cachedWidthPx || window.innerWidth;
        const height = this.cachedHeightPx || window.innerHeight;
        
        // Reset edge glows
        this.edgeGlows.top = [0, 0, 0];
        this.edgeGlows.right = [0, 0, 0];
        this.edgeGlows.bottom = [0, 0, 0];
        this.edgeGlows.left = [0, 0, 0];
        
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
            
            // Apply edge repulsion
            const edgeRepulsion = BackgroundParticleLayer.EDGE_REPULSION_DISTANCE;
            const edgeStrength = BackgroundParticleLayer.EDGE_REPULSION_STRENGTH;
            
            // Left edge
            if (p1.x < edgeRepulsion) {
                const force = (1 - p1.x / edgeRepulsion) * edgeStrength;
                p1.velocityX += force;
            }
            // Right edge
            if (p1.x > width - edgeRepulsion) {
                const force = (1 - (width - p1.x) / edgeRepulsion) * edgeStrength;
                p1.velocityX -= force;
            }
            // Top edge
            if (p1.y < edgeRepulsion) {
                const force = (1 - p1.y / edgeRepulsion) * edgeStrength;
                p1.velocityY += force;
            }
            // Bottom edge
            if (p1.y > height - edgeRepulsion) {
                const force = (1 - (height - p1.y) / edgeRepulsion) * edgeStrength;
                p1.velocityY -= force;
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
            // Apply minimum velocity to keep particles moving
            if (speed < BackgroundParticleLayer.MIN_VELOCITY) {
                // Give particles a small random velocity if completely stopped
                const angle = Math.random() * Math.PI * 2;
                p1.velocityX = Math.cos(angle) * BackgroundParticleLayer.MIN_VELOCITY;
                p1.velocityY = Math.sin(angle) * BackgroundParticleLayer.MIN_VELOCITY;
            }
            
            // Update position
            p1.x += p1.velocityX;
            p1.y += p1.velocityY;
            
            // Keep particles on screen (bounce back instead of wrapping)
            if (p1.x < 0) {
                p1.x = 0;
                p1.velocityX = Math.abs(p1.velocityX);
            }
            if (p1.x > width) {
                p1.x = width;
                p1.velocityX = -Math.abs(p1.velocityX);
            }
            if (p1.y < 0) {
                p1.y = 0;
                p1.velocityY = Math.abs(p1.velocityY);
            }
            if (p1.y > height) {
                p1.y = height;
                p1.velocityY = -Math.abs(p1.velocityY);
            }
            
            // Calculate edge glow contributions
            const glowDistance = BackgroundParticleLayer.EDGE_GLOW_DISTANCE;
            const r = Math.round(p1.colorR);
            const g = Math.round(p1.colorG);
            const b = Math.round(p1.colorB);
            
            // Top edge glow
            if (p1.y < glowDistance) {
                const intensity = (1 - p1.y / glowDistance);
                this.edgeGlows.top[0] += r * intensity;
                this.edgeGlows.top[1] += g * intensity;
                this.edgeGlows.top[2] += b * intensity;
            }
            // Bottom edge glow
            if (p1.y > height - glowDistance) {
                const intensity = (1 - (height - p1.y) / glowDistance);
                this.edgeGlows.bottom[0] += r * intensity;
                this.edgeGlows.bottom[1] += g * intensity;
                this.edgeGlows.bottom[2] += b * intensity;
            }
            // Left edge glow
            if (p1.x < glowDistance) {
                const intensity = (1 - p1.x / glowDistance);
                this.edgeGlows.left[0] += r * intensity;
                this.edgeGlows.left[1] += g * intensity;
                this.edgeGlows.left[2] += b * intensity;
            }
            // Right edge glow
            if (p1.x > width - glowDistance) {
                const intensity = (1 - (width - p1.x) / glowDistance);
                this.edgeGlows.right[0] += r * intensity;
                this.edgeGlows.right[1] += g * intensity;
                this.edgeGlows.right[2] += b * intensity;
            }
            
            // Smoothly transition colors
            p1.colorR += (p1.targetColorR - p1.colorR) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
            p1.colorG += (p1.targetColorG - p1.colorG) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
            p1.colorB += (p1.targetColorB - p1.colorB) * BackgroundParticleLayer.COLOR_TRANSITION_SPEED;
        }
    }

    private updateParticleRadii(): void {
        const particleRadiusPx = this.getParticleRadiusPx();
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].radius = particleRadiusPx;
        }
    }

    private getParticleRadiusPx(): number {
        if (window.matchMedia('(min-width: 768px)').matches) {
            return BackgroundParticleLayer.PARTICLE_RADIUS_DESKTOP_PX;
        }
        return BackgroundParticleLayer.PARTICLE_RADIUS_MOBILE_PX;
    }
    
    private render(): void {
        // Use cached dimensions
        const width = this.cachedWidthPx || window.innerWidth;
        const height = this.cachedHeightPx || window.innerHeight;
        
        // Clear with black background
        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, width, height);
        
        // Apply blur filter based on quality (skip on low/medium quality)
        const shouldApplyBlur = this.graphicsQuality === 'high' || this.graphicsQuality === 'ultra';
        
        // Draw edge glows first (under particles)
        this.context.globalCompositeOperation = 'screen';
        if (shouldApplyBlur) {
            this.context.filter = 'blur(40px)';
        }
        
        const glowHeight = 60;
        const glowWidth = 60;
        
        // Normalize and draw edge glows
        const maxGlow = BackgroundParticleLayer.EDGE_GLOW_NORMALIZATION;
        
        // Top edge
        const topR = Math.min(255, Math.round(this.edgeGlows.top[0] / maxGlow * 255));
        const topG = Math.min(255, Math.round(this.edgeGlows.top[1] / maxGlow * 255));
        const topB = Math.min(255, Math.round(this.edgeGlows.top[2] / maxGlow * 255));
        if (topR + topG + topB > 0) {
            const gradient = this.context.createLinearGradient(0, 0, 0, glowHeight);
            gradient.addColorStop(0, `rgba(${topR}, ${topG}, ${topB}, 0.6)`);
            gradient.addColorStop(1, `rgba(${topR}, ${topG}, ${topB}, 0)`);
            this.context.fillStyle = gradient;
            this.context.fillRect(0, 0, width, glowHeight);
        }
        
        // Bottom edge
        const bottomR = Math.min(255, Math.round(this.edgeGlows.bottom[0] / maxGlow * 255));
        const bottomG = Math.min(255, Math.round(this.edgeGlows.bottom[1] / maxGlow * 255));
        const bottomB = Math.min(255, Math.round(this.edgeGlows.bottom[2] / maxGlow * 255));
        if (bottomR + bottomG + bottomB > 0) {
            const gradient = this.context.createLinearGradient(0, height - glowHeight, 0, height);
            gradient.addColorStop(0, `rgba(${bottomR}, ${bottomG}, ${bottomB}, 0)`);
            gradient.addColorStop(1, `rgba(${bottomR}, ${bottomG}, ${bottomB}, 0.6)`);
            this.context.fillStyle = gradient;
            this.context.fillRect(0, height - glowHeight, width, glowHeight);
        }
        
        // Left edge
        const leftR = Math.min(255, Math.round(this.edgeGlows.left[0] / maxGlow * 255));
        const leftG = Math.min(255, Math.round(this.edgeGlows.left[1] / maxGlow * 255));
        const leftB = Math.min(255, Math.round(this.edgeGlows.left[2] / maxGlow * 255));
        if (leftR + leftG + leftB > 0) {
            const gradient = this.context.createLinearGradient(0, 0, glowWidth, 0);
            gradient.addColorStop(0, `rgba(${leftR}, ${leftG}, ${leftB}, 0.6)`);
            gradient.addColorStop(1, `rgba(${leftR}, ${leftG}, ${leftB}, 0)`);
            this.context.fillStyle = gradient;
            this.context.fillRect(0, 0, glowWidth, height);
        }
        
        // Right edge
        const rightR = Math.min(255, Math.round(this.edgeGlows.right[0] / maxGlow * 255));
        const rightG = Math.min(255, Math.round(this.edgeGlows.right[1] / maxGlow * 255));
        const rightB = Math.min(255, Math.round(this.edgeGlows.right[2] / maxGlow * 255));
        if (rightR + rightG + rightB > 0) {
            const gradient = this.context.createLinearGradient(width - glowWidth, 0, width, 0);
            gradient.addColorStop(0, `rgba(${rightR}, ${rightG}, ${rightB}, 0)`);
            gradient.addColorStop(1, `rgba(${rightR}, ${rightG}, ${rightB}, 0.6)`);
            this.context.fillStyle = gradient;
            this.context.fillRect(width - glowWidth, 0, glowWidth, height);
        }
        
        // Draw particles with blur effect (only on high/ultra quality)
        if (shouldApplyBlur) {
            this.context.filter = 'blur(60px)';
        }
        this.context.globalCompositeOperation = 'screen';
        
        for (const particle of this.particles) {
            const r = Math.round(particle.colorR);
            const g = Math.round(particle.colorG);
            const b = Math.round(particle.colorB);
            
            // Cache gradients by color and radius
            const cacheKey = `${r},${g},${b},${particle.radius}`;
            let gradient = this.particleGradientCache.get(cacheKey);
            
            if (!gradient) {
                // Create gradient at origin (0, 0) so it can be cached and reused
                // Using translate to reposition avoids per-frame gradient allocations
                gradient = this.context.createRadialGradient(0, 0, 0, 0, 0, particle.radius);
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                // Limit cache size to prevent memory growth
                if (this.particleGradientCache.size >= 50) {
                    const firstKey = this.particleGradientCache.keys().next().value;
                    if (firstKey) {
                        this.particleGradientCache.delete(firstKey);
                    }
                }
                this.particleGradientCache.set(cacheKey, gradient);
            }
            
            // Use translate to position the cached gradient
            this.context.save();
            this.context.translate(particle.x, particle.y);
            this.context.fillStyle = gradient;
            this.context.beginPath();
            this.context.arc(0, 0, particle.radius, 0, Math.PI * 2);
            this.context.fill();
            this.context.restore();
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
