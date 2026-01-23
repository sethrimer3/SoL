/**
 * Main Menu for SoL game
 */

import * as Constants from './constants';
import { Faction } from './game-core';

export interface MenuOption {
    id: string;
    name: string;
    description: string;
    icon?: string;
}

export interface MapConfig {
    id: string;
    name: string;
    description: string;
    numSuns: number;
    numAsteroids: number;
    mapSize: number;
}

export interface HeroUnit {
    id: string;
    name: string;
    description: string;
    faction: Faction;
}

export interface GameSettings {
    selectedMap: MapConfig;
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
    selectedFaction: Faction | null;
    selectedHeroes: string[]; // Hero IDs
}

export class MainMenu {
    private menuElement: HTMLElement;
    private onStartCallback: ((settings: GameSettings) => void) | null = null;
    private currentScreen: 'main' | 'maps' | 'settings' | 'faction-select' | 'loadout-select' = 'main';
    private settings: GameSettings;
    private carouselMenu: CarouselMenuView | null = null;
    
    // Hero unit data - stubs for now
    private heroUnits: HeroUnit[] = [
        // Radiant faction heroes
        { id: 'radiant-1', name: 'Luminar', description: 'Master of light manipulation', faction: Faction.RADIANT },
        { id: 'radiant-2', name: 'Prismara', description: 'Rainbow warrior', faction: Faction.RADIANT },
        { id: 'radiant-3', name: 'Solstice', description: 'Sun-caller', faction: Faction.RADIANT },
        { id: 'radiant-4', name: 'Beamforge', description: 'Laser specialist', faction: Faction.RADIANT },
        { id: 'radiant-5', name: 'Photonix', description: 'Speed of light incarnate', faction: Faction.RADIANT },
        { id: 'radiant-6', name: 'Glowbringer', description: 'Illumination support', faction: Faction.RADIANT },
        { id: 'radiant-7', name: 'Radiance', description: 'Pure light entity', faction: Faction.RADIANT },
        { id: 'radiant-8', name: 'Stellaris', description: 'Star-born warrior', faction: Faction.RADIANT },
        { id: 'radiant-9', name: 'Luxarion', description: 'Light shield bearer', faction: Faction.RADIANT },
        { id: 'radiant-10', name: 'Dawnbringer', description: 'Herald of morning', faction: Faction.RADIANT },
        { id: 'radiant-11', name: 'Shimmerwind', description: 'Swift light dancer', faction: Faction.RADIANT },
        { id: 'radiant-12', name: 'Eclipsar', description: 'Master of light and shadow', faction: Faction.RADIANT },
        
        // Aurum faction heroes
        { id: 'aurum-1', name: 'Goldhart', description: 'Golden commander', faction: Faction.AURUM },
        { id: 'aurum-2', name: 'Wealthweaver', description: 'Economic mastermind', faction: Faction.AURUM },
        { id: 'aurum-3', name: 'Coinforge', description: 'Resource multiplier', faction: Faction.AURUM },
        { id: 'aurum-4', name: 'Gilded Guardian', description: 'Defensive specialist', faction: Faction.AURUM },
        { id: 'aurum-5', name: 'Treasureheart', description: 'Loot collector', faction: Faction.AURUM },
        { id: 'aurum-6', name: 'Aurumancer', description: 'Gold magic user', faction: Faction.AURUM },
        { id: 'aurum-7', name: 'Mintmaster', description: 'Economy booster', faction: Faction.AURUM },
        { id: 'aurum-8', name: 'Goldstrike', description: 'Heavy hitter', faction: Faction.AURUM },
        { id: 'aurum-9', name: 'Vaultkeeper', description: 'Resource protector', faction: Faction.AURUM },
        { id: 'aurum-10', name: 'Prosperion', description: 'Wealth incarnate', faction: Faction.AURUM },
        { id: 'aurum-11', name: 'Opulence', description: 'Luxury warrior', faction: Faction.AURUM },
        { id: 'aurum-12', name: 'Bullionaire', description: 'Market dominator', faction: Faction.AURUM },
        
        // Solari faction heroes
        { id: 'solari-1', name: 'Sunwarden', description: 'Solar defender', faction: Faction.SOLARI },
        { id: 'solari-2', name: 'Flareborn', description: 'Fire warrior', faction: Faction.SOLARI },
        { id: 'solari-3', name: 'Heliarch', description: 'Sun priest', faction: Faction.SOLARI },
        { id: 'solari-4', name: 'Coronax', description: 'Solar storm bringer', faction: Faction.SOLARI },
        { id: 'solari-5', name: 'Pyroclast', description: 'Lava manipulator', faction: Faction.SOLARI },
        { id: 'solari-6', name: 'Solarion', description: 'Sun champion', faction: Faction.SOLARI },
        { id: 'solari-7', name: 'Infernova', description: 'Supernova wielder', faction: Faction.SOLARI },
        { id: 'solari-8', name: 'Dawnkeeper', description: 'Morning guardian', faction: Faction.SOLARI },
        { id: 'solari-9', name: 'Sunscorch', description: 'Burning blade', faction: Faction.SOLARI },
        { id: 'solari-10', name: 'Heliorax', description: 'Solar dragon', faction: Faction.SOLARI },
        { id: 'solari-11', name: 'Blazeheart', description: 'Fire soul', faction: Faction.SOLARI },
        { id: 'solari-12', name: 'Solarflare', description: 'Burst specialist', faction: Faction.SOLARI },
    ];
    
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
            musicEnabled: true,
            selectedFaction: null,
            selectedHeroes: []
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
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
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
        subtitle.style.marginBottom = '30px';
        subtitle.style.color = '#AAAAAA';
        container.appendChild(subtitle);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Select a menu option below';
        description.style.fontSize = '16px';
        description.style.marginBottom = '40px';
        description.style.maxWidth = '500px';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.5';
        container.appendChild(description);

