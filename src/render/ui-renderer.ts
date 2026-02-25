/**
 * UIRenderer - Handles all UI overlay rendering (selection, arrows, effects, HUD, menus)
 */

import {
    Vector2D, Player, StellarForge, SubsidiaryFactory, Building, Unit, Starling,
    GatlingTower, Minigun, SpaceDustSwirler, StrikerTower, LockOnLaserTower, ShieldTower
} from '../game-core';
import { GameState } from '../game-core';
import * as Constants from '../constants';
import { getInGameMenuLayout, getGraphicsMenuMaxScroll, InGameMenuTab, InGameMenuAction, RenderLayerKey } from './in-game-menu';
import { getFactionColor } from './faction-utilities';
import { InGameMenuRenderer } from './in-game-menu-renderer';

export interface UIRendererContext {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    zoom: number;

    selectionStart: Vector2D | null;
    selectionEnd: Vector2D | null;
    abilityArrowStarts: Vector2D[];
    abilityArrowDirection: Vector2D | null;
    abilityArrowLengthPx: number;
    buildingAbilityArrowStart: Vector2D | null;
    buildingAbilityArrowDirection: Vector2D | null;
    buildingAbilityArrowLengthPx: number;

    pathPreviewForge: StellarForge | null;
    pathPreviewPoints: Vector2D[];
    pathPreviewEnd: Vector2D | null;
    pathPreviewStartWorld: Vector2D | null;
    selectedUnits: Set<Unit>;
    selectedMirrors: Set<any>;
    highlightedButtonIndex: number;

    showInfo: boolean;
    showInGameMenu: boolean;
    inGameMenuTab: InGameMenuTab;
    damageDisplayMode: 'damage' | 'remaining-life';
    healthDisplayMode: 'bar' | 'number';
    offscreenIndicatorOpacity: number;
    infoBoxOpacity: number;
    playerColor: string;
    enemyColor: string;
    colorblindMode: boolean;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isFancyGraphicsEnabled: boolean;
    screenShakeEnabled: boolean;
    soundVolume: number;
    musicVolume: number;

    graphicsMenuScrollOffset: number;
    renderLayerOptions: Array<{ key: RenderLayerKey; label: string }>;
    isSunsLayerEnabled: boolean;
    isStarsLayerEnabled: boolean;
    isAsteroidsLayerEnabled: boolean;
    isSpaceDustLayerEnabled: boolean;
    isBuildingsLayerEnabled: boolean;
    isUnitsLayerEnabled: boolean;
    isProjectilesLayerEnabled: boolean;

    worldToScreen(worldPos: Vector2D): Vector2D;
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;
    getLadPlayerColor(player: Player, ladSun: any, game: GameState): string;
    getSolEnergyIcon(): HTMLImageElement;
    getProductionDisplayName(unitType: string): string;
    getBuildingDisplayName(building: Building): string;
    viewingPlayer: Player | null;

    CONTROL_LINES_FULL: string[];
    CONTROL_LINES_COMPACT: string[];
}

export class UIRenderer {
    private tapEffects: Array<{position: Vector2D, progress: number}> = [];
    private swipeEffects: Array<{start: Vector2D, end: Vector2D, progress: number}> = [];
    private warpGateShockwaves: Array<{position: Vector2D, progress: number}> = [];
    private productionButtonWaves: Array<{position: Vector2D, progress: number}> = [];
    private pathCommitEffects: Array<{pointsWorld: Vector2D[], startTimeSec: number, durationSec: number}> = [];
    private buildingAbilityArrowAngle: number = 0;
    private readonly menuRenderer = new InGameMenuRenderer();

    public setBuildingAbilityArrowDirection(direction: Vector2D | null, _context: UIRendererContext): void {
        if (direction) {
            // Cache angle calculation to avoid expensive Math.atan2 every frame
            this.buildingAbilityArrowAngle = Math.atan2(direction.y, direction.x);
        }
    }

    public createTapEffect(screenX: number, screenY: number): void {
        this.tapEffects.push({
            position: new Vector2D(screenX, screenY),
            progress: 0
        });
    }

