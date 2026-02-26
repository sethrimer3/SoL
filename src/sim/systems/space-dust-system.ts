/**
 * SpaceDustSystem
 * Handles space dust particle physics and color updates extracted from game-state.ts
 *
 * Extracted from game-state.ts as part of Phase 9 refactoring
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Player } from '../entities/player';
import { SpaceDustParticle } from '../entities/particles';
import { Building, SpaceDustSwirler } from '../entities/buildings';
import { StellarForge } from '../entities/stellar-forge';
import { WarpGate } from '../entities/warp-gate';
import { PhysicsSystem, PhysicsContext } from './physics-system';
import { VisionSystem } from './vision-system';

export interface SpaceDustContext extends PhysicsContext {
    warpGates: WarpGate[];
    gameTime: number;
}

export class SpaceDustSystem {
    /**
     * Update all space dust particles: physics, coloring, and force interactions.
     */
    static update(ctx: SpaceDustContext, deltaTime: number): void {
        PhysicsSystem.applyDustRepulsion(ctx, deltaTime);

        for (const particle of ctx.spaceDust) {
            particle.update(deltaTime, ctx.gameTime);
            PhysicsSystem.resolveDustAsteroidCollision(ctx, particle, deltaTime);

            const closestInfluence = SpaceDustSystem.getClosestInfluenceAtPoint(ctx, particle.position);

            if (closestInfluence) {
                const color = closestInfluence.playerIndex === 0 ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                const blendFactor = 1.0 - (closestInfluence.distance / closestInfluence.radius);
                particle.updateColor(color, blendFactor);
            } else {
                particle.updateColor(null, 0);
            }
        }

        // Apply forces from warp gates (spiral effect)
        for (const gate of ctx.warpGates) {
            if (gate.isCharging && gate.chargeTime >= Constants.WARP_GATE_INITIAL_DELAY) {
                for (const particle of ctx.spaceDust) {
                    const dx = gate.position.x - particle.position.x;
                    const dy = gate.position.y - particle.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < Constants.WARP_GATE_SPIRAL_RADIUS && distance > Constants.WARP_GATE_SPIRAL_MIN_DISTANCE) {
                        const invDist = 1 / distance;
                        const dirX = dx * invDist;
                        const dirY = dy * invDist;
                        // tangent = (-dirY, dirX)
                        const forceX = dirX * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL - dirY * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT;
                        const forceY = dirY * Constants.WARP_GATE_SPIRAL_FORCE_RADIAL + dirX * Constants.WARP_GATE_SPIRAL_FORCE_TANGENT;
                        particle.applyForceXY(forceX * deltaTime / distance, forceY * deltaTime / distance);
                    }
                }
            }
        }

        // Apply forces from forge crunches (suck in, then wave out)
        for (const player of ctx.players) {
            if (player.stellarForge && !player.isDefeated()) {
                const crunch = player.stellarForge.getCurrentCrunch();
                if (crunch && crunch.isActive()) {
                    for (const particle of ctx.spaceDust) {
                        const dx = particle.position.x - crunch.position.x;
                        const dy = particle.position.y - crunch.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (crunch.phase === 'suck' && distance < Constants.FORGE_CRUNCH_SUCK_RADIUS) {
                            if (distance > 5) {
                                const invDist = 1 / distance;
                                const forceMagnitude = Constants.FORGE_CRUNCH_SUCK_FORCE / Math.sqrt(distance);
                                // Direction towards crunch (negate dx/dy)
                                particle.applyForceXY(-dx * invDist * forceMagnitude * deltaTime, -dy * invDist * forceMagnitude * deltaTime);
                            }
                        } else if (crunch.phase === 'wave' && distance < Constants.FORGE_CRUNCH_WAVE_RADIUS) {
                            if (distance > 5) {
                                const invDist = 1 / distance;
                                const waveProgress = crunch.getPhaseProgress();
                                const wavePosition = waveProgress * Constants.FORGE_CRUNCH_WAVE_RADIUS;
                                const distanceToWave = Math.abs(distance - wavePosition);
                                const waveSharpness = 50;
                                const waveStrength = Math.exp(-distanceToWave / waveSharpness);

                                const forceMagnitude = Constants.FORGE_CRUNCH_WAVE_FORCE * waveStrength;
                                // Direction away from crunch
                                particle.applyForceXY(dx * invDist * forceMagnitude * deltaTime, dy * invDist * forceMagnitude * deltaTime);
                            }
                        }
                    }
                }
            }
        }

        // Apply forces from Space Dust Swirler buildings (counter-clockwise orbits)
        for (const player of ctx.players) {
            for (const building of player.buildings) {
                if (building instanceof SpaceDustSwirler) {
                    building.applyDustSwirl(ctx.spaceDust, deltaTime);
                }
            }
        }
    }

    /**
     * Find the closest active influence source to a point and return its player index,
     * distance, and radius. Returns null if the point is outside all influence zones.
     */
    private static getClosestInfluenceAtPoint(
        ctx: SpaceDustContext,
        point: Vector2D
    ): { playerIndex: number; distance: number; radius: number } | null {
        let closestInfluence: { playerIndex: number; distance: number; radius: number } | null = null;

        for (let i = 0; i < ctx.players.length; i++) {
            const player = ctx.players[i];
            if (player.isDefeated()) {
                continue;
            }

            const forge = player.stellarForge;
            if (forge && VisionSystem.isInfluenceSourceActive(forge as StellarForge | Building)) {
                const radius = VisionSystem.getInfluenceRadiusForSource(forge as StellarForge | Building);
                const distance = point.distanceTo(forge.position);
                if (distance < radius && (!closestInfluence || distance < closestInfluence.distance)) {
                    closestInfluence = { playerIndex: i, distance, radius };
                }
            }

            for (const building of player.buildings) {
                if (!VisionSystem.isInfluenceSourceActive(building)) {
                    continue;
                }
                const radius = VisionSystem.getInfluenceRadiusForSource(building);
                const distance = point.distanceTo(building.position);
                if (distance < radius && (!closestInfluence || distance < closestInfluence.distance)) {
                    closestInfluence = { playerIndex: i, distance, radius };
                }
            }
        }

        return closestInfluence;
    }
}
