# Velaris Hero — Velaris Faction Hero

> **Faction:** Velaris · **Role:** Faction Hero / Light Blocker · **Source:** `src/heroes/velaris-hero.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 120 |
| Attack Damage | 0 (no normal attack) |
| Attack Speed | 0 |
| Attack Range | 0 |
| Defense | — |
| Regen | — |
| Ignores Defense | — |
| Ability Cooldown | 4.0 sec |

## Normal Attack

**No normal attack.** Velaris Hero relies entirely on orb placement and light-blocking field connections.

## Ability — Launch Shadow Orb

Fires a **deceleration orb** that creates **light-blocking fields** connecting to other placed orbs.

| Parameter | Value |
|-----------|-------|
| Max Orbs | 3 |
| Orb Radius | 15 px |
| Min Range | 100 px |
| Max Range | 400 px |
| Speed Multiplier | 3.0× arrow length |
| Max Speed | 600 px/sec |
| Deceleration | 150 px/sec² |
| Bounce Damping | 0.7× on bounce |
| Particle Speed | 200 px/sec |

**Behavior**:
1. Orb is launched with speed proportional to arrow draw length (up to 600 px/sec)
2. Orb decelerates and bounces off asteroids with 70% speed retention
3. Range scales with current speed — slower = stops sooner
4. Once placed, orbs form **shadow field connections** to other nearby orbs
5. Shadow fields **block sunlight** — solar mirrors in shadow fields stop generating energy
6. Maximum 3 orbs — launching a 4th removes the oldest

**Key Difference from Radiant Hero**: Same physics but creates **shadow/dark fields** instead of laser damage fields. The strategic value is **economic denial** rather than direct damage.

## AI Strategy Guidelines

### General Logic
- Velaris Hero is a **pure economic warfare specialist** — shadow fields deny enemy mirror income
- No damage output whatsoever — value is entirely in strategic orb placement
- 4-second cooldown allows rapid repositioning of shadow fields
- Coordinate with Occlude and Shroud for overwhelming light denial

### Positioning
- Position between the **sun and enemy mirrors** to block the light path
- Stay 200-400px from the combat zone — Velaris Hero has no combat ability
- Protect with allies since Velaris Hero is defenseless in a fight

### Ability Usage
- **Place orbs to create shadow fields across enemy mirror arrays**
- Position orbs in a **triangle** between the sun and enemy mirrors for maximum shadow coverage
- Bounce orbs off asteroids to place them in otherwise inaccessible positions
- Rapidly reposition if enemy moves their mirrors — 4-second cooldown enables quick adjustments
- Shadow field placement should be the **first priority** in any engagement

### Threat Assessment
- **Strong against**: Mirror-heavy economies (denies energy generation), static mirror positions
- **Weak against**: Any combat hero (Velaris Hero cannot fight at all), enemies that reposition mirrors
- **Countered by**: Splendor Sun Sphere (creates artificial sunlight that overrides shadow fields)

### Synergies
- **Velaris Hero + Occlude**: Shadow cone + shadow orbs = multi-layered light denial
- **Velaris Hero + Shroud**: Shroud cubes + Velaris orbs block sunlight from multiple directions
- **Velaris Hero + Chrono**: Freeze zones protect the orbs from enemies trying to disrupt them
