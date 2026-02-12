/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, StarlingMergeGate, Asteroid, LightRay, Unit, Marine, Grave, Starling, GraveProjectile, GraveSmallParticle, GraveBlackHole, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet, MinionProjectile, LaserBeam, ImpactParticle, Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, Ray, RayBeamSegment, InfluenceBall, InfluenceZone, InfluenceBallProjectile, TurretDeployer, DeployedTurret, Driller, Dagger, DamageNumber, Beam, Mortar, Preist, HealingBombParticle, Spotlight, Tank, CrescentWave, Nova, NovaBomb, NovaScatterBullet, Sly } from './game-core';
import { SparkleParticle, DeathParticle } from './sim/entities/particles';
import * as Constants from './constants';
import { ColorScheme, COLOR_SCHEMES } from './menu';
import { GraphicVariant, GraphicKey, GraphicOption, graphicsOptions as defaultGraphicsOptions, InGameMenuTab, InGameMenuAction, InGameMenuLayout, getInGameMenuLayout, getGraphicsMenuMaxScroll } from './render';

type ForgeFlameState = {
    warmth: number;
    rotationRad: number;
    lastGameTime: number;
};

type ForgeScriptState = {
    positionsX: Float32Array;
    positionsY: Float32Array;
    velocitiesX: Float32Array;
    velocitiesY: Float32Array;
    lastGameTime: number;
};

type AurumShapeState = {
    shapes: Array<{
        size: number;
        speed: number;
        angle: number;
        offset: number;
    }>;
    lastGameTime: number;
};

type AsteroidFacet = {
    points: [Vector2D, Vector2D, Vector2D];
    centroidLocal: Vector2D;
    baseShadeFactor: number;
};

type AsteroidRenderCache = {
    facets: AsteroidFacet[];
    facetCount: number;
};

type SunRenderCache = {
    plasmaLayerA: HTMLCanvasElement;
    plasmaLayerB: HTMLCanvasElement;
    shaftTextureOuter: HTMLCanvasElement;
    shaftTextureInner: HTMLCanvasElement;
};

type UnitGlowRenderCache = {
    texture: HTMLCanvasElement;
    radiusPx: number;
};

type ShadowQuad = {
    sv1x: number;
    sv1y: number;
    sv2x: number;
    sv2y: number;
    ss1x: number;
    ss1y: number;
    ss2x: number;
    ss2y: number;
};

