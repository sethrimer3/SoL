# LAN Play Implementation

## Overview

SoL now supports local area network (LAN) multiplayer using WebRTC peer-to-peer connections. This allows two players on the same local network (or with direct connectivity) to play against each other without requiring a central server.

## How It Works

### Technology Stack

- **WebRTC Data Channels**: Provides peer-to-peer communication between players
- **Copy-Paste Signaling**: Simple connection establishment using base64-encoded connection codes
- **Deterministic Game State**: Ensures synchronized gameplay across both clients

### Architecture

1. **Network Module** (`src/network.ts`):
   - `NetworkManager`: Manages peer connections and game state synchronization
   - `PeerConnection`: Handles individual WebRTC connections
   - `LANSignaling`: Manages connection code generation and parsing

2. **Game Integration** (`src/menu.ts`):
   - LAN menu screen with host/join options
   - Lobby system for connection setup
   - Integration with game settings

## User Flow

### For Host (Player 1)

1. Click **"HOST SERVER"** from the LAN Play menu
2. A connection code is generated and displayed
3. Share this connection code with the other player (via chat, email, etc.)
4. Paste the answer code received from the client
5. Click **"CONNECT"** to establish the connection
6. Click **"START GAME"** when ready

### For Client (Player 2)

1. Click **"JOIN SERVER"** from the LAN Play menu
2. Paste the connection code received from the host
3. An answer code is generated
4. Send this answer code back to the host
5. Wait for the host to start the game

## Current Implementation Status

### ✅ Completed

- WebRTC peer-to-peer connection infrastructure
- Connection code-based signaling mechanism
- LAN menu UI with host/join flows
- Lobby system for connection setup
- Network manager integration with game settings
- Basic message passing infrastructure
- Game state command replication system
- Network command queue and processing
- Command execution for player actions (unit movement, abilities, hero purchase, etc.)
- Local player command capture and dispatch to peers
- Host/Client player assignment
- Network manager integration with game core

### 🚧 In Progress / TODO

- Latency compensation and prediction
- Reconnection handling
- Player ready state management
- In-game network statistics display
- Game state validation and anti-cheat
- State hash synchronization for desync detection

## Technical Details

### Connection Establishment

The connection process uses a manual signaling mechanism:

1. **Host** generates an SDP offer and encodes it as a connection code
2. **Client** decodes the offer and generates an SDP answer code
3. **Host** decodes and applies the answer to complete the WebRTC connection
4. **ICE candidates** are exchanged through the same mechanism

### Message Types

The network protocol supports the following message types:

- `GAME_COMMAND`: Player actions to be replicated (movement, abilities, purchases)
- `GAME_STATE`: Full game state synchronization (future enhancement)
- `PLAYER_JOIN`: New player joining the lobby
- `PLAYER_LEAVE`: Player leaving the lobby
- `LOBBY_UPDATE`: Lobby state changes
- `GAME_START`: Game start signal
- `PING`/`PONG`: Connection health checks

### Game Command Replication

The implementation uses a command replication system for game state synchronization:

1. **Command Queue**: Each game instance maintains a `pendingCommands` queue for incoming network commands
2. **Command Processing**: Commands are processed at the start of each game update tick, ensuring deterministic execution
3. **Supported Commands**:
   - `unit_move`: Move units to target position
   - `unit_ability`: Activate unit ability in specified direction
   - `unit_path`: Assign a multi-waypoint path to units
   - `hero_purchase`: Queue hero unit production at forge
   - `building_purchase`: Place building at position
   - `mirror_purchase`: Build new solar mirror
   - `mirror_move`: Move selected solar mirrors to a target
   - `mirror_link`: Link selected solar mirrors to a forge or building
   - `forge_move`: Set forge target position
   - `set_rally_path`: Set minion spawn path

4. **Player Assignment**:
   - Host player is always Player 0 (bottom-left spawn)
   - Client player is always Player 1 (top-right spawn)
   - Each client only controls their assigned player
   - AI is disabled for both players in LAN mode

### Future Enhancements

1. **Automated Discovery**: Local network server discovery using mDNS/Bonjour
2. **NAT Traversal**: TURN server support for connections behind strict NATs
3. **More Players**: Support for 3+ player games
4. **Spectator Mode**: Allow observers to watch LAN games
5. **Save/Resume**: Ability to save and resume LAN games

## Known Limitations

1. **Manual Signaling**: Players must exchange connection codes manually
2. **Two Players Only**: Current implementation supports 1v1 only
3. **No Reconnection**: Disconnections require restarting the game
4. **Basic Validation**: Limited protection against desyncs

## Development Notes

### Testing LAN Play Locally

To test LAN play on a single machine:

1. Open two browser windows
2. In one window, host a game and copy the connection code
3. In the other window, join using the connection code
4. Exchange answer codes between windows
5. Start the game from the host window

### Debug Information

Enable console logging to see network events:

```javascript
// In browser console
localStorage.setItem('debug-network', 'true');
```

This will show:
- Connection state changes
- Message send/receive events
- ICE candidate exchanges
- Connection health metrics

## Contributing

When contributing to LAN play features:

1. Ensure changes maintain deterministic game state
2. Test with artificial latency (Chrome DevTools Network throttling)
3. Verify no state desyncs occur during gameplay
4. Update this documentation for new features
5. Add appropriate error handling for network issues

## References

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Architecture Document](./ARCHITECTURE.md) - Game state synchronization details
- [Game Design Document](./GAME_DESIGN.md) - Core gameplay mechanics
