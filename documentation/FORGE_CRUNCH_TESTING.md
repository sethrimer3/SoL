# Forge Crunch Feature - Manual Testing Guide

## What Was Implemented

The forge crunch feature has been implemented with the following mechanics:

### 1. **Crunch Cycle** (Every 10 seconds)
- When the Stellar Forge receives light from Solar Mirrors, it accumulates energy
- Every 10 seconds, the forge performs a "crunch" 
- During a crunch:
  - **Suck Phase** (0.8 seconds): Space dust is pulled toward the forge
  - **Wave Phase** (1.2 seconds): Space dust is pushed away in a wave effect

### 2. **Minion Spawning**
- When a crunch happens, all accumulated energy is used to spawn Starling minions
- Each Starling costs 50 energy
- Starlings spawn evenly distributed around the forge at the wave edge (70% of wave radius)

### 3. **Space Dust Physics**
- During suck phase: Dust within 250 pixels is pulled toward forge with force decreasing by distance
- During wave phase: Dust within 300 pixels is pushed away in a wave pattern
- The wave has a focused "wavefront" that provides the strongest push

## How to Test

### Visual Test (Recommended)
1. Build and run the game:
   ```bash
   npm run build
   # Open dist/index.html in a browser
   ```

2. Watch for the following:
   - **Space dust movement**: Every 10 seconds, you should see dust particles:
     - First pull toward the forge (0.8s)
     - Then get pushed away in a wave (1.2s)
   
   - **Minion spawning**: If the forge is generating energy, every 10 seconds you should see:
     - Starling units spawn around the forge
     - Number of starlings = (accumulated energy / 50)
     - Check console for log: "forge crunch spawned X Starlings with Y energy"

### Code Verification
All new code has been added to:
- `src/constants.ts` - New constants for crunch timing and effects
- `src/game-core.ts` - ForgeCrunch class and updated StellarForge logic
- Build successful: ✓

### Unit Test Verification
TypeScript type checking passes: ✓
Python tests still pass: ✓ (22/22 tests)

## Implementation Details

### New Constants (constants.ts)
```typescript
FORGE_CRUNCH_INTERVAL = 10.0          // Seconds between crunches
FORGE_CRUNCH_SUCK_DURATION = 0.8      // Suck phase duration
FORGE_CRUNCH_WAVE_DURATION = 1.2      // Wave phase duration
FORGE_CRUNCH_SUCK_RADIUS = 250        // Suck effect radius
FORGE_CRUNCH_WAVE_RADIUS = 300        // Wave effect radius
FORGE_CRUNCH_SUCK_FORCE = 150         // Suck force magnitude
FORGE_CRUNCH_WAVE_FORCE = 200         // Wave force magnitude
STARLING_COST_PER_SOLARIUM = 50       // Energy per starling
```

### New Classes
- **ForgeCrunch**: Tracks crunch state (phase: idle/suck/wave, timers, position)

### Modified Classes
- **StellarForge**: 
  - Replaced `starlingSpawnTimer` with `crunchTimer`
  - Added `pendingEnergy` to accumulate resources
  - Added `currentCrunch` to track active crunch effect
  - New methods: `shouldCrunch()`, `addPendingEnergy()`, `getCurrentCrunch()`

### Modified Game Loop
- Solar mirrors now add generated energy to forge's pending pool
- Crunch triggers every 10s when forge receives light
- Starlings spawn based on pending energy amount
- Space dust updated with crunch forces in both phases

## Expected Behavior

1. **With No Solar Mirrors / No Light**:
   - No crunches occur
   - No dust movement from forge
   - No starlings spawn

2. **With Active Solar Mirrors**:
   - Every 10 seconds: crunch animation (dust suck + wave)
   - Starlings spawn every crunch based on energy generation rate
   - Example: 3 mirrors generating ~15 energy/sec = 150 energy per crunch = 3 starlings

3. **Space Dust Visual**:
   - Should clearly show the "suck then push" pattern
   - Wave should propagate outward from the forge
   - Dust returns to normal behavior after crunch completes
