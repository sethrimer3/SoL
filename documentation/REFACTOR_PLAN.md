# Monolithic File Refactoring Plan
## SoL (Speed of Light) RTS Game

**Document Status**: Active Plan  
**Last Updated**: March 17, 2026  
**Purpose**: Comprehensive plan to refactor large monolithic files without degrading functionality or performance

---

## Executive Summary

The SoL codebase has grown significantly and contains four major monolithic files that require refactoring to improve maintainability, testability, and developer experience. This document outlines a phased approach to systematically extract logical subsystems into well-organized modules.

### Current State (March 2026)

The refactoring effort has **exceeded all original targets**, achieving a 72% reduction in monolithic file LOC.

| File | Lines of Code | Primary Responsibility | Complexity |
|------|--------------|------------------------|------------|
| **src/renderer.ts** | 2,808 | Canvas render orchestration | 🟢 Moderate |
| **src/sim/game-state.ts** | 863 | Game state management | 🟢 Low |
| **src/main.ts** | 1,887 | Game controller, orchestration | 🟡 Moderate |
| **src/menu.ts** | 2,548 | Menu system, lobby management | 🟡 Moderate |
| **TOTAL** | **8,106** | | |

### Original State (February 2026)

| File | Lines of Code | Primary Responsibility | Complexity |
|------|--------------|------------------------|------------|
| src/renderer.ts | 13,658 | Canvas rendering, visual effects, UI drawing | 🔴 Critical |
| src/sim/game-state.ts | 6,681 | Game simulation, physics, AI, networking | 🔴 Critical |
| src/main.ts | 4,252 | Game controller, input handling, orchestration | 🟡 High |
| src/menu.ts | 4,156 | Menu system, lobby management, UI screens | 🟡 High |
| **TOTAL** | **28,747** | | |

**Original Target**: Reduce total to ~18,000 LOC by extracting ~10,700 LOC into focused modules  
**Actual Result**: Reduced to **8,106 LOC** — extracted **20,641 LOC** (72% reduction, nearly 2× the original target)

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

## Phase 1: High-Impact, Low-Risk Extractions (Weeks 1-3)

These extractions provide immediate benefits with minimal risk of breaking functionality.

### 1.1 Extract Menu Screen Renderers (Priority: 🔥 HIGHEST)

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

### 1.2 Extract LAN Lobby Management (Priority: 🔥 HIGH)

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

### 1.3 Extract Player Profile Management (Priority: 🔥 HIGH)

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

## Phase 2: Renderer Subsystem Extraction (Weeks 4-8)

The renderer is the largest file and requires careful, methodical extraction.

### 2.1 Extract Starfield & Background Rendering (Priority: 🔥 HIGH)

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

### 2.2 Extract Sun Rendering System (Priority: 🔥 HIGH)

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

### 2.3 Extract Asteroid Rendering (Priority: 🟡 MEDIUM)

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

### 2.4 Extract Building Renderers (Priority: 🟡 MEDIUM)

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

### 2.5 Extract Unit Renderers (Priority: 🟡 MEDIUM)

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

### 2.6 Extract Projectile & Particle Renderers (Priority: 🟡 MEDIUM)

**Target File**: `src/renderer.ts` (13,658 LOC)  
**Extraction Size**: ~1,500 LOC  
**New Module**: `src/render/projectile-renderers/`

**Files to Create**:
- `projectile-renderer.ts` - Bullets, beams, missiles (~800 LOC)
- `particle-renderer.ts` - Impact effects, death particles (~700 LOC)

---

### 2.7 Extract Faction-Specific Rendering (Priority: 🟢 LOW)

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

### 2.8 Extract UI & HUD Rendering (Priority: 🟢 LOW)

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

