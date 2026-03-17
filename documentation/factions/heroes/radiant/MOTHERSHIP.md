# Mothership — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Carrier / Swarm · **Source:** `src/heroes/mothership.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 10 |
| Attack Speed | 2.5 attacks/sec |
| Attack Range | 300 px |
| Defense | 12 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 8.0 sec |

## Normal Attack

Standard ranged attack at 2.5 attacks per second with Marine-style visual effects (muzzle flash, bullet casing). Moderate sustained DPS of 25 damage/sec.

## Ability — Escort Wing

Spawns **3 autonomous mini-motherships** in a triangle formation around the Mothership.

| Mini-Mothership Stat | Value |
|---------------------|-------|
| Count | 3 |
| Formation Radius | 50 px |
| Health | 50 HP each |
| Attack Range | 120 px |
| Attack Damage | 5 |
| Attack Speed | 2 attacks/sec |
| Movement Speed | 150 px/sec |
| Lifetime | 12.0 sec |
| Collision Radius | 8 px |
| Explosion Radius | 80 px |
| Explosion Damage | 30 |
| Explosion Falloff | 30% (at edge) |

**Behavior**: Mini-motherships are autonomous units that:
1. **Seek and attack** enemies independently within 120px range
2. **Explode on death** dealing 30 damage in an 80px AoE (with 30% falloff)
3. Have their own **collision detection** and pathfinding
4. **Despawn** after 12 seconds if not destroyed

**Combined DPS**: Mothership (25 DPS) + 3 minis (10 DPS each) = **55 DPS** during ability uptime.

## AI Strategy Guidelines

### General Logic
- Mothership is a **force multiplier** — its minis create additional attack vectors
- Use Escort Wing on cooldown to maintain maximum unit count
- The minis' explosion damage is significant — don't avoid trading them

### Positioning
- Position at **200-300px** from the enemy to keep both Mothership and minis in attack range
- Follow behind frontline heroes — Mothership itself is fragile at 100 HP
- Minis will automatically seek enemies, so Mothership doesn't need to be close

### Ability Usage
- **Activate Escort Wing as soon as enemies are within 200px** — minis need time to engage
- Use before pushing into enemy territory so minis absorb initial fire
- Minis explode on death — send them into enemy clusters for AoE damage
- Don't wait for minis to die before reactivating — spawn fresh ones on cooldown

### Threat Assessment
- **Strong against**: Isolated targets (3v1 with minis), Starling swarms (minis handle them), low-health heroes
- **Weak against**: AoE damage that kills minis quickly (Mortar splash, Nova bomb), Tank (absorbs everything)
- **Countered by**: Chrono freeze (stops minis), Tank crescent wave (stuns all minis at once)

### Synergies
- **Mothership + Marine**: Combined fire saturation overwhelms any single target
- **Mothership + Mortar**: Minis spot targets while Mortar bombards from afar
- **Mothership + Preist**: Healing keeps Mothership alive while minis trade
