/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, StarlingMergeGate, Asteroid, LightRay, Unit, Marine, Mothership, Grave, Starling, GraveProjectile, GraveSmallParticle, GraveBlackHole, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet, MinionProjectile, LaserBeam, ImpactParticle, Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, Ray, RayBeamSegment, InfluenceBall, InfluenceZone, InfluenceBallProjectile, TurretDeployer, DeployedTurret, Driller, Dagger, DamageNumber, Beam, Mortar, Preist, HealingBombParticle, Spotlight, Tank, CrescentWave, Nova, NovaBomb, NovaScatterBullet, Sly, Radiant, RadiantOrb, VelarisHero, VelarisOrb, AurumHero, AurumOrb, AurumShieldHit, Dash, DashSlash, Blink, BlinkShockwave, Shadow, ShadowDecoy, ShadowDecoyParticle, Chrono, ChronoFreezeCircle, Splendor, SplendorSunSphere, SplendorSunlightZone, SplendorLaserSegment } from './game-core';
import { SparkleParticle, DeathParticle } from './sim/entities/particles';
import * as Constants from './constants';
import { ColorScheme, COLOR_SCHEMES } from './menu';
import { GraphicVariant, GraphicKey, GraphicOption, graphicsOptions as defaultGraphicsOptions, InGameMenuTab, InGameMenuAction, InGameMenuLayout, RenderLayerKey, getInGameMenuLayout, getGraphicsMenuMaxScroll } from './render';
import { renderLensFlare } from './rendering/LensFlare';

import { darkenColor, adjustColorBrightness, brightenAndPaleColor, withAlpha } from './render/color-utilities';
import { valueNoise2D, fractalNoise2D } from './render/noise-utilities';
import { getFactionColor } from './render/faction-utilities';
import { SpriteManager, VELARIS_FORGE_GRAPHEME_SPRITE_PATHS } from './render/sprite-manager';
import { StarfieldRenderer } from './render/starfield-renderer';
import { SunRenderer } from './render/sun-renderer';
import { AsteroidRenderer } from './render/asteroid-renderer';
import { ForgeRenderer } from './render/building-renderers/forge-renderer';
import { FoundryRenderer } from './render/building-renderers/foundry-renderer';
import { TowerRenderer } from './render/building-renderers/tower-renderer';
import type { BuildingRendererContext } from './render/building-renderers/shared-utilities';
import { ProjectileRenderer } from './render/projectile-renderer';
import type { ProjectileRendererContext } from './render/projectile-renderer';
import { UnitRenderer } from './render/unit-renderers/unit-renderer';
import type { UnitRendererContext } from './render/unit-renderers/shared-utilities';
import { SolarMirrorRenderer } from './render/solar-mirror-renderer';
import type { SolarMirrorRendererContext } from './render/solar-mirror-renderer';
import { WarpGateRenderer } from './render/warp-gate-renderer';
import type { WarpGateRendererContext } from './render/warp-gate-renderer';
import { UIRenderer, UIRendererContext } from './render/ui-renderer';
import { EnvironmentRenderer, EnvironmentRendererContext } from './render/environment-renderer';
import { GlowRenderer } from './render/glow-renderer';


