# Monolithic File Refactoring Plan
## SoL (Speed of Light) RTS Game

**Document Status**: Active Plan  
**Last Updated**: March 25, 2026  
**Purpose**: Comprehensive plan to refactor large monolithic files without degrading functionality or performance

---

## Executive Summary

The SoL codebase has grown significantly and contains four major monolithic files that require refactoring to improve maintainability, testability, and developer experience. This document outlines a phased approach to systematically extract logical subsystems into well-organized modules.

### Original State (February 2026)

| File | Lines of Code | Primary Responsibility | Complexity |
|------|--------------|------------------------|------------|
| **src/renderer.ts** | 13,658 | Canvas rendering, visual effects, UI drawing | 🔴 Critical |
| **src/sim/game-state.ts** | 6,681 | Game simulation, physics, AI, networking | 🔴 Critical |
| **src/main.ts** | 4,252 | Game controller, input handling, orchestration | 🟡 High |
| **src/menu.ts** | 4,156 | Menu system, lobby management, UI screens | 🟡 High |
| **TOTAL** | **28,747** | | |

**Original Target**: Reduce total to ~18,000 LOC by extracting ~10,700 LOC into focused modules

### Current State (March 2026)

Phases 1–4 are largely complete. The original four monolithic files have been dramatically reduced:

| File | Feb 2026 | Mar 2026 | Reduction | Status |
|------|----------|----------|-----------|--------|
| **src/renderer.ts** | 13,658 | **2,877** | -10,781 (79%) | ✅ Target exceeded |
| **src/sim/game-state.ts** | 6,681 | **955** | -5,726 (86%) | ✅ Target exceeded |
| **src/menu.ts** | 4,156 | **2,400** | -1,756 (42%) | ✅ Target exceeded |
| **src/main.ts** | 4,252 | **1,920** | -2,332 (55%) | 🟡 Near target (1,452) |
| **TOTAL** | **28,747** | **8,152** | **-20,595 (72%)** | |

However, the extractions created several new modules that have themselves grown large. These are tracked in **Phase 5** below.

**New large modules to refactor (Phase 5)**:

| File | LOC | Priority |
|------|-----|----------|
| `src/input/input-controller.ts` | 2,097 | 🔴 High |
| `src/online-network.ts` | 1,663 | 🟡 Medium |
| `src/render/sun-renderer.ts` | 1,608 | 🟢 Low |
| `src/render/hud-renderer.ts` | 1,216 | 🟢 Low |
| `src/render/environment-renderer.ts` | 1,064 | 🟢 Low |

---

## Guiding Principles

### The "Strangler Fig" Pattern
We will use the **Strangler Fig pattern** for safe, incremental refactoring:

1. ✅ **Create new modules alongside existing code** - Don't break what works
2. ✅ **Gradually migrate functionality** - Small, testable changes
3. ✅ **Remove old code only after validation** - Test thoroughly first
4. ✅ **Maintain backwards compatibility** - Zero breaking changes to game functionality

### Core Principles
- **Surgical precision**: Make the smallest possible changes
- **Zero functionality changes**: Pure refactoring only - no new features
- **Performance preservation**: Maintain or improve performance
- **Test after each step**: Build and verify after every extraction
- **Document as you go**: Update documentation with each change

---

## Phase 1: High-Impact, Low-Risk Extractions ✅ COMPLETE

These extractions provide immediate benefits with minimal risk of breaking functionality.

### 1.1 Extract Menu Screen Renderers ✅ DONE

**Target File**: `src/menu.ts` (4,156 LOC)  
**Extraction Size**: ~900 LOC  
**New Module**: `src/menu/screen-renderers/`

**Screens to Extract**:
- `main-menu-screen.ts` - Main menu rendering (~100 LOC)
- `map-selection-screen.ts` - Map picker (~80 LOC)
- `faction-selection-screen.ts` - Faction picker (~120 LOC)
- `loadout-screens.ts` - Loadout customization & selection (~300 LOC)
- `settings-screen.ts` - Settings UI (~150 LOC)
- `game-mode-selection-screen.ts` - Mode picker (~80 LOC)
- `lan-lobby-screen.ts` - LAN lobby (~70 LOC)

**Benefits**:
- Reduces menu.ts by ~22% (900 LOC)
- Screens are self-contained with minimal dependencies
- Each screen can be tested independently
- Improves code navigation dramatically

**Approach**:
```typescript
// Before: In menu.ts
class MainMenu {
  renderMapSelectionScreen() { /* 80 lines */ }
  renderSettingsScreen() { /* 150 lines */ }
  // ... more screens
}

// After: In src/menu/screen-renderers/map-selection-screen.ts
export function renderMapSelectionScreen(menu: MainMenu) {
  // 80 lines of implementation
}
```

