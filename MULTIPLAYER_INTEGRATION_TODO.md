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

**Files to update**:
- [x] Identified usage in `src/renderer.ts` (stars, visual effects only - safe)
- [ ] Search all game logic files for `Math.random()`
- [ ] Replace with `getGameRNG().next()` or similar
- [ ] Test that same seed produces same gameplay

**Commands**:
```bash
# Find all Math.random() usage in game logic (excluding renderer)
grep -r "Math.random" src/sim --include="*.ts"
grep -r "Math.random" src/game-core.ts

# Each usage needs review:
# - Visual only? Can keep Math.random()
# - Affects gameplay? Must use seeded RNG
```

**Example replacement**:
```typescript
// Before (nondeterministic)
const damage = Math.random() * 10;

// After (deterministic)
import { getGameRNG } from './seeded-random';
const rng = getGameRNG();
const damage = rng.nextFloat(0, 10);
```

### 2. Integrate Command System with GameState

**Priority: HIGH** - Required for multiplayer to work

**File**: `src/sim/game-state.ts`

**Tasks**:
- [ ] Add command execution methods to GameState class
- [ ] Map command types to game actions
- [ ] Ensure all player actions generate commands in multiplayer mode
- [ ] Test command execution produces deterministic results

**Example additions to game-state.ts**:
```typescript
import { GameCommand } from '../transport';
import { getGameRNG } from '../seeded-random';

export class GameState {
    // ... existing code ...

    /**
     * Execute a game command (deterministic)
     */
    executeCommand(cmd: GameCommand): void {
        const rng = getGameRNG();
        
        switch (cmd.commandType) {
            case 'move_unit':
                this.moveUnit(cmd.payload.unitId, cmd.payload.x, cmd.payload.y);
                break;
                
            case 'build_structure':
                this.buildStructure(
                    cmd.playerId, 
                    cmd.payload.type, 
                    cmd.payload.x, 
                    cmd.payload.y
                );
                break;
                
            case 'purchase_hero':
                this.purchaseHero(cmd.playerId, cmd.payload.heroType);
                break;
                
            case 'select_mirror':
                this.selectMirror(cmd.payload.playerIndex, cmd.payload.mirrorIndex);
                break;
                
            // Add all existing commands from ARCHITECTURE.md
        }
    }

    /**
     * Execute multiple commands (for a tick)
     */
    executeCommands(commands: GameCommand[]): void {
        commands.forEach(cmd => this.executeCommand(cmd));
    }
}
```

### 3. Add Multiplayer Mode to Main Game Loop

**Priority: HIGH** - Required for multiplayer to work

**File**: `src/main.ts`

**Tasks**:
- [ ] Add multiplayer mode flag
- [ ] Initialize MultiplayerNetworkManager
- [ ] Integrate command synchronization with game loop
- [ ] Switch between single-player and multiplayer update logic

**Example changes to main.ts**:
```typescript
import { MultiplayerNetworkManager, NetworkEvent } from './multiplayer-network';
import { setGameRNG, SeededRandom } from './seeded-random';

class Game {
    private network: MultiplayerNetworkManager | null = null;
    private isMultiplayer = false;
    private tickAccumulator = 0;
    private readonly TICK_MS = 33.33; // 30 Hz
    
    // ... existing code ...
    
    initMultiplayer(supabaseUrl: string, supabaseKey: string, playerId: string) {
        this.network = new MultiplayerNetworkManager(supabaseUrl, supabaseKey, playerId);
        this.isMultiplayer = true;
        
        // Setup events
        this.network.on(NetworkEvent.MATCH_STARTED, (data) => {
            // Seed already set by network manager
            this.startGame();
        });
        
        this.network.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            // Commands automatically queued
        });
    }
    
    update(deltaTime: number) {
        if (this.isMultiplayer && this.network) {
            this.updateMultiplayer(deltaTime);
        } else {
            this.updateSinglePlayer(deltaTime);
        }
    }
    
    updateMultiplayer(deltaTime: number) {
        this.tickAccumulator += deltaTime;
        
        while (this.tickAccumulator >= this.TICK_MS) {
            const commands = this.network!.getNextTickCommands();
            
            if (commands) {
                // Execute synchronized commands
                this.gameState.executeCommands(commands);
                
                // Advance tick
                this.network!.advanceTick();
                
                // Update game state
                this.gameState.updateTick();
                
                this.tickAccumulator -= this.TICK_MS;
            } else {
                // Waiting for commands, don't advance
                break;
            }
        }
    }
    
    updateSinglePlayer(deltaTime: number) {
        // Existing single-player logic
        this.gameState.update(deltaTime);
    }
    
    handlePlayerAction(actionType: string, payload: any) {
        if (this.isMultiplayer && this.network) {
            // Send command to network
            this.network.sendCommand(actionType, payload);
        } else {
            // Execute immediately
            this.gameState.executeCommand({
                tick: 0,
                playerId: 'local',
                commandType: actionType,
                payload: payload
            });
        }
    }
}
```

### 4. Add Multiplayer Menu UI

**Priority: MEDIUM** - Required for usability

