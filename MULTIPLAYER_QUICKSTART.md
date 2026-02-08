# P2P Multiplayer - Quick Start Guide

## Overview

This multiplayer implementation provides **deterministic P2P networking** with Supabase signaling for the SoL RTS game. It's designed for Phase 1 (P2P) with a clear migration path to Phase 2 (Server Relay + Verification).

## Key Features

✅ **P2P-First**: WebRTC data channels, minimal server cost  
✅ **Deterministic**: Fixed timestep, seeded RNG, command-based synchronization  
✅ **Supabase Signaling**: Used only for matchmaking and WebRTC setup  
✅ **Transport Abstraction**: Easy migration to server relay  
✅ **Phase 2 Ready**: Lockstep-compatible, state hash hooks in place  

## Quick Setup

### 1. Database Setup

Run the SQL schema in your Supabase project:
```bash
# In Supabase SQL Editor, run:
supabase-p2p-schema.sql
```

This creates:
- `matches` table (match metadata)
- `match_players` table (players in matches)
- `signaling_messages` table (WebRTC signaling)

### 2. Configure Supabase

Set environment variables or update config:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Install Dependencies

Already included in package.json:
```json
{
  "@supabase/supabase-js": "^2.93.3"
}
```

### 4. Initialize Multiplayer

```typescript
import { MultiplayerNetworkManager } from './multiplayer-network';

const network = new MultiplayerNetworkManager(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    playerId
);
```

## Usage Examples

### Host a Match

```typescript
const match = await network.createMatch({
    matchName: "My Game",
    username: "Player1",
    maxPlayers: 2,
    tickRate: 30
});

console.log("Match ID:", match.id);
// Share match ID with other players
```

### Join a Match

```typescript
const matches = await network.listMatches();
console.log("Available matches:", matches);

await network.joinMatch(matches[0].id, "Player2");
```

### Start Match & Connect

```typescript
// Setup event listeners
network.on(NetworkEvent.CONNECTED, () => {
    console.log("All players connected!");
});

network.on(NetworkEvent.MATCH_STARTED, (data) => {
    console.log("Game starting with seed:", data.seed);
    startGame();
});

// Start P2P connection
await network.startMatch();
```

### Send Commands

```typescript
// Player moves unit
network.sendCommand('move_unit', {
    unitId: 5,
    targetX: 100,
    targetY: 200
});

// Player builds structure
network.sendCommand('build_structure', {
    type: 'Cannon',
    x: 50,
    y: 50
});
```

### Game Loop with Command Sync

```typescript
function gameLoop() {
    // Get synchronized commands for this tick
    const commands = network.getNextTickCommands();
    
    if (commands) {
        // Execute all commands (deterministically)
        commands.forEach(cmd => executeCommand(cmd));
        
        // Advance tick
        network.advanceTick();
        
        // Update game state
        updateGameState();
    }
    
    requestAnimationFrame(gameLoop);
}
```

## File Structure

```
src/
├── seeded-random.ts           # Deterministic RNG (Mulberry32)
├── transport.ts               # Transport abstraction (ITransport)
├── p2p-transport.ts           # P2P implementation (WebRTC)
├── multiplayer-network.ts     # High-level manager
└── multiplayer-example.ts     # Integration example

supabase-p2p-schema.sql        # Database schema
P2P_MULTIPLAYER_ARCHITECTURE.md # Detailed documentation
```

## Key Concepts

### 1. Commands, Not State

❌ **Never** send game state:
```typescript
// DON'T DO THIS
network.send({ type: 'state', units: [...], buildings: [...] });
```

✅ **Always** send commands:
```typescript
// DO THIS
network.sendCommand('move_unit', { unitId: 5, x: 100, y: 200 });
```

### 2. Use Seeded RNG

❌ **Never** use Math.random() in game logic:
```typescript
// DON'T DO THIS
const damage = Math.random() * 10;
```

✅ **Always** use seeded RNG:
```typescript
// DO THIS
import { getGameRNG } from './seeded-random';
const rng = getGameRNG();
const damage = rng.nextFloat(0, 10);
```

### 3. Fixed Timestep

❌ **Never** use frame time for gameplay:
```typescript
// DON'T DO THIS
unit.x += unit.velocity * deltaTime;
```

✅ **Always** use fixed timestep:
```typescript
// DO THIS (in tick update)
unit.x += unit.velocity * TICK_INTERVAL;
```

### 4. Check Transport Ready

❌ **Never** assume connection is ready:
```typescript
// DON'T DO THIS
network.sendCommand('move_unit', { ... });
```

✅ **Always** check ready state:
```typescript
// DO THIS
network.on(NetworkEvent.CONNECTED, () => {
    // Now safe to send commands
    network.sendCommand('move_unit', { ... });
});
```

## Events

Listen for network events:

