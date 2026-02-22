/**
 * UnitRenderer - Handles rendering of units and unit effects
 *
 * Extracted from renderer.ts following the class-based extraction pattern used
 * by ProjectileRenderer, ForgeRenderer, FoundryRenderer, and TowerRenderer.
 */

import {
    Vector2D,
    Faction,
    GameState,
    Unit,
    Starling,
    Grave,
    GraveProjectile,
    GraveSmallParticle,
    GraveBlackHole,
    Ray,
    Nova,
    InfluenceBall,
    TurretDeployer,
    DeployedTurret,
    Driller,
    Dagger,
    Beam,
    Spotlight,
    Mortar,
    Preist,
    Tank,
    Shadow,
    ShadowDecoy,
    ShadowDecoyParticle,
    Chrono,
} from '../../game-core';
import * as Constants from '../../constants';
import type { UnitRendererContext } from './shared-utilities';

export class UnitRenderer {
    public drawUnit(unit: Unit, color: string, game: GameState, isEnemy: boolean, sizeMultiplier: number = 1.0, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(unit.position);
        const size = 8 * context.zoom * sizeMultiplier;
        const isSelected = context.selectedUnits.has(unit);

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
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(unit.position, context.viewingPlayer, unit);
            visibilityAlpha = context.getEnemyVisibilityAlpha(unit, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            const isEnemyRevealedInShade = isInShadow && isVisible;
            shadeGlowAlpha = context.getShadeGlowAlpha(unit, isEnemyRevealedInShade);
            // Enemy units revealed in shadow should remain bright for readability.
        } else if (isInShadow) {
            shadeGlowAlpha = context.getShadeGlowAlpha(unit, true);
        } else {
            shadeGlowAlpha = context.getShadeGlowAlpha(unit, false);
        }

        // Draw attack range circle for selected hero units (only friendly units)
        if (isSelected && unit.isHero && !isEnemy) {
            const attackRangeScreenRadius = unit.attackRange * context.zoom;
            context.ctx.strokeStyle = unitColor;
            context.ctx.lineWidth = 1;
            context.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, attackRangeScreenRadius, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }

        if (isSelected) {
            const isStarling = unit instanceof Starling;
            const selectionRadiusMultiplier = (unit.isHero || isStarling) ? 1.2 : 1.0;
            context.drawBuildingSelectionIndicator(screenPos, size * selectionRadiusMultiplier);
        }

        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, size, auraColor, ownerSide);
        }

        // Draw unit body (circle) - use darkened color if should dim
        const heroSpritePath = unit.isHero ? context.getHeroSpritePath(unit) : null;
        const tintColor = shouldDim
            ? context.darkenColor(ladSun ? unitColor : (isEnemy ? context.enemyColor : context.playerColor), Constants.SHADE_OPACITY)
            : (ladSun ? unitColor : (isEnemy ? context.enemyColor : context.playerColor));
        const heroSprite = heroSpritePath
            ? context.getTintedSprite(heroSpritePath, tintColor)
            : null;
        const heroSpriteSize = size * context.HERO_SPRITE_SCALE;

        const glowColor = shouldDim
            ? context.darkenColor(displayColor, Constants.SHADE_OPACITY)
            : displayColor;
        const glowAlphaScale = isSelected ? 1.3 : 1;
        const renderedUnitRadius = heroSprite ? heroSpriteSize * 0.5 : size;
        const shadeGlowBoost = 0.55 * shadeGlowAlpha;
        context.drawCachedUnitGlow(
            screenPos,
            renderedUnitRadius * (context.ENTITY_SHADE_GLOW_SCALE + (isSelected ? 0.12 : 0.05)),
            glowColor,
            (glowAlphaScale + shadeGlowBoost) * visibilityAlpha
        );

        context.ctx.save();
        context.ctx.globalAlpha = visibilityAlpha;

        if (heroSprite) {
            const rotationRad = unit.rotation;
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(rotationRad);
            context.ctx.drawImage(
                heroSprite,
                -heroSpriteSize / 2,
                -heroSpriteSize / 2,
                heroSpriteSize,
                heroSpriteSize
            );
            context.ctx.restore();
        } else {
            context.ctx.fillStyle = displayColor;
            context.ctx.strokeStyle = isSelected ? displayColor : (shouldDim ? context.darkenColor(displayColor, Constants.SHADE_OPACITY) : displayColor);
            context.ctx.lineWidth = isSelected ? 3 : 1;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();
        }

        if (context.isFancyGraphicsEnabled) {
            const bloomColor = shouldDim ? context.darkenColor(displayColor, Constants.SHADE_OPACITY) : displayColor;
            const glowRadius = size * (isSelected ? 1.9 : 1.5);
            const glowIntensity = (isSelected ? 0.45 : 0.3) * visibilityAlpha;
            context.drawFancyBloom(screenPos, glowRadius, bloomColor, glowIntensity);
        }

        context.ctx.restore();

        context.drawHealthDisplay(screenPos, unit.health, unit.maxHealth, size, -size - 8);

        if (unit.isHero && !isEnemy) {
            this.drawAbilityCooldownBar(screenPos, size, unit, '#FFD700', size * 1.8, size * 5.5, context);
        }

        // Show stun indicator if unit is stunned
        if (unit.isStunned()) {
            context.ctx.fillStyle = '#FFFF00';
            context.ctx.globalAlpha = 0.7;
            const stunSize = 6 * context.zoom;
            
            // Draw stars around unit to indicate stun
            for (let i = 0; i < 3; i++) {
                const angle = (game.gameTime * 3 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
                const x = screenPos.x + Math.cos(angle) * (size * 1.8);
                const y = screenPos.y + Math.sin(angle) * (size * 1.8);
                
                context.ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const starAngle = j * (Math.PI * 2 / 5) - Math.PI / 2;
                    const starX = x + Math.cos(starAngle) * stunSize * 0.5;
                    const starY = y + Math.sin(starAngle) * stunSize * 0.5;
                    if (j === 0) {
                        context.ctx.moveTo(starX, starY);
                    } else {
                        context.ctx.lineTo(starX, starY);
                    }
                }
                context.ctx.closePath();
                context.ctx.fill();
            }
            context.ctx.globalAlpha = 1.0;
        }

        // Draw direction indicator if unit has a target
        if (!unit.isHero && unit.target) {
            const dx = unit.target.position.x - unit.position.x;
            const dy = unit.target.position.y - unit.position.y;
            const angle = Math.atan2(dy, dx);
            
            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(
                screenPos.x + Math.cos(angle) * size * 1.5,
                screenPos.y + Math.sin(angle) * size * 1.5
            );
            context.ctx.stroke();
        }
        
        // Draw move order indicator if unit has one
        if (unit.moveOrder > 0 && unit.rallyPoint) {
            this.drawMoveOrderIndicator(unit.position, unit.rallyPoint, unit.moveOrder, shouldDim ? displayColor : color, context);
        }
    }

    /**
     * Draw move order indicator (dot and line)
     */
    public drawMoveOrderIndicator(position: Vector2D, target: Vector2D, order: number, color: string, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(position);
        const targetScreenPos = context.worldToScreen(target);
        
        // Draw thin line from unit to target
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.globalAlpha = 0.5;
        context.ctx.setLineDash([5, 5]);
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos.x, screenPos.y);
        context.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
        context.ctx.stroke();
        context.ctx.setLineDash([]);
        context.ctx.globalAlpha = 1.0;
        
        // Draw animated movement point marker at target
        const dotRadius = context.MOVE_ORDER_DOT_RADIUS;
        const hasSprite = this.drawMovementPointMarker(targetScreenPos, dotRadius, color, context);
        if (!hasSprite) {
            context.ctx.fillStyle = color;
            context.ctx.strokeStyle = '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(targetScreenPos.x, targetScreenPos.y, dotRadius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();
        }
        
    }

    public getMoveOrderFrameIndex(context: UnitRendererContext): number {
        const animationFrame = Math.floor(performance.now() / context.MOVE_ORDER_FRAME_DURATION_MS);
        return animationFrame % context.movementPointFramePaths.length;
    }

    public drawMovementPointMarker(targetScreenPos: Vector2D, dotRadius: number, color: string, context: UnitRendererContext): boolean {
        const frameIndex = this.getMoveOrderFrameIndex(context);
        const framePath = context.movementPointFramePaths[frameIndex];
        const tintedFrameSprite = context.getTintedSprite(framePath, color);
        if (tintedFrameSprite) {
            this.drawMovementPointSprite(tintedFrameSprite, targetScreenPos, dotRadius, context);
            return true;
        }

        const fallbackSprite = context.getTintedSprite(context.MOVE_ORDER_FALLBACK_SPRITE_PATH, color);
        if (fallbackSprite) {
            this.drawMovementPointSprite(fallbackSprite, targetScreenPos, dotRadius, context);
            return true;
        }

        return false;
    }

    public drawMovementPointSprite(sprite: HTMLCanvasElement, targetScreenPos: Vector2D, dotRadius: number, context: UnitRendererContext): void {
        // Scale down movement points to 50% when zoomed all the way out
        const minZoom = context.getMinZoomForBounds();
        let sizeMultiplier = 1.0;
        if (context.zoom <= minZoom) {
            sizeMultiplier = 0.5;
        }
        
        const maxSize = dotRadius * 2 * sizeMultiplier;
        const scale = maxSize / Math.max(sprite.width, sprite.height);
        const drawWidth = sprite.width * scale;
        const drawHeight = sprite.height * scale;
        context.ctx.drawImage(
            sprite,
            targetScreenPos.x - drawWidth / 2,
            targetScreenPos.y - drawHeight / 2,
            drawWidth,
            drawHeight
        );
    }

    /**
     * Draw Chrono hero with hourglass icon
     */
    public drawChronoHero(chrono: Unit, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        // Draw the base unit
        this.drawUnit(chrono, color, game, isEnemy, 1.0, context);
        
        // Add hourglass icon above the hero
        const screenPos = context.worldToScreen(chrono.position);
        const iconY = screenPos.y - 25 * context.zoom;
        
        context.ctx.save();
        context.ctx.fillStyle = '#88DDFF';
        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.lineWidth = 1;
        context.ctx.globalAlpha = 0.8;
        
        // Draw simple hourglass
        const size = 8 * context.zoom;
        context.ctx.beginPath();
        // Top triangle
        context.ctx.moveTo(screenPos.x - size/2, iconY - size/2);
        context.ctx.lineTo(screenPos.x + size/2, iconY - size/2);
        context.ctx.lineTo(screenPos.x, iconY);
        context.ctx.closePath();
        // Bottom triangle
        context.ctx.moveTo(screenPos.x, iconY);
        context.ctx.lineTo(screenPos.x - size/2, iconY + size/2);
        context.ctx.lineTo(screenPos.x + size/2, iconY + size/2);
        context.ctx.closePath();
        context.ctx.fill();
        context.ctx.stroke();
        
        context.ctx.restore();
    }
    
    /**
     * Draw a deployed turret
     */
    public drawDeployedTurret(turret: InstanceType<typeof DeployedTurret>, game: GameState, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(turret.position);
        const ladSun = game.suns.find(s => s.type === 'lad');
        let color = context.getFactionColor(turret.owner.faction);
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
        const spriteScale = Constants.DEPLOYED_TURRET_SPRITE_SCALE * context.zoom;
        
        // Load and draw bottom sprite (static base)
        const bottomSprite = context.getTintedSprite(bottomSpritePath, color);
        if (bottomSprite) {
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
            topSpriteToUse = context.getTintedSprite(animSpritePath, color);
        } else {
            // Use default top sprite when not firing
            topSpriteToUse = context.getTintedSprite(topSpritePath, color);
        }
        
        // Draw top sprite (rotating barrel)
        if (topSpriteToUse) {
            const topWidth = topSpriteToUse.width * spriteScale;
            const topHeight = topSpriteToUse.height * spriteScale;

            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(rotationAngle + Math.PI / 2); // Add PI/2 because sprite top faces upward
            context.ctx.drawImage(
                topSpriteToUse,
                -topWidth / 2,
                -topHeight / 2,
                topWidth,
                topHeight
            );
            context.ctx.restore();
        }
        
        // Draw health bar above the turret
        const displaySize = Constants.DEPLOYED_TURRET_HEALTH_BAR_SIZE * context.zoom;
        context.drawHealthDisplay(screenPos, turret.health, turret.maxHealth, displaySize, -displaySize - 10);
    }

    /**
     * Draw a Grave unit with its orbiting projectiles
     */
    public drawGrave(grave: InstanceType<typeof Grave>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(grave.position, context.viewingPlayer);
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
        this.drawUnit(grave, displayColor, game, isEnemy, 1.0, context);
        
        // Draw grapheme "G" in the center
        const screenPos = context.worldToScreen(grave.position);
        const glyphSize = 18 * context.zoom;
        const glyphColor = shouldDim ? context.darkenColor('#FFFFFF', Constants.SHADE_OPACITY) : '#FFFFFF';
        const graveGraphemePath = context.getVelarisGraphemeSpritePath('g');
        if (graveGraphemePath) {
            context.drawVelarisGraphemeSprite(
                graveGraphemePath,
                screenPos.x,
                screenPos.y,
                glyphSize,
                glyphColor
            );
        }
        
        // Draw large projectiles
        for (const projectile of grave.getProjectiles()) {
            this.drawGraveProjectile(projectile, displayColor, context);
        }
        
        // Draw small particles
        for (const smallParticle of grave.getSmallParticles()) {
            this.drawGraveSmallParticle(smallParticle, displayColor, context);
        }

        // Draw black hole if active
        const blackHole = grave.getBlackHole();
        if (blackHole) {
            this.drawGraveBlackHole(blackHole, displayColor, context);
        }

        // Check for explosions and trigger screen shake
        const explosionPositions = grave.getExplosionPositions();
        if (explosionPositions.length > 0) {
            // Trigger screen shake for each explosion
            for (const explosionPos of explosionPositions) {
                context.triggerScreenShake();
                
                // Optionally: draw explosion effect
                this.drawExplosionEffect(explosionPos, context);
            }
        }
    }

    /**
     * Draw merged attack range outlines for selected starlings
     * Shows the combined outline instead of individual circles
     */
    public drawMergedStarlingRanges(game: GameState, context: UnitRendererContext): void {
        // Collect all selected friendly starlings
        const selectedStarlings: Starling[] = [];
        for (const unit of context.selectedUnits) {
            if (unit instanceof Starling && context.viewingPlayer && unit.owner === context.viewingPlayer) {
                selectedStarlings.push(unit);
            }
        }

        if (selectedStarlings.length === 0) {
            return;
        }

        const color = context.getFactionColor(context.viewingPlayer!.faction);
        
        // For merged ranges, draw only the outer boundary of overlapping circles
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.globalAlpha = Constants.HERO_ATTACK_RANGE_ALPHA;
        context.ctx.beginPath();

        const twoPi = Math.PI * 2;
        const coverageEpsilonWorld = 0.5;
        const coverageEpsilonSq = coverageEpsilonWorld * coverageEpsilonWorld;
        const dpr = window.devicePixelRatio || 1;
        const centerX = (context.canvas.width / dpr) / 2;
        const centerY = (context.canvas.height / dpr) / 2;
        const cameraX = context.camera.x;
        const cameraY = context.camera.y;
        const zoom = context.zoom;
        const targetStepPx = 6;

        for (let i = 0; i < selectedStarlings.length; i++) {
            const starling = selectedStarlings[i];
            if (!context.isWithinViewBounds(starling.position, starling.attackRange)) {
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
                context.ctx.moveTo(screenCenterX + radiusScreen, screenCenterY);
                context.ctx.arc(screenCenterX, screenCenterY, radiusScreen, 0, twoPi);
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
                    context.ctx.moveTo(screenX, screenY);
                    isDrawing = true;
                } else {
                    context.ctx.lineTo(screenX, screenY);
                }
            }

        }

        context.ctx.stroke();
        context.ctx.globalAlpha = 1.0;
    }

    public drawVisibleArcSegment(
        screenPos: Vector2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        minArcLengthRad: number,
        context: UnitRendererContext
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
            context.ctx.moveTo(screenPos.x + radius, screenPos.y);
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, twoPi);
            return;
        }

        if (wrappedEnd < wrappedStart) {
            context.ctx.moveTo(
                screenPos.x + Math.cos(wrappedStart) * radius,
                screenPos.y + Math.sin(wrappedStart) * radius
            );
            context.ctx.arc(screenPos.x, screenPos.y, radius, wrappedStart, twoPi);
            context.ctx.moveTo(screenPos.x + radius, screenPos.y);
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, wrappedEnd);
            return;
        }

        context.ctx.moveTo(
            screenPos.x + Math.cos(wrappedStart) * radius,
            screenPos.y + Math.sin(wrappedStart) * radius
        );
        context.ctx.arc(screenPos.x, screenPos.y, radius, wrappedStart, wrappedEnd);
    }

    /**
     * Draw a Starling unit (minion from stellar forge)
     */
    public drawStarling(starling: Starling, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(starling.position);
        const size = 8 * context.zoom * 0.3; // Minion size (30% of normal unit)
        const isSelected = context.selectedUnits.has(starling);
        const ladSun = game.suns.find(s => s.type === 'lad');
        const isVelarisStarling = starling.owner.faction === Faction.VELARIS;
        
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        let shadeGlowAlpha = 0;
        const isInShadow = !ladSun && game.isPointInShadow(starling.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(starling.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            const isEnemyRevealedInShade = isInShadow && isVisible;
            shadeGlowAlpha = context.getShadeGlowAlpha(starling, isEnemyRevealedInShade);
            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(starling.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(color, Constants.SHADE_OPACITY);
                    // Apply shade brightening effect near player units
                    displayColor = context.applyShadeBrightening(displayColor, starling.position, game, true);
                }
            }
            if (isInShadow) {
                shouldDim = false;
                displayColor = color;
            }
        } else if (isInShadow) {
            shadeGlowAlpha = context.getShadeGlowAlpha(starling, true);
        } else {
            shadeGlowAlpha = context.getShadeGlowAlpha(starling, false);
        }
        
        // Note: Range circles for starlings are drawn separately as merged outlines
        // in drawMergedStarlingRanges() before individual starlings are rendered
        if (isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, size * 1.1);
        }
        
        // Get starling sprite and color it with player color
        const starlingSpritePath = context.getStarlingSpritePath(starling);
        let starlingColor = isEnemy ? context.enemyColor : context.playerColor;
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
            ? context.darkenColor(starlingColor, Constants.SHADE_OPACITY)
            : starlingColor;
        displayColor = tintColor;
        
        // Draw aura in LaD mode
        if (ladSun && ownerSide) {
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, size, auraColor, ownerSide);
        }
        
        const shadeGlowBoost = 0.55 * shadeGlowAlpha;
        context.drawCachedUnitGlow(
            screenPos,
            size * (context.ENTITY_SHADE_GLOW_SCALE + (isSelected ? 0.12 : 0.04)),
            displayColor,
            (isSelected ? 1.2 : 1) + shadeGlowBoost
        );

        if (isVelarisStarling) {
            this.drawVelarisStarlingParticles(screenPos, size, starling, displayColor, game.gameTime, context);
        } else {
            const starlingSprite = starlingSpritePath 
                ? context.getTintedSprite(starlingSpritePath, tintColor)
                : null;
            
            if (starlingSprite) {
                const spriteSize = size * Constants.STARLING_SPRITE_SCALE_FACTOR;
                const rotationRad = context.getStarlingFacingRotationRad(starling);
                if (rotationRad !== null) {
                    context.ctx.save();
                    context.ctx.translate(screenPos.x, screenPos.y);
                    context.ctx.rotate(rotationRad);
                    context.ctx.drawImage(
                        starlingSprite,
                        -spriteSize / 2,
                        -spriteSize / 2,
                        spriteSize,
                        spriteSize
                    );
                    context.ctx.restore();
                } else {
                    context.ctx.drawImage(
                        starlingSprite,
                        screenPos.x - spriteSize / 2,
                        screenPos.y - spriteSize / 2,
                        spriteSize,
                        spriteSize
                    );
                }
            } else {
                // Fallback to circle rendering if sprite not loaded
                context.ctx.fillStyle = displayColor;
                const strokeColor = displayColor;
                context.ctx.strokeStyle = isSelected ? strokeColor : (shouldDim ? context.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor);
                context.ctx.lineWidth = isSelected ? 3 : 1;
                context.ctx.beginPath();
                context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
                context.ctx.fill();
                context.ctx.stroke();
            }
        }
        
        // Draw health bar/number if damaged
        context.drawHealthDisplay(screenPos, starling.health, starling.maxHealth, size, -size * 6 - 10);

        if (!isEnemy && starling.owner.hasBlinkUpgrade) {
            this.drawAbilityCooldownBar(screenPos, size, starling, '#00B4FF', size * 3.5, size * 8, context);
        }
        
        // Note: Move order lines for starlings are drawn separately in drawStarlingMoveLines()
        // to show only a single line from the closest starling when multiple are selected
    }

    public drawAbilityCooldownBar(
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

    public drawVelarisStarlingParticles(
        screenPos: Vector2D,
        size: number,
        starling: Starling,
        displayColor: string,
        timeSec: number,
        context: UnitRendererContext
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
        let state = context.starlingParticleStates.get(starling);
        if (!state) {
            state = {
                shapeBlend: hasShapeTarget ? 1 : 0,
                polygonBlend: isPentagonTarget ? 1 : 0,
                lastTimeSec: timeSec
            };
            context.starlingParticleStates.set(starling, state);
        }

        const deltaSec = Math.max(0, timeSec - state.lastTimeSec);
        state.lastTimeSec = timeSec;
        const blendStep = Math.min(1, deltaSec * context.VELARIS_STARLING_SHAPE_BLEND_SPEED);
        const targetShapeBlend = hasShapeTarget ? 1 : 0;
        const targetPolygonBlend = isPentagonTarget ? 1 : 0;
        state.shapeBlend += (targetShapeBlend - state.shapeBlend) * blendStep;
        state.polygonBlend += (targetPolygonBlend - state.polygonBlend) * blendStep;

        const particleRadius = Math.max(1, context.VELARIS_STARLING_PARTICLE_RADIUS_PX * context.zoom);
        const particleColor = context.brightenAndPaleColor(displayColor);
        const seedBase = context.getStarlingParticleSeed(starling) + starling.spriteLevel * 9.1;
        const twoPi = Math.PI * 2;
        const speed = Math.sqrt(velocitySq);
        const formationSpeedScale = hasShapeTarget ? Math.min(1, speed / 80) : 0;
        const polygonTimeScale = context.VELARIS_STARLING_TRIANGLE_TIME_SCALE_BASE
            + formationSpeedScale * context.VELARIS_STARLING_TRIANGLE_TIME_SCALE_RANGE;
        const timeScale = context.VELARIS_STARLING_CLOUD_TIME_SCALE
            + (polygonTimeScale - context.VELARIS_STARLING_CLOUD_TIME_SCALE) * state.shapeBlend;
        const scaledTimeSec = timeSec * timeScale;
        
        // Apply quality gates to particle count
        let particleCount = context.VELARIS_STARLING_PARTICLE_COUNT;
        if (context.graphicsQuality === 'low') {
            // Skip particles entirely on low quality
            return;
        } else if (context.graphicsQuality === 'medium') {
            // Reduce particle count by 50% on medium quality
            particleCount = Math.floor(particleCount / 2);
        }

        if (isInactive) {
            const graphemeIndex = Math.floor(
                context.getPseudoRandom(seedBase + 7.7) * context.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS.length
            );
            const graphemePath = context.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS[graphemeIndex];
            const pulse = (Math.sin(timeSec * context.VELARIS_STARLING_GRAPHEME_PULSE_SPEED + seedBase) + 1) * 0.5;
            const graphemeAlpha = pulse * context.VELARIS_STARLING_GRAPHEME_ALPHA_MAX;
            const graphemeSize = size * context.VELARIS_STARLING_GRAPHEME_SIZE_SCALE;
            if (graphemePath && graphemeAlpha > 0) {
                context.ctx.save();
                context.ctx.globalAlpha = graphemeAlpha;
                context.drawVelarisGraphemeSprite(graphemePath, screenPos.x, screenPos.y, graphemeSize, displayColor);
                context.ctx.restore();
            }
        }

        context.ctx.save();
        context.ctx.fillStyle = particleColor;
        context.ctx.globalAlpha = 0.7 + 0.2 * state.shapeBlend;
        context.ctx.beginPath();

        const rotationRad = context.getStarlingFacingRotationRad(starling) ?? starling.rotation;
        const rotationOffsetRad = rotationRad - Math.PI / 2;
        const triangleRadius = size * context.VELARIS_STARLING_TRIANGLE_RADIUS_SCALE;
        const pentagonRadius = size * context.VELARIS_STARLING_PENTAGON_RADIUS_SCALE;
        const cloudRadius = size * context.VELARIS_STARLING_CLOUD_RADIUS_SCALE;
        const swirlRadius = cloudRadius * context.VELARIS_STARLING_CLOUD_SWIRL_SCALE;
        const wobbleScale = size * context.VELARIS_STARLING_TRIANGLE_WOBBLE_SCALE;
        const triangleStep = twoPi / 3;
        const pentagonStep = twoPi / 5;

        for (let i = 0; i < particleCount; i++) {
            const seed = seedBase + i * 13.3;
            const edgeProgress = ((i / particleCount)
                + scaledTimeSec * context.VELARIS_STARLING_TRIANGLE_FLOW_SPEED
                + context.getPseudoRandom(seed + 5.9) * 0.2) % 1;
            const wobble = Math.sin(scaledTimeSec * context.VELARIS_STARLING_TRIANGLE_WOBBLE_SPEED + seed) * wobbleScale;

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

            const angle = context.getPseudoRandom(seed) * twoPi;
            const baseRadius = context.getPseudoRandom(seed + 1.3) * cloudRadius;
            const orbitSpeed = context.VELARIS_STARLING_CLOUD_ORBIT_SPEED_BASE
                + context.getPseudoRandom(seed + 2.1) * context.VELARIS_STARLING_CLOUD_ORBIT_SPEED_VARIANCE;
            const orbitAngle = scaledTimeSec * orbitSpeed + context.getPseudoRandom(seed + 3.4) * twoPi;
            const pull = 0.7 + 0.2 * Math.sin(scaledTimeSec * context.VELARIS_STARLING_CLOUD_PULL_SPEED + seed);

            const cloudOffsetX = Math.cos(angle) * baseRadius * pull + Math.cos(orbitAngle) * swirlRadius * 0.3;
            const cloudOffsetY = Math.sin(angle) * baseRadius * pull + Math.sin(orbitAngle) * swirlRadius * 0.3;

            const offsetX = cloudOffsetX + (polygonOffsetX - cloudOffsetX) * state.shapeBlend;
            const offsetY = cloudOffsetY + (polygonOffsetY - cloudOffsetY) * state.shapeBlend;

            const particleX = screenPos.x + offsetX;
            const particleY = screenPos.y + offsetY;
            context.ctx.moveTo(particleX + particleRadius, particleY);
            context.ctx.arc(particleX, particleY, particleRadius, 0, twoPi);
        }

        context.ctx.fill();
        context.ctx.restore();
    }

    /**
     * Draw move order lines for selected starlings
     * Shows a single line from the closest starling to the destination when multiple are selected
     */
    public drawStarlingMoveLines(game: GameState, context: UnitRendererContext): void {
        if (!context.viewingPlayer) return;
        
        // Group selected starlings by their rally point (using string key for proper Map comparison)
        const starlingsByRallyPoint = new Map<string, {rallyPoint: Vector2D, starlings: Starling[]}>();
        
        for (const unit of context.selectedUnits) {
            if (unit instanceof Starling && unit.owner === context.viewingPlayer && unit.rallyPoint && unit.moveOrder > 0) {
                const key = `${unit.rallyPoint.x},${unit.rallyPoint.y}`;
                if (!starlingsByRallyPoint.has(key)) {
                    starlingsByRallyPoint.set(key, {rallyPoint: unit.rallyPoint, starlings: []});
                }
                starlingsByRallyPoint.get(key)!.starlings.push(unit);
            }
        }
        
        const color = context.getFactionColor(context.viewingPlayer.faction);
        
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
            this.drawMoveOrderIndicator(closestStarling.position, group.rallyPoint, closestStarling.moveOrder, color, context);
        }
    }

    /**
     * Draw a Ray unit (Velaris hero)
     */
    public drawRay(ray: InstanceType<typeof Ray>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ray.position, context.viewingPlayer);
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
        this.drawUnit(ray, displayColor, game, isEnemy, 1.0, context);
        
        // Draw Ray symbol (lightning bolt)
        const screenPos = context.worldToScreen(ray.position);
        const size = 10 * context.zoom;
        
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos.x, screenPos.y - size);
        context.ctx.lineTo(screenPos.x - size * 0.3, screenPos.y);
        context.ctx.lineTo(screenPos.x + size * 0.3, screenPos.y);
        context.ctx.lineTo(screenPos.x, screenPos.y + size);
        context.ctx.stroke();
        
        // Draw beam segments
        const beamSegments = ray.getBeamSegments();
        for (const segment of beamSegments) {
            const startScreen = context.worldToScreen(segment.startPos);
            const endScreen = context.worldToScreen(segment.endPos);
            
            const opacity = 1.0 - (segment.lifetime / segment.maxLifetime);
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = opacity;
            context.ctx.lineWidth = Constants.RAY_BEAM_WIDTH * context.zoom;
            context.ctx.beginPath();
            context.ctx.moveTo(startScreen.x, startScreen.y);
            context.ctx.lineTo(endScreen.x, endScreen.y);
            context.ctx.stroke();
        }
        
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a Nova unit (Velaris hero)
     */
    public drawNova(nova: InstanceType<typeof Nova>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(nova.position, context.viewingPlayer);
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
        this.drawUnit(nova, displayColor, game, isEnemy, 1.0, context);
        
        // Draw Nova symbol (explosion star)
        const screenPos = context.worldToScreen(nova.position);
        const size = 10 * context.zoom;
        
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 2 * context.zoom;
        
        // Draw 4 diagonal lines forming a star/explosion shape
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 4) + (i * Math.PI / 2);
            const x1 = screenPos.x + Math.cos(angle) * size * 0.3;
            const y1 = screenPos.y + Math.sin(angle) * size * 0.3;
            const x2 = screenPos.x + Math.cos(angle) * size;
            const y2 = screenPos.y + Math.sin(angle) * size;
            
            context.ctx.beginPath();
            context.ctx.moveTo(x1, y1);
            context.ctx.lineTo(x2, y2);
            context.ctx.stroke();
        }
        
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw an InfluenceBall unit (Velaris hero)
     */
    public drawInfluenceBall(ball: InstanceType<typeof InfluenceBall>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(ball.position, context.viewingPlayer);
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
        this.drawUnit(ball, displayColor, game, isEnemy, 1.0, context);
        
        // Draw sphere symbol
        const screenPos = context.worldToScreen(ball.position);
        const size = 12 * context.zoom;
        
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.stroke();
        
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
        context.ctx.stroke();
    }

    /**
     * Draw a TurretDeployer unit (Velaris hero)
     */
    public drawTurretDeployer(deployer: InstanceType<typeof TurretDeployer>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(deployer.position, context.viewingPlayer);
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
        this.drawUnit(deployer, displayColor, game, isEnemy, 1.0, context);
        
        // Draw turret symbol
        const screenPos = context.worldToScreen(deployer.position);
        const size = 10 * context.zoom;
        
        context.ctx.fillStyle = displayColor;
        context.ctx.fillRect(screenPos.x - size * 0.5, screenPos.y - size * 0.3, size, size * 0.6);
        context.ctx.fillRect(screenPos.x - size * 0.2, screenPos.y - size, size * 0.4, size);
    }

    /**
     * Draw a Driller unit (Aurum hero)
     */
    public drawDriller(driller: InstanceType<typeof Driller>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Don't draw if hidden in asteroid
        if (driller.isHiddenInAsteroid()) {
            return;
        }
        
        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(driller.position, context.viewingPlayer);
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
        this.drawUnit(driller, displayColor, game, isEnemy, 1.0, context);
        
        // Draw drill symbol
        const screenPos = context.worldToScreen(driller.position);
        const size = 10 * context.zoom;
        
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 2 * context.zoom;
        
        // Draw drill bit
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos.x - size, screenPos.y);
        context.ctx.lineTo(screenPos.x, screenPos.y - size * 0.5);
        context.ctx.lineTo(screenPos.x + size, screenPos.y);
        context.ctx.lineTo(screenPos.x, screenPos.y + size * 0.5);
        context.ctx.closePath();
        context.ctx.stroke();
    }

    /**
     * Draw a Dagger hero unit with cloak indicator
     */
    public drawDagger(dagger: InstanceType<typeof Dagger>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(dagger.position, context.viewingPlayer, dagger);
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
            context.ctx.globalAlpha = Constants.DAGGER_CLOAK_OPACITY;
        }
        
        // Draw base unit
        this.drawUnit(dagger, isCloakedFriendly ? color : displayColor, game, isEnemy, 1.0, context);
        
        // Draw cloak indicator (ghostly outline)
        if (isCloakedFriendly) {
            const screenPos = context.worldToScreen(dagger.position);
            const size = 8 * context.zoom;
            
            context.ctx.strokeStyle = color;
            context.ctx.lineWidth = 1.5 * context.zoom;
            context.ctx.setLineDash([3 * context.zoom, 3 * context.zoom]); // Dashed line for cloak effect
            
            // Draw outer circle for cloak
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size + 6, 0, Math.PI * 2);
            context.ctx.stroke();
            
            context.ctx.setLineDash([]); // Reset line dash
        }
        
        // Draw ability indicator when visible (not cloaked)
        if (!dagger.isCloakedToEnemies() && !isEnemy) {
            const screenPos = context.worldToScreen(dagger.position);
            const size = 8 * context.zoom;
            
            // Draw strike symbol (like a blade)
            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#FF6600', Constants.SHADE_OPACITY) : '#FF6600'; // Orange for strike
            context.ctx.lineWidth = 2 * context.zoom;
            
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x - size * 0.7, screenPos.y - size * 0.7);
            context.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y + size * 0.7);
            context.ctx.stroke();
        }
        
        // Reset alpha
        if (isCloakedFriendly) {
            context.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw a Beam hero unit with sniper indicator
     */
    public drawBeam(beam: InstanceType<typeof Beam>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(beam.position, context.viewingPlayer, beam);
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
        this.drawUnit(beam, displayColor, game, isEnemy, 1.0, context);
        
        // Draw crosshair/sniper scope indicator for friendly units
        if (!isEnemy) {
            const screenPos = context.worldToScreen(beam.position);
            const size = 10 * context.zoom;
            
            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#FF0000', Constants.SHADE_OPACITY) : '#FF0000'; // Red for sniper
            context.ctx.lineWidth = 1.5 * context.zoom;
            
            // Draw crosshair
            context.ctx.beginPath();
            // Horizontal line
            context.ctx.moveTo(screenPos.x - size, screenPos.y);
            context.ctx.lineTo(screenPos.x + size, screenPos.y);
            // Vertical line
            context.ctx.moveTo(screenPos.x, screenPos.y - size);
            context.ctx.lineTo(screenPos.x, screenPos.y + size);
            context.ctx.stroke();
            
            // Draw small circle in center
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            context.ctx.stroke();
        }
        
        // Display damage multiplier if recently fired (show for 2 seconds)
        if (game.gameTime - beam.lastBeamTime < 2.0 && beam.lastBeamMultiplier > 0) {
            const screenPos = context.worldToScreen(beam.position);
            const yOffset = -20 * context.zoom;
            
            // Format multiplier: e.g., "(30x5.5)"
            const baseDamage = Constants.BEAM_ABILITY_BASE_DAMAGE;
            const multiplierText = `(${baseDamage}x${beam.lastBeamMultiplier.toFixed(1)})`;
            
            // Small font for the multiplier
            const fontSize = 10 * context.zoom;
            context.ctx.font = `${fontSize}px Doto`;
            context.ctx.fillStyle = '#FFAA00'; // Orange/yellow
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'bottom';
            
            // Draw with slight fade based on time
            const age = game.gameTime - beam.lastBeamTime;
            const opacity = Math.max(0, 1 - age / 2.0);
            context.ctx.globalAlpha = opacity;
            
            // Add stroke for readability
            context.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            context.ctx.lineWidth = 2;
            context.ctx.strokeText(multiplierText, screenPos.x, screenPos.y + yOffset);
            context.ctx.fillText(multiplierText, screenPos.x, screenPos.y + yOffset);
        }

        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a Spotlight hero unit (Radiant hero)
     */
    public drawSpotlight(spotlight: InstanceType<typeof Spotlight>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(spotlight.position, context.viewingPlayer, spotlight);
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
        this.drawUnit(spotlight, displayColor, game, isEnemy, 1.0, context);

        // Draw spotlight icon (thin cone outline)
        const screenPos = context.worldToScreen(spotlight.position);
        const iconSize = 10 * context.zoom;
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos.x, screenPos.y - iconSize * 0.6);
        context.ctx.lineTo(screenPos.x + iconSize * 0.6, screenPos.y);
        context.ctx.lineTo(screenPos.x, screenPos.y + iconSize * 0.6);
        context.ctx.stroke();

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
                const leftScreen = context.worldToScreen(leftEnd);
                const rightScreen = context.worldToScreen(rightEnd);

                const coneOpacity = shouldDim ? 0.12 : 0.18;
                context.ctx.fillStyle = displayColor;
                context.ctx.globalAlpha = coneOpacity;
                context.ctx.beginPath();
                context.ctx.moveTo(originScreen.x, originScreen.y);
                context.ctx.lineTo(leftScreen.x, leftScreen.y);
                context.ctx.lineTo(rightScreen.x, rightScreen.y);
                context.ctx.closePath();
                context.ctx.fill();

                context.ctx.globalAlpha = 0.6;
                context.ctx.strokeStyle = displayColor;
                context.ctx.lineWidth = 1.5 * context.zoom;
                context.ctx.beginPath();
                context.ctx.moveTo(originScreen.x, originScreen.y);
                context.ctx.lineTo(leftScreen.x, leftScreen.y);
                context.ctx.moveTo(originScreen.x, originScreen.y);
                context.ctx.lineTo(rightScreen.x, rightScreen.y);
                context.ctx.stroke();
                context.ctx.globalAlpha = 1.0;
            }
        }
    }

    /**
     * Draw a Mortar hero unit with detection cone visualization
     */
    public drawMortar(mortar: any, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mortar.position, context.viewingPlayer, mortar);
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
            const screenPos = context.worldToScreen(mortar.position);
            const facingAngle = Math.atan2(mortar.facingDirection.y, mortar.facingDirection.x);
            const halfConeAngle = Constants.MORTAR_DETECTION_CONE_ANGLE / 2;
            const coneRadius = Constants.MORTAR_ATTACK_RANGE * context.zoom;
            
            // Draw detection cone
            context.ctx.fillStyle = shouldDim ? context.darkenColor(color, Constants.SHADE_OPACITY * 0.5) : color;
            context.ctx.globalAlpha = 0.15;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.arc(
                screenPos.x,
                screenPos.y,
                coneRadius,
                facingAngle - halfConeAngle,
                facingAngle + halfConeAngle
            );
            context.ctx.closePath();
            context.ctx.fill();
            context.ctx.globalAlpha = 1.0;
            
            // Draw cone outline
            context.ctx.strokeStyle = shouldDim ? context.darkenColor(color, Constants.SHADE_OPACITY) : color;
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.globalAlpha = 0.5;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.arc(
                screenPos.x,
                screenPos.y,
                coneRadius,
                facingAngle - halfConeAngle,
                facingAngle + halfConeAngle
            );
            context.ctx.lineTo(screenPos.x, screenPos.y);
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }
        
        // Draw base unit
        this.drawUnit(mortar, displayColor, game, isEnemy, 1.0, context);
        
        // Draw setup indicator - show artillery barrel/turret for friendly units
        if (!isEnemy && mortar.isSetup && mortar.facingDirection) {
            const screenPos = context.worldToScreen(mortar.position);
            const facingAngle = Math.atan2(mortar.facingDirection.y, mortar.facingDirection.x);
            const barrelLength = 15 * context.zoom;
            
            // Draw barrel
            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#888888', Constants.SHADE_OPACITY) : '#888888';
            context.ctx.lineWidth = 4 * context.zoom;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(
                screenPos.x + Math.cos(facingAngle) * barrelLength,
                screenPos.y + Math.sin(facingAngle) * barrelLength
            );
            context.ctx.stroke();
        } else if (!isEnemy && !mortar.isSetup) {
            // Show "not set up" indicator
            const screenPos = context.worldToScreen(mortar.position);
            const size = 12 * context.zoom;
            
            context.ctx.strokeStyle = shouldDim ? context.darkenColor('#FFAA00', Constants.SHADE_OPACITY) : '#FFAA00'; // Orange
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.globalAlpha = 0.7;
            
            // Draw exclamation mark
            context.ctx.beginPath();
            // Vertical line
            context.ctx.moveTo(screenPos.x, screenPos.y - size);
            context.ctx.lineTo(screenPos.x, screenPos.y - size * 0.3);
            context.ctx.stroke();
            
            // Dot
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y - size * 0.1, 1.5 * context.zoom, 0, Math.PI * 2);
            context.ctx.fill();
            
            context.ctx.globalAlpha = 1.0;
        }
    }

    public drawPreist(preist: InstanceType<typeof Preist>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        // Draw base unit
        this.drawUnit(preist, color, game, isEnemy, 1.0, context);

        // Don't draw healing beams for enemy units (unless you can see them)
        if (isEnemy) {
            return;
        }

        // Draw healing beams to targets
        const beamTargets = preist.getHealingBeamTargets();
        const screenPos = context.worldToScreen(preist.position);
        
        context.ctx.save();
        
        for (const target of beamTargets) {
            if (!target) continue;
            
            const targetScreenPos = context.worldToScreen(target.position);
            
            // Draw healing beam as a pulsing green line
            context.ctx.strokeStyle = '#00FF88';
            context.ctx.lineWidth = 3 * context.zoom;
            context.ctx.globalAlpha = 0.6 + 0.2 * Math.sin(game.gameTime * 5);
            
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
            context.ctx.stroke();
            
            // Draw particles along the beam
            const numParticles = 5;
            for (let i = 0; i < numParticles; i++) {
                const t = (i / numParticles + game.gameTime * 0.5) % 1.0;
                const particleX = screenPos.x + (targetScreenPos.x - screenPos.x) * t;
                const particleY = screenPos.y + (targetScreenPos.y - screenPos.y) * t;
                
                context.ctx.fillStyle = '#00FF88';
                context.ctx.globalAlpha = 0.8;
                context.ctx.beginPath();
                context.ctx.arc(particleX, particleY, 2 * context.zoom, 0, Math.PI * 2);
                context.ctx.fill();
            }
        }
        
        // Draw healing bomb particles
        const particles = preist.getHealingBombParticles();
        for (const particle of particles) {
            const particleScreenPos = context.worldToScreen(particle.position);
            
            // Draw particle as a glowing green dot
            context.ctx.fillStyle = '#00FF88';
            context.ctx.globalAlpha = 0.8 * (1 - particle.lifetime / particle.maxLifetime);
            context.ctx.beginPath();
            context.ctx.arc(particleScreenPos.x, particleScreenPos.y, 3 * context.zoom, 0, Math.PI * 2);
            context.ctx.fill();
            
            // Draw glow
            const gradient = context.ctx.createRadialGradient(
                particleScreenPos.x, particleScreenPos.y, 0,
                particleScreenPos.x, particleScreenPos.y, 8 * context.zoom
            );
            gradient.addColorStop(0, 'rgba(0, 255, 136, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.globalAlpha = 0.6 * (1 - particle.lifetime / particle.maxLifetime);
            context.ctx.beginPath();
            context.ctx.arc(particleScreenPos.x, particleScreenPos.y, 8 * context.zoom, 0, Math.PI * 2);
            context.ctx.fill();
        }
        
        context.ctx.restore();
    }

    public drawTank(tank: InstanceType<typeof Tank>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        // Draw base unit (includes health bar and stun indicator)
        this.drawUnit(tank, color, game, isEnemy, 1.0, context);

        const screenPos = context.worldToScreen(tank.position);
        
        // Draw shield around tank
        context.ctx.save();
        
        // Shield visual - pulsing circular shield
        const shieldRadius = Constants.TANK_SHIELD_RADIUS * context.zoom;
        const pulseAlpha = 0.2 + 0.1 * Math.sin(game.gameTime * 3);
        
        // Shield outer circle
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.globalAlpha = pulseAlpha;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
        context.ctx.stroke();
        
        // Shield inner glow
        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, shieldRadius
        );
        gradient.addColorStop(0, 'rgba(100, 150, 255, 0)');
        gradient.addColorStop(0.7, `rgba(100, 150, 255, ${pulseAlpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = 1.0;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, shieldRadius, 0, Math.PI * 2);
        context.ctx.fill();
        
        context.ctx.restore();
    }

    /**
     * Draw Shadow hero (Velaris faction) with beam attack visualization
     */
    public drawShadow(shadow: InstanceType<typeof Shadow>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check visibility for enemy units
        let shouldDim = false;
        let displayColor = color;
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(shadow.position, context.viewingPlayer);
            if (!isVisible) {
                return; // Don't draw invisible enemy units
            }
            
            if (!ladSun) {
                const inShadow = game.isPointInShadow(shadow.position);
                if (inShadow) {
                    shouldDim = false;
                    displayColor = color;
                }
            }
        }
        
        // Draw base unit
        this.drawUnit(shadow, displayColor, game, isEnemy, 1.0, context);
        
        // Draw beam if Shadow is attacking a target
        const beamTarget = shadow.getBeamTarget();
        if (beamTarget) {
            const startScreen = context.worldToScreen(shadow.position);
            const endScreen = context.worldToScreen(beamTarget.position);
            
            // Calculate beam opacity based on damage multiplier
            const multiplier = shadow.currentDamageMultiplier || 1.0;
            const beamAlpha = 0.3 + (multiplier / Constants.SHADOW_BEAM_MAX_MULTIPLIER) * 0.5; // 0.3 to 0.8
            
            // Draw beam with increasing intensity
            context.ctx.strokeStyle = displayColor;
            context.ctx.globalAlpha = beamAlpha;
            context.ctx.lineWidth = 3 * context.zoom;
            context.ctx.lineCap = 'round';
            context.ctx.beginPath();
            context.ctx.moveTo(startScreen.x, startScreen.y);
            context.ctx.lineTo(endScreen.x, endScreen.y);
            context.ctx.stroke();
            
            // Add glow effect for higher multipliers
            if (multiplier > 2.0) {
                context.ctx.globalAlpha = (multiplier - 2.0) / 3.0 * 0.3; // 0 to 0.3 as multiplier goes from 2x to 5x
                context.ctx.lineWidth = 8 * context.zoom;
                context.ctx.beginPath();
                context.ctx.moveTo(startScreen.x, startScreen.y);
                context.ctx.lineTo(endScreen.x, endScreen.y);
                context.ctx.stroke();
            }
            
            context.ctx.globalAlpha = 1.0;
            
            // Display damage multiplier if > 1x
            if (multiplier > 1.1) {
                const textPos = context.worldToScreen(shadow.position);
                context.ctx.save();
                context.ctx.font = `bold ${12 * context.zoom}px Arial`;
                context.ctx.fillStyle = displayColor;
                context.ctx.textAlign = 'center';
                context.ctx.fillText(`${multiplier.toFixed(1)}x`, textPos.x, textPos.y - 25 * context.zoom);
                context.ctx.restore();
            }
        }
        
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a shadow decoy
     */
    public drawShadowDecoy(decoy: InstanceType<typeof ShadowDecoy>, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(decoy.position);
        const size = 12 * context.zoom;
        const color = context.getFactionColor(decoy.owner.faction);
        
        // Set opacity based on decoy's current opacity
        context.ctx.globalAlpha = decoy.opacity;
        
        // Draw outer glow
        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = decoy.opacity * 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();
        
        // Draw main body
        context.ctx.globalAlpha = decoy.opacity;
        context.ctx.fillStyle = color;
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.stroke();
        
        // Draw shadow-like effect (darker center)
        context.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.ctx.globalAlpha = decoy.opacity * 0.5;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
        context.ctx.fill();
        
        // Draw health bar
        context.ctx.globalAlpha = decoy.opacity;
        const healthBarWidth = 24 * context.zoom;
        const healthBarHeight = 3 * context.zoom;
        const healthBarY = screenPos.y + size + 8 * context.zoom;
        
        // Background
        context.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.ctx.fillRect(
            screenPos.x - healthBarWidth / 2,
            healthBarY,
            healthBarWidth,
            healthBarHeight
        );
        
        // Health
        const healthRatio = Math.max(0, decoy.health / decoy.maxHealth);
        context.ctx.fillStyle = healthRatio > 0.5 ? '#00FF00' : healthRatio > 0.25 ? '#FFFF00' : '#FF0000';
        context.ctx.fillRect(
            screenPos.x - healthBarWidth / 2,
            healthBarY,
            healthBarWidth * healthRatio,
            healthBarHeight
        );
        
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a shadow decoy particle
     */
    public drawShadowDecoyParticle(particle: InstanceType<typeof ShadowDecoyParticle>, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(particle.position);
        const size = particle.size * context.zoom;
        const opacity = particle.getOpacity();
        
        context.ctx.globalAlpha = opacity;
        context.ctx.fillStyle = '#8B00FF'; // Purple/shadow color
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        
        // Add slight glow
        context.ctx.globalAlpha = opacity * 0.5;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();
        
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw warp gate effect for buildings that are warping in.
     */
    public drawWarpGateProductionEffect(
        screenPos: { x: number; y: number },
        radius: number,
        game: GameState,
        displayColor: string,
        context: UnitRendererContext
    ): void {
        // Viewport culling: skip if off-screen with margin for effect radius
        const margin = radius + 50;
        if (!context.isScreenPosWithinViewBounds(screenPos, margin)) {
            return;
        }

        const bottomSpritePath = 'ASSETS/sprites/RADIANT/structures/warpGate_bottom.png';
        const topSpritePath = 'ASSETS/sprites/RADIANT/structures/warpGate_top.png';
        const bottomSprite = context.getTintedSprite(bottomSpritePath, displayColor);
        const topSprite = context.getTintedSprite(topSpritePath, displayColor);
        const referenceSprite = bottomSprite || topSprite;
        if (!referenceSprite) {
            context.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            context.ctx.strokeStyle = '#00FFFF';
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();
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

        drawLayer(bottomSprite, bottomRotationRad);
        drawLayer(topSprite, topRotationRad);
    }

    /**
     * Draw a Grave projectile with trail
     */
    public drawGraveProjectile(projectile: InstanceType<typeof GraveProjectile>, color: string, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(projectile.position);
        const size = 4 * context.zoom;
        
        // Draw trail if attacking
        if (projectile.isAttacking && projectile.trail.length > 1) {
            context.ctx.strokeStyle = color;
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.globalAlpha = 0.5;
            context.ctx.beginPath();
            
            for (let i = 0; i < projectile.trail.length; i++) {
                const trailPos = context.worldToScreen(projectile.trail[i]);
                if (i === 0) {
                    context.ctx.moveTo(trailPos.x, trailPos.y);
                } else {
                    context.ctx.lineTo(trailPos.x, trailPos.y);
                }
            }
            
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }
        
        // Draw projectile as a circle
        context.ctx.fillStyle = color;
        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.lineWidth = 1 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.stroke();
        
        // Add a glow effect when attacking
        if (projectile.isAttacking) {
            context.ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
            context.ctx.fill();
        }
    }

    /**
     * Draw a small particle for the Grave hero
     */
    public drawGraveSmallParticle(particle: InstanceType<typeof GraveSmallParticle>, color: string, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(particle.position);
        const size = Constants.GRAVE_SMALL_PARTICLE_SIZE * context.zoom;
        
        // Draw small particle as a tiny circle
        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = 0.7;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw Grave Black Hole (vortex particle)
     */
    public drawGraveBlackHole(blackHole: InstanceType<typeof GraveBlackHole>, color: string, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(blackHole.position);
        const size = Constants.GRAVE_BLACK_HOLE_SIZE * context.zoom;

        // Draw swirling vortex effect
        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, size
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.4, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fillStyle = gradient;
        context.ctx.fill();

        // Add rotation effect (swirling lines)
        const numLines = 8;
        const rotation = blackHole.lifetime * 2; // Rotate based on lifetime
        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2 + rotation;
            const innerRadius = size * 0.2;
            const outerRadius = size * 0.9;
            
            context.ctx.beginPath();
            context.ctx.moveTo(
                screenPos.x + Math.cos(angle) * innerRadius,
                screenPos.y + Math.sin(angle) * innerRadius
            );
            context.ctx.lineTo(
                screenPos.x + Math.cos(angle) * outerRadius,
                screenPos.y + Math.sin(angle) * outerRadius
            );
            context.ctx.strokeStyle = color;
            context.ctx.lineWidth = 1 * context.zoom;
            context.ctx.globalAlpha = 0.3;
            context.ctx.stroke();
            context.ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Draw explosion effect
     */
    public drawExplosionEffect(position: Vector2D, context: UnitRendererContext): void {
        const screenPos = context.worldToScreen(position);
        const radius = Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS * context.zoom;

        // Cache explosion gradient by radius bucket (10px increments)
        const radiusBucket = Math.round(radius / 10) * 10;
        const cacheKey = `explosion-${radiusBucket}`;
        let gradient = context.gradientCache.get(cacheKey);
        
        if (!gradient) {
            gradient = context.ctx.createRadialGradient(0, 0, 0, 0, 0, radiusBucket);
            gradient.addColorStop(0, 'rgba(255, 150, 50, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            context.gradientCache.set(cacheKey, gradient);
        }

        // Use translate to position cached gradient
        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.beginPath();
        context.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        context.ctx.fillStyle = gradient;
        context.ctx.fill();
        context.ctx.restore();
    }
}
