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

let hasLoggedMissingSupabaseCredentials = false;
const HARDCODED_SUPABASE_URL = 'https://ixweicxojgtcpajnfrww.supabase.co';
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4d2VpY3hvamd0Y3Bham5mcnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTU4MzEsImV4cCI6MjA4NjE3MTgzMX0.ZuChgOFQf-ouThReLwlqAj3ZzcvZF8r0b78bu_CQcVc';

/**
 * Get hard-coded Supabase configuration
 */
export function getSupabaseConfig(): SupabaseConfig {
    const url = HARDCODED_SUPABASE_URL;
    const anonKey = HARDCODED_SUPABASE_ANON_KEY;

    if ((!url || !anonKey) && !hasLoggedMissingSupabaseCredentials) {
        console.warn('Supabase credentials not configured. Online play will not be available.');
        console.warn('Hard-coded Supabase credentials are missing.');
        hasLoggedMissingSupabaseCredentials = true;
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
