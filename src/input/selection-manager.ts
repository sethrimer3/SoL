import {
    GameState,
    Vector2D,
    Unit,
    SolarMirror,
    Starling,
    Player,
    Building,
    SubsidiaryFactory,
} from '../game-core';
import { GameRenderer } from '../renderer';
import { WarpGateManager } from './warp-gate-manager';
import * as Constants from '../constants';

export interface SelectionManagerContext {
    renderer: GameRenderer;
    getGame: () => GameState | null;
    getLocalPlayer: () => Player | null;
    getWarpGateManager: () => WarpGateManager;
    sendNetworkCommand: (command: string, data: Record<string, unknown>) => void;
    isDoubleTap: (screenX: number, screenY: number) => boolean;
}

export class SelectionManager {
    public selectedUnits: Set<Unit> = new Set();
    public selectedMirrors: Set<SolarMirror> = new Set();
    public selectedBase: any | null = null;
    public selectedBuildings: Set<any> = new Set();

    private ctx: SelectionManagerContext;

    constructor(context: SelectionManagerContext) {
        this.ctx = context;
    }

    public hasHeroUnitsSelected(): boolean {
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

    public getSelectedStarlings(player: Player): Starling[] {
        const starlings: Starling[] = [];
        for (const unit of this.selectedUnits) {
            if (unit instanceof Starling && unit.owner === player) {
                starlings.push(unit);
            }
        }
        return starlings;
    }

    public tryStartStarlingMerge(player: Player, starlings: Starling[], targetPosition: Vector2D): boolean {
        const game = this.ctx.getGame();
        if (!game) {
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
        const unitIds = mergeStarlings.map((unit) => game.getUnitNetworkId(unit));
        game.applyStarlingMerge(player, unitIds, targetPosition);
        this.ctx.sendNetworkCommand('starling_merge', {
            unitIds,
            targetX: targetPosition.x,
            targetY: targetPosition.y
        });

        for (const unit of this.selectedUnits) {
            unit.isSelected = false;
        }
        this.selectedUnits.clear();
        this.ctx.renderer.selectedUnits = this.selectedUnits;
        return true;
    }

    public getClosestSelectedStarling(worldPos: Vector2D): Starling | null {
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

    public isDragStartNearSelectedUnits(worldPos: Vector2D): boolean {
        if (this.selectedUnits.size === 0) return false;

        for (const unit of this.selectedUnits) {
            const distance = unit.position.distanceTo(worldPos);
            if (distance <= Constants.UNIT_PATH_DRAW_RADIUS) {
                return true;
            }
        }
        return false;
    }

    public isDragStartNearSelectedMirrors(worldPos: Vector2D): boolean {
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

    public clearAllSelections(): void {
        const player = this.ctx.getLocalPlayer();
        if (!player) return;

        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;
        this.selectedBuildings.clear();
        const warpGateManager = this.ctx.getWarpGateManager();
        warpGateManager.clearWarpGateSelection();
        warpGateManager.mirrorCommandMode = null;
        warpGateManager.mirrorHoldStartTimeMs = null;
        warpGateManager.mirrorHoldWorldPos = null;
        warpGateManager.shouldCancelMirrorWarpGateOnRelease = false;

        if (player.stellarForge) {
            player.stellarForge.isSelected = false;
        }
        for (const mirror of player.solarMirrors) {
            mirror.isSelected = false;
        }
        for (const building of player.buildings) {
            building.isSelected = false;
        }

        this.ctx.renderer.selectedUnits = this.selectedUnits;
        this.ctx.renderer.selectedMirrors = this.selectedMirrors;
    }

    public selectAllStarlings(): void {
        const game = this.ctx.getGame();
        if (!game) return;

        const player = this.ctx.getLocalPlayer();
        if (!player) return;

        this.clearAllSelections();

        for (const unit of player.units) {
            if (unit instanceof Starling) {
                this.selectedUnits.add(unit);
            }
        }

        this.ctx.renderer.selectedUnits = this.selectedUnits;
        console.log(`Double-tap: Selected all ${this.selectedUnits.size} starlings`);
    }

    public selectAllBuildingsOfType(clickedBuilding: Building): void {
        const game = this.ctx.getGame();
        if (!game) return;

        const player = this.ctx.getLocalPlayer();
        if (!player) return;

        this.clearAllSelections();

        const buildingType = clickedBuilding.constructor;
        for (const building of player.buildings) {
            if (building.constructor === buildingType) {
                building.isSelected = true;
                this.selectedBuildings.add(building);
            }
        }

        console.log(`Double-tap: Selected all ${this.selectedBuildings.size} buildings of type ${buildingType.name}`);
    }

    public selectUnitsInRectangle(screenStart: Vector2D, screenEnd: Vector2D): void {
        const game = this.ctx.getGame();
        if (!game) return;

        const selectionWidth = Math.abs(screenEnd.x - screenStart.x);
        const selectionHeight = Math.abs(screenEnd.y - screenStart.y);
        const isSmallSelection = selectionWidth < Constants.SMALL_SELECTION_THRESHOLD && selectionHeight < Constants.SMALL_SELECTION_THRESHOLD;
        const isDoubleTap = isSmallSelection && this.ctx.isDoubleTap(screenEnd.x, screenEnd.y);

        const worldStart = this.ctx.renderer.screenToWorld(screenStart.x, screenStart.y);
        const worldEnd = this.ctx.renderer.screenToWorld(screenEnd.x, screenEnd.y);

        const minX = Math.min(worldStart.x, worldEnd.x);
        const maxX = Math.max(worldStart.x, worldEnd.x);
        const minY = Math.min(worldStart.y, worldEnd.y);
        const maxY = Math.max(worldStart.y, worldEnd.y);

        const player = this.ctx.getLocalPlayer();
        if (!player || player.isDefeated()) {
            return;
        }

        if (isDoubleTap) {
            for (const unit of player.units) {
                if (unit instanceof Starling &&
                    unit.position.x >= minX && unit.position.x <= maxX &&
                    unit.position.y >= minY && unit.position.y <= maxY) {
                    this.selectAllStarlings();
                    return;
                }
            }
        }

        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;
        this.ctx.getWarpGateManager().clearWarpGateSelection();

        for (const building of player.buildings) {
            building.isSelected = false;
        }
        this.selectedBuildings.clear();

        for (const unit of player.units) {
            if (unit.position.x >= minX && unit.position.x <= maxX &&
                unit.position.y >= minY && unit.position.y <= maxY) {
                this.selectedUnits.add(unit);
            }
        }

        for (const mirror of player.solarMirrors) {
            if (mirror.position.x >= minX && mirror.position.x <= maxX &&
                mirror.position.y >= minY && mirror.position.y <= maxY) {
                this.selectedMirrors.add(mirror);
                mirror.isSelected = true;
            } else {
                mirror.isSelected = false;
            }
        }

        if (player.stellarForge &&
            player.stellarForge.position.x >= minX && player.stellarForge.position.x <= maxX &&
            player.stellarForge.position.y >= minY && player.stellarForge.position.y <= maxY &&
            this.selectedUnits.size === 0) {
            this.selectedBase = player.stellarForge;
            player.stellarForge.isSelected = true;
        } else if (player.stellarForge) {
            player.stellarForge.isSelected = false;
        }

        this.ctx.renderer.selectedUnits = this.selectedUnits;
        this.ctx.renderer.selectedMirrors = this.selectedMirrors;

        console.log(`Selected ${this.selectedUnits.size} units, ${this.selectedMirrors.size} mirrors, ${this.selectedBase ? '1 base' : '0 bases'}`);
    }
}
