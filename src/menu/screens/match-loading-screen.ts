/**
 * Match loading screen
 * Creates and displays the loading overlay shown during game initialization.
 *
 * Extracted from menu.ts as part of Phase 10 refactoring.
 */

import { getPlayerMMRData, calculateMMRChange } from '../../replay';

export interface MatchLoadingScreenOptions {
    gameMode: 'ai' | 'online' | 'lan' | 'p2p' | 'custom-lobby' | '2v2-matchmaking';
    onlineMode: 'ranked' | 'unranked';
    resolveAssetPath: (path: string) => string;
}

export function showMatchLoadingScreen(options: MatchLoadingScreenOptions): void {
    // Create loading screen overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'match-loading-screen';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100vw';
    loadingOverlay.style.height = '100vh';
    loadingOverlay.style.backgroundColor = '#000011';
    loadingOverlay.style.zIndex = '2000';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.flexDirection = 'column';
    loadingOverlay.style.justifyContent = 'flex-start';
    loadingOverlay.style.alignItems = 'flex-start';
    loadingOverlay.style.padding = '40px';

    // Game mode display in top left
    const gameModeContainer = document.createElement('div');
    gameModeContainer.style.position = 'absolute';
    gameModeContainer.style.top = '40px';
    gameModeContainer.style.left = '40px';
    gameModeContainer.style.fontSize = '36px';
    gameModeContainer.style.color = '#FFD700';
    gameModeContainer.style.fontWeight = 'bold';

    const gameModeText = document.createElement('div');
    let displayMode = options.gameMode === 'ai' ? 'Vs. AI' : 
                      options.gameMode === 'lan' ? 'LAN' : 
                      options.gameMode === 'online' ? (options.onlineMode === 'ranked' ? 'Ranked' : 'Unranked') : 'Vs. AI';
    gameModeText.textContent = displayMode;
    gameModeContainer.appendChild(gameModeText);

    // For Ranked mode, show MMR and win/loss info
    if (options.gameMode === 'online' && options.onlineMode === 'ranked') {
        const mmrData = getPlayerMMRData();
        const currentMMR = mmrData.mmr;
        const estimatedWin = calculateMMRChange(currentMMR, currentMMR, true);
        const estimatedLoss = calculateMMRChange(currentMMR, currentMMR, false);

        const mmrText = document.createElement('div');
        mmrText.textContent = `MMR: ${currentMMR}`;
        mmrText.style.fontSize = '24px';
        mmrText.style.marginTop = '10px';
        mmrText.style.color = '#D0D0D0';
        gameModeContainer.appendChild(mmrText);

        const winText = document.createElement('div');
        winText.textContent = `Win: +${estimatedWin}`;
        winText.style.fontSize = '20px';
        winText.style.marginTop = '8px';
        winText.style.color = '#00FF00';
        gameModeContainer.appendChild(winText);

        const lossText = document.createElement('div');
        lossText.textContent = `Loss: ${estimatedLoss}`;
        lossText.style.fontSize = '20px';
        lossText.style.marginTop = '4px';
        lossText.style.color = '#FF6666';
        gameModeContainer.appendChild(lossText);
    }

    loadingOverlay.appendChild(gameModeContainer);

    // Loading animation in bottom left
    const loadingContainer = document.createElement('div');
    loadingContainer.style.position = 'absolute';
    loadingContainer.style.bottom = '40px';
    loadingContainer.style.left = '40px';
    loadingContainer.style.display = 'flex';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.gap = '20px';

    const loadingAnimation = document.createElement('img');
    loadingAnimation.id = 'match-loading-animation';
    loadingAnimation.src = options.resolveAssetPath('ASSETS/sprites/loadingScreen/loadingAnimation/frame (1).png');
    loadingAnimation.style.width = '60px'; // 25% of 240px
    loadingAnimation.style.height = 'auto';
    loadingContainer.appendChild(loadingAnimation);

    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading...';
    loadingText.style.fontSize = '24px';
    loadingText.style.color = '#D0D0D0';
    loadingText.style.fontWeight = 'bold';
    loadingContainer.appendChild(loadingText);

    loadingOverlay.appendChild(loadingContainer);

    document.body.appendChild(loadingOverlay);

    // Start animation at 60fps
    const animationFrameCount = 25;
    const animationFrameDurationMs = 1000 / 60;
    let animationFrameIndex = 0;
    let lastAnimationTimestamp = performance.now();
    let animationRemainderMs = 0;

    const updateAnimation = (timestamp: number) => {
        if (!loadingAnimation.parentElement) {
            return; // Animation stopped
        }
        const deltaMs = timestamp - lastAnimationTimestamp;
        lastAnimationTimestamp = timestamp;
        animationRemainderMs += deltaMs;
        while (animationRemainderMs >= animationFrameDurationMs) {
            animationFrameIndex = (animationFrameIndex + 1) % animationFrameCount;
            animationRemainderMs -= animationFrameDurationMs;
        }
        const frameNumber = animationFrameIndex + 1;
        loadingAnimation.src = options.resolveAssetPath(`ASSETS/sprites/loadingScreen/loadingAnimation/frame (${frameNumber}).png`);
        requestAnimationFrame(updateAnimation);
    };

    requestAnimationFrame(updateAnimation);

    // Remove loading screen after a short delay to allow game to initialize
    setTimeout(() => {
        loadingOverlay.remove();
    }, 1500);
}
