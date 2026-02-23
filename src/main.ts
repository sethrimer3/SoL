/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate, Unit, Sun, Asteroid, Minigun, GatlingTower, SpaceDustSwirler, SubsidiaryFactory, StrikerTower, LockOnLaserTower, ShieldTower, LightRay, Starling, StellarForge, SolarMirror, Marine, Mothership, Grave, Ray, InfluenceBall, TurretDeployer, Driller, Dagger, Beam, Player, Building, Nova, Sly, Shadow, Chrono, Splendor } from './game-core';
import { WarpGateManager, WarpGateManagerContext } from './input/warp-gate-manager';
import { SelectionManager, SelectionManagerContext } from './input/selection-manager';
import { InputController, InputControllerContext } from './input/input-controller';
import { GameRenderer } from './renderer';
import { MainMenu, GameSettings, COLOR_SCHEMES } from './menu';
import { GameAudioController } from './game-audio';
import * as Constants from './constants';
import { MultiplayerNetworkManager, NetworkEvent } from './multiplayer-network';
import { setGameRNG, SeededRandom, generateMatchSeed } from './seeded-random';
import { createGameFromSettings } from './game-factory';
import { 
    ReplayRecorder, 
    ReplayPlayer, 
    ReplayData, 
    ReplaySpeed, 
    downloadReplay, 
    saveReplayToStorage,
    saveMatchToHistory,
    MatchHistoryEntry,
    getPlayerMMRData,
    updatePlayerMMR
} from './replay';

class GameController {
    public game: GameState | null = null;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private showInGameMenu: boolean = false;
    private showInfo: boolean = false;
    private warpGateManager!: WarpGateManager;
    private selectionManager!: SelectionManager;
    private inputController!: InputController;
    private shouldSkipMoveOrderThisTap: boolean = false;
    private hasSeenFoundry: boolean = false;
    private hasActiveFoundry: boolean = false;
    private menu: MainMenu;
    private gameAudioController: GameAudioController;
    private localPlayerIndex: number = 0; // Track local player index for LAN mode

    // P2P Multiplayer properties
    private network: MultiplayerNetworkManager | null = null;
    private isMultiplayer: boolean = false;
    private tickAccumulator: number = 0;
    private readonly TICK_INTERVAL_MS: number = 1000 / 30; // 30 ticks/second (33.333... ms)

    // Replay system properties
    private replayRecorder: ReplayRecorder | null = null;
    private replayPlayer: ReplayPlayer | null = null;
    private isWatchingReplay: boolean = false;
    private currentGameSeed: number = 0;


