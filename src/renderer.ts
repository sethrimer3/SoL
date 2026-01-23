/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction } from './game-core';

export class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public camera: Vector2D = new Vector2D(0, 0);
    public zoom: number = 1.0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = context;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private resizeCanvas(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    private worldToScreen(worldPos: Vector2D): Vector2D {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return new Vector2D(
            centerX + (worldPos.x - this.camera.x) * this.zoom,
            centerY + (worldPos.y - this.camera.y) * this.zoom
        );
    }

    /**
     * Get faction color
     */
    private getFactionColor(faction: Faction): string {
        switch (faction) {
            case Faction.RADIANT:
                return '#FFD700'; // Gold
            case Faction.AURUM:
                return '#DAA520'; // Goldenrod
            case Faction.SOLARI:
                return '#FF8C00'; // Dark orange
            default:
                return '#FFFFFF';
        }
    }

    /**
     * Draw a sun
     */
    private drawSun(sun: Sun): void {
        const screenPos = this.worldToScreen(sun.position);
        const screenRadius = sun.radius * this.zoom;

        // Draw sun glow
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 150, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw sun core
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw a Stellar Forge
     */
    private drawStellarForge(forge: StellarForge, color: string): void {
        const screenPos = this.worldToScreen(forge.position);
        const size = 40 * this.zoom;

        // Draw base structure
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = forge.isReceivingLight ? '#00FF00' : '#FF0000';
        this.ctx.lineWidth = 3;
        
        // Draw as a hexagon
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = screenPos.x + size * Math.cos(angle);
            const y = screenPos.y + size * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw health bar
        const barWidth = size * 2;
        const barHeight = 6;
        const barX = screenPos.x - barWidth / 2;
        const barY = screenPos.y - size - 15;
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const healthPercent = forge.health / 1000.0;
        this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
        this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }

    /**
     * Draw a Solar Mirror
     */
    private drawSolarMirror(mirror: SolarMirror, color: string): void {
        const screenPos = this.worldToScreen(mirror.position);
        const size = 20 * this.zoom;

        // Draw mirror
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        
        // Draw as a diamond
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - size);
        this.ctx.lineTo(screenPos.x + size, screenPos.y);
        this.ctx.lineTo(screenPos.x, screenPos.y + size);
        this.ctx.lineTo(screenPos.x - size, screenPos.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw efficiency indicator
        if (mirror.efficiency < 1.0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw connection lines
     */
    private drawConnections(player: Player, suns: Sun[]): void {
        if (!player.stellarForge) return;

        const forgeScreenPos = this.worldToScreen(player.stellarForge.position);

        // Draw lines from mirrors to forge
        for (const mirror of player.solarMirrors) {
            if (mirror.hasLineOfSightToLight(suns) && 
                mirror.hasLineOfSightToForge(player.stellarForge, [])) {
                const mirrorScreenPos = this.worldToScreen(mirror.position);
                
                this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                this.ctx.lineTo(forgeScreenPos.x, forgeScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }
    }

    /**
     * Draw UI overlay
     */
    private drawUI(game: GameState): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 300, 150);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`SoL - Speed of Light RTS`, 20, 30);
        this.ctx.fillText(`Game Time: ${game.gameTime.toFixed(1)}s`, 20, 50);

        let y = 80;
        for (const player of game.players) {
            const color = this.getFactionColor(player.faction);
            this.ctx.fillStyle = color;
            this.ctx.fillText(`${player.name} (${player.faction})`, 20, y);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(`Solarium: ${player.solarium.toFixed(1)}`, 20, y + 20);
            
            if (player.stellarForge) {
                const status = player.stellarForge.isReceivingLight ? '✓ Light' : '✗ No Light';
                this.ctx.fillText(`${status} | HP: ${player.stellarForge.health.toFixed(0)}`, 20, y + 40);
            }
            
            y += 60;
        }

        // Draw controls help
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, this.canvas.height - 60, 300, 50);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Controls: Touch/Click to interact', 20, this.canvas.height - 35);
        this.ctx.fillText('Scroll/Pinch to zoom', 20, this.canvas.height - 15);
    }

    /**
     * Render the entire game state
     */
    render(game: GameState): void {
        // Clear canvas
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars background
        this.ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 100; i++) {
            const x = (i * 137.5) % this.canvas.width;
            const y = (i * 217.3) % this.canvas.height;
            const size = (i % 3) * 0.5 + 0.5;
            this.ctx.fillRect(x, y, size, size);
        }

        // Draw suns
        for (const sun of game.suns) {
            this.drawSun(sun);
        }

        // Draw connections first (so they appear behind structures)
        for (const player of game.players) {
            if (!player.isDefeated()) {
                this.drawConnections(player, game.suns);
            }
        }

        // Draw structures
        for (const player of game.players) {
            if (player.isDefeated()) continue;

            const color = this.getFactionColor(player.faction);

            // Draw Solar Mirrors
            for (const mirror of player.solarMirrors) {
                this.drawSolarMirror(mirror, color);
            }

            // Draw Stellar Forge
            if (player.stellarForge) {
                this.drawStellarForge(player.stellarForge, color);
            }
        }

        // Draw UI
        this.drawUI(game);

        // Check for victory
        const winner = game.checkVictoryConditions();
        if (winner) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = this.getFactionColor(winner.faction);
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${winner.name} WINS!`, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.textAlign = 'left';
        }
    }

    /**
     * Set camera zoom
     */
    setZoom(zoom: number): void {
        this.zoom = Math.max(0.5, Math.min(2.0, zoom));
    }

    /**
     * Set camera position
     */
    setCameraPosition(pos: Vector2D): void {
        this.camera = pos;
    }
}
