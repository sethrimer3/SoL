# Aurum Faction — AI Agent Guidelines

> **Faction Color:** `#FFD700` (bright gold)

## Faction Identity

Aurum is the resilient, utility-focused faction. Its hero roster emphasizes **survivability, disruption, and support**. Aurum compositions excel at sustaining prolonged engagements through healing, shielding, crowd control, and repositioning abilities. Aurum heroes trade raw DPS for strategic versatility.

## Hero Roster

| Hero | Role | Key Mechanic |
|------|------|--------------|
| [Driller](heroes/aurum/DRILLER.md) | Flanker / Ambusher | Tunnels through asteroids |
| [Preist](heroes/aurum/PREIST.md) | Healer / Support | Dual healing beams + healing bomb |
| [Splendor](heroes/aurum/SPLENDOR.md) | Caster / Zone Control | Sunlight laser + bouncing sun sphere |
| [Tank](heroes/aurum/TANK.md) | Frontline Defender | Projectile shield + crescent stun wave |
| [Dash](heroes/aurum/DASH.md) | Burst Skirmisher | Invulnerable dash slash |
| [Blink](heroes/aurum/BLINK.md) | Teleporter / Disruptor | Teleport + area stun shockwave |
| [Shroud](heroes/aurum/SHROUD.md) | Siege / Denial | Decelerating cubes that block sunlight |
| [Aurum Hero](heroes/aurum/AURUM_HERO.md) | Faction Hero / Shield Support | Destructible orbs with shield fields |

## Faction Strengths

- **Exceptional survivability**: Tank (300 HP, 50 defense) and Driller (140 HP, 16 defense) are very durable
- **Dedicated healing**: Preist provides sustained healing via dual beams and burst healing via bombs
- **Strong crowd control**: Tank's crescent wave, Blink's shockwave, and Shroud's cubes disrupt enemy formations
- **Mobility**: Dash and Blink provide repositioning that no other faction can match
- **Sunlight disruption**: Shroud cubes block enemy solar mirrors, crippling their economy

## Faction Weaknesses

- **Lower overall DPS**: Several heroes deal zero normal attack damage (Driller, Tank, Dash, Blink)
- **Ability-dependent**: Most Aurum heroes are useless between ability cooldowns
- **Limited range**: No long-range heroes comparable to Beam or Mortar
- **Slower kill time**: Victories come through attrition, not burst damage

---

## AI Behavior by Difficulty

### Easy Difficulty (AIStrategy: ECONOMIC)

**Overall Philosophy**: The Easy Aurum AI prioritizes building a strong economy before engaging. Its defensive heroes often sit idle, providing a passive buffer.

**Economy & Mirrors**:
- Places mirrors at **balanced distance** (250px) from the sun
- Purchases mirrors at standard 8-second interval
- Maximum 6 mirrors

**Hero Production**:
- Produces heroes **50% slower** than baseline (4.5-second interval)
- Cycles through: Driller → AurumHero → Dash → Blink → Splendor → Shroud
- Slow production means Preist (the healer) may not appear until mid-game
- Often has only 2-3 active heroes

**Structure Building**:
- Prioritizes Subsidiary Factory for economic growth
- Minimal defenses: 1 Minigun, 1 SpaceDustSwirler
- Low shade placement preference (weight: 10)

**Combat Behavior**:
- Heroes rally to Stellar Forge defensively
- Starlings distributed across mirrors
- Engages only threats within 350px defense radius
- Never initiates attacks
- Tank and Driller provide passive defense through durability

**Exploitable Patterns**:
- Very slow to reach full hero complement — rush before support heroes arrive
- Driller and Tank are wasted on pure defense (no offensive contribution)
- Easy AI doesn't use Shroud to deny enemy mirrors — a major missed opportunity
- Blink and Dash remain at base, never used offensively

---

### Medium Difficulty (AIStrategy: DEFENSIVE)

**Overall Philosophy**: The Medium Aurum AI builds strong defenses and sustains them with healing. It creates a fortress that is hard to crack but rarely threatens the opponent.

