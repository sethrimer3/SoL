/**
 * Shared utilities and type definitions for building renderers
 */

import { Vector2D } from '../../game-core';

/**
 * State for animated forge flames
 */
export type ForgeFlameState = {
    warmth: number;
    rotationRad: number;
    lastGameTime: number;
};

/**
 * State for Velaris forge script particle animation
 */
export type ForgeScriptState = {
    positionsX: Float32Array;
    positionsY: Float32Array;
    velocitiesX: Float32Array;
    velocitiesY: Float32Array;
    lastGameTime: number;
};

/**
 * State for Aurum animated shapes (forge and foundry outlines)
 */
export type AurumShapeState = {
    shapes: Array<{
        size: number;
        speed: number;
        angle: number;
        offset: number;
    }>;
    lastGameTime: number;
};

/**
 * Interface for accessing renderer context and state
 * This allows building renderers to access necessary renderer functionality
 * without tight coupling to the full GameRenderer class
 */
export interface BuildingRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    playerColor: string;
    enemyColor: string;
    canvasWidth: number;
    canvasHeight: number;
    viewingPlayer: any | null; // Player or null for spectator mode
    
    // Coordinate transformation
    worldToScreen(worldPos: Vector2D): Vector2D;
    
    // Sprite and texture access
    getSpriteImage(path: string): HTMLImageElement;
    getTintedSprite(path: string, color: string): HTMLCanvasElement;
    getGraphicAssetPath(key: string): string | null;
    
    // Gradient caching
    getCachedRadialGradient(key: string, radiusPx: number, colorStops: Array<[number, string]>): CanvasGradient;
    
    // Color manipulation
    darkenColor(color: string, opacity: number): string;
    applyShadeBrightening(color: string, position: Vector2D, game: any, isBuilding: boolean): string;
    
    // Visibility and shadow effects
    getEnemyVisibilityAlpha(entity: any, isVisible: boolean, gameTime: number): number;
    drawStructureShadeGlow(
        entity: any,
        screenPos: Vector2D,
        size: number,
        color: string,
        shouldGlow: boolean,
        visibilityAlpha: number,
        isSelected: boolean
    ): void;
    
    // Common rendering utilities
    drawAestheticSpriteShadow(
        worldPos: Vector2D,
        screenPos: Vector2D,
        size: number,
        game: any,
        options: { isBuilding?: boolean; direction?: string; opacity?: number; widthScale?: number; particleCount?: number; particleSpread?: number }
    ): void;
    drawBuildingSelectionIndicator(screenPos: Vector2D, radius: number): void;
    drawHealthDisplay(screenPos: Vector2D, currentHealth: number, maxHealth: number, size: number, yOffset: number): void;
    drawLadAura(screenPos: Vector2D, size: number, color: string, side: 'light' | 'dark'): void;
    drawMoveOrderIndicator(fromPos: Vector2D, toPos: Vector2D, moveOrder: number, color: string): void;
    drawWarpGateProductionEffect(screenPos: Vector2D, radius: number, game: any, color: string): void;
    
    // Viewport culling
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;
    
    // Velaris faction helpers
    getVelarisGraphemeSpritePath(letter: string): string | null;
    getGraphemeMaskData(path: string): ImageData | null;
    drawVelarisGraphemeSprite(path: string, x: number, y: number, size: number, color: string): void;
    
    // Edge detection for Aurum faction
    detectAndDrawEdges(imageData: ImageData, width: number, height: number, offsetX: number, offsetY: number, color: string): void;
    
    // Pseudo-random generator (deterministic)
    getPseudoRandom(seed: number): number;
}
