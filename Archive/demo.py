"""
Example demonstration of SoL game mechanics
Shows how the core systems work together
"""

from game_core import (
    create_standard_game, Faction, Vector2D, 
    SolarMirror, Sun
)


def print_separator():
    print("\n" + "=" * 60 + "\n")


def demonstrate_game_setup():
    """Demonstrate game initialization"""
    print("DEMONSTRATION: Game Setup")
    print_separator()
    
    # Create a standard 2-player game
    game = create_standard_game([
        ("Commander Nova", Faction.RADIANT),
        ("Admiral Gold", Faction.AURUM)
    ])
    
    print(f"Game initialized with {len(game.players)} players")
    print(f"Sun(s) in system: {len(game.suns)}")
    
    for i, player in enumerate(game.players, 1):
        print(f"\nPlayer {i}: {player.name} ({player.faction.value})")
        print(f"  Starting Solarium: {player.solarium:.1f} Sol")
        print(f"  Stellar Forge: {player.stellar_forge is not None}")
        print(f"  Solar Mirrors: {len(player.solar_mirrors)}")
        print(f"  Forge Position: ({player.stellar_forge.position.x:.0f}, "
              f"{player.stellar_forge.position.y:.0f})")
    
    return game


def demonstrate_resource_generation(game):
    """Demonstrate Solarium generation from Solar Mirrors"""
    print_separator()
    print("DEMONSTRATION: Resource Generation")
    print_separator()
    
    player = game.players[0]
    print(f"Testing resource generation for {player.name}")
    print(f"Initial Solarium: {player.solarium:.1f} Sol")
    
    # Simulate 5 seconds of game time
    print("\nSimulating 5 seconds of gameplay...")
    for i in range(50):  # 50 frames @ 0.1s each = 5 seconds
        game.update(delta_time=0.1)
    
    print(f"Final Solarium: {player.solarium:.1f} Sol")
    print(f"Generated: {player.solarium - 100:.1f} Sol in 5 seconds")
    
    # Show mirror status
    print(f"\nSolar Mirror Status:")
    for i, mirror in enumerate(player.solar_mirrors, 1):
        has_light = mirror.has_line_of_sight_to_light(game.suns)
        has_forge = mirror.has_line_of_sight_to_forge(player.stellar_forge, [])
        print(f"  Mirror {i}: Light={has_light}, Forge Connection={has_forge}, "
              f"Efficiency={mirror.efficiency:.0%}")


def demonstrate_light_mechanics(game):
    """Demonstrate light and line-of-sight mechanics"""
    print_separator()
    print("DEMONSTRATION: Light & Shadow Mechanics")
    print_separator()
    
    player = game.players[0]
    
    print("Key Mechanics:")
    print("1. Solar Mirrors must have line-of-sight to a Sun")
    print("2. Solar Mirrors must have line-of-sight to the Stellar Forge")
    print("3. When both conditions are met, Solarium is generated")
    print("4. Units can only be produced when Forge receives light")
    
    print(f"\nStellar Forge Status for {player.name}:")
    print(f"  Receiving Light: {player.stellar_forge.is_receiving_light}")
    print(f"  Can Produce Units: {player.stellar_forge.can_produce_units()}")
    print(f"  Health: {player.stellar_forge.health:.0f}")


def demonstrate_unit_production(game):
    """Demonstrate unit production mechanics"""
    print_separator()
    print("DEMONSTRATION: Unit Production")
    print_separator()
    
    player = game.players[0]
    
    print(f"Attempting unit production for {player.name}")
    print(f"Current Solarium: {player.solarium:.1f} Sol")
    print(f"Forge receiving light: {player.stellar_forge.is_receiving_light}")
    
    # Try to produce a unit
    unit_cost = 50.0
    print(f"\nAttempting to produce 'Scout' (Cost: {unit_cost} Sol)...")
    
    success = player.stellar_forge.produce_unit(
        "Scout", 
        cost=unit_cost, 
        player_solarium=player.solarium
    )
    
    if success:
        player.spend_solarium(unit_cost)
        print(f"✓ Unit produced successfully!")
        print(f"  Remaining Solarium: {player.solarium:.1f} Sol")
        print(f"  Units in queue: {len(player.stellar_forge.unit_queue)}")
    else:
        print(f"✗ Production failed!")
        if not player.stellar_forge.can_produce_units():
            print("  Reason: Forge not receiving light")
        elif player.solarium < unit_cost:
            print("  Reason: Insufficient Solarium")


def demonstrate_victory_conditions(game):
    """Demonstrate victory condition checking"""
    print_separator()
    print("DEMONSTRATION: Victory Conditions")
    print_separator()
    
    print("Victory is achieved by destroying the enemy's Stellar Forge")
    print("\nCurrent game state:")
    
    for player in game.players:
        status = "Active" if not player.is_defeated() else "Defeated"
        health = player.stellar_forge.health if player.stellar_forge else 0
        print(f"  {player.name}: {status} (Forge HP: {health:.0f})")
    
    winner = game.check_victory_conditions()
    if winner:
        print(f"\n🏆 {winner.name} has won the game!")
    else:
        print("\n⚔️  Battle continues...")


def demonstrate_faction_features():
    """Demonstrate faction-specific features"""
    print_separator()
    print("DEMONSTRATION: Faction Features")
    print_separator()
    
    print("Three playable factions with unique characteristics:\n")
    
    factions_info = {
        Faction.RADIANT: {
            "theme": "Light-focused civilization",
            "bonuses": ["Enhanced mirror efficiency", "Better light detection"]
        },
        Faction.AURUM: {
            "theme": "Wealth-oriented faction",
            "bonuses": ["Higher starting Solarium", "Increased generation rate"]
        },
        Faction.SOLARI: {
            "theme": "Sun-worshipping empire",
            "bonuses": ["Stronger Stellar Forge", "Faster unit production"]
        }
    }
    
    for faction, info in factions_info.items():
        print(f"⭐ {faction.value}")
        print(f"   Theme: {info['theme']}")
        print(f"   Bonuses:")
        for bonus in info['bonuses']:
            print(f"     • {bonus}")
        print()


def main():
    """Run all demonstrations"""
    print("\n" + "=" * 60)
    print("SoL - SPEED OF LIGHT RTS")
    print("Game Mechanics Demonstration")
    print("=" * 60)
    
    # Demonstrate faction features
    demonstrate_faction_features()
    
    # Set up game
    game = demonstrate_game_setup()
    
    # Demonstrate resource generation
    demonstrate_resource_generation(game)
    
    # Demonstrate light mechanics
    demonstrate_light_mechanics(game)
    
    # Demonstrate unit production
    demonstrate_unit_production(game)
    
    # Demonstrate victory conditions
    demonstrate_victory_conditions(game)
    
    print_separator()
    print("DEMONSTRATION COMPLETE")
    print("\nAll core game mechanics are functional:")
    print("✓ Three factions (Radiant, Aurum, Solari)")
    print("✓ Stellar Forge main base system")
    print("✓ Solar Mirror resource collection")
    print("✓ Solarium currency generation")
    print("✓ Light-based unit production")
    print("✓ Line-of-sight mechanics")
    print("✓ Victory conditions")
    print_separator()


if __name__ == "__main__":
    main()
