/**
 * FactionProjectileRenderer - Renders faction-specific orbs, fields, and ability effects
 *
 * Extracted from projectile-renderer.ts as part of Phase 23 refactoring.
 * Contains: Radiant orbs/laser fields, Velaris orbs/light-blocking fields,
 *           Aurum orbs/shield fields/shield hits, Splendor effects,
 *           CrescentWave, DashSlash, BlinkShockwave, ChronoFreezeCircle
 */

import {
    Vector2D,
    Sun,
    Faction,
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
} from '../game-core';
import * as Constants from '../constants';
import { getFactionColor } from './faction-utilities';
import type { ProjectileRendererContext } from './projectile-renderer';

export class FactionProjectileRenderer {
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
