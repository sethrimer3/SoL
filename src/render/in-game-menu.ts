/**
 * In-game menu types and layout functions
 */

import { GraphicKey, GraphicVariant } from './graphics-options';

export type InGameMenuTab = 'main' | 'options' | 'graphics';

export type InGameMenuAction =
    | { type: 'resume' }
    | { type: 'toggleInfo' }
    | { type: 'surrender' }
    | { type: 'tab'; tab: InGameMenuTab }
    | { type: 'graphicsVariant'; key: GraphicKey; variant: GraphicVariant }
    | { type: 'offscreenIndicatorOpacity'; opacityPercent: number }
    | { type: 'infoBoxOpacity'; opacityPercent: number }
    | { type: 'damageDisplayMode'; mode: 'damage' | 'remaining-life' }
    | { type: 'healthDisplayMode'; mode: 'bar' | 'number' }
    | { type: 'fancyGraphics'; isEnabled: boolean }
    | { type: 'graphicsQuality'; quality: 'low' | 'medium' | 'high' | 'ultra' }
    | { type: 'colorblindMode'; isEnabled: boolean };

export type InGameMenuLayout = {
    screenWidth: number;
    screenHeight: number;
    panelX: number;
    panelY: number;
    panelWidth: number;
    panelHeight: number;
    isCompactLayout: boolean;
    titleY: number;
    tabs: Array<{
        tab: InGameMenuTab;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    contentTopY: number;
    contentBottomY: number;
    buttonWidth: number;
    buttonHeight: number;
    buttonX: number;
    buttonSpacing: number;
    graphicsListX: number;
    graphicsListY: number;
    graphicsListWidth: number;
    graphicsListHeight: number;
    graphicsSliderX: number;
    graphicsSliderY: number;
    graphicsSliderWidth: number;
    graphicsSliderRowHeight: number;
    graphicsSliderGap: number;
    graphicsSliderLabelWidth: number;
    graphicsSliderTrackHeight: number;
    graphicsRowHeight: number;
    graphicsButtonWidth: number;
    graphicsButtonHeight: number;
    graphicsButtonGap: number;
};

export function getInGameMenuLayout(canvasWidth: number, canvasHeight: number): InGameMenuLayout {
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = canvasWidth / dpr;
    const screenHeight = canvasHeight / dpr;
    const isCompactLayout = screenWidth < 600;
    const panelWidth = Math.min(480, screenWidth - 40);
    const panelHeight = Math.min(460, screenHeight - 40);
    const panelX = (screenWidth - panelWidth) / 2;
    const panelY = (screenHeight - panelHeight) / 2;
    const panelPaddingX = isCompactLayout ? 14 : 20;
    const panelPaddingY = isCompactLayout ? 16 : 20;
    const titleY = panelY + (isCompactLayout ? 34 : 42);
    const tabHeight = isCompactLayout ? 30 : 34;
    const tabGap = 12;
    const tabWidth = (panelWidth - panelPaddingX * 2 - tabGap * 2) / 3;
    const tabY = titleY + (isCompactLayout ? 16 : 18);
    const tabX = panelX + panelPaddingX;
    const tabs: InGameMenuLayout['tabs'] = [
        { tab: 'main', x: tabX, y: tabY, width: tabWidth, height: tabHeight },
        { tab: 'options', x: tabX + tabWidth + tabGap, y: tabY, width: tabWidth, height: tabHeight },
        { tab: 'graphics', x: tabX + (tabWidth + tabGap) * 2, y: tabY, width: tabWidth, height: tabHeight }
    ];
    const contentTopY = tabY + tabHeight + (isCompactLayout ? 16 : 20);
    const contentBottomY = panelY + panelHeight - panelPaddingY;
    const buttonWidth = Math.min(300, panelWidth - panelPaddingX * 2);
    const buttonHeight = isCompactLayout ? 44 : 50;
    const buttonX = panelX + (panelWidth - buttonWidth) / 2;
    const buttonSpacing = isCompactLayout ? 14 : 20;
    const graphicsListX = panelX + panelPaddingX;
    const graphicsSliderX = graphicsListX;
    const graphicsSliderY = contentTopY;
    const graphicsSliderWidth = panelWidth - panelPaddingX * 2;
    const graphicsSliderRowHeight = isCompactLayout ? 34 : 38;
    const graphicsSliderGap = isCompactLayout ? 10 : 12;
    const graphicsSliderLabelWidth = isCompactLayout ? 150 : 190;
    const graphicsSliderTrackHeight = isCompactLayout ? 8 : 10;
    const graphicsSliderAreaHeight = graphicsSliderRowHeight * 3 + graphicsSliderGap * 2;
    const graphicsListY = graphicsSliderY + graphicsSliderAreaHeight + (isCompactLayout ? 12 : 14);
    const graphicsListWidth = panelWidth - panelPaddingX * 2;
    const graphicsListHeight = Math.max(0, contentBottomY - graphicsListY);
    const graphicsRowHeight = isCompactLayout ? 44 : 48;
    const graphicsButtonWidth = isCompactLayout ? 54 : 60;
    const graphicsButtonHeight = isCompactLayout ? 26 : 30;
    const graphicsButtonGap = 8;

    return {
        screenWidth,
        screenHeight,
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        isCompactLayout,
        titleY,
        tabs,
        contentTopY,
        contentBottomY,
        buttonWidth,
        buttonHeight,
        buttonX,
        buttonSpacing,
        graphicsListX,
        graphicsListY,
        graphicsListWidth,
        graphicsListHeight,
        graphicsSliderX,
        graphicsSliderY,
        graphicsSliderWidth,
        graphicsSliderRowHeight,
        graphicsSliderGap,
        graphicsSliderLabelWidth,
        graphicsSliderTrackHeight,
        graphicsRowHeight,
        graphicsButtonWidth,
        graphicsButtonHeight,
        graphicsButtonGap
    };
}

export function getGraphicsMenuMaxScroll(graphicsOptionsCount: number, layout: InGameMenuLayout): number {
    const contentHeight = graphicsOptionsCount * layout.graphicsRowHeight;
    return Math.max(0, contentHeight - layout.graphicsListHeight);
}
