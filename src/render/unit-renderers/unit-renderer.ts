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
import { drawAbilityCooldownBar } from './shared-utilities';
import { StarlingRenderer } from './starling-renderer';
import { HeroRenderer } from './hero-renderer';

export class UnitRenderer {
    private readonly starlingRenderer = new StarlingRenderer();
    private readonly heroRenderer = new HeroRenderer();
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
            drawAbilityCooldownBar(screenPos, size, unit, '#FFD700', size * 1.8, size * 5.5, context);
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
            this.drawQueuedMoveOrderPath(unit, shouldDim ? displayColor : color, context);
        }
    }


    private drawQueuedMoveOrderPath(unit: Unit, color: string, context: UnitRendererContext): void {
        const queuedPathPoints = unit.getQueuedPathPoints();
        if (queuedPathPoints.length === 0) {
            return;
        }

        let segmentStart = unit.position;
        let moveOrderNumber = unit.moveOrder;
        for (let pathPointIndex = 0; pathPointIndex < queuedPathPoints.length; pathPointIndex++) {
            const segmentTarget = queuedPathPoints[pathPointIndex];
            this.drawMoveOrderIndicator(segmentStart, segmentTarget, moveOrderNumber, color, context);
            segmentStart = segmentTarget;
            moveOrderNumber += 1;
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

    private getMoveOrderFrameIndex(context: UnitRendererContext): number {
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
        this.heroRenderer.drawChronoHero(chrono, color, game, isEnemy, context);
    }
    
    /**
     * Draw a deployed turret
     */
    public drawDeployedTurret(turret: InstanceType<typeof DeployedTurret>, game: GameState, context: UnitRendererContext): void {
        this.heroRenderer.drawDeployedTurret(turret, game, context);
    }

    /**
     * Draw a Grave unit with its orbiting projectiles
     */
    public drawGrave(grave: InstanceType<typeof Grave>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawGrave(grave, color, game, isEnemy, context);
    }

    /**
     * Draw merged attack range outlines for selected starlings
     * Shows the combined outline instead of individual circles
     */
    public drawMergedStarlingRanges(game: GameState, context: UnitRendererContext): void {
        this.starlingRenderer.drawMergedStarlingRanges(game, context);
    }

    public drawVisibleArcSegment(
        screenPos: Vector2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        minArcLengthRad: number,
        context: UnitRendererContext
    ): void {
        this.starlingRenderer.drawVisibleArcSegment(screenPos, radius, startAngle, endAngle, minArcLengthRad, context);
    }

    /**
     * Draw a Starling unit (minion from stellar forge)
     */
    public drawStarling(starling: Starling, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.starlingRenderer.drawStarling(starling, color, game, isEnemy, context);
    }


    public drawVelarisStarlingParticles(
        screenPos: Vector2D,
        size: number,
        starling: Starling,
        displayColor: string,
        timeSec: number,
        context: UnitRendererContext
    ): void {
        this.starlingRenderer.drawVelarisStarlingParticles(screenPos, size, starling, displayColor, timeSec, context);
    }

    /**
     * Draw queued move-order lines for selected starlings.
     * Shared paths are rendered once to avoid duplicate overlays.
     */
    public drawStarlingMoveLines(game: GameState, context: UnitRendererContext): void {
        if (!context.viewingPlayer) return;

        const color = context.getFactionColor(context.viewingPlayer.faction);
        const renderedPathHashes = new Set<string>();

        for (const unit of context.selectedUnits) {
            if (!(unit instanceof Starling) || unit.owner !== context.viewingPlayer || unit.moveOrder <= 0 || !unit.rallyPoint) {
                continue;
            }

            const pathHash = unit.getPathHash();
            if (renderedPathHashes.has(pathHash)) {
                continue;
            }

            renderedPathHashes.add(pathHash);
            this.drawQueuedMoveOrderPath(unit, color, context);
        }
    }

    /**
     * Draw a Ray unit (Velaris hero)
     */
    public drawRay(ray: InstanceType<typeof Ray>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawRay(ray, color, game, isEnemy, context);
    }

    /**
     * Draw a Nova unit (Velaris hero)
     */
    public drawNova(nova: InstanceType<typeof Nova>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawNova(nova, color, game, isEnemy, context);
    }

    /**
     * Draw an InfluenceBall unit (Velaris hero)
     */
    public drawInfluenceBall(ball: InstanceType<typeof InfluenceBall>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawInfluenceBall(ball, color, game, isEnemy, context);
    }

    /**
     * Draw a TurretDeployer unit (Velaris hero)
     */
    public drawTurretDeployer(deployer: InstanceType<typeof TurretDeployer>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawTurretDeployer(deployer, color, game, isEnemy, context);
    }

    /**
     * Draw a Driller unit (Aurum hero)
     */
    public drawDriller(driller: InstanceType<typeof Driller>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawDriller(driller, color, game, isEnemy, context);
    }

    /**
     * Draw a Dagger hero unit with cloak indicator
     */
    public drawDagger(dagger: InstanceType<typeof Dagger>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawDagger(dagger, color, game, isEnemy, context);
    }

    /**
     * Draw a Beam hero unit with sniper indicator
     */
    public drawBeam(beam: InstanceType<typeof Beam>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawBeam(beam, color, game, isEnemy, context);
    }

    /**
     * Draw a Spotlight hero unit (Radiant hero)
     */
    public drawSpotlight(spotlight: InstanceType<typeof Spotlight>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawSpotlight(spotlight, color, game, isEnemy, context);
    }

    /**
     * Draw a Mortar hero unit with detection cone visualization
     */
    public drawMortar(mortar: any, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawMortar(mortar, color, game, isEnemy, context);
    }

    public drawPreist(preist: InstanceType<typeof Preist>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawPreist(preist, color, game, isEnemy, context);
    }

    public drawTank(tank: InstanceType<typeof Tank>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawTank(tank, color, game, isEnemy, context);
    }

    /**
     * Draw Shadow hero (Velaris faction) with beam attack visualization
     */
    public drawShadow(shadow: InstanceType<typeof Shadow>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.heroRenderer.drawShadow(shadow, color, game, isEnemy, context);
    }

    /**
     * Draw a shadow decoy
     */
    public drawShadowDecoy(decoy: InstanceType<typeof ShadowDecoy>, context: UnitRendererContext): void {
        this.heroRenderer.drawShadowDecoy(decoy, context);
    }

    /**
     * Draw a shadow decoy particle
     */
    public drawShadowDecoyParticle(particle: InstanceType<typeof ShadowDecoyParticle>, context: UnitRendererContext): void {
        this.heroRenderer.drawShadowDecoyParticle(particle, context);
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
        this.heroRenderer.drawWarpGateProductionEffect(screenPos, radius, game, displayColor, context);
    }

    /**
     * Draw a Grave projectile with trail
     */
    public drawGraveProjectile(projectile: InstanceType<typeof GraveProjectile>, color: string, context: UnitRendererContext): void {
        this.heroRenderer.drawGraveProjectile(projectile, color, context);
    }

    /**
     * Draw a small particle for the Grave hero
     */
    public drawGraveSmallParticle(particle: InstanceType<typeof GraveSmallParticle>, color: string, context: UnitRendererContext): void {
        this.heroRenderer.drawGraveSmallParticle(particle, color, context);
    }

    /**
     * Draw Grave Black Hole (vortex particle)
     */
    public drawGraveBlackHole(blackHole: InstanceType<typeof GraveBlackHole>, color: string, context: UnitRendererContext): void {
        this.heroRenderer.drawGraveBlackHole(blackHole, color, context);
    }

    /**
     * Draw explosion effect
     */
    public drawExplosionEffect(position: Vector2D, context: UnitRendererContext): void {
        this.heroRenderer.drawExplosionEffect(position, context);
    }
}
