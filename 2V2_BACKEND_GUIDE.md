# 2v2 Backend Implementation Guide

## Overview
This guide covers the backend implementation for 2v2 team-based gameplay, including custom lobbies and matchmaking.

## Database Setup

### Prerequisites
- Supabase project with existing schema from `supabase.sql`
- Supabase URL and Anonymous Key configured
- Row Level Security (RLS) policies enabled

### Migration Steps

1. **Apply the 2v2 Migration**
   
   Run `supabase.sql` in your Supabase SQL Editor:
   
   ```bash
   # Using Supabase CLI
   supabase db push

   # Or manually in Supabase Dashboard > SQL Editor
   # Copy and paste the contents of supabase.sql
   ```

2. **Verify Tables**
   
   After migration, verify these tables exist:
   - `game_rooms` (updated with `game_mode` column)
   - `room_players` (updated with team fields)
   - `matchmaking_queue` (new table)

3. **Enable Anonymous Access (Development Only)**
   
   For development/testing without authentication:
   - Uncomment the anonymous access policies at the end of the migration SQL
   - This allows testing without Supabase Auth setup
   - **Important**: Use proper authentication for production

## Architecture

### Custom Lobbies Flow

```
┌─────────────┐         ┌──────────────────┐         ┌───────────┐
│   Player    │────────>│ OnlineNetwork    │────────>│ Supabase  │
│   (Client)  │         │ Manager          │         │ Database  │
└─────────────┘         └──────────────────┘         └───────────┘
      │                          │                          │
      │ createCustomLobby()      │                          │
      │────────────────────────>│                          │
      │                          │ INSERT game_rooms        │
      │                          │─────────────────────────>│
      │                          │                          │
      │                          │ INSERT room_players      │
      │                          │─────────────────────────>│
      │                          │                          │
      │                          │ Subscribe to channel     │
      │                          │<─────────────────────────│
      │<─────────────────────────│                          │
      │ GameRoom object          │                          │
```

### Matchmaking Flow

```
┌─────────────┐         ┌──────────────────┐         ┌───────────┐
│  Player 1   │         │ OnlineNetwork    │         │ Supabase  │
│             │         │ Manager          │         │ Database  │
└─────────────┘         └──────────────────┘         └───────────┘
      │                          │                          │
      │ joinMatchmakingQueue()   │                          │
      │────────────────────────>│                          │
      │                          │ INSERT matchmaking_queue │
      │                          │─────────────────────────>│
      │                          │                          │
┌─────────────┐                 │                          │
│  Player 2   │                 │                          │
└─────────────┘                 │                          │
      │                          │                          │
      │ joinMatchmakingQueue()   │                          │
      │────────────────────────>│                          │
      │                          │ INSERT matchmaking_queue │
      │                          │─────────────────────────>│
      │                          │                          │
      │                          │ findMatchmakingCandidates│
      │                          │─────────────────────────>│
      │                          │<─────────────────────────│
      │                          │ Matched players          │
      │                          │                          │
      │                          │ Create game room         │
      │                          │─────────────────────────>│
```

## API Reference

### OnlineNetworkManager Methods

#### Custom Lobby Methods

**createCustomLobby(lobbyName: string, username: string): Promise<GameRoom | null>**
- Creates a new custom 2v2 lobby
- Sets max_players to 4
- Assigns creator to team 0 as host
- Returns GameRoom object or null on failure

**listCustomLobbies(): Promise<GameRoom[]>**
- Fetches available custom/2v2 lobbies
- Filters by game_mode IN ('2v2', 'custom')
- Only shows lobbies with status='waiting'
- Returns up to 20 most recent lobbies

**setPlayerTeam(playerId: string, teamId: number): Promise<boolean>**
- Assigns player to team 0 or 1
- Host only operation
- Broadcasts team change to lobby channel
- Returns true on success

**setSlotType(playerId: string, slotType: 'player' | 'ai' | 'spectator'): Promise<boolean>**
- Changes slot type for a player
- Sets is_spectator flag appropriately
- Clears team_id for spectators
- Host only operation

**setAIDifficulty(playerId: string, difficulty: 'easy' | 'normal' | 'hard'): Promise<boolean>**
- Sets AI difficulty for AI slots
- Only works when slot_type='ai'
- Host only operation

**setPlayerColor(color: string): Promise<boolean>**
- Sets custom color for the local player
- Color should be hex format (e.g., '#FF6B6B')
- Any player can set their own color

