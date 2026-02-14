/**
 * Main Menu for SoL game
 */

import * as Constants from './constants';
import { Faction } from './game-core';
import { NetworkManager, LANSignaling, LobbyInfo, MessageType, NetworkEvent } from './network';
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
import { renderMapSelectionScreen } from './menu/screens/map-selection-screen';
import { renderSettingsScreen } from './menu/screens/settings-screen';
import { renderGameModeSelectionScreen } from './menu/screens/game-mode-selection-screen';
import { renderMatchHistoryScreen } from './menu/screens/match-history-screen';
import { renderOnlinePlaceholderScreen } from './menu/screens/online-placeholder-screen';
import { renderFactionSelectionScreen } from './menu/screens/faction-selection-screen';
import { renderLoadoutCustomizationScreen } from './menu/screens/loadout-customization-screen';
import { renderLoadoutSelectionScreen } from './menu/screens/loadout-selection-screen';
import { renderP2PMenuScreen } from './menu/screens/p2p-menu-screen';
import { renderCustomLobbyScreen } from './menu/screens/custom-lobby-screen';
import { renderMatchmaking2v2Screen } from './menu/screens/matchmaking-2v2-screen';
import { renderLobbyDetailScreen } from './menu/screens/lobby-detail-screen';
import { MenuAudioController } from './menu/menu-audio';
import { BUILD_NUMBER } from './build-info';
import { MultiplayerNetworkManager, NetworkEvent as P2PNetworkEvent, Match, MatchPlayer } from './multiplayer-network';
import { OnlineNetworkManager } from './online-network';
import { getSupabaseConfig } from './supabase-config';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { 
    getMatchHistory, 
    MatchHistoryEntry, 
    loadReplayFromStorage, 
    ReplayData,
    getPlayerMMRData
} from './replay';

// Re-export types for backward compatibility
export { MenuOption, MapConfig, HeroUnit, BaseLoadout, SpawnLoadout, ColorScheme, COLOR_SCHEMES };

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

interface LanLobbyEntry {
    hostPlayerId: string;
    lobbyName: string;
    hostUsername: string;
    connectionCode: string;
    maxPlayerCount: number;
    playerCount: number;
    lastSeenMs: number;
    createdMs: number;
}

