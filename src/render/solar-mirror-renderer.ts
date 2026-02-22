/**
 * SolarMirrorRenderer - Handles rendering of solar mirrors and mirror command buttons
 */

import { SolarMirror, StellarForge, Vector2D, Faction, GameState, LightRay } from '../game-core';
import * as Constants from '../constants';
import { getRadialButtonOffsets } from './render-utilities';

export interface SolarMirrorRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isFancyGraphicsEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    viewingPlayer: any | null;
    isWarpGatePlacementMode: boolean;
    canCreateWarpGateFromMirrors: boolean;
    isSelectedMirrorInSunlight: boolean;
    hasSeenFoundry: boolean;
    hasActiveFoundry: boolean;
    highlightedButtonIndex: number;
    MIRROR_MAX_HEALTH: number;
    gradientCache: Map<string, CanvasGradient>;
    VELARIS_FORGE_GRAPHEME_SPRITE_PATHS: string[];
    worldToScreen(worldPos: Vector2D): Vector2D;
    getEnemyVisibilityAlpha(entity: object, isVisible: boolean, gameTime: number): number;
    darkenColor(color: string, factor: number): string;
    applyShadeBrightening(color: string, position: Vector2D, game: GameState, isInShade: boolean): string;
    brightenAndPaleColor(color: string): string;
    drawStructureShadeGlow(
        entity: object,
        screenPos: Vector2D,
        size: number,
        color: string,
        shouldGlow: boolean,
        visibilityAlpha: number,
        isSelected: boolean
    ): void;
    drawAestheticSpriteShadow(
        worldPos: Vector2D,
        screenPos: Vector2D,
        size: number,
        game: GameState,
        options?: { opacity?: number; widthScale?: number; particleCount?: number; particleSpread?: number }
    ): void;
    drawFancyBloom(screenPos: Vector2D, radius: number, color: string, intensity: number): void;
    getCachedRadialGradient(
        key: string,
        x0: number,
        y0: number,
        r0: number,
        x1: number,
        y1: number,
        r1: number,
        stops: Array<{ offset: number; color: string }>
    ): CanvasGradient;
    drawBuildingSelectionIndicator(screenPos: { x: number; y: number }, radius: number): void;
    drawHealthDisplay(
        screenPos: { x: number; y: number },
        currentHealth: number,
        maxHealth: number,
        size: number,
        yOffset: number,
        isRegenerating?: boolean,
        playerColor?: string
    ): void;
    drawLadAura(screenPos: Vector2D, size: number, color: string, side: 'light' | 'dark'): void;
    drawMoveOrderIndicator(fromPos: Vector2D, toPos: Vector2D, moveOrder: number, color: string): void;
    getVelarisGraphemeSpritePath(letter: string): string | null;
    getGraphemeMaskData(path: string): ImageData | null;
    drawVelarisGraphemeSprite(path: string, x: number, y: number, size: number, color: string): boolean;
    getPseudoRandom(seed: number): number;
    getSolarMirrorSpritePath(mirror: SolarMirror): string | null;
    getTintedSprite(path: string, color: string): HTMLCanvasElement | null;
    getSolEnergyIcon(): HTMLImageElement;
}

export class SolarMirrorRenderer {
    private readonly velarisMirrorSeeds = new WeakMap<SolarMirror, number>();

    private readonly VELARIS_MIRROR_WORD = 'VELARIS';
    private readonly VELARIS_MIRROR_CLOUD_GLYPH_COUNT = 18;
    private readonly VELARIS_MIRROR_CLOUD_PARTICLE_COUNT = 12;
    private readonly VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT = 10;
    private readonly VELARIS_MIRROR_PARTICLE_TIME_SCALE = 0.35;
    private readonly VELARIS_MIRROR_PARTICLE_DRIFT_SPEED = 0.7;
    private readonly INTENSITY_QUANTIZATION_FACTOR = 10;
    private readonly MIRROR_GLOW_INNER_ALPHA = 0.8;
    private readonly MIRROR_GLOW_MID_ALPHA = 0.4;

