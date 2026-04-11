# Radiant Hero — Radiant Faction Hero

> **Faction:** Radiant · **Role:** Faction Hero / Area Denial · **Source:** `src/heroes/radiant.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 120 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | — |
| Regen | — |
| Ignores Defense | — |
| Ability Cooldown | 4.0 sec |

## Normal Attack

**No normal attack.** Radiant Hero relies entirely on orb placement and laser field connections for damage.

## Ability — Launch Orb

Fires a **deceleration orb** that creates **laser fields** connecting to other placed orbs.

| Parameter | Value |
|-----------|-------|
| Max Orbs | 3 |
| Orb Radius | 15 px |
| Laser Damage | 80 damage/sec |
| Min Range | 100 px |
| Max Range | 400 px |
| Speed Multiplier | 3.0× arrow length |
| Max Speed | 600 px/sec |
| Deceleration | 150 px/sec² |
| Bounce Damping | 0.7× on bounce |

**Behavior**:
1. Orb is launched with speed proportional to arrow draw length (capped at 600 px/sec)
2. Orb **decelerates** over time and **bounces off asteroids** with 70% speed retention
3. Range scales with current speed — slower orb = shorter range before stopping
4. Once placed, orbs form **laser connections** to other nearby orbs
5. Lasers deal **80 damage per second** to any enemy passing through
6. Maximum 3 orbs active — launching a 4th removes the oldest

**Laser Field**: The primary damage mechanism. Enemies caught between two orbs take sustained 80 DPS from the laser connection. Multiple orb pairs create crossfire patterns.

## AI Strategy Guidelines

### General Logic
- Radiant Hero is a **zone denial specialist** — laser fields control space, not chase targets
- Orb placement is the entire kit — position them to create impassable laser barriers
- Short cooldown (4s) allows rapid orb repositioning

### Positioning
- Position near **chokepoints** where laser fields cut off enemy movement
- Stay 200-400px from the action — the hero is placing orbs, not fighting directly
- Move to reposition laser fields as the fight shifts

### Ability Usage
- **Place orbs to form triangles** — 3 orbs create 3 laser connections, maximizing field coverage
- Aim for **asteroid gaps** and corridors where enemies must pass through
- Use bounce mechanics to place orbs behind asteroids for unexpected laser angles
- Rapidly reposition by launching new orbs — the 4-second cooldown allows quick adjustments
- Block enemy retreat paths with laser fields to trap them in kill zones

### Threat Assessment
- **Strong against**: Large formations pushing through corridors, melee heroes that must path through lasers
- **Weak against**: Blink (teleports past fields), ranged heroes that fight from outside laser zones
- **Countered by**: Heroes that can destroy orbs, or those that simply avoid the laser zone

### Synergies
- **Radiant Hero + Chrono**: Freeze zones inside laser fields = enemies frozen in 80 DPS beams
- **Radiant Hero + Grave**: Black Hole pulls enemies through laser fields
- **Radiant Hero + Turret Deployer**: Turrets and lasers create overlapping denial zones
