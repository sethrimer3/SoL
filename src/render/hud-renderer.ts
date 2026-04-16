/**
 * HUDRenderer - Handles in-game HUD overlay rendering
 * Includes: damage numbers, health display, off-screen indicators,
 *           production progress, menu button, info panel, end game screen, border fade
 */

import { Vector2D, Player, Building, SubsidiaryFactory, Starling, GameState } from '../game-core';
import * as Constants from '../constants';
import { getCanvasScreenHeightPx, getCanvasScreenWidthPx } from './canvas-metrics';
import { getFactionColor } from './faction-utilities';

export interface HUDRendererContext {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewingPlayer: Player | null;
    playerColor: string;
    enemyColor: string;
    colorblindMode: boolean;
    offscreenIndicatorOpacity: number;
    infoBoxOpacity: number;
    infoBoxSize: number;
    damageDisplayMode: 'damage' | 'remaining-life';
    healthDisplayMode: 'bar' | 'number';
    showInfo: boolean;
    CONTROL_LINES_FULL: string[];
    CONTROL_LINES_COMPACT: string[];
    worldToScreen(worldPos: Vector2D): Vector2D;
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;
    getLadPlayerColor(player: Player, ladSun: any, game: GameState): string;
    getSolEnergyIcon(): HTMLImageElement;
    getProductionDisplayName(unitType: string): string;
    getBuildingDisplayName(building: Building): string;
}

interface ProductionEntry {
    label: string;
    progress: number;
}

type CachedTextSprite = {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    alphabeticBaselineOffsetPx: number;
    renderScale: number;
};

export class HUDRenderer {
    // Keep text caches bounded so long matches do not grow memory indefinitely; clearing on overflow
    // is a simple reset strategy because the cached HUD strings are cheap to repopulate over a few frames.
    private static readonly MAX_TEXT_SPRITE_CACHE_ENTRY_COUNT = 512;
    private static readonly MIN_TEXT_SPRITE_PADDING_PX = 4;
    private static readonly TEXT_SPRITE_STROKE_PADDING_MULTIPLIER = 2;
    private static readonly TEXT_SPRITE_BASE_PADDING_PX = 2;
    private readonly cachedTextSprites = new Map<string, CachedTextSprite>();
    private readonly cachedTextWidths = new Map<string, number>();
    private readonly textMeasureCanvas = document.createElement('canvas');
    private readonly textMeasureContext = this.textMeasureCanvas.getContext('2d');

    private getTextRenderScale(context: HUDRendererContext): number {
        const transformScale = context.ctx.getTransform().a;
        if (!Number.isFinite(transformScale) || transformScale <= 0) {
            return 1;
        }
        return Math.max(1, transformScale);
    }

    public drawDamageNumbers(game: GameState, context: HUDRendererContext): void {
        for (const damageNumber of game.damageNumbers) {
            if (!context.isWithinViewBounds(damageNumber.position, 100)) {
                continue;
            }

            const screenPos = context.worldToScreen(damageNumber.position);
            const opacity = damageNumber.getOpacity(game.gameTime);

            const displayText = damageNumber.displayText
                ?? ((context.damageDisplayMode === 'remaining-life')
                    ? damageNumber.remainingHealth.toString()
                    : damageNumber.damage.toString());

            const clampedDamage = Math.max(0, damageNumber.damage);
            const damageScale = Math.min(1, clampedDamage / Math.max(1, damageNumber.maxHealth));
            const fontSize = damageNumber.isBlocked
                ? 14
                : 13 + damageScale * 8;

            context.ctx.font = `bold ${fontSize}px Doto`;
            context.ctx.globalAlpha = opacity;
            this.drawCachedTextSprite(
                displayText,
                screenPos.x,
                screenPos.y,
                {
                    font: `bold ${fontSize}px Doto`,
                    fillStyle: damageNumber.textColor,
                    strokeStyle: '#FFFFFF',
                    lineWidth: 1.5,
                    textAlign: 'center',
                    textBaseline: 'middle'
                },
                context
            );
            context.ctx.globalAlpha = 1;
        }
    }

    public drawHealthDisplay(
        screenPos: {x: number, y: number},
        currentHealth: number,
        maxHealth: number,
        size: number,
        yOffset: number,
        isRegenerating: boolean = false,
        playerColor?: string,
        context?: HUDRendererContext
    ): void {
        if (!context) return;
        if (currentHealth >= maxHealth) {
            return;
        }

        const healthPercent = currentHealth / maxHealth;

        if (context.healthDisplayMode === 'bar') {
            const barWidth = size * 3;
            const barHeight = 3;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + yOffset;

            context.ctx.fillStyle = '#333';
            context.ctx.fillRect(barX, barY, barWidth, barHeight);

            context.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            context.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            if (isRegenerating) {
                const plusSize = 8;
                const plusX = barX + barWidth + 5;
                const plusY = barY + barHeight / 2;

                context.ctx.strokeStyle = playerColor || '#00FF00';
                context.ctx.lineWidth = 2;

                context.ctx.beginPath();
                context.ctx.moveTo(plusX - plusSize / 2, plusY);
                context.ctx.lineTo(plusX + plusSize / 2, plusY);
                context.ctx.stroke();

                context.ctx.beginPath();
                context.ctx.moveTo(plusX, plusY - plusSize / 2);
                context.ctx.lineTo(plusX, plusY + plusSize / 2);
                context.ctx.stroke();
            }
        } else {
            const healthColor = this.getHealthColor(healthPercent);
            const fontSize = Math.max(10, size * 1.5);

            context.ctx.font = `bold ${fontSize}px Doto`;
            this.drawCachedTextSprite(
                Math.round(currentHealth).toString(),
                screenPos.x,
                screenPos.y + yOffset,
                {
                    font: `bold ${fontSize}px Doto`,
                    fillStyle: `rgb(${healthColor.r}, ${healthColor.g}, ${healthColor.b})`,
                    strokeStyle: 'rgba(0, 0, 0, 0.8)',
                    lineWidth: 2,
                    textAlign: 'center',
                    textBaseline: 'bottom'
                },
                context
            );

            if (isRegenerating) {
                const plusSize = fontSize * 0.6;
                const plusX = screenPos.x + fontSize * 0.8;
                const plusY = screenPos.y + yOffset - fontSize / 2;

                context.ctx.strokeStyle = playerColor || '#00FF00';
                context.ctx.lineWidth = 2;

                context.ctx.beginPath();
                context.ctx.moveTo(plusX - plusSize / 2, plusY);
                context.ctx.lineTo(plusX + plusSize / 2, plusY);
                context.ctx.stroke();

                context.ctx.beginPath();
                context.ctx.moveTo(plusX, plusY - plusSize / 2);
                context.ctx.lineTo(plusX, plusY + plusSize / 2);
                context.ctx.stroke();
            }
        }
    }

