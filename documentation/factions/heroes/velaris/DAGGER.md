# Dagger — Velaris Hero Unit

> **Faction:** Velaris · **Role:** Cloaked Assassin · **Source:** `src/heroes/dagger.ts`

## Stats

| Stat | Value |
|------|-------|
| Max Health | 80 |
| Attack Damage | 35 |
| Attack Speed | 1.5 attacks/sec |
| Attack Range | 100 px |
| Defense | 5 |
| Regen | 3 HP/sec |
| Ignores Defense | No |
| Ability Cooldown | 6.0 sec |

## Normal Attack

Standard melee-range attack at 1.5 attacks per second. **High damage** (52.5 DPS) but requires being very close (100px). Dagger has the **highest DPS** among Velaris heroes when within range.

## Passive — Permanent Cloak

| Parameter | Value |
|-----------|-------|
| Cloak Opacity (to owner) | 0.4 (40%) |

**Dagger is permanently invisible** to enemies. This is not an ability — it is a passive state. Dagger can only be seen by:
- The owning player (at 40% opacity)
- Spotlight's reveal cone
- Splendor's sunlight zone (if implemented)

## Ability — Shadow Strike

Short-range burst attack projectile that **reveals Dagger** for 8 seconds.

| Parameter | Value |
|-----------|-------|
| Ability Range | 150 px |
| Ability Damage | 50 |
| Visibility Duration | 8.0 sec |

**Behavior**:
1. Fires a burst-damage projectile in the aimed direction (150px range)
2. Deals **50 damage** on hit — combined with the reveal, this is an assassination tool
3. **Reveals Dagger for 8 seconds** after use — Dagger becomes visible to enemies
4. During the 8-second visibility window, Dagger is targetable by all enemies
5. After 8 seconds, Dagger returns to permanent cloak

**Assassination Combo**: Shadow Strike (50) + normal attack (35) = **85 damage** in the first moment of engagement. Follow-up attacks at 52.5 DPS finish most heroes in 1-2 seconds.

## AI Strategy Guidelines

### General Logic
- Dagger is the **premier assassin** — invisible approach, burst kill, fade away
- Permanent cloak means Dagger can **scout enemy positions freely**
- Strike priority targets (Preist, Beam, Spotlight) and retreat during the 8-second visibility
- Very fragile (80 HP, 5 defense) — avoid sustained combat at all costs

### Positioning
- Position **behind enemy lines** using cloak to approach unseen
- Stay near asteroids for escape cover when visibility triggers
- Circle around enemy formations to find isolated targets

### Ability Usage
- **Strike enemy Preist first** — removing healing cripples the enemy formation
- Target fragile heroes: Beam (70 HP), Spotlight (95 HP), Sly (90 HP)
- **Do not use Shadow Strike on Tank or other high-HP targets** — wasting reveal for minimal impact
- After striking, immediately retreat toward allies or asteroid cover
- Wait for the 8-second visibility to expire before re-engaging
- 6-second cooldown means ability is ready again shortly after re-cloaking

### Threat Assessment
- **Strong against**: Preist (assassination removes healing), Beam (fragile, no escape), isolated heroes
- **Weak against**: Spotlight (reveals cloak in cone), grouped enemies (focus fire during visibility)
- **Countered by**: Spotlight cone reveals, Splendor sunlight zones, AoE damage that hits the invisible position

### Synergies
- **Dagger + Shadow**: Shadow decoy draws attention while Dagger assassinates from behind
- **Dagger + Chrono**: Freeze zone immobilizes target for guaranteed Shadow Strike
- **Dagger + Nova**: Dagger lures enemy into Nova bomb trap, then re-cloaks
