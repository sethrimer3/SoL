/**
 * Game constants shared across modules
 */

// Influence and particle constants
export const INFLUENCE_RADIUS = 225;
export const BUILDING_INFLUENCE_RADIUS_MULTIPLIER = 0.75;
export const INFLUENCE_RADIUS_ANIMATION_SPEED_PER_SEC = 0.35;
export const PLAYER_1_COLOR = '#0066FF';
export const PLAYER_2_COLOR = '#FF0000';

// LaD (Light and Darkness) mode constants
// Removed LAD_GOLDEN_OUTLINE - replaced with player/enemy color auras
export const LAD_SUN_OUTLINE_COLOR = '#FFD700'; // Golden outline color for LaD sun circle

// Warp gate constants
export const WARP_GATE_CHARGE_TIME = 6.0; // Total seconds to complete (deprecated, now energy-based)
export const WARP_GATE_ENERGY_REQUIRED = 100; // Total energy needed to mature a warp gate
export const WARP_GATE_INITIAL_DELAY = 1.0; // Seconds before warp gate starts
export const MIRROR_WARP_GATE_HOLD_DURATION_MS = 1000;
export const WARP_GATE_SPIRAL_RADIUS = 200;
export const WARP_GATE_SPIRAL_MIN_DISTANCE = 5;
export const WARP_GATE_SPIRAL_FORCE_RADIAL = 50;
export const WARP_GATE_SPIRAL_FORCE_TANGENT = 20;
export const WARP_GATE_RADIUS = 50;
export const WARP_GATE_BUTTON_RADIUS = 28; // Match hero button size
export const WARP_GATE_BUTTON_OFFSET = 30;
export const WARP_GATE_BUTTON_HIT_RADIUS_PX = 40;
export const WARP_GATE_SHOCKWAVE_MAX_RADIUS_PX = 220;
export const WARP_GATE_SHOCKWAVE_PROGRESS_PER_FRAME = 0.06;
export const WARP_GATE_CANCEL_DECAY_ENERGY_PER_SEC = 220;
export const WARP_GATE_COMPLETION_WINDOW_SEC = 20;

// Particle scatter constants
export const PARTICLE_SCATTER_RADIUS = 150;
export const PARTICLE_SCATTER_FORCE = 200;

// Fluid simulation constants for particle displacement
export const ABILITY_BULLET_EFFECT_RADIUS = 30;
export const ABILITY_BULLET_FORCE_MULTIPLIER = 0.5;
export const MINION_PROJECTILE_EFFECT_RADIUS = 25;
export const MINION_PROJECTILE_FORCE_MULTIPLIER = 0.4;
export const DEFAULT_PROJECTILE_DAMAGE = 5; // Default damage for projectiles with unknown damage values
export const GRAVE_PROJECTILE_EFFECT_RADIUS = 20;
export const GRAVE_PROJECTILE_FORCE_MULTIPLIER = 0.4;
export const INFLUENCE_BALL_EFFECT_RADIUS = 35;
export const INFLUENCE_BALL_FORCE_MULTIPLIER = 0.5;
export const BEAM_EFFECT_RADIUS = 40;
export const BEAM_FORCE_STRENGTH = 300;
export const FLUID_FORWARD_COMPONENT = 0.6; // Forward push component for moving objects
export const FLUID_RADIAL_COMPONENT = 0.4;  // Radial displacement component for moving objects
export const BEAM_ALONG_COMPONENT = 0.7;     // Along beam direction component
export const BEAM_PERPENDICULAR_COMPONENT = 0.3; // Perpendicular push component for beams
export const FLUID_MIN_DISTANCE = 0.1; // Minimum distance to avoid division by zero in fluid calculations
export const SHIELD_CENTER_COLLISION_THRESHOLD = 0.1; // Minimum distance from shield tower center to calculate push direction

// Rendering constants
export const DUST_PARTICLE_SIZE = 1;
export const DUST_PARTICLE_DIAMETER_PX = DUST_PARTICLE_SIZE * 2;
export const SPACE_DUST_PARTICLE_COUNT = 3000;
export const DUST_MIN_VELOCITY = 0.2;
export const DUST_REPULSION_RADIUS_PX = DUST_PARTICLE_DIAMETER_PX;
export const DUST_REPULSION_CELL_SIZE_PX = DUST_PARTICLE_DIAMETER_PX * 4;
export const DUST_REPULSION_STRENGTH = 0.8;
export const DUST_CLUSTER_COUNT = 8;
export const DUST_CLUSTER_RADIUS_PX = 220;
export const DUST_CLUSTER_SPAWN_RATIO = 0.35;
export const DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC = 3;
export const MIRROR_DUST_PUSH_RADIUS_PX = 110;
export const MIRROR_DUST_PUSH_FORCE_MULTIPLIER = 1.1;
export const FORGE_DUST_PUSH_RADIUS_PX = 160;
export const FORGE_DUST_PUSH_FORCE_MULTIPLIER = 0.9;
export const STARLING_DUST_PUSH_RADIUS_PX = 50;
export const STARLING_DUST_PUSH_FORCE_MULTIPLIER = 0.5;
export const DUST_COLOR_IMPACT_HOLD_SEC = 0.08;
export const DUST_COLOR_FADE_IN_SPEED = 7.5;
export const DUST_COLOR_FADE_OUT_SPEED = 1.4;
export const DUST_COLOR_FORCE_SCALE = 35;
export const DUST_SHADOW_MAX_DISTANCE_PX = 420;
export const DUST_SHADOW_FAR_MAX_DISTANCE_PX = 900;
export const DUST_SHADOW_FAR_MIN_INTENSITY = 0.08;
export const DUST_SHADOW_LENGTH_PX = 18;
export const DUST_SHADOW_OPACITY = 0.14;
export const DUST_SHADOW_WIDTH_PX = 0.45;
export const DUST_TRAIL_MIN_SPEED_PX_PER_SEC = 2;
export const DUST_TRAIL_MIN_LENGTH_PX = 2;
export const DUST_TRAIL_MAX_LENGTH_PX = 8;
export const DUST_TRAIL_LENGTH_PER_SPEED = 0.08;
export const DUST_TRAIL_WIDTH_PX = 0.6;
export const DEATH_PARTICLE_SIZE_SCALE = 0.33;
export const DEATH_PARTICLE_DUST_PUSH_RADIUS_PX = 42;
export const DEATH_PARTICLE_DUST_PUSH_FORCE_MULTIPLIER = 0.42;
export const DEATH_PARTICLE_BOUNCE_RESTITUTION = 0.52;
export const DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING = 0.92;

// Screen shake constants
export const SCREEN_SHAKE_DURATION = 0.3; // Duration of screen shake in seconds
export const SCREEN_SHAKE_INTENSITY = 8; // Maximum shake offset in pixels
export const SCREEN_SHAKE_DECAY = 0.9; // Decay rate for shake intensity per frame

// Sprite scaling constants
export const DUST_SPRITE_SCALE_FACTOR = 3;
export const STARLING_SPRITE_SCALE_FACTOR = 6;
export const STARLING_SPRITE_ROTATION_OFFSET_RAD = Math.PI / 2;
export const MOVEMENT_POINT_ANIMATION_FRAME_COUNT = 30; // Number of movement point animation frames
export const MOVEMENT_POINT_ANIMATION_FPS = 60; // Movement point animation speed (frames per second)

