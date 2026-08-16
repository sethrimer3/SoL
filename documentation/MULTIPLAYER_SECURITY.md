# SoL Multiplayer - Security Architecture

## Overview

This document outlines the security model, trust boundary, and mitigations for SoL's Colyseus-backed deterministic multiplayer architecture.

## Trust Model & Architecture

### Phase 1: Deterministic Lockstep with Colyseus Session Authority

In Phase 1, game simulation runs deterministically on all connected clients. The Colyseus server (`SoLRoom`) acts as the authoritative gatekeeper for match sessions:

- **Session-to-Player Ownership**: The Colyseus server securely binds each WebSocket connection (`client.sessionId`) to that client's authenticated `playerId`. Clients cannot send commands claiming to originate from other players.
- **Server-Side Command Gatekeeping**: `SoLRoom` inspects every incoming command (single or batched). If `command.playerId !== sessionPlayerId`, or if the payload is oversized (>4KB), or if the tick is invalid/negative, the server rejects the command immediately without broadcasting it to peers.
- **Desync & Tampering Detection**: Clients periodically compute a hash of their deterministic simulation state and relay it via `ProtocolMessage.STATE_HASH`. `StateVerifier` alerts players immediately if simulation states diverge.

### Security Layers (Phase 1)

#### 1. Server Session Ownership & Sender Authentication
- The Colyseus WebSocket connection is the identity boundary.
- Server validates:
  - `command.playerId === expectedPlayerId` (enforced per connection)
  - `command.tick >= 0` and is an integer
  - `command.commandType` is a non-empty string
  - `command.payload` length does not exceed 4096 bytes
  - `batch.commands` length does not exceed 100

#### 2. Client Command Validation & Rate Limiting
- `CommandValidator` validates structure, tick timestamps, payload sizes, and per-player rate limits (≤100 commands/tick) to prevent queue exhaustion.

#### 3. State Hash Verification
- At fixed tick intervals, each client computes a hash of its simulation state and broadcasts it via `SoLRoom`.
- `StateVerifier` triggers a `DESYNC_DETECTED` event if peer hashes differ, identifying desynchronization or client-side tampering.

---

### Phase 2 Roadmap: Server-Authoritative Simulation

In Phase 2, the Colyseus server will execute a headless instance of the deterministic simulation directly in Node.js:
- **Authoritative Game Rules**: The server will simulate unit movements, combat, economy, and construction legality authoritatively.
- **Fog-of-War Enforcement**: The server will filter state updates so clients only receive information within their units' line of sight, preventing maphack exploits.
