# Preist — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Healer / Support · **Source:** `src/heroes/preist.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 110 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 350 px (healing range) |
| Defense | 18 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 10.0 sec |

## Normal Attack

**No normal attack.** Preist cannot deal damage. Instead, it has **dual healing beams** that automatically target injured allies.

### Passive — Dual Healing Beams

| Parameter | Value |
|-----------|-------|
| Healing Range | 350 px |
| Healing Rate | 2% max HP per second |
| Beam Count | 2 |
| Target Lock Duration | 0.5 sec |

**Beam Targeting Priority**:
1. Heroes (over Starlings)
2. Most damaged unit (lowest HP percentage)
3. Skips fully-healed units
4. Skips units out of 350px range

**Behavior**: Each beam locks onto a target for 0.5 seconds, continuously healing at 2% max HP/sec. After the lock expires, the beam selects a new target. Two beams can heal two different allies simultaneously.

## Ability — Healing Bomb

Launches a projectile that explodes into healing particles on impact.

| Parameter | Value |
|-----------|-------|
| Bomb Speed | 400 px/sec |
| Max Range | 500 px |
| Explosion Radius | 120 px |
| Particle Count | 50 |
| Particle Healing | 1% max HP per particle |
| Particle Speed | 200 px/sec |
| Particle Lifetime | 0.5 sec |

**Behavior**: The bomb travels to the target location and explodes, releasing 50 particles in all directions. Each particle heals 1% max HP on contact. Each particle can only heal each unit **once** (tracked per-unit). Maximum healing per unit from a single bomb: **50% max HP** (if all 50 particles hit).

## AI Strategy Guidelines

### General Logic
- Preist is the **only dedicated healer** across all factions — extremely high value
- **Protect Preist at all costs** — losing the healer cripples sustained engagements
- Position behind frontline heroes for continuous healing output
- High defense (18) provides good personal survivability

### Positioning
- Stay **200-300px behind frontline** heroes within healing range (350px)
- Never be the closest hero to the enemy — Preist deals zero damage
- Position centrally to maximize the number of allies within healing range

### Ability Usage
- **Fire Healing Bomb into clustered allied heroes** who are taking damage
- 120px explosion radius should cover 2-3 allies for maximum efficiency
- Save for moments of burst enemy damage rather than using on cooldown
- Pre-fire toward where your push will engage the enemy
- 10-second cooldown is long — timing matters

### Threat Assessment
- **Strong against**: Attrition strategies (heals through sustained damage), push compositions
- **Weak against**: Burst damage that kills allies faster than beams can heal, Dagger assassination
- **Countered by**: Focus fire on Preist (0 DPS means it can't fight back), Chrono freeze (stops healing)

### Synergies
- **Preist + Tank**: Tank absorbs damage while Preist heals — nearly unkillable deathball
- **Preist + Splendor**: Healing sustains Splendor's mid-range DPS presence
- **Preist + Marine**: Healing compensates for Marine's low HP, extending DPS uptime
