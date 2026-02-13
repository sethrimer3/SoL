/**
 * Settings Screen Renderer
 * Displays game settings and configuration options
 */

import { COLOR_SCHEMES } from '../color-schemes';
import { createSettingSection, createSelect, createToggle, createColorPicker, createTextInput, createPercentSlider } from '../ui-helpers';

export interface SettingsScreenParams {
    difficulty: 'easy' | 'normal' | 'hard';
    username: string;
    soundEnabled: boolean;
    musicEnabled: boolean;
    soundVolume: number;
    musicVolume: number;
    isBattleStatsInfoEnabled: boolean;
    screenShakeEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    allyColor: string;
    enemy2Color: string;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    colorScheme: string;
    onDifficultyChange: (value: 'easy' | 'normal' | 'hard') => void;
    onUsernameChange: (value: string) => void;
    onSoundEnabledChange: (value: boolean) => void;
    onMusicEnabledChange: (value: boolean) => void;
    onSoundVolumeChange: (value: number) => void;
    onMusicVolumeChange: (value: number) => void;
    onBattleStatsInfoChange: (value: boolean) => void;
    onScreenShakeChange: (value: boolean) => void;
    onPlayerColorChange: (value: string) => void;
    onEnemyColorChange: (value: string) => void;
    onAllyColorChange: (value: string) => void;
    onEnemy2ColorChange: (value: string) => void;
    onGraphicsQualityChange: (value: 'low' | 'medium' | 'high' | 'ultra') => void;
    onColorSchemeChange: (value: string) => void;
    onClearDataAndCache: () => Promise<void>;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderSettingsScreen(
    container: HTMLElement,
    params: SettingsScreenParams
): void {
    const {
        difficulty,
        username,
        soundEnabled,
        musicEnabled,
        soundVolume,
        musicVolume,
        isBattleStatsInfoEnabled,
        screenShakeEnabled,
        playerColor,
        enemyColor,
        allyColor,
        enemy2Color,
        graphicsQuality,
        colorScheme,
        onDifficultyChange,
        onUsernameChange,
        onSoundEnabledChange,
        onMusicEnabledChange,
        onSoundVolumeChange,
        onMusicVolumeChange,
        onBattleStatsInfoChange,
        onScreenShakeChange,
        onPlayerColorChange,
        onEnemyColorChange,
        onAllyColorChange,
        onEnemy2ColorChange,
        onGraphicsQualityChange,
        onColorSchemeChange,
        onClearDataAndCache,
        onBack,
        createButton,
        menuParticleLayer
    } = params;

    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.style.maxWidth = '500px';
    settingsContainer.style.width = '100%';
    settingsContainer.style.padding = '20px';

    // Difficulty setting
    const difficultySection = createSettingSection(
        'Difficulty',
        createSelect(
            ['easy', 'normal', 'hard'],
            difficulty,
            (value) => {
                onDifficultyChange(value as 'easy' | 'normal' | 'hard');
            }
        )
    );
    settingsContainer.appendChild(difficultySection);

    // Username setting
    const usernameSection = createSettingSection(
        'Username',
        createTextInput(
            username,
            onUsernameChange,
            'Enter your username'
        )
    );
    settingsContainer.appendChild(usernameSection);

    // Sound setting
    const soundSection = createSettingSection(
        'Sound Effects',
        createToggle(soundEnabled, onSoundEnabledChange)
    );
    settingsContainer.appendChild(soundSection);

    const soundVolumeSection = createSettingSection(
        'Sound Effects Volume',
        createPercentSlider(soundVolume, onSoundVolumeChange)
    );
    settingsContainer.appendChild(soundVolumeSection);

    // Music setting
    const musicSection = createSettingSection(
        'Music',
        createToggle(musicEnabled, onMusicEnabledChange)
    );
    settingsContainer.appendChild(musicSection);

    const musicVolumeSection = createSettingSection(
        'Music Volume',
        createPercentSlider(musicVolume, onMusicVolumeChange)
    );
    settingsContainer.appendChild(musicVolumeSection);

    const battleStatsSection = createSettingSection(
        'Battle Stats Info',
        createToggle(isBattleStatsInfoEnabled, onBattleStatsInfoChange)
    );
    settingsContainer.appendChild(battleStatsSection);

    // Screen shake setting
    const screenShakeSection = createSettingSection(
        'Screen Shake',
        createToggle(screenShakeEnabled, onScreenShakeChange)
    );
    settingsContainer.appendChild(screenShakeSection);

    // Player Color setting
    const playerColorSection = createSettingSection(
        'Player Color',
        createColorPicker(playerColor, onPlayerColorChange)
    );
    settingsContainer.appendChild(playerColorSection);

    // Enemy Color setting
    const enemyColorSection = createSettingSection(
        'Enemy Color',
        createColorPicker(enemyColor, onEnemyColorChange)
    );
    settingsContainer.appendChild(enemyColorSection);

    // Ally Color setting (for 2v2 games)
    const allyColorSection = createSettingSection(
        'Ally Color (2v2)',
        createColorPicker(allyColor, onAllyColorChange)
    );
    settingsContainer.appendChild(allyColorSection);

    // Second Enemy Color setting (for 2v2 games)
    const enemy2ColorSection = createSettingSection(
        'Enemy 2 Color (2v2)',
        createColorPicker(enemy2Color, onEnemy2ColorChange)
    );
    settingsContainer.appendChild(enemy2ColorSection);

    // Graphics Quality setting
    const graphicsQualitySection = createSettingSection(
        'Graphics Quality',
        createSelect(
            ['low', 'medium', 'high', 'ultra'],
            graphicsQuality,
            (value) => {
                onGraphicsQualityChange(value as 'low' | 'medium' | 'high' | 'ultra');
            }
        )
    );
    settingsContainer.appendChild(graphicsQualitySection);

    // Color Scheme setting
    const colorSchemeSection = createSettingSection(
        'Color Scheme',
        createSelect(
            Object.keys(COLOR_SCHEMES),
            colorScheme,
            onColorSchemeChange
        )
    );
    settingsContainer.appendChild(colorSchemeSection);

    const resetButton = createButton('DELETE DATA', async () => {
        const isConfirmed = window.confirm(
            'Delete all player data and cached files? This will reload the game and start fresh.'
        );
        if (!isConfirmed) {
            return;
        }
        await onClearDataAndCache();
        window.location.reload();
    }, '#FF6666');
    resetButton.style.fontSize = '18px';
    resetButton.style.padding = '10px 20px';

    const resetSection = createSettingSection('Reset Player Data', resetButton);
    settingsContainer.appendChild(resetSection);

    container.appendChild(settingsContainer);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    backButton.style.marginTop = '30px';
    container.appendChild(backButton);
    menuParticleLayer?.requestTargetRefresh(container);
}