// Space dust glow constants
export const DUST_GLOW_STATE_NORMAL = 0;
export const DUST_GLOW_STATE_SLIGHT = 1;
export const DUST_GLOW_STATE_FULL = 2;
export const DUST_FAST_MOVEMENT_THRESHOLD = 5;
export const DUST_SLOW_MOVEMENT_THRESHOLD = 1;
export const DUST_FADE_TO_NORMAL_DELAY_MS = 2000;
export const DUST_FADE_TO_SLIGHT_DELAY_MS = 1000;
export const DUST_GLOW_TRANSITION_SPEED_UP = 3.0;
export const DUST_GLOW_TRANSITION_SPEED_DOWN = 0.5;
export const DUST_ASTEROID_COLLISION_PADDING_PX = 1.5;
export const DUST_ASTEROID_BOUNCE_RESTITUTION = 0.72;
export const DUST_ASTEROID_TANGENTIAL_PUSH_MULTIPLIER = 0.28;
export const DUST_ASTEROID_ROTATION_COLLISION_PUSH_MULTIPLIER = 0.5;

// Star background parallax constants
export const STAR_WRAP_SIZE = 4000; // Size of the star field wrapping area
export const STAR_LAYER_CONFIGS = [
    { count: 1800, parallaxFactor: 0.08, sizeRange: [0.5, 1.4] as [number, number], brightnessScale: 0.7, blurVariance: 0.75 },
    { count: 1350, parallaxFactor: 0.15, sizeRange: [0.55, 1.8] as [number, number], brightnessScale: 0.85, blurVariance: 0.6 },
    { count: 950, parallaxFactor: 0.25, sizeRange: [0.7, 2.2] as [number, number], brightnessScale: 1.0, blurVariance: 0.45 },
    { count: 600, parallaxFactor: 0.38, sizeRange: [0.9, 2.8] as [number, number], brightnessScale: 1.15, blurVariance: 0.3 },
    { count: 300, parallaxFactor: 0.55, sizeRange: [1.1, 3.4] as [number, number], brightnessScale: 1.35, blurVariance: 0.18 }
];

// Raytracing constants
export const RAYTRACING_NUM_RAYS = 64; // Number of rays to cast per sun
export const MAX_RAY_DISTANCE = 2000; // Maximum distance for ray casting
export const SHADOW_LENGTH = 1500; // Length of shadows cast by asteroids (increased for strategic asteroids)

// Visibility system constants
export const VISIBILITY_PROXIMITY_RANGE = 150; // Range at which units can see enemies in shade
export const SHADE_OPACITY = 0.3; // Opacity for rendering objects in shade (0-1)
export const STRATEGIC_ASTEROID_SIZE = 120; // Size of strategic asteroids that block visibility
export const STRATEGIC_ASTEROID_DISTANCE = 250; // Distance from sun center for strategic asteroids
export const ASTEROID_MIN_SIZE = 30;
export const ASTEROID_MAX_SIZE = STRATEGIC_ASTEROID_SIZE;

// Map boundary constants
export const MAP_SIZE = 2000; // Total map size in world units (centered at 0,0)
export const BORDER_FADE_WIDTH = 150; // Width of dark border fade zone
export const MAP_PLAYABLE_BOUNDARY = (MAP_SIZE / 2) - BORDER_FADE_WIDTH; // Units cannot move beyond this boundary

// Countdown and mirror constants
export const COUNTDOWN_DURATION = 3.0; // Countdown duration in seconds
export const MIRROR_COUNTDOWN_DEPLOY_DISTANCE = 150; // Distance mirrors move from base during countdown
export const MIRROR_MAX_HEALTH = 200;
export const MIRROR_DAMAGE_REDUCTION = 0.1; // 10% damage reduction from armor
export const MIRROR_REGEN_PER_SEC = 2;

// Marine unit constants
export const MARINE_MAX_HEALTH = 100;
export const MARINE_ATTACK_RANGE = 300;
export const MARINE_ATTACK_DAMAGE = 10;
export const MARINE_ATTACK_SPEED = 5; // Attacks per second (fast shooting)

// Mothership unit constants (Radiant hero)
export const MOTHERSHIP_MAX_HEALTH = 100;
export const MOTHERSHIP_ATTACK_RANGE = 300;
export const MOTHERSHIP_ATTACK_DAMAGE = 10;
export const MOTHERSHIP_ATTACK_SPEED = 2.5; // Attacks per second (half as fast as Marine)

// Grave unit constants
export const GRAVE_MAX_HEALTH = 150;
export const GRAVE_ATTACK_RANGE = 400;
export const GRAVE_HERO_ATTACK_RANGE_MULTIPLIER = 0.25; // Hero Grave units have 75% reduced attack range
export const GRAVE_ATTACK_DAMAGE = 15;
export const GRAVE_ATTACK_SPEED = 2; // Attacks per second (projectile launch rate)
export const GRAVE_NUM_PROJECTILES = 6; // Number of large particles
export const GRAVE_PROJECTILE_ORBIT_RADIUS = 18;
export const GRAVE_PROJECTILE_MIN_SPEED = 80; // Minimum speed to keep orbiting
export const GRAVE_PROJECTILE_ATTRACTION_FORCE = 300;
export const GRAVE_PROJECTILE_LAUNCH_SPEED = 400;
export const GRAVE_PROJECTILE_TRAIL_LENGTH = 15; // Number of trail particles
export const GRAVE_PROJECTILE_HIT_DISTANCE = 10; // Distance at which projectile hits target
export const GRAVE_MAX_SMALL_PARTICLES = 30; // Maximum number of small particles
export const GRAVE_SMALL_PARTICLE_REGEN_RATE = 1; // Small particles regenerated per second (1 per second)
export const GRAVE_SMALL_PARTICLES_PER_ATTACK = 5; // Small particles consumed per attack
export const GRAVE_SMALL_PARTICLE_SPEED = 120; // Speed of small particles following as if by gravity
export const GRAVE_SMALL_PARTICLE_SIZE = 2; // Visual size of small particles
export const GRAVE_SMALL_PARTICLE_DAMAGE = 5; // Damage per small particle (same as starling)
export const GRAVE_SMALL_PARTICLE_SPLASH_RADIUS = 30; // Splash damage radius for small particle explosion
export const GRAVE_SMALL_PARTICLE_SPLASH_FALLOFF = 0.5; // 50% damage at edge of splash
export const GRAVE_SMALL_PARTICLE_ATTRACTION_FORCE = 200; // Gravity-like attraction force
export const GRAVE_SMALL_PARTICLE_DRAG = 0.95; // Drag coefficient for particle movement
export const GRAVE_BLACK_HOLE_DURATION = 5.0; // Duration of black hole in seconds
export const GRAVE_BLACK_HOLE_SIZE = 15; // Visual size of black hole
export const GRAVE_BLACK_HOLE_SPEED = 300; // Speed of black hole projectile

