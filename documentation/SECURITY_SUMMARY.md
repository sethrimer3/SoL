# Security Summary

## Overview

SoL uses a secure deterministic lockstep multiplayer architecture with Colyseus.

### Security Highlights
- **Colyseus Room Authority**: All match state, joins, and starts verified in memory.
- **Message Validation**: `SoLRoom` validates sender ID, tick numbers, command structure, and max payload sizes.
- **HMAC Command Signing**: Web Crypto HMAC-SHA256 signatures derived deterministically from match seed.
- **Desync Detection**: Real-time state verification hash exchange.
