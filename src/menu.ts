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
import { BUILD_NUMBER } from './build-info';

// Re-export types for backward compatibility
export { MenuOption, MapConfig, HeroUnit, BaseLoadout, SpawnLoadout, ColorScheme, COLOR_SCHEMES };

export interface GameSettings {
    selectedMap: MapConfig;
    difficulty: 'easy' | 'normal' | 'hard';
    soundEnabled: boolean;
    musicEnabled: boolean;
    isBattleStatsInfoEnabled: boolean;
    selectedFaction: Faction | null;
    selectedHeroes: string[]; // Hero IDs
    selectedHeroNames: string[];
    playerColor: string;
    enemyColor: string;
    selectedBaseLoadout: string | null; // Base loadout ID
    selectedSpawnLoadout: string | null; // Spawn loadout ID
    colorScheme: string; // Color scheme ID
    damageDisplayMode: 'damage' | 'remaining-life'; // How to display damage numbers
    healthDisplayMode: 'bar' | 'number'; // How to display unit health
    graphicsQuality: 'low' | 'medium' | 'high'; // Graphics quality setting
    username: string; // Player's username for multiplayer
    gameMode: 'ai' | 'online' | 'lan'; // Game mode selection
    networkManager?: NetworkManager; // Network manager for LAN/online play
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
    private currentScreen: 'main' | 'maps' | 'settings' | 'faction-select' | 'loadout-customization' | 'loadout-select' | 'game-mode-select' | 'lan' | 'online' = 'main';
    private settings: GameSettings;
    private carouselMenu: CarouselMenuView | null = null;
    private factionCarousel: FactionCarouselView | null = null;
    private testLevelButton: HTMLButtonElement | null = null;
    private ladButton: HTMLButtonElement | null = null;
    private lanServerListTimeout: number | null = null; // Track timeout for cleanup
    private lanLobbyHeartbeatTimeout: number | null = null; // Track heartbeat for LAN lobbies
    private networkManager: NetworkManager | null = null; // Network manager for LAN play
    private mainScreenRenderToken: number = 0;
    private onlineMode: 'ranked' | 'unranked' = 'ranked'; // Track which online mode is selected
    
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
            id: 'radiant-grave', name: 'Grave', description: 'Gravitic sentinel with orbiting projectiles', faction: Faction.RADIANT,
            maxHealth: Constants.GRAVE_MAX_HEALTH, attackDamage: Constants.GRAVE_ATTACK_DAMAGE, attackSpeed: Constants.GRAVE_ATTACK_SPEED,
            attackRange: Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER,
            attackIgnoresDefense: false, defense: 18, regen: 3,
            abilityDescription: 'Orbits gravitic shards that launch at targets and return'
        },
        {
            id: 'radiant-ray', name: 'Ray', description: 'Bouncing beam marks targets', faction: Faction.RADIANT,
            maxHealth: Constants.RAY_MAX_HEALTH, attackDamage: Constants.RAY_ATTACK_DAMAGE, attackSpeed: Constants.RAY_ATTACK_SPEED,
            attackRange: Constants.RAY_ATTACK_RANGE, attackIgnoresDefense: true, defense: 8, regen: 5,
            abilityDescription: 'Solar ricochet: beam bounces between multiple enemies'
        },
        {
            id: 'radiant-influence-ball', name: 'Influence Ball', description: 'Deploys temporary influence zones', faction: Faction.RADIANT,
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
            id: 'radiant-driller', name: 'Driller', description: 'Burrows through asteroids to flank', faction: Faction.RADIANT,
            maxHealth: Constants.DRILLER_MAX_HEALTH, attackDamage: Constants.DRILLER_ATTACK_DAMAGE, attackSpeed: Constants.DRILLER_ATTACK_SPEED,
            attackRange: Constants.DRILLER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 16, regen: 3,
            abilityDescription: 'Drill charge: tunnels through an asteroid toward the target'
        },
        {
            id: 'radiant-dagger', name: 'Dagger', description: 'Cloaked assassin with burst damage', faction: Faction.RADIANT,
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
            id: 'radiant-mortar', name: 'Mortar', description: 'Siege unit with splash damage', faction: Faction.RADIANT,
            maxHealth: Constants.MORTAR_MAX_HEALTH, attackDamage: Constants.MORTAR_ATTACK_DAMAGE, attackSpeed: Constants.MORTAR_ATTACK_SPEED,
            attackRange: Constants.MORTAR_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 2,
            abilityDescription: 'Siege mode: temporarily becomes immobile but gains increased range and damage'
        },
        {
            id: 'radiant-preist', name: 'Preist', description: 'Support healer with dual beams', faction: Faction.RADIANT,
            maxHealth: Constants.PREIST_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
            attackRange: Constants.PREIST_HEALING_RANGE, attackIgnoresDefense: false, defense: 18, regen: 4,
            abilityDescription: 'Healing bomb: launches a projectile that explodes into healing particles'
        },
        {
            id: 'radiant-tank', name: 'Tank', description: 'Extremely tough defensive unit with projectile shield', faction: Faction.RADIANT,
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
        { id: 'radiant-fortified', name: 'Fortified Forge', description: 'Enhanced defensive capabilities with thicker armor', faction: Faction.RADIANT },
        { id: 'radiant-rapid', name: 'Rapid Forge', description: 'Faster production speed at the cost of durability', faction: Faction.RADIANT },
        // Aurum faction bases
        { id: 'aurum-standard', name: 'Standard Vault', description: 'Balanced base with standard production', faction: Faction.AURUM },
        { id: 'aurum-wealth', name: 'Wealth Vault', description: 'Increased resource generation capacity', faction: Faction.AURUM },
        { id: 'aurum-compact', name: 'Compact Vault', description: 'Smaller footprint, easier to defend', faction: Faction.AURUM },
        // Solari faction bases
        { id: 'solari-standard', name: 'Standard Temple', description: 'Balanced base with standard production', faction: Faction.SOLARI },
        { id: 'solari-solar', name: 'Solar Temple', description: 'Enhanced solar collection efficiency', faction: Faction.SOLARI },
        { id: 'solari-titan', name: 'Titan Temple', description: 'Massive health pool, slower to build', faction: Faction.SOLARI },
    ];

    private spawnLoadouts: SpawnLoadout[] = [
        // Radiant faction spawns
        { id: 'radiant-standard', name: 'Standard Starlings', description: 'Balanced minions with standard stats', faction: Faction.RADIANT },
        { id: 'radiant-swarm', name: 'Swarm Starlings', description: 'More units but weaker individually', faction: Faction.RADIANT },
        { id: 'radiant-elite', name: 'Elite Starlings', description: 'Fewer units but stronger and more durable', faction: Faction.RADIANT },
        // Aurum faction spawns
        { id: 'aurum-standard', name: 'Standard Drones', description: 'Balanced minions with standard stats', faction: Faction.AURUM },
        { id: 'aurum-harvester', name: 'Harvester Drones', description: 'Gather resources more efficiently', faction: Faction.AURUM },
        { id: 'aurum-assault', name: 'Assault Drones', description: 'Higher damage output for aggressive play', faction: Faction.AURUM },
        // Solari faction spawns
        { id: 'solari-standard', name: 'Standard Zealots', description: 'Balanced minions with standard stats', faction: Faction.SOLARI },
        { id: 'solari-guardian', name: 'Guardian Zealots', description: 'Tankier units focused on defense', faction: Faction.SOLARI },
        { id: 'solari-blazing', name: 'Blazing Zealots', description: 'Fast-moving units with fire damage', faction: Faction.SOLARI },
    ];

    constructor() {
        // Initialize default settings
        this.settings = {
            selectedMap: this.availableMaps[0],
            difficulty: 'normal',
            soundEnabled: true,
            musicEnabled: true,
            isBattleStatsInfoEnabled: false,
            selectedFaction: Faction.RADIANT,
            selectedHeroes: ['radiant-marine'],
            selectedHeroNames: [],
            playerColor: '#66B3FF', // Somewhat light blue
            enemyColor: '#FF6B6B',   // Slightly light red
            selectedBaseLoadout: null,
            selectedSpawnLoadout: null,
            colorScheme: 'SpaceBlack', // Default color scheme
            damageDisplayMode: 'damage', // Default to showing damage numbers
            healthDisplayMode: 'bar', // Default to showing health bars
            graphicsQuality: 'high', // Default to high graphics
            username: this.getOrGenerateUsername(), // Load or generate username
            gameMode: 'ai' // Default to AI mode
        };
        this.ensureDefaultHeroSelection();
        
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
        this.atmosphereLayer = new MenuAtmosphereLayer(
            menu,
            this.resolveAssetPath('ASSETS/sprites/environment/centralSun.svg')
        );
        this.menuParticleLayer = new ParticleMenuLayer(menu);
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
        void faction;
        return ['radiant-marine'];
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
    }

    private setMenuParticleDensity(multiplier: number): void {
        const densityScale = Math.SQRT2;
        this.menuParticleLayer?.setDensityMultiplier(multiplier * densityScale);
    }

    private startMenuTransition(): void {
        this.menuParticleLayer?.startTransition();
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
        this.renderMainScreenWhenReady(container);
    }

    private renderMainScreenWhenReady(container: HTMLElement): void {
        const renderToken = ++this.mainScreenRenderToken;
        // Menu images are now preloaded in index.html
        if (this.currentScreen !== 'main') {
            return;
        }
        if (renderToken !== this.mainScreenRenderToken) {
            return;
        }
        this.renderMainScreenContent(container);
    }

    private renderMainScreenContent(container: HTMLElement): void {
        this.setTestLevelButtonVisible(true);
        this.setLadButtonVisible(true);
        this.setMenuParticleDensity(1.6);
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
                    this.currentScreen = 'faction-select';
                    this.startMenuTransition();
                    this.renderFactionSelectionScreen(this.contentElement);
                    break;
                case 'start':
                    this.currentScreen = 'game-mode-select';
                    this.startMenuTransition();
                    this.renderGameModeSelectionScreen(this.contentElement);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Map';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Map grid
        const mapGrid = document.createElement('div');
        mapGrid.style.display = 'grid';
        mapGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${isCompactLayout ? 220 : 300}px, 1fr))`;
        mapGrid.style.gap = '20px';
        mapGrid.style.maxWidth = '900px';
        mapGrid.style.padding = '20px';
        mapGrid.style.marginBottom = '30px';

        for (const map of this.availableMaps) {
            const mapCard = document.createElement('div');
            mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            mapCard.style.border = '2px solid transparent';
            mapCard.style.borderRadius = '10px';
            mapCard.style.padding = '20px';
            mapCard.style.cursor = 'pointer';
            mapCard.style.transition = 'all 0.3s';
            mapCard.dataset.particleBox = 'true';
            mapCard.dataset.particleColor = map.id === this.settings.selectedMap.id ? '#FFD700' : '#66B3FF';

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
                this.renderMapSelectionScreen(this.contentElement);
            });

            // Map name
            const mapName = document.createElement('h3');
            mapName.textContent = map.name;
            mapName.style.fontSize = '28px';
            mapName.style.marginBottom = '10px';
            mapName.style.color = map.id === this.settings.selectedMap.id ? '#FFD700' : '#FFFFFF';
            mapName.style.fontWeight = '300';
            mapName.dataset.particleText = 'true';
            mapName.dataset.particleColor = map.id === this.settings.selectedMap.id ? '#FFF2B3' : '#E0F2FF';
            mapCard.appendChild(mapName);

            // Map description
            const mapDesc = document.createElement('p');
            mapDesc.textContent = map.description;
            mapDesc.style.fontSize = '24px';
            mapDesc.style.lineHeight = '1.5';
            mapDesc.style.marginBottom = '15px';
            mapDesc.style.color = '#CCCCCC';
            mapDesc.style.fontWeight = '300';
            mapDesc.dataset.particleText = 'true';
            mapDesc.dataset.particleColor = '#CCCCCC';
            mapCard.appendChild(mapDesc);

            // Map stats
            const mapStats = document.createElement('div');
            mapStats.style.fontSize = '24px';
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
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        container.appendChild(backButton);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Online Play';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Ranked/Unranked button container
        const modeButtonContainer = document.createElement('div');
        modeButtonContainer.style.display = 'flex';
        modeButtonContainer.style.gap = '20px';
        modeButtonContainer.style.marginBottom = '30px';
        modeButtonContainer.style.justifyContent = 'center';

        const unrankedButton = this.createButton('UNRANKED', () => {
            this.onlineMode = 'unranked';
            this.renderOnlinePlaceholderScreen(this.contentElement);
        }, this.onlineMode === 'unranked' ? '#FF8800' : '#666666');
        unrankedButton.style.padding = '12px 24px';
        unrankedButton.style.fontSize = '18px';
        if (this.onlineMode === 'unranked') {
            unrankedButton.style.border = '2px solid #FF8800';
            unrankedButton.style.boxShadow = '0 0 15px rgba(255, 136, 0, 0.5)';
        }
        modeButtonContainer.appendChild(unrankedButton);

        const rankedButton = this.createButton('RANKED', () => {
            this.onlineMode = 'ranked';
            this.renderOnlinePlaceholderScreen(this.contentElement);
        }, this.onlineMode === 'ranked' ? '#FF8800' : '#666666');
        rankedButton.style.padding = '12px 24px';
        rankedButton.style.fontSize = '18px';
        if (this.onlineMode === 'ranked') {
            rankedButton.style.border = '2px solid #FF8800';
            rankedButton.style.boxShadow = '0 0 15px rgba(255, 136, 0, 0.5)';
        }
        modeButtonContainer.appendChild(rankedButton);

        container.appendChild(modeButtonContainer);

        // Coming soon message
        const message = document.createElement('div');
        message.style.maxWidth = '600px';
        message.style.padding = '40px';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        message.style.borderRadius = '10px';
        message.style.border = '2px solid rgba(255, 215, 0, 0.3)';
        message.style.marginBottom = '30px';

        const messageTitle = document.createElement('h3');
        messageTitle.textContent = 'Coming Soon!';
        messageTitle.style.fontSize = '32px';
        messageTitle.style.color = '#FFD700';
        messageTitle.style.textAlign = 'center';
        messageTitle.style.marginBottom = '20px';
        messageTitle.style.fontWeight = '300';
        message.appendChild(messageTitle);

        const messageText = document.createElement('p');
        messageText.innerHTML = `
            Online multiplayer is currently in development.<br><br>
            <strong>Features:</strong><br>
            • Simple, efficient data transmission<br>
            • Prioritized for speed and minimal data size<br>
            • Cross-platform matchmaking<br>
            • Ranked and casual modes
        `;
        messageText.style.fontSize = '20px';
        messageText.style.color = '#CCCCCC';
        messageText.style.textAlign = 'center';
        messageText.style.lineHeight = '1.6';
        message.appendChild(messageText);

        container.appendChild(message);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'game-mode-select';
            this.startMenuTransition();
            this.renderGameModeSelectionScreen(this.contentElement);
        }, '#666666');
        container.appendChild(backButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderSettingsScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
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

        // Username setting
        const usernameSection = this.createSettingSection(
            'Username',
            this.createTextInput(
                this.settings.username,
                (value) => {
                    this.saveUsername(value);
                },
                'Enter your username'
            )
        );
        settingsContainer.appendChild(usernameSection);

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

        const battleStatsSection = this.createSettingSection(
            'Battle Stats Info',
            this.createToggle(
                this.settings.isBattleStatsInfoEnabled,
                (value) => {
                    this.settings.isBattleStatsInfoEnabled = value;
                }
            )
        );
        settingsContainer.appendChild(battleStatsSection);

        // Player Color setting
        const playerColorSection = this.createSettingSection(
            'Player Color',
            this.createColorPicker(
                this.settings.playerColor,
                (value) => {
                    this.settings.playerColor = value;
                }
            )
        );
        settingsContainer.appendChild(playerColorSection);

        // Enemy Color setting
        const enemyColorSection = this.createSettingSection(
            'Enemy Color',
            this.createColorPicker(
                this.settings.enemyColor,
                (value) => {
                    this.settings.enemyColor = value;
                }
            )
        );
        settingsContainer.appendChild(enemyColorSection);

        // Graphics Quality setting
        const graphicsQualitySection = this.createSettingSection(
            'Graphics Quality',
            this.createSelect(
                ['low', 'medium', 'high'],
                this.settings.graphicsQuality,
                (value) => {
                    this.settings.graphicsQuality = value as 'low' | 'medium' | 'high';
                }
            )
        );
        settingsContainer.appendChild(graphicsQualitySection);

        // Color Scheme setting
        const colorSchemeSection = this.createSettingSection(
            'Color Scheme',
            this.createSelect(
                Object.keys(COLOR_SCHEMES),
                this.settings.colorScheme,
                (value) => {
                    this.settings.colorScheme = value;
                }
            )
        );
        settingsContainer.appendChild(colorSchemeSection);

        const resetButton = this.createButton('DELETE DATA', async () => {
            const isConfirmed = window.confirm(
                'Delete all player data and cached files? This will reload the game and start fresh.'
            );
            if (!isConfirmed) {
                return;
            }
            await this.clearPlayerDataAndCache();
            window.location.reload();
        }, '#FF6666');
        resetButton.style.fontSize = '18px';
        resetButton.style.padding = '10px 20px';

        const resetSection = this.createSettingSection('Reset Player Data', resetButton);
        settingsContainer.appendChild(resetSection);

        container.appendChild(settingsContainer);

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        backButton.style.marginTop = '30px';
        container.appendChild(backButton);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderGameModeSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Game Mode';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Create carousel menu container
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
        carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
        carouselContainer.style.marginBottom = isCompactLayout ? '18px' : '20px';
        container.appendChild(carouselContainer);

        // Create game mode options
        const gameModeOptions: MenuOption[] = [
            {
                id: 'ai',
                name: 'AI',
                description: 'Play against computer opponent'
            },
            {
                id: 'online',
                name: 'ONLINE',
                description: 'Play against players worldwide'
            },
            {
                id: 'lan',
                name: 'LAN',
                description: 'Play on local network'
            }
        ];

        // Default to AI mode (index 0)
        this.carouselMenu = new CarouselMenuView(carouselContainer, gameModeOptions, 0);
        this.carouselMenu.onRender(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onNavigate(() => {
            this.startMenuTransition();
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.carouselMenu.onSelect((option: MenuOption) => {
            this.settings.gameMode = option.id as 'ai' | 'online' | 'lan';
            
            switch (option.id) {
                case 'ai':
                    // Start AI game directly
                    this.hide();
                    if (this.onStartCallback) {
                        this.ensureDefaultHeroSelection();
                        this.onStartCallback(this.settings);
                    }
                    break;
                case 'online':
                    // Show online play placeholder
                    this.currentScreen = 'online';
                    this.startMenuTransition();
                    this.renderOnlinePlaceholderScreen(this.contentElement);
                    break;
                case 'lan':
                    // Show LAN menu
                    this.currentScreen = 'lan';
                    this.startMenuTransition();
                    this.renderLANScreen(this.contentElement);
                    break;
            }
        });

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        backButton.style.marginTop = '30px';
        container.appendChild(backButton);

        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderFactionSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Select Your Faction';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '8px' : '12px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Faction carousel
        const carouselContainer = document.createElement('div');
        carouselContainer.style.width = '100%';
        carouselContainer.style.maxWidth = isCompactLayout ? '100%' : '900px';
        carouselContainer.style.padding = isCompactLayout ? '0 10px' : '0';
        carouselContainer.style.marginBottom = '12px';
        container.appendChild(carouselContainer);

        const factions: FactionCarouselOption[] = [
            { 
                id: Faction.RADIANT, 
                name: 'Radiant', 
                description: 'Well-Balanced, Ranged-Focused',
                color: '#00AAFF'
            },
            { 
                id: Faction.AURUM, 
                name: 'Aurum', 
                description: 'Fast-Paced, Melee-Focused',
                color: '#FFD700'
            },
            { 
                id: Faction.SOLARI, 
                name: 'Solari', 
                description: 'Complex Strategy, Ability-Focused',
                color: '#FF6600'
            }
        ];
        const selectedIndex = factions.findIndex((faction) => faction.id === this.settings.selectedFaction);
        const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;
        if (!this.settings.selectedFaction && factions.length > 0) {
            this.settings.selectedFaction = factions[initialIndex].id;
        }

        this.factionCarousel = new FactionCarouselView(carouselContainer, factions, initialIndex);
        this.factionCarousel.onSelectionChange((option) => {
            if (this.settings.selectedFaction !== option.id) {
                this.settings.selectedFaction = option.id;
                this.settings.selectedHeroes = []; // Reset hero selection when faction changes
                this.ensureDefaultHeroSelection();
            }
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });
        this.factionCarousel.onRender(() => {
            this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
        });

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '8px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Continue button to loadout customization (only enabled if faction is selected)
        if (this.settings.selectedFaction) {
            const continueButton = this.createButton('CUSTOMIZE LOADOUT', () => {
                this.currentScreen = 'loadout-customization';
                this.startMenuTransition();
                this.renderLoadoutCustomizationScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(continueButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'main';
            this.startMenuTransition();
            this.renderMainScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private renderLoadoutCustomizationScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        if (!this.settings.selectedFaction) {
            // Should not happen, but safety fallback
            this.currentScreen = 'faction-select';
            this.renderFactionSelectionScreen(container);
            return;
        }

        // Title
        const title = document.createElement('h2');
        title.textContent = 'Customize Loadout';
        title.style.fontSize = isCompactLayout ? '32px' : '48px';
        title.style.marginBottom = isCompactLayout ? '20px' : '30px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = 'bold';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Get faction-specific loadouts
        const factionBaseLoadouts = this.baseLoadouts.filter(l => l.faction === this.settings.selectedFaction);
        const factionSpawnLoadouts = this.spawnLoadouts.filter(l => l.faction === this.settings.selectedFaction);

        // Set defaults if not selected
        if (!this.settings.selectedBaseLoadout && factionBaseLoadouts.length > 0) {
            this.settings.selectedBaseLoadout = factionBaseLoadouts[0].id;
        }
        if (!this.settings.selectedSpawnLoadout && factionSpawnLoadouts.length > 0) {
            this.settings.selectedSpawnLoadout = factionSpawnLoadouts[0].id;
        }

        // Main content container
        const contentContainer = document.createElement('div');
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'column';
        contentContainer.style.gap = '40px';
        contentContainer.style.width = '100%';
        contentContainer.style.maxWidth = isCompactLayout ? '100%' : '800px';
        contentContainer.style.padding = isCompactLayout ? '0 10px' : '0 20px';
        container.appendChild(contentContainer);

        // Base Loadout Section
        this.createLoadoutSection(
            contentContainer,
            'Base Loadout',
            factionBaseLoadouts,
            this.settings.selectedBaseLoadout,
            (loadoutId) => { this.settings.selectedBaseLoadout = loadoutId; },
            isCompactLayout
        );

        // Spawn Loadout Section
        this.createLoadoutSection(
            contentContainer,
            'Spawn Loadout',
            factionSpawnLoadouts,
            this.settings.selectedSpawnLoadout,
            (loadoutId) => { this.settings.selectedSpawnLoadout = loadoutId; },
            isCompactLayout
        );

        // Hero Loadout Section (link to hero selection)
        const heroSection = document.createElement('div');
        heroSection.style.marginTop = '20px';
        const heroTitle = document.createElement('h3');
        heroTitle.textContent = 'Hero Loadout';
        heroTitle.style.fontSize = isCompactLayout ? '24px' : '32px';
        heroTitle.style.color = '#00AAFF';
        heroTitle.style.marginBottom = '15px';
        heroTitle.style.fontWeight = 'bold';
        heroTitle.dataset.particleText = 'true';
        heroTitle.dataset.particleColor = '#00AAFF';
        heroSection.appendChild(heroTitle);

        const heroDesc = document.createElement('div');
        heroDesc.textContent = this.settings.selectedHeroes.length > 0 
            ? `Selected: ${this.settings.selectedHeroNames.join(', ')}`
            : 'No heroes selected yet';
        heroDesc.style.fontSize = '20px';
        heroDesc.style.color = '#CCCCCC';
        heroDesc.style.marginBottom = '15px';
        heroSection.appendChild(heroDesc);

        const selectHeroesBtn = this.createButton('SELECT HEROES', () => {
            this.currentScreen = 'loadout-select';
            this.startMenuTransition();
            this.renderLoadoutSelectionScreen(this.contentElement);
        }, '#00FF88');
        heroSection.appendChild(selectHeroesBtn);
        contentContainer.appendChild(heroSection);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '20px';
        buttonContainer.style.marginTop = '30px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'faction-select';
            this.startMenuTransition();
            this.renderFactionSelectionScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
    }

    private createLoadoutSection(
        container: HTMLElement,
        title: string,
        loadouts: (BaseLoadout | SpawnLoadout)[],
        selectedId: string | null,
        onSelect: (id: string) => void,
        isCompact: boolean
    ): void {
        const section = document.createElement('div');
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = title;
        sectionTitle.style.fontSize = isCompact ? '24px' : '32px';
        sectionTitle.style.color = '#00AAFF';
        sectionTitle.style.marginBottom = '15px';
        sectionTitle.style.fontWeight = 'bold';
        sectionTitle.dataset.particleText = 'true';
        sectionTitle.dataset.particleColor = '#00AAFF';
        section.appendChild(sectionTitle);

        const optionsContainer = document.createElement('div');
        optionsContainer.style.display = 'flex';
        optionsContainer.style.flexDirection = 'column';
        optionsContainer.style.gap = '10px';

        loadouts.forEach(loadout => {
            const isSelected = loadout.id === selectedId;
            const optionDiv = document.createElement('div');
            optionDiv.style.padding = '15px';
            optionDiv.style.backgroundColor = isSelected ? 'rgba(0, 170, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)';
            optionDiv.style.border = isSelected ? '2px solid #00AAFF' : '2px solid rgba(255, 255, 255, 0.2)';
            optionDiv.style.borderRadius = '8px';
            optionDiv.style.cursor = 'pointer';
            optionDiv.style.transition = 'all 0.2s';

            const nameDiv = document.createElement('div');
            nameDiv.textContent = loadout.name;
            nameDiv.style.fontSize = '22px';
            nameDiv.style.color = isSelected ? '#00AAFF' : '#FFFFFF';
            nameDiv.style.fontWeight = 'bold';
            nameDiv.style.marginBottom = '5px';
            nameDiv.dataset.particleText = 'true';
            nameDiv.dataset.particleColor = isSelected ? '#00AAFF' : '#FFFFFF';
            optionDiv.appendChild(nameDiv);

            const descDiv = document.createElement('div');
            descDiv.textContent = loadout.description;
            descDiv.style.fontSize = '18px';
            descDiv.style.color = '#CCCCCC';
            optionDiv.appendChild(descDiv);

            optionDiv.addEventListener('click', () => {
                onSelect(loadout.id);
                this.renderLoadoutCustomizationScreen(this.contentElement);
            });

            optionDiv.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    optionDiv.style.backgroundColor = 'rgba(0, 170, 255, 0.1)';
                    optionDiv.style.borderColor = '#00AAFF';
                }
            });

            optionDiv.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    optionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                    optionDiv.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
            });

            optionsContainer.appendChild(optionDiv);
        });

        section.appendChild(optionsContainer);
        container.appendChild(section);
    }

    private renderLoadoutSelectionScreen(container: HTMLElement): void {
        this.clearMenu();
        this.setMenuParticleDensity(1.6);
        const screenWidth = window.innerWidth;
        const isCompactLayout = screenWidth < 600;

        if (!this.settings.selectedFaction) {
            // Shouldn't happen, but handle gracefully
            this.renderFactionSelectionScreen(container);
            return;
        }

        // Title
        const title = document.createElement('h2');
        title.textContent = `Select 4 Heroes - ${this.settings.selectedFaction}`;
        title.style.fontSize = isCompactLayout ? '28px' : '42px';
        title.style.marginBottom = isCompactLayout ? '15px' : '20px';
        title.style.color = '#FFD700';
        title.style.textAlign = 'center';
        title.style.maxWidth = '100%';
        title.style.fontWeight = '300';
        title.dataset.particleText = 'true';
        title.dataset.particleColor = '#FFD700';
        container.appendChild(title);

        // Selection counter
        const counter = document.createElement('div');
        counter.textContent = `Selected: ${this.settings.selectedHeroes.length} / 4`;
        counter.style.fontSize = isCompactLayout ? '24px' : '26px';
        counter.style.marginBottom = isCompactLayout ? '20px' : '30px';
        counter.style.color = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        counter.style.fontWeight = '300';
        counter.dataset.particleText = 'true';
        counter.dataset.particleColor = this.settings.selectedHeroes.length === 4 ? '#00FF88' : '#CCCCCC';
        container.appendChild(counter);

        // Hero grid
        const heroGrid = document.createElement('div');
        heroGrid.style.display = 'grid';
        heroGrid.style.gridTemplateColumns = isCompactLayout
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fit, minmax(280px, 1fr))';
        heroGrid.style.gap = '15px';
        heroGrid.style.maxWidth = '1200px';
        heroGrid.style.padding = '20px';
        heroGrid.style.marginBottom = '20px';
        heroGrid.style.maxHeight = isCompactLayout ? 'none' : '600px';
        heroGrid.style.overflowY = isCompactLayout ? 'visible' : 'auto';

        // Filter heroes by selected faction
        const factionHeroes = this.heroUnits.filter(hero => hero.faction === this.settings.selectedFaction);

        for (const hero of factionHeroes) {
            const isSelected = this.settings.selectedHeroes.includes(hero.id);
            const canSelect = isSelected || this.settings.selectedHeroes.length < 4;

            const heroCard = document.createElement('div');
            heroCard.style.backgroundColor = isSelected ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            heroCard.style.border = '2px solid transparent';
            heroCard.style.borderRadius = '10px';
            heroCard.style.padding = '15px';
            heroCard.style.cursor = canSelect ? 'pointer' : 'not-allowed';
            heroCard.style.transition = 'all 0.3s';
            heroCard.style.opacity = canSelect ? '1' : '0.5';
            heroCard.style.minHeight = '300px';
            heroCard.dataset.particleBox = 'true';
            heroCard.dataset.particleColor = isSelected ? '#00FF88' : '#66B3FF';

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
                    this.renderLoadoutSelectionScreen(this.contentElement);
                });
            }

            // Hero name
            const heroName = document.createElement('h4');
            heroName.textContent = hero.name;
            heroName.style.fontSize = '24px';
            heroName.style.marginBottom = '8px';
            heroName.style.color = isSelected ? '#00FF88' : '#E0F2FF';
            heroName.style.fontWeight = '300';
            heroName.dataset.particleText = 'true';
            heroName.dataset.particleColor = isSelected ? '#00FF88' : '#E0F2FF';
            heroCard.appendChild(heroName);

            // Hero description
            const heroDesc = document.createElement('p');
            heroDesc.textContent = hero.description;
            heroDesc.style.fontSize = '24px';
            heroDesc.style.lineHeight = '1.4';
            heroDesc.style.color = '#AAAAAA';
            heroDesc.style.marginBottom = '10px';
            heroDesc.style.fontWeight = '300';
            heroDesc.dataset.particleText = 'true';
            heroDesc.dataset.particleColor = '#AAAAAA';
            heroCard.appendChild(heroDesc);

            // Stats section
            const statsContainer = document.createElement('div');
            statsContainer.style.fontSize = '24px';
            statsContainer.style.lineHeight = '1.6';
            statsContainer.style.color = '#CCCCCC';
            statsContainer.style.marginBottom = '8px';
            statsContainer.style.padding = '8px';
            statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            statsContainer.style.borderRadius = '5px';
            statsContainer.style.fontWeight = '300';

            // Create stat rows
            const healthStat = document.createElement('div');
            healthStat.textContent = `HP: ${hero.maxHealth}`;
            healthStat.style.color = '#CCCCCC';
            healthStat.style.fontWeight = 'bold';
            healthStat.dataset.particleText = 'true';
            healthStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(healthStat);

            const regenStat = document.createElement('div');
            regenStat.textContent = `RGN: ${hero.regen}%`;
            regenStat.style.color = '#CCCCCC';
            regenStat.style.fontWeight = 'bold';
            regenStat.dataset.particleText = 'true';
            regenStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(regenStat);

            const defenseStat = document.createElement('div');
            defenseStat.textContent = `DEF: ${hero.defense}%`;
            defenseStat.style.color = '#CCCCCC';
            defenseStat.style.fontWeight = 'bold';
            defenseStat.dataset.particleText = 'true';
            defenseStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(defenseStat);

            const attackStat = document.createElement('div');
            const attackSuffix = hero.attackIgnoresDefense ? ' (ignores defense)' : '';
            attackStat.textContent = `ATK: ${hero.attackDamage}${attackSuffix}`;
            attackStat.style.color = '#CCCCCC';
            attackStat.style.fontWeight = 'bold';
            attackStat.dataset.particleText = 'true';
            attackStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackStat);

            const attackSpeedStat = document.createElement('div');
            attackSpeedStat.textContent = `SPD: ${hero.attackSpeed}/s`;
            attackSpeedStat.style.color = '#CCCCCC';
            attackSpeedStat.style.fontWeight = 'bold';
            attackSpeedStat.dataset.particleText = 'true';
            attackSpeedStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(attackSpeedStat);

            const rangeStat = document.createElement('div');
            rangeStat.textContent = `RNG: ${hero.attackRange}`;
            rangeStat.style.color = '#CCCCCC';
            rangeStat.style.fontWeight = 'bold';
            rangeStat.dataset.particleText = 'true';
            rangeStat.dataset.particleColor = '#CCCCCC';
            statsContainer.appendChild(rangeStat);

            heroCard.appendChild(statsContainer);

            // Ability description
            const abilityDesc = document.createElement('div');
            abilityDesc.style.fontSize = '24px';
            abilityDesc.style.lineHeight = '1.4';
            abilityDesc.style.color = '#FFD700';
            abilityDesc.style.marginBottom = '8px';
            abilityDesc.style.fontStyle = 'italic';
            abilityDesc.style.fontWeight = 'bold';
            abilityDesc.textContent = `${hero.abilityDescription}`;
            abilityDesc.dataset.particleText = 'true';
            abilityDesc.dataset.particleColor = '#FFD700';
            heroCard.appendChild(abilityDesc);

            // Selection indicator
            if (isSelected) {
                const indicator = document.createElement('div');
                indicator.textContent = '✓ Selected';
                indicator.style.fontSize = '24px';
                indicator.style.marginTop = '8px';
                indicator.style.color = '#00FF88';
                indicator.style.fontWeight = '300';
                indicator.dataset.particleText = 'true';
                indicator.dataset.particleColor = '#00FF88';
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
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.justifyContent = 'center';
        if (isCompactLayout) {
            buttonContainer.style.flexDirection = 'column';
            buttonContainer.style.alignItems = 'center';
        }

        // Confirm button (only enabled if 4 heroes selected)
        if (this.settings.selectedHeroes.length === 4) {
            const confirmButton = this.createButton('CONFIRM LOADOUT', () => {
                this.currentScreen = 'main';
                this.startMenuTransition();
                this.renderMainScreen(this.contentElement);
            }, '#00FF88');
            buttonContainer.appendChild(confirmButton);
        }

        // Back button
        const backButton = this.createButton('BACK', () => {
            this.currentScreen = 'loadout-customization';
            this.startMenuTransition();
            this.renderLoadoutCustomizationScreen(this.contentElement);
        }, '#666666');
        buttonContainer.appendChild(backButton);

        container.appendChild(buttonContainer);
        this.menuParticleLayer?.requestTargetRefresh(this.contentElement);
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

    private createSettingSection(label: string, control: HTMLElement): HTMLElement {
        const section = document.createElement('div');
        section.style.marginBottom = '30px';
        section.style.display = 'flex';
        section.style.justifyContent = 'space-between';
        section.style.alignItems = 'center';

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.fontSize = '24px';
        labelElement.style.color = '#FFFFFF';
        labelElement.style.fontWeight = '300';
        labelElement.dataset.particleText = 'true';
        labelElement.dataset.particleColor = '#FFFFFF';

        section.appendChild(labelElement);
        section.appendChild(control);

        return section;
    }

    private createSelect(options: string[], currentValue: string, onChange: (value: string) => void): HTMLSelectElement {
        const select = document.createElement('select');
        select.style.fontSize = '24px';
        select.style.padding = '8px 15px';
        select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        select.style.color = '#FFFFFF';
        select.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        select.style.borderRadius = '5px';
        select.style.cursor = 'pointer';
        select.style.fontFamily = 'inherit';
        select.style.fontWeight = '300';

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

    private createColorPicker(currentValue: string, onChange: (value: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';

        // Color preview box
        const preview = document.createElement('div');
        preview.style.width = '40px';
        preview.style.height = '40px';
        preview.style.backgroundColor = currentValue;
        preview.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        preview.style.borderRadius = '5px';
        preview.style.cursor = 'pointer';

        // Hidden color input
        const input = document.createElement('input');
        input.type = 'color';
        input.value = currentValue;
        input.style.opacity = '0';
        input.style.width = '0';
        input.style.height = '0';
        input.style.position = 'absolute';

        input.addEventListener('change', () => {
            preview.style.backgroundColor = input.value;
            onChange(input.value);
        });

        preview.addEventListener('click', () => {
            input.click();
        });

        container.appendChild(preview);
        container.appendChild(input);

        return container;
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
        this.backgroundParticleLayer?.stop();
        this.atmosphereLayer?.stop();
        this.menuParticleLayer?.stop();
        
        // Show match loading screen
        this.showMatchLoadingScreen();
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'block';
        this.currentScreen = 'main';
        this.renderMainScreen(this.contentElement);
        this.backgroundParticleLayer?.start();
        this.atmosphereLayer?.start();
        this.menuParticleLayer?.start();
    }

    /**
     * Remove the menu from DOM
     */
    destroy(): void {
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
class FactionCarouselView {
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
    }

    private startAnimation(): void {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
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

    private update(): void {
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
    }

    private startAnimation(): void {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
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

    private update(): void {
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
            nameElement.style.marginBottom = '15px';
            nameElement.style.color = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFF5C2' : '#E2F4FF';
            optionElement.appendChild(nameElement);
            
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
