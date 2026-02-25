/**
 * RadiantHeroRenderer - Renders Radiant faction hero units
 *
 * Contains: Dagger, Beam, Spotlight, Mortar, Preist, Tank
 * Extracted from hero-renderer.ts as part of Phase 24 refactoring.
 */

import {
    Vector2D,
    GameState,
    Dagger,
    Beam,
    Spotlight,
    Mortar,
    Preist,
    Tank,
} from '../../game-core';
import * as Constants from '../../constants';
import type { UnitRendererContext } from './shared-utilities';

export class RadiantHeroRenderer {
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
}
