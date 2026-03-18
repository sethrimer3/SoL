/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, Asteroid, Unit, Marine, Grave, Starling, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet, MinionProjectile, LaserBeam, ImpactParticle, Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, Ray, InfluenceBall, InfluenceZone, InfluenceBallProjectile, TurretDeployer, Driller, Dagger, Beam, Mortar, Preist, Spotlight, Tank, CrescentWave, Nova, NovaBomb, NovaScatterBullet, Sly, Radiant, RadiantOrb, VelarisHero, VelarisOrb, AurumHero, AurumOrb, AurumShieldHit, DashSlash, Blink, BlinkShockwave, Shadow, ShadowDecoy, ShadowDecoyParticle, Chrono, ChronoFreezeCircle, Splendor, SplendorSunSphere, SplendorSunlightZone, SplendorLaserSegment, Shroud, Occlude, OccludeShadowCone } from './game-core';
import * as Constants from './constants';
import { ColorScheme, COLOR_SCHEMES } from './menu';
import { GraphicVariant, GraphicKey, GraphicOption, graphicsOptions as defaultGraphicsOptions, InGameMenuTab, InGameMenuAction, InGameMenuLayout, RenderLayerKey, getInGameMenuLayout, getGraphicsMenuMaxScroll } from './render';

import { darkenColor, adjustColorBrightness, brightenAndPaleColor, withAlpha, interpolateHexColor } from './render/color-utilities';
import { ScreenShakeController } from './render/screen-shake';
import { getFactionColor } from './render/faction-utilities';
import { clampCameraToLevelBounds as _clampCameraToLevelBounds, getMinZoomForBounds as _getMinZoomForBounds } from './render/camera-controller';
import {
    getShadeBrightnessBoost as _getShadeBrightnessBoost,
    applyShadeBrightening as _applyShadeBrightening,
} from './render/shade-brightness';
import {
    getHeroSpritePath as _getHeroSpritePath,
    getForgeSpritePath as _getForgeSpritePath,
    getSolarMirrorSpritePath as _getSolarMirrorSpritePath,
    getStarlingSpritePath as _getStarlingSpritePath,
    getStarlingFacingRotationRad as _getStarlingFacingRotationRad,
    getProductionDisplayName as _getProductionDisplayName,
    getBuildingDisplayName as _getBuildingDisplayName,
    detectAndDrawEdges as _detectAndDrawEdges,
} from './render/asset-path-helpers';
import { SpriteManager, SpriteDrawSource, VELARIS_FORGE_GRAPHEME_SPRITE_PATHS } from './render/sprite-manager';
import { GradientCache } from './render/gradient-cache';
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
import { VisibilityAlphaTracker } from './render/visibility-alpha-tracker';
import { getCanvasScreenHeightPx, getCanvasScreenWidthPx } from './render/canvas-metrics';
import { StarfieldWorkerBridge } from './render/workers/starfield-worker-bridge';
import { SunRayWorkerBridge } from './render/workers/sun-ray-worker-bridge';
import { StarNestRenderer } from './render/star-nest-renderer';
import { GravityGridRenderer, GravityGridContext } from './render/gravity-grid-renderer';


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
    public isStarNestEnabled: boolean = false; // Star Nest flying-through-space star effect
    private readonly screenShake = new ScreenShakeController();
    get screenShakeEnabled(): boolean { return this.screenShake.isEnabled; }
    set screenShakeEnabled(value: boolean) { this.screenShake.isEnabled = value; }
    public offscreenIndicatorOpacity: number = 0.25; // Opacity for off-screen indicators
    public infoBoxOpacity: number = 0.5; // Opacity for top-right info boxes
    public infoBoxSize: number = 1.0; // Size multiplier for top-right info boxes (1.0 = 100%)
    public soundVolume: number = 1; // Sound effect volume for in-game controls
    public musicVolume: number = 1; // Music volume for in-game controls
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
    private readonly MAX_RENDER_PIXEL_RATIO = 2;
    // Skip the heaviest fancy field overlays once the physical canvas grows beyond roughly 6 MP
    // (for example, a 1080p view rendered near ~1.7 effective DPR) to protect frame rate.
    private readonly MAX_FANCY_FIELD_EFFECTS_CANVAS_PIXEL_AREA = 6_000_000;
    private readonly VELARIS_STARLING_GRAPHEME_SIZE_SCALE = 1.15;
    private readonly spriteManager = new SpriteManager();
    private starlingParticleStates = new WeakMap<Starling, {shapeBlend: number; polygonBlend: number; lastTimeSec: number; pentagonRotationRad: number}>();
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

    private readonly visibilityTracker = new VisibilityAlphaTracker();
    private influenceRadiusLastUpdateSec = Number.NaN;
    private readonly gradientCache = new GradientCache();

    // Gradient caching bucket sizes for performance optimization
    private readonly SUN_RAY_RADIUS_BUCKET_SIZE = 500; // px - bucket size for sun ray gradient caching
    private readonly SUN_RAY_BLOOM_RADIUS_MULTIPLIER = 1.1; // Bloom radius is 10% larger than ambient for softer edges
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
    private readonly UNIT_BASE_SIZE_PX = 8;
    private readonly LOW_QUALITY_SIMPLE_UNIT_LOD_THRESHOLD_RADIUS_PX = 9;
    private readonly STANDARD_SIMPLE_UNIT_LOD_THRESHOLD_RADIUS_PX = 6.5;
    private readonly FORGE_MAX_HEALTH = 1000;
    private readonly MIRROR_MAX_HEALTH = Constants.MIRROR_MAX_HEALTH;
    
    // Starfield renderer for background stars and nebula
    private readonly starfieldRenderer: StarfieldRenderer;
    private readonly starfieldWorkerBridge: StarfieldWorkerBridge | null;
    private readonly sunRayWorkerBridge: SunRayWorkerBridge | null;
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
    private readonly starNestRenderer = new StarNestRenderer();
    private readonly gravityGridRenderer = new GravityGridRenderer();
    private movementPointFramePaths: string[] = [];
    private lastAppliedGraphicsQuality: 'low' | 'medium' | 'high' | 'ultra' | null = null;
    // Device pixel ratio is dimensionless and does not use a unit suffix.
    // Viewport dimensions represent pixels, so they continue to use the Px suffix.
    private lastAppliedDevicePixelRatio = 0;
    private lastAppliedViewportWidthPx = 0;
    private lastAppliedViewportHeightPx = 0;
    private cachedDevicePixelRatio = 1;
    private cachedViewportWidthPx = 0;
    private cachedViewportHeightPx = 0;

    // Cached renderer context objects to avoid per-frame closure allocations
    private _cachedUICtx: UIRendererContext | null = null;
    private _cachedEnvCtx: EnvironmentRendererContext | null = null;
    private _cachedBuildingCtx: BuildingRendererContext | null = null;
    private _cachedMirrorCtx: SolarMirrorRendererContext | null = null;
    private _cachedWarpGateCtx: WarpGateRendererContext | null = null;
    private _cachedProjectileCtx: ProjectileRendererContext | null = null;
    private _cachedUnitCtx: UnitRendererContext | null = null;

    // Pre-bound methods to avoid per-frame .bind() allocations in rendering calls
    private readonly _boundWorldToScreen = (pos: { x: number; y: number }) => this.worldToScreen(pos as Vector2D);
    private readonly _boundWorldToScreenCoords = (x: number, y: number, out?: Vector2D) => this.worldToScreenCoords(x, y, out as Vector2D);
    private readonly _boundIsWithinViewBounds = (pos: { x: number; y: number }, margin?: number) => this.isWithinViewBounds(pos as Vector2D, margin);
    private readonly _boundGetCachedRadialGradient = (key: string, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: Array<{ offset: number; color: string }>) => this.getCachedRadialGradient(key, x0, y0, r0, x1, y1, r1, stops);
    private readonly _boundInterpolateHexColor = (startHex: string, endHex: string, t: number): string => this.interpolateHexColor(startHex, endHex, t);
    private readonly _boundDrawFancyBloom = (screenPos: Vector2D, radius: number, color: string, intensity: number) => this.drawFancyBloom(screenPos, radius, color, intensity);

    // Reusable per-frame arrays to avoid GC pressure from per-frame allocations
    private readonly _reusableVisibleSpaceDust: SpaceDustParticle[] = [];
    private readonly _reusableInfluenceCircles: InfluenceRenderCircle[] = [];
    private readonly _reusableCirclesByColor = new Map<string, Array<{position: Vector2D, radius: number}>>();
    private readonly _reusableGravityGridColorMap = new Map<Player, string>();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = context;
        this.updateViewportMetrics();
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            this.updateViewportMetrics();
            this.resizeCanvas();
        });

        // Initialize starfield renderer
        this.starfieldRenderer = new StarfieldRenderer();
        this.starfieldWorkerBridge = StarfieldWorkerBridge.isSupported()
            ? new StarfieldWorkerBridge()
            : null;
        
        // Initialize sun renderer
        this.sunRenderer = new SunRenderer();
        this.sunRayWorkerBridge = SunRayWorkerBridge.isSupported()
            ? new SunRayWorkerBridge()
            : null;

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

        for (const option of this.graphicsOptions) {
            this.graphicsOptionByKey.set(option.key, option);
            const defaultVariant: GraphicVariant = option.pngPath
                ? 'png'
                : option.svgPath
                    ? 'svg'
                    : 'stub';
            this.graphicsVariantByKey.set(option.key, defaultVariant);
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
        // Cap render DPR to reduce fill-rate pressure on high-DPI devices.
        const cappedDpr = Math.min(this.cachedDevicePixelRatio || 1, this.MAX_RENDER_PIXEL_RATIO);
        
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
        
        // Apply a second, quality-specific cap after the global safety cap above so
        // ultra/high quality on dense displays does not recreate an excessively large canvas.
        const effectiveDpr = Math.min(
            cappedDpr * resolutionScale,
            this.getMaxEffectiveRenderPixelRatioForQuality()
        );
        
        // Set canvas physical size to match display size * effective DPR
        this.canvas.width = this.cachedViewportWidthPx * effectiveDpr;
        this.canvas.height = this.cachedViewportHeightPx * effectiveDpr;
        
        // Set canvas CSS size to match window size
        this.canvas.style.width = `${this.cachedViewportWidthPx}px`;
        this.canvas.style.height = `${this.cachedViewportHeightPx}px`;
        
        // Reset transform and scale the context to match effective DPR
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(effectiveDpr, effectiveDpr);
        this.lastAppliedGraphicsQuality = this.graphicsQuality;
        this.lastAppliedDevicePixelRatio = this.cachedDevicePixelRatio;
        this.lastAppliedViewportWidthPx = this.cachedViewportWidthPx;
        this.lastAppliedViewportHeightPx = this.cachedViewportHeightPx;
    }

    private updateViewportMetrics(): void {
        this.cachedDevicePixelRatio = window.devicePixelRatio || 1;
        this.cachedViewportWidthPx = window.innerWidth;
        this.cachedViewportHeightPx = window.innerHeight;
    }

    private getViewportWidthPx(): number {
        return this.cachedViewportWidthPx;
    }

    private getViewportHeightPx(): number {
        return this.cachedViewportHeightPx;
    }

    public destroy(): void {
        this.starfieldWorkerBridge?.dispose();
        this.sunRayWorkerBridge?.dispose();
    }

    private getCanvasScreenWidthPx(): number {
        return getCanvasScreenWidthPx(this.canvas);
    }

    private getCanvasScreenHeightPx(): number {
        return getCanvasScreenHeightPx(this.canvas);
    }

    private getMaxEffectiveRenderPixelRatioForQuality(): number {
        switch (this.graphicsQuality) {
            case 'low':
                return 1;
            case 'medium':
                return 1.25;
            case 'high':
                return 1.5;
            case 'ultra':
            default:
                return 1.7;
        }
    }

    private shouldResizeCanvasForCurrentDisplay(
        devicePixelRatio: number,
        viewportWidthPx: number,
        viewportHeightPx: number
    ): boolean {
        return this.lastAppliedGraphicsQuality !== this.graphicsQuality
            || this.lastAppliedDevicePixelRatio !== devicePixelRatio
            || this.lastAppliedViewportWidthPx !== viewportWidthPx
            || this.lastAppliedViewportHeightPx !== viewportHeightPx;
    }

    private shouldSkipFancyFieldEffects(): boolean {
        return this.canvas.width * this.canvas.height > this.MAX_FANCY_FIELD_EFFECTS_CANVAS_PIXEL_AREA;
    }

    private shouldUseSimpleUnitLod(unit: Unit): boolean {
        // Keep starlings on their dedicated renderer even at far zoom/low quality.
        // The generic simple-LOD path draws legacy circles and causes visible sprite popping
        // when crossing the zoom threshold.
        if (unit instanceof Starling) {
            return false;
        }
        const baseRadiusPx = this.UNIT_BASE_SIZE_PX * this.zoom * (unit.isHero ? this.HERO_SPRITE_SCALE * 0.5 : 1);
        if (this.graphicsQuality === 'low') {
            return baseRadiusPx <= this.LOW_QUALITY_SIMPLE_UNIT_LOD_THRESHOLD_RADIUS_PX;
        }
        if (this.graphicsQuality === 'medium' || this.graphicsQuality === 'high') {
            return baseRadiusPx <= this.STANDARD_SIMPLE_UNIT_LOD_THRESHOLD_RADIUS_PX;
        }
        return false;
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPos: { x: number; y: number }): Vector2D {
        const centerX = this.getViewportWidthPx() * 0.5;
        const centerY = this.getViewportHeightPx() * 0.5;
        
        // Apply screen shake offset if enabled
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (this.screenShakeEnabled && this.screenShake.getIntensity() > 0) {
            // Random shake direction
            const angle = Math.random() * Math.PI * 2;
            shakeOffsetX = Math.cos(angle) * this.screenShake.getIntensity();
            shakeOffsetY = Math.sin(angle) * this.screenShake.getIntensity();
        }
        
        return new Vector2D(
            centerX + (worldPos.x - this.camera.x) * this.zoom + shakeOffsetX,
            centerY + (worldPos.y - this.camera.y) * this.zoom + shakeOffsetY
        );
    }

    private worldToScreenCoords(worldX: number, worldY: number, out: Vector2D): void {
        const centerX = this.getViewportWidthPx() * 0.5;
        const centerY = this.getViewportHeightPx() * 0.5;

        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (this.screenShakeEnabled && this.screenShake.getIntensity() > 0) {
            const angle = Math.random() * Math.PI * 2;
            shakeOffsetX = Math.cos(angle) * this.screenShake.getIntensity();
            shakeOffsetY = Math.sin(angle) * this.screenShake.getIntensity();
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
        const viewHalfWidth = this.getViewportWidthPx() / (2 * this.zoom);
        const viewHalfHeight = this.getViewportHeightPx() / (2 * this.zoom);

        this.viewMinX = this.camera.x - viewHalfWidth;
        this.viewMaxX = this.camera.x + viewHalfWidth;
        this.viewMinY = this.camera.y - viewHalfHeight;
        this.viewMaxY = this.camera.y + viewHalfHeight;
    }

    private isWithinViewBounds(worldPos: { x: number; y: number }, margin: number = 0): boolean {
        return worldPos.x >= this.viewMinX - margin &&
               worldPos.x <= this.viewMaxX + margin &&
               worldPos.y >= this.viewMinY - margin &&
               worldPos.y <= this.viewMaxY + margin;
    }

    /**
     * Check if screen position is within viewport bounds
     */
    private isScreenPosWithinViewBounds(screenPos: { x: number; y: number }, margin: number = 0): boolean {
        const viewportWidth = this.getViewportWidthPx();
        const viewportHeight = this.getViewportHeightPx();
        return screenPos.x >= -margin &&
               screenPos.x <= viewportWidth + margin &&
               screenPos.y >= -margin &&
               screenPos.y <= viewportHeight + margin;
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): Vector2D {
        const centerX = this.getViewportWidthPx() * 0.5;
        const centerY = this.getViewportHeightPx() * 0.5;
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
        if (!this._cachedUICtx) {
            this._cachedUICtx = {
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
                uiTimeSec: performance.now() * 0.001,
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
                infoBoxSize: this.infoBoxSize,
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
            return this._cachedUICtx;
        }
        const c = this._cachedUICtx;
        c.zoom = this.zoom;
        c.selectionStart = this.selectionStart;
        c.selectionEnd = this.selectionEnd;
        c.abilityArrowStarts = this.abilityArrowStarts;
        c.abilityArrowDirection = this.abilityArrowDirection;
        c.abilityArrowLengthPx = this.abilityArrowLengthPx;
        c.buildingAbilityArrowStart = this.buildingAbilityArrowStart;
        c.buildingAbilityArrowDirection = this.buildingAbilityArrowDirection;
        c.buildingAbilityArrowLengthPx = this.buildingAbilityArrowLengthPx;
        c.pathPreviewForge = this.pathPreviewForge;
        c.pathPreviewPoints = this.pathPreviewPoints;
        c.pathPreviewEnd = this.pathPreviewEnd;
        c.pathPreviewStartWorld = this.pathPreviewStartWorld;
        c.uiTimeSec = performance.now() * 0.001;
        c.selectedUnits = this.selectedUnits;
        c.selectedMirrors = this.selectedMirrors;
        c.highlightedButtonIndex = this.highlightedButtonIndex;
        c.showInfo = this.showInfo;
        c.showInGameMenu = this.showInGameMenu;
        c.inGameMenuTab = this.inGameMenuTab;
        c.damageDisplayMode = this.damageDisplayMode;
        c.healthDisplayMode = this.healthDisplayMode;
        c.offscreenIndicatorOpacity = this.offscreenIndicatorOpacity;
        c.infoBoxOpacity = this.infoBoxOpacity;
        c.infoBoxSize = this.infoBoxSize;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.colorblindMode = this.colorblindMode;
        c.graphicsQuality = this.graphicsQuality;
        c.isFancyGraphicsEnabled = this.isFancyGraphicsEnabled;
        c.screenShakeEnabled = this.screenShakeEnabled;
        c.soundVolume = this.soundVolume;
        c.musicVolume = this.musicVolume;
        c.graphicsMenuScrollOffset = this.graphicsMenuScrollOffset;
        c.isSunsLayerEnabled = this.isSunsLayerEnabled;
        c.isStarsLayerEnabled = this.isStarsLayerEnabled;
        c.isAsteroidsLayerEnabled = this.isAsteroidsLayerEnabled;
        c.isSpaceDustLayerEnabled = this.isSpaceDustLayerEnabled;
        c.isBuildingsLayerEnabled = this.isBuildingsLayerEnabled;
        c.isUnitsLayerEnabled = this.isUnitsLayerEnabled;
        c.isProjectilesLayerEnabled = this.isProjectilesLayerEnabled;
        c.viewingPlayer = this.viewingPlayer;
        return c;
    }
    private getEnvironmentRendererContext(): EnvironmentRendererContext {
        if (!this._cachedEnvCtx) {
            this._cachedEnvCtx = {
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
                gradientCache: this.gradientCache,
            };
            return this._cachedEnvCtx;
        }
        const c = this._cachedEnvCtx;
        c.ctx = this.ctx;
        c.canvas = this.canvas;
        c.camera = this.camera;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.isFancyGraphicsEnabled = this.isFancyGraphicsEnabled;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.viewingPlayer = this.viewingPlayer;
        c.colorblindMode = this.colorblindMode;
        return c;
    }

    private _cachedGravityGridCtx: GravityGridContext | null = null;

    private getGravityGridContext(): GravityGridContext {
        if (!this._cachedGravityGridCtx) {
            this._cachedGravityGridCtx = {
                ctx: this.ctx,
                canvas: this.canvas,
                camera: this.camera,
                zoom: this.zoom,
                graphicsQuality: this.graphicsQuality,
                playerColor: this.playerColor,
                enemyColor: this.enemyColor,
                viewingPlayer: this.viewingPlayer,
                worldToScreen: (worldPos) => this.worldToScreen(worldPos),
            };
            return this._cachedGravityGridCtx;
        }
        const c = this._cachedGravityGridCtx;
        c.ctx = this.ctx;
        c.canvas = this.canvas;
        c.camera = this.camera;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.viewingPlayer = this.viewingPlayer;
        return c;
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

    private getSpriteDrawSource(path: string): SpriteDrawSource | null {
        return this.spriteManager.getSpriteDrawSource(path);
    }

    private drawSpritePath(path: string, x: number, y: number, width: number, height: number): boolean {
        return this.spriteManager.drawSprite(this.ctx, path, x, y, width, height);
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

    public setUseSvgSprites(isEnabled: boolean): void {
        for (const option of this.graphicsOptions) {
            if (isEnabled && option.svgPath) {
                this.graphicsVariantByKey.set(option.key, 'svg');
                continue;
            }
            if (option.pngPath) {
                this.graphicsVariantByKey.set(option.key, 'png');
                continue;
            }
            if (option.svgPath) {
                this.graphicsVariantByKey.set(option.key, 'svg');
                continue;
            }
            this.graphicsVariantByKey.set(option.key, 'stub');
        }
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
        return _getForgeSpritePath(forge, (key) => this.getGraphicAssetPath(key as any));
    }

    private getSolarMirrorSpritePath(mirror: SolarMirror): string | null {
        return _getSolarMirrorSpritePath(mirror, (key) => this.getGraphicAssetPath(key as any));
    }

    private getStarlingSpritePath(starling: Starling): string | null {
        return _getStarlingSpritePath(starling);
    }

    private getStarlingFacingRotationRad(starling: Starling): number | null {
        return _getStarlingFacingRotationRad(starling);
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
        _detectAndDrawEdges(this.ctx, imageData, cropWidth, cropHeight, minX, minY, displayColor, this.graphicsQuality, this.AURUM_EDGE_ALPHA_THRESHOLD);
    }

    private getHeroSpritePath(unit: Unit): string | null {
        return _getHeroSpritePath(unit, (key) => this.getGraphicAssetPath(key as any));
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
        if (!this._cachedBuildingCtx) {
            this._cachedBuildingCtx = {
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
                drawSpritePath: (path, x, y, width, height) => this.drawSpritePath(path, x, y, width, height),
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
                shakenExplosions: this.screenShake.getShakenExplosions(),
                triggerScreenShake: (intensity) => this.triggerScreenShake(intensity),
            };
            return this._cachedBuildingCtx;
        }
        const c = this._cachedBuildingCtx;
        c.ctx = this.ctx;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.canvasWidth = this.canvas.width;
        c.canvasHeight = this.canvas.height;
        c.viewingPlayer = this.viewingPlayer;
        c.highlightedButtonIndex = this.highlightedButtonIndex;
        c.shakenExplosions = this.screenShake.getShakenExplosions();
        return c;
    }

    private getSolarMirrorRendererContext(): SolarMirrorRendererContext {
        if (!this._cachedMirrorCtx) {
            this._cachedMirrorCtx = {
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
            return this._cachedMirrorCtx;
        }
        const c = this._cachedMirrorCtx;
        c.ctx = this.ctx;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.isFancyGraphicsEnabled = this.isFancyGraphicsEnabled;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.viewingPlayer = this.viewingPlayer;
        c.isWarpGatePlacementMode = this.isWarpGatePlacementMode;
        c.canCreateWarpGateFromMirrors = this.canCreateWarpGateFromMirrors;
        c.isSelectedMirrorInSunlight = this.isSelectedMirrorInSunlight;
        c.hasSeenFoundry = this.hasSeenFoundry;
        c.hasActiveFoundry = this.hasActiveFoundry;
        c.highlightedButtonIndex = this.highlightedButtonIndex;
        return c;
    }

    private getWarpGateRendererContext(): WarpGateRendererContext {
        if (!this._cachedWarpGateCtx) {
            this._cachedWarpGateCtx = {
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
            return this._cachedWarpGateCtx;
        }
        const c = this._cachedWarpGateCtx;
        c.ctx = this.ctx;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.selectedWarpGate = this.selectedWarpGate;
        c.highlightedButtonIndex = this.highlightedButtonIndex;
        c.isWarpGatePlacementMode = this.isWarpGatePlacementMode;
        c.warpGatePreviewWorldPos = this.warpGatePreviewWorldPos;
        c.isWarpGatePreviewValid = this.isWarpGatePreviewValid;
        return c;
    }

    private getProjectileRendererContext(): ProjectileRendererContext {
        if (!this._cachedProjectileCtx) {
            this._cachedProjectileCtx = {
                ctx: this.ctx,
                zoom: this.zoom,
                graphicsQuality: this.graphicsQuality,
                worldToScreen: (worldPos) => this.worldToScreen(worldPos),
                getCachedRadialGradient: (key, x0, y0, r0, x1, y1, r1, stops) =>
                    this.getCachedRadialGradient(key, x0, y0, r0, x1, y1, r1, stops),
                drawParticleSunShadowTrail: (worldPos, screenPos, screenSize, suns, maxDistance, opacity, alphaScale) =>
                    this.drawParticleSunShadowTrail(worldPos, screenPos, screenSize, suns, maxDistance, opacity, alphaScale),
            };
            return this._cachedProjectileCtx;
        }
        const c = this._cachedProjectileCtx;
        c.ctx = this.ctx;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        return c;
    }

    private getUnitRendererContext(): UnitRendererContext {
        if (!this._cachedUnitCtx) {
            this._cachedUnitCtx = {
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
                drawUnit: (unit, color, game, isEnemy, sizeMultiplier, context, useSimpleLod) =>
                    this.unitRenderer.drawUnit(unit, color, game, isEnemy, sizeMultiplier, context, useSimpleLod),
            };
            return this._cachedUnitCtx;
        }
        const c = this._cachedUnitCtx;
        c.ctx = this.ctx;
        c.zoom = this.zoom;
        c.graphicsQuality = this.graphicsQuality;
        c.isFancyGraphicsEnabled = this.isFancyGraphicsEnabled;
        c.playerColor = this.playerColor;
        c.enemyColor = this.enemyColor;
        c.viewingPlayer = this.viewingPlayer;
        c.selectedUnits = this.selectedUnits;
        c.canvas = this.canvas;
        c.camera = this.camera;
        return c;
    }

    /**
     * Adjust color brightness by a given factor (1.0 is original color, >1.0 is brighter, <1.0 is darker)
     */
    private adjustColorBrightness(color: string, factor: number): string {
        return adjustColorBrightness(color, factor);
    }

    private getShadeBrightnessBoost(position: Vector2D, game: GameState, player: Player): number {
        return _getShadeBrightnessBoost(position, game, player);
    }

    private applyShadeBrightening(color: string, position: Vector2D, game: GameState, isInShade: boolean): string {
        return _applyShadeBrightening(color, position, game, isInShade, this.viewingPlayer);
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

    private getCachedRadialGradient(
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        return this.gradientCache.getCachedRadialGradient(this.ctx, key, x0, y0, r0, x1, y1, r1, stops);
    }

    private getCachedLinearGradient(
        key: string,
        x0: number, y0: number,
        x1: number, y1: number,
        stops: Array<{offset: number, color: string}>
    ): CanvasGradient {
        return this.gradientCache.getCachedLinearGradient(this.ctx, key, x0, y0, x1, y1, stops);
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


    private getEnemyVisibilityAlpha(entity: object, isVisible: boolean, _gameTimeSec: number): number {
        return this.visibilityTracker.getEntityVisibilityAlpha(entity, isVisible);
    }

    private getShadeGlowAlpha(entity: object, shouldGlowInShade: boolean): number {
        return this.visibilityTracker.getEntityShadeGlowAlpha(entity, shouldGlowInShade);
    }


    /**
     * Draw a unit
     */


    /**
     * Set building ability arrow direction and cache angle calculation
     */
    setBuildingAbilityArrowDirection(direction: Vector2D | null): void {
        this.buildingAbilityArrowDirection = direction;
        this.uiRenderer.setBuildingAbilityArrowDirection(direction, this.getUIRendererContext());
    }


    public createPathCommitEffect(startWorld: Vector2D, waypoints: Vector2D[], gameTimeSec: number): void {
        this.uiRenderer.createPathCommitEffect(startWorld, waypoints, gameTimeSec);
    }

    public createPathPreviewFadeEffect(startWorld: Vector2D, waypoints: Vector2D[], endWorld: Vector2D | null, gameTimeSec: number): void {
        this.uiRenderer.createPathPreviewFadeEffect(startWorld, waypoints, endWorld, gameTimeSec);
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
     * Render the entire game state
     */
    render(game: GameState): void {
        if (this.shouldResizeCanvasForCurrentDisplay(
            this.cachedDevicePixelRatio,
            this.cachedViewportWidthPx,
            this.cachedViewportHeightPx
        )) {
            this.resizeCanvas();
        }

        this.sunRenderer.clearFrameCache();

        // Use actual canvas screen-space size (CSS pixels) for all full-screen fills.
        // canvas.width/height are physical pixels and, when the context is scaled by
        // effectiveDpr (e.g. 0.75 on low quality), using them in fillRect only covers
        // ~56% of the physical canvas, leaving transparent edges that expose the page
        // background colour.
        const screenWidth = this.getCanvasScreenWidthPx();
        const screenHeight = this.getCanvasScreenHeightPx();

        // Clear canvas with color scheme background
        this.ctx.fillStyle = this.colorScheme.background;
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);

        this.updateViewBounds();
        const ladSun = game.suns.find(s => s.type === 'lad');
        this.visibilityTracker.updateFrameDelta(game.gameTime);

        const viewingPlayerIndex = this.viewingPlayer ? game.players.indexOf(this.viewingPlayer) : null;

        const uiCtx = this.getUIRendererContext();
        const envCtx = this.getEnvironmentRendererContext();

        // Draw environment stack between shadow-star overlay and influence circles.
        // Back -> Front: suns -> reworked parallax stars -> asteroids -> space dust.

        // Draw suns
        if (this.isSunsLayerEnabled) {
            for (const sun of game.suns) {
                if (this.isWithinViewBounds(sun.position, sun.radius * 12)) {
                    const sunScreenPos = this.worldToScreen(sun.position);
                    const sunScreenRadius = sun.radius * this.zoom;
                    const sunSpritePath = this.getGraphicAssetPath('centralSun');
                    const sunSprite = sunSpritePath ? this.getSpriteDrawSource(sunSpritePath) : null;
                    this.sunRenderer.drawSun(
                        this.ctx,
                        sun,
                        sunScreenPos,
                        sunScreenRadius,
                        game.gameTime,
                        this.graphicsQuality,
                        this.isFancyGraphicsEnabled,
                        this.colorScheme,
                        sunSprite,
                        this._boundDrawFancyBloom,
                        withAlpha
                    );
                }
            }
        }

        // Draw sun rays with raytracing (light and shadows)
        if (this.isSunsLayerEnabled) {
            const canvasWidth = this.getCanvasScreenWidthPx();
            const canvasHeight = this.getCanvasScreenHeightPx();
            const shouldSkipUltraParticles = !this.isSunsLayerEnabled || this.graphicsQuality !== 'ultra' || !!ladSun;

            if (this.sunRayWorkerBridge) {
                // Off-main-thread path: request a worker frame and blit when ready.
                this.sunRayWorkerBridge.requestFrame(game, {
                    cameraX: this.camera.x,
                    cameraY: this.camera.y,
                    zoomLevel: this.zoom,
                    canvasWidthPx: canvasWidth,
                    canvasHeightPx: canvasHeight,
                    viewMinX: this.viewMinX,
                    viewMinY: this.viewMinY,
                    viewMaxX: this.viewMaxX,
                    viewMaxY: this.viewMaxY,
                    graphicsQuality: this.graphicsQuality,
                    isFancyGraphicsEnabled: this.isFancyGraphicsEnabled,
                    gameTimeSec: game.gameTime,
                    sunRayRadiusBucketSize: this.SUN_RAY_RADIUS_BUCKET_SIZE,
                    sunRayBloomRadiusMultiplier: this.SUN_RAY_BLOOM_RADIUS_MULTIPLIER,
                });
                const sunRayFrame = this.sunRayWorkerBridge.getLatestFrame();
                if (sunRayFrame) {
                    const frameZoom = sunRayFrame.zoomLevel;
                    const zoomScale = frameZoom > 0 ? this.zoom / frameZoom : 1;
                    const cameraDeltaScreenX = (sunRayFrame.cameraX - this.camera.x) * this.zoom;
                    const cameraDeltaScreenY = (sunRayFrame.cameraY - this.camera.y) * this.zoom;
                    const isFrameScaleCompatible = Math.abs(zoomScale - 1) <= 0.06;
                    const isFrameCanvasCompatible = sunRayFrame.canvasWidthPx === canvasWidth
                        && sunRayFrame.canvasHeightPx === canvasHeight;
                    // Reject stale frames where the camera has panned so far that the
                    // reprojected bitmap would leave uncovered (unlit) regions of the viewport.
                    const maxAllowedShiftPx = Math.min(canvasWidth, canvasHeight) * 0.25;
                    const isFramePositionCompatible = Math.abs(cameraDeltaScreenX) <= maxAllowedShiftPx
                        && Math.abs(cameraDeltaScreenY) <= maxAllowedShiftPx;

                    if (isFrameScaleCompatible && isFrameCanvasCompatible && isFramePositionCompatible) {
                        // The sun rays use world-to-screen projection (* zoom), so this
                        // delta correctly repositions the glow over the current sun position.
                        // Removing the old 12% offset threshold eliminates the visible jump
                        // that occurred when switching between worker-frame and synchronous modes.
                        const centerX = canvasWidth * 0.5;
                        const centerY = canvasHeight * 0.5;
                        this.ctx.save();
                        this.ctx.translate(centerX + cameraDeltaScreenX, centerY + cameraDeltaScreenY);
                        this.ctx.scale(zoomScale, zoomScale);
                        this.ctx.drawImage(
                            sunRayFrame.bitmap,
                            -sunRayFrame.canvasWidthPx * 0.5,
                            -sunRayFrame.canvasHeightPx * 0.5,
                            sunRayFrame.canvasWidthPx,
                            sunRayFrame.canvasHeightPx
                        );
                        this.ctx.restore();
                    } else {
                        this.sunRenderer.drawSunRays(
                            this.ctx,
                            game,
                            canvasWidth,
                            canvasHeight,
                            this.graphicsQuality,
                            this.isFancyGraphicsEnabled,
                            this._boundWorldToScreen,
                            this._boundWorldToScreenCoords,
                            this._boundIsWithinViewBounds,
                            this._boundGetCachedRadialGradient,
                            this.SUN_RAY_RADIUS_BUCKET_SIZE,
                            this.SUN_RAY_BLOOM_RADIUS_MULTIPLIER
                        );
                    }
                } else {
                    // Fallback: synchronous render until the first worker frame arrives.
                    this.sunRenderer.drawSunRays(
                        this.ctx,
                        game,
                        canvasWidth,
                        canvasHeight,
                        this.graphicsQuality,
                        this.isFancyGraphicsEnabled,
                        this._boundWorldToScreen,
                        this._boundWorldToScreenCoords,
                        this._boundIsWithinViewBounds,
                        this._boundGetCachedRadialGradient,
                        this.SUN_RAY_RADIUS_BUCKET_SIZE,
                        this.SUN_RAY_BLOOM_RADIUS_MULTIPLIER
                    );
                    // Also render ultra particles synchronously during warm-up so they aren't
                    // missing on the first frame.
                    if (!shouldSkipUltraParticles && !this.shouldSkipFancyFieldEffects()) {
                        this.sunRenderer.drawUltraSunParticleLayers(
                            this.ctx,
                            game,
                            this.zoom,
                            canvasWidth,
                            canvasHeight,
                            this.graphicsQuality,
                            this._boundWorldToScreenCoords
                        );
                    }
                }
            } else {
                // Synchronous main-thread path (worker not supported).
                this.sunRenderer.drawSunRays(
                    this.ctx,
                    game,
                    canvasWidth,
                    canvasHeight,
                    this.graphicsQuality,
                    this.isFancyGraphicsEnabled,
                    this._boundWorldToScreen,
                    this._boundWorldToScreenCoords,
                    this._boundIsWithinViewBounds,
                    this._boundGetCachedRadialGradient,
                    this.SUN_RAY_RADIUS_BUCKET_SIZE,
                    this.SUN_RAY_BLOOM_RADIUS_MULTIPLIER
                );
                if (!shouldSkipUltraParticles && !this.shouldSkipFancyFieldEffects()) {
                    this.sunRenderer.drawUltraSunParticleLayers(
                        this.ctx,
                        game,
                        this.zoom,
                        canvasWidth,
                        canvasHeight,
                        this.graphicsQuality,
                        this._boundWorldToScreenCoords
                    );
                }
            }
        }

        const shouldSkipFancyFieldEffects = this.shouldSkipFancyFieldEffects();

        // Draw lens flare effects for visible suns
        if (this.isSunsLayerEnabled) {
            for (const sun of game.suns) {
                if (this.isWithinViewBounds(sun.position, sun.radius * 5)) {
                    const flareScreenPos = this.worldToScreen(sun.position);
                    const flareScreenRadius = sun.radius * this.zoom;
                    this.sunRenderer.drawLensFlare(
                        this.ctx,
                        sun,
                        flareScreenPos,
                        flareScreenRadius,
                        this.getViewportWidthPx(),
                        this.getViewportHeightPx(),
                        this.graphicsQuality
                    );
                }
            }
        }

        // Draw reworked parallax stars right behind asteroid silhouettes.
        if (this.isStarsLayerEnabled) {
            if (this.isStarNestEnabled) {
                const nowMs = performance.now();
                this.starNestRenderer.update(nowMs);
                this.starNestRenderer.draw(this.ctx, screenWidth, screenHeight);
            } else {
                this.starfieldWorkerBridge?.requestFrame(
                    this.parallaxCamera.x,
                    this.parallaxCamera.y,
                    screenWidth,
                    screenHeight,
                    this.graphicsQuality
                );
                const starFrame = this.starfieldWorkerBridge?.getLatestFrame();
                if (starFrame) {
                    // Draw the worker frame directly at (0,0) without any translation.
                    // The parallax stars use cameraX * parallaxFactor (not zoom) for positioning,
                    // so any zoom-based translation formula would be wrong. Since parallaxFactors
                    // range from 0.12–0.53, a 1–2 frame stale position is imperceptible.
                    // Translating the bitmap caused visible jumps when the threshold switched modes.
                    const isFrameCanvasCompatible = starFrame.screenWidthPx === screenWidth
                        && starFrame.screenHeightPx === screenHeight;

                    if (isFrameCanvasCompatible) {
                        this.ctx.drawImage(starFrame.bitmap, 0, 0, screenWidth, screenHeight);
                    } else {
                        this.starfieldRenderer.drawReworkedParallaxStars(
                            this.ctx,
                            this.parallaxCamera,
                            screenWidth,
                            screenHeight,
                            this.graphicsQuality
                        );
                    }
                } else {
                    this.starfieldRenderer.drawReworkedParallaxStars(
                        this.ctx,
                        this.parallaxCamera,
                        screenWidth,
                        screenHeight,
                        this.graphicsQuality
                    );
                }
            }
        }

        // Draw gravity-well grid behind environment objects (after parallax stars, before asteroids).
        {
            const gravityGridPlayerColorMap = this._reusableGravityGridColorMap;
            gravityGridPlayerColorMap.clear();
            for (const player of game.players) {
                if (!player.isDefeated()) {
                    gravityGridPlayerColorMap.set(player, this.getLadPlayerColor(player, ladSun, game));
                }
            }
            this.gravityGridRenderer.drawGravityGrid(game, gravityGridPlayerColorMap, this.getGravityGridContext());
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
                        this._boundWorldToScreen,
                        this._boundInterpolateHexColor
                    );
                }
            }
        }

        if (this.isSunsLayerEnabled && this.graphicsQuality === 'ultra' && !ladSun && !shouldSkipFancyFieldEffects) {
            this.environmentRenderer.applyUltraWarmCoolGrade(game, envCtx);
        }

        if (this.isFancyGraphicsEnabled && this.isStarsLayerEnabled && !shouldSkipFancyFieldEffects) {
            this.environmentRenderer.drawExperimentalFieldAtmospherics(game, screenWidth, screenHeight, envCtx);
        }

        // Draw space dust particles on top of celestial environment layers.
        if (this.isSpaceDustLayerEnabled) {
            const visibleSpaceDust = this._reusableVisibleSpaceDust;
            visibleSpaceDust.length = 0;
            for (const particle of game.spaceDust) {
                // Only render particles within map boundaries
                if (this.isWithinRenderBounds(particle.position, game.mapSize, 10) &&
                    this.isWithinViewBounds(particle.position, 60)) {
                    visibleSpaceDust.push(particle);
                }
            }
            this.environmentRenderer.drawSpaceDustBatch(
                visibleSpaceDust,
                game,
                viewingPlayerIndex,
                this.getEnvironmentRendererContext()
            );
        }

        // Draw photon particles from suns
        this.drawPhotons(game);

        // Draw influence circles (animated and merged by player color)
        const influenceCircles = this._reusableInfluenceCircles;
        influenceCircles.length = 0;
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
                const forgeRadius = this.environmentRenderer.updateInfluenceRadius(forge, influenceDeltaTimeSec);
                if (forgeRadius > 0.5) {
                    influenceCircles.push({ position: forge.position, radius: forgeRadius, color });
                }
            }

            for (const building of player.buildings) {
                const buildingRadius = this.environmentRenderer.updateInfluenceRadius(building, influenceDeltaTimeSec);
                if (buildingRadius > 0.5) {
                    influenceCircles.push({ position: building.position, radius: buildingRadius, color });
                }
            }
        }

        // Draw influence circles grouped by color to render only outer merged outlines.
        const circlesByColor = this._reusableCirclesByColor;
        circlesByColor.clear();
        for (const circle of influenceCircles) {
            let bucket = circlesByColor.get(circle.color);
            if (!bucket) {
                bucket = [];
                circlesByColor.set(circle.color, bucket);
            }
            bucket.push({position: circle.position, radius: circle.radius});
        }

        for (const [color, circles] of circlesByColor) {
            this.environmentRenderer.drawMergedInfluenceOutlines(circles, color, envCtx);
        }

        // Draw connections first (so they appear behind structures)
        for (const player of game.players) {
            if (!player.isDefeated()) {
                this.environmentRenderer.drawConnections(player, game.suns, game.asteroids, game.players, envCtx);
            }
        }

        // Draw structures
        const mirrorCtx = this.getSolarMirrorRendererContext();
        const buildingCtx = this.getBuildingRendererContext();
        const warpGateCtx = this.getWarpGateRendererContext();
        for (const player of game.players) {
            if (player.isDefeated()) continue;

            const color = this.getLadPlayerColor(player, ladSun, game);
            const isEnemy = this.isEnemyPlayer(player, game);

            // Draw Solar Mirrors (including enemy mirrors with visibility checks)
            for (const mirror of player.solarMirrors) {
                if (this.isWithinViewBounds(mirror.position, 120)) {
                    this.solarMirrorRenderer.drawSolarMirror(mirror, color, game, isEnemy, game.gameTime, mirrorCtx);
                }
            }

            // Draw Stellar Forge
            if (player.stellarForge) {
                if (this.isWithinViewBounds(player.stellarForge.position, player.stellarForge.radius * 3)) {
                    this.forgeRenderer.drawStellarForge(player.stellarForge, color, game, isEnemy, buildingCtx);
                }
            }
        }

        // Draw warp gates
        for (const gate of game.warpGates) {
            if (this.isWithinViewBounds(gate.position, Constants.WARP_GATE_RADIUS * 2)) {
                this.warpGateRenderer.drawWarpGate(gate, game, ladSun, warpGateCtx);
            }
        }

        // Draw starling merge gates
        for (const gate of game.starlingMergeGates) {
            if (this.isWithinViewBounds(gate.position, Constants.STARLING_MERGE_GATE_RADIUS_PX * 4)) {
                this.warpGateRenderer.drawStarlingMergeGate(gate, game, warpGateCtx);
            }
        }

        // Draw warp gate shockwaves
        this.uiRenderer.updateAndDrawWarpGateShockwaves(uiCtx);

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
                    const shouldUseSimpleLod = this.shouldUseSimpleUnitLod(unit);
                    if (shouldUseSimpleLod) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx, true);
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
                    } else if (unit instanceof Shroud) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx); // Use default unit drawing for Shroud
                    } else if (unit instanceof Splendor) {
                        this.unitRenderer.drawUnit(unit, color, game, isEnemy, 1.0, unitCtx);
                        this.projectileRenderer.drawSplendorChargeEffect(unit, this.getProjectileRendererContext());
                    } else if (unit instanceof Shadow) {
                        this.unitRenderer.drawShadow(unit, color, game, isEnemy, unitCtx);
                    } else if (unit instanceof Occlude) {
                        this.unitRenderer.drawOcclude(unit, color, game, isEnemy, unitCtx);
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
                        this.towerRenderer.drawMinigun(building, color, game, isEnemy, buildingCtx);
                    } else if (building instanceof SpaceDustSwirler) {
                        this.towerRenderer.drawSpaceDustSwirler(building, color, game, isEnemy, buildingCtx);
                    } else if (building instanceof SubsidiaryFactory) {
                        this.foundryRenderer.drawSubsidiaryFactory(building, color, game, isEnemy, buildingCtx);
                    } else if (building instanceof StrikerTower) {
                        this.towerRenderer.drawStrikerTower(building, color, game, isEnemy, buildingCtx);
                    } else if (building instanceof LockOnLaserTower) {
                        this.towerRenderer.drawLockOnLaserTower(building, color, game, isEnemy, buildingCtx);
                    } else if (building instanceof ShieldTower) {
                        this.towerRenderer.drawShieldTower(building, color, game, isEnemy, buildingCtx);
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

            // Draw Occlude shadow cones
            for (const cone of game.occludeShadowCones) {
                if (this.isWithinViewBounds(cone.position, cone.rangePx + 20)) {
                    this.unitRenderer.drawOccludeShadowCone(cone, unitCtx);
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
                    this.towerRenderer.drawStrikerTowerExplosion(explosion, game.gameTime - explosion.timestamp, buildingCtx);
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
                const orb1 = game.radiantOrbs[i];
                for (let j = i + 1; j < game.radiantOrbs.length; j++) {
                    const orb2 = game.radiantOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());

                    // Skip pairs where both orbs are outside the viewport
                    if (!this.isWithinViewBounds(orb1.position, maxRange) &&
                        !this.isWithinViewBounds(orb2.position, maxRange)) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    
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
                const orb1 = game.velarisOrbs[i];
                for (let j = i + 1; j < game.velarisOrbs.length; j++) {
                    const orb2 = game.velarisOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());

                    if (!this.isWithinViewBounds(orb1.position, maxRange) &&
                        !this.isWithinViewBounds(orb2.position, maxRange)) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    
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
                const orb1 = game.aurumOrbs[i];
                for (let j = i + 1; j < game.aurumOrbs.length; j++) {
                    const orb2 = game.aurumOrbs[j];
                    
                    if (orb1.owner !== orb2.owner) continue;
                    
                    const maxRange = Math.min(orb1.getRange(), orb2.getRange());

                    if (!this.isWithinViewBounds(orb1.position, maxRange) &&
                        !this.isWithinViewBounds(orb2.position, maxRange)) continue;
                    
                    const distance = orb1.position.distanceTo(orb2.position);
                    
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

            // Draw Shroud cubes (main cubes + unfolding child cubes)
            this.projectileRenderer.drawShroudCubes(game, projCtx, (pos, margin) => this.isWithinViewBounds(pos, margin));

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
        this.uiRenderer.drawDamageNumbers(game, uiCtx);

        // Draw border fade to black effect
        this.uiRenderer.drawBorderFade(game.mapSize, uiCtx);
        
        // Draw off-screen unit indicators
        this.uiRenderer.drawOffScreenUnitIndicators(game, uiCtx);
        
        // Draw striker tower target highlighting
        this.towerRenderer.drawStrikerTowerTargetHighlighting(game, buildingCtx);
        
        // Draw mirror command buttons if mirrors are selected
        this.solarMirrorRenderer.drawMirrorCommandButtons(this.selectedMirrors, game.gameTime, mirrorCtx);

        // Draw forge hero/mirror buttons if the viewing player's forge is selected
        if (this.viewingPlayer && this.viewingPlayer.stellarForge && this.viewingPlayer.stellarForge.isSelected) {
            const forge = this.viewingPlayer.stellarForge;
            if (this.isWithinViewBounds(forge.position, forge.radius * 3)) {
                const screenPos = this.worldToScreen(forge.position);
                this.uiRenderer.drawForgeButtons(forge, screenPos, this.selectedHeroNames, this.getUIRendererContext());
            }
        }

        // Draw warp gate placement preview if in placement mode
        this.warpGateRenderer.drawWarpGatePlacementPreview(game, warpGateCtx);

        // Draw UI
        this.uiRenderer.drawUI(game, uiCtx);

        // Draw selection rectangle
        this.uiRenderer.drawSelectionRectangle(uiCtx);

        // Draw ability arrow for hero units
        this.uiRenderer.drawAbilityArrow(uiCtx);
        
        // Draw building ability arrow
        this.uiRenderer.drawBuildingAbilityArrow(uiCtx);

        // Draw unit path preview
        this.uiRenderer.drawUnitPathPreview(uiCtx);

        // Draw temporary path confirmation effects
        this.uiRenderer.updateAndDrawPathCommitEffects(game.gameTime, uiCtx);

        // Draw tap and swipe visual effects
        this.uiRenderer.updateAndDrawProductionButtonWaves(uiCtx);
        this.uiRenderer.updateAndDrawTapEffects(uiCtx);
        this.uiRenderer.updateAndDrawSwipeEffects(uiCtx);

        // Check for victory
        const winner = game.checkVictoryConditions();
        if (winner) {
            this.uiRenderer.drawEndGameStatsScreen(game, winner, uiCtx);
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
            this.uiRenderer.drawMenuButton(uiCtx);
        }

        // Draw match timer (bottom-left)
        if (!game.isCountdownActive && !winner) {
            this.uiRenderer.drawMatchTimer(game, uiCtx);
        }
        
        // Draw production progress indicator (top-right)
        if (!game.isCountdownActive && !winner) {
            this.uiRenderer.drawProductionProgress(game, uiCtx);
        }
        
        // Draw in-game menu overlay if open
        if (this.showInGameMenu && !winner) {
            this.uiRenderer.drawInGameMenuOverlay(uiCtx);
        }
    }


    
    /**
     * Get display name for building type
     */
    private getBuildingDisplayName(building: Building): string {
        return _getBuildingDisplayName(building);
    }
    
    /**
     * Get display name for production unit type
     */
    private getProductionDisplayName(unitType: string): string {
        return _getProductionDisplayName(unitType);
    }

    private getInGameMenuLayout(): InGameMenuLayout {
        return getInGameMenuLayout(this.getViewportWidthPx(), this.getViewportHeightPx());
    }

    /**
     * Draw all Shroud cubes (main cubes, small cubes, and tiny cubes).
     * Main cubes are drawn as solid dark squares when moving, transitioning to translucent when stopped.
     * Child cubes animate outward from the stopped position.
     */
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
     * Set camera zoom
     */
    setZoom(zoom: number): void {
        const minZoom = this.getMinZoomForBounds();
        this.zoom = Math.max(minZoom, Math.min(Constants.CAMERA_MAX_ZOOM, zoom));
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
        this.screenShake.trigger(intensity);
    }

    /**
     * Update screen shake effect
     */
    updateScreenShake(deltaTime: number): void {
        this.screenShake.update(deltaTime);
    }

    /**
     * Clamp camera position to level boundaries
     */
    private clampCameraToLevelBounds(pos: Vector2D): Vector2D {
        return _clampCameraToLevelBounds(pos, this.getViewportWidthPx(), this.getViewportHeightPx(), this.zoom);
    }

    private getMinZoomForBounds(): number {
        return _getMinZoomForBounds(this.getViewportWidthPx(), this.getViewportHeightPx());
    }

    private interpolateHexColor(startHex: string, endHex: string, t: number): string {
        return interpolateHexColor(startHex, endHex, t);
    }

    // ─── Photon Rendering ───

    /** Cached glow canvas for photon particles (avoids per-frame radialGradient creation) */
    private _photonGlowCanvas: HTMLCanvasElement | null = null;
    private _photonGlowSize: number = 0;

    private getPhotonGlowCanvas(glowSizePx: number): HTMLCanvasElement {
        if (this._photonGlowCanvas && this._photonGlowSize === glowSizePx) {
            return this._photonGlowCanvas;
        }
        const size = glowSizePx * 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(glowSizePx, glowSizePx, 0, glowSizePx, glowSizePx, glowSizePx);
        gradient.addColorStop(0, 'rgba(255, 255, 220, 0.9)');
        gradient.addColorStop(0.3, 'rgba(255, 240, 150, 0.5)');
        gradient.addColorStop(0.7, 'rgba(255, 200, 80, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 180, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        this._photonGlowCanvas = canvas;
        this._photonGlowSize = glowSizePx;
        return canvas;
    }

    private drawPhotons(game: GameState): void {
        if (game.photons.length === 0) return;

        const glowSizePx = Math.max(8, Math.round(Constants.PHOTON_RADIUS_PX * 4 * this.zoom));
        const glowCanvas = this.getPhotonGlowCanvas(glowSizePx);
        const halfGlow = glowSizePx;
        const screenPos = new Vector2D(0, 0);

        for (const photon of game.photons) {
            if (!this.isWithinViewBounds(photon.position, 30)) continue;

            this.worldToScreenCoords(photon.position.x, photon.position.y, screenPos);

            // Draw cached glow sprite
            this.ctx.drawImage(
                glowCanvas,
                screenPos.x - halfGlow,
                screenPos.y - halfGlow
            );

            // Draw bright core
            const coreRadius = Math.max(1.5, Constants.PHOTON_RADIUS_PX * this.zoom * 0.6);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFFDE8';
            this.ctx.fill();
        }
    }
}
