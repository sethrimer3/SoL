/**
 * Main Menu for SoL game
 */

import * as Constants from './constants';
import { Faction } from './game-core';
import { NetworkManager, LANSignaling, LobbyInfo } from './network';
import { MenuOption, FactionCarouselOption, MapConfig, HeroUnit, BaseLoadout, SpawnLoadout } from './menu/types';
import { BackgroundParticleLayer } from './menu/background-particles';
import { MenuAtmosphereLayer } from './menu/atmosphere';
import { ParticleMenuLayer } from './menu/particle-layer';
import { ColorScheme, COLOR_SCHEMES } from './menu/color-schemes';
import { 
    createSettingSection, 
    createSelect, 
    createToggle, 
    createColorPicker, 
    createTextInput 
} from './menu/ui-helpers';
import { LanLobbyManager, LanLobbyEntry } from './menu/lan-lobby-manager';
import { PlayerProfileManager } from './menu/player-profile-manager';
import { renderMapSelectionScreen } from './menu/screens/map-selection-screen';
import { renderSettingsScreen } from './menu/screens/settings-screen';
import { renderGameModeSelectionScreen } from './menu/screens/game-mode-selection-screen';
import { renderMatchHistoryScreen } from './menu/screens/match-history-screen';
import { renderOnlinePlaceholderScreen } from './menu/screens/online-placeholder-screen';
import { renderFactionSelectionScreen } from './menu/screens/faction-selection-screen';
import { renderLoadoutCustomizationScreen } from './menu/screens/loadout-customization-screen';
import { renderLoadoutSelectionScreen } from './menu/screens/loadout-selection-screen';
import { renderP2PMenuScreen } from './menu/screens/p2p-menu-screen';
import { renderP2PHostScreen } from './menu/screens/p2p-host-screen';
import { renderP2PJoinScreen } from './menu/screens/p2p-join-screen';
import { renderLANScreen } from './menu/screens/lan-screen';
import { renderHostLobbyScreen } from './menu/screens/lan-host-lobby-screen';
import { renderClientAnswerScreen, renderClientWaitingScreen } from './menu/screens/lan-client-screens';
import { renderCustomLobbyScreen } from './menu/screens/custom-lobby-screen';
import { renderMatchmaking2v2Screen } from './menu/screens/matchmaking-2v2-screen';
import { renderLobbyDetailScreen } from './menu/screens/lobby-detail-screen';
import { renderMainScreen } from './menu/screens/main-screen';
import { createMapPreviewCanvas } from './menu/map-preview';
import { MenuAudioController } from './menu/menu-audio';
import { CarouselMenuView } from './menu/carousel-menu-view';
import { FactionCarouselView } from './menu/faction-carousel-view';
import { BUILD_NUMBER } from './build-info';
import { MultiplayerNetworkManager, NetworkEvent as P2PNetworkEvent, Match, MatchPlayer } from './multiplayer-network';
import { OnlineNetworkManager } from './online-network';
import { getSupabaseConfig } from '../Supabase/supabase-config';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { 
    getMatchHistory, 
    MatchHistoryEntry, 
    loadReplayFromStorage, 
    ReplayData,
    getPlayerMMRData
} from './replay';
import { HERO_UNITS } from './menu/hero-data';
import { AVAILABLE_MAPS, BASE_LOADOUTS, SPAWN_LOADOUTS } from './menu/map-data';

// Re-export types for backward compatibility
export { MenuOption, MapConfig, HeroUnit, BaseLoadout, SpawnLoadout, ColorScheme, COLOR_SCHEMES };
export { CarouselMenuView } from './menu/carousel-menu-view';
export { FactionCarouselView } from './menu/faction-carousel-view';

export interface GameSettings {
    selectedMap: MapConfig;
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
    soundVolume: number; // Sound effect volume percentage (0-100)
    musicVolume: number; // Music volume percentage (0-100)
    isBattleStatsInfoEnabled: boolean;
    screenShakeEnabled: boolean; // Screen shake for explosions and splash damage
    selectedFaction: Faction | null;
    selectedHeroes: string[]; // Hero IDs
    selectedHeroNames: string[];
    playerColor: string;
    enemyColor: string;
    allyColor: string; // Color for teammates in 2v2
    enemy2Color: string; // Color for second enemy in 2v2
    selectedBaseLoadout: string | null; // Base loadout ID
    selectedSpawnLoadout: string | null; // Spawn loadout ID
    colorScheme: string; // Color scheme ID
    damageDisplayMode: 'damage' | 'remaining-life'; // How to display damage numbers
    healthDisplayMode: 'bar' | 'number'; // How to display unit health
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'; // Graphics quality setting
    username: string; // Player's username for multiplayer
    gameMode: 'ai' | 'online' | 'lan' | 'p2p' | 'custom-lobby' | '2v2-matchmaking'; // Game mode selection
    networkManager?: NetworkManager; // Network manager for LAN/online play
    multiplayerNetworkManager?: MultiplayerNetworkManager; // Network manager for P2P play
}

export class MainMenu {
    private menuElement: HTMLElement;
    private contentElement!: HTMLElement;
    private backgroundParticleLayer: BackgroundParticleLayer | null = null;
    private atmosphereLayer: MenuAtmosphereLayer | null = null;
    private menuParticleLayer: ParticleMenuLayer | null = null;
    private resizeHandler: (() => void) | null = null;
    private onStartCallback: ((settings: GameSettings) => void) | null = null;
    private currentScreen: 'main' | 'maps' | 'settings' | 'faction-select' | 'loadout-customization' | 'loadout-select' | 'game-mode-select' | 'lan' | 'online' | 'p2p' | 'p2p-host' | 'p2p-join' | 'match-history' | 'custom-lobby' | '2v2-matchmaking' | 'lobby-detail' = 'main';
    private settings: GameSettings;
    private carouselMenu: CarouselMenuView | null = null;
    private factionCarousel: FactionCarouselView | null = null;
    private testLevelButton: HTMLButtonElement | null = null;
    private ladButton: HTMLButtonElement | null = null;
    private lanLobbyManager: LanLobbyManager = new LanLobbyManager(); // LAN lobby discovery manager
    private playerProfileManager: PlayerProfileManager = new PlayerProfileManager(); // Player profile manager
    private networkManager: NetworkManager | null = null; // Network manager for LAN play
    private multiplayerNetworkManager: MultiplayerNetworkManager | null = null; // Network manager for P2P play
    private onlineNetworkManager: OnlineNetworkManager | null = null; // Network manager for Online/Custom lobbies
    private matchmakingPollInterval: number | null = null; // Poll interval for matchmaking
    private p2pMatchPlayers: MatchPlayer[] = []; // Track players in P2P match
    private p2pMatchName: string = ''; // Track P2P match name
    private p2pMaxPlayers: number = 2; // Track P2P max players
    private mainScreenRenderToken: number = 0;
    private onlineMode: 'ranked' | 'unranked' = 'ranked'; // Track which online mode is selected
    private visibilityHandler: (() => void) | null = null;
    private blurHandler: (() => void) | null = null;
    private focusHandler: (() => void) | null = null;
    private menuAudioController: MenuAudioController;
    private isMatchmakingSearching = false;
    
    private heroUnits: HeroUnit[] = HERO_UNITS;
    private availableMaps: MapConfig[] = AVAILABLE_MAPS;
    private baseLoadouts: BaseLoadout[] = BASE_LOADOUTS;
    private spawnLoadouts: SpawnLoadout[] = SPAWN_LOADOUTS;

