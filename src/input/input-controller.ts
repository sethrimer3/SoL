import {
    GameState,
    Vector2D,
    WarpGate,
    Unit,
    Minigun,
    GatlingTower,
    SpaceDustSwirler,
    SubsidiaryFactory,
    StrikerTower,
    LockOnLaserTower,
    ShieldTower,
    LightRay,
    Starling,
    StellarForge,
    SolarMirror,
    Player,
    Building,
} from '../game-core';
import { SelectionManager } from './selection-manager';
import { WarpGateManager } from './warp-gate-manager';
import { GameRenderer } from '../renderer';
import * as Constants from '../constants';

export interface InputControllerContext {
    renderer: GameRenderer;
    getGame: () => GameState | null;
    getLocalPlayer: () => Player | null;
    getSelectionManager: () => SelectionManager;
    getWarpGateManager: () => WarpGateManager;
    sendNetworkCommand: (command: string, data: Record<string, unknown>) => void;
    getShowInGameMenu: () => boolean;
    setShowInGameMenu: (val: boolean) => void;
    getIsPaused: () => boolean;
    setIsPaused: (val: boolean) => void;
    getShowInfo: () => boolean;
    setShowInfo: (val: boolean) => void;
    getHasSeenFoundry: () => boolean;
    getHasActiveFoundry: () => boolean;
    getShouldSkipMoveOrderThisTap: () => boolean;
    setShouldSkipMoveOrderThisTap: (val: boolean) => void;
    scatterParticles: (pos: Vector2D) => void;
    implodeParticles: (pos: Vector2D) => void;
    toggleInGameMenu: () => void;
    toggleInfo: () => void;
    surrender: () => void;
    returnToMainMenu: () => void;
    setSoundVolume: (vol: number) => void;
    setSettingsSoundVolume: (volumePercent: number) => void;
    setSettingsMusicVolume: (volumePercent: number) => void;
    // Delegate methods
    getHeroUnitType: (heroName: string) => string | null;
    getHeroUnitCost: (player: Player) => number;
    isHeroUnitAlive: (player: Player, heroUnitType: string) => boolean;
    isHeroUnitQueuedOrProducing: (forge: StellarForge, heroUnitType: string) => boolean;
    getTargetableStructureAtPosition: (worldPos: Vector2D, player: Player) => any;
    getFriendlySacrificeTargetAtPosition: (worldPos: Vector2D, player: Player) => any;
    getClosestSelectedMirror: (player: Player, worldPos: Vector2D) => { mirror: SolarMirror | null; mirrorIndex: number };
    getTargetStructureRadiusPx: (target: any) => number;
    handleFoundryButtonPress: (player: Player, foundry: SubsidiaryFactory, buttonIndex: number) => void;
    hasSelectedStarlingsOnly: () => boolean;
    getForgeButtonLabels: () => string[];
    trySpawnSolarMirrorFromForge: (player: Player) => boolean;
    getClickedHeroButton: (screenX: number, screenY: number, forge: StellarForge, heroNames: string[]) => { heroName: string; buttonPos: Vector2D } | null;
    getClickedFoundryButtonIndex: (screenX: number, screenY: number, foundry: SubsidiaryFactory) => number;
    getNearestButtonIndexFromAngle: (dragAngleRad: number, buttonCount: number) => number;
    getNearestMirrorButtonIndexFromAngle: (dragAngleRad: number, shouldShowFoundryButton: boolean, isSelectedMirrorInSunlight: boolean) => number;
    isSelectedMirrorInSunlight: () => boolean;
    moveSelectedMirrorsToNearestSunlight: (player: Player) => void;
    getBuildingAbilityAnchorScreen: () => Vector2D | null;
    cancelMirrorWarpGateModeAndDeselectMirrors: () => void;
    clearPathPreview: () => void;
}

export class InputController {
    public holdStartTime: number | null = null;
    public holdStarlingForMerge: Starling | null = null;
    public isSelecting: boolean = false;
    public selectionStartScreen: Vector2D | null = null;
    public isDraggingHeroArrow: boolean = false;
    public isDraggingBuildingArrow: boolean = false;
    public isDrawingPath: boolean = false;
    public pathPoints: Vector2D[] = [];
    public moveOrderCounter: number = 0;
    public lastTapTime: number = 0;
    public lastTapPosition: Vector2D | null = null;
    public readonly DOUBLE_TAP_THRESHOLD_MS = 300;
    public readonly DOUBLE_TAP_POSITION_THRESHOLD = 30;
    public abilityArrowStarts: Vector2D[] = [];

    private ctx: InputControllerContext;

