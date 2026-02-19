/**
 * Asteroid Renderer - Handles asteroid visualization with Delaunay triangulation
 * 
 * This module encapsulates all asteroid rendering logic including:
 * - Delaunay triangulation for faceted appearance
 * - Dynamic lighting with rim highlights and shadows
 * - Quality-based rendering optimizations
 * - Geometric transformations and caching
 */

import { Asteroid, Sun, Vector2D } from '../game-core';
import * as Constants from '../constants';
import { ColorScheme } from '../menu';
import { adjustColorBrightness } from './color-utilities';

/**
 * Represents a single triangular facet on an asteroid's surface
 */
export type AsteroidFacet = {
    points: [Vector2D, Vector2D, Vector2D];
    centroidLocal: Vector2D;
};

/**
 * Cached rendering data for an asteroid
 */
export type AsteroidRenderCache = {
    facets: AsteroidFacet[];
    facetCount: number;
};

/**
 * AsteroidRenderer class - Manages asteroid visualization
 * 
 * Uses dependency injection pattern for renderer integration:
 * - Accepts canvas context, coordinate transforms, and styling as parameters
 * - Maintains internal cache for generated facets
 * - Zero dependencies on main renderer instance
 */
export class AsteroidRenderer {
    // Constants for rim lighting effects
    private readonly ASTEROID_RIM_HIGHLIGHT_WIDTH = 5;
    private readonly ASTEROID_RIM_SHADOW_WIDTH = 4;

    // Cache for generated asteroid facets (Delaunay triangulation is expensive)
    private asteroidRenderCache = new WeakMap<Asteroid, AsteroidRenderCache>();

    /**
     * Draw a single asteroid with dynamic lighting and Delaunay triangulation
     * 
     * @param ctx - Canvas rendering context
     * @param asteroid - Asteroid to render
     * @param suns - Array of suns for lighting calculation
     * @param zoom - Current zoom level
     * @param graphicsQuality - Quality setting ('low' | 'medium' | 'high' | 'ultra')
     * @param colorScheme - Color scheme for asteroid colors
     * @param worldToScreen - Function to convert world coordinates to screen coordinates
     * @param interpolateHexColor - Function to interpolate between hex colors
     */
    public drawAsteroid(
        ctx: CanvasRenderingContext2D,
        asteroid: Asteroid,
        suns: Sun[],
        zoom: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        colorScheme: ColorScheme,
        worldToScreen: (worldPos: Vector2D) => Vector2D,
        interpolateHexColor: (color1: string, color2: string, t: number) => string
    ): void {
        const worldVertices = asteroid.getWorldVertices();
        if (worldVertices.length === 0) return;

        const screenVertices = worldVertices.map(v => worldToScreen(v));
        const sizeRange = Constants.ASTEROID_MAX_SIZE - Constants.ASTEROID_MIN_SIZE;
        const sizeT = sizeRange > 0
            ? Math.min(1, Math.max(0, (asteroid.size - Constants.ASTEROID_MIN_SIZE) / sizeRange))
            : 0;
        const asteroidFill = interpolateHexColor(
            colorScheme.asteroidColors.fillStart,
            colorScheme.asteroidColors.fillEnd,
            sizeT
        );
        const asteroidStroke = interpolateHexColor(
            colorScheme.asteroidColors.strokeStart,
            colorScheme.asteroidColors.strokeEnd,
            sizeT
        );

        const lightDirection = this.getAsteroidLightDirection(asteroid, suns);
        this.drawAsteroidFacets(
            ctx,
            asteroid,
            lightDirection,
            asteroidFill,
            asteroidStroke,
            screenVertices,
            worldToScreen,
            interpolateHexColor
        );
        this.drawAsteroidRimLighting(
            ctx,
            worldVertices,
            screenVertices,
            lightDirection,
            asteroid.size,
            zoom,
            graphicsQuality,
            worldToScreen
        );
    }

    /**
     * Calculate light direction for asteroid lighting
     * Uses closest sun as primary light source
     */
    private getAsteroidLightDirection(asteroid: Asteroid, suns: Sun[]): Vector2D {
        if (suns.length === 0) {
            return new Vector2D(1, -0.2);
        }

        let closestSun = suns[0];
        let closestDistanceSq = Infinity;
        for (const sun of suns) {
            const dx = sun.position.x - asteroid.position.x;
            const dy = sun.position.y - asteroid.position.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestSun = sun;
            }
        }