        // Create carousel menu container
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = '900px';
        carouselContainer.style.marginBottom = '40px';
        container.appendChild(carouselContainer);

        // Create carousel menu with main menu options
        const menuOptions: MenuOption[] = [
            {
                id: 'loadout',
                name: 'LOADOUT',
                description: 'Select faction & heroes'
            },
            {
                id: 'start',
                name: 'START',
                description: 'Begin game'
            },
            {
                id: 'maps',
                name: 'MAPS',
                description: 'Select map'
            },
            {
                id: 'settings',
                name: 'SETTINGS',
                description: 'Configure game'
            }
        ];

        this.carouselMenu = new CarouselMenuView(carouselContainer, menuOptions);
        this.carouselMenu.onSelect((option: MenuOption) => {
            switch (option.id) {
                case 'loadout':
                    this.currentScreen = 'faction-select';
                    this.renderFactionSelectionScreen(this.menuElement);
                    break;
                case 'start':
                    this.hide();
                    if (this.onStartCallback) {
                        this.onStartCallback(this.settings);
                    }
                    break;
                case 'maps':
                    this.currentScreen = 'maps';
                    this.renderMapSelectionScreen(this.menuElement);
                    break;
                case 'settings':
                    this.currentScreen = 'settings';
                    this.renderSettingsScreen(this.menuElement);
                    break;
            }
        });

        // Current loadout and map indicators
        const statusInfo = document.createElement('div');
        statusInfo.style.marginTop = '20px';
        statusInfo.style.fontSize = '14px';
        statusInfo.style.color = '#AAAAAA';
        
        let loadoutStatus = 'Not configured';
        if (this.settings.selectedFaction && this.settings.selectedHeroes.length === 4) {
            loadoutStatus = `<span style="color: #00FF88;">${this.settings.selectedFaction} - 4 heroes</span>`;
        } else if (this.settings.selectedFaction) {
            loadoutStatus = `<span style="color: #FFA500;">${this.settings.selectedFaction} - ${this.settings.selectedHeroes.length}/4 heroes</span>`;
        }
        
        statusInfo.innerHTML = `
            <div style="text-align: center;">
                <div>Loadout: ${loadoutStatus}</div>
                <div style="margin-top: 5px;">Map: <span style="color: #FFD700;">${this.settings.selectedMap.name}</span></div>
            </div>
        `;
        container.appendChild(statusInfo);

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

