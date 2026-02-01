# Online Play Implementation

## Overview

SoL now supports online multiplayer using Supabase for fast, accurate RTS gameplay with minimal data transmission. This is a beta feature that uses Supabase Realtime for low-latency command synchronization.

## Architecture

### Technology Stack

- **Supabase Realtime**: Low-latency WebSocket-based communication
- **Supabase Database**: PostgreSQL for lobby/room management
- **Command Replication**: Deterministic command-based synchronization
- **Bandwidth Optimization**: Compact message encoding and data minimization

### Key Features

- ✅ Room-based matchmaking
- ✅ Real-time command synchronization
- ✅ Bandwidth-optimized messaging (~50 bytes per command)
- ✅ Deterministic game state
- ✅ Host/client architecture
- ✅ Player presence tracking

## Setup

### 1. Supabase Project Setup

1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Run the database schema from `supabase-schema.sql` in the SQL Editor

### 2. Configuration

Set environment variables for your Supabase credentials:

```bash
export SUPABASE_URL="your-project-url"
export SUPABASE_ANON_KEY="your-anon-key"
```

For production builds, configure these in your build environment or webpack configuration.

### 3. Database Schema

The required database tables are defined in `supabase-schema.sql`:

- `game_rooms`: Game lobbies and room state
- `room_players`: Players in each room
- `game_states`: Optional game state persistence

Run the SQL schema in your Supabase SQL Editor to create these tables.

## How It Works

### Room Creation and Joining

1. **Host** creates a room via `OnlineNetworkManager.createRoom()`
2. Room is stored in Supabase database with status 'waiting'
3. **Clients** can browse available rooms via `listRooms()`
4. **Clients** join a room via `joinRoom(roomId)`
5. All players subscribe to the room's Realtime channel

### Game Synchronization

1. Each player action generates a `GameCommand`
2. Commands are compressed to compact format (~50% bandwidth savings)
3. Commands are broadcast via Supabase Realtime (no ack for low latency)
4. All clients receive and execute commands in tick order
5. Deterministic game logic ensures identical state across all clients

### Command Optimization

Commands are optimized for minimal bandwidth:

```typescript
// Original command (~150 bytes)
{
  tick: 1234,
  playerId: "550e8400-e29b-41d4-a716-446655440000",
  command: "unit_move",
  data: { x: 123.456789, y: 456.789012 }
}

// Compact command (~50 bytes)
{
  t: 1234,
  p: "550e8400",  // Shortened ID
  c: "um",        // Abbreviated command
  d: { x: 123.5, y: 456.8 }  // Reduced precision
}
```

Optimizations:
- Short keys (t, p, c, d)
- Abbreviated command types
- Shortened player IDs (8 chars)
- Reduced number precision (1 decimal place)
- Batch command sending when possible

### Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Supabase Backend                     │
│  • PostgreSQL Database (rooms, players)                │
│  • Realtime Server (WebSocket channels)                │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Client  │      │ Client  │      │ Client  │
   │  (Host) │      │ (Player)│      │ (Player)│
   └─────────┘      └─────────┘      └─────────┘
```

## Usage

### Creating a Game

```typescript
import { OnlineNetworkManager } from './online-network';

const networkManager = new OnlineNetworkManager('player-id-123');

// Create a room
const room = await networkManager.createRoom('My Game', 'PlayerName', 2);
console.log('Room ID:', room.id);

// Listen for players joining
networkManager.on(NetworkEvent.PLAYER_JOINED, (data) => {
    console.log('Player joined:', data);
});

// Start the game when ready
await networkManager.startGame();
```

### Joining a Game

```typescript
// List available rooms
const rooms = await networkManager.listRooms();

// Join a room
const success = await networkManager.joinRoom(rooms[0].id, 'PlayerName');

// Set ready status
await networkManager.setReady(true);

// Listen for game start
networkManager.on(NetworkEvent.MESSAGE_RECEIVED, (message) => {
    if (message.type === MessageType.GAME_START) {
        console.log('Game starting!');
    }
});
```

### Sending Commands

```typescript
// Send a single command
await networkManager.sendGameCommand({
    tick: currentTick,
    playerId: 'player-id-123',
    command: 'unit_move',
    data: { x: 100, y: 200 }
});

// Send multiple commands (batched)
await networkManager.sendCommandBatch([
    { tick: 1, playerId: 'player-id-123', command: 'unit_move', data: {...} },
    { tick: 2, playerId: 'player-id-123', command: 'hero_purchase', data: {...} }
]);
```

## Performance Characteristics

### Latency

- **Command propagation**: ~50-100ms (depends on geographic distance)
- **Update rate**: 20 updates/second (50ms intervals)
- **Command batching**: Reduces message overhead by ~30%

### Bandwidth

- **Per command**: ~50 bytes (after compression)
- **Per second**: ~1KB (20 commands/sec average)
- **Per minute**: ~60KB
- **10-minute game**: ~600KB per player

### Scalability

- **Players per room**: 2-8 (configurable)
- **Concurrent rooms**: Limited by Supabase plan
- **Message throughput**: 20 events/sec per connection (Supabase limit)

## Migration from LAN Play

The online network manager is designed to be compatible with the existing LAN network manager interface:

```typescript
// LAN Play
const lanManager = new NetworkManager(playerId);

// Online Play
const onlineManager = new OnlineNetworkManager(playerId);

// Both support similar APIs:
// - createLobby() / createRoom()
// - sendGameCommand()
// - on(NetworkEvent, callback)
// - disconnect()
```

The menu system can be extended to support both modes.

## Security Considerations

### Current Implementation (Beta)

- Uses Supabase anon key (safe for client-side use)
- Row Level Security (RLS) policies protect data
- No authentication required (anonymous play)

### Future Improvements

- User authentication via Supabase Auth
- Anti-cheat validation (state hash verification)
- Rate limiting on commands
- Encrypted game state
- Player reputation system

## Troubleshooting

### "Supabase not configured" Error

Ensure environment variables are set:
```bash
export SUPABASE_URL="your-url"
export SUPABASE_ANON_KEY="your-key"
```

### Connection Issues

1. Check Supabase project status
2. Verify network connectivity
3. Check browser console for errors
4. Ensure database schema is created

### Desyncs

If game states diverge between clients:
1. Ensure all clients use same game version
2. Verify deterministic random number generation
3. Check command execution order
4. Enable state hash logging for debugging

## Future Roadmap

### Phase 1 (Current)
- ✅ Basic room creation and joining
- ✅ Command synchronization
- ✅ Bandwidth optimization

### Phase 2
- [ ] State hash verification
- [ ] Reconnection handling
- [ ] Spectator mode
- [ ] Replay system

### Phase 3
- [ ] Matchmaking system
- [ ] Player rankings
- [ ] Tournament support
- [ ] Cross-region optimization

### Phase 4 (Post-Beta)
- [ ] Migrate to dedicated game server
- [ ] Custom WebSocket protocol
- [ ] Advanced anti-cheat
- [ ] Professional hosting

## Testing

### Local Testing

To test online play locally:

1. Open two browser windows
2. Configure Supabase credentials
3. Create a room in first window
4. Join room in second window
5. Start game and verify synchronization

### Load Testing

Monitor Supabase dashboard for:
- Realtime connections
- Database queries
- Message throughput
- Error rates

## Contributing

When contributing to online play:

1. Test with realistic network conditions (throttling)
2. Verify bandwidth usage stays minimal
3. Ensure deterministic behavior
4. Add appropriate error handling
5. Update this documentation

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Game Networking in RTS](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/)
- [Deterministic Lockstep](https://gafferongames.com/post/deterministic_lockstep/)
