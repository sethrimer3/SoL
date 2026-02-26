/**
 * InGameMenuRenderer - Handles in-game menu overlay, action routing, and forge button rendering
 */

import {
    Vector2D, Player, StellarForge, Unit,
    Marine, Mothership, Grave, Ray, Nova, InfluenceBall, TurretDeployer, Driller,
    Dagger, Beam, Spotlight, Splendor, Mortar, Preist, Sly, Shadow, Chrono
} from '../game-core';
import * as Constants from '../constants';
import { getRadialButtonOffsets, getHeroUnitType, getHeroUnitCost } from './render-utilities';
import { getInGameMenuLayout, getGraphicsMenuMaxScroll, InGameMenuTab, InGameMenuAction, RenderLayerKey } from './in-game-menu';

export interface InGameMenuRendererContext {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    zoom: number;
    inGameMenuTab: InGameMenuTab;
    showInGameMenu: boolean;
    showInfo: boolean;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    damageDisplayMode: 'damage' | 'remaining-life';
    healthDisplayMode: 'bar' | 'number';
    isFancyGraphicsEnabled: boolean;
    colorblindMode: boolean;
    soundVolume: number;
    musicVolume: number;
    offscreenIndicatorOpacity: number;
    infoBoxOpacity: number;
    graphicsMenuScrollOffset: number;
    renderLayerOptions: Array<{ key: RenderLayerKey; label: string }>;
    isSunsLayerEnabled: boolean;
    isStarsLayerEnabled: boolean;
    isAsteroidsLayerEnabled: boolean;
    isSpaceDustLayerEnabled: boolean;
    isBuildingsLayerEnabled: boolean;
    isUnitsLayerEnabled: boolean;
    isProjectilesLayerEnabled: boolean;
    highlightedButtonIndex: number;
}

