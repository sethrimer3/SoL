# Shroud — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Siege / Denial · **Source:** `src/heroes/shroud.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 115 |
| Attack Damage | 80 (max cube damage) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | 12 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 7.0 sec |

## Normal Attack

**No normal attack.** Shroud fires heavy cubes via its ability.

## Ability — Shroud Cube

Fires a **heavy cube** that decelerates, deals velocity-proportional damage, then unfolds into smaller cubes that **block sunlight**.

| Parameter | Value |
|-----------|-------|
| Speed Multiplier | 2.5× arrow length |
| Initial Speed | 700 px/sec |
| Deceleration | 500 px/sec² |
| Stop Speed | 5 px/sec |
| Cube Half-Size | 28 px |
| Max Damage | 80 (at full speed) |
| Cube Lifetime | 35.0 sec |

**Unfolding Sequence**:
1. Main cube fires at high speed, decelerating
2. **Damage is proportional to velocity** — fast = more damage, slow = less
3. When cube stops (below 5 px/sec), it unfolds into **4 small cubes** (14px half-size)
4. Small cubes unfold immediately (0.0s delay)
5. Each small cube unfolds into **3 tiny cubes** (7px half-size), skipping back-facing direction
6. Tiny cubes begin unfolding 0.4 seconds after small cube spawn
7. Total unfolding takes 0.6 seconds
8. **All stopped cubes block sunlight** for enemy solar mirrors

**Sunlight Blocking**: The primary strategic value. A cube field near enemy mirrors prevents them from generating energy, crippling the opponent's economy. Each cube exists for **35 seconds** before expiring.

## AI Strategy Guidelines

### General Logic
- Shroud is an **economic warfare specialist** — deny enemy mirror income by blocking sunlight
- Cube damage is secondary; the primary value is the 35-second sunlight block
- Fire cubes at **enemy solar mirrors**, not at enemy heroes
- 7-second cooldown allows building a substantial cube field over time

### Positioning
- Position within **firing range of enemy mirror lines**
- Stay at a safe distance — Shroud's value is in cube placement, not fighting
- Position behind frontline heroes while lobbing cubes over their heads

### Ability Usage
- **Target enemy solar mirrors** to block their sunlight income
- Fire cubes at the **sun-to-mirror light path** to intercept sunlight before it reaches mirrors
- Bounce cubes off asteroids to reach mirrors behind cover
- Stack multiple cubes in the same area for redundant coverage (35-second lifetime)
- Use fast-moving cubes against enemy heroes for burst damage (up to 80 at max velocity)
- Slow-moving cubes are better for precise placement near mirrors

### Threat Assessment
- **Strong against**: Mirror economy (blocks sunlight), clustered structures, stationary targets
- **Weak against**: Heroes that don't depend on mirrors, mobile enemies that avoid cubes
- **Countered by**: Splendor Sun Sphere (creates alternative sunlight), mirror repositioning

### Synergies
- **Shroud + Driller**: Shroud blocks mirror light, Driller physically destroys mirrors — double economic denial
- **Shroud + Occlude**: Both deny sunlight — combined they can eclipse entire mirror arrays
- **Shroud + Tank**: Tank protects Shroud while cubes are placed
