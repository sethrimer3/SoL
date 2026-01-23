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
