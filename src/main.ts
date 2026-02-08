/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate, Unit, Sun, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, LightRay, Starling, StellarForge, SolarMirror, Marine, Grave, Ray, InfluenceBall, TurretDeployer, Driller, Dagger, Beam, Player, Building, Nova, Sly } from './game-core';
import { GameRenderer } from './renderer';
import { MainMenu, GameSettings, COLOR_SCHEMES } from './menu';
import * as Constants from './constants';
import { MultiplayerNetworkManager, NetworkEvent } from './multiplayer-network';

class GameController {
    public game: GameState | null = null;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private showInGameMenu: boolean = false;
    private showInfo: boolean = false;
    private holdStartTime: number | null = null;
    private holdStarlingForMerge: Starling | null = null;
    private currentWarpGate: WarpGate | null = null;
    private isUsingMirrorsForWarpGate: boolean = false;
    private mirrorCommandMode: 'warpgate' | null = null; // Track which command was selected
    private shouldSkipMoveOrderThisTap: boolean = false;
    private mirrorHoldStartTimeMs: number | null = null;
    private mirrorHoldWorldPos: Vector2D | null = null;
    private hasSeenFoundry: boolean = false;
    private hasActiveFoundry: boolean = false;
    private menu: MainMenu;
    private selectedUnits: Set<Unit> = new Set();
    private selectedMirrors: Set<SolarMirror> = new Set(); // Set of SolarMirror
    private selectedBase: any | null = null; // StellarForge or null
    private selectedBuildings: Set<any> = new Set(); // Set of Building (Minigun/Cannon, Gatling, SpaceDustSwirler, SubsidiaryFactory/Foundry, StrikerTower, LockOnLaserTower, ShieldTower)
    private selectedWarpGate: WarpGate | null = null;
    private isSelecting: boolean = false;
    private selectionStartScreen: Vector2D | null = null;
    private isDraggingHeroArrow: boolean = false; // Flag for hero arrow dragging
    private isDraggingBuildingArrow: boolean = false; // Flag for building ability arrow dragging
    private isDrawingPath: boolean = false; // Flag for drawing minion path from base
    private pathPoints: Vector2D[] = []; // Path waypoints being drawn
    private moveOrderCounter: number = 0; // Counter for move order indicators
    private localPlayerIndex: number = 0; // Track local player index for LAN mode
    private lastTapTime: number = 0; // Timestamp of last tap for double-tap detection
    private lastTapPosition: Vector2D | null = null; // Position of last tap
    private readonly DOUBLE_TAP_THRESHOLD_MS = 300; // Max time between taps (ms)
    private readonly DOUBLE_TAP_POSITION_THRESHOLD = 30; // Max distance between taps (pixels)

    // P2P Multiplayer properties
    private network: MultiplayerNetworkManager | null = null;
    private isMultiplayer: boolean = false;
    private tickAccumulator: number = 0;
    private readonly TICK_INTERVAL_MS: number = 1000 / 30; // 30 ticks/second (33.333... ms)

    private abilityArrowStarts: Vector2D[] = [];

    /**
     * Check if any hero units are currently selected
     */
    private hasHeroUnitsSelected(): boolean {
        if (this.selectedUnits.size === 0) {
            return false;
        }
        for (const unit of this.selectedUnits) {
            if (unit.isHero) {
                return true;
            }
        }
        return false;
    }

    private getSelectedStarlings(player: Player): Starling[] {
        const starlings: Starling[] = [];
        for (const unit of this.selectedUnits) {
            if (unit instanceof Starling && unit.owner === player) {
                starlings.push(unit);
            }
        }
        return starlings;
    }

    private tryStartStarlingMerge(player: Player, starlings: Starling[], targetPosition: Vector2D): boolean {
        if (!this.game) {
            return false;
        }
        if (starlings.length < Constants.STARLING_MERGE_COUNT) {
            return false;
        }
        const hasFoundry = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        if (!hasFoundry) {
            return false;
        }
        const mergeStarlings = starlings.slice(0, Constants.STARLING_MERGE_COUNT);
        const unitIds = mergeStarlings.map((unit) => this.game!.getUnitNetworkId(unit));
        this.game.applyStarlingMerge(player, unitIds, targetPosition);
        this.sendNetworkCommand('starling_merge', {
            unitIds,
            targetX: targetPosition.x,
            targetY: targetPosition.y
        });

        for (const unit of this.selectedUnits) {
            unit.isSelected = false;
        }
        this.selectedUnits.clear();
        this.renderer.selectedUnits = this.selectedUnits;
        return true;
    }

    private getClosestSelectedStarling(worldPos: Vector2D): Starling | null {
        let closestStarling: Starling | null = null;
        let closestDistanceSq = Infinity;

        for (const unit of this.selectedUnits) {
            if (!(unit instanceof Starling)) {
                continue;
            }
            const dx = unit.position.x - worldPos.x;
            const dy = unit.position.y - worldPos.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq <= Constants.STARLING_MERGE_HOLD_RADIUS_PX * Constants.STARLING_MERGE_HOLD_RADIUS_PX
                && distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestStarling = unit;
            }
        }

