import {
    Faction,
    GameState,
    Vector2D,
    WarpGate,
    Minigun,
    GatlingTower,
    SpaceDustSwirler,
    SubsidiaryFactory,
    StrikerTower,
    LockOnLaserTower,
    ShieldTower,
    LightRay,
    SolarMirror,
    Player,
} from '../game-core';
import { GameRenderer } from '../renderer';
import * as Constants from '../constants';

export interface WarpGateManagerContext {
    renderer: GameRenderer;
    getGame: () => GameState | null;
    getLocalPlayer: () => Player | null;
    getSelectedMirrors: () => Set<SolarMirror>;
    setSelectedMirrors: (mirrors: Set<SolarMirror>) => void;
    getRadialButtonOffsets: (buttonCount: number) => Array<{ x: number; y: number }>;
    sendNetworkCommand: (command: string, data: Record<string, unknown>) => void;
    scatterParticles: (position: Vector2D) => void;
    implodeParticles: (position: Vector2D) => void;
    setShouldSkipMoveOrderThisTap: (value: boolean) => void;
}

export class WarpGateManager {
    public selectedWarpGate: WarpGate | null = null;
    public currentWarpGate: WarpGate | null = null;
    public mirrorCommandMode: 'warpgate' | null = null;
    public mirrorHoldStartTimeMs: number | null = null;
    public mirrorHoldWorldPos: Vector2D | null = null;
    public shouldCancelMirrorWarpGateOnRelease: boolean = false;
    public isUsingMirrorsForWarpGate: boolean = false;

    private ctx: WarpGateManagerContext;

    constructor(context: WarpGateManagerContext) {
        this.ctx = context;
    }

    public clearWarpGateSelection(): void {
        this.selectedWarpGate = null;
        this.ctx.renderer.selectedWarpGate = null;
        this.ctx.renderer.highlightedButtonIndex = -1;
    }

