# P2P Multiplayer - Integration TODO

This document outlines the remaining work needed to fully integrate the P2P multiplayer system with the existing SoL game.

## ✅ Completed

- [x] Supabase database schema (`supabase-p2p-schema.sql`)
- [x] Seeded RNG module (`seeded-random.ts`)
- [x] Transport abstraction layer (`transport.ts`)
- [x] P2P transport implementation (`p2p-transport.ts`)
- [x] Multiplayer network manager (`multiplayer-network.ts`)
- [x] Command queue system with deterministic ordering
- [x] Match lifecycle management (create, join, start, end)
- [x] WebRTC signaling via Supabase
- [x] Comprehensive documentation
- [x] Integration examples

## 🚧 TODO: Core Integration

### 1. Replace Math.random() with Seeded RNG

**Priority: HIGH** - Required for determinism

**Status: ✅ COMPLETE**

**Files checked**:
- [x] Identified usage in `src/renderer.ts` (stars, visual effects only - safe)
- [x] Searched all game logic files for `Math.random()`
- [x] Confirmed: No Math.random() in gameplay logic (src/sim, heroes, etc.)
- [x] Only in renderer (visual effects), menu (UI), and ID generation (network) - all non-gameplay

**Conclusion**: Game logic is already using seeded RNG appropriately. Visual effects using Math.random() is acceptable as it doesn't affect determinism.

### 2. Integrate Command System with GameState

**Priority: HIGH** - Required for multiplayer to work

**Status: ✅ COMPLETE**

**File**: `src/sim/game-state.ts`

**Completed tasks**:
- [x] Add command execution methods to GameState class
- [x] Map command types to game actions
- [x] Ensure all player actions generate commands in multiplayer mode
- [x] Test command execution produces deterministic results
- [x] Added executeCommand(cmd: P2PGameCommand) for single commands
- [x] Added executeCommands(commands: P2PGameCommand[]) for batch execution
- [x] Created efficient playersByName map for O(1) player lookups
- [x] Refactored shared command routing logic
- [x] Support for all 20+ command types

### 3. Add Multiplayer Mode to Main Game Loop

**Priority: HIGH** - Required for multiplayer to work

**Status: ✅ COMPLETE**

**File**: `src/main.ts`

**Completed tasks**:
- [x] Add multiplayer mode flag (isMultiplayer)
- [x] Initialize MultiplayerNetworkManager
- [x] Integrate command synchronization with game loop
- [x] Switch between single-player and multiplayer update logic
- [x] Added fixed timestep with tick accumulator (30 ticks/second)
- [x] Added updateMultiplayer() method with command synchronization
- [x] Added network event handlers (MATCH_STARTED, etc.)
- [x] Added sendNetworkCommand() routing for LAN and P2P
- [x] Full backwards compatibility with existing LAN mode

### 4. Add Multiplayer Menu UI

**Priority: MEDIUM** - Required for usability

**Status: ✅ COMPLETE**

**File**: `src/menu.ts`

**Completed tasks**:
- [x] Add "P2P Multiplayer" option to game mode menu
- [x] Create match creation UI (host)
  - Match name input
  - Max players selection (2-8)
  - Create match button
  - Display match code for sharing
  - Player list with real-time updates
- [x] Create match browser/join UI (client)
  - Match code input field
  - Join button
  - Connection status messages
- [x] Create lobby UI (waiting for players)
  - Player list showing all connected players
  - Player roles (host/client)
  - "Waiting for host to start..." message for clients
- [x] Add "Start Match" button (host only)
- [x] Wire up all network events
- [x] Error handling and status messages
- [x] Cleanup on navigation/cancel

### 5. Add Supabase Configuration

**Priority: MEDIUM** - Required for deployment

**Status: ✅ COMPLETE**

**File**: `src/supabase-config.ts`

**Completed tasks**:
- [x] getSupabaseConfig() uses environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
- [x] Fallback warnings when not configured
- [x] isSupabaseConfigured() helper method
- [x] Webpack DefinePlugin configured to inject env vars at build time
- [x] .env.example provided with instructions
- [x] Documentation in README.md

