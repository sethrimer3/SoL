# Diplomat (InfluenceBall) — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Zone Controller · **Source:** `src/heroes/influence-ball.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 5 |
| Attack Speed | 1.5 attacks/sec |
| Attack Range | 200 px |
| Defense | 12 |
| Regen | 6 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 15.0 sec |

## Normal Attack

Standard ranged attack at 1.5 attacks per second. Very low DPS (7.5 damage/sec). Diplomat's value is entirely in zone creation, not combat damage.

## Ability — Influence Surge

Fires a projectile that creates a **temporary influence zone** at the target location.

| Parameter | Value |
|-----------|-------|
| Projectile Speed | 300 px/sec |
| Explosion Radius | 150 px |
| Zone Duration | 10.0 sec |
| Effect Radius | 35 px |
| Force Multiplier | 0.5× |

**Behavior**:
1. Fires a projectile toward the aimed direction
2. Projectile **auto-explodes after 5 seconds** or on contact with an enemy
3. Creates an **influence zone** at the explosion point with 150px radius
4. Zone lasts for **10 seconds**, affecting unit behavior/movement within
5. Zone acts as temporary territorial expansion for the owning player

**Strategic Value**: Influence zones expand the player's territory, affecting building placement rules and unit behavior. A well-placed zone can block enemy expansion or enable forward building placement.

## AI Strategy Guidelines

### General Logic
- Diplomat is a **territorial control** hero with the highest regen (6 HP/sec) among all heroes
- Influence zones expand controlled territory — critical for forward building placement
- 15-second cooldown is the **longest in the game** — each zone placement must count
- Very low combat effectiveness — keep Diplomat away from direct fights

### Positioning
- Position **behind frontline** at 200-350px from combat
- Stay near contested territory boundaries where zones have the most impact
- High regen (6 HP/sec) allows sustained presence even when taking some damage

### Ability Usage
- **Place influence zones at territory boundaries** to expand controlled area
- Use zones to **enable forward building placement** (Minigun, SpaceDustSwirler)
- Block enemy expansion by placing zones in strategic corridor positions
- Time zone placement to support pushes — 10-second duration must cover the advance
- Place zones near enemy mirrors to contest their territory

### Threat Assessment
- **Strong against**: Defensive strategies (zones break turtle positions), territory-dependent play
- **Weak against**: Aggressive rushers (zones don't stop direct combat), high-DPS heroes
- **Countered by**: Any hero that can kill Diplomat before zone is placed (very low DPS to fight back)

### Synergies
- **Diplomat + Turret Deployer**: Zone enables forward turret placement on enemy-side asteroids
- **Diplomat + Chrono**: Freeze zones protect the influence zone from being overrun
- **Diplomat + Grave**: Gravity effects keep enemies out of influence zones
