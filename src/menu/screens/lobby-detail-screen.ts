/**
 * Lobby Detail Screen Renderer
 * Visual team slot management interface for 2v2 custom lobbies
 */

import { Faction } from '../../sim/entities/player';

export interface LobbyPlayer {
    room_id: string;
    player_id: string;
    username: string;
    is_host: boolean;
    is_ready: boolean;
    faction: string | null;
    joined_at: string;
    team_id?: number | null;
    is_spectator?: boolean;
    slot_type?: 'player' | 'ai' | 'spectator' | 'empty';
    ai_difficulty?: 'easy' | 'normal' | 'hard';
    player_color?: string;
}

export interface LobbyDetailScreenParams {
    roomId: string;
    roomName: string;
    isHost: boolean;
    players: LobbyPlayer[];
    localPlayerId: string;
    onSetTeam: (playerId: string, teamId: number) => void;
    onAssignPlayerToTeam: (playerId: string, teamId: number) => void;
    onSetSlotType: (playerId: string, slotType: 'player' | 'ai' | 'spectator') => void;
    onSetAIDifficulty: (playerId: string, difficulty: 'easy' | 'normal' | 'hard') => void;
    onSetFaction: (faction: Faction) => void;
    onSetColor: (color: string) => void;
    onAddAI: (teamId: number) => void;
    onRemoveSlot: (playerId: string) => void;
    onToggleReady: () => void;
    onStartGame: () => void;
    onCycleMap: () => Promise<string | null | void> | string | null | void;
    onLeave: () => void;
    onRefresh: () => void;
    selectedMapName: string;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderLobbyDetailScreen(
    container: HTMLElement,
    params: LobbyDetailScreenParams
): void {
    const {
        roomId,
        roomName,
        isHost,
        players,
        localPlayerId,
        onSetTeam,
        onAssignPlayerToTeam,
        onSetSlotType,
        onSetAIDifficulty,
        onSetFaction,
        onSetColor,
        onAddAI,
        onRemoveSlot,
        onToggleReady,
        onStartGame,
        onCycleMap,
        onLeave,
        onRefresh,
        selectedMapName,
        createButton,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 900;

    // Title section
    const titleSection = document.createElement('div');
    titleSection.style.marginBottom = '20px';
    titleSection.style.textAlign = 'center';
    container.appendChild(titleSection);

    const title = document.createElement('h2');
    title.textContent = roomName;
    title.style.fontSize = isCompactLayout ? '28px' : '40px';
    title.style.marginBottom = '10px';
    title.style.color = '#FFD700';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    titleSection.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Custom 2v2 Lobby';
    subtitle.style.fontSize = '16px';
    subtitle.style.color = '#999999';
    titleSection.appendChild(subtitle);

    // Refresh button (top right)
    const refreshButton = createButton('↻ Refresh', onRefresh, '#4CAF50');
    refreshButton.style.position = 'absolute';
    refreshButton.style.top = '20px';
    refreshButton.style.right = '20px';
    refreshButton.style.fontSize = '14px';
    refreshButton.style.padding = '8px 16px';
    container.appendChild(refreshButton);

    // Main content area - team slots + spectator roster
    const lobbyLayout = document.createElement('div');
    lobbyLayout.style.display = 'flex';
    lobbyLayout.style.flexDirection = isCompactLayout ? 'column' : 'row';
    lobbyLayout.style.gap = '20px';
    lobbyLayout.style.width = '100%';
    lobbyLayout.style.maxWidth = '1200px';
    lobbyLayout.style.marginBottom = '30px';
    container.appendChild(lobbyLayout);

    const teamsContainer = document.createElement('div');
    teamsContainer.style.display = 'flex';
    teamsContainer.style.flexDirection = isCompactLayout ? 'column' : 'row';
    teamsContainer.style.gap = '20px';
    teamsContainer.style.flex = '1';
    lobbyLayout.appendChild(teamsContainer);

    const spectators = players.filter((player) => {
        const isTeamPlayer = (player.slot_type === 'player' || player.slot_type === 'ai')
            && (player.team_id === 0 || player.team_id === 1);
        return !isTeamPlayer;
    });

    // Team 0 and Team 1
    for (let teamId = 0; teamId <= 1; teamId++) {
        const teamBox = document.createElement('div');
        teamBox.style.flex = '1';
        teamBox.style.padding = '20px';
        teamBox.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        teamBox.style.borderRadius = '10px';
        teamBox.style.border = `3px solid ${teamId === 0 ? 'rgba(102, 179, 255, 0.5)' : 'rgba(255, 107, 107, 0.5)'}`;
        teamsContainer.appendChild(teamBox);

        // Team title
        const teamTitle = document.createElement('h3');
        teamTitle.textContent = `Team ${teamId + 1}`;
        teamTitle.style.fontSize = '24px';
        teamTitle.style.color = teamId === 0 ? '#66B3FF' : '#FF6B6B';
        teamTitle.style.marginBottom = '15px';
        teamTitle.style.textAlign = 'center';
        teamBox.appendChild(teamTitle);

        // Get players for this team
        const teamPlayers = players.filter(p => (p.slot_type === 'player' || p.slot_type === 'ai') && p.team_id === teamId);

        // Render slots (2 slots per team)
        for (let slotIdx = 0; slotIdx < 2; slotIdx++) {
            const player = teamPlayers[slotIdx] || null;
            const slotDiv = renderSlot(player, teamId, slotIdx, isHost, localPlayerId, {
                onSetTeam,
                onAssignPlayerToTeam,
                onSetSlotType,
                onSetAIDifficulty,
                onSetFaction,
                onSetColor,
                onAddAI,
                onRemoveSlot,
                createButton
            });
            teamBox.appendChild(slotDiv);
        }
    }

    const spectatorPanel = renderSpectatorPanel(spectators, isHost, localPlayerId, onSetSlotType);
    lobbyLayout.appendChild(spectatorPanel);

    // Map selector (between teams and lobby action buttons)
    const mapSelectionSection = document.createElement('div');
    mapSelectionSection.style.display = 'flex';
    mapSelectionSection.style.justifyContent = 'center';
    mapSelectionSection.style.alignItems = 'center';
    mapSelectionSection.style.marginBottom = '16px';
    mapSelectionSection.style.gap = '12px';
    container.appendChild(mapSelectionSection);

    const mapSelectionLabel = document.createElement('div');
    mapSelectionLabel.textContent = `Map: ${selectedMapName}`;
    mapSelectionLabel.style.fontSize = '16px';
    mapSelectionLabel.style.color = '#D0D0D0';
    mapSelectionSection.appendChild(mapSelectionLabel);

    const mapSelectionButton = createButton(isHost ? 'CHANGE MAP' : 'MAP LOCKED', () => undefined, '#6A5ACD');
    mapSelectionButton.style.fontSize = '14px';
    mapSelectionButton.style.padding = '10px 18px';
    if (!isHost) {
        mapSelectionButton.disabled = true;
        mapSelectionButton.style.opacity = '0.5';
        mapSelectionButton.style.cursor = 'not-allowed';
    } else {
        mapSelectionButton.onclick = async () => {
            mapSelectionButton.disabled = true;
            mapSelectionButton.style.opacity = '0.7';

            try {
                const nextMapName = await onCycleMap();
                if (typeof nextMapName === 'string' && nextMapName.length > 0) {
                    mapSelectionLabel.textContent = `Map: ${nextMapName}`;
                }
            } finally {
                mapSelectionButton.disabled = false;
                mapSelectionButton.style.opacity = '1';
            }
        };
    }
    mapSelectionSection.appendChild(mapSelectionButton);

    // Control buttons section
    const controlsSection = document.createElement('div');
    controlsSection.style.display = 'flex';
    controlsSection.style.flexDirection = isCompactLayout ? 'column' : 'row';
    controlsSection.style.gap = '10px';
    controlsSection.style.justifyContent = 'center';
    controlsSection.style.marginBottom = '20px';
    container.appendChild(controlsSection);

    // Find local player
    const localPlayer = players.find(p => p.player_id === localPlayerId);
    const isReady = localPlayer?.is_ready || false;

    if (isHost) {
        // Host can start game
        const startButton = createButton('START GAME', onStartGame, '#4CAF50');
        startButton.style.fontSize = '18px';
        startButton.style.padding = '12px 40px';
        const allReady = players.filter(p => p.slot_type === 'player').every(p => p.is_ready);
        const hasEnoughPlayers = players.filter(p => p.slot_type === 'player' || p.slot_type === 'ai').length >= 2;
        if (!allReady || !hasEnoughPlayers) {
            startButton.disabled = true;
            startButton.style.opacity = '0.5';
            startButton.style.cursor = 'not-allowed';
        }
        controlsSection.appendChild(startButton);
    } else {
        // Non-host can toggle ready
        const readyButton = createButton(
            isReady ? '✓ READY' : 'READY UP',
            onToggleReady,
            isReady ? '#4CAF50' : '#FFA500'
        );
        readyButton.style.fontSize = '18px';
        readyButton.style.padding = '12px 40px';
        controlsSection.appendChild(readyButton);
    }

    // Leave button
    const leaveButton = createButton('LEAVE LOBBY', onLeave, '#FF6B6B');
    leaveButton.style.fontSize = '18px';
    leaveButton.style.padding = '12px 40px';
    controlsSection.appendChild(leaveButton);

    // Info section
    const infoSection = document.createElement('div');
    infoSection.style.width = '100%';
    infoSection.style.maxWidth = '800px';
    infoSection.style.padding = '15px';
    infoSection.style.backgroundColor = 'rgba(0, 0, 50, 0.3)';
    infoSection.style.borderRadius = '10px';
    infoSection.style.border = '2px solid rgba(100, 150, 255, 0.3)';
    infoSection.style.fontSize = '14px';
    infoSection.style.color = '#cccccc';
    infoSection.style.lineHeight = '1.6';
    container.appendChild(infoSection);

    const infoText = document.createElement('div');
    if (isHost) {
        infoText.innerHTML = `
            <strong style="color: #FFD700;">Host Controls:</strong><br>
            • Drag spectators into empty team slots to assign players<br>
            • Drag your own card to move yourself to another open slot<br>
            • Add AI players by clicking "Add AI" in empty slots<br>
            • Move players between teams by clicking team buttons<br>
            • Configure AI difficulty (Easy, Normal, Hard)<br>
            • Start the game when all assigned players are ready
        `;
    } else {
        infoText.innerHTML = `
            <strong style="color: #FFD700;">Player Info:</strong><br>
            • Wait for the host to configure teams<br>
            • Click "Ready Up" when you're ready to play<br>
            • The host will start the game when everyone is ready
        `;
    }
    infoSection.appendChild(infoText);

    menuParticleLayer?.requestTargetRefresh(container);
}

/**
 * Render a single player/AI slot
 */
function renderSlot(
    player: LobbyPlayer | null,
    teamId: number,
    slotIdx: number,
    isHost: boolean,
    localPlayerId: string,
    callbacks: {
        onSetTeam: (playerId: string, teamId: number) => void;
        onAssignPlayerToTeam: (playerId: string, teamId: number) => void;
        onSetSlotType: (playerId: string, slotType: 'player' | 'ai' | 'spectator') => void;
        onSetAIDifficulty: (playerId: string, difficulty: 'easy' | 'normal' | 'hard') => void;
        onSetFaction: (faction: Faction) => void;
        onSetColor: (color: string) => void;
        onAddAI: (teamId: number) => void;
        onRemoveSlot: (playerId: string) => void;
        createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    }
): HTMLElement {
    const slotDiv = document.createElement('div');
    slotDiv.style.padding = '15px';
    slotDiv.style.marginBottom = '10px';
    slotDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    slotDiv.style.borderRadius = '8px';
    slotDiv.style.border = '2px solid rgba(255, 255, 255, 0.1)';
    slotDiv.style.minHeight = '80px';

    if (!player || player.slot_type === 'empty') {
        // Empty slot
        const emptyText = document.createElement('div');
        emptyText.textContent = 'Empty Slot';
        emptyText.style.color = '#666666';
        emptyText.style.textAlign = 'center';
        emptyText.style.fontSize = '16px';
        emptyText.style.marginBottom = '10px';
        slotDiv.appendChild(emptyText);

        if (isHost) {
            const addAIButton = callbacks.createButton('Add AI', () => callbacks.onAddAI(teamId), '#4CAF50');
            addAIButton.style.width = '100%';
            addAIButton.style.fontSize = '14px';
            addAIButton.style.padding = '8px';
            slotDiv.appendChild(addAIButton);

            slotDiv.style.border = '2px dashed rgba(255, 255, 255, 0.25)';
            slotDiv.style.transition = 'border-color 0.15s ease';
            slotDiv.addEventListener('dragover', (event) => {
                event.preventDefault();
                slotDiv.style.borderColor = 'rgba(102, 255, 178, 0.9)';
            });
            slotDiv.addEventListener('dragleave', () => {
                slotDiv.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            });
            slotDiv.addEventListener('drop', (event) => {
                event.preventDefault();
                slotDiv.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                const draggedPlayerId = event.dataTransfer?.getData('text/player-id');
                if (!draggedPlayerId) return;
                callbacks.onAssignPlayerToTeam(draggedPlayerId, teamId);
            });
        }

        return slotDiv;
    }

    // Player or AI slot
    const isLocal = player.player_id === localPlayerId;
    const canDragPlayerCard = isHost && player.slot_type === 'player';

    if (canDragPlayerCard) {
        slotDiv.draggable = true;
        slotDiv.style.cursor = 'grab';
        slotDiv.addEventListener('dragstart', (event) => {
            event.dataTransfer?.setData('text/player-id', player.player_id);
            event.dataTransfer!.effectAllowed = 'move';
        });
        slotDiv.addEventListener('dragend', () => {
            slotDiv.style.cursor = 'grab';
        });
    }
    
    // Player name/type row
    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.justifyContent = 'space-between';
    nameRow.style.alignItems = 'center';
    nameRow.style.marginBottom = '8px';
    slotDiv.appendChild(nameRow);

    const nameDiv = document.createElement('div');
    if (player.slot_type === 'ai') {
        nameDiv.textContent = `AI [${player.ai_difficulty || 'normal'}]`;
        nameDiv.style.color = '#FFA500';
    } else {
        nameDiv.textContent = player.username;
        nameDiv.style.color = '#FFD700';
        if (player.is_host) {
            nameDiv.textContent += ' (Host)';
        }
        if (isLocal) {
            nameDiv.textContent += ' (You)';
        }
    }
    nameDiv.style.fontSize = '16px';
    nameDiv.style.fontWeight = 'bold';
    nameRow.appendChild(nameDiv);

    // Ready status
    if (player.slot_type === 'player') {
        const readyBadge = document.createElement('span');
        readyBadge.textContent = player.is_ready ? '✓ Ready' : 'Not Ready';
        readyBadge.style.fontSize = '12px';
        readyBadge.style.padding = '4px 8px';
        readyBadge.style.borderRadius = '4px';
        readyBadge.style.backgroundColor = player.is_ready ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 165, 0, 0.3)';
        readyBadge.style.color = player.is_ready ? '#4CAF50' : '#FFA500';
        nameRow.appendChild(readyBadge);
    }

    // Faction display
    if (player.faction) {
        const factionDiv = document.createElement('div');
        factionDiv.textContent = `Faction: ${player.faction}`;
        factionDiv.style.fontSize = '12px';
        factionDiv.style.color = '#AAAAAA';
        factionDiv.style.marginBottom = '8px';
        slotDiv.appendChild(factionDiv);
    }

    // Host controls
    if (isHost && !player.is_host) {
        const controlsRow = document.createElement('div');
        controlsRow.style.display = 'flex';
        controlsRow.style.gap = '5px';
        controlsRow.style.marginTop = '10px';
        slotDiv.appendChild(controlsRow);

        // Move to other team
        const otherTeam = teamId === 0 ? 1 : 0;
        const moveButton = callbacks.createButton(
            `→ Team ${otherTeam + 1}`,
            () => callbacks.onSetTeam(player.player_id, otherTeam),
            '#2196F3'
        );
        moveButton.style.flex = '1';
        moveButton.style.fontSize = '12px';
        moveButton.style.padding = '6px';
        controlsRow.appendChild(moveButton);

        // AI difficulty (if AI)
        if (player.slot_type === 'ai') {
            const difficultySelect = document.createElement('select');
            difficultySelect.style.flex = '1';
            difficultySelect.style.fontSize = '12px';
            difficultySelect.style.padding = '6px';
            difficultySelect.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            difficultySelect.style.color = '#ffffff';
            difficultySelect.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            difficultySelect.style.borderRadius = '4px';
            
            ['easy', 'normal', 'hard'].forEach(diff => {
                const option = document.createElement('option');
                option.value = diff;
                option.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
                option.selected = diff === (player.ai_difficulty || 'normal');
                difficultySelect.appendChild(option);
            });
            
            difficultySelect.addEventListener('change', () => {
                callbacks.onSetAIDifficulty(player.player_id, difficultySelect.value as 'easy' | 'normal' | 'hard');
            });
            
            controlsRow.appendChild(difficultySelect);

            // Remove AI button
            const removeButton = callbacks.createButton('✕', () => callbacks.onRemoveSlot(player.player_id), '#FF6B6B');
            removeButton.style.width = '35px';
            removeButton.style.fontSize = '12px';
            removeButton.style.padding = '6px';
            controlsRow.appendChild(removeButton);
        }
    }

    return slotDiv;
}

function renderSpectatorPanel(
    players: LobbyPlayer[],
    isHost: boolean,
    localPlayerId: string,
    onSetSlotType: (playerId: string, slotType: 'player' | 'ai' | 'spectator') => void
): HTMLElement {
    const panel = document.createElement('div');
    panel.style.width = '280px';
    panel.style.flexShrink = '0';
    panel.style.padding = '20px';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    panel.style.borderRadius = '10px';
    panel.style.border = '3px solid rgba(180, 180, 180, 0.35)';

    const title = document.createElement('h3');
    title.textContent = 'Spectators';
    title.style.fontSize = '24px';
    title.style.color = '#CCCCCC';
    title.style.marginBottom = '15px';
    title.style.textAlign = 'center';
    panel.appendChild(title);

    if (isHost) {
        panel.style.borderStyle = 'dashed';
        panel.addEventListener('dragover', (event) => {
            event.preventDefault();
            panel.style.borderColor = 'rgba(170, 170, 170, 0.9)';
        });
        panel.addEventListener('dragleave', () => {
            panel.style.borderColor = 'rgba(180, 180, 180, 0.35)';
        });
        panel.addEventListener('drop', (event) => {
            event.preventDefault();
            panel.style.borderColor = 'rgba(180, 180, 180, 0.35)';
            const draggedPlayerId = event.dataTransfer?.getData('text/player-id');
            if (!draggedPlayerId) return;
            onSetSlotType(draggedPlayerId, 'spectator');
        });
    }

    if (players.length === 0) {
        const emptyText = document.createElement('div');
        emptyText.textContent = 'No spectators waiting';
        emptyText.style.color = '#777777';
        emptyText.style.textAlign = 'center';
        panel.appendChild(emptyText);
        return panel;
    }

    for (const player of players) {
        const entry = document.createElement('div');
        entry.style.padding = '10px 12px';
        entry.style.marginBottom = '8px';
        entry.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
        entry.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        entry.style.borderRadius = '6px';

        const isLocal = player.player_id === localPlayerId;
        entry.textContent = `${player.username}${player.is_host ? ' (Host)' : ''}${isLocal ? ' (You)' : ''}`;
        entry.style.color = '#DDDDDD';
        entry.style.fontSize = '14px';

        if (isHost && player.slot_type !== 'ai') {
            entry.draggable = true;
            entry.style.cursor = 'grab';
            entry.addEventListener('dragstart', (event) => {
                event.dataTransfer?.setData('text/player-id', player.player_id);
                event.dataTransfer!.effectAllowed = 'move';
            });
        }

        panel.appendChild(entry);
    }

    return panel;
}
