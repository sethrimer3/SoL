/**
 * Main Menu for SoL game
 */

import * as Constants from './constants';

export interface MapConfig {
    id: string;
    name: string;
    description: string;
    numSuns: number;
    numAsteroids: number;
    mapSize: number;
}

export interface GameSettings {
    selectedMap: MapConfig;
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
}

export class MainMenu {
    private menuElement: HTMLElement;
    private onStartCallback: ((settings: GameSettings) => void) | null = null;
    private currentScreen: 'main' | 'maps' | 'settings' = 'main';
    private settings: GameSettings;
    
    private availableMaps: MapConfig[] = [
        {
            id: 'standard',
            name: 'Standard Battle',
            description: 'Classic 1v1 map with a single sun at the center. Balanced gameplay with moderate obstacles.',
            numSuns: 1,
            numAsteroids: 10,
            mapSize: 2000
        },
        {
            id: 'twin-suns',
            name: 'Twin Suns',
            description: 'Two suns create complex lighting patterns. Control multiple light sources for economic dominance.',
            numSuns: 2,
            numAsteroids: 12,
            mapSize: 2500
        },
        {
            id: 'asteroid-field',
            name: 'Asteroid Field',
            description: 'Dense asteroid field creates tactical challenges. Careful mirror placement is crucial.',
            numSuns: 1,
            numAsteroids: 20,
            mapSize: 2000
        },
        {
            id: 'open-space',
            name: 'Open Space',
            description: 'Minimal obstacles in a vast arena. Pure strategic combat with fewer terrain advantages.',
            numSuns: 1,
            numAsteroids: 5,
            mapSize: 3000
        }
    ];

    constructor() {
        // Initialize default settings
        this.settings = {
            selectedMap: this.availableMaps[0],
            difficulty: 'normal',
            soundEnabled: true,
            musicEnabled: true
        };
        
        this.menuElement = this.createMenuElement();
        document.body.appendChild(this.menuElement);
    }

    private createMenuElement(): HTMLElement {
        const menu = document.createElement('div');
        menu.id = 'mainMenu';
        menu.style.position = 'fixed';
        menu.style.top = '0';
        menu.style.left = '0';
        menu.style.width = '100%';
        menu.style.height = '100%';
        menu.style.backgroundColor = 'rgba(0, 0, 10, 0.95)';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.justifyContent = 'center';
        menu.style.alignItems = 'center';
        menu.style.zIndex = '1000';
        menu.style.fontFamily = 'Arial, sans-serif';
        menu.style.color = '#FFFFFF';
        menu.style.overflowY = 'auto';

        // Render main screen content into the menu element
        this.renderMainScreenContent(menu);
        
        return menu;
    }

    private clearMenu(): void {
        if (this.menuElement) {
            this.menuElement.innerHTML = '';
        }
    }

    private renderMainScreen(container: HTMLElement): void {
        this.clearMenu();
        this.renderMainScreenContent(container);
    }

    private renderMainScreenContent(container: HTMLElement): void {
        
        // Title
        const title = document.createElement('h1');
        title.textContent = 'SoL';
        title.style.fontSize = '72px';
        title.style.marginBottom = '10px';
        title.style.color = '#FFD700';
        title.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
        container.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Speed of Light RTS';
        subtitle.style.fontSize = '24px';
        subtitle.style.marginBottom = '50px';
        subtitle.style.color = '#AAAAAA';
        container.appendChild(subtitle);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Battle for supremacy around stars using light as a resource';
        description.style.fontSize = '16px';
        description.style.marginBottom = '40px';
        description.style.maxWidth = '500px';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.5';
        container.appendChild(description);

        // Start button
        const startButton = this.createButton('START GAME', () => {
            this.hide();
            if (this.onStartCallback) {
                this.onStartCallback(this.settings);
            }
        });
        container.appendChild(startButton);

        // Map Selection button
        const mapButton = this.createButton('SELECT MAP', () => {
            this.currentScreen = 'maps';
            this.renderMapSelectionScreen(this.menuElement);
        }, '#00AAFF');
        mapButton.style.marginTop = '20px';
        container.appendChild(mapButton);

        // Settings button
        const settingsButton = this.createButton('SETTINGS', () => {
            this.currentScreen = 'settings';
            this.renderSettingsScreen(this.menuElement);
        }, '#00FF88');
        settingsButton.style.marginTop = '20px';
        container.appendChild(settingsButton);

        // Current map indicator
        const mapInfo = document.createElement('div');
        mapInfo.style.marginTop = '40px';
        mapInfo.style.fontSize = '14px';
        mapInfo.style.color = '#AAAAAA';
        mapInfo.innerHTML = `<div style="text-align: center;">Current Map: <span style="color: #FFD700;">${this.settings.selectedMap.name}</span></div>`;
        container.appendChild(mapInfo);

        // Features list
        const features = document.createElement('div');
        features.style.marginTop = '40px';
        features.style.fontSize = '14px';
        features.style.color = '#888888';
        features.innerHTML = `
            <div style="text-align: center;">
                <div>✨ Ray-traced lighting and shadows</div>
                <div style="margin-top: 5px;">🌌 Asteroid obstacles with dynamic polygons</div>
                <div style="margin-top: 5px;">⭐ Solar mirrors with line-of-sight visualization</div>
                <div style="margin-top: 5px;">🎮 Touch and mouse controls</div>
            </div>
        `;
        container.appendChild(features);
    }

