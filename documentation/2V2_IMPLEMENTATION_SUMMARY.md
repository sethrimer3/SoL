# 2v2 Framework Implementation Summary

## Overview
This document summarizes the implementation of 2v2 team-based gameplay framework for Speed of Light RTS.

## Completed Features

### 1. Core Team Support
- **Player Team Assignment**: Added `teamId` field to Player class (0 or 1 for team identification)
- **Team Victory Conditions**: Updated `GameState.checkVictoryConditions()` to handle team-based wins
  - Victory when all players on opposing team are defeated
  - Works for both 2v2 and standard 1v1 modes
- **Team Helper Methods**: Added utility methods to GameState:
  - `areAllies(player1, player2)`: Check if two players are teammates
  - `areEnemies(player1, player2)`: Check if two players are enemies
  - `getTeammates(player)`: Get all teammates of a player
  - `getEnemies(player)`: Get all enemies of a player
  - `getTeamPlayers(teamId)`: Get all players on a specific team

### 2. MMR System for 2v2
- **Separate 2v2 MMR Tracking**: Extended `PlayerMMRData` interface
  - `mmr` / `wins` / `losses` / `gamesPlayed`: For 1v1 matches
  - `mmr2v2` / `wins2v2` / `losses2v2` / `gamesPlayed2v2`: For 2v2 matches
- **2v2 MMR Calculation**: Added `updatePlayer2v2MMR()` function
  - Uses Elo rating system with team average MMR
  - Separate from 1v1 MMR to ensure fair matchmaking
- **Data Migration**: Existing player data automatically migrated to include 2v2 stats

### 3. Game Mode Selection
- **Updated Menu Options**: Added two new game modes:
  - **Custom Lobby**: Create/join 2v2 games with custom settings
  - **2v2 Matchmaking**: Ranked 2v2 with MMR-based matching
- **Type Safety**: Extended GameSettings and menu types to support new modes

### 4. Custom Lobby UI
Created comprehensive lobby interface (`custom-lobby-screen.ts`):
- **Lobby Creation**: 
  - Name input for custom lobbies
  - Create button with validation
- **Lobby Browser**:
  - List of available lobbies (placeholder for backend)
  - Empty state message when no lobbies exist
- **Info Section**: Explains custom lobby features
  - 2v2 team configuration
  - AI opponent support
  - Color and faction selection
  - No MMR (casual play)

### 5. 2v2 Matchmaking UI
Created ranked matchmaking interface (`matchmaking-2v2-screen.ts`):
- **Stats Display**:
  - Current 2v2 MMR (large, prominent)
  - Win/Loss record with win rate percentage
  - Color-coded (green wins, red losses)
- **Matchmaking Controls**:
  - "Find Match" button to start search
  - "Cancel" button to stop search
  - Status messages during search
- **Info Section**: Explains 2v2 matchmaking
  - Team-based gameplay
  - Separate MMR from 1v1
  - Pre-configured teams and colors

