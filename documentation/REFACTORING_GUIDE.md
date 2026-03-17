# Refactoring Guide for SoL Codebase

This document provides guidance for incrementally refactoring large monolithic files in the SoL codebase to improve organization and readability for both human developers and AI agents.

## Overview

The SoL codebase has several large monolithic files that contain multiple responsibilities.

**Current measurements (February 17, 2026)**:
- **renderer.ts** (13,658 LOC): Rendering engine with ~60 draw methods
- **game-state.ts** (6,681 LOC): Core simulation and game logic  
- **menu.ts** (4,156 LOC): Menu system with 16+ screen renderers
- **main.ts** (4,252 LOC): Game controller with input handling
- **TOTAL**: 28,747 LOC across 4 files

**Target state (after complete refactoring)**:
- **renderer.ts**: 13,658 → ~3,558 LOC (74% reduction)
- **game-state.ts**: 6,681 → ~4,331 LOC (35% reduction)
- **menu.ts**: 4,156 → ~2,856 LOC (31% reduction)
- **main.ts**: 4,252 → ~1,452 LOC (66% reduction)
- **TOTAL**: 28,747 → ~12,197 LOC (58% reduction)

**See REFACTOR_PLAN.md for comprehensive refactoring plan.**

*Note: These numbers will decrease as refactoring progresses. Check git history for current state.*

## Refactoring Strategy

### The "Strangler Fig" Pattern

Rather than attempting a massive rewrite, we use the **Strangler Fig pattern**:

1. Create new, well-organized modules alongside existing code
2. Gradually migrate functionality to the new structure
3. Remove old code only after the new code is tested and working
4. Maintain backwards compatibility throughout

### Principles

1. **Make the smallest possible changes** - Surgical, incremental refactoring
2. **Follow existing patterns** - Look at `src/sim/entities/` and `src/menu/` as examples
3. **Test after each change** - Build and verify functionality
4. **Extract pure functions first** - Stateless utilities are safest to extract
5. **Document as you go** - Add comments explaining the new structure

## Existing Examples of Good Organization

### ✅ Entity System (`src/sim/entities/`)

Each entity type has its own file with clear responsibility:
- `player.ts` - Player state and logic
- `unit.ts` - Generic unit behavior
- `buildings.ts` - Building types and behavior
- `solar-mirror.ts` - Solar mirror mechanics
- `particles.ts` - Particle effects

**Pattern to follow**: One entity type = One file

### ✅ Menu System (`src/menu/`)

Partial modularization already exists:
- `background-particles.ts` - Background particle effects
- `particle-layer.ts` - Particle text effects
- `atmosphere.ts` - Atmospheric effects
- `color-schemes.ts` - Color scheme definitions
- `ui-helpers.ts` - **NEW**: Reusable UI widgets
- `types.ts` - Shared type definitions

**Pattern to follow**: One responsibility = One file

### ✅ Render System (`src/render/`)

Infrastructure modules:
- `camera.ts` - **NEW**: Camera and coordinate conversion
- `graphics-options.ts` - Graphics settings
- `in-game-menu.ts` - In-game menu layout

**Pattern to follow**: Extract self-contained systems first

## Completed Refactorings

### 1. Camera Module (`src/render/camera.ts`)

**Extracted from**: renderer.ts  
**Lines**: ~150 LOC  
**Status**: ✅ Created (not yet integrated into renderer.ts)

**Responsibilities**:
- World ↔ Screen coordinate conversion
- View bounds calculation and culling
- Screen shake effects

**Integration Plan**: Update renderer.ts to use Camera class (requires updating ~344 references)

### 2. UI Helpers Module (`src/menu/ui-helpers.ts`)

**Extracted from**: menu.ts  
**Lines**: 181 LOC (reduced menu.ts by 121 lines)  
**Status**: ✅ Extracted and integrated

**Responsibilities**:
- `createSettingSection()` - Labeled setting rows
- `createSelect()` - Dropdown selects
- `createToggle()` - Toggle switches  
- `createColorPicker()` - Color pickers
- `createTextInput()` - Text inputs

**Usage**:
```typescript
import { createSettingSection, createToggle } from './menu/ui-helpers';

const section = createSettingSection(
    'Sound Effects',
    createToggle(soundEnabled, (value) => setSoundEnabled(value))
);
```

## Recommended Next Steps

### High Priority (High Impact, Low Risk)

#### 1. Extract Menu Screen Renderers (`src/menu/screens/`)

Create individual files for each screen:
- `main-menu-screen.ts` - Main menu (~ 100 LOC)
- `map-selection-screen.ts` - Map selection (~50 LOC)
- `faction-selection-screen.ts` - Faction selection (~100 LOC)
- `loadout-screens.ts` - Loadout customization (~200 LOC)
- `multiplayer-screens.ts` - LAN/P2P/Online screens (~500 LOC)
- `match-history-screen.ts` - Match history (~150 LOC)
- `settings-screen.ts` - Settings screen (~180 LOC)

**Benefits**: Reduces menu.ts by ~1,200 LOC, improves navigability

