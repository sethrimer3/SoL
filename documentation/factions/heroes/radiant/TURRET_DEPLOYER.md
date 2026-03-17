# Turret Deployer — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Zone Control · **Source:** `src/heroes/turret-deployer.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 90 |
| Attack Damage | 6 |
| Attack Speed | 2.0 attacks/sec |
| Attack Range | 180 px |
| Defense | 14 |
| Regen | 4 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 12.0 sec |

## Normal Attack

Standard ranged attack at 2 attacks per second. Low damage (12 DPS) but consistent. Turret Deployer's value comes from deployed turrets, not personal damage.

## Ability — Deploy Turret

Places an **automated turret** on a nearby asteroid or in open space.

| Deployed Turret Stat | Value |
|---------------------|-------|
| Health | 150 HP |
| Attack Range | 300 px |
| Attack Damage | 12 |
| Attack Speed | 2 attacks/sec |
| Projectile Speed | 400 px/sec |
| Health Bar Size | 40 px |

**Behavior**: Deployed turrets:
1. **Attach to asteroids** when placed near one, or float independently
2. **Automatically target** and fire at the nearest enemy within 300px range
3. **Inherit the deployer's owner** for team allegiance
4. **Persist until destroyed** — not time-limited
5. Have animated firing visuals (28-frame animation at 0.1s per frame)

**Turret DPS**: Each turret deals 24 damage/sec — more than the deployer itself. Multiple turrets create overlapping fields of fire.

## AI Strategy Guidelines

### General Logic
- Turret Deployer's value **scales with game length** — each turret placed is permanent DPS
- Prioritize deploying turrets at **strategic asteroid positions** controlling chokepoints
- The deployer itself is fragile; turrets are the primary damage source

### Positioning
- Stay near **asteroids** to maximize turret placement options
- After deploying, move to the next asteroid — the deployer is a mobile factory
- Keep the deployer behind turret lines for protection

### Ability Usage
- **Deploy turrets at chokepoints** and along enemy approach routes
- Place turrets on asteroids near the enemy's mirror positions to threaten their economy
- Space turrets 200-300px apart for overlapping fields of fire without redundant coverage
- Deploy on cooldown whenever near an unfortified asteroid

### Threat Assessment
- **Strong against**: Predictable pushes through turret zones, Starling swarms, slow enemies
- **Weak against**: Driller (tunnels past turrets), Blink (teleports past), long-range siegers (Mortar, Beam)
- **Countered by**: Heroes that bypass turret coverage or outrange turrets

### Synergies
- **Turret Deployer + Mortar**: Turrets handle close-range while Mortar covers long-range
- **Turret Deployer + Chrono**: Freeze zones slow enemies in turret kill zones
- **Turret Deployer + Spotlight**: Spotlight reveals enemies for turrets to target
