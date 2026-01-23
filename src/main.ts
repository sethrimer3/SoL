/**
 * Main entry point for SoL game
 */

import { createStandardGame, Faction, GameState, Vector2D } from './game-core';
import { GameRenderer } from './renderer';

class GameController {
    private game: GameState;
    private renderer: GameRenderer;
    private lastTime: number = 0;
    private isRunning: boolean = false;

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
            isPanning = true;
            lastX = x;
            lastY = y;
        };

        const movePan = (x: number, y: number) => {
            if (isPanning) {
                const dx = x - lastX;
                const dy = y - lastY;
                lastX = x;
                lastY = y;
                
                // Update camera position (inverted for natural panning)
                const currentCamera = this.renderer.camera;
                this.renderer.setCameraPosition(new Vector2D(
                    currentCamera.x - dx / this.renderer.zoom,
                    currentCamera.y - dy / this.renderer.zoom
                ));
            }
        };

        const endPan = () => {
            isPanning = false;
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

    private update(deltaTime: number): void {
        if (this.game.isRunning) {
            this.game.update(deltaTime);
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
