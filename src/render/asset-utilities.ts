/**
 * Asset path resolution utilities
 * Pure functions for handling asset paths and URLs
 */

/**
 * Resolve asset path based on build context
 * Adjusts path for distribution builds vs development builds
 * 
 * @param path - Asset path to resolve
 * @returns Resolved path with proper prefix for current build context
 */
export function resolveAssetPath(path: string): string {
    if (!path.startsWith('ASSETS/')) {
        return path;
    }
    // Check if running from dist directory
    const isDistBuild = typeof window !== 'undefined' && 
                        window.location.pathname.includes('/dist/');
    return isDistBuild ? `../${path}` : path;
}
