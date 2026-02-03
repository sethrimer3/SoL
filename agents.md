# AI Agent Guidelines for SoL Repository

This document provides comprehensive guidelines for AI agents working on the SoL (Simulation of Life) codebase. These rules are designed to maintain determinism, performance, and code quality.

---

## 1. Deterministic Multiplayer (Non-Negotiable)

The authoritative simulation **must be deterministic**. Given the same initial state and the same ordered command stream, all peers must produce identical state hashes at each tick.

### Core Requirements

1. **Hard separation**: `sim/` (deterministic) must **not** depend on `render/` or `ui/`.
2. **No wall-clock time in simulation**:
   - Use an integer `tick` and `dtMs` derived from tick rate
   - **Never** use `Date.now()` or `performance.now()` in simulation code
3. **All randomness is seeded**:
   - Route all RNG through a single deterministic RNG in `sim/`
   - **No `Math.random()` in sim code**
4. **Float discipline**:
   - Prefer integer or fixed-point math for sim-critical calculations (positions, velocities, damage, timers) where feasible
   - If floats are used, do it in a tightly controlled, consistent way
   - Avoid platform-dependent trig in sim if possible
5. **State hash maintenance**:
   - Maintain a `stateHash` (cheap hash of sim state) computed at a fixed cadence (e.g., every N ticks) for desync detection

### Critical Rule for Changes

**Whenever you change sim logic, update or add a state hash check and include a small deterministic replay snippet (command list) used to validate no desync.**

---

## 2. Tech Stack Scope

### TypeScript First

- Repository uses **TypeScript** for core code
- JavaScript allowed **only** for:
  - Build tooling
  - Vendor/third-party shims
  - Isolated "leaf" modules with a strong justification

### TypeScript Configuration

- **Strict mode** enabled
- **No implicit `any`**
- All core game logic must be strongly typed

---

## 3. Performance Pillar: Render Hundreds of Units/Projectiles

Rendering is **performance-critical** and must support hundreds of moving entities (units + projectiles) with pathfinding running concurrently.

### Rendering Requirements

1. **Allocation-minimal per frame**:
   - No per-frame object/array creation in hot paths
2. **Batch-friendly**:
   - Group draws by sprite/texture/material
3. **Decoupled from sim**:
   - Render reads from a snapshot/readonly view
   - Sim writes only within tick
4. **Data-oriented layouts**:
   - Prefer struct-of-arrays or packed arrays for hot loops where helpful
5. **Performance overlay**:
   - Add/keep a lightweight performance overlay (FPS + frame time + entity counts)
   - **Do not remove** it without replacement

---

## 4. Naming Guidelines (Must Follow)

These guidelines prevent bugs and improve code clarity.

### General Rules

- **State**: Use nouns (e.g., `position`, `velocity`, `health`)
- **Actions**: Use verbs (e.g., `move`, `attack`, `spawn`)
- **Commands**: Use imperative verbs (e.g., `moveUnit`, `attackTarget`)
- **Avoid ambiguous abbreviations**: If you must abbreviate, be consistent and document in `DECISIONS.md`

### Booleans

Booleans **must** start with `is`, `has`, `can`, `should`, or `needs`.

**Good**:
- `isSelected`
- `hasTarget`
- `canFire`
- `shouldRender`
- `needsRepath`

**Bad**:
- `selected`
- `targeted`
- `fireable`

**Exception**: Never encode booleans as numbers unless in a performance-critical packed structure. If so, suffix with `Flag` and comment it:
```typescript
isVisibleFlag: 0 | 1  // Packed boolean for performance
```

### Counts / Indices / IDs

- **Counts** end with `Count`:
  - `unitCount`, `projectileCount`
- **Indices** end with `Index` and are 0-based unless explicitly named otherwise:
  - `unitIndex`, `pathNodeIndex`
- **IDs** end with `Id` and are opaque (never treat as index):
  - `playerId`, `unitId`, `commandId`
