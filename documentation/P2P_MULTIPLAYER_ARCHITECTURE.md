# P2P Multiplayer Networking Architecture

## Overview

This document describes the P2P multiplayer architecture for SoL RTS game. The design prioritizes deterministic gameplay with minimal server cost while maintaining a clear migration path to authoritative server architecture.

## Core Principles

### 1. P2P-First, Server-Light
- **Supabase is NOT authoritative** - it's used only for matchmaking and signaling
- All game simulation happens on clients using deterministic logic
- After P2P connection: Supabase is out of the hot path
- Game commands flow through WebRTC data channels, never through Supabase

### 2. Deterministic Simulation
- Fixed timestep (30 or 60 ticks/second)
- Seeded RNG (no Math.random())
- Commands are tick-stamped and ordered
- No floating-point nondeterminism where possible
- All peers simulate identically given same commands

### 3. Command-Based, Not State-Based
- **Only commands are transmitted**, never game state
- Commands are small (~100 bytes): `{ tick, playerId, commandType, payload }`
- Bandwidth-efficient: ~1KB/sec average
- State emerges from deterministic simulation of commands

### 4. Future-Proof Architecture
- Transport abstraction allows swapping P2P → Server Relay
- Lockstep-compatible design from day one
- State hash verification ready (Phase 2)
- Anti-cheat hooks in place

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Matches    │  │Match Players │  │Signaling Messages  │   │
│  │  (metadata)  │  │  (players)   │  │(WebRTC SDP/ICE)    │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│         │                  │                      │             │
└─────────┴──────────────────┴──────────────────────┴─────────────┘
          │                  │                      │
          │ (1) Matchmaking  │ (2) Signaling Only  │
          │                  │                      │
┌─────────▼──────────────────▼──────────────────────▼─────────────┐
│                    WebRTC Signaling                              │
│         (SDP Offers/Answers, ICE Candidates)                     │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 │ (3) P2P Connection Established
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐            ┌────▼────┐            ┌────▼────┐
    │ Client  │◄──────────►│ Client  │◄──────────►│ Client  │
    │  (Host) │  WebRTC    │ (Player)│  WebRTC    │ (Player)│
    └─────────┘  Data Ch.  └─────────┘  Data Ch.  └─────────┘
         │                       │                       │
         │ (4) Game Commands Flow Through P2P           │
         │        (Supabase no longer involved)         │
         └───────────────────────┴───────────────────────┘
                                 │
                       ┌─────────▼──────────┐
                       │ Deterministic Sim  │
                       │  (Same on all)     │
                       └────────────────────┘
