# Beam — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Sniper · **Source:** `src/heroes/beam.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 70 |
| Attack Damage | 20 |
| Attack Speed | 1.0 attacks/sec |
| Attack Range | 150 px |
| Defense | 6 |
| Regen | 3 HP/sec |
| Ignores Defense | Yes |
| Ability Cooldown | 8.0 sec |

## Normal Attack

Standard ranged attack at 1 attack per second. Low fire rate but **ignores defense**, making Beam effective against heavily armored targets like Tank.

## Ability — Precision Shot

Fires a **long-range beam** that deals **more damage at greater distances**. The beam is a projectile marked as `isBeamProjectile` with special distance-based damage calculation.

| Parameter | Value |
|-----------|-------|
| Base Damage | 30 |
| Max Range | 600 px |
| Damage per Distance | +0.1 per px |
| Effect Radius | 40 px |
| Force Strength | 300 |

**Behavior**: The beam projectile travels up to 600px. Damage scales with distance from Beam to the hit point: at maximum range (600px), the ability deals `30 + (600 × 0.1) = 90 damage`. The beam also applies a **force effect** on hit, pushing targets along and perpendicular to the beam direction (70% along, 30% perpendicular).

**Damage at Key Ranges**:
- 100px: 40 damage
- 300px: 60 damage
- 600px: 90 damage

## AI Strategy Guidelines

### General Logic
- Beam is a **glass cannon sniper** — maximize range, minimize exposure
- Position at the absolute edge of engagements
- Precision Shot should always target the furthest viable enemy for maximum damage

### Positioning
- Stay at **400-600px** from enemies whenever possible to maximize Precision Shot damage
- Position behind all other heroes — Beam should never be the closest unit to the enemy
- Use asteroids and allies as cover; Beam's 70 HP makes it the most fragile Radiant hero

### Ability Usage
- **Always fire Precision Shot at maximum range** for the highest damage output
- Target **high-value, low-mobility heroes**: Mortar (in setup), Preist (low speed), Chrono
- Since Beam **ignores defense**, prioritize Tank and other high-defense targets
- Use the knockback force to push enemies out of defensive positions

### Threat Assessment
- **Strong against**: Tank (ignores 50 defense), Preist (stationary healer), Mortar (siege mode), any distant target
- **Weak against**: Dagger (cloak closes distance), Dash (invulnerable gap-close), Blink (teleport engage)
- **Countered by**: Any hero that can quickly close the distance gap

### Synergies
- **Beam + Spotlight**: Spotlight reveals targets at range for Beam to snipe
- **Beam + Tank**: Tank frontlines while Beam deals damage from maximum range
- **Beam + Chrono**: Freeze zones prevent enemies from closing distance on Beam
