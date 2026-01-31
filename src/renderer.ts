/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, Asteroid, LightRay, Unit, Marine, Grave, Starling, GraveProjectile, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet, MinionProjectile, LaserBeam, ImpactParticle, Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, Ray, RayBeamSegment, InfluenceBall, InfluenceZone, InfluenceBallProjectile, TurretDeployer, DeployedTurret, Driller, Dagger, DamageNumber, Beam, Mortar, Preist, HealingBombParticle, Tank, CrescentWave } from './game-core';
import * as Constants from './constants';
import { ColorScheme, COLOR_SCHEMES } from './menu';

type GraphicVariant = 'svg' | 'png' | 'stub';
type GraphicKey =
    | 'centralSun'
    | 'stellarForge'
    | 'forgeFlameHot'
    | 'forgeFlameCold'
    | 'solarMirror'
    | 'starling'
    | 'heroMarine'
    | 'heroGrave'
    | 'heroDagger'
    | 'heroBeam'
    | 'heroMortar'
    | 'heroRay'
    | 'heroInfluenceBall'
    | 'heroTurretDeployer'
    | 'heroDriller'
    | 'heroPreist'
    | 'heroTank';

type GraphicOption = {
    key: GraphicKey;
    label: string;
    svgPath?: string;
    pngPath?: string;
};

type InGameMenuTab = 'main' | 'options' | 'graphics';

type InGameMenuAction =
    | { type: 'resume' }
    | { type: 'toggleInfo' }
    | { type: 'surrender' }
    | { type: 'tab'; tab: InGameMenuTab }
    | { type: 'graphicsVariant'; key: GraphicKey; variant: GraphicVariant }
    | { type: 'damageDisplayMode'; mode: 'damage' | 'remaining-life' }
    | { type: 'healthDisplayMode'; mode: 'bar' | 'number' };

