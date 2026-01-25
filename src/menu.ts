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
}

class ParticleMenuLayer {
    private static readonly REFRESH_INTERVAL_MS = 140;
    private static readonly POSITION_SMOOTHING = 0.08 / 9;
    private static readonly DRIFT_SPEED = 0.0007 / 3;
    private static readonly DRIFT_RADIUS_MIN_PX = 0.6;
    private static readonly DRIFT_RADIUS_MAX_PX = 2.4;
    private static readonly COLOR_SMOOTHING = 0.08;
    private static readonly PARTICLE_SIZE_PX = 1.6;
    private static readonly RELOCATE_MIN_DISTANCE_PX = 6;
    private static readonly RELOCATE_MAX_DISTANCE_PX = 18;

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

    constructor(container: HTMLElement) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
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
        this.canvas.width = Math.round(rect.width * devicePixelRatio);
        this.canvas.height = Math.round(rect.height * devicePixelRatio);
        this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
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

        if (this.desiredParticleCount === 0) {
            this.desiredParticleCount = targetCount;
        } else {
            this.desiredParticleCount = Math.max(this.desiredParticleCount, targetCount);
        }

        const desiredCount = this.desiredParticleCount;
        const existingParticles = this.particles.slice();

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
        const driftTime = nowMs * ParticleMenuLayer.DRIFT_SPEED;
        for (const particle of this.particles) {
            const driftX = Math.cos(particle.driftPhase + driftTime) * particle.driftRadiusPx;
            const driftY = Math.sin(particle.driftPhase + driftTime) * particle.driftRadiusPx;

            particle.baseTargetX = particle.targetX + driftX;
            particle.baseTargetY = particle.targetY + driftY;

            const deltaX = particle.baseTargetX - particle.x;
            const deltaY = particle.baseTargetY - particle.y;

            particle.velocityX += deltaX * ParticleMenuLayer.POSITION_SMOOTHING;
            particle.velocityY += deltaY * ParticleMenuLayer.POSITION_SMOOTHING;

            particle.velocityX *= 0.82;
            particle.velocityY *= 0.82;

            particle.x += particle.velocityX;
            particle.y += particle.velocityY;

            particle.colorR += (particle.targetColorR - particle.colorR) * ParticleMenuLayer.COLOR_SMOOTHING;
            particle.colorG += (particle.targetColorG - particle.colorG) * ParticleMenuLayer.COLOR_SMOOTHING;
            particle.colorB += (particle.targetColorB - particle.colorB) * ParticleMenuLayer.COLOR_SMOOTHING;
        }
    }

    private renderParticles(): void {
        const rect = this.container.getBoundingClientRect();
        this.context.clearRect(0, 0, rect.width, rect.height);
        this.context.globalCompositeOperation = 'lighter';

        for (const particle of this.particles) {
            const red = Math.min(255, Math.max(0, Math.round(particle.colorR)));
            const green = Math.min(255, Math.max(0, Math.round(particle.colorG)));
            const blue = Math.min(255, Math.max(0, Math.round(particle.colorB)));
            this.context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.sizePx, 0, Math.PI * 2);
            this.context.fill();
        }

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
}

const EMPTY_HERO_LABEL = '[EMPTY]';

const createEmptyHero = (id: string, faction: Faction): HeroUnit => ({
    id,
    name: EMPTY_HERO_LABEL,
    description: EMPTY_HERO_LABEL,
    faction,
    maxHealth: 0,
    attackDamage: 0,
    attackSpeed: 0,
    attackRange: 0,
    attackIgnoresDefense: false,
    defense: 0,
    regen: 0,
    abilityDescription: EMPTY_HERO_LABEL,
});

export class MainMenu {
    private menuElement: HTMLElement;
    private contentElement!: HTMLElement;
    private menuParticleLayer: ParticleMenuLayer | null = null;
    private resizeHandler: (() => void) | null = null;
    private onStartCallback: ((settings: GameSettings) => void) | null = null;
    private currentScreen: 'main' | 'maps' | 'settings' | 'faction-select' | 'loadout-select' = 'main';
    private settings: GameSettings;
    private carouselMenu: CarouselMenuView | null = null;
    