    constructor(canvas: HTMLCanvasElement, context: InputControllerContext) {
        this.ctx = context;
        this.setupInputHandlers(canvas);
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

            if (this.ctx.getShowInGameMenu()) {
                const menuPos = getCanvasPosition(e.clientX, e.clientY);
                const didScrollMenu = this.ctx.renderer.handleInGameMenuScroll(menuPos.x, menuPos.y, e.deltaY);
                if (didScrollMenu) {
                    return;
                }
            }

            const screenPos = getCanvasPosition(e.clientX, e.clientY);
            
            // Get world position under mouse before zoom
            const worldPosBeforeZoom = this.ctx.renderer.screenToWorld(screenPos.x, screenPos.y);
            
            // Apply zoom
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            const oldZoom = this.ctx.renderer.zoom;
            this.ctx.renderer.setZoom(oldZoom * zoomDelta);
            
            // Get world position under mouse after zoom
            const worldPosAfterZoom = this.ctx.renderer.screenToWorld(screenPos.x, screenPos.y);
            
            // Adjust camera to keep world position under cursor the same
            const currentCamera = this.ctx.renderer.camera;
            this.ctx.renderer.setCameraPositionWithoutParallax(new Vector2D(
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
            const worldPos = this.ctx.renderer.screenToWorld(x, y);
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
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                }
                
                // Update camera position (inverted for natural panning)
                const currentCamera = this.ctx.renderer.camera;
                this.ctx.renderer.setCameraPosition(new Vector2D(
                    currentCamera.x - dx / this.ctx.renderer.zoom,
                    currentCamera.y - dy / this.ctx.renderer.zoom
                ));
            } else if (totalMovement > Constants.CLICK_DRAG_THRESHOLD) {
                // Single-finger/mouse drag needs a threshold to distinguish from taps
                // Check if only hero units are selected - if so, show arrow instead of selection box
                const hasHeroUnits = this.ctx.getSelectionManager().hasHeroUnitsSelected();
                const dragStartWorld = this.selectionStartScreen
                    ? this.ctx.renderer.screenToWorld(this.selectionStartScreen.x, this.selectionStartScreen.y)
                    : null;
                
                if (!this.isSelecting && !isPanning && !this.isDraggingHeroArrow && !this.isDraggingBuildingArrow && !this.isDrawingPath) {
                    const isDragStartOnSelectedBase = Boolean(
                        this.ctx.getSelectionManager().selectedBase &&
                        this.ctx.getSelectionManager().selectedBase.isSelected &&
                        dragStartWorld &&
                        this.ctx.getSelectionManager().selectedBase.containsPoint(dragStartWorld)
                    );
                    const isDragStartOnSelectedMirror = Boolean(
                        dragStartWorld && this.ctx.getSelectionManager().isDragStartNearSelectedMirrors(dragStartWorld)
                    );
                    const isDragStartOnSelectedWarpGate = Boolean(
                        this.ctx.getWarpGateManager().selectedWarpGate &&
                        dragStartWorld &&
                        dragStartWorld.distanceTo(this.ctx.getWarpGateManager().selectedWarpGate!.position) <= Constants.WARP_GATE_RADIUS
                    );

                    if (isDragStartOnSelectedBase) {
                        // Drawing a path from the selected base
                        this.isDrawingPath = true;
                        this.pathPoints = [];
                        this.ctx.renderer.pathPreviewForge = this.ctx.getSelectionManager().selectedBase;
                        this.ctx.renderer.pathPreviewStartWorld = new Vector2D(this.ctx.getSelectionManager().selectedBase.position.x, this.ctx.getSelectionManager().selectedBase.position.y);
                        this.ctx.renderer.pathPreviewPoints = this.pathPoints;
                        this.ctx.getSelectionManager().selectedBase.isSelected = false;
                        this.cancelHold();
                    } else if (isDragStartOnSelectedMirror) {
                        // Drawing a path from selected solar mirrors
                        this.isDrawingPath = true;
                        this.pathPoints = [];
                        this.ctx.renderer.pathPreviewForge = null;
                        const firstMirror = Array.from(this.ctx.getSelectionManager().selectedMirrors)[0];
                        this.ctx.renderer.pathPreviewStartWorld = firstMirror ? new Vector2D(firstMirror.position.x, firstMirror.position.y) : null;
                        this.ctx.renderer.pathPreviewPoints = this.pathPoints;
                        this.cancelHold();
                    } else if (isDragStartOnSelectedWarpGate) {
                        this.isDraggingBuildingArrow = true;
                        this.cancelHold();
                    } else if (this.ctx.getSelectionManager().selectedBuildings.size === 1) {
                        // Check if a foundry is selected
                        const selectedBuilding = Array.from(this.ctx.getSelectionManager().selectedBuildings)[0];
                        if (selectedBuilding instanceof SubsidiaryFactory && selectedBuilding.isComplete) {
                            // Foundry is selected - use building arrow mode
                            this.isDraggingBuildingArrow = true;
                            this.cancelHold();
                        }
                    } else if ((this.ctx.getSelectionManager().selectedBase || this.ctx.getSelectionManager().selectedMirrors.size > 0 || this.ctx.getWarpGateManager().selectedWarpGate) && this.ctx.getSelectionManager().selectedUnits.size === 0) {
                        // Stellar forge or mirror selected - use building arrow mode even when dragging from empty space
                        this.isDraggingBuildingArrow = true;
                        this.cancelHold();
                    } else if (this.ctx.getSelectionManager().selectedUnits.size > 0 && this.selectionStartScreen) {
                        // Check if drag started near selected units - if so, draw movement path
                        if (dragStartWorld && this.ctx.getSelectionManager().isDragStartNearSelectedUnits(dragStartWorld)) {
                            // Drawing a movement path for selected units
                            this.isDrawingPath = true;
                            this.pathPoints = [];
                            this.ctx.renderer.pathPreviewForge = null; // No forge for unit paths
                            this.ctx.renderer.pathPreviewStartWorld = dragStartWorld ? new Vector2D(dragStartWorld.x, dragStartWorld.y) : null;
                            this.ctx.renderer.pathPreviewPoints = this.pathPoints;
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
                this.ctx.renderer.selectionStart = this.selectionStartScreen;
                this.ctx.renderer.selectionEnd = new Vector2D(x, y);
            } else if (this.isDraggingHeroArrow) {
                // Update arrow direction (for hero ability casting)
                this.updateAbilityArrowStarts();
                if (this.selectionStartScreen) {
                    const dragDeltaX = x - this.selectionStartScreen.x;
                    const dragDeltaY = y - this.selectionStartScreen.y;
                    const dragLengthPx = Math.sqrt(dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY);
                    if (dragLengthPx > 0) {
                        this.ctx.renderer.abilityArrowDirection = new Vector2D(
                            dragDeltaX / dragLengthPx,
                            dragDeltaY / dragLengthPx
                        );
                    } else {
                        this.ctx.renderer.abilityArrowDirection = null;
                    }
                    this.ctx.renderer.abilityArrowLengthPx = dragLengthPx;
                } else {
                    this.ctx.renderer.abilityArrowDirection = null;
                    this.ctx.renderer.abilityArrowLengthPx = 0;
                }
            } else if (this.isDraggingBuildingArrow) {
                // Update arrow direction for building abilities
                const player = this.ctx.getLocalPlayer();
                const buildingAbilityAnchor = this.ctx.getBuildingAbilityAnchorScreen();
                const buildingAbilityStart = buildingAbilityAnchor ?? this.selectionStartScreen;
                if (buildingAbilityStart) {
                    this.ctx.renderer.buildingAbilityArrowStart = buildingAbilityStart;
                    if (this.selectionStartScreen) {
                        const dragDeltaX = x - this.selectionStartScreen.x;
                        const dragDeltaY = y - this.selectionStartScreen.y;
                        const dragLengthPx = Math.sqrt(dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY);
                        if (dragLengthPx > 0) {
                            this.ctx.renderer.setBuildingAbilityArrowDirection(new Vector2D(
                                dragDeltaX / dragLengthPx,
                                dragDeltaY / dragLengthPx
                            ));
                        } else {
                            this.ctx.renderer.setBuildingAbilityArrowDirection(null);
                        }
                        this.ctx.renderer.buildingAbilityArrowLengthPx = dragLengthPx;
                    } else {
                        this.ctx.renderer.setBuildingAbilityArrowDirection(null);
                        this.ctx.renderer.buildingAbilityArrowLengthPx = 0;
                    }
                    
                    // Calculate angle and determine which button is highlighted
                    const dragDirection = this.ctx.renderer.buildingAbilityArrowDirection;
                    const angle = dragDirection ? Math.atan2(dragDirection.y, dragDirection.x) : 0;
                    
                    // Determine number of buttons based on what's selected
                    if (player && player.stellarForge && player.stellarForge.isSelected) {
                        const forgeButtonCount = this.ctx.getForgeButtonLabels().length;
                        this.ctx.renderer.highlightedButtonIndex = dragDirection
                            ? this.ctx.getNearestButtonIndexFromAngle(angle, forgeButtonCount)
                            : -1;
                    } else if (this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                        // Solar mirrors have 2 or 3 buttons
                        this.ctx.renderer.highlightedButtonIndex = dragDirection
                            ? this.ctx.getNearestMirrorButtonIndexFromAngle(angle, this.ctx.getHasSeenFoundry(), this.ctx.isSelectedMirrorInSunlight())
                            : -1;
                        const isMirrorInSunlight = this.ctx.isSelectedMirrorInSunlight();
                        if (isMirrorInSunlight) {
                            if (this.ctx.renderer.highlightedButtonIndex === 1 && !this.ctx.getWarpGateManager().canCreateWarpGateFromSelectedMirrors()) {
                                this.ctx.renderer.highlightedButtonIndex = -1;
                            }
                        }
                        this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = Boolean(
                            dragDirection &&
                            this.ctx.getWarpGateManager().mirrorCommandMode === 'warpgate' &&
                            dragDirection.y > 0.7 &&
                            this.ctx.renderer.buildingAbilityArrowLengthPx >= Math.max(Constants.CLICK_DRAG_THRESHOLD, Constants.ABILITY_ARROW_MIN_LENGTH)
                        );
                    } else if (this.ctx.getWarpGateManager().selectedWarpGate) {
                        if (dragDirection && player) {
                            const nearestIndex = this.ctx.getNearestButtonIndexFromAngle(angle, 4);
                            this.ctx.renderer.highlightedButtonIndex = this.ctx.getWarpGateManager().isWarpGateButtonAvailable(player, nearestIndex)
                                ? nearestIndex
                                : -1;
                        } else {
                            this.ctx.renderer.highlightedButtonIndex = -1;
                        }
                    } else if (this.ctx.getSelectionManager().selectedBuildings.size === 1) {
                        // Foundry building has 4 buttons
                        const selectedBuilding = Array.from(this.ctx.getSelectionManager().selectedBuildings)[0];
                        if (selectedBuilding instanceof SubsidiaryFactory) {
                            this.ctx.renderer.highlightedButtonIndex = dragDirection
                                ? this.ctx.getNearestButtonIndexFromAngle(angle, 4)
                                : -1;
                        }
                    }
                }
            } else if (this.isDrawingPath) {
                // Collect path waypoints as we drag
                const worldPos = this.ctx.renderer.screenToWorld(x, y);
                
                // Add waypoint if we've moved far enough from the last one
                if (this.pathPoints.length === 0 || 
                    this.pathPoints[this.pathPoints.length - 1].distanceTo(worldPos) > Constants.MIN_WAYPOINT_DISTANCE) {
                    
                    // Check if this position is inside a solid object
                    const isInsideSolid = this.ctx.getGame()?.checkCollision(worldPos, 0) || false;
                    
                    if (!isInsideSolid) {
                        // Only add waypoint if not inside solid object
                        this.pathPoints.push(new Vector2D(worldPos.x, worldPos.y));
                    }
                }
                
                // pathPreviewForge was already set when initiating path drawing (selectedBase for base paths, null for unit paths)
                this.ctx.renderer.pathPreviewPoints = this.pathPoints;
                this.ctx.renderer.pathPreviewEnd = new Vector2D(worldPos.x, worldPos.y);
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
            if (wasClick && this.ctx.getGame()) {
                const winner = this.ctx.getGame()!.checkVictoryConditions();
                
                // Check menu button click (top-left, 60x60 area including margin)
                if (!winner && !this.ctx.getGame()!.isCountdownActive && lastX <= 70 && lastY <= 70) {
                    this.ctx.toggleInGameMenu();
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // Check in-game menu clicks
                if (this.ctx.getShowInGameMenu() && !winner) {
                    const menuAction = this.ctx.renderer.getInGameMenuAction(lastX, lastY);
                    if (menuAction) {
                        switch (menuAction.type) {
                            case 'resume':
                                this.ctx.toggleInGameMenu();
                                break;
                            case 'toggleInfo':
                                this.ctx.toggleInfo();
                                break;
                            case 'surrender':
                                this.ctx.surrender();
                                break;
                            case 'tab':
                                this.ctx.renderer.setInGameMenuTab(menuAction.tab);
                                break;
                            case 'toggleRenderLayer':
                                this.ctx.renderer.setRenderLayerEnabled(menuAction.layer, menuAction.isEnabled);
                                break;
                            case 'damageDisplayMode':
                                this.ctx.renderer.damageDisplayMode = menuAction.mode;
                                if (this.ctx.getGame()) {
                                    this.ctx.getGame()!.damageDisplayMode = menuAction.mode;
                                }
                                break;
                            case 'healthDisplayMode':
                                this.ctx.renderer.healthDisplayMode = menuAction.mode;
                                break;
                            case 'fancyGraphics':
                                this.ctx.renderer.isFancyGraphicsEnabled = menuAction.isEnabled;
                                break;
                            case 'graphicsQuality':
                                this.ctx.renderer.graphicsQuality = menuAction.quality;
                                break;
                            case 'colorblindMode':
                                this.ctx.renderer.colorblindMode = menuAction.isEnabled;
                                break;
                            case 'offscreenIndicatorOpacity':
                                this.ctx.renderer.offscreenIndicatorOpacity = menuAction.opacityPercent / 100;
                                break;
                            case 'infoBoxOpacity':
                                this.ctx.renderer.infoBoxOpacity = menuAction.opacityPercent / 100;
                                break;
                            case 'soundVolume':
                                this.ctx.renderer.soundVolume = menuAction.volumePercent / 100;
                                this.ctx.setSoundVolume(this.ctx.renderer.soundVolume);
                                this.ctx.setSettingsSoundVolume(menuAction.volumePercent);
                                break;
                            case 'musicVolume':
                                this.ctx.renderer.musicVolume = menuAction.volumePercent / 100;
                                this.ctx.setSettingsMusicVolume(menuAction.volumePercent);
                                break;
                            default:
                                break;
                        }

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.ctx.renderer.selectionStart = null;
                        this.ctx.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }
                
                // Check end-game Continue button
                if (winner) {
                    const dpr = window.devicePixelRatio || 1;
                    const screenWidth = this.ctx.renderer.canvas.width / dpr;
                    const screenHeight = this.ctx.renderer.canvas.height / dpr;
                    const panelHeight = 450;
                    const panelY = 130;
                    const buttonWidth = 300;
                    const buttonHeight = 60;
                    const buttonX = (screenWidth - buttonWidth) / 2;
                    const buttonY = panelY + panelHeight + 30;
                    
                    if (lastX >= buttonX && lastX <= buttonX + buttonWidth && 
                        lastY >= buttonY && lastY <= buttonY + buttonHeight) {
                        this.ctx.returnToMainMenu();
                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.ctx.renderer.selectionStart = null;
                        this.ctx.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }
            }
            
            // Create tap visual effect for clicks
            if (wasClick && this.selectionStartScreen) {
                this.ctx.renderer.createTapEffect(lastX, lastY);
            }
            
            if (this.ctx.getGame() && wasClick) {
                const worldPos = this.ctx.renderer.screenToWorld(lastX, lastY);
                const player = this.ctx.getLocalPlayer();
                if (!player) {
                    return;
                }

                if (this.ctx.getShouldSkipMoveOrderThisTap()) {
                    this.ctx.setShouldSkipMoveOrderThisTap(false);
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                if (this.ctx.getWarpGateManager().selectedWarpGate) {
                    const buttonIndex = this.ctx.getWarpGateManager().getWarpGateButtonIndexFromClick(this.ctx.getWarpGateManager().selectedWarpGate!, lastX, lastY);
                    if (buttonIndex >= 0) {
                        if (!this.ctx.getWarpGateManager().isWarpGateButtonAvailable(player, buttonIndex)) {
                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.ctx.renderer.selectionStart = null;
                            this.ctx.renderer.selectionEnd = null;
                            this.endHold();
                            return;
                        }
                        const buttonWorldPos = this.ctx.getWarpGateManager().getWarpGateButtonWorldPosition(this.ctx.getWarpGateManager().selectedWarpGate!, buttonIndex);
                        if (buttonWorldPos) {
                            this.ctx.renderer.createProductionButtonWave(buttonWorldPos);
                        }
                        console.log(
                            `Warp gate button clicked: index ${buttonIndex} | energy=${player.energy.toFixed(1)}`
                        );
                        this.ctx.getWarpGateManager().buildFromWarpGate(player, this.ctx.getWarpGateManager().selectedWarpGate!, buttonIndex);

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.ctx.renderer.selectionStart = null;
                        this.ctx.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }

                const clickedWarpGate = this.ctx.getWarpGateManager().getWarpGateAtPosition(worldPos, player);
                if (clickedWarpGate) {
                    if (this.ctx.getWarpGateManager().selectedWarpGate === clickedWarpGate) {
                        this.ctx.getWarpGateManager().clearWarpGateSelection();
                    } else {
                        this.ctx.getSelectionManager().clearAllSelections();
                        this.ctx.getWarpGateManager().selectedWarpGate = clickedWarpGate;
                        this.ctx.renderer.selectedWarpGate = clickedWarpGate;
                    }

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                if (this.ctx.getWarpGateManager().mirrorCommandMode === 'warpgate' && this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                    if (this.ctx.getSelectionManager().isDragStartNearSelectedMirrors(worldPos)) {
                        this.ctx.cancelMirrorWarpGateModeAndDeselectMirrors();
                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.ctx.renderer.selectionStart = null;
                        this.ctx.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }

                    this.ctx.getWarpGateManager().tryCreateWarpGateAt(worldPos);
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                const friendlySacrificeTarget = this.ctx.hasSelectedStarlingsOnly()
                    ? this.ctx.getFriendlySacrificeTargetAtPosition(worldPos, player)
                    : null;
                const targetableStructure = friendlySacrificeTarget ?? this.ctx.getTargetableStructureAtPosition(worldPos, player);
                if (this.ctx.getSelectionManager().selectedUnits.size > 0 && targetableStructure) {
                    this.moveOrderCounter++;
                    const isFriendlySacrificeTarget = targetableStructure.target instanceof SubsidiaryFactory &&
                        targetableStructure.target.owner === player;
                    const targetRadiusPx = this.ctx.getTargetStructureRadiusPx(targetableStructure.target);

                    for (const unit of this.ctx.getSelectionManager().selectedUnits) {
                        const rallyPoint = isFriendlySacrificeTarget && unit instanceof Starling
                            ? targetableStructure.target.position
                            : unit.getStructureStandoffPoint(
                                targetableStructure.target.position,
                                targetRadiusPx
                            );
                        unit.setManualTarget(targetableStructure.target, rallyPoint);
                        unit.moveOrder = this.moveOrderCounter;
                    }

                    const unitIds = this.ctx.getGame()
                        ? Array.from(this.ctx.getSelectionManager().selectedUnits).map((unit) => this.ctx.getGame()!.getUnitNetworkId(unit))
                        : [];
                    this.ctx.sendNetworkCommand('unit_target_structure', {
                        unitIds,
                        targetPlayerIndex: targetableStructure.targetPlayerIndex,
                        structureType: targetableStructure.structureType,
                        structureIndex: targetableStructure.structureIndex,
                        moveOrder: this.moveOrderCounter
                    });

                    this.ctx.getSelectionManager().selectedUnits.clear();
                    this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                    this.ctx.clearPathPreview();
                    console.log('Units targeting structure', targetableStructure.structureType);

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // Check if clicked on stellar forge
                if (player.stellarForge && player.stellarForge.containsPoint(worldPos)) {
                    this.ctx.getWarpGateManager().clearWarpGateSelection();
                    if (this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                        for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                            mirror.setLinkedStructure(player.stellarForge);
                            mirror.isSelected = false;
                        }
                        const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror) =>
                            player.solarMirrors.indexOf(mirror)
                        ).filter((index) => index >= 0);
                        this.ctx.sendNetworkCommand('mirror_link', {
                            mirrorIndices,
                            structureType: 'forge'
                        });
                        this.ctx.getSelectionManager().selectedMirrors.clear();
                    }
                    if (player.stellarForge.isSelected) {
                        // Deselect forge
                        player.stellarForge.isSelected = false;
                        this.ctx.getSelectionManager().selectedBase = null;
                        this.ctx.clearPathPreview();
                        console.log('Stellar Forge deselected');
                    } else {
                        // Select forge, deselect units, mirrors, and buildings
                        player.stellarForge.isSelected = true;
                        this.ctx.getSelectionManager().selectedBase = player.stellarForge;
                        this.ctx.getSelectionManager().selectedUnits.clear();
                        this.ctx.getSelectionManager().selectedMirrors.clear();
                        this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                        // Deselect all mirrors
                        for (const mirror of player.solarMirrors) {
                            mirror.isSelected = false;
                        }
                        // Deselect all buildings
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedBuildings.clear();
                        this.ctx.clearPathPreview();
                        console.log('Stellar Forge selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
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
                    this.ctx.getWarpGateManager().clearWarpGateSelection();
                    if (clickedMirror.isSelected) {
                        // Deselect mirror
                        clickedMirror.isSelected = false;
                        this.ctx.getSelectionManager().selectedMirrors.delete(clickedMirror);
                        this.ctx.clearPathPreview();
                        console.log('Solar Mirror deselected');
                    } else {
                        // Select mirror, deselect forge, units, and buildings
                        clickedMirror.isSelected = true;
                        this.ctx.getSelectionManager().selectedMirrors.clear();
                        this.ctx.getSelectionManager().selectedMirrors.add(clickedMirror);
                        if (player.stellarForge) {
                            player.stellarForge.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedBase = null;
                        this.ctx.getSelectionManager().selectedUnits.clear();
                        this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
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
                        this.ctx.getSelectionManager().selectedBuildings.clear();
                        this.ctx.clearPathPreview();
                        console.log('Solar Mirror selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
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
                    this.ctx.getWarpGateManager().clearWarpGateSelection();
                    const isCompatibleMirrorTarget = clickedBuilding instanceof Minigun ||
                        clickedBuilding instanceof GatlingTower ||
                        clickedBuilding instanceof SpaceDustSwirler ||
                        clickedBuilding instanceof SubsidiaryFactory ||
                        clickedBuilding instanceof StrikerTower ||
                        clickedBuilding instanceof LockOnLaserTower ||
                        clickedBuilding instanceof ShieldTower;
                    if (isCompatibleMirrorTarget && this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                        for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                            mirror.setLinkedStructure(clickedBuilding);
                            mirror.isSelected = false;
                        }
                        const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror) =>
                            player.solarMirrors.indexOf(mirror)
                        ).filter((index) => index >= 0);
                        const buildingIndex = player.buildings.indexOf(clickedBuilding);
                        if (buildingIndex >= 0) {
                            this.ctx.sendNetworkCommand('mirror_link', {
                                mirrorIndices,
                                structureType: 'building',
                                buildingIndex
                            });
                        }
                        this.ctx.getSelectionManager().selectedMirrors.clear();
                    }
                    
                    // Check if this is a double-tap
                    const isDoubleTap = this.isDoubleTap(lastX, lastY);
                    
                    if (isDoubleTap) {
                        // Double-tap: select all buildings of this type
                        this.ctx.getSelectionManager().selectAllBuildingsOfType(clickedBuilding);
                    } else if (clickedBuilding.isSelected) {
                        // If Striker Tower is selected and missile is ready, activate targeting mode
                        if (clickedBuilding instanceof StrikerTower && clickedBuilding.isMissileReady()) {
                            clickedBuilding.isAwaitingTarget = true;
                            console.log('Striker Tower: Select target location');
                        } else {
                            // Deselect building
                            clickedBuilding.isSelected = false;
                            this.ctx.getSelectionManager().selectedBuildings.delete(clickedBuilding);
                            console.log('Building deselected');
                        }
                    } else {
                        // Select building, deselect forge, units, and mirrors
                        clickedBuilding.isSelected = true;
                        this.ctx.getSelectionManager().selectedBuildings.clear();
                        this.ctx.getSelectionManager().selectedBuildings.add(clickedBuilding);
                        if (player.stellarForge) {
                            player.stellarForge.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedBase = null;
                        this.ctx.getSelectionManager().selectedUnits.clear();
                        this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                        // Deselect all mirrors
                        for (const mirror of player.solarMirrors) {
                            mirror.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedMirrors.clear();
                        this.ctx.clearPathPreview();
                        console.log('Building selected');
                    }
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }

                // Check if clicked on mirror command buttons
                if (this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                    const firstMirror = Array.from(this.ctx.getSelectionManager().selectedMirrors)[0] as any;
                    const mirrorScreenPos = this.ctx.renderer.worldToScreen(firstMirror.position);
                    const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.ctx.renderer.zoom;
                    const buttonOffset = 50 * this.ctx.renderer.zoom;
                    const shouldShowFoundryButton = this.ctx.getHasSeenFoundry();
                    const isMirrorInSunlight = this.ctx.isSelectedMirrorInSunlight();
                    const buttonCount = isMirrorInSunlight ? (shouldShowFoundryButton ? 3 : 2) : 1;
                    const positions = this.getRadialButtonOffsets(buttonCount);

                    for (let i = 0; i < positions.length; i++) {
                        const pos = positions[i];
                        const buttonX = mirrorScreenPos.x + pos.x * buttonOffset;
                        const buttonY = mirrorScreenPos.y + pos.y * buttonOffset;
                        const dx = lastX - buttonX;
                        const dy = lastY - buttonY;
                        if (Math.sqrt(dx * dx + dy * dy) > buttonRadius) {
                            continue;
                        }

                        if (!isMirrorInSunlight) {
                            this.ctx.moveSelectedMirrorsToNearestSunlight(player);
                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.ctx.renderer.selectionStart = null;
                            this.ctx.renderer.selectionEnd = null;
                            return;
                        }

                        if (i === 0) {
                            console.log('Mirror command: Link to Forge');
                            if (player.stellarForge) {
                                for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                    mirror.setLinkedStructure(player.stellarForge);
                                }
                                const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror: any) =>
                                    player.solarMirrors.indexOf(mirror)
                                ).filter((index) => index >= 0);
                                this.ctx.sendNetworkCommand('mirror_link', {
                                    mirrorIndices,
                                    structureType: 'forge'
                                });
                            }
                            for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                (mirror as any).isSelected = false;
                            }
                            this.ctx.getSelectionManager().selectedMirrors.clear();
                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.ctx.renderer.selectionStart = null;
                            this.ctx.renderer.selectionEnd = null;
                            return;
                        }

                        if (i === 1) {
                            console.log('Mirror command: Create Warp Gate');
                            if (this.ctx.getWarpGateManager().canCreateWarpGateFromSelectedMirrors()) {
                                this.ctx.getWarpGateManager().mirrorCommandMode = 'warpgate';
                            }
                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.ctx.renderer.selectionStart = null;
                            this.ctx.renderer.selectionEnd = null;
                            return;
                        }

                        if (i === 2 && shouldShowFoundryButton) {
                            if (this.ctx.getHasActiveFoundry()) {
                                const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory);
                                if (foundry) {
                                    for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                        mirror.setLinkedStructure(foundry);
                                    }
                                    const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    const buildingIndex = player.buildings.indexOf(foundry);
                                    if (buildingIndex >= 0) {
                                        this.ctx.sendNetworkCommand('mirror_link', {
                                            mirrorIndices,
                                            structureType: 'building',
                                            buildingIndex
                                        });
                                    }
                                }
                            }
                            for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                (mirror as any).isSelected = false;
                            }
                            this.ctx.getSelectionManager().selectedMirrors.clear();
                            isPanning = false;
                            isMouseDown = false;
                            this.isSelecting = false;
                            this.selectionStartScreen = null;
                            this.ctx.renderer.selectionStart = null;
                            this.ctx.renderer.selectionEnd = null;
                            return;
                        }
                    }
                }

                if (player.stellarForge && player.stellarForge.isSelected) {
                    const clickedHero = this.ctx.getClickedHeroButton(
                        lastX,
                        lastY,
                        player.stellarForge,
                        this.ctx.getForgeButtonLabels()
                    );
                    if (clickedHero) {
                        const clickedHeroName = clickedHero.heroName;
                        this.ctx.renderer.createProductionButtonWave(clickedHero.buttonPos);
                        let didTriggerForgeAction = false;
                        if (clickedHeroName === 'Solar Mirror') {
                            didTriggerForgeAction = this.ctx.trySpawnSolarMirrorFromForge(player);
                        } else {
                            const heroUnitType = this.ctx.getHeroUnitType(clickedHeroName);
                            if (heroUnitType) {
                                console.log(
                                    `Hero button clicked: ${clickedHeroName} | unitType=${heroUnitType} | energy=${player.energy.toFixed(1)}`
                                );
                                const heroCost = this.ctx.getHeroUnitCost(player);
                                player.stellarForge.enqueueHeroUnit(heroUnitType, heroCost);
                                console.log(`Queued hero ${clickedHeroName} for forging`);
                                didTriggerForgeAction = true;
                                this.ctx.sendNetworkCommand('hero_purchase', {
                                    heroType: heroUnitType
                                });
                            }
                        }

                        if (didTriggerForgeAction) {
                            player.stellarForge.isSelected = false;
                            this.ctx.getSelectionManager().selectedBase = null;
                            this.ctx.getSelectionManager().selectedUnits.clear();
                            this.ctx.getSelectionManager().selectedMirrors.clear();
                            this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                            // Deselect all buildings
                            for (const building of player.buildings) {
                                building.isSelected = false;
                            }
                            this.ctx.getSelectionManager().selectedBuildings.clear();
                            this.ctx.clearPathPreview();
                        }

                        isPanning = false;
                        isMouseDown = false;
                        this.isSelecting = false;
                        this.selectionStartScreen = null;
                        this.ctx.renderer.selectionStart = null;
                        this.ctx.renderer.selectionEnd = null;
                        this.endHold();
                        return;
                    }
                }

                if (this.ctx.getSelectionManager().selectedBuildings.size === 1) {
                    const selectedBuilding = Array.from(this.ctx.getSelectionManager().selectedBuildings)[0];
                    if (selectedBuilding instanceof SubsidiaryFactory && selectedBuilding.isComplete) {
                        const clickedFoundryButtonIndex = this.ctx.getClickedFoundryButtonIndex(
                            lastX,
                            lastY,
                            selectedBuilding
                        );
                        if (clickedFoundryButtonIndex >= 0) {
                            this.ctx.handleFoundryButtonPress(player, selectedBuilding, clickedFoundryButtonIndex);
                            return;
                        }
                    }
                }

                if (this.ctx.getSelectionManager().selectedBuildings.size > 0) {
                    for (const building of this.ctx.getSelectionManager().selectedBuildings) {
                        building.isSelected = false;
                    }
                    this.ctx.getSelectionManager().selectedBuildings.clear();
                    this.ctx.clearPathPreview();
                    console.log('Buildings deselected');

                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // If forge is selected and clicked elsewhere, move it
                if (player.stellarForge && player.stellarForge.isSelected) {
                    player.stellarForge.setTarget(worldPos);
                    this.moveOrderCounter++;
                    player.stellarForge.moveOrder = this.moveOrderCounter;
                    this.ctx.sendNetworkCommand('forge_move', {
                        targetX: worldPos.x,
                        targetY: worldPos.y,
                        moveOrder: this.moveOrderCounter
                    });
                    player.stellarForge.isSelected = false; // Auto-deselect after setting target
                    this.ctx.getSelectionManager().selectedBase = null;
                    this.ctx.getSelectionManager().selectedUnits.clear();
                    this.ctx.getSelectionManager().selectedMirrors.clear();
                    this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                    // Deselect all buildings
                    for (const building of player.buildings) {
                        building.isSelected = false;
                    }
                    this.ctx.getSelectionManager().selectedBuildings.clear();
                    console.log(`Stellar Forge moving to (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
                
                // If a mirror is selected and clicked elsewhere, move it
                const { mirror: selectedMirror, mirrorIndex } = this.ctx.getClosestSelectedMirror(player, worldPos);
                if (selectedMirror && this.ctx.getWarpGateManager().mirrorCommandMode !== 'warpgate') {
                    selectedMirror.setTarget(worldPos, this.ctx.getGame());
                    this.moveOrderCounter++;
                    selectedMirror.moveOrder = this.moveOrderCounter;
                    this.ctx.sendNetworkCommand('mirror_move', {
                        mirrorIndices: mirrorIndex >= 0 ? [mirrorIndex] : [],
                        targetX: worldPos.x,
                        targetY: worldPos.y,
                        moveOrder: this.moveOrderCounter
                    });
                    // Only deselect the mirror that received the move order; others stay selected
                    selectedMirror.isSelected = false;
                    this.ctx.getSelectionManager().selectedMirrors.delete(selectedMirror);
                    this.ctx.renderer.selectedMirrors = this.ctx.getSelectionManager().selectedMirrors;
                    console.log(`Solar Mirror moving to (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                    
                    isPanning = false;
                    isMouseDown = false;
                    this.isSelecting = false;
                    this.selectionStartScreen = null;
                    this.ctx.renderer.selectionStart = null;
                    this.ctx.renderer.selectionEnd = null;
                    this.endHold();
                    return;
                }
            }
            
            // If we were selecting, finalize the selection
            if (this.isSelecting && this.selectionStartScreen && this.ctx.getGame()) {
                const endPos = new Vector2D(lastX, lastY);
                this.ctx.getSelectionManager().selectUnitsInRectangle(this.selectionStartScreen, endPos);
            } else if (this.isDrawingPath && this.pathPoints.length > 0 && this.ctx.getGame()) {
                // Finalize the path drawing
                if (this.ctx.getSelectionManager().selectedBase) {
                    // Path for base (minion spawning)
                    this.ctx.getSelectionManager().selectedBase.setMinionPath(this.pathPoints);
                    console.log(`Base path set with ${this.pathPoints.length} waypoints`);
                    this.ctx.sendNetworkCommand('set_rally_path', {
                        waypoints: this.pathPoints.map((point) => ({ x: point.x, y: point.y }))
                    });
                    this.ctx.renderer.createPathCommitEffect(this.ctx.getSelectionManager().selectedBase.position, this.pathPoints, this.ctx.getGame()!.gameTime);
                } else if (this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                    const player = this.ctx.getLocalPlayer();
                    const lastWaypoint = this.pathPoints[this.pathPoints.length - 1];

                    if (player) {
                        console.log(`Solar mirror movement path set to (${lastWaypoint.x.toFixed(0)}, ${lastWaypoint.y.toFixed(0)})`);
                        this.moveOrderCounter++;
                        const mirrorIndices: number[] = [];

                        for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                            mirror.setTarget(lastWaypoint, this.ctx.getGame());
                            mirror.moveOrder = this.moveOrderCounter;
                            mirror.isSelected = false;
                            const mirrorIndex = player.solarMirrors.indexOf(mirror);
                            if (mirrorIndex >= 0) {
                                mirrorIndices.push(mirrorIndex);
                            }
                        }

                        this.ctx.sendNetworkCommand('mirror_move', {
                            mirrorIndices,
                            targetX: lastWaypoint.x,
                            targetY: lastWaypoint.y,
                            moveOrder: this.moveOrderCounter
                        });
                        const startMirror = Array.from(this.ctx.getSelectionManager().selectedMirrors)[0];
                        if (startMirror) {
                            this.ctx.renderer.createPathCommitEffect(startMirror.position, this.pathPoints, this.ctx.getGame()!.gameTime);
                        }
                    }

                    this.ctx.getSelectionManager().selectedMirrors.clear();
                    const localPlayer = this.ctx.getLocalPlayer();
                    if (localPlayer) {
                        for (const building of localPlayer.buildings) {
                            building.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedBuildings.clear();
                    }
                } else if (this.ctx.getSelectionManager().selectedUnits.size > 0) {
                    // Path for selected units
                    console.log(`Unit movement path set with ${this.pathPoints.length} waypoints for ${this.ctx.getSelectionManager().selectedUnits.size} unit(s)`);
                    
                    // Increment move order counter
                    this.moveOrderCounter++;
                    
                    // Set path for all selected units
                    for (const unit of this.ctx.getSelectionManager().selectedUnits) {
                        // All units now support path following
                        unit.clearManualTarget();
                        unit.setPath(this.pathPoints);
                        unit.moveOrder = this.moveOrderCounter;
                    }
                    const unitIds = this.ctx.getGame()
                        ? Array.from(this.ctx.getSelectionManager().selectedUnits).map((unit) => this.ctx.getGame()!.getUnitNetworkId(unit))
                        : [];
                    this.ctx.sendNetworkCommand('unit_path', {
                        unitIds,
                        waypoints: this.pathPoints.map((point) => ({ x: point.x, y: point.y })),
                        moveOrder: this.moveOrderCounter
                    });
                    if (this.ctx.renderer.pathPreviewStartWorld) {
                        this.ctx.renderer.createPathCommitEffect(this.ctx.renderer.pathPreviewStartWorld, this.pathPoints, this.ctx.getGame()!.gameTime);
                    }
                    
                    // Deselect units and buildings after setting path
                    this.ctx.getSelectionManager().selectedUnits.clear();
                    this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                    const player = this.ctx.getLocalPlayer();
                    if (player) {
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.ctx.getSelectionManager().selectedBuildings.clear();
                    }
                }
                this.ctx.clearPathPreview();
            } else if (!this.isSelecting && (this.ctx.getSelectionManager().selectedUnits.size > 0 || this.ctx.getSelectionManager().selectedMirrors.size > 0 || this.ctx.getSelectionManager().selectedBase || this.ctx.getWarpGateManager().selectedWarpGate) && this.selectionStartScreen && this.ctx.getGame()) {
                // If units, mirrors, or base are selected and player dragged/clicked
                const endPos = new Vector2D(lastX, lastY);
                const totalMovement = this.selectionStartScreen.distanceTo(endPos);
                const buildingAbilityMovement = totalMovement;
                
                const abilityDragThreshold = Math.max(Constants.CLICK_DRAG_THRESHOLD, Constants.ABILITY_ARROW_MIN_LENGTH);
                const hasHeroUnits = this.ctx.getSelectionManager().hasHeroUnitsSelected();
                if (this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease) {
                    this.ctx.cancelMirrorWarpGateModeAndDeselectMirrors();
                    this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = false;
                }

                const shouldUseAbility = this.ctx.getSelectionManager().selectedUnits.size > 0 && (
                    (!hasHeroUnits && totalMovement >= Constants.CLICK_DRAG_THRESHOLD) ||
                    (hasHeroUnits && this.isDraggingHeroArrow && totalMovement >= abilityDragThreshold)
                );

                // If dragged significantly, use ability (for units only)
                if (shouldUseAbility) {
                    
                    // Only create swipe effect for non-hero units
                    if (!hasHeroUnits) {
                        this.ctx.renderer.createSwipeEffect(
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
                        const player = this.ctx.getLocalPlayer();
                        if (player && direction.y < -0.5) {
                            const selectedStarlings = this.ctx.getSelectionManager().getSelectedStarlings(player);
                            if (selectedStarlings.length >= Constants.STARLING_MERGE_COUNT) {
                                // Calculate average position of selected starlings as merge target
                                const avgX = selectedStarlings.reduce((sum, s) => sum + s.position.x, 0) / selectedStarlings.length;
                                const avgY = selectedStarlings.reduce((sum, s) => sum + s.position.y, 0) / selectedStarlings.length;
                                const targetPos = new Vector2D(avgX, avgY);
                                didMergeStarlings = this.ctx.getSelectionManager().tryStartStarlingMerge(player, selectedStarlings, targetPos);
                            }
                        }
                    }

                    if (!didMergeStarlings) {
                        // Activate ability for all selected units
                        let anyAbilityUsed = false;
                        for (const unit of this.ctx.getSelectionManager().selectedUnits) {
                            if (unit.useAbility(direction)) {
                                anyAbilityUsed = true;
                                if (this.ctx.getGame()) {
                                    this.ctx.sendNetworkCommand('unit_ability', {
                                        unitId: this.ctx.getGame()!.getUnitNetworkId(unit),
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
                        this.ctx.getSelectionManager().selectedUnits.clear();
                        this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                    }
                } else if (this.isDraggingBuildingArrow && buildingAbilityMovement >= abilityDragThreshold) {
                    // Building ability arrow was dragged - activate the highlighted button
                    const player = this.ctx.getLocalPlayer();
                    if (player && this.ctx.renderer.highlightedButtonIndex >= 0) {
                        if (player.stellarForge && player.stellarForge.isSelected) {
                            const forgeButtonLabels = this.ctx.getForgeButtonLabels();
                            if (this.ctx.renderer.highlightedButtonIndex < forgeButtonLabels.length) {
                                const selectedLabel = forgeButtonLabels[this.ctx.renderer.highlightedButtonIndex];
                                if (selectedLabel === 'Solar Mirror') {
                                    const didCreateMirror = this.ctx.trySpawnSolarMirrorFromForge(player);
                                    if (didCreateMirror) {
                                        player.stellarForge.isSelected = false;
                                        this.ctx.getSelectionManager().selectedBase = null;
                                    }
                                } else {
                                    const heroUnitType = this.ctx.getHeroUnitType(selectedLabel);
                                    if (heroUnitType) {
                                        const heroCost = this.ctx.getHeroUnitCost(player);
                                        player.stellarForge.enqueueHeroUnit(heroUnitType, heroCost);
                                        console.log(`Radial selection: Queued hero ${selectedLabel} for forging`);
                                        this.ctx.sendNetworkCommand('hero_purchase', {
                                            heroType: heroUnitType
                                        });

                                        player.stellarForge.isSelected = false;
                                        this.ctx.getSelectionManager().selectedBase = null;
                                    }
                                }
                            }
                        } else if (this.ctx.getSelectionManager().selectedMirrors.size > 0) {
                            // Solar mirror button selected
                            const isMirrorInSunlight = this.ctx.isSelectedMirrorInSunlight();
                            if (!isMirrorInSunlight && this.ctx.renderer.highlightedButtonIndex === 0) {
                                this.ctx.moveSelectedMirrorsToNearestSunlight(player);
                            } else if (this.ctx.renderer.highlightedButtonIndex === 0) {
                                // Forge button
                                if (player.stellarForge) {
                                    for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                        mirror.setLinkedStructure(player.stellarForge);
                                    }
                                    const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    this.ctx.sendNetworkCommand('mirror_link', {
                                        mirrorIndices,
                                        structureType: 'forge'
                                    });
                                    console.log('Radial selection: Mirrors linked to forge');
                                }
                                for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                    (mirror as any).isSelected = false;
                                }
                                this.ctx.getSelectionManager().selectedMirrors.clear();
                            } else if (isMirrorInSunlight && this.ctx.renderer.highlightedButtonIndex === 1) {
                                // Warp gate button
                                if (this.ctx.getWarpGateManager().mirrorCommandMode === 'warpgate') {
                                    this.ctx.cancelMirrorWarpGateModeAndDeselectMirrors();
                                    console.log('Radial selection: Mirror warp gate mode cancelled');
                                } else if (this.ctx.getWarpGateManager().canCreateWarpGateFromSelectedMirrors()) {
                                    this.ctx.getWarpGateManager().mirrorCommandMode = 'warpgate';
                                    console.log('Radial selection: Mirror command mode set to warpgate');
                                }
                            } else if (isMirrorInSunlight && this.ctx.renderer.highlightedButtonIndex === 2 && this.ctx.getHasActiveFoundry()) {
                                const foundry = player.buildings.find((building) => building instanceof SubsidiaryFactory);
                                if (foundry) {
                                    for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                        mirror.setLinkedStructure(foundry);
                                    }
                                    const mirrorIndices = Array.from(this.ctx.getSelectionManager().selectedMirrors).map((mirror: any) =>
                                        player.solarMirrors.indexOf(mirror)
                                    ).filter((index) => index >= 0);
                                    const buildingIndex = player.buildings.indexOf(foundry);
                                    if (buildingIndex >= 0) {
                                        this.ctx.sendNetworkCommand('mirror_link', {
                                            mirrorIndices,
                                            structureType: 'building',
                                            buildingIndex
                                        });
                                    }
                                    console.log('Radial selection: Mirrors linked to foundry');
                                }
                                for (const mirror of this.ctx.getSelectionManager().selectedMirrors) {
                                    (mirror as any).isSelected = false;
                                }
                                this.ctx.getSelectionManager().selectedMirrors.clear();
                            }
                        } else if (this.ctx.getWarpGateManager().selectedWarpGate) {
                            if (this.ctx.getWarpGateManager().isWarpGateButtonAvailable(player, this.ctx.renderer.highlightedButtonIndex)) {
                                this.ctx.getWarpGateManager().buildFromWarpGate(player, this.ctx.getWarpGateManager().selectedWarpGate!, this.ctx.renderer.highlightedButtonIndex);
                            }
                        } else if (this.ctx.getSelectionManager().selectedBuildings.size === 1) {
                            // Foundry building button selected
                            const selectedBuilding = Array.from(this.ctx.getSelectionManager().selectedBuildings)[0];
                            if (selectedBuilding instanceof SubsidiaryFactory) {
                                this.ctx.handleFoundryButtonPress(player, selectedBuilding, this.ctx.renderer.highlightedButtonIndex);
                            }
                        }
                    }
                } else if (this.isDraggingHeroArrow && hasHeroUnits) {
                    // Cancel ability casting if arrow was dragged back to nothing
                } else if (this.ctx.getShouldSkipMoveOrderThisTap()) {
                    this.ctx.setShouldSkipMoveOrderThisTap(false);
                } else if (this.ctx.getWarpGateManager().selectedWarpGate && this.ctx.getSelectionManager().selectedUnits.size === 0 && this.ctx.getSelectionManager().selectedMirrors.size === 0 && !this.ctx.getSelectionManager().selectedBase) {
                    // Warp gate selected without a drag - no movement action
                } else {
                    // Check if any selected Striker Tower is awaiting target
                    const player = this.ctx.getLocalPlayer();
                    const awaitingStrikerTower = player && this.ctx.getSelectionManager().selectedBuildings.size === 1 ? 
                        Array.from(this.ctx.getSelectionManager().selectedBuildings)[0] : null;
                    
                    if (awaitingStrikerTower instanceof StrikerTower && awaitingStrikerTower.isAwaitingTarget) {
                        // Start countdown for striker tower missile
                        const worldPos = this.ctx.renderer.screenToWorld(lastX, lastY);
                        
                        // Validate target position
                        const isValidTarget = this.ctx.getGame()!.isPointInShadow(worldPos) && 
                            !this.ctx.getGame()!.isPositionVisibleByPlayerUnits(worldPos, player!.units) &&
                            awaitingStrikerTower.position.distanceTo(worldPos) <= awaitingStrikerTower.attackRange;
                        
                        if (isValidTarget) {
                            const buildingIndex = player!.buildings.indexOf(awaitingStrikerTower);
                            if (buildingIndex >= 0) {
                                const buildingId = this.ctx.getGame()!.getBuildingNetworkId(awaitingStrikerTower);
                                this.ctx.sendNetworkCommand('striker_tower_start_countdown', {
                                    buildingId,
                                    targetX: worldPos.x,
                                    targetY: worldPos.y
                                });
                                console.log(`Striker Tower countdown started at (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                            }
                        } else {
                            console.log('Invalid target position for Striker Tower');
                            awaitingStrikerTower.isAwaitingTarget = false;
                        }
                    } else {
                        // If movement was minimal or only mirrors/base selected, set movement targets
                        const worldPos = this.ctx.renderer.screenToWorld(lastX, lastY);
                        
                        // Increment move order counter
                        this.moveOrderCounter++;
                        
                        // Set rally point for all selected units
                        for (const unit of this.ctx.getSelectionManager().selectedUnits) {
                            const rallyPoint = new Vector2D(worldPos.x, worldPos.y);
                            unit.clearManualTarget();
                            if (unit instanceof Starling) {
                                unit.setManualRallyPoint(rallyPoint);
                            } else {
                                unit.rallyPoint = rallyPoint;
                            }
                            unit.moveOrder = this.moveOrderCounter;
                        }
                        const unitIds = this.ctx.getGame()
                            ? Array.from(this.ctx.getSelectionManager().selectedUnits).map((unit) => this.ctx.getGame()!.getUnitNetworkId(unit))
                            : [];
                        this.ctx.sendNetworkCommand('unit_move', {
                            unitIds,
                            targetX: worldPos.x,
                            targetY: worldPos.y,
                            moveOrder: this.moveOrderCounter
                        });
                        
                        // Set target for the closest selected mirror
                        const player = this.ctx.getLocalPlayer();
                        if (player) {
                            const { mirror: closestMirror, mirrorIndex } = this.ctx.getClosestSelectedMirror(player, worldPos);
                            if (closestMirror && mirrorIndex >= 0) {
                                closestMirror.setTarget(new Vector2D(worldPos.x, worldPos.y), this.ctx.getGame());
                                closestMirror.moveOrder = this.moveOrderCounter;
                                // Only deselect the mirror that received the move order; others stay selected
                                closestMirror.isSelected = false;
                                this.ctx.getSelectionManager().selectedMirrors.delete(closestMirror);
                                this.ctx.sendNetworkCommand('mirror_move', {
                                    mirrorIndices: [mirrorIndex],
                                    targetX: worldPos.x,
                                    targetY: worldPos.y,
                                    moveOrder: this.moveOrderCounter
                                });
                            }
                        }
                        
                        // Set target for selected base
                        if (this.ctx.getSelectionManager().selectedBase) {
                            this.ctx.getSelectionManager().selectedBase.setTarget(new Vector2D(worldPos.x, worldPos.y));
                            this.ctx.getSelectionManager().selectedBase.moveOrder = this.moveOrderCounter;
                            this.ctx.getSelectionManager().selectedBase.isSelected = false;
                            this.ctx.sendNetworkCommand('forge_move', {
                                targetX: worldPos.x,
                                targetY: worldPos.y,
                                moveOrder: this.moveOrderCounter
                            });
                        }
                        
                        // Deselect all units immediately (mirrors keep their selection state from above)
                        this.ctx.getSelectionManager().selectedUnits.clear();
                        this.ctx.getSelectionManager().selectedBase = null;
                        this.ctx.renderer.selectedUnits = this.ctx.getSelectionManager().selectedUnits;
                        this.ctx.renderer.selectedMirrors = this.ctx.getSelectionManager().selectedMirrors;
                        
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
            this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = false;
            this.selectionStartScreen = null;
            this.ctx.renderer.selectionStart = null;
            this.ctx.renderer.selectionEnd = null;
            this.abilityArrowStarts.length = 0;
            this.ctx.renderer.abilityArrowStarts = this.abilityArrowStarts;
            this.ctx.renderer.abilityArrowDirection = null;
            this.ctx.renderer.abilityArrowLengthPx = 0;
            this.ctx.renderer.buildingAbilityArrowStart = null;
            this.ctx.renderer.setBuildingAbilityArrowDirection(null);
            this.ctx.renderer.buildingAbilityArrowLengthPx = 0;
            this.ctx.renderer.highlightedButtonIndex = -1;
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
            // Store on window for access in render method
            (window as any).__lastMouseX = lastMouseX;
            (window as any).__lastMouseY = lastMouseY;
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
                // Store on window for access in render method
                (window as any).__lastMouseX = touchPos.x;
                (window as any).__lastMouseY = touchPos.y;
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
                    const worldPosBeforeZoom = this.ctx.renderer.screenToWorld(currentX, currentY);
                    
                    // Apply zoom based on pinch distance change
                    const zoomDelta = currentPinchDistance / lastPinchDistance;
                    const oldZoom = this.ctx.renderer.zoom;
                    this.ctx.renderer.setZoom(oldZoom * zoomDelta);
                    
                    // Get world position under pinch center after zoom
                    const worldPosAfterZoom = this.ctx.renderer.screenToWorld(currentX, currentY);
                    
                    // Adjust camera to keep world position under pinch center the same
                    const currentCamera = this.ctx.renderer.camera;
                    this.ctx.renderer.setCameraPositionWithoutParallax(new Vector2D(
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
            if (key === 'escape' && this.ctx.getGame() && !this.ctx.getGame()!.isCountdownActive) {
                const winner = this.ctx.getGame()!.checkVictoryConditions();
                if (!winner) {
                    e.preventDefault();
                    this.ctx.toggleInGameMenu();
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
            if (!this.ctx.getGame()) {
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
                const currentCamera = this.ctx.renderer.camera;
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
                    this.ctx.renderer.setCameraPosition(new Vector2D(
                        currentCamera.x + dx / this.ctx.renderer.zoom,
                        currentCamera.y + dy / this.ctx.renderer.zoom
                    ));
                }
            }

            requestAnimationFrame(updateCameraPanning);
        };
        
        updateCameraPanning();
    }

    public startHold(worldPos: Vector2D): void {
        if (!this.ctx.getGame()) return;
        
        const player = this.ctx.getLocalPlayer();
        if (!player) {
            return;
        }
        if (!player.stellarForge) return;

        this.holdStartTime = null;
        this.holdStarlingForMerge = null;

        // Check if any buildings with guns are selected
        const hasSelectedShootingBuildings = Array.from(this.ctx.getSelectionManager().selectedBuildings).some(
            (building: any) => building.canShoot()
        );
        
        if (hasSelectedShootingBuildings) {
            // Building control: Set target for all selected buildings that can shoot
            for (const building of this.ctx.getSelectionManager().selectedBuildings) {
                if (building.canShoot()) {
                    // Find the nearest enemy to the hold position
                    const enemies: any[] = [];
                    
                    // Get all enemy units and buildings
                    for (const otherPlayer of this.ctx.getGame()!.players) {
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
        const hasSelectedMirrors = this.ctx.getSelectionManager().selectedMirrors.size > 0;
        
        if (hasSelectedMirrors && this.ctx.getWarpGateManager().mirrorCommandMode === 'warpgate') {
            this.ctx.getWarpGateManager().tryCreateWarpGateAt(worldPos);
            return;
        }
        // NOTE: Removed old influence-based warp gate creation - now only via mirrors

        if (hasSelectedMirrors && this.ctx.getWarpGateManager().mirrorCommandMode === null) {
            this.ctx.getWarpGateManager().mirrorHoldStartTimeMs = performance.now();
            this.ctx.getWarpGateManager().mirrorHoldWorldPos = worldPos;
        }

        const selectedStarlings = this.ctx.getSelectionManager().getSelectedStarlings(player);
        const hasFoundry = player.buildings.some((building) => building instanceof SubsidiaryFactory);
        if (hasFoundry && selectedStarlings.length >= Constants.STARLING_MERGE_COUNT) {
            const closestStarling = this.ctx.getSelectionManager().getClosestSelectedStarling(worldPos);
            if (closestStarling) {
                this.holdStartTime = performance.now();
                this.holdStarlingForMerge = closestStarling;
            }
        }
    }

    private cancelHold(): void {
        // Deprecated: Hold-based warp gate creation is no longer used
        // Warp gates are now created instantly via mirror commands
        this.holdStartTime = null;
        this.holdStarlingForMerge = null;
        this.ctx.getWarpGateManager().currentWarpGate = null;
        this.ctx.getWarpGateManager().isUsingMirrorsForWarpGate = false;
        this.ctx.getWarpGateManager().mirrorHoldStartTimeMs = null;
        this.ctx.getWarpGateManager().mirrorHoldWorldPos = null;
        this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = false;
    }

    public endHold(): void {
        // Deprecated: Hold-based warp gate creation is no longer used
        this.holdStartTime = null;
        this.holdStarlingForMerge = null;
        this.ctx.getWarpGateManager().isUsingMirrorsForWarpGate = false;
        this.ctx.getWarpGateManager().mirrorHoldStartTimeMs = null;
        this.ctx.getWarpGateManager().mirrorHoldWorldPos = null;
        this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = false;
    }

    public updateStarlingMergeHold(): void {
        if (!this.ctx.getGame()) {
            return;
        }
        if (!this.holdStartTime || !this.holdStarlingForMerge) {
            return;
        }

        const player = this.ctx.getLocalPlayer();
        if (!player) {
            this.cancelHold();
            return;
        }

        if (!this.ctx.getSelectionManager().selectedUnits.has(this.holdStarlingForMerge)) {
            this.cancelHold();
            return;
        }

        const selectedStarlings = this.ctx.getSelectionManager().getSelectedStarlings(player);
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

        if (this.ctx.getSelectionManager().tryStartStarlingMerge(player, selectedStarlings, targetPosition)) {
            this.ctx.setShouldSkipMoveOrderThisTap(true);
        }

        this.cancelHold();
    }

    public updateMirrorWarpGateHold(): void {
        if (!this.ctx.getWarpGateManager().mirrorHoldStartTimeMs || !this.ctx.getWarpGateManager().mirrorHoldWorldPos) {
            return;
        }
        if (this.ctx.getSelectionManager().selectedMirrors.size === 0 || this.ctx.getWarpGateManager().mirrorCommandMode === 'warpgate') {
            this.ctx.getWarpGateManager().mirrorHoldStartTimeMs = null;
            this.ctx.getWarpGateManager().mirrorHoldWorldPos = null;
            return;
        }

        const elapsedMs = performance.now() - this.ctx.getWarpGateManager().mirrorHoldStartTimeMs!;
        if (elapsedMs < Constants.MIRROR_WARP_GATE_HOLD_DURATION_MS) {
            return;
        }

        this.ctx.getWarpGateManager().tryCreateWarpGateAt(this.ctx.getWarpGateManager().mirrorHoldWorldPos!);
        this.ctx.getWarpGateManager().mirrorHoldStartTimeMs = null;
        this.ctx.getWarpGateManager().mirrorHoldWorldPos = null;
        this.ctx.getWarpGateManager().shouldCancelMirrorWarpGateOnRelease = false;
    }

    private updateAbilityArrowStarts(): void {
        this.abilityArrowStarts.length = 0;
        if (this.selectionStartScreen) {
            this.abilityArrowStarts.push(this.selectionStartScreen);
        }
        for (const unit of this.ctx.getSelectionManager().selectedUnits) {
            if (unit.isHero) {
                this.abilityArrowStarts.push(this.ctx.renderer.worldToScreen(unit.position));
            }
        }
        this.ctx.renderer.abilityArrowStarts = this.abilityArrowStarts;
    }

    public isDoubleTap(screenX: number, screenY: number): boolean {
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

    public getRadialButtonOffsets(buttonCount: number): Array<{ x: number; y: number }> {
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

}
