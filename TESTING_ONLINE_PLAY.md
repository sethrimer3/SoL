# Testing Online Play

## Manual Testing Guide

### Prerequisites

1. Set up Supabase project and configure credentials
2. Run the database schema from `supabase.sql`
3. Build the project: `npm run build`
4. Serve locally or deploy

### Test Scenarios

#### 1. Room Creation Test

**Steps:**
1. Open the game in browser
2. Navigate to online play menu
3. Click "Create Room"
4. Enter room name and player name
5. Verify room appears in database (Supabase dashboard)

**Expected Results:**
- Room created successfully
- Room ID displayed
- Room status is "waiting"
- Host player added to room_players table

#### 2. Room Joining Test

**Steps:**
1. Open game in first browser window (Host)
2. Create a room and note the room ID
3. Open game in second browser window (Client)
4. Browse available rooms
5. Join the room using room ID
6. Verify both players see each other

**Expected Results:**
- Client can see available rooms
- Client joins successfully
- Both windows show both players
- Database shows 2 players in room_players

#### 3. Command Synchronization Test

**Steps:**
1. Set up a room with 2 players
2. Host starts the game
3. Player 1 sends a unit movement command
4. Verify Player 2 receives the command
5. Check console logs for command data

**Expected Results:**
- Commands sent from Player 1 appear on Player 2's console
- Commands execute at correct tick
- No commands lost or duplicated
- Latency is reasonable (< 200ms)

#### 4. Bandwidth Usage Test

**Steps:**
1. Open browser DevTools > Network tab
2. Start an online game
3. Play for 1 minute, issuing commands regularly
4. Check total data transferred

**Expected Results:**
- ~1KB per second (60KB per minute)
- Average command size ~50 bytes
- No excessive data transfer

#### 5. Disconnection Test

**Steps:**
1. Set up a room with 2 players
2. Start the game
3. Close one player's browser
4. Check other player's behavior
5. Check database for cleanup

**Expected Results:**
- Disconnected player removed from room
- Connection error handled gracefully
- No crashes or infinite loops

#### 6. Multiple Rooms Test

**Steps:**
1. Open 4 browser windows
2. Create 2 separate rooms
3. Have 2 players join each room
4. Start both games simultaneously
5. Verify commands don't cross between rooms

**Expected Results:**
- Each room operates independently
- No command leakage between rooms
- Each room has its own channel
- Database shows 2 active rooms

### Performance Benchmarks

#### Target Metrics

- **Command Latency**: < 100ms (same region)
- **Command Latency**: < 200ms (cross-region)
- **Bandwidth**: ~1KB/sec per player
- **Commands/sec**: 20 (with batching)
- **Connection Time**: < 2 seconds

#### Measuring Performance

Use browser console:

```javascript
// Measure command round-trip time
const startTime = performance.now();
await networkManager.sendGameCommand(command);
// On receive:
const latency = performance.now() - startTime;
console.log('Latency:', latency, 'ms');
```

### Common Issues and Solutions

#### Issue: "Supabase not configured"

**Solution:** 
- Set environment variables: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Rebuild project: `npm run build`

#### Issue: "Failed to create room"

**Possible Causes:**
- Database schema not created
- Invalid Supabase credentials
- Network connectivity issues
- Row Level Security (RLS) blocking access

**Solution:**
- Run `supabase.sql` in Supabase SQL Editor
- Verify credentials are correct
- Check Supabase dashboard for errors
- For development, may need to adjust RLS policies for anon access

#### Issue: "Commands not received"

**Possible Causes:**
- Not subscribed to channel
- Channel name mismatch
- Realtime not enabled in Supabase

**Solution:**
- Check Supabase > Database > Realtime is enabled
- Verify channel subscription in console logs
- Check for JavaScript errors in console

#### Issue: High bandwidth usage

**Possible Causes:**
- Sending full game state instead of commands
- Too frequent updates
- Large data objects in commands

