# Ray — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Bouncing Beam DPS · **Source:** `src/heroes/ray.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 120 |
| Attack Damage | 8 |
| Attack Speed | 3.0 attacks/sec |
| Attack Range | 250 px |
| Defense | 8 |
| Regen | 5 HP/sec |
| Ignores Defense | Yes |
| Ability Cooldown | 8.0 sec |

## Normal Attack

Standard ranged attack at 3 attacks per second. **Ignores defense**, making Ray effective against high-armor targets. Sustained DPS of 24 damage/sec (defense-ignoring).

## Ability — Solar Ricochet

Fires a **bouncing beam** that ricochets between multiple enemies.

| Parameter | Value |
|-----------|-------|
| Beam Damage | 25 per bounce |
| Max Bounces | 5 |
| Beam Width | 3 px |

**Behavior**: The beam fires in the aimed direction and bounces between enemies up to 5 times. Each bounce deals 25 damage to the target hit. The beam creates visible beam segments that track the bounce path. Maximum potential ability damage: **125** (5 bounces × 25 damage).

**Bounce Mechanics**: The beam is calculated by the game state — the hero stores the aim direction, and the game computes bounce paths. Bounces require valid enemy targets within range to continue the chain.

## AI Strategy Guidelines

### General Logic
- Ray is a **versatile, defense-piercing DPS** hero with good survivability (120 HP, 5 regen)
- Normal attacks ignore defense — excellent against Tank and other armored units
- Solar Ricochet excels against **clustered enemies** where bounces chain effectively

### Positioning
- Position at **180-250px** from enemy formations for attack range coverage
- Ray is moderately durable (120 HP, 8 defense, 5 regen) — can be mid-line
- Position where Solar Ricochet can bounce through the most enemies

### Ability Usage
- **Fire Solar Ricochet into the densest enemy cluster** for maximum bounce chains
- Aim at the edge enemy in a formation so the beam bounces through the entire group
- 5 bounces × 25 damage = 125 total — most effective against 3+ grouped enemies
- Against isolated targets, the beam may only bounce once or twice — save for clusters

### Threat Assessment
- **Strong against**: Tank (ignores 50 defense), grouped Starlings (ricochet chains), armored formations
- **Weak against**: Spread-out enemy formations (ricochet can't chain), Dagger (cloaked/isolated)
- **Countered by**: Enemies that stay separated, burst damage that exceeds Ray's sustain

### Synergies
- **Ray + Chrono**: Frozen enemies cluster perfectly for maximum ricochet bounces
- **Ray + Grave**: Black Hole pulls enemies together for devastating ricochet chains
- **Ray + Marine**: Combined sustained DPS with different damage types (regular + defense-piercing)
