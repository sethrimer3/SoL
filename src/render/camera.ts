/**
 * Camera management for game rendering
 * Handles coordinate conversion, view bounds, and screen shake effects
 */

import { Vector2D } from '../game-core';
import * as Constants from '../constants';

export class Camera {
    public position: Vector2D = new Vector2D(0, 0);
    public zoom: number = 1.0;
    public screenShakeEnabled: boolean = true;
    private screenShakeIntensity: number = 0;
    private screenShakeTimer: number = 0;
    
    // View bounds cache for culling
    private viewMinX: number = 0;
    private viewMaxX: number = 0;
    private viewMinY: number = 0;
    private viewMaxY: number = 0;

    constructor(
        private canvas: HTMLCanvasElement
    ) {}

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
            centerX + (worldPos.x - this.position.x) * this.zoom + shakeOffsetX,
            centerY + (worldPos.y - this.position.y) * this.zoom + shakeOffsetY
        );
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): Vector2D {
        const dpr = window.devicePixelRatio || 1;
        const centerX = (this.canvas.width / dpr) / 2;
        const centerY = (this.canvas.height / dpr) / 2;
        return new Vector2D(
            this.position.x + (screenX - centerX) / this.zoom,
            this.position.y + (screenY - centerY) / this.zoom
        );
    }

    /**
     * Update view bounds cache for efficient culling
     */
    updateViewBounds(): void {
        const dpr = window.devicePixelRatio || 1;
        const viewHalfWidth = (this.canvas.width / dpr) / (2 * this.zoom);
        const viewHalfHeight = (this.canvas.height / dpr) / (2 * this.zoom);

        this.viewMinX = this.position.x - viewHalfWidth;
        this.viewMaxX = this.position.x + viewHalfWidth;
        this.viewMinY = this.position.y - viewHalfHeight;
        this.viewMaxY = this.position.y + viewHalfHeight;
    }

    /**
     * Check if a world position is within the camera view bounds
     */
    isWithinViewBounds(worldPos: Vector2D, margin: number = 0): boolean {
        return worldPos.x >= this.viewMinX - margin &&
               worldPos.x <= this.viewMaxX + margin &&
               worldPos.y >= this.viewMinY - margin &&
               worldPos.y <= this.viewMaxY + margin;
    }

    /**
     * Check if a world position is within render bounds (map boundaries)
     * @param worldPos Position in world space
     * @param mapSize Size of the map
     * @param margin Additional margin beyond map size (default 0)
     * @returns true if position should be rendered
     */
    isWithinRenderBounds(worldPos: Vector2D, mapSize: number, margin: number = 0): boolean {
        const halfSize = mapSize / 2;
        return worldPos.x >= -halfSize - margin && 
               worldPos.x <= halfSize + margin && 
               worldPos.y >= -halfSize - margin && 
               worldPos.y <= halfSize + margin;
    }

    /**
     * Trigger screen shake effect
     */
    triggerScreenShake(intensity: number = Constants.SCREEN_SHAKE_INTENSITY): void {
        if (this.screenShakeEnabled) {
            this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
            this.screenShakeTimer = Constants.SCREEN_SHAKE_DURATION;
        }
    }

    /**
     * Update screen shake effect
     */
    updateScreenShake(dt: number): void {
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer -= dt;
            
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
     * Get current screen shake intensity
     */
    getScreenShakeIntensity(): number {
        return this.screenShakeIntensity;
    }

    /**
     * Get view bounds
     */
    getViewBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        return {
            minX: this.viewMinX,
            maxX: this.viewMaxX,
            minY: this.viewMinY,
            maxY: this.viewMaxY
        };
    }
}
