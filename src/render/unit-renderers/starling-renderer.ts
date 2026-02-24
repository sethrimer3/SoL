/**
 * StarlingRenderer - Handles rendering of Starling minion units and their visual effects
 *
 * Extracted from unit-renderer.ts following the class-based extraction pattern.
 * Handles: merged range display, Radiant/Velaris starling drawing, Velaris particle clouds.
 */

import {
    Vector2D,
    Faction,
    GameState,
    Starling,
} from '../../game-core';
import * as Constants from '../../constants';
import type { UnitRendererContext } from './shared-utilities';
import { drawAbilityCooldownBar } from './shared-utilities';

export class StarlingRenderer {
    /**
     * Draw merged attack-range circles for all selected friendly starlings.
     * Only the outer boundary of overlapping circles is shown.
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
            drawAbilityCooldownBar(screenPos, size, starling, '#00B4FF', size * 3.5, size * 8, context);
        }
        
        // Note: Move order lines for starlings are drawn separately in drawStarlingMoveLines()
        // to show only a single line from the closest starling when multiple are selected
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
}
