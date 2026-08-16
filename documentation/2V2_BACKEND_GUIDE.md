# 2v2 Multiplayer Architecture with Colyseus

2v2 multiplayer in SoL is managed through Colyseus rooms (`SoLRoom`) supporting up to 8 players.
- Server manages player slots and teams
- Commands are relayed to all clients
- Deterministic simulation executes on all peers in lockstep