// Starling unit constants (minions from stellar forge)
export const STARLING_MAX_HEALTH = 50;
export const STARLING_ATTACK_RANGE = 120;
export const STARLING_ATTACK_DAMAGE = 5;
export const STARLING_ATTACK_UPGRADE_BONUS = 1; // Bonus damage from foundry +1 ATK upgrade
export const STARLING_ATTACK_SPEED = 2; // Attacks per second
export const STARLING_MOVE_SPEED = 50; // Pixels per second (slower than regular units)
export const STARLING_MOVE_ACCELERATION_PX_PER_SEC = 120; // Pixels per second squared
export const STARLING_SPAWN_INTERVAL = 10.0; // Seconds between spawns
export const STARLING_EXPLORATION_CHANGE_INTERVAL = 5.0; // Change random direction every 5 seconds
export const STARLING_PROJECTILE_SPEED = 320; // Pixels per second
export const STARLING_PROJECTILE_MAX_RANGE_PX = 140; // Maximum travel distance
export const STARLING_PROJECTILE_HIT_RADIUS_PX = 8; // Hit radius for starling projectiles
export const STARLING_COLLISION_RADIUS_PX = 3; // Collision radius for minion starlings
export const STARLING_LASER_IMPACT_PARTICLES = 3; // Number of particles spawned at laser impact
export const STARLING_LASER_PARTICLE_SPEED = 30; // Speed of impact particles in pixels per second
export const STARLING_LASER_PARTICLE_LIFETIME = 0.3; // Lifetime of impact particles in seconds
export const STARLING_LASER_WIDTH_PX = 2;
export const STARLING_REGEN_RATE_PER_SEC = 2; // Health regenerated per second when in influence
export const STARLING_BLINK_DISTANCE_PX = 80; // Teleport distance for Blink upgrade
export const STARLING_BLINK_COOLDOWN_SEC = 6; // Cooldown between Blink uses
export const STARLING_GROUP_STOP_BASE_RADIUS_PX = 8; // Base radius for group stop around final waypoint
export const STARLING_GROUP_STOP_SPACING_PX = 5; // Additional radius per sqrt(stopped count)
export const STARLING_MAX_COUNT = 100; // Maximum number of starlings per player
export const UNIT_LINE_OF_SIGHT_MULTIPLIER = 1.2; // Line of sight is 20% more than attack range
export const SHADE_BRIGHTNESS_BOOST = 0.4; // Brightness boost in shaded areas near units (0-1)
export const SHADE_BRIGHTNESS_RADIUS = 200; // Radius around units where brightness boost is applied
export const FORGE_FLAME_ALPHA = 0.75;
export const FORGE_FLAME_SIZE_MULTIPLIER = 0.45;
export const FORGE_FLAME_ROTATION_SPEED_RAD_PER_SEC = Math.PI;
export const FORGE_FLAME_WARMTH_FADE_PER_SEC = 2.0;
export const FORGE_FLAME_OFFSET_MULTIPLIER = 0.35;

// Stellar Forge constants (main base structure)
export const STELLAR_FORGE_MAX_HEALTH = 1000;
export const STELLAR_FORGE_STARLING_DEFENSE = 5; // Flat damage reduction against starling attacks

// Forge crunch constants (periodic event that spawns minions)
export const FORGE_CRUNCH_INTERVAL = 20.0; // Seconds between crunches
export const FORGE_CRUNCH_ENERGY_PER_SEC_PER_STARLING = 20; // Incoming light per second needed for 1 starling per crunch
export const FORGE_CRUNCH_SUCK_DURATION = 0.8; // Duration of dust suction phase
export const FORGE_CRUNCH_WAVE_DURATION = 1.2; // Duration of wave push phase
export const FORGE_CRUNCH_SUCK_RADIUS = 250; // Radius of dust suction effect
export const FORGE_CRUNCH_WAVE_RADIUS = 300; // Radius of wave push effect
export const FORGE_CRUNCH_SUCK_FORCE = 150; // Force magnitude pulling dust in
export const FORGE_CRUNCH_WAVE_FORCE = 100; // Force magnitude pushing dust out
export const STARLING_COST_PER_ENERGY = 50; // Energy needed per starling spawned
export const STARLING_SACRIFICE_ENERGY_MULTIPLIER = 0.5; // Fraction of starling energy cost applied to production boosts

// Cannon/Gatling building constants (offensive building for Radiant faction)
export const MINIGUN_MAX_HEALTH = 200;
export const MINIGUN_ATTACK_RANGE = 350;
export const MINIGUN_ATTACK_DAMAGE = 12;
export const MINIGUN_ATTACK_SPEED = 6; // Attacks per second (very fast)
export const MINIGUN_LASER_WIDTH_PX = 12;
export const MINIGUN_RADIUS = 30; // Building size
export const GATLING_MAX_HEALTH = 200;
export const GATLING_ATTACK_RANGE = 175;
export const GATLING_ATTACK_DAMAGE = 12;
export const GATLING_ATTACK_SPEED = 4; // Attacks per second (very fast)
export const GATLING_RADIUS = 30; // Building size

// Space Dust Swirler building constants (defensive building for Radiant faction)
export const SWIRLER_MAX_HEALTH = 250;
export const SWIRLER_ATTACK_RANGE = 0; // No direct attack
export const SWIRLER_ATTACK_DAMAGE = 0; // Defensive building
export const SWIRLER_ATTACK_SPEED = 0; // No direct attack
export const SWIRLER_RADIUS = 35; // Building size
export const SWIRLER_INFLUENCE_RADIUS = 400; // Range of space dust swirl effect (max radius)
export const SWIRLER_INITIAL_RADIUS_MULTIPLIER = 0.5; // Start at 50% of max radius
export const SWIRLER_GROWTH_RATE_PER_SEC = 30; // Radius growth rate in pixels per second
export const SWIRLER_SHRINK_BASE_RATE = 20; // Base shrink amount per absorbed projectile
export const SWIRLER_SHRINK_DAMAGE_MULTIPLIER = 0.5; // Additional shrink per point of damage
export const SWIRLER_MIN_INFLUENCE_RADIUS = 50; // Minimum radius the swirler can shrink to
export const SWIRLER_DUST_ORBIT_SPEED_BASE = 80; // Base orbital speed at edge
export const SWIRLER_DUST_SPEED_MULTIPLIER = 2.5; // Speed multiplier at center (faster closer)

// Foundry building constants
export const SUBSIDIARY_FACTORY_MAX_HEALTH = 500;
export const SUBSIDIARY_FACTORY_ATTACK_RANGE = 0; // No direct attack
export const SUBSIDIARY_FACTORY_ATTACK_DAMAGE = 0; // Production building
export const SUBSIDIARY_FACTORY_ATTACK_SPEED = 0; // No direct attack
export const SUBSIDIARY_FACTORY_RADIUS = 40; // Building size
export const SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL = 15.0; // Seconds between unit productions

// Striker Tower building constants (Velaris faction - manual missile launch)
export const STRIKER_TOWER_MAX_HEALTH = 300;
export const STRIKER_TOWER_ATTACK_RANGE = 400; // Range for missile targeting
export const STRIKER_TOWER_ATTACK_DAMAGE = 100; // Missile explosion damage
export const STRIKER_TOWER_ATTACK_SPEED = 0; // Manual fire only, no auto attack
export const STRIKER_TOWER_RADIUS = 32; // Building size
export const STRIKER_TOWER_RELOAD_TIME = 10.0; // Seconds to reload missile
export const STRIKER_TOWER_EXPLOSION_RADIUS = 60; // Explosion radius

// Lock-on Laser Tower building constants (Velaris faction - laser beam)
export const LOCKON_TOWER_MAX_HEALTH = 250;
export const LOCKON_TOWER_ATTACK_RANGE = 300; // Range for locking onto enemies
export const LOCKON_TOWER_ATTACK_DAMAGE = 200; // Massive laser damage
export const LOCKON_TOWER_ATTACK_SPEED = 0; // Charged attack, not rate-based
export const LOCKON_TOWER_RADIUS = 30; // Building size
export const LOCKON_TOWER_LOCKON_TIME = 2.0; // Seconds to lock on before firing
export const LOCKON_TOWER_LASER_WIDTH_PX = 20; // Laser beam width

