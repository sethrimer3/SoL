/**
 * LAN Client Screens Renderer
 * Displays the client-side LAN lobby screens (answer code display and waiting screen)
 */

import { MessageType, NetworkEvent, NetworkManager } from '../../network';

export interface ClientAnswerScreenParams {
    answerCode: string;
    hostUsername: string;
    networkManager: NetworkManager | null;
    onGameStarted: (networkManager: NetworkManager) => void;
    onCancel: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderClientAnswerScreen(
    container: HTMLElement,
    params: ClientAnswerScreenParams
): void {
    const { answerCode, hostUsername, networkManager, onGameStarted, onCancel, createButton, menuParticleLayer } = params;

    // Title
    const title = document.createElement('h2');
    title.textContent = `Joining ${hostUsername}'s Lobby`;
    title.style.fontSize = '32px';
    title.style.marginBottom = '20px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Instructions
    const instructions = document.createElement('p');
    instructions.textContent = 'Send this answer code to the host:';
    instructions.style.color = '#CCCCCC';
    instructions.style.fontSize = '18px';
    instructions.style.textAlign = 'center';
    instructions.style.marginBottom = '20px';
    container.appendChild(instructions);

    // Answer code display
    const codeContainer = document.createElement('div');
    codeContainer.style.maxWidth = '600px';
    codeContainer.style.width = '100%';
    codeContainer.style.padding = '20px';
    codeContainer.style.backgroundColor = 'rgba(0, 0, 100, 0.3)';
    codeContainer.style.borderRadius = '10px';
    codeContainer.style.border = '2px solid rgba(0, 100, 255, 0.3)';
    codeContainer.style.marginBottom = '30px';

    const codeText = document.createElement('textarea');
    codeText.value = answerCode;
    codeText.readOnly = true;
    codeText.style.width = '100%';
    codeText.style.height = '80px';
    codeText.style.padding = '10px';
    codeText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    codeText.style.color = '#0088FF';
    codeText.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    codeText.style.borderRadius = '5px';
    codeText.style.fontSize = '14px';
    codeText.style.fontFamily = 'monospace';
    codeText.style.resize = 'none';
    codeContainer.appendChild(codeText);

    const copyButton = createButton('COPY CODE', async () => {
        try {
            await navigator.clipboard.writeText(codeText.value);
            alert('Answer code copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            codeText.select();
            document.execCommand('copy');
            alert('Answer code copied to clipboard!');
        }
    }, '#0088FF');
    copyButton.style.marginTop = '10px';
    copyButton.style.padding = '10px 20px';
    copyButton.style.fontSize = '16px';
    codeContainer.appendChild(copyButton);

    container.appendChild(codeContainer);

    // Waiting message
    const waitingText = document.createElement('p');
    waitingText.textContent = 'Waiting for host to complete connection...';
    waitingText.style.color = '#888888';
    waitingText.style.fontSize = '18px';
    waitingText.style.textAlign = 'center';
    waitingText.style.marginBottom = '30px';
    container.appendChild(waitingText);

    // Listen for game start
    networkManager?.on(NetworkEvent.MESSAGE_RECEIVED, (data) => {
        if (data && data.type === MessageType.GAME_START) {
            onGameStarted(networkManager);
        }
    });

    // Cancel button
    const cancelButton = createButton('CANCEL', () => {
        if (networkManager) {
            networkManager.disconnect();
        }
        onCancel();
    }, '#666666');
    container.appendChild(cancelButton);

    menuParticleLayer?.requestTargetRefresh(container);
}

export interface ClientWaitingScreenParams {
    networkManager: NetworkManager | null;
    onCancel: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderClientWaitingScreen(
    container: HTMLElement,
    params: ClientWaitingScreenParams
): void {
    const { networkManager, onCancel, createButton, menuParticleLayer } = params;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Connecting to Host...';
    title.style.fontSize = '36px';
    title.style.marginBottom = '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Info text
    const infoText = document.createElement('p');
    infoText.textContent = 'Waiting for host to complete the connection...';
    infoText.style.color = '#CCCCCC';
    infoText.style.fontSize = '20px';
    infoText.style.textAlign = 'center';
    infoText.style.marginBottom = '30px';
    container.appendChild(infoText);

    // Cancel button
    const cancelButton = createButton('CANCEL', () => {
        if (networkManager) {
            networkManager.disconnect();
        }
        onCancel();
    }, '#666666');
    container.appendChild(cancelButton);

    menuParticleLayer?.requestTargetRefresh(container);
}