    private renderFactionSelectionScreen(container: HTMLElement): void {
        this.clearMenu();

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Your Faction';
        title.style.fontSize = '48px';
        title.style.marginBottom = '30px';
        title.style.color = '#FFD700';
        container.appendChild(title);

        // Faction grid
        const factionGrid = document.createElement('div');
        factionGrid.style.display = 'grid';
        factionGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
        factionGrid.style.gap = '20px';
        factionGrid.style.maxWidth = '900px';
        factionGrid.style.padding = '20px';
        factionGrid.style.marginBottom = '30px';

        const factions = [
            { 
                id: Faction.RADIANT, 
                name: 'Radiant', 
                description: 'Masters of light manipulation. Enhanced mirror efficiency and faster light-based attacks.',
                color: '#00AAFF'
            },
            { 
                id: Faction.AURUM, 
                name: 'Aurum', 
                description: 'Wealth-oriented civilization. Economic bonuses and resource multiplication.',
                color: '#FFD700'
            },
            { 
                id: Faction.SOLARI, 
                name: 'Solari', 
                description: 'Sun-worshipping empire. Stronger structures and enhanced solar collection.',
                color: '#FF6600'
            }
        ];

        for (const faction of factions) {
            const factionCard = document.createElement('div');
            factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            factionCard.style.border = this.settings.selectedFaction === faction.id ? `3px solid ${faction.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            factionCard.style.borderRadius = '10px';
            factionCard.style.padding = '20px';
            factionCard.style.cursor = 'pointer';
            factionCard.style.transition = 'all 0.3s';
            factionCard.style.minHeight = '200px';

            factionCard.addEventListener('mouseenter', () => {
                if (this.settings.selectedFaction !== faction.id) {
                    factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    factionCard.style.transform = 'scale(1.02)';
                }
            });

            factionCard.addEventListener('mouseleave', () => {
                factionCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                factionCard.style.transform = 'scale(1)';
            });

            factionCard.addEventListener('click', () => {
                this.settings.selectedFaction = faction.id;
                this.settings.selectedHeroes = []; // Reset hero selection when faction changes
                this.renderFactionSelectionScreen(this.menuElement);
            });

            // Faction name
            const factionName = document.createElement('h3');
            factionName.textContent = faction.name;
            factionName.style.fontSize = '28px';
            factionName.style.marginBottom = '15px';
            factionName.style.color = this.settings.selectedFaction === faction.id ? faction.color : '#FFFFFF';
            factionCard.appendChild(factionName);

            // Faction description
            const factionDesc = document.createElement('p');
            factionDesc.textContent = faction.description;
            factionDesc.style.fontSize = '14px';
            factionDesc.style.lineHeight = '1.5';
            factionDesc.style.color = '#CCCCCC';
            factionCard.appendChild(factionDesc);

            factionGrid.appendChild(factionCard);
        }

        container.appendChild(factionGrid);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '20px';

        // Continue button (only enabled if faction is selected)
        if (this.settings.selectedFaction) {
            const continueButton = this.createButton('SELECT HEROES', () => {
                this.currentScreen = 'loadout-select';
                this.renderLoadoutSelectionScreen(this.menuElement);
            }, '#00FF88');
            buttonContainer.appendChild(continueButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.renderMainScreen(this.menuElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
    }

    private renderLoadoutSelectionScreen(container: HTMLElement): void {
        this.clearMenu();

        if (!this.settings.selectedFaction) {
            // Shouldn't happen, but handle gracefully
            this.renderFactionSelectionScreen(container);
            return;
        }

        // Title
        const title = document.createElement('h2');
        title.textContent = `Select 4 Heroes - ${this.settings.selectedFaction}`;
        title.style.fontSize = '42px';
        title.style.marginBottom = '20px';
        title.style.color = '#FFD700';
        container.appendChild(title);

        // Selection counter
        const counter = document.createElement('div');
        counter.textContent = `Selected: ${this.settings.selectedHeroes.length} / 4`;
        counter.style.fontSize = '18px';
        counter.style.marginBottom = '30px';
        counter.style.color = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        container.appendChild(counter);

        // Hero grid
        const heroGrid = document.createElement('div');
        heroGrid.style.display = 'grid';
        heroGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        heroGrid.style.gap = '15px';
        heroGrid.style.maxWidth = '1000px';
        heroGrid.style.padding = '20px';
        heroGrid.style.marginBottom = '20px';
        heroGrid.style.maxHeight = '500px';
        heroGrid.style.overflowY = 'auto';

        // Filter heroes by selected faction
        const factionHeroes = this.heroUnits.filter(hero => hero.faction === this.settings.selectedFaction);

        for (const hero of factionHeroes) {
            const isSelected = this.settings.selectedHeroes.includes(hero.id);
            const canSelect = isSelected || this.settings.selectedHeroes.length < 4;

            const heroCard = document.createElement('div');
            heroCard.style.backgroundColor = isSelected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            heroCard.style.border = isSelected ? '3px solid #00FF88' : '2px solid rgba(255, 255, 255, 0.2)';
            heroCard.style.borderRadius = '10px';
            heroCard.style.padding = '15px';
            heroCard.style.cursor = canSelect ? 'pointer' : 'not-allowed';
            heroCard.style.transition = 'all 0.3s';
            heroCard.style.opacity = canSelect ? '1' : '0.5';
            heroCard.style.minHeight = '120px';

            if (canSelect) {
                heroCard.addEventListener('mouseenter', () => {
                    if (!isSelected) {
                        heroCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        heroCard.style.transform = 'scale(1.02)';
                    }
                });

                heroCard.addEventListener('mouseleave', () => {
                    heroCard.style.backgroundColor = isSelected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)';
                    heroCard.style.transform = 'scale(1)';
                });

                heroCard.addEventListener('click', () => {
                    if (isSelected) {
                        // Deselect hero
                        this.settings.selectedHeroes = this.settings.selectedHeroes.filter(id => id !== hero.id);
                    } else if (this.settings.selectedHeroes.length < 4) {
                        // Select hero
                        this.settings.selectedHeroes.push(hero.id);
                    }
                    this.renderLoadoutSelectionScreen(this.menuElement);
                });
            }

            // Hero name
            const heroName = document.createElement('h4');
            heroName.textContent = hero.name;
            heroName.style.fontSize = '18px';
            heroName.style.marginBottom = '8px';
            heroName.style.color = isSelected ? '#00FF88' : '#FFFFFF';
            heroCard.appendChild(heroName);

            // Hero description
            const heroDesc = document.createElement('p');
            heroDesc.textContent = hero.description;
            heroDesc.style.fontSize = '12px';
            heroDesc.style.lineHeight = '1.4';
            heroDesc.style.color = '#AAAAAA';
            heroCard.appendChild(heroDesc);

            // Selection indicator
            if (isSelected) {
                const indicator = document.createElement('div');
                indicator.textContent = '✓ Selected';
                indicator.style.fontSize = '12px';
                indicator.style.marginTop = '8px';
                indicator.style.color = '#00FF88';
                indicator.style.fontWeight = 'bold';
                heroCard.appendChild(indicator);
            }

            heroGrid.appendChild(heroCard);
        }

        container.appendChild(heroGrid);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '20px';

        // Confirm button (only enabled if 4 heroes selected)
        if (this.settings.selectedHeroes.length === 4) {
            const confirmButton = this.createButton('CONFIRM LOADOUT', () => {
                this.currentScreen = 'main';
                this.renderMainScreen(this.menuElement);
            }, '#00FF88');
            buttonContainer.appendChild(confirmButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'faction-select';
            this.renderFactionSelectionScreen(this.menuElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
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
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
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

/**
 * Carousel menu view - displays menu options in a horizontal carousel
 */
class CarouselMenuView {
    // Animation constants
    private static readonly ITEM_WIDTH = 200;
    private static readonly BASE_SIZE = 120;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    
    private container: HTMLElement;
    private options: MenuOption[];
    private currentIndex: number = 0;
    private targetIndex: number = 0;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private velocity: number = 0;
    private onSelectCallback: ((option: MenuOption) => void) | null = null;
    private animationFrameId: number | null = null;
    private hasDragged: boolean = false;

    constructor(container: HTMLElement, options: MenuOption[]) {
        this.container = container;
        this.options = options;
        this.setupContainer();
        this.setupEventHandlers();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '400px';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y'; // Allow vertical scrolling but handle horizontal ourselves
    }

    private setupEventHandlers(): void {
        // Mouse events
        this.container.addEventListener('mousedown', (e: MouseEvent) => {
            this.startDrag(e.clientX);
            e.preventDefault();
        });

        this.container.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.isDragging) {
                this.updateDrag(e.clientX);
                e.preventDefault();
            }
        });

        this.container.addEventListener('mouseup', (e: MouseEvent) => {
            this.endDrag(e.clientX);
            e.preventDefault();
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.endDrag(this.dragStartX);
            }
        });

        // Touch events
        this.container.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                this.startDrag(e.touches[0].clientX);
                e.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (e: TouchEvent) => {
            if (this.isDragging && e.touches.length === 1) {
                this.updateDrag(e.touches[0].clientX);
                e.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (e: TouchEvent) => {
            if (this.isDragging) {
                const touch = e.changedTouches[0];
                this.endDrag(touch.clientX);
                e.preventDefault();
            }
        }, { passive: false });
    }

    private startDrag(x: number): void {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartOffset = this.scrollOffset;
        this.velocity = 0;
        this.hasDragged = false;
        this.container.style.cursor = 'grabbing';
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * CarouselMenuView.VELOCITY_MULTIPLIER; // Track velocity for momentum
        
        // Track if we've dragged significantly
        if (Math.abs(deltaX) > 5) {
            this.hasDragged = true;
        }
    }

    private endDrag(x: number): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.style.cursor = 'grab';
        
        // If not dragged significantly, treat as a click/tap
        if (!this.hasDragged) {
            this.handleClick(x);
            return;
        }
        
        // Snap to nearest option based on current position and velocity
        const targetIndexFloat = -this.scrollOffset / CarouselMenuView.ITEM_WIDTH;
        let targetIndex = Math.round(targetIndexFloat + this.velocity * CarouselMenuView.VELOCITY_FACTOR);
        
        // Clamp to valid range
        targetIndex = Math.max(0, Math.min(this.options.length - 1, targetIndex));
        this.targetIndex = targetIndex;
        this.currentIndex = targetIndex;
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        
        // Determine which option was clicked based on position
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / CarouselMenuView.ITEM_WIDTH);
        const clickedIndex = Math.max(0, Math.min(this.options.length - 1, clickedOffset));
        
        if (clickedIndex === this.currentIndex) {
            // Clicked on center option - select it
            if (this.onSelectCallback) {
                this.onSelectCallback(this.options[this.currentIndex]);
            }
        } else {
            // Clicked on different option - slide to it
            this.targetIndex = clickedIndex;
            this.currentIndex = clickedIndex;
        }
    }

    private startAnimation(): void {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    private update(): void {
        // Smooth scrolling towards target
        const targetScrollOffset = -this.currentIndex * CarouselMenuView.ITEM_WIDTH;
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * CarouselMenuView.SMOOTH_INTERPOLATION_FACTOR;
        
        // Apply velocity decay when not dragging
        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= CarouselMenuView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
    }

    private render(): void {
        // Clear container
        this.container.innerHTML = '';
        
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Render each option
        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            
            // Calculate position
            const x = centerX + this.scrollOffset + i * CarouselMenuView.ITEM_WIDTH;
            
            // Calculate size and opacity based on distance from center
            let scale = 1.0;
            let opacity = 1.0;
            
            if (distance === 0) {
                scale = 1.0;
                opacity = 1.0;
            } else if (distance === 1) {
                scale = 0.75;
                opacity = 0.75;
            } else if (distance === 2) {
                scale = 0.5;
                opacity = 0.5;
            } else {
                scale = Math.max(0.25, 1.0 - distance * 0.25);
                opacity = Math.max(0.25, 1.0 - distance * 0.25);
            }
            
            const size = CarouselMenuView.BASE_SIZE * scale;
            
            // Create option element
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - size / 2}px`;
            optionElement.style.top = `${centerY - size / 2}px`;
            optionElement.style.width = `${size}px`;
            optionElement.style.height = `${size}px`;
            optionElement.style.backgroundColor = distance === 0 ? '#FFD700' : '#00AAFF';
            optionElement.style.border = '3px solid rgba(255, 255, 255, 0.5)';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.transition = 'background-color 0.2s';
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none'; // Let container handle events
            optionElement.style.color = '#000000';
            optionElement.style.fontWeight = 'bold';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = '10px';
            optionElement.style.boxSizing = 'border-box';
            
            // Add option name
            const nameElement = document.createElement('div');
            nameElement.textContent = option.name;
            nameElement.style.fontSize = `${Math.max(12, 16 * scale)}px`;
            nameElement.style.marginBottom = '5px';
            optionElement.appendChild(nameElement);
            
            // Add option description (only for center item)
            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(8, 10 * scale)}px`;
                descElement.style.color = '#333333';
                descElement.style.overflow = 'hidden';
                descElement.style.textOverflow = 'ellipsis';
                optionElement.appendChild(descElement);
            }
            
            this.container.appendChild(optionElement);
        }
        
        // Add instruction text
        const instructionElement = document.createElement('div');
        instructionElement.textContent = 'Drag to browse • Click center to select';
        instructionElement.style.position = 'absolute';
        instructionElement.style.bottom = '20px';
        instructionElement.style.left = '50%';
        instructionElement.style.transform = 'translateX(-50%)';
        instructionElement.style.color = '#AAAAAA';
        instructionElement.style.fontSize = '14px';
        instructionElement.style.pointerEvents = 'none';
        this.container.appendChild(instructionElement);
    }

    public onSelect(callback: (option: MenuOption) => void): void {
        this.onSelectCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