    public drawSolarMirror(
        mirror: SolarMirror,
        color: string,
        game: GameState,
        isEnemy: boolean,
        timeSec: number,
        context: SolarMirrorRendererContext
    ): void {
        const ladSun = game.suns.find(s => s.type === 'lad');
        let mirrorColor = color;
        let ownerSide: 'light' | 'dark' | undefined = undefined;
        if (ladSun && mirror.owner) {
            ownerSide = mirror.owner.stellarForge
                ? game.getLadSide(mirror.owner.stellarForge.position, ladSun)
                : 'light';
            if (ownerSide === 'light') {
                mirrorColor = '#FFFFFF';
            } else {
                mirrorColor = '#000000';
            }
        }

        // Check visibility for enemy mirrors
        let shouldDim = false;
        let displayColor = mirrorColor;
        let visibilityAlpha = 1;
        const isInShadow = !ladSun && game.isPointInShadow(mirror.position);
        if (isEnemy && context.viewingPlayer) {
            const isVisible = game.isObjectVisibleToPlayer(mirror.position, context.viewingPlayer);
            visibilityAlpha = context.getEnemyVisibilityAlpha(mirror, isVisible, game.gameTime);
            if (visibilityAlpha <= 0.01) {
                return;
            }

            // Check if in shadow for dimming effect - darken color instead of using alpha
            if (!ladSun) {
                const inShadow = game.isPointInShadow(mirror.position);
                if (inShadow) {
                    shouldDim = true;
                    displayColor = context.darkenColor(mirrorColor, Constants.SHADE_OPACITY);
                    // Apply shade brightening effect near player units
                    displayColor = context.applyShadeBrightening(displayColor, mirror.position, game, true);
                }
            }
        }
        
        const screenPos = context.worldToScreen(mirror.position);
        const mirrorSizeWorld = 14;
        const size = mirrorSizeWorld * context.zoom;
        const shouldGlowInShade = isEnemy
            ? (isInShadow && visibilityAlpha > 0.01)
            : isInShadow;
        context.drawStructureShadeGlow(
            mirror,
            screenPos,
            size,
            displayColor,
            shouldGlowInShade,
            visibilityAlpha,
            mirror.isSelected
        );

        context.drawAestheticSpriteShadow(mirror.position, screenPos, size * 0.95, game, {
            opacity: visibilityAlpha,
            widthScale: 0.78,
            particleCount: 4,
            particleSpread: size * 0.7
        });

        // Save context state
        context.ctx.save();
        context.ctx.globalAlpha = visibilityAlpha;

        // Calculate glow intensity based on distance to closest sun
        // Closer = brighter glow (inverse relationship)
        const glowIntensity = Math.max(0, Math.min(1, 1 - (mirror.closestSunDistance / Constants.MIRROR_MAX_GLOW_DISTANCE)));
        const isVelarisMirror = mirror.owner.faction === Faction.VELARIS;
        const hasLight = mirror.hasLineOfSightToLight(game.suns, game.asteroids);
        const isMirrorActive = hasLight && glowIntensity > 0.1 && mirror.closestSunDistance !== Infinity;
        const velarisUnderlineOffsetWorld = mirrorSizeWorld * 0.45;

        if (context.isFancyGraphicsEnabled) {
            const bloomColor = context.brightenAndPaleColor(displayColor);
            const bloomIntensity = (0.25 + glowIntensity * 0.5) * visibilityAlpha;
            context.drawFancyBloom(screenPos, size * 1.6, bloomColor, bloomIntensity);
        }
        
        // Draw glow if close to a light source
        if (glowIntensity > 0.1 && mirror.closestSunDistance !== Infinity) {
            const glowRadius = Constants.MIRROR_ACTIVE_GLOW_RADIUS * context.zoom * (1 + glowIntensity);
            // Quantize intensity to reduce unique gradients (cache optimization)
            const quantizedIntensity = Math.round(glowIntensity * this.INTENSITY_QUANTIZATION_FACTOR) / this.INTENSITY_QUANTIZATION_FACTOR;
            const glowRadiusRounded = Math.round(glowRadius);
            const cacheKey = `mirror-glow-${glowRadiusRounded}-${quantizedIntensity}`;
            const gradient = context.getCachedRadialGradient(
                cacheKey,
                0, 0, 0,
                0, 0, glowRadius,
                [
                    { offset: 0, color: `rgba(255, 255, 150, ${quantizedIntensity * this.MIRROR_GLOW_INNER_ALPHA})` },
                    { offset: 0.5, color: `rgba(255, 255, 100, ${quantizedIntensity * this.MIRROR_GLOW_MID_ALPHA})` },
                    { offset: 1, color: 'rgba(255, 255, 50, 0)' }
                ]
            );
            
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.fillStyle = gradient;
            context.ctx.beginPath();
            context.ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.restore();
            
            // Draw reflected light beam in front of the mirror
            // Find the closest visible sun to determine reflection direction
            const closestSun = mirror.getClosestVisibleSun(game.suns, game.asteroids);
            if (closestSun) {
                const forge = mirror.owner.stellarForge;
                const linkedStructure = mirror.getLinkedStructure(forge);
                const sunDir = new Vector2D(
                    closestSun.position.x - mirror.position.x,
                    closestSun.position.y - mirror.position.y
                ).normalize();

                // Reflect incoming sunlight using mirror orientation so the visual beam always
                // matches the current mirror angle, even when the linked target is blocked.
                const incomingDir = new Vector2D(-sunDir.x, -sunDir.y);
                const mirrorNormal = new Vector2D(
                    Math.cos(mirror.reflectionAngle - Math.PI / 2),
                    Math.sin(mirror.reflectionAngle - Math.PI / 2)
                );
                const normalDotIncoming = incomingDir.x * mirrorNormal.x + incomingDir.y * mirrorNormal.y;
                const reflectDir = new Vector2D(
                    incomingDir.x - 2 * normalDotIncoming * mirrorNormal.x,
                    incomingDir.y - 2 * normalDotIncoming * mirrorNormal.y
                ).normalize();
                
                // Draw reflected light beam (a few feet / ~100 units in front of mirror)
                const beamLength = 100;
                const beamStartWorld = isVelarisMirror && isMirrorActive
                    ? new Vector2D(
                        mirror.position.x - Math.sin(mirror.reflectionAngle) * velarisUnderlineOffsetWorld,
                        mirror.position.y + Math.cos(mirror.reflectionAngle) * velarisUnderlineOffsetWorld
                    )
                    : mirror.position;

                const getCircleHitDistance = (center: Vector2D, radius: number): number | null => {
                    const originToCenterX = beamStartWorld.x - center.x;
                    const originToCenterY = beamStartWorld.y - center.y;
                    const b = 2 * (reflectDir.x * originToCenterX + reflectDir.y * originToCenterY);
                    const c = (originToCenterX * originToCenterX + originToCenterY * originToCenterY) - radius * radius;
                    const discriminant = b * b - 4 * c;
                    if (discriminant < 0) return null;
                    const sqrtDiscriminant = Math.sqrt(discriminant);
                    const t1 = (-b - sqrtDiscriminant) / 2;
                    const t2 = (-b + sqrtDiscriminant) / 2;
                    if (t1 > 0) return t1;
                    if (t2 > 0) return t2;
                    return null;
                };

                let visibleBeamLength = beamLength;
                const beamRay = new LightRay(beamStartWorld, reflectDir);

                for (const asteroid of game.asteroids) {
                    const intersectionDist = beamRay.getIntersectionDistance(asteroid.getWorldVertices());
                    if (intersectionDist !== null && intersectionDist > 0 && intersectionDist < visibleBeamLength) {
                        visibleBeamLength = intersectionDist;
                    }
                }

                for (const player of game.players) {
                    for (const building of player.buildings) {
                        const hitDist = getCircleHitDistance(building.position, building.radius);
                        if (hitDist !== null && hitDist < visibleBeamLength) {
                            visibleBeamLength = hitDist;
                        }
                    }

                    if (player.stellarForge) {
                        const hitDist = getCircleHitDistance(player.stellarForge.position, player.stellarForge.radius);
                        if (hitDist !== null && hitDist < visibleBeamLength) {
                            visibleBeamLength = hitDist;
                        }
                    }
                }

                const beamEnd = new Vector2D(
                    beamStartWorld.x + reflectDir.x * visibleBeamLength,
                    beamStartWorld.y + reflectDir.y * visibleBeamLength
                );
                const beamStartScreen = context.worldToScreen(beamStartWorld);
                const beamEndScreen = context.worldToScreen(beamEnd);
                
                // Draw bright beam with doubled intensity
                const beamGradient = context.ctx.createLinearGradient(
                    beamStartScreen.x, beamStartScreen.y,
                    beamEndScreen.x, beamEndScreen.y
                );
                beamGradient.addColorStop(0, `rgba(255, 255, 200, ${glowIntensity * 1.0})`);
                beamGradient.addColorStop(0.7, `rgba(255, 255, 150, ${glowIntensity * 0.6})`);
                beamGradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
                
                context.ctx.strokeStyle = beamGradient;
                context.ctx.lineWidth = 15 * context.zoom * glowIntensity;
                context.ctx.lineCap = 'round';
                context.ctx.beginPath();
                context.ctx.moveTo(beamStartScreen.x, beamStartScreen.y);
                context.ctx.lineTo(beamEndScreen.x, beamEndScreen.y);
                context.ctx.stroke();
                
                // Add a bright spot at the end of the beam for doubled brightness effect
                const endGlowRadius = 20 * context.zoom * glowIntensity;
                const endGradient = context.ctx.createRadialGradient(
                    beamEndScreen.x, beamEndScreen.y, 0,
                    beamEndScreen.x, beamEndScreen.y, endGlowRadius
                );
                endGradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity * 0.9})`);
                endGradient.addColorStop(0.5, `rgba(255, 255, 200, ${glowIntensity * 0.5})`);
                endGradient.addColorStop(1, 'rgba(255, 255, 150, 0)');
                
                context.ctx.fillStyle = endGradient;
                context.ctx.beginPath();
                context.ctx.arc(beamEndScreen.x, beamEndScreen.y, endGlowRadius, 0, Math.PI * 2);
                context.ctx.fill();
            }
        }
        
        // Translate to mirror position and rotate for reflection angle
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.rotate(mirror.reflectionAngle);

        // Draw aura in LaD mode (before sprite)
        if (ladSun && ownerSide) {
            // Save current transform and reset to screen coordinates for aura
            context.ctx.save();
            context.ctx.setTransform(1, 0, 0, 1, 0, 0);
            const auraColor = isEnemy ? context.enemyColor : context.playerColor;
            context.drawLadAura(screenPos, size, auraColor, ownerSide);
            context.ctx.restore();
        }

        const surfaceLength = size * 2;
        const surfaceThickness = size * 0.3;
        let selectionWidth = surfaceLength;
        let selectionHeight = surfaceThickness;
        let drewSprite = false;

        if (isVelarisMirror) {
            const glyphColor = context.brightenAndPaleColor(displayColor);
            const glyphTargetSize = size * 0.6;
            const glyphSpacing = glyphTargetSize * 0.75;
            const glyphSeedBase = this.getVelarisMirrorSeed(mirror) + mirror.reflectionAngle * 0.15;
            const mirrorTimeSec = timeSec * this.VELARIS_MIRROR_PARTICLE_TIME_SCALE;

            if (isMirrorActive) {
                const word = this.VELARIS_MIRROR_WORD;
                const wordLength = word.length;
                const wordWidth = glyphSpacing * (wordLength - 1);
                const wordY = -size * 0.1;
                for (let i = 0; i < wordLength; i++) {
                    const letterX = (i - (wordLength - 1) / 2) * glyphSpacing;
                    const letter = word.charAt(i);
                    const spritePath = context.getVelarisGraphemeSpritePath(letter);
                    if (spritePath) {
                        const drewGlyph = context.drawVelarisGraphemeSprite(
                            spritePath,
                            letterX,
                            wordY,
                            glyphTargetSize,
                            glyphColor
                        );
                        if (!drewGlyph) {
                            context.ctx.fillStyle = glyphColor;
                            context.ctx.beginPath();
                            context.ctx.arc(letterX, wordY, glyphTargetSize * 0.2, 0, Math.PI * 2);
                            context.ctx.fill();
                        }
                    }
                }

                const underlineY = size * 0.45;
                const underlineLength = wordWidth + glyphTargetSize * 0.6;
                
                // Skip particles on low quality, reduce on medium
                if (context.graphicsQuality !== 'low') {
                    const particleCount = context.graphicsQuality === 'medium' 
                        ? Math.ceil(this.VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT * 0.5)
                        : this.VELARIS_MIRROR_UNDERLINE_PARTICLE_COUNT;
                    const particleRadius = Math.max(1, size * 0.08);
                    context.ctx.fillStyle = `rgba(255, 255, 220, 0.85)`;
                    for (let i = 0; i < particleCount; i++) {
                        const t = particleCount > 1
                            ? i / (particleCount - 1)
                            : 0.5;
                        const driftSeed = glyphSeedBase + i * 2.7;
                        const driftX = Math.sin(mirrorTimeSec * this.VELARIS_MIRROR_PARTICLE_DRIFT_SPEED + driftSeed)
                            * particleRadius * 0.6;
                        const driftY = Math.cos(mirrorTimeSec * (this.VELARIS_MIRROR_PARTICLE_DRIFT_SPEED * 0.8) + driftSeed)
                            * particleRadius * 0.4;
                        const particleX = (t - 0.5) * underlineLength + driftX;
                        const particleY = underlineY + driftY;
                        context.ctx.beginPath();
                        context.ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
                        context.ctx.fill();
                    }
                }

                selectionWidth = underlineLength + glyphTargetSize;
                selectionHeight = size * 1.4;
            } else {
                const cloudRadius = size * 0.9;
                const cloudDriftRadius = Math.max(1, size * 0.12);
                const twoPi = Math.PI * 2;
                
                // Skip expensive cloud rendering on low quality, reduce on medium
                if (context.graphicsQuality !== 'low') {
                    const glyphCount = context.graphicsQuality === 'medium'
                        ? Math.ceil(this.VELARIS_MIRROR_CLOUD_GLYPH_COUNT * 0.5)
                        : this.VELARIS_MIRROR_CLOUD_GLYPH_COUNT;
                    
                    for (let i = 0; i < glyphCount; i++) {
                        const seed = glyphSeedBase + i * 12.7;
                        const angle = context.getPseudoRandom(seed) * twoPi;
                        const radius = context.getPseudoRandom(seed + 7.3) * cloudRadius;
                        const driftAngle = mirrorTimeSec * 0.2 + context.getPseudoRandom(seed + 5.1) * twoPi;
                        const offsetX = Math.cos(angle) * radius + Math.cos(driftAngle) * cloudDriftRadius;
                        const offsetY = Math.sin(angle) * radius + Math.sin(driftAngle) * cloudDriftRadius;
                        const spriteIndex = Math.floor(context.getPseudoRandom(seed + 9.6) * context.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS.length);
                        const spritePath = context.VELARIS_FORGE_GRAPHEME_SPRITE_PATHS[spriteIndex];
                        const drewGlyph = context.drawVelarisGraphemeSprite(
                            spritePath,
                            offsetX,
                            offsetY,
                            glyphTargetSize,
                            glyphColor
                        );
                        if (!drewGlyph) {
                            context.ctx.fillStyle = glyphColor;
                            context.ctx.beginPath();
                            context.ctx.arc(offsetX, offsetY, glyphTargetSize * 0.2, 0, Math.PI * 2);
                            context.ctx.fill();
                        }
                    }

                    const particleCount = context.graphicsQuality === 'medium'
                        ? Math.ceil(this.VELARIS_MIRROR_CLOUD_PARTICLE_COUNT * 0.5)
                        : this.VELARIS_MIRROR_CLOUD_PARTICLE_COUNT;
                    const particleRadius = Math.max(1, size * 0.07);
                    context.ctx.fillStyle = `rgba(255, 255, 210, 0.6)`;
                    for (let i = 0; i < particleCount; i++) {
                        const seed = glyphSeedBase + i * 9.4;
                        const angle = context.getPseudoRandom(seed + 1.1) * twoPi;
                        const radius = context.getPseudoRandom(seed + 4.7) * cloudRadius;
                        const driftAngle = mirrorTimeSec * 0.25 + context.getPseudoRandom(seed + 6.4) * twoPi;
                        const driftRadius = cloudDriftRadius * 0.75;
                        const offsetX = Math.cos(angle) * radius + Math.cos(driftAngle) * driftRadius;
                        const offsetY = Math.sin(angle) * radius + Math.sin(driftAngle) * driftRadius;
                        context.ctx.beginPath();
                        context.ctx.arc(offsetX, offsetY, particleRadius, 0, Math.PI * 2);
                        context.ctx.fill();
                    }
                }

                selectionWidth = size * 2;
                selectionHeight = size * 1.6;
            }

            drewSprite = true;
        }

        const mirrorSpritePath = context.getSolarMirrorSpritePath(mirror);
        if (mirrorSpritePath) {
            // Determine the color for the mirror (use displayColor which already accounts for enemy status and shadow)
            const spriteColor = context.brightenAndPaleColor(displayColor);
            
            const mirrorSprite = context.getTintedSprite(mirrorSpritePath, spriteColor);
            if (mirrorSprite) {
                const targetSize = size * 2.4;
                const scale = targetSize / Math.max(mirrorSprite.width, mirrorSprite.height);
                const drawWidth = mirrorSprite.width * scale;
                const drawHeight = mirrorSprite.height * scale;
                selectionWidth = drawWidth;
                selectionHeight = drawHeight;
                context.ctx.drawImage(
                    mirrorSprite,
                    -drawWidth / 2,
                    -drawHeight / 2,
                    drawWidth,
                    drawHeight
                );
                drewSprite = true;
            }
        }

        if (!drewSprite) {
            // Draw flat reflective surface (rectangle)
            // Cache surface gradient by thickness
            const thicknessBucket = Math.round(surfaceThickness / 5) * 5;
            const gradientKey = `mirror-surface-${thicknessBucket}`;
            let surfaceGradient = context.gradientCache.get(gradientKey);
            if (!surfaceGradient) {
                surfaceGradient = context.ctx.createLinearGradient(0, -thicknessBucket / 2, 0, thicknessBucket / 2);
                surfaceGradient.addColorStop(0, '#FFFFFF');
                surfaceGradient.addColorStop(0.5, '#E0E0E0');
                surfaceGradient.addColorStop(1, '#C0C0C0');
                context.gradientCache.set(gradientKey, surfaceGradient);
            }

            context.ctx.fillStyle = surfaceGradient;
            context.ctx.fillRect(-surfaceLength / 2, -surfaceThickness / 2, surfaceLength, surfaceThickness);

            // Draw border for the surface
            const strokeColor = displayColor;
            context.ctx.strokeStyle = shouldDim ? context.darkenColor(strokeColor, Constants.SHADE_OPACITY) : strokeColor;
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(-surfaceLength / 2, -surfaceThickness / 2, surfaceLength, surfaceThickness);

            // Draw small indicator dots at the ends
            context.ctx.fillStyle = displayColor;
            context.ctx.beginPath();
            context.ctx.arc(-surfaceLength / 2, 0, 3, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.beginPath();
            context.ctx.arc(surfaceLength / 2, 0, 3, 0, Math.PI * 2);
            context.ctx.fill();
        }

        // Restore context state
        context.ctx.restore();

        if (mirror.isSelected) {
            context.drawBuildingSelectionIndicator(screenPos, Math.max(selectionWidth, selectionHeight) * 0.52);
        }

        if (context.isWarpGatePlacementMode && mirror.isSelected) {
            const particleCount = 8;
            const particleRadius = Math.max(1.2, size * 0.08);
            const orbitRadius = size * 1.25;
            const timeOffset = timeSec * 1.8;
            context.ctx.save();
            context.ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < particleCount; i++) {
                const angle = timeOffset + (i * Math.PI * 2) / particleCount;
                const wobble = Math.sin(timeOffset * 1.4 + i * 1.9) * size * 0.25;
                const radius = orbitRadius + wobble;
                const particleX = screenPos.x + Math.cos(angle) * radius;
                const particleY = screenPos.y + Math.sin(angle) * radius;
                const alpha = 0.35 + 0.35 * Math.sin(timeOffset + i);
                const gradient = context.ctx.createRadialGradient(
                    particleX, particleY, 0,
                    particleX, particleY, particleRadius * 3
                );
                gradient.addColorStop(0, `rgba(180, 255, 255, ${alpha})`);
                gradient.addColorStop(1, 'rgba(120, 200, 255, 0)');
                context.ctx.fillStyle = gradient;
                context.ctx.beginPath();
                context.ctx.arc(particleX, particleY, particleRadius * 3, 0, Math.PI * 2);
                context.ctx.fill();

                context.ctx.fillStyle = `rgba(220, 255, 255, ${Math.min(0.9, alpha + 0.3)})`;
                context.ctx.beginPath();
                context.ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
                context.ctx.fill();
            }
            context.ctx.restore();
        }

        // Draw efficiency indicator (in world space, not rotated)
        if (mirror.efficiency < 1.0) {
            context.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
            context.ctx.fill();
        }
        
        // Draw move order indicator if mirror has one
        if (mirror.moveOrder > 0 && mirror.targetPosition) {
            context.drawMoveOrderIndicator(mirror.position, mirror.targetPosition, mirror.moveOrder, displayColor);
        }

        // Check if mirror is regenerating (within influence radius of forge and below max health)
        const forge = mirror.owner.stellarForge;
        const isRegenerating = !!(forge && mirror.health < context.MIRROR_MAX_HEALTH &&
            game.isPointWithinPlayerInfluence(mirror.owner, mirror.position));
        // Use player color based on whether this is the viewing player or enemy
        const playerColorToUse = (context.viewingPlayer && mirror.owner === context.viewingPlayer) 
            ? context.playerColor 
            : context.enemyColor;
        
        context.drawHealthDisplay(screenPos, mirror.health, context.MIRROR_MAX_HEALTH, size, -size - 10, 
            isRegenerating, 
            isRegenerating ? playerColorToUse : undefined);

        if (mirror.isSelected) {
            const hasLoSToSun = mirror.hasLineOfSightToLight(game.suns, game.asteroids);
            const linkedStructure = mirror.getLinkedStructure(forge);
            const hasLoSToTarget = linkedStructure
                ? mirror.hasLineOfSightToStructure(linkedStructure, game.asteroids, game.players)
                : false;
            const energyRate = linkedStructure instanceof StellarForge && hasLoSToSun && hasLoSToTarget
                ? mirror.getEnergyRatePerSec()
                : 0;
            
            // Get cached SoL icon
            const solIcon = context.getSolEnergyIcon();
            const iconSize = 16 * context.zoom;
            const textY = screenPos.y + size + 16 * context.zoom;
            
            // Calculate text width to center icon and text together
            context.ctx.font = `${12 * context.zoom}px Doto`;
            const energyText = `+${energyRate.toFixed(0)}/s`;
            const textWidth = context.ctx.measureText(energyText).width;
            const spacing = Constants.SOL_ICON_TEXT_SPACING * context.zoom;
            const totalWidth = iconSize + spacing + textWidth; // icon + spacing + text
            const startX = screenPos.x - totalWidth / 2;
            
            // Draw icon
            if (solIcon.complete && solIcon.naturalWidth > 0) {
                context.ctx.drawImage(solIcon, startX, textY - iconSize / 2, iconSize, iconSize);
            }
            
            // Draw text
            context.ctx.fillStyle = '#FFFFAA';
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText(energyText, startX + iconSize + spacing, textY);
        }
    }

    public drawMirrorCommandButtons(
        mirrors: Set<SolarMirror>,
        timeSec: number,
        context: SolarMirrorRendererContext
    ): void {
        if (mirrors.size === 0) return;
        
        // Get one of the selected mirrors to determine button positions
        const firstMirror = Array.from(mirrors)[0];
        const screenPos = context.worldToScreen(firstMirror.position);
        
        const shouldShowFoundryButton = context.hasSeenFoundry;
        const hasFoundryAvailable = context.hasActiveFoundry;
        const isMirrorInSunlight = context.isSelectedMirrorInSunlight;
        
        const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * context.zoom;
        const buttonOffset = 50 * context.zoom; // Distance from mirror

        const buttonCount = isMirrorInSunlight ? (shouldShowFoundryButton ? 3 : 2) : 1;
        const positions = getRadialButtonOffsets(buttonCount);
        const forgePos = positions[0];
        const warpGatePos = isMirrorInSunlight ? positions[1] : null;
        const foundryPos = isMirrorInSunlight && shouldShowFoundryButton ? positions[2] : null;
        const forgeButtonX = screenPos.x + forgePos.x * buttonOffset;
        const forgeButtonY = screenPos.y + forgePos.y * buttonOffset;
        const warpGateButtonX = warpGatePos ? screenPos.x + warpGatePos.x * buttonOffset : screenPos.x;
        const warpGateButtonY = warpGatePos ? screenPos.y + warpGatePos.y * buttonOffset : screenPos.y;
        const foundryButtonX = foundryPos ? screenPos.x + foundryPos.x * buttonOffset : screenPos.x;
        const foundryButtonY = foundryPos ? screenPos.y + foundryPos.y * buttonOffset : screenPos.y;

        // Draw primary mirror button
        const isForgeHighlighted = context.highlightedButtonIndex === 0;
        context.ctx.fillStyle = isForgeHighlighted ? 'rgba(255, 215, 0, 0.4)' : '#444444';
        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = isForgeHighlighted ? 4 : 2;
        context.ctx.beginPath();
        context.ctx.arc(forgeButtonX, forgeButtonY, buttonRadius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.stroke();
        
        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.font = `${11 * context.zoom}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'middle';
        if (isMirrorInSunlight) {
            context.ctx.fillText('Forge', forgeButtonX, forgeButtonY);
        } else {
            context.ctx.fillText('To', forgeButtonX, forgeButtonY - 5 * context.zoom);
            context.ctx.fillText('Sun', forgeButtonX, forgeButtonY + 6 * context.zoom);
        }

        if (isMirrorInSunlight && warpGatePos) {
        // Draw "Warp Gate" button (center or right)
        const isWarpGateAvailable = context.canCreateWarpGateFromMirrors;
        const isWarpGateHighlighted = context.highlightedButtonIndex === 1 && isWarpGateAvailable;
        const isWarpGateArmed = context.isWarpGatePlacementMode && isWarpGateAvailable;
        const warpGatePulse = 0.35 + 0.25 * Math.sin(timeSec * 4);
        const warpGateFill = isWarpGateArmed
            ? `rgba(0, 255, 255, ${0.35 + warpGatePulse})`
            : (isWarpGateHighlighted ? 'rgba(0, 255, 255, 0.4)' : (isWarpGateAvailable ? '#444444' : '#2C2C2C'));
        context.ctx.fillStyle = warpGateFill;
        context.ctx.strokeStyle = isWarpGateAvailable ? (isWarpGateArmed ? '#B8FFFF' : '#00FFFF') : '#666666';
        context.ctx.lineWidth = isWarpGateHighlighted || isWarpGateArmed ? 4 : 2;
        if (isWarpGateArmed) {
            context.ctx.save();
            context.ctx.globalCompositeOperation = 'lighter';
            context.ctx.strokeStyle = `rgba(120, 255, 255, ${0.35 + warpGatePulse})`;
            context.ctx.lineWidth = 6 * context.zoom;
            context.ctx.beginPath();
            context.ctx.arc(warpGateButtonX, warpGateButtonY, buttonRadius + 5 * context.zoom, 0, Math.PI * 2);
            context.ctx.stroke();
            context.ctx.restore();
        }
        context.ctx.beginPath();
        context.ctx.arc(warpGateButtonX, warpGateButtonY, buttonRadius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.stroke();
        
        context.ctx.fillStyle = isWarpGateAvailable ? '#FFFFFF' : '#8A8A8A';
        context.ctx.font = `${9 * context.zoom}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText('Warp', warpGateButtonX, warpGateButtonY - 6 * context.zoom);
        context.ctx.fillText('Gate', warpGateButtonX, warpGateButtonY + 6 * context.zoom);
        }

        if (isMirrorInSunlight && shouldShowFoundryButton) {
            const isFoundryHighlighted = hasFoundryAvailable && context.highlightedButtonIndex === 2;
            const foundryFill = hasFoundryAvailable
                ? (isFoundryHighlighted ? 'rgba(160, 160, 160, 0.4)' : '#444444')
                : '#2C2C2C';
            const foundryStroke = hasFoundryAvailable ? '#B0B0B0' : '#666666';
            const foundryText = hasFoundryAvailable ? '#FFFFFF' : '#8A8A8A';

            context.ctx.fillStyle = foundryFill;
            context.ctx.strokeStyle = foundryStroke;
            context.ctx.lineWidth = isFoundryHighlighted ? 4 : 2;
            context.ctx.beginPath();
            context.ctx.arc(foundryButtonX, foundryButtonY, buttonRadius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();

            context.ctx.fillStyle = foundryText;
            context.ctx.font = `${9 * context.zoom}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText('Found', foundryButtonX, foundryButtonY - 5 * context.zoom);
            context.ctx.fillText('ry', foundryButtonX, foundryButtonY + 6 * context.zoom);
        }

        // Reset text alignment
        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'alphabetic';
    }

    private getVelarisMirrorSeed(mirror: SolarMirror): number {
        let seed = this.velarisMirrorSeeds.get(mirror);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisMirrorSeeds.set(mirror, seed);
        }
        return seed;
    }
}
