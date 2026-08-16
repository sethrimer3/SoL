# Colyseus Multiplayer - Quick Start Guide

## Overview

SoL uses **Colyseus** as its multiplayer backend and session authority with a **deterministic lockstep** client simulation.

## Key Features

✅ **Colyseus Session Authority**: Room lifecycle, membership, matchmaking, synchronized match start  
✅ **Deterministic Simulation**: Fixed timestep, seeded RNG, command-based synchronization  
✅ **Transport Abstraction**: `ColyseusTransport` implements `ITransport`  
✅ **Anti-Cheat & Verification**: HMAC-SHA256 command signing and periodic state hash verification  
✅ **Zero Database Dependency**: Pure in-memory room management  

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Colyseus Server
```bash
npm run server
```
Server runs on `ws://localhost:2567`.

### 3. Start Client Dev Server
```bash
npm run dev
```

## Usage Examples

### Initialize Network Manager

```typescript
import { MultiplayerNetworkManager, NetworkEvent } from './multiplayer';

const network = new MultiplayerNetworkManager('ws://localhost:2567');
```

### Host a Match

```typescript
const match = await network.createMatch({
    matchName: "My Game",
    username: "Player1",
    maxPlayers: 2,
    tickRate: 30
});

console.log("Match Code:", match.matchCode);
// Share match code with other players
```

### Join a Match

```typescript
await network.joinMatch(matchCode, "Player2");
```

### Start Match & Play

```typescript
// Setup event listeners
network.on(NetworkEvent.CONNECTED, () => {
    console.log("Connected to match room!");
});

network.on(NetworkEvent.MATCH_STARTED, (data) => {
    console.log("Game starting with seed:", data.seed);
    // Initialize simulation with deterministic seed
});

// Host starts match
await network.startMatch();
```

### In-Game Command Loop

```typescript
// Send command on user input
network.sendCommand('unit_move', { unitId: 5, targetX: 100, targetY: 200 });

// Process commands in deterministic game loop
function onTick() {
    const commands = network.getNextTickCommands();
    if (commands) {
        game.executeCommands(commands);
        network.advanceTick();
        
        // Submit state hash periodically
        if (network.getCurrentTick() % 100 === 0) {
            network.submitStateHash(game.stateHash);
        }
        
        game.update(1 / 30);
    }
}
```
