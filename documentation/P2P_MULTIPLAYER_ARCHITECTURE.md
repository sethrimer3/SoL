# Multiplayer Architecture

## Overview

SoL's multiplayer backend is built on **Colyseus**.

### System Architecture
- **Client**: Deterministic RTS simulation with seeded RNG, local persistent player identity, and `ColyseusTransport` implementing `ITransport`.
- **Server**: Colyseus server with `SoLRoom` managing room creation, joining, match metadata, synchronized start, and command relay.
