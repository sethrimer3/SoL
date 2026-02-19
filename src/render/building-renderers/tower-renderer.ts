/**
 * Tower Renderer - Handles tower building rendering (Minigun, SpaceDustSwirler, StrikerTower, etc.)
 *
 * Extracted from renderer.ts as part of Phase 2.4 building renderer refactoring.
 * Follows the class-based extraction pattern established by ForgeRenderer and FoundryRenderer.
 */

import { GameState, Vector2D, Minigun, GatlingTower, SpaceDustSwirler, StrikerTower, LockOnLaserTower, ShieldTower } from '../../game-core';
import * as Constants from '../../constants';
import type { BuildingRendererContext } from './shared-utilities';

/**
 * TowerRenderer encapsulates all tower building rendering logic including:
 * - Minigun / GatlingTower (Cannon)
 * - SpaceDustSwirler (Cyclone)
 * - StrikerTower (with countdown and target highlighting)
 * - LockOnLaserTower
 * - ShieldTower
 * - StrikerTower explosion effects
 */
export class TowerRenderer {

    /**
     * Draw a Cannon/Gatling building
     */
    public drawMinigun(building: Minigun | GatlingTower, color: string, game: GameState, isEnemy: boolean, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
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
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        const shouldGlowInShade = isEnemy
            ? isInShadow
            : isInShadow;
        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, shouldGlowInShade, 1, building.isSelected);

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            context.drawWarpGateProductionEffect(
                screenPos,
                radius,
                game,
                displayColor
            );

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#00FF00';
            context.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);

            // Reset alpha
            if (shouldDim) {
                context.ctx.globalAlpha = 1.0;
            }
            return;
        }

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_bottom.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCannon_top_outline.png';

        const bottomSprite = context.getTintedSprite(bottomSpritePath, displayColor);
        const topSprite = context.getTintedSprite(topSpritePath, displayColor);

        if (bottomSprite && topSprite) {
            const spriteScale = (radius * 2) / bottomSprite.width;
            const bottomWidth = bottomSprite.width * spriteScale;
            const bottomHeight = bottomSprite.height * spriteScale;

            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.drawImage(
                bottomSprite,
                -bottomWidth / 2,
                -bottomHeight / 2,
                bottomWidth,
                bottomHeight
            );
            context.ctx.restore();

            // Draw selection indicator if selected
            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            let gunAngle = 0;
            if (building.target) {
                const dx = building.target.position.x - building.position.x;
                const dy = building.target.position.y - building.position.y;
                gunAngle = Math.atan2(dy, dx);
            }

            const topWidth = topSprite.width * spriteScale;
            const topHeight = topSprite.height * spriteScale;

            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(gunAngle + Math.PI / 2);
            context.ctx.drawImage(
                topSprite,
                -topWidth / 2,
                -topHeight / 2,
                topWidth,
                topHeight
            );
            context.ctx.restore();
        } else {
            // Draw base (circular platform)
            context.ctx.fillStyle = displayColor;
            const strokeColor = displayColor;
            context.ctx.strokeStyle = shouldDim ? context.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor;
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();

            // Draw selection indicator if selected
            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw turret base (smaller circle in center)
            const turretBaseRadius = radius * 0.6;
            context.ctx.fillStyle = shouldDim ? context.darkenColor('#666666', Constants.SHADE_OPACITY) : '#666666';
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, turretBaseRadius, 0, Math.PI * 2);
            context.ctx.fill();

            // Draw minigun barrel (pointing toward target if exists)
            let gunAngle = 0;
            if (building.target) {
                const dx = building.target.position.x - building.position.x;
                const dy = building.target.position.y - building.position.y;
                gunAngle = Math.atan2(dy, dx);
            }

            const barrelLength = radius * 1.2;
            const barrelWidth = 4 * context.zoom;

            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#333333', Constants.SHADE_OPACITY) : '#333333';
            context.ctx.lineWidth = barrelWidth;
            context.ctx.lineCap = 'round';
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(
                screenPos.x + Math.cos(gunAngle) * barrelLength,
                screenPos.y + Math.sin(gunAngle) * barrelLength
            );
            context.ctx.stroke();
        }

        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Cyclone (Space Dust Swirler) building
     */
    public drawSpaceDustSwirler(building: SpaceDustSwirler, color: string, game: GameState, isEnemy: boolean, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
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
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        // Draw build progress indicator if not complete
        const shouldGlowInShade = isEnemy
            ? isInShadow
            : isInShadow;
        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, shouldGlowInShade, 1, building.isSelected);

        if (!building.isComplete) {
            context.drawWarpGateProductionEffect(
                screenPos,
                radius,
                game,
                displayColor
            );

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#8A2BE2';
            context.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);

            // Reset alpha
            if (shouldDim) {
                context.ctx.globalAlpha = 1.0;
            }
            return;
        }

        // Draw influence radius (faint circle) - use current radius for smooth animation
        const influenceRadius = building.currentInfluenceRadius * context.zoom;
        context.ctx.strokeStyle = displayColor;
        context.ctx.globalAlpha = 0.15;
        context.ctx.lineWidth = 1;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, influenceRadius, 0, Math.PI * 2);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1.0;

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_bottom.png';
        const middleSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_middle.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/radiantCyclone_top.png';

        const bottomSprite = context.getTintedSprite(bottomSpritePath, displayColor);
        const middleSprite = context.getTintedSprite(middleSpritePath, displayColor);
        const topSprite = context.getTintedSprite(topSpritePath, displayColor);

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
                context.ctx.save();
                context.ctx.translate(screenPos.x, screenPos.y);
                context.ctx.rotate(rotationRad);
                context.ctx.drawImage(
                    sprite,
                    -spriteWidth / 2,
                    -spriteHeight / 2,
                    spriteWidth,
                    spriteHeight
                );
                context.ctx.restore();
            };

            drawLayer(bottomSprite, 0);

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            drawLayer(middleSprite, middleRotationRad);
            drawLayer(topSprite, topRotationRad);
        }

        // Draw health bar/number if damaged
        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Striker Tower
     */
    public drawStrikerTower(building: StrikerTower, color: string, game: GameState, isEnemy: boolean, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
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
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }

            if (!ladSun) {
                const inShadow = game.isPointInShadow(building.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(buildingColor, Constants.SHADE_OPACITY);
                }
            }
        }

        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, isInShadow, 1, building.isSelected);

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            context.ctx.fillStyle = displayColor;
            context.ctx.globalAlpha = 0.3;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.globalAlpha = 1.0;

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#FFD700';
            context.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            return;
        }

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        // Draw tower body - hexagon shape
        context.ctx.fillStyle = displayColor;
        context.ctx.strokeStyle = '#666666';
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = screenPos.x + radius * Math.cos(angle);
            const y = screenPos.y + radius * Math.sin(angle);
            if (i === 0) {
                context.ctx.moveTo(x, y);
            } else {
                context.ctx.lineTo(x, y);
            }
        }
        context.ctx.closePath();
        context.ctx.fill();
        context.ctx.stroke();

        // Draw missile indicator in center
        if (building.isMissileReady()) {
            context.ctx.fillStyle = '#FF4444';
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius * 0.4, 0, Math.PI * 2);
            context.ctx.fill();
        } else {
            // Draw reload progress
            const reloadProgress = building.getReloadProgress();
            context.ctx.strokeStyle = '#FF4444';
            context.ctx.lineWidth = 3 * context.zoom;
            context.ctx.beginPath();
            context.ctx.arc(
                screenPos.x,
                screenPos.y,
                radius * 0.4,
                -Math.PI / 2,
                -Math.PI / 2 + (Math.PI * 2 * reloadProgress)
            );
            context.ctx.stroke();
        }

        // Draw countdown visual if in countdown mode
        if (building.isInCountdown()) {
            // Pulsing glow effect
            const time = performance.now() / 1000;
            const pulseIntensity = 0.5 + 0.5 * Math.sin(time * 8); // Fast pulse

            context.ctx.strokeStyle = '#FF0000';
            context.ctx.lineWidth = (4 + pulseIntensity * 4) * context.zoom;
            context.ctx.globalAlpha = 0.6 + pulseIntensity * 0.4;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius * 1.3, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;

            // Draw countdown number
            const countdown = Math.ceil(building.getRemainingCountdown());
            if (countdown > 0) { // Only display when countdown is positive
                context.ctx.fillStyle = '#FF0000';
                context.ctx.font = `bold ${Math.floor(24 * context.zoom)}px Arial`;
                context.ctx.textAlign = 'center';
                context.ctx.textBaseline = 'middle';
                context.ctx.fillText(countdown.toString(), screenPos.x, screenPos.y - radius - 20 * context.zoom);
            }

            // Draw line to target position if available
            if (building.targetPosition) {
                const targetScreenPos = context.worldToScreen(building.targetPosition);
                context.ctx.strokeStyle = '#FF0000';
                context.ctx.lineWidth = 2 * context.zoom;
                context.ctx.globalAlpha = 0.5;
                context.ctx.setLineDash([5 * context.zoom, 5 * context.zoom]);
                context.ctx.beginPath();
                context.ctx.moveTo(screenPos.x, screenPos.y);
                context.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
                context.ctx.stroke();
                context.ctx.setLineDash([]);
                context.ctx.globalAlpha = 1.0;

                // Draw target indicator
                context.ctx.strokeStyle = '#FF0000';
                context.ctx.lineWidth = 3 * context.zoom;
                context.ctx.beginPath();
                context.ctx.arc(targetScreenPos.x, targetScreenPos.y, 15 * context.zoom, 0, Math.PI * 2);
                context.ctx.stroke();
                context.ctx.beginPath();
                context.ctx.moveTo(targetScreenPos.x - 20 * context.zoom, targetScreenPos.y);
                context.ctx.lineTo(targetScreenPos.x + 20 * context.zoom, targetScreenPos.y);
                context.ctx.moveTo(targetScreenPos.x, targetScreenPos.y - 20 * context.zoom);
                context.ctx.lineTo(targetScreenPos.x, targetScreenPos.y + 20 * context.zoom);
                context.ctx.stroke();
            }
        }

        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);

            // Draw range indicator
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = 0.3;
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, building.attackRange * context.zoom, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }

        // Draw health bar/number if damaged
        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw striker tower target highlighting overlay
     * Shows available target spots when isAwaitingTarget is true
     */
    public drawStrikerTowerTargetHighlighting(game: GameState, context: BuildingRendererContext): void {
        if (!context.viewingPlayer) return;

        // Find if any selected striker tower is awaiting target
        let awaitingTower: StrikerTower | null = null;
        for (const building of context.viewingPlayer.buildings) {
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
                const visibleByUnits = game.isPositionVisibleByPlayerUnits(testPos, context.viewingPlayer!.units);

                if (inShadow && !visibleByUnits) {
                    // Valid target - draw highlight
                    const screenPos = context.worldToScreen(testPos);

                    // Pulsing animation
                    const time = performance.now() / 1000;
                    const pulse = 0.3 + 0.2 * Math.sin(time * 3);

                    context.ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
                    context.ctx.beginPath();
                    context.ctx.arc(screenPos.x, screenPos.y, 8 * context.zoom, 0, Math.PI * 2);
                    context.ctx.fill();

                    // Draw small crosshair
                    context.ctx.strokeStyle = `rgba(255, 0, 0, ${pulse + 0.3})`;
                    context.ctx.lineWidth = 1.5 * context.zoom;
                    context.ctx.beginPath();
                    const crossSize = 6 * context.zoom;
                    context.ctx.moveTo(screenPos.x - crossSize, screenPos.y);
                    context.ctx.lineTo(screenPos.x + crossSize, screenPos.y);
                    context.ctx.moveTo(screenPos.x, screenPos.y - crossSize);
                    context.ctx.lineTo(screenPos.x, screenPos.y + crossSize);
                    context.ctx.stroke();
                }
            }
        }
    }

    /**
     * Draw a Lock-on Laser Tower
     */
    public drawLockOnLaserTower(building: LockOnLaserTower, color: string, game: GameState, isEnemy: boolean, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
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
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(building.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy buildings
            }

            if (!ladSun && isInShadow) {
                shouldDim = true;
                displayColor = context.darkenColor(buildingColor, Constants.SHADE_OPACITY);
            }
        }

        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, isInShadow, 1, building.isSelected);

        // Draw build progress indicator if not complete
        if (!building.isComplete) {
            context.ctx.fillStyle = displayColor;
            context.ctx.globalAlpha = 0.3;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.globalAlpha = 1.0;

            if (building.isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, radius);
            }

            // Draw progress bar
            const barWidth = radius * 2;
            const barHeight = 4;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + radius + 5;

            context.ctx.fillStyle = '#333333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = '#FFD700';
            context.ctx.fillRect(barX, barY, barWidth * building.buildProgress, barHeight);
            return;
        }

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, radius, auraColor, ownerSide);
        }

        // Draw tower body - octagon shape
        context.ctx.fillStyle = displayColor;
        context.ctx.strokeStyle = '#666666';
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const x = screenPos.x + radius * Math.cos(angle);
            const y = screenPos.y + radius * Math.sin(angle);
            if (i === 0) {
                context.ctx.moveTo(x, y);
            } else {
                context.ctx.lineTo(x, y);
            }
        }
        context.ctx.closePath();
        context.ctx.fill();
        context.ctx.stroke();

        // Draw lock-on indicator if targeting
        const lockedTarget = building.getLockedTarget();
        if (lockedTarget) {
            const lockProgress = building.getLockOnProgress();
            const targetScreenPos = context.worldToScreen(lockedTarget.position);

            // Draw line to target
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = 0.5;
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
            context.ctx.stroke();

            // Draw lock-on progress arc around target
            context.ctx.strokeStyle = '#FF0000';
            context.ctx.lineWidth = 3 * context.zoom;
            context.ctx.beginPath();
            context.ctx.arc(
                targetScreenPos.x,
                targetScreenPos.y,
                20 * context.zoom,
                -Math.PI / 2,
                -Math.PI / 2 + (Math.PI * 2 * lockProgress)
            );
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }

        // Draw inner circle indicator
        context.ctx.fillStyle = lockedTarget ? '#FF0000' : '#444444';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 0.3, 0, Math.PI * 2);
        context.ctx.fill();

        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);

            // Draw range indicator
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = 0.3;
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, building.attackRange * context.zoom, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }

        // Draw health bar/number if damaged
        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);
    }

    /**
     * Draw a Shield Tower building
     */
    public drawShieldTower(building: ShieldTower, color: string, game: GameState, isEnemy: boolean, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(building.position);
        const radius = building.radius * context.zoom;
        const displayColor = building.isComplete ? color : '#666666';
        const ladSun = game.suns.find(s => s.type === 'lad');
        const isInShadow = !ladSun && game.isPointInShadow(building.position);
        context.drawStructureShadeGlow(building, screenPos, radius, displayColor, isInShadow, 1, building.isSelected);

        // Draw shield radius if active
        if (building.shieldActive && building.isComplete) {
            const shieldRadius = building.shieldRadius * context.zoom;
            const shieldHealthPercent = building.getShieldHealthPercent();

            // Draw shield bubble
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = 0.2 + (shieldHealthPercent * 0.3);
            context.ctx.lineWidth = 3 * context.zoom;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
            context.ctx.stroke();

            // Draw shield fill
            context.ctx.fillStyle = displayColor;
            context.ctx.globalAlpha = 0.05 + (shieldHealthPercent * 0.1);
            context.ctx.fill();
            context.ctx.globalAlpha = 1.0;
        } else if (!building.shieldActive && building.isComplete) {
            // Draw disabled shield indicator (faint)
            const shieldRadius = building.shieldRadius * context.zoom;
            context.ctx.strokeStyle = '#444444';
            context.ctx.globalAlpha = 0.1;
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.setLineDash([5 * context.zoom, 5 * context.zoom]);
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.setLineDash([]);
            context.ctx.globalAlpha = 1.0;
        }

        // Draw the tower base
        context.ctx.fillStyle = displayColor;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.fill();

        // Draw outer ring
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 3 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 1.2, 0, Math.PI * 2);
        context.ctx.stroke();

        // Draw center indicator
        const centerColor = building.shieldActive ? displayColor : '#666666';
        context.ctx.fillStyle = centerColor;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 0.4, 0, Math.PI * 2);
        context.ctx.fill();

        if (building.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, radius);

            // Draw shield radius indicator
            if (building.isComplete) {
                context.ctx.strokeStyle = displayColor;
                context.ctx.globalAlpha = 0.3;
                context.ctx.lineWidth = 2;
                context.ctx.beginPath();
                context.ctx.arc(screenPos.x, screenPos.y, building.shieldRadius * context.zoom, 0, Math.PI * 2);
                context.ctx.stroke();
                context.ctx.globalAlpha = 1.0;
            }
        }

        // Draw health bar/number if damaged
        context.drawHealthDisplay(screenPos, building.health, building.maxHealth, radius, -radius - 10);

        // Draw shield health bar below building health
        if (building.isComplete) {
            const barWidth = radius * 2.5;
            const barHeight = 4 * context.zoom;
            const x = screenPos.x - barWidth / 2;
            const y = screenPos.y - radius - Constants.SHIELD_HEALTH_BAR_VERTICAL_OFFSET - barHeight;

            // Background
            context.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            context.ctx.fillRect(x, y, barWidth, barHeight);

            // Shield health fill
            const shieldPercent = building.shieldActive ? building.getShieldHealthPercent() : 0;
            const shieldColor = building.shieldActive ? '#00AAFF' : '#444444';
            context.ctx.fillStyle = shieldColor;
            context.ctx.fillRect(x, y, barWidth * shieldPercent, barHeight);

            // Border
            context.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            context.ctx.lineWidth = 1;
            context.ctx.strokeRect(x, y, barWidth, barHeight);
        }
    }

    /**
     * Draw striker tower missile explosion effect
     * Shows a large, dramatic explosion with expanding rings
     */
    public drawStrikerTowerExplosion(explosion: { position: Vector2D; timestamp: number }, age: number, context: BuildingRendererContext): void {
        const screenPos = context.worldToScreen(explosion.position);
        const maxRadius = Constants.STRIKER_TOWER_EXPLOSION_RADIUS * context.zoom;

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
            context.ctx.strokeStyle = `rgba(255, 200, 100, ${ringAlpha})`;
            context.ctx.lineWidth = (6 - i * 2) * context.zoom;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2);
            context.ctx.stroke();
        }

        // Draw main explosion fireball
        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, currentRadius
        );
        gradient.addColorStop(0, `rgba(255, 255, 200, ${fadeProgress * 0.9})`); // White hot center
        gradient.addColorStop(0.3, `rgba(255, 150, 50, ${fadeProgress * 0.7})`); // Orange
        gradient.addColorStop(0.6, `rgba(255, 50, 0, ${fadeProgress * 0.5})`); // Red
        gradient.addColorStop(1, `rgba(100, 0, 0, 0)`); // Fade to transparent

        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
        context.ctx.fillStyle = gradient;
        context.ctx.fill();

        // Trigger screen shake only once per explosion
        // Using WeakSet to track without mutating game state objects
        // This is a rendering concern and belongs in the renderer
        if (!context.shakenExplosions.has(explosion)) {
            context.triggerScreenShake(15); // Stronger shake than normal
            context.shakenExplosions.add(explosion);
        }
    }
}
