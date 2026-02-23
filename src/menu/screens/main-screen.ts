/**
 * Main Screen Renderer
 * Displays the main menu with carousel navigation
 */

import { Faction } from '../../game-core';
import { MenuOption, MapConfig } from '../types';
import { CarouselMenuView } from '../carousel-menu-view';

export interface MainScreenParams {
    selectedFaction: Faction | null;
    selectedMap: MapConfig;
    resolveAssetPath: (path: string) => string;
    onLoadout: () => void;
    onStart: () => void;
    onMatchHistory: () => void;
    onMaps: () => void;
    onSettings: () => void;
    onCarouselCreated: (carousel: CarouselMenuView) => void;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

function getFactionLabelAndColor(faction: Faction | null): { label: string; color: string } {
    switch (faction) {
        case Faction.RADIANT:
            return { label: 'Radiant', color: '#FF5722' };
        case Faction.AURUM:
            return { label: 'Aurum', color: '#FFD700' };
        case Faction.VELARIS:
            return { label: 'Velaris', color: '#9C27B0' };
        default:
            return { label: 'Unselected', color: '#999999' };
    }
}

export function renderMainScreen(
    container: HTMLElement,
    params: MainScreenParams
): void {
    const {
        selectedFaction,
        selectedMap,
        resolveAssetPath,
        onLoadout,
        onStart,
        onMatchHistory,
        onMaps,
        onSettings,
        onCarouselCreated,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;
    container.style.justifyContent = 'flex-start';

    // Title graphic
    const titleGraphic = document.createElement('img');
    titleGraphic.src = resolveAssetPath('ASSETS/SPRITES/menu/titleGraphic.png');
    titleGraphic.alt = 'Speed of Light RTS';
    titleGraphic.style.width = isCompactLayout ? '300px' : '480px';
    titleGraphic.style.maxWidth = '90%';
    titleGraphic.style.height = 'auto';
    titleGraphic.style.marginBottom = isCompactLayout ? '6px' : '12px';
    titleGraphic.style.alignSelf = 'center';
    container.appendChild(titleGraphic);

    // Create carousel menu container
    const carouselContainer = document.createElement('div');
    carouselContainer.style.width = '100%';
    carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
    carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
    carouselContainer.style.marginTop = '0';
    carouselContainer.style.marginBottom = isCompactLayout ? '18px' : '20px';
    container.appendChild(carouselContainer);

    // Build carousel menu options
    const { label: factionLabel, color: factionColor } = getFactionLabelAndColor(selectedFaction);
    const menuOptions: MenuOption[] = [
        {
            id: 'loadout',
            name: 'LOADOUT',
            description: 'Select faction & heroes',
            subLabel: factionLabel,
            subLabelColor: factionColor
        },
        {
            id: 'start',
            name: 'START',
            description: 'Begin game'
        },
        {
            id: 'match-history',
            name: 'MATCH HISTORY',
            description: 'View past matches'
        },
        {
            id: 'maps',
            name: 'MAPS',
            description: 'Select map',
            subLabel: selectedMap.name,
            subLabelColor: '#FFD700',
            previewMap: selectedMap
        },
        {
            id: 'settings',
            name: 'SETTINGS',
            description: 'Configure game'
        }
    ];

    const carouselMenu = new CarouselMenuView(
        carouselContainer,
        menuOptions,
        1,
        'rgba(0, 0, 0, 0.5)'
    ); // Default to "START" button
    onCarouselCreated(carouselMenu);

    carouselMenu.onRender(() => {
        menuParticleLayer?.requestTargetRefresh(container);
    });
    carouselMenu.onNavigate(() => {
        menuParticleLayer?.requestTargetRefresh(container);
    });
    carouselMenu.onSelect((option: MenuOption) => {
        switch (option.id) {
            case 'loadout':
                onLoadout();
                break;
            case 'start':
                onStart();
                break;
            case 'match-history':
                onMatchHistory();
                break;
            case 'maps':
                onMaps();
                break;
            case 'settings':
                onSettings();
                break;
        }
    });

    menuParticleLayer?.requestTargetRefresh(container);
}