type ShadowOccluder = {
    position: Vector2D;
    rotationRad: number;
    sizeWorld: number;
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
    private tapEffects: Array<{position: Vector2D, progress: number}> = [];
    private swipeEffects: Array<{start: Vector2D, end: Vector2D, progress: number}> = [];
    private warpGateShockwaves: Array<{position: Vector2D, progress: number}> = [];
    private productionButtonWaves: Array<{position: Vector2D, progress: number}> = [];
    private pathCommitEffects: Array<{
        pointsWorld: Vector2D[];
        startTimeSec: number;
        durationSec: number;
    }> = [];
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
    private screenShakeIntensity: number = 0; // Current screen shake intensity
    private screenShakeTimer: number = 0; // Screen shake timer
    private shakenExplosions: WeakSet<any> = new WeakSet(); // Track which explosions have triggered screen shake
    public colorblindMode: boolean = true; // Colorblind mode - shows enemies as diamonds instead of circles

    private readonly HERO_SPRITE_SCALE = 4.2;
    private readonly FORGE_SPRITE_SCALE = 2.64;
    private readonly AURUM_EDGE_DETECTION_FILL_COLOR = 'white'; // Color used for edge detection in Aurum outline rendering
    private readonly AURUM_EDGE_ALPHA_THRESHOLD = 128; // Alpha threshold for detecting filled pixels in edge detection
    private readonly AURUM_SEED_BASE_MULTIPLIER = 1000; // Base multiplier for generating pseudo-random seeds from position
    private readonly AURUM_FORGE_SEED_MULTIPLIER = 137.5; // Prime-like multiplier for pseudo-random shape distribution
    private readonly AURUM_FOUNDRY_SEED_MULTIPLIER = 157.3; // Prime-like multiplier for pseudo-random shape distribution
    private readonly VELARIS_FORGE_PARTICLE_COUNT = 180;
    private readonly VELARIS_FORGE_PARTICLE_SPEED_UNITS_PER_SEC = 0.28;
    private readonly VELARIS_FORGE_PARTICLE_RADIUS_PX = 1.6;
    private readonly VELARIS_FORGE_SCRIPT_SCALE = 1.15;
    private readonly VELARIS_FORGE_MAIN_GRAPHEME_LETTER = 'V';
    private readonly VELARIS_FORGE_MAIN_GRAPHEME_SCALE = 2.05;
    private readonly VELARIS_FOUNDRY_GRAPHEME_LETTER = 'F';
    private readonly VELARIS_FOUNDRY_PARTICLE_COUNT = 26;
    private readonly VELARIS_FOUNDRY_PARTICLE_RADIUS_PX = 1.2;
    private readonly VELARIS_FOUNDRY_PARTICLE_ORBIT_SPEED_RAD_PER_SEC = 0.8;
    private readonly VELARIS_WARP_GATE_PARTICLE_COUNT = 120;
    private readonly VELARIS_WARP_GATE_PARTICLE_BASE_SPEED = 0.55;
    private readonly VELARIS_WARP_GATE_PARTICLE_SWIRL_TIGHTNESS = 2.4;
    private readonly VELARIS_WARP_GATE_PARTICLE_CENTER_FADE = 0.18;
    private readonly VELARIS_FORGE_GRAPHEME_SPRITE_PATHS = [
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-A.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-B.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-C.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-D.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-E.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-F.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-G.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-H.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-I.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-J.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-K.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-L.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-M.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-N.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-O.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-P.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Q.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-R.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-S.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-T.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-U.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-V.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-W.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-X.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Y.png',
        'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Z.png'
    ];
    private readonly VELARIS_MIRROR_WORD = 'VELARIS';
    private readonly VELARIS_MIRROR_CLOUD_GLYPH_COUNT = 18;
    private readonly VELARIS_MIRROR_CLOUD_PARTICLE_COUNT = 12;
    private readonly VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT = 10;
    private lightingLayerCanvas: HTMLCanvasElement | null = null;
    private lightingLayerCtx: CanvasRenderingContext2D | null = null;
    private readonly VELARIS_MIRROR_PARTICLE_TIME_SCALE = 0.35;
    private readonly VELARIS_MIRROR_PARTICLE_DRIFT_SPEED = 0.7;
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
    private spriteImageCache = new Map<string, HTMLImageElement>();
    private tintedSpriteCache = new Map<string, HTMLCanvasElement>();
    private graphemeMaskCache = new Map<string, ImageData>();
    private forgeFlameStates = new Map<StellarForge, ForgeFlameState>();
    private velarisForgeScriptStates = new Map<StellarForge, ForgeScriptState>();
    private starlingParticleStates = new WeakMap<Starling, {shapeBlend: number; polygonBlend: number; lastTimeSec: number}>();
    private starlingParticleSeeds = new WeakMap<Starling, number>();
    private velarisMirrorSeeds = new WeakMap<SolarMirror, number>();
    private velarisFoundrySeeds = new WeakMap<SubsidiaryFactory, number>();
    private aurumForgeShapeStates = new WeakMap<StellarForge, AurumShapeState>();
    private aurumFoundryShapeStates = new WeakMap<SubsidiaryFactory, AurumShapeState>();
    private aurumOffscreenCanvas: HTMLCanvasElement | null = null;
    private velarisWarpGateSeeds = new WeakMap<WarpGate, number>();
    private solEnergyIcon: HTMLImageElement | null = null; // Cached SoL energy icon
    private viewMinX: number = 0;
    private viewMaxX: number = 0;
    private viewMinY: number = 0;
    private viewMaxY: number = 0;
    private graphicsOptionByKey = new Map<GraphicKey, GraphicOption>();
    private graphicsVariantByKey = new Map<GraphicKey, GraphicVariant>();
    private graphicsMenuScrollOffset = 0;
    private sunRayScreenPosA = new Vector2D(0, 0);
    private sunRayScreenPosB = new Vector2D(0, 0);
    private sunRayScreenPosC = new Vector2D(0, 0);
    private sunRayScreenPosD = new Vector2D(0, 0);
    private asteroidRenderCache = new WeakMap<Asteroid, AsteroidRenderCache>();
    private sunRenderCacheByRadiusBucket = new Map<number, SunRenderCache>();
    private unitGlowRenderCache = new Map<string, UnitGlowRenderCache>();
    private enemyVisibilityAlpha = new WeakMap<object, number>();
    private shadeGlowAlphaByEntity = new WeakMap<object, number>();
    private enemyVisibilityLastUpdateSec = Number.NaN;
    private enemyVisibilityFrameDeltaSec = 0;

    private readonly ASTEROID_RIM_HIGHLIGHT_WIDTH = 5;
    private readonly ASTEROID_RIM_SHADOW_WIDTH = 4;
    private readonly ULTRA_SUN_BLOOM_STEPS = 4;
    private readonly ULTRA_SOLAR_EMBER_COUNT = 96;
    private readonly ULTRA_LIGHT_DUST_COUNT = 180;
    private readonly ENEMY_VISIBILITY_FADE_SPEED_PER_SEC = 20;
    private readonly SHADE_GLOW_FADE_IN_SPEED_PER_SEC = 4.2;
    private readonly SHADE_GLOW_FADE_OUT_SPEED_PER_SEC = 6.5;
    private readonly ASTEROID_SHADOW_COLOR = 'rgba(13, 10, 25, 0.86)';
    private readonly UNIT_GLOW_ALPHA = 0.2;

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
    
    // Parallax star layers for depth
    private starLayers: Array<{
        stars: Array<{
            x: number,
            y: number,
            coreSize: number,
            haloSize: number,
            brightness: number,
            colorRgb: [number, number, number],
            flickerFreqHz: number,
            flickerPhase: number,
            flickerAmp: number,
            blurPx: number,
            chromaOffsetPx: number,
            isChromatic: boolean
        }>,
        parallaxFactor: number,
        brightnessScale: number,
        blurVariance: number
    }> = [];
    private readonly starColorTemperatureLut = this.createStarTemperatureLookup();
    private starfieldCacheCanvas: HTMLCanvasElement | null = null;
    private starfieldCacheCtx: CanvasRenderingContext2D | null = null;
    private starfieldCacheWidth = 0;
    private starfieldCacheHeight = 0;
    private starfieldCacheCameraX = Number.NaN;
    private starfieldCacheCameraY = Number.NaN;
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
        
        // Initialize star layers with random positions
        this.initializeStarLayers();

        const defaultPngKeys: GraphicKey[] = ['stellarForge', 'solarMirror'];
        for (const option of this.graphicsOptions) {
            this.graphicsOptionByKey.set(option.key, option);
            const defaultVariant: GraphicVariant = option.svgPath ? 'svg' : option.pngPath ? 'png' : 'stub';
            const shouldPreferPng = defaultPngKeys.includes(option.key) && option.pngPath;
            this.graphicsVariantByKey.set(option.key, shouldPreferPng ? 'png' : defaultVariant);
        }

        for (let frameIndex = 1; frameIndex <= Constants.MOVEMENT_POINT_ANIMATION_FRAME_COUNT; frameIndex++) {
            this.movementPointFramePaths.push(
                `ASSETS/sprites/interface/movementPointAnimation/movementPoint_frame${frameIndex}.png`
            );
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
     * Initialize star layers with clustered, power-law-distributed stars for realistic depth.
     */
    private initializeStarLayers(): void {
        let seed = 42;
        const seededRandom = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        const minSpacing = 5;
        const gridCell = minSpacing / Math.SQRT2;
        const gridSize = Math.ceil(Constants.STAR_WRAP_SIZE / gridCell);

        for (const layerConfig of Constants.STAR_LAYER_CONFIGS) {
            const stars: Array<{
                x: number,
                y: number,
                coreSize: number,
                haloSize: number,
                brightness: number,
                colorRgb: [number, number, number],
                flickerFreqHz: number,
                flickerPhase: number,
                flickerAmp: number,
                blurPx: number,
                chromaOffsetPx: number,
                isChromatic: boolean
            }> = [];

            const grid = new Int32Array(gridSize * gridSize).fill(-1);
            const noiseScale = 0.004 + seededRandom() * 0.006;
            let attempts = 0;
            const maxAttempts = layerConfig.count * 22;

            while (stars.length < layerConfig.count && attempts < maxAttempts) {
                attempts++;
                const x = seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2;
                const y = seededRandom() * Constants.STAR_WRAP_SIZE - Constants.STAR_WRAP_SIZE / 2;

                const density = this.fractalNoise2D((x + Constants.STAR_WRAP_SIZE * 0.5) * noiseScale, (y + Constants.STAR_WRAP_SIZE * 0.5) * noiseScale, 4);
                const ridge = Math.abs(this.valueNoise2D(x * noiseScale * 0.35 + 19.2, y * noiseScale * 0.35 - 7.1) * 2 - 1);
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

                const baseSize = this.samplePowerLawSize(layerConfig.sizeRange[0], layerConfig.sizeRange[1], 1.85, seededRandom());
                const luminance = 0.16 + Math.pow(seededRandom(), 2.1) * 0.84;
                const kelvin = this.sampleStarTemperatureK(seededRandom());
                const color = this.starColorTemperatureLut[Math.max(0, Math.min(this.starColorTemperatureLut.length - 1, Math.round((kelvin - 3000) / 50)))];
                const brightness = Math.min(1.4, (luminance * (0.85 + clusterBias * 0.45)) * layerConfig.brightnessScale);
                const isChromatic = baseSize > 2.4 && brightness > 1.02 && seededRandom() > 0.55;

                stars.push({
                    x,
                    y,
                    coreSize: baseSize,
                    haloSize: baseSize * (2.8 + seededRandom() * 2.4),
                    brightness,
                    colorRgb: color,
                    flickerFreqHz: 0.1 + seededRandom() * 0.2,
                    flickerPhase: seededRandom() * Math.PI * 2,
                    flickerAmp: 0.008 + seededRandom() * 0.022,
                    blurPx: layerConfig.blurVariance * (0.18 + seededRandom() * 0.55),
                    chromaOffsetPx: isChromatic ? (0.12 + seededRandom() * 0.25) : 0,
                    isChromatic
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

    private samplePowerLawSize(minSize: number, maxSize: number, alpha: number, randomSample: number): number {
        const safeR = Math.max(0.000001, Math.min(0.999999, randomSample));
        const size = minSize * Math.pow(1 - safeR, -1 / alpha);
        return Math.min(maxSize, size);
    }

    private sampleStarTemperatureK(randomSample: number): number {
        const warmWhiteBand = 4500 + Math.pow(randomSample, 0.75) * 1500;
        if (randomSample < 0.82) {
            return warmWhiteBand;
        }
        return 6000 + Math.pow((randomSample - 0.82) / 0.18, 1.6) * 2600;
    }

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

    private valueNoise2D(x: number, y: number): number {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;

        const smooth = (v: number) => v * v * (3 - 2 * v);
        const hash = (hx: number, hy: number) => {
            let n = hx * 374761393 + hy * 668265263;
            n = (n ^ (n >> 13)) * 1274126177;
            n ^= n >> 16;
            return (n >>> 0) / 4294967295;
        };
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

        const v00 = hash(ix, iy);
        const v10 = hash(ix + 1, iy);
        const v01 = hash(ix, iy + 1);
        const v11 = hash(ix + 1, iy + 1);
        const ux = smooth(fx);
        const uy = smooth(fy);

        return lerp(lerp(v00, v10, ux), lerp(v01, v11, ux), uy);
    }

    private fractalNoise2D(x: number, y: number, octaves: number): number {
        let amplitude = 0.5;
        let frequency = 1;
        let value = 0;
        let norm = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.valueNoise2D(x * frequency, y * frequency) * amplitude;
            norm += amplitude;
            frequency *= 2;
            amplitude *= 0.5;
        }

        return value / Math.max(0.0001, norm);
    }


    private drawStarfield(screenWidth: number, screenHeight: number): void {
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

        const cameraX = this.parallaxCamera.x;
        const cameraY = this.parallaxCamera.y;
        const nowSeconds = performance.now() * 0.001;
        const needsRefresh = cameraX !== this.starfieldCacheCameraX ||
            cameraY !== this.starfieldCacheCameraY ||
            this.starfieldCacheWidth !== screenWidth ||
            this.starfieldCacheHeight !== screenHeight;

        if (needsRefresh) {
            const ctx = this.starfieldCacheCtx;
            const centerX = screenWidth / 2;
            const centerY = screenHeight / 2;
            const wrapSpanX = centerX * 2 + Constants.STAR_WRAP_SIZE;
            const wrapSpanY = centerY * 2 + Constants.STAR_WRAP_SIZE;

            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, screenWidth, screenHeight);

            // Ultra-subtle nebulosity using large-scale noise for perceived depth.
            const nebulaGradient = ctx.createLinearGradient(0, 0, screenWidth, screenHeight);
            nebulaGradient.addColorStop(0, 'rgba(54, 38, 90, 0.035)');
            nebulaGradient.addColorStop(0.5, 'rgba(28, 50, 92, 0.025)');
            nebulaGradient.addColorStop(1, 'rgba(72, 34, 58, 0.03)');
            ctx.fillStyle = nebulaGradient;
            ctx.fillRect(0, 0, screenWidth, screenHeight);

            ctx.globalCompositeOperation = 'lighter';

            for (const layer of this.starLayers) {
                const parallaxX = cameraX * layer.parallaxFactor;
                const parallaxY = cameraY * layer.parallaxFactor;

                for (const star of layer.stars) {
                    const screenX = centerX + (star.x - parallaxX);
                    const screenY = centerY + (star.y - parallaxY);
                    const wrappedX = ((screenX + centerX) % wrapSpanX) - centerX;
                    const wrappedY = ((screenY + centerY) % wrapSpanY) - centerY;

                    if (wrappedX >= -140 && wrappedX <= screenWidth + 140 &&
                        wrappedY >= -140 && wrappedY <= screenHeight + 140) {
                        const flicker = 1 + star.flickerAmp * Math.sin(nowSeconds * Math.PI * 2 * star.flickerFreqHz + star.flickerPhase);
                        const intensity = star.brightness * flicker;
                        const [r, g, b] = star.colorRgb;

                        const haloGradient = ctx.createRadialGradient(wrappedX, wrappedY, 0, wrappedX, wrappedY, star.haloSize);
                        // Gaussian-like smooth energy distribution: fast core decay + long soft bloom tail.
                        haloGradient.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, ${Math.min(0.78, intensity * 0.27)})`);
                        haloGradient.addColorStop(0.16, `rgba(${r}, ${g}, ${b}, ${Math.min(0.42, intensity * 0.16)})`);
                        haloGradient.addColorStop(0.38, `rgba(${r}, ${g}, ${b}, ${Math.min(0.19, intensity * 0.08)})`);
                        haloGradient.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, ${Math.min(0.07, intensity * 0.026)})`);
                        haloGradient.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.filter = `blur(${star.blurPx}px)`;
                        ctx.fillStyle = haloGradient;
                        ctx.beginPath();
                        ctx.arc(wrappedX, wrappedY, star.haloSize, 0, Math.PI * 2);
                        ctx.fill();

                        const coreGradient = ctx.createRadialGradient(wrappedX, wrappedY, 0, wrappedX, wrappedY, Math.max(0.9, star.coreSize * 1.12));
                        coreGradient.addColorStop(0.0, `rgba(255,255,255,${Math.min(0.95, intensity * 0.85)})`);
                        coreGradient.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, ${Math.min(0.88, intensity * 0.72)})`);
                        coreGradient.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, ${Math.min(0.2, intensity * 0.12)})`);
                        coreGradient.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.filter = 'none';
                        ctx.fillStyle = coreGradient;
                        ctx.beginPath();
                        ctx.arc(wrappedX, wrappedY, Math.max(0.5, star.coreSize), 0, Math.PI * 2);
                        ctx.fill();

                        if (star.isChromatic) {
                            const c = star.chromaOffsetPx;
                            ctx.globalAlpha = Math.min(0.24, intensity * 0.18);
                            ctx.fillStyle = `rgba(${Math.min(255, r + 20)}, ${Math.max(0, g - 4)}, ${Math.max(0, b - 8)}, 1)`;
                            ctx.beginPath();
                            ctx.arc(wrappedX - c, wrappedY, Math.max(0.3, star.coreSize * 0.38), 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = `rgba(${Math.max(0, r - 12)}, ${Math.max(0, g - 10)}, ${Math.min(255, b + 28)}, 1)`;
                            ctx.beginPath();
                            ctx.arc(wrappedX + c, wrappedY, Math.max(0.3, star.coreSize * 0.34), 0, Math.PI * 2);
                            ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                    }
                }
            }

            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
            this.starfieldCacheCameraX = cameraX;
            this.starfieldCacheCameraY = cameraY;
        }

        this.ctx.drawImage(this.starfieldCacheCanvas, 0, 0, screenWidth, screenHeight);
    }

    private drawShadowStarfieldOverlay(game: GameState): void {
        if (!this.starfieldCacheCanvas || game.suns.length === 0) {
            return;
        }

        this.ctx.save();
        this.ctx.beginPath();

        let hasShadowGeometry = false;
        for (const sun of game.suns) {
            const shadowQuads = this.buildSunShadowQuads(sun, game);
            for (const quad of shadowQuads) {
                hasShadowGeometry = true;
                this.ctx.moveTo(quad.sv1x, quad.sv1y);
                this.ctx.lineTo(quad.sv2x, quad.sv2y);
                this.ctx.lineTo(quad.ss2x, quad.ss2y);
                this.ctx.lineTo(quad.ss1x, quad.ss1y);
                this.ctx.closePath();
            }
        }

        if (!hasShadowGeometry) {
            this.ctx.restore();
            return;
        }

        this.ctx.clip();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = this.graphicsQuality === 'ultra' ? 0.82 : 0.68;

        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        this.ctx.drawImage(this.starfieldCacheCanvas, 0, 0, screenWidth, screenHeight);
        this.ctx.restore();
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
            case Faction.VELARIS:
                return '#9C27B0'; // Purple
            default:
                return '#FFFFFF';
        }
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

    /**
     * Get the cached SoL energy icon
     */
    private getSolEnergyIcon(): HTMLImageElement {
        if (!this.solEnergyIcon) {
            this.solEnergyIcon = this.getSpriteImage('ASSETS/sprites/interface/SoL_icon.png');
        }
        return this.solEnergyIcon;
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

    private getVelarisGraphemeSpritePath(letter: string): string | null {
        if (!letter) {
            return null;
        }
        const upper = letter.toUpperCase();
        const index = upper.charCodeAt(0) - 65;
        if (index < 0 || index >= this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS.length) {
            return null;
        }
        return this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS[index];
    }

    private getGraphemeMaskData(spritePath: string): ImageData | null {
        const resolvedPath = this.resolveAssetPath(spritePath);
        const cached = this.graphemeMaskCache.get(resolvedPath);
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
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.graphemeMaskCache.set(resolvedPath, imageData);
        return imageData;
    }

    private isPointInsideGraphemeMask(x: number, y: number, mask: ImageData): boolean {
        const width = mask.width;
        const height = mask.height;
        const sampleX = Math.round((x + 0.5) * (width - 1));
        const sampleY = Math.round((y + 0.5) * (height - 1));
        if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
            return false;
        }
        const alpha = mask.data[(sampleY * width + sampleX) * 4 + 3];
        return alpha > 24;
    }

    private drawVelarisGraphemeSprite(
        spritePath: string,
        centerX: number,
        centerY: number,
        targetSize: number,
        color: string
    ): boolean {
        const tintedSprite = this.getTintedSprite(spritePath, color);
        if (!tintedSprite) {
            return false;
        }
        const scale = targetSize / Math.max(tintedSprite.width, tintedSprite.height);
        const drawWidth = tintedSprite.width * scale;
        const drawHeight = tintedSprite.height * scale;
        this.ctx.drawImage(
            tintedSprite,
            centerX - drawWidth / 2,
            centerY - drawHeight / 2,
            drawWidth,
            drawHeight
        );
        return true;
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

    private getVelarisForgeScriptState(forge: StellarForge, gameTime: number): ForgeScriptState {
        let state = this.velarisForgeScriptStates.get(forge);
        if (state) {
            return state;
        }

        const count = this.VELARIS_FORGE_PARTICLE_COUNT;
        const positionsX = new Float32Array(count);
        const positionsY = new Float32Array(count);
        const velocitiesX = new Float32Array(count);
        const velocitiesY = new Float32Array(count);
        const mainGraphemePath = this.getVelarisGraphemeSpritePath(this.VELARIS_FORGE_MAIN_GRAPHEME_LETTER);
        const mask = mainGraphemePath ? this.getGraphemeMaskData(mainGraphemePath) : null;

        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let sampleX = 0;
            let sampleY = 0;
            while (attempts < 40) {
                sampleX = Math.random() - 0.5;
                sampleY = Math.random() - 0.5;
                if (!mask || this.isPointInsideGraphemeMask(sampleX, sampleY, mask)) {
                    break;
                }
                attempts++;
            }
            positionsX[i] = sampleX;
            positionsY[i] = sampleY;

            const angleRad = Math.random() * Math.PI * 2;
            const speed = this.VELARIS_FORGE_PARTICLE_SPEED_UNITS_PER_SEC
                * (0.6 + Math.random() * 0.8);
            velocitiesX[i] = Math.cos(angleRad) * speed;
            velocitiesY[i] = Math.sin(angleRad) * speed;
        }

        state = {
            positionsX,
            positionsY,
            velocitiesX,
            velocitiesY,
            lastGameTime: gameTime
        };
        this.velarisForgeScriptStates.set(forge, state);
        return state;
    }

    private updateVelarisForgeParticles(state: ForgeScriptState, deltaTimeSec: number, mask: ImageData | null): void {
        if (deltaTimeSec <= 0) {
            return;
        }

        const count = state.positionsX.length;
        for (let i = 0; i < count; i++) {
            const oldX = state.positionsX[i];
            const oldY = state.positionsY[i];
            let newX = oldX + state.velocitiesX[i] * deltaTimeSec;
            let newY = oldY + state.velocitiesY[i] * deltaTimeSec;

            const isOutsideMask = mask
                ? !this.isPointInsideGraphemeMask(newX, newY, mask)
                : Math.abs(newX) > 0.5 || Math.abs(newY) > 0.5;
            if (isOutsideMask) {
                state.velocitiesX[i] = -state.velocitiesX[i];
                state.velocitiesY[i] = -state.velocitiesY[i];
                newX = oldX + state.velocitiesX[i] * deltaTimeSec;
                newY = oldY + state.velocitiesY[i] * deltaTimeSec;

                const isStillOutside = mask
                    ? !this.isPointInsideGraphemeMask(newX, newY, mask)
                    : Math.abs(newX) > 0.5 || Math.abs(newY) > 0.5;
                if (isStillOutside) {
                    if (mask) {
                        let attempts = 0;
                        let sampleX = oldX;
                        let sampleY = oldY;
                        while (attempts < 20) {
                            sampleX = Math.random() - 0.5;
                            sampleY = Math.random() - 0.5;
                            if (this.isPointInsideGraphemeMask(sampleX, sampleY, mask)) {
                                break;
                            }
                            attempts++;
                        }
                        newX = sampleX;
                        newY = sampleY;
                    } else {
                        newX = oldX;
                        newY = oldY;
                    }
                }
            }

            state.positionsX[i] = newX;
            state.positionsY[i] = newY;
        }
    }

    private drawVelarisForgeScript(
        forge: StellarForge,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean
    ): void {
        const scriptScale = size * this.VELARIS_FORGE_SCRIPT_SCALE;
        const mainGraphemePath = this.getVelarisGraphemeSpritePath(this.VELARIS_FORGE_MAIN_GRAPHEME_LETTER);
        const graphemeMask = mainGraphemePath ? this.getGraphemeMaskData(mainGraphemePath) : null;
        const state = this.getVelarisForgeScriptState(forge, gameTime);
        const deltaTimeSec = Math.min(0.05, Math.max(0, gameTime - state.lastGameTime));
        state.lastGameTime = gameTime;
        this.updateVelarisForgeParticles(state, deltaTimeSec, graphemeMask);

        const particleRadius = Math.max(1, this.VELARIS_FORGE_PARTICLE_RADIUS_PX * this.zoom);
        const baseAlpha = shouldDim ? 0.45 : 0.75;
        const outlineAlpha = shouldDim ? 0.5 : 0.8;
        const graphemeSize = scriptScale * this.VELARIS_FORGE_MAIN_GRAPHEME_SCALE;

        if (mainGraphemePath) {
            this.ctx.save();
            this.ctx.globalAlpha = outlineAlpha;
            this.drawVelarisGraphemeSprite(
                mainGraphemePath,
                screenPos.x,
                screenPos.y,
                graphemeSize,
                displayColor
            );
            this.ctx.restore();
        }

        this.ctx.save();
        this.ctx.globalAlpha = baseAlpha;
        this.ctx.fillStyle = displayColor;
        const count = state.positionsX.length;
        for (let i = 0; i < count; i++) {
            const x = screenPos.x + state.positionsX[i] * graphemeSize;
            const y = screenPos.y + state.positionsY[i] * graphemeSize;
            this.ctx.beginPath();
            this.ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        this.ctx.restore();
    }

    private drawVelarisFoundrySigil(
        foundry: SubsidiaryFactory,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean
    ): void {
        const graphemePath = this.getVelarisGraphemeSpritePath(this.VELARIS_FOUNDRY_GRAPHEME_LETTER);
        const graphemeSize = size * 1.55;
        const particleRadius = Math.max(1, this.VELARIS_FOUNDRY_PARTICLE_RADIUS_PX * this.zoom);
        const isProducing = Boolean(foundry.currentProduction);
        const speedMultiplier = isProducing ? 2.6 : 1;
        const orbitSpeed = this.VELARIS_FOUNDRY_PARTICLE_ORBIT_SPEED_RAD_PER_SEC * speedMultiplier;
        const seed = this.getVelarisFoundrySeed(foundry);
        const twoPi = Math.PI * 2;
        const orbitRadiusBase = graphemeSize * 0.62;
        const glyphAlpha = shouldDim ? 0.5 : 0.85;
        const particleAlpha = shouldDim ? 0.35 : 0.7;

        if (graphemePath) {
            this.ctx.save();
            this.ctx.globalAlpha = glyphAlpha;
            this.drawVelarisGraphemeSprite(graphemePath, screenPos.x, screenPos.y, graphemeSize, displayColor);
            this.ctx.restore();
        }

        this.ctx.save();
        this.ctx.globalAlpha = particleAlpha;
        this.ctx.fillStyle = displayColor;
        for (let i = 0; i < this.VELARIS_FOUNDRY_PARTICLE_COUNT; i++) {
            const baseAngle = this.getPseudoRandom(seed + i * 1.37) * twoPi;
            const orbitRadius = orbitRadiusBase * (0.75 + this.getPseudoRandom(seed + i * 2.11) * 0.4);
            const angle = baseAngle + gameTime * orbitSpeed + this.getPseudoRandom(seed + i * 3.07) * 0.5;
            const x = screenPos.x + Math.cos(angle) * orbitRadius;
            const y = screenPos.y + Math.sin(angle) * orbitRadius;
            this.ctx.beginPath();
            this.ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    private drawVelarisWarpGateVortex(
        gate: WarpGate,
        screenPos: Vector2D,
        radiusPx: number,
        gameTime: number,
        displayColor: string
    ): void {
        const twoPi = Math.PI * 2;
        const seed = this.getVelarisWarpGateSeed(gate);
        const particleRadius = Math.max(1, 1.35 * this.zoom);
        const ringAlpha = 0.65;

        this.ctx.save();
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = ringAlpha;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radiusPx, 0, twoPi);
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.save();
        this.ctx.fillStyle = displayColor;
        for (let i = 0; i < this.VELARIS_WARP_GATE_PARTICLE_COUNT; i++) {
            const seedOffset = seed + i * 0.83;
            const progress = (gameTime * this.VELARIS_WARP_GATE_PARTICLE_BASE_SPEED
                + this.getPseudoRandom(seedOffset)) % 1;
            const radiusFactor = 1 - progress;
            const alphaFactor = Math.max(
                0,
                (radiusFactor - this.VELARIS_WARP_GATE_PARTICLE_CENTER_FADE)
                    / (1 - this.VELARIS_WARP_GATE_PARTICLE_CENTER_FADE)
            );
            if (alphaFactor <= 0) {
                continue;
            }
            const baseAngle = this.getPseudoRandom(seedOffset + 2.4) * twoPi;
            const swirlAngle = baseAngle
                + gameTime * 0.9
                + progress * this.VELARIS_WARP_GATE_PARTICLE_SWIRL_TIGHTNESS * twoPi;
            const particleRadiusPx = radiusPx * radiusFactor;
            const x = screenPos.x + Math.cos(swirlAngle) * particleRadiusPx;
            const y = screenPos.y + Math.sin(swirlAngle) * particleRadiusPx;
            this.ctx.globalAlpha = alphaFactor * 0.9;
            this.ctx.beginPath();
            this.ctx.arc(x, y, particleRadius, 0, twoPi);
            this.ctx.fill();
        }
        this.ctx.restore();
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

    /**
     * Draw Aurum stellar forge with moving squares and outline-only rendering
     */
    private drawAurumForgeOutline(
        forge: StellarForge,
        screenPos: Vector2D,
        baseSize: number,
        displayColor: string,
        gameTime: number
    ): void {
        const state = this.getAurumForgeShapeState(forge, gameTime);
        const deltaTime = gameTime - state.lastGameTime;
        state.lastGameTime = gameTime;

        // Update angles for each shape
        state.shapes.forEach(shape => {
            shape.angle += shape.speed * deltaTime;
        });

        // Calculate bounding box for optimization
        const padding = baseSize * 2;
        const minX = Math.max(0, Math.floor(screenPos.x - padding));
        const maxX = Math.min(this.canvas.width, Math.ceil(screenPos.x + padding));
        const minY = Math.max(0, Math.floor(screenPos.y - padding));
        const maxY = Math.min(this.canvas.height, Math.ceil(screenPos.y + padding));
        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        // Reuse or create offscreen canvas for better performance
        if (!this.aurumOffscreenCanvas) {
            this.aurumOffscreenCanvas = document.createElement('canvas');
        }
        const tempCanvas = this.aurumOffscreenCanvas;
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Clear canvas
        tempCtx.clearRect(0, 0, cropWidth, cropHeight);

        // Draw all squares filled on the temp canvas
        tempCtx.fillStyle = this.AURUM_EDGE_DETECTION_FILL_COLOR;
        state.shapes.forEach(shape => {
            const size = baseSize * shape.size;
            const offsetX = Math.cos(shape.angle) * baseSize * shape.offset;
            const offsetY = Math.sin(shape.angle) * baseSize * shape.offset;
            const x = screenPos.x + offsetX - minX;
            const y = screenPos.y + offsetY - minY;
            
            tempCtx.save();
            tempCtx.translate(x, y);
            tempCtx.rotate(shape.angle);
            tempCtx.fillRect(-size / 2, -size / 2, size, size);
            tempCtx.restore();
        });

        // Get the image data and detect/draw edges
        const imageData = tempCtx.getImageData(0, 0, cropWidth, cropHeight);
        this.detectAndDrawEdges(imageData, cropWidth, cropHeight, minX, minY, displayColor);
    }

    /**
     * Draw Aurum foundry with moving triangles and outline-only rendering
     */
    private drawAurumFoundryOutline(
        foundry: SubsidiaryFactory,
        screenPos: Vector2D,
        baseSize: number,
        displayColor: string,
        gameTime: number
    ): void {
        const state = this.getAurumFoundryShapeState(foundry, gameTime);
        const deltaTime = gameTime - state.lastGameTime;
        state.lastGameTime = gameTime;

        // Update angles for each shape
        state.shapes.forEach(shape => {
            shape.angle += shape.speed * deltaTime;
        });

        // Calculate bounding box for optimization
        const padding = baseSize * 2;
        const minX = Math.max(0, Math.floor(screenPos.x - padding));
        const maxX = Math.min(this.canvas.width, Math.ceil(screenPos.x + padding));
        const minY = Math.max(0, Math.floor(screenPos.y - padding));
        const maxY = Math.min(this.canvas.height, Math.ceil(screenPos.y + padding));
        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        // Reuse or create offscreen canvas for better performance
        if (!this.aurumOffscreenCanvas) {
            this.aurumOffscreenCanvas = document.createElement('canvas');
        }
        const tempCanvas = this.aurumOffscreenCanvas;
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Clear canvas
        tempCtx.clearRect(0, 0, cropWidth, cropHeight);

        // Draw all triangles filled on the temp canvas
        tempCtx.fillStyle = this.AURUM_EDGE_DETECTION_FILL_COLOR;
        state.shapes.forEach(shape => {
            const size = baseSize * shape.size;
            const offsetX = Math.cos(shape.angle) * baseSize * shape.offset;
            const offsetY = Math.sin(shape.angle) * baseSize * shape.offset;
            const x = screenPos.x + offsetX - minX;
            const y = screenPos.y + offsetY - minY;
            
            tempCtx.save();
            tempCtx.translate(x, y);
            tempCtx.rotate(shape.angle);
            tempCtx.beginPath();
            // Draw equilateral triangle
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                const px = Math.cos(angle) * size;
                const py = Math.sin(angle) * size;
                if (i === 0) {
                    tempCtx.moveTo(px, py);
                } else {
                    tempCtx.lineTo(px, py);
                }
            }
            tempCtx.closePath();
            tempCtx.fill();
            tempCtx.restore();
        });

        // Get the image data and detect/draw edges
        const imageData = tempCtx.getImageData(0, 0, cropWidth, cropHeight);
        this.detectAndDrawEdges(imageData, cropWidth, cropHeight, minX, minY, displayColor);
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
     * Adjust color brightness by a given factor (1.0 is original color, >1.0 is brighter, <1.0 is darker)
     */
    private adjustColorBrightness(color: string, factor: number): string {
        // Parse hex color (handle both #RGB and #RRGGBB formats)
        let hex = color.replace('#', '');
        if (hex.length === 3) {
            // Convert #RGB to #RRGGBB
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        
        // Apply brightening factor and clamp to valid RGB range
        const newR = Math.floor(Math.min(255, r * factor));
        const newG = Math.floor(Math.min(255, g * factor));
        const newB = Math.floor(Math.min(255, b * factor));
        
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
     * Draw an aura (colored glow) behind a unit or structure in LaD mode
     * The aura color is adjusted based on the unit's side (white/black)
     */
    private drawLadAura(
        screenPos: { x: number, y: number },
        radius: number,
        baseColor: string,
        unitSide: 'light' | 'dark'
    ): void {
        this.ctx.save();
        
        // Adjust color brightness based on side
        // White side: darken the aura slightly for contrast
        // Black side: brighten the aura slightly for contrast
        let adjustedColor = baseColor;
        if (unitSide === 'light') {
            // Darken for white units
            adjustedColor = this.darkenColor(baseColor, 0.7);
        } else {
            // Brighten for black units
            adjustedColor = this.adjustColorBrightness(baseColor, 1.3);
        }
        
        // Draw the aura as a radial gradient that completely envelops the unit
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, radius * 1.8
        );
        // Opacity values: ~50%, ~38%, ~19%, 0%
        gradient.addColorStop(0, adjustedColor + '80'); // Semi-transparent center (~50% opacity)
        gradient.addColorStop(0.5, adjustedColor + '60'); // ~38% opacity
        gradient.addColorStop(0.8, adjustedColor + '30'); // ~19% opacity
        gradient.addColorStop(1, adjustedColor + '00'); // Fully transparent edge
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius * 1.8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    private drawFancyBloom(screenPos: Vector2D, radius: number, color: string, intensity: number): void {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = Math.max(0, Math.min(1, intensity));
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = radius * 0.9;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    private drawCachedUnitGlow(screenPos: Vector2D, radiusPx: number, color: string, alphaScale: number = 1): void {
        const clampedRadiusPx = Math.max(6, Math.round(radiusPx));
        const glowTexture = this.getOrCreateUnitGlowTexture(clampedRadiusPx, color);
        const drawSize = glowTexture.width;

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = Math.max(0, Math.min(1, this.UNIT_GLOW_ALPHA * alphaScale));
        this.ctx.drawImage(
            glowTexture,
            screenPos.x - drawSize * 0.5,
            screenPos.y - drawSize * 0.5,
            drawSize,
            drawSize
        );
        this.ctx.restore();
    }

    private getOrCreateUnitGlowTexture(radiusPx: number, color: string): HTMLCanvasElement {
        const cacheKey = `${radiusPx}:${color}`;
        const cached = this.unitGlowRenderCache.get(cacheKey);
        if (cached) {
            return cached.texture;
        }

        const textureRadiusPx = Math.max(2, Math.round(radiusPx * 1.8));
        const textureSize = textureRadiusPx * 2;
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = textureSize;
        glowCanvas.height = textureSize;
        const glowCtx = glowCanvas.getContext('2d');

        if (!glowCtx) {
            return glowCanvas;
        }

        const gradient = glowCtx.createRadialGradient(
            textureRadiusPx,
            textureRadiusPx,
            0,
            textureRadiusPx,
            textureRadiusPx,
            textureRadiusPx
        );
        gradient.addColorStop(0, this.withAlpha(color, 0.58));
        gradient.addColorStop(0.42, this.withAlpha(color, 0.22));
        gradient.addColorStop(1, this.withAlpha(color, 0));

        glowCtx.fillStyle = gradient;
        glowCtx.beginPath();
        glowCtx.arc(textureRadiusPx, textureRadiusPx, textureRadiusPx, 0, Math.PI * 2);
        glowCtx.fill();

        this.unitGlowRenderCache.set(cacheKey, {
            texture: glowCanvas,
            radiusPx,
        });

        return glowCanvas;
    }

    private withAlpha(color: string, alpha: number): string {
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 6) {
                const r = Number.parseInt(hex.slice(0, 2), 16);
                const g = Number.parseInt(hex.slice(2, 4), 16);
                const b = Number.parseInt(hex.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
            }
        }

        const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
        if (rgbaMatch) {
            const components = rgbaMatch[1].split(',').map(component => component.trim());
            if (components.length >= 3) {
                return `rgba(${components[0]}, ${components[1]}, ${components[2]}, ${Math.max(0, Math.min(1, alpha))})`;
            }
        }

        return color;
    }

    /**
     * Draw the universal unit/structure selection ring.
     */
    private drawBuildingSelectionIndicator(screenPos: { x: number, y: number }, radius: number): void {
        const selectionRadius = radius + Math.max(2, this.zoom * 2.5);
        const ringThickness = Math.max(1.5, this.zoom * 1.8);
        const gradient = this.ctx.createRadialGradient(
            screenPos.x,
            screenPos.y,
            Math.max(0, selectionRadius - ringThickness * 0.4),
            screenPos.x,
            screenPos.y,
            selectionRadius + ringThickness * 2.4
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.95)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.85)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.ctx.save();
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = ringThickness;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, selectionRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Draw a sun
     */
    private drawSun(sun: Sun, gameTimeSec: number = 0): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        
        // Special rendering for LaD (Light and Dark) sun
        if (sun.type === 'lad') {
            this.drawLadSun(sun, screenPos, screenRadius);
            return;
        }

        if (this.graphicsQuality === 'ultra') {
            this.drawUltraSun(sun, screenPos, screenRadius, gameTimeSec);
            return;
        }

        if (this.isFancyGraphicsEnabled) {
            const bloomRadius = screenRadius * 1.35;
            this.drawFancyBloom(screenPos, bloomRadius, this.colorScheme.sunGlow.outerGlow1, 0.7);
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

    private drawUltraSun(sun: Sun, screenPos: Vector2D, screenRadius: number, gameTimeSec: number): void {
        const sunRenderCache = this.getOrCreateSunRenderCache(screenRadius);
        const pulseAmount = 1 + Math.sin(gameTimeSec * 1.2) * 0.012;
        const corePulseAmount = 1 + Math.sin(gameTimeSec * (Math.PI * 2 / 5)) * 0.018;
        const microFlicker = 1 + Math.sin(gameTimeSec * 8.0 + sun.position.x * 0.01 + sun.position.y * 0.015) * 0.015;
        const animatedRadius = screenRadius * pulseAmount;

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';

        const corona = this.ctx.createRadialGradient(screenPos.x, screenPos.y, animatedRadius * 0.25, screenPos.x, screenPos.y, animatedRadius * 2.8);
        corona.addColorStop(0, 'rgba(255, 246, 210, 0.52)');
        corona.addColorStop(0.28, 'rgba(255, 207, 116, 0.35)');
        corona.addColorStop(1, 'rgba(255, 170, 90, 0)');
        this.ctx.fillStyle = corona;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, animatedRadius * 2.8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, animatedRadius, 0, Math.PI * 2);
        this.ctx.clip();

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(gameTimeSec * 0.04);
        this.ctx.globalAlpha = 0.84 * microFlicker;
        this.ctx.drawImage(
            sunRenderCache.plasmaLayerA,
            -animatedRadius,
            -animatedRadius,
            animatedRadius * 2,
            animatedRadius * 2
        );
        this.ctx.restore();

        const driftX = Math.sin(gameTimeSec * 0.09) * animatedRadius * 0.09;
        const driftY = Math.cos(gameTimeSec * 0.07) * animatedRadius * 0.09;
        this.ctx.save();
        this.ctx.translate(screenPos.x + driftX, screenPos.y + driftY);
        this.ctx.rotate(-gameTimeSec * 0.032);
        this.ctx.globalAlpha = 0.66;
        this.ctx.drawImage(
            sunRenderCache.plasmaLayerB,
            -animatedRadius,
            -animatedRadius,
            animatedRadius * 2,
            animatedRadius * 2
        );
        this.ctx.restore();

        this.ctx.restore();

        const coreRadius = animatedRadius * 0.34 * corePulseAmount;
        const hardCore = this.ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, coreRadius);
        hardCore.addColorStop(0, 'rgba(255, 255, 255, 1)');
        hardCore.addColorStop(0.3, 'rgba(255, 255, 248, 0.98)');
        hardCore.addColorStop(0.68, 'rgba(255, 246, 206, 0.9)');
        hardCore.addColorStop(1, 'rgba(255, 236, 170, 0.14)');
        this.ctx.fillStyle = hardCore;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        const whiteDiscRadius = animatedRadius * 0.16 * corePulseAmount;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, whiteDiscRadius, 0, Math.PI * 2);
        this.ctx.fill();

        const surfaceGradient = this.ctx.createRadialGradient(screenPos.x, screenPos.y, animatedRadius * 0.15, screenPos.x, screenPos.y, animatedRadius);
        surfaceGradient.addColorStop(0, 'rgba(255, 247, 190, 0.6)');
        surfaceGradient.addColorStop(0.65, 'rgba(255, 180, 75, 0.42)');
        surfaceGradient.addColorStop(1, 'rgba(255, 124, 45, 0.2)');
        this.ctx.fillStyle = surfaceGradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, animatedRadius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        this.drawUltraSunBloom(screenPos, animatedRadius);
    }

    private drawUltraSunBloom(screenPos: Vector2D, screenRadius: number): void {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        for (let stepIndex = 0; stepIndex < this.ULTRA_SUN_BLOOM_STEPS; stepIndex++) {
            const stepT = stepIndex / Math.max(1, this.ULTRA_SUN_BLOOM_STEPS - 1);
            const radius = screenRadius * (1.15 + stepT * 2.65);
            const alpha = 0.2 * (1 - stepT);
            const bloom = this.ctx.createRadialGradient(screenPos.x, screenPos.y, radius * 0.22, screenPos.x, screenPos.y, radius);
            bloom.addColorStop(0, `rgba(255, 250, 225, ${Math.min(0.5, alpha * 2.2).toFixed(4)})`);
            bloom.addColorStop(0.45, `rgba(255, 200, 115, ${alpha.toFixed(4)})`);
            bloom.addColorStop(1, 'rgba(255, 140, 70, 0)');
            this.ctx.fillStyle = bloom;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 0.23;
        this.ctx.beginPath();
        this.ctx.ellipse(screenPos.x, screenPos.y, screenRadius * 2.9, screenRadius * 1.85, 0, 0, Math.PI * 2);
        const horizontalStretch = this.ctx.createRadialGradient(
            screenPos.x,
            screenPos.y,
            screenRadius * 0.3,
            screenPos.x,
            screenPos.y,
            screenRadius * 2.9
        );
        horizontalStretch.addColorStop(0, 'rgba(255, 242, 186, 0.42)');
        horizontalStretch.addColorStop(0.4, 'rgba(255, 212, 120, 0.18)');
        horizontalStretch.addColorStop(1, 'rgba(255, 170, 95, 0)');
        this.ctx.fillStyle = horizontalStretch;
        this.ctx.fill();
        this.ctx.restore();
    }

    private getOrCreateSunRenderCache(screenRadius: number): SunRenderCache {
        const radiusBucket = Math.max(48, Math.round(screenRadius / 16) * 16);
        const existingCache = this.sunRenderCacheByRadiusBucket.get(radiusBucket);
        if (existingCache) {
            return existingCache;
        }

        const textureSize = Math.max(128, radiusBucket * 2);
        const buildPlasmaLayer = (seedOffset: number): HTMLCanvasElement => {
            const textureCanvas = document.createElement('canvas');
            textureCanvas.width = textureSize;
            textureCanvas.height = textureSize;
            const textureContext = textureCanvas.getContext('2d');
            if (!textureContext) {
                return textureCanvas;
            }

            const imageData = textureContext.createImageData(textureSize, textureSize);
            const pixelData = imageData.data;
            const center = textureSize * 0.5;
            const invSize = 1 / textureSize;
            for (let y = 0; y < textureSize; y++) {
                for (let x = 0; x < textureSize; x++) {
                    const dx = (x - center) * invSize;
                    const dy = (y - center) * invSize;
                    const radialDistance = Math.sqrt(dx * dx + dy * dy);
                    const radialFalloff = Math.max(0, 1 - radialDistance * 2.0);
                    const n1 = this.hashNormalized((x + seedOffset * 17.0) * 0.093 + (y + seedOffset * 13.0) * 0.061);
                    const n2 = this.hashNormalized((x - seedOffset * 19.0) * 0.143 + (y - seedOffset * 11.0) * 0.109);
                    const plasma = Math.max(0, Math.min(1, n1 * 0.6 + n2 * 0.4));
                    const brightness = Math.pow(radialFalloff, 0.72) * (0.62 + plasma * 0.68);
                    const pixelIndex = (y * textureSize + x) * 4;
                    pixelData[pixelIndex + 0] = Math.min(255, 255 * (0.96 + brightness * 0.04));
                    pixelData[pixelIndex + 1] = Math.min(255, 145 + brightness * 110);
                    pixelData[pixelIndex + 2] = Math.min(255, 38 + brightness * 70);
                    pixelData[pixelIndex + 3] = Math.floor(255 * Math.max(0, radialFalloff));
                }
            }

            textureContext.putImageData(imageData, 0, 0);
            textureContext.globalCompositeOperation = 'lighter';
            const whiteCore = textureContext.createRadialGradient(center, center, 0, center, center, textureSize * 0.24);
            whiteCore.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            whiteCore.addColorStop(1, 'rgba(255, 255, 255, 0)');
            textureContext.fillStyle = whiteCore;
            textureContext.beginPath();
            textureContext.arc(center, center, textureSize * 0.24, 0, Math.PI * 2);
            textureContext.fill();
            return textureCanvas;
        };

        const buildShaftTexture = (isOuterLayer: boolean): HTMLCanvasElement => {
            const shaftTexture = document.createElement('canvas');
            shaftTexture.width = 1024;
            shaftTexture.height = 1024;
            const shaftContext = shaftTexture.getContext('2d');
            if (!shaftContext) {
                return shaftTexture;
            }

            const shaftCenterX = shaftTexture.width / 2;
            const shaftCenterY = shaftTexture.height / 2;
            shaftContext.translate(shaftCenterX, shaftCenterY);
            shaftContext.globalCompositeOperation = 'lighter';
            const shaftCount = isOuterLayer ? 32 : 20;
            for (let shaftIndex = 0; shaftIndex < shaftCount; shaftIndex++) {
                const angle = (Math.PI * 2 * shaftIndex) / shaftCount + this.hashSigned(shaftIndex * 7.1 + (isOuterLayer ? 3 : 11)) * 0.09;
                const shaftLength = (isOuterLayer ? 430 : 320) + this.hashNormalized(shaftIndex * 17.9) * (isOuterLayer ? 300 : 220);
                const shaftWidth = (isOuterLayer ? 22 : 16) + this.hashNormalized(shaftIndex * 9.3 + 4.7) * (isOuterLayer ? 48 : 26);
                shaftContext.save();
                shaftContext.rotate(angle);

                const softEdgeGradient = shaftContext.createLinearGradient(0, 0, shaftLength, 0);
                softEdgeGradient.addColorStop(0, isOuterLayer ? 'rgba(255, 246, 206, 0.16)' : 'rgba(255, 242, 190, 0.2)');
                softEdgeGradient.addColorStop(0.2, isOuterLayer ? 'rgba(255, 215, 132, 0.18)' : 'rgba(255, 220, 138, 0.24)');
                softEdgeGradient.addColorStop(1, 'rgba(255, 170, 85, 0)');
                shaftContext.fillStyle = softEdgeGradient;
                shaftContext.beginPath();
                shaftContext.ellipse(shaftLength * 0.5, 0, shaftLength * 0.52, shaftWidth * 0.5, 0, 0, Math.PI * 2);
                shaftContext.fill();

                const spineGradient = shaftContext.createLinearGradient(0, 0, shaftLength * 0.92, 0);
                spineGradient.addColorStop(0, isOuterLayer ? 'rgba(255, 251, 232, 0.2)' : 'rgba(255, 250, 230, 0.32)');
                spineGradient.addColorStop(0.5, isOuterLayer ? 'rgba(255, 229, 152, 0.18)' : 'rgba(255, 234, 160, 0.26)');
                spineGradient.addColorStop(1, 'rgba(255, 198, 108, 0)');
                shaftContext.fillStyle = spineGradient;
                shaftContext.beginPath();
                shaftContext.ellipse(shaftLength * 0.45, 0, shaftLength * 0.47, Math.max(2, shaftWidth * 0.13), 0, 0, Math.PI * 2);
                shaftContext.fill();

                shaftContext.restore();
            }

            return shaftTexture;
        };

        const generatedCache: SunRenderCache = {
            plasmaLayerA: buildPlasmaLayer(1),
            plasmaLayerB: buildPlasmaLayer(2),
            shaftTextureOuter: buildShaftTexture(true),
            shaftTextureInner: buildShaftTexture(false)
        };
        this.sunRenderCacheByRadiusBucket.set(radiusBucket, generatedCache);
        return generatedCache;
    }

    private drawLadSun(sun: Sun, screenPos: Vector2D, screenRadius: number): void {
        // Save context state
        this.ctx.save();

        // Draw left half (white)
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, Math.PI / 2, -Math.PI / 2);
        this.ctx.closePath();
        this.ctx.clip();

        this.ctx.fillStyle = this.withAlpha('#0D0A19', 0.55);
        this.ctx.fillRect(screenPos.x - screenRadius, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context to draw right half
        this.ctx.restore();
        this.ctx.save();

        // Draw right half (black)
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, -Math.PI / 2, Math.PI / 2);
        this.ctx.closePath();
        this.ctx.clip();

        this.ctx.fillStyle = this.ASTEROID_SHADOW_COLOR;
        this.ctx.fillRect(screenPos.x, screenPos.y - screenRadius, screenRadius, screenRadius * 2);

        // Restore context
        this.ctx.restore();

        // Draw dividing line between light and dark
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - screenRadius);
        this.ctx.lineTo(screenPos.x, screenPos.y + screenRadius);
        this.ctx.stroke();

        // Draw circle outline around the sun
        this.ctx.strokeStyle = Constants.LAD_SUN_OUTLINE_COLOR;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
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
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';

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
            this.ctx.restore();
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
        this.ctx.restore();
    }

    /**
     * Draw a Stellar Forge
     */
    private drawStellarForge(forge: StellarForge, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(forge.position);
        const size = 40 * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        let forgeColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun) {
            ownerSide = game.getLadSide(forge.position, ladSun);
            if (ownerSide === 'light') {
                forgeColor = '#FFFFFF';
            } else {
                forgeColor = '#000000';
            }
        }

        // Check visibility for enemy forges
        let shouldDim = false;
        let displayColor = forgeColor;
        let visibilityAlpha = 1;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(forge.position, this.viewingPlayer);
            visibilityAlpha = this.getEnemyVisibilityAlpha(forge, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(forge.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(forgeColor, Constants.SHADE_OPACITY);
                }
            }
        }

        this.ctx.save();
        this.ctx.globalAlpha = visibilityAlpha;

        // Draw selection circle if selected
        if (forge.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, size * 1.45);
            
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

            if (forge.isSelected) {
                // Draw forge production buttons around the forge
                this.drawHeroButtons(forge, screenPos, this.selectedHeroNames);
            }

        }


        // Draw path preview while drawing a new path from this forge (even if forge was auto-deselected).
        if (this.pathPreviewForge === forge && (this.pathPreviewPoints.length > 0 || this.pathPreviewEnd)) {
            this.drawMinionPathPreview(forge.position, this.pathPreviewPoints, this.pathPreviewEnd);
        }

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, size, auraColor, ownerSide);
        }

        this.drawAestheticSpriteShadow(forge.position, screenPos, size * 1.05, game, {
            opacity: visibilityAlpha,
            widthScale: 0.9,
            particleCount: 5,
            particleSpread: size * 0.85
        });

        // Draw base structure - use darkened color if should dim
        const tintColor = shouldDim
            ? this.darkenColor(forgeColor, Constants.SHADE_OPACITY)
            : forgeColor;
        const isVelarisForge = forge.owner.faction === Faction.VELARIS;
        const isAurumForge = forge.owner.faction === Faction.AURUM;
        const forgeSpritePath = this.getForgeSpritePath(forge);
        const forgeSprite = forgeSpritePath
            ? this.getTintedSprite(forgeSpritePath, tintColor)
            : null;
        if (isAurumForge) {
            // Draw Aurum forge with moving squares outline
            this.drawAurumForgeOutline(
                forge,
                screenPos,
                size,
                displayColor,
                game.gameTime
            );
        } else if (isVelarisForge) {
            this.drawVelarisForgeScript(
                forge,
                screenPos,
                size,
                displayColor,
                game.gameTime,
                shouldDim
            );
        } else if (forgeSprite) {
            const spriteSize = size * this.FORGE_SPRITE_SCALE;
            this.ctx.drawImage(
                forgeSprite,
                screenPos.x - spriteSize / 2,
                screenPos.y - spriteSize / 2,
                spriteSize,
                spriteSize
            );

            this.drawForgeFlames(forge, screenPos, spriteSize, game, shouldDim);
        } else {
            this.ctx.fillStyle = displayColor;
            const strokeColor = displayColor;
            this.ctx.strokeStyle = shouldDim ? this.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor;
            this.ctx.lineWidth = 2;
            
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

        this.ctx.restore();
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
        
        const displayLabels = [...heroNames.slice(0, 4), 'Solar Mirror'];
        const positions = this.getRadialButtonOffsets(displayLabels.length);

        for (let i = 0; i < displayLabels.length; i++) {
            const heroName = displayLabels[i];
            const pos = positions[i];
            const buttonX = screenPos.x + pos.x * buttonDistance;
            const buttonY = screenPos.y + pos.y * buttonDistance;
            const isMirrorOption = heroName === 'Solar Mirror';
            const heroUnitType = isMirrorOption ? null : this.getHeroUnitType(heroName);
            const isHeroAlive = heroUnitType ? this.isHeroUnitAlive(forge.owner, heroUnitType) : false;
            const isHeroProducing = heroUnitType ? this.isHeroUnitQueuedOrProducing(forge, heroUnitType) : false;
            const isMirrorAffordable = forge.owner.energy >= Constants.STELLAR_FORGE_SOLAR_MIRROR_COST;
            const isAvailable = isMirrorOption ? isMirrorAffordable : (heroUnitType ? !isHeroAlive && !isHeroProducing : false);
            const isHighlighted = this.highlightedButtonIndex === i;

            // Draw button background with highlight effect
            this.ctx.fillStyle = isHighlighted 
                ? 'rgba(0, 255, 136, 0.7)' 
                : (isAvailable ? 'rgba(0, 255, 136, 0.3)' : 'rgba(128, 128, 128, 0.3)');
            this.ctx.strokeStyle = isHighlighted 
                ? '#00FF88' 
                : (isAvailable ? '#00FF88' : '#888888');
            this.ctx.lineWidth = isHighlighted ? 4 : 2;
            this.ctx.beginPath();
            this.ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw button label
            this.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#666666';
            this.ctx.font = `${14 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            if (isMirrorOption) {
                this.ctx.fillText('Mirror', buttonX, buttonY - 6 * this.zoom);
                this.ctx.fillText('2000', buttonX, buttonY + 7 * this.zoom);
            } else {
                this.ctx.fillText(heroName, buttonX, buttonY);
            }

            if (!isMirrorOption && isHeroProducing) {
                this.drawHeroHourglass(buttonX, buttonY, buttonRadius);
            } else if (isHeroAlive) {
                this.drawHeroCheckmark(buttonX, buttonY, buttonRadius);
            }
        }
    }

    private getRadialButtonOffsets(buttonCount: number): Array<{ x: number; y: number }> {
        if (buttonCount <= 0) {
            return [];
        }
        const positions: Array<{ x: number; y: number }> = [];
        const startAngleRad = -Math.PI / 2;
        const stepAngleRad = (Math.PI * 2) / buttonCount;

        for (let i = 0; i < buttonCount; i++) {
            const angleRad = startAngleRad + stepAngleRad * i;
            positions.push({ x: Math.cos(angleRad), y: Math.sin(angleRad) });
        }
        return positions;
    }

    private getHeroUnitType(heroName: string): string | null {
        switch (heroName) {
            case 'Marine':
            case 'Grave':
            case 'Ray':
            case 'Dagger':
            case 'Beam':
            case 'Driller':
            case 'Spotlight':
            case 'Sly':
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
            case 'Nova':
                return unit instanceof Nova;
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
            case 'Spotlight':
                return unit instanceof Spotlight;
            case 'Mortar':
                return unit instanceof Mortar;
            case 'Preist':
                return unit instanceof Preist;
            case 'Sly':
                return unit instanceof Sly;
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
     * Draw foundry production buttons around selected foundry
     */
    private drawFoundryButtons(foundry: SubsidiaryFactory, screenPos: Vector2D): void {
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * this.zoom;
        const buttonDistance = Constants.HERO_BUTTON_DISTANCE_PX * this.zoom;

        const buttonConfigs = [
            { 
                label: 'Strafe',
                available: foundry.canQueueStrafeUpgrade(),
                index: 0
            },
            {
                label: 'Blink',
                available: foundry.canQueueBlinkUpgrade(),
                index: 1
            },
            {
                label: 'Regen',
                available: foundry.canQueueRegenUpgrade(),
                index: 2
            },
            {
                label: '+1 ATK',
                available: foundry.canQueueAttackUpgrade(),
                index: 3
            }
        ];
        const positions = this.getRadialButtonOffsets(buttonConfigs.length);

        for (let i = 0; i < buttonConfigs.length; i++) {
            const config = buttonConfigs[i];
            const pos = positions[i];
            const buttonX = screenPos.x + pos.x * buttonDistance;
            const buttonY = screenPos.y + pos.y * buttonDistance;
            const isHighlighted = this.highlightedButtonIndex === config.index;

            // Draw button background with highlight effect
            this.ctx.fillStyle = isHighlighted 
                ? 'rgba(255, 215, 0, 0.7)' 
                : (config.available ? 'rgba(255, 215, 0, 0.3)' : 'rgba(128, 128, 128, 0.3)');
            this.ctx.strokeStyle = isHighlighted 
                ? '#FFD700' 
                : (config.available ? '#FFD700' : '#888888');
            this.ctx.lineWidth = isHighlighted ? 4 : 2;
            this.ctx.beginPath();
            this.ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw button label
            this.ctx.fillStyle = config.available ? '#FFFFFF' : '#666666';
            this.ctx.font = `${12 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(config.label, buttonX, buttonY);
        }
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

    private getVelarisMirrorSeed(mirror: SolarMirror): number {
        let seed = this.velarisMirrorSeeds.get(mirror);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisMirrorSeeds.set(mirror, seed);
        }
        return seed;
    }

    private getVelarisFoundrySeed(foundry: SubsidiaryFactory): number {
        let seed = this.velarisFoundrySeeds.get(foundry);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisFoundrySeeds.set(foundry, seed);
        }
        return seed;
    }

    private getVelarisWarpGateSeed(gate: WarpGate): number {
        let seed = this.velarisWarpGateSeeds.get(gate);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisWarpGateSeeds.set(gate, seed);
        }
        return seed;
    }

    /**
     * Get or initialize Aurum forge shape state
     */
    private getAurumForgeShapeState(forge: StellarForge, gameTime: number): AurumShapeState {
        let state = this.aurumForgeShapeStates.get(forge);
        if (!state) {
            // Initialize with multiple squares of different sizes and speeds
            const shapeCount = 12;
            const shapes: Array<{size: number; speed: number; angle: number; offset: number}> = [];
            const seed = forge.position.x * this.AURUM_SEED_BASE_MULTIPLIER + forge.position.y;
            
            for (let i = 0; i < shapeCount; i++) {
                const random = (seed + i * this.AURUM_FORGE_SEED_MULTIPLIER) % 1000 / 1000;
                const size = 0.3 + random * 1.2; // Sizes from 0.3 to 1.5
                const speed = 0.15 + (random * 0.5); // Speeds from 0.15 to 0.65 rad/sec
                const angle = (i / shapeCount) * Math.PI * 2; // Evenly distributed initial angles
                const offset = random * 0.4; // Random offset from center (0 to 0.4 of base size)
                shapes.push({ size, speed, angle, offset });
            }
            
            state = {
                shapes,
                lastGameTime: gameTime
            };
            this.aurumForgeShapeStates.set(forge, state);
        }
        return state;
    }

    /**
     * Get or initialize Aurum foundry shape state
     */
    private getAurumFoundryShapeState(foundry: SubsidiaryFactory, gameTime: number): AurumShapeState {
        let state = this.aurumFoundryShapeStates.get(foundry);
        if (!state) {
            // Initialize with multiple triangles of different sizes and speeds
            const shapeCount = 10;
            const shapes: Array<{size: number; speed: number; angle: number; offset: number}> = [];
            const seed = foundry.position.x * this.AURUM_SEED_BASE_MULTIPLIER + foundry.position.y;
            
            for (let i = 0; i < shapeCount; i++) {
                const random = (seed + i * this.AURUM_FOUNDRY_SEED_MULTIPLIER) % 1000 / 1000;
                const size = 0.25 + random * 1.0; // Sizes from 0.25 to 1.25
                const speed = 0.2 + (random * 0.6); // Speeds from 0.2 to 0.8 rad/sec
                const angle = (i / shapeCount) * Math.PI * 2; // Evenly distributed initial angles
                const offset = random * 0.35; // Random offset from center
                shapes.push({ size, speed, angle, offset });
            }
            
            state = {
                shapes,
                lastGameTime: gameTime
            };
            this.aurumFoundryShapeStates.set(foundry, state);
        }
        return state;
    }

    /**
     * Draw a Solar Mirror with flat surface, rotation, and proximity-based glow
     */
    private drawSolarMirror(
        mirror: SolarMirror,
        color: string,
        game: GameState,
        isEnemy: boolean,
        timeSec: number
    ): void {
        const ladSun = game.suns.find(s => s.type === 'lad');
        let mirrorColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && mirror.owner) {
            ownerSide = mirror.owner.stellarForge
                ? game.getLadSide(mirror.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                mirrorColor = '#FFFFFF';
            } else {
                mirrorColor = '#000000';
            }
        }

        // Check visibility for enemy mirrors
        let shouldDim = false;
        let displayColor = mirrorColor;
        let visibilityAlpha = 1;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mirror.position, this.viewingPlayer);
            visibilityAlpha = this.getEnemyVisibilityAlpha(mirror, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(mirror.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(mirrorColor, Constants.SHADE_OPACITY);
                }
            }
        }
        
        const screenPos = this.worldToScreen(mirror.position);
        const mirrorSizeWorld = 14;
        const size = mirrorSizeWorld * this.zoom;

        this.drawAestheticSpriteShadow(mirror.position, screenPos, size * 0.95, game, {
            opacity: visibilityAlpha,
            widthScale: 0.78,
            particleCount: 4,
            particleSpread: size * 0.7
        });

        // Save context state
        this.ctx.save();
        this.ctx.globalAlpha = visibilityAlpha;

        // Calculate glow intensity based on distance to closest sun
        // Closer = brighter glow (inverse relationship)
        const glowIntensity = Math.max(0, Math.min(1, 1 - (mirror.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE)));
        const isVelarisMirror = mirror.owner.faction === Faction.VELARIS;
        const hasLight = mirror.hasLineOfSightToLight(game.suns, game.asteroids);
        const isMirrorActive = hasLight && glowIntensity > 0.1 && mirror.closestSunDistance !== Infinity;
        const velarisUnderlineOffsetWorld = mirrorSizeWorld * 0.45;

        if (this.isFancyGraphicsEnabled) {
            const bloomColor = this.brightenAndPaleColor(displayColor);
            const bloomIntensity = 0.25 + glowIntensity * 0.5;
            this.drawFancyBloom(screenPos, size * 1.6, bloomColor, bloomIntensity);
        }
        
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
                const beamStartWorld = isVelarisMirror && isMirrorActive
                    ? new Vector2D(
                        mirror.position.x - Math.sin(mirror.reflectionAngle) * velarisUnderlineOffsetWorld,
                        mirror.position.y + Math.cos(mirror.reflectionAngle) * velarisUnderlineOffsetWorld
                    )
                    : mirror.position;
                const beamEnd = new Vector2D(
                    beamStartWorld.x + reflectDir.x * beamLength,
                    beamStartWorld.y + reflectDir.y * beamLength
                );
                const beamStartScreen = this.worldToScreen(beamStartWorld);
                const beamEndScreen = this.worldToScreen(beamEnd);
                
                // Draw bright beam with doubled intensity
                const beamGradient = this.ctx.createLinearGradient(
                    beamStartScreen.x, beamStartScreen.y,
                    beamEndScreen.x, beamEndScreen.y
                );
                beamGradient.addColorStop(0, `rgba(255, 255, 200, ${glowIntensity * 1.0})`);
                beamGradient.addColorStop(0.7, `rgba(255, 255, 150, ${glowIntensity * 0.6})`);
                beamGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
                
                this.ctx.strokeStyle = beamGradient;
                this.ctx.lineWidth = 15 * this.zoom * glowIntensity;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(beamStartScreen.x, beamStartScreen.y);
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

        // Draw aura in LaD mode (before sprite)
        if (ladSun && ownerSide) {
            // Save current transform and reset to screen coordinates for aura
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, size, auraColor, ownerSide);
            this.ctx.restore();
        }

        const surfaceLength = size * 2;
        const surfaceThickness = size * 0.3;
        let selectionWidth = surfaceLength;
        let selectionHeight = surfaceThickness;
        let drewSprite = false;

        if (isVelarisMirror) {
            const glyphColor = this.brightenAndPaleColor(displayColor);
            const glyphTargetSize = size * 0.6;
            const glyphSpacing = glyphTargetSize * 0.75;
            const glyphSeedBase = this.getVelarisMirrorSeed(mirror) + mirror.reflectionAngle * 0.15;
            const mirrorTimeSec = timeSec * this.VELARIS_MIRROR_PARTICLE_TIME_SCALE;

            if (isMirrorActive) {
                const word = this.VELARIS_MIRROR_WORD;
                const wordLength = word.length;
                const wordWidth = glyphSpacing * (wordLength - 1);
                const wordY = -size * 0.1;
                for (let i = 0; i < wordLength; i++) {
                    const letterX = (i - (wordLength - 1) / 2) * glyphSpacing;
                    const letter = word.charAt(i);
                    const spritePath = this.getVelarisGraphemeSpritePath(letter);
                    if (spritePath) {
                        const drewSprite = this.drawVelarisGraphemeSprite(
                            spritePath,
                            letterX,
                            wordY,
                            glyphTargetSize,
                            glyphColor
                        );
                        if (!drewSprite) {
                            this.ctx.fillStyle = glyphColor;
                            this.ctx.beginPath();
                            this.ctx.arc(letterX, wordY, glyphTargetSize * 0.2, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                }

                const underlineY = size * 0.45;
                const underlineLength = wordWidth + glyphTargetSize * 0.6;
                const particleRadius = Math.max(1, size * 0.08);
                this.ctx.fillStyle = `rgba(255, 255, 220, 0.85)`;
                for (let i = 0; i < this.VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT; i++) {
                    const t = this.VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT > 1
                        ? i / (this.VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT - 1)
                        : 0.5;
                    const driftSeed = glyphSeedBase + i * 2.7;
                    const driftX = Math.sin(mirrorTimeSec * this.VELARIS_MIRROR_PARTICLE_DRIFT_SPEED + driftSeed)
                        * particleRadius * 0.6;
                    const driftY = Math.cos(mirrorTimeSec * (this.VELARIS_MIRROR_PARTICLE_DRIFT_SPEED * 0.8) + driftSeed)
                        * particleRadius * 0.4;
                    const particleX = (t - 0.5) * underlineLength + driftX;
                    const particleY = underlineY + driftY;
                    this.ctx.beginPath();
                    this.ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                selectionWidth = underlineLength + glyphTargetSize;
                selectionHeight = size * 1.4;
            } else {
                const cloudRadius = size * 0.9;
                const cloudDriftRadius = Math.max(1, size * 0.12);
                const twoPi = Math.PI * 2;
                for (let i = 0; i < this.VELARIS_MIRROR_CLOUD_GLYPH_COUNT; i++) {
                    const seed = glyphSeedBase + i * 12.7;
                    const angle = this.getPseudoRandom(seed) * twoPi;
                    const radius = this.getPseudoRandom(seed + 7.3) * cloudRadius;
                    const driftAngle = mirrorTimeSec * 0.2 + this.getPseudoRandom(seed + 5.1) * twoPi;
                    const offsetX = Math.cos(angle) * radius + Math.cos(driftAngle) * cloudDriftRadius;
                    const offsetY = Math.sin(angle) * radius + Math.sin(driftAngle) * cloudDriftRadius;
                    const spriteIndex = Math.floor(this.getPseudoRandom(seed + 9.6) * this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS.length);
                    const spritePath = this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS[spriteIndex];
                    const drewSprite = this.drawVelarisGraphemeSprite(
                        spritePath,
                        offsetX,
                        offsetY,
                        glyphTargetSize,
                        glyphColor
                    );
                    if (!drewSprite) {
                        this.ctx.fillStyle = glyphColor;
                        this.ctx.beginPath();
                        this.ctx.arc(offsetX, offsetY, glyphTargetSize * 0.2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }

                const particleRadius = Math.max(1, size * 0.07);
                this.ctx.fillStyle = `rgba(255, 255, 210, 0.6)`;
                for (let i = 0; i < this.VELARIS_MIRROR_CLOUD_PARTICLE_COUNT; i++) {
                    const seed = glyphSeedBase + i * 9.4;
                    const angle = this.getPseudoRandom(seed + 1.1) * twoPi;
                    const radius = this.getPseudoRandom(seed + 4.7) * cloudRadius;
                    const driftAngle = mirrorTimeSec * 0.25 + this.getPseudoRandom(seed + 6.4) * twoPi;
                    const driftRadius = cloudDriftRadius * 0.75;
                    const offsetX = Math.cos(angle) * radius + Math.cos(driftAngle) * driftRadius;
                    const offsetY = Math.sin(angle) * radius + Math.sin(driftAngle) * driftRadius;
                    this.ctx.beginPath();
                    this.ctx.arc(offsetX, offsetY, particleRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                selectionWidth = size * 2;
                selectionHeight = size * 1.6;
            }

            drewSprite = true;
        }

        const mirrorSpritePath = this.getSolarMirrorSpritePath(mirror);
        if (mirrorSpritePath) {
            // Determine the color for the mirror (use displayColor which already accounts for enemy status and shadow)
            const spriteColor = this.brightenAndPaleColor(displayColor);
            
            const mirrorSprite = this.getTintedSprite(mirrorSpritePath, spriteColor);
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
            const strokeColor = displayColor;
            this.ctx.strokeStyle = shouldDim ? this.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor;
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

        // Restore context state
        this.ctx.restore();

        if (mirror.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, Math.max(selectionWidth, selectionHeight) * 0.52);
        }

        if (this.isWarpGatePlacementMode && mirror.isSelected) {
            const particleCount = 8;
            const particleRadius = Math.max(1.2, size * 0.08);
            const orbitRadius = size * 1.25;
            const timeOffset = timeSec * 1.8;
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < particleCount; i++) {
                const angle = timeOffset + (i * Math.PI * 2) / particleCount;
                const wobble = Math.sin(timeOffset * 1.4 + i * 1.9) * size * 0.25;
                const radius = orbitRadius + wobble;
                const particleX = screenPos.x + Math.cos(angle) * radius;
                const particleY = screenPos.y + Math.sin(angle) * radius;
                const alpha = 0.35 + 0.35 * Math.sin(timeOffset + i);
                const gradient = this.ctx.createRadialGradient(
                    particleX, particleY, 0,
                    particleX, particleY, particleRadius * 3
                );
                gradient.addColorStop(0, `rgba(180, 255, 255, ${alpha})`);
                gradient.addColorStop(1, 'rgba(120, 200, 255, 0)');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(particleX, particleY, particleRadius * 3, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = `rgba(220, 255, 255, ${Math.min(0.9, alpha + 0.3)})`;
                this.ctx.beginPath();
                this.ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }

        // Draw efficiency indicator (in world space, not rotated)
        if (mirror.efficiency < 1.0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw move order indicator if mirror has one
        if (mirror.moveOrder > 0 && mirror.targetPosition) {
            this.drawMoveOrderIndicator(mirror.position, mirror.targetPosition, mirror.moveOrder, displayColor);
        }

        // Check if mirror is regenerating (within influence radius of forge and below max health)
        const forge = mirror.owner.stellarForge;
        const isRegenerating = !!(forge && mirror.health < this.MIRROR_MAX_HEALTH &&
            mirror.position.distanceTo(forge.position) <= Constants.INFLUENCE_RADIUS);
        // Use player color based on whether this is the viewing player or enemy
        const playerColorToUse = (this.viewingPlayer && mirror.owner === this.viewingPlayer) 
            ? this.playerColor 
            : this.enemyColor;
        
        this.drawHealthDisplay(screenPos, mirror.health, this.MIRROR_MAX_HEALTH, size, -size - 10, 
            isRegenerating, 
            isRegenerating ? playerColorToUse : undefined);

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
            
            // Get cached SoL icon
            const solIcon = this.getSolEnergyIcon();
            const iconSize = 16 * this.zoom;
            const textY = screenPos.y + size + 16 * this.zoom;
            
            // Calculate text width to center icon and text together
            this.ctx.font = `${12 * this.zoom}px Doto`;
            const energyText = `+${energyRate.toFixed(0)}/s`;
            const textWidth = this.ctx.measureText(energyText).width;
            const spacing = Constants.SOL_ICON_TEXT_SPACING * this.zoom;
            const totalWidth = iconSize + spacing + textWidth; // icon + spacing + text
            const startX = screenPos.x - totalWidth / 2;
            
            // Draw icon
            if (solIcon.complete && solIcon.naturalWidth > 0) {
                this.ctx.drawImage(solIcon, startX, textY - iconSize / 2, iconSize, iconSize);
            }
            
            // Draw text
            this.ctx.fillStyle = '#FFFFAA';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(energyText, startX + iconSize + spacing, textY);
        }
    }

    /**
     * Draw space dust particle with lightweight circle rendering
     */
    private drawSpaceDust(particle: SpaceDustParticle, game: GameState, viewingPlayerIndex: number | null): void {
        const screenPos = this.worldToScreen(particle.position);
        const baseSize = Constants.DUST_PARTICLE_SIZE * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');

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

        const isHighGraphics = this.graphicsQuality === 'high' || this.graphicsQuality === 'ultra';
        let lightAngle: number | null = null;
        let sunProximity = 0;
        if (isHighGraphics && game.suns.length > 0 && !ladSun) {
            let nearestSun: Sun | null = null;
            let nearestDistance = Infinity;
            for (const sun of game.suns) {
                const distance = particle.position.distanceTo(sun.position);
                if (distance < nearestDistance) {
                    nearestSun = sun;
                    nearestDistance = distance;
                }
            }

            if (nearestSun && nearestDistance > 0) {
                const maxDistance = Constants.DUST_SHADOW_MAX_DISTANCE_PX;
                sunProximity = Math.max(0, 1 - Math.min(1, nearestDistance / maxDistance));
                if (sunProximity > 0) {
                    const dx = particle.position.x - nearestSun.position.x;
                    const dy = particle.position.y - nearestSun.position.y;
                    lightAngle = Math.atan2(dy, dx);
                }
            }
        }

        let glowLevel = particle.glowState;
        if (particle.glowTransition > 0 && particle.glowState !== particle.targetGlowState) {
            glowLevel = particle.glowState + (particle.targetGlowState - particle.glowState) * particle.glowTransition;
        }

        const isOnLightSide = ladSun ? particle.position.x < ladSun.position.x : false;
        const dustColor = ladSun ? (isOnLightSide ? '#000000' : '#FFFFFF') : particle.currentColor;

        if (ladSun) {
            glowLevel = 0;
        }

        const velocityX = particle.velocity.x;
        const velocityY = particle.velocity.y;
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (speed > Constants.DUST_TRAIL_MIN_SPEED_PX_PER_SEC) {
            const invSpeed = 1 / speed;
            const dirX = velocityX * invSpeed;
            const dirY = velocityY * invSpeed;
            const perpX = -dirY;
            const perpY = dirX;
            const trailLengthPx = Math.min(
                Constants.DUST_TRAIL_MAX_LENGTH_PX,
                Math.max(Constants.DUST_TRAIL_MIN_LENGTH_PX, speed * Constants.DUST_TRAIL_LENGTH_PER_SPEED)
            );
            const trailLength = trailLengthPx * this.zoom;
            const trailOffsetX = perpX * baseSize;
            const trailOffsetY = perpY * baseSize;
            const trailEndX = dirX * trailLength;
            const trailEndY = dirY * trailLength;
            const leftStartX = screenPos.x + trailOffsetX;
            const leftStartY = screenPos.y + trailOffsetY;
            const rightStartX = screenPos.x - trailOffsetX;
            const rightStartY = screenPos.y - trailOffsetY;
            const leftEndX = leftStartX - trailEndX;
            const leftEndY = leftStartY - trailEndY;
            const rightEndX = rightStartX - trailEndX;
            const rightEndY = rightStartY - trailEndY;

            this.ctx.lineWidth = Math.max(0.2, Constants.DUST_TRAIL_WIDTH_PX * this.zoom);
            if (this.isFancyGraphicsEnabled && dustColor.startsWith('#')) {
                let hex = dustColor.slice(1);
                if (hex.length === 3) {
                    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
                }
                const colorInt = parseInt(hex, 16);
                const trailR = (colorInt >> 16) & 0xff;
                const trailG = (colorInt >> 8) & 0xff;
                const trailB = colorInt & 0xff;
                const trailAlpha = 0.6;
                const leftGradient = this.ctx.createLinearGradient(leftStartX, leftStartY, leftEndX, leftEndY);
                leftGradient.addColorStop(0, `rgba(${trailR}, ${trailG}, ${trailB}, ${trailAlpha})`);
                leftGradient.addColorStop(1, `rgba(${trailR}, ${trailG}, ${trailB}, 0)`);
                this.ctx.strokeStyle = leftGradient;
                this.ctx.beginPath();
                this.ctx.moveTo(leftStartX, leftStartY);
                this.ctx.lineTo(leftEndX, leftEndY);
                this.ctx.stroke();

                const rightGradient = this.ctx.createLinearGradient(rightStartX, rightStartY, rightEndX, rightEndY);
                rightGradient.addColorStop(0, `rgba(${trailR}, ${trailG}, ${trailB}, ${trailAlpha})`);
                rightGradient.addColorStop(1, `rgba(${trailR}, ${trailG}, ${trailB}, 0)`);
                this.ctx.strokeStyle = rightGradient;
                this.ctx.beginPath();
                this.ctx.moveTo(rightStartX, rightStartY);
                this.ctx.lineTo(rightEndX, rightEndY);
                this.ctx.stroke();
            } else {
                this.ctx.strokeStyle = dustColor;
                this.ctx.globalAlpha = 0.45;
                this.ctx.beginPath();
                this.ctx.moveTo(leftStartX, leftStartY);
                this.ctx.lineTo(leftEndX, leftEndY);
                this.ctx.moveTo(rightStartX, rightStartY);
                this.ctx.lineTo(rightEndX, rightEndY);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }
        }

        if (isHighGraphics && speed > Constants.DUST_SLOW_MOVEMENT_THRESHOLD) {
            const disturbanceBlend = Math.max(
                0,
                Math.min(
                    1,
                    (speed - Constants.DUST_SLOW_MOVEMENT_THRESHOLD)
                    / Math.max(0.001, Constants.DUST_FAST_MOVEMENT_THRESHOLD - Constants.DUST_SLOW_MOVEMENT_THRESHOLD)
                )
            );
            glowLevel = Math.max(glowLevel, 0.2 + disturbanceBlend * 0.55);
        }

        if (isHighGraphics && glowLevel > 0) {
            const glowSize = baseSize * (1.2 + glowLevel * 0.35);
            this.ctx.fillStyle = dustColor;
            this.ctx.globalAlpha = 0.15 + glowLevel * 0.1;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }

        if (isHighGraphics && this.isFancyGraphicsEnabled) {
            const bloomSize = baseSize * (1.6 + glowLevel * 0.6);
            const bloomIntensity = 0.25 + glowLevel * 0.2;
            this.drawFancyBloom(screenPos, bloomSize, dustColor, bloomIntensity);
        }

        this.ctx.fillStyle = dustColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, baseSize, 0, Math.PI * 2);
        this.ctx.fill();

        if (isHighGraphics && !inShadow && !ladSun && game.suns.length > 0) {
            const shadowAlphaScale = this.graphicsQuality === 'ultra' ? 1 : 0.72;
            this.drawParticleSunShadowTrail(particle.position, screenPos, baseSize, game.suns, Constants.DUST_SHADOW_MAX_DISTANCE_PX, 1, shadowAlphaScale);
        }

        if (isHighGraphics && lightAngle !== null && sunProximity > 0 && !inShadow) {
            const qualityFactor = this.graphicsQuality === 'ultra' ? 1.0 : 0.8;
            const sheenArc = Math.PI * 0.55;
            const litSheenAlpha = (0.08 + sunProximity * 0.12 + glowLevel * 0.09) * qualityFactor;
            this.ctx.strokeStyle = `rgba(255, 240, 185, ${Math.min(0.35, litSheenAlpha).toFixed(4)})`;
            this.ctx.lineWidth = Math.max(0.2, baseSize * 0.7);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, baseSize * 0.92, lightAngle - sheenArc / 2, lightAngle + sheenArc / 2);
            this.ctx.stroke();

            const shadowAngle = lightAngle + Math.PI;
            const shadeAlpha = (0.1 + sunProximity * 0.12) * qualityFactor;
            this.ctx.strokeStyle = `rgba(0, 0, 10, ${Math.min(0.34, shadeAlpha).toFixed(4)})`;
            this.ctx.lineWidth = Math.max(0.22, baseSize * 0.85);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, baseSize * 0.9, shadowAngle - sheenArc / 2, shadowAngle + sheenArc / 2);
            this.ctx.stroke();
        }
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
        if ((this.graphicsQuality !== 'high' && this.graphicsQuality !== 'ultra') || game.suns.length === 0) {
            return;
        }

        const ladSun = game.suns.find(s => s.type === 'lad');
        if (ladSun || game.isPointInShadow(worldPos)) {
            return;
        }

        const opacity = options?.opacity ?? 1;
        if (opacity <= 0) {
            return;
        }

        const alphaScale = this.graphicsQuality === 'ultra' ? 1 : 0.72;
        this.drawParticleSunShadowTrail(
            worldPos,
            screenPos,
            Math.max(1, screenSize),
            game.suns,
            Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
            opacity,
            alphaScale
        );

        const spriteMask = options?.spriteMask;
        const spriteSize = options?.spriteSize ?? screenSize;
        if (spriteMask && spriteSize > 0) {
            this.drawSpriteSunShadowSilhouette(
                worldPos,
                screenPos,
                spriteMask,
                spriteSize,
                options?.spriteRotation ?? 0,
                game.suns,
                opacity,
                alphaScale
            );
        }

        const particleCount = Math.max(0, options?.particleCount ?? 3);
        if (particleCount === 0) {
            return;
        }

        const spread = Math.max(screenSize * 0.4, options?.particleSpread ?? screenSize * 0.7);
        const particleRadius = Math.max(0.6, screenSize * 0.1);
        const widthScale = Math.max(0.35, options?.widthScale ?? 0.75);
        const time = performance.now() * 0.001;

        this.ctx.save();
        for (let i = 0; i < particleCount; i++) {
            const seed = worldPos.x * 0.013 + worldPos.y * 0.017 + i * 19.7;
            const baseAngle = this.getPseudoRandom(seed) * Math.PI * 2;
            const orbit = spread * (0.3 + this.getPseudoRandom(seed + 3.1) * 0.7);
            const drift = 0.65 + this.getPseudoRandom(seed + 7.2) * 0.75;
            const wobble = Math.sin(time * drift + seed) * spread * 0.14;
            const particleX = screenPos.x + Math.cos(baseAngle + time * 0.28) * (orbit + wobble);
            const particleY = screenPos.y + Math.sin(baseAngle + time * 0.22) * (orbit + wobble * 0.8);

            this.ctx.fillStyle = `rgba(6, 7, 16, ${(0.2 * opacity * alphaScale).toFixed(4)})`;
            this.ctx.beginPath();
            this.ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.drawParticleSunShadowTrail(
                worldPos,
                new Vector2D(particleX, particleY),
                particleRadius * widthScale,
                game.suns,
                Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
                opacity * 0.85,
                alphaScale
            );
        }
        this.ctx.restore();
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
        const blurPx = Math.max(1.4, spriteSize * 0.08);

        for (const sun of suns) {
            const dx = worldPos.x - sun.position.x;
            const dy = worldPos.y - sun.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 0 || distance >= Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX) {
                continue;
            }

            const invDistance = 1 / distance;
            const dirX = dx * invDistance;
            const dirY = dy * invDistance;
            const proximity = 1 - Math.max(0, Math.min(1, distance / Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX));
            const maxOffset = Math.max(
                spriteSize * 0.75,
                Constants.DUST_SHADOW_LENGTH_PX * this.zoom * (0.32 + proximity * 0.28)
            );

            this.ctx.save();
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.filter = `blur(${blurPx.toFixed(2)}px)`;

            const shadowLayers = 3;
            for (let i = 0; i < shadowLayers; i++) {
                const t = (i + 1) / shadowLayers;
                const offset = maxOffset * t;
                const alpha = (0.2 * (1 - t * 0.38) * opacity * alphaScale);
                if (alpha <= 0) {
                    continue;
                }
                const drawX = screenPos.x + dirX * offset;
                const drawY = screenPos.y + dirY * offset;

                this.ctx.save();
                this.ctx.translate(drawX, drawY);
                this.ctx.rotate(rotationRad);
                this.ctx.globalAlpha = alpha;
                this.ctx.drawImage(
                    spriteMask,
                    -spriteSize / 2,
                    -spriteSize / 2,
                    spriteSize,
                    spriteSize
                );
                this.ctx.restore();
            }

            this.ctx.restore();
        }
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
        for (const sun of suns) {
            const dx = worldPos.x - sun.position.x;
            const dy = worldPos.y - sun.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0 || distance >= maxDistance) {
                continue;
            }

            const invDistance = 1 / distance;
            const dirX = dx * invDistance;
            const dirY = dy * invDistance;
            const proximity = 1 - Math.max(0, Math.min(1, distance / maxDistance));
            const shadowLength = Math.max(
                screenSize * 2.4,
                Constants.DUST_SHADOW_LENGTH_PX * this.zoom * (0.9 + proximity * 0.8)
            );
            const tailX = screenPos.x + dirX * shadowLength;
            const tailY = screenPos.y + dirY * shadowLength;
            const gradient = this.ctx.createLinearGradient(screenPos.x, screenPos.y, tailX, tailY);
            gradient.addColorStop(0, `rgba(2, 3, 10, ${(0.34 * opacity * alphaScale).toFixed(4)})`);
            gradient.addColorStop(0.55, `rgba(2, 3, 10, ${(0.16 * opacity * alphaScale).toFixed(4)})`);
            gradient.addColorStop(1, 'rgba(2, 3, 10, 0)');
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = Math.max(0.35, screenSize * (0.7 + proximity * 0.65));
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(tailX, tailY);
            this.ctx.stroke();
        }
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
    private drawAsteroid(asteroid: Asteroid, suns: Sun[]): void {
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

        const lightDirection = this.getAsteroidLightDirection(asteroid, suns);
        this.drawAsteroidFacets(asteroid, lightDirection, asteroidFill, asteroidStroke, screenVertices);
        this.drawAsteroidRimLighting(worldVertices, screenVertices, lightDirection, asteroid.size);
    }

    private getAsteroidLightDirection(asteroid: Asteroid, suns: Sun[]): Vector2D {
        if (suns.length === 0) {
            return new Vector2D(1, -0.2);
        }

        let closestSun = suns[0];
        let closestDistanceSq = Infinity;
        for (const sun of suns) {
            const dx = sun.position.x - asteroid.position.x;
            const dy = sun.position.y - asteroid.position.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestSun = sun;
            }
        }

        const toSun = new Vector2D(
            closestSun.position.x - asteroid.position.x,
            closestSun.position.y - asteroid.position.y
        );
        return toSun.normalize();
    }

    private drawAsteroidFacets(
        asteroid: Asteroid,
        lightDirection: Vector2D,
        asteroidFill: string,
        asteroidStroke: string,
        screenVertices: Vector2D[]
    ): void {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let vertexIndex = 1; vertexIndex < screenVertices.length; vertexIndex++) {
            this.ctx.lineTo(screenVertices[vertexIndex].x, screenVertices[vertexIndex].y);
        }
        this.ctx.closePath();
        this.ctx.clip();

        const asteroidRenderCache = this.getAsteroidRenderCache(asteroid);
        const rotationCos = Math.cos(asteroid.rotation);
        const rotationSin = Math.sin(asteroid.rotation);

        for (let i = 0; i < asteroidRenderCache.facets.length; i++) {
            const facet = asteroidRenderCache.facets[i];
            const worldA = this.rotateAndTranslateLocalPoint(facet.points[0], asteroid, rotationCos, rotationSin);
            const worldB = this.rotateAndTranslateLocalPoint(facet.points[1], asteroid, rotationCos, rotationSin);
            const worldC = this.rotateAndTranslateLocalPoint(facet.points[2], asteroid, rotationCos, rotationSin);

            const centroidWorld = this.rotateAndTranslateLocalPoint(facet.centroidLocal, asteroid, rotationCos, rotationSin);
            const normalWorld = new Vector2D(
                centroidWorld.x - asteroid.position.x,
                centroidWorld.y - asteroid.position.y
            ).normalize();

            const diffuse = normalWorld.x * lightDirection.x + normalWorld.y * lightDirection.y;
            const lightFacingFactor = Math.max(0, diffuse);
            const shadowFacingFactor = Math.max(0, -diffuse);
            const directionalShadeFactor = 1 + lightFacingFactor * 0.22 - shadowFacingFactor * 0.62;
            const facetShadeFactor = Math.min(1.14, Math.max(0.3, facet.baseShadeFactor * directionalShadeFactor));
            const facetColor = this.adjustColorBrightness(asteroidFill, facetShadeFactor);
            const facetStrokeColor = this.adjustColorBrightness(
                asteroidStroke,
                Math.min(1.05, Math.max(0.24, facetShadeFactor - 0.12))
            );

            const screenA = this.worldToScreen(worldA);
            const screenB = this.worldToScreen(worldB);
            const screenC = this.worldToScreen(worldC);

            this.ctx.fillStyle = facetColor;
            this.ctx.strokeStyle = facetStrokeColor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(screenA.x, screenA.y);
            this.ctx.lineTo(screenB.x, screenB.y);
            this.ctx.lineTo(screenC.x, screenC.y);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();

        this.ctx.strokeStyle = asteroidStroke;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            this.ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
    }

    private drawAsteroidRimLighting(worldVertices: Vector2D[], screenVertices: Vector2D[], lightDirection: Vector2D, asteroidSize: number): void {
        const centerWorld = new Vector2D(
            worldVertices.reduce((sum, vertex) => sum + vertex.x, 0) / worldVertices.length,
            worldVertices.reduce((sum, vertex) => sum + vertex.y, 0) / worldVertices.length
        );
        const centerScreen = this.worldToScreen(new Vector2D(
            centerWorld.x,
            centerWorld.y
        ));
        const approxRadiusScreen = asteroidSize * this.zoom;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            this.ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        this.ctx.closePath();
        this.ctx.clip();

        const gradientStartX = centerScreen.x - lightDirection.x * approxRadiusScreen;
        const gradientStartY = centerScreen.y - lightDirection.y * approxRadiusScreen;
        const gradientEndX = centerScreen.x + lightDirection.x * approxRadiusScreen;
        const gradientEndY = centerScreen.y + lightDirection.y * approxRadiusScreen;
        const isUltraQuality = this.graphicsQuality === 'ultra';
        const rimGradient = this.ctx.createLinearGradient(gradientStartX, gradientStartY, gradientEndX, gradientEndY);
        rimGradient.addColorStop(0, isUltraQuality ? 'rgba(0, 0, 0, 0.74)' : 'rgba(0, 0, 0, 0.44)');
        rimGradient.addColorStop(0.45, isUltraQuality ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.14)');
        rimGradient.addColorStop(0.72, isUltraQuality ? 'rgba(235, 205, 145, 0.08)' : 'rgba(255, 233, 180, 0.06)');
        rimGradient.addColorStop(1, isUltraQuality ? 'rgba(255, 234, 176, 0.12)' : 'rgba(255, 239, 194, 0.2)');
        this.ctx.fillStyle = rimGradient;
        this.ctx.fillRect(
            centerScreen.x - approxRadiusScreen * 1.4,
            centerScreen.y - approxRadiusScreen * 1.4,
            approxRadiusScreen * 2.8,
            approxRadiusScreen * 2.8
        );
        this.ctx.restore();

        for (let i = 0; i < worldVertices.length; i++) {
            const currentVertex = worldVertices[i];
            const nextVertex = worldVertices[(i + 1) % worldVertices.length];
            const currentScreen = screenVertices[i];
            const nextScreen = screenVertices[(i + 1) % screenVertices.length];

            const midpointX = (currentVertex.x + nextVertex.x) * 0.5;
            const midpointY = (currentVertex.y + nextVertex.y) * 0.5;
            const normalXRaw = nextVertex.y - currentVertex.y;
            const normalYRaw = -(nextVertex.x - currentVertex.x);
            const midpointToCenterX = midpointX - centerWorld.x;
            const midpointToCenterY = midpointY - centerWorld.y;
            const outwardSign = midpointToCenterX * normalXRaw + midpointToCenterY * normalYRaw >= 0 ? 1 : -1;

            const normalLength = Math.hypot(normalXRaw, normalYRaw);
            if (normalLength <= 0.0001) {
                continue;
            }

            const normalX = (normalXRaw / normalLength) * outwardSign;
            const normalY = (normalYRaw / normalLength) * outwardSign;
            const edgeFacingLight = normalX * lightDirection.x + normalY * lightDirection.y;

            if (edgeFacingLight > 0.14) {
                const highlightAlpha = isUltraQuality
                    ? Math.pow(edgeFacingLight, 1.3) * 0.32
                    : Math.pow(edgeFacingLight, 1.2) * 0.42;
                this.ctx.strokeStyle = `rgba(255, 226, 150, ${highlightAlpha.toFixed(3)})`;
                this.ctx.lineWidth = isUltraQuality ? this.ASTEROID_RIM_HIGHLIGHT_WIDTH + 1 : this.ASTEROID_RIM_HIGHLIGHT_WIDTH;
                this.ctx.beginPath();
                this.ctx.moveTo(currentScreen.x, currentScreen.y);
                this.ctx.lineTo(nextScreen.x, nextScreen.y);
                this.ctx.stroke();
            } else if (edgeFacingLight < -0.08) {
                const shadowAlpha = isUltraQuality ? -edgeFacingLight * 0.88 : -edgeFacingLight * 0.64;
                this.ctx.strokeStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`;
                this.ctx.lineWidth = isUltraQuality ? this.ASTEROID_RIM_SHADOW_WIDTH + 1 : this.ASTEROID_RIM_SHADOW_WIDTH;
                this.ctx.beginPath();
                this.ctx.moveTo(currentScreen.x, currentScreen.y);
                this.ctx.lineTo(nextScreen.x, nextScreen.y);
                this.ctx.stroke();
            }
        }
    }

    private rotateAndTranslateLocalPoint(localPoint: Vector2D, asteroid: Asteroid, rotationCos: number, rotationSin: number): Vector2D {
        return new Vector2D(
            asteroid.position.x + localPoint.x * rotationCos - localPoint.y * rotationSin,
            asteroid.position.y + localPoint.x * rotationSin + localPoint.y * rotationCos
        );
    }

    private getAsteroidRenderCache(asteroid: Asteroid): AsteroidRenderCache {
        const cached = this.asteroidRenderCache.get(asteroid);
        if (cached) {
            return cached;
        }

        const facets = this.generateAsteroidFacets(asteroid);
        const generatedCache: AsteroidRenderCache = {
            facets,
            facetCount: facets.length
        };
        this.asteroidRenderCache.set(asteroid, generatedCache);
        return generatedCache;
    }

    private generateAsteroidFacets(asteroid: Asteroid): AsteroidFacet[] {
        if (asteroid.vertices.length < 3) {
            return [];
        }

        const asteroidSeed = this.computeAsteroidSeed(asteroid);
        const centerLocal = new Vector2D(
            asteroid.vertices.reduce((sum, vertex) => sum + vertex.x, 0) / asteroid.vertices.length,
            asteroid.vertices.reduce((sum, vertex) => sum + vertex.y, 0) / asteroid.vertices.length
        );

        const facets: AsteroidFacet[] = [];
        for (let facetIndex = 0; facetIndex < asteroid.vertices.length; facetIndex++) {
            const pointA = centerLocal;
            const pointB = asteroid.vertices[facetIndex];
            const pointC = asteroid.vertices[(facetIndex + 1) % asteroid.vertices.length];

            const centroidLocal = new Vector2D(
                (pointA.x + pointB.x + pointC.x) / 3,
                (pointA.y + pointB.y + pointC.y) / 3
            );
            const baseShadeFactor = 0.9 + this.hashNormalized(asteroidSeed + facetIndex * 31.37) * 0.2;

            facets.push({ points: [pointA, pointB, pointC], centroidLocal, baseShadeFactor });
        }

        return facets;
    }

    private computeAsteroidSeed(asteroid: Asteroid): number {
        return asteroid.position.x * 0.1031 + asteroid.position.y * 0.11369 + asteroid.size * 0.13787 + asteroid.sides * 0.173;
    }

    private hashNormalized(inputValue: number): number {
        const sineValue = Math.sin(inputValue * 43758.5453123);
        return sineValue - Math.floor(sineValue);
    }

    private hashSigned(inputValue: number): number {
        return this.hashNormalized(inputValue) * 2 - 1;
    }

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

    private ensureLightingLayer(): CanvasRenderingContext2D {
        if (!this.lightingLayerCanvas) {
            this.lightingLayerCanvas = document.createElement('canvas');
            this.lightingLayerCtx = this.lightingLayerCanvas.getContext('2d');
        }

        if (!this.lightingLayerCtx || !this.lightingLayerCanvas) {
            throw new Error('Failed to initialize lighting layer context');
        }

        if (this.lightingLayerCanvas.width !== this.canvas.width || this.lightingLayerCanvas.height !== this.canvas.height) {
            this.lightingLayerCanvas.width = this.canvas.width;
            this.lightingLayerCanvas.height = this.canvas.height;
        }

        this.lightingLayerCtx.clearRect(0, 0, this.lightingLayerCanvas.width, this.lightingLayerCanvas.height);
        return this.lightingLayerCtx;
    }

    private buildOrientedShadowOccluder(position: Vector2D, rotationRad: number, sizeWorld: number): Vector2D[] {
        const halfSizeWorld = sizeWorld * 0.5;
        const cosTheta = Math.cos(rotationRad);
        const sinTheta = Math.sin(rotationRad);
        const localCorners = [
            { x: -halfSizeWorld, y: -halfSizeWorld },
            { x: halfSizeWorld, y: -halfSizeWorld },
            { x: halfSizeWorld, y: halfSizeWorld },
            { x: -halfSizeWorld, y: halfSizeWorld }
        ];
        const worldVertices: Vector2D[] = [];

        for (const corner of localCorners) {
            worldVertices.push(new Vector2D(
                position.x + corner.x * cosTheta - corner.y * sinTheta,
                position.y + corner.x * sinTheta + corner.y * cosTheta
            ));
        }

        return worldVertices;
    }

    private appendShadowQuadsFromVertices(sun: Sun, worldVertices: Vector2D[], quads: ShadowQuad[]): void {
        const sunX = sun.position.x;
        const sunY = sun.position.y;
        const vertexCount = worldVertices.length;
        const sv1 = this.sunRayScreenPosA;
        const sv2 = this.sunRayScreenPosB;
        const ss1 = this.sunRayScreenPosC;
        const ss2 = this.sunRayScreenPosD;

        for (let i = 0; i < vertexCount; i++) {
            const v1 = worldVertices[i];
            const v2 = worldVertices[(i + 1) % vertexCount];
            const edgeCenterX = (v1.x + v2.x) * 0.5;
            const edgeCenterY = (v1.y + v2.y) * 0.5;
            const toSunX = sunX - edgeCenterX;
            const toSunY = sunY - edgeCenterY;
            const edgeNormalX = -(v2.y - v1.y);
            const edgeNormalY = v2.x - v1.x;
            const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

            if (dot >= 0) {
                continue;
            }

            const dirFromSun1X = v1.x - sunX;
            const dirFromSun1Y = v1.y - sunY;
            const dirFromSun2X = v2.x - sunX;
            const dirFromSun2Y = v2.y - sunY;
            const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
            const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
            const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
            const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
            const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
            const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
            const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
            const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

            this.worldToScreenCoords(v1.x, v1.y, sv1);
            this.worldToScreenCoords(v2.x, v2.y, sv2);
            this.worldToScreenCoords(shadow1X, shadow1Y, ss1);
            this.worldToScreenCoords(shadow2X, shadow2Y, ss2);

            quads.push({
                sv1x: sv1.x,
                sv1y: sv1.y,
                sv2x: sv2.x,
                sv2y: sv2.y,
                ss1x: ss1.x,
                ss1y: ss1.y,
                ss2x: ss2.x,
                ss2y: ss2.y,
            });
        }
    }

    private collectSunShadowOccluders(game: GameState): ShadowOccluder[] {
        const occluders: ShadowOccluder[] = [];

        for (const player of game.players) {
            for (const unit of player.units) {
                if (unit instanceof Starling) {
                    occluders.push({ position: unit.position, rotationRad: unit.rotation, sizeWorld: 8 * 0.3 * Constants.STARLING_SPRITE_SCALE_FACTOR });
                } else if (unit.isHero) {
                    occluders.push({ position: unit.position, rotationRad: unit.rotation, sizeWorld: 8 * this.HERO_SPRITE_SCALE });
                }
            }

            for (const mirror of player.solarMirrors) {
                occluders.push({ position: mirror.position, rotationRad: mirror.reflectionAngle, sizeWorld: 14 * 2.4 });
            }
        }

        return occluders;
    }

    private buildSunShadowQuads(sun: Sun, game: GameState): ShadowQuad[] {
        const quads: ShadowQuad[] = [];

        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            this.appendShadowQuadsFromVertices(sun, worldVertices, quads);
        }

        const entityOccluders = this.collectSunShadowOccluders(game);
        for (const occluder of entityOccluders) {
            const worldVertices = this.buildOrientedShadowOccluder(occluder.position, occluder.rotationRad, occluder.sizeWorld);
            this.appendShadowQuadsFromVertices(sun, worldVertices, quads);
        }

        return quads;
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
        const targetCtx = this.ctx;
        const lightingCtx = this.ensureLightingLayer();
        this.ctx = lightingCtx;

        // Draw ambient lighting layers for each sun (brighter closer to sun)
        for (const sun of game.suns) {
            const sunScreenPos = this.worldToScreen(sun.position);
            const maxRadius = Math.max(this.canvas.width, this.canvas.height) * 2;
            const shadowQuads = this.buildSunShadowQuads(sun, game);

            // Create radial gradient centered on the sun
            const gradient = this.ctx.createRadialGradient(
                sunScreenPos.x, sunScreenPos.y, 0,
                sunScreenPos.x, sunScreenPos.y, maxRadius
            );

            // Use warmer color scheme and brighter shade edges for cinematic lighting
            gradient.addColorStop(0, 'rgba(255, 192, 96, 0.42)');
            gradient.addColorStop(0.18, 'rgba(255, 166, 70, 0.28)');
            gradient.addColorStop(0.42, 'rgba(255, 140, 56, 0.16)');
            gradient.addColorStop(1, 'rgba(255, 120, 45, 0)');

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            if (this.isFancyGraphicsEnabled) {
                const bloomGradient = this.ctx.createRadialGradient(
                    sunScreenPos.x, sunScreenPos.y, 0,
                    sunScreenPos.x, sunScreenPos.y, maxRadius * 1.1
                );
                bloomGradient.addColorStop(0, 'rgba(255, 232, 178, 0.68)');
                bloomGradient.addColorStop(0.16, 'rgba(255, 190, 104, 0.44)');
                bloomGradient.addColorStop(0.38, 'rgba(255, 146, 74, 0.24)');
                bloomGradient.addColorStop(1, 'rgba(255, 122, 58, 0)');
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'screen';
                this.ctx.fillStyle = bloomGradient;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.restore();
            }

            if (this.graphicsQuality === 'ultra') {
                this.drawUltraVolumetricShafts(sun, game.gameTime, shadowQuads);
            }

            if (shadowQuads.length > 0) {
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'screen';
                this.ctx.strokeStyle = 'rgba(255, 160, 74, 0.2)';
                this.ctx.lineWidth = Math.max(1.25, 2.4 * this.zoom);
                for (const quad of shadowQuads) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(quad.sv1x, quad.sv1y);
                    this.ctx.lineTo(quad.ss1x, quad.ss1y);
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(quad.sv2x, quad.sv2y);
                    this.ctx.lineTo(quad.ss2x, quad.ss2y);
                    this.ctx.stroke();
                }
                this.ctx.restore();
            }
        }

        // Cut out any area occluded from the sun so the background remains visible through shadows.
        for (const sun of game.suns) {
            const shadowQuads = this.buildSunShadowQuads(sun, game);
            if (shadowQuads.length === 0) {
                continue;
            }

            this.ctx.save();
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            this.ctx.beginPath();

            for (const quad of shadowQuads) {
                this.ctx.moveTo(quad.sv1x, quad.sv1y);
                this.ctx.lineTo(quad.sv2x, quad.sv2y);
                this.ctx.lineTo(quad.ss2x, quad.ss2y);
                this.ctx.lineTo(quad.ss1x, quad.ss1y);
                this.ctx.closePath();
            }

            this.ctx.fill();
            this.ctx.restore();
        }

        this.ctx = targetCtx;
        targetCtx.drawImage(this.lightingLayerCanvas!, 0, 0);
    }

    private drawUltraVolumetricShafts(sun: Sun, gameTimeSec: number, shadowQuads: ShadowQuad[]): void {
        const sunScreenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;
        const sunRenderCache = this.getOrCreateSunRenderCache(screenRadius);
        const shaftScale = 1.95 + Math.sin(gameTimeSec * 0.07) * 0.03;
        const shimmerAlpha = 0.08 + (Math.sin(gameTimeSec * 0.62 + sun.position.x * 0.003) + 1) * 0.04;

        this.ctx.save();
        this.ctx.translate(sunScreenPos.x, sunScreenPos.y);
        this.ctx.rotate(gameTimeSec * 0.01 + Math.sin(gameTimeSec * 0.05) * 0.015);
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = 0.58;
        const shaftSize = 1024 * shaftScale;
        this.ctx.drawImage(sunRenderCache.shaftTextureOuter, -shaftSize / 2, -shaftSize / 2, shaftSize, shaftSize);

        this.ctx.rotate(-gameTimeSec * 0.017);
        this.ctx.globalAlpha = 0.45 + shimmerAlpha;
        const innerSize = shaftSize * 0.72;
        this.ctx.drawImage(sunRenderCache.shaftTextureInner, -innerSize / 2, -innerSize / 2, innerSize, innerSize);

        this.ctx.restore();

        if (shadowQuads.length === 0) {
            return;
        }

        // Remove shafts inside asteroid shade to prevent ultra shafts leaking through occlusion.
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        this.ctx.beginPath();
        for (const quad of shadowQuads) {
            this.ctx.moveTo(quad.sv1x, quad.sv1y);
            this.ctx.lineTo(quad.sv2x, quad.sv2y);
            this.ctx.lineTo(quad.ss2x, quad.ss2y);
            this.ctx.lineTo(quad.ss1x, quad.ss1y);
            this.ctx.closePath();
        }
        this.ctx.fill();
        this.ctx.restore();
    }

    private drawUltraSunParticleLayers(game: GameState): void {
        if (game.suns.length === 0) {
            return;
        }

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';

        for (const sun of game.suns) {
            if (sun.type === 'lad') {
                continue;
            }

            const sunScreenPos = this.worldToScreen(sun.position);
            const screenRadius = sun.radius * this.zoom;

            for (let emberIndex = 0; emberIndex < this.ULTRA_SOLAR_EMBER_COUNT; emberIndex++) {
                const seed = emberIndex * 13.37 + sun.position.x * 0.013 + sun.position.y * 0.011;
                const outwardT = (game.gameTime * (0.16 + this.hashNormalized(seed + 2.2) * 0.22) + this.hashNormalized(seed + 11.5) * 7.0) % 1;
                const orbitAngle = emberIndex * 0.193 + this.hashSigned(seed * 0.97) * 0.25;
                const radius = screenRadius * (0.4 + outwardT * (2.1 + this.hashNormalized(seed + 7.3) * 1.6));
                const x = sunScreenPos.x + Math.cos(orbitAngle) * radius;
                const y = sunScreenPos.y + Math.sin(orbitAngle) * radius;
                const size = 0.7 + this.hashNormalized(seed + 17.1) * 2.2;
                const alpha = (0.06 + this.hashNormalized(seed + 19.9) * 0.24) * (1 - outwardT * 0.45);

                this.ctx.fillStyle = `rgba(255, ${Math.floor(126 + this.hashNormalized(seed + 23.7) * 64)}, ${Math.floor(36 + this.hashNormalized(seed + 29.2) * 42)}, ${alpha.toFixed(4)})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size * this.zoom, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        for (let dustIndex = 0; dustIndex < this.ULTRA_LIGHT_DUST_COUNT; dustIndex++) {
            const seed = dustIndex * 31.91;
            const driftX = (game.gameTime * (0.6 + this.hashNormalized(seed + 1.7) * 0.5) + seed) % width;
            const driftY = (game.gameTime * (0.35 + this.hashNormalized(seed + 3.4) * 0.4) + seed * 1.7) % height;
            const size = 0.8 + this.hashNormalized(seed + 5.2) * 2.5;
            const alpha = 0.03 + this.hashNormalized(seed + 8.1) * 0.06;

            this.ctx.fillStyle = `rgba(255, 182, 112, ${alpha.toFixed(4)})`;
            this.ctx.beginPath();
            this.ctx.arc(driftX, driftY, size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    private applyUltraWarmCoolGrade(game: GameState): void {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply';
        const coolVignette = this.ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.85);
        coolVignette.addColorStop(0, 'rgba(255, 255, 255, 1)');
        coolVignette.addColorStop(1, 'rgba(138, 155, 210, 0.94)');
        this.ctx.fillStyle = coolVignette;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.globalCompositeOperation = 'screen';
        for (const sun of game.suns) {
            if (sun.type === 'lad') {
                continue;
            }
            const sunScreenPos = this.worldToScreen(sun.position);
            const warmGradient = this.ctx.createRadialGradient(sunScreenPos.x, sunScreenPos.y, 0, sunScreenPos.x, sunScreenPos.y, Math.max(width, height) * 0.45);
            warmGradient.addColorStop(0, 'rgba(255, 178, 74, 0.28)');
            warmGradient.addColorStop(0.34, 'rgba(255, 148, 62, 0.18)');
            warmGradient.addColorStop(1, 'rgba(255, 112, 46, 0)');
            this.ctx.fillStyle = warmGradient;
            this.ctx.fillRect(0, 0, width, height);
        }

        this.ctx.restore();
    }

    private applyUltraShadowReinforcement(game: GameState): void {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply';

        for (const sun of game.suns) {
            const shadowQuads = this.buildSunShadowQuads(sun, game);
            if (shadowQuads.length === 0) {
                continue;
            }

            this.ctx.fillStyle = 'rgba(32, 30, 44, 0.8)';
            this.ctx.beginPath();
            for (const quad of shadowQuads) {
                this.ctx.moveTo(quad.sv1x, quad.sv1y);
                this.ctx.lineTo(quad.sv2x, quad.sv2y);
                this.ctx.lineTo(quad.ss2x, quad.ss2y);
                this.ctx.lineTo(quad.ss1x, quad.ss1y);
                this.ctx.closePath();
            }
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    private drawLadSunRays(game: GameState, sun: Sun): void {
        const sunScreenPos = this.worldToScreen(sun.position);
        
        // Draw left half (white light)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, sunScreenPos.x, this.canvas.height);
        this.ctx.clip();
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Draw right half (black "light")
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(sunScreenPos.x, 0, this.canvas.width - sunScreenPos.x, this.canvas.height);
        this.ctx.clip();
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Draw asteroid shadows - dark shadows on left (white) side, light shadows on right (dark) side
        this.ctx.save();
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        let hasLightSideShadow = false;
        const sunX = sun.position.x;
        const sunY = sun.position.y;
        const sv1 = this.sunRayScreenPosA;
        const sv2 = this.sunRayScreenPosB;
        const ss1 = this.sunRayScreenPosC;
        const ss2 = this.sunRayScreenPosD;

        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            const vertexCount = worldVertices.length;

            // For each edge of the asteroid, cast a shadow
            for (let i = 0; i < vertexCount; i++) {
                const v1 = worldVertices[i];
                const v2 = worldVertices[(i + 1) % vertexCount];

                // Calculate if this edge faces away from the sun
                const edgeCenterX = (v1.x + v2.x) * 0.5;
                const edgeCenterY = (v1.y + v2.y) * 0.5;
                const toSunX = sunX - edgeCenterX;
                const toSunY = sunY - edgeCenterY;
                const edgeNormalX = -(v2.y - v1.y);
                const edgeNormalY = v2.x - v1.x;
                const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

                if (dot < 0) {
                    // This edge is facing away from the sun, cast shadow
                    const dirFromSun1X = v1.x - sunX;
                    const dirFromSun1Y = v1.y - sunY;
                    const dirFromSun2X = v2.x - sunX;
                    const dirFromSun2Y = v2.y - sunY;
                    const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
                    const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
                    const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
                    const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
                    const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
                    const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
                    const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
                    const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

                    // Determine which side of the field the shadow is on
                    const shadowCenterX = (shadow1X + shadow2X) * 0.5;
                    const isOnLightSide = shadowCenterX < sunX;

                    if (isOnLightSide) {
                        this.worldToScreenCoords(v1.x, v1.y, sv1);
                        this.worldToScreenCoords(v2.x, v2.y, sv2);
                        this.worldToScreenCoords(shadow1X, shadow1Y, ss1);
                        this.worldToScreenCoords(shadow2X, shadow2Y, ss2);

                        this.ctx.moveTo(sv1.x, sv1.y);
                        this.ctx.lineTo(sv2.x, sv2.y);
                        this.ctx.lineTo(ss2.x, ss2.y);
                        this.ctx.lineTo(ss1.x, ss1.y);
                        this.ctx.closePath();
                        hasLightSideShadow = true;
                    }
                }
            }
        }

        if (hasLightSideShadow) {
            this.ctx.fill();
        }
        this.ctx.restore();

        this.ctx.save();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        let hasDarkSideShadow = false;

        for (const asteroid of game.asteroids) {
            const worldVertices = asteroid.getWorldVertices();
            const vertexCount = worldVertices.length;

            // For each edge of the asteroid, cast a shadow
            for (let i = 0; i < vertexCount; i++) {
                const v1 = worldVertices[i];
                const v2 = worldVertices[(i + 1) % vertexCount];

                // Calculate if this edge faces away from the sun
                const edgeCenterX = (v1.x + v2.x) * 0.5;
                const edgeCenterY = (v1.y + v2.y) * 0.5;
                const toSunX = sunX - edgeCenterX;
                const toSunY = sunY - edgeCenterY;
                const edgeNormalX = -(v2.y - v1.y);
                const edgeNormalY = v2.x - v1.x;
                const dot = toSunX * edgeNormalX + toSunY * edgeNormalY;

                if (dot < 0) {
                    // This edge is facing away from the sun, cast shadow
                    const dirFromSun1X = v1.x - sunX;
                    const dirFromSun1Y = v1.y - sunY;
                    const dirFromSun2X = v2.x - sunX;
                    const dirFromSun2Y = v2.y - sunY;
                    const dirFromSun1Length = Math.sqrt(dirFromSun1X * dirFromSun1X + dirFromSun1Y * dirFromSun1Y);
                    const dirFromSun2Length = Math.sqrt(dirFromSun2X * dirFromSun2X + dirFromSun2Y * dirFromSun2Y);
                    const dirFromSun1Scale = dirFromSun1Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun1Length;
                    const dirFromSun2Scale = dirFromSun2Length === 0 ? 0 : Constants.SHADOW_LENGTH / dirFromSun2Length;
                    const shadow1X = v1.x + dirFromSun1X * dirFromSun1Scale;
                    const shadow1Y = v1.y + dirFromSun1Y * dirFromSun1Scale;
                    const shadow2X = v2.x + dirFromSun2X * dirFromSun2Scale;
                    const shadow2Y = v2.y + dirFromSun2Y * dirFromSun2Scale;

                    // Determine which side of the field the shadow is on
                    const shadowCenterX = (shadow1X + shadow2X) * 0.5;
                    const isOnLightSide = shadowCenterX < sunX;

                    if (!isOnLightSide) {
                        this.worldToScreenCoords(v1.x, v1.y, sv1);
                        this.worldToScreenCoords(v2.x, v2.y, sv2);
                        this.worldToScreenCoords(shadow1X, shadow1Y, ss1);
                        this.worldToScreenCoords(shadow2X, shadow2Y, ss2);

                        this.ctx.moveTo(sv1.x, sv1.y);
                        this.ctx.lineTo(sv2.x, sv2.y);
                        this.ctx.lineTo(ss2.x, ss2.y);
                        this.ctx.lineTo(ss1.x, ss1.y);
                        this.ctx.closePath();
                        hasDarkSideShadow = true;
                    }
                }
            }
        }

        if (hasDarkSideShadow) {
            this.ctx.fill();
        }
        this.ctx.restore();
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
    private drawWarpGate(gate: WarpGate, game: GameState, ladSun: Sun | undefined): void {
        const screenPos = this.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * this.zoom;
        const chargeProgress = gate.chargeTime / Constants.WARP_GATE_CHARGE_TIME;
        const currentRadius = Math.min(maxRadius, chargeProgress * maxRadius);
        const isSelected = this.selectedWarpGate === gate;
        const isVelarisGate = gate.owner.faction === Faction.VELARIS;
        const displayColor = this.getLadPlayerColor(gate.owner, ladSun, game);

        this.drawAestheticSpriteShadow(gate.position, screenPos, maxRadius * 0.9, game, {
            opacity: gate.isComplete ? 0.95 : 0.55,
            widthScale: 0.85,
            particleCount: gate.isComplete ? 5 : 3,
            particleSpread: maxRadius * 0.9
        });

        if (!gate.isComplete) {
            if (isVelarisGate) {
                this.drawVelarisWarpGateVortex(gate, screenPos, currentRadius, game.gameTime, displayColor);
            } else {
                // Draw charging effect
                this.ctx.strokeStyle = '#00FFFF';
                this.ctx.lineWidth = 3;
                this.ctx.globalAlpha = 0.5 + Math.sin(gate.chargeTime * 5) * 0.2;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }

            // Draw charge progress
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, currentRadius + 5, 0, chargeProgress * Math.PI * 2);
            this.ctx.stroke();
            
            // Draw energy progress text
            const energyProgress = `${gate.accumulatedEnergy.toFixed(0)}/${Constants.WARP_GATE_ENERGY_REQUIRED}`;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${12 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(energyProgress, screenPos.x, screenPos.y + maxRadius + 20 * this.zoom);
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        } else {
            if (isVelarisGate) {
                this.drawVelarisWarpGateVortex(gate, screenPos, maxRadius, game.gameTime, displayColor);
            } else {
                this.drawWarpGateProductionEffect(screenPos, maxRadius, game, displayColor);
            }
            if (isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, maxRadius);
            }

            const completionProgress = gate.completionRemainingSec / Constants.WARP_GATE_COMPLETION_WINDOW_SEC;
            if (completionProgress > 0) {
                const countdownRadius = maxRadius + 12 * this.zoom;
                this.ctx.strokeStyle = '#FFD700';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(
                    screenPos.x,
                    screenPos.y,
                    countdownRadius,
                    -Math.PI / 2,
                    -Math.PI / 2 + completionProgress * Math.PI * 2
                );
                this.ctx.stroke();
            }

            if (isSelected) {
                const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.zoom;
                const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.zoom;
                const hasSubFactory = gate.owner.buildings.some((building) => building instanceof SubsidiaryFactory);
                const playerEnergy = gate.owner.energy;
                
                // Faction-specific building buttons
                let buttonConfigs: Array<{ label: string; index: number; isAvailable: boolean }>;
                if (gate.owner.faction === Faction.RADIANT) {
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        },
                        {
                            label: 'Cannon',
                            index: 1,
                            isAvailable: playerEnergy >= Constants.MINIGUN_COST
                        },
                        {
                            label: 'Gatling',
                            index: 2,
                            isAvailable: playerEnergy >= Constants.GATLING_COST
                        },
                        {
                            label: 'Shield',
                            index: 3,
                            isAvailable: playerEnergy >= Constants.SHIELD_TOWER_COST
                        }
                    ];
                } else if (gate.owner.faction === Faction.VELARIS) {
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        },
                        {
                            label: 'Striker',
                            index: 1,
                            isAvailable: playerEnergy >= Constants.STRIKER_TOWER_COST
                        },
                        {
                            label: 'Lock-on',
                            index: 2,
                            isAvailable: playerEnergy >= Constants.LOCKON_TOWER_COST
                        },
                        {
                            label: 'Cyclone',
                            index: 3,
                            isAvailable: playerEnergy >= Constants.SWIRLER_COST
                        }
                    ];
                } else {
                    // Aurum or default - currently only Foundry is available
                    // TODO: Add Aurum-specific buildings in future updates
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        }
                    ];
                }
                
                const positions = this.getRadialButtonOffsets(buttonConfigs.length);

                for (let i = 0; i < buttonConfigs.length; i++) {
                    const config = buttonConfigs[i];
                    const pos = positions[i];
                    const btnX = screenPos.x + pos.x * buttonDistance;
                    const btnY = screenPos.y + pos.y * buttonDistance;
                    const labelOffset = buttonRadius + 14 * this.zoom;
                    const isHighlighted = config.isAvailable && this.highlightedButtonIndex === config.index;

                    if (config.isAvailable) {
                        this.ctx.fillStyle = isHighlighted ? 'rgba(0, 255, 255, 0.6)' : '#444444';
                        this.ctx.strokeStyle = '#00FFFF';
                        this.ctx.lineWidth = isHighlighted ? 4 : 2;
                    } else {
                        this.ctx.fillStyle = '#1F1F1F';
                        this.ctx.strokeStyle = '#555555';
                        this.ctx.lineWidth = 2;
                    }
                    this.ctx.beginPath();
                    this.ctx.arc(btnX, btnY, buttonRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.stroke();

                    // Draw button label
                    this.ctx.fillStyle = config.isAvailable ? '#FFFFFF' : '#777777';
                    this.ctx.font = `${11 * this.zoom}px Doto`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(
                        config.label,
                        btnX + pos.x * labelOffset,
                        btnY + pos.y * labelOffset
                    );
                }
            }
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Draw a starling merge gate
     */
    private drawStarlingMergeGate(gate: StarlingMergeGate, game: GameState): void {
        const screenPos = this.worldToScreen(gate.position);
        const radius = Constants.STARLING_MERGE_GATE_RADIUS_PX * this.zoom;
        const totalDuration = Constants.STARLING_MERGE_DURATION_SEC;
        const progress = totalDuration > 0 ? gate.remainingSec / totalDuration : 0;
        const pulse = 0.18 + Math.sin((totalDuration - gate.remainingSec) * 4) * 0.06;
        const glowAlpha = 0.35 + Math.sin((totalDuration - gate.remainingSec) * 5) * 0.1;

        this.drawAestheticSpriteShadow(gate.position, screenPos, radius * 0.92, game, {
            opacity: 0.85,
            widthScale: 0.82,
            particleCount: 4,
            particleSpread: radius * 0.9
        });

        this.ctx.fillStyle = `rgba(0, 255, 255, ${Math.max(0.1, pulse)})`;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = `rgba(0, 255, 255, ${Math.max(0.2, glowAlpha)})`;
        this.ctx.lineWidth = 2.5 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0.3, glowAlpha)})`;
        this.ctx.lineWidth = 1.5 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius * 0.65, 0, Math.PI * 2);
        this.ctx.stroke();

        const countdownRadius = radius + 7 * this.zoom;
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(
            screenPos.x,
            screenPos.y,
            countdownRadius,
            -Math.PI / 2,
            -Math.PI / 2 + progress * Math.PI * 2
        );
        this.ctx.stroke();

        const counterY = screenPos.y + radius + 10 * this.zoom;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `${12 * this.zoom}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(
            `${gate.absorbedCount}/${Constants.STARLING_MERGE_COUNT}`,
            screenPos.x,
            counterY
        );
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
    }

    /**
     * Draw command buttons for selected solar mirrors
     */
    private drawMirrorCommandButtons(mirrors: Set<SolarMirror>, timeSec: number): void {
        if (mirrors.size === 0) return;
        
        // Get one of the selected mirrors to determine button positions
        const firstMirror = Array.from(mirrors)[0];
        const screenPos = this.worldToScreen(firstMirror.position);
        
        const shouldShowFoundryButton = this.hasSeenFoundry;
        const hasFoundryAvailable = this.hasActiveFoundry;
        const isMirrorInSunlight = this.isSelectedMirrorInSunlight;
        
        const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.zoom;
        const buttonOffset = 50 * this.zoom; // Distance from mirror

        const buttonCount = isMirrorInSunlight ? (shouldShowFoundryButton ? 3 : 2) : 1;
        const positions = this.getRadialButtonOffsets(buttonCount);
        const forgePos = positions[0];
        const warpGatePos = isMirrorInSunlight ? positions[1] : null;
        const foundryPos = isMirrorInSunlight && shouldShowFoundryButton ? positions[2] : null;
        const forgeButtonX = screenPos.x + forgePos.x * buttonOffset;
        const forgeButtonY = screenPos.y + forgePos.y * buttonOffset;
        const warpGateButtonX = warpGatePos ? screenPos.x + warpGatePos.x * buttonOffset : screenPos.x;
        const warpGateButtonY = warpGatePos ? screenPos.y + warpGatePos.y * buttonOffset : screenPos.y;
        const foundryButtonX = foundryPos ? screenPos.x + foundryPos.x * buttonOffset : screenPos.x;
        const foundryButtonY = foundryPos ? screenPos.y + foundryPos.y * buttonOffset : screenPos.y;

        // Draw primary mirror button
        const isForgeHighlighted = this.highlightedButtonIndex === 0;
        this.ctx.fillStyle = isForgeHighlighted ? 'rgba(255, 215, 0, 0.4)' : '#444444';
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = isForgeHighlighted ? 4 : 2;
        this.ctx.beginPath();
        this.ctx.arc(forgeButtonX, forgeButtonY, buttonRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${11 * this.zoom}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        if (isMirrorInSunlight) {
            this.ctx.fillText('Forge', forgeButtonX, forgeButtonY);
        } else {
            this.ctx.fillText('To', forgeButtonX, forgeButtonY - 5 * this.zoom);
            this.ctx.fillText('Sun', forgeButtonX, forgeButtonY + 6 * this.zoom);
        }

        if (isMirrorInSunlight && warpGatePos) {
        // Draw "Warp Gate" button (center or right)
        const isWarpGateAvailable = this.canCreateWarpGateFromMirrors;
        const isWarpGateHighlighted = this.highlightedButtonIndex === 1 && isWarpGateAvailable;
        const isWarpGateArmed = this.isWarpGatePlacementMode && isWarpGateAvailable;
        const warpGatePulse = 0.35 + 0.25 * Math.sin(timeSec * 4);
        const warpGateFill = isWarpGateArmed
            ? `rgba(0, 255, 255, ${0.35 + warpGatePulse})`
            : (isWarpGateHighlighted ? 'rgba(0, 255, 255, 0.4)' : (isWarpGateAvailable ? '#444444' : '#2C2C2C'));
        this.ctx.fillStyle = warpGateFill;
        this.ctx.strokeStyle = isWarpGateAvailable ? (isWarpGateArmed ? '#B8FFFF' : '#00FFFF') : '#666666';
        this.ctx.lineWidth = isWarpGateHighlighted || isWarpGateArmed ? 4 : 2;
        if (isWarpGateArmed) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.strokeStyle = `rgba(120, 255, 255, ${0.35 + warpGatePulse})`;
            this.ctx.lineWidth = 6 * this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(warpGateButtonX, warpGateButtonY, buttonRadius + 5 * this.zoom, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }
        this.ctx.beginPath();
        this.ctx.arc(warpGateButtonX, warpGateButtonY, buttonRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = isWarpGateAvailable ? '#FFFFFF' : '#8A8A8A';
        this.ctx.font = `${9 * this.zoom}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Warp', warpGateButtonX, warpGateButtonY - 6 * this.zoom);
        this.ctx.fillText('Gate', warpGateButtonX, warpGateButtonY + 6 * this.zoom);
        }

        if (isMirrorInSunlight && shouldShowFoundryButton) {
            const isFoundryHighlighted = hasFoundryAvailable && this.highlightedButtonIndex === 2;
            const foundryFill = hasFoundryAvailable
                ? (isFoundryHighlighted ? 'rgba(160, 160, 160, 0.4)' : '#444444')
                : '#2C2C2C';
            const foundryStroke = hasFoundryAvailable ? '#B0B0B0' : '#666666';
            const foundryText = hasFoundryAvailable ? '#FFFFFF' : '#8A8A8A';

            this.ctx.fillStyle = foundryFill;
            this.ctx.strokeStyle = foundryStroke;
            this.ctx.lineWidth = isFoundryHighlighted ? 4 : 2;
            this.ctx.beginPath();
            this.ctx.arc(foundryButtonX, foundryButtonY, buttonRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = foundryText;
            this.ctx.font = `${9 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Found', foundryButtonX, foundryButtonY - 5 * this.zoom);
            this.ctx.fillText('ry', foundryButtonX, foundryButtonY + 6 * this.zoom);
        }

        // Reset text alignment
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
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
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        
        if (ladSun && unit.owner) {
            // Determine which side the unit's owner is on using shared utility
            ownerSide = unit.owner.stellarForge 
                ? game.getLadSide(unit.owner.stellarForge.position, ladSun)
                : 'light';
            
            if (ownerSide === 'light') {
                // Light side units: white color
                unitColor = '#FFFFFF';
            } else {
                // Dark side units: black color
                unitColor = '#000000';
            }
        }

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = unitColor;
        let visibilityAlpha = 1;
        let shadeGlowAlpha = 0;
        const isInShadow = !ladSun && game.isPointInShadow(unit.position);
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(unit.position, this.viewingPlayer, unit);
            visibilityAlpha = this.getEnemyVisibilityAlpha(unit, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            const isEnemyRevealedInShade = isInShadow && isVisible;
            shadeGlowAlpha = this.getShadeGlowAlpha(unit, isEnemyRevealedInShade);
            // Enemy units revealed in shadow should remain bright for readability.
        } else if (isInShadow) {
            shadeGlowAlpha = this.getShadeGlowAlpha(unit, true);
        } else {
            shadeGlowAlpha = this.getShadeGlowAlpha(unit, false);
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

        if (isSelected) {
            const isStarling = unit instanceof Starling;
            const selectionRadiusMultiplier = (unit.isHero || isStarling) ? 1.2 : 1.0;
            this.drawBuildingSelectionIndicator(screenPos, size * selectionRadiusMultiplier);
        }


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, size, auraColor, ownerSide);
        }

        // Draw unit body (circle) - use darkened color if should dim
        const heroSpritePath = unit.isHero ? this.getHeroSpritePath(unit) : null;
        const tintColor = shouldDim
            ? this.darkenColor(ladSun ? unitColor : (isEnemy ? this.enemyColor : this.playerColor), Constants.SHADE_OPACITY)
            : (ladSun ? unitColor : (isEnemy ? this.enemyColor : this.playerColor));
        const heroSprite = heroSpritePath
            ? this.getTintedSprite(heroSpritePath, tintColor)
            : null;
        const heroSpriteSize = size * this.HERO_SPRITE_SCALE;

        this.drawAestheticSpriteShadow(unit.position, screenPos, size, game, {
            opacity: 1,
            widthScale: 0.72,
            particleCount: 3,
            particleSpread: size * 0.6,
            spriteMask: heroSprite ?? undefined,
            spriteSize: heroSprite ? heroSpriteSize : undefined,
            spriteRotation: heroSprite ? unit.rotation : undefined
        });

        const glowColor = shouldDim
            ? this.darkenColor(displayColor, Constants.SHADE_OPACITY)
            : displayColor;
        const glowAlphaScale = isSelected ? 1.3 : 1;
        const shadeGlowBoost = 0.55 * shadeGlowAlpha;
        this.drawCachedUnitGlow(
            screenPos,
            size * (isSelected ? 2.25 : 1.95),
            glowColor,
            (glowAlphaScale + shadeGlowBoost) * visibilityAlpha
        );

        this.ctx.save();
        this.ctx.globalAlpha = visibilityAlpha;

        if (heroSprite) {
            const rotationRad = unit.rotation;
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(rotationRad);
            this.ctx.drawImage(
                heroSprite,
                -heroSpriteSize / 2,
                -heroSpriteSize / 2,
                heroSpriteSize,
                heroSpriteSize
            );
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = displayColor;
            this.ctx.strokeStyle = isSelected ? displayColor : (shouldDim ? this.darkenColor(displayColor, Constants.SHADE_OPACITY) : displayColor);
            this.ctx.lineWidth = isSelected ? 3 : 1;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        if (this.isFancyGraphicsEnabled) {
            const bloomColor = shouldDim ? this.darkenColor(displayColor, Constants.SHADE_OPACITY) : displayColor;
            const glowRadius = size * (isSelected ? 1.9 : 1.5);
            const glowIntensity = (isSelected ? 0.45 : 0.3) * visibilityAlpha;
            this.drawFancyBloom(screenPos, glowRadius, bloomColor, glowIntensity);
        }

        this.ctx.restore();

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
        
        // Draw animated movement point marker at target
        const dotRadius = this.MOVE_ORDER_DOT_RADIUS;
        const hasSprite = this.drawMovementPointMarker(targetScreenPos, dotRadius, color);
        if (!hasSprite) {
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(targetScreenPos.x, targetScreenPos.y, dotRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
    }

    private getMoveOrderFrameIndex(): number {
        const animationFrame = Math.floor(performance.now() / this.MOVE_ORDER_FRAME_DURATION_MS);
        return animationFrame % Constants.MOVEMENT_POINT_ANIMATION_FRAME_COUNT;
    }

    private drawMovementPointMarker(targetScreenPos: Vector2D, dotRadius: number, color: string): boolean {
        const frameIndex = this.getMoveOrderFrameIndex();
        const framePath = this.movementPointFramePaths[frameIndex];
        const tintedFrameSprite = this.getTintedSprite(framePath, color);
        if (tintedFrameSprite) {
            this.drawMovementPointSprite(tintedFrameSprite, targetScreenPos, dotRadius);
            return true;
        }

        const fallbackSprite = this.getTintedSprite(this.MOVE_ORDER_FALLBACK_SPRITE_PATH, color);
        if (fallbackSprite) {
            this.drawMovementPointSprite(fallbackSprite, targetScreenPos, dotRadius);
            return true;
        }

        return false;
    }

    private drawMovementPointSprite(sprite: HTMLCanvasElement, targetScreenPos: Vector2D, dotRadius: number): void {
        // Scale down movement points to 50% when zoomed all the way out
        const minZoom = this.getMinZoomForBounds();
        let sizeMultiplier = 1.0;
        if (this.zoom <= minZoom) {
            sizeMultiplier = 0.5;
        }
        
        const maxSize = dotRadius * 2 * sizeMultiplier;
        const scale = maxSize / Math.max(sprite.width, sprite.height);
        const drawWidth = sprite.width * scale;
        const drawHeight = sprite.height * scale;
        this.ctx.drawImage(
            sprite,
            targetScreenPos.x - drawWidth / 2,
            targetScreenPos.y - drawHeight / 2,
            drawWidth,
            drawHeight
        );
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
        if (bullet.isSpotlightBullet) {
            const angle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
            const length = (bullet.renderLengthPx ?? 8) * this.zoom;
            const width = (bullet.renderWidthPx ?? 2) * this.zoom;
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(angle);
            this.ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
            this.ctx.restore();
        } else {
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
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
     * Draw a Nova bomb (remote detonation bomb)
     */
    private drawNovaBomb(bomb: any): void {
        const screenPos = this.worldToScreen(bomb.position);
        const size = Constants.NOVA_BOMB_RADIUS * this.zoom;
        const color = this.getFactionColor(bomb.owner.faction);
        
        // Draw pulsing effect if armed
        if (bomb.isArmed) {
            const pulseIntensity = 0.5 + 0.5 * Math.sin(bomb.lifetime * 8);
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.2 * pulseIntensity;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw outer glow
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.4;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 1.4, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main bomb body
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw spinning highlight for armed state
        if (bomb.isArmed) {
            const angle = bomb.lifetime * 5; // Rotate faster
            const highlightX = screenPos.x + Math.cos(angle) * size * 0.6;
            const highlightY = screenPos.y + Math.sin(angle) * size * 0.6;
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.8;
            this.ctx.beginPath();
            this.ctx.arc(highlightX, highlightY, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Static highlight for unarmed state
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x - size * 0.3, screenPos.y - size * 0.3, size * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a Nova scatter bullet (from bomb explosion)
     */
    private drawNovaScatterBullet(bullet: any): void {
        const screenPos = this.worldToScreen(bullet.position);
        const size = 4 * this.zoom;
        const color = this.getFactionColor(bullet.owner.faction);
        
        // Calculate fade based on lifetime
        const alpha = 1.0 - (bullet.lifetime / bullet.maxLifetime);
        
        // Draw glow trail
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main bullet
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw bright center
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.globalAlpha = alpha * 0.6;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a Sticky Bomb (Sly projectile)
     */
    private drawStickyBomb(bomb: any): void {
        const screenPos = this.worldToScreen(bomb.position);
        const size = Constants.STICKY_BOMB_RADIUS * this.zoom;
        const color = this.getFactionColor(bomb.owner.faction);
        
        // Draw pulsing effect if armed and stuck
        if (bomb.isArmed && bomb.isStuck) {
            const pulseIntensity = 0.5 + 0.5 * Math.sin(bomb.lifetime * 10);
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.3 * pulseIntensity;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw outer glow
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = bomb.isStuck ? 0.5 : 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main bomb body
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw sticky substance (darker ring around bomb)
        if (bomb.isStuck) {
            this.ctx.fillStyle = '#000000';
            this.ctx.globalAlpha = 0.4;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw highlight
        if (bomb.isArmed && bomb.isStuck) {
            // Spinning highlight for armed state
            const angle = bomb.lifetime * 6;
            const highlightX = screenPos.x + Math.cos(angle) * size * 0.4;
            const highlightY = screenPos.y + Math.sin(angle) * size * 0.4;
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.9;
            this.ctx.beginPath();
            this.ctx.arc(highlightX, highlightY, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Static highlight
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.4;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x - size * 0.3, screenPos.y - size * 0.3, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw surface normal indicator if stuck
        if (bomb.isStuck && bomb.surfaceNormal) {
            this.ctx.strokeStyle = color;
            this.ctx.globalAlpha = 0.5;
            this.ctx.lineWidth = 2 * this.zoom;
            const normalLength = size * 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(
                screenPos.x + bomb.surfaceNormal.x * normalLength,
                screenPos.y + bomb.surfaceNormal.y * normalLength
            );
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a Sticky Laser (fired from sticky bomb)
     */
    private drawStickyLaser(laser: any): void {
        const startScreen = this.worldToScreen(laser.startPosition);
        const endPos = laser.getEndPosition();
        const endScreen = this.worldToScreen(endPos);
        const color = this.getFactionColor(laser.owner.faction);
        
        // Calculate fade based on lifetime
        const alpha = 1.0 - (laser.lifetime / laser.maxLifetime);
        
        // Draw outer glow
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = alpha * 0.2;
        this.ctx.lineWidth = laser.width * this.zoom * 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw middle glow
        this.ctx.globalAlpha = alpha * 0.5;
        this.ctx.lineWidth = laser.width * this.zoom * 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw core beam
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.lineWidth = laser.width * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw bright center line
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.globalAlpha = alpha * 0.7;
        this.ctx.lineWidth = laser.width * this.zoom * 0.3;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * Draw a disintegration particle (from expired sticky bomb)
     */
    private drawDisintegrationParticle(particle: any): void {
        const screenPos = this.worldToScreen(particle.position);
        const size = 3 * this.zoom;
        const color = this.getFactionColor(particle.owner.faction);
        
        // Calculate fade based on lifetime
        const alpha = 1.0 - (particle.lifetime / particle.maxLifetime);
        
        // Draw glow trail
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 1.8, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw main particle
        this.ctx.globalAlpha = alpha * 0.8;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add erratic flicker
        const flicker = Math.random();
        if (flicker > 0.7) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = alpha * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
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
        this.ctx.lineWidth = laser.widthPx;
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw a glowing outer beam
        this.ctx.globalAlpha = alpha * 0.3;
        this.ctx.lineWidth = laser.widthPx * 2;
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
     * Draw a sparkle particle (for regeneration effects)
     */
    private drawSparkleParticle(sparkle: SparkleParticle): void {
        const screenPos = this.worldToScreen(sparkle.position);
        const opacity = sparkle.getOpacity();
        const size = sparkle.size * this.zoom;
        
        // Draw sparkle as a bright star-shaped particle
        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.globalAlpha = opacity;
        
        // Draw a cross/star shape
        this.ctx.strokeStyle = sparkle.color;
        this.ctx.lineWidth = Math.max(1, size * 0.4);
        this.ctx.lineCap = 'round';
        
        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(-size, 0);
        this.ctx.lineTo(size, 0);
        this.ctx.stroke();
        
        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(0, size);
        this.ctx.stroke();
        
        // Draw a glowing center
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, sparkle.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    /**
     * Draw a death particle (breaking apart effect)
     */
    private drawDeathParticle(particle: DeathParticle, game: GameState): void {
        const screenPos = this.worldToScreen(particle.position);
        const ladSun = game.suns.find(s => s.type === 'lad');

        if ((this.graphicsQuality === 'high' || this.graphicsQuality === 'ultra') && game.suns.length > 0 && !ladSun) {
            const alphaScale = this.graphicsQuality === 'ultra' ? 1 : 0.72;
            const size = Math.max(1.1, (particle.spriteFragment?.width ?? 2) * this.zoom * 0.75);
            this.drawParticleSunShadowTrail(
                particle.position,
                screenPos,
                size,
                game.suns,
                Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
                particle.opacity,
                alphaScale
            );
        }

        if (particle.spriteFragment) {
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(particle.rotation);
            this.ctx.globalAlpha = particle.opacity;
            
            const size = particle.spriteFragment.width * this.zoom;
            this.ctx.drawImage(
                particle.spriteFragment,
                -size / 2,
                -size / 2,
                size,
                size
            );
            
            this.ctx.restore();
        }
    }
    
    /**
     * Draw an influence zone
     */
    private drawInfluenceZone(zone: InstanceType<typeof InfluenceZone>): void {
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
    private drawInfluenceBallProjectile(projectile: InstanceType<typeof InfluenceBallProjectile>): void {
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
    private drawCrescentWave(wave: InstanceType<typeof CrescentWave>): void {
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
    private drawDeployedTurret(turret: InstanceType<typeof DeployedTurret>, game: GameState): void {
        const screenPos = this.worldToScreen(turret.position);
        const ladSun = game.suns.find(s => s.type === 'lad');
        let color = this.getFactionColor(turret.owner.faction);
        if (ladSun && turret.owner) {
            const ownerSide = turret.owner.stellarForge
                ? game.getLadSide(turret.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                color = '#FFFFFF';
            } else {
                color = '#000000';
            }
        }
        
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

            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(rotationAngle + Math.PI / 2); // Add PI/2 because sprite top faces upward
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
    private drawGrave(grave: InstanceType<typeof Grave>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(grave.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            // Keep visible enemy heroes bright even while they are in shadow.
            if (!ladSun) {
                const inShadow = game.isPointInShadow(grave.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
            }
        }
        
        // Draw the base unit
        this.drawUnit(grave, displayColor, game, isEnemy);
        
        // Draw grapheme "G" in the center
        const screenPos = this.worldToScreen(grave.position);
        const glyphSize = 18 * this.zoom;
        const glyphColor = shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
        const graveGraphemePath = this.getVelarisGraphemeSpritePath('g');
        if (graveGraphemePath) {
            this.drawVelarisGraphemeSprite(
                graveGraphemePath,
                screenPos.x,
                screenPos.y,
                glyphSize,
                glyphColor
            );
        }
        
        // Draw large projectiles
        for (const projectile of grave.getProjectiles()) {
            this.drawGraveProjectile(projectile, displayColor);
        }
        
        // Draw small particles
        for (const smallParticle of grave.getSmallParticles()) {
            this.drawGraveSmallParticle(smallParticle, displayColor);
        }

        // Draw black hole if active
        const blackHole = grave.getBlackHole();
        if (blackHole) {
            this.drawGraveBlackHole(blackHole, displayColor);
        }

        // Check for explosions and trigger screen shake
        const explosionPositions = grave.getExplosionPositions();
        if (explosionPositions.length > 0) {
            // Trigger screen shake for each explosion
            for (const explosionPos of explosionPositions) {
                this.triggerScreenShake();
                
                // Optionally: draw explosion effect
                this.drawExplosionEffect(explosionPos);
            }
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
        
        // For merged ranges, draw only the outer boundary of overlapping circles
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
        this.ctx.beginPath();

        const twoPi = Math.PI * 2;
        const coverageEpsilonWorld = 0.5;
        const coverageEpsilonSq = coverageEpsilonWorld * coverageEpsilonWorld;
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;
        const cameraX = this.camera.x;
        const cameraY = this.camera.y;
        const zoom = this.zoom;
        const targetStepPx = 6;

        for (let i = 0; i < selectedStarlings.length; i++) {
            const starling = selectedStarlings[i];
            if (!this.isWithinViewBounds(starling.position, starling.attackRange)) {
                continue;
            }

            const originX = starling.position.x;
            const originY = starling.position.y;
            const radiusWorld = starling.attackRange;
            let isFullyCovered = false;
            let needsSampling = false;
            for (let j = 0; j < selectedStarlings.length; j++) {
                if (i === j) continue;
                const other = selectedStarlings[j];
                const dx = other.position.x - originX;
                const dy = other.position.y - originY;
                const distanceSq = dx * dx + dy * dy;
                const otherRadius = other.attackRange;
                if (distanceSq <= 0.0001) {
                    if (radiusWorld <= otherRadius) {
                        isFullyCovered = true;
                        break;
                    }
                    continue;
                }

                const distance = Math.sqrt(distanceSq);
                if (distance + radiusWorld <= otherRadius - coverageEpsilonWorld) {
                    isFullyCovered = true;
                    break;
                }

                const radiusDiff = Math.abs(radiusWorld - otherRadius);
                if (distance < radiusWorld + otherRadius - coverageEpsilonWorld &&
                    distance > radiusDiff + coverageEpsilonWorld) {
                    needsSampling = true;
                }
            }

            if (isFullyCovered) {
                continue;
            }

            const screenCenterX = centerX + (originX - cameraX) * zoom;
            const screenCenterY = centerY + (originY - cameraY) * zoom;
            const radiusScreen = radiusWorld * zoom;

            if (!needsSampling) {
                this.ctx.moveTo(screenCenterX + radiusScreen, screenCenterY);
                this.ctx.arc(screenCenterX, screenCenterY, radiusScreen, 0, twoPi);
                continue;
            }

            const stepRad = Math.min(0.25, Math.max(0.02, targetStepPx / Math.max(radiusScreen, 1)));
            let isDrawing = false;

            for (let angle = 0; angle <= twoPi + stepRad; angle += stepRad) {
                const clampedAngle = angle > twoPi ? twoPi : angle;
                const cosAngle = Math.cos(clampedAngle);
                const sinAngle = Math.sin(clampedAngle);
                const worldX = originX + cosAngle * radiusWorld;
                const worldY = originY + sinAngle * radiusWorld;

                let isCovered = false;
                for (let j = 0; j < selectedStarlings.length; j++) {
                    if (i === j) continue;
                    const other = selectedStarlings[j];
                    const dx = worldX - other.position.x;
                    const dy = worldY - other.position.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherRadius = other.attackRange;
                    const otherRadiusSq = otherRadius * otherRadius;
                    if (distanceSq <= otherRadiusSq - coverageEpsilonSq) {
                        isCovered = true;
                        break;
                    }
                }

                if (isCovered) {
                    if (isDrawing) {
                        isDrawing = false;
                    }
                    continue;
                }

                const screenX = centerX + (worldX - cameraX) * zoom;
                const screenY = centerY + (worldY - cameraY) * zoom;
                if (!isDrawing) {
                    this.ctx.moveTo(screenX, screenY);
                    isDrawing = true;
                } else {
                    this.ctx.lineTo(screenX, screenY);
                }
            }

        }

        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    private drawVisibleArcSegment(
        screenPos: Vector2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        minArcLengthRad: number
    ): void {
        if (endAngle <= startAngle) {
            return;
        }
        const twoPi = Math.PI * 2;
        if (endAngle - startAngle <= minArcLengthRad) {
            return;
        }
        const wrappedStart = startAngle % twoPi;
        const wrappedEnd = endAngle % twoPi;
        if (endAngle - startAngle >= twoPi) {
            this.ctx.moveTo(screenPos.x + radius, screenPos.y);
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, twoPi);
            return;
        }

        if (wrappedEnd < wrappedStart) {
            this.ctx.moveTo(
                screenPos.x + Math.cos(wrappedStart) * radius,
                screenPos.y + Math.sin(wrappedStart) * radius
            );
            this.ctx.arc(screenPos.x, screenPos.y, radius, wrappedStart, twoPi);
            this.ctx.moveTo(screenPos.x + radius, screenPos.y);
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, wrappedEnd);
            return;
        }

        this.ctx.moveTo(
            screenPos.x + Math.cos(wrappedStart) * radius,
            screenPos.y + Math.sin(wrappedStart) * radius
        );
        this.ctx.arc(screenPos.x, screenPos.y, radius, wrappedStart, wrappedEnd);
    }

    /**
     * Draw a Starling unit (minion from stellar forge)
     */
    private drawStarling(starling: Starling, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(starling.position);
        const size = 8 * this.zoom * 0.3; // Minion size (30% of normal unit)
        const isSelected = this.selectedUnits.has(starling);
        const ladSun = game.suns.find(s => s.type === 'lad');
        const isVelarisStarling = starling.owner.faction === Faction.VELARIS;
        
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        let shadeGlowAlpha = 0;
        const isInShadow = !ladSun && game.isPointInShadow(starling.position);
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(starling.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const isEnemyRevealedInShade = isInShadow && isVisible;
            shadeGlowAlpha = this.getShadeGlowAlpha(starling, isEnemyRevealedInShade);
            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (isInShadow) {
                shouldDim = false;
                displayColor = color;
            }
        } else if (isInShadow) {
            shadeGlowAlpha = this.getShadeGlowAlpha(starling, true);
        } else {
            shadeGlowAlpha = this.getShadeGlowAlpha(starling, false);
        }
        
        // Note: Range circles for starlings are drawn separately as merged outlines
        // in drawMergedStarlingRanges() before individual starlings are rendered
        if (isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, size * 1.1);
        }
        
        // Get starling sprite and color it with player color
        const starlingSpritePath = this.getStarlingSpritePath(starling);
        let starlingColor = isEnemy ? this.enemyColor : this.playerColor;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && starling.owner) {
            ownerSide = starling.owner.stellarForge
                ? game.getLadSide(starling.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                starlingColor = '#FFFFFF';
            } else {
                starlingColor = '#000000';
            }
        }
        const tintColor = shouldDim
            ? this.darkenColor(starlingColor, Constants.SHADE_OPACITY)
            : starlingColor;
        displayColor = tintColor;
        

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, size, auraColor, ownerSide);
        }
        
        const shadeGlowBoost = 0.55 * shadeGlowAlpha;
        this.drawCachedUnitGlow(
            screenPos,
            size * (isSelected ? 2.1 : 1.85),
            displayColor,
            (isSelected ? 1.2 : 1) + shadeGlowBoost
        );

        if (isVelarisStarling) {
            this.drawVelarisStarlingParticles(screenPos, size, starling, displayColor, game.gameTime);
        } else {
            const starlingSprite = starlingSpritePath 
                ? this.getTintedSprite(starlingSpritePath, tintColor)
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
                const strokeColor = displayColor;
                this.ctx.strokeStyle = isSelected ? strokeColor : (shouldDim ? this.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor);
                this.ctx.lineWidth = isSelected ? 3 : 1;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
        
        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, starling.health, starling.maxHealth, size, -size * 6 - 10);

        if (!isEnemy && starling.owner.hasBlinkUpgrade && starling.abilityCooldownTime > 0) {
            const barWidth = size * 8;
            const barHeight = Math.max(2, 3 * this.zoom);
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + size * 3.5;
            const cooldownPercent = Math.max(
                0,
                Math.min(1, 1 - (starling.abilityCooldown / starling.abilityCooldownTime))
            );

            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            this.ctx.fillStyle = '#00B4FF';
            this.ctx.fillRect(barX, barY, barWidth * cooldownPercent, barHeight);
        }
        
        // Note: Move order lines for starlings are drawn separately in drawStarlingMoveLines()
        // to show only a single line from the closest starling when multiple are selected
    }

    private drawVelarisStarlingParticles(
        screenPos: Vector2D,
        size: number,
        starling: Starling,
        displayColor: string,
        timeSec: number
    ): void {
        const velocityX = starling.velocity.x;
        const velocityY = starling.velocity.y;
        const velocitySq = velocityX * velocityX + velocityY * velocityY;
        const isMoving = velocitySq > 4;
        let isFiring = false;
        if (starling.target && 'position' in starling.target) {
            if (!('health' in starling.target) || starling.target.health > 0) {
                const targetPosition = starling.target.position;
                const dx = targetPosition.x - starling.position.x;
                const dy = targetPosition.y - starling.position.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq <= starling.attackRange * starling.attackRange) {
                    isFiring = true;
                }
            }
        }
        const isInactive = !isMoving && !isFiring;

        const isTriangleTarget = isMoving && !isFiring;
        const isPentagonTarget = isFiring;
        const hasShapeTarget = isTriangleTarget || isPentagonTarget;
        let state = this.starlingParticleStates.get(starling);
        if (!state) {
            state = {
                shapeBlend: hasShapeTarget ? 1 : 0,
                polygonBlend: isPentagonTarget ? 1 : 0,
                lastTimeSec: timeSec
            };
            this.starlingParticleStates.set(starling, state);
        }

        const deltaSec = Math.max(0, timeSec - state.lastTimeSec);
        state.lastTimeSec = timeSec;
        const blendStep = Math.min(1, deltaSec * this.VELARIS_STARLING_SHAPE_BLEND_SPEED);
        const targetShapeBlend = hasShapeTarget ? 1 : 0;
        const targetPolygonBlend = isPentagonTarget ? 1 : 0;
        state.shapeBlend += (targetShapeBlend - state.shapeBlend) * blendStep;
        state.polygonBlend += (targetPolygonBlend - state.polygonBlend) * blendStep;

        const particleRadius = Math.max(1, this.VELARIS_STARLING_PARTICLE_RADIUS_PX * this.zoom);
        const particleColor = this.brightenAndPaleColor(displayColor);
        const seedBase = this.getStarlingParticleSeed(starling) + starling.spriteLevel * 9.1;
        const twoPi = Math.PI * 2;
        const speed = Math.sqrt(velocitySq);
        const formationSpeedScale = hasShapeTarget ? Math.min(1, speed / 80) : 0;
        const polygonTimeScale = this.VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE
            + formationSpeedScale * this.VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE;
        const timeScale = this.VELARIS_STARLING_CLOUD_TIME_SCALE
            + (polygonTimeScale - this.VELARIS_STARLING_CLOUD_TIME_SCALE) * state.shapeBlend;
        const scaledTimeSec = timeSec * timeScale;
        const particleCount = this.VELARIS_STARLING_PARTICLE_COUNT;

        if (isInactive) {
            const graphemeIndex = Math.floor(
                this.getPseudoRandom(seedBase + 7.7) * this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS.length
            );
            const graphemePath = this.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS[graphemeIndex];
            const pulse = (Math.sin(timeSec * this.VELARIS_STARLING_GRAPHEME_PULSE_SPEED + seedBase) + 1) * 0.5;
            const graphemeAlpha = pulse * this.VELARIS_STARLING_GRAPHEME_ALPHA_MAX;
            const graphemeSize = size * this.VELARIS_STARLING_GRAPHEME_SIZE_SCALE;
            if (graphemePath && graphemeAlpha > 0) {
                this.ctx.save();
                this.ctx.globalAlpha = graphemeAlpha;
                this.drawVelarisGraphemeSprite(graphemePath, screenPos.x, screenPos.y, graphemeSize, displayColor);
                this.ctx.restore();
            }
        }

        this.ctx.save();
        this.ctx.fillStyle = particleColor;
        this.ctx.globalAlpha = 0.7 + 0.2 * state.shapeBlend;
        this.ctx.beginPath();

        const rotationRad = this.getStarlingFacingRotationRad(starling) ?? starling.rotation;
        const rotationOffsetRad = rotationRad - Math.PI / 2;
        const triangleRadius = size * this.VELARIS_STARLING_TRIANGLE_RADIUS_SCALE;
        const pentagonRadius = size * this.VELARIS_STARLING_PENTAGON_RADIUS_SCALE;
        const cloudRadius = size * this.VELARIS_STARLING_CLOUD_RADIUS_SCALE;
        const swirlRadius = cloudRadius * this.VELARIS_STARLING_CLOUD_SWIRL_SCALE;
        const wobbleScale = size * this.VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE;
        const triangleStep = twoPi / 3;
        const pentagonStep = twoPi / 5;

        for (let i = 0; i < particleCount; i++) {
            const seed = seedBase + i * 13.3;
            const edgeProgress = ((i / particleCount)
                + scaledTimeSec * this.VELARIS_STARLING_TRIANGLE_FLOW_SPEED
                + this.getPseudoRandom(seed + 5.9) * 0.2) % 1;
            const wobble = Math.sin(scaledTimeSec * this.VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED + seed) * wobbleScale;

            const triangleEdgeValue = edgeProgress * 3;
            const triangleEdgeIndex = Math.floor(triangleEdgeValue);
            const triangleEdgeT = triangleEdgeValue - triangleEdgeIndex;
            const triangleAngle0 = rotationOffsetRad + triangleEdgeIndex * triangleStep;
            const triangleAngle1 = rotationOffsetRad + (triangleEdgeIndex + 1) * triangleStep;
            const triangleStartX = Math.cos(triangleAngle0) * triangleRadius;
            const triangleStartY = Math.sin(triangleAngle0) * triangleRadius;
            const triangleEndX = Math.cos(triangleAngle1) * triangleRadius;
            const triangleEndY = Math.sin(triangleAngle1) * triangleRadius;
            const triangleEdgeX = triangleEndX - triangleStartX;
            const triangleEdgeY = triangleEndY - triangleStartY;
            const triangleEdgeLength = Math.sqrt(triangleEdgeX * triangleEdgeX + triangleEdgeY * triangleEdgeY) || 1;
            const triangleNormalX = -triangleEdgeY / triangleEdgeLength;
            const triangleNormalY = triangleEdgeX / triangleEdgeLength;
            const triangleBaseX = triangleStartX + triangleEdgeX * triangleEdgeT;
            const triangleBaseY = triangleStartY + triangleEdgeY * triangleEdgeT;
            const triangleOffsetX = triangleBaseX + triangleNormalX * wobble;
            const triangleOffsetY = triangleBaseY + triangleNormalY * wobble;

            const pentagonEdgeValue = edgeProgress * 5;
            const pentagonEdgeIndex = Math.floor(pentagonEdgeValue);
            const pentagonEdgeT = pentagonEdgeValue - pentagonEdgeIndex;
            const pentagonAngle0 = rotationOffsetRad + pentagonEdgeIndex * pentagonStep;
            const pentagonAngle1 = rotationOffsetRad + (pentagonEdgeIndex + 1) * pentagonStep;
            const pentagonStartX = Math.cos(pentagonAngle0) * pentagonRadius;
            const pentagonStartY = Math.sin(pentagonAngle0) * pentagonRadius;
            const pentagonEndX = Math.cos(pentagonAngle1) * pentagonRadius;
            const pentagonEndY = Math.sin(pentagonAngle1) * pentagonRadius;
            const pentagonEdgeX = pentagonEndX - pentagonStartX;
            const pentagonEdgeY = pentagonEndY - pentagonStartY;
            const pentagonEdgeLength = Math.sqrt(pentagonEdgeX * pentagonEdgeX + pentagonEdgeY * pentagonEdgeY) || 1;
            const pentagonNormalX = -pentagonEdgeY / pentagonEdgeLength;
            const pentagonNormalY = pentagonEdgeX / pentagonEdgeLength;
            const pentagonBaseX = pentagonStartX + pentagonEdgeX * pentagonEdgeT;
            const pentagonBaseY = pentagonStartY + pentagonEdgeY * pentagonEdgeT;
            const pentagonOffsetX = pentagonBaseX + pentagonNormalX * wobble;
            const pentagonOffsetY = pentagonBaseY + pentagonNormalY * wobble;

            const polygonOffsetX = triangleOffsetX + (pentagonOffsetX - triangleOffsetX) * state.polygonBlend;
            const polygonOffsetY = triangleOffsetY + (pentagonOffsetY - triangleOffsetY) * state.polygonBlend;

            const angle = this.getPseudoRandom(seed) * twoPi;
            const baseRadius = this.getPseudoRandom(seed + 1.3) * cloudRadius;
            const orbitSpeed = this.VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE
                + this.getPseudoRandom(seed + 2.1) * this.VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE;
            const orbitAngle = scaledTimeSec * orbitSpeed + this.getPseudoRandom(seed + 3.4) * twoPi;
            const pull = 0.7 + 0.2 * Math.sin(scaledTimeSec * this.VELARIS_STARLING_CLOUD_PULL_SPEED + seed);

            const cloudOffsetX = Math.cos(angle) * baseRadius * pull + Math.cos(orbitAngle) * swirlRadius * 0.3;
            const cloudOffsetY = Math.sin(angle) * baseRadius * pull + Math.sin(orbitAngle) * swirlRadius * 0.3;

            const offsetX = cloudOffsetX + (polygonOffsetX - cloudOffsetX) * state.shapeBlend;
            const offsetY = cloudOffsetY + (polygonOffsetY - cloudOffsetY) * state.shapeBlend;

            const particleX = screenPos.x + offsetX;
            const particleY = screenPos.y + offsetY;
            this.ctx.moveTo(particleX + particleRadius, particleY);
            this.ctx.arc(particleX, particleY, particleRadius, 0, twoPi);
        }

        this.ctx.fill();
        this.ctx.restore();
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
     * Draw a Ray unit (Velaris hero)
     */
    private drawRay(ray: InstanceType<typeof Ray>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ray.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(ray.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
     * Draw a Nova unit (Velaris hero)
     */
    private drawNova(nova: InstanceType<typeof Nova>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(nova.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(nova.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
            }
        }
        
        // Draw base unit
        this.drawUnit(nova, displayColor, game, isEnemy);
        
        // Draw Nova symbol (explosion star)
        const screenPos = this.worldToScreen(nova.position);
        const size = 10 * this.zoom;
        
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 2 * this.zoom;
        
        // Draw 4 diagonal lines forming a star/explosion shape
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 4) + (i * Math.PI / 2);
            const x1 = screenPos.x + Math.cos(angle) * size * 0.3;
            const y1 = screenPos.y + Math.sin(angle) * size * 0.3;
            const x2 = screenPos.x + Math.cos(angle) * size;
            const y2 = screenPos.y + Math.sin(angle) * size;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw an InfluenceBall unit (Velaris hero)
     */
    private drawInfluenceBall(ball: InstanceType<typeof InfluenceBall>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ball.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(ball.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
     * Draw a TurretDeployer unit (Velaris hero)
     */
    private drawTurretDeployer(deployer: InstanceType<typeof TurretDeployer>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(deployer.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(deployer.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
    private drawDriller(driller: InstanceType<typeof Driller>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

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
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(driller.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
    private drawDagger(dagger: InstanceType<typeof Dagger>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(dagger.position, this.viewingPlayer, dagger);
            if (!isVisible) {
                return; // Cloaked Dagger is invisible to enemies
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(dagger.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
    private drawBeam(beam: InstanceType<typeof Beam>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(beam.position, this.viewingPlayer, beam);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(beam.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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
        }

        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a Spotlight hero unit (Radiant hero)
     */
    private drawSpotlight(spotlight: InstanceType<typeof Spotlight>, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(spotlight.position, this.viewingPlayer, spotlight);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }

            if (!ladSun) {
                const inShadow = game.isPointInShadow(spotlight.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
            }
        }

        // Draw base unit
        this.drawUnit(spotlight, displayColor, game, isEnemy);

        // Draw spotlight icon (thin cone outline)
        const screenPos = this.worldToScreen(spotlight.position);
        const iconSize = 10 * this.zoom;
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - iconSize * 0.6);
        this.ctx.lineTo(screenPos.x + iconSize * 0.6, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + iconSize * 0.6);
        this.ctx.stroke();

        // Draw active spotlight cone
        if (spotlight.spotlightDirection && spotlight.spotlightLengthFactor > 0) {
            const rangePx = spotlight.spotlightRangePx * spotlight.spotlightLengthFactor;
            if (rangePx > 0) {
                const baseAngle = Math.atan2(spotlight.spotlightDirection.y, spotlight.spotlightDirection.x);
                const halfAngle = Constants.SPOTLIGHT_CONE_ANGLE_RAD / 2;
                const leftAngle = baseAngle - halfAngle;
                const rightAngle = baseAngle + halfAngle;

                const leftEnd = new Vector2D(
                    spotlight.position.x + Math.cos(leftAngle) * rangePx,
                    spotlight.position.y + Math.sin(leftAngle) * rangePx
                );
                const rightEnd = new Vector2D(
                    spotlight.position.x + Math.cos(rightAngle) * rangePx,
                    spotlight.position.y + Math.sin(rightAngle) * rangePx
                );

                const originScreen = screenPos;
                const leftScreen = this.worldToScreen(leftEnd);
                const rightScreen = this.worldToScreen(rightEnd);

                const coneOpacity = shouldDim ? 0.12 : 0.18;
                this.ctx.fillStyle = displayColor;
                this.ctx.globalAlpha = coneOpacity;
                this.ctx.beginPath();
                this.ctx.moveTo(originScreen.x, originScreen.y);
                this.ctx.lineTo(leftScreen.x, leftScreen.y);
                this.ctx.lineTo(rightScreen.x, rightScreen.y);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.globalAlpha = 0.6;
                this.ctx.strokeStyle = displayColor;
                this.ctx.lineWidth = 1.5 * this.zoom;
                this.ctx.beginPath();
                this.ctx.moveTo(originScreen.x, originScreen.y);
                this.ctx.lineTo(leftScreen.x, leftScreen.y);
                this.ctx.moveTo(originScreen.x, originScreen.y);
                this.ctx.lineTo(rightScreen.x, rightScreen.y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }
        }
    }

    /**
     * Draw a Mortar hero unit with detection cone visualization
     */
    private drawMortar(mortar: any, color: string, game: GameState, isEnemy: boolean): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mortar.position, this.viewingPlayer, mortar);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(mortar.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
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

    private drawPreist(preist: InstanceType<typeof Preist>, color: string, game: GameState, isEnemy: boolean): void {
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

    private drawTank(tank: InstanceType<typeof Tank>, color: string, game: GameState, isEnemy: boolean): void {
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
     * Draw warp gate effect for buildings that are warping in.
     */
    private drawWarpGateProductionEffect(
        screenPos: { x: number; y: number },
        radius: number,
        game: GameState,
        displayColor: string
    ): void {
        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/warpGate_bottom.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/warpGate_top.png';
        const bottomSprite = this.getTintedSprite(bottomSpritePath, displayColor);
        const topSprite = this.getTintedSprite(topSpritePath, displayColor);
        const referenceSprite = bottomSprite || topSprite;
        if (!referenceSprite) {
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            return;
        }

        const spriteScale = (radius * 2) / referenceSprite.width;
        const timeSec = game.gameTime;
        const rotationSpeedRad = 0.9;
        const bottomRotationRad = -timeSec * rotationSpeedRad;
        const topRotationRad = timeSec * rotationSpeedRad;

        const drawLayer = (sprite: HTMLCanvasElement | null, rotationRad: number): void => {
            if (!sprite) {
                return;
            }
            const spriteWidth = sprite.width * spriteScale;
            const spriteHeight = sprite.height * spriteScale;
            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(rotationRad);
            this.ctx.drawImage(
                sprite,
                -spriteWidth / 2,
                -spriteHeight / 2,
                spriteWidth,
                spriteHeight
            );
            this.ctx.restore();
        };

        drawLayer(bottomSprite, bottomRotationRad);
        drawLayer(topSprite, topRotationRad);
    }

    /**
     * Draw a Cannon/Gatling building
     */
    private drawMinigun(building: Minigun | GatlingTower, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        const isVelarisFoundry = building.owner.faction === Faction.VELARIS;
        let buildingColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && building.owner) {
            ownerSide = building.owner.stellarForge
                ? game.getLadSide(building.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                buildingColor = '#FFFFFF';
            } else {
                buildingColor = '#000000';
            }
        }
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = buildingColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.drawWarpGateProductionEffect(
                screenPos,
                radius,
                game,
                displayColor
            );

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

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


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, radius, auraColor, ownerSide);
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

            this.ctx.save();
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(gunAngle + Math.PI / 2);
            this.ctx.drawImage(
                topSprite,
                -topWidth / 2,
                -topHeight / 2,
                topWidth,
                topHeight
            );
            this.ctx.restore();
        } else {
            // Draw base (circular platform)
            this.ctx.fillStyle = displayColor;
            const strokeColor = displayColor;
            this.ctx.strokeStyle = shouldDim ? this.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor;
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
     * Draw a Cyclone (Space Dust Swirler) building
     */
    private drawSpaceDustSwirler(building: SpaceDustSwirler, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        let buildingColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && building.owner) {
            ownerSide = building.owner.stellarForge
                ? game.getLadSide(building.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                buildingColor = '#FFFFFF';
            } else {
                buildingColor = '#000000';
            }
        }
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = buildingColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.drawWarpGateProductionEffect(
                screenPos,
                radius,
                game,
                displayColor
            );

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

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


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_bottom.png';
        const middleSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_middle.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_top.png';

        const bottomSprite = this.getTintedSprite(bottomSpritePath, displayColor);
        const middleSprite = this.getTintedSprite(middleSpritePath, displayColor);
        const topSprite = this.getTintedSprite(topSpritePath, displayColor);

        const referenceSprite = bottomSprite || middleSprite || topSprite;
        if (referenceSprite) {
            const spriteScale = (radius * 2) / referenceSprite.width;
            const timeSec = game.gameTime;
            const middleRotationRad = -timeSec * 0.6;
            const topRotationRad = timeSec * 0.8;

            const drawLayer = (sprite: HTMLCanvasElement | null, rotationRad: number): void => {
                if (!sprite) {
                    return;
                }
                const spriteWidth = sprite.width * spriteScale;
                const spriteHeight = sprite.height * spriteScale;
                this.ctx.save();
                this.ctx.translate(screenPos.x, screenPos.y);
                this.ctx.rotate(rotationRad);
                this.ctx.drawImage(
                    sprite,
                    -spriteWidth / 2,
                    -spriteHeight / 2,
                    spriteWidth,
                    spriteHeight
                );
                this.ctx.restore();
            };

            drawLayer(bottomSprite, 0);

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

            drawLayer(middleSprite, middleRotationRad);
            drawLayer(topSprite, topRotationRad);
        }

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Foundry building
     */
    private drawSubsidiaryFactory(building: SubsidiaryFactory, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        const isVelarisFoundry = building.owner.faction === Faction.VELARIS;
        let buildingColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && building.owner) {
            ownerSide = building.owner.stellarForge
                ? game.getLadSide(building.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                buildingColor = '#FFFFFF';
            } else {
                buildingColor = '#000000';
            }
        }
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = buildingColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.drawWarpGateProductionEffect(
                screenPos,
                radius,
                game,
                displayColor
            );

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

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


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        const isAurumFoundry = building.owner.faction === Faction.AURUM;
        
        if (isAurumFoundry) {
            // Draw Aurum foundry with moving triangles outline - slightly smaller
            this.drawAurumFoundryOutline(
                building,
                screenPos,
                radius * 0.85, // Slightly smaller than forge
                displayColor,
                game.gameTime
            );
            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
                this.drawFoundryButtons(building, screenPos);
            }
        } else if (isVelarisFoundry) {
            this.drawVelarisFoundrySigil(building, screenPos, radius, displayColor, game.gameTime, shouldDim);
            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
                this.drawFoundryButtons(building, screenPos);
            }
        } else {
            const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_bottom.png';
            const middleSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_middle.png';
            const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_top.png';

            const bottomSprite = this.getTintedSprite(bottomSpritePath, displayColor);
            const middleSprite = this.getTintedSprite(middleSpritePath, displayColor);
            const topSprite = this.getTintedSprite(topSpritePath, displayColor);

            const referenceSprite = bottomSprite || middleSprite || topSprite;
            if (referenceSprite) {
                const spriteScale = (radius * 2) / referenceSprite.width;
                const timeSec = game.gameTime;
                const isProducing = Boolean(building.currentProduction);
                
                // Always spin at base speed, increase 2.5x when producing
                // Smooth acceleration/deceleration based on production progress
                const baseSpinSpeedRad = 0.2; // Base slow spin speed
                const producingMultiplier = 2.5;
                const ACCELERATION_PHASE_DURATION = 0.2; // Accelerate during first 20% of production
                
                // Calculate speed multiplier with smooth acceleration/deceleration
                // At start of production (progress=0): speed = 1.0
                // At middle of production (progress=0.5): speed = 2.5
                // At end of production (progress=1.0): speed = 2.5 (stays fast until production completes)
                let speedMultiplier = 1.0;
                if (isProducing) {
                    // Smooth acceleration in first 20% of production
                    if (building.productionProgress < ACCELERATION_PHASE_DURATION) {
                        const accelProgress = building.productionProgress / ACCELERATION_PHASE_DURATION;
                        const easeAccel = 0.5 - 0.5 * Math.cos(accelProgress * Math.PI);
                        speedMultiplier = 1.0 + (producingMultiplier - 1.0) * easeAccel;
                    } else {
                        // Stay at full speed during most of production
                        speedMultiplier = producingMultiplier;
                    }
                }
                
                const spinSpeedRad = baseSpinSpeedRad * speedMultiplier;
                const bottomRotationRad = timeSec * spinSpeedRad;
                const topRotationRad = -timeSec * spinSpeedRad;

                const drawLayer = (sprite: HTMLCanvasElement | null, rotationRad: number): void => {
                    if (!sprite) {
                        return;
                    }
                    const spriteWidth = sprite.width * spriteScale;
                    const spriteHeight = sprite.height * spriteScale;
                    this.ctx.save();
                    this.ctx.translate(screenPos.x, screenPos.y);
                    this.ctx.rotate(rotationRad);
                    this.ctx.drawImage(
                        sprite,
                        -spriteWidth / 2,
                        -spriteHeight / 2,
                        spriteWidth,
                        spriteHeight
                    );
                    this.ctx.restore();
                };

                drawLayer(bottomSprite, bottomRotationRad);

                if (building.isSelected) {
                    this.drawBuildingSelectionIndicator(screenPos, radius);
                    // Draw foundry production buttons when selected
                    this.drawFoundryButtons(building, screenPos);
                }

                drawLayer(middleSprite, 0);
                drawLayer(topSprite, topRotationRad);
            }
        }

        if (building.currentProduction) {
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillRect(barX, barY, barWidth * building.productionProgress, barHeight);
        }

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Striker Tower
     */
    private drawStrikerTower(building: StrikerTower, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        let buildingColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        
        if (ladSun && building.owner) {
            ownerSide = building.owner.stellarForge
                ? game.getLadSide(building.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                buildingColor = '#FFFFFF';
            } else {
                buildingColor = '#000000';
            }
        }
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = buildingColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.ctx.fillStyle = displayColor;
            this.ctx.globalAlpha = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            return;
        }


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        // Draw tower body - hexagon shape
        this.ctx.fillStyle = displayColor;
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = screenPos.x + radius * Math.cos(angle);
            const y = screenPos.y + radius * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw missile indicator in center
        if (building.isMissileReady()) {
            this.ctx.fillStyle = '#FF4444';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Draw reload progress
            const reloadProgress = building.getReloadProgress();
            this.ctx.strokeStyle = '#FF4444';
            this.ctx.lineWidth = 3 * this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(
                screenPos.x,
                screenPos.y,
                radius * 0.4,
                -Math.PI / 2,
                -Math.PI / 2 + (Math.PI * 2 * reloadProgress)
            );
            this.ctx.stroke();
        }

        // Draw countdown visual if in countdown mode
        if (building.isInCountdown()) {
            // Pulsing glow effect
            const time = performance.now() / 1000;
            const pulseIntensity = 0.5 + 0.5 * Math.sin(time * 8); // Fast pulse
            
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = (4 + pulseIntensity * 4) * this.zoom;
            this.ctx.globalAlpha = 0.6 + pulseIntensity * 0.4;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius * 1.3, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
            
            // Draw countdown number
            const countdown = Math.ceil(building.getRemainingCountdown());
            if (countdown > 0) { // Only display when countdown is positive
                this.ctx.fillStyle = '#FF0000';
                this.ctx.font = `bold ${Math.floor(24 * this.zoom)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(countdown.toString(), screenPos.x, screenPos.y - radius - 20 * this.zoom);
            }
            
            // Draw line to target position if available
            if (building.targetPosition) {
                const targetScreenPos = this.worldToScreen(building.targetPosition);
                this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 2 * this.zoom;
                this.ctx.globalAlpha = 0.5;
                this.ctx.setLineDash([5 * this.zoom, 5 * this.zoom]);
                this.ctx.beginPath();
                this.ctx.moveTo(screenPos.x, screenPos.y);
                this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                this.ctx.globalAlpha = 1.0;
                
                // Draw target indicator
                this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 3 * this.zoom;
                this.ctx.beginPath();
                this.ctx.arc(targetScreenPos.x, targetScreenPos.y, 15 * this.zoom, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(targetScreenPos.x - 20 * this.zoom, targetScreenPos.y);
                this.ctx.lineTo(targetScreenPos.x + 20 * this.zoom, targetScreenPos.y);
                this.ctx.moveTo(targetScreenPos.x, targetScreenPos.y - 20 * this.zoom);
                this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y + 20 * this.zoom);
                this.ctx.stroke();
            }
        }

        if (building.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, radius);
            
            // Draw range indicator
            this.ctx.strokeStyle = displayColor;
            this.ctx.globalAlpha = 0.3;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, building.attackRange * this.zoom, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw striker tower target highlighting overlay
     * Shows available target spots when isAwaitingTarget is true
     */
    private drawStrikerTowerTargetHighlighting(game: GameState): void {
        if (!this.viewingPlayer) return;
        
        // Find if any selected striker tower is awaiting target
        let awaitingTower: StrikerTower | null = null;
        for (const building of this.viewingPlayer.buildings) {
            if (building instanceof StrikerTower && building.isAwaitingTarget && building.isMissileReady()) {
                awaitingTower = building;
                break;
            }
        }
        
        if (!awaitingTower) return;
        
        // Draw grid of highlights for valid target positions
        const towerPos = awaitingTower.position;
        const range = awaitingTower.attackRange;
        const gridSpacing = 40; // Grid spacing in world units
        
        // Calculate bounds
        const minX = Math.floor((towerPos.x - range) / gridSpacing) * gridSpacing;
        const maxX = Math.ceil((towerPos.x + range) / gridSpacing) * gridSpacing;
        const minY = Math.floor((towerPos.y - range) / gridSpacing) * gridSpacing;
        const maxY = Math.ceil((towerPos.y + range) / gridSpacing) * gridSpacing;
        
        // Draw highlights
        for (let x = minX; x <= maxX; x += gridSpacing) {
            for (let y = minY; y <= maxY; y += gridSpacing) {
                const testPos = new Vector2D(x, y);
                
                // Check if position is valid target
                const distance = towerPos.distanceTo(testPos);
                if (distance > range) continue;
                
                const inShadow = game.isPointInShadow(testPos);
                const visibleByUnits = game.isPositionVisibleByPlayerUnits(testPos, this.viewingPlayer.units);
                
                if (inShadow && !visibleByUnits) {
                    // Valid target - draw highlight
                    const screenPos = this.worldToScreen(testPos);
                    
                    // Pulsing animation
                    const time = performance.now() / 1000;
                    const pulse = 0.3 + 0.2 * Math.sin(time * 3);
                    
                    this.ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
                    this.ctx.beginPath();
                    this.ctx.arc(screenPos.x, screenPos.y, 8 * this.zoom, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Draw small crosshair
                    this.ctx.strokeStyle = `rgba(255, 0, 0, ${pulse + 0.3})`;
                    this.ctx.lineWidth = 1.5 * this.zoom;
                    this.ctx.beginPath();
                    const crossSize = 6 * this.zoom;
                    this.ctx.moveTo(screenPos.x - crossSize, screenPos.y);
                    this.ctx.lineTo(screenPos.x + crossSize, screenPos.y);
                    this.ctx.moveTo(screenPos.x, screenPos.y - crossSize);
                    this.ctx.lineTo(screenPos.x, screenPos.y + crossSize);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Draw a Lock-on Laser Tower
     */
    private drawLockOnLaserTower(building: LockOnLaserTower, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');
        let buildingColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        
        if (ladSun && building.owner) {
            ownerSide = building.owner.stellarForge
                ? game.getLadSide(building.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                buildingColor = '#FFFFFF';
            } else {
                buildingColor = '#000000';
            }
        }
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        let displayColor = buildingColor;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = this.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            this.ctx.fillStyle = displayColor;
            this.ctx.globalAlpha = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;

            if (building.isSelected) {
                this.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            return;
        }


        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? this.enemyColor : this.playerColor;
            this.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        // Draw tower body - octagon shape
        this.ctx.fillStyle = displayColor;
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const x = screenPos.x + radius * Math.cos(angle);
            const y = screenPos.y + radius * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw lock-on indicator if targeting
        const lockedTarget = building.getLockedTarget();
        if (lockedTarget) {
            const lockProgress = building.getLockOnProgress();
            const targetScreenPos = this.worldToScreen(lockedTarget.position);
            
            // Draw line to target
            this.ctx.strokeStyle = displayColor;
            this.ctx.globalAlpha = 0.5;
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
            this.ctx.stroke();
            
            // Draw lock-on progress arc around target
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 3 * this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(
                targetScreenPos.x,
                targetScreenPos.y,
                20 * this.zoom,
                -Math.PI / 2,
                -Math.PI / 2 + (Math.PI * 2 * lockProgress)
            );
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw inner circle indicator
        this.ctx.fillStyle = lockedTarget ? '#FF0000' : '#444444';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();

        if (building.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, radius);
            
            // Draw range indicator
            this.ctx.strokeStyle = displayColor;
            this.ctx.globalAlpha = 0.3;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, building.attackRange * this.zoom, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Shield Tower building
     */
    private drawShieldTower(building: ShieldTower, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        const displayColor = building.isComplete ? color : '#666666';

        // Draw shield radius if active
        if (building.shieldActive && building.isComplete) {
            const shieldRadius = building.shieldRadius * this.zoom;
            const shieldHealthPercent = building.getShieldHealthPercent();
            
            // Draw shield bubble
            this.ctx.strokeStyle = displayColor;
            this.ctx.globalAlpha = 0.2 + (shieldHealthPercent * 0.3);
            this.ctx.lineWidth = 3 * this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw shield fill
            this.ctx.fillStyle = displayColor;
            this.ctx.globalAlpha = 0.05 + (shieldHealthPercent * 0.1);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        } else if (!building.shieldActive && building.isComplete) {
            // Draw disabled shield indicator (faint)
            const shieldRadius = building.shieldRadius * this.zoom;
            this.ctx.strokeStyle = '#444444';
            this.ctx.globalAlpha = 0.1;
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.setLineDash([5 * this.zoom, 5 * this.zoom]);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 1.0;
        }

        // Draw the tower base
        this.ctx.fillStyle = displayColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw outer ring
        this.ctx.strokeStyle = displayColor;
        this.ctx.lineWidth = 3 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius * 1.2, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw center indicator
        const centerColor = building.shieldActive ? displayColor : '#666666';
        this.ctx.fillStyle = centerColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        if (building.isSelected) {
            this.drawBuildingSelectionIndicator(screenPos, radius);
            
            // Draw shield radius indicator
            if (building.isComplete) {
                this.ctx.strokeStyle = displayColor;
                this.ctx.globalAlpha = 0.3;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, building.shieldRadius * this.zoom, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }
        }

        // Draw health bar/number if damaged
        this.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
        
        // Draw shield health bar below building health
        if (building.isComplete) {
            const barWidth = radius * 2.5;
            const barHeight = 4 * this.zoom;
            const x = screenPos.x - barWidth / 2;
            const y = screenPos.y - radius - Constants.SHIELD_HEALTH_BAR_VERTICAL_OFFSET - barHeight;
            
            // Background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y, barWidth, barHeight);
            
            // Shield health fill
            const shieldPercent = building.shieldActive ? building.getShieldHealthPercent() : 0;
            const shieldColor = building.shieldActive ? '#00AAFF' : '#444444';
            this.ctx.fillStyle = shieldColor;
            this.ctx.fillRect(x, y, barWidth * shieldPercent, barHeight);
            
            // Border
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, barWidth, barHeight);
        }
    }

    /**
     * Draw a Grave projectile with trail
     */
    private drawGraveProjectile(projectile: InstanceType<typeof GraveProjectile>, color: string): void {
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
     * Draw a small particle for the Grave hero
     */
    private drawGraveSmallParticle(particle: InstanceType<typeof GraveSmallParticle>, color: string): void {
        const screenPos = this.worldToScreen(particle.position);
        const size = Constants.GRAVE_SMALL_PARTICLE_SIZE * this.zoom;
        
        // Draw small particle as a tiny circle
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.7;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw Grave Black Hole (vortex particle)
     */
    private drawGraveBlackHole(blackHole: InstanceType<typeof GraveBlackHole>, color: string): void {
        const screenPos = this.worldToScreen(blackHole.position);
        const size = Constants.GRAVE_BLACK_HOLE_SIZE * this.zoom;

        // Draw swirling vortex effect
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, size
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.4, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Add rotation effect (swirling lines)
        const numLines = 8;
        const rotation = blackHole.lifetime * 2; // Rotate based on lifetime
        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2 + rotation;
            const innerRadius = size * 0.2;
            const outerRadius = size * 0.9;
            
            this.ctx.beginPath();
            this.ctx.moveTo(
                screenPos.x + Math.cos(angle) * innerRadius,
                screenPos.y + Math.sin(angle) * innerRadius
            );
            this.ctx.lineTo(
                screenPos.x + Math.cos(angle) * outerRadius,
                screenPos.y + Math.sin(angle) * outerRadius
            );
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1 * this.zoom;
            this.ctx.globalAlpha = 0.3;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw explosion effect
     */
    private drawExplosionEffect(position: Vector2D): void {
        const screenPos = this.worldToScreen(position);
        const radius = Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS * this.zoom;

        // Draw expanding circle for explosion
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, radius
        );
        gradient.addColorStop(0, 'rgba(255, 150, 50, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    /**
     * Draw striker tower missile explosion effect
     * Shows a large, dramatic explosion with expanding rings
     */
    private drawStrikerTowerExplosion(explosion: { position: Vector2D; timestamp: number }, age: number): void {
        const screenPos = this.worldToScreen(explosion.position);
        const maxRadius = Constants.STRIKER_TOWER_EXPLOSION_RADIUS * this.zoom;
        
        // Explosion expands quickly at first, then fades
        const expansionProgress = Math.min(1.0, age * 3); // Expand over 0.33 seconds
        const fadeProgress = Math.max(0, 1.0 - age); // Fade over 1 second
        const currentRadius = maxRadius * expansionProgress;
        
        // Draw multiple expanding rings for dramatic effect
        for (let i = 0; i < 3; i++) {
            const ringDelay = i * 0.1; // Stagger rings
            const ringAge = age - ringDelay;
            if (ringAge < 0) continue;
            
            const ringProgress = Math.min(1.0, ringAge * 3);
            const ringRadius = maxRadius * ringProgress;
            const ringAlpha = Math.max(0, 1.0 - ringAge) * 0.6;
            
            // Outer ring (shockwave)
            this.ctx.strokeStyle = `rgba(255, 200, 100, ${ringAlpha})`;
            this.ctx.lineWidth = (6 - i * 2) * this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Draw main explosion fireball
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, currentRadius
        );
        gradient.addColorStop(0, `rgba(255, 255, 200, ${fadeProgress * 0.9})`); // White hot center
        gradient.addColorStop(0.3, `rgba(255, 150, 50, ${fadeProgress * 0.7})`); // Orange
        gradient.addColorStop(0.6, `rgba(255, 50, 0, ${fadeProgress * 0.5})`); // Red
        gradient.addColorStop(1, `rgba(100, 0, 0, 0)`); // Fade to transparent
        
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Trigger screen shake only once per explosion
        // Using WeakSet to track without mutating game state objects
        // This is a rendering concern and belongs in the renderer
        if (!this.shakenExplosions.has(explosion)) {
            this.triggerScreenShake(15); // Stronger shake than normal
            this.shakenExplosions.add(explosion);
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
        if (!this.abilityArrowDirection || this.abilityArrowStarts.length === 0) return;

        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)'; // Gold color for hero abilities
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        const arrowLengthPx = this.abilityArrowLengthPx;
        for (const abilityArrowStart of this.abilityArrowStarts) {
            const length = arrowLengthPx;

            // Don't draw if arrow is too short
            if (length < Constants.ABILITY_ARROW_MIN_LENGTH) {
                continue;
            }

            const arrowEndX = abilityArrowStart.x + this.abilityArrowDirection.x * length;
            const arrowEndY = abilityArrowStart.y + this.abilityArrowDirection.y * length;

            // Draw arrow shaft
            this.ctx.beginPath();
            this.ctx.moveTo(abilityArrowStart.x, abilityArrowStart.y);
            this.ctx.lineTo(arrowEndX, arrowEndY);
            this.ctx.stroke();

            // Draw arrowhead
            const angle = Math.atan2(this.abilityArrowDirection.y, this.abilityArrowDirection.x);
            const arrowHeadLength = 20;
            const arrowHeadAngle = Math.PI / 6; // 30 degrees

            this.ctx.beginPath();
            this.ctx.moveTo(arrowEndX, arrowEndY);
            this.ctx.lineTo(
                arrowEndX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
                arrowEndY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
            );
            this.ctx.lineTo(
                arrowEndX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
                arrowEndY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
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
     * Draw ability arrow for building production/abilities
     */
    private drawBuildingAbilityArrow(): void {
        if (!this.buildingAbilityArrowDirection || !this.buildingAbilityArrowStart) return;

        const length = this.buildingAbilityArrowLengthPx;

        // Don't draw if arrow is too short
        if (length < Constants.ABILITY_ARROW_MIN_LENGTH) {
            return;
        }

        const arrowEndX = this.buildingAbilityArrowStart.x + this.buildingAbilityArrowDirection.x * length;
        const arrowEndY = this.buildingAbilityArrowStart.y + this.buildingAbilityArrowDirection.y * length;

        // Draw arrow shaft
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)'; // Green color for building abilities
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.buildingAbilityArrowStart.x, this.buildingAbilityArrowStart.y);
        this.ctx.lineTo(arrowEndX, arrowEndY);
        this.ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(this.buildingAbilityArrowDirection.y, this.buildingAbilityArrowDirection.x);
        const arrowHeadLength = 20;
        const arrowHeadAngle = Math.PI / 6; // 30 degrees

        this.ctx.beginPath();
        this.ctx.moveTo(arrowEndX, arrowEndY);
        this.ctx.lineTo(
            arrowEndX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
            arrowEndY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        this.ctx.lineTo(
            arrowEndX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
            arrowEndY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
        this.ctx.fill();

        // Draw a circle at the start point
        this.ctx.beginPath();
        this.ctx.arc(this.buildingAbilityArrowStart.x, this.buildingAbilityArrowStart.y, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
        this.ctx.fill();
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
            
            if (this.selectedUnits.size > 0) {
                for (const unit of this.selectedUnits) {
                    avgX += unit.position.x;
                    avgY += unit.position.y;
                    count++;
                }
            } else if (this.selectedMirrors.size > 0) {
                for (const mirror of this.selectedMirrors) {
                    avgX += mirror.position.x;
                    avgY += mirror.position.y;
                    count++;
                }
            }
            
            if (count > 0) {
                const startWorld = new Vector2D(avgX / count, avgY / count);
                this.drawMinionPathPreview(startWorld, this.pathPreviewPoints, this.pathPreviewEnd);
            } else if (this.pathPreviewStartWorld) {
                this.drawMinionPathPreview(this.pathPreviewStartWorld, this.pathPreviewPoints, this.pathPreviewEnd);
            }
        }
    }

    public createPathCommitEffect(startWorld: Vector2D, waypoints: Vector2D[], gameTimeSec: number): void {
        const pointsWorld: Vector2D[] = [new Vector2D(startWorld.x, startWorld.y)];
        for (const waypoint of waypoints) {
            pointsWorld.push(new Vector2D(waypoint.x, waypoint.y));
        }
        if (pointsWorld.length < 2) {
            return;
        }
        this.pathCommitEffects.push({
            pointsWorld,
            startTimeSec: gameTimeSec,
            durationSec: 1.1
        });
    }

    private updateAndDrawPathCommitEffects(gameTimeSec: number): void {
        if (this.pathCommitEffects.length === 0) {
            return;
        }

        this.pathCommitEffects = this.pathCommitEffects.filter((effect) => {
            const ageSec = gameTimeSec - effect.startTimeSec;
            const progress = ageSec / effect.durationSec;
            if (progress >= 1) {
                return false;
            }

            const alpha = Math.max(0, 1 - progress);
            const pathPointsScreen = effect.pointsWorld.map((point) => this.worldToScreen(point));

            this.ctx.save();
            this.ctx.lineWidth = 2.5;
            this.ctx.strokeStyle = `rgba(255, 225, 120, ${0.55 * alpha})`;
            this.ctx.setLineDash([14, 10]);
            this.ctx.lineDashOffset = -progress * 80;
            this.ctx.beginPath();
            this.ctx.moveTo(pathPointsScreen[0].x, pathPointsScreen[0].y);
            for (let i = 1; i < pathPointsScreen.length; i++) {
                this.ctx.lineTo(pathPointsScreen[i].x, pathPointsScreen[i].y);
            }
            this.ctx.stroke();
            this.ctx.restore();

            return true;
        });
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
        yOffset: number,
        isRegenerating: boolean = false,
        playerColor?: string
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
            
            // Draw + sign if regenerating
            if (isRegenerating) {
                const plusSize = 8;
                const plusX = barX + barWidth + 5;
                const plusY = barY + barHeight / 2;
                
                this.ctx.strokeStyle = playerColor || '#00FF00';
                this.ctx.lineWidth = 2;
                
                // Horizontal line of +
                this.ctx.beginPath();
                this.ctx.moveTo(plusX - plusSize / 2, plusY);
                this.ctx.lineTo(plusX + plusSize / 2, plusY);
                this.ctx.stroke();
                
                // Vertical line of +
                this.ctx.beginPath();
                this.ctx.moveTo(plusX, plusY - plusSize / 2);
                this.ctx.lineTo(plusX, plusY + plusSize / 2);
                this.ctx.stroke();
            }
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
            
            // Draw + sign if regenerating
            if (isRegenerating) {
                const plusSize = fontSize * 0.6;
                const plusX = screenPos.x + fontSize * 0.8;
                const plusY = screenPos.y + yOffset - fontSize / 2;
                
                this.ctx.strokeStyle = playerColor || '#00FF00';
                this.ctx.lineWidth = 2;
                
                // Horizontal line of +
                this.ctx.beginPath();
                this.ctx.moveTo(plusX - plusSize / 2, plusY);
                this.ctx.lineTo(plusX + plusSize / 2, plusY);
                this.ctx.stroke();
                
                // Vertical line of +
                this.ctx.beginPath();
                this.ctx.moveTo(plusX, plusY - plusSize / 2);
                this.ctx.lineTo(plusX, plusY + plusSize / 2);
                this.ctx.stroke();
            }
        }
    }

    /**
     * Check if a world position is off-screen
     */
    private isOffScreen(worldPos: Vector2D): boolean {
        const screenPos = this.worldToScreen(worldPos);
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        
        return screenPos.x < 0 || screenPos.x > screenWidth || 
               screenPos.y < 0 || screenPos.y > screenHeight;
    }

    /**
     * Calculate edge position for off-screen indicator
     * Returns screen coordinates clamped to screen edges
     */
    private getEdgePosition(worldPos: Vector2D, indicatorSize: number): { x: number; y: number; angle: number } {
        const screenPos = this.worldToScreen(worldPos);
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        
        // Calculate angle from screen center to object
        const dx = screenPos.x - centerX;
        const dy = screenPos.y - centerY;
        const angle = Math.atan2(dy, dx);
        
        let edgeX = screenPos.x;
        let edgeY = screenPos.y;
        
        // Clamp to screen bounds
        if (screenPos.x < 0) {
            edgeX = 0;
        } else if (screenPos.x > screenWidth) {
            edgeX = screenWidth;
        }
        
        if (screenPos.y < 0) {
            edgeY = 0;
        } else if (screenPos.y > screenHeight) {
            edgeY = screenHeight;
        }
        
        return { x: edgeX, y: edgeY, angle };
    }

    /**
     * Draw off-screen unit indicators
     */
    private drawOffScreenUnitIndicators(game: GameState): void {
        if (!this.viewingPlayer) return;
        this.ctx.save();
        this.ctx.globalAlpha = this.offscreenIndicatorOpacity;

        const dpr = window.devicePixelRatio || 1;
        const ladSun = game.suns.find(s => s.type === 'lad');
        
        // Define size hierarchy
        const STARLING_SIZE = 12;
        const HERO_SIZE = 20;
        const MIRROR_SIZE = 24;
        const BUILDING_SIZE = 28;
        const FORGE_SIZE = 36;
        
        // Process player units (always visible)
        for (const unit of this.viewingPlayer.units) {
            if (!this.isOffScreen(unit.position)) continue;
            
            const isStarling = unit instanceof Starling;
            const size = isStarling ? STARLING_SIZE : HERO_SIZE;
            const edgePos = this.getEdgePosition(unit.position, size);
            
            // Draw circle (no fill for units)
            this.ctx.strokeStyle = this.playerColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Process player solar mirrors (always visible)
        for (const mirror of this.viewingPlayer.solarMirrors) {
            if (!this.isOffScreen(mirror.position)) continue;
            
            const edgePos = this.getEdgePosition(mirror.position, MIRROR_SIZE);
            
            // Draw filled circle for mirrors
            this.ctx.fillStyle = this.playerColor;
            this.ctx.beginPath();
            this.ctx.arc(edgePos.x, edgePos.y, MIRROR_SIZE / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Process player buildings (always visible)
        for (const building of this.viewingPlayer.buildings) {
            if (!this.isOffScreen(building.position)) continue;
            
            const isFoundry = building instanceof SubsidiaryFactory;
            const size = isFoundry ? FORGE_SIZE : BUILDING_SIZE;
            const edgePos = this.getEdgePosition(building.position, size);
            
            // Draw filled circle for buildings
            this.ctx.fillStyle = this.playerColor;
            this.ctx.beginPath();
            this.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Process player stellar forge (always visible)
        if (this.viewingPlayer.stellarForge && !this.viewingPlayer.isDefeated()) {
            const forge = this.viewingPlayer.stellarForge;
            if (this.isOffScreen(forge.position)) {
                const edgePos = this.getEdgePosition(forge.position, FORGE_SIZE);
                
                // Draw filled circle for forge
                this.ctx.fillStyle = this.playerColor;
                this.ctx.beginPath();
                this.ctx.arc(edgePos.x, edgePos.y, FORGE_SIZE / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Process enemy units and structures (only if visible)
        for (const player of game.players) {
            if (player === this.viewingPlayer || player.isDefeated()) continue;
            
            const color = this.getLadPlayerColor(player, ladSun, game);
            
            // Enemy units
            for (const unit of player.units) {
                if (!this.isOffScreen(unit.position)) continue;
                
                // Check visibility
                if (!game.isObjectVisibleToPlayer(unit.position, this.viewingPlayer, unit)) {
                    continue;
                }
                
                const isStarling = unit instanceof Starling;
                const unitSize = isStarling ? STARLING_SIZE : HERO_SIZE;
                const edgePos = this.getEdgePosition(unit.position, unitSize);
                
                // Draw based on colorblind mode
                if (this.colorblindMode) {
                    // Draw diamond (45° rotated square)
                    this.ctx.save();
                    this.ctx.translate(edgePos.x, edgePos.y);
                    this.ctx.rotate(Math.PI / 4);
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(-unitSize / 2, -unitSize / 2, unitSize, unitSize);
                    this.ctx.restore();
                } else {
                    // Draw circle (no fill for units)
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(edgePos.x, edgePos.y, unitSize / 2, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }
            
            // Enemy solar mirrors
            for (const mirror of player.solarMirrors) {
                if (!this.isOffScreen(mirror.position)) continue;
                
                // Check visibility
                if (!game.isObjectVisibleToPlayer(mirror.position, this.viewingPlayer, mirror)) {
                    continue;
                }
                
                const edgePos = this.getEdgePosition(mirror.position, MIRROR_SIZE);
                
                // Draw based on colorblind mode
                if (this.colorblindMode) {
                    // Draw filled diamond
                    this.ctx.save();
                    this.ctx.translate(edgePos.x, edgePos.y);
                    this.ctx.rotate(Math.PI / 4);
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(-MIRROR_SIZE / 2, -MIRROR_SIZE / 2, MIRROR_SIZE, MIRROR_SIZE);
                    this.ctx.restore();
                } else {
                    // Draw filled circle
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(edgePos.x, edgePos.y, MIRROR_SIZE / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            // Enemy buildings
            for (const building of player.buildings) {
                if (!this.isOffScreen(building.position)) continue;
                
                // Check visibility
                if (!game.isObjectVisibleToPlayer(building.position, this.viewingPlayer, building)) {
                    continue;
                }
                
                const isFoundry = building instanceof SubsidiaryFactory;
                const size = isFoundry ? FORGE_SIZE : BUILDING_SIZE;
                const edgePos = this.getEdgePosition(building.position, size);
                
                // Draw based on colorblind mode
                if (this.colorblindMode) {
                    // Draw filled diamond
                    this.ctx.save();
                    this.ctx.translate(edgePos.x, edgePos.y);
                    this.ctx.rotate(Math.PI / 4);
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(-size / 2, -size / 2, size, size);
                    this.ctx.restore();
                } else {
                    // Draw filled circle
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            // Enemy stellar forge
            if (player.stellarForge) {
                const forge = player.stellarForge;
                if (this.isOffScreen(forge.position)) {
                    // Check visibility
                    if (game.isObjectVisibleToPlayer(forge.position, this.viewingPlayer, forge)) {
                        const edgePos = this.getEdgePosition(forge.position, FORGE_SIZE);
                        
                        // Draw based on colorblind mode
                        if (this.colorblindMode) {
                            // Draw filled diamond
                            this.ctx.save();
                            this.ctx.translate(edgePos.x, edgePos.y);
                            this.ctx.rotate(Math.PI / 4);
                            this.ctx.fillStyle = color;
                            this.ctx.fillRect(-FORGE_SIZE / 2, -FORGE_SIZE / 2, FORGE_SIZE, FORGE_SIZE);
                            this.ctx.restore();
                        } else {
                            // Draw filled circle
                            this.ctx.fillStyle = color;
                            this.ctx.beginPath();
                            this.ctx.arc(edgePos.x, edgePos.y, FORGE_SIZE / 2, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                }
            }
        }

        this.ctx.restore();
    }

    /**
     * Render the entire game state
     */
    render(game: GameState): void {
        // Clear canvas with color scheme background
        this.ctx.fillStyle = this.colorScheme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateViewBounds();
        const ladSun = game.suns.find(s => s.type === 'lad');
        this.updateEnemyVisibilityFadeClock(game.gameTime);

        if (ladSun) {
            this.drawLadSunRays(game, ladSun);
        }

        // Draw parallax star layers
        if (!ladSun) {
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = this.canvas.width / dpr;
            const screenHeight = this.canvas.height / dpr;
            this.drawStarfield(screenWidth, screenHeight);
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
                this.drawSun(sun, game.gameTime);
            }
        }

        // Draw sun rays with raytracing (light and shadows)
        if (!ladSun) {
            this.drawSunRays(game);
        }

        if (this.graphicsQuality === 'ultra' && !ladSun) {
            this.drawUltraSunParticleLayers(game);
        }

        // Draw lens flare effects for visible suns
        for (const sun of game.suns) {
            this.drawLensFlare(sun);
        }

        // Draw asteroids (with culling - skip rendering beyond map bounds)
        for (const asteroid of game.asteroids) {
            // Only render asteroids within map boundaries
            if (this.isWithinRenderBounds(asteroid.position, game.mapSize, asteroid.size) &&
                this.isWithinViewBounds(asteroid.position, asteroid.size * 2)) {
                this.drawAsteroid(asteroid, game.suns);
            }
        }

        if (this.graphicsQuality === 'ultra' && !ladSun) {
            this.applyUltraWarmCoolGrade(game);
            this.applyUltraShadowReinforcement(game);
        }

        if (!ladSun) {
            this.drawShadowStarfieldOverlay(game);
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

            const color = this.getLadPlayerColor(player, ladSun, game);
            const isEnemy = this.isEnemyPlayer(player, game);

            // Draw Solar Mirrors (including enemy mirrors with visibility checks)
            for (const mirror of player.solarMirrors) {
                if (this.isWithinViewBounds(mirror.position, 120)) {
                    this.drawSolarMirror(mirror, color, game, isEnemy, game.gameTime);
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
                this.drawWarpGate(gate, game, ladSun);
            }
        }

        // Draw starling merge gates
        for (const gate of game.starlingMergeGates) {
            if (this.isWithinViewBounds(gate.position, Constants.STARLING_MERGE_GATE_RADIUS_PX * 4)) {
                this.drawStarlingMergeGate(gate, game);
            }
        }

        // Draw warp gate shockwaves
        this.updateAndDrawWarpGateShockwaves();

        // Draw merged range outlines for selected starlings before drawing units
        this.drawMergedStarlingRanges(game);

        // Draw units
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
                    this.drawGrave(unit, color, game, isEnemy);
                } else if (unit instanceof Starling) {
                    this.drawStarling(unit, color, game, isEnemy);
                } else if (unit instanceof Ray) {
                    this.drawRay(unit, color, game, isEnemy);
                } else if (unit instanceof Nova) {
                    this.drawNova(unit, color, game, isEnemy);
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
                } else if (unit instanceof Spotlight) {
                    this.drawSpotlight(unit, color, game, isEnemy);
                } else if (unit instanceof Mortar) {
                    this.drawMortar(unit, color, game, isEnemy);
                } else if (unit instanceof Preist) {
                    this.drawPreist(unit, color, game, isEnemy);
                } else if (unit instanceof Tank) {
                    this.drawTank(unit, color, game, isEnemy);
                } else if (unit instanceof Sly) {
                    this.drawUnit(unit, color, game, isEnemy); // Use default unit drawing for Sly
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
            
            const color = this.getLadPlayerColor(player, ladSun, game);
            const isEnemy = this.isEnemyPlayer(player, game);
            
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
                } else if (building instanceof StrikerTower) {
                    this.drawStrikerTower(building, color, game, isEnemy);
                } else if (building instanceof LockOnLaserTower) {
                    this.drawLockOnLaserTower(building, color, game, isEnemy);
                } else if (building instanceof ShieldTower) {
                    this.drawShieldTower(building, color, game, isEnemy);
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
        if (this.graphicsQuality === 'high' || this.graphicsQuality === 'ultra') {
            for (const particle of game.impactParticles) {
                if (this.isWithinViewBounds(particle.position, 120)) {
                    this.drawImpactParticle(particle);
                }
            }
        }
        
        // Draw sparkle particles (regeneration effects)
        for (const sparkle of game.sparkleParticles) {
            if (this.isWithinViewBounds(sparkle.position, 50)) {
                this.drawSparkleParticle(sparkle);
            }
        }
        
        // Draw death particles (breaking apart effect)
        for (const particle of game.deathParticles) {
            if (this.isWithinViewBounds(particle.position, 100)) {
                this.drawDeathParticle(particle, game);
            }
        }
        
        // Draw striker tower explosions
        for (const explosion of game.strikerTowerExplosions) {
            if (this.isWithinViewBounds(explosion.position, Constants.STRIKER_TOWER_EXPLOSION_RADIUS * 2)) {
                this.drawStrikerTowerExplosion(explosion, game.gameTime - explosion.timestamp);
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
        
        // Draw Nova bombs
        for (const bomb of game.novaBombs) {
            if (this.isWithinViewBounds(bomb.position, 100)) {
                this.drawNovaBomb(bomb);
            }
        }
        
        // Draw Nova scatter bullets
        for (const bullet of game.novaScatterBullets) {
            if (this.isWithinViewBounds(bullet.position, 100)) {
                this.drawNovaScatterBullet(bullet);
            }
        }
        
        // Draw Sticky Bombs
        for (const bomb of game.stickyBombs) {
            if (this.isWithinViewBounds(bomb.position, 100)) {
                this.drawStickyBomb(bomb);
            }
        }
        
        // Draw Sticky Lasers
        for (const laser of game.stickyLasers) {
            if (this.isWithinViewBounds(laser.startPosition, 600)) {
                this.drawStickyLaser(laser);
            }
        }
        
        // Draw Disintegration Particles
        for (const particle of game.disintegrationParticles) {
            if (this.isWithinViewBounds(particle.position, 50)) {
                this.drawDisintegrationParticle(particle);
            }
        }
        
        // Draw deployed turrets
        for (const turret of game.deployedTurrets) {
            if (this.isWithinViewBounds(turret.position, Constants.DEPLOYED_TURRET_HEALTH_BAR_SIZE * 2)) {
                this.drawDeployedTurret(turret, game);
            }
        }

        // Draw damage numbers
        this.drawDamageNumbers(game);

        // Draw border fade to black effect
        this.drawBorderFade(game.mapSize);
        
        // Draw off-screen unit indicators
        this.drawOffScreenUnitIndicators(game);
        
        // Draw striker tower target highlighting
        this.drawStrikerTowerTargetHighlighting(game);
        
        // Draw mirror command buttons if mirrors are selected
        this.drawMirrorCommandButtons(this.selectedMirrors, game.gameTime);

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
        const productionBoxWidth = 200;
        const boxHeight = 60;
        const rightX = screenWidth - margin;
        let y = margin;

        const starlingSymbol = '✦';
        
        // Check for player's production
        const player = game.players.find((p) => !p.isAi);
        if (!player) {
            return;
        }

        this.ctx.save();
        this.ctx.globalAlpha = this.infoBoxOpacity;
        
        const compactBoxHeight = 30;
        const compactTextPaddingLeft = 8;
        const compactTextPaddingRight = 8;
        const compactIconInset = 4;
        const compactIconSize = compactBoxHeight - compactIconInset * 2;
        this.ctx.font = 'bold 14px Doto';

        const compactTextWidths: number[] = [];
        if (player.stellarForge) {
            const energyText = `${player.stellarForge.incomingLightPerSec.toFixed(1)}/s`;
            compactTextWidths.push(
                compactTextPaddingLeft + compactIconSize + compactIconInset + this.ctx.measureText(energyText).width + compactTextPaddingRight
            );
        }

        // Count starlings
        const starlingCount = player.units.filter(unit => unit instanceof Starling).length;
        const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - starlingCount);

        // Calculate next crunch starling count based on pending energy and current rate
        const forge = player.stellarForge;
        const pendingEnergy = forge?.pendingEnergy ?? 0;
        const projectedEnergy = forge?.isReceivingLight
            ? pendingEnergy + forge.incomingLightPerSec * Math.max(0, forge.crunchTimer)
            : pendingEnergy;
        const nextCrunchStarlings = Math.min(
            Math.floor(projectedEnergy / Constants.STARLING_COST_PER_ENERGY),
            availableStarlingSlots
        );
        const starlingRateLabel = forge ? ` (+${nextCrunchStarlings})` : '';
        const starlingRateText = `${starlingSymbol} ${starlingCount}${starlingRateLabel}`;
        const maxStarlingsText = `${starlingSymbol} ${starlingCount}/${Constants.STARLING_MAX_COUNT}`;

        compactTextWidths.push(
            compactTextPaddingLeft + this.ctx.measureText(starlingRateText).width + compactTextPaddingRight,
            compactTextPaddingLeft + this.ctx.measureText(maxStarlingsText).width + compactTextPaddingRight
        );

        const compactBoxWidth = Math.ceil(Math.max(...compactTextWidths));
        const compactX = rightX - compactBoxWidth;
        const productionX = rightX - productionBoxWidth;
        
        // Draw incoming energy box
        if (player.stellarForge) {
            const forge = player.stellarForge;
            const energyRate = forge.incomingLightPerSec;
            
            // Draw background box
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);
            
            // Draw border - green if receiving light, red otherwise
            this.ctx.strokeStyle = forge.isReceivingLight ? '#00FF00' : '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);
            
            // Get cached SoL icon
            const solIcon = this.getSolEnergyIcon();
            const iconX = compactX + compactIconInset;
            const iconY = y + compactIconInset;
            
            if (solIcon.complete && solIcon.naturalWidth > 0) {
                this.ctx.drawImage(solIcon, iconX, iconY, compactIconSize, compactIconSize);
            }
            
            // Draw text next to icon
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                `${energyRate.toFixed(1)}/s`,
                compactX + compactTextPaddingLeft + compactIconSize + compactIconInset,
                y + compactBoxHeight / 2
            );
            
            y += compactBoxHeight + 5;
        }

        // Draw starlings count box
        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        this.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);
        
        // Draw border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);
        
        // Draw text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Doto';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(starlingRateText, compactX + compactTextPaddingLeft, y + compactBoxHeight / 2);
        
        y += compactBoxHeight + 5;

        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        this.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Doto';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(maxStarlingsText, compactX + compactTextPaddingLeft, y + compactBoxHeight / 2);
        
        y += compactBoxHeight + 8;
        
        // Draw hero production from stellar forge
        if (player.stellarForge && player.stellarForge.heroProductionUnitType) {
            const forge = player.stellarForge;
            
            // Draw background box
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);
            
            // Draw border
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);
            
            // Draw production name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            const productionName = this.getProductionDisplayName(forge.heroProductionUnitType!);
            this.ctx.fillText(productionName, productionX + 8, y + 8);
            
            // Calculate progress (guard against division by zero)
            const progress = forge.heroProductionDurationSec > 0 
                ? 1 - (forge.heroProductionRemainingSec / forge.heroProductionDurationSec)
                : 0;
            
            // Draw progress bar
            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, progress);
            
            y += boxHeight + 8;
        }

        const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory) as SubsidiaryFactory | undefined;
        if (foundry?.currentProduction) {
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            const productionName = this.getProductionDisplayName(foundry.currentProduction);
            this.ctx.fillText(`Foundry ${productionName}`, productionX + 8, y + 8);
            
            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, foundry.productionProgress);
            
            y += boxHeight + 8;
        }

        // Draw building construction progress
        // Note: find() stops at first match, typically only one building under construction
        const buildingInProgress = player.buildings.find((building) => !building.isComplete);
        if (buildingInProgress) {
            // Draw background box
            this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            this.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);
            
            // Draw border
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);
            
            // Draw building name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Doto';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            
            const buildingName = this.getBuildingDisplayName(buildingInProgress);
            this.ctx.fillText(`Building ${buildingName}`, productionX + 8, y + 8);
            
            // Draw progress bar
            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, buildingInProgress.buildProgress);
        }
        
        // Reset text alignment
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.restore();
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
        return getGraphicsMenuMaxScroll(this.graphicsOptions.length, layout);
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

            optionY += optionHeight + optionSpacing;

            // Fancy Graphics toggle buttons
            const fancyButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const fancyButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= fancyButton1X && screenX <= fancyButton1X + buttonWidth) {
                    return { type: 'fancyGraphics', isEnabled: true };
                }
                if (screenX >= fancyButton2X && screenX <= fancyButton2X + buttonWidth) {
                    return { type: 'fancyGraphics', isEnabled: false };
                }
            }
            
            optionY += optionHeight + optionSpacing;

            // Colorblind Mode toggle buttons
            const colorblindButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const colorblindButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= colorblindButton1X && screenX <= colorblindButton1X + buttonWidth) {
                    return { type: 'colorblindMode', isEnabled: true };
                }
                if (screenX >= colorblindButton2X && screenX <= colorblindButton2X + buttonWidth) {
                    return { type: 'colorblindMode', isEnabled: false };
                }
            }
            
            return null;
        }

        if (this.inGameMenuTab === 'graphics') {
            const qualityRowHeight = layout.isCompactLayout ? 34 : 38;
            const qualityButtonGap = 8;
            const qualityY = layout.graphicsSliderY;
            const qualityLabelWidth = layout.graphicsSliderLabelWidth;
            const qualityButtonWidth = (layout.graphicsSliderWidth - qualityLabelWidth - qualityButtonGap * 3) / 4;
            const qualityStartX = layout.graphicsSliderX + qualityLabelWidth;
            const qualityValues: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];
            if (screenY >= qualityY && screenY <= qualityY + qualityRowHeight) {
                for (let i = 0; i < qualityValues.length; i += 1) {
                    const buttonX = qualityStartX + i * (qualityButtonWidth + qualityButtonGap);
                    if (screenX >= buttonX && screenX <= buttonX + qualityButtonWidth) {
                        return { type: 'graphicsQuality', quality: qualityValues[i] };
                    }
                }
            }

            const sliderTrackX = layout.graphicsSliderX + layout.graphicsSliderLabelWidth;
            const sliderTrackWidth = layout.graphicsSliderWidth - layout.graphicsSliderLabelWidth;
            const sliderRowHeight = layout.graphicsSliderRowHeight;
            const sliderGap = layout.graphicsSliderGap;
            const sliderBaseY = qualityY + qualityRowHeight + sliderGap;
            const sliderActionTypes: Array<InGameMenuAction['type']> = [
                'offscreenIndicatorOpacity',
                'infoBoxOpacity'
            ];
            for (let i = 0; i < sliderActionTypes.length; i += 1) {
                const rowY = sliderBaseY + i * (sliderRowHeight + sliderGap);
                const isWithinRow = screenY >= rowY && screenY <= rowY + sliderRowHeight;
                if (!isWithinRow) {
                    continue;
                }
                if (screenX >= sliderTrackX && screenX <= sliderTrackX + sliderTrackWidth) {
                    const rawPercent = ((screenX - sliderTrackX) / sliderTrackWidth) * 100;
                    const snappedPercent = Math.max(0, Math.min(100, Math.round(rawPercent / 5) * 5));
                    const actionType = sliderActionTypes[i];
                    if (actionType === 'offscreenIndicatorOpacity') {
                        return { type: 'offscreenIndicatorOpacity', opacityPercent: snappedPercent };
                    }
                    return { type: 'infoBoxOpacity', opacityPercent: snappedPercent };
                }
            }
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

            optionY += optionHeight + optionSpacing;

            // Fancy Graphics option
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Fancy Graphics:', optionX, optionY + (optionHeight * 0.4));

            const fancyButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isFancyOn = this.isFancyGraphicsEnabled;
            this.ctx.fillStyle = isFancyOn ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(fancyButtons.button1X, optionY, fancyButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isFancyOn ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(fancyButtons.button1X, optionY, fancyButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('On', fancyButtons.button1X + fancyButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isFancyOff = !this.isFancyGraphicsEnabled;
            this.ctx.fillStyle = isFancyOff ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(fancyButtons.button2X, optionY, fancyButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isFancyOff ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(fancyButtons.button2X, optionY, fancyButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Off', fancyButtons.button2X + fancyButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            optionY += optionHeight + optionSpacing;

            // Colorblind Mode option
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Colorblind Mode:', optionX, optionY + (optionHeight * 0.4));

            const colorblindButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isColorblindOn = this.colorblindMode;
            this.ctx.fillStyle = isColorblindOn ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(colorblindButtons.button1X, optionY, colorblindButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isColorblindOn ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(colorblindButtons.button1X, optionY, colorblindButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('On', colorblindButtons.button1X + colorblindButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isColorblindOff = !this.colorblindMode;
            this.ctx.fillStyle = isColorblindOff ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            this.ctx.fillRect(colorblindButtons.button2X, optionY, colorblindButtons.buttonWidth, optionHeight);
            this.ctx.strokeStyle = isColorblindOff ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(colorblindButtons.button2X, optionY, colorblindButtons.buttonWidth, optionHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Off', colorblindButtons.button2X + colorblindButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));
        } else {
            const maxScroll = this.getGraphicsMenuMaxScroll(layout);
            if (this.graphicsMenuScrollOffset > maxScroll) {
                this.graphicsMenuScrollOffset = maxScroll;
            }
            const qualityRowHeight = isCompactLayout ? 34 : 38;
            const qualityButtonGap = 8;
            const qualityY = layout.graphicsSliderY;
            const qualityLabelX = layout.graphicsSliderX;
            const qualityLabelWidth = layout.graphicsSliderLabelWidth;
            const qualityButtonWidth = (layout.graphicsSliderWidth - qualityLabelWidth - qualityButtonGap * 3) / 4;
            const qualityStartX = layout.graphicsSliderX + qualityLabelWidth;
            const qualityValues: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = `bold ${isCompactLayout ? 13 : 15}px Doto`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Graphics Quality', qualityLabelX, qualityY + qualityRowHeight * 0.5);

            for (let i = 0; i < qualityValues.length; i += 1) {
                const quality = qualityValues[i];
                const buttonX = qualityStartX + i * (qualityButtonWidth + qualityButtonGap);
                const isSelected = this.graphicsQuality === quality;
                this.ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
                this.ctx.fillRect(buttonX, qualityY, qualityButtonWidth, qualityRowHeight);
                this.ctx.strokeStyle = isSelected ? '#FFD700' : '#FFFFFF';
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeRect(buttonX, qualityY, qualityButtonWidth, qualityRowHeight);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${isCompactLayout ? 11 : 12}px Doto`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    quality[0].toUpperCase() + quality.slice(1),
                    buttonX + qualityButtonWidth / 2,
                    qualityY + qualityRowHeight * 0.64
                );
            }

            const sliderTrackX = layout.graphicsSliderX + layout.graphicsSliderLabelWidth;
            const sliderTrackWidth = layout.graphicsSliderWidth - layout.graphicsSliderLabelWidth;
            const sliderRowHeight = layout.graphicsSliderRowHeight;
            const sliderGap = layout.graphicsSliderGap;
            const sliderTrackHeight = layout.graphicsSliderTrackHeight;
            const sliderBaseY = qualityY + qualityRowHeight + sliderGap;
            const sliderRows = [
                { label: 'Offscreen Indicators', valuePercent: Math.round(this.offscreenIndicatorOpacity * 100) },
                { label: 'Info Box Opacity', valuePercent: Math.round(this.infoBoxOpacity * 100) }
            ];

            for (let i = 0; i < sliderRows.length; i += 1) {
                const row = sliderRows[i];
                const rowY = sliderBaseY + i * (sliderRowHeight + sliderGap);
                const clampedPercent = Math.max(0, Math.min(100, row.valuePercent));
                const trackY = rowY + (sliderRowHeight - sliderTrackHeight) / 2;
                const knobX = sliderTrackX + (sliderTrackWidth * clampedPercent) / 100;
                const knobRadius = sliderTrackHeight * 1.1;

                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `bold ${isCompactLayout ? 13 : 15}px Doto`;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(row.label, layout.graphicsSliderX, rowY + sliderRowHeight * 0.5);

                this.ctx.fillStyle = 'rgba(60, 60, 60, 0.9)';
                this.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);
                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
                this.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth * (clampedPercent / 100), sliderTrackHeight);
                this.ctx.strokeStyle = '#FFD700';
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);

                this.ctx.beginPath();
                this.ctx.arc(knobX, trackY + sliderTrackHeight / 2, knobRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `bold ${isCompactLayout ? 12 : 13}px Doto`;
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${clampedPercent}%`, layout.graphicsSliderX + layout.graphicsSliderWidth, rowY + sliderRowHeight * 0.5);
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
        const localPlayer = this.viewingPlayer;
        const didLocalPlayerWin = winner === localPlayer;
        
        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // Victory message
        this.ctx.fillStyle = didLocalPlayerWin ? '#4CAF50' : '#F44336';
        const victoryFontSize = Math.max(28, Math.min(48, screenWidth * 0.12));
        this.ctx.font = `bold ${victoryFontSize}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(didLocalPlayerWin ? 'VICTORY' : 'DEFEAT', screenWidth / 2, 80);
        
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
                const value = stat.key === 'energyGathered' ? Math.round(player[stat.key]) : player[stat.key];
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