| Module | LOC | Priority | Phase |
|--------|-----|----------|-------|
| Starfield | 600 | 🔥 High | 2.1 |
| Sun | 800 | 🔥 High | 2.2 |
| Asteroid | 400 | 🟡 Medium | 2.3 |
| Buildings | 1,600 | 🟡 Medium | 2.4 |
| Units | 2,200 | 🟡 Medium | 2.5 |
| Projectiles | 1,500 | 🟡 Medium | 2.6 |
| Factions | 1,500 | 🟢 Low | 2.7 |
| UI/HUD | 1,500 | 🟢 Low | 2.8 |
| **Total** | **10,100** | | |

**Renderer Target**: 13,658 → ~3,500 LOC (74% reduction)

---

## Phase 3: Game State System Extraction (Weeks 9-12)

Game state is complex with many interdependencies. Proceed carefully.

### 3.1 Extract Command Processing System (Priority: 🔥 HIGH)

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**Extraction Size**: ~600 LOC  
**New Module**: `src/sim/systems/command-processor.ts`

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

### 3.2 Extract Vision & Light System (Priority: 🔥 HIGH)

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**Extraction Size**: ~250 LOC  
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

### 3.3 Extract AI System (Priority: 🟡 MEDIUM)

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**Extraction Size**: ~900 LOC  
**New Module**: `src/sim/systems/ai-system.ts`

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

### 3.4 Extract Physics & Collision System (Priority: 🟡 MEDIUM)

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**Extraction Size**: ~400 LOC  
**New Module**: `src/sim/systems/physics-system.ts`

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

### 3.5 Extract Particle System (Priority: 🟢 LOW)

**Target File**: `src/sim/game-state.ts` (6,681 LOC)  
**Extraction Size**: ~200 LOC  
**New Module**: `src/sim/systems/particle-system.ts`

**Methods to Extract**:
- `createDeathParticles()`, `spawnDeathParticles()`
- `updateDeathParticles()`
- Damage number management

---

### Phase 3 Summary: Game State Extractions

| Module | LOC | Priority | Phase |
|--------|-----|----------|-------|
| Command Processor | 600 | 🔥 High | 3.1 |
| Vision System | 250 | 🔥 High | 3.2 |
| AI System | 900 | 🟡 Medium | 3.3 |
| Physics System | 400 | 🟡 Medium | 3.4 |
| Particle System | 200 | 🟢 Low | 3.5 |
| **Total** | **2,350** | | |

**Game State Target**: 6,681 → ~4,300 LOC (36% reduction)

---

## Phase 4: Main Controller Extraction (Weeks 13-15)

### 4.1 Extract Input Handler (Priority: 🔥 HIGH)

**Target File**: `src/main.ts` (4,252 LOC)  
**Extraction Size**: ~1,800 LOC  
**New Module**: `src/input/input-controller.ts`

**Content**: Entire `setupInputHandlers()` method and closures

**Benefits**:
- Single largest reduction in main.ts (42%)
- Input logic becomes testable
- Easier to add new input modes (gamepad, etc.)

---

### 4.2 Extract Selection Manager (Priority: 🔥 HIGH)

**Target File**: `src/main.ts` (4,252 LOC)  
**Extraction Size**: ~400 LOC  
**New Module**: `src/input/selection-manager.ts`

**Methods to Extract**:
- Selection helpers, rectangle selection
- Clear selection methods
- Unit/building/mirror selection logic

---

### 4.3 Extract Warp Gate Manager (Priority: 🟡 MEDIUM)

**Target File**: `src/main.ts` (4,252 LOC)  
**Extraction Size**: ~600 LOC  
**New Module**: `src/game/warp-gate-manager.ts`

**Methods to Extract**:
- All warp gate creation, placement, and interaction logic

---

### Phase 4 Summary: Main Controller Extractions

| Module | LOC | Priority | Phase |
|--------|-----|----------|-------|
| Input Handler | 1,800 | 🔥 High | 4.1 |
| Selection Manager | 400 | 🔥 High | 4.2 |
| Warp Gate Manager | 600 | 🟡 Medium | 4.3 |
| **Total** | **2,800** | | |

