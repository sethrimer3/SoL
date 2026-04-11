# Aurum Hero — Aurum Faction Hero

> **Faction:** Aurum · **Role:** Faction Hero / Shield Support · **Source:** `src/heroes/aurum-hero.ts`

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
| Ability Cooldown | 5.0 sec |
| Sunlight Speed Multiplier | 1.5× (moves faster in sunlight) |

## Normal Attack

**No normal attack.** Aurum Hero relies on orb placement and shield field connections for its contribution.

## Ability — Launch Shield Orb

Fires a **destructible orb** that creates **shield fields** connecting to other placed orbs.

| Parameter | Value |
|-----------|-------|
| Max Orbs | 4 |
| Orb Radius | 15 px |
| Orb Max Health | 200 HP |
| Min Range | 100 px |
| Max Range | 400 px |
| Speed Multiplier | 3.0× arrow length |
| Max Speed | 600 px/sec |
| Deceleration | 150 px/sec² |
| Bounce Damping | 0.7× on bounce |
| Shield Offset | 25 px |
| Shield Hit Duration | 0.3 sec |

**Behavior**:
1. Orb is launched with speed proportional to arrow draw length (up to 600 px/sec)
2. Orb decelerates and bounces off asteroids with 70% speed retention
3. Unlike Radiant/Velaris orbs, Aurum orbs **have 200 HP and can be destroyed**
4. Once placed, orbs form **shield field connections** to nearby orbs
5. Maximum 4 orbs active (one more than Radiant/Velaris) — launching a 5th removes the oldest
6. Shield fields absorb damage for allies passing between orbs
7. Shield hit visual effect lasts 0.3 seconds when the field takes damage

**Key Difference from Other Faction Heroes**: Aurum orbs are destructible but get **4 orbs** instead of 3, creating more complex shield geometries.

## AI Strategy Guidelines

### General Logic
- Aurum Hero creates **defensive infrastructure** through shield field placement
- 4 orbs create up to **6 shield connections** (4 orbs in a square) for maximum coverage
- Orbs can be destroyed — place them where enemies can't easily focus them

### Positioning
- Position near **frontline chokepoints** where shield fields protect advancing allies
- Stay 200-300px behind the shield wall, launching new orbs as needed
- Move faster in sunlight — use sunlit paths for repositioning (1.5× speed)

### Ability Usage
- **Form shield walls across chokepoints** to protect advancing formations
- Place orbs in a **line** to create a wall, or in a **diamond** for surrounding protection
- Replace destroyed orbs quickly — 5-second cooldown allows rapid rebuilding
- Place orbs near **Preist** to shield the healer from incoming fire
- Shield fields near **Tank** create overlapping damage reduction

### Threat Assessment
- **Strong against**: Projectile-heavy enemies (shields absorb fire), ranged compositions
- **Weak against**: Heroes that bypass shields (Blink, Driller), melee that fights inside the shield
- **Countered by**: Focus fire on orbs (200 HP each), AoE that hits both orbs and heroes

### Synergies
- **Aurum Hero + Tank**: Double-layered defense with Tank shield + orb shield fields
- **Aurum Hero + Preist**: Shield fields protect the healer, healer sustains the frontline
- **Aurum Hero + Splendor**: Shield wall protects Splendor as it fires defense-piercing lasers
