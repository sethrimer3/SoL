"use strict";
/**
 * Game constants shared across modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC = exports.DUST_CLUSTER_SPAWN_RATIO = exports.DUST_CLUSTER_RADIUS_PX = exports.DUST_CLUSTER_COUNT = exports.DUST_REPULSION_STRENGTH = exports.DUST_REPULSION_CELL_SIZE_PX = exports.DUST_REPULSION_RADIUS_PX = exports.DUST_MIN_VELOCITY = exports.SPACE_DUST_PARTICLE_COUNT = exports.DUST_PARTICLE_DIAMETER_PX = exports.DUST_PARTICLE_SIZE = exports.SHIELD_CENTER_COLLISION_THRESHOLD = exports.FLUID_MIN_DISTANCE = exports.BEAM_PERPENDICULAR_COMPONENT = exports.BEAM_ALONG_COMPONENT = exports.FLUID_RADIAL_COMPONENT = exports.FLUID_FORWARD_COMPONENT = exports.BEAM_FORCE_STRENGTH = exports.BEAM_EFFECT_RADIUS = exports.INFLUENCE_BALL_FORCE_MULTIPLIER = exports.INFLUENCE_BALL_EFFECT_RADIUS = exports.GRAVE_PROJECTILE_FORCE_MULTIPLIER = exports.GRAVE_PROJECTILE_EFFECT_RADIUS = exports.DEFAULT_PROJECTILE_DAMAGE = exports.MINION_PROJECTILE_FORCE_MULTIPLIER = exports.MINION_PROJECTILE_EFFECT_RADIUS = exports.ABILITY_BULLET_FORCE_MULTIPLIER = exports.ABILITY_BULLET_EFFECT_RADIUS = exports.PARTICLE_SCATTER_FORCE = exports.PARTICLE_SCATTER_RADIUS = exports.WARP_GATE_COMPLETION_WINDOW_SEC = exports.WARP_GATE_CANCEL_DECAY_ENERGY_PER_SEC = exports.WARP_GATE_SHOCKWAVE_PROGRESS_PER_FRAME = exports.WARP_GATE_SHOCKWAVE_MAX_RADIUS_PX = exports.WARP_GATE_BUTTON_HIT_RADIUS_PX = exports.WARP_GATE_BUTTON_OFFSET = exports.WARP_GATE_BUTTON_RADIUS = exports.WARP_GATE_RADIUS = exports.WARP_GATE_SPIRAL_FORCE_TANGENT = exports.WARP_GATE_SPIRAL_FORCE_RADIAL = exports.WARP_GATE_SPIRAL_MIN_DISTANCE = exports.WARP_GATE_SPIRAL_RADIUS = exports.MIRROR_WARP_GATE_HOLD_DURATION_MS = exports.WARP_GATE_INITIAL_DELAY = exports.WARP_GATE_ENERGY_REQUIRED = exports.WARP_GATE_CHARGE_TIME = exports.LAD_SUN_OUTLINE_COLOR = exports.PLAYER_2_COLOR = exports.PLAYER_1_COLOR = exports.INFLUENCE_RADIUS = void 0;
exports.MAP_PLAYABLE_BOUNDARY = exports.BORDER_FADE_WIDTH = exports.MAP_SIZE = exports.ASTEROID_MAX_SIZE = exports.ASTEROID_MIN_SIZE = exports.STRATEGIC_ASTEROID_DISTANCE = exports.STRATEGIC_ASTEROID_SIZE = exports.SHADE_OPACITY = exports.VISIBILITY_PROXIMITY_RANGE = exports.SHADOW_LENGTH = exports.MAX_RAY_DISTANCE = exports.RAYTRACING_NUM_RAYS = exports.STAR_LAYER_CONFIGS = exports.STAR_WRAP_SIZE = exports.DUST_GLOW_TRANSITION_SPEED_DOWN = exports.DUST_GLOW_TRANSITION_SPEED_UP = exports.DUST_FADE_TO_SLIGHT_DELAY_MS = exports.DUST_FADE_TO_NORMAL_DELAY_MS = exports.DUST_SLOW_MOVEMENT_THRESHOLD = exports.DUST_FAST_MOVEMENT_THRESHOLD = exports.DUST_GLOW_STATE_FULL = exports.DUST_GLOW_STATE_SLIGHT = exports.DUST_GLOW_STATE_NORMAL = exports.MOVEMENT_POINT_ANIMATION_FPS = exports.MOVEMENT_POINT_ANIMATION_FRAME_COUNT = exports.STARLING_SPRITE_ROTATION_OFFSET_RAD = exports.STARLING_SPRITE_SCALE_FACTOR = exports.DUST_SPRITE_SCALE_FACTOR = exports.SCREEN_SHAKE_DECAY = exports.SCREEN_SHAKE_INTENSITY = exports.SCREEN_SHAKE_DURATION = exports.DUST_TRAIL_WIDTH_PX = exports.DUST_TRAIL_LENGTH_PER_SPEED = exports.DUST_TRAIL_MAX_LENGTH_PX = exports.DUST_TRAIL_MIN_LENGTH_PX = exports.DUST_TRAIL_MIN_SPEED_PX_PER_SEC = exports.DUST_SHADOW_WIDTH_PX = exports.DUST_SHADOW_OPACITY = exports.DUST_SHADOW_LENGTH_PX = exports.DUST_SHADOW_MAX_DISTANCE_PX = exports.DUST_COLOR_FORCE_SCALE = exports.DUST_COLOR_FADE_OUT_SPEED = exports.DUST_COLOR_FADE_IN_SPEED = exports.DUST_COLOR_IMPACT_HOLD_SEC = exports.STARLING_DUST_PUSH_FORCE_MULTIPLIER = exports.STARLING_DUST_PUSH_RADIUS_PX = exports.FORGE_DUST_PUSH_FORCE_MULTIPLIER = exports.FORGE_DUST_PUSH_RADIUS_PX = exports.MIRROR_DUST_PUSH_FORCE_MULTIPLIER = exports.MIRROR_DUST_PUSH_RADIUS_PX = void 0;
exports.STARLING_LASER_WIDTH_PX = exports.STARLING_LASER_PARTICLE_LIFETIME = exports.STARLING_LASER_PARTICLE_SPEED = exports.STARLING_LASER_IMPACT_PARTICLES = exports.STARLING_COLLISION_RADIUS_PX = exports.STARLING_PROJECTILE_HIT_RADIUS_PX = exports.STARLING_PROJECTILE_MAX_RANGE_PX = exports.STARLING_PROJECTILE_SPEED = exports.STARLING_EXPLORATION_CHANGE_INTERVAL = exports.STARLING_SPAWN_INTERVAL = exports.STARLING_MOVE_ACCELERATION_PX_PER_SEC = exports.STARLING_MOVE_SPEED = exports.STARLING_ATTACK_SPEED = exports.STARLING_ATTACK_UPGRADE_BONUS = exports.STARLING_ATTACK_DAMAGE = exports.STARLING_ATTACK_RANGE = exports.STARLING_MAX_HEALTH = exports.GRAVE_BLACK_HOLE_SPEED = exports.GRAVE_BLACK_HOLE_SIZE = exports.GRAVE_BLACK_HOLE_DURATION = exports.GRAVE_SMALL_PARTICLE_DRAG = exports.GRAVE_SMALL_PARTICLE_ATTRACTION_FORCE = exports.GRAVE_SMALL_PARTICLE_SPLASH_FALLOFF = exports.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS = exports.GRAVE_SMALL_PARTICLE_DAMAGE = exports.GRAVE_SMALL_PARTICLE_SIZE = exports.GRAVE_SMALL_PARTICLE_SPEED = exports.GRAVE_SMALL_PARTICLES_PER_ATTACK = exports.GRAVE_SMALL_PARTICLE_REGEN_RATE = exports.GRAVE_MAX_SMALL_PARTICLES = exports.GRAVE_PROJECTILE_HIT_DISTANCE = exports.GRAVE_PROJECTILE_TRAIL_LENGTH = exports.GRAVE_PROJECTILE_LAUNCH_SPEED = exports.GRAVE_PROJECTILE_ATTRACTION_FORCE = exports.GRAVE_PROJECTILE_MIN_SPEED = exports.GRAVE_PROJECTILE_ORBIT_RADIUS = exports.GRAVE_NUM_PROJECTILES = exports.GRAVE_ATTACK_SPEED = exports.GRAVE_ATTACK_DAMAGE = exports.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER = exports.GRAVE_ATTACK_RANGE = exports.GRAVE_MAX_HEALTH = exports.MARINE_ATTACK_SPEED = exports.MARINE_ATTACK_DAMAGE = exports.MARINE_ATTACK_RANGE = exports.MARINE_MAX_HEALTH = exports.MIRROR_REGEN_PER_SEC = exports.MIRROR_MAX_HEALTH = exports.MIRROR_COUNTDOWN_DEPLOY_DISTANCE = exports.COUNTDOWN_DURATION = void 0;
exports.SUBSIDIARY_FACTORY_ATTACK_SPEED = exports.SUBSIDIARY_FACTORY_ATTACK_DAMAGE = exports.SUBSIDIARY_FACTORY_ATTACK_RANGE = exports.SUBSIDIARY_FACTORY_MAX_HEALTH = exports.SWIRLER_DUST_SPEED_MULTIPLIER = exports.SWIRLER_DUST_ORBIT_SPEED_BASE = exports.SWIRLER_MIN_INFLUENCE_RADIUS = exports.SWIRLER_SHRINK_DAMAGE_MULTIPLIER = exports.SWIRLER_SHRINK_BASE_RATE = exports.SWIRLER_GROWTH_RATE_PER_SEC = exports.SWIRLER_INITIAL_RADIUS_MULTIPLIER = exports.SWIRLER_INFLUENCE_RADIUS = exports.SWIRLER_RADIUS = exports.SWIRLER_ATTACK_SPEED = exports.SWIRLER_ATTACK_DAMAGE = exports.SWIRLER_ATTACK_RANGE = exports.SWIRLER_MAX_HEALTH = exports.GATLING_RADIUS = exports.GATLING_ATTACK_SPEED = exports.GATLING_ATTACK_DAMAGE = exports.GATLING_ATTACK_RANGE = exports.GATLING_MAX_HEALTH = exports.MINIGUN_RADIUS = exports.MINIGUN_LASER_WIDTH_PX = exports.MINIGUN_ATTACK_SPEED = exports.MINIGUN_ATTACK_DAMAGE = exports.MINIGUN_ATTACK_RANGE = exports.MINIGUN_MAX_HEALTH = exports.STARLING_SACRIFICE_ENERGY_MULTIPLIER = exports.STARLING_COST_PER_ENERGY = exports.FORGE_CRUNCH_WAVE_FORCE = exports.FORGE_CRUNCH_SUCK_FORCE = exports.FORGE_CRUNCH_WAVE_RADIUS = exports.FORGE_CRUNCH_SUCK_RADIUS = exports.FORGE_CRUNCH_WAVE_DURATION = exports.FORGE_CRUNCH_SUCK_DURATION = exports.FORGE_CRUNCH_INTERVAL = exports.STELLAR_FORGE_STARLING_DEFENSE = exports.STELLAR_FORGE_MAX_HEALTH = exports.FORGE_FLAME_OFFSET_MULTIPLIER = exports.FORGE_FLAME_WARMTH_FADE_PER_SEC = exports.FORGE_FLAME_ROTATION_SPEED_RAD_PER_SEC = exports.FORGE_FLAME_SIZE_MULTIPLIER = exports.FORGE_FLAME_ALPHA = exports.STARLING_MAX_COUNT = exports.STARLING_GROUP_STOP_SPACING_PX = exports.STARLING_GROUP_STOP_BASE_RADIUS_PX = exports.STARLING_BLINK_COOLDOWN_SEC = exports.STARLING_BLINK_DISTANCE_PX = exports.STARLING_REGEN_RATE_PER_SEC = void 0;
exports.AI_MIRROR_COMMAND_INTERVAL_SEC = exports.STARLING_MERGE_HOLD_RADIUS_PX = exports.STARLING_MERGE_HOLD_DURATION_MS = exports.STARLING_MERGE_GATE_MAX_HEALTH = exports.STARLING_MERGE_GATE_RADIUS_PX = exports.STARLING_MERGE_DURATION_SEC = exports.STARLING_MERGE_COUNT = exports.FOUNDRY_BLINK_UPGRADE_ITEM = exports.FOUNDRY_BLINK_UPGRADE_COST = exports.SOLAR_MIRROR_FROM_FOUNDRY_COST = exports.FOUNDRY_ATTACK_UPGRADE_ITEM = exports.FOUNDRY_REGEN_UPGRADE_ITEM = exports.FOUNDRY_STRAFE_UPGRADE_ITEM = exports.FOUNDRY_ATTACK_UPGRADE_COST = exports.FOUNDRY_REGEN_UPGRADE_COST = exports.FOUNDRY_STRAFE_UPGRADE_COST = exports.SOLAR_MIRROR_COST = exports.HERO_UNIT_COST = exports.SHIELD_TOWER_COST = exports.LOCKON_TOWER_COST = exports.STRIKER_TOWER_COST = exports.SUBSIDIARY_FACTORY_COST = exports.SWIRLER_COST = exports.GATLING_COST = exports.MINIGUN_COST = exports.UNIT_VISIBILITY_RADIUS = exports.SHIELD_TOWER_REGENERATION_TIME = exports.SHIELD_TOWER_SHIELD_HEALTH = exports.SHIELD_TOWER_SHIELD_RADIUS = exports.SHIELD_TOWER_RADIUS = exports.SHIELD_TOWER_ATTACK_SPEED = exports.SHIELD_TOWER_ATTACK_DAMAGE = exports.SHIELD_TOWER_ATTACK_RANGE = exports.SHIELD_TOWER_MAX_HEALTH = exports.LOCKON_TOWER_LASER_WIDTH_PX = exports.LOCKON_TOWER_LOCKON_TIME = exports.LOCKON_TOWER_RADIUS = exports.LOCKON_TOWER_ATTACK_SPEED = exports.LOCKON_TOWER_ATTACK_DAMAGE = exports.LOCKON_TOWER_ATTACK_RANGE = exports.LOCKON_TOWER_MAX_HEALTH = exports.STRIKER_TOWER_EXPLOSION_RADIUS = exports.STRIKER_TOWER_RELOAD_TIME = exports.STRIKER_TOWER_RADIUS = exports.STRIKER_TOWER_ATTACK_SPEED = exports.STRIKER_TOWER_ATTACK_DAMAGE = exports.STRIKER_TOWER_ATTACK_RANGE = exports.STRIKER_TOWER_MAX_HEALTH = exports.SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL = exports.SUBSIDIARY_FACTORY_RADIUS = void 0;
exports.MIRROR_MAX_GLOW_DISTANCE = exports.MIRROR_CLICK_RADIUS_PX = exports.MIRROR_ACTIVE_GLOW_RADIUS = exports.STATE_HASH_TICK_INTERVAL = exports.UNIT_PATH_DRAW_RADIUS = exports.MIN_WAYPOINT_DISTANCE = exports.PATH_WAYPOINT_ARRIVAL_MULTIPLIER = exports.UNIT_STRUCTURE_STANDOFF_PX = exports.UNIT_MINION_YIELD_MULTIPLIER = exports.UNIT_HERO_AVOIDANCE_MULTIPLIER = exports.UNIT_ASTEROID_AVOIDANCE_STRENGTH = exports.UNIT_ASTEROID_AVOIDANCE_BUFFER_PX = exports.UNIT_ASTEROID_AVOIDANCE_LOOKAHEAD_PX = exports.UNIT_AVOIDANCE_STRENGTH = exports.UNIT_AVOIDANCE_RANGE_PX = exports.UNIT_RADIUS_PX = exports.UNIT_ARRIVAL_THRESHOLD = exports.UNIT_TURN_SPEED_RAD_PER_SEC = exports.UNIT_MOVE_SPEED = exports.CASING_COLLISION_DAMPING = exports.CASING_SPACEDUST_FORCE = exports.CASING_SPACEDUST_COLLISION_DISTANCE = exports.BOUNCING_BULLET_SPEED_MAX = exports.BOUNCING_BULLET_SPEED_MIN = exports.BOUNCING_BULLET_LIFETIME = exports.BULLET_CASING_SPEED_MAX = exports.BULLET_CASING_SPEED_MIN = exports.BULLET_CASING_LIFETIME = exports.MUZZLE_FLASH_DURATION = exports.BUILDING_BUILD_TIME = exports.FORGE_UPGRADE_BUTTON_DISTANCE_PX = exports.FORGE_UPGRADE_BUTTON_RADIUS_PX = exports.HERO_BUTTON_DISTANCE_PX = exports.HERO_BUTTON_RADIUS_PX = exports.HERO_PRODUCTION_TIME_SEC = exports.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD = exports.AI_STRUCTURE_PLACEMENT_DISTANCE_PX = exports.AI_DEFENSE_RADIUS_PX = exports.AI_MIRROR_REPOSITION_THRESHOLD_PX = exports.AI_MIRROR_ARC_SPACING_RAD = exports.AI_MIRROR_SUN_DISTANCE_PX = exports.AI_WAVES_HERO_MULTIPLIER = exports.AI_ECONOMIC_HERO_MULTIPLIER = exports.AI_AGGRESSIVE_HERO_MULTIPLIER = exports.AI_WAVES_ATTACK_THRESHOLD = exports.AI_MAX_MIRRORS = exports.AI_MIRROR_PURCHASE_INTERVAL_SEC = exports.AI_STRUCTURE_COMMAND_INTERVAL_SEC = exports.AI_HERO_COMMAND_INTERVAL_SEC = exports.AI_DEFENSE_COMMAND_INTERVAL_SEC = void 0;
exports.DEPLOYED_TURRET_HEALTH_BAR_SIZE = exports.DEPLOYED_TURRET_ANIMATION_FRAME_COUNT = exports.DEPLOYED_TURRET_SPRITE_SCALE = exports.DEPLOYED_TURRET_ANIMATION_DURATION = exports.TURRET_PROJECTILE_SPEED = exports.DEPLOYED_TURRET_ATTACK_SPEED = exports.DEPLOYED_TURRET_ATTACK_DAMAGE = exports.DEPLOYED_TURRET_ATTACK_RANGE = exports.DEPLOYED_TURRET_MAX_HEALTH = exports.TURRET_DEPLOYER_ABILITY_COOLDOWN = exports.TURRET_DEPLOYER_ATTACK_SPEED = exports.TURRET_DEPLOYER_ATTACK_DAMAGE = exports.TURRET_DEPLOYER_ATTACK_RANGE = exports.TURRET_DEPLOYER_MAX_HEALTH = exports.INFLUENCE_BALL_DURATION = exports.INFLUENCE_BALL_EXPLOSION_RADIUS = exports.INFLUENCE_BALL_PROJECTILE_SPEED = exports.INFLUENCE_BALL_ABILITY_COOLDOWN = exports.INFLUENCE_BALL_ATTACK_SPEED = exports.INFLUENCE_BALL_ATTACK_DAMAGE = exports.INFLUENCE_BALL_ATTACK_RANGE = exports.INFLUENCE_BALL_MAX_HEALTH = exports.RAY_BEAM_WIDTH = exports.RAY_BEAM_MAX_BOUNCES = exports.RAY_BEAM_DAMAGE = exports.RAY_ABILITY_COOLDOWN = exports.RAY_ATTACK_SPEED = exports.RAY_ATTACK_DAMAGE = exports.RAY_ATTACK_RANGE = exports.RAY_MAX_HEALTH = exports.SWIPE_ARROW_SIZE = exports.PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME = exports.PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX = exports.SWIPE_EFFECT_SPEED = exports.TAP_EFFECT_MAX_RADIUS = exports.TAP_EFFECT_SPEED = exports.SHIELD_HEALTH_BAR_VERTICAL_OFFSET = exports.ABILITY_ARROW_MIN_LENGTH = exports.SOL_ICON_TEXT_SPACING = exports.HERO_ATTACK_RANGE_ALPHA = exports.SMALL_SELECTION_THRESHOLD = exports.CLICK_DRAG_THRESHOLD = exports.UI_BACKGROUND_COLOR = exports.MARINE_ABILITY_BULLET_DAMAGE = exports.MARINE_ABILITY_SPREAD_ANGLE = exports.MARINE_ABILITY_BULLET_LIFETIME = exports.MARINE_ABILITY_BULLET_SPEED = exports.MARINE_ABILITY_BULLET_COUNT = exports.MARINE_ABILITY_COOLDOWN = exports.MIRROR_PROXIMITY_MULTIPLIER = void 0;
exports.MORTAR_SPLASH_DAMAGE_FALLOFF = exports.MORTAR_SPLASH_RADIUS = exports.MORTAR_DETECTION_CONE_ANGLE = exports.MORTAR_ABILITY_COOLDOWN = exports.MORTAR_ATTACK_SPEED = exports.MORTAR_ATTACK_DAMAGE = exports.MORTAR_ATTACK_RANGE = exports.MORTAR_MAX_HEALTH = exports.SPOTLIGHT_BULLET_HIT_RADIUS_PX = exports.SPOTLIGHT_BULLET_LENGTH_PX = exports.SPOTLIGHT_BULLET_WIDTH_PX = exports.SPOTLIGHT_BULLET_LIFETIME_SEC = exports.SPOTLIGHT_BULLET_DAMAGE = exports.SPOTLIGHT_BULLET_SPEED = exports.SPOTLIGHT_FIRE_RATE_PER_SEC = exports.SPOTLIGHT_CONE_ANGLE_RAD = exports.SPOTLIGHT_TEARDOWN_TIME_SEC = exports.SPOTLIGHT_ACTIVE_TIME_SEC = exports.SPOTLIGHT_SETUP_TIME_SEC = exports.SPOTLIGHT_ABILITY_COOLDOWN = exports.SPOTLIGHT_ATTACK_SPEED = exports.SPOTLIGHT_ATTACK_DAMAGE = exports.SPOTLIGHT_ATTACK_RANGE = exports.SPOTLIGHT_MAX_HEALTH = exports.BEAM_ABILITY_DAMAGE_PER_DISTANCE = exports.BEAM_ABILITY_MAX_RANGE = exports.BEAM_ABILITY_BASE_DAMAGE = exports.BEAM_ABILITY_COOLDOWN = exports.BEAM_ATTACK_SPEED = exports.BEAM_ATTACK_DAMAGE = exports.BEAM_ATTACK_RANGE = exports.BEAM_MAX_HEALTH = exports.DAGGER_CLOAK_OPACITY = exports.DAGGER_VISIBILITY_DURATION = exports.DAGGER_ABILITY_DAMAGE = exports.DAGGER_ABILITY_RANGE = exports.DAGGER_ABILITY_COOLDOWN = exports.DAGGER_ATTACK_SPEED = exports.DAGGER_ATTACK_DAMAGE = exports.DAGGER_ATTACK_RANGE = exports.DAGGER_MAX_HEALTH = exports.DRILLER_DECELERATION = exports.DRILLER_BUILDING_DAMAGE_MULTIPLIER = exports.DRILLER_DRILL_DAMAGE = exports.DRILLER_DRILL_SPEED = exports.DRILLER_ABILITY_COOLDOWN = exports.DRILLER_ATTACK_SPEED = exports.DRILLER_ATTACK_DAMAGE = exports.DRILLER_ATTACK_RANGE = exports.DRILLER_MAX_HEALTH = void 0;
exports.SLY_MAX_HEALTH = exports.NOVA_BOMB_RADIUS = exports.NOVA_BOMB_SCATTER_BULLET_LIFETIME = exports.NOVA_BOMB_SCATTER_BULLET_DAMAGE = exports.NOVA_BOMB_SCATTER_BULLET_SPEED = exports.NOVA_BOMB_SCATTER_BULLET_COUNT = exports.NOVA_BOMB_SCATTER_ARC = exports.NOVA_BOMB_EXPLOSION_RADIUS = exports.NOVA_BOMB_EXPLOSION_DAMAGE = exports.NOVA_BOMB_MAX_BOUNCES = exports.NOVA_BOMB_BOUNCE_DAMPING = exports.NOVA_BOMB_ARMING_TIME = exports.NOVA_BOMB_MIN_SPEED = exports.NOVA_BOMB_DECELERATION = exports.NOVA_BOMB_INITIAL_SPEED = exports.NOVA_ABILITY_COOLDOWN = exports.NOVA_ATTACK_SPEED = exports.NOVA_ATTACK_DAMAGE = exports.NOVA_ATTACK_RANGE = exports.NOVA_MAX_HEALTH = exports.TANK_COLLISION_RADIUS_PX = exports.TANK_STUN_DURATION = exports.TANK_WAVE_WIDTH = exports.TANK_WAVE_SPEED = exports.TANK_WAVE_RANGE = exports.TANK_WAVE_ANGLE = exports.TANK_SHIELD_RADIUS = exports.TANK_ABILITY_COOLDOWN = exports.TANK_DEFENSE = exports.TANK_ATTACK_SPEED = exports.TANK_ATTACK_DAMAGE = exports.TANK_ATTACK_RANGE = exports.TANK_MAX_HEALTH = exports.PREIST_HEALING_BOMB_PARTICLE_LIFETIME = exports.PREIST_HEALING_BOMB_PARTICLE_SPEED = exports.PREIST_HEALING_BOMB_EXPLOSION_RADIUS = exports.PREIST_HEALING_BOMB_PARTICLE_HEALING = exports.PREIST_HEALING_BOMB_PARTICLE_COUNT = exports.PREIST_HEALING_BOMB_MAX_RANGE = exports.PREIST_HEALING_BOMB_SPEED = exports.PREIST_NUM_BEAMS = exports.PREIST_TARGET_LOCK_DURATION = exports.PREIST_HEALING_PER_SECOND = exports.PREIST_HEALING_RANGE = exports.PREIST_ABILITY_COOLDOWN = exports.PREIST_ATTACK_SPEED = exports.PREIST_ATTACK_DAMAGE = exports.PREIST_ATTACK_RANGE = exports.PREIST_MAX_HEALTH = exports.MORTAR_PROJECTILE_SPEED = void 0;
exports.AIStrategy = exports.STICKY_BOMB_LASER_DURATION = exports.STICKY_BOMB_LASER_RANGE = exports.STICKY_BOMB_LASER_ANGLE = exports.STICKY_BOMB_DIAGONAL_LASER_WIDTH = exports.STICKY_BOMB_DIAGONAL_LASER_DAMAGE = exports.STICKY_BOMB_WIDE_LASER_WIDTH = exports.STICKY_BOMB_WIDE_LASER_DAMAGE = exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_LIFETIME = exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_SPEED = exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_COUNT = exports.STICKY_BOMB_RADIUS = exports.STICKY_BOMB_MAX_LIFETIME = exports.STICKY_BOMB_ARM_TIME = exports.STICKY_BOMB_STICK_DISTANCE = exports.STICKY_BOMB_MIN_SPEED = exports.STICKY_BOMB_DECELERATION = exports.STICKY_BOMB_INITIAL_SPEED = exports.SLY_ABILITY_COOLDOWN = exports.SLY_ATTACK_SPEED = exports.SLY_ATTACK_DAMAGE = exports.SLY_ATTACK_RANGE = void 0;
// Influence and particle constants
exports.INFLUENCE_RADIUS = 300;
exports.PLAYER_1_COLOR = '#0066FF';
exports.PLAYER_2_COLOR = '#FF0000';
// LaD (Light and Darkness) mode constants
// Removed LAD_GOLDEN_OUTLINE - replaced with player/enemy color auras
exports.LAD_SUN_OUTLINE_COLOR = '#FFD700'; // Golden outline color for LaD sun circle
// Warp gate constants
exports.WARP_GATE_CHARGE_TIME = 6.0; // Total seconds to complete (deprecated, now energy-based)
exports.WARP_GATE_ENERGY_REQUIRED = 100; // Total energy needed to mature a warp gate
exports.WARP_GATE_INITIAL_DELAY = 1.0; // Seconds before warp gate starts
exports.MIRROR_WARP_GATE_HOLD_DURATION_MS = 1000;
exports.WARP_GATE_SPIRAL_RADIUS = 200;
exports.WARP_GATE_SPIRAL_MIN_DISTANCE = 5;
exports.WARP_GATE_SPIRAL_FORCE_RADIAL = 50;
exports.WARP_GATE_SPIRAL_FORCE_TANGENT = 20;
exports.WARP_GATE_RADIUS = 50;
exports.WARP_GATE_BUTTON_RADIUS = 28; // Match hero button size
exports.WARP_GATE_BUTTON_OFFSET = 30;
exports.WARP_GATE_BUTTON_HIT_RADIUS_PX = 40;
exports.WARP_GATE_SHOCKWAVE_MAX_RADIUS_PX = 220;
exports.WARP_GATE_SHOCKWAVE_PROGRESS_PER_FRAME = 0.06;
exports.WARP_GATE_CANCEL_DECAY_ENERGY_PER_SEC = 220;
exports.WARP_GATE_COMPLETION_WINDOW_SEC = 20;
// Particle scatter constants
exports.PARTICLE_SCATTER_RADIUS = 150;
exports.PARTICLE_SCATTER_FORCE = 200;
// Fluid simulation constants for particle displacement
exports.ABILITY_BULLET_EFFECT_RADIUS = 30;
exports.ABILITY_BULLET_FORCE_MULTIPLIER = 0.5;
exports.MINION_PROJECTILE_EFFECT_RADIUS = 25;
exports.MINION_PROJECTILE_FORCE_MULTIPLIER = 0.4;
exports.DEFAULT_PROJECTILE_DAMAGE = 5; // Default damage for projectiles with unknown damage values
exports.GRAVE_PROJECTILE_EFFECT_RADIUS = 20;
exports.GRAVE_PROJECTILE_FORCE_MULTIPLIER = 0.4;
exports.INFLUENCE_BALL_EFFECT_RADIUS = 35;
exports.INFLUENCE_BALL_FORCE_MULTIPLIER = 0.5;
exports.BEAM_EFFECT_RADIUS = 40;
exports.BEAM_FORCE_STRENGTH = 300;
exports.FLUID_FORWARD_COMPONENT = 0.6; // Forward push component for moving objects
exports.FLUID_RADIAL_COMPONENT = 0.4; // Radial displacement component for moving objects
exports.BEAM_ALONG_COMPONENT = 0.7; // Along beam direction component
exports.BEAM_PERPENDICULAR_COMPONENT = 0.3; // Perpendicular push component for beams
exports.FLUID_MIN_DISTANCE = 0.1; // Minimum distance to avoid division by zero in fluid calculations
exports.SHIELD_CENTER_COLLISION_THRESHOLD = 0.1; // Minimum distance from shield tower center to calculate push direction
// Rendering constants
exports.DUST_PARTICLE_SIZE = 1;
exports.DUST_PARTICLE_DIAMETER_PX = exports.DUST_PARTICLE_SIZE * 2;
exports.SPACE_DUST_PARTICLE_COUNT = 3000;
exports.DUST_MIN_VELOCITY = 0.2;
exports.DUST_REPULSION_RADIUS_PX = exports.DUST_PARTICLE_DIAMETER_PX;
exports.DUST_REPULSION_CELL_SIZE_PX = exports.DUST_PARTICLE_DIAMETER_PX * 4;
exports.DUST_REPULSION_STRENGTH = 0.8;
exports.DUST_CLUSTER_COUNT = 8;
exports.DUST_CLUSTER_RADIUS_PX = 220;
exports.DUST_CLUSTER_SPAWN_RATIO = 0.35;
exports.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC = 3;
exports.MIRROR_DUST_PUSH_RADIUS_PX = 110;
exports.MIRROR_DUST_PUSH_FORCE_MULTIPLIER = 1.1;
exports.FORGE_DUST_PUSH_RADIUS_PX = 160;
exports.FORGE_DUST_PUSH_FORCE_MULTIPLIER = 0.9;
exports.STARLING_DUST_PUSH_RADIUS_PX = 50;
exports.STARLING_DUST_PUSH_FORCE_MULTIPLIER = 0.5;
exports.DUST_COLOR_IMPACT_HOLD_SEC = 0.08;
exports.DUST_COLOR_FADE_IN_SPEED = 7.5;
exports.DUST_COLOR_FADE_OUT_SPEED = 1.4;
exports.DUST_COLOR_FORCE_SCALE = 35;
exports.DUST_SHADOW_MAX_DISTANCE_PX = 420;
exports.DUST_SHADOW_LENGTH_PX = 18;
exports.DUST_SHADOW_OPACITY = 0.25;
exports.DUST_SHADOW_WIDTH_PX = 0.6;
exports.DUST_TRAIL_MIN_SPEED_PX_PER_SEC = 2;
exports.DUST_TRAIL_MIN_LENGTH_PX = 2;
exports.DUST_TRAIL_MAX_LENGTH_PX = 8;
exports.DUST_TRAIL_LENGTH_PER_SPEED = 0.08;
exports.DUST_TRAIL_WIDTH_PX = 0.6;
// Screen shake constants
exports.SCREEN_SHAKE_DURATION = 0.3; // Duration of screen shake in seconds
exports.SCREEN_SHAKE_INTENSITY = 8; // Maximum shake offset in pixels
exports.SCREEN_SHAKE_DECAY = 0.9; // Decay rate for shake intensity per frame
// Sprite scaling constants
exports.DUST_SPRITE_SCALE_FACTOR = 3;
exports.STARLING_SPRITE_SCALE_FACTOR = 6;
exports.STARLING_SPRITE_ROTATION_OFFSET_RAD = Math.PI / 2;
exports.MOVEMENT_POINT_ANIMATION_FRAME_COUNT = 30; // Number of movement point animation frames
exports.MOVEMENT_POINT_ANIMATION_FPS = 60; // Movement point animation speed (frames per second)
// Space dust glow constants
exports.DUST_GLOW_STATE_NORMAL = 0;
exports.DUST_GLOW_STATE_SLIGHT = 1;
exports.DUST_GLOW_STATE_FULL = 2;
exports.DUST_FAST_MOVEMENT_THRESHOLD = 5;
exports.DUST_SLOW_MOVEMENT_THRESHOLD = 1;
exports.DUST_FADE_TO_NORMAL_DELAY_MS = 2000;
exports.DUST_FADE_TO_SLIGHT_DELAY_MS = 1000;
exports.DUST_GLOW_TRANSITION_SPEED_UP = 3.0;
exports.DUST_GLOW_TRANSITION_SPEED_DOWN = 0.5;
// Star background parallax constants
exports.STAR_WRAP_SIZE = 4000; // Size of the star field wrapping area
exports.STAR_LAYER_CONFIGS = [
    { count: 600, parallaxFactor: 0.1, sizeRange: [0.4, 0.9] }, // Far background
    { count: 450, parallaxFactor: 0.2, sizeRange: [0.6, 1.2] }, // Mid-far
    { count: 300, parallaxFactor: 0.35, sizeRange: [0.8, 1.6] }, // Mid-near
    { count: 200, parallaxFactor: 0.5, sizeRange: [1.0, 2.2] } // Near foreground
];
// Raytracing constants
exports.RAYTRACING_NUM_RAYS = 64; // Number of rays to cast per sun
exports.MAX_RAY_DISTANCE = 2000; // Maximum distance for ray casting
exports.SHADOW_LENGTH = 1500; // Length of shadows cast by asteroids (increased for strategic asteroids)
// Visibility system constants
exports.VISIBILITY_PROXIMITY_RANGE = 150; // Range at which units can see enemies in shade
exports.SHADE_OPACITY = 0.3; // Opacity for rendering objects in shade (0-1)
exports.STRATEGIC_ASTEROID_SIZE = 120; // Size of strategic asteroids that block visibility
exports.STRATEGIC_ASTEROID_DISTANCE = 250; // Distance from sun center for strategic asteroids
exports.ASTEROID_MIN_SIZE = 30;
exports.ASTEROID_MAX_SIZE = exports.STRATEGIC_ASTEROID_SIZE;
// Map boundary constants
exports.MAP_SIZE = 2000; // Total map size in world units (centered at 0,0)
exports.BORDER_FADE_WIDTH = 150; // Width of dark border fade zone
exports.MAP_PLAYABLE_BOUNDARY = (exports.MAP_SIZE / 2) - exports.BORDER_FADE_WIDTH; // Units cannot move beyond this boundary
// Countdown and mirror constants
exports.COUNTDOWN_DURATION = 3.0; // Countdown duration in seconds
exports.MIRROR_COUNTDOWN_DEPLOY_DISTANCE = 150; // Distance mirrors move from base during countdown
exports.MIRROR_MAX_HEALTH = 100;
exports.MIRROR_REGEN_PER_SEC = 2;
// Marine unit constants
exports.MARINE_MAX_HEALTH = 100;
exports.MARINE_ATTACK_RANGE = 300;
exports.MARINE_ATTACK_DAMAGE = 10;
exports.MARINE_ATTACK_SPEED = 5; // Attacks per second (fast shooting)
// Grave unit constants
exports.GRAVE_MAX_HEALTH = 150;
exports.GRAVE_ATTACK_RANGE = 400;
exports.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER = 0.25; // Hero Grave units have 75% reduced attack range
exports.GRAVE_ATTACK_DAMAGE = 15;
exports.GRAVE_ATTACK_SPEED = 2; // Attacks per second (projectile launch rate)
exports.GRAVE_NUM_PROJECTILES = 6; // Number of large particles
exports.GRAVE_PROJECTILE_ORBIT_RADIUS = 18;
exports.GRAVE_PROJECTILE_MIN_SPEED = 80; // Minimum speed to keep orbiting
exports.GRAVE_PROJECTILE_ATTRACTION_FORCE = 300;
exports.GRAVE_PROJECTILE_LAUNCH_SPEED = 400;
exports.GRAVE_PROJECTILE_TRAIL_LENGTH = 15; // Number of trail particles
exports.GRAVE_PROJECTILE_HIT_DISTANCE = 10; // Distance at which projectile hits target
exports.GRAVE_MAX_SMALL_PARTICLES = 30; // Maximum number of small particles
exports.GRAVE_SMALL_PARTICLE_REGEN_RATE = 1; // Small particles regenerated per second (1 per second)
exports.GRAVE_SMALL_PARTICLES_PER_ATTACK = 5; // Small particles consumed per attack
exports.GRAVE_SMALL_PARTICLE_SPEED = 120; // Speed of small particles following as if by gravity
exports.GRAVE_SMALL_PARTICLE_SIZE = 2; // Visual size of small particles
exports.GRAVE_SMALL_PARTICLE_DAMAGE = 5; // Damage per small particle (same as starling)
exports.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS = 30; // Splash damage radius for small particle explosion
exports.GRAVE_SMALL_PARTICLE_SPLASH_FALLOFF = 0.5; // 50% damage at edge of splash
exports.GRAVE_SMALL_PARTICLE_ATTRACTION_FORCE = 200; // Gravity-like attraction force
exports.GRAVE_SMALL_PARTICLE_DRAG = 0.95; // Drag coefficient for particle movement
exports.GRAVE_BLACK_HOLE_DURATION = 5.0; // Duration of black hole in seconds
exports.GRAVE_BLACK_HOLE_SIZE = 15; // Visual size of black hole
exports.GRAVE_BLACK_HOLE_SPEED = 300; // Speed of black hole projectile
// Starling unit constants (minions from stellar forge)
exports.STARLING_MAX_HEALTH = 50;
exports.STARLING_ATTACK_RANGE = 120;
exports.STARLING_ATTACK_DAMAGE = 5;
exports.STARLING_ATTACK_UPGRADE_BONUS = 1; // Bonus damage from foundry +1 ATK upgrade
exports.STARLING_ATTACK_SPEED = 2; // Attacks per second
exports.STARLING_MOVE_SPEED = 50; // Pixels per second (slower than regular units)
exports.STARLING_MOVE_ACCELERATION_PX_PER_SEC = 120; // Pixels per second squared
exports.STARLING_SPAWN_INTERVAL = 10.0; // Seconds between spawns
exports.STARLING_EXPLORATION_CHANGE_INTERVAL = 5.0; // Change random direction every 5 seconds
exports.STARLING_PROJECTILE_SPEED = 320; // Pixels per second
exports.STARLING_PROJECTILE_MAX_RANGE_PX = 140; // Maximum travel distance
exports.STARLING_PROJECTILE_HIT_RADIUS_PX = 8; // Hit radius for starling projectiles
exports.STARLING_COLLISION_RADIUS_PX = 3; // Collision radius for minion starlings
exports.STARLING_LASER_IMPACT_PARTICLES = 3; // Number of particles spawned at laser impact
exports.STARLING_LASER_PARTICLE_SPEED = 30; // Speed of impact particles in pixels per second
exports.STARLING_LASER_PARTICLE_LIFETIME = 0.3; // Lifetime of impact particles in seconds
exports.STARLING_LASER_WIDTH_PX = 2;
exports.STARLING_REGEN_RATE_PER_SEC = 2; // Health regenerated per second when in influence
exports.STARLING_BLINK_DISTANCE_PX = 80; // Teleport distance for Blink upgrade
exports.STARLING_BLINK_COOLDOWN_SEC = 6; // Cooldown between Blink uses
exports.STARLING_GROUP_STOP_BASE_RADIUS_PX = 8; // Base radius for group stop around final waypoint
exports.STARLING_GROUP_STOP_SPACING_PX = 5; // Additional radius per sqrt(stopped count)
exports.STARLING_MAX_COUNT = 100; // Maximum number of starlings per player
exports.FORGE_FLAME_ALPHA = 0.75;
exports.FORGE_FLAME_SIZE_MULTIPLIER = 0.45;
exports.FORGE_FLAME_ROTATION_SPEED_RAD_PER_SEC = Math.PI;
exports.FORGE_FLAME_WARMTH_FADE_PER_SEC = 2.0;
exports.FORGE_FLAME_OFFSET_MULTIPLIER = 0.35;
// Stellar Forge constants (main base structure)
exports.STELLAR_FORGE_MAX_HEALTH = 1000;
exports.STELLAR_FORGE_STARLING_DEFENSE = 5; // Flat damage reduction against starling attacks
// Forge crunch constants (periodic event that spawns minions)
exports.FORGE_CRUNCH_INTERVAL = 10.0; // Seconds between crunches
exports.FORGE_CRUNCH_SUCK_DURATION = 0.8; // Duration of dust suction phase
exports.FORGE_CRUNCH_WAVE_DURATION = 1.2; // Duration of wave push phase
exports.FORGE_CRUNCH_SUCK_RADIUS = 250; // Radius of dust suction effect
exports.FORGE_CRUNCH_WAVE_RADIUS = 300; // Radius of wave push effect
exports.FORGE_CRUNCH_SUCK_FORCE = 150; // Force magnitude pulling dust in
exports.FORGE_CRUNCH_WAVE_FORCE = 100; // Force magnitude pushing dust out
exports.STARLING_COST_PER_ENERGY = 50; // Energy needed per starling spawned
exports.STARLING_SACRIFICE_ENERGY_MULTIPLIER = 0.5; // Fraction of starling energy cost applied to production boosts
// Cannon/Gatling building constants (offensive building for Radiant faction)
exports.MINIGUN_MAX_HEALTH = 200;
exports.MINIGUN_ATTACK_RANGE = 350;
exports.MINIGUN_ATTACK_DAMAGE = 12;
exports.MINIGUN_ATTACK_SPEED = 6; // Attacks per second (very fast)
exports.MINIGUN_LASER_WIDTH_PX = 12;
exports.MINIGUN_RADIUS = 30; // Building size
exports.GATLING_MAX_HEALTH = 200;
exports.GATLING_ATTACK_RANGE = 175;
exports.GATLING_ATTACK_DAMAGE = 12;
exports.GATLING_ATTACK_SPEED = 4; // Attacks per second (very fast)
exports.GATLING_RADIUS = 30; // Building size
// Space Dust Swirler building constants (defensive building for Radiant faction)
exports.SWIRLER_MAX_HEALTH = 250;
exports.SWIRLER_ATTACK_RANGE = 0; // No direct attack
exports.SWIRLER_ATTACK_DAMAGE = 0; // Defensive building
exports.SWIRLER_ATTACK_SPEED = 0; // No direct attack
exports.SWIRLER_RADIUS = 35; // Building size
exports.SWIRLER_INFLUENCE_RADIUS = 400; // Range of space dust swirl effect (max radius)
exports.SWIRLER_INITIAL_RADIUS_MULTIPLIER = 0.5; // Start at 50% of max radius
exports.SWIRLER_GROWTH_RATE_PER_SEC = 30; // Radius growth rate in pixels per second
exports.SWIRLER_SHRINK_BASE_RATE = 20; // Base shrink amount per absorbed projectile
exports.SWIRLER_SHRINK_DAMAGE_MULTIPLIER = 0.5; // Additional shrink per point of damage
exports.SWIRLER_MIN_INFLUENCE_RADIUS = 50; // Minimum radius the swirler can shrink to
exports.SWIRLER_DUST_ORBIT_SPEED_BASE = 80; // Base orbital speed at edge
exports.SWIRLER_DUST_SPEED_MULTIPLIER = 2.5; // Speed multiplier at center (faster closer)
// Foundry building constants
exports.SUBSIDIARY_FACTORY_MAX_HEALTH = 500;
exports.SUBSIDIARY_FACTORY_ATTACK_RANGE = 0; // No direct attack
exports.SUBSIDIARY_FACTORY_ATTACK_DAMAGE = 0; // Production building
exports.SUBSIDIARY_FACTORY_ATTACK_SPEED = 0; // No direct attack
exports.SUBSIDIARY_FACTORY_RADIUS = 40; // Building size
exports.SUBSIDIARY_FACTORY_PRODUCTION_INTERVAL = 15.0; // Seconds between unit productions
// Striker Tower building constants (Velaris faction - manual missile launch)
exports.STRIKER_TOWER_MAX_HEALTH = 300;
exports.STRIKER_TOWER_ATTACK_RANGE = 400; // Range for missile targeting
exports.STRIKER_TOWER_ATTACK_DAMAGE = 100; // Missile explosion damage
exports.STRIKER_TOWER_ATTACK_SPEED = 0; // Manual fire only, no auto attack
exports.STRIKER_TOWER_RADIUS = 32; // Building size
exports.STRIKER_TOWER_RELOAD_TIME = 10.0; // Seconds to reload missile
exports.STRIKER_TOWER_EXPLOSION_RADIUS = 60; // Explosion radius
// Lock-on Laser Tower building constants (Velaris faction - laser beam)
exports.LOCKON_TOWER_MAX_HEALTH = 250;
exports.LOCKON_TOWER_ATTACK_RANGE = 300; // Range for locking onto enemies
exports.LOCKON_TOWER_ATTACK_DAMAGE = 200; // Massive laser damage
exports.LOCKON_TOWER_ATTACK_SPEED = 0; // Charged attack, not rate-based
exports.LOCKON_TOWER_RADIUS = 30; // Building size
exports.LOCKON_TOWER_LOCKON_TIME = 2.0; // Seconds to lock on before firing
exports.LOCKON_TOWER_LASER_WIDTH_PX = 20; // Laser beam width
// Shield Tower constants (Radiant)
exports.SHIELD_TOWER_MAX_HEALTH = 300;
exports.SHIELD_TOWER_ATTACK_RANGE = 0; // No direct attack
exports.SHIELD_TOWER_ATTACK_DAMAGE = 0; // Defensive building
exports.SHIELD_TOWER_ATTACK_SPEED = 0; // No direct attack
exports.SHIELD_TOWER_RADIUS = 35; // Building size
exports.SHIELD_TOWER_SHIELD_RADIUS = 200; // Shield projection radius
exports.SHIELD_TOWER_SHIELD_HEALTH = 500; // Damage needed to disable shield
exports.SHIELD_TOWER_REGENERATION_TIME = 10.0; // Seconds before shield can reactivate
// Unit visibility constants
exports.UNIT_VISIBILITY_RADIUS = 200; // Distance in pixels that units can see around them
// Building costs (energy-based construction)
// Note: Internal names are different from display names
// MINIGUN = Cannon, GATLING = Gatling Tower, SWIRLER = Cyclone, SUBSIDIARY_FACTORY = Workshop/Foundry
exports.MINIGUN_COST = 500; // Cannon
exports.GATLING_COST = 250; // Gatling
exports.SWIRLER_COST = 750; // Cyclone
exports.SUBSIDIARY_FACTORY_COST = 1000; // Workshop/Foundry
exports.STRIKER_TOWER_COST = 400; // Striker Tower (Velaris)
exports.LOCKON_TOWER_COST = 600; // Lock-on Laser Tower (Velaris)
exports.SHIELD_TOWER_COST = 650; // Shield Tower (Radiant)
exports.HERO_UNIT_COST = 300;
exports.SOLAR_MIRROR_COST = 50; // Cost to build additional solar mirrors
// Foundry upgrade costs
exports.FOUNDRY_STRAFE_UPGRADE_COST = 1000; // Cost to unlock Strafe upgrade
exports.FOUNDRY_REGEN_UPGRADE_COST = 1000; // Cost to unlock Regen upgrade
exports.FOUNDRY_ATTACK_UPGRADE_COST = 1000; // Cost to unlock +1 ATK upgrade
exports.FOUNDRY_STRAFE_UPGRADE_ITEM = 'strafe-upgrade';
exports.FOUNDRY_REGEN_UPGRADE_ITEM = 'regen-upgrade';
exports.FOUNDRY_ATTACK_UPGRADE_ITEM = 'attack-upgrade';
exports.SOLAR_MIRROR_FROM_FOUNDRY_COST = 300; // Cost to create solar mirror from foundry
exports.FOUNDRY_BLINK_UPGRADE_COST = 3000; // Cost to unlock Blink upgrade at foundry
exports.FOUNDRY_BLINK_UPGRADE_ITEM = 'blink-upgrade';
exports.STARLING_MERGE_COUNT = 10; // Number of starlings required to merge into a solar mirror
exports.STARLING_MERGE_DURATION_SEC = 10.0; // Seconds before merge gate converts to a solar mirror
exports.STARLING_MERGE_GATE_RADIUS_PX = 18; // Visual/absorption radius for merge gate
exports.STARLING_MERGE_GATE_MAX_HEALTH = 80; // Health for merge gate before it breaks
exports.STARLING_MERGE_HOLD_DURATION_MS = 2000; // Hold duration to trigger starling merge
exports.STARLING_MERGE_HOLD_RADIUS_PX = 30; // Max distance from a selected starling to start hold merge
// AI control intervals and placement tuning
exports.AI_MIRROR_COMMAND_INTERVAL_SEC = 2.0;
exports.AI_DEFENSE_COMMAND_INTERVAL_SEC = 1.0;
exports.AI_HERO_COMMAND_INTERVAL_SEC = 3.0;
exports.AI_STRUCTURE_COMMAND_INTERVAL_SEC = 5.0;
exports.AI_MIRROR_PURCHASE_INTERVAL_SEC = 8.0; // Interval to check for buying mirrors
exports.AI_MAX_MIRRORS = 6; // Maximum mirrors AI will build
exports.AI_WAVES_ATTACK_THRESHOLD = 8; // Min unit count for wave attack
exports.AI_AGGRESSIVE_HERO_MULTIPLIER = 0.7; // Faster hero production
exports.AI_ECONOMIC_HERO_MULTIPLIER = 1.5; // Slower hero production
exports.AI_WAVES_HERO_MULTIPLIER = 1.2; // Slightly slower hero production
exports.AI_MIRROR_SUN_DISTANCE_PX = 220;
exports.AI_MIRROR_ARC_SPACING_RAD = 0.6;
exports.AI_MIRROR_REPOSITION_THRESHOLD_PX = 40;
exports.AI_DEFENSE_RADIUS_PX = 350;
exports.AI_STRUCTURE_PLACEMENT_DISTANCE_PX = 140;
exports.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD = Math.PI / 4;
exports.HERO_PRODUCTION_TIME_SEC = 8;
exports.HERO_BUTTON_RADIUS_PX = 28;
exports.HERO_BUTTON_DISTANCE_PX = 100;
exports.FORGE_UPGRADE_BUTTON_RADIUS_PX = 22;
exports.FORGE_UPGRADE_BUTTON_DISTANCE_PX = 140;
exports.BUILDING_BUILD_TIME = 5.0; // Base build time in seconds
// Weapon effect constants
exports.MUZZLE_FLASH_DURATION = 0.05; // 50ms - very brief
exports.BULLET_CASING_LIFETIME = 2.0; // 2 seconds
exports.BULLET_CASING_SPEED_MIN = 100;
exports.BULLET_CASING_SPEED_MAX = 150;
exports.BOUNCING_BULLET_LIFETIME = 0.5; // 0.5 seconds
exports.BOUNCING_BULLET_SPEED_MIN = 150;
exports.BOUNCING_BULLET_SPEED_MAX = 250;
exports.CASING_SPACEDUST_COLLISION_DISTANCE = 5;
exports.CASING_SPACEDUST_FORCE = 50;
exports.CASING_COLLISION_DAMPING = 0.3;
// Unit movement constants
exports.UNIT_MOVE_SPEED = 100; // Pixels per second
exports.UNIT_TURN_SPEED_RAD_PER_SEC = 8.0; // Radians per second - quick turning
exports.UNIT_ARRIVAL_THRESHOLD = 5; // Distance to consider unit arrived at destination
exports.UNIT_RADIUS_PX = 10; // Approximate unit radius for collisions
exports.UNIT_AVOIDANCE_RANGE_PX = 40; // Range for unit avoidance steering
exports.UNIT_AVOIDANCE_STRENGTH = 0.7; // Blend factor for avoidance steering (unitless)
exports.UNIT_ASTEROID_AVOIDANCE_LOOKAHEAD_PX = 140; // Distance ahead to check for asteroids
exports.UNIT_ASTEROID_AVOIDANCE_BUFFER_PX = 12; // Buffer distance around asteroids
exports.UNIT_ASTEROID_AVOIDANCE_STRENGTH = 1.1; // Blend factor for asteroid avoidance
exports.UNIT_HERO_AVOIDANCE_MULTIPLIER = 0.3; // Heroes ignore some avoidance (unitless)
exports.UNIT_MINION_YIELD_MULTIPLIER = 1.4; // Minions yield more to heroes (unitless)
exports.UNIT_STRUCTURE_STANDOFF_PX = 4; // Extra spacing to keep units outside structures
exports.PATH_WAYPOINT_ARRIVAL_MULTIPLIER = 2; // Multiplier for waypoint arrival detection
exports.MIN_WAYPOINT_DISTANCE = 50; // Minimum distance between path waypoints in pixels
exports.UNIT_PATH_DRAW_RADIUS = 50; // Maximum distance from unit to initiate path drawing (pixels)
// Deterministic state hash cadence
exports.STATE_HASH_TICK_INTERVAL = 30; // Update state hash every 30 ticks
// Solar mirror visual constants
exports.MIRROR_ACTIVE_GLOW_RADIUS = 15; // Radius of yellow glow when mirror is active
exports.MIRROR_CLICK_RADIUS_PX = 20; // Radius for mirror selection/targeting
exports.MIRROR_MAX_GLOW_DISTANCE = 1000; // Maximum distance for glow and efficiency calculations
exports.MIRROR_PROXIMITY_MULTIPLIER = 2.0; // Maximum energy generation multiplier at close range
// Ability constants
exports.MARINE_ABILITY_COOLDOWN = 5.0; // 5 seconds
exports.MARINE_ABILITY_BULLET_COUNT = 15; // Number of bullets in storm
exports.MARINE_ABILITY_BULLET_SPEED = 500; // Speed of ability bullets
exports.MARINE_ABILITY_BULLET_LIFETIME = 1.0; // Lifetime of ability bullets
exports.MARINE_ABILITY_SPREAD_ANGLE = (10 * Math.PI) / 180; // 10 degrees in radians
exports.MARINE_ABILITY_BULLET_DAMAGE = 5; // Damage per ability bullet
// UI constants
exports.UI_BACKGROUND_COLOR = '#000011'; // Dark blue-black background for UI
exports.CLICK_DRAG_THRESHOLD = 10; // Pixels of movement to distinguish click from drag (increased for better tap/drag distinction)
exports.SMALL_SELECTION_THRESHOLD = 50; // Maximum selection box size (pixels) to be considered a single-click for double-tap detection
exports.HERO_ATTACK_RANGE_ALPHA = 0.2; // Opacity for hero unit attack range circles
exports.SOL_ICON_TEXT_SPACING = 2; // Spacing between SoL icon and text in zoom units
exports.ABILITY_ARROW_MIN_LENGTH = 10; // Minimum pixel length to display ability arrow (prevents tiny arrows on accidental drags)
exports.SHIELD_HEALTH_BAR_VERTICAL_OFFSET = 20; // Vertical offset for shield health bar below main health bar
// Visual effect constants
exports.TAP_EFFECT_SPEED = 0.05; // Progress increment per frame for tap effect
exports.TAP_EFFECT_MAX_RADIUS = 40; // Maximum radius of tap ripple effect
exports.SWIPE_EFFECT_SPEED = 0.08; // Progress increment per frame for swipe effect
exports.PRODUCTION_BUTTON_WAVE_MAX_RADIUS_PX = 48; // Max radius for hero/building button waves
exports.PRODUCTION_BUTTON_WAVE_PROGRESS_PER_FRAME = 0.12; // Progress increment per frame for production button wave
exports.SWIPE_ARROW_SIZE = 15; // Size of the arrow head in swipe effect
// Ray unit constants (Velaris hero)
exports.RAY_MAX_HEALTH = 120;
exports.RAY_ATTACK_RANGE = 250;
exports.RAY_ATTACK_DAMAGE = 8;
exports.RAY_ATTACK_SPEED = 3; // Attacks per second
exports.RAY_ABILITY_COOLDOWN = 8.0; // 8 seconds
exports.RAY_BEAM_DAMAGE = 25; // Damage per beam hit
exports.RAY_BEAM_MAX_BOUNCES = 5; // Maximum number of bounces
exports.RAY_BEAM_WIDTH = 3; // Visual width of the beam
// Influence Ball unit constants (Velaris hero)
exports.INFLUENCE_BALL_MAX_HEALTH = 100;
exports.INFLUENCE_BALL_ATTACK_RANGE = 200;
exports.INFLUENCE_BALL_ATTACK_DAMAGE = 5;
exports.INFLUENCE_BALL_ATTACK_SPEED = 1.5; // Attacks per second
exports.INFLUENCE_BALL_ABILITY_COOLDOWN = 15.0; // 15 seconds
exports.INFLUENCE_BALL_PROJECTILE_SPEED = 300;
exports.INFLUENCE_BALL_EXPLOSION_RADIUS = 150; // Radius of influence zone
exports.INFLUENCE_BALL_DURATION = 10.0; // 10 seconds influence duration
// Turret Deployer unit constants (Velaris hero)
exports.TURRET_DEPLOYER_MAX_HEALTH = 90;
exports.TURRET_DEPLOYER_ATTACK_RANGE = 180;
exports.TURRET_DEPLOYER_ATTACK_DAMAGE = 6;
exports.TURRET_DEPLOYER_ATTACK_SPEED = 2; // Attacks per second
exports.TURRET_DEPLOYER_ABILITY_COOLDOWN = 12.0; // 12 seconds
exports.DEPLOYED_TURRET_MAX_HEALTH = 150;
exports.DEPLOYED_TURRET_ATTACK_RANGE = 300;
exports.DEPLOYED_TURRET_ATTACK_DAMAGE = 12;
exports.DEPLOYED_TURRET_ATTACK_SPEED = 2; // Attacks per second (fires 2 times per second)
exports.TURRET_PROJECTILE_SPEED = 400;
exports.DEPLOYED_TURRET_ANIMATION_DURATION = 0.1; // Animation duration in seconds
exports.DEPLOYED_TURRET_SPRITE_SCALE = 0.08; // Base scale factor for turret sprites
exports.DEPLOYED_TURRET_ANIMATION_FRAME_COUNT = 28; // Number of firing animation frames
exports.DEPLOYED_TURRET_HEALTH_BAR_SIZE = 40; // Size for health bar positioning
// Driller unit constants (Aurum hero)
exports.DRILLER_MAX_HEALTH = 140;
exports.DRILLER_ATTACK_RANGE = 0; // No normal attack, only ability
exports.DRILLER_ATTACK_DAMAGE = 0; // No normal attack
exports.DRILLER_ATTACK_SPEED = 0; // No normal attack
exports.DRILLER_ABILITY_COOLDOWN = 5.0; // 5 seconds after collision
exports.DRILLER_DRILL_SPEED = 500; // Speed when drilling
exports.DRILLER_DRILL_DAMAGE = 30; // Damage to units
exports.DRILLER_BUILDING_DAMAGE_MULTIPLIER = 2.0; // Double damage to buildings
exports.DRILLER_DECELERATION = 200; // Deceleration rate at edge
// Dagger unit constants (Radiant hero - cloaked assassin)
exports.DAGGER_MAX_HEALTH = 80;
exports.DAGGER_ATTACK_RANGE = 100; // Very short range
exports.DAGGER_ATTACK_DAMAGE = 35; // High damage for close range
exports.DAGGER_ATTACK_SPEED = 1.5; // Attacks per second
exports.DAGGER_ABILITY_COOLDOWN = 6.0; // 6 seconds
exports.DAGGER_ABILITY_RANGE = 150; // Very short range for ability attack
exports.DAGGER_ABILITY_DAMAGE = 50; // High burst damage
exports.DAGGER_VISIBILITY_DURATION = 8.0; // 8 seconds visible after using ability
exports.DAGGER_CLOAK_OPACITY = 0.4; // Opacity when cloaked to own player
// Beam unit constants (Radiant hero - sniper with distance-based damage)
exports.BEAM_MAX_HEALTH = 70;
exports.BEAM_ATTACK_RANGE = 150;
exports.BEAM_ATTACK_DAMAGE = 20;
exports.BEAM_ATTACK_SPEED = 1.0; // Attacks per second
exports.BEAM_ABILITY_COOLDOWN = 8.0; // 8 seconds
exports.BEAM_ABILITY_BASE_DAMAGE = 30; // Base damage for ability
exports.BEAM_ABILITY_MAX_RANGE = 600; // Maximum beam range
exports.BEAM_ABILITY_DAMAGE_PER_DISTANCE = 0.1; // Damage multiplier per unit of distance
exports.SPOTLIGHT_MAX_HEALTH = 95;
exports.SPOTLIGHT_ATTACK_RANGE = 0;
exports.SPOTLIGHT_ATTACK_DAMAGE = 0;
exports.SPOTLIGHT_ATTACK_SPEED = 1.0; // Placeholder attack speed (no primary attack)
exports.SPOTLIGHT_ABILITY_COOLDOWN = 12.0; // Total cycle cooldown
exports.SPOTLIGHT_SETUP_TIME_SEC = 1.0;
exports.SPOTLIGHT_ACTIVE_TIME_SEC = 4.0;
exports.SPOTLIGHT_TEARDOWN_TIME_SEC = 5.0;
exports.SPOTLIGHT_CONE_ANGLE_RAD = (5 * Math.PI) / 180; // 5-degree total cone
exports.SPOTLIGHT_FIRE_RATE_PER_SEC = 8; // High fire rate
exports.SPOTLIGHT_BULLET_SPEED = 600; // Medium-fast projectile
exports.SPOTLIGHT_BULLET_DAMAGE = 4;
exports.SPOTLIGHT_BULLET_LIFETIME_SEC = 1.2;
exports.SPOTLIGHT_BULLET_WIDTH_PX = 1.5;
exports.SPOTLIGHT_BULLET_LENGTH_PX = 10;
exports.SPOTLIGHT_BULLET_HIT_RADIUS_PX = 6;
// Mortar unit constants (Radiant hero - stationary artillery with cone detection)
exports.MORTAR_MAX_HEALTH = 120;
exports.MORTAR_ATTACK_RANGE = 450; // Long range artillery
exports.MORTAR_ATTACK_DAMAGE = 40; // High damage per shot
exports.MORTAR_ATTACK_SPEED = 0.5; // Low fire rate (0.5 attacks per second = 2 seconds between shots)
exports.MORTAR_ABILITY_COOLDOWN = 0; // No cooldown, setup is the ability
exports.MORTAR_DETECTION_CONE_ANGLE = (150 * Math.PI) / 180; // 150 degrees detection cone
exports.MORTAR_SPLASH_RADIUS = 80; // Radius of splash damage
exports.MORTAR_SPLASH_DAMAGE_FALLOFF = 0.5; // 50% damage at edge of splash radius
exports.MORTAR_PROJECTILE_SPEED = 300; // Speed of mortar shells
// Preist unit constants (healing support hero)
exports.PREIST_MAX_HEALTH = 110;
exports.PREIST_ATTACK_RANGE = 0; // No attack
exports.PREIST_ATTACK_DAMAGE = 0; // No damage
exports.PREIST_ATTACK_SPEED = 0; // No attack
exports.PREIST_ABILITY_COOLDOWN = 10.0; // 10 seconds
exports.PREIST_HEALING_RANGE = 350; // Range for healing beams
exports.PREIST_HEALING_PER_SECOND = 0.02; // 2% of max health per second per beam
exports.PREIST_TARGET_LOCK_DURATION = 0.5; // Stay on target for at least 0.5 seconds
exports.PREIST_NUM_BEAMS = 2; // Number of healing beams
exports.PREIST_HEALING_BOMB_SPEED = 400; // Speed of healing bomb projectile
exports.PREIST_HEALING_BOMB_MAX_RANGE = 500; // Maximum range for healing bomb
exports.PREIST_HEALING_BOMB_PARTICLE_COUNT = 50; // Number of wild particles
exports.PREIST_HEALING_BOMB_PARTICLE_HEALING = 0.01; // 1% of max health per particle
exports.PREIST_HEALING_BOMB_EXPLOSION_RADIUS = 120; // Radius of particle explosion area
exports.PREIST_HEALING_BOMB_PARTICLE_SPEED = 200; // Speed of wild particles
exports.PREIST_HEALING_BOMB_PARTICLE_LIFETIME = 0.5; // Lifetime of wild particles
// Tank hero constants (defensive tank with shield and crescent wave ability)
exports.TANK_MAX_HEALTH = 300; // Very high health (3x Marine)
exports.TANK_ATTACK_RANGE = 0; // Doesn't attack
exports.TANK_ATTACK_DAMAGE = 0; // No damage
exports.TANK_ATTACK_SPEED = 0; // No attack
exports.TANK_DEFENSE = 50; // 50% damage reduction (armor)
exports.TANK_ABILITY_COOLDOWN = 12.0; // 12 seconds
exports.TANK_SHIELD_RADIUS = 60; // Radius of shield around tank that blocks projectiles
exports.TANK_WAVE_ANGLE = Math.PI / 2; // 90 degrees crescent wave
exports.TANK_WAVE_RANGE = 400; // Maximum range of wave
exports.TANK_WAVE_SPEED = 150; // Slow moving wave (pixels per second)
exports.TANK_WAVE_WIDTH = 40; // Width of the wave
exports.TANK_STUN_DURATION = 2.0; // Stuns for 2 seconds
exports.TANK_COLLISION_RADIUS_PX = 20; // Slightly larger collision radius
// Nova unit constants (Velaris hero - remote bomb specialist)
exports.NOVA_MAX_HEALTH = 105;
exports.NOVA_ATTACK_RANGE = 250;
exports.NOVA_ATTACK_DAMAGE = 6;
exports.NOVA_ATTACK_SPEED = 2; // Attacks per second
exports.NOVA_ABILITY_COOLDOWN = 0; // No cooldown - triggers existing bomb
exports.NOVA_BOMB_INITIAL_SPEED = 400; // Initial speed when thrown
exports.NOVA_BOMB_DECELERATION = 150; // Deceleration rate (units/s²)
exports.NOVA_BOMB_MIN_SPEED = 50; // Minimum speed after deceleration
exports.NOVA_BOMB_ARMING_TIME = 2.0; // 2 seconds before bomb can be triggered
exports.NOVA_BOMB_BOUNCE_DAMPING = 0.7; // Speed retention after bounce (70%)
exports.NOVA_BOMB_MAX_BOUNCES = 10; // Maximum number of bounces
exports.NOVA_BOMB_EXPLOSION_DAMAGE = 50; // Damage from explosion
exports.NOVA_BOMB_EXPLOSION_RADIUS = 100; // Radius of explosion
exports.NOVA_BOMB_SCATTER_ARC = (30 * Math.PI) / 180; // 30 degree arc for scatter bullets
exports.NOVA_BOMB_SCATTER_BULLET_COUNT = 12; // Number of scatter bullets
exports.NOVA_BOMB_SCATTER_BULLET_SPEED = 350; // Speed of scatter bullets
exports.NOVA_BOMB_SCATTER_BULLET_DAMAGE = 8; // Damage per scatter bullet
exports.NOVA_BOMB_SCATTER_BULLET_LIFETIME = 1.0; // Lifetime of scatter bullets in seconds
exports.NOVA_BOMB_RADIUS = 15; // Visual/collision radius of bomb
// Sly hero constants (sticky laser bomb specialist)
exports.SLY_MAX_HEALTH = 90;
exports.SLY_ATTACK_RANGE = 200;
exports.SLY_ATTACK_DAMAGE = 15;
exports.SLY_ATTACK_SPEED = 1.5; // Attacks per second
exports.SLY_ABILITY_COOLDOWN = 0; // No cooldown - first activation throws bomb, second activation triggers lasers from stuck bomb
exports.STICKY_BOMB_INITIAL_SPEED = 500; // Very fast throw speed
exports.STICKY_BOMB_DECELERATION = 200; // Deceleration rate (units/s²)
exports.STICKY_BOMB_MIN_SPEED = 20; // Minimum speed after deceleration
exports.STICKY_BOMB_STICK_DISTANCE = 25; // How close before sticking to surface
exports.STICKY_BOMB_ARM_TIME = 0.5; // 0.5 seconds before bomb can be triggered (can activate immediately after sticking)
exports.STICKY_BOMB_MAX_LIFETIME = 5.0; // 5 seconds before disintegrating if not stuck
exports.STICKY_BOMB_RADIUS = 12; // Visual/collision radius of bomb
exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_COUNT = 20; // Number of erratic particles when disintegrating
exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_SPEED = 150; // Speed of disintegration particles
exports.STICKY_BOMB_DISINTEGRATE_PARTICLE_LIFETIME = 1.0; // Lifetime of disintegration particles
exports.STICKY_BOMB_WIDE_LASER_DAMAGE = 40; // Main wide laser damage
exports.STICKY_BOMB_WIDE_LASER_WIDTH = 20; // Width of main laser
exports.STICKY_BOMB_DIAGONAL_LASER_DAMAGE = 25; // Diagonal lasers damage
exports.STICKY_BOMB_DIAGONAL_LASER_WIDTH = 12; // Width of diagonal lasers
exports.STICKY_BOMB_LASER_ANGLE = (45 * Math.PI) / 180; // 45 degree angle for diagonal lasers
exports.STICKY_BOMB_LASER_RANGE = 500; // Maximum range for lasers
exports.STICKY_BOMB_LASER_DURATION = 0.15; // How long lasers stay visible (seconds)
// AI Strategy types
var AIStrategy;
(function (AIStrategy) {
    AIStrategy["ECONOMIC"] = "economic";
    AIStrategy["DEFENSIVE"] = "defensive";
    AIStrategy["AGGRESSIVE"] = "aggressive";
    AIStrategy["WAVES"] = "waves"; // Build up then attack in waves
})(AIStrategy || (exports.AIStrategy = AIStrategy = {}));