    public createSwipeEffect(startX: number, startY: number, endX: number, endY: number): void {
        this.swipeEffects.push({
            start: new Vector2D(startX, startY),
            end: new Vector2D(endX, endY),
            progress: 0
        });
    }

    public createWarpGateShockwave(position: Vector2D): void {
        this.warpGateShockwaves.push({
            position: new Vector2D(position.x, position.y),
            progress: 0
        });
    }

    public createProductionButtonWave(position: Vector2D): void {
        this.productionButtonWaves.push({
            position: new Vector2D(position.x, position.y),
            progress: 0
        });
    }

    public createPathCommitEffect(startWorld: Vector2D, waypoints: Vector2D[], gameTimeSec: number): void {
        const pointsWorld: Vector2D[] = [new Vector2D(startWorld.x, startWorld.y)];
        for (const waypoint of waypoints) {
            pointsWorld.push(new Vector2D(waypoint.x, waypoint.y));
        }
        if (pointsWorld.length < 2) {
            return;
        }
        this.pathCommitEffects.push({
            pointsWorld,
            startTimeSec: gameTimeSec,
            durationSec: 1.1
        });
    }

    public drawSelectionRectangle(context: UIRendererContext): void {
        if (!context.selectionStart || !context.selectionEnd) return;

        const x = Math.min(context.selectionStart.x, context.selectionEnd.x);
        const y = Math.min(context.selectionStart.y, context.selectionEnd.y);
        const width = Math.abs(context.selectionEnd.x - context.selectionStart.x);
        const height = Math.abs(context.selectionEnd.y - context.selectionStart.y);

        context.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        context.ctx.lineWidth = 2;
        context.ctx.setLineDash([5, 5]);
        context.ctx.strokeRect(x, y, width, height);

        context.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        context.ctx.fillRect(x, y, width, height);

        context.ctx.setLineDash([]);
    }

    public drawAbilityArrow(context: UIRendererContext): void {
        if (!context.abilityArrowDirection || context.abilityArrowStarts.length === 0) return;

        context.ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
        context.ctx.lineWidth = 4;
        context.ctx.setLineDash([]);
        const arrowLengthPx = context.abilityArrowLengthPx;
        for (const abilityArrowStart of context.abilityArrowStarts) {
            const length = arrowLengthPx;

            if (length < Constants.ABILITY_ARROW_MIN_LENGTH) {
                continue;
            }

            const arrowEndX = abilityArrowStart.x + context.abilityArrowDirection.x * length;
            const arrowEndY = abilityArrowStart.y + context.abilityArrowDirection.y * length;

            context.ctx.beginPath();
            context.ctx.moveTo(abilityArrowStart.x, abilityArrowStart.y);
            context.ctx.lineTo(arrowEndX, arrowEndY);
            context.ctx.stroke();

            const angle = Math.atan2(context.abilityArrowDirection.y, context.abilityArrowDirection.x);
            const arrowHeadLength = 20;
            const arrowHeadAngle = Math.PI / 6;

            context.ctx.beginPath();
            context.ctx.moveTo(arrowEndX, arrowEndY);
            context.ctx.lineTo(
                arrowEndX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
                arrowEndY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
            );
            context.ctx.lineTo(
                arrowEndX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
                arrowEndY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
            );
            context.ctx.closePath();
            context.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
            context.ctx.fill();

            context.ctx.beginPath();
            context.ctx.arc(abilityArrowStart.x, abilityArrowStart.y, 8, 0, Math.PI * 2);
            context.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
            context.ctx.fill();
        }
    }

