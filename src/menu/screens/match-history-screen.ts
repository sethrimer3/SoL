/**
 * Match History Screen Renderer
 * Displays player's match history with MMR stats and replay viewer
 */

import { Faction } from '../../game-core';
import { MatchHistoryEntry, getMatchHistory, getPlayerMMRData, loadReplayFromStorage } from '../../replay';

export interface MatchHistoryScreenParams {
    onBack: () => void;
    onLaunchReplay: (match: MatchHistoryEntry) => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderMatchHistoryScreen(
    container: HTMLElement,
    params: MatchHistoryScreenParams
): void {
    const { onBack, onLaunchReplay, createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Match History';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Get match history
    const matchHistory = getMatchHistory();
    
    if (matchHistory.length === 0) {
        // No matches yet
        const noMatchesText = document.createElement('p');
        noMatchesText.textContent = 'No matches played yet. Start a game to build your match history!';
        noMatchesText.style.fontSize = '18px';
        noMatchesText.style.textAlign = 'center';
        noMatchesText.style.color = 'rgba(255, 255, 255, 0.7)';
        noMatchesText.style.maxWidth = '500px';
        noMatchesText.style.margin = '40px auto';
        container.appendChild(noMatchesText);
    } else {
        // Show MMR stats
        const mmrData = getPlayerMMRData();
        const statsContainer = document.createElement('div');
        statsContainer.style.display = 'flex';
        statsContainer.style.justifyContent = 'center';
        statsContainer.style.gap = '30px';
        statsContainer.style.marginBottom = '30px';
        statsContainer.style.flexWrap = 'wrap';

        const createStatBox = (label: string, value: string, color: string = '#FFFFFF') => {
            const box = document.createElement('div');
            box.style.textAlign = 'center';
            box.style.padding = '15px 20px';
            box.style.borderRadius = '8px';
            box.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            box.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            
            const valueElem = document.createElement('div');
            valueElem.textContent = value;
            valueElem.style.fontSize = '28px';
            valueElem.style.fontWeight = '500';
            valueElem.style.color = color;
            valueElem.style.marginBottom = '5px';
            
            const labelElem = document.createElement('div');
            labelElem.textContent = label;
            labelElem.style.fontSize = '14px';
            labelElem.style.color = 'rgba(255, 255, 255, 0.7)';
            labelElem.style.textTransform = 'uppercase';
            labelElem.style.letterSpacing = '0.05em';
            
            box.appendChild(valueElem);
            box.appendChild(labelElem);
            return box;
        };

        statsContainer.appendChild(createStatBox('MMR', mmrData.mmr.toString(), '#FFD700'));
        statsContainer.appendChild(createStatBox('Wins', mmrData.wins.toString(), '#4CAF50'));
        statsContainer.appendChild(createStatBox('Losses', mmrData.losses.toString(), '#F44336'));
        const winRate = mmrData.gamesPlayed > 0 
            ? Math.round((mmrData.wins / mmrData.gamesPlayed) * 100) 
            : 0;
        statsContainer.appendChild(createStatBox('Win Rate', `${winRate}%`, '#2196F3'));
        
        container.appendChild(statsContainer);

        // Match history carousel container
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = '900px';
        carouselContainer.style.height = isCompactLayout ? '400px' : '500px';
        carouselContainer.style.margin = '0 auto';
        carouselContainer.style.position = 'relative';
        container.appendChild(carouselContainer);

        // Create match history carousel
        renderMatchHistoryCarousel(carouselContainer, matchHistory, isCompactLayout, createButton, onLaunchReplay);
    }

    // Back button
    const backButton = createButton('← Back to Menu', onBack);
    backButton.style.marginTop = '30px';
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}

function renderMatchHistoryCarousel(
    container: HTMLElement, 
    matches: MatchHistoryEntry[], 
    isCompactLayout: boolean,
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement,
    onLaunchReplay: (match: MatchHistoryEntry) => void
): void {
    // Create wrapper for match cards
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'hidden';
    container.appendChild(wrapper);

    let currentIndex = 0;
    const cardWidth = isCompactLayout ? 300 : 400;
    const cardGap = 20;

    const renderCards = () => {
        wrapper.innerHTML = '';
        
        // Calculate visible range
        const startIndex = Math.max(0, currentIndex - 1);
        const endIndex = Math.min(matches.length, currentIndex + 2);

        for (let i = startIndex; i < endIndex; i++) {
            const match = matches[i];
            const card = createMatchHistoryCard(match, isCompactLayout, createButton, onLaunchReplay);
            
            const offset = (i - currentIndex) * (cardWidth + cardGap);
            const scale = i === currentIndex ? 1.0 : 0.85;
            const opacity = i === currentIndex ? 1.0 : 0.5;
            
            card.style.position = 'absolute';
            card.style.left = '50%';
            card.style.top = '50%';
            card.style.transform = `translate(calc(-50% + ${offset}px), -50%) scale(${scale})`;
            card.style.opacity = opacity.toString();
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            card.style.width = `${cardWidth}px`;
            card.style.pointerEvents = i === currentIndex ? 'auto' : 'none';
            
            wrapper.appendChild(card);
        }

        // Navigation buttons
        if (currentIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '‹';
            prevBtn.style.position = 'absolute';
            prevBtn.style.left = '10px';
            prevBtn.style.top = '50%';
            prevBtn.style.transform = 'translateY(-50%)';
            prevBtn.style.fontSize = '48px';
            prevBtn.style.background = 'rgba(0, 0, 0, 0.6)';
            prevBtn.style.border = '2px solid rgba(255, 255, 255, 0.4)';
            prevBtn.style.color = '#FFFFFF';
            prevBtn.style.width = '50px';
            prevBtn.style.height = '50px';
            prevBtn.style.borderRadius = '50%';
            prevBtn.style.cursor = 'pointer';
            prevBtn.style.zIndex = '10';
            prevBtn.onclick = () => {
                currentIndex--;
                renderCards();
            };
            wrapper.appendChild(prevBtn);
        }

        if (currentIndex < matches.length - 1) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '›';
            nextBtn.style.position = 'absolute';
            nextBtn.style.right = '10px';
            nextBtn.style.top = '50%';
            nextBtn.style.transform = 'translateY(-50%)';
            nextBtn.style.fontSize = '48px';
            nextBtn.style.background = 'rgba(0, 0, 0, 0.6)';
            nextBtn.style.border = '2px solid rgba(255, 255, 255, 0.4)';
            nextBtn.style.color = '#FFFFFF';
            nextBtn.style.width = '50px';
            nextBtn.style.height = '50px';
            nextBtn.style.borderRadius = '50%';
            nextBtn.style.cursor = 'pointer';
            nextBtn.style.zIndex = '10';
            nextBtn.onclick = () => {
                currentIndex++;
                renderCards();
            };
            wrapper.appendChild(nextBtn);
        }
    };

    renderCards();
}

function createMatchHistoryCard(
    match: MatchHistoryEntry, 
    isCompactLayout: boolean,
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement,
    onLaunchReplay: (match: MatchHistoryEntry) => void
): HTMLElement {
    const card = document.createElement('div');
    card.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    card.style.border = `2px solid ${match.isVictory ? '#4CAF50' : '#F44336'}`;
    card.style.borderRadius = '12px';
    card.style.padding = isCompactLayout ? '15px' : '20px';
    card.style.boxSizing = 'border-box';

    // Result header
    const resultHeader = document.createElement('div');
    resultHeader.textContent = match.isVictory ? '🏆 VICTORY' : '💀 DEFEAT';
    resultHeader.style.fontSize = isCompactLayout ? '20px' : '24px';
    resultHeader.style.fontWeight = '600';
    resultHeader.style.color = match.isVictory ? '#4CAF50' : '#F44336';
    resultHeader.style.textAlign = 'center';
    resultHeader.style.marginBottom = '15px';
    resultHeader.style.textTransform = 'uppercase';
    resultHeader.style.letterSpacing = '0.1em';
    card.appendChild(resultHeader);

    // Match info grid
    const infoGrid = document.createElement('div');
    infoGrid.style.display = 'grid';
    infoGrid.style.gridTemplateColumns = '1fr 1fr';
    infoGrid.style.gap = '10px';
    infoGrid.style.marginBottom = '15px';

    const createInfoRow = (label: string, value: string, fullWidth: boolean = false) => {
        const row = document.createElement('div');
        // fullWidth=true spans both columns for entries that need more space (e.g., long map names)
        if (fullWidth) {
            row.style.gridColumn = '1 / -1';
        }
        
        const labelElem = document.createElement('div');
        labelElem.textContent = label;
        labelElem.style.fontSize = '12px';
        labelElem.style.color = 'rgba(255, 255, 255, 0.6)';
        labelElem.style.marginBottom = '3px';
        labelElem.style.textTransform = 'uppercase';
        labelElem.style.letterSpacing = '0.05em';
        
        const valueElem = document.createElement('div');
        valueElem.textContent = value;
        valueElem.style.fontSize = isCompactLayout ? '14px' : '16px';
        valueElem.style.color = '#FFFFFF';
        valueElem.style.fontWeight = '500';
        
        row.appendChild(labelElem);
        row.appendChild(valueElem);
        return row;
    };

    const factionName = (faction: Faction) => {
        switch (faction) {
            case Faction.RADIANT: return 'Radiant';
            case Faction.AURUM: return 'Aurum';
            case Faction.VELARIS: return 'Velaris';
            default: return 'Unknown';
        }
    };

    infoGrid.appendChild(createInfoRow('You', `${match.localPlayerName} (${factionName(match.localPlayerFaction)})`));
    infoGrid.appendChild(createInfoRow('Opponent', `${match.opponentName} (${factionName(match.opponentFaction)})`));
    infoGrid.appendChild(createInfoRow('Map', match.mapName, true));
    infoGrid.appendChild(createInfoRow('Mode', match.gameMode.toUpperCase()));
    
    const minutes = Math.floor(match.duration / 60);
    const seconds = Math.floor(match.duration % 60);
    infoGrid.appendChild(createInfoRow('Duration', `${minutes}:${seconds.toString().padStart(2, '0')}`));
    
    card.appendChild(infoGrid);

    // MMR section
    const mmrSection = document.createElement('div');
    mmrSection.style.display = 'flex';
    mmrSection.style.justifyContent = 'space-around';
    mmrSection.style.alignItems = 'center';
    mmrSection.style.padding = '12px';
    mmrSection.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    mmrSection.style.borderRadius = '8px';
    mmrSection.style.marginBottom = '15px';

    const createMMRBox = (label: string, value: string, color: string) => {
        const box = document.createElement('div');
        box.style.textAlign = 'center';
        
        const valueElem = document.createElement('div');
        valueElem.textContent = value;
        valueElem.style.fontSize = isCompactLayout ? '18px' : '22px';
        valueElem.style.fontWeight = '600';
        valueElem.style.color = color;
        
        const labelElem = document.createElement('div');
        labelElem.textContent = label;
        labelElem.style.fontSize = '11px';
        labelElem.style.color = 'rgba(255, 255, 255, 0.6)';
        labelElem.style.textTransform = 'uppercase';
        labelElem.style.marginTop = '3px';
        
        box.appendChild(valueElem);
        box.appendChild(labelElem);
        return box;
    };

    mmrSection.appendChild(createMMRBox('Your MMR', match.localPlayerMMR.toString(), '#FFD700'));
    
    const changeColor = match.mmrChange >= 0 ? '#4CAF50' : '#F44336';
    const changeText = match.mmrChange >= 0 ? `+${match.mmrChange}` : match.mmrChange.toString();
    mmrSection.appendChild(createMMRBox('Change', changeText, changeColor));
    
    if (match.opponentMMR !== undefined) {
        mmrSection.appendChild(createMMRBox('Opp MMR', match.opponentMMR.toString(), '#2196F3'));
    }
    
    card.appendChild(mmrSection);

    // View Replay button
    const replayButton = createButton('▶ View Replay', () => {
        onLaunchReplay(match);
    });
    replayButton.style.width = '100%';
    replayButton.style.fontSize = isCompactLayout ? '14px' : '16px';
    replayButton.style.padding = isCompactLayout ? '10px' : '12px';
    card.appendChild(replayButton);

    // Date stamp at bottom
    const dateStamp = document.createElement('div');
    const date = new Date(match.timestamp);
    dateStamp.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    dateStamp.style.fontSize = '11px';
    dateStamp.style.color = 'rgba(255, 255, 255, 0.4)';
    dateStamp.style.textAlign = 'center';
    dateStamp.style.marginTop = '10px';
    card.appendChild(dateStamp);

    return card;
}
