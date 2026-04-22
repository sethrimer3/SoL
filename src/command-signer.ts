/**
 * Command Signer - HMAC-SHA256 signing for anti-cheat
 *
 * Both players share a deterministic signing key derived from the match seed,
 * so neither party needs to exchange a secret over the network.
 *
 * The input message that is signed:
 *   `${tick}:${playerId}:${commandType}:${JSON.stringify(payload)}`
 *
 * This prevents:
 *   - Replaying commands from previous ticks
 *   - Spoofing another player's commands
 *   - Injecting unsigned commands
 */

import { GameCommand } from './transport';

/**
 * HMAC-SHA256 command signing utility.
 * Uses the Web Crypto API (available in modern browsers and Node.js 15+).
 */
export class CommandSigner {
    /**
     * Derive a shared HMAC-SHA256 signing key from the match seed.
     * Both host and client call this with the same seed, producing an identical key.
     *
     * @param matchSeed - Integer match seed (game_seed column from Supabase)
     * @returns CryptoKey suitable for HMAC sign/verify operations
     */
    static async deriveKey(matchSeed: number): Promise<CryptoKey> {
        // Encode the seed as a UTF-8 byte array so crypto.subtle can import it
        const encoder = new TextEncoder();
        const keyMaterial = encoder.encode(`sol-match-seed:${matchSeed}`);

        return crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'HMAC', hash: 'SHA-256' },
            false,  // not extractable
            ['sign', 'verify']
        );
    }

    /**
     * Build the canonical message string for a command.
     * Deterministic — same command always produces the same string.
     */
    private static buildMessage(command: GameCommand): string {
        return `${command.tick}:${command.playerId}:${command.commandType}:${JSON.stringify(command.payload)}`;
    }

    /**
     * Sign a command using the shared HMAC key.
     *
     * @param command - The command to sign (payload must be JSON-serialisable)
     * @param key     - CryptoKey returned by deriveKey()
     * @returns Hex-encoded signature string
     */
    static async sign(command: GameCommand, key: CryptoKey): Promise<string> {
        const encoder = new TextEncoder();
        const message = encoder.encode(CommandSigner.buildMessage(command));

        const signatureBuffer = await crypto.subtle.sign('HMAC', key, message);

        // Convert ArrayBuffer to hex string
        const bytes = new Uint8Array(signatureBuffer);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    /**
     * Verify a command's signature.
     *
     * @param command   - The command to verify
     * @param signature - Hex-encoded signature string (from command.signature)
     * @param key       - CryptoKey returned by deriveKey()
     * @returns true if the signature is valid, false otherwise
     */
    static async verify(command: GameCommand, signature: string, key: CryptoKey): Promise<boolean> {
        try {
            // Convert hex string back to ArrayBuffer
            const bytes = new Uint8Array(signature.length / 2);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(signature.slice(i * 2, i * 2 + 2), 16);
            }

            const encoder = new TextEncoder();
            const message = encoder.encode(CommandSigner.buildMessage(command));

            return crypto.subtle.verify('HMAC', key, bytes.buffer, message);
        } catch (error) {
            console.error('[CommandSigner] Verification failed:', error);
            return false;
        }
    }
}