**Success Criteria**:
- ✅ Game builds without errors
- ✅ All menu screens render correctly
- ✅ Navigation between screens works
- ✅ Zero visual regressions

---

### 1.2 Extract LAN Lobby Management ✅ DONE

**Target File**: `src/menu.ts` (4,156 LOC)  
**Extraction Size**: ~250 LOC  
**New Module**: `src/menu/lan-lobby-manager.ts`

**Methods to Extract**:
- `loadLanLobbyEntries()`, `persistLanLobbyEntries()`
- `registerLanLobbyEntry()`, `unregisterLanLobbyEntry()`
- `startLanLobbyHeartbeat()`, `stopLanLobbyHeartbeat()`
- `renderLanLobbyList()`, `scheduleLanLobbyListRefresh()`
- `joinLanLobbyWithCode()`, `showHostLobbyDialog()`, `showJoinLobbyDialog()`

**Benefits**:
- Self-contained subsystem with clear boundaries
- Highly testable (persistence, heartbeat logic)
- Reduces menu.ts by ~6% (250 LOC)

**Approach**:
```typescript
// New: src/menu/lan-lobby-manager.ts
export class LanLobbyManager {
  private entries: LanLobbyEntry[] = [];
  private heartbeatInterval?: number;
  
  loadEntries(): LanLobbyEntry[] { /* ... */ }
  persistEntries(entries: LanLobbyEntry[]): void { /* ... */ }
  startHeartbeat(): void { /* ... */ }
  stopHeartbeat(): void { /* ... */ }
}
```

**Success Criteria**:
- ✅ LAN lobby discovery works
- ✅ Heartbeat maintains active lobbies
- ✅ Join/host flows unchanged
- ✅ Lobby list refreshes correctly

---

### 1.3 Extract Player Profile Management ✅ DONE

**Target File**: `src/menu.ts` (4,156 LOC)  
**Extraction Size**: ~150 LOC  
**New Module**: `src/menu/player-profile-manager.ts`

**Methods to Extract**:
- `generateRandomUsername()`, `getOrGenerateUsername()`
- `getOrGeneratePlayerId()`, `saveUsername()`, `validateUsername()`

**Benefits**:
- Clean separation of concerns
- Easier to add user profile features later
- Testable username generation logic

**Success Criteria**:
- ✅ Username persists across sessions
- ✅ Player ID generation consistent
- ✅ Username validation works

---

## Phase 2: Renderer Subsystem Extraction ✅ COMPLETE

The renderer is the largest file and requires careful, methodical extraction.

### 2.1 Extract Starfield & Background Rendering ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~600 LOC  
**New Module**: `src/render/starfield-renderer.ts`

**Content to Extract**:
- Parallax star layer generation
- Background nebula rendering
- Noise functions (`valueNoise2D()`, `fractalNoise2D()`)
- Star core/halo caching
- Palette sampling

**Benefits**:
- Pure rendering logic with no game state dependencies
- Can be optimized independently
- Reduces renderer.ts by ~4%

**Success Criteria**:
- ✅ Starfield renders identically
- ✅ Performance unchanged or improved
- ✅ Nebula gradients cache correctly

---

### 2.2 Extract Sun Rendering System ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~800 LOC  
**New Module**: `src/render/sun-renderer.ts`

**Content to Extract**:
- `drawSun()`, `drawUltraSun()`, `drawLadSun()`
- Volumetric shaft rendering
- Lens flare effects
- Sun particle layers
- Bloom effects
- Shadow quad generation
- Sun render cache management

**Benefits**:
- Complex rendering logic isolated
- Easier to add new sun types
- Reduces renderer.ts by ~6%

**Success Criteria**:
- ✅ All sun types render correctly
- ✅ Volumetric effects work
- ✅ Performance maintained
- ✅ Lens flares appear correctly

---

### 2.3 Extract Asteroid Rendering ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~400 LOC  
**New Module**: `src/render/asteroid-renderer.ts`

**Content to Extract**:
- Asteroid geometry generation (Delaunay triangulation)
- Rim lighting calculations
- Asteroid render cache
- Shadow rendering for asteroids

**Benefits**:
- Complex geometry logic isolated
- Reduces renderer.ts by ~3%

---

### 2.4 Extract Building Renderers ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~1,600 LOC  
**New Module**: `src/render/building-renderers/`

**Files to Create**:
- `forge-renderer.ts` - StellarForge & SubsidiaryFactory (~400 LOC)
- `tower-renderer.ts` - All tower types (~800 LOC)
  - Minigun, Striker, LockOnLaser, Shield towers
- `special-buildings-renderer.ts` - Foundry, Hero hourglass (~400 LOC)

