# SoL Game Architecture

## System Overview

## Current TypeScript Runtime Architecture

The active game shipped in browser is organized around a **single-process client runtime** with
clear module boundaries:

1. **Orchestration Layer (`src/main.ts`)**
   - Owns the `GameController` (bootstrapping, input routing, pause/menu state, replay controls).
   - Bridges simulation, renderer, menu, audio, and multiplayer services.

2. **Simulation Layer (`src/game-core.ts` + `src/sim/**`)**
   - Holds authoritative game state (`GameState`) and deterministic tick updates.
   - Contains entities (players, units, buildings, projectiles, effects) and combat/economy rules.
   - Uses seeded RNG (`src/seeded-random.ts`) to keep multiplayer/replay outcomes reproducible.

3. **Rendering Layer (`src/renderer.ts` + `src/render/**`)**
   - Draws a read-only view of state to HTML5 Canvas.
   - Manages camera, quality settings, HUD/selection overlays, faction-specific visuals.

4. **UI Layer (`src/menu/**`)**
   - Handles menu screens (mode select, matchmaking, settings, lobbies, history).
   - Encapsulates menu particles/atmosphere effects and UI helpers.

5. **Networking Layer (`src/multiplayer-network.ts`, `src/p2p-transport.ts`, `src/transport.ts`)**
   - Uses Supabase for matchmaking/signaling and WebRTC data channels for live command traffic.
   - Synchronizes deterministic commands by tick (lockstep-style flow).

6. **Replay/Verification Layer (`src/replay.ts`, `src/state-verification.ts`)**
   - Records command streams + seed and replays them into a fresh deterministic game state.
   - Supports desync detection through periodic state verification.

This separation is intentional: gameplay correctness lives in simulation, rendering stays visual,
and networking/replay move **commands** instead of full world snapshots.

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
│  Energy: 100 Sol      │   │  Energy: 100 Sol      │
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
              │  3. Generate Energy   │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Check Victory          │
              │  Conditions             │
              └─────────────────────────┘
```

## Deterministic State Hash & Replay Snippet

The simulation now computes a lightweight `stateHash` at a fixed cadence to detect desyncs. Every `STATE_HASH_TICK_INTERVAL` ticks, the game hashes key entity state (positions, velocities, rotations, health, completion flags, mirror reflection angles, mirror linked structure targets, unit rally points, unit manual targets, unit collision radii, unit move orders, minion path progress, starling move speed, starling final waypoint state and path hash, foundry production queues/progress, player Strafe upgrade state, AI command timers, starling merge gate timers/absorption/health state, warp gate charge/cancel/timeout state, minion projectile state, and space dust positions/velocities/glow state/base colors/impact tint state) for players, mirrors, units, buildings, merge gates, warp gates, space dust, and active projectiles. This hash is used for quick determinism checks during replays or multiplayer validation.

### Sample Deterministic Replay Snippet (Command List)
Use the following minimal command list to validate that the same `stateHash` is produced across runs:

```json
[
  { "tick": 0, "command": "selectMirror", "playerIndex": 0, "mirrorIndex": 0 },
  { "tick": 1, "command": "linkMirrorToStructure", "playerIndex": 0, "mirrorIndex": 0, "structureType": "StellarForge" },
  { "tick": 3, "command": "setMinionPath", "playerIndex": 0, "waypointsWorld": [{ "x": 420, "y": 460 }, { "x": 520, "y": 360 }] },
  { "tick": 5, "command": "moveForge", "playerIndex": 0, "targetWorld": { "x": 420, "y": 460 } },
  { "tick": 7, "command": "selectMirror", "playerIndex": 0, "mirrorIndex": 1 },
  { "tick": 8, "command": "linkMirrorToStructure", "playerIndex": 0, "mirrorIndex": 1, "structureType": "Foundry" },
  { "tick": 9, "command": "mergeStarlings", "playerIndex": 0, "unitIds": ["p0_s1", "p0_s2", "p0_s3", "p0_s4", "p0_s5", "p0_s6", "p0_s7", "p0_s8", "p0_s9", "p0_s10"], "targetWorld": { "x": 480, "y": 420 } },
  { "tick": 10, "command": "moveUnits", "playerIndex": 0, "unitType": "Starling", "targetWorld": { "x": 460, "y": 420 } },
  { "tick": 11, "command": "targetStructure", "playerIndex": 0, "target": { "type": "StellarForge", "playerIndex": 1 } },
  { "tick": 12, "command": "queueHeroProduction", "playerIndex": 0, "heroType": "Ray" },
  { "tick": 14, "command": "buildStructure", "playerIndex": 0, "structureType": "Cannon", "targetWorld": { "x": 420, "y": 420 } },
  { "tick": 16, "command": "queueHeroProduction", "playerIndex": 0, "heroType": "Spotlight" },
  { "tick": 18, "command": "unitAbility", "playerIndex": 0, "unitId": "p0_h0", "direction": { "x": 1, "y": 0 } },
  { "tick": 20, "command": "queueFoundryUpgrade", "playerIndex": 0, "upgradeType": "strafe" },
  { "tick": 22, "command": "queueHeroProduction", "playerIndex": 0, "heroType": "Grave" },
  { "tick": 40, "command": "unitAbility", "playerIndex": 0, "unitId": "p0_h1", "direction": { "x": 0, "y": 1 } }
]
```

The command list above was revalidated after updating starling group stop radius behavior to ensure `stateHash` stability.

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
         │ Uses Energy
         ▼
    ┌─────────┐
    │  UNITS  │ ◄─── Only produced when
    └─────────┘      forge has light
```

