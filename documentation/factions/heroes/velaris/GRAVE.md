# Grave — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Gravitic Sentinel · **Source:** `src/heroes/grave.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 150 |
| Attack Damage | 15 |
| Attack Speed | 2.0 attacks/sec |
| Attack Range | 100 px (hero multiplier: 0.25× of 400) |
| Defense | 18 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | — |

## Normal Attack — Orbiting Projectiles

Grave does not have a standard ranged attack. Instead, it maintains **6 orbiting projectiles** in a polygon formation that **launch at enemies** when they enter range.

| Projectile Parameter | Value |
|---------------------|-------|
| Projectile Count | 6 |
| Orbit Radius | 18 px |
| Launch Speed | 400 px/sec |
| Min Speed | 80 px/sec |
| Attraction Force | 300 |
| Hit Distance | 10 px |
| Trail Length | 15 |

**Behavior**: Projectiles orbit Grave in a polygon shape. When an enemy enters range, projectiles launch toward them at 400 px/sec. After hitting or timing out, projectiles return to orbit. This creates a rhythmic attack pattern.

### Passive — Small Particles

| Parameter | Value |
|-----------|-------|
| Max Particles | 30 |
| Regen Rate | 1 per second |
| Particles per Attack | 5 |
| Particle Speed | 120 px/sec |
| Particle Size | 2 px |
| Particle Damage | 5 |
| Splash Radius | 30 px |
| Splash Falloff | 50% |
| Attraction Force | 200 |
| Drag | 0.95× |

Small particles spawn continuously (1/sec, max 30) and are attracted to Grave by gravity. When attacking, Grave also releases 5 small particles that deal splash damage on hit.

## Ability — Black Hole

Launches a **gravitational vortex** that attracts all small particles for its duration.

| Parameter | Value |
|-----------|-------|
| Duration | 5.0 sec |
| Size | 15 px |
| Speed | 300 px/sec |
| Effect Radius | 20 px |
| Force Multiplier | 0.4× |

**Behavior**: The Black Hole travels in the aimed direction at 300 px/sec and lasts 5 seconds. During its lifetime, it attracts all nearby small particles toward it, pulling them away from their normal gravity toward Grave. Particles caught in the vortex deal splash damage to enemies near the Black Hole's position.

## AI Strategy Guidelines

### General Logic
- Grave is a **unique, high-survivability zone controller** (150 HP, 18 defense)
- Orbiting projectiles create a **danger zone** around Grave — enemies within range get hit automatically
- Small particle swarm grows over time — Grave gets stronger the longer it stays alive
- Black Hole redirects the particle swarm for targeted area damage

### Positioning
- Position **aggressively at medium range** (80-150px from enemies)
- Grave's orbiting projectiles need enemies to be close to launch
- High durability (150 HP, 18 defense) allows frontline presence
- Keep Grave alive to build up the small particle count

### Ability Usage
- **Launch Black Hole into enemy clusters** to pull particles toward them
- Time Black Hole when particle count is high (20-30) for maximum damage
- Use Black Hole to pull particles toward enemy mirrors or structures
- Black Hole at chokepoints creates a damaging gravitational trap
- 5-second duration means positioning the vortex path through enemy formations

### Threat Assessment
- **Strong against**: Melee heroes that enter orbit range, clustered formations (particle splash), sustained fights
- **Weak against**: Long-range heroes (Beam, Mortar) that stay outside orbiting range, burst that kills Grave before particles build
- **Countered by**: Focus fire to kill Grave early before particles accumulate, kiting at long range

### Synergies
- **Grave + Chrono**: Freeze zones hold enemies in Grave's orbit range and particle splash zone
- **Grave + Dagger**: Dagger assassinates fleeing enemies; Grave handles grouped ones
- **Grave + Shadow**: Shadow beam escalates on targets trapped by Black Hole