**Benefits**:
- Building rendering logic grouped logically
- Reduces renderer.ts by ~12%

---

### 2.5 Extract Unit Renderers ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~2,200 LOC  
**New Module**: `src/render/unit-renderers/`

**Files to Create**:
- `hero-renderer.ts` - All 20+ hero types (~1,500 LOC)
- `unit-renderer.ts` - Generic units, starlings (~400 LOC)
- `unit-indicators-renderer.ts` - Movement markers, paths (~300 LOC)

**Benefits**:
- Most significant single reduction (~16%)
- Each hero type can be modified independently
- Reduces visual clutter in main renderer

---

### 2.6 Extract Projectile & Particle Renderers ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~1,500 LOC  
**New Module**: `src/render/projectile-renderers/`

**Files to Create**:
- `projectile-renderer.ts` - Bullets, beams, missiles (~800 LOC)
- `particle-renderer.ts` - Impact effects, death particles (~700 LOC)

---

### 2.7 Extract Faction-Specific Rendering ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~1,500 LOC  
**New Module**: `src/render/faction-renderers/`

**Files to Create**:
- `velaris-renderer.ts` - Ancient script faction (~800 LOC)
- `aurum-renderer.ts` - Geometric faction (~400 LOC)
- `radiant-renderer.ts` - Standard faction (~200 LOC)
- `splendor-renderer.ts` - Special effects (~100 LOC)

**Benefits**:
- Faction-specific logic isolated
- Reduces renderer.ts by ~11%

---

### 2.8 Extract UI & HUD Rendering ✅ DONE

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~1,500 LOC  
**New Module**: `src/render/ui-renderer.ts`

**Content to Extract**:
- Selection rectangles & indicators
- Damage numbers
- Off-screen unit indicators
- Production progress bars
- In-game menu overlay
- Ability arrows
- End game stats screen

---

### Phase 2 Summary: Renderer Extractions

| Module | LOC | Status | Phase |
|--------|-----|--------|-------|
| Starfield | 762 | ✅ Done | 2.1 |
| Sun | 1,608 | ✅ Done | 2.2 |
| Asteroid | 569 | ✅ Done | 2.3 |
| Buildings | 2,416 | ✅ Done | 2.4 |
| Units | 2,821 | ✅ Done | 2.5 |
| Projectiles | 1,358 | ✅ Done | 2.6 |
| Factions | included in unit-renderers/ | ✅ Done | 2.7 |
| UI/HUD | 2,007 | ✅ Done | 2.8 |

**Renderer Result**: 13,658 → **2,877 LOC** (79% reduction — exceeded 74% target)

---

## Phase 3: Game State System Extraction ✅ COMPLETE

Game state is complex with many interdependencies. Proceed carefully.

### 3.1 Extract Command Processing System ✅ DONE

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**New Module**: `src/sim/systems/command-processor.ts` (580 LOC)

**Content to Extract**:
- All `execute*Command()` methods
- Command dispatcher
- Network command handling

**Strategy**: Use Command Pattern
```typescript
interface GameCommand {
  execute(game: GameState): void;
}

class UnitMoveCommand implements GameCommand {
  execute(game: GameState): void { /* ... */ }
}
```

**Benefits**:
- Commands become testable in isolation
- Easy to add new command types
- Network serialization simplified
- Reduces game-state.ts by ~9%

---

### 3.2 Extract Vision & Light System ✅ DONE

**New Module**: `src/sim/systems/vision-system.ts` (392 LOC)  
**New Module**: `src/sim/systems/vision-system.ts`

**Methods to Extract**:
- `isPointInShadow()`, `isObjectVisibleToPlayer()`
- `isPointWithinPlayerInfluence()`, `isLightBlockedByVelarisField()`
- `isUnitInSunlight()`, `hasLineOfSightToSun()`

**Benefits**:
- Self-contained subsystem
- Zero dependencies on AI or physics
- Reduces game-state.ts by ~4%

---

### 3.3 Extract AI System ✅ DONE

**New Module**: `src/sim/systems/ai-system.ts` (334 LOC)
Also extracted: `src/sim/systems/ai-structure-system.ts` (383 LOC), `src/sim/systems/ai-mirror-system.ts` (310 LOC)

**Methods to Extract**:
- All `updateAi*()` methods (~20 methods)
- `findAiStructurePlacement()`
- Hero production logic
- Defense management

**Challenge**: AI logic is tightly coupled to game loop
**Strategy**: Extract into `AISystem` class that receives game state

```typescript
export class AISystem {
  update(game: GameState, deltaTime: number): void {
    for (const player of game.players) {
      if (player.isAI) {
        this.updateAiForPlayer(game, player);
      }
    }
  }
}
```

