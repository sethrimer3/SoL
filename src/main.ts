/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate, Unit, Sun, Minigun, SpaceDustSwirler, SubsidiaryFactory, LightRay, Starling, StellarForge, Marine, Grave, Ray, InfluenceBall, TurretDeployer, Driller, Dagger, Beam, Player } from './game-core';
import { GameRenderer } from './renderer';
import { MainMenu, GameSettings, COLOR_SCHEMES } from './menu';
import * as Constants from './constants';

class GameController {
    public game: GameState | null = null;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private showInGameMenu: boolean = false;
    private showInfo: boolean = false;
    private holdStartTime: number | null = null;
    private holdPosition: Vector2D | null = null;
    private currentWarpGate: WarpGate | null = null;
    private isUsingMirrorsForWarpGate: boolean = false;
    private menu: MainMenu;
    private selectedUnits: Set<Unit> = new Set();
    private selectedMirrors: Set<any> = new Set(); // Set of SolarMirror
    private selectedBase: any | null = null; // StellarForge or null
    private selectedBuildings: Set<any> = new Set(); // Set of Building (Minigun, SpaceDustSwirler, SubsidiaryFactory)
    private isSelecting: boolean = false;
    private selectionStartScreen: Vector2D | null = null;
    private isDraggingHeroArrow: boolean = false; // Flag for hero arrow dragging
    private isDrawingPath: boolean = false; // Flag for drawing minion path from base
    private pathPoints: Vector2D[] = []; // Path waypoints being drawn
    private moveOrderCounter: number = 0; // Counter for move order indicators

