/**
 * Game Renderer - Handles visualization on HTML5 Canvas
 */

import { GameState, Player, SolarMirror, StellarForge, Sun, Vector2D, Faction, SpaceDustParticle, WarpGate, Asteroid, LightRay, Unit, Marine, Grave, GraveProjectile, MuzzleFlash, BulletCasing, BouncingBullet, AbilityBullet } from './game-core';
import * as Constants from './constants';

export class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public camera: Vector2D = new Vector2D(0, 0);
    public zoom: number = 1.0;
    public selectionStart: Vector2D | null = null;
    public selectionEnd: Vector2D | null = null;
    public selectedUnits: Set<Unit> = new Set();

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
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): Vector2D {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return new Vector2D(
            this.camera.x + (screenX - centerX) / this.zoom,
            this.camera.y + (screenY - centerY) / this.zoom
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
     * Draw space dust particle
     */
    private drawSpaceDust(particle: SpaceDustParticle): void {
        const screenPos = this.worldToScreen(particle.position);
        const size = Constants.DUST_PARTICLE_SIZE * this.zoom;

        this.ctx.fillStyle = particle.currentColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw an asteroid
     */
    private drawAsteroid(asteroid: Asteroid): void {
        const worldVertices = asteroid.getWorldVertices();
        if (worldVertices.length === 0) return;

        const screenVertices = worldVertices.map(v => this.worldToScreen(v));

        // Draw asteroid body
        this.ctx.fillStyle = '#666666';
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            this.ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Draw sun rays with raytracing (brightens field and casts shadows)
     */
    private drawSunRays(game: GameState): void {
        // Draw ambient lighting layer
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height)
        );
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw asteroid shadows cast by sunlight
        for (const sun of game.suns) {
            // Draw shadow regions behind asteroids
            for (const asteroid of game.asteroids) {
                const worldVertices = asteroid.getWorldVertices();
                
                // For each edge of the asteroid, cast a shadow
                for (let i = 0; i < worldVertices.length; i++) {
                    const v1 = worldVertices[i];
                    const v2 = worldVertices[(i + 1) % worldVertices.length];
                    
                    // Calculate if this edge faces away from the sun
                    const edgeCenter = new Vector2D((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
                    const toSun = new Vector2D(sun.position.x - edgeCenter.x, sun.position.y - edgeCenter.y);
                    const edgeNormal = new Vector2D(-(v2.y - v1.y), v2.x - v1.x);
                    const dot = toSun.x * edgeNormal.x + toSun.y * edgeNormal.y;
                    
                    if (dot < 0) {
                        // This edge is facing away from the sun, cast shadow
                        const dirFromSun1 = new Vector2D(v1.x - sun.position.x, v1.y - sun.position.y).normalize();
                        const dirFromSun2 = new Vector2D(v2.x - sun.position.x, v2.y - sun.position.y).normalize();
                        
                        const shadow1 = new Vector2D(v1.x + dirFromSun1.x * Constants.SHADOW_LENGTH, v1.y + dirFromSun1.y * Constants.SHADOW_LENGTH);
                        const shadow2 = new Vector2D(v2.x + dirFromSun2.x * Constants.SHADOW_LENGTH, v2.y + dirFromSun2.y * Constants.SHADOW_LENGTH);
                        
                        const sv1 = this.worldToScreen(v1);
                        const sv2 = this.worldToScreen(v2);
                        const ss1 = this.worldToScreen(shadow1);
                        const ss2 = this.worldToScreen(shadow2);
                        
                        // Draw shadow polygon
                        this.ctx.fillStyle = 'rgba(0, 0, 20, 0.5)';
                        this.ctx.beginPath();
                        this.ctx.moveTo(sv1.x, sv1.y);
                        this.ctx.lineTo(sv2.x, sv2.y);
                        this.ctx.lineTo(ss2.x, ss2.y);
                        this.ctx.lineTo(ss1.x, ss1.y);
                        this.ctx.closePath();
                        this.ctx.fill();
                    }
                }
            }
        }
    }

    /**
     * Draw influence circle for a base
     */
    private drawInfluenceCircle(position: Vector2D, radius: number, color: string): void {
        const screenPos = this.worldToScreen(position);
        const screenRadius = radius * this.zoom;

        // Draw outer ring
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a warp gate
     */
    private drawWarpGate(gate: WarpGate): void {
        const screenPos = this.worldToScreen(gate.position);
        const maxRadius = Constants.WARP_GATE_RADIUS * this.zoom;
        const chargeProgress = gate.chargeTime / Constants.WARP_GATE_CHARGE_TIME;
        const currentRadius = Math.min(maxRadius, chargeProgress * maxRadius);

        if (!gate.isComplete) {
            // Draw charging effect
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.5 + Math.sin(gate.chargeTime * 5) * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, currentRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;

            // Draw charge progress
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, currentRadius + 5, 0, chargeProgress * Math.PI * 2);
            this.ctx.stroke();
        } else {
            // Draw completed warp gate
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, maxRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, maxRadius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw 4 build buttons around the gate
            const buttonRadius = Constants.WARP_GATE_BUTTON_RADIUS * this.zoom;
            const buttonDistance = maxRadius + Constants.WARP_GATE_BUTTON_OFFSET * this.zoom;
            const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
            
            for (let i = 0; i < 4; i++) {
                const angle = angles[i];
                const btnX = screenPos.x + Math.cos(angle) * buttonDistance;
                const btnY = screenPos.y + Math.sin(angle) * buttonDistance;

                this.ctx.fillStyle = '#444444';
                this.ctx.strokeStyle = '#00FFFF';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(btnX, btnY, buttonRadius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();

                // Draw button icon (placeholder)
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = `${12 * this.zoom}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(`B${i + 1}`, btnX, btnY);
            }
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Draw a unit
     */
    private drawUnit(unit: Unit, color: string): void {
        const screenPos = this.worldToScreen(unit.position);
        const size = 8 * this.zoom;
        const isSelected = this.selectedUnits.has(unit);

        // Draw selection indicator for selected units
        if (isSelected) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size + 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Draw unit body (circle)
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = isSelected ? '#00FF00' : '#FFFFFF';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw health bar
        const barWidth = size * 3;
        const barHeight = 3;
        const barX = screenPos.x - barWidth / 2;
        const barY = screenPos.y - size - 8;
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const healthPercent = unit.health / unit.maxHealth;
        this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
        this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Draw direction indicator if unit has a target
        if (unit.target) {
            const dx = unit.target.position.x - unit.position.x;
            const dy = unit.target.position.y - unit.position.y;
            const angle = Math.atan2(dy, dx);
            
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, screenPos.y);
            this.ctx.lineTo(
                screenPos.x + Math.cos(angle) * size * 1.5,
                screenPos.y + Math.sin(angle) * size * 1.5
            );
            this.ctx.stroke();
        }
    }

    /**
     * Draw a muzzle flash
     */
    private drawMuzzleFlash(flash: MuzzleFlash): void {
        const screenPos = this.worldToScreen(flash.position);
        const size = 5 * this.zoom;
        const opacity = 1.0 - (flash.lifetime / flash.maxLifetime);

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(flash.angle);
        
        // Draw flash as a bright yellow oval
        this.ctx.fillStyle = `rgba(255, 255, 100, ${opacity})`;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, size * 2, size, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    /**
     * Draw a bullet casing
     */
    private drawBulletCasing(casing: BulletCasing): void {
        const screenPos = this.worldToScreen(casing.position);
        const width = 3 * this.zoom;
        const height = 5 * this.zoom;
        const opacity = 1.0 - (casing.lifetime / casing.maxLifetime);

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(casing.rotation);
        
        // Draw casing as a yellow rectangle
        this.ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
        this.ctx.fillRect(-width / 2, -height / 2, width, height);
        
        this.ctx.restore();
    }

    /**
     * Draw a bouncing bullet
     */
    private drawBouncingBullet(bullet: BouncingBullet): void {
        const screenPos = this.worldToScreen(bullet.position);
        const size = 3 * this.zoom;
        const opacity = 1.0 - (bullet.lifetime / bullet.maxLifetime);

        // Draw bullet as a yellow circle
        this.ctx.fillStyle = `rgba(255, 255, 0, ${opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw an ability bullet
     */
    private drawAbilityBullet(bullet: AbilityBullet): void {
        const screenPos = this.worldToScreen(bullet.position);
        const size = 4 * this.zoom;
        const opacity = 1.0 - (bullet.lifetime / bullet.maxLifetime);

        // Draw bullet with owner's faction color
        const color = this.getFactionColor(bullet.owner.faction);
        this.ctx.fillStyle = `${color}`;
        this.ctx.globalAlpha = opacity;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a Grave unit with its orbiting projectiles
     */
    private drawGrave(grave: Grave, color: string): void {
        // Draw the base unit
        this.drawUnit(grave, color);
        
        // Draw a distinctive grave symbol
        const screenPos = this.worldToScreen(grave.position);
        const size = 10 * this.zoom;
        
        // Draw cross symbol
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2 * this.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x, screenPos.y - size);
        this.ctx.lineTo(screenPos.x, screenPos.y + size);
        this.ctx.moveTo(screenPos.x - size * 0.7, screenPos.y - size * 0.3);
        this.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y - size * 0.3);
        this.ctx.stroke();
        
        // Draw projectiles
        for (const projectile of grave.getProjectiles()) {
            this.drawGraveProjectile(projectile, color);
        }
    }

    /**
     * Draw a Grave projectile with trail
     */
    private drawGraveProjectile(projectile: GraveProjectile, color: string): void {
        const screenPos = this.worldToScreen(projectile.position);
        const size = 4 * this.zoom;
        
        // Draw trail if attacking
        if (projectile.isAttacking && projectile.trail.length > 1) {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2 * this.zoom;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            
            for (let i = 0; i < projectile.trail.length; i++) {
                const trailPos = this.worldToScreen(projectile.trail[i]);
                if (i === 0) {
                    this.ctx.moveTo(trailPos.x, trailPos.y);
                } else {
                    this.ctx.lineTo(trailPos.x, trailPos.y);
                }
            }
            
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw projectile as a circle
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1 * this.zoom;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Add a glow effect when attacking
        if (projectile.isAttacking) {
            this.ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw connection lines with visual indicators for line of sight
     */
    private drawConnections(player: Player, suns: Sun[], asteroids: Asteroid[]): void {
        if (!player.stellarForge) return;

        const forgeScreenPos = this.worldToScreen(player.stellarForge.position);

        // Draw lines from mirrors to sun and forge
        for (const mirror of player.solarMirrors) {
            const mirrorScreenPos = this.worldToScreen(mirror.position);
            
            // Check line of sight to sun
            const hasLoSToSun = mirror.hasLineOfSightToLight(suns, asteroids);
            const closestSun = mirror.getClosestVisibleSun(suns, asteroids);
            
            // Check line of sight to forge
            const hasLoSToForge = mirror.hasLineOfSightToForge(player.stellarForge, asteroids);
            
            // Draw line to sun (green if clear, red if blocked)
            if (closestSun) {
                const sunScreenPos = this.worldToScreen(closestSun.position);
                this.ctx.strokeStyle = hasLoSToSun ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                this.ctx.lineTo(sunScreenPos.x, sunScreenPos.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Draw line to forge (blue if clear, red if blocked)
            this.ctx.strokeStyle = hasLoSToForge ? 'rgba(0, 150, 255, 0.4)' : 'rgba(255, 0, 0, 0.4)';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
            this.ctx.lineTo(forgeScreenPos.x, forgeScreenPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw combined status indicator on the mirror
            if (hasLoSToSun && hasLoSToForge) {
                // Both clear - draw bright yellow glow
                this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(mirrorScreenPos.x, mirrorScreenPos.y, Constants.MIRROR_ACTIVE_GLOW_RADIUS * this.zoom, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Draw UI overlay
     */
    private drawUI(game: GameState): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 300, 200);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`SoL - Speed of Light RTS`, 20, 30);
        this.ctx.fillText(`Game Time: ${game.gameTime.toFixed(1)}s`, 20, 50);
        this.ctx.fillText(`Dust Particles: ${game.spaceDust.length}`, 20, 70);
        this.ctx.fillText(`Asteroids: ${game.asteroids.length}`, 20, 90);
        this.ctx.fillText(`Warp Gates: ${game.warpGates.length}`, 20, 110);

        let y = 140;
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
        this.ctx.fillRect(10, this.canvas.height - 100, 450, 90);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Controls: Drag to select units', 20, this.canvas.height - 75);
        this.ctx.fillText('Pan: WASD/Arrows or mouse edge or two-finger drag', 20, this.canvas.height - 55);
        this.ctx.fillText('Zoom: Scroll/Pinch (zooms toward cursor)', 20, this.canvas.height - 35);
        this.ctx.fillText('Hold still 6 seconds in influence to open warp gate', 20, this.canvas.height - 15);
    }

    /**
     * Draw selection rectangle
     */
    private drawSelectionRectangle(): void {
        if (!this.selectionStart || !this.selectionEnd) return;

        const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
        const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

        // Draw selection rectangle
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw filled background
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.setLineDash([]);
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

        // Draw space dust particles
        for (const particle of game.spaceDust) {
            this.drawSpaceDust(particle);
        }

        // Draw suns
        for (const sun of game.suns) {
            this.drawSun(sun);
        }

        // Draw sun rays with raytracing (light and shadows)
        this.drawSunRays(game);

        // Draw asteroids
        for (const asteroid of game.asteroids) {
            this.drawAsteroid(asteroid);
        }

        // Draw influence circles
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            if (player.stellarForge && !player.isDefeated()) {
                const color = i === 0 ? Constants.PLAYER_1_COLOR : Constants.PLAYER_2_COLOR;
                this.drawInfluenceCircle(player.stellarForge.position, Constants.INFLUENCE_RADIUS, color);
            }
        }

        // Draw connections first (so they appear behind structures)
        for (const player of game.players) {
            if (!player.isDefeated()) {
                this.drawConnections(player, game.suns, game.asteroids);
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

        // Draw warp gates
        for (const gate of game.warpGates) {
            this.drawWarpGate(gate);
        }

        // Draw units
        for (const player of game.players) {
            if (player.isDefeated()) continue;
            
            const color = this.getFactionColor(player.faction);
            for (const unit of player.units) {
                if (unit instanceof Grave) {
                    this.drawGrave(unit, color);
                } else {
                    this.drawUnit(unit, color);
                }
            }
        }

        // Draw muzzle flashes
        for (const flash of game.muzzleFlashes) {
            this.drawMuzzleFlash(flash);
        }

        // Draw bullet casings
        for (const casing of game.bulletCasings) {
            this.drawBulletCasing(casing);
        }

        // Draw bouncing bullets
        for (const bullet of game.bouncingBullets) {
            this.drawBouncingBullet(bullet);
        }

        // Draw ability bullets
        for (const bullet of game.abilityBullets) {
            this.drawAbilityBullet(bullet);
        }

        // Draw UI
        this.drawUI(game);

        // Draw selection rectangle
        this.drawSelectionRectangle();

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