- If something is truly an array index into a packed store, name it `handle` or `Index` explicitly—**do not call it `id`**

### Units of Measure

Any numeric value representing a unit **must** include a suffix:

- **Time**: `Ms`, `Ticks`, `Sec` (pick one standard; prefer `Ms` or `Ticks`)
  - Examples: `cooldownMs`, `spawnTick`, `durationMs`
- **Distance**: `Px`, `M` (meters), or `World` (define in DECISIONS.md)
  - Examples: `rangeM`, `radiusPx`, `distanceWorld`
- **Angle**: `Rad` or `Deg` (pick one; prefer `Rad` in code)
  - Examples: `angleRad`, `rotationRad`

**Never mix unit systems in one function without explicit conversion helpers.**

### Coordinate Spaces

Use suffixes to distinguish coordinate spaces:

- `Screen`, `World`, `Grid`

**Examples**:
- `cursorScreen`
- `cursorWorld`
- `tileGrid`

**Conversion helpers** must be named explicitly:
- `screenToWorld`
- `worldToGrid`
- `gridToWorld`

### Collections

- **Arrays/plurals** are plural nouns:
  - `units`, `projectiles`, `selectedUnitIds`
- **Maps** should include the key type in the name:
  - `unitById`
  - `entityIndexById`
  - `cellsByKey`

### Events vs Commands

Use explicit terminology:

- **Command**: Player/network input applied to sim at a tick (determinism-critical)
- **Event**: Derived output (e.g., explosion happened) that can be reconstructed

**Naming conventions**:
- Commands: `MoveCommand`, `AttackCommand`, `CastAbilityCommand`
- Events: `ExplosionEvent`, `UnitDestroyedEvent`

### Mutability Signal

- **Mutable sim state types** end with `State`:
  - `WorldState`, `UnitState`
- **Readonly views/snapshots** end with `View` or `Snapshot`:
  - `WorldSnapshot`, `UnitView`
- **Functions that mutate** must start with verbs like `apply`, `set`, `add`, `remove`, `enqueue`:
  - `applyDamage`, `setPosition`, `addUnit`, `removeProjectile`, `enqueueCommand`
- **Deterministic command application** should be named `applyCommand(...)`

---

## 5. Hot-Path Coding Rules (To Protect Performance)

### Avoid Hidden Allocations

- **No** `Array.map`/`filter`/`reduce` in hot loops
  - Use `for` loops instead
- **No** creating `{}` per entity per frame
- **No** closures inside per-frame/per-entity loops

### Object Pooling

- Preallocate typed arrays or object pools for units/projectiles
- Name pools clearly: `unitPool`, `projectilePool`

### Math Helpers

- Keep math helpers **pure** and **allocation-free**

---

## 6. Repository Structure Constraints (Reinforced)

### Directory Responsibilities

- **`sim/`**: Pure deterministic logic
  - **No** DOM, canvas, audio, random, or time
  - Only deterministic calculations
- **`render/`**: Optimized rendering
  - **Never** modifies sim
  - Only reads `Snapshot`/`View`
- **`net/`**: Transport commands
  - Does **not** interpret game rules beyond ordering/validation
- **`input/`**: Gesture/mouse to Commands
  - Does **not** directly modify sim
  - Produces `Command` objects for sim to process

---

## 7. Required Documentation

Maintain these documentation files:

1. **`DECISIONS.md`**: Document critical design decisions
   - Seed RNG choice
   - Tick rate
   - Coordinate system
   - Float vs fixed-point decisions
   - Network ordering

2. **`ARCHITECTURE.md`**: System architecture
   - Tick loop
   - Command pipeline
   - Snapshot boundary
   - Render pipeline

3. **`manual_test_checklist.md`**: Manual testing procedures
   - Selection
   - Orders
   - Queueing
   - Pathfinding
   - Desync check
   - Large-entity stress test

---

## 8. Workflow for AI Agents

### Before Making Changes