const LAN_LOBBY_STORAGE_KEY = 'sol-lan-lobbies';
const LAN_LOBBY_EXPIRY_MS = 15000;
const LAN_LOBBY_REFRESH_MS = 2000;
const LAN_LOBBY_HEARTBEAT_MS = 5000;

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
    private lanServerListTimeout: number | null = null; // Track timeout for cleanup
    private lanLobbyHeartbeatTimeout: number | null = null; // Track heartbeat for LAN lobbies
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
    private menuAudioController: MenuAudioController;
    private isMatchmakingSearching = false;
    
    // Hero unit data with complete stats
    private heroUnits: HeroUnit[] = [
        // Radiant faction heroes
        { 
            id: 'radiant-marine', name: 'Marine', description: 'Rapid-fire ranged specialist', faction: Faction.RADIANT,
            maxHealth: Constants.MARINE_MAX_HEALTH, attackDamage: Constants.MARINE_ATTACK_DAMAGE, attackSpeed: Constants.MARINE_ATTACK_SPEED,
            attackRange: Constants.MARINE_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 4,
            abilityDescription: 'Bullet storm: fires a spread of shots toward a target direction'
        },
        { 
            id: 'velaris-grave', name: 'Grave', description: 'Gravitic sentinel with orbiting projectiles', faction: Faction.VELARIS,
            maxHealth: Constants.GRAVE_MAX_HEALTH, attackDamage: Constants.GRAVE_ATTACK_DAMAGE, attackSpeed: Constants.GRAVE_ATTACK_SPEED,
            attackRange: Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER,
            attackIgnoresDefense: false, defense: 18, regen: 3,
            abilityDescription: 'Black Hole: launches a vortex that attracts all small particles for 5 seconds'
        },
        {
            id: 'velaris-nova', name: 'Nova', description: 'Remote bomb specialist with bouncing projectile', faction: Faction.VELARIS,
            maxHealth: Constants.NOVA_MAX_HEALTH, attackDamage: Constants.NOVA_ATTACK_DAMAGE, attackSpeed: Constants.NOVA_ATTACK_SPEED,
            attackRange: Constants.NOVA_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 5,
            abilityDescription: 'Remote bomb: throws a bouncing bomb that explodes in a directional scatter when triggered'
        },
        {
            id: 'velaris-sly', name: 'Sly', description: 'Sticky laser bomb specialist', faction: Faction.VELARIS,
            maxHealth: Constants.SLY_MAX_HEALTH, attackDamage: Constants.SLY_ATTACK_DAMAGE, attackSpeed: Constants.SLY_ATTACK_SPEED,
            attackRange: Constants.SLY_ATTACK_RANGE, attackIgnoresDefense: false, defense: 8, regen: 4,
            abilityDescription: 'Sticky bomb: throws a bomb that sticks to surfaces and fires 3 lasers (1 wide center, 2 diagonal)'
        },
        {
            id: 'radiant-ray', name: 'Ray', description: 'Bouncing beam marks targets', faction: Faction.RADIANT,
            maxHealth: Constants.RAY_MAX_HEALTH, attackDamage: Constants.RAY_ATTACK_DAMAGE, attackSpeed: Constants.RAY_ATTACK_SPEED,
            attackRange: Constants.RAY_ATTACK_RANGE, attackIgnoresDefense: true, defense: 8, regen: 5,
            abilityDescription: 'Solar ricochet: beam bounces between multiple enemies'
        },
        {
            id: 'velaris-diplomat', name: 'Diplomat', description: 'Deploys temporary influence zones', faction: Faction.VELARIS,
            maxHealth: Constants.INFLUENCE_BALL_MAX_HEALTH, attackDamage: Constants.INFLUENCE_BALL_ATTACK_DAMAGE, attackSpeed: Constants.INFLUENCE_BALL_ATTACK_SPEED,
            attackRange: Constants.INFLUENCE_BALL_ATTACK_RANGE, attackIgnoresDefense: false, defense: 12, regen: 6,
            abilityDescription: 'Influence surge: expand an influence zone at target location'
        },
        {
            id: 'radiant-turret-deployer', name: 'Turret Deployer', description: 'Deploys automated turrets on asteroids', faction: Faction.RADIANT,
            maxHealth: Constants.TURRET_DEPLOYER_MAX_HEALTH, attackDamage: Constants.TURRET_DEPLOYER_ATTACK_DAMAGE, attackSpeed: Constants.TURRET_DEPLOYER_ATTACK_SPEED,
            attackRange: Constants.TURRET_DEPLOYER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 4,
            abilityDescription: 'Deploy turret: places a turret on a nearby asteroid'
        },
        {
            id: 'aurum-driller', name: 'Driller', description: 'Burrows through asteroids to flank', faction: Faction.AURUM,
            maxHealth: Constants.DRILLER_MAX_HEALTH, attackDamage: Constants.DRILLER_ATTACK_DAMAGE, attackSpeed: Constants.DRILLER_ATTACK_SPEED,
            attackRange: Constants.DRILLER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 16, regen: 3,
            abilityDescription: 'Drill charge: tunnels through an asteroid toward the target'
        },
        {
            id: 'velaris-dagger', name: 'Dagger', description: 'Cloaked assassin with burst damage', faction: Faction.VELARIS,
            maxHealth: Constants.DAGGER_MAX_HEALTH, attackDamage: Constants.DAGGER_ATTACK_DAMAGE, attackSpeed: Constants.DAGGER_ATTACK_SPEED,
            attackRange: Constants.DAGGER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 5, regen: 3,
            abilityDescription: 'Shadow strike: short-range burst attack, reveals Dagger for 8 seconds'
        },
        {
            id: 'radiant-beam', name: 'Beam', description: 'Sniper with distance-based damage multiplier', faction: Faction.RADIANT,
            maxHealth: Constants.BEAM_MAX_HEALTH, attackDamage: Constants.BEAM_ATTACK_DAMAGE, attackSpeed: Constants.BEAM_ATTACK_SPEED,
            attackRange: Constants.BEAM_ATTACK_RANGE, attackIgnoresDefense: true, defense: 6, regen: 3,
            abilityDescription: 'Precision shot: long-range beam that does more damage at greater distances'
        },
        {
            id: 'radiant-spotlight', name: 'Spotlight', description: 'Reveals enemies in a razor-thin cone', faction: Faction.RADIANT,
            maxHealth: Constants.SPOTLIGHT_MAX_HEALTH, attackDamage: Constants.SPOTLIGHT_ATTACK_DAMAGE, attackSpeed: 0,
            attackRange: Constants.SPOTLIGHT_ATTACK_RANGE, attackIgnoresDefense: false, defense: 8, regen: 4,
            abilityDescription: 'Spotlight sweep: 5° cone reveals and rapidly fires at enemies (1s setup, 5s teardown)'
        },
        {
            id: 'radiant-mortar', name: 'Mortar', description: 'Siege unit with splash damage', faction: Faction.RADIANT,
            maxHealth: Constants.MORTAR_MAX_HEALTH, attackDamage: Constants.MORTAR_ATTACK_DAMAGE, attackSpeed: Constants.MORTAR_ATTACK_SPEED,
            attackRange: Constants.MORTAR_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 2,
            abilityDescription: 'Siege mode: temporarily becomes immobile but gains increased range and damage'
        },
        {
            id: 'aurum-preist', name: 'Preist', description: 'Support healer with dual beams', faction: Faction.AURUM,
            maxHealth: Constants.PREIST_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
            attackRange: Constants.PREIST_HEALING_RANGE, attackIgnoresDefense: false, defense: 18, regen: 4,
            abilityDescription: 'Healing bomb: launches a projectile that explodes into healing particles'
        },
        {
            id: 'aurum-tank', name: 'Tank', description: 'Extremely tough defensive unit with projectile shield', faction: Faction.AURUM,
            maxHealth: Constants.TANK_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
            attackRange: 0, attackIgnoresDefense: false, defense: Constants.TANK_DEFENSE, regen: 3,
            abilityDescription: 'Crescent wave: sends a slow 90-degree wave that stuns all units and erases projectiles'
        }
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
            id: 'test-level',
            name: 'Test Level',
            description: 'Minimal layout for AI testing with a single sun, mirrored bases, and no asteroids.',
            numSuns: 1,
            numAsteroids: 0,
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
        },
        {
            id: '2v2-umbra',
            name: '2v2 Umbra Basin',
            description: 'Dedicated 2v2 arena with one sun. Fixed giant asteroids cast consistent spawn shadows for all four players.',
            numSuns: 1,
            numAsteroids: 4,
            mapSize: 2400
        },
        {
            id: '2v2-dual-umbra',
            name: '2v2 Dual Umbra',
            description: 'Dedicated 2v2 arena with two suns. Symmetric asteroid cover creates consistent shadowed spawn lanes.',
            numSuns: 2,
            numAsteroids: 6,
            mapSize: 2600
        },
        {
            id: 'lad',
            name: 'LaD',
            description: 'Light and Dark - A split battlefield with a dual sun. White light on one side, black "light" on the other. Units are invisible until they cross into enemy territory.',
            numSuns: 1,
            numAsteroids: 8,
            mapSize: 2000
        }
    ];

    private baseLoadouts: BaseLoadout[] = [
        // Radiant faction bases
        { id: 'radiant-standard', name: 'Standard Forge', description: 'Balanced base with standard production', faction: Faction.RADIANT },
        // Aurum faction bases
        { id: 'aurum-standard', name: 'Standard Vault', description: 'Balanced base with standard production', faction: Faction.AURUM },
        // Velaris faction bases
        { id: 'velaris-standard', name: 'Standard Temple', description: 'Balanced base with standard production', faction: Faction.VELARIS },
    ];

    private spawnLoadouts: SpawnLoadout[] = [
        // Radiant faction spawns
        { id: 'radiant-standard', name: 'Standard Starlings', description: 'Balanced minions with standard stats', faction: Faction.RADIANT },
        // Aurum faction spawns
        { id: 'aurum-standard', name: 'Standard Drones', description: 'Balanced minions with standard stats', faction: Faction.AURUM },
        // Velaris faction spawns
        { id: 'velaris-standard', name: 'Standard Zealots', description: 'Balanced minions with standard stats', faction: Faction.VELARIS },
    ];

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
            username: this.getOrGenerateUsername(), // Load or generate username
            gameMode: 'ai' // Default to AI mode
        };
        this.ensureDefaultHeroSelection();
        this.menuAudioController = new MenuAudioController(this.resolveAssetPath.bind(this));
        
        // Initialize online network manager for custom lobbies and matchmaking
        const playerId = this.getOrGeneratePlayerId();
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
            if (document.hidden) {
                this.menuAudioController.setVisible(false);
                this.pauseMenuAnimations();
                return;
            }
            this.menuAudioController.setVisible(true);
            this.resumeMenuAnimations();
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
        
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
    private generateRandomUsername(): string {
        const randomNumber = Math.floor(Math.random() * 10000);
        return `player#${randomNumber.toString().padStart(4, '0')}`;
    }

    /**
     * Get username from localStorage or generate a new one
     */
    private getOrGenerateUsername(): string {
        const storedUsername = localStorage.getItem('sol_username');
        if (storedUsername && storedUsername.trim() !== '') {
            return storedUsername;
        }
        const newUsername = this.generateRandomUsername();
        localStorage.setItem('sol_username', newUsername);
        return newUsername;
    }

    /**
     * Get or generate a unique player ID for online play
     */
    private getOrGeneratePlayerId(): string {
        const storedPlayerId = localStorage.getItem('sol_player_id');
        if (storedPlayerId && storedPlayerId.trim() !== '') {
            return storedPlayerId;
        }
        // Generate a UUID using crypto API if available, otherwise fallback
        let newPlayerId: string;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            newPlayerId = crypto.randomUUID();
        } else {
            // Fallback for older browsers
            newPlayerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem('sol_player_id', newPlayerId);
        return newPlayerId;
    }

    /**
     * Save username to localStorage
     */
    private saveUsername(username: string): void {
        localStorage.setItem('sol_username', username);
        this.settings.username = username;
    }

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
        if (this.lanServerListTimeout !== null) {
            clearTimeout(this.lanServerListTimeout);
            this.lanServerListTimeout = null;
        }
        if (this.lanLobbyHeartbeatTimeout !== null) {
            clearTimeout(this.lanLobbyHeartbeatTimeout);
            this.lanLobbyHeartbeatTimeout = null;
        }
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

    private loadLanLobbyEntries(): LanLobbyEntry[] {
        const storedValue = localStorage.getItem(LAN_LOBBY_STORAGE_KEY);
        if (!storedValue) {
            return [];
        }
        try {
            const parsedValue = JSON.parse(storedValue) as LanLobbyEntry[];
            if (!Array.isArray(parsedValue)) {
                return [];
            }
            return parsedValue;
        } catch (error) {
            console.warn('Failed to parse LAN lobby list from storage:', error);
            return [];
        }
    }

    private persistLanLobbyEntries(entries: LanLobbyEntry[]): void {
        localStorage.setItem(LAN_LOBBY_STORAGE_KEY, JSON.stringify(entries));
    }

    private pruneLanLobbyEntries(entries: LanLobbyEntry[], nowMs: number): LanLobbyEntry[] {
        const prunedEntries = entries.filter((entry) => nowMs - entry.lastSeenMs <= LAN_LOBBY_EXPIRY_MS);
        if (prunedEntries.length !== entries.length) {
            this.persistLanLobbyEntries(prunedEntries);
        }
        return prunedEntries;
    }

    private registerLanLobbyEntry(entry: Omit<LanLobbyEntry, 'lastSeenMs' | 'createdMs'>): void {
        const nowMs = Date.now();
        const entries = this.loadLanLobbyEntries();
        const updatedEntries = entries.filter((existingEntry) => existingEntry.hostPlayerId !== entry.hostPlayerId);
        const existingEntry = entries.find((existingEntry) => existingEntry.hostPlayerId === entry.hostPlayerId);
        updatedEntries.push({
            ...entry,
            createdMs: existingEntry?.createdMs ?? nowMs,
            lastSeenMs: nowMs
        });
        this.persistLanLobbyEntries(updatedEntries);
    }

    private unregisterLanLobbyEntry(hostPlayerId: string): void {
        const entries = this.loadLanLobbyEntries();
        const updatedEntries = entries.filter((entry) => entry.hostPlayerId !== hostPlayerId);
        if (updatedEntries.length !== entries.length) {
            this.persistLanLobbyEntries(updatedEntries);
        }
    }

    private startLanLobbyHeartbeat(entry: Omit<LanLobbyEntry, 'lastSeenMs' | 'createdMs'>): void {
        if (this.lanLobbyHeartbeatTimeout !== null) {
            clearTimeout(this.lanLobbyHeartbeatTimeout);
            this.lanLobbyHeartbeatTimeout = null;
        }
        const heartbeat = () => {
            this.registerLanLobbyEntry(entry);
            this.lanLobbyHeartbeatTimeout = window.setTimeout(heartbeat, LAN_LOBBY_HEARTBEAT_MS);
        };
        heartbeat();
    }

    private stopLanLobbyHeartbeat(): void {
        if (this.lanLobbyHeartbeatTimeout !== null) {
            clearTimeout(this.lanLobbyHeartbeatTimeout);
            this.lanLobbyHeartbeatTimeout = null;
        }
    }

    private renderLanLobbyList(listContainer: HTMLElement): void {
        listContainer.innerHTML = '';
        const nowMs = Date.now();
        const entries = this.pruneLanLobbyEntries(this.loadLanLobbyEntries(), nowMs)
            .sort((left, right) => right.lastSeenMs - left.lastSeenMs);

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
        if (this.lanServerListTimeout !== null) {
            clearTimeout(this.lanServerListTimeout);
        }
        this.lanServerListTimeout = window.setTimeout(() => {
            this.renderLanLobbyList(listContainer);
            this.scheduleLanLobbyListRefresh(listContainer);
        }, LAN_LOBBY_REFRESH_MS);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;
        container.style.justifyContent = 'flex-start';
        
        // Title graphic - raised a little
        const titleGraphic = document.createElement('img');
        titleGraphic.src = this.resolveAssetPath('ASSETS/SPRITES/menu/titleGraphic.png');
        titleGraphic.alt = 'Speed of Light RTS';
        titleGraphic.style.width = isCompactLayout ? '300px' : '480px';
        titleGraphic.style.maxWidth = '90%';
        titleGraphic.style.height = 'auto';
        titleGraphic.style.marginBottom = isCompactLayout ? '6px' : '12px';
        titleGraphic.style.alignSelf = 'center';
        container.appendChild(titleGraphic);

        // Create carousel menu container
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
        carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
        carouselContainer.style.marginTop = '0';
        carouselContainer.style.marginBottom = isCompactLayout ? '18px' : '20px';
        container.appendChild(carouselContainer);

        // Create carousel menu with main menu options
        const { label: factionLabel, color: factionColor } = this.getFactionLabelAndColor(this.settings.selectedFaction);
        const menuOptions: MenuOption[] = [
            {
                id: 'loadout',
                name: 'LOADOUT',
                description: 'Select faction & heroes',
                subLabel: factionLabel,
                subLabelColor: factionColor
            },
            {
                id: 'start',
                name: 'START',
                description: 'Begin game'
            },
            {
                id: 'match-history',
                name: 'MATCH HISTORY',
                description: 'View past matches'
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

        this.carouselMenu = new CarouselMenuView(
            carouselContainer,
            menuOptions,
            1,
            'rgba(0, 0, 0, 0.5)'
        ); // Default to "START" button
        this.carouselMenu.onRender(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onNavigate(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onSelect((option: MenuOption) => {
            switch (option.id) {
                case 'loadout':
                    this.currentScreen = 'loadout-select';
                    this.startMenuTransition();
                    this.renderLoadoutSelectionScreen(this.contentElement);
                    break;
                case 'start':
                    this.currentScreen = 'game-mode-select';
                    this.startMenuTransition();
                    this.renderGameModeSelectionScreen(this.contentElement);
                    break;
                case 'match-history':
                    this.currentScreen = 'match-history';
                    this.startMenuTransition();
                    this.renderMatchHistoryScreen(this.contentElement);
                    break;
                case 'maps':
                    this.currentScreen = 'maps';
                    this.startMenuTransition();
                    this.renderMapSelectionScreen(this.contentElement);
                    break;
                case 'settings':
                    this.currentScreen = 'settings';
                    this.startMenuTransition();
                    this.renderSettingsScreen(this.contentElement);
                    break;
            }
        });

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'LAN Play';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Host server button
        const hostButton = this.createButton('HOST SERVER', () => {
            this.showHostLobbyDialog();
        }, '#00AA00');
        hostButton.style.marginBottom = '20px';
        hostButton.style.padding = '15px 40px';
        hostButton.style.fontSize = '28px';
        container.appendChild(hostButton);

        // Join server button
        const joinButton = this.createButton('JOIN SERVER', () => {
            this.showJoinLobbyDialog();
        }, '#0088FF');
        joinButton.style.marginBottom = '40px';
        joinButton.style.padding = '15px 40px';
        joinButton.style.fontSize = '28px';
        container.appendChild(joinButton);

        // LAN lobby list
        const listContainer = document.createElement('div');
        listContainer.style.maxWidth = '720px';
        listContainer.style.width = '100%';
        listContainer.style.padding = '20px';
        listContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        listContainer.style.borderRadius = '12px';
        listContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
        listContainer.style.marginBottom = '30px';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '14px';

        const listTitle = document.createElement('h3');
        listTitle.textContent = 'Available LAN Lobbies';
        listTitle.style.fontSize = '22px';
        listTitle.style.margin = '0';
        listTitle.style.color = '#FFD700';
        listTitle.style.textAlign = 'center';
        listContainer.appendChild(listTitle);

        const listContent = document.createElement('div');
        listContent.style.display = 'flex';
        listContent.style.flexDirection = 'column';
        listContent.style.gap = '12px';
        listContainer.appendChild(listContent);

        this.renderLanLobbyList(listContent);
        this.scheduleLanLobbyListRefresh(listContent);

        container.appendChild(listContainer);

        // Info section
        const infoContainer = document.createElement('div');
        infoContainer.style.maxWidth = '600px';
        infoContainer.style.width = '100%';
        infoContainer.style.padding = '20px';
        infoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        infoContainer.style.borderRadius = '10px';
        infoContainer.style.border = '2px solid rgba(255, 255, 255, 0.2)';
        infoContainer.style.marginBottom = '30px';

        const infoTitle = document.createElement('h3');
        infoTitle.textContent = 'How LAN Play Works';
        infoTitle.style.fontSize = '24px';
        infoTitle.style.marginBottom = '15px';
        infoTitle.style.color = '#FFD700';
        infoTitle.style.textAlign = 'center';
        infoContainer.appendChild(infoTitle);

        const infoText = document.createElement('p');
        infoText.innerHTML = `
            <strong>For Host:</strong><br>
            1. Click "HOST SERVER" to create a lobby<br>
            2. Share the connection code with other players<br>
            3. Wait for players to join<br>
            4. Start the game when ready<br><br>
            <strong>For Client:</strong><br>
            1. Click "JOIN SERVER"<br>
            2. Enter the connection code from the host<br>
            3. Wait in lobby for host to start the game
        `;
        infoText.style.color = '#CCCCCC';
        infoText.style.fontSize = '16px';
        infoText.style.lineHeight = '1.6';
        infoContainer.appendChild(infoText);

        container.appendChild(infoContainer);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'game-mode-select';
            this.startMenuTransition();
            this.renderGameModeSelectionScreen(this.contentElement);
        }, '#666666');
        container.appendChild(backButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;
        this.startLanLobbyHeartbeat({
            hostPlayerId: hostPlayerId,
            lobbyName: lobby.name,
            hostUsername: lobby.players.find((player) => player.isHost)?.username ?? this.settings.username,
            connectionCode: connectionCode,
            maxPlayerCount: lobby.maxPlayers,
            playerCount: lobby.players.length
        });

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Lobby: ' + lobby.name;
        title.style.fontSize = isCompactLayout ? '28px' : '36px';
        title.style.marginBottom = '20px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        this.contentElement.appendChild(title);

        // Connection code display
        const codeContainer = document.createElement('div');
        codeContainer.style.maxWidth = '600px';
        codeContainer.style.width = '100%';
        codeContainer.style.padding = '20px';
        codeContainer.style.backgroundColor = 'rgba(0, 100, 0, 0.3)';
        codeContainer.style.borderRadius = '10px';
        codeContainer.style.border = '2px solid rgba(0, 255, 0, 0.3)';
        codeContainer.style.marginBottom = '20px';

        const codeLabel = document.createElement('p');
        codeLabel.textContent = 'Share this connection code:';
        codeLabel.style.color = '#CCCCCC';
        codeLabel.style.fontSize = '18px';
        codeLabel.style.marginBottom = '10px';
        codeContainer.appendChild(codeLabel);

        const codeText = document.createElement('textarea');
        codeText.value = connectionCode;
        codeText.readOnly = true;
        codeText.style.width = '100%';
        codeText.style.height = '80px';
        codeText.style.padding = '10px';
        codeText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        codeText.style.color = '#00FF00';
        codeText.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        codeText.style.borderRadius = '5px';
        codeText.style.fontSize = '14px';
        codeText.style.fontFamily = 'monospace';
        codeText.style.resize = 'none';
        codeContainer.appendChild(codeText);

        const copyButton = this.createButton('COPY CODE', async () => {
            try {
                await navigator.clipboard.writeText(codeText.value);
                alert('Connection code copied to clipboard!');
            } catch (err) {
                // Fallback for older browsers
                codeText.select();
                document.execCommand('copy');
                alert('Connection code copied to clipboard!');
            }
        }, '#008800');
        copyButton.style.marginTop = '10px';
        copyButton.style.padding = '10px 20px';
        copyButton.style.fontSize = '16px';
        codeContainer.appendChild(copyButton);

        this.contentElement.appendChild(codeContainer);

        // Waiting for answer code input
        const answerContainer = document.createElement('div');
        answerContainer.style.maxWidth = '600px';
        answerContainer.style.width = '100%';
        answerContainer.style.padding = '20px';
        answerContainer.style.backgroundColor = 'rgba(0, 0, 100, 0.3)';
        answerContainer.style.borderRadius = '10px';
        answerContainer.style.border = '2px solid rgba(0, 100, 255, 0.3)';
        answerContainer.style.marginBottom = '30px';

        const answerLabel = document.createElement('p');
        answerLabel.textContent = 'Paste the answer code from the client:';
        answerLabel.style.color = '#CCCCCC';
        answerLabel.style.fontSize = '18px';
        answerLabel.style.marginBottom = '10px';
        answerContainer.appendChild(answerLabel);

        const answerInput = document.createElement('textarea');
        answerInput.placeholder = 'Paste answer code here...';
        answerInput.style.width = '100%';
        answerInput.style.height = '80px';
        answerInput.style.padding = '10px';
        answerInput.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        answerInput.style.color = '#FFFFFF';
        answerInput.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        answerInput.style.borderRadius = '5px';
        answerInput.style.fontSize = '14px';
        answerInput.style.fontFamily = 'monospace';
        answerInput.style.resize = 'none';
        answerContainer.appendChild(answerInput);

        const connectButton = this.createButton('CONNECT', async () => {
            const answerCode = answerInput.value.trim();
            if (!answerCode) {
                alert('Please paste the answer code from the client.');
                return;
            }

            try {
                const { answer, playerId: clientId, username: clientUsername } = LANSignaling.parseAnswerCode(answerCode);
                await this.networkManager?.completeConnection(clientId, answer);
                
                // Send lobby update to client
                if (this.networkManager && this.networkManager.getLobby()) {
                    const lobby = this.networkManager.getLobby()!;
                    lobby.players.push({
                        id: clientId,
                        username: clientUsername,
                        isHost: false,
                        isReady: true
                    });
                    this.networkManager.broadcast({
                        type: MessageType.LOBBY_UPDATE,
                        senderId: hostPlayerId,
                        timestamp: Date.now(),
                        data: lobby
                    });
                    const hostPlayer = lobby.players.find((player) => player.isHost);
                    this.registerLanLobbyEntry({
                        hostPlayerId: hostPlayerId,
                        lobbyName: lobby.name,
                        hostUsername: hostPlayer?.username ?? this.settings.username,
                        connectionCode: connectionCode,
                        maxPlayerCount: lobby.maxPlayers,
                        playerCount: lobby.players.length
                    });
                }
                
                alert(`${clientUsername} connected! You can now start the game.`);
            } catch (error) {
                console.error('Failed to connect client:', error);
                alert(`Failed to connect: ${error instanceof Error ? error.message : 'Invalid answer code'}`);
            }
        }, '#0088FF');
        connectButton.style.marginTop = '10px';
        connectButton.style.padding = '10px 20px';
        connectButton.style.fontSize = '16px';
        answerContainer.appendChild(connectButton);

        this.contentElement.appendChild(answerContainer);

        // Start Game button (only for host)
        const startGameButton = this.createButton('START GAME', () => {
            if (!this.networkManager) {
                alert('Network manager not initialized.');
                return;
            }

            if (this.networkManager.getPeerCount() === 0) {
                alert('Please wait for at least one player to connect before starting.');
                return;
            }

            // Notify peers that game is starting
            this.networkManager.startGame();
            this.unregisterLanLobbyEntry(hostPlayerId);
            this.stopLanLobbyHeartbeat();

            // Set game mode to LAN
            this.settings.gameMode = 'lan';
            // Pass network manager to settings
            this.settings.networkManager = this.networkManager;
            
            // Start the game
            if (this.onStartCallback) {
                this.hide();
                this.onStartCallback(this.settings);
            }
        }, '#FF8800');
        startGameButton.style.marginBottom = '20px';
        startGameButton.style.padding = '15px 40px';
        startGameButton.style.fontSize = '24px';
        this.contentElement.appendChild(startGameButton);

        // Cancel button
        const cancelButton = this.createButton('CANCEL', () => {
            if (this.networkManager) {
                this.networkManager.disconnect();
                this.networkManager = null;
            }
            this.unregisterLanLobbyEntry(hostPlayerId);
            this.stopLanLobbyHeartbeat();
            this.currentScreen = 'lan';
            this.startMenuTransition();
            this.renderLANScreen(this.contentElement);
        }, '#666666');
        this.contentElement.appendChild(cancelButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderClientAnswerScreen(answerCode: string, hostUsername: string): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        // Title
        const title = document.createElement('h2');
        title.textContent = `Joining ${hostUsername}'s Lobby`;
        title.style.fontSize = '32px';
        title.style.marginBottom = '20px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        this.contentElement.appendChild(title);

        // Instructions
        const instructions = document.createElement('p');
        instructions.textContent = 'Send this answer code to the host:';
        instructions.style.color = '#CCCCCC';
        instructions.style.fontSize = '18px';
        instructions.style.textAlign = 'center';
        instructions.style.marginBottom = '20px';
        this.contentElement.appendChild(instructions);

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

        const copyButton = this.createButton('COPY CODE', async () => {
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

        this.contentElement.appendChild(codeContainer);

        // Waiting message
        const waitingText = document.createElement('p');
        waitingText.textContent = 'Waiting for host to complete connection...';
        waitingText.style.color = '#888888';
        waitingText.style.fontSize = '18px';
        waitingText.style.textAlign = 'center';
        waitingText.style.marginBottom = '30px';
        this.contentElement.appendChild(waitingText);

        // Listen for game start
        this.networkManager?.on(NetworkEvent.MESSAGE_RECEIVED, (data) => {
            if (data && data.type === MessageType.GAME_START) {
                // Hide menu and start game
                if (this.onStartCallback) {
                    this.settings.gameMode = 'lan';
                    this.settings.networkManager = this.networkManager!;
                    this.hide();
                    this.onStartCallback(this.settings);
                }
            }
        });

        // Cancel button
        const cancelButton = this.createButton('CANCEL', () => {
            if (this.networkManager) {
                this.networkManager.disconnect();
                this.networkManager = null;
            }
            this.currentScreen = 'lan';
            this.startMenuTransition();
            this.renderLANScreen(this.contentElement);
        }, '#666666');
        this.contentElement.appendChild(cancelButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderClientWaitingScreen(): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Connecting to Host...';
        title.style.fontSize = '36px';
        title.style.marginBottom = '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        this.contentElement.appendChild(title);

        // Info text
        const infoText = document.createElement('p');
        infoText.textContent = 'Waiting for host to complete the connection...';
        infoText.style.color = '#CCCCCC';
        infoText.style.fontSize = '20px';
        infoText.style.textAlign = 'center';
        infoText.style.marginBottom = '30px';
        this.contentElement.appendChild(infoText);

        // Cancel button
        const cancelButton = this.createButton('CANCEL', () => {
            if (this.networkManager) {
                this.networkManager.disconnect();
                this.networkManager = null;
            }
            this.currentScreen = 'lan';
            this.startMenuTransition();
            this.renderLANScreen(this.contentElement);
        }, '#666666');
        this.contentElement.appendChild(cancelButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Host P2P Match';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Create form container
        const formContainer = document.createElement('div');
        formContainer.style.maxWidth = '500px';
        formContainer.style.width = '100%';
        formContainer.style.padding = '20px';
        formContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        formContainer.style.borderRadius = '12px';
        formContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
        formContainer.style.marginBottom = '20px';
        container.appendChild(formContainer);

        // Match name input
        const matchNameLabel = document.createElement('label');
        matchNameLabel.textContent = 'Match Name:';
        matchNameLabel.style.fontSize = '20px';
        matchNameLabel.style.color = '#FFFFFF';
        matchNameLabel.style.marginBottom = '8px';
        matchNameLabel.style.display = 'block';
        formContainer.appendChild(matchNameLabel);

        const matchNameInput = document.createElement('input');
        matchNameInput.type = 'text';
        matchNameInput.value = `${this.settings.username}'s Match`;
        matchNameInput.placeholder = 'Enter match name';
        matchNameInput.style.fontSize = '18px';
        matchNameInput.style.padding = '8px 15px';
        matchNameInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        matchNameInput.style.color = '#FFFFFF';
        matchNameInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        matchNameInput.style.borderRadius = '5px';
        matchNameInput.style.fontFamily = 'inherit';
        matchNameInput.style.width = '100%';
        matchNameInput.style.marginBottom = '20px';
        matchNameInput.style.boxSizing = 'border-box';
        formContainer.appendChild(matchNameInput);

        // Max players input
        const maxPlayersLabel = document.createElement('label');
        maxPlayersLabel.textContent = 'Max Players (2-8):';
        maxPlayersLabel.style.fontSize = '20px';
        maxPlayersLabel.style.color = '#FFFFFF';
        maxPlayersLabel.style.marginBottom = '8px';
        maxPlayersLabel.style.display = 'block';
        formContainer.appendChild(maxPlayersLabel);

        const maxPlayersInput = document.createElement('input');
        maxPlayersInput.type = 'number';
        maxPlayersInput.min = '2';
        maxPlayersInput.max = '8';
        maxPlayersInput.value = '2';
        maxPlayersInput.style.fontSize = '18px';
        maxPlayersInput.style.padding = '8px 15px';
        maxPlayersInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        maxPlayersInput.style.color = '#FFFFFF';
        maxPlayersInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        maxPlayersInput.style.borderRadius = '5px';
        maxPlayersInput.style.fontFamily = 'inherit';
        maxPlayersInput.style.width = '100%';
        maxPlayersInput.style.boxSizing = 'border-box';
        formContainer.appendChild(maxPlayersInput);

        // Match info container (hidden initially, shown after match creation)
        const matchInfoContainer = document.createElement('div');
        matchInfoContainer.style.maxWidth = '600px';
        matchInfoContainer.style.width = '100%';
        matchInfoContainer.style.padding = '20px';
        matchInfoContainer.style.backgroundColor = 'rgba(0, 100, 0, 0.2)';
        matchInfoContainer.style.borderRadius = '12px';
        matchInfoContainer.style.border = '2px solid rgba(0, 255, 136, 0.4)';
        matchInfoContainer.style.marginBottom = '20px';
        matchInfoContainer.style.display = 'none';
        container.appendChild(matchInfoContainer);

        const matchIdLabel = document.createElement('div');
        matchIdLabel.textContent = 'SHARE THIS CODE:';
        matchIdLabel.style.fontSize = '18px';
        matchIdLabel.style.color = '#00FF88';
        matchIdLabel.style.marginBottom = '10px';
        matchIdLabel.style.textAlign = 'center';
        matchInfoContainer.appendChild(matchIdLabel);

        const matchIdText = document.createElement('div');
        matchIdText.textContent = '';
        matchIdText.style.fontSize = '32px';
        matchIdText.style.color = '#FFFFFF';
        matchIdText.style.marginBottom = '15px';
        matchIdText.style.textAlign = 'center';
        matchIdText.style.fontFamily = 'monospace';
        matchIdText.style.letterSpacing = '4px';
        matchInfoContainer.appendChild(matchIdText);

        const copyButton = this.createButton('COPY CODE', async () => {
            try {
                await navigator.clipboard.writeText(matchIdText.textContent || '');
                matchIdLabel.textContent = 'CODE COPIED!';
                setTimeout(() => {
                    matchIdLabel.textContent = 'SHARE THIS CODE:';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy match ID:', err);
                matchIdLabel.textContent = 'Failed to copy. Please copy manually.';
                setTimeout(() => {
                    matchIdLabel.textContent = 'SHARE THIS CODE:';
                }, 2000);
            }
        }, '#00FF88');
        copyButton.style.padding = '10px 30px';
        copyButton.style.fontSize = '18px';
        matchInfoContainer.appendChild(copyButton);

        // Players list container
        const playersContainer = document.createElement('div');
        playersContainer.style.maxWidth = '600px';
        playersContainer.style.width = '100%';
        playersContainer.style.padding = '20px';
        playersContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        playersContainer.style.borderRadius = '12px';
        playersContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
        playersContainer.style.marginBottom = '20px';
        playersContainer.style.display = 'none';
        container.appendChild(playersContainer);

        const playersTitle = document.createElement('h3');
        playersTitle.textContent = 'Players:';
        playersTitle.style.fontSize = '24px';
        playersTitle.style.color = '#FFD700';
        playersTitle.style.marginBottom = '15px';
        playersTitle.style.textAlign = 'center';
        playersContainer.appendChild(playersTitle);

        const playersList = document.createElement('div');
        playersList.style.display = 'flex';
        playersList.style.flexDirection = 'column';
        playersList.style.gap = '10px';
        playersContainer.appendChild(playersList);

        // Status message container
        const statusMessage = document.createElement('div');
        statusMessage.style.fontSize = '18px';
        statusMessage.style.color = '#FF6666';
        statusMessage.style.marginBottom = '20px';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.display = 'none';
        container.appendChild(statusMessage);

        // Create match button
        const createButton = this.createButton('CREATE MATCH', async () => {
            const config = getSupabaseConfig();
            if (!config.url || !config.anonKey) {
                statusMessage.textContent = 'Supabase not configured. Cannot create P2P match.';
                statusMessage.style.display = 'block';
                return;
            }

            createButton.disabled = true;
            createButton.textContent = 'CREATING...';

            const matchName = matchNameInput.value.trim() || `${this.settings.username}'s Match`;
            const maxPlayers = Math.max(2, Math.min(8, parseInt(maxPlayersInput.value) || 2));

            this.p2pMatchName = matchName;
            this.p2pMaxPlayers = maxPlayers;

            const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            this.multiplayerNetworkManager = new MultiplayerNetworkManager(config.url, config.anonKey, playerId);

            // Set up event listeners
            this.multiplayerNetworkManager.on(P2PNetworkEvent.MATCH_CREATED, (data) => {
                const match: Match = data.match;
                matchIdText.textContent = match.id.substring(0, 8).toUpperCase();
                matchInfoContainer.style.display = 'block';
                playersContainer.style.display = 'block';
                formContainer.style.display = 'none';
                createButton.style.display = 'none';
                startButton.style.display = 'block';
                
                this.p2pMatchPlayers = [{
                    id: playerId,
                    match_id: match.id,
                    player_id: playerId,
                    role: 'host',
                    connected: true,
                    username: this.settings.username,
                    faction: null
                }];
                this.updatePlayersList(playersList);
            });

            this.multiplayerNetworkManager.on(P2PNetworkEvent.PLAYER_JOINED, (data) => {
                this.fetchAndUpdatePlayers(playersList);
            });

            this.multiplayerNetworkManager.on(P2PNetworkEvent.MATCH_STARTED, () => {
                this.settings.multiplayerNetworkManager = this.multiplayerNetworkManager || undefined;
                this.hide();
                if (this.onStartCallback) {
                    this.ensureDefaultHeroSelection();
                    this.onStartCallback(this.settings);
                }
            });

            this.multiplayerNetworkManager.on(P2PNetworkEvent.ERROR, (data) => {
                const errorMsg = data.message || data.error?.message || data.error || 'Unknown error';
                statusMessage.textContent = `Error: ${errorMsg}`;
                statusMessage.style.display = 'block';
                createButton.disabled = false;
                createButton.textContent = 'CREATE MATCH';
            });

            // Create the match
            const match = await this.multiplayerNetworkManager.createMatch({
                matchName: matchName,
                username: this.settings.username,
                maxPlayers: maxPlayers,
                gameSettings: {}
            });

            if (!match) {
                createButton.disabled = false;
                createButton.textContent = 'CREATE MATCH';
            }
        }, '#00AA00');
        createButton.style.marginBottom = '20px';
        createButton.style.padding = '15px 40px';
        createButton.style.fontSize = '24px';
        container.appendChild(createButton);

        // Start match button (shown after match creation)
        const startButton = this.createButton('START MATCH', async () => {
            if (!this.multiplayerNetworkManager) return;
            
            startButton.disabled = true;
            startButton.textContent = 'STARTING...';
            
            await this.multiplayerNetworkManager.startMatch();
        }, '#00FF88');
        startButton.style.marginBottom = '20px';
        startButton.style.padding = '15px 40px';
        startButton.style.fontSize = '24px';
        startButton.style.display = 'none';
        container.appendChild(startButton);

        // Cancel button
        const cancelButton = this.createButton('CANCEL', () => {
            if (this.multiplayerNetworkManager) {
                void this.multiplayerNetworkManager.disconnect();
                this.multiplayerNetworkManager = null;
            }
            this.currentScreen = 'p2p';
            this.startMenuTransition();
            this.renderP2PScreen(this.contentElement);
        }, '#666666');
        container.appendChild(cancelButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderP2PJoinScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Join P2P Match';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Match ID input container
        const inputContainer = document.createElement('div');
        inputContainer.style.maxWidth = '500px';
        inputContainer.style.width = '100%';
        inputContainer.style.padding = '20px';
        inputContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        inputContainer.style.borderRadius = '12px';
        inputContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
        inputContainer.style.marginBottom = '20px';
        container.appendChild(inputContainer);

        const matchIdLabel = document.createElement('label');
        matchIdLabel.textContent = 'Match ID:';
        matchIdLabel.style.fontSize = '20px';
        matchIdLabel.style.color = '#FFFFFF';
        matchIdLabel.style.marginBottom = '8px';
        matchIdLabel.style.display = 'block';
        inputContainer.appendChild(matchIdLabel);

        const matchIdInput = document.createElement('input');
        matchIdInput.type = 'text';
        matchIdInput.placeholder = 'Enter 8-character match ID';
        matchIdInput.style.fontSize = '24px';
        matchIdInput.style.padding = '12px 15px';
        matchIdInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        matchIdInput.style.color = '#FFFFFF';
        matchIdInput.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        matchIdInput.style.borderRadius = '5px';
        matchIdInput.style.fontFamily = 'monospace';
        matchIdInput.style.width = '100%';
        matchIdInput.style.boxSizing = 'border-box';
        matchIdInput.style.letterSpacing = '4px';
        matchIdInput.style.textTransform = 'uppercase';
        inputContainer.appendChild(matchIdInput);

        // Status message
        const statusMessage = document.createElement('div');
        statusMessage.style.fontSize = '18px';
        statusMessage.style.color = '#FFD700';
        statusMessage.style.marginBottom = '20px';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.display = 'none';
        container.appendChild(statusMessage);

        // Lobby container (shown after successful join)
        const lobbyContainer = document.createElement('div');
        lobbyContainer.style.maxWidth = '600px';
        lobbyContainer.style.width = '100%';
        lobbyContainer.style.padding = '20px';
        lobbyContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
        lobbyContainer.style.borderRadius = '12px';
        lobbyContainer.style.border = '2px solid rgba(255, 215, 0, 0.25)';
        lobbyContainer.style.marginBottom = '20px';
        lobbyContainer.style.display = 'none';
        container.appendChild(lobbyContainer);

        const lobbyTitle = document.createElement('h3');
        lobbyTitle.textContent = 'Match Lobby';
        lobbyTitle.style.fontSize = '24px';
        lobbyTitle.style.color = '#FFD700';
        lobbyTitle.style.marginBottom = '15px';
        lobbyTitle.style.textAlign = 'center';
        lobbyContainer.appendChild(lobbyTitle);

        const playersList = document.createElement('div');
        playersList.style.display = 'flex';
        playersList.style.flexDirection = 'column';
        playersList.style.gap = '10px';
        playersList.style.marginBottom = '15px';
        lobbyContainer.appendChild(playersList);

        const waitingMessage = document.createElement('div');
        waitingMessage.textContent = 'Waiting for host to start...';
        waitingMessage.style.fontSize = '18px';
        waitingMessage.style.color = '#CCCCCC';
        waitingMessage.style.textAlign = 'center';
        waitingMessage.style.fontStyle = 'italic';
        lobbyContainer.appendChild(waitingMessage);

        // Join button
        const joinButton = this.createButton('JOIN MATCH', async () => {
            const config = getSupabaseConfig();
            if (!config.url || !config.anonKey) {
                statusMessage.textContent = 'Supabase not configured. Cannot join P2P match.';
                statusMessage.style.color = '#FF6666';
                statusMessage.style.display = 'block';
                return;
            }

            const matchIdShort = matchIdInput.value.trim().toUpperCase();
            if (!matchIdShort || matchIdShort.length < 6) {
                statusMessage.textContent = 'Please enter a valid match ID (at least 6 characters).';
                statusMessage.style.color = '#FF6666';
                statusMessage.style.display = 'block';
                return;
            }

            joinButton.disabled = true;
            joinButton.textContent = 'JOINING...';
            statusMessage.textContent = 'Connecting...';
            statusMessage.style.color = '#FFD700';
            statusMessage.style.display = 'block';

            const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            this.multiplayerNetworkManager = new MultiplayerNetworkManager(config.url, config.anonKey, playerId);

            // Set up event listeners
            this.multiplayerNetworkManager.on(P2PNetworkEvent.PLAYER_JOINED, () => {
                statusMessage.textContent = 'Joined successfully!';
                statusMessage.style.color = '#00FF88';
                inputContainer.style.display = 'none';
                joinButton.style.display = 'none';
                lobbyContainer.style.display = 'block';
                this.fetchAndUpdatePlayers(playersList);
            });

            this.multiplayerNetworkManager.on(P2PNetworkEvent.MATCH_STARTED, () => {
                this.settings.multiplayerNetworkManager = this.multiplayerNetworkManager || undefined;
                this.hide();
                if (this.onStartCallback) {
                    this.ensureDefaultHeroSelection();
                    this.onStartCallback(this.settings);
                }
            });

            this.multiplayerNetworkManager.on(P2PNetworkEvent.ERROR, (data) => {
                const errorMsg = data.message || data.error?.message || data.error || 'Failed to join match';
                statusMessage.textContent = `Error: ${errorMsg}`;
                statusMessage.style.color = '#FF6666';
                statusMessage.style.display = 'block';
                joinButton.disabled = false;
                joinButton.textContent = 'JOIN MATCH';
            });

            // Find match by short ID prefix
            const matches = await this.multiplayerNetworkManager.listMatches();
            const match = matches.find(m => m.id.toUpperCase().startsWith(matchIdShort));

            if (!match) {
                statusMessage.textContent = 'Match not found. Please check the match ID.';
                statusMessage.style.color = '#FF6666';
                statusMessage.style.display = 'block';
                joinButton.disabled = false;
                joinButton.textContent = 'JOIN MATCH';
                return;
            }

            // Join the match
            const success = await this.multiplayerNetworkManager.joinMatch(match.id, this.settings.username);
            if (!success) {
                joinButton.disabled = false;
                joinButton.textContent = 'JOIN MATCH';
            } else {
                // Start match connection
                await this.multiplayerNetworkManager.startMatch();
            }
        }, '#0088FF');
        joinButton.style.marginBottom = '20px';
        joinButton.style.padding = '15px 40px';
        joinButton.style.fontSize = '24px';
        container.appendChild(joinButton);

        // Leave button
        const leaveButton = this.createButton('LEAVE', () => {
            if (this.multiplayerNetworkManager) {
                void this.multiplayerNetworkManager.disconnect();
                this.multiplayerNetworkManager = null;
            }
            this.currentScreen = 'p2p';
            this.startMenuTransition();
            this.renderP2PScreen(this.contentElement);
        }, '#666666');
        container.appendChild(leaveButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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

        const dedicated2v2Maps = this.availableMaps.filter(map => map.id === '2v2-umbra' || map.id === '2v2-dual-umbra');
        const roomSelectedMapId = room.game_settings?.selectedMapId;
        const selectedLobbyMap = dedicated2v2Maps.find(map => map.id === roomSelectedMapId) || dedicated2v2Maps[0] || this.settings.selectedMap;
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
            onCycleMap: async () => {
                if (!this.onlineNetworkManager || !isHost) return;
                const currentIndex = dedicated2v2Maps.findIndex(map => map.id === selectedLobbyMap.id);
                const nextMap = dedicated2v2Maps[(currentIndex + 1) % dedicated2v2Maps.length] || selectedLobbyMap;
                const success = await this.onlineNetworkManager.setLobbyMap(nextMap.id);
                if (success) {
                    this.settings.selectedMap = nextMap;
                    await this.renderLobbyDetailScreen(this.contentElement);
                } else {
                    const networkError = this.onlineNetworkManager.getLastError();
                    if (networkError) {
                        alert(`Failed to change map: ${networkError}`);
                    }
                }
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
                this.saveUsername(value);
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

    /**
     * Validate and sanitize username
     */
    private validateUsername(username: string): string {
        // Trim and limit length
        let sanitized = username.trim().substring(0, 20);
        
        // If empty or invalid, generate random username
        if (sanitized.length < 1) {
            return this.generateRandomUsername();
        }
        
        return sanitized;
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
            const validatedValue = this.validateUsername(input.value);
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

/**
 * Faction carousel view - displays factions in a horizontal carousel
 */
export class FactionCarouselView {
    private static readonly ITEM_SPACING_PX = 210;
    private static readonly BASE_SIZE_PX = 224;
    private static readonly TEXT_SCALE = 2.4;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    private static readonly SWIPE_THRESHOLD_PX = 50;

    private container: HTMLElement;
    private options: FactionCarouselOption[];
    private currentIndex: number;
    private targetIndex: number;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private lastDragDeltaX: number = 0;
    private velocity: number = 0;
    private hasDragged: boolean = false;
    private isCompactLayout: boolean = false;
    private resizeHandler: (() => void) | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private onSelectionChangeCallback: ((option: FactionCarouselOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private animationFrameId: number | null = null;
    private isAnimationActive: boolean = false;

    constructor(container: HTMLElement, options: FactionCarouselOption[], initialIndex: number) {
        this.container = container;
        this.options = options;
        this.currentIndex = Math.max(0, Math.min(options.length - 1, initialIndex));
        this.targetIndex = this.currentIndex;
        this.setupContainer();
        this.setupEventHandlers();
        this.scrollOffset = -this.currentIndex * this.getItemSpacingPx();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.updateLayoutMetrics();
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y';
    }

    private setupEventHandlers(): void {
        this.resizeHandler = () => {
            this.updateLayoutMetrics();
        };
        window.addEventListener('resize', this.resizeHandler);

        this.keydownHandler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'arrowleft' || key === 'a') {
                this.moveSelection(-1);
                event.preventDefault();
            }
            if (key === 'arrowright' || key === 'd') {
                this.moveSelection(1);
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);

        this.container.addEventListener('mousedown', (event: MouseEvent) => {
            this.startDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mousemove', (event: MouseEvent) => {
            if (this.isDragging) {
                this.updateDrag(event.clientX);
                event.preventDefault();
            }
        });

        this.container.addEventListener('mouseup', (event: MouseEvent) => {
            this.endDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.endDrag(this.dragStartX);
            }
        });

        this.container.addEventListener('touchstart', (event: TouchEvent) => {
            if (event.touches.length === 1) {
                this.startDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (event: TouchEvent) => {
            if (this.isDragging && event.touches.length === 1) {
                this.updateDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (event: TouchEvent) => {
            if (this.isDragging) {
                const touch = event.changedTouches[0];
                this.endDrag(touch.clientX);
                event.preventDefault();
            }
        }, { passive: false });
    }

    private startDrag(x: number): void {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartOffset = this.scrollOffset;
        this.velocity = 0;
        this.hasDragged = false;
        this.lastDragDeltaX = 0;
        this.container.style.cursor = 'grabbing';
        this.startAnimation();
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;

        const deltaX = x - this.dragStartX;
        this.lastDragDeltaX = deltaX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * FactionCarouselView.VELOCITY_MULTIPLIER;

        if (Math.abs(deltaX) > Constants.CLICK_DRAG_THRESHOLD) {
            this.hasDragged = true;
        }
        this.startAnimation();
    }

    private endDrag(x: number): void {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.container.style.cursor = 'grab';

        if (!this.hasDragged) {
            this.handleClick(x);
            return;
        }

        const itemWidthPx = this.getItemSpacingPx();
        const deltaX = this.lastDragDeltaX;
        if (Math.abs(deltaX) >= FactionCarouselView.SWIPE_THRESHOLD_PX) {
            const direction = deltaX < 0 ? 1 : -1;
            this.setCurrentIndex(this.currentIndex + direction);
            return;
        }

        const targetIndexFloat = -this.scrollOffset / itemWidthPx;
        const targetIndex = Math.round(targetIndexFloat + this.velocity * FactionCarouselView.VELOCITY_FACTOR);
        this.setCurrentIndex(targetIndex);
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / this.getItemSpacingPx());
        this.setCurrentIndex(clickedOffset);
    }

    private moveSelection(direction: number): void {
        this.setCurrentIndex(this.currentIndex + direction);
    }

    private setCurrentIndex(nextIndex: number): void {
        const clampedIndex = Math.max(0, Math.min(this.options.length - 1, nextIndex));
        if (clampedIndex === this.currentIndex) {
            this.targetIndex = clampedIndex;
            return;
        }

        this.targetIndex = clampedIndex;
        this.currentIndex = clampedIndex;
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.options[this.currentIndex]);
        }
        this.startAnimation();
    }

    private startAnimation(): void {
        if (this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = true;
        const animate = () => {
            if (!this.isAnimationActive) {
                return;
            }
            const shouldContinue = this.update();
            this.render();
            if (!shouldContinue) {
                this.isAnimationActive = false;
                this.animationFrameId = null;
                return;
            }
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    public pauseAnimation(): void {
        if (!this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public resumeAnimation(): void {
        this.startAnimation();
    }

    private updateLayoutMetrics(): void {
        this.isCompactLayout = window.innerWidth < 600;
        const targetHeight = this.isCompactLayout ? '300px' : '380px';
        if (this.container.style.height !== targetHeight) {
            this.container.style.height = targetHeight;
        }
    }

    private getLayoutScale(): number {
        return this.isCompactLayout ? 0.6 : 0.9;
    }

    private getItemSpacingPx(): number {
        return FactionCarouselView.ITEM_SPACING_PX * this.getLayoutScale();
    }

    private update(): boolean {
        this.updateLayoutMetrics();
        const targetScrollOffset = -this.currentIndex * this.getItemSpacingPx();
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * FactionCarouselView.SMOOTH_INTERPOLATION_FACTOR;

        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= FactionCarouselView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
        const hasSettled = !this.isDragging
            && Math.abs(this.velocity) <= 0.1
            && Math.abs(diff) < 0.5;
        if (hasSettled) {
            this.scrollOffset = targetScrollOffset;
        }
        return !hasSettled;
    }

    private render(): void {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const layoutScale = this.getLayoutScale();
        const itemSpacingPx = this.getItemSpacingPx();
        const baseSizePx = FactionCarouselView.BASE_SIZE_PX * layoutScale;
        const textScale = FactionCarouselView.TEXT_SCALE * layoutScale;

        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            const x = centerX + this.scrollOffset + i * itemSpacingPx;

            let scale = 1.0;
            let opacity = 1.0;
            if (distance === 0) {
                scale = 1.0;
                opacity = 1.0;
            } else if (distance === 1) {
                scale = 0.72;
                opacity = 0.85;
            } else if (distance === 2) {
                scale = 0.5;
                opacity = 0.55;
            } else {
                scale = Math.max(0.3, 1.0 - distance * 0.25);
                opacity = Math.max(0.3, 1.0 - distance * 0.25);
            }

            const sizePx = baseSizePx * scale;
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - sizePx / 2}px`;
            optionElement.style.top = `${centerY - sizePx / 2}px`;
            optionElement.style.width = `${sizePx}px`;
            optionElement.style.height = `${sizePx}px`;
            optionElement.style.backgroundColor = distance === 0 ? 'rgba(12, 14, 22, 0.98)' : 'rgba(12, 14, 22, 0.85)';
            optionElement.style.border = distance === 0 ? `2px solid ${option.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none';
            optionElement.style.color = '#FFFFFF';
            optionElement.style.fontWeight = '300';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = `${24 * layoutScale}px`;
            optionElement.style.boxSizing = 'border-box';
            optionElement.style.zIndex = (100 - distance).toString();
            optionElement.style.overflow = 'hidden';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? option.color : '#66B3FF';

            const nameElement = document.createElement('div');
            nameElement.textContent = option.name.toUpperCase();
            nameElement.style.fontSize = `${Math.max(16, 20 * scale) * textScale}px`;
            nameElement.style.marginBottom = distance === 0 ? '14px' : '0';
            nameElement.style.color = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            optionElement.appendChild(nameElement);

            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.lineHeight = '1.4';
                descElement.style.fontWeight = '300';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }

            this.container.appendChild(optionElement);
        }

        if (this.onRenderCallback) {
            this.onRenderCallback();
        }
    }

    public onSelectionChange(callback: (option: FactionCarouselOption) => void): void {
        this.onSelectionChangeCallback = callback;
    }

    public onRender(callback: () => void): void {
        this.onRenderCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
    }
}

/**
 * Carousel menu view - displays menu options in a horizontal carousel
 */
class CarouselMenuView {
    // Animation constants
    private static readonly ITEM_WIDTH = 260;
    private static readonly BASE_SIZE = 220;
    private static readonly TEXT_SCALE = 2;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    private static readonly SWIPE_THRESHOLD_PX = 50;
    
    private container: HTMLElement;
    private options: MenuOption[];
    private currentIndex: number = 0;
    private targetIndex: number = 0;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private lastDragDeltaX: number = 0;
    private velocity: number = 0;
    private onSelectCallback: ((option: MenuOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private onNavigateCallback: ((nextIndex: number) => void) | null = null;
    private animationFrameId: number | null = null;
    private isAnimationActive: boolean = false;
    private hasDragged: boolean = false;
    private isCompactLayout: boolean = false;
    private resizeHandler: (() => void) | null = null;
    private optionBackgroundColor: string;

    constructor(
        container: HTMLElement,
        options: MenuOption[],
        initialIndex: number = 0,
        optionBackgroundColor: string = 'transparent'
    ) {
        this.container = container;
        this.options = options;
        this.optionBackgroundColor = optionBackgroundColor;
        // Validate and clamp initialIndex to valid range
        const validatedIndex = Math.max(0, Math.min(initialIndex, options.length - 1));
        this.currentIndex = validatedIndex;
        this.targetIndex = validatedIndex;
        this.setupContainer();
        this.setupEventHandlers();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.updateLayoutMetrics();
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y'; // Allow vertical scrolling but handle horizontal ourselves
    }

    private setupEventHandlers(): void {
        this.resizeHandler = () => {
            this.updateLayoutMetrics();
        };
        window.addEventListener('resize', this.resizeHandler);

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
        this.lastDragDeltaX = 0;
        this.container.style.cursor = 'grabbing';
        this.startAnimation();
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartX;
        this.lastDragDeltaX = deltaX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * CarouselMenuView.VELOCITY_MULTIPLIER; // Track velocity for momentum
        
        // Track if we've dragged significantly
        if (Math.abs(deltaX) > Constants.CLICK_DRAG_THRESHOLD) {
            this.hasDragged = true;
        }
        this.startAnimation();
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
        
        const itemWidth = this.getItemWidthPx();
        const deltaX = this.lastDragDeltaX;
        if (Math.abs(deltaX) >= CarouselMenuView.SWIPE_THRESHOLD_PX) {
            const direction = deltaX < 0 ? 1 : -1;
            const targetIndex = Math.max(0, Math.min(this.options.length - 1, this.currentIndex + direction));
            this.setCurrentIndex(targetIndex);
            return;
        }

        // Snap to nearest option based on current position and velocity
        const targetIndexFloat = -this.scrollOffset / itemWidth;
        let targetIndex = Math.round(targetIndexFloat + this.velocity * CarouselMenuView.VELOCITY_FACTOR);

        // Clamp to valid range
        targetIndex = Math.max(0, Math.min(this.options.length - 1, targetIndex));
        this.setCurrentIndex(targetIndex);
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        
        // Determine which option was clicked based on position
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / this.getItemWidthPx());
        const clickedIndex = Math.max(0, Math.min(this.options.length - 1, clickedOffset));
        
        if (clickedIndex === this.currentIndex) {
            // Clicked on center option - select it
            if (this.onSelectCallback) {
                this.onSelectCallback(this.options[this.currentIndex]);
            }
        } else {
            // Clicked on different option - slide to it
            this.setCurrentIndex(clickedIndex);
        }
    }

    private setCurrentIndex(nextIndex: number): void {
        if (nextIndex === this.currentIndex) {
            this.targetIndex = nextIndex;
            return;
        }

        this.targetIndex = nextIndex;
        this.currentIndex = nextIndex;
        if (this.onNavigateCallback) {
            this.onNavigateCallback(nextIndex);
        }
        this.startAnimation();
    }

    private startAnimation(): void {
        if (this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = true;
        const animate = () => {
            if (!this.isAnimationActive) {
                return;
            }
            const shouldContinue = this.update();
            this.render();
            if (!shouldContinue) {
                this.isAnimationActive = false;
                this.animationFrameId = null;
                return;
            }
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    public pauseAnimation(): void {
        if (!this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public resumeAnimation(): void {
        this.startAnimation();
    }

    private updateLayoutMetrics(): void {
        const isCompactLayout = window.innerWidth < 600;
        this.isCompactLayout = isCompactLayout;
        const layoutScale = this.getLayoutScale();
        const baseSize = CarouselMenuView.BASE_SIZE * layoutScale;
        const instructionPadding = 120 * layoutScale;
        const targetHeight = `${Math.round(baseSize + instructionPadding)}px`;
        if (this.container.style.height !== targetHeight) {
            this.container.style.height = targetHeight;
        }
    }

    private getLayoutScale(): number {
        return this.isCompactLayout ? 0.5 : 1;
    }

    private getItemWidthPx(): number {
        return CarouselMenuView.ITEM_WIDTH * this.getLayoutScale();
    }

    private update(): boolean {
        this.updateLayoutMetrics();
        // Smooth scrolling towards target
        const targetScrollOffset = -this.currentIndex * this.getItemWidthPx();
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * CarouselMenuView.SMOOTH_INTERPOLATION_FACTOR;
        
        // Apply velocity decay when not dragging
        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= CarouselMenuView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
        const hasSettled = !this.isDragging
            && Math.abs(this.velocity) <= 0.1
            && Math.abs(diff) < 0.5;
        if (hasSettled) {
            this.scrollOffset = targetScrollOffset;
        }
        return !hasSettled;
    }

    private render(): void {
        // Clear container
        this.container.innerHTML = '';
        
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const layoutScale = this.getLayoutScale();
        const itemWidth = this.getItemWidthPx();
        const baseSize = CarouselMenuView.BASE_SIZE * layoutScale;
        const textScale = CarouselMenuView.TEXT_SCALE * layoutScale;

        // Render each option
        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            
            // Calculate position
            const x = centerX + this.scrollOffset + i * itemWidth;
            
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
            
            const size = baseSize * scale;
            
            // Create option element
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - size / 2}px`;
            optionElement.style.top = `${centerY - size / 2}px`;
            optionElement.style.width = `${size}px`;
            optionElement.style.height = `${size}px`;
            optionElement.style.backgroundColor = this.optionBackgroundColor;
            optionElement.style.border = '2px solid transparent';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.transition = 'background-color 0.2s';
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none'; // Let container handle events
            optionElement.style.color = '#000000';
            optionElement.style.fontWeight = '300';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = '30px';
            optionElement.style.boxSizing = 'border-box';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? '#FFD700' : '#00AAFF';
            
            // Add option name
            const nameElement = document.createElement('div');
            nameElement.textContent = option.name;
            nameElement.style.fontSize = `${Math.max(14, 18 * scale) * textScale}px`;
            nameElement.style.marginBottom = option.subLabel ? '6px' : '15px';
            nameElement.style.color = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            optionElement.appendChild(nameElement);

            if (option.subLabel) {
                const subLabelElement = document.createElement('div');
                subLabelElement.textContent = option.subLabel;
                subLabelElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                subLabelElement.style.marginBottom = '10px';
                subLabelElement.style.color = option.subLabelColor ?? '#D0D0D0';
                subLabelElement.style.fontWeight = '300';
                subLabelElement.dataset.particleText = 'true';
                subLabelElement.dataset.particleColor = option.subLabelColor ?? '#D0D0D0';
                optionElement.appendChild(subLabelElement);
            }
            
            // Add option description (only for center item)
            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.overflow = 'hidden';
                descElement.style.textOverflow = 'ellipsis';
                descElement.style.fontWeight = '300';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }
            
            this.container.appendChild(optionElement);
        }
        
        // Instruction text removed per requirements

        if (this.onRenderCallback) {
            this.onRenderCallback();
        }
    }

    public onSelect(callback: (option: MenuOption) => void): void {
        this.onSelectCallback = callback;
    }

    public onRender(callback: () => void): void {
        this.onRenderCallback = callback;
    }

    public onNavigate(callback: (nextIndex: number) => void): void {
        this.onNavigateCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
}
