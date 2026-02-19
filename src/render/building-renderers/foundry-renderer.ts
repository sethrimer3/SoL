/**
 * Foundry Renderer - Handles SubsidiaryFactory (Foundry) rendering with faction-specific effects
 * 
 * Extracted from renderer.ts as part of Phase 2.4 building renderer refactoring.
 * Follows the class-based extraction pattern established by ForgeRenderer.
 */

import { GameState, SubsidiaryFactory, Vector2D, Faction } from '../../game-core';
import * as Constants from '../../constants';
import { getRadialButtonOffsets } from '../render-utilities';
import type { AurumShapeState, BuildingRendererContext } from './shared-utilities';

/**
 * FoundryRenderer encapsulates all SubsidiaryFactory rendering logic including:
 * - Base foundry rendering with faction-specific sprites
 * - Three-layer spinning animation (bottom, middle, top)
 * - Production speed-up animation
 * - Velaris ancient script particle animations
 * - Aurum geometric triangle animations
 * - Upgrade buttons (Strafe, Blink, Regen, +1 ATK)
 */
export class FoundryRenderer {
    // Velaris foundry animation constants
    private readonly VELARIS_FOUNDRY_GRAPHEME_LETTER = 'F';
    private readonly VELARIS_FOUNDRY_PARTICLE_COUNT = 26;
    private readonly VELARIS_FOUNDRY_PARTICLE_RADIUS_PX = 1.2;
    private readonly VELARIS_FOUNDRY_PARTICLE_ORBIT_SPEED_RAD_PER_SEC = 0.8;

    // Aurum foundry animation constants
    private readonly AURUM_FOUNDRY_SHAPE_COUNT = 10;
    private readonly AURUM_SEED_BASE_MULTIPLIER = 1000;
    private readonly AURUM_FOUNDRY_SEED_MULTIPLIER = 157.3;
    private readonly AURUM_EDGE_DETECTION_FILL_COLOR = '#FFFFFF';

    // State caches for animations
    private readonly velarisFoundrySeeds = new WeakMap<SubsidiaryFactory, number>();
    private readonly aurumFoundryShapeStates = new WeakMap<SubsidiaryFactory, AurumShapeState>();

    // Offscreen canvas for Aurum edge detection (shared with forge)
    private aurumOffscreenCanvas: HTMLCanvasElement | null = null;

    /**
     * Main entry point for drawing a SubsidiaryFactory (Foundry)
     */
    public drawSubsidiaryFactory(
        building: SubsidiaryFactory,
        color: string,
        game: GameState,
        isEnemy: boolean,
        context: BuildingRendererContext
    ): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
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

