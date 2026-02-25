/**
 * GameState - Main game state class containing the game loop and all game logic
 */

import { Vector2D } from './math';
import { VisionSystem } from './systems/vision-system';
import { CommandProcessor } from './systems/command-processor';
import { AISystem, AIContext } from './systems/ai-system';
import { PhysicsSystem, PhysicsContext } from './systems/physics-system';
import { ParticleSystem, ParticleContext } from './systems/particle-system';
import { HeroAbilitySystem, HeroAbilityContext } from './systems/hero-ability-system';
import { StarlingSystem, StarlingContext } from './systems/starling-system';
import { HeroEntitySystem, HeroEntityContext } from './systems/hero-entity-system';
import { ProjectileCombatSystem, ProjectileCombatContext } from './systems/projectile-combat-system';
import { SpaceDustSystem, SpaceDustContext } from './systems/space-dust-system';
import { MirrorSystem, MirrorSystemContext } from './systems/mirror-system';
import { WorldInitializationSystem } from './systems/world-initialization-system';
import { UnitEffectsSystem, UnitEffectsContext } from './systems/unit-effects-system';
import { BuildingUpdateSystem, BuildingUpdateContext } from './systems/building-update-system';
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
    Mothership,
    MiniMothership,
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
    DisintegrationParticle,
    Radiant,
    RadiantOrb,
    VelarisHero,
    VelarisOrb,
    AurumHero,
    AurumOrb,
    AurumShieldHit,
    Dash,
    DashSlash,
    Blink,
    BlinkShockwave,
    Shadow,
    ShadowDecoy,
    ShadowDecoyParticle,
    Chrono,
    ChronoFreezeCircle,
    Splendor,
    SplendorSunSphere,
    SplendorSunlightZone,
    SplendorLaserSegment,
    createHeroUnit
} from '../game-core';

import { computeStateHash, StateHashContext } from './state-hash';
import { Faction } from './entities/player';
export class GameState implements AIContext, PhysicsContext, ParticleContext, HeroAbilityContext, StarlingContext, HeroEntityContext, ProjectileCombatContext, SpaceDustContext, StateHashContext, MirrorSystemContext, UnitEffectsContext, BuildingUpdateContext {
    players: Player[] = [];
    playersByName: Map<string, Player> = new Map(); // For efficient P2P player lookup
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
    radiantOrbs: InstanceType<typeof RadiantOrb>[] = [];
    velarisOrbs: InstanceType<typeof VelarisOrb>[] = [];
    aurumOrbs: InstanceType<typeof AurumOrb>[] = [];
    aurumShieldHits: InstanceType<typeof AurumShieldHit>[] = [];
    dashSlashes: InstanceType<typeof DashSlash>[] = [];
    blinkShockwaves: InstanceType<typeof BlinkShockwave>[] = [];
    shadowDecoys: InstanceType<typeof ShadowDecoy>[] = [];
    shadowDecoyParticles: InstanceType<typeof ShadowDecoyParticle>[] = [];
    chronoFreezeCircles: InstanceType<typeof ChronoFreezeCircle>[] = [];
    splendorSunSpheres: InstanceType<typeof SplendorSunSphere>[] = [];
    splendorSunlightZones: InstanceType<typeof SplendorSunlightZone>[] = [];
    splendorLaserSegments: InstanceType<typeof SplendorLaserSegment>[] = [];
    miniMotherships: InstanceType<typeof MiniMothership>[] = [];
    miniMothershipExplosions: { position: Vector2D; owner: Player; timestamp: number }[] = [];
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
    readonly dustSpatialHash: Map<number, number[]> = new Map();
    readonly dustSpatialHashKeys: number[] = [];

    getInfluenceRadiusForSource(source: StellarForge | Building): number {
        return VisionSystem.getInfluenceRadiusForSource(source);
    }

    isInfluenceSourceActive(source: StellarForge | Building): boolean {
        return VisionSystem.isInfluenceSourceActive(source);
    }

    public isPointWithinPlayerInfluence(player: Player, point: Vector2D): boolean {
        return VisionSystem.isPointWithinPlayerInfluence(player, point);
    }


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

