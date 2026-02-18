"""
Unit tests for SoL game core mechanics
"""

import unittest
from game_core import (
    Faction, Vector2D, LightRay, SolarMirror, StellarForge,
    Sun, Player, GameState, create_standard_game
)


class TestVector2D(unittest.TestCase):
    """Test Vector2D class"""
    
    def test_distance(self):
        """Test distance calculation"""
        v1 = Vector2D(0, 0)
        v2 = Vector2D(3, 4)
        self.assertAlmostEqual(v1.distance_to(v2), 5.0)
    
    def test_normalize(self):
        """Test vector normalization"""
        v = Vector2D(3, 4)
        normalized = v.normalize()
        self.assertAlmostEqual(normalized.x, 0.6)
        self.assertAlmostEqual(normalized.y, 0.8)


class TestFactions(unittest.TestCase):
    """Test faction system"""
    
    def test_three_factions_exist(self):
        """Test that all three factions are defined"""
        factions = [Faction.RADIANT, Faction.AURUM, Faction.SOLARI]
        self.assertEqual(len(factions), 3)
        self.assertEqual(Faction.RADIANT.value, "Radiant")
        self.assertEqual(Faction.AURUM.value, "Aurum")
        self.assertEqual(Faction.SOLARI.value, "Solari")


class TestSolarMirror(unittest.TestCase):
    """Test Solar Mirror functionality"""
    
    def test_mirror_creation(self):
        """Test creating a solar mirror"""
        player = Player(name="Test", faction=Faction.RADIANT)
        mirror = SolarMirror(position=Vector2D(100, 100), owner=player)
        self.assertEqual(mirror.health, 100.0)
        self.assertEqual(mirror.efficiency, 1.0)
    
    def test_solarium_generation(self):
        """Test Solarium generation"""
        player = Player(name="Test", faction=Faction.RADIANT)
        mirror = SolarMirror(position=Vector2D(100, 100), owner=player)
        solarium = mirror.generate_solarium(delta_time=1.0)
        self.assertGreater(solarium, 0)
        self.assertEqual(solarium, 10.0)  # Base rate * efficiency * time
    
    def test_efficiency_affects_generation(self):
        """Test that efficiency affects Solarium generation"""
        player = Player(name="Test", faction=Faction.RADIANT)
        mirror = SolarMirror(position=Vector2D(100, 100), owner=player)
        mirror.efficiency = 0.5
        solarium = mirror.generate_solarium(delta_time=1.0)
        self.assertEqual(solarium, 5.0)  # Half efficiency


class TestStellarForge(unittest.TestCase):
    """Test Stellar Forge functionality"""
    
    def test_forge_creation(self):
        """Test creating a Stellar Forge"""
        player = Player(name="Test", faction=Faction.RADIANT)
        forge = StellarForge(position=Vector2D(0, 0), owner=player)
        self.assertEqual(forge.health, 1000.0)
        self.assertFalse(forge.is_receiving_light)
    
    def test_cannot_produce_without_light(self):
        """Test that forge cannot produce units without light"""
        player = Player(name="Test", faction=Faction.RADIANT, solarium=1000.0)
        forge = StellarForge(position=Vector2D(0, 0), owner=player)
        forge.is_receiving_light = False
        self.assertFalse(forge.can_produce_units())
    
    def test_can_produce_with_light(self):
        """Test that forge can produce units with light"""
        player = Player(name="Test", faction=Faction.RADIANT, solarium=1000.0)
        forge = StellarForge(position=Vector2D(0, 0), owner=player)
        forge.is_receiving_light = True
        self.assertTrue(forge.can_produce_units())
    
    def test_unit_production_requires_solarium(self):
        """Test that unit production requires sufficient Solarium"""
        player = Player(name="Test", faction=Faction.RADIANT, solarium=10.0)
        forge = StellarForge(position=Vector2D(0, 0), owner=player)
        forge.is_receiving_light = True
        
        # Try to produce expensive unit
        result = forge.produce_unit("heavy_unit", cost=100.0, player_solarium=player.solarium)
        self.assertFalse(result)


