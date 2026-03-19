# Nova — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Remote Bomb Specialist · **Source:** `src/heroes/nova.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 105 |
| Attack Damage | 6 |
| Attack Speed | 2.0 attacks/sec |
| Attack Range | 250 px |
| Defense | 10 |
| Regen | 5 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 0 (no cooldown) |

## Normal Attack

Standard ranged attack at 2 attacks per second. Low damage (12 DPS) but consistent. Nova's value comes from bomb placement, not auto-attack.

## Ability — Remote Bomb (Toggle)

Throws a **bouncing bomb** that can be remotely detonated into a directional scatter explosion.

| Bomb Parameter | Value |
|---------------|-------|
| Initial Speed | 400 px/sec |
| Deceleration | 150 px/sec² |
| Min Speed | 50 px/sec |
| Arming Time | 2.0 sec |
| Max Bounces | 10 |
| Bounce Damping | 0.7× |
| Bomb Radius | 15 px |

| Explosion Parameter | Value |
|--------------------|-------|
| Explosion Damage | 50 |
| Explosion Radius | 100 px |
| Scatter Arc | 30° |
| Scatter Bullet Count | 12 |
| Scatter Bullet Speed | 350 px/sec |
| Scatter Bullet Damage | 8 per bullet |
| Scatter Bullet Lifetime | 1.0 sec |

**Toggle Behavior**:
1. **First ability use**: Throws a bomb in the aimed direction
2. Bomb bounces off asteroids (up to 10 bounces) and decelerates
3. Bomb must **arm** after 2.0 seconds before it can be detonated
4. **Second ability use** (while bomb is active and armed): Detonates the bomb
5. Explosion deals 50 AoE damage in 100px radius
6. Additionally fires **12 scatter bullets** in a 30° arc in the detonation direction
7. Only one active bomb at a time — throwing a new one replaces the old one

**Maximum Damage**: 50 (explosion) + 12 × 8 (scatter bullets) = **146 damage** if everything hits.

## AI Strategy Guidelines

### General Logic
- Nova is a **trap-setter** — place bombs before enemies arrive, detonate when they pass
- No cooldown on ability means bombs can be placed and detonated rapidly
- The 2-second arming time is the key limitation — plan ahead
- Scatter bullets deal additional damage — aim the detonation direction toward enemy clusters

### Positioning
- Position at **200-300px** from expected combat zones — Nova doesn't need to be in the fight
- Stay behind frontline heroes while managing bomb placement
- Use asteroids to bounce bombs into difficult-to-reach positions

### Ability Usage
- **Pre-place bombs at chokepoints** before enemies arrive
- Bounce bombs off asteroids to reach behind enemy lines
- Detonate when enemies cluster near the bomb
- Aim the detonation direction to send scatter bullets through the enemy formation
- If the bomb isn't in a useful position, throw a new one (replaces the old)
- Use rapid throw-detonate cycles in direct combat (throw → wait 2s → detonate)

### Threat Assessment
- **Strong against**: Predictable enemy pushes (pre-placed bombs), clustered formations (AoE + scatter)
- **Weak against**: Spread formations (bomb only hits one area), fast enemies that avoid the bomb zone
- **Countered by**: Tank crescent wave (erases the bomb), mobile heroes that dodge detonation

### Synergies
- **Nova + Chrono**: Freeze zone holds enemies in bomb blast radius
- **Nova + Grave**: Black Hole pulls enemies toward a pre-placed bomb
- **Nova + Sly**: Overlapping trap fields covering different angles
