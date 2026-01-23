/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate, Unit, Sun } from './game-core';
import { GameRenderer } from './renderer';
import { MainMenu, GameSettings } from './menu';
import * as Constants from './constants';

class GameController {
    private game: GameState | null = null;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private holdStartTime: number | null = null;
    private holdPosition: Vector2D | null = null;
    private currentWarpGate: WarpGate | null = null;
    private menu: MainMenu;
    private selectedUnits: Set<Unit> = new Set();
    private isSelecting: boolean = false;
    private selectionStartScreen: Vector2D | null = null;

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

        // Set up input handlers
        this.setupInputHandlers(canvas);
    }

    private startNewGame(settings: GameSettings): void {
        // Create game based on selected map
        this.game = this.createGameFromSettings(settings);

        // Start game loop
        this.start();
    }

    private createGameFromSettings(settings: GameSettings): GameState {
        const game = createStandardGame([
            ['Player 1', Faction.RADIANT],
            ['Player 2', Faction.AURUM]
        ]);

        // Clear and recreate based on map settings
        const map = settings.selectedMap;
        
        // Clear existing suns and add new ones based on map
        game.suns = [];
        
        if (map.id === 'twin-suns') {
            // Two suns positioned diagonally
            game.suns.push(new Sun(new Vector2D(-300, -300), 1.0, 100.0));
            game.suns.push(new Sun(new Vector2D(300, 300), 1.0, 100.0));
        } else {
            // Single sun at center (default for all other maps)
            game.suns.push(new Sun(new Vector2D(0, 0), 1.0, 100.0));
        }
        
        // Reinitialize asteroids based on map
        game.asteroids = [];
        game.initializeAsteroids(map.numAsteroids, map.mapSize, map.mapSize);
        
        // Reinitialize space dust
        game.spaceDust = [];
        game.initializeSpaceDust(1000, map.mapSize, map.mapSize);
        
        return game;
    }

    private setupInputHandlers(canvas: HTMLCanvasElement): void {
        // Touch/Mouse support for mobile and desktop
        let isPanning = false;
        let isMouseDown = false;
        let lastX = 0;
        let lastY = 0;
        let lastMouseX = 0;
        let lastMouseY = 0;

        // Edge panning constants (desktop only)
        const EDGE_PAN_THRESHOLD = 20; // pixels from edge
        const EDGE_PAN_SPEED = 5; // pixels per frame

        // Keyboard panning state
        const keysPressed = new Set<string>();

        // Mouse wheel zoom - zoom towards cursor
        canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            
            // Get world position under mouse before zoom
            const worldPosBeforeZoom = this.renderer.screenToWorld(e.clientX, e.clientY);
            
            // Apply zoom
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            const oldZoom = this.renderer.zoom;
            this.renderer.setZoom(oldZoom * zoomDelta);
            
            // Get world position under mouse after zoom
            const worldPosAfterZoom = this.renderer.screenToWorld(e.clientX, e.clientY);
            
            // Adjust camera to keep world position under cursor the same
            const currentCamera = this.renderer.camera;
            this.renderer.setCameraPosition(new Vector2D(
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
            
            // If moved significantly
            if (totalMovement > 5) {
                // Two-finger touch should pan the camera
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
                } else {
                    // Single-finger/mouse drag should start selection
                    if (!this.isSelecting && !isPanning) {
                        this.isSelecting = true;
                        this.cancelHold();
                    }
                    
                    if (this.isSelecting) {
                        // Update selection rectangle
                        this.renderer.selectionStart = this.selectionStartScreen;
                        this.renderer.selectionEnd = new Vector2D(x, y);
                    }
                }
            }
            
            lastX = x;
            lastY = y;
        };

        const endDrag = () => {
            // If we were selecting, finalize the selection
            if (this.isSelecting && this.selectionStartScreen && this.game) {
                const endPos = new Vector2D(lastX, lastY);
                this.selectUnitsInRectangle(this.selectionStartScreen, endPos);
            } else if (!this.isSelecting && this.selectedUnits.size > 0 && this.selectionStartScreen && this.game) {
                // If units are selected and player dragged/clicked
                const endPos = new Vector2D(lastX, lastY);
                const totalMovement = this.selectionStartScreen.distanceTo(endPos);
                
                // If dragged significantly (> 5 pixels), use ability
                if (totalMovement >= 5) {
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
                    // If movement was minimal (< 5 pixels), set rally point
                    const worldPos = this.renderer.screenToWorld(lastX, lastY);
                    
                    // Set rally point for all selected units
                    for (const unit of this.selectedUnits) {
                        unit.rallyPoint = new Vector2D(worldPos.x, worldPos.y);
                    }
                    
                    // Deselect all units immediately
                    this.selectedUnits.clear();
                    this.renderer.selectedUnits = this.selectedUnits;
                    
                    console.log(`Rally point set at (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
                }
            }
            
            isPanning = false;
            isMouseDown = false;
            this.isSelecting = false;
            this.selectionStartScreen = null;
            this.renderer.selectionStart = null;
            this.renderer.selectionEnd = null;
            this.endHold();
        };

        // Mouse events
        canvas.addEventListener('mousedown', (e: MouseEvent) => {
            isMouseDown = true;
            startDrag(e.clientX, e.clientY);
        });

        canvas.addEventListener('mousemove', (e: MouseEvent) => {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            moveDrag(e.clientX, e.clientY, false);
        });

        canvas.addEventListener('mouseup', () => {
            endDrag();
        });

        canvas.addEventListener('mouseleave', () => {
            endDrag();
        });

        // Touch events - two fingers for pan, one finger for selection
        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                isMouseDown = true;
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                e.preventDefault();
                // Two finger touch - prepare for panning
                isMouseDown = true;
                isPanning = false;
                const touch = e.touches[0];
                lastX = touch.clientX;
                lastY = touch.clientY;
                this.cancelHold();
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 1 && isMouseDown) {
                e.preventDefault();
                const touch = e.touches[0];
                moveDrag(touch.clientX, touch.clientY, false);
            } else if (e.touches.length === 2) {
                e.preventDefault();
                // Two finger drag - pan the camera
                const touch = e.touches[0];
                moveDrag(touch.clientX, touch.clientY, true);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            endDrag();
        });

        // Keyboard controls (WASD and arrow keys) - Desktop only
        const KEYBOARD_PAN_SPEED = 10;
        
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
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
            // Early exit if no input is active
            const hasKeyboardInput = keysPressed.size > 0;
            const hasEdgeInput = !isMouseDown && !isPanning && (
                lastMouseX < EDGE_PAN_THRESHOLD ||
                lastMouseX > canvas.width - EDGE_PAN_THRESHOLD ||
                lastMouseY < EDGE_PAN_THRESHOLD ||
                lastMouseY > canvas.height - EDGE_PAN_THRESHOLD
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

                // Edge panning (only if not dragging with mouse)
                if (hasEdgeInput) {
                    if (lastMouseX < EDGE_PAN_THRESHOLD) dx -= EDGE_PAN_SPEED;
                    if (lastMouseX > canvas.width - EDGE_PAN_THRESHOLD) dx += EDGE_PAN_SPEED;
                    if (lastMouseY < EDGE_PAN_THRESHOLD) dy -= EDGE_PAN_SPEED;
                    if (lastMouseY > canvas.height - EDGE_PAN_THRESHOLD) dy += EDGE_PAN_SPEED;
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
        
        // Check if position is in player's influence
        const player = this.game.players[0]; // Assume player 1 is the human player
        if (!player.stellarForge) return;

        const distance = worldPos.distanceTo(player.stellarForge.position);
        if (distance < Constants.INFLUENCE_RADIUS) { // Within influence radius
            this.holdStartTime = Date.now();
            this.holdPosition = worldPos;
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

        // Get the player's units (assume player 1 is the human player)
        const player = this.game.players[0];
        if (!player || player.isDefeated()) return;

        // Select units within the rectangle
        for (const unit of player.units) {
            if (unit.position.x >= minX && unit.position.x <= maxX &&
                unit.position.y >= minY && unit.position.y <= maxY) {
                this.selectedUnits.add(unit);
            }
        }

        // Update renderer's selected units
        this.renderer.selectedUnits = this.selectedUnits;

        // Log selection for debugging
        console.log(`Selected ${this.selectedUnits.size} units`);
    }

    private cancelHold(): void {
        if (!this.game) return;
        
        if (this.currentWarpGate) {
            this.currentWarpGate.cancel();
            this.scatterParticles(this.currentWarpGate.position);
            const index = this.game.warpGates.indexOf(this.currentWarpGate);
            if (index > -1) {
                this.game.warpGates.splice(index, 1);
            }
        }
        this.holdStartTime = null;
        this.holdPosition = null;
        this.currentWarpGate = null;
    }

    private endHold(): void {
        this.holdStartTime = null;
        this.holdPosition = null;
        // Don't remove currentWarpGate here, it might still be charging
    }

    private scatterParticles(position: Vector2D): void {
        if (!this.game) return;
        
        // Scatter nearby particles
        for (const particle of this.game.spaceDust) {
            const distance = particle.position.distanceTo(position);
            if (distance < Constants.PARTICLE_SCATTER_RADIUS) {
                const direction = new Vector2D(
                    particle.position.x - position.x,
                    particle.position.y - position.y
                ).normalize();
                particle.applyForce(new Vector2D(
                    direction.x * Constants.PARTICLE_SCATTER_FORCE,
                    direction.y * Constants.PARTICLE_SCATTER_FORCE
                ));
            }
        }
    }

    private update(deltaTime: number): void {
        if (!this.game) return;
        
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
            this.currentWarpGate.update(deltaTime, isStillHolding);
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
    new GameController();
});
