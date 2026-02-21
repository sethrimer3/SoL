/**
 * Command Processing System
 * Handles execution of all game commands for deterministic multiplayer
 * 
 * Extracted from game-state.ts as part of Phase 3.1 refactoring
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { GameCommand, NetworkEvent } from '../../network';
import { GameCommand as P2PGameCommand } from '../../transport';
import { Player, Faction } from '../entities/player';
import { StellarForge } from '../entities/stellar-forge';
import { Building, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, CombatTarget } from '../entities/buildings';
import { Unit } from '../entities/unit';
import { Starling } from '../entities/starling';
import { StarlingMergeGate } from '../entities/starling-merge-gate';

/**
 * Game state context for command execution
 * This interface defines what the command processor needs from game state
 */
export interface CommandContext {
    players: Player[];
    localPlayerIndex: number;
    playersByName: Map<string, Player>;
    starlingMergeGates: StarlingMergeGate[];
    mapSize: number;
    
    // Helper methods needed by commands
    getUnitNetworkId(unit: Unit): string;
    getBuildingNetworkId(building: Building): string;
    getHeroUnitCost(player: Player): number;
    getCombatTargetRadiusPx(target: CombatTarget): number;
    isPointInShadow(point: Vector2D): boolean;
    isPositionVisibleByPlayerUnits(position: Vector2D, playerUnits: Unit[]): boolean;
    applyStarlingMerge(player: Player, unitIds: string[], targetPosition: Vector2D): void;
}

/**
 * Command Processor System - handles all command execution
 */
export class CommandProcessor {
    /**
     * Execute a network command (LAN mode)
     */
    static executeNetworkCommand(cmd: GameCommand, context: CommandContext): void {
        // Determine which player this command is for
        // Remote player is always the opposite of local player
        const remotePlayerIndex = context.localPlayerIndex === 0 ? 1 : 0;
        const player = context.players[remotePlayerIndex];
        
        if (!player) return;
        
        // Use shared command routing logic (LAN uses 'command' and 'data')
        this.executePlayerCommand(player, cmd.command, cmd.data, context);
    }

    /**
     * Execute a command for a specific player using the shared routing logic
     * @param player - Player to execute command for
     * @param commandType - Type of command
     * @param payload - Command payload/data
     * @param context - Game state context
     */
    static executePlayerCommand(player: Player, commandType: string, payload: any, context: CommandContext): void {
        switch (commandType) {
            case 'unit_move':
                this.executeUnitMoveCommand(player, payload, context);
                break;
            case 'unit_target_structure':
                this.executeUnitTargetStructureCommand(player, payload, context);
                break;
            case 'unit_ability':
                this.executeUnitAbilityCommand(player, payload, context);
                break;
            case 'unit_path':
                this.executeUnitPathCommand(player, payload, context);
                break;
            case 'hero_purchase':
                this.executeHeroPurchaseCommand(player, payload, context);
                break;
            case 'building_purchase':
                this.executeBuildingPurchaseCommand(player, payload, context);
                break;
            case 'mirror_purchase':
                this.executeMirrorPurchaseCommand(player, payload, context);
                break;
            case 'mirror_move':
                this.executeMirrorMoveCommand(player, payload, context);
                break;
            case 'mirror_link':
                this.executeMirrorLinkCommand(player, payload, context);
                break;
            case 'starling_merge':
                this.executeStarlingMergeCommand(player, payload, context);
                break;
            case 'foundry_production':
                this.executeFoundryProductionCommand(player, payload, context);
                break;
            case 'foundry_strafe_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'strafe', context);
                break;
            case 'foundry_regen_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'regen', context);
                break;
            case 'foundry_attack_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'attack', context);
                break;
            case 'foundry_blink_upgrade':
                this.executeFoundryUpgradeCommand(player, payload, 'blink', context);
                break;
            case 'striker_tower_fire':
                this.executeStrikerTowerFireCommand(player, payload, context);
                break;
            case 'striker_tower_start_countdown':
                this.executeStrikerTowerStartCountdownCommand(player, payload, context);
                break;
            case 'forge_move':
                this.executeForgeMoveCommand(player, payload, context);
                break;
            case 'set_rally_path':
                this.executeSetRallyPathCommand(player, payload, context);
                break;
            default:
                console.warn('Unknown command type:', commandType);
        }
    }

