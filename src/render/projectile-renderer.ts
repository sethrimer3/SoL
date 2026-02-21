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
        const screenPos = context.worldToScreen(orb.position);
        const color = getFactionColor(orb.owner.faction as Faction);

        const currentRange = orb.getRange();
        const speedRatio = orb.getCurrentSpeed() / Constants.RADIANT_ORB_MAX_SPEED;

        context.ctx.globalAlpha = speedRatio * 0.3;
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRange, 0, Math.PI * 2);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        const cacheKey = `radiant-orb-${color}-${Constants.RADIANT_ORB_RADIUS}`;
        const gradient = context.getCachedRadialGradient(
            cacheKey,
            0, 0, 0,
            0, 0, Constants.RADIANT_ORB_RADIUS,
            [
                { offset: 0, color: '#FFFFFF' },
                { offset: 0.4, color: color },
                { offset: 1, color: `${color}88` }
            ]
        );

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.fillStyle = gradient;
        context.ctx.beginPath();
        context.ctx.arc(0, 0, Constants.RADIANT_ORB_RADIUS, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.restore();
    }

    public drawVelarisOrb(orb: InstanceType<typeof VelarisOrb>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(orb.position);
        const color = getFactionColor(orb.owner.faction as Faction);

        const currentRange = orb.getRange();
        const speedRatio = orb.getCurrentSpeed() / Constants.VELARIS_ORB_MAX_SPEED;

        context.ctx.globalAlpha = speedRatio * 0.3;
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRange, 0, Math.PI * 2);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        const cacheKey = `velaris-orb-${color}-${Constants.VELARIS_ORB_RADIUS}`;
        const gradient = context.getCachedRadialGradient(
            cacheKey,
            0, 0, 0,
            0, 0, Constants.VELARIS_ORB_RADIUS,
            [
                { offset: 0, color: '#444444' },
                { offset: 0.4, color: color },
                { offset: 1, color: `${color}66` }
            ]
        );

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.fillStyle = gradient;
        context.ctx.beginPath();
        context.ctx.arc(0, 0, Constants.VELARIS_ORB_RADIUS, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.restore();
    }

    public drawSplendorSunSphere(sphere: InstanceType<typeof SplendorSunSphere>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(sphere.position);
        context.ctx.save();
        context.ctx.globalAlpha = 0.9;
        context.ctx.fillStyle = '#FFD700';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, Constants.SPLENDOR_SUN_SPHERE_RADIUS, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.strokeStyle = '#FFF59D';
        context.ctx.lineWidth = 2;
        context.ctx.stroke();
        context.ctx.restore();
    }

    public drawSplendorSunlightZone(zone: InstanceType<typeof SplendorSunlightZone>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(zone.position);
        context.ctx.save();
        context.ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, zone.radius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.strokeStyle = 'rgba(255, 235, 59, 0.55)';
        context.ctx.lineWidth = 2;
        context.ctx.stroke();
        context.ctx.restore();
    }

    public drawSplendorLaserSegment(segment: InstanceType<typeof SplendorLaserSegment>, context: ProjectileRendererContext): void {
        const startScreen = context.worldToScreen(segment.startPos);
        const endScreen = context.worldToScreen(segment.endPos);
        context.ctx.save();
        context.ctx.strokeStyle = 'rgba(255, 245, 157, 0.9)';
        context.ctx.lineWidth = Constants.SPLENDOR_LASER_WIDTH_PX * 0.35;
        context.ctx.beginPath();
        context.ctx.moveTo(startScreen.x, startScreen.y);
        context.ctx.lineTo(endScreen.x, endScreen.y);
        context.ctx.stroke();
        context.ctx.restore();
    }

    public drawSplendorChargeEffect(splendor: InstanceType<typeof Splendor>, context: ProjectileRendererContext): void {
        if (!splendor.isChargingAttack()) {
            return;
        }
        const chargeDirection = splendor.getChargeDirection();
        const nosePos = new Vector2D(
            splendor.position.x + chargeDirection.x * Constants.SPLENDOR_LASER_NOSE_OFFSET,
            splendor.position.y + chargeDirection.y * Constants.SPLENDOR_LASER_NOSE_OFFSET
        );
        const screenPos = context.worldToScreen(nosePos);
        const radius = 4 + 8 * splendor.getChargeProgress();
        context.ctx.save();
        context.ctx.fillStyle = 'rgba(255, 236, 128, 0.85)';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.restore();
    }

    public drawAurumOrb(orb: InstanceType<typeof AurumOrb>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(orb.position);
        const color = getFactionColor(orb.owner.faction as Faction);

        const currentRange = orb.getRange();
        const speedRatio = orb.getCurrentSpeed() / Constants.AURUM_ORB_MAX_SPEED;

        context.ctx.globalAlpha = speedRatio * 0.3;
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRange, 0, Math.PI * 2);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        const cacheKey = `aurum-orb-${color}-${Constants.AURUM_ORB_RADIUS}`;
        const gradient = context.getCachedRadialGradient(
            cacheKey,
            0, 0, 0,
            0, 0, Constants.AURUM_ORB_RADIUS,
            [
                { offset: 0, color: '#FFD700' },
                { offset: 0.4, color: color },
                { offset: 1, color: `${color}88` }
            ]
        );

        context.ctx.save();
        context.ctx.translate(screenPos.x, screenPos.y);
        context.ctx.fillStyle = gradient;
        context.ctx.beginPath();
        context.ctx.arc(0, 0, Constants.AURUM_ORB_RADIUS, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.restore();

        const healthRatio = orb.health / orb.maxHealth;
        const barWidth = 30;
        const barHeight = 4;
        const barX = screenPos.x - barWidth / 2;
        const barY = screenPos.y - Constants.AURUM_ORB_RADIUS - 10;

        context.ctx.fillStyle = '#333333';
        context.ctx.fillRect(barX, barY, barWidth, barHeight);

        context.ctx.fillStyle = healthRatio > 0.5 ? '#00FF00' : healthRatio > 0.25 ? '#FFFF00' : '#FF0000';
        context.ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);

        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.lineWidth = 1;
        context.ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    public drawRadiantLaserField(orb1: InstanceType<typeof RadiantOrb>, orb2: InstanceType<typeof RadiantOrb>, context: ProjectileRendererContext): void {
        const screenPos1 = context.worldToScreen(orb1.position);
        const screenPos2 = context.worldToScreen(orb2.position);
        const color = getFactionColor(orb1.owner.faction as Faction);

        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 3;
        context.ctx.globalAlpha = 0.6;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos1.x, screenPos1.y);
        context.ctx.lineTo(screenPos2.x, screenPos2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        const gradient = context.ctx.createLinearGradient(
            screenPos1.x, screenPos1.y,
            screenPos2.x, screenPos2.y
        );
        gradient.addColorStop(0, `${color}80`);
        gradient.addColorStop(0.5, `${color}40`);
        gradient.addColorStop(1, `${color}80`);

        context.ctx.strokeStyle = gradient;
        context.ctx.lineWidth = 8;
        context.ctx.globalAlpha = 0.3;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos1.x, screenPos1.y);
        context.ctx.lineTo(screenPos2.x, screenPos2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;
    }

    public drawVelarisLightBlockingField(orb1: InstanceType<typeof VelarisOrb>, orb2: InstanceType<typeof VelarisOrb>, gameTime: number, context: ProjectileRendererContext): void {
        const screenPos1 = context.worldToScreen(orb1.position);
        const screenPos2 = context.worldToScreen(orb2.position);
        const color = getFactionColor(orb1.owner.faction as Faction);

        context.ctx.strokeStyle = '#000000';
        context.ctx.lineWidth = 4;
        context.ctx.globalAlpha = 0.8;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos1.x, screenPos1.y);
        context.ctx.lineTo(screenPos2.x, screenPos2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 1;
        context.ctx.globalAlpha = 0.5;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos1.x, screenPos1.y);
        context.ctx.lineTo(screenPos2.x, screenPos2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        const distance = orb1.position.distanceTo(orb2.position);
        const particleCount = Math.floor(distance / 50);

        for (let i = 0; i < particleCount; i++) {
            const baseT = i / particleCount;
            const t = baseT + (Math.sin(gameTime * 2 + i) * 0.1);
            const clampedT = Math.max(0, Math.min(1, t));

            const px = orb1.position.x + (orb2.position.x - orb1.position.x) * clampedT;
            const py = orb1.position.y + (orb2.position.y - orb1.position.y) * clampedT;
            const screenPos = context.worldToScreen(new Vector2D(px, py));

            context.ctx.fillStyle = color;
            context.ctx.globalAlpha = 0.7;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.globalAlpha = 1;
        }
    }

    public drawAurumShieldField(orb1: InstanceType<typeof AurumOrb>, orb2: InstanceType<typeof AurumOrb>, context: ProjectileRendererContext): void {
        const color = getFactionColor(orb1.owner.faction as Faction);

        const dx = orb2.position.x - orb1.position.x;
        const dy = orb2.position.y - orb1.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) return;

        const ndx = dx / dist;
        const ndy = dy / dist;

        const offset = Constants.AURUM_SHIELD_OFFSET;
        const p1x = orb1.position.x + ndx * offset;
        const p1y = orb1.position.y + ndy * offset;
        const p2x = orb2.position.x - ndx * offset;
        const p2y = orb2.position.y - ndy * offset;

        const sp1 = context.worldToScreen(new Vector2D(p1x, p1y));
        const sp2 = context.worldToScreen(new Vector2D(p2x, p2y));

        const gradient = context.ctx.createLinearGradient(sp1.x, sp1.y, sp2.x, sp2.y);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(0.5, `${color}60`);
        gradient.addColorStop(1, `${color}40`);

        context.ctx.strokeStyle = gradient;
        context.ctx.lineWidth = 12;
        context.ctx.globalAlpha = 0.5;
        context.ctx.beginPath();
        context.ctx.moveTo(sp1.x, sp1.y);
        context.ctx.lineTo(sp2.x, sp2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;

        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 2;
        context.ctx.globalAlpha = 0.7;
        context.ctx.beginPath();
        context.ctx.moveTo(sp1.x, sp1.y);
        context.ctx.lineTo(sp2.x, sp2.y);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;
    }

    public drawAurumShieldHit(hit: InstanceType<typeof AurumShieldHit>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(hit.position);
        const color = getFactionColor(hit.owner.faction as Faction);
        const progress = hit.getProgress();

        const radius = 20 + progress * 30;
        const alpha = 1 - progress;

        context.ctx.globalAlpha = alpha * 0.7;
        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 0.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.globalAlpha = alpha * 0.4;
        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.stroke();
        context.ctx.globalAlpha = 1;
    }

    public drawCrescentWave(wave: InstanceType<typeof CrescentWave>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(wave.position);
        const color = getFactionColor(wave.owner.faction as Faction);

        context.ctx.save();

        const waveRadius = Constants.TANK_WAVE_WIDTH * context.zoom;
        const halfAngle = Constants.TANK_WAVE_ANGLE / 2;

        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, waveRadius * 1.5
        );
        gradient.addColorStop(0, `${color}00`);
        gradient.addColorStop(0.5, `${color}88`);
        gradient.addColorStop(1, `${color}00`);

        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = waveRadius * 0.5;
        context.ctx.globalAlpha = 0.7;
        context.ctx.beginPath();
        context.ctx.arc(
            screenPos.x,
            screenPos.y,
            waveRadius,
            wave.angle - halfAngle,
            wave.angle + halfAngle
        );
        context.ctx.stroke();

        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = 0.4;
        context.ctx.beginPath();
        context.ctx.moveTo(screenPos.x, screenPos.y);
        context.ctx.arc(
            screenPos.x,
            screenPos.y,
            waveRadius * 1.5,
            wave.angle - halfAngle,
            wave.angle + halfAngle
        );
        context.ctx.closePath();
        context.ctx.fill();

        const numParticles = 10;
        for (let i = 0; i < numParticles; i++) {
            const angle = wave.angle - halfAngle + (Constants.TANK_WAVE_ANGLE * i / numParticles);
            const distance = waveRadius * (0.8 + Math.sin(wave.lifetime * 5 + i) * 0.2);
            const particleX = screenPos.x + Math.cos(angle) * distance;
            const particleY = screenPos.y + Math.sin(angle) * distance;

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.globalAlpha = 0.8;
            context.ctx.beginPath();
            context.ctx.arc(particleX, particleY, 3 * context.zoom, 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.restore();
    }

    public drawDashSlash(slash: InstanceType<typeof DashSlash>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(slash.position);
        const color = getFactionColor(slash.owner.faction as Faction);

        context.ctx.save();

        const slashRadius = Constants.DASH_SLASH_RADIUS * context.zoom;

        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, slashRadius * 2
        );
        gradient.addColorStop(0, `${color}ff`);
        gradient.addColorStop(0.5, `${color}aa`);
        gradient.addColorStop(1, `${color}00`);

        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = 0.9;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, slashRadius * 2, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.globalAlpha = 0.8;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, slashRadius * 0.5, 0, Math.PI * 2);
        context.ctx.fill();

        const direction = slash.getDirection();
        const trailLength = slashRadius * 4;

        for (let i = 0; i < 5; i++) {
            const alpha = 0.3 * (1 - i / 5);
            const offset = (trailLength * i) / 5;
            const trailX = screenPos.x - direction.x * offset;
            const trailY = screenPos.y - direction.y * offset;

            context.ctx.fillStyle = color;
            context.ctx.globalAlpha = alpha;
            context.ctx.beginPath();
            context.ctx.arc(trailX, trailY, slashRadius * (1 - i / 5), 0, Math.PI * 2);
            context.ctx.fill();
        }

        context.ctx.restore();
    }

    public drawBlinkShockwave(shockwave: InstanceType<typeof BlinkShockwave>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(shockwave.position);
        const color = getFactionColor(shockwave.owner.faction as Faction);
        const progress = shockwave.getVisualProgress();

        context.ctx.save();

        const currentRadius = shockwave.radius * progress * context.zoom;

        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, currentRadius * 0.8,
            screenPos.x, screenPos.y, currentRadius * 1.5
        );
        gradient.addColorStop(0, `${color}88`);
        gradient.addColorStop(0.5, `${color}44`);
        gradient.addColorStop(1, `${color}00`);

        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = 1 - progress * 0.5;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRadius * 1.5, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.strokeStyle = color;
        context.ctx.lineWidth = 4 * context.zoom;
        context.ctx.globalAlpha = 0.9 * (1 - progress);
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
        context.ctx.stroke();

        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.lineWidth = 2 * context.zoom;
        context.ctx.globalAlpha = 0.8 * (1 - progress);
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, currentRadius * 0.95, 0, Math.PI * 2);
        context.ctx.stroke();

        const numLines = 16;
        for (let i = 0; i < numLines; i++) {
            const angle = (Math.PI * 2 * i) / numLines;
            const startRadius = currentRadius * 0.3;
            const endRadius = currentRadius;
            const startX = screenPos.x + Math.cos(angle) * startRadius;
            const startY = screenPos.y + Math.sin(angle) * startRadius;
            const endX = screenPos.x + Math.cos(angle) * endRadius;
            const endY = screenPos.y + Math.sin(angle) * endRadius;

            context.ctx.strokeStyle = color;
            context.ctx.lineWidth = 2 * context.zoom;
            context.ctx.globalAlpha = 0.4 * (1 - progress);
            context.ctx.beginPath();
            context.ctx.moveTo(startX, startY);
            context.ctx.lineTo(endX, endY);
            context.ctx.stroke();
        }

        context.ctx.restore();
    }

    public drawChronoFreezeCircle(freezeCircle: InstanceType<typeof ChronoFreezeCircle>, context: ProjectileRendererContext): void {
        const screenPos = context.worldToScreen(freezeCircle.position);
        const progress = freezeCircle.getVisualProgress();
        const radius = freezeCircle.radius * context.zoom;

        context.ctx.save();

        const pulsePhase = (progress * 8) % 1.0;
        const pulse = 0.85 + Math.sin(pulsePhase * Math.PI * 2) * 0.15;

        const gradient = context.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, radius * 1.2
        );
        gradient.addColorStop(0, `#88DDFF44`);
        gradient.addColorStop(0.7, `#4499CC22`);
        gradient.addColorStop(1, `#4499CC00`);

        context.ctx.fillStyle = gradient;
        context.ctx.globalAlpha = pulse * 0.6;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 1.2, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.strokeStyle = '#88DDFF';
        context.ctx.lineWidth = 3 * context.zoom;
        context.ctx.globalAlpha = 0.8 * pulse;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.stroke();

        context.ctx.strokeStyle = '#AAEEFF';
        context.ctx.lineWidth = 1.5 * context.zoom;
        context.ctx.globalAlpha = 0.6 * pulse;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 0.95, 0, Math.PI * 2);
        context.ctx.stroke();

        const numRays = 12;
        context.ctx.strokeStyle = '#CCFFFF';
        context.ctx.lineWidth = 1 * context.zoom;
        context.ctx.globalAlpha = 0.4 * pulse;
        for (let i = 0; i < numRays; i++) {
            const angle = (Math.PI * 2 * i) / numRays;
            const x1 = screenPos.x + Math.cos(angle) * radius * 0.3;
            const y1 = screenPos.y + Math.sin(angle) * radius * 0.3;
            const x2 = screenPos.x + Math.cos(angle) * radius;
            const y2 = screenPos.y + Math.sin(angle) * radius;

            context.ctx.beginPath();
            context.ctx.moveTo(x1, y1);
            context.ctx.lineTo(x2, y2);
            context.ctx.stroke();
        }

        context.ctx.restore();
    }
}
