/**
 * Procedural noise generation utilities
 * Pure mathematical functions for noise-based effects (starfield, nebula, etc.)
 */

/**
 * 2D value noise function using smoothstep interpolation
 * Generates pseudo-random noise values based on 2D coordinates
 * 
 * @param x - X coordinate in noise space
 * @param y - Y coordinate in noise space
 * @returns Noise value in range [0, 1]
 */
export function valueNoise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const smooth = (v: number) => v * v * (3 - 2 * v);
    const hash = (hx: number, hy: number) => {
        let n = hx * 374761393 + hy * 668265263;
        n = (n ^ (n >> 13)) * 1274126177;
        n ^= n >> 16;
        return (n >>> 0) / 4294967295;
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const v00 = hash(ix, iy);
    const v10 = hash(ix + 1, iy);
    const v01 = hash(ix, iy + 1);
    const v11 = hash(ix + 1, iy + 1);
    const ux = smooth(fx);
    const uy = smooth(fy);

    return lerp(lerp(v00, v10, ux), lerp(v01, v11, ux), uy);
}

/**
 * Fractal (multi-octave) 2D noise using value noise
 * Combines multiple octaves of noise for more complex patterns
 * 
 * @param x - X coordinate in noise space
 * @param y - Y coordinate in noise space
 * @param octaves - Number of noise octaves to combine
 * @returns Normalized fractal noise value in range [0, 1]
 */
export function fractalNoise2D(x: number, y: number, octaves: number): number {
    let amplitude = 0.5;
    let frequency = 1;
    let value = 0;
    let norm = 0;

    for (let i = 0; i < octaves; i++) {
        value += valueNoise2D(x * frequency, y * frequency) * amplitude;
        norm += amplitude;
        frequency *= 2;
        amplitude *= 0.5;
    }

    return value / Math.max(0.0001, norm);
}