**setPlayerFaction(faction: string): Promise<boolean>**
- Sets faction selection (RADIANT, AURUM, VELARIS)
- Any player can set their own faction

#### Matchmaking Methods

**joinMatchmakingQueue(username: string, mmr: number, faction: string): Promise<boolean>**
- Enters the 2v2 matchmaking queue
- Uses player's 2v2 MMR for matching
- Stores faction preference
- Returns true on successful queue join

**leaveMatchmakingQueue(): Promise<boolean>**
- Removes player from matchmaking queue
- Should be called when cancelling search
- Returns true on success

**isInMatchmakingQueue(): Promise<boolean>**
- Checks if local player is currently in queue
- Useful for UI state management
- Returns true if player is searching

**findMatchmakingCandidates(mmr: number): Promise<any[]>**
- Finds potential matches within MMR range
- Searches ±100 MMR from provided rating
- Returns up to 3 other players (for 2v2)
- Ordered by MMR difference and join time

## Database Schema

### game_rooms Table Updates

```sql
ALTER TABLE game_rooms 
ADD COLUMN game_mode TEXT DEFAULT '1v1' 
CHECK (game_mode IN ('1v1', '2v2', 'custom'));
```

**Fields:**
- `game_mode`: Distinguishes lobby type
  - `'1v1'`: Standard 1v1 match
  - `'2v2'`: Ranked 2v2 matchmaking
  - `'custom'`: Custom lobby with configurable settings

### room_players Table Updates

```sql
ALTER TABLE room_players 
ADD COLUMN team_id INTEGER CHECK (team_id IN (0, 1) OR team_id IS NULL);
ADD COLUMN is_spectator BOOLEAN DEFAULT false;
ADD COLUMN slot_type TEXT DEFAULT 'player' 
  CHECK (slot_type IN ('player', 'ai', 'spectator', 'empty'));
ADD COLUMN ai_difficulty TEXT 
  CHECK (ai_difficulty IN ('easy', 'normal', 'hard') OR ai_difficulty IS NULL);
ADD COLUMN player_color TEXT;
```

**Fields:**
- `team_id`: Team assignment (0, 1, or null for spectators)
- `is_spectator`: Quick flag for spectator status
- `slot_type`: Slot configuration
  - `'player'`: Human player
  - `'ai'`: AI opponent
  - `'spectator'`: Observer only
  - `'empty'`: Unused slot
- `ai_difficulty`: AI skill level for AI slots
- `player_color`: Custom hex color code

### matchmaking_queue Table

```sql
CREATE TABLE matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    mmr INTEGER NOT NULL,
    game_mode TEXT NOT NULL CHECK (game_mode IN ('1v1', '2v2')),
    faction TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'searching' 
      CHECK (status IN ('searching', 'matched', 'cancelled'))
);
```

**Purpose:** Manages matchmaking queue for ranked play

**Fields:**
- `player_id`: Unique player identifier
- `username`: Display name
- `mmr`: Player's rating for the game mode
- `game_mode`: Which queue (1v1 or 2v2)
- `faction`: Preferred faction
- `joined_at`: Queue entry timestamp
- `status`: Current state

## Configuration

### Environment Variables

Required for multiplayer features:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

Set these in:
- `.env` file for local development
- GitHub Actions secrets for deployment
- Webpack DefinePlugin injects them at build time

### Supabase Configuration

File: `src/supabase-config.ts`

```typescript
export function getSupabaseConfig() {
    return {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || ''
    };
}

export function isSupabaseConfigured(): boolean {
    const config = getSupabaseConfig();
    return config.url !== '' && config.anonKey !== '';
}
```

## Usage Examples

### Creating a Custom Lobby

```typescript
const networkManager = new OnlineNetworkManager(playerId);
const lobby = await networkManager.createCustomLobby(
    "My 2v2 Game", 
    "PlayerName"
);

if (lobby) {
    console.log("Lobby created:", lobby.id);
    // Navigate to lobby detail screen
}
```

### Joining a Lobby

```typescript
const success = await networkManager.joinRoom(
    lobbyId, 
    "PlayerName"
);

if (success) {
    // Joined successfully, update UI
    const players = await networkManager.getRoomPlayers();
    // Display players in lobby
}
```

### Starting Matchmaking

