import {
    Vector2D,
    Sun,
    Building,
    StellarForge,
    SpaceDustParticle,
    GameState,
    Player,
    Asteroid,
    SubsidiaryFactory,
} from '../game-core';
import * as Constants from '../constants';

export interface EnvironmentRendererContext {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    camera: Vector2D;
    zoom: number;
    graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
    isFancyGraphicsEnabled: boolean;
    playerColor: string;
    enemyColor: string;
    viewingPlayer: Player | null;
    colorblindMode: boolean;

    // Coordinate transform
    worldToScreen(worldPos: Vector2D): Vector2D;
    isWithinViewBounds(worldPos: Vector2D, margin?: number): boolean;

    // Drawing helpers passed from GameRenderer
    getFactionColor(faction: any): string;
    getLadPlayerColor(player: any, ladSun: any, game: any): string;
    drawFancyBloom(screenPos: Vector2D, radius: number, color: string, intensity: number): void;
    getPseudoRandom(seed: number): number;

    // Gradient cache for color grading
    gradientCache: Map<string, CanvasGradient>;
}

export class EnvironmentRenderer {
    // Influence animation state (moved from GameRenderer)
    private influenceRadiusBySource: WeakMap<object, number> = new WeakMap();

    public drawSpaceDust(
        particle: SpaceDustParticle,
        game: GameState,
        viewingPlayerIndex: number | null,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, canvas, zoom, graphicsQuality, isFancyGraphicsEnabled } = context;
        const screenPos = context.worldToScreen(particle.position);

        // Early viewport culling - skip particles that are far off-screen
        const margin = 100; // pixels beyond viewport
        if (screenPos.x < -margin || screenPos.x > canvas.width + margin ||
            screenPos.y < -margin || screenPos.y > canvas.height + margin) {
            return;
        }

        const baseSize = Constants.DUST_PARTICLE_SIZE * zoom;
        const ladSun = game.suns.find(s => s.type === 'lad');

        // Check if particle is in shadow
        const inShadow = game.isPointInShadow(particle.position);

        if (viewingPlayerIndex !== null) {
            // If particle is in shade, only draw if it's visible to player's units
            if (inShadow) {
                const viewingPlayer = game.players[viewingPlayerIndex];
                const isVisible = game.isObjectVisibleToPlayer(particle.position, viewingPlayer);
                if (!isVisible) {
                    return; // Don't draw particles in shade that aren't in unit sight
                }
            }
        }

        const isHighGraphics = graphicsQuality === 'high' || graphicsQuality === 'ultra';
        let lightAngle: number | null = null;
        let sunProximity = 0;
        if (isHighGraphics && game.suns.length > 0 && !ladSun) {
            const maxDistance = Constants.DUST_SHADOW_MAX_DISTANCE_PX;
            let nearestSun: Sun | null = null;
            let nearestDistance = Infinity;

            // Find the nearest sun
            for (const sun of game.suns) {
                const distance = particle.position.distanceTo(sun.position);
                if (distance < nearestDistance) {
                    nearestSun = sun;
                    nearestDistance = distance;
                }
            }

            // Only calculate lighting if close enough to nearest sun
            if (nearestSun && nearestDistance > 0 && nearestDistance < maxDistance) {
                sunProximity = Math.max(0, 1 - Math.min(1, nearestDistance / maxDistance));
                if (sunProximity > 0) {
                    const dx = particle.position.x - nearestSun.position.x;
                    const dy = particle.position.y - nearestSun.position.y;
                    lightAngle = Math.atan2(dy, dx);
                }
            }
        }

        let glowLevel = particle.glowState;
        if (particle.glowTransition > 0 && particle.glowState !== particle.targetGlowState) {
            glowLevel = particle.glowState + (particle.targetGlowState - particle.glowState) * particle.glowTransition;
        }

        const isOnLightSide = ladSun ? particle.position.x < ladSun.position.x : false;
        const dustColor = ladSun ? (isOnLightSide ? '#000000' : '#FFFFFF') : particle.currentColor;

        if (ladSun) {
            glowLevel = 0;
        }

