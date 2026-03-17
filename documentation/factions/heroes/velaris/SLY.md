# Sly — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Trap Specialist · **Source:** `src/heroes/sly.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 90 |
| Attack Damage | 15 |
| Attack Speed | 1.5 attacks/sec |
| Attack Range | 200 px |
| Defense | 8 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 0 (no cooldown) |

## Normal Attack

Standard ranged attack at 1.5 attacks per second. Moderate DPS (22.5 damage/sec) provides backup combat capability between trap placements.

## Ability — Sticky Laser Bomb (Toggle)

Throws a **sticky bomb** that attaches to surfaces and fires 3 lasers when triggered.

| Bomb Parameter | Value |
|---------------|-------|
| Initial Speed | 500 px/sec |
| Deceleration | 200 px/sec² |
| Min Speed | 20 px/sec |
| Stick Distance | 25 px |
| Arm Time | 0.5 sec |
| Max Lifetime | 5.0 sec |
| Bomb Radius | 12 px |

| Laser Parameter | Value |
|----------------|-------|
| Wide Laser Damage | 40 |
| Wide Laser Width | 20 px |
| Diagonal Laser Damage | 25 per beam |
| Diagonal Laser Width | 12 px |
| Laser Angle | 45° (diagonals) |
| Laser Range | 500 px |
| Laser Duration | 0.15 sec |

**Toggle Behavior**:
1. **First ability use**: Throws a sticky bomb toward the aimed direction
2. Bomb decelerates and sticks to asteroids, structures, or boundaries on contact
3. After sticking, bomb arms in **0.5 seconds**
4. **Second ability use** (while bomb is stuck and armed): Triggers the bomb
5. Fires **3 lasers simultaneously**:
   - 1 **wide main laser** (40 damage, 20px wide) perpendicular to the stuck surface
   - 2 **diagonal lasers** (25 damage each, 12px wide) at ±45° angles
6. If the bomb doesn't stick within 5 seconds, it **disintegrates** into 20 particles

**Total Damage**: 40 (main) + 25 + 25 (diagonals) = **90 damage** if all 3 lasers hit.

**Disintegration**: If the bomb fails to stick, it breaks into 20 particles (speed: 150 px/sec, lifetime: 1.0s) — a visual effect, not damaging.

## AI Strategy Guidelines

### General Logic
- Sly is a **trap ambusher** — place sticky bombs on asteroid surfaces along enemy paths
- No cooldown means rapid trap deployment; 0.5s arm time is near-instant
- The 3-laser pattern covers a wide area — position bombs to hit chokepoints
- Normal attack provides moderate DPS between trap cycles

### Positioning
- Position near **asteroid-heavy areas** where sticky bombs have surfaces to attach to
- Stay at 150-200px from combat zones — close enough to fight, far enough to escape
- Use asteroids as cover while placing traps

### Ability Usage
- **Stick bombs on asteroids along enemy approach routes** — the perpendicular laser fires outward
- Angle bomb placement so the **main wide laser** covers the most enemy traffic
- Diagonal lasers catch enemies on the flanks of the main laser
- Trigger bombs when enemies walk past — 0.15s laser duration means precise timing matters
- If no good surface is available, skip and use normal attacks
- Chain rapid throw-stick-trigger cycles in close combat (throw → 0.5s arm → trigger)

### Threat Assessment
- **Strong against**: Enemies moving through asteroid corridors (triple laser ambush), grouped pushes
- **Weak against**: Open-space combat (no surfaces to stick to), fast heroes that avoid traps
- **Countered by**: Tank crescent wave (erases the bomb), heroes that take alternate routes

### Synergies
- **Sly + Nova**: Overlapping trap fields covering different angles and damage types
- **Sly + Chrono**: Freeze zone holds enemies in laser firing lines
- **Sly + Dagger**: Dagger lures enemies into trap zones with hit-and-run
