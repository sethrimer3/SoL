# TODO: Future Enhancements for SoL

## Priority 1: Core Gameplay Implementation

### Ray Tracing System
- [ ] Implement full ray-circle intersection in `LightRay.intersects()`
- [ ] Add ray-obstacle collision detection
- [ ] Implement shadow casting from objects
- [ ] Add multiple ray sampling for soft shadows
- [ ] Optimize ray tracing performance for real-time gameplay

### Line-of-Sight System
- [ ] Complete `has_line_of_sight_to_light()` with obstacle checking
- [ ] Complete `has_line_of_sight_to_forge()` with collision detection
- [ ] Add dynamic obstacle list management
- [ ] Implement efficient spatial partitioning for occlusion queries

### Unit System
- [ ] Define unit types (scouts, fighters, capital ships, etc.)
- [ ] Implement unit movement and pathfinding
- [ ] Add unit combat mechanics
- [ ] Create unit AI behaviors
- [ ] Add unit production queues with timing

## Priority 2: Game Features

### Faction-Specific Mechanics
- [ ] Implement Radiant faction bonuses (mirror efficiency +10%, light detection +20%)
- [ ] Implement Aurum faction bonuses (starting sol +50%, generation +10%)
- [ ] Implement Velaris faction bonuses (forge health +20%, production speed +10%)
- [ ] Add unique units for each faction
- [ ] Add faction-specific abilities

### Advanced Structures
- [ ] Add defensive structures (turrets, shields)
- [ ] Add economy structures (upgraded mirrors, power plants)
- [ ] Add support structures (repair stations, radar)
- [ ] Implement structure placement system
- [ ] Add structure upgrade paths

### Multiple Suns
- [ ] Support multiple light sources in solar system
- [ ] Handle complex light/shadow interactions
- [ ] Add strategic positioning around multiple suns
- [ ] Implement binary/trinary star systems

## Priority 3: Multiplayer & Platform

### Networking
- [x] Implement peer-to-peer architecture (WebRTC)
- [x] Add basic LAN lobby system
- [x] Implement connection code signaling
- [x] Add game command synchronization infrastructure
- [x] Integrate network manager with game core
- [x] Add command queue and processing
- [x] Implement command execution for player actions
- [x] Add online play framework with Supabase
- [x] Implement Supabase Realtime integration
- [x] Create room-based matchmaking system
- [x] Add bandwidth-optimized command encoding
- [x] Implement host/client architecture for online
- [ ] Capture and send local player commands from input handlers
- [ ] Add real-time game state validation
- [ ] Handle latency and prediction
- [ ] Implement reconnection handling
- [ ] Add state hash synchronization for desync detection
- [ ] Implement advanced matchmaking system
- [ ] Add player rankings and leaderboards

### Cross-Platform Support
- [ ] Create desktop client (Windows, macOS, Linux)
- [ ] Create mobile client (iOS, Android)
- [ ] Implement touch controls for mobile
- [ ] Add keyboard/mouse controls for desktop
- [ ] Ensure crossplay compatibility

### AI System
- [ ] Implement basic AI opponent
- [ ] Add AI difficulty levels
- [ ] Create AI strategic decision making
- [ ] Add AI economy management
- [ ] Implement AI unit control and tactics

## Priority 4: Polish & Content

### Graphics & Effects
- [ ] Add visual effects for light rays
- [ ] Implement particle systems
- [ ] Add explosion and destruction effects
- [ ] Create unit animations
- [ ] Add UI/HUD design and implementation

### Audio
- [ ] Add sound effects
- [ ] Create faction-themed music
- [ ] Implement ambient space sounds
- [ ] Add voice-overs for units

### Game Modes
- [ ] Campaign mode with story
- [ ] Skirmish mode against AI
- [ ] Multiplayer ranked mode
- [ ] Cooperative mode
- [ ] Custom game settings

### Balance & Testing
- [ ] Playtesting and balance adjustments
- [ ] Performance optimization
- [ ] Bug fixes and stability
- [ ] Tutorial system
- [ ] In-game help and tooltips

## Technical Debt
- [ ] Implement proper vector operations library
- [ ] Add comprehensive error handling
- [ ] Improve code documentation
- [ ] Add performance profiling
- [ ] Set up continuous integration
- [ ] Add integration tests
- [ ] Create benchmarking suite