```typescript
const mmrData = getPlayerMMRData();
const success = await networkManager.joinMatchmakingQueue(
    username,
    mmrData.mmr2v2,
    selectedFaction
);

if (success) {
    // Start polling for matches or subscribe to updates
    setInterval(async () => {
        const candidates = await networkManager.findMatchmakingCandidates(
            mmrData.mmr2v2
        );
        
        if (candidates.length >= 3) {
            // Found enough players, create match
            await createMatchFromCandidates(candidates);
        }
    }, 5000); // Poll every 5 seconds
}
```

### Managing Teams in Lobby

```typescript
// Host assigns player to team 1
await networkManager.setPlayerTeam(playerId, 1);

// Set a slot to AI with normal difficulty
await networkManager.setSlotType(aiSlotId, 'ai');
await networkManager.setAIDifficulty(aiSlotId, 'normal');

// Player sets their faction
await networkManager.setPlayerFaction('RADIANT');

// Player sets their color
await networkManager.setPlayerColor('#66B3FF');
```

## Error Handling

### Common Errors

**Supabase Not Configured**
```typescript
if (!networkManager.isAvailable()) {
    alert('Online features require Supabase configuration');
    return;
}
```

**Room Full**
```typescript
const success = await networkManager.joinRoom(lobbyId, username);
if (!success) {
    // Could be full, already started, or doesn't exist
    alert('Failed to join lobby');
}
```

**Not Host**
```typescript
if (!networkManager.isRoomHost()) {
    alert('Only the host can modify lobby settings');
    return;
}
```

## Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with policies:

1. **game_rooms**: 
   - Anyone can view waiting rooms
   - Only host can update/delete
   - Anyone can create

2. **room_players**:
   - Players in room can view members
   - Players can join (insert themselves)
   - Players can update their own record
   - Players can leave (delete themselves)

3. **matchmaking_queue**:
   - Anyone can view searching players
   - Players can join/leave queue
   - Players can only update their own entry

### Anonymous Access

Development mode uses anonymous access:
- Suitable for beta testing
- No authentication required
- Less secure

Production should use:
- Supabase Auth for user management
- JWT-based policies
- Proper user identification

## Performance

### Optimization Tips

1. **Batch Operations**: Use room updates sparingly
2. **Polling Intervals**: Don't poll faster than 5 seconds
3. **Cleanup**: Run cleanup function hourly via cron
4. **Indexes**: Migration adds all necessary indexes

### Cleanup Function

Automatically removes old data:
```sql
SELECT cleanup_old_rooms();
```

Cleans up:
- Finished games older than 1 hour
- Stale matchmaking entries (10+ minutes)
- Cancelled queue entries (5+ minutes)

Set up cron job in Supabase:
```sql
SELECT cron.schedule(
    'cleanup-matches', 
    '0 * * * *', 
    'SELECT cleanup_old_rooms();'
);
```

## Testing

### Local Testing

1. Set up Supabase project
2. Run migration SQL
3. Configure environment variables
4. Build project: `npm run build`
5. Test lobby creation/joining

### Integration Testing

Test scenarios:
- [ ] Create custom lobby
- [ ] Join existing lobby
- [ ] List available lobbies
- [ ] Set team assignments
- [ ] Configure AI slots
- [ ] Join matchmaking queue
- [ ] Find matching players
- [ ] Leave queue

## Troubleshooting

### Lobby Not Appearing

Check:
1. Room status is 'waiting'
2. Game mode is 'custom' or '2v2'
3. RLS policies allow viewing
4. Database connection is active

### Can't Join Queue

Check:
1. Player not already in queue (UNIQUE constraint)
2. MMR value is valid integer
3. Game mode is correct
4. RLS policies allow insert

### Team Assignment Fails

Check:
1. User is host (isRoomHost() returns true)
2. Player exists in room
3. Team ID is 0 or 1
4. Room is in 'waiting' status

## Next Steps

After backend implementation:

1. **Lobby Detail Screen**
   - Visual team slot management
   - Drag-and-drop player assignment
   - Real-time player status updates

2. **Real-Time Updates**
   - Supabase Realtime subscriptions
   - Live player join/leave notifications
   - Team changes broadcast

3. **Match Creation**
   - Convert matched players to game
   - Initialize 4-player game state
   - Assign team IDs and positions

4. **Game Integration**
   - Support 4-player initialization
   - Team-aware rendering
   - Network sync for 4 players

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [2v2 Implementation Summary](./2V2_IMPLEMENTATION_SUMMARY.md)