    public drawOffScreenUnitIndicators(game: GameState, context: HUDRendererContext): void {
        if (!context.viewingPlayer) return;
        context.ctx.save();
        context.ctx.globalAlpha = context.offscreenIndicatorOpacity;

        const ladSun = game.suns.find(s => s.type === 'lad');

        const STARLING_SIZE = 12;
        const HERO_SIZE = 20;
        const MIRROR_SIZE = 24;
        const BUILDING_SIZE = 28;
        const FORGE_SIZE = 36;

        for (const unit of context.viewingPlayer.units) {
            if (!this.isOffScreen(unit.position, context)) continue;

            const isStarling = unit instanceof Starling;
            const size = isStarling ? STARLING_SIZE : HERO_SIZE;
            const edgePos = this.getEdgePosition(unit.position, size, context);

            context.ctx.strokeStyle = context.playerColor;
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
            context.ctx.stroke();
        }

        for (const mirror of context.viewingPlayer.solarMirrors) {
            if (!this.isOffScreen(mirror.position, context)) continue;

            const edgePos = this.getEdgePosition(mirror.position, MIRROR_SIZE, context);

            context.ctx.fillStyle = context.playerColor;
            context.ctx.beginPath();
            context.ctx.arc(edgePos.x, edgePos.y, MIRROR_SIZE / 2, 0, Math.PI * 2);
            context.ctx.fill();
        }

        for (const building of context.viewingPlayer.buildings) {
            if (!this.isOffScreen(building.position, context)) continue;

            const isFoundry = building instanceof SubsidiaryFactory;
            const size = isFoundry ? FORGE_SIZE : BUILDING_SIZE;
            const edgePos = this.getEdgePosition(building.position, size, context);

            context.ctx.fillStyle = context.playerColor;
            context.ctx.beginPath();
            context.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
            context.ctx.fill();
        }

        if (context.viewingPlayer.stellarForge && !context.viewingPlayer.isDefeated()) {
            const forge = context.viewingPlayer.stellarForge;
            if (this.isOffScreen(forge.position, context)) {
                const edgePos = this.getEdgePosition(forge.position, FORGE_SIZE, context);

                context.ctx.fillStyle = context.playerColor;
                context.ctx.beginPath();
                context.ctx.arc(edgePos.x, edgePos.y, FORGE_SIZE / 2, 0, Math.PI * 2);
                context.ctx.fill();
            }
        }

        for (const player of game.players) {
            if (player === context.viewingPlayer || player.isDefeated()) continue;

            const color = context.getLadPlayerColor(player, ladSun, game);

            for (const unit of player.units) {
                if (!this.isOffScreen(unit.position, context)) continue;

                if (!game.isObjectVisibleToPlayer(unit.position, context.viewingPlayer, unit)) {
                    continue;
                }

                const isStarling = unit instanceof Starling;
                const unitSize = isStarling ? STARLING_SIZE : HERO_SIZE;
                const edgePos = this.getEdgePosition(unit.position, unitSize, context);

                if (context.colorblindMode) {
                    context.ctx.save();
                    context.ctx.translate(edgePos.x, edgePos.y);
                    context.ctx.rotate(Math.PI / 4);
                    context.ctx.strokeStyle = color;
                    context.ctx.lineWidth = 2;
                    context.ctx.strokeRect(-unitSize / 2, -unitSize / 2, unitSize, unitSize);
                    context.ctx.restore();
                } else {
                    context.ctx.strokeStyle = color;
                    context.ctx.lineWidth = 2;
                    context.ctx.beginPath();
                    context.ctx.arc(edgePos.x, edgePos.y, unitSize / 2, 0, Math.PI * 2);
                    context.ctx.stroke();
                }
            }

            for (const mirror of player.solarMirrors) {
                if (!this.isOffScreen(mirror.position, context)) continue;

                if (!game.isObjectVisibleToPlayer(mirror.position, context.viewingPlayer, mirror)) {
                    continue;
                }

                const edgePos = this.getEdgePosition(mirror.position, MIRROR_SIZE, context);

                if (context.colorblindMode) {
                    context.ctx.save();
                    context.ctx.translate(edgePos.x, edgePos.y);
                    context.ctx.rotate(Math.PI / 4);
                    context.ctx.fillStyle = color;
                    context.ctx.fillRect(-MIRROR_SIZE / 2, -MIRROR_SIZE / 2, MIRROR_SIZE, MIRROR_SIZE);
                    context.ctx.restore();
                } else {
                    context.ctx.fillStyle = color;
                    context.ctx.beginPath();
                    context.ctx.arc(edgePos.x, edgePos.y, MIRROR_SIZE / 2, 0, Math.PI * 2);
                    context.ctx.fill();
                }
            }

            for (const building of player.buildings) {
                if (!this.isOffScreen(building.position, context)) continue;

                if (!game.isObjectVisibleToPlayer(building.position, context.viewingPlayer, building)) {
                    continue;
                }

                const isFoundry = building instanceof SubsidiaryFactory;
                const size = isFoundry ? FORGE_SIZE : BUILDING_SIZE;
                const edgePos = this.getEdgePosition(building.position, size, context);

                if (context.colorblindMode) {
                    context.ctx.save();
                    context.ctx.translate(edgePos.x, edgePos.y);
                    context.ctx.rotate(Math.PI / 4);
                    context.ctx.fillStyle = color;
                    context.ctx.fillRect(-size / 2, -size / 2, size, size);
                    context.ctx.restore();
                } else {
                    context.ctx.fillStyle = color;
                    context.ctx.beginPath();
                    context.ctx.arc(edgePos.x, edgePos.y, size / 2, 0, Math.PI * 2);
                    context.ctx.fill();
                }
            }

            if (player.stellarForge) {
                const forge = player.stellarForge;
                if (this.isOffScreen(forge.position, context)) {
                    if (game.isObjectVisibleToPlayer(forge.position, context.viewingPlayer, forge)) {
                        const edgePos = this.getEdgePosition(forge.position, FORGE_SIZE, context);

                        if (context.colorblindMode) {
                            context.ctx.save();
                            context.ctx.translate(edgePos.x, edgePos.y);
                            context.ctx.rotate(Math.PI / 4);
                            context.ctx.fillStyle = color;
                            context.ctx.fillRect(-FORGE_SIZE / 2, -FORGE_SIZE / 2, FORGE_SIZE, FORGE_SIZE);
                            context.ctx.restore();
                        } else {
                            context.ctx.fillStyle = color;
                            context.ctx.beginPath();
                            context.ctx.arc(edgePos.x, edgePos.y, FORGE_SIZE / 2, 0, Math.PI * 2);
                            context.ctx.fill();
                        }
                    }
                }
            }
        }

        context.ctx.restore();
    }

