# SoL Multiplayer - Security Architecture

## Overview

This document outlines the security considerations and mitigations for SoL's Colyseus-backed deterministic multiplayer architecture.

## Trust Model & Architecture

### Current Implementation: Deterministic Lockstep with Colyseus Authority

- **Session Authority**: The Colyseus server (`SoLRoom`) is the sole authority for room creation, joining, match metadata, and synchronized start.
- **Command Relay**: All commands are routed through Colyseus (`ColyseusTransport`), allowing basic message structure and payload size validation on the server.
- **Command Integrity**: HMAC-SHA256 command signing prevents spoofing of commands by unauthorized peers.
- **Desync Detection**: Clients exchange periodic state hashes (`__state_hash__`) to detect desyncs and tampering.

### Security Layers

#### 1. Command Validation & Rate Limiting
- **Client & Server Validation**: `CommandValidator` and `SoLRoom` validate structure, non-negative tick numbers, sender identity, and maximum payload size (≤4KB).
- **Rate Limiting**: Limits per-player command frequency to prevent buffer exhaustion.

#### 2. Anti-Cheat via HMAC-SHA256 Signing
- **Key Derivation**: `CommandSigner.deriveKey(gameSeed)` deterministically derives a shared signing key from the match seed using the Web Crypto API.
- **Sign & Verify**: Each command carries a signature of `${tick}:${playerId}:${commandType}:${JSON.stringify(payload)}`.

#### 3. State Hash Verification
- **Cadence**: At regular tick intervals (`STATE_HASH_TICK_INTERVAL`), each client computes a hash of its simulation state and broadcasts it.
- **Desync Event**: `StateVerifier` triggers a `DESYNC_DETECTED` event if peer hashes differ.

## Future: Server-Authoritative Simulation
In future phases, the Colyseus server will run the full deterministic simulation headlessly to validate all game actions authoritatively without trusting client simulation state.