**Benefits**:
- AI can be improved independently
- Easier to add new AI behaviors
- Reduces game-state.ts by ~13%

---

### 3.4 Extract Physics & Collision System ✅ DONE

**New Module**: `src/sim/systems/physics-system.ts` (661 LOC)

**Methods to Extract**:
- `checkCollision()`, `resolveUnitCollisions()`
- `resolveUnitObstacleCollisions()`
- `applyDustPushFromMovingEntity()`
- Knockback calculations

**Benefits**:
- Physics logic isolated
- Easier to optimize collision detection
- Reduces game-state.ts by ~6%

---

### 3.5 Extract Particle System ✅ DONE

**New Module**: `src/sim/systems/particle-system.ts` (248 LOC)
Also extracted in Phase 3: `photon-system.ts` (329 LOC), `mirror-system.ts` (420 LOC), `hero-ability-system.ts` (506 LOC), `hero-entity-system.ts` (893 LOC), `projectile-combat-system.ts` (805 LOC), `unit-effects-system.ts` (461 LOC), `unit-update-system.ts` (236 LOC), `building-update-system.ts` (179 LOC), `player-structure-system.ts` (158 LOC), `space-dust-system.ts` (150 LOC), `starling-system.ts` (146 LOC), `world-initialization-system.ts` (145 LOC)

---

### Phase 3 Summary: Game State Extractions

| Module | LOC | Status | Phase |
|--------|-----|--------|-------|
| Command Processor | 580 | ✅ Done | 3.1 |
| Vision System | 392 | ✅ Done | 3.2 |
| AI System (3 files) | 1,027 | ✅ Done | 3.3 |
| Physics System | 661 | ✅ Done | 3.4 |
| Particle/Photon/Mirror/Hero/etc. (12 files) | 3,500 | ✅ Done | 3.5+ |

**Game State Result**: 6,681 → **955 LOC** (86% reduction — far exceeded 36% target)

---

## Phase 4: Main Controller Extraction ✅ MOSTLY COMPLETE

### 4.1 Extract Input Handler ✅ DONE

**New Module**: `src/input/input-controller.ts` (2,097 LOC)

> ⚠️ Note: `input-controller.ts` has itself grown large. See Phase 5.1 for the plan to split it further.

---

### 4.2 Extract Selection Manager ✅ DONE

**New Module**: `src/input/selection-manager.ts` (378 LOC)

---

### 4.3 Extract Warp Gate Manager ✅ DONE

**New Module**: `src/input/warp-gate-manager.ts` (379 LOC)

---

### Phase 4 Summary: Main Controller Extractions

| Module | LOC | Status | Phase |
|--------|-----|--------|-------|
| Input Handler | 2,097 | ✅ Done | 4.1 |
| Selection Manager | 378 | ✅ Done | 4.2 |
| Warp Gate Manager | 379 | ✅ Done | 4.3 |

**Main Controller Result**: 4,252 → **1,920 LOC** (55% reduction)
> 🟡 Still 468 LOC above the 1,452 target. Remaining reductions tracked in Phase 5.4.

---

## Overall Refactoring Summary

### Before & After

| File | Before | Actual (Mar 2026) | Reduction | % |
|------|--------|-------------------|-----------|---|
| renderer.ts | 13,658 | **2,877** | 10,781 | **79%** |
| game-state.ts | 6,681 | **955** | 5,726 | **86%** |
| menu.ts | 4,156 | **2,400** | 1,756 | **42%** |
| main.ts | 4,252 | **1,920** | 2,332 | **55%** |
| **TOTAL** | **28,747** | **8,152** | **20,595** | **72%** |

### Current Module Structure (March 2026)