```

## Database Schema

### Tables

#### `matches`
Match metadata and lifecycle state.
```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP,
    status TEXT CHECK (status IN ('open', 'connecting', 'active', 'ended')),
    host_player_id UUID NOT NULL,
    game_seed INTEGER NOT NULL,        -- For deterministic RNG
    tick_rate INTEGER DEFAULT 30,      -- Fixed timestep
    lockstep_enabled BOOLEAN DEFAULT false,  -- Phase 2 flag
    max_players INTEGER DEFAULT 2,
    match_name TEXT,
    game_settings JSONB
);
```

#### `match_players`
Players in each match.
```sql
CREATE TABLE match_players (
    id UUID PRIMARY KEY,
    match_id UUID REFERENCES matches(id),
    player_id UUID NOT NULL,
    role TEXT CHECK (role IN ('host', 'client')),
    connected BOOLEAN DEFAULT false,
    username TEXT NOT NULL,
    faction TEXT,
    joined_at TIMESTAMP
);
```

#### `signaling_messages`
WebRTC signaling messages (used ONLY for connection setup).
```sql
CREATE TABLE signaling_messages (
    id UUID PRIMARY KEY,
    match_id UUID REFERENCES matches(id),
    sender_id UUID NOT NULL,
    recipient_id UUID,  -- NULL = broadcast
    type TEXT CHECK (type IN ('offer', 'answer', 'ice')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP
);
```

## Module Architecture

### Core Modules

#### 1. `seeded-random.ts` - Deterministic RNG
- Implements Mulberry32 PRNG algorithm
- Global `gameRNG` instance initialized with match seed
- **CRITICAL**: All gameplay randomness MUST use this, never Math.random()

```typescript
import { SeededRandom, setGameRNG, getGameRNG } from './seeded-random';

// At match start (host)
const seed = generateMatchSeed();
setGameRNG(new SeededRandom(seed));

// In game code
const random = getGameRNG();
const value = random.nextFloat(0, 100);
```

#### 2. `transport.ts` - Transport Abstraction
- `ITransport` interface: `sendCommand()`, `onCommandReceived()`
- `CommandQueue`: Tick-based buffering, deterministic ordering
- `CommandValidator`: Centralized validation with rate limiting

```typescript
interface ITransport {
    sendCommand(command: GameCommand): void;
    onCommandReceived(callback: (cmd: GameCommand) => void): void;
    isReady(): boolean;
    disconnect(): void;
}
```

**Key Design**: Game logic only knows about `ITransport`, not specific implementations.

#### 3. `p2p-transport.ts` - P2P Implementation
- Implements `ITransport` using WebRTC data channels
- Uses Supabase Realtime for WebRTC signaling only
- Reliable, ordered data channels (critical for determinism)
- NAT traversal via STUN servers

**Signaling Flow**:
1. Host creates WebRTC offer → sends via Supabase
2. Client receives offer, creates answer → sends via Supabase  
3. ICE candidates exchanged via Supabase
4. P2P connection established → Supabase no longer used

#### 4. `multiplayer-network.ts` - High-Level Manager
- Match lifecycle management (create, join, start, end)
- Coordinates transport initialization
- Manages command queue and validator
- Event system for game integration

```typescript
const network = new MultiplayerNetworkManager(supabaseUrl, supabaseKey, playerId);

// Host creates match
const match = await network.createMatch({
    matchName: "My Game",
    username: "Player1",
    maxPlayers: 2,
    tickRate: 30
});

// Client joins match
await network.joinMatch(matchId, "Player2");

// Start P2P connections
await network.startMatch();

// Send commands
network.sendCommand('move_unit', { unitId: 5, x: 100, y: 200 });

// Get commands for simulation
const commands = network.getNextTickCommands();
if (commands) {
    // Execute all commands in this tick
    commands.forEach(cmd => executeCommand(cmd));
    network.advanceTick();
}
```

## Match Lifecycle

### 1. Create Match (Host)
```typescript
const match = await network.createMatch({
    matchName: "2v2 Battle",
    username: "Alice",
    maxPlayers: 4,
    tickRate: 30
});
// Match is in 'open' status
// Match seed is generated and stored
// Host is added as first player
```

### 2. Join Match (Clients)
```typescript
const matches = await network.listMatches();
await network.joinMatch(matches[0].id, "Bob");
// Client is added to match_players
// Both receive same match seed
```

### 3. Start Match
```typescript
await network.startMatch();
// Match status: 'open' → 'connecting'
// WebRTC signaling begins via Supabase
// SDP offers/answers/ICE candidates exchanged
// P2P connections established
// Match status: 'connecting' → 'active'
```

### 4. Gameplay Loop
```typescript
// Every game tick (e.g., 30 times per second)
function gameLoop() {
    // Get synchronized commands for this tick
    const commands = network.getNextTickCommands();
    
    if (commands) {
        // All clients execute same commands in same order
        commands.forEach(cmd => {
            executeCommand(cmd);
        });
        
        // Advance to next tick
        network.advanceTick();
        
        // Update game state
        updateGameState(deltaTime);
    }
}
```

### 5. End Match
```typescript
await network.endMatch();
// Match status: 'active' → 'ended'
// P2P connections closed
// Match metadata remains for stats/replay
```

## Determinism Guarantees

### Required Invariants

1. **Fixed Timestep**
   - Game simulates at fixed tick rate (30 or 60 Hz)
   - No frame-rate dependent updates
   - Use `tickRate` from match settings

2. **Seeded RNG Only**
   - All randomness uses `SeededRandom`
   - Same seed → same random sequence
   - Never use `Math.random()` in game logic

3. **Command Ordering**
   - Commands sorted by tick, then by playerId
   - CommandQueue ensures deterministic ordering
   - All peers process commands in identical order

4. **No Floating-Point Nondeterminism**
   - Avoid operations that vary by CPU (e.g., transcendental functions in loops)
   - Use integer math where possible
   - Document any unavoidable FP operations

5. **No External State**
   - No Date.now() or wall-clock time in simulation
   - No network-dependent logic in simulation
   - No DOM/browser API calls in simulation

### Nondeterminism Isolation

If nondeterministic code is unavoidable (rendering, audio, UI):
- Isolate it from simulation logic
- Document with `// NONDETERMINISTIC:` comments
- Ensure it never affects game state

Example:
```typescript
// NONDETERMINISTIC: Rendering particles, safe because doesn't affect game state
function renderParticles(ctx: CanvasRenderingContext2D) {
    particles.forEach(p => {
        // Math.random() OK here - only affects visuals
        const jitter = Math.random() * 2 - 1;
        ctx.fillRect(p.x + jitter, p.y, 2, 2);
    });
}
```

## Command Model

### Command Structure
```typescript
interface GameCommand {
    tick: number;        // Which tick this applies to
    playerId: string;    // Who issued it
    commandType: string; // E.g., 'move_unit', 'build_structure'
    payload: any;       // Command-specific data
}
```

### Example Commands
```typescript
// Move unit
{
    tick: 1234,
    playerId: "player-uuid",
    commandType: "move_unit",
    payload: { unitId: 5, targetX: 100, targetY: 200 }
}

// Build structure
{
    tick: 1235,
    playerId: "player-uuid",
    commandType: "build_structure",
    payload: { type: "Cannon", x: 50, y: 50 }
}

// Purchase hero
{
    tick: 1236,
    playerId: "player-uuid",
    commandType: "purchase_hero",
    payload: { heroType: "Ray" }
}
```

### Command Flow
1. Player action → Generate command with current tick
2. Validate command locally
3. Add to own command queue
4. Send to all peers via transport
5. Peers receive, validate, add to their queues
6. When all commands for tick arrive → execute simulation

## Phase 2 Migration Path

### Current (Phase 1): P2P Only
- P2PTransport handles all communication
- No central authority
- Clients trust each other

### Future (Phase 2): Server-Based Relay + Verification

#### Step 1: Implement ServerRelayTransport
```typescript
class ServerRelayTransport implements ITransport {
    sendCommand(cmd: GameCommand) {
        // Send to server instead of peers
        websocket.send(JSON.stringify(cmd));
    }
    
    onCommandReceived(callback) {
        websocket.onmessage = (msg) => {
            // Server broadcasts to all clients
            callback(JSON.parse(msg.data));
        };
    }
}
```

#### Step 2: Enable Lockstep Mode
```typescript
// At match creation
const match = await network.createMatch({
    lockstepEnabled: true,  // Use server relay
    // ...
});

// In MultiplayerNetworkManager
if (match.lockstep_enabled) {
    this.transport = new ServerRelayTransport(/* ... */);
} else {
    this.transport = new P2PTransport(/* ... */);
}
```

#### Step 3: Add State Hash Verification
```typescript
// Every N ticks
if (currentTick % 100 === 0) {
    const hash = generateStateHash(gameState);
    transport.sendStateHash(hash);
    
    // Server compares all client hashes
    // If mismatch → desync detected
}
```

#### Step 4: Anti-Cheat
```typescript
// Server validates commands
function validateCommand(cmd: GameCommand, gameState: any): boolean {
    // Check if player can afford unit
    // Check if command is legal in current state
    // Check rate limits
    // Check command signatures
    return isValid;
}
```

### Migration Checklist
- [ ] Implement ServerRelayTransport
- [ ] Add server-side command validation
- [ ] Implement state hash generation
- [ ] Add hash comparison logic
- [ ] Implement desync recovery
- [ ] Add replay system
- [ ] Implement reconnection handling
- [ ] Add cheat detection

## Performance Characteristics

### Bandwidth
- **Per command**: ~100 bytes
- **Per second**: ~1KB (assuming 10 commands/sec average)
- **10-minute match**: ~600KB per player

### Latency
- **P2P latency**: 20-100ms (depends on geographic distance)
- **Command propagation**: 1-3 ticks (33-100ms at 30Hz)
- **No Supabase overhead** after connection

### Scalability
- **Players per match**: 2-8 (configurable)
- **Concurrent matches**: No Supabase bottleneck (P2P handles traffic)
- **Supabase usage**: Only signaling (~5KB per connection setup)

## Security Considerations

### Phase 1 (Current)
- Trust model: Clients trust each other
- No cryptographic verification
- Vulnerable to:
  - Cheating (sending illegal commands)
  - Impersonation
  - DoS (flooding commands)

### Phase 2 (Planned)
- Server validates all commands
- State hash verification detects tampering
- Rate limiting prevents flooding
- Command signing prevents impersonation

**For now**: Acceptable for friendly play. Phase 2 required for competitive/ranked play.

## Testing & Validation

### Determinism Testing
```typescript
// Test: Same commands → Same state
const seed = 12345;
const commands = [/* ... */];

// Run simulation twice
const state1 = simulateGame(seed, commands);
const state2 = simulateGame(seed, commands);

// Must be identical
assert.equal(hashState(state1), hashState(state2));
```

### Network Testing
1. Open two browser windows
2. Create match in window 1 (host)
3. Join match in window 2 (client)
4. Start match → verify P2P connection
5. Send commands → verify synchronization
6. Check console for errors

### Load Testing
- Monitor Supabase dashboard:
  - Realtime connections (should be 0 during gameplay)
  - Database queries (only for matchmaking)
  - Message throughput (only during connection)

## Troubleshooting

### Issue: P2P Connection Fails
**Possible causes**:
- Firewall/NAT blocking WebRTC
- STUN servers unreachable
- Signaling messages not delivered

**Solutions**:
- Check browser console for WebRTC errors
- Verify Supabase connection
- Try different network (mobile hotspot)
- Consider TURN server for relay fallback (future)

### Issue: Desync (States Diverge)
**Possible causes**:
- Nondeterministic code (Math.random())
- Floating-point differences
- Command ordering mismatch
- Missing commands

**Solutions**:
- Add state hash logging every 100 ticks
- Compare hashes between clients
- Review code for Math.random() usage
- Check command queue statistics

### Issue: Commands Not Received
**Possible causes**:
- P2P connection dropped
- Packet loss on unreliable network
- Command validation failure

**Solutions**:
- Check transport.isReady()
- Monitor getNetworkStats()
- Verify command validation logic
- Implement reconnection (Phase 2)

## API Reference

### MultiplayerNetworkManager

#### Constructor
```typescript
new MultiplayerNetworkManager(
    supabaseUrl: string,
    supabaseAnonKey: string,
    playerId: string
)
```

#### Methods
- `createMatch(options)` - Create new match (host)
- `listMatches()` - List available matches
- `joinMatch(matchId, username)` - Join existing match
- `startMatch()` - Begin P2P connection
- `sendCommand(type, payload)` - Send game command
- `getNextTickCommands()` - Get commands for next tick
- `advanceTick()` - Increment tick counter
- `endMatch(reason)` - End current match
- `disconnect()` - Leave match
- `on(event, callback)` - Register event listener
- `off(event, callback)` - Unregister event listener

#### Events
- `MATCH_CREATED` - Match created successfully
- `PLAYER_JOINED` - Player joined match
- `CONNECTING` - Starting P2P connections
- `CONNECTED` - All P2P connections ready
- `MATCH_STARTED` - Match active, gameplay begins
- `COMMAND_RECEIVED` - Command received from peer
- `MATCH_ENDED` - Match finished
- `ERROR` - Error occurred

## Best Practices

### DO
✅ Use seeded RNG for all gameplay randomness  
✅ Validate commands before sending  
✅ Check transport.isReady() before sending  
✅ Use fixed timestep for simulation  
✅ Sort commands by tick and playerId  
✅ Document any nondeterministic code  
✅ Test determinism with replay  

### DON'T
❌ Use Math.random() in game logic  
❌ Depend on frame rate for timing  
❌ Use Date.now() in simulation  
❌ Send game state over network  
❌ Assume commands arrive immediately  
❌ Ignore command validation failures  
❌ Embed WebRTC logic in game code  

## References

- [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
- [Deterministic Lockstep](https://gafferongames.com/post/deterministic_lockstep/)
- [RTS Game Networking](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Mulberry32 PRNG](https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32)
