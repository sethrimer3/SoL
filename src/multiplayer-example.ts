/**
 * Example Integration: P2P Multiplayer with SoL Game
 * 
 * This file demonstrates how to integrate the P2P networking system
 * with the SoL game. Use this as a reference for implementation.
 */

import { MultiplayerNetworkManager, NetworkEvent } from './multiplayer-network';
import { getGameRNG, isGameRNGInitialized } from './seeded-random';

/**
 * Example: Game controller with multiplayer support
 */
class MultiplayerGameController {
    private network: MultiplayerNetworkManager | null = null;
    private gameState: any = null; // Your GameState instance
    private isMultiplayer: boolean = false;
    private tickAccumulator: number = 0;
    private readonly TICK_INTERVAL_MS: number = 33.33; // 30 ticks/second

    constructor() {
        // Initialize single-player by default
        this.isMultiplayer = false;
    }

    /**
     * Initialize multiplayer mode
     */
    initializeMultiplayer(supabaseUrl: string, supabaseKey: string, playerId: string): void {
        console.log('[Game] Initializing multiplayer...');
        
        this.network = new MultiplayerNetworkManager(supabaseUrl, supabaseKey, playerId);
        this.isMultiplayer = true;

        // Setup event listeners
        this.setupNetworkEvents();
    }