export class InGameMenuRenderer {
    public drawInGameMenuOverlay(context: InGameMenuRendererContext): void {
        const layout = getInGameMenuLayout(context.canvas.width, context.canvas.height);
        const screenWidth = layout.screenWidth;
        const screenHeight = layout.screenHeight;
        const isCompactLayout = layout.isCompactLayout;

        context.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.ctx.fillRect(0, 0, screenWidth, screenHeight);

        const panelWidth = layout.panelWidth;
        const panelHeight = layout.panelHeight;
        const panelX = layout.panelX;
        const panelY = layout.panelY;

        context.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        context.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        context.ctx.strokeStyle = '#FFD700';
        context.ctx.lineWidth = 3;
        context.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        context.ctx.fillStyle = '#FFD700';
        context.ctx.font = `bold ${isCompactLayout ? 22 : 30}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.fillText('GAME MENU', screenWidth / 2, layout.titleY);

        for (const tab of layout.tabs) {
            const isActive = context.inGameMenuTab === tab.tab;
            context.ctx.fillStyle = isActive ? 'rgba(255, 215, 0, 0.3)' : 'rgba(60, 60, 60, 0.9)';
            context.ctx.fillRect(tab.x, tab.y, tab.width, tab.height);
            context.ctx.strokeStyle = isActive ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(tab.x, tab.y, tab.width, tab.height);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            const tabLabel = tab.tab === 'main' ? 'Main' : tab.tab === 'options' ? 'Options' : 'Graphics';
            context.ctx.fillText(tabLabel, tab.x + tab.width / 2, tab.y + tab.height * 0.68);
        }

        if (context.inGameMenuTab === 'main') {
            let buttonY = layout.contentTopY;
            const buttonWidth = layout.buttonWidth;
            const buttonHeight = layout.buttonHeight;
            const buttonX = layout.buttonX;
            const buttonSpacing = layout.buttonSpacing;

            const drawButton = (label: string, y: number) => {
                context.ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
                context.ctx.fillRect(buttonX, y, buttonWidth, buttonHeight);
                context.ctx.strokeStyle = '#FFFFFF';
                context.ctx.lineWidth = 2;
                context.ctx.strokeRect(buttonX, y, buttonWidth, buttonHeight);
                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `${isCompactLayout ? 18 : 20}px Doto`;
                context.ctx.fillText(label, screenWidth / 2, y + (buttonHeight * 0.65));
            };

            drawButton('Resume', buttonY);
            buttonY += buttonHeight + buttonSpacing;
            drawButton(context.showInfo ? 'Hide Info' : 'Show Info', buttonY);
            buttonY += buttonHeight + buttonSpacing;
            drawButton('Surrender', buttonY);
        } else if (context.inGameMenuTab === 'options') {
            let optionY = layout.contentTopY;
            const optionHeight = layout.buttonHeight;
            const optionSpacing = layout.buttonSpacing;
            const optionX = layout.buttonX;
            const optionWidth = layout.buttonWidth;

            context.ctx.fillStyle = '#AAAAAA';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'left';
            context.ctx.fillText('Damage Display:', optionX, optionY + (optionHeight * 0.4));

            const damageButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isDamageMode = context.damageDisplayMode === 'damage';
            context.ctx.fillStyle = isDamageMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(damageButtons.button1X, optionY, damageButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isDamageMode ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(damageButtons.button1X, optionY, damageButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('Dmg #', damageButtons.button1X + damageButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isRemainingMode = context.damageDisplayMode === 'remaining-life';
            context.ctx.fillStyle = isRemainingMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(damageButtons.button2X, optionY, damageButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isRemainingMode ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(damageButtons.button2X, optionY, damageButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('HP Left', damageButtons.button2X + damageButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            optionY += optionHeight + optionSpacing;

            context.ctx.fillStyle = '#AAAAAA';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'left';
            context.ctx.fillText('Health Display:', optionX, optionY + (optionHeight * 0.4));

            const healthButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isBarMode = context.healthDisplayMode === 'bar';
            context.ctx.fillStyle = isBarMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(healthButtons.button1X, optionY, healthButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isBarMode ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(healthButtons.button1X, optionY, healthButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('Bar', healthButtons.button1X + healthButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isNumberMode = context.healthDisplayMode === 'number';
            context.ctx.fillStyle = isNumberMode ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(healthButtons.button2X, optionY, healthButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isNumberMode ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(healthButtons.button2X, optionY, healthButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('Number', healthButtons.button2X + healthButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            optionY += optionHeight + optionSpacing;

            context.ctx.fillStyle = '#AAAAAA';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'left';
            context.ctx.fillText('Fancy Graphics:', optionX, optionY + (optionHeight * 0.4));

            const fancyButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isFancyOn = context.isFancyGraphicsEnabled;
            context.ctx.fillStyle = isFancyOn ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(fancyButtons.button1X, optionY, fancyButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isFancyOn ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(fancyButtons.button1X, optionY, fancyButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('On', fancyButtons.button1X + fancyButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isFancyOff = !context.isFancyGraphicsEnabled;
            context.ctx.fillStyle = isFancyOff ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(fancyButtons.button2X, optionY, fancyButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isFancyOff ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(fancyButtons.button2X, optionY, fancyButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('Off', fancyButtons.button2X + fancyButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            optionY += optionHeight + optionSpacing;

            context.ctx.fillStyle = '#AAAAAA';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'left';
            context.ctx.fillText('Colorblind Mode:', optionX, optionY + (optionHeight * 0.4));

            const colorblindButtons = {
                button1X: optionX + optionWidth - optionWidth * 0.35 * 2 - 10,
                button2X: optionX + optionWidth - optionWidth * 0.35,
                buttonWidth: optionWidth * 0.35
            };

            const isColorblindOn = context.colorblindMode;
            context.ctx.fillStyle = isColorblindOn ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(colorblindButtons.button1X, optionY, colorblindButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isColorblindOn ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(colorblindButtons.button1X, optionY, colorblindButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('On', colorblindButtons.button1X + colorblindButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            const isColorblindOff = !context.colorblindMode;
            context.ctx.fillStyle = isColorblindOff ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
            context.ctx.fillRect(colorblindButtons.button2X, optionY, colorblindButtons.buttonWidth, optionHeight);
            context.ctx.strokeStyle = isColorblindOff ? '#FFD700' : '#FFFFFF';
            context.ctx.lineWidth = 2;
            context.ctx.strokeRect(colorblindButtons.button2X, optionY, colorblindButtons.buttonWidth, optionHeight);
            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.fillText('Off', colorblindButtons.button2X + colorblindButtons.buttonWidth / 2, optionY + (optionHeight * 0.65));

            optionY += optionHeight + optionSpacing;

            const sliderTrackX = optionX + optionWidth * 0.35;
            const sliderTrackWidth = optionWidth * 0.65;
            const sliderTrackHeight = Math.max(8, Math.round(optionHeight * 0.16));
            const volumeRows = [
                { label: 'Sound FX Volume:', valuePercent: Math.round(context.soundVolume * 100) },
                { label: 'Music Volume:', valuePercent: Math.round(context.musicVolume * 100) }
            ];

            for (let i = 0; i < volumeRows.length; i += 1) {
                const row = volumeRows[i];
                const rowY = optionY + i * (optionHeight + optionSpacing);
                const clampedPercent = Math.max(0, Math.min(100, row.valuePercent));
                const trackY = rowY + (optionHeight - sliderTrackHeight) / 2;
                const knobX = sliderTrackX + (sliderTrackWidth * clampedPercent) / 100;

                context.ctx.fillStyle = '#AAAAAA';
                context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
                context.ctx.textAlign = 'left';
                context.ctx.fillText(row.label, optionX, rowY + (optionHeight * 0.4));

                context.ctx.fillStyle = 'rgba(60, 60, 60, 0.9)';
                context.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);
                context.ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
                context.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth * (clampedPercent / 100), sliderTrackHeight);
                context.ctx.strokeStyle = '#FFD700';
                context.ctx.lineWidth = 1.5;
                context.ctx.strokeRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);

                context.ctx.beginPath();
                context.ctx.arc(knobX, trackY + sliderTrackHeight / 2, sliderTrackHeight * 1.1, 0, Math.PI * 2);
                context.ctx.fillStyle = '#FFD700';
                context.ctx.fill();
                context.ctx.strokeStyle = '#FFFFFF';
                context.ctx.lineWidth = 1;
                context.ctx.stroke();

                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `${isCompactLayout ? 14 : 16}px Doto`;
                context.ctx.textAlign = 'right';
                context.ctx.fillText(`${clampedPercent}%`, optionX + optionWidth, rowY + (optionHeight * 0.4));
            }

        } else {
            const maxScroll = getGraphicsMenuMaxScroll(context.renderLayerOptions.length, layout);
            const scrollOffset = Math.min(maxScroll, context.graphicsMenuScrollOffset);
            const qualityRowHeight = isCompactLayout ? 34 : 38;
            const qualityButtonGap = 8;
            const qualityY = layout.graphicsSliderY;
            const qualityLabelX = layout.graphicsSliderX;
            const qualityLabelWidth = layout.graphicsSliderLabelWidth;
            const qualityButtonWidth = (layout.graphicsSliderWidth - qualityLabelWidth - qualityButtonGap * 3) / 4;
            const qualityStartX = layout.graphicsSliderX + qualityLabelWidth;
            const qualityValues: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];

            context.ctx.fillStyle = '#FFFFFF';
            context.ctx.font = `bold ${isCompactLayout ? 13 : 15}px Doto`;
            context.ctx.textAlign = 'left';
            context.ctx.textBaseline = 'middle';
            context.ctx.fillText('Graphics Quality', qualityLabelX, qualityY + qualityRowHeight * 0.5);

            for (let i = 0; i < qualityValues.length; i += 1) {
                const quality = qualityValues[i];
                const buttonX = qualityStartX + i * (qualityButtonWidth + qualityButtonGap);
                const isSelected = context.graphicsQuality === quality;
                context.ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
                context.ctx.fillRect(buttonX, qualityY, qualityButtonWidth, qualityRowHeight);
                context.ctx.strokeStyle = isSelected ? '#FFD700' : '#FFFFFF';
                context.ctx.lineWidth = 1.5;
                context.ctx.strokeRect(buttonX, qualityY, qualityButtonWidth, qualityRowHeight);
                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `${isCompactLayout ? 11 : 12}px Doto`;
                context.ctx.textAlign = 'center';
                context.ctx.fillText(
                    quality[0].toUpperCase() + quality.slice(1),
                    buttonX + qualityButtonWidth / 2,
                    qualityY + qualityRowHeight * 0.64
                );
            }

            const sliderTrackX = layout.graphicsSliderX + layout.graphicsSliderLabelWidth;
            const sliderTrackWidth = layout.graphicsSliderWidth - layout.graphicsSliderLabelWidth;
            const sliderRowHeight = layout.graphicsSliderRowHeight;
            const sliderGap = layout.graphicsSliderGap;
            const sliderTrackHeight = layout.graphicsSliderTrackHeight;
            const sliderBaseY = qualityY + qualityRowHeight + sliderGap;
            const sliderRows = [
                { label: 'Offscreen Indicators', valuePercent: Math.round(context.offscreenIndicatorOpacity * 100) },
                { label: 'Info Box Opacity', valuePercent: Math.round(context.infoBoxOpacity * 100) }
            ];

            for (let i = 0; i < sliderRows.length; i += 1) {
                const row = sliderRows[i];
                const rowY = sliderBaseY + i * (sliderRowHeight + sliderGap);
                const clampedPercent = Math.max(0, Math.min(100, row.valuePercent));
                const trackY = rowY + (sliderRowHeight - sliderTrackHeight) / 2;
                const knobX = sliderTrackX + (sliderTrackWidth * clampedPercent) / 100;
                const knobRadius = sliderTrackHeight * 1.1;

                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `bold ${isCompactLayout ? 13 : 15}px Doto`;
                context.ctx.textAlign = 'left';
                context.ctx.textBaseline = 'middle';
                context.ctx.fillText(row.label, layout.graphicsSliderX, rowY + sliderRowHeight * 0.5);

                context.ctx.fillStyle = 'rgba(60, 60, 60, 0.9)';
                context.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);
                context.ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
                context.ctx.fillRect(sliderTrackX, trackY, sliderTrackWidth * (clampedPercent / 100), sliderTrackHeight);
                context.ctx.strokeStyle = '#FFD700';
                context.ctx.lineWidth = 1.5;
                context.ctx.strokeRect(sliderTrackX, trackY, sliderTrackWidth, sliderTrackHeight);

                context.ctx.beginPath();
                context.ctx.arc(knobX, trackY + sliderTrackHeight / 2, knobRadius, 0, Math.PI * 2);
                context.ctx.fillStyle = '#FFD700';
                context.ctx.fill();
                context.ctx.strokeStyle = '#FFFFFF';
                context.ctx.lineWidth = 1;
                context.ctx.stroke();

                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `bold ${isCompactLayout ? 12 : 13}px Doto`;
                context.ctx.textAlign = 'right';
                context.ctx.fillText(`${clampedPercent}%`, layout.graphicsSliderX + layout.graphicsSliderWidth, rowY + sliderRowHeight * 0.5);
            }

            context.ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
            context.ctx.fillRect(
                layout.graphicsListX,
                layout.graphicsListY,
                layout.graphicsListWidth,
                layout.graphicsListHeight
            );
            context.ctx.save();
            context.ctx.beginPath();
            context.ctx.rect(
                layout.graphicsListX,
                layout.graphicsListY,
                layout.graphicsListWidth,
                layout.graphicsListHeight
            );
            context.ctx.clip();

            const labelX = layout.graphicsListX + 8;
            const buttonAreaWidth = layout.graphicsButtonWidth * 2 + layout.graphicsButtonGap;
            const buttonStartX = layout.graphicsListX + layout.graphicsListWidth - buttonAreaWidth - 8;

            for (let i = 0; i < context.renderLayerOptions.length; i += 1) {
                const option = context.renderLayerOptions[i];
                const rowY = layout.graphicsListY + i * layout.graphicsRowHeight - scrollOffset;
                if (rowY + layout.graphicsRowHeight < layout.graphicsListY || rowY > layout.graphicsListY + layout.graphicsListHeight) {
                    continue;
                }
                context.ctx.fillStyle = i % 2 === 0 ? 'rgba(40, 40, 40, 0.6)' : 'rgba(55, 55, 55, 0.6)';
                context.ctx.fillRect(layout.graphicsListX, rowY, layout.graphicsListWidth, layout.graphicsRowHeight);
                context.ctx.fillStyle = '#FFFFFF';
                context.ctx.font = `${isCompactLayout ? 13 : 15}px Doto`;
                context.ctx.textAlign = 'left';
                context.ctx.fillText(option.label, labelX, rowY + layout.graphicsRowHeight * 0.65);

                const isEnabled = this.isRenderLayerEnabled(option.key, context);
                const buttonY = rowY + (layout.graphicsRowHeight - layout.graphicsButtonHeight) / 2;
                const labels = ['ON', 'OFF'];
                for (let j = 0; j < labels.length; j += 1) {
                    const isOnButton = j === 0;
                    const isSelected = isOnButton ? isEnabled : !isEnabled;
                    const buttonX = buttonStartX + j * (layout.graphicsButtonWidth + layout.graphicsButtonGap);
                    context.ctx.fillStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(80, 80, 80, 0.9)';
                    context.ctx.fillRect(buttonX, buttonY, layout.graphicsButtonWidth, layout.graphicsButtonHeight);
                    context.ctx.strokeStyle = isSelected ? '#FFD700' : '#FFFFFF';
                    context.ctx.lineWidth = 1.5;
                    context.ctx.strokeRect(buttonX, buttonY, layout.graphicsButtonWidth, layout.graphicsButtonHeight);
                    context.ctx.fillStyle = '#FFFFFF';
                    context.ctx.font = `${isCompactLayout ? 11 : 12}px Doto`;
                    context.ctx.textAlign = 'center';
                    context.ctx.fillText(
                        labels[j],
                        buttonX + layout.graphicsButtonWidth / 2,
                        buttonY + layout.graphicsButtonHeight * 0.68
                    );
                }
            }

            context.ctx.restore();
        }

        context.ctx.textAlign = 'left';
    }

    public handleInGameMenuScroll(
        context: InGameMenuRendererContext,
        screenX: number,
        screenY: number,
        deltaY: number
    ): { consumed: boolean; newScrollOffset: number } {
        const noChange = { consumed: false, newScrollOffset: context.graphicsMenuScrollOffset };
        if (!context.showInGameMenu || context.inGameMenuTab !== 'graphics') {
            return noChange;
        }
        const layout = getInGameMenuLayout(context.canvas.width, context.canvas.height);
        const isWithinList =
            screenX >= layout.graphicsListX &&
            screenX <= layout.graphicsListX + layout.graphicsListWidth &&
            screenY >= layout.graphicsListY &&
            screenY <= layout.graphicsListY + layout.graphicsListHeight;
        if (!isWithinList) {
            return noChange;
        }
        const maxScroll = getGraphicsMenuMaxScroll(context.renderLayerOptions.length, layout);
        if (maxScroll === 0) {
            return { consumed: true, newScrollOffset: context.graphicsMenuScrollOffset };
        }
        const newScrollOffset = Math.min(maxScroll, Math.max(0, context.graphicsMenuScrollOffset + deltaY));
        return { consumed: true, newScrollOffset };
    }

    public getInGameMenuAction(
        context: InGameMenuRendererContext,
        screenX: number,
        screenY: number
    ): InGameMenuAction | null {
        if (!context.showInGameMenu) {
            return null;
        }
        const layout = getInGameMenuLayout(context.canvas.width, context.canvas.height);
        for (const tab of layout.tabs) {
            const isWithinTab =
                screenX >= tab.x &&
                screenX <= tab.x + tab.width &&
                screenY >= tab.y &&
                screenY <= tab.y + tab.height;
            if (isWithinTab) {
                return { type: 'tab', tab: tab.tab };
            }
        }

        if (context.inGameMenuTab === 'main') {
            let buttonY = layout.contentTopY;
            const buttons: Array<{ action: InGameMenuAction }> = [
                { action: { type: 'resume' } },
                { action: { type: 'toggleInfo' } },
                { action: { type: 'surrender' } }
            ];
            for (const button of buttons) {
                const isWithinButton =
                    screenX >= layout.buttonX &&
                    screenX <= layout.buttonX + layout.buttonWidth &&
                    screenY >= buttonY &&
                    screenY <= buttonY + layout.buttonHeight;
                if (isWithinButton) {
                    return button.action;
                }
                buttonY += layout.buttonHeight + layout.buttonSpacing;
            }
            return null;
        }

        if (context.inGameMenuTab === 'options') {
            let optionY = layout.contentTopY;
            const optionHeight = layout.buttonHeight;
            const optionSpacing = layout.buttonSpacing;
            const optionX = layout.buttonX;
            const optionWidth = layout.buttonWidth;
            const buttonWidth = optionWidth * 0.35;
            const buttonGap = 10;

            // Damage Display Mode buttons
            const damageButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const damageButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= damageButton1X && screenX <= damageButton1X + buttonWidth) {
                    return { type: 'damageDisplayMode', mode: 'damage' };
                }
                if (screenX >= damageButton2X && screenX <= damageButton2X + buttonWidth) {
                    return { type: 'damageDisplayMode', mode: 'remaining-life' };
                }
            }

            optionY += optionHeight + optionSpacing;

            // Health Display Mode buttons
            const healthButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const healthButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= healthButton1X && screenX <= healthButton1X + buttonWidth) {
                    return { type: 'healthDisplayMode', mode: 'bar' };
                }
                if (screenX >= healthButton2X && screenX <= healthButton2X + buttonWidth) {
                    return { type: 'healthDisplayMode', mode: 'number' };
                }
            }

            optionY += optionHeight + optionSpacing;

            // Fancy Graphics toggle buttons
            const fancyButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const fancyButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= fancyButton1X && screenX <= fancyButton1X + buttonWidth) {
                    return { type: 'fancyGraphics', isEnabled: true };
                }
                if (screenX >= fancyButton2X && screenX <= fancyButton2X + buttonWidth) {
                    return { type: 'fancyGraphics', isEnabled: false };
                }
            }

            optionY += optionHeight + optionSpacing;

            // Colorblind Mode toggle buttons
            const colorblindButton1X = optionX + optionWidth - buttonWidth * 2 - buttonGap;
            const colorblindButton2X = optionX + optionWidth - buttonWidth;

            if (screenY >= optionY && screenY <= optionY + optionHeight) {
                if (screenX >= colorblindButton1X && screenX <= colorblindButton1X + buttonWidth) {
                    return { type: 'colorblindMode', isEnabled: true };
                }
                if (screenX >= colorblindButton2X && screenX <= colorblindButton2X + buttonWidth) {
                    return { type: 'colorblindMode', isEnabled: false };
                }
            }

            optionY += optionHeight + optionSpacing;

            const sliderTrackX = optionX + optionWidth * 0.35;
            const sliderTrackWidth = optionWidth * 0.65;
            const sliderRows: Array<{ type: 'soundVolume' | 'musicVolume' }> = [
                { type: 'soundVolume' },
                { type: 'musicVolume' }
            ];

            for (let i = 0; i < sliderRows.length; i += 1) {
                const rowY = optionY + i * (optionHeight + optionSpacing);
                const isWithinRow = screenY >= rowY && screenY <= rowY + optionHeight;
                if (!isWithinRow) {
                    continue;
                }
                if (screenX >= sliderTrackX && screenX <= sliderTrackX + sliderTrackWidth) {
                    const rawPercent = ((screenX - sliderTrackX) / sliderTrackWidth) * 100;
                    const snappedPercent = Math.max(0, Math.min(100, Math.round(rawPercent / 5) * 5));
                    return { type: sliderRows[i].type, volumePercent: snappedPercent };
                }
            }

            return null;
        }

        if (context.inGameMenuTab === 'graphics') {
            const qualityRowHeight = layout.isCompactLayout ? 34 : 38;
            const qualityButtonGap = 8;
            const qualityY = layout.graphicsSliderY;
            const qualityLabelWidth = layout.graphicsSliderLabelWidth;
            const qualityButtonWidth = (layout.graphicsSliderWidth - qualityLabelWidth - qualityButtonGap * 3) / 4;
            const qualityStartX = layout.graphicsSliderX + qualityLabelWidth;
            const qualityValues: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];
            if (screenY >= qualityY && screenY <= qualityY + qualityRowHeight) {
                for (let i = 0; i < qualityValues.length; i += 1) {
                    const buttonX = qualityStartX + i * (qualityButtonWidth + qualityButtonGap);
                    if (screenX >= buttonX && screenX <= buttonX + qualityButtonWidth) {
                        return { type: 'graphicsQuality', quality: qualityValues[i] };
                    }
                }
            }

            const sliderTrackX = layout.graphicsSliderX + layout.graphicsSliderLabelWidth;
            const sliderTrackWidth = layout.graphicsSliderWidth - layout.graphicsSliderLabelWidth;
            const sliderRowHeight = layout.graphicsSliderRowHeight;
            const sliderGap = layout.graphicsSliderGap;
            const sliderBaseY = qualityY + qualityRowHeight + sliderGap;
            const sliderActionTypes: Array<InGameMenuAction['type']> = [
                'offscreenIndicatorOpacity',
                'infoBoxOpacity'
            ];
            for (let i = 0; i < sliderActionTypes.length; i += 1) {
                const rowY = sliderBaseY + i * (sliderRowHeight + sliderGap);
                const isWithinRow = screenY >= rowY && screenY <= rowY + sliderRowHeight;
                if (!isWithinRow) {
                    continue;
                }
                if (screenX >= sliderTrackX && screenX <= sliderTrackX + sliderTrackWidth) {
                    const rawPercent = ((screenX - sliderTrackX) / sliderTrackWidth) * 100;
                    const snappedPercent = Math.max(0, Math.min(100, Math.round(rawPercent / 5) * 5));
                    const actionType = sliderActionTypes[i];
                    if (actionType === 'offscreenIndicatorOpacity') {
                        return { type: 'offscreenIndicatorOpacity', opacityPercent: snappedPercent };
                    }
                    return { type: 'infoBoxOpacity', opacityPercent: snappedPercent };
                }
            }
        }

        const isWithinList =
            screenX >= layout.graphicsListX &&
            screenX <= layout.graphicsListX + layout.graphicsListWidth &&
            screenY >= layout.graphicsListY &&
            screenY <= layout.graphicsListY + layout.graphicsListHeight;
        if (!isWithinList) {
            return null;
        }

        const contentHeight = context.renderLayerOptions.length * layout.graphicsRowHeight;
        const localY = screenY - layout.graphicsListY + context.graphicsMenuScrollOffset;
        if (localY < 0 || localY > contentHeight) {
            return null;
        }
        const rowIndex = Math.floor(localY / layout.graphicsRowHeight);
        const option = context.renderLayerOptions[rowIndex];
        if (!option) {
            return null;
        }

        const buttonAreaWidth = layout.graphicsButtonWidth * 2 + layout.graphicsButtonGap;
        const buttonStartX = layout.graphicsListX + layout.graphicsListWidth - buttonAreaWidth - 8;
        const rowY = layout.graphicsListY + rowIndex * layout.graphicsRowHeight - context.graphicsMenuScrollOffset;
        const buttonY = rowY + (layout.graphicsRowHeight - layout.graphicsButtonHeight) / 2;
        for (let i = 0; i < 2; i += 1) {
            const buttonX = buttonStartX + i * (layout.graphicsButtonWidth + layout.graphicsButtonGap);
            const isWithinButton =
                screenX >= buttonX &&
                screenX <= buttonX + layout.graphicsButtonWidth &&
                screenY >= buttonY &&
                screenY <= buttonY + layout.graphicsButtonHeight;
            if (isWithinButton) {
                return { type: 'toggleRenderLayer', layer: option.key, isEnabled: i === 0 };
            }
        }

        return null;
    }

    public drawForgeButtons(
        forge: StellarForge,
        screenPos: Vector2D,
        heroNames: string[],
        context: InGameMenuRendererContext
    ): void {
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * context.zoom;
        const buttonDistance = (Constants.HERO_BUTTON_DISTANCE_PX * context.zoom);

        const displayLabels = [...heroNames.slice(0, 4), 'Solar Mirror'];
        const positions = getRadialButtonOffsets(displayLabels.length);

        for (let i = 0; i < displayLabels.length; i++) {
            const heroName = displayLabels[i];
            const pos = positions[i];
            const buttonX = screenPos.x + pos.x * buttonDistance;
            const buttonY = screenPos.y + pos.y * buttonDistance;
            const isMirrorOption = heroName === 'Solar Mirror';
            const heroUnitType = isMirrorOption ? null : getHeroUnitType(heroName);
            const isHeroAlive = heroUnitType ? this.isHeroUnitAlive(forge.owner, heroUnitType) : false;
            const isHeroProducing = heroUnitType ? this.isHeroUnitQueuedOrProducing(forge, heroUnitType) : false;
            const buttonCost = isMirrorOption ? Constants.STELLAR_FORGE_SOLAR_MIRROR_COST : getHeroUnitCost(forge.owner);
            const isAvailable = isMirrorOption
                ? true
                : (heroUnitType ? !isHeroAlive && !isHeroProducing : false);
            const isHighlighted = context.highlightedButtonIndex === i;

            context.ctx.fillStyle = isHighlighted
                ? 'rgba(0, 255, 136, 0.7)'
                : (isAvailable ? 'rgba(0, 255, 136, 0.3)' : 'rgba(128, 128, 128, 0.3)');
            context.ctx.strokeStyle = isHighlighted
                ? '#00FF88'
                : (isAvailable ? '#00FF88' : '#888888');
            context.ctx.lineWidth = isHighlighted ? 4 : 2;
            context.ctx.beginPath();
            context.ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
            context.ctx.fill();
            context.ctx.stroke();

            context.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#666666';
            context.ctx.font = `${14 * context.zoom}px Doto`;
            context.ctx.textAlign = 'center';
            context.ctx.textBaseline = 'middle';
            const buttonLabel = isMirrorOption ? 'Mirror' : heroName;
            context.ctx.fillText(buttonLabel, buttonX, buttonY);

            this.drawRadialButtonCostLabel(buttonX, buttonY, pos.x, pos.y, buttonRadius, buttonCost, isAvailable, context);

            if (!isMirrorOption && isHeroProducing) {
                this.drawHeroHourglass(buttonX, buttonY, buttonRadius, context);
            } else if (isHeroAlive) {
                this.drawHeroCheckmark(buttonX, buttonY, buttonRadius, context);
            }
        }
    }

    private drawRadialButtonCostLabel(
        buttonX: number,
        buttonY: number,
        radialX: number,
        radialY: number,
        buttonRadius: number,
        cost: number,
        isAvailable: boolean,
        context: InGameMenuRendererContext
    ): void {
        const radialLength = Math.hypot(radialX, radialY);
        const directionX = radialLength > 0 ? radialX / radialLength : 0;
        const directionY = radialLength > 0 ? radialY / radialLength : -1;
        const costOffsetPx = buttonRadius + 10 * context.zoom;
        const costX = buttonX + directionX * costOffsetPx;
        const costY = buttonY + directionY * costOffsetPx;

        context.ctx.fillStyle = isAvailable ? '#FFFFFF' : '#888888';
        context.ctx.font = `${10 * context.zoom}px Doto`;
        context.ctx.textAlign = 'center';
        context.ctx.textBaseline = 'middle';
        context.ctx.fillText(cost.toString(), costX, costY);
    }

    private drawHeroHourglass(centerX: number, centerY: number, radius: number, context: InGameMenuRendererContext): void {
        const iconWidth = radius * 0.7;
        const iconHeight = radius * 0.8;
        const leftX = centerX - iconWidth * 0.5;
        const rightX = centerX + iconWidth * 0.5;
        const topY = centerY - iconHeight * 0.5;
        const bottomY = centerY + iconHeight * 0.5;
        const midY = centerY;

        context.ctx.strokeStyle = '#CCCCCC';
        context.ctx.lineWidth = Math.max(1, 2 * context.zoom);
        context.ctx.beginPath();
        context.ctx.moveTo(leftX, topY);
        context.ctx.lineTo(rightX, topY);
        context.ctx.lineTo(centerX, midY);
        context.ctx.closePath();
        context.ctx.stroke();

        context.ctx.beginPath();
        context.ctx.moveTo(leftX, bottomY);
        context.ctx.lineTo(rightX, bottomY);
        context.ctx.lineTo(centerX, midY);
        context.ctx.closePath();
        context.ctx.stroke();
    }

    private drawHeroCheckmark(centerX: number, centerY: number, radius: number, context: InGameMenuRendererContext): void {
        const iconWidth = radius * 0.7;
        const iconHeight = radius * 0.6;
        const startX = centerX - iconWidth * 0.45;
        const startY = centerY + iconHeight * 0.05;
        const midX = centerX - iconWidth * 0.1;
        const midY = centerY + iconHeight * 0.35;
        const endX = centerX + iconWidth * 0.5;
        const endY = centerY - iconHeight * 0.35;

        context.ctx.strokeStyle = '#CCCCCC';
        context.ctx.lineWidth = Math.max(1, 2 * context.zoom);
        context.ctx.beginPath();
        context.ctx.moveTo(startX, startY);
        context.ctx.lineTo(midX, midY);
        context.ctx.lineTo(endX, endY);
        context.ctx.stroke();
    }

    private isHeroUnitOfType(unit: Unit, heroUnitType: string): boolean {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof Marine;
            case 'Mothership':
                return unit instanceof Mothership;
            case 'Grave':
                return unit instanceof Grave;
            case 'Ray':
                return unit instanceof Ray;
            case 'Nova':
                return unit instanceof Nova;
            case 'InfluenceBall':
                return unit instanceof InfluenceBall;
            case 'TurretDeployer':
                return unit instanceof TurretDeployer;
            case 'Driller':
                return unit instanceof Driller;
            case 'Dagger':
                return unit instanceof Dagger;
            case 'Beam':
                return unit instanceof Beam;
            case 'Spotlight':
                return unit instanceof Spotlight;
            case 'Splendor':
                return unit instanceof Splendor;
            case 'Mortar':
                return unit instanceof Mortar;
            case 'Preist':
                return unit instanceof Preist;
            case 'Sly':
                return unit instanceof Sly;
            case 'Shadow':
                return unit instanceof Shadow;
            case 'Chrono':
                return unit instanceof Chrono;
            default:
                return false;
        }
    }

    private isHeroUnitAlive(player: Player, heroUnitType: string): boolean {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }

    private isHeroUnitQueuedOrProducing(forge: StellarForge, heroUnitType: string): boolean {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }

    private isRenderLayerEnabled(layer: RenderLayerKey, context: InGameMenuRendererContext): boolean {
        switch (layer) {
            case 'suns':
                return context.isSunsLayerEnabled;
            case 'stars':
                return context.isStarsLayerEnabled;
            case 'asteroids':
                return context.isAsteroidsLayerEnabled;
            case 'spaceDust':
                return context.isSpaceDustLayerEnabled;
            case 'buildings':
                return context.isBuildingsLayerEnabled;
            case 'units':
                return context.isUnitsLayerEnabled;
            case 'projectiles':
                return context.isProjectilesLayerEnabled;
            default:
                return true;
        }
    }
}