// Shield Tower constants (Radiant)
export const SHIELD_TOWER_MAX_HEALTH = 300;
export const SHIELD_TOWER_ATTACK_RANGE = 0; // No direct attack
export const SHIELD_TOWER_ATTACK_DAMAGE = 0; // Defensive building
export const SHIELD_TOWER_ATTACK_SPEED = 0; // No direct attack
export const SHIELD_TOWER_RADIUS = 35; // Building size
export const SHIELD_TOWER_SHIELD_RADIUS = 200; // Shield projection radius
export const SHIELD_TOWER_SHIELD_HEALTH = 500; // Damage needed to disable shield
export const SHIELD_TOWER_REGENERATION_TIME = 10.0; // Seconds before shield can reactivate

// Unit visibility constants
export const UNIT_VISIBILITY_RADIUS = 200; // Distance in pixels that units can see around them

// Building costs (energy-based construction)
// Note: Internal names are different from display names
// MINIGUN = Cannon, GATLING = Gatling Tower, SWIRLER = Cyclone, SUBSIDIARY_FACTORY = Workshop/Foundry
export const MINIGUN_COST = 500; // Cannon
export const GATLING_COST = 250; // Gatling
export const SWIRLER_COST = 750; // Cyclone
export const SUBSIDIARY_FACTORY_COST = 1000; // Workshop/Foundry
export const STRIKER_TOWER_COST = 400; // Striker Tower (Velaris)
export const LOCKON_TOWER_COST = 600; // Lock-on Laser Tower (Velaris)
export const SHIELD_TOWER_COST = 650; // Shield Tower (Radiant)
export const HERO_UNIT_BASE_COST = 300;
export const HERO_UNIT_COST_INCREMENT = 200;
export const SOLAR_MIRROR_COST = 50; // Cost to build additional solar mirrors
export const STELLAR_FORGE_SOLAR_MIRROR_COST = 500; // Required incoming sunlight/sec to produce a solar mirror from the main stellar forge

// Foundry upgrade costs
export const FOUNDRY_STRAFE_UPGRADE_COST = 1000; // Cost to unlock Strafe upgrade
export const FOUNDRY_REGEN_UPGRADE_COST = 1000; // Cost to unlock Regen upgrade
export const FOUNDRY_ATTACK_UPGRADE_COST = 1000; // Cost to unlock +1 ATK upgrade
export const FOUNDRY_STRAFE_UPGRADE_ITEM = 'strafe-upgrade';
export const FOUNDRY_REGEN_UPGRADE_ITEM = 'regen-upgrade';
export const FOUNDRY_ATTACK_UPGRADE_ITEM = 'attack-upgrade';
export const SOLAR_MIRROR_FROM_FOUNDRY_COST = 300; // Cost to create solar mirror from foundry
export const FOUNDRY_BLINK_UPGRADE_COST = 3000; // Cost to unlock Blink upgrade at foundry
export const FOUNDRY_BLINK_UPGRADE_ITEM = 'blink-upgrade';
export const STARLING_MERGE_COUNT = 10; // Number of starlings required to merge into a solar mirror
export const STARLING_MERGE_DURATION_SEC = 10.0; // Seconds before merge gate converts to a solar mirror
export const STARLING_MERGE_GATE_RADIUS_PX = 18; // Visual/absorption radius for merge gate
export const STARLING_MERGE_GATE_MAX_HEALTH = 80; // Health for merge gate before it breaks
export const STARLING_MERGE_HOLD_DURATION_MS = 2000; // Hold duration to trigger starling merge
export const STARLING_MERGE_HOLD_RADIUS_PX = 30; // Max distance from a selected starling to start hold merge

// AI control intervals and placement tuning
export const AI_MIRROR_COMMAND_INTERVAL_SEC = 2.0;
export const AI_DEFENSE_COMMAND_INTERVAL_SEC = 1.0;
export const AI_HERO_COMMAND_INTERVAL_SEC = 3.0;
export const AI_STRUCTURE_COMMAND_INTERVAL_SEC = 5.0;
export const AI_MIRROR_PURCHASE_INTERVAL_SEC = 8.0; // Interval to check for buying mirrors
export const AI_MAX_MIRRORS = 6; // Maximum mirrors AI will build
export const AI_WAVES_ATTACK_THRESHOLD = 8; // Min unit count for wave attack
export const AI_AGGRESSIVE_HERO_MULTIPLIER = 0.7; // Faster hero production
export const AI_ECONOMIC_HERO_MULTIPLIER = 1.5; // Slower hero production
export const AI_WAVES_HERO_MULTIPLIER = 1.2; // Slightly slower hero production
export const AI_MIRROR_SUN_DISTANCE_PX = 220;
export const AI_MIRROR_ARC_SPACING_RAD = 0.6;
export const AI_MIRROR_REPOSITION_THRESHOLD_PX = 40;
// Strategy-based mirror positioning (distance from sun)
export const AI_MIRROR_AGGRESSIVE_DISTANCE_PX = 180;  // Very close to sun for max energy
export const AI_MIRROR_DEFENSIVE_DISTANCE_PX = 400;   // Further from sun, closer to base
export const AI_MIRROR_ECONOMIC_DISTANCE_PX = 250;    // Balanced distance
export const AI_MIRROR_WAVES_DISTANCE_PX = 280;       // Moderate distance
export const AI_MIRROR_PLACEMENT_ATTEMPTS = 8;        // Number of attempts to find valid mirror position
export const AI_MIRROR_GUARD_DISTANCE_PX = 80;        // Distance from mirror to place guards
export const AI_MIRROR_COLLISION_RADIUS_PX = 20;      // Mirror collision detection radius
export const AI_MIRROR_RADIUS_VARIATION_STEP_PX = 30; // Step size for radius variation when finding positions
export const AI_MIRROR_RADIUS_VARIATION_OFFSET_PX = 60; // Offset for radius variation (varies from -60 to +60)
export const AI_MIRROR_ANGLE_VARIATION_STEP_RAD = 0.15; // Step size for angle variation when finding positions
export const AI_MIRROR_ANGLE_VARIATION_OFFSET_RAD = 0.6; // Offset for angle variation (varies from -0.6 to +0.6)
export const AI_DEFENSE_RADIUS_PX = 350;
export const AI_STRUCTURE_PLACEMENT_DISTANCE_PX = 140;
export const AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD = Math.PI / 4;
export const HERO_PRODUCTION_TIME_SEC = 8;
export const HERO_BUTTON_RADIUS_PX = 28;
export const HERO_BUTTON_DISTANCE_PX = 100;
export const FORGE_UPGRADE_BUTTON_RADIUS_PX = 22;
export const FORGE_UPGRADE_BUTTON_DISTANCE_PX = 140;
export const BUILDING_BUILD_TIME = 5.0; // Base build time in seconds

// Weapon effect constants
export const MUZZLE_FLASH_DURATION = 0.05; // 50ms - very brief
export const BULLET_CASING_LIFETIME = 2.0; // 2 seconds
export const BULLET_CASING_SPEED_MIN = 100;
export const BULLET_CASING_SPEED_MAX = 150;
export const BOUNCING_BULLET_LIFETIME = 0.5; // 0.5 seconds
export const BOUNCING_BULLET_SPEED_MIN = 150;
export const BOUNCING_BULLET_SPEED_MAX = 250;
export const CASING_SPACEDUST_COLLISION_DISTANCE = 5;
export const CASING_SPACEDUST_FORCE = 50;
export const CASING_COLLISION_DAMPING = 0.3;

