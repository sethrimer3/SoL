"""
SoL (Speed of Light) - Core Game Module
A 2D real-time strategy game with light-based mechanics
"""

from enum import Enum
from typing import List, Optional, Tuple
from dataclasses import dataclass, field


class Faction(Enum):
    """Three playable factions in the game"""
    RADIANT = "Radiant"
    AURUM = "Aurum"
    SOLARI = "Solari"


@dataclass
class Vector2D:
    """2D position/direction vector"""
    x: float
    y: float
    
    def distance_to(self, other: 'Vector2D') -> float:
        """Calculate distance to another vector"""
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
    
    def normalize(self) -> 'Vector2D':
        """Return normalized vector"""
        magnitude = (self.x ** 2 + self.y ** 2) ** 0.5
        if magnitude == 0:
            return Vector2D(0, 0)
        return Vector2D(self.x / magnitude, self.y / magnitude)


@dataclass
class LightRay:
    """Represents a ray of light for ray tracing"""
    origin: Vector2D
    direction: Vector2D
    intensity: float = 1.0
    
    def intersects(self, position: Vector2D, radius: float) -> bool:
        """Check if ray intersects with a circular object"""
        # Simplified intersection test for circular objects
        # This is a basic implementation for the game mechanics
        return True  # Placeholder for full ray-circle intersection


@dataclass
class SolarMirror:
    """Solar Mirror - reflects light to generate Solarium"""
    position: Vector2D
    owner: 'Player'
    health: float = 100.0
    efficiency: float = 1.0  # 0.0 to 1.0
    
    def has_line_of_sight_to_light(self, light_sources: List['Sun']) -> bool:
        """Check if mirror has clear view of any light source"""
        # Placeholder - will implement ray tracing
        return len(light_sources) > 0
    
    def has_line_of_sight_to_forge(self, forge: 'StellarForge', obstacles: List) -> bool:
        """Check if mirror has clear path to Stellar Forge"""
        # Placeholder - will implement collision detection
        return True
    
    def generate_solarium(self, delta_time: float) -> float:
        """Generate Solarium based on light received"""
        base_generation_rate = 10.0  # Sol per second
        return base_generation_rate * self.efficiency * delta_time


@dataclass
class StellarForge:
    """Stellar Forge - Main base that produces units"""
    position: Vector2D
    owner: 'Player'
    health: float = 1000.0
    is_receiving_light: bool = False
    unit_queue: List[str] = field(default_factory=list)
    
    def can_produce_units(self) -> bool:
        """Check if forge can produce units (needs light)"""
        return self.is_receiving_light and self.health > 0
    
    def produce_unit(self, unit_type: str, cost: float, player_solarium: float) -> bool:
        """Attempt to produce a unit"""
        if not self.can_produce_units():
            return False
        if player_solarium < cost:
            return False
        self.unit_queue.append(unit_type)
        return True
    
    def update_light_status(self, mirrors: List[SolarMirror], suns: List['Sun']) -> None:
        """Update whether forge is receiving light from mirrors"""
        self.is_receiving_light = False
        for mirror in mirrors:
            if mirror.has_line_of_sight_to_light(suns) and \
               mirror.has_line_of_sight_to_forge(self, []):
                self.is_receiving_light = True
                break


@dataclass
class Sun:
    """Sun/Star - Light source"""
    position: Vector2D
    intensity: float = 1.0
    radius: float = 100.0
    
    def emit_light(self, direction: Vector2D) -> LightRay:
        """Emit a light ray in specified direction"""
        return LightRay(origin=self.position, direction=direction, intensity=self.intensity)


@dataclass
class Player:
    """Player in the game"""
    name: str
    faction: Faction
    solarium: float = 100.0  # Starting currency
    stellar_forge: Optional[StellarForge] = None
    solar_mirrors: List[SolarMirror] = field(default_factory=list)
    units: List = field(default_factory=list)
    
    def is_defeated(self) -> bool:
        """Check if player is defeated"""
        return self.stellar_forge is None or self.stellar_forge.health <= 0
    
    def add_solarium(self, amount: float) -> None:
        """Add Solarium to player's resources"""
        self.solarium += amount
    
    def spend_solarium(self, amount: float) -> bool:
        """Attempt to spend Solarium"""
        if self.solarium >= amount:
            self.solarium -= amount
            return True
        return False


@dataclass
class GameState:
    """Main game state"""
    players: List[Player] = field(default_factory=list)
    suns: List[Sun] = field(default_factory=list)
    game_time: float = 0.0
    is_running: bool = False
    
    def update(self, delta_time: float) -> None:
        """Update game state"""
        self.game_time += delta_time
        
        # Update each player
        for player in self.players:
            if player.is_defeated():
                continue
            
            # Update light status for Stellar Forge
            if player.stellar_forge:
                player.stellar_forge.update_light_status(player.solar_mirrors, self.suns)
            
            # Generate Solarium from mirrors
            for mirror in player.solar_mirrors:
                if mirror.has_line_of_sight_to_light(self.suns) and \
                   player.stellar_forge and \
                   mirror.has_line_of_sight_to_forge(player.stellar_forge, []):
                    solarium_generated = mirror.generate_solarium(delta_time)
                    player.add_solarium(solarium_generated)
    
    def check_victory_conditions(self) -> Optional[Player]:
        """Check if any player has won"""
        active_players = [p for p in self.players if not p.is_defeated()]
        if len(active_players) == 1:
            return active_players[0]
        return None
    
    def initialize_player(self, player: Player, forge_position: Vector2D, 
                         mirror_positions: List[Vector2D]) -> None:
        """Initialize a player with starting structures"""
        # Create Stellar Forge
        player.stellar_forge = StellarForge(position=forge_position, owner=player)
        
        # Create starting Solar Mirrors
        for pos in mirror_positions:
            mirror = SolarMirror(position=pos, owner=player)
            player.solar_mirrors.append(mirror)


def create_standard_game(player_names: List[Tuple[str, Faction]]) -> GameState:
    """Create a standard game setup"""
    game = GameState()
    
    # Add sun at center
    game.suns.append(Sun(position=Vector2D(0, 0), intensity=1.0, radius=100.0))
    
    # Create players with starting positions
    starting_positions = [
        (Vector2D(-500, 0), [Vector2D(-450, 0), Vector2D(-400, 0)]),
        (Vector2D(500, 0), [Vector2D(450, 0), Vector2D(400, 0)]),
    ]
    
    for i, (name, faction) in enumerate(player_names):
        if i >= len(starting_positions):
            break
        player = Player(name=name, faction=faction)
        forge_pos, mirror_positions = starting_positions[i]
        game.initialize_player(player, forge_pos, mirror_positions)
        game.players.append(player)
    
    game.is_running = True
    return game