    private renderMapSelectionScreen(container: HTMLElement): void {
        this.clearMenu();

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Map';
        title.style.fontSize = '48px';
        title.style.marginBottom = '30px';
        title.style.color = '#FFD700';
        container.appendChild(title);

        // Map grid
        const mapGrid = document.createElement('div');
        mapGrid.style.display = 'grid';
        mapGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        mapGrid.style.gap = '20px';
        mapGrid.style.maxWidth = '900px';
        mapGrid.style.padding = '20px';
        mapGrid.style.marginBottom = '30px';

        for (const map of this.availableMaps) {
            const mapCard = document.createElement('div');
            mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            mapCard.style.border = map.id === this.settings.selectedMap.id ? '3px solid #FFD700' : '2px solid rgba(255, 255, 255, 0.2)';
            mapCard.style.borderRadius = '10px';
            mapCard.style.padding = '20px';
            mapCard.style.cursor = 'pointer';
            mapCard.style.transition = 'all 0.3s';

            mapCard.addEventListener('mouseenter', () => {
                if (map.id !== this.settings.selectedMap.id) {
                    mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    mapCard.style.transform = 'scale(1.02)';
                }
            });

            mapCard.addEventListener('mouseleave', () => {
                mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                mapCard.style.transform = 'scale(1)';
            });

            mapCard.addEventListener('click', () => {
                this.settings.selectedMap = map;
                this.renderMapSelectionScreen(this.menuElement);
            });

            // Map name
            const mapName = document.createElement('h3');
            mapName.textContent = map.name;
            mapName.style.fontSize = '24px';
            mapName.style.marginBottom = '10px';
            mapName.style.color = map.id === this.settings.selectedMap.id ? '#FFD700' : '#FFFFFF';
            mapCard.appendChild(mapName);

            // Map description
            const mapDesc = document.createElement('p');
            mapDesc.textContent = map.description;
            mapDesc.style.fontSize = '14px';
            mapDesc.style.lineHeight = '1.5';
            mapDesc.style.marginBottom = '15px';
            mapDesc.style.color = '#CCCCCC';
            mapCard.appendChild(mapDesc);

            // Map stats
            const mapStats = document.createElement('div');
            mapStats.style.fontSize = '12px';
            mapStats.style.color = '#888888';
            mapStats.innerHTML = `
                <div>⭐ Suns: ${map.numSuns}</div>
                <div>🌑 Asteroids: ${map.numAsteroids}</div>
                <div>📏 Size: ${map.mapSize}px</div>
            `;
            mapCard.appendChild(mapStats);

            mapGrid.appendChild(mapCard);
        }

        container.appendChild(mapGrid);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.renderMainScreen(this.menuElement);
        }, '#666666');
        container.appendChild(backButton);
    }

    private renderSettingsScreen(container: HTMLElement): void {
        this.clearMenu();

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.fontSize = '48px';
        title.style.marginBottom = '30px';
        title.style.color = '#FFD700';
        container.appendChild(title);

        // Settings container
        const settingsContainer = document.createElement('div');
        settingsContainer.style.maxWidth = '500px';
        settingsContainer.style.width = '100%';
        settingsContainer.style.padding = '20px';

        // Difficulty setting
        const difficultySection = this.createSettingSection(
            'Difficulty',
            this.createSelect(
                ['easy', 'normal', 'hard'],
                this.settings.difficulty,
                (value) => {
                    this.settings.difficulty = value as 'easy' | 'normal' | 'hard';
                }
            )
        );
        settingsContainer.appendChild(difficultySection);

        // Sound setting
        const soundSection = this.createSettingSection(
            'Sound Effects',
            this.createToggle(
                this.settings.soundEnabled,
                (value) => {
                    this.settings.soundEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(soundSection);

        // Music setting
        const musicSection = this.createSettingSection(
            'Music',
            this.createToggle(
                this.settings.musicEnabled,
                (value) => {
                    this.settings.musicEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(musicSection);

        container.appendChild(settingsContainer);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.renderMainScreen(this.menuElement);
        }, '#666666');
        backButton.style.marginTop = '30px';
        container.appendChild(backButton);
    }

    private createButton(text: string, onClick: () => void, color: string = '#FFD700'): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.fontSize = '24px';
        button.style.padding = '15px 40px';
        button.style.backgroundColor = color;
        button.style.color = color === '#666666' ? '#FFFFFF' : '#000000';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.transition = 'all 0.3s';
        
        button.addEventListener('mouseenter', () => {
            const hoverColor = color === '#FFD700' ? '#FFA500' : 
                               color === '#00AAFF' ? '#0088DD' : 
                               color === '#00FF88' ? '#00DD66' : '#888888';
            button.style.backgroundColor = hoverColor;
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = color;
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', onClick);
        
        return button;
    }

    private createSettingSection(label: string, control: HTMLElement): HTMLElement {
        const section = document.createElement('div');
        section.style.marginBottom = '30px';
        section.style.display = 'flex';
        section.style.justifyContent = 'space-between';
        section.style.alignItems = 'center';

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.fontSize = '18px';
        labelElement.style.color = '#FFFFFF';

        section.appendChild(labelElement);
        section.appendChild(control);

        return section;
    }

    private createSelect(options: string[], currentValue: string, onChange: (value: string) => void): HTMLSelectElement {
        const select = document.createElement('select');
        select.style.fontSize = '16px';
        select.style.padding = '8px 15px';
        select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        select.style.color = '#FFFFFF';
        select.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        select.style.borderRadius = '5px';
        select.style.cursor = 'pointer';

        for (const option of options) {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
            optionElement.selected = option === currentValue;
            optionElement.style.backgroundColor = Constants.UI_BACKGROUND_COLOR;
            select.appendChild(optionElement);
        }

        select.addEventListener('change', () => {
            onChange(select.value);
        });

        return select;
    }

    private createToggle(currentValue: boolean, onChange: (value: boolean) => void): HTMLElement {
        const toggleContainer = document.createElement('div');
        toggleContainer.style.display = 'flex';
        toggleContainer.style.alignItems = 'center';
        toggleContainer.style.gap = '10px';

        const toggle = document.createElement('div');
        toggle.style.width = '60px';
        toggle.style.height = '30px';
        toggle.style.backgroundColor = currentValue ? '#00FF88' : '#666666';
        toggle.style.borderRadius = '15px';
        toggle.style.position = 'relative';
        toggle.style.cursor = 'pointer';
        toggle.style.transition = 'all 0.3s';

        const knob = document.createElement('div');
        knob.style.width = '26px';
        knob.style.height = '26px';
        knob.style.backgroundColor = '#FFFFFF';
        knob.style.borderRadius = '50%';
        knob.style.position = 'absolute';
        knob.style.top = '2px';
        knob.style.left = currentValue ? '32px' : '2px';
        knob.style.transition = 'all 0.3s';

        toggle.appendChild(knob);

        toggle.addEventListener('click', () => {
            const newValue = !currentValue;
            currentValue = newValue;
            toggle.style.backgroundColor = newValue ? '#00FF88' : '#666666';
            knob.style.left = newValue ? '32px' : '2px';
            onChange(newValue);
        });

        toggleContainer.appendChild(toggle);

        return toggleContainer;
    }

    /**
     * Set callback for when start button is clicked
     */
    onStart(callback: (settings: GameSettings) => void): void {
        this.onStartCallback = callback;
    }

    /**
     * Hide the menu
     */
    hide(): void {
        this.menuElement.style.display = 'none';
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'flex';
        this.currentScreen = 'main';
        this.renderMainScreen(this.menuElement);
    }

    /**
     * Remove the menu from DOM
     */
    destroy(): void {
        if (this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
    }

    /**
     * Get current settings
     */
    getSettings(): GameSettings {
        return this.settings;
    }
}
