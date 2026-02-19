/**
 * Forge Renderer - Handles StellarForge rendering with faction-specific effects
 * 
 * Extracted from renderer.ts as part of Phase 2.4 building renderer refactoring.
 * Follows the class-based extraction pattern established by StarfieldRenderer and SunRenderer.
 */

import { GameState, StellarForge, Vector2D, Faction } from '../../game-core';
import * as Constants from '../../constants';
import type { ForgeFlameState, ForgeScriptState, AurumShapeState, BuildingRendererContext } from './shared-utilities';

/**
 * ForgeRenderer encapsulates all StellarForge rendering logic including:
 * - Base forge rendering with faction-specific sprites
 * - Animated flame effects
 * - Velaris ancient script particle animations
 * - Aurum geometric shape animations
 * - Faction-specific visual effects
 */
export class ForgeRenderer {
    // Velaris forge script animation constants
    private readonly VELARIS_FORGE_SCRIPT_SCALE = 0.75;
    private readonly VELARIS_FORGE_PARTICLE_COUNT = 140;
    private readonly VELARIS_FORGE_PARTICLE_RADIUS_PX = 1.3;
    private readonly VELARIS_FORGE_MAIN_GRAPHEME_LETTER = 'V';
    private readonly VELARIS_FORGE_MAIN_GRAPHEME_SCALE = 1.0;
    private readonly VELARIS_FORGE_PARTICLE_SPEED_RANGE = 0.35;
    
    // Aurum forge animation constants
    private readonly AURUM_FORGE_SHAPE_COUNT = 8;
    private readonly AURUM_EDGE_DETECTION_FILL_COLOR = '#FFFFFF';
    private readonly AURUM_EDGE_DETECTION_THRESHOLD = 128;

    // State caches for animations
    private readonly forgeFlameStates = new Map<StellarForge, ForgeFlameState>();
    private readonly velarisForgeScriptStates = new Map<StellarForge, ForgeScriptState>();
    private readonly aurumForgeShapeStates = new WeakMap<StellarForge, AurumShapeState>();
    
    // Offscreen canvas for Aurum edge detection
    private aurumOffscreenCanvas: HTMLCanvasElement | null = null;

    /**
     * Main entry point for drawing a StellarForge
     */
    public drawStellarForge(
        forge: StellarForge,
        color: string,
        game: GameState,
        isEnemy: boolean,
        context: BuildingRendererContext
    ): void {
        const screenPos = context.worldToScreen(forge.position);
        const size = 40 * context.zoom;
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
        const isInShadow = !ladSun && game.isPointInShadow(forge.position);
        
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(forge.position, context.viewingPlayer);
            visibilityAlpha = context.getEnemyVisibilityAlpha(forge, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(forge.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(forgeColor, Constants.SHADE_OPACITY);
                    // Apply shade brightening effect near player units
                    displayColor = context.applyShadeBrightening(displayColor, forge.position, game, true);
                }
            }
        }

        context.ctx.save();
        context.ctx.globalAlpha = visibilityAlpha;

        const shouldGlowInShade = isEnemy
            ? (isInShadow && visibilityAlpha > 0.01)
            : isInShadow;
        context.drawStructureShadeGlow(
            forge,
            screenPos,
            size,
            displayColor,
            shouldGlowInShade,
            visibilityAlpha,
            forge.isSelected
        );

        // Draw selection circle if selected
        if (forge.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, size * 1.45);
            