    constructor() {
        // Initialize default settings
        this.settings = {
            selectedMap: this.availableMaps[0],
            difficulty: 'normal',
            soundEnabled: true,
            musicEnabled: true,
            soundVolume: 100,
            musicVolume: 100,
            isBattleStatsInfoEnabled: false,
            screenShakeEnabled: true, // Default to enabled
            selectedFaction: Faction.RADIANT,
            selectedHeroes: ['radiant-marine'],
            selectedHeroNames: [],
            playerColor: '#66B3FF', // Somewhat light blue
            enemyColor: '#FF6B6B',   // Slightly light red
            allyColor: '#88FF88',    // Light green for allies
            enemy2Color: '#FFA500',  // Orange for second enemy
            selectedBaseLoadout: null,
            selectedSpawnLoadout: null,
            colorScheme: 'SpaceBlack', // Default color scheme
            damageDisplayMode: 'damage', // Default to showing damage numbers
            healthDisplayMode: 'bar', // Default to showing health bars
            graphicsQuality: 'ultra', // Default to ultra graphics
            username: this.playerProfileManager.getOrGenerateUsername(), // Load or generate username
            gameMode: 'ai' // Default to AI mode
        };
        this.ensureDefaultHeroSelection();
        this.menuAudioController = new MenuAudioController(this.resolveAssetPath.bind(this));
        
        // Initialize online network manager for custom lobbies and matchmaking
        const playerId = this.playerProfileManager.getOrGeneratePlayerId();
        this.onlineNetworkManager = new OnlineNetworkManager(playerId);
        
        this.menuElement = this.createMenuElement();
        document.body.appendChild(this.menuElement);
        this.menuAudioController.setMusicEnabled(this.settings.musicEnabled);
        this.menuAudioController.setMusicVolume(this.settings.musicVolume / 100);
        this.menuAudioController.setVisible(true);
        this.updateMenuAudioState();

        const unlockAudioOnGesture = (): void => {
            this.menuAudioController.unlockFromUserGesture();
            document.removeEventListener('pointerdown', unlockAudioOnGesture);
            document.removeEventListener('keydown', unlockAudioOnGesture);
        };
        document.addEventListener('pointerdown', unlockAudioOnGesture, { once: true });
        document.addEventListener('keydown', unlockAudioOnGesture, { once: true });

        this.visibilityHandler = () => {
            if (document.hidden || !document.hasFocus()) {
                this.menuAudioController.setVisible(false);
                this.pauseMenuAnimations();
                return;
            }
            this.menuAudioController.setVisible(true);
            this.resumeMenuAnimations();
        };
        this.blurHandler = () => {
            this.menuAudioController.setVisible(false);
            this.pauseMenuAnimations();
        };
        this.focusHandler = () => {
            if (!document.hidden) {
                this.menuAudioController.setVisible(true);
                this.resumeMenuAnimations();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
        window.addEventListener('blur', this.blurHandler);
        window.addEventListener('focus', this.focusHandler);
        
        // Start menu animations on initial load
        this.resumeMenuAnimations();
    }

    private createMenuElement(): HTMLElement {
        const menu = document.createElement('div');
        menu.id = 'mainMenu';
        menu.style.position = 'fixed';
        menu.style.top = '0';
        menu.style.left = '0';
        menu.style.width = '100%';
        menu.style.height = '100%';
        menu.style.boxSizing = 'border-box';
        menu.style.backgroundColor = 'transparent';
        menu.style.zIndex = '1000';
        menu.style.fontFamily = '"Doto", Arial, sans-serif';
        menu.style.fontWeight = '300';
        menu.style.fontSize = '24px';
        menu.style.color = '#FFFFFF';
        menu.style.overflowY = 'auto';
        menu.style.overflowX = 'hidden';
        menu.style.isolation = 'isolate';

        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.zIndex = '1';
        content.style.width = '100%';
        content.style.minHeight = '100%';
        content.style.padding = '24px 16px';
        content.style.boxSizing = 'border-box';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.justifyContent = 'center';
        content.style.alignItems = 'center';
        menu.appendChild(content);

        this.contentElement = content;
        this.backgroundParticleLayer = new BackgroundParticleLayer(menu);
        this.backgroundParticleLayer.setGraphicsQuality(this.settings.graphicsQuality);
        this.atmosphereLayer = new MenuAtmosphereLayer(
            menu,
            this.resolveAssetPath('ASSETS/sprites/environment/centralSun.svg')
        );
        this.atmosphereLayer.setGraphicsQuality(this.settings.graphicsQuality);
        this.menuParticleLayer = new ParticleMenuLayer(menu);
        this.menuParticleLayer.setGraphicsQuality(this.settings.graphicsQuality);
        this.menuParticleLayer.setMenuContentElement(content);
        menu.appendChild(this.createBuildNumberLabel());
        this.testLevelButton = this.createTestLevelButton();
        menu.appendChild(this.testLevelButton);
        this.ladButton = this.createLadButton();
        menu.appendChild(this.ladButton);

        // Menu images are now preloaded in index.html, so we can render directly
        this.renderMainScreenContent(content);

        this.resizeHandler = () => {
            this.backgroundParticleLayer?.resize();
            this.atmosphereLayer?.resize();
            this.updateSunRumbleAudioContext();
            if (!this.menuParticleLayer) {
                return;
            }
            this.menuParticleLayer.resize();
            this.menuParticleLayer.requestTargetRefresh(this.contentElement);
        };
        window.addEventListener('resize', this.resizeHandler);
        menu.addEventListener('scroll', () => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        
        return menu;
    }

    private pauseMenuAnimations(): void {
        this.backgroundParticleLayer?.stop();
        this.atmosphereLayer?.stop();
        this.menuParticleLayer?.stop();
        this.carouselMenu?.pauseAnimation();
        this.factionCarousel?.pauseAnimation();
    }

    private resumeMenuAnimations(): void {
        if (this.menuElement.style.display === 'none') {
            return;
        }
        this.backgroundParticleLayer?.start();
        this.atmosphereLayer?.start();
        this.menuParticleLayer?.start();
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        this.updateSunRumbleAudioContext();
        this.carouselMenu?.resumeAnimation();
        this.factionCarousel?.resumeAnimation();
    }

    private createBuildNumberLabel(): HTMLDivElement {
        const label = document.createElement('div');
        label.textContent = `BUILD ${BUILD_NUMBER}`;
        label.style.position = 'absolute';
        label.style.top = '16px';
        label.style.left = '16px';
        label.style.padding = '6px 10px';
        label.style.borderRadius = '6px';
        label.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        label.style.backgroundColor = 'rgba(10, 10, 10, 0.6)';
        label.style.color = '#FFFFFF';
        label.style.fontFamily = '"Doto", Arial, sans-serif';
        label.style.fontWeight = '500';
        label.style.fontSize = '12px';
        label.style.letterSpacing = '0.18em';
        label.style.textTransform = 'uppercase';
        label.style.zIndex = '2';
        label.style.pointerEvents = 'none';
        return label;
    }

    private createTestLevelButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = 'TEST LEVEL';
        button.type = 'button';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.right = '20px';
        button.style.padding = '10px 16px';
        button.style.borderRadius = '6px';
        button.style.border = '1px solid rgba(255, 255, 255, 0.6)';
        button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
        button.style.color = '#FFFFFF';
        button.style.fontFamily = 'Arial, sans-serif';
        button.style.fontWeight = '500';
        button.style.fontSize = '14px';
        button.style.letterSpacing = '0.08em';
        button.style.cursor = 'pointer';
        button.style.zIndex = '2';
        button.style.transition = 'background-color 0.2s ease, border-color 0.2s ease';

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(60, 60, 60, 0.85)';
            button.style.borderColor = '#FFD700';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });

        button.addEventListener('click', () => {
            const testMap = this.availableMaps.find(map => map.id === 'test-level');
            if (!testMap) {
                return;
            }
            this.settings.selectedMap = testMap;
            this.hide();
            if (this.onStartCallback) {
                this.ensureDefaultHeroSelection();
                this.onStartCallback(this.settings);
            }
        });

        return button;
    }

