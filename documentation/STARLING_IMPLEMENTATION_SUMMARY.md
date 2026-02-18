# Starling Frontal Arc Shooting and Shade Brightening Implementation

## Summary

This implementation adds three key features to the SoL game:

1. **Line of Sight Enhancement**: Units now have a line of sight that is 20% greater than their attack range
2. **Starling Directional Shooting**: Moving starlings can only shoot targets within a 180-degree frontal arc
3. **Visual Shade Brightening**: Shaded areas near player units and structures are visually brightened

## Implementation Details

### 1. Line of Sight (20% More Than Attack Range)

**Files Modified:**
- `src/constants.ts`: Added `UNIT_LINE_OF_SIGHT_MULTIPLIER = 1.2`
- `src/sim/entities/unit.ts`: Added `lineOfSight` property calculated in constructor
- `src/sim/game-state.ts`: Updated `isObjectVisibleToPlayer()` to use unit's `lineOfSight`

**Behavior:**
- For starlings with 120px attack range, line of sight is now 144px
- Applies to all units inheriting from the Unit base class
- Used by visibility system to determine what enemies can be seen in shadows

### 2. Starling Frontal Arc Shooting

**Files Modified:**
- `src/sim/entities/starling.ts`: Added `canShootTarget()` method

**Behavior:**
- **Stationary starlings** (velocity < 1.0 px/sec): Can shoot 360 degrees
- **Moving starlings**: Can only shoot targets within 180-degree arc ahead (±90 degrees from movement direction)
- Uses dot product of velocity and target direction vectors (>= 0 means within arc)

**Mathematical Implementation:**
```typescript
// Calculate velocity direction
velocityDir = normalize(velocity)

// Calculate direction to target  
toTargetDir = normalize(target.position - starling.position)

// Dot product gives cosine of angle
dotProduct = velocityDir · toTargetDir

// Within 180-degree arc if dot product >= 0 (angle <= 90°)
canShoot = dotProduct >= 0
```

### 3. Visual Shade Brightening

**Files Modified:**
- `src/constants.ts`: Added `SHADE_BRIGHTNESS_BOOST = 0.4` and `SHADE_BRIGHTNESS_RADIUS = 200`
- `src/renderer.ts`: Added brightening calculation methods
  - `getShadeBrightnessBoost()`: Calculates proximity to friendly units/structures
  - `applyShadeBrightening()`: Applies brightness boost to colors
- Applied to: Starlings, Forges, and Mirrors when in shade

**Behavior:**
- Objects in shade near player units/structures get up to 40% brightness boost
- Effect radius: 200 pixels from units/structures
- Quadratic falloff for smooth transition
- Only applies in shaded areas (not in sunlight)

## Testing

### Verification Tests
- Created `verify-starling-logic.js` with 7 comprehensive tests
- All tests pass:
  - Stationary starlings shoot 360 degrees ✓
  - Moving starlings shoot targets ahead ✓
  - Moving starlings cannot shoot targets behind ✓
  - Moving starlings shoot at 90-degree perpendicular ✓
  - Moving starlings cannot shoot past 90 degrees ✓
  - Moving starlings shoot at 45-degree angles ✓
  - Line of sight correctly calculated ✓

### Security Scan
- CodeQL analysis: 0 vulnerabilities found ✓

## Code Quality

- All code follows existing patterns in the codebase
- Minimal changes made (surgical modifications)
- Comments added for clarity
- No breaking changes to existing functionality
- Build succeeds without errors

## Security Summary

No security vulnerabilities were introduced by this implementation. The changes are purely gameplay logic and visual enhancements that:
- Do not expose sensitive data
- Do not create attack vectors
- Do not modify authentication or authorization
- Follow existing security patterns in the codebase

## Performance Considerations

- Line of sight calculation: O(1) per unit (done once in constructor)
- Frontal arc check: O(1) per attack attempt (simple dot product)
- Shade brightening: O(n) where n = number of friendly units/structures (only calculated when rendering shaded objects)

All operations are computationally lightweight and should have negligible performance impact.