**Configuration method**:
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-public-key-here
npm run build
```

## 🔍 TODO: Testing & Validation

### 6. Determinism Testing

**Priority: HIGH** - Critical for correctness

**Status: ✅ COMPLETE**

**Tasks**:
- [x] Create determinism test suite
- [x] Test that same seed + commands = same state
- [x] Test seeded RNG produces identical sequences
- [x] Add state hash generation (already in GameState.stateHash)
- [x] Compare state hashes across runs

**File**: `test-multiplayer-determinism.ts`

**Tests Implemented**:
1. **Seeded RNG Determinism** - Verifies SeededRandom produces identical sequences
2. **RNG Method Determinism** - Tests nextInt, nextFloat, nextBool, choice, shuffle, nextAngle
3. **Game State Idle Determinism** - Runs empty simulation twice, verifies identical results
4. **Game State Command Determinism** - Executes identical commands, verifies states match
5. **Different Seeds Test** - Confirms different seeds can produce different outcomes
6. **Command Order Test** - Validates command execution order handling

**Usage**:
```bash
npm run build
npx tsc test-multiplayer-determinism.ts --outDir dist --esModuleInterop --module commonjs --target ES2020 --skipLibCheck
node dist/test-multiplayer-determinism.js
```

**Results**: All 6 tests passing ✓

### 7. P2P Connection Testing

**Priority: MEDIUM** - Required for deployment

**Status: 📝 DOCUMENTED**

**Prerequisites**:
- Supabase project set up with `supabase-p2p-schema.sql`
- Environment variables configured (SUPABASE_URL, SUPABASE_ANON_KEY)
- Project built with `npm run build`

**Manual Test Procedure**:

1. **Build and Serve**:
   ```bash
   npm run build
   cd dist
   python3 -m http.server 8080
   ```

2. **Open Two Browser Windows**:
   - Window 1 (Host): `http://localhost:8080`
   - Window 2 (Client): `http://localhost:8080`

3. **Create Match (Window 1)**:
   - Select "P2P Multiplayer" from main menu
   - Click "Host Match"
   - Enter match name
   - Select max players (2-8)
   - Click "Create Match"
   - **Copy the match code displayed** (6-character code)
   - Wait in lobby (you should see yourself listed as host)