## Faction System

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   RADIANT    │     │    AURUM     │     │   VELARIS    │
│──────────────│     │──────────────│     │──────────────│
│ Light-based  │     │ Wealth focus │     │ Ability-heavy│
│──────────────│     │──────────────│     │──────────────│
│ +10% Mirror  │     │ +50% Start   │     │ +20% Forge   │
│ Efficiency   │     │   Energy   │     │   Health     │
│              │     │              │     │              │
│ +20% Light   │     │ +10% Sol     │     │ +10% Unit    │
│ Detection    │     │ Generation   │     │ Production   │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Key Mechanics

### Solar Mirror Operation
```
if (has_line_of_sight_to_sun AND has_line_of_sight_to_forge):
    generate_energy(rate * efficiency * delta_time)
    player.add_energy(generated_amount)
```

### Unit Production
```
if (forge.is_receiving_light AND player.energy >= unit_cost):
    produce_unit()
    player.spend_energy(unit_cost)
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

- **Language**: Python 3 (core logic), TypeScript (client)
- **Platform**: Cross-platform (designed for mobile & desktop)
- **Architecture**: Object-oriented with dataclasses
- **Testing**: unittest framework (22 passing tests)
- **Security**: CodeQL verified (0 vulnerabilities)
- **Multiplayer**: P2P WebRTC with Supabase signaling

## Multiplayer Architecture

### Overview

SoL uses a **deterministic lockstep P2P multiplayer** architecture with WebRTC for direct peer-to-peer communication and Supabase for matchmaking and signaling.

```
┌─────────────────────────────────────────────────────────────┐
│                   P2P MULTIPLAYER SYSTEM                    │
└─────────────────────────────────────────────────────────────┘

Client 1                  Supabase                  Client 2
┌────────┐              ┌──────────┐              ┌────────┐
│ Game   │              │ Match    │              │ Game   │
│ State  │              │ Database │              │ State  │
└────────┘              └──────────┘              └────────┘
    │                        │                        │
    │  1. Create Match       │                        │
    ├───────────────────────>│                        │
    │  2. Match Code         │                        │
    │<───────────────────────┤                        │
    │                        │  3. Join Match         │
    │                        │<───────────────────────┤
    │                        │  4. Connection Info    │
    │                        ├───────────────────────>│
    │                        │                        │
    │  5. WebRTC Signaling (ICE, SDP)                │
    │<──────────────────────────────────────────────>│
    │                        │                        │
    │  6. Direct P2P Connection (WebRTC)             │
    │<──────────────────────────────────────────────>│
    │        Commands, not game state                │
    │                                                 │
    ▼                                                 ▼
