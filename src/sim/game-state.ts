/**
 * GameState - Main game state class containing the game loop and all game logic
 */

import { Vector2D, LightRay } from './math';
import * as Constants from '../constants';
import { NetworkManager, GameCommand, NetworkEvent, MessageType } from '../network';
import { GameCommand as P2PGameCommand } from '../transport';
import { getGameRNG } from '../seeded-random';
import { Player } from './entities/player';
import { Sun } from './entities/sun';
import { Asteroid } from './entities/asteroid';
import { SolarMirror } from './entities/solar-mirror';
import { StellarForge } from './entities/stellar-forge';
import { Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, CombatTarget } from './entities/buildings';
import { Unit } from './entities/unit';
import { Starling } from './entities/starling';
import { StarlingMergeGate } from './entities/starling-merge-gate';
import { WarpGate } from './entities/warp-gate';
import { DamageNumber } from './entities/damage-number';
import {
    SpaceDustParticle,
    SpaceDustPalette,
    ForgeCrunch,
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    AbilityBullet,
    MinionProjectile,
    LaserBeam,
    ImpactParticle,
    SparkleParticle,
    DeathParticle
} from './entities/particles';
import {
    Marine,
    Grave,
    GraveProjectile,
    GraveBlackHole,
    GraveSmallParticle,
    Ray,
    RayBeamSegment,
    InfluenceBall,
    InfluenceZone,
    InfluenceBallProjectile,
    TurretDeployer,
    DeployedTurret,
    Driller,
    Dagger,
    Beam,
    Mortar,
    MortarProjectile,
    Preist,
    HealingBombParticle,
    Spotlight,
    Tank,
    CrescentWave,
    Nova,
    NovaBomb,
    NovaScatterBullet,
    Sly,
    StickyBomb,
    StickyLaser,
    DisintegrationParticle
} from '../game-core';

import { Faction } from './entities/player';
export class GameState {
    players: Player[] = [];
    private playersByName: Map<string, Player> = new Map(); // For efficient P2P player lookup
    suns: Sun[] = [];
    spaceDust: SpaceDustParticle[] = [];
    warpGates: WarpGate[] = [];
    starlingMergeGates: StarlingMergeGate[] = [];
    starlingMergeGateExplosions: Vector2D[] = [];
    asteroids: Asteroid[] = [];
    muzzleFlashes: MuzzleFlash[] = [];
    bulletCasings: BulletCasing[] = [];
    bouncingBullets: BouncingBullet[] = [];
    abilityBullets: AbilityBullet[] = [];
    minionProjectiles: MinionProjectile[] = [];
    mortarProjectiles: InstanceType<typeof MortarProjectile>[] = [];
    laserBeams: LaserBeam[] = [];
    impactParticles: ImpactParticle[] = [];
    influenceZones: InstanceType<typeof InfluenceZone>[] = [];
    influenceBallProjectiles: InstanceType<typeof InfluenceBallProjectile>[] = [];
    deployedTurrets: InstanceType<typeof DeployedTurret>[] = [];
    damageNumbers: DamageNumber[] = [];
    crescentWaves: InstanceType<typeof CrescentWave>[] = [];
    novaBombs: InstanceType<typeof NovaBomb>[] = [];
    novaScatterBullets: InstanceType<typeof NovaScatterBullet>[] = [];
    stickyBombs: InstanceType<typeof StickyBomb>[] = [];
    stickyLasers: InstanceType<typeof StickyLaser>[] = [];
    disintegrationParticles: InstanceType<typeof DisintegrationParticle>[] = [];
    sparkleParticles: SparkleParticle[] = [];
    deathParticles: DeathParticle[] = [];
    strikerTowerExplosions: { position: Vector2D; timestamp: number }[] = []; // Track striker tower explosions for rendering
    gameTime: number = 0.0;
    stateHash: number = 0;
    stateHashTickCounter: number = 0;
    isRunning: boolean = false;
    countdownTime: number = Constants.COUNTDOWN_DURATION; // Countdown from 3 seconds
    isCountdownActive: boolean = true; // Start with countdown active
    mirrorsMovedToSun: boolean = false; // Track if mirrors have been moved
    mapSize: number = 2000; // Map size in world units
    damageDisplayMode: 'damage' | 'remaining-life' = 'damage'; // How to display damage numbers
    
    // Network support
    networkManager: NetworkManager | null = null; // Network manager for LAN/online play
    localPlayerIndex: number = 0; // Index of the local player (0 or 1)
    pendingCommands: GameCommand[] = []; // Commands from network to be processed

    // Collision resolution constants
    private readonly MAX_PUSH_DISTANCE = 10; // Maximum push distance for collision resolution
    private readonly PUSH_MULTIPLIER = 15; // Multiplier for push strength calculation
    private readonly dustSpatialHash: Map<number, number[]> = new Map();
    private readonly dustSpatialHashKeys: number[] = [];

