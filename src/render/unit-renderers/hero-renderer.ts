/**
 * HeroRenderer - Handles rendering of hero units and their effects
 *
 * Extracted from unit-renderer.ts following the same class-based extraction
 * pattern used by StarlingRenderer.
 */

import {
    Vector2D,
    GameState,
    Unit,
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

export class HeroRenderer {
    public drawChronoHero(chrono: Unit, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        // Draw the base unit
        context.drawUnit(chrono, color, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(grave, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(ray, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(nova, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(ball, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(deployer, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(driller, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(dagger, isCloakedFriendly ? color : displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(beam, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(spotlight, displayColor, game, isEnemy, 1.0, context);

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
        context.drawUnit(mortar, displayColor, game, isEnemy, 1.0, context);
        
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
        context.drawUnit(preist, color, game, isEnemy, 1.0, context);

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
        context.drawUnit(tank, color, game, isEnemy, 1.0, context);

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
        context.drawUnit(shadow, displayColor, game, isEnemy, 1.0, context);
        
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
