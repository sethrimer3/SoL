# Shadow — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Beam Duelist / Deception · **Source:** `src/heroes/shadow.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 15 |
| Attack Speed | 10.0 attacks/sec (beam) |
| Attack Range | 200 px |
| Defense | 6 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 8.0 sec |
| Collision Radius | 15 px |

## Normal Attack — Sustained Beam

Shadow fires a **constant beam** that deals increasing damage the longer it is sustained on the same target.

| Parameter | Value |
|-----------|-------|
| Base Damage | 15 per tick |
| Attack Speed | 10 ticks/sec |
| Multiplier Growth | +0.8× per second |
| Max Multiplier | 5.0× |
| Attack Range | 200 px |

**Damage Scaling**:
- **0 seconds**: 15 × 1.0× = 150 DPS
- **1 second**: 15 × 1.8× = 270 DPS
- **2 seconds**: 15 × 2.6× = 390 DPS
- **5 seconds**: 15 × 5.0× = 750 DPS (max)

**Behavior**: Shadow's beam multiplier increases by 0.8× per second of continuous fire on the **same target**. If Shadow switches targets, the multiplier **resets to 1.0×**. At maximum multiplier (5.0×), Shadow deals the highest sustained DPS in the entire game.

## Ability — Decoy Projection

Spawns a **decoy copy** of Shadow that distracts enemies.

| Parameter | Value |
|-----------|-------|
| Decoy Health | 300 HP (3.0× Shadow's max) |
| Decoy Speed | 2.5× normal speed |
| Decoy Max Speed | 400 px/sec |
| Decoy Collision Radius | 15 px |
| Hit Opacity | 0.75 (flashes when hit) |
| Fade Speed | 1.0/sec |
| Particle Count on Despawn | 30 |
| Particle Speed | 200 px/sec |
| Particle Lifetime | 1.5 sec |
| Particle Size | 3 px |

**Behavior**:
1. Decoy spawns at Shadow's position and moves in the aimed direction
2. Decoy has **300 HP** — very durable for a distraction
3. Decoy **draws enemy fire** — enemies target it as if it were real
4. Decoy becomes translucent (75% opacity) when hit, then fades back
5. When destroyed, decoy emits 30 particles as a visual effect
6. Decoy does not attack — it is purely a damage sponge

## AI Strategy Guidelines

### General Logic
- Shadow is a **duel specialist** — wins any 1v1 if it can sustain fire long enough
- The escalating beam turns Shadow into the highest-DPS hero in the game over time
- **Never switch targets voluntarily** — the multiplier reset is devastating
- Decoy buys time for the beam to ramp up

### Positioning
- Position at **150-200px** from the intended target
- Find a spot where Shadow can maintain line of sight to one target continuously
- Stay where the beam can fire uninterrupted for 3+ seconds

### Ability Usage
- **Deploy decoy before engaging** — let it absorb initial enemy focus fire
- Aim decoy **toward the enemy** so it draws attention away from Shadow
- 300 HP decoy absorbs significant damage while Shadow's beam ramps up
- Decoy is also useful for scouting — send it ahead to reveal enemy positions
- 8-second cooldown means one decoy per engagement typically

### Threat Assessment
- **Strong against**: Single targets (escalating beam destroys any hero), slow enemies that can't break line of sight
- **Weak against**: Multiple enemies (can only ramp on one target), Chrono freeze (resets beam time)
- **Countered by**: Dash/Blink (force target switch), AoE that ignores decoy, Chrono perma-freeze

### Synergies
- **Shadow + Chrono**: Freeze holds the target while beam escalates to maximum multiplier
- **Shadow + Dagger**: Dagger assassinates one hero while Shadow duels another
- **Shadow + Tank**: Tank absorbs attention while Shadow beams from behind
