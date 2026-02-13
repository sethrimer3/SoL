/**
 * Loadout Selection Screen Renderer
 * Displays faction carousel and hero selection grid
 */

import { Faction } from '../../game-core';
import { FactionCarouselOption, HeroUnit } from '../types';
import { FactionCarouselView } from '../../menu';

export interface LoadoutSelectionScreenParams {
    selectedFaction: Faction | null;
    selectedHeroes: string[];
    heroUnits: HeroUnit[];
    onFactionChange: (faction: Faction) => void;
    onHeroToggle: (heroId: string, isSelected: boolean) => void;
    onCustomizeLoadout: () => void;
    onConfirm: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
    onCarouselCreated: (carousel: FactionCarouselView) => void;
}

export function renderLoadoutSelectionScreen(
    container: HTMLElement,
    params: LoadoutSelectionScreenParams
): void {
    const {
        selectedFaction,
        selectedHeroes,
        heroUnits,
        onFactionChange,
        onHeroToggle,
        onCustomizeLoadout,
        onConfirm,
        onBack,
        createButton,
        menuParticleLayer,
        onCarouselCreated
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    container.style.justifyContent = 'flex-start';

    // Header with back button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'flex-start';
    header.style.width = '100%';
    header.style.maxWidth = isCompactLayout ? '100%' : '900px';
    header.style.padding = isCompactLayout ? '10px' : '10px 0';
    header.style.alignSelf = 'center';

    const backButton = createButton('BACK', onBack, '#666666');
    backButton.style.fontSize = '18px';
    backButton.style.padding = '8px 18px';
    header.appendChild(backButton);
    container.appendChild(header);

    // Faction carousel
    const carouselContainer = document.createElement('div');
    carouselContainer.style.width = '100%';
    carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
    carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
    carouselContainer.style.marginBottom = isCompactLayout ? '10px' : '12px';
    container.appendChild(carouselContainer);

    const factions: FactionCarouselOption[] = [
        { 
            id: Faction.RADIANT, 
            name: 'Radiant Apotheosis', 
            description: 'Well-Balanced, Ranged-Focused',
            color: '#FF5722'
        },
        { 
            id: Faction.AURUM, 
            name: 'Aurum Imperium', 
            description: 'Fast-Paced, Melee-Focused',
            color: '#FFD700'
        },
        { 
            id: Faction.VELARIS, 
            name: 'Velaris Collective', 
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

    // Hero selection title
    const title = document.createElement('h2');
    title.textContent = 'Radiant Apotheosis';
    title.style.fontSize = isCompactLayout ? '26px' : '36px';
    title.style.marginBottom = isCompactLayout ? '8px' : '12px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Selection counter
    const counter = document.createElement('div');
    counter.textContent = `Selected: ${selectedHeroes.length} / 4`;
    counter.style.fontSize = isCompactLayout ? '24px' : '26px';
    counter.style.marginBottom = isCompactLayout ? '20px' : '30px';
    counter.style.color = selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
    counter.style.fontWeight = '300';
    counter.dataset.particleText = 'true';
    counter.dataset.particleColor = selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
    container.appendChild(counter);

    // Hero grid
    const heroGrid = document.createElement('div');
    heroGrid.style.display = 'grid';
    heroGrid.style.gridTemplateColumns = isCompactLayout
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(auto-fit, minmax(280px, 1fr))';
    heroGrid.style.gap = '15px';
    heroGrid.style.maxWidth = '1200px';
    heroGrid.style.padding = '20px';
    heroGrid.style.marginBottom = '20px';
    heroGrid.style.maxHeight = isCompactLayout ? 'none' : '600px';
    heroGrid.style.overflowY = isCompactLayout ? 'visible' : 'auto';

    // Filter heroes by selected faction
    const factionHeroes = heroUnits.filter(hero => hero.faction === selectedFaction);

    for (const hero of factionHeroes) {
        const isSelected = selectedHeroes.includes(hero.id);
        const canSelect = isSelected || selectedHeroes.length < 4;

        const heroCard = document.createElement('div');
        heroCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        heroCard.style.border = '2px solid transparent';
        heroCard.style.borderRadius = '10px';
        heroCard.style.padding = '15px';
        heroCard.style.cursor = 'default';
        heroCard.style.transition = 'all 0.3s';
        heroCard.style.opacity = canSelect ? '1' : '0.5';
        heroCard.style.minHeight = '300px';
        heroCard.dataset.particleBox = 'true';
        heroCard.dataset.particleColor = isSelected ? '#00FF88' : '#66B3FF';

        // Hero name
        const heroName = document.createElement('h4');
        heroName.textContent = hero.name;
        heroName.style.fontSize = '24px';
        heroName.style.marginBottom = '8px';
        heroName.style.color = '#E0F2FF';
        heroName.style.fontWeight = '300';
        heroName.dataset.particleText = 'true';
        heroName.dataset.particleColor = '#E0F2FF';
        heroCard.appendChild(heroName);

        // Hero description
        const heroDesc = document.createElement('p');
        heroDesc.textContent = hero.description;
        heroDesc.style.fontSize = '24px';
        heroDesc.style.lineHeight = '1.4';
        heroDesc.style.color = '#AAAAAA';
        heroDesc.style.marginBottom = '10px';
        heroDesc.style.fontWeight = '300';
        heroDesc.dataset.particleText = 'true';
        heroDesc.dataset.particleColor = '#AAAAAA';
        heroCard.appendChild(heroDesc);

        // Stats dropdown button
        const statsToggle = document.createElement('div');
        statsToggle.style.fontSize = '24px';
        statsToggle.style.color = '#66B3FF';
        statsToggle.style.cursor = 'pointer';
        statsToggle.style.marginBottom = '8px';
        statsToggle.style.fontWeight = '300';
        statsToggle.style.userSelect = 'none';
        statsToggle.dataset.particleText = 'true';
        statsToggle.dataset.particleColor = '#66B3FF';
        
        const statsArrow = document.createElement('span');
        statsArrow.textContent = '▶ ';
        statsArrow.style.display = 'inline-block';
        statsArrow.style.transition = 'transform 0.3s';
        statsToggle.appendChild(statsArrow);
        
        const statsLabel = document.createElement('span');
        statsLabel.textContent = 'Stats';
        statsToggle.appendChild(statsLabel);

        // Stats section (initially hidden)
        const statsContainer = document.createElement('div');
        statsContainer.style.fontSize = '24px';
        statsContainer.style.lineHeight = '1.6';
        statsContainer.style.color = '#CCCCCC';
        statsContainer.style.marginBottom = '8px';
        statsContainer.style.padding = '8px';
        statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        statsContainer.style.borderRadius = '5px';
        statsContainer.style.fontWeight = '300';
        statsContainer.style.display = 'none';
        statsContainer.style.overflow = 'hidden';
        statsContainer.style.transition = 'all 0.3s';

        // Create stat rows
        const healthStat = createStatElement('HP', hero.maxHealth);
        statsContainer.appendChild(healthStat);

        const regenStat = createStatElement('RGN', `${hero.regen}%`);
        statsContainer.appendChild(regenStat);

        const defenseStat = createStatElement('DEF', `${hero.defense}%`);
        statsContainer.appendChild(defenseStat);

        const attackSuffix = hero.attackIgnoresDefense ? ' (ignores defense)' : '';
        const attackStat = createStatElement('ATK', `${hero.attackDamage}${attackSuffix}`);
        statsContainer.appendChild(attackStat);

        const attackSpeedStat = createStatElement('SPD', `${hero.attackSpeed}/s`);
        statsContainer.appendChild(attackSpeedStat);

        const rangeStat = createStatElement('RNG', hero.attackRange);
        statsContainer.appendChild(rangeStat);

        // Toggle stats visibility
        let statsVisible = false;
        statsToggle.addEventListener('click', () => {
            statsVisible = !statsVisible;
            statsContainer.style.display = statsVisible ? 'block' : 'none';
            statsArrow.style.transform = statsVisible ? 'rotate(90deg)' : 'rotate(0deg)';
        });

        heroCard.appendChild(statsToggle);
        heroCard.appendChild(statsContainer);

        // Ability description
        const abilityDesc = document.createElement('div');
        abilityDesc.style.fontSize = '24px';
        abilityDesc.style.lineHeight = '1.4';
        abilityDesc.style.color = '#FFD700';
        abilityDesc.style.marginBottom = '8px';
        abilityDesc.style.fontStyle = 'italic';
        abilityDesc.style.fontWeight = 'bold';
        abilityDesc.textContent = `${hero.abilityDescription}`;
        abilityDesc.dataset.particleText = 'true';
        abilityDesc.dataset.particleColor = '#FFD700';
        heroCard.appendChild(abilityDesc);

        // Select/Deselect button
        const selectButton = document.createElement('button');
        selectButton.textContent = isSelected ? 'Deselect' : 'Select';
        selectButton.style.fontSize = '24px';
        selectButton.style.padding = '10px 20px';
        selectButton.style.marginTop = '10px';
        selectButton.style.backgroundColor = isSelected ? '#FF3333' : '#00FF88';
        selectButton.style.color = '#000000';
        selectButton.style.border = 'none';
        selectButton.style.borderRadius = '5px';
        selectButton.style.cursor = canSelect ? 'pointer' : 'not-allowed';
        selectButton.style.fontWeight = 'bold';
        selectButton.style.width = '100%';
        selectButton.style.transition = 'all 0.3s';
        selectButton.disabled = !canSelect;

        if (canSelect) {
            selectButton.addEventListener('mouseenter', () => {
                selectButton.style.transform = 'scale(1.05)';
                selectButton.style.backgroundColor = isSelected ? '#FF5555' : '#00FFAA';
            });

            selectButton.addEventListener('mouseleave', () => {
                selectButton.style.transform = 'scale(1)';
                selectButton.style.backgroundColor = isSelected ? '#FF3333' : '#00FF88';
            });

            selectButton.addEventListener('click', () => {
                onHeroToggle(hero.id, isSelected);
            });
        }

        heroCard.appendChild(selectButton);

        heroGrid.appendChild(heroCard);
    }

    container.appendChild(heroGrid);

    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '20px';
    actionContainer.style.marginTop = '20px';
    actionContainer.style.flexWrap = 'wrap';
    actionContainer.style.justifyContent = 'center';
    if (isCompactLayout) {
        actionContainer.style.flexDirection = 'column';
        actionContainer.style.alignItems = 'center';
    }

    const customizeButton = createButton('CUSTOMIZE LOADOUT', onCustomizeLoadout, '#00AAFF');
    actionContainer.appendChild(customizeButton);

    // Confirm button (only enabled if 4 heroes selected)
    if (selectedHeroes.length === 4) {
        const confirmButton = createButton('CONFIRM LOADOUT', onConfirm, '#00FF88');
        actionContainer.appendChild(confirmButton);
    }

    container.appendChild(actionContainer);
    menuParticleLayer?.requestTargetRefresh(container);
}

function createStatElement(label: string, value: string | number): HTMLDivElement {
    const stat = document.createElement('div');
    stat.textContent = `${label}: ${value}`;
    stat.style.color = '#CCCCCC';
    stat.style.fontWeight = 'bold';
    stat.dataset.particleText = 'true';
    stat.dataset.particleColor = '#CCCCCC';
    return stat;
}