**Main Controller Target**: 4,252 → ~1,450 LOC (66% reduction)

---

## Overall Refactoring Summary

### Before & After (Actual Results — March 2026)

| File | Before (Feb 2026) | After (Mar 2026) | Reduction | % |
|------|--------|-------|-----------|---|
| renderer.ts | 13,658 | 2,808 | 10,850 | **79%** |
| game-state.ts | 6,681 | 863 | 5,818 | **87%** |
| menu.ts | 4,156 | 2,548 | 1,608 | **39%** |
| main.ts | 4,252 | 1,887 | 2,365 | **56%** |
| **TOTAL** | **28,747** | **8,106** | **20,641** | **72%** |

### New Module Structure

```
src/
├── render/
│   ├── starfield-renderer.ts         (600 LOC)
│   ├── sun-renderer.ts               (800 LOC)
│   ├── asteroid-renderer.ts          (400 LOC)
│   ├── building-renderers/
│   │   ├── forge-renderer.ts         (400 LOC)
│   │   ├── tower-renderer.ts         (800 LOC)
│   │   └── special-buildings.ts      (400 LOC)
│   ├── unit-renderers/
│   │   ├── hero-renderer.ts          (1,500 LOC)
│   │   ├── unit-renderer.ts          (400 LOC)
│   │   └── indicators.ts             (300 LOC)
│   ├── projectile-renderers/
│   │   ├── projectile-renderer.ts    (800 LOC)
│   │   └── particle-renderer.ts      (700 LOC)
│   ├── faction-renderers/
│   │   ├── velaris-renderer.ts       (800 LOC)
│   │   ├── aurum-renderer.ts         (400 LOC)
│   │   ├── radiant-renderer.ts       (200 LOC)
│   │   └── splendor-renderer.ts      (100 LOC)
│   └── ui-renderer.ts                (1,500 LOC)
├── sim/
│   └── systems/
│       ├── command-processor.ts      (600 LOC)
│       ├── vision-system.ts          (250 LOC)
│       ├── ai-system.ts              (900 LOC)
│       ├── physics-system.ts         (400 LOC)
│       └── particle-system.ts        (200 LOC)
├── menu/
│   ├── screen-renderers/
│   │   ├── main-menu-screen.ts       (100 LOC)
│   │   ├── map-selection-screen.ts   (80 LOC)
│   │   ├── faction-selection.ts      (120 LOC)
│   │   ├── loadout-screens.ts        (300 LOC)
│   │   ├── settings-screen.ts        (150 LOC)
│   │   └── ...more screens           (150 LOC)
│   ├── lan-lobby-manager.ts          (250 LOC)
│   └── player-profile-manager.ts     (150 LOC)
└── input/
    ├── input-controller.ts           (1,800 LOC)
    ├── selection-manager.ts          (400 LOC)
    └── warp-gate-manager.ts          (600 LOC)
```

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

### Phase 1: Menu Refactoring (Weeks 1-3)
- **Week 1**: Extract menu screen renderers
- **Week 2**: Extract LAN lobby & player profile managers
- **Week 3**: Testing & validation

### Phase 2: Renderer Refactoring (Weeks 4-8)
- **Week 4**: Starfield & sun renderers
- **Week 5**: Asteroid & building renderers
- **Week 6**: Unit renderers
- **Week 7**: Projectile & faction renderers
- **Week 8**: UI renderer & testing

### Phase 3: Game State Refactoring (Weeks 9-12)
- **Week 9**: Command processor & vision system
- **Week 10**: AI system extraction
- **Week 11**: Physics system extraction
- **Week 12**: Testing & validation

### Phase 4: Main Controller Refactoring (Weeks 13-15)
- **Week 13**: Input controller extraction
- **Week 14**: Selection & warp gate managers
- **Week 15**: Final testing & validation

**Total Duration**: ~15 weeks (3-4 months)

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