// Unit movement constants
export const UNIT_MOVE_SPEED = 100; // Pixels per second
export const UNIT_TURN_SPEED_RAD_PER_SEC = 8.0; // Radians per second - quick turning
export const UNIT_ARRIVAL_THRESHOLD = 5; // Distance to consider unit arrived at destination
export const UNIT_RADIUS_PX = 10; // Approximate unit radius for collisions
export const UNIT_AVOIDANCE_RANGE_PX = 40; // Range for unit avoidance steering
export const UNIT_AVOIDANCE_STRENGTH = 0.7; // Blend factor for avoidance steering (unitless)
export const UNIT_ASTEROID_AVOIDANCE_LOOKAHEAD_PX = 140; // Distance ahead to check for asteroids
export const UNIT_ASTEROID_AVOIDANCE_BUFFER_PX = 12; // Buffer distance around asteroids
export const UNIT_ASTEROID_AVOIDANCE_STRENGTH = 1.1; // Blend factor for asteroid avoidance
export const UNIT_HERO_AVOIDANCE_MULTIPLIER = 0.3; // Heroes ignore some avoidance (unitless)
export const UNIT_MINION_YIELD_MULTIPLIER = 1.4; // Minions yield more to heroes (unitless)
export const UNIT_STRUCTURE_STANDOFF_PX = 4; // Extra spacing to keep units outside structures
export const PATH_WAYPOINT_ARRIVAL_MULTIPLIER = 2; // Multiplier for waypoint arrival detection
export const MIN_WAYPOINT_DISTANCE = 50; // Minimum distance between path waypoints in pixels
export const UNIT_PATH_DRAW_RADIUS = 50; // Maximum distance from unit to initiate path drawing (pixels)

// Asteroid rotation knockback constants
export const ASTEROID_KNOCKBACK_INITIAL_VELOCITY = 80; // Initial knockback velocity in pixels per second
export const ASTEROID_KNOCKBACK_DECELERATION = 200; // Knockback deceleration in pixels per second squared
export const SOLAR_MIRROR_COLLISION_RADIUS = 20; // Approximate collision radius for solar mirrors in pixels

// Deterministic state hash cadence
export const STATE_HASH_TICK_INTERVAL = 30; // Update state hash every 30 ticks

// Solar mirror visual constants
export const MIRROR_ACTIVE_GLOW_RADIUS = 15; // Radius of yellow glow when mirror is active
export const MIRROR_CLICK_RADIUS_PX = 20; // Radius for mirror selection/targeting
export const MIRROR_MAX_GLOW_DISTANCE = 1000; // Maximum distance for glow and efficiency calculations
export const MIRROR_PROXIMITY_MULTIPLIER = 2.0; // Maximum energy generation multiplier at close range

// Ability constants
export const MARINE_ABILITY_COOLDOWN = 5.0; // 5 seconds
export const MARINE_ABILITY_BULLET_COUNT = 15; // Number of bullets in storm
export const MARINE_ABILITY_BULLET_SPEED = 500; // Speed of ability bullets
export const MARINE_ABILITY_BULLET_LIFETIME = 1.0; // Lifetime of ability bullets
export const MARINE_ABILITY_SPREAD_ANGLE = (10 * Math.PI) / 180; // 10 degrees in radians
export const MARINE_ABILITY_BULLET_DAMAGE = 5; // Damage per ability bullet

// Mothership ability constants
export const MOTHERSHIP_ABILITY_COOLDOWN = 8.0; // 8 seconds
export const MOTHERSHIP_MINI_COUNT = 3; // Number of mini-motherships spawned
export const MOTHERSHIP_MINI_FORMATION_RADIUS = 50; // Distance from mothership in triangle formation
export const MOTHERSHIP_MINI_SPEED = 150; // Movement speed (pixels per second)
export const MOTHERSHIP_MINI_LIFETIME = 12.0; // Maximum lifetime before auto-explosion (seconds)
export const MOTHERSHIP_MINI_HEALTH = 50; // Health (same as starlings)
export const MOTHERSHIP_MINI_ATTACK_RANGE = 120; // Attack range (same as starlings)
export const MOTHERSHIP_MINI_ATTACK_DAMAGE = 5; // Damage per shot (same as starlings)
export const MOTHERSHIP_MINI_ATTACK_SPEED = 2; // Attacks per second (same as starlings)
export const MOTHERSHIP_MINI_COLLISION_RADIUS = 8; // Collision radius for environment/structures
export const MOTHERSHIP_MINI_EXPLOSION_RADIUS = 80; // Splash damage radius
export const MOTHERSHIP_MINI_EXPLOSION_DAMAGE = 30; // Damage at explosion center
export const MOTHERSHIP_MINI_EXPLOSION_FALLOFF = 0.3; // Minimum damage multiplier at edge (30%)

// UI constants
export const UI_BACKGROUND_COLOR = '#000011'; // Dark blue-black background for UI
export const CLICK_DRAG_THRESHOLD = 16; // Pixels of movement to distinguish click from drag (more forgiving so quick taps are not treated as drags)
export const SMALL_SELECTION_THRESHOLD = 50; // Maximum selection box size (pixels) to be considered a single-click for double-tap detection
export const HERO_ATTACK_RANGE_ALPHA = 0.2; // Opacity for hero unit attack range circles
export const SOL_ICON_TEXT_SPACING = 2; // Spacing between SoL icon and text in zoom units
export const ABILITY_ARROW_MIN_LENGTH = 28; // Minimum pixel drag distance required before ability-cast arrows trigger
export const SHIELD_HEALTH_BAR_VERTICAL_OFFSET = 20; // Vertical offset for shield health bar below main health bar

// Visual effect constants
export const TAP_EFFECT_SPEED = 0.05; // Progress increment per frame for tap effect
export const TAP_EFFECT_MAX_RADIUS = 40; // Maximum radius of tap ripple effect
export const SWIPE_EFFECT_SPEED = 0.08; // Progress increment per frame for swipe effect
export const PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX = 48; // Max radius for hero/building button waves
export const PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME = 0.12; // Progress increment per frame for production button wave
export const SWIPE_ARROW_SIZE = 15; // Size of the arrow head in swipe effect

// Ray unit constants (Velaris hero)
export const RAY_MAX_HEALTH = 120;
export const RAY_ATTACK_RANGE = 250;
export const RAY_ATTACK_DAMAGE = 8;
export const RAY_ATTACK_SPEED = 3; // Attacks per second
export const RAY_ABILITY_COOLDOWN = 8.0; // 8 seconds
export const RAY_BEAM_DAMAGE = 25; // Damage per beam hit
export const RAY_BEAM_MAX_BOUNCES = 5; // Maximum number of bounces
export const RAY_BEAM_WIDTH = 3; // Visual width of the beam

// Influence Ball unit constants (Velaris hero)
export const INFLUENCE_BALL_MAX_HEALTH = 100;
export const INFLUENCE_BALL_ATTACK_RANGE = 200;
export const INFLUENCE_BALL_ATTACK_DAMAGE = 5;
export const INFLUENCE_BALL_ATTACK_SPEED = 1.5; // Attacks per second
export const INFLUENCE_BALL_ABILITY_COOLDOWN = 15.0; // 15 seconds
export const INFLUENCE_BALL_PROJECTILE_SPEED = 300;
export const INFLUENCE_BALL_EXPLOSION_RADIUS = 150; // Radius of influence zone
export const INFLUENCE_BALL_DURATION = 10.0; // 10 seconds influence duration