**File**: `src/menu.ts` or create `src/multiplayer-menu.ts`

**Tasks**:
- [ ] Add "Multiplayer" button to main menu
- [ ] Create match creation UI (host)
- [ ] Create match browser/join UI (client)
- [ ] Create lobby UI (waiting for players)
- [ ] Add "Start Match" button (host only)

**UI Flow**:
```
Main Menu
├─ Single Player (existing)
├─ Multiplayer (NEW)
│  ├─ Host Match
│  │  ├─ Enter match name
│  │  ├─ Enter username
│  │  ├─ Select max players (2-8)
│  │  └─ Create → Show lobby
│  └─ Join Match
│     ├─ Browse available matches
│     ├─ OR Enter match ID
│     ├─ Enter username
│     └─ Join → Show lobby
└─ Settings (existing)

Lobby (NEW)
├─ Match ID (for sharing)
├─ Connected players list
├─ Start Match button (host only)
└─ Leave button
```

### 5. Add Supabase Configuration

**Priority: MEDIUM** - Required for deployment

**File**: `src/supabase-config.ts` (update existing file)

**Tasks**:
- [ ] Update `getSupabaseConfig()` to use environment variables
- [ ] Add fallback for development
- [ ] Document configuration in README

**Example**:
```typescript
export function getSupabaseConfig() {
    return {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || ''
    };
}

export function isSupabaseConfigured(): boolean {
    const config = getSupabaseConfig();
    return config.url !== '' && config.anonKey !== '';
}
```

## 🔍 TODO: Testing & Validation

### 6. Determinism Testing

**Priority: HIGH** - Critical for correctness

**Tasks**:
- [ ] Create determinism test suite
- [ ] Test that same seed + commands = same state
- [ ] Test seeded RNG produces identical sequences
- [ ] Add state hash generation
- [ ] Compare state hashes across runs

**File**: `test-multiplayer-determinism.ts`
```typescript
import { SeededRandom, setGameRNG } from './src/seeded-random';
import { GameState } from './src/sim/game-state';

function testDeterminism() {
    const seed = 12345;
    const commands = [/* ... */];
    
    // Run 1
    setGameRNG(new SeededRandom(seed));
    const state1 = new GameState();
    commands.forEach(cmd => state1.executeCommand(cmd));
    const hash1 = state1.stateHash;
    
    // Run 2
    setGameRNG(new SeededRandom(seed));
    const state2 = new GameState();
    commands.forEach(cmd => state2.executeCommand(cmd));
    const hash2 = state2.stateHash;
    
    console.assert(hash1 === hash2, 'Determinism test failed!');
}
```

### 7. P2P Connection Testing

**Priority: MEDIUM** - Required for deployment

**Tasks**:
- [ ] Test P2P connection between two local browser windows
- [ ] Test WebRTC signaling via Supabase
- [ ] Test ICE candidate exchange
- [ ] Test with network throttling
- [ ] Test reconnection handling (Phase 2)

**Manual Test**:
1. Build project: `npm run build`
2. Serve: `cd dist && python3 -m http.server 8080`
3. Open `localhost:8080` in two browser windows
4. Window 1: Create match → copy match ID
5. Window 2: Join match with ID
6. Window 1: Start match
7. Both windows: Verify P2P connection established
8. Send commands from each window
9. Verify commands appear on both sides

### 8. Load Testing

**Priority: LOW** - Optional for Phase 1

**Tasks**:
- [ ] Test with 4-8 players
- [ ] Monitor Supabase bandwidth usage
- [ ] Monitor P2P bandwidth usage
- [ ] Test with poor network conditions
- [ ] Test command queue behavior under lag

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
- [ ] Update main README.md with multiplayer section
- [ ] Update ARCHITECTURE.md with multiplayer integration
- [ ] Add multiplayer to GAME_DESIGN.md
- [ ] Create TROUBLESHOOTING.md for common issues

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

1. **Database Setup** (5 min)
   - [ ] Run `supabase-p2p-schema.sql` in Supabase SQL Editor
   - [ ] Enable anonymous policies (comment section in schema)

2. **Configuration** (2 min)
   - [ ] Set SUPABASE_URL environment variable
   - [ ] Set SUPABASE_ANON_KEY environment variable

3. **Core Integration** (2-4 hours)
   - [ ] Replace Math.random() in game logic with seeded RNG
   - [ ] Add command execution to GameState
   - [ ] Add multiplayer mode to main game loop

4. **UI Integration** (2-4 hours)
   - [ ] Add multiplayer menu UI
   - [ ] Add lobby UI
   - [ ] Wire up network events

5. **Testing** (1-2 hours)
   - [ ] Test P2P connection locally
   - [ ] Test command synchronization
   - [ ] Test determinism

**Total Time Estimate**: 1-2 days for basic multiplayer

## 🎯 Minimal Viable Multiplayer (MVM)

To ship the fastest:

1. Replace Math.random() ✅ Critical
2. Integrate command system ✅ Critical
3. Add multiplayer game loop ✅ Critical
4. Add basic menu UI ✅ Critical
5. Test with 2 players ✅ Critical

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
