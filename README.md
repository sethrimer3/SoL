# SoL - Speed of Light RTS

A 2D real-time strategy game set in space with unique light-based mechanics.

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
- Generate Solarium (the game's currency)
- Require clear line-of-sight to both a sun and your Stellar Forge
- Can be targeted by enemies to disrupt your economy

### Resource: Solarium (Sol)
- Primary currency generated from Solar Mirrors
- Used to produce units and build structures
- Generation requires active light connection between mirrors, sun, and forge

### Light & Shadow Mechanics
- Ray-traced lighting creates realistic light propagation
- Objects cast shadows that block light
- Strategic positioning is crucial for maintaining resource flow
- Multiple suns create complex tactical opportunities

## Getting Started

### Running Tests
```bash
python -m unittest test_game_core -v
```

### Example Usage
```python
from game_core import create_standard_game, Faction

# Create a game with two players
game = create_standard_game([
    ("Player1", Faction.RADIANT),
    ("Player2", Faction.AURUM)
])

# Run game loop
while game.is_running:
    game.update(delta_time=0.016)  # ~60 FPS
    
    # Check for victory
    winner = game.check_victory_conditions()
    if winner:
        print(f"{winner.name} wins!")
        break
```

## Game Files

- `game_core.py` - Core game mechanics and classes
- `game_config.json` - Game configuration and balance settings
- `GAME_DESIGN.md` - Detailed game design document
- `test_game_core.py` - Unit tests for game mechanics

## Features

✅ Three distinct factions with unique characteristics  
✅ Stellar Forge main base system  
✅ Solar Mirror resource collection  
✅ Solarium currency system  
✅ Light-based unit production mechanics  
✅ Line-of-sight system for solar mirrors  
✅ Ray tracing foundation for light/shadow  
✅ Cross-platform support (Mobile & Desktop)  

## Future Development

- Full ray-tracing implementation for shadows
- Unit types and combat system
- AI opponents
- Multiplayer with crossplay
- Mobile and desktop clients
- Advanced lighting effects