        // Update suns (for orbital motion)
        for (const sun of this.suns) {
            sun.update(deltaTime);
        }

        // Update asteroids
        for (const asteroid of this.asteroids) {
            asteroid.update(deltaTime);
        }

        // Apply knockback to units and mirrors that collide with rotating asteroids
        PhysicsSystem.applyAsteroidRotationKnockback(this);

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
                        ParticleSystem.createDeathParticlesForMirror(this, mirror, color);
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

                    PhysicsSystem.applyDustPushFromMovingEntity(
                        this,
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
                        const currentStarlingCount = StarlingSystem.getStarlingCountForPlayer(player);
                        const availableStarlingSlots = Math.max(0, Constants.STARLING_MAX_COUNT - currentStarlingCount);
                        const numStarlings = Math.min(
                            Math.floor(energyForMinions / Constants.STARLING_COST_PER_ENERGY),
                            availableStarlingSlots
                        );
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

            }

            for (const building of player.buildings) {
                building.isReceivingLight = false;
                building.incomingLightPerSec = 0;
            }

            // Update solar mirrors - position and reflection angle
            // Mirrors can move during countdown to reach the sun
            MirrorSystem.updateMirrorsForPlayer(this, player, deltaTime);
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

            // Get enemies (units and structures not owned by this player or their team)
            const enemies: CombatTarget[] = [];
            for (const otherPlayer of this.players) {
                // Skip self
                if (otherPlayer === player) continue;
                
                // Skip defeated players
                if (otherPlayer.isDefeated()) continue;
                
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
                        enemies.push(decoy as any);
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

                    if (unit.isHero && unit.owner.faction === Faction.AURUM && this.isUnitInSunlight(unit)) {
                        unit.position.x += unit.velocity.x * deltaTime * (Constants.AURUM_HERO_SUNLIGHT_SPEED_MULTIPLIER - 1);
                        unit.position.y += unit.velocity.y * deltaTime * (Constants.AURUM_HERO_SUNLIGHT_SPEED_MULTIPLIER - 1);
                    }

                    // Apply shield blocking from enemy ShieldTowers (not allied ones)
                    for (const enemyPlayer of this.players) {
                        // Skip own units and teammates
                        if (enemyPlayer === unit.owner) continue;
                        if (this.players.length >= 3 && enemyPlayer.teamId === unit.owner.teamId) {
                            continue;
                        }
                        
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

                    if (unit instanceof Starling) {
                        PhysicsSystem.applyDustPushFromMovingEntity(
                            this,
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
                                PhysicsSystem.applyFluidForceFromMovingObject(
                                    this,
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
                // (Marine, Mothership, Starling lasers, InfluenceBall, Mortar, Tank, Nova,
                //  Sly, Radiant, Velaris, Splendor, Aurum, Dash, Blink, Shadow, Chrono
                //  effects + Ray/TurretDeployer/Spotlight/Driller/Dagger/Grave ability updates)
                UnitEffectsSystem.collectEffectsForUnit(unit, this, enemies, deltaTime);
            }
            } // End of countdown check

            if (!this.isCountdownActive) {
                StarlingSystem.updateStarlingMergeGatesForPlayer(this, player, deltaTime);
            }

            if (!this.isCountdownActive) {
                StarlingSystem.processStarlingSacrificesForPlayer(player);
            }

            // Remove dead units and track losses
            const deadUnits = player.units.filter(unit => unit.isDead());
            for (const deadUnit of deadUnits) {
                // Create death particles for visual effect
                const color = player === this.players[0] ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                ParticleSystem.createDeathParticles(this, deadUnit, color);
            }
            player.unitsLost += deadUnits.length;
            player.units = player.units.filter(unit => !unit.isDead());

            // Update each building (only after countdown)
            if (!this.isCountdownActive) {
                BuildingUpdateSystem.updateBuildingsForPlayer(this, player, enemies, allUnits, allStructures, deltaTime);
            }
        }

        if (!this.isCountdownActive) {
            PhysicsSystem.resolveUnitCollisions(allUnits);
            PhysicsSystem.resolveUnitObstacleCollisions(this, allUnits);
        }

        this.stateHashTickCounter += 1;
        if (this.stateHashTickCounter % Constants.STATE_HASH_TICK_INTERVAL === 0) {
            this.updateStateHash();
        }

        ProjectileCombatSystem.update(this, deltaTime);

        // Update laser beams (visual effects only)
        this.laserBeams = this.laserBeams.filter(laser => !laser.update(deltaTime));
        
        // Update impact particles (visual effects only)
        // Update sparkle particles (regeneration visual effects)
        // Update death particles (breaking apart effect)
        // Update disintegration particles
        // Update shadow decoy particles
        ParticleSystem.updateVisualEffectParticles(this, deltaTime);
        
        // Clean up old striker tower explosions (keep for 1 second)
        this.strikerTowerExplosions = this.strikerTowerExplosions.filter(
            explosion => this.gameTime - explosion.timestamp < 1.0
        );
        
        HeroEntitySystem.update(this, deltaTime);
        
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
        ParticleSystem.updateDamageNumbers(this, deltaTime);
    }

    /**
     * Update space dust particles with physics and color influences
     */
    private updateSpaceDust(deltaTime: number): void {
        SpaceDustSystem.update(this, deltaTime);
    }

    private updateAi(deltaTime: number): void {
        AISystem.updateAi(deltaTime, this);
    }

    getEnemiesForPlayer(player: Player): CombatTarget[] {
        const enemies: CombatTarget[] = [];
        for (const otherPlayer of this.players) {
            // Skip self
            if (otherPlayer === player) continue;
            
            // Skip defeated players
            if (otherPlayer.isDefeated()) continue;
            
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

    getHeroUnitCost(player: Player): number {
        const aliveHeroCount = player.units.filter((unit) => unit.isHero).length;
        return Constants.HERO_UNIT_BASE_COST + aliveHeroCount * Constants.HERO_UNIT_COST_INCREMENT;
    }

    getClosestSunToPoint(point: Vector2D): Sun | null {
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

    public getPlayerImpactColor(player: Player): string {
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
        MirrorSystem.initializeMirrorMovement(this);
    }

    private isUnitInSunlight(unit: Unit): boolean {
        return VisionSystem.isUnitInSunlight(
            unit.position,
            unit.owner,
            this.suns,
            this.asteroids,
            this.splendorSunlightZones
        );
    }

    getSplendorSphereObstacles(): { position: Vector2D; radius: number }[] {
        const obstacles: { position: Vector2D; radius: number }[] = [];

        for (const player of this.players) {
            if (player.stellarForge) {
                obstacles.push({ position: player.stellarForge.position, radius: player.stellarForge.radius });
            }
            for (const building of player.buildings) {
                obstacles.push({ position: building.position, radius: building.radius });
            }
            for (const mirror of player.solarMirrors) {
                obstacles.push({ position: mirror.position, radius: Constants.SOLAR_MIRROR_COLLISION_RADIUS });
            }
        }

        return obstacles;
    }

    /**
     * Check if a point is in shadow cast by asteroids from all suns
     * Returns true if the point is in shadow from all light sources
     */
    isPointInShadow(point: Vector2D): boolean {
        return VisionSystem.isPointInShadow(
            point,
            this.suns,
            this.asteroids,
            this.splendorSunlightZones
        );
    }

    /**
     * Check if an enemy object is visible to a player
     * Objects are visible if:
     * - They are NOT in shadow (in light), OR
     * - They are in shadow but within proximity range of player unit, OR
     * - They are in shadow but within player's influence radius
     */
    isObjectVisibleToPlayer(objectPos: Vector2D, player: Player, object?: CombatTarget): boolean {
        return VisionSystem.isObjectVisibleToPlayer(
            objectPos,
            player,
            this.suns,
            this.asteroids,
            this.splendorSunlightZones,
            object
        );
    }

    /**
     * Helper method to determine which side of LaD sun a position is on
     * Public so it can be used by the renderer
     */
    getLadSide(position: Vector2D, ladSun: Sun): 'light' | 'dark' {
        return VisionSystem.getLadSide(position, ladSun);
    }

    /**
     * Check if a position would collide with any obstacle (sun, asteroid, or building)
     * Returns true if collision detected
     */
    checkCollision(
        position: Vector2D,
        unitRadius: number = Constants.UNIT_RADIUS_PX,
        ignoredObject: SolarMirror | StellarForge | Building | null = null
    ): boolean {
        return PhysicsSystem.checkCollision(this, position, unitRadius, ignoredObject);
    }

    /**
     * Apply knockback to units and solar mirrors when asteroids rotate and collide with them
     * This prevents entities from getting stuck inside rotating asteroids
     */
    public getMirrorLightOnStructure(player: Player, structure: Building | StellarForge): number {
        return MirrorSystem.getMirrorLightOnStructure(this, player, structure);
    }

    private updateStateHash(): void {
        this.stateHash = computeStateHash(this);
    }

    /**
     * Initialize space dust particles
     */
    initializeSpaceDust(count: number, width: number, height: number, palette?: SpaceDustPalette): void {
        WorldInitializationSystem.initializeSpaceDust(this.spaceDust, count, width, height, palette);
    }

    /**
     * Initialize asteroids at random positions
     */
    initializeAsteroids(count: number, width: number, height: number, exclusionZones?: Array<{ position: Vector2D, radius: number }>): void {
        WorldInitializationSystem.initializeAsteroids(this.asteroids, count, width, height, exclusionZones);
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
        unitKey: string | null = null,
        sourcePlayer: Player | null = null,
        incomingDirection: Vector2D | null = null,
        isBlocked: boolean = false
    ): void {
        const remainingHealth = Math.max(0, currentHealth);

        // If in remaining-life mode and unitKey is provided, remove previous damage numbers for this unit
        if (this.damageDisplayMode === 'remaining-life' && unitKey !== null) {
            this.damageNumbers = this.damageNumbers.filter(dn => dn.unitId !== unitKey);
        }

        const rng = getGameRNG();
        const baseSpeed = isBlocked ? 130 : 170;
        let velocity = new Vector2D(rng.nextFloat(-10, 10), -50);
        if (incomingDirection) {
            const directionLength = Math.sqrt(incomingDirection.x ** 2 + incomingDirection.y ** 2);
            if (directionLength > 0.0001) {
                const baseAngleRad = Math.atan2(incomingDirection.y, incomingDirection.x);
                const randomizedAngleRad = baseAngleRad + rng.nextFloat(-0.35, 0.35);
                const speed = baseSpeed + rng.nextFloat(-30, 30);
                velocity = new Vector2D(Math.cos(randomizedAngleRad) * speed, Math.sin(randomizedAngleRad) * speed);
            }
        }

        this.damageNumbers.push(new DamageNumber(
            position,
            damage,
            this.gameTime,
            maxHealth,
            remainingHealth,
            unitKey,
            velocity,
            sourcePlayer ? this.getPlayerImpactColor(sourcePlayer) : '#FF6464',
            isBlocked,
            isBlocked ? 'blocked' : null
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
     * Wrapper for CommandProcessor - maintains backward compatibility
     */
    private executeNetworkCommand(cmd: GameCommand): void {
        CommandProcessor.executeNetworkCommand(cmd, this);
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
     * Wrapper for CommandProcessor - maintains backward compatibility
     */
    private executePlayerCommand(player: Player, commandType: string, payload: any): void {
        CommandProcessor.executePlayerCommand(player, commandType, payload, this);
    }

    /**
     * Execute a P2P transport command (deterministic)
     * This method accepts commands from the P2P multiplayer system
     * @param cmd - Command from P2P transport system
     * 
     * NOTE: In the P2P system, cmd.playerId contains the player's name (not an ID).
     * This is because SoL uses player names as identifiers throughout the game state.
     * Wrapper for CommandProcessor - maintains backward compatibility
     */
    executeCommand(cmd: P2PGameCommand): void {
        CommandProcessor.executeCommand(cmd, this);
    }

    /**
     * Execute multiple P2P commands (for a tick)
     * Commands are executed in the order provided (should be pre-sorted by the command queue)
     * @param commands - Array of commands to execute
     * Wrapper for CommandProcessor - maintains backward compatibility
     */
    executeCommands(commands: P2PGameCommand[]): void {
        CommandProcessor.executeCommands(commands, this);
    }

    getCombatTargetRadiusPx(target: CombatTarget): number {
        if (target instanceof SolarMirror) {
            return Constants.MIRROR_CLICK_RADIUS_PX;
        }
        if ('radius' in target) {
            return target.radius;
        }
        return 0;
    }

    /**
     * Check if a line segment (light path) is blocked by Velaris orb light-blocking fields
     */
    private isLightBlockedByVelarisField(start: Vector2D, end: Vector2D): boolean {
        return VisionSystem.isLightBlockedByVelarisField(start, end, this.velarisOrbs);
    }

    /**
     * Check if two line segments intersect
     */
    private lineSegmentsIntersect(
        p1: Vector2D, p2: Vector2D,
        p3: Vector2D, p4: Vector2D
    ): boolean {
        return VisionSystem.lineSegmentsIntersect(p1, p2, p3, p4);
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

    // Create players with starting positions
    // For 2 players: bottom-left and top-right (diagonal)
    // For 4 players (2v2): all four corners (team 0 on one diagonal, team 1 on other)
    const rng = getGameRNG();
    
    let positions: Vector2D[];
    let teamAssignments: number[];
    
    if (playerNames.length === 2) {
        // Standard 1v1: bottom-left and top-right
        const bottomLeft = new Vector2D(-700, 700);
        const topRight = new Vector2D(700, -700);
        
        // Randomly decide player assignment
        const randomizePositions = rng.next() < 0.5;
        positions = randomizePositions 
            ? [bottomLeft, topRight]
            : [topRight, bottomLeft];
        
        teamAssignments = [0, 0]; // Both assigned team 0 (team logic disabled for 1v1)
    } else if (playerNames.length >= 4) {
        // 2v2 game: Four corners
        // Team 0: top-left and bottom-right (one diagonal)
        // Team 1: top-right and bottom-left (other diagonal)
        const topLeft = new Vector2D(-700, -700);
        const topRight = new Vector2D(700, -700);
        const bottomLeft = new Vector2D(-700, 700);
        const bottomRight = new Vector2D(700, 700);
        
        // Randomly assign which team gets which diagonal
        const randomizeTeams = rng.next() < 0.5;
        
        if (randomizeTeams) {
            positions = [topLeft, bottomRight, topRight, bottomLeft];
            teamAssignments = [0, 0, 1, 1];
        } else {
            positions = [topRight, bottomLeft, topLeft, bottomRight];
            teamAssignments = [0, 0, 1, 1];
        }
    } else {
        // 3 players - treat as FFA with positions around a circle
        const bottomLeft = new Vector2D(-700, 700);
        const topRight = new Vector2D(700, -700);
        const top = new Vector2D(0, -700);
        positions = [bottomLeft, topRight, top];
        teamAssignments = [0, 1, 2]; // Each on own team
    }

    for (let i = 0; i < playerNames.length; i++) {
        if (i >= positions.length) {
            break;
        }
        const [name, faction] = playerNames[i];
        const player = new Player(name, faction);
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
    
    // Initialize default minion paths (each forge targets an enemy's spawn location)
    if (game.players.length >= 2) {
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            
            // Find an enemy player (different team in team games, or next player in 1v1)
            let enemyPlayer: Player | null = null;
            
            if (game.players.length >= 3) {
                // Team game or FFA: target a player on a different team
                enemyPlayer = game.players.find(p => 
                    p !== player && p.teamId !== player.teamId
                ) || null;
            } else {
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
            position: p.stellarForge!.position,
            radius: 250 // Exclusion zone radius around each base
        }));

    // Initialize random asteroids with exclusion zones
    game.initializeAsteroids(10, 2000, 2000, exclusionZones);
    
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