### 6. Team Color Settings
- **New Color Options**: Added to settings interface
  - `allyColor`: Color for teammate units/structures (default: green #88FF88)
  - `enemy2Color`: Color for second enemy team (default: orange #FFA500)
  - Existing: `playerColor` (blue) and `enemyColor` (red)
- **Settings Screen**: Updated with color pickers for all team colors
- **Purpose**: Clear visual distinction in 2v2 battles

### 7. Multiplayer Type Definitions
Updated type interfaces for 2v2 support:
- **GameSettings**: Added `gameMode: '2v2'` option and `teamConfig`
- **GameRoom**: Added `game_mode` field to distinguish lobby types
- **RoomPlayer**: Extended with team-related fields:
  - `team_id`: Team assignment (0, 1, or null for spectators)
  - `is_spectator`: Whether player is spectating
  - `slot_type`: 'player', 'ai', 'spectator', or 'empty'
  - `ai_difficulty`: 'easy', 'normal', or 'hard' for AI slots
  - `player_color`: Custom color selection

## Architecture Decisions

### Team System Design
- **Binary Teams**: Using team IDs 0 and 1 for simplicity
  - Scales easily to 2v2 format
  - Clear us-vs-them distinction
  - Simple network synchronization

### MMR Separation
- **Separate Pools**: 1v1 and 2v2 MMR are completely independent
  - Prevents skill mismatches between game modes
  - Allows specialization in team vs solo play
  - Standard practice in competitive games

### Color Scheme
- **Accessibility First**: Chosen colors work for color-blind players
  - Blue (player), Red (enemy), Green (ally), Orange (enemy 2)
  - High contrast between friendly/enemy teams
  - Customizable in settings for player preference

## Remaining Work

### Backend Implementation
- Database schema for custom lobbies
- Lobby creation/joining/deletion logic
- Team slot management and configuration
- Real-time lobby updates via Supabase

### Matchmaking System
- Queue management for 2v2 matchmaking
- MMR-based team formation
- Player search and matching algorithm
- Match initialization and player notification

### Network Updates
- Extend command synchronization for 4 players
- Team-based chat channels (all/team/whisper)
- Spectator mode network handling
- 4-player game state synchronization

### Rendering Updates
- Apply team colors to units and structures
- Update selection indicators for allies
- Team-specific UI elements (ally health bars)
- Minimap team color coding

### AI Updates
- Teach AI to recognize teammates
- Coordinate with AI teammate
- Target prioritization for team play
- Avoid friendly fire

### Testing
- Team victory condition edge cases
- 4-player network synchronization
- MMR calculations for team games
- Custom lobby creation and joining
- Spectator mode functionality

## Files Modified

### Core Game Files
- `src/sim/entities/player.ts`: Added teamId field
- `src/sim/game-state.ts`: Team victory logic and helper methods
- `src/replay.ts`: 2v2 MMR tracking

### Type Definitions
- `src/multiplayer-types.ts`: GameSettings with team support
- `src/online-network.ts`: RoomPlayer and GameRoom extensions

### Menu System
- `src/menu.ts`: New screens and color settings
- `src/menu/screens/game-mode-selection-screen.ts`: New game modes
- `src/menu/screens/custom-lobby-screen.ts`: NEW - Lobby UI
- `src/menu/screens/matchmaking-2v2-screen.ts`: NEW - Matchmaking UI
- `src/menu/screens/settings-screen.ts`: Team color pickers

## Technical Notes

### Build Status
- ✅ All TypeScript compiles without errors
- ✅ Webpack builds successfully
- ✅ Type safety maintained throughout

### Backwards Compatibility
- Existing 1v1 games work unchanged
- Old MMR data automatically migrated
- Default teamId of 0 for all players maintains 1v1 behavior

### Future Considerations
- Could extend to 3v3 or 4v4 with minimal changes
- Team size could be configurable in custom lobbies
- Spectator slots could allow unlimited viewers
- Replay system already supports multiple players

## Usage Examples

### Creating a Team Game
```typescript
// In game initialization
const player1 = new Player("Alice", Faction.RADIANT);
player1.teamId = 0;

const player2 = new Player("Bob", Faction.AURUM);
player2.teamId = 0; // Same team as Alice

const player3 = new Player("Charlie", Faction.VELARIS);
player3.teamId = 1; // Enemy team

const player4 = new Player("Dave", Faction.RADIANT);
player4.teamId = 1; // Enemy team with Charlie
```

### Checking Team Relationships
```typescript
if (gameState.areAllies(player1, player2)) {
    // Don't allow friendly fire
}

const enemies = gameState.getEnemies(player1);
// Returns [player3, player4]
```

### Updating 2v2 MMR
```typescript
const enemyTeamMMR = 1050; // Average MMR of enemy team
const won = true;

const result = updatePlayer2v2MMR(enemyTeamMMR, won);
// Returns { newMMR: 1016, mmrChange: 16 }
// Calculates change based on player's current 2v2 MMR vs enemy team average
```

## Next Steps
1. Implement database schema for custom lobbies
2. Connect lobby UI to backend (Supabase)
3. Implement matchmaking queue system
4. Update renderer for team colors
5. Test 4-player network synchronization
6. Update AI for team coordination
