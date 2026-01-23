# Ability System Testing Guide

## How to Test the Special Ability System

### Prerequisites
1. Build the game: `npm run build`
2. Start a local server: `cd dist && python3 -m http.server 8080`
3. Open http://localhost:8080 in a browser
4. Click "START GAME"

### Testing the Marine Bullet Storm Ability

#### Step 1: Spawn Marines
1. **Create a Warp Gate**: Hold mouse down for 6+ seconds on the map
2. **Select Marine Button**: Click the Marine button in the warp gate menu
3. **Wait for Marines to Spawn**: Marines will appear near the warp gate

#### Step 2: Select Marines
1. **Drag Selection Box**: Click and drag to create a selection rectangle around the marines
2. **Verify Selection**: Selected marines should have a green highlight

#### Step 3: Use the Ability
1. **Swipe Gesture**: Click on a selected marine and drag in the direction you want to fire
   - Must drag at least 5 pixels
   - The swipe direction determines where bullets fire
2. **Observe**: You should see 15 colored bullets fire in a cone spread
3. **Verify Deselection**: Marines should be automatically deselected after ability use

#### Step 4: Test Cooldown
1. **Immediate Re-use**: Try to use the ability again immediately
   - Should NOT work (on cooldown)
2. **Wait 5 Seconds**: Wait for the cooldown to complete
3. **Use Again**: The ability should work again after cooldown

### Expected Behavior

#### Visual Effects
- **Bullet Color**: Matches the player's faction color (blue for Radiant, red for Aurum)
- **Bullet Count**: Exactly 15 bullets per ability use
- **Spread Pattern**: Bullets form a cone within 10° of swipe direction
- **Fade Out**: Bullets fade out as they travel (opacity decreases)
- **Lifetime**: Bullets last for 1 second before disappearing

#### Gameplay Mechanics
- **Damage**: Each bullet deals 5 damage on hit
- **Hit Detection**: Bullets disappear on impact with enemies
- **Cooldown**: 5 second cooldown between ability uses
- **Deselection**: Units are deselected after using ability

#### Gesture Recognition
- **Rally Point**: Dragging < 5 pixels still sets rally point (existing behavior)
- **Ability Activation**: Dragging ≥ 5 pixels activates ability
- **Direction**: Bullet cone fires in the direction of the swipe

### Troubleshooting

#### No Bullets Appear
- **Check Cooldown**: Ability might be on cooldown
- **Check Swipe Distance**: Must drag at least 5 pixels
- **Check Unit Selection**: Marines must be selected

#### Bullets Don't Hit Enemies
- **Check Direction**: Make sure swipe direction aims toward enemies
- **Check Range**: Bullets have a 1 second lifetime (travel ~500 pixels)
- **Check Hit Detection**: Bullets use 10 pixel hit radius

### Console Logging
Check the browser console (F12) for debug messages:
- `"Ability activated in direction (x, y)"` - Ability was successfully used
- `"Selected N units"` - Unit selection feedback

## Code Structure Reference

### Key Files Modified
1. `src/constants.ts` - Ability configuration constants
2. `src/game-core.ts` - Unit class, AbilityBullet class, Marine ability
3. `src/main.ts` - Swipe gesture detection in input handler
4. `src/renderer.ts` - Ability bullet rendering

### Key Classes
- `Unit` - Base class with ability system
- `Marine` - Implements Bullet Storm ability
- `AbilityBullet` - Projectile for ability attacks
- `GameState` - Manages ability bullets in game loop

### Key Constants
```typescript
MARINE_ABILITY_COOLDOWN = 5.0 // seconds
MARINE_ABILITY_BULLET_COUNT = 15 // bullets
MARINE_ABILITY_BULLET_SPEED = 500 // pixels/second
MARINE_ABILITY_BULLET_LIFETIME = 1.0 // seconds
MARINE_ABILITY_SPREAD_ANGLE = 10° // degrees
MARINE_ABILITY_BULLET_DAMAGE = 5 // per bullet
```
