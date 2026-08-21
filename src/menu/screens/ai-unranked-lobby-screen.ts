/**
 * AI Unranked Lobby Screen Renderer
 * Lets the player configure the AI opponent's difficulty and race before starting an unranked AI match.
 */

import { Faction } from '../../game-core';

export type AIOpponentFactionChoice = Faction | 'random';

export interface AIUnrankedLobbyScreenParams {
    selectedDifficulty: 'easy' | 'normal' | 'hard';
    selectedAiFaction: AIOpponentFactionChoice;
    onDifficultyChange: (difficulty: 'easy' | 'normal' | 'hard') => void;
    onAiFactionChange: (faction: AIOpponentFactionChoice) => void;
    onStart: () => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

const DIFFICULTY_OPTIONS: Array<{ id: 'easy' | 'normal' | 'hard'; label: string; color: string }> = [
    { id: 'easy', label: 'Easy', color: '#4CAF50' },
    { id: 'normal', label: 'Normal', color: '#FFA500' },
    { id: 'hard', label: 'Hard', color: '#FF4444' }
];

const FACTION_OPTIONS: Array<{ id: AIOpponentFactionChoice; label: string; color: string }> = [
    { id: Faction.RADIANT, label: 'Radiant', color: '#FF5722' },
    { id: Faction.AURUM, label: 'Aurum', color: '#FFD700' },
    { id: Faction.VELARIS, label: 'Velaris', color: '#9C27B0' },
    { id: 'random', label: 'Random', color: '#00AAFF' }
];

export function renderAIUnrankedLobbyScreen(
    container: HTMLElement,
    params: AIUnrankedLobbyScreenParams
): void {
    const {
        selectedDifficulty,
        selectedAiFaction,
        onDifficultyChange,
        onAiFactionChange,
        onStart,
        onBack,
        createButton,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'AI Unranked Setup';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = 'bold';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    const panel = document.createElement('div');
    panel.style.width = '100%';
    panel.style.maxWidth = '700px';
    panel.style.padding = '20px';
    panel.style.marginBottom = '20px';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    panel.style.borderRadius = '10px';
    panel.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    container.appendChild(panel);

    // Difficulty section
    const difficultyLabel = document.createElement('div');
    difficultyLabel.textContent = 'AI Difficulty';
    difficultyLabel.style.fontSize = '18px';
    difficultyLabel.style.color = '#FFD700';
    difficultyLabel.style.fontWeight = 'bold';
    difficultyLabel.style.marginBottom = '10px';
    difficultyLabel.style.textAlign = 'center';
    panel.appendChild(difficultyLabel);

    const difficultyRow = document.createElement('div');
    difficultyRow.style.display = 'flex';
    difficultyRow.style.gap = '10px';
    difficultyRow.style.justifyContent = 'center';
    difficultyRow.style.flexWrap = 'wrap';
    difficultyRow.style.marginBottom = '24px';
    panel.appendChild(difficultyRow);

    const difficultyButtons: HTMLButtonElement[] = [];
    DIFFICULTY_OPTIONS.forEach(option => {
        const isSelected = option.id === selectedDifficulty;
        const button = createButton(option.label, () => {
            onDifficultyChange(option.id);
            difficultyButtons.forEach((btn, i) => {
                const isActive = DIFFICULTY_OPTIONS[i].id === option.id;
                btn.style.opacity = isActive ? '1' : '0.5';
                btn.style.borderWidth = isActive ? '3px' : '1px';
            });
        }, option.color);
        button.style.opacity = isSelected ? '1' : '0.5';
        button.style.borderWidth = isSelected ? '3px' : '1px';
        button.style.borderStyle = 'solid';
        button.style.fontSize = '14px';
        button.style.padding = '10px 20px';
        difficultyButtons.push(button);
        difficultyRow.appendChild(button);
    });

    // Faction section
    const factionLabel = document.createElement('div');
    factionLabel.textContent = 'AI Race';
    factionLabel.style.fontSize = '18px';
    factionLabel.style.color = '#FFD700';
    factionLabel.style.fontWeight = 'bold';
    factionLabel.style.marginBottom = '10px';
    factionLabel.style.textAlign = 'center';
    panel.appendChild(factionLabel);

    const factionRow = document.createElement('div');
    factionRow.style.display = 'flex';
    factionRow.style.gap = '10px';
    factionRow.style.justifyContent = 'center';
    factionRow.style.flexWrap = 'wrap';
    panel.appendChild(factionRow);

    const factionButtons: HTMLButtonElement[] = [];
    FACTION_OPTIONS.forEach(option => {
        const isSelected = option.id === selectedAiFaction;
        const button = createButton(option.label, () => {
            onAiFactionChange(option.id);
            factionButtons.forEach((btn, i) => {
                const isActive = FACTION_OPTIONS[i].id === option.id;
                btn.style.opacity = isActive ? '1' : '0.5';
                btn.style.borderWidth = isActive ? '3px' : '1px';
            });
        }, option.color);
        button.style.opacity = isSelected ? '1' : '0.5';
        button.style.borderWidth = isSelected ? '3px' : '1px';
        button.style.borderStyle = 'solid';
        button.style.fontSize = '14px';
        button.style.padding = '10px 20px';
        factionButtons.push(button);
        factionRow.appendChild(button);
    });

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '20px';
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.justifyContent = 'center';
    if (isCompactLayout) {
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.alignItems = 'center';
    }

    const startButton = createButton('START MATCH', onStart, '#00FF88');
    startButton.style.fontSize = '18px';
    startButton.style.padding = '12px 40px';
    buttonContainer.appendChild(startButton);

    const backButton = createButton('BACK', onBack, '#666666');
    buttonContainer.appendChild(backButton);

    container.appendChild(buttonContainer);

    menuParticleLayer?.requestTargetRefresh(container);
}