// Turret Deployer unit constants (Velaris hero)
export const TURRET_DEPLOYER_MAX_HEALTH = 90;
export const TURRET_DEPLOYER_ATTACK_RANGE = 180;
export const TURRET_DEPLOYER_ATTACK_DAMAGE = 6;
export const TURRET_DEPLOYER_ATTACK_SPEED = 2; // Attacks per second
export const TURRET_DEPLOYER_ABILITY_COOLDOWN = 12.0; // 12 seconds
export const DEPLOYED_TURRET_MAX_HEALTH = 150;
export const DEPLOYED_TURRET_ATTACK_RANGE = 300;
export const DEPLOYED_TURRET_ATTACK_DAMAGE = 12;
export const DEPLOYED_TURRET_ATTACK_SPEED = 2; // Attacks per second (fires 2 times per second)
export const TURRET_PROJECTILE_SPEED = 400;
export const DEPLOYED_TURRET_ANIMATION_DURATION = 0.1; // Animation duration in seconds
export const DEPLOYED_TURRET_SPRITE_SCALE = 0.08; // Base scale factor for turret sprites
export const DEPLOYED_TURRET_ANIMATION_FRAME_COUNT = 28; // Number of firing animation frames
export const DEPLOYED_TURRET_HEALTH_BAR_SIZE = 40; // Size for health bar positioning

// Driller unit constants (Aurum hero)
export const DRILLER_MAX_HEALTH = 140;
export const DRILLER_ATTACK_RANGE = 0; // No normal attack, only ability
export const DRILLER_ATTACK_DAMAGE = 0; // No normal attack
export const DRILLER_ATTACK_SPEED = 0; // No normal attack
export const DRILLER_ABILITY_COOLDOWN = 5.0; // 5 seconds after collision
export const DRILLER_DRILL_SPEED = 500; // Speed when drilling
export const DRILLER_DRILL_DAMAGE = 30; // Damage to units
export const DRILLER_BUILDING_DAMAGE_MULTIPLIER = 2.0; // Double damage to buildings
export const DRILLER_DECELERATION = 200; // Deceleration rate at edge

// Dagger unit constants (Radiant hero - cloaked assassin)
export const DAGGER_MAX_HEALTH = 80;
export const DAGGER_ATTACK_RANGE = 100; // Very short range
export const DAGGER_ATTACK_DAMAGE = 35; // High damage for close range
export const DAGGER_ATTACK_SPEED = 1.5; // Attacks per second
export const DAGGER_ABILITY_COOLDOWN = 6.0; // 6 seconds
export const DAGGER_ABILITY_RANGE = 150; // Very short range for ability attack
export const DAGGER_ABILITY_DAMAGE = 50; // High burst damage
export const DAGGER_VISIBILITY_DURATION = 8.0; // 8 seconds visible after using ability
export const DAGGER_CLOAK_OPACITY = 0.4; // Opacity when cloaked to own player

// Beam unit constants (Radiant hero - sniper with distance-based damage)
export const BEAM_MAX_HEALTH = 70;
export const BEAM_ATTACK_RANGE = 150;
export const BEAM_ATTACK_DAMAGE = 20;
export const BEAM_ATTACK_SPEED = 1.0; // Attacks per second
export const BEAM_ABILITY_COOLDOWN = 8.0; // 8 seconds
export const BEAM_ABILITY_BASE_DAMAGE = 30; // Base damage for ability
export const BEAM_ABILITY_MAX_RANGE = 600; // Maximum beam range
export const BEAM_ABILITY_DAMAGE_PER_DISTANCE = 0.1; // Damage multiplier per unit of distance

export const SPOTLIGHT_MAX_HEALTH = 95;
export const SPOTLIGHT_ATTACK_RANGE = 0;
export const SPOTLIGHT_ATTACK_DAMAGE = 0;
export const SPOTLIGHT_ATTACK_SPEED = 1.0; // Placeholder attack speed (no primary attack)
export const SPOTLIGHT_ABILITY_COOLDOWN = 12.0; // Total cycle cooldown
export const SPOTLIGHT_SETUP_TIME_SEC = 1.0;
export const SPOTLIGHT_ACTIVE_TIME_SEC = 4.0;
export const SPOTLIGHT_TEARDOWN_TIME_SEC = 5.0;
export const SPOTLIGHT_CONE_ANGLE_RAD = (5 * Math.PI) / 180; // 5-degree total cone
export const SPOTLIGHT_FIRE_RATE_PER_SEC = 8; // High fire rate
export const SPOTLIGHT_BULLET_SPEED = 600; // Medium-fast projectile
export const SPOTLIGHT_BULLET_DAMAGE = 4;
export const SPOTLIGHT_BULLET_LIFETIME_SEC = 1.2;
export const SPOTLIGHT_BULLET_WIDTH_PX = 1.5;
export const SPOTLIGHT_BULLET_LENGTH_PX = 10;
export const SPOTLIGHT_BULLET_HIT_RADIUS_PX = 6;

// Mortar unit constants (Radiant hero - stationary artillery with cone detection)
export const MORTAR_MAX_HEALTH = 120;
export const MORTAR_ATTACK_RANGE = 450; // Long range artillery
export const MORTAR_ATTACK_DAMAGE = 40; // High damage per shot
export const MORTAR_ATTACK_SPEED = 0.5; // Low fire rate (0.5 attacks per second = 2 seconds between shots)
export const MORTAR_ABILITY_COOLDOWN = 0; // No cooldown, setup is the ability
export const MORTAR_DETECTION_CONE_ANGLE = (150 * Math.PI) / 180; // 150 degrees detection cone
export const MORTAR_SPLASH_RADIUS = 80; // Radius of splash damage
export const MORTAR_SPLASH_DAMAGE_FALLOFF = 0.5; // 50% damage at edge of splash radius
export const MORTAR_PROJECTILE_SPEED = 300; // Speed of mortar shells

// Preist unit constants (healing support hero)
export const PREIST_MAX_HEALTH = 110;
export const PREIST_ATTACK_RANGE = 0; // No attack
export const PREIST_ATTACK_DAMAGE = 0; // No damage
export const PREIST_ATTACK_SPEED = 0; // No attack
export const PREIST_ABILITY_COOLDOWN = 10.0; // 10 seconds
export const PREIST_HEALING_RANGE = 350; // Range for healing beams
export const PREIST_HEALING_PER_SECOND = 0.02; // 2% of max health per second per beam
export const PREIST_TARGET_LOCK_DURATION = 0.5; // Stay on target for at least 0.5 seconds
export const PREIST_NUM_BEAMS = 2; // Number of healing beams
export const PREIST_HEALING_BOMB_SPEED = 400; // Speed of healing bomb projectile
export const PREIST_HEALING_BOMB_MAX_RANGE = 500; // Maximum range for healing bomb
export const PREIST_HEALING_BOMB_PARTICLE_COUNT = 50; // Number of wild particles
export const PREIST_HEALING_BOMB_PARTICLE_HEALING = 0.01; // 1% of max health per particle
export const PREIST_HEALING_BOMB_EXPLOSION_RADIUS = 120; // Radius of particle explosion area
export const PREIST_HEALING_BOMB_PARTICLE_SPEED = 200; // Speed of wild particles
export const PREIST_HEALING_BOMB_PARTICLE_LIFETIME = 0.5; // Lifetime of wild particles