**Approach**:
1. Create new file for screen renderer
2. Move screen rendering method to new file
3. Export screen renderer function
4. Import and use in menu.ts
5. Test build and functionality

#### 2. Extract Faction-Specific Rendering (`src/render/faction-renderers/`)

Create files for each faction's rendering code:
- `velaris-renderer.ts` - Velaris grapheme sprites, particles, effects (~800 LOC)
- `aurum-renderer.ts` - Aurum outline rendering, shape animations (~400 LOC)
- `radiant-renderer.ts` - Radiant standard effects (~200 LOC)

**Benefits**: Reduces renderer.ts by ~1,400 LOC, isolates faction logic

### Medium Priority (Medium Impact, Medium Risk)

#### 3. Extract Entity Renderers (`src/render/entity-renderers/`)

Group related drawing methods:
- `unit-renderer.ts` - Unit drawing methods (~500 LOC)
- `building-renderer.ts` - Building drawing methods (~800 LOC)
- `particle-renderer.ts` - Particle drawing methods (~600 LOC)
- `projectile-renderer.ts` - Projectile drawing methods (~400 LOC)

**Benefits**: Reduces renderer.ts by ~2,300 LOC

#### 4. Extract Game State Systems (`src/sim/systems/`)

Extract logical systems from game-state.ts:
- `energy-system.ts` - Energy generation, mirror calculations (~800 LOC)
- `combat-system.ts` - Combat, projectiles, collisions (~1,200 LOC)
- `building-system.ts` - Building updates and logic (~1,000 LOC)
- `ai-system.ts` - AI decision making (~400 LOC)

**Benefits**: Reduces game-state.ts by ~3,400 LOC

### Lower Priority (Lower Impact or Higher Risk)

#### 5. Integrate Camera into Renderer

**Challenge**: Requires updating ~344 references to `this.camera.x`, `this.zoom`, etc.

**Approach**:
1. Add compatibility getters/setters to maintain API
2. Gradually migrate internal usage
3. Update external callers (main.ts, etc.)
4. Remove old properties once migration complete

#### 6. Extract Input Handling (`src/input/`)

Extract from main.ts:
- `mouse-handler.ts` - Mouse input (~400 LOC)
- `keyboard-handler.ts` - Keyboard input (~300 LOC)
- `touch-handler.ts` - Touch/mobile input (~400 LOC)
- `selection-manager.ts` - Unit/building selection (~800 LOC)

**Benefits**: Reduces main.ts by ~1,900 LOC

## Best Practices

### DO ✅

- **Start with pure functions** - No dependencies on instance state
- **Extract utilities first** - Helper functions, formatters, converters
- **Test frequently** - Build after each extraction
- **Follow existing patterns** - Look at well-organized modules
- **Document your changes** - Add comments and update this guide
- **Commit incrementally** - Small, focused commits
- **Maintain backwards compatibility** - Don't break existing code

### DON'T ❌

- **Don't rewrite everything at once** - Incremental is safer
- **Don't change functionality** - Pure refactoring only
- **Don't break existing tests** - All tests should still pass
- **Don't create circular dependencies** - Plan module structure carefully
- **Don't extract before understanding** - Read the code first
- **Don't skip testing** - Always verify your changes work

## Testing Your Refactoring

### 1. Build Test
```bash
npm run build
```
Should complete without errors.

### 2. Type Check
The TypeScript compiler will catch many issues during build.

### 3. Manual Testing
- Start the game
- Navigate through menus
- Start a game
- Verify core gameplay works
- Test multiplayer (if applicable)

### 4. Code Review Checklist
- [ ] Code builds successfully
- [ ] No new TypeScript errors
- [ ] Extracted code maintains same functionality
- [ ] Module exports are correct
- [ ] Imports are updated where needed
- [ ] No circular dependencies created
- [ ] Documentation updated
- [ ] Commit message is descriptive

## Module Structure Guidelines

### File Naming

- Use kebab-case: `faction-renderer.ts`
- Be descriptive: `energy-system.ts` not `system1.ts`
- Group related files in directories

### Directory Structure

```
src/
├── render/                    # Rendering system
│   ├── camera.ts             # ✅ Camera/coordinates
│   ├── entity-renderers/     # 🎯 Future: Entity drawing
│   ├── faction-renderers/    # 🎯 Future: Faction-specific
│   └── ui-renderers/         # 🎯 Future: UI/HUD drawing
├── sim/                       # Simulation/game logic
│   ├── entities/             # ✅ Well-organized entities
│   └── systems/              # 🎯 Future: Game systems
├── menu/                      # Menu system
│   ├── screens/              # 🎯 Future: Screen renderers
│   ├── ui-helpers.ts         # ✅ UI widget creators
│   └── color-schemes.ts      # ✅ Color definitions
└── input/                     # 🎯 Future: Input handling
    ├── mouse-handler.ts
    ├── keyboard-handler.ts
    └── touch-handler.ts
```

### Export Patterns

Use index files to create clean public APIs:

```typescript
// src/render/index.ts
export { Camera } from './camera';
export * from './graphics-options';
export * from './in-game-menu';
```

Then import like:
```typescript
import { Camera, GraphicOptions } from './render';
```

