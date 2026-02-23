/**
 * StarlingSystem - Handles starling merge gate lifecycle and sacrifice mechanics
 */

import { Vector2D } from '../math';
import { Player } from '../entities/player';
import { Starling } from '../entities/starling';
import { StarlingMergeGate } from '../entities/starling-merge-gate';
import { SolarMirror } from '../entities/solar-mirror';
import { SubsidiaryFactory } from '../entities/buildings';
import * as Constants from '../../constants';

export interface StarlingContext {
    starlingMergeGates: StarlingMergeGate[];
    starlingMergeGateExplosions: Vector2D[];
}

export class StarlingSystem {
    static updateStarlingMergeGatesForPlayer(context: StarlingContext, player: Player, deltaTime: number): void {
        for (let gateIndex = context.starlingMergeGates.length - 1; gateIndex >= 0; gateIndex--) {
            const gate = context.starlingMergeGates[gateIndex];
            if (gate.owner !== player) {
                continue;
            }

            if (gate.health <= 0) {
                StarlingSystem.releaseStarlingMergeGate(context, gate, player);
                context.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
                context.starlingMergeGates.splice(gateIndex, 1);
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
                    context.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
                    player.solarMirrors.push(new SolarMirror(new Vector2D(gate.position.x, gate.position.y), player));
                } else {
                    StarlingSystem.releaseStarlingMergeGate(context, gate, player);
                    context.starlingMergeGateExplosions.push(new Vector2D(gate.position.x, gate.position.y));
                }
                context.starlingMergeGates.splice(gateIndex, 1);
            }
        }
    }

    static processStarlingSacrificesForPlayer(player: Player): void {
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

    static releaseStarlingMergeGate(context: StarlingContext, gate: StarlingMergeGate, player: Player): void {
        const releaseCount = gate.absorbedCount;
        if (releaseCount > 0) {
            const currentStarlingCount = StarlingSystem.getStarlingCountForPlayer(player);
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

    static getStarlingCountForPlayer(player: Player): number {
        let count = 0;
        for (const unit of player.units) {
            if (unit instanceof Starling) {
                count += 1;
            }
        }
        return count;
    }
}
