# Forge Crunch Implementation - Summary

## Problem Statement
Implement forge crunches that:
1. Slightly suck space dust toward the base
2. Have a "wave" effect going outward from the base pushing dust away
3. Spawn minions with excess solarium not used for structures/hero units

## Solution Implemented

### Core Mechanics
- **Crunch Interval**: Every 10 seconds when forge receives light
- **Two-Phase Animation**:
  - **Suck Phase** (0.8s): Pulls space dust toward forge within 250px radius
  - **Wave Phase** (1.2s): Pushes dust away in expanding wave within 300px radius
- **Minion Spawning**: Accumulated solarium spawns Starlings (50 solarium each)

### Technical Implementation

#### New Files
- `FORGE_CRUNCH_TESTING.md` - Comprehensive testing guide
- `test-forge-crunch.ts` - TypeScript test demonstrating the mechanics

#### Modified Files

**src/constants.ts**
- Added 8 new constants for crunch timing, forces, and radii
- `FORGE_CRUNCH_INTERVAL = 10.0s`
- `FORGE_CRUNCH_SUCK_DURATION = 0.8s`, `FORGE_CRUNCH_WAVE_DURATION = 1.2s`
- `FORGE_CRUNCH_SUCK_RADIUS = 250px`, `FORGE_CRUNCH_WAVE_RADIUS = 300px`
- `FORGE_CRUNCH_SUCK_FORCE = 150`, `FORGE_CRUNCH_WAVE_FORCE = 200`
- `STARLING_COST_PER_SOLARIUM = 50`

**src/game-core.ts**
- **New Class: ForgeCrunch** (~60 lines)
  - Tracks crunch state (phase, timers, position)
  - Handles phase transitions (idle → suck → wave → idle)
  - Provides phase progress for wave animation
  
- **Modified Class: StellarForge**
  - Replaced `starlingSpawnTimer` with `crunchTimer`
  - Added `pendingSolarium` accumulator
  - Added `currentCrunch` for active effect tracking
  - New methods: `shouldCrunch()`, `addPendingSolarium()`, `getCurrentCrunch()`

- **Modified: Game Update Loop**
  - Solar mirrors now feed pending solarium pool
  - Crunch triggers spawn starlings based on accumulated solarium
  - Starlings spawn evenly distributed around forge

- **Modified: updateSpaceDust()**
  - Added crunch force application (~50 lines)
  - Suck phase: Inward radial force with distance falloff
  - Wave phase: Outward force with wavefront focusing

### Code Quality
- ✅ TypeScript compilation successful
- ✅ All Python tests pass (22/22)
- ✅ Code review: No issues found
- ✅ Security scan (CodeQL): No vulnerabilities
- ✅ Build successful (webpack bundle created)

### Design Decisions

1. **Solarium Management**: Changed from instant use to accumulation model
   - Mirrors add to `pendingSolarium` instead of player's direct pool
   - Allows for batch processing during crunches
   - More aligned with the "crunch" concept

2. **Spawn Distribution**: Starlings spawn evenly around forge
   - Positioned at 70% of wave radius for visual effect
   - Evenly distributed angles for balanced positioning
   - Spawns during crunch trigger (not tied to wave phase completion)

3. **Force Application**: Wave uses exponential falloff with wavefront
   - Wavefront position = progress * radius
   - Force strength peaks at wavefront using exp(-distance/sharpness)
   - Creates clear visual wave propagation

4. **Timing**: 10 second interval matches original spawn timing
   - Provides consistent resource-to-unit conversion
   - Balances game economy with previous system
   - Visual effects complete within 2 seconds (suck + wave)

### Minimal Changes Approach
- Reused existing physics system (particle.applyForce)
- Followed existing patterns (similar to warp gate spiral)
- Maintained backward compatibility (Python tests still pass)
- No changes to rendering system (forces work with existing dust rendering)
- Surgical modifications to game loop (only starling spawn logic changed)

## Testing Instructions
See `FORGE_CRUNCH_TESTING.md` for detailed testing guide.

Quick verification:
```bash
npm run build
# Open dist/index.html in browser
# Watch for dust movement every 10 seconds
# Check console for spawn messages
```

## Future Enhancements (Not in Scope)
- Visual crunch indicator on forge sprite
- Sound effects for crunch
- Particle color change during crunch
- UI display of pending solarium
- Configurable crunch parameters per faction