┌────────┐                                      ┌────────┐
│Execute │                                      │Execute │
│Command │  Same Seed + Same Commands          │Command │
│Queue   │  ═══════════════════════════         │Queue   │
└────────┘  Same Game State                    └────────┘
```

### Key Principles

1. **Deterministic Simulation**: All clients run identical game logic with the same random seed
2. **Command-Based**: Only player commands are transmitted, never game state
3. **Lockstep Synchronization**: All clients execute commands on the same tick
4. **Direct P2P**: Low-latency WebRTC connections between players
5. **Seeded RNG**: All randomness uses `SeededRandom` for determinism

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                      │
│  (Game State, Unit Logic, Building Logic, Combat)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Multiplayer Network Layer                 │
│  (MultiplayerNetworkManager, Command Queue, Match Lifecycle)│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Transport Layer                        │
│        (P2PTransport, ServerRelayTransport - Phase 2)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Network Layer                          │
│              (WebRTC Data Channels, Supabase)               │
└─────────────────────────────────────────────────────────────┘
```

### Multiplayer Game Loop

```
┌─────────────────────────────────────────────────────────────┐
│           MULTIPLAYER UPDATE CYCLE (30 Ticks/Sec)           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Accumulate Delta Time    │
              │ (Fixed Timestep)         │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Player Inputs →          │
              │ Generate Commands        │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Send Commands to Peers   │
              │ (via P2P Transport)      │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Receive Commands from    │
              │ All Players (inc. self)  │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Command Queue:           │
              │ Sort by (tick, playerId) │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Have all commands for    │
              │ current tick?            │
              └──────────────────────────┘
                  │              │
                  │ Yes          │ No
                  ▼              ▼
      ┌──────────────────┐  ┌────────────┐
      │ Execute Commands │  │ Wait/      │
      │ for Current Tick │  │ Timeout    │
      └──────────────────┘  └────────────┘
                  │
                  ▼
      ┌──────────────────────┐
      │ GameState.update()   │
      │ (Deterministic)      │
      └──────────────────────┘
                  │
                  ▼
      ┌──────────────────────┐
      │ Update State Hash    │
      │ (Every N ticks)      │
      └──────────────────────┘
                  │
                  ▼
      ┌──────────────────────┐
      │ Render Frame         │
      └──────────────────────┘
```

### Command Flow

```
Player Action (e.g., "Move Unit")
        │
        ▼
┌──────────────────┐
│ Create Command   │
│ {                │
│   tick: 150,     │
│   playerId: "P1",│
│   type: "move",  │
│   payload: {...} │
│ }                │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ Send via P2P     │
│ to all peers     │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ Each client adds │
│ to command queue │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ On tick 150:     │
│ Execute command  │
│ on all clients   │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│ Deterministic    │
│ state change     │
└──────────────────┘
```

### Seeded Random Number Generation

**Critical for Determinism**: All randomness must use `SeededRandom`, never `Math.random()`.

```typescript
// Initialize at match start (host generates seed)
const matchSeed = generateMatchSeed(); // From timestamp
setGameRNG(new SeededRandom(matchSeed));

// Use throughout game logic
const rng = getGameRNG();
const damage = rng.nextInt(10, 20);
const angle = rng.nextAngle();
const point = rng.nextInUnitCircle();
```

**Methods Available**:
- `next()` - Random float [0, 1)
- `nextInt(min, max)` - Random integer [min, max]
- `nextFloat(min, max)` - Random float [min, max)
- `nextBool(probability)` - Random boolean
- `choice(array)` - Random element from array
- `shuffle(array)` - Fisher-Yates shuffle
- `nextAngle()` - Random angle [0, 2π)
- `nextUnitCircle()` - Random point on unit circle
- `nextInUnitCircle()` - Random point in unit circle

### State Hash for Desync Detection

```typescript
// State hash computed every STATE_HASH_TICK_INTERVAL ticks
// Hashes key game state: positions, health, energy, etc.
if (tickCounter % STATE_HASH_TICK_INTERVAL === 0) {
    const hash = computeStateHash();
    // Can be exchanged between peers to detect desync
}
```

