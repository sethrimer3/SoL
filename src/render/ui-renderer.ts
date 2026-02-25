/**
 * UIRenderer - Handles all UI overlay rendering (selection, arrows, effects, HUD, menus)
 */

import {
    Vector2D, Player, StellarForge, Unit, Building,
} from '../game-core';
import { GameState } from '../game-core';
import * as Constants from '../constants';
import { getInGameMenuLayout, getGraphicsMenuMaxScroll, InGameMenuTab, InGameMenuAction, RenderLayerKey } from './in-game-menu';
import { InGameMenuRenderer } from './in-game-menu-renderer';
import { HUDRenderer } from './hud-renderer';

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
    private readonly hudRenderer = new HUDRenderer();

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
        this.hudRenderer.drawDamageNumbers(game, context);
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
        this.hudRenderer.drawHealthDisplay(screenPos, currentHealth, maxHealth, size, yOffset, isRegenerating, playerColor, context);
    }

    public drawOffScreenUnitIndicators(game: GameState, context: UIRendererContext): void {
        this.hudRenderer.drawOffScreenUnitIndicators(game, context);
    }

    public drawUI(game: GameState, context: UIRendererContext): void {
        this.hudRenderer.drawUI(game, context);
    }

    public drawMenuButton(context: UIRendererContext): void {
        this.hudRenderer.drawMenuButton(context);
    }

    public drawProductionProgress(game: GameState, context: UIRendererContext): void {
        this.hudRenderer.drawProductionProgress(game, context);
    }

    public drawInGameMenuOverlay(context: UIRendererContext): void {
        this.menuRenderer.drawInGameMenuOverlay(context);
    }

    public drawEndGameStatsScreen(game: GameState, winner: Player, context: UIRendererContext): void {
        this.hudRenderer.drawEndGameStatsScreen(game, winner, context);
    }

    public drawBorderFade(mapSize: number, context: UIRendererContext): void {
        this.hudRenderer.drawBorderFade(mapSize, context);
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








}
