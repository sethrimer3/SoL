import { MapConfig, MapJSON, MapAsteroidJSON } from './types';

function hashString(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

/** Colours used for the spawn markers, in player order. */
const SPAWN_COLORS = ['#5fb2ff', '#ff6b5f', '#5fe08a', '#ffd75f'];

/** Resolve a sun's rendered position, accounting for orbital placement. */
function sunPosition(sun: MapJSON['suns'][number]): { x: number; y: number } {
    if (sun.orbitRadius && sun.orbitRadius > 0) {
        const angle = sun.initialOrbitAngleRad ?? 0;
        return {
            x: (sun.orbitCenterX ?? 0) + Math.cos(angle) * sun.orbitRadius,
            y: (sun.orbitCenterY ?? 0) + Math.sin(angle) * sun.orbitRadius,
        };
    }
    return { x: sun.x, y: sun.y };
}

/** Draw a lumpy polygon so asteroids read as rock rather than dots. */
function drawAsteroid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    sides: number,
    random: () => number
): void {
    const points = Math.max(5, Math.min(12, sides));
    const spin = random() * Math.PI * 2;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const angle = spin + (i / points) * Math.PI * 2;
        const r = radius * (0.72 + random() * 0.45);
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.closePath();

    const shade = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    shade.addColorStop(0, 'rgba(150, 148, 156, 0.95)');
    shade.addColorStop(0.55, 'rgba(96, 94, 104, 0.95)');
    shade.addColorStop(1, 'rgba(44, 43, 52, 0.95)');
    ctx.fillStyle = shade;
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 210, 225, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Light-facing highlight so rocks read as three-dimensional.
    if (radius > 2.5) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 235, 200, 0.14)';
        ctx.beginPath();
        ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/** Draw a sun with corona bloom and a bright core. */
function drawSun(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    coreRadius: number,
    isLaD: boolean
): void {
    const glowRadius = coreRadius * 4.5;
    const halo = ctx.createRadialGradient(x, y, coreRadius * 0.4, x, y, glowRadius);
    if (isLaD) {
        halo.addColorStop(0, 'rgba(215, 235, 255, 0.95)');
        halo.addColorStop(0.3, 'rgba(140, 190, 255, 0.55)');
        halo.addColorStop(0.65, 'rgba(80, 120, 220, 0.2)');
        halo.addColorStop(1, 'rgba(40, 60, 160, 0)');
    } else {
        halo.addColorStop(0, 'rgba(255, 248, 210, 0.95)');
        halo.addColorStop(0.3, 'rgba(255, 206, 110, 0.5)');
        halo.addColorStop(0.65, 'rgba(255, 140, 50, 0.18)');
        halo.addColorStop(1, 'rgba(180, 60, 10, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(
        x - coreRadius * 0.25, y - coreRadius * 0.25, coreRadius * 0.1,
        x, y, coreRadius
    );
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, isLaD ? '#bcd9ff' : '#ffe9a6');
    core.addColorStop(1, isLaD ? '#6f9fe8' : '#ff9d3c');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
}

