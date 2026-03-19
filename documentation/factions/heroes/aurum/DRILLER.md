# Driller — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Flanker / Ambusher · **Source:** `src/heroes/driller.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 140 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | 16 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 5.0 sec |

## Normal Attack

**No normal attack.** Driller relies entirely on its drill charge ability for damage.

## Ability — Drill Charge

Burrows through asteroids at high speed toward the target direction, dealing damage on emergence.

| Parameter | Value |
|-----------|-------|
| Drill Speed | 500 px/sec |
| Drill Damage | 30 |
| Building Damage Multiplier | 2.0× (60 damage to buildings) |
| Deceleration | 200 px/sec² |

**Behavior**:
1. Driller burrows in the aimed direction at 500 px/sec
2. While inside an asteroid, Driller is **invisible and untargetable**
3. Deals 30 damage (60 to buildings) on contact with enemies
4. Emerges when exiting the asteroid, becoming targetable again
5. Must stop drilling before re-using ability
6. Decelerates at 200 px/sec² after emerging

## AI Strategy Guidelines

### General Logic
- Driller is the **premier flanker** — use asteroid tunneling to bypass defenses
- High HP (140) and defense (16) make Driller one of the most durable heroes
- Drill through asteroids to attack enemy mirrors and structures from behind
- **2× building damage** makes Driller the best structure destroyer

### Positioning
- Position near **asteroids that connect to enemy territory**
- After drilling, find another asteroid to tunnel back through for retreat
- Use asteroid chains to create unpredictable attack vectors

### Ability Usage
- **Drill toward enemy solar mirrors** to destroy their economy
- Target enemy **Subsidiary Factories** and **buildings** with 2× damage multiplier
- Drill through multiple asteroids in sequence for long-range flanks
- Use tunneling defensively to escape when focused by enemies
- Short 5-second cooldown allows rapid re-engagement

### Threat Assessment
- **Strong against**: Buildings (2× damage), solar mirrors, undefended structures, isolated heroes
- **Weak against**: Turret-guarded positions, heroes that can chase through tunnels, grouped defenders
- **Countered by**: Mirror guards (Hard AI places them), Turret Deployer zones, alert defenders

### Synergies
- **Driller + Blink**: Both can bypass defenses — coordinated double-flank
- **Driller + Shroud**: Shroud blocks mirror sunlight while Driller destroys the mirrors physically
- **Driller + Dash**: Fast heroes harassing from multiple directions
