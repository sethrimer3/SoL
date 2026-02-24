/**
 * Shared utilities and type definitions for unit renderers
 */

import { Vector2D, Unit } from '../../game-core';

/**
 * Interface for accessing renderer context and state.
 * Allows UnitRenderer to access necessary GameRenderer functionality
 * without tight coupling to the full GameRenderer class.
 */
export interface UnitRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isFancyGraphicsEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    viewingPlayer: any | null;
    selectedUnits: Set<any>;

    // Constants stored on renderer
    HERO_SPRITE_SCALE: number;
    ENTITY_SHADE_GLOW_SCALE: number;
    MOVE_ORDER_DOT_RADIUS: number;
    MOVE_ORDER_FRAME_DURATION_MS: number;
    MOVE_ORDER_FALLBACK_SPRITE_PATH: string;
    movementPointFramePaths: string[];

    // Coordinate transformation
    worldToScreen(worldPos: Vector2D): Vector2D;
    getMinZoomForBounds(): number;
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;
    isScreenPosWithinViewBounds(screenPos: { x: number; y: number }, margin?: number): boolean;

    // Sprite access
    getHeroSpritePath(unit: any): string | null;
    getStarlingSpritePath(starling: any): string | null;
    getStarlingFacingRotationRad(starling: any): number | null;
    getTintedSprite(path: string, color: string): HTMLCanvasElement | null;
    getSpriteImage(path: string): HTMLImageElement;

    // Velaris faction helpers
    getVelarisGraphemeSpritePath(letter: string): string | null;
    getGraphemeMaskData(path: string): ImageData | null;
    drawVelarisGraphemeSprite(path: string, x: number, y: number, size: number, color: string): void;

    // Color manipulation
    darkenColor(color: string, opacity: number): string;
    getFactionColor(faction: any): string;
    applyShadeBrightening(color: string, position: Vector2D, game: any, isBuilding: boolean): string;
    brightenAndPaleColor(color: string): string;

    // Visibility/shadow helpers
    getEnemyVisibilityAlpha(entity: any, isVisible: boolean, gameTime: number): number;
    getShadeGlowAlpha(entity: any, shouldGlowInShade: boolean): number;

    // Drawing helpers
    drawCachedUnitGlow(screenPos: Vector2D, radiusPx: number, color: string, alphaScale?: number): void;
    drawBuildingSelectionIndicator(screenPos: Vector2D, radius: number): void;
    drawHealthDisplay(screenPos: Vector2D, currentHealth: number, maxHealth: number, size: number, yOffset: number): void;
    drawLadAura(screenPos: Vector2D, size: number, color: string, side: 'light' | 'dark'): void;
    drawFancyBloom(screenPos: Vector2D, radius: number, color: string, intensity: number): void;

    // Seed/random
    getPseudoRandom(seed: number): number;
    getStarlingParticleSeed(starling: any): number;

    // Gradient caching
    getCachedRadialGradient(
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{ offset: number; color: string }>
    ): CanvasGradient;

    // Gradient cache (direct Map access for explosion effect)
    gradientCache: Map<string, CanvasGradient>;

    // Screen shake
    triggerScreenShake(intensity?: number): void;

    // Velaris starling particle state
    starlingParticleStates: WeakMap<any, any>;
    VELARIS_STARLING_SHAPE_BLEND_SPEED: number;
    VELARIS_STARLING_PARTICLE_RADIUS_PX: number;
    VELARIS_STARLING_GRAPHEME_PULSE_SPEED: number;
    VELARIS_STARLING_GRAPHEME_ALPHA_MAX: number;
    VELARIS_STARLING_GRAPHEME_SIZE_SCALE: number;
    VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE: number;
    VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE: number;
    VELARIS_STARLING_CLOUD_TIME_SCALE: number;
    VELARIS_STARLING_PARTICLE_COUNT: number;
    VELARIS_STARLING_TRIANGLE_RADIUS_SCALE: number;
    VELARIS_STARLING_PENTAGON_RADIUS_SCALE: number;
    VELARIS_STARLING_CLOUD_RADIUS_SCALE: number;
    VELARIS_STARLING_CLOUD_SWIRL_SCALE: number;
    VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE: number;
    VELARIS_STARLING_TRIANGLE_FLOW_SPEED: number;
    VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED: number;
    VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE: number;
    VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE: number;
    VELARIS_STARLING_CLOUD_PULL_SPEED: number;
    VELARIS_FORGE_GRAPHEME_SPRITE_PATHS: string[];

    // Canvas for drawMergedStarlingRanges
    canvas: HTMLCanvasElement;
    camera: { x: number; y: number };
}

/**
 * Draw an ability cooldown bar below a unit.
 * Shared between UnitRenderer (hero units) and StarlingRenderer (starlings with blink upgrade).
 */
export function drawAbilityCooldownBar(
    screenPos: Vector2D,
    size: number,
    unit: Unit,
    fillColor: string,
    yOffset: number,
    barWidth: number,
    context: UnitRendererContext
): void {
    if (unit.abilityCooldownTime <= 0) {
        return;
    }

    const cooldownPercent = Math.max(
        0,
        Math.min(1, 1 - (unit.abilityCooldown / unit.abilityCooldownTime))
    );

    // Hide the bar entirely once the ability is fully recharged.
    if (cooldownPercent >= 1) {
        return;
    }

    const barHeight = Math.max(2, 3 * context.zoom);
    const barX = screenPos.x - barWidth / 2;
    const barY = screenPos.y + yOffset;

    context.ctx.fillStyle = '#222';
    context.ctx.fillRect(barX, barY, barWidth, barHeight);
    context.ctx.fillStyle = fillColor;
    context.ctx.fillRect(barX, barY, barWidth * cooldownPercent, barHeight);
}
