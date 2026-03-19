# Occlude — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Shadow Beam Attacker · **Source:** `src/heroes/occlude.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 100 |
| Attack Damage | 18 |
| Attack Speed | 2.5 attacks/sec |
| Attack Range | 350 px |
| Defense | 8 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 12.0 sec |

## Normal Attack — Shadow Beam

Fires **shadow beams** at enemies. Damage is only applied if **both Occlude and the target are in sunlight**.

| Parameter | Value |
|-----------|-------|
| Beam Width | 3 px |
| Beam Lifetime | 0.15 sec |
| Beam Color | `#1a0033` (dark purple) |
| Beam Highlight | `#6600cc` (bright purple) |

**Conditional Damage**: Occlude's attack is **deferred** — the damage check happens after the attack, verifying that both Occlude and the target are in sunlight. If either is in shadow, the attack **deals no damage**. This makes Occlude's positioning relative to light/shadow critically important.

**Effective DPS**: 18 × 2.5 = 45 DPS (when both are in sunlight), 0 DPS (when either is in shadow).

## Ability — Shadow Cone

Projects a **15° cone of shadow** that makes anything inside act as if in natural shadow.

| Parameter | Value |
|-----------|-------|
| Cone Angle | 15° (π/12 radians) |
| Cone Range | 450 px |
| Cone Duration | 8.0 sec |
| Cone Fill Color | `#110022` |
| Cone Edge Color | `#6600cc` |

**Behavior**:
1. Projects a narrow 15° shadow cone in the aimed direction
2. Cone extends 450px from Occlude's position
3. Anything within the cone **acts as if in natural shadow** for 8 seconds
4. Solar mirrors within the cone **stop reflecting sunlight** (cease energy generation)
5. Occlude's own attacks are disabled if the cone covers its own position
6. Shadow cone geometry is checked with angle/distance calculations

**Strategic Value**: Shadow Cone is an **economic weapon**. A well-aimed cone on enemy solar mirrors stops their energy generation for 8 seconds, crippling production. A single cone can cover multiple mirrors in a line.

## AI Strategy Guidelines

### General Logic
- Occlude is a **conditional DPS hero** that doubles as an **economic warfare tool**
- Normal attacks require sunlight for both attacker and target — positioning is everything
- Shadow Cone denies enemy mirror income — the primary strategic use
- 450px cone range exceeds attack range, enabling long-range mirror disruption

### Positioning
- Position **in sunlight** to enable normal attack damage
- Aim to keep enemies in sunlight as well for maximum DPS
- Position with a **clear line to enemy solar mirrors** for Shadow Cone usage
- Avoid friendly shadow zones (Velaris Hero orbs, ally Occlude cones)

### Ability Usage
- **Aim Shadow Cone at enemy solar mirror arrays** to stop energy generation for 8 seconds
- Align the cone to hit **multiple mirrors in sequence** (narrow 15° means precise aiming matters)
- Use to deny sunlight during pushes — enemies can't generate energy to replace losses
- 12-second cooldown with 8-second duration means 66% uptime if used on cooldown
- Can also use defensively: cone on enemy attackers puts them in shadow (negating Splendor-type attacks)

### Threat Assessment
- **Strong against**: Mirror-dependent economies (8-second blackout), enemies in open sunlight
- **Weak against**: Enemies already in shadow (attacks do nothing), Splendor (creates artificial sunlight)
- **Countered by**: Splendor Sun Sphere (overrides shadow), indoor/shaded positioning, enemies that don't rely on mirrors

### Synergies
- **Occlude + Velaris Hero**: Both deny light — Velaris orbs block globally, Occlude cone targets precisely
- **Occlude + Shroud**: Triple sunlight denial (cubes + cone + orbs) shuts down enemy economy entirely
- **Occlude + Shadow**: Shadow benefits from enemies not being able to generate replacement units
