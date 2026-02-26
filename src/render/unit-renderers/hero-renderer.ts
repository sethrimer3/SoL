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
import { RadiantHeroRenderer } from './radiant-hero-renderer';
import { VelarisHeroRenderer } from './velaris-hero-renderer';
import type { UnitRendererContext } from './shared-utilities';

export class HeroRenderer {
    private readonly radiantRenderer = new RadiantHeroRenderer();
    private readonly velarisRenderer = new VelarisHeroRenderer();
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
     * Draw warp gate effect for buildings that are warping in.
     */
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


    public drawDagger(dagger: InstanceType<typeof Dagger>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawDagger(dagger, color, game, isEnemy, context);
    }

    public drawBeam(beam: InstanceType<typeof Beam>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawBeam(beam, color, game, isEnemy, context);
    }

    public drawSpotlight(spotlight: InstanceType<typeof Spotlight>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawSpotlight(spotlight, color, game, isEnemy, context);
    }

    public drawMortar(mortar: any, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawMortar(mortar, color, game, isEnemy, context);
    }

    public drawPreist(preist: InstanceType<typeof Preist>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawPreist(preist, color, game, isEnemy, context);
    }

    public drawTank(tank: InstanceType<typeof Tank>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.radiantRenderer.drawTank(tank, color, game, isEnemy, context);
    }

    public drawDeployedTurret(turret: InstanceType<typeof DeployedTurret>, game: GameState, context: UnitRendererContext): void {
        this.velarisRenderer.drawDeployedTurret(turret, game, context);
    }

    public drawGrave(grave: InstanceType<typeof Grave>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawGrave(grave, color, game, isEnemy, context);
    }

    public drawRay(ray: InstanceType<typeof Ray>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawRay(ray, color, game, isEnemy, context);
    }

    public drawNova(nova: InstanceType<typeof Nova>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawNova(nova, color, game, isEnemy, context);
    }

    public drawInfluenceBall(ball: InstanceType<typeof InfluenceBall>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawInfluenceBall(ball, color, game, isEnemy, context);
    }

    public drawTurretDeployer(deployer: InstanceType<typeof TurretDeployer>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawTurretDeployer(deployer, color, game, isEnemy, context);
    }

    public drawShadow(shadow: InstanceType<typeof Shadow>, color: string, game: GameState, isEnemy: boolean, context: UnitRendererContext): void {
        this.velarisRenderer.drawShadow(shadow, color, game, isEnemy, context);
    }

    public drawShadowDecoy(decoy: InstanceType<typeof ShadowDecoy>, context: UnitRendererContext): void {
        this.velarisRenderer.drawShadowDecoy(decoy, context);
    }

    public drawShadowDecoyParticle(particle: InstanceType<typeof ShadowDecoyParticle>, context: UnitRendererContext): void {
        this.velarisRenderer.drawShadowDecoyParticle(particle, context);
    }

    public drawGraveProjectile(projectile: InstanceType<typeof GraveProjectile>, color: string, context: UnitRendererContext): void {
        this.velarisRenderer.drawGraveProjectile(projectile, color, context);
    }

    public drawGraveSmallParticle(particle: InstanceType<typeof GraveSmallParticle>, color: string, context: UnitRendererContext): void {
        this.velarisRenderer.drawGraveSmallParticle(particle, color, context);
    }

    public drawGraveBlackHole(blackHole: InstanceType<typeof GraveBlackHole>, color: string, context: UnitRendererContext): void {
        this.velarisRenderer.drawGraveBlackHole(blackHole, color, context);
    }

    public drawExplosionEffect(position: Vector2D, context: UnitRendererContext): void {
        this.velarisRenderer.drawExplosionEffect(position, context);
    }

}