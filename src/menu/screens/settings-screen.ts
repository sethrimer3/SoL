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
    developerModeEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    allyColor: string;
    enemy2Color: string;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isExperimentalGraphicsEnabled: boolean;
    isStarNestEnabled: boolean;
    isAdaptiveQualityEnabled: boolean;
    useSvgSprites: boolean;
    isPauseOnFocusLossEnabled: boolean;
    resolution: string;
    isPixelModeEnabled: boolean;
    colorScheme: string;
    onDifficultyChange: (value: 'easy' | 'normal' | 'hard') => void;
    onUsernameChange: (value: string) => void;
    onSoundEnabledChange: (value: boolean) => void;
    onMusicEnabledChange: (value: boolean) => void;
    onSoundVolumeChange: (value: number) => void;
    onMusicVolumeChange: (value: number) => void;
    onBattleStatsInfoChange: (value: boolean) => void;
    onScreenShakeChange: (value: boolean) => void;
    onDeveloperModeEnabledChange: (value: boolean) => void;
    onPlayerColorChange: (value: string) => void;
    onEnemyColorChange: (value: string) => void;
    onAllyColorChange: (value: string) => void;
    onEnemy2ColorChange: (value: string) => void;
    onGraphicsQualityChange: (value: 'low' | 'medium' | 'high' | 'ultra') => void;
    onExperimentalGraphicsEnabledChange: (value: boolean) => void;
    onStarNestEnabledChange: (value: boolean) => void;
    onAdaptiveQualityEnabledChange: (value: boolean) => void;
    onUseSvgSpritesChange: (value: boolean) => void;
    onPauseOnFocusLossEnabledChange: (value: boolean) => void;
    onResolutionChange: (value: string) => void;
    onPixelModeEnabledChange: (value: boolean) => void;
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
        developerModeEnabled,
        playerColor,
        enemyColor,
        allyColor,
        enemy2Color,
        graphicsQuality,
        isExperimentalGraphicsEnabled,
        isStarNestEnabled,
        isAdaptiveQualityEnabled,
        useSvgSprites,
        isPauseOnFocusLossEnabled,
        resolution,
        isPixelModeEnabled,
        colorScheme,
        onDifficultyChange,
        onUsernameChange,
        onSoundEnabledChange,
        onMusicEnabledChange,
        onSoundVolumeChange,
        onMusicVolumeChange,
        onBattleStatsInfoChange,
        onScreenShakeChange,
        onDeveloperModeEnabledChange,
        onPlayerColorChange,
        onEnemyColorChange,
        onAllyColorChange,
        onEnemy2ColorChange,
        onGraphicsQualityChange,
        onExperimentalGraphicsEnabledChange,
        onStarNestEnabledChange,
        onAdaptiveQualityEnabledChange,
        onUseSvgSpritesChange,
        onPauseOnFocusLossEnabledChange,
        onResolutionChange,
        onPixelModeEnabledChange,
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
    title.style.fontWeight = 'bold';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.style.maxWidth = '500px';
    settingsContainer.style.width = '100%';
    settingsContainer.style.padding = '20px';

    const discordButton = document.createElement('a');
    discordButton.href = 'https://discord.gg/dSwR3Fj7du';
    discordButton.target = '_blank';
    discordButton.rel = 'noopener noreferrer';
    discordButton.setAttribute('aria-label', 'Join our Discord server');
    discordButton.style.display = 'flex';
    discordButton.style.alignItems = 'center';
    discordButton.style.justifyContent = 'center';
    discordButton.style.gap = '14px';
    discordButton.style.width = '100%';
    discordButton.style.boxSizing = 'border-box';
    discordButton.style.marginBottom = '36px';
    discordButton.style.padding = isCompactLayout ? '16px 20px' : '20px 26px';
    discordButton.style.border = '3px solid #AEB8FF';
    discordButton.style.borderRadius = '12px';
    discordButton.style.background = 'linear-gradient(135deg, #5865F2, #4752C4)';
    discordButton.style.boxShadow = '0 0 26px rgba(88, 101, 242, 0.75)';
    discordButton.style.color = '#FFFFFF';
    discordButton.style.fontSize = isCompactLayout ? '22px' : '28px';
    discordButton.style.fontWeight = 'bold';
    discordButton.style.textDecoration = 'none';
    discordButton.style.textTransform = 'uppercase';
    discordButton.style.letterSpacing = '1px';
    discordButton.style.transition = 'transform 0.2s, box-shadow 0.2s';
    discordButton.innerHTML = `
        <svg aria-hidden="true" viewBox="0 0 127.14 96.36" width="38" height="30" fill="currentColor">
            <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.17 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77.09 77.09 0 0 0 6.89 11.17 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.16ZM42.45 65.69C36.18 65.69 31 59.96 31 52.91s5.05-12.8 11.43-12.8 11.54 5.78 11.43 12.8-5.05 12.78-11.41 12.78Zm42.24 0c-6.28 0-11.44-5.73-11.44-12.78s5.05-12.8 11.44-12.8 11.54 5.78 11.43 12.8-5.04 12.78-11.43 12.78Z"/>
        </svg>
        <span>Join Our Discord</span>
    `;
    discordButton.addEventListener('mouseenter', () => {
        discordButton.style.transform = 'scale(1.03)';
        discordButton.style.boxShadow = '0 0 36px rgba(88, 101, 242, 0.95)';
    });
    discordButton.addEventListener('mouseleave', () => {
        discordButton.style.transform = 'scale(1)';
        discordButton.style.boxShadow = '0 0 26px rgba(88, 101, 242, 0.75)';
    });
    settingsContainer.appendChild(discordButton);

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

    const developerModeSection = createSettingSection(
        'Developer Mode',
        createToggle(developerModeEnabled, onDeveloperModeEnabledChange)
    );
    settingsContainer.appendChild(developerModeSection);

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

    // Resolution setting
    const resolutionOptions = [
        'native',
        '640x360',
        '960x540',
        '1280x720',
        '1600x900',
        '1920x1080',
        '2560x1440',
        '3840x2160',
    ];
    const resolutionLabels: Record<string, string> = {
        'native': 'Native',
        '640x360': '640 × 360 (nHD)',
        '960x540': '960 × 540 (qHD)',
        '1280x720': '1280 × 720 (720p)',
        '1600x900': '1600 × 900 (HD+)',
        '1920x1080': '1920 × 1080 (1080p)',
        '2560x1440': '2560 × 1440 (1440p)',
        '3840x2160': '3840 × 2160 (4K)',
    };
    const resolutionSelect = createSelect(
        resolutionOptions,
        resolution,
        (value) => {
            onResolutionChange(value);
        }
    );
    // Override the default label formatting to use our custom labels
    for (let i = 0; i < resolutionSelect.options.length; i++) {
        const opt = resolutionSelect.options[i];
        const label = resolutionLabels[opt.value];
        if (label) {
            opt.textContent = label;
        }
    }
    const resolutionSection = createSettingSection('Resolution', resolutionSelect);
    settingsContainer.appendChild(resolutionSection);

    // PIXELS mode toggle (Celeste-style 320x180 upscale)
    const pixelModeSection = createSettingSection(
        'PIXELS (Retro)',
        createToggle(isPixelModeEnabled, onPixelModeEnabledChange)
    );
    settingsContainer.appendChild(pixelModeSection);

    const adaptiveQualitySection = createSettingSection(
        'Adaptive Quality',
        createToggle(isAdaptiveQualityEnabled, onAdaptiveQualityEnabledChange)
    );
    settingsContainer.appendChild(adaptiveQualitySection);

    const svgSpriteSection = createSettingSection(
        'Use SVG Sprites',
        createToggle(useSvgSprites, onUseSvgSpritesChange)
    );
    settingsContainer.appendChild(svgSpriteSection);

    const pauseOnFocusLossSection = createSettingSection(
        'Music/SFX Only When Focused',
        createToggle(isPauseOnFocusLossEnabled, onPauseOnFocusLossEnabledChange)
    );
    settingsContainer.appendChild(pauseOnFocusLossSection);

    const experimentalGraphicsSection = createSettingSection(
        'Experimental Graphics',
        createToggle(isExperimentalGraphicsEnabled, onExperimentalGraphicsEnabledChange)
    );
    settingsContainer.appendChild(experimentalGraphicsSection);

    const starNestSection = createSettingSection(
        'Star Nest Effects',
        createToggle(isStarNestEnabled, onStarNestEnabledChange)
    );
    settingsContainer.appendChild(starNestSection);

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
