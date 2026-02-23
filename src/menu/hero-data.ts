/**
 * Hero unit data definitions for the menu system
 */

import { Faction } from '../game-core';
import { HeroUnit } from './types';
import * as Constants from '../constants';

export const HERO_UNITS: HeroUnit[] = [
    // Radiant faction heroes
    { 
        id: 'radiant-marine', name: 'Marine', description: 'Rapid-fire ranged specialist', faction: Faction.RADIANT,
        maxHealth: Constants.MARINE_MAX_HEALTH, attackDamage: Constants.MARINE_ATTACK_DAMAGE, attackSpeed: Constants.MARINE_ATTACK_SPEED,
        attackRange: Constants.MARINE_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 4,
        abilityDescription: 'Bullet storm: fires a spread of shots toward a target direction'
    },
    { 
        id: 'velaris-grave', name: 'Grave', description: 'Gravitic sentinel with orbiting projectiles', faction: Faction.VELARIS,
        maxHealth: Constants.GRAVE_MAX_HEALTH, attackDamage: Constants.GRAVE_ATTACK_DAMAGE, attackSpeed: Constants.GRAVE_ATTACK_SPEED,
        attackRange: Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER,
        attackIgnoresDefense: false, defense: 18, regen: 3,
        abilityDescription: 'Black Hole: launches a vortex that attracts all small particles for 5 seconds'
    },
    {
        id: 'velaris-nova', name: 'Nova', description: 'Remote bomb specialist with bouncing projectile', faction: Faction.VELARIS,
        maxHealth: Constants.NOVA_MAX_HEALTH, attackDamage: Constants.NOVA_ATTACK_DAMAGE, attackSpeed: Constants.NOVA_ATTACK_SPEED,
        attackRange: Constants.NOVA_ATTACK_RANGE, attackIgnoresDefense: false, defense: 10, regen: 5,
        abilityDescription: 'Remote bomb: throws a bouncing bomb that explodes in a directional scatter when triggered'
    },
    {
        id: 'velaris-sly', name: 'Sly', description: 'Sticky laser bomb specialist', faction: Faction.VELARIS,
        maxHealth: Constants.SLY_MAX_HEALTH, attackDamage: Constants.SLY_ATTACK_DAMAGE, attackSpeed: Constants.SLY_ATTACK_SPEED,
        attackRange: Constants.SLY_ATTACK_RANGE, attackIgnoresDefense: false, defense: 8, regen: 4,
        abilityDescription: 'Sticky bomb: throws a bomb that sticks to surfaces and fires 3 lasers (1 wide center, 2 diagonal)'
    },
    {
        id: 'radiant-ray', name: 'Ray', description: 'Bouncing beam marks targets', faction: Faction.RADIANT,
        maxHealth: Constants.RAY_MAX_HEALTH, attackDamage: Constants.RAY_ATTACK_DAMAGE, attackSpeed: Constants.RAY_ATTACK_SPEED,
        attackRange: Constants.RAY_ATTACK_RANGE, attackIgnoresDefense: true, defense: 8, regen: 5,
        abilityDescription: 'Solar ricochet: beam bounces between multiple enemies'
    },
    {
        id: 'velaris-diplomat', name: 'Diplomat', description: 'Deploys temporary influence zones', faction: Faction.VELARIS,
        maxHealth: Constants.INFLUENCE_BALL_MAX_HEALTH, attackDamage: Constants.INFLUENCE_BALL_ATTACK_DAMAGE, attackSpeed: Constants.INFLUENCE_BALL_ATTACK_SPEED,
        attackRange: Constants.INFLUENCE_BALL_ATTACK_RANGE, attackIgnoresDefense: false, defense: 12, regen: 6,
        abilityDescription: 'Influence surge: expand an influence zone at target location'
    },
    {
        id: 'radiant-turret-deployer', name: 'Turret Deployer', description: 'Deploys automated turrets on asteroids', faction: Faction.RADIANT,
        maxHealth: Constants.TURRET_DEPLOYER_MAX_HEALTH, attackDamage: Constants.TURRET_DEPLOYER_ATTACK_DAMAGE, attackSpeed: Constants.TURRET_DEPLOYER_ATTACK_SPEED,
        attackRange: Constants.TURRET_DEPLOYER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 4,
        abilityDescription: 'Deploy turret: places a turret on a nearby asteroid'
    },
    {
        id: 'aurum-driller', name: 'Driller', description: 'Burrows through asteroids to flank', faction: Faction.AURUM,
        maxHealth: Constants.DRILLER_MAX_HEALTH, attackDamage: Constants.DRILLER_ATTACK_DAMAGE, attackSpeed: Constants.DRILLER_ATTACK_SPEED,
        attackRange: Constants.DRILLER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 16, regen: 3,
        abilityDescription: 'Drill charge: tunnels through an asteroid toward the target'
    },
    {
        id: 'velaris-dagger', name: 'Dagger', description: 'Cloaked assassin with burst damage', faction: Faction.VELARIS,
        maxHealth: Constants.DAGGER_MAX_HEALTH, attackDamage: Constants.DAGGER_ATTACK_DAMAGE, attackSpeed: Constants.DAGGER_ATTACK_SPEED,
        attackRange: Constants.DAGGER_ATTACK_RANGE, attackIgnoresDefense: false, defense: 5, regen: 3,
        abilityDescription: 'Shadow strike: short-range burst attack, reveals Dagger for 8 seconds'
    },
    {
        id: 'radiant-beam', name: 'Beam', description: 'Sniper with distance-based damage multiplier', faction: Faction.RADIANT,
        maxHealth: Constants.BEAM_MAX_HEALTH, attackDamage: Constants.BEAM_ATTACK_DAMAGE, attackSpeed: Constants.BEAM_ATTACK_SPEED,
        attackRange: Constants.BEAM_ATTACK_RANGE, attackIgnoresDefense: true, defense: 6, regen: 3,
        abilityDescription: 'Precision shot: long-range beam that does more damage at greater distances'
    },
    {
        id: 'radiant-spotlight', name: 'Spotlight', description: 'Reveals enemies in a razor-thin cone', faction: Faction.RADIANT,
        maxHealth: Constants.SPOTLIGHT_MAX_HEALTH, attackDamage: Constants.SPOTLIGHT_ATTACK_DAMAGE, attackSpeed: 0,
        attackRange: Constants.SPOTLIGHT_ATTACK_RANGE, attackIgnoresDefense: false, defense: 8, regen: 4,
        abilityDescription: 'Spotlight sweep: 5° cone reveals and rapidly fires at enemies (1s setup, 5s teardown)'
    },
    {
        id: 'radiant-mortar', name: 'Mortar', description: 'Siege unit with splash damage', faction: Faction.RADIANT,
        maxHealth: Constants.MORTAR_MAX_HEALTH, attackDamage: Constants.MORTAR_ATTACK_DAMAGE, attackSpeed: Constants.MORTAR_ATTACK_SPEED,
        attackRange: Constants.MORTAR_ATTACK_RANGE, attackIgnoresDefense: false, defense: 14, regen: 2,
        abilityDescription: 'Siege mode: temporarily becomes immobile but gains increased range and damage'
    },
    {
        id: 'radiant-mothership', name: 'Mothership', description: 'Command carrier that launches mini-mothership escorts', faction: Faction.RADIANT,
        maxHealth: Constants.MOTHERSHIP_MAX_HEALTH, attackDamage: Constants.MOTHERSHIP_ATTACK_DAMAGE, attackSpeed: Constants.MOTHERSHIP_ATTACK_SPEED,
        attackRange: Constants.MOTHERSHIP_ATTACK_RANGE, attackIgnoresDefense: false, defense: 12, regen: 3,
        abilityDescription: 'Escort wing: spawns 3 mini-motherships in a triangle formation'
    },
    {
        id: 'aurum-preist', name: 'Preist', description: 'Support healer with dual beams', faction: Faction.AURUM,
        maxHealth: Constants.PREIST_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
        attackRange: Constants.PREIST_HEALING_RANGE, attackIgnoresDefense: false, defense: 18, regen: 4,
        abilityDescription: 'Healing bomb: launches a projectile that explodes into healing particles'
    },
    {
        id: 'aurum-splendor', name: 'Splendor', description: 'Sunlight laser caster with bouncing sun sphere', faction: Faction.AURUM,
        maxHealth: Constants.SPLENDOR_MAX_HEALTH, attackDamage: Constants.SPLENDOR_ATTACK_DAMAGE, attackSpeed: Constants.SPLENDOR_ATTACK_SPEED,
        attackRange: Constants.SPLENDOR_ATTACK_RANGE, attackIgnoresDefense: true, defense: 12, regen: 4,
        abilityDescription: 'Sun sphere: throw a bouncing sunlight orb that explodes into a radiant light zone'
    },
    {
        id: 'aurum-tank', name: 'Tank', description: 'Extremely tough defensive unit with projectile shield', faction: Faction.AURUM,
        maxHealth: Constants.TANK_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
        attackRange: 0, attackIgnoresDefense: false, defense: Constants.TANK_DEFENSE, regen: 3,
        abilityDescription: 'Crescent wave: sends a slow 90-degree wave that stuns all units and erases projectiles'
    },
    {
        id: 'velaris-chrono', name: 'Chrono', description: 'Area-control specialist that freezes units over time', faction: Faction.VELARIS,
        maxHealth: Constants.CHRONO_MAX_HEALTH, attackDamage: Constants.CHRONO_ATTACK_DAMAGE, attackSpeed: Constants.CHRONO_ATTACK_SPEED,
        attackRange: Constants.CHRONO_ATTACK_RANGE, attackIgnoresDefense: true, defense: 10, regen: 3,
        abilityDescription: 'Temporal freeze field: project a circular zone that repeatedly freezes enemies inside'
    },
    {
        id: 'velaris-shadow', name: 'Shadow', description: 'Beam duelist that deploys a mobile decoy', faction: Faction.VELARIS,
        maxHealth: Constants.SHADOW_MAX_HEALTH, attackDamage: Constants.SHADOW_ATTACK_DAMAGE, attackSpeed: Constants.SHADOW_ATTACK_SPEED,
        attackRange: Constants.SHADOW_ATTACK_RANGE, attackIgnoresDefense: false, defense: 6, regen: 3,
        abilityDescription: 'Decoy projection: launch a durable decoy that distracts enemies and emits particles on despawn'
    },
    {
        id: 'aurum-dash', name: 'Dash', description: 'Burst skirmisher with a high-speed slash dash', faction: Faction.AURUM,
        maxHealth: Constants.DASH_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
        attackRange: Constants.DASH_MAX_DISTANCE, attackIgnoresDefense: false, defense: 10, regen: 4,
        abilityDescription: 'Dash slash: rapidly traverse distance and damage enemies near the destination'
    },
    {
        id: 'aurum-blink', name: 'Blink', description: 'Teleporter that emits a stun shockwave on arrival', faction: Faction.AURUM,
        maxHealth: Constants.BLINK_MAX_HEALTH, attackDamage: 0, attackSpeed: 0,
        attackRange: Constants.BLINK_MAX_DISTANCE, attackIgnoresDefense: false, defense: 8, regen: 4,
        abilityDescription: 'Blink shockwave: teleport to target location and release an area stun pulse'
    }
];
