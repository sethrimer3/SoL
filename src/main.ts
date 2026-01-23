/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D, WarpGate } from './game-core';
import { GameRenderer } from './renderer';

class GameController {
    private game: GameState;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;
    private holdStartTime: number | null = null;
    private holdPosition: Vector2D | null = null;
    private currentWarpGate: WarpGate | null = null;

    constructor() {
        // Create canvas
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        // Initialize renderer
        this.renderer = new GameRenderer(canvas);

        // Create game
        this.game = createStandardGame([
            ['Player 1', Faction.RADIANT],
            ['Player 2', Faction.AURUM]
        ]);

        // Set up input handlers
        this.setupInputHandlers(canvas);

        // Start game loop
        this.start();
    }

    private setupInputHandlers(canvas: HTMLCanvasElement): void {
        // Touch/Mouse support for mobile and desktop
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;

        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            this.renderer.setZoom(this.renderer.zoom * zoomDelta);
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
            this.endHold();
        };

        // Mouse events
        canvas.addEventListener('mousedown', (e: MouseEvent) => {
            startPan(e.clientX, e.clientY);
        });

        canvas.addEventListener('mousemove', (e: MouseEvent) => {
            movePan(e.clientX, e.clientY);
        });

        canvas.addEventListener('mouseup', () => {
            endPan();
        });

        canvas.addEventListener('mouseleave', () => {
            endPan();
        });

        // Touch events
        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                startPan(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                movePan(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            endPan();
        });
    }

    private startHold(worldPos: Vector2D): void {
        // Check if position is in player's influence
        const player = this.game.players[0]; // Assume player 1 is the human player
        if (!player.stellarForge) return;

        const distance = worldPos.distanceTo(player.stellarForge.position);
        if (distance < 300) { // Within influence radius
            this.holdStartTime = Date.now();
            this.holdPosition = worldPos;
        }
    }

    private cancelHold(): void {
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
        // Scatter nearby particles
        for (const particle of this.game.spaceDust) {
            const distance = particle.position.distanceTo(position);
            if (distance < 150) {
                const direction = new Vector2D(
                    particle.position.x - position.x,
                    particle.position.y - position.y
                ).normalize();
                particle.applyForce(new Vector2D(
                    direction.x * 200,
                    direction.y * 200
                ));
            }
        }
    }

    private update(deltaTime: number): void {
        if (this.game.isRunning) {
            this.game.update(deltaTime);
        }

        // Update warp gate hold mechanic
        if (this.holdStartTime && this.holdPosition) {
            const holdDuration = (Date.now() - this.holdStartTime) / 1000;
            
            if (holdDuration >= 1.0 && !this.currentWarpGate) {
                // Create warp gate after 1 second
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
            
            // Check if gate is complete
            if (this.currentWarpGate.isComplete) {
                // Gate is ready for building selection
                // For now, just remove it after a moment
                // In a full implementation, you'd show the building UI
            }
        }
    }

    private render(): void {
        this.renderer.render(this.game);
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