    public getWarpGateAtPosition(worldPos: Vector2D, player: Player): WarpGate | null {
        const game = this.ctx.getGame();
        if (!game) {
            return null;
        }

        for (const gate of game.warpGates) {
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

    public getWarpGateButtonIndexFromClick(
        gate: WarpGate,
        screenX: number,
        screenY: number
    ): number {
        const gateScreenPos = this.ctx.renderer.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * this.ctx.renderer.zoom;
        const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.ctx.renderer.zoom;
        const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.ctx.renderer.zoom;
        const positions = this.ctx.getRadialButtonOffsets(4);

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

    public isWarpGateButtonAvailable(player: Player, buttonIndex: number): boolean {
        const hasSubFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        const playerEnergy = player.energy;

        if (player.faction === Faction.RADIANT) {
            if (buttonIndex === 0) {
                return !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST;
            }
            if (buttonIndex === 1) {
                return playerEnergy >= Constants.MINIGUN_COST;
            }
            if (buttonIndex === 2) {
                return playerEnergy >= Constants.GATLING_COST;
            }
            if (buttonIndex === 3) {
                return playerEnergy >= Constants.SHIELD_TOWER_COST;
            }
            return false;
        }

        if (player.faction === Faction.VELARIS) {
            if (buttonIndex === 0) {
                return !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST;
            }
            if (buttonIndex === 1) {
                return playerEnergy >= Constants.STRIKER_TOWER_COST;
            }
            if (buttonIndex === 2) {
                return playerEnergy >= Constants.LOCKON_TOWER_COST;
            }
            if (buttonIndex === 3) {
                return playerEnergy >= Constants.SWIRLER_COST;
            }
            return false;
        }

        if (buttonIndex === 0) {
            return !hasSubFactory && playerEnergy >= Constants.SUBSIDIARY_FACTORY_COST;
        }

        return false;
    }

    public getWarpGateButtonDirection(buttonIndex: number): Vector2D | null {
        const directions = this.ctx.getRadialButtonOffsets(4);
        const direction = directions[buttonIndex];
        if (!direction) {
            return null;
        }
        return new Vector2D(direction.x, direction.y);
    }

    public getWarpGateButtonWorldPosition(gate: WarpGate, buttonIndex: number): Vector2D | null {
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

    public buildFromWarpGate(player: Player, gate: WarpGate, buttonIndex: number): void {
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
            this.ctx.sendNetworkCommand('building_purchase', {
                buildingType: 'SubsidiaryFactory',
                positionX: gate.position.x,
                positionY: gate.position.y
            });
        } else if (buttonIndex === 1) {
            if (player.faction === Faction.RADIANT) {
                if (!player.spendEnergy(Constants.MINIGUN_COST)) {
                    console.log('Not enough energy to build Cannon');
                    return;
                }
                const minigun = new Minigun(gatePosition, player);
                player.buildings.push(minigun);
                console.log(`Cannon building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'Minigun',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                if (!player.spendEnergy(Constants.STRIKER_TOWER_COST)) {
                    console.log('Not enough energy to build Striker Tower');
                    return;
                }
                const striker = new StrikerTower(gatePosition, player);
                player.buildings.push(striker);
                console.log(`Striker Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'StrikerTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else if (buttonIndex === 2) {
            if (player.faction === Faction.RADIANT) {
                if (!player.spendEnergy(Constants.GATLING_COST)) {
                    console.log('Not enough energy to build Gatling Tower');
                    return;
                }
                const gatling = new GatlingTower(gatePosition, player);
                player.buildings.push(gatling);
                console.log(`Gatling Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'Gatling',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                if (!player.spendEnergy(Constants.LOCKON_TOWER_COST)) {
                    console.log('Not enough energy to build Lock-on Laser Tower');
                    return;
                }
                const lockon = new LockOnLaserTower(gatePosition, player);
                player.buildings.push(lockon);
                console.log(`Lock-on Laser Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'LockOnLaserTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else if (buttonIndex === 3) {
            if (player.faction === Faction.RADIANT) {
                if (!player.spendEnergy(Constants.SHIELD_TOWER_COST)) {
                    console.log('Not enough energy to build Shield Tower');
                    return;
                }
                const shield = new ShieldTower(gatePosition, player);
                player.buildings.push(shield);
                console.log(`Shield Tower building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'ShieldTower',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            } else if (player.faction === Faction.VELARIS) {
                if (!player.spendEnergy(Constants.SWIRLER_COST)) {
                    console.log('Not enough energy to build Cyclone');
                    return;
                }
                const swirler = new SpaceDustSwirler(gatePosition, player);
                player.buildings.push(swirler);
                console.log(`Cyclone building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                this.ctx.sendNetworkCommand('building_purchase', {
                    buildingType: 'SpaceDustSwirler',
                    positionX: gate.position.x,
                    positionY: gate.position.y
                });
            }
        } else {
            return;
        }

        this.ctx.scatterParticles(gate.position);
        this.removeWarpGate(gate);
    }

    public removeWarpGate(gate: WarpGate): void {
        const game = this.ctx.getGame();
        if (!game) {
            return;
        }

        const gateIndex = game.warpGates.indexOf(gate);
        if (gateIndex > -1) {
            game.warpGates.splice(gateIndex, 1);
        }
        if (this.currentWarpGate === gate) {
            this.currentWarpGate = null;
        }
        if (this.selectedWarpGate === gate) {
            this.clearWarpGateSelection();
        }
        this.ctx.implodeParticles(gate.position);
    }

    public tryCreateWarpGateAt(worldPos: Vector2D): boolean {
        const game = this.ctx.getGame();
        if (!game) {
            return false;
        }
        const player = this.ctx.getLocalPlayer();
        const selectedMirrors = this.ctx.getSelectedMirrors();
        if (!player || selectedMirrors.size === 0) {
            return false;
        }

        if (!game.isPointWithinPlayerInfluence(player, worldPos)) {
            console.log('Cannot place warp gate outside influence field');
            return false;
        }

        if (!this.canCreateWarpGateFromSelectedMirrors(worldPos)) {
            return false;
        }

        const warpGate = new WarpGate(worldPos, player);
        warpGate.startCharging();
        game.warpGates.push(warpGate);
        this.currentWarpGate = warpGate;
        this.ctx.setShouldSkipMoveOrderThisTap(true);

        for (const mirror of selectedMirrors) {
            mirror.setLinkedStructure(warpGate);
            mirror.isSelected = false;
        }
        selectedMirrors.clear();
        this.ctx.setSelectedMirrors(selectedMirrors);
        this.ctx.renderer.selectedMirrors = selectedMirrors;

        console.log('Mirror-based warp gate created at', worldPos);

        this.mirrorCommandMode = null;
        this.mirrorHoldStartTimeMs = null;
        this.mirrorHoldWorldPos = null;
        this.shouldCancelMirrorWarpGateOnRelease = false;
        return true;
    }

    public canCreateWarpGateFromSelectedMirrors(targetPos?: Vector2D): boolean {
        const game = this.ctx.getGame();
        if (!game) {
            return false;
        }

        for (const mirror of this.ctx.getSelectedMirrors()) {
            if (!mirror.hasLineOfSightToLight(game.suns, game.asteroids)) {
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
            for (const asteroid of game.asteroids) {
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
}
