/**
 * P2P Multiplayer Menu Screen Renderer
 * Displays host and join options for P2P multiplayer
 */

export interface P2PMenuScreenParams {
    onHost: () => void;
    onJoin: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderP2PMenuScreen(
    container: HTMLElement,
    params: P2PMenuScreenParams
): void {
    const { onHost, onJoin, onBack, createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'P2P Multiplayer (Beta)';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Host match button
    const hostButton = createButton('HOST MATCH', onHost, '#00AA00');
    hostButton.style.marginBottom = '20px';
    hostButton.style.padding = '15px 40px';
    hostButton.style.fontSize = '28px';
    container.appendChild(hostButton);

    // Join match button
    const joinButton = createButton('JOIN MATCH', onJoin, '#0088FF');
    joinButton.style.marginBottom = '40px';
    joinButton.style.padding = '15px 40px';
    joinButton.style.fontSize = '28px';
    container.appendChild(joinButton);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