```typescript
network.on(NetworkEvent.MATCH_CREATED, (data) => {
    console.log("Match created:", data.match);
});

network.on(NetworkEvent.PLAYER_JOINED, (data) => {
    console.log("Player joined:", data.username);
});

network.on(NetworkEvent.CONNECTING, () => {
    console.log("Establishing P2P connections...");
});

network.on(NetworkEvent.CONNECTED, () => {
    console.log("All players connected!");
});

network.on(NetworkEvent.MATCH_STARTED, (data) => {
    console.log("Match started! Seed:", data.seed);
});

network.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
    console.log("Command received:", data.command);
});

network.on(NetworkEvent.ERROR, (data) => {
    console.error("Network error:", data.error);
});
```

## Debugging

### View Network Stats

```typescript
const stats = network.getNetworkStats();
console.log("Network:", stats);
// { connected: true, latencyMs: 50, packetsSent: 1234, ... }

const queueStats = network.getQueueStats();
console.log("Queue:", queueStats);
// { currentTick: 5000, queuedTicks: 2, missedCommands: 0, ... }
```

### Test Determinism

```typescript
import { SeededRandom } from './seeded-random';

const seed = 12345;
const rng1 = new SeededRandom(seed);
const rng2 = new SeededRandom(seed);

// Should produce identical sequences
console.log(rng1.next()); // 0.123456
console.log(rng2.next()); // 0.123456 (same!)
```

### Check Supabase Connection

```typescript
// View Supabase Dashboard:
// - Realtime > Connections (should be 0 during gameplay)
// - Database > matches table (see created matches)
// - Database > signaling_messages (only during connection)
```

## Troubleshooting

### "Game RNG not initialized"

**Cause**: Trying to use RNG before match starts.

**Fix**: RNG is automatically initialized when match is created/joined. Don't access it before `MATCH_STARTED` event.

### "Cannot send command: transport not ready"

**Cause**: P2P connection not established yet.

**Fix**: Wait for `CONNECTED` event before sending commands:
```typescript
network.on(NetworkEvent.CONNECTED, () => {
    // Now safe to send
});
```

### "Invalid command received"

**Cause**: Command failed validation (malformed, too large, rate limit).

**Fix**: Check command structure:
```typescript
{
    tick: number,
    playerId: string,
    commandType: string,
    payload: any  // < 1KB
}
```

### P2P Connection Fails

**Cause**: Firewall/NAT blocking WebRTC.

**Fix**: 
1. Try different network (mobile hotspot)
2. Check browser console for WebRTC errors
3. Verify STUN servers are reachable
4. Consider TURN server for relay (Phase 2)

### States Desync

**Cause**: Nondeterministic code (Math.random(), Date.now(), etc.).

**Fix**:
1. Search code for `Math.random()` → replace with seeded RNG
2. Search code for `Date.now()` in game logic → use tick counter
3. Add state hash logging to detect desync point

## Phase 2 Migration

When ready for server-based relay:

### 1. Implement ServerRelayTransport

```typescript
class ServerRelayTransport implements ITransport {
    sendCommand(cmd: GameCommand) {
        websocket.send(JSON.stringify(cmd));
    }
    
    onCommandReceived(callback) {
        websocket.onmessage = (msg) => {
            callback(JSON.parse(msg.data));
        };
    }
}
```

### 2. Enable Lockstep Mode

```typescript
const match = await network.createMatch({
    lockstepEnabled: true,  // Use server relay
    // ...
});
```

### 3. Add State Hash Verification

```typescript
if (currentTick % 100 === 0) {
    const hash = generateStateHash(gameState);
    transport.sendStateHash(hash);
}
```

## Performance

- **Bandwidth**: ~1KB/sec per player (command-only)
- **Latency**: 20-100ms P2P (geographic dependent)
- **Supabase Usage**: ~5KB per match (signaling only)
- **Scalability**: No Supabase bottleneck (P2P handles traffic)

## Best Practices

✅ Always use seeded RNG (`getGameRNG()`)  
✅ Always use fixed timestep (tick-based)  
✅ Always validate commands before sending  
✅ Always check transport ready state  
✅ Always sort commands deterministically  
✅ Document any nondeterministic code  

❌ Never use Math.random() in game logic  
❌ Never send game state over network  
❌ Never use frame time for gameplay  
❌ Never use Date.now() in simulation  
❌ Never assume commands arrive instantly  

## Resources

- [Full Architecture Documentation](./P2P_MULTIPLAYER_ARCHITECTURE.md)
- [Integration Example](./src/multiplayer-example.ts)
- [Database Schema](./supabase-p2p-schema.sql)
- [Supabase Dashboard](https://supabase.com/dashboard)

## Support

For issues or questions:
1. Check console for errors
2. Verify Supabase connection
3. Test with determinism validation
4. Review architecture documentation

## License

Same as SoL project license.
