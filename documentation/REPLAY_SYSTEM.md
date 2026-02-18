# Replay System Documentation

## Overview

The SoL replay system allows you to record and playback matches. Replays are deterministic, meaning the same replay will always produce the same result.

## Features

- **Automatic Recording**: All games are automatically recorded when you play
- **Local Storage**: Replays are saved to browser's local storage
- **File Export**: Replays are automatically downloaded as JSON files when a game ends
- **Deterministic Playback**: Uses the same RNG seed to guarantee identical results

## How It Works

### Recording

When you start a game, the replay recorder:
1. Records the game seed (for deterministic RNG)
2. Records player information (names, factions)
3. Records map information (forge positions, mirror positions, suns)
4. Records every command issued during gameplay

### Playback

To play back a replay:
1. Load the replay data (from file or storage)
2. Create a ReplayPlayer with the data
3. The replay player recreates the game state from scratch
4. Commands are executed in the exact order they were recorded

## Using Replays

### Accessing Recorded Replays

Replays are automatically saved in two ways:

1. **Local Storage**: Saved with key format `sol_replay_match_{timestamp}`
2. **File Download**: Automatically downloaded as `sol_replay_match_{timestamp}.json`

### Loading a Replay (Console)

You can load and play replays using the browser console:

```javascript
// 1. Import replay functions (available in browser console)
const { loadReplayFromStorage, uploadReplay, ReplayPlayer } = window;

// 2. List available replays in storage
const replays = listReplaysInStorage();
console.log('Available replays:', replays);

// 3. Load a replay from storage
const replayData = loadReplayFromStorage(replays[0]);

// 4. Create a replay player
const replayPlayer = new ReplayPlayer(replayData);

// 5. Initialize and start playback
const game = replayPlayer.initializeGame();
replayPlayer.play();

// 6. Update in game loop (call repeatedly)
replayPlayer.update(16.67); // 60 FPS = 16.67ms per frame
```

### Loading from File

To load a replay from a JSON file:

```javascript
// Using file input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    const replayData = await uploadReplay(file);
    const replayPlayer = new ReplayPlayer(replayData);
    // ... use replay player
};
fileInput.click();
```

## Replay File Format

Replays are saved as JSON with the following structure:

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": 1234567890000,
    "seed": 12345,
    "duration": 120.5,
    "players": [
      {
        "playerId": "p1",
        "playerName": "Player-1",
        "faction": "RADIANT",
        "isLocal": true
      }
    ],
    "gameMode": "singleplayer",
    "mapInfo": {
      "forgePositions": [...],
      "mirrorPositions": [...],
      "suns": [...]
    }
  },
  "commands": [
    {
      "tick": 0,
      "playerId": "p1",
      "command": "mirror_move",
      "data": {
        "mirrorIndices": [0],
        "targetX": 100,
        "targetY": 50,
        "moveOrder": 1
      }
    }
  ]
}
```

## Command Types

The following commands are recorded:

- `mirror_move` - Move solar mirrors
- `mirror_link` - Link mirrors to structures
- `unit_move` - Move units
- `unit_path` - Set unit paths
- `unit_ability` - Use unit abilities
- `building_purchase` - Purchase buildings
- `hero_purchase` - Purchase heroes
- `forge_move` - Move stellar forge
- `foundry_*_upgrade` - Foundry upgrades
- `starling_merge` - Merge starlings
- `unit_target_structure` - Target structures
- `set_rally_path` - Set rally paths

## Technical Details

### Determinism

The replay system ensures determinism by:
1. Using a seeded RNG (Mulberry32 algorithm)
2. Recording and replaying all commands in tick order
3. Processing commands at fixed timesteps
4. Not relying on system time or external state

### Performance

- Replay files are typically small (< 1MB for most games)
- Playback speed can be adjusted (0.5x, 1x, 2x, 4x)
- No significant performance impact during recording

## Future Enhancements

Planned features:
- [ ] UI for browsing replays
- [ ] Replay viewer with controls (play/pause/speed/seek)
- [ ] Replay analysis tools
- [ ] Sharing replays with other players
- [ ] Replay highlighting (key moments)
- [ ] Replay comparison (different strategies)

## Troubleshooting

### Replay doesn't match original game

This shouldn't happen if:
- The replay file is not corrupted
- No code changes were made between recording and playback
- The same game version is used

### Replay file is too large

Replays only store commands, not game state, so they should be small.
If the file is large:
- Check if there are excessive commands being recorded
- Consider compressing the JSON file

### Cannot load replay

Make sure:
- The JSON file is valid
- The replay format version matches
- Browser has sufficient permissions for local storage