        return closestStarling;
    }

    private updateAbilityArrowStarts(): void {
        this.abilityArrowStarts.length = 0;
        if (this.selectionStartScreen) {
            this.abilityArrowStarts.push(this.selectionStartScreen);
        }
        for (const unit of this.selectedUnits) {
            if (unit.isHero) {
                this.abilityArrowStarts.push(this.renderer.worldToScreen(unit.position));
            }
        }
        this.renderer.abilityArrowStarts = this.abilityArrowStarts;
    }

    /**
     * Check if a world position is near any selected unit
     */
    private isDragStartNearSelectedUnits(worldPos: Vector2D): boolean {
        if (this.selectedUnits.size === 0) return false;
        
        for (const unit of this.selectedUnits) {
            const distance = unit.position.distanceTo(worldPos);
            if (distance <= Constants.UNIT_PATH_DRAW_RADIUS) {
                return true;
            }
        }
        return false;
    }

    private isDragStartNearSelectedMirrors(worldPos: Vector2D): boolean {
        if (this.selectedMirrors.size === 0) {
            return false;
        }

        for (const mirror of this.selectedMirrors) {
            if (mirror.containsPoint(worldPos)) {
                return true;
            }
        }

        return false;
    }

    private getHeroUnitType(heroName: string): string | null {
        switch (heroName) {
            case 'Marine':
            case 'Grave':
            case 'Ray':
            case 'Dagger':
            case 'Beam':
            case 'Driller':
            case 'Nova':
            case 'Sly':
                return heroName;
            case 'Influence Ball':
                return 'InfluenceBall';
            case 'Turret Deployer':
                return 'TurretDeployer';
            default:
                return null;
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
            case 'Nova':
                return unit instanceof Nova;
            case 'Sly':
                return unit instanceof Sly;
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

    private getClosestSelectedMirror(player: Player, worldPos: Vector2D): { mirror: SolarMirror | null; mirrorIndex: number } {
        let closestMirror: SolarMirror | null = null;
        let closestMirrorIndex = -1;
        let closestDistanceSq = Infinity;

        for (let i = 0; i < player.solarMirrors.length; i++) {
            const mirror = player.solarMirrors[i];
            if (!mirror.isSelected) continue;

            const dx = mirror.position.x - worldPos.x;
            const dy = mirror.position.y - worldPos.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestMirror = mirror;
                closestMirrorIndex = i;
            }
        }

        return { mirror: closestMirror, mirrorIndex: closestMirrorIndex };
    }

    private getTargetableStructureAtPosition(
        worldPos: Vector2D,
        player: Player
    ): {
        target: StellarForge | Building | SolarMirror;
        targetPlayerIndex: number;
        structureType: 'forge' | 'building' | 'mirror';
        structureIndex: number;
    } | null {
        if (!this.game) {
            return null;
        }

        for (let playerIndex = 0; playerIndex < this.game.players.length; playerIndex++) {
            const targetPlayer = this.game.players[playerIndex];
            if (!targetPlayer || targetPlayer === player) {
                continue;
            }

            if (targetPlayer.stellarForge && targetPlayer.stellarForge.containsPoint(worldPos)) {
                return {
                    target: targetPlayer.stellarForge,
                    targetPlayerIndex: playerIndex,
                    structureType: 'forge',
                    structureIndex: -1
                };
            }

            for (let mirrorIndex = 0; mirrorIndex < targetPlayer.solarMirrors.length; mirrorIndex++) {
                const mirror = targetPlayer.solarMirrors[mirrorIndex];
                if (mirror.containsPoint(worldPos)) {
                    return {
                        target: mirror,
                        targetPlayerIndex: playerIndex,
                        structureType: 'mirror',
                        structureIndex: mirrorIndex
                    };
                }
            }

            for (let buildingIndex = 0; buildingIndex < targetPlayer.buildings.length; buildingIndex++) {
                const building = targetPlayer.buildings[buildingIndex];
                if (building.containsPoint(worldPos)) {
                    return {
                        target: building,
                        targetPlayerIndex: playerIndex,
                        structureType: 'building',
                        structureIndex: buildingIndex
                    };
                }
            }
        }

        return null;
    }

    private getFriendlySacrificeTargetAtPosition(
        worldPos: Vector2D,
        player: Player
    ): {
        target: SubsidiaryFactory;
        targetPlayerIndex: number;
        structureType: 'building';
        structureIndex: number;
    } | null {
        if (!this.game) {
            return null;
        }

        const playerIndex = this.game.players.indexOf(player);
        if (playerIndex < 0) {
            return null;
        }

        for (let buildingIndex = 0; buildingIndex < player.buildings.length; buildingIndex++) {
            const building = player.buildings[buildingIndex];
            if (!(building instanceof SubsidiaryFactory)) {
                continue;
            }
            if (!building.currentProduction) {
                continue;
            }
            if (building.containsPoint(worldPos)) {
                return {
                    target: building,
                    targetPlayerIndex: playerIndex,
                    structureType: 'building',
                    structureIndex: buildingIndex
                };
            }
        }

        return null;
    }

    private hasSelectedStarlingsOnly(): boolean {
        if (this.selectedUnits.size === 0) {
            return false;
        }
        for (const unit of this.selectedUnits) {
            if (!(unit instanceof Starling)) {
                return false;
            }
        }
        return true;
    }

    private getTargetStructureRadiusPx(target: StellarForge | Building | SolarMirror): number {
        if (target instanceof SolarMirror) {
            return Constants.MIRROR_CLICK_RADIUS_PX;
        }
        return target.radius;
    }

    /**
     * Handle foundry button press
     */
    private handleFoundryButtonPress(player: Player, foundry: SubsidiaryFactory, buttonIndex: number): void {
        if (!this.game) return;

        // Get building index for network sync
        const buildingId = player.buildings.indexOf(foundry);
        if (buildingId < 0) {
            console.error('Foundry not found in player buildings array');
            return;
        }

        if (buttonIndex === 0) {
            if (foundry.canQueueStrafeUpgrade() && player.spendEnergy(Constants.FOUNDRY_STRAFE_UPGRADE_COST)) {
                foundry.enqueueProduction(Constants.FOUNDRY_STRAFE_UPGRADE_ITEM);
                console.log('Queued foundry Strafe upgrade');
                this.sendNetworkCommand('foundry_strafe_upgrade', { buildingId });
                // Deselect foundry
                foundry.isSelected = false;
                this.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Strafe upgrade or not enough energy');
            }
        } else if (buttonIndex === 1) {
            if (foundry.canQueueBlinkUpgrade() && player.spendEnergy(Constants.FOUNDRY_BLINK_UPGRADE_COST)) {
                foundry.enqueueProduction(Constants.FOUNDRY_BLINK_UPGRADE_ITEM);
                console.log('Queued foundry Blink upgrade');
                this.sendNetworkCommand('foundry_blink_upgrade', { buildingId });
                // Deselect foundry
                foundry.isSelected = false;
                this.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Blink upgrade or not enough energy');
            }
        } else if (buttonIndex === 2) {
            if (foundry.canQueueRegenUpgrade() && player.spendEnergy(Constants.FOUNDRY_REGEN_UPGRADE_COST)) {
                foundry.enqueueProduction(Constants.FOUNDRY_REGEN_UPGRADE_ITEM);
                console.log('Queued foundry Regen upgrade');
                this.sendNetworkCommand('foundry_regen_upgrade', { buildingId });
                // Deselect foundry
                foundry.isSelected = false;
                this.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Regen upgrade or not enough energy');
            }
        } else if (buttonIndex === 3) {
            if (foundry.canQueueAttackUpgrade() && player.spendEnergy(Constants.FOUNDRY_ATTACK_UPGRADE_COST)) {
                foundry.enqueueProduction(Constants.FOUNDRY_ATTACK_UPGRADE_ITEM);
                console.log('Queued foundry +1 ATK upgrade');
                this.sendNetworkCommand('foundry_attack_upgrade', { buildingId });
                // Deselect foundry
                foundry.isSelected = false;
                this.selectedBuildings.clear();
            } else {
                console.log('Cannot queue +1 ATK upgrade or not enough energy');
            }
        }
    }

    /**
     * Check if this click is a double-tap
     */
    private isDoubleTap(screenX: number, screenY: number): boolean {
        const now = Date.now();
        const timeDiff = now - this.lastTapTime;
        
        if (timeDiff > this.DOUBLE_TAP_THRESHOLD_MS) {
            // Too much time passed, not a double-tap
            this.lastTapTime = now;
            this.lastTapPosition = new Vector2D(screenX, screenY);
            return false;
        }
        
        if (this.lastTapPosition) {
            // Use squared distance to avoid expensive Math.sqrt
            const distanceSquared = 
                Math.pow(screenX - this.lastTapPosition.x, 2) + 
                Math.pow(screenY - this.lastTapPosition.y, 2);
            
            const thresholdSquared = this.DOUBLE_TAP_POSITION_THRESHOLD * this.DOUBLE_TAP_POSITION_THRESHOLD;
            
            if (distanceSquared <= thresholdSquared) {
                // This is a double-tap!
                this.lastTapTime = 0; // Reset to avoid triple-tap being detected as another double-tap
                this.lastTapPosition = null;
                return true;
            }
        }
        
        // Not close enough, update position
        this.lastTapTime = now;
        this.lastTapPosition = new Vector2D(screenX, screenY);
        return false;
    }

    private clearWarpGateSelection(): void {
        this.selectedWarpGate = null;
        this.renderer.selectedWarpGate = null;
        this.renderer.highlightedButtonIndex = -1;
    }

    private getWarpGateAtPosition(worldPos: Vector2D, player: Player): WarpGate | null {
        if (!this.game) {
            return null;
        }

        for (const gate of this.game.warpGates) {
            if (!gate.isComplete || gate.owner !== player) {
                continue;
            }
            const distance = gate.position.distanceTo(worldPos);
            if (distance <= Constants.WARP_GATE_RADIUS) {
                return gate;
            }
        }
        return null;
    }

    private getWarpGateButtonIndexFromClick(
        gate: WarpGate,
        screenX: number,
        screenY: number
    ): number {
        const gateScreenPos = this.renderer.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * this.renderer.zoom;
        const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.renderer.zoom;
        const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.renderer.zoom;
        const positions = this.getRadialButtonOffsets(4);

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const buttonScreenX = gateScreenPos.x + pos.x * buttonDistance;
            const buttonScreenY = gateScreenPos.y + pos.y * buttonDistance;
            const dx = screenX - buttonScreenX;
            const dy = screenY - buttonScreenY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= buttonRadius) {
                return i;
            }
        }

        return -1;
    }

    private getWarpGateButtonDirection(buttonIndex: number): Vector2D | null {
        const directions = this.getRadialButtonOffsets(4);
        const direction = directions[buttonIndex];
        if (!direction) {
            return null;
        }
        return new Vector2D(direction.x, direction.y);
    }

    private getWarpGateButtonWorldPosition(gate: WarpGate, buttonIndex: number): Vector2D | null {
        const direction = this.getWarpGateButtonDirection(buttonIndex);
        if (!direction) {
            return null;
        }
        const buttonDistanceWorld = Constants.WARP_GATE_RADIUS + Constants.WARP_GATE_BUTTON_OFFSET;
        return new Vector2D(
            gate.position.x + direction.x * buttonDistanceWorld,
            gate.position.y + direction.y * buttonDistanceWorld
        );
    }

    private buildFromWarpGate(player: Player, gate: WarpGate, buttonIndex: number): void {
        if (!gate.isComplete || gate.owner !== player) {
            return;
        }
        const gatePosition = new Vector2D(gate.position.x, gate.position.y);
        const hasSubFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);

        if (buttonIndex === 0) {
            if (hasSubFactory) {
                console.log('Only one Foundry can exist at a time');
                return;
            }
            if (!player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                console.log('Not enough energy to build Foundry');
                return;
            }
            const subFactory = new SubsidiaryFactory(gatePosition, player);
            player.buildings.push(subFactory);
            console.log(`Foundry building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
            this.sendNetworkCommand('building_purchase', {
                buildingType: 'SubsidiaryFactory',
                positionX: gate.position.x,
                positionY: gate.position.y
            });
        } else if (buttonIndex === 1) {
            // Faction-specific button 1
            if (player.faction === Faction.RADIANT) {
                // Radiant: Cannon
                if (!player.spendEnergy(Constants.MINIGUN_COST)) {
                    console.log('Not enough energy to build Cannon');
                    return;
                }
                const minigun = new Minigun(gatePosition, player);
                player.buildings.push(minigun);
                console.log(`Cannon building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'Minigun',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                // Velaris: Striker Tower
                if (!player.spendEnergy(Constants.STRIKER_TOWER_COST)) {
                    console.log('Not enough energy to build Striker Tower');
                    return;
                }
                const striker = new StrikerTower(gatePosition, player);
                player.buildings.push(striker);
                console.log(`Striker Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'StrikerTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else if (buttonIndex === 2) {
            // Faction-specific button 2
            if (player.faction === Faction.RADIANT) {
                // Radiant: Gatling Tower
                if (!player.spendEnergy(Constants.GATLING_COST)) {
                    console.log('Not enough energy to build Gatling Tower');
                    return;
                }
                const gatling = new GatlingTower(gatePosition, player);
                player.buildings.push(gatling);
                console.log(`Gatling Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'Gatling',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                // Velaris: Lock-on Laser Tower
                if (!player.spendEnergy(Constants.LOCKON_TOWER_COST)) {
                    console.log('Not enough energy to build Lock-on Laser Tower');
                    return;
                }
                const lockon = new LockOnLaserTower(gatePosition, player);
                player.buildings.push(lockon);
                console.log(`Lock-on Laser Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'LockOnLaserTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else if (buttonIndex === 3) {
            // Faction-specific button 3
            if (player.faction === Faction.RADIANT) {
                // Radiant: Shield Tower
                if (!player.spendEnergy(Constants.SHIELD_TOWER_COST)) {
                    console.log('Not enough energy to build Shield Tower');
                    return;
                }
                const shield = new ShieldTower(gatePosition, player);
                player.buildings.push(shield);
                console.log(`Shield Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'ShieldTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                // Velaris: Cyclone (SpaceDustSwirler)
                if (!player.spendEnergy(Constants.SWIRLER_COST)) {
                    console.log('Not enough energy to build Cyclone');
                    return;
                }
                const swirler = new SpaceDustSwirler(gatePosition, player);
                player.buildings.push(swirler);
                console.log(`Cyclone building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.sendNetworkCommand('building_purchase', {
                    buildingType: 'SpaceDustSwirler',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else {
            return;
        }

        this.scatterParticles(gate.position);
        this.removeWarpGate(gate);
    }

    private removeWarpGate(gate: WarpGate): void {
        if (!this.game) {
            return;
        }

        const gateIndex = this.game.warpGates.indexOf(gate);
        if (gateIndex > -1) {
            this.game.warpGates.splice(gateIndex, 1);
        }
        if (this.currentWarpGate === gate) {
            this.currentWarpGate = null;
        }
        if (this.selectedWarpGate === gate) {
            this.clearWarpGateSelection();
        }
        this.implodeParticles(gate.position);
    }

    private tryCreateWarpGateAt(worldPos: Vector2D): boolean {
        if (!this.game) {
            return false;
        }
        const player = this.getLocalPlayer();
        if (!player || this.selectedMirrors.size === 0) {
            return false;
        }

        if (!this.canCreateWarpGateFromSelectedMirrors(worldPos)) {
            return false;
        }

        const warpGate = new WarpGate(worldPos, player);
        warpGate.startCharging();
        this.game.warpGates.push(warpGate);
        this.currentWarpGate = warpGate;
        this.shouldSkipMoveOrderThisTap = true;

        for (const mirror of this.selectedMirrors) {
            mirror.setLinkedStructure(warpGate);
            mirror.isSelected = false;
        }
        this.selectedMirrors.clear();
        this.renderer.selectedMirrors = this.selectedMirrors;

        console.log('Mirror-based warp gate created at', worldPos);

        this.mirrorCommandMode = null;
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
        return true;
    }

    private canCreateWarpGateFromSelectedMirrors(targetPos?: Vector2D): boolean {
        if (!this.game) {
            return false;
        }

        for (const mirror of this.selectedMirrors) {
            if (!mirror.hasLineOfSightToLight(this.game.suns, this.game.asteroids)) {
                continue;
            }

            if (!targetPos) {
                return true;
            }

            const ray = new LightRay(
                mirror.position,
                new Vector2D(
                    targetPos.x - mirror.position.x,
                    targetPos.y - mirror.position.y
                ).normalize(),
                1.0
            );

            let hasLineOfSight = true;
            for (const asteroid of this.game.asteroids) {
                if (ray.intersectsPolygon(asteroid.getWorldVertices())) {
                    hasLineOfSight = false;
                    break;
                }
            }

            if (hasLineOfSight) {
                return true;
            }
        }

        return false;
    }

    /**
     * Clear all selections and deselect all entities
     */
    private clearAllSelections(): void {
        const player = this.getLocalPlayer();
        if (!player) return;
        
        // Clear selection sets
        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;
        this.selectedBuildings.clear();
        this.clearWarpGateSelection();
        this.mirrorCommandMode = null;
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
        
        // Deselect all entities
        if (player.stellarForge) {
            player.stellarForge.isSelected = false;
        }
        for (const mirror of player.solarMirrors) {
            mirror.isSelected = false;
        }
        for (const building of player.buildings) {
            building.isSelected = false;
        }
        
        this.renderer.selectedUnits = this.selectedUnits;
        this.renderer.selectedMirrors = this.selectedMirrors;
    }

    /**
     * Select all starlings owned by the player
     */
    private selectAllStarlings(): void {
        if (!this.game) return;
        
        const player = this.getLocalPlayer();
        if (!player) return;
        
        // Clear all selections
        this.clearAllSelections();
        
        // Select all starlings
        for (const unit of player.units) {
            if (unit instanceof Starling) {
                this.selectedUnits.add(unit);
            }
        }
        
        this.renderer.selectedUnits = this.selectedUnits;
        console.log(`Double-tap: Selected all ${this.selectedUnits.size} starlings`);
    }

    /**
     * Select all buildings of the same type as the clicked building
     */
    private selectAllBuildingsOfType(clickedBuilding: Building): void {
        if (!this.game) return;
        
        const player = this.getLocalPlayer();
        if (!player) return;
        
        // Clear all selections
        this.clearAllSelections();
        
        // Select all buildings of the same type
        const buildingType = clickedBuilding.constructor;
        for (const building of player.buildings) {
            if (building.constructor === buildingType) {
                building.isSelected = true;
                this.selectedBuildings.add(building);
            }
        }
        
        console.log(`Double-tap: Selected all ${this.selectedBuildings.size} buildings of type ${buildingType.name}`);
    }

    private getClickedHeroButton(
        screenX: number,
        screenY: number,
        forge: StellarForge,
        heroNames: string[]
    ): { heroName: string; buttonPos: Vector2D } | null {
        // Convert forge position to screen space
        const forgeScreenPos = this.renderer.worldToScreen(forge.position);
        
        // Button measurements in screen space (affected by zoom)
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * this.renderer.zoom;
        const buttonDistance = Constants.HERO_BUTTON_DISTANCE_PX * this.renderer.zoom;
        
        const maxButtons = 4;
        const displayHeroes = heroNames.slice(0, maxButtons);
        const positions = this.getRadialButtonOffsets(displayHeroes.length);
        for (let i = 0; i < displayHeroes.length; i++) {
            const pos = positions[i];
            // Calculate button position in screen space
            const buttonScreenX = forgeScreenPos.x + pos.x * buttonDistance;
            const buttonScreenY = forgeScreenPos.y + pos.y * buttonDistance;
            
            // Check distance in screen space
            const dx = screenX - buttonScreenX;
            const dy = screenY - buttonScreenY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= buttonRadius) {
                // Convert button screen position back to world position for the wave effect
                const buttonWorldPos = this.renderer.screenToWorld(buttonScreenX, buttonScreenY);
                return { heroName: displayHeroes[i], buttonPos: buttonWorldPos };
            }
        }
        return null;
    }

    private getClickedFoundryButtonIndex(
        screenX: number,
        screenY: number,
        foundry: SubsidiaryFactory
    ): number {
        const foundryScreenPos = this.renderer.worldToScreen(foundry.position);
        const buttonRadius = Constants.HERO_BUTTON_RADIUS_PX * this.renderer.zoom;
        const buttonDistance = Constants.HERO_BUTTON_DISTANCE_PX * this.renderer.zoom;
        const positions = this.getRadialButtonOffsets(4);

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const buttonScreenX = foundryScreenPos.x + pos.x * buttonDistance;
            const buttonScreenY = foundryScreenPos.y + pos.y * buttonDistance;
            const dx = screenX - buttonScreenX;
            const dy = screenY - buttonScreenY;
            if (Math.sqrt(dx * dx + dy * dy) <= buttonRadius) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Get the nearest button index based on drag angle from building position
     * For stellar forge: 4 buttons in cardinal directions (top=0, right=1, bottom=2, left=3)
     */
    private getNearestButtonIndexFromAngle(
        dragAngleRad: number,
        numButtons: number
    ): number {
        if (numButtons <= 0) {
            return -1;
        }
        if (numButtons === 1) {
            return 0;
        }

        const fullRotationRad = Math.PI * 2;
        const normalizedAngleRad = ((dragAngleRad % fullRotationRad) + fullRotationRad) % fullRotationRad;
        const startAngleRad = -Math.PI / 2;
        let offsetAngleRad = normalizedAngleRad - startAngleRad;
        offsetAngleRad = ((offsetAngleRad % fullRotationRad) + fullRotationRad) % fullRotationRad;

        const stepAngleRad = fullRotationRad / numButtons;
        const nearestIndex = Math.round(offsetAngleRad / stepAngleRad) % numButtons;
        return nearestIndex;
    }

    private getNearestMirrorButtonIndexFromAngle(
        dragAngleRad: number,
        shouldShowFoundryButton: boolean
    ): number {
        const buttonCount = shouldShowFoundryButton ? 3 : 2;
        return this.getNearestButtonIndexFromAngle(dragAngleRad, buttonCount);
    }

    private getBuildingAbilityAnchorScreen(): Vector2D | null {
        if (this.selectedBase) {
            return this.renderer.worldToScreen(this.selectedBase.position);
        }

        if (this.selectedMirrors.size > 0) {
            for (const mirror of this.selectedMirrors) {
                return this.renderer.worldToScreen(mirror.position);
            }
        }

        if (this.selectedWarpGate) {
            return this.renderer.worldToScreen(this.selectedWarpGate.position);
        }

        if (this.selectedBuildings.size === 1) {
            const selectedBuilding = Array.from(this.selectedBuildings)[0];
            if (selectedBuilding instanceof SubsidiaryFactory) {
                return this.renderer.worldToScreen(selectedBuilding.position);
            }
        }

        return null;
    }

    private getRadialButtonOffsets(buttonCount: number): Array<{ x: number; y: number }> {
        if (buttonCount <= 0) {
            return [];
        }
        const positions: Array<{ x: number; y: number }> = [];
        const startAngleRad = -Math.PI / 2;
        const stepAngleRad = (Math.PI * 2) / buttonCount;

        for (let i = 0; i < buttonCount; i++) {
            const angleRad = startAngleRad + stepAngleRad * i;
            positions.push({ x: Math.cos(angleRad), y: Math.sin(angleRad) });
        }
        return positions;
    }

    private clearPathPreview(): void {
        this.pathPoints = [];
        this.isDrawingPath = false;
        this.renderer.pathPreviewForge = null;
        this.renderer.pathPreviewPoints = this.pathPoints;
        this.renderer.pathPreviewEnd = null;
    }

    private toggleInGameMenu(): void {
        this.showInGameMenu = !this.showInGameMenu;
        this.isPaused = this.showInGameMenu;
        this.renderer.showInGameMenu = this.showInGameMenu;
        this.renderer.isPaused = this.isPaused;
    }

    private toggleInfo(): void {
        this.showInfo = !this.showInfo;
        this.renderer.showInfo = this.showInfo;
    }

    private getLocalPlayer(): Player | null {
        if (!this.game) {
            return null;
        }
        return this.game.players[this.localPlayerIndex] ?? null;
    }

    private sendNetworkCommand(command: string, data: Record<string, unknown>): void {
        // LAN multiplayer
        if (this.game && this.game.networkManager) {
            this.game.sendGameCommand(command, data);
            return;
        }
        
        // P2P multiplayer
        if (this.isMultiplayer && this.network) {
            this.network.sendCommand(command, data);
            return;
        }
        
        // Single-player: No-op (game state already updated locally before calling this)
    }

    private surrender(): void {
        if (!this.game) return;
        
        // Set player's forge health to 0 to trigger defeat
        const player = this.getLocalPlayer();
        if (!player) {
            return;
        }
        if (player.stellarForge) {
            player.stellarForge.health = 0;
        }
        
        // Close menu
        this.showInGameMenu = false;
        this.isPaused = false;
        this.renderer.showInGameMenu = false;
        this.renderer.isPaused = false;
        
        console.log('Player surrendered');
    }

    private returnToMainMenu(): void {
        // Stop the game
        this.stop();
        this.game = null;
        
        // Clear selections
        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;
        this.selectedBuildings.clear();
        this.clearWarpGateSelection();
        this.renderer.selectedUnits = this.selectedUnits;
        this.renderer.selectedMirrors = this.selectedMirrors;
        
        // Reset states
        this.isPaused = false;
        this.showInGameMenu = false;
        this.showInfo = this.menu.getSettings().isBattleStatsInfoEnabled;
        this.renderer.showInGameMenu = false;
        this.renderer.isPaused = false;
        this.renderer.showInfo = this.showInfo;
        
        // Show main menu
        this.menu.show();
    }

    constructor() {
        // Create canvas
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        // Initialize renderer
        this.renderer = new GameRenderer(canvas);

        // Create and show main menu
        this.menu = new MainMenu();
        this.menu.onStart((settings: GameSettings) => this.startNewGame(settings));
        this.showInfo = this.menu.getSettings().isBattleStatsInfoEnabled;
        this.renderer.showInfo = this.showInfo;

        // Set up input handlers
        this.setupInputHandlers(canvas);
    }

    /**
     * Initialize P2P multiplayer mode
     */
    initializeMultiplayer(supabaseUrl: string, supabaseKey: string, playerId: string): void {
        console.log('[GameController] Initializing P2P multiplayer...');
        
        this.network = new MultiplayerNetworkManager(supabaseUrl, supabaseKey, playerId);
        this.isMultiplayer = true;

        this.setupNetworkEvents();
    }

    /**
     * Setup network event handlers for P2P multiplayer
     */
    private setupNetworkEvents(): void {
        if (!this.network) return;

        this.network.on(NetworkEvent.MATCH_CREATED, (data) => {
            console.log('[GameController] P2P match created:', data.match.id);
        });

        this.network.on(NetworkEvent.PLAYER_JOINED, (data) => {
            console.log('[GameController] Player joined:', data.username);
        });

        this.network.on(NetworkEvent.CONNECTING, () => {
            console.log('[GameController] Establishing P2P connections...');
        });

        this.network.on(NetworkEvent.CONNECTED, () => {
            console.log('[GameController] All players connected!');
        });

        this.network.on(NetworkEvent.MATCH_STARTED, (data) => {
            console.log('[GameController] P2P match started! Seed:', data.seed);
        });

        this.network.on(NetworkEvent.COMMAND_RECEIVED, (data) => {
            console.log('[GameController] Command received:', data.command);
        });

        this.network.on(NetworkEvent.MATCH_ENDED, (data) => {
            console.log('[GameController] P2P match ended:', data.reason);
        });

        this.network.on(NetworkEvent.ERROR, (data) => {
            console.error('[GameController] Network error:', data.error);
        });
    }

    private startNewGame(settings: GameSettings): void {
        // Create game based on selected map
        this.game = this.createGameFromSettings(settings);
        this.renderer.selectedHeroNames = settings.selectedHeroNames;
        
        // Set player and enemy colors from settings
        this.renderer.playerColor = settings.playerColor;
        this.renderer.enemyColor = settings.enemyColor;
        
        // Set color scheme from settings
        const colorScheme = COLOR_SCHEMES[settings.colorScheme];
        if (colorScheme) {
            this.renderer.colorScheme = colorScheme;
        }
        
        // Set damage and health display modes from settings
        this.renderer.damageDisplayMode = settings.damageDisplayMode;
        this.renderer.healthDisplayMode = settings.healthDisplayMode;
        this.game.damageDisplayMode = settings.damageDisplayMode;
        
        // Set screen shake from settings
        this.renderer.screenShakeEnabled = settings.screenShakeEnabled;
        
        // Set graphics quality from settings
        this.renderer.graphicsQuality = settings.graphicsQuality;
        
        // Set up network manager for LAN play
        this.localPlayerIndex = 0;
        if (settings.gameMode === 'lan' && settings.networkManager) {
            // Determine local player index based on whether this client is the host
            const isHost = settings.networkManager.isLobbyHost();
            const localPlayerIndex = isHost ? 0 : 1;
            this.localPlayerIndex = localPlayerIndex;
            
            // Set up AI flag for players (local player is not AI, remote player is not AI either)
            if (this.game.players[0]) {
                this.game.players[0].isAi = false;
            }
            if (this.game.players[1]) {
                this.game.players[1].isAi = false;
            }
            
            // Set up network manager in game state
            this.game.setupNetworkManager(settings.networkManager, localPlayerIndex);
            
            console.log(`LAN mode: Local player is Player ${localPlayerIndex + 1} (${isHost ? 'Host' : 'Client'})`);
        }
        
        // Set the viewing player for the renderer (player 1 is the human player)
        const localPlayer = this.getLocalPlayer();
        if (localPlayer) {
            this.renderer.viewingPlayer = localPlayer;
            
            // Center camera on player's base and zoom in halfway
            if (localPlayer.stellarForge) {
                this.renderer.setCameraPosition(localPlayer.stellarForge.position);
                this.renderer.setZoom(0.5); // Halfway zoomed in
            }
        }

        this.showInfo = settings.isBattleStatsInfoEnabled;
        this.renderer.showInfo = this.showInfo;

        // Start game loop
        this.start();
    }

    private createGameFromSettings(settings: GameSettings): GameState {
        const playerFaction = settings.selectedFaction ?? Faction.RADIANT;
        const aiFaction = Faction.RADIANT;
        const colorScheme = COLOR_SCHEMES[settings.colorScheme];
        const game = createStandardGame([
            ['Player 1', playerFaction],
            ['Player 2', aiFaction]
        ], colorScheme?.spaceDustPalette);

        // Clear and recreate based on map settings
        const map = settings.selectedMap;
        
        // Set map size
        game.mapSize = map.mapSize;
        
        // Clear existing suns and add new ones based on map
        game.suns = [];
        
        if (map.id === 'twin-suns') {
            // Two suns positioned diagonally
            game.suns.push(new Sun(new Vector2D(-300, -300), 1.0, 100.0));
            game.suns.push(new Sun(new Vector2D(300, 300), 1.0, 100.0));
        } else if (map.id === 'test-level') {
            // Single sun at center for test level
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        } else if (map.id === 'lad') {
            // LaD (Light and Dark) - special dual-nature sun
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'lad'));
        } else {
            // Single sun at center (default for all other maps)
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        }

        if (map.id === 'test-level') {
            const leftForgePosition = new Vector2D(-700, 0);
            const rightForgePosition = new Vector2D(700, 0);
            const mirrorOffset = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
            const mirrorPositionsLeft = [
                new Vector2D(leftForgePosition.x, leftForgePosition.y - mirrorOffset),
                new Vector2D(leftForgePosition.x, leftForgePosition.y + mirrorOffset)
            ];
            const mirrorPositionsRight = [
                new Vector2D(rightForgePosition.x, rightForgePosition.y - mirrorOffset),
                new Vector2D(rightForgePosition.x, rightForgePosition.y + mirrorOffset)
            ];

            const playerPositions = [leftForgePosition, rightForgePosition];
            const mirrorPositions = [mirrorPositionsLeft, mirrorPositionsRight];

            for (let i = 0; i < game.players.length; i++) {
                const player = game.players[i];
                const forgePosition = playerPositions[i] ?? leftForgePosition;
                const mirrorPositionSet = mirrorPositions[i] ?? mirrorPositionsLeft;
                player.stellarForge = null;
                player.solarMirrors = [];
                game.initializePlayer(player, forgePosition, mirrorPositionSet);
            }

            if (game.players.length >= 2) {
                const player = game.players[0];
                const enemyPlayer = game.players[1];
                if (player.stellarForge && enemyPlayer.stellarForge) {
                    player.stellarForge.initializeDefaultPath(enemyPlayer.stellarForge.position);
                    enemyPlayer.stellarForge.initializeDefaultPath(player.stellarForge.position);
                }
            }

            game.asteroids = [];
            game.spaceDust = [];
            return game;
        }
        
        // Reinitialize asteroids based on map (keeps strategic asteroids from createStandardGame)
        // Clear only the random asteroids (first 10), keep the strategic ones (last 2)
        const strategicAsteroids = game.asteroids.slice(-2); // Keep last 2 strategic asteroids
        game.asteroids = [];
        game.initializeAsteroids(map.numAsteroids, map.mapSize, map.mapSize);
        
        // For standard map, add strategic asteroids back
        if (map.id === 'standard') {
            game.asteroids.push(...strategicAsteroids);
        }
        
        // Reinitialize space dust
        game.spaceDust = [];
        const particleCount = map.id === 'test-level' ? 3000 : Constants.SPACE_DUST_PARTICLE_COUNT;
        game.initializeSpaceDust(particleCount, map.mapSize, map.mapSize, colorScheme?.spaceDustPalette);
        
        return game;
    }

    private setupInputHandlers(canvas: HTMLCanvasElement): void {
        // Helper function to detect mobile/tablet devices
        const isMobileDevice = (): boolean => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                || ('ontouchstart' in window);
        };

        const getCanvasPosition = (clientX: number, clientY: number): { x: number; y: number } => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        // Touch/Mouse support for mobile and desktop
        let isPanning = false;
        let isMouseDown = false;
        let lastX = 0;
        let lastY = 0;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let lastPinchDistance = 0;

        // Edge panning constants (desktop only)
        const EDGE_PAN_THRESHOLD = 20; // pixels from edge
        const EDGE_PAN_SPEED = 5; // pixels per frame
        
        // Mobile touch constants
        const PINCH_ZOOM_THRESHOLD = 1; // minimum pixel change to trigger zoom

        // Store mobile detection result
        const isMobile = isMobileDevice();

        // Keyboard panning state
        const keysPressed = new Set<string>();

        // Mouse wheel zoom - zoom towards cursor
        canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();

            if (this.showInGameMenu) {
                const menuPos = getCanvasPosition(e.clientX, e.clientY);
                const didScrollMenu = this.renderer.handleInGameMenuScroll(menuPos.x, menuPos.y, e.deltaY);
                if (didScrollMenu) {
                    return;
                }
            }

            const screenPos = getCanvasPosition(e.clientX, e.clientY);
            
            // Get world position under mouse before zoom
            const worldPosBeforeZoom = this.renderer.screenToWorld(screenPos.x, screenPos.y);
            
            // Apply zoom
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            const oldZoom = this.renderer.zoom;
            this.renderer.setZoom(oldZoom * zoomDelta);
            
            // Get world position under mouse after zoom
            const worldPosAfterZoom = this.renderer.screenToWorld(screenPos.x, screenPos.y);
            
            // Adjust camera to keep world position under cursor the same
            const currentCamera = this.renderer.camera;
            this.renderer.setCameraPositionWithoutParallax(new Vector2D(
                currentCamera.x + (worldPosBeforeZoom.x - worldPosAfterZoom.x),
                currentCamera.y + (worldPosBeforeZoom.y - worldPosAfterZoom.y)
            ));
        });

        // Touch/Mouse selection and pan
        const startDrag = (x: number, y: number) => {
            lastX = x;
            lastY = y;
            this.selectionStartScreen = new Vector2D(x, y);
            this.isSelecting = false;
            
            // Start warp gate hold timer
            const worldPos = this.renderer.screenToWorld(x, y);
            this.startHold(worldPos);
        };

        const moveDrag = (x: number, y: number, isTwoFinger: boolean = false) => {
            if (!isMouseDown) {
                // Not dragging, just tracking mouse position
                lastX = x;
                lastY = y;
                return;
            }
            
            const dx = x - lastX;
            const dy = y - lastY;
            const totalMovement = Math.sqrt(dx * dx + dy * dy);
            
            // Two-finger touch should always pan the camera immediately (no threshold)
            // This provides smooth, native-like panning behavior on mobile devices
            if (isTwoFinger) {
                if (!isPanning) {
                    isPanning = true;
                    this.cancelHold();
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                }
                
                // Update camera position (inverted for natural panning)
                const currentCamera = this.renderer.camera;
                this.renderer.setCameraPosition(new Vector2D(
                    currentCamera.x - dx / this.renderer.zoom,
                    currentCamera.y - dy / this.renderer.zoom
                ));
            } else if (totalMovement > Constants.CLICK_DRAG_THRESHOLD) {
                // Single-finger/mouse drag needs a threshold to distinguish from taps
                // Check if only hero units are selected - if so, show arrow instead of selection box
                const hasHeroUnits = this.hasHeroUnitsSelected();
                const dragStartWorld = this.selectionStartScreen
                    ? this.renderer.screenToWorld(this.selectionStartScreen.x, this.selectionStartScreen.y)
                    : null;
                
                if (!this.isSelecting && !isPanning && !this.isDraggingHeroArrow && !this.isDraggingBuildingArrow && !this.isDrawingPath) {
                    const isDragStartOnSelectedBase = Boolean(
                        this.selectedBase &&
                        this.selectedBase.isSelected &&
                        dragStartWorld &&
                        this.selectedBase.containsPoint(dragStartWorld)
                    );
                    const isDragStartOnSelectedMirror = Boolean(
                        dragStartWorld && this.isDragStartNearSelectedMirrors(dragStartWorld)
                    );
                    const isDragStartOnSelectedWarpGate = Boolean(
                        this.selectedWarpGate &&
                        dragStartWorld &&
                        dragStartWorld.distanceTo(this.selectedWarpGate.position) <= Constants.WARP_GATE_RADIUS
                    );

                    if (isDragStartOnSelectedBase) {
                        // Drawing a path from the selected base
                        this.isDrawingPath = true;
                        this.pathPoints = [];
                        this.renderer.pathPreviewForge = this.selectedBase;
                        this.renderer.pathPreviewPoints = this.pathPoints;
                        this.cancelHold();
                    } else if (isDragStartOnSelectedMirror) {
                        // Drawing a path from selected solar mirrors
                        this.isDrawingPath = true;
                        this.pathPoints = [];
                        this.renderer.pathPreviewForge = null;
                        this.renderer.pathPreviewPoints = this.pathPoints;
                        this.cancelHold();
                    } else if (isDragStartOnSelectedWarpGate) {
                        this.isDraggingBuildingArrow = true;
                        this.cancelHold();
                    } else if (this.selectedBuildings.size === 1) {
                        // Check if a foundry is selected
                        const selectedBuilding = Array.from(this.selectedBuildings)[0];
                        if (selectedBuilding instanceof SubsidiaryFactory && selectedBuilding.isComplete) {
                            // Foundry is selected - use building arrow mode
                            this.isDraggingBuildingArrow = true;
                            this.cancelHold();
                        }
                    } else if ((this.selectedBase || this.selectedMirrors.size > 0 || this.selectedWarpGate) && this.selectedUnits.size === 0) {
                        // Stellar forge or mirror selected - use building arrow mode even when dragging from empty space
                        this.isDraggingBuildingArrow = true;
                        this.cancelHold();
                    } else if (this.selectedUnits.size > 0 && this.selectionStartScreen) {
                        // Check if drag started near selected units - if so, draw movement path
                        if (dragStartWorld && this.isDragStartNearSelectedUnits(dragStartWorld)) {
                            // Drawing a movement path for selected units
                            this.isDrawingPath = true;
                            this.pathPoints = [];
                            this.renderer.pathPreviewForge = null; // No forge for unit paths
                            this.renderer.pathPreviewPoints = this.pathPoints;
                            this.cancelHold();
                        } else if (hasHeroUnits) {
                            // For hero units away from units, use arrow dragging mode
                            this.isDraggingHeroArrow = true;
                            this.cancelHold();
                        } else {
                            // For regular (non-hero) units when drag doesn't start near them, use selection rectangle
                            this.isSelecting = true;
                            this.cancelHold();
                        }
                    } else if (hasHeroUnits) {
                        // For hero units, use arrow dragging mode
                        this.isDraggingHeroArrow = true;
                        this.cancelHold();
                    } else {
                        // For regular units or no selection, use selection rectangle
                        this.isSelecting = true;
                        this.cancelHold();
                    }
                }
            }
            
            // Update visual feedback continuously (not just when threshold exceeded)
            // This fixes the janky rectangle/arrow update issue
            if (this.isSelecting) {
                // Update selection rectangle (for normal unit selection)
                this.renderer.selectionStart = this.selectionStartScreen;
                this.renderer.selectionEnd = new Vector2D(x, y);
            } else if (this.isDraggingHeroArrow) {
                // Update arrow direction (for hero ability casting)
                this.updateAbilityArrowStarts();
                if (this.selectionStartScreen) {
                    const dragDeltaX = x - this.selectionStartScreen.x;
                    const dragDeltaY = y - this.selectionStartScreen.y;
                    const dragLengthPx = Math.sqrt(dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY);
                    if (dragLengthPx > 0) {
                        this.renderer.abilityArrowDirection = new Vector2D(
                            dragDeltaX / dragLengthPx,
                            dragDeltaY / dragLengthPx
                        );
                    } else {
                        this.renderer.abilityArrowDirection = null;
                    }
                    this.renderer.abilityArrowLengthPx = dragLengthPx;
                } else {
                    this.renderer.abilityArrowDirection = null;
                    this.renderer.abilityArrowLengthPx = 0;
                }
            } else if (this.isDraggingBuildingArrow) {
                // Update arrow direction for building abilities
                const player = this.getLocalPlayer();
                const buildingAbilityAnchor = this.getBuildingAbilityAnchorScreen();
                const buildingAbilityStart = buildingAbilityAnchor ?? this.selectionStartScreen;
                if (buildingAbilityStart) {
                    this.renderer.buildingAbilityArrowStart = buildingAbilityStart;
                    if (this.selectionStartScreen) {
                        const dragDeltaX = x - this.selectionStartScreen.x;
                        const dragDeltaY = y - this.selectionStartScreen.y;
                        const dragLengthPx = Math.sqrt(dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY);
                        if (dragLengthPx > 0) {
                            this.renderer.buildingAbilityArrowDirection = new Vector2D(
                                dragDeltaX / dragLengthPx,
                                dragDeltaY / dragLengthPx
                            );
                        } else {
                            this.renderer.buildingAbilityArrowDirection = null;
                        }
                        this.renderer.buildingAbilityArrowLengthPx = dragLengthPx;
                    } else {
                        this.renderer.buildingAbilityArrowDirection = null;
                        this.renderer.buildingAbilityArrowLengthPx = 0;
                    }
                    
                    // Calculate angle and determine which button is highlighted
                    const dragDirection = this.renderer.buildingAbilityArrowDirection;
                    const angle = dragDirection ? Math.atan2(dragDirection.y, dragDirection.x) : 0;
                    
                    // Determine number of buttons based on what's selected
                    if (player && player.stellarForge && player.stellarForge.isSelected) {
                        // Stellar forge has 4 buttons
                        this.renderer.highlightedButtonIndex = dragDirection
                            ? this.getNearestButtonIndexFromAngle(angle, 4)
                            : -1;
                    } else if (this.selectedMirrors.size > 0) {
                        // Solar mirrors have 2 or 3 buttons
                        this.renderer.highlightedButtonIndex = dragDirection
                            ? this.getNearestMirrorButtonIndexFromAngle(angle, this.hasSeenFoundry)
                            : -1;
                        if (this.renderer.highlightedButtonIndex === 1 && !this.canCreateWarpGateFromSelectedMirrors()) {
                            this.renderer.highlightedButtonIndex = -1;
                        }
                    } else if (this.selectedWarpGate) {
                        this.renderer.highlightedButtonIndex = dragDirection
                            ? this.getNearestButtonIndexFromAngle(angle, 4)
                            : -1;
                    } else if (this.selectedBuildings.size === 1) {
                        // Foundry building has 4 buttons
                        const selectedBuilding = Array.from(this.selectedBuildings)[0];
                        if (selectedBuilding instanceof SubsidiaryFactory) {
                            this.renderer.highlightedButtonIndex = dragDirection
                                ? this.getNearestButtonIndexFromAngle(angle, 4)
                                : -1;
                        }
                    }
                }
            } else if (this.isDrawingPath) {
                // Collect path waypoints as we drag
                const worldPos = this.renderer.screenToWorld(x, y);
                
                // Add waypoint if we've moved far enough from the last one
                if (this.pathPoints.length === 0 || 
                    this.pathPoints[this.pathPoints.length - 1].distanceTo(worldPos) > Constants.MIN_WAYPOINT_DISTANCE) {
                    
                    // Check if this position is inside a solid object
                    const isInsideSolid = this.game?.checkCollision(worldPos, 0) || false;
                    
                    if (!isInsideSolid) {
                        // Only add waypoint if not inside solid object
                        this.pathPoints.push(new Vector2D(worldPos.x, worldPos.y));
                    }
                }
                
                // pathPreviewForge was already set when initiating path drawing (selectedBase for base paths, null for unit paths)
                this.renderer.pathPreviewPoints = this.pathPoints;
                this.renderer.pathPreviewEnd = new Vector2D(worldPos.x, worldPos.y);
            }
            
            lastX = x;
            lastY = y;
        };

        const endDrag = () => {
            // Check if this was a simple click (no dragging)
            const wasClick = this.selectionStartScreen && 
                             Math.abs(lastX - this.selectionStartScreen.x) < Constants.CLICK_DRAG_THRESHOLD && 
                             Math.abs(lastY - this.selectionStartScreen.y) < Constants.CLICK_DRAG_THRESHOLD;
            
            // Handle UI clicks first
            if (wasClick && this.game) {
                const winner = this.game.checkVictoryConditions();
                
                // Check menu button click (top-left, 60x60 area including margin)
                if (!winner && !this.game.isCountdownActive && lastX <= 70 && lastY <= 70) {
                    this.toggleInGameMenu();
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // Check in-game menu clicks
                if (this.showInGameMenu && !winner) {
                    const menuAction = this.renderer.getInGameMenuAction(lastX, lastY);
                    if (menuAction) {
                        switch (menuAction.type) {
                            case 'resume':
                                this.toggleInGameMenu();
                                break;
                            case 'toggleInfo':
                                this.toggleInfo();
                                break;
                            case 'surrender':
                                this.surrender();
                                break;
                            case 'tab':
                                this.renderer.setInGameMenuTab(menuAction.tab);
                                break;
                            case 'graphicsVariant':
                                this.renderer.setGraphicsVariant(menuAction.key, menuAction.variant);
                                break;
                            case 'damageDisplayMode':
                                this.renderer.damageDisplayMode = menuAction.mode;
                                if (this.game) {
                                    this.game.damageDisplayMode = menuAction.mode;
                                }
                                break;
                            case 'healthDisplayMode':
                                this.renderer.healthDisplayMode = menuAction.mode;
                                break;
                            case 'fancyGraphics':
                                this.renderer.isFancyGraphicsEnabled = menuAction.isEnabled;
                                break;
                            default:
                                break;
                        }

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }
                
                // Check end-game Continue button
                if (winner) {
                    const dpr = window.devicePixelRatio || 1;
                    const screenWidth = this.renderer.canvas.width / dpr;
                    const screenHeight = this.renderer.canvas.height / dpr;
                    const panelHeight = 450;
                    const panelY = 130;
                    const buttonWidth = 300;
                    const buttonHeight = 60;
                    const buttonX = (screenWidth - buttonWidth) / 2;
                    const buttonY = panelY + panelHeight + 30;
                    
                    if (lastX >= buttonX && lastX <= buttonX + buttonWidth && 
                        lastY >= buttonY && lastY <= buttonY + buttonHeight) {
                        this.returnToMainMenu();
                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }
            }
            
            // Create tap visual effect for clicks
            if (wasClick && this.selectionStartScreen) {
                this.renderer.createTapEffect(lastX, lastY);
            }
            
            if (this.game && wasClick) {
                const worldPos = this.renderer.screenToWorld(lastX, lastY);
                const player = this.getLocalPlayer();
                if (!player) {
                    return;
                }

                if (this.shouldSkipMoveOrderThisTap) {
                    this.shouldSkipMoveOrderThisTap = false;
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                if (this.selectedWarpGate) {
                    const buttonIndex = this.getWarpGateButtonIndexFromClick(this.selectedWarpGate, lastX, lastY);
                    if (buttonIndex >= 0) {
                        const buttonWorldPos = this.getWarpGateButtonWorldPosition(this.selectedWarpGate, buttonIndex);
                        if (buttonWorldPos) {
                            this.renderer.createProductionButtonWave(buttonWorldPos);
                        }
                        console.log(
                            `Warp gate button clicked: index ${buttonIndex} | energy=${player.energy.toFixed(1)}`
                        );
                        this.buildFromWarpGate(player, this.selectedWarpGate, buttonIndex);

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }

                const clickedWarpGate = this.getWarpGateAtPosition(worldPos, player);
                if (clickedWarpGate) {
                    if (this.selectedWarpGate === clickedWarpGate) {
                        this.clearWarpGateSelection();
                    } else {
                        this.clearAllSelections();
                        this.selectedWarpGate = clickedWarpGate;
                        this.renderer.selectedWarpGate = clickedWarpGate;
                    }

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                if (this.mirrorCommandMode === 'warpgate' && this.selectedMirrors.size > 0) {
                    this.tryCreateWarpGateAt(worldPos);
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                const friendlySacrificeTarget = this.hasSelectedStarlingsOnly()
                    ? this.getFriendlySacrificeTargetAtPosition(worldPos, player)
                    : null;
                const targetableStructure = friendlySacrificeTarget ?? this.getTargetableStructureAtPosition(worldPos, player);
                if (this.selectedUnits.size > 0 && targetableStructure) {
                    this.moveOrderCounter++;
                    const isFriendlySacrificeTarget = targetableStructure.target instanceof SubsidiaryFactory &&
                        targetableStructure.target.owner === player;
                    const targetRadiusPx = this.getTargetStructureRadiusPx(targetableStructure.target);

                    for (const unit of this.selectedUnits) {
                        const rallyPoint = isFriendlySacrificeTarget && unit instanceof Starling
                            ? targetableStructure.target.position
                            : unit.getStructureStandoffPoint(
                                targetableStructure.target.position,
                                targetRadiusPx
                            );
                        unit.setManualTarget(targetableStructure.target, rallyPoint);
                        unit.moveOrder = this.moveOrderCounter;
                    }

                    const unitIds = this.game
                        ? Array.from(this.selectedUnits).map((unit) => this.game!.getUnitNetworkId(unit))
                        : [];
                    this.sendNetworkCommand('unit_target_structure', {
                        unitIds,
                        targetPlayerIndex: targetableStructure.targetPlayerIndex,
                        structureType: targetableStructure.structureType,
                        structureIndex: targetableStructure.structureIndex,
                        moveOrder: this.moveOrderCounter
                    });

                    this.selectedUnits.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    this.clearPathPreview();
                    console.log('Units targeting structure', targetableStructure.structureType);

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // Check if clicked on stellar forge
                if (player.stellarForge && player.stellarForge.containsPoint(worldPos)) {
                    this.clearWarpGateSelection();
                    if (this.selectedMirrors.size > 0) {
                        for (const mirror of this.selectedMirrors) {
                            mirror.setLinkedStructure(player.stellarForge);
                            mirror.isSelected = false;
                        }
                        const mirrorIndices = Array.from(this.selectedMirrors).map((mirror) =>
                            player.solarMirrors.indexOf(mirror)
                        ).filter((index) => index >= 0);
                        this.sendNetworkCommand('mirror_link', {
                            mirrorIndices,
                            structureType: 'forge'
                        });
                        this.selectedMirrors.clear();
                    }
                    if (player.stellarForge.isSelected) {
                        // Deselect forge
                        player.stellarForge.isSelected = false;
                        this.selectedBase = null;
                        this.clearPathPreview();
                        console.log('Stellar Forge deselected');
                    } else {
                        // Select forge, deselect units, mirrors, and buildings
                        player.stellarForge.isSelected = true;
                        this.selectedBase = player.stellarForge;
                        this.selectedUnits.clear();
                        this.selectedMirrors.clear();
                        this.renderer.selectedUnits = this.selectedUnits;
                        // Deselect all mirrors
                        for (const mirror of player.solarMirrors) {
                            mirror.isSelected = false;
                        }
                        // Deselect all buildings
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.selectedBuildings.clear();
                        this.clearPathPreview();
                        console.log('Stellar Forge selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // Check if clicked on a solar mirror
                let clickedMirror: any = null;
                for (const mirror of player.solarMirrors) {
                    if (mirror.containsPoint(worldPos)) {
                        clickedMirror = mirror;
                        break;
                    }
                }
                
                if (clickedMirror) {
                    this.clearWarpGateSelection();
                    if (clickedMirror.isSelected) {
                        // Deselect mirror
                        clickedMirror.isSelected = false;
                        this.selectedMirrors.delete(clickedMirror);
                        this.clearPathPreview();
                        console.log('Solar Mirror deselected');
                    } else {
                        // Select mirror, deselect forge, units, and buildings
                        clickedMirror.isSelected = true;
                        this.selectedMirrors.clear();
                        this.selectedMirrors.add(clickedMirror);
                        if (player.stellarForge) {
                            player.stellarForge.isSelected = false;
                        }
                        this.selectedBase = null;
                        this.selectedUnits.clear();
                        this.renderer.selectedUnits = this.selectedUnits;
                        // Deselect other mirrors
                        for (const mirror of player.solarMirrors) {
                            if (mirror !== clickedMirror) {
                                mirror.isSelected = false;
                            }
                        }
                        // Deselect all buildings
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.selectedBuildings.clear();
                        this.clearPathPreview();
                        console.log('Solar Mirror selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                // Check if clicked on a building
                let clickedBuilding: any = null;
                for (const building of player.buildings) {
                    if (building.containsPoint(worldPos)) {
                        clickedBuilding = building;
                        break;
                    }
                }
                
                if (clickedBuilding) {
                    this.clearWarpGateSelection();
                    const isCompatibleMirrorTarget = clickedBuilding instanceof Minigun ||
                        clickedBuilding instanceof GatlingTower ||
                        clickedBuilding instanceof SpaceDustSwirler ||
                        clickedBuilding instanceof SubsidiaryFactory ||
                        clickedBuilding instanceof StrikerTower ||
                        clickedBuilding instanceof LockOnLaserTower ||
                        clickedBuilding instanceof ShieldTower;
                    if (isCompatibleMirrorTarget && this.selectedMirrors.size > 0) {
                        for (const mirror of this.selectedMirrors) {
                            mirror.setLinkedStructure(clickedBuilding);
                            mirror.isSelected = false;
                        }
                        const mirrorIndices = Array.from(this.selectedMirrors).map((mirror) =>
                            player.solarMirrors.indexOf(mirror)
                        ).filter((index) => index >= 0);
                        const buildingIndex = player.buildings.indexOf(clickedBuilding);
                        if (buildingIndex >= 0) {
                            this.sendNetworkCommand('mirror_link', {
                                mirrorIndices,
                                structureType: 'building',
                                buildingIndex
                            });
                        }
                        this.selectedMirrors.clear();
                    }
                    
                    // Check if this is a double-tap
                    const isDoubleTap = this.isDoubleTap(lastX, lastY);
                    
                    if (isDoubleTap) {
                        // Double-tap: select all buildings of this type
                        this.selectAllBuildingsOfType(clickedBuilding);
                    } else if (clickedBuilding.isSelected) {
                        // If Striker Tower is selected and missile is ready, activate targeting mode
                        if (clickedBuilding instanceof StrikerTower && clickedBuilding.isMissileReady()) {
                            clickedBuilding.isAwaitingTarget = true;
                            console.log('Striker Tower: Select target location');
                        } else {
                            // Deselect building
                            clickedBuilding.isSelected = false;
                            this.selectedBuildings.delete(clickedBuilding);
                            console.log('Building deselected');
                        }
                    } else {
                        // Select building, deselect forge, units, and mirrors
                        clickedBuilding.isSelected = true;
                        this.selectedBuildings.clear();
                        this.selectedBuildings.add(clickedBuilding);
                        if (player.stellarForge) {
                            player.stellarForge.isSelected = false;
                        }
                        this.selectedBase = null;
                        this.selectedUnits.clear();
                        this.renderer.selectedUnits = this.selectedUnits;
                        // Deselect all mirrors
                        for (const mirror of player.solarMirrors) {
                            mirror.isSelected = false;
                        }
                        this.selectedMirrors.clear();
                        this.clearPathPreview();
                        console.log('Building selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                // Check if clicked on mirror command buttons
                if (this.selectedMirrors.size > 0) {
                    // Get one of the selected mirrors to determine button positions
                    const firstMirror = Array.from(this.selectedMirrors)[0] as any;
                    const mirrorScreenPos = this.renderer.worldToScreen(firstMirror.position);
                    
                    // Button layout: Warp gate above, forge on left (and foundry on right if available)
                    const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.renderer.zoom;
                    const buttonOffset = 50 * this.renderer.zoom; // Distance from mirror
                    const shouldShowFoundryButton = this.hasSeenFoundry;
                    
                    const warpGateButtonX = mirrorScreenPos.x;
                    const warpGateButtonY = mirrorScreenPos.y - buttonOffset;
                    const forgeButtonX = mirrorScreenPos.x - buttonOffset;
                    const forgeButtonY = mirrorScreenPos.y;
                    const foundryButtonX = mirrorScreenPos.x + buttonOffset;
                    const foundryButtonY = mirrorScreenPos.y;
                    
                    // Check if clicked on forge button
                    let dx = lastX - forgeButtonX;
                    let dy = lastY - forgeButtonY;
                    if (Math.sqrt(dx * dx + dy * dy) <= buttonRadius) {
                        console.log('Mirror command: Link to Forge');
                        // Link all selected mirrors to the forge
                        if (player.stellarForge) {
                            for (const mirror of this.selectedMirrors) {
                                mirror.setLinkedStructure(player.stellarForge);
                            }
                            const mirrorIndices = Array.from(this.selectedMirrors).map((mirror: any) =>
                                player.solarMirrors.indexOf(mirror)
                            ).filter((index) => index >= 0);
                            this.sendNetworkCommand('mirror_link', {
                                mirrorIndices,
                                structureType: 'forge'
                            });
                            console.log('Mirrors linked to forge');
                        }
                        // Deselect mirrors
                        for (const mirror of this.selectedMirrors) {
                            (mirror as any).isSelected = false;
                        }
                        this.selectedMirrors.clear();
                        
                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        return;
                    }

                    // Check if clicked on warp gate button
                    dx = lastX - warpGateButtonX;
                    dy = lastY - warpGateButtonY;
                    if (Math.sqrt(dx * dx + dy * dy) <= buttonRadius) {
                        console.log('Mirror command: Create Warp Gate');
                        if (this.canCreateWarpGateFromSelectedMirrors()) {
                            this.mirrorCommandMode = 'warpgate';
                        }
                        // User will now tap a location to create the warp gate
                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        return;
                    }

                    if (shouldShowFoundryButton) {
                        dx = lastX - foundryButtonX;
                        dy = lastY - foundryButtonY;
                        if (Math.sqrt(dx * dx + dy * dy) <= buttonRadius) {
                            if (this.hasActiveFoundry) {
                                const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory);
                                if (foundry) {
                                    for (const mirror of this.selectedMirrors) {
                                        mirror.setLinkedStructure(foundry);
                                    }
                                    const mirrorIndices = Array.from(this.selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    const buildingIndex = player.buildings.indexOf(foundry);
                                    if (buildingIndex >= 0) {
                                        this.sendNetworkCommand('mirror_link', {
                                            mirrorIndices,
                                            structureType: 'building',
                                            buildingIndex
                                        });
                                    }
                                    console.log('Mirrors linked to foundry');
                                }
                            }
                            for (const mirror of this.selectedMirrors) {
                                (mirror as any).isSelected = false;
                            }
                            this.selectedMirrors.clear();

                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.renderer.selectionStart = null;
                            this.renderer.selectionEnd = null;
                            return;
                        }
                    }
                }

                if (player.stellarForge && player.stellarForge.isSelected && this.renderer.selectedHeroNames.length > 0) {
                    const clickedHero = this.getClickedHeroButton(
                        lastX,
                        lastY,
                        player.stellarForge,
                        this.renderer.selectedHeroNames
                    );
                    if (clickedHero) {
                        const clickedHeroName = clickedHero.heroName;
                        this.renderer.createProductionButtonWave(clickedHero.buttonPos);
                        const heroUnitType = this.getHeroUnitType(clickedHeroName);
                        let isHeroQueued = false;
                        if (heroUnitType) {
                            const isHeroAlive = this.isHeroUnitAlive(player, heroUnitType);
                            const isHeroProducing = this.isHeroUnitQueuedOrProducing(player.stellarForge, heroUnitType);
                            console.log(
                                `Hero button clicked: ${clickedHeroName} | unitType=${heroUnitType} | alive=${isHeroAlive} | producing=${isHeroProducing} | energy=${player.energy.toFixed(1)}`
                            );
                            if (isHeroAlive) {
                                console.log(`${clickedHeroName} is already active`);
                            } else if (isHeroProducing) {
                                console.log(`${clickedHeroName} is already being produced`);
                            } else if (player.spendEnergy(Constants.HERO_UNIT_COST)) {
                                player.stellarForge.enqueueHeroUnit(heroUnitType);
                                player.stellarForge.startHeroProductionIfIdle();
                                console.log(`Queued hero ${clickedHeroName} for forging`);
                                isHeroQueued = true;
                                this.sendNetworkCommand('hero_purchase', {
                                    heroType: heroUnitType
                                });
                            } else {
                                console.log('Not enough energy to forge hero');
                            }
                        }

                        if (isHeroQueued) {
                            player.stellarForge.isSelected = false;
                            this.selectedBase = null;
                            this.selectedUnits.clear();
                            this.selectedMirrors.clear();
                            this.renderer.selectedUnits = this.selectedUnits;
                            // Deselect all buildings
                            for (const building of player.buildings) {
                                building.isSelected = false;
                            }
                            this.selectedBuildings.clear();
                            this.clearPathPreview();
                        }

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.renderer.selectionStart = null;
                        this.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }

                if (this.selectedBuildings.size === 1) {
                    const selectedBuilding = Array.from(this.selectedBuildings)[0];
                    if (selectedBuilding instanceof SubsidiaryFactory && selectedBuilding.isComplete) {
                        const clickedFoundryButtonIndex = this.getClickedFoundryButtonIndex(
                            lastX,
                            lastY,
                            selectedBuilding
                        );
                        if (clickedFoundryButtonIndex >= 0) {
                            this.handleFoundryButtonPress(player, selectedBuilding, clickedFoundryButtonIndex);
                            return;
                        }
                    }
                }

                if (this.selectedBuildings.size > 0) {
                    for (const building of this.selectedBuildings) {
                        building.isSelected = false;
                    }
                    this.selectedBuildings.clear();
                    this.clearPathPreview();
                    console.log('Buildings deselected');

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // If forge is selected and clicked elsewhere, move it
                if (player.stellarForge && player.stellarForge.isSelected) {
                    player.stellarForge.setTarget(worldPos);
                    this.moveOrderCounter++;
                    player.stellarForge.moveOrder = this.moveOrderCounter;
                    this.sendNetworkCommand('forge_move', {
                        targetX: worldPos.x,
                        targetY: worldPos.y,
                        moveOrder: this.moveOrderCounter
                    });
                    player.stellarForge.isSelected = false; // Auto-deselect after setting target
                    this.selectedBase = null;
                    this.selectedUnits.clear();
                    this.selectedMirrors.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    // Deselect all buildings
                    for (const building of player.buildings) {
                        building.isSelected = false;
                    }
                    this.selectedBuildings.clear();
                    console.log(`Stellar Forge moving to (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // If a mirror is selected and clicked elsewhere, move it
                const { mirror: selectedMirror, mirrorIndex } = this.getClosestSelectedMirror(player, worldPos);
                if (selectedMirror && this.mirrorCommandMode !== 'warpgate') {
                    selectedMirror.setTarget(worldPos);
                    this.moveOrderCounter++;
                    selectedMirror.moveOrder = this.moveOrderCounter;
                    this.sendNetworkCommand('mirror_move', {
                        mirrorIndices: mirrorIndex >= 0 ? [mirrorIndex] : [],
                        targetX: worldPos.x,
                        targetY: worldPos.y,
                        moveOrder: this.moveOrderCounter
                    });
                    selectedMirror.isSelected = false; // Auto-deselect after setting target
                    this.selectedBase = null;
                    this.selectedUnits.clear();
                    for (const mirror of this.selectedMirrors) {
                        mirror.isSelected = false;
                    }
                    this.selectedMirrors.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    // Deselect all buildings
                    for (const building of player.buildings) {
                        building.isSelected = false;
                    }
                    this.selectedBuildings.clear();
                    console.log(`Solar Mirror moving to (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.renderer.selectionStart = null;
                    this.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
            }
            
            // If we were selecting, finalize the selection
            if (this.isSelecting && this.selectionStartScreen && this.game) {
                const endPos = new Vector2D(lastX, lastY);
                this.selectUnitsInRectangle(this.selectionStartScreen, endPos);
            } else if (this.isDrawingPath && this.pathPoints.length > 0 && this.game) {
                // Finalize the path drawing
                if (this.selectedBase && this.selectedBase.isSelected) {
                    // Path for base (minion spawning)
                    this.selectedBase.setMinionPath(this.pathPoints);
                    console.log(`Base path set with ${this.pathPoints.length} waypoints`);
                    this.sendNetworkCommand('set_rally_path', {
                        waypoints: this.pathPoints.map((point) => ({ x: point.x, y: point.y }))
                    });
                } else if (this.selectedMirrors.size > 0) {
                    const player = this.getLocalPlayer();
                    const lastWaypoint = this.pathPoints[this.pathPoints.length - 1];

                    if (player) {
                        console.log(`Solar mirror movement path set to (${lastWaypoint.x.toFixed(0)}, ${lastWaypoint.y.toFixed(0)})`);
                        this.moveOrderCounter++;
                        const mirrorIndices: number[] = [];

                        for (const mirror of this.selectedMirrors) {
                            mirror.setTarget(lastWaypoint);
                            mirror.moveOrder = this.moveOrderCounter;
                            mirror.isSelected = false;
                            const mirrorIndex = player.solarMirrors.indexOf(mirror);
                            if (mirrorIndex >= 0) {
                                mirrorIndices.push(mirrorIndex);
                            }
                        }

                        this.sendNetworkCommand('mirror_move', {
                            mirrorIndices,
                            targetX: lastWaypoint.x,
                            targetY: lastWaypoint.y,
                            moveOrder: this.moveOrderCounter
                        });
                    }

                    this.selectedMirrors.clear();
                    const localPlayer = this.getLocalPlayer();
                    if (localPlayer) {
                        for (const building of localPlayer.buildings) {
                            building.isSelected = false;
                        }
                        this.selectedBuildings.clear();
                    }
                } else if (this.selectedUnits.size > 0) {
                    // Path for selected units
                    console.log(`Unit movement path set with ${this.pathPoints.length} waypoints for ${this.selectedUnits.size} unit(s)`);
                    
                    // Increment move order counter
                    this.moveOrderCounter++;
                    
                    // Set path for all selected units
                    for (const unit of this.selectedUnits) {
                        // All units now support path following
                        unit.clearManualTarget();
                        unit.setPath(this.pathPoints);
                        unit.moveOrder = this.moveOrderCounter;
                    }
                    const unitIds = this.game
                        ? Array.from(this.selectedUnits).map((unit) => this.game!.getUnitNetworkId(unit))
                        : [];
                    this.sendNetworkCommand('unit_path', {
                        unitIds,
                        waypoints: this.pathPoints.map((point) => ({ x: point.x, y: point.y })),
                        moveOrder: this.moveOrderCounter
                    });
                    
                    // Deselect units and buildings after setting path
                    this.selectedUnits.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    const player = this.getLocalPlayer();
                    if (player) {
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.selectedBuildings.clear();
                    }
                }
                this.clearPathPreview();
            } else if (!this.isSelecting && (this.selectedUnits.size > 0 || this.selectedMirrors.size > 0 || this.selectedBase || this.selectedWarpGate) && this.selectionStartScreen && this.game) {
                // If units, mirrors, or base are selected and player dragged/clicked
                const endPos = new Vector2D(lastX, lastY);
                const totalMovement = this.selectionStartScreen.distanceTo(endPos);
                const buildingAbilityMovement = totalMovement;
                
                const abilityDragThreshold = Math.max(Constants.CLICK_DRAG_THRESHOLD, Constants.ABILITY_ARROW_MIN_LENGTH);
                const hasHeroUnits = this.hasHeroUnitsSelected();
                const shouldUseAbility = this.selectedUnits.size > 0 && (
                    (!hasHeroUnits && totalMovement >= Constants.CLICK_DRAG_THRESHOLD) ||
                    (hasHeroUnits && this.isDraggingHeroArrow && totalMovement >= abilityDragThreshold)
                );

                // If dragged significantly, use ability (for units only)
                if (shouldUseAbility) {
                    
                    // Only create swipe effect for non-hero units
                    if (!hasHeroUnits) {
                        this.renderer.createSwipeEffect(
                            this.selectionStartScreen.x,
                            this.selectionStartScreen.y,
                            endPos.x,
                            endPos.y
                        );
                    }
                    
                    // Calculate swipe direction
                    const dx = endPos.x - this.selectionStartScreen.x;
                    const dy = endPos.y - this.selectionStartScreen.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const direction = new Vector2D(dx / distance, dy / distance);

                    let didMergeStarlings = false;
                    if (!hasHeroUnits) {
                        const player = this.getLocalPlayer();
                        if (player && direction.y < -0.5) {
                            const selectedStarlings = this.getSelectedStarlings(player);
                            if (selectedStarlings.length >= Constants.STARLING_MERGE_COUNT) {
                                // Calculate average position of selected starlings as merge target
                                const avgX = selectedStarlings.reduce((sum, s) => sum + s.position.x, 0) / selectedStarlings.length;
                                const avgY = selectedStarlings.reduce((sum, s) => sum + s.position.y, 0) / selectedStarlings.length;
                                const targetPos = new Vector2D(avgX, avgY);
                                didMergeStarlings = this.tryStartStarlingMerge(player, selectedStarlings, targetPos);
                            }
                        }
                    }

                    if (!didMergeStarlings) {
                        // Activate ability for all selected units
                        let anyAbilityUsed = false;
                        for (const unit of this.selectedUnits) {
                            if (unit.useAbility(direction)) {
                                anyAbilityUsed = true;
                                if (this.game) {
                                    this.sendNetworkCommand('unit_ability', {
                                        unitId: this.game.getUnitNetworkId(unit),
                                        directionX: direction.x,
                                        directionY: direction.y
                                    });
                                }
                            }
                        }

                        if (anyAbilityUsed) {
                            console.log(`Ability activated in direction (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
                        }

                        // Deselect all units after using ability
                        this.selectedUnits.clear();
                        this.renderer.selectedUnits = this.selectedUnits;
                    }
                } else if (this.isDraggingBuildingArrow && buildingAbilityMovement >= abilityDragThreshold) {
                    // Building ability arrow was dragged - activate the highlighted button
                    const player = this.getLocalPlayer();
                    if (player && this.renderer.highlightedButtonIndex >= 0) {
                        if (player.stellarForge && player.stellarForge.isSelected && this.renderer.selectedHeroNames.length > 0) {
                            // Stellar forge button selected
                            const heroNames = this.renderer.selectedHeroNames;
                            if (this.renderer.highlightedButtonIndex < heroNames.length) {
                                const selectedHeroName = heroNames[this.renderer.highlightedButtonIndex];
                                const heroUnitType = this.getHeroUnitType(selectedHeroName);
                                
                                if (heroUnitType) {
                                    const isHeroAlive = this.isHeroUnitAlive(player, heroUnitType);
                                    const isHeroProducing = this.isHeroUnitQueuedOrProducing(player.stellarForge, heroUnitType);
                                    
                                    if (!isHeroAlive && !isHeroProducing && player.spendEnergy(Constants.HERO_UNIT_COST)) {
                                        player.stellarForge.enqueueHeroUnit(heroUnitType);
                                        player.stellarForge.startHeroProductionIfIdle();
                                        console.log(`Radial selection: Queued hero ${selectedHeroName} for forging`);
                                        this.sendNetworkCommand('hero_purchase', {
                                            heroType: heroUnitType
                                        });
                                        
                                        // Deselect forge
                                        player.stellarForge.isSelected = false;
                                        this.selectedBase = null;
                                    }
                                }
                            }
                        } else if (this.selectedMirrors.size > 0) {
                            // Solar mirror button selected
                            if (this.renderer.highlightedButtonIndex === 0) {
                                // Forge button
                                if (player.stellarForge) {
                                    for (const mirror of this.selectedMirrors) {
                                        mirror.setLinkedStructure(player.stellarForge);
                                    }
                                    const mirrorIndices = Array.from(this.selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    this.sendNetworkCommand('mirror_link', {
                                        mirrorIndices,
                                        structureType: 'forge'
                                    });
                                    console.log('Radial selection: Mirrors linked to forge');
                                }
                                for (const mirror of this.selectedMirrors) {
                                    (mirror as any).isSelected = false;
                                }
                                this.selectedMirrors.clear();
                            } else if (this.renderer.highlightedButtonIndex === 1) {
                                // Warp gate button
                                if (this.canCreateWarpGateFromSelectedMirrors()) {
                                    this.mirrorCommandMode = 'warpgate';
                                    console.log('Radial selection: Mirror command mode set to warpgate');
                                }
                            } else if (this.renderer.highlightedButtonIndex === 2 && this.hasActiveFoundry) {
                                const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory);
                                if (foundry) {
                                    for (const mirror of this.selectedMirrors) {
                                        mirror.setLinkedStructure(foundry);
                                    }
                                    const mirrorIndices = Array.from(this.selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    const buildingIndex = player.buildings.indexOf(foundry);
                                    if (buildingIndex >= 0) {
                                        this.sendNetworkCommand('mirror_link', {
                                            mirrorIndices,
                                            structureType: 'building',
                                            buildingIndex
                                        });
                                    }
                                    console.log('Radial selection: Mirrors linked to foundry');
                                }
                                for (const mirror of this.selectedMirrors) {
                                    (mirror as any).isSelected = false;
                                }
                                this.selectedMirrors.clear();
                            }
                        } else if (this.selectedWarpGate) {
                            this.buildFromWarpGate(player, this.selectedWarpGate, this.renderer.highlightedButtonIndex);
                        } else if (this.selectedBuildings.size === 1) {
                            // Foundry building button selected
                            const selectedBuilding = Array.from(this.selectedBuildings)[0];
                            if (selectedBuilding instanceof SubsidiaryFactory) {
                                this.handleFoundryButtonPress(player, selectedBuilding, this.renderer.highlightedButtonIndex);
                            }
                        }
                    }
                } else if (this.isDraggingHeroArrow && hasHeroUnits) {
                    // Cancel ability casting if arrow was dragged back to nothing
                } else if (this.shouldSkipMoveOrderThisTap) {
                    this.shouldSkipMoveOrderThisTap = false;
                } else if (this.selectedWarpGate && this.selectedUnits.size === 0 && this.selectedMirrors.size === 0 && !this.selectedBase) {
                    // Warp gate selected without a drag - no movement action
                } else {
                    // Check if any selected Striker Tower is awaiting target
                    const player = this.getLocalPlayer();
                    const awaitingStrikerTower = player && this.selectedBuildings.size === 1 ? 
                        Array.from(this.selectedBuildings)[0] : null;
                    
                    if (awaitingStrikerTower instanceof StrikerTower && awaitingStrikerTower.isAwaitingTarget) {
                        // Fire striker tower missile
                        const worldPos = this.renderer.screenToWorld(lastX, lastY);
                        const buildingIndex = player!.buildings.indexOf(awaitingStrikerTower);
                        if (buildingIndex >= 0) {
                            const buildingId = this.game!.getBuildingNetworkId(awaitingStrikerTower);
                            this.sendNetworkCommand('striker_tower_fire', {
                                buildingId,
                                targetX: worldPos.x,
                                targetY: worldPos.y
                            });
                            awaitingStrikerTower.isAwaitingTarget = false;
                            console.log(`Striker Tower fired at (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                        }
                    } else {
                        // If movement was minimal or only mirrors/base selected, set movement targets
                        const worldPos = this.renderer.screenToWorld(lastX, lastY);
                        
                        // Increment move order counter
                        this.moveOrderCounter++;
                        
                        // Set rally point for all selected units
                        for (const unit of this.selectedUnits) {
                            const rallyPoint = new Vector2D(worldPos.x, worldPos.y);
                            unit.clearManualTarget();
                            if (unit instanceof Starling) {
                                unit.setManualRallyPoint(rallyPoint);
                            } else {
                                unit.rallyPoint = rallyPoint;
                            }
                            unit.moveOrder = this.moveOrderCounter;
                        }
                        const unitIds = this.game
                            ? Array.from(this.selectedUnits).map((unit) => this.game!.getUnitNetworkId(unit))
                            : [];
                        this.sendNetworkCommand('unit_move', {
                            unitIds,
                            targetX: worldPos.x,
                            targetY: worldPos.y,
                            moveOrder: this.moveOrderCounter
                        });
                        
                        // Set target for the closest selected mirror
                        const player = this.getLocalPlayer();
                        if (player) {
                            const { mirror: closestMirror, mirrorIndex } = this.getClosestSelectedMirror(player, worldPos);
                            if (closestMirror && mirrorIndex >= 0) {
                                closestMirror.setTarget(new Vector2D(worldPos.x, worldPos.y));
                                closestMirror.moveOrder = this.moveOrderCounter;
                                closestMirror.isSelected = false;
                                this.sendNetworkCommand('mirror_move', {
                                    mirrorIndices: [mirrorIndex],
                                    targetX: worldPos.x,
                                    targetY: worldPos.y,
                                    moveOrder: this.moveOrderCounter
                                });
                            }
                        }
                        
                        // Set target for selected base
                        if (this.selectedBase) {
                            this.selectedBase.setTarget(new Vector2D(worldPos.x, worldPos.y));
                            this.selectedBase.moveOrder = this.moveOrderCounter;
                            this.selectedBase.isSelected = false;
                            this.sendNetworkCommand('forge_move', {
                                targetX: worldPos.x,
                                targetY: worldPos.y,
                                moveOrder: this.moveOrderCounter
                            });
                        }
                        
                        // Deselect all units immediately
                        this.selectedUnits.clear();
                        for (const mirror of this.selectedMirrors) {
                            mirror.isSelected = false;
                        }
                        this.selectedMirrors.clear();
                        this.selectedBase = null;
                        this.renderer.selectedUnits = this.selectedUnits;
                        
                        console.log(`Movement target set at (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)}) - Move order #${this.moveOrderCounter}`);
                    }
                }
            }
            
            isPanning = false;
            isMouseDown = false;
            this.isSelecting = false;
            this.isDraggingHeroArrow = false;
            this.isDraggingBuildingArrow = false;
            this.isDrawingPath = false;
            this.pathPoints = [];
            this.selectionStartScreen = null;
            this.renderer.selectionStart = null;
            this.renderer.selectionEnd = null;
            this.abilityArrowStarts.length = 0;
            this.renderer.abilityArrowStarts = this.abilityArrowStarts;
            this.renderer.abilityArrowDirection = null;
            this.renderer.abilityArrowLengthPx = 0;
            this.renderer.buildingAbilityArrowStart = null;
            this.renderer.buildingAbilityArrowDirection = null;
            this.renderer.buildingAbilityArrowLengthPx = 0;
            this.renderer.highlightedButtonIndex = -1;
            this.endHold();
        };

        // Mouse events
        canvas.addEventListener('mousedown', (e: MouseEvent) => {
            isMouseDown = true;
            const screenPos = getCanvasPosition(e.clientX, e.clientY);
            startDrag(screenPos.x, screenPos.y);
        });

        canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const screenPos = getCanvasPosition(e.clientX, e.clientY);
            lastMouseX = screenPos.x;
            lastMouseY = screenPos.y;
            moveDrag(screenPos.x, screenPos.y, false);
        });

        canvas.addEventListener('mouseup', () => {
            endDrag();
        });

        canvas.addEventListener('mouseleave', () => {
            endDrag();
        });

        // Touch events - pinch zoom and center-point panning with two fingers, one finger for selection
        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                isMouseDown = true;
                const touchPos = getCanvasPosition(e.touches[0].clientX, e.touches[0].clientY);
                startDrag(touchPos.x, touchPos.y);
            } else if (e.touches.length === 2) {
                e.preventDefault();
                // Two finger touch - prepare for panning and zooming
                isMouseDown = true;
                isPanning = false;
                const touch1 = getCanvasPosition(e.touches[0].clientX, e.touches[0].clientY);
                const touch2 = getCanvasPosition(e.touches[1].clientX, e.touches[1].clientY);
                
                // Calculate center point between two touches
                lastX = (touch1.x + touch2.x) / 2;
                lastY = (touch1.y + touch2.y) / 2;
                
                // Calculate initial distance for pinch zoom
                const dx = touch2.x - touch1.x;
                const dy = touch2.y - touch1.y;
                lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
                
                this.cancelHold();
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 1 && isMouseDown) {
                e.preventDefault();
                const touchPos = getCanvasPosition(e.touches[0].clientX, e.touches[0].clientY);
                moveDrag(touchPos.x, touchPos.y, false);
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = getCanvasPosition(e.touches[0].clientX, e.touches[0].clientY);
                const touch2 = getCanvasPosition(e.touches[1].clientX, e.touches[1].clientY);
                
                // Calculate current center point
                const currentX = (touch1.x + touch2.x) / 2;
                const currentY = (touch1.y + touch2.y) / 2;
                
                // Calculate current distance for pinch zoom
                const dx = touch2.x - touch1.x;
                const dy = touch2.y - touch1.y;
                const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);
                
                // Handle pinch zoom if distance changed significantly
                if (Math.abs(currentPinchDistance - lastPinchDistance) > PINCH_ZOOM_THRESHOLD) {
                    // Get world position under pinch center before zoom
                    const worldPosBeforeZoom = this.renderer.screenToWorld(currentX, currentY);
                    
                    // Apply zoom based on pinch distance change
                    const zoomDelta = currentPinchDistance / lastPinchDistance;
                    const oldZoom = this.renderer.zoom;
                    this.renderer.setZoom(oldZoom * zoomDelta);
                    
                    // Get world position under pinch center after zoom
                    const worldPosAfterZoom = this.renderer.screenToWorld(currentX, currentY);
                    
                    // Adjust camera to keep world position under pinch center the same
                    const currentCamera = this.renderer.camera;
                    this.renderer.setCameraPositionWithoutParallax(new Vector2D(
                        currentCamera.x + (worldPosBeforeZoom.x - worldPosAfterZoom.x),
                        currentCamera.y + (worldPosBeforeZoom.y - worldPosAfterZoom.y)
                    ));
                    
                    lastPinchDistance = currentPinchDistance;
                }
                
                // Two finger drag - pan the camera
                moveDrag(currentX, currentY, true);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                const touchPos = getCanvasPosition(
                    e.touches[0].clientX,
                    e.touches[0].clientY
                );
                lastX = touchPos.x;
                lastY = touchPos.y;
                lastMouseX = touchPos.x;
                lastMouseY = touchPos.y;
            } else if (e.changedTouches.length > 0) {
                const touchPos = getCanvasPosition(
                    e.changedTouches[0].clientX,
                    e.changedTouches[0].clientY
                );
                lastX = touchPos.x;
                lastY = touchPos.y;
                lastMouseX = touchPos.x;
                lastMouseY = touchPos.y;
            }

            if (e.touches.length === 0) {
                // All touches ended
                endDrag();
                lastPinchDistance = 0;
            } else if (e.touches.length === 1) {
                // One touch remaining, transition from two-finger to one-finger mode
                isPanning = false;
                lastPinchDistance = 0;
            }
        });

        canvas.addEventListener('touchcancel', () => {
            endDrag();
            lastPinchDistance = 0;
        });

        // Keyboard controls (WASD and arrow keys) - Desktop only
        const KEYBOARD_PAN_SPEED = 10;
        
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            
            // ESC key toggles in-game menu
            if (key === 'escape' && this.game && !this.game.isCountdownActive) {
                const winner = this.game.checkVictoryConditions();
                if (!winner) {
                    e.preventDefault();
                    this.toggleInGameMenu();
                    return;
                }
            }
            
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
                keysPressed.add(key);
            }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            keysPressed.delete(key);
        });

        // Update camera based on keyboard input and edge panning
        const updateCameraPanning = () => {
            // Early exit if no game is active
            if (!this.game) {
                requestAnimationFrame(updateCameraPanning);
                return;
            }
            
            // Early exit if no input is active
            const hasKeyboardInput = keysPressed.size > 0;
            // Disable edge panning on mobile devices
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = canvas.width / dpr;
            const screenHeight = canvas.height / dpr;
            const hasEdgeInput = !isMobile && !isMouseDown && !isPanning && (
                lastMouseX < EDGE_PAN_THRESHOLD ||
                lastMouseX > screenWidth - EDGE_PAN_THRESHOLD ||
                lastMouseY < EDGE_PAN_THRESHOLD ||
                lastMouseY > screenHeight - EDGE_PAN_THRESHOLD
            );
            
            if (hasKeyboardInput || hasEdgeInput) {
                const currentCamera = this.renderer.camera;
                let dx = 0;
                let dy = 0;

                // Keyboard panning
                if (keysPressed.has('w') || keysPressed.has('arrowup')) dy -= KEYBOARD_PAN_SPEED;
                if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy += KEYBOARD_PAN_SPEED;
                if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx -= KEYBOARD_PAN_SPEED;
                if (keysPressed.has('d') || keysPressed.has('arrowright')) dx += KEYBOARD_PAN_SPEED;

                // Edge panning (only if not dragging with mouse and not on mobile)
                if (hasEdgeInput) {
                    if (lastMouseX < EDGE_PAN_THRESHOLD) dx -= EDGE_PAN_SPEED;
                    if (lastMouseX > screenWidth - EDGE_PAN_THRESHOLD) dx += EDGE_PAN_SPEED;
                    if (lastMouseY < EDGE_PAN_THRESHOLD) dy -= EDGE_PAN_SPEED;
                    if (lastMouseY > screenHeight - EDGE_PAN_THRESHOLD) dy += EDGE_PAN_SPEED;
                }

                if (dx !== 0 || dy !== 0) {
                    this.renderer.setCameraPosition(new Vector2D(
                        currentCamera.x + dx / this.renderer.zoom,
                        currentCamera.y + dy / this.renderer.zoom
                    ));
                }
            }

            requestAnimationFrame(updateCameraPanning);
        };
        
        updateCameraPanning();
    }

    private startHold(worldPos: Vector2D): void {
        if (!this.game) return;
        
        const player = this.getLocalPlayer();
        if (!player) {
            return;
        }
        if (!player.stellarForge) return;

        this.holdStartTime = null;
        this.holdStarlingForMerge = null;

        // Check if any buildings with guns are selected
        const hasSelectedShootingBuildings = Array.from(this.selectedBuildings).some(
            (building: any) => building.canShoot()
        );
        
        if (hasSelectedShootingBuildings) {
            // Building control: Set target for all selected buildings that can shoot
            for (const building of this.selectedBuildings) {
                if (building.canShoot()) {
                    // Find the nearest enemy to the hold position
                    const enemies: any[] = [];
                    
                    // Get all enemy units and buildings
                    for (const otherPlayer of this.game.players) {
                        if (otherPlayer === player) continue;
                        
                        enemies.push(...otherPlayer.units);
                        enemies.push(...otherPlayer.buildings);
                        if (otherPlayer.stellarForge) {
                            enemies.push(otherPlayer.stellarForge);
                        }
                    }
                    
                    // Find nearest enemy to the hold position
                    let nearestEnemy: any = null;
                    let minDistance = Infinity;
                    
                    for (const enemy of enemies) {
                        const distance = worldPos.distanceTo(enemy.position);
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestEnemy = enemy;
                        }
                    }
                    
                    // Set target for the building
                    if (nearestEnemy) {
                        building.target = nearestEnemy;
                        console.log(`Building targeting enemy at (${nearestEnemy.position.x.toFixed(0)}, ${nearestEnemy.position.y.toFixed(0)})`);
                    }
                }
            }
            return;
        }

        // Check if any mirrors are selected
        const hasSelectedMirrors = this.selectedMirrors.size > 0;
        
        if (hasSelectedMirrors && this.mirrorCommandMode === 'warpgate') {
            this.tryCreateWarpGateAt(worldPos);
            return;
        }
        // NOTE: Removed old influence-based warp gate creation - now only via mirrors

        if (hasSelectedMirrors && this.mirrorCommandMode === null) {
            this.mirrorHoldStartTimeMs = performance.now();
            this.mirrorHoldWorldPos = worldPos;
        }

        const selectedStarlings = this.getSelectedStarlings(player);
        const hasFoundry = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        if (hasFoundry && selectedStarlings.length >= Constants.STARLING_MERGE_COUNT) {
            const closestStarling = this.getClosestSelectedStarling(worldPos);
            if (closestStarling) {
                this.holdStartTime = performance.now();
                this.holdStarlingForMerge = closestStarling;
            }
        }
    }

    private selectUnitsInRectangle(screenStart: Vector2D, screenEnd: Vector2D): void {
        if (!this.game) return;

        // Check if this is a small selection (single click area) and a double-tap
        const selectionWidth = Math.abs(screenEnd.x - screenStart.x);
        const selectionHeight = Math.abs(screenEnd.y - screenStart.y);
        const isSmallSelection = selectionWidth < Constants.SMALL_SELECTION_THRESHOLD && selectionHeight < Constants.SMALL_SELECTION_THRESHOLD;
        const isDoubleTap = isSmallSelection && this.isDoubleTap(screenEnd.x, screenEnd.y);

        // Convert screen coordinates to world coordinates
        const worldStart = this.renderer.screenToWorld(screenStart.x, screenStart.y);
        const worldEnd = this.renderer.screenToWorld(screenEnd.x, screenEnd.y);

        // Calculate rectangle bounds
        const minX = Math.min(worldStart.x, worldEnd.x);
        const maxX = Math.max(worldStart.x, worldEnd.x);
        const minY = Math.min(worldStart.y, worldEnd.y);
        const maxY = Math.max(worldStart.y, worldEnd.y);

        // Get the player's units (assume player 1 is the human player)
        const player = this.getLocalPlayer();
        if (!player || player.isDefeated()) {
            return;
        }

        // If double-tap, check what was clicked and select all of that type
        if (isDoubleTap) {
            // Check if clicked on a starling
            for (const unit of player.units) {
                if (unit instanceof Starling &&
                    unit.position.x >= minX && unit.position.x <= maxX &&
                    unit.position.y >= minY && unit.position.y <= maxY) {
                    this.selectAllStarlings();
                    return;
                }
            }
            
            // Not a starling, continue with normal selection
        }

        // Clear previous selection
        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;
        this.clearWarpGateSelection();

        // Deselect all buildings
        for (const building of player.buildings) {
            building.isSelected = false;
        }
        this.selectedBuildings.clear();

        // Select units within the rectangle
        for (const unit of player.units) {
            if (unit.position.x >= minX && unit.position.x <= maxX &&
                unit.position.y >= minY && unit.position.y <= maxY) {
                this.selectedUnits.add(unit);
            }
        }

        // Select solar mirrors within the rectangle
        for (const mirror of player.solarMirrors) {
            if (mirror.position.x >= minX && mirror.position.x <= maxX &&
                mirror.position.y >= minY && mirror.position.y <= maxY) {
                this.selectedMirrors.add(mirror);
                mirror.isSelected = true;
            } else {
                mirror.isSelected = false;
            }
        }

        // Select base if within rectangle and no units are selected
        if (player.stellarForge && 
            player.stellarForge.position.x >= minX && player.stellarForge.position.x <= maxX &&
            player.stellarForge.position.y >= minY && player.stellarForge.position.y <= maxY &&
            this.selectedUnits.size === 0) {
            this.selectedBase = player.stellarForge;
            player.stellarForge.isSelected = true;
        } else if (player.stellarForge) {
            player.stellarForge.isSelected = false;
        }

        // Update renderer's selected units and mirrors
        this.renderer.selectedUnits = this.selectedUnits;
        this.renderer.selectedMirrors = this.selectedMirrors;

        // Log selection for debugging
        console.log(`Selected ${this.selectedUnits.size} units, ${this.selectedMirrors.size} mirrors, ${this.selectedBase ? '1 base' : '0 bases'}`);
    }

    private cancelHold(): void {
        // Deprecated: Hold-based warp gate creation is no longer used
        // Warp gates are now created instantly via mirror commands
        this.holdStartTime = null;
        this.holdStarlingForMerge = null;
        this.currentWarpGate = null;
        this.isUsingMirrorsForWarpGate = false;
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
    }

    private endHold(): void {
        // Deprecated: Hold-based warp gate creation is no longer used
        this.holdStartTime = null;
        this.holdStarlingForMerge = null;
        this.isUsingMirrorsForWarpGate = false;
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
    }

    private updateStarlingMergeHold(): void {
        if (!this.game) {
            return;
        }
        if (!this.holdStartTime || !this.holdStarlingForMerge) {
            return;
        }

        const player = this.getLocalPlayer();
        if (!player) {
            this.cancelHold();
            return;
        }

        if (!this.selectedUnits.has(this.holdStarlingForMerge)) {
            this.cancelHold();
            return;
        }

        const selectedStarlings = this.getSelectedStarlings(player);
        if (selectedStarlings.length < Constants.STARLING_MERGE_COUNT) {
            this.cancelHold();
            return;
        }

        const hasFoundry = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        if (!hasFoundry) {
            this.cancelHold();
            return;
        }

        const elapsedMs = performance.now() - this.holdStartTime;
        if (elapsedMs < Constants.STARLING_MERGE_HOLD_DURATION_MS) {
            return;
        }

        const targetPosition = new Vector2D(
            this.holdStarlingForMerge.position.x,
            this.holdStarlingForMerge.position.y
        );

        if (this.tryStartStarlingMerge(player, selectedStarlings, targetPosition)) {
            this.shouldSkipMoveOrderThisTap = true;
        }

        this.cancelHold();
    }

    private updateMirrorWarpGateHold(): void {
        if (!this.mirrorHoldStartTimeMs || !this.mirrorHoldWorldPos) {
            return;
        }
        if (this.selectedMirrors.size === 0 || this.mirrorCommandMode === 'warpgate') {
            this.mirrorHoldStartTimeMs = null;
            this.mirrorHoldWorldPos = null;
            return;
        }

        const elapsedMs = performance.now() - this.mirrorHoldStartTimeMs;
        if (elapsedMs < Constants.MIRROR_WARP_GATE_HOLD_DURATION_MS) {
            return;
        }

        this.tryCreateWarpGateAt(this.mirrorHoldWorldPos);
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
    }

    /**
     * Apply radial force to particles (helper function)
     * @param position Center position
     * @param outward If true, pushes particles outward (explosion). If false, pulls inward (implosion)
     */
    private applyRadialForceToParticles(position: Vector2D, outward: boolean): void {
        if (!this.game) return;
        
        for (const particle of this.game.spaceDust) {
            const distance = particle.position.distanceTo(position);
            if (distance < Constants.PARTICLE_SCATTER_RADIUS) {
                // Calculate direction: outward from center or inward to center
                const direction = new Vector2D(
                    outward ? (particle.position.x - position.x) : (position.x - particle.position.x),
                    outward ? (particle.position.y - position.y) : (position.y - particle.position.y)
                ).normalize();
                particle.applyForce(new Vector2D(
                    direction.x * Constants.PARTICLE_SCATTER_FORCE,
                    direction.y * Constants.PARTICLE_SCATTER_FORCE
                ));
            }
        }
    }

    private scatterParticles(position: Vector2D): void {
        // Scatter nearby particles (explosion - outward push)
        this.applyRadialForceToParticles(position, true);
    }

    private implodeParticles(position: Vector2D): void {
        // Pull nearby particles inward (implosion - inward pull)
        this.applyRadialForceToParticles(position, false);
    }

    private unlinkMirrorsFromWarpGate(gate: WarpGate): void {
        if (!this.game) return;

        for (const player of this.game.players) {
            for (const mirror of player.solarMirrors) {
                if (mirror.linkedStructure === gate) {
                    mirror.setLinkedStructure(null);
                }
            }
        }
    }

    private updateFoundryButtonState(): void {
        const player = this.getLocalPlayer();
        if (!player) {
            this.hasActiveFoundry = false;
            this.renderer.hasActiveFoundry = false;
            this.renderer.hasSeenFoundry = this.hasSeenFoundry;
            return;
        }

        const hasActiveFoundry = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        if (hasActiveFoundry) {
            this.hasSeenFoundry = true;
        }
        this.hasActiveFoundry = hasActiveFoundry;
        this.renderer.hasSeenFoundry = this.hasSeenFoundry;
        this.renderer.hasActiveFoundry = hasActiveFoundry;
    }

    private update(deltaTime: number): void {
        if (!this.game) return;
        
        // Don't update game logic if paused
        if (this.isPaused) return;

        if (this.isMultiplayer) {
            this.updateMultiplayer(deltaTime);
        } else {
            this.updateSinglePlayer(deltaTime);
        }
    }

    /**
     * Update single-player game (or LAN)
     */
    private updateSinglePlayer(deltaTime: number): void {
        if (!this.game) return;

        // Update screen shake
        this.renderer.updateScreenShake(deltaTime);

        this.updateStarlingMergeHold();
        this.updateMirrorWarpGateHold();

        if (this.mirrorCommandMode === 'warpgate' && !this.canCreateWarpGateFromSelectedMirrors()) {
            this.mirrorCommandMode = null;
        }
        
        // Check if game has ended
        const winner = this.game.checkVictoryConditions();
        if (winner && this.game.isRunning) {
            this.game.isRunning = false;
        }
        
        if (this.game.isRunning) {
            this.game.update(deltaTime);
        }

        // Update warp gates (energy is transferred via game-state.ts mirror update)
        // Update for completion checks, cancellation, and shockwave emissions
        for (let i = this.game.warpGates.length - 1; i >= 0; i--) {
            const gate = this.game.warpGates[i];
            gate.update(deltaTime);
            
            if (!gate.isComplete && gate.isCharging && !gate.isCancelling && gate.shouldEmitShockwave()) {
                this.scatterParticles(gate.position);
                this.renderer.createWarpGateShockwave(gate.position);
            }

            if (gate.hasDissipated) {
                this.unlinkMirrorsFromWarpGate(gate);
                this.scatterParticles(gate.position);
                this.renderer.createWarpGateShockwave(gate.position);
                if (this.selectedWarpGate === gate) {
                    this.clearWarpGateSelection();
                }
                this.game.warpGates.splice(i, 1);
            }
        }

        for (const explosion of this.game.starlingMergeGateExplosions) {
            this.scatterParticles(explosion);
            this.renderer.createWarpGateShockwave(explosion);
        }
    }

    /**
     * Update P2P multiplayer game with fixed timestep
     */
    private updateMultiplayer(deltaTime: number): void {
        if (!this.network || !this.game) return;

        // Update screen shake
        this.renderer.updateScreenShake(deltaTime);

        this.updateStarlingMergeHold();
        this.updateMirrorWarpGateHold();

        if (this.mirrorCommandMode === 'warpgate' && !this.canCreateWarpGateFromSelectedMirrors()) {
            this.mirrorCommandMode = null;
        }

        // Accumulate time for fixed timestep
        this.tickAccumulator += deltaTime * 1000; // Convert to milliseconds

        // Process ticks
        while (this.tickAccumulator >= this.TICK_INTERVAL_MS) {
            // Get synchronized commands for this tick
            const commands = this.network.getNextTickCommands();

            if (commands) {
                // Execute all commands for this tick (already deterministic via GameState)
                this.game.executeCommands(commands);

                // Advance to next tick
                this.network.advanceTick();

                // Check if game has ended
                const winner = this.game.checkVictoryConditions();
                if (winner && this.game.isRunning) {
                    this.game.isRunning = false;
                }

                // Update game state (deterministic simulation)
                if (this.game.isRunning) {
                    this.game.update(this.TICK_INTERVAL_MS / 1000);
                }

                this.tickAccumulator -= this.TICK_INTERVAL_MS;
            } else {
                // Waiting for commands from other players
                break;
            }
        }

        // Update warp gates with fixed timestep (multiplayer uses fixed ticks for determinism)
        const tickDeltaTime = this.TICK_INTERVAL_MS / 1000;
        for (let i = this.game.warpGates.length - 1; i >= 0; i--) {
            const gate = this.game.warpGates[i];
            gate.update(tickDeltaTime);
            
            if (!gate.isComplete && gate.isCharging && !gate.isCancelling && gate.shouldEmitShockwave()) {
                this.scatterParticles(gate.position);
                this.renderer.createWarpGateShockwave(gate.position);
            }

            if (gate.hasDissipated) {
                this.unlinkMirrorsFromWarpGate(gate);
                this.scatterParticles(gate.position);
                this.renderer.createWarpGateShockwave(gate.position);
                if (this.selectedWarpGate === gate) {
                    this.clearWarpGateSelection();
                }
                this.game.warpGates.splice(i, 1);
            }
        }

        for (const explosion of this.game.starlingMergeGateExplosions) {
            this.scatterParticles(explosion);
            this.renderer.createWarpGateShockwave(explosion);
        }
    }

    private render(): void {
        if (this.game) {
            this.updateFoundryButtonState();
            const canCreateWarpGate = this.selectedMirrors.size > 0
                && this.canCreateWarpGateFromSelectedMirrors();
            this.renderer.canCreateWarpGateFromMirrors = canCreateWarpGate;
            this.renderer.isWarpGatePlacementMode = this.mirrorCommandMode === 'warpgate'
                && canCreateWarpGate;
            this.renderer.render(this.game);
        }
    }

    private gameLoop(currentTime: number): void {
        if (!this.isRunning) return;

        // Calculate delta time in seconds
        const deltaTime = this.lastTime === 0 ? 0 : (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update and render (cap delta time to prevent huge jumps)
        this.update(Math.min(deltaTime, 0.1));
        this.render();

        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    start(): void {
        if (!this.game) return;
        
        this.isRunning = true;
        this.lastTime = 0;
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    stop(): void {
        this.isRunning = false;
    }
}

// Start game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const controller = new GameController();
    // Expose for dev/testing purposes
    (window as any).gameController = controller;
});