    public drawBuildingAbilityArrow(context: UIRendererContext): void {
        if (!context.buildingAbilityArrowDirection || !context.buildingAbilityArrowStart) return;

        const length = context.buildingAbilityArrowLengthPx;

        if (length < Constants.ABILITY_ARROW_MIN_LENGTH) {
            return;
        }

        const arrowEndX = context.buildingAbilityArrowStart.x + context.buildingAbilityArrowDirection.x * length;
        const arrowEndY = context.buildingAbilityArrowStart.y + context.buildingAbilityArrowDirection.y * length;

        context.ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
        context.ctx.lineWidth = 4;
        context.ctx.setLineDash([]);
        context.ctx.beginPath();
        context.ctx.moveTo(context.buildingAbilityArrowStart.x, context.buildingAbilityArrowStart.y);
        context.ctx.lineTo(arrowEndX, arrowEndY);
        context.ctx.stroke();

        // Use cached angle (set by setBuildingAbilityArrowDirection)
        const angle = this.buildingAbilityArrowAngle;
        const arrowHeadLength = 20;
        const arrowHeadAngle = Math.PI / 6;

        context.ctx.beginPath();
        context.ctx.moveTo(arrowEndX, arrowEndY);
        context.ctx.lineTo(
            arrowEndX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
            arrowEndY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        context.ctx.lineTo(
            arrowEndX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
            arrowEndY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        context.ctx.closePath();
        context.ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
        context.ctx.fill();

        context.ctx.beginPath();
        context.ctx.arc(context.buildingAbilityArrowStart.x, context.buildingAbilityArrowStart.y, 8, 0, Math.PI * 2);
        context.ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
        context.ctx.fill();
    }

    public drawUnitPathPreview(context: UIRendererContext): void {
        if (!context.pathPreviewForge && context.pathPreviewPoints.length > 0) {
            let avgX = 0;
            let avgY = 0;
            let count = 0;

            if (context.selectedUnits.size > 0) {
                for (const unit of context.selectedUnits) {
                    avgX += unit.position.x;
                    avgY += unit.position.y;
                    count++;
                }
            } else if (context.selectedMirrors.size > 0) {
                for (const mirror of context.selectedMirrors) {
                    avgX += mirror.position.x;
                    avgY += mirror.position.y;
                    count++;
                }
            }

            if (count > 0) {
                const startWorld = new Vector2D(avgX / count, avgY / count);
                this.drawMinionPathPreview(startWorld, context.pathPreviewPoints, context.pathPreviewEnd, context);
            } else if (context.pathPreviewStartWorld) {
                this.drawMinionPathPreview(context.pathPreviewStartWorld, context.pathPreviewPoints, context.pathPreviewEnd, context);
            }
        }
    }

    public updateAndDrawPathCommitEffects(gameTimeSec: number, context: UIRendererContext): void {
        if (this.pathCommitEffects.length === 0) {
            return;
        }

        this.pathCommitEffects = this.pathCommitEffects.filter((effect) => {
            const ageSec = gameTimeSec - effect.startTimeSec;
            const progress = ageSec / effect.durationSec;
            if (progress >= 1) {
                return false;
            }

            const alpha = Math.max(0, 1 - progress);
            const pathPointsScreen = effect.pointsWorld.map((point) => context.worldToScreen(point));

            context.ctx.save();
            context.ctx.lineWidth = 2.5;
            context.ctx.strokeStyle = `rgba(255, 225, 120, ${0.55 * alpha})`;
            context.ctx.setLineDash([14, 10]);
            context.ctx.lineDashOffset = -progress * 80;
            context.ctx.beginPath();
            context.ctx.moveTo(pathPointsScreen[0].x, pathPointsScreen[0].y);
            for (let i = 1; i < pathPointsScreen.length; i++) {
                context.ctx.lineTo(pathPointsScreen[i].x, pathPointsScreen[i].y);
            }
            context.ctx.stroke();
            context.ctx.restore();

            return true;
        });
    }

    public updateAndDrawTapEffects(context: UIRendererContext): void {
        for (let i = this.tapEffects.length - 1; i >= 0; i--) {
            const effect = this.tapEffects[i];
            effect.progress += Constants.TAP_EFFECT_SPEED;

            if (effect.progress >= 1) {
                this.tapEffects.splice(i, 1);
                continue;
            }

            const radius = Constants.TAP_EFFECT_MAX_RADIUS * effect.progress;
            const alpha = 1 - effect.progress;

            context.ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
            context.ctx.lineWidth = 3;
            context.ctx.beginPath();
            context.ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
            context.ctx.stroke();

            const gradient = context.ctx.createRadialGradient(
                effect.position.x, effect.position.y, 0,
                effect.position.x, effect.position.y, radius * 0.5
            );
            gradient.addColorStop(0, `rgba(100, 200, 255, ${alpha * 0.5})`);
            gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.beginPath();
            context.ctx.arc(effect.position.x, effect.position.y, radius * 0.5, 0, Math.PI * 2);
            context.ctx.fill();
        }
    }

    public updateAndDrawSwipeEffects(context: UIRendererContext): void {
        for (let i = this.swipeEffects.length - 1; i >= 0; i--) {
            const effect = this.swipeEffects[i];
            effect.progress += Constants.SWIPE_EFFECT_SPEED;

            if (effect.progress >= 1) {
                this.swipeEffects.splice(i, 1);
                continue;
            }

            const dx = effect.end.x - effect.start.x;
            const dy = effect.end.y - effect.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length < 5) continue;

            const alpha = 1 - effect.progress;
            const currentLength = length * effect.progress;

            context.ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.7})`;
            context.ctx.lineWidth = 4;
            context.ctx.lineCap = 'round';
            context.ctx.beginPath();
            context.ctx.moveTo(effect.start.x, effect.start.y);
            const endX = effect.start.x + (dx / length) * currentLength;
            const endY = effect.start.y + (dy / length) * currentLength;
            context.ctx.lineTo(endX, endY);
            context.ctx.stroke();

            if (effect.progress > 0.3) {
                const angle = Math.atan2(dy, dx);

                context.ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
                context.ctx.beginPath();
                context.ctx.moveTo(endX, endY);
                context.ctx.lineTo(
                    endX - Constants.SWIPE_ARROW_SIZE * Math.cos(angle - Math.PI / 6),
                    endY - Constants.SWIPE_ARROW_SIZE * Math.sin(angle - Math.PI / 6)
                );
                context.ctx.lineTo(
                    endX - Constants.SWIPE_ARROW_SIZE * Math.cos(angle + Math.PI / 6),
                    endY - Constants.SWIPE_ARROW_SIZE * Math.sin(angle + Math.PI / 6)
                );
                context.ctx.closePath();
                context.ctx.fill();
            }

            for (let j = 0; j < 5; j++) {
                const t = j / 5;
                const px = effect.start.x + (dx / length) * currentLength * t;
                const py = effect.start.y + (dy / length) * currentLength * t;
                const glowAlpha = alpha * (1 - t) * 0.3;

                const gradient = context.ctx.createRadialGradient(px, py, 0, px, py, 10);
                gradient.addColorStop(0, `rgba(255, 200, 100, ${glowAlpha})`);
                gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
                context.ctx.fillStyle = gradient;
                context.ctx.beginPath();
                context.ctx.arc(px, py, 10, 0, Math.PI * 2);
                context.ctx.fill();
            }
        }
    }

    public updateAndDrawWarpGateShockwaves(context: UIRendererContext): void {
        for (let i = this.warpGateShockwaves.length - 1; i >= 0; i--) {
            const effect = this.warpGateShockwaves[i];
            effect.progress += Constants.WARP_GATE_SHOCKWAVE_PROGRESS_PER_FRAME;

            if (effect.progress >= 1) {
                this.warpGateShockwaves.splice(i, 1);
                continue;
            }

            const screenPos = context.worldToScreen(effect.position);
            const radius = Constants.WARP_GATE_SHOCKWAVE_MAX_RADIUS_PX * effect.progress * context.zoom;
            const alpha = (1 - effect.progress) * 0.8;

            context.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            context.ctx.lineWidth = Math.max(2, 3 * context.zoom);
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.stroke();
        }
    }

    public updateAndDrawProductionButtonWaves(context: UIRendererContext): void {
        for (let i = this.productionButtonWaves.length - 1; i >= 0; i--) {
            const effect = this.productionButtonWaves[i];
            effect.progress += Constants.PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME;

            if (effect.progress >= 1) {
                this.productionButtonWaves.splice(i, 1);
                continue;
            }

            const screenPos = context.worldToScreen(effect.position);
            const radius = Constants.PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX * effect.progress * context.zoom;
            const alpha = (1 - effect.progress) * 0.9;

            context.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
            context.ctx.lineWidth = Math.max(1, 2 * context.zoom);
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            context.ctx.stroke();

            const gradient = context.ctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, radius
            );
            gradient.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.35})`);
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            context.ctx.fillStyle = gradient;
            context.ctx.beginPath();
            context.ctx.arc(screenPos.x, screenPos.y, radius * 0.6, 0, Math.PI * 2);
            context.ctx.fill();
        }
    }

    public drawDamageNumbers(game: GameState, context: UIRendererContext): void {
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
            context.ctx.fillStyle = damageNumber.textColor;
            context.ctx.globalAlpha = opacity;

            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'middle';

            context.ctx.strokeStyle = '#FFFFFF';
            context.ctx.lineWidth = 1.5;
            context.ctx.strokeText(displayText, screenPos.x, screenPos.y);
            context.ctx.fillText(displayText, screenPos.x, screenPos.y);
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
        context?: UIRendererContext
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
            context.ctx.fillStyle = `rgb(${healthColor.r}, ${healthColor.g}, ${healthColor.b})`;
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'bottom';

            context.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            context.ctx.lineWidth = 2;
            context.ctx.strokeText(Math.round(currentHealth).toString(), screenPos.x, screenPos.y + yOffset);
            context.ctx.fillText(Math.round(currentHealth).toString(), screenPos.x, screenPos.y + yOffset);

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

    public drawOffScreenUnitIndicators(game: GameState, context: UIRendererContext): void {
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

    public drawUI(game: GameState, context: UIRendererContext): void {
        if (context.showInfo) {
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = context.canvas.width / dpr;
            const screenHeight = context.canvas.height / dpr;
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
            context.ctx.fillText(`SoL - Speed of Light RTS`, 20, infoY);
            infoY += infoLineHeight;
            context.ctx.fillText(`Game Time: ${game.gameTime.toFixed(1)}s`, 20, infoY);
            infoY += infoLineHeight;
            context.ctx.fillText(`Dust Particles: ${game.spaceDust.length}`, 20, infoY);
            infoY += infoLineHeight;
            context.ctx.fillText(`Asteroids: ${game.asteroids.length}`, 20, infoY);
            infoY += infoLineHeight;
            context.ctx.fillText(`Warp Gates: ${game.warpGates.length}`, 20, infoY);

            let y = infoY + infoLineHeight;
            for (const player of game.players) {
                const color = getFactionColor(player.faction);
                context.ctx.fillStyle = color;
                context.ctx.fillText(`${player.name} (${player.faction})`, 20, y);
                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.fillText(`Energy: ${player.energy.toFixed(1)}`, 20, y + 20);

                if (player.stellarForge) {
                    const status = player.stellarForge.isReceivingLight ? '✓ Light' : '✗ No Light';
                    context.ctx.fillText(`${status} | HP: ${player.stellarForge.health.toFixed(0)}`, 20, y + 40);
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
                context.ctx.fillText(line, 20, controlTextY);
                controlTextY += controlLineHeight;
            }
        }
    }

    public drawMenuButton(context: UIRendererContext): void {
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

    public drawProductionProgress(game: GameState, context: UIRendererContext): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = context.canvas.width / dpr;
        const margin = 10;
        const productionBoxWidth = 200;
        const boxHeight = 60;
        const rightX = screenWidth - margin;
        let y = margin;

        const starlingSymbol = '✦';

        const player = game.players.find((p) => !p.isAi);
        if (!player) {
            return;
        }

        context.ctx.save();
        context.ctx.globalAlpha = context.infoBoxOpacity;

        const compactBoxHeight = 30;
        const compactTextPaddingLeft = 8;
        const compactTextPaddingRight = 8;
        const compactIconInset = 4;
        const compactIconSize = compactBoxHeight - compactIconInset * 2;
        context.ctx.font = 'bold 14px Doto';

        const compactTextWidths: number[] = [];
        if (player.stellarForge) {
            const energyText = `${player.stellarForge.incomingLightPerSec.toFixed(1)}/s`;
            compactTextWidths.push(
                compactTextPaddingLeft + compactIconSize + compactIconInset + context.ctx.measureText(energyText).width + compactTextPaddingRight
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
            compactTextPaddingLeft + context.ctx.measureText(starlingRateText).width + compactTextPaddingRight,
            compactTextPaddingLeft + context.ctx.measureText(maxStarlingsText).width + compactTextPaddingRight
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

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = 'bold 14px Doto';
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText(
                `${energyRate.toFixed(1)}/s`,
                compactX + compactTextPaddingLeft + compactIconSize + compactIconInset,
                y + compactBoxHeight / 2
            );

            y += compactBoxHeight + 5;
        }

        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        context.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.font = 'bold 14px Doto';
        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText(starlingRateText, compactX + compactTextPaddingLeft, y + compactBoxHeight / 2);

        y += compactBoxHeight + 5;

        context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
        context.ctx.fillRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 2;
        context.ctx.strokeRect(compactX, y, compactBoxWidth, compactBoxHeight);

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.font = 'bold 14px Doto';
        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText(maxStarlingsText, compactX + compactTextPaddingLeft, y + compactBoxHeight / 2);

        y += compactBoxHeight + 8;

        if (player.stellarForge && player.stellarForge.heroProductionUnitType) {
            const forge = player.stellarForge;

            context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            context.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.strokeStyle = '#FFD700';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = 'bold 14px Doto';
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'top';

            const productionName = context.getProductionDisplayName(forge.heroProductionUnitType!);
            context.ctx.fillText(productionName, productionX + 8, y + 8);

            const progress = forge.heroProductionDurationSec > 0
                ? 1 - (forge.heroProductionRemainingSec / forge.heroProductionDurationSec)
                : 0;

            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, progress, context);

            y += boxHeight + 8;
        }

        const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory) as SubsidiaryFactory | undefined;
        if (foundry?.currentProduction) {
            context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            context.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.strokeStyle = '#FFD700';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = 'bold 14px Doto';
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'top';

            const productionName = context.getProductionDisplayName(foundry.currentProduction);
            context.ctx.fillText(`Foundry ${productionName}`, productionX + 8, y + 8);

            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, foundry.productionProgress, context);

            y += boxHeight + 8;
        }

        const buildingInProgress = player.buildings.find((building) => !building.isComplete);
        if (buildingInProgress) {
            context.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            context.ctx.fillRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.strokeStyle = '#FFD700';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(productionX, y, productionBoxWidth, boxHeight);

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = 'bold 14px Doto';
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'top';

            const buildingName = context.getBuildingDisplayName(buildingInProgress);
            context.ctx.fillText(`Building ${buildingName}`, productionX + 8, y + 8);

            this.drawProgressBar(productionX + 8, y + 32, productionBoxWidth - 16, 16, buildingInProgress.buildProgress, context);
        }

        context.ctx.textAlign = 'left';
        context.ctx.textBaseline = 'alphabetic';
        context.ctx.restore();
    }

    public drawInGameMenuOverlay(context: UIRendererContext): void {
        this.menuRenderer.drawInGameMenuOverlay(context);
    }

    public drawEndGameStatsScreen(game: GameState, winner: Player, context: UIRendererContext): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = context.canvas.width / dpr;
        const screenHeight = context.canvas.height / dpr;
        const isCompactLayout = screenWidth < 700;
        const localPlayer = context.viewingPlayer;
        const didLocalPlayerWin = winner === localPlayer;

        context.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        context.ctx.fillRect(0, 0, screenWidth, screenHeight);

        context.ctx.fillStyle = didLocalPlayerWin ? '#4CAF50' : '#F44336';
        const victoryFontSize = Math.max(28, Math.min(48, screenWidth * 0.12));
        context.ctx.font = `bold ${victoryFontSize}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.fillText(didLocalPlayerWin ? 'VICTORY' : 'DEFEAT', screenWidth / 2, 80);

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
        context.ctx.fillText('MATCH STATISTICS', screenWidth / 2, panelY + 50);

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
        context.ctx.fillText('Statistic', leftCol, y);
        context.ctx.textAlign = 'right';

        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const color = getFactionColor(player.faction);
            context.ctx.fillStyle = color;
            const colX = playerStartX + playerColumnWidth * (i + 1);
            context.ctx.fillText(player.name, colX, y);
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
            context.ctx.fillText(stat.label, leftCol, y);
            context.ctx.textAlign = 'right';

            for (let i = 0; i < game.players.length; i++) {
                const player = game.players[i] as any;
                const value = stat.key === 'energyGathered' ? Math.round(player[stat.key]) : player[stat.key];
                const colX = playerStartX + playerColumnWidth * (i + 1);
                context.ctx.fillText(String(value), colX, y);
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
        context.ctx.fillText('Continue', screenWidth / 2, buttonY + (buttonHeight * 0.65));

        context.ctx.textAlign = 'left';
    }

    public drawBorderFade(mapSize: number, context: UIRendererContext): void {
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = context.canvas.width / dpr;
        const screenHeight = context.canvas.height / dpr;

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

    public handleInGameMenuScroll(
        context: UIRendererContext,
        screenX: number,
        screenY: number,
        deltaY: number
    ): { consumed: boolean; newScrollOffset: number } {
        return this.menuRenderer.handleInGameMenuScroll(context, screenX, screenY, deltaY);
    }

    public getInGameMenuAction(
        context: UIRendererContext,
        screenX: number,
        screenY: number
    ): InGameMenuAction | null {
        return this.menuRenderer.getInGameMenuAction(context, screenX, screenY);
    }





    private drawMinionPathPreview(
        startWorld: Vector2D,
        waypoints: Vector2D[],
        endWorld: Vector2D | null,
        context: UIRendererContext
    ): void {
        context.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
        context.ctx.lineWidth = 3;
        context.ctx.setLineDash([6, 6]);
        context.ctx.beginPath();

        const startScreen = context.worldToScreen(startWorld);
        context.ctx.moveTo(startScreen.x, startScreen.y);

        for (let i = 0; i < waypoints.length; i++) {
            const waypointScreen = context.worldToScreen(waypoints[i]);
            context.ctx.lineTo(waypointScreen.x, waypointScreen.y);
        }

        if (endWorld) {
            const endScreen = context.worldToScreen(endWorld);
            context.ctx.lineTo(endScreen.x, endScreen.y);
        }

        context.ctx.stroke();
        context.ctx.setLineDash([]);

        context.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        for (let i = 0; i < waypoints.length; i++) {
            const waypointScreen = context.worldToScreen(waypoints[i]);
            context.ctx.beginPath();
            context.ctx.arc(waypointScreen.x, waypointScreen.y, 4, 0, Math.PI * 2);
            context.ctx.fill();
        }

        if (endWorld) {
            const endScreen = context.worldToScreen(endWorld);
            context.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
            context.ctx.lineWidth = 2;
            context.ctx.beginPath();
            context.ctx.arc(endScreen.x, endScreen.y, 6, 0, Math.PI * 2);
            context.ctx.stroke();
        }
    }

    private drawProgressBar(x: number, y: number, width: number, height: number, progress: number, context: UIRendererContext): void {
        context.ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        context.ctx.fillRect(x, y, width, height);

        context.ctx.fillStyle = '#4CAF50';
        context.ctx.fillRect(x, y, width * progress, height);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 1;
        context.ctx.strokeRect(x, y, width, height);

        context.ctx.fillStyle = '#FFFFFF';
        context.ctx.font = 'bold 12px Doto';
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText(`${Math.floor(progress * 100)}%`, x + width / 2, y + height / 2);
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

    private isOffScreen(worldPos: Vector2D, context: UIRendererContext): boolean {
        const screenPos = context.worldToScreen(worldPos);
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = context.canvas.width / dpr;
        const screenHeight = context.canvas.height / dpr;

        return screenPos.x < 0 || screenPos.x > screenWidth ||
               screenPos.y < 0 || screenPos.y > screenHeight;
    }

    private getEdgePosition(worldPos: Vector2D, _indicatorSize: number, context: UIRendererContext): {x: number, y: number, angle: number} {
        const screenPos = context.worldToScreen(worldPos);
        const dpr = window.devicePixelRatio || 1;
        const screenWidth = context.canvas.width / dpr;
        const screenHeight = context.canvas.height / dpr;
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
