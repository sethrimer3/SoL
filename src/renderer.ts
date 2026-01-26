/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, Asteroid, LightRay, Unit, Marine, Grave, Starling, GraveProjectile, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet, MinionProjectile, Building, Minigun, SpaceDustSwirler, SubsidiaryFactory, Ray, RayBeamSegment, InfluenceBall, InfluenceZone, InfluenceBallProjectile, TurretDeployer, DeployedTurret, Driller, Dagger, DamageNumber, Beam } from './game-core';
import * as Constants from './constants';

export class GameRenderer {
    public canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public camera: Vector2D = new Vector2D(0, 0);
    public zoom: number = 1.0;
    public selectionStart: Vector2D | null = null;
    public selectionEnd: Vector2D | null = null;
    public abilityArrowStart: Vector2D | null = null; // Arrow start for hero ability casting
    public abilityArrowEnd: Vector2D | null = null; // Arrow end for hero ability casting
    public selectedUnits: Set<Unit> = new Set();
    public pathPreviewForge: StellarForge | null = null;
    public pathPreviewPoints: Vector2D[] = [];
    public pathPreviewEnd: Vector2D | null = null;
    public selectedHeroNames: string[] = [];
    private tapEffects: Array<{position: Vector2D, progress: number}> = [];
    private swipeEffects: Array<{start: Vector2D, end: Vector2D, progress: number}> = [];
    public viewingPlayer: Player | null = null; // The player whose view we're rendering
    public showInfo: boolean = false; // Toggle for showing top-left info
    public showInGameMenu: boolean = false; // Toggle for in-game menu
    public isPaused: boolean = false; // Game pause state
    public playerColor: string = Constants.PLAYER_1_COLOR; // Player 1 color (customizable)
    public enemyColor: string = Constants.PLAYER_2_COLOR; // Player 2 color (customizable)

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
    private readonly MIRROR_MAX_HEALTH = 100;
    
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
    private worldToScreen(worldPos: Vector2D): Vector2D {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
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

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): Vector2D {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
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

    /**
     * Darken a color by a given factor (0-1, where 0 is black and 1 is original color)
     */
    private darkenColor(color: string, factor: number): string {
        // Parse hex color
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Apply darkening factor
        const newR = Math.floor(r * factor);
        const newG = Math.floor(g * factor);
        const newB = Math.floor(b * factor);
        
        // Convert back to hex
        return '#' + 
               newR.toString(16).padStart(2, '0') +
               newG.toString(16).padStart(2, '0') +
               newB.toString(16).padStart(2, '0');
    }

    /**
     * Draw a sun
     */
    private drawSun(sun: Sun): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;

        // Draw sun glow
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 150, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw sun core
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
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
        // alpha: opacity of the flare center
        const flarePositions = [
            { offset: -0.3, size: 0.4, alpha: 0.15, color: 'rgba(255, 200, 100, ' },  // Warm yellow-orange
            { offset: -0.5, size: 0.25, alpha: 0.12, color: 'rgba(100, 150, 255, ' }, // Cool blue
            { offset: 0.4, size: 0.3, alpha: 0.1, color: 'rgba(255, 150, 150, ' },    // Pink
            { offset: 0.7, size: 0.2, alpha: 0.08, color: 'rgba(150, 255, 200, ' }    // Teal
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
            flareGradient.addColorStop(0, `${flare.color}${flare.alpha})`);
            flareGradient.addColorStop(0.5, `${flare.color}${flare.alpha * 0.5})`);
            flareGradient.addColorStop(1, `${flare.color}0)`);
            
            this.ctx.fillStyle = flareGradient;
            this.ctx.beginPath();
            this.ctx.arc(flareX, flareY, flareRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw subtle hexagonal starburst around the sun
        this.ctx.save();
        this.ctx.globalAlpha = 0.2;
        this.ctx.strokeStyle = 'rgba(255, 255, 200, 0.3)';
        this.ctx.lineWidth = 2;
        
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const rayLength = screenRadius * 1.5;
            const startX = screenPos.x + Math.cos(angle) * screenRadius * 0.7;
            const startY = screenPos.y + Math.sin(angle) * screenRadius * 0.7;
            const endX = screenPos.x + Math.cos(angle) * rayLength;
            const endY = screenPos.y + Math.sin(angle) * rayLength;
            
            // Create gradient for each ray
            const rayGradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
            rayGradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
            rayGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
            
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

        if (forge.health < this.FORGE_MAX_HEALTH) {
            // Draw health bar
            const barWidth = size * 2;
            const barHeight = 6;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y - size - 15;
            
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            const healthPercent = forge.health / this.FORGE_MAX_HEALTH;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }

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
    private drawSolarMirror(mirror: SolarMirror, color: string, game: GameState): void {
        const screenPos = this.worldToScreen(mirror.position);
        const size = 20 * this.zoom;

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
                let reflectDir: Vector2D | null = null;

                if (forge && mirror.hasLineOfSightToForge(forge, game.asteroids, game.players)) {
                    reflectDir = new Vector2D(
                        forge.position.x - mirror.position.x,
                        forge.position.y - mirror.position.y
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
        
        // Draw flat reflective surface (rectangle)
        const surfaceLength = size * 2;
        const surfaceThickness = size * 0.3;
        
        // Draw surface with gradient to show reflectivity
        const surfaceGradient = this.ctx.createLinearGradient(0, -surfaceThickness/2, 0, surfaceThickness/2);
        surfaceGradient.addColorStop(0, '#FFFFFF');
        surfaceGradient.addColorStop(0.5, '#E0E0E0');
        surfaceGradient.addColorStop(1, '#C0C0C0');
        
        this.ctx.fillStyle = surfaceGradient;
        this.ctx.fillRect(-surfaceLength/2, -surfaceThickness/2, surfaceLength, surfaceThickness);
        
        // Draw border for the surface
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-surfaceLength/2, -surfaceThickness/2, surfaceLength, surfaceThickness);
        
        // Draw small indicator dots at the ends
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(-surfaceLength/2, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(surfaceLength/2, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw selection indicator if selected
        if (mirror.isSelected) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(-surfaceLength/2 - 3, -surfaceThickness/2 - 3, surfaceLength + 6, surfaceThickness + 6);
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

        if (mirror.health < this.MIRROR_MAX_HEALTH) {
            const barWidth = size * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y - size - 10;
            
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            const healthPercent = mirror.health / this.MIRROR_MAX_HEALTH;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }

        if (mirror.isSelected) {
            const hasLoSToSun = mirror.hasLineOfSightToLight(game.suns, game.asteroids);
            const forge = mirror.owner.stellarForge;
            const hasLoSToForge = forge
                ? mirror.hasLineOfSightToForge(forge, game.asteroids, game.players)
                : false;
            const solariumRate = hasLoSToSun && hasLoSToForge ? mirror.getSolariumRatePerSec() : 0;
            const textY = screenPos.y + size + 16 * this.zoom;

            this.ctx.fillStyle = '#FFFFAA';
            this.ctx.font = `${12 * this.zoom}px Doto`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`+${solariumRate.toFixed(0)}/s`, screenPos.x, textY);
        }
    }

    /**
     * Draw space dust particle
     */
    private drawSpaceDust(particle: SpaceDustParticle, game: GameState, viewingPlayerIndex: number | null): void {
        const screenPos = this.worldToScreen(particle.position);
        const size = Constants.DUST_PARTICLE_SIZE * this.zoom;
        let particleColor = particle.currentColor;

        if (viewingPlayerIndex !== null && game.isPointInShadow(particle.position)) {
            const closestInfluenceOwnerIndex = this.getClosestInfluenceOwnerIndex(particle.position, game);
            if (closestInfluenceOwnerIndex !== null && closestInfluenceOwnerIndex !== viewingPlayerIndex) {
                particleColor = particle.baseColor;
            }
        }

        this.ctx.fillStyle = particleColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
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

        // Draw asteroid body
        this.ctx.fillStyle = '#666666';
        this.ctx.strokeStyle = '#888888';
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
        // Draw ambient lighting layers for each sun (brighter closer to sun)
        for (const sun of game.suns) {
            const sunScreenPos = this.worldToScreen(sun.position);
            const maxRadius = Math.max(this.canvas.width, this.canvas.height) * 2;
            
            // Create radial gradient centered on the sun
            const gradient = this.ctx.createRadialGradient(
                sunScreenPos.x, sunScreenPos.y, 0,
                sunScreenPos.x, sunScreenPos.y, maxRadius
            );
            
            // Subtle brightness falloff from sun - brighter near sun, dimmer farther away
            gradient.addColorStop(0, 'rgba(255, 255, 220, 0.25)');     // Brightest near sun
            gradient.addColorStop(0.15, 'rgba(255, 255, 210, 0.15)');  // Still bright
            gradient.addColorStop(0.35, 'rgba(255, 255, 200, 0.08)');  // Medium
            gradient.addColorStop(0.6, 'rgba(255, 255, 190, 0.03)');   // Dim
            gradient.addColorStop(1, 'rgba(255, 255, 180, 0)');        // Fade out
            
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
            
            for (let i = 0; i < 4; i++) {
                const angle = angles[i];
                const btnX = screenPos.x + Math.cos(angle) * buttonDistance;
                const btnY = screenPos.y + Math.sin(angle) * buttonDistance;

                this.ctx.fillStyle = '#444444';
                this.ctx.strokeStyle = '#00FFFF';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(btnX, btnY, buttonRadius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();

                // Draw button icon (placeholder)
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${12 * this.zoom}px Doto`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(`B${i + 1}`, btnX, btnY);
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

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(unit.position, this.viewingPlayer, unit);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            // Check if in shadow for dimming effect - darken color instead of using alpha
            const inShadow = game.isPointInShadow(unit.position);
            if (inShadow) {
                shouldDim = true;
                displayColor = this.darkenColor(color, Constants.SHADE_OPACITY);
            }
        }

        // Draw attack range circle for selected hero units (only friendly units)
        if (isSelected && unit.isHero && !isEnemy) {
            const attackRangeScreenRadius = unit.attackRange * this.zoom;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, attackRangeScreenRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw selection indicator for selected units
        if (isSelected) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size + 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Draw unit body (circle) - use darkened color if should dim
        this.ctx.fillStyle = displayColor;
        this.ctx.strokeStyle = isSelected ? '#00FF00' : (shouldDim ? this.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF');
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        if (unit.health < unit.maxHealth) {
            // Draw health bar
            const barWidth = size * 3;
            const barHeight = 3;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y - size - 8;
            
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            const healthPercent = unit.health / unit.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }

        // Draw direction indicator if unit has a target
        if (unit.target) {
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
     * Draw a deployed turret
     */
    private drawDeployedTurret(turret: DeployedTurret): void {
        const screenPos = this.worldToScreen(turret.position);
        const size = 15 * this.zoom;
        
        const color = this.getFactionColor(turret.owner.faction);
        
        // Draw base
        this.ctx.fillStyle = color;
        this.ctx.fillRect(screenPos.x - size * 0.6, screenPos.y - size * 0.4, size * 1.2, size * 0.8);
        
        // Draw barrel
        this.ctx.fillStyle = color;
        this.ctx.fillRect(screenPos.x - size * 0.3, screenPos.y - size, size * 0.6, size);
        
        if (turret.health < turret.maxHealth) {
            // Draw health bar
            const healthBarWidth = size * 1.5;
            const healthBarHeight = 4 * this.zoom;
            const healthPercentage = turret.health / turret.maxHealth;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(screenPos.x - healthBarWidth / 2, screenPos.y + size, healthBarWidth, healthBarHeight);
            
            this.ctx.fillStyle = healthPercentage > 0.3 ? '#00FF00' : '#FF0000';
            this.ctx.fillRect(screenPos.x - healthBarWidth / 2, screenPos.y + size, healthBarWidth * healthPercentage, healthBarHeight);
        }
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
     * Draw a Starling unit (minion from stellar forge)
     */
    private drawStarling(starling: Starling, color: string, game: GameState, isEnemy: boolean): void {
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
        
        // Draw the base unit at 30% size (minion size)
        this.drawUnit(starling, displayColor, game, isEnemy, 0.3);
        
        // Draw a distinctive star/bird symbol for starling
        const screenPos = this.worldToScreen(starling.position);
        const size = 6 * this.zoom * 0.3; // Scale the wing symbol to match the smaller unit size
        
        // Draw a simple bird-like wing pattern - darken if needed
        this.ctx.strokeStyle = shouldDim ? this.darkenColor('#FFD700', Constants.SHADE_OPACITY) : '#FFD700'; // Golden color for starlings
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        // Left wing
        this.ctx.moveTo(screenPos.x - size, screenPos.y);
        this.ctx.lineTo(screenPos.x - size * 0.3, screenPos.y - size * 0.5);
        this.ctx.lineTo(screenPos.x, screenPos.y);
        // Right wing
        this.ctx.lineTo(screenPos.x + size * 0.3, screenPos.y - size * 0.5);
        this.ctx.lineTo(screenPos.x + size, screenPos.y);
        this.ctx.stroke();
    }

    /**
     * Draw a Ray unit (Solari hero)
     */
    private drawRay(ray: Ray, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ray.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const inShadow = game.isPointInShadow(ray.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // Draw base unit
        this.drawUnit(ray, color, game, isEnemy);
        
        // Draw Ray symbol (lightning bolt)
        const screenPos = this.worldToScreen(ray.position);
        const size = 10 * this.zoom;
        
        this.ctx.strokeStyle = color;
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
            this.ctx.strokeStyle = color;
            this.ctx.globalAlpha = opacity;
            this.ctx.lineWidth = Constants.RAY_BEAM_WIDTH * this.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(startScreen.x, startScreen.y);
            this.ctx.lineTo(endScreen.x, endScreen.y);
            this.ctx.stroke();
        }
        
        // Reset alpha if we dimmed
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw an InfluenceBall unit (Solari hero)
     */
    private drawInfluenceBall(ball: InfluenceBall, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ball.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(ball.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // Draw base unit
        this.drawUnit(ball, color, game, isEnemy);
        
        // Draw sphere symbol
        const screenPos = this.worldToScreen(ball.position);
        const size = 12 * this.zoom;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();
        
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a TurretDeployer unit (Solari hero)
     */
    private drawTurretDeployer(deployer: TurretDeployer, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(deployer.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(deployer.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // Draw base unit
        this.drawUnit(deployer, color, game, isEnemy);
        
        // Draw turret symbol
        const screenPos = this.worldToScreen(deployer.position);
        const size = 10 * this.zoom;
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(screenPos.x - size * 0.5, screenPos.y - size * 0.3, size, size * 0.6);
        this.ctx.fillRect(screenPos.x - size * 0.2, screenPos.y - size, size * 0.4, size);
        
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
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
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(driller.position, this.viewingPlayer);
            if (!isVisible) {
                return;
            }
            
            const inShadow = game.isPointInShadow(driller.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // Draw base unit
        this.drawUnit(driller, color, game, isEnemy);
        
        // Draw drill symbol
        const screenPos = this.worldToScreen(driller.position);
        const size = 10 * this.zoom;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.zoom;
        
        // Draw drill bit
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x - size, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y - size * 0.5);
        this.ctx.lineTo(screenPos.x + size, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
        
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Dagger hero unit with cloak indicator
     */
    private drawDagger(dagger: Dagger, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(dagger.position, this.viewingPlayer, dagger);
            if (!isVisible) {
                return; // Cloaked Dagger is invisible to enemies
            }
            
            const inShadow = game.isPointInShadow(dagger.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // For friendly units, apply cloak opacity when cloaked
        let isCloakedFriendly = false;
        if (!isEnemy && dagger.isCloakedToEnemies()) {
            isCloakedFriendly = true;
            this.ctx.globalAlpha = Constants.DAGGER_CLOAK_OPACITY;
        }
        
        // Draw base unit
        this.drawUnit(dagger, color, game, isEnemy);
        
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
            this.ctx.strokeStyle = '#FF6600'; // Orange for strike
            this.ctx.lineWidth = 2 * this.zoom;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x - size * 0.7, screenPos.y - size * 0.7);
            this.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y + size * 0.7);
            this.ctx.stroke();
        }
        
        // Reset alpha
        if (shouldDim || isCloakedFriendly) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Beam hero unit with sniper indicator
     */
    private drawBeam(beam: Beam, color: string, game: GameState, isEnemy: boolean): void {
        // Check visibility for enemy units
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(beam.position, this.viewingPlayer, beam);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const inShadow = game.isPointInShadow(beam.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
            }
        }
        
        // Draw base unit
        this.drawUnit(beam, color, game, isEnemy);
        
        // Draw crosshair/sniper scope indicator for friendly units
        if (!isEnemy) {
            const screenPos = this.worldToScreen(beam.position);
            const size = 10 * this.zoom;
            
            this.ctx.strokeStyle = '#FF0000'; // Red for sniper
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
        
        // Reset alpha
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Minigun building
     */
    private drawMinigun(building: Minigun, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
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

        // Draw base (circular platform)
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw turret base (smaller circle in center)
        const turretBaseRadius = radius * 0.6;
        this.ctx.fillStyle = '#666666';
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
        
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = barrelWidth;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y);
        this.ctx.lineTo(
            screenPos.x + Math.cos(gunAngle) * barrelLength,
            screenPos.y + Math.sin(gunAngle) * barrelLength
        );
        this.ctx.stroke();

        if (building.health < building.maxHealth) {
            // Draw health bar
            const healthBarWidth = radius * 2;
            const healthBarHeight = 4;
            const healthBarX = screenPos.x - healthBarWidth / 2;
            const healthBarY = screenPos.y - radius - 10;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            const healthPercent = building.health / building.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        }
        
        // Reset alpha if we dimmed
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Space Dust Swirler building
     */
    private drawSpaceDustSwirler(building: SpaceDustSwirler, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
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

        // Draw influence radius (faint circle)
        const influenceRadius = Constants.SWIRLER_INFLUENCE_RADIUS * this.zoom;
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = 0.15;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, influenceRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Draw base (circular platform with energy pattern)
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw swirl pattern in center (3 curved arcs rotating counter-clockwise)
        const swirlRadius = radius * 0.7;
        this.ctx.strokeStyle = '#8A2BE2'; // Purple color for swirl
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
        this.ctx.fillStyle = '#DDA0DD'; // Plum color
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar if damaged
        if (building.health < building.maxHealth) {
            const healthBarWidth = radius * 2;
            const healthBarHeight = 4;
            const healthBarX = screenPos.x - healthBarWidth / 2;
            const healthBarY = screenPos.y - radius - 10;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            const healthPercent = building.health / building.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        }
        
        // Reset alpha if we dimmed
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Subsidiary Factory building
     */
    private drawSubsidiaryFactory(building: SubsidiaryFactory, color: string, game: GameState, isEnemy: boolean): void {
        const screenPos = this.worldToScreen(building.position);
        const radius = building.radius * this.zoom;
        
        // Check visibility for enemy buildings
        let shouldDim = false;
        if (isEnemy && this.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, this.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }
            
            // Check if in shadow for dimming effect
            const inShadow = game.isPointInShadow(building.position);
            if (inShadow) {
                shouldDim = true;
                this.ctx.globalAlpha = Constants.SHADE_OPACITY;
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
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
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

        // Draw production indicator (rotating inner hexagon)
        const innerRadius = radius * 0.6;
        const rotation = (Date.now() / 1000) % (Math.PI * 2);
        this.ctx.strokeStyle = '#FFD700'; // Gold color
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
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar if damaged
        if (building.health < building.maxHealth) {
            const healthBarWidth = radius * 2;
            const healthBarHeight = 4;
            const healthBarX = screenPos.x - healthBarWidth / 2;
            const healthBarY = screenPos.y - radius - 10;
            
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            const healthPercent = building.health / building.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : (healthPercent > 0.25 ? '#FFFF00' : '#FF0000');
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        }

        // Reset alpha if we dimmed
        if (shouldDim) {
            this.ctx.globalAlpha = 1.0;
        }
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

        const forgeScreenPos = this.worldToScreen(player.stellarForge.position);

        // Draw lines from mirrors to sun and forge
        for (const mirror of player.solarMirrors) {
            const mirrorScreenPos = this.worldToScreen(mirror.position);
            
            // Check line of sight to sun
            const hasLoSToSun = mirror.hasLineOfSightToLight(suns, asteroids);
            const closestSun = hasLoSToSun
                ? mirror.getClosestVisibleSun(suns, asteroids)
                : mirror.getClosestSun(suns);
            
            // Check line of sight to forge
            const hasLoSToForge = mirror.hasLineOfSightToForge(player.stellarForge, asteroids, players);
            
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
            
            // Draw line to forge only when blocked
            if (!hasLoSToForge) {
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                this.ctx.lineTo(forgeScreenPos.x, forgeScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Draw combined status indicator on the mirror
            if (hasLoSToSun && hasLoSToForge) {
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
                this.ctx.fillText(`Solarium: ${player.solarium.toFixed(1)}`, 20, y + 20);
                
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
        if (!this.abilityArrowStart || !this.abilityArrowEnd) return;

        const dx = this.abilityArrowEnd.x - this.abilityArrowStart.x;
        const dy = this.abilityArrowEnd.y - this.abilityArrowStart.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Don't draw if arrow is too short
        if (length < Constants.ABILITY_ARROW_MIN_LENGTH) return;

        // Draw arrow shaft
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)'; // Gold color for hero abilities
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.abilityArrowStart.x, this.abilityArrowStart.y);
        this.ctx.lineTo(this.abilityArrowEnd.x, this.abilityArrowEnd.y);
        this.ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(dy, dx);
        const arrowHeadLength = 20;
        const arrowHeadAngle = Math.PI / 6; // 30 degrees

        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
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
        this.ctx.fill();

        // Draw a circle at the start point
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(this.abilityArrowStart.x, this.abilityArrowStart.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
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
     * Draw damage numbers floating up from damaged units
     */
    private drawDamageNumbers(game: GameState): void {
        for (const damageNumber of game.damageNumbers) {
            const screenPos = this.worldToScreen(damageNumber.position);
            const opacity = damageNumber.getOpacity(game.gameTime);
            
            // Calculate size based on damage proportion to max health
            // Range: 8px (small) to 24px (large)
            const damageRatio = damageNumber.damage / damageNumber.maxHealth;
            const fontSize = Math.max(8, Math.min(24, 8 + damageRatio * 80));
            
            this.ctx.font = `bold ${fontSize}px Doto`;
            this.ctx.fillStyle = `rgba(255, 100, 100, ${opacity})`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add stroke for readability
            this.ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.8})`;
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(damageNumber.damage.toString(), screenPos.x, screenPos.y);
            this.ctx.fillText(damageNumber.damage.toString(), screenPos.x, screenPos.y);
        }
    }

    /**
     * Render the entire game state
     */
    render(game: GameState): void {
        // Clear canvas
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw parallax star layers
        for (const layer of this.starLayers) {
            this.ctx.fillStyle = '#FFFFFF';
            const dpr = window.devicePixelRatio || 1;
            
            for (const star of layer.stars) {
                // Calculate star position with parallax effect
                const parallaxX = this.camera.x * layer.parallaxFactor;
                const parallaxY = this.camera.y * layer.parallaxFactor;
                
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
            if (this.isWithinRenderBounds(particle.position, game.mapSize, 10)) {
                this.drawSpaceDust(particle, game, viewingPlayerIndex);
            }
        }

        // Draw suns
        for (const sun of game.suns) {
            this.drawSun(sun);
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
            if (this.isWithinRenderBounds(asteroid.position, game.mapSize, asteroid.size)) {
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
                this.drawInfluenceCircle(circles[0].position, circles[0].radius, color);
            } else {
                // Multiple circles of same color
                // To get union effect, we'll use a temporary canvas
                this.ctx.save();
                
                // Create path with all circles
                this.ctx.beginPath();
                for (const circle of circles) {
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

            // Draw Solar Mirrors
            if (!isEnemy) {
                for (const mirror of player.solarMirrors) {
                    this.drawSolarMirror(mirror, color, game);
                }
            }

            // Draw Stellar Forge
            if (player.stellarForge) {
                this.drawStellarForge(player.stellarForge, color, game, isEnemy);
            }
        }

        // Draw warp gates
        for (const gate of game.warpGates) {
            this.drawWarpGate(gate);
        }

        // Draw units
        for (const player of game.players) {
            if (player.isDefeated()) continue;
            
            const color = this.getFactionColor(player.faction);
            const isEnemy = this.viewingPlayer !== null && player !== this.viewingPlayer;
            
            for (const unit of player.units) {
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
                } else {
                    this.drawUnit(unit, color, game, isEnemy);
                }
            }
        }

        // Draw buildings
        for (const player of game.players) {
            if (player.isDefeated()) continue;
            
            const color = this.getFactionColor(player.faction);
            const isEnemy = this.viewingPlayer !== null && player !== this.viewingPlayer;
            
            for (const building of player.buildings) {
                if (building instanceof Minigun) {
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
            this.drawMuzzleFlash(flash);
        }

        // Draw bullet casings
        for (const casing of game.bulletCasings) {
            this.drawBulletCasing(casing);
        }

        // Draw bouncing bullets
        for (const bullet of game.bouncingBullets) {
            this.drawBouncingBullet(bullet);
        }

        // Draw ability bullets
        for (const bullet of game.abilityBullets) {
            this.drawAbilityBullet(bullet);
        }

        // Draw minion projectiles
        for (const projectile of game.minionProjectiles) {
            this.drawMinionProjectile(projectile);
        }
        
        // Draw influence zones
        for (const zone of game.influenceZones) {
            this.drawInfluenceZone(zone);
        }
        
        // Draw influence ball projectiles
        for (const projectile of game.influenceBallProjectiles) {
            this.drawInfluenceBallProjectile(projectile);
        }
        
        // Draw deployed turrets
        for (const turret of game.deployedTurrets) {
            this.drawDeployedTurret(turret);
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

        // Draw tap and swipe visual effects
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
     * Draw in-game menu overlay
     */
    private drawInGameMenuOverlay(): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = this.canvas.width / dpr;
        const screenHeight = this.canvas.height / dpr;
        const isCompactLayout = screenWidth < 600;
        
        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // Menu panel
        const panelWidth = Math.min(400, screenWidth - 40);
        const panelHeight = Math.min(350, screenHeight - 40);
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;
        
        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = `bold ${isCompactLayout ? 24 : 32}px Doto`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME MENU', screenWidth / 2, panelY + 50);
        
        // Menu buttons
        const buttonWidth = Math.min(300, panelWidth - 40);
        const buttonHeight = isCompactLayout ? 44 : 50;
        const buttonX = (screenWidth - buttonWidth) / 2;
        let buttonY = panelY + (isCompactLayout ? 80 : 100);
        const buttonSpacing = isCompactLayout ? 14 : 20;
        
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
            { label: 'Solarium Gathered', key: 'solariumGathered' },
            { label: 'Final Solarium', key: 'solarium' }
        ];
        
        for (const stat of stats) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(stat.label, leftCol, y);
            this.ctx.textAlign = 'right';
            
            for (let i = 0; i < game.players.length; i++) {
                const player = game.players[i] as any;
                const value = stat.key === 'solarium' ? player[stat.key].toFixed(1) : player[stat.key];
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
        this.camera = pos;
    }
}
