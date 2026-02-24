/**
 * Color manipulation utilities for rendering
 * Pure functions for color transformations and adjustments
 */

/**
 * Convert any hex or rgb(a) color to an rgba string with the given alpha value.
 * @param color - Hex (#RRGGBB) or rgb/rgba color string
 * @param alpha - Alpha value between 0 and 1
 * @returns rgba color string
 */
export function withAlpha(color: string, alpha: number): string {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 6) {
            const r = Number.parseInt(hex.slice(0, 2), 16);
            const g = Number.parseInt(hex.slice(2, 4), 16);
            const b = Number.parseInt(hex.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
        }
    }

    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
    if (rgbaMatch) {
        const components = rgbaMatch[1].split(',').map(component => component.trim());
        if (components.length >= 3) {
            return `rgba(${components[0]}, ${components[1]}, ${components[2]}, ${Math.max(0, Math.min(1, alpha))})`;
        }
    }

    return color;
}

/**
 * Darken a hex color by a given factor
 * @param color - Hex color string (#RGB or #RRGGBB)
 * @param factor - Darkening factor (0 = black, 1 = original color)
 * @returns Darkened hex color string
 */
export function darkenColor(color: string, factor: number): string {
    // Clamp factor to valid range [0, 1]
    const clampedFactor = Math.max(0, Math.min(1, factor));
    
    // Parse hex color (handle both #RGB and #RRGGBB formats)
    let hex = color.replace('#', '');
    if (hex.length === 3) {
        // Convert #RGB to #RRGGBB
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    // Apply darkening factor and clamp to valid RGB range
    const newR = Math.floor(Math.min(255, r * clampedFactor));
    const newG = Math.floor(Math.min(255, g * clampedFactor));
    const newB = Math.floor(Math.min(255, b * clampedFactor));
    
    // Convert back to hex
    return '#' + 
           newR.toString(16).padStart(2, '0') +
           newG.toString(16).padStart(2, '0') +
           newB.toString(16).padStart(2, '0');
}

/**
 * Adjust color brightness by a given factor
 * @param color - Hex color string (#RGB or #RRGGBB)
 * @param factor - Brightness factor (1.0 = original, >1.0 = brighter, <1.0 = darker)
 * @returns Adjusted hex color string
 */
export function adjustColorBrightness(color: string, factor: number): string {
    // Parse hex color (handle both #RGB and #RRGGBB formats)
    let hex = color.replace('#', '');
    if (hex.length === 3) {
        // Convert #RGB to #RRGGBB
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    // Apply brightening factor and clamp to valid RGB range
    const newR = Math.floor(Math.min(255, r * factor));
    const newG = Math.floor(Math.min(255, g * factor));
    const newB = Math.floor(Math.min(255, b * factor));
    
    // Convert back to hex
    return '#' + 
           newR.toString(16).padStart(2, '0') +
           newG.toString(16).padStart(2, '0') +
           newB.toString(16).padStart(2, '0');
}

/**
 * Brighten and pale a color (make it lighter and more desaturated)
 * Used for solar mirrors to make them slightly brighter and paler than player color
 * @param color - Hex color string (#RGB or #RRGGBB)
 * @returns Brightened and paled hex color string
 */
export function brightenAndPaleColor(color: string): string {
    // Parse hex color
    let hex = color.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    // Brighten: move towards white by 20%
    const brightenFactor = 0.2;
    const brightenedR = r + (255 - r) * brightenFactor;
    const brightenedG = g + (255 - g) * brightenFactor;
    const brightenedB = b + (255 - b) * brightenFactor;
    
    // Pale (desaturate): move towards average (gray) by 15%
    const avg = (brightenedR + brightenedG + brightenedB) / 3;
    const paleFactor = 0.15;
    const newR = Math.floor(brightenedR + (avg - brightenedR) * paleFactor);
    const newG = Math.floor(brightenedG + (avg - brightenedG) * paleFactor);
    const newB = Math.floor(brightenedB + (avg - brightenedB) * paleFactor);
    
    return '#' + 
           newR.toString(16).padStart(2, '0') +
           newG.toString(16).padStart(2, '0') +
           newB.toString(16).padStart(2, '0');
}
