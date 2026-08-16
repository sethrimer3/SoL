# Security Summary

## Overview

SoL uses a secure deterministic lockstep multiplayer architecture with Colyseus as session authority.

### Security Highlights (Phase 1)
- **Colyseus Room Authority**: All match state, joins, member lists, and starts managed authoritatively in memory by `SoLRoom`.
- **Session-to-Player Ownership**: The server authoritatively maps WebSocket connections to `playerId`. Commands claiming a mismatched sender are rejected.
- **Message Validation**: `SoLRoom` validates sender ID, non-negative tick numbers, command structure, and max payload sizes (≤4KB).
- **Desync Detection**: Real-time state verification hash exchange via `StateVerifier`.

### Future Security (Phase 2 Roadmap)
- **Authoritative Simulation**: Headless server simulation for authoritatively validating movement, economy, and fog-of-war.