    /**
     * Check if only hero units are currently selected
     */
    private hasOnlyHeroUnitsSelected(): boolean {
        return this.selectedUnits.size > 0 && 
               Array.from(this.selectedUnits).every(unit => unit.isHero);
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

    private getHeroUnitType(heroName: string): string | null {
        switch (heroName) {
            case 'Marine':
            case 'Grave':
            case 'Ray':
            case 'Dagger':
            case 'Beam':
            case 'Driller':
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
        
        const positions = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 }
        ];
        const displayHeroes = heroNames.slice(0, positions.length);
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

    private surrender(): void {
        if (!this.game) return;
        
        // Set player's forge health to 0 to trigger defeat
        const player = this.game.players[0];
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
        this.renderer.selectedUnits = this.selectedUnits;
        
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
        
        // Set graphics quality from settings
        this.renderer.graphicsQuality = settings.graphicsQuality;
        
        // Set up network manager for LAN play
        if (settings.gameMode === 'lan' && settings.networkManager) {
            // Determine local player index based on whether this client is the host
            const isHost = settings.networkManager.isLobbyHost();
            const localPlayerIndex = isHost ? 0 : 1;
            
            // Set up AI flag for players (local player is not AI, remote player is not AI either)
            this.game.players[0].isAi = false;
            this.game.players[1].isAi = false;
            
            // Set up network manager in game state
            this.game.setupNetworkManager(settings.networkManager, localPlayerIndex);
            
            console.log(`LAN mode: Local player is Player ${localPlayerIndex + 1} (${isHost ? 'Host' : 'Client'})`);
        }
        
        // Set the viewing player for the renderer (player 1 is the human player)
        if (this.game.players.length > 0) {
            this.renderer.viewingPlayer = this.game.players[0];
            
            // Center camera on player's base and zoom in halfway
            const player = this.game.players[0];
            if (player.stellarForge) {
                this.renderer.setCameraPosition(player.stellarForge.position);
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
                const hasOnlyHeroUnits = this.hasOnlyHeroUnitsSelected();
                
                if (!this.isSelecting && !isPanning && !this.isDraggingHeroArrow && !this.isDrawingPath) {
                    if (this.selectedBase && this.selectedBase.isSelected) {
                        // Drawing a path from the selected base
                        this.isDrawingPath = true;
                        this.pathPoints = [];
                        this.renderer.pathPreviewForge = this.selectedBase;
                        this.renderer.pathPreviewPoints = this.pathPoints;
                        this.cancelHold();
                    } else if (this.selectedUnits.size > 0 && this.selectionStartScreen) {
                        // Check if drag started near selected units - if so, draw movement path
                        const dragStartWorld = this.renderer.screenToWorld(this.selectionStartScreen.x, this.selectionStartScreen.y);
                        if (this.isDragStartNearSelectedUnits(dragStartWorld)) {
                            // Drawing a movement path for selected units
                            this.isDrawingPath = true;
                            this.pathPoints = [];
                            this.renderer.pathPreviewForge = null; // No forge for unit paths
                            this.renderer.pathPreviewPoints = this.pathPoints;
                            this.cancelHold();
                        } else if (hasOnlyHeroUnits) {
                            // For hero units away from units, use arrow dragging mode
                            this.isDraggingHeroArrow = true;
                            this.cancelHold();
                        } else {
                            // For regular (non-hero) units when drag doesn't start near them, use selection rectangle
                            this.isSelecting = true;
                            this.cancelHold();
                        }
                    } else if (hasOnlyHeroUnits) {
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
                this.renderer.abilityArrowStart = this.selectionStartScreen;
                this.renderer.abilityArrowEnd = new Vector2D(x, y);
            } else if (this.isDrawingPath) {
                // Collect path waypoints as we drag
                const worldPos = this.renderer.screenToWorld(x, y);
                
                // Add waypoint if we've moved far enough from the last one
                if (this.pathPoints.length === 0 || 
                    this.pathPoints[this.pathPoints.length - 1].distanceTo(worldPos) > Constants.MIN_WAYPOINT_DISTANCE) {
                    this.pathPoints.push(new Vector2D(worldPos.x, worldPos.y));
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
                const player = this.game.players[0]; // Assume player 1 is human
                
                // Check if clicked on stellar forge
                if (player.stellarForge && player.stellarForge.containsPoint(worldPos)) {
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
                    if (clickedBuilding.isSelected) {
                        // Deselect building
                        clickedBuilding.isSelected = false;
                        this.selectedBuildings.delete(clickedBuilding);
                        console.log('Building deselected');
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

                // Check if clicked on a warp gate button
                for (const gate of this.game.warpGates) {
                    if (!gate.isComplete) continue;
                    
                    // Check if player owns this gate
                    if (gate.owner !== player) continue;
                    
                    // Convert gate position to screen space
                    const gateScreenPos = this.renderer.worldToScreen(gate.position);
                    
                    // Calculate button positions in screen space (matching renderer)
                    const maxRadius = Constants.WARP_GATE_RADIUS * this.renderer.zoom;
                    const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.renderer.zoom;
                    const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.renderer.zoom;
                    const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
                    const labels = ['Minigun', 'Swirler', 'Sub Factory', 'Locked'];
                    
                    for (let i = 0; i < 4; i++) {
                        const angle = angles[i];
                        // Calculate button position in screen space
                        const buttonScreenX = gateScreenPos.x + Math.cos(angle) * buttonDistance;
                        const buttonScreenY = gateScreenPos.y + Math.sin(angle) * buttonDistance;
                        
                        // Check distance in screen space
                        const dx = lastX - buttonScreenX;
                        const dy = lastY - buttonScreenY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= buttonRadius) {
                            // Convert button screen position to world position for the wave effect
                            const buttonWorldPos = this.renderer.screenToWorld(buttonScreenX, buttonScreenY);
                            this.renderer.createProductionButtonWave(buttonWorldPos);
                            console.log(
                                `Warp gate button clicked: ${labels[i]} (index ${i}) | energy=${player.energy.toFixed(1)}`
                            );
                            // Button clicked!
                            if (i === 0) {
                                // First button - create Minigun building
                                if (player.spendEnergy(Constants.MINIGUN_COST)) {
                                    const minigun = new Minigun(new Vector2D(gate.position.x, gate.position.y), player);
                                    player.buildings.push(minigun);
                                    console.log(`Minigun building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                                    
                                    // Emit shockwave when building starts warping in
                                    this.scatterParticles(gate.position);
                                    
                                    // Remove the warp gate (implode effect)
                                    const gateIndex = this.game.warpGates.indexOf(gate);
                                    if (gateIndex > -1) {
                                        this.game.warpGates.splice(gateIndex, 1);
                                    }
                                    this.implodeParticles(gate.position);
                                } else {
                                    console.log('Not enough energy to build Minigun');
                                }
                            } else if (i === 1) {
                                // Second button - create Space Dust Swirler building
                                if (player.spendEnergy(Constants.SWIRLER_COST)) {
                                    const swirler = new SpaceDustSwirler(new Vector2D(gate.position.x, gate.position.y), player);
                                    player.buildings.push(swirler);
                                    console.log(`Space Dust Swirler building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                                    
                                    // Emit shockwave when building starts warping in
                                    this.scatterParticles(gate.position);
                                    
                                    // Remove the warp gate (implode effect)
                                    const gateIndex = this.game.warpGates.indexOf(gate);
                                    if (gateIndex > -1) {
                                        this.game.warpGates.splice(gateIndex, 1);
                                    }
                                    this.implodeParticles(gate.position);
                                } else {
                                    console.log('Not enough energy to build Space Dust Swirler');
                                }
                            } else if (i === 2) {
                                // Third button (bottom) - create Subsidiary Factory building
                                // Check if player already has a Subsidiary Factory
                                const hasSubFactory = player.buildings.some((building) => building instanceof SubsidiaryFactory);
                                if (hasSubFactory) {
                                    console.log('Only one Subsidiary Factory can exist at a time');
                                } else if (player.spendEnergy(Constants.SUBSIDIARY_FACTORY_COST)) {
                                    const subFactory = new SubsidiaryFactory(new Vector2D(gate.position.x, gate.position.y), player);
                                    player.buildings.push(subFactory);
                                    console.log(`Subsidiary Factory building queued at warp gate (${gate.position.x.toFixed(0)}, ${gate.position.y.toFixed(0)})`);
                                    
                                    // Emit shockwave when building starts warping in
                                    this.scatterParticles(gate.position);
                                    
                                    // Remove the warp gate (implode effect)
                                    const gateIndex = this.game.warpGates.indexOf(gate);
                                    if (gateIndex > -1) {
                                        this.game.warpGates.splice(gateIndex, 1);
                                    }
                                    this.implodeParticles(gate.position);
                                } else {
                                    console.log('Not enough energy to build Subsidiary Factory');
                                }
                            }
                            // Other buttons can be added later for different building types
                            
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
                
                // If forge is selected and clicked elsewhere, move it
                if (player.stellarForge && player.stellarForge.isSelected) {
                    player.stellarForge.setTarget(worldPos);
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
                const selectedMirror = player.solarMirrors.find(m => m.isSelected);
                if (selectedMirror) {
                    selectedMirror.setTarget(worldPos);
                    selectedMirror.isSelected = false; // Auto-deselect after setting target
                    this.selectedBase = null;
                    this.selectedUnits.clear();
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
                } else if (this.selectedUnits.size > 0) {
                    // Path for selected units
                    console.log(`Unit movement path set with ${this.pathPoints.length} waypoints for ${this.selectedUnits.size} unit(s)`);
                    
                    // Increment move order counter
                    this.moveOrderCounter++;
                    
                    // Set path for all selected units
                    for (const unit of this.selectedUnits) {
                        // All units now support path following
                        unit.setPath(this.pathPoints);
                        unit.moveOrder = this.moveOrderCounter;
                    }
                    
                    // Deselect units and buildings after setting path
                    this.selectedUnits.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    const player = this.game.players[0];
                    if (player) {
                        for (const building of player.buildings) {
                            building.isSelected = false;
                        }
                        this.selectedBuildings.clear();
                    }
                }
                this.clearPathPreview();
            } else if (!this.isSelecting && (this.selectedUnits.size > 0 || this.selectedMirrors.size > 0 || this.selectedBase) && this.selectionStartScreen && this.game) {
                // If units, mirrors, or base are selected and player dragged/clicked
                const endPos = new Vector2D(lastX, lastY);
                const totalMovement = this.selectionStartScreen.distanceTo(endPos);
                
                const abilityDragThreshold = Math.max(Constants.CLICK_DRAG_THRESHOLD, Constants.ABILITY_ARROW_MIN_LENGTH);
                const hasOnlyHeroUnits = this.hasOnlyHeroUnitsSelected();
                const shouldUseAbility = this.selectedUnits.size > 0 && (
                    (!hasOnlyHeroUnits && totalMovement >= Constants.CLICK_DRAG_THRESHOLD) ||
                    (hasOnlyHeroUnits && this.isDraggingHeroArrow && totalMovement >= abilityDragThreshold)
                );

                // If dragged significantly, use ability (for units only)
                if (shouldUseAbility) {
                    
                    // Only create swipe effect for non-hero units
                    if (!hasOnlyHeroUnits) {
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
                    
                    // Activate ability for all selected units
                    let anyAbilityUsed = false;
                    for (const unit of this.selectedUnits) {
                        if (unit.useAbility(direction)) {
                            anyAbilityUsed = true;
                        }
                    }
                    
                    if (anyAbilityUsed) {
                        console.log(`Ability activated in direction (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);
                    }
                    
                    // Deselect all units after using ability
                    this.selectedUnits.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                } else {
                    // If movement was minimal or only mirrors/base selected, set movement targets
                    const worldPos = this.renderer.screenToWorld(lastX, lastY);
                    
                    // Increment move order counter
                    this.moveOrderCounter++;
                    
                    // Set rally point for all selected units
                    for (const unit of this.selectedUnits) {
                        const rallyPoint = new Vector2D(worldPos.x, worldPos.y);
                        if (unit instanceof Starling) {
                            unit.setManualRallyPoint(rallyPoint);
                        } else {
                            unit.rallyPoint = rallyPoint;
                        }
                        unit.moveOrder = this.moveOrderCounter;
                    }
                    
                    // Set target for all selected mirrors
                    for (const mirror of this.selectedMirrors) {
                        mirror.setTarget(new Vector2D(worldPos.x, worldPos.y));
                        mirror.moveOrder = this.moveOrderCounter;
                        mirror.isSelected = false;
                    }
                    
                    // Set target for selected base
                    if (this.selectedBase) {
                        this.selectedBase.setTarget(new Vector2D(worldPos.x, worldPos.y));
                        this.selectedBase.moveOrder = this.moveOrderCounter;
                        this.selectedBase.isSelected = false;
                    }
                    
                    // Deselect all units immediately
                    this.selectedUnits.clear();
                    this.selectedMirrors.clear();
                    this.selectedBase = null;
                    this.renderer.selectedUnits = this.selectedUnits;
                    
                    console.log(`Movement target set at (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)}) - Move order #${this.moveOrderCounter}`);
                }
            }
            
            isPanning = false;
            isMouseDown = false;
            this.isSelecting = false;
            this.isDraggingHeroArrow = false;
            this.isDrawingPath = false;
            this.pathPoints = [];
            this.selectionStartScreen = null;
            this.renderer.selectionStart = null;
            this.renderer.selectionEnd = null;
            this.renderer.abilityArrowStart = null;
            this.renderer.abilityArrowEnd = null;
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
        
        const player = this.game.players[0]; // Assume player 1 is the human player
        if (!player.stellarForge) return;

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
        
        if (hasSelectedMirrors) {
            // Mirror-based warp gate: check if any selected mirror has line of sight to hold position
            let canCreateWarpGate = false;
            
            for (const mirror of this.selectedMirrors) {
                // Mirror must be powered (have line of sight to light source)
                if (!mirror.hasLineOfSightToLight(this.game.suns, this.game.asteroids)) continue;
                
                // Check line of sight from mirror to hold position
                const ray = new LightRay(
                    mirror.position,
                    new Vector2D(
                        worldPos.x - mirror.position.x,
                        worldPos.y - mirror.position.y
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
                    canCreateWarpGate = true;
                    break;
                }
            }
            
            if (canCreateWarpGate) {
                this.holdStartTime = Date.now();
                this.holdPosition = worldPos;
                this.isUsingMirrorsForWarpGate = true;
                console.log('Starting mirror-based warp gate at', worldPos);
            }
        } else {
            // Normal warp gate: check if position is in player's influence
            const distance = worldPos.distanceTo(player.stellarForge.position);
            if (distance < Constants.INFLUENCE_RADIUS) {
                this.holdStartTime = Date.now();
                this.holdPosition = worldPos;
                this.isUsingMirrorsForWarpGate = false;
            }
        }
    }

    private selectUnitsInRectangle(screenStart: Vector2D, screenEnd: Vector2D): void {
        if (!this.game) return;

        // Convert screen coordinates to world coordinates
        const worldStart = this.renderer.screenToWorld(screenStart.x, screenStart.y);
        const worldEnd = this.renderer.screenToWorld(screenEnd.x, screenEnd.y);

        // Calculate rectangle bounds
        const minX = Math.min(worldStart.x, worldEnd.x);
        const maxX = Math.max(worldStart.x, worldEnd.x);
        const minY = Math.min(worldStart.y, worldEnd.y);
        const maxY = Math.max(worldStart.y, worldEnd.y);

        // Clear previous selection
        this.selectedUnits.clear();
        this.selectedMirrors.clear();
        this.selectedBase = null;

        // Get the player's units (assume player 1 is the human player)
        const player = this.game.players[0];
        if (!player || player.isDefeated()) return;

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

        // Update renderer's selected units
        this.renderer.selectedUnits = this.selectedUnits;

        // Log selection for debugging
        console.log(`Selected ${this.selectedUnits.size} units, ${this.selectedMirrors.size} mirrors, ${this.selectedBase ? '1 base' : '0 bases'}`);
    }

    private cancelHold(): void {
        if (!this.game) return;
        
        if (this.currentWarpGate) {
            this.currentWarpGate.cancel();
            this.implodeParticles(this.currentWarpGate.position); // Changed from scatterParticles to implodeParticles
            const index = this.game.warpGates.indexOf(this.currentWarpGate);
            if (index > -1) {
                this.game.warpGates.splice(index, 1);
            }
        }
        this.holdStartTime = null;
        this.holdPosition = null;
        this.currentWarpGate = null;
        this.isUsingMirrorsForWarpGate = false;
    }

    private endHold(): void {
        this.holdStartTime = null;
        this.holdPosition = null;
        this.isUsingMirrorsForWarpGate = false;
        // Don't remove currentWarpGate here, it might still be charging
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

    private update(deltaTime: number): void {
        if (!this.game) return;
        
        // Don't update game logic if paused
        if (this.isPaused) return;
        
        // Check if game has ended
        const winner = this.game.checkVictoryConditions();
        if (winner && this.game.isRunning) {
            this.game.isRunning = false;
        }
        
        if (this.game.isRunning) {
            this.game.update(deltaTime);
        }

        // Update warp gate hold mechanic
        if (this.holdStartTime && this.holdPosition) {
            const holdDuration = (Date.now() - this.holdStartTime) / 1000;
            
            if (holdDuration >= Constants.WARP_GATE_INITIAL_DELAY && !this.currentWarpGate) {
                // Create warp gate after initial delay
                const player = this.game.players[0];
                this.currentWarpGate = new WarpGate(this.holdPosition, player);
                this.currentWarpGate.startCharging();
                this.game.warpGates.push(this.currentWarpGate);
            }
        }

        // Update current warp gate
        if (this.currentWarpGate) {
            const isStillHolding = this.holdStartTime !== null && this.holdPosition !== null;
            
            // Calculate charge multiplier based on mirrors if using mirror-based warp gate
            let chargeMultiplier = 1.0;
            if (this.isUsingMirrorsForWarpGate && isStillHolding) {
                const player = this.game.players[0];
                let totalMirrorPower = 0;
                
                for (const mirror of this.selectedMirrors) {
                    // Check if mirror is powered
                    if (!mirror.hasLineOfSightToLight(this.game.suns, this.game.asteroids)) continue;
                    
                    // Check if mirror has line of sight to warp gate
                    const ray = new LightRay(
                        mirror.position,
                        new Vector2D(
                            this.currentWarpGate.position.x - mirror.position.x,
                            this.currentWarpGate.position.y - mirror.position.y
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
                        // Calculate mirror power based on distance to closest sun
                        const closestSun = this.game.suns.reduce((closest, sun) => {
                            const distToSun = mirror.position.distanceTo(sun.position);
                            const distToClosest = closest ? mirror.position.distanceTo(closest.position) : Infinity;
                            return distToSun < distToClosest ? sun : closest;
                        }, null as Sun | null);
                        
                        if (closestSun) {
                            const distanceToSun = mirror.position.distanceTo(closestSun.position);
                            const distanceMultiplier = Math.max(1.0, Constants.MIRROR_PROXIMITY_MULTIPLIER * (1.0 - Math.min(1.0, distanceToSun / Constants.MIRROR_MAX_GLOW_DISTANCE)));
                            totalMirrorPower += distanceMultiplier;
                        }
                    }
                }
                
                // Charge multiplier increases with more mirrors/power
                // Base is 0.5x (slower than normal), each mirror adds power
                chargeMultiplier = 0.5 + (totalMirrorPower * 0.5);
            }
            
            this.currentWarpGate.update(deltaTime, isStillHolding, chargeMultiplier);

            if (this.currentWarpGate.shouldEmitShockwave()) {
                this.scatterParticles(this.currentWarpGate.position);
                this.renderer.createWarpGateShockwave(this.currentWarpGate.position);
            }
        }
    }

    private render(): void {
        if (this.game) {
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
