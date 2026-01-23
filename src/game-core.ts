/**
 * SoL (Speed of Light) - Core Game Module
 * A 2D real-time strategy game with light-based mechanics
 */

import * as Constants from './constants';

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
 * Space dust particle that gets affected by influences and forces
 */
export class SpaceDustParticle {
    velocity: Vector2D;
    baseColor: string = '#888888'; // Gray by default
    currentColor: string = '#888888';
    
    constructor(
        public position: Vector2D,
        velocity?: Vector2D
    ) {
        // Initialize with very slow random velocity
        if (velocity) {
            this.velocity = velocity;
        } else {
            this.velocity = new Vector2D(
                (Math.random() - 0.5) * 2,  // -1 to 1
                (Math.random() - 0.5) * 2
            );
        }
    }

    /**
     * Update particle position based on velocity
     */
    update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Apply friction to gradually slow down
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
    }

    /**
     * Apply force to particle (from units or attacks)
     */
    applyForce(force: Vector2D): void {
        this.velocity.x += force.x;
        this.velocity.y += force.y;
    }

    /**
     * Update color based on influence
     */
    updateColor(influenceColor: string | null, blendFactor: number): void {
        if (influenceColor && blendFactor > 0) {
            // Blend from gray to influence color
            this.currentColor = this.blendColors(this.baseColor, influenceColor, blendFactor);
        } else {
            this.currentColor = this.baseColor;
        }
    }

    /**
     * Blend two hex colors
     */
    private blendColors(color1: string, color2: string, factor: number): string {
        // Validate hex color format
        if (!color1 || !color2 || !color1.startsWith('#') || !color2.startsWith('#')) {
            return this.baseColor;
        }
        
        // Simple hex color blending
        const c1 = parseInt(color1.slice(1), 16);
        const c2 = parseInt(color2.slice(1), 16);
        
        if (isNaN(c1) || isNaN(c2)) {
            return this.baseColor;
        }
        
        const r1 = (c1 >> 16) & 0xff;
        const g1 = (c1 >> 8) & 0xff;
        const b1 = c1 & 0xff;
        
        const r2 = (c2 >> 16) & 0xff;
        const g2 = (c2 >> 8) & 0xff;
        const b2 = c2 & 0xff;
        
        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);
        
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}

/**
 * Warp gate being conjured by player
 */
export class WarpGate {
    chargeTime: number = 0;
    isCharging: boolean = false;
    isComplete: boolean = false;
    health: number = 100;
    hasEmittedShockwave: boolean = false; // Track if shockwave was emitted
    
    constructor(
        public position: Vector2D,
        public owner: Player
    ) {}

    /**
     * Update warp gate charging
     */
    update(deltaTime: number, isStillHolding: boolean): void {
        if (!this.isCharging || this.isComplete) {
            return;
        }

        if (!isStillHolding) {
            // Player let go, cancel the warp gate
            this.cancel();
            return;
        }

        this.chargeTime += deltaTime;

        // Check if fully charged
        if (this.chargeTime >= Constants.WARP_GATE_CHARGE_TIME) {
            this.isComplete = true;
            this.isCharging = false;
        }
    }

    /**
     * Start charging the warp gate
     */
    startCharging(): void {
        this.isCharging = true;
        this.chargeTime = 0;
    }

    /**
     * Take damage and potentially dissipate
     */
    takeDamage(amount: number): boolean {
        this.health -= amount;
        if (this.health <= 0) {
            this.cancel();
            return true; // Gate destroyed
        }
        return false;
    }

    /**
     * Cancel/dissipate the warp gate
     */
    cancel(): void {
        this.isCharging = false;
        this.isComplete = false;
        // Scatter particles will be handled in game state
    }

    /**
     * Check if shockwave should be emitted (at 1 second mark)
     */
    shouldEmitShockwave(): boolean {
        if (this.hasEmittedShockwave) {
            return false;
        }
        if (this.chargeTime >= 1.0) {
            this.hasEmittedShockwave = true;
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
    spaceDust: SpaceDustParticle[] = [];
    warpGates: WarpGate[] = [];
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

        // Update space dust particles
        this.updateSpaceDust(deltaTime);
    }

    /**
     * Update space dust particles with physics and color influences
     */
    private updateSpaceDust(deltaTime: number): void {
        for (const particle of this.spaceDust) {
            // Update particle position
            particle.update(deltaTime);

            // Check for influence from player bases
            let closestInfluence: { color: string, distance: number } | null = null;

            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (player.stellarForge && !player.isDefeated()) {
                    const distance = particle.position.distanceTo(player.stellarForge.position);
                    
                    if (distance < Constants.INFLUENCE_RADIUS) {
                        const color = i === 0 ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                        if (!closestInfluence || distance < closestInfluence.distance) {
                            closestInfluence = { color, distance };
                        }
                    }
                }
            }

            // Update particle color based on influence
            if (closestInfluence) {
                const blendFactor = 1.0 - (closestInfluence.distance / Constants.INFLUENCE_RADIUS);
                particle.updateColor(closestInfluence.color, blendFactor);
            } else {
                particle.updateColor(null, 0);
            }
        }

        // Apply forces from warp gates (spiral effect)
        for (const gate of this.warpGates) {
            if (gate.isCharging && gate.chargeTime >= Constants.WARP_GATE_INITIAL_DELAY) {
                for (const particle of this.spaceDust) {
                    const distance = particle.position.distanceTo(gate.position);
                    if (distance < Constants.WARP_GATE_SPIRAL_RADIUS && distance > Constants.WARP_GATE_SPIRAL_MIN_DISTANCE) {
                        // Calculate spiral force
                        const direction = new Vector2D(
                            gate.position.x - particle.position.x,
                            gate.position.y - particle.position.y
                        ).normalize();
                        
                        // Add tangential component for spiral
                        const tangent = new Vector2D(-direction.y, direction.x);
                        const force = new Vector2D(
                            direction.x * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.x * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT,
                            direction.y * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.y * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT
                        );
                        
                        particle.applyForce(new Vector2D(
                            force.x * deltaTime / distance,
                            force.y * deltaTime / distance
                        ));
                    }
                }
            }
        }
    }

    /**
     * Initialize space dust particles
     */
    initializeSpaceDust(count: number, width: number, height: number): void {
        this.spaceDust = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * height;
            this.spaceDust.push(new SpaceDustParticle(new Vector2D(x, y)));
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

    // Initialize space dust particles
    game.initializeSpaceDust(1000, 2000, 2000);

    game.isRunning = true;
    return game;
}