    /**
     * Update game state
     */
    update(deltaTime: number): void {
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

        // Update asteroids
        for (const asteroid of this.asteroids) {
            asteroid.update(deltaTime);
        }

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
                const oldForgePos = new Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
                player.stellarForge.updateLightStatus(player.solarMirrors, this.suns, this.asteroids, this.players);
                
                // Only allow forge movement after countdown
                if (!this.isCountdownActive) {
                    player.stellarForge.update(deltaTime, this); // Update forge movement with gameState
                    
                    // Check collision for forge (larger radius)
                    if (this.checkCollision(player.stellarForge.position, player.stellarForge.radius, player.stellarForge)) {
                        // Revert to old position and stop movement
                        player.stellarForge.position = oldForgePos;
                        player.stellarForge.targetPosition = null;
                        player.stellarForge.velocity = new Vector2D(0, 0);
                    }

                    this.applyDustPushFromMovingEntity(
                        player.stellarForge.position,
                        player.stellarForge.velocity,
                        Constants.FORGE_DUST_PUSH_RADIUS_PX,
                        Constants.FORGE_DUST_PUSH_FORCE_MULTIPLIER,
                        this.getPlayerImpactColor(player),
                        deltaTime
                    );
                }
                
                // Check for forge crunch (spawns minions with excess energy)
                if (!this.isCountdownActive) {
                    const energyForMinions = player.stellarForge.shouldCrunch();
                    if (energyForMinions > 0) {
                        const currentStarlingCount = this.getStarlingCountForPlayer(player);
                        const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - currentStarlingCount);
                        // Calculate number of starlings to spawn based on energy
                        const numStarlings = Math.min(
                            Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY),
                            availableStarlingSlots
                        );
                        const unusedEnergy = energyForMinions - numStarlings * Constants.STARLING_COST_PER_ENERGY;
                        if (unusedEnergy > 0) {
                            player.stellarForge.addPendingEnergy(unusedEnergy);
                        }
                        
                        // Spawn starlings close to the forge
                        if (numStarlings > 0) {
                            for (let i = 0; i < numStarlings; i++) {
                                const angle = (Math.PI * 2 * i) / numStarlings; // Evenly distribute around forge
                                const spawnRadius = player.stellarForge.radius + Constants.STARLING_COLLISION_RADIUS_PX + 5;
                                const spawnPosition = new Vector2D(
                                    player.stellarForge.position.x + Math.cos(angle) * spawnRadius,
                                    player.stellarForge.position.y + Math.sin(angle) * spawnRadius
                                );
                                const starling = new Starling(spawnPosition, player, player.stellarForge?.minionPath ?? []);
                                player.units.push(starling);
                                player.unitsCreated++;
                            }
                            
                            console.log(`${player.name} forge crunch spawned ${numStarlings} Starlings with ${energyForMinions.toFixed(0)} energy`);
                        }
                    }
                }

                if (!this.isCountdownActive) {
                    const completedHeroType = player.stellarForge.advanceHeroProduction(deltaTime);
                    if (completedHeroType) {
                        const spawnRadius = player.stellarForge.radius + Constants.UNIT_RADIUS_PX + 5;
                        const spawnPosition = new Vector2D(
                            player.stellarForge.position.x,
                            player.stellarForge.position.y + spawnRadius
                        );
                        const heroUnit = this.createHeroUnit(completedHeroType, spawnPosition, player);
                        if (heroUnit) {
                            player.units.push(heroUnit);
                            player.unitsCreated++;
                            console.log(`${player.name} forged hero ${completedHeroType}`);
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
                const oldMirrorPos = new Vector2D(mirror.position.x, mirror.position.y);
                mirror.update(deltaTime, this); // Update mirror movement with gameState
                
                // Check collision for mirror
                if (this.checkCollision(mirror.position, 20, mirror)) {
                    // Revert to old position and stop movement
                    mirror.position = oldMirrorPos;
                    mirror.velocity = new Vector2D(0, 0);
                }

                this.applyDustPushFromMovingEntity(
                    mirror.position,
                    mirror.velocity,
                    Constants.MIRROR_DUST_PUSH_RADIUS_PX,
                    Constants.MIRROR_DUST_PUSH_FORCE_MULTIPLIER,
                    this.getPlayerImpactColor(player),
                    deltaTime
                );
                
                if (mirror.linkedStructure instanceof Building && mirror.linkedStructure.isDestroyed()) {
                    mirror.setLinkedStructure(null);
                }
                if (mirror.linkedStructure instanceof StellarForge && mirror.linkedStructure !== player.stellarForge) {
                    mirror.setLinkedStructure(null);
                }

                const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
                mirror.updateReflectionAngle(linkedStructure, this.suns, this.asteroids, deltaTime);
                
                // Generate energy and apply to linked structure
                if (mirror.hasLineOfSightToLight(this.suns, this.asteroids) && linkedStructure) {
                    const energyGenerated = mirror.generateEnergy(deltaTime);
                    
                    if (linkedStructure instanceof StellarForge &&
                        player.stellarForge &&
                        mirror.hasLineOfSightToForge(player.stellarForge, this.asteroids, this.players)) {
                        // Add to player's energy for building/heroes AND to forge's pending energy pool for starling spawns
                        player.addEnergy(energyGenerated);
                        player.stellarForge.addPendingEnergy(energyGenerated);
                    } else if (linkedStructure instanceof Building &&
                               mirror.hasLineOfSightToStructure(linkedStructure, this.asteroids, this.players)) {
                        linkedStructure.isReceivingLight = true;
                        linkedStructure.incomingLightPerSec += mirror.getEnergyRatePerSec();
                        // Provide energy to building being constructed
                        if (!linkedStructure.isComplete) {
                            linkedStructure.addEnergy(energyGenerated);
                        }
                    } else if (linkedStructure instanceof WarpGate &&
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
                        mirror.health = Math.min(
                            Constants.MIRROR_MAX_HEALTH,
                            mirror.health + Constants.MIRROR_REGEN_PER_SEC * deltaTime
                        );
                        
                        // Spawn sparkle particles for regeneration visual effect
                        // Spawn ~2-3 particles per second
                        const rng = getGameRNG();
                        if (rng.next() < deltaTime * 2.5) {
                            const angle = rng.nextAngle();
                            const distance = rng.nextFloat(0, 25);
                            const sparklePos = new Vector2D(
                                mirror.position.x + Math.cos(angle) * distance,
                                mirror.position.y + Math.sin(angle) * distance
                            );
                            const velocity = new Vector2D(
                                rng.nextFloat(-15, 15),
                                rng.nextFloat(-15, 15) - 20 // Slight upward bias
                            );
                            // Use player's color for sparkles
                            const playerColor = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                            this.sparkleParticles.push(new SparkleParticle(
                                sparklePos,
                                velocity,
                                0.8, // lifetime in seconds
                                playerColor,
                                rng.nextFloat(2, 4) // size 2-4
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
        const allUnits: Unit[] = [];
        const allStructures: CombatTarget[] = [];
        
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
            if (player.isDefeated()) continue;

            // Get enemies (units and structures not owned by this player)
            const enemies: CombatTarget[] = [];
            for (const otherPlayer of this.players) {
                if (otherPlayer !== player && !otherPlayer.isDefeated()) {
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
            }

            // Update each unit (only after countdown)
            if (!this.isCountdownActive) {
                for (const unit of player.units) {
                    // Starlings need special AI update before regular update
                    if (unit instanceof Starling) {
                        unit.updateAI(this, enemies);
                    }
                    
                    unit.update(deltaTime, enemies, allUnits, this.asteroids);

                    // Apply shield blocking from enemy ShieldTowers
                    for (const enemyPlayer of this.players) {
                        if (enemyPlayer !== unit.owner) {
                            for (const building of enemyPlayer.buildings) {
                                if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
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
                                        } else {
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
                    }

                    if (unit instanceof Starling) {
                        this.applyDustPushFromMovingEntity(
                            unit.position,
                            unit.velocity,
                            Constants.STARLING_DUST_PUSH_RADIUS_PX,
                            Constants.STARLING_DUST_PUSH_FORCE_MULTIPLIER,
                            this.getPlayerImpactColor(unit.owner),
                            deltaTime
                        );
                    }
                    
                    // Apply fluid forces from Grave projectiles
                    if (unit instanceof Grave) {
                        for (const projectile of unit.getProjectiles()) {
                            if (projectile.isAttacking) {
                                // Attacking projectiles push dust as they fly
                                const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
                                this.applyFluidForceFromMovingObject(
                                    projectile.position,
                                    projectile.velocity,
                                    Constants.GRAVE_PROJECTILE_EFFECT_RADIUS,
                                    projectileSpeed * Constants.GRAVE_PROJECTILE_FORCE_MULTIPLIER,
                                    this.getPlayerImpactColor(unit.owner),
                                    deltaTime
                                );
                            }
                        }
                    }

                // If unit is a Marine, collect its effects
                if (unit instanceof Marine) {
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

                // Collect ability effects from all units
                const abilityEffects = unit.getAndClearLastAbilityEffects();
                this.abilityBullets.push(...abilityEffects);

                if (unit instanceof Starling) {
                    const lasers = unit.getAndClearLastShotLasers();
                    if (lasers.length > 0) {
                        this.laserBeams.push(...lasers);
                        
                        // Spawn impact particles at laser endpoints
                        for (const laser of lasers) {
                            for (let i = 0; i < Constants.STARLING_LASER_IMPACT_PARTICLES; i++) {
                                const angle = (Math.PI * 2 * i) / Constants.STARLING_LASER_IMPACT_PARTICLES;
                                const velocity = new Vector2D(
                                    Math.cos(angle) * Constants.STARLING_LASER_PARTICLE_SPEED,
                                    Math.sin(angle) * Constants.STARLING_LASER_PARTICLE_SPEED
                                );
                                this.impactParticles.push(new ImpactParticle(
                                    new Vector2D(laser.endPos.x, laser.endPos.y),
                                    velocity,
                                    Constants.STARLING_LASER_PARTICLE_LIFETIME,
                                    laser.owner.faction
                                ));
                            }
                        }
                    }
                }
                
                // Handle InfluenceBall projectiles specifically
                if (unit instanceof InfluenceBall) {
                    const projectile = unit.getAndClearProjectile();
                    if (projectile) {
                        this.influenceBallProjectiles.push(projectile);
                    }
                }
                
                // Handle Mortar projectiles
                if (unit instanceof Mortar) {
                    const projectiles = unit.getAndClearLastShotProjectiles();
                    if (projectiles.length > 0) {
                        this.mortarProjectiles.push(...projectiles);
                    }
                }
                
                // Handle Tank crescent wave
                if (unit instanceof Tank) {
                    const wave = unit.getCrescentWave();
                    if (wave && !this.crescentWaves.includes(wave)) {
                        this.crescentWaves.push(wave);
                    }
                }
                
                // Handle Nova bomb
                if (unit instanceof Nova) {
                    const bomb = unit.getAndClearBomb();
                    if (bomb) {
                        this.novaBombs.push(bomb);
                    }
                }
                
                // Handle Sly sticky bomb and lasers
                if (unit instanceof Sly) {
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
                
                // Handle Ray beam updates
                if (unit instanceof Ray) {
                    unit.updateBeamSegments(deltaTime);
                    
                    // Apply fluid forces from active beam segments
                    for (const segment of unit.getBeamSegments()) {
                        this.applyFluidForceFromBeam(
                            segment.startPos,
                            segment.endPos,
                            Constants.BEAM_EFFECT_RADIUS,
                            Constants.BEAM_FORCE_STRENGTH,
                            this.getPlayerImpactColor(unit.owner),
                            deltaTime
                        );
                    }
                    
                    // Process Ray ability if just used (check if cooldown is near max)
                    if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1 && unit.drillDirection) {
                        this.processRayBeamAbility(unit);
                        unit.drillDirection = null; // Clear after processing
                    }
                }
                
                // Handle TurretDeployer ability
                if (unit instanceof TurretDeployer) {
                    // Check if ability was just used (check if cooldown is near max)
                    if (unit.abilityCooldown > unit.abilityCooldownTime - 0.1) {
                        this.processTurretDeployment(unit);
                    }
                }

                // Handle Spotlight ability updates and firing
                if (unit instanceof Spotlight) {
                    this.updateSpotlightAbility(unit, enemies, deltaTime);
                }
                
                // Handle Driller movement and collision
                if (unit instanceof Driller && unit.isDrilling) {
                    unit.updateDrilling(deltaTime);
                    this.processDrillerCollisions(unit, deltaTime);
                }
                
                // Handle Dagger timers
                if (unit instanceof Dagger) {
                    unit.updateTimers(deltaTime);
                }
                
                // Handle Grave projectile absorption
                if (unit instanceof Grave) {
                    for (const projectile of unit.getProjectiles()) {
                        if (projectile.isAttacking) {
                            // Check for absorption by Space Dust Swirler buildings
                            let wasAbsorbed = false;
                            for (const player of this.players) {
                                for (const building of player.buildings) {
                                    if (building instanceof SpaceDustSwirler) {
                                        // Don't absorb friendly projectiles
                                        if (building.owner === projectile.owner) continue;
                                        
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
                                if (wasAbsorbed) break;
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
                    if (building instanceof StrikerTower && building.targetPosition && building.countdownTimer <= 0.001 && building.isMissileReady()) {
                        // Countdown complete, fire the missile!
                        const targetPos = building.targetPosition;
                        const fired = building.fireMissile(
                            targetPos,
                            enemies,
                            (pos) => this.isPointInShadow(pos),
                            (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits),
                            player.units
                        );
                        
                        // Track explosion for visual effect and trigger screen shake
                        if (fired) {
                            this.strikerTowerExplosions.push({
                                position: targetPos, // Use existing Vector2D directly
                                timestamp: this.gameTime
                            });
                        }
                    }

                // If building is a Cannon or Gatling Tower, collect its effects
                if (building instanceof Minigun || building instanceof GatlingTower) {
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

                if (building instanceof Minigun || building instanceof LockOnLaserTower) {
                    const lasers = building.getAndClearLastShotLasers();
                    if (lasers.length > 0) {
                        this.laserBeams.push(...lasers);
                    }
                }
                
                // If building is a Foundry, check for completed production
                if (building instanceof SubsidiaryFactory) {
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
                    } else if (completedProduction === Constants.FOUNDRY_REGEN_UPGRADE_ITEM) {
                        building.upgradeRegen();
                    } else if (completedProduction === Constants.FOUNDRY_ATTACK_UPGRADE_ITEM) {
                        building.upgradeAttack();
                    } else if (completedProduction === Constants.FOUNDRY_BLINK_UPGRADE_ITEM) {
                        building.upgradeBlink();
                    }
                }
            }
            } // End of countdown check for buildings

            // Update building construction (only after countdown)
            if (!this.isCountdownActive) {
                for (const building of player.buildings) {
                    if (building.isComplete) continue; // Skip completed buildings
                
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
                } else {
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
                    const direction = new Vector2D(
                        particle.position.x - casing.position.x,
                        particle.position.y - casing.position.y
                    ).normalize();
                    
                    particle.applyForce(new Vector2D(
                        direction.x * Constants.CASING_SPACEDUST_FORCE,
                        direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));
                    
                    // Apply counter-force to casing (damping applied in applyCollision method)
                    casing.applyCollision(new Vector2D(
                        -direction.x * Constants.CASING_SPACEDUST_FORCE,
                        -direction.y * Constants.CASING_SPACEDUST_FORCE
                    ));
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
                    if (unit instanceof Tank && unit.isPositionInShield(bullet.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (bullet.owner !== player) {
                            isBlocked = true;
                            bullet.lifetime = bullet.maxLifetime; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked) break;
            }
            if (isBlocked) continue;
            
            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
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
                if (blockedByShield) break;
            }
            if (blockedByShield) continue;
            
            // Check if healing bomb reached max range or lifetime - if so, explode
            if (bullet.isHealingBomb && bullet.healingBombOwner && bullet.shouldDespawn()) {
                bullet.healingBombOwner.explodeHealingBomb(bullet.position);
            }
            
            // Apply fluid-like force to space dust particles
            const bulletSpeed = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                bullet.position,
                bullet.velocity,
                Constants.ABILITY_BULLET_EFFECT_RADIUS,
                bulletSpeed * Constants.ABILITY_BULLET_FORCE_MULTIPLIER,
                this.getPlayerImpactColor(bullet.owner),
                deltaTime
            );

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
                        this.addDamageNumber(
                            unit.position,
                            finalDamage,
                            unit.maxHealth,
                            unit.health,
                            unitKey
                        );
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
                        mirror.health -= bullet.damage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        this.addDamageNumber(
                            mirror.position,
                            bullet.damage,
                            Constants.MIRROR_MAX_HEALTH,
                            mirror.health,
                            mirrorKey
                        );
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
                        this.addDamageNumber(
                            gate.position,
                            bullet.damage,
                            gate.maxHealth,
                            gate.health,
                            gateKey
                        );
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
                    this.addDamageNumber(
                        player.stellarForge.position,
                        finalDamage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey
                    );
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
                const allEnemyTargets: CombatTarget[] = [];
                
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
                    
                    if (target instanceof Unit) {
                        const unitKey = `unit_${target.position.x}_${target.position.y}_${target.owner.name}`;
                        this.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            unitKey
                        );
                    } else if ('isBuilding' in target && target.isBuilding) {
                        const buildingKey = `building_${target.position.x}_${target.position.y}`;
                        this.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            buildingKey
                        );
                    } else if ('isForge' in target && target.isForge) {
                        const forgeKey = `forge_${target.position.x}_${target.position.y}`;
                        this.addDamageNumber(
                            target.position,
                            finalDamage,
                            target.maxHealth,
                            target.health,
                            forgeKey
                        );
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
                    if (unit instanceof Tank && unit.isPositionInShield(projectile.position)) {
                        // Shield blocks projectiles but not friendly fire
                        if (projectile.owner !== player) {
                            isBlocked = true;
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            break;
                        }
                    }
                }
                if (isBlocked) break;
            }
            if (isBlocked) continue;
            
            // Check if projectile is blocked by ShieldTower shields
            let blockedByShield = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof ShieldTower && building.shieldActive && building.isComplete) {
                        // Shield blocks enemy projectiles but not friendly fire
                        if (projectile.owner !== player && building.isEnemyBlocked(projectile.position)) {
                            // Damage the shield instead of letting projectile through
                            const projectileDamage = 'damage' in projectile ? (projectile.damage as number) : Constants.DEFAULT_PROJECTILE_DAMAGE;
                            building.damageShield(projectileDamage);
                            projectile.distanceTraveledPx = projectile.maxRangePx; // Mark for removal
                            blockedByShield = true;
                            break;
                        }
                    }
                }
                if (blockedByShield) break;
            }
            if (blockedByShield) continue;
            
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                projectile.position,
                projectile.velocity,
                Constants.MINION_PROJECTILE_EFFECT_RADIUS,
                projectileSpeed * Constants.MINION_PROJECTILE_FORCE_MULTIPLIER,
                this.getPlayerImpactColor(projectile.owner),
                deltaTime
            );

            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner) continue;
                        
                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting distance to max
                            projectile.distanceTraveledPx = projectile.maxRangePx;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed) break;
            }
            if (wasAbsorbed) continue;

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
                        this.addDamageNumber(
                            unit.position,
                            projectile.damage,
                            unit.maxHealth,
                            unit.health,
                            unitKey
                        );
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
                        mirror.health -= projectile.damage;
                        const mirrorKey = `mirror_${mirror.position.x}_${mirror.position.y}_${player.name}`;
                        this.addDamageNumber(
                            mirror.position,
                            projectile.damage,
                            Constants.MIRROR_MAX_HEALTH,
                            mirror.health,
                            mirrorKey
                        );
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
                        this.addDamageNumber(
                            gate.position,
                            projectile.damage,
                            gate.maxHealth,
                            gate.health,
                            gateKey
                        );
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
                        this.addDamageNumber(
                            building.position,
                            projectile.damage,
                            building.maxHealth,
                            building.health,
                            buildingKey
                        );
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
                    this.addDamageNumber(
                        player.stellarForge.position,
                        projectile.damage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey
                    );
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
        this.strikerTowerExplosions = this.strikerTowerExplosions.filter(
            explosion => this.gameTime - explosion.timestamp < 1.0
        );
        
        // Update influence zones
        this.influenceZones = this.influenceZones.filter(zone => !zone.update(deltaTime));
        
        // Update influence ball projectiles
        for (const projectile of this.influenceBallProjectiles) {
            projectile.update(deltaTime);
            
            // Apply fluid-like force to space dust particles
            const projectileSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            this.applyFluidForceFromMovingObject(
                projectile.position,
                projectile.velocity,
                Constants.INFLUENCE_BALL_EFFECT_RADIUS,
                projectileSpeed * Constants.INFLUENCE_BALL_FORCE_MULTIPLIER,
                this.getPlayerImpactColor(projectile.owner),
                deltaTime
            );

            // Check for absorption by Space Dust Swirler buildings
            let wasAbsorbed = false;
            for (const player of this.players) {
                for (const building of player.buildings) {
                    if (building instanceof SpaceDustSwirler) {
                        // Don't absorb friendly projectiles
                        if (building.owner === projectile.owner) continue;
                        
                        if (building.absorbProjectile(projectile)) {
                            // Mark projectile for removal by setting lifetime to max
                            projectile.lifetime = projectile.maxLifetime;
                            wasAbsorbed = true;
                            break;
                        }
                    }
                }
                if (wasAbsorbed) break;
            }
            if (wasAbsorbed) continue;
            
            // Check if should explode (max lifetime reached)
            if (projectile.shouldExplode()) {
                // Create influence zone
                const zone = new InfluenceZone(
                    new Vector2D(projectile.position.x, projectile.position.y),
                    projectile.owner
                );
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
            } else if (bomb.position.x >= boundary) {
                bomb.bounce(-1, 0); // Bounce off right edge
                bomb.position.x = boundary;
            }
            if (bomb.position.y <= -boundary) {
                bomb.bounce(0, 1); // Bounce off top edge
                bomb.position.y = -boundary;
            } else if (bomb.position.y >= boundary) {
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
                        
                        const velocity = new Vector2D(
                            Math.cos(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED,
                            Math.sin(angle) * Constants.NOVA_BOMB_SCATTER_BULLET_SPEED
                        );
                        
                        this.novaScatterBullets.push(
                            new NovaScatterBullet(
                                new Vector2D(bomb.position.x, bomb.position.y),
                                velocity,
                                bomb.owner
                            )
                        );
                    }
                    
                    // Apply explosion damage to nearby enemies
                    for (const player of this.players) {
                        if (player === bomb.owner) continue;
                        
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
                if (player === bullet.owner) continue;
                
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
                            const normal = new Vector2D(dx / dist, dy / dist);
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
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, building);
                                }
                                break;
                            }
                        }
                        
                        if (bomb.isStuck) break;
                        
                        // Check solar mirrors
                        for (const mirror of player.solarMirrors) {
                            const distance = bomb.position.distanceTo(mirror.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - mirror.position.x;
                                const dy = bomb.position.y - mirror.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, mirror);
                                }
                                break;
                            }
                        }
                        
                        if (bomb.isStuck) break;
                        
                        // Check stellar forge
                        if (player.stellarForge) {
                            const distance = bomb.position.distanceTo(player.stellarForge.position);
                            if (distance < Constants.STICKY_BOMB_STICK_DISTANCE) {
                                const dx = bomb.position.x - player.stellarForge.position.x;
                                const dy = bomb.position.y - player.stellarForge.position.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    const normal = new Vector2D(dx / dist, dy / dist);
                                    bomb.stickToSurface('structure', normal, player.stellarForge);
                                }
                                break;
                            }
                        }
                        
                        if (bomb.isStuck) break;
                    }
                }
                
                // Check for sticking to map edges (playing field boundary)
                if (!bomb.isStuck) {
                    const boundary = Constants.MAP_PLAYABLE_BOUNDARY;
                    const edgeThreshold = Constants.STICKY_BOMB_STICK_DISTANCE;
                    
                    if (bomb.position.x <= -boundary + edgeThreshold) {
                        // Stick to left edge
                        bomb.stickToSurface('edge', new Vector2D(1, 0));
                        bomb.position.x = -boundary + Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.x >= boundary - edgeThreshold) {
                        // Stick to right edge
                        bomb.stickToSurface('edge', new Vector2D(-1, 0));
                        bomb.position.x = boundary - Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.y <= -boundary + edgeThreshold) {
                        // Stick to top edge
                        bomb.stickToSurface('edge', new Vector2D(0, 1));
                        bomb.position.y = -boundary + Constants.STICKY_BOMB_RADIUS;
                    } else if (bomb.position.y >= boundary - edgeThreshold) {
                        // Stick to bottom edge
                        bomb.stickToSurface('edge', new Vector2D(0, -1));
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
                if (player === laser.owner) continue;
                
                // Check units
                for (const unit of player.units) {
                    if (laser.checkHit(unit)) {
                        unit.health -= laser.damage;
                        this.damageNumbers.push(new DamageNumber(
                            unit.position,
                            laser.damage,
                            this.gameTime
                        ));
                    }
                }
                
                // Check buildings
                for (const building of player.buildings) {
                    if (laser.checkHit(building)) {
                        building.health -= laser.damage;
                        this.damageNumbers.push(new DamageNumber(
                            building.position,
                            laser.damage,
                            this.gameTime
                        ));
                    }
                }
                
                // Check solar mirrors
                for (const mirror of player.solarMirrors) {
                    if (laser.checkHit(mirror)) {
                        mirror.health -= laser.damage;
                        this.damageNumbers.push(new DamageNumber(
                            mirror.position,
                            laser.damage,
                            this.gameTime
                        ));
                    }
                }
                
                // Check stellar forge
                if (player.stellarForge && laser.checkHit(player.stellarForge)) {
                    player.stellarForge.health -= laser.damage;
                    this.damageNumbers.push(new DamageNumber(
                        player.stellarForge.position,
                        laser.damage,
                        this.gameTime
                    ));
                }
            }
        }
        this.stickyLasers = this.stickyLasers.filter(laser => !laser.shouldDespawn());
        
        // Update disintegration particles
        for (const particle of this.disintegrationParticles) {
            particle.update(deltaTime);
        }
        this.disintegrationParticles = this.disintegrationParticles.filter(particle => !particle.shouldDespawn());
        
        // Update deployed turrets
        const allUnitsAndStructures: CombatTarget[] = [];
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
    private updateSpaceDust(deltaTime: number): void {
        this.applyDustRepulsion(deltaTime);

        for (const particle of this.spaceDust) {
            // Update particle position
            particle.update(deltaTime);

            // Check for influence from player bases
            let closestInfluence: { color: string, distance: number } | null = null;

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
            } else {
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
                        const direction = new Vector2D(
                            gate.position.x - particle.position.x,
                            gate.position.y - particle.position.y
                        ).normalize();
                        
                        // Add tangential component for spiral
                        const tangent = new Vector2D(-direction.y, direction.x);
                        const force = new Vector2D(
                            direction.x * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.x * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT,
                            direction.y * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + tangent.y * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT
                        );
                        
                        particle.applyForce(new Vector2D(
                            force.x * deltaTime / distance,
                            force.y * deltaTime / distance
                        ));
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
                                const direction = new Vector2D(
                                    crunch.position.x - particle.position.x,
                                    crunch.position.y - particle.position.y
                                ).normalize();
                                
                                // Force decreases with distance
                                const forceMagnitude = Constants.FORGE_CRUNCH_SUCK_FORCE / Math.sqrt(distance);
                                particle.applyForce(new Vector2D(
                                    direction.x * forceMagnitude * deltaTime,
                                    direction.y * forceMagnitude * deltaTime
                                ));
                            }
                        } else if (crunch.phase === 'wave' && distance < Constants.FORGE_CRUNCH_WAVE_RADIUS) {
                            // Wave phase: push dust away from forge
                            if (distance > 5) { // Minimum distance to avoid division by zero
                                const direction = new Vector2D(
                                    particle.position.x - crunch.position.x,
                                    particle.position.y - crunch.position.y
                                ).normalize();
                                
                                // Wave effect: stronger push at the wavefront
                                const waveProgress = crunch.getPhaseProgress();
                                const wavePosition = waveProgress * Constants.FORGE_CRUNCH_WAVE_RADIUS;
                                const distanceToWave = Math.abs(distance - wavePosition);
                                const waveSharpness = 50; // How focused the wave is
                                const waveStrength = Math.exp(-distanceToWave / waveSharpness);
                                
                                const forceMagnitude = Constants.FORGE_CRUNCH_WAVE_FORCE * waveStrength;
                                particle.applyForce(new Vector2D(
                                    direction.x * forceMagnitude * deltaTime,
                                    direction.y * forceMagnitude * deltaTime
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Apply forces from Space Dust Swirler buildings (counter-clockwise orbits)
        for (const player of this.players) {
            for (const building of player.buildings) {
                if (building instanceof SpaceDustSwirler) {
                    building.applyDustSwirl(this.spaceDust, deltaTime);
                }
            }
        }
    }

    private applyDustRepulsion(deltaTime: number): void {
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

    private updateAi(deltaTime: number): void {
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

    private updateStarlingMergeGatesForPlayer(player: Player, deltaTime: number): void {
        for (let gateIndex = this.starlingMergeGates.length - 1; gateIndex >= 0; gateIndex--) {
            const gate = this.starlingMergeGates[gateIndex];
            if (gate.owner !== player) {
                continue;
            }

            if (gate.health <= 0) {
                this.releaseStarlingMergeGate(gate, player);
                this.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
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
                    this.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
                    player.solarMirrors.push(new SolarMirror(new Vector2D(gate.position.x, gate.position.y), player));
                } else {
                    this.releaseStarlingMergeGate(gate, player);
                    this.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
                }
                this.starlingMergeGates.splice(gateIndex, 1);
            }
        }
    }

    private processStarlingSacrificesForPlayer(player: Player): void {
        const energyBoost = Constants.STARLING_COST_PER_ENERGY * Constants.STARLING_SACRIFICE_ENERGY_MULTIPLIER;
        if (energyBoost <= 0) {
            return;
        }

        for (const building of player.buildings) {
            if (!(building instanceof SubsidiaryFactory)) {
                continue;
            }
            if (!building.isComplete || !building.currentProduction) {
                continue;
            }

            for (const unit of player.units) {
                if (!(unit instanceof Starling) || unit.isDead()) {
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

    private releaseStarlingMergeGate(gate: StarlingMergeGate, player: Player): void {
        const releaseCount = gate.absorbedCount;
        if (releaseCount > 0) {
            const currentStarlingCount = this.getStarlingCountForPlayer(player);
            const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - currentStarlingCount);
            const starlingSpawnCount = Math.min(releaseCount, availableStarlingSlots);
            const spawnRadius = Constants.STARLING_MERGE_GATE_RADIUS_PX + Constants.STARLING_COLLISION_RADIUS_PX + 4;
            for (let i = 0; i < starlingSpawnCount; i++) {
                const angle = (Math.PI * 2 * i) / starlingSpawnCount;
                const spawnPosition = new Vector2D(
                    gate.position.x + Math.cos(angle) * spawnRadius,
                    gate.position.y + Math.sin(angle) * spawnRadius
                );
                const starling = new Starling(spawnPosition, player, player.stellarForge?.minionPath ?? []);
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

    private getEnemiesForPlayer(player: Player): CombatTarget[] {
        const enemies: CombatTarget[] = [];
        for (const otherPlayer of this.players) {
            if (otherPlayer !== player && !otherPlayer.isDefeated()) {
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
        }
        return enemies;
    }

    private getStarlingCountForPlayer(player: Player): number {
        let count = 0;
        for (const unit of player.units) {
            if (unit instanceof Starling) {
                count += 1;
            }
        }
        return count;
    }

    private updateAiMirrorsForPlayer(player: Player): void {
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
        let radiusFromSun: number;
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
        const baseAngleRad = Math.atan2(
            player.stellarForge.position.y - sun.position.y,
            player.stellarForge.position.x - sun.position.x
        );
        const startAngleRad = baseAngleRad - (Constants.AI_MIRROR_ARC_SPACING_RAD * (mirrorCount - 1)) / 2;

        for (let i = 0; i < mirrorCount; i++) {
            const mirror = player.solarMirrors[i];
            const angleRad = startAngleRad + Constants.AI_MIRROR_ARC_SPACING_RAD * i;
            
            // Try to find a valid position for the mirror
            const target = this.findValidMirrorPosition(
                sun,
                angleRad,
                radiusFromSun,
                player.stellarForge
            );
            
            if (target) {
                const distance = mirror.position.distanceTo(target);
                if (distance > Constants.AI_MIRROR_REPOSITION_THRESHOLD_PX) {
                    mirror.setTarget(target);
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
    private findValidMirrorPosition(
        sun: Sun,
        preferredAngle: number,
        preferredRadius: number,
        stellarForge: StellarForge
    ): Vector2D | null {
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
                
                const candidate = new Vector2D(
                    sun.position.x + Math.cos(angle) * radius,
                    sun.position.y + Math.sin(angle) * radius
                );
                
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
    private hasLineOfSight(from: Vector2D, to: Vector2D, objectRadius: number = 0): boolean {
        const direction = new Vector2D(
            to.x - from.x,
            to.y - from.y
        ).normalize();
        
        const ray = new LightRay(from, direction);
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
    private isGuardEligible(unit: Unit): boolean {
        return unit.isHero || unit instanceof Starling;
    }

    /**
     * Position defensive units near mirrors for hard difficulty AI
     */
    private positionGuardsNearMirrors(player: Player): void {
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
                    if (guardsAssigned >= maxGuards) break;
                    
                    // Assign starlings or hero units to guard
                    if (this.isGuardEligible(unit)) {
                        // Check if unit is far from mirror (to avoid reassigning guards constantly)
                        const distance = unit.position.distanceTo(mirror.position);
                        if (distance > guardRadius * 3) {
                            // Set rally point near mirror
                            const guardPos = new Vector2D(
                                mirror.position.x,
                                mirror.position.y
                            );
                            
                            if (unit.isHero) {
                                unit.rallyPoint = guardPos;
                            } else if (unit instanceof Starling) {
                                unit.setManualRallyPoint(guardPos);
                            }
                            guardsAssigned++;
                        }
                    }
                }
            }
        }
    }

    private updateAiMirrorPurchaseForPlayer(player: Player): void {
        return;
    }

    private updateAiDefenseForPlayer(
        player: Player,
        enemies: CombatTarget[]
    ): void {
        if (this.gameTime < player.aiNextDefenseCommandSec) {
            return;
        }
        player.aiNextDefenseCommandSec = this.gameTime + Constants.AI_DEFENSE_COMMAND_INTERVAL_SEC;

        const threat = this.findAiThreat(player, enemies);

        if (threat) {
            const threatPosition = threat.enemy.position;
            for (const unit of player.units) {
                if (unit.isHero) {
                    unit.rallyPoint = new Vector2D(threatPosition.x, threatPosition.y);
                } else if (unit instanceof Starling) {
                    unit.setManualRallyPoint(new Vector2D(threatPosition.x, threatPosition.y));
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
                        if (unit.isHero || unit instanceof Starling) {
                            unit.rallyPoint = new Vector2D(enemyForge.position.x, enemyForge.position.y);
                            if (unit instanceof Starling) {
                                unit.setManualRallyPoint(new Vector2D(enemyForge.position.x, enemyForge.position.y));
                            }
                        }
                    }
                    return;
                }
            } else {
                // Accumulate at base
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new Vector2D(
                            player.stellarForge.position.x,
                            player.stellarForge.position.y
                        );
                    } else if (unit instanceof Starling) {
                        unit.setManualRallyPoint(new Vector2D(
                            player.stellarForge.position.x,
                            player.stellarForge.position.y
                        ));
                    }
                }
                return;
            }
        } else if (player.aiStrategy === Constants.AIStrategy.AGGRESSIVE) {
            // Aggressive strategy: Always push to enemy base
            const enemyForge = this.getEnemyForgeForPlayer(player);
            if (enemyForge) {
                for (const unit of player.units) {
                    if (unit.isHero) {
                        unit.rallyPoint = new Vector2D(enemyForge.position.x, enemyForge.position.y);
                    } else if (unit instanceof Starling) {
                        unit.setManualRallyPoint(new Vector2D(enemyForge.position.x, enemyForge.position.y));
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
                unit.rallyPoint = new Vector2D(
                    player.stellarForge.position.x,
                    player.stellarForge.position.y
                );
            } else if (unit instanceof Starling) {
                if (mirrorIndex < mirrorCount) {
                    const mirror = player.solarMirrors[mirrorIndex];
                    unit.setManualRallyPoint(new Vector2D(mirror.position.x, mirror.position.y));
                    mirrorIndex += 1;
                } else {
                    unit.setManualRallyPoint(new Vector2D(
                        player.stellarForge.position.x,
                        player.stellarForge.position.y
                    ));
                }
            }
        }
    }
    
    private getEnemyForgeForPlayer(player: Player): StellarForge | null {
        for (const otherPlayer of this.players) {
            if (otherPlayer !== player && !otherPlayer.isDefeated() && otherPlayer.stellarForge) {
                return otherPlayer.stellarForge;
            }
        }
        return null;
    }

    private updateAiHeroProductionForPlayer(player: Player): void {
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
            if (!player.spendEnergy(Constants.HERO_UNIT_COST)) {
                return;
            }
            player.stellarForge.enqueueHeroUnit(heroType);
            player.stellarForge.startHeroProductionIfIdle();
            return;
        }
    }

    private updateAiStructuresForPlayer(
        player: Player,
        enemies: CombatTarget[]
    ): void {
        if (this.gameTime < player.aiNextStructureCommandSec) {
            return;
        }
        player.aiNextStructureCommandSec = this.gameTime + Constants.AI_STRUCTURE_COMMAND_INTERVAL_SEC;

        if (!player.stellarForge) {
            return;
        }

        const minigunCount = player.buildings.filter((building) => building instanceof Minigun).length;
        const swirlerCount = player.buildings.filter((building) => building instanceof SpaceDustSwirler).length;
        const hasSubsidiaryFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);

        let buildType: 'minigun' | 'swirler' | 'subsidiaryFactory' | null = null;
        
        // Strategy-based building priorities
        // Note: Radiant-specific buildings (minigun, swirler) are only available to Radiant faction
        const canBuildRadiantStructures = player.faction === Faction.RADIANT;
        
        switch (player.aiStrategy) {
            case Constants.AIStrategy.ECONOMIC:
                // Economic: Build factory first, then minimal defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                }
                break;
                
            case Constants.AIStrategy.DEFENSIVE:
                // Defensive: Prioritize defenses heavily
                if (canBuildRadiantStructures && swirlerCount < 2 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 5 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.AGGRESSIVE:
                // Aggressive: Build factory early, skip most defenses
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 1 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                }
                break;
                
            case Constants.AIStrategy.WAVES:
                // Waves: Balanced approach with factory priority
                if (!hasSubsidiaryFactory && player.energy >= Constants.SUBSIDIARY_FACTORY_COST) {
                    buildType = 'subsidiaryFactory';
                } else if (canBuildRadiantStructures && minigunCount < 2 && player.energy >= Constants.MINIGUN_COST) {
                    buildType = 'minigun';
                } else if (canBuildRadiantStructures && swirlerCount < 1 && player.energy >= Constants.SWIRLER_COST) {
                    buildType = 'swirler';
                } else if (canBuildRadiantStructures && minigunCount < 3 && player.energy >= Constants.MINIGUN_COST) {
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

        let placement: Vector2D | null = null;

        switch (buildType) {
            case 'subsidiaryFactory':
                placement = this.findAiStructurePlacement(anchor, Constants.SUBSIDIARY_FACTORY_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                    player.buildings.push(new SubsidiaryFactory(placement, player));
                }
                break;
            case 'swirler':
                placement = this.findAiStructurePlacement(anchor, Constants.SWIRLER_RADIUS, player);
                if (placement && player.spendEnergy(Constants.SWIRLER_COST)) {
                    player.buildings.push(new SpaceDustSwirler(placement, player));
                }
                break;
            case 'minigun':
                placement = this.findAiStructurePlacement(anchor, Constants.MINIGUN_RADIUS, player);
                if (placement && player.spendEnergy(Constants.MINIGUN_COST)) {
                    player.buildings.push(new Minigun(placement, player));
                }
                break;
        }
    }

    private getAiStructureAnchor(player: Player): Vector2D | null {
        if (!player.stellarForge) {
            return null;
        }

        if (player.solarMirrors.length === 0 || this.suns.length === 0) {
            return player.stellarForge.position;
        }

        let bestMirror: SolarMirror | null = null;
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

    private findAiStructurePlacement(anchor: Vector2D, radiusPx: number, player: Player): Vector2D | null {
        const baseAngleRad = player.buildings.length * Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD;
        const distancePx = Constants.AI_STRUCTURE_PLACEMENT_DISTANCE_PX + radiusPx;
        for (let i = 0; i < 8; i++) {
            const angleRad = baseAngleRad + Constants.AI_STRUCTURE_PLACEMENT_ANGLE_STEP_RAD * i;
            const candidate = new Vector2D(
                anchor.x + Math.cos(angleRad) * distancePx,
                anchor.y + Math.sin(angleRad) * distancePx
            );
            if (!this.checkCollision(candidate, radiusPx)) {
                return candidate;
            }
        }
        return null;
    }

    private findAiThreat(
        player: Player,
        enemies: CombatTarget[]
    ): { enemy: CombatTarget; guardPoint: Vector2D } | null {
        if (!player.stellarForge) {
            return null;
        }

        const guardPoints: Vector2D[] = [player.stellarForge.position];
        for (const mirror of player.solarMirrors) {
            guardPoints.push(mirror.position);
        }

        let closestThreat: CombatTarget | null = null;
        let closestGuardPoint: Vector2D | null = null;
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

    private getClosestSunToPoint(point: Vector2D): Sun | null {
        let closestSun: Sun | null = null;
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

    private getAiHeroTypesForFaction(faction: Faction): string[] {
        switch (faction) {
            case Faction.RADIANT:
                return ['Marine', 'Dagger', 'Beam', 'Mortar', 'Preist', 'Tank', 'Spotlight'];
            case Faction.AURUM:
                return ['Driller'];
            case Faction.VELARIS:
                return ['Grave', 'Ray', 'InfluenceBall', 'TurretDeployer'];
            default:
                return [];
        }
    }

    private isHeroUnitOfType(unit: Unit, heroUnitType: string): boolean {
        switch (heroUnitType) {
            case 'Marine':
                return unit instanceof Marine;
            case 'Grave':
                return unit instanceof Grave;
            case 'Ray':
                return unit instanceof Ray;
            case 'InfluenceBall':
                return unit instanceof InfluenceBall;
            case 'TurretDeployer':
                return unit instanceof TurretDeployer;
            case 'Driller':
                return unit instanceof Driller;
            case 'Dagger':
                return unit instanceof Dagger;
            case 'Beam':
                return unit instanceof Beam;
            case 'Mortar':
                return unit instanceof Mortar;
            case 'Preist':
                return unit instanceof Preist;
            case 'Tank':
                return unit instanceof Tank;
            case 'Spotlight':
                return unit instanceof Spotlight;
            default:
                return false;
        }
    }

    private isHeroUnitAlive(player: Player, heroUnitType: string): boolean {
        return player.units.some((unit) => this.isHeroUnitOfType(unit, heroUnitType));
    }

    private isHeroUnitQueuedOrProducing(forge: StellarForge, heroUnitType: string): boolean {
        return forge.heroProductionUnitType === heroUnitType || forge.unitQueue.includes(heroUnitType);
    }

    private applyDustPushFromMovingEntity(
        position: Vector2D,
        velocity: Vector2D,
        radiusPx: number,
        forceMultiplier: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (speed <= 0) {
            return;
        }
        const effectiveSpeed = Math.max(speed, Constants.DUST_PUSH_MIN_EFFECTIVE_SPEED_PX_PER_SEC);
        this.applyFluidForceFromMovingObject(
            position,
            velocity,
            radiusPx,
            effectiveSpeed * forceMultiplier,
            impactColor,
            deltaTime
        );
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
    private applyFluidForceFromMovingObject(
        position: Vector2D,
        velocity: Vector2D,
        radius: number,
        strength: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        for (const particle of this.spaceDust) {
            const distance = particle.position.distanceTo(position);
            
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Calculate direction from object to particle
                const directionToParticle = new Vector2D(
                    particle.position.x - position.x,
                    particle.position.y - position.y
                ).normalize();
                
                // Combine forward motion with radial push
                const velocityNorm = velocity.normalize();
                
                // Mix of forward push and radial displacement (like fluid being displaced)
                const forwardComponent = Constants.FLUID_FORWARD_COMPONENT;
                const radialComponent = Constants.FLUID_RADIAL_COMPONENT;
                
                const pushDirection = new Vector2D(
                    velocityNorm.x * forwardComponent + directionToParticle.x * radialComponent,
                    velocityNorm.y * forwardComponent + directionToParticle.y * radialComponent
                );
                
                // Force falls off with distance (inverse square for more realistic fluid behavior)
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;

                if (impactColor) {
                    const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                    if (impactStrength > 0) {
                        particle.applyImpactColor(impactColor, impactStrength);
                    }
                }
                
                particle.applyForce(new Vector2D(
                    pushDirection.x * forceMagnitude * deltaTime,
                    pushDirection.y * forceMagnitude * deltaTime
                ));
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
    private applyFluidForceFromBeam(
        startPos: Vector2D,
        endPos: Vector2D,
        radius: number,
        strength: number,
        impactColor: string | null,
        deltaTime: number
    ): void {
        // Calculate beam direction
        const beamLength = startPos.distanceTo(endPos);
        if (beamLength < Constants.FLUID_MIN_DISTANCE) return;
        
        const beamDirection = new Vector2D(
            endPos.x - startPos.x,
            endPos.y - startPos.y
        ).normalize();
        
        for (const particle of this.spaceDust) {
            // Find closest point on line segment to particle
            const toParticle = new Vector2D(
                particle.position.x - startPos.x,
                particle.position.y - startPos.y
            );
            
            // Project particle position onto beam line
            const projection = toParticle.x * beamDirection.x + toParticle.y * beamDirection.y;
            const clampedProjection = Math.max(0, Math.min(beamLength, projection));
            
            // Closest point on beam to particle
            const closestPoint = new Vector2D(
                startPos.x + beamDirection.x * clampedProjection,
                startPos.y + beamDirection.y * clampedProjection
            );
            
            const distance = particle.position.distanceTo(closestPoint);
            
            if (distance < radius && distance > Constants.FLUID_MIN_DISTANCE) {
                // Direction from beam to particle (perpendicular push)
                const directionToParticle = new Vector2D(
                    particle.position.x - closestPoint.x,
                    particle.position.y - closestPoint.y
                ).normalize();
                
                // Combine beam direction with radial push
                // Particles along beam get pushed forward and outward
                const alongBeamComponent = Constants.BEAM_ALONG_COMPONENT;
                const perpendicularComponent = Constants.BEAM_PERPENDICULAR_COMPONENT;
                
                const pushDirection = new Vector2D(
                    beamDirection.x * alongBeamComponent + directionToParticle.x * perpendicularComponent,
                    beamDirection.y * alongBeamComponent + directionToParticle.y * perpendicularComponent
                );
                
                // Force falls off with distance from beam
                const distanceFactor = 1.0 - (distance / radius);
                const forceMagnitude = strength * distanceFactor * distanceFactor;

                if (impactColor) {
                    const impactStrength = Math.min(1, forceMagnitude / Constants.DUST_COLOR_FORCE_SCALE);
                    if (impactStrength > 0) {
                        particle.applyImpactColor(impactColor, impactStrength);
                    }
                }
                
                particle.applyForce(new Vector2D(
                    pushDirection.x * forceMagnitude * deltaTime,
                    pushDirection.y * forceMagnitude * deltaTime
                ));
            }
        }
    }

    private getPlayerImpactColor(player: Player): string {
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
    initializeMirrorMovement(): void {
        if (this.suns.length === 0) return;
        
        const sun = this.suns[0]; // Use first sun as reference
        
        for (const player of this.players) {
            if (!player.stellarForge || player.solarMirrors.length < 2) continue;
            
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
                let leftTarget = new Vector2D(
                    forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );
                
                // If target is blocked, try to find alternative position
                if (this.checkCollision(leftTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new Vector2D(
                            forgePos.x + Math.cos(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult,
                            forgePos.y + Math.sin(leftAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult
                        );
                        if (!this.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            leftTarget = altTarget;
                            break;
                        }
                    }
                }
                
                player.solarMirrors[0].setTarget(leftTarget);
            }
            
            if (player.solarMirrors.length >= 2) {
                // Try to place right mirror perpendicular to sun-forge line
                let rightTarget = new Vector2D(
                    forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE,
                    forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE
                );
                
                // If target is blocked, try to find alternative position
                if (this.checkCollision(rightTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                    // Try closer or further positions
                    for (let distMult = 0.7; distMult <= 1.5; distMult += 0.2) {
                        const altTarget = new Vector2D(
                            forgePos.x + Math.cos(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult,
                            forgePos.y + Math.sin(rightAngle) * Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE * distMult
                        );
                        if (!this.checkCollision(altTarget, Constants.AI_MIRROR_COLLISION_RADIUS_PX)) {
                            rightTarget = altTarget;
                            break;
                        }
                    }
                }
                
                player.solarMirrors[1].setTarget(rightTarget);
            }
        }
    }

    /**
     * Check if a point is in shadow cast by asteroids from all suns
     * Returns true if the point is in shadow from all light sources
     */
    isPointInShadow(point: Vector2D): boolean {
        // If no suns, everything is in shadow
        if (this.suns.length === 0) return true;
        
        // Point must have line of sight to at least one sun to not be in shadow
        for (const sun of this.suns) {
            const direction = new Vector2D(
                sun.position.x - point.x,
                sun.position.y - point.y
            ).normalize();
            
            const ray = new LightRay(point, direction);
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
    isObjectVisibleToPlayer(objectPos: Vector2D, player: Player, object?: CombatTarget): boolean {
        // Special LaD (Light and Dark) visibility logic
        const ladSun = this.suns.find(s => s.type === 'lad');
        if (ladSun) {
            return this.isObjectVisibleInLadMode(objectPos, player, object, ladSun);
        }
        
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof Dagger) {
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
        
        // In shadow - check proximity to player units
        for (const unit of player.units) {
            const distance = unit.position.distanceTo(objectPos);
            if (distance <= Constants.VISIBILITY_PROXIMITY_RANGE) {
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
    getLadSide(position: Vector2D, ladSun: Sun): 'light' | 'dark' {
        return position.x < ladSun.position.x ? 'light' : 'dark';
    }

    /**
     * Check visibility in LaD (Light and Dark) mode
     * Units are invisible to the enemy until they cross into enemy territory
     */
    private isObjectVisibleInLadMode(objectPos: Vector2D, player: Player, object: CombatTarget | undefined, ladSun: Sun): boolean {
        // Special case: if object is a Dagger unit and is cloaked
        if (object && object instanceof Dagger) {
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
            const objectOwner = object.owner as Player;
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
    private processRayBeamAbility(ray: InstanceType<typeof Ray>): void {
        if (!ray.drillDirection) {
            return;
        }
        
        const segments: InstanceType<typeof RayBeamSegment>[] = [];
        let currentPos = new Vector2D(ray.position.x, ray.position.y);
        let currentDir = ray.drillDirection.normalize();
        let bounces = 0;
        const maxDistance = 2000; // Max beam travel distance
        
        while (bounces < Constants.RAY_BEAM_MAX_BOUNCES) {
            // Cast ray to find next hit
            let closestHit: { pos: Vector2D, type: string, target?: any } | null = null;
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
                if (player === ray.owner) continue;
                
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
                const endPos = new Vector2D(
                    currentPos.x + currentDir.x * maxDistance,
                    currentPos.y + currentDir.y * maxDistance
                );
                segments.push(new RayBeamSegment(currentPos, endPos, ray.owner));
                break;
            }
            
            // Add segment to hit point
            segments.push(new RayBeamSegment(currentPos, closestHit.pos, ray.owner));
            
            // Handle hit
            if (closestHit.type === 'unit' || closestHit.type === 'forge') {
                // Damage and stop
                if (closestHit.target) {
                    closestHit.target.takeDamage(Constants.RAY_BEAM_DAMAGE);
                    // Create damage number
                    const maxHealth = closestHit.type === 'forge' 
                        ? Constants.STELLAR_FORGE_MAX_HEALTH 
                        : (closestHit.target as Unit).maxHealth;
                    const targetKey = closestHit.type === 'forge'
                        ? `forge_${closestHit.target.position.x}_${closestHit.target.position.y}_${(closestHit.target as StellarForge).owner.name}`
                        : `unit_${closestHit.target.position.x}_${closestHit.target.position.y}_${(closestHit.target as Unit).owner.name}`;
                    this.addDamageNumber(
                        closestHit.target.position,
                        Constants.RAY_BEAM_DAMAGE,
                        maxHealth,
                        closestHit.target.health,
                        targetKey
                    );
                }
                break;
            } else if (closestHit.type === 'sun' || closestHit.type === 'edge') {
                // Stop at sun or edge
                break;
            } else if (closestHit.type === 'asteroid') {
                // Bounce off asteroid
                bounces++;
                currentPos = closestHit.pos;
                // Calculate reflection direction (simplified)
                currentDir = new Vector2D(-currentDir.x, -currentDir.y); // Simple bounce for now
            }
        }
        
        ray.setBeamSegments(segments);
    }

    private updateSpotlightAbility(
        spotlight: InstanceType<typeof Spotlight>,
        enemies: CombatTarget[],
        deltaTime: number
    ): void {
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

    private getSpotlightMaxRangePx(spotlight: InstanceType<typeof Spotlight>): number {
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

    private getSpotlightTargetsInCone(
        spotlight: InstanceType<typeof Spotlight>,
        enemies: CombatTarget[],
        rangePx: number
    ): CombatTarget[] {
        const targets: CombatTarget[] = [];
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
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (Math.abs(angleDiff) <= halfConeAngle) {
                targets.push(enemy);
            }
        }

        return targets;
    }

    private isPositionInSpotlightCone(
        spotlight: InstanceType<typeof Spotlight>,
        position: Vector2D,
        rangePx: number
    ): boolean {
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
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        return Math.abs(angleDiff) <= Constants.SPOTLIGHT_CONE_ANGLE_RAD / 2;
    }

    private isObjectRevealedBySpotlight(objectPos: Vector2D, player: Player): boolean {
        for (const unit of player.units) {
            if (!(unit instanceof Spotlight)) {
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
    private rayIntersectsAsteroid(origin: Vector2D, direction: Vector2D, asteroid: Asteroid): Vector2D | null {
        // Simplified ray-polygon intersection
        // For now, treat asteroid as circle
        const toAsteroid = new Vector2D(
            asteroid.position.x - origin.x,
            asteroid.position.y - origin.y
        );
        const projection = toAsteroid.x * direction.x + toAsteroid.y * direction.y;
        
        if (projection < 0) return null; // Behind ray
        
        const closestPoint = new Vector2D(
            origin.x + direction.x * projection,
            origin.y + direction.y * projection
        );
        
        const distance = closestPoint.distanceTo(asteroid.position);
        if (distance < 60) { // Approximate asteroid radius
            return closestPoint;
        }
        
        return null;
    }
    
    /**
     * Check if ray intersects with a circular unit
     */
    private rayIntersectsUnit(origin: Vector2D, direction: Vector2D, targetPos: Vector2D, radius: number = 8): Vector2D | null {
        const toTarget = new Vector2D(
            targetPos.x - origin.x,
            targetPos.y - origin.y
        );
        const projection = toTarget.x * direction.x + toTarget.y * direction.y;
        
        if (projection < 0) return null; // Behind ray
        
        const closestPoint = new Vector2D(
            origin.x + direction.x * projection,
            origin.y + direction.y * projection
        );
        
        const distance = closestPoint.distanceTo(targetPos);
        if (distance < radius) {
            return closestPoint;
        }
        
        return null;
    }
    
    /**
     * Check if ray intersects with map edge
     */
    private rayIntersectsEdge(origin: Vector2D, direction: Vector2D): Vector2D | null {
        const mapSize = this.mapSize;
        let closestHit: Vector2D | null = null;
        let closestDist = Infinity;
        
        // Check all four edges
        const edges = [
            { x: 0, normal: new Vector2D(1, 0) },
            { x: mapSize, normal: new Vector2D(-1, 0) },
            { y: 0, normal: new Vector2D(0, 1) },
            { y: mapSize, normal: new Vector2D(0, -1) }
        ];
        
        for (const edge of edges) {
            let hitPos: Vector2D | null = null;
            
            if ('x' in edge && edge.x !== undefined) {
                if (Math.abs(direction.x) > 0.001) {
                    const t = (edge.x - origin.x) / direction.x;
                    if (t > 0) {
                        hitPos = new Vector2D(edge.x, origin.y + direction.y * t);
                    }
                }
            } else if ('y' in edge && edge.y !== undefined) {
                if (Math.abs(direction.y) > 0.001) {
                    const t = (edge.y - origin.y) / direction.y;
                    if (t > 0) {
                        hitPos = new Vector2D(origin.x + direction.x * t, edge.y);
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
    private processTurretDeployment(deployer: InstanceType<typeof TurretDeployer>): void {
        // Find nearest asteroid
        let nearestAsteroid: Asteroid | null = null;
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
            const turret = new DeployedTurret(
                new Vector2D(nearestAsteroid.position.x, nearestAsteroid.position.y),
                deployer.owner,
                nearestAsteroid
            );
            this.deployedTurrets.push(turret);
        }
    }
    
    /**
     * Process Driller collisions
     */
    private processDrillerCollisions(driller: InstanceType<typeof Driller>, deltaTime: number): void {
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
            if (player === driller.owner) continue;
            
            for (const unit of player.units) {
                const distance = driller.position.distanceTo(unit.position);
                if (distance < 15) {
                    unit.takeDamage(Constants.DRILLER_DRILL_DAMAGE);
                    // Create damage number
                    const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                    this.addDamageNumber(
                        unit.position,
                        Constants.DRILLER_DRILL_DAMAGE,
                        unit.maxHealth,
                        unit.health,
                        unitKey
                    );
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
                    this.addDamageNumber(
                        building.position,
                        damage,
                        building.maxHealth,
                        building.health,
                        buildingKey
                    );
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
                    this.addDamageNumber(
                        player.stellarForge.position,
                        damage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey
                    );
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
                } else {
                    driller.drillVelocity.x = (driller.drillVelocity.x / speed) * newSpeed;
                    driller.drillVelocity.y = (driller.drillVelocity.y / speed) * newSpeed;
                }
            }
            
            // Keep within bounds
            driller.position.x = Math.max(0, Math.min(mapSize, driller.position.x));
            driller.position.y = Math.max(0, Math.min(mapSize, driller.position.y));
        }
    }

    private resolveUnitCollisions(allUnits: Unit[]): void {
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
                    } else if (!unitA.isHero && unitB.isHero) {
                        unitA.position.x -= pushX;
                        unitA.position.y -= pushY;
                    } else {
                        unitA.position.x -= pushX * 0.5;
                        unitA.position.y -= pushY * 0.5;
                        unitB.position.x += pushX * 0.5;
                        unitB.position.y += pushY * 0.5;
                    }
                }
            }
        }
    }

    private resolveUnitObstacleCollisions(allUnits: Unit[]): void {
        for (const unit of allUnits) {
            if (unit.isDead()) {
                continue;
            }

            const oldPosition = new Vector2D(unit.position.x, unit.position.y);

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
                        if (mirror.owner === unit.owner) continue;
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

    private clampUnitOutsideStructures(unit: Unit): void {
        for (const player of this.players) {
            if (player.stellarForge) {
                this.pushUnitOutsideCircle(unit, player.stellarForge.position, player.stellarForge.radius);
            }

            for (const building of player.buildings) {
                this.pushUnitOutsideCircle(unit, building.position, building.radius);
            }
        }
    }

    private pushUnitOutsideCircle(unit: Unit, center: Vector2D, radius: number): void {
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
            } else {
                unit.position.x = center.x + minDistance;
                unit.position.y = center.y;
            }
        }
    }

    /**
     * Check if a position would collide with any obstacle (sun, asteroid, or building)
     * Returns true if collision detected
     */
    private createHeroUnit(unitType: string, spawnPosition: Vector2D, owner: Player): Unit | null {
        switch (unitType) {
            case 'Marine':
                return new Marine(spawnPosition, owner);
            case 'Grave':
                return new Grave(spawnPosition, owner);
            case 'Ray':
                return new Ray(spawnPosition, owner);
            case 'InfluenceBall':
                return new InfluenceBall(spawnPosition, owner);
            case 'TurretDeployer':
                return new TurretDeployer(spawnPosition, owner);
            case 'Driller':
                return new Driller(spawnPosition, owner);
            case 'Dagger':
                return new Dagger(spawnPosition, owner);
            case 'Beam':
                return new Beam(spawnPosition, owner);
            case 'Mortar':
                return new Mortar(spawnPosition, owner);
            case 'Preist':
                return new Preist(spawnPosition, owner);
            case 'Tank':
                return new Tank(spawnPosition, owner);
            case 'Spotlight':
                return new Spotlight(spawnPosition, owner);
            case 'Nova':
                return new Nova(spawnPosition, owner);
            case 'Sly':
                return new Sly(spawnPosition, owner);
            default:
                return null;
        }
    }

    checkCollision(
        position: Vector2D,
        unitRadius: number = Constants.UNIT_RADIUS_PX,
        ignoredObject: SolarMirror | StellarForge | Building | null = null
    ): boolean {
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

    private getMirrorLightOnStructure(player: Player, structure: Building | StellarForge): number {
        let totalLight = 0;

        for (const mirror of player.solarMirrors) {
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);
            if (linkedStructure !== structure) continue;
            if (!mirror.hasLineOfSightToLight(this.suns, this.asteroids)) continue;

            const ray = new LightRay(
                mirror.position,
                new Vector2D(
                    structure.position.x - mirror.position.x,
                    structure.position.y - mirror.position.y
                ).normalize(),
                1.0
            );

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
                }, null as Sun | null);

                if (closestSun) {
                    const distanceToSun = mirror.position.distanceTo(closestSun.position);
                    const distanceMultiplier = Math.max(
                        1.0,
                        Constants.MIRROR_PROXIMITY_MULTIPLIER * (1.0 - Math.min(1.0, distanceToSun / Constants.MIRROR_MAX_GLOW_DISTANCE))
                    );
                    totalLight += distanceMultiplier;
                }
            }
        }

        return totalLight;
    }

    private updateStateHash(): void {
        let hash = 2166136261;

        const mix = (value: number): void => {
            const normalizedValue = Math.floor(value * 100);
            hash = Math.imul(hash ^ normalizedValue, 16777619);
        };

        const mixInt = (value: number): void => {
            hash = Math.imul(hash ^ value, 16777619);
        };

        const mixString = (value: string): void => {
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
                } else {
                    mix(-1);
                    mix(-1);
                }
                mix(player.stellarForge.velocity.x);
                mix(player.stellarForge.velocity.y);
            } else {
                mix(-1);
            }

            for (const mirror of player.solarMirrors) {
                mix(mirror.position.x);
                mix(mirror.position.y);
                mix(mirror.health);
                mix(mirror.efficiency);
                mix(mirror.reflectionAngle);
                if (mirror.linkedStructure) {
                    if (mirror.linkedStructure instanceof StellarForge) {
                        mixInt(1);
                    } else {
                        mixInt(2);
                    }
                    mix(mirror.linkedStructure.position.x);
                    mix(mirror.linkedStructure.position.y);
                } else {
                    mixInt(0);
                    mix(-1);
                    mix(-1);
                }
                if (mirror.targetPosition) {
                    mix(mirror.targetPosition.x);
                    mix(mirror.targetPosition.y);
                } else {
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
                } else {
                    mix(-1);
                    mix(-1);
                }
                const manualTarget = unit.getManualTarget();
                if (manualTarget) {
                    mixInt(1);
                    if (manualTarget instanceof StellarForge) {
                        mixInt(1);
                    } else if (manualTarget instanceof Building) {
                        mixInt(2);
                    } else if (manualTarget instanceof SolarMirror) {
                        mixInt(3);
                    } else {
                        mixInt(4);
                    }
                    mix(manualTarget.position.x);
                    mix(manualTarget.position.y);
                    if ('owner' in manualTarget && manualTarget.owner) {
                        mixInt(this.players.indexOf(manualTarget.owner));
                    } else {
                        mixInt(-1);
                    }
                } else {
                    mixInt(0);
                    mix(-1);
                    mix(-1);
                    mixInt(-1);
                }
                if (unit instanceof Starling) {
                    mixInt(unit.getAssignedPathLength());
                    mixInt(unit.getCurrentPathWaypointIndex());
                    mixInt(unit.hasActiveManualOrder() ? 1 : 0);
                    mix(unit.getCurrentMoveSpeedPxPerSec());
                    mix(unit.abilityCooldown);
                    mixInt(unit.getHasReachedFinalWaypoint() ? 1 : 0);
                    mixString(unit.getPathHash());
                }
                if (unit instanceof Spotlight) {
                    mixInt(unit.getSpotlightStateCode());
                    mix(unit.spotlightStateElapsedSec);
                    mix(unit.spotlightFireCooldownSec);
                    mix(unit.spotlightLengthFactor);
                    mix(unit.spotlightRangePx);
                    if (unit.spotlightDirection) {
                        mix(unit.spotlightDirection.x);
                        mix(unit.spotlightDirection.y);
                    } else {
                        mix(-1);
                        mix(-1);
                    }
                }
                if (unit instanceof Grave) {
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
                        } else {
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
                if (building instanceof SubsidiaryFactory) {
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
    initializeSpaceDust(count: number, width: number, height: number, palette?: SpaceDustPalette): void {
        this.spaceDust = [];
        const clusterCount = Constants.DUST_CLUSTER_COUNT;
        const clusterRadiusPx = Constants.DUST_CLUSTER_RADIUS_PX;
        const clusterSpawnRatio = Constants.DUST_CLUSTER_SPAWN_RATIO;
        const clusterCenters: Vector2D[] = [];
        const rng = getGameRNG();

        for (let i = 0; i < clusterCount; i++) {
            const centerX = rng.nextFloat(-width/2, width/2);
            const centerY = rng.nextFloat(-height/2, height/2);
            clusterCenters.push(new Vector2D(centerX, centerY));
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
            } else {
                x = rng.nextFloat(-width/2, width/2);
                y = rng.nextFloat(-height/2, height/2);
            }
            this.spaceDust.push(new SpaceDustParticle(new Vector2D(x, y), undefined, palette));
        }
    }

    /**
     * Initialize asteroids at random positions
     */
    initializeAsteroids(count: number, width: number, height: number): void {
        this.asteroids = [];
        const maxAttempts = 50; // Maximum attempts to find a valid position
        const rng = getGameRNG();
        
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
                
                // Check if this position has enough gap from existing asteroids
                // Gap must be at least the sum of both asteroid radii
                validPosition = true;
                for (const asteroid of this.asteroids) {
                    const dx = x - asteroid.position.x;
                    const dy = y - asteroid.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const requiredGap = size + asteroid.size;
                    
                    if (dist < requiredGap) {
                        validPosition = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            // If we found a valid position, add the asteroid
            if (validPosition) {
                // Random polygon sides (3-9)
                const sides = rng.nextInt(3, 9);
                this.asteroids.push(new Asteroid(new Vector2D(x, y), sides, size));
            }
        }
    }

    /**
     * Check if any player has won
     * In team games, victory is achieved when all players on one team are defeated
     */
    checkVictoryConditions(): Player | null {
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
    initializePlayer(player: Player, forgePosition: Vector2D, mirrorPositions: Vector2D[]): void {
        // Create Stellar Forge
        player.stellarForge = new StellarForge(forgePosition, player);

        // Create starting Solar Mirrors
        for (const pos of mirrorPositions) {
            const mirror = new SolarMirror(pos, player);
            player.solarMirrors.push(mirror);
        }
    }

    /**
     * Add a damage number with proper handling for display mode
     */
    addDamageNumber(
        position: Vector2D,
        damage: number,
        maxHealth: number,
        currentHealth: number,
        unitKey: string | null = null
    ): void {
        const remainingHealth = Math.max(0, currentHealth);

        // If in remaining-life mode and unitKey is provided, remove previous damage numbers for this unit
        if (this.damageDisplayMode === 'remaining-life' && unitKey !== null) {
            this.damageNumbers = this.damageNumbers.filter(dn => dn.unitId !== unitKey);
        }

        this.damageNumbers.push(new DamageNumber(
            position,
            damage,
            this.gameTime,
            maxHealth,
            remainingHealth,
            unitKey
        ));
    }

    /**
     * Set up network manager and register event handlers
     */
    setupNetworkManager(networkManager: NetworkManager, localPlayerIndex: number): void {
        this.networkManager = networkManager;
        this.localPlayerIndex = localPlayerIndex;
        
        // Listen for incoming game commands from remote players
        this.networkManager.on(NetworkEvent.MESSAGE_RECEIVED, (data: any) => {
            if (data && typeof data === 'object' && 'type' in data && data.type === MessageType.GAME_COMMAND) {
                const command = data.data as GameCommand;
                this.receiveNetworkCommand(command);
            }
        });
    }

    /**
     * Send a game command to all connected peers
     */
    sendGameCommand(command: string, data: any): void {
        if (!this.networkManager) return;
        
        const gameCommand: GameCommand = {
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
    receiveNetworkCommand(command: GameCommand): void {
        // Add to pending commands queue to be processed in next update
        this.pendingCommands.push(command);
    }

    /**
     * Process all pending network commands
     */
    processPendingNetworkCommands(): void {
        if (this.pendingCommands.length === 0) return;
        
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
    private executeNetworkCommand(cmd: GameCommand): void {
        // Determine which player this command is for
        // Remote player is always the opposite of local player
        const remotePlayerIndex = this.localPlayerIndex === 0 ? 1 : 0;
        const player = this.players[remotePlayerIndex];
        
        if (!player) return;
        
        // Use shared command routing logic (LAN uses 'command' and 'data')
        this.executePlayerCommand(player, cmd.command, cmd.data);
    }

    /**
     * Update the player name map for efficient P2P lookups
     * Should be called whenever players array is modified
     */
    updatePlayerNameMap(): void {
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
    private executePlayerCommand(player: Player, commandType: string, payload: any): void {
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
    executeCommand(cmd: P2PGameCommand): void {
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
    executeCommands(commands: P2PGameCommand[]): void {
        for (const cmd of commands) {
            this.executeCommand(cmd);
        }
    }

    private executeUnitMoveCommand(player: Player, data: any): void {
        const { unitIds, targetX, targetY, moveOrder } = data;
        const target = new Vector2D(targetX, targetY);
        
        for (const unitId of unitIds) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                unit.clearManualTarget();
                if (unit instanceof Starling) {
                    unit.setManualRallyPoint(target);
                } else {
                    unit.rallyPoint = target;
                }
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            } else {
                console.warn(`Unit not found for network command: ${unitId}`);
            }
        }
    }

    private executeUnitTargetStructureCommand(player: Player, data: any): void {
        const { unitIds, targetPlayerIndex, structureType, structureIndex, moveOrder } = data;
        const targetPlayer = this.players[targetPlayerIndex];
        if (!targetPlayer) {
            console.warn('Target player not found for unit target command.');
            return;
        }

        let targetStructure: CombatTarget | null = null;
        if (structureType === 'forge') {
            targetStructure = targetPlayer.stellarForge ?? null;
        } else if (structureType === 'building') {
            targetStructure = targetPlayer.buildings[structureIndex] ?? null;
        } else if (structureType === 'mirror') {
            targetStructure = targetPlayer.solarMirrors[structureIndex] ?? null;
        }

        if (!targetStructure) {
            console.warn('Target structure not found for unit target command.');
            return;
        }

        for (const unitId of unitIds ?? []) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                if (unit instanceof Starling && targetStructure instanceof SubsidiaryFactory && targetStructure.owner === player) {
                    unit.setManualTarget(targetStructure, targetStructure.position);
                } else {
                    const targetRadiusPx = this.getCombatTargetRadiusPx(targetStructure);
                    const rallyPoint = unit.getStructureStandoffPoint(targetStructure.position, targetRadiusPx);
                    unit.setManualTarget(targetStructure, rallyPoint);
                }
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            } else {
                console.warn(`Unit not found for network command: ${unitId}`);
            }
        }
    }

    /**
     * Create death particles for an entity that has just died
     * @param entity - The unit or building that died
     * @param color - The player color to tint particles
     */
    private createDeathParticles(entity: Unit | Building, color: string): void {
        const approximateRadiusPx = entity instanceof Building
            ? entity.radius
            : Math.max(entity.collisionRadiusPx, entity.isHero ? Constants.HERO_BUTTON_RADIUS_PX * 0.8 : entity.collisionRadiusPx);
        this.spawnDeathParticles(entity.position, color, approximateRadiusPx, entity instanceof Unit && entity.isHero);
    }

    private createDeathParticlesForMirror(mirror: SolarMirror, color: string): void {
        this.spawnDeathParticles(mirror.position, color, Constants.MIRROR_CLICK_RADIUS_PX, false);
    }

    private spawnDeathParticles(position: Vector2D, color: string, approximateRadiusPx: number, isHero: boolean): void {
        const rng = getGameRNG();
        const radiusFactor = Math.max(0.6, approximateRadiusPx / Constants.UNIT_RADIUS_PX);
        const sizeFactor = Math.max(0.85, Math.min(3.2, radiusFactor));

        const baseMinCount = isHero ? 14 : 6;
        const baseMaxCount = isHero ? 24 : 12;
        const particleCount = Math.max(
            4,
            Math.round(rng.nextInt(baseMinCount, baseMaxCount) * (0.8 + sizeFactor * 0.75))
        );
        const baseSize = Math.max(2.2, (6 + approximateRadiusPx * 0.28) * Constants.DEATH_PARTICLE_SIZE_SCALE);

        const fadeStartTime = rng.nextFloat(5, 15);

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + rng.nextFloat(-0.25, 0.25);
            const speed = rng.nextFloat(48, 155) * (0.7 + sizeFactor * 0.25);

            const velocity = new Vector2D(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );

            const fragment = document.createElement('canvas');
            const size = rng.nextFloat(baseSize, baseSize * 2.0);
            fragment.width = size;
            fragment.height = size;
            const ctx = fragment.getContext('2d');
            if (ctx) {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, size, size);
            }

            const particle = new DeathParticle(
                new Vector2D(position.x, position.y),
                velocity,
                rng.nextAngle(),
                fragment,
                fadeStartTime
            );

            this.deathParticles.push(particle);
        }
    }

    private updateDeathParticles(deltaTime: number): void {
        const collisionTargets: Array<{ position: Vector2D; radius: number }> = [];

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
            } else if (deathParticle.position.x + particleRadius > mapHalf) {
                deathParticle.position.x = mapHalf - particleRadius;
                deathParticle.bounce(-1, 0, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            }

            if (deathParticle.position.y - particleRadius < -mapHalf) {
                deathParticle.position.y = -mapHalf + particleRadius;
                deathParticle.bounce(0, 1, Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION, Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING);
            } else if (deathParticle.position.y + particleRadius > mapHalf) {
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
                deathParticle.bounce(
                    normalX,
                    normalY,
                    Constants.DEATH_PARTICLE_BOUNCE_RESTITUTION,
                    Constants.DEATH_PARTICLE_BOUNCE_TANGENTIAL_DAMPING
                );
            }

            this.applyDustPushFromMovingEntity(
                deathParticle.position,
                deathParticle.velocity,
                Constants.DEATH_PARTICLE_DUST_PUSH_RADIUS_PX,
                Constants.DEATH_PARTICLE_DUST_PUSH_FORCE_MULTIPLIER,
                null,
                deltaTime
            );
        }

        this.deathParticles = this.deathParticles.filter(particle => !particle.shouldDespawn());
    }

    private getCombatTargetRadiusPx(target: CombatTarget): number {
        if (target instanceof SolarMirror) {
            return Constants.MIRROR_CLICK_RADIUS_PX;
        }
        if ('radius' in target) {
            return target.radius;
        }
        return 0;
    }

    private executeUnitAbilityCommand(player: Player, data: any): void {
        const { unitId, directionX, directionY } = data;
        const direction = new Vector2D(directionX, directionY);
        
        const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
        if (unit) {
            unit.useAbility(direction);
        } else {
            console.warn(`Unit not found for ability command: ${unitId}`);
        }
    }

    private executeUnitPathCommand(player: Player, data: any): void {
        const { unitIds, waypoints, moveOrder } = data;
        const path = (waypoints ?? []).map((wp: any) => new Vector2D(wp.x, wp.y));

        for (const unitId of unitIds ?? []) {
            const unit = player.units.find(u => this.getUnitNetworkId(u) === unitId);
            if (unit) {
                unit.clearManualTarget();
                unit.setPath(path);
                if (typeof moveOrder === 'number') {
                    unit.moveOrder = moveOrder;
                }
            } else {
                console.warn(`Unit not found for path command: ${unitId}`);
            }
        }
    }

    private executeHeroPurchaseCommand(player: Player, data: any): void {
        const { heroType } = data;
        if (player.stellarForge) {
            player.stellarForge.enqueueHeroUnit(heroType);
            player.stellarForge.startHeroProductionIfIdle();
        }
    }

    private executeBuildingPurchaseCommand(player: Player, data: any): void {
        const { buildingType, positionX, positionY } = data;
        const position = new Vector2D(positionX, positionY);
        
        // Check faction restrictions for Radiant-specific buildings
        const radiantOnlyBuildings = ['Minigun', 'Cannon', 'Gatling', 'GatlingTower', 'ShieldTower'];
        if (radiantOnlyBuildings.includes(buildingType) && player.faction !== Faction.RADIANT) {
            // Aurum and Velaris cannot build Radiant-specific buildings
            return;
        }
        
        // Check faction restrictions for Velaris-specific buildings
        const velarisOnlyBuildings = ['StrikerTower', 'LockOnLaserTower', 'SpaceDustSwirler'];
        if (velarisOnlyBuildings.includes(buildingType) && player.faction !== Faction.VELARIS) {
            // Radiant and Aurum cannot build Velaris-specific buildings
            return;
        }
        
        // Check if player can afford the building
        let cost = 0;
        if (buildingType === 'Minigun' || buildingType === 'Cannon') {
            cost = Constants.MINIGUN_COST;
        } else if (buildingType === 'Gatling' || buildingType === 'GatlingTower') {
            cost = Constants.GATLING_COST;
        } else if (buildingType === 'SpaceDustSwirler') {
            cost = Constants.SWIRLER_COST;
        } else if (buildingType === 'SubsidiaryFactory' || buildingType === 'Foundry') {
            cost = Constants.SUBSIDIARY_FACTORY_COST;
        } else if (buildingType === 'StrikerTower') {
            cost = Constants.STRIKER_TOWER_COST;
        } else if (buildingType === 'LockOnLaserTower') {
            cost = Constants.LOCKON_TOWER_COST;
        } else if (buildingType === 'ShieldTower') {
            cost = Constants.SHIELD_TOWER_COST;
        }
        
        if (player.spendEnergy(cost)) {
            // Create the building
            if (buildingType === 'Minigun' || buildingType === 'Cannon') {
                player.buildings.push(new Minigun(position, player));
            } else if (buildingType === 'Gatling' || buildingType === 'GatlingTower') {
                player.buildings.push(new GatlingTower(position, player));
            } else if (buildingType === 'SpaceDustSwirler') {
                player.buildings.push(new SpaceDustSwirler(position, player));
            } else if (buildingType === 'SubsidiaryFactory' || buildingType === 'Foundry') {
                player.buildings.push(new SubsidiaryFactory(position, player));
            } else if (buildingType === 'StrikerTower') {
                player.buildings.push(new StrikerTower(position, player));
            } else if (buildingType === 'LockOnLaserTower') {
                player.buildings.push(new LockOnLaserTower(position, player));
            } else if (buildingType === 'ShieldTower') {
                player.buildings.push(new ShieldTower(position, player));
            }
        }
    }

    // Mirror purchase is handled differently (not through commands)
    private executeMirrorPurchaseCommand(player: Player, data: any): void {
        // No-op: Mirror purchases are handled through direct game state modification
        return;
    }

    private executeStrikerTowerStartCountdownCommand(player: Player, data: any): void {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new Vector2D(targetX, targetY);
        
        // Find the striker tower
        const building = player.buildings.find(b => 
            b instanceof StrikerTower && this.getBuildingNetworkId(b) === buildingId
        );
        
        if (building instanceof StrikerTower) {
            // Validate target position
            const isValid = building.isValidTarget(
                targetPosition,
                (pos) => this.isPointInShadow(pos),
                (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits),
                player.units
            );
            
            if (isValid) {
                // Start countdown
                building.startCountdown(targetPosition);
            }
        }
    }

    private executeStrikerTowerFireCommand(player: Player, data: any): void {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new Vector2D(targetX, targetY);
        
        // Find the striker tower
        const building = player.buildings.find(b => 
            b instanceof StrikerTower && this.getBuildingNetworkId(b) === buildingId
        );
        
        if (building instanceof StrikerTower) {
            // Get all enemy units and structures
            const enemies: CombatTarget[] = [];
            for (const otherPlayer of this.players) {
                if (otherPlayer !== player) {
                    enemies.push(...otherPlayer.units);
                    if (otherPlayer.stellarForge) {
                        enemies.push(otherPlayer.stellarForge);
                    }
                    enemies.push(...otherPlayer.buildings);
                }
            }
            
            // Fire missile with visibility checks
            building.fireMissile(
                targetPosition,
                enemies,
                (pos) => this.isPointInShadow(pos),
                (pos, playerUnits) => this.isPositionVisibleByPlayerUnits(pos, playerUnits),
                player.units
            );
        }
    }

    /**
     * Check if a position is visible by any of the player's units
     */
    isPositionVisibleByPlayerUnits(position: Vector2D, playerUnits: Unit[]): boolean {
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
    getBuildingNetworkId(building: Building): string {
        const playerIndex = this.players.findIndex(p => p === building.owner);
        const buildingIndex = building.owner.buildings.indexOf(building);
        return `p${playerIndex}_b${buildingIndex}`;
    }

    private executeMirrorMoveCommand(player: Player, data: any): void {
        const { mirrorIndices, targetX, targetY, moveOrder } = data;
        const target = new Vector2D(targetX, targetY);

        for (const mirrorIndex of mirrorIndices ?? []) {
            const mirror = player.solarMirrors[mirrorIndex];
            if (mirror) {
                mirror.setTarget(target);
                if (typeof moveOrder === 'number') {
                    mirror.moveOrder = moveOrder;
                }
            }
        }
    }

    private executeMirrorLinkCommand(player: Player, data: any): void {
        const { mirrorIndices, structureType, buildingIndex } = data;
        let targetStructure: StellarForge | Building | null = null;

        if (structureType === 'forge') {
            targetStructure = player.stellarForge ?? null;
        } else if (structureType === 'building') {
            targetStructure = player.buildings[buildingIndex] ?? null;
        }

        for (const mirrorIndex of mirrorIndices ?? []) {
            const mirror = player.solarMirrors[mirrorIndex];
            if (mirror) {
                mirror.setLinkedStructure(targetStructure);
            }
        }
    }

    private executeStarlingMergeCommand(player: Player, data: any): void {
        const { unitIds, targetX, targetY } = data;
        if (!Array.isArray(unitIds)) {
            return;
        }
        const targetPosition = new Vector2D(targetX, targetY);
        this.applyStarlingMerge(player, unitIds, targetPosition);
    }

    applyStarlingMerge(player: Player, unitIds: string[], targetPosition: Vector2D): void {
        if (!player.buildings.some((building) => building instanceof SubsidiaryFactory)) {
            return;
        }

        const mergeStarlings: Starling[] = [];
        for (const unitId of unitIds) {
            if (mergeStarlings.length >= Constants.STARLING_MERGE_COUNT) {
                break;
            }
            const unit = player.units.find((candidate) => this.getUnitNetworkId(candidate) === unitId);
            if (unit instanceof Starling && !unit.isDead()) {
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

        this.starlingMergeGates.push(new StarlingMergeGate(targetPosition, player, mergeStarlings));
    }

    private executeFoundryProductionCommand(player: Player, data: any): void {
        const { buildingId, itemType } = data;
        const building = player.buildings[buildingId];
        if (!(building instanceof SubsidiaryFactory)) {
            return;
        }
        if (!building.isComplete) {
            return;
        }
        if (itemType === 'solar-mirror') {
            return;
        }
    }

    private executeFoundryUpgradeCommand(
        player: Player,
        data: any,
        upgradeType: 'strafe' | 'regen' | 'blink' | 'attack'
    ): void {
        const { buildingId } = data;
        const building = player.buildings[buildingId];
        if (!(building instanceof SubsidiaryFactory)) {
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

    private executeForgeMoveCommand(player: Player, data: any): void {
        const { targetX, targetY, moveOrder } = data;
        const target = new Vector2D(targetX, targetY);
        
        if (player.stellarForge) {
            player.stellarForge.targetPosition = target;
            if (typeof moveOrder === 'number') {
                player.stellarForge.moveOrder = moveOrder;
            }
        }
    }

    private executeSetRallyPathCommand(player: Player, data: any): void {
        const { waypoints } = data;
        const path = waypoints.map((wp: any) => new Vector2D(wp.x, wp.y));
        
        if (player.stellarForge) {
            player.stellarForge.setMinionPath(path);
        }
    }

    /**
     * Generate a unique ID for a unit (for network synchronization)
     * Note: This is a temporary solution. In production, units should have explicit unique IDs.
     */
    getUnitNetworkId(unit: Unit): string {
        // Use a combination of owner, position, health, and type for uniqueness
        // This is not perfect but works for most cases in the current implementation
        const ownerIndex = this.players.indexOf(unit.owner);
        return `${ownerIndex}_${unit.position.x.toFixed(1)}_${unit.position.y.toFixed(1)}_${unit.maxHealth}_${unit.constructor.name}`;
    }

    /**
     * Check if two players are on the same team
     */
    areAllies(player1: Player, player2: Player): boolean {
        return player1.teamId === player2.teamId;
    }

    /**
     * Check if two players are enemies
     */
    areEnemies(player1: Player, player2: Player): boolean {
        return player1.teamId !== player2.teamId;
    }

    /**
     * Get all teammates of a player (excluding the player themselves)
     */
    getTeammates(player: Player): Player[] {
        return this.players.filter(p => p !== player && p.teamId === player.teamId);
    }

    /**
     * Get all enemies of a player
     */
    getEnemies(player: Player): Player[] {
        return this.players.filter(p => p.teamId !== player.teamId);
    }

    /**
     * Get all players on a specific team
     */
    getTeamPlayers(teamId: number): Player[] {
        return this.players.filter(p => p.teamId === teamId);
    }
}

/**
 * Create a standard game setup
 */
export function createStandardGame(playerNames: Array<[string, Faction]>, spaceDustPalette?: SpaceDustPalette): GameState {
    const game = new GameState();

    // Add sun at center
    game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));

    // Create players with starting positions in bottom-left and top-right
    // Randomly assign which player gets which position
    const bottomLeft = new Vector2D(-700, 700);
    const topRight = new Vector2D(700, -700);
    const rng = getGameRNG();
    
    // Randomly decide player assignment
    const randomizePositions = rng.next() < 0.5;
    const positions = randomizePositions 
        ? [bottomLeft, topRight]
        : [topRight, bottomLeft];

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= positions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
        player.isAi = i !== 0;
        
        // Assign random AI strategy for AI players
        if (player.isAi) {
            const strategies = [
                Constants.AIStrategy.ECONOMIC,
                Constants.AIStrategy.DEFENSIVE,
                Constants.AIStrategy.AGGRESSIVE,
                Constants.AIStrategy.WAVES
            ];
            player.aiStrategy = rng.choice(strategies)!;
        }
        
        const forgePos = positions[i];
        
        const mirrorSpawnDistance = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        const mirrorPositions = [
            new Vector2D(
                forgePos.x - mirrorSpawnDistance,
                forgePos.y
            ),
            new Vector2D(
                forgePos.x + mirrorSpawnDistance,
                forgePos.y
            )
        ];
        game.initializePlayer(player, forgePos, mirrorPositions);
        
        // Hero units (Marine and Grave) are no longer spawned automatically
        // They must be obtained through other game mechanics
        
        game.players.push(player);
    }
    
    // Update player name map after all players have been added
    game.updatePlayerNameMap();
    
    // Initialize default minion paths (each forge targets the enemy's spawn location)
    if (game.players.length >= 2) {
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            const enemyIndex = (i + 1) % game.players.length;
            const enemyPlayer = game.players[enemyIndex];
            
            if (player.stellarForge && enemyPlayer.stellarForge) {
                player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
            }
        }
    }

    // Initialize space dust particles
    game.initializeSpaceDust(Constants.SPACE_DUST_PARTICLE_COUNT, 2000, 2000, spaceDustPalette);

    // Initialize random asteroids
    game.initializeAsteroids(10, 2000, 2000);
    
    // Add two large strategic asteroids that cast shadows on the bases
    // Position them close to the sun to cast shadows toward bottom-left and top-right
    // Bottom-left shadow: asteroid positioned at top-right of sun (angle ~-45 degrees or 315 degrees)
    const bottomLeftShadowAngle = -Math.PI / 4; // -45 degrees (top-right quadrant)
    const bottomLeftAsteroidPos = new Vector2D(
        Math.cos(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(bottomLeftShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );
    game.asteroids.push(new Asteroid(bottomLeftAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));
    
    // Top-right shadow: asteroid positioned at bottom-left of sun (angle ~135 degrees)
    const topRightShadowAngle = (3 * Math.PI) / 4; // 135 degrees (bottom-left quadrant)
    const topRightAsteroidPos = new Vector2D(
        Math.cos(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE,
        Math.sin(topRightShadowAngle) * Constants.STRATEGIC_ASTEROID_DISTANCE
    );
    game.asteroids.push(new Asteroid(topRightAsteroidPos, 6, Constants.STRATEGIC_ASTEROID_SIZE));

    game.isRunning = true;
    return game;
}
