/**
 * LAN Screen Renderer
 * Displays LAN multiplayer host/join options and available lobbies
 */

export interface LANScreenParams {
    onHostServer: () => void;
    onJoinServer: () => void;
    onBack: () => void;
    renderLanLobbyList: (container: HTMLElement) => void;
    scheduleLanLobbyListRefresh: (container: HTMLElement) => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderLANScreen(
    container: HTMLElement,
    params: LANScreenParams
): void {
    const { onHostServer, onJoinServer, onBack, renderLanLobbyList, scheduleLanLobbyListRefresh, createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'LAN Play';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Host server button
    const hostButton = createButton('HOST SERVER', onHostServer, '#00AA00');
    hostButton.style.marginBottom = '20px';
    hostButton.style.padding = '15px 40px';
    hostButton.style.fontSize = '28px';
    container.appendChild(hostButton);

    // Join server button
    const joinButton = createButton('JOIN SERVER', onJoinServer, '#0088FF');
    joinButton.style.marginBottom = '40px';
    joinButton.style.padding = '15px 40px';
    joinButton.style.fontSize = '28px';
    container.appendChild(joinButton);

    // LAN lobby list
    const listContainer = document.createElement('div');
    listContainer.style.maxWidth = '720px';
    listContainer.style.width = '100%';
    listContainer.style.padding = '20px';
    listContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    listContainer.style.borderRadius = '12px';
    listContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
    listContainer.style.marginBottom = '30px';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '14px';

    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Available LAN Lobbies';
    listTitle.style.fontSize = '22px';
    listTitle.style.margin = '0';
    listTitle.style.color = '#FFD700';
    listTitle.style.textAlign = 'center';
    listContainer.appendChild(listTitle);

    const listContent = document.createElement('div');
    listContent.style.display = 'flex';
    listContent.style.flexDirection = 'column';
    listContent.style.gap = '12px';
    listContainer.appendChild(listContent);

    renderLanLobbyList(listContent);
    scheduleLanLobbyListRefresh(listContent);

    container.appendChild(listContainer);

    // Info section
    const infoContainer = document.createElement('div');
    infoContainer.style.maxWidth = '600px';
    infoContainer.style.width = '100%';
    infoContainer.style.padding = '20px';
    infoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    infoContainer.style.borderRadius = '10px';
    infoContainer.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    infoContainer.style.marginBottom = '30px';

    const infoTitle = document.createElement('h3');
    infoTitle.textContent = 'How LAN Play Works';
    infoTitle.style.fontSize = '24px';
    infoTitle.style.marginBottom = '15px';
    infoTitle.style.color = '#FFD700';
    infoTitle.style.textAlign = 'center';
    infoContainer.appendChild(infoTitle);

    const infoText = document.createElement('p');
    infoText.innerHTML = `
            <strong>For Host:</strong><br>
            1. Click "HOST SERVER" to create a lobby<br>
            2. Share the connection code with other players<br>
            3. Wait for players to join<br>
            4. Start the game when ready<br><br>
            <strong>For Client:</strong><br>
            1. Click "JOIN SERVER"<br>
            2. Enter the connection code from the host<br>
            3. Wait in lobby for host to start the game
        `;
    infoText.style.color = '#CCCCCC';
    infoText.style.fontSize = '16px';
    infoText.style.lineHeight = '1.6';
    infoContainer.appendChild(infoText);

    container.appendChild(infoContainer);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