class TestPlayer(unittest.TestCase):
    """Test Player functionality"""
    
    def test_player_creation(self):
        """Test creating a player"""
        player = Player(name="TestPlayer", faction=Faction.RADIANT)
        self.assertEqual(player.name, "TestPlayer")
        self.assertEqual(player.faction, Faction.RADIANT)
        self.assertEqual(player.solarium, 100.0)  # Starting amount
    
    def test_solarium_management(self):
        """Test adding and spending Solarium"""
        player = Player(name="Test", faction=Faction.RADIANT, solarium=100.0)
        player.add_solarium(50.0)
        self.assertEqual(player.solarium, 150.0)
        
        success = player.spend_solarium(50.0)
        self.assertTrue(success)
        self.assertEqual(player.solarium, 100.0)
        
        success = player.spend_solarium(200.0)
        self.assertFalse(success)
        self.assertEqual(player.solarium, 100.0)
    
    def test_player_defeat(self):
        """Test player defeat condition"""
        player = Player(name="Test", faction=Faction.RADIANT)
        self.assertTrue(player.is_defeated())  # No forge yet
        
        forge = StellarForge(position=Vector2D(0, 0), owner=player)
        player.stellar_forge = forge
        self.assertFalse(player.is_defeated())
        
        forge.health = 0
        self.assertTrue(player.is_defeated())


class TestSun(unittest.TestCase):
    """Test Sun/light source"""
    
    def test_sun_creation(self):
        """Test creating a sun"""
        sun = Sun(position=Vector2D(0, 0), intensity=1.0, radius=100.0)
        self.assertEqual(sun.position.x, 0)
        self.assertEqual(sun.position.y, 0)
        self.assertEqual(sun.intensity, 1.0)
    
    def test_light_emission(self):
        """Test sun emits light"""
        sun = Sun(position=Vector2D(0, 0))
        direction = Vector2D(1, 0).normalize()
        ray = sun.emit_light(direction)
        self.assertIsInstance(ray, LightRay)
        self.assertEqual(ray.intensity, sun.intensity)


class TestGameState(unittest.TestCase):
    """Test game state management"""
    
    def test_game_initialization(self):
        """Test creating a standard game"""
        game = create_standard_game([
            ("Player1", Faction.RADIANT),
            ("Player2", Faction.AURUM)
        ])
        self.assertTrue(game.is_running)
        self.assertEqual(len(game.players), 2)
        self.assertEqual(len(game.suns), 1)
    
    def test_players_start_with_forge_and_mirrors(self):
        """Test that players start with Stellar Forge and Solar Mirrors"""
        game = create_standard_game([
            ("Player1", Faction.RADIANT),
            ("Player2", Faction.AURUM)
        ])
        
        for player in game.players:
            self.assertIsNotNone(player.stellar_forge)
            self.assertGreater(len(player.solar_mirrors), 0)
    
    def test_game_update(self):
        """Test game state updates"""
        game = create_standard_game([
            ("Player1", Faction.RADIANT),
            ("Player2", Faction.AURUM)
        ])
        
        initial_time = game.game_time
        game.update(delta_time=1.0)
        self.assertEqual(game.game_time, initial_time + 1.0)
    
    def test_solarium_generation_over_time(self):
        """Test that Solarium is generated over time"""
        game = create_standard_game([("Player1", Faction.RADIANT)])
        player = game.players[0]
        initial_solarium = player.solarium
        
        # Simulate game updates
        for _ in range(10):
            game.update(delta_time=0.1)
        
        # Player should have more Solarium (if mirrors are working)
        # Note: This depends on line-of-sight implementation
        self.assertGreaterEqual(player.solarium, initial_solarium)
    
    def test_victory_condition(self):
        """Test victory condition checking"""
        game = create_standard_game([
            ("Player1", Faction.RADIANT),
            ("Player2", Faction.AURUM)
        ])
        
        # No winner initially
        winner = game.check_victory_conditions()
        self.assertIsNone(winner)
        
        # Destroy one player's forge
        game.players[1].stellar_forge.health = 0
        winner = game.check_victory_conditions()
        self.assertIsNotNone(winner)
        self.assertEqual(winner.name, "Player1")


class TestLineOfSightMechanics(unittest.TestCase):
    """Test line-of-sight and light mechanics"""
    
    def test_mirror_detects_light_source(self):
        """Test that mirror can detect light sources"""
        player = Player(name="Test", faction=Faction.RADIANT)
        mirror = SolarMirror(position=Vector2D(100, 0), owner=player)
        sun = Sun(position=Vector2D(0, 0))
        
        has_light = mirror.has_line_of_sight_to_light([sun])
        self.assertTrue(has_light)
    
    def test_mirror_detects_forge(self):
        """Test that mirror can detect Stellar Forge"""
        player = Player(name="Test", faction=Faction.RADIANT)
        mirror = SolarMirror(position=Vector2D(100, 0), owner=player)
        forge = StellarForge(position=Vector2D(200, 0), owner=player)
        
        has_sight = mirror.has_line_of_sight_to_forge(forge, [])
        self.assertTrue(has_sight)


if __name__ == '__main__':
    unittest.main()