    public drawUI(game: GameState, context: HUDRendererContext): void {
        if (context.showInfo) {
            const screenWidth = getCanvasScreenWidthPx(context.canvas);
            const screenHeight = getCanvasScreenHeightPx(context.canvas);
            const isCompactLayout = screenWidth < 600;
            const infoFontSize = isCompactLayout ? 13 : 16;
            const infoLineHeight = infoFontSize + 4;
            const infoBoxWidth = Math.min(300, screenWidth - 20);
            const infoBoxHeight = 20 + infoLineHeight * 5 + game.players.length * 60;

            context.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.ctx.fillRect(10, 10, infoBoxWidth, infoBoxHeight);

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${infoFontSize}px Doto`;
            let infoY = 30;
            this.drawCachedTextSprite('SoL - Speed of Light RTS', 20, infoY, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
            infoY += infoLineHeight;
            this.drawCachedTextSprite(`Game Time: ${game.gameTime.toFixed(1)}s`, 20, infoY, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
            infoY += infoLineHeight;
            this.drawCachedTextSprite(`Dust Particles: ${game.spaceDust.length}`, 20, infoY, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
            infoY += infoLineHeight;
            this.drawCachedTextSprite(`Asteroids: ${game.asteroids.length}`, 20, infoY, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
            infoY += infoLineHeight;
            this.drawCachedTextSprite(`Warp Gates: ${game.warpGates.length}`, 20, infoY, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);

            let y = infoY + infoLineHeight;
            for (const player of game.players) {
                const color = getFactionColor(player.faction);
                context.ctx.fillStyle = color;
                this.drawCachedTextSprite(`${player.name} (${player.faction})`, 20, y, { font: `${infoFontSize}px Doto`, fillStyle: color, textAlign: 'left', textBaseline: 'alphabetic' }, context);
                this.drawCachedTextSprite(`Energy: ${player.energy.toFixed(1)}`, 20, y + 20, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);

                if (player.stellarForge) {
                    const status = player.stellarForge.isReceivingLight ? '✓ Light' : '✗ No Light';
                    this.drawCachedTextSprite(`${status} | HP: ${player.stellarForge.health.toFixed(0)}`, 20, y + 40, { font: `${infoFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
                }

                y += 60;
            }

            const controlLines = isCompactLayout
                ? context.CONTROL_LINES_COMPACT
                : context.CONTROL_LINES_FULL;
            const controlFontSize = isCompactLayout ? 12 : 14;
            const controlLineHeight = controlFontSize + 4;
            const controlBoxWidth = Math.min(450, screenWidth - 20);
            const controlBoxHeight = controlLineHeight * controlLines.length + 14;
            const controlBoxX = 10;
            const controlBoxY = screenHeight - controlBoxHeight - 10;
            context.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.ctx.fillRect(controlBoxX, controlBoxY, controlBoxWidth, controlBoxHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${controlFontSize}px Doto`;
            let controlTextY = controlBoxY + controlLineHeight;
            for (const line of controlLines) {
                this.drawCachedTextSprite(line, 20, controlTextY, { font: `${controlFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
                controlTextY += controlLineHeight;
            }
        }
    }