```
src/
├── render/
│   ├── starfield-renderer.ts         (762 LOC)
│   ├── sun-renderer.ts               (1,608 LOC) ⚠️ large
│   ├── asteroid-renderer.ts          (569 LOC)
│   ├── environment-renderer.ts       (1,064 LOC) ⚠️ large
│   ├── solar-mirror-renderer.ts      (982 LOC)
│   ├── hud-renderer.ts               (1,216 LOC) ⚠️ large
│   ├── in-game-menu-renderer.ts      (912 LOC)
│   ├── ui-renderer.ts                (791 LOC)
│   ├── projectile-renderer.ts        (775 LOC)
│   ├── faction-projectile-renderer.ts (583 LOC)
│   ├── gravity-grid-renderer.ts      (535 LOC)
│   ├── warp-gate-renderer.ts         (398 LOC)
│   ├── building-renderers/
│   │   ├── forge-renderer.ts         (833 LOC)
│   │   ├── foundry-renderer.ts       (566 LOC)
│   │   ├── tower-renderer.ts         (902 LOC)
│   │   └── shared-utilities.ts       (115 LOC)
│   ├── unit-renderers/
│   │   ├── hero-renderer.ts          (271 LOC)
│   │   ├── radiant-hero-renderer.ts  (480 LOC)
│   │   ├── velaris-hero-renderer.ts  (774 LOC)
│   │   ├── unit-renderer.ts          (562 LOC)
│   │   ├── starling-renderer.ts      (515 LOC)
│   │   └── shared-utilities.ts       (219 LOC)
│   └── workers/
│       ├── sun-ray-worker-bridge.ts  (191 LOC)
│       ├── starfield-worker-bridge.ts (178 LOC)
│       └── gravity-grid-worker-bridge.ts (246 LOC)
├── sim/
│   ├── game-state.ts                 (955 LOC)
│   ├── systems/ (15 files, ~7,300 LOC total)
│   └── entities/ (15 files, ~5,300 LOC total)
├── menu/
│   ├── screens/ (19 files, ~4,360 LOC total)
│   ├── atmosphere.ts                 (883 LOC)
│   ├── particle-layer.ts             (766 LOC)
│   └── ... 13 other files
├── input/
│   ├── input-controller.ts           (2,097 LOC) ⚠️ large
│   ├── selection-manager.ts          (378 LOC)
│   └── warp-gate-manager.ts          (379 LOC)
└── heroes/ (25 files, ~5,300 LOC total)
```

---

## Phase 5: Second-Generation Monolithic Files (Active)

The Phase 1–4 extractions were highly successful, but several extracted modules have themselves grown large enough to warrant further splitting. This phase addresses those second-generation monoliths.

---

### 5.1 Split input-controller.ts (Priority: 🔴 HIGH)

**Target File**: `src/input/input-controller.ts` (2,097 LOC)  
**Target**: ≤ 600 LOC  
**New Directory**: `src/input/`

`InputController` handles all pointer, touch, keyboard, and gesture events in one large class. It should be split by input device/mode:

| New Module | LOC Est. | Content |
|---|---|---|
| `mouse-controller.ts` | ~600 | Left/right click, drag-select, hover, scroll wheel |
| `touch-controller.ts` | ~400 | Touch start/move/end, pinch-to-zoom, long press |
| `keyboard-controller.ts` | ~250 | Hotkeys, number keys, escape, arrow keys |
| `input-coordinator.ts` | ~200 | Orchestrates the above, holds shared state |
| `gesture-recognizer.ts` | ~150 | Tap, double-tap, swipe detection shared by mouse+touch |

**Approach**:
```typescript
// src/input/input-coordinator.ts
export class InputCoordinator {
    private readonly mouse: MouseController;
    private readonly touch: TouchController;
    private readonly keyboard: KeyboardController;

    constructor(context: InputControllerContext) {
        this.mouse = new MouseController(context);
        this.touch = new TouchController(context);
        this.keyboard = new KeyboardController(context);
    }

    setup(): void {
        this.mouse.setup();
        this.touch.setup();
        this.keyboard.setup();
    }
}
```

**Success Criteria**:
- ✅ All input events still fire correctly
- ✅ Drag selection works on mouse and touch
- ✅ Keyboard shortcuts unchanged
- ✅ Pinch-zoom unaffected
- ✅ `src/input/input-controller.ts` ≤ 600 LOC or removed

---

### 5.2 Split online-network.ts (Priority: 🟡 MEDIUM)

**Target File**: `src/online-network.ts` (1,663 LOC)  
**Target**: ≤ 500 LOC  
**New Directory**: `src/net/`

`OnlineNetworkManager` mixes authentication, room management, matchmaking, and in-game tick synchronization into one class:

| New Module | LOC Est. | Content |
|---|---|---|
| `online-auth.ts` | ~200 | `ensureDatabaseIdentity`, `databasePlayerId`, Supabase auth |
| `online-room-manager.ts` | ~400 | `createRoom`, `joinRoom`, `leaveRoom`, `listRooms`, realtime subscriptions |
| `online-matchmaking.ts` | ~350 | MMR queries, 1v1/2v2 queue entry/exit, match found handlers |
| `online-game-session.ts` | ~450 | `startGame`, tick command dispatch, `sendCommand`, ping tracking |
| `online-network.ts` (thin shell) | ~260 | Facade that wires the above together, keeps existing public API |

**Approach**:  
Use the Facade pattern so callers (menu.ts, main.ts) need zero import changes:
```typescript
// src/online-network.ts (thin shell after refactor)
import { OnlineAuth } from './net/online-auth';
import { OnlineRoomManager } from './net/online-room-manager';
import { OnlineMatchmaking } from './net/online-matchmaking';
import { OnlineGameSession } from './net/online-game-session';

export class OnlineNetworkManager {
    private readonly auth = new OnlineAuth();
    private readonly rooms: OnlineRoomManager;
    // ... delegates to sub-modules
}
```