1. Read existing code to understand patterns
2. Check relevant documentation (`ARCHITECTURE.md`, `DECISIONS.md`)
3. Identify which layer you're working in (`sim/`, `render/`, `net/`, `input/`)

### While Making Changes

1. Follow naming guidelines strictly
2. Maintain hard separation between layers
3. Avoid allocations in hot paths
4. Use appropriate suffixes for units and types
5. Keep functions pure and deterministic in `sim/`

### After Making Changes

1. Increment `BUILD_NUMBER` in `src/build-info.ts` by 1 for every repository change
2. **Add or update state hash checks** for sim logic changes
3. Include a deterministic replay snippet (command list) to validate no desync
4. Update relevant documentation if architectural changes were made
5. Test with performance overlay enabled
6. Verify hundreds of entities render smoothly

---

## 9. Common Pitfalls to Avoid

- ❌ Using `Date.now()` or `performance.now()` in sim code
- ❌ Using `Math.random()` in sim code
- ❌ Creating objects in per-frame loops
- ❌ Making sim depend on render or UI
- ❌ Using ambiguous variable names without proper suffixes
- ❌ Mixing coordinate spaces without conversion
- ❌ Mixing unit systems (e.g., seconds and milliseconds) without conversion
- ❌ Using boolean names without `is`, `has`, `can`, `should`, or `needs` prefix
- ❌ Treating IDs as array indices
- ❌ Removing the performance overlay

---

## 10. Checklist for Sim Changes

When modifying simulation code, ensure:

- [ ] No wall-clock time used
- [ ] No `Math.random()` used
- [ ] All RNG goes through deterministic seeded RNG
- [ ] State hash check added or updated
- [ ] Deterministic replay snippet provided for validation
- [ ] No dependencies on `render/`, `ui/`, or DOM
- [ ] Proper naming conventions followed
- [ ] Units of measure suffixes used
- [ ] Float usage justified and controlled (or replaced with integer/fixed-point)
- [ ] Hot-path code avoids allocations
- [ ] Documentation updated if needed

---

## 11. Hero Unit File Guidelines

When adding or refactoring hero units, keep each hero (and its ability helpers) in a dedicated file
under `src/heroes/` using the established factory pattern.

### Structure
- **One hero per file**: `src/heroes/<hero-name>.ts` should export `create<HeroName>Hero(...)`.
- **Ability helpers in the same file**: related helper classes (projectiles, zones, beam segments, turrets)
  must live alongside their hero class.
- **No runtime imports from `game-core.ts`**: use the factory dependency injection pattern to avoid circular
  dependencies. Type-only imports from `game-core.ts` are acceptable.

### Integration Steps (Do Not Skip)
1. **Add/extend hero file**: create `create<HeroName>Hero` and keep logic identical to the previous
   behavior when refactoring.
2. **Wire into `game-core.ts`**:
   - Import `create<HeroName>Hero` at the top.
   - Instantiate the hero via the factory and export the resulting class(es).
   - Update `createHeroUnit(...)` to include the new hero type string.
3. **Update UI/rendering** (if a new hero):
   - Add sprite entries in `src/renderer.ts`.
   - Update hero production UI names and availability checks.
4. **Update AI and balance hooks**:
   - Add hero to the AI hero type lists and any faction mappings.
   - Add constants for stats/abilities in `src/constants.ts`.

### Consistency Rules
- **No behavior changes during refactors**: a file split must be a pure move (logic and constants stay identical).
- **Preserve deterministic simulation rules**: no new wall-clock time or nondeterministic RNG in hero logic.
- **Keep exports stable**: `game-core.ts` should continue to export hero classes and helpers for renderer/main.

---

## Summary

This codebase prioritizes **determinism**, **performance**, and **clarity** above all else. Every line of code should support these goals. When in doubt:

1. Make it **deterministic** first
2. Make it **performant** second
3. Make it **clear** third

Following these guidelines ensures the simulation remains reliable, fast, and maintainable for multiplayer gameplay with hundreds of entities.
