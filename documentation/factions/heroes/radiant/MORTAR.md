# Mortar — Radiant Hero Unit

> **Faction:** Radiant · **Role:** Siege Artillery · **Source:** `src/heroes/mortar.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 120 |
| Attack Damage | 40 |
| Attack Speed | 0.5 attacks/sec |
| Attack Range | 450 px |
| Defense | 14 |
| Regen | 2 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 0 (no cooldown) |

## Normal Attack

Fires **splash-damage projectiles** at enemies. Each shot deals 40 damage at the impact point with splash damage in an 80px radius that falls off linearly (50% at edge). Mortar has the **highest per-shot damage** among Radiant heroes.

| Attack Parameter | Value |
|-----------------|-------|
| Splash Radius | 80 px |
| Splash Falloff | 50% (linear) |
| Projectile Speed | 300 px/sec |
| Detection Cone | 150° |

## Ability — Siege Mode

Mortar must be **set up facing a direction** before it can attack. While set up, Mortar is **stationary** but gains its full attack capability. Mortar has **no cooldown** on setup/teardown, but must be repositioned manually.

**Behavior**: The Mortar can only detect and attack enemies within a **150° cone** in the direction it was set up facing. Enemies outside this cone are invisible to the Mortar. Setup is required — without it, Mortar does nothing.

## AI Strategy Guidelines

### General Logic
- Mortar is the **siege weapon** of Radiant — highest per-shot damage and longest range (450px)
- Must be set up to function; without setup, Mortar is a 120 HP paperweight
- The 150° detection cone means facing direction is critical

### Positioning
- Position Mortar at **350-450px** from expected enemy approach routes
- Set up facing the **most likely attack direction** or enemy base
- Place behind frontline heroes — Mortar is slow to reposition
- Use asteroid cover to protect flanks outside the detection cone

### Ability Usage
- **Set up immediately upon spawning** facing the enemy base direction
- Reposition only when the frontline has shifted significantly
- The 150° cone is wide enough to cover most approaches from one direction
- Time repositioning during lulls in combat — Mortar is vulnerable while moving

### Threat Assessment
- **Strong against**: Buildings (high damage per shot), grouped units (splash), slow targets, enemy base pushes
- **Weak against**: Fast-closing heroes (Dash, Blink, Dagger) that enter inside minimum effective range
- **Countered by**: Flanking from behind (outside 150° cone), Driller tunneling past defenses

### Synergies
- **Mortar + Tank**: Tank protects Mortar from approaching threats while Mortar shells enemies at range
- **Mortar + Spotlight**: Spotlight reveals targets for Mortar to bombard
- **Mortar + Chrono**: Freeze zones prevent enemies from closing distance on Mortar