    /**
     * Execute a P2P transport command (deterministic)
     * This method accepts commands from the P2P multiplayer system
     * @param cmd - Command from P2P transport system
     * @param context - Game state context
     * 
     * NOTE: In the P2P system, cmd.playerId contains the player's name (not an ID).
     * This is because SoL uses player names as identifiers throughout the game state.
     */
    static executeCommand(cmd: P2PGameCommand, context: CommandContext): void {
        // Find the player by name using efficient map lookup
        // cmd.playerId is the player's name in SoL's system
        const player = context.playersByName.get(cmd.playerId);
        if (!player) {
            console.warn('Player not found for P2P command:', cmd.playerId);
            return;
        }

        // Use shared command routing logic
        this.executePlayerCommand(player, cmd.commandType, cmd.payload, context);
    }

    /**
     * Execute multiple P2P commands (for a tick)
     * Commands are executed in the order provided (should be pre-sorted by the command queue)
     * @param commands - Array of commands to execute
     * @param context - Game state context
     */
    static executeCommands(commands: P2PGameCommand[], context: CommandContext): void {
        for (const cmd of commands) {
            this.executeCommand(cmd, context);
        }
    }

    /**
     * Execute unit move command
     */
    private static executeUnitMoveCommand(player: Player, data: any, context: CommandContext): void {
        const { unitIds, targetX, targetY, moveOrder } = data;
        const target = new Vector2D(targetX, targetY);
        
        for (const unitId of unitIds) {
            const unit = player.units.find(u => context.getUnitNetworkId(u) === unitId);
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

    /**
     * Execute unit target structure command
     */
    private static executeUnitTargetStructureCommand(player: Player, data: any, context: CommandContext): void {
        const { unitIds, targetPlayerIndex, structureType, structureIndex, moveOrder } = data;
        const targetPlayer = context.players[targetPlayerIndex];
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
            const unit = player.units.find(u => context.getUnitNetworkId(u) === unitId);
            if (unit) {
                if (unit instanceof Starling && targetStructure instanceof SubsidiaryFactory && targetStructure.owner === player) {
                    unit.setManualTarget(targetStructure, targetStructure.position);
                } else {
                    const targetRadiusPx = context.getCombatTargetRadiusPx(targetStructure);
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
     * Execute unit ability command
     */
    private static executeUnitAbilityCommand(player: Player, data: any, context: CommandContext): void {
        const { unitId, directionX, directionY } = data;
        const direction = new Vector2D(directionX, directionY);
        
        const unit = player.units.find(u => context.getUnitNetworkId(u) === unitId);
        if (unit) {
            unit.useAbility(direction);
        } else {
            console.warn(`Unit not found for ability command: ${unitId}`);
        }
    }

    /**
     * Execute unit path command
     */
    private static executeUnitPathCommand(player: Player, data: any, context: CommandContext): void {
        const { unitIds, waypoints, moveOrder } = data;
        const path = (waypoints ?? []).map((wp: any) => new Vector2D(wp.x, wp.y));

        for (const unitId of unitIds ?? []) {
            const unit = player.units.find(u => context.getUnitNetworkId(u) === unitId);
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

    /**
     * Execute hero purchase command
     */
    private static executeHeroPurchaseCommand(player: Player, data: any, context: CommandContext): void {
        const { heroType } = data;
        if (!player.stellarForge) {
            return;
        }

        const heroCost = context.getHeroUnitCost(player);
        player.stellarForge.enqueueHeroUnit(heroType, heroCost);
    }

    /**
     * Execute building purchase command
     */
    private static executeBuildingPurchaseCommand(player: Player, data: any, context: CommandContext): void {
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

    /**
     * Execute mirror purchase command
     */
    private static executeMirrorPurchaseCommand(player: Player, data: any, context: CommandContext): void {
        const requiredIncomingLight = typeof data?.cost === 'number' ? data.cost : Constants.STELLAR_FORGE_SOLAR_MIRROR_COST;
        const positionX = typeof data?.positionX === 'number' ? data.positionX : player.stellarForge?.position.x;
        const positionY = typeof data?.positionY === 'number' ? data.positionY : player.stellarForge?.position.y;

        if (typeof positionX !== 'number' || typeof positionY !== 'number') {
            return;
        }

        if (!player.stellarForge) {
            return;
        }

        player.stellarForge.enqueueMirror(requiredIncomingLight, new Vector2D(positionX, positionY));
    }

    /**
     * Execute striker tower start countdown command
     */
    private static executeStrikerTowerStartCountdownCommand(player: Player, data: any, context: CommandContext): void {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new Vector2D(targetX, targetY);
        
        // Find the striker tower
        const building = player.buildings.find(b => 
            b instanceof StrikerTower && context.getBuildingNetworkId(b) === buildingId
        );
        
        if (building instanceof StrikerTower) {
            // Validate target position
            const isValid = building.isValidTarget(
                targetPosition,
                (pos) => context.isPointInShadow(pos),
                (pos, playerUnits) => context.isPositionVisibleByPlayerUnits(pos, playerUnits),
                player.units
            );
            
            if (isValid) {
                // Start countdown
                building.startCountdown(targetPosition);
            }
        }
    }

    /**
     * Execute striker tower fire command
     */
    private static executeStrikerTowerFireCommand(player: Player, data: any, context: CommandContext): void {
        const { buildingId, targetX, targetY } = data;
        const targetPosition = new Vector2D(targetX, targetY);
        
        // Find the striker tower
        const building = player.buildings.find(b => 
            b instanceof StrikerTower && context.getBuildingNetworkId(b) === buildingId
        );
        
        if (building instanceof StrikerTower) {
            // Get all enemy units and structures
            const enemies: CombatTarget[] = [];
            for (const otherPlayer of context.players) {
                // Skip self
                if (otherPlayer === player) continue;
                
                // Skip teammates in team games (3+ players)
                if (context.players.length >= 3 && otherPlayer.teamId === player.teamId) {
                    continue;
                }
                
                enemies.push(...otherPlayer.units);
                if (otherPlayer.stellarForge) {
                    enemies.push(otherPlayer.stellarForge);
                }
                enemies.push(...otherPlayer.buildings);
            }
            
            // Fire missile with visibility checks
            building.fireMissile(
                targetPosition,
                enemies,
                (pos) => context.isPointInShadow(pos),
                (pos, playerUnits) => context.isPositionVisibleByPlayerUnits(pos, playerUnits),
                player.units
            );
        }
    }

    /**
     * Execute mirror move command
     */
    private static executeMirrorMoveCommand(player: Player, data: any, context: CommandContext): void {
        const { mirrorIndices, targetX, targetY, moveOrder, toSun } = data;
        const target = new Vector2D(targetX, targetY);

        for (const mirrorIndex of mirrorIndices ?? []) {
            const mirror = player.solarMirrors[mirrorIndex];
            if (mirror) {
                // Note: mirror.setTarget needs game state for pathfinding - this is passed via context
                // We need to add a method to context to handle this
                if (toSun) {
                    // Re-compute the best sunlight target on every client for determinism
                    mirror.setTargetToNearestSunlight(context as any);
                } else {
                    mirror.setTarget(target, context as any);
                }
                if (typeof moveOrder === 'number') {
                    mirror.moveOrder = moveOrder;
                }
            }
        }
    }

    /**
     * Execute mirror link command
     */
    private static executeMirrorLinkCommand(player: Player, data: any, context: CommandContext): void {
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

    /**
     * Execute starling merge command
     */
    private static executeStarlingMergeCommand(player: Player, data: any, context: CommandContext): void {
        const { unitIds, targetX, targetY } = data;
        if (!Array.isArray(unitIds)) {
            return;
        }
        const targetPosition = new Vector2D(targetX, targetY);
        context.applyStarlingMerge(player, unitIds, targetPosition);
    }

    /**
     * Execute foundry production command
     */
    private static executeFoundryProductionCommand(player: Player, data: any, context: CommandContext): void {
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

    /**
     * Execute foundry upgrade command
     */
    private static executeFoundryUpgradeCommand(
        player: Player,
        data: any,
        upgradeType: 'strafe' | 'regen' | 'blink' | 'attack',
        context: CommandContext
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

    /**
     * Execute forge move command
     */
    private static executeForgeMoveCommand(player: Player, data: any, context: CommandContext): void {
        const { targetX, targetY, moveOrder } = data;
        const target = new Vector2D(targetX, targetY);
        
        if (player.stellarForge) {
            player.stellarForge.targetPosition = target;
            if (typeof moveOrder === 'number') {
                player.stellarForge.moveOrder = moveOrder;
            }
        }
    }

    /**
     * Execute set rally path command
     */
    private static executeSetRallyPathCommand(player: Player, data: any, context: CommandContext): void {
        const { waypoints } = data;
        const path = waypoints.map((wp: any) => new Vector2D(wp.x, wp.y));
        
        if (player.stellarForge) {
            player.stellarForge.setMinionPath(path);
        }
    }
}