type InfluenceRenderCircle = {
    position: Vector2D;
    radius: number;
    color: string;
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
    public abilityArrowDirection: Vector2D | null = null; // Arrow direction for hero ability casting
    public abilityArrowLengthPx: number = 0; // Arrow length for hero ability casting
    public buildingAbilityArrowStart: Vector2D | null = null; // Arrow start for building ability casting
    public buildingAbilityArrowDirection: Vector2D | null = null; // Arrow direction for building ability casting
    public buildingAbilityArrowLengthPx: number = 0; // Arrow length for building ability casting
    
    public highlightedButtonIndex: number = -1; // Index of highlighted production button (-1 = none)
    public selectedUnits: Set<Unit> = new Set();
    public selectedMirrors: Set<SolarMirror> = new Set(); // Set of selected SolarMirror
    public selectedWarpGate: WarpGate | null = null;
    public pathPreviewForge: StellarForge | null = null;
    public pathPreviewStartWorld: Vector2D | null = null;
    public pathPreviewPoints: Vector2D[] = [];
    public pathPreviewEnd: Vector2D | null = null;
    public selectedHeroNames: string[] = [];
    public hasSeenFoundry: boolean = false;
    public hasActiveFoundry: boolean = false;
    public isWarpGatePlacementMode: boolean = false;
    public canCreateWarpGateFromMirrors: boolean = false;
    public isSelectedMirrorInSunlight: boolean = false;
    public warpGatePreviewWorldPos: Vector2D | null = null; // Position where warp gate would be placed
    public isWarpGatePreviewValid: boolean = false; // Whether the preview position is valid
    
    public viewingPlayer: Player | null = null; // The player whose view we're rendering
    public showInfo: boolean = false; // Toggle for showing top-left info
    public showInGameMenu: boolean = false; // Toggle for in-game menu
    public isPaused: boolean = false; // Game pause state
    public playerColor: string = Constants.PLAYER_1_COLOR; // Player 1 color (customizable)
    public enemyColor: string = Constants.PLAYER_2_COLOR; // Player 2 color (customizable)
    public allyColor: string = '#88FF88'; // Ally color for team games (green)
    public enemy2Color: string = '#FFA500'; // Second enemy color for team games (orange)
    public colorScheme: ColorScheme = COLOR_SCHEMES['SpaceBlack']; // Color scheme for rendering
    public inGameMenuTab: InGameMenuTab = 'main';
    public damageDisplayMode: 'damage' | 'remaining-life' = 'damage'; // How to display damage numbers
    public healthDisplayMode: 'bar' | 'number' = 'bar'; // How to display unit health
    public graphicsQuality: 'low' | 'medium' | 'high' | 'ultra' = 'ultra'; // Graphics quality setting
    public isFancyGraphicsEnabled: boolean = false; // Fancy bloom and shader effects
    public screenShakeEnabled: boolean = true; // Screen shake for explosions
    public offscreenIndicatorOpacity: number = 0.25; // Opacity for off-screen indicators
    public infoBoxOpacity: number = 0.5; // Opacity for top-right info boxes
    public soundVolume: number = 1; // Sound effect volume for in-game controls
    public musicVolume: number = 1; // Music volume for in-game controls
    private screenShakeIntensity: number = 0; // Current screen shake intensity
    private screenShakeTimer: number = 0; // Screen shake timer
    private shakenExplosions: WeakSet<any> = new WeakSet(); // Track which explosions have triggered screen shake
    public colorblindMode: boolean = true; // Colorblind mode - shows enemies as diamonds instead of circles

    private readonly HERO_SPRITE_SCALE = 4.2;
    private readonly FORGE_SPRITE_SCALE = 2.64;
    private readonly AURUM_EDGE_ALPHA_THRESHOLD = 128; // Alpha threshold for detecting filled pixels in edge detection
    private readonly VELARIS_FORGE_PARTICLE_RADIUS_PX = 1.6;
    private readonly VELARIS_STARLING_PARTICLE_COUNT = 24;
    private readonly VELARIS_STARLING_PARTICLE_RADIUS_PX = 1.2;
    private readonly VELARIS_STARLING_CLOUD_RADIUS_SCALE = 2.1;
    private readonly VELARIS_STARLING_TRIANGLE_RADIUS_SCALE = 2.5;
    private readonly VELARIS_STARLING_PENTAGON_RADIUS_SCALE = 2.7;
    private readonly VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE = 0.08;
    private readonly VELARIS_STARLING_CLOUD_SWIRL_SCALE = 0.45;
    private readonly VELARIS_STARLING_TRIANGLE_FLOW_SPEED = 0.08;
    private readonly VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED = 2.2;
    private readonly VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE = 0.35;
    private readonly VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE = 0.55;
    private readonly VELARIS_STARLING_CLOUD_PULL_SPEED = 0.6;
    private readonly VELARIS_STARLING_CLOUD_TIME_SCALE = 0.28;
    private readonly VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE = 0.35;
    private readonly VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE = 0.25;
    private readonly VELARIS_STARLING_SHAPE_BLEND_SPEED = 1.4;
    private readonly VELARIS_STARLING_GRAPHEME_ALPHA_MAX = 0.3;
    private readonly VELARIS_STARLING_GRAPHEME_PULSE_SPEED = 1.4;
    private readonly VELARIS_STARLING_GRAPHEME_SIZE_SCALE = 1.15;
    private readonly spriteManager = new SpriteManager();
    private starlingParticleStates = new WeakMap<Starling, {shapeBlend: number; polygonBlend: number; lastTimeSec: number}>();
    private starlingParticleSeeds = new WeakMap<Starling, number>();
    private aurumOffscreenCanvas: HTMLCanvasElement | null = null;
    private viewMinX: number = 0;
    private viewMaxX: number = 0;
    private viewMinY: number = 0;
    private viewMaxY: number = 0;
    private graphicsOptionByKey = new Map<GraphicKey, GraphicOption>();
    private graphicsVariantByKey = new Map<GraphicKey, GraphicVariant>();
    private graphicsMenuScrollOffset = 0;
    private readonly renderLayerOptions: Array<{ key: RenderLayerKey; label: string }> = [
        { key: 'suns', label: 'Suns' },
        { key: 'stars', label: 'Stars' },
        { key: 'asteroids', label: 'Asteroids' },
        { key: 'spaceDust', label: 'Space Dust' },
        { key: 'buildings', label: 'Buildings' },
        { key: 'units', label: 'Units' },
        { key: 'projectiles', label: 'Projectiles' }
    ];
    public isSunsLayerEnabled = true;
    public isStarsLayerEnabled = true;
    public isAsteroidsLayerEnabled = true;
    public isSpaceDustLayerEnabled = true;
    public isBuildingsLayerEnabled = true;
    public isUnitsLayerEnabled = true;
    public isProjectilesLayerEnabled = true;

    private enemyVisibilityAlpha = new WeakMap<object, number>();
    private shadeGlowAlphaByEntity = new WeakMap<object, number>();
    private enemyVisibilityLastUpdateSec = Number.NaN;
    private enemyVisibilityFrameDeltaSec = 0;
    private influenceRadiusLastUpdateSec = Number.NaN;
    private gradientCache = new Map<string, CanvasGradient>();

    private readonly ENEMY_VISIBILITY_FADE_SPEED_PER_SEC = 20;
    private readonly SHADE_GLOW_FADE_IN_SPEED_PER_SEC = 4.2;
    
    // Gradient caching bucket sizes for performance optimization
    private readonly SUN_RAY_RADIUS_BUCKET_SIZE = 500; // px - bucket size for sun ray gradient caching
    private readonly SUN_RAY_BLOOM_RADIUS_MULTIPLIER = 1.1; // Bloom radius is 10% larger than ambient for softer edges
    private readonly SHADE_GLOW_FADE_OUT_SPEED_PER_SEC = 6.5;
    private readonly ENTITY_SHADE_GLOW_SCALE = 1.2;

    private readonly graphicsOptions = defaultGraphicsOptions;

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
    private readonly MOVE_ORDER_DOT_RADIUS = 8.4;
    private readonly MOVE_ORDER_FRAME_DURATION_MS = 1000 / Constants.MOVEMENT_POINT_ANIMATION_FPS;
    private readonly MOVE_ORDER_FALLBACK_SPRITE_PATH = 'ASSETS/sprites/interface/movementPoint.png';
    private readonly FORGE_MAX_HEALTH = 1000;
    private readonly MIRROR_MAX_HEALTH = Constants.MIRROR_MAX_HEALTH;
    
    // Starfield renderer for background stars and nebula
    private readonly starfieldRenderer: StarfieldRenderer;
    private readonly sunRenderer: SunRenderer;
    private readonly asteroidRenderer: AsteroidRenderer;
    private readonly forgeRenderer: ForgeRenderer;
    private readonly foundryRenderer: FoundryRenderer;
    private readonly towerRenderer: TowerRenderer;
    private readonly projectileRenderer: ProjectileRenderer;
    private readonly unitRenderer: UnitRenderer;
    private readonly solarMirrorRenderer: SolarMirrorRenderer;
    private readonly warpGateRenderer: WarpGateRenderer;
    private readonly uiRenderer: UIRenderer;
    private readonly environmentRenderer = new EnvironmentRenderer();
    private readonly glowRenderer = new GlowRenderer();
    private movementPointFramePaths: string[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = context;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Initialize starfield renderer
        this.starfieldRenderer = new StarfieldRenderer();
        
        // Initialize sun renderer
        this.sunRenderer = new SunRenderer();

        // Initialize asteroid renderer
        this.asteroidRenderer = new AsteroidRenderer();

        // Initialize building renderers
        this.forgeRenderer = new ForgeRenderer();
        this.foundryRenderer = new FoundryRenderer();
        this.towerRenderer = new TowerRenderer();
        this.projectileRenderer = new ProjectileRenderer();
        this.unitRenderer = new UnitRenderer();
        this.solarMirrorRenderer = new SolarMirrorRenderer();
        this.warpGateRenderer = new WarpGateRenderer();
        this.uiRenderer = new UIRenderer();

        const defaultPngKeys: GraphicKey[] = ['stellarForge', 'solarMirror'];
        for (const option of this.graphicsOptions) {
            this.graphicsOptionByKey.set(option.key, option);
            const defaultVariant: GraphicVariant = option.svgPath ? 'svg' : option.pngPath ? 'png' : 'stub';
            const shouldPreferPng = defaultPngKeys.includes(option.key) && option.pngPath;
            this.graphicsVariantByKey.set(option.key, shouldPreferPng ? 'png' : defaultVariant);
        }

        for (let frameIndex = 1; frameIndex <= Constants.MOVEMENT_POINT_ANIMATION_FRAME_COUNT; frameIndex++) {
            // Frame 6 is currently missing from disk; skip it to avoid repeated 404s.
            if (frameIndex === 6) {
                continue;
            }
            this.movementPointFramePaths.push(
                `ASSETS/sprites/interface/movementPointAnimation/movementPoint_frame${frameIndex}.png`
            );
        }
    }

    private resizeCanvas(): void {
        // Get device pixel ratio for high-DPI displays (retina, mobile, etc.)
        const dpr = window.devicePixelRatio || 1;
        
        // Apply resolution scaling based on quality setting
        // Low quality: 0.75x resolution (56% pixel count)
        // Medium quality: 0.9x resolution (81% pixel count)
        // High/Ultra: Full resolution
        let resolutionScale = 1.0;
        if (this.graphicsQuality === 'low') {
            resolutionScale = 0.75;
        } else if (this.graphicsQuality === 'medium') {
            resolutionScale = 0.9;
        }
        
        const effectiveDpr = dpr * resolutionScale;
        
        // Set canvas physical size to match display size * effective DPR
        this.canvas.width = window.innerWidth * effectiveDpr;
        this.canvas.height = window.innerHeight * effectiveDpr;
        
        // Set canvas CSS size to match window size
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
        
        // Reset transform and scale the context to match effective DPR
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(effectiveDpr, effectiveDpr);
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPos: Vector2D): Vector2D {
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;
        
        // Apply screen shake offset if enabled
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (this.screenShakeEnabled && this.screenShakeIntensity > 0) {
            // Random shake direction
            const angle = Math.random() * Math.PI * 2;
            shakeOffsetX = Math.cos(angle) * this.screenShakeIntensity;
            shakeOffsetY = Math.sin(angle) * this.screenShakeIntensity;
        }
        
        return new Vector2D(
            centerX + (worldPos.x - this.camera.x) * this.zoom + shakeOffsetX,
            centerY + (worldPos.y - this.camera.y) * this.zoom + shakeOffsetY
        );
    }

    private worldToScreenCoords(worldX: number, worldY: number, out: Vector2D): void {
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;

        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (this.screenShakeEnabled && this.screenShakeIntensity > 0) {
            const angle = Math.random() * Math.PI * 2;
            shakeOffsetX = Math.cos(angle) * this.screenShakeIntensity;
            shakeOffsetY = Math.sin(angle) * this.screenShakeIntensity;
        }

        out.x = centerX + (worldX - this.camera.x) * this.zoom + shakeOffsetX;
        out.y = centerY + (worldY - this.camera.y) * this.zoom + shakeOffsetY;
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
     * Check if screen position is within viewport bounds
     */
    private isScreenPosWithinViewBounds(screenPos: { x: number; y: number }, margin: number = 0): boolean {
        const dpr = window.devicePixelRatio || 1;
        const viewportWidth = this.canvas.width / dpr;
        const viewportHeight = this.canvas.height / dpr;
        return screenPos.x >= -margin &&
               screenPos.x <= viewportWidth + margin &&
               screenPos.y >= -margin &&
               screenPos.y <= viewportHeight + margin;
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
        return getFactionColor(faction);
    }

    private getUIRendererContext(): UIRendererContext {
        return {
            ctx: this.ctx,
            canvas: this.canvas,
            zoom: this.zoom,
            selectionStart: this.selectionStart,
            selectionEnd: this.selectionEnd,
            abilityArrowStarts: this.abilityArrowStarts,
            abilityArrowDirection: this.abilityArrowDirection,
            abilityArrowLengthPx: this.abilityArrowLengthPx,
            buildingAbilityArrowStart: this.buildingAbilityArrowStart,
            buildingAbilityArrowDirection: this.buildingAbilityArrowDirection,
            buildingAbilityArrowLengthPx: this.buildingAbilityArrowLengthPx,
            pathPreviewForge: this.pathPreviewForge,
            pathPreviewPoints: this.pathPreviewPoints,
            pathPreviewEnd: this.pathPreviewEnd,
            pathPreviewStartWorld: this.pathPreviewStartWorld,
            selectedUnits: this.selectedUnits,
            selectedMirrors: this.selectedMirrors,
            highlightedButtonIndex: this.highlightedButtonIndex,
            showInfo: this.showInfo,
            showInGameMenu: this.showInGameMenu,
            inGameMenuTab: this.inGameMenuTab,
            damageDisplayMode: this.damageDisplayMode,
            healthDisplayMode: this.healthDisplayMode,
            offscreenIndicatorOpacity: this.offscreenIndicatorOpacity,
            infoBoxOpacity: this.infoBoxOpacity,
            playerColor: this.playerColor,
            enemyColor: this.enemyColor,
            colorblindMode: this.colorblindMode,
            graphicsQuality: this.graphicsQuality,
            isFancyGraphicsEnabled: this.isFancyGraphicsEnabled,
            screenShakeEnabled: this.screenShakeEnabled,
            soundVolume: this.soundVolume,
            musicVolume: this.musicVolume,
            graphicsMenuScrollOffset: this.graphicsMenuScrollOffset,
            renderLayerOptions: this.renderLayerOptions,
            isSunsLayerEnabled: this.isSunsLayerEnabled,
            isStarsLayerEnabled: this.isStarsLayerEnabled,
            isAsteroidsLayerEnabled: this.isAsteroidsLayerEnabled,
            isSpaceDustLayerEnabled: this.isSpaceDustLayerEnabled,
            isBuildingsLayerEnabled: this.isBuildingsLayerEnabled,
            isUnitsLayerEnabled: this.isUnitsLayerEnabled,
            isProjectilesLayerEnabled: this.isProjectilesLayerEnabled,
            worldToScreen: (pos) => this.worldToScreen(pos),
            isWithinViewBounds: (pos, margin) => this.isWithinViewBounds(pos, margin),
            getLadPlayerColor: (player, ladSun, game) => this.getLadPlayerColor(player, ladSun, game),
            getSolEnergyIcon: () => this.getSolEnergyIcon(),
            getProductionDisplayName: (unitType) => this.getProductionDisplayName(unitType),
            getBuildingDisplayName: (building) => this.getBuildingDisplayName(building),
            viewingPlayer: this.viewingPlayer,
            CONTROL_LINES_FULL: GameRenderer.CONTROL_LINES_FULL,
            CONTROL_LINES_COMPACT: GameRenderer.CONTROL_LINES_COMPACT,
        };
    }
    private getEnvironmentRendererContext(): EnvironmentRendererContext {
        return {
            ctx: this.ctx,
            canvas: this.canvas,
            camera: this.camera,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            isFancyGraphicsEnabled: this.isFancyGraphicsEnabled,
            playerColor: this.playerColor,
            enemyColor: this.enemyColor,
            viewingPlayer: this.viewingPlayer,
            colorblindMode: this.colorblindMode,
            worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            isWithinViewBounds: (worldPos, margin) => this.isWithinViewBounds(worldPos, margin),
            getFactionColor: (faction) => this.getFactionColor(faction),
            getLadPlayerColor: (player, ladSun, game) => this.getLadPlayerColor(player, ladSun, game),
            drawFancyBloom: (screenPos, radius, color, intensity) => this.drawFancyBloom(screenPos, radius, color, intensity),
            getPseudoRandom: (seed) => this.getPseudoRandom(seed),
        };
    }

    private getLadPlayerColor(player: Player, ladSun: Sun | undefined, game: GameState): string {
        // In LaD mode, use light/dark colors
        if (ladSun && player.stellarForge) {
            const ownerSide = game.getLadSide(player.stellarForge.position, ladSun);
            return ownerSide === 'light' ? '#FFFFFF' : '#000000';
        }
        
        // In normal mode, use team-aware colors
        return this.getTeamColor(player, game);
    }

    /**
     * Get the color for a player based on team relationships
     * Returns: playerColor (self), allyColor (teammate), enemyColor (first enemy), enemy2Color (second enemy)
     */
    private getTeamColor(player: Player, game: GameState): string {
        if (!this.viewingPlayer) {
            return this.playerColor;
        }
        
        // Player themself
        if (player === this.viewingPlayer) {
            return this.playerColor;
        }
        
        // Check if team game (3+ players)
        if (game.players.length >= 3) {
            // Teammate
            if (player.teamId === this.viewingPlayer.teamId) {
                return this.allyColor;
            }
            
            // Enemy - distinguish between first and second enemy
            const enemies = game.players.filter(p => 
                p !== this.viewingPlayer && 
                this.viewingPlayer !== null &&
                p.teamId !== this.viewingPlayer.teamId
            );
            
            const enemyIndex = enemies.indexOf(player);
            if (enemyIndex === 0) {
                return this.enemyColor;
            } else if (enemyIndex >= 1) {
                return this.enemy2Color;
            }
        }
        
        // Default 1v1 logic
        return this.enemyColor;
    }

    /**
     * Check if a player is an enemy (not self or teammate)
     */
    private isEnemyPlayer(player: Player, game: GameState): boolean {
        if (!this.viewingPlayer) {
            return false;
        }
        
        // Not an enemy if it's the viewing player
        if (player === this.viewingPlayer) {
            return false;
        }
        
        // In team games, check team ID
        if (game.players.length >= 3) {
            return player.teamId !== this.viewingPlayer.teamId;
        }
        
        // In 1v1, anyone other than viewing player is enemy
        return true;
    }

    private getSpriteImage(path: string): HTMLImageElement {
        return this.spriteManager.getSpriteImage(path);
    }

    /**
     * Get the cached SoL energy icon
     */
    private getSolEnergyIcon(): HTMLImageElement {
        return this.spriteManager.getSolEnergyIcon();
    }

    private getTintedSprite(path: string, color: string): HTMLCanvasElement | null {
        return this.spriteManager.getTintedSprite(path, color);
    }

    private getVelarisGraphemeSpritePath(letter: string): string | null {
        return this.spriteManager.getVelarisGraphemeSpritePath(letter);
    }

    private getGraphemeMaskData(spritePath: string): ImageData | null {
        return this.spriteManager.getGraphemeMaskData(spritePath);
    }

    private isPointInsideGraphemeMask(x: number, y: number, mask: ImageData): boolean {
        return this.spriteManager.isPointInsideGraphemeMask(x, y, mask);
    }

    private drawVelarisGraphemeSprite(
        spritePath: string,
        centerX: number,
        centerY: number,
        targetSize: number,
        color: string
    ): boolean {
        return this.spriteManager.drawVelarisGraphemeSprite(this.ctx, spritePath, centerX, centerY, targetSize, color);
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

    private isRenderLayerEnabled(layer: RenderLayerKey): boolean {
        switch (layer) {
            case 'suns':
                return this.isSunsLayerEnabled;
            case 'stars':
                return this.isStarsLayerEnabled;
            case 'asteroids':
                return this.isAsteroidsLayerEnabled;
            case 'spaceDust':
                return this.isSpaceDustLayerEnabled;
            case 'buildings':
                return this.isBuildingsLayerEnabled;
            case 'units':
                return this.isUnitsLayerEnabled;
            case 'projectiles':
                return this.isProjectilesLayerEnabled;
            default:
                return true;
        }
    }

    public setRenderLayerEnabled(layer: RenderLayerKey, isEnabled: boolean): void {
        switch (layer) {
            case 'suns':
                this.isSunsLayerEnabled = isEnabled;
                break;
            case 'stars':
                this.isStarsLayerEnabled = isEnabled;
                break;
            case 'asteroids':
                this.isAsteroidsLayerEnabled = isEnabled;
                break;
            case 'spaceDust':
                this.isSpaceDustLayerEnabled = isEnabled;
                break;
            case 'buildings':
                this.isBuildingsLayerEnabled = isEnabled;
                break;
            case 'units':
                this.isUnitsLayerEnabled = isEnabled;
                break;
            case 'projectiles':
                this.isProjectilesLayerEnabled = isEnabled;
                break;
            default:
                break;
        }
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
            // Use starling sprite based on upgrade level (1-4)
            const level = Math.min(4, Math.max(1, starling.spriteLevel));
            return `ASSETS/sprites/RADIANT/starlings/starlingLevel (${level}).png`;
        }
        return null;
    }

    private getStarlingFacingRotationRad(starling: Starling): number | null {
        // Preserve the unit's last simulation rotation so stopped starlings keep their final heading.
        return starling.rotation;
    }

    /**
     * Detect and draw edges from an offscreen canvas with filled shapes
     * Used for Aurum outline rendering effect
     */
    private detectAndDrawEdges(
        imageData: ImageData,
        cropWidth: number,
        cropHeight: number,
        minX: number,
        minY: number,
        displayColor: string
    ): void {
        // Skip expensive edge detection on low/medium quality for performance
        if (this.graphicsQuality === 'low' || this.graphicsQuality === 'medium') {
            return;
        }

        const data = imageData.data;

        // Draw glowing outline where filled areas border empty areas
        this.ctx.save();
        this.ctx.strokeStyle = displayColor;
        this.ctx.shadowColor = displayColor;
        this.ctx.shadowBlur = 10;
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = displayColor;

        // Edge detection: draw pixels at the boundary of filled regions
        for (let y = 1; y < cropHeight - 1; y++) {
            for (let x = 1; x < cropWidth - 1; x++) {
                const idx = (y * cropWidth + x) * 4;
                const alpha = data[idx + 3];
                
                // Check if this pixel is filled
                if (alpha > this.AURUM_EDGE_ALPHA_THRESHOLD) {
                    // Check if any neighbor is empty
                    const hasEmptyNeighbor = 
                        data[((y - 1) * cropWidth + x) * 4 + 3] < this.AURUM_EDGE_ALPHA_THRESHOLD ||  // top
                        data[((y + 1) * cropWidth + x) * 4 + 3] < this.AURUM_EDGE_ALPHA_THRESHOLD ||  // bottom
                        data[(y * cropWidth + (x - 1)) * 4 + 3] < this.AURUM_EDGE_ALPHA_THRESHOLD ||  // left
                        data[(y * cropWidth + (x + 1)) * 4 + 3] < this.AURUM_EDGE_ALPHA_THRESHOLD;    // right
                    
                    if (hasEmptyNeighbor) {
                        this.ctx.fillRect(minX + x, minY + y, 1, 1);
                    }
                }
            }
        }
        
        this.ctx.restore();
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
        if (unit instanceof Nova) {
            return this.getGraphicAssetPath('heroNova');
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
        if (unit instanceof Spotlight) {
            return this.getGraphicAssetPath('heroBeam');
        }
        return null;
    }

    /**
     * Darken a color by a given factor (0-1, where 0 is black and 1 is original color)
     */
    private darkenColor(color: string, factor: number): string {
        return darkenColor(color, factor);
    }

    /**
     * Creates a BuildingRendererContext object for use by extracted building renderers.
     */
    private getBuildingRendererContext(): BuildingRendererContext {
        return {
            ctx: this.ctx,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            playerColor: this.playerColor,
            enemyColor: this.enemyColor,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            viewingPlayer: this.viewingPlayer,
            highlightedButtonIndex: this.highlightedButtonIndex,
            worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            getSpriteImage: (path) => this.getSpriteImage(path),
            getTintedSprite: (path, color) => this.getTintedSprite(path, color) as HTMLCanvasElement,
            getGraphicAssetPath: (key) => this.getGraphicAssetPath(key as any),
            getCachedRadialGradient: (_key, _radius, _colorStops) => {
                // Signature mismatch: context interface uses simplified form; caller handles directly
                throw new Error('getCachedRadialGradient not supported via context');
            },
            darkenColor: (color, opacity) => this.darkenColor(color, opacity),
            applyShadeBrightening: (color, pos, game, isBuilding) => this.applyShadeBrightening(color, pos, game, isBuilding),
            getEnemyVisibilityAlpha: (entity, isVisible, gameTime) => this.getEnemyVisibilityAlpha(entity, isVisible, gameTime),
            drawStructureShadeGlow: (entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected) =>
                this.drawStructureShadeGlow(entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected),
            drawAestheticSpriteShadow: (worldPos, screenPos, size, game, options) =>
                this.drawAestheticSpriteShadow(worldPos, screenPos, size, game, options),
            drawBuildingSelectionIndicator: (screenPos, radius) => this.drawBuildingSelectionIndicator(screenPos, radius),
            drawHealthDisplay: (screenPos, currentHealth, maxHealth, size, yOffset) =>
                this.drawHealthDisplay(screenPos, currentHealth, maxHealth, size, yOffset),
            drawLadAura: (screenPos, size, color, side) => this.drawLadAura(screenPos, size, color, side),
            drawMoveOrderIndicator: (fromPos, toPos, moveOrder, color) =>
                this.unitRenderer.drawMoveOrderIndicator(fromPos, toPos, moveOrder, color, this.getUnitRendererContext()),
            drawWarpGateProductionEffect: (screenPos, radius, game, color) =>
                this.unitRenderer.drawWarpGateProductionEffect(screenPos, radius, game, color, this.getUnitRendererContext()),
            isWithinViewBounds: (worldPos, margin) => this.isWithinViewBounds(worldPos, margin),
            getVelarisGraphemeSpritePath: (letter) => this.getVelarisGraphemeSpritePath(letter),
            getGraphemeMaskData: (path) => this.getGraphemeMaskData(path),
            drawVelarisGraphemeSprite: (path, x, y, size, color) => this.drawVelarisGraphemeSprite(path, x, y, size, color),
            detectAndDrawEdges: (imageData, width, height, offsetX, offsetY, color) =>
                this.detectAndDrawEdges(imageData, width, height, offsetX, offsetY, color),
            getPseudoRandom: (seed) => this.getPseudoRandom(seed),
            shakenExplosions: this.shakenExplosions,
            triggerScreenShake: (intensity) => this.triggerScreenShake(intensity),
        };
    }

    private getSolarMirrorRendererContext(): SolarMirrorRendererContext {
        return {
            ctx: this.ctx,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            isFancyGraphicsEnabled: this.isFancyGraphicsEnabled,
            playerColor: this.playerColor,
            enemyColor: this.enemyColor,
            viewingPlayer: this.viewingPlayer,
            isWarpGatePlacementMode: this.isWarpGatePlacementMode,
            canCreateWarpGateFromMirrors: this.canCreateWarpGateFromMirrors,
            isSelectedMirrorInSunlight: this.isSelectedMirrorInSunlight,
            hasSeenFoundry: this.hasSeenFoundry,
            hasActiveFoundry: this.hasActiveFoundry,
            highlightedButtonIndex: this.highlightedButtonIndex,
            MIRROR_MAX_HEALTH: this.MIRROR_MAX_HEALTH,
            gradientCache: this.gradientCache,
            VELARIS_FORGE_GRAPHEME_SPRITE_PATHS: VELARIS_FORGE_GRAPHEME_SPRITE_PATHS,
            worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            getEnemyVisibilityAlpha: (entity, isVisible, gameTime) => this.getEnemyVisibilityAlpha(entity, isVisible, gameTime),
            darkenColor: (color, factor) => this.darkenColor(color, factor),
            applyShadeBrightening: (color, pos, game, isInShade) => this.applyShadeBrightening(color, pos, game, isInShade),
            brightenAndPaleColor: (color) => this.brightenAndPaleColor(color),
            drawStructureShadeGlow: (entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected) =>
                this.drawStructureShadeGlow(entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected),
            drawAestheticSpriteShadow: (worldPos, screenPos, size, game, options) =>
                this.drawAestheticSpriteShadow(worldPos, screenPos, size, game, options),
            drawFancyBloom: (screenPos, radius, color, intensity) => this.drawFancyBloom(screenPos, radius, color, intensity),
            getCachedRadialGradient: (key, x0, y0, r0, x1, y1, r1, stops) =>
                this.getCachedRadialGradient(key, x0, y0, r0, x1, y1, r1, stops),
            drawBuildingSelectionIndicator: (screenPos, radius) => this.drawBuildingSelectionIndicator(screenPos, radius),
            drawHealthDisplay: (screenPos, currentHealth, maxHealth, size, yOffset, isRegenerating, playerColor) =>
                this.drawHealthDisplay(screenPos, currentHealth, maxHealth, size, yOffset, isRegenerating, playerColor),
            drawLadAura: (screenPos, size, color, side) => this.drawLadAura(screenPos, size, color, side),
            drawMoveOrderIndicator: (fromPos, toPos, moveOrder, color) =>
                this.unitRenderer.drawMoveOrderIndicator(fromPos, toPos, moveOrder, color, this.getUnitRendererContext()),
            getVelarisGraphemeSpritePath: (letter) => this.getVelarisGraphemeSpritePath(letter),
            getGraphemeMaskData: (path) => this.getGraphemeMaskData(path),
            drawVelarisGraphemeSprite: (path, x, y, size, color) => this.drawVelarisGraphemeSprite(path, x, y, size, color),
            getPseudoRandom: (seed) => this.getPseudoRandom(seed),
            getSolarMirrorSpritePath: (mirror) => this.getSolarMirrorSpritePath(mirror),
            getTintedSprite: (path, color) => this.getTintedSprite(path, color),
            getSolEnergyIcon: () => this.getSolEnergyIcon(),
        };
    }

    private getWarpGateRendererContext(): WarpGateRendererContext {
        return {
            ctx: this.ctx,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            selectedWarpGate: this.selectedWarpGate,
            highlightedButtonIndex: this.highlightedButtonIndex,
            isWarpGatePlacementMode: this.isWarpGatePlacementMode,
            warpGatePreviewWorldPos: this.warpGatePreviewWorldPos,
            isWarpGatePreviewValid: this.isWarpGatePreviewValid,
            worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            getLadPlayerColor: (player, ladSun, game) => this.getLadPlayerColor(player, ladSun, game),
            drawStructureShadeGlow: (entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected) =>
                this.drawStructureShadeGlow(entity, screenPos, size, color, shouldGlow, visibilityAlpha, isSelected),
            drawAestheticSpriteShadow: (worldPos, screenPos, size, game, options) =>
                this.drawAestheticSpriteShadow(worldPos, screenPos, size, game, options),
            drawBuildingSelectionIndicator: (screenPos, radius) => this.drawBuildingSelectionIndicator(screenPos, radius),
            drawWarpGateProductionEffect: (screenPos, radius, game, displayColor) =>
                this.unitRenderer.drawWarpGateProductionEffect(screenPos, radius, game, displayColor, this.getUnitRendererContext()),
            getPseudoRandom: (seed) => this.getPseudoRandom(seed),
        };
    }

    private getProjectileRendererContext(): ProjectileRendererContext {
        return {
            ctx: this.ctx,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            getCachedRadialGradient: (key, x0, y0, r0, x1, y1, r1, stops) =>
                this.getCachedRadialGradient(key, x0, y0, r0, x1, y1, r1, stops),
            drawParticleSunShadowTrail: (worldPos, screenPos, screenSize, suns, maxDistance, opacity, alphaScale) =>
                this.drawParticleSunShadowTrail(worldPos, screenPos, screenSize, suns, maxDistance, opacity, alphaScale),
        };
    }

    private getUnitRendererContext(): UnitRendererContext {
        return {
            ctx: this.ctx,
            zoom: this.zoom,
            graphicsQuality: this.graphicsQuality,
            isFancyGraphicsEnabled: this.isFancyGraphicsEnabled,
            playerColor: this.playerColor,
            enemyColor: this.enemyColor,
            viewingPlayer: this.viewingPlayer,
            selectedUnits: this.selectedUnits,
            HERO_SPRITE_SCALE: this.HERO_SPRITE_SCALE,
            ENTITY_SHADE_GLOW_SCALE: this.ENTITY_SHADE_GLOW_SCALE,
            MOVE_ORDER_DOT_RADIUS: this.MOVE_ORDER_DOT_RADIUS,
            MOVE_ORDER_FRAME_DURATION_MS: this.MOVE_ORDER_FRAME_DURATION_MS,
            MOVE_ORDER_FALLBACK_SPRITE_PATH: this.MOVE_ORDER_FALLBACK_SPRITE_PATH,
            movementPointFramePaths: this.movementPointFramePaths,
            worldToScreen: (pos) => this.worldToScreen(pos),
            getMinZoomForBounds: () => this.getMinZoomForBounds(),
            isWithinViewBounds: (pos, margin) => this.isWithinViewBounds(pos, margin),
            isScreenPosWithinViewBounds: (pos, margin) => this.isScreenPosWithinViewBounds(pos, margin),
            getHeroSpritePath: (unit) => this.getHeroSpritePath(unit),
            getStarlingSpritePath: (s) => this.getStarlingSpritePath(s),
            getStarlingFacingRotationRad: (s) => this.getStarlingFacingRotationRad(s),
            getTintedSprite: (path, color) => this.getTintedSprite(path, color),
            getSpriteImage: (path) => this.getSpriteImage(path),
            getVelarisGraphemeSpritePath: (letter) => this.getVelarisGraphemeSpritePath(letter),
            getGraphemeMaskData: (path) => this.getGraphemeMaskData(path),
            drawVelarisGraphemeSprite: (path, x, y, size, color) => this.drawVelarisGraphemeSprite(path, x, y, size, color),
            darkenColor: (color, opacity) => this.darkenColor(color, opacity),
            getFactionColor: (faction) => this.getFactionColor(faction),
            applyShadeBrightening: (color, pos, game, isBuilding) => this.applyShadeBrightening(color, pos, game, isBuilding),
            brightenAndPaleColor: (color) => this.brightenAndPaleColor(color),
            getEnemyVisibilityAlpha: (entity, isVisible, gameTime) => this.getEnemyVisibilityAlpha(entity, isVisible, gameTime),
            getShadeGlowAlpha: (entity, shouldGlow) => this.getShadeGlowAlpha(entity, shouldGlow),
            drawCachedUnitGlow: (screenPos, radiusPx, color, alphaScale) => this.drawCachedUnitGlow(screenPos, radiusPx, color, alphaScale),
            drawBuildingSelectionIndicator: (screenPos, radius) => this.drawBuildingSelectionIndicator(screenPos, radius),
            drawHealthDisplay: (screenPos, current, max, size, yOffset) => this.drawHealthDisplay(screenPos, current, max, size, yOffset),
            drawLadAura: (screenPos, size, color, side) => this.drawLadAura(screenPos, size, color, side),
            drawFancyBloom: (screenPos, radius, color, intensity) => this.drawFancyBloom(screenPos, radius, color, intensity),
            getPseudoRandom: (seed) => this.getPseudoRandom(seed),
            getStarlingParticleSeed: (s) => this.getStarlingParticleSeed(s),
            getCachedRadialGradient: (key, x0, y0, r0, x1, y1, r1, stops) => this.getCachedRadialGradient(key, x0, y0, r0, x1, y1, r1, stops),
            gradientCache: this.gradientCache,
            triggerScreenShake: (intensity) => this.triggerScreenShake(intensity),
            starlingParticleStates: this.starlingParticleStates,
            VELARIS_STARLING_SHAPE_BLEND_SPEED: this.VELARIS_STARLING_SHAPE_BLEND_SPEED,
            VELARIS_STARLING_PARTICLE_RADIUS_PX: this.VELARIS_STARLING_PARTICLE_RADIUS_PX,
            VELARIS_STARLING_GRAPHEME_PULSE_SPEED: this.VELARIS_STARLING_GRAPHEME_PULSE_SPEED,
            VELARIS_STARLING_GRAPHEME_ALPHA_MAX: this.VELARIS_STARLING_GRAPHEME_ALPHA_MAX,
            VELARIS_STARLING_GRAPHEME_SIZE_SCALE: this.VELARIS_STARLING_GRAPHEME_SIZE_SCALE,
            VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE: this.VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE,
            VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE: this.VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE,
            VELARIS_STARLING_CLOUD_TIME_SCALE: this.VELARIS_STARLING_CLOUD_TIME_SCALE,
            VELARIS_STARLING_PARTICLE_COUNT: this.VELARIS_STARLING_PARTICLE_COUNT,
            VELARIS_STARLING_TRIANGLE_RADIUS_SCALE: this.VELARIS_STARLING_TRIANGLE_RADIUS_SCALE,
            VELARIS_STARLING_PENTAGON_RADIUS_SCALE: this.VELARIS_STARLING_PENTAGON_RADIUS_SCALE,
            VELARIS_STARLING_CLOUD_RADIUS_SCALE: this.VELARIS_STARLING_CLOUD_RADIUS_SCALE,
            VELARIS_STARLING_CLOUD_SWIRL_SCALE: this.VELARIS_STARLING_CLOUD_SWIRL_SCALE,
            VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE: this.VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE,
            VELARIS_STARLING_TRIANGLE_FLOW_SPEED: this.VELARIS_STARLING_TRIANGLE_FLOW_SPEED,
            VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED: this.VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED,
            VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE: this.VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE,
            VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE: this.VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE,
            VELARIS_STARLING_CLOUD_PULL_SPEED: this.VELARIS_STARLING_CLOUD_PULL_SPEED,
            VELARIS_FORGE_GRAPHEME_SPRITE_PATHS: VELARIS_FORGE_GRAPHEME_SPRITE_PATHS,
            canvas: this.canvas,
            camera: this.camera,
        };
    }

    /**
     * Adjust color brightness by a given factor (1.0 is original color, >1.0 is brighter, <1.0 is darker)
     */
    private adjustColorBrightness(color: string, factor: number): string {
        return adjustColorBrightness(color, factor);
    }

    /**
     * Calculate brightness boost for a position in shade based on proximity to player units/structures
     * Returns a factor from 0 (no boost) to 1 (maximum boost)
     */
    private getShadeBrightnessBoost(position: Vector2D, game: GameState, player: Player): number {
        if (!player) {
            return 0;
        }

        let minDistance = Infinity;

        // Check distance to player units
        for (const unit of player.units) {
            const distance = unit.position.distanceTo(position);
            if (distance < minDistance) {
                minDistance = distance;
                // Early exit if we're already very close (optimization)
                if (minDistance < 10) {
                    return 1.0;
                }
            }
        }

        // Check distance to player forge
        if (player.stellarForge) {
            const distance = player.stellarForge.position.distanceTo(position);
            if (distance < minDistance) {
                minDistance = distance;
                if (minDistance < 10) {
                    return 1.0;
                }
            }
        }

        // Check distance to player buildings (mirrors, etc.)
        for (const building of player.buildings) {
            const distance = building.position.distanceTo(position);
            if (distance < minDistance) {
                minDistance = distance;
                if (minDistance < 10) {
                    return 1.0;
                }
            }
        }

        // Calculate brightness boost based on distance (smooth falloff)
        if (minDistance >= Constants.SHADE_BRIGHTNESS_RADIUS) {
            return 0;
        }

        // Smooth falloff: 1.0 at distance 0, 0.0 at SHADE_BRIGHTNESS_RADIUS
        const falloff = 1.0 - (minDistance / Constants.SHADE_BRIGHTNESS_RADIUS);
        return falloff * falloff; // Quadratic falloff for smoother transition
    }

    /**
     * Apply shade brightening effect to a color based on proximity to player units
     * Only applies the boost if the position is in shade
     */
    private applyShadeBrightening(color: string, position: Vector2D, game: GameState, isInShade: boolean): string {
        if (!isInShade || !this.viewingPlayer) {
            return color;
        }

        const brightnessBoost = this.getShadeBrightnessBoost(position, game, this.viewingPlayer);
        if (brightnessBoost <= 0) {
            return color;
        }

        // Apply brightness boost (1.0 = original, higher = brighter)
        const boostFactor = 1.0 + (Constants.SHADE_BRIGHTNESS_BOOST * brightnessBoost);
        return this.adjustColorBrightness(color, boostFactor);
    }

    /**
     * Brighten and pale a color (make it lighter and more desaturated)
     * Used for solar mirrors to make them slightly brighter and paler than player color
     */
    private brightenAndPaleColor(color: string): string {
        return brightenAndPaleColor(color);
    }

    /**
     * Draw an aura (colored glow) behind a unit or structure in LaD mode.
     * The aura color is adjusted based on the unit's side (white/black)
     */
    private drawLadAura(
        screenPos: { x: number, y: number },
        radius: number,
        baseColor: string,
        unitSide: 'light' | 'dark'
    ): void {
        this.glowRenderer.drawLadAura(screenPos, radius, baseColor, unitSide, this.ctx);
    }

    private drawFancyBloom(screenPos: Vector2D, radius: number, color: string, intensity: number): void {
        this.glowRenderer.drawFancyBloom(screenPos, radius, color, intensity, this.ctx);
    }

    private drawCachedUnitGlow(screenPos: Vector2D, radiusPx: number, color: string, alphaScale: number = 1): void {
        this.glowRenderer.drawCachedUnitGlow(screenPos, radiusPx, color, alphaScale, this.ctx);
    }

    private drawStructureShadeGlow(
        entity: object,
        screenPos: Vector2D,
        renderedRadiusPx: number,
        glowColor: string,
        shouldGlowInShade: boolean,
        visibilityAlpha: number = 1,
        isSelected: boolean = false
    ): void {
        const shadeGlowAlpha = this.getShadeGlowAlpha(entity, shouldGlowInShade);
        if (shadeGlowAlpha <= 0.01) {
            return;
        }

        const selectionBoost = isSelected ? 0.16 : 0.06;
        const shadeGlowBoost = 0.55 * shadeGlowAlpha;
        this.drawCachedUnitGlow(
            screenPos,
            renderedRadiusPx * (this.ENTITY_SHADE_GLOW_SCALE + selectionBoost),
            glowColor,
            (0.9 + shadeGlowBoost) * visibilityAlpha
        );
    }

    /**
     * Get quality-adjusted particle count for ultra effects
     */
    private getQualityAdjustedParticleCount(baseCount: number): number {
        switch (this.graphicsQuality) {
            case 'low':
                return Math.floor(baseCount * 0.25);
            case 'medium':
                return Math.floor(baseCount * 0.5);
            case 'high':
                return Math.floor(baseCount * 0.75);
            case 'ultra':
            default:
                return baseCount;
        }
    }

    /**
     * Get or create a cached radial gradient
     * 
     * NOTE: Gradients are bound to the canvas coordinate system at creation time.
     * Only use this for gradients that don't depend on screen positions (e.g., textures at origin).
     * Include viewport/zoom state in the key if gradients depend on dynamic positions.
     */
    private getCachedRadialGradient(
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        const cached = this.gradientCache.get(key);
        if (cached) {
            return cached;
        }

        const gradient = this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        this.gradientCache.set(key, gradient);
        return gradient;
    }

    /**
     * Get or create a cached linear gradient
     * 
     * NOTE: Gradients are bound to the canvas coordinate system at creation time.
     * Only use this for gradients that don't depend on screen positions (e.g., textures at origin).
     * Include viewport/zoom state in the key if gradients depend on dynamic positions.
     */
    private getCachedLinearGradient(
        key: string,
        x0: number, y0: number,
        x1: number, y1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        const cached = this.gradientCache.get(key);
        if (cached) {
            return cached;
        }

        const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        this.gradientCache.set(key, gradient);
        return gradient;
    }

    /**
     * Draw the universal unit/structure selection ring.
     */
    private drawBuildingSelectionIndicator(screenPos: { x: number, y: number }, radius: number): void {
        // Viewport culling: skip if off-screen with margin for selection ring
        const margin = radius + 20;
        if (!this.isScreenPosWithinViewBounds(screenPos, margin)) {
            return;
        }
        this.glowRenderer.drawBuildingSelectionIndicator(screenPos, radius, { ctx: this.ctx, zoom: this.zoom });
    }

    /**
     * Draw a sun
     */
    private drawSun(sun: Sun, gameTimeSec: number = 0): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        
        const sunSpritePath = this.getGraphicAssetPath('centralSun');
        const sunSprite = sunSpritePath ? this.getSpriteImage(sunSpritePath) : null;
        
        this.sunRenderer.drawSun(
            this.ctx,
            sun,
            screenPos,
            screenRadius,
            gameTimeSec,
            this.graphicsQuality,
            this.isFancyGraphicsEnabled,
            this.colorScheme,
            sunSprite,
            this.drawFancyBloom.bind(this),
            withAlpha
        );
    }

    /**
     * Draw cinematic lens flare for visible suns in screen space.
     */
    private drawLensFlare(sun: Sun): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = this.canvas.width / dpr;
        const canvasHeight = this.canvas.height / dpr;
        
        this.sunRenderer.drawLensFlare(
            this.ctx,
            sun,
            screenPos,
            screenRadius,
            canvasWidth,
            canvasHeight,
            this.graphicsQuality
        );
    }

    private getPseudoRandom(seed: number): number {
        const value = Math.sin(seed) * 43758.5453;
        return value - Math.floor(value);
    }

    private getStarlingParticleSeed(starling: Starling): number {
        let seed = this.starlingParticleSeeds.get(starling);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.starlingParticleSeeds.set(starling, seed);
        }
        return seed;
    }

    /**
     * Draw space dust particle with lightweight circle rendering
     */
    private drawSpaceDust(particle: SpaceDustParticle, game: GameState, viewingPlayerIndex: number | null): void {
        this.environmentRenderer.drawSpaceDust(particle, game, viewingPlayerIndex, this.getEnvironmentRendererContext());
    }

    private drawAestheticSpriteShadow(
        worldPos: Vector2D,
        screenPos: Vector2D,
        screenSize: number,
        game: GameState,
        options?: {
            opacity?: number;
            widthScale?: number;
            particleCount?: number;
            particleSpread?: number;
            spriteMask?: HTMLCanvasElement;
            spriteSize?: number;
            spriteRotation?: number;
        }
    ): void {
        this.environmentRenderer.drawAestheticSpriteShadow(worldPos, screenPos, screenSize, game, options, this.getEnvironmentRendererContext());
    }

    private drawSpriteSunShadowSilhouette(
        worldPos: Vector2D,
        screenPos: Vector2D,
        spriteMask: HTMLCanvasElement,
        spriteSize: number,
        rotationRad: number,
        suns: Sun[],
        opacity: number,
        alphaScale: number
    ): void {
        this.environmentRenderer.drawSpriteSunShadowSilhouette(worldPos, screenPos, spriteMask, spriteSize, rotationRad, suns, opacity, alphaScale, this.getEnvironmentRendererContext());
    }

    private drawParticleSunShadowTrail(
        worldPos: Vector2D,
        screenPos: Vector2D,
        screenSize: number,
        suns: Sun[],
        maxDistance: number,
        opacity: number,
        alphaScale: number
    ): void {
        this.environmentRenderer.drawParticleSunShadowTrail(worldPos, screenPos, screenSize, suns, maxDistance, opacity, alphaScale, this.getEnvironmentRendererContext());
    }

    private getClosestInfluenceOwnerIndex(position: Vector2D, game: GameState): number | null {
        let closestDistance = Infinity;
        let closestIndex: number | null = null;

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            if (player.isDefeated()) {
                continue;
            }

            const influenceSources: Array<{ position: Vector2D; radius: number }> = [];
            if (player.stellarForge && player.stellarForge.isReceivingLight && player.stellarForge.health > 0) {
                influenceSources.push({ position: player.stellarForge.position, radius: Constants.INFLUENCE_RADIUS });
            }
            for (const building of player.buildings) {
                if (building.health <= 0) {
                    continue;
                }
                const isFoundry = building instanceof SubsidiaryFactory;
                const radius = isFoundry
                    ? Constants.INFLUENCE_RADIUS
                    : Constants.INFLUENCE_RADIUS * Constants.BUILDING_INFLUENCE_RADIUS_MULTIPLIER;
                influenceSources.push({ position: building.position, radius });
            }

            for (const source of influenceSources) {
                const distance = position.distanceTo(source.position);
                if (distance < source.radius && distance < closestDistance) {
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

    private updateEnemyVisibilityFadeClock(gameTimeSec: number): void {
        if (Number.isNaN(this.enemyVisibilityLastUpdateSec)) {
            this.enemyVisibilityFrameDeltaSec = 0;
            this.enemyVisibilityLastUpdateSec = gameTimeSec;
            return;
        }

        this.enemyVisibilityFrameDeltaSec = Math.max(0, gameTimeSec - this.enemyVisibilityLastUpdateSec);
        this.enemyVisibilityLastUpdateSec = gameTimeSec;
    }

    private getEnemyVisibilityAlpha(entity: object, isVisible: boolean, _gameTimeSec: number): number {
        const currentAlpha = this.enemyVisibilityAlpha.get(entity) ?? (isVisible ? 1 : 0);
        const dtSec = this.enemyVisibilityFrameDeltaSec;
        const maxStep = this.ENEMY_VISIBILITY_FADE_SPEED_PER_SEC * dtSec;
        const targetAlpha = isVisible ? 1 : 0;
        const alphaDelta = targetAlpha - currentAlpha;
        const nextAlpha = Math.abs(alphaDelta) <= maxStep
            ? targetAlpha
            : currentAlpha + Math.sign(alphaDelta) * maxStep;
        this.enemyVisibilityAlpha.set(entity, nextAlpha);
        return nextAlpha;
    }

    private getShadeGlowAlpha(entity: object, shouldGlowInShade: boolean): number {
        const currentAlpha = this.shadeGlowAlphaByEntity.get(entity) ?? 0;
        const dtSec = this.enemyVisibilityFrameDeltaSec;
        const fadeSpeedPerSec = shouldGlowInShade
            ? this.SHADE_GLOW_FADE_IN_SPEED_PER_SEC
            : this.SHADE_GLOW_FADE_OUT_SPEED_PER_SEC;
        const maxStep = fadeSpeedPerSec * dtSec;
        const targetAlpha = shouldGlowInShade ? 1 : 0;
        const alphaDelta = targetAlpha - currentAlpha;
        const nextAlpha = Math.abs(alphaDelta) <= maxStep
            ? targetAlpha
            : currentAlpha + Math.sign(alphaDelta) * maxStep;
        this.shadeGlowAlphaByEntity.set(entity, nextAlpha);
        return nextAlpha;
    }

    private applyUltraWarmCoolGrade(game: GameState): void {
        // Skip expensive color grading on low quality setting
        if (this.graphicsQuality === 'low') {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply';
        
        // Cache cool vignette gradient by screen dimensions
        const coolKey = `cool-vignette-${Math.round(width / 50)}-${Math.round(height / 50)}`;
        let coolVignette = this.gradientCache.get(coolKey) as CanvasGradient | undefined;
        if (!coolVignette) {
            coolVignette = this.ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.85);
            coolVignette.addColorStop(0, 'rgba(255, 255, 255, 1)');
            coolVignette.addColorStop(1, 'rgba(138, 155, 210, 0.94)');
            this.gradientCache.set(coolKey, coolVignette);
        }
        this.ctx.fillStyle = coolVignette;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.globalCompositeOperation = 'screen';
        for (const sun of game.suns) {
            if (sun.type === 'lad') {
                continue;
            }
            const sunScreenPos = this.worldToScreen(sun.position);
            
            // Cache warm gradient by screen size (position-independent, applied per sun)
            const maxDimension = Math.max(width, height);
            const warmKey = `warm-gradient-${Math.round(maxDimension / 100)}`;
            let warmGradient = this.gradientCache.get(warmKey) as CanvasGradient | undefined;
            if (!warmGradient) {
                warmGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, maxDimension * 0.45);
                warmGradient.addColorStop(0, 'rgba(255, 178, 74, 0.28)');
                warmGradient.addColorStop(0.34, 'rgba(255, 148, 62, 0.18)');
                warmGradient.addColorStop(1, 'rgba(255, 112, 46, 0)');
                this.gradientCache.set(warmKey, warmGradient);
            }
            
            // Use translate to position the cached gradient
            this.ctx.save();
            this.ctx.translate(sunScreenPos.x, sunScreenPos.y);
            this.ctx.fillStyle = warmGradient;
            this.ctx.fillRect(-sunScreenPos.x, -sunScreenPos.y, width, height);
            this.ctx.restore();
        }

        this.ctx.restore();
    }

    /**
     * Draw influence circle for a base
     */
    private drawInfluenceCircle(position: Vector2D, radius: number, color: string): void {
        this.environmentRenderer.drawInfluenceCircle(position, radius, color, this.getEnvironmentRendererContext());
    }

    private getInfluenceTargetRadius(source: StellarForge | Building): number {
        return this.environmentRenderer.getInfluenceTargetRadius(source);
    }

    private isInfluenceSourceActive(source: StellarForge | Building): boolean {
        return this.environmentRenderer.isInfluenceSourceActive(source);
    }

    private updateInfluenceRadius(source: StellarForge | Building, deltaTimeSec: number): number {
        return this.environmentRenderer.updateInfluenceRadius(source, deltaTimeSec);
    }

    private drawMergedInfluenceOutlines(circles: Array<{ position: Vector2D; radius: number }>, color: string): void {
        this.environmentRenderer.drawMergedInfluenceOutlines(circles, color, this.getEnvironmentRendererContext());
    }

    /**
     * Draw a unit
     */

    /**
     * Draw connection lines with visual indicators for line of sight
     */
    private drawConnections(player: Player, suns: Sun[], asteroids: Asteroid[], players: Player[]): void {
        this.environmentRenderer.drawConnections(player, suns, asteroids, players, this.getEnvironmentRendererContext());
    }

    /**
     * Draw UI overlay
     */
    private drawUI(game: GameState): void {
        this.uiRenderer.drawUI(game, this.getUIRendererContext());
    }

    /**
     * Draw selection rectangle
     */
    private drawSelectionRectangle(): void {
        this.uiRenderer.drawSelectionRectangle(this.getUIRendererContext());
    }

    /**
     * Draw ability arrow for hero units
     */
    private drawAbilityArrow(): void {
        this.uiRenderer.drawAbilityArrow(this.getUIRendererContext());
    }

    /**
     * Draw ability arrow for building production/abilities
     */
    private drawBuildingAbilityArrow(): void {
        this.uiRenderer.drawBuildingAbilityArrow(this.getUIRendererContext());
    }

    /**
     * Set building ability arrow direction and cache angle calculation
     */
    setBuildingAbilityArrowDirection(direction: Vector2D | null): void {
        this.buildingAbilityArrowDirection = direction;
        this.uiRenderer.setBuildingAbilityArrowDirection(direction, this.getUIRendererContext());
    }

    /**
     * Draw a path preview for selected units (not from base)
     */
    private drawUnitPathPreview(): void {
        this.uiRenderer.drawUnitPathPreview(this.getUIRendererContext());
    }

    public createPathCommitEffect(startWorld: Vector2D, waypoints: Vector2D[], gameTimeSec: number): void {
        this.uiRenderer.createPathCommitEffect(startWorld, waypoints, gameTimeSec);
    }

    private updateAndDrawPathCommitEffects(gameTimeSec: number): void {
        this.uiRenderer.updateAndDrawPathCommitEffects(gameTimeSec, this.getUIRendererContext());
    }

    /**
     * Create a tap visual effect at screen position
     */
    createTapEffect(screenX: number, screenY: number): void {
        this.uiRenderer.createTapEffect(screenX, screenY);
    }

    /**
     * Create a swipe visual effect from start to end screen positions
     */
    createSwipeEffect(startX: number, startY: number, endX: number, endY: number): void {
        this.uiRenderer.createSwipeEffect(startX, startY, endX, endY);
    }

    /**
     * Create a warp gate shockwave effect at a world position
     */
    createWarpGateShockwave(position: Vector2D): void {
        this.uiRenderer.createWarpGateShockwave(position);
    }

    /**
     * Create a production button wave effect at a world position
     */
    createProductionButtonWave(position: Vector2D): void {
        this.uiRenderer.createProductionButtonWave(position);
    }

    /**
     * Update and draw tap effects (expanding ripple)
     */
    private updateAndDrawTapEffects(): void {
        this.uiRenderer.updateAndDrawTapEffects(this.getUIRendererContext());
    }

    /**
     * Update and draw swipe effects (directional trail)
     */
    private updateAndDrawSwipeEffects(): void {
        this.uiRenderer.updateAndDrawSwipeEffects(this.getUIRendererContext());
    }

    /**
     * Update and draw warp gate shockwave effects
     */
    private updateAndDrawWarpGateShockwaves(): void {
        this.uiRenderer.updateAndDrawWarpGateShockwaves(this.getUIRendererContext());
    }

    /**
     * Update and draw production button wave effects
     */
    private updateAndDrawProductionButtonWaves(): void {
        this.uiRenderer.updateAndDrawProductionButtonWaves(this.getUIRendererContext());
    }

    /**
     * Draw damage numbers floating up from damaged units
     */
    private drawDamageNumbers(game: GameState): void {
        this.uiRenderer.drawDamageNumbers(game, this.getUIRendererContext());
    }

    /**
     * Draw health display (bar or number) for an entity
     */
    private drawHealthDisplay(
        screenPos: { x: number; y: number },
        currentHealth: number,
        maxHealth: number,
        size: number,
        yOffset: number,
        isRegenerating: boolean = false,
        playerColor?: string
    ): void {
        this.uiRenderer.drawHealthDisplay(screenPos, currentHealth, maxHealth, size, yOffset, isRegenerating, playerColor, this.getUIRendererContext());
    }

    /**
     * Draw off-screen unit indicators
     */
    private drawOffScreenUnitIndicators(game: GameState): void {
        this.uiRenderer.drawOffScreenUnitIndicators(game, this.getUIRendererContext());
    }

    /**
     * Render the entire game state
     */
    render(game: GameState): void {
        this.sunRenderer.clearFrameCache();

        // Clear canvas with color scheme background
        this.ctx.fillStyle = this.colorScheme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateViewBounds();
        const ladSun = game.suns.find(s => s.type === 'lad');
        this.updateEnemyVisibilityFadeClock(game.gameTime);

        const viewingPlayerIndex = this.viewingPlayer ? game.players.indexOf(this.viewingPlayer) : null;
        
        // Draw camera-space values used by reworked parallax stars.
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;

        // Draw environment stack between shadow-star overlay and influence circles.
        // Back -> Front: suns -> reworked parallax stars -> asteroids -> space dust.

        // Draw suns
        if (this.isSunsLayerEnabled) {
            for (const sun of game.suns) {
                if (this.isWithinViewBounds(sun.position, sun.radius * 2)) {
                    this.drawSun(sun, game.gameTime);
                }
            }
        }

        // Draw sun rays with raytracing (light and shadows)
        if (this.isSunsLayerEnabled) {
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = this.canvas.width / dpr;
            const canvasHeight = this.canvas.height / dpr;
            
            this.sunRenderer.drawSunRays(
                this.ctx,
                game,
                canvasWidth,
                canvasHeight,
                this.graphicsQuality,
                this.isFancyGraphicsEnabled,
                this.worldToScreen.bind(this),
                this.worldToScreenCoords.bind(this),
                this.isWithinViewBounds.bind(this),
                this.getCachedRadialGradient.bind(this),
                this.SUN_RAY_RADIUS_BUCKET_SIZE,
                this.SUN_RAY_BLOOM_RADIUS_MULTIPLIER
            );
        }

        if (this.isSunsLayerEnabled && this.graphicsQuality === 'ultra' && !ladSun) {
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = this.canvas.width / dpr;
            const canvasHeight = this.canvas.height / dpr;
            
            this.sunRenderer.drawUltraSunParticleLayers(
                this.ctx,
                game,
                this.zoom,
                canvasWidth,
                canvasHeight,
                this.graphicsQuality,
                this.worldToScreenCoords.bind(this)
            );
        }

        // Draw lens flare effects for visible suns
        if (this.isSunsLayerEnabled) {
            for (const sun of game.suns) {
                this.drawLensFlare(sun);
            }
        }

        // Draw reworked parallax stars right behind asteroid silhouettes.
        if (this.isStarsLayerEnabled) {
            this.starfieldRenderer.drawReworkedParallaxStars(this.ctx, this.parallaxCamera, screenWidth, screenHeight, this.graphicsQuality);
        }

        // Draw asteroids (with culling - skip rendering beyond map bounds)
        if (this.isAsteroidsLayerEnabled) {
            for (const asteroid of game.asteroids) {
                // Only render asteroids within map boundaries
                if (this.isWithinRenderBounds(asteroid.position, game.mapSize, asteroid.size) &&
                    this.isWithinViewBounds(asteroid.position, asteroid.size * 2)) {
                    this.asteroidRenderer.drawAsteroid(
                        this.ctx,
                        asteroid,
                        game.suns,
                        this.zoom,
                        this.graphicsQuality,
                        this.colorScheme,
                        this.worldToScreen.bind(this),
                        this.interpolateHexColor.bind(this)
                    );
                }
            }
        }

        if (this.isSunsLayerEnabled && this.graphicsQuality === 'ultra' && !ladSun) {
            this.applyUltraWarmCoolGrade(game);
        }

        // Draw space dust particles on top of celestial environment layers.
        if (this.isSpaceDustLayerEnabled) {
            for (const particle of game.spaceDust) {
                // Only render particles within map boundaries
                if (this.isWithinRenderBounds(particle.position, game.mapSize, 10) &&
                    this.isWithinViewBounds(particle.position, 60)) {
                    this.drawSpaceDust(particle, game, viewingPlayerIndex);
                }
            }
        }

        // Draw influence circles (animated and merged by player color)
        const influenceCircles: InfluenceRenderCircle[] = [];
        const influenceDeltaTimeSec = Number.isNaN(this.influenceRadiusLastUpdateSec)
            ? 0
            : Math.max(0, game.gameTime - this.influenceRadiusLastUpdateSec);
        this.influenceRadiusLastUpdateSec = game.gameTime;

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            if (viewingPlayerIndex !== null && i !== viewingPlayerIndex) {
                continue;
            }
            if (player.isDefeated()) {
                continue;
            }

            const color = i === 0 ? this.playerColor : this.enemyColor;
            const forge = player.stellarForge;
            if (forge) {
                const forgeRadius = this.updateInfluenceRadius(forge, influenceDeltaTimeSec);
                if (forgeRadius > 0.5) {
                    influenceCircles.push({ position: forge.position, radius: forgeRadius, color });
                }
            }

            for (const building of player.buildings) {
                const buildingRadius = this.updateInfluenceRadius(building, influenceDeltaTimeSec);
                if (buildingRadius > 0.5) {
                    influenceCircles.push({ position: building.position, radius: buildingRadius, color });
                }
            }
        }

        // Draw influence circles grouped by color to render only outer merged outlines.
        const circlesByColor = new Map<string, Array<{position: Vector2D, radius: number}>>();
        for (const circle of influenceCircles) {
            if (!circlesByColor.has(circle.color)) {
                circlesByColor.set(circle.color, []);
            }
            circlesByColor.get(circle.color)!.push({position: circle.position, radius: circle.radius});
        }

        for (const [color, circles] of circlesByColor) {
            this.drawMergedInfluenceOutlines(circles, color);
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

            const color = this.getLadPlayerColor(player, ladSun, game);
            const isEnemy = this.isEnemyPlayer(player, game);

            // Draw Solar Mirrors (including enemy mirrors with visibility checks)
            for (const mirror of player.solarMirrors) {
                if (this.isWithinViewBounds(mirror.position, 120)) {
                    this.solarMirrorRenderer.drawSolarMirror(mirror, color, game, isEnemy, game.gameTime, this.getSolarMirrorRendererContext());
                }
            }

            // Draw Stellar Forge
            if (player.stellarForge) {
                if (this.isWithinViewBounds(player.stellarForge.position, player.stellarForge.radius * 3)) {
                    this.forgeRenderer.drawStellarForge(player.stellarForge, color, game, isEnemy, this.getBuildingRendererContext());
                }
            }
        }

        // Draw warp gates
        for (const gate of game.warpGates) {
            if (this.isWithinViewBounds(gate.position, Constants.WARP_GATE_RADIUS * 2)) {
                this.warpGateRenderer.drawWarpGate(gate, game, ladSun, this.getWarpGateRendererContext());
            }
        }

        // Draw starling merge gates
        for (const gate of game.starlingMergeGates) {
            if (this.isWithinViewBounds(gate.position, Constants.STARLING_MERGE_GATE_RADIUS_PX * 4)) {
                this.warpGateRenderer.drawStarlingMergeGate(gate, game, this.getWarpGateRendererContext());
            }
        }

        // Draw warp gate shockwaves
        this.updateAndDrawWarpGateShockwaves();

        // Draw merged range outlines for selected starlings before drawing units
        const unitCtx = this.getUnitRendererContext();
        this.unitRenderer.drawMergedStarlingRanges(game, unitCtx);

        // Draw units
        if (this.isUnitsLayerEnabled) {
            for (const player of game.players) {
                if (player.isDefeated()) continue;

                const color = this.getLadPlayerColor(player, ladSun, game);
                const isEnemy = this.isEnemyPlayer(player, game);

                for (const unit of player.units) {
                    const unitMargin = unit.isHero ? 120 : 60;
                    if (!this.isWithinViewBounds(unit.position, unitMargin)) {
                        continue;
                    }
                    if (unit instanceof Grave) {
                        this.unitRenderer.drawGrave(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Starling) {
                        this.unitRenderer.drawStarling(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Ray) {
                        this.unitRenderer.drawRay(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Nova) {
                        this.unitRenderer.drawNova(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof InfluenceBall) {
                        this.unitRenderer.drawInfluenceBall(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof TurretDeployer) {
                        this.unitRenderer.drawTurretDeployer(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Driller) {
                        this.unitRenderer.drawDriller(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Dagger) {
                        this.unitRenderer.drawDagger(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Beam) {
                        this.unitRenderer.drawBeam(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Spotlight) {
                        this.unitRenderer.drawSpotlight(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Mortar) {
                        this.unitRenderer.drawMortar(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Preist) {
                        this.unitRenderer.drawPreist(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Tank) {
                        this.unitRenderer.drawTank(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Sly) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx); // Use default unit drawing for Sly
                    } else if (unit instanceof Radiant) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx); // Use default unit drawing for Radiant
                    } else if (unit instanceof VelarisHero) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx); // Use default unit drawing for VelarisHero
                    } else if (unit instanceof Chrono) {
                        this.unitRenderer.drawChronoHero(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof AurumHero) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx); // Use default unit drawing for AurumHero
                    } else if (unit instanceof Splendor) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx);
                        this.projectileRenderer.drawSplendorChargeEffect(unit, this.getProjectileRendererContext());
                    } else if (unit instanceof Shadow) {
                        this.unitRenderer.drawShadow(unit, color, game, isEnemy, unitCtx);
                    } else {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx);
                    }
                }
            }
        }

        // Draw move order lines for selected starlings (single line per group)
        this.unitRenderer.drawStarlingMoveLines(game, unitCtx);

        // Draw buildings
        if (this.isBuildingsLayerEnabled) {
            for (const player of game.players) {
                if (player.isDefeated()) continue;

                const color = this.getLadPlayerColor(player, ladSun, game);
                const isEnemy = this.isEnemyPlayer(player, game);

                for (const building of player.buildings) {
                    if (!this.isWithinViewBounds(building.position, building.radius * 2)) {
                        continue;
                    }
                    if (building instanceof Minigun || building instanceof GatlingTower) {
                        this.towerRenderer.drawMinigun(building, color, game, isEnemy, this.getBuildingRendererContext());
                    } else if (building instanceof SpaceDustSwirler) {
                        this.towerRenderer.drawSpaceDustSwirler(building, color, game, isEnemy, this.getBuildingRendererContext());
                    } else if (building instanceof SubsidiaryFactory) {
                        this.foundryRenderer.drawSubsidiaryFactory(building, color, game, isEnemy, this.getBuildingRendererContext());
                    } else if (building instanceof StrikerTower) {
                        this.towerRenderer.drawStrikerTower(building, color, game, isEnemy, this.getBuildingRendererContext());
                    } else if (building instanceof LockOnLaserTower) {
                        this.towerRenderer.drawLockOnLaserTower(building, color, game, isEnemy, this.getBuildingRendererContext());
                    } else if (building instanceof ShieldTower) {
                        this.towerRenderer.drawShieldTower(building, color, game, isEnemy, this.getBuildingRendererContext());
                    }
                }
            }
        }

        // Draw projectiles and effect particles
        if (this.isProjectilesLayerEnabled) {
            const projCtx = this.getProjectileRendererContext();
            for (const flash of game.muzzleFlashes) {
                if (this.isWithinViewBounds(flash.position, 80)) {
                    this.projectileRenderer.drawMuzzleFlash(flash, projCtx);
                }
            }

            for (const casing of game.bulletCasings) {
                if (this.isWithinViewBounds(casing.position, 60)) {
                    this.projectileRenderer.drawBulletCasing(casing, projCtx);
                }
            }

            for (const bullet of game.bouncingBullets) {
                if (this.isWithinViewBounds(bullet.position, 60)) {
                    this.projectileRenderer.drawBouncingBullet(bullet, projCtx);
                }
            }

            for (const bullet of game.abilityBullets) {
                if (this.isWithinViewBounds(bullet.position, 80)) {
                    this.projectileRenderer.drawAbilityBullet(bullet, projCtx);
                }
            }

            for (const projectile of game.minionProjectiles) {
                if (this.isWithinViewBounds(projectile.position, 80)) {
                    this.projectileRenderer.drawMinionProjectile(projectile, projCtx);
                }
            }

            for (const projectile of game.mortarProjectiles) {
                if (this.isWithinViewBounds(projectile.position, 100)) {
                    this.projectileRenderer.drawMortarProjectile(projectile, projCtx);
                }
            }

            // Draw mini-motherships
            for (const mini of game.miniMotherships) {
                if (this.isWithinViewBounds(mini.position, 50)) {
                    this.projectileRenderer.drawMiniMothership(mini, projCtx);
                }
            }

            // Draw shadow decoys
            for (const decoy of game.shadowDecoys) {
                if (this.isWithinViewBounds(decoy.position, 50)) {
                    this.unitRenderer.drawShadowDecoy(decoy, unitCtx);
                }
            }

            // Draw shadow decoy particles
            for (const particle of game.shadowDecoyParticles) {
                if (this.isWithinViewBounds(particle.position, 50)) {
                    this.unitRenderer.drawShadowDecoyParticle(particle, unitCtx);
                }
            }

            // Draw mini-mothership explosions
            for (const explosion of game.miniMothershipExplosions) {
                const age = game.gameTime - explosion.timestamp;
                if (age < 0.5 && this.isWithinViewBounds(explosion.position, Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS * 2)) {
                    this.projectileRenderer.drawMiniMothershipExplosion(explosion, age, projCtx);
                }
            }

            for (const laser of game.laserBeams) {
                if (this.isWithinViewBounds(laser.startPos, 200) || this.isWithinViewBounds(laser.endPos, 200)) {
                    this.projectileRenderer.drawLaserBeam(laser, projCtx);
                }
            }

            if (this.graphicsQuality === 'high' || this.graphicsQuality === 'ultra') {
                for (const particle of game.impactParticles) {
                    if (this.isWithinViewBounds(particle.position, 120)) {
                        this.projectileRenderer.drawImpactParticle(particle, projCtx);
                    }
                }
            }

            for (const sparkle of game.sparkleParticles) {
                if (this.isWithinViewBounds(sparkle.position, 50)) {
                    this.projectileRenderer.drawSparkleParticle(sparkle, projCtx);
                }
            }

            for (const particle of game.deathParticles) {
                if (this.isWithinViewBounds(particle.position, 100)) {
                    this.projectileRenderer.drawDeathParticle(particle, game, projCtx);
                }
            }

            for (const explosion of game.strikerTowerExplosions) {
                if (this.isWithinViewBounds(explosion.position, Constants.STRIKER_TOWER_EXPLOSION_RADIUS * 2)) {
                    this.towerRenderer.drawStrikerTowerExplosion(explosion, game.gameTime - explosion.timestamp, this.getBuildingRendererContext());
                }
            }

            for (const zone of game.influenceZones) {
                if (this.isWithinViewBounds(zone.position, zone.radius)) {
                    this.projectileRenderer.drawInfluenceZone(zone, projCtx);
                }
            }

            for (const projectile of game.influenceBallProjectiles) {
                if (this.isWithinViewBounds(projectile.position, 100)) {
                    this.projectileRenderer.drawInfluenceBallProjectile(projectile, projCtx);
                }
            }

            for (const wave of game.crescentWaves) {
                if (this.isWithinViewBounds(wave.position, Constants.TANK_WAVE_WIDTH * 2)) {
                    this.projectileRenderer.drawCrescentWave(wave, projCtx);
                }
            }

            for (const slash of game.dashSlashes) {
                if (this.isWithinViewBounds(slash.position, Constants.DASH_SLASH_RADIUS * 4)) {
                    this.projectileRenderer.drawDashSlash(slash, projCtx);
                }
            }

            for (const shockwave of game.blinkShockwaves) {
                if (this.isWithinViewBounds(shockwave.position, shockwave.radius * 2)) {
                    this.projectileRenderer.drawBlinkShockwave(shockwave, projCtx);
                }
            }

            for (const freezeCircle of game.chronoFreezeCircles) {
                if (this.isWithinViewBounds(freezeCircle.position, freezeCircle.radius * 2)) {
                    this.projectileRenderer.drawChronoFreezeCircle(freezeCircle, projCtx);
                }
            }

            for (const bomb of game.novaBombs) {
                if (this.isWithinViewBounds(bomb.position, 100)) {
                    this.projectileRenderer.drawNovaBomb(bomb, projCtx);
                }
            }

            for (const bullet of game.novaScatterBullets) {
                if (this.isWithinViewBounds(bullet.position, 100)) {
                    this.projectileRenderer.drawNovaScatterBullet(bullet, projCtx);
                }
            }

            for (const bomb of game.stickyBombs) {
                if (this.isWithinViewBounds(bomb.position, 100)) {
                    this.projectileRenderer.drawStickyBomb(bomb, projCtx);
                }
            }

            for (const laser of game.stickyLasers) {
                if (this.isWithinViewBounds(laser.startPosition, 600)) {
                    this.projectileRenderer.drawStickyLaser(laser, projCtx);
                }
            }

            for (const particle of game.disintegrationParticles) {
                if (this.isWithinViewBounds(particle.position, 50)) {
                    this.projectileRenderer.drawDisintegrationParticle(particle, projCtx);
                }
            }

            // Draw Radiant orbs and laser fields
            for (const orb of game.radiantOrbs) {
                if (this.isWithinViewBounds(orb.position, orb.getRange() + 100)) {
                    this.projectileRenderer.drawRadiantOrb(orb, projCtx);
                }
            }
            
            // Draw Radiant laser fields
            for (let i = 0; i < game.radiantOrbs.length; i++) {
                for (let j = i + 1; j < game.radiantOrbs.length; j++) {
                    const orb1 = game.radiantOrbs[i];
                    const orb2 = game.radiantOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                    
                    if (distance <= maxRange) {
                        this.projectileRenderer.drawRadiantLaserField(orb1, orb2, projCtx);
                    }
                }
            }
            
            // Draw Velaris orbs and light-blocking fields
            for (const orb of game.velarisOrbs) {
                if (this.isWithinViewBounds(orb.position, orb.getRange() + 100)) {
                    this.projectileRenderer.drawVelarisOrb(orb, projCtx);
                }
            }
            
            // Draw Velaris light-blocking fields
            for (let i = 0; i < game.velarisOrbs.length; i++) {
                for (let j = i + 1; j < game.velarisOrbs.length; j++) {
                    const orb1 = game.velarisOrbs[i];
                    const orb2 = game.velarisOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                    
                    if (distance <= maxRange) {
                        this.projectileRenderer.drawVelarisLightBlockingField(orb1, orb2, game.gameTime, projCtx);
                    }
                }
            }
            
            // Draw Aurum orbs and shield fields
            for (const orb of game.aurumOrbs) {
                if (this.isWithinViewBounds(orb.position, orb.getRange() + 100)) {
                    this.projectileRenderer.drawAurumOrb(orb, projCtx);
                }
            }
            
            // Draw Aurum shield fields
            for (let i = 0; i < game.aurumOrbs.length; i++) {
                for (let j = i + 1; j < game.aurumOrbs.length; j++) {
                    const orb1 = game.aurumOrbs[i];
                    const orb2 = game.aurumOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                    
                    if (distance <= maxRange) {
                        this.projectileRenderer.drawAurumShieldField(orb1, orb2, projCtx);
                    }
                }
            }
            
            // Draw Aurum shield hit effects
            for (const hit of game.aurumShieldHits) {
                if (this.isWithinViewBounds(hit.position, 100)) {
                    this.projectileRenderer.drawAurumShieldHit(hit, projCtx);
                }
            }

            for (const sphere of game.splendorSunSpheres) {
                if (this.isWithinViewBounds(sphere.position, Constants.SPLENDOR_SUN_SPHERE_RADIUS * 4)) {
                    this.projectileRenderer.drawSplendorSunSphere(sphere, projCtx);
                }
            }

            for (const zone of game.splendorSunlightZones) {
                if (this.isWithinViewBounds(zone.position, zone.radius + 40)) {
                    this.projectileRenderer.drawSplendorSunlightZone(zone, projCtx);
                }
            }

            for (const segment of game.splendorLaserSegments) {
                if (this.isWithinViewBounds(segment.startPos, 150) || this.isWithinViewBounds(segment.endPos, 150)) {
                    this.projectileRenderer.drawSplendorLaserSegment(segment, projCtx);
                }
            }

            for (const turret of game.deployedTurrets) {
                if (this.isWithinViewBounds(turret.position, Constants.DEPLOYED_TURRET_HEALTH_BAR_SIZE * 2)) {
                    this.unitRenderer.drawDeployedTurret(turret, game, unitCtx);
                }
            }
        }

        // Draw damage numbers
        this.drawDamageNumbers(game);

        // Draw border fade to black effect
        this.drawBorderFade(game.mapSize);
        
        // Draw off-screen unit indicators
        this.drawOffScreenUnitIndicators(game);
        
        // Draw striker tower target highlighting
        this.towerRenderer.drawStrikerTowerTargetHighlighting(game, this.getBuildingRendererContext());
        
        // Draw mirror command buttons if mirrors are selected
        this.solarMirrorRenderer.drawMirrorCommandButtons(this.selectedMirrors, game.gameTime, this.getSolarMirrorRendererContext());

        // Draw warp gate placement preview if in placement mode
        this.warpGateRenderer.drawWarpGatePlacementPreview(game, this.getWarpGateRendererContext());

        // Draw UI
        this.drawUI(game);

        // Draw selection rectangle
        this.drawSelectionRectangle();

        // Draw ability arrow for hero units
        this.drawAbilityArrow();
        
        // Draw building ability arrow
        this.drawBuildingAbilityArrow();

        // Draw unit path preview
        this.drawUnitPathPreview();

        // Draw temporary path confirmation effects
        this.updateAndDrawPathCommitEffects(game.gameTime);

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
        this.uiRenderer.drawMenuButton(this.getUIRendererContext());
    }

    /**
     * Draw production progress indicator in top-right corner
     */
    private drawProductionProgress(game: GameState): void {
        this.uiRenderer.drawProductionProgress(game, this.getUIRendererContext());
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
            return 'Cyclone';
        } else if (building instanceof SubsidiaryFactory) {
            return 'Foundry';
        } else if (building instanceof StrikerTower) {
            return 'Striker Tower';
        } else if (building instanceof LockOnLaserTower) {
            return 'Lock-on Tower';
        } else if (building instanceof ShieldTower) {
            return 'Shield Tower';
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
            'beam': 'Beam',
            'spotlight': 'Spotlight',
            'splendor': 'Splendor',
            'solar-mirror': 'Solar Mirror',
            'strafe-upgrade': 'Strafe Upgrade',
            'regen-upgrade': 'Regen Upgrade',
            'attack-upgrade': '+1 ATK',
            'blink-upgrade': 'Blink Upgrade'
        };
        return nameMap[unitType.toLowerCase()] || unitType;
    }

    private getInGameMenuLayout(): InGameMenuLayout {
        return getInGameMenuLayout(this.canvas.width, this.canvas.height);
    }

    private getGraphicsMenuMaxScroll(layout: InGameMenuLayout): number {
        return getGraphicsMenuMaxScroll(this.renderLayerOptions.length, layout);
    }

    public handleInGameMenuScroll(screenX: number, screenY: number, deltaY: number): boolean {
        const result = this.uiRenderer.handleInGameMenuScroll(this.getUIRendererContext(), screenX, screenY, deltaY);
        if (result.consumed) {
            this.graphicsMenuScrollOffset = result.newScrollOffset;
        }
        return result.consumed;
    }

    public getInGameMenuAction(screenX: number, screenY: number): InGameMenuAction | null {
        return this.uiRenderer.getInGameMenuAction(this.getUIRendererContext(), screenX, screenY);
    }

    /**
     * Draw in-game menu overlay
     */
    private drawInGameMenuOverlay(): void {
        this.uiRenderer.drawInGameMenuOverlay(this.getUIRendererContext());
    }

    /**
     * Draw end-game statistics screen
     */
    private drawEndGameStatsScreen(game: GameState, winner: Player): void {
        this.uiRenderer.drawEndGameStatsScreen(game, winner, this.getUIRendererContext());
    }

    /**
     * Draw border fade effect - fades to black at map edges
     */
    private drawBorderFade(mapSize: number): void {
        this.uiRenderer.drawBorderFade(mapSize, this.getUIRendererContext());
    }

    /**
     * Set camera zoom
     */
    setZoom(zoom: number): void {
        const minZoom = this.getMinZoomForBounds();
        this.zoom = Math.max(minZoom, Math.min(2.0, zoom));
        const clampedPos = this.clampCameraToLevelBounds(this.camera);
        this.camera = new Vector2D(clampedPos.x, clampedPos.y);
        this.parallaxCamera = new Vector2D(clampedPos.x, clampedPos.y);
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
     * Trigger screen shake effect
     */
    triggerScreenShake(intensity: number = Constants.SCREEN_SHAKE_INTENSITY): void {
        if (!this.screenShakeEnabled) return;
        
        // Set shake intensity (don't override if already shaking with higher intensity)
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
        this.screenShakeTimer = Constants.SCREEN_SHAKE_DURATION;
    }

    /**
     * Update screen shake effect
     */
    updateScreenShake(deltaTime: number): void {
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer -= deltaTime;
            
            // Apply decay to shake intensity
            this.screenShakeIntensity *= Constants.SCREEN_SHAKE_DECAY;
            
            // Stop shaking when timer runs out or intensity is too low
            if (this.screenShakeTimer <= 0 || this.screenShakeIntensity < 0.1) {
                this.screenShakeIntensity = 0;
                this.screenShakeTimer = 0;
            }
        }
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

    private getMinZoomForBounds(): number {
        const dpr = window.devicePixelRatio || 1;
        const viewWidth = this.canvas.width / dpr;
        const viewHeight = this.canvas.height / dpr;
        const minZoomWidth = viewWidth / Constants.MAP_SIZE;
        const minZoomHeight = viewHeight / Constants.MAP_SIZE;
        return Math.max(0.5, minZoomWidth, minZoomHeight);
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
