/**
 * Shared utilities and type definitions for unit renderers
 */

import { Vector2D, Unit } from '../../game-core';
import * as Constants from '../../constants';
import { GradientCache } from '../gradient-cache';

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
    gradientCache: GradientCache;

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

    // Unit drawing (needed by HeroRenderer)
    drawUnit(unit: any, color: string, game: any, isEnemy: boolean, sizeMultiplier: number, context: UnitRendererContext, useSimpleLod?: boolean): void;
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
    // Hero units show photon count instead of time-based cooldown
    if (unit.isHero) {
        drawPhotonCountIndicator(screenPos, unit, yOffset, barWidth, context);
        return;
    }

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

/**
 * Draw ability charge indicator below a hero unit.
 * Shows circles representing charges. Each circle fills progressively
 * as photons are collected (partial fill for incomplete charges).
 */
function drawPhotonCountIndicator(
    screenPos: Vector2D,
    unit: Unit,
    yOffset: number,
    barWidth: number,
    context: UnitRendererContext
): void {
    const maxCharges = unit.maxCharges;
    const photonsPerCharge = unit.photonsPerCharge;
    const photonCount = Math.min(unit.photonCount, maxCharges * photonsPerCharge);
    const dotRadius = Math.max(2, 3 * context.zoom);
    const spacing = dotRadius * 2.5;
    const totalWidth = (maxCharges - 1) * spacing;
    const startX = screenPos.x - totalWidth / 2;
    const y = screenPos.y + yOffset + dotRadius;

    for (let i = 0; i < maxCharges; i++) {
        const cx = startX + i * spacing;
        // Calculate how many photons apply to this charge
        const chargeStart = i * photonsPerCharge;
        const photonsInThisCharge = Math.max(0, Math.min(photonsPerCharge, photonCount - chargeStart));
        const fillFraction = photonsInThisCharge / photonsPerCharge;

        if (fillFraction >= 1) {
            // Fully charged - bright filled circle
            context.ctx.beginPath();
            context.ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
            context.ctx.fillStyle = '#FFE680';
            context.ctx.fill();
        } else if (fillFraction > 0) {
            // Partially charged - draw empty ring then filled arc (pie slice)
            context.ctx.beginPath();
            context.ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
            context.ctx.strokeStyle = '#665500';
            context.ctx.lineWidth = 1;
            context.ctx.stroke();

            // Draw filled pie slice for partial charge (clockwise from top)
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + fillFraction * Math.PI * 2;
            context.ctx.beginPath();
            context.ctx.moveTo(cx, y);
            context.ctx.arc(cx, y, dotRadius, startAngle, endAngle);
            context.ctx.closePath();
            context.ctx.fillStyle = '#998844';
            context.ctx.fill();
        } else {
            // Empty - outline only
            context.ctx.beginPath();
            context.ctx.arc(cx, y, dotRadius, 0, Math.PI * 2);
            context.ctx.strokeStyle = '#665500';
            context.ctx.lineWidth = 1;
            context.ctx.stroke();
        }
    }
}
