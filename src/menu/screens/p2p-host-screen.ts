/**
 * P2P Host Screen Renderer
 * Allows the user to create and host a P2P multiplayer match
 */

import { MultiplayerNetworkManager, NetworkEvent as P2PNetworkEvent, Match, MatchPlayer } from '../../multiplayer-network';
import { getSupabaseConfig } from '../../../Supabase/supabase-config';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface P2PHostScreenParams {
    username: string;
    onMatchStarted: () => void;
    onCancel: () => void;
    setMultiplayerNetworkManager: (manager: MultiplayerNetworkManager | null) => void;
    getMultiplayerNetworkManager: () => MultiplayerNetworkManager | null;
    setP2PMatchName: (name: string) => void;
    setP2PMaxPlayers: (max: number) => void;
    setP2PMatchPlayers: (players: MatchPlayer[]) => void;
    getP2PMatchPlayers: () => MatchPlayer[];
    updatePlayersList: (playersList: HTMLElement) => void;
    fetchAndUpdatePlayers: (playersList: HTMLElement) => Promise<void>;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderP2PHostScreen(
    container: HTMLElement,
    params: P2PHostScreenParams
): void {
    const {
        username,
        onMatchStarted,
        onCancel,
        setMultiplayerNetworkManager,
        getMultiplayerNetworkManager,
        setP2PMatchName,
        setP2PMaxPlayers,
        setP2PMatchPlayers,
        updatePlayersList,
        fetchAndUpdatePlayers,
        createButton,
        menuParticleLayer,
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Host P2P Match';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.style.maxWidth = '500px';
    formContainer.style.width = '100%';
    formContainer.style.padding = '20px';
    formContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    formContainer.style.borderRadius = '12px';
    formContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
    formContainer.style.marginBottom = '20px';
    container.appendChild(formContainer);

    // Match name input
    const matchNameLabel = document.createElement('label');
    matchNameLabel.textContent = 'Match Name:';
    matchNameLabel.style.fontSize = '20px';
    matchNameLabel.style.color = '#FFFFFF';
    matchNameLabel.style.marginBottom = '8px';
    matchNameLabel.style.display = 'block';
    formContainer.appendChild(matchNameLabel);

    const matchNameInput = document.createElement('input');
    matchNameInput.type = 'text';
    matchNameInput.value = `${username}'s Match`;
    matchNameInput.placeholder = 'Enter match name';
    matchNameInput.style.fontSize = '18px';
    matchNameInput.style.padding = '8px 15px';
    matchNameInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    matchNameInput.style.color = '#FFFFFF';
    matchNameInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    matchNameInput.style.borderRadius = '5px';
    matchNameInput.style.fontFamily = 'inherit';
    matchNameInput.style.width = '100%';
    matchNameInput.style.marginBottom = '20px';
    matchNameInput.style.boxSizing = 'border-box';
    formContainer.appendChild(matchNameInput);

    // Max players input
    const maxPlayersLabel = document.createElement('label');
    maxPlayersLabel.textContent = 'Max Players (2-8):';
    maxPlayersLabel.style.fontSize = '20px';
    maxPlayersLabel.style.color = '#FFFFFF';
    maxPlayersLabel.style.marginBottom = '8px';
    maxPlayersLabel.style.display = 'block';
    formContainer.appendChild(maxPlayersLabel);

    const maxPlayersInput = document.createElement('input');
    maxPlayersInput.type = 'number';
    maxPlayersInput.min = '2';
    maxPlayersInput.max = '8';
    maxPlayersInput.value = '2';
    maxPlayersInput.style.fontSize = '18px';
    maxPlayersInput.style.padding = '8px 15px';
    maxPlayersInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    maxPlayersInput.style.color = '#FFFFFF';
    maxPlayersInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    maxPlayersInput.style.borderRadius = '5px';
    maxPlayersInput.style.fontFamily = 'inherit';
    maxPlayersInput.style.width = '100%';
    maxPlayersInput.style.boxSizing = 'border-box';
    formContainer.appendChild(maxPlayersInput);

    // Match info container (hidden initially, shown after match creation)
    const matchInfoContainer = document.createElement('div');
    matchInfoContainer.style.maxWidth = '600px';
    matchInfoContainer.style.width = '100%';
    matchInfoContainer.style.padding = '20px';
    matchInfoContainer.style.backgroundColor = 'rgba(0, 100, 0, 0.2)';
    matchInfoContainer.style.borderRadius = '12px';
    matchInfoContainer.style.border = '2px solid rgba(0, 255, 136, 0.4)';
    matchInfoContainer.style.marginBottom = '20px';
    matchInfoContainer.style.display = 'none';
    container.appendChild(matchInfoContainer);

    const matchIdLabel = document.createElement('div');
    matchIdLabel.textContent = 'SHARE THIS CODE:';
    matchIdLabel.style.fontSize = '18px';
    matchIdLabel.style.color = '#00FF88';
    matchIdLabel.style.marginBottom = '10px';
    matchIdLabel.style.textAlign = 'center';
    matchInfoContainer.appendChild(matchIdLabel);

    const matchIdText = document.createElement('div');
    matchIdText.textContent = '';
    matchIdText.style.fontSize = '32px';
    matchIdText.style.color = '#FFFFFF';
    matchIdText.style.marginBottom = '15px';
    matchIdText.style.textAlign = 'center';
    matchIdText.style.fontFamily = 'monospace';
    matchIdText.style.letterSpacing = '4px';
    matchInfoContainer.appendChild(matchIdText);

    const copyButton = createButton('COPY CODE', async () => {
        try {
            await navigator.clipboard.writeText(matchIdText.textContent || '');
            matchIdLabel.textContent = 'CODE COPIED!';
            setTimeout(() => {
                matchIdLabel.textContent = 'SHARE THIS CODE:';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy match ID:', err);
            matchIdLabel.textContent = 'Failed to copy. Please copy manually.';
            setTimeout(() => {
                matchIdLabel.textContent = 'SHARE THIS CODE:';
            }, 2000);
        }
    }, '#00FF88');
    copyButton.style.padding = '10px 30px';
    copyButton.style.fontSize = '18px';
    matchInfoContainer.appendChild(copyButton);

    // Players list container
    const playersContainer = document.createElement('div');
    playersContainer.style.maxWidth = '600px';
    playersContainer.style.width = '100%';
    playersContainer.style.padding = '20px';
    playersContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    playersContainer.style.borderRadius = '12px';
    playersContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
    playersContainer.style.marginBottom = '20px';
    playersContainer.style.display = 'none';
    container.appendChild(playersContainer);

    const playersTitle = document.createElement('h3');
    playersTitle.textContent = 'Players:';
    playersTitle.style.fontSize = '24px';
    playersTitle.style.color = '#FFD700';
    playersTitle.style.marginBottom = '15px';
    playersTitle.style.textAlign = 'center';
    playersContainer.appendChild(playersTitle);

    const playersList = document.createElement('div');
    playersList.style.display = 'flex';
    playersList.style.flexDirection = 'column';
    playersList.style.gap = '10px';
    playersContainer.appendChild(playersList);

    // Status message container
    const statusMessage = document.createElement('div');
    statusMessage.style.fontSize = '18px';
    statusMessage.style.color = '#FF6666';
    statusMessage.style.marginBottom = '20px';
    statusMessage.style.textAlign = 'center';
    statusMessage.style.display = 'none';
    container.appendChild(statusMessage);

    // Create match button
    const createMatchButton = createButton('CREATE MATCH', async () => {
        const config = getSupabaseConfig();
        if (!config.url || !config.anonKey) {
            statusMessage.textContent = 'Supabase not configured. Cannot create P2P match.';
            statusMessage.style.display = 'block';
            return;
        }

        createMatchButton.disabled = true;
        createMatchButton.textContent = 'CREATING...';

        const matchName = matchNameInput.value.trim() || `${username}'s Match`;
        const maxPlayers = Math.max(2, Math.min(8, parseInt(maxPlayersInput.value) || 2));

        setP2PMatchName(matchName);
        setP2PMaxPlayers(maxPlayers);

        const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const manager = new MultiplayerNetworkManager(config.url, config.anonKey, playerId);
        setMultiplayerNetworkManager(manager);

        // Set up event listeners
        manager.on(P2PNetworkEvent.MATCH_CREATED, (data) => {
            const match: Match = data.match;
            matchIdText.textContent = match.id.substring(0, 8).toUpperCase();
            matchInfoContainer.style.display = 'block';
            playersContainer.style.display = 'block';
            formContainer.style.display = 'none';
            createMatchButton.style.display = 'none';
            startButton.style.display = 'block';

            setP2PMatchPlayers([{
                id: playerId,
                match_id: match.id,
                player_id: playerId,
                role: 'host',
                connected: true,
                username: username,
                faction: null
            }]);
            updatePlayersList(playersList);
        });

        manager.on(P2PNetworkEvent.PLAYER_JOINED, () => {
            void fetchAndUpdatePlayers(playersList);
        });

        manager.on(P2PNetworkEvent.MATCH_STARTED, () => {
            onMatchStarted();
        });

        manager.on(P2PNetworkEvent.ERROR, (data) => {
            const errorMsg = data.message || data.error?.message || data.error || 'Unknown error';
            statusMessage.textContent = `Error: ${errorMsg}`;
            statusMessage.style.display = 'block';
            createMatchButton.disabled = false;
            createMatchButton.textContent = 'CREATE MATCH';
        });

        // Create the match
        const match = await manager.createMatch({
            matchName: matchName,
            username: username,
            maxPlayers: maxPlayers,
            gameSettings: {}
        });

        if (!match) {
            createMatchButton.disabled = false;
            createMatchButton.textContent = 'CREATE MATCH';
        }
    }, '#00AA00');
    createMatchButton.style.marginBottom = '20px';
    createMatchButton.style.padding = '15px 40px';
    createMatchButton.style.fontSize = '24px';
    container.appendChild(createMatchButton);

    // Start match button (shown after match creation)
    const startButton = createButton('START MATCH', async () => {
        const manager = getMultiplayerNetworkManager();
        if (!manager) return;

        startButton.disabled = true;
        startButton.textContent = 'STARTING...';

        await manager.startMatch();
    }, '#00FF88');
    startButton.style.marginBottom = '20px';
    startButton.style.padding = '15px 40px';
    startButton.style.fontSize = '24px';
    startButton.style.display = 'none';
    container.appendChild(startButton);

    // Cancel button
    const cancelButton = createButton('CANCEL', () => {
        const manager = getMultiplayerNetworkManager();
        if (manager) {
            void manager.disconnect();
            setMultiplayerNetworkManager(null);
        }
        onCancel();
    }, '#666666');
    container.appendChild(cancelButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