### Match Lifecycle

```
1. HOST CREATES MATCH
   ├─ Generate match code (6 chars)
   ├─ Generate random seed
   ├─ Insert match into Supabase
   └─ Wait in lobby

2. CLIENTS JOIN MATCH
   ├─ Enter match code
   ├─ Fetch match from Supabase
   ├─ Add player to match
   └─ Establish P2P connections

3. HOST STARTS MATCH
   ├─ Broadcast match seed to all players
   ├─ All clients initialize with same seed
   ├─ Begin synchronized tick counter
   └─ Game starts simultaneously

4. GAMEPLAY
   ├─ Players issue commands
   ├─ Commands sent via P2P
   ├─ Commands executed in lockstep
   └─ State remains synchronized

5. MATCH ENDS
   ├─ Victory/defeat detected
   ├─ Disconnect P2P connections
   ├─ Clean up match in Supabase
   └─ Return to menu
```

### Files and Components

**Core Multiplayer Files**:
- `src/seeded-random.ts` - Deterministic RNG (✅ Complete)
- `src/transport.ts` - Transport abstraction layer (✅ Complete)
- `src/p2p-transport.ts` - WebRTC P2P implementation (✅ Complete)
- `src/multiplayer-network.ts` - Network manager & command queue (✅ Complete)
- `src/supabase-config.ts` - Supabase configuration (✅ Complete)

**Integration Points**:
- `src/sim/game-state.ts` - Command execution methods (✅ Complete)
- `src/main.ts` - Multiplayer game loop (✅ Complete)
- `src/menu.ts` - Multiplayer UI (host/join/lobby) (✅ Complete)

**Testing & Documentation**:
- `test-multiplayer-determinism.ts` - Determinism test suite (✅ Complete)
- `MULTIPLAYER_INTEGRATION_TODO.md` - Integration checklist
- `P2P_MULTIPLAYER_ARCHITECTURE.md` - Detailed architecture
- `MULTIPLAYER_QUICKSTART.md` - Quick start guide

### Database Schema

**Supabase Tables**:
- `p2p_matches` - Match listings and metadata
- `p2p_match_players` - Players in each match
- `p2p_signaling` - WebRTC signaling messages (offers, answers, ICE)

See `supabase.sql` for complete schema and RLS policies.

### Security Considerations

1. **Determinism = Anti-Cheat**: Identical inputs must produce identical outputs
2. **Client Validation**: Each client validates commands are legal
3. **State Hash Verification**: Periodic hash exchange detects tampering (Phase 2)
4. **Rate Limiting**: Command queue limits prevent spam
5. **Supabase RLS**: Row-level security on match and player data

See `MULTIPLAYER_SECURITY.md` for detailed security design.

### Performance Characteristics

**Network Usage**:
- Supabase (signaling): ~1-5 KB/s during connection, ~0.1 KB/s after
- P2P (commands): ~0.5-2 KB/s per player connection
- Total for 4 players: ~10-15 KB/s (very light)

**Latency**:
- Local network: <50ms
- Internet (same region): <100ms  
- Internet (different regions): <300ms
- Tick rate: 30 ticks/second (33ms per tick)

**Scalability**:
- Tested: 2 players
- Designed for: 2-8 players
- P2P mesh scales O(n²) in connections
- Phase 2: Server relay for >8 players

### Phase 2 Enhancements

**Planned Features** (not in MVP):
1. **Server Relay Transport** - For >8 players or poor P2P connectivity
2. **State Hash Verification** - Automatic desync detection and recovery
3. **Anti-Cheat System** - Server-side command validation
4. **Reconnection Handling** - Graceful recovery from network issues
5. **Spectator Mode** - Watch matches without playing
6. **Replay System** - Record and playback matches

## Next Steps

See `TODO.md` for the complete roadmap including:
1. Full ray tracing implementation
2. Unit combat system
3. ~~Multiplayer networking~~ ✅ Complete (Phase 1)
4. Mobile/desktop clients
5. AI opponents
