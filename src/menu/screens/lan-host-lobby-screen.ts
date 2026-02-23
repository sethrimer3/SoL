/**
 * LAN Host Lobby Screen Renderer
 * Displays the host's LAN lobby with connection code and player management
 */

import { LobbyInfo, LANSignaling, MessageType, NetworkManager } from '../../network';
import type { LanLobbyManager } from '../lan-lobby-manager';

export interface HostLobbyScreenParams {
    lobby: LobbyInfo;
    connectionCode: string;
    hostPlayerId: string;
    username: string;
    networkManager: NetworkManager | null;
    lanLobbyManager: LanLobbyManager;
    onGameStarted: () => void;
    onCancel: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderHostLobbyScreen(
    container: HTMLElement,
    params: HostLobbyScreenParams
): void {
    const {
        lobby,
        connectionCode,
        hostPlayerId,
        username,
        networkManager,
        lanLobbyManager,
        onGameStarted,
        onCancel,
        createButton,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    lanLobbyManager.startHeartbeat({
        hostPlayerId: hostPlayerId,
        lobbyName: lobby.name,
        hostUsername: lobby.players.find((player) => player.isHost)?.username ?? username,
        connectionCode: connectionCode,
        maxPlayerCount: lobby.maxPlayers,
        playerCount: lobby.players.length
    });

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Lobby: ' + lobby.name;
    title.style.fontSize = isCompactLayout ? '28px' : '36px';
    title.style.marginBottom = '20px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Connection code display
    const codeContainer = document.createElement('div');
    codeContainer.style.maxWidth = '600px';
    codeContainer.style.width = '100%';
    codeContainer.style.padding = '20px';
    codeContainer.style.backgroundColor = 'rgba(0, 100, 0, 0.3)';
    codeContainer.style.borderRadius = '10px';
    codeContainer.style.border = '2px solid rgba(0, 255, 0, 0.3)';
    codeContainer.style.marginBottom = '20px';

    const codeLabel = document.createElement('p');
    codeLabel.textContent = 'Share this connection code:';
    codeLabel.style.color = '#CCCCCC';
    codeLabel.style.fontSize = '18px';
    codeLabel.style.marginBottom = '10px';
    codeContainer.appendChild(codeLabel);

    const codeText = document.createElement('textarea');
    codeText.value = connectionCode;
    codeText.readOnly = true;
    codeText.style.width = '100%';
    codeText.style.height = '80px';
    codeText.style.padding = '10px';
    codeText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    codeText.style.color = '#00FF00';
    codeText.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    codeText.style.borderRadius = '5px';
    codeText.style.fontSize = '14px';
    codeText.style.fontFamily = 'monospace';
    codeText.style.resize = 'none';
    codeContainer.appendChild(codeText);

    const copyButton = createButton('COPY CODE', async () => {
        try {
            await navigator.clipboard.writeText(codeText.value);
            alert('Connection code copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            codeText.select();
            document.execCommand('copy');
            alert('Connection code copied to clipboard!');
        }
    }, '#008800');
    copyButton.style.marginTop = '10px';
    copyButton.style.padding = '10px 20px';
    copyButton.style.fontSize = '16px';
    codeContainer.appendChild(copyButton);

    container.appendChild(codeContainer);

    // Waiting for answer code input
    const answerContainer = document.createElement('div');
    answerContainer.style.maxWidth = '600px';
    answerContainer.style.width = '100%';
    answerContainer.style.padding = '20px';
    answerContainer.style.backgroundColor = 'rgba(0, 0, 100, 0.3)';
    answerContainer.style.borderRadius = '10px';
    answerContainer.style.border = '2px solid rgba(0, 100, 255, 0.3)';
    answerContainer.style.marginBottom = '30px';

    const answerLabel = document.createElement('p');
    answerLabel.textContent = 'Paste the answer code from the client:';
    answerLabel.style.color = '#CCCCCC';
    answerLabel.style.fontSize = '18px';
    answerLabel.style.marginBottom = '10px';
    answerContainer.appendChild(answerLabel);

    const answerInput = document.createElement('textarea');
    answerInput.placeholder = 'Paste answer code here...';
    answerInput.style.width = '100%';
    answerInput.style.height = '80px';
    answerInput.style.padding = '10px';
    answerInput.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    answerInput.style.color = '#FFFFFF';
    answerInput.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    answerInput.style.borderRadius = '5px';
    answerInput.style.fontSize = '14px';
    answerInput.style.fontFamily = 'monospace';
    answerInput.style.resize = 'none';
    answerContainer.appendChild(answerInput);

    const connectButton = createButton('CONNECT', async () => {
        const answerCode = answerInput.value.trim();
        if (!answerCode) {
            alert('Please paste the answer code from the client.');
            return;
        }

        try {
            const { answer, playerId: clientId, username: clientUsername } = LANSignaling.parseAnswerCode(answerCode);
            await networkManager?.completeConnection(clientId, answer);

            // Send lobby update to client
            if (networkManager && networkManager.getLobby()) {
                const currentLobby = networkManager.getLobby()!;
                currentLobby.players.push({
                    id: clientId,
                    username: clientUsername,
                    isHost: false,
                    isReady: true
                });
                networkManager.broadcast({
                    type: MessageType.LOBBY_UPDATE,
                    senderId: hostPlayerId,
                    timestamp: Date.now(),
                    data: currentLobby
                });
                const hostPlayer = currentLobby.players.find((player) => player.isHost);
                lanLobbyManager.registerEntry({
                    hostPlayerId: hostPlayerId,
                    lobbyName: currentLobby.name,
                    hostUsername: hostPlayer?.username ?? username,
                    connectionCode: connectionCode,
                    maxPlayerCount: currentLobby.maxPlayers,
                    playerCount: currentLobby.players.length
                });
            }

            alert(`${clientUsername} connected! You can now start the game.`);
        } catch (error) {
            console.error('Failed to connect client:', error);
            alert(`Failed to connect: ${error instanceof Error ? error.message : 'Invalid answer code'}`);
        }
    }, '#0088FF');
    connectButton.style.marginTop = '10px';
    connectButton.style.padding = '10px 20px';
    connectButton.style.fontSize = '16px';
    answerContainer.appendChild(connectButton);

    container.appendChild(answerContainer);

    // Start Game button (only for host)
    const startGameButton = createButton('START GAME', () => {
        if (!networkManager) {
            alert('Network manager not initialized.');
            return;
        }

        if (networkManager.getPeerCount() === 0) {
            alert('Please wait for at least one player to connect before starting.');
            return;
        }

        // Notify peers that game is starting
        networkManager.startGame();
        lanLobbyManager.unregisterEntry(hostPlayerId);
        lanLobbyManager.stopHeartbeat();

        onGameStarted();
    }, '#FF8800');
    startGameButton.style.marginBottom = '20px';
    startGameButton.style.padding = '15px 40px';
    startGameButton.style.fontSize = '24px';
    container.appendChild(startGameButton);

    // Cancel button
    const cancelButton = createButton('CANCEL', () => {
        if (networkManager) {
            networkManager.disconnect();
        }
        lanLobbyManager.unregisterEntry(hostPlayerId);
        lanLobbyManager.stopHeartbeat();
        onCancel();
    }, '#666666');
    container.appendChild(cancelButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
