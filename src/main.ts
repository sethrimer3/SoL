/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate } from './game-core';
import { GameRenderer } from './renderer';
import { MainMenu } from './menu';
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
        this.menu.onStart(() => this.startNewGame());

        // Set up input handlers
        this.setupInputHandlers(canvas);
    }

    private startNewGame(): void {
        // Create game
        this.game = createStandardGame([
            ['Player 1', Faction.RADIANT],
            ['Player 2', Faction.AURUM]
        ]);

        // Start game loop
        this.start();
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

        // Touch/Mouse pan
        const startPan = (x: number, y: number) => {
            lastX = x;
            lastY = y;
            
            // Start warp gate hold timer
            const worldPos = this.renderer.screenToWorld(x, y);
            this.startHold(worldPos);
        };

        const movePan = (x: number, y: number) => {
            if (!isPanning && !isMouseDown) {
                // Not panning, just tracking mouse position
                lastX = x;
                lastY = y;
                return;
            }
            
            const dx = x - lastX;
            const dy = y - lastY;
            const totalMovement = Math.sqrt(dx * dx + dy * dy);
            
            // If moved significantly, enable panning and cancel hold
            if (totalMovement > 5) {
                if (!isPanning) {
                    isPanning = true;
                    this.cancelHold();
                }
                
                // Update camera position (inverted for natural panning)
                const currentCamera = this.renderer.camera;
                this.renderer.setCameraPosition(new Vector2D(
                    currentCamera.x - dx / this.renderer.zoom,
                    currentCamera.y - dy / this.renderer.zoom
                ));
            }
            
            lastX = x;
            lastY = y;
        };

        const endPan = () => {
            isPanning = false;
            isMouseDown = false;
            this.endHold();
        };

        // Mouse events
        canvas.addEventListener('mousedown', (e: MouseEvent) => {
            isMouseDown = true;
            startPan(e.clientX, e.clientY);
        });

        canvas.addEventListener('mousemove', (e: MouseEvent) => {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            movePan(e.clientX, e.clientY);
        });

        canvas.addEventListener('mouseup', () => {
            endPan();
        });

        canvas.addEventListener('mouseleave', () => {
            endPan();
        });

        // Touch events (always pan on touch devices)
        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                // For touch, don't require significant movement to start panning
                startPan(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const dx = touch.clientX - lastX;
                const dy = touch.clientY - lastY;
                const totalMovement = Math.sqrt(dx * dx + dy * dy);
                
                // For touch, start panning immediately on movement
                if (totalMovement > 5) {
                    if (!isPanning) {
                        isPanning = true;
                        this.cancelHold();
                    }
                    
                    // Update camera position
                    const currentCamera = this.renderer.camera;
                    this.renderer.setCameraPosition(new Vector2D(
                        currentCamera.x - dx / this.renderer.zoom,
                        currentCamera.y - dy / this.renderer.zoom
                    ));
                }
                
                lastX = touch.clientX;
                lastY = touch.clientY;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            endPan();
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
