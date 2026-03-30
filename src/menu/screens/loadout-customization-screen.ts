/**
 * Loadout Customization Screen Renderer
 * Displays base and spawn loadout selection with hero customization link
 */

import { Faction } from '../../game-core';
import { BaseLoadout, SpawnLoadout } from '../types';

export interface LoadoutCustomizationScreenParams {
    selectedFaction: Faction | null;
    baseLoadouts: BaseLoadout[];
    spawnLoadouts: SpawnLoadout[];
    selectedBaseLoadout: string | null;
    selectedSpawnLoadout: string | null;
    selectedHeroNames: string[];
    onFactionMissing: () => void;
    onBaseLoadoutSelect: (id: string) => void;
    onSpawnLoadoutSelect: (id: string) => void;
    onSelectHeroes: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderLoadoutCustomizationScreen(
    container: HTMLElement,
    params: LoadoutCustomizationScreenParams
): void {
    const {
        selectedFaction,
        baseLoadouts,
        spawnLoadouts,
        selectedBaseLoadout,
        selectedSpawnLoadout,
        selectedHeroNames,
        onFactionMissing,
        onBaseLoadoutSelect,
        onSpawnLoadoutSelect,
        onSelectHeroes,
        onBack,
        createButton,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    if (!selectedFaction) {
        onFactionMissing();
        return;
    }

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Customize Loadout';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = 'bold';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Get faction-specific loadouts
    const factionBaseLoadouts = baseLoadouts.filter(l => l.faction === selectedFaction);
    const factionSpawnLoadouts = spawnLoadouts.filter(l => l.faction === selectedFaction);

    // Main content container
    const contentContainer = document.createElement('div');
    contentContainer.style.display = 'flex';
    contentContainer.style.flexDirection = 'column';
    contentContainer.style.gap = '40px';
    contentContainer.style.width = '100%';
    contentContainer.style.maxWidth = isCompactLayout ? '100%' : '800px';
    contentContainer.style.padding = isCompactLayout ? '0 10px' : '0 20px';
    container.appendChild(contentContainer);

    // Base Loadout Section
    createLoadoutSection(
        contentContainer,
        'Base Loadout',
        factionBaseLoadouts,
        selectedBaseLoadout,
        onBaseLoadoutSelect,
        isCompactLayout
    );

    // Spawn Loadout Section
    createLoadoutSection(
        contentContainer,
        'Spawn Loadout',
        factionSpawnLoadouts,
        selectedSpawnLoadout,
        onSpawnLoadoutSelect,
        isCompactLayout
    );

    // Hero Loadout Section (link to hero selection)
    const heroSection = document.createElement('div');
    heroSection.style.marginTop = '20px';
    const heroTitle = document.createElement('h3');
    heroTitle.textContent = 'Hero Loadout';
    heroTitle.style.fontSize = isCompactLayout ? '24px' : '32px';
    heroTitle.style.color = '#00AAFF';
    heroTitle.style.marginBottom = '15px';
    heroTitle.style.fontWeight = 'bold';
    heroTitle.dataset.particleText = 'true';
    heroTitle.dataset.particleColor = '#00AAFF';
    heroSection.appendChild(heroTitle);

    const heroDesc = document.createElement('div');
    heroDesc.textContent = selectedHeroNames.length > 0 
        ? `Selected: ${selectedHeroNames.join(', ')}`
        : 'No heroes selected yet';
    heroDesc.style.fontSize = '20px';
    heroDesc.style.color = '#CCCCCC';
    heroDesc.style.marginBottom = '15px';
    heroSection.appendChild(heroDesc);

    const selectHeroesBtn = createButton('SELECT HEROES', onSelectHeroes, '#00FF88');
    heroSection.appendChild(selectHeroesBtn);
    contentContainer.appendChild(heroSection);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '20px';
    buttonContainer.style.marginTop = '30px';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.justifyContent = 'center';
    if (isCompactLayout) {
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.alignItems = 'center';
    }

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    buttonContainer.appendChild(backButton);

    container.appendChild(buttonContainer);
    menuParticleLayer?.requestTargetRefresh(container);
}

function createLoadoutSection(
    container: HTMLElement,
    title: string,
    loadouts: (BaseLoadout | SpawnLoadout)[],
    selectedId: string | null,
    onSelect: (id: string) => void,
    isCompact: boolean
): void {
    const section = document.createElement('div');
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    sectionTitle.style.fontSize = isCompact ? '24px' : '32px';
    sectionTitle.style.color = '#00AAFF';
    sectionTitle.style.marginBottom = '15px';
    sectionTitle.style.fontWeight = 'bold';
    sectionTitle.dataset.particleText = 'true';
    sectionTitle.dataset.particleColor = '#00AAFF';
    section.appendChild(sectionTitle);

    const optionsContainer = document.createElement('div');
    optionsContainer.style.display = 'flex';
    optionsContainer.style.flexDirection = 'column';
    optionsContainer.style.gap = '10px';

    loadouts.forEach(loadout => {
        const isSelected = loadout.id === selectedId;
        const optionDiv = document.createElement('div');
        optionDiv.style.padding = '15px';
        optionDiv.style.backgroundColor = isSelected ? 'rgba(0, 170, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)';
        optionDiv.style.border = isSelected ? '2px solid #00AAFF' : '2px solid rgba(255, 255, 255, 0.2)';
        optionDiv.style.borderRadius = '8px';
        optionDiv.style.cursor = 'pointer';
        optionDiv.style.transition = 'all 0.2s';

        const nameDiv = document.createElement('div');
        nameDiv.textContent = loadout.name;
        nameDiv.style.fontSize = '22px';
        nameDiv.style.color = isSelected ? '#00AAFF' : '#FFFFFF';
        nameDiv.style.fontWeight = 'bold';
        nameDiv.style.marginBottom = '5px';
        nameDiv.dataset.particleText = 'true';
        nameDiv.dataset.particleColor = isSelected ? '#00AAFF' : '#FFFFFF';
        optionDiv.appendChild(nameDiv);

        const descDiv = document.createElement('div');
        descDiv.textContent = loadout.description;
        descDiv.style.fontSize = '18px';
        descDiv.style.color = '#CCCCCC';
        optionDiv.appendChild(descDiv);

        optionDiv.addEventListener('click', () => {
            onSelect(loadout.id);
        });

        optionDiv.addEventListener('mouseenter', () => {
            if (!isSelected) {
                optionDiv.style.backgroundColor = 'rgba(0, 170, 255, 0.1)';
                optionDiv.style.borderColor = '#00AAFF';
            }
        });

        optionDiv.addEventListener('mouseleave', () => {
            if (!isSelected) {
                optionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                optionDiv.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        });

        optionsContainer.appendChild(optionDiv);
    });

    section.appendChild(optionsContainer);
    container.appendChild(section);
}
