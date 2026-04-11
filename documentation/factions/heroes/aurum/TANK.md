# Tank — Aurum Hero Unit

> **Faction:** Aurum · **Role:** Frontline Defender · **Source:** `src/heroes/tank.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 300 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | 50 (50% damage reduction) |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 12.0 sec |
| Collision Radius | 20 px |

## Normal Attack

**No normal attack.** Tank cannot deal damage through auto-attacks. Its value is entirely in damage absorption and crowd control via its ability.

## Passive — Projectile Shield

| Parameter | Value |
|-----------|-------|
| Shield Radius | 60 px |

Tank has a **passive shield** that blocks projectiles within a 60px radius. Combined with 300 HP and 50 defense (50% damage reduction), Tank has an effective HP pool of **600** against non-defense-piercing attacks.

## Ability — Crescent Wave

Sends a **slow 90° arc wave** that stuns all units and erases projectiles.

| Parameter | Value |
|-----------|-------|
| Wave Angle | 90° (π/2 radians) |
| Wave Range | 400 px |
| Wave Speed | 150 px/sec |
| Wave Width | 40 px |
| Stun Duration | 2.0 sec |

**Behavior**:
1. Fires a 90° crescent-shaped wave in the aimed direction
2. Wave travels outward at 150 px/sec (reaches max range in ~2.7 seconds)
3. **Erases all projectiles** within the wave's area as it sweeps
4. **Stuns all enemy units** caught in the wave for 2.0 seconds
5. Tracks affected units to prevent double-stunning
6. Wave affects both units and structures

## AI Strategy Guidelines

### General Logic
- Tank is the **anchor** of any Aurum composition — position it in front of everything
- With 600 effective HP, Tank can absorb enormous punishment
- Crescent Wave's 2-second stun is fight-changing — time it carefully
- Tank deals zero damage — pair with DPS heroes

### Positioning
- Always at the **front of any formation** — Tank's job is to absorb
- Shield radius (60px) protects nearby allies from projectiles
- Position between the enemy and fragile heroes (Beam, Preist, Splendor)
- Use Tank to block chokepoints — 20px collision radius + shield creates a wall

### Ability Usage
- **Fire Crescent Wave into clustered enemies** (3+ units) for maximum stun value
- Use to **clear incoming projectile barrages** from Mortar, Marine, or Mothership minis
- Time the wave to interrupt enemy ability casts or charges
- **Do not waste on single isolated targets** — 12-second cooldown is significant
- Use defensively to peel assassins (Dagger, Dash) off backline heroes

### Threat Assessment
- **Strong against**: Projectile-heavy heroes (Marine, Mothership), grouped enemies, melee attackers
- **Weak against**: Beam (ignores 50 defense), Ray (ignores defense), sustained DPS that outpaces regen
- **Countered by**: Defense-piercing attacks, kiting at range (Tank can't close), focus fire from multiple angles

### Synergies
- **Tank + Preist**: The core deathball — Preist heals Tank's massive HP pool indefinitely
- **Tank + Splendor**: Tank absorbs, Splendor's defense-piercing laser fires from behind
- **Tank + Marine**: Tank protects fragile Marine while Marine provides the DPS Tank lacks