// Tank hero constants (defensive tank with shield and crescent wave ability)
export const TANK_MAX_HEALTH = 300; // Very high health (3x Marine)
export const TANK_ATTACK_RANGE = 0; // Doesn't attack
export const TANK_ATTACK_DAMAGE = 0; // No damage
export const TANK_ATTACK_SPEED = 0; // No attack
export const TANK_DEFENSE = 50; // 50% damage reduction (armor)
export const TANK_ABILITY_COOLDOWN = 12.0; // 12 seconds
export const TANK_SHIELD_RADIUS = 60; // Radius of shield around tank that blocks projectiles
export const TANK_WAVE_ANGLE = Math.PI / 2; // 90 degrees crescent wave
export const TANK_WAVE_RANGE = 400; // Maximum range of wave
export const TANK_WAVE_SPEED = 150; // Slow moving wave (pixels per second)
export const TANK_WAVE_WIDTH = 40; // Width of the wave
export const TANK_STUN_DURATION = 2.0; // Stuns for 2 seconds
export const TANK_COLLISION_RADIUS_PX = 20; // Slightly larger collision radius

// Nova unit constants (Velaris hero - remote bomb specialist)
export const NOVA_MAX_HEALTH = 105;
export const NOVA_ATTACK_RANGE = 250;
export const NOVA_ATTACK_DAMAGE = 6;
export const NOVA_ATTACK_SPEED = 2; // Attacks per second
export const NOVA_ABILITY_COOLDOWN = 0; // No cooldown - triggers existing bomb
export const NOVA_BOMB_INITIAL_SPEED = 400; // Initial speed when thrown
export const NOVA_BOMB_DECELERATION = 150; // Deceleration rate (units/s²)
export const NOVA_BOMB_MIN_SPEED = 50; // Minimum speed after deceleration
export const NOVA_BOMB_ARMING_TIME = 2.0; // 2 seconds before bomb can be triggered
export const NOVA_BOMB_BOUNCE_DAMPING = 0.7; // Speed retention after bounce (70%)
export const NOVA_BOMB_MAX_BOUNCES = 10; // Maximum number of bounces
export const NOVA_BOMB_EXPLOSION_DAMAGE = 50; // Damage from explosion
export const NOVA_BOMB_EXPLOSION_RADIUS = 100; // Radius of explosion
export const NOVA_BOMB_SCATTER_ARC = (30 * Math.PI) / 180; // 30 degree arc for scatter bullets
export const NOVA_BOMB_SCATTER_BULLET_COUNT = 12; // Number of scatter bullets
export const NOVA_BOMB_SCATTER_BULLET_SPEED = 350; // Speed of scatter bullets
export const NOVA_BOMB_SCATTER_BULLET_DAMAGE = 8; // Damage per scatter bullet
export const NOVA_BOMB_SCATTER_BULLET_LIFETIME = 1.0; // Lifetime of scatter bullets in seconds
export const NOVA_BOMB_RADIUS = 15; // Visual/collision radius of bomb

// Sly hero constants (sticky laser bomb specialist)
export const SLY_MAX_HEALTH = 90;
export const SLY_ATTACK_RANGE = 200;
export const SLY_ATTACK_DAMAGE = 15;
export const SLY_ATTACK_SPEED = 1.5; // Attacks per second
export const SLY_ABILITY_COOLDOWN = 0; // No cooldown - first activation throws bomb, second activation triggers lasers from stuck bomb
export const STICKY_BOMB_INITIAL_SPEED = 500; // Very fast throw speed
export const STICKY_BOMB_DECELERATION = 200; // Deceleration rate (units/s²)
export const STICKY_BOMB_MIN_SPEED = 20; // Minimum speed after deceleration
export const STICKY_BOMB_STICK_DISTANCE = 25; // How close before sticking to surface
export const STICKY_BOMB_ARM_TIME = 0.5; // 0.5 seconds before bomb can be triggered (can activate immediately after sticking)
export const STICKY_BOMB_MAX_LIFETIME = 5.0; // 5 seconds before disintegrating if not stuck
export const STICKY_BOMB_RADIUS = 12; // Visual/collision radius of bomb
export const STICKY_BOMB_DISINTEGRATE_PARTICLE_COUNT = 20; // Number of erratic particles when disintegrating
export const STICKY_BOMB_DISINTEGRATE_PARTICLE_SPEED = 150; // Speed of disintegration particles
export const STICKY_BOMB_DISINTEGRATE_PARTICLE_LIFETIME = 1.0; // Lifetime of disintegration particles
export const STICKY_BOMB_WIDE_LASER_DAMAGE = 40; // Main wide laser damage
export const STICKY_BOMB_WIDE_LASER_WIDTH = 20; // Width of main laser
export const STICKY_BOMB_DIAGONAL_LASER_DAMAGE = 25; // Diagonal lasers damage
export const STICKY_BOMB_DIAGONAL_LASER_WIDTH = 12; // Width of diagonal lasers
export const STICKY_BOMB_LASER_ANGLE = (45 * Math.PI) / 180; // 45 degree angle for diagonal lasers
export const STICKY_BOMB_LASER_RANGE = 500; // Maximum range for lasers
export const STICKY_BOMB_LASER_DURATION = 0.15; // How long lasers stay visible (seconds)

// Radiant hero constants (orb-based laser field hero)
export const RADIANT_MAX_HEALTH = 120;
export const RADIANT_ABILITY_COOLDOWN = 4.0;
export const RADIANT_ORB_SPEED_MULTIPLIER = 3.0; // Multiplier for arrow length to orb speed
export const RADIANT_ORB_MAX_SPEED = 600;
export const RADIANT_ORB_DECELERATION = 150; // px/s^2
export const RADIANT_ORB_BOUNCE_DAMPING = 0.7; // Velocity multiplier on bounce
export const RADIANT_ORB_MIN_RANGE = 100; // Minimum connection range when stopped
export const RADIANT_ORB_MAX_RANGE = 400; // Maximum connection range at full speed
export const RADIANT_MAX_ORBS = 3;
export const RADIANT_LASER_DAMAGE_PER_SEC = 80; // Damage for crossing laser
export const RADIANT_ORB_RADIUS = 15; // Visual radius of orb

// Velaris hero constants (orb-based light-blocking hero)
export const VELARIS_HERO_MAX_HEALTH = 120;
export const VELARIS_HERO_ABILITY_COOLDOWN = 4.0;
export const VELARIS_ORB_SPEED_MULTIPLIER = 3.0;
export const VELARIS_ORB_MAX_SPEED = 600;
export const VELARIS_ORB_DECELERATION = 150;
export const VELARIS_ORB_BOUNCE_DAMPING = 0.7;
export const VELARIS_ORB_MIN_RANGE = 100;
export const VELARIS_ORB_MAX_RANGE = 400;
export const VELARIS_MAX_ORBS = 3;
export const VELARIS_ORB_RADIUS = 15;
export const VELARIS_PARTICLE_SPEED = 200; // Speed of particles between orbs

