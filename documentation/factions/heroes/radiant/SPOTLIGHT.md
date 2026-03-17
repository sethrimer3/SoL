# Spotlight — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Recon / Burst DPS · **Source:** `src/heroes/spotlight.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 95 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | 8 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 12.0 sec |

## Normal Attack

**No normal attack.** Spotlight relies entirely on its ability cone for damage output. Between ability activations, Spotlight contributes zero DPS.

## Ability — Spotlight Sweep

Creates a **narrow 5° cone** that reveals enemies and **rapidly fires** at any target within.

| Parameter | Value |
|-----------|-------|
| Cone Angle | 5° |
| Setup Time | 1.0 sec |
| Active Time | 4.0 sec |
| Teardown Time | 5.0 sec |
| Fire Rate | 8 shots/sec |
| Bullet Speed | 600 px/sec |
| Bullet Damage | 4 per shot |
| Bullet Lifetime | 1.2 sec |
| Bullet Hit Radius | 6 px |

**State Machine**:
1. **Inactive** → ability activates
2. **Setup** (1.0s) → cone expands to full angle
3. **Active** (4.0s) → fires at enemies within cone at 8 shots/sec
4. **Teardown** (5.0s) → cone retracts, returns to inactive

**DPS Calculation**: During the 4-second active phase, Spotlight fires 32 shots at 4 damage each = **128 potential damage** if all shots hit a single target. Against grouped enemies, damage is distributed.

## AI Strategy Guidelines

### General Logic
- Spotlight is a **feast-or-famine** hero — devastating when cone is active, useless when inactive
- **12-second cooldown** with only 4 seconds of active time means 25% uptime at best
- Must be aimed precisely due to the extremely narrow 5° cone

### Positioning
- Position where the cone can cover a **chokepoint or approach route**
- Stay at mid-range (200-400px) — far enough for safety, close enough for cone targets to be in bullet range
- Reposition during the 5-second teardown to prepare for next cone activation

### Ability Usage
- **Aim the cone toward the highest-density enemy cluster**
- Activate early when enemies are approaching — the 1-second setup means enemies can move out of the cone
- The cone reveals cloaked enemies (Dagger) — use proactively when Dagger is suspected
- Use to scout fog-of-war areas for hidden enemy positions

### Threat Assessment
- **Strong against**: Dagger (reveals cloak), clustered Starlings, enemies approaching through corridors
- **Weak against**: Mobile heroes that dodge the narrow cone (Dash, Blink), any hero during Spotlight's downtime
- **Countered by**: Rushing Spotlight during teardown phase; flanking from outside the cone angle

### Synergies
- **Spotlight + Beam**: Spotlight reveals, Beam snipes the revealed targets
- **Spotlight + Marine**: Combined firepower during active phase is overwhelming
- **Spotlight + Mortar**: Spotlight reveals targets for Mortar's splash damage
