# Radiant Faction — AI Agent Guidelines

> **Faction Color:** `#FF5722` (reddish-orange, like glowing embers)

## Faction Identity

Radiant is the blazing, aggression-oriented faction. Its hero roster emphasizes **direct firepower, long-range precision, and sustained damage output**. Radiant compositions excel at maintaining pressure through high-DPS ranged heroes, area denial, and autonomous summoned units.

## Hero Roster

| Hero | Role | Key Mechanic |
|------|------|--------------|
| [Marine](heroes/radiant/MARINE.md) | Rapid-fire DPS | Bullet Storm spread |
| [Beam](heroes/radiant/BEAM.md) | Sniper | Distance-based damage multiplier |
| [Spotlight](heroes/radiant/SPOTLIGHT.md) | Recon / Burst DPS | Narrow reveal cone + rapid fire |
| [Mortar](heroes/radiant/MORTAR.md) | Siege Artillery | Splash damage, stationary setup |
| [Mothership](heroes/radiant/MOTHERSHIP.md) | Carrier / Swarm | Spawns autonomous mini-motherships |
| [Ray](heroes/radiant/RAY.md) | Bouncing Beam | Ricocheting beam hits multiple targets |
| [Turret Deployer](heroes/radiant/TURRET_DEPLOYER.md) | Zone Control | Places turrets on asteroids |
| [Radiant Hero](heroes/radiant/RADIANT_HERO.md) | Faction Hero / Area Denial | Orbs that create laser fields |

## Faction Strengths

- **Sustained ranged damage**: Marine, Beam, and Spotlight deliver consistent DPS at various ranges
- **Siege capability**: Mortar provides devastating splash damage from afar
- **Autonomous pressure**: Mothership mini-ships and Turret Deployer turrets create multiple attack vectors
- **Area denial**: Radiant Hero's laser fields block movement corridors

## Faction Weaknesses

- **Low survivability**: Many heroes (Beam 70 HP, Dagger-class HP) are fragile
- **Setup dependency**: Mortar and Spotlight require setup time before being effective
- **Limited healing**: No dedicated support hero in Radiant's roster
- **Mobility**: Most Radiant heroes lack escape abilities

---

## AI Behavior by Difficulty

### Easy Difficulty (AIStrategy: ECONOMIC)

**Overall Philosophy**: The Easy AI plays passively, focusing on economy over military engagement. It is forgiving and gives the player time to establish their base.

**Economy & Mirrors**:
- Places solar mirrors at a **balanced distance** from the sun (250px) — neither optimal nor wasteful
- Purchases mirrors at the standard 8-second interval
- Maximum 6 mirrors

**Hero Production**:
- Produces heroes **50% slower** than baseline (4.5-second interval instead of 3.0s)
- Prioritizes economy spending over unit production
- Cycles through available hero types in order: Marine → Mothership → Beam → Mortar → Spotlight → Radiant Hero

**Structure Building**:
- Prioritizes Subsidiary Factory first for economic growth
- Builds minimal defenses: only 1 Minigun and 1 SpaceDustSwirler
- Structure placement has **very low shade preference** (weight: 10) — rarely optimizes building position

**Combat Behavior**:
- **Defensive posture only**: Heroes rally to the Stellar Forge, Starlings guard mirrors
- Only engages enemies that enter the 350px defense radius
- Never initiates offensive pushes
- Reacts slowly to threats (1-second defense check interval)

**Exploitable Patterns**:
- Will not attack even when it has a unit advantage
- Mirror positions are predictable at 250px
- Slow hero production creates windows for aggression
- Rarely has more than 2-3 heroes active simultaneously

---

### Medium Difficulty (AIStrategy: DEFENSIVE)

**Overall Philosophy**: The Medium AI focuses on building a strong defensive position. It protects its assets well but is reluctant to push offensively.

**Economy & Mirrors**:
- Places mirrors **far from the sun** (400px) for safety — accepts lower energy generation
- Mirror positions are harder to raid due to proximity to base
- Standard 8-second purchase interval

**Hero Production**:
- Produces heroes at the **baseline rate** (3.0-second interval)
- Maintains a steady army composition
- Replaces lost heroes promptly

**Structure Building**:
- **Heavily defensive**: Up to 2 SpaceDustSwirlers before Subsidiary Factory
- Builds up to 3 Miniguns initially, expanding to 5 total
- Moderate shade placement preference (weight: 45) — somewhat optimizes positions
- Subsidiary Factory is lower priority than defenses

**Combat Behavior**:
- Defends mirrors and Stellar Forge aggressively
- Heroes rally to Stellar Forge as guard point
- Starlings are distributed across mirrors for individual protection
- Responds to threats quickly but **does not counterattack**
- Pulls back if threat is eliminated

**Exploitable Patterns**:
- Predictable mirror distance at 400px makes flanking easier if approached from sun-side
- Will not push even when enemy is weakened
- Heavy defense investment means slower army buildup
- Can be starved by taking map control and denying expansion

---

### Hard Difficulty (AIStrategy: AGGRESSIVE)

**Overall Philosophy**: The Hard AI is a relentless attacker. It prioritizes rapid unit production and constant offensive pressure, sacrificing economic efficiency for military dominance.

**Economy & Mirrors**:
- Places mirrors **very close to the sun** (180px) for maximum energy generation
- Accepts risk of losing mirrors to enemy raids
- Rapidly builds mirrors to fuel constant production

**Hero Production**:
- Produces heroes **30% faster** than baseline (2.1-second interval)
- Rapidly fills its hero roster
- Immediately replaces fallen heroes
- Maintains full hero complement at all times

**Structure Building**:
- Prioritizes Subsidiary Factory first for rapid unit production
- Builds only 1 Minigun for minimal defense
- **High shade placement preference** (weight: 120) — actively optimizes building positions in shadow
- Values offensive infrastructure over defensive

**Combat Behavior**:
- **Always pushes toward enemy Stellar Forge**
- All heroes and Starlings rally to the enemy base
- Does not wait for reinforcements — sends units as they spawn
- Constant pressure forces reactive play from the opponent
- **Hard-exclusive: Mirror guards** — positions up to 2 defensive units per mirror

**Dangerous Patterns**:
- Relentless aggression means the player must fight on their own territory
- Fast hero replacement means killing a hero provides only brief advantage
- Mirror guards protect the economy even during offensive pushes
- Close mirror placement generates high energy for sustained production

---

## AI Tactical Notes for Agent Collaboration

### Hero Ability Usage (AI)
The AI currently does **not** use hero abilities automatically. Heroes fight using their normal attacks and are directed via rally points. Future AI improvements should add:
- Marine: Use Bullet Storm when 3+ enemies are clustered
- Beam: Use Precision Shot on high-value targets at maximum range
- Spotlight: Activate cone toward largest enemy cluster
- Mortar: Setup facing enemy approach direction
- Mothership: Use Escort Wing when engaging enemy base
- Ray: Fire Solar Ricochet into dense enemy formations

### Composition Synergies
- **Siege Push**: Mortar + Tank (from allied Aurum) for protected long-range assault
- **Swarm**: Marine + Mothership for overwhelming target saturation
- **Sniper Nest**: Beam + Spotlight for vision + assassination at range
- **Area Lockdown**: Radiant Hero orbs + Turret Deployer for multi-zone denial
