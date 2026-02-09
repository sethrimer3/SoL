/**
 * Game Mode Selection Screen Renderer
 * Displays available game modes using a carousel view
 */

import { MenuOption } from '../types';

export interface GameModeSelectionScreenParams {
    onGameModeSelect: (mode: 'ai' | 'online' | 'lan' | 'p2p', option: MenuOption) => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    createCarouselMenu: (
        container: HTMLElement, 
        options: MenuOption[], 
        initialIndex: number,
        onRender: () => void,
        onNavigate: () => void,
        onSelect: (option: MenuOption) => void
    ) => void;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderGameModeSelectionScreen(
    container: HTMLElement,
    params: GameModeSelectionScreenParams
): void {
    const { onGameModeSelect, onBack, createButton, createCarouselMenu, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Game Mode';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Create carousel menu container
    const carouselContainer = document.createElement('div');
    carouselContainer.style.width = '100%';
    carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
    carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
    carouselContainer.style.marginBottom = isCompactLayout ? '18px' : '20px';
    container.appendChild(carouselContainer);

    // Create game mode options
    const gameModeOptions: MenuOption[] = [
        {
            id: 'ai',
            name: 'AI',
            description: 'Play against computer opponent'
        },
        {
            id: 'online',
            name: 'ONLINE',
            description: 'Play against players worldwide'
        },
        {
            id: 'lan',
            name: 'LAN',
            description: 'Play on local network'
        },
        {
            id: 'p2p',
            name: 'P2P MULTIPLAYER',
            description: 'Peer-to-peer multiplayer (Beta)'
        }
    ];

    // Create carousel with callbacks
    createCarouselMenu(
        carouselContainer,
        gameModeOptions,
        0, // Default to AI mode
        () => menuParticleLayer?.requestTargetRefresh(container),
        () => menuParticleLayer?.requestTargetRefresh(container),
        (option: MenuOption) => {
            onGameModeSelect(option.id as 'ai' | 'online' | 'lan' | 'p2p', option);
        }
    );

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    backButton.style.marginTop = '30px';
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
