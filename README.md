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

### Play Online
Visit [https://sethrimer3.github.io/SoL/](https://sethrimer3.github.io/SoL/) to play instantly in your browser on mobile or desktop!

### Local Development

#### Prerequisites
- Node.js (v14 or higher)
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

#### Serve Locally
```bash
# After building, serve the dist folder
cd dist
python3 -m http.server 8080
# Or use any other static file server
```

## Technology Stack

- **TypeScript** - Type-safe game logic
- **HTML5 Canvas** - 2D rendering
- **Webpack** - Build and bundling
- **GitHub Pages** - Deployment

## Game Files

- `src/game-core.ts` - Core game mechanics and classes
- `src/renderer.ts` - HTML5 Canvas renderer
- `src/main.ts` - Game controller and main entry point
- `src/index.html` - HTML template
- `game_config.json` - Game configuration and balance settings
- `GAME_DESIGN.md` - Detailed game design document

## Features

✅ Three distinct factions with unique characteristics  
✅ Stellar Forge main base system  
✅ Solar Mirror resource collection  
✅ Energy currency system  
✅ Light-based unit production mechanics  
✅ Line-of-sight system for solar mirrors  
✅ Ray tracing foundation for light/shadow  
✅ Cross-platform support (Mobile & Desktop)  
✅ LAN multiplayer (WebRTC peer-to-peer)  
✅ Online multiplayer (Supabase - Beta)  
✅ Match replay system - Record and playback matches  

## Match Replay System

SoL includes a fully deterministic replay system that automatically records all your matches.

### Features
- **Automatic Recording**: Every game is recorded automatically
- **Deterministic Playback**: Same seed + same commands = identical replay
- **Local Storage**: Replays saved to browser storage
- **File Export**: Download replays as JSON files
- **Replay Viewer**: Standalone HTML viewer for browsing replays

### Usage
1. **Play a Game**: Replays are automatically recorded
2. **Auto-Save**: When the game ends, replay is saved to local storage and downloaded
3. **View Replays**: Open `replay-viewer.html` to browse and load replays
4. **Load Replay**: Use the replay viewer to see match metadata and command history

For detailed documentation, see [REPLAY_SYSTEM.md](./REPLAY_SYSTEM.md)

## Future Development

- Full ray-tracing implementation for shadows
- Unit types and combat system
- AI opponents
- Enhanced multiplayer with crossplay and matchmaking
- Advanced lighting effects

## Multiplayer

SoL supports three types of multiplayer:

- **LAN Play**: Local area network multiplayer for 1v1 matches using WebRTC peer-to-peer. See [LAN_PLAY.md](./LAN_PLAY.md) for details.
- **P2P Multiplayer (Beta)**: Peer-to-peer multiplayer over the internet using Supabase for signaling and WebRTC for game data. Supports 2-8 players with deterministic lockstep synchronization. See [P2P Multiplayer Setup](#p2p-multiplayer-setup) below for configuration.
- **Online Play (Beta)**: Internet multiplayer using Supabase for fast, accurate RTS gameplay. See [ONLINE_PLAY.md](./ONLINE_PLAY.md) for setup and usage instructions.

### P2P Multiplayer Setup

P2P multiplayer uses Supabase for WebRTC signaling (match creation, joining) while game data flows peer-to-peer for low latency.

#### Prerequisites
1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Run the P2P schema: Execute `supabase-p2p-schema.sql` in your Supabase SQL Editor
3. Get your credentials from Settings > API in your Supabase dashboard

#### Configuration
Set environment variables before building:
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-public-key-here
npm run build
```

Or create a `.env` file (copy from `.env.example`) and use a tool like `dotenv`:
```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key-here
```

#### Playing P2P Multiplayer
1. **Host a Match**: 
   - Select "P2P MULTIPLAYER" from the game mode menu
   - Click "HOST MATCH"
   - Enter a match name and select max players (2-8)
   - Share the match code with friends
   - Wait for players to join, then click "START MATCH"

2. **Join a Match**:
   - Select "P2P MULTIPLAYER" from the game mode menu
   - Click "JOIN MATCH"
   - Enter the match code from your friend
   - Wait for the host to start the game

#### Features
- ✅ Deterministic lockstep synchronization
- ✅ Peer-to-peer data transfer (low latency)
- ✅ Support for 2-8 players
- ✅ Automatic WebRTC connection establishment
- ✅ Match codes for easy joining

For detailed architecture and technical details, see [P2P_MULTIPLAYER_ARCHITECTURE.md](./P2P_MULTIPLAYER_ARCHITECTURE.md) and [MULTIPLAYER_QUICKSTART.md](./MULTIPLAYER_QUICKSTART.md).

## Legacy Python Implementation

The original Python implementation is preserved in the repository:
- `game_core.py` - Python game core (legacy)
- `demo.py` - Python demo (legacy)
- `test_game_core.py` - Python tests (legacy)
