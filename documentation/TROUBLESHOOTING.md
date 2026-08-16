# Troubleshooting Guide

## Multiplayer Troubleshooting

### 1. "Cannot connect to server"
- Ensure the Colyseus game server is running: `npm run server`
- Check that port 2567 is not blocked by local firewall
- If connecting remotely, verify `COLYSEUS_SERVER_URL` is set to the public WebSocket endpoint (`ws://...` or `wss://...`)

### 2. "Match code not found"
- Verify that the host is currently in the lobby
- Ensure the match code (6 characters) was entered correctly
- Rooms are automatically cleaned up when the host leaves

### 3. "Desync detected"
- Ensure both clients are running the exact same version/build of the game
- Check the console for `[StateVerifier] DESYNC detected` logs and verify tick numbers
- In development, ensure simulation logic does not contain `Math.random()`, `Date.now()`, or unseeded floating point differences
