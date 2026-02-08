/**
 * Seeded Random Number Generator (RNG)
 * 
 * DETERMINISM REQUIREMENT:
 * All randomness in the game MUST use this seeded RNG, never Math.random().
 * This ensures identical sequences across all clients for the same seed.
 * 
 * Implementation: Mulberry32 algorithm (fast, high-quality PRNG)
 * Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */

export class SeededRandom {
    private state: number;
    private readonly initialSeed: number;

    /**
     * Create a new seeded random number generator
     * @param seed - Integer seed value (0 to 2^32-1)
     */
    constructor(seed: number) {
        // Ensure seed is a valid 32-bit unsigned integer
        this.initialSeed = seed >>> 0;
        this.state = this.initialSeed;
    }

    /**
     * Get the initial seed used to create this RNG
     */
    getSeed(): number {
        return this.initialSeed;
    }

    /**
     * Reset RNG to initial seed
     * WARNING: Only use this for debugging/testing. In production, create a new RNG instance.
     */
    reset(): void {
        this.state = this.initialSeed;
    }

    /**
     * Generate next random number in sequence [0, 1)
     * This is the core PRNG using Mulberry32 algorithm
     */
    next(): number {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Generate random integer in range [min, max] (inclusive)
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Generate random float in range [min, max)
     */
    nextFloat(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    /**
     * Generate random boolean with given probability of true
     * @param probability - Probability of returning true (0.0 to 1.0)
     */
    nextBool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /**
     * Randomly select element from array
     */
    choice<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[this.nextInt(0, array.length - 1)];
    }

    /**
     * Shuffle array in place (Fisher-Yates shuffle)
     * Returns the same array for convenience
     */
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate random angle in radians [0, 2π)
     */
    nextAngle(): number {
        return this.next() * Math.PI * 2;
    }

    /**
     * Generate random point on unit circle
     */
    nextUnitCircle(): { x: number; y: number } {
        const angle = this.nextAngle();
        return {
            x: Math.cos(angle),
            y: Math.sin(angle)
        };
    }

    /**
     * Generate random point in unit circle (uniform distribution)
     */
    nextInUnitCircle(): { x: number; y: number } {
        const angle = this.nextAngle();
        const radius = Math.sqrt(this.next()); // sqrt for uniform distribution
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    }
}

/**
 * Global RNG instance for gameplay
 * This should be initialized with the game seed at match start
 * 
 * USAGE:
 * - Initialize at match start: setGameRNG(new SeededRandom(matchSeed))
 * - Use in game code: gameRNG.next(), gameRNG.nextInt(), etc.
 * - NEVER use Math.random() for gameplay logic
 */
let gameRNGInstance: SeededRandom | null = null;

/**
 * Set the global game RNG instance
 * Should be called once at match start with the match seed
 */
export function setGameRNG(rng: SeededRandom): void {
    gameRNGInstance = rng;
}

/**
 * Get the global game RNG instance
 * Throws error if not initialized (fail-fast for determinism safety)
 */
export function getGameRNG(): SeededRandom {
    if (!gameRNGInstance) {
        throw new Error('Game RNG not initialized. Call setGameRNG() with match seed before using.');
    }
    return gameRNGInstance;
}

/**
 * Check if game RNG is initialized
 */
export function isGameRNGInitialized(): boolean {
    return gameRNGInstance !== null;
}

/**
 * Utility: Generate a match seed from timestamp (for host)
 * Uses current time to create unique but reproducible seed
 */
export function generateMatchSeed(): number {
    // Use current timestamp as base, ensure it's a valid 32-bit integer
    return (Date.now() % 0xFFFFFFFF) >>> 0;
}
