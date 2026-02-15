"use strict";
/**
 * GameState - Main game state class containing the game loop and all game logic
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
exports.createStandardGame = createStandardGame;
const math_1 = require("./math");
const Constants = __importStar(require("../constants"));
const network_1 = require("../network");
const seeded_random_1 = require("../seeded-random");
const player_1 = require("./entities/player");
const sun_1 = require("./entities/sun");
const asteroid_1 = require("./entities/asteroid");
const solar_mirror_1 = require("./entities/solar-mirror");
const stellar_forge_1 = require("./entities/stellar-forge");
const buildings_1 = require("./entities/buildings");
const unit_1 = require("./entities/unit");
const starling_1 = require("./entities/starling");
const starling_merge_gate_1 = require("./entities/starling-merge-gate");
const warp_gate_1 = require("./entities/warp-gate");
const damage_number_1 = require("./entities/damage-number");
const particles_1 = require("./entities/particles");
const game_core_1 = require("../game-core");
const player_2 = require("./entities/player");
class GameState {
    constructor() {
        this.players = [];
        this.playersByName = new Map(); // For efficient P2P player lookup
        this.suns = [];
        this.spaceDust = [];
        this.warpGates = [];
        this.starlingMergeGates = [];
        this.starlingMergeGateExplosions = [];
        this.asteroids = [];
        this.muzzleFlashes = [];
        this.bulletCasings = [];
        this.bouncingBullets = [];
        this.abilityBullets = [];
        this.minionProjectiles = [];
        this.mortarProjectiles = [];
        this.laserBeams = [];
        this.impactParticles = [];
        this.influenceZones = [];
        this.influenceBallProjectiles = [];
        this.deployedTurrets = [];
        this.damageNumbers = [];
        this.crescentWaves = [];
        this.novaBombs = [];
        this.novaScatterBullets = [];
        this.stickyBombs = [];
        this.stickyLasers = [];
        this.disintegrationParticles = [];
        this.radiantOrbs = [];
        this.velarisOrbs = [];
        this.aurumOrbs = [];
        this.aurumShieldHits = [];
        this.dashSlashes = [];
        this.blinkShockwaves = [];
        this.shadowDecoys = [];
        this.shadowDecoyParticles = [];
        this.chronoFreezeCircles = [];
        this.miniMotherships = [];
        this.miniMothershipExplosions = [];
        this.sparkleParticles = [];
        this.deathParticles = [];
        this.strikerTowerExplosions = []; // Track striker tower explosions for rendering
        this.gameTime = 0.0;
        this.stateHash = 0;
        this.stateHashTickCounter = 0;
        this.isRunning = false;
        this.countdownTime = Constants.COUNTDOWN_DURATION; // Countdown from 3 seconds
        this.isCountdownActive = true; // Start with countdown active
        this.mirrorsMovedToSun = false; // Track if mirrors have been moved
        this.mapSize = 2000; // Map size in world units
        this.damageDisplayMode = 'damage'; // How to display damage numbers
        // Network support
        this.networkManager = null; // Network manager for LAN/online play
        this.localPlayerIndex = 0; // Index of the local player (0 or 1)
        this.pendingCommands = []; // Commands from network to be processed
        // Collision resolution constants
        this.MAX_PUSH_DISTANCE = 10; // Maximum push distance for collision resolution
        this.PUSH_MULTIPLIER = 15; // Multiplier for push strength calculation
        this.dustSpatialHash = new Map();
        this.dustSpatialHashKeys = [];
    }
    /**
     * Update game state
     */
    update(deltaTime) {
        this.gameTime += deltaTime;
        this.starlingMergeGateExplosions.length = 0;
        // Process pending network commands from remote players
        if (this.networkManager) {
            this.processPendingNetworkCommands();
        }
        // Handle countdown
        if (this.isCountdownActive) {
            this.countdownTime -= deltaTime;
            // Initialize mirror movement at the start of countdown
            if (!this.mirrorsMovedToSun) {
                this.initializeMirrorMovement();
                this.mirrorsMovedToSun = true;
            }
            // End countdown when timer reaches 0
            if (this.countdownTime <= 0) {
                this.isCountdownActive = false;
                this.countdownTime = 0;
            }
        }
        for (const gate of this.warpGates) {
            gate.resetEnergyReceipt();
        }
        // Update suns (for orbital motion)
        for (const sun of this.suns) {
            sun.update(deltaTime);
        }
        // Update asteroids
        for (const asteroid of this.asteroids) {
            asteroid.update(deltaTime);
        }
        // Apply knockback to units and mirrors that collide with rotating asteroids
        this.applyAsteroidRotationKnockback();
        if (!this.isCountdownActive) {
            this.updateAi(deltaTime);
        }
        // Update each player
        for (const player of this.players) {
            if (player.isDefeated()) {
                continue;
            }
            if (player.solarMirrors.length > 0) {
                const destroyedMirrors = player.solarMirrors.filter(mirror => mirror.health <= 0);
                if (destroyedMirrors.length > 0) {
                    const color = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                    for (const mirror of destroyedMirrors) {
                        this.createDeathParticlesForMirror(mirror, color);
                    }
                }
                player.solarMirrors = player.solarMirrors.filter(mirror => mirror.health > 0);
            }
            // Update light status for Stellar Forge
            if (player.stellarForge) {
                const oldForgePos = new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns, this.asteroids, this.players);
                // Only allow forge movement after countdown
                if (!this.isCountdownActive) {
                    player.stellarForge.update(deltaTime, this); // Update forge movement with gameState
                    // Check collision for forge (larger radius)
                    if (this.checkCollision(player.stellarForge.position, player.stellarForge.radius, player.stellarForge)) {
                        // Revert to old position and stop movement
                        player.stellarForge.position = oldForgePos;
                        player.stellarForge.targetPosition = null;
                        player.stellarForge.velocity = new math_1.Vector2D(0, 0);
                    }
                    this.applyDustPushFromMovingEntity(player.stellarForge.position, player.stellarForge.velocity, Constants.FORGE_DUST_PUSH_RADIUS_PX, Constants.FORGE_DUST_PUSH_FORCE_MULTIPLIER, this.getPlayerImpactColor(player), deltaTime);
                }
                // Check for forge crunch (spawns minions with excess energy)
                if (!this.isCountdownActive) {
                    const energyForMinions = player.stellarForge.shouldCrunch();
                    if (energyForMinions > 0) {
                        const currentStarlingCount = this.getStarlingCountForPlayer(player);
                        const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - currentStarlingCount);
                        const numStarlings = Math.min(Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY), availableStarlingSlots);
                        const usedEnergy = numStarlings * Constants.STARLING_COST_PER_ENERGY;
                        const unusedEnergy = Math.max(0, energyForMinions - usedEnergy);
                        if (unusedEnergy > 0) {
                            player.stellarForge.addPendingEnergy(unusedEnergy);
                        }
                        // Spawn starlings close to the forge
                        if (numStarlings > 0) {
                            for (let i = 0; i < numStarlings; i++) {
                                const angle = (Math.PI * 2 * i) / numStarlings; // Evenly distribute around forge
                                const spawnRadius = player.stellarForge.radius + Constants.STARLING_COLLISION_RADIUS_PX + 5;
                                const spawnPosition = new math_1.Vector2D(player.stellarForge.position.x + Math.cos(angle) * spawnRadius, player.stellarForge.position.y + Math.sin(angle) * spawnRadius);
                                const starling = new starling_1.Starling(spawnPosition, player, player.stellarForge?.minionPath ?? []);
                                player.units.push(starling);
                                player.unitsCreated++;
                            }
                            console.log(`${player.name} forge crunch spawned ${numStarlings} Starlings with ${energyForMinions.toFixed(0)} energy`);
                        }
                    }
                }
            }
            for (const building of player.buildings) {
                building.isReceivingLight = false;
                building.incomingLightPerSec = 0;
            }
            // Update solar mirrors - position and reflection angle
            // Mirrors can move during countdown to reach the sun
            for (const mirror of player.solarMirrors) {
                const oldMirrorPos = new math_1.Vector2D(mirror.position.x, mirror.position.y);
                mirror.update(deltaTime, this); // Update mirror movement with gameState
                // Check collision for mirror
                if (this.checkCollision(mirror.position, 20, mirror)) {
                    // Revert to old position and stop movement
                    mirror.position = oldMirrorPos;
                    mirror.velocity = new math_1.Vector2D(0, 0);
                }
                this.applyDustPushFromMovingEntity(mirror.position, mirror.velocity, Constants.MIRROR_DUST_PUSH_RADIUS_PX, Constants.MIRROR_DUST_PUSH_FORCE_MULTIPLIER, this.getPlayerImpactColor(player), deltaTime);
                if (mirror.linkedStructure instanceof buildings_1.Building && mirror.linkedStructure.isDestroyed()) {
                    mirror.setLinkedStructure(null);
                }
                if (mirror.linkedStructure instanceof stellar_forge_1.StellarForge && mirror.linkedStructure !== player.stellarForge) {
                    mirror.setLinkedStructure(null);
                }
                const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
                mirror.updateReflectionAngle(linkedStructure, this.suns, this.asteroids, deltaTime);
                // Check if light path is blocked by Velaris orb fields
                const isBlockedByVelarisField = this.isLightBlockedByVelarisField(mirror.position, linkedStructure ? linkedStructure.position : mirror.position);
                // Generate energy and apply to linked structure
                if (!isBlockedByVelarisField && mirror.hasLineOfSightToLight(this.suns, this.asteroids) && linkedStructure) {
                    const energyGenerated = mirror.generateEnergy(deltaTime);
                    if (linkedStructure instanceof stellar_forge_1.StellarForge &&
                        player.stellarForge &&
                        mirror.hasLineOfSightToForge(player.stellarForge, this.asteroids, this.players)) {
                        const completedForgeItems = player.stellarForge.advanceProductionByEnergy(energyGenerated);
                        for (const completedItem of completedForgeItems) {
                            if (completedItem.productionType === 'hero' && completedItem.heroUnitType) {
                                const spawnRadius = player.stellarForge.radius + Constants.UNIT_RADIUS_PX + 5;
                                const spawnPosition = new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y + spawnRadius);
                                const heroUnit = this.createHeroUnit(completedItem.heroUnitType, spawnPosition, player);
                                if (heroUnit) {
                                    player.units.push(heroUnit);
                                    player.unitsCreated++;
                                    console.log(`${player.name} forged hero ${completedItem.heroUnitType}`);
                                }
                            }
                            else if (completedItem.productionType === 'mirror' && completedItem.spawnPosition) {
                                player.solarMirrors.push(new solar_mirror_1.SolarMirror(new math_1.Vector2D(completedItem.spawnPosition.x, completedItem.spawnPosition.y), player));
                            }
                        }
                        // Add to player's spendable energy pool (non-forge actions)
                        player.addEnergy(energyGenerated);
                    }
                    else if (linkedStructure instanceof buildings_1.Building &&
                        mirror.hasLineOfSightToStructure(linkedStructure, this.asteroids, this.players)) {
                        linkedStructure.isReceivingLight = true;
                        linkedStructure.incomingLightPerSec += mirror.getEnergyRatePerSec();
                        // Provide energy to building being constructed
                        if (!linkedStructure.isComplete) {
                            linkedStructure.addEnergy(energyGenerated);
                        }
                    }
                    else if (linkedStructure instanceof warp_gate_1.WarpGate &&
                        mirror.hasLineOfSightToStructure(linkedStructure, this.asteroids, this.players)) {
                        // Provide energy to warp gate
                        const wasIncomplete = !linkedStructure.isComplete;
                        if (linkedStructure.isCharging && !linkedStructure.isComplete) {
                            linkedStructure.addEnergy(energyGenerated);
                        }
                        // If warp gate just completed, redirect mirror to main base
                        if (wasIncomplete && linkedStructure.isComplete && player.stellarForge) {
                            mirror.setLinkedStructure(player.stellarForge);
                        }
                    }
                }
                if (player.stellarForge && mirror.health < Constants.MIRROR_MAX_HEALTH) {
                    const distanceToForge = player.stellarForge.position.distanceTo(mirror.position);
                    if (distanceToForge <= Constants.INFLUENCE_RADIUS) {
                        mirror.health = Math.min(Constants.MIRROR_MAX_HEALTH, mirror.health + Constants.MIRROR_REGEN_PER_SEC * deltaTime);
                        // Spawn sparkle particles for regeneration visual effect
                        // Spawn ~2-3 particles per second
                        const rng = (0, seeded_random_1.getGameRNG)();
                        if (rng.next() < deltaTime * 2.5) {
                            const angle = rng.nextAngle();
                            const distance = rng.nextFloat(0, 25);
                            const sparklePos = new math_1.Vector2D(mirror.position.x + Math.cos(angle) * distance, mirror.position.y + Math.sin(angle) * distance);
                            const velocity = new math_1.Vector2D(rng.nextFloat(-15, 15), rng.nextFloat(-15, 15) - 20 // Slight upward bias
                            );
                            // Use player's color for sparkles
                            const playerColor = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                            this.sparkleParticles.push(new particles_1.SparkleParticle(sparklePos, velocity, 0.8, // lifetime in seconds
                            playerColor, rng.nextFloat(2, 4) // size 2-4
                            ));
                        }
                    }
                }
            }
        }
        for (const gate of this.warpGates) {
            if (gate.isCharging && !gate.isComplete && !gate.isCancelling && !gate.hasReceivedEnergyThisTick) {
                gate.startCancellation();
            }
        }
        // Update space dust particles
        this.updateSpaceDust(deltaTime);
        // Update units and collect enemies for targeting
        const allUnits = [];
        const allStructures = [];
        for (const player of this.players) {
            if (!player.isDefeated()) {
                allUnits.push(...player.units);
                allStructures.push(...player.buildings);
                for (const mirror of player.solarMirrors) {
                    if (mirror.health > 0) {
                        allStructures.push(mirror);
                    }
                }
                for (const gate of this.starlingMergeGates) {
                    if (gate.owner === player && gate.health > 0) {
                        allStructures.push(gate);
                    }
                }
                if (player.stellarForge) {
                    allStructures.push(player.stellarForge);
                }
            }
        }
        // Update each player's units
        for (const player of this.players) {
            if (player.isDefeated())
                continue;
            // Get enemies (units and structures not owned by this player or their team)
            const enemies = [];
            for (const otherPlayer of this.players) {
                // Skip self
                if (otherPlayer === player)
                    continue;
                // Skip defeated players
                if (otherPlayer.isDefeated())
                    continue;
                // Skip teammates in team games (3+ players)
                if (this.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                    continue;
                }
                enemies.push(...otherPlayer.units);
                enemies.push(...otherPlayer.buildings);
                for (const mirror of otherPlayer.solarMirrors) {
                    if (mirror.health > 0) {
                        enemies.push(mirror);
                    }
                }
                for (const gate of this.starlingMergeGates) {
                    if (gate.owner === otherPlayer && gate.health > 0) {
                        enemies.push(gate);
                    }
                }
                if (otherPlayer.stellarForge) {
                    enemies.push(otherPlayer.stellarForge);
                }
                // Add enemy shadow decoys as targetable entities
                // Note: Decoys have position, health, and owner properties compatible with CombatTarget,
                // but can't be added to the union type without creating circular dependencies
                for (const decoy of this.shadowDecoys) {
                    if (decoy.owner === otherPlayer && !decoy.shouldDespawn) {
                        enemies.push(decoy);
                    }
                }
            }
            // Update each unit (only after countdown)
            if (!this.isCountdownActive) {
                for (const unit of player.units) {
                    // Starlings need special AI update before regular update
                    if (unit instanceof starling_1.Starling) {
                        unit.updateAI(this, enemies);
                    }
                    unit.update(deltaTime, enemies, allUnits, this.asteroids);
                    // Apply shield blocking from enemy ShieldTowers (not allied ones)
                    for (const enemyPlayer of this.players) {
                        // Skip own units and teammates
                        if (enemyPlayer === unit.owner)
                            continue;
                        if (this.players.length >= 3 && enemyPlayer.teamId === unit.owner.teamId) {
                            continue;
                        }
                        for (const building of enemyPlayer.buildings) {
                            if (building instanceof buildings_1.ShieldTower && building.shieldActive && building.isComplete) {
                                const dx = unit.position.x - building.position.x;
                                const dy = unit.position.y - building.position.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                // If unit is inside shield radius, push it back out
                                if (distance < building.shieldRadius) {
                                    const pushDistance = building.shieldRadius - distance;
                                    // Avoid division by zero when unit is exactly at tower center
                                    if (distance > Constants.SHIELD_CENTER_COLLISION_THRESHOLD) {
                                        const dirX = dx / distance;
                                        const dirY = dy / distance;
                                        unit.position.x += dirX * pushDistance;
                                        unit.position.y += dirY * pushDistance;
                                    }
                                    else {
                                        // Push in arbitrary direction when at center
                                        unit.position.x += pushDistance;
                                    }
                                    // Stop unit's velocity when hitting shield
                                    unit.velocity.x = 0;
                                    unit.velocity.y = 0;
                                }
                            }
                        }
                    }
                    if (unit instanceof starling_1.Starling) {
                        this.applyDustPushFromMovingEntity(unit.position, unit.velocity, Constants.STARLING_DUST_PUSH_RADIUS_PX, Constants.STARLING_DUST_PUSH_FORCE_MULTIPLIER, this.getPlayerImpactColor(unit.owner), deltaTime);
                    }
                    // Apply fluid forces from Grave projectiles
                    if (unit instanceof game_core_1.Grave) {
                        for (const projectile of unit.getProjectiles()) {
                            if (projectile.isAttacking) {
                                // Attacking projectiles push dust as they fly
                                const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
                                this.applyFluidForceFromMovingObject(projectile.position, projectile.velocity, Constants.GRAVE_PROJECTILE_EFFECT_RADIUS, projectileSpeed * Constants.GRAVE_PROJECTILE_FORCE_MULTIPLIER, this.getPlayerImpactColor(unit.owner), deltaTime);
                            }
                        }
                    }
                    // If unit is a Marine, collect its effects
                    if (unit instanceof game_core_1.Marine) {
                        const effects = unit.getAndClearLastShotEffects();
                        if (effects.muzzleFlash) {
                            this.muzzleFlashes.push(effects.muzzleFlash);
                        }
                        if (effects.casing) {
                            this.bulletCasings.push(effects.casing);
                        }
                        if (effects.bouncingBullet) {
                            this.bouncingBullets.push(effects.bouncingBullet);
                        }
                    }
                    // If unit is a Mothership, collect its effects
                    if (unit instanceof game_core_1.Mothership) {
                        const effects = unit.getAndClearLastShotEffects();
                        if (effects.muzzleFlash) {
                            this.muzzleFlashes.push(effects.muzzleFlash);
                        }
                        if (effects.casing) {
                            this.bulletCasings.push(effects.casing);
                        }
                        if (effects.bouncingBullet) {
                            this.bouncingBullets.push(effects.bouncingBullet);
                        }
                        // Collect spawned mini-motherships
                        const minis = unit.getAndClearMiniMotherships();
                        this.miniMotherships.push(...minis);
                    }
                    // Collect ability effects from all units
                    const abilityEffects = unit.getAndClearLastAbilityEffects();
                    this.abilityBullets.push(...abilityEffects);
                    if (unit instanceof starling_1.Starling) {
                        const lasers = unit.getAndClearLastShotLasers();
                        if (lasers.length > 0) {
                            this.laserBeams.push(...lasers);
                            // Spawn impact particles at laser endpoints
                            for (const laser of lasers) {
                                for (let i = 0; i < Constants.STARLING_LASER_IMPACT_PARTICLES; i++) {
                                    const angle = (Math.PI * 2 * i) / Constants.STARLING_LASER_IMPACT_PARTICLES;
                                    const velocity = new math_1.Vector2D(Math.cos(angle) * Constants.STARLING_LASER_PARTICLE_SPEED, Math.sin(angle) * Constants.STARLING_LASER_PARTICLE_SPEED);
                                    this.impactParticles.push(new particles_1.ImpactParticle(new math_1.Vector2D(laser.endPos.x, laser.endPos.y), velocity, Constants.STARLING_LASER_PARTICLE_LIFETIME, laser.owner.faction));
                                }
                            }
                        }
                    }
                    // Handle InfluenceBall projectiles specifically
                    if (unit instanceof game_core_1.InfluenceBall) {
                        const projectile = unit.getAndClearProjectile();
                        if (projectile) {
                            this.influenceBallProjectiles.push(projectile);
                        }
                    }
                    // Handle Mortar projectiles
                    if (unit instanceof game_core_1.Mortar) {
                        const projectiles = unit.getAndClearLastShotProjectiles();
                        if (projectiles.length > 0) {
                            this.mortarProjectiles.push(...projectiles);
                        }
                    }
                    // Handle Tank crescent wave
                    if (unit instanceof game_core_1.Tank) {
                        const wave = unit.getCrescentWave();
                        if (wave && !this.crescentWaves.includes(wave)) {
                            this.crescentWaves.push(wave);
                        }
                    }
                    // Handle Nova bomb
                    if (unit instanceof game_core_1.Nova) {
                        const bomb = unit.getAndClearBomb();
                        if (bomb) {
                            this.novaBombs.push(bomb);
                        }
                    }
                    // Handle Sly sticky bomb and lasers
                    if (unit instanceof game_core_1.Sly) {
                        const bomb = unit.getAndClearBombToCreate();
                        if (bomb) {
                            this.stickyBombs.push(bomb);
                        }
                        const lasers = unit.getAndClearLasersToCreate();
                        if (lasers.length > 0) {
                            this.stickyLasers.push(...lasers);
                        }
                        const particles = unit.getAndClearParticlesToCreate();
                        if (particles.length > 0) {
                            this.disintegrationParticles.push(...particles);
                        }
                    }
                    // Handle Radiant orbs
                    if (unit instanceof game_core_1.Radiant) {
                        const orb = unit.getAndClearOrb();
                        if (orb) {
                            this.radiantOrbs.push(orb);
                            // Remove oldest orb if we have more than max
                            if (this.radiantOrbs.filter(o => o.owner === unit.owner).length > Constants.RADIANT_MAX_ORBS) {
                                const ownerOrbs = this.radiantOrbs.filter(o => o.owner === unit.owner);
                                const oldestOrb = ownerOrbs[0];
                                const index = this.radiantOrbs.indexOf(oldestOrb);
                                if (index > -1) {
                                    this.radiantOrbs.splice(index, 1);
                                }
                            }
                        }
                    }
                    // Handle Velaris orbs
                    if (unit instanceof game_core_1.VelarisHero) {
                        const orb = unit.getAndClearOrb();
                        if (orb) {
                            this.velarisOrbs.push(orb);
                            // Remove oldest orb if we have more than max
                            if (this.velarisOrbs.filter(o => o.owner === unit.owner).length > Constants.VELARIS_MAX_ORBS) {
                                const ownerOrbs = this.velarisOrbs.filter(o => o.owner === unit.owner);
                                const oldestOrb = ownerOrbs[0];
                                const index = this.velarisOrbs.indexOf(oldestOrb);
                                if (index > -1) {
                                    this.velarisOrbs.splice(index, 1);
                                }
                            }
                        }
                    }
                    // Handle Aurum orbs
                    if (unit instanceof game_core_1.AurumHero) {
                        const orb = unit.getAndClearOrb();
                        if (orb) {
                            this.aurumOrbs.push(orb);
                            // Remove oldest orb if we have more than max
                            if (this.aurumOrbs.filter(o => o.owner === unit.owner).length > Constants.AURUM_MAX_ORBS) {
                                const ownerOrbs = this.aurumOrbs.filter(o => o.owner === unit.owner);
                                const oldestOrb = ownerOrbs[0];
                                const index = this.aurumOrbs.indexOf(oldestOrb);
                                if (index > -1) {
                                    this.aurumOrbs.splice(index, 1);
                                }
                            }
                        }
                    }
                    // Handle Dash slashes
                    if (unit instanceof game_core_1.Dash) {
                        const slash = unit.getAndClearDashSlash();
                        if (slash) {
                            this.dashSlashes.push(slash);
                            // Mark unit as dashing
                            unit.setDashing(true, slash);
                        }
                    }
                    // Handle Blink shockwaves
                    if (unit instanceof game_core_1.Blink) {
                        const shockwave = unit.getAndClearShockwave();
                        if (shockwave) {
                            this.blinkShockwaves.push(shockwave);
                        }
                    }
                    // Handle Shadow decoys
                    if (unit instanceof game_core_1.Shadow) {
                        const decoy = unit.getAndClearDecoy();
                        if (decoy) {
                            this.shadowDecoys.push(decoy);
                        }
                    }
                    // Handle Chrono freeze circles
                    if (unit instanceof game_core_1.Chrono) {
                        const freezeCircle = unit.getAndClearFreezeCircle();
                        if (freezeCircle) {
                            this.chronoFreezeCircles.push(freezeCircle);
                        }
                    }
                    // Handle Ray beam updates
                    if (unit instanceof game_core_1.Ray) {
                        unit.updateBeamSegments(deltaTime);
                        // Apply fluid forces from active beam segments
                        for (const segment of unit.getBeamSegments()) {
                            this.applyFluidForceFromBeam(segment.startPos, segment.endPos, Constants.BEAM_EFFECT_RADIUS, Constants.BEAM_FORCE_STRENGTH, this.getPlayerImpactColor(unit.owner), deltaTime);
                        }
                        // Process Ray ability if just used (check if cooldown is near max)
                        if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1 && unit.drillDirection) {
                            this.processRayBeamAbility(unit);
                            unit.drillDirection = null; // Clear after processing
                        }
                    }
                    // Handle TurretDeployer ability
                    if (unit instanceof game_core_1.TurretDeployer) {
                        // Check if ability was just used (check if cooldown is near max)
                        if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1) {
                            this.processTurretDeployment(unit);
                        }
                    }
                    // Handle Spotlight ability updates and firing
                    if (unit instanceof game_core_1.Spotlight) {
                        this.updateSpotlightAbility(unit, enemies, deltaTime);
                    }
                    // Handle Driller movement and collision
                    if (unit instanceof game_core_1.Driller && unit.isDrilling) {
                        unit.updateDrilling(deltaTime);
                        this.processDrillerCollisions(unit, deltaTime);
                    }
                    // Handle Dagger timers
                    if (unit instanceof game_core_1.Dagger) {
                        unit.updateTimers(deltaTime);
                    }
                    // Handle Grave projectile absorption
                    if (unit instanceof game_core_1.Grave) {
                        for (const projectile of unit.getProjectiles()) {
                            if (projectile.isAttacking) {
                                // Check for absorption by Space Dust Swirler buildings
                                let wasAbsorbed = false;
                                for (const player of this.players) {
                                    for (const building of player.buildings) {
                                        if (building instanceof buildings_1.SpaceDustSwirler) {
                                            // Don't absorb friendly projectiles
                                            if (building.owner === projectile.owner)
                                                continue;
                                            if (building.absorbProjectile(projectile)) {
                                                // Make projectile return to grave (stop attacking)
                                                projectile.isAttacking = false;
                                                projectile.trail = [];
                                                projectile.targetEnemy = null;
                                                wasAbsorbed = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (wasAbsorbed)
                                        break;
                                }
                            }
                        }
                    }
                }
            } // End of countdown check
            if (!this.isCountdownActive) {
                this.updateStarlingMergeGatesForPlayer(player, deltaTime);
            }
            if (!this.isCountdownActive) {
                this.processStarlingSacrificesForPlayer(player);
            }
            // Remove dead units and track losses
            const deadUnits = player.units.filter(unit => unit.isDead());
            for (const deadUnit of deadUnits) {
                // Create death particles for visual effect
                const color = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                this.createDeathParticles(deadUnit, color);
            }
            player.unitsLost += deadUnits.length;
            player.units = player.units.filter(unit => !unit.isDead());
            // Update each building (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    building.update(deltaTime, enemies, allUnits, this.asteroids, allStructures, Constants.MAP_PLAYABLE_BOUNDARY);
                    // Check if StrikerTower countdown completed
                    if (building instanceof buildings_1.StrikerTower && building.targetPosition && building.countdownTimer <= 0.001 && building.isMissileReady()) {
                        // Countdown complete, fire the missile!
                        const targetPos = building.targetPosition;
                        const fired = building.fireMissile(targetPos, enemies, (pos) => this.isPointInShadow(pos), (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits), player.units);
                        // Track explosion for visual effect and trigger screen shake
                        if (fired) {
                            this.strikerTowerExplosions.push({
                                position: targetPos, // Use existing Vector2D directly
                                timestamp: this.gameTime
                            });
                        }
                    }
                    // If building is a Cannon or Gatling Tower, collect its effects
                    if (building instanceof buildings_1.Minigun || building instanceof buildings_1.GatlingTower) {
                        const effects = building.getAndClearLastShotEffects();
                        if (effects.muzzleFlash) {
                            this.muzzleFlashes.push(effects.muzzleFlash);
                        }
                        if (effects.casing) {
                            this.bulletCasings.push(effects.casing);
                        }
                        if (effects.bouncingBullet) {
                            this.bouncingBullets.push(effects.bouncingBullet);
                        }
                    }
                    if (building instanceof buildings_1.Minigun || building instanceof buildings_1.LockOnLaserTower) {
                        const lasers = building.getAndClearLastShotLasers();
                        if (lasers.length > 0) {
                            this.laserBeams.push(...lasers);
                        }
                    }
                    // If building is a Foundry, check for completed production
                    if (building instanceof buildings_1.SubsidiaryFactory) {
                        if (building.currentProduction) {
                            const totalLight = this.getMirrorLightOnStructure(player, building);
                            if (totalLight > 0) {
                                const buildRate = (totalLight / 10.0) * (1.0 / Constants.BUILDING_BUILD_TIME);
                                const buildProgress = buildRate * deltaTime;
                                building.addProductionProgress(buildProgress);
                            }
                        }
                        const completedProduction = building.getCompletedProduction();
                        if (completedProduction === Constants.FOUNDRY_STRAFE_UPGRADE_ITEM) {
                            building.upgradeStrafe();
                        }
                        else if (completedProduction === Constants.FOUNDRY_REGEN_UPGRADE_ITEM) {
                            building.upgradeRegen();
                        }
                        else if (completedProduction === Constants.FOUNDRY_ATTACK_UPGRADE_ITEM) {
                            building.upgradeAttack();
                        }
                        else if (completedProduction === Constants.FOUNDRY_BLINK_UPGRADE_ITEM) {
                            building.upgradeBlink();
                        }
                    }
                }
            } // End of countdown check for buildings
            // Update building construction (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    if (building.isComplete)
                        continue; // Skip completed buildings
                    // Check if building is inside player's influence (near stellar forge)
                    const isInInfluence = player.stellarForge &&
                        building.position.distanceTo(player.stellarForge.position) <= Constants.INFLUENCE_RADIUS;
                    if (isInInfluence && player.stellarForge) {
                        // Building inside influence: take energy from forge
                        // Calculate build progress per second (inverse of build time)
                        const buildRate = 1.0 / Constants.BUILDING_BUILD_TIME;
                        const buildProgress = buildRate * deltaTime;
                        // TODO: Split energy between buildings and hero units
                        // For now, buildings get energy if available
                        building.addBuildProgress(buildProgress);
                    }
                    else {
                        // Building outside influence: powered by mirrors shining on it
                        const totalLight = this.getMirrorLightOnStructure(player, building);
                        // Convert light to build progress
                        if (totalLight > 0) {
                            const buildRate = (totalLight / 10.0) * (1.0 / Constants.BUILDING_BUILD_TIME);
                            const buildProgress = buildRate * deltaTime;
                            building.addBuildProgress(buildProgress);
                        }
                    }
                }
            } // End of countdown check for building construction
            // Remove destroyed buildings
            const destroyedBuildings = player.buildings.filter(building => building.isDestroyed());
            for (const building of destroyedBuildings) {
                // Create death particles for visual effect
                const color = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                this.createDeathParticles(building, color);
            }
            player.buildings = player.buildings.filter(building => !building.isDestroyed());
        }
        if (!this.isCountdownActive) {
            this.resolveUnitCollisions(allUnits);
            this.resolveUnitObstacleCollisions(allUnits);
        }
        this.stateHashTickCounter += 1;
        if (this.stateHashTickCounter % Constants.STATE_HASH_TICK_INTERVAL === 0) {
            this.updateStateHash();
        }
        // Update muzzle flashes
        for (const flash of this.muzzleFlashes) {
            flash.update(deltaTime);
        }
        this.muzzleFlashes = this.muzzleFlashes.filter(flash => !flash.shouldDespawn());
        // Update bullet casings and interact with space dust
        for (const casing of this.bulletCasings) {
            casing.update(deltaTime);
            // Check collision with space dust particles
            for (const particle of this.spaceDust) {
                const distance = casing.position.distanceTo(particle.position);
                if (distance < Constants.CASING_SPACEDUST_COLLISION_DISTANCE) {
                    // Apply force to both casing and particle
                    const direction = new math_1.Vector2D(particle.position.x - casing.position.x, particle.position.y - casing.position.y).normalize();
                    particle.applyForce(new math_1.Vector2D(direction.x * Constants.CASING_SPACEDUST_FORCE, direction.y * Constants.CASING_SPACEDUST_FORCE));
                    // Apply counter-force to casing (damping applied in applyCollision method)
                    casing.applyCollision(new math_1.Vector2D(-direction.x * Constants.CASING_SPACEDUST_FORCE, -direction.y * Constants.CASING_SPACEDUST_FORCE));
                }
            }
        }
        this.bulletCasings = this.bulletCasings.filter(casing => !casing.shouldDespawn());
        // Update bouncing bullets
        for (const bullet of this.bouncingBullets) {
            bullet.update(deltaTime);
        }
        this.bouncingBullets = this.bouncingBullets.filter(bullet => !bullet.shouldDespawn());
        // Update ability bullets and check for hits
        for (const bullet of this.abilityBullets) {
            bullet.update(deltaTime);
            // Check if projectile is blocked by Tank shields
            let isBlocked = false;
            for (const player of this.players) {
                for (const unit of player.units) {
                    if (unit instanceof game_core_1.Tank && unit.isPositionInShield(bullet.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (bullet.owner !== player) {
                            isBlocked = true;
                            bullet.lifetime = bullet.maxLifetime; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked)
                    break;
            }
            if (isBlocked)
                continue;
            // Check if projectile is blocked by Aurum shields
            let blockedByAurum = false;
            for (const player of this.players) {
                // Skip friendly fire
                if (player === bullet.owner)
                    continue;
                // Check all Aurum orbs for this player
                const playerAurumOrbs = this.aurumOrbs.filter(orb => orb.owner === player);
                // Check if projectile crosses any shield field
                for (let i = 0; i < playerAurumOrbs.length; i++) {
                    for (let j = i + 1; j < playerAurumOrbs.length; j++) {
                        const orb1 = playerAurumOrbs[i];
                        const orb2 = playerAurumOrbs[j];
                        const distance = orb1.position.distanceTo(orb2.position);
                        const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                        if (distance <= maxRange) {
                            // Calculate distance from bullet to shield line
                            const distSq = this.pointToLineSegmentDistanceSquared(bullet.position, orb1.position, orb2.position);
                            // Shield starts offset from orbs
                            const shieldOffset = Constants.AURUM_SHIELD_OFFSET;
                            const distToOrb1 = bullet.position.distanceTo(orb1.position);
                            const distToOrb2 = bullet.position.distanceTo(orb2.position);
                            // Only block if not too close to orbs (leave them vulnerable)
                            if (distToOrb1 > shieldOffset && distToOrb2 > shieldOffset) {
                                const shieldWidth = 10; // Shield field width in pixels
                                if (distSq < shieldWidth * shieldWidth) {
                                    // Create shield hit effect
                                    const closestPoint = this.getClosestPointOnLineSegment(bullet.position, orb1.position, orb2.position);
                                    this.aurumShieldHits.push(new game_core_1.AurumShieldHit(closestPoint, player));
                                    blockedByAurum = true;
                                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                                    break;
                                }
                            }
                        }
                    }
                    if (blockedByAurum)
                        break;
                }
                if (blockedByAurum)
                    break;
            }
            if (blockedByAurum)
                continue;
            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof buildings_1.ShieldTower && building.shieldActive && building.isComplete) {
                        // Shield blocks enemy projectiles but not friendly fire
                        if (bullet.owner !== player && building.isEnemyBlocked(bullet.position)) {
                            // Damage the shield instead of letting projectile through
                            building.damageShield(bullet.damage);
                            bullet.lifetime = bullet.maxLifetime; // Mark for removal
                            blockedByShield = true;
                            break;
                        }
                    }
                }
                if (blockedByShield)
                    break;
            }
            if (blockedByShield)
                continue;
            // Check if healing bomb reached max range or lifetime - if so, explode
            if (bullet.isHealingBomb && bullet.healingBombOwner && bullet.shouldDespawn()) {
                bullet.healingBombOwner.explodeHealingBomb(bullet.position);
            }
            // Apply fluid-like force to space dust particles
            const bulletSpeed = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(bullet.position, bullet.velocity, Constants.ABILITY_BULLET_EFFECT_RADIUS, bulletSpeed * Constants.ABILITY_BULLET_FORCE_MULTIPLIER, this.getPlayerImpactColor(bullet.owner), deltaTime);
            // Check hits against enemies
            for (const player of this.players) {
                // Skip if same team as bullet
                if (player === bullet.owner) {
                    continue;
                }
                // Skip hit detection for healing bombs (they explode on max range/lifetime)
                if (bullet.isHealingBomb) {
                    continue;
                }
                // Check hits on units
                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        let finalDamage = bullet.damage;
                        // Check if this is a Beam projectile for distance-based damage
                        if (bullet.isBeamProjectile && bullet.beamOwner) {
                            const beamOwner = bullet.beamOwner;
                            const distance = beamOwner.position.distanceTo(unit.position);
                            const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                            finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);
                            // Store info for display above Beam unit
                            beamOwner.lastBeamDamage = finalDamage;
                            beamOwner.lastBeamDistance = distance;
                            beamOwner.lastBeamMultiplier = multiplier;
                            beamOwner.lastBeamTime = this.gameTime;
                        }
                        unit.takeDamage(finalDamage);
                        // Create damage number
                        const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                        this.addDamageNumber(unit.position, finalDamage, unit.maxHealth, unit.health, unitKey);
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }
                if (bullet.shouldDespawn()) {
                    continue;
                }
                for (const mirror of player.solarMirrors) {
                    if (mirror.health <= 0) {
                        continue;
                    }
                    if (bullet.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(bullet.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        this.addDamageNumber(mirror.position, mirrorDamage, Constants.MIRROR_MAX_HEALTH, mirror.health, mirrorKey);
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }
                if (bullet.shouldDespawn()) {
                    continue;
                }
                for (const gate of this.starlingMergeGates) {
                    if (gate.owner !== player || gate.health <= 0) {
                        continue;
                    }
                    if (bullet.checkHit(gate)) {
                        gate.health -= bullet.damage;
                        const gateKey = `merge_gate_${gate.position.x}_${gate.position.y}_${player.name}`;
                        this.addDamageNumber(gate.position, bullet.damage, gate.maxHealth, gate.health, gateKey);
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }
                if (bullet.shouldDespawn()) {
                    continue;
                }
                // Check hits on Stellar Forge
                if (player.stellarForge && bullet.checkHit(player.stellarForge)) {
                    let finalDamage = bullet.damage;
                    // Check if this is a Beam projectile for distance-based damage
                    if (bullet.isBeamProjectile && bullet.beamOwner) {
                        const beamOwner = bullet.beamOwner;
                        const distance = beamOwner.position.distanceTo(player.stellarForge.position);
                        const multiplier = 1 + (distance * Constants.BEAM_ABILITY_DAMAGE_PER_DISTANCE);
                        finalDamage = Math.round(Constants.BEAM_ABILITY_BASE_DAMAGE * multiplier);
                        // Store info for display above Beam unit
                        beamOwner.lastBeamDamage = finalDamage;
                        beamOwner.lastBeamDistance = distance;
                        beamOwner.lastBeamMultiplier = multiplier;
                        beamOwner.lastBeamTime = this.gameTime;
                    }
                    player.stellarForge.health -= finalDamage;
                    // Create damage number
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    this.addDamageNumber(player.stellarForge.position, finalDamage, Constants.STELLAR_FORGE_MAX_HEALTH, player.stellarForge.health, forgeKey);
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                }
            }
        }
        this.abilityBullets = this.abilityBullets.filter(bullet => !bullet.shouldDespawn());
        // Update mortar projectiles and check for splash damage hits
        for (const projectile of this.mortarProjectiles) {
            projectile.update(deltaTime);
            // Check hits against enemies
            let shouldExplode = false;
            for (const player of this.players) {
                // Skip if same team as projectile
                if (player === projectile.owner) {
                    continue;
                }
                // Check if projectile hit any unit
                for (const unit of player.units) {
                    if (projectile.checkHit(unit)) {
                        shouldExplode = true;
                        break;
                    }
                }
                if (shouldExplode) {
                    break;
                }
            }
            // If projectile hit something or reached max lifetime, apply splash damage
            if (shouldExplode || projectile.shouldDespawn()) {
                // Collect all enemy targets for splash damage
                const allEnemyTargets = [];
                for (const player of this.players) {
                    if (player === projectile.owner) {
                        continue;
                    }
                    // Add units as potential targets
                    allEnemyTargets.push(...player.units);
                    // Add forge as potential target
                    if (player.stellarForge && player.stellarForge.health > 0) {
                        allEnemyTargets.push(player.stellarForge);
                    }
                    // Add buildings as potential targets
                    for (const building of player.buildings) {
                        if (building.health > 0) {
                            allEnemyTargets.push(building);
                        }
                    }
                }
                // Apply splash damage to all targets in range
                const damagedTargets = projectile.applySplashDamage(allEnemyTargets);
                // Create damage numbers for all damaged targets
                for (const target of damagedTargets) {
                    const distance = projectile.position.distanceTo(target.position);
                    const damageMultiplier = 1.0 - (distance / projectile.splashRadius) * (1.0 - Constants.MORTAR_SPLASH_DAMAGE_FALLOFF);
                    const finalDamage = Math.round(projectile.damage * damageMultiplier);
                    if (target instanceof unit_1.Unit) {
                        const unitKey = `unit_${target.position.x}_${target.position.y}_${target.owner.name}`;
                        this.addDamageNumber(target.position, finalDamage, target.maxHealth, target.health, unitKey);
                    }
                    else if ('isBuilding' in target && target.isBuilding) {
                        const buildingKey = `building_${target.position.x}_${target.position.y}`;
                        this.addDamageNumber(target.position, finalDamage, target.maxHealth, target.health, buildingKey);
                    }
                    else if ('isForge' in target && target.isForge) {
                        const forgeKey = `forge_${target.position.x}_${target.position.y}`;
                        this.addDamageNumber(target.position, finalDamage, target.maxHealth, target.health, forgeKey);
                    }
                }
                // Mark projectile for removal
                projectile.lifetime = projectile.maxLifetime;
            }
        }
        this.mortarProjectiles = this.mortarProjectiles.filter(projectile => !projectile.shouldDespawn());
        // Update minion projectiles and check for hits
        for (const projectile of this.minionProjectiles) {
            projectile.update(deltaTime);
            // Check if projectile is blocked by Tank shields
            let isBlocked = false;
            for (const player of this.players) {
                for (const unit of player.units) {
                    if (unit instanceof game_core_1.Tank && unit.isPositionInShield(projectile.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (projectile.owner !== player) {
                            isBlocked = true;
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked)
                    break;
            }
            if (isBlocked)
                continue;
            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof buildings_1.ShieldTower && building.shieldActive && building.isComplete) {
                        // Shield blocks enemy projectiles but not friendly fire
                        if (projectile.owner !== player && building.isEnemyBlocked(projectile.position)) {
                            // Damage the shield instead of letting projectile through
                            const projectileDamage = 'damage' in projectile ? projectile.damage : Constants.DEFAULT_PROJECTILE_DAMAGE;
                            building.damageShield(projectileDamage);
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            blockedByShield = true;
                            break;
                        }
                    }
                }
                if (blockedByShield)
                    break;
            }
            if (blockedByShield)
                continue;
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(projectile.position, projectile.velocity, Constants.MINION_PROJECTILE_EFFECT_RADIUS, projectileSpeed * Constants.MINION_PROJECTILE_FORCE_MULTIPLIER, this.getPlayerImpactColor(projectile.owner), deltaTime);
            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof buildings_1.SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner)
                            continue;
                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting distance to max
                            projectile.distanceTraveledPx = projectile.maxRangePx;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed)
                    break;
            }
            if (wasAbsorbed)
                continue;
            // Check hits on Aurum orbs (they can take damage)
            let hitOrb = false;
            for (const orb of this.aurumOrbs) {
                // Don't hit own orbs
                if (orb.owner === projectile.owner)
                    continue;
                const distance = projectile.position.distanceTo(orb.position);
                if (distance < Constants.AURUM_ORB_RADIUS) {
                    const projectileDamage = 'damage' in projectile ? projectile.damage : Constants.DEFAULT_PROJECTILE_DAMAGE;
                    orb.takeDamage(projectileDamage);
                    this.damageNumbers.push(new damage_number_1.DamageNumber(orb.position, projectileDamage, this.gameTime));
                    projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                    hitOrb = true;
                    break;
                }
            }
            if (hitOrb)
                continue;
            let hasHit = false;
            for (const player of this.players) {
                if (player === projectile.owner) {
                    continue;
                }
                for (const unit of player.units) {
                    if (projectile.checkHit(unit)) {
                        unit.takeDamage(projectile.damage);
                        // Create damage number
                        const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                        this.addDamageNumber(unit.position, projectile.damage, unit.maxHealth, unit.health, unitKey);
                        hasHit = true;
                        break;
                    }
                }
                if (hasHit) {
                    break;
                }
                for (const mirror of player.solarMirrors) {
                    if (mirror.health <= 0) {
                        continue;
                    }
                    if (projectile.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(projectile.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        this.addDamageNumber(mirror.position, mirrorDamage, Constants.MIRROR_MAX_HEALTH, mirror.health, mirrorKey);
                        hasHit = true;
                        break;
                    }
                }
                if (hasHit) {
                    break;
                }
                for (const gate of this.starlingMergeGates) {
                    if (gate.owner !== player || gate.health <= 0) {
                        continue;
                    }
                    if (projectile.checkHit(gate)) {
                        gate.health -= projectile.damage;
                        const gateKey = `merge_gate_${gate.position.x}_${gate.position.y}_${player.name}`;
                        this.addDamageNumber(gate.position, projectile.damage, gate.maxHealth, gate.health, gateKey);
                        hasHit = true;
                        break;
                    }
                }
                if (hasHit) {
                    break;
                }
                for (const building of player.buildings) {
                    if (projectile.checkHit(building)) {
                        building.health -= projectile.damage;
                        // Create damage number
                        const buildingKey = `building_${building.position.x}_${building.position.y}_${player.name}`;
                        this.addDamageNumber(building.position, projectile.damage, building.maxHealth, building.health, buildingKey);
                        hasHit = true;
                        break;
                    }
                }
                if (hasHit) {
                    break;
                }
                if (player.stellarForge && projectile.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= projectile.damage;
                    // Create damage number
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    this.addDamageNumber(player.stellarForge.position, projectile.damage, Constants.STELLAR_FORGE_MAX_HEALTH, player.stellarForge.health, forgeKey);
                    hasHit = true;
                    break;
                }
            }
            if (hasHit) {
                projectile.distanceTraveledPx = projectile.maxRangePx;
            }
        }
        this.minionProjectiles = this.minionProjectiles.filter(projectile => !projectile.shouldDespawn());
        // Update laser beams (visual effects only)
        this.laserBeams = this.laserBeams.filter(laser => !laser.update(deltaTime));
        // Update impact particles (visual effects only)
        for (const particle of this.impactParticles) {
            particle.update(deltaTime);
        }
        this.impactParticles = this.impactParticles.filter(particle => !particle.shouldDespawn());
        // Update sparkle particles (regeneration visual effects)
        for (const sparkle of this.sparkleParticles) {
            sparkle.update(deltaTime);
        }
        this.sparkleParticles = this.sparkleParticles.filter(sparkle => !sparkle.shouldDespawn());
        // Update death particles (breaking apart effect)
        this.updateDeathParticles(deltaTime);
        // Clean up old striker tower explosions (keep for 1 second)
        this.strikerTowerExplosions = this.strikerTowerExplosions.filter(explosion => this.gameTime - explosion.timestamp < 1.0);
        // Update influence zones
        this.influenceZones = this.influenceZones.filter(zone => !zone.update(deltaTime));
        // Update influence ball projectiles
        for (const projectile of this.influenceBallProjectiles) {
            projectile.update(deltaTime);
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(projectile.position, projectile.velocity, Constants.INFLUENCE_BALL_EFFECT_RADIUS, projectileSpeed * Constants.INFLUENCE_BALL_FORCE_MULTIPLIER, this.getPlayerImpactColor(projectile.owner), deltaTime);
            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof buildings_1.SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner)
                            continue;
                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting lifetime to max
                            projectile.lifetime = projectile.maxLifetime;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed)
                    break;
            }
            if (wasAbsorbed)
                continue;
            // Check if should explode (max lifetime reached)
            if (projectile.shouldExplode()) {
                // Create influence zone
                const zone = new game_core_1.InfluenceZone(new math_1.Vector2D(projectile.position.x, projectile.position.y), projectile.owner);
                this.influenceZones.push(zone);
            }
        }
        this.influenceBallProjectiles = this.influenceBallProjectiles.filter(p => !p.shouldExplode());
        // Update crescent waves and handle stunning
        for (const wave of this.crescentWaves) {
            wave.update(deltaTime);
            // Check for units in wave and stun them
            for (const player of this.players) {
                for (const unit of player.units) {
                    // Only stun units that haven't been affected by this wave yet
                    if (!wave.affectedUnits.has(unit) && wave.isPointInWave(unit.position)) {
                        unit.applyStun(Constants.TANK_STUN_DURATION);
                        wave.affectedUnits.add(unit);
                    }
                }
            }
            // Erase projectiles in wave
            this.abilityBullets = this.abilityBullets.filter(bullet => {
                if (wave.isPointInWave(bullet.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
            this.minionProjectiles = this.minionProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
            this.mortarProjectiles = this.mortarProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
            this.influenceBallProjectiles = this.influenceBallProjectiles.filter(projectile => {
                if (wave.isPointInWave(projectile.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
            this.bouncingBullets = this.bouncingBullets.filter(bullet => {
                if (wave.isPointInWave(bullet.position)) {
                    return false; // Remove projectile
                }
                return true;
            });
        }
        this.crescentWaves = this.crescentWaves.filter(wave => !wave.shouldDespawn());
        // Update Nova bombs
        for (const bomb of this.novaBombs) {
            bomb.update(deltaTime);
            // Check for bounces off asteroids
            for (const asteroid of this.asteroids) {
                const distance = bomb.position.distanceTo(asteroid.position);
                if (distance < asteroid.size + Constants.NOVA_BOMB_RADIUS) {
                    // Calculate normal vector from asteroid center to bomb
                    const dx = bomb.position.x - asteroid.position.x;
                    const dy = bomb.position.y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        bomb.bounce(normalX, normalY);
                        // Push bomb outside asteroid
                        bomb.position.x = asteroid.position.x + normalX * (asteroid.size + Constants.NOVA_BOMB_RADIUS);
                        bomb.position.y = asteroid.position.y + normalY * (asteroid.size + Constants.NOVA_BOMB_RADIUS);
                    }
                }
            }
            // Check for bounces off map edges
            const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
            if (bomb.position.x <= -boundary) {
                bomb.bounce(1, 0); // Bounce off left edge
                bomb.position.x = -boundary;
            }
            else if (bomb.position.x >= boundary) {
                bomb.bounce(-1, 0); // Bounce off right edge
                bomb.position.x = boundary;
            }
            if (bomb.position.y <= -boundary) {
                bomb.bounce(0, 1); // Bounce off top edge
                bomb.position.y = -boundary;
            }
            else if (bomb.position.y >= boundary) {
                bomb.bounce(0, -1); // Bounce off bottom edge
                bomb.position.y = boundary;
            }
            // Check if bomb is hit by enemy abilities (ability bullets, mortar projectiles, etc.)
            for (const bullet of this.abilityBullets) {
                if (bullet.owner !== bomb.owner) {
                    const distance = bomb.position.distanceTo(bullet.position);
                    if (distance < Constants.NOVA_BOMB_RADIUS) {
                        bomb.takeDamage(); // Premature explosion
                        break;
                    }
                }
            }
            for (const projectile of this.mortarProjectiles) {
                if (projectile.owner !== bomb.owner) {
                    const distance = bomb.position.distanceTo(projectile.position);
                    if (distance < Constants.NOVA_BOMB_RADIUS) {
                        bomb.takeDamage(); // Premature explosion
                        break;
                    }
                }
            }
            // Check if bomb should explode
            if (bomb.shouldExplode()) {
                const scatterDir = bomb.getScatterDirection();
                if (scatterDir) {
                    // Create scatter bullets in a 30-degree arc
                    const baseAngle = Math.atan2(scatterDir.y, scatterDir.x);
                    const halfArc = Constants.NOVA_BOMB_SCATTER_ARC / 2;
                    for (let i = 0; i < Constants.NOVA_BOMB_SCATTER_BULLET_COUNT; i++) {
                        const t = i / (Constants.NOVA_BOMB_SCATTER_BULLET_COUNT - 1);
                        const angle = baseAngle - halfArc + t * Constants.NOVA_BOMB_SCATTER_ARC;
                        const velocity = new math_1.Vector2D(Math.cos(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED, Math.sin(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED);
                        this.novaScatterBullets.push(new game_core_1.NovaScatterBullet(new math_1.Vector2D(bomb.position.x, bomb.position.y), velocity, bomb.owner));
                    }
                    // Apply explosion damage to nearby enemies
                    for (const player of this.players) {
                        if (player === bomb.owner)
                            continue;
                        for (const unit of player.units) {
                            const distance = bomb.position.distanceTo(unit.position);
                            if (distance <= Constants.NOVA_BOMB_EXPLOSION_RADIUS) {
                                unit.health -= Constants.NOVA_BOMB_EXPLOSION_DAMAGE;
                            }
                        }
                        for (const building of player.buildings) {
                            const distance = bomb.position.distanceTo(building.position);
                            if (distance <= Constants.NOVA_BOMB_EXPLOSION_RADIUS) {
                                building.health -= Constants.NOVA_BOMB_EXPLOSION_DAMAGE;
                            }
                        }
                    }
                    // Clear bomb reference from Nova hero
                    if (bomb.novaUnit && bomb.novaUnit.getActiveBomb() === bomb) {
                        bomb.novaUnit.clearActiveBomb();
                    }
                }
            }
        }
        this.novaBombs = this.novaBombs.filter(bomb => !bomb.shouldExplode());
        // Update Nova scatter bullets
        for (const bullet of this.novaScatterBullets) {
            bullet.update(deltaTime);
            // Check for hits on enemy units
            for (const player of this.players) {
                if (player === bullet.owner)
                    continue;
                for (const unit of player.units) {
                    if (bullet.checkHit(unit)) {
                        unit.health -= bullet.damage;
                        bullet.lifetime = bullet.maxLifetime; // Mark for removal
                        break;
                    }
                }
            }
        }
        this.novaScatterBullets = this.novaScatterBullets.filter(bullet => !bullet.shouldDespawn());
        // Update Mini-Motherships
        for (const mini of this.miniMotherships) {
            // Collect enemy targets for AI targeting
            const enemyTargets = [];
            for (const player of this.players) {
                if (player === mini.owner)
                    continue;
                // Add enemy units
                for (const unit of player.units) {
                    enemyTargets.push(unit);
                }
                // Add enemy buildings
                for (const building of player.buildings) {
                    enemyTargets.push(building);
                }
                // Add enemy forge
                if (player.stellarForge) {
                    enemyTargets.push(player.stellarForge);
                }
            }
            // Update mini-mothership (movement, targeting, attacking)
            mini.update(deltaTime, enemyTargets);
            // Collect shot effects
            const effects = mini.getAndClearLastShotEffects();
            if (effects.muzzleFlash) {
                this.muzzleFlashes.push(effects.muzzleFlash);
            }
            if (effects.casing) {
                this.bulletCasings.push(effects.casing);
            }
            if (effects.bouncingBullet) {
                this.bouncingBullets.push(effects.bouncingBullet);
            }
            // Check collision with environment
            const allBuildings = [];
            for (const player of this.players) {
                allBuildings.push(...player.buildings);
                if (player.stellarForge) {
                    allBuildings.push(player.stellarForge);
                }
            }
            if (mini.checkCollision(Constants.MAP_PLAYABLE_BOUNDARY, this.asteroids, allBuildings)) {
                mini.explode();
            }
            // If exploded, create explosion
            if (mini.exploded) {
                this.miniMothershipExplosions.push({
                    position: new math_1.Vector2D(mini.position.x, mini.position.y),
                    owner: mini.owner,
                    timestamp: this.gameTime
                });
            }
        }
        // Apply splash damage from mini-mothership explosions
        for (const explosion of this.miniMothershipExplosions) {
            const allTargets = [];
            for (const player of this.players) {
                // Add all units
                for (const unit of player.units) {
                    allTargets.push(unit);
                }
                // Add all buildings
                for (const building of player.buildings) {
                    allTargets.push(building);
                }
                // Add forge
                if (player.stellarForge) {
                    allTargets.push(player.stellarForge);
                }
            }
            // Apply splash damage to all targets in range (friendly and enemy)
            for (const target of allTargets) {
                const distance = explosion.position.distanceTo(target.position);
                if (distance <= Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS) {
                    // Calculate damage with falloff
                    const damageMultiplier = 1.0 - (distance / Constants.MOTHERSHIP_MINI_EXPLOSION_RADIUS) * (1.0 - Constants.MOTHERSHIP_MINI_EXPLOSION_FALLOFF);
                    const damage = Constants.MOTHERSHIP_MINI_EXPLOSION_DAMAGE * damageMultiplier;
                    target.health -= damage;
                    // Create damage number
                    this.damageNumbers.push(new damage_number_1.DamageNumber(new math_1.Vector2D(target.position.x, target.position.y), Math.round(damage), this.gameTime));
                }
            }
        }
        // Clean up old explosions (older than 1 second)
        this.miniMothershipExplosions = this.miniMothershipExplosions.filter(exp => this.gameTime - exp.timestamp < 1.0);
        // Remove despawned mini-motherships
        this.miniMotherships = this.miniMotherships.filter(mini => !mini.shouldDespawn);
        // Update Shadow Decoys
        for (const decoy of this.shadowDecoys) {
            // Update decoy
            decoy.update(deltaTime);
            // Check collision with environment
            const allBuildings = [];
            for (const player of this.players) {
                allBuildings.push(...player.buildings);
                if (player.stellarForge) {
                    allBuildings.push(player.stellarForge);
                }
            }
            if (decoy.checkCollision(Constants.MAP_PLAYABLE_BOUNDARY, this.asteroids, allBuildings)) {
                decoy.shouldDespawn = true;
                // Create swarm of erratic particles
                const rng = (0, seeded_random_1.getGameRNG)();
                for (let i = 0; i < Constants.SHADOW_DECOY_PARTICLE_COUNT; i++) {
                    const angle = rng.nextFloat(0, Math.PI * 2);
                    const speed = rng.nextFloat(Constants.SHADOW_DECOY_PARTICLE_SPEED * 0.5, Constants.SHADOW_DECOY_PARTICLE_SPEED * 1.5);
                    const velocity = new math_1.Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this.shadowDecoyParticles.push(new game_core_1.ShadowDecoyParticle(decoy.position, velocity));
                }
            }
        }
        // Shadow decoys can take damage from projectiles and attacks
        for (const decoy of this.shadowDecoys) {
            if (decoy.shouldDespawn)
                continue;
            // Check damage from ability bullets
            for (const bullet of this.abilityBullets) {
                if (bullet.owner === decoy.owner)
                    continue; // Don't damage own decoys
                const distance = decoy.position.distanceTo(bullet.position);
                if (distance < Constants.SHADOW_DECOY_COLLISION_RADIUS) {
                    decoy.takeDamage(bullet.damage);
                    bullet.lifetime = bullet.maxLifetime; // Mark for removal
                    // Create damage number
                    this.damageNumbers.push(new damage_number_1.DamageNumber(new math_1.Vector2D(decoy.position.x, decoy.position.y), Math.round(bullet.damage), this.gameTime));
                }
            }
            // If decoy died, create despawn particles
            if (decoy.shouldDespawn && decoy.health <= 0) {
                const rng = (0, seeded_random_1.getGameRNG)();
                for (let i = 0; i < Constants.SHADOW_DECOY_PARTICLE_COUNT; i++) {
                    const angle = rng.nextFloat(0, Math.PI * 2);
                    const speed = rng.nextFloat(Constants.SHADOW_DECOY_PARTICLE_SPEED * 0.5, Constants.SHADOW_DECOY_PARTICLE_SPEED * 1.5);
                    const velocity = new math_1.Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    this.shadowDecoyParticles.push(new game_core_1.ShadowDecoyParticle(decoy.position, velocity));
                }
            }
        }
        // Remove despawned decoys
        this.shadowDecoys = this.shadowDecoys.filter(decoy => !decoy.shouldDespawn);
        // Update shadow decoy particles
        for (const particle of this.shadowDecoyParticles) {
            particle.update(deltaTime);
        }
        this.shadowDecoyParticles = this.shadowDecoyParticles.filter(p => !p.shouldDespawn());
        // Update Sticky Bombs
        for (const bomb of this.stickyBombs) {
            bomb.update(deltaTime);
            // If not stuck, check for sticking to surfaces
            if (!bomb.isStuck) {
                // Check for sticking to asteroids
                for (const asteroid of this.asteroids) {
                    const distance = bomb.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size + Constants.STICKY_BOMB_STICK_DISTANCE) {
                        // Calculate normal vector from asteroid center to bomb (outward direction)
                        const dx = bomb.position.x - asteroid.position.x;
                        const dy = bomb.position.y - asteroid.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            const normal = new math_1.Vector2D(dx / dist, dy / dist);
                            bomb.stickToSurface('asteroid', normal, asteroid);
                            // Position bomb on surface
                            bomb.position.x = asteroid.position.x + normal.x * (asteroid.size + Constants.STICKY_BOMB_RADIUS);
                            bomb.position.y = asteroid.position.y + normal.y * (asteroid.size + Constants.STICKY_BOMB_RADIUS);
                        }
                        break;
                    }
                }
                // Check for sticking to structures (buildings, mirrors, forge)
                if (!bomb.isStuck) {
                    for (const player of this.players) {
                        // Check buildings
                        for (const building of player.buildings) {
                            const distance = bomb.position.distanceTo(building.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                // Calculate normal vector from building to bomb
                                const dx = bomb.position.x - building.position.x;
                                const dy = bomb.position.y - building.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new math_1.Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, building);
                                }
                                break;
                            }
                        }
                        if (bomb.isStuck)
                            break;
                        // Check solar mirrors
                        for (const mirror of player.solarMirrors) {
                            const distance = bomb.position.distanceTo(mirror.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - mirror.position.x;
                                const dy = bomb.position.y - mirror.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new math_1.Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, mirror);
                                }
                                break;
                            }
                        }
                        if (bomb.isStuck)
                            break;
                        // Check stellar forge
                        if (player.stellarForge) {
                            const distance = bomb.position.distanceTo(player.stellarForge.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - player.stellarForge.position.x;
                                const dy = bomb.position.y - player.stellarForge.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new math_1.Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, player.stellarForge);
                                }
                                break;
                            }
                        }
                        if (bomb.isStuck)
                            break;
                    }
                }
                // Check for sticking to map edges (playing field boundary)
                if (!bomb.isStuck) {
                    const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
                    const edgeThreshold = Constants.STICKY_BOMB_STICK_DISTANCE;
                    if (bomb.position.x <= -boundary + edgeThreshold) {
                        // Stick to left edge
                        bomb.stickToSurface('edge', new math_1.Vector2D(1, 0));
                        bomb.position.x = -boundary + Constants.STICKY_BOMB_RADIUS;
                    }
                    else if (bomb.position.x >= boundary - edgeThreshold) {
                        // Stick to right edge
                        bomb.stickToSurface('edge', new math_1.Vector2D(-1, 0));
                        bomb.position.x = boundary - Constants.STICKY_BOMB_RADIUS;
                    }
                    else if (bomb.position.y <= -boundary + edgeThreshold) {
                        // Stick to top edge
                        bomb.stickToSurface('edge', new math_1.Vector2D(0, 1));
                        bomb.position.y = -boundary + Constants.STICKY_BOMB_RADIUS;
                    }
                    else if (bomb.position.y >= boundary - edgeThreshold) {
                        // Stick to bottom edge
                        bomb.stickToSurface('edge', new math_1.Vector2D(0, -1));
                        bomb.position.y = boundary - Constants.STICKY_BOMB_RADIUS;
                    }
                }
            }
            // Check if bomb should disintegrate
            if (bomb.shouldDisintegrate()) {
                // Notify owner and create particles
                bomb.slyOwner.onBombDestroyed(bomb);
            }
        }
        this.stickyBombs = this.stickyBombs.filter(bomb => !bomb.shouldDespawn());
        // Update Sticky Lasers
        for (const laser of this.stickyLasers) {
            laser.update(deltaTime);
            // Check for hits on enemy units and structures
            for (const player of this.players) {
                if (player === laser.owner)
                    continue;
                // Check units
                for (const unit of player.units) {
                    if (laser.checkHit(unit)) {
                        unit.health -= laser.damage;
                        this.damageNumbers.push(new damage_number_1.DamageNumber(unit.position, laser.damage, this.gameTime));
                    }
                }
                // Check buildings
                for (const building of player.buildings) {
                    if (laser.checkHit(building)) {
                        building.health -= laser.damage;
                        this.damageNumbers.push(new damage_number_1.DamageNumber(building.position, laser.damage, this.gameTime));
                    }
                }
                // Check solar mirrors
                for (const mirror of player.solarMirrors) {
                    if (laser.checkHit(mirror)) {
                        const mirrorDamage = Math.max(1, Math.round(laser.damage * (1 - Constants.MIRROR_DAMAGE_REDUCTION)));
                        mirror.health -= mirrorDamage;
                        this.damageNumbers.push(new damage_number_1.DamageNumber(mirror.position, mirrorDamage, this.gameTime));
                    }
                }
                // Check stellar forge
                if (player.stellarForge && laser.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= laser.damage;
                    this.damageNumbers.push(new damage_number_1.DamageNumber(player.stellarForge.position, laser.damage, this.gameTime));
                }
            }
        }
        this.stickyLasers = this.stickyLasers.filter(laser => !laser.shouldDespawn());
        // Update disintegration particles
        for (const particle of this.disintegrationParticles) {
            particle.update(deltaTime);
        }
        this.disintegrationParticles = this.disintegrationParticles.filter(particle => !particle.shouldDespawn());
        // Update Radiant orbs
        for (const orb of this.radiantOrbs) {
            orb.update(deltaTime, this.asteroids);
        }
        // Remove stopped orbs
        this.radiantOrbs = this.radiantOrbs.filter(orb => !orb.isStopped());
        // Apply laser damage between Radiant orbs
        for (let i = 0; i < this.radiantOrbs.length; i++) {
            for (let j = i + 1; j < this.radiantOrbs.length; j++) {
                const orb1 = this.radiantOrbs[i];
                const orb2 = this.radiantOrbs[j];
                // Only connect orbs from same owner
                if (orb1.owner !== orb2.owner)
                    continue;
                const distance = orb1.position.distanceTo(orb2.position);
                const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                if (distance <= maxRange) {
                    // There's a laser between these orbs - check for units crossing it
                    for (const player of this.players) {
                        if (player === orb1.owner)
                            continue; // Don't damage own units
                        for (const unit of player.units) {
                            // Calculate distance from unit to line segment between orbs
                            const lineDistSq = this.pointToLineSegmentDistanceSquared(unit.position, orb1.position, orb2.position);
                            const laserWidth = 5; // Laser field width in pixels
                            if (lineDistSq < laserWidth * laserWidth) {
                                const damage = Constants.RADIANT_LASER_DAMAGE_PER_SEC * deltaTime;
                                unit.health -= damage;
                                this.damageNumbers.push(new damage_number_1.DamageNumber(unit.position, damage, this.gameTime));
                            }
                        }
                    }
                }
            }
        }
        // Update Velaris orbs
        for (const orb of this.velarisOrbs) {
            orb.update(deltaTime, this.asteroids);
        }
        this.velarisOrbs = this.velarisOrbs.filter(orb => !orb.isStopped());
        // Update Aurum orbs
        for (const orb of this.aurumOrbs) {
            orb.update(deltaTime, this.asteroids);
        }
        // Remove destroyed or stopped orbs
        this.aurumOrbs = this.aurumOrbs.filter(orb => !orb.isDestroyed() && !orb.isStopped());
        // Update Aurum shield hits
        for (const hit of this.aurumShieldHits) {
            if (hit.update(deltaTime)) {
                // Mark for removal
            }
        }
        this.aurumShieldHits = this.aurumShieldHits.filter(hit => hit.getProgress() < 1.0);
        // Update Dash slashes
        for (const slash of this.dashSlashes) {
            slash.update(deltaTime);
            // Bounce off asteroids
            for (const asteroid of this.asteroids) {
                if (asteroid.containsPoint(slash.position)) {
                    // Calculate bounce direction (reflect off normal)
                    const dx = slash.position.x - asteroid.position.x;
                    const dy = slash.position.y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        slash.bounce(normalX, normalY);
                        // Push slash out of asteroid
                        const pushDist = asteroid.size + 5 - dist;
                        if (pushDist > 0) {
                            slash.position.x += normalX * pushDist;
                            slash.position.y += normalY * pushDist;
                        }
                    }
                    break;
                }
            }
            // Bounce off map edges
            const mapEdge = this.mapSize / 2;
            if (slash.position.x <= -mapEdge || slash.position.x >= mapEdge) {
                const normalX = slash.position.x <= -mapEdge ? 1 : -1;
                slash.bounce(normalX, 0);
                slash.position.x = Math.max(-mapEdge, Math.min(mapEdge, slash.position.x));
            }
            if (slash.position.y <= -mapEdge || slash.position.y >= mapEdge) {
                const normalY = slash.position.y <= -mapEdge ? 1 : -1;
                slash.bounce(0, normalY);
                slash.position.y = Math.max(-mapEdge, Math.min(mapEdge, slash.position.y));
            }
            // Damage units that haven't been hit yet
            for (const player of this.players) {
                if (player === slash.owner)
                    continue; // Don't damage own units
                for (const unit of player.units) {
                    if (!slash.affectedUnits.has(unit) && slash.isUnitInSlash(unit)) {
                        unit.takeDamage(Constants.DASH_SLASH_DAMAGE);
                        slash.affectedUnits.add(unit);
                        this.damageNumbers.push(new damage_number_1.DamageNumber(unit.position, Constants.DASH_SLASH_DAMAGE, this.gameTime));
                    }
                }
                // Damage structures
                for (const building of player.buildings) {
                    if (!slash.affectedUnits.has(building) && slash.position.distanceTo(building.position) < Constants.DASH_SLASH_RADIUS) {
                        building.takeDamage(Constants.DASH_SLASH_DAMAGE);
                        slash.affectedUnits.add(building);
                        this.damageNumbers.push(new damage_number_1.DamageNumber(building.position, Constants.DASH_SLASH_DAMAGE, this.gameTime));
                    }
                }
            }
        }
        // Remove finished dash slashes and update hero dashing state
        this.dashSlashes = this.dashSlashes.filter(slash => {
            const shouldDespawn = slash.shouldDespawn();
            if (shouldDespawn && slash.heroUnit instanceof game_core_1.Dash) {
                slash.heroUnit.setDashing(false);
            }
            return !shouldDespawn;
        });
        // Update Blink shockwaves
        for (const shockwave of this.blinkShockwaves) {
            shockwave.update(deltaTime);
            // Stun and damage units that haven't been hit yet
            for (const player of this.players) {
                if (player === shockwave.owner)
                    continue; // Don't affect own units
                for (const unit of player.units) {
                    if (!shockwave.affectedUnits.has(unit) && shockwave.isUnitInShockwave(unit)) {
                        unit.takeDamage(Constants.BLINK_SHOCKWAVE_DAMAGE);
                        unit.applyStun(Constants.BLINK_STUN_DURATION);
                        shockwave.affectedUnits.add(unit);
                        this.damageNumbers.push(new damage_number_1.DamageNumber(unit.position, Constants.BLINK_SHOCKWAVE_DAMAGE, this.gameTime));
                    }
                }
            }
        }
        // Remove expired shockwaves
        this.blinkShockwaves = this.blinkShockwaves.filter(shockwave => !shockwave.shouldDespawn());
        // First, clear all frozen flags
        for (const player of this.players) {
            for (const unit of player.units) {
                unit.isFrozen = false;
            }
        }
        // Update Chrono freeze circles
        for (const freezeCircle of this.chronoFreezeCircles) {
            freezeCircle.update(deltaTime);
            // Freeze all units within the circle
            for (const player of this.players) {
                for (const unit of player.units) {
                    if (freezeCircle.isPositionInCircle(unit.position)) {
                        if (!freezeCircle.affectedUnits.has(unit)) {
                            freezeCircle.affectedUnits.add(unit);
                        }
                        // Mark unit as frozen (invulnerable, can't be targeted)
                        unit.isFrozen = true;
                        // Keep units frozen while in circle (using stun to prevent movement/attacking)
                        unit.stunDuration = Math.max(unit.stunDuration, 0.1);
                    }
                }
                // Freeze buildings (prevent them from attacking)
                for (const building of player.buildings) {
                    if (freezeCircle.isPositionInCircle(building.position)) {
                        if (!freezeCircle.affectedBuildings.has(building)) {
                            freezeCircle.affectedBuildings.add(building);
                        }
                        // Buildings are "frozen" by preventing them from attacking
                        // Most buildings have attackCooldown property
                        if (building.attackCooldown !== undefined) {
                            building.attackCooldown = Math.max(building.attackCooldown, 0.1);
                        }
                    }
                }
            }
        }
        // Remove expired freeze circles
        this.chronoFreezeCircles = this.chronoFreezeCircles.filter(circle => !circle.shouldDespawn());
        // Update deployed turrets
        const allUnitsAndStructures = [];
        for (const player of this.players) {
            if (!player.isDefeated()) {
                allUnitsAndStructures.push(...player.units);
                allUnitsAndStructures.push(...player.buildings);
                for (const mirror of player.solarMirrors) {
                    if (mirror.health > 0) {
                        allUnitsAndStructures.push(mirror);
                    }
                }
                if (player.stellarForge) {
                    allUnitsAndStructures.push(player.stellarForge);
                }
            }
        }
        for (const turret of this.deployedTurrets) {
            // Get enemies for this turret
            const enemies = allUnitsAndStructures.filter(e => e.owner !== turret.owner);
            turret.update(deltaTime, enemies);
        }
        this.deployedTurrets = this.deployedTurrets.filter(turret => !turret.isDead());
        // Update damage numbers
        for (const damageNumber of this.damageNumbers) {
            damageNumber.update(deltaTime);
        }
        // Remove expired damage numbers
        this.damageNumbers = this.damageNumbers.filter(dn => !dn.isExpired(this.gameTime));
    }
    /**
     * Update space dust particles with physics and color influences
     */
    updateSpaceDust(deltaTime) {
        this.applyDustRepulsion(deltaTime);
        for (const particle of this.spaceDust) {
            // Update particle position
            particle.update(deltaTime);
            this.resolveDustAsteroidCollision(particle, deltaTime);
            // Check for influence from player bases
            let closestInfluence = null;
            for (let i = 0; i < this.players.length; i++) {
                const player = this.players[i];
                if (player.stellarForge && !player.isDefeated()) {
                    const distance = particle.position.distanceTo(player.stellarForge.position);
                    if (distance < Constants.INFLUENCE_RADIUS) {
                        const color = i === 0 ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                        if (!closestInfluence || distance < closestInfluence.distance) {
                            closestInfluence = { color, distance };
                        }
                    }
                }
            }
            // Update particle color based on influence
            if (closestInfluence) {
                const blendFactor = 1.0 - (closestInfluence.distance / Constants.INFLUENCE_RADIUS);
                particle.updateColor(closestInfluence.color, blendFactor);
            }
            else {
                particle.updateColor(null, 0);
            }
        }
        // Apply forces from warp gates (spiral effect)
        for (const gate of this.warpGates) {
            if (gate.isCharging && gate.chargeTime >= Constants.WARP_GATE_INITIAL_DELAY) {
                for (const particle of this.spaceDust) {
                    const distance = particle.position.distanceTo(gate.position);
                    if (distance < Constants.WARP_GATE_SPIRAL_RADIUS && distance > Constants.WARP_GATE_SPIRAL_MIN_DISTANCE) {
                        // Calculate spiral force
                        const direction = new math_1.Vector2D(gate.position.x - particle.position.x, gate.position.y - particle.position.y).normalize();
                        // Add tangential component for spiral
                        const tangent = new math_1.Vector2D(-direction.y, direction.x);
                        const force = new math_1.Vector2D(direction.x * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.x * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT, direction.y * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.y * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT);
                        particle.applyForce(new math_1.Vector2D(force.x * deltaTime / distance, force.y * deltaTime / distance));
                    }
                }
            }
        }
        // Apply forces from forge crunches (suck in, then wave out)
        for (const player of this.players) {
            if (player.stellarForge && !player.isDefeated()) {
                const crunch = player.stellarForge.getCurrentCrunch();
                if (crunch && crunch.isActive()) {
                    for (const particle of this.spaceDust) {
                        const distance = particle.position.distanceTo(crunch.position);
                        if (crunch.phase === 'suck' && distance < Constants.FORGE_CRUNCH_SUCK_RADIUS) {
                            // Suck phase: pull dust toward forge
                            if (distance > 5) { // Minimum distance to avoid division by zero
                                const direction = new math_1.Vector2D(crunch.position.x - particle.position.x, crunch.position.y - particle.position.y).normalize();
                                // Force decreases with distance
                                const forceMagnitude = Constants.FORGE_CRUNCH_SUCK_FORCE / Math.sqrt(distance);
                                particle.applyForce(new math_1.Vector2D(direction.x * forceMagnitude * deltaTime, direction.y * forceMagnitude * deltaTime));
                            }
                        }
                        else if (crunch.phase === 'wave' && distance < Constants.FORGE_CRUNCH_WAVE_RADIUS) {
                            // Wave phase: push dust away from forge
                            if (distance > 5) { // Minimum distance to avoid division by zero
                                const direction = new math_1.Vector2D(particle.position.x - crunch.position.x, particle.position.y - crunch.position.y).normalize();
                                // Wave effect: stronger push at the wavefront
                                const waveProgress = crunch.getPhaseProgress();
                                const wavePosition = waveProgress * Constants.FORGE_CRUNCH_WAVE_RADIUS;
                                const distanceToWave = Math.abs(distance - wavePosition);
                                const waveSharpness = 50; // How focused the wave is
                                const waveStrength = Math.exp(-distanceToWave / waveSharpness);
                                const forceMagnitude = Constants.FORGE_CRUNCH_WAVE_FORCE * waveStrength;
                                particle.applyForce(new math_1.Vector2D(direction.x * forceMagnitude * deltaTime, direction.y * forceMagnitude * deltaTime));
                            }
                        }
                    }
                }
            }
        }
        // Apply forces from Space Dust Swirler buildings (counter-clockwise orbits)
        for (const player of this.players) {
            for (const building of player.buildings) {
                if (building instanceof buildings_1.SpaceDustSwirler) {
                    building.applyDustSwirl(this.spaceDust, deltaTime);
                }
            }
        }
    }
    resolveDustAsteroidCollision(particle, deltaTime) {
        const collisionPaddingPx = Constants.DUST_ASTEROID_COLLISION_PADDING_PX;
        const restitution = Constants.DUST_ASTEROID_BOUNCE_RESTITUTION;
        const tangentialPushMultiplier = Constants.DUST_ASTEROID_TANGENTIAL_PUSH_MULTIPLIER;
        const rotationCollisionPushMultiplier = Constants.DUST_ASTEROID_ROTATION_COLLISION_PUSH_MULTIPLIER;
        for (let asteroidIndex = 0; asteroidIndex < this.asteroids.length; asteroidIndex++) {
            const asteroid = this.asteroids[asteroidIndex];
            const dx = particle.position.x - asteroid.position.x;
            const dy = particle.position.y - asteroid.position.y;
            const distanceSq = dx * dx + dy * dy;
            const collisionRadius = asteroid.size + collisionPaddingPx;
            const collisionRadiusSq = collisionRadius * collisionRadius;
            if (distanceSq > collisionRadiusSq) {
                continue;
            }
            const distance = Math.sqrt(distanceSq);
            const normalX = distance > 0.0001 ? dx / distance : 1;
            const normalY = distance > 0.0001 ? dy / distance : 0;
            const penetrationDepth = collisionRadius - distance;
            if (penetrationDepth > 0) {
                particle.position.x += normalX * penetrationDepth;
                particle.position.y += normalY * penetrationDepth;
            }
            const normalVelocity = particle.velocity.x * normalX + particle.velocity.y * normalY;
            if (normalVelocity < 0) {
                particle.velocity.x -= (1 + restitution) * normalVelocity * normalX;
                particle.velocity.y -= (1 + restitution) * normalVelocity * normalY;
            }
            const tangentialDirectionX = -normalY;
            const tangentialDirectionY = normalX;
            const tangentialSpeed = asteroid.rotationSpeed * collisionRadius;
            particle.velocity.x += tangentialDirectionX * tangentialSpeed * tangentialPushMultiplier * deltaTime;
            particle.velocity.y += tangentialDirectionY * tangentialSpeed * tangentialPushMultiplier * deltaTime;
            if (penetrationDepth > 0) {
                const collisionPushSpeed = Math.abs(tangentialSpeed) * rotationCollisionPushMultiplier;
                particle.velocity.x += normalX * collisionPushSpeed;
                particle.velocity.y += normalY * collisionPushSpeed;
            }
        }
    }
    applyDustRepulsion(deltaTime) {
        const cellSize = Constants.DUST_REPULSION_CELL_SIZE_PX;
        const repulsionRadiusPx = Constants.DUST_REPULSION_RADIUS_PX;
        const repulsionRadiusSq = repulsionRadiusPx * repulsionRadiusPx;
        const repulsionStrength = Constants.DUST_REPULSION_STRENGTH;
        for (let i = 0; i < this.dustSpatialHashKeys.length; i++) {
            const key = this.dustSpatialHashKeys[i];
            const bucket = this.dustSpatialHash.get(key);
            if (bucket) {
                bucket.length = 0;
            }
        }
        this.dustSpatialHashKeys.length = 0;
        for (let i = 0; i < this.spaceDust.length; i++) {
            const particle = this.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            const key = (cellX << 16) ^ (cellY & 0xffff);
            let bucket = this.dustSpatialHash.get(key);
            if (!bucket) {
                bucket = [];
                this.dustSpatialHash.set(key, bucket);
            }
            if (bucket.length === 0) {
                this.dustSpatialHashKeys.push(key);
            }
            bucket.push(i);
        }
        for (let i = 0; i < this.spaceDust.length; i++) {
            const particle = this.spaceDust[i];
            const cellX = Math.floor(particle.position.x / cellSize);
            const cellY = Math.floor(particle.position.y / cellSize);
            let forceX = 0;
            let forceY = 0;
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const neighborKey = ((cellX + offsetX) << 16) ^ ((cellY + offsetY) & 0xffff);
                    const bucket = this.dustSpatialHash.get(neighborKey);
                    if (!bucket) {
                        continue;
                    }
                    for (let j = 0; j < bucket.length; j++) {
                        const neighborIndex = bucket[j];
                        if (neighborIndex === i) {
                            continue;
                        }
                        const neighbor = this.spaceDust[neighborIndex];
                        const dx = particle.position.x - neighbor.position.x;
                        const dy = particle.position.y - neighbor.position.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > 0 && distSq < repulsionRadiusSq) {
                            const dist = Math.sqrt(distSq);
                            const proximity = 1 - dist / repulsionRadiusPx;
                            const strength = proximity * proximity * repulsionStrength;
                            forceX += (dx / dist) * strength;
                            forceY += (dy / dist) * strength;
                        }
                    }
                }
            }
            if (forceX !== 0 || forceY !== 0) {
                particle.velocity.x += forceX * deltaTime;
                particle.velocity.y += forceY * deltaTime;
            }
        }
    }
    updateAi(deltaTime) {
        for (const player of this.players) {
            if (!player.isAi || player.isDefeated()) {
                continue;
            }
            const enemies = this.getEnemiesForPlayer(player);
            this.updateAiMirrorsForPlayer(player);
            this.updateAiMirrorPurchaseForPlayer(player);
            this.updateAiDefenseForPlayer(player, enemies);
            this.updateAiHeroProductionForPlayer(player);
            this.updateAiStructuresForPlayer(player, enemies);
        }
    }
    updateStarlingMergeGatesForPlayer(player, deltaTime) {
        for (let gateIndex = this.starlingMergeGates.length - 1; gateIndex >= 0; gateIndex--) {
            const gate = this.starlingMergeGates[gateIndex];
            if (gate.owner !== player) {
                continue;
            }
            if (gate.health <= 0) {
                this.releaseStarlingMergeGate(gate, player);
                this.starlingMergeGateExplosions.push(new math_1.Vector2D(gate.position.x, gate.position.y));
                this.starlingMergeGates.splice(gateIndex, 1);
                continue;
            }
            gate.remainingSec = Math.max(0, gate.remainingSec - deltaTime);
            const assignedStarlings = gate.assignedStarlings;
            let writeIndex = 0;
            for (let i = 0; i < assignedStarlings.length; i++) {
                const starling = assignedStarlings[i];
                if (starling.isDead()) {
                    continue;
                }
                starling.clearManualTarget();
                starling.setManualRallyPoint(gate.position);
                if (starling.position.distanceTo(gate.position) <= Constants.STARLING_MERGE_GATE_RADIUS_PX) {
                    starling.health = 0;
                    gate.absorbedCount += 1;
                    continue;
                }
                assignedStarlings[writeIndex] = starling;
                writeIndex += 1;
            }
            assignedStarlings.length = writeIndex;
            if (gate.remainingSec <= 0) {
                if (gate.absorbedCount >= Constants.STARLING_MERGE_COUNT) {
                    this.starlingMergeGateExplosions.push(new math_1.Vector2D(gate.position.x, gate.position.y));
                    player.solarMirrors.push(new solar_mirror_1.SolarMirror(new math_1.Vector2D(gate.position.x, gate.position.y), player));
                }
                else {
                    this.releaseStarlingMergeGate(gate, player);
                    this.starlingMergeGateExplosions.push(new math_1.Vector2D(gate.position.x, gate.position.y));
                }
                this.starlingMergeGates.splice(gateIndex, 1);
            }
        }
    }
    processStarlingSacrificesForPlayer(player) {
        const energyBoost = Constants.STARLING_COST_PER_ENERGY * Constants.STARLING_SACRIFICE_ENERGY_MULTIPLIER;
        if (energyBoost <= 0) {
            return;
        }
        for (const building of player.buildings) {
            if (!(building instanceof buildings_1.SubsidiaryFactory)) {
                continue;
            }
            if (!building.isComplete || !building.currentProduction) {
                continue;
            }
            for (const unit of player.units) {
                if (!(unit instanceof starling_1.Starling) || unit.isDead()) {
                    continue;
                }
                if (unit.getManualTarget() !== building) {
                    continue;
                }
                if (!building.currentProduction) {
                    break;
                }
                const distance = unit.position.distanceTo(building.position);
                if (distance > building.radius + unit.collisionRadiusPx) {
                    continue;
                }
                building.addProductionEnergyBoost(energyBoost);
                unit.health = 0;
            }
        }
    }
    releaseStarlingMergeGate(gate, player) {
        const releaseCount = gate.absorbedCount;
        if (releaseCount > 0) {
            const currentStarlingCount = this.getStarlingCountForPlayer(player);
            const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - currentStarlingCount);
            const starlingSpawnCount = Math.min(releaseCount, availableStarlingSlots);
            const spawnRadius = Constants.STARLING_MERGE_GATE_RADIUS_PX + Constants.STARLING_COLLISION_RADIUS_PX + 4;
            for (let i = 0; i < starlingSpawnCount; i++) {
                const angle = (Math.PI * 2 * i) / starlingSpawnCount;
                const spawnPosition = new math_1.Vector2D(gate.position.x + Math.cos(angle) * spawnRadius, gate.position.y + Math.sin(angle) * spawnRadius);
                const starling = new starling_1.Starling(spawnPosition, player, player.stellarForge?.minionPath ?? []);
                player.units.push(starling);
                player.unitsCreated++;
            }
        }
        for (const starling of gate.assignedStarlings) {
            if (!starling.isDead()) {
                starling.clearManualOrders();
            }
        }
        gate.assignedStarlings.length = 0;
    }
    getEnemiesForPlayer(player) {
        const enemies = [];
        for (const otherPlayer of this.players) {
            // Skip self
            if (otherPlayer === player)
                continue;
            // Skip defeated players
            if (otherPlayer.isDefeated())
                continue;
            // Skip teammates in team games (3+ players)
            if (this.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                continue;
            }
            enemies.push(...otherPlayer.units);
            enemies.push(...otherPlayer.buildings);
            for (const mirror of otherPlayer.solarMirrors) {
                if (mirror.health > 0) {
                    enemies.push(mirror);
                }
            }
            for (const gate of this.starlingMergeGates) {
                if (gate.owner === otherPlayer && gate.health > 0) {
                    enemies.push(gate);
                }
            }
            if (otherPlayer.stellarForge) {
                enemies.push(otherPlayer.stellarForge);
            }
        }
        return enemies;
    }
    getStarlingCountForPlayer(player) {
        let count = 0;
        for (const unit of player.units) {
            if (unit instanceof starling_1.Starling) {
                count += 1;
            }
        }
        return count;
    }
    updateAiMirrorsForPlayer(player) {
        if (this.gameTime < player.aiNextMirrorCommandSec) {
            return;
        }
        player.aiNextMirrorCommandSec = this.gameTime + Constants.AI_MIRROR_COMMAND_INTERVAL_SEC;
        if (!player.stellarForge || player.solarMirrors.length === 0) {
            return;
        }
        const sun = this.getClosestSunToPoint(player.stellarForge.position);
        if (!sun) {
            return;
        }
        // Determine mirror distance based on AI strategy
        let radiusFromSun;
        switch (player.aiStrategy) {
            case Constants.AIStrategy.AGGRESSIVE:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_AGGRESSIVE_DISTANCE_PX;
                break;
            case Constants.AIStrategy.DEFENSIVE:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_DEFENSIVE_DISTANCE_PX;
                break;
            case Constants.AIStrategy.ECONOMIC:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_ECONOMIC_DISTANCE_PX;
                break;
            case Constants.AIStrategy.WAVES:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_WAVES_DISTANCE_PX;
                break;
            default:
                radiusFromSun = sun.radius + Constants.AI_MIRROR_SUN_DISTANCE_PX;
        }
        const mirrorCount = player.solarMirrors.length;
        const baseAngleRad = Math.atan2(player.stellarForge.position.y - sun.position.y, player.stellarForge.position.x - sun.position.x);
        const startAngleRad = baseAngleRad - (Constants.AI_MIRROR_ARC_SPACING_RAD * (mirrorCount - 1)) / 2;
        for (let i = 0; i < mirrorCount; i++) {
            const mirror = player.solarMirrors[i];
            const angleRad = startAngleRad + Constants.AI_MIRROR_ARC_SPACING_RAD * i;
            // Try to find a valid position for the mirror
            const target = this.findValidMirrorPosition(sun, angleRad, radiusFromSun, player.stellarForge);
            if (target) {
                const distance = mirror.position.distanceTo(target);
                if (distance > Constants.AI_MIRROR_REPOSITION_THRESHOLD_PX) {
                    mirror.setTarget(target, this);
                }
            }
        }
        // For hard difficulty, position defensive units near mirrors
        if (player.aiDifficulty === Constants.AIDifficulty.HARD) {
            this.positionGuardsNearMirrors(player);
        }
    }
    /**
     * Find a valid mirror position that avoids asteroids and has line of sight to sun and base
     */
    findValidMirrorPosition(sun, preferredAngle, preferredRadius, stellarForge) {
        const mirrorRadius = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        // Try multiple radius and angle combinations to find a valid position
        // The search pattern varies both closer/farther and left/right from preferred position
        for (let radiusAttempt = 0; radiusAttempt < Constants.AI_MIRROR_PLACEMENT_ATTEMPTS; radiusAttempt++) {
            // Vary radius: starts closer (-60), then moves through preferred (0) to farther (+60)
            // This explores positions both closer to sun and farther from sun
            const radius = preferredRadius + (radiusAttempt * Constants.AI_MIRROR_RADIUS_VARIATION_STEP_PX) - Constants.AI_MIRROR_RADIUS_VARIATION_OFFSET_PX;
            for (let angleAttempt = 0; angleAttempt < Constants.AI_MIRROR_PLACEMENT_ATTEMPTS; angleAttempt++) {
                // Vary angle: starts left (-0.6 rad), then moves through preferred (0) to right (+0.6 rad)
                // This explores positions in an arc around the preferred angle
                const angleDelta = (angleAttempt * Constants.AI_MIRROR_ANGLE_VARIATION_STEP_RAD) - Constants.AI_MIRROR_ANGLE_VARIATION_OFFSET_RAD;
                const angle = preferredAngle + angleDelta;
                const candidate = new math_1.Vector2D(sun.position.x + Math.cos(angle) * radius, sun.position.y + Math.sin(angle) * radius);
                // Check if position is valid (not in asteroid)
                if (this.checkCollision(candidate, mirrorRadius)) {
                    continue;
                }
                // Check if mirror would have line of sight to sun
                if (!this.hasLineOfSight(candidate, sun.position, mirrorRadius)) {
                    continue;
                }
                // Check if mirror would have line of sight to forge
                if (!this.hasLineOfSight(candidate, stellarForge.position, mirrorRadius)) {
                    continue;
                }
                // Found a valid position
                return candidate;
            }
        }
        // No valid position found
        return null;
    }
    /**
     * Check if there's a clear line of sight between two points
     */
    hasLineOfSight(from, to, objectRadius = 0) {
        const direction = new math_1.Vector2D(to.x - from.x, to.y - from.y).normalize();
        const ray = new math_1.LightRay(from, direction);
        const distance = from.distanceTo(to);
        for (const asteroid of this.asteroids) {
            const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
            if (intersectionDist !== null && intersectionDist < distance - objectRadius) {
                return false; // Path is blocked
            }
        }
        return true; // Path is clear
    }
    /**
     * Check if a unit is eligible to be a guard (hero or starling)
     */
    isGuardEligible(unit) {
        return unit.isHero || unit instanceof starling_1.Starling;
    }
    /**
     * Position defensive units near mirrors for hard difficulty AI
     */
    positionGuardsNearMirrors(player) {
        // Only run this occasionally to avoid excessive computation
        // Check every 5 seconds to reassess mirror guard positions
        const guardCheckInterval = 5.0;
        const timeSinceLastDefense = this.gameTime - (player.aiNextDefenseCommandSec - Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC);
        if (timeSinceLastDefense < guardCheckInterval) {
            return;
        }
        // Find unguarded mirrors (mirrors without nearby defensive units)
        for (const mirror of player.solarMirrors) {
            let hasNearbyGuard = false;
            const guardRadius = Constants.AI_MIRROR_GUARD_DISTANCE_PX;
            // Check if there's already a unit or building near this mirror
            for (const unit of player.units) {
                if (this.isGuardEligible(unit)) {
                    const distance = unit.position.distanceTo(mirror.position);
                    if (distance < guardRadius * 2) {
                        hasNearbyGuard = true;
                        break;
                    }
                }
            }
            if (!hasNearbyGuard) {
                for (const building of player.buildings) {
                    const distance = building.position.distanceTo(mirror.position);
                    if (distance < guardRadius * 2) {
                        hasNearbyGuard = true;
                        break;
                    }
                }
            }
            // If mirror is unguarded, set rally points for some units to guard it
            if (!hasNearbyGuard) {
                let guardsAssigned = 0;
                const maxGuards = 2; // Assign up to 2 units per mirror
                for (const unit of player.units) {
                    if (guardsAssigned >= maxGuards)
                        break;
                    // Assign starlings or hero units to guard
                    if (this.isGuardEligible(unit)) {
                        // Check if unit is far from mirror (to avoid reassigning guards constantly)
                        const distance = unit.position.distanceTo(mirror.position);
                        if (distance > guardRadius * 3) {
                            // Set rally point near mirror
                            const guardPos = new math_1.Vector2D(mirror.position.x, mirror.position.y);
                            if (unit.isHero) {
                                unit.rallyPoint = guardPos;
                            }
                            else if (unit instanceof starling_1.Starling) {
                                unit.setManualRallyPoint(guardPos);
                            }
                            guardsAssigned++;
                        }
                    }
                }
            }
        }
    }
    updateAiMirrorPurchaseForPlayer(player) {
        if (this.gameTime < player.aiNextMirrorPurchaseCommandSec) {
            return;
        }
        player.aiNextMirrorPurchaseCommandSec = this.gameTime + Constants.AI_MIRROR_PURCHASE_INTERVAL_SEC;
        if (!player.stellarForge) {
            return;
        }
        if (player.solarMirrors.length >= Constants.AI_MAX_MIRRORS) {
            return;
        }
        const spawnPosition = this.findMirrorSpawnPositionNearForge(player.stellarForge);
        player.stellarForge.enqueueMirror(Constants.STELLAR_FORGE_SOLAR_MIRROR_COST, spawnPosition);
        this.assignAiMirrorsToIncompleteBuilding(player);
    }
    updateAiDefenseForPlayer(player, enemies) {
        if (this.gameTime < player.aiNextDefenseCommandSec) {
            return;
        }
        player.aiNextDefenseCommandSec = this.gameTime + Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC;
        const threat = this.findAiThreat(player, enemies);
        if (threat) {
            const threatPosition = threat.enemy.position;
            for (const unit of player.units) {
                if (unit.isHero) {
                    unit.rallyPoint = new math_1.Vector2D(threatPosition.x, threatPosition.y);
                }
                else if (unit instanceof starling_1.Starling) {
                    unit.setManualRallyPoint(new math_1.Vector2D(threatPosition.x, threatPosition.y));
                }
            }
            return;
        }
        if (!player.stellarForge) {
            return;
        }
        // Strategy-based defense behavior
        if (player.aiStrategy === Constants.AIStrategy.WAVES) {
            // Waves strategy: Accumulate units at base until reaching threshold
            const unitCount = player.units.length;
            const waveThreshold = Constants.AI_WAVES_ATTACK_THRESHOLD;
            if (unitCount >= waveThreshold) {
                // Send all units to attack enemy base
                const enemyForge = this.getEnemyForgeForPlayer(player);
                if (enemyForge) {
                    for (const unit of player.units) {
                        if (unit.isHero || unit instanceof starling_1.Starling) {
                            unit.rallyPoint = new math_1.Vector2D(enemyForge.position.x, enemyForge.position.y);
                            if (unit instanceof starling_1.Starling) {
                                unit.setManualRallyPoint(new math_1.Vector2D(enemyForge.position.x, enemyForge.position.y));
                            }
                        }
                    }
                    return;
                }
            }
            else {
                // Accumulate at base
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
                    }
                    else if (unit instanceof starling_1.Starling) {
                        unit.setManualRallyPoint(new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y));
                    }
                }
                return;
            }
        }
        else if (player.aiStrategy === Constants.AIStrategy.AGGRESSIVE) {
            // Aggressive strategy: Always push to enemy base
            const enemyForge = this.getEnemyForgeForPlayer(player);
            if (enemyForge) {
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new math_1.Vector2D(enemyForge.position.x, enemyForge.position.y);
                    }
                    else if (unit instanceof starling_1.Starling) {
                        unit.setManualRallyPoint(new math_1.Vector2D(enemyForge.position.x, enemyForge.position.y));
                    }
                }
                return;
            }
        }
        // Default behavior (for ECONOMIC and DEFENSIVE): Defend mirrors and base
        const mirrorCount = player.solarMirrors.length;
        let mirrorIndex = 0;
        for (const unit of player.units) {
            if (unit.isHero) {
                unit.rallyPoint = new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
            }
            else if (unit instanceof starling_1.Starling) {
                if (mirrorIndex < mirrorCount) {
                    const mirror = player.solarMirrors[mirrorIndex];
                    unit.setManualRallyPoint(new math_1.Vector2D(mirror.position.x, mirror.position.y));
                    mirrorIndex += 1;
                }
                else {
                    unit.setManualRallyPoint(new math_1.Vector2D(player.stellarForge.position.x, player.stellarForge.position.y));
                }
            }
        }
    }
    getEnemyForgeForPlayer(player) {
        for (const otherPlayer of this.players) {
            // Skip self and defeated players
            if (otherPlayer === player || otherPlayer.isDefeated())
                continue;
            // Skip teammates in team games (3+ players)
            if (this.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                continue;
            }
            if (otherPlayer.stellarForge) {
                return otherPlayer.stellarForge;
            }
        }
        return null;
    }
    updateAiHeroProductionForPlayer(player) {
        if (this.gameTime < player.aiNextHeroCommandSec) {
            return;
        }
        // Strategy-based hero production intervals
        let heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC;
        switch (player.aiStrategy) {
            case Constants.AIStrategy.AGGRESSIVE:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_AGGRESSIVE_HERO_MULTIPLIER;
                break;
            case Constants.AIStrategy.ECONOMIC:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_ECONOMIC_HERO_MULTIPLIER;
                break;
            case Constants.AIStrategy.WAVES:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC * Constants.AI_WAVES_HERO_MULTIPLIER;
                break;
            default:
                heroProductionInterval = Constants.AI_HERO_COMMAND_INTERVAL_SEC;
        }
        player.aiNextHeroCommandSec = this.gameTime + heroProductionInterval;
        if (!player.stellarForge || !player.stellarForge.canProduceUnits()) {
            return;
        }
        const heroTypes = this.getAiHeroTypesForFaction(player.faction);
        for (const heroType of heroTypes) {
            if (this.isHeroUnitAlive(player, heroType)) {
                continue;
            }
            if (this.isHeroUnitQueuedOrProducing(player.stellarForge, heroType)) {
                continue;
            }
            player.stellarForge.enqueueHeroUnit(heroType, this.getHeroUnitCost(player));
            return;
        }
    }
    getHeroUnitCost(player) {
        const aliveHeroCount = player.units.filter((unit) => unit.isHero).length;
        return Constants.HERO_UNIT_BASE_COST + aliveHeroCount * Constants.HERO_UNIT_COST_INCREMENT;
    }
    assignAiMirrorsToIncompleteBuilding(player) {
        const incompleteBuilding = player.buildings.find((building) => !building.isComplete && !building.isDestroyed());
        if (!incompleteBuilding) {
            return;
        }
        for (const mirror of player.solarMirrors) {
            if (mirror.linkedStructure !== null && mirror.linkedStructure !== player.stellarForge) {
                continue;
            }
            mirror.setLinkedStructure(incompleteBuilding);
        }
    }
    findMirrorSpawnPositionNearForge(stellarForge) {
        const baseRadiusPx = stellarForge.radius + Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorRadiusPx = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        const angleStepRad = Math.PI / 6;
        for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
            const ringRadiusPx = baseRadiusPx + ringIndex * (mirrorRadiusPx + 12);
            for (let angleIndex = 0; angleIndex < 12; angleIndex++) {
                const angleRad = angleStepRad * angleIndex;
                const candidate = new math_1.Vector2D(stellarForge.position.x + Math.cos(angleRad) * ringRadiusPx, stellarForge.position.y + Math.sin(angleRad) * ringRadiusPx);
                if (!this.checkCollision(candidate, mirrorRadiusPx)) {
                    return candidate;
                }
            }
        }
        return new math_1.Vector2D(stellarForge.position.x, stellarForge.position.y);
    }
    updateAiStructuresForPlayer(player, enemies) {
        if (this.gameTime < player.aiNextStructureCommandSec) {
            return;
        }
        player.aiNextStructureCommandSec = this.gameTime + Constants.AI_STRUCTURE_COMMAND_INTERVAL_SEC;
        if (!player.stellarForge) {
            return;
        }
        const minigunCount = player.buildings.filter((building) => building instanceof buildings_1.Minigun).length;
        const swirlerCount = player.buildings.filter((building) => building instanceof buildings_1.SpaceDustSwirler).length;
        const hasSubsidiaryFactory = player.buildings.some((building) => building instanceof buildings_1.SubsidiaryFactory);
        let buildType = null;
        // Strategy-based building priorities
        // Note: Radiant-specific buildings (minigun, swirler) are only available to Radiant faction
        const canBuildRadiantStructures = player.faction === player_2.Faction.RADIANT;
        switch (player.aiStrategy) {
            case Constants.AIStrategy.ECONOMIC:
                // Economic: Build factory first, then minimal defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                }
                else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                break;
            case Constants.AIStrategy.DEFENSIVE:
                // Defensive: Prioritize defenses heavily
                if (canBuildRadiantStructures && swirlerCount < 2 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                else if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                }
                else if (canBuildRadiantStructures && minigunCount < 5 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
            case Constants.AIStrategy.AGGRESSIVE:
                // Aggressive: Build factory early, skip most defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                }
                else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
            case Constants.AIStrategy.WAVES:
                // Waves: Balanced approach with factory priority
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                }
                else if (canBuildRadiantStructures && minigunCount < 2 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
        }
        if (!buildType) {
            return;
        }
        const threat = this.findAiThreat(player, enemies);
        const anchor = threat?.guardPoint ?? this.getAiStructureAnchor(player);
        if (!anchor) {
            return;
        }
        let placement = null;
        let didBuildStructure = false;
        switch (buildType) {
            case 'subsidiaryFactory':
                placement = this.findAiStructurePlacement(anchor, Constants.SUBSIDIARY_FACTORY_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                    player.buildings.push(new buildings_1.SubsidiaryFactory(placement, player));
                    didBuildStructure = true;
                }
                break;
            case 'swirler':
                placement = this.findAiStructurePlacement(anchor, Constants.SWIRLER_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SWIRLER_COST)) {
                    player.buildings.push(new buildings_1.SpaceDustSwirler(placement, player));
                    didBuildStructure = true;
                }
                break;
            case 'minigun':
                placement = this.findAiStructurePlacement(anchor, Constants.MINIGUN_RADIUS, player);
                if (placement && player.spendEnergy(Constants.MINIGUN_COST)) {
                    player.buildings.push(new buildings_1.Minigun(placement, player));
                    didBuildStructure = true;
                }
                break;
        }
        if (didBuildStructure) {
            this.assignAiMirrorsToIncompleteBuilding(player);
        }
    }
    getAiStructureAnchor(player) {
        if (!player.stellarForge) {
            return null;
        }
        if (player.solarMirrors.length === 0 || this.suns.length === 0) {
            return player.stellarForge.position;
        }
        let bestMirror = null;
        let bestDistance = Infinity;
        for (const mirror of player.solarMirrors) {
            const closestSun = mirror.getClosestSun(this.suns);
            if (!closestSun) {
                continue;
            }
            const distance = mirror.position.distanceTo(closestSun.position);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMirror = mirror;
            }
        }
        return bestMirror ? bestMirror.position : player.stellarForge.position;
    }
    findAiStructurePlacement(anchor, radiusPx, player) {
        const baseAngleRad = player.buildings.length * Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD;
        const distancePx = Constants.AI_STRUCTURE_PLACEMENT_DISTANCE_PX + radiusPx;
        for (let i = 0; i < 8; i++) {
            const angleRad = baseAngleRad + Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD * i;
            const candidate = new math_1.Vector2D(anchor.x + Math.cos(angleRad) * distancePx, anchor.y + Math.sin(angleRad) * distancePx);
            if (!this.checkCollision(candidate, radiusPx)) {
                return candidate;
            }
        }
        return null;
    }
    findAiThreat(player, enemies) {
        if (!player.stellarForge) {
            return null;
        }
        const guardPoints = [player.stellarForge.position];
        for (const mirror of player.solarMirrors) {
            guardPoints.push(mirror.position);
        }
        let closestThreat = null;
        let closestGuardPoint = null;
        let closestDistanceSq = Infinity;
        const defenseRadiusSq = Constants.AI_DEFENSE_RADIUS_PX * Constants.AI_DEFENSE_RADIUS_PX;
        for (const guardPoint of guardPoints) {
            for (const enemy of enemies) {
                if ('health' in enemy && enemy.health <= 0) {
                    continue;
                }
                const dx = enemy.position.x - guardPoint.x;
                const dy = enemy.position.y - guardPoint.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq <= defenseRadiusSq && distanceSq < closestDistanceSq) {
                    closestDistanceSq = distanceSq;
                    closestThreat = enemy;
                    closestGuardPoint = guardPoint;
                }
            }
        }
        if (!closestThreat || !closestGuardPoint) {
            return null;
        }
        return { enemy: closestThreat, guardPoint: closestGuardPoint };
    }
    getClosestSunToPoint(point) {
        let closestSun = null;
        let closestDistance = Infinity;
        for (const sun of this.suns) {
            const distance = point.distanceTo(sun.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSun = sun;
            }
        }
        return closestSun;
    }
    getAiHeroTypesForFaction(faction) {
        switch (faction) {
            case player_2.Faction.RADIANT:
                return ['Marine', 'Mothership', 'Dagger', 'Beam', 'Mortar', 'Preist', 'Tank', 'Spotlight', 'Radiant'];
            case player_2.Faction.AURUM:
                return ['Driller', 'AurumHero', 'Dash', 'Blink'];
            case player_2.Faction.VELARIS:
                return ['Grave', 'Ray', 'InfluenceBall', 'TurretDeployer', 'VelarisHero', 'Shadow', 'Chrono'];
            default:
                return [];
        }
    }
    isHeroUnitOfType(unit, heroUnitType) {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof game_core_1.Marine;
            case 'Mothership':
                return unit instanceof game_core_1.Mothership;
            case 'Grave':
                return unit instanceof game_core_1.Grave;
            case 'Ray':
                return unit instanceof game_core_1.Ray;
            case 'InfluenceBall':
                return unit instanceof game_core_1.InfluenceBall;
            case 'TurretDeployer':
                return unit instanceof game_core_1.TurretDeployer;
            case 'Driller':
                return unit instanceof game_core_1.Driller;
            case 'Dagger':
                return unit instanceof game_core_1.Dagger;
            case 'Beam':
                return unit instanceof game_core_1.Beam;
            case 'Mortar':
                return unit instanceof game_core_1.Mortar;
            case 'Preist':
                return unit instanceof game_core_1.Preist;
            case 'Tank':
                return unit instanceof game_core_1.Tank;
            case 'Spotlight':
                return unit instanceof game_core_1.Spotlight;
            case 'Nova':
                return unit instanceof game_core_1.Nova;
            case 'Sly':
                return unit instanceof game_core_1.Sly;
            case 'Radiant':
                return unit instanceof game_core_1.Radiant;
            case 'VelarisHero':
                return unit instanceof game_core_1.VelarisHero;
            case 'Chrono':
                return unit instanceof game_core_1.Chrono;
            case 'AurumHero':
                return unit instanceof game_core_1.AurumHero;
            case 'Dash':
                return unit instanceof game_core_1.Dash;
            case 'Blink':
                return unit instanceof game_core_1.Blink;
            case 'Shadow':
                return unit instanceof game_core_1.Shadow;
            default:
                return false;
        }
    }
    isHeroUnitAlive(player, heroUnitType) {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }
    isHeroUnitQueuedOrProducing(forge, heroUnitType) {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }
    applyDustPushFromMovingEntity(position, velocity, radiusPx, forceMultiplier, impactColor, deltaTime) {
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (speed <= 0) {
            return;
        }
        const effectiveSpeed = Math.max(speed, Constants.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC);
        this.applyFluidForceFromMovingObject(position, velocity, radiusPx, effectiveSpeed * forceMultiplier, impactColor, deltaTime);
    }
    /**
     * Apply fluid-like forces to particles from a moving object (projectile)
     * Particles closer to the object get pushed more, with falloff based on distance
     *
     * @param position - World position of the moving object (pixels)
     * @param velocity - Velocity vector of the moving object (pixels/second)
     * @param radius - Effect radius in pixels (particles beyond this distance are not affected)
     * @param strength - Base force strength (higher values create stronger displacement)
     * @param deltaTime - Time delta in seconds for frame-independent physics
     */
    applyFluidForceFromMovingObject(position, velocity, radius, strength, impactColor, deltaTime) {
        for (const particle of this.spaceDust) {
            const distance = particle.position.distanceTo(position);
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Calculate direction from object to particle
                const directionToParticle = new math_1.Vector2D(particle.position.x - position.x, particle.position.y - position.y).normalize();
                // Combine forward motion with radial push
                const velocityNorm = velocity.normalize();
                // Mix of forward push and radial displacement (like fluid being displaced)
                const forwardComponent = Constants.FLUID_FORWARD_COMPONENT;
                const radialComponent = Constants.FLUID_RADIAL_COMPONENT;
                const pushDirection = new math_1.Vector2D(velocityNorm.x * forwardComponent + directionToParticle.x * radialComponent, velocityNorm.y * forwardComponent + directionToParticle.y * radialComponent);
                // Force falls off with distance (inverse square for more realistic fluid behavior)
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;
                if (impactColor) {
                    const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                    if (impactStrength > 0) {
                        particle.applyImpactColor(impactColor, impactStrength);
                    }
                }
                particle.applyForce(new math_1.Vector2D(pushDirection.x * forceMagnitude * deltaTime, pushDirection.y * forceMagnitude * deltaTime));
            }
        }
    }
    /**
     * Apply fluid-like forces to particles from a beam segment
     * Creates a line-based displacement field along the beam
     *
     * @param startPos - Starting position of the beam segment (pixels)
     * @param endPos - Ending position of the beam segment (pixels)
     * @param radius - Effect radius around the beam line in pixels
     * @param strength - Base force strength (higher values create stronger displacement)
     * @param deltaTime - Time delta in seconds for frame-independent physics
     */
    applyFluidForceFromBeam(startPos, endPos, radius, strength, impactColor, deltaTime) {
        // Calculate beam direction
        const beamLength = startPos.distanceTo(endPos);
        if (beamLength < Constants.FLUID_MIN_DISTANCE)
            return;
        const beamDirection = new math_1.Vector2D(endPos.x - startPos.x, endPos.y - startPos.y).normalize();
        for (const particle of this.spaceDust) {
            // Find closest point on line segment to particle
            const toParticle = new math_1.Vector2D(particle.position.x - startPos.x, particle.position.y - startPos.y);
            // Project particle position onto beam line
            const projection = toParticle.x * beamDirection.x + toParticle.y * beamDirection.y;
            const clampedProjection = Math.max(0, Math.min(beamLength, projection));
            // Closest point on beam to particle
            const closestPoint = new math_1.Vector2D(startPos.x + beamDirection.x * clampedProjection, startPos.y + beamDirection.y * clampedProjection);
            const distance = particle.position.distanceTo(closestPoint);
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Direction from beam to particle (perpendicular push)
                const directionToParticle = new math_1.Vector2D(particle.position.x - closestPoint.x, particle.position.y - closestPoint.y).normalize();
                // Combine beam direction with radial push
                // Particles along beam get pushed forward and outward
                const alongBeamComponent = Constants.BEAM_ALONG_COMPONENT;
                const perpendicularComponent = Constants.BEAM_PERPENDICULAR_COMPONENT;
                const pushDirection = new math_1.Vector2D(beamDirection.x * alongBeamComponent + directionToParticle.x * perpendicularComponent, beamDirection.y * alongBeamComponent + directionToParticle.y * perpendicularComponent);
                // Force falls off with distance from beam
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;
                if (impactColor) {
                    const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                    if (impactStrength > 0) {
                        particle.applyImpactColor(impactColor, impactStrength);
                    }
                }
                particle.applyForce(new math_1.Vector2D(pushDirection.x * forceMagnitude * deltaTime, pushDirection.y * forceMagnitude * deltaTime));
            }
        }
    }
    getPlayerImpactColor(player) {
        const playerIndex = this.players.indexOf(player);
        if (playerIndex === 0) {
            return Constants.PLAYER_1_COLOR;
        }
        if (playerIndex === 1) {
            return Constants.PLAYER_2_COLOR;
        }
        return Constants.PLAYER_1_COLOR;
    }
    /**
     * Initialize mirror movement at the start of countdown
     * Moves mirrors outward perpendicular to base position
     */
    initializeMirrorMovement() {
        if (this.suns.length === 0)
            return;
        const sun = this.suns[0]; // Use first sun as reference
        for (const player of this.players) {
            if (!player.stellarForge || player.solarMirrors.length < 2)
                continue;
            const forgePos = player.stellarForge.position;
            // Calculate angle from sun to forge
            const dx = forgePos.x - sun.position.x;
            const dy = forgePos.y - sun.position.y;
            const angleToForge = Math.atan2(dy, dx);
            // Calculate perpendicular angles (left and right relative to sun-to-forge direction)
            const leftAngle = angleToForge + Math.PI / 2;
            const rightAngle = angleToForge - Math.PI / 2;
            // Try to find valid positions for mirrors, avoiding asteroids
            if (player.solarMirrors.length >= 1) {
                // Try to place left mirror perpendicular to sun-forge line
                let leftTarget = new math_1.Vector2D(forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE, forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE);
                // If target is blocked, try to find alternative position
                if (this.checkCollision(leftTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new math_1.Vector2D(forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult, forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult);
                        if (!this.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            leftTarget = altTarget;
                            break;
                        }
                    }
                }
                player.solarMirrors[0].setTarget(leftTarget, this);
            }
            if (player.solarMirrors.length >= 2) {
                // Try to place right mirror perpendicular to sun-forge line
                let rightTarget = new math_1.Vector2D(forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE, forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE);
                // If target is blocked, try to find alternative position
                if (this.checkCollision(rightTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new math_1.Vector2D(forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult, forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult);
                        if (!this.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            rightTarget = altTarget;
                            break;
                        }
                    }
                }
                player.solarMirrors[1].setTarget(rightTarget, this);
            }
        }
    }
    /**
     * Check if a point is in shadow cast by asteroids from all suns
     * Returns true if the point is in shadow from all light sources
     */
    isPointInShadow(point) {
        // If no suns, everything is in shadow
        if (this.suns.length === 0)
            return true;
        // Point must have line of sight to at least one sun to not be in shadow
        for (const sun of this.suns) {
            const direction = new math_1.Vector2D(sun.position.x - point.x, sun.position.y - point.y).normalize();
            const ray = new math_1.LightRay(point, direction);
            const distanceToSun = point.distanceTo(sun.position);
            let hasLineOfSight = true;
            for (const asteroid of this.asteroids) {
                const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
                if (intersectionDist !== null && intersectionDist < distanceToSun) {
                    hasLineOfSight = false;
                    break;
                }
            }
            if (hasLineOfSight) {
                return false; // Can see at least one sun, not in shadow
            }
        }
        return true; // Cannot see any sun, in shadow
    }
    /**
     * Check if an enemy object is visible to a player
     * Objects are visible if:
     * - They are NOT in shadow (in light), OR
     * - They are in shadow but within proximity range of player unit, OR
     * - They are in shadow but within player's influence radius
     */
    isObjectVisibleToPlayer(objectPos, player, object) {
        // Special LaD (Light and Dark) visibility logic
        const ladSun = this.suns.find(s => s.type === 'lad');
        if (ladSun) {
            return this.isObjectVisibleInLadMode(objectPos, player, object, ladSun);
        }
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof game_core_1.Dagger) {
            // Dagger is only visible to enemies if not cloaked
            if (object.isCloakedToEnemies() && object.owner !== player) {
                return false; // Cloaked Daggers are invisible to enemies
            }
        }
        // Check if object is in shadow
        const inShadow = this.isPointInShadow(objectPos);
        // If not in shadow, always visible
        if (!inShadow) {
            return true;
        }
        // In shadow - check proximity to player units (using their line of sight)
        for (const unit of player.units) {
            const distance = unit.position.distanceTo(objectPos);
            const visibilityRange = unit.lineOfSight || Constants.VISIBILITY_PROXIMITY_RANGE;
            if (distance <= visibilityRange) {
                return true;
            }
        }
        // In shadow - check if within player's influence
        if (player.stellarForge) {
            const distanceToForge = player.stellarForge.position.distanceTo(objectPos);
            if (distanceToForge <= Constants.INFLUENCE_RADIUS) {
                return true;
            }
        }
        if (this.isObjectRevealedBySpotlight(objectPos, player)) {
            return true;
        }
        return false; // Not visible: in shadow and not within proximity or influence range
    }
    /**
     * Helper method to determine which side of LaD sun a position is on
     * Public so it can be used by the renderer
     */
    getLadSide(position, ladSun) {
        return position.x < ladSun.position.x ? 'light' : 'dark';
    }
    /**
     * Check visibility in LaD (Light and Dark) mode
     * Units are invisible to the enemy until they cross into enemy territory
     */
    isObjectVisibleInLadMode(objectPos, player, object, ladSun) {
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof game_core_1.Dagger) {
            if (object.isCloakedToEnemies() && object.owner !== player) {
                return false;
            }
        }
        // Determine which side each player is on based on their forge position
        // Default to 'light' if forge is not yet initialized (early game state)
        const playerSide = player.stellarForge
            ? this.getLadSide(player.stellarForge.position, ladSun)
            : 'light';
        // Determine which side the object is on
        const objectSide = this.getLadSide(objectPos, ladSun);
        // If object has an owner
        if (object && 'owner' in object && object.owner) {
            const objectOwner = object.owner;
            // Own units are always visible
            if (objectOwner === player) {
                return true;
            }
            // Enemy units are only visible if they're on the player's side
            if (objectSide === playerSide) {
                return true;
            }
            return this.isObjectRevealedBySpotlight(objectPos, player);
        }
        // Non-owned objects (buildings, etc.) use default visibility
        return true;
    }
    /**
     * Process Ray's bouncing beam ability
     */
    processRayBeamAbility(ray) {
        if (!ray.drillDirection) {
            return;
        }
        const segments = [];
        let currentPos = new math_1.Vector2D(ray.position.x, ray.position.y);
        let currentDir = ray.drillDirection.normalize();
        let bounces = 0;
        const maxDistance = 2000; // Max beam travel distance
        while (bounces < Constants.RAY_BEAM_MAX_BOUNCES) {
            // Cast ray to find next hit
            let closestHit = null;
            let closestDistance = maxDistance;
            // Check asteroids
            for (const asteroid of this.asteroids) {
                const hitPos = this.rayIntersectsAsteroid(currentPos, currentDir, asteroid);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'asteroid' };
                    }
                }
            }
            // Check enemy units
            for (const player of this.players) {
                if (player === ray.owner)
                    continue;
                for (const unit of player.units) {
                    const hitPos = this.rayIntersectsUnit(currentPos, currentDir, unit.position);
                    if (hitPos) {
                        const distance = currentPos.distanceTo(hitPos);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestHit = { pos: hitPos, type: 'unit', target: unit };
                        }
                    }
                }
                // Check enemy forge
                if (player.stellarForge) {
                    const hitPos = this.rayIntersectsUnit(currentPos, currentDir, player.stellarForge.position, player.stellarForge.radius);
                    if (hitPos) {
                        const distance = currentPos.distanceTo(hitPos);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestHit = { pos: hitPos, type: 'forge', target: player.stellarForge };
                        }
                    }
                }
            }
            // Check suns
            for (const sun of this.suns) {
                const hitPos = this.rayIntersectsUnit(currentPos, currentDir, sun.position, sun.radius);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'sun' };
                    }
                }
            }
            // Check map edges
            const edgeHit = this.rayIntersectsEdge(currentPos, currentDir);
            if (edgeHit && currentPos.distanceTo(edgeHit) < closestDistance) {
                closestDistance = currentPos.distanceTo(edgeHit);
                closestHit = { pos: edgeHit, type: 'edge' };
            }
            if (!closestHit) {
                // No hit, beam continues to max distance
                const endPos = new math_1.Vector2D(currentPos.x + currentDir.x * maxDistance, currentPos.y + currentDir.y * maxDistance);
                segments.push(new game_core_1.RayBeamSegment(currentPos, endPos, ray.owner));
                break;
            }
            // Add segment to hit point
            segments.push(new game_core_1.RayBeamSegment(currentPos, closestHit.pos, ray.owner));
            // Handle hit
            if (closestHit.type === 'unit' || closestHit.type === 'forge') {
                // Damage and stop
                if (closestHit.target) {
                    closestHit.target.takeDamage(Constants.RAY_BEAM_DAMAGE);
                    // Create damage number
                    const maxHealth = closestHit.type === 'forge'
                        ? Constants.STELLAR_FORGE_MAX_HEALTH
                        : closestHit.target.maxHealth;
                    const targetKey = closestHit.type === 'forge'
                        ? `forge_${closestHit.target.position.x}_${closestHit.target.position.y}_${closestHit.target.owner.name}`
                        : `unit_${closestHit.target.position.x}_${closestHit.target.position.y}_${closestHit.target.owner.name}`;
                    this.addDamageNumber(closestHit.target.position, Constants.RAY_BEAM_DAMAGE, maxHealth, closestHit.target.health, targetKey);
                }
                break;
            }
            else if (closestHit.type === 'sun' || closestHit.type === 'edge') {
                // Stop at sun or edge
                break;
            }
            else if (closestHit.type === 'asteroid') {
                // Bounce off asteroid
                bounces++;
                currentPos = closestHit.pos;
                // Calculate reflection direction (simplified)
                currentDir = new math_1.Vector2D(-currentDir.x, -currentDir.y); // Simple bounce for now
            }
        }
        ray.setBeamSegments(segments);
    }
    updateSpotlightAbility(spotlight, enemies, deltaTime) {
        spotlight.updateSpotlightState(deltaTime);
        if (!spotlight.isSpotlightActive() || !spotlight.spotlightDirection) {
            spotlight.setSpotlightRangePx(0);
            return;
        }
        const maxRangePx = this.getSpotlightMaxRangePx(spotlight);
        spotlight.setSpotlightRangePx(maxRangePx);
        const effectiveRangePx = maxRangePx * spotlight.spotlightLengthFactor;
        if (!spotlight.canFireSpotlight() || effectiveRangePx <= 0) {
            return;
        }
        const targets = this.getSpotlightTargetsInCone(spotlight, enemies, effectiveRangePx);
        if (targets.length > 0) {
            const bullets = spotlight.fireSpotlightAtTargets(targets, effectiveRangePx);
            if (bullets.length > 0) {
                this.abilityBullets.push(...bullets);
            }
        }
    }
    getSpotlightMaxRangePx(spotlight) {
        const direction = spotlight.spotlightDirection;
        if (!direction) {
            return 0;
        }
        let closestDistance = Infinity;
        const edgeHit = this.rayIntersectsEdge(spotlight.position, direction);
        if (edgeHit) {
            closestDistance = spotlight.position.distanceTo(edgeHit);
        }
        for (const asteroid of this.asteroids) {
            const hitPos = this.rayIntersectsAsteroid(spotlight.position, direction, asteroid);
            if (hitPos) {
                const distance = spotlight.position.distanceTo(hitPos);
                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }
        }
        if (!Number.isFinite(closestDistance)) {
            return 0;
        }
        return closestDistance;
    }
    getSpotlightTargetsInCone(spotlight, enemies, rangePx) {
        const targets = [];
        const direction = spotlight.spotlightDirection;
        if (!direction) {
            return targets;
        }
        const facingAngle = Math.atan2(direction.y, direction.x);
        const halfConeAngle = Constants.SPOTLIGHT_CONE_ANGLE_RAD / 2;
        const rangeSq = rangePx * rangePx;
        for (const enemy of enemies) {
            const dx = enemy.position.x - spotlight.position.x;
            const dy = enemy.position.y - spotlight.position.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > rangeSq) {
                continue;
            }
            const angleToEnemy = Math.atan2(dy, dx);
            let angleDiff = angleToEnemy - facingAngle;
            while (angleDiff > Math.PI)
                angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI)
                angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) <= halfConeAngle) {
                targets.push(enemy);
            }
        }
        return targets;
    }
    isPositionInSpotlightCone(spotlight, position, rangePx) {
        const direction = spotlight.spotlightDirection;
        if (!direction) {
            return false;
        }
        const dx = position.x - spotlight.position.x;
        const dy = position.y - spotlight.position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > rangePx * rangePx) {
            return false;
        }
        const facingAngle = Math.atan2(direction.y, direction.x);
        const angleToTarget = Math.atan2(dy, dx);
        let angleDiff = angleToTarget - facingAngle;
        while (angleDiff > Math.PI)
            angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI)
            angleDiff += 2 * Math.PI;
        return Math.abs(angleDiff) <= Constants.SPOTLIGHT_CONE_ANGLE_RAD / 2;
    }
    isObjectRevealedBySpotlight(objectPos, player) {
        for (const unit of player.units) {
            if (!(unit instanceof game_core_1.Spotlight)) {
                continue;
            }
            if (!unit.isSpotlightActive() || !unit.spotlightDirection) {
                continue;
            }
            const effectiveRangePx = unit.spotlightRangePx * unit.spotlightLengthFactor;
            if (effectiveRangePx <= 0) {
                continue;
            }
            if (this.isPositionInSpotlightCone(unit, objectPos, effectiveRangePx)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if ray intersects with an asteroid
     */
    rayIntersectsAsteroid(origin, direction, asteroid) {
        // Simplified ray-polygon intersection
        // For now, treat asteroid as circle
        const toAsteroid = new math_1.Vector2D(asteroid.position.x - origin.x, asteroid.position.y - origin.y);
        const projection = toAsteroid.x * direction.x + toAsteroid.y * direction.y;
        if (projection < 0)
            return null; // Behind ray
        const closestPoint = new math_1.Vector2D(origin.x + direction.x * projection, origin.y + direction.y * projection);
        const distance = closestPoint.distanceTo(asteroid.position);
        if (distance < 60) { // Approximate asteroid radius
            return closestPoint;
        }
        return null;
    }
    /**
     * Check if ray intersects with a circular unit
     */
    rayIntersectsUnit(origin, direction, targetPos, radius = 8) {
        const toTarget = new math_1.Vector2D(targetPos.x - origin.x, targetPos.y - origin.y);
        const projection = toTarget.x * direction.x + toTarget.y * direction.y;
        if (projection < 0)
            return null; // Behind ray
        const closestPoint = new math_1.Vector2D(origin.x + direction.x * projection, origin.y + direction.y * projection);
        const distance = closestPoint.distanceTo(targetPos);
        if (distance < radius) {
            return closestPoint;
        }
        return null;
    }
    /**
     * Check if ray intersects with map edge
     */
    rayIntersectsEdge(origin, direction) {
        const mapSize = this.mapSize;
        let closestHit = null;
        let closestDist = Infinity;
        // Check all four edges
        const edges = [
            { x: 0, normal: new math_1.Vector2D(1, 0) },
            { x: mapSize, normal: new math_1.Vector2D(-1, 0) },
            { y: 0, normal: new math_1.Vector2D(0, 1) },
            { y: mapSize, normal: new math_1.Vector2D(0, -1) }
        ];
        for (const edge of edges) {
            let hitPos = null;
            if ('x' in edge && edge.x !== undefined) {
                if (Math.abs(direction.x) > 0.001) {
                    const t = (edge.x - origin.x) / direction.x;
                    if (t > 0) {
                        hitPos = new math_1.Vector2D(edge.x, origin.y + direction.y * t);
                    }
                }
            }
            else if ('y' in edge && edge.y !== undefined) {
                if (Math.abs(direction.y) > 0.001) {
                    const t = (edge.y - origin.y) / direction.y;
                    if (t > 0) {
                        hitPos = new math_1.Vector2D(origin.x + direction.x * t, edge.y);
                    }
                }
            }
            if (hitPos) {
                const dist = origin.distanceTo(hitPos);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = hitPos;
                }
            }
        }
        return closestHit;
    }
    /**
     * Process turret deployment for TurretDeployer
     */
    processTurretDeployment(deployer) {
        // Find nearest asteroid
        let nearestAsteroid = null;
        let minDistance = Infinity;
        for (const asteroid of this.asteroids) {
            const distance = deployer.position.distanceTo(asteroid.position);
            if (distance < minDistance && distance < 200) { // Within 200 pixels
                minDistance = distance;
                nearestAsteroid = asteroid;
            }
        }
        if (nearestAsteroid) {
            // Deploy turret at asteroid position
            const turret = new game_core_1.DeployedTurret(new math_1.Vector2D(nearestAsteroid.position.x, nearestAsteroid.position.y), deployer.owner, nearestAsteroid);
            this.deployedTurrets.push(turret);
        }
    }
    /**
     * Process Driller collisions
     */
    processDrillerCollisions(driller, deltaTime) {
        // Check collision with suns (dies)
        for (const sun of this.suns) {
            const distance = driller.position.distanceTo(sun.position);
            if (distance < sun.radius + 10) {
                driller.health = 0; // Dies
                driller.stopDrilling();
                return;
            }
        }
        // Check collision with asteroids (burrows)
        for (const asteroid of this.asteroids) {
            if (asteroid.containsPoint(driller.position)) {
                driller.hideInAsteroid(asteroid);
                driller.stopDrilling();
                return;
            }
        }
        // Check collision with enemy units
        for (const player of this.players) {
            if (player === driller.owner)
                continue;
            for (const unit of player.units) {
                const distance = driller.position.distanceTo(unit.position);
                if (distance < 15) {
                    unit.takeDamage(Constants.DRILLER_DRILL_DAMAGE);
                    // Create damage number
                    const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                    this.addDamageNumber(unit.position, Constants.DRILLER_DRILL_DAMAGE, unit.maxHealth, unit.health, unitKey);
                }
            }
            // Check collision with buildings (double damage, pass through)
            for (const building of player.buildings) {
                const distance = driller.position.distanceTo(building.position);
                if (distance < 40) {
                    const damage = Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    building.takeDamage(damage);
                    // Create damage number
                    const buildingKey = `building_${building.position.x}_${building.position.y}_${player.name}`;
                    this.addDamageNumber(building.position, damage, building.maxHealth, building.health, buildingKey);
                    // Continue drilling through building
                }
            }
            // Check collision with forge
            if (player.stellarForge) {
                const distance = driller.position.distanceTo(player.stellarForge.position);
                if (distance < player.stellarForge.radius + 10) {
                    const damage = Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    player.stellarForge.health -= damage;
                    // Create damage number
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    this.addDamageNumber(player.stellarForge.position, damage, Constants.STELLAR_FORGE_MAX_HEALTH, player.stellarForge.health, forgeKey);
                    // Continue drilling through
                }
            }
        }
        // Check collision with map edges (decelerate and stop)
        const mapSize = this.mapSize;
        if (driller.position.x < 0 || driller.position.x > mapSize ||
            driller.position.y < 0 || driller.position.y > mapSize) {
            // Apply deceleration
            const speed = Math.sqrt(driller.drillVelocity.x ** 2 + driller.drillVelocity.y ** 2);
            if (speed > 0) {
                const decelAmount = Constants.DRILLER_DECELERATION * deltaTime;
                const newSpeed = Math.max(0, speed - decelAmount);
                if (newSpeed === 0) {
                    driller.stopDrilling();
                }
                else {
                    driller.drillVelocity.x = (driller.drillVelocity.x / speed) * newSpeed;
                    driller.drillVelocity.y = (driller.drillVelocity.y / speed) * newSpeed;
                }
            }
            // Keep within bounds
            driller.position.x = Math.max(0, Math.min(mapSize, driller.position.x));
            driller.position.y = Math.max(0, Math.min(mapSize, driller.position.y));
        }
    }
    resolveUnitCollisions(allUnits) {
        for (let i = 0; i < allUnits.length; i++) {
            const unitA = allUnits[i];
            if (unitA.isDead()) {
                continue;
            }
            for (let j = i + 1; j < allUnits.length; j++) {
                const unitB = allUnits[j];
                if (unitB.isDead()) {
                    continue;
                }
                let deltaX = unitB.position.x - unitA.position.x;
                let deltaY = unitB.position.y - unitA.position.y;
                let distanceSq = deltaX * deltaX + deltaY * deltaY;
                if (distanceSq === 0) {
                    deltaX = i % 2 === 0 ? 1 : -1;
                    deltaY = 0;
                    distanceSq = 1;
                }
                const minDistance = unitA.collisionRadiusPx + unitB.collisionRadiusPx;
                const minDistanceSq = minDistance * minDistance;
                if (distanceSq < minDistanceSq) {
                    const distance = Math.sqrt(distanceSq);
                    const overlap = minDistance - distance;
                    const pushX = (deltaX / distance) * overlap;
                    const pushY = (deltaY / distance) * overlap;
                    if (unitA.isHero && !unitB.isHero) {
                        unitB.position.x += pushX;
                        unitB.position.y += pushY;
                    }
                    else if (!unitA.isHero && unitB.isHero) {
                        unitA.position.x -= pushX;
                        unitA.position.y -= pushY;
                    }
                    else {
                        unitA.position.x -= pushX * 0.5;
                        unitA.position.y -= pushY * 0.5;
                        unitB.position.x += pushX * 0.5;
                        unitB.position.y += pushY * 0.5;
                    }
                }
            }
        }
    }
    resolveUnitObstacleCollisions(allUnits) {
        for (const unit of allUnits) {
            if (unit.isDead()) {
                continue;
            }
            const oldPosition = new math_1.Vector2D(unit.position.x, unit.position.y);
            if (this.checkCollision(unit.position, unit.collisionRadiusPx)) {
                // Smooth collision: Find the nearest obstacle and push away from it gently
                let pushX = 0;
                let pushY = 0;
                let pushCount = 0;
                // Check all obstacles and accumulate push directions
                // Suns no longer block movement
                // Check asteroids
                for (const asteroid of this.asteroids) {
                    const dx = unit.position.x - asteroid.position.x;
                    const dy = unit.position.y - asteroid.position.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = asteroid.size + unit.collisionRadiusPx + Constants.UNIT_ASTEROID_AVOIDANCE_BUFFER_PX;
                    const minDistSq = minDist * minDist;
                    if (distSq < minDistSq || asteroid.containsPoint(unit.position)) {
                        const dist = Math.sqrt(distSq) || 1;
                        const pushStrength = (minDist - dist) / minDist;
                        pushX += (dx / dist) * pushStrength;
                        pushY += (dy / dist) * pushStrength;
                        pushCount++;
                    }
                }
                // Check stellar forges
                for (const player of this.players) {
                    if (player.stellarForge) {
                        const forge = player.stellarForge;
                        const dx = unit.position.x - forge.position.x;
                        const dy = unit.position.y - forge.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = forge.radius + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }
                // Check solar mirrors
                for (const player of this.players) {
                    for (const mirror of player.solarMirrors) {
                        if (mirror.owner === unit.owner)
                            continue;
                        const dx = unit.position.x - mirror.position.x;
                        const dy = unit.position.y - mirror.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = 20 + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }
                // Check buildings
                for (const player of this.players) {
                    for (const building of player.buildings) {
                        const dx = unit.position.x - building.position.x;
                        const dy = unit.position.y - building.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = building.radius + unit.collisionRadiusPx;
                        if (dist < minDist) {
                            const pushStrength = (minDist - dist) / minDist;
                            pushX += (dx / dist) * pushStrength;
                            pushY += (dy / dist) * pushStrength;
                            pushCount++;
                        }
                    }
                }
                // Apply smooth push away from obstacles
                if (pushCount > 0) {
                    const pushLength = Math.sqrt(pushX * pushX + pushY * pushY);
                    if (pushLength > 0) {
                        // Normalize and apply gentle push
                        const pushDistance = Math.min(this.MAX_PUSH_DISTANCE, pushLength * this.PUSH_MULTIPLIER);
                        unit.position.x = oldPosition.x + (pushX / pushLength) * pushDistance;
                        unit.position.y = oldPosition.y + (pushY / pushLength) * pushDistance;
                    }
                }
                // If still in collision after push, stop the unit
                if (this.checkCollision(unit.position, unit.collisionRadiusPx)) {
                    unit.position = oldPosition;
                    if (unit.rallyPoint && this.checkCollision(unit.rallyPoint, unit.collisionRadiusPx)) {
                        unit.rallyPoint = null;
                    }
                }
            }
            this.clampUnitOutsideStructures(unit);
        }
    }
    clampUnitOutsideStructures(unit) {
        for (const player of this.players) {
            if (player.stellarForge) {
                this.pushUnitOutsideCircle(unit, player.stellarForge.position, player.stellarForge.radius);
            }
            for (const building of player.buildings) {
                this.pushUnitOutsideCircle(unit, building.position, building.radius);
            }
        }
    }
    pushUnitOutsideCircle(unit, center, radius) {
        const minDistance = radius + unit.collisionRadiusPx + Constants.UNIT_STRUCTURE_STANDOFF_PX;
        const offsetX = unit.position.x - center.x;
        const offsetY = unit.position.y - center.y;
        const distanceSq = offsetX * offsetX + offsetY * offsetY;
        const minDistanceSq = minDistance * minDistance;
        if (distanceSq < minDistanceSq) {
            const distance = Math.sqrt(distanceSq);
            if (distance > 0) {
                const scale = minDistance / distance;
                unit.position.x = center.x + offsetX * scale;
                unit.position.y = center.y + offsetY * scale;
            }
            else {
                unit.position.x = center.x + minDistance;
                unit.position.y = center.y;
            }
        }
    }
    /**
     * Check if a position would collide with any obstacle (sun, asteroid, or building)
     * Returns true if collision detected
     */
    createHeroUnit(unitType, spawnPosition, owner) {
        switch (unitType) {
            case 'Marine':
                return new game_core_1.Marine(spawnPosition, owner);
            case 'Mothership':
                return new game_core_1.Mothership(spawnPosition, owner);
            case 'Grave':
                return new game_core_1.Grave(spawnPosition, owner);
            case 'Ray':
                return new game_core_1.Ray(spawnPosition, owner);
            case 'InfluenceBall':
                return new game_core_1.InfluenceBall(spawnPosition, owner);
            case 'TurretDeployer':
                return new game_core_1.TurretDeployer(spawnPosition, owner);
            case 'Driller':
                return new game_core_1.Driller(spawnPosition, owner);
            case 'Dagger':
                return new game_core_1.Dagger(spawnPosition, owner);
            case 'Beam':
                return new game_core_1.Beam(spawnPosition, owner);
            case 'Mortar':
                return new game_core_1.Mortar(spawnPosition, owner);
            case 'Preist':
                return new game_core_1.Preist(spawnPosition, owner);
            case 'Tank':
                return new game_core_1.Tank(spawnPosition, owner);
            case 'Spotlight':
                return new game_core_1.Spotlight(spawnPosition, owner);
            case 'Nova':
                return new game_core_1.Nova(spawnPosition, owner);
            case 'Sly':
                return new game_core_1.Sly(spawnPosition, owner);
            case 'Radiant':
                return new game_core_1.Radiant(spawnPosition, owner);
            case 'VelarisHero':
                return new game_core_1.VelarisHero(spawnPosition, owner);
            case 'Chrono':
                return new game_core_1.Chrono(spawnPosition, owner);
            case 'AurumHero':
                return new game_core_1.AurumHero(spawnPosition, owner);
            case 'Dash':
                return new game_core_1.Dash(spawnPosition, owner);
            case 'Blink':
                return new game_core_1.Blink(spawnPosition, owner);
            case 'Shadow':
                return new game_core_1.Shadow(spawnPosition, owner);
            default:
                return null;
        }
    }
    checkCollision(position, unitRadius = Constants.UNIT_RADIUS_PX, ignoredObject = null) {
        // Suns no longer block movement or placement
        // Check collision with asteroids
        for (const asteroid of this.asteroids) {
            if (asteroid.containsPoint(position)) {
                return true; // Inside asteroid
            }
        }
        // Check collision with all players' buildings
        for (const player of this.players) {
            // Check collision with stellar forge
            if (player.stellarForge) {
                if (player.stellarForge === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(player.stellarForge.position);
                if (distance < player.stellarForge.radius + unitRadius) {
                    return true; // Collision with forge
                }
            }
            // Check collision with solar mirrors (using approximate radius)
            for (const mirror of player.solarMirrors) {
                if (mirror === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(mirror.position);
                if (distance < 20 + unitRadius) { // Mirror has ~20 pixel radius
                    return true; // Collision with mirror
                }
            }
            // Check collision with buildings
            for (const building of player.buildings) {
                if (building === ignoredObject) {
                    continue;
                }
                const distance = position.distanceTo(building.position);
                if (distance < building.radius + unitRadius) {
                    return true; // Collision with building
                }
            }
        }
        return false; // No collision
    }
    /**
     * Apply knockback to units and solar mirrors when asteroids rotate and collide with them
     * This prevents entities from getting stuck inside rotating asteroids
     */
    applyAsteroidRotationKnockback() {
        // Check each asteroid for collisions with units and solar mirrors
        for (const asteroid of this.asteroids) {
            // Check all players' units
            for (const player of this.players) {
                // Check units
                for (const unit of player.units) {
                    // Broad-phase check: skip if unit is definitely outside asteroid
                    // Use 1.4x size as safety margin since asteroid vertices can extend up to 1.32x base size
                    const distance = unit.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size * 1.4 + unit.collisionRadiusPx) {
                        // Use precise polygon check
                        if (asteroid.containsPoint(unit.position)) {
                            // Apply knockback away from asteroid center
                            (0, math_1.applyKnockbackVelocity)(unit.position, unit.knockbackVelocity, asteroid.position, Constants.ASTEROID_KNOCKBACK_INITIAL_VELOCITY);
                        }
                    }
                }
                // Check solar mirrors
                for (const mirror of player.solarMirrors) {
                    // Broad-phase check: skip if mirror is definitely outside asteroid
                    const distance = mirror.position.distanceTo(asteroid.position);
                    if (distance < asteroid.size * 1.4 + Constants.SOLAR_MIRROR_COLLISION_RADIUS) {
                        // Use precise polygon check
                        if (asteroid.containsPoint(mirror.position)) {
                            // Apply knockback away from asteroid center
                            (0, math_1.applyKnockbackVelocity)(mirror.position, mirror.knockbackVelocity, asteroid.position, Constants.ASTEROID_KNOCKBACK_INITIAL_VELOCITY);
                        }
                    }
                }
            }
        }
    }
    getMirrorLightOnStructure(player, structure) {
        let totalLight = 0;
        for (const mirror of player.solarMirrors) {
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
            if (linkedStructure !== structure)
                continue;
            if (!mirror.hasLineOfSightToLight(this.suns, this.asteroids))
                continue;
            const ray = new math_1.LightRay(mirror.position, new math_1.Vector2D(structure.position.x - mirror.position.x, structure.position.y - mirror.position.y).normalize(), 1.0);
            let hasLineOfSight = true;
            for (const asteroid of this.asteroids) {
                if (ray.intersectsPolygon(asteroid.getWorldVertices())) {
                    hasLineOfSight = false;
                    break;
                }
            }
            if (hasLineOfSight) {
                const closestSun = this.suns.reduce((closest, sun) => {
                    const distToSun = mirror.position.distanceTo(sun.position);
                    const distToClosest = closest ? mirror.position.distanceTo(closest.position) : Infinity;
                    return distToSun < distToClosest ? sun : closest;
                }, null);
                if (closestSun) {
                    const distanceToSun = mirror.position.distanceTo(closestSun.position);
                    const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER * (1.0 - Math.min(1.0, distanceToSun / Constants.MIRROR_MAX_GLOW_DISTANCE)));
                    totalLight += distanceMultiplier;
                }
            }
        }
        return totalLight;
    }
    updateStateHash() {
        let hash = 2166136261;
        const mix = (value) => {
            const normalizedValue = Math.floor(value * 100);
            hash = Math.imul(hash ^ normalizedValue, 16777619);
        };
        const mixInt = (value) => {
            hash = Math.imul(hash ^ value, 16777619);
        };
        const mixString = (value) => {
            mixInt(value.length);
            for (let i = 0; i < value.length; i++) {
                mixInt(value.charCodeAt(i));
            }
        };
        mix(this.gameTime);
        mix(this.suns.length);
        mix(this.asteroids.length);
        mix(Constants.DUST_MIN_VELOCITY);
        mixInt(this.spaceDust.length);
        for (const particle of this.spaceDust) {
            mix(particle.position.x);
            mix(particle.position.y);
            mix(particle.velocity.x);
            mix(particle.velocity.y);
            mix(particle.glowTransition);
            mixInt(particle.glowState);
            mixInt(particle.targetGlowState);
            mix(particle.impactBlend);
            mix(particle.impactTargetBlend);
            mix(particle.impactHoldTimeSec);
            mixString(particle.baseColor);
            mixString(particle.impactColor ?? '');
        }
        for (const player of this.players) {
            mix(player.energy);
            mixInt(player.isAi ? 1 : 0);
            mix(player.aiNextMirrorCommandSec);
            mix(player.aiNextDefenseCommandSec);
            mix(player.aiNextHeroCommandSec);
            mix(player.aiNextStructureCommandSec);
            mix(player.aiNextMirrorPurchaseCommandSec);
            mixString(player.aiStrategy);
            mixString(player.aiDifficulty);
            mixInt(player.hasStrafeUpgrade ? 1 : 0);
            mixInt(player.hasRegenUpgrade ? 1 : 0);
            mixInt(player.hasBlinkUpgrade ? 1 : 0);
            mixInt(player.hasAttackUpgrade ? 1 : 0);
            mixInt(player.units.length);
            if (player.stellarForge) {
                mix(player.stellarForge.position.x);
                mix(player.stellarForge.position.y);
                mix(player.stellarForge.health);
                mixInt(player.stellarForge.unitQueue.length);
                for (const unitType of player.stellarForge.unitQueue) {
                    mixString(unitType);
                }
                mixString(player.stellarForge.heroProductionUnitType ?? '');
                mix(player.stellarForge.heroProductionRemainingSec);
                mix(player.stellarForge.heroProductionDurationSec);
                mix(player.stellarForge.crunchTimer);
                mix(player.stellarForge.rotation);
                if (player.stellarForge.targetPosition) {
                    mix(player.stellarForge.targetPosition.x);
                    mix(player.stellarForge.targetPosition.y);
                }
                else {
                    mix(-1);
                    mix(-1);
                }
                mix(player.stellarForge.velocity.x);
                mix(player.stellarForge.velocity.y);
            }
            else {
                mix(-1);
            }
            for (const mirror of player.solarMirrors) {
                mix(mirror.position.x);
                mix(mirror.position.y);
                mix(mirror.health);
                mix(mirror.efficiency);
                mix(mirror.reflectionAngle);
                if (mirror.linkedStructure) {
                    if (mirror.linkedStructure instanceof stellar_forge_1.StellarForge) {
                        mixInt(1);
                    }
                    else {
                        mixInt(2);
                    }
                    mix(mirror.linkedStructure.position.x);
                    mix(mirror.linkedStructure.position.y);
                }
                else {
                    mixInt(0);
                    mix(-1);
                    mix(-1);
                }
                if (mirror.targetPosition) {
                    mix(mirror.targetPosition.x);
                    mix(mirror.targetPosition.y);
                }
                else {
                    mix(-1);
                    mix(-1);
                }
                mix(mirror.velocity.x);
                mix(mirror.velocity.y);
            }
            for (const unit of player.units) {
                mix(unit.position.x);
                mix(unit.position.y);
                mix(unit.velocity.x);
                mix(unit.velocity.y);
                mix(unit.rotation);
                mix(unit.health);
                mix(unit.isHero ? 1 : 0);
                mix(unit.collisionRadiusPx);
                mixInt(unit.moveOrder);
                if (unit.rallyPoint) {
                    mix(unit.rallyPoint.x);
                    mix(unit.rallyPoint.y);
                }
                else {
                    mix(-1);
                    mix(-1);
                }
                const manualTarget = unit.getManualTarget();
                if (manualTarget) {
                    mixInt(1);
                    if (manualTarget instanceof stellar_forge_1.StellarForge) {
                        mixInt(1);
                    }
                    else if (manualTarget instanceof buildings_1.Building) {
                        mixInt(2);
                    }
                    else if (manualTarget instanceof solar_mirror_1.SolarMirror) {
                        mixInt(3);
                    }
                    else {
                        mixInt(4);
                    }
                    mix(manualTarget.position.x);
                    mix(manualTarget.position.y);
                    if ('owner' in manualTarget && manualTarget.owner) {
                        mixInt(this.players.indexOf(manualTarget.owner));
                    }
                    else {
                        mixInt(-1);
                    }
                }
                else {
                    mixInt(0);
                    mix(-1);
                    mix(-1);
                    mixInt(-1);
                }
                if (unit instanceof starling_1.Starling) {
                    mixInt(unit.getAssignedPathLength());
                    mixInt(unit.getCurrentPathWaypointIndex());
                    mixInt(unit.hasActiveManualOrder() ? 1 : 0);
                    mix(unit.getCurrentMoveSpeedPxPerSec());
                    mix(unit.abilityCooldown);
                    mixInt(unit.getHasReachedFinalWaypoint() ? 1 : 0);
                    mixString(unit.getPathHash());
                }
                if (unit instanceof game_core_1.Spotlight) {
                    mixInt(unit.getSpotlightStateCode());
                    mix(unit.spotlightStateElapsedSec);
                    mix(unit.spotlightFireCooldownSec);
                    mix(unit.spotlightLengthFactor);
                    mix(unit.spotlightRangePx);
                    if (unit.spotlightDirection) {
                        mix(unit.spotlightDirection.x);
                        mix(unit.spotlightDirection.y);
                    }
                    else {
                        mix(-1);
                        mix(-1);
                    }
                }
                if (unit instanceof game_core_1.Grave) {
                    mix(unit.getSmallParticleCount());
                    mix(unit.projectileLaunchCooldown);
                    mix(unit.smallParticleRegenTimer);
                    mixInt(unit.isUsingAbility ? 1 : 0);
                    const graveProjectiles = unit.getProjectiles();
                    mixInt(graveProjectiles.length);
                    for (const graveProjectile of graveProjectiles) {
                        mix(graveProjectile.position.x);
                        mix(graveProjectile.position.y);
                        mix(graveProjectile.velocity.x);
                        mix(graveProjectile.velocity.y);
                        mix(graveProjectile.lifetime);
                        mix(graveProjectile.targetAngle);
                        mixInt(graveProjectile.isAttacking ? 1 : 0);
                        if (graveProjectile.targetEnemy) {
                            mixInt(1);
                            mix(graveProjectile.targetEnemy.position.x);
                            mix(graveProjectile.targetEnemy.position.y);
                        }
                        else {
                            mixInt(0);
                            mix(-1);
                            mix(-1);
                        }
                    }
                }
            }
            for (const building of player.buildings) {
                mix(building.position.x);
                mix(building.position.y);
                mix(building.health);
                mix(building.isComplete ? 1 : 0);
                if (building instanceof buildings_1.SubsidiaryFactory) {
                    mix(building.productionProgress);
                    mixString(building.currentProduction ?? '');
                    mixInt(building.productionQueue.length);
                    for (const itemType of building.productionQueue) {
                        mixString(itemType);
                    }
                }
            }
        }
        mixInt(this.starlingMergeGates.length);
        for (const gate of this.starlingMergeGates) {
            mix(gate.position.x);
            mix(gate.position.y);
            mix(gate.remainingSec);
            mix(gate.health);
            mixInt(gate.absorbedCount);
            mixInt(gate.assignedStarlings.length);
            mixInt(this.players.indexOf(gate.owner));
        }
        mixInt(this.warpGates.length);
        for (const gate of this.warpGates) {
            mix(gate.position.x);
            mix(gate.position.y);
            mix(gate.chargeTime);
            mix(gate.accumulatedEnergy);
            mixInt(gate.isCharging ? 1 : 0);
            mixInt(gate.isComplete ? 1 : 0);
            mixInt(gate.isCancelling ? 1 : 0);
            mixInt(gate.hasDissipated ? 1 : 0);
            mix(gate.completionRemainingSec);
            mix(gate.health);
            mixInt(this.players.indexOf(gate.owner));
        }
        mixInt(this.minionProjectiles.length);
        for (const projectile of this.minionProjectiles) {
            mix(projectile.position.x);
            mix(projectile.position.y);
            mix(projectile.velocity.x);
            mix(projectile.velocity.y);
            mix(projectile.damage);
            mix(projectile.distanceTraveledPx);
            mix(projectile.maxRangePx);
            mixInt(this.players.indexOf(projectile.owner));
        }
        mixInt(this.muzzleFlashes.length);
        for (const flash of this.muzzleFlashes) {
            mix(flash.position.x);
            mix(flash.position.y);
            mix(flash.angle);
            mix(flash.lifetime);
            mix(flash.maxLifetime);
        }
        mixInt(this.bulletCasings.length);
        for (const casing of this.bulletCasings) {
            mix(casing.position.x);
            mix(casing.position.y);
            mix(casing.velocity.x);
            mix(casing.velocity.y);
            mix(casing.rotation);
            mix(casing.rotationSpeed);
            mix(casing.lifetime);
            mix(casing.maxLifetime);
        }
        mixInt(this.bouncingBullets.length);
        for (const bullet of this.bouncingBullets) {
            mix(bullet.position.x);
            mix(bullet.position.y);
            mix(bullet.velocity.x);
            mix(bullet.velocity.y);
            mix(bullet.lifetime);
            mix(bullet.maxLifetime);
        }
        this.stateHash = hash >>> 0;
    }
    /**
     * Initialize space dust particles
     */
    initializeSpaceDust(count, width, height, palette) {
        this.spaceDust = [];
        const clusterCount = Constants.DUST_CLUSTER_COUNT;
        const clusterRadiusPx = Constants.DUST_CLUSTER_RADIUS_PX;
        const clusterSpawnRatio = Constants.DUST_CLUSTER_SPAWN_RATIO;
        const clusterCenters = [];
        const rng = (0, seeded_random_1.getGameRNG)();
        for (let i = 0; i < clusterCount; i++) {
            const centerX = rng.nextFloat(-width / 2, width / 2);
            const centerY = rng.nextFloat(-height / 2, height / 2);
            clusterCenters.push(new math_1.Vector2D(centerX, centerY));
        }
        for (let i = 0; i < count; i++) {
            const useCluster = rng.next() < clusterSpawnRatio;
            let x = 0;
            let y = 0;
            if (useCluster && clusterCenters.length > 0) {
                const centerIndex = rng.nextInt(0, clusterCenters.length - 1);
                const center = clusterCenters[centerIndex];
                const angle = rng.nextAngle();
                const distance = Math.sqrt(rng.next()) * clusterRadiusPx;
                x = center.x + Math.cos(angle) * distance;
                y = center.y + Math.sin(angle) * distance;
            }
            else {
                x = rng.nextFloat(-width / 2, width / 2);
                y = rng.nextFloat(-height / 2, height / 2);
            }
            this.spaceDust.push(new particles_1.SpaceDustParticle(new math_1.Vector2D(x, y), undefined, palette));
        }
    }
    /**
     * Initialize asteroids at random positions
     */
    initializeAsteroids(count, width, height, exclusionZones) {
        this.asteroids = [];
        const maxAttempts = 50; // Maximum attempts to find a valid position
        const rng = (0, seeded_random_1.getGameRNG)();
        for (let i = 0; i < count; i++) {
            let validPosition = false;
            let attempts = 0;
            let x = 0, y = 0, size = 0;
            while (!validPosition && attempts < maxAttempts) {
                // Random position avoiding the center (where players start)
                const angle = rng.nextAngle();
                const distance = rng.nextFloat(200, Math.min(width, height) / 2 - 100);
                x = Math.cos(angle) * distance;
                y = Math.sin(angle) * distance;
                // Random size (30-80)
                size = rng.nextFloat(Constants.ASTEROID_MIN_SIZE, 80);
                validPosition = true;
                // Check if this position has enough gap from existing asteroids
                // Gap must be at least the sum of both asteroid radii (accounting for rotation)
                // Use size * 1.32 as maximum radius (from asteroid generation vertex radiusScale max)
                const maxRadius = size * 1.32;
                for (const asteroid of this.asteroids) {
                    const dx = x - asteroid.position.x;
                    const dy = y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const existingMaxRadius = asteroid.size * 1.32;
                    const requiredGap = maxRadius + existingMaxRadius;
                    if (dist < requiredGap) {
                        validPosition = false;
                        break;
                    }
                }
                // Check if this position is within any exclusion zones
                if (validPosition && exclusionZones) {
                    for (const zone of exclusionZones) {
                        const dx = x - zone.position.x;
                        const dy = y - zone.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const requiredGap = maxRadius + zone.radius;
                        if (dist < requiredGap) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                attempts++;
            }
            // If we found a valid position, add the asteroid
            if (validPosition) {
                // Random polygon sides for faceted low-poly silhouette (12-24)
                const sides = rng.nextInt(12, 24);
                this.asteroids.push(new asteroid_1.Asteroid(new math_1.Vector2D(x, y), sides, size));
            }
        }
    }
    /**
     * Check if any player has won
     * In team games, victory is achieved when all players on one team are defeated
     */
    checkVictoryConditions() {
        const activePlayers = this.players.filter(p => !p.isDefeated());
        // No winner yet if everyone is defeated (draw/error state) or no one is defeated yet
        if (activePlayers.length === 0 || activePlayers.length === this.players.length) {
            return null;
        }
        // Single survivor wins (handles both 1v1 and last-man-standing in team games)
        if (activePlayers.length === 1) {
            return activePlayers[0];
        }
        // Multiple players remaining - check for team victory
        // In 1v1, this means both players are still alive (already handled above)
        // In team games (3+ total players), check if only one team has survivors
        if (this.players.length >= 3) {
            const activeTeams = new Set(activePlayers.map(p => p.teamId));
            // Victory if only one team remains with active players
            if (activeTeams.size === 1) {
                return activePlayers[0]; // Return any player from the winning team
            }
        }
        return null;
    }
    /**
     * Initialize a player with starting structures
     */
    initializePlayer(player, forgePosition, mirrorPositions) {
        // Create Stellar Forge
        player.stellarForge = new stellar_forge_1.StellarForge(forgePosition, player);
        // Create starting Solar Mirrors
        for (const pos of mirrorPositions) {
            const mirror = new solar_mirror_1.SolarMirror(pos, player);
            player.solarMirrors.push(mirror);
        }
    }
    /**
     * Add a damage number with proper handling for display mode
     */
    addDamageNumber(position, damage, maxHealth, currentHealth, unitKey = null) {
        const remainingHealth = Math.max(0, currentHealth);
        // If in remaining-life mode and unitKey is provided, remove previous damage numbers for this unit
        if (this.damageDisplayMode === 'remaining-life' && unitKey !== null) {
            this.damageNumbers = this.damageNumbers.filter(dn => dn.unitId !== unitKey);
        }
        this.damageNumbers.push(new damage_number_1.DamageNumber(position, damage, this.gameTime, maxHealth, remainingHealth, unitKey));
    }
    /**
     * Set up network manager and register event handlers
     */
    setupNetworkManager(networkManager, localPlayerIndex) {
        this.networkManager = networkManager;
        this.localPlayerIndex = localPlayerIndex;
        // Listen for incoming game commands from remote players
        this.networkManager.on(network_1.NetworkEvent.MESSAGE_RECEIVED, (data) => {
            if (data && typeof data === 'object' && 'type' in data && data.type === network_1.MessageType.GAME_COMMAND) {
                const command = data.data;
                this.receiveNetworkCommand(command);
            }
        });
    }
    /**
     * Send a game command to all connected peers
     */
    sendGameCommand(command, data) {
        if (!this.networkManager)
            return;
        const gameCommand = {
            tick: Math.floor(this.gameTime * 60), // Convert time to tick number (60 ticks per second)
            playerId: this.networkManager.getLocalPlayerId(),
            command: command,
            data: data
        };
        this.networkManager.sendGameCommand(gameCommand);
    }
    /**
     * Receive and queue a game command from the network
     */
    receiveNetworkCommand(command) {
        // Add to pending commands queue to be processed in next update
        this.pendingCommands.push(command);
    }
    /**
     * Process all pending network commands
     */
    processPendingNetworkCommands() {
        if (this.pendingCommands.length === 0)
            return;
        // Sort commands by tick to ensure consistent execution order
        this.pendingCommands.sort((a, b) => a.tick - b.tick);
        // Process all pending commands
        for (const cmd of this.pendingCommands) {
            this.executeNetworkCommand(cmd);
        }
        // Clear the processed commands
        this.pendingCommands = [];
    }
    /**
     * Execute a network command
     */
    executeNetworkCommand(cmd) {
        // Determine which player this command is for
        // Remote player is always the opposite of local player
        const remotePlayerIndex = this.localPlayerIndex === 0 ? 1 : 0;
        const player = this.players[remotePlayerIndex];
        if (!player)
            return;
        // Use shared command routing logic (LAN uses 'command' and 'data')
        this.executePlayerCommand(player, cmd.command, cmd.data);
    }
    /**
     * Update the player name map for efficient P2P lookups
     * Should be called whenever players array is modified
     */
    updatePlayerNameMap() {
        this.playersByName.clear();
        for (const player of this.players) {
            this.playersByName.set(player.name, player);
        }
    }
    /**
     * Execute a command for a specific player using the shared routing logic
     * @param player - Player to execute command for
     * @param commandType - Type of command
     * @param payload - Command payload/data
     */
    executePlayerCommand(player, commandType, payload) {
        switch (commandType) {
            case 'unit_move':
                this.executeUnitMoveCommand(player, payload);
                break;
            case 'unit_target_structure':
                this.executeUnitTargetStructureCommand(player, payload);
                break;
            case 'unit_ability':
                this.executeUnitAbilityCommand(player, payload);
                break;
            case 'unit_path':
                this.executeUnitPathCommand(player, payload);
                break;
            case 'hero_purchase':
                this.executeHeroPurchaseCommand(player, payload);
                break;
            case 'building_purchase':
                this.executeBuildingPurchaseCommand(player, payload);
                break;
            case 'mirror_purchase':
                this.executeMirrorPurchaseCommand(player, payload);
                break;
            case 'mirror_move':
                this.executeMirrorMoveCommand(player, payload);
                break;
            case 'mirror_link':
                this.executeMirrorLinkCommand(player, payload);
                break;
            case 'starling_merge':
                this.executeStarlingMergeCommand(player, payload);
                break;
            case 'foundry_production':
                this.executeFoundryProductionCommand(player, payload);
                break;
            case 'foundry_strafe_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'strafe');
                break;
            case 'foundry_regen_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'regen');
                break;
            case 'foundry_attack_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'attack');
                break;
            case 'foundry_blink_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'blink');
                break;
            case 'striker_tower_fire':
                this.executeStrikerTowerFireCommand(player, payload);
                break;
            case 'striker_tower_start_countdown':
                this.executeStrikerTowerStartCountdownCommand(player, payload);
                break;
            case 'forge_move':
                this.executeForgeMoveCommand(player, payload);
                break;
            case 'set_rally_path':
                this.executeSetRallyPathCommand(player, payload);
                break;
            default:
                console.warn('Unknown command type:', commandType);
        }
    }
    /**
     * Execute a P2P transport command (deterministic)
     * This method accepts commands from the P2P multiplayer system
     * @param cmd - Command from P2P transport system
     *
     * NOTE: In the P2P system, cmd.playerId contains the player's name (not an ID).
     * This is because SoL uses player names as identifiers throughout the game state.
     */
    executeCommand(cmd) {
        // Find the player by name using efficient map lookup
        // cmd.playerId is the player's name in SoL's system
        const player = this.playersByName.get(cmd.playerId);
        if (!player) {
            console.warn('Player not found for P2P command:', cmd.playerId);
            return;
        }
        // Use shared command routing logic
        this.executePlayerCommand(player, cmd.commandType, cmd.payload);
    }
    /**
     * Execute multiple P2P commands (for a tick)
     * Commands are executed in the order provided (should be pre-sorted by the command queue)
     * @param commands - Array of commands to execute
     */
    executeCommands(commands) {
        for (const cmd of commands) {
            this.executeCommand(cmd);
        }
    }
    executeUnitMoveCommand(player, data) {
        const { unitIds, targetX, targetY, moveOrder } = data;
        const target = new math_1.Vector2D(targetX, targetY);
        for (const unitId of unitIds) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                unit.clearManualTarget();
                if (unit instanceof starling_1.Starling) {
                    unit.setManualRallyPoint(target);
                }
                else {
                    unit.rallyPoint = target;
                }
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            }
            else {
                console.warn(`Unit not found for network command: ${unitId}`);
            }
        }
    }
    executeUnitTargetStructureCommand(player, data) {
        const { unitIds, targetPlayerIndex, structureType, structureIndex, moveOrder } = data;
        const targetPlayer = this.players[targetPlayerIndex];
        if (!targetPlayer) {
            console.warn('Target player not found for unit target command.');
            return;
        }
        let targetStructure = null;
        if (structureType === 'forge') {
            targetStructure = targetPlayer.stellarForge ?? null;
        }
        else if (structureType === 'building') {
            targetStructure = targetPlayer.buildings[structureIndex] ?? null;
        }
        else if (structureType === 'mirror') {
            targetStructure = targetPlayer.solarMirrors[structureIndex] ?? null;
        }
        if (!targetStructure) {
            console.warn('Target structure not found for unit target command.');
            return;
        }
        for (const unitId of unitIds ?? []) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                if (unit instanceof starling_1.Starling && targetStructure instanceof buildings_1.SubsidiaryFactory && targetStructure.owner === player) {
                    unit.setManualTarget(targetStructure, targetStructure.position);
                }
                else {
                    const targetRadiusPx = this.getCombatTargetRadiusPx(targetStructure);
                    const rallyPoint = unit.getStructureStandoffPoint(targetStructure.position, targetRadiusPx);
                    unit.setManualTarget(targetStructure, rallyPoint);
                }
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            }
            else {
                console.warn(`Unit not found for network command: ${unitId}`);
            }
        }
    }
    /**
     * Create death particles for an entity that has just died
     * @param entity - The unit or building that died
     * @param color - The player color to tint particles
     */
    createDeathParticles(entity, color) {
        const approximateRadiusPx = entity instanceof buildings_1.Building
            ? entity.radius
            : Math.max(entity.collisionRadiusPx, entity.isHero ? Constants.HERO_BUTTON_RADIUS_PX * 0.8 : entity.collisionRadiusPx);
        this.spawnDeathParticles(entity.position, color, approximateRadiusPx, entity instanceof unit_1.Unit && entity.isHero);
    }
    createDeathParticlesForMirror(mirror, color) {
        this.spawnDeathParticles(mirror.position, color, Constants.MIRROR_CLICK_RADIUS_PX, false);
    }
    spawnDeathParticles(position, color, approximateRadiusPx, isHero) {
        const rng = (0, seeded_random_1.getGameRNG)();
        const radiusFactor = Math.max(0.6, approximateRadiusPx / Constants.UNIT_RADIUS_PX);
        const sizeFactor = Math.max(0.85, Math.min(3.2, radiusFactor));
        const baseMinCount = isHero ? 14 : 6;
        const baseMaxCount = isHero ? 24 : 12;
        const particleCount = Math.max(4, Math.round(rng.nextInt(baseMinCount, baseMaxCount) * (0.8 + sizeFactor * 0.75)));
        const baseSize = Math.max(2.2, (6 + approximateRadiusPx * 0.28) * Constants.DEATH_PARTICLE_SIZE_SCALE);
        const fadeStartTime = rng.nextFloat(5, 15);
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + rng.nextFloat(-0.25, 0.25);
            const speed = rng.nextFloat(48, 155) * (0.7 + sizeFactor * 0.25);
            const velocity = new math_1.Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed);
            const fragment = document.createElement('canvas');
            const size = rng.nextFloat(baseSize, baseSize * 2.0);
            fragment.width = size;
            fragment.height = size;
            const ctx = fragment.getContext('2d');
            if (ctx) {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, size, size);
            }
            const particle = new particles_1.DeathParticle(new math_1.Vector2D(position.x, position.y), velocity, rng.nextAngle(), fragment, fadeStartTime);
            this.deathParticles.push(particle);
        }
    }
    updateDeathParticles(deltaTime) {
        const collisionTargets = [];
        for (const asteroid of this.asteroids) {
            collisionTargets.push({ position: asteroid.position, radius: asteroid.size });
        }
        for (const player of this.players) {
            if (player.stellarForge && !player.isDefeated()) {
                collisionTargets.push({ position: player.stellarForge.position, radius: player.stellarForge.radius });
            }
            for (const building of player.buildings) {
                if (!building.isDestroyed()) {
                    collisionTargets.push({ position: building.position, radius: building.radius });
                }
            }
            for (const mirror of player.solarMirrors) {
                if (mirror.health > 0) {
                    collisionTargets.push({ position: mirror.position, radius: Constants.MIRROR_CLICK_RADIUS_PX });
                }
            }
            for (const unit of player.units) {
                if (!unit.isDead()) {
                    collisionTargets.push({ position: unit.position, radius: unit.collisionRadiusPx });
                }
            }
        }
        const mapHalf = this.mapSize / 2;
        for (const deathParticle of this.deathParticles) {
            deathParticle.update(deltaTime);
            const particleRadius = Math.max(0.75, ((deathParticle.spriteFragment?.width ?? 2) * 0.5));
            if (deathParticle.position.x - particleRadius < -mapHalf) {
                deathParticle.position.x = -mapHalf + particleRadius;
                deathParticle.bounce(1, 0, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }
            else if (deathParticle.position.x + particleRadius > mapHalf) {
                deathParticle.position.x = mapHalf - particleRadius;
                deathParticle.bounce(-1, 0, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }
            if (deathParticle.position.y - particleRadius < -mapHalf) {
                deathParticle.position.y = -mapHalf + particleRadius;
                deathParticle.bounce(0, 1, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }
            else if (deathParticle.position.y + particleRadius > mapHalf) {
                deathParticle.position.y = mapHalf - particleRadius;
                deathParticle.bounce(0, -1, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }
            for (const target of collisionTargets) {
                const dx = deathParticle.position.x - target.position.x;
                const dy = deathParticle.position.y - target.position.y;
                const minDist = target.radius + particleRadius;
                const minDistSq = minDist * minDist;
                const distSq = dx * dx + dy * dy;
                if (distSq <= 0 || distSq >= minDistSq) {
                    continue;
                }
                const dist = Math.sqrt(distSq);
                const normalX = dx / dist;
                const normalY = dy / dist;
                deathParticle.position.x = target.position.x + normalX * minDist;
                deathParticle.position.y = target.position.y + normalY * minDist;
                deathParticle.bounce(normalX, normalY, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }
            this.applyDustPushFromMovingEntity(deathParticle.position, deathParticle.velocity, Constants.DEATH_PARTICLE_DUST_PUSH_RADIUS_PX, Constants.DEATH_PARTICLE_DUST_PUSH_FORCE_MULTIPLIER, null, deltaTime);
        }
        this.deathParticles = this.deathParticles.filter(particle => !particle.shouldDespawn());
    }
    getCombatTargetRadiusPx(target) {
        if (target instanceof solar_mirror_1.SolarMirror) {
            return Constants.MIRROR_CLICK_RADIUS_PX;
        }
        if ('radius' in target) {
            return target.radius;
        }
        return 0;
    }
    /**
     * Calculate squared distance from point to line segment
     * Used for laser field collision detection
     */
    pointToLineSegmentDistanceSquared(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) {
            // Line segment is a point
            const px = point.x - lineStart.x;
            const py = point.y - lineStart.y;
            return px * px + py * py;
        }
        // Calculate projection parameter
        const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq));
        // Calculate closest point on line segment
        const closestX = lineStart.x + t * dx;
        const closestY = lineStart.y + t * dy;
        // Return squared distance
        const distX = point.x - closestX;
        const distY = point.y - closestY;
        return distX * distX + distY * distY;
    }
    /**
     * Get closest point on line segment to a given point
     */
    getClosestPointOnLineSegment(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) {
            return new math_1.Vector2D(lineStart.x, lineStart.y);
        }
        const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq));
        return new math_1.Vector2D(lineStart.x + t * dx, lineStart.y + t * dy);
    }
    /**
     * Check if a line segment (light path) is blocked by Velaris orb light-blocking fields
     */
    isLightBlockedByVelarisField(start, end) {
        // Check all pairs of Velaris orbs
        for (let i = 0; i < this.velarisOrbs.length; i++) {
            for (let j = i + 1; j < this.velarisOrbs.length; j++) {
                const orb1 = this.velarisOrbs[i];
                const orb2 = this.velarisOrbs[j];
                // Only check orbs from the same owner
                if (orb1.owner !== orb2.owner)
                    continue;
                const distance = orb1.position.distanceTo(orb2.position);
                const maxRange = Math.min(orb1.getRange(), orb2.getRange());
                if (distance <= maxRange) {
                    // Check if light path intersects this orb field
                    if (this.lineSegmentsIntersect(start, end, orb1.position, orb2.position)) {
                        return true; // Light is blocked
                    }
                }
            }
        }
        return false; // Light is not blocked
    }
    /**
     * Check if two line segments intersect
     */
    lineSegmentsIntersect(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        const denominator = d1x * d2y - d1y * d2x;
        // Lines are parallel
        if (Math.abs(denominator) < 0.0001) {
            return false;
        }
        const d3x = p1.x - p3.x;
        const d3y = p1.y - p3.y;
        const t1 = (d3x * d2y - d3y * d2x) / denominator;
        const t2 = (d3x * d1y - d3y * d1x) / denominator;
        // Check if intersection point is within both line segments
        return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
    }
    executeUnitAbilityCommand(player, data) {
        const { unitId, directionX, directionY } = data;
        const direction = new math_1.Vector2D(directionX, directionY);
        const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
        if (unit) {
            unit.useAbility(direction);
        }
        else {
            console.warn(`Unit not found for ability command: ${unitId}`);
        }
    }
    executeUnitPathCommand(player, data) {
        const { unitIds, waypoints, moveOrder } = data;
        const path = (waypoints ?? []).map((wp) => new math_1.Vector2D(wp.x, wp.y));
        for (const unitId of unitIds ?? []) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                unit.clearManualTarget();
                unit.setPath(path);
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            }
            else {
                console.warn(`Unit not found for path command: ${unitId}`);
            }
        }
    }
    executeHeroPurchaseCommand(player, data) {
        const { heroType } = data;
        if (!player.stellarForge) {
            return;
        }
        const heroCost = this.getHeroUnitCost(player);
        player.stellarForge.enqueueHeroUnit(heroType, heroCost);
    }
    executeBuildingPurchaseCommand(player, data) {
        const { buildingType, positionX, positionY } = data;
        const position = new math_1.Vector2D(positionX, positionY);
        // Check faction restrictions for Radiant-specific buildings
        const radiantOnlyBuildings = ['Minigun', 'Cannon', 'Gatling', 'GatlingTower', 'ShieldTower'];
        if (radiantOnlyBuildings.includes(buildingType) && player.faction !== player_2.Faction.RADIANT) {
            // Aurum and Velaris cannot build Radiant-specific buildings
            return;
        }
        // Check faction restrictions for Velaris-specific buildings
        const velarisOnlyBuildings = ['StrikerTower', 'LockOnLaserTower', 'SpaceDustSwirler'];
        if (velarisOnlyBuildings.includes(buildingType) && player.faction !== player_2.Faction.VELARIS) {
            // Radiant and Aurum cannot build Velaris-specific buildings
            return;
        }
        // Check if player can afford the building
        let cost = 0;
        if (buildingType === 'Minigun' || buildingType === 'Cannon') {
            cost = Constants.MINIGUN_COST;
        }
        else if (buildingType === 'Gatling' || buildingType === 'GatlingTower') {
            cost = Constants.GATLING_COST;
        }
        else if (buildingType === 'SpaceDustSwirler') {
            cost = Constants.SWIRLER_COST;
        }
        else if (buildingType === 'SubsidiaryFactory' || buildingType === 'Foundry') {
            cost = Constants.SUBSIDIARY_FACTORY_COST;
        }
        else if (buildingType === 'StrikerTower') {
            cost = Constants.STRIKER_TOWER_COST;
        }
        else if (buildingType === 'LockOnLaserTower') {
            cost = Constants.LOCKON_TOWER_COST;
        }
        else if (buildingType === 'ShieldTower') {
            cost = Constants.SHIELD_TOWER_COST;
        }
        if (player.spendEnergy(cost)) {
            // Create the building
            if (buildingType === 'Minigun' || buildingType === 'Cannon') {
                player.buildings.push(new buildings_1.Minigun(position, player));
            }
            else if (buildingType === 'Gatling' || buildingType === 'GatlingTower') {
                player.buildings.push(new buildings_1.GatlingTower(position, player));
            }
            else if (buildingType === 'SpaceDustSwirler') {
                player.buildings.push(new buildings_1.SpaceDustSwirler(position, player));
            }
            else if (buildingType === 'SubsidiaryFactory' || buildingType === 'Foundry') {
                player.buildings.push(new buildings_1.SubsidiaryFactory(position, player));
            }
            else if (buildingType === 'StrikerTower') {
                player.buildings.push(new buildings_1.StrikerTower(position, player));
            }
            else if (buildingType === 'LockOnLaserTower') {
                player.buildings.push(new buildings_1.LockOnLaserTower(position, player));
            }
            else if (buildingType === 'ShieldTower') {
                player.buildings.push(new buildings_1.ShieldTower(position, player));
            }
        }
    }
    executeMirrorPurchaseCommand(player, data) {
        const requiredIncomingLight = typeof data?.cost === 'number' ? data.cost : Constants.STELLAR_FORGE_SOLAR_MIRROR_COST;
        const positionX = typeof data?.positionX === 'number' ? data.positionX : player.stellarForge?.position.x;
        const positionY = typeof data?.positionY === 'number' ? data.positionY : player.stellarForge?.position.y;
        if (typeof positionX !== 'number' || typeof positionY !== 'number') {
            return;
        }
        if (!player.stellarForge) {
            return;
        }
        player.stellarForge.enqueueMirror(requiredIncomingLight, new math_1.Vector2D(positionX, positionY));
    }
    executeStrikerTowerStartCountdownCommand(player, data) {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new math_1.Vector2D(targetX, targetY);
        // Find the striker tower
        const building = player.buildings.find(b => b instanceof buildings_1.StrikerTower && this.getBuildingNetworkId(b) === buildingId);
        if (building instanceof buildings_1.StrikerTower) {
            // Validate target position
            const isValid = building.isValidTarget(targetPosition, (pos) => this.isPointInShadow(pos), (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits), player.units);
            if (isValid) {
                // Start countdown
                building.startCountdown(targetPosition);
            }
        }
    }
    executeStrikerTowerFireCommand(player, data) {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new math_1.Vector2D(targetX, targetY);
        // Find the striker tower
        const building = player.buildings.find(b => b instanceof buildings_1.StrikerTower && this.getBuildingNetworkId(b) === buildingId);
        if (building instanceof buildings_1.StrikerTower) {
            // Get all enemy units and structures
            const enemies = [];
            for (const otherPlayer of this.players) {
                // Skip self
                if (otherPlayer === player)
                    continue;
                // Skip teammates in team games (3+ players)
                if (this.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                    continue;
                }
                enemies.push(...otherPlayer.units);
                if (otherPlayer.stellarForge) {
                    enemies.push(otherPlayer.stellarForge);
                }
                enemies.push(...otherPlayer.buildings);
            }
            // Fire missile with visibility checks
            building.fireMissile(targetPosition, enemies, (pos) => this.isPointInShadow(pos), (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits), player.units);
        }
    }
    /**
     * Check if a position is visible by any of the player's units
     */
    isPositionVisibleByPlayerUnits(position, playerUnits) {
        for (const unit of playerUnits) {
            const distance = unit.position.distanceTo(position);
            if (distance <= Constants.UNIT_VISIBILITY_RADIUS) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get a unique network ID for a building
     */
    getBuildingNetworkId(building) {
        const playerIndex = this.players.findIndex(p => p === building.owner);
        const buildingIndex = building.owner.buildings.indexOf(building);
        return `p${playerIndex}_b${buildingIndex}`;
    }
    executeMirrorMoveCommand(player, data) {
        const { mirrorIndices, targetX, targetY, moveOrder } = data;
        const target = new math_1.Vector2D(targetX, targetY);
        for (const mirrorIndex of mirrorIndices ?? []) {
            const mirror = player.solarMirrors[mirrorIndex];
            if (mirror) {
                mirror.setTarget(target, this);
                if (typeof moveOrder === 'number') {
                    mirror.moveOrder = moveOrder;
                }
            }
        }
    }
    executeMirrorLinkCommand(player, data) {
        const { mirrorIndices, structureType, buildingIndex } = data;
        let targetStructure = null;
        if (structureType === 'forge') {
            targetStructure = player.stellarForge ?? null;
        }
        else if (structureType === 'building') {
            targetStructure = player.buildings[buildingIndex] ?? null;
        }
        for (const mirrorIndex of mirrorIndices ?? []) {
            const mirror = player.solarMirrors[mirrorIndex];
            if (mirror) {
                mirror.setLinkedStructure(targetStructure);
            }
        }
    }
    executeStarlingMergeCommand(player, data) {
        const { unitIds, targetX, targetY } = data;
        if (!Array.isArray(unitIds)) {
            return;
        }
        const targetPosition = new math_1.Vector2D(targetX, targetY);
        this.applyStarlingMerge(player, unitIds, targetPosition);
    }
    applyStarlingMerge(player, unitIds, targetPosition) {
        if (!player.buildings.some((building) => building instanceof buildings_1.SubsidiaryFactory)) {
            return;
        }
        const mergeStarlings = [];
        for (const unitId of unitIds) {
            if (mergeStarlings.length >= Constants.STARLING_MERGE_COUNT) {
                break;
            }
            const unit = player.units.find((candidate) => this.getUnitNetworkId(candidate) === unitId);
            if (unit instanceof starling_1.Starling && !unit.isDead()) {
                mergeStarlings.push(unit);
            }
        }
        if (mergeStarlings.length < Constants.STARLING_MERGE_COUNT) {
            return;
        }
        for (const starling of mergeStarlings) {
            starling.clearManualTarget();
            starling.setManualRallyPoint(targetPosition);
        }
        this.starlingMergeGates.push(new starling_merge_gate_1.StarlingMergeGate(targetPosition, player, mergeStarlings));
    }
    executeFoundryProductionCommand(player, data) {
        const { buildingId, itemType } = data;
        const building = player.buildings[buildingId];
        if (!(building instanceof buildings_1.SubsidiaryFactory)) {
            return;
        }
        if (!building.isComplete) {
            return;
        }
        if (itemType === 'solar-mirror') {
            return;
        }
    }
    executeFoundryUpgradeCommand(player, data, upgradeType) {
        const { buildingId } = data;
        const building = player.buildings[buildingId];
        if (!(building instanceof buildings_1.SubsidiaryFactory)) {
            return;
        }
        if (!building.isComplete) {
            return;
        }
        if (upgradeType === 'strafe') {
            if (building.canQueueStrafeUpgrade()) {
                building.enqueueProduction(Constants.FOUNDRY_STRAFE_UPGRADE_ITEM);
            }
            return;
        }
        if (upgradeType === 'blink') {
            if (building.canQueueBlinkUpgrade()) {
                building.enqueueProduction(Constants.FOUNDRY_BLINK_UPGRADE_ITEM);
            }
            return;
        }
        if (upgradeType === 'attack') {
            if (building.canQueueAttackUpgrade()) {
                building.enqueueProduction(Constants.FOUNDRY_ATTACK_UPGRADE_ITEM);
            }
            return;
        }
        if (building.canQueueRegenUpgrade()) {
            building.enqueueProduction(Constants.FOUNDRY_REGEN_UPGRADE_ITEM);
        }
    }
    executeForgeMoveCommand(player, data) {
        const { targetX, targetY, moveOrder } = data;
        const target = new math_1.Vector2D(targetX, targetY);
        if (player.stellarForge) {
            player.stellarForge.targetPosition = target;
            if (typeof moveOrder === 'number') {
                player.stellarForge.moveOrder = moveOrder;
            }
        }
    }
    executeSetRallyPathCommand(player, data) {
        const { waypoints } = data;
        const path = waypoints.map((wp) => new math_1.Vector2D(wp.x, wp.y));
        if (player.stellarForge) {
            player.stellarForge.setMinionPath(path);
        }
    }
    /**
     * Generate a unique ID for a unit (for network synchronization)
     * Note: This is a temporary solution. In production, units should have explicit unique IDs.
     */
    getUnitNetworkId(unit) {
        // Use a combination of owner, position, health, and type for uniqueness
        // This is not perfect but works for most cases in the current implementation
        const ownerIndex = this.players.indexOf(unit.owner);
        return `${ownerIndex}_${unit.position.x.toFixed(1)}_${unit.position.y.toFixed(1)}_${unit.maxHealth}_${unit.constructor.name}`;
    }
    /**
     * Check if two players are on the same team
     */
    areAllies(player1, player2) {
        return player1.teamId === player2.teamId;
    }
    /**
     * Check if two players are enemies
     */
    areEnemies(player1, player2) {
        return player1.teamId !== player2.teamId;
    }
    /**
     * Get all teammates of a player (excluding the player themselves)
     */
    getTeammates(player) {
        return this.players.filter(p => p !== player && p.teamId === player.teamId);
    }
    /**
     * Get all enemies of a player
     */
    getEnemies(player) {
        return this.players.filter(p => p.teamId !== player.teamId);
    }
    /**
     * Get all players on a specific team
     */
    getTeamPlayers(teamId) {
        return this.players.filter(p => p.teamId === teamId);
    }
}
exports.GameState = GameState;
/**
 * Create a standard game setup
 */
function createStandardGame(playerNames, spaceDustPalette) {
    const game = new GameState();
    // Add sun at center
    game.suns.push(new sun_1.Sun(new math_1.Vector2D(0, 0), 1.0, 100.0));
    // Create players with starting positions
    // For 2 players: bottom-left and top-right (diagonal)
    // For 4 players (2v2): all four corners (team 0 on one diagonal, team 1 on other)
    const rng = (0, seeded_random_1.getGameRNG)();
    let positions;
    let teamAssignments;
    if (playerNames.length === 2) {
        // Standard 1v1: bottom-left and top-right
        const bottomLeft = new math_1.Vector2D(-700, 700);
        const topRight = new math_1.Vector2D(700, -700);
        // Randomly decide player assignment
        const randomizePositions = rng.next() < 0.5;
        positions = randomizePositions
            ? [bottomLeft, topRight]
            : [topRight, bottomLeft];
        teamAssignments = [0, 0]; // Both assigned team 0 (team logic disabled for 1v1)
    }
    else if (playerNames.length >= 4) {
        // 2v2 game: Four corners
        // Team 0: top-left and bottom-right (one diagonal)
        // Team 1: top-right and bottom-left (other diagonal)
        const topLeft = new math_1.Vector2D(-700, -700);
        const topRight = new math_1.Vector2D(700, -700);
        const bottomLeft = new math_1.Vector2D(-700, 700);
        const bottomRight = new math_1.Vector2D(700, 700);
        // Randomly assign which team gets which diagonal
        const randomizeTeams = rng.next() < 0.5;
        if (randomizeTeams) {
            positions = [topLeft, bottomRight, topRight, bottomLeft];
            teamAssignments = [0, 0, 1, 1];
        }
        else {
            positions = [topRight, bottomLeft, topLeft, bottomRight];
            teamAssignments = [0, 0, 1, 1];
        }
    }
    else {
        // 3 players - treat as FFA with positions around a circle
        const bottomLeft = new math_1.Vector2D(-700, 700);
        const topRight = new math_1.Vector2D(700, -700);
        const top = new math_1.Vector2D(0, -700);
        positions = [bottomLeft, topRight, top];
        teamAssignments = [0, 1, 2]; // Each on own team
    }
    for (let i = 0; i < playerNames.length; i++) {
        if (i >= positions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new player_1.Player(name, faction);
        player.isAi = i !== 0;
        player.teamId = teamAssignments[i];
        // Assign random AI strategy for AI players
        if (player.isAi) {
            const strategies = [
                Constants.AIStrategy.ECONOMIC,
                Constants.AIStrategy.DEFENSIVE,
                Constants.AIStrategy.AGGRESSIVE,
                Constants.AIStrategy.WAVES
            ];
            player.aiStrategy = rng.choice(strategies);
        }
        const forgePos = positions[i];
        const mirrorSpawnDistance = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorPositions = [
            new math_1.Vector2D(forgePos.x - mirrorSpawnDistance, forgePos.y),
            new math_1.Vector2D(forgePos.x + mirrorSpawnDistance, forgePos.y)
        ];
        game.initializePlayer(player, forgePos, mirrorPositions);
        // Hero units (Marine and Grave) are no longer spawned automatically
        // They must be obtained through other game mechanics
        game.players.push(player);
    }
    // Update player name map after all players have been added
    game.updatePlayerNameMap();
    // Initialize default minion paths (each forge targets an enemy's spawn location)
    if (game.players.length >= 2) {
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            // Find an enemy player (different team in team games, or next player in 1v1)
            let enemyPlayer = null;
            if (game.players.length >= 3) {
                // Team game or FFA: target a player on a different team
                enemyPlayer = game.players.find(p => p !== player && p.teamId !== player.teamId) || null;
            }
            else {
                // 1v1: target the other player
                const enemyIndex = (i + 1) % game.players.length;
                enemyPlayer = game.players[enemyIndex];
            }
            if (player.stellarForge && enemyPlayer && enemyPlayer.stellarForge) {
                player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
            }
        }
    }
    // Initialize space dust particles
    game.initializeSpaceDust(Constants.SPACE_DUST_PARTICLE_COUNT, 2000, 2000, spaceDustPalette);
    // Create exclusion zones around stellar forge spawn positions
    const exclusionZones = game.players
        .filter(p => p.stellarForge)
        .map(p => ({
        position: p.stellarForge.position,
        radius: 250 // Exclusion zone radius around each base
    }));
    // Initialize random asteroids with exclusion zones
    game.initializeAsteroids(10, 2000, 2000, exclusionZones);
    // Add two large strategic asteroids that cast shadows on the bases
    // Position them close to the sun to cast shadows toward bottom-left and top-right
    // Bottom-left shadow: asteroid positioned at top-right of sun (angle ~-45 degrees or 315 degrees)
    const bottomLeftShadowAngle = -Math.PI / 4; // -45 degrees (top-right quadrant)
    const bottomLeftAsteroidPos = new math_1.Vector2D(Math.cos(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE, Math.sin(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE);
    game.asteroids.push(new asteroid_1.Asteroid(bottomLeftAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));
    // Top-right shadow: asteroid positioned at bottom-left of sun (angle ~135 degrees)
    const topRightShadowAngle = (3 * Math.PI) / 4; // 135 degrees (bottom-left quadrant)
    const topRightAsteroidPos = new math_1.Vector2D(Math.cos(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE, Math.sin(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE);
    game.asteroids.push(new asteroid_1.Asteroid(topRightAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));
    game.isRunning = true;
    return game;
}
