/**
 * Example Integration: Online Play with Existing Game
 * This demonstrates how to integrate OnlineNetworkManager with the game
 */

import { OnlineNetworkManager } from './online-network';
import { NetworkEvent, MessageType, GameCommand } from './network';
import { isSupabaseConfigured } from './supabase-config';

/**
 * Example: Setting up online multiplayer in your game
 */
export class OnlinePlayExample {
    private networkManager: OnlineNetworkManager | null = null;
    private gameTickCounter: number = 0;

    constructor() {
        // Check if online play is available
        if (!isSupabaseConfigured()) {
            console.warn('Online play not configured. See SUPABASE_CONFIG.md for setup.');
            return;
        }
    }

    /**
     * Example: Host creates and starts a game
     */
    async hostGame(playerName: string): Promise<void> {
        // Initialize network manager with unique player ID
        const playerId = this.generatePlayerId();
        this.networkManager = new OnlineNetworkManager(playerId);

        // Create a room
        const room = await this.networkManager.createRoom(
            'My RTS Game',
            playerName,
            2 // Max 2 players for 1v1
        );

        if (!room) {
            console.error('Failed to create room');
            return;
        }

        console.log('Room created! Room ID:', room.id);
        console.log('Share this room ID with other players');

        // Listen for players joining
        this.networkManager.on(NetworkEvent.PLAYER_JOINED, (data) => {
            console.log('Player joined:', data);
            // Update lobby UI to show new player
        });

        // Listen for game commands from other players
        this.networkManager.on(NetworkEvent.MESSAGE_RECEIVED, (message) => {
            if (message.type === MessageType.GAME_COMMAND) {
                const command = message.data as GameCommand;
                this.executeGameCommand(command);
            }
        });

        // Wait for players to be ready, then start
        // (In actual implementation, this would be triggered by UI button)
        await this.waitForPlayers();
        await this.networkManager.startGame();

        // Begin game loop
        this.startGameLoop();
    }

    /**
     * Example: Client joins an existing game
     */
    async joinGame(roomId: string, playerName: string): Promise<void> {
        const playerId = this.generatePlayerId();
        this.networkManager = new OnlineNetworkManager(playerId);

        // Join the room
        const success = await this.networkManager.joinRoom(roomId, playerName);
        if (!success) {
            console.error('Failed to join room');
            return;
        }

        console.log('Joined room successfully!');

        // Set ready status
        await this.networkManager.setReady(true);

        // Listen for game commands
        this.networkManager.on(NetworkEvent.MESSAGE_RECEIVED, (message) => {
            if (message.type === MessageType.GAME_START) {
                console.log('Game starting!');
                this.startGameLoop();
            } else if (message.type === MessageType.GAME_COMMAND) {
                const command = message.data as GameCommand;
                this.executeGameCommand(command);
            }
        });
    }

    /**
     * Example: Browse and list available games
     */
    async listAvailableGames(): Promise<void> {
        if (!this.networkManager) {
            const playerId = this.generatePlayerId();
            this.networkManager = new OnlineNetworkManager(playerId);
        }

        const rooms = await this.networkManager.listRooms();
        console.log('Available rooms:', rooms);

        // Display rooms in UI
        rooms.forEach(room => {
            console.log(`- ${room.name} (${room.id}) - Host: ${room.host_id}`);
        });

        return;
    }

    /**
     * Example: Send a player command
     */
    async sendPlayerCommand(commandType: string, commandData: any): Promise<void> {
        if (!this.networkManager) {
            console.warn('Not connected to online game');
            return;
        }

        const command: GameCommand = {
            tick: this.gameTickCounter,
            playerId: this.networkManager.getLocalPlayerId(),
            command: commandType,
            data: commandData
        };

        // Send command to all players
        await this.networkManager.sendGameCommand(command);

        // Also execute locally for immediate feedback
        this.executeGameCommand(command);
    }

    /**
     * Example: Batch send multiple commands (more efficient)
     */
    async sendMultipleCommands(commands: Array<{ type: string, data: any }>): Promise<void> {
        if (!this.networkManager) return;

        const gameCommands: GameCommand[] = commands.map(cmd => ({
            tick: this.gameTickCounter,
            playerId: this.networkManager!.getLocalPlayerId(),
            command: cmd.type,
            data: cmd.data
        }));

        // Send all commands in one batch (saves bandwidth)
        await this.networkManager.sendCommandBatch(gameCommands);

        // Execute locally
        gameCommands.forEach(cmd => this.executeGameCommand(cmd));
    }

    /**
     * Example: Game loop that sends periodic updates
     */
    private startGameLoop(): void {
        // This would be integrated with your existing game loop
        setInterval(() => {
            this.gameTickCounter++;

            // Example: Send unit movement command
            // In real implementation, this would be triggered by user input
            if (Math.random() < 0.1) { // 10% chance per tick
                this.sendPlayerCommand('unit_move', {
                    unitType: 'Starling',
                    targetX: Math.random() * 800,
                    targetY: Math.random() * 600
                });
            }
        }, 50); // 20 updates per second
    }

    /**
     * Example: Execute a command in the game
     */
    private executeGameCommand(command: GameCommand): void {
        console.log(`Executing command at tick ${command.tick}:`, command.command);

        // This is where you'd integrate with your actual game logic
        switch (command.command) {
            case 'unit_move':
                // Move units to target position
                console.log('Moving units to', command.data);
                break;

            case 'hero_purchase':
                // Purchase hero unit
                console.log('Purchasing hero', command.data);
                break;

            case 'mirror_move':
                // Move solar mirrors
                console.log('Moving mirrors', command.data);
                break;

            // Add more command types as needed
        }
    }

    /**
     * Example: Wait for players to be ready
     */
    private async waitForPlayers(): Promise<void> {
        // In real implementation, check player ready status
        return new Promise((resolve) => {
            setTimeout(resolve, 2000); // Simulate waiting
        });
    }

    /**
     * Generate unique player ID using crypto API
     */
    private generatePlayerId(): string {
        // Use crypto.randomUUID() if available (modern browsers)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `player_${crypto.randomUUID()}`;
        }
        // Fallback for older environments
        return `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    /**
     * Example: Clean up when leaving game
     */
    async disconnect(): Promise<void> {
        if (this.networkManager) {
            await this.networkManager.disconnect();
            this.networkManager = null;
        }
    }
}

/**
 * Usage Example:
 * 
 * // Host a game
 * const game = new OnlinePlayExample();
 * await game.hostGame('PlayerOne');
 * 
 * // Or join a game
 * const game2 = new OnlinePlayExample();
 * await game2.joinGame('room-id-here', 'PlayerTwo');
 * 
 * // List available games
 * await game.listAvailableGames();
 * 
 * // Send commands during gameplay
 * await game.sendPlayerCommand('unit_move', { x: 100, y: 200 });
 * 
 * // Clean up
 * await game.disconnect();
 */