**Success Criteria**:
- ✅ Online lobbies list and join correctly
- ✅ Matchmaking queues work for 1v1 and 2v2
- ✅ In-game command sync unchanged
- ✅ `src/online-network.ts` ≤ 500 LOC

---

### 5.3 Further Reduce main.ts (Priority: 🟡 MEDIUM)

**Target File**: `src/main.ts` (1,920 LOC)  
**Target**: ≤ 1,300 LOC  
**Remaining extractions**: ~620 LOC

Three cohesive subsystems are still inlined in `GameController`:

#### 5.3a Adaptive Quality Controller (~200 LOC)
**New Module**: `src/game/adaptive-quality-controller.ts`

Move all adaptive-quality sampling, thresholds, and upgrade/downgrade logic out of `GameController`:
- `recordAdaptiveQualityFrameTime()`
- `maybeLowerGraphicsQuality()`, `maybeRaiseGraphicsQuality()`
- `getNextLowerGraphicsQuality()`, `getNextHigherGraphicsQuality()`
- `getRenderIntervalMs()`
- All `ADAPTIVE_QUALITY_*` constants

#### 5.3b Mirror & Forge UI Helpers (~250 LOC)
**New Module**: `src/game/mirror-forge-helpers.ts`

Self-contained utility methods used by input handlers:
- `getClosestSelectedMirror()`
- `canQueueSolarMirrorFromForge()`, `trySpawnSolarMirrorFromForge()`
- `findNearestSunlightTarget()`, `moveSelectedMirrorsToNearestSunlight()`
- `isSelectedMirrorInSunlight()`, `hasLineOfSightToAnySun()`
- `getNearestMirrorButtonIndexFromAngle()`

#### 5.3c Replay Manager (~170 LOC)
**New Module**: `src/game/replay-manager.ts`

Wrap `ReplayRecorder`/`ReplayPlayer` lifecycle that currently lives in `GameController`:
- `initializeReplayRecorder()`
- `stopReplayRecording()`
- `startReplayViewing()`
- Related state fields (`replayRecorder`, `replayPlayer`, `isWatchingReplay`, `currentGameSeed`)

**Success Criteria**:
- ✅ Adaptive quality still ramps up/down automatically
- ✅ Replay recording and playback unchanged
- ✅ Solar mirror "to sun" command works
- ✅ `src/main.ts` ≤ 1,300 LOC

---

### 5.4 Split sun-renderer.ts (Priority: 🟢 LOW)

**Target File**: `src/render/sun-renderer.ts` (1,608 LOC)  
**Target**: ≤ 600 LOC  
**New Directory**: `src/render/sun/`

The sun renderer is the largest remaining render module, blending corona, volumetric shafts, and particle layers:

| New Module | LOC Est. | Content |
|---|---|---|
| `sun-corona.ts` | ~400 | Core disc, bloom layers, lens flare, glow ring |
| `sun-shafts.ts` | ~350 | Volumetric light-shaft quads, shadow projection |
| `sun-particles.ts` | ~350 | Ember particles, light-dust particles, animation |
| `sun-renderer.ts` (coordinator) | ~200 | Orchestrates the above, public `drawSun()` API |

**Success Criteria**:
- ✅ All sun types (normal, ultra, lad) render identically
- ✅ Volumetric shafts still appear
- ✅ Particle layers animate correctly
- ✅ Performance unchanged (caches preserved)

---

### 5.5 Split hud-renderer.ts (Priority: 🟢 LOW)

**Target File**: `src/render/hud-renderer.ts` (1,216 LOC)  
**Target**: ≤ 400 LOC  
**New Directory**: `src/render/hud/`

| New Module | LOC Est. | Content |
|---|---|---|
| `resource-hud.ts` | ~300 | Photon bar, energy display, resource counters |
| `unit-hud.ts` | ~350 | Selection info panel, health bars, ability cooldowns |
| `minimap-renderer.ts` | ~200 | Minimap drawing and interaction |
| `hud-renderer.ts` (coordinator) | ~200 | Wires together the above |

**Success Criteria**:
- ✅ All HUD elements render correctly
- ✅ Health bars and cooldowns update in real time
- ✅ Minimap clickable and accurate

---

### Phase 5 Summary