// Chrono hero constants
export const CHRONO_MAX_HEALTH = 100;
export const CHRONO_ATTACK_RANGE = 400;
export const CHRONO_ATTACK_DAMAGE = 0; // Doesn't do damage, just freezes
export const CHRONO_ATTACK_SPEED = 1.0; // 1 attack per second
export const CHRONO_FREEZE_DURATION = 1.0; // Freeze duration in seconds
export const CHRONO_ABILITY_BASE_COOLDOWN = 5.0; // Base cooldown for ability
export const CHRONO_ABILITY_MIN_RADIUS = 50; // Minimum circle radius
export const CHRONO_ABILITY_MAX_RADIUS = 300; // Maximum circle radius
export const CHRONO_ABILITY_RADIUS_MULTIPLIER = 2.0; // Arrow length to radius conversion
export const CHRONO_ABILITY_COOLDOWN_PER_RADIUS = 0.02; // Additional cooldown per unit of radius
export const CHRONO_FREEZE_CIRCLE_DURATION = 3.0; // How long the freeze circle lasts

// Aurum hero constants (orb-based shield field hero)
export const AURUM_HERO_MAX_HEALTH = 120;
export const AURUM_HERO_ABILITY_COOLDOWN = 5.0;
export const AURUM_ORB_SPEED_MULTIPLIER = 3.0;
export const AURUM_ORB_MAX_SPEED = 600;
export const AURUM_ORB_DECELERATION = 150;
export const AURUM_ORB_BOUNCE_DAMPING = 0.7;
export const AURUM_ORB_MIN_RANGE = 100;
export const AURUM_ORB_MAX_RANGE = 400;
export const AURUM_MAX_ORBS = 4;
export const AURUM_ORB_MAX_HEALTH = 200; // Orbs can take damage
export const AURUM_ORB_RADIUS = 15;
export const AURUM_SHIELD_OFFSET = 25; // Distance from orb center where shield starts
export const AURUM_SHIELD_HIT_DURATION = 0.3; // Duration of hit flash effect
export const AURUM_HERO_SUNLIGHT_SPEED_MULTIPLIER = 1.5;

// Splendor hero constants (Aurum sunlight laser hero)
export const SPLENDOR_MAX_HEALTH = 130;
export const SPLENDOR_ATTACK_RANGE = 380;
export const SPLENDOR_ATTACK_DAMAGE = 35;
export const SPLENDOR_ATTACK_SPEED = 0.9;
export const SPLENDOR_ABILITY_COOLDOWN = 8.0;
export const SPLENDOR_CHARGE_TIME_SEC = 0.5;
export const SPLENDOR_LASER_WIDTH_PX = 22;
export const SPLENDOR_LASER_NOSE_OFFSET = 22;
export const SPLENDOR_LASER_VISUAL_DURATION_SEC = 0.12;

export const SPLENDOR_SUN_SPHERE_RADIUS = 16;
export const SPLENDOR_SUN_SPHERE_SPEED_MULTIPLIER = 3.0;
export const SPLENDOR_SUN_SPHERE_MAX_SPEED = 650;
export const SPLENDOR_SUN_SPHERE_DECELERATION = 140;
export const SPLENDOR_SUN_SPHERE_BOUNCE_DAMPING = 0.74;
export const SPLENDOR_SUN_SPHERE_STOP_SPEED_PX_PER_SEC = 40;
export const SPLENDOR_SUN_SPHERE_MAX_LIFETIME_SEC = 6.0;
export const SPLENDOR_SUNLIGHT_ZONE_RADIUS = 220;
export const SPLENDOR_SUNLIGHT_ZONE_DURATION_SEC = 8.0;

// Dash hero constants (Aurum faction - rapid dash attack)
export const DASH_MAX_HEALTH = 110;
export const DASH_ABILITY_COOLDOWN = 3.0; // Quick cooldown
export const DASH_SPEED = 800; // Very fast dash speed (pixels per second)
export const DASH_DISTANCE_MULTIPLIER = 1.5; // Multiplier for arrow length to dash distance
export const DASH_MIN_DISTANCE = 100; // Minimum dash distance
export const DASH_MAX_DISTANCE = 500; // Maximum dash distance
export const DASH_SLASH_RADIUS = 30; // Radius around dash position that damages units
export const DASH_SLASH_DAMAGE = 40; // Damage dealt to units hit by dash

// Blink hero constants (Aurum faction - teleport with shockwave)
export const BLINK_MAX_HEALTH = 100;
export const BLINK_ABILITY_COOLDOWN = 6.0; // Moderate cooldown
export const BLINK_DISTANCE_MULTIPLIER = 1.5; // Multiplier for arrow length to blink distance
export const BLINK_MIN_DISTANCE = 80; // Minimum blink distance
export const BLINK_MAX_DISTANCE = 400; // Maximum blink distance
export const BLINK_SHOCKWAVE_MIN_RADIUS = 60; // Minimum shockwave radius (at max blink distance)
export const BLINK_SHOCKWAVE_MAX_RADIUS = 180; // Maximum shockwave radius (at min blink distance)
export const BLINK_SHOCKWAVE_DAMAGE = 20; // Damage dealt by shockwave
export const BLINK_STUN_DURATION = 1.0; // Stun duration in seconds
export const BLINK_SHOCKWAVE_VISUAL_DURATION = 0.4; // Duration of visual effect in seconds
export const BLINK_SHOCKWAVE_HIT_WINDOW = 0.05; // Time window for shockwave hit detection in seconds

// Shadow hero constants (Velaris faction - beam attack with decoy)
export const SHADOW_MAX_HEALTH = 100;
export const SHADOW_ATTACK_RANGE = 200;
export const SHADOW_ATTACK_DAMAGE = 15; // Base damage per attack
export const SHADOW_ATTACK_SPEED = 10.0; // Very fast attack speed for "constant beam" effect
export const SHADOW_ABILITY_COOLDOWN = 8.0; // 8 second cooldown for decoy
export const SHADOW_COLLISION_RADIUS_PX = 15;
export const SHADOW_BEAM_MULTIPLIER_PER_SECOND = 0.8; // Increases by 0.8 per second (reaches 5x in 5 seconds)
export const SHADOW_BEAM_MAX_MULTIPLIER = 5.0; // Maximum 5x damage multiplier
export const SHADOW_DECOY_HEALTH_MULTIPLIER = 3.0; // Decoy has 3x hero health
export const SHADOW_DECOY_SPEED_MULTIPLIER = 2.5; // Multiplier for arrow length to speed
export const SHADOW_DECOY_MAX_SPEED = 400; // Maximum decoy speed
export const SHADOW_DECOY_COLLISION_RADIUS = 15; // Collision radius for decoy
export const SHADOW_DECOY_HIT_OPACITY = 0.75; // Opacity when hit
export const SHADOW_DECOY_FADE_SPEED = 1.0; // Fade speed per second (75% -> 100% in 0.25 seconds)
export const SHADOW_DECOY_PARTICLE_COUNT = 30; // Number of particles on despawn
export const SHADOW_DECOY_PARTICLE_SPEED = 200; // Speed of despawn particles
export const SHADOW_DECOY_PARTICLE_LIFETIME = 1.5; // Lifetime of particles in seconds
export const SHADOW_DECOY_PARTICLE_SIZE = 3; // Size of particles

// AI Strategy types
export enum AIStrategy {
    ECONOMIC = "economic",       // Focus on building mirrors and economy
    DEFENSIVE = "defensive",      // Build defensive structures early
    AGGRESSIVE = "aggressive",    // Rush with units
    WAVES = "waves"              // Build up then attack in waves
}

// AI Difficulty levels
export enum AIDifficulty {
    EASY = "easy",
    NORMAL = "normal",
    HARD = "hard"
}
