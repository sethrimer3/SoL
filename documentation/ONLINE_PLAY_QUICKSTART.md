# Online Play - Quick Reference

## Setup (One-Time)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Get URL and anon key from Settings > API

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set Up Database**
   - Open Supabase SQL Editor
   - Run `supabase.sql`
   - For anonymous access, uncomment alternative policies

4. **Build**
   ```bash
   npm install
   npm run build
   ```

## Usage

### Host a Game

```typescript
import { OnlineNetworkManager } from './online-network';

const manager = new OnlineNetworkManager('player-id');
const room = await manager.createRoom('Game Name', 'PlayerName', 2);
console.log('Room ID:', room.id);

// Listen for players
manager.on(NetworkEvent.PLAYER_JOINED, (data) => {
    console.log('Player joined:', data);
});

// Start when ready
await manager.startGame();
```

### Join a Game

```typescript
const manager = new OnlineNetworkManager('player-id');

// Browse rooms
const rooms = await manager.listRooms();

// Join a room
await manager.joinRoom(rooms[0].id, 'PlayerName');
await manager.setReady(true);

// Listen for game start
manager.on(NetworkEvent.MESSAGE_RECEIVED, (message) => {
    if (message.type === MessageType.GAME_START) {
        // Game started!
    }
});
```

### Send Commands

```typescript
// Single command
await manager.sendGameCommand({
    tick: currentTick,
    playerId: manager.getLocalPlayerId(),
    command: 'unit_move',
    data: { x: 100, y: 200 }
});

// Batch commands (more efficient)
await manager.sendCommandBatch([
    { tick: 1, playerId: 'p1', command: 'unit_move', data: {...} },
    { tick: 2, playerId: 'p1', command: 'hero_purchase', data: {...} }
]);
```

### Receive Commands

```typescript
manager.on(NetworkEvent.MESSAGE_RECEIVED, (message) => {
    if (message.type === MessageType.GAME_COMMAND) {
        const command = message.data as GameCommand;
        executeGameCommand(command);
    }
});
```

## Command Types

- `unit_move` → `um` - Move units to position
- `unit_ability` → `ua` - Activate unit ability
- `unit_path` → `up` - Set multi-waypoint path
- `hero_purchase` → `hp` - Buy hero unit
- `building_purchase` → `bp` - Build structure
- `mirror_purchase` → `mp` - Build solar mirror
- `mirror_move` → `mm` - Move mirrors
- `mirror_link` → `ml` - Link mirror to structure
- `forge_move` → `fm` - Move stellar forge
- `set_rally_path` → `sr` - Set minion spawn path

## Performance Targets

- **Latency**: < 200ms
- **Bandwidth**: ~1KB/sec
- **Command Size**: ~50 bytes
- **Update Rate**: 20/sec

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Supabase not configured" | Set env vars, rebuild |
| "Failed to create room" | Run database schema |
| "Not connected" | Check Supabase status |
| High latency | Check region, reduce frequency |

## Files

- `src/online-network.ts` - Main implementation
- `src/supabase-config.ts` - Configuration
- `src/online-play-example.ts` - Integration examples
- `supabase.sql` - Database schema
- `ONLINE_PLAY.md` - Full documentation
- `SUPABASE_CONFIG.md` - Setup guide
- `TESTING_ONLINE_PLAY.md` - Testing guide

## Next Steps

1. Configure Supabase credentials
2. Test room creation/joining
3. Integrate with game menu
4. Connect to game commands
5. Test with 2 players
6. Monitor bandwidth and latency

## Support

See `ONLINE_PLAY_SUMMARY.md` for complete implementation details.
