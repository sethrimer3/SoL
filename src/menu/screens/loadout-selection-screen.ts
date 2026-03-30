/**
 * Loadout Selection Screen Renderer
 * Displays faction carousel and hero selection with list + card detail view
 */

import { Faction } from '../../game-core';
import { FactionCarouselOption, HeroUnit } from '../types';
import { FactionCarouselView } from '../faction-carousel-view';

export interface LoadoutSelectionScreenParams {
    selectedFaction: Faction | null;
    selectedHeroes: string[];
    viewedHeroId: string | null;
    heroUnits: HeroUnit[];
    onFactionChange: (faction: Faction) => void;
    onHeroToggle: (heroId: string, isSelected: boolean) => void;
    onHeroView: (heroId: string) => void;
    onCustomizeLoadout: () => void;
    onConfirm: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
    onCarouselCreated: (carousel: FactionCarouselView) => void;
}

/** Faction color lookup */
function getFactionColor(faction: Faction | null): string {
    if (faction === Faction.RADIANT) return '#FF5722';
    if (faction === Faction.AURUM) return '#FFD700';
    if (faction === Faction.VELARIS) return '#9C27B0';
    return '#FFD700';
}

export function renderLoadoutSelectionScreen(
    container: HTMLElement,
    params: LoadoutSelectionScreenParams
): void {
    const {
        selectedFaction,
        selectedHeroes,
        viewedHeroId,
        heroUnits,
        onFactionChange,
        onHeroToggle,
        onHeroView,
        onCustomizeLoadout,
        onConfirm,
        onBack,
        createButton,
        menuParticleLayer,
        onCarouselCreated
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;
    const factionColor = getFactionColor(selectedFaction);

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

    // Selection counter
    const counter = document.createElement('div');
    counter.textContent = `Selected: ${selectedHeroes.length} / 4`;
    counter.style.fontSize = isCompactLayout ? '20px' : '22px';
    counter.style.marginBottom = isCompactLayout ? '10px' : '14px';
    counter.style.color = selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
    counter.style.fontWeight = 'bold';
    counter.style.textAlign = 'center';
    counter.dataset.particleText = 'true';
    counter.dataset.particleColor = selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
    container.appendChild(counter);

    // Filter heroes by selected faction
    const factionHeroes = heroUnits.filter(hero => hero.faction === selectedFaction);
    const viewedHero = factionHeroes.find(h => h.id === viewedHeroId) || factionHeroes[0] || null;

    // Hero selection area: left list + right card
    const heroArea = document.createElement('div');
    heroArea.style.display = 'flex';
    heroArea.style.flexDirection = isCompactLayout ? 'column' : 'row';
    heroArea.style.width = '100%';
    heroArea.style.maxWidth = '1100px';
    heroArea.style.gap = isCompactLayout ? '12px' : '20px';
    heroArea.style.padding = isCompactLayout ? '0 8px' : '0 16px';
    heroArea.style.marginBottom = '20px';
    heroArea.style.boxSizing = 'border-box';

    // ── LEFT PANEL: Scrollable hero list (1/3) ──
    const leftPanel = document.createElement('div');
    leftPanel.style.flex = isCompactLayout ? '0 0 auto' : '0 0 33%';
    leftPanel.style.maxHeight = isCompactLayout ? '260px' : '520px';
    leftPanel.style.overflowY = 'auto';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = isCompactLayout ? 'row' : 'column';
    leftPanel.style.gap = '10px';
    leftPanel.style.paddingRight = isCompactLayout ? '0' : '4px';
    if (isCompactLayout) {
        leftPanel.style.flexWrap = 'nowrap';
        leftPanel.style.overflowX = 'auto';
        leftPanel.style.overflowY = 'hidden';
    }

    for (const hero of factionHeroes) {
        const isInLoadout = selectedHeroes.includes(hero.id);
        const isViewed = viewedHero !== null && hero.id === viewedHero.id;

        const heroSquare = document.createElement('div');
        const squareSizePx = isCompactLayout ? 110 : 120;
        heroSquare.style.flex = `0 0 ${squareSizePx}px`;
        heroSquare.style.width = `${squareSizePx}px`;
        heroSquare.style.height = `${squareSizePx + 16}px`;
        heroSquare.style.backgroundColor = isViewed ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
        heroSquare.style.border = isViewed
            ? `2px solid ${factionColor}`
            : isInLoadout
                ? '2px solid #00FF88'
                : '2px solid rgba(255, 255, 255, 0.15)';
        heroSquare.style.borderRadius = '8px';
        heroSquare.style.cursor = 'pointer';
        heroSquare.style.display = 'flex';
        heroSquare.style.flexDirection = 'column';
        heroSquare.style.alignItems = 'center';
        heroSquare.style.justifyContent = 'center';
        heroSquare.style.gap = '6px';
        heroSquare.style.padding = '8px 4px';
        heroSquare.style.boxSizing = 'border-box';
        heroSquare.style.transition = 'all 0.2s';
        heroSquare.style.position = 'relative';
        heroSquare.dataset.particleBox = 'true';
        heroSquare.dataset.particleColor = isInLoadout ? '#00FF88' : factionColor;

        // Hero name (fit to square width)
        const nameEl = document.createElement('div');
        nameEl.textContent = hero.name;
        nameEl.style.fontSize = `${Math.min(18, squareSizePx / (hero.name.length * 0.55 + 1))}px`;
        nameEl.style.fontWeight = 'bold';
        nameEl.style.color = isViewed ? '#FFFFFF' : '#E0F2FF';
        nameEl.style.textAlign = 'center';
        nameEl.style.width = '100%';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.dataset.particleText = 'true';
        nameEl.dataset.particleColor = '#E0F2FF';
        heroSquare.appendChild(nameEl);

        // Sprite box with golden glow border
        const spriteBox = document.createElement('div');
        const spriteBoxSizePx = isCompactLayout ? 48 : 56;
        spriteBox.style.width = `${spriteBoxSizePx}px`;
        spriteBox.style.height = `${spriteBoxSizePx}px`;
        spriteBox.style.borderRadius = '8px';
        spriteBox.style.border = '2px solid #FFD700';
        spriteBox.style.boxShadow = '0 0 8px rgba(255, 215, 0, 0.6), 0 0 16px rgba(255, 215, 0, 0.3)';
        spriteBox.style.overflow = 'hidden';
        spriteBox.style.display = 'flex';
        spriteBox.style.alignItems = 'center';
        spriteBox.style.justifyContent = 'center';
        spriteBox.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';

        if (hero.spritePath) {
            const spriteImg = document.createElement('img');
            spriteImg.src = hero.spritePath;
            spriteImg.style.width = '100%';
            spriteImg.style.height = '100%';
            spriteImg.style.objectFit = 'contain';
            spriteImg.alt = hero.name;
            spriteBox.appendChild(spriteImg);
        } else {
            // Placeholder: first letter of hero name in faction color
            const placeholder = document.createElement('div');
            placeholder.textContent = hero.name.charAt(0);
            placeholder.style.fontSize = `${spriteBoxSizePx * 0.5}px`;
            placeholder.style.fontWeight = 'bold';
            placeholder.style.color = factionColor;
            placeholder.style.textAlign = 'center';
            spriteBox.appendChild(placeholder);
        }

        heroSquare.appendChild(spriteBox);

        // Loadout indicator (small green dot if selected)
        if (isInLoadout) {
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.top = '4px';
            dot.style.right = '4px';
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = '#00FF88';
            dot.style.boxShadow = '0 0 4px #00FF88';
            heroSquare.appendChild(dot);
        }

        heroSquare.addEventListener('mouseenter', () => {
            if (!isViewed) {
                heroSquare.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                heroSquare.style.transform = 'scale(1.03)';
            }
        });
        heroSquare.addEventListener('mouseleave', () => {
            heroSquare.style.backgroundColor = isViewed ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
            heroSquare.style.transform = 'scale(1)';
        });
        heroSquare.addEventListener('click', () => {
            onHeroView(hero.id);
        });

        leftPanel.appendChild(heroSquare);
    }

    heroArea.appendChild(leftPanel);

    // ── RIGHT PANEL: Hero playing card (2/3) ──
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = isCompactLayout ? '1 1 auto' : '1 1 67%';
    rightPanel.style.minHeight = isCompactLayout ? '400px' : '520px';

    if (viewedHero) {
        const isInLoadout = selectedHeroes.includes(viewedHero.id);
        const canSelect = isInLoadout || selectedHeroes.length < 4;

        // Playing card container
        const card = document.createElement('div');
        card.style.backgroundColor = 'rgba(12, 14, 22, 0.95)';
        card.style.border = `2px solid ${factionColor}`;
        card.style.borderRadius = '14px';
        card.style.overflow = 'hidden';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.height = '100%';
        card.style.boxShadow = `0 0 20px ${factionColor}33, 0 4px 24px rgba(0,0,0,0.5)`;
        card.dataset.particleBox = 'true';
        card.dataset.particleColor = factionColor;

        // ── Card top: Animated ability preview placeholder ──
        const previewArea = document.createElement('div');
        previewArea.style.position = 'relative';
        previewArea.style.width = '100%';
        previewArea.style.height = isCompactLayout ? '140px' : '180px';
        previewArea.style.background = `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, ${factionColor}22 50%, rgba(0,0,0,0.6) 100%)`;
        previewArea.style.display = 'flex';
        previewArea.style.alignItems = 'center';
        previewArea.style.justifyContent = 'center';
        previewArea.style.overflow = 'hidden';
        previewArea.style.borderBottom = `1px solid ${factionColor}44`;

        // Animated ring (CSS animation)
        const animRing = document.createElement('div');
        animRing.style.width = isCompactLayout ? '80px' : '100px';
        animRing.style.height = isCompactLayout ? '80px' : '100px';
        animRing.style.borderRadius = '50%';
        animRing.style.border = `3px solid ${factionColor}`;
        animRing.style.boxShadow = `0 0 20px ${factionColor}66, inset 0 0 20px ${factionColor}33`;
        animRing.style.display = 'flex';
        animRing.style.alignItems = 'center';
        animRing.style.justifyContent = 'center';
        animRing.style.position = 'relative';

        // Sprite inside ring (or placeholder)
        if (viewedHero.spritePath) {
            const previewImg = document.createElement('img');
            previewImg.src = viewedHero.spritePath;
            previewImg.style.width = '70%';
            previewImg.style.height = '70%';
            previewImg.style.objectFit = 'contain';
            previewImg.alt = viewedHero.name;
            animRing.appendChild(previewImg);
        } else {
            const previewLetter = document.createElement('div');
            previewLetter.textContent = viewedHero.name.charAt(0);
            previewLetter.style.fontSize = isCompactLayout ? '36px' : '44px';
            previewLetter.style.fontWeight = 'bold';
            previewLetter.style.color = factionColor;
            animRing.appendChild(previewLetter);
        }

        previewArea.appendChild(animRing);

        // Orbiting particle (CSS animated)
        const orbit = document.createElement('div');
        orbit.style.position = 'absolute';
        orbit.style.width = isCompactLayout ? '120px' : '150px';
        orbit.style.height = isCompactLayout ? '120px' : '150px';
        orbit.style.top = '50%';
        orbit.style.left = '50%';
        orbit.style.transform = 'translate(-50%, -50%)';
        orbit.style.pointerEvents = 'none';

        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '8px';
        particle.style.height = '8px';
        particle.style.borderRadius = '50%';
        particle.style.backgroundColor = factionColor;
        particle.style.boxShadow = `0 0 6px ${factionColor}`;
        particle.style.top = '0';
        particle.style.left = '50%';
        particle.style.transform = 'translateX(-50%)';
        orbit.appendChild(particle);

        // Inject keyframe animation for orbit
        const animId = `orbit-${Date.now()}`;
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            @keyframes ${animId} {
                from { transform: translate(-50%, -50%) rotate(0deg); }
                to { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 20px ${factionColor}66, inset 0 0 20px ${factionColor}33; }
                50% { box-shadow: 0 0 30px ${factionColor}99, inset 0 0 30px ${factionColor}55; }
            }
        `;
        previewArea.appendChild(styleEl);
        orbit.style.animation = `${animId} 3s linear infinite`;
        animRing.style.animation = `pulse-glow 2s ease-in-out infinite`;

        previewArea.appendChild(orbit);

        // "ABILITY PREVIEW" label
        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'ABILITY PREVIEW';
        previewLabel.style.position = 'absolute';
        previewLabel.style.bottom = '8px';
        previewLabel.style.right = '12px';
        previewLabel.style.fontSize = '11px';
        previewLabel.style.color = 'rgba(255,255,255,0.3)';
        previewLabel.style.letterSpacing = '2px';
        previewLabel.style.fontWeight = 'bold';
        previewArea.appendChild(previewLabel);

        card.appendChild(previewArea);

        // ── Card body ──
        const cardBody = document.createElement('div');
        cardBody.style.padding = isCompactLayout ? '14px' : '20px';
        cardBody.style.display = 'flex';
        cardBody.style.flexDirection = 'column';
        cardBody.style.gap = '10px';
        cardBody.style.flex = '1';
        cardBody.style.overflowY = 'auto';

        // Hero name
        const cardName = document.createElement('div');
        cardName.textContent = viewedHero.name;
        cardName.style.fontSize = isCompactLayout ? '26px' : '32px';
        cardName.style.fontWeight = 'bold';
        cardName.style.color = '#FFFFFF';
        cardName.dataset.particleText = 'true';
        cardName.dataset.particleColor = '#FFFFFF';
        cardBody.appendChild(cardName);

        // Hero description (subtitle)
        const cardDesc = document.createElement('div');
        cardDesc.textContent = viewedHero.description;
        cardDesc.style.fontSize = isCompactLayout ? '16px' : '18px';
        cardDesc.style.color = '#AAAAAA';
        cardDesc.style.fontWeight = 'bold';
        cardDesc.style.marginBottom = '4px';
        cardBody.appendChild(cardDesc);

        // Divider
        const divider1 = document.createElement('div');
        divider1.style.height = '1px';
        divider1.style.background = `linear-gradient(to right, transparent, ${factionColor}66, transparent)`;
        cardBody.appendChild(divider1);

        // Ability description
        const abilityTitle = document.createElement('div');
        abilityTitle.textContent = 'ABILITY';
        abilityTitle.style.fontSize = '12px';
        abilityTitle.style.color = 'rgba(255,255,255,0.4)';
        abilityTitle.style.letterSpacing = '2px';
        abilityTitle.style.fontWeight = 'bold';
        cardBody.appendChild(abilityTitle);

        const abilityDesc = document.createElement('div');
        abilityDesc.textContent = viewedHero.abilityDescription;
        abilityDesc.style.fontSize = isCompactLayout ? '16px' : '18px';
        abilityDesc.style.lineHeight = '1.5';
        abilityDesc.style.color = '#FFD700';
        abilityDesc.style.fontStyle = 'italic';
        abilityDesc.style.fontWeight = 'bold';
        abilityDesc.dataset.particleText = 'true';
        abilityDesc.dataset.particleColor = '#FFD700';
        cardBody.appendChild(abilityDesc);

        // Divider
        const divider2 = document.createElement('div');
        divider2.style.height = '1px';
        divider2.style.background = `linear-gradient(to right, transparent, ${factionColor}66, transparent)`;
        cardBody.appendChild(divider2);

        // Stats section
        const statsTitle = document.createElement('div');
        statsTitle.textContent = 'STATS';
        statsTitle.style.fontSize = '12px';
        statsTitle.style.color = 'rgba(255,255,255,0.4)';
        statsTitle.style.letterSpacing = '2px';
        statsTitle.style.fontWeight = 'bold';
        cardBody.appendChild(statsTitle);

        const statsGrid = document.createElement('div');
        statsGrid.style.display = 'grid';
        statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        statsGrid.style.gap = '6px 16px';

        const statFontSize = isCompactLayout ? '15px' : '17px';
        statsGrid.appendChild(createStatRow('HP', `${viewedHero.maxHealth}`, statFontSize));
        statsGrid.appendChild(createStatRow('DEF', `${viewedHero.defense}%`, statFontSize));
        const atkLabel = viewedHero.attackIgnoresDefense ? `${viewedHero.attackDamage} (true)` : `${viewedHero.attackDamage}`;
        statsGrid.appendChild(createStatRow('ATK', atkLabel, statFontSize));
        statsGrid.appendChild(createStatRow('SPD', `${viewedHero.attackSpeed}/s`, statFontSize));
        statsGrid.appendChild(createStatRow('RNG', `${Math.round(viewedHero.attackRange)}`, statFontSize));
        statsGrid.appendChild(createStatRow('RGN', `${viewedHero.regen}%`, statFontSize));

        cardBody.appendChild(statsGrid);

        // Spacer to push button to bottom
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        cardBody.appendChild(spacer);

        // Select / Deselect button
        const selectButton = document.createElement('button');
        selectButton.textContent = isInLoadout ? 'DESELECT' : 'SELECT';
        selectButton.style.fontSize = isCompactLayout ? '20px' : '22px';
        selectButton.style.padding = '12px 20px';
        selectButton.style.marginTop = '8px';
        selectButton.style.backgroundColor = isInLoadout ? '#B22222' : '#0E8A45';
        selectButton.style.color = '#FFFFFF';
        selectButton.style.border = 'none';
        selectButton.style.borderRadius = '8px';
        selectButton.style.cursor = canSelect ? 'pointer' : 'not-allowed';
        selectButton.style.fontFamily = '"Doto", Arial, sans-serif';
        selectButton.style.fontWeight = 'bold';
        selectButton.style.width = '100%';
        selectButton.style.transition = 'all 0.2s';
        selectButton.style.opacity = canSelect ? '1' : '0.5';
        selectButton.disabled = !canSelect;

        if (canSelect) {
            selectButton.addEventListener('mouseenter', () => {
                selectButton.style.transform = 'scale(1.03)';
                selectButton.style.backgroundColor = isInLoadout ? '#8B1A1A' : '#0A6F37';
            });
            selectButton.addEventListener('mouseleave', () => {
                selectButton.style.transform = 'scale(1)';
                selectButton.style.backgroundColor = isInLoadout ? '#B22222' : '#0E8A45';
            });
            selectButton.addEventListener('click', () => {
                onHeroToggle(viewedHero.id, isInLoadout);
            });
        }

        cardBody.appendChild(selectButton);
        card.appendChild(cardBody);
        rightPanel.appendChild(card);
    } else {
        // No heroes for this faction
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'No heroes available for this faction.';
        emptyMsg.style.color = '#666666';
        emptyMsg.style.fontSize = '20px';
        emptyMsg.style.fontWeight = 'bold';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '40px';
        rightPanel.appendChild(emptyMsg);
    }

    heroArea.appendChild(rightPanel);
    container.appendChild(heroArea);

    // Action buttons
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '20px';
    actionContainer.style.marginTop = '10px';
    actionContainer.style.flexWrap = 'wrap';
    actionContainer.style.justifyContent = 'center';
    if (isCompactLayout) {
        actionContainer.style.flexDirection = 'column';
        actionContainer.style.alignItems = 'center';
    }

    const customizeButton = createButton('CUSTOMIZE LOADOUT', onCustomizeLoadout, '#00AAFF');
    actionContainer.appendChild(customizeButton);

    if (selectedHeroes.length === 4) {
        const confirmButton = createButton('CONFIRM LOADOUT', onConfirm, '#00FF88');
        actionContainer.appendChild(confirmButton);
    }

    container.appendChild(actionContainer);
    menuParticleLayer?.requestTargetRefresh(container);
}

function createStatRow(label: string, value: string, fontSize: string): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.fontSize = fontSize;
    labelEl.style.color = '#888888';
    labelEl.style.fontWeight = 'bold';
    row.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    valueEl.style.fontSize = fontSize;
    valueEl.style.color = '#E0F2FF';
    valueEl.style.fontWeight = 'bold';
    valueEl.dataset.particleText = 'true';
    valueEl.dataset.particleColor = '#E0F2FF';
    row.appendChild(valueEl);

    return row;
}
