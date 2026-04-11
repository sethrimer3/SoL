# Chrono — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Area Freeze Controller · **Source:** `src/heroes/chrono.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 0 (freeze only) |
| Attack Speed | 1.0 attacks/sec |
| Attack Range | 400 px |
| Defense | 10 |
| Regen | 3 HP/sec |
| Ignores Defense | Yes |
| Ability Cooldown | Dynamic (see below) |

## Normal Attack — Freeze

Chrono's attack does **not deal damage**. Instead, it applies a **freeze/stun effect** to the target.

| Parameter | Value |
|-----------|-------|
| Freeze Duration | 1.0 sec |
| Attack Range | 400 px |
| Fire Rate | 1.0 attack/sec |

**Behavior**: Each attack freezes the target for 1.0 second. Against a single target, this creates a **perma-freeze loop** at 400px range (1s freeze, 1s between attacks). Chrono cannot kill anything alone but prevents enemies from acting.

## Ability — Temporal Freeze Field

Projects a **circular freeze zone** that repeatedly freezes all enemies inside.

| Parameter | Value |
|-----------|-------|
| Min Radius | 50 px |
| Max Radius | 300 px |
| Radius Multiplier | 2.0× arrow length |
| Freeze Circle Duration | 3.0 sec |
| Base Cooldown | 5.0 sec |
| Cooldown per Radius | +0.02 sec per px above min radius |

**Dynamic Cooldown Scaling**:
- **Minimum radius (50px)**: 5.0 sec cooldown
- **Mid radius (175px)**: 5.0 × (1 + (175-50) × 0.02) = 5.0 × 3.5 = **17.5 sec**
- **Maximum radius (300px)**: 5.0 × (1 + (300-50) × 0.02) = 5.0 × 6.0 = **30.0 sec**

**Behavior**:
1. Radius scales with arrow draw length (50-300px range)
2. Freeze zone appears at the aimed position
3. All enemies inside the zone are **repeatedly frozen** for 3 seconds
4. **Larger zones have much longer cooldowns** — risk/reward tradeoff
5. Small zones have very short cooldowns (5 seconds) for frequent use

## AI Strategy Guidelines

### General Logic
- Chrono is the **ultimate crowd control hero** — zero damage but unmatched control
- Normal attack perma-freezes a single target; ability freezes an entire area
- Chrono **requires allies for kills** — it locks enemies down, allies finish them
- Dynamic cooldown means choosing between frequent small freezes and rare massive ones

### Positioning
- Position at **maximum range** (350-400px) from enemies
- Chrono is fragile (100 HP) and deals no damage — stay far back
- Maintain line of sight to key enemies for normal attack freeze

### Ability Usage
- **Use small radius (50-100px) for frequent freeze zones** (5-7 sec cooldown) on key targets
- **Use maximum radius (300px) only for fight-winning moments** (30-second cooldown!)
- Place freeze zones at **chokepoints** where enemies must pass through
- Layer freeze zone with allied AoE (Mortar splash, Radiant Hero lasers, Nova bombs)
- Freeze zones near enemy mirrors allow allies to destroy them uncontested

### Threat Assessment
- **Strong against**: Melee heroes (frozen before reaching Chrono), slow pushes, grouped formations
- **Weak against**: Fast heroes that close distance (Dash invulnerable through freeze), long-range heroes outside freeze range
- **Countered by**: Blink (teleports past freeze zones), heroes with stun immunity, split pushes

### Synergies
- **Chrono + Grave**: Freeze holds enemies in particle splash zone and Black Hole
- **Chrono + Nova**: Freeze holds enemies in bomb blast radius
- **Chrono + Ray**: Frozen enemies grouped for maximum ricochet bounces
- **Chrono + Radiant Hero**: Freeze enemies inside laser field for devastating damage
