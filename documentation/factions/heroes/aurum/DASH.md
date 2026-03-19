# Dash — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Burst Skirmisher · **Source:** `src/heroes/dash.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 110 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 500 px (ability range) |
| Defense | 10 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 3.0 sec |

## Normal Attack

**No normal attack.** Dash relies entirely on its dash ability for all damage and engagement.

## Ability — Dash Slash

Rapidly traverses distance and damages enemies near the destination.

| Parameter | Value |
|-----------|-------|
| Dash Speed | 800 px/sec |
| Distance Multiplier | 1.5× arrow length |
| Min Distance | 100 px |
| Max Distance | 500 px |
| Slash Radius | 30 px |
| Slash Damage | 40 |

**Behavior**:
1. Dash distance scales with arrow draw length (100-500px range)
2. Hero becomes **invulnerable during the dash** — cannot take damage while moving
3. Travels at 800 px/sec (0.125s for min distance, 0.625s for max)
4. Creates a **slash effect** at the destination that deals 40 damage in a 30px AoE
5. Tracks affected units to prevent double-damage
6. Can bounce off asteroids during the dash path

**Key Feature**: 3-second cooldown is the **shortest ability cooldown** among all heroes, allowing frequent repositioning and harassment.

## AI Strategy Guidelines

### General Logic
- Dash is a **hit-and-run assassin** — short cooldown enables constant harassment
- **Invulnerability during dash** makes Dash extremely safe for aggressive plays
- Zero normal attack means Dash must ability-spam to deal any damage
- 3-second cooldown = can dash every 3 seconds for sustained mobility DPS

### Positioning
- Position **aggressively** — Dash's invulnerability means risk is low
- Stay within 500px of targets to ensure ability range coverage
- After slashing, immediately reposition for the next dash in 3 seconds

### Ability Usage
- **Dash into enemy backline** to hit fragile heroes (Preist, Beam, Spotlight)
- Use short dashes (100px) for higher-frequency damage in close fights
- Use long dashes (500px) to close distance on fleeing enemies
- **Dash through enemies** to damage and end up behind them
- Use invulnerability to dodge incoming Mortar shells, Beam shots, or Nova bombs
- Chain dashes every 3 seconds for sustained engagement

### Threat Assessment
- **Strong against**: Fragile backline heroes (Preist, Beam, Spotlight), isolated targets, fleeing enemies
- **Weak against**: Tank (absorbs 40 damage easily), groups that can surround Dash after landing
- **Countered by**: Chrono freeze (stops Dash after landing), Tank crescent wave stun

### Synergies
- **Dash + Blink**: Double-dive the enemy backline from different angles
- **Dash + Driller**: Multi-vector harassment forces enemy to split defenders
- **Dash + Preist**: Healing between dashes sustains Dash through trades