        const toSun = new Vector2D(
            closestSun.position.x - asteroid.position.x,
            closestSun.position.y - asteroid.position.y
        );
        return toSun.normalize();
    }

    /**
     * Draw asteroid facets using Delaunay triangulation with Lambert shading
     */
    private drawAsteroidFacets(
        ctx: CanvasRenderingContext2D,
        asteroid: Asteroid,
        lightDirection: Vector2D,
        asteroidFill: string,
        asteroidStroke: string,
        screenVertices: Vector2D[],
        worldToScreen: (worldPos: Vector2D) => Vector2D,
        interpolateHexColor: (color1: string, color2: string, t: number) => string
    ): void {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let vertexIndex = 1; vertexIndex < screenVertices.length; vertexIndex++) {
            ctx.lineTo(screenVertices[vertexIndex].x, screenVertices[vertexIndex].y);
        }
        ctx.closePath();
        // Fill the full silhouette first so omitted edge facets do not reveal
        // transparent triangle gaps around the asteroid perimeter.
        ctx.fillStyle = asteroidFill;
        ctx.fill();
        ctx.clip();

        const asteroidRenderCache = this.getAsteroidRenderCache(asteroid);
        const rotationCos = Math.cos(asteroid.rotation);
        const rotationSin = Math.sin(asteroid.rotation);

        const minProjection = -asteroid.size * 1.4;
        const maxProjection = asteroid.size * 1.4;
        const projectionSpan = Math.max(0.0001, maxProjection - minProjection);
        const shadowHex = '#4A3218';
        const midToneHex = '#C48A2C';
        const lightHex = '#F6C65B';

        for (let i = 0; i < asteroidRenderCache.facets.length; i++) {
            const facet = asteroidRenderCache.facets[i];
            const worldA = this.rotateAndTranslateLocalPoint(facet.points[0], asteroid, rotationCos, rotationSin);
            const worldB = this.rotateAndTranslateLocalPoint(facet.points[1], asteroid, rotationCos, rotationSin);
            const worldC = this.rotateAndTranslateLocalPoint(facet.points[2], asteroid, rotationCos, rotationSin);

            const centroidWorld = this.rotateAndTranslateLocalPoint(facet.centroidLocal, asteroid, rotationCos, rotationSin);
            const pseudoNormal = new Vector2D(
                centroidWorld.x - asteroid.position.x,
                centroidWorld.y - asteroid.position.y
            ).normalize();
            const lambert = Math.max(0, pseudoNormal.x * lightDirection.x + pseudoNormal.y * lightDirection.y);
            const projection = (centroidWorld.x - asteroid.position.x) * lightDirection.x
                + (centroidWorld.y - asteroid.position.y) * lightDirection.y;
            const normalizedProjection = Math.min(1, Math.max(0, (projection - minProjection) / projectionSpan));
            const directionalBrightness = 0.35 + 0.65 * normalizedProjection;
            const brightness = directionalBrightness * (0.8 + lambert * 0.2);
            const coolShadowShift = Math.min(1, Math.max(0, 1 - brightness));

            let facetColor = brightness < 0.56
                ? interpolateHexColor(shadowHex, midToneHex, brightness / 0.56)
                : interpolateHexColor(midToneHex, lightHex, (brightness - 0.56) / 0.44);
            facetColor = interpolateHexColor(facetColor, '#35293D', coolShadowShift * 0.08);
            const facetStrokeColor = adjustColorBrightness(facetColor, 0.8);

            const screenA = worldToScreen(worldA);
            const screenB = worldToScreen(worldB);
            const screenC = worldToScreen(worldC);

            ctx.fillStyle = facetColor;
            ctx.strokeStyle = facetStrokeColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(screenA.x, screenA.y);
            ctx.lineTo(screenB.x, screenB.y);
            ctx.lineTo(screenC.x, screenC.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();

        ctx.strokeStyle = asteroidStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    /**
     * Draw rim lighting effects on asteroid edges
     * Adds highlights on sun-facing edges and shadows on opposite edges
     */
    private drawAsteroidRimLighting(
        ctx: CanvasRenderingContext2D,
        worldVertices: Vector2D[],
        screenVertices: Vector2D[],
        lightDirection: Vector2D,
        asteroidSize: number,
        zoom: number,
        graphicsQuality: 'low' | 'medium' | 'high' | 'ultra',
        worldToScreen: (worldPos: Vector2D) => Vector2D
    ): void {
        // Skip expensive per-vertex rim lighting on low quality
        if (graphicsQuality === 'low') {
            return;
        }

        const centerWorld = new Vector2D(
            worldVertices.reduce((sum, vertex) => sum + vertex.x, 0) / worldVertices.length,
            worldVertices.reduce((sum, vertex) => sum + vertex.y, 0) / worldVertices.length
        );
        const centerScreen = worldToScreen(new Vector2D(
            centerWorld.x,
            centerWorld.y
        ));
        const approxRadiusScreen = asteroidSize * zoom;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        ctx.closePath();
        ctx.clip();

        const gradientStartX = centerScreen.x - lightDirection.x * approxRadiusScreen;
        const gradientStartY = centerScreen.y - lightDirection.y * approxRadiusScreen;
        const gradientEndX = centerScreen.x + lightDirection.x * approxRadiusScreen;
        const gradientEndY = centerScreen.y + lightDirection.y * approxRadiusScreen;
        const isUltraQuality = graphicsQuality === 'ultra';
        const rimGradient = ctx.createLinearGradient(gradientStartX, gradientStartY, gradientEndX, gradientEndY);
        rimGradient.addColorStop(0, isUltraQuality ? 'rgba(0, 0, 0, 0.74)' : 'rgba(0, 0, 0, 0.44)');
        rimGradient.addColorStop(0.45, isUltraQuality ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.14)');
        rimGradient.addColorStop(0.72, isUltraQuality ? 'rgba(235, 205, 145, 0.08)' : 'rgba(255, 233, 180, 0.06)');
        rimGradient.addColorStop(1, isUltraQuality ? 'rgba(255, 234, 176, 0.12)' : 'rgba(255, 239, 194, 0.2)');
        ctx.fillStyle = rimGradient;
        ctx.fillRect(
            centerScreen.x - approxRadiusScreen * 1.4,
            centerScreen.y - approxRadiusScreen * 1.4,
            approxRadiusScreen * 2.8,
            approxRadiusScreen * 2.8
        );
        ctx.restore();

        for (let i = 0; i < worldVertices.length; i++) {
            const currentVertex = worldVertices[i];
            const nextVertex = worldVertices[(i + 1) % worldVertices.length];
            const currentScreen = screenVertices[i];
            const nextScreen = screenVertices[(i + 1) % screenVertices.length];

            const midpointX = (currentVertex.x + nextVertex.x) * 0.5;
            const midpointY = (currentVertex.y + nextVertex.y) * 0.5;
            const normalXRaw = nextVertex.y - currentVertex.y;
            const normalYRaw = -(nextVertex.x - currentVertex.x);
            const midpointToCenterX = midpointX - centerWorld.x;
            const midpointToCenterY = midpointY - centerWorld.y;
            const outwardSign = midpointToCenterX * normalXRaw + midpointToCenterY * normalYRaw >= 0 ? 1 : -1;

            const normalLength = Math.hypot(normalXRaw, normalYRaw);
            if (normalLength <= 0.0001) {
                continue;
            }

            const normalX = (normalXRaw / normalLength) * outwardSign;
            const normalY = (normalYRaw / normalLength) * outwardSign;
            const edgeFacingLight = normalX * lightDirection.x + normalY * lightDirection.y;

            if (edgeFacingLight > 0.14) {
                const highlightAlpha = isUltraQuality
                    ? Math.pow(edgeFacingLight, 1.3) * 0.32
                    : Math.pow(edgeFacingLight, 1.2) * 0.42;
                ctx.strokeStyle = `rgba(255, 226, 150, ${highlightAlpha.toFixed(3)})`;
                ctx.lineWidth = isUltraQuality ? this.ASTEROID_RIM_HIGHLIGHT_WIDTH + 1 : this.ASTEROID_RIM_HIGHLIGHT_WIDTH;
                ctx.beginPath();
                ctx.moveTo(currentScreen.x, currentScreen.y);
                ctx.lineTo(nextScreen.x, nextScreen.y);
                ctx.stroke();
            } else if (edgeFacingLight < -0.08) {
                const shadowAlpha = isUltraQuality ? -edgeFacingLight * 0.88 : -edgeFacingLight * 0.64;
                ctx.strokeStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`;
                ctx.lineWidth = isUltraQuality ? this.ASTEROID_RIM_SHADOW_WIDTH + 1 : this.ASTEROID_RIM_SHADOW_WIDTH;
                ctx.beginPath();
                ctx.moveTo(currentScreen.x, currentScreen.y);
                ctx.lineTo(nextScreen.x, nextScreen.y);
                ctx.stroke();
            }
        }
    }

    /**
     * Rotate and translate a local point to world coordinates
     */
    private rotateAndTranslateLocalPoint(localPoint: Vector2D, asteroid: Asteroid, rotationCos: number, rotationSin: number): Vector2D {
        return new Vector2D(
            asteroid.position.x + localPoint.x * rotationCos - localPoint.y * rotationSin,
            asteroid.position.y + localPoint.x * rotationSin + localPoint.y * rotationCos
        );
    }

    /**
     * Get or create cached render data for an asteroid
     */
    private getAsteroidRenderCache(asteroid: Asteroid): AsteroidRenderCache {
        const cached = this.asteroidRenderCache.get(asteroid);
        if (cached) {
            return cached;
        }

        const facets = this.generateAsteroidFacets(asteroid);
        const generatedCache: AsteroidRenderCache = {
            facets,
            facetCount: facets.length
        };
        this.asteroidRenderCache.set(asteroid, generatedCache);
        return generatedCache;
    }

    /**
     * Generate triangular facets using Delaunay triangulation
     */
    private generateAsteroidFacets(asteroid: Asteroid): AsteroidFacet[] {
        if (asteroid.vertices.length < 3) {
            return [];
        }

        const asteroidSeed = this.computeAsteroidSeed(asteroid);
        const interiorPoints = this.generateAsteroidInteriorPoints(asteroid, asteroidSeed);
        const delaunayTriangles = this.generateDelaunayTriangles(asteroid.vertices, interiorPoints);
        const facets: AsteroidFacet[] = [];

        for (let facetIndex = 0; facetIndex < delaunayTriangles.length; facetIndex++) {
            const [pointA, pointB, pointC] = delaunayTriangles[facetIndex];
            const centroidLocal = new Vector2D(
                (pointA.x + pointB.x + pointC.x) / 3,
                (pointA.y + pointB.y + pointC.y) / 3
            );
            const signedAreaTwice = (pointB.x - pointA.x) * (pointC.y - pointA.y) - (pointB.y - pointA.y) * (pointC.x - pointA.x);
            if (Math.abs(signedAreaTwice) <= 0.0001) {
                continue;
            }

            if (signedAreaTwice > 0) {
                facets.push({ points: [pointA, pointB, pointC], centroidLocal });
            } else {
                facets.push({ points: [pointA, pointC, pointB], centroidLocal });
            }
        }

        return facets;
    }

    /**
     * Generate interior points for Delaunay triangulation
     * Uses deterministic hashing for consistent facet generation
     */
    private generateAsteroidInteriorPoints(asteroid: Asteroid, asteroidSeed: number): Vector2D[] {
        if (asteroid.vertices.length < 3) {
            return [];
        }

        const centerLocal = new Vector2D(
            asteroid.vertices.reduce((sum, vertex) => sum + vertex.x, 0) / asteroid.vertices.length,
            asteroid.vertices.reduce((sum, vertex) => sum + vertex.y, 0) / asteroid.vertices.length
        );
        const interiorPointCount = Math.max(3, Math.min(8, Math.round(asteroid.sides * 0.34)));
        const interiorPoints: Vector2D[] = [];

        for (let pointIndex = 0; pointIndex < interiorPointCount; pointIndex++) {
            const angle = this.hashNormalized(asteroidSeed + pointIndex * 19.91) * Math.PI * 2;
            const radial = asteroid.size * (0.18 + this.hashNormalized(asteroidSeed + pointIndex * 29.47) * 0.46);
            const jitterX = this.hashSigned(asteroidSeed + pointIndex * 37.13) * asteroid.size * 0.07;
            const jitterY = this.hashSigned(asteroidSeed + pointIndex * 43.59) * asteroid.size * 0.07;
            interiorPoints.push(new Vector2D(
                centerLocal.x + Math.cos(angle) * radial + jitterX,
                centerLocal.y + Math.sin(angle) * radial + jitterY
            ));
        }

        return interiorPoints;
    }

    /**
     * Bowyer-Watson algorithm for Delaunay triangulation
     * Generates optimal triangulation for rendering asteroid facets
     */
    private generateDelaunayTriangles(boundaryPoints: Vector2D[], interiorPoints: Vector2D[]): [Vector2D, Vector2D, Vector2D][] {
        const allPoints = [...boundaryPoints, ...interiorPoints];
        if (allPoints.length < 3) {
            return [];
        }

        const minX = allPoints.reduce((currentMin, point) => Math.min(currentMin, point.x), Infinity);
        const minY = allPoints.reduce((currentMin, point) => Math.min(currentMin, point.y), Infinity);
        const maxX = allPoints.reduce((currentMax, point) => Math.max(currentMax, point.x), -Infinity);
        const maxY = allPoints.reduce((currentMax, point) => Math.max(currentMax, point.y), -Infinity);
        const span = Math.max(maxX - minX, maxY - minY, 1);

        const superPointA = new Vector2D(minX - span * 16, minY - span * 12);
        const superPointB = new Vector2D(minX + span * 32, minY - span * 12);
        const superPointC = new Vector2D(minX + span * 8, maxY + span * 30);
        const vertexCount = allPoints.length;
        const points = [...allPoints, superPointA, superPointB, superPointC];
        const superPointAIndex = vertexCount;
        const superPointBIndex = vertexCount + 1;
        const superPointCIndex = vertexCount + 2;

        let triangles: Array<[number, number, number]> = [[superPointAIndex, superPointBIndex, superPointCIndex]];

        for (let pointIndex = 0; pointIndex < vertexCount; pointIndex++) {
            const point = points[pointIndex];
            const badTriangleIndices: number[] = [];

            for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex++) {
                const [indexA, indexB, indexC] = triangles[triangleIndex];
                if (this.pointInsideCircumcircle(point, points[indexA], points[indexB], points[indexC])) {
                    badTriangleIndices.push(triangleIndex);
                }
            }

            const edgeCounts = new Map<string, { a: number; b: number; count: number }>();
            for (let badIndexCursor = 0; badIndexCursor < badTriangleIndices.length; badIndexCursor++) {
                const [indexA, indexB, indexC] = triangles[badTriangleIndices[badIndexCursor]];
                const edges: Array<[number, number]> = [[indexA, indexB], [indexB, indexC], [indexC, indexA]];
                for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
                    const [edgeStart, edgeEnd] = edges[edgeIndex];
                    const keyStart = Math.min(edgeStart, edgeEnd);
                    const keyEnd = Math.max(edgeStart, edgeEnd);
                    const edgeKey = `${keyStart}_${keyEnd}`;
                    const existing = edgeCounts.get(edgeKey);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        edgeCounts.set(edgeKey, { a: edgeStart, b: edgeEnd, count: 1 });
                    }
                }
            }

            const badIndexSet = new Set(badTriangleIndices);
            const keptTriangles: Array<[number, number, number]> = [];
            for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex++) {
                if (!badIndexSet.has(triangleIndex)) {
                    keptTriangles.push(triangles[triangleIndex]);
                }
            }
            triangles = keptTriangles;

            edgeCounts.forEach((edgeData) => {
                if (edgeData.count === 1) {
                    triangles.push([edgeData.a, edgeData.b, pointIndex]);
                }
            });
        }

        const facets: [Vector2D, Vector2D, Vector2D][] = [];
        for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex++) {
            const [indexA, indexB, indexC] = triangles[triangleIndex];
            if (indexA >= vertexCount || indexB >= vertexCount || indexC >= vertexCount) {
                continue;
            }

            facets.push([points[indexA], points[indexB], points[indexC]]);
        }

        return facets;
    }

    /**
     * Test if a point is inside the circumcircle of a triangle
     * Used by Delaunay triangulation algorithm
     */
    private pointInsideCircumcircle(testPoint: Vector2D, pointA: Vector2D, pointB: Vector2D, pointC: Vector2D): boolean {
        const ax = pointA.x - testPoint.x;
        const ay = pointA.y - testPoint.y;
        const bx = pointB.x - testPoint.x;
        const by = pointB.y - testPoint.y;
        const cx = pointC.x - testPoint.x;
        const cy = pointC.y - testPoint.y;

        const determinant = (ax * ax + ay * ay) * (bx * cy - by * cx)
            - (bx * bx + by * by) * (ax * cy - ay * cx)
            + (cx * cx + cy * cy) * (ax * by - ay * bx);
        const orientation = (pointB.x - pointA.x) * (pointC.y - pointA.y) - (pointB.y - pointA.y) * (pointC.x - pointA.x);
        return orientation > 0 ? determinant > 0.000001 : determinant < -0.000001;
    }

    /**
     * Compute deterministic seed for asteroid
     * Based on position, size, and sides for consistent facet generation
     */
    private computeAsteroidSeed(asteroid: Asteroid): number {
        return asteroid.position.x * 0.1031 + asteroid.position.y * 0.11369 + asteroid.size * 0.13787 + asteroid.sides * 0.173;
    }

    /**
     * Deterministic hash function - returns value in [0, 1]
     */
    private hashNormalized(inputValue: number): number {
        const sineValue = Math.sin(inputValue * 43758.5453123);
        return sineValue - Math.floor(sineValue);
    }

    /**
     * Deterministic hash function - returns value in [-1, 1]
     */
    private hashSigned(inputValue: number): number {
        return this.hashNormalized(inputValue) * 2 - 1;
    }
}