    /**
     * Setup network event handlers
     */
    private setupNetworkEvents(): void {
        if (!this.network) return;

        this.network.on(NetworkEvent.MATCH_CREATED, (data) => {
            console.log('[Game] Match created:', data.match.id);
            // Update UI: show match code, waiting for players
        });

        this.network.on(NetworkEvent.PLAYER_JOINED, (data) => {
            console.log('[Game] Player joined:', data.username);
            // Update UI: show player in lobby
        });

        this.network.on(NetworkEvent.CONNECTING, () => {
            console.log('[Game] Establishing P2P connections...');
            // Update UI: show "Connecting..." status
        });

        this.network.on(NetworkEvent.CONNECTED, () => {
            console.log('[Game] All players connected!');
            // Update UI: show "Ready to start"
        });

        this.network.on(NetworkEvent.MATCH_STARTED, (data) => {
            console.log('[Game] Match started! Seed:', data.seed);
            // Start game with synchronized seed
            this.startGame(data.seed);
        });

        this.network.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            console.log('[Game] Command received:', data.command);
            // Commands are queued automatically, just for logging
        });

        this.network.on(NetworkEvent.MATCH_ENDED, (data) => {
            console.log('[Game] Match ended:', data.reason);
            // Return to menu
        });

        this.network.on(NetworkEvent.ERROR, (data) => {
            console.error('[Game] Network error:', data.error);
            // Show error to user
        });
    }

    /**
     * Host a multiplayer match
     */
    async hostMatch(matchName: string, username: string, maxPlayers: number = 2): Promise<void> {
        if (!this.network) {
            console.error('[Game] Network not initialized');
            return;
        }

        const match = await this.network.createMatch({
            matchName,
            username,
            maxPlayers,
            tickRate: 30,
            lockstepEnabled: false, // Phase 1: P2P only
            gameSettings: {
                // Game-specific settings
                mapSize: 'medium',
                timeLimit: 600 // seconds
            }
        });

        if (match) {
            console.log('[Game] Match created:', match.id);
            // Show match ID to players so they can join
        }
    }

    /**
     * Join a multiplayer match
     */
    async joinMatch(matchId: string, username: string): Promise<void> {
        if (!this.network) {
            console.error('[Game] Network not initialized');
            return;
        }

        const success = await this.network.joinMatch(matchId, username);
        
        if (success) {
            console.log('[Game] Joined match:', matchId);
        }
    }

    /**
     * Start the match (once all players are ready)
     */
    async startMatch(): Promise<void> {
        if (!this.network) {
            console.error('[Game] Network not initialized');
            return;
        }

        await this.network.startMatch();
        // Game will start when MATCH_STARTED event fires
    }

    /**
     * Start the game with a seed (called when MATCH_STARTED fires)
     */
    private startGame(seed?: number): void {
        console.log('[Game] Starting game with seed:', seed);

        // Verify RNG is initialized (should be done by network manager)
        if (seed !== undefined && !isGameRNGInitialized()) {
            console.error('[Game] RNG not initialized despite having seed!');
            return;
        }

        // Initialize your game state
        // this.gameState = new GameState(/* ... */);
        
        // Start game loop
        this.startGameLoop();
    }

    /**
     * Main game loop
     */
    private startGameLoop(): void {
        let lastTime = performance.now();

        const loop = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            if (this.isMultiplayer) {
                // Multiplayer: fixed timestep with command synchronization
                this.updateMultiplayer(deltaTime);
            } else {
                // Single-player: normal update
                this.updateSinglePlayer(deltaTime);
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    /**
     * Update single-player game
     */
    private updateSinglePlayer(deltaTime: number): void {
        if (!this.gameState) return;

        // Normal game update
        // this.gameState.update(deltaTime);
        
        // Render
        // this.renderer.render(this.gameState);
    }

    /**
     * Update multiplayer game with fixed timestep
     */
    private updateMultiplayer(deltaTime: number): void {
        if (!this.network || !this.gameState) return;

        // Accumulate time for fixed timestep
        this.tickAccumulator += deltaTime;

        // Process ticks
        while (this.tickAccumulator >= this.TICK_INTERVAL_MS) {
            // Get synchronized commands for this tick
            const commands = this.network.getNextTickCommands();

            if (commands) {
                // Execute all commands for this tick
                this.executeCommands(commands);

                // Advance to next tick
                this.network.advanceTick();

                // Update game state (deterministic simulation)
                // this.gameState.updateTick();

                this.tickAccumulator -= this.TICK_INTERVAL_MS;
            } else {
                // Waiting for commands from other players
                // Don't advance simulation
                break;
            }
        }

        // Render (interpolated for smooth visuals)
        // const alpha = this.tickAccumulator / this.TICK_INTERVAL_MS;
        // this.renderer.render(this.gameState, alpha);
    }

    /**
     * Execute commands for a tick (deterministic)
     */
    private executeCommands(commands: any[]): void {
        // Commands are already sorted by playerId for determinism
        commands.forEach(cmd => {
            this.executeCommand(cmd);
        });
    }

    /**
     * Execute a single command (deterministic)
     */
    private executeCommand(cmd: any): void {
        console.log('[Game] Executing command:', cmd.commandType, cmd);

        // Use seeded RNG if needed
        const rng = getGameRNG();

        switch (cmd.commandType) {
            case 'move_unit':
                // this.gameState.moveUnit(cmd.payload.unitId, cmd.payload.x, cmd.payload.y);
                break;

            case 'build_structure':
                // this.gameState.buildStructure(cmd.payload.type, cmd.payload.x, cmd.payload.y);
                break;

            case 'purchase_hero':
                // this.gameState.purchaseHero(cmd.playerId, cmd.payload.heroType);
                break;

            case 'use_ability':
                // this.gameState.useAbility(cmd.payload.unitId, cmd.payload.direction);
                break;

            // Add more command types as needed
        }
    }

    /**
     * Player action: Move units
     */
    moveUnits(unitIds: number[], targetX: number, targetY: number): void {
        if (this.isMultiplayer && this.network) {
            // Send command to network
            this.network.sendCommand('move_units', {
                unitIds,
                targetX,
                targetY
            });
        } else {
            // Single-player: execute immediately
            // this.gameState.moveUnits(unitIds, targetX, targetY);
        }
    }

    /**
     * Player action: Build structure
     */
    buildStructure(type: string, x: number, y: number): void {
        if (this.isMultiplayer && this.network) {
            this.network.sendCommand('build_structure', {
                type,
                x,
                y
            });
        } else {
            // this.gameState.buildStructure(type, x, y);
        }
    }

    /**
     * Player action: Purchase hero
     */
    purchaseHero(heroType: string): void {
        if (this.isMultiplayer && this.network) {
            this.network.sendCommand('purchase_hero', {
                heroType
            });
        } else {
            // this.gameState.purchaseHero(heroType);
        }
    }

    /**
     * End multiplayer match
     */
    async endMatch(): Promise<void> {
        if (this.network) {
            await this.network.endMatch();
        }
    }

    /**
     * Get network statistics (for debugging)
     */
    getNetworkStats() {
        if (!this.network) return null;

        return {
            queue: this.network.getQueueStats(),
            network: this.network.getNetworkStats(),
            tick: this.network.getCurrentTick(),
            seed: this.network.getGameSeed()
        };
    }
}

/**
 * Example UI integration
 */
class MultiplayerMenuUI {
    private controller: MultiplayerGameController;

    constructor(controller: MultiplayerGameController) {
        this.controller = controller;
    }

    /**
     * Show main menu with multiplayer options
     */
    showMainMenu(): void {
        // Render menu with buttons:
        // - Single Player
        // - Host Match
        // - Join Match
    }

    /**
     * Show host match dialog
     */
    async showHostMatchDialog(): Promise<void> {
        const matchName = prompt('Enter match name:');
        const username = prompt('Enter your username:');
        const maxPlayers = parseInt(prompt('Max players (2-8):') || '2');

        if (matchName && username) {
            await this.controller.hostMatch(matchName, username, maxPlayers);
            this.showLobby();
        }
    }

    /**
     * Show join match dialog
     */
    async showJoinMatchDialog(): Promise<void> {
        const matchId = prompt('Enter match ID:');
        const username = prompt('Enter your username:');

        if (matchId && username) {
            await this.controller.joinMatch(matchId, username);
            this.showLobby();
        }
    }

    /**
     * Show lobby (waiting for players)
     */
    showLobby(): void {
        // Show lobby UI:
        // - Match ID
        // - Connected players
        // - "Start Match" button (host only)
        // - "Leave" button
    }

    /**
     * Start button clicked (host only)
     */
    async onStartButtonClicked(): Promise<void> {
        await this.controller.startMatch();
    }
}

/**
 * Example initialization
 */
function initializeGame() {
    // Get Supabase credentials from environment or config
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
    
    // Generate or retrieve player ID
    const playerId = localStorage.getItem('playerId') || generateUUID();
    localStorage.setItem('playerId', playerId);

    // Create game controller
    const controller = new MultiplayerGameController();
    
    // Initialize multiplayer if credentials available
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        controller.initializeMultiplayer(SUPABASE_URL, SUPABASE_ANON_KEY, playerId);
        console.log('[Game] Multiplayer enabled');
    } else {
        console.log('[Game] Multiplayer disabled (no Supabase credentials)');
    }

    // Create UI
    const menuUI = new MultiplayerMenuUI(controller);
    menuUI.showMainMenu();

    return { controller, menuUI };
}

