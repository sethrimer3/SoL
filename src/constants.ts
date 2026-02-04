/**
 * Game constants shared across modules
 */

// Influence and particle constants
export const INFLUENCE_RADIUS = 300;
export const PLAYER_1_COLOR = '#0066FF';
export const PLAYER_2_COLOR = '#FF0000';

// LaD (Light and Darkness) mode constants
export const LAD_GOLDEN_OUTLINE = '#ffb805'; // Golden outline color for units/structures in LaD mode

// Warp gate constants
export const WARP_GATE_CHARGE_TIME = 6.0; // Total seconds to complete (deprecated, now energy-based)
export const WARP_GATE_ENERGY_REQUIRED = 100; // Total energy needed to mature a warp gate
export const WARP_GATE_INITIAL_DELAY = 1.0; // Seconds before warp gate starts
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

// Rendering constants
export const DUST_PARTICLE_SIZE = 1;
export const DUST_PARTICLE_DIAMETER_PX = DUST_PARTICLE_SIZE * 2;
export const SPACE_DUST_PARTICLE_COUNT = 3000;
export const DUST_MIN_VELOCITY = 0.08;
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
export const DUST_SHADOW_LENGTH_PX = 18;
export const DUST_SHADOW_OPACITY = 0.25;
export const DUST_SHADOW_WIDTH_PX = 0.6;

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