        let shouldDim = false;
        let displayColor = buildingColor;
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, context.viewingPlayer);
            if (!isVisible) {
                return;
            }

            if (!ladSun && isInShadow) {
                shouldDim = true;
                displayColor = context.darkenColor(buildingColor, Constants.SHADE_OPACITY);
            }
        }

        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, isInShadow, 1, building.isSelected);

        // Draw build progress if not complete
        if (!building.isComplete) {
            context.drawWarpGateProductionEffect(screenPos, radius, game, displayColor);

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#FFD700';
            context.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);

            if (shouldDim) {
                context.ctx.globalAlpha = 1.0;
            }
            return;
        }

        // Draw LaD aura
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        // Draw faction-specific foundry
        const isAurumFoundry = building.owner.faction === Faction.AURUM;
        if (isAurumFoundry) {
            this.drawAurumFoundry(building, screenPos, radius, displayColor, game.gameTime, context);
        } else if (isVelarisFoundry) {
            this.drawVelarisFoundry(building, screenPos, radius, displayColor, game.gameTime, shouldDim, context);
        } else {
            this.drawRadiantFoundry(building, screenPos, radius, displayColor, game.gameTime, context);
        }

        // Draw production progress bar if producing
        if (building.currentProduction) {
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#4CAF50';
            context.ctx.fillRect(barX, barY, barWidth * building.productionProgress, barHeight);
        }

        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw Radiant faction foundry with three-layer spinning animation
     */
    private drawRadiantFoundry(
        building: SubsidiaryFactory,
        screenPos: Vector2D,
        radius: number,
        displayColor: string,
        gameTime: number,
        context: BuildingRendererContext
    ): void {
        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_bottom.png';
        const middleSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_middle.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantFoundry_top.png';

        const bottomSprite = context.getTintedSprite(bottomSpritePath, displayColor);
        const middleSprite = context.getTintedSprite(middleSpritePath, displayColor);
        const topSprite = context.getTintedSprite(topSpritePath, displayColor);

        const referenceSprite = bottomSprite || middleSprite || topSprite;
        if (!referenceSprite) {
            return;
        }

        const spriteScale = (radius * 2) / referenceSprite.width;
        const isProducing = Boolean(building.currentProduction);
        const baseSpinSpeedRad = 0.2;
        const producingMultiplier = 2.5;
        const ACCELERATION_PHASE_DURATION = 0.2;

        let speedMultiplier = 1.0;
        if (isProducing) {
            if (building.productionProgress < ACCELERATION_PHASE_DURATION) {
                const accelProgress = building.productionProgress / ACCELERATION_PHASE_DURATION;
                const easeAccel = 0.5 - 0.5 * Math.cos(accelProgress * Math.PI);
                speedMultiplier = 1.0 + (producingMultiplier - 1.0) * easeAccel;
            } else {
                speedMultiplier = producingMultiplier;
            }
        }

        const spinSpeedRad = baseSpinSpeedRad * speedMultiplier;
        const bottomRotationRad = gameTime * spinSpeedRad;
        const topRotationRad = -gameTime * spinSpeedRad;

        const drawLayer = (sprite: HTMLCanvasElement | null, rotationRad: number): void => {
            if (!sprite) {
                return;
            }
            const spriteWidth = sprite.width * spriteScale;
            const spriteHeight = sprite.height * spriteScale;
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(rotationRad);
            context.ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
            context.ctx.restore();
        };

        drawLayer(bottomSprite, bottomRotationRad);

        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);
            this.drawFoundryButtons(building, screenPos, context);
        }

        drawLayer(middleSprite, 0);
        drawLayer(topSprite, topRotationRad);
    }

    /**
     * Draw Velaris faction foundry with ancient script particle animations
     */
    private drawVelarisFoundry(
        building: SubsidiaryFactory,
        screenPos: Vector2D,
        radius: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const bottomSpritePath = 'ASSETS/sprites/VELARIS/structures/velarisFoundry_bottom.png';
        const middleSpritePath = 'ASSETS/sprites/VELARIS/structures/velarisFoundry_middle.png';
        const topSpritePath = 'ASSETS/sprites/VELARIS/structures/velarisFoundry_top.png';

        const bottomSprite = context.getTintedSprite(bottomSpritePath, displayColor);
        const middleSprite = context.getTintedSprite(middleSpritePath, displayColor);
        const topSprite = context.getTintedSprite(topSpritePath, displayColor);

        const referenceSprite = bottomSprite || middleSprite || topSprite;
        if (!referenceSprite) {
            return;
        }

        const spriteScale = (radius * 2) / referenceSprite.width;
        const isProducing = Boolean(building.currentProduction);
        const baseSpinSpeedRad = 0.2;
        const producingMultiplier = 2.5;
        const ACCELERATION_PHASE_DURATION = 0.2;

        let speedMultiplier = 1.0;
        if (isProducing) {
            if (building.productionProgress < ACCELERATION_PHASE_DURATION) {
                const accelProgress = building.productionProgress / ACCELERATION_PHASE_DURATION;
                const easeAccel = 0.5 - 0.5 * Math.cos(accelProgress * Math.PI);
                speedMultiplier = 1.0 + (producingMultiplier - 1.0) * easeAccel;
            } else {
                speedMultiplier = producingMultiplier;
            }
        }

        const spinSpeedRad = baseSpinSpeedRad * speedMultiplier;
        const bottomRotationRad = gameTime * spinSpeedRad;
        const topRotationRad = -gameTime * spinSpeedRad;

        const drawLayer = (sprite: HTMLCanvasElement | null, rotationRad: number): void => {
            if (!sprite) {
                return;
            }
            const spriteWidth = sprite.width * spriteScale;
            const spriteHeight = sprite.height * spriteScale;
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(rotationRad);
            context.ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
            context.ctx.restore();
        };

        drawLayer(bottomSprite, bottomRotationRad);

        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);
            this.drawFoundryButtons(building, screenPos, context);
        }

        // Draw Velaris script sigil on top
        this.drawVelarisFoundrySigil(building, screenPos, radius, displayColor, gameTime, shouldDim, context);

        drawLayer(middleSprite, 0);
        drawLayer(topSprite, topRotationRad);
    }

    /**
     * Draw Aurum faction foundry with geometric triangle animations
     */
    private drawAurumFoundry(
        building: SubsidiaryFactory,
        screenPos: Vector2D,
        radius: number,
        displayColor: string,
        gameTime: number,
        context: BuildingRendererContext
    ): void {
        this.drawAurumFoundryOutline(building, screenPos, radius, displayColor, gameTime, context);
        
        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);
            this.drawFoundryButtons(building, screenPos, context);
        }
    }

    /**
     * Draw Velaris foundry sigil with orbiting particles
     */
    private drawVelarisFoundrySigil(
        foundry: SubsidiaryFactory,
        screenPos: Vector2D,
        size: number,
        displayColor: string,
        gameTime: number,
        shouldDim: boolean,
        context: BuildingRendererContext
    ): void {
        const graphemePath = context.getVelarisGraphemeSpritePath(this.VELARIS_FOUNDRY_GRAPHEME_LETTER);
        const graphemeSize = size * 1.55;
        const particleRadius = Math.max(1, this.VELARIS_FOUNDRY_PARTICLE_RADIUS_PX * context.zoom);
        const isProducing = Boolean(foundry.currentProduction);
        const speedMultiplier = isProducing ? 2.6 : 1;
        const orbitSpeed = this.VELARIS_FOUNDRY_PARTICLE_ORBIT_SPEED_RAD_PER_SEC * speedMultiplier;
        const seed = this.getVelarisFoundrySeed(foundry);
        const twoPi = Math.PI * 2;
        const orbitRadiusBase = graphemeSize * 0.62;
        const glyphAlpha = shouldDim ? 0.5 : 0.85;
        const particleAlpha = shouldDim ? 0.35 : 0.7;

        if (graphemePath) {
            context.ctx.save();
            context.ctx.globalAlpha = glyphAlpha;
            context.drawVelarisGraphemeSprite(graphemePath, screenPos.x, screenPos.y, graphemeSize, displayColor);
            context.ctx.restore();
        }

        context.ctx.save();
        context.ctx.globalAlpha = particleAlpha;
        context.ctx.fillStyle = displayColor;
        for (let i = 0; i < this.VELARIS_FOUNDRY_PARTICLE_COUNT; i++) {
            const baseAngle = context.getPseudoRandom(seed + i * 1.37) * twoPi;
            const orbitRadius = orbitRadiusBase * (0.75 + context.getPseudoRandom(seed + i * 2.11) * 0.4);
            const angle = baseAngle + gameTime * orbitSpeed + context.getPseudoRandom(seed + i * 3.07) * 0.5;
            const x = screenPos.x + Math.cos(angle) * orbitRadius;
            const y = screenPos.y + Math.sin(angle) * orbitRadius;
            context.ctx.beginPath();
            context.ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
            context.ctx.fill();
        }
        context.ctx.restore();
    }

    /**
     * Draw Aurum foundry outline with moving triangles
     */
    private drawAurumFoundryOutline(
        foundry: SubsidiaryFactory,
        screenPos: Vector2D,
        baseSize: number,
        displayColor: string,
        gameTime: number,
        context: BuildingRendererContext
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
        context.detectAndDrawEdges(imageData, cropWidth, cropHeight, minX, minY, displayColor);
    }

    /**
     * Draw foundry upgrade buttons (Strafe, Blink, Regen, +1 ATK)
     */
    private drawFoundryButtons(
        foundry: SubsidiaryFactory,
        screenPos: Vector2D,
        context: BuildingRendererContext
    ): void {
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * context.zoom;
        const buttonDistance = Constants.HERO_BUTTON_DISTANCE_PX * context.zoom;

        const buttonConfigs = [
            { 
                label: 'Strafe',
                cost: Constants.FOUNDRY_STRAFE_UPGRADE_COST,
                available: foundry.canQueueStrafeUpgrade(),
                index: 0
            },
            {
                label: 'Blink',
                cost: Constants.FOUNDRY_BLINK_UPGRADE_COST,
                available: foundry.canQueueBlinkUpgrade(),
                index: 1
            },
            {
                label: 'Regen',
                cost: Constants.FOUNDRY_REGEN_UPGRADE_COST,
                available: foundry.canQueueRegenUpgrade(),
                index: 2
            },
            {
                label: '+1 ATK',
                cost: Constants.FOUNDRY_ATTACK_UPGRADE_COST,
                available: foundry.canQueueAttackUpgrade(),
                index: 3
            }
        ];
        const positions = getRadialButtonOffsets(buttonConfigs.length);

        for (let i = 0; i < buttonConfigs.length; i++) {
            const config = buttonConfigs[i];
            const pos = positions[i];
            const buttonX = screenPos.x + pos.x * buttonDistance;
            const buttonY = screenPos.y + pos.y * buttonDistance;
            const isHighlighted = context.highlightedButtonIndex === config.index;

            // Draw button background with highlight effect
            context.ctx.fillStyle = isHighlighted 
                ? 'rgba(255, 215, 0, 0.7)' 
                : (config.available ? 'rgba(255, 215, 0, 0.3)' : 'rgba(128, 128, 128, 0.3)');
            context.ctx.strokeStyle = isHighlighted 
                ? '#FFD700' 
                : (config.available ? '#FFD700' : '#888888');
            context.ctx.lineWidth = isHighlighted ? 4 : 2;
            context.ctx.beginPath();
            context.ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();
            
            // Draw button label
            context.ctx.fillStyle = config.available ? '#FFFFFF' : '#666666';
            context.ctx.font = `${12 * context.zoom}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText(config.label, buttonX, buttonY);
            
            // Draw cost label
            this.drawRadialButtonCostLabel(buttonX, buttonY, pos.x, pos.y, buttonRadius, config.cost, config.available, context);
        }
    }

    /**
     * Draw cost label for radial buttons
     */
    private drawRadialButtonCostLabel(
        buttonX: number,
        buttonY: number,
        radialX: number,
        radialY: number,
        buttonRadius: number,
        cost: number,
        isAvailable: boolean,
        context: BuildingRendererContext
    ): void {
        const radialLength = Math.hypot(radialX, radialY);
        const directionX = radialLength > 0 ? radialX / radialLength : 0;
        const directionY = radialLength > 0 ? radialY / radialLength : -1;
        const costOffsetPx = buttonRadius + 10 * context.zoom;
        const costX = buttonX + directionX * costOffsetPx;
        const costY = buttonY + directionY * costOffsetPx;

        context.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#888888';
        context.ctx.font = `${10 * context.zoom}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText(cost.toString(), costX, costY);
    }

    /**
     * Get or initialize Velaris foundry seed for deterministic particles
     */
    private getVelarisFoundrySeed(foundry: SubsidiaryFactory): number {
        let seed = this.velarisFoundrySeeds.get(foundry);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisFoundrySeeds.set(foundry, seed);
        }
        return seed;
    }

    /**
     * Get or initialize Aurum foundry shape state
     */
    private getAurumFoundryShapeState(foundry: SubsidiaryFactory, gameTime: number): AurumShapeState {
        let state = this.aurumFoundryShapeStates.get(foundry);
        if (!state) {
            // Initialize with multiple triangles of different sizes and speeds
            const shapes: Array<{size: number; speed: number; angle: number; offset: number}> = [];
            const seed = foundry.position.x * this.AURUM_SEED_BASE_MULTIPLIER + foundry.position.y;
            
            for (let i = 0; i < this.AURUM_FOUNDRY_SHAPE_COUNT; i++) {
                const random = (seed + i * this.AURUM_FOUNDRY_SEED_MULTIPLIER) % 1000 / 1000;
                const size = 0.25 + random * 1.0; // Sizes from 0.25 to 1.25
                const speed = 0.2 + (random * 0.6); // Speeds from 0.2 to 0.8 rad/sec
                const angle = (i / this.AURUM_FOUNDRY_SHAPE_COUNT) * Math.PI * 2; // Evenly distributed initial angles
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
}