| Phase | File | Current LOC | Target LOC | Priority | Complexity |
|-------|------|-------------|------------|----------|------------|
| 5.1 | `input-controller.ts` | 2,097 | 600 | 🔴 High | Medium |
| 5.2 | `online-network.ts` | 1,663 | 500 | 🟡 Medium | High |
| 5.3 | `main.ts` | 1,920 | 1,300 | 🟡 Medium | Medium |
| 5.4 | `sun-renderer.ts` | 1,608 | 600 | 🟢 Low | Medium |
| 5.5 | `hud-renderer.ts` | 1,216 | 400 | 🟢 Low | Low |

**Estimated total extraction**: ~6,000 LOC across 15–20 new focused files.

---

## Testing Strategy

### After Each Extraction

**Build Test**:
```bash
npm run build
```

**Type Check**:
- TypeScript compiler catches most issues

**Manual Testing Checklist**:
- [ ] Game starts without errors
- [ ] Menu navigation works
- [ ] Game can be started (AI, LAN, P2P)
- [ ] Core gameplay functional (units move, buildings work)
- [ ] Visual rendering correct (no missing sprites/effects)
- [ ] Input handling responsive
- [ ] Network sync works (if multiplayer changed)

**Automated Tests** (if available):
```bash
npm test
```

### Performance Validation

After major rendering changes:
1. Measure FPS in typical game scenario
2. Check frame time in browser DevTools
3. Monitor memory usage
4. Ensure no performance regression

---

## Risk Mitigation

### High-Risk Areas

1. **Renderer State Management**
   - Risk: Breaking cached gradients/sprites
   - Mitigation: Extract pure rendering functions first, keep caches in main renderer initially

2. **Game State Dependencies**
   - Risk: Circular dependencies between systems
   - Mitigation: Use dependency injection, extract utilities first

3. **Input Handler Closures**
   - Risk: Lost access to controller state
   - Mitigation: Convert to class with explicit state management

4. **Network Command Serialization**
   - Risk: Breaking multiplayer sync
   - Mitigation: Maintain exact command format, add integration tests

### Rollback Plan

Each phase should be a separate PR that can be reverted if issues arise:
- Use feature branches
- Test thoroughly before merge
- Document any discovered issues
- Maintain backward compatibility

---

## Success Criteria

### Technical Metrics
- ✅ All files build without TypeScript errors
- ✅ Zero ESLint warnings introduced
- ✅ No performance regression (FPS maintained)
- ✅ Memory usage unchanged or improved
- ✅ Bundle size unchanged or smaller

### Functional Metrics
- ✅ All game modes work (AI, LAN, P2P, Online)
- ✅ All menu screens functional
- ✅ All units/buildings render correctly
- ✅ Multiplayer sync maintained
- ✅ Replay system works
- ✅ No visual regressions

### Developer Experience Metrics
- ✅ Codebase easier to navigate
- ✅ Module responsibilities clear
- ✅ Reduced cognitive load when making changes
- ✅ Improved code review efficiency
- ✅ Better AI agent understanding

---

## Timeline & Milestones

### Phase 1: Menu Refactoring ✅ COMPLETE
### Phase 2: Renderer Refactoring ✅ COMPLETE
### Phase 3: Game State Refactoring ✅ COMPLETE
### Phase 4: Main Controller Refactoring ✅ MOSTLY COMPLETE

### Phase 5: Second-Generation Monolithic Files (Active)
- **Step 1**: Split `input-controller.ts` → mouse / touch / keyboard / coordinator
- **Step 2**: Split `online-network.ts` → auth / room / matchmaking / session modules
- **Step 3**: Extract `adaptive-quality-controller.ts`, `mirror-forge-helpers.ts`, `replay-manager.ts` from main.ts
- **Step 4**: Split `sun-renderer.ts` → corona / shafts / particles modules
- **Step 5**: Split `hud-renderer.ts` → resource / unit / minimap modules

**Total Duration**: ~3–6 additional weeks

---

## Progress Log

### Session: March 17, 2026 – Renderer.ts Phase 2 Continued

**BUILD_NUMBER**: 451 → 452  
**renderer.ts**: 3,166 → 2,686 LOC (**-480 lines, 15% reduction**)

#### Extractions Completed

| Extraction | Lines Moved | Target Module | Description |
|---|---|---|---|
| `drawExperimentalFieldAtmospherics` | ~232 | `environment-renderer.ts` | Nebulae, ribbons, caustics, sun halos, glints, vignettes |
| Asset path helpers | ~114 | `asset-path-helpers.ts` (NEW) | `getHeroSpritePath`, `getForgeSpritePath`, `getSolarMirrorSpritePath`, `getStarlingSpritePath`, `getStarlingFacingRotationRad`, `getProductionDisplayName`, `getBuildingDisplayName`, `detectAndDrawEdges` |
| Shroud cube rendering | ~70 | `projectile-renderer.ts` | `drawShroudCubes`, `drawShroudCubeRect` |
| Shade brightness utilities | ~62 | `shade-brightness.ts` (NEW) | `getShadeBrightnessBoost`, `applyShadeBrightening` |
| Unused imports cleanup | ~2 | `renderer.ts` | Removed 13 unused entity imports + `renderLensFlare` + particle imports |

