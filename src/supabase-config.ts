/**
 * Supabase Configuration
 * Configuration for online multiplayer using Supabase
 */

/**
 * Supabase configuration interface
 */
export interface SupabaseConfig {
    url: string;
    anonKey: string;
}

/**
 * Get Supabase configuration from environment or defaults
 * In production, these should be set via environment variables or build-time configuration
 */
export function getSupabaseConfig(): SupabaseConfig {
    // Values are injected at build time via webpack DefinePlugin
    const url = process.env.SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';

    if (!url || !anonKey) {
        console.warn('Supabase credentials not configured. Online play will not be available.');
        console.warn('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }

    return {
        url,
        anonKey
    };
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
    const config = getSupabaseConfig();
    return !!config.url && !!config.anonKey;
}
