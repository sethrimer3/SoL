/**
 * ProjectileRenderer - Handles rendering of projectiles and effect particles
 *
 * Extracted from renderer.ts following the class-based extraction pattern used
 * by ForgeRenderer, FoundryRenderer, and TowerRenderer.
 */

import {
    Vector2D,
    Faction,
    Sun,
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    AbilityBullet,
    MinionProjectile,
    LaserBeam,
    ImpactParticle,
    InfluenceZone,
    InfluenceBallProjectile,
    RadiantOrb,
    VelarisOrb,
    AurumOrb,
    AurumShieldHit,
    CrescentWave,
    DashSlash,
    BlinkShockwave,
    ChronoFreezeCircle,
    SplendorSunSphere,
    SplendorSunlightZone,
    SplendorLaserSegment,
    Splendor,
    GameState,
} from '../game-core';
import { SparkleParticle, DeathParticle } from '../sim/entities/particles';
import { getFactionColor } from './faction-utilities';
import { FactionProjectileRenderer } from './faction-projectile-renderer';

import * as Constants from '../constants';

/**
 * Minimal renderer context required by ProjectileRenderer.
 * Mirrors the pattern of BuildingRendererContext in shared-utilities.ts.
 */
export interface ProjectileRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';

    worldToScreen(worldPos: Vector2D): Vector2D;

    getCachedRadialGradient(
        key: string,
        x0: number, y0: number, r0: number,
        x1: number, y1: number, r1: number,
        stops: Array<{ offset: number; color: string }>
    ): CanvasGradient;

    drawParticleSunShadowTrail(
        worldPos: Vector2D,
        screenPos: Vector2D,
        screenSize: number,
        suns: Sun[],
        maxDistance: number,
        opacity: number,
        alphaScale: number
    ): void;
}

/**
 * Encapsulates all projectile and effect-particle rendering methods.
 */
export class ProjectileRenderer {
    private readonly factionRenderer = new FactionProjectileRenderer();