type InGameMenuLayout = {
    screenWidth: number;
    screenHeight: number;
    panelX: number;
    panelY: number;
    panelWidth: number;
    panelHeight: number;
    isCompactLayout: boolean;
    titleY: number;
    tabs: Array<{
        tab: InGameMenuTab;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    contentTopY: number;
    contentBottomY: number;
    buttonWidth: number;
    buttonHeight: number;
    buttonX: number;
    buttonSpacing: number;
    graphicsListX: number;
    graphicsListY: number;
    graphicsListWidth: number;
    graphicsListHeight: number;
    graphicsRowHeight: number;
    graphicsButtonWidth: number;
    graphicsButtonHeight: number;
    graphicsButtonGap: number;
};

type ForgeFlameState = {
    warmth: number;
    rotationRad: number;
    lastGameTime: number;
};

export class GameRenderer {
    public canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public camera: Vector2D = new Vector2D(0, 0);
    private parallaxCamera: Vector2D = new Vector2D(0, 0);
    public zoom: number = 1.0;
    public selectionStart: Vector2D | null = null;
    public selectionEnd: Vector2D | null = null;
    public abilityArrowStarts: Vector2D[] = []; // Arrow starts for hero ability casting
    public abilityArrowEnd: Vector2D | null = null; // Arrow end for hero ability casting
    public selectedUnits: Set<Unit> = new Set();
    public pathPreviewForge: StellarForge | null = null;
    public pathPreviewPoints: Vector2D[] = [];
    public pathPreviewEnd: Vector2D | null = null;
    public selectedHeroNames: string[] = [];
    private tapEffects: Array<{position: Vector2D, progress: number}> = [];
    private swipeEffects: Array<{start: Vector2D, end: Vector2D, progress: number}> = [];
    private warpGateShockwaves: Array<{position: Vector2D, progress: number}> = [];
    private productionButtonWaves: Array<{position: Vector2D, progress: number}> = [];
    public viewingPlayer: Player | null = null; // The player whose view we're rendering
    public showInfo: boolean = false; // Toggle for showing top-left info
    public showInGameMenu: boolean = false; // Toggle for in-game menu
    public isPaused: boolean = false; // Game pause state
    public playerColor: string = Constants.PLAYER_1_COLOR; // Player 1 color (customizable)
    public enemyColor: string = Constants.PLAYER_2_COLOR; // Player 2 color (customizable)
    public colorScheme: ColorScheme = COLOR_SCHEMES['SpaceBlack']; // Color scheme for rendering
    public inGameMenuTab: InGameMenuTab = 'main';
    public damageDisplayMode: 'damage' | 'remaining-life' = 'damage'; // How to display damage numbers
    public healthDisplayMode: 'bar' | 'number' = 'bar'; // How to display unit health
    public graphicsQuality: 'low' | 'medium' | 'high' = 'high'; // Graphics quality setting

    private readonly HERO_SPRITE_SCALE = 4.2;
    private readonly FORGE_SPRITE_SCALE = 2.64;
    private spriteImageCache = new Map<string, HTMLImageElement>();
    private tintedSpriteCache = new Map<string, HTMLCanvasElement>();
    private outlinedSpriteCache = new Map<string, HTMLCanvasElement>();
    private forgeFlameStates = new Map<StellarForge, ForgeFlameState>();
    private viewMinX: number = 0;
    private viewMaxX: number = 0;
    private viewMinY: number = 0;
    private viewMaxY: number = 0;
    private graphicsOptionByKey = new Map<GraphicKey, GraphicOption>();
    private graphicsVariantByKey = new Map<GraphicKey, GraphicVariant>();
    private graphicsMenuScrollOffset = 0;

    private readonly graphicsOptions: GraphicOption[] = [
        {
            key: 'centralSun',
            label: 'Central Sun',
            svgPath: 'ASSETS/sprites/environment/centralSun.svg',
            pngPath: 'ASSETS/sprites/environment/centralSun.png'
        },
        {
            key: 'stellarForge',
            label: 'Stellar Forge Base',
            svgPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantBaseType1.svg',
            pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantBaseType1.png'
        },
        {
            key: 'forgeFlameHot',
            label: 'Forge Flame (Hot)',
            pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantForgeFlame.png'
        },
        {
            key: 'forgeFlameCold',
            label: 'Forge Flame (Cold)',
            pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantForgeFlameCold.png'
        },
        {
            key: 'solarMirror',
            label: 'Solar Mirror',
            svgPath: 'ASSETS/sprites/RADIANT/solarMirrors/radiantSolarMirror.svg',
            pngPath: 'ASSETS/sprites/RADIANT/solarMirrors/radiantSolarMirror.png'
        },
        {
            key: 'starling',
            label: 'Starling',
            svgPath: 'ASSETS/sprites/RADIANT/starlings/starlingLevel (1).svg',
            pngPath: 'ASSETS/sprites/RADIANT/starlings/starlingLevel (1).png'
        },
        {
            key: 'heroMarine',
            label: 'Hero: Marine',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Marine.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Marine.png'
        },
        {
            key: 'heroGrave',
            label: 'Hero: Grave',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Grave.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Grave.png'
        },
        {
            key: 'heroRay',
            label: 'Hero: Ray',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Ray.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Ray.png'
        },
        {
            key: 'heroInfluenceBall',
            label: 'Hero: Influence Ball',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Uniter.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Uniter.png'
        },
        {
            key: 'heroTurretDeployer',
            label: 'Hero: Turret Deployer',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Engineer.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Engineer.png'
        },
        {
            key: 'heroDriller',
            label: 'Hero: Driller',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Drill.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Drill.png'
        },
        {
            key: 'heroDagger',
            label: 'Hero: Dagger',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Dagger.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Dagger.png'
        },
        {
            key: 'heroBeam',
            label: 'Hero: Beam',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Beam.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Beam.png'
        },
        {
            key: 'heroPreist',
            label: 'Hero: Preist',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Preist.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Preist.png'
        },
        {
            key: 'heroTank',
            label: 'Hero: Tank',
            svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Tank.svg',
            pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Tank.png'
        }
    ];

    private static readonly CONTROL_LINES_FULL = [
        'Controls: Drag to select units',
        'Pan: WASD/Arrows or mouse edge or two-finger drag',
        'Zoom: Scroll/Pinch (zooms toward cursor)',
        'Hold still 6 seconds in influence to open warp gate'
    ];

    private static readonly CONTROL_LINES_COMPACT = [
        'Controls: Drag to select units',
        'Pan: WASD/Arrows or two-finger drag',
        'Zoom: Scroll/Pinch toward cursor',
        'Hold still 6s in influence to open warp gate'
    ];
    
    // Movement order indicator constants
    private readonly MOVE_ORDER_DOT_RADIUS = 12;
    private readonly FORGE_MAX_HEALTH = 1000;
    private readonly MIRROR_MAX_HEALTH = Constants.MIRROR_MAX_HEALTH;
    
    // Parallax star layers for depth
    private starLayers: Array<{
        stars: Array<{x: number, y: number, size: number, brightness: number}>,
        parallaxFactor: number
    }> = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = context;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Initialize star layers with random positions
        this.initializeStarLayers();

        const defaultPngKeys: GraphicKey[] = ['stellarForge', 'solarMirror'];
        for (const option of this.graphicsOptions) {
            this.graphicsOptionByKey.set(option.key, option);
            const defaultVariant: GraphicVariant = option.svgPath ? 'svg' : option.pngPath ? 'png' : 'stub';
            const shouldPreferPng = defaultPngKeys.includes(option.key) && option.pngPath;
            this.graphicsVariantByKey.set(option.key, shouldPreferPng ? 'png' : defaultVariant);
        }
    }

    private resizeCanvas(): void {
        // Get device pixel ratio for high-DPI displays (retina, mobile, etc.)
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas physical size to match display size * device pixel ratio
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        
        // Set canvas CSS size to match window size
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
        
        // Reset transform and scale the context to match device pixel ratio
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Initialize star layers with random positions for parallax effect
     */
    private initializeStarLayers(): void {
        // Use a seeded random for consistent star positions
        let seed = 42;
        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
        
        for (const layerConfig of Constants.STAR_LAYER_CONFIGS) {
            const stars: Array<{x: number, y: number, size: number, brightness: number}> = [];
            
            for (let i = 0; i < layerConfig.count; i++) {
                stars.push({
                    x: seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2,
                    y: seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2,
                    size: layerConfig.sizeRange[0] + seededRandom() * (layerConfig.sizeRange[1] - layerConfig.sizeRange[0]),
                    brightness: 0.3 + seededRandom() * 0.7  // Vary brightness
                });
            }
            
            this.starLayers.push({
                stars,
                parallaxFactor: layerConfig.parallaxFactor
            });
        }
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPos: Vector2D): Vector2D {
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;
        return new Vector2D(
            centerX + (worldPos.x - this.camera.x) * this.zoom,
            centerY + (worldPos.y - this.camera.y) * this.zoom
        );
    }

    /**
     * Check if a world position is within render bounds (map boundaries)
     * @param worldPos Position in world space
     * @param mapSize Size of the map
     * @param margin Additional margin beyond map size (default 0)
     * @returns true if position should be rendered
     */
    private isWithinRenderBounds(worldPos: Vector2D, mapSize: number, margin: number = 0): boolean {
        const halfSize = mapSize / 2;
        return worldPos.x >= -halfSize - margin && 
               worldPos.x <= halfSize + margin && 
               worldPos.y >= -halfSize - margin && 
               worldPos.y <= halfSize + margin;
    }

    private updateViewBounds(): void {
        const dpr = window.devicePixelRatio || 1;
        const viewHalfWidth = (this.canvas.width / dpr) / (2 * this.zoom);
        const viewHalfHeight = (this.canvas.height / dpr) / (2 * this.zoom);

        this.viewMinX = this.camera.x - viewHalfWidth;
        this.viewMaxX = this.camera.x + viewHalfWidth;
        this.viewMinY = this.camera.y - viewHalfHeight;
        this.viewMaxY = this.camera.y + viewHalfHeight;
    }

    private isWithinViewBounds(worldPos: Vector2D, margin: number = 0): boolean {
        return worldPos.x >= this.viewMinX - margin &&
               worldPos.x <= this.viewMaxX + margin &&
               worldPos.y >= this.viewMinY - margin &&
               worldPos.y <= this.viewMaxY + margin;
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): Vector2D {
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;
        return new Vector2D(
            this.camera.x + (screenX - centerX) / this.zoom,
            this.camera.y + (screenY - centerY) / this.zoom
        );
    }

    /**
     * Get faction color
     */
    private getFactionColor(faction: Faction): string {
        switch (faction) {
            case Faction.RADIANT:
                return '#FFD700'; // Gold
            case Faction.AURUM:
                return '#DAA520'; // Goldenrod
            case Faction.SOLARI:
                return '#FF8C00'; // Dark orange
            default:
                return '#FFFFFF';
        }
    }

    private getSpriteImage(path: string): HTMLImageElement {
        const resolvedPath = this.resolveAssetPath(path);
        const cached = this.spriteImageCache.get(resolvedPath);
        if (cached) {
            return cached;
        }
        const image = new Image();
        image.src = resolvedPath;
        this.spriteImageCache.set(resolvedPath, image);
        return image;
    }

    private getTintedSprite(path: string, color: string): HTMLCanvasElement | null {
        const resolvedPath = this.resolveAssetPath(path);
        const cacheKey = `${resolvedPath}|${color}`;
        const cached = this.tintedSpriteCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const image = this.getSpriteImage(resolvedPath);
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        this.tintedSpriteCache.set(cacheKey, canvas);
        return canvas;
    }

    /**
     * Get a sprite with a colored tint and white outline
     */
    private getOutlinedTintedSprite(path: string, color: string): HTMLCanvasElement | null {
        const resolvedPath = this.resolveAssetPath(path);
        const cacheKey = `${resolvedPath}|${color}|outlined`;
        const cached = this.outlinedSpriteCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const image = this.getSpriteImage(resolvedPath);
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return null;
        }

        // Create a larger canvas to accommodate the outline
        const outlineWidth = 2;
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth + outlineWidth * 2;
        canvas.height = image.naturalHeight + outlineWidth * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        // Draw white outline by drawing the image multiple times offset in all directions
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'white';
        
        // Draw outline in 8 directions
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const offsetX = Math.cos(angle) * outlineWidth + outlineWidth;
            const offsetY = Math.sin(angle) * outlineWidth + outlineWidth;
            ctx.drawImage(image, offsetX, offsetY);
        }
        
        // Fill the outline with white
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the colored sprite on top
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(image, outlineWidth, outlineWidth);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = color;
        ctx.fillRect(outlineWidth, outlineWidth, image.naturalWidth, image.naturalHeight);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, outlineWidth, outlineWidth);
        ctx.globalCompositeOperation = 'source-over';

        this.outlinedSpriteCache.set(cacheKey, canvas);
        return canvas;
    }

    private resolveAssetPath(path: string): string {
        if (!path.startsWith('ASSETS/')) {
            return path;
        }
        const isDistBuild = window.location.pathname.includes('/dist/');
        return isDistBuild ? `../${path}` : path;
    }

    private getGraphicVariant(key: GraphicKey): GraphicVariant {
        return this.graphicsVariantByKey.get(key) ?? 'stub';
    }

    public setGraphicsVariant(key: GraphicKey, variant: GraphicVariant): void {
        this.graphicsVariantByKey.set(key, variant);
    }

    public setInGameMenuTab(tab: InGameMenuTab): void {
        this.inGameMenuTab = tab;
    }

    private getGraphicAssetPath(key: GraphicKey): string | null {
        const option = this.graphicsOptionByKey.get(key);
        if (!option) {
            return null;
        }
        const variant = this.getGraphicVariant(key);
        if (variant === 'svg') {
            return option.svgPath ?? null;
        }
        if (variant === 'png') {
            return option.pngPath ?? null;
        }
        return null;
    }

    private getForgeSpritePath(forge: StellarForge): string | null {
        if (forge.owner.faction === Faction.RADIANT) {
            return this.getGraphicAssetPath('stellarForge');
        }
        return null;
    }

    private getSolarMirrorSpritePath(mirror: SolarMirror): string | null {
        if (mirror.owner.faction === Faction.RADIANT) {
            return this.getGraphicAssetPath('solarMirror');
        }
        return null;
    }

    private getStarlingSpritePath(starling: Starling): string | null {
        if (starling.owner.faction === Faction.RADIANT) {
            // Use level 1 starling sprite
            return this.getGraphicAssetPath('starling');
        }
        return null;
    }

    private getStarlingFacingRotationRad(starling: Starling): number | null {
        // Use the unit's smooth rotation if it's moving
        if (starling.rallyPoint) {
            const distanceToRally = starling.position.distanceTo(starling.rallyPoint);
            if (distanceToRally > Constants.UNIT_ARRIVAL_THRESHOLD) {
                // Use the smoothly interpolated rotation from the unit's movement logic
                return starling.rotation;
            }
        }

        // If not moving but has a target, face the target
        if (starling.target && 'position' in starling.target) {
            if (!('health' in starling.target) || starling.target.health > 0) {
                const targetPosition = starling.target.position;
                const dx = targetPosition.x - starling.position.x;
                const dy = targetPosition.y - starling.position.y;
                if (dx !== 0 || dy !== 0) {
                    // Add π/2 so the TOP of the sprite is treated as the FRONT
                    return Math.atan2(dy, dx) + Math.PI / 2;
                }
            }
        }

        return starling.rotation;
    }

    private getForgeFlameState(forge: StellarForge, gameTime: number): ForgeFlameState {
        let state = this.forgeFlameStates.get(forge);
        if (!state) {
            state = {
                warmth: forge.isReceivingLight ? 1 : 0,
                rotationRad: forge.rotation,
                lastGameTime: gameTime
            };
            this.forgeFlameStates.set(forge, state);
            return state;
        }

        const deltaTime = Math.max(0, gameTime - state.lastGameTime);
        state.lastGameTime = gameTime;

        const targetWarmth = forge.isReceivingLight ? 1 : 0;
        if (targetWarmth > state.warmth) {
            state.warmth = Math.min(1, state.warmth + Constants.FORGE_FLAME_WARMTH_FADE_PER_SEC * deltaTime);
        } else if (targetWarmth < state.warmth) {
            state.warmth = Math.max(0, state.warmth - Constants.FORGE_FLAME_WARMTH_FADE_PER_SEC * deltaTime);
        }

        if (forge.isReceivingLight) {
            const crunch = forge.getCurrentCrunch();
            const speedMultiplier = crunch && crunch.isActive() ? 2 : 1;
            state.rotationRad += Constants.FORGE_FLAME_ROTATION_SPEED_RAD_PER_SEC * speedMultiplier * deltaTime;
            if (state.rotationRad >= Math.PI * 2) {
                state.rotationRad -= Math.PI * 2;
            }
        }

        return state;
    }

    private getHeroSpritePath(unit: Unit): string | null {
        if (unit.owner.faction !== Faction.RADIANT) {
            return null;
        }
        if (unit instanceof Marine) {
            return this.getGraphicAssetPath('heroMarine');
        }
        if (unit instanceof Grave) {
            return this.getGraphicAssetPath('heroGrave');
        }
        if (unit instanceof Dagger) {
            return this.getGraphicAssetPath('heroDagger');
        }
        if (unit instanceof Beam) {
            return this.getGraphicAssetPath('heroBeam');
        }
        if (unit instanceof Mortar) {
            return this.getGraphicAssetPath('heroMortar');
        }
        if (unit instanceof Ray) {
            return this.getGraphicAssetPath('heroRay');
        }
        if (unit instanceof InfluenceBall) {
            return this.getGraphicAssetPath('heroInfluenceBall');
        }
        if (unit instanceof TurretDeployer) {
            return this.getGraphicAssetPath('heroTurretDeployer');
        }
        if (unit instanceof Driller) {
            return this.getGraphicAssetPath('heroDriller');
        }
        if (unit instanceof Preist) {
            return this.getGraphicAssetPath('heroPreist');
        }
        if (unit instanceof Tank) {
            return this.getGraphicAssetPath('heroTank');
        }
        return null;
    }

    /**
     * Darken a color by a given factor (0-1, where 0 is black and 1 is original color)
     */
    private darkenColor(color: string, factor: number): string {
        // Clamp factor to valid range [0, 1]
        const clampedFactor = Math.max(0, Math.min(1, factor));
        
        // Parse hex color (handle both #RGB and #RRGGBB formats)
        let hex = color.replace('#', '');
        if (hex.length === 3) {
            // Convert #RGB to #RRGGBB
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        
        // Apply darkening factor and clamp to valid RGB range
        const newR = Math.floor(Math.min(255, r * clampedFactor));
        const newG = Math.floor(Math.min(255, g * clampedFactor));
        const newB = Math.floor(Math.min(255, b * clampedFactor));
        
        // Convert back to hex
        return '#' + 
               newR.toString(16).padStart(2, '0') +
               newG.toString(16).padStart(2, '0') +
               newB.toString(16).padStart(2, '0');
    }

    /**
     * Brighten and pale a color (make it lighter and more desaturated)
     * Used for solar mirrors to make them slightly brighter and paler than player color
     */
    private brightenAndPaleColor(color: string): string {
        // Parse hex color
        let hex = color.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        
        // Brighten: move towards white by 20%
        const brightenFactor = 0.2;
        const brightenedR = r + (255 - r) * brightenFactor;
        const brightenedG = g + (255 - g) * brightenFactor;
        const brightenedB = b + (255 - b) * brightenFactor;
        
        // Pale (desaturate): move towards average (gray) by 15%
        const avg = (brightenedR + brightenedG + brightenedB) / 3;
        const paleFactor = 0.15;
        const newR = Math.floor(brightenedR + (avg - brightenedR) * paleFactor);
        const newG = Math.floor(brightenedG + (avg - brightenedG) * paleFactor);
        const newB = Math.floor(brightenedB + (avg - brightenedB) * paleFactor);
        
        return '#' + 
               newR.toString(16).padStart(2, '0') +
               newG.toString(16).padStart(2, '0') +
               newB.toString(16).padStart(2, '0');
    }

    /**
     * Draw a selection indicator (green dashed circle) for selected buildings
     */
    private drawBuildingSelectionIndicator(screenPos: { x: number, y: number }, radius: number): void {
        this.ctx.strokeStyle = '#00FF00'; // Green highlight for selection
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset dash pattern
    }

    /**
     * Draw a sun
     */
    private drawSun(sun: Sun): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        
        // Special rendering for LaD (Light and Dark) sun
        if (sun.type === 'lad') {
            this.drawLadSun(sun, screenPos, screenRadius);
            return;
        }
        
        const sunSpritePath = this.getGraphicAssetPath('centralSun');
        const sunSprite = sunSpritePath ? this.getSpriteImage(sunSpritePath) : null;

        // Draw sun glow (outer glow)
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, this.colorScheme.sunGlow.outerGlow1);
        gradient.addColorStop(0.5, this.colorScheme.sunGlow.outerGlow2);
        gradient.addColorStop(0.8, this.colorScheme.sunGlow.outerGlow3);
        gradient.addColorStop(1, this.colorScheme.sunGlow.outerGlow4);

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();

        if (sunSprite && sunSprite.complete && sunSprite.naturalWidth > 0) {
            const diameterPx = screenRadius * 2;
            this.ctx.drawImage(
                sunSprite,
                screenPos.x - screenRadius,
                screenPos.y - screenRadius,
                diameterPx,
                diameterPx
            );
            return;
        }

        // Stub fallback when no sprite is available.
        this.ctx.strokeStyle = this.colorScheme.sunGlow.outerGlow1;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius * 0.8, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    private drawLadSun(sun: Sun, screenPos: Vector2D, screenRadius: number): void {
        // Save context state
        this.ctx.save();

        // Draw left half (white)
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, Math.PI / 2, -Math.PI / 2);
        this.ctx.closePath();
        this.ctx.clip();

        // White gradient
        const whiteGradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        whiteGradient.addColorStop(0, '#FFFFFF');
        whiteGradient.addColorStop(0.5, '#EEEEEE');
        whiteGradient.addColorStop(0.8, '#CCCCCC');
        whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');

        this.ctx.fillStyle = whiteGradient;
        this.ctx.fillRect(screenPos.x - screenRadius, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context to draw right half
        this.ctx.restore();
        this.ctx.save();

        // Draw right half (black)
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, -Math.PI / 2, Math.PI / 2);
        this.ctx.closePath();
        this.ctx.clip();

        // Black gradient
        const blackGradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        blackGradient.addColorStop(0, '#000000');
        blackGradient.addColorStop(0.5, '#111111');
        blackGradient.addColorStop(0.8, '#222222');
        blackGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');

        this.ctx.fillStyle = blackGradient;
        this.ctx.fillRect(screenPos.x, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context
        this.ctx.restore();

        // Draw dividing line between light and dark
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - screenRadius);
        this.ctx.lineTo(screenPos.x, screenPos.y + screenRadius);
        this.ctx.stroke();
    }

    private drawForgeFlames(
        forge: StellarForge,
        screenPos: Vector2D,
        forgeSpriteSize: number,
        game: GameState,
        shouldDim: boolean
    ): void {
        const flameState = this.getForgeFlameState(forge, game.gameTime);
        const hotSpritePath = this.getGraphicAssetPath('forgeFlameHot');
        const coldSpritePath = this.getGraphicAssetPath('forgeFlameCold');
        if (!hotSpritePath || !coldSpritePath) {
            return;
        }
        const hotSprite = this.getSpriteImage(hotSpritePath);
        const coldSprite = this.getSpriteImage(coldSpritePath);

        if (!hotSprite.complete || hotSprite.naturalWidth === 0 || !coldSprite.complete || coldSprite.naturalWidth === 0) {
            return;
        }

        const flameSize = forgeSpriteSize * Constants.FORGE_FLAME_SIZE_MULTIPLIER;
        const shadeMultiplier = shouldDim ? (1 - Constants.SHADE_OPACITY) : 1;
        const baseAlpha = Constants.FORGE_FLAME_ALPHA * shadeMultiplier;
        const hotAlpha = baseAlpha * flameState.warmth;
        const coldAlpha = baseAlpha * (1 - flameState.warmth);

        // Both flames overlap at the same position instead of being side by side
        const flameOffsets = [0, 0];

        for (let i = 0; i < flameOffsets.length; i++) {
            const offsetX = flameOffsets[i];
            const rotationRad = i === 0 ? flameState.rotationRad : -flameState.rotationRad;

            this.ctx.save();
            this.ctx.translate(screenPos.x + offsetX, screenPos.y);
            this.ctx.rotate(rotationRad);

            if (coldAlpha > 0) {
                this.ctx.globalAlpha = coldAlpha;
                this.ctx.drawImage(coldSprite, -flameSize / 2, -flameSize / 2, flameSize, flameSize);
            }

            if (hotAlpha > 0) {
                this.ctx.globalAlpha = hotAlpha;
                this.ctx.drawImage(hotSprite, -flameSize / 2, -flameSize / 2, flameSize, flameSize);
            }

            this.ctx.restore();
        }

        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a subtle lens flare effect when a sun is visible on screen
     */
    private drawLensFlare(sun: Sun): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        
        // Check if sun is within or near the viewport
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = this.canvas.width / dpr;
        const canvasHeight = this.canvas.height / dpr;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        // Calculate direction vector from screen center to sun
        const dx = screenPos.x - centerX;
        const dy = screenPos.y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        // Only draw lens flare if sun is reasonably visible
        const maxDistance = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) / 2;
        if (distanceFromCenter > maxDistance + screenRadius) {
            return; // Sun is too far off screen
        }
        
        // Draw multiple subtle flare spots at different positions along the sun-center axis
        // offset: position multiplier along the axis (-1 = opposite side, 0 = center, 1 = sun)
        // size: flare radius as a fraction of sun radius
        // Extract base color and alpha from colorScheme.lensFlareHalo
        const haloColorMatch = this.colorScheme.lensFlareHalo.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const haloBaseColor = haloColorMatch 
            ? `rgba(${haloColorMatch[1]}, ${haloColorMatch[2]}, ${haloColorMatch[3]}, `
            : 'rgba(255, 240, 200, ';
        
        const flarePositions = [
            { offset: -0.3, size: 0.4, alpha: 0.15 },
            { offset: -0.5, size: 0.25, alpha: 0.12 },
            { offset: 0.4, size: 0.3, alpha: 0.1 },
            { offset: 0.7, size: 0.2, alpha: 0.08 }
        ];
        
        for (const flare of flarePositions) {
            // Calculate position along the sun-center line
            const flareX = centerX + dx * flare.offset;
            const flareY = centerY + dy * flare.offset;
            const flareRadius = screenRadius * flare.size;
            
            // Draw flare spot with radial gradient
            const flareGradient = this.ctx.createRadialGradient(
                flareX, flareY, 0,
                flareX, flareY, flareRadius
            );
            flareGradient.addColorStop(0, `${haloBaseColor}${flare.alpha})`);
            flareGradient.addColorStop(0.5, `${haloBaseColor}${flare.alpha * 0.5})`);
            flareGradient.addColorStop(1, `${haloBaseColor}0)`);
            
            this.ctx.fillStyle = flareGradient;
            this.ctx.beginPath();
            this.ctx.arc(flareX, flareY, flareRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw subtle hexagonal starburst around the sun
        this.ctx.save();
        this.ctx.globalAlpha = 0.2;
        this.ctx.strokeStyle = this.colorScheme.lensFlareHalo;
        this.ctx.lineWidth = 2;
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const rayLength = screenRadius * 1.5;
            const startX = screenPos.x + Math.cos(angle) * screenRadius * 0.7;
            const startY = screenPos.y + Math.sin(angle) * screenRadius * 0.7;
            const endX = screenPos.x + Math.cos(angle) * rayLength;
            const endY = screenPos.y + Math.sin(angle) * rayLength;
            
            // Create gradient for each ray - increase alpha for better visibility
            const rayGradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
            const rayColor = haloBaseColor + '0.4)';
            rayGradient.addColorStop(0, rayColor);
            rayGradient.addColorStop(1, `${haloBaseColor}0)`);
            
            this.ctx.strokeStyle = rayGradient;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    /**
     * Draw a Stellar Forge
     */
    private drawStellarForge(forge: StellarForge, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(forge.position);
        const size = 40 * this.zoom;

        // Check visibility for enemy forges
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(forge.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy forge
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(forge.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }

        // Draw selection circle if selected
        if (forge.isSelected) {
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw minion path if it exists
            if (forge.minionPath.length > 0) {
                this.ctx.strokeStyle = '#FFFF00'; // Yellow path
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([10, 5]); // Dashed line
                this.ctx.beginPath();
                
                // Start from the forge position
                const startScreen = this.worldToScreen(forge.position);
                this.ctx.moveTo(startScreen.x, startScreen.y);
                
                // Draw line through all waypoints
                for (const waypoint of forge.minionPath) {
                    const waypointScreen = this.worldToScreen(waypoint);
                this.ctx.lineTo(waypointScreen.x, waypointScreen.y);
                }
                
                this.ctx.stroke();
                this.ctx.setLineDash([]); // Reset to solid line
                
                // Draw waypoint markers
                this.ctx.fillStyle = '#FFFF00';
                for (let i = 0; i < forge.minionPath.length; i++) {
                    const waypoint = forge.minionPath[i];
                    const waypointScreen = this.worldToScreen(waypoint);
                    this.ctx.beginPath();
                    this.ctx.arc(waypointScreen.x, waypointScreen.y, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Draw number for waypoint
                    if (i === forge.minionPath.length - 1) {
                        // Last waypoint gets special marker
                        this.ctx.strokeStyle = '#FFFF00';
                        this.ctx.lineWidth = 2;
                        this.ctx.beginPath();
                        this.ctx.arc(waypointScreen.x, waypointScreen.y, 8, 0, Math.PI * 2);
                        this.ctx.stroke();
                    }
                }
            }

            // Draw path preview while drawing a new path
            if (this.pathPreviewForge === forge && (this.pathPreviewPoints.length > 0 || this.pathPreviewEnd)) {
                this.drawMinionPathPreview(forge.position, this.pathPreviewPoints, this.pathPreviewEnd);
            }
            
            if (forge.isSelected && this.selectedHeroNames.length > 0) {
                // Draw hero production buttons around the forge
                this.drawHeroButtons(forge, screenPos, this.selectedHeroNames);
            }
        }

        // Draw base structure - use darkened color if should dim
        const tintColor = shouldDim
            ? this.darkenColor(isEnemy ? this.enemyColor : this.playerColor, Constants.SHADE_OPACITY)
            : (isEnemy ? this.enemyColor : this.playerColor);
        const forgeSpritePath = this.getForgeSpritePath(forge);
        const forgeSprite = forgeSpritePath ? this.getTintedSprite(forgeSpritePath, tintColor) : null;
        if (forgeSprite) {
            const spriteSize = size * this.FORGE_SPRITE_SCALE;
            this.ctx.drawImage(
                forgeSprite,
                screenPos.x - spriteSize / 2,
                screenPos.y - spriteSize / 2,
                spriteSize,
                spriteSize
            );

            this.drawForgeFlames(forge, screenPos, spriteSize, game, shouldDim);

            this.ctx.strokeStyle = forge.isReceivingLight
                ? (shouldDim ? this.darkenColor('#00FF00', Constants.SHADE_OPACITY) : '#00FF00')
                : (shouldDim ? this.darkenColor('#FF0000', Constants.SHADE_OPACITY) : '#FF0000');
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, spriteSize * 0.52, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            this.ctx.fillStyle = displayColor;
            this.ctx.strokeStyle = forge.isReceivingLight ? 
                (shouldDim ? this.darkenColor('#00FF00', Constants.SHADE_OPACITY) : '#00FF00') : 
                (shouldDim ? this.darkenColor('#FF0000', Constants.SHADE_OPACITY) : '#FF0000');
            this.ctx.lineWidth = 3;
            
            // Draw as a hexagon with rotation
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i + forge.rotation;
                const x = screenPos.x + size * Math.cos(angle);
                const y = screenPos.y + size * Math.sin(angle);
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.drawHealthDisplay(screenPos, forge.health, this.FORGE_MAX_HEALTH, size, -size - 15);

        if (forge.heroProductionUnitType && forge.heroProductionDurationSec > 0) {
            const barWidth = size * 2;
            const barHeight = 6;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + size + 10;
            const progressPercent = Math.max(
                0,
                Math.min(1, 1 - (forge.heroProductionRemainingSec / forge.heroProductionDurationSec))
            );

            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            this.ctx.fillStyle = '#00FF88';
            this.ctx.fillRect(barX, barY, barWidth * progressPercent, barHeight);
        }
        
        // Draw move order indicator if forge has one
        if (forge.moveOrder > 0 && forge.targetPosition) {
            this.drawMoveOrderIndicator(forge.position, forge.targetPosition, forge.moveOrder, shouldDim ? displayColor : color);
        }
    }

    /**
     * Draw hero production buttons around selected Stellar Forge
     */
    private drawHeroButtons(
        forge: StellarForge,
        screenPos: Vector2D,
        heroNames: string[]
    ): void {
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * this.zoom;
        const buttonDistance = (Constants.HERO_BUTTON_DISTANCE_PX * this.zoom);
        
        // Draw 4 buttons in cardinal directions
        const positions = [
            { x: 0, y: -1 },  // Top
            { x: 1, y: 0 },   // Right
            { x: 0, y: 1 },   // Bottom
            { x: -1, y: 0 }   // Left
        ];
        const displayHeroes = heroNames.slice(0, positions.length);

        for (let i = 0; i < displayHeroes.length; i++) {
            const heroName = displayHeroes[i];
            const pos = positions[i];
            const buttonX = screenPos.x + pos.x * buttonDistance;
            const buttonY = screenPos.y + pos.y * buttonDistance;
            const heroUnitType = this.getHeroUnitType(heroName);
            const isHeroAlive = heroUnitType ? this.isHeroUnitAlive(forge.owner, heroUnitType) : false;
            const isHeroProducing = heroUnitType ? this.isHeroUnitQueuedOrProducing(forge, heroUnitType) : false;
            const isAvailable = heroUnitType ? !isHeroAlive && !isHeroProducing : false;

            // Draw button background
            this.ctx.fillStyle = isAvailable ? 'rgba(0, 255, 136, 0.3)' : 'rgba(128, 128, 128, 0.3)';
            this.ctx.strokeStyle = isAvailable ? '#00FF88' : '#888888';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw button label
            this.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#666666';
            this.ctx.font = `${14 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(heroName, buttonX, buttonY);

            if (isHeroProducing) {
                this.drawHeroHourglass(buttonX, buttonY, buttonRadius);
            } else if (isHeroAlive) {
                this.drawHeroCheckmark(buttonX, buttonY, buttonRadius);
            }
        }
    }

    private getHeroUnitType(heroName: string): string | null {
        switch (heroName) {
            case 'Marine':
            case 'Grave':
            case 'Ray':
            case 'Dagger':
            case 'Beam':
            case 'Driller':
                return heroName;
            case 'Influence Ball':
                return 'InfluenceBall';
            case 'Turret Deployer':
                return 'TurretDeployer';
            default:
                return null;
        }
    }

    private isHeroUnitOfType(unit: Unit, heroUnitType: string): boolean {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof Marine;
            case 'Grave':
                return unit instanceof Grave;
            case 'Ray':
                return unit instanceof Ray;
            case 'InfluenceBall':
                return unit instanceof InfluenceBall;
            case 'TurretDeployer':
                return unit instanceof TurretDeployer;
            case 'Driller':
                return unit instanceof Driller;
            case 'Dagger':
                return unit instanceof Dagger;
            case 'Beam':
                return unit instanceof Beam;
            case 'Mortar':
                return unit instanceof Mortar;
            case 'Preist':
                return unit instanceof Preist;
            default:
                return false;
        }
    }

    private isHeroUnitAlive(player: Player, heroUnitType: string): boolean {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }

    private isHeroUnitQueuedOrProducing(forge: StellarForge, heroUnitType: string): boolean {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }

    private drawHeroHourglass(centerX: number, centerY: number, radius: number): void {
        const iconWidth = radius * 0.7;
        const iconHeight = radius * 0.8;
        const leftX = centerX - iconWidth * 0.5;
        const rightX = centerX + iconWidth * 0.5;
        const topY = centerY - iconHeight * 0.5;
        const bottomY = centerY + iconHeight * 0.5;
        const midY = centerY;

        this.ctx.strokeStyle = '#CCCCCC';
        this.ctx.lineWidth = Math.max(1, 2 * this.zoom);
        this.ctx.beginPath();
        this.ctx.moveTo(leftX, topY);
        this.ctx.lineTo(rightX, topY);
        this.ctx.lineTo(centerX, midY);
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(leftX, bottomY);
        this.ctx.lineTo(rightX, bottomY);
        this.ctx.lineTo(centerX, midY);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    private drawHeroCheckmark(centerX: number, centerY: number, radius: number): void {
        const iconWidth = radius * 0.7;
        const iconHeight = radius * 0.6;
        const startX = centerX - iconWidth * 0.45;
        const startY = centerY + iconHeight * 0.05;
        const midX = centerX - iconWidth * 0.1;
        const midY = centerY + iconHeight * 0.35;
        const endX = centerX + iconWidth * 0.5;
        const endY = centerY - iconHeight * 0.35;

        this.ctx.strokeStyle = '#CCCCCC';
        this.ctx.lineWidth = Math.max(1, 2 * this.zoom);
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(midX, midY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
    }

    /**
     * Draw a Solar Mirror with flat surface, rotation, and proximity-based glow
     */
    private drawSolarMirror(mirror: SolarMirror, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy mirrors
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mirror.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy mirrors
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(mirror.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        const screenPos = this.worldToScreen(mirror.position);
        const size = 14 * this.zoom;

        // Save context state
        this.ctx.save();
        
        // Calculate glow intensity based on distance to closest sun
        // Closer = brighter glow (inverse relationship)
        const glowIntensity = Math.max(0, Math.min(1, 1 - (mirror.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE)));
        
        // Draw glow if close to a light source
        if (glowIntensity > 0.1 && mirror.closestSunDistance !== Infinity) {
            const glowRadius = Constants.MIRROR_ACTIVE_GLOW_RADIUS * this.zoom * (1 + glowIntensity);
            const gradient = this.ctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, glowRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 150, ${glowIntensity * 0.8})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 100, ${glowIntensity * 0.4})`);
            gradient.addColorStop(1, 'rgba(255, 255, 50, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw reflected light beam in front of the mirror
            // Find the closest visible sun to determine reflection direction
            const closestSun = mirror.getClosestVisibleSun(game.suns, game.asteroids);
            if (closestSun) {
                const forge = mirror.owner.stellarForge;
                const linkedStructure = mirror.getLinkedStructure(forge);
                let reflectDir: Vector2D | null = null;

                if (linkedStructure && mirror.hasLineOfSightToStructure(linkedStructure, game.asteroids, game.players)) {
                    reflectDir = new Vector2D(
                        linkedStructure.position.x - mirror.position.x,
                        linkedStructure.position.y - mirror.position.y
                    ).normalize();
                } else {
                    const sunDir = new Vector2D(
                        closestSun.position.x - mirror.position.x,
                        closestSun.position.y - mirror.position.y
                    ).normalize();
                    reflectDir = new Vector2D(-sunDir.x, -sunDir.y);
                }
                
                // Draw reflected light beam (a few feet / ~100 units in front of mirror)
                const beamLength = 100;
                const beamEnd = new Vector2D(
                    mirror.position.x + reflectDir.x * beamLength,
                    mirror.position.y + reflectDir.y * beamLength
                );
                const beamEndScreen = this.worldToScreen(beamEnd);
                
                // Draw bright beam with doubled intensity
                const beamGradient = this.ctx.createLinearGradient(
                    screenPos.x, screenPos.y,
                    beamEndScreen.x, beamEndScreen.y
                );
                beamGradient.addColorStop(0, `rgba(255, 255, 200, ${glowIntensity * 1.0})`);
                beamGradient.addColorStop(0.7, `rgba(255, 255, 150, ${glowIntensity * 0.6})`);
                beamGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
                
                this.ctx.strokeStyle = beamGradient;
                this.ctx.lineWidth = 15 * this.zoom * glowIntensity;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(screenPos.x, screenPos.y);
                this.ctx.lineTo(beamEndScreen.x, beamEndScreen.y);
                this.ctx.stroke();
                
                // Add a bright spot at the end of the beam for doubled brightness effect
                const endGlowRadius = 20 * this.zoom * glowIntensity;
                const endGradient = this.ctx.createRadialGradient(
                    beamEndScreen.x, beamEndScreen.y, 0,
                    beamEndScreen.x, beamEndScreen.y, endGlowRadius
                );
                endGradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity * 0.9})`);
                endGradient.addColorStop(0.5, `rgba(255, 255, 200, ${glowIntensity * 0.5})`);
                endGradient.addColorStop(1, 'rgba(255, 255, 150, 0)');
                
                this.ctx.fillStyle = endGradient;
                this.ctx.beginPath();
                this.ctx.arc(beamEndScreen.x, beamEndScreen.y, endGlowRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Translate to mirror position and rotate for reflection angle
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(mirror.reflectionAngle);

        const surfaceLength = size * 2;
        const surfaceThickness = size * 0.3;
        let selectionWidth = surfaceLength;
        let selectionHeight = surfaceThickness;
        let drewSprite = false;

        const mirrorSpritePath = this.getSolarMirrorSpritePath(mirror);
        if (mirrorSpritePath) {
            // Determine the color for the mirror (use displayColor which already accounts for enemy status and shadow)
            const mirrorColor = this.brightenAndPaleColor(displayColor);
            
            // Use tinted sprite for solar mirror
            const mirrorSprite = this.getTintedSprite(mirrorSpritePath, mirrorColor);
            if (mirrorSprite) {
                const targetSize = size * 2.4;
                const scale = targetSize / Math.max(mirrorSprite.width, mirrorSprite.height);
                const drawWidth = mirrorSprite.width * scale;
                const drawHeight = mirrorSprite.height * scale;
                selectionWidth = drawWidth;
                selectionHeight = drawHeight;
                this.ctx.drawImage(
                    mirrorSprite,
                    -drawWidth / 2,
                    -drawHeight / 2,
                    drawWidth,
                    drawHeight
                );
                drewSprite = true;
            }
        }

        if (!drewSprite) {
            // Draw flat reflective surface (rectangle)
            const surfaceGradient = this.ctx.createLinearGradient(0, -surfaceThickness / 2, 0, surfaceThickness / 2);
            surfaceGradient.addColorStop(0, '#FFFFFF');
            surfaceGradient.addColorStop(0.5, '#E0E0E0');
            surfaceGradient.addColorStop(1, '#C0C0C0');

            this.ctx.fillStyle = surfaceGradient;
            this.ctx.fillRect(-surfaceLength / 2, -surfaceThickness / 2, surfaceLength, surfaceThickness);

            // Draw border for the surface
            this.ctx.strokeStyle = displayColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-surfaceLength / 2, -surfaceThickness / 2, surfaceLength, surfaceThickness);

            // Draw small indicator dots at the ends
            this.ctx.fillStyle = displayColor;
            this.ctx.beginPath();
            this.ctx.arc(-surfaceLength / 2, 0, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(surfaceLength / 2, 0, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        if (mirror.isSelected) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
                -selectionWidth / 2 - 3,
                -selectionHeight / 2 - 3,
                selectionWidth + 6,
                selectionHeight + 6
            );
        }
        
        // Restore context state
        this.ctx.restore();

        // Draw efficiency indicator (in world space, not rotated)
        if (mirror.efficiency < 1.0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw move order indicator if mirror has one
        if (mirror.moveOrder > 0 && mirror.targetPosition) {
            this.drawMoveOrderIndicator(mirror.position, mirror.targetPosition, mirror.moveOrder, color);
        }

        this.drawHealthDisplay(screenPos, mirror.health, this.MIRROR_MAX_HEALTH, size, -size - 10);

        if (mirror.isSelected) {
            const hasLoSToSun = mirror.hasLineOfSightToLight(game.suns, game.asteroids);
            const forge = mirror.owner.stellarForge;
            const linkedStructure = mirror.getLinkedStructure(forge);
            const hasLoSToTarget = linkedStructure
                ? mirror.hasLineOfSightToStructure(linkedStructure, game.asteroids, game.players)
                : false;
            const energyRate = linkedStructure instanceof StellarForge && hasLoSToSun && hasLoSToTarget
                ? mirror.getEnergyRatePerSec()
                : 0;
            const textY = screenPos.y + size + 16 * this.zoom;

            this.ctx.fillStyle = '#FFFFAA';
            this.ctx.font = `${12 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`+${energyRate.toFixed(0)}/s`, screenPos.x, textY);
        }
    }

    /**
     * Draw space dust particle with lightweight circle rendering
     */
    private drawSpaceDust(particle: SpaceDustParticle, game: GameState, viewingPlayerIndex: number | null): void {
        const screenPos = this.worldToScreen(particle.position);
        const baseSize = Constants.DUST_PARTICLE_SIZE * this.zoom;

        // Check if particle is in shadow
        const inShadow = game.isPointInShadow(particle.position);

        if (viewingPlayerIndex !== null) {
            // If particle is in shade, only draw if it's visible to player's units
            if (inShadow) {
                const viewingPlayer = game.players[viewingPlayerIndex];
                const isVisible = game.isObjectVisibleToPlayer(particle.position, viewingPlayer);
                if (!isVisible) {
                    return; // Don't draw particles in shade that aren't in unit sight
                }
            }
        }

        if (game.suns.length > 0) {
            const shadowLineWidth = Math.max(0.4, Constants.DUST_SHADOW_WIDTH_PX * this.zoom);
            this.ctx.strokeStyle = `rgba(0, 0, 20, ${Constants.DUST_SHADOW_OPACITY})`;
            this.ctx.lineWidth = shadowLineWidth;

            for (const sun of game.suns) {
                const dx = particle.position.x - sun.position.x;
                const dy = particle.position.y - sun.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0 && distance < Constants.DUST_SHADOW_MAX_DISTANCE_PX) {
                    const fade = 1.0 - (distance / Constants.DUST_SHADOW_MAX_DISTANCE_PX);
                    const shadowLength = Constants.DUST_SHADOW_LENGTH_PX * fade;
                    if (shadowLength > 0) {
                        const invDistance = 1 / distance;
                        const dirX = dx * invDistance;
                        const dirY = dy * invDistance;
                        const shadowEndX = screenPos.x + dirX * shadowLength * this.zoom;
                        const shadowEndY = screenPos.y + dirY * shadowLength * this.zoom;

                        this.ctx.beginPath();
                        this.ctx.moveTo(screenPos.x, screenPos.y);
                        this.ctx.lineTo(shadowEndX, shadowEndY);
                        this.ctx.stroke();
                    }
                }
            }
        }

        let glowLevel = particle.glowState;
        if (particle.glowTransition > 0 && particle.glowState !== particle.targetGlowState) {
            glowLevel = particle.glowState + (particle.targetGlowState - particle.glowState) * particle.glowTransition;
        }

        if (glowLevel > 0) {
            const glowSize = baseSize * (1.2 + glowLevel * 0.35);
            this.ctx.fillStyle = particle.currentColor;
            this.ctx.globalAlpha = 0.15 + glowLevel * 0.1;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.fillStyle = particle.currentColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, baseSize, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private getClosestInfluenceOwnerIndex(position: Vector2D, game: GameState): number | null {
        let closestDistance = Infinity;
        let closestIndex: number | null = null;

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            if (player.stellarForge && !player.isDefeated()) {
                const distance = position.distanceTo(player.stellarForge.position);
                if (distance < Constants.INFLUENCE_RADIUS && distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            }
        }

        return closestIndex;
    }

    /**
     * Draw an asteroid
     */
    private drawAsteroid(asteroid: Asteroid): void {
        const worldVertices = asteroid.getWorldVertices();
        if (worldVertices.length === 0) return;

        const screenVertices = worldVertices.map(v => this.worldToScreen(v));
        const sizeRange = Constants.ASTEROID_MAX_SIZE - Constants.ASTEROID_MIN_SIZE;
        const sizeT = sizeRange > 0
            ? Math.min(1, Math.max(0, (asteroid.size - Constants.ASTEROID_MIN_SIZE) / sizeRange))
            : 0;
        const asteroidFill = this.interpolateHexColor(
            this.colorScheme.asteroidColors.fillStart,
            this.colorScheme.asteroidColors.fillEnd,
            sizeT
        );
        const asteroidStroke = this.interpolateHexColor(
            this.colorScheme.asteroidColors.strokeStart,
            this.colorScheme.asteroidColors.strokeEnd,
            sizeT
        );

        // Draw asteroid body
        this.ctx.fillStyle = asteroidFill;
        this.ctx.strokeStyle = asteroidStroke;
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            this.ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Draw sun rays with raytracing (brightens field and casts shadows)
     */
    private drawSunRays(game: GameState): void {
        // Check if we have a LaD sun for special rendering
        const ladSun = game.suns.find(s => s.type === 'lad');
        
        if (ladSun) {
            this.drawLadSunRays(game, ladSun);
        } else {
            this.drawNormalSunRays(game);
        }
    }

    private drawNormalSunRays(game: GameState): void {
        // Draw ambient lighting layers for each sun (brighter closer to sun)
        for (const sun of game.suns) {
            const sunScreenPos = this.worldToScreen(sun.position);
            const maxRadius = Math.max(this.canvas.width, this.canvas.height) * 2;
            
            // Create radial gradient centered on the sun
            const gradient = this.ctx.createRadialGradient(
                sunScreenPos.x, sunScreenPos.y, 0,
                sunScreenPos.x, sunScreenPos.y, maxRadius
            );
            
            // Use color scheme for subtle brightness falloff from sun
            gradient.addColorStop(0, this.colorScheme.sunLightRays.nearCenter);     // Brightest near sun
            gradient.addColorStop(0.5, this.colorScheme.sunLightRays.mid);          // Medium
            gradient.addColorStop(1, this.colorScheme.sunLightRays.edge);           // Fade out
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw asteroid shadows cast by sunlight
        // Process each sun separately so overlapping shadows from the same sun don't stack
        for (const sun of game.suns) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = 'rgba(0, 0, 20, 0.5)';

            let hasShadowPath = false;
            this.ctx.beginPath();

            // Draw shadow regions behind asteroids
            for (const asteroid of game.asteroids) {
                const worldVertices = asteroid.getWorldVertices();

                // For each edge of the asteroid, cast a shadow
                for (let i = 0; i < worldVertices.length; i++) {
                    const v1 = worldVertices[i];
                    const v2 = worldVertices[(i + 1) % worldVertices.length];

                    // Calculate if this edge faces away from the sun
                    const edgeCenter = new Vector2D((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
                    const toSun = new Vector2D(sun.position.x - edgeCenter.x, sun.position.y - edgeCenter.y);
                    const edgeNormal = new Vector2D(-(v2.y - v1.y), v2.x - v1.x);
                    const dot = toSun.x * edgeNormal.x + toSun.y * edgeNormal.y;

                    if (dot < 0) {
                        // This edge is facing away from the sun, cast shadow
                        const dirFromSun1 = new Vector2D(v1.x - sun.position.x, v1.y - sun.position.y).normalize();
                        const dirFromSun2 = new Vector2D(v2.x - sun.position.x, v2.y - sun.position.y).normalize();

                        const shadow1 = new Vector2D(v1.x + dirFromSun1.x * Constants.SHADOW_LENGTH, v1.y + dirFromSun1.y * Constants.SHADOW_LENGTH);
                        const shadow2 = new Vector2D(v2.x + dirFromSun2.x * Constants.SHADOW_LENGTH, v2.y + dirFromSun2.y * Constants.SHADOW_LENGTH);

                        const sv1 = this.worldToScreen(v1);
                        const sv2 = this.worldToScreen(v2);
                        const ss1 = this.worldToScreen(shadow1);
                        const ss2 = this.worldToScreen(shadow2);

                        // Add shadow polygon to a single path so overlaps don't darken
                        this.ctx.moveTo(sv1.x, sv1.y);
                        this.ctx.lineTo(sv2.x, sv2.y);
                        this.ctx.lineTo(ss2.x, ss2.y);
                        this.ctx.lineTo(ss1.x, ss1.y);
                        this.ctx.closePath();
                        hasShadowPath = true;
                    }
                }
            }

            if (hasShadowPath) {
                this.ctx.fill();
            }

            this.ctx.restore();
        }
    }

    private drawLadSunRays(game: GameState, sun: Sun): void {
        const sunScreenPos = this.worldToScreen(sun.position);
        
        // Draw left half (white light)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, sunScreenPos.x, this.canvas.height);
        this.ctx.clip();
        
        const whiteGradient = this.ctx.createRadialGradient(
            sunScreenPos.x, sunScreenPos.y, 0,
            sunScreenPos.x, sunScreenPos.y, this.canvas.width
        );
        whiteGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        whiteGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
        whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        
        this.ctx.fillStyle = whiteGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Draw right half (black "light")
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(sunScreenPos.x, 0, this.canvas.width - sunScreenPos.x, this.canvas.height);
        this.ctx.clip();
        
        const blackGradient = this.ctx.createRadialGradient(
            sunScreenPos.x, sunScreenPos.y, 0,
            sunScreenPos.x, sunScreenPos.y, this.canvas.width
        );
        blackGradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        blackGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
        blackGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        
        this.ctx.fillStyle = blackGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Draw asteroid shadows - dark shadows on left (white) side, light shadows on right (dark) side
        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            
            // For each edge of the asteroid, cast a shadow
            for (let i = 0; i < worldVertices.length; i++) {
                const v1 = worldVertices[i];
                const v2 = worldVertices[(i + 1) % worldVertices.length];
                
                // Calculate if this edge faces away from the sun
                const edgeCenter = new Vector2D((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
                const toSun = new Vector2D(sun.position.x - edgeCenter.x, sun.position.y - edgeCenter.y);
                const edgeNormal = new Vector2D(-(v2.y - v1.y), v2.x - v1.x);
                const dot = toSun.x * edgeNormal.x + toSun.y * edgeNormal.y;
                
                if (dot < 0) {
                    // This edge is facing away from the sun, cast shadow
                    const dirFromSun1 = new Vector2D(v1.x - sun.position.x, v1.y - sun.position.y).normalize();
                    const dirFromSun2 = new Vector2D(v2.x - sun.position.x, v2.y - sun.position.y).normalize();
                    
                    const shadow1 = new Vector2D(v1.x + dirFromSun1.x * Constants.SHADOW_LENGTH, v1.y + dirFromSun1.y * Constants.SHADOW_LENGTH);
                    const shadow2 = new Vector2D(v2.x + dirFromSun2.x * Constants.SHADOW_LENGTH, v2.y + dirFromSun2.y * Constants.SHADOW_LENGTH);
                    
                    // Determine which side of the field the shadow is on
                    const shadowCenterX = (shadow1.x + shadow2.x) / 2;
                    const isOnLightSide = shadowCenterX < sun.position.x;
                    
                    const sv1 = this.worldToScreen(v1);
                    const sv2 = this.worldToScreen(v2);
                    const ss1 = this.worldToScreen(shadow1);
                    const ss2 = this.worldToScreen(shadow2);
                    
                    this.ctx.save();
                    // Dark shadows on light side, light shadows on dark side
                    this.ctx.fillStyle = isOnLightSide ? 'rgba(0, 0, 20, 0.5)' : 'rgba(255, 255, 255, 0.3)';
                    this.ctx.beginPath();
                    this.ctx.moveTo(sv1.x, sv1.y);
                    this.ctx.lineTo(sv2.x, sv2.y);
                    this.ctx.lineTo(ss2.x, ss2.y);
                    this.ctx.lineTo(ss1.x, ss1.y);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.restore();
                }
            }
        }
    }

    /**
     * Draw influence circle for a base
     */
    private drawInfluenceCircle(position: Vector2D, radius: number, color: string): void {
        const screenPos = this.worldToScreen(position);
        const screenRadius = radius * this.zoom;

        // Draw outer ring
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a warp gate
     */
    private drawWarpGate(gate: WarpGate): void {
        const screenPos = this.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * this.zoom;
        const chargeProgress = gate.chargeTime / Constants.WARP_GATE_CHARGE_TIME;
        const currentRadius = Math.min(maxRadius, chargeProgress * maxRadius);

        if (!gate.isComplete) {
            // Draw charging effect
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.5 + Math.sin(gate.chargeTime * 5) * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;

            // Draw charge progress
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, currentRadius + 5, 0, chargeProgress * Math.PI * 2);
            this.ctx.stroke();
        } else {
            // Draw completed warp gate
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, maxRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, maxRadius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw 4 build buttons around the gate
            const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.zoom;
            const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.zoom;
            const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
            const labels = ['Cannon', 'Gatling', 'Swirler', 'Foundry'];
            
            for (let i = 0; i < 4; i++) {
                const angle = angles[i];
                const btnX = screenPos.x + Math.cos(angle) * buttonDistance;
                const btnY = screenPos.y + Math.sin(angle) * buttonDistance;
                const labelOffset = buttonRadius + 14 * this.zoom;

                this.ctx.fillStyle = '#444444';
                this.ctx.strokeStyle = '#00FFFF';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(btnX, btnY, buttonRadius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();

                // Draw button label
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${11 * this.zoom}px Doto`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(labels[i], btnX + Math.cos(angle) * labelOffset, btnY + Math.sin(angle) * labelOffset);
            }
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Draw a unit
     */
    private drawUnit(unit: Unit, color: string, game: GameState, isEnemy: boolean, sizeMultiplier: number = 1.0): void {
        const screenPos = this.worldToScreen(unit.position);
        const size = 8 * this.zoom * sizeMultiplier;
        const isSelected = this.selectedUnits.has(unit);

        // Check for LaD mode and adjust colors
        const ladSun = game.suns.find(s => s.type === 'lad');
        let unitColor = color;
        let outlineColor = '#FFFFFF';
        
        if (ladSun && unit.owner) {
            // Determine which side the unit's owner is on
            const ownerSide = unit.owner.stellarForge 
                ? (unit.owner.stellarForge.position.x < ladSun.position.x ? 'light' : 'dark')
                : 'light';
            
            if (ownerSide === 'light') {
                // Light side units: white with black outline
                unitColor = '#FFFFFF';
                outlineColor = '#000000';
            } else {
                // Dark side units: black with white outline
                unitColor = '#000000';
                outlineColor = '#FFFFFF';
            }
        }

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = unitColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(unit.position, this.viewingPlayer, unit);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            // Don't dim in LaD mode as the visibility system is different
            if (!ladSun) {
                const inShadow = game.isPointInShadow(unit.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(unitColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw attack range circle for selected hero units (only friendly units)
        if (isSelected && unit.isHero && !isEnemy) {
            const attackRangeScreenRadius = unit.attackRange * this.zoom;
            this.ctx.strokeStyle = unitColor;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, attackRangeScreenRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw unit body (circle) - use darkened color if should dim
        const heroSpritePath = unit.isHero ? this.getHeroSpritePath(unit) : null;
        const tintColor = shouldDim
            ? this.darkenColor(ladSun ? unitColor : (isEnemy ? this.enemyColor : this.playerColor), Constants.SHADE_OPACITY)
            : (ladSun ? unitColor : (isEnemy ? this.enemyColor : this.playerColor));
        
        // Use outlined sprite for selected units, regular tinted sprite otherwise
        const heroSprite = heroSpritePath 
            ? (isSelected && !isEnemy ? this.getOutlinedTintedSprite(heroSpritePath, tintColor) : this.getTintedSprite(heroSpritePath, tintColor))
            : null;
            
        if (heroSprite) {
            const spriteSize = size * this.HERO_SPRITE_SCALE;
            const rotationRad = unit.rotation;
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(rotationRad);
            this.ctx.drawImage(
                heroSprite,
                -spriteSize / 2,
                -spriteSize / 2,
                spriteSize,
                spriteSize
            );
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = displayColor;
            this.ctx.strokeStyle = isSelected ? outlineColor : (shouldDim ? this.darkenColor(outlineColor, Constants.SHADE_OPACITY) : outlineColor);
            this.ctx.lineWidth = isSelected ? 3 : 2; // Thicker outline for better visibility
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.drawHealthDisplay(screenPos, unit.health, unit.maxHealth, size, -size - 8);

        // Show stun indicator if unit is stunned
        if (unit.isStunned()) {
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.globalAlpha = 0.7;
            const stunSize = 6 * this.zoom;
            
            // Draw stars around unit to indicate stun
            for (let i = 0; i < 3; i++) {
                const angle = (game.gameTime * 3 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
                const x = screenPos.x + Math.cos(angle) * (size * 1.8);
                const y = screenPos.y + Math.sin(angle) * (size * 1.8);
                
                this.ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const starAngle = j * (Math.PI * 2 / 5) - Math.PI / 2;
                    const starX = x + Math.cos(starAngle) * stunSize * 0.5;
                    const starY = y + Math.sin(starAngle) * stunSize * 0.5;
                    if (j === 0) {
                        this.ctx.moveTo(starX, starY);
                    } else {
                        this.ctx.lineTo(starX, starY);
                    }
                }
                this.ctx.closePath();
                this.ctx.fill();
            }
            this.ctx.globalAlpha = 1.0;
        }

        // Draw direction indicator if unit has a target
        if (!unit.isHero && unit.target) {
            const dx = unit.target.position.x - unit.position.x;
            const dy = unit.target.position.y - unit.position.y;
            const angle = Math.atan2(dy, dx);
            
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(
                screenPos.x + Math.cos(angle) * size * 1.5,
                screenPos.y + Math.sin(angle) * size * 1.5
            );
            this.ctx.stroke();
        }
        
        // Draw move order indicator if unit has one
        if (unit.moveOrder > 0 && unit.rallyPoint) {
            this.drawMoveOrderIndicator(unit.position, unit.rallyPoint, unit.moveOrder, shouldDim ? displayColor : color);
        }
    }

    /**
     * Draw move order indicator (dot and line)
     */
    private drawMoveOrderIndicator(position: Vector2D, target: Vector2D, order: number, color: string): void {
        const screenPos = this.worldToScreen(position);
        const targetScreenPos = this.worldToScreen(target);
        
        // Draw thin line from unit to target
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.5;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y);
        this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
        
        // Draw dot with order number at target
        const dotRadius = this.MOVE_ORDER_DOT_RADIUS;
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(targetScreenPos.x, targetScreenPos.y, dotRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw order number
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 12px Doto';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(order.toString(), targetScreenPos.x, targetScreenPos.y);
    }

    /**
     * Draw a muzzle flash
     */
    private drawMuzzleFlash(flash: MuzzleFlash): void {
        const screenPos = this.worldToScreen(flash.position);
        const size = 5 * this.zoom;
        const opacity = 1.0 - (flash.lifetime / flash.maxLifetime);

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(flash.angle);
        
        // Draw flash as a bright yellow oval
        this.ctx.fillStyle = `rgba(255, 255, 100, ${opacity})`;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, size * 2, size, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    /**
     * Draw a bullet casing
     */
    private drawBulletCasing(casing: BulletCasing): void {
        const screenPos = this.worldToScreen(casing.position);
        const width = 3 * this.zoom;
        const height = 5 * this.zoom;
        const opacity = 1.0 - (casing.lifetime / casing.maxLifetime);

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(casing.rotation);
        
        // Draw casing as a yellow rectangle
        this.ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
        this.ctx.fillRect(-width / 2, -height / 2, width, height);
        
        this.ctx.restore();
    }

    /**
     * Draw a bouncing bullet
     */
    private drawBouncingBullet(bullet: BouncingBullet): void {
        const screenPos = this.worldToScreen(bullet.position);
        const size = 3 * this.zoom;
        const opacity = 1.0 - (bullet.lifetime / bullet.maxLifetime);

        // Draw bullet as a yellow circle
        this.ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw an ability bullet
     */
    private drawAbilityBullet(bullet: AbilityBullet): void {
        const screenPos = this.worldToScreen(bullet.position);
        const size = 4 * this.zoom;
        const opacity = bullet.lifetime / bullet.maxLifetime;

        // Draw bullet with owner's faction color
        const color = this.getFactionColor(bullet.owner.faction);
        this.ctx.fillStyle = `${color}`;
        this.ctx.globalAlpha = opacity;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a minion projectile
     */
    private drawMinionProjectile(projectile: MinionProjectile): void {
        const screenPos = this.worldToScreen(projectile.position);
        const size = 2.5 * this.zoom;
        const color = this.getFactionColor(projectile.owner.faction);

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.9;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a mortar projectile (larger, more visible artillery shell)
     */
    private drawMortarProjectile(projectile: any): void {
        const screenPos = this.worldToScreen(projectile.position);
        const size = 6 * this.zoom; // Larger than other projectiles
        const color = this.getFactionColor(projectile.owner.faction);

        // Draw outer glow
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main projectile
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw inner highlight
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x - size * 0.2, screenPos.y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a laser beam
     */
    private drawLaserBeam(laser: LaserBeam): void {
        const startScreen = this.worldToScreen(laser.startPos);
        const endScreen = this.worldToScreen(laser.endPos);
        const color = this.getFactionColor(laser.owner.faction);
        
        // Calculate fade based on lifetime
        const alpha = 1.0 - (laser.lifetime / laser.maxLifetime);
        
        // Draw the main laser beam
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = alpha * 0.8;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw a glowing outer beam
        this.ctx.globalAlpha = alpha * 0.3;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw an impact particle
     */
    private drawImpactParticle(particle: ImpactParticle): void {
        const screenPos = this.worldToScreen(particle.position);
        const color = this.getFactionColor(particle.faction);
        const alpha = 1.0 - (particle.lifetime / particle.maxLifetime);
        const size = 1 * this.zoom;
        
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw an influence zone
     */
    private drawInfluenceZone(zone: InfluenceZone): void {
        const screenPos = this.worldToScreen(zone.position);
        const radius = zone.radius * this.zoom;
        const opacity = Math.max(0.1, 1.0 - (zone.lifetime / zone.duration));
        
        const color = this.getFactionColor(zone.owner.faction);
        
        // Draw outer ring
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = opacity * 0.6;
        this.ctx.lineWidth = 3 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw inner fill
        const gradient = this.ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, radius);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}10`);
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = opacity * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw an influence ball projectile
     */
    private drawInfluenceBallProjectile(projectile: InfluenceBallProjectile): void {
        const screenPos = this.worldToScreen(projectile.position);
        const size = 12 * this.zoom;
        
        const color = this.getFactionColor(projectile.owner.faction);
        
        // Draw glowing ball
        const gradient = this.ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, `${color}AA`);
        gradient.addColorStop(1, `${color}00`);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw inner core
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Draw a crescent wave from Tank hero ability
     */
    private drawCrescentWave(wave: CrescentWave): void {
        const screenPos = this.worldToScreen(wave.position);
        const color = this.getFactionColor(wave.owner.faction);
        
        this.ctx.save();
        
        // Draw wave as an arc segment - match the collision detection size
        const waveRadius = Constants.TANK_WAVE_WIDTH * this.zoom;
        const halfAngle = Constants.TANK_WAVE_ANGLE / 2;
        
        // Create gradient for wave glow
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, waveRadius * 1.5
        );
        gradient.addColorStop(0, `${color}00`);
        gradient.addColorStop(0.5, `${color}88`);
        gradient.addColorStop(1, `${color}00`);
        
        // Draw main wave arc
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = waveRadius * 0.5;
        this.ctx.globalAlpha = 0.7;
        this.ctx.beginPath();
        this.ctx.arc(
            screenPos.x, 
            screenPos.y, 
            waveRadius,
            wave.angle - halfAngle,
            wave.angle + halfAngle
        );
        this.ctx.stroke();
        
        // Draw wave glow effect
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 0.4;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y);
        this.ctx.arc(
            screenPos.x, 
            screenPos.y, 
            waveRadius * 1.5,
            wave.angle - halfAngle,
            wave.angle + halfAngle
        );
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw energy particles along the wave front
        const numParticles = 10;
        for (let i = 0; i < numParticles; i++) {
            const angle = wave.angle - halfAngle + (Constants.TANK_WAVE_ANGLE * i / numParticles);
            const distance = waveRadius * (0.8 + Math.sin(wave.lifetime * 5 + i) * 0.2);
            const particleX = screenPos.x + Math.cos(angle) * distance;
            const particleY = screenPos.y + Math.sin(angle) * distance;
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.8;
            this.ctx.beginPath();
            this.ctx.arc(particleX, particleY, 3 * this.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Draw a deployed turret
     */
    private drawDeployedTurret(turret: DeployedTurret): void {
        const screenPos = this.worldToScreen(turret.position);
        const color = this.getFactionColor(turret.owner.faction);
        
        // Sprite paths for the radiant cannon
        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_bottom.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_top_outline.png';
        
        // Calculate sprite size based on zoom
        const spriteScale = Constants.DEPLOYED_TURRET_SPRITE_SCALE * this.zoom;
        
        // Load and draw bottom sprite (static base)
        const bottomSprite = this.getTintedSprite(bottomSpritePath, color);
        if (bottomSprite) {
            const bottomWidth = bottomSprite.width * spriteScale;
            const bottomHeight = bottomSprite.height * spriteScale;
            
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.drawImage(
                bottomSprite,
                -bottomWidth / 2,
                -bottomHeight / 2,
                bottomWidth,
                bottomHeight
            );
            this.ctx.restore();
        }
        
        // Calculate rotation angle to face target
        let rotationAngle = 0;
        if (turret.target) {
            const dx = turret.target.position.x - turret.position.x;
            const dy = turret.target.position.y - turret.position.y;
            rotationAngle = Math.atan2(dy, dx);
        }
        
        // Select sprite based on firing state
        let topSpriteToUse: HTMLCanvasElement | null = null;
        if (turret.isFiring) {
            // Cycle through animation frames
            const frameIndex = Math.floor(turret.firingAnimationProgress * Constants.DEPLOYED_TURRET_ANIMATION_FRAME_COUNT);
            const clampedFrameIndex = Math.min(frameIndex, Constants.DEPLOYED_TURRET_ANIMATION_FRAME_COUNT - 1);
            const animSpritePath = `ASSETS/sprites/RADIANT/structures/radiantCannonAnimation/radiantCannonFrame (${clampedFrameIndex + 1}).png`;
            topSpriteToUse = this.getTintedSprite(animSpritePath, color);
        } else {
            // Use default top sprite when not firing
            topSpriteToUse = this.getTintedSprite(topSpritePath, color);
        }
        
        // Draw top sprite (rotating barrel)
        if (topSpriteToUse) {
            const topWidth = topSpriteToUse.width * spriteScale;
            const topHeight = topSpriteToUse.height * spriteScale;
            
            // Calculate pivot point: centered horizontally, DEPLOYED_TURRET_PIVOT_FROM_BOTTOM_PX from bottom
            // Convert sprite pixels to normalized coordinates
            const pivotRatio = (Constants.DEPLOYED_TURRET_SPRITE_HEIGHT_PX - Constants.DEPLOYED_TURRET_PIVOT_FROM_BOTTOM_PX) / Constants.DEPLOYED_TURRET_SPRITE_HEIGHT_PX;
            const pivotOffsetY = pivotRatio * topHeight - topHeight / 2;
            
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(rotationAngle + Math.PI / 2); // Add PI/2 because sprite top faces upward
            this.ctx.translate(0, -pivotOffsetY); // Offset for pivot point
            this.ctx.drawImage(
                topSpriteToUse,
                -topWidth / 2,
                -topHeight / 2,
                topWidth,
                topHeight
            );
            this.ctx.restore();
        }
        
        // Draw health bar above the turret
        const displaySize = Constants.DEPLOYED_TURRET_HEALTH_BAR_SIZE * this.zoom;
        this.drawHealthDisplay(screenPos, turret.health, turret.maxHealth, displaySize, -displaySize - 10);
    }

    /**
     * Draw a Grave unit with its orbiting projectiles
     */
    private drawGrave(grave: Grave, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(grave.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(grave.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw the base unit
        this.drawUnit(grave, displayColor, game, isEnemy);
        
        // Draw a distinctive grave symbol
        const screenPos = this.worldToScreen(grave.position);
        const size = 10 * this.zoom;
        
        // Draw cross symbol - darken if needed
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - size);
        this.ctx.lineTo(screenPos.x, screenPos.y + size);
        this.ctx.moveTo(screenPos.x - size * 0.7, screenPos.y - size * 0.3);
        this.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y - size * 0.3);
        this.ctx.stroke();
        
        // Draw projectiles
        for (const projectile of grave.getProjectiles()) {
            this.drawGraveProjectile(projectile, displayColor);
        }
    }

    /**
     * Draw merged attack range outlines for selected starlings
     * Shows the combined outline instead of individual circles
     */
    private drawMergedStarlingRanges(game: GameState): void {
        // Collect all selected friendly starlings
        const selectedStarlings: Starling[] = [];
        for (const unit of this.selectedUnits) {
            if (unit instanceof Starling && this.viewingPlayer && unit.owner === this.viewingPlayer) {
                selectedStarlings.push(unit);
            }
        }

        if (selectedStarlings.length === 0) {
            return;
        }

        const color = this.getFactionColor(this.viewingPlayer!.faction);
        
        // For merged ranges, we draw the outline of all overlapping circles
        // Using a simplified approach: draw arc segments that are on the outer boundary
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
        this.ctx.beginPath();

        for (let i = 0; i < selectedStarlings.length; i++) {
            const starling = selectedStarlings[i];
            if (!this.isWithinViewBounds(starling.position, starling.attackRange)) {
                continue;
            }
            const screenPos = this.worldToScreen(starling.position);
            const radius = starling.attackRange * this.zoom;
            
            // Draw arc segments that don't overlap with other starlings
            const angleStep = Math.PI / 32; // Sample 64 points around circle
            let pathStarted = false;
            
            for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
                const px = starling.position.x + Math.cos(angle) * starling.attackRange;
                const py = starling.position.y + Math.sin(angle) * starling.attackRange;
                
                // Check if this point is outside all other starling ranges
                let isOuterPoint = true;
                for (let j = 0; j < selectedStarlings.length; j++) {
                    if (i === j) continue;
                    const other = selectedStarlings[j];
                    const dx = px - other.position.x;
                    const dy = py - other.position.y;
                    const distSq = dx * dx + dy * dy;
                    const otherRadiusSq = other.attackRange * other.attackRange;
                    
                    if (distSq < otherRadiusSq) {
                        isOuterPoint = false;
                        break;
                    }
                }
                
                const screenX = this.worldToScreen({x: px, y: py} as Vector2D).x;
                const screenY = this.worldToScreen({x: px, y: py} as Vector2D).y;
                
                if (isOuterPoint) {
                    if (!pathStarted) {
                        this.ctx.moveTo(screenX, screenY);
                        pathStarted = true;
                    } else {
                        this.ctx.lineTo(screenX, screenY);
                    }
                } else {
                    pathStarted = false;
                }
            }
        }

        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a Starling unit (minion from stellar forge)
     */
    private drawStarling(starling: Starling, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(starling.position);
        const size = 8 * this.zoom * 0.3; // Minion size (30% of normal unit)
        const isSelected = this.selectedUnits.has(starling);
        
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(starling.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(starling.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Note: Range circles for starlings are drawn separately as merged outlines
        // in drawMergedStarlingRanges() before individual starlings are rendered
        
        // Get starling sprite and color it with player color
        const starlingSpritePath = this.getStarlingSpritePath(starling);
        const tintColor = shouldDim
            ? this.darkenColor(isEnemy ? this.enemyColor : this.playerColor, Constants.SHADE_OPACITY)
            : (isEnemy ? this.enemyColor : this.playerColor);
        
        // Use outlined sprite for selected starlings, regular tinted sprite otherwise
        const starlingSprite = starlingSpritePath 
            ? (isSelected && !isEnemy ? this.getOutlinedTintedSprite(starlingSpritePath, tintColor) : this.getTintedSprite(starlingSpritePath, tintColor))
            : null;
        
        if (starlingSprite) {
            const spriteSize = size * Constants.STARLING_SPRITE_SCALE_FACTOR;
            const rotationRad = this.getStarlingFacingRotationRad(starling);
            if (rotationRad !== null) {
                this.ctx.save();
                this.ctx.translate(screenPos.x, screenPos.y);
                this.ctx.rotate(rotationRad);
                this.ctx.drawImage(
                    starlingSprite,
                    -spriteSize / 2,
                    -spriteSize / 2,
                    spriteSize,
                    spriteSize
                );
                this.ctx.restore();
            } else {
                this.ctx.drawImage(
                    starlingSprite,
                    screenPos.x - spriteSize / 2,
                    screenPos.y - spriteSize / 2,
                    spriteSize,
                    spriteSize
                );
            }
        } else {
            // Fallback to circle rendering if sprite not loaded
            this.ctx.fillStyle = displayColor;
            this.ctx.strokeStyle = isSelected ? '#FFFFFF' : (shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF');
            this.ctx.lineWidth = isSelected ? 3 : 1;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, starling.health, starling.maxHealth, size, -size * 6 - 10);
        
        // Note: Move order lines for starlings are drawn separately in drawStarlingMoveLines()
        // to show only a single line from the closest starling when multiple are selected
    }

    /**
     * Draw move order lines for selected starlings
     * Shows a single line from the closest starling to the destination when multiple are selected
     */
    private drawStarlingMoveLines(game: GameState): void {
        if (!this.viewingPlayer) return;
        
        // Group selected starlings by their rally point (using string key for proper Map comparison)
        const starlingsByRallyPoint = new Map<string, {rallyPoint: Vector2D, starlings: Starling[]}>();
        
        for (const unit of this.selectedUnits) {
            if (unit instanceof Starling && unit.owner === this.viewingPlayer && unit.rallyPoint && unit.moveOrder > 0) {
                const key = `${unit.rallyPoint.x},${unit.rallyPoint.y}`;
                if (!starlingsByRallyPoint.has(key)) {
                    starlingsByRallyPoint.set(key, {rallyPoint: unit.rallyPoint, starlings: []});
                }
                starlingsByRallyPoint.get(key)!.starlings.push(unit);
            }
        }
        
        const color = this.getFactionColor(this.viewingPlayer.faction);
        
        // For each rally point, draw a single line from the closest starling
        for (const [key, group] of starlingsByRallyPoint) {
            if (group.starlings.length === 0) continue;
            
            // Find the closest starling to the rally point
            let closestStarling = group.starlings[0];
            let minDistSq = Infinity;
            
            for (const starling of group.starlings) {
                const dx = group.rallyPoint.x - starling.position.x;
                const dy = group.rallyPoint.y - starling.position.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestStarling = starling;
                }
            }
            
            // Draw move order indicator from the closest starling only
            this.drawMoveOrderIndicator(closestStarling.position, group.rallyPoint, closestStarling.moveOrder, color);
        }
    }

    /**
     * Draw a Ray unit (Solari hero)
     */
    private drawRay(ray: Ray, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ray.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const inShadow = game.isPointInShadow(ray.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw base unit
        this.drawUnit(ray, displayColor, game, isEnemy);
        
        // Draw Ray symbol (lightning bolt)
        const screenPos = this.worldToScreen(ray.position);
        const size = 10 * this.zoom;
        
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - size);
        this.ctx.lineTo(screenPos.x - size * 0.3, screenPos.y);
        this.ctx.lineTo(screenPos.x + size * 0.3, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + size);
        this.ctx.stroke();
        
        // Draw beam segments
        const beamSegments = ray.getBeamSegments();
        for (const segment of beamSegments) {
            const startScreen = this.worldToScreen(segment.startPos);
            const endScreen = this.worldToScreen(segment.endPos);
            
            const opacity = 1.0 - (segment.lifetime / segment.maxLifetime);
            this.ctx.strokeStyle = displayColor;
            this.ctx.globalAlpha = opacity;
            this.ctx.lineWidth = Constants.RAY_BEAM_WIDTH * this.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(startScreen.x, startScreen.y);
            this.ctx.lineTo(endScreen.x, endScreen.y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw an InfluenceBall unit (Solari hero)
     */
    private drawInfluenceBall(ball: InfluenceBall, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ball.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(ball.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw base unit
        this.drawUnit(ball, displayColor, game, isEnemy);
        
        // Draw sphere symbol
        const screenPos = this.worldToScreen(ball.position);
        const size = 12 * this.zoom;
        
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    /**
     * Draw a TurretDeployer unit (Solari hero)
     */
    private drawTurretDeployer(deployer: TurretDeployer, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(deployer.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(deployer.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw base unit
        this.drawUnit(deployer, displayColor, game, isEnemy);
        
        // Draw turret symbol
        const screenPos = this.worldToScreen(deployer.position);
        const size = 10 * this.zoom;
        
        this.ctx.fillStyle = displayColor;
        this.ctx.fillRect(screenPos.x - size * 0.5, screenPos.y - size * 0.3, size, size * 0.6);
        this.ctx.fillRect(screenPos.x - size * 0.2, screenPos.y - size, size * 0.4, size);
    }

    /**
     * Draw a Driller unit (Aurum hero)
     */
    private drawDriller(driller: Driller, color: string, game: GameState, isEnemy: boolean): void {
        // Don't draw if hidden in asteroid
        if (driller.isHiddenInAsteroid()) {
            return;
        }
        
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(driller.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(driller.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw base unit
        this.drawUnit(driller, displayColor, game, isEnemy);
        
        // Draw drill symbol
        const screenPos = this.worldToScreen(driller.position);
        const size = 10 * this.zoom;
        
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 2 * this.zoom;
        
        // Draw drill bit
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x - size, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y - size * 0.5);
        this.ctx.lineTo(screenPos.x + size, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    /**
     * Draw a Dagger hero unit with cloak indicator
     */
    private drawDagger(dagger: Dagger, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(dagger.position, this.viewingPlayer, dagger);
            if (!isVisible) {
                return; // Cloaked Dagger is invisible to enemies
            }
            
            const inShadow = game.isPointInShadow(dagger.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // For friendly units, apply cloak opacity when cloaked
        let isCloakedFriendly = false;
        if (!isEnemy && dagger.isCloakedToEnemies()) {
            isCloakedFriendly = true;
            this.ctx.globalAlpha = Constants.DAGGER_CLOAK_OPACITY;
        }
        
        // Draw base unit
        this.drawUnit(dagger, isCloakedFriendly ? color : displayColor, game, isEnemy);
        
        // Draw cloak indicator (ghostly outline)
        if (isCloakedFriendly) {
            const screenPos = this.worldToScreen(dagger.position);
            const size = 8 * this.zoom;
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5 * this.zoom;
            this.ctx.setLineDash([3 * this.zoom, 3 * this.zoom]); // Dashed line for cloak effect
            
            // Draw outer circle for cloak
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size + 6, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.setLineDash([]); // Reset line dash
        }
        
        // Draw ability indicator when visible (not cloaked)
        if (!dagger.isCloakedToEnemies() && !isEnemy) {
            const screenPos = this.worldToScreen(dagger.position);
            const size = 8 * this.zoom;
            
            // Draw strike symbol (like a blade)
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FF6600', Constants.SHADE_OPACITY) : '#FF6600'; // Orange for strike
            this.ctx.lineWidth = 2 * this.zoom;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x - size * 0.7, screenPos.y - size * 0.7);
            this.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y + size * 0.7);
            this.ctx.stroke();
        }
        
        // Reset alpha
        if (isCloakedFriendly) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Beam hero unit with sniper indicator
     */
    private drawBeam(beam: Beam, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(beam.position, this.viewingPlayer, beam);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const inShadow = game.isPointInShadow(beam.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw base unit
        this.drawUnit(beam, displayColor, game, isEnemy);
        
        // Draw crosshair/sniper scope indicator for friendly units
        if (!isEnemy) {
            const screenPos = this.worldToScreen(beam.position);
            const size = 10 * this.zoom;
            
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FF0000', Constants.SHADE_OPACITY) : '#FF0000'; // Red for sniper
            this.ctx.lineWidth = 1.5 * this.zoom;
            
            // Draw crosshair
            this.ctx.beginPath();
            // Horizontal line
            this.ctx.moveTo(screenPos.x - size, screenPos.y);
            this.ctx.lineTo(screenPos.x + size, screenPos.y);
            // Vertical line
            this.ctx.moveTo(screenPos.x, screenPos.y - size);
            this.ctx.lineTo(screenPos.x, screenPos.y + size);
            this.ctx.stroke();
            
            // Draw small circle in center
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Display damage multiplier if recently fired (show for 2 seconds)
        if (game.gameTime - beam.lastBeamTime < 2.0 && beam.lastBeamMultiplier > 0) {
            const screenPos = this.worldToScreen(beam.position);
            const yOffset = -20 * this.zoom;
            
            // Format multiplier: e.g., "(30x5.5)"
            const baseDamage = Constants.BEAM_ABILITY_BASE_DAMAGE;
            const multiplierText = `(${baseDamage}x${beam.lastBeamMultiplier.toFixed(1)})`;
            
            // Small font for the multiplier
            const fontSize = 10 * this.zoom;
            this.ctx.font = `${fontSize}px Doto`;
            this.ctx.fillStyle = '#FFAA00'; // Orange/yellow
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            
            // Draw with slight fade based on time
            const age = game.gameTime - beam.lastBeamTime;
            const opacity = Math.max(0, 1 - age / 2.0);
            this.ctx.globalAlpha = opacity;
            
            // Add stroke for readability
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(multiplierText, screenPos.x, screenPos.y + yOffset);
            this.ctx.fillText(multiplierText, screenPos.x, screenPos.y + yOffset);
            
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Mortar hero unit with detection cone visualization
     */
    private drawMortar(mortar: any, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mortar.position, this.viewingPlayer, mortar);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const inShadow = game.isPointInShadow(mortar.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }
        
        // Draw detection cone if set up and not enemy
        if (!isEnemy && mortar.isSetup && mortar.facingDirection) {
            const screenPos = this.worldToScreen(mortar.position);
            const facingAngle = Math.atan2(mortar.facingDirection.y, mortar.facingDirection.x);
            const halfConeAngle = Constants.MORTAR_DETECTION_CONE_ANGLE / 2;
            const coneRadius = Constants.MORTAR_ATTACK_RANGE * this.zoom;
            
            // Draw detection cone
            this.ctx.fillStyle = shouldDim ? this.darkenColor(color, Constants.SHADE_OPACITY * 0.5) : color;
            this.ctx.globalAlpha = 0.15;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.arc(
                screenPos.x,
                screenPos.y,
                coneRadius,
                facingAngle - halfConeAngle,
                facingAngle + halfConeAngle
            );
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
            
            // Draw cone outline
            this.ctx.strokeStyle = shouldDim ? this.darkenColor(color, Constants.SHADE_OPACITY) : color;
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.arc(
                screenPos.x,
                screenPos.y,
                coneRadius,
                facingAngle - halfConeAngle,
                facingAngle + halfConeAngle
            );
            this.ctx.lineTo(screenPos.x, screenPos.y);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw base unit
        this.drawUnit(mortar, displayColor, game, isEnemy);
        
        // Draw setup indicator - show artillery barrel/turret for friendly units
        if (!isEnemy && mortar.isSetup && mortar.facingDirection) {
            const screenPos = this.worldToScreen(mortar.position);
            const facingAngle = Math.atan2(mortar.facingDirection.y, mortar.facingDirection.x);
            const barrelLength = 15 * this.zoom;
            
            // Draw barrel
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#888888', Constants.SHADE_OPACITY) : '#888888';
            this.ctx.lineWidth = 4 * this.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(
                screenPos.x + Math.cos(facingAngle) * barrelLength,
                screenPos.y + Math.sin(facingAngle) * barrelLength
            );
            this.ctx.stroke();
        } else if (!isEnemy && !mortar.isSetup) {
            // Show "not set up" indicator
            const screenPos = this.worldToScreen(mortar.position);
            const size = 12 * this.zoom;
            
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFAA00', Constants.SHADE_OPACITY) : '#FFAA00'; // Orange
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.globalAlpha = 0.7;
            
            // Draw exclamation mark
            this.ctx.beginPath();
            // Vertical line
            this.ctx.moveTo(screenPos.x, screenPos.y - size);
            this.ctx.lineTo(screenPos.x, screenPos.y - size * 0.3);
            this.ctx.stroke();
            
            // Dot
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y - size * 0.1, 1.5 * this.zoom, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.globalAlpha = 1.0;
        }
    }

    private drawPreist(preist: Preist, color: string, game: GameState, isEnemy: boolean): void {
        // Draw base unit
        this.drawUnit(preist, color, game, isEnemy);

        // Don't draw healing beams for enemy units (unless you can see them)
        if (isEnemy) {
            return;
        }

        // Draw healing beams to targets
        const beamTargets = preist.getHealingBeamTargets();
        const screenPos = this.worldToScreen(preist.position);
        
        this.ctx.save();
        
        for (const target of beamTargets) {
            if (!target) continue;
            
            const targetScreenPos = this.worldToScreen(target.position);
            
            // Draw healing beam as a pulsing green line
            this.ctx.strokeStyle = '#00FF88';
            this.ctx.lineWidth = 3 * this.zoom;
            this.ctx.globalAlpha = 0.6 + 0.2 * Math.sin(game.gameTime * 5);
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
            this.ctx.stroke();
            
            // Draw particles along the beam
            const numParticles = 5;
            for (let i = 0; i < numParticles; i++) {
                const t = (i / numParticles + game.gameTime * 0.5) % 1.0;
                const particleX = screenPos.x + (targetScreenPos.x - screenPos.x) * t;
                const particleY = screenPos.y + (targetScreenPos.y - screenPos.y) * t;
                
                this.ctx.fillStyle = '#00FF88';
                this.ctx.globalAlpha = 0.8;
                this.ctx.beginPath();
                this.ctx.arc(particleX, particleY, 2 * this.zoom, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Draw healing bomb particles
        const particles = preist.getHealingBombParticles();
        for (const particle of particles) {
            const particleScreenPos = this.worldToScreen(particle.position);
            
            // Draw particle as a glowing green dot
            this.ctx.fillStyle = '#00FF88';
            this.ctx.globalAlpha = 0.8 * (1 - particle.lifetime / particle.maxLifetime);
            this.ctx.beginPath();
            this.ctx.arc(particleScreenPos.x, particleScreenPos.y, 3 * this.zoom, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw glow
            const gradient = this.ctx.createRadialGradient(
                particleScreenPos.x, particleScreenPos.y, 0,
                particleScreenPos.x, particleScreenPos.y, 8 * this.zoom
            );
            gradient.addColorStop(0, 'rgba(0, 255, 136, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = 0.6 * (1 - particle.lifetime / particle.maxLifetime);
            this.ctx.beginPath();
            this.ctx.arc(particleScreenPos.x, particleScreenPos.y, 8 * this.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    private drawTank(tank: Tank, color: string, game: GameState, isEnemy: boolean): void {
        // Draw base unit (includes health bar and stun indicator)
        this.drawUnit(tank, color, game, isEnemy);

        const screenPos = this.worldToScreen(tank.position);
        
        // Draw shield around tank
        this.ctx.save();
        
        // Shield visual - pulsing circular shield
        const shieldRadius = Constants.TANK_SHIELD_RADIUS * this.zoom;
        const pulseAlpha = 0.2 + 0.1 * Math.sin(game.gameTime * 3);
        
        // Shield outer circle
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.globalAlpha = pulseAlpha;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Shield inner glow
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, shieldRadius
        );
        gradient.addColorStop(0, 'rgba(100, 150, 255, 0)');
        gradient.addColorStop(0.7, `rgba(100, 150, 255, ${pulseAlpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 1.0;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    /**
     * Draw a Cannon/Gatling building
     */
    private drawMinigun(building: Minigun | GatlingTower, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#00FF00';
            this.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            
            // Reset alpha
            if (shouldDim) {
                this.ctx.globalAlpha = 1.0;
            }
            return;
        }

        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_bottom.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_top_outline.png';

        const bottomSprite = this.getTintedSprite(bottomSpritePath, displayColor);
        const topSprite = this.getTintedSprite(topSpritePath, displayColor);

        if (bottomSprite && topSprite) {
            const spriteScale = (radius * 2) / bottomSprite.width;
            const bottomWidth = bottomSprite.width * spriteScale;
            const bottomHeight = bottomSprite.height * spriteScale;

            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.drawImage(
                bottomSprite,
                -bottomWidth / 2,
                -bottomHeight / 2,
                bottomWidth,
                bottomHeight
            );
            this.ctx.restore();

            // Draw selection indicator if selected
            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

            let gunAngle = 0;
            if (building.target) {
                const dx = building.target.position.x - building.position.x;
                const dy = building.target.position.y - building.position.y;
                gunAngle = Math.atan2(dy, dx);
            }

            const topWidth = topSprite.width * spriteScale;
            const topHeight = topSprite.height * spriteScale;
            const pivotOffsetFromBottomPx = Constants.DEPLOYED_TURRET_PIVOT_FROM_BOTTOM_PX * spriteScale;
            const pivotY = topHeight / 2 - pivotOffsetFromBottomPx;

            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(gunAngle);
            this.ctx.drawImage(
                topSprite,
                -topWidth / 2,
                -pivotY,
                topWidth,
                topHeight
            );
            this.ctx.restore();
        } else {
            // Draw base (circular platform)
            this.ctx.fillStyle = displayColor;
            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw selection indicator if selected
            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw turret base (smaller circle in center)
            const turretBaseRadius = radius * 0.6;
            this.ctx.fillStyle = shouldDim ? this.darkenColor('#666666', Constants.SHADE_OPACITY) : '#666666';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, turretBaseRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw minigun barrel (pointing toward target if exists)
            let gunAngle = 0;
            if (building.target) {
                const dx = building.target.position.x - building.position.x;
                const dy = building.target.position.y - building.position.y;
                gunAngle = Math.atan2(dy, dx);
            }

            const barrelLength = radius * 1.2;
            const barrelWidth = 4 * this.zoom;

            this.ctx.strokeStyle = shouldDim ? this.darkenColor('#333333', Constants.SHADE_OPACITY) : '#333333';
            this.ctx.lineWidth = barrelWidth;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(
                screenPos.x + Math.cos(gunAngle) * barrelLength,
                screenPos.y + Math.sin(gunAngle) * barrelLength
            );
            this.ctx.stroke();
        }

        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Space Dust Swirler building
     */
    private drawSpaceDustSwirler(building: SpaceDustSwirler, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.ctx.fillStyle = 'rgba(138, 43, 226, 0.2)'; // Purple tint
            this.ctx.strokeStyle = '#8A2BE2';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#8A2BE2';
            this.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            
            // Reset alpha
            if (shouldDim) {
                this.ctx.globalAlpha = 1.0;
            }
            return;
        }

        // Draw influence radius (faint circle) - use current radius for smooth animation
        const influenceRadius = building.currentInfluenceRadius * this.zoom;
        this.ctx.strokeStyle = displayColor;
        this.ctx.globalAlpha = 0.15;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, influenceRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Draw base (circular platform with energy pattern)
        this.ctx.fillStyle = displayColor;
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw selection indicator if selected
        if (building.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, radius);
        }

        // Draw swirl pattern in center (3 curved arcs rotating counter-clockwise)
        const swirlRadius = radius * 0.7;
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#8A2BE2', Constants.SHADE_OPACITY) : '#8A2BE2'; // Purple color for swirl
        this.ctx.lineWidth = 3 * this.zoom;
        this.ctx.lineCap = 'round';
        
        for (let i = 0; i < 3; i++) {
            const angle = (Date.now() / 500 + i * Math.PI * 2 / 3) % (Math.PI * 2); // Rotating animation
            this.ctx.beginPath();
            this.ctx.arc(
                screenPos.x, 
                screenPos.y, 
                swirlRadius, 
                angle, 
                angle + Math.PI / 2
            );
            this.ctx.stroke();
        }

        // Draw central energy core
        const coreRadius = radius * 0.25;
        this.ctx.fillStyle = shouldDim ? this.darkenColor('#DDA0DD', Constants.SHADE_OPACITY) : '#DDA0DD'; // Plum color
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Foundry building
     */
    private drawSubsidiaryFactory(building: SubsidiaryFactory, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'; // Gold tint
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            
            // Reset alpha
            if (shouldDim) {
                this.ctx.globalAlpha = 1.0;
            }
            return;
        }

        // Draw main structure (hexagon shape for industrial look)
        this.ctx.fillStyle = displayColor;
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = screenPos.x + Math.cos(angle) * radius;
            const y = screenPos.y + Math.sin(angle) * radius;
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw selection indicator if selected
        if (building.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, radius);
        }

        // Draw production indicator (rotating inner hexagon)
        const innerRadius = radius * 0.6;
        const rotation = (Date.now() / 1000) % (Math.PI * 2);
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFD700', Constants.SHADE_OPACITY) : '#FFD700'; // Gold color
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + rotation;
            const x = screenPos.x + Math.cos(angle) * innerRadius;
            const y = screenPos.y + Math.sin(angle) * innerRadius;
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.stroke();

        // Draw central core
        const coreRadius = radius * 0.3;
        this.ctx.fillStyle = shouldDim ? this.darkenColor('#FFD700', Constants.SHADE_OPACITY) : '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Grave projectile with trail
     */
    private drawGraveProjectile(projectile: GraveProjectile, color: string): void {
        const screenPos = this.worldToScreen(projectile.position);
        const size = 4 * this.zoom;
        
        // Draw trail if attacking
        if (projectile.isAttacking && projectile.trail.length > 1) {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            
            for (let i = 0; i < projectile.trail.length; i++) {
                const trailPos = this.worldToScreen(projectile.trail[i]);
                if (i === 0) {
                    this.ctx.moveTo(trailPos.x, trailPos.y);
                } else {
                    this.ctx.lineTo(trailPos.x, trailPos.y);
                }
            }
            
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw projectile as a circle
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Add a glow effect when attacking
        if (projectile.isAttacking) {
            this.ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw connection lines with visual indicators for line of sight
     */
    private drawConnections(player: Player, suns: Sun[], asteroids: Asteroid[], players: Player[]): void {
        if (!player.stellarForge) return;
        if (this.viewingPlayer && player !== this.viewingPlayer) return;

        // Draw lines from mirrors to sun and linked structures
        for (const mirror of player.solarMirrors) {
            if (!this.isWithinViewBounds(mirror.position, 120)) {
                continue;
            }
            const mirrorScreenPos = this.worldToScreen(mirror.position);
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
            
            // Check line of sight to sun
            const hasLoSToSun = mirror.hasLineOfSightToLight(suns, asteroids);
            const closestSun = hasLoSToSun
                ? mirror.getClosestVisibleSun(suns, asteroids)
                : mirror.getClosestSun(suns);
            
            // Check line of sight to linked structure
            const hasLoSToTarget = linkedStructure
                ? mirror.hasLineOfSightToStructure(linkedStructure, asteroids, players)
                : false;
            
            // Draw line to sun only when blocked
            if (closestSun && !hasLoSToSun) {
                const sunScreenPos = this.worldToScreen(closestSun.position);
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                this.ctx.lineTo(sunScreenPos.x, sunScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Draw line to structure only when blocked
            if (linkedStructure && !hasLoSToTarget) {
                const targetScreenPos = this.worldToScreen(linkedStructure.position);
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Draw combined status indicator on the mirror
            if (hasLoSToSun && hasLoSToTarget) {
                // Both clear - draw bright yellow glow
                this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(mirrorScreenPos.x, mirrorScreenPos.y, Constants.MIRROR_ACTIVE_GLOW_RADIUS * this.zoom, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Draw UI overlay
     */
    private drawUI(game: GameState): void {
        // Only show info if showInfo is true
        if (this.showInfo) {
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = this.canvas.width / dpr;
            const screenHeight = this.canvas.height / dpr;
            const isCompactLayout = screenWidth < 600;
            const infoFontSize = isCompactLayout ? 13 : 16;
            const infoLineHeight = infoFontSize + 4;
            const infoBoxWidth = Math.min(300, screenWidth - 20);
            const infoBoxHeight = 20 + infoLineHeight * 5 + game.players.length * 60;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(10, 10, infoBoxWidth, infoBoxHeight);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${infoFontSize}px Doto`;
            let infoY = 30;
            this.ctx.fillText(`SoL - Speed of Light RTS`, 20, infoY);
            infoY += infoLineHeight;
            this.ctx.fillText(`Game Time: ${game.gameTime.toFixed(1)}s`, 20, infoY);
            infoY += infoLineHeight;
            this.ctx.fillText(`Dust Particles: ${game.spaceDust.length}`, 20, infoY);
            infoY += infoLineHeight;
            this.ctx.fillText(`Asteroids: ${game.asteroids.length}`, 20, infoY);
            infoY += infoLineHeight;
            this.ctx.fillText(`Warp Gates: ${game.warpGates.length}`, 20, infoY);

            let y = infoY + infoLineHeight;
            for (const player of game.players) {
                const color = this.getFactionColor(player.faction);
                this.ctx.fillStyle = color;
                this.ctx.fillText(`${player.name} (${player.faction})`, 20, y);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillText(`Energy: ${player.energy.toFixed(1)}`, 20, y + 20);
                
                if (player.stellarForge) {
                    const status = player.stellarForge.isReceivingLight ? '✓ Light' : '✗ No Light';
                    this.ctx.fillText(`${status} | HP: ${player.stellarForge.health.toFixed(0)}`, 20, y + 40);
                }
                
                y += 60;
            }

            // Draw controls help
            const controlLines = isCompactLayout
                ? GameRenderer.CONTROL_LINES_COMPACT
                : GameRenderer.CONTROL_LINES_FULL;
            const controlFontSize = isCompactLayout ? 12 : 14;
            const controlLineHeight = controlFontSize + 4;
            const controlBoxWidth = Math.min(450, screenWidth - 20);
            const controlBoxHeight = controlLineHeight * controlLines.length + 14;
            const controlBoxX = 10;
            const controlBoxY = screenHeight - controlBoxHeight - 10;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(controlBoxX, controlBoxY, controlBoxWidth, controlBoxHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${controlFontSize}px Doto`;
            let controlTextY = controlBoxY + controlLineHeight;
            for (const line of controlLines) {
                this.ctx.fillText(line, 20, controlTextY);
                controlTextY += controlLineHeight;
            }
        }
    }

    /**
     * Draw selection rectangle
     */
    private drawSelectionRectangle(): void {
        if (!this.selectionStart || !this.selectionEnd) return;

        const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

        // Draw selection rectangle
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw filled background
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.setLineDash([]);
    }

    /**
     * Draw ability arrow for hero units
     */
    private drawAbilityArrow(): void {
        if (!this.abilityArrowEnd || this.abilityArrowStarts.length === 0) return;

        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)'; // Gold color for hero abilities
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        for (const abilityArrowStart of this.abilityArrowStarts) {
            const dx = this.abilityArrowEnd.x - abilityArrowStart.x;
            const dy = this.abilityArrowEnd.y - abilityArrowStart.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            // Don't draw if arrow is too short
            if (length < Constants.ABILITY_ARROW_MIN_LENGTH) {
                continue;
            }

            // Draw arrow shaft
            this.ctx.beginPath();
            this.ctx.moveTo(abilityArrowStart.x, abilityArrowStart.y);
            this.ctx.lineTo(this.abilityArrowEnd.x, this.abilityArrowEnd.y);
            this.ctx.stroke();

            // Draw arrowhead
            const angle = Math.atan2(dy, dx);
            const arrowHeadLength = 20;
            const arrowHeadAngle = Math.PI / 6; // 30 degrees

            this.ctx.beginPath();
            this.ctx.moveTo(this.abilityArrowEnd.x, this.abilityArrowEnd.y);
            this.ctx.lineTo(
                this.abilityArrowEnd.x - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
                this.abilityArrowEnd.y - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
            );
            this.ctx.lineTo(
                this.abilityArrowEnd.x - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
                this.abilityArrowEnd.y - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
            );
            this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
            this.ctx.fill();

            // Draw a circle at the start point
            this.ctx.beginPath();
            this.ctx.arc(abilityArrowStart.x, abilityArrowStart.y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
            this.ctx.fill();
        }
    }

    /**
     * Draw a path preview for selected units (not from base)
     */
    private drawUnitPathPreview(): void {
        // Only draw if we have path points and no forge (meaning it's a unit path, not a base path)
        if (!this.pathPreviewForge && this.pathPreviewPoints.length > 0) {
            // Get the average position of selected units as the start point
            let avgX = 0;
            let avgY = 0;
            let count = 0;
            
            for (const unit of this.selectedUnits) {
                avgX += unit.position.x;
                avgY += unit.position.y;
                count++;
            }
            
            if (count > 0) {
                const startWorld = new Vector2D(avgX / count, avgY / count);
                this.drawMinionPathPreview(startWorld, this.pathPreviewPoints, this.pathPreviewEnd);
            }
        }
    }

    /**
     * Draw a path preview while the player is actively drawing a minion route.
     */
    private drawMinionPathPreview(startWorld: Vector2D, waypoints: Vector2D[], endWorld: Vector2D | null): void {
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();

        const startScreen = this.worldToScreen(startWorld);
        this.ctx.moveTo(startScreen.x, startScreen.y);

        for (let i = 0; i < waypoints.length; i++) {
            const waypointScreen = this.worldToScreen(waypoints[i]);
            this.ctx.lineTo(waypointScreen.x, waypointScreen.y);
        }

        if (endWorld) {
            const endScreen = this.worldToScreen(endWorld);
            this.ctx.lineTo(endScreen.x, endScreen.y);
        }

        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        for (let i = 0; i < waypoints.length; i++) {
            const waypointScreen = this.worldToScreen(waypoints[i]);
            this.ctx.beginPath();
            this.ctx.arc(waypointScreen.x, waypointScreen.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        if (endWorld) {
            const endScreen = this.worldToScreen(endWorld);
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(endScreen.x, endScreen.y, 6, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    /**
     * Create a tap visual effect at screen position
     */
    createTapEffect(screenX: number, screenY: number): void {
        this.tapEffects.push({
            position: new Vector2D(screenX, screenY),
            progress: 0
        });
    }

    /**
     * Create a swipe visual effect from start to end screen positions
     */
    createSwipeEffect(startX: number, startY: number, endX: number, endY: number): void {
        this.swipeEffects.push({
            start: new Vector2D(startX, startY),
            end: new Vector2D(endX, endY),
            progress: 0
        });
    }

    /**
     * Create a warp gate shockwave effect at a world position
     */
    createWarpGateShockwave(position: Vector2D): void {
        this.warpGateShockwaves.push({
            position: new Vector2D(position.x, position.y),
            progress: 0
        });
    }

    /**
     * Create a production button wave effect at a world position
     */
    createProductionButtonWave(position: Vector2D): void {
        this.productionButtonWaves.push({
            position: new Vector2D(position.x, position.y),
            progress: 0
        });
    }

    /**
     * Update and draw tap effects (expanding ripple)
     */
    private updateAndDrawTapEffects(): void {
        // Update and draw each tap effect
        for (let i = this.tapEffects.length - 1; i >= 0; i--) {
            const effect = this.tapEffects[i];
            effect.progress += Constants.TAP_EFFECT_SPEED; // Increment progress (0 to 1)

            if (effect.progress >= 1) {
                // Remove completed effects
                this.tapEffects.splice(i, 1);
                continue;
            }

            // Draw expanding ripple
            const radius = Constants.TAP_EFFECT_MAX_RADIUS * effect.progress;
            const alpha = 1 - effect.progress; // Fade out

            this.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw inner glow
            const gradient = this.ctx.createRadialGradient(
                effect.position.x, effect.position.y, 0,
                effect.position.x, effect.position.y, radius * 0.5
            );
            gradient.addColorStop(0, `rgba(100, 200, 255, ${alpha * 0.5})`);
            gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(effect.position.x, effect.position.y, radius * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Update and draw swipe effects (directional trail)
     */
    private updateAndDrawSwipeEffects(): void {
        // Update and draw each swipe effect
        for (let i = this.swipeEffects.length - 1; i >= 0; i--) {
            const effect = this.swipeEffects[i];
            effect.progress += Constants.SWIPE_EFFECT_SPEED; // Increment progress (0 to 1)

            if (effect.progress >= 1) {
                // Remove completed effects
                this.swipeEffects.splice(i, 1);
                continue;
            }

            // Calculate direction and length
            const dx = effect.end.x - effect.start.x;
            const dy = effect.end.y - effect.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length < 5) continue; // Skip very short swipes

            // Draw arrow trail
            const alpha = 1 - effect.progress;
            const currentLength = length * effect.progress;
            
            // Draw line
            this.ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.7})`;
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(effect.start.x, effect.start.y);
            const endX = effect.start.x + (dx / length) * currentLength;
            const endY = effect.start.y + (dy / length) * currentLength;
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();

            // Draw arrow head at the end
            if (effect.progress > 0.3) {
                const angle = Math.atan2(dy, dx);
                
                this.ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.moveTo(endX, endY);
                this.ctx.lineTo(
                    endX - Constants.SWIPE_ARROW_SIZE * Math.cos(angle - Math.PI / 6),
                    endY - Constants.SWIPE_ARROW_SIZE * Math.sin(angle - Math.PI / 6)
                );
                this.ctx.lineTo(
                    endX - Constants.SWIPE_ARROW_SIZE * Math.cos(angle + Math.PI / 6),
                    endY - Constants.SWIPE_ARROW_SIZE * Math.sin(angle + Math.PI / 6)
                );
                this.ctx.closePath();
                this.ctx.fill();
            }

            // Draw glow trail
            for (let j = 0; j < 5; j++) {
                const t = j / 5;
                const px = effect.start.x + (dx / length) * currentLength * t;
                const py = effect.start.y + (dy / length) * currentLength * t;
                const glowAlpha = alpha * (1 - t) * 0.3;
                
                const gradient = this.ctx.createRadialGradient(px, py, 0, px, py, 10);
                gradient.addColorStop(0, `rgba(255, 200, 100, ${glowAlpha})`);
                gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 10, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Update and draw warp gate shockwave effects
     */
    private updateAndDrawWarpGateShockwaves(): void {
        for (let i = this.warpGateShockwaves.length - 1; i >= 0; i--) {
            const effect = this.warpGateShockwaves[i];
            effect.progress += Constants.WARP_GATE_SHOCKWAVE_PROGRESS_PER_FRAME;

            if (effect.progress >= 1) {
                this.warpGateShockwaves.splice(i, 1);
                continue;
            }

            const screenPos = this.worldToScreen(effect.position);
            const radius = Constants.WARP_GATE_SHOCKWAVE_MAX_RADIUS_PX * effect.progress * this.zoom;
            const alpha = (1 - effect.progress) * 0.8;

            this.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            this.ctx.lineWidth = Math.max(2, 3 * this.zoom);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    /**
     * Update and draw production button wave effects
     */
    private updateAndDrawProductionButtonWaves(): void {
        for (let i = this.productionButtonWaves.length - 1; i >= 0; i--) {
            const effect = this.productionButtonWaves[i];
            effect.progress += Constants.PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME;

            if (effect.progress >= 1) {
                this.productionButtonWaves.splice(i, 1);
                continue;
            }

            const screenPos = this.worldToScreen(effect.position);
            const radius = Constants.PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX * effect.progress * this.zoom;
            const alpha = (1 - effect.progress) * 0.9;

            this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
            this.ctx.lineWidth = Math.max(1, 2 * this.zoom);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            const gradient = this.ctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, radius
            );
            gradient.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.35})`);
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw damage numbers floating up from damaged units
     */
    private drawDamageNumbers(game: GameState): void {
        for (const damageNumber of game.damageNumbers) {
            const screenPos = this.worldToScreen(damageNumber.position);
            const opacity = damageNumber.getOpacity(game.gameTime);
            
            // Determine what to display based on mode
            const displayValue = this.damageDisplayMode === 'remaining-life' 
                ? damageNumber.remainingHealth 
                : damageNumber.damage;
            
            // Calculate size based on damage proportion to max health
            // Range: 8px (small) to 24px (large)
            const damageRatio = damageNumber.damage / damageNumber.maxHealth;
            const fontSize = Math.max(8, Math.min(24, 8 + damageRatio * 80));
            
            this.ctx.font = `bold ${fontSize}px Doto`;
            
            // For remaining life mode, color based on health percentage
            if (this.damageDisplayMode === 'remaining-life') {
                const healthPercent = damageNumber.remainingHealth / damageNumber.maxHealth;
                const color = this.getHealthColor(healthPercent);
                this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
            } else {
                // Damage numbers are red
                this.ctx.fillStyle = `rgba(255, 100, 100, ${opacity})`;
            }
            
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add stroke for readability
            this.ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.8})`;
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(displayValue.toString(), screenPos.x, screenPos.y);
            this.ctx.fillText(displayValue.toString(), screenPos.x, screenPos.y);
        }
    }

    /**
     * Get health color based on percentage (green -> yellow -> red)
     */
    private getHealthColor(healthPercent: number): { r: number; g: number; b: number } {
        if (healthPercent > 0.6) {
            // Green zone: interpolate from green (0, 255, 0) to yellow (255, 255, 0)
            const t = (healthPercent - 0.6) / 0.4; // 0 at 60%, 1 at 100%
            return {
                r: Math.round(255 * (1 - t)),
                g: 255,
                b: 0
            };
        } else if (healthPercent > 0.3) {
            // Yellow zone: interpolate from orange-red (255, 165, 0) to yellow (255, 255, 0)
            const t = (healthPercent - 0.3) / 0.3; // 0 at 30%, 1 at 60%
            return {
                r: 255,
                g: Math.round(165 + 90 * t),
                b: 0
            };
        } else {
            // Red zone: interpolate from dark red (180, 0, 0) to orange-red (255, 165, 0)
            const t = healthPercent / 0.3; // 0 at 0%, 1 at 30%
            return {
                r: Math.round(180 + 75 * t),
                g: Math.round(165 * t),
                b: 0
            };
        }
    }

    /**
     * Draw health display (bar or number) for an entity
     */
    private drawHealthDisplay(
        screenPos: { x: number; y: number },
        currentHealth: number,
        maxHealth: number,
        size: number,
        yOffset: number
    ): void {
        if (currentHealth >= maxHealth) {
            return; // Don't draw if at full health
        }

        const healthPercent = currentHealth / maxHealth;

        if (this.healthDisplayMode === 'bar') {
            // Draw health bar
            const barWidth = size * 3;
            const barHeight = 3;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + yOffset;
            
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        } else {
            // Draw health number
            const healthColor = this.getHealthColor(healthPercent);
            const fontSize = Math.max(10, size * 1.5);
            
            this.ctx.font = `bold ${fontSize}px Doto`;
            this.ctx.fillStyle = `rgb(${healthColor.r}, ${healthColor.g}, ${healthColor.b})`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            
            // Add stroke for readability
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(Math.round(currentHealth).toString(), screenPos.x, screenPos.y + yOffset);
            this.ctx.fillText(Math.round(currentHealth).toString(), screenPos.x, screenPos.y + yOffset);
        }
    }

    /**
     * Render the entire game state
     */
    render(game: GameState): void {
        // Clear canvas with color scheme background
        this.ctx.fillStyle = this.colorScheme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateViewBounds();

        // Draw parallax star layers
        for (const layer of this.starLayers) {
            this.ctx.fillStyle = '#FFFFFF';
            const dpr = window.devicePixelRatio || 1;
            
            for (const star of layer.stars) {
                // Calculate star position with parallax effect
                const parallaxX = this.parallaxCamera.x * layer.parallaxFactor;
                const parallaxY = this.parallaxCamera.y * layer.parallaxFactor;
                
                // Convert to screen space
                const centerX = (this.canvas.width / dpr) / 2;
                const centerY = (this.canvas.height / dpr) / 2;
                const screenX = centerX + (star.x - parallaxX);
                const screenY = centerY + (star.y - parallaxY);
                
                // Wrap stars around screen edges for infinite scrolling effect
                const wrappedX = ((screenX + centerX) % (centerX * 2 + Constants.STAR_WRAP_SIZE)) - centerX;
                const wrappedY = ((screenY + centerY) % (centerY * 2 + Constants.STAR_WRAP_SIZE)) - centerY;
                
                // Only draw if on screen
                if (wrappedX >= -100 && wrappedX <= this.canvas.width / dpr + 100 &&
                    wrappedY >= -100 && wrappedY <= this.canvas.height / dpr + 100) {
                    this.ctx.globalAlpha = star.brightness;
                    this.ctx.fillRect(wrappedX, wrappedY, star.size, star.size);
                }
            }
            this.ctx.globalAlpha = 1.0;
        }

        const viewingPlayerIndex = this.viewingPlayer ? game.players.indexOf(this.viewingPlayer) : null;

        // Draw space dust particles (with culling)
        for (const particle of game.spaceDust) {
            // Only render particles within map boundaries
            if (this.isWithinRenderBounds(particle.position, game.mapSize, 10) &&
                this.isWithinViewBounds(particle.position, 60)) {
                this.drawSpaceDust(particle, game, viewingPlayerIndex);
            }
        }

        // Draw suns
        for (const sun of game.suns) {
            if (this.isWithinViewBounds(sun.position, sun.radius * 2)) {
                this.drawSun(sun);
            }
        }

        // Draw sun rays with raytracing (light and shadows)
        this.drawSunRays(game);

        // Draw lens flare effects for visible suns
        for (const sun of game.suns) {
            this.drawLensFlare(sun);
        }

        // Draw asteroids (with culling - skip rendering beyond map bounds)
        for (const asteroid of game.asteroids) {
            // Only render asteroids within map boundaries
            if (this.isWithinRenderBounds(asteroid.position, game.mapSize, asteroid.size) &&
                this.isWithinViewBounds(asteroid.position, asteroid.size * 2)) {
                this.drawAsteroid(asteroid);
            }
        }

        // Draw influence circles (with proper handling of overlaps)
        const influenceCircles: Array<{position: Vector2D, radius: number, color: string}> = [];
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            if (viewingPlayerIndex !== null && i !== viewingPlayerIndex) {
                continue;
            }
            if (player.stellarForge && !player.isDefeated()) {
                const color = i === 0 ? this.playerColor : this.enemyColor;
                influenceCircles.push({
                    position: player.stellarForge.position,
                    radius: Constants.INFLUENCE_RADIUS,
                    color: color
                });
            }
        }
        
        // Draw influence circles grouped by color to handle overlaps
        const circlesByColor = new Map<string, Array<{position: Vector2D, radius: number}>>();
        for (const circle of influenceCircles) {
            if (!circlesByColor.has(circle.color)) {
                circlesByColor.set(circle.color, []);
            }
            circlesByColor.get(circle.color)!.push({position: circle.position, radius: circle.radius});
        }
        
        // Draw each color group
        for (const [color, circles] of circlesByColor) {
            if (circles.length === 1) {
                // Single circle, draw normally
                if (this.isWithinViewBounds(circles[0].position, circles[0].radius)) {
                    this.drawInfluenceCircle(circles[0].position, circles[0].radius, color);
                }
            } else {
                // Multiple circles of same color
                // To get union effect, we'll use a temporary canvas
                this.ctx.save();
                
                // Create path with all circles
                this.ctx.beginPath();
                for (const circle of circles) {
                    if (!this.isWithinViewBounds(circle.position, circle.radius)) {
                        continue;
                    }
                    const screenPos = this.worldToScreen(circle.position);
                    const screenRadius = circle.radius * this.zoom;
                    this.ctx.moveTo(screenPos.x + screenRadius, screenPos.y);
                    this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
                }
                
                // Fill with transparent color first to create union
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.fillStyle = color;
                this.ctx.globalAlpha = 0.05;
                this.ctx.fill();
                
                // Now stroke the outer boundary
                // This approach still shows inner boundaries, so let's just draw each circle
                this.ctx.globalAlpha = 0.3;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                this.ctx.restore();
            }
        }

        // Draw connections first (so they appear behind structures)
        for (const player of game.players) {
            if (!player.isDefeated()) {
                this.drawConnections(player, game.suns, game.asteroids, game.players);
            }
        }

        // Draw structures
        for (const player of game.players) {
            if (player.isDefeated()) continue;

            const color = this.getFactionColor(player.faction);
            const isEnemy = this.viewingPlayer !== null && player !== this.viewingPlayer;

            // Draw Solar Mirrors (including enemy mirrors with visibility checks)
            for (const mirror of player.solarMirrors) {
                if (this.isWithinViewBounds(mirror.position, 120)) {
                    this.drawSolarMirror(mirror, color, game, isEnemy);
                }
            }

            // Draw Stellar Forge
            if (player.stellarForge) {
                if (this.isWithinViewBounds(player.stellarForge.position, player.stellarForge.radius * 3)) {
                    this.drawStellarForge(player.stellarForge, color, game, isEnemy);
                }
            }
        }

        // Draw warp gates
        for (const gate of game.warpGates) {
            if (this.isWithinViewBounds(gate.position, Constants.WARP_GATE_RADIUS * 2)) {
                this.drawWarpGate(gate);
            }
        }

        // Draw warp gate shockwaves
        this.updateAndDrawWarpGateShockwaves();

        // Draw merged range outlines for selected starlings before drawing units
        this.drawMergedStarlingRanges(game);

        // Draw units
        for (const player of game.players) {
            if (player.isDefeated()) continue;
            
            const color = this.getFactionColor(player.faction);
            const isEnemy = this.viewingPlayer !== null && player !== this.viewingPlayer;
            
            for (const unit of player.units) {
                const unitMargin = unit.isHero ? 120 : 60;
                if (!this.isWithinViewBounds(unit.position, unitMargin)) {
                    continue;
                }
                if (unit instanceof Grave) {
                    this.drawGrave(unit, color, game, isEnemy);
                } else if (unit instanceof Starling) {
                    this.drawStarling(unit, color, game, isEnemy);
                } else if (unit instanceof Ray) {
                    this.drawRay(unit, color, game, isEnemy);
                } else if (unit instanceof InfluenceBall) {
                    this.drawInfluenceBall(unit, color, game, isEnemy);
                } else if (unit instanceof TurretDeployer) {
                    this.drawTurretDeployer(unit, color, game, isEnemy);
                } else if (unit instanceof Driller) {
                    this.drawDriller(unit, color, game, isEnemy);
                } else if (unit instanceof Dagger) {
                    this.drawDagger(unit, color, game, isEnemy);
                } else if (unit instanceof Beam) {
                    this.drawBeam(unit, color, game, isEnemy);
                } else if (unit instanceof Mortar) {
                    this.drawMortar(unit, color, game, isEnemy);
                } else if (unit instanceof Preist) {
                    this.drawPreist(unit, color, game, isEnemy);
                } else if (unit instanceof Tank) {
                    this.drawTank(unit, color, game, isEnemy);
                } else {
                    this.drawUnit(unit, color, game, isEnemy);
                }
            }
        }

        // Draw move order lines for selected starlings (single line per group)
        this.drawStarlingMoveLines(game);

        // Draw buildings
        for (const player of game.players) {
            if (player.isDefeated()) continue;
            
            const color = this.getFactionColor(player.faction);
            const isEnemy = this.viewingPlayer !== null && player !== this.viewingPlayer;
            
            for (const building of player.buildings) {
                if (!this.isWithinViewBounds(building.position, building.radius * 2)) {
                    continue;
                }
                if (building instanceof Minigun || building instanceof GatlingTower) {
                    this.drawMinigun(building, color, game, isEnemy);
                } else if (building instanceof SpaceDustSwirler) {
                    this.drawSpaceDustSwirler(building, color, game, isEnemy);
                } else if (building instanceof SubsidiaryFactory) {
                    this.drawSubsidiaryFactory(building, color, game, isEnemy);
                }
            }
        }

        // Draw muzzle flashes
        for (const flash of game.muzzleFlashes) {
            if (this.isWithinViewBounds(flash.position, 80)) {
                this.drawMuzzleFlash(flash);
            }
        }

        // Draw bullet casings
        for (const casing of game.bulletCasings) {
            if (this.isWithinViewBounds(casing.position, 60)) {
                this.drawBulletCasing(casing);
            }
        }

        // Draw bouncing bullets
        for (const bullet of game.bouncingBullets) {
            if (this.isWithinViewBounds(bullet.position, 60)) {
                this.drawBouncingBullet(bullet);
            }
        }

        // Draw ability bullets
        for (const bullet of game.abilityBullets) {
            if (this.isWithinViewBounds(bullet.position, 80)) {
                this.drawAbilityBullet(bullet);
            }
        }

        // Draw minion projectiles
        for (const projectile of game.minionProjectiles) {
            if (this.isWithinViewBounds(projectile.position, 80)) {
                this.drawMinionProjectile(projectile);
            }
        }
        
        // Draw mortar projectiles
        for (const projectile of game.mortarProjectiles) {
            if (this.isWithinViewBounds(projectile.position, 100)) {
                this.drawMortarProjectile(projectile);
            }
        }
        
        // Draw laser beams
        for (const laser of game.laserBeams) {
            if (this.isWithinViewBounds(laser.startPos, 200) || this.isWithinViewBounds(laser.endPos, 200)) {
                this.drawLaserBeam(laser);
            }
        }
        
        // Draw impact particles (only on high graphics quality)
        if (this.graphicsQuality === 'high') {
            for (const particle of game.impactParticles) {
                if (this.isWithinViewBounds(particle.position, 120)) {
                    this.drawImpactParticle(particle);
                }
            }
        }
        
        // Draw influence zones
        for (const zone of game.influenceZones) {
            if (this.isWithinViewBounds(zone.position, zone.radius)) {
                this.drawInfluenceZone(zone);
            }
        }
        
        // Draw influence ball projectiles
        for (const projectile of game.influenceBallProjectiles) {
            if (this.isWithinViewBounds(projectile.position, 100)) {
                this.drawInfluenceBallProjectile(projectile);
            }
        }
        
        // Draw crescent waves
        for (const wave of game.crescentWaves) {
            if (this.isWithinViewBounds(wave.position, Constants.TANK_WAVE_WIDTH * 2)) {
                this.drawCrescentWave(wave);
            }
        }
        
        // Draw deployed turrets
        for (const turret of game.deployedTurrets) {
            if (this.isWithinViewBounds(turret.position, Constants.DEPLOYED_TURRET_HEALTH_BAR_SIZE * 2)) {
                this.drawDeployedTurret(turret);
            }
        }

        // Draw damage numbers
        this.drawDamageNumbers(game);

        // Draw border fade to black effect
        this.drawBorderFade(game.mapSize);

        // Draw UI
        this.drawUI(game);

        // Draw selection rectangle
        this.drawSelectionRectangle();

        // Draw ability arrow for hero units
        this.drawAbilityArrow();

        // Draw unit path preview
        this.drawUnitPathPreview();

        // Draw tap and swipe visual effects
        this.updateAndDrawProductionButtonWaves();
        this.updateAndDrawTapEffects();
        this.updateAndDrawSwipeEffects();

        // Check for victory
        const winner = game.checkVictoryConditions();
        if (winner) {
            this.drawEndGameStatsScreen(game, winner);
        }

        // Draw countdown overlay
        if (game.isCountdownActive) {
            // Semi-transparent overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Countdown text
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 120px Doto';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const countdownValue = Math.ceil(game.countdownTime);
            const displayText = countdownValue > 0 ? countdownValue.toString() : 'Go!';
            
            this.ctx.fillText(displayText, this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
        
        // Draw in-game menu button (top-left, always visible when not in countdown)
        if (!game.isCountdownActive && !winner) {
            this.drawMenuButton();
        }
        
        // Draw production progress indicator (top-right)
        if (!game.isCountdownActive && !winner) {
            this.drawProductionProgress(game);
        }
        
        // Draw in-game menu overlay if open
        if (this.showInGameMenu && !winner) {
            this.drawInGameMenuOverlay();
        }
    }

    /**
     * Draw in-game menu button in top-left corner
     */
    private drawMenuButton(): void {
        const dpr = window.devicePixelRatio || 1;
        const buttonSize = 50;
        const margin = 10;
        
        // Draw button background
        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        this.ctx.fillRect(margin, margin, buttonSize, buttonSize);
        
        // Draw border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(margin, margin, buttonSize, buttonSize);
        
        // Draw hamburger icon (three horizontal lines)
        this.ctx.fillStyle = '#FFFFFF';
        const lineWidth = 30;
        const lineHeight = 3;
        const lineSpacing = 8;
        const startX = margin + (buttonSize - lineWidth) / 2;
        const startY = margin + (buttonSize - lineHeight * 3 - lineSpacing * 2) / 2;
        
        this.ctx.fillRect(startX, startY, lineWidth, lineHeight);
        this.ctx.fillRect(startX, startY + lineHeight + lineSpacing, lineWidth, lineHeight);
        this.ctx.fillRect(startX, startY + (lineHeight + lineSpacing) * 2, lineWidth, lineHeight);
    }

    /**
     * Draw production progress indicator in top-right corner
     */
    private drawProductionProgress(game: GameState): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const margin = 10;
        const boxWidth = 200;
        const boxHeight = 60;
        const x = screenWidth - boxWidth - margin;
        let y = margin;
        
        // Check for player's production
        const player = game.players.find((p) => !p.isAi);
        if (!player) {
            return;
        }
        
        // Draw hero production from stellar forge
        if (player.stellarForge && player.stellarForge.heroProductionUnitType) {
            const forge = player.stellarForge;
            
            // Draw background box
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(x, y, boxWidth, boxHeight);
            
            // Draw border
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, boxWidth, boxHeight);
            
            // Draw production name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            const productionName = this.getProductionDisplayName(forge.heroProductionUnitType!);
            this.ctx.fillText(productionName, x + 8, y + 8);
            
            // Calculate progress (guard against division by zero)
            const progress = forge.heroProductionDurationSec > 0 
                ? 1 - (forge.heroProductionRemainingSec / forge.heroProductionDurationSec)
                : 0;
            
            // Draw progress bar
            this.drawProgressBar(x + 8, y + 32, boxWidth - 16, 16, progress);
            
            y += boxHeight + 8;
        }
        
        // Draw building construction progress
        // Note: find() stops at first match, typically only one building under construction
        const buildingInProgress = player.buildings.find((building) => !building.isComplete);
        if (buildingInProgress) {
            // Draw background box
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(x, y, boxWidth, boxHeight);
            
            // Draw border
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, boxWidth, boxHeight);
            
            // Draw building name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            const buildingName = this.getBuildingDisplayName(buildingInProgress);
            this.ctx.fillText(`Building ${buildingName}`, x + 8, y + 8);
            
            // Draw progress bar
            this.drawProgressBar(x + 8, y + 32, boxWidth - 16, 16, buildingInProgress.buildProgress);
        }
        
        // Reset text alignment
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
    }
    
    /**
     * Draw a progress bar
     */
    private drawProgressBar(x: number, y: number, width: number, height: number, progress: number): void {
        // Draw progress bar background
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        this.ctx.fillRect(x, y, width, height);
        
        // Draw progress bar fill
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(x, y, width * progress, height);
        
        // Draw progress bar border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw progress percentage
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 12px Doto';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${Math.floor(progress * 100)}%`, x + width / 2, y + height / 2);
    }
    
    /**
     * Get display name for building type
     */
    private getBuildingDisplayName(building: Building): string {
        if (building instanceof GatlingTower) {
            return 'Gatling Tower';
        } else if (building instanceof Minigun) {
            return 'Cannon';
        } else if (building instanceof SpaceDustSwirler) {
            return 'Space Dust Swirler';
        } else if (building instanceof SubsidiaryFactory) {
            return 'Foundry';
        }
        return 'Building';
    }
    
    /**
     * Get display name for production unit type
     */
    private getProductionDisplayName(unitType: string): string {
        const nameMap: { [key: string]: string } = {
            'marine': 'Marine',
            'grave': 'Grave',
            'ray': 'Ray',
            'influenceball': 'Influence Ball',
            'turretdeployer': 'Turret Deployer',
            'driller': 'Driller',
            'dagger': 'Dagger',
            'beam': 'Beam'
        };
        return nameMap[unitType.toLowerCase()] || unitType;
    }

    private getInGameMenuLayout(): InGameMenuLayout {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        const isCompactLayout = screenWidth < 600;
        const panelWidth = Math.min(480, screenWidth - 40);
        const panelHeight = Math.min(460, screenHeight - 40);
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;
        const panelPaddingX = isCompactLayout ? 14 : 20;
        const panelPaddingY = isCompactLayout ? 16 : 20;
        const titleY = panelY + (isCompactLayout ? 34 : 42);
        const tabHeight = isCompactLayout ? 30 : 34;
        const tabGap = 12;
        const tabWidth = (panelWidth - panelPaddingX * 2 - tabGap * 2) / 3;
        const tabY = titleY + (isCompactLayout ? 16 : 18);
        const tabX = panelX + panelPaddingX;
        const tabs: InGameMenuLayout['tabs'] = [
            { tab: 'main', x: tabX, y: tabY, width: tabWidth, height: tabHeight },
            { tab: 'options', x: tabX + tabWidth + tabGap, y: tabY, width: tabWidth, height: tabHeight },
            { tab: 'graphics', x: tabX + (tabWidth + tabGap) * 2, y: tabY, width: tabWidth, height: tabHeight }
        ];
        const contentTopY = tabY + tabHeight + (isCompactLayout ? 16 : 20);
        const contentBottomY = panelY + panelHeight - panelPaddingY;
        const buttonWidth = Math.min(300, panelWidth - panelPaddingX * 2);
        const buttonHeight = isCompactLayout ? 44 : 50;
        const buttonX = panelX + (panelWidth - buttonWidth) / 2;
        const buttonSpacing = isCompactLayout ? 14 : 20;
        const graphicsListX = panelX + panelPaddingX;
        const graphicsListY = contentTopY;
        const graphicsListWidth = panelWidth - panelPaddingX * 2;
        const graphicsListHeight = Math.max(0, contentBottomY - contentTopY);
        const graphicsRowHeight = isCompactLayout ? 44 : 48;
        const graphicsButtonWidth = isCompactLayout ? 54 : 60;
        const graphicsButtonHeight = isCompactLayout ? 26 : 30;
        const graphicsButtonGap = 8;

        return {
            screenWidth,
            screenHeight,
            panelX,
            panelY,
            panelWidth,
            panelHeight,
            isCompactLayout,
            titleY,
            tabs,
            contentTopY,
            contentBottomY,
            buttonWidth,
            buttonHeight,
            buttonX,
            buttonSpacing,
            graphicsListX,
            graphicsListY,
            graphicsListWidth,
            graphicsListHeight,
            graphicsRowHeight,
            graphicsButtonWidth,
            graphicsButtonHeight,
            graphicsButtonGap
        };
    }

    private getGraphicsMenuMaxScroll(layout: InGameMenuLayout): number {
        const contentHeight = this.graphicsOptions.length * layout.graphicsRowHeight;
        return Math.max(0, contentHeight - layout.graphicsListHeight);
    }

    public handleInGameMenuScroll(screenX: number, screenY: number, deltaY: number): boolean {
        if (!this.showInGameMenu || this.inGameMenuTab !== 'graphics') {
            return false;
        }
        const layout = this.getInGameMenuLayout();
        const isWithinList =
            screenX >= layout.graphicsListX &&
            screenX <= layout.graphicsListX + layout.graphicsListWidth &&
            screenY >= layout.graphicsListY &&
            screenY <= layout.graphicsListY + layout.graphicsListHeight;
        if (!isWithinList) {
            return false;
        }
        const maxScroll = this.getGraphicsMenuMaxScroll(layout);
        if (maxScroll === 0) {
            return true;
        }
        this.graphicsMenuScrollOffset = Math.min(
            maxScroll,
            Math.max(0, this.graphicsMenuScrollOffset + deltaY)
        );
        return true;
    }

    public getInGameMenuAction(screenX: number, screenY: number): InGameMenuAction | null {
        if (!this.showInGameMenu) {
            return null;
        }
        const layout = this.getInGameMenuLayout();
        for (const tab of layout.tabs) {
            const isWithinTab =
                screenX >= tab.x &&
                screenX <= tab.x + tab.width &&
                screenY >= tab.y &&
                screenY <= tab.y + tab.height;
            if (isWithinTab) {
                return { type: 'tab', tab: tab.tab };
            }
        }

        if (this.inGameMenuTab === 'main') {
            let buttonY = layout.contentTopY;
            const buttons: Array<{ action: InGameMenuAction }> = [
                { action: { type: 'resume' } },
                { action: { type: 'toggleInfo' } },
                { action: { type: 'surrender' } }
            ];
            for (const button of buttons) {
                const isWithinButton =
                    screenX >= layout.buttonX &&
                    screenX <= layout.buttonX + layout.buttonWidth &&
                    screenY >= buttonY &&
                    screenY <= buttonY + layout.buttonHeight;
                if (isWithinButton) {
                    return button.action;
                }
                buttonY += layout.buttonHeight + layout.buttonSpacing;
            }
            return null;
        }

        if (this.inGameMenuTab === 'options') {
            let optionY = layout.contentTopY;
            const optionHeight = layout.buttonHeight;
            const optionSpacing = layout.buttonSpacing;
            const optionX = layout.buttonX;
            const optionWidth = layout.buttonWidth;
            const buttonWidth = optionWidth * 0.35;
            const buttonGap = 10;

            // Damage Display Mode buttons
            const damageButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const damageButton2X = optionX + optionWidth - buttonWidth;
            
            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= damageButton1X && screenX <= damageButton1X + buttonWidth) {
                    return { type: 'damageDisplayMode', mode: 'damage' };
                }
                if (screenX >= damageButton2X && screenX <= damageButton2X + buttonWidth) {
                    return { type: 'damageDisplayMode', mode: 'remaining-life' };
                }
            }
            
            optionY += optionHeight + optionSpacing;

            // Health Display Mode buttons
            const healthButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const healthButton2X = optionX + optionWidth - buttonWidth;
            
            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= healthButton1X && screenX <= healthButton1X + buttonWidth) {
                    return { type: 'healthDisplayMode', mode: 'bar' };
                }
                if (screenX >= healthButton2X && screenX <= healthButton2X + buttonWidth) {
                    return { type: 'healthDisplayMode', mode: 'number' };
                }
            }
            
            return null;
        }

        const isWithinList =
            screenX >= layout.graphicsListX &&
            screenX <= layout.graphicsListX + layout.graphicsListWidth &&
            screenY >= layout.graphicsListY &&
            screenY <= layout.graphicsListY + layout.graphicsListHeight;
        if (!isWithinList) {
            return null;
        }

        const contentHeight = this.graphicsOptions.length * layout.graphicsRowHeight;
        const localY = screenY - layout.graphicsListY + this.graphicsMenuScrollOffset;
        if (localY < 0 || localY > contentHeight) {
            return null;
        }
        const rowIndex = Math.floor(localY / layout.graphicsRowHeight);
        const option = this.graphicsOptions[rowIndex];
        if (!option) {
            return null;
        }

        const buttonAreaWidth = layout.graphicsButtonWidth * 3 + layout.graphicsButtonGap * 2;
        const buttonStartX = layout.graphicsListX + layout.graphicsListWidth - buttonAreaWidth - 8;
        const rowY = layout.graphicsListY + rowIndex * layout.graphicsRowHeight - this.graphicsMenuScrollOffset;
        const buttonY = rowY + (layout.graphicsRowHeight - layout.graphicsButtonHeight) / 2;
        const variants: GraphicVariant[] = ['svg', 'png', 'stub'];
        for (let i = 0; i < variants.length; i += 1) {
            const buttonX = buttonStartX + i * (layout.graphicsButtonWidth + layout.graphicsButtonGap);
            const isWithinButton =
                screenX >= buttonX &&
                screenX <= buttonX + layout.graphicsButtonWidth &&
                screenY >= buttonY &&
                screenY <= buttonY + layout.graphicsButtonHeight;
            if (isWithinButton) {
                return { type: 'graphicsVariant', key: option.key, variant: variants[i] };
            }
        }

        return null;
    }

    /**
     * Draw in-game menu overlay
     */
    private drawInGameMenuOverlay(): void {
        const layout = this.getInGameMenuLayout();
        const screenWidth = layout.screenWidth;
        const screenHeight = layout.screenHeight;
        const isCompactLayout = layout.isCompactLayout;
        
        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // Menu panel
        const panelWidth = layout.panelWidth;
        const panelHeight = layout.panelHeight;
        const panelX = layout.panelX;
        const panelY = layout.panelY;

        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `bold ${isCompactLayout ? 22 : 30}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME MENU', screenWidth / 2, layout.titleY);

        for (const tab of layout.tabs) {
            const isActive = this.inGameMenuTab === tab.tab;
            this.ctx.fillStyle = isActive ? 'rgba(255, 215, 0, 0.3)' : 'rgba(60, 60, 60, 0.9)';
            this.ctx.fillRect(tab.x, tab.y, tab.width, tab.height);
            this.ctx.strokeStyle = isActive ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(tab.x, tab.y, tab.width, tab.height);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            const tabLabel = tab.tab === 'main' ? 'Main' : tab.tab === 'options' ? 'Options' : 'Graphics';
            this.ctx.fillText(tabLabel, tab.x + tab.width / 2, tab.y + tab.height * 0.68);
        }

        if (this.inGameMenuTab === 'main') {
            // Menu buttons
            let buttonY = layout.contentTopY;
            const buttonWidth = layout.buttonWidth;
            const buttonHeight = layout.buttonHeight;
            const buttonX = layout.buttonX;
            const buttonSpacing = layout.buttonSpacing;

            // Helper function to draw a button
            const drawButton = (label: string, y: number) => {
                this.ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
                this.ctx.fillRect(buttonX, y, buttonWidth, buttonHeight);
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(buttonX, y, buttonWidth, buttonHeight);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${isCompactLayout ? 18 : 20}px Doto`;
                this.ctx.fillText(label, screenWidth / 2, y + (buttonHeight * 0.65));
            };

            drawButton('Resume', buttonY);
            buttonY += buttonHeight + buttonSpacing;
            drawButton(this.showInfo ? 'Hide Info' : 'Show Info', buttonY);
            buttonY += buttonHeight + buttonSpacing;
            drawButton('Surrender', buttonY);
        } else if (this.inGameMenuTab === 'options') {
            // Options tab content
            let optionY = layout.contentTopY;
            const optionHeight = layout.buttonHeight;
            const optionSpacing = layout.buttonSpacing;
            const optionX = layout.buttonX;
            const optionWidth = layout.buttonWidth;

            // Helper function to draw an option toggle
            const drawOptionToggle = (label: string, y: number, isActive: boolean) => {
                // Draw label
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${isCompactLayout ? 16 : 18}px Doto`;
                this.ctx.textAlign = 'left';
                this.ctx.fillText(label, optionX, y + (optionHeight * 0.4));
                
                // Draw toggle buttons
                const buttonWidth = optionWidth * 0.35;
                const buttonGap = 10;
                const button1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
                const button2X = optionX + optionWidth - buttonWidth;
                
                return { button1X, button2X, buttonWidth };
            };

            // Damage Display Mode option
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Damage Display:', optionX, optionY + (optionHeight * 0.4));
            
            const damageButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };
            
            // Damage button
            const isDamageMode = this.damageDisplayMode === 'damage';
            this.ctx.fillStyle = isDamageMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(damageButtons.button1X, optionY, damageButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isDamageMode ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(damageButtons.button1X, optionY, damageButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Dmg #', damageButtons.button1X + damageButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));
            
            // Remaining Life button
            const isRemainingMode = this.damageDisplayMode === 'remaining-life';
            this.ctx.fillStyle = isRemainingMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(damageButtons.button2X, optionY, damageButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isRemainingMode ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(damageButtons.button2X, optionY, damageButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('HP Left', damageButtons.button2X + damageButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));
            
            optionY += optionHeight + optionSpacing;

            // Health Display Mode option
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Health Display:', optionX, optionY + (optionHeight * 0.4));
            
            const healthButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };
            
            // Bar button
            const isBarMode = this.healthDisplayMode === 'bar';
            this.ctx.fillStyle = isBarMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(healthButtons.button1X, optionY, healthButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isBarMode ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(healthButtons.button1X, optionY, healthButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Bar', healthButtons.button1X + healthButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));
            
            // Number button
            const isNumberMode = this.healthDisplayMode === 'number';
            this.ctx.fillStyle = isNumberMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(healthButtons.button2X, optionY, healthButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isNumberMode ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(healthButtons.button2X, optionY, healthButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Number', healthButtons.button2X + healthButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));
        } else {
            const maxScroll = this.getGraphicsMenuMaxScroll(layout);
            if (this.graphicsMenuScrollOffset > maxScroll) {
                this.graphicsMenuScrollOffset = maxScroll;
            }
            this.ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
            this.ctx.fillRect(
                layout.graphicsListX,
                layout.graphicsListY,
                layout.graphicsListWidth,
                layout.graphicsListHeight
            );
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(
                layout.graphicsListX,
                layout.graphicsListY,
                layout.graphicsListWidth,
                layout.graphicsListHeight
            );
            this.ctx.clip();

            const labelX = layout.graphicsListX + 8;
            const buttonAreaWidth = layout.graphicsButtonWidth * 3 + layout.graphicsButtonGap * 2;
            const buttonStartX = layout.graphicsListX + layout.graphicsListWidth - buttonAreaWidth - 8;
            const variants: Array<{ variant: GraphicVariant; label: string }> = [
                { variant: 'svg', label: 'SVG' },
                { variant: 'png', label: 'PNG' },
                { variant: 'stub', label: 'Stub' }
            ];

            for (let i = 0; i < this.graphicsOptions.length; i += 1) {
                const option = this.graphicsOptions[i];
                const rowY = layout.graphicsListY + i * layout.graphicsRowHeight - this.graphicsMenuScrollOffset;
                if (rowY + layout.graphicsRowHeight < layout.graphicsListY || rowY > layout.graphicsListY + layout.graphicsListHeight) {
                    continue;
                }
                this.ctx.fillStyle = i % 2 === 0 ? 'rgba(40, 40, 40, 0.6)' : 'rgba(55, 55, 55, 0.6)';
                this.ctx.fillRect(layout.graphicsListX, rowY, layout.graphicsListWidth, layout.graphicsRowHeight);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${isCompactLayout ? 13 : 15}px Doto`;
                this.ctx.textAlign = 'left';
                this.ctx.fillText(option.label, labelX, rowY + layout.graphicsRowHeight * 0.65);

                const selectedVariant = this.getGraphicVariant(option.key);
                const buttonY = rowY + (layout.graphicsRowHeight - layout.graphicsButtonHeight) / 2;
                for (let j = 0; j < variants.length; j += 1) {
                    const variant = variants[j];
                    const buttonX = buttonStartX + j * (layout.graphicsButtonWidth + layout.graphicsButtonGap);
                    const isSelected = selectedVariant === variant.variant;
                    const isAvailable =
                        variant.variant === 'stub' ||
                        (variant.variant === 'svg' && option.svgPath) ||
                        (variant.variant === 'png' && option.pngPath);
                    this.ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
                    if (!isAvailable) {
                        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
                    }
                    this.ctx.fillRect(buttonX, buttonY, layout.graphicsButtonWidth, layout.graphicsButtonHeight);
                    this.ctx.strokeStyle = isSelected ? '#FFD700' : '#FFFFFF';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.strokeRect(buttonX, buttonY, layout.graphicsButtonWidth, layout.graphicsButtonHeight);
                    this.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#888888';
                    this.ctx.font = `${isCompactLayout ? 11 : 12}px Doto`;
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(
                        variant.label,
                        buttonX + layout.graphicsButtonWidth / 2,
                        buttonY + layout.graphicsButtonHeight * 0.68
                    );
                }
            }

            this.ctx.restore();
        }

        this.ctx.textAlign = 'left';
    }

    /**
     * Draw end-game statistics screen
     */
    private drawEndGameStatsScreen(game: GameState, winner: Player): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        const isCompactLayout = screenWidth < 700;
        
        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // Victory message
        this.ctx.fillStyle = this.getFactionColor(winner.faction);
        const victoryFontSize = Math.max(28, Math.min(48, screenWidth * 0.12));
        this.ctx.font = `bold ${victoryFontSize}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${winner.name} WINS!`, screenWidth / 2, 80);
        
        // Stats panel
        const panelWidth = Math.min(700, screenWidth - 40);
        const panelHeight = Math.min(450, screenHeight - 200);
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = 130;
        
        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Match statistics title
        this.ctx.fillStyle = '#FFD700';
        const statsTitleSize = Math.max(18, Math.min(28, screenWidth * 0.07));
        this.ctx.font = `bold ${statsTitleSize}px Doto`;
        this.ctx.fillText('MATCH STATISTICS', screenWidth / 2, panelY + 50);
        
        // Draw stats for each player
        const statsFontSize = Math.max(14, Math.min(20, screenWidth * 0.045));
        this.ctx.font = `${statsFontSize}px Doto`;
        let y = panelY + 100;
        const horizontalPadding = 24;
        const labelColumnWidth = Math.max(100, Math.min(200, panelWidth * 0.4));
        const playerCount = game.players.length;
        const availablePlayerWidth = panelWidth - horizontalPadding * 2 - labelColumnWidth;
        const playerColumnWidth = Math.max(50, availablePlayerWidth / playerCount);
        const leftCol = panelX + horizontalPadding;
        const playerStartX = leftCol + labelColumnWidth;
        
        // Headers
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Statistic', leftCol, y);
        this.ctx.textAlign = 'right';
        
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const color = this.getFactionColor(player.faction);
            this.ctx.fillStyle = color;
            const colX = playerStartX + playerColumnWidth * (i + 1);
            this.ctx.fillText(player.name, colX, y);
        }
        
        y += isCompactLayout ? 32 : 40;
        
        // Stat rows
        const stats = [
            { label: 'Units Created', key: 'unitsCreated' },
            { label: 'Units Lost', key: 'unitsLost' },
            { label: 'Energy Gathered', key: 'energyGathered' }
        ];
        
        for (const stat of stats) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(stat.label, leftCol, y);
            this.ctx.textAlign = 'right';
            
            for (let i = 0; i < game.players.length; i++) {
                const player = game.players[i] as any;
                const value = stat.key === 'energy' ? player[stat.key].toFixed(1) : player[stat.key];
                const colX = playerStartX + playerColumnWidth * (i + 1);
                this.ctx.fillText(String(value), colX, y);
            }
            
            y += isCompactLayout ? 28 : 35;
        }
        
        // Continue button
        const buttonWidth = Math.min(300, screenWidth - 60);
        const buttonHeight = isCompactLayout ? 50 : 60;
        const buttonX = (screenWidth - buttonWidth) / 2;
        const buttonY = Math.min(panelY + panelHeight + 30, screenHeight - buttonHeight - 20);
        
        this.ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `bold ${isCompactLayout ? 20 : 24}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Continue', screenWidth / 2, buttonY + (buttonHeight * 0.65));
        
        this.ctx.textAlign = 'left';
    }

    /**
     * Draw border fade effect - fades to black at map edges
     */
    private drawBorderFade(mapSize: number): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        
        // Define fade zone width in world units
        const fadeZoneWidth = 150;
        
        // Calculate map boundaries in world coordinates
        const halfMapSize = mapSize / 2;
        
        // Convert map edges to screen coordinates
        const topLeft = this.worldToScreen(new Vector2D(-halfMapSize, -halfMapSize));
        const topRight = this.worldToScreen(new Vector2D(halfMapSize, -halfMapSize));
        const bottomLeft = this.worldToScreen(new Vector2D(-halfMapSize, halfMapSize));
        
        // Calculate fade start positions (inside the map boundary) in screen space
        const fadeStartLeft = this.worldToScreen(new Vector2D(-halfMapSize + fadeZoneWidth, 0));
        const fadeStartRight = this.worldToScreen(new Vector2D(halfMapSize - fadeZoneWidth, 0));
        const fadeStartTop = this.worldToScreen(new Vector2D(0, -halfMapSize + fadeZoneWidth));
        const fadeStartBottom = this.worldToScreen(new Vector2D(0, halfMapSize - fadeZoneWidth));
        
        const fadeWidthX = Math.abs(fadeStartLeft.x - topLeft.x);
        const fadeWidthY = Math.abs(fadeStartTop.y - topLeft.y);
        
        // Save context state
        this.ctx.save();
        
        // Left edge fade
        if (topLeft.x < screenWidth) {
            const gradient = this.ctx.createLinearGradient(topLeft.x, 0, topLeft.x + fadeWidthX, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, topLeft.x + fadeWidthX, screenHeight);
        }
        
        // Right edge fade
        if (topRight.x > 0) {
            const gradient = this.ctx.createLinearGradient(topRight.x, 0, topRight.x - fadeWidthX, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(topRight.x - fadeWidthX, 0, screenWidth - (topRight.x - fadeWidthX), screenHeight);
        }
        
        // Top edge fade
        if (topLeft.y < screenHeight) {
            const gradient = this.ctx.createLinearGradient(0, topLeft.y, 0, topLeft.y + fadeWidthY);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, screenWidth, topLeft.y + fadeWidthY);
        }
        
        // Bottom edge fade
        if (bottomLeft.y > 0) {
            const gradient = this.ctx.createLinearGradient(0, bottomLeft.y, 0, bottomLeft.y - fadeWidthY);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, bottomLeft.y - fadeWidthY, screenWidth, screenHeight - (bottomLeft.y - fadeWidthY));
        }
        
        // Restore context state
        this.ctx.restore();
    }

    /**
     * Set camera zoom
     */
    setZoom(zoom: number): void {
        this.zoom = Math.max(0.5, Math.min(2.0, zoom));
    }

    /**
     * Set camera position
     */
    setCameraPosition(pos: Vector2D): void {
        // Clamp camera position to level boundaries
        const clampedPos = this.clampCameraToLevelBounds(pos);
        this.camera = new Vector2D(clampedPos.x, clampedPos.y);
        this.parallaxCamera = new Vector2D(clampedPos.x, clampedPos.y);
    }

    setCameraPositionWithoutParallax(pos: Vector2D): void {
        // Clamp camera position to level boundaries
        const clampedPos = this.clampCameraToLevelBounds(pos);
        this.camera = new Vector2D(clampedPos.x, clampedPos.y);
    }

    /**
     * Clamp camera position to level boundaries
     */
    private clampCameraToLevelBounds(pos: Vector2D): Vector2D {
        // Get device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        
        // Calculate visible world dimensions based on canvas size and zoom
        const viewWidth = (this.canvas.width / dpr) / this.zoom;
        const viewHeight = (this.canvas.height / dpr) / this.zoom;
        
        // Calculate max camera offset based on map size and view size
        // The camera can move such that the view edges align with map boundaries
        const halfMapSize = Constants.MAP_SIZE / 2;
        const maxX = halfMapSize - viewWidth / 2;
        const maxY = halfMapSize - viewHeight / 2;
        const minX = -maxX;
        const minY = -maxY;
        
        // Clamp camera position
        const clampedX = Math.max(minX, Math.min(maxX, pos.x));
        const clampedY = Math.max(minY, Math.min(maxY, pos.y));
        
        return new Vector2D(clampedX, clampedY);
    }

    private interpolateHexColor(startHex: string, endHex: string, t: number): string {
        const startValue = Number.parseInt(startHex.replace('#', ''), 16);
        const endValue = Number.parseInt(endHex.replace('#', ''), 16);
        const startR = (startValue >> 16) & 0xff;
        const startG = (startValue >> 8) & 0xff;
        const startB = startValue & 0xff;
        const endR = (endValue >> 16) & 0xff;
        const endG = (endValue >> 8) & 0xff;
        const endB = endValue & 0xff;
        const r = Math.round(startR + (endR - startR) * t);
        const g = Math.round(startG + (endG - startG) * t);
        const b = Math.round(startB + (endB - startB) * t);
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}