#### New Modules Created

- **`src/render/asset-path-helpers.ts`** (224 LOC) – Pure functions mapping entity types to sprite paths and display names.  Uses a `GraphicAssetPathResolver` callback to avoid coupling to the `GraphicOption` infrastructure.
- **`src/render/shade-brightness.ts`** (96 LOC) – Proximity-based shade brightness calculations with quadratic falloff, extracted from `GameRenderer`.

#### Approach

All extractions followed the Strangler Fig pattern:
1. Created new module with extracted logic
2. Replaced inline implementations with thin delegators
3. Built and verified after each extraction
4. Zero functionality changes

#### Current Monolithic File Status

| File | LOC (Before Session) | LOC (After Session) | Change |
|------|---------------------|---------------------|--------|
| **renderer.ts** | 3,166 | 2,686 | **-480 (-15%)** |
| **menu.ts** | 2,548 | 2,548 | unchanged |
| **input-controller.ts** | 2,076 | 2,076 | unchanged |
| **main.ts** | 1,887 | 1,887 | unchanged |

#### Remaining Extraction Opportunities in renderer.ts

The remaining 2,686 LOC in renderer.ts consists of:
- **Main `render()` orchestration** (~600 LOC) – core rendering pipeline, difficult to extract further
- **Context builder methods** (~230 LOC) – 7 `get*Context()` methods that bridge GameRenderer state to sub-renderers
- **Camera/viewport management** (~80 LOC) – resize, viewport metrics, zoom clamping
- **Graphics option management** (~80 LOC) – variant handling, layer toggles
- **~45 thin delegator methods** (~180 LOC) – single-line forwards to sub-renderers; kept for readability
- **Player/team color logic** (~50 LOC) – `getTeamColor`, `getLadPlayerColor`, `isEnemyPlayer`
- **Remaining utility methods** (~100 LOC) – gradient caching, interpolation, pseudo-random


---

### Session: March 25, 2026 – Plan Update (Phases 1–4 Retrospective + Phase 5)

**BUILD_NUMBER**: 478 → 479

#### Summary

Audited the full codebase to determine which phases of the refactoring plan are complete and what remains. All original targets (Phases 1–4) have been met or exceeded. Added Phase 5 to track second-generation monolithic files that emerged from the extractions.

#### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Menu extraction (screens, LAN lobby, profile) | ✅ COMPLETE |
| 2 | Renderer subsystems (starfield, sun, asteroid, buildings, units, projectiles, factions, HUD) | ✅ COMPLETE |
| 3 | Game state systems (commands, vision, AI, physics, particles, photons, mirrors, heroes) | ✅ COMPLETE |
| 4 | Main controller (input, selection, warp gate) | ✅ MOSTLY COMPLETE |
| 5 | Second-generation monoliths | 🆕 PLANNED |

#### Final LOC for Original Four Files

| File | Feb 2026 | Mar 2026 | vs Target |
|------|----------|----------|-----------|
| renderer.ts | 13,658 | 2,877 | ✅ Under (target was 3,500) |
| game-state.ts | 6,681 | 955 | ✅ Far under (target was 4,300) |
| menu.ts | 4,156 | 2,400 | ✅ Under (target was 2,856) |
| main.ts | 4,252 | 1,920 | 🟡 Still 468 above target of 1,452 |

---

## Maintenance & Documentation

### During Refactoring
- Update REFACTORING_GUIDE.md with progress
- Document any discovered patterns
- Note any issues encountered
- Update architecture diagrams

### After Completion
- Create architectural decision records (ADRs)
- Update onboarding documentation
- Add module dependency diagrams
- Document new import patterns

---

## Conclusion

This refactoring plan provides a systematic approach to breaking down SoL's monolithic files into manageable, maintainable modules. By following the Strangler Fig pattern and proceeding incrementally, we can significantly improve code organization without risking game functionality or performance.

The key to success is:
- ✅ **Small, testable changes**
- ✅ **Frequent validation**
- ✅ **Clear rollback points**
- ✅ **Maintaining game quality throughout**

Remember: **The goal is not perfection, but continuous improvement.**

---

## Questions & Support

If unsure about a refactoring step:
1. Review similar extractions already completed
2. Start with the smallest possible extraction
3. Test thoroughly before proceeding
4. Document lessons learned
5. Update this plan with new insights

**Document Owner**: Development Team  
**Review Cycle**: Monthly progress reviews  
**Next Review**: March 17, 2026
