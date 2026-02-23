/**
 * P2P Join Screen Renderer
 * Allows the user to join an existing P2P multiplayer match
 */

import { MultiplayerNetworkManager, NetworkEvent as P2PNetworkEvent } from '../../multiplayer-network';
import { getSupabaseConfig } from '../../../Supabase/supabase-config';

export interface P2PJoinScreenParams {
    username: string;
    onMatchStarted: () => void;
    onLeave: () => void;
    setMultiplayerNetworkManager: (manager: MultiplayerNetworkManager | null) => void;
    getMultiplayerNetworkManager: () => MultiplayerNetworkManager | null;
    fetchAndUpdatePlayers: (playersList: HTMLElement) => Promise<void>;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderP2PJoinScreen(
    container: HTMLElement,
    params: P2PJoinScreenParams
): void {
    const {
        username,
        onMatchStarted,
        onLeave,
        setMultiplayerNetworkManager,
        getMultiplayerNetworkManager,
        fetchAndUpdatePlayers,
        createButton,
        menuParticleLayer,
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Join P2P Match';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Match ID input container
    const inputContainer = document.createElement('div');
    inputContainer.style.maxWidth = '500px';
    inputContainer.style.width = '100%';
    inputContainer.style.padding = '20px';
    inputContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    inputContainer.style.borderRadius = '12px';
    inputContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
    inputContainer.style.marginBottom = '20px';
    container.appendChild(inputContainer);

    const matchIdLabel = document.createElement('label');
    matchIdLabel.textContent = 'Match ID:';
    matchIdLabel.style.fontSize = '20px';
    matchIdLabel.style.color = '#FFFFFF';
    matchIdLabel.style.marginBottom = '8px';
    matchIdLabel.style.display = 'block';
    inputContainer.appendChild(matchIdLabel);

    const matchIdInput = document.createElement('input');
    matchIdInput.type = 'text';
    matchIdInput.placeholder = 'Enter 8-character match ID';
    matchIdInput.style.fontSize = '24px';
    matchIdInput.style.padding = '12px 15px';
    matchIdInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    matchIdInput.style.color = '#FFFFFF';
    matchIdInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    matchIdInput.style.borderRadius = '5px';
    matchIdInput.style.fontFamily = 'monospace';
    matchIdInput.style.width = '100%';
    matchIdInput.style.boxSizing = 'border-box';
    matchIdInput.style.letterSpacing = '4px';
    matchIdInput.style.textTransform = 'uppercase';
    inputContainer.appendChild(matchIdInput);

    // Status message
    const statusMessage = document.createElement('div');
    statusMessage.style.fontSize = '18px';
    statusMessage.style.color = '#FFD700';
    statusMessage.style.marginBottom = '20px';
    statusMessage.style.textAlign = 'center';
    statusMessage.style.display = 'none';
    container.appendChild(statusMessage);

    // Lobby container (shown after successful join)
    const lobbyContainer = document.createElement('div');
    lobbyContainer.style.maxWidth = '600px';
    lobbyContainer.style.width = '100%';
    lobbyContainer.style.padding = '20px';
    lobbyContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    lobbyContainer.style.borderRadius = '12px';
    lobbyContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
    lobbyContainer.style.marginBottom = '20px';
    lobbyContainer.style.display = 'none';
    container.appendChild(lobbyContainer);

    const lobbyTitle = document.createElement('h3');
    lobbyTitle.textContent = 'Match Lobby';
    lobbyTitle.style.fontSize = '24px';
    lobbyTitle.style.color = '#FFD700';
    lobbyTitle.style.marginBottom = '15px';
    lobbyTitle.style.textAlign = 'center';
    lobbyContainer.appendChild(lobbyTitle);

    const playersList = document.createElement('div');
    playersList.style.display = 'flex';
    playersList.style.flexDirection = 'column';
    playersList.style.gap = '10px';
    playersList.style.marginBottom = '15px';
    lobbyContainer.appendChild(playersList);

    const waitingMessage = document.createElement('div');
    waitingMessage.textContent = 'Waiting for host to start...';
    waitingMessage.style.fontSize = '18px';
    waitingMessage.style.color = '#CCCCCC';
    waitingMessage.style.textAlign = 'center';
    waitingMessage.style.fontStyle = 'italic';
    lobbyContainer.appendChild(waitingMessage);

    // Join button
    const joinButton = createButton('JOIN MATCH', async () => {
        const config = getSupabaseConfig();
        if (!config.url || !config.anonKey) {
            statusMessage.textContent = 'Supabase not configured. Cannot join P2P match.';
            statusMessage.style.color = '#FF6666';
            statusMessage.style.display = 'block';
            return;
        }

        const matchIdShort = matchIdInput.value.trim().toUpperCase();
        if (!matchIdShort || matchIdShort.length < 6) {
            statusMessage.textContent = 'Please enter a valid match ID (at least 6 characters).';
            statusMessage.style.color = '#FF6666';
            statusMessage.style.display = 'block';
            return;
        }

        joinButton.disabled = true;
        joinButton.textContent = 'JOINING...';
        statusMessage.textContent = 'Connecting...';
        statusMessage.style.color = '#FFD700';
        statusMessage.style.display = 'block';

        const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const manager = new MultiplayerNetworkManager(config.url, config.anonKey, playerId);
        setMultiplayerNetworkManager(manager);

        // Set up event listeners
        manager.on(P2PNetworkEvent.PLAYER_JOINED, () => {
            statusMessage.textContent = 'Joined successfully!';
            statusMessage.style.color = '#00FF88';
            inputContainer.style.display = 'none';
            joinButton.style.display = 'none';
            lobbyContainer.style.display = 'block';
            void fetchAndUpdatePlayers(playersList);
        });

        manager.on(P2PNetworkEvent.MATCH_STARTED, () => {
            onMatchStarted();
        });

        manager.on(P2PNetworkEvent.ERROR, (data) => {
            const errorMsg = data.message || data.error?.message || data.error || 'Failed to join match';
            statusMessage.textContent = `Error: ${errorMsg}`;
            statusMessage.style.color = '#FF6666';
            statusMessage.style.display = 'block';
            joinButton.disabled = false;
            joinButton.textContent = 'JOIN MATCH';
        });

        // Find match by short ID prefix
        const matches = await manager.listMatches();
        const match = matches.find(m => m.id.toUpperCase().startsWith(matchIdShort));

        if (!match) {
            statusMessage.textContent = 'Match not found. Please check the match ID.';
            statusMessage.style.color = '#FF6666';
            statusMessage.style.display = 'block';
            joinButton.disabled = false;
            joinButton.textContent = 'JOIN MATCH';
            return;
        }

        // Join the match
        const success = await manager.joinMatch(match.id, username);
        if (!success) {
            joinButton.disabled = false;
            joinButton.textContent = 'JOIN MATCH';
        } else {
            // Start match connection
            await manager.startMatch();
        }
    }, '#0088FF');
    joinButton.style.marginBottom = '20px';
    joinButton.style.padding = '15px 40px';
    joinButton.style.fontSize = '24px';
    container.appendChild(joinButton);

    // Leave button
    const leaveButton = createButton('LEAVE', () => {
        const manager = getMultiplayerNetworkManager();
        if (manager) {
            void manager.disconnect();
            setMultiplayerNetworkManager(null);
        }
        onLeave();
    }, '#666666');
    container.appendChild(leaveButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