    private createLadButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = 'LaD';
        button.type = 'button';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.right = '140px';  // Position to the left of TEST LEVEL button
        button.style.padding = '10px 16px';
        button.style.borderRadius = '6px';
        button.style.border = '1px solid rgba(255, 255, 255, 0.6)';
        button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
        button.style.color = '#FFFFFF';
        button.style.fontFamily = 'Arial, sans-serif';
        button.style.fontWeight = '500';
        button.style.fontSize = '14px';
        button.style.letterSpacing = '0.08em';
        button.style.cursor = 'pointer';
        button.style.zIndex = '2';
        button.style.transition = 'background-color 0.2s ease, border-color 0.2s ease';

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(60, 60, 60, 0.85)';
            button.style.borderColor = '#FFD700';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });

        button.addEventListener('click', () => {
            const ladMap = this.availableMaps.find(map => map.id === 'lad');
            if (!ladMap) {
                return;
            }
            this.settings.selectedMap = ladMap;
            this.hide();
            if (this.onStartCallback) {
                this.ensureDefaultHeroSelection();
                this.onStartCallback(this.settings);
            }
        });

        return button;
    }

    private setTestLevelButtonVisible(isVisible: boolean): void {
        if (!this.testLevelButton) {
            return;
        }
        this.testLevelButton.style.display = isVisible ? 'block' : 'none';
    }

    private setLadButtonVisible(isVisible: boolean): void {
        if (!this.ladButton) {
            return;
        }
        this.ladButton.style.display = isVisible ? 'block' : 'none';
    }

    private getSelectedHeroNames(): string[] {
        return this.heroUnits
            .filter(hero => this.settings.selectedHeroes.includes(hero.id))
            .map(hero => hero.name);
    }

    private getDefaultHeroIdsForFaction(faction: Faction | null): string[] {
        if (!faction) {
            return [];
        }
        const defaultHero = this.heroUnits.find((hero) => hero.faction === faction);
        return defaultHero ? [defaultHero.id] : [];
    }

    private getFactionLabelAndColor(faction: Faction | null): { label: string; color: string } {
        switch (faction) {
            case Faction.RADIANT:
                return { label: 'Radiant', color: '#FF5722' }; // Deep yet bright reddish-orange (like glowing embers)
            case Faction.AURUM:
                return { label: 'Aurum', color: '#FFD700' }; // Bright gold
            case Faction.VELARIS:
                return { label: 'Velaris', color: '#9C27B0' }; // Purple
            default:
                return { label: 'Unselected', color: '#999999' };
        }
    }

    private ensureDefaultHeroSelection(): void {
        if (this.settings.selectedHeroes.length === 0) {
            const defaultHeroes = this.getDefaultHeroIdsForFaction(this.settings.selectedFaction);
            if (defaultHeroes.length > 0) {
                this.settings.selectedHeroes = [...defaultHeroes];
            }
        }
        this.settings.selectedHeroNames = this.getSelectedHeroNames();
    }

    /**
     * Generate a random username in the format "player#XXXX"
     */
    private async clearPlayerDataAndCache(): Promise<void> {
        localStorage.clear();
        sessionStorage.clear();

        if (typeof caches !== 'undefined') {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }

        const databaseGetter = indexedDB as IDBFactory & {
            databases?: () => Promise<Array<{ name?: string }>>;
        };
        if (databaseGetter.databases) {
            const databases = await databaseGetter.databases();
            await Promise.all(databases.map((database) => {
                const databaseName = database.name;
                if (!databaseName) {
                    return Promise.resolve();
                }
                return new Promise<void>((resolve) => {
                    const deleteRequest = indexedDB.deleteDatabase(databaseName);
                    deleteRequest.addEventListener('success', () => resolve());
                    deleteRequest.addEventListener('error', () => resolve());
                    deleteRequest.addEventListener('blocked', () => resolve());
                });
            }));
        }
    }

    private resolveAssetPath(path: string): string {
        if (!path.startsWith('ASSETS/')) {
            return path;
        }
        const isDistBuild = window.location.pathname.includes('/dist/');
        return isDistBuild ? `../${path}` : path;
    }

    private clearMenu(): void {
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.factionCarousel) {
            this.factionCarousel.destroy();
            this.factionCarousel = null;
        }
        if (this.contentElement) {
            this.contentElement.innerHTML = '';
            this.contentElement.style.justifyContent = 'center';
        }
        // Clear any pending timeouts
        this.lanLobbyManager.cleanup();
        this.setTestLevelButtonVisible(false);
        this.setLadButtonVisible(false);
        this.updateAtmosphereOpacityForCurrentScreen();
        this.updateSunRumbleAudioContext();
        this.updateMenuAudioState();
    }

    private updateMenuAudioState(): void {
        this.menuAudioController.setScreen(this.currentScreen, this.isMatchmakingSearching);
    }

    private updateSunRumbleAudioContext(): void {
        const sunCenterNormalized = this.atmosphereLayer?.getSunCenterNormalized() ?? { x: 0, y: 0 };
        const sunFocusLevel = this.currentScreen === 'main' ? 0.85 : 0.08;
        this.menuAudioController.setSunRumbleContext(
            sunFocusLevel,
            sunCenterNormalized.x,
            sunCenterNormalized.y
        );
    }

    private setMenuParticleDensity(multiplier: number): void {
        const densityScale = Math.SQRT2;
        this.menuParticleLayer?.setDensityMultiplier(multiplier * densityScale);
    }

    private startMenuTransition(): void {
        this.menuParticleLayer?.startTransition();
    }

    private updateAtmosphereOpacityForCurrentScreen(): void {
        const mainMenuSunOpacity = 1;
        const secondaryMenuSunOpacity = 0.35;
        const targetOpacity = this.currentScreen === 'main'
            ? mainMenuSunOpacity
            : secondaryMenuSunOpacity;
        this.atmosphereLayer?.setOpacity(targetOpacity);
    }

    private renderLanLobbyList(listContainer: HTMLElement): void {
        listContainer.innerHTML = '';
        const entries = this.lanLobbyManager.getFreshLobbies();

        if (entries.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.textContent = 'No LAN lobbies detected yet. Host a game to make it appear here.';
            emptyState.style.color = '#888888';
            emptyState.style.fontSize = '16px';
            emptyState.style.textAlign = 'center';
            emptyState.style.margin = '0';
            listContainer.appendChild(emptyState);
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

            const joinButton = this.createButton('JOIN', () => {
                void this.joinLanLobbyWithCode(entry.connectionCode);
            }, '#00AAFF');
            joinButton.style.padding = '8px 18px';
            joinButton.style.fontSize = '14px';
            joinButton.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            entryCard.addEventListener('click', () => {
                void this.joinLanLobbyWithCode(entry.connectionCode);
            });

            entryCard.appendChild(entryInfo);
            entryCard.appendChild(joinButton);
            listContainer.appendChild(entryCard);
        }
    }

    private scheduleLanLobbyListRefresh(listContainer: HTMLElement): void {
        this.lanLobbyManager.scheduleRefresh(() => {
            this.renderLanLobbyList(listContainer);
        });
    }

    private async joinLanLobbyWithCode(code: string): Promise<void> {
        if (!code) {
            return;
        }
        try {
            this.renderClientWaitingScreen();
            const { offer, playerId: hostId, username: hostUsername } = LANSignaling.parseHostCode(code);

            const playerId = `player_${Date.now()}`;
            this.networkManager = new NetworkManager(playerId);

            const answer = await this.networkManager.connectToPeer(hostId, offer);
            const answerCode = await LANSignaling.generateAnswerCode(answer, playerId, this.settings.username);

            this.renderClientAnswerScreen(answerCode, hostUsername);
        } catch (error) {
            console.error('Failed to join lobby:', error);
            alert(`Failed to join lobby: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.currentScreen = 'lan';
            this.startMenuTransition();
            this.renderLANScreen(this.contentElement);
        }
    }

    private renderMainScreen(container: HTMLElement): void {
        this.clearMenu();
        void this.renderMainScreenWhenReady(container);
    }

    private async renderMainScreenWhenReady(container: HTMLElement): Promise<void> {
        const renderToken = ++this.mainScreenRenderToken;
        // Menu images are now preloaded in index.html
        if (this.currentScreen !== 'main') {
            return;
        }
        if (renderToken !== this.mainScreenRenderToken) {
            return;
        }

        await this.menuAudioController.preloadTracks();
        if (this.currentScreen !== 'main' || renderToken !== this.mainScreenRenderToken) {
            return;
        }

        this.renderMainScreenContent(container);
    }

    private renderMainScreenContent(container: HTMLElement): void {
        this.setTestLevelButtonVisible(true);
        this.setLadButtonVisible(true);
        this.setMenuParticleDensity(1.6);
        this.updateAtmosphereOpacityForCurrentScreen();

        renderMainScreen(container, {
            selectedFaction: this.settings.selectedFaction,
            selectedMap: this.settings.selectedMap,
            resolveAssetPath: this.resolveAssetPath.bind(this),
            onLoadout: () => {
                this.currentScreen = 'loadout-select';
                this.startMenuTransition();
                this.renderLoadoutSelectionScreen(this.contentElement);
            },
            onStart: () => {
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            onMatchHistory: () => {
                this.currentScreen = 'match-history';
                this.startMenuTransition();
                this.renderMatchHistoryScreen(this.contentElement);
            },
            onMaps: () => {
                this.currentScreen = 'maps';
                this.startMenuTransition();
                this.renderMapSelectionScreen(this.contentElement);
            },
            onSettings: () => {
                this.currentScreen = 'settings';
                this.startMenuTransition();
                this.renderSettingsScreen(this.contentElement);
            },
            onCarouselCreated: (carousel) => {
                this.carouselMenu = carousel;
            },
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderMapSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        renderMapSelectionScreen(container, {
            availableMaps: this.availableMaps,
            selectedMap: this.settings.selectedMap,
            onMapSelect: (map) => {
                this.settings.selectedMap = map;
                this.renderMapSelectionScreen(this.contentElement);
            },
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderLANScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderLANScreen(container, {
            onHostServer: () => { this.showHostLobbyDialog(); },
            onJoinServer: () => { this.showJoinLobbyDialog(); },
            onBack: () => {
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            renderLanLobbyList: (el) => this.renderLanLobbyList(el),
            scheduleLanLobbyListRefresh: (el) => this.scheduleLanLobbyListRefresh(el),
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private async showHostLobbyDialog(): Promise<void> {
        // Initialize network manager
        const playerId = `player_${Date.now()}`;
        this.networkManager = new NetworkManager(playerId);

        // Create lobby
        const lobbyName = `${this.settings.username}'s lobby`;
        const lobby = this.networkManager.createLobby(lobbyName, this.settings.username, 2);

        try {
            // Generate connection offer
            const offer = await this.networkManager.createOfferForPeer('client');
            const connectionCode = await LANSignaling.generateHostCode(offer, playerId, this.settings.username);

            // Show lobby screen with connection code
            this.renderHostLobbyScreen(lobby, connectionCode, playerId);
        } catch (error) {
            console.error('Failed to create lobby:', error);
            alert('Failed to create lobby. Please try again.');
        }
    }

    private async showJoinLobbyDialog(): Promise<void> {
        // Prompt for connection code
        const code = prompt('Enter the connection code from the host:');
        if (!code) {
            return;
        }
        await this.joinLanLobbyWithCode(code.trim());
    }

    private renderHostLobbyScreen(lobby: LobbyInfo, connectionCode: string, hostPlayerId: string): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderHostLobbyScreen(this.contentElement, {
            lobby,
            connectionCode,
            hostPlayerId,
            username: this.settings.username,
            networkManager: this.networkManager,
            lanLobbyManager: this.lanLobbyManager,
            onGameStarted: () => {
                this.settings.gameMode = 'lan';
                this.settings.networkManager = this.networkManager!;
                if (this.onStartCallback) {
                    this.hide();
                    this.onStartCallback(this.settings);
                }
            },
            onCancel: () => {
                this.networkManager = null;
                this.currentScreen = 'lan';
                this.startMenuTransition();
                this.renderLANScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderClientAnswerScreen(answerCode: string, hostUsername: string): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderClientAnswerScreen(this.contentElement, {
            answerCode,
            hostUsername,
            networkManager: this.networkManager,
            onGameStarted: (nm) => {
                if (this.onStartCallback) {
                    this.settings.gameMode = 'lan';
                    this.settings.networkManager = nm;
                    this.hide();
                    this.onStartCallback(this.settings);
                }
            },
            onCancel: () => {
                this.networkManager = null;
                this.currentScreen = 'lan';
                this.startMenuTransition();
                this.renderLANScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderClientWaitingScreen(): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderClientWaitingScreen(this.contentElement, {
            networkManager: this.networkManager,
            onCancel: () => {
                this.networkManager = null;
                this.currentScreen = 'lan';
                this.startMenuTransition();
                this.renderLANScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderOnlinePlaceholderScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        renderOnlinePlaceholderScreen(container, {
            onlineMode: this.onlineMode,
            onModeChange: (mode) => {
                this.onlineMode = mode;
                this.renderOnlinePlaceholderScreen(this.contentElement);
            },
            onBack: () => {
                this.isMatchmakingSearching = false;
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderP2PScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderP2PMenuScreen(container, {
            onHost: () => {
                this.currentScreen = 'p2p-host';
                this.startMenuTransition();
                this.renderP2PHostScreen(this.contentElement);
            },
            onJoin: () => {
                this.currentScreen = 'p2p-join';
                this.startMenuTransition();
                this.renderP2PJoinScreen(this.contentElement);
            },
            onBack: () => {
                this.isMatchmakingSearching = false;
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderP2PHostScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderP2PHostScreen(container, {
            username: this.settings.username,
            onMatchStarted: () => {
                this.settings.multiplayerNetworkManager = this.multiplayerNetworkManager || undefined;
                this.hide();
                if (this.onStartCallback) {
                    this.ensureDefaultHeroSelection();
                    this.onStartCallback(this.settings);
                }
            },
            onCancel: () => {
                this.currentScreen = 'p2p';
                this.startMenuTransition();
                this.renderP2PScreen(this.contentElement);
            },
            setMultiplayerNetworkManager: (manager) => { this.multiplayerNetworkManager = manager; },
            getMultiplayerNetworkManager: () => this.multiplayerNetworkManager,
            setP2PMatchName: (name) => { this.p2pMatchName = name; },
            setP2PMaxPlayers: (max) => { this.p2pMaxPlayers = max; },
            setP2PMatchPlayers: (players) => { this.p2pMatchPlayers = players; },
            getP2PMatchPlayers: () => this.p2pMatchPlayers,
            updatePlayersList: (el) => this.updatePlayersList(el),
            fetchAndUpdatePlayers: (el) => this.fetchAndUpdatePlayers(el),
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderP2PJoinScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        renderP2PJoinScreen(container, {
            username: this.settings.username,
            onMatchStarted: () => {
                this.settings.multiplayerNetworkManager = this.multiplayerNetworkManager || undefined;
                this.hide();
                if (this.onStartCallback) {
                    this.ensureDefaultHeroSelection();
                    this.onStartCallback(this.settings);
                }
            },
            onLeave: () => {
                this.currentScreen = 'p2p';
                this.startMenuTransition();
                this.renderP2PScreen(this.contentElement);
            },
            setMultiplayerNetworkManager: (manager) => { this.multiplayerNetworkManager = manager; },
            getMultiplayerNetworkManager: () => this.multiplayerNetworkManager,
            fetchAndUpdatePlayers: (el) => this.fetchAndUpdatePlayers(el),
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private updatePlayersList(playersList: HTMLElement): void {
        playersList.innerHTML = '';
        
        for (const player of this.p2pMatchPlayers) {
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

            playersList.appendChild(playerItem);
        }
    }

    private async fetchAndUpdatePlayers(playersList: HTMLElement): Promise<void> {
        if (!this.multiplayerNetworkManager) return;
        
        const match = this.multiplayerNetworkManager.getCurrentMatch();
        if (!match) return;

        // Fetch players from Supabase
        const config = getSupabaseConfig();
        const supabase = createSupabaseClient(config.url, config.anonKey);
        
        const { data, error } = await supabase
            .from('match_players')
            .select('*')
            .eq('match_id', match.id);

        if (!error && data) {
            this.p2pMatchPlayers = data as MatchPlayer[];
            this.updatePlayersList(playersList);
        }
    }

    private async renderCustomLobbyScreen(container: HTMLElement): Promise<void> {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        // Fetch available lobbies
        let lobbies: any[] = [];
        if (this.onlineNetworkManager && this.onlineNetworkManager.isAvailable()) {
            lobbies = await this.onlineNetworkManager.listCustomLobbies();
        }
        
        renderCustomLobbyScreen(container, {
            lobbies: lobbies,
            onCreateLobby: async (lobbyName: string) => {
                console.log('Creating lobby:', lobbyName);
                
                if (!this.onlineNetworkManager || !this.onlineNetworkManager.isAvailable()) {
                    this.offerOfflineAILobby(lobbyName);
                    return;
                }
                
                const room = await this.onlineNetworkManager.createCustomLobby(lobbyName, this.settings.username);
                
                if (room) {
                    console.log('Lobby created successfully:', room);
                    const default2v2Map = this.availableMaps.find(map => map.id === '2v2-umbra');
                    if (default2v2Map) {
                        this.settings.selectedMap = default2v2Map;
                        await this.onlineNetworkManager.setLobbyMap(default2v2Map.id);
                    }
                    // Navigate to lobby detail screen
                    this.currentScreen = 'lobby-detail';
                    this.startMenuTransition();
                    await this.renderLobbyDetailScreen(this.contentElement);
                } else {
                    const networkError = this.onlineNetworkManager.getLastError();
                    if (networkError) {
                        alert(`Online lobby error: ${networkError}`);
                    }
                    this.offerOfflineAILobby(lobbyName);
                }
            },
            onJoinLobby: async (lobbyId: string) => {
                console.log('Joining lobby:', lobbyId);
                
                if (!this.onlineNetworkManager || !this.onlineNetworkManager.isAvailable()) {
                    alert('Online networking not available. Please check your Supabase configuration.');
                    return;
                }
                
                const success = await this.onlineNetworkManager.joinRoom(lobbyId, this.settings.username);
                
                if (success) {
                    console.log('Joined lobby successfully');
                    // Navigate to lobby detail screen
                    this.currentScreen = 'lobby-detail';
                    this.startMenuTransition();
                    await this.renderLobbyDetailScreen(this.contentElement);
                } else {
                    alert('Failed to join lobby. It may be full or no longer available.');
                }
            },
            onRefresh: async () => {
                await this.renderCustomLobbyScreen(this.contentElement);
            },
            onBack: () => {
                this.isMatchmakingSearching = false;
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private offerOfflineAILobby(lobbyName: string): void {
        const shouldCreateOfflineLobby = confirm(
            'Unable to reach the online lobby server. Would you like to create an offline 2v2 lobby with AI allies and enemies instead?'
        );

        if (!shouldCreateOfflineLobby) {
            return;
        }

        const playerFaction = this.settings.selectedFaction || Faction.RADIANT;
        const playerConfigs: Array<[string, Faction, number, 'player' | 'ai', 'easy' | 'normal' | 'hard', boolean]> = [
            [this.settings.username, playerFaction, 0, 'player', this.settings.difficulty, true],
            ['AI Ally', playerFaction, 0, 'ai', this.settings.difficulty, false],
            ['AI Enemy 1', Faction.AURUM, 1, 'ai', this.settings.difficulty, false],
            ['AI Enemy 2', Faction.VELARIS, 1, 'ai', this.settings.difficulty, false]
        ];

        this.settings.gameMode = 'custom-lobby';
        this.hide();

        const event = new CustomEvent('start4PlayerGame', {
            detail: {
                playerConfigs,
                settings: this.settings,
                roomId: `offline-${Date.now()}-${lobbyName || 'lobby'}`
            }
        });

        window.dispatchEvent(event);
    }

    private render2v2MatchmakingScreen(container: HTMLElement): void {
        this.isMatchmakingSearching = false;
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        // Get 2v2 MMR data
        const mmrData = getPlayerMMRData();
        
        renderMatchmaking2v2Screen(container, {
            currentMMR: mmrData.mmr2v2,
            wins: mmrData.wins2v2,
            losses: mmrData.losses2v2,
            isSearching: false,
            onStartMatchmaking: async () => {
                console.log('Starting 2v2 matchmaking...');
                
                if (!this.onlineNetworkManager || !this.onlineNetworkManager.isAvailable()) {
                    alert('Online networking not available. Please check your Supabase configuration.');
                    return;
                }
                
                const success = await this.onlineNetworkManager.joinMatchmakingQueue(
                    this.settings.username,
                    mmrData.mmr2v2,
                    this.settings.selectedFaction || 'RADIANT'
                );
                
                if (success) {
                    console.log('Joined matchmaking queue');
                    // Re-render with searching state
                    this.render2v2MatchmakingScreenSearching(this.contentElement);
                } else {
                    alert('Failed to join matchmaking queue. Please try again.');
                }
            },
            onCancelMatchmaking: async () => {
                console.log('Cancelling matchmaking...');
                
                if (!this.onlineNetworkManager) {
                    return;
                }
                
                await this.onlineNetworkManager.leaveMatchmakingQueue();
                
                // Re-render without searching state
                this.isMatchmakingSearching = false;
                this.render2v2MatchmakingScreen(this.contentElement);
            },
            onBack: () => {
                this.isMatchmakingSearching = false;
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private render2v2MatchmakingScreenSearching(container: HTMLElement): void {
        this.isMatchmakingSearching = true;
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        const mmrData = getPlayerMMRData();
        
        renderMatchmaking2v2Screen(container, {
            currentMMR: mmrData.mmr2v2,
            wins: mmrData.wins2v2,
            losses: mmrData.losses2v2,
            isSearching: true,
            onStartMatchmaking: async () => {},
            onCancelMatchmaking: async () => {
                console.log('Cancelling matchmaking...');
                
                // Clear polling interval
                if (this.matchmakingPollInterval !== null) {
                    window.clearInterval(this.matchmakingPollInterval);
                    this.matchmakingPollInterval = null;
                }
                
                if (!this.onlineNetworkManager) {
                    return;
                }
                
                await this.onlineNetworkManager.leaveMatchmakingQueue();
                
                // Re-render without searching state
                this.isMatchmakingSearching = false;
                this.render2v2MatchmakingScreen(this.contentElement);
            },
            onBack: () => {
                // Clear polling if active
                if (this.matchmakingPollInterval !== null) {
                    window.clearInterval(this.matchmakingPollInterval);
                    this.matchmakingPollInterval = null;
                }
                this.isMatchmakingSearching = false;
                this.currentScreen = 'game-mode-select';
                this.startMenuTransition();
                this.renderGameModeSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
        
        // Start polling for matchmaking results
        // TODO: Replace with Supabase real-time subscriptions for better UX
        console.log('Starting matchmaking search...');
        
        this.matchmakingPollInterval = window.setInterval(async () => {
            if (!this.onlineNetworkManager) {
                return;
            }
            
            // Check if still in queue
            const inQueue = await this.onlineNetworkManager.isInMatchmakingQueue();
            if (!inQueue) {
                // No longer in queue, stop polling
                if (this.matchmakingPollInterval !== null) {
                    window.clearInterval(this.matchmakingPollInterval);
                    this.matchmakingPollInterval = null;
                }
                return;
            }
            
            // Find potential matches
            const candidates = await this.onlineNetworkManager.findMatchmakingCandidates(mmrData.mmr2v2);
            
            if (candidates.length >= 3) {
                // Found enough players for 2v2 (need 3 others + us = 4 total)
                console.log('Match found! Candidates:', candidates);
                
                // Stop polling
                if (this.matchmakingPollInterval !== null) {
                    window.clearInterval(this.matchmakingPollInterval);
                    this.matchmakingPollInterval = null;
                }
                
                // Leave matchmaking queue
                await this.onlineNetworkManager.leaveMatchmakingQueue();
                
                // Create balanced teams based on MMR
                const allPlayers = [
                    { username: this.settings.username, mmr: mmrData.mmr2v2, faction: this.settings.selectedFaction || Faction.RADIANT, isLocal: true },
                    ...candidates.slice(0, 3).map(c => ({ username: c.username, mmr: c.mmr, faction: c.faction as Faction, isLocal: false }))
                ];
                
                // Sort by MMR and alternate teams for balance
                allPlayers.sort((a, b) => b.mmr - a.mmr);
                
                // Create player configs (highest MMR with lowest, etc.)
                // Ensure we have exactly 4 players
                if (allPlayers.length === 4) {
                    const playerConfigs: Array<[string, Faction, number, 'player' | 'ai', 'easy' | 'normal' | 'hard', boolean]> = [
                        [allPlayers[0].username, allPlayers[0].faction, 0, 'player', 'normal', allPlayers[0].isLocal],
                        [allPlayers[3].username, allPlayers[3].faction, 0, 'player', 'normal', allPlayers[3].isLocal],
                        [allPlayers[1].username, allPlayers[1].faction, 1, 'player', 'normal', allPlayers[1].isLocal],
                        [allPlayers[2].username, allPlayers[2].faction, 1, 'player', 'normal', allPlayers[2].isLocal]
                    ];
                    
                    // Update settings
                    this.settings.gameMode = '2v2-matchmaking';
                    
                    // Hide menu and start game
                    this.hide();
                    
                    // Dispatch event to start 4-player game
                    const event = new CustomEvent('start4PlayerGame', {
                        detail: {
                            playerConfigs: playerConfigs,
                            settings: this.settings,
                            roomId: null // No room for matchmaking
                        }
                    });
                    window.dispatchEvent(event);
                    
                    return;
                }
            }
        }, 5000); // Poll every 5 seconds
    }

    private async renderLobbyDetailScreen(container: HTMLElement): Promise<void> {
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.factionCarousel) {
            this.factionCarousel.destroy();
            this.factionCarousel = null;
        }
        container.innerHTML = '';
        this.setMenuParticleDensity(1.6);

        if (!this.onlineNetworkManager || !this.onlineNetworkManager.isAvailable()) {
            alert('Online networking not available.');
            this.currentScreen = 'custom-lobby';
            this.startMenuTransition();
            await this.renderCustomLobbyScreen(this.contentElement);
            return;
        }

        // Get current room and players
        const room = await this.onlineNetworkManager.refreshCurrentRoom() || this.onlineNetworkManager.getCurrentRoom();
        if (!room) {
            alert('Not in a lobby.');
            this.currentScreen = 'custom-lobby';
            this.startMenuTransition();
            await this.renderCustomLobbyScreen(this.contentElement);
            return;
        }

        const players = await this.onlineNetworkManager.getRoomPlayers();
        const isHost = this.onlineNetworkManager.isRoomHost();
        const localPlayerId = this.onlineNetworkManager.getLocalPlayerId();

        const lobbyMaps = this.availableMaps;
        const roomSelectedMapId = room.game_settings?.selectedMapId;
        const selectedLobbyMap = lobbyMaps.find(map => map.id === roomSelectedMapId) || this.settings.selectedMap || lobbyMaps[0];
        this.settings.selectedMap = selectedLobbyMap;

        renderLobbyDetailScreen(container, {
            roomId: room.id,
            roomName: room.name,
            isHost: isHost,
            players: players,
            localPlayerId: localPlayerId,
            onSetTeam: async (playerId: string, teamId: number) => {
                if (!this.onlineNetworkManager) return;
                const success = await this.onlineNetworkManager.setPlayerTeam(playerId, teamId);
                if (success) {
                    // Refresh the screen to show updated teams
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onAssignPlayerToTeam: async (playerId: string, teamId: number) => {
                if (!this.onlineNetworkManager) return;
                const slotUpdated = await this.onlineNetworkManager.setSlotType(playerId, 'player');
                if (!slotUpdated) {
                    return;
                }
                const teamUpdated = await this.onlineNetworkManager.setPlayerTeam(playerId, teamId);
                if (teamUpdated) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onSetSlotType: async (playerId: string, slotType: 'player' | 'ai' | 'spectator') => {
                if (!this.onlineNetworkManager) return;
                const success = await this.onlineNetworkManager.setSlotType(playerId, slotType);
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onSetAIDifficulty: async (playerId: string, difficulty: 'easy' | 'normal' | 'hard') => {
                if (!this.onlineNetworkManager) return;
                const success = await this.onlineNetworkManager.setAIDifficulty(playerId, difficulty);
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onSetFaction: async (faction: Faction) => {
                if (!this.onlineNetworkManager) return;
                this.settings.selectedFaction = faction;
                const success = await this.onlineNetworkManager.setPlayerFaction(faction);
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onSetColor: async (color: string) => {
                if (!this.onlineNetworkManager) return;
                this.settings.playerColor = color;
                const success = await this.onlineNetworkManager.setPlayerColor(color);
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onAddAI: async (teamId: number) => {
                if (!this.onlineNetworkManager) return;
                // Generate a unique AI player ID
                const aiPlayerId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                
                // Add AI slot to database
                try {
                    const success = await this.onlineNetworkManager.addAIPlayer(aiPlayerId, teamId);
                    if (success) {
                        await this.renderLobbyDetailScreen(this.contentElement);
                    } else {
                        const networkError = this.onlineNetworkManager.getLastError();
                        alert(networkError ? `Failed to add AI player: ${networkError}` : 'Failed to add AI player');
                    }
                } catch (error) {
                    console.error('Error adding AI:', error);
                    const networkError = this.onlineNetworkManager.getLastError();
                    alert(networkError ? `Failed to add AI player: ${networkError}` : 'Failed to add AI player');
                }
            },
            onRemoveSlot: async (playerId: string) => {
                if (!this.onlineNetworkManager) return;
                const success = await this.onlineNetworkManager.removePlayer(playerId);
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onToggleReady: async () => {
                if (!this.onlineNetworkManager) return;
                const success = await this.onlineNetworkManager.toggleReady();
                if (success) {
                    await this.renderLobbyDetailScreen(this.contentElement);
                }
            },
            onStartGame: async () => {
                if (!this.onlineNetworkManager || !isHost) return;
                
                // Get all players
                const allPlayers = await this.onlineNetworkManager.getRoomPlayers();
                
                // Validate we have enough players
                const activePlayers = allPlayers.filter(p => p.slot_type === 'player' || p.slot_type === 'ai');
                if (activePlayers.length < 2) {
                    alert('Need at least 2 players to start the game');
                    return;
                }
                
                // Verify all human players are ready
                const humanPlayers = allPlayers.filter(p => p.slot_type === 'player');
                const allReady = humanPlayers.every(p => p.is_ready);
                if (!allReady) {
                    alert('All players must be ready before starting');
                    return;
                }
                
                // Prepare game settings with 4 players (fill remaining with AI if needed)
                const playerConfigs: Array<[string, Faction, number, 'player' | 'ai', 'easy' | 'normal' | 'hard', boolean]> = [];
                
                // Sort players by team for proper positioning
                const team0Players = allPlayers.filter(p => p.team_id === 0 && (p.slot_type === 'player' || p.slot_type === 'ai'));
                const team1Players = allPlayers.filter(p => p.team_id === 1 && (p.slot_type === 'player' || p.slot_type === 'ai'));
                
                // Add team 0 players
                for (const player of team0Players.slice(0, 2)) {
                    const faction = (player.faction as Faction) || Faction.RADIANT;
                    const isLocal = player.player_id === localPlayerId;
                    playerConfigs.push([
                        player.username,
                        faction,
                        0,
                        player.slot_type as 'player' | 'ai',
                        player.ai_difficulty || 'normal',
                        isLocal
                    ]);
                }
                
                // Add team 1 players
                for (const player of team1Players.slice(0, 2)) {
                    const faction = (player.faction as Faction) || Faction.RADIANT;
                    const isLocal = player.player_id === localPlayerId;
                    playerConfigs.push([
                        player.username,
                        faction,
                        1,
                        player.slot_type as 'player' | 'ai',
                        player.ai_difficulty || 'normal',
                        isLocal
                    ]);
                }
                
                // Ensure we have 4 players (fill with AI if needed)
                while (playerConfigs.length < 4) {
                    const teamId = playerConfigs.length < 2 ? 0 : 1;
                    playerConfigs.push([
                        `AI Player ${playerConfigs.length + 1}`,
                        Faction.RADIANT,
                        teamId,
                        'ai',
                        'normal',
                        false
                    ]);
                }
                
                // Update game settings
                this.settings.gameMode = 'custom-lobby';
                
                // Hide menu and start game
                this.hide();
                
                // Dispatch event to start 4-player game
                const event = new CustomEvent('start4PlayerGame', {
                    detail: {
                        playerConfigs: playerConfigs,
                        settings: this.settings,
                        roomId: room.id
                    }
                });
                window.dispatchEvent(event);
            },
            availableMaps: lobbyMaps,
            selectedMapId: selectedLobbyMap.id,
            onSelectMap: async (mapId: string) => {
                if (!this.onlineNetworkManager || !isHost) return false;

                const mapToSelect = lobbyMaps.find((map) => map.id === mapId);
                if (!mapToSelect) {
                    return false;
                }

                const success = await this.onlineNetworkManager.setLobbyMap(mapToSelect.id);
                if (success) {
                    this.settings.selectedMap = mapToSelect;
                    return true;
                }

                const networkError = this.onlineNetworkManager.getLastError();
                if (networkError) {
                    alert(`Failed to change map: ${networkError}`);
                }

                return false;
            },
            selectedMapName: selectedLobbyMap.name,
            onLeave: async () => {
                if (!this.onlineNetworkManager) return;
                await this.onlineNetworkManager.leaveRoom();
                this.currentScreen = 'custom-lobby';
                this.startMenuTransition();
                await this.renderCustomLobbyScreen(this.contentElement);
            },
            onRefresh: async () => {
                await this.renderLobbyDetailScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderMatchHistoryScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        renderMatchHistoryScreen(container, {
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            onLaunchReplay: (match) => {
                this.launchReplayFromHistory(match);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private launchReplayFromHistory(match: MatchHistoryEntry): void {
        // Load replay from storage
        const replay = loadReplayFromStorage(match.replayKey);
        
        if (!replay) {
            alert('Replay file not found. It may have been deleted.');
            return;
        }

        // Hide menu and launch replay
        this.hide();
        
        // Dispatch custom event to trigger replay in main game controller
        const event = new CustomEvent('launchReplay', { 
            detail: { replay: replay } 
        });
        window.dispatchEvent(event);
    }

    private renderSettingsScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        renderSettingsScreen(container, {
            difficulty: this.settings.difficulty,
            username: this.settings.username,
            soundEnabled: this.settings.soundEnabled,
            musicEnabled: this.settings.musicEnabled,
            soundVolume: this.settings.soundVolume,
            musicVolume: this.settings.musicVolume,
            isBattleStatsInfoEnabled: this.settings.isBattleStatsInfoEnabled,
            screenShakeEnabled: this.settings.screenShakeEnabled,
            playerColor: this.settings.playerColor,
            enemyColor: this.settings.enemyColor,
            allyColor: this.settings.allyColor,
            enemy2Color: this.settings.enemy2Color,
            graphicsQuality: this.settings.graphicsQuality,
            colorScheme: this.settings.colorScheme,
            onDifficultyChange: (value) => {
                this.settings.difficulty = value;
            },
            onUsernameChange: (value) => {
                this.playerProfileManager.saveUsername(value);
                this.settings.username = value;
            },
            onSoundEnabledChange: (value) => {
                this.settings.soundEnabled = value;
            },
            onMusicEnabledChange: (value) => {
                this.settings.musicEnabled = value;
                this.menuAudioController.setMusicEnabled(value);
            },
            onSoundVolumeChange: (value) => {
                this.settings.soundVolume = value;
            },
            onMusicVolumeChange: (value) => {
                this.settings.musicVolume = value;
                this.menuAudioController.setMusicVolume(value / 100);
            },
            onBattleStatsInfoChange: (value) => {
                this.settings.isBattleStatsInfoEnabled = value;
            },
            onScreenShakeChange: (value) => {
                this.settings.screenShakeEnabled = value;
            },
            onPlayerColorChange: (value) => {
                this.settings.playerColor = value;
            },
            onEnemyColorChange: (value) => {
                this.settings.enemyColor = value;
            },
            onAllyColorChange: (value) => {
                this.settings.allyColor = value;
            },
            onEnemy2ColorChange: (value) => {
                this.settings.enemy2Color = value;
            },
            onGraphicsQualityChange: (value) => {
                this.settings.graphicsQuality = value;
                this.backgroundParticleLayer?.setGraphicsQuality(value);
                this.atmosphereLayer?.setGraphicsQuality(value);
                this.menuParticleLayer?.setGraphicsQuality(value);
            },
            onColorSchemeChange: (value) => {
                this.settings.colorScheme = value;
            },
            onClearDataAndCache: () => this.clearPlayerDataAndCache(),
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderGameModeSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        
        renderGameModeSelectionScreen(container, {
            onGameModeSelect: (mode, option) => {
                this.settings.gameMode = mode;
                
                switch (mode) {
                    case 'ai':
                        this.hide();
                        if (this.onStartCallback) {
                            this.ensureDefaultHeroSelection();
                            this.onStartCallback(this.settings);
                        }
                        break;
                    case 'online':
                        this.currentScreen = 'online';
                        this.startMenuTransition();
                        this.renderOnlinePlaceholderScreen(this.contentElement);
                        break;
                    case 'lan':
                        this.currentScreen = 'lan';
                        this.startMenuTransition();
                        this.renderLANScreen(this.contentElement);
                        break;
                    case 'p2p':
                        this.currentScreen = 'p2p';
                        this.startMenuTransition();
                        this.renderP2PScreen(this.contentElement);
                        break;
                    case 'custom-lobby':
                        this.currentScreen = 'custom-lobby';
                        this.startMenuTransition();
                        this.renderCustomLobbyScreen(this.contentElement);
                        break;
                    case '2v2-matchmaking':
                        this.currentScreen = '2v2-matchmaking';
                        this.startMenuTransition();
                        this.render2v2MatchmakingScreen(this.contentElement);
                        break;
                }
            },
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            createCarouselMenu: (container, options, initialIndex, onRender, onNavigate, onSelect) => {
                this.carouselMenu = new CarouselMenuView(container, options, initialIndex, 'rgba(0, 0, 0, 0.5)');
                this.carouselMenu.onRender(onRender);
                this.carouselMenu.onNavigate(() => {
                    this.startMenuTransition();
                    onNavigate();
                });
                this.carouselMenu.onSelect(onSelect);
            },
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderFactionSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        // Ensure default faction is selected
        if (!this.settings.selectedFaction) {
            this.settings.selectedFaction = Faction.RADIANT;
        }

        renderFactionSelectionScreen(container, {
            selectedFaction: this.settings.selectedFaction,
            onFactionChange: (faction: Faction) => {
                if (this.settings.selectedFaction !== faction) {
                    this.settings.selectedFaction = faction;
                    this.settings.selectedHeroes = [];
                    this.ensureDefaultHeroSelection();
                }
            },
            onContinue: () => {
                this.currentScreen = 'loadout-customization';
                this.startMenuTransition();
                this.renderLoadoutCustomizationScreen(this.contentElement);
            },
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer,
            onCarouselCreated: (carousel) => {
                this.factionCarousel = carousel;
            }
        });
    }

    private renderLoadoutCustomizationScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        // Set defaults if not selected
        const factionBaseLoadouts = this.baseLoadouts.filter(l => l.faction === this.settings.selectedFaction);
        const factionSpawnLoadouts = this.spawnLoadouts.filter(l => l.faction === this.settings.selectedFaction);
        
        if (!this.settings.selectedBaseLoadout && factionBaseLoadouts.length > 0) {
            this.settings.selectedBaseLoadout = factionBaseLoadouts[0].id;
        }
        if (!this.settings.selectedSpawnLoadout && factionSpawnLoadouts.length > 0) {
            this.settings.selectedSpawnLoadout = factionSpawnLoadouts[0].id;
        }

        renderLoadoutCustomizationScreen(container, {
            selectedFaction: this.settings.selectedFaction,
            baseLoadouts: this.baseLoadouts,
            spawnLoadouts: this.spawnLoadouts,
            selectedBaseLoadout: this.settings.selectedBaseLoadout,
            selectedSpawnLoadout: this.settings.selectedSpawnLoadout,
            selectedHeroNames: this.settings.selectedHeroNames,
            onFactionMissing: () => {
                this.currentScreen = 'faction-select';
                this.renderFactionSelectionScreen(container);
            },
            onBaseLoadoutSelect: (id: string) => {
                this.settings.selectedBaseLoadout = id;
                this.renderLoadoutCustomizationScreen(this.contentElement);
            },
            onSpawnLoadoutSelect: (id: string) => {
                this.settings.selectedSpawnLoadout = id;
                this.renderLoadoutCustomizationScreen(this.contentElement);
            },
            onSelectHeroes: () => {
                this.currentScreen = 'loadout-select';
                this.startMenuTransition();
                this.renderLoadoutSelectionScreen(this.contentElement);
            },
            onBack: () => {
                this.currentScreen = 'loadout-select';
                this.startMenuTransition();
                this.renderLoadoutSelectionScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer
        });
    }

    private renderLoadoutSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        // Ensure defaults
        if (!this.settings.selectedFaction) {
            this.settings.selectedFaction = Faction.RADIANT;
            this.settings.selectedHeroes = [];
            this.ensureDefaultHeroSelection();
        }

        this.settings.selectedHeroNames = this.getSelectedHeroNames();

        renderLoadoutSelectionScreen(container, {
            selectedFaction: this.settings.selectedFaction,
            selectedHeroes: this.settings.selectedHeroes,
            heroUnits: this.heroUnits,
            onFactionChange: (faction: Faction) => {
                if (this.settings.selectedFaction !== faction) {
                    this.settings.selectedFaction = faction;
                    this.settings.selectedHeroes = [];
                    this.ensureDefaultHeroSelection();
                    this.renderLoadoutSelectionScreen(this.contentElement);
                }
            },
            onHeroToggle: (heroId: string, isSelected: boolean) => {
                if (isSelected) {
                    this.settings.selectedHeroes = this.settings.selectedHeroes.filter(id => id !== heroId);
                } else if (this.settings.selectedHeroes.length < 4) {
                    this.settings.selectedHeroes.push(heroId);
                }
                this.settings.selectedHeroNames = this.getSelectedHeroNames();
                this.renderLoadoutSelectionScreen(this.contentElement);
            },
            onCustomizeLoadout: () => {
                this.currentScreen = 'loadout-customization';
                this.startMenuTransition();
                this.renderLoadoutCustomizationScreen(this.contentElement);
            },
            onConfirm: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            onBack: () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            },
            createButton: this.createButton.bind(this),
            menuParticleLayer: this.menuParticleLayer,
            onCarouselCreated: (carousel) => {
                this.factionCarousel = carousel;
            }
        });
    }

    private createButton(text: string, onClick: () => void, color: string = '#FFD700'): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.fontSize = '24px';
        button.style.padding = '15px 40px';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        button.style.color = color === '#666666' ? '#FFFFFF' : color;
        button.style.border = '2px solid transparent';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = '300';
        button.style.fontFamily = 'inherit';
        button.style.transition = 'all 0.3s';
        button.dataset.particleBox = 'true';
        button.dataset.particleColor = color;
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', onClick);
        
        return button;
    }

    private createTextInput(currentValue: string, onChange: (value: string) => void, placeholder: string = ''): HTMLElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.placeholder = placeholder;
        input.style.fontSize = '20px';
        input.style.padding = '8px 15px';
        input.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        input.style.color = '#FFFFFF';
        input.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        input.style.borderRadius = '5px';
        input.style.fontFamily = 'inherit';
        input.style.fontWeight = '300';
        input.style.minWidth = '200px';
        input.maxLength = 20;
        input.style.outline = 'none';

        // Update on blur instead of every keystroke for efficiency
        input.addEventListener('blur', () => {
            const validatedValue = this.playerProfileManager.validateUsername(input.value);
            input.value = validatedValue;
            input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            onChange(validatedValue);
        });

        input.addEventListener('focus', () => {
            input.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });

        return input;
    }

    /**
     * Set callback for when start button is clicked
     */
    onStart(callback: (settings: GameSettings) => void): void {
        this.onStartCallback = callback;
    }

    /**
     * Show the match loading screen
     */
    showMatchLoadingScreen(): void {
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
        gameModeContainer.style.fontWeight = '300';

        const gameModeText = document.createElement('div');
        let displayMode = this.settings.gameMode === 'ai' ? 'Vs. AI' : 
                          this.settings.gameMode === 'lan' ? 'LAN' : 
                          this.settings.gameMode === 'online' ? (this.onlineMode === 'ranked' ? 'Ranked' : 'Unranked') : 'Vs. AI';
        gameModeText.textContent = displayMode;
        gameModeContainer.appendChild(gameModeText);

        // For Ranked mode, show MMR and win/loss info (stub data)
        if (this.settings.gameMode === 'online' && this.onlineMode === 'ranked') {
            const mmrText = document.createElement('div');
            mmrText.textContent = 'MMR: 1000';
            mmrText.style.fontSize = '24px';
            mmrText.style.marginTop = '10px';
            mmrText.style.color = '#D0D0D0';
            gameModeContainer.appendChild(mmrText);

            const winText = document.createElement('div');
            winText.textContent = 'Win: +16';
            winText.style.fontSize = '20px';
            winText.style.marginTop = '8px';
            winText.style.color = '#00FF00';
            gameModeContainer.appendChild(winText);

            const lossText = document.createElement('div');
            lossText.textContent = 'Loss: -37';
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
        loadingAnimation.src = this.resolveAssetPath('ASSETS/sprites/loadingScreen/loadingAnimation/frame (1).png');
        loadingAnimation.style.width = '60px'; // 25% of 240px
        loadingAnimation.style.height = 'auto';
        loadingContainer.appendChild(loadingAnimation);

        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading...';
        loadingText.style.fontSize = '24px';
        loadingText.style.color = '#D0D0D0';
        loadingText.style.fontWeight = '300';
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
            loadingAnimation.src = this.resolveAssetPath(`ASSETS/sprites/loadingScreen/loadingAnimation/frame (${frameNumber}).png`);
            requestAnimationFrame(updateAnimation);
        };

        requestAnimationFrame(updateAnimation);

        // Remove loading screen after a short delay to allow game to initialize
        setTimeout(() => {
            loadingOverlay.remove();
        }, 1500);
    }

    /**
     * Hide the menu
     */
    hide(): void {
        this.menuElement.style.display = 'none';
        this.menuAudioController.setVisible(false);
        this.pauseMenuAnimations();
        
        // Show match loading screen
        this.showMatchLoadingScreen();
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'block';
        this.menuAudioController.setMusicVolume(this.settings.musicVolume / 100);
        this.menuAudioController.setVisible(true);
        this.currentScreen = 'main';
        this.isMatchmakingSearching = false;
        this.renderMainScreen(this.contentElement);
        this.resumeMenuAnimations();
    }

    /**
     * Remove the menu from DOM
     */
    destroy(): void {
        this.menuAudioController.destroy();

        // Cleanup network managers
        if (this.settings.networkManager) {
            this.settings.networkManager.disconnect();
            this.settings.networkManager = undefined;
        }
        if (this.multiplayerNetworkManager) {
            void this.multiplayerNetworkManager.disconnect();
            this.multiplayerNetworkManager = null;
        }
        
        if (this.carouselMenu) {
            this.carouselMenu.destroy();
            this.carouselMenu = null;
        }
        if (this.factionCarousel) {
            this.factionCarousel.destroy();
            this.factionCarousel = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }
        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler);
            this.focusHandler = null;
        }
        this.backgroundParticleLayer?.destroy();
        this.atmosphereLayer?.destroy();
        this.menuParticleLayer?.stop();
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