    // Hero unit data with complete stats
    private heroUnits: HeroUnit[] = [
        // Radiant faction heroes
        createEmptyHero('radiant-1', Faction.RADIANT),
        createEmptyHero('radiant-2', Faction.RADIANT),
        createEmptyHero('radiant-3', Faction.RADIANT),
        createEmptyHero('radiant-4', Faction.RADIANT),
        createEmptyHero('radiant-5', Faction.RADIANT),
        createEmptyHero('radiant-6', Faction.RADIANT),
        createEmptyHero('radiant-7', Faction.RADIANT),
        createEmptyHero('radiant-8', Faction.RADIANT),
        createEmptyHero('radiant-9', Faction.RADIANT),
        createEmptyHero('radiant-10', Faction.RADIANT),
        createEmptyHero('radiant-11', Faction.RADIANT),
        createEmptyHero('radiant-12', Faction.RADIANT),
        { 
            id: 'radiant-13', name: 'Marine', description: 'Rapid-fire ranged specialist', faction: Faction.RADIANT,
            maxHealth: Constants.MARINE_MAX_HEALTH, attackDamage: Constants.MARINE_ATTACK_DAMAGE, attackSpeed: Constants.MARINE_ATTACK_SPEED,
            attackRange: Constants.MARINE_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 4,
            abilityDescription: 'Bullet storm: fires a spread of shots toward a target direction'
        },
        
        // Aurum faction heroes
        createEmptyHero('aurum-1', Faction.AURUM),
        createEmptyHero('aurum-2', Faction.AURUM),
        createEmptyHero('aurum-3', Faction.AURUM),
        createEmptyHero('aurum-4', Faction.AURUM),
        createEmptyHero('aurum-5', Faction.AURUM),
        createEmptyHero('aurum-6', Faction.AURUM),
        createEmptyHero('aurum-7', Faction.AURUM),
        createEmptyHero('aurum-8', Faction.AURUM),
        createEmptyHero('aurum-9', Faction.AURUM),
        createEmptyHero('aurum-10', Faction.AURUM),
        createEmptyHero('aurum-11', Faction.AURUM),
        createEmptyHero('aurum-12', Faction.AURUM),
        { 
            id: 'aurum-13', name: 'Grave', description: 'Gravitic sentinel with orbiting projectiles', faction: Faction.AURUM,
            maxHealth: Constants.GRAVE_MAX_HEALTH, attackDamage: Constants.GRAVE_ATTACK_DAMAGE, attackSpeed: Constants.GRAVE_ATTACK_SPEED,
            attackRange: Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER,
            attackIgnoresDefense: false, defense: 18, regen: 3,
            abilityDescription: 'Orbits gravitic shards that launch at targets and return'
        },
        
        // Solari faction heroes
        createEmptyHero('solari-1', Faction.SOLARI),
        createEmptyHero('solari-2', Faction.SOLARI),
        createEmptyHero('solari-3', Faction.SOLARI),
        createEmptyHero('solari-4', Faction.SOLARI),
        createEmptyHero('solari-5', Faction.SOLARI),
        createEmptyHero('solari-6', Faction.SOLARI),
        createEmptyHero('solari-7', Faction.SOLARI),
        createEmptyHero('solari-8', Faction.SOLARI),
        createEmptyHero('solari-9', Faction.SOLARI),
        createEmptyHero('solari-10', Faction.SOLARI),
        createEmptyHero('solari-11', Faction.SOLARI),
        createEmptyHero('solari-12', Faction.SOLARI),
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

    constructor() {
        // Initialize default settings
        this.settings = {
            selectedMap: this.availableMaps[0],
            difficulty: 'normal',
            soundEnabled: true,
            musicEnabled: true,
            isBattleStatsInfoEnabled: false,
            selectedFaction: null,
            selectedHeroes: []
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
        menu.style.backgroundColor = 'rgba(0, 0, 10, 0.95)';
        menu.style.zIndex = '1000';
        menu.style.fontFamily = '"Doto", "Archivo Black", Arial, sans-serif';
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
        this.menuParticleLayer = new ParticleMenuLayer(menu);

        // Render main screen content into the menu element
        this.renderMainScreenContent(content);

        this.resizeHandler = () => {
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

    private clearMenu(): void {
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.contentElement) {
            this.contentElement.innerHTML = '';
        }
    }

    private setMenuParticleDensity(multiplier: number): void {
        const densityScale = 2;
        this.menuParticleLayer?.setDensityMultiplier(multiplier * densityScale);
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
        title.style.color = 'transparent';
        title.style.textShadow = 'none';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '800';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Speed of Light RTS';
        subtitle.style.fontSize = isCompactLayout ? '22px' : '30px';
        subtitle.style.marginBottom = '30px';
        subtitle.style.color = 'transparent';
        subtitle.style.textAlign = 'center';
        subtitle.style.maxWidth = '100%';
        subtitle.style.fontWeight = '700';
        subtitle.dataset.particleText = 'true';
        subtitle.dataset.particleColor = '#AAAAAA';
        container.appendChild(subtitle);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Select a menu option below';
        description.style.fontSize = isCompactLayout ? '16px' : '20px';
        description.style.marginBottom = '40px';
        description.style.maxWidth = '500px';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.5';
        description.style.color = 'transparent';
        description.style.fontWeight = '700';
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
        this.carouselMenu.onSelect((option: MenuOption) => {
            switch (option.id) {
                case 'loadout':
                    this.currentScreen = 'faction-select';
                    this.renderFactionSelectionScreen(this.contentElement);
                    break;
                case 'start':
                    this.hide();
                    if (this.onStartCallback) {
                        this.onStartCallback(this.settings);
                    }
                    break;
                case 'maps':
                    this.currentScreen = 'maps';
                    this.renderMapSelectionScreen(this.contentElement);
                    break;
                case 'settings':
                    this.currentScreen = 'settings';
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
            mapCard.style.border = map.id === this.settings.selectedMap.id ? '3px solid #FFD700' : '2px solid rgba(255, 255, 255, 0.2)';
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
            mapName.style.fontSize = '24px';
            mapName.style.marginBottom = '10px';
            mapName.style.color = map.id === this.settings.selectedMap.id ? '#FFD700' : '#FFFFFF';
            mapName.dataset.particleText = 'true';
            mapName.dataset.particleColor = map.id === this.settings.selectedMap.id ? '#FFF2B3' : '#E0F2FF';
            mapCard.appendChild(mapName);

            // Map description
            const mapDesc = document.createElement('p');
            mapDesc.textContent = map.description;
            mapDesc.style.fontSize = '14px';
            mapDesc.style.lineHeight = '1.5';
            mapDesc.style.marginBottom = '15px';
            mapDesc.style.color = '#CCCCCC';
            mapDesc.dataset.particleText = 'true';
            mapDesc.dataset.particleColor = '#CCCCCC';
            mapCard.appendChild(mapDesc);

            // Map stats
            const mapStats = document.createElement('div');
            mapStats.style.fontSize = '12px';
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

        container.appendChild(settingsContainer);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
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
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Faction grid
        const factionGrid = document.createElement('div');
        factionGrid.style.display = 'grid';
        factionGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${isCompactLayout ? 220 : 280}px, 1fr))`;
        factionGrid.style.gap = '20px';
        factionGrid.style.maxWidth = '900px';
        factionGrid.style.padding = '20px';
        factionGrid.style.marginBottom = '30px';

        const factions = [
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

        for (const faction of factions) {
            const factionCard = document.createElement('div');
            factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            factionCard.style.border = this.settings.selectedFaction === faction.id ? `3px solid ${faction.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            factionCard.style.borderRadius = '10px';
            factionCard.style.padding = '20px';
            factionCard.style.cursor = 'pointer';
            factionCard.style.transition = 'all 0.3s';
            factionCard.style.minHeight = '200px';
            factionCard.dataset.particleBox = 'true';
            factionCard.dataset.particleColor = this.settings.selectedFaction === faction.id ? faction.color : '#66B3FF';

            factionCard.addEventListener('mouseenter', () => {
                if (this.settings.selectedFaction !== faction.id) {
                    factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    factionCard.style.transform = 'scale(1.02)';
                }
            });

            factionCard.addEventListener('mouseleave', () => {
                factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                factionCard.style.transform = 'scale(1)';
            });

            factionCard.addEventListener('click', () => {
                this.settings.selectedFaction = faction.id;
                this.settings.selectedHeroes = []; // Reset hero selection when faction changes
                this.renderFactionSelectionScreen(this.contentElement);
            });

            // Faction name
            const factionName = document.createElement('h3');
            factionName.textContent = faction.name;
            factionName.style.fontSize = '28px';
            factionName.style.marginBottom = '15px';
            factionName.style.color = this.settings.selectedFaction === faction.id ? faction.color : '#FFFFFF';
            factionName.dataset.particleText = 'true';
            factionName.dataset.particleColor = this.settings.selectedFaction === faction.id ? '#FFFFFF' : '#E0F2FF';
            factionCard.appendChild(factionName);

            // Faction description
            const factionDesc = document.createElement('p');
            factionDesc.textContent = faction.description;
            factionDesc.style.fontSize = '14px';
            factionDesc.style.lineHeight = '1.5';
            factionDesc.style.color = '#CCCCCC';
            factionDesc.dataset.particleText = 'true';
            factionDesc.dataset.particleColor = '#CCCCCC';
            factionCard.appendChild(factionDesc);

            factionGrid.appendChild(factionCard);
        }

        container.appendChild(factionGrid);

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

        // Continue button (only enabled if faction is selected)
        if (this.settings.selectedFaction) {
            const continueButton = this.createButton('SELECT HEROES', () => {
                this.currentScreen = 'loadout-select';
                this.renderLoadoutSelectionScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(continueButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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
        title.style.color = 'transparent';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Selection counter
        const counter = document.createElement('div');
        counter.textContent = `Selected: ${this.settings.selectedHeroes.length} / 4`;
        counter.style.fontSize = isCompactLayout ? '16px' : '18px';
        counter.style.marginBottom = isCompactLayout ? '20px' : '30px';
        counter.style.color = 'transparent';
        counter.dataset.particleText = 'true';
        counter.dataset.particleColor = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        container.appendChild(counter);

        // Hero grid
        const heroGrid = document.createElement('div');
        heroGrid.style.display = 'grid';
        heroGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${isCompactLayout ? 220 : 280}px, 1fr))`;
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
            heroCard.style.border = isSelected ? '3px solid #00FF88' : '2px solid rgba(255, 255, 255, 0.2)';
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
            heroName.style.fontSize = '18px';
            heroName.style.marginBottom = '8px';
            heroName.style.color = 'transparent';
            heroName.dataset.particleText = 'true';
            heroName.dataset.particleColor = isSelected ? '#00FF88' : '#E0F2FF';
            heroCard.appendChild(heroName);

            // Hero description
            const heroDesc = document.createElement('p');
            heroDesc.textContent = hero.description;
            heroDesc.style.fontSize = '12px';
            heroDesc.style.lineHeight = '1.4';
            heroDesc.style.color = 'transparent';
            heroDesc.style.marginBottom = '10px';
            heroDesc.dataset.particleText = 'true';
            heroDesc.dataset.particleColor = '#AAAAAA';
            heroCard.appendChild(heroDesc);

            // Stats section
            const statsContainer = document.createElement('div');
            statsContainer.style.fontSize = '11px';
            statsContainer.style.lineHeight = '1.6';
            statsContainer.style.color = '#CCCCCC';
            statsContainer.style.marginBottom = '8px';
            statsContainer.style.padding = '8px';
            statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            statsContainer.style.borderRadius = '5px';

            // Create stat rows
            const healthStat = document.createElement('div');
            healthStat.textContent = `❤ Health: ${hero.maxHealth}`;
            healthStat.style.color = 'transparent';
            healthStat.dataset.particleText = 'true';
            healthStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(healthStat);

            const regenStat = document.createElement('div');
            regenStat.textContent = `♻ Regen: ${hero.regen}%`;
            regenStat.style.color = 'transparent';
            regenStat.dataset.particleText = 'true';
            regenStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(regenStat);

            const defenseStat = document.createElement('div');
            defenseStat.textContent = `🛡 Defense: ${hero.defense}%`;
            defenseStat.style.color = 'transparent';
            defenseStat.dataset.particleText = 'true';
            defenseStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(defenseStat);

            const attackStat = document.createElement('div');
            const attackIcon = hero.attackIgnoresDefense ? '⚡' : '⚔';
            const attackSuffix = hero.attackIgnoresDefense ? ' (ignores defense)' : '';
            attackStat.textContent = `${attackIcon} Attack: ${hero.attackDamage}${attackSuffix}`;
            attackStat.style.color = 'transparent';
            attackStat.dataset.particleText = 'true';
            attackStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackStat);

            const attackSpeedStat = document.createElement('div');
            attackSpeedStat.textContent = `⏱ Speed: ${hero.attackSpeed}/s`;
            attackSpeedStat.style.color = 'transparent';
            attackSpeedStat.dataset.particleText = 'true';
            attackSpeedStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackSpeedStat);

            const rangeStat = document.createElement('div');
            rangeStat.textContent = `🎯 Range: ${hero.attackRange}`;
            rangeStat.style.color = 'transparent';
            rangeStat.dataset.particleText = 'true';
            rangeStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(rangeStat);

            heroCard.appendChild(statsContainer);

            // Ability description
            const abilityDesc = document.createElement('div');
            abilityDesc.style.fontSize = '11px';
            abilityDesc.style.lineHeight = '1.4';
            abilityDesc.style.color = 'transparent';
            abilityDesc.style.marginBottom = '8px';
            abilityDesc.style.fontStyle = 'italic';
            abilityDesc.textContent = `✨ ${hero.abilityDescription}`;
            abilityDesc.dataset.particleText = 'true';
            abilityDesc.dataset.particleColor = '#FFD700';
            heroCard.appendChild(abilityDesc);

            // Selection indicator
            if (isSelected) {
                const indicator = document.createElement('div');
                indicator.textContent = '✓ Selected';
                indicator.style.fontSize = '12px';
                indicator.style.marginTop = '8px';
                indicator.style.color = 'transparent';
                indicator.style.fontWeight = 'bold';
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
                this.renderMainScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(confirmButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'faction-select';
            this.renderFactionSelectionScreen(this.contentElement);
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
        button.style.backgroundColor = color;
        button.style.color = color === '#666666' ? '#FFFFFF' : '#000000';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.transition = 'all 0.3s';
        button.dataset.particleBox = 'true';
        button.dataset.particleColor = color;
        
        button.addEventListener('mouseenter', () => {
            const hoverColor = color === '#FFD700' ? '#FFA500' : 
                               color === '#00AAFF' ? '#0088DD' : 
                               color === '#00FF88' ? '#00DD66' : '#888888';
            button.style.backgroundColor = hoverColor;
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = color;
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
        labelElement.style.fontSize = '18px';
        labelElement.style.color = '#FFFFFF';
        labelElement.dataset.particleText = 'true';
        labelElement.dataset.particleColor = '#FFFFFF';

        section.appendChild(labelElement);
        section.appendChild(control);

        return section;
    }

    private createSelect(options: string[], currentValue: string, onChange: (value: string) => void): HTMLSelectElement {
        const select = document.createElement('select');
        select.style.fontSize = '16px';
        select.style.padding = '8px 15px';
        select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        select.style.color = '#FFFFFF';
        select.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        select.style.borderRadius = '5px';
        select.style.cursor = 'pointer';

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
        this.menuParticleLayer?.stop();
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'block';
        this.currentScreen = 'main';
        this.renderMainScreen(this.contentElement);
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
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
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
    
    private container: HTMLElement;
    private options: MenuOption[];
    private currentIndex: number = 0;
    private targetIndex: number = 0;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private velocity: number = 0;
    private onSelectCallback: ((option: MenuOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private animationFrameId: number | null = null;
    private hasDragged: boolean = false;

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
        this.container.style.height = '600px';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y'; // Allow vertical scrolling but handle horizontal ourselves
    }

    private setupEventHandlers(): void {
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
        this.container.style.cursor = 'grabbing';
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartX;
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
        
        // Snap to nearest option based on current position and velocity
        const targetIndexFloat = -this.scrollOffset / CarouselMenuView.ITEM_WIDTH;
        let targetIndex = Math.round(targetIndexFloat + this.velocity * CarouselMenuView.VELOCITY_FACTOR);
        
        // Clamp to valid range
        targetIndex = Math.max(0, Math.min(this.options.length - 1, targetIndex));
        this.targetIndex = targetIndex;
        this.currentIndex = targetIndex;
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        
        // Determine which option was clicked based on position
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / CarouselMenuView.ITEM_WIDTH);
        const clickedIndex = Math.max(0, Math.min(this.options.length - 1, clickedOffset));
        
        if (clickedIndex === this.currentIndex) {
            // Clicked on center option - select it
            if (this.onSelectCallback) {
                this.onSelectCallback(this.options[this.currentIndex]);
            }
        } else {
            // Clicked on different option - slide to it
            this.targetIndex = clickedIndex;
            this.currentIndex = clickedIndex;
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

    private update(): void {
        // Smooth scrolling towards target
        const targetScrollOffset = -this.currentIndex * CarouselMenuView.ITEM_WIDTH;
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
        
        // Render each option
        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            
            // Calculate position
            const x = centerX + this.scrollOffset + i * CarouselMenuView.ITEM_WIDTH;
            
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
            
            const size = CarouselMenuView.BASE_SIZE * scale;
            
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
            optionElement.style.fontWeight = 'bold';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = '30px';
            optionElement.style.boxSizing = 'border-box';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? '#FFD700' : '#00AAFF';
            
            // Add option name
            const nameElement = document.createElement('div');
            nameElement.textContent = option.name;
            nameElement.style.fontSize = `${Math.max(14, 18 * scale) * CarouselMenuView.TEXT_SCALE}px`;
            nameElement.style.marginBottom = '15px';
            nameElement.style.color = 'transparent';
            nameElement.style.fontWeight = '700';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            optionElement.appendChild(nameElement);
            
            // Add option description (only for center item)
            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * CarouselMenuView.TEXT_SCALE}px`;
                descElement.style.color = 'transparent';
                descElement.style.overflow = 'hidden';
                descElement.style.textOverflow = 'ellipsis';
                descElement.style.fontWeight = '700';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }
            
            this.container.appendChild(optionElement);
        }
        
        // Add instruction text
        const instructionElement = document.createElement('div');
        instructionElement.textContent = 'Drag to browse • Click center to select';
        instructionElement.style.position = 'absolute';
        instructionElement.style.bottom = '20px';
        instructionElement.style.left = '50%';
        instructionElement.style.transform = 'translateX(-50%)';
        instructionElement.style.color = 'transparent';
        instructionElement.style.fontSize = '16px';
        instructionElement.style.fontWeight = '700';
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

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
