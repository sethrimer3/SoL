# Online Multiplayer with Colyseus

## Overview

SoL's online multiplayer runtime is powered by **Colyseus**. The server acts as the session authority for room management and message relay, while clients run a deterministic lockstep RTS simulation.

## Architecture

### Client
- **Local Identity**: Persistent anonymous UUID via `getOrCreatePlayerId()`.
- **Deterministic Simulation**: Seeded RNG (`SeededRandom`), fixed-rate tick execution.
- **Command Pipeline**: Game commands queued in `CommandQueue` and executed deterministically.
- **Transport**: `ColyseusTransport` implementing `ITransport`.

### Server
- **`SoLRoom`**: In-memory Colyseus room authority.
- **Match Lifecycle**: Handles room creation, joining with human-friendly match codes, player ready states, and synchronized match start.
- **Relay**: Relays `GameCommand` batches and `StateHash` desync verification messages.
- **Reconnection**: Supports reconnect windows for dropped connections.

## Running Locally

1. Start the Colyseus server:
```bash
npm run server
```

2. Start the game client:
```bash
npm run dev
```

3. Open the game in your browser or desktop app and navigate to Multiplayer to host or join.