        const velocityX = particle.velocity.x;
        const velocityY = particle.velocity.y;
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (speed > Constants.DUST_TRAIL_MIN_SPEED_PX_PER_SEC) {
            const invSpeed = 1 / speed;
            const dirX = velocityX * invSpeed;
            const dirY = velocityY * invSpeed;
            const perpX = -dirY;
            const perpY = dirX;
            const trailLengthPx = Math.min(
                Constants.DUST_TRAIL_MAX_LENGTH_PX,
                Math.max(Constants.DUST_TRAIL_MIN_LENGTH_PX, speed * Constants.DUST_TRAIL_LENGTH_PER_SPEED)
            );
            const trailLength = trailLengthPx * zoom;
            const trailOffsetX = perpX * baseSize;
            const trailOffsetY = perpY * baseSize;
            const trailEndX = dirX * trailLength;
            const trailEndY = dirY * trailLength;
            const leftStartX = screenPos.x + trailOffsetX;
            const leftStartY = screenPos.y + trailOffsetY;
            const rightStartX = screenPos.x - trailOffsetX;
            const rightStartY = screenPos.y - trailOffsetY;
            const leftEndX = leftStartX - trailEndX;
            const leftEndY = leftStartY - trailEndY;
            const rightEndX = rightStartX - trailEndX;
            const rightEndY = rightStartY - trailEndY;

            ctx.lineWidth = Math.max(0.2, Constants.DUST_TRAIL_WIDTH_PX * zoom);
            if (isFancyGraphicsEnabled && dustColor.startsWith('#')) {
                let hex = dustColor.slice(1);
                if (hex.length === 3) {
                    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
                }
                const colorInt = parseInt(hex, 16);
                const trailR = (colorInt >> 16) & 0xff;
                const trailG = (colorInt >> 8) & 0xff;
                const trailB = colorInt & 0xff;
                const trailAlpha = 0.6;
                const leftGradient = ctx.createLinearGradient(leftStartX, leftStartY, leftEndX, leftEndY);
                leftGradient.addColorStop(0, `rgba(${trailR}, ${trailG}, ${trailB}, ${trailAlpha})`);
                leftGradient.addColorStop(1, `rgba(${trailR}, ${trailG}, ${trailB}, 0)`);
                ctx.strokeStyle = leftGradient;
                ctx.beginPath();
                ctx.moveTo(leftStartX, leftStartY);
                ctx.lineTo(leftEndX, leftEndY);
                ctx.stroke();

                const rightGradient = ctx.createLinearGradient(rightStartX, rightStartY, rightEndX, rightEndY);
                rightGradient.addColorStop(0, `rgba(${trailR}, ${trailG}, ${trailB}, ${trailAlpha})`);
                rightGradient.addColorStop(1, `rgba(${trailR}, ${trailG}, ${trailB}, 0)`);
                ctx.strokeStyle = rightGradient;
                ctx.beginPath();
                ctx.moveTo(rightStartX, rightStartY);
                ctx.lineTo(rightEndX, rightEndY);
                ctx.stroke();
            } else {
                ctx.strokeStyle = dustColor;
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                ctx.moveTo(leftStartX, leftStartY);
                ctx.lineTo(leftEndX, leftEndY);
                ctx.moveTo(rightStartX, rightStartY);
                ctx.lineTo(rightEndX, rightEndY);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        if (isHighGraphics && speed > Constants.DUST_SLOW_MOVEMENT_THRESHOLD) {
            const disturbanceBlend = Math.max(
                0,
                Math.min(
                    1,
                    (speed - Constants.DUST_SLOW_MOVEMENT_THRESHOLD)
                    / Math.max(0.001, Constants.DUST_FAST_MOVEMENT_THRESHOLD - Constants.DUST_SLOW_MOVEMENT_THRESHOLD)
                )
            );
            glowLevel = Math.max(glowLevel, 0.2 + disturbanceBlend * 0.55);
        }

        if (isHighGraphics && glowLevel > 0) {
            const glowSize = baseSize * (1.2 + glowLevel * 0.35);
            ctx.fillStyle = dustColor;
            ctx.globalAlpha = 0.15 + glowLevel * 0.1;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, glowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        if (isHighGraphics && isFancyGraphicsEnabled) {
            const bloomSize = baseSize * (1.6 + glowLevel * 0.6);
            const bloomIntensity = 0.25 + glowLevel * 0.2;
            context.drawFancyBloom(screenPos, bloomSize, dustColor, bloomIntensity);
        }

        ctx.fillStyle = dustColor;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, baseSize, 0, Math.PI * 2);
        ctx.fill();

        if (isHighGraphics && !inShadow && !ladSun && game.suns.length > 0) {
            const shadowAlphaScale = graphicsQuality === 'ultra' ? 1 : 0.72;
            this.drawParticleSunShadowTrail(particle.position, screenPos, baseSize, game.suns, Constants.DUST_SHADOW_MAX_DISTANCE_PX, 1, shadowAlphaScale, context);
        }

        if (isHighGraphics && lightAngle !== null && sunProximity > 0 && !inShadow) {
            const qualityFactor = graphicsQuality === 'ultra' ? 1.0 : 0.8;
            const sheenArc = Math.PI * 0.55;
            const litSheenAlpha = (0.08 + sunProximity * 0.12 + glowLevel * 0.09) * qualityFactor;
            ctx.strokeStyle = `rgba(255, 240, 185, ${Math.min(0.35, litSheenAlpha).toFixed(4)})`;
            ctx.lineWidth = Math.max(0.2, baseSize * 0.7);
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, baseSize * 0.92, lightAngle - sheenArc / 2, lightAngle + sheenArc / 2);
            ctx.stroke();

            const shadowAngle = lightAngle + Math.PI;
            const shadeAlpha = (0.1 + sunProximity * 0.12) * qualityFactor;
            ctx.strokeStyle = `rgba(0, 0, 10, ${Math.min(0.34, shadeAlpha).toFixed(4)})`;
            ctx.lineWidth = Math.max(0.22, baseSize * 0.85);
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, baseSize * 0.9, shadowAngle - sheenArc / 2, shadowAngle + sheenArc / 2);
            ctx.stroke();
        }
    }

    public drawAestheticSpriteShadow(
        worldPos: Vector2D,
        screenPos: Vector2D,
        screenSize: number,
        game: GameState,
        options: {
            opacity?: number;
            widthScale?: number;
            particleCount?: number;
            particleSpread?: number;
            spriteMask?: HTMLCanvasElement;
            spriteSize?: number;
            spriteRotation?: number;
        } | undefined,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, graphicsQuality } = context;
        if ((graphicsQuality !== 'high' && graphicsQuality !== 'ultra') || game.suns.length === 0) {
            return;
        }

        const ladSun = game.suns.find(s => s.type === 'lad');
        if (ladSun || game.isPointInShadow(worldPos)) {
            return;
        }

        const opacity = options?.opacity ?? 1;
        if (opacity <= 0) {
            return;
        }

        const alphaScale = graphicsQuality === 'ultra' ? 1 : 0.72;
        this.drawParticleSunShadowTrail(
            worldPos,
            screenPos,
            Math.max(1, screenSize),
            game.suns,
            Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
            opacity,
            alphaScale,
            context
        );

        const spriteMask = options?.spriteMask;
        const spriteSize = options?.spriteSize ?? screenSize;
        if (spriteMask && spriteSize > 0) {
            this.drawSpriteSunShadowSilhouette(
                worldPos,
                screenPos,
                spriteMask,
                spriteSize,
                options?.spriteRotation ?? 0,
                game.suns,
                opacity,
                alphaScale,
                context
            );
        }

        const particleCount = Math.max(0, options?.particleCount ?? 3);
        if (particleCount === 0) {
            return;
        }

        const spread = Math.max(screenSize * 0.4, options?.particleSpread ?? screenSize * 0.7);
        const particleRadius = Math.max(0.6, screenSize * 0.1);
        const widthScale = Math.max(0.35, options?.widthScale ?? 0.75);
        const time = performance.now() * 0.001;

        ctx.save();
        for (let i = 0; i < particleCount; i++) {
            const seed = worldPos.x * 0.013 + worldPos.y * 0.017 + i * 19.7;
            const baseAngle = context.getPseudoRandom(seed) * Math.PI * 2;
            const orbit = spread * (0.3 + context.getPseudoRandom(seed + 3.1) * 0.7);
            const drift = 0.65 + context.getPseudoRandom(seed + 7.2) * 0.75;
            const wobble = Math.sin(time * drift + seed) * spread * 0.14;
            const particleX = screenPos.x + Math.cos(baseAngle + time * 0.28) * (orbit + wobble);
            const particleY = screenPos.y + Math.sin(baseAngle + time * 0.22) * (orbit + wobble * 0.8);

            ctx.fillStyle = `rgba(6, 7, 16, ${(0.2 * opacity * alphaScale).toFixed(4)})`;
            ctx.beginPath();
            ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
            ctx.fill();

            this.drawParticleSunShadowTrail(
                worldPos,
                new Vector2D(particleX, particleY),
                particleRadius * widthScale,
                game.suns,
                Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX,
                opacity * 0.85,
                alphaScale,
                context
            );
        }
        ctx.restore();
    }

    public drawConnections(
        player: Player,
        suns: Sun[],
        asteroids: Asteroid[],
        players: Player[],
        context: EnvironmentRendererContext
    ): void {
        const { ctx, zoom } = context;
        if (!player.stellarForge) return;
        if (context.viewingPlayer && player !== context.viewingPlayer) return;

        // Draw lines from mirrors to sun and linked structures
        for (const mirror of player.solarMirrors) {
            if (!context.isWithinViewBounds(mirror.position, 120)) {
                continue;
            }
            const mirrorScreenPos = context.worldToScreen(mirror.position);
            const linkedStructure = mirror.getLinkedStructure(player.stellarForge);

            // Check line of sight to sun
            const hasLoSToSun = mirror.hasLineOfSightToLight(suns, asteroids);
            const closestSun = hasLoSToSun
                ? mirror.getClosestVisibleSun(suns, asteroids)
                : mirror.getClosestSun(suns);

            // Check line of sight to linked structure
            const hasLoSToTarget = linkedStructure
                ? mirror.hasLineOfSightToStructure(linkedStructure, asteroids, players)
                : false;

            // Draw line to sun only when blocked
            if (closestSun && !hasLoSToSun) {
                const sunScreenPos = context.worldToScreen(closestSun.position);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                ctx.lineTo(sunScreenPos.x, sunScreenPos.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw line to structure only when blocked
            if (linkedStructure && !hasLoSToTarget) {
                const targetScreenPos = context.worldToScreen(linkedStructure.position);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(mirrorScreenPos.x, mirrorScreenPos.y);
                ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw combined status indicator on the mirror
            if (hasLoSToSun && hasLoSToTarget) {
                // Both clear - draw bright yellow glow
                ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(mirrorScreenPos.x, mirrorScreenPos.y, Constants.MIRROR_ACTIVE_GLOW_RADIUS * zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    public updateInfluenceRadius(source: StellarForge | Building, deltaTimeSec: number): number {
        const targetRadius = this.isInfluenceSourceActive(source)
            ? this.getInfluenceTargetRadius(source)
            : 0;
        const currentRadius = this.influenceRadiusBySource.get(source) ?? 0;
        const interpolationFactor = Math.min(1, deltaTimeSec * Constants.INFLUENCE_RADIUS_ANIMATION_SPEED_PER_SEC);
        const nextRadius = currentRadius + (targetRadius - currentRadius) * interpolationFactor;
        this.influenceRadiusBySource.set(source, nextRadius);
        return nextRadius;
    }

    public drawMergedInfluenceOutlines(
        circles: Array<{ position: Vector2D; radius: number }>,
        color: string,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, canvas, camera, zoom } = context;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();

        const twoPi = Math.PI * 2;
        const coverageEpsilonWorld = 0.5;
        const coverageEpsilonSq = coverageEpsilonWorld * coverageEpsilonWorld;
        const dpr = window.devicePixelRatio || 1;
        const centerX = (canvas.width / dpr) / 2;
        const centerY = (canvas.height / dpr) / 2;
        const cameraX = camera.x;
        const cameraY = camera.y;
        const targetStepPx = 8;

        for (let i = 0; i < circles.length; i++) {
            const circle = circles[i];
            if (!context.isWithinViewBounds(circle.position, circle.radius)) {
                continue;
            }

            const originX = circle.position.x;
            const originY = circle.position.y;
            const radiusWorld = circle.radius;
            let isFullyCovered = false;
            let needsSampling = false;

            for (let j = 0; j < circles.length; j++) {
                if (i === j) continue;
                const other = circles[j];
                const dx = other.position.x - originX;
                const dy = other.position.y - originY;
                const distanceSq = dx * dx + dy * dy;
                const otherRadius = other.radius;
                if (distanceSq <= 0.0001) {
                    if (radiusWorld <= otherRadius) {
                        isFullyCovered = true;
                        break;
                    }
                    continue;
                }

                const distance = Math.sqrt(distanceSq);
                if (distance + radiusWorld <= otherRadius - coverageEpsilonWorld) {
                    isFullyCovered = true;
                    break;
                }

                const radiusDiff = Math.abs(radiusWorld - otherRadius);
                if (distance < radiusWorld + otherRadius - coverageEpsilonWorld &&
                    distance > radiusDiff + coverageEpsilonWorld) {
                    needsSampling = true;
                }
            }

            if (isFullyCovered) {
                continue;
            }

            const screenCenterX = centerX + (originX - cameraX) * zoom;
            const screenCenterY = centerY + (originY - cameraY) * zoom;
            const radiusScreen = radiusWorld * zoom;

            if (!needsSampling) {
                ctx.moveTo(screenCenterX + radiusScreen, screenCenterY);
                ctx.arc(screenCenterX, screenCenterY, radiusScreen, 0, twoPi);
                continue;
            }

            const stepRad = Math.min(0.25, Math.max(0.02, targetStepPx / Math.max(radiusScreen, 1)));
            let isDrawing = false;
            for (let angle = 0; angle <= twoPi + stepRad; angle += stepRad) {
                const clampedAngle = angle > twoPi ? twoPi : angle;
                const cosAngle = Math.cos(clampedAngle);
                const sinAngle = Math.sin(clampedAngle);
                const worldX = originX + cosAngle * radiusWorld;
                const worldY = originY + sinAngle * radiusWorld;

                let isCovered = false;
                for (let j = 0; j < circles.length; j++) {
                    if (i === j) continue;
                    const other = circles[j];
                    const dx = worldX - other.position.x;
                    const dy = worldY - other.position.y;
                    const distanceSq = dx * dx + dy * dy;
                    const otherRadiusSq = other.radius * other.radius;
                    if (distanceSq <= otherRadiusSq - coverageEpsilonSq) {
                        isCovered = true;
                        break;
                    }
                }

                if (isCovered) {
                    isDrawing = false;
                    continue;
                }

                const screenX = centerX + (worldX - cameraX) * zoom;
                const screenY = centerY + (worldY - cameraY) * zoom;
                if (!isDrawing) {
                    ctx.moveTo(screenX, screenY);
                    isDrawing = true;
                } else {
                    ctx.lineTo(screenX, screenY);
                }
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    public drawParticleSunShadowTrail(
        worldPos: Vector2D,
        screenPos: Vector2D,
        screenSize: number,
        suns: Sun[],
        maxDistance: number,
        opacity: number,
        alphaScale: number,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, zoom, graphicsQuality } = context;
        // Skip expensive shadow trail rendering on low quality
        if (graphicsQuality === 'low') {
            return;
        }

        for (const sun of suns) {
            const dx = worldPos.x - sun.position.x;
            const dy = worldPos.y - sun.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0 || distance >= maxDistance) {
                continue;
            }

            const invDistance = 1 / distance;
            const dirX = dx * invDistance;
            const dirY = dy * invDistance;
            const proximity = 1 - Math.max(0, Math.min(1, distance / maxDistance));
            const shadowLength = Math.max(
                screenSize * 2.4,
                Constants.DUST_SHADOW_LENGTH_PX * zoom * (0.9 + proximity * 0.8)
            );
            const tailX = screenPos.x + dirX * shadowLength;
            const tailY = screenPos.y + dirY * shadowLength;
            const gradient = ctx.createLinearGradient(screenPos.x, screenPos.y, tailX, tailY);
            gradient.addColorStop(0, `rgba(2, 3, 10, ${(0.34 * Constants.DUST_SHADOW_OPACITY * opacity * alphaScale).toFixed(4)})`);
            gradient.addColorStop(0.55, `rgba(2, 3, 10, ${(0.16 * Constants.DUST_SHADOW_OPACITY * opacity * alphaScale).toFixed(4)})`);
            gradient.addColorStop(1, 'rgba(2, 3, 10, 0)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = Math.max(0.35, screenSize * (0.7 + proximity * 0.65));
            ctx.beginPath();
            ctx.moveTo(screenPos.x, screenPos.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
        }
    }

    public drawSpriteSunShadowSilhouette(
        worldPos: Vector2D,
        screenPos: Vector2D,
        spriteMask: HTMLCanvasElement,
        spriteSize: number,
        rotationRad: number,
        suns: Sun[],
        opacity: number,
        alphaScale: number,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, zoom, graphicsQuality } = context;
        const blurPx = Math.max(1.4, spriteSize * 0.08);

        for (const sun of suns) {
            const dx = worldPos.x - sun.position.x;
            const dy = worldPos.y - sun.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 0 || distance >= Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX) {
                continue;
            }

            const invDistance = 1 / distance;
            const dirX = dx * invDistance;
            const dirY = dy * invDistance;
            const proximity = 1 - Math.max(0, Math.min(1, distance / Constants.DUST_SHADOW_FAR_MAX_DISTANCE_PX));
            const maxOffset = Math.max(
                spriteSize * 0.75,
                Constants.DUST_SHADOW_LENGTH_PX * zoom * (0.32 + proximity * 0.28)
            );

            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            // Skip expensive blur filter on low quality
            if (graphicsQuality !== 'low') {
                ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
            }

            const shadowLayers = 3;
            for (let i = 0; i < shadowLayers; i++) {
                const t = (i + 1) / shadowLayers;
                const offset = maxOffset * t;
                const alpha = (0.2 * (1 - t * 0.38) * opacity * alphaScale);
                if (alpha <= 0) {
                    continue;
                }
                const drawX = screenPos.x + dirX * offset;
                const drawY = screenPos.y + dirY * offset;

                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(rotationRad);
                ctx.globalAlpha = alpha;
                ctx.drawImage(
                    spriteMask,
                    -spriteSize / 2,
                    -spriteSize / 2,
                    spriteSize,
                    spriteSize
                );
                ctx.restore();
            }

            ctx.restore();
        }
    }

    public drawInfluenceCircle(
        position: Vector2D,
        radius: number,
        color: string,
        context: EnvironmentRendererContext
    ): void {
        const { ctx, zoom } = context;
        const screenPos = context.worldToScreen(position);
        const screenRadius = radius * zoom;

        // Draw outer ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    public getInfluenceTargetRadius(source: StellarForge | Building): number {
        if (source instanceof StellarForge || source instanceof SubsidiaryFactory) {
            return Constants.INFLUENCE_RADIUS;
        }
        return Constants.INFLUENCE_RADIUS * Constants.BUILDING_INFLUENCE_RADIUS_MULTIPLIER;
    }

    public isInfluenceSourceActive(source: StellarForge | Building): boolean {
        if (source.health <= 0) {
            return false;
        }
        if (source instanceof StellarForge) {
            return source.isReceivingLight;
        }
        return true;
    }

    /**
     * Apply warm/cool color grading for ultra-quality mode.
     * Adds a cool vignette and warm sun bloom using multiply/screen compositing.
     */
    public applyUltraWarmCoolGrade(game: GameState, context: EnvironmentRendererContext): void {
        const { ctx, canvas, graphicsQuality, gradientCache, worldToScreen } = context;

        if (graphicsQuality === 'low') {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';

        const coolKey = `cool-vignette-${Math.round(width / 50)}-${Math.round(height / 50)}`;
        let coolVignette = gradientCache.get(coolKey) as CanvasGradient | undefined;
        if (!coolVignette) {
            coolVignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.85);
            coolVignette.addColorStop(0, 'rgba(255, 255, 255, 1)');
            coolVignette.addColorStop(1, 'rgba(138, 155, 210, 0.94)');
            gradientCache.set(coolKey, coolVignette);
        }
        ctx.fillStyle = coolVignette;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'screen';
        for (const sun of game.suns) {
            if (sun.type === 'lad') {
                continue;
            }
            const sunScreenPos = worldToScreen(sun.position);

            const maxDimension = Math.max(width, height);
            const warmKey = `warm-gradient-${Math.round(maxDimension / 100)}`;
            let warmGradient = gradientCache.get(warmKey) as CanvasGradient | undefined;
            if (!warmGradient) {
                warmGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, maxDimension * 0.45);
                warmGradient.addColorStop(0, 'rgba(255, 178, 74, 0.28)');
                warmGradient.addColorStop(0.34, 'rgba(255, 148, 62, 0.18)');
                warmGradient.addColorStop(1, 'rgba(255, 112, 46, 0)');
                gradientCache.set(warmKey, warmGradient);
            }

            ctx.save();
            ctx.translate(sunScreenPos.x, sunScreenPos.y);
            ctx.fillStyle = warmGradient;
            ctx.fillRect(-sunScreenPos.x, -sunScreenPos.y, width, height);
            ctx.restore();
        }

        ctx.restore();
    }
}
