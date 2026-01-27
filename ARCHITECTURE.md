# SoL Game Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         SoL RTS GAME                        │
│                   (Speed of Light)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       GAME STATE                            │
│  • Players (1-N)                                           │
│  • Suns (Light Sources)                                    │
│  • Game Time                                               │
│  • Victory Conditions                                      │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      PLAYER 1           │   │      PLAYER 2           │
│  Faction: Radiant       │   │  Faction: Aurum         │
│  Solarium: 100 Sol      │   │  Solarium: 100 Sol      │
└─────────────────────────┘   └─────────────────────────┘
            │                               │
    ┌───────┴────────┐              ┌───────┴────────┐
    ▼                ▼              ▼                ▼
┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
│ STELLAR │   │  SOLAR   │   │ STELLAR │   │  SOLAR   │
│  FORGE  │◄──┤ MIRRORS  │   │  FORGE  │◄──┤ MIRRORS  │
│         │   │   (x2)   │   │         │   │   (x2)   │
│ HP:1000 │   └──────────┘   │ HP:1000 │   └──────────┘
└─────────┘         ▲        └─────────┘         ▲
                    │                             │
                    └──────────┬──────────────────┘
                               │
                               ▼
                        ┌──────────┐
                        │   SUN    │
                        │ (Center) │
                        │ Light    │
                        │ Source   │
                        └──────────┘
```

## Core Game Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    UPDATE CYCLE (60 FPS)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Update Game Time       │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  For Each Player:       │
              │  1. Check if defeated   │
              │  2. Update forge light  │
              │  3. Generate Solarium   │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Check Victory          │
              │  Conditions             │
              └─────────────────────────┘
```

## Deterministic State Hash & Replay Snippet

The simulation now computes a lightweight `stateHash` at a fixed cadence to detect desyncs. Every `STATE_HASH_TICK_INTERVAL` ticks, the game hashes key entity state (positions, health, completion flags, mirror reflection angles, unit rally points, unit collision radii, unit move orders, minion path progress, AI command timers, minion projectile state, and space dust positions/velocities/base colors) for players, mirrors, units, buildings, space dust, and active projectiles. This hash is used for quick determinism checks during replays or multiplayer validation.

### Sample Deterministic Replay Snippet (Command List)
Use the following minimal command list to validate that the same `stateHash` is produced across runs:

```json
[
  { "tick": 0, "command": "selectMirror", "playerIndex": 0, "mirrorIndex": 0 },
  { "tick": 1, "command": "moveMirror", "playerIndex": 0, "mirrorIndex": 0, "targetWorld": { "x": 520, "y": 480 } },
  { "tick": 3, "command": "selectForge", "playerIndex": 0 },
  { "tick": 4, "command": "setMinionPath", "playerIndex": 0, "waypointsWorld": [{ "x": 420, "y": 460 }, { "x": 520, "y": 360 }] },
  { "tick": 6, "command": "moveForge", "playerIndex": 0, "targetWorld": { "x": 420, "y": 460 } },
  { "tick": 8, "command": "selectMirror", "playerIndex": 0, "mirrorIndex": 1 },
  { "tick": 9, "command": "moveMirror", "playerIndex": 0, "mirrorIndex": 1, "targetWorld": { "x": 460, "y": 520 } },
  { "tick": 11, "command": "moveForge", "playerIndex": 0, "targetWorld": { "x": 440, "y": 440 } },
  { "tick": 13, "command": "moveUnits", "playerIndex": 0, "unitType": "Starling", "targetWorld": { "x": 460, "y": 420 } },
  { "tick": 15, "command": "queueHeroProduction", "playerIndex": 0, "heroType": "Ray" },
  { "tick": 17, "command": "buildStructure", "playerIndex": 0, "structureType": "Minigun", "targetWorld": { "x": 420, "y": 420 } }
]
```

## Light & Resource Flow

```
    SUN (Light Source)
         │
         │ Emits Light Rays
         │
         ▼
    ┌─────────┐
    │ SOLAR   │ ◄─── Must have line-of-sight
    │ MIRROR  │      to both Sun and Forge
    └─────────┘
         │
         │ Reflects Light
         │ Generates Sol
         ▼
    ┌─────────┐
    │ STELLAR │ ◄─── Receives light
    │  FORGE  │      Produces units
    └─────────┘
         │
         │ Uses Solarium
         ▼
    ┌─────────┐
    │  UNITS  │ ◄─── Only produced when
    └─────────┘      forge has light
```

## Faction System

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   RADIANT    │     │    AURUM     │     │   SOLARI     │
│──────────────│     │──────────────│     │──────────────│
│ Light-based  │     │ Wealth focus │     │ Sun worship  │
│──────────────│     │──────────────│     │──────────────│
│ +10% Mirror  │     │ +50% Start   │     │ +20% Forge   │
│ Efficiency   │     │   Solarium   │     │   Health     │
│              │     │              │     │              │
│ +20% Light   │     │ +10% Sol     │     │ +10% Unit    │
│ Detection    │     │ Generation   │     │ Production   │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Key Mechanics

### Solar Mirror Operation
```
if (has_line_of_sight_to_sun AND has_line_of_sight_to_forge):
    generate_solarium(rate * efficiency * delta_time)
    player.add_solarium(generated_amount)
```

### Unit Production
```
if (forge.is_receiving_light AND player.solarium >= unit_cost):
    produce_unit()
    player.spend_solarium(unit_cost)
```

### Victory Condition
```
if (enemy.stellar_forge.health <= 0):
    current_player_wins()
```

## File Structure

```
SoL/
├── game_core.py              # Core game logic
│   ├── Vector2D              # Math utilities
│   ├── LightRay              # Ray tracing
│   ├── Sun                   # Light sources
│   ├── SolarMirror           # Resource collectors
│   ├── StellarForge          # Main base
│   ├── Player                # Player management
│   └── GameState             # Game controller
│
├── game_config.json          # Balance & settings
├── test_game_core.py         # Unit tests (22 tests)
├── demo.py                   # Working demonstration
│
├── GAME_DESIGN.md            # Design document
├── README.md                 # User guide
├── TODO.md                   # Future roadmap
└── IMPLEMENTATION_SUMMARY.md # This implementation
```

## Technology Stack

- **Language**: Python 3
- **Platform**: Cross-platform (designed for mobile & desktop)
- **Architecture**: Object-oriented with dataclasses
- **Testing**: unittest framework (22 passing tests)
- **Security**: CodeQL verified (0 vulnerabilities)

## Next Steps

See `TODO.md` for the complete roadmap including:
1. Full ray tracing implementation
2. Unit combat system
3. Multiplayer networking
4. Mobile/desktop clients
5. AI opponents
