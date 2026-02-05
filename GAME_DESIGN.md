# SoL (Speed of Light) - Game Design Document

## Overview
SoL is a 2D real-time strategy game set in space with cross-platform support for mobile and desktop.

## Core Concept
Players engage in space battles around stars/suns, utilizing light mechanics and ray tracing for strategic gameplay.

## Factions
Three distinct races with unique characteristics:
1. **Radiant** - Light-focused civilization
2. **Aurum** - Gold/wealth-oriented faction
3. **Velaris** - Strategic, ability-heavy race. Particles from Nebulae

## Core Gameplay Mechanics

### Main Base: Stellar Forge
- Primary structure for each player
- Produces both hero units and minion units
- Critical structure - loss results in defeat
- Must receive light from Solar Mirrors to function
- **Movement**: Can be moved by the player with slow acceleration/deceleration and slow top speed
  - Click on the Stellar Forge to select it
  - Click on the map to set a movement destination
  - Forge automatically deselects after setting a destination
- **Production Interface**: When selected, displays 4 hero unit production buttons
  - Each button corresponds to one hero in the player's loadout
  - Already-alive hero units are greyed out (can't produce duplicates)
  - Tap the Stellar Forge again to deselect

### Hero Units - Apotheoi (Apotheotic Order / Apotheotic Ones)
The elite, powerful units controlled directly by players:
- **Roster**: Each faction has 12 unique hero units
- **Loadout System**: Before each game, players select 4 heroes from their faction's roster as their loadout
- **Production Cost**: Requires energy investment (costs increase for duplicates, though only one of each type allowed)
- **Uniqueness**: Only one instance of each hero unit can exist on the battlefield at a time
- **Control**: Players can directly control up to 4 hero units simultaneously
- **Strategic Importance**: Heroes are more powerful than minions but require more resources

### Minion Units
Smaller automated units that form the backbone of your army:
- **Production**: Automatically produced by the Stellar Forge during "crunches"
- **Automation**: Minions automatically attack enemies
- **Control**: May be controllable by players (design decision pending)
- **Type Variety**: Design decision pending:
  - Option 1: Each faction has one minion type
  - Option 2: Multiple minion types per faction
  - Option 3: Multiple types with player-selectable production focus

### Resource System: Energy (E)
**NEW ECONOMY MODEL** - Sunlight-to-Production Direct Conversion:
- Solar Mirrors collect sunlight and reflect it to the Stellar Forge
- The Stellar Forge "crunches" periodically (like a hammer coming down)
- Each crunch consumes all accumulated sunlight since the last crunch
- **Production Priority System**:
  1. If a hero unit is being constructed, accumulated energy goes toward that hero
  2. If no hero is being built, accumulated energy produces minion units
  3. **Example**: Hero costs 500 energy, each crunch accumulates 200 energy
     - Crunch 1: 200 toward hero (300 remaining)
     - Crunch 2: 200 toward hero (100 remaining)
     - Crunch 3: 200 accumulated - hero completes (uses 100), remaining 100 produces minions
- **Production Rate**: More sunlight = more units per crunch
  - More Solar Mirrors = more sunlight
  - Closer Solar Mirrors to light sources = more efficient collection
- No traditional "bank" of energy - resources are immediately used each crunch

### Solar Mirrors
- Resource collection structures
- Reflect light from sun(s) to the Stellar Forge
- Require clear line-of-sight to:
  1. A light source (sun/star)
  2. The Stellar Forge (base)
- Can be targeted by enemies to disrupt economy
- Positioning affects efficiency - closer to suns = better collection

### Light & Shadow System
- Uses ray tracing for realistic light propagation
- Objects cast shadows in space
- Shadows block solar mirror efficiency
- Strategic positioning crucial for resource flow
- Multiple suns create complex light patterns

## Loadout System (Pre-Game)

### Faction Selection
- Main menu provides access to faction selection
- 3 factions available, each with distinct visual themes and bonuses

### Hero Loadout Selection
- After selecting a faction, players choose 4 heroes from a pool of 12
- Visual representation of all 12 heroes per faction
- Selected heroes are highlighted
- Loadout is saved for that faction

## Victory Conditions
- Destroy enemy Stellar Forge
- Economic domination
- Control key strategic positions

## Technical Features
- 2D graphics with ray-traced lighting
- Cross-platform (Mobile & Desktop)
- Real-time multiplayer with crossplay
- AI opponents

## Game Flow
1. Pre-game: Select faction and 4-hero loadout
2. Game start: Players begin with Stellar Forge and initial Solar Mirrors
3. Position mirrors to maximize light collection
4. Stellar Forge begins "crunching" - producing minions automatically
5. Use accumulated energy to produce hero units from loadout
6. Command hero units and minion swarms
7. Attack enemy positions, mirrors, and heroes
8. Protect own resource infrastructure and Stellar Forge
9. Destroy enemy Stellar Forge to win

## Current Implementation Status

### Implemented
✅ Three factions with distinct characteristics
✅ Stellar Forge main base system
✅ Solar Mirror resource collection
✅ Light-based mechanics with ray tracing
✅ Line-of-sight system for solar mirrors
✅ Cross-platform support (Mobile & Desktop)

### In Progress / To Be Implemented
🚧 Hero Units (Apotheoi) system
🚧 Loadout selection interface (faction + hero selection)
🚧 Stellar Forge selection and movement mechanics
🚧 Hero production buttons on Stellar Forge UI
🚧 New energy economy (crunch-based production)
🚧 Minion unit auto-production
🚧 Hero/Minion differentiation and balance

### Design Decisions Pending
❓ Minion unit variety (one type vs. multiple per faction)
❓ Minion controllability (auto-only vs. player-controllable)
❓ Minion production customization (fixed vs. selectable types)