/**
 * Utility: Generate UUID
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Example: Testing determinism
 */
function testDeterminism() {
    const seed = 12345;
    const commands = [
        { tick: 0, playerId: 'p1', commandType: 'move_unit', payload: { unitId: 1, x: 100, y: 100 } },
        { tick: 1, playerId: 'p2', commandType: 'build_structure', payload: { type: 'Cannon', x: 50, y: 50 } },
        { tick: 2, playerId: 'p1', commandType: 'purchase_hero', payload: { heroType: 'Ray' } }
    ];

    // Run simulation twice with same seed and commands
    const state1 = simulateGame(seed, commands);
    const state2 = simulateGame(seed, commands);

    // Verify identical results
    const hash1 = hashGameState(state1);
    const hash2 = hashGameState(state2);

    if (hash1 === hash2) {
        console.log('✅ Determinism test PASSED');
    } else {
        console.error('❌ Determinism test FAILED - states diverged!');
    }
}

function simulateGame(seed: number, commands: any[]): any {
    // Initialize RNG with seed
    // Create game state
    // Execute commands in order
    // Return final state
    return {};
}

function hashGameState(state: any): string {
    // Create deterministic hash of game state
    // Include: unit positions, health, resources, etc.
    return JSON.stringify(state);
}

// Export for use in other modules
export {
    MultiplayerGameController,
    MultiplayerMenuUI,
    initializeGame,
    testDeterminism
};
