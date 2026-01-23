/**
 * SoL (Speed of Light) - Core Game Module
 * A 2D real-time strategy game with light-based mechanics
 */

/**
 * Three playable factions in the game
 */
export enum Faction {
    RADIANT = "Radiant",
    AURUM = "Aurum",
    SOLARI = "Solari"
}

/**
 * 2D position/direction vector
 */
export class Vector2D {
    constructor(public x: number, public y: number) {}

    /**
     * Calculate distance to another vector
     */
    distanceTo(other: Vector2D): number {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    /**
     * Return normalized vector
     */
    normalize(): Vector2D {
        const magnitude = Math.sqrt(this.x ** 2 + this.y ** 2);
        if (magnitude === 0) {
            return new Vector2D(0, 0);
        }
        return new Vector2D(this.x / magnitude, this.y / magnitude);
    }
}

/**
 * Represents a ray of light for ray tracing
 */
export class LightRay {
    constructor(
        public origin: Vector2D,
        public direction: Vector2D,
        public intensity: number = 1.0
    ) {}

    /**
     * Check if ray intersects with a circular object
     * TODO: Implement full ray-circle intersection algorithm
     */
    intersects(position: Vector2D, radius: number): boolean {
        // Placeholder - needs ray tracing implementation
        return true;
    }
}

/**
 * Solar Mirror - reflects light to generate Solarium
 */
export class SolarMirror {
    health: number = 100.0;
    efficiency: number = 1.0; // 0.0 to 1.0

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Check if mirror has clear view of any light source
     * TODO: Implement ray tracing to check for obstacles blocking light
     */
    hasLineOfSightToLight(lightSources: Sun[]): boolean {
        // Placeholder - needs ray casting
        return lightSources.length > 0;
    }

    /**
     * Check if mirror has clear path to Stellar Forge
     * TODO: Implement collision detection with obstacles
     */
    hasLineOfSightToForge(forge: StellarForge, obstacles: any[]): boolean {
        // Placeholder - needs collision detection
        return true;
    }

    /**
     * Generate Solarium based on light received
     */
    generateSolarium(deltaTime: number): number {
        const baseGenerationRate = 10.0; // Sol per second
        return baseGenerationRate * this.efficiency * deltaTime;
    }
}

/**
 * Stellar Forge - Main base that produces units
 */
export class StellarForge {
    health: number = 1000.0;
    isReceivingLight: boolean = false;
    unitQueue: string[] = [];

    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Check if forge can produce units (needs light)
     */
    canProduceUnits(): boolean {
        return this.isReceivingLight && this.health > 0;
    }

    /**
     * Attempt to produce a unit
     */
    produceUnit(unitType: string, cost: number, playerSolarium: number): boolean {
        if (!this.canProduceUnits()) {
            return false;
        }
        if (playerSolarium < cost) {
            return false;
        }
        this.unitQueue.push(unitType);
        return true;
    }

    /**
     * Update whether forge is receiving light from mirrors
     */
    updateLightStatus(mirrors: SolarMirror[], suns: Sun[]): void {
        this.isReceivingLight = false;
        for (const mirror of mirrors) {
            if (mirror.hasLineOfSightToLight(suns) &&
                mirror.hasLineOfSightToForge(this, [])) {
                this.isReceivingLight = true;
                break;
            }
        }
    }
}

/**
 * Sun/Star - Light source
 */
export class Sun {
    constructor(
        public position: Vector2D,
        public intensity: number = 1.0,
        public radius: number = 100.0
    ) {}

    /**
     * Emit a light ray in specified direction
     */
    emitLight(direction: Vector2D): LightRay {
        return new LightRay(this.position, direction, this.intensity);
    }
}

/**
 * Player in the game
 */
export class Player {
    solarium: number = 100.0; // Starting currency
    stellarForge: StellarForge | null = null;
    solarMirrors: SolarMirror[] = [];
    units: any[] = [];

    constructor(
        public name: string,
        public faction: Faction
    ) {}

    /**
     * Check if player is defeated
     */
    isDefeated(): boolean {
        return this.stellarForge === null || this.stellarForge.health <= 0;
    }

    /**
     * Add Solarium to player's resources
     */
    addSolarium(amount: number): void {
        this.solarium += amount;
    }

    /**
     * Attempt to spend Solarium
     */
    spendSolarium(amount: number): boolean {
        if (this.solarium >= amount) {
            this.solarium -= amount;
            return true;
        }
        return false;
    }
}

/**
 * Main game state
 */
export class GameState {
    players: Player[] = [];
    suns: Sun[] = [];
    gameTime: number = 0.0;
    isRunning: boolean = false;

    /**
     * Update game state
     */
    update(deltaTime: number): void {
        this.gameTime += deltaTime;

        // Update each player
        for (const player of this.players) {
            if (player.isDefeated()) {
                continue;
            }

            // Update light status for Stellar Forge
            if (player.stellarForge) {
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns);
            }

            // Generate Solarium from mirrors
            for (const mirror of player.solarMirrors) {
                if (mirror.hasLineOfSightToLight(this.suns) &&
                    player.stellarForge &&
                    mirror.hasLineOfSightToForge(player.stellarForge, [])) {
                    const solariumGenerated = mirror.generateSolarium(deltaTime);
                    player.addSolarium(solariumGenerated);
                }
            }
        }
    }

    /**
     * Check if any player has won
     */
    checkVictoryConditions(): Player | null {
        const activePlayers = this.players.filter(p => !p.isDefeated());
        if (activePlayers.length === 1) {
            return activePlayers[0];
        }
        return null;
    }

    /**
     * Initialize a player with starting structures
     */
    initializePlayer(player: Player, forgePosition: Vector2D, mirrorPositions: Vector2D[]): void {
        // Create Stellar Forge
        player.stellarForge = new StellarForge(forgePosition, player);

        // Create starting Solar Mirrors
        for (const pos of mirrorPositions) {
            const mirror = new SolarMirror(pos, player);
            player.solarMirrors.push(mirror);
        }
    }
}

/**
 * Create a standard game setup
 */
export function createStandardGame(playerNames: Array<[string, Faction]>): GameState {
    const game = new GameState();

    // Add sun at center
    game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));

    // Create players with starting positions
    const startingPositions: Array<[Vector2D, Vector2D[]]> = [
        [new Vector2D(-500, 0), [new Vector2D(-450, 0), new Vector2D(-400, 0)]],
        [new Vector2D(500, 0), [new Vector2D(450, 0), new Vector2D(400, 0)]],
    ];

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= startingPositions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
        const [forgePos, mirrorPositions] = startingPositions[i];
        game.initializePlayer(player, forgePos, mirrorPositions);
        game.players.push(player);
    }

    game.isRunning = true;
    return game;
}
