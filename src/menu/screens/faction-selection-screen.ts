/**
 * Faction Selection Screen Renderer
 * Displays faction carousel for player selection
 */

import { Faction } from '../../game-core';
import { FactionCarouselOption } from '../types';
import { FactionCarouselView } from '../../menu';

export interface FactionSelectionScreenParams {
    selectedFaction: Faction | null;
    onFactionChange: (faction: Faction) => void;
    onContinue: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
    onCarouselCreated: (carousel: FactionCarouselView) => void;
}

export function renderFactionSelectionScreen(
    container: HTMLElement,
    params: FactionSelectionScreenParams
): void {
    const { 
        selectedFaction, 
        onFactionChange, 
        onContinue, 
        onBack, 
        createButton, 
        menuParticleLayer,
        onCarouselCreated
    } = params;
    
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Your Faction';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '8px' : '12px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Faction carousel
    const carouselContainer = document.createElement('div');
    carouselContainer.style.width = '100%';
    carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
    carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
    carouselContainer.style.marginBottom = '12px';
    container.appendChild(carouselContainer);

    const factions: FactionCarouselOption[] = [
        { 
            id: Faction.RADIANT, 
            name: 'Radiant', 
            description: 'Well-Balanced, Ranged-Focused',
            color: '#FF5722'
        },
        { 
            id: Faction.AURUM, 
            name: 'Aurum', 
            description: 'Fast-Paced, Melee-Focused',
            color: '#FFD700'
        },
        { 
            id: Faction.VELARIS, 
            name: 'Velaris', 
            description: 'Strategic, Ability-Heavy. Particles from Nebulae',
            color: '#9C27B0'
        }
    ];
    const selectedIndex = factions.findIndex((faction) => faction.id === selectedFaction);
    const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

    const factionCarousel = new FactionCarouselView(carouselContainer, factions, initialIndex);
    factionCarousel.onSelectionChange((option) => {
        onFactionChange(option.id);
        menuParticleLayer?.requestTargetRefresh(container);
    });
    factionCarousel.onRender(() => {
        menuParticleLayer?.requestTargetRefresh(container);
    });
    onCarouselCreated(factionCarousel);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '20px';
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.justifyContent = 'center';
    if (isCompactLayout) {
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.alignItems = 'center';
    }

    // Continue button to loadout customization (only enabled if faction is selected)
    if (selectedFaction) {
        const continueButton = createButton('CUSTOMIZE LOADOUT', onContinue, '#00FF88');
        buttonContainer.appendChild(continueButton);
    }

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    buttonContainer.appendChild(backButton);

    container.appendChild(buttonContainer);
    menuParticleLayer?.requestTargetRefresh(container);
}
