/**
 * Hero Ability System
 * Handles hero-specific ability processing extracted from game-state.ts
 *
 * Extracted from game-state.ts as part of Phase 3 refactoring
 */

import { Vector2D, LightRay } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { Asteroid } from '../entities/asteroid';
import { Sun } from '../entities/sun';
import {
    AbilityBullet,
} from '../entities/particles';
import {
    Ray,
    RayBeamSegment,
    TurretDeployer,
    DeployedTurret,
    Driller,
    Spotlight,
    CombatTarget,
} from '../../game-core';
import { StellarForge } from '../entities/stellar-forge';

/**
 * Context required by HeroAbilitySystem methods
 */
export interface HeroAbilityContext {
    asteroids: Asteroid[];
    players: Player[];
    suns: Sun[];
    mapSize: number;
    abilityBullets: AbilityBullet[];
    deployedTurrets: InstanceType<typeof DeployedTurret>[];
    addDamageNumber(
        position: Vector2D,
        damage: number,
        maxHealth: number,
        currentHealth: number,
        unitKey: string | null,
        sourcePlayer: Player | null,
        incomingDirection: Vector2D | null,
        isBlocked?: boolean
    ): void;
}

export class HeroAbilitySystem {
    /**
     * Process Ray's bouncing beam ability
     */
    static processRayBeamAbility(ray: InstanceType<typeof Ray>, ctx: HeroAbilityContext): void {
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
            for (const asteroid of ctx.asteroids) {
                const hitPos = HeroAbilitySystem.rayIntersectsAsteroid(currentPos, currentDir, asteroid);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'asteroid' };
                    }
                }
            }

            // Check enemy units
            for (const player of ctx.players) {
                if (player === ray.owner) continue;

                for (const unit of player.units) {
                    const hitPos = HeroAbilitySystem.rayIntersectsUnit(currentPos, currentDir, unit.position);
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
                    const hitPos = HeroAbilitySystem.rayIntersectsUnit(currentPos, currentDir, player.stellarForge.position, player.stellarForge.radius);
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
            for (const sun of ctx.suns) {
                const hitPos = HeroAbilitySystem.rayIntersectsUnit(currentPos, currentDir, sun.position, sun.radius);
                if (hitPos) {
                    const distance = currentPos.distanceTo(hitPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestHit = { pos: hitPos, type: 'sun' };
                    }
                }
            }

            // Check map edges
            const edgeHit = HeroAbilitySystem.rayIntersectsEdge(currentPos, currentDir, ctx.mapSize);
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
                    const previousHealth = closestHit.target.health;
                    closestHit.target.takeDamage(Constants.RAY_BEAM_DAMAGE);
                    const actualDamage = Math.max(0, previousHealth - closestHit.target.health);
                    const maxHealth = closestHit.type === 'forge'
                        ? Constants.STELLAR_FORGE_MAX_HEALTH
                        : (closestHit.target as any).maxHealth;
                    const targetKey = closestHit.type === 'forge'
                        ? `forge_${closestHit.target.position.x}_${closestHit.target.position.y}_${(closestHit.target as StellarForge).owner.name}`
                        : `unit_${closestHit.target.position.x}_${closestHit.target.position.y}_${(closestHit.target as any).owner.name}`;
                    ctx.addDamageNumber(
                        closestHit.target.position,
                        actualDamage,
                        maxHealth,
                        closestHit.target.health,
                        targetKey,
                        ray.owner,
                        currentDir,
                        actualDamage <= 0
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
                currentDir = new Vector2D(-currentDir.x, -currentDir.y);
            }
        }

        ray.setBeamSegments(segments);
    }

    /**
     * Update Spotlight ability - detect targets in cone and fire
     */
    static updateSpotlightAbility(
        spotlight: InstanceType<typeof Spotlight>,
        enemies: CombatTarget[],
        deltaTime: number,
        ctx: HeroAbilityContext
    ): void {
        spotlight.updateSpotlightState(deltaTime);

        if (!spotlight.isSpotlightActive() || !spotlight.spotlightDirection) {
            spotlight.setSpotlightRangePx(0);
            return;
        }

        const maxRangePx = HeroAbilitySystem.getSpotlightMaxRangePx(spotlight, ctx);
        spotlight.setSpotlightRangePx(maxRangePx);
        const effectiveRangePx = maxRangePx * spotlight.spotlightLengthFactor;

        if (!spotlight.canFireSpotlight() || effectiveRangePx <= 0) {
            return;
        }

        const targets = HeroAbilitySystem.getSpotlightTargetsInCone(spotlight, enemies, effectiveRangePx);
        if (targets.length > 0) {
            const bullets = spotlight.fireSpotlightAtTargets(targets, effectiveRangePx);
            if (bullets.length > 0) {
                ctx.abilityBullets.push(...bullets);
            }
        }
    }

    /**
     * Process TurretDeployer ability - deploy turret on nearest asteroid
     */
    static processTurretDeployment(deployer: InstanceType<typeof TurretDeployer>, ctx: HeroAbilityContext): void {
        // Find nearest asteroid
        let nearestAsteroid: Asteroid | null = null;
        let minDistance = Infinity;

        for (const asteroid of ctx.asteroids) {
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
            ctx.deployedTurrets.push(turret);
        }
    }

    /**
     * Process Driller collisions - handles drilling into units, buildings, asteroids
     */
    static processDrillerCollisions(driller: InstanceType<typeof Driller>, deltaTime: number, ctx: HeroAbilityContext): void {
        // Check collision with suns (dies)
        for (const sun of ctx.suns) {
            const distance = driller.position.distanceTo(sun.position);
            if (distance < sun.radius + 10) {
                driller.health = 0; // Dies
                driller.stopDrilling();
                return;
            }
        }

        // Check collision with asteroids (burrows)
        for (const asteroid of ctx.asteroids) {
            if (asteroid.containsPoint(driller.position)) {
                driller.hideInAsteroid(asteroid);
                driller.stopDrilling();
                return;
            }
        }

        // Check collision with enemy units
        for (const player of ctx.players) {
            if (player === driller.owner) continue;

            for (const unit of player.units) {
                const distance = driller.position.distanceTo(unit.position);
                if (distance < 15) {
                    const previousHealth = unit.health;
                    unit.takeDamage(Constants.DRILLER_DRILL_DAMAGE);
                    const actualDamage = Math.max(0, previousHealth - unit.health);
                    const unitKey = `unit_${unit.position.x}_${unit.position.y}_${unit.owner.name}`;
                    ctx.addDamageNumber(
                        unit.position,
                        actualDamage,
                        unit.maxHealth,
                        unit.health,
                        unitKey,
                        driller.owner,
                        driller.drillVelocity,
                        actualDamage <= 0
                    );
                }
            }

            // Check collision with buildings (double damage, pass through)
            for (const building of player.buildings) {
                const distance = driller.position.distanceTo(building.position);
                if (distance < 40) {
                    const damage = Constants.DRILLER_DRILL_DAMAGE * Constants.DRILLER_BUILDING_DAMAGE_MULTIPLIER;
                    building.takeDamage(damage);
                    const buildingKey = `building_${building.position.x}_${building.position.y}_${player.name}`;
                    ctx.addDamageNumber(
                        building.position,
                        damage,
                        building.maxHealth,
                        building.health,
                        buildingKey,
                        driller.owner,
                        driller.drillVelocity
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
                    const forgeKey = `forge_${player.stellarForge.position.x}_${player.stellarForge.position.y}_${player.name}`;
                    ctx.addDamageNumber(
                        player.stellarForge.position,
                        damage,
                        Constants.STELLAR_FORGE_MAX_HEALTH,
                        player.stellarForge.health,
                        forgeKey,
                        driller.owner,
                        driller.drillVelocity
                    );
                    // Continue drilling through
                }
            }
        }

        // Check collision with map edges (decelerate and stop)
        const mapSize = ctx.mapSize;
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

    // --- Private helpers ---

    private static getSpotlightMaxRangePx(spotlight: InstanceType<typeof Spotlight>, ctx: HeroAbilityContext): number {
        const direction = spotlight.spotlightDirection;
        if (!direction) {
            return 0;
        }

        let closestDistance = Infinity;
        const edgeHit = HeroAbilitySystem.rayIntersectsEdge(spotlight.position, direction, ctx.mapSize);
        if (edgeHit) {
            closestDistance = spotlight.position.distanceTo(edgeHit);
        }

        for (const asteroid of ctx.asteroids) {
            const hitPos = HeroAbilitySystem.rayIntersectsAsteroid(spotlight.position, direction, asteroid);
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

    private static getSpotlightTargetsInCone(
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

    static rayIntersectsAsteroid(origin: Vector2D, direction: Vector2D, asteroid: Asteroid): Vector2D | null {
        // Simplified ray-polygon intersection (treat asteroid as circle)
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

    static rayIntersectsUnit(origin: Vector2D, direction: Vector2D, targetPos: Vector2D, radius: number = 8): Vector2D | null {
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

    static rayIntersectsEdge(origin: Vector2D, direction: Vector2D, mapSize: number): Vector2D | null {
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
}
