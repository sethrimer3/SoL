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
export const SHADOW_LENGTH = 500; // Length of shadows cast by asteroids

// Marine unit constants
export const MARINE_MAX_HEALTH = 100;
export const MARINE_ATTACK_RANGE = 300;
export const MARINE_ATTACK_DAMAGE = 10;
export const MARINE_ATTACK_SPEED = 5; // Attacks per second (fast shooting)

// Grave unit constants
export const GRAVE_MAX_HEALTH = 150;
export const GRAVE_ATTACK_RANGE = 400;
export const GRAVE_ATTACK_DAMAGE = 15;
export const GRAVE_ATTACK_SPEED = 2; // Attacks per second (projectile launch rate)
export const GRAVE_NUM_PROJECTILES = 5;
export const GRAVE_PROJECTILE_ORBIT_RADIUS = 50;
export const GRAVE_PROJECTILE_MIN_SPEED = 80; // Minimum speed to keep orbiting
export const GRAVE_PROJECTILE_ATTRACTION_FORCE = 300;
export const GRAVE_PROJECTILE_LAUNCH_SPEED = 400;
export const GRAVE_PROJECTILE_TRAIL_LENGTH = 15; // Number of trail particles
export const GRAVE_PROJECTILE_HIT_DISTANCE = 10; // Distance at which projectile hits target

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
