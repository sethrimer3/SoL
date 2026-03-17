# Marine — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Rapid-fire DPS · **Source:** `src/heroes/marine.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 10 |
| Attack Speed | 5.0 attacks/sec |
| Attack Range | 300 px |
| Defense | 10 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 5.0 sec |

## Normal Attack

Standard ranged attack at **5 attacks per second** — the highest sustained fire rate among Radiant heroes. Each shot produces visual effects (muzzle flash, bullet casing, ricocheting bullet). Marine is the primary sustained-DPS hero for Radiant.

## Ability — Bullet Storm

Fires a **spread of 15 bullets** in a cone toward the target direction.

| Parameter | Value |
|-----------|-------|
| Bullet Count | 15 |
| Spread Angle | 10° |
| Bullet Speed | 500 px/sec |
| Bullet Damage | 5 per bullet |
| Bullet Lifetime | 1.0 sec |

**Behavior**: On activation, Marine fires all 15 bullets simultaneously in a cone pattern. At close range, most bullets hit a single target for up to **75 total damage**. At longer ranges, the spread disperses bullets across a wider area, hitting multiple targets for lower individual damage.

## AI Strategy Guidelines

### General Logic
- Marine is the **bread-and-butter DPS** hero — always produce early
- Prioritize targets within 300px attack range for maximum uptime
- Marine's strength is sustained damage, not burst; keep Marine firing continuously

### Positioning
- Maintain **200-250px** distance from enemies to stay within attack range while avoiding melee threats
- Stay behind Tank or other frontline heroes when available
- Avoid isolated positions — Marine is fragile at 100 HP

### Ability Usage
- **Bullet Storm** is most effective at **close-to-mid range** (100-200px) where the cone concentrates
- Use against **clustered enemies** (3+ units) for maximum multi-target damage
- Use defensively against charging melee heroes to burst them down before they close
- Save cooldown when no high-value targets are available

### Threat Assessment
- **Strong against**: Low-health heroes (Dagger, Sly), groups of Starlings, stationary targets
- **Weak against**: Tank (high defense absorbs damage), Chrono (freeze stops DPS), Blink (teleports past damage)
- **Countered by**: Dagger cloak assassination, Shadow escalating beam, Dash invulnerable charge

### Synergies
- **Marine + Spotlight**: Spotlight reveals cloaked enemies for Marine to focus fire
- **Marine + Mothership**: Combined fire rate overwhelms single targets
- **Marine + Preist**: Healing sustains Marine through trades