**Economy & Mirrors**:
- Places mirrors **far from sun** (400px) for maximum safety
- Mirrors are close to base, difficult to raid
- Standard purchase interval

**Hero Production**:
- Produces heroes at **baseline rate** (3.0-second interval)
- Full hero roster maintained consistently
- Preist is online early, providing sustained healing

**Structure Building**:
- Heavy defensive priority: 2 SpaceDustSwirlers before factory
- Up to 5 Miniguns for base defense
- Moderate shade preference (weight: 45)
- Creates a well-defended perimeter

**Combat Behavior**:
- Tank positioned near Stellar Forge as anchor
- Preist heals all nearby friendlies continuously
- Dash and Blink remain defensive, engaging only intruders
- Starlings spread across mirrors for early warning
- Splendor provides mid-range firepower from base

**Exploitable Patterns**:
- Predictable turtle at 400px mirror range — map control is conceded
- Heavy defense investment slows economic growth
- Won't counterattack even after repelling an assault
- Shroud cubes not used offensively to deny enemy mirrors
- Can be outscaled by Economic strategies if left alone

---

### Hard Difficulty (AIStrategy: AGGRESSIVE)

**Overall Philosophy**: The Hard Aurum AI leverages its mobility and disruption heroes to aggressively pressure the enemy. Tank leads the charge while support heroes enable sustained aggression.

**Economy & Mirrors**:
- Places mirrors **very close to sun** (180px) for maximum energy
- High risk — mirrors are exposed but generate peak income
- Rapid mirror purchasing fuels constant hero production

**Hero Production**:
- Produces heroes **30% faster** than baseline (2.1-second interval)
- Full roster achieved quickly
- Immediately replaces casualties
- Preist appears early for sustained push healing

**Structure Building**:
- Prioritizes Subsidiary Factory for production throughput
- Only 1 Minigun for minimal defense
- High shade preference (weight: 120) — optimizes building placement
- **Hard-exclusive: Mirror guards** — up to 2 units guard each mirror

**Combat Behavior**:
- **All heroes push toward enemy Stellar Forge**
- Tank leads the formation, absorbing damage and clearing projectiles with crescent wave
- Preist follows behind, healing the advancing force
- Dash and Blink dive backline targets and flee
- Splendor provides sustained DPS from mid-range
- Driller flanks through asteroids to attack from unexpected angles
- Shroud fires cubes toward enemy mirrors to cut energy income
- Constant reinforcements arrive as heroes are produced at accelerated rate

**Dangerous Patterns**:
- Tank-Preist combination is extremely hard to break
- Blink shockwave stuns defenders, creating openings for the push
- Dash invulnerability allows consequence-free harassment
- Mirror guards prevent economic raiding as a counter-strategy
- Shroud sunlight denial can cripple opponent's economy during the push

---

## AI Tactical Notes for Agent Collaboration

### Hero Ability Usage (AI)
The AI currently does **not** use hero abilities automatically. Heroes fight using normal attacks and rally points. Future AI improvements should add:
- Driller: Tunnel through asteroids toward enemy mirrors/forge
- Preist: Auto-target healing to lowest-health nearby ally; use Healing Bomb on clustered allies
- Splendor: Fire Sun Sphere toward chokepoints; use laser on highest-value target
- Tank: Fire Crescent Wave when 3+ enemies are within range, or to clear incoming projectile barrages
- Dash: Dash through enemy formations to damage backline heroes
- Blink: Teleport behind enemy lines and stun-wave key targets (short blink for max stun radius)
- Shroud: Launch cubes toward enemy solar mirrors to block sunlight
- Aurum Hero: Place shield orbs near chokepoints and key allies

### Composition Synergies
- **Deathball**: Tank + Preist + Splendor for an advancing fortress with healing and DPS
- **Disruption Squad**: Blink + Dash for backline assassination and chaos
- **Mirror Denial**: Shroud + Driller for economic warfare
- **Shield Wall**: Tank + Aurum Hero shield orbs for layered defense
