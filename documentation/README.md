# SoL - Speed of Light RTS

A 2D real-time strategy game set in space with unique light-based mechanics.

**Play it now:** [https://sethrimer3.github.io/SoL/](https://sethrimer3.github.io/SoL/)

## Overview

SoL is a cross-platform (mobile & desktop) RTS game where players battle for supremacy around stars using light as a resource. The game features ray-traced lighting, strategic positioning, and economy management based on solar energy collection.

## Core Concepts

### Factions
Three unique civilizations, each with distinct bonuses:
- **Radiant** - Light-focused civilization with enhanced mirror efficiency
- **Aurum** - Wealth-oriented faction with economic bonuses
- **Velaris** - Strategic, ability-heavy race with stronger structures. Particles from Nebulae

### Key Structures

#### Stellar Forge (Main Base)
- Your primary structure and production facility
- Produces units when receiving light from Solar Mirrors
- Destroying the enemy's Stellar Forge wins the game

#### Solar Mirrors
- Reflect sunlight to your Stellar Forge
- Generate Energy (the game's currency)
- Require clear line-of-sight to both a sun and your Stellar Forge
- Can be targeted by enemies to disrupt your economy

### Resource: Energy (E)
- Primary currency generated from Solar Mirrors
- Used to produce units and build structures
- Generation requires active light connection between mirrors, sun, and forge

### Light & Shadow Mechanics
- Ray-traced lighting creates realistic light propagation
- Objects cast shadows that block light
- Strategic positioning is crucial for maintaining resource flow
- Multiple suns create complex tactical opportunities

## Getting Started

### Local Development

#### Prerequisites
- Node.js (v18 or higher)
- npm

#### Installation
```bash
npm install
```

#### Build for Production
```bash
npm run build
```

#### Development Mode (with watch)
```bash
npm run dev
```

#### Start Colyseus Multiplayer Server
```bash
npm run server
```

## Technology Stack

- **TypeScript** - Type-safe game logic
- **HTML5 Canvas** - 2D rendering
- **Webpack** - Build and bundling
- **Colyseus** - Dedicated WebSocket multiplayer server & session authority

## Multiplayer Architecture

SoL uses a deterministic lockstep architecture powered by **Colyseus** as the multiplayer backend.

### Architecture Overview
```
Client A (Deterministic Sim)  ◄── ColyseusTransport ──►  Colyseus Server (SoLRoom)  ◄── ColyseusTransport ──►  Client B (Deterministic Sim)
       │                                                                                                              │
       ▼                                                                                                              ▼
 CommandQueue (Tick Sync)                                                                                      CommandQueue (Tick Sync)
```

- **CLIENT**:
  - Local persistent player identity (`sol.playerId` via `crypto.randomUUID()`)
  - Deterministic RTS simulation with seeded RNG
  - Tick-based `CommandQueue` and command validation
  - `ColyseusTransport` implementing network abstraction `ITransport`
- **SERVER**:
  - Colyseus `SoLRoom` acting as match session authority
  - Room creation and short join codes
  - Synchronized game seed & match start
  - `GameCommand` and `StateHash` relay
  - Reconnection handling

### Running Multiplayer Locally
1. Start the Colyseus server:
   ```bash
   npm run server
   ```
2. In a separate terminal, build/serve the client:
   ```bash
   npm run dev
   ```
3. Open two browser tabs or windows to host and join using the 6-character match code!

## Match Replay System

SoL includes a fully deterministic replay system that automatically records all matches.

### Features
- **Automatic Recording**: Every game is recorded automatically
- **Deterministic Playback**: Same seed + same commands = identical replay
- **Local Storage**: Replays saved to browser storage
- **File Export**: Download replays as JSON files
- **Replay Viewer**: Standalone HTML viewer for browsing replays

For detailed documentation, see [REPLAY_SYSTEM.md](./REPLAY_SYSTEM.md)
