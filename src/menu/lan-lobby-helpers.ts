/**
 * LAN lobby and player list rendering helpers.
 * Pure DOM construction functions extracted from menu.ts.
 *
 * Extracted from menu.ts as part of Phase 10 refactoring.
 */

import type { LanLobbyEntry } from './lan-lobby-manager';

/** Options for rendering the LAN lobby list. */
export interface LobbyListOptions {
    /** Currently visible lobby entries to render. */
    entries: LanLobbyEntry[];
    /** Callback invoked when the player clicks to join a lobby. */
    onJoinLobby: (connectionCode: string) => void;
    /** Factory for styled buttons; mirrors MainMenu.createButton. */
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
}

/**
 * Render LAN lobby entries into a container element.
 */
export function renderLanLobbyList(container: HTMLElement, options: LobbyListOptions): void {
    container.innerHTML = '';
    const entries = options.entries;

    if (entries.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.textContent = 'No LAN lobbies detected yet. Host a game to make it appear here.';
        emptyState.style.color = '#888888';
        emptyState.style.fontSize = '16px';
        emptyState.style.textAlign = 'center';
        emptyState.style.margin = '0';
        container.appendChild(emptyState);
        return;
    }

    for (const entry of entries) {
        const entryCard = document.createElement('div');
        entryCard.style.display = 'flex';
        entryCard.style.flexDirection = 'row';
        entryCard.style.alignItems = 'center';
        entryCard.style.justifyContent = 'space-between';
        entryCard.style.gap = '16px';
        entryCard.style.padding = '14px 18px';
        entryCard.style.borderRadius = '8px';
        entryCard.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        entryCard.style.border = '1px solid rgba(255, 215, 0, 0.3)';
        entryCard.style.cursor = 'pointer';
        entryCard.style.transition = 'transform 0.15s ease, border-color 0.15s ease';
        entryCard.addEventListener('mouseenter', () => {
            entryCard.style.transform = 'translateY(-2px)';
            entryCard.style.borderColor = 'rgba(255, 215, 0, 0.6)';
        });
        entryCard.addEventListener('mouseleave', () => {
            entryCard.style.transform = 'translateY(0)';
            entryCard.style.borderColor = 'rgba(255, 215, 0, 0.3)';
        });

        const entryInfo = document.createElement('div');
        entryInfo.style.display = 'flex';
        entryInfo.style.flexDirection = 'column';
        entryInfo.style.gap = '4px';
        entryInfo.style.flex = '1';

        const lobbyName = document.createElement('div');
        lobbyName.textContent = entry.lobbyName;
        lobbyName.style.color = '#FFD700';
        lobbyName.style.fontSize = '18px';
        lobbyName.style.fontWeight = '600';
        entryInfo.appendChild(lobbyName);

        const lobbyMeta = document.createElement('div');
        lobbyMeta.textContent = `${entry.hostUsername} • ${entry.playerCount}/${entry.maxPlayerCount} players`;
        lobbyMeta.style.color = '#CCCCCC';
        lobbyMeta.style.fontSize = '14px';
        entryInfo.appendChild(lobbyMeta);

        const joinButton = options.createButton('JOIN', () => {
            options.onJoinLobby(entry.connectionCode);
        }, '#00AAFF');
        joinButton.style.padding = '8px 18px';
        joinButton.style.fontSize = '14px';
        joinButton.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        entryCard.addEventListener('click', () => {
            options.onJoinLobby(entry.connectionCode);
        });

        entryCard.appendChild(entryInfo);
        entryCard.appendChild(joinButton);
        container.appendChild(entryCard);
    }
}

export interface PlayerListEntry {
    username: string;
    role: string;
}

/**
 * Render player list items into a container element.
 */
export function renderPlayersList(container: HTMLElement, players: PlayerListEntry[]): void {
    container.innerHTML = '';

    for (const player of players) {
        const playerItem = document.createElement('div');
        playerItem.style.padding = '10px';
        playerItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        playerItem.style.borderRadius = '5px';
        playerItem.style.display = 'flex';
        playerItem.style.justifyContent = 'space-between';
        playerItem.style.alignItems = 'center';

        const playerName = document.createElement('span');
        playerName.textContent = player.username;
        playerName.style.fontSize = '18px';
        playerName.style.color = '#FFFFFF';
        playerItem.appendChild(playerName);

        const playerRole = document.createElement('span');
        playerRole.textContent = player.role === 'host' ? '(Host)' : '(Player)';
        playerRole.style.fontSize = '14px';
        playerRole.style.color = player.role === 'host' ? '#FFD700' : '#CCCCCC';
        playerItem.appendChild(playerRole);

        container.appendChild(playerItem);
    }
}
