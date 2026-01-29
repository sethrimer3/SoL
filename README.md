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
- **Solari** - Sun-worshipping empire with stronger structures

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

## Future Development

- Full ray-tracing implementation for shadows
- Unit types and combat system
- AI opponents
- Enhanced multiplayer with crossplay and matchmaking
- Advanced lighting effects

## Multiplayer

SoL supports local area network (LAN) multiplayer for 1v1 matches using WebRTC. See [LAN_PLAY.md](./LAN_PLAY.md) for detailed instructions on how to host or join LAN games.

## Legacy Python Implementation

The original Python implementation is preserved in the repository:
- `game_core.py` - Python game core (legacy)
- `demo.py` - Python demo (legacy)
- `test_game_core.py` - Python tests (legacy)
