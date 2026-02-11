/**
 * Custom Lobby Screen Renderer
 * Displays lobby creation/joining interface for 2v2 games
 */

import { MenuOption } from '../types';

export interface GameRoom {
    id: string;
    name: string;
    host_id: string;
    status: string;
    max_players: number;
    game_mode?: string;
    created_at?: string;
}

export interface CustomLobbyScreenParams {
    onCreateLobby: (lobbyName: string) => void;
    onJoinLobby: (lobbyId: string) => void;
    onBack: () => void;
    onRefresh?: () => void;
    lobbies?: GameRoom[];
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderCustomLobbyScreen(
    container: HTMLElement,
    params: CustomLobbyScreenParams
): void {
    const { onCreateLobby, onJoinLobby, onBack, onRefresh, lobbies = [], createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Custom 2v2 Lobby';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Create lobby section
    const createSection = document.createElement('div');
    createSection.style.width = '100%';
    createSection.style.maxWidth = '600px';
    createSection.style.marginBottom = '30px';
    createSection.style.padding = '20px';
    createSection.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    createSection.style.borderRadius = '10px';
    createSection.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    container.appendChild(createSection);

    const createTitle = document.createElement('h3');
    createTitle.textContent = 'Create New Lobby';
    createTitle.style.fontSize = '24px';
    createTitle.style.color = '#FFD700';
    createTitle.style.marginBottom = '15px';
    createTitle.style.textAlign = 'center';
    createSection.appendChild(createTitle);

    // Lobby name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter lobby name...';
    nameInput.style.width = 'calc(100% - 20px)';
    nameInput.style.padding = '10px';
    nameInput.style.fontSize = '16px';
    nameInput.style.marginBottom = '15px';
    nameInput.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    nameInput.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    nameInput.style.borderRadius = '5px';
    nameInput.style.color = '#ffffff';
    createSection.appendChild(nameInput);

    // Create lobby button
    const createLobbyButton = createButton('CREATE LOBBY', () => {
        const lobbyName = nameInput.value.trim();
        if (lobbyName) {
            onCreateLobby(lobbyName);
        } else {
            alert('Please enter a lobby name');
        }
    });
    createLobbyButton.style.width = '100%';
    createLobbyButton.style.marginTop = '10px';
    createSection.appendChild(createLobbyButton);

    // Join lobby section
    const joinSection = document.createElement('div');
    joinSection.style.width = '100%';
    joinSection.style.maxWidth = '600px';
    joinSection.style.marginBottom = '30px';
    joinSection.style.padding = '20px';
    joinSection.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    joinSection.style.borderRadius = '10px';
    joinSection.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    container.appendChild(joinSection);

    const joinTitleRow = document.createElement('div');
    joinTitleRow.style.display = 'flex';
    joinTitleRow.style.justifyContent = 'space-between';
    joinTitleRow.style.alignItems = 'center';
    joinTitleRow.style.marginBottom = '15px';
    joinSection.appendChild(joinTitleRow);

    const joinTitle = document.createElement('h3');
    joinTitle.textContent = 'Join Existing Lobby';
    joinTitle.style.fontSize = '24px';
    joinTitle.style.color = '#FFD700';
    joinTitle.style.margin = '0';
    joinTitleRow.appendChild(joinTitle);

    // Refresh button
    if (onRefresh) {
        const refreshButton = createButton('↻ Refresh', onRefresh, '#4CAF50');
        refreshButton.style.fontSize = '16px';
        refreshButton.style.padding = '8px 16px';
        joinTitleRow.appendChild(refreshButton);
    }

    // Lobby list
    const lobbyList = document.createElement('div');
    lobbyList.style.width = '100%';
    lobbyList.style.minHeight = '150px';
    lobbyList.style.maxHeight = '300px';
    lobbyList.style.overflowY = 'auto';
    lobbyList.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    lobbyList.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    lobbyList.style.borderRadius = '5px';
    lobbyList.style.padding = '10px';
    lobbyList.style.color = '#ffffff';
    joinSection.appendChild(lobbyList);

    if (lobbies.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No lobbies available. Create one to get started!';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#999999';
        emptyMessage.style.marginTop = '50px';
        lobbyList.appendChild(emptyMessage);
    } else {
        // Display lobbies
        lobbies.forEach(lobby => {
            const lobbyItem = document.createElement('div');
            lobbyItem.style.padding = '12px';
            lobbyItem.style.marginBottom = '10px';
            lobbyItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            lobbyItem.style.borderRadius = '5px';
            lobbyItem.style.border = '1px solid rgba(255, 215, 0, 0.2)';
            lobbyItem.style.cursor = 'pointer';
            lobbyItem.style.transition = 'background-color 0.2s';
            
            lobbyItem.addEventListener('mouseenter', () => {
                lobbyItem.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
            });
            
            lobbyItem.addEventListener('mouseleave', () => {
                lobbyItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            });
            
            const lobbyName = document.createElement('div');
            lobbyName.textContent = lobby.name;
            lobbyName.style.fontSize = '18px';
            lobbyName.style.fontWeight = 'bold';
            lobbyName.style.color = '#FFD700';
            lobbyName.style.marginBottom = '5px';
            lobbyItem.appendChild(lobbyName);
            
            const lobbyInfo = document.createElement('div');
            lobbyInfo.textContent = `Mode: ${lobby.game_mode || 'custom'} | Status: ${lobby.status}`;
            lobbyInfo.style.fontSize = '14px';
            lobbyInfo.style.color = '#CCCCCC';
            lobbyItem.appendChild(lobbyInfo);
            
            lobbyItem.addEventListener('click', () => {
                onJoinLobby(lobby.id);
            });
            
            lobbyList.appendChild(lobbyItem);
        });
    }

    const emptyMessage = document.createElement('div');
    emptyMessage.textContent = '';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.color = '#999999';
    emptyMessage.style.marginTop = '50px';
    lobbyList.appendChild(emptyMessage);

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
        <strong style="color: #FFD700;">Custom Lobbies:</strong><br>
        • Create a 2v2 lobby and invite friends<br>
        • Choose teams, factions, and AI opponents<br>
        • Select colors for each player<br>
        • No MMR - just for fun!
    `;
    infoSection.appendChild(infoText);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    backButton.style.marginTop = '30px';
    container.appendChild(backButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
