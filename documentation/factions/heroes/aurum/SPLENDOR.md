# Splendor — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Caster / Zone Control · **Source:** `src/heroes/splendor.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 130 |
| Attack Damage | 35 |
| Attack Speed | 0.9 attacks/sec |
| Attack Range | 380 px |
| Defense | 12 |
| Regen | 4 HP/sec |
| Ignores Defense | Yes |
| Ability Cooldown | 8.0 sec |

## Normal Attack

**Sunlight laser** with a 0.5-second charge time. Fires a wide (22px) laser beam that **ignores defense**. Effective DPS: ~31.5 damage/sec (accounting for charge time). The laser has a visual duration of 0.12 seconds and a 22px nose offset.

| Laser Parameter | Value |
|----------------|-------|
| Charge Time | 0.5 sec |
| Laser Width | 22 px |
| Visual Duration | 0.12 sec |

## Ability — Sun Sphere

Throws a **bouncing sunlight orb** that explodes into a radiant light zone.

| Parameter | Value |
|-----------|-------|
| Sphere Radius | 16 px |
| Speed Multiplier | 3.0× arrow length |
| Max Speed | 650 px/sec |
| Deceleration | 140 px/sec² |
| Bounce Damping | 74% retention |
| Stop Speed | 40 px/sec |
| Max Lifetime | 6.0 sec |
| Sunlight Zone Radius | 220 px |
| Sunlight Zone Duration | 8.0 sec |

**Behavior**:
1. Orb is launched with speed proportional to arrow draw length (up to 650 px/sec)
2. Orb decelerates at 140 px/sec² and bounces off asteroids with 74% speed retention
3. When the orb stops (below 40 px/sec) or expires (6 seconds), it creates a **sunlight zone**
4. The sunlight zone is a 220px radius area that acts as artificial sunlight for 8 seconds
5. Solar mirrors within the zone generate energy as if in natural sunlight
6. Enemies in the zone are illuminated (revealed to all players)

## AI Strategy Guidelines

### General Logic
- Splendor is Aurum's **primary DPS hero** with the highest single-target damage
- Normal attack ignores defense — effective against Tank and armored targets
- Sun Sphere provides **economic utility** (sunlight for mirrors) and **vision** (reveals enemies)

### Positioning
- Position at **250-380px** from enemies to maximize attack range usage
- Splendor is moderately durable (130 HP, 12 defense) — can be mid-line
- Stay in sunlight for thematic consistency and near mirrors for Sun Sphere utility

### Ability Usage
- **Place Sun Sphere near allied solar mirrors** in shadow to boost energy production
- Use Sun Sphere to **reveal cloaked enemies** (Dagger, Shadow decoys)
- Bounce the orb off asteroids to reach difficult positions
- Time the throw so the sphere stops near enemy clusters — illumination reveals them
- 8-second sunlight zone duration provides sustained area control

### Threat Assessment
- **Strong against**: Tank (ignores defense), shadow-reliant heroes (reveals them), mirror economy management
- **Weak against**: Burst assassins (Dagger, Dash) that close distance quickly
- **Countered by**: Occlude shadow cone (negates sunlight), Shroud cubes (blocks light), fast engagers

### Synergies
- **Splendor + Occlude**: Counter-pairing — Splendor creates light, Occlude denies it (useful when supporting allied mirrors vs enemy mirrors)
- **Splendor + Preist**: Healing sustains Splendor's mid-range presence
- **Splendor + Tank**: Tank protects Splendor while defense-piercing laser fires freely