    public drawMuzzleFlash(flash: MuzzleFlash, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(flash.position);
        const size = 5 * context.zoom;
        const opacity = 1.0 - (flash.lifetime / flash.maxLifetime);

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.rotate(flash.angle);

        context.ctx.fillStyle = `rgba(255, 255, 100, ${opacity})`;
        context.ctx.beginPath();
        context.ctx.ellipse(0, 0, size * 2, size, 0, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.restore();
    }

    public drawBulletCasing(casing: BulletCasing, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(casing.position);
        const width = 3 * context.zoom;
        const height = 5 * context.zoom;
        const opacity = 1.0 - (casing.lifetime / casing.maxLifetime);

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.rotate(casing.rotation);

        context.ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
        context.ctx.fillRect(-width / 2, -height / 2, width, height);

        context.ctx.restore();
    }

    public drawBouncingBullet(bullet: BouncingBullet, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(bullet.position);
        const size = 3 * context.zoom;
        const opacity = 1.0 - (bullet.lifetime / bullet.maxLifetime);

        context.ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
    }

    public drawAbilityBullet(bullet: AbilityBullet, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(bullet.position);
        const size = 4 * context.zoom;
        const opacity = bullet.lifetime / bullet.maxLifetime;

        const color = getFactionColor(bullet.owner.faction as Faction);
        context.ctx.fillStyle = `${color}`;
        context.ctx.globalAlpha = opacity;
        if (bullet.isSpotlightBullet) {
            const angle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
            const length = (bullet.renderLengthPx ?? 8) * context.zoom;
            const width = (bullet.renderWidthPx ?? 2) * context.zoom;
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(angle);
            context.ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
            context.ctx.restore();
        } else {
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            context.ctx.fill();
        }
        context.ctx.globalAlpha = 1.0;
    }

    public drawMinionProjectile(projectile: MinionProjectile, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(projectile.position);
        const size = 2.5 * context.zoom;
        const color = getFactionColor(projectile.owner.faction as Faction);

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = 0.9;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.globalAlpha = 1.0;
    }

    public drawMortarProjectile(projectile: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(projectile.position);
        const size = 6 * context.zoom;
        const color = getFactionColor(projectile.owner.faction as Faction);

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.globalAlpha = 0.5;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x - size * 0.2, screenPos.y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
    }

    public drawNovaBomb(bomb: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(bomb.position);
        const size = Constants.NOVA_BOMB_RADIUS * context.zoom;
        const color = getFactionColor(bomb.owner.faction as Faction);

        if (bomb.isArmed) {
            const pulseIntensity = 0.5 + 0.5 * Math.sin(bomb.lifetime * 8);
            context.ctx.fillStyle = color;
            context.ctx.globalAlpha = 0.2 * pulseIntensity;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 2, 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = 0.4;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.4, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        if (bomb.isArmed) {
            const angle = bomb.lifetime * 5;
            const highlightX = screenPos.x + Math.cos(angle) * size * 0.6;
            const highlightY = screenPos.y + Math.sin(angle) * size * 0.6;

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = 0.8;
            context.ctx.beginPath();
            context.ctx.arc(highlightX, highlightY, size * 0.3, 0, Math.PI * 2);
            context.ctx.fill();
        } else {
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = 0.3;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x - size * 0.3, screenPos.y - size * 0.3, size * 0.4, 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.globalAlpha = 1.0;
    }

    public drawMiniMothership(mini: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(mini.position);
        const size = 8 * context.zoom;
        const color = getFactionColor(mini.owner.faction as Faction);

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();

        const angle = Math.atan2(mini.velocity.y, mini.velocity.x);

        const tipX = screenPos.x + Math.cos(angle) * size;
        const tipY = screenPos.y + Math.sin(angle) * size;
        const leftX = screenPos.x + Math.cos(angle + 2.5) * size * 0.6;
        const leftY = screenPos.y + Math.sin(angle + 2.5) * size * 0.6;
        const rightX = screenPos.x + Math.cos(angle - 2.5) * size * 0.6;
        const rightY = screenPos.y + Math.sin(angle - 2.5) * size * 0.6;

        context.ctx.moveTo(tipX, tipY);
        context.ctx.lineTo(leftX, leftY);
        context.ctx.lineTo(rightX, rightY);
        context.ctx.closePath();
        context.ctx.fill();

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.globalAlpha = 0.6;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
    }

    public drawMiniMothershipExplosion(explosion: any, age: number, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(explosion.position);
        const maxRadius = Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS * context.zoom;
        const color = getFactionColor(explosion.owner.faction as Faction);

        const duration = 0.5;
        const progress = Math.min(age / duration, 1.0);

        const radius = maxRadius * progress;
        const alpha = (1.0 - progress) * 0.7;

        context.ctx.strokeStyle = color;
        context.ctx.globalAlpha = alpha;
        context.ctx.lineWidth = 3 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.stroke();

        if (progress < 0.5) {
            const flashAlpha = (0.5 - progress) * 2 * 0.5;
            context.ctx.fillStyle = color;
            context.ctx.globalAlpha = flashAlpha;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, maxRadius * 0.3 * (1 - progress * 2), 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.globalAlpha = 1.0;
    }

    public drawNovaScatterBullet(bullet: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(bullet.position);
        const size = 4 * context.zoom;
        const color = getFactionColor(bullet.owner.faction as Faction);

        const alpha = 1.0 - (bullet.lifetime / bullet.maxLifetime);

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = alpha * 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = alpha;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.globalAlpha = alpha * 0.6;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 0.4, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
    }

    public drawStickyBomb(bomb: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(bomb.position);
        const size = Constants.STICKY_BOMB_RADIUS * context.zoom;
        const color = getFactionColor(bomb.owner.faction as Faction);

        if (bomb.isArmed && bomb.isStuck) {
            const pulseIntensity = 0.5 + 0.5 * Math.sin(bomb.lifetime * 10);
            context.ctx.fillStyle = color;
            context.ctx.globalAlpha = 0.3 * pulseIntensity;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 2.5, 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = bomb.isStuck ? 0.5 : 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = 1.0;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        if (bomb.isStuck) {
            context.ctx.fillStyle = '#000000';
            context.ctx.globalAlpha = 0.4;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 0.6, 0, Math.PI * 2);
            context.ctx.fill();
        }

        if (bomb.isArmed && bomb.isStuck) {
            const angle = bomb.lifetime * 6;
            const highlightX = screenPos.x + Math.cos(angle) * size * 0.4;
            const highlightY = screenPos.y + Math.sin(angle) * size * 0.4;

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = 0.9;
            context.ctx.beginPath();
            context.ctx.arc(highlightX, highlightY, size * 0.3, 0, Math.PI * 2);
            context.ctx.fill();
        } else {
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = 0.4;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x - size * 0.3, screenPos.y - size * 0.3, size * 0.3, 0, Math.PI * 2);
            context.ctx.fill();
        }

        if (bomb.isStuck && bomb.surfaceNormal) {
            context.ctx.strokeStyle = color;
            context.ctx.globalAlpha = 0.5;
            context.ctx.lineWidth = 2 * context.zoom;
            const normalLength = size * 1.5;
            context.ctx.beginPath();
            context.ctx.moveTo(screenPos.x, screenPos.y);
            context.ctx.lineTo(
                screenPos.x + bomb.surfaceNormal.x * normalLength,
                screenPos.y + bomb.surfaceNormal.y * normalLength
            );
            context.ctx.stroke();
        }

        context.ctx.globalAlpha = 1.0;
    }

    public drawStickyLaser(laser: any, context: ProjectileRendererContext): void {
        const startScreen = context.worldToScreen(laser.startPosition);
        const endPos = laser.getEndPosition();
        const endScreen = context.worldToScreen(endPos);
        const color = getFactionColor(laser.owner.faction as Faction);

        const alpha = 1.0 - (laser.lifetime / laser.maxLifetime);

        context.ctx.strokeStyle = color;
        context.ctx.globalAlpha = alpha * 0.2;
        context.ctx.lineWidth = laser.width * context.zoom * 2.5;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.globalAlpha = alpha * 0.5;
        context.ctx.lineWidth = laser.width * context.zoom * 1.5;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.globalAlpha = alpha * 0.9;
        context.ctx.lineWidth = laser.width * context.zoom;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.globalAlpha = alpha * 0.7;
        context.ctx.lineWidth = laser.width * context.zoom * 0.3;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.globalAlpha = 1.0;
    }

    public drawDisintegrationParticle(particle: any, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(particle.position);
        const size = 3 * context.zoom;
        const color = getFactionColor(particle.owner.faction as Faction);

        const alpha = 1.0 - (particle.lifetime / particle.maxLifetime);

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = alpha * 0.3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 1.8, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = alpha * 0.8;
        context.ctx.fillStyle = color;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        const flicker = Math.random();
        if (flicker > 0.7) {
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = alpha * 0.5;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, size * 0.5, 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.globalAlpha = 1.0;
    }

    public drawLaserBeam(laser: LaserBeam, context: ProjectileRendererContext): void {
        const startScreen = context.worldToScreen(laser.startPos);
        const endScreen = context.worldToScreen(laser.endPos);
        const color = getFactionColor(laser.owner.faction as Faction);

        const alpha = 1.0 - (laser.lifetime / laser.maxLifetime);

        context.ctx.strokeStyle = color;
        context.ctx.globalAlpha = alpha * 0.8;
        context.ctx.lineWidth = laser.widthPx;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.globalAlpha = alpha * 0.3;
        context.ctx.lineWidth = laser.widthPx * 2;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();

        context.ctx.globalAlpha = 1.0;
    }

    public drawImpactParticle(particle: ImpactParticle, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(particle.position);
        const color = getFactionColor(particle.faction as Faction);
        const alpha = 1.0 - (particle.lifetime / particle.maxLifetime);
        const size = 1 * context.zoom;

        context.ctx.fillStyle = color;
        context.ctx.globalAlpha = alpha;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.globalAlpha = 1.0;
    }

    public drawSparkleParticle(sparkle: SparkleParticle, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(sparkle.position);
        const opacity = sparkle.getOpacity();
        const size = sparkle.size * context.zoom;

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.globalAlpha = opacity;

        context.ctx.strokeStyle = sparkle.color;
        context.ctx.lineWidth = Math.max(1, size * 0.4);
        context.ctx.lineCap = 'round';

        context.ctx.beginPath();
        context.ctx.moveTo(-size, 0);
        context.ctx.lineTo(size, 0);
        context.ctx.stroke();

        context.ctx.beginPath();
        context.ctx.moveTo(0, -size);
        context.ctx.lineTo(0, size);
        context.ctx.stroke();

        const gradient = context.ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, sparkle.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.ctx.fillStyle = gradient;
        context.ctx.beginPath();
        context.ctx.arc(0, 0, size, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.restore();
    }

    public drawDeathParticle(particle: DeathParticle, game: GameState, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(particle.position);
        const ladSun = game.suns.find(s => s.type === 'lad');

        if ((context.graphicsQuality === 'high' || context.graphicsQuality === 'ultra') && game.suns.length > 0 && !ladSun) {
            const alphaScale = context.graphicsQuality === 'ultra' ? 1 : 0.72;
            const size = Math.max(1.1, (particle.spriteFragment?.width ?? 2) * context.zoom * 0.75);
            context.drawParticleSunShadowTrail(
                particle.position,
                screenPos,
                size,
                game.suns,
                Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
                particle.opacity,
                alphaScale
            );
        }

        if (particle.spriteFragment) {
            context.ctx.save();
            context.ctx.translate(screenPos.x, screenPos.y);
            context.ctx.rotate(particle.rotation);
            context.ctx.globalAlpha = particle.opacity;

            const size = particle.spriteFragment.width * context.zoom;
            context.ctx.drawImage(
                particle.spriteFragment,
                -size / 2,
                -size / 2,
                size,
                size
            );

            context.ctx.restore();
        }
    }

    public drawInfluenceZone(zone: InstanceType<typeof InfluenceZone>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(zone.position);
        const radius = zone.radius * context.zoom;
        const opacity = Math.max(0.1, 1.0 - (zone.lifetime / zone.duration));

        const color = getFactionColor(zone.owner.faction as Faction);

        context.ctx.strokeStyle = color;
        context.ctx.globalAlpha = opacity * 0.6;
        context.ctx.lineWidth = 3 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.stroke();

        const radiusRounded = Math.round(radius);
        const cacheKey = `influence-zone-${color}-${radiusRounded}`;
        const gradient = context.getCachedRadialGradient(
            cacheKey,
            0, 0, 0,
            0, 0, radius,
            [
                { offset: 0, color: `${color}40` },
                { offset: 1, color: `${color}10` }
            ]
        );

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = opacity * 0.3;
        context.ctx.beginPath();
        context.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.restore();

        context.ctx.globalAlpha = 1.0;
    }

    public drawInfluenceBallProjectile(projectile: InstanceType<typeof InfluenceBallProjectile>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(projectile.position);
        const size = 12 * context.zoom;

        const color = getFactionColor(projectile.owner.faction as Faction);

        const gradient = context.ctx.createRadialGradient(screenPos.x, screenPos.y, 0, screenPos.x, screenPos.y, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, `${color}AA`);
        gradient.addColorStop(1, `${color}00`);
        context.ctx.fillStyle = gradient;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, size * 0.3, 0, Math.PI * 2);
        context.ctx.fill();
    }

    public drawRadiantOrb(orb: InstanceType<typeof RadiantOrb>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawRadiantOrb(orb, context);
    }

    public drawVelarisOrb(orb: InstanceType<typeof VelarisOrb>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawVelarisOrb(orb, context);
    }

    public drawSplendorSunSphere(sphere: InstanceType<typeof SplendorSunSphere>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawSplendorSunSphere(sphere, context);
    }

    public drawSplendorSunlightZone(zone: InstanceType<typeof SplendorSunlightZone>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawSplendorSunlightZone(zone, context);
    }

    public drawSplendorLaserSegment(segment: InstanceType<typeof SplendorLaserSegment>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawSplendorLaserSegment(segment, context);
    }

    public drawSplendorChargeEffect(splendor: InstanceType<typeof Splendor>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawSplendorChargeEffect(splendor, context);
    }

    public drawAurumOrb(orb: InstanceType<typeof AurumOrb>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawAurumOrb(orb, context);
    }

    public drawRadiantLaserField(orb1: InstanceType<typeof RadiantOrb>, orb2: InstanceType<typeof RadiantOrb>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawRadiantLaserField(orb1, orb2, context);
    }

    public drawVelarisLightBlockingField(orb1: InstanceType<typeof VelarisOrb>, orb2: InstanceType<typeof VelarisOrb>, gameTime: number, context: ProjectileRendererContext): void {
        this.factionRenderer.drawVelarisLightBlockingField(orb1, orb2, gameTime, context);
    }

    public drawAurumShieldField(orb1: InstanceType<typeof AurumOrb>, orb2: InstanceType<typeof AurumOrb>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawAurumShieldField(orb1, orb2, context);
    }

    public drawAurumShieldHit(hit: InstanceType<typeof AurumShieldHit>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawAurumShieldHit(hit, context);
    }

    public drawCrescentWave(wave: InstanceType<typeof CrescentWave>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawCrescentWave(wave, context);
    }

    public drawDashSlash(slash: InstanceType<typeof DashSlash>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawDashSlash(slash, context);
    }

    public drawBlinkShockwave(shockwave: InstanceType<typeof BlinkShockwave>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawBlinkShockwave(shockwave, context);
    }

    public drawChronoFreezeCircle(freezeCircle: InstanceType<typeof ChronoFreezeCircle>, context: ProjectileRendererContext): void {
        this.factionRenderer.drawChronoFreezeCircle(freezeCircle, context);
    }
}
