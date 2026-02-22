/**
 * WarpGateRenderer - Handles rendering of warp gates, starling merge gates, and placement preview
 */

import { WarpGate, StarlingMergeGate, Vector2D, Faction, GameState, Sun, SubsidiaryFactory } from '../game-core';
import * as Constants from '../constants';
import { getRadialButtonOffsets } from './render-utilities';

export interface WarpGateRendererContext {
    ctx: CanvasRenderingContext2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    selectedWarpGate: WarpGate | null;
    highlightedButtonIndex: number;
    isWarpGatePlacementMode: boolean;
    warpGatePreviewWorldPos: Vector2D | null;
    isWarpGatePreviewValid: boolean;
    worldToScreen(worldPos: Vector2D): Vector2D;
    getLadPlayerColor(player: any, ladSun: Sun | undefined, game: GameState): string;
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
    drawBuildingSelectionIndicator(screenPos: { x: number; y: number }, radius: number): void;
    drawWarpGateProductionEffect(screenPos: Vector2D, radius: number, game: GameState, displayColor: string): void;
    getPseudoRandom(seed: number): number;
}

export class WarpGateRenderer {
    private readonly velarisWarpGateSeeds = new WeakMap<WarpGate, number>();

    private readonly VELARIS_WARP_GATE_PARTICLE_COUNT = 120;
    private readonly VELARIS_WARP_GATE_PARTICLE_BASE_SPEED = 0.55;
    private readonly VELARIS_WARP_GATE_PARTICLE_SWIRL_TIGHTNESS = 2.4;
    private readonly VELARIS_WARP_GATE_PARTICLE_CENTER_FADE = 0.18;