            // Draw minion path if it exists
            if (forge.minionPath.length > 0) {
                // Add viewport culling margin to prevent pop-in
                const viewportMargin = 100;
                
                // Check if forge or any waypoint is visible
                let hasVisibleElement = context.isWithinViewBounds(forge.position, viewportMargin);
                if (!hasVisibleElement) {
                    for (const waypoint of forge.minionPath) {
                        if (context.isWithinViewBounds(waypoint, viewportMargin)) {
                            hasVisibleElement = true;
                            break;
                        }
                    }
                }
                
                // Only draw if something is visible
                if (hasVisibleElement) {
                    context.ctx.strokeStyle = '#FFFF00'; // Yellow path
                    context.ctx.lineWidth = 3;
                    context.ctx.setLineDash([10, 5]); // Dashed line
                    context.ctx.beginPath();
                    
                    // Start from the forge position
                    const startScreen = context.worldToScreen(forge.position);
                    context.ctx.moveTo(startScreen.x, startScreen.y);
                    
                    // Draw line through all waypoints
                    for (const waypoint of forge.minionPath) {
                        const waypointScreen = context.worldToScreen(waypoint);
                        context.ctx.lineTo(waypointScreen.x, waypointScreen.y);
                    }
                    
                    context.ctx.stroke();
                    context.ctx.setLineDash([]); // Reset line dash
                }
            }
        }

        // Draw aesthetic shadow
        context.drawAestheticSpriteShadow(
            forge.position,
            screenPos,
            size * 1.2,
            game,
            {
                isBuilding: true,
                direction: 'down-right'
            }
        );

        // Draw faction-specific forge
        const faction = forge.owner.faction;
        if (faction === Faction.VELARIS) {
            this.drawVelarisForge(forge, screenPos, size, displayColor, game.gameTime, shouldDim, context);
        } else if (faction === Faction.AURUM) {
            this.drawAurumForge(forge, screenPos, size, displayColor, game.gameTime, context);
        } else {
            // Radiant forge (default)
            this.drawRadiantForge(forge, screenPos, size, displayColor, game, shouldDim, context);
        }

        context.ctx.restore();
    }

    /**
     * Draw Radiant faction forge with animated flames
     */
    private drawRadiantForge(
        forge: StellarForge,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        game: GameState,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const forgeSpriteSize = size * 2;
        const spritePath = context.getGraphicAssetPath('stellarForge');
        const spriteImage = spritePath ? context.getSpriteImage(spritePath) : null;

        if (spriteImage && spriteImage.complete && spriteImage.naturalWidth > 0 && spritePath) {
            const tintedSprite = context.getTintedSprite(spritePath, displayColor);
            const spriteWidth = forgeSpriteSize;
            const spriteHeight = forgeSpriteSize;
            context.ctx.drawImage(
                tintedSprite,
                screenPos.x - spriteWidth / 2,
                screenPos.y - spriteHeight / 2,
                spriteWidth,
                spriteHeight
            );
        } else {
            // Fallback to simple circle
            context.ctx.fillStyle = displayColor;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            context.ctx.fill();
        }

        // Draw flames
        this.drawForgeFlames(forge, screenPos, forgeSpriteSize, game, shouldDim, context);

        // Draw health display
        context.drawHealthDisplay(screenPos, forge.health, forge.maxHealth, size, -size - 10);
    }

    /**
     * Draw Velaris faction forge with ancient script particle effects
     */
    private drawVelarisForge(
        forge: StellarForge,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const forgeSpriteSize = size * 2;
        const spritePath = context.getGraphicAssetPath('stellarForge');
        const spriteImage = spritePath ? context.getSpriteImage(spritePath) : null;

        if (spriteImage && spriteImage.complete && spriteImage.naturalWidth > 0 && spritePath) {
            const tintedSprite = context.getTintedSprite(spritePath, displayColor);
            const spriteWidth = forgeSpriteSize;
            const spriteHeight = forgeSpriteSize;
            context.ctx.drawImage(
                tintedSprite,
                screenPos.x - spriteWidth / 2,
                screenPos.y - spriteHeight / 2,
                spriteWidth,
                spriteHeight
            );
        } else {
            // Fallback to simple circle
            context.ctx.fillStyle = displayColor;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            context.ctx.fill();
        }

        // Draw Velaris script animation
        this.drawVelarisForgeScript(forge, screenPos, size, displayColor, gameTime, shouldDim, context);

        // Draw health display
        context.drawHealthDisplay(screenPos, forge.health, forge.maxHealth, size, -size - 10);
    }

    /**
     * Draw Aurum faction forge with animated geometric shapes
     */
    private drawAurumForge(
        forge: StellarForge,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        context: BuildingRendererContext
    ): void {
        // Draw Aurum outline animation
        this.drawAurumForgeOutline(forge, screenPos, size, displayColor, gameTime, context);

        // Draw health display
        context.drawHealthDisplay(screenPos, forge.health, forge.maxHealth, size, -size - 10);
    }

    /**
     * Draw animated forge flames (hot/cold transition)
     */
    private drawForgeFlames(
        forge: StellarForge,
        screenPos: Vector2D,
        forgeSpriteSize: number,
        game: GameState,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const flameState = this.getForgeFlameState(forge, game.gameTime);
        const hotSpritePath = context.getGraphicAssetPath('forgeFlameHot');
        const coldSpritePath = context.getGraphicAssetPath('forgeFlameCold');
        if (!hotSpritePath || !coldSpritePath) {
            return;
        }
        const hotSprite = context.getSpriteImage(hotSpritePath);
        const coldSprite = context.getSpriteImage(coldSpritePath);

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

            context.ctx.save();
            context.ctx.translate(screenPos.x + offsetX, screenPos.y);
            context.ctx.rotate(rotationRad);

            if (coldAlpha > 0) {
                context.ctx.globalAlpha = coldAlpha;
                context.ctx.drawImage(coldSprite, -flameSize / 2, -flameSize / 2, flameSize, flameSize);
            }

            if (hotAlpha > 0) {
                context.ctx.globalAlpha = hotAlpha;
                context.ctx.drawImage(hotSprite, -flameSize / 2, -flameSize / 2, flameSize, flameSize);
            }

            context.ctx.restore();
        }

        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw Velaris ancient script particle animation
     */
    private drawVelarisForgeScript(
        forge: StellarForge,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const scriptScale = size * this.VELARIS_FORGE_SCRIPT_SCALE;
        const mainGraphemePath = context.getVelarisGraphemeSpritePath(this.VELARIS_FORGE_MAIN_GRAPHEME_LETTER);
        const graphemeMask = mainGraphemePath ? context.getGraphemeMaskData(mainGraphemePath) : null;
        const state = this.getVelarisForgeScriptState(forge, gameTime, context);
        const deltaTimeSec = Math.min(0.05, Math.max(0, gameTime - state.lastGameTime));
        state.lastGameTime = gameTime;
        this.updateVelarisForgeParticles(state, deltaTimeSec, graphemeMask);

        const particleRadius = Math.max(1, this.VELARIS_FORGE_PARTICLE_RADIUS_PX * context.zoom);
        const baseAlpha = shouldDim ? 0.45 : 0.75;
        const outlineAlpha = shouldDim ? 0.5 : 0.8;
        const graphemeSize = scriptScale * this.VELARIS_FORGE_MAIN_GRAPHEME_SCALE;

        if (mainGraphemePath) {
            context.ctx.save();
            context.ctx.globalAlpha = outlineAlpha;
            context.drawVelarisGraphemeSprite(
                mainGraphemePath,
                screenPos.x,
                screenPos.y,
                graphemeSize,
                displayColor
            );
            context.ctx.restore();
        }

        context.ctx.save();
        context.ctx.globalAlpha = baseAlpha;
        context.ctx.fillStyle = displayColor;
        const count = state.positionsX.length;
        for (let i = 0; i < count; i++) {
            const x = screenPos.x + state.positionsX[i] * graphemeSize;
            const y = screenPos.y + state.positionsY[i] * graphemeSize;
            context.ctx.beginPath();
            context.ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
            context.ctx.fill();
        }
        context.ctx.restore();

        context.ctx.restore();
    }

    /**
     * Draw Aurum forge outline with moving geometric shapes
     */
    private drawAurumForgeOutline(
        forge: StellarForge,
        screenPos: Vector2D,
        baseSize: number,
        displayColor: string,
        gameTime: number,
        context: BuildingRendererContext
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
        const maxX = Math.min(context.canvasWidth, Math.ceil(screenPos.x + padding));
        const minY = Math.max(0, Math.floor(screenPos.y - padding));
        const maxY = Math.min(context.canvasHeight, Math.ceil(screenPos.y + padding));
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
        context.detectAndDrawEdges(imageData, cropWidth, cropHeight, minX, minY, displayColor);
    }

    /**
     * Get or initialize forge flame animation state
     */
    private getForgeFlameState(forge: StellarForge, gameTime: number): ForgeFlameState {
        let state = this.forgeFlameStates.get(forge);
        if (!state) {
            state = {
                warmth: 0,
                rotationRad: 0,
                lastGameTime: gameTime
            };
            this.forgeFlameStates.set(forge, state);
        }

        // Update flame state based on time
        const deltaTime = gameTime - state.lastGameTime;
        state.lastGameTime = gameTime;

        // Oscillate warmth slowly
        const warmthCycleDuration = 3; // seconds
        const warmthPhase = (gameTime / warmthCycleDuration) % 1;
        state.warmth = 0.5 + 0.5 * Math.sin(warmthPhase * Math.PI * 2);

        // Rotate slowly
        const rotationSpeed = 0.2; // radians per second
        state.rotationRad += rotationSpeed * deltaTime;

        return state;
    }

    /**
     * Get or initialize Velaris forge script particle state
     */
    private getVelarisForgeScriptState(forge: StellarForge, gameTime: number, context: BuildingRendererContext): ForgeScriptState {
        let state = this.velarisForgeScriptStates.get(forge);
        if (!state) {
            const count = this.VELARIS_FORGE_PARTICLE_COUNT;
            state = {
                positionsX: new Float32Array(count),
                positionsY: new Float32Array(count),
                velocitiesX: new Float32Array(count),
                velocitiesY: new Float32Array(count),
                lastGameTime: gameTime
            };

            // Initialize particle positions and velocities
            const seed = forge.position.x * 1000 + forge.position.y;
            for (let i = 0; i < count; i++) {
                const angle = context.getPseudoRandom(seed + i) * Math.PI * 2;
                const radius = context.getPseudoRandom(seed + i + 1000) * 0.5;
                state.positionsX[i] = Math.cos(angle) * radius;
                state.positionsY[i] = Math.sin(angle) * radius;
                
                const speed = this.VELARIS_FORGE_PARTICLE_SPEED_RANGE;
                state.velocitiesX[i] = (context.getPseudoRandom(seed + i + 2000) - 0.5) * speed;
                state.velocitiesY[i] = (context.getPseudoRandom(seed + i + 3000) - 0.5) * speed;
            }

            this.velarisForgeScriptStates.set(forge, state);
        }
        return state;
    }

    /**
     * Update Velaris forge particle positions
     */
    private updateVelarisForgeParticles(state: ForgeScriptState, deltaTime: number, graphemeMask: ImageData | null): void {
        const count = state.positionsX.length;
        const boundaryLimit = 0.5;

        for (let i = 0; i < count; i++) {
            // Update position
            state.positionsX[i] += state.velocitiesX[i] * deltaTime;
            state.positionsY[i] += state.velocitiesY[i] * deltaTime;

            // Bounce off boundaries or grapheme mask
            if (Math.abs(state.positionsX[i]) > boundaryLimit) {
                state.velocitiesX[i] *= -1;
                state.positionsX[i] = Math.max(-boundaryLimit, Math.min(boundaryLimit, state.positionsX[i]));
            }
            if (Math.abs(state.positionsY[i]) > boundaryLimit) {
                state.velocitiesY[i] *= -1;
                state.positionsY[i] = Math.max(-boundaryLimit, Math.min(boundaryLimit, state.positionsY[i]));
            }

            // Check grapheme mask collision if available
            if (graphemeMask) {
                const maskX = Math.floor((state.positionsX[i] + 0.5) * graphemeMask.width);
                const maskY = Math.floor((state.positionsY[i] + 0.5) * graphemeMask.height);
                if (maskX >= 0 && maskX < graphemeMask.width && maskY >= 0 && maskY < graphemeMask.height) {
                    const pixelIndex = (maskY * graphemeMask.width + maskX) * 4;
                    const alpha = graphemeMask.data[pixelIndex + 3];
                    if (alpha > 128) {
                        // Inside the grapheme, bounce out
                        state.velocitiesX[i] *= -1;
                        state.velocitiesY[i] *= -1;
                    }
                }
            }
        }
    }

    /**
     * Get or initialize Aurum forge shape animation state
     */
    private getAurumForgeShapeState(forge: StellarForge, gameTime: number): AurumShapeState {
        let state = this.aurumForgeShapeStates.get(forge);
        if (!state) {
            const shapes: Array<{ size: number; speed: number; angle: number; offset: number }> = [];
            const seed = forge.position.x * 1000 + forge.position.y;
            
            for (let i = 0; i < this.AURUM_FORGE_SHAPE_COUNT; i++) {
                const pseudoRand1 = Math.sin(seed + i * 1.37) * 10000;
                const pseudoRand2 = Math.sin(seed + i * 2.71) * 10000;
                const pseudoRand3 = Math.sin(seed + i * 3.14) * 10000;
                const pseudoRand4 = Math.sin(seed + i * 4.67) * 10000;
                
                shapes.push({
                    size: 0.4 + (pseudoRand1 - Math.floor(pseudoRand1)) * 0.6,
                    speed: 0.3 + (pseudoRand2 - Math.floor(pseudoRand2)) * 0.7,
                    angle: (pseudoRand3 - Math.floor(pseudoRand3)) * Math.PI * 2,
                    offset: 0.3 + (pseudoRand4 - Math.floor(pseudoRand4)) * 0.4
                });
            }
            
            state = {
                shapes,
                lastGameTime: gameTime
            };
            this.aurumForgeShapeStates.set(forge, state);
        }
        return state;
    }
}