4. **Join Match (Window 2)**:
   - Select "P2P Multiplayer" from main menu
   - Click "Join Match"
   - Paste the match code
   - Click "Join"
   - Wait for connection (you should appear in host's lobby)

5. **Start Match (Window 1)**:
   - Verify both players visible in lobby
   - Click "Start Match"
   - Game should begin for both players

6. **Test Gameplay**:
   - **Command Synchronization**: Issue commands in both windows
     - Move units
     - Build structures
     - Use abilities
   - **Verify**: Commands appear on both clients
   - **Check Console**: Monitor for synchronization errors

7. **Test Network Conditions** (Optional):
   - Open browser DevTools → Network tab
   - Enable throttling (Slow 3G, Fast 3G)
   - Verify gameplay continues (may lag but should stay synced)

8. **Test Reconnection** (Phase 2):
   - Disconnect/reconnect network
   - Verify game recovers (or shows appropriate error)

**Expected Results**:
- ✓ WebRTC connection established
- ✓ Match code successfully shared and joined
- ✓ Both players see each other in lobby
- ✓ Game starts simultaneously on both clients
- ✓ Commands executed on both clients in same order
- ✓ Game state remains synchronized (same units, positions, etc.)

**Common Issues & Solutions**:
- **"Match not found"**: Check Supabase configuration, verify schema applied
- **"Connection failed"**: Check browser console for WebRTC errors, verify STUN/TURN servers
- **Desync issues**: Run determinism tests, check for Math.random() usage
- **High latency**: Expected on first connection, should improve after ICE negotiation

**Monitoring**:
- Check browser console for errors
- Monitor Supabase realtime dashboard for connection status
- Check network tab for signaling messages
- Verify game state hashes match periodically (in console)

**Success Criteria**:
- 2 players can consistently connect and play
- No desync errors during 5+ minute session
- Commands execute within 1 second across network
- Connection stable under normal network conditions

**Tasks**:
- [ ] Complete manual test procedure with real Supabase setup
- [ ] Document any issues found
- [ ] Test with different network conditions
- [ ] Test with 3-4 players (if supported)
- [ ] Verify error messages are user-friendly

### 8. Load Testing

**Priority: LOW** - Optional for Phase 1

**Status: 📝 DOCUMENTED**

**Purpose**: Verify system performance and identify bottlenecks under realistic load conditions.

**Test Scenarios**:

#### Scenario 1: 2-Player Match (Baseline)
- **Setup**: 2 players, standard game
- **Duration**: 10 minutes
- **Metrics to Monitor**:
  - Frame rate (should stay at 60 FPS)
  - Network latency (WebRTC RTT)
  - Command queue depth
  - Memory usage
  - Supabase bandwidth (signaling only)

#### Scenario 2: 4-Player Match
- **Setup**: 4 players, 4 browser windows
- **Duration**: 10 minutes  
- **Metrics**: Same as Scenario 1
- **Expected**: Slight increase in command processing, network load

#### Scenario 3: 8-Player Match (Stress Test)
- **Setup**: 8 players (maximum)
- **Duration**: 5-10 minutes
- **Metrics**: Same as Scenario 1
- **Expected**: Higher command queue processing, increased bandwidth
- **Goal**: Verify system doesn't break under max load

#### Scenario 4: High-Action Gameplay
- **Setup**: 2-4 players
- **Actions**: Continuous unit commands, building, combat
- **Duration**: 5 minutes
- **Metrics**: Command throughput, queue latency
- **Goal**: Test command system under rapid input

#### Scenario 5: Poor Network Conditions
- **Setup**: 2 players
- **Network**: Throttle to Slow 3G (DevTools)
- **Duration**: 5 minutes
- **Metrics**: Command delay, desync frequency, user experience
- **Goal**: Verify graceful degradation

**Monitoring Tools**:
```javascript
// Add to browser console during testing
setInterval(() => {
    console.log({
        fps: /* get from renderer */,
        commandQueueDepth: /* from multiplayer network manager */,
        memoryMB: performance.memory.usedJSHeapSize / 1048576,
        transportStats: /* from transport.getStats() */
    });
}, 5000); // Log every 5 seconds
```

**Bandwidth Estimation**:
- **Supabase (Signaling)**: ~1-5 KB/s during connection, ~0.1 KB/s after
- **P2P Data (Commands)**: ~0.5-2 KB/s per player connection
- **Total for 4 players**: ~10-15 KB/s (very light)

**Performance Targets**:
- **Frame Rate**: 60 FPS (no drops below 55 FPS)
- **Command Latency**: <100ms local, <500ms over internet
- **Memory**: <200 MB for 10-minute session
- **Network**: <50 KB/s per player
- **Desync Rate**: 0% (any desync is critical bug)

**Load Testing Tools** (Optional):
- **Browser DevTools Performance Tab**: Record game session, analyze
- **Supabase Dashboard**: Monitor realtime connections, bandwidth
- **Custom Metrics Script**: Log game stats to file for analysis

**Tasks**:
- [ ] Test with 2 players (baseline)
- [ ] Test with 4 players
- [ ] Test with 8 players (if needed)
- [ ] Monitor Supabase bandwidth usage
- [ ] Monitor P2P bandwidth usage  
- [ ] Test with poor network conditions (throttling)
- [ ] Test command queue behavior under lag
- [ ] Document performance metrics
- [ ] Identify any bottlenecks
- [ ] Optimize if needed (Phase 2)

**Success Criteria**:
- Game playable with 4 players simultaneously
- No performance degradation over 10-minute session
- Network usage within acceptable limits
- No memory leaks detected
- Graceful handling of network issues

**Notes**:
- Load testing is not critical for Phase 1 MVP
- Can be deferred until after initial multiplayer release
- Most valuable after gathering real-world usage data

## 🚀 TODO: Phase 2 Features

### 9. Server Relay Transport

**Priority: Phase 2**

**File**: `src/server-relay-transport.ts`

**Tasks**:
- [ ] Implement ServerRelayTransport class
- [ ] Create dedicated game server
- [ ] Add WebSocket server for command relay
- [ ] Update MultiplayerNetworkManager to choose transport
- [ ] Test with lockstep_enabled flag

### 10. State Hash Verification

**Priority: Phase 2**

**File**: `src/state-verification.ts`

**Tasks**:
- [ ] Implement deterministic state hash generation
- [ ] Add hash exchange every N ticks
- [ ] Implement hash comparison logic
- [ ] Add desync detection
- [ ] Add desync recovery (replay from last good state)

### 11. Anti-Cheat System

**Priority: Phase 2**

**File**: `src/anti-cheat.ts`

**Tasks**:
- [ ] Add command signature generation/verification
- [ ] Add server-side command validation
- [ ] Check if player can afford actions
- [ ] Check if actions are legal in current state
- [ ] Rate limiting enforcement
- [ ] Ban system for detected cheaters

## 📝 TODO: Documentation & Polish

### 12. Update Existing Documentation

**Tasks**:
- [x] Update main README.md with P2P multiplayer section (with setup instructions)
- [x] Update MULTIPLAYER_INTEGRATION_TODO.md with completion status
- [ ] Update ARCHITECTURE.md with multiplayer integration details
- [ ] Add multiplayer to GAME_DESIGN.md
- [ ] Create TROUBLESHOOTING.md for common issues (optional)

### 13. Add TypeScript Types

**Tasks**:
- [ ] Ensure all functions have proper type annotations
- [ ] Add JSDoc comments to public APIs
- [ ] Export types for external use
- [ ] Fix any `any` types with proper types

### 14. Performance Optimization

**Tasks**:
- [ ] Profile command serialization/deserialization
- [ ] Optimize command payload sizes
- [ ] Add command batching (send multiple per message)
- [ ] Compress command payloads if needed
- [ ] Lazy-load multiplayer modules

## 🔧 TODO: DevOps & Deployment

### 15. CI/CD Integration

**Tasks**:
- [ ] Add TypeScript compilation to CI
- [ ] Add determinism tests to CI
- [ ] Add build size checks
- [ ] Automate Supabase schema migration

### 16. Production Configuration

**Tasks**:
- [ ] Set up production Supabase project
- [ ] Configure RLS policies for production
- [ ] Set up environment variable management
- [ ] Add error tracking (Sentry, etc.)
- [ ] Add analytics for multiplayer usage

### 17. Monitoring & Logging

**Tasks**:
- [ ] Add structured logging
- [ ] Add metrics collection (match duration, player count, etc.)
- [ ] Monitor Supabase usage
- [ ] Monitor P2P connection success rate
- [ ] Add error aggregation

## 📋 Quick Start Checklist

To get multiplayer working quickly:

1. **Database Setup** (5 min) ✅
   - [x] Run `supabase-p2p-schema.sql` in Supabase SQL Editor
   - [x] Enable anonymous policies (comment section in schema)

2. **Configuration** (2 min) ✅
   - [x] Set SUPABASE_URL environment variable
   - [x] Set SUPABASE_ANON_KEY environment variable

3. **Core Integration** (2-4 hours) ✅
   - [x] Replace Math.random() in game logic with seeded RNG (VERIFIED: Already using seeded RNG)
   - [x] Add command execution to GameState
   - [x] Add multiplayer mode to main game loop

4. **UI Integration** (2-4 hours) ✅
   - [x] Add multiplayer menu UI
   - [x] Add lobby UI
   - [x] Wire up network events

5. **Testing** (1-2 hours) 🚧
   - [ ] Test P2P connection locally
   - [ ] Test command synchronization
   - [x] Test determinism (test suite created and passing)

**Status**: Core implementation complete! Determinism verified. Ready for P2P connection testing.

## 🎯 Minimal Viable Multiplayer (MVM)

**Status: ✅ COMPLETE**

To ship the fastest:

1. Replace Math.random() ✅ Critical - VERIFIED: Game logic already using seeded RNG
2. Integrate command system ✅ Critical - executeCommand/executeCommands implemented
3. Add multiplayer game loop ✅ Critical - Fixed timestep with command sync implemented
4. Add basic menu UI ✅ Critical - Host/Join/Lobby screens implemented
5. Test with 2 players 🚧 Critical - Ready for testing

**Next Steps**: Testing with real Supabase configuration

Everything else can be Phase 2!

## 📚 Resources

- Architecture: `P2P_MULTIPLAYER_ARCHITECTURE.md`
- Quick Start: `MULTIPLAYER_QUICKSTART.md`
- Example: `src/multiplayer-example.ts`
- Schema: `supabase-p2p-schema.sql`

## Support

For questions or issues:
1. Check console for errors
2. Review architecture docs
3. Test determinism
4. Open GitHub issue with:
   - Browser/OS
   - Console errors
   - Steps to reproduce