    public drawWarpGate(
        gate: WarpGate,
        game: GameState,
        ladSun: Sun | undefined,
        context: WarpGateRendererContext
    ): void {
        const screenPos = context.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * context.zoom;
        const chargeProgress = gate.chargeTime / Constants.WARP_GATE_CHARGE_TIME;
        const currentRadius = Math.min(maxRadius, chargeProgress * maxRadius);
        const isSelected = context.selectedWarpGate === gate;
        const isVelarisGate = gate.owner.faction === Faction.VELARIS;
        const displayColor = context.getLadPlayerColor(gate.owner, ladSun, game);
        const isInShadow = !ladSun && game.isPointInShadow(gate.position);
        context.drawStructureShadeGlow(gate, screenPos, maxRadius, displayColor, isInShadow, 1, isSelected);

        context.drawAestheticSpriteShadow(gate.position, screenPos, maxRadius * 0.9, game, {
            opacity: gate.isComplete ? 0.95 : 0.55,
            widthScale: 0.85,
            particleCount: gate.isComplete ? 5 : 3,
            particleSpread: maxRadius * 0.9
        });

        if (!gate.isComplete) {
            if (isVelarisGate) {
                this.drawVelarisWarpGateVortex(gate, screenPos, currentRadius, game.gameTime, displayColor, context);
            } else {
                // Draw charging effect
                context.ctx.strokeStyle = '#00FFFF';
                context.ctx.lineWidth = 3;
                context.ctx.globalAlpha = 0.5 + Math.sin(gate.chargeTime * 5) * 0.2;
                context.ctx.beginPath();
                context.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
                context.ctx.stroke();
                context.ctx.globalAlpha = 1.0;
            }

            // Draw charge progress
            context.ctx.strokeStyle = '#FFFFFF';
            context.ctx.lineWidth = 5;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, currentRadius + 5, 0, chargeProgress * Math.PI * 2);
            context.ctx.stroke();
            
            // Draw energy progress text
            const energyProgress = `${gate.accumulatedEnergy.toFixed(0)}/${Constants.WARP_GATE_ENERGY_REQUIRED}`;
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${12 * context.zoom}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText(energyProgress, screenPos.x, screenPos.y + maxRadius + 20 * context.zoom);
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'alphabetic';
        } else {
            if (isVelarisGate) {
                this.drawVelarisWarpGateVortex(gate, screenPos, maxRadius, game.gameTime, displayColor, context);
            } else {
                context.drawWarpGateProductionEffect(screenPos, maxRadius, game, displayColor);
            }
            if (isSelected) {
                context.drawBuildingSelectionIndicator(screenPos, maxRadius);
            }

            const completionProgress = gate.completionRemainingSec / Constants.WARP_GATE_COMPLETION_WINDOW_SEC;
            if (completionProgress > 0) {
                const countdownRadius = maxRadius + 12 * context.zoom;
                context.ctx.strokeStyle = '#FFD700';
                context.ctx.lineWidth = 4;
                context.ctx.beginPath();
                context.ctx.arc(
                    screenPos.x,
                    screenPos.y,
                    countdownRadius,
                    -Math.PI / 2,
                    -Math.PI / 2 + completionProgress * Math.PI * 2
                );
                context.ctx.stroke();
            }

            if (isSelected) {
                const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * context.zoom;
                const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * context.zoom;
                const hasSubFactory = gate.owner.buildings.some((building) => building instanceof SubsidiaryFactory);
                const playerEnergy = gate.owner.energy;
                
                // Faction-specific building buttons
                let buttonConfigs: Array<{ label: string; index: number; isAvailable: boolean }>;
                if (gate.owner.faction === Faction.RADIANT) {
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        },
                        {
                            label: 'Cannon',
                            index: 1,
                            isAvailable: playerEnergy >= Constants.MINIGUN_COST
                        },
                        {
                            label: 'Gatling',
                            index: 2,
                            isAvailable: playerEnergy >= Constants.GATLING_COST
                        },
                        {
                            label: 'Shield',
                            index: 3,
                            isAvailable: playerEnergy >= Constants.SHIELD_TOWER_COST
                        }
                    ];
                } else if (gate.owner.faction === Faction.VELARIS) {
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        },
                        {
                            label: 'Striker',
                            index: 1,
                            isAvailable: playerEnergy >= Constants.STRIKER_TOWER_COST
                        },
                        {
                            label: 'Lock-on',
                            index: 2,
                            isAvailable: playerEnergy >= Constants.LOCKON_TOWER_COST
                        },
                        {
                            label: 'Cyclone',
                            index: 3,
                            isAvailable: playerEnergy >= Constants.SWIRLER_COST
                        }
                    ];
                } else {
                    // Aurum or default - currently only Foundry is available
                    // TODO: Add Aurum-specific buildings in future updates
                    buttonConfigs = [
                        {
                            label: 'Foundry',
                            index: 0,
                            isAvailable: !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST
                        }
                    ];
                }
                
                const positions = getRadialButtonOffsets(buttonConfigs.length);

                for (let i = 0; i < buttonConfigs.length; i++) {
                    const config = buttonConfigs[i];
                    const pos = positions[i];
                    const btnX = screenPos.x + pos.x * buttonDistance;
                    const btnY = screenPos.y + pos.y * buttonDistance;
                    const labelOffset = buttonRadius + 14 * context.zoom;
                    const isHighlighted = config.isAvailable && context.highlightedButtonIndex === config.index;

                    if (config.isAvailable) {
                        context.ctx.fillStyle = isHighlighted ? 'rgba(0, 255, 255, 0.6)' : '#444444';
                        context.ctx.strokeStyle = '#00FFFF';
                        context.ctx.lineWidth = isHighlighted ? 4 : 2;
                    } else {
                        context.ctx.fillStyle = '#1F1F1F';
                        context.ctx.strokeStyle = '#555555';
                        context.ctx.lineWidth = 2;
                    }
                    context.ctx.beginPath();
                    context.ctx.arc(btnX, btnY, buttonRadius, 0, Math.PI * 2);
                    context.ctx.fill();
                    context.ctx.stroke();

                    // Draw button label
                    context.ctx.fillStyle = config.isAvailable ? '#FFFFFF' : '#777777';
                    context.ctx.font = `${11 * context.zoom}px Doto`;
                    context.ctx.textAlign = 'center';
                    context.ctx.textBaseline = 'middle';
                    context.ctx.fillText(
                        config.label,
                        btnX + pos.x * labelOffset,
                        btnY + pos.y * labelOffset
                    );
                }
            }
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'alphabetic';
        }
    }

    public drawStarlingMergeGate(
        gate: StarlingMergeGate,
        game: GameState,
        context: WarpGateRendererContext
    ): void {
        const screenPos = context.worldToScreen(gate.position);
        const radius = Constants.STARLING_MERGE_GATE_RADIUS_PX * context.zoom;
        const totalDuration = Constants.STARLING_MERGE_DURATION_SEC;
        const progress = totalDuration > 0 ? gate.remainingSec / totalDuration : 0;
        const pulse = 0.18 + Math.sin((totalDuration - gate.remainingSec) * 4) * 0.06;
        const glowAlpha = 0.35 + Math.sin((totalDuration - gate.remainingSec) * 5) * 0.1;

        context.drawAestheticSpriteShadow(gate.position, screenPos, radius * 0.92, game, {
            opacity: 0.85,
            widthScale: 0.82,
            particleCount: 4,
            particleSpread: radius * 0.9
        });

        context.ctx.fillStyle = `rgba(0, 255, 255, ${Math.max(0.1, pulse)})`;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.fill();

        context.ctx.strokeStyle = `rgba(0, 255, 255, ${Math.max(0.2, glowAlpha)})`;
        context.ctx.lineWidth = 2.5 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.stroke();

        context.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0.3, glowAlpha)})`;
        context.ctx.lineWidth = 1.5 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius * 0.65, 0, Math.PI * 2);
        context.ctx.stroke();

        const countdownRadius = radius + 7 * context.zoom;
        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 3 * context.zoom;
        context.ctx.beginPath();
        context.ctx.arc(
            screenPos.x,
            screenPos.y,
            countdownRadius,
            -Math.PI / 2,
            -Math.PI / 2 + progress * Math.PI * 2
        );
        context.ctx.stroke();

        const counterY = screenPos.y + radius + 10 * context.zoom;
        context.ctx.fillStyle = '#FFD700';
        context.ctx.font = `${12 * context.zoom}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'top';
        context.ctx.fillText(
            `${gate.absorbedCount}/${Constants.STARLING_MERGE_COUNT}`,
            screenPos.x,
            counterY
        );
        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'alphabetic';
    }

    public drawWarpGatePlacementPreview(game: GameState, context: WarpGateRendererContext): void {
        if (!context.isWarpGatePlacementMode || !context.warpGatePreviewWorldPos) {
            return;
        }

        const screenPos = context.worldToScreen(context.warpGatePreviewWorldPos);
        const radius = Constants.WARP_GATE_RADIUS * context.zoom;

        context.ctx.save();

        // Draw the preview circle with color based on validity
        if (context.isWarpGatePreviewValid) {
            // Valid placement - cyan color
            context.ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            context.ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
        } else {
            // Invalid placement - red color
            context.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            context.ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        }

        context.ctx.lineWidth = 3;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        context.ctx.fill();
        context.ctx.stroke();

        // Draw a pulsing effect for valid placement
        if (context.isWarpGatePreviewValid) {
            const pulse = 0.3 + 0.2 * Math.sin(game.gameTime * 4);
            context.ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius + 10 * context.zoom, 0, Math.PI * 2);
            context.ctx.stroke();
        }

        context.ctx.restore();
    }

    private drawVelarisWarpGateVortex(
        gate: WarpGate,
        screenPos: Vector2D,
        radiusPx: number,
        gameTime: number,
        displayColor: string,
        context: WarpGateRendererContext
    ): void {
        const twoPi = Math.PI * 2;
        const seed = this.getVelarisWarpGateSeed(gate);
        const particleRadius = Math.max(1, 1.35 * context.zoom);
        const ringAlpha = 0.65;

        context.ctx.save();
        context.ctx.strokeStyle = displayColor;
        context.ctx.lineWidth = 3;
        context.ctx.globalAlpha = ringAlpha;
        context.ctx.beginPath();
        context.ctx.arc(screenPos.x, screenPos.y, radiusPx, 0, twoPi);
        context.ctx.stroke();
        context.ctx.restore();

        context.ctx.save();
        context.ctx.fillStyle = displayColor;
        for (let i = 0; i < this.VELARIS_WARP_GATE_PARTICLE_COUNT; i++) {
            const seedOffset = seed + i * 0.83;
            const progress = (gameTime * this.VELARIS_WARP_GATE_PARTICLE_BASE_SPEED
                + context.getPseudoRandom(seedOffset)) % 1;
            const radiusFactor = 1 - progress;
            const alphaFactor = Math.max(
                0,
                (radiusFactor - this.VELARIS_WARP_GATE_PARTICLE_CENTER_FADE)
                    / (1 - this.VELARIS_WARP_GATE_PARTICLE_CENTER_FADE)
            );
            if (alphaFactor <= 0) {
                continue;
            }
            const baseAngle = context.getPseudoRandom(seedOffset + 2.4) * twoPi;
            const swirlAngle = baseAngle
                + gameTime * 0.9
                + progress * this.VELARIS_WARP_GATE_PARTICLE_SWIRL_TIGHTNESS * twoPi;
            const particleRadiusPx = radiusPx * radiusFactor;
            const x = screenPos.x + Math.cos(swirlAngle) * particleRadiusPx;
            const y = screenPos.y + Math.sin(swirlAngle) * particleRadiusPx;
            context.ctx.globalAlpha = alphaFactor * 0.9;
            context.ctx.beginPath();
            context.ctx.arc(x, y, particleRadius, 0, twoPi);
            context.ctx.fill();
        }
        context.ctx.restore();
    }

    private getVelarisWarpGateSeed(gate: WarpGate): number {
        let seed = this.velarisWarpGateSeeds.get(gate);
        if (seed === undefined) {
            seed = Math.random() * 10000;
            this.velarisWarpGateSeeds.set(gate, seed);
        }
        return seed;
    }
}
