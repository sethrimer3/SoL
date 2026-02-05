# Faction Style Guide

## Overview
This document defines the visual identity and design characteristics for each of the three playable factions in SoL.

## Faction Colors

### Radiant
- **Primary Color**: `#FF5722` - Deep yet bright reddish-orange (like glowing embers)
- **Description**: Light-focused civilization
- **Visual Theme**: Bright, warm, solar energy
- **Faction Type**: Well-Balanced, Ranged-Focused

### Aurum
- **Primary Color**: `#FFD700` - Bright gold
- **Description**: Wealth-oriented faction
- **Visual Theme**: Metallic gold, prosperity, opulence
- **Faction Type**: Fast-Paced, Melee-Focused

### Velaris
- **Primary Color**: `#9C27B0` - Purple
- **Description**: Strategic, ability-heavy race. Particles from Nebulae
- **Visual Theme**: Mystical particles, cosmic nebulae, ethereal energy
- **Faction Type**: Strategic, Ability-Heavy
- **Special Characteristics**: 
  - Made of particles
  - Creatures formed from Nebulae
  - Ancient script (Velaris Ancient Script) appears in various places:
    - When heroes cast abilities
    - When a foundry completes an upgrade
    - Other mystical/strategic moments
  - Script location: `/ASSETS/sprites/VELARIS/velarisAncientScript/`

## Where Faction Colors Appear

1. **Faction Selection Screen**
   - Outline around faction buttons in the faction selection carousel
   - Faction name text highlighting
   - Faction card borders

2. **In-Game UI**
   - Player faction identification
   - Unit ownership indicators
   - Faction-specific ability effects

3. **Menu System**
   - Faction selection highlights
   - Player configuration screens
   - Loadout customization screens

## Shared Components Across All Factions

The following components are identical across all three factions and should be updated consistently:

1. **Solar Mirrors**
   - All factions have the same solar mirror mechanics
   - Same visual appearance
   - Same energy generation mechanics
   - Same health and regeneration

2. **Starlings (Minion Units)**
   - All factions have starlings with identical:
     - Base stats (health, damage, attack speed, movement speed)
     - Behavior (AI, pathfinding, targeting)
     - Abilities (base attack mechanics)
   
3. **Foundry Upgrades**
   - All factions have access to the same foundry upgrade system:
     - Strafe upgrade
     - Regen upgrade
     - Blink upgrade (for starlings)
   - Same upgrade costs
   - Same upgrade effects

4. **Base Structure (Stellar Forge)**
   - All factions have a stellar forge as their main base
   - Same health and mechanics
   - Different visual themes but same functionality

## Faction-Specific Components

### Radiant Only
The following buildings and heroes are exclusive to the Radiant faction:

**Buildings:**
- Minigun/Cannon
- Gatling Tower
- SpaceDustSwirler/Cyclone

**Heroes:**
- Marine
- Grave
- Dagger
- Beam
- Spotlight
- Mortar
- Preist
- Tank

### Aurum Only
The following heroes are exclusive to the Aurum faction:

**Heroes:**
- Driller
- (Additional Aurum heroes to be defined)

**Buildings:**
- (Aurum-specific buildings to be defined)

### Velaris Only
The following heroes are exclusive to the Velaris faction:

**Heroes:**
- Ray
- InfluenceBall
- TurretDeployer
- (Additional Velaris heroes to be defined)

**Buildings:**
- (Velaris-specific buildings to be defined)

## Implementation Notes for AI Agents

When making changes to the game:

1. **Shared Component Updates**: If you're updating solar mirrors, starlings, or foundry upgrades, the changes MUST be applied to all three factions (Radiant, Aurum, and Velaris).

2. **Faction-Specific Features**: Be careful to only add/modify faction-specific buildings and heroes for the appropriate faction. Do not give Radiant buildings to Aurum or Velaris, and vice versa.

3. **Color Consistency**: Always use the exact color codes defined in this guide for faction identification.

4. **Velaris Ancient Script**: When implementing ability effects or foundry upgrade completions for Velaris, consider incorporating the ancient script visuals from `/ASSETS/sprites/VELARIS/velarisAncientScript/`.
