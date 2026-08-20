/**
 * AI Mode Selection Screen Renderer
 * Lets the player choose between Ranked and Unranked AI matches.
 */

import { MenuOption } from '../types';

export interface AIModeSelectionScreenParams {
    aiRankedMmr: number;
    onModeSelect: (mode: 'ranked' | 'unranked') => void;
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

export function renderAIModeSelectionScreen(
    container: HTMLElement,
    params: AIModeSelectionScreenParams
): void {
    const { aiRankedMmr, onModeSelect, onBack, createButton, createCarouselMenu, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select AI Match Type';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = 'bold';
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

    const aiModeOptions: MenuOption[] = [
        {
            id: 'ranked',
            name: 'AI RANKED',
            description: 'Face increasingly difficult AI as you keep winning',
            subLabel: `${aiRankedMmr} MMR`,
            subLabelColor: '#00FFFF'
        },
        {
            id: 'unranked',
            name: 'AI UNRANKED',
            description: 'Play a casual match against the computer'
        }
    ];

    createCarouselMenu(
        carouselContainer,
        aiModeOptions,
        0, // Default to Ranked
        () => menuParticleLayer?.requestTargetRefresh(container),
        () => menuParticleLayer?.requestTargetRefresh(container),
        (option: MenuOption) => {
            onModeSelect(option.id as 'ranked' | 'unranked');
        }
    );

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    backButton.style.marginTop = '30px';
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
