/**
 * Game constants shared across modules
 */

// Influence and particle constants
export const INFLUENCE_RADIUS = 300;
export const PLAYER_1_COLOR = '#0066FF';
export const PLAYER_2_COLOR = '#FF0000';

// Warp gate constants
export const WARP_GATE_CHARGE_TIME = 6.0; // Total seconds to complete
export const WARP_GATE_INITIAL_DELAY = 1.0; // Seconds before warp gate starts
export const WARP_GATE_SPIRAL_RADIUS = 200;
export const WARP_GATE_SPIRAL_MIN_DISTANCE = 5;
export const WARP_GATE_SPIRAL_FORCE_RADIAL = 50;
export const WARP_GATE_SPIRAL_FORCE_TANGENT = 20;
export const WARP_GATE_RADIUS = 50;
export const WARP_GATE_BUTTON_RADIUS = 20;
export const WARP_GATE_BUTTON_OFFSET = 30;

// Particle scatter constants
export const PARTICLE_SCATTER_RADIUS = 150;
export const PARTICLE_SCATTER_FORCE = 200;

// Rendering constants
export const DUST_PARTICLE_SIZE = 2;

// Raytracing constants
export const RAYTRACING_NUM_RAYS = 64; // Number of rays to cast per sun
export const MAX_RAY_DISTANCE = 2000; // Maximum distance for ray casting
export const SHADOW_LENGTH = 1500; // Length of shadows cast by asteroids (increased for strategic asteroids)

// Visibility system constants
export const VISIBILITY_PROXIMITY_RANGE = 150; // Range at which units can see enemies in shade
export const SHADE_OPACITY = 0.3; // Opacity for rendering objects in shade (0-1)
export const STRATEGIC_ASTEROID_SIZE = 120; // Size of strategic asteroids that block visibility
export const STRATEGIC_ASTEROID_DISTANCE = 250; // Distance from sun center for strategic asteroids

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
export const STARLING_ATTACK_RANGE = 150;
export const STARLING_ATTACK_DAMAGE = 5;
export const STARLING_ATTACK_SPEED = 2; // Attacks per second
export const STARLING_MOVE_SPEED = 120; // Pixels per second (faster than regular units)
export const STARLING_SPAWN_INTERVAL = 10.0; // Seconds between spawns
export const STARLING_EXPLORATION_CHANGE_INTERVAL = 5.0; // Change random direction every 5 seconds

// Minigun building constants (offensive building for Radiant faction)
export const MINIGUN_MAX_HEALTH = 200;
export const MINIGUN_ATTACK_RANGE = 350;
export const MINIGUN_ATTACK_DAMAGE = 12;
export const MINIGUN_ATTACK_SPEED = 6; // Attacks per second (very fast)
export const MINIGUN_RADIUS = 30; // Building size

// Building costs
export const MINIGUN_COST = 150;
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
export const UNIT_ARRIVAL_THRESHOLD = 5; // Distance to consider unit arrived at destination

// Solar mirror visual constants
export const MIRROR_ACTIVE_GLOW_RADIUS = 15; // Radius of yellow glow when mirror is active
export const MIRROR_MAX_GLOW_DISTANCE = 1000; // Maximum distance for glow and efficiency calculations
export const MIRROR_PROXIMITY_MULTIPLIER = 2.0; // Maximum solarium generation multiplier at close range

// Ability constants
export const MARINE_ABILITY_COOLDOWN = 5.0; // 5 seconds
export const MARINE_ABILITY_BULLET_COUNT = 15; // Number of bullets in storm
export const MARINE_ABILITY_BULLET_SPEED = 500; // Speed of ability bullets
export const MARINE_ABILITY_BULLET_LIFETIME = 1.0; // Lifetime of ability bullets
export const MARINE_ABILITY_SPREAD_ANGLE = (10 * Math.PI) / 180; // 10 degrees in radians
export const MARINE_ABILITY_BULLET_DAMAGE = 5; // Damage per ability bullet

// UI constants
export const UI_BACKGROUND_COLOR = '#000011'; // Dark blue-black background for UI
export const CLICK_DRAG_THRESHOLD = 5; // Pixels of movement to distinguish click from drag
export const HERO_ATTACK_RANGE_ALPHA = 0.2; // Opacity for hero unit attack range circles

// Visual effect constants
export const TAP_EFFECT_SPEED = 0.05; // Progress increment per frame for tap effect
export const TAP_EFFECT_MAX_RADIUS = 40; // Maximum radius of tap ripple effect
export const SWIPE_EFFECT_SPEED = 0.08; // Progress increment per frame for swipe effect
export const SWIPE_ARROW_SIZE = 15; // Size of the arrow head in swipe effect