## Common Pitfalls

### 1. Circular Dependencies

**Problem**: Module A imports Module B, which imports Module A

**Solution**: 
- Extract shared types to a separate file
- Use dependency injection
- Restructure to have clear hierarchy

### 2. Breaking Existing References

**Problem**: Moving code breaks existing imports

**Solution**:
- Use TypeScript compiler to find all references
- Update imports in the same commit
- Add temporary re-exports for gradual migration

### 3. Loss of Context

**Problem**: Extracted code needs access to parent class state

**Solution**:
- Pass dependencies as parameters
- Use dependency injection
- Consider if extraction is premature

## Measuring Progress

### Lines of Code by File

| File | Original (Feb 2026) | Current (Mar 2026) | Target | Progress |
|------|---------------------|---------|--------|----------|
| renderer.ts | 13,658 | 2,808 | 3,558 | ✅ **107%** (exceeded) |
| game-state.ts | 6,681 | 863 | 4,331 | ✅ **248%** (exceeded) |
| menu.ts | 4,156 | 2,548 | 2,856 | ✅ **124%** (exceeded) |
| main.ts | 4,252 | 1,887 | 1,452 | **84%** |
| **TOTAL** | **28,747** | **8,106** | **12,197** | ✅ **125%** (exceeded) |

### Completed Extractions

**Phase 1 - Menu System** (Completed):
- ✅ Menu screen renderers (~2,736 LOC extracted to `src/menu/screens/`)
- ✅ LAN Lobby Manager (151 LOC extracted to `src/menu/lan-lobby-manager.ts`)
- ✅ Player Profile Manager (74 LOC extracted to `src/menu/player-profile-manager.ts`)

**Phase 2 - Renderer System** (Substantially Complete):
- ✅ Starfield renderer (extracted to `src/render/starfield-renderer.ts`)
- ✅ Sun renderer (extracted to `src/render/sun-renderer.ts`)
- ✅ Asteroid renderer (extracted to `src/render/asteroid-renderer.ts`)
- ✅ Building renderers (extracted to `src/render/building-renderers/`)
- ✅ Unit renderers (extracted to `src/render/unit-renderers/`)
- ✅ Projectile renderer (extracted to `src/render/projectile-renderer.ts`)
- ✅ Faction projectile renderer (extracted to `src/render/faction-projectile-renderer.ts`)
- ✅ Solar mirror renderer (extracted to `src/render/solar-mirror-renderer.ts`)
- ✅ Warp gate renderer (extracted to `src/render/warp-gate-renderer.ts`)
- ✅ UI renderer (extracted to `src/render/ui-renderer.ts`)
- ✅ HUD renderer (extracted to `src/render/hud-renderer.ts`)
- ✅ In-game menu renderer (extracted to `src/render/in-game-menu-renderer.ts`)
- ✅ Environment renderer (extracted to `src/render/environment-renderer.ts`)
- ✅ Glow renderer (extracted to `src/render/glow-renderer.ts`)
- ✅ Color utilities (extracted to `src/render/color-utilities.ts`)
- ✅ Noise utilities (extracted to `src/render/noise-utilities.ts`)
- ✅ Faction utilities (extracted to `src/render/faction-utilities.ts`)
- ✅ Canvas metrics (extracted to `src/render/canvas-metrics.ts`)
- ✅ Sprite manager (extracted to `src/render/sprite-manager.ts`)
- ✅ Display name helpers (extracted to `src/render/display-names.ts`)
- ✅ Shroud renderer (extracted to `src/render/shroud-renderer.ts`)
- ✅ Field atmospherics (~234 LOC moved to `src/render/environment-renderer.ts`)
- ✅ interpolateHexColor (moved to `src/render/color-utilities.ts`)

**Phase 3 - Game State Systems** (Substantially Complete):
- ✅ Command processor (extracted to `src/sim/systems/command-processor.ts`)
- ✅ Vision system (extracted to `src/sim/systems/vision-system.ts`)
- ✅ AI system (extracted to `src/sim/systems/ai*.ts`)
- ✅ Physics system (extracted to `src/sim/systems/physics-system.ts`)
- ✅ Hero entity system (extracted to `src/sim/systems/hero-entity-system.ts`)
- ✅ Projectile combat system (extracted to `src/sim/systems/projectile-combat-system.ts`)

**Phase 4 - Main Controller** (In Progress):
- ✅ Input controller (extracted to `src/input/input-controller.ts`)
- ✅ Selection manager (extracted to `src/input/selection-manager.ts`)
- ✅ Warp gate manager (extracted to `src/input/warp-gate-manager.ts`)

## Questions?

If you're unsure about a refactoring:

1. **Look for patterns** - Find similar extractions already done
2. **Start small** - Extract one function, test, then continue
3. **Ask for review** - Get feedback before large changes
4. **Document your work** - Update this guide with lessons learned

## Conclusion

Refactoring is an ongoing process. The goal is not perfection, but continuous improvement. Each small extraction makes the codebase more maintainable and easier for both humans and AI agents to understand and modify.

Remember: **Make it work, make it right, make it fast** - in that order!