// Star background parallax constants
export const STAR_WRAP_SIZE = 4000; // Size of the star field wrapping area
export const STAR_LAYER_CONFIGS = [
    { count: 200, parallaxFactor: 0.1, sizeRange: [0.5, 1.0] as [number, number] },   // Far background
    { count: 150, parallaxFactor: 0.2, sizeRange: [0.8, 1.5] as [number, number] },   // Mid-far
    { count: 100, parallaxFactor: 0.35, sizeRange: [1.0, 2.0] as [number, number] },  // Mid-near
    { count: 50, parallaxFactor: 0.5, sizeRange: [1.5, 2.5] as [number, number] }     // Near foreground
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
export const MIRROR_MAX_HEALTH = 100;
export const MIRROR_REGEN_PER_SEC = 2;

// Marine unit constants
export const MARINE_MAX_HEALTH = 100;
export const MARINE_ATTACK_RANGE = 300;
export const MARINE_ATTACK_DAMAGE = 10;
export const MARINE_ATTACK_SPEED = 5; // Attacks per second (fast shooting)

// Grave unit constants
export const GRAVE_MAX_HEALTH = 150;
export const GRAVE_ATTACK_RANGE = 400;
export const GRAVE_HERO_ATTACK_RANGE_MULTIPLIER = 0.25; // Hero Grave units have 75% reduced attack range
export const GRAVE_ATTACK_DAMAGE = 15;
export const GRAVE_ATTACK_SPEED = 2; // Attacks per second (projectile launch rate)
export const GRAVE_NUM_PROJECTILES = 5;
export const GRAVE_PROJECTILE_ORBIT_RADIUS = 50;
export const GRAVE_PROJECTILE_MIN_SPEED = 80; // Minimum speed to keep orbiting
export const GRAVE_PROJECTILE_ATTRACTION_FORCE = 300;
export const GRAVE_PROJECTILE_LAUNCH_SPEED = 400;
export const GRAVE_PROJECTILE_TRAIL_LENGTH = 15; // Number of trail particles
export const GRAVE_PROJECTILE_HIT_DISTANCE = 10; // Distance at which projectile hits target

// Starling unit constants (minions from stellar forge)
export const STARLING_MAX_HEALTH = 50;
export const STARLING_ATTACK_RANGE = 120;
export const STARLING_ATTACK_DAMAGE = 5;
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
export const FORGE_FLAME_ALPHA = 0.75;
export const FORGE_FLAME_SIZE_MULTIPLIER = 0.45;
export const FORGE_FLAME_ROTATION_SPEED_RAD_PER_SEC = Math.PI;
export const FORGE_FLAME_WARMTH_FADE_PER_SEC = 2.0;
export const FORGE_FLAME_OFFSET_MULTIPLIER = 0.35;

// Stellar Forge constants (main base structure)
export const STELLAR_FORGE_MAX_HEALTH = 1000;

// Forge crunch constants (periodic event that spawns minions)
export const FORGE_CRUNCH_INTERVAL = 10.0; // Seconds between crunches
export const FORGE_CRUNCH_SUCK_DURATION = 0.8; // Duration of dust suction phase
export const FORGE_CRUNCH_WAVE_DURATION = 1.2; // Duration of wave push phase
export const FORGE_CRUNCH_SUCK_RADIUS = 250; // Radius of dust suction effect
export const FORGE_CRUNCH_WAVE_RADIUS = 300; // Radius of wave push effect
export const FORGE_CRUNCH_SUCK_FORCE = 150; // Force magnitude pulling dust in
export const FORGE_CRUNCH_WAVE_FORCE = 100; // Force magnitude pushing dust out
export const STARLING_COST_PER_ENERGY = 50; // Energy needed per starling spawned

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

// Building costs (energy-based construction)
// Note: Internal names are different from display names
// MINIGUN = Cannon, GATLING = Gatling Tower, SWIRLER = Cyclone, SUBSIDIARY_FACTORY = Workshop/Foundry
export const MINIGUN_COST = 500; // Cannon
export const GATLING_COST = 250; // Gatling
export const SWIRLER_COST = 750; // Cyclone
export const SUBSIDIARY_FACTORY_COST = 1000; // Workshop/Foundry
export const HERO_UNIT_COST = 300;
export const SOLAR_MIRROR_COST = 50; // Cost to build additional solar mirrors

// Foundry upgrade costs
export const FOUNDRY_STRAFE_UPGRADE_COST = 1000; // Cost to unlock Strafe upgrade
export const FOUNDRY_REGEN_UPGRADE_COST = 1000; // Cost to unlock Regen upgrade
export const FOUNDRY_STRAFE_UPGRADE_ITEM = 'strafe-upgrade';
export const FOUNDRY_REGEN_UPGRADE_ITEM = 'regen-upgrade';
export const SOLAR_MIRROR_FROM_FOUNDRY_COST = 300; // Cost to create solar mirror from foundry
export const STARLING_MERGE_COUNT = 10; // Number of starlings required to merge into a solar mirror
export const STARLING_MERGE_DURATION_SEC = 10.0; // Seconds before merge gate converts to a solar mirror
export const STARLING_MERGE_GATE_RADIUS_PX = 18; // Visual/absorption radius for merge gate
export const STARLING_MERGE_BUTTON_RADIUS_PX = 26; // UI radius for merge button
export const STARLING_MERGE_BUTTON_OFFSET_PX = 70; // UI offset for merge button above starlings

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
export const AI_DEFENSE_RADIUS_PX = 350;
export const AI_STRUCTURE_PLACEMENT_DISTANCE_PX = 140;
export const AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD = Math.PI / 4;
export const HERO_PRODUCTION_TIME_SEC = 8;
export const HERO_BUTTON_RADIUS_PX = 28;
export const HERO_BUTTON_DISTANCE_PX = 100;
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

// UI constants
export const UI_BACKGROUND_COLOR = '#000011'; // Dark blue-black background for UI
export const CLICK_DRAG_THRESHOLD = 10; // Pixels of movement to distinguish click from drag (increased for better tap/drag distinction)
export const SMALL_SELECTION_THRESHOLD = 50; // Maximum selection box size (pixels) to be considered a single-click for double-tap detection
export const HERO_ATTACK_RANGE_ALPHA = 0.2; // Opacity for hero unit attack range circles
export const SOL_ICON_TEXT_SPACING = 2; // Spacing between SoL icon and text in zoom units
export const ABILITY_ARROW_MIN_LENGTH = 10; // Minimum pixel length to display ability arrow (prevents tiny arrows on accidental drags)

// Visual effect constants
export const TAP_EFFECT_SPEED = 0.05; // Progress increment per frame for tap effect
export const TAP_EFFECT_MAX_RADIUS = 40; // Maximum radius of tap ripple effect
export const SWIPE_EFFECT_SPEED = 0.08; // Progress increment per frame for swipe effect
export const PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX = 48; // Max radius for hero/building button waves
export const PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME = 0.12; // Progress increment per frame for production button wave
export const SWIPE_ARROW_SIZE = 15; // Size of the arrow head in swipe effect

// Ray unit constants (Solari hero)
export const RAY_MAX_HEALTH = 120;
export const RAY_ATTACK_RANGE = 250;
export const RAY_ATTACK_DAMAGE = 8;
export const RAY_ATTACK_SPEED = 3; // Attacks per second
export const RAY_ABILITY_COOLDOWN = 8.0; // 8 seconds
export const RAY_BEAM_DAMAGE = 25; // Damage per beam hit
export const RAY_BEAM_MAX_BOUNCES = 5; // Maximum number of bounces
export const RAY_BEAM_WIDTH = 3; // Visual width of the beam

// Influence Ball unit constants (Solari hero)
export const INFLUENCE_BALL_MAX_HEALTH = 100;
export const INFLUENCE_BALL_ATTACK_RANGE = 200;
export const INFLUENCE_BALL_ATTACK_DAMAGE = 5;
export const INFLUENCE_BALL_ATTACK_SPEED = 1.5; // Attacks per second
export const INFLUENCE_BALL_ABILITY_COOLDOWN = 15.0; // 15 seconds
export const INFLUENCE_BALL_PROJECTILE_SPEED = 300;
export const INFLUENCE_BALL_EXPLOSION_RADIUS = 150; // Radius of influence zone
export const INFLUENCE_BALL_DURATION = 10.0; // 10 seconds influence duration

// Turret Deployer unit constants (Solari hero)
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

// AI Strategy types
export enum AIStrategy {
    ECONOMIC = "economic",       // Focus on building mirrors and economy
    DEFENSIVE = "defensive",      // Build defensive structures early
    AGGRESSIVE = "aggressive",    // Rush with units
    WAVES = "waves"              // Build up then attack in waves
}