    private getHeroUnitType(heroName: string): string | null {
        switch (heroName) {
            case 'Marine':
            case 'Mothership':
            case 'Grave':
            case 'Ray':
            case 'Dagger':
            case 'Beam':
            case 'Driller':
            case 'Nova':
            case 'Sly':
            case 'Shadow':
            case 'Chrono':
            case 'Splendor':
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
            case 'Mothership':
                return unit instanceof Mothership;
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
            case 'Shadow':
                return unit instanceof Shadow;
            case 'Chrono':
                return unit instanceof Chrono;
            case 'Splendor':
                return unit instanceof Splendor;
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


    private getHeroUnitCost(player: Player): number {
        const aliveHeroCount = player.units.filter((unit) => unit.isHero).length;
        return Constants.HERO_UNIT_BASE_COST + aliveHeroCount * Constants.HERO_UNIT_COST_INCREMENT;
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
        if (this.selectionManager.selectedUnits.size === 0) {
            return false;
        }
        for (const unit of this.selectionManager.selectedUnits) {
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
            if (foundry.canQueueStrafeUpgrade()) {
                foundry.enqueueProduction(Constants.FOUNDRY_STRAFE_UPGRADE_ITEM);
                console.log('Queued foundry Strafe upgrade');
                this.sendNetworkCommand('foundry_strafe_upgrade', { buildingId });
                foundry.isSelected = false;
                this.selectionManager.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Strafe upgrade');
            }
        } else if (buttonIndex === 1) {
            if (foundry.canQueueBlinkUpgrade()) {
                foundry.enqueueProduction(Constants.FOUNDRY_BLINK_UPGRADE_ITEM);
                console.log('Queued foundry Blink upgrade');
                this.sendNetworkCommand('foundry_blink_upgrade', { buildingId });
                foundry.isSelected = false;
                this.selectionManager.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Blink upgrade');
            }
        } else if (buttonIndex === 2) {
            if (foundry.canQueueRegenUpgrade()) {
                foundry.enqueueProduction(Constants.FOUNDRY_REGEN_UPGRADE_ITEM);
                console.log('Queued foundry Regen upgrade');
                this.sendNetworkCommand('foundry_regen_upgrade', { buildingId });
                foundry.isSelected = false;
                this.selectionManager.selectedBuildings.clear();
            } else {
                console.log('Cannot queue Regen upgrade');
            }
        } else if (buttonIndex === 3) {
            if (foundry.canQueueAttackUpgrade()) {
                foundry.enqueueProduction(Constants.FOUNDRY_ATTACK_UPGRADE_ITEM);
                console.log('Queued foundry +1 ATK upgrade');
                this.sendNetworkCommand('foundry_attack_upgrade', { buildingId });
                foundry.isSelected = false;
                this.selectionManager.selectedBuildings.clear();
            } else {
                console.log('Cannot queue +1 ATK upgrade');
            }
        }
    }

    /**
     * Check if this click is a double-tap
     */

    private getForgeButtonLabels(): string[] {
        const heroLabels = this.renderer.selectedHeroNames.slice(0, 4);
        return [...heroLabels, 'Solar Mirror'];
    }

    private trySpawnSolarMirrorFromForge(player: Player): boolean {
        if (!this.game || !player.stellarForge) {
            return false;
        }

        const mirrorRadiusPx = Constants.AI_MIRROR_COLLISION_RADIUS_PX;
        const spawnDistancePx = player.stellarForge.radius + Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
        let spawnPosition = new Vector2D(player.stellarForge.position.x, player.stellarForge.position.y);
        let hasSpawnPosition = false;

        for (let ringIndex = 0; ringIndex < 4 && !hasSpawnPosition; ringIndex++) {
            const ringDistancePx = spawnDistancePx + ringIndex * (mirrorRadiusPx + 12);
            for (let angleIndex = 0; angleIndex < 12; angleIndex++) {
                const angleRad = (Math.PI * 2 * angleIndex) / 12;
                const candidate = new Vector2D(
                    player.stellarForge.position.x + Math.cos(angleRad) * ringDistancePx,
                    player.stellarForge.position.y + Math.sin(angleRad) * ringDistancePx
                );
                if (!this.game.checkCollision(candidate, mirrorRadiusPx)) {
                    spawnPosition = candidate;
                    hasSpawnPosition = true;
                    break;
                }
            }
        }

        if (!hasSpawnPosition) {
            console.log('No valid spawn point for new Solar Mirror');
            return false;
        }

        player.stellarForge.enqueueMirror(Constants.STELLAR_FORGE_SOLAR_MIRROR_COST, spawnPosition);
        this.sendNetworkCommand('mirror_purchase', {
            positionX: spawnPosition.x,
            positionY: spawnPosition.y,
            cost: Constants.STELLAR_FORGE_SOLAR_MIRROR_COST
        });
        console.log('Forged a new Solar Mirror from Stellar Forge');
        return true;
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
        
        const displayHeroes = heroNames;
        const positions = this.inputController.getRadialButtonOffsets(displayHeroes.length);
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
        const positions = this.inputController.getRadialButtonOffsets(4);

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
        shouldShowFoundryButton: boolean,
        isSelectedMirrorInSunlight: boolean
    ): number {
        if (!isSelectedMirrorInSunlight) {
            return this.getNearestButtonIndexFromAngle(dragAngleRad, 1);
        }
        const buttonCount = shouldShowFoundryButton ? 3 : 2;
        return this.getNearestButtonIndexFromAngle(dragAngleRad, buttonCount);
    }

    private isSelectedMirrorInSunlight(): boolean {
        if (!this.game || this.selectionManager.selectedMirrors.size === 0) {
            return false;
        }
        for (const mirror of this.selectionManager.selectedMirrors) {
            if (mirror.hasLineOfSightToLight(this.game.suns, this.game.asteroids)) {
                return true;
            }
        }
        return false;
    }

    private hasLineOfSightToAnySun(point: Vector2D): boolean {
        if (!this.game || this.game.suns.length === 0) {
            return false;
        }
        for (const sun of this.game.suns) {
            const direction = new Vector2D(sun.position.x - point.x, sun.position.y - point.y).normalize();
            const ray = new LightRay(point, direction);
            const distanceToSun = point.distanceTo(sun.position);
            let isBlocked = false;
            for (const asteroid of this.game.asteroids) {
                const intersectionDist = ray.getIntersectionDistance(asteroid.getWorldVertices());
                if (intersectionDist !== null && intersectionDist < distanceToSun) {
                    isBlocked = true;
                    break;
                }
            }
            if (!isBlocked) {
                return true;
            }
        }
        return false;
    }

    private findNearestSunlightTarget(fromPos: Vector2D): Vector2D | null {
        if (!this.game || this.game.suns.length === 0) {
            return null;
        }

        let nearestSun: Sun | null = null;
        let minDistance = Infinity;
        for (const sun of this.game.suns) {
            const distance = fromPos.distanceTo(sun.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestSun = sun;
            }
        }
        if (!nearestSun) {
            return null;
        }

        const targetDistance = nearestSun.radius + 180;
        const baseAngleRad = Math.atan2(fromPos.y - nearestSun.position.y, fromPos.x - nearestSun.position.x);
        const sampleCount = 24;

        for (let i = 0; i < sampleCount; i++) {
            const angleOffset = (Math.PI * 2 * i) / sampleCount;
            const angleRad = baseAngleRad + angleOffset;
            const candidate = new Vector2D(
                nearestSun.position.x + Math.cos(angleRad) * targetDistance,
                nearestSun.position.y + Math.sin(angleRad) * targetDistance
            );
            if (this.game.checkCollision(candidate, 20)) {
                continue;
            }
            if (!this.hasLineOfSightToAnySun(candidate)) {
                continue;
            }
            return candidate;
        }

        return null;
    }

    private moveSelectedMirrorsToNearestSunlight(player: Player): void {
        if (this.selectionManager.selectedMirrors.size === 0 || !this.game) {
            return;
        }

        for (const mirror of this.selectionManager.selectedMirrors) {
            const target = mirror.setTargetToNearestSunlight(this.game);
            if (!target) {
                console.log('No nearby sunlight destination found for mirror');
                continue;
            }
            this.inputController.moveOrderCounter++;
            mirror.moveOrder = this.inputController.moveOrderCounter;
            const mirrorIndex = player.solarMirrors.indexOf(mirror);
            if (mirrorIndex >= 0) {
                this.sendNetworkCommand('mirror_move', {
                    mirrorIndices: [mirrorIndex],
                    targetX: target.x,
                    targetY: target.y,
                    moveOrder: this.inputController.moveOrderCounter,
                    toSun: true
                });
                console.log(`Moving mirror to sunlight at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);
            }
        }

        // Deselect all mirrors after issuing the "to sun" command
        for (const mirror of this.selectionManager.selectedMirrors) {
            mirror.isSelected = false;
        }
        this.selectionManager.selectedMirrors.clear();
        this.renderer.selectedMirrors = this.selectionManager.selectedMirrors;
    }

    private getBuildingAbilityAnchorScreen(): Vector2D | null {
        if (this.selectionManager.selectedBase) {
            return this.renderer.worldToScreen(this.selectionManager.selectedBase.position);
        }

        if (this.selectionManager.selectedMirrors.size > 0) {
            for (const mirror of this.selectionManager.selectedMirrors) {
                return this.renderer.worldToScreen(mirror.position);
            }
        }

        if (this.warpGateManager.selectedWarpGate) {
            return this.renderer.worldToScreen(this.warpGateManager.selectedWarpGate.position);
        }

        if (this.selectionManager.selectedBuildings.size === 1) {
            const selectedBuilding = Array.from(this.selectionManager.selectedBuildings)[0];
            if (selectedBuilding instanceof SubsidiaryFactory) {
                return this.renderer.worldToScreen(selectedBuilding.position);
            }
        }

        return null;
    }


    private cancelMirrorWarpGateModeAndDeselectMirrors(): void {
        this.warpGateManager.mirrorCommandMode = null;
        this.warpGateManager.shouldCancelMirrorWarpGateOnRelease = false;
        for (const mirror of this.selectionManager.selectedMirrors) {
            mirror.isSelected = false;
        }
        this.selectionManager.selectedMirrors.clear();
        this.selectionManager.selectedBase = null;
        this.renderer.selectedMirrors = this.selectionManager.selectedMirrors;
        this.clearPathPreview();
    }

    private clearPathPreview(): void {
        this.inputController.pathPoints = [];
        this.inputController.isDrawingPath = false;
        this.renderer.pathPreviewForge = null;
        this.renderer.pathPreviewStartWorld = null;
        this.renderer.pathPreviewPoints = this.inputController.pathPoints;
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

    private getWarpGateManagerContext(): WarpGateManagerContext {
        return {
            renderer: this.renderer,
            getGame: () => this.game,
            getLocalPlayer: () => this.getLocalPlayer(),
            getSelectedMirrors: () => this.selectionManager.selectedMirrors,
            setSelectedMirrors: (mirrors) => { this.selectionManager.selectedMirrors = mirrors; },
            getRadialButtonOffsets: (count) => this.inputController.getRadialButtonOffsets(count),
            sendNetworkCommand: (cmd, data) => this.sendNetworkCommand(cmd, data),
            scatterParticles: (pos) => this.scatterParticles(pos),
            implodeParticles: (pos) => this.implodeParticles(pos),
            setShouldSkipMoveOrderThisTap: (value) => { this.shouldSkipMoveOrderThisTap = value; },
        };
    }

    private getSelectionManagerContext(): SelectionManagerContext {
        return {
            renderer: this.renderer,
            getGame: () => this.game,
            getLocalPlayer: () => this.getLocalPlayer(),
            getWarpGateManager: () => this.warpGateManager,
            sendNetworkCommand: (cmd, data) => this.sendNetworkCommand(cmd, data),
            isDoubleTap: (screenX, screenY) => this.inputController.isDoubleTap(screenX, screenY),
        };
    }

    private getInputControllerContext(): InputControllerContext {
        return {
            renderer: this.renderer,
            getGame: () => this.game,
            getLocalPlayer: () => this.getLocalPlayer(),
            getSelectionManager: () => this.selectionManager,
            getWarpGateManager: () => this.warpGateManager,
            sendNetworkCommand: (cmd, data) => this.sendNetworkCommand(cmd, data),
            getShowInGameMenu: () => this.showInGameMenu,
            setShowInGameMenu: (val) => { this.showInGameMenu = val; },
            getIsPaused: () => this.isPaused,
            setIsPaused: (val) => { this.isPaused = val; },
            getShowInfo: () => this.showInfo,
            setShowInfo: (val) => { this.showInfo = val; },
            getHasSeenFoundry: () => this.hasSeenFoundry,
            getHasActiveFoundry: () => this.hasActiveFoundry,
            getShouldSkipMoveOrderThisTap: () => this.shouldSkipMoveOrderThisTap,
            setShouldSkipMoveOrderThisTap: (val) => { this.shouldSkipMoveOrderThisTap = val; },
            scatterParticles: (pos) => this.scatterParticles(pos),
            implodeParticles: (pos) => this.implodeParticles(pos),
            toggleInGameMenu: () => this.toggleInGameMenu(),
            toggleInfo: () => this.toggleInfo(),
            surrender: () => this.surrender(),
            returnToMainMenu: () => this.returnToMainMenu(),
            setSoundVolume: (vol) => this.gameAudioController.setSoundVolume(vol),
            setSettingsSoundVolume: (volumePercent) => { this.menu.getSettings().soundVolume = volumePercent; },
            setSettingsMusicVolume: (volumePercent) => { this.menu.getSettings().musicVolume = volumePercent; },
            getHeroUnitType: (heroName) => this.getHeroUnitType(heroName),
            getHeroUnitCost: (player) => this.getHeroUnitCost(player),
            isHeroUnitAlive: (player, heroUnitType) => this.isHeroUnitAlive(player, heroUnitType),
            isHeroUnitQueuedOrProducing: (forge, heroUnitType) => this.isHeroUnitQueuedOrProducing(forge, heroUnitType),
            getTargetableStructureAtPosition: (worldPos, player) => this.getTargetableStructureAtPosition(worldPos, player),
            getFriendlySacrificeTargetAtPosition: (worldPos, player) => this.getFriendlySacrificeTargetAtPosition(worldPos, player),
            getClosestSelectedMirror: (player, worldPos) => this.getClosestSelectedMirror(player, worldPos),
            getTargetStructureRadiusPx: (target) => this.getTargetStructureRadiusPx(target),
            handleFoundryButtonPress: (player, foundry, buttonIndex) => this.handleFoundryButtonPress(player, foundry, buttonIndex),
            hasSelectedStarlingsOnly: () => this.hasSelectedStarlingsOnly(),
            getForgeButtonLabels: () => this.getForgeButtonLabels(),
            trySpawnSolarMirrorFromForge: (player) => this.trySpawnSolarMirrorFromForge(player),
            getClickedHeroButton: (screenX, screenY, forge, heroNames) => this.getClickedHeroButton(screenX, screenY, forge, heroNames),
            getClickedFoundryButtonIndex: (screenX, screenY, foundry) => this.getClickedFoundryButtonIndex(screenX, screenY, foundry),
            getNearestButtonIndexFromAngle: (dragAngleRad, buttonCount) => this.getNearestButtonIndexFromAngle(dragAngleRad, buttonCount),
            getNearestMirrorButtonIndexFromAngle: (dragAngleRad, shouldShowFoundryButton, isSelectedMirrorInSunlight) => this.getNearestMirrorButtonIndexFromAngle(dragAngleRad, shouldShowFoundryButton, isSelectedMirrorInSunlight),
            isSelectedMirrorInSunlight: () => this.isSelectedMirrorInSunlight(),
            moveSelectedMirrorsToNearestSunlight: (player) => this.moveSelectedMirrorsToNearestSunlight(player),
            getBuildingAbilityAnchorScreen: () => this.getBuildingAbilityAnchorScreen(),
            cancelMirrorWarpGateModeAndDeselectMirrors: () => this.cancelMirrorWarpGateModeAndDeselectMirrors(),
            clearPathPreview: () => this.clearPathPreview(),
        };
    }

    private getLocalPlayer(): Player | null {
        if (!this.game) {
            return null;
        }
        return this.game.players[this.localPlayerIndex] ?? null;
    }

    private sendNetworkCommand(command: string, data: Record<string, unknown>): void {
        // Record command for replay if recording is active
        if (this.replayRecorder && this.replayRecorder.isActive() && this.game) {
            const player = this.getLocalPlayer();
            // Convert gameTime (seconds) to tick number assuming 60 ticks/second
            const tickNumber = Math.floor(this.game.gameTime * 60);
            this.replayRecorder.recordCommand({
                tick: tickNumber,
                playerId: player?.name || 'player',
                command: command,
                data: data
            });
        }

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
        // Stop replay recording if active
        if (this.replayRecorder && this.replayRecorder.isActive()) {
            this.stopReplayRecording();
        }

        // Stop the game
        this.stop();
        this.game = null;
        
        // Clear selections
        this.selectionManager.selectedUnits.clear();
        this.selectionManager.selectedMirrors.clear();
        this.selectionManager.selectedBase = null;
        this.selectionManager.selectedBuildings.clear();
        this.warpGateManager.clearWarpGateSelection();
        this.renderer.selectedUnits = this.selectionManager.selectedUnits;
        this.renderer.selectedMirrors = this.selectionManager.selectedMirrors;
        
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

    private initializeReplayRecorder(settings: GameSettings): void {
        if (!this.game || this.isWatchingReplay) {
            return;
        }

        // Create replay player info from game state
        const players = this.game.players.map((player, index) => ({
            playerId: `p${index + 1}`,
            playerName: player.name,
            faction: player.faction,
            isLocal: index === this.localPlayerIndex
        }));

        // Get map info
        const mapInfo = {
            forgePositions: this.game.players.map(p => {
                if (!p.stellarForge) {
                    console.warn('[Replay] Player missing stellarForge during recording');
                    return new Vector2D(0, 0); // Fallback for safety
                }
                return p.stellarForge.position;
            }),
            mirrorPositions: this.game.players.map(p => p.solarMirrors.map(m => m.position)),
            suns: this.game.suns.map(s => s.position)
        };

        // Create and start recorder
        this.replayRecorder = new ReplayRecorder(
            this.currentGameSeed,
            players,
            settings.gameMode || 'singleplayer',
            mapInfo,
            settings.selectedMap?.name || 'Unknown Map'
        );
        this.replayRecorder.start();
        console.log('[Replay] Recording started');
    }

    private stopReplayRecording(): void {
        if (!this.replayRecorder || !this.replayRecorder.isActive()) {
            return;
        }

        const replayData = this.replayRecorder.stop();
        console.log(`[Replay] Recording stopped. ${replayData.commands.length} commands recorded.`);

        // Determine match result
        const winner = this.game?.checkVictoryConditions();
        if (winner && this.game) {
            // Find winner and loser
            const localPlayer = this.game.players[this.localPlayerIndex];
            const isVictory = winner === localPlayer;
            
            // Get opponent (assumes 1v1)
            const opponent = this.game.players.find(p => p !== localPlayer);
            
            if (opponent) {
                // Get MMR data
                const mmrData = getPlayerMMRData();
                // For opponent MMR: use 1000 as default for AI opponents
                // In multiplayer, the opponent's MMR would need to be passed from the network system
                const opponentMMR = 1000; // Default starting MMR for AI opponents
                
                // Calculate MMR change
                const { mmrChange } = updatePlayerMMR(opponentMMR, isVictory);
                
                // Add match result to replay metadata
                replayData.metadata.matchResult = {
                    winnerId: winner.name,
                    winnerName: winner.name,
                    loserId: opponent.name,
                    loserName: opponent.name,
                    wasForfeit: false
                };
                
                // Update player info with MMR
                const localPlayerInfo = replayData.metadata.players.find(p => p.isLocal);
                if (localPlayerInfo) {
                    localPlayerInfo.mmr = mmrData.mmr - mmrChange; // MMR before match
                    localPlayerInfo.mmrChange = mmrChange;
                }
                
                // Get map name from settings
                const mapName = replayData.metadata.mapName || 'Unknown Map';
                
                // Auto-save to local storage
                const timestamp = new Date(replayData.metadata.timestamp).toISOString().replace(/[:.]/g, '-');
                const replayName = `match_${timestamp}`;
                
                try {
                    saveReplayToStorage(replayData, replayName);
                    console.log(`[Replay] Saved to storage as "${replayName}"`);
                } catch (error) {
                    console.error('[Replay] Failed to save to storage:', error);
                }

                // Save to match history
                try {
                    const matchEntry: MatchHistoryEntry = {
                        id: `${replayData.metadata.timestamp}`,
                        timestamp: replayData.metadata.timestamp,
                        replayKey: replayName,
                        localPlayerName: localPlayer.name,
                        localPlayerFaction: localPlayer.faction,
                        opponentName: opponent.name,
                        opponentFaction: opponent.faction,
                        mapName: mapName,
                        gameMode: replayData.metadata.gameMode,
                        isVictory: isVictory,
                        duration: replayData.metadata.duration,
                        localPlayerMMR: mmrData.mmr - mmrChange,
                        opponentMMR: opponentMMR,
                        mmrChange: mmrChange
                    };
                    
                    saveMatchToHistory(matchEntry);
                    console.log('[Match History] Match saved to history');
                } catch (error) {
                    console.error('[Match History] Failed to save match:', error);
                }

                // Also offer download
                try {
                    downloadReplay(replayData, `sol_replay_${replayName}.json`);
                    console.log('[Replay] Download initiated');
                } catch (error) {
                    console.error('[Replay] Failed to download replay:', error);
                }
            }
        } else {
            // No winner determined, save replay without match history
            const timestamp = new Date(replayData.metadata.timestamp).toISOString().replace(/[:.]/g, '-');
            const replayName = `match_${timestamp}`;
            
            try {
                saveReplayToStorage(replayData, replayName);
                console.log(`[Replay] Saved to storage as "${replayName}"`);
            } catch (error) {
                console.error('[Replay] Failed to save to storage:', error);
            }

            try {
                downloadReplay(replayData, `sol_replay_${replayName}.json`);
                console.log('[Replay] Download initiated');
            } catch (error) {
                console.error('[Replay] Failed to download replay:', error);
            }
        }

        this.replayRecorder = null;
    }

    private startReplayViewing(replayData: ReplayData): void {
        console.log('[Replay] Starting replay viewer...');
        
        // Initialize replay player
        this.replayPlayer = new ReplayPlayer(replayData);
        this.game = this.replayPlayer.initializeGame();
        this.isWatchingReplay = true;
        this.isPaused = false;
        
        // Start playback
        this.replayPlayer.play();
        
        // Start game loop
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame((time) => this.gameLoop(time));
        }
        
        console.log('[Replay] Replay viewing started');
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
        this.gameAudioController = new GameAudioController();
        this.menu.onStart((settings: GameSettings) => this.startNewGame(settings));
        this.showInfo = this.menu.getSettings().isBattleStatsInfoEnabled;
        this.renderer.showInfo = this.showInfo;

        // Set up input handlers
        this.warpGateManager = new WarpGateManager(this.getWarpGateManagerContext());
        this.selectionManager = new SelectionManager(this.getSelectionManagerContext());
        this.inputController = new InputController(canvas, this.getInputControllerContext());

        // Listen for replay launch events from menu
        window.addEventListener('launchReplay', ((event: CustomEvent) => {
            this.startReplayViewing(event.detail.replay);
        }) as EventListener);
        
        // Listen for 4-player game start events from custom lobby
        window.addEventListener('start4PlayerGame', ((event: CustomEvent) => {
            this.start4PlayerGame(event.detail.playerConfigs, event.detail.settings, event.detail.roomId);
        }) as EventListener);
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
        // Initialize RNG for single-player games
        // For multiplayer modes (lan, p2p, online), RNG is initialized by the network manager
        const isSinglePlayer = settings.gameMode !== 'lan' && settings.gameMode !== 'p2p' && settings.gameMode !== 'online';
        if (isSinglePlayer) {
            const matchSeed = generateMatchSeed();
            this.currentGameSeed = matchSeed;
            setGameRNG(new SeededRandom(matchSeed));
            console.log(`[GameController] Initialized RNG with seed: ${matchSeed}`);
        }
        
        // Create game based on selected map
        this.game = this.createGameFromSettings(settings);
        this.renderer.selectedHeroNames = settings.selectedHeroNames;
        
        // Initialize replay recorder
        this.initializeReplayRecorder(settings);
        
        // Set player and enemy colors from settings
        this.renderer.playerColor = settings.playerColor;
        this.renderer.enemyColor = settings.enemyColor;
        this.renderer.allyColor = settings.allyColor;
        this.renderer.enemy2Color = settings.enemy2Color;
        
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

        this.gameAudioController.setSoundEnabled(settings.soundEnabled);
        this.gameAudioController.setSoundVolume(settings.soundVolume / 100);
        this.renderer.soundVolume = settings.soundVolume / 100;
        this.renderer.musicVolume = settings.musicVolume / 100;

        // Start game loop
        this.start();
    }

    /**
     * Start a 4-player game from custom lobby configuration
     * @param playerConfigs Array of player configurations [name, faction, teamId, slotType, difficulty, isLocal]
     * @param settings Game settings from the menu
     * @param roomId Database room ID (currently unused, reserved for future network sync)
     */
    private start4PlayerGame(
        playerConfigs: Array<[string, Faction, number, 'player' | 'ai', 'easy' | 'normal' | 'hard', boolean]>,
        settings: GameSettings,
        roomId: string | null
    ): void {
        console.log('[GameController] Starting 4-player game from lobby...');
        
        // Initialize RNG for the game
        const matchSeed = generateMatchSeed();
        this.currentGameSeed = matchSeed;
        setGameRNG(new SeededRandom(matchSeed));
        console.log(`[GameController] Initialized RNG with seed: ${matchSeed}`);
        
        // Create player names and factions for createStandardGame
        const playerNames: Array<[string, Faction]> = playerConfigs.map(([name, faction]) => [name, faction]);
        
        // Create the game with 4 players
        const colorScheme = COLOR_SCHEMES[settings.colorScheme];
        this.game = createStandardGame(playerNames, colorScheme?.spaceDustPalette);
        
        // Set map configuration
        const map = settings.selectedMap;
        this.game.mapSize = map.mapSize;
        
        // Clear existing suns and add based on map
        this.game.suns = [];
        if (map.id === '2v2-dual-umbra') {
            this.game.suns.push(new Sun(new Vector2D(-260, 0), 1.0, 100.0));
            this.game.suns.push(new Sun(new Vector2D(260, 0), 1.0, 100.0));
        } else if (map.id === 'twin-suns') {
            this.game.suns.push(new Sun(new Vector2D(-300, -300), 1.0, 100.0));
            this.game.suns.push(new Sun(new Vector2D(300, 300), 1.0, 100.0));
        } else if (map.id === 'binary-center') {
            // Two suns orbiting each other at map center
            // Orbit center at (0, 0), orbit radius 150, very slow orbit speed
            const orbitCenter = new Vector2D(0, 0);
            const orbitRadius = 150;
            const orbitSpeed = 0.05; // Radians per second (very slow)
            this.game.suns.push(new Sun(
                new Vector2D(0, 0), 1.0, 100.0, 'normal',
                orbitCenter, orbitRadius, orbitSpeed, 0 // Start at angle 0
            ));
            this.game.suns.push(new Sun(
                new Vector2D(0, 0), 1.0, 100.0, 'normal',
                orbitCenter, orbitRadius, orbitSpeed, Math.PI // Start at angle π (opposite side)
            ));
        } else if (map.id === 'binary-ring') {
            // Two suns orbiting on the outside of the map
            // Orbit center at (0, 0), large orbit radius, slow orbit speed
            const orbitCenter = new Vector2D(0, 0);
            const orbitRadius = 1400; // Outside the asteroid field
            const orbitSpeed = 0.08; // Radians per second
            this.game.suns.push(new Sun(
                new Vector2D(0, 0), 1.0, 100.0, 'normal',
                orbitCenter, orbitRadius, orbitSpeed, 0 // Start at angle 0
            ));
            this.game.suns.push(new Sun(
                new Vector2D(0, 0), 1.0, 100.0, 'normal',
                orbitCenter, orbitRadius, orbitSpeed, Math.PI // Start at angle π (opposite side)
            ));
        } else if (map.id === 'lad') {
            this.game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0, 'lad'));
        } else {
            this.game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        }

        if (map.id === '2v2-umbra' || map.id === '2v2-dual-umbra') {
            const teamSpawns = {
                0: [new Vector2D(-880, -520), new Vector2D(-880, 520)],
                1: [new Vector2D(880, -520), new Vector2D(880, 520)]
            };
            const teamSlotIndex = { 0: 0, 1: 0 };

            for (let i = 0; i < playerConfigs.length && i < this.game.players.length; i++) {
                const [, , teamId] = playerConfigs[i];
                const player = this.game.players[i];
                const slotIndex = teamSlotIndex[teamId as 0 | 1] || 0;
                const spawn = teamSpawns[teamId as 0 | 1][slotIndex] || teamSpawns[teamId as 0 | 1][0];
                teamSlotIndex[teamId as 0 | 1] = slotIndex + 1;

                if (player.stellarForge) {
                    player.stellarForge.position = spawn;
                }

                const mirrorDistance = Constants.MIRROR_COUNTDOWN_DEPLOY_DISTANCE;
                if (player.solarMirrors.length >= 2) {
                    player.solarMirrors[0].position = new Vector2D(spawn.x, spawn.y - mirrorDistance);
                    player.solarMirrors[1].position = new Vector2D(spawn.x, spawn.y + mirrorDistance);
                }
            }

            // Fixed large asteroid layout for consistent spawn shadows
            this.game.asteroids = [];
            const largeSize = Constants.STRATEGIC_ASTEROID_SIZE * 1.15;
            if (map.id === '2v2-umbra') {
                const asteroidPositions = [
                    new Vector2D(-320, -220),
                    new Vector2D(-320, 220),
                    new Vector2D(320, -220),
                    new Vector2D(320, 220)
                ];
                for (const pos of asteroidPositions) {
                    this.game.asteroids.push(new Asteroid(pos, 7, largeSize));
                }
            } else {
                const asteroidPositions = [
                    new Vector2D(-520, -260),
                    new Vector2D(-520, 260),
                    new Vector2D(520, -260),
                    new Vector2D(520, 260),
                    new Vector2D(0, -220),
                    new Vector2D(0, 220)
                ];
                for (const pos of asteroidPositions) {
                    this.game.asteroids.push(new Asteroid(pos, 7, largeSize));
                }
            }
        }
        
        // Configure players based on lobby settings and find local player index
        let localPlayerIndex = 0;
        for (let i = 0; i < playerConfigs.length && i < this.game.players.length; i++) {
            const [name, faction, teamId, slotType, aiDifficulty, isLocal] = playerConfigs[i];
            const player = this.game.players[i];
            
            // Track local player index
            if (isLocal) {
                localPlayerIndex = i;
            }
            
            // Set team ID
            player.teamId = teamId;
            
            // Set AI configuration
            player.isAi = slotType === 'ai';
            
            if (player.isAi) {
                // Map difficulty to AI strategy
                if (aiDifficulty === 'easy') {
                    player.aiStrategy = Constants.AIStrategy.ECONOMIC;
                } else if (aiDifficulty === 'hard') {
                    player.aiStrategy = Constants.AIStrategy.AGGRESSIVE;
                } else {
                    player.aiStrategy = Constants.AIStrategy.DEFENSIVE;
                }
            }
        }
        
        // Initialize replay recorder
        this.initializeReplayRecorder(settings);
        
        // Set renderer configuration
        this.renderer.selectedHeroNames = settings.selectedHeroNames;
        this.renderer.playerColor = settings.playerColor;
        this.renderer.enemyColor = settings.enemyColor;
        this.renderer.allyColor = settings.allyColor;
        this.renderer.enemy2Color = settings.enemy2Color;
        
        const colorSchemeObj = COLOR_SCHEMES[settings.colorScheme];
        if (colorSchemeObj) {
            this.renderer.colorScheme = colorSchemeObj;
        }
        
        this.renderer.damageDisplayMode = settings.damageDisplayMode;
        this.renderer.healthDisplayMode = settings.healthDisplayMode;
        this.game.damageDisplayMode = settings.damageDisplayMode;
        this.renderer.screenShakeEnabled = settings.screenShakeEnabled;
        this.renderer.graphicsQuality = settings.graphicsQuality;
        
        // Set local player using the found index
        this.localPlayerIndex = localPlayerIndex;
        const localPlayer = this.game.players[localPlayerIndex];
        
        if (localPlayer) {
            this.renderer.viewingPlayer = localPlayer;
            
            // Center camera on player's base
            if (localPlayer.stellarForge) {
                this.renderer.setCameraPosition(localPlayer.stellarForge.position);
                this.renderer.setZoom(0.5);
            }
        }
        
        this.showInfo = settings.isBattleStatsInfoEnabled;
        this.renderer.showInfo = this.showInfo;
        
        console.log(`[GameController] 4-player game initialized. Local player is index ${localPlayerIndex}. Starting game loop...`);
        
        this.gameAudioController.setSoundEnabled(settings.soundEnabled);
        this.gameAudioController.setSoundVolume(settings.soundVolume / 100);
        this.renderer.soundVolume = settings.soundVolume / 100;
        this.renderer.musicVolume = settings.musicVolume / 100;

        // Start game loop
        this.start();
    }

    private createGameFromSettings(settings: GameSettings): GameState {
        return createGameFromSettings(settings);
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

        this.inputController.updateStarlingMergeHold();
        this.inputController.updateMirrorWarpGateHold();

        if (this.warpGateManager.mirrorCommandMode === 'warpgate' && !this.warpGateManager.canCreateWarpGateFromSelectedMirrors()) {
            this.warpGateManager.mirrorCommandMode = null;
        }
        
        // Check if game has ended
        const winner = this.game.checkVictoryConditions();
        if (winner && this.game.isRunning) {
            this.game.isRunning = false;
            // Stop replay recording when game ends
            if (this.replayRecorder && this.replayRecorder.isActive()) {
                this.stopReplayRecording();
            }
        }
        
        if (this.game.isRunning) {
            this.game.update(deltaTime);
            const dpr = window.devicePixelRatio || 1;
            this.gameAudioController.update(this.game, deltaTime, {
                cameraWorld: this.renderer.camera,
                zoom: this.renderer.zoom,
                viewportWidthPx: this.renderer.canvas.width / dpr,
                viewportHeightPx: this.renderer.canvas.height / dpr
            });
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
                if (this.warpGateManager.selectedWarpGate === gate) {
                    this.warpGateManager.clearWarpGateSelection();
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

        this.inputController.updateStarlingMergeHold();
        this.inputController.updateMirrorWarpGateHold();

        if (this.warpGateManager.mirrorCommandMode === 'warpgate' && !this.warpGateManager.canCreateWarpGateFromSelectedMirrors()) {
            this.warpGateManager.mirrorCommandMode = null;
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
                    const tickDeltaTimeSec = this.TICK_INTERVAL_MS / 1000;
                    this.game.update(tickDeltaTimeSec);
                    const dpr = window.devicePixelRatio || 1;
                    this.gameAudioController.update(this.game, tickDeltaTimeSec, {
                        cameraWorld: this.renderer.camera,
                        zoom: this.renderer.zoom,
                        viewportWidthPx: this.renderer.canvas.width / dpr,
                        viewportHeightPx: this.renderer.canvas.height / dpr
                    });
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
                if (this.warpGateManager.selectedWarpGate === gate) {
                    this.warpGateManager.clearWarpGateSelection();
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
            const isSelectedMirrorInSunlight = this.isSelectedMirrorInSunlight();
            const canCreateWarpGate = this.selectionManager.selectedMirrors.size > 0
                && isSelectedMirrorInSunlight
                && this.warpGateManager.canCreateWarpGateFromSelectedMirrors();
            this.renderer.isSelectedMirrorInSunlight = isSelectedMirrorInSunlight;
            this.renderer.canCreateWarpGateFromMirrors = canCreateWarpGate;
            this.renderer.isWarpGatePlacementMode = this.warpGateManager.mirrorCommandMode === 'warpgate'
                && canCreateWarpGate;
            
            // Update warp gate placement preview if in placement mode
            if (this.renderer.isWarpGatePlacementMode) {
                const player = this.getLocalPlayer();
                if (player) {
                    // Get the current mouse position in world coordinates
                    // Note: lastMouseX and lastMouseY are defined in the setupInput method's closure
                    // We need to convert screen to world coordinates
                    const worldPos = this.renderer.screenToWorld(
                        (window as any).__lastMouseX || 0,
                        (window as any).__lastMouseY || 0
                    );
                    this.renderer.warpGatePreviewWorldPos = worldPos;
                    
                    // Check if the position is valid (within influence field and has line of sight)
                    const withinInfluence = this.game.isPointWithinPlayerInfluence(player, worldPos);
                    const hasLineOfSight = this.warpGateManager.canCreateWarpGateFromSelectedMirrors(worldPos);
                    this.renderer.isWarpGatePreviewValid = withinInfluence && hasLineOfSight;
                }
            } else {
                this.renderer.warpGatePreviewWorldPos = null;
                this.renderer.isWarpGatePreviewValid = false;
            }
            
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

const bootstrapGameController = (): void => {
    if ((window as any).gameController) {
        return;
    }
    const controller = new GameController();
    // Expose for dev/testing purposes
    (window as any).gameController = controller;
};

// Start game when DOM is loaded. If this bundle executes after DOMContentLoaded
// (for example from an async script injection), initialize immediately.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapGameController, { once: true });
} else {
    bootstrapGameController();
}
