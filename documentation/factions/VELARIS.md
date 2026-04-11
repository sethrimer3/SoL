# Velaris Faction — AI Agent Guidelines

> **Faction Color:** `#9C27B0` (purple)
>
> **Special Feature:** Velaris ancient script for ability effects and upgrade completions

## Faction Identity

Velaris is the shadow-manipulation and area-control faction. Its hero roster emphasizes **crowd control, deception, zone denial, and unconventional damage patterns**. Velaris compositions excel at controlling the battlefield through freeze effects, gravity wells, shadow zones, and multi-layered traps. Velaris heroes force enemies to fight on Velaris's terms.

## Hero Roster

| Hero | Role | Key Mechanic |
|------|------|--------------|
| [Grave](heroes/velaris/GRAVE.md) | Gravitic Sentinel | Orbiting projectiles + Black Hole vortex |
| [Nova](heroes/velaris/NOVA.md) | Remote Bomb Specialist | Bouncing remote-detonation bomb |
| [Sly](heroes/velaris/SLY.md) | Trap Specialist | Sticky laser bombs |
| [Diplomat](heroes/velaris/DIPLOMAT.md) | Zone Controller | Deployable influence zones |
| [Dagger](heroes/velaris/DAGGER.md) | Cloaked Assassin | Permanent invisibility + burst strike |
| [Chrono](heroes/velaris/CHRONO.md) | Area Freeze Controller | Freeze attack + scalable freeze circle |
| [Shadow](heroes/velaris/SHADOW.md) | Beam Duelist / Deception | Escalating beam damage + decoy |
| [Occlude](heroes/velaris/OCCLUDE.md) | Shadow Beam Attacker | Shadow-beams in sunlight + shadow cone |
| [Velaris Hero](heroes/velaris/VELARIS_HERO.md) | Faction Hero / Light Blocker | Orbs that create light-blocking fields |

## Faction Strengths

- **Unmatched crowd control**: Chrono freezes, Grave's Black Hole, and zone effects lock down enemy movement
- **Deception and stealth**: Dagger's permanent cloak and Shadow's decoy create confusion
- **Trap-based damage**: Nova and Sly set up devastating ambushes that punish aggressive play
- **Light manipulation**: Occlude and Velaris Hero can deny sunlight to enemy solar mirrors
- **Multi-layered defense**: Overlapping zones and traps create kill boxes

## Faction Weaknesses

- **Complexity**: Many heroes require precise positioning and timing to be effective
- **Low direct DPS**: Few heroes deal high sustained damage in open combat
- **Setup time**: Traps and zones need to be deployed before enemies arrive
- **Vulnerability when cooldowns are spent**: Many heroes are weak between ability uses
- **Fragile casters**: Most Velaris heroes have low HP (80-105 range)

---

## AI Behavior by Difficulty

### Easy Difficulty (AIStrategy: ECONOMIC)

**Overall Philosophy**: The Easy Velaris AI plays passively, slowly building an economy. Its powerful control heroes are underutilized in a purely defensive posture.

**Economy & Mirrors**:
- Places mirrors at **balanced distance** (250px) from the sun
- Standard 8-second purchase interval
- Maximum 6 mirrors

**Hero Production**:
- Produces heroes **50% slower** than baseline (4.5-second interval)
- Cycles through: Grave → InfluenceBall → VelarisHero → Shadow → Chrono → Occlude
- Nova, Sly, and Dagger may not appear until late game
- Often has only 2-3 active heroes

**Structure Building**:
- Prioritizes Subsidiary Factory for economic growth
- Minimal defenses: 1 Minigun, 1 SpaceDustSwirler
- Low shade placement preference (weight: 10)

**Combat Behavior**:
- Heroes rally to Stellar Forge
- Starlings guard mirrors individually
- Engages only within 350px defense radius
- Never initiates attacks
- Chrono and Grave provide passive area denial near base

**Exploitable Patterns**:
- Dagger's cloak is wasted on defense — never used for assassination
- Nova and Sly bombs are never placed proactively
- Chrono freeze zones not used to protect chokepoints
- Easy to overwhelm with direct assault since crowd control is reactive only
- Slow hero production leaves major gaps in the roster

---

### Medium Difficulty (AIStrategy: DEFENSIVE)

**Overall Philosophy**: The Medium Velaris AI creates a well-defended base with overlapping control zones. It is very difficult to assault head-on but will not push out to threaten the opponent.

