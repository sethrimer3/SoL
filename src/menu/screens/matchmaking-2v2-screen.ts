/**
 * 2v2 Matchmaking Screen Renderer
 * Displays matchmaking interface for ranked 2v2 games
 */

import { MenuOption } from '../types';

export interface Matchmaking2v2ScreenParams {
    onStartMatchmaking: () => void;
    onCancelMatchmaking: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
    currentMMR: number;
    wins: number;
    losses: number;
    isSearching?: boolean;
}

export function renderMatchmaking2v2Screen(
    container: HTMLElement,
    params: Matchmaking2v2ScreenParams
): void {
    const { 
        onStartMatchmaking, 
        onCancelMatchmaking,
        onBack, 
        createButton, 
        menuParticleLayer,
        currentMMR,
        wins,
        losses,
        isSearching = false
    } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = '2v2 Matchmaking';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Stats section
    const statsSection = document.createElement('div');
    statsSection.style.width = '100%';
    statsSection.style.maxWidth = '600px';
    statsSection.style.marginBottom = '30px';
    statsSection.style.padding = '20px';
    statsSection.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    statsSection.style.borderRadius = '10px';
    statsSection.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    container.appendChild(statsSection);

    const statsTitle = document.createElement('h3');
    statsTitle.textContent = '2v2 Ranked Stats';
    statsTitle.style.fontSize = '24px';
    statsTitle.style.color = '#FFD700';
    statsTitle.style.marginBottom = '15px';
    statsTitle.style.textAlign = 'center';
    statsSection.appendChild(statsTitle);

    // MMR display
    const mmrDisplay = document.createElement('div');
    mmrDisplay.style.fontSize = '48px';
    mmrDisplay.style.fontWeight = 'bold';
    mmrDisplay.style.color = '#00FFFF';
    mmrDisplay.style.textAlign = 'center';
    mmrDisplay.style.marginBottom = '10px';
    mmrDisplay.textContent = currentMMR.toString();
    statsSection.appendChild(mmrDisplay);

    const mmrLabel = document.createElement('div');
    mmrLabel.style.fontSize = '14px';
    mmrLabel.style.color = '#999999';
    mmrLabel.style.textAlign = 'center';
    mmrLabel.style.marginBottom = '20px';
    mmrLabel.textContent = 'MMR';
    statsSection.appendChild(mmrLabel);

    // Win/Loss record
    const recordDisplay = document.createElement('div');
    recordDisplay.style.fontSize = '20px';
    recordDisplay.style.color = '#ffffff';
    recordDisplay.style.textAlign = 'center';
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    recordDisplay.innerHTML = `
        <span style="color: #00FF00;">${wins}W</span> - 
        <span style="color: #FF0000;">${losses}L</span>
        <span style="color: #999999;">(${winRate}%)</span>
    `;
    statsSection.appendChild(recordDisplay);

    // Matchmaking section
    const matchmakingSection = document.createElement('div');
    matchmakingSection.style.width = '100%';
    matchmakingSection.style.maxWidth = '600px';
    matchmakingSection.style.marginBottom = '30px';
    matchmakingSection.style.padding = '20px';
    matchmakingSection.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    matchmakingSection.style.borderRadius = '10px';
    matchmakingSection.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    container.appendChild(matchmakingSection);

    if (isSearching) {
        const searchingText = document.createElement('div');
        searchingText.textContent = 'Searching for match...';
        searchingText.style.fontSize = '24px';
        searchingText.style.color = '#00FFFF';
        searchingText.style.textAlign = 'center';
        searchingText.style.marginBottom = '20px';
        matchmakingSection.appendChild(searchingText);

        const searchingInfo = document.createElement('div');
        searchingInfo.textContent = 'Looking for players with similar MMR';
        searchingInfo.style.fontSize = '14px';
        searchingInfo.style.color = '#999999';
        searchingInfo.style.textAlign = 'center';
        searchingInfo.style.marginBottom = '20px';
        matchmakingSection.appendChild(searchingInfo);

        const cancelButton = createButton('CANCEL', onCancelMatchmaking, '#FF4444');
        cancelButton.style.width = '100%';
        matchmakingSection.appendChild(cancelButton);
    } else {
        const readyText = document.createElement('div');
        readyText.textContent = 'Ready to play?';
        readyText.style.fontSize = '24px';
        readyText.style.color = '#FFD700';
        readyText.style.textAlign = 'center';
        readyText.style.marginBottom = '20px';
        matchmakingSection.appendChild(readyText);

        const findMatchButton = createButton('FIND MATCH', onStartMatchmaking, '#00FF00');
        findMatchButton.style.width = '100%';
        findMatchButton.style.fontSize = '20px';
        matchmakingSection.appendChild(findMatchButton);
    }

    // Info section
    const infoSection = document.createElement('div');
    infoSection.style.width = '100%';
    infoSection.style.maxWidth = '600px';
    infoSection.style.marginBottom = '20px';
    infoSection.style.padding = '15px';
    infoSection.style.backgroundColor = 'rgba(0, 0, 50, 0.3)';
    infoSection.style.borderRadius = '10px';
    infoSection.style.border = '2px solid rgba(100, 150, 255, 0.3)';
    infoSection.style.fontSize = '14px';
    infoSection.style.color = '#cccccc';
    infoSection.style.lineHeight = '1.6';
    container.appendChild(infoSection);

    const infoText = document.createElement('div');
    infoText.innerHTML = `
        <strong style="color: #FFD700;">2v2 Ranked Matchmaking:</strong><br>
        • Team up with another player against 2 opponents<br>
        • Win or lose MMR based on match outcome<br>
        • Separate MMR from 1v1 ranked games<br>
        • Pre-configured teams and colors
    `;
    infoSection.appendChild(infoText);

    // Back button
    if (!isSearching) {
        const backButton = createButton('BACK', onBack, '#666666');
        backButton.style.marginTop = '30px';
        container.appendChild(backButton);
    }

    menuParticleLayer?.requestTargetRefresh(container);
}
