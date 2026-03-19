# Blink — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Teleporter / Disruptor · **Source:** `src/heroes/blink.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 400 px (ability range) |
| Defense | 8 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 6.0 sec |

## Normal Attack

**No normal attack.** Blink relies entirely on its teleport + shockwave ability.

## Ability — Blink Shockwave

Teleports to target location and releases an area stun pulse.

| Parameter | Value |
|-----------|-------|
| Distance Multiplier | 1.5× arrow length |
| Min Distance | 80 px |
| Max Distance | 400 px |
| Shockwave Damage | 20 |
| Stun Duration | 1.0 sec |
| Shockwave Visual Duration | 0.4 sec |
| Shockwave Hit Window | 0.05 sec |

**Shockwave Radius Scaling** (inversely proportional to blink distance):

| Blink Distance | Shockwave Radius |
|---------------|-----------------|
| 80 px (min) | 180 px (max) |
| 240 px (mid) | 120 px |
| 400 px (max) | 60 px (min) |

**Behavior**:
1. Teleports **instantly** to the calculated destination (no travel time)
2. Creates a shockwave at the arrival point
3. **Shorter blinks produce larger shockwaves** — this is the key mechanic
4. Shockwave stuns all enemies within radius for 1.0 seconds and deals 20 damage
5. Tracks affected units to prevent double-stunning
6. Hit window is very short (0.05s) — shockwave is instantaneous

## AI Strategy Guidelines

### General Logic
- Blink is a **disruptor** — the stun is more valuable than the damage
- **Shorter blinks = bigger stuns** — counterintuitive but critical
- Use Blink to initiate fights, not to chase
- 6-second cooldown is moderate — time blinks carefully

### Positioning
- Position **near enemy formations** (100-200px away) for maximum shockwave radius
- Being close means short blinks = large AoE stuns
- After blinking, position defensively for the 6-second cooldown

### Ability Usage
- **Blink short distances into enemy clusters** for maximum stun radius (up to 180px AoE)
- Use to **interrupt enemy abilities** — 1-second stun cancels channeling (Spotlight cone, Mortar setup)
- Blink behind enemy lines to stun backline heroes (Preist, Beam, Mortar)
- **Do not blink at max range** unless chasing — the 60px stun radius is nearly useless
- Coordinate with allied burst damage: stun → allies kill stunned targets

### Threat Assessment
- **Strong against**: Clustered enemies (large AoE stun), channeling heroes (interrupts), backline heroes
- **Weak against**: Spread-out formations (stun misses), high-HP targets (20 damage is minimal)
- **Countered by**: Pre-emptive positioning that avoids clusters, Tank (absorbs stun and damage)

### Synergies
- **Blink + Dash**: Double-dive with stun into slash combo
- **Blink + Marine**: Stun into Bullet Storm for devastating burst
- **Blink + Mortar**: Stun holds enemies in Mortar splash zone
