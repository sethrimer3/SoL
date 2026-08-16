# Online Play Summary

SoL uses Colyseus for all online multiplayer communication:
- Client connects to Colyseus WebSocket server (`ws://localhost:2567` default)
- Server manages rooms (`SoLRoom`), assigns match codes, and relays game commands
- Clients run deterministic lockstep simulation with seeded RNG