    /**
     * Draw the match timer in the bottom-left corner of the screen.
     * Shows remaining time in MM:SS format, turns red when < 60s.
     */
    public drawMatchTimer(game: GameState, context: HUDRendererContext): void {
        const screenHeight = getCanvasScreenHeightPx(context.canvas);
        const remainingSec = Math.max(0, Constants.MATCH_TIME_LIMIT_SEC - game.gameTime);
        const minutes = Math.floor(remainingSec / 60);
        const seconds = Math.floor(remainingSec % 60);
        const timerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        const fontSize = 22;
        const x = 20;
        const y = screenHeight - 20;

        // Urgent color when under 60 seconds
        const fillColor = remainingSec < 60 ? '#FF4444' : '#FFFFFF';
        const bgAlpha = remainingSec < 60 ? 0.6 : 0.4;

        // Background pill
        context.ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
        context.ctx.beginPath();
        const pillWidth = 90;
        const pillHeight = 30;
        const pillX = x - 6;
        const pillY = y - fontSize + 2;
        const pillRadius = 6;
        context.ctx.moveTo(pillX + pillRadius, pillY);
        context.ctx.lineTo(pillX + pillWidth - pillRadius, pillY);
        context.ctx.arcTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + pillRadius, pillRadius);
        context.ctx.lineTo(pillX + pillWidth, pillY + pillHeight - pillRadius);
        context.ctx.arcTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - pillRadius, pillY + pillHeight, pillRadius);
        context.ctx.lineTo(pillX + pillRadius, pillY + pillHeight);
        context.ctx.arcTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - pillRadius, pillRadius);
        context.ctx.lineTo(pillX, pillY + pillRadius);
        context.ctx.arcTo(pillX, pillY, pillX + pillRadius, pillY, pillRadius);
        context.ctx.fill();

        this.drawCachedTextSprite(timerText, x, y, {
            font: `bold ${fontSize}px Doto`,
            fillStyle: fillColor,
            textAlign: 'left',
            textBaseline: 'alphabetic',
        }, context);

        // Show damage scores below timer when remaining time is under threshold
        if (remainingSec < Constants.DAMAGE_SCORE_DISPLAY_THRESHOLD_SEC && game.players.length >= 2) {
            const scoreFontSize = 14;
            let scoreY = y + scoreFontSize + 6;
            for (const player of game.players) {
                const color = getFactionColor(player.faction);
                this.drawCachedTextSprite(
                    `${player.name}: ${player.damageScore} pts`,
                    x, scoreY,
                    { font: `${scoreFontSize}px Doto`, fillStyle: color, textAlign: 'left', textBaseline: 'alphabetic' },
                    context
                );
                scoreY += scoreFontSize + 4;
            }
        }
    }

    public drawMenuButton(context: HUDRendererContext): void {
        const buttonSize = 50;
        const margin = 10;

        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        context.ctx.fillRect(margin, margin, buttonSize, buttonSize);

        context.ctx.strokeStyle = '#FFFFFF';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(margin, margin, buttonSize, buttonSize);

        context.ctx.fillStyle = '#FFFFFF';
        const lineWidth = 30;
        const lineHeight = 3;
        const lineSpacing = 8;
        const startX = margin + (buttonSize - lineWidth) / 2;
        const startY = margin + (buttonSize - lineHeight * 3 - lineSpacing * 2) / 2;

        context.ctx.fillRect(startX, startY, lineWidth, lineHeight);
        context.ctx.fillRect(startX, startY + lineHeight + lineSpacing, lineWidth, lineHeight);
        context.ctx.fillRect(startX, startY + (lineHeight + lineSpacing) * 2, lineWidth, lineHeight);
    }

    public drawProductionProgress(game: GameState, context: HUDRendererContext): void {
        const screenWidth = getCanvasScreenWidthPx(context.canvas);
        const sizeScale = context.infoBoxSize;
        const margin = 10;
        const productionBoxWidth = 200 * sizeScale;
        const boxHeight = 60 * sizeScale;
        const rightX = screenWidth - margin;
        let y = margin;

        const starlingSymbol = '✦';

        const player = game.players.find((p) => !p.isAi);
        if (!player) {
            return;
        }

        context.ctx.save();
        context.ctx.globalAlpha = context.infoBoxOpacity;

        const compactBoxHeight = 30 * sizeScale;
        const compactTextPaddingLeft = 8 * sizeScale;
        const compactTextPaddingRight = 8 * sizeScale;
        const compactIconInset = 4 * sizeScale;
        const compactIconSize = compactBoxHeight - compactIconInset * 2;
        const fontSize = Math.round(14 * sizeScale);
        context.ctx.font = `bold ${fontSize}px Doto`;

        const compactTextWidths: number[] = [];
        const fontString = `bold ${fontSize}px Doto`;
        if (player.stellarForge) {
            const energyText = `${player.stellarForge.incomingLightPerSec.toFixed(1)}/s`;
            compactTextWidths.push(
                compactTextPaddingLeft + compactIconSize + compactIconInset + this.getCachedTextWidth(energyText, fontString) + compactTextPaddingRight
            );
        }

        const starlingCount = player.units.filter(unit => unit instanceof Starling).length;
        const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - starlingCount);

        const forge = player.stellarForge;
        const nextCrunchStarlings = forge
            ? Math.min(
                Math.floor(forge.incomingLightPerSec / Constants.FORGE_CRUNCH_ENERGY_PER_SEC_PER_STARLING),
                availableStarlingSlots
            )
            : 0;
        const starlingRateLabel = forge ? ` (+${nextCrunchStarlings})` : '';
        const starlingRateText = `${starlingSymbol} ${starlingCount}${starlingRateLabel}`;
        const maxStarlingsText = `${starlingSymbol} ${starlingCount}/${Constants.STARLING_MAX_COUNT}`;

        compactTextWidths.push(
            compactTextPaddingLeft + this.getCachedTextWidth(starlingRateText, fontString) + compactTextPaddingRight,
            compactTextPaddingLeft + this.getCachedTextWidth(maxStarlingsText, fontString) + compactTextPaddingRight
        );

        const compactBoxWidth = Math.ceil(Math.max(...compactTextWidths));
        const compactX = rightX - compactBoxWidth;
        const productionX = rightX - productionBoxWidth;

        if (player.stellarForge) {
            const forge = player.stellarForge;
            const energyRate = forge.incomingLightPerSec;

            context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            context.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

            context.ctx.strokeStyle = forge.isReceivingLight ? '#00FF00' : '#FF0000';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

            const solIcon = context.getSolEnergyIcon();
            const iconX = compactX + compactIconInset;
            const iconY = y + compactIconInset;

            if (solIcon.complete && solIcon.naturalWidth > 0) {
                context.ctx.drawImage(solIcon, iconX, iconY, compactIconSize, compactIconSize);
            }

            this.drawCachedTextSprite(
                `${energyRate.toFixed(1)}/s`,
                compactX + compactTextPaddingLeft + compactIconSize + compactIconInset,
                y + compactBoxHeight / 2,
                {
                    font: fontString,
                    fillStyle: '#FFFFFF',
                    textAlign: 'left',
                    textBaseline: 'middle'
                },
                context
            );

            y += compactBoxHeight + 5 * sizeScale;
        }

        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        context.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

        this.drawCachedTextSprite(
            starlingRateText,
            compactX + compactTextPaddingLeft,
            y + compactBoxHeight / 2,
            {
                font: fontString,
                fillStyle: '#FFFFFF',
                textAlign: 'left',
                textBaseline: 'middle'
            },
            context
        );

        y += compactBoxHeight + 5 * sizeScale;

        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        context.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

        this.drawCachedTextSprite(
            maxStarlingsText,
            compactX + compactTextPaddingLeft,
            y + compactBoxHeight / 2,
            {
                font: fontString,
                fillStyle: '#FFFFFF',
                textAlign: 'left',
                textBaseline: 'middle'
            },
            context
        );

        y += compactBoxHeight + 8 * sizeScale;

        if (player.stellarForge) {
            const forge = player.stellarForge;
            const forgeProductionEntries: ProductionEntry[] = [];

            if (forge.isMirrorActivelyProducing()) {
                forgeProductionEntries.push({
                    label: context.getProductionDisplayName('Solar Mirror'),
                    progress: forge.getMirrorProductionProgress()
                });
            } else if (forge.isMirrorQueuedOrProducing()) {
                forgeProductionEntries.push({
                    label: context.getProductionDisplayName('Solar Mirror'),
                    progress: 0
                });
            }

            if (forge.heroProductionUnitType) {
                const progress = forge.heroProductionDurationSec > 0
                    ? 1 - (forge.heroProductionRemainingSec / forge.heroProductionDurationSec)
                    : 0;
                forgeProductionEntries.push({
                    label: context.getProductionDisplayName(forge.heroProductionUnitType),
                    progress
                });
            }

            for (const queuedHeroUnitType of forge.unitQueue) {
                forgeProductionEntries.push({
                    label: context.getProductionDisplayName(queuedHeroUnitType),
                    progress: 0
                });
            }

            for (const forgeProductionEntry of forgeProductionEntries) {
                this.drawProductionEntry(
                    productionX,
                    y,
                    productionBoxWidth,
                    boxHeight,
                    forgeProductionEntry.label,
                    forgeProductionEntry.progress,
                    context
                );
                y += boxHeight + 8 * sizeScale;
            }
        }

        const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory);
        if (foundry) {
            const foundryProductionEntries: ProductionEntry[] = [];

            if (foundry.currentProduction) {
                foundryProductionEntries.push({
                    label: `Foundry ${context.getProductionDisplayName(foundry.currentProduction)}`,
                    progress: foundry.productionProgress
                });
            }

            for (const queuedProductionType of foundry.productionQueue) {
                foundryProductionEntries.push({
                    label: `Foundry ${context.getProductionDisplayName(queuedProductionType)}`,
                    progress: 0
                });
            }

            for (const foundryProductionEntry of foundryProductionEntries) {
                this.drawProductionEntry(
                    productionX,
                    y,
                    productionBoxWidth,
                    boxHeight,
                    foundryProductionEntry.label,
                    foundryProductionEntry.progress,
                    context
                );
                y += boxHeight + 8 * sizeScale;
            }
        }

        const buildingInProgress = player.buildings.find((building) => !building.isComplete);
        if (buildingInProgress) {
            context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            context.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.strokeStyle = '#FFD700';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);

            const buildingName = context.getBuildingDisplayName(buildingInProgress);
            this.drawCachedTextSprite(
                `Building ${buildingName}`,
                productionX + 8 * sizeScale,
                y + 8 * sizeScale,
                {
                    font: fontString,
                    fillStyle: '#FFFFFF',
                    textAlign: 'left',
                    textBaseline: 'top'
                },
                context
            );

            this.drawProgressBar(productionX + 8 * sizeScale, y + 32 * sizeScale, productionBoxWidth - 16 * sizeScale, 16 * sizeScale, buildingInProgress.buildProgress, context);
        }

        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'alphabetic';
        context.ctx.restore();
    }

    public drawEndGameStatsScreen(game: GameState, winner: Player, context: HUDRendererContext): void {
        const screenWidth = getCanvasScreenWidthPx(context.canvas);
        const screenHeight = getCanvasScreenHeightPx(context.canvas);
        const isCompactLayout = screenWidth < 700;
        const localPlayer = context.viewingPlayer;
        const didLocalPlayerWin = winner === localPlayer;

        context.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        context.ctx.fillRect(0, 0, screenWidth, screenHeight);

        context.ctx.fillStyle = didLocalPlayerWin ? '#4CAF50' : '#F44336';
        const victoryFontSize = Math.max(28, Math.min(48, screenWidth * 0.12));
        context.ctx.font = `bold ${victoryFontSize}px Doto`;
        context.ctx.textAlign = 'center';
        const victoryText = didLocalPlayerWin ? 'VICTORY' : 'DEFEAT';
        const victoryFillStyle = didLocalPlayerWin ? '#4CAF50' : '#F44336';
        this.drawCachedTextSprite(
            victoryText,
            screenWidth / 2,
            80,
            {
                font: `bold ${victoryFontSize}px Doto`,
                fillStyle: victoryFillStyle,
                textAlign: 'center',
                textBaseline: 'alphabetic'
            },
            context
        );

        const panelWidth = Math.min(700, screenWidth - 40);
        const panelHeight = Math.min(450, screenHeight - 200);
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = 130;

        context.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        context.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 3;
        context.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        context.ctx.fillStyle = '#FFD700';
        const statsTitleSize = Math.max(18, Math.min(28, screenWidth * 0.07));
        context.ctx.font = `bold ${statsTitleSize}px Doto`;
        this.drawCachedTextSprite('MATCH STATISTICS', screenWidth / 2, panelY + 50, { font: `bold ${statsTitleSize}px Doto`, fillStyle: '#FFD700', textAlign: 'center', textBaseline: 'alphabetic' }, context);

        const statsFontSize = Math.max(14, Math.min(20, screenWidth * 0.045));
        context.ctx.font = `${statsFontSize}px Doto`;
        let y = panelY + 100;
        const horizontalPadding = 24;
        const labelColumnWidth = Math.max(100, Math.min(200, panelWidth * 0.4));
        const playerCount = game.players.length;
        const availablePlayerWidth = panelWidth - horizontalPadding * 2 - labelColumnWidth;
        const playerColumnWidth = Math.max(50, availablePlayerWidth / playerCount);
        const leftCol = panelX + horizontalPadding;
        const playerStartX = leftCol + labelColumnWidth;

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.textAlign = 'left';
        this.drawCachedTextSprite('Statistic', leftCol, y, { font: `${statsFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
        context.ctx.textAlign = 'right';

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const color = getFactionColor(player.faction);
            context.ctx.fillStyle = color;
            const colX = playerStartX + playerColumnWidth * (i + 1);
            this.drawCachedTextSprite(player.name, colX, y, { font: `${statsFontSize}px Doto`, fillStyle: color, textAlign: 'right', textBaseline: 'alphabetic' }, context);
        }

        y += isCompactLayout ? 32 : 40;

        const stats = [
            { label: 'Units Created', key: 'unitsCreated' },
            { label: 'Units Lost', key: 'unitsLost' },
            { label: 'Energy Gathered', key: 'energyGathered' }
        ];

        for (const stat of stats) {
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.textAlign = 'left';
            this.drawCachedTextSprite(stat.label, leftCol, y, { font: `${statsFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'left', textBaseline: 'alphabetic' }, context);
            context.ctx.textAlign = 'right';

            for (let i = 0; i < game.players.length; i++) {
                const player = game.players[i] as any;
                const value = stat.key === 'energyGathered' ? Math.round(player[stat.key]) : player[stat.key];
                const colX = playerStartX + playerColumnWidth * (i + 1);
                this.drawCachedTextSprite(String(value), colX, y, { font: `${statsFontSize}px Doto`, fillStyle: '#FFFFFF', textAlign: 'right', textBaseline: 'alphabetic' }, context);
            }

            y += isCompactLayout ? 28 : 35;
        }

        const buttonWidth = Math.min(300, screenWidth - 60);
        const buttonHeight = isCompactLayout ? 50 : 60;
        const buttonX = (screenWidth - buttonWidth) / 2;
        const buttonY = Math.min(panelY + panelHeight + 30, screenHeight - buttonHeight - 20);

        context.ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
        context.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 3;
        context.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.font = `bold ${isCompactLayout ? 20 : 24}px Doto`;
        context.ctx.textAlign = 'center';
        this.drawCachedTextSprite('Continue', screenWidth / 2, buttonY + (buttonHeight * 0.65), { font: `bold ${isCompactLayout ? 20 : 24}px Doto`, fillStyle: '#FFFFFF', textAlign: 'center', textBaseline: 'alphabetic' }, context);

        context.ctx.textAlign = 'left';
    }

    public drawBorderFade(mapSize: number, context: HUDRendererContext): void {
        const screenWidth = getCanvasScreenWidthPx(context.canvas);
        const screenHeight = getCanvasScreenHeightPx(context.canvas);

        const fadeZoneWidth = 150;
        const halfMapSize = mapSize / 2;

        const topLeft = context.worldToScreen(new Vector2D(-halfMapSize, -halfMapSize));
        const topRight = context.worldToScreen(new Vector2D(halfMapSize, -halfMapSize));
        const bottomLeft = context.worldToScreen(new Vector2D(-halfMapSize, halfMapSize));

        const fadeStartLeft = context.worldToScreen(new Vector2D(-halfMapSize + fadeZoneWidth, 0));
        const fadeStartTop = context.worldToScreen(new Vector2D(0, -halfMapSize + fadeZoneWidth));

        const fadeWidthX = Math.abs(fadeStartLeft.x - topLeft.x);
        const fadeWidthY = Math.abs(fadeStartTop.y - topLeft.y);

        context.ctx.save();

        if (topLeft.x < screenWidth) {
            const gradient = context.ctx.createLinearGradient(topLeft.x, 0, topLeft.x + fadeWidthX, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.fillRect(0, 0, topLeft.x + fadeWidthX, screenHeight);
        }

        if (topRight.x > 0) {
            const gradient = context.ctx.createLinearGradient(topRight.x, 0, topRight.x - fadeWidthX, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.fillRect(topRight.x - fadeWidthX, 0, screenWidth - (topRight.x - fadeWidthX), screenHeight);
        }

        if (topLeft.y < screenHeight) {
            const gradient = context.ctx.createLinearGradient(0, topLeft.y, 0, topLeft.y + fadeWidthY);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.fillRect(0, 0, screenWidth, topLeft.y + fadeWidthY);
        }

        if (bottomLeft.y > 0) {
            const gradient = context.ctx.createLinearGradient(0, bottomLeft.y, 0, bottomLeft.y - fadeWidthY);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.fillRect(0, bottomLeft.y - fadeWidthY, screenWidth, screenHeight - (bottomLeft.y - fadeWidthY));
        }

        context.ctx.restore();
    }

    private drawProgressBar(x: number, y: number, width: number, height: number, progress: number, context: HUDRendererContext): void {
        context.ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        context.ctx.fillRect(x, y, width, height);

        context.ctx.fillStyle = '#4CAF50';
        context.ctx.fillRect(x, y, width * progress, height);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 1;
        context.ctx.strokeRect(x, y, width, height);

        this.drawCachedTextSprite(
            `${Math.floor(progress * 100)}%`,
            x + width / 2,
            y + height / 2,
            {
                font: 'bold 12px Doto',
                fillStyle: '#FFFFFF',
                textAlign: 'center',
                textBaseline: 'middle'
            },
            context
        );
    }

    private drawProductionEntry(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        progress: number,
        context: HUDRendererContext
    ): void {
        const sizeScale = context.infoBoxSize;
        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        context.ctx.fillRect(x, y, width, height);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(x, y, width, height);

        const fontSize = Math.round(14 * sizeScale);
        this.drawCachedTextSprite(
            label,
            x + 8 * sizeScale,
            y + 8 * sizeScale,
            {
                font: `bold ${fontSize}px Doto`,
                fillStyle: '#FFFFFF',
                textAlign: 'left',
                textBaseline: 'top'
            },
            context
        );

        this.drawProgressBar(x + 8 * sizeScale, y + 32 * sizeScale, width - 16 * sizeScale, 16 * sizeScale, progress, context);
    }

    private drawCachedTextSprite(
        text: string,
        x: number,
        y: number,
        options: {
            font: string;
            fillStyle: string;
            strokeStyle?: string;
            lineWidth?: number;
            textAlign?: CanvasTextAlign;
            textBaseline?: CanvasTextBaseline;
        },
        context: HUDRendererContext
    ): void {
        const renderScale = this.getTextRenderScale(context);
        const sprite = this.getCachedTextSprite(
            text,
            options.font,
            options.fillStyle,
            options.strokeStyle,
            options.lineWidth ?? 0,
            renderScale
        );

        const spriteWidth = sprite.width / sprite.renderScale;
        const spriteHeight = sprite.height / sprite.renderScale;
        const baselineOffset = sprite.alphabeticBaselineOffsetPx / sprite.renderScale;

        let drawX = x;
        let drawY = y;

        switch (options.textAlign) {
            case 'center':
                drawX -= spriteWidth / 2;
                break;
            case 'right':
            case 'end':
                drawX -= spriteWidth;
                break;
            case 'left':
            case 'start':
            default:
                break;
        }

        switch (options.textBaseline) {
            case 'middle':
                drawY -= spriteHeight / 2;
                break;
            case 'bottom':
            case 'ideographic':
                drawY -= spriteHeight;
                break;
            case 'top':
            case 'hanging':
                break;
            case 'alphabetic':
                drawY -= baselineOffset;
                break;
            default:
                break;
        }

        context.ctx.drawImage(sprite.canvas, drawX, drawY, spriteWidth, spriteHeight);
    }

    private getCachedTextWidth(text: string, font: string): number {
        const cacheKey = `${font}|${text}`;
        const cachedWidth = this.cachedTextWidths.get(cacheKey);
        if (cachedWidth !== undefined) {
            return cachedWidth;
        }

        if (!this.textMeasureContext) {
            return text.length * 8;
        }

        this.textMeasureContext.font = font;
        const width = this.textMeasureContext.measureText(text).width;
        this.cachedTextWidths.set(cacheKey, width);
        if (this.cachedTextWidths.size > HUDRenderer.MAX_TEXT_SPRITE_CACHE_ENTRY_COUNT) {
            this.cachedTextWidths.clear();
        }
        return width;
    }

    private getCachedTextSprite(
        text: string,
        font: string,
        fillStyle: string,
        strokeStyle?: string,
        lineWidth: number = 0,
        renderScale: number = 1
    ): CachedTextSprite {
        const scaleBucket = Math.round(renderScale * 100) / 100;
        const cacheKey = `${font}|${fillStyle}|${strokeStyle ?? ''}|${lineWidth}|${scaleBucket}|${text}`;
        const cached = this.cachedTextSprites.get(cacheKey);
        if (cached) {
            return cached;
        }

        const measureContext = this.textMeasureContext;
        if (!measureContext) {
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = 1;
            fallbackCanvas.height = 1;
            return { canvas: fallbackCanvas, width: 1, height: 1, alphabeticBaselineOffsetPx: 0, renderScale: scaleBucket };
        }

        measureContext.font = font;
        measureContext.textAlign = 'left';
        measureContext.textBaseline = 'alphabetic';
        const metrics = measureContext.measureText(text);
        // Keep at least a small border around the cached glyph, while expanding further
        // when stroke width increases so outlines do not clip against the sprite edges.
        const paddingPx = Math.max(
            HUDRenderer.MIN_TEXT_SPRITE_PADDING_PX,
            Math.ceil(lineWidth * HUDRenderer.TEXT_SPRITE_STROKE_PADDING_MULTIPLIER + HUDRenderer.TEXT_SPRITE_BASE_PADDING_PX)
        );
        const fontSizePx = this.getFontSizePx(font);
        const leftPx = Math.ceil(metrics.actualBoundingBoxLeft || 0);
        const rightPx = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
        const ascentPx = Math.ceil(metrics.actualBoundingBoxAscent || fontSizePx);
        const descentPx = Math.ceil(metrics.actualBoundingBoxDescent || Math.max(2, fontSizePx * 0.3));
        const width = Math.max(1, Math.ceil((leftPx + rightPx + paddingPx * 2) * scaleBucket));
        const height = Math.max(1, Math.ceil((ascentPx + descentPx + paddingPx * 2) * scaleBucket));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { canvas, width, height, alphabeticBaselineOffsetPx: (paddingPx + ascentPx) * scaleBucket, renderScale: scaleBucket };
        }

        ctx.setTransform(scaleBucket, 0, 0, scaleBucket, 0, 0);
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const drawX = paddingPx + leftPx;
        const drawY = paddingPx + ascentPx;

        if (strokeStyle && lineWidth > 0) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.strokeText(text, drawX, drawY);
        }

        ctx.fillStyle = fillStyle;
        ctx.fillText(text, drawX, drawY);

        const sprite = { canvas, width, height, alphabeticBaselineOffsetPx: drawY * scaleBucket, renderScale: scaleBucket };
        this.cachedTextSprites.set(cacheKey, sprite);
        if (this.cachedTextSprites.size > HUDRenderer.MAX_TEXT_SPRITE_CACHE_ENTRY_COUNT) {
            this.cachedTextSprites.clear();
        }
        return sprite;
    }

    private getFontSizePx(font: string): number {
        const match = font.match(/(\d+(?:\.\d+)?)px/);
        return match ? Number(match[1]) : 14;
    }

    private getHealthColor(healthPercent: number): {r: number, g: number, b: number} {
        if (healthPercent > 0.6) {
            const t = (healthPercent - 0.6) / 0.4;
            return {
                r: Math.round(255 * (1 - t)),
                g: 255,
                b: 0
            };
        } else if (healthPercent > 0.3) {
            const t = (healthPercent - 0.3) / 0.3;
            return {
                r: 255,
                g: Math.round(165 + 90 * t),
                b: 0
            };
        } else {
            const t = healthPercent / 0.3;
            return {
                r: Math.round(180 + 75 * t),
                g: Math.round(165 * t),
                b: 0
            };
        }
    }

    private isOffScreen(worldPos: Vector2D, context: HUDRendererContext): boolean {
        const screenPos = context.worldToScreen(worldPos);
        const screenWidth = getCanvasScreenWidthPx(context.canvas);
        const screenHeight = getCanvasScreenHeightPx(context.canvas);

        return screenPos.x < 0 || screenPos.x > screenWidth ||
               screenPos.y < 0 || screenPos.y > screenHeight;
    }

    private getEdgePosition(worldPos: Vector2D, _indicatorSize: number, context: HUDRendererContext): {x: number, y: number, angle: number} {
        const screenPos = context.worldToScreen(worldPos);
        const screenWidth = getCanvasScreenWidthPx(context.canvas);
        const screenHeight = getCanvasScreenHeightPx(context.canvas);
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;

        const dx = screenPos.x - centerX;
        const dy = screenPos.y - centerY;
        const angle = Math.atan2(dy, dx);

        let edgeX = screenPos.x;
        let edgeY = screenPos.y;

        if (screenPos.x < 0) {
            edgeX = 0;
        } else if (screenPos.x > screenWidth) {
            edgeX = screenWidth;
        }

        if (screenPos.y < 0) {
            edgeY = 0;
        } else if (screenPos.y > screenHeight) {
            edgeY = screenHeight;
        }

        return { x: edgeX, y: edgeY, angle };
    }

}