**Solution:**
- Use command replication, not state sync
- Batch commands when possible
- Minimize data in command objects
- Use abbreviated keys

#### Issue: Desyncs between players

**Possible Causes:**
- Non-deterministic game logic
- Different execution order
- Missing commands
- Floating point precision issues

**Solution:**
- Ensure deterministic random number generation
- Execute commands in tick order
- Implement state hash verification
- Use fixed-point math for positions

### Deterministic Replay Snippet (Foundry Regen Upgrade)

Use the following command sequence to validate that Regen upgrades stay deterministic across peers
(state hashes should match on every `STATE_HASH_TICK_INTERVAL` step):

```text
Tick 120: building_purchase { buildingType: "Foundry", positionX: 200, positionY: 0 }
Tick 600: foundry_regen_upgrade { buildingId: 0 }
Tick 650: unit_move { unitIds: ["starling-0"], targetX: 0, targetY: 0 }
```

### Deterministic Replay Snippet (Foundry +1 ATK Upgrade)

Use the following command sequence to validate that +1 ATK upgrades stay deterministic across peers
(state hashes should match on every `STATE_HASH_TICK_INTERVAL` step):

```text
Tick 120: building_purchase { buildingType: "Foundry", positionX: 200, positionY: 0 }
Tick 600: foundry_attack_upgrade { buildingId: 0 }
Tick 650: unit_target_structure { unitIds: ["starling-0"], targetPlayerIndex: 1, structureType: "forge", structureIndex: 0 }
```

### Deterministic Replay Snippet (Forge Blink Upgrade)

Use the following command sequence to validate that Blink upgrades stay deterministic across peers
(state hashes should match on every `STATE_HASH_TICK_INTERVAL` step):

```text
Tick 120: forge_blink_upgrade { }
Tick 240: unit_move { unitIds: ["starling-0"], targetX: 120, targetY: 0 }
Tick 480: unit_move { unitIds: ["starling-0"], targetX: 240, targetY: 0 }
```

### Automated Testing (Future)

Create unit tests for:

```typescript
// Test command compression
test('compactCommand reduces size by 50%', () => {
    const command = createTestCommand();
    const compact = compactCommand(command);
    expect(JSON.stringify(compact).length)
        .toBeLessThan(JSON.stringify(command).length * 0.5);
});

// Test command expansion
test('expandCommand restores original', () => {
    const command = createTestCommand();
    const compact = compactCommand(command);
    const expanded = expandCommand(compact);
    expect(expanded.command).toBe(command.command);
    expect(expanded.tick).toBe(command.tick);
});

// Test room creation
test('createRoom returns valid room', async () => {
    const manager = new OnlineNetworkManager('test-player');
    const room = await manager.createRoom('Test', 'Player', 2);
    expect(room).not.toBeNull();
    expect(room.host_id).toBe('test-player');
});
```

### Load Testing

For production readiness, test with:

- 10+ concurrent rooms
- 100+ commands per second
- Sustained 5+ minute games
- Simulated network latency (Chrome DevTools)
- Simulated packet loss

### Security Testing

Verify:

1. Row Level Security policies work correctly
2. Players can't modify other players' data
3. Commands are validated server-side (future)
4. No SQL injection vulnerabilities
5. Rate limiting prevents spam (future)

## Debugging Tips

### Enable Verbose Logging

```typescript
// In browser console
localStorage.setItem('debug-online-network', 'true');
```

### Monitor Supabase

1. Go to Supabase Dashboard
2. Check Database > Tables for data
3. Check Logs for errors
4. Check Realtime for active connections

### Network Inspection

1. Open Chrome DevTools > Network
2. Filter by "WS" (WebSocket)
3. Inspect WebSocket frames
4. Check message sizes and frequency

### Performance Profiling

1. Chrome DevTools > Performance
2. Record during gameplay
3. Look for bottlenecks
4. Check frame rates and jank