**Economy & Mirrors**:
- Places mirrors **far from sun** (400px) for maximum safety
- Close to base for protection
- Standard purchase interval

**Hero Production**:
- Produces heroes at **baseline rate** (3.0-second interval)
- Full roster maintained consistently
- All control heroes online for layered defense

**Structure Building**:
- Heavy defense: 2 SpaceDustSwirlers before factory
- Up to 5 Miniguns
- Moderate shade preference (weight: 45)
- Creates fortified perimeter

**Combat Behavior**:
- Grave's orbiting projectiles patrol around Stellar Forge
- Chrono zones freeze attackers approaching the base
- Shadow beam punishes units that linger near defenses
- Diplomat influence zones expand territory defensively
- Occlude shadow cones deny enemy beam/light attacks near base
- Dagger remains cloaked near base as invisible sentry

**Exploitable Patterns**:
- Will not push — map control is conceded entirely
- Predictable defensive layering can be outranged by siege heroes (Mortar, Beam)
- Shroud cubes from enemy Aurum can neutralize the mirror economy
- Can be outscaled if the opponent plays economically and raids mirrors
- Never uses traps offensively

---

### Hard Difficulty (AIStrategy: AGGRESSIVE)

**Overall Philosophy**: The Hard Velaris AI aggressively deploys its control heroes to lock down the enemy and create overwhelming zone advantages. It pushes forward with crowd control leading the charge.

**Economy & Mirrors**:
- Places mirrors **very close to sun** (180px) for peak energy generation
- Accepts mirror exposure for maximum income
- Rapid purchasing fuels aggressive hero production

**Hero Production**:
- Produces heroes **30% faster** than baseline (2.1-second interval)
- Rapidly achieves full roster
- Immediately replaces lost heroes
- All crowd control heroes online early for aggressive zoning

**Structure Building**:
- Prioritizes Subsidiary Factory for rapid production
- Only 1 Minigun for base defense
- High shade preference (weight: 120)
- **Hard-exclusive: Mirror guards** — up to 2 units protect each mirror

**Combat Behavior**:
- **All heroes push toward enemy Stellar Forge**
- Chrono leads the push with freeze zones to lock down defenders
- Grave launches Black Holes into enemy formations
- Shadow fires sustained beams at priority targets, escalating damage
- Dagger cloaks ahead and strikes enemy heroes from behind
- Nova and Sly pre-place traps along enemy retreat paths
- Occlude projects shadow cones on enemy solar mirrors to deny income
- Velaris Hero deploys light-blocking orbs near enemy base
- Diplomat zones expand influence into enemy territory

**Dangerous Patterns**:
- Chrono freeze + Grave Black Hole combo locks entire enemy armies
- Dagger assassination removes key enemy heroes with little warning
- Shadow's escalating beam obliterates targets that can't flee
- Occlude and Velaris Hero can shut down enemy mirror economy mid-push
- Nova/Sly traps punish retreating defenders
- Mirror guards prevent economic counter-raids

---

## AI Tactical Notes for Agent Collaboration

### Hero Ability Usage (AI)
The AI currently does **not** use hero abilities automatically. Heroes fight using normal attacks and rally points. Future AI improvements should add:
- Grave: Launch Black Hole toward largest enemy cluster; manage particle spawning
- Nova: Pre-place bomb at chokepoints; detonate when enemies pass
- Sly: Attach sticky bombs to asteroids near enemy approach routes
- Diplomat: Place influence zones at contested territory boundaries
- Dagger: Cloak toward enemy backline; Shadow Strike on isolated heroes
- Chrono: Freeze zones at chokepoints; target freeze attack on high-DPS enemies
- Shadow: Maintain beam on single target to maximize damage multiplier; deploy decoy to absorb fire
- Occlude: Shadow cone on enemy mirrors; beam enemies standing in sunlight
- Velaris Hero: Deploy light-blocking orbs near enemy solar mirrors

### Composition Synergies
- **Lockdown**: Chrono + Grave for total area freeze and gravity control
- **Assassination**: Dagger + Shadow for stealth kills and decoy distraction
- **Trap Field**: Nova + Sly for overlapping bomb and laser traps
- **Eclipse**: Occlude + Velaris Hero for total light denial to enemy mirrors
- **Territory Control**: Diplomat + Chrono for expanding zones with freeze protection