export function createMapPreviewCanvas(map: MapConfig, width: number = 220, height: number = 130): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.borderRadius = '8px';
    canvas.style.border = '1px solid rgba(255, 255, 255, 0.25)';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }
    ctx.scale(dpr, dpr);

    const random = seededRandom(hashString(map.id));

    // --- Deep space backdrop -------------------------------------------------
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, width, height);

    // Nebula wisps, seeded per map so a preview always looks the same.
    for (let i = 0; i < 3; i++) {
        const nx = random() * width;
        const ny = random() * height;
        const nr = (0.35 + random() * 0.5) * width;
        const hue = 200 + random() * 90;
        const nebula = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        nebula.addColorStop(0, `hsla(${hue}, 70%, 45%, 0.16)`);
        nebula.addColorStop(0.5, `hsla(${hue}, 70%, 35%, 0.07)`);
        nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, width, height);
    }

    // Layered starfield: many faint distant stars, a few bright near ones.
    for (let i = 0; i < 140; i++) {
        const x = random() * width;
        const y = random() * height;
        const r = random() * 0.6 + 0.15;
        ctx.fillStyle = `rgba(200, 215, 255, ${0.12 + random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
        const x = random() * width;
        const y = random() * height;
        const r = 0.7 + random() * 0.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        // Faint bloom around the brightest stars.
        ctx.fillStyle = 'rgba(180, 210, 255, 0.10)';
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
    }

    const json = map.json;
    if (!json) {
        // No layout data: fall back to a plausible scatter driven by the counts.
        for (let i = 0; i < map.numAsteroids; i++) {
            drawAsteroid(ctx, 8 + random() * (width - 16), 8 + random() * (height - 16), 2 + random() * 3.5, 7, random);
        }
        for (let i = 0; i < map.numSuns; i++) {
            drawSun(ctx, 18 + random() * (width - 36), 18 + random() * (height - 36), 5 + random() * 2, false);
        }
        return canvas;
    }

    // --- World -> preview transform (uniform scale, letterboxed, centred) ----
    const pad = 6;
    const scale = Math.min((width - pad * 2) / json.mapWidth, (height - pad * 2) / json.mapHeight);
    const toX = (wx: number): number => width / 2 + wx * scale;
    const toY = (wy: number): number => height / 2 + wy * scale;

    const halfW = (json.mapWidth / 2) * scale;
    const halfH = (json.mapHeight / 2) * scale;
    const boundsX = width / 2 - halfW;
    const boundsY = height / 2 - halfH;

    // Everything below is clipped to the playable area so the map's real
    // proportions are visible instead of a full-bleed rectangle.
    ctx.save();
    ctx.beginPath();
    ctx.rect(boundsX, boundsY, halfW * 2, halfH * 2);
    ctx.clip();

    // Subtle grid inside the playable area for a sense of scale.
    const gridStep = Math.max(14, (json.mapWidth / 8) * scale);
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.07)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let gx = width / 2; gx <= boundsX + halfW * 2; gx += gridStep) {
        ctx.moveTo(gx, boundsY);
        ctx.lineTo(gx, boundsY + halfH * 2);
        const mirrored = width - gx;
        ctx.moveTo(mirrored, boundsY);
        ctx.lineTo(mirrored, boundsY + halfH * 2);
    }
    for (let gy = height / 2; gy <= boundsY + halfH * 2; gy += gridStep) {
        ctx.moveTo(boundsX, gy);
        ctx.lineTo(boundsX + halfW * 2, gy);
        const mirrored = height - gy;
        ctx.moveTo(boundsX, mirrored);
        ctx.lineTo(boundsX + halfW * 2, mirrored);
    }
    ctx.stroke();

    const suns = json.suns.map(sunPosition);

    // Orbit tracks, drawn under everything else.
    ctx.strokeStyle = 'rgba(255, 210, 140, 0.18)';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 3]);
    for (const sun of json.suns) {
        if (sun.orbitRadius && sun.orbitRadius > 0) {
            ctx.beginPath();
            ctx.arc(toX(sun.orbitCenterX ?? 0), toY(sun.orbitCenterY ?? 0), sun.orbitRadius * scale, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);

    // --- Asteroids ----------------------------------------------------------
    const authored: MapAsteroidJSON[] = json.asteroids;
    for (const a of authored) {
        drawAsteroid(ctx, toX(a.x), toY(a.y), Math.max(1.5, (a.size / 2) * scale), a.sides, random);
    }

    // Procedural asteroids: scattered like the engine does, kept clear of suns.
    const avgSize = authored.length > 0
        ? authored.reduce((sum, a) => sum + a.size, 0) / authored.length
        : 110;
    for (let i = 0; i < json.randomAsteroidCount; i++) {
        let wx = 0;
        let wy = 0;
        let placed = false;
        for (let attempt = 0; attempt < 12 && !placed; attempt++) {
            wx = (random() - 0.5) * json.mapWidth * 0.92;
            wy = (random() - 0.5) * json.mapHeight * 0.92;
            placed = true;
            for (let s = 0; s < json.suns.length; s++) {
                const dx = wx - suns[s].x;
                const dy = wy - suns[s].y;
                if (Math.hypot(dx, dy) < json.suns[s].radius * 3) {
                    placed = false;
                    break;
                }
            }
        }
        const size = avgSize * (0.55 + random() * 0.8);
        drawAsteroid(ctx, toX(wx), toY(wy), Math.max(1.5, (size / 2) * scale), 6 + Math.floor(random() * 4), random);
    }

    // --- Suns ---------------------------------------------------------------
    json.suns.forEach((sun, i) => {
        drawSun(ctx, toX(suns[i].x), toY(suns[i].y), Math.max(3, sun.radius * scale), sun.type === 'lad');
    });

    // --- Spawns -------------------------------------------------------------
    json.spawns.forEach((spawn, i) => {
        const sx = toX(spawn.x);
        const sy = toY(spawn.y);
        const color = SPAWN_COLORS[i % SPAWN_COLORS.length];

        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
        glow.addColorStop(0, `${color}66`);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();

    // Vignette + boundary frame to finish the image.
    const vignette = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.25,
        width / 2, height / 2, Math.max(width, height) * 0.7
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(140, 180, 240, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boundsX + 0.5, boundsY + 0.5, halfW * 2 - 1, halfH * 2 - 1);

    return canvas;
}
