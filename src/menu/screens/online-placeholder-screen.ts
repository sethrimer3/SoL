/**
 * Online Placeholder Screen Renderer
 * Displays "coming soon" message for online play
 */

export interface OnlinePlaceholderScreenParams {
    onlineMode: 'ranked' | 'unranked';
    onModeChange: (mode: 'ranked' | 'unranked') => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderOnlinePlaceholderScreen(
    container: HTMLElement,
    params: OnlinePlaceholderScreenParams
): void {
    const { onlineMode, onModeChange, onBack, createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Online Play';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Ranked/Unranked button container
    const modeButtonContainer = document.createElement('div');
    modeButtonContainer.style.display = 'flex';
    modeButtonContainer.style.gap = '20px';
    modeButtonContainer.style.marginBottom = '30px';
    modeButtonContainer.style.justifyContent = 'center';

    const unrankedButton = createButton('UNRANKED', () => {
        onModeChange('unranked');
    }, onlineMode === 'unranked' ? '#FF8800' : '#666666');
    unrankedButton.style.padding = '12px 24px';
    unrankedButton.style.fontSize = '18px';
    if (onlineMode === 'unranked') {
        unrankedButton.style.border = '2px solid #FF8800';
        unrankedButton.style.boxShadow = '0 0 15px rgba(255, 136, 0, 0.5)';
    }
    modeButtonContainer.appendChild(unrankedButton);

    const rankedButton = createButton('RANKED', () => {
        onModeChange('ranked');
    }, onlineMode === 'ranked' ? '#FF8800' : '#666666');
    rankedButton.style.padding = '12px 24px';
    rankedButton.style.fontSize = '18px';
    if (onlineMode === 'ranked') {
        rankedButton.style.border = '2px solid #FF8800';
        rankedButton.style.boxShadow = '0 0 15px rgba(255, 136, 0, 0.5)';
    }
    modeButtonContainer.appendChild(rankedButton);

    container.appendChild(modeButtonContainer);

    // Coming soon message
    const message = document.createElement('div');
    message.style.maxWidth = '600px';
    message.style.padding = '40px';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    message.style.borderRadius = '10px';
    message.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    message.style.marginBottom = '30px';

    const messageTitle = document.createElement('h3');
    messageTitle.textContent = 'Coming Soon!';
    messageTitle.style.fontSize = '32px';
    messageTitle.style.color = '#FFD700';
    messageTitle.style.textAlign = 'center';
    messageTitle.style.marginBottom = '20px';
    messageTitle.style.fontWeight = '300';
    message.appendChild(messageTitle);

    const messageText = document.createElement('p');
    messageText.innerHTML = `
        Online multiplayer is currently in development.<br><br>
        <strong>Features:</strong><br>
        • Simple, efficient data transmission<br>
        • Prioritized for speed and minimal data size<br>
        • Cross-platform matchmaking<br>
        • Ranked and casual modes
    `;
    messageText.style.fontSize = '20px';
    messageText.style.color = '#CCCCCC';
    messageText.style.textAlign = 'center';
    messageText.style.lineHeight = '1.6';
    message.appendChild(messageText);

    container.appendChild(message);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
