import { MapConfig } from './types';

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

export function createMapPreviewCanvas(map: MapConfig, width: number = 220, height: number = 130): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.borderRadius = '8px';
    canvas.style.border = '1px solid rgba(255, 255, 255, 0.25)';
    canvas.style.background = 'radial-gradient(circle at center, rgba(20, 30, 70, 0.7), rgba(5, 10, 20, 0.9))';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 8, width * 0.5, height * 0.5, width * 0.65);
    gradient.addColorStop(0, 'rgba(40, 70, 140, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const random = seededRandom(hashString(map.id));

    for (let i = 0; i < 60; i++) {
        const x = random() * width;
        const y = random() * height;
        const r = random() * 1.4 + 0.3;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + random() * 0.65})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < map.numAsteroids; i++) {
        const x = 8 + random() * (width - 16);
        const y = 8 + random() * (height - 16);
        const r = 2 + random() * 4;
        ctx.fillStyle = `rgba(${80 + Math.floor(random() * 50)}, ${80 + Math.floor(random() * 40)}, ${90 + Math.floor(random() * 50)}, 0.9)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < map.numSuns; i++) {
        const x = 14 + random() * (width - 28);
        const y = 14 + random() * (height - 28);
        const coreRadius = 5 + random() * 3;
        const glowRadius = coreRadius * 3;
        const sunGradient = ctx.createRadialGradient(x, y, coreRadius * 0.5, x, y, glowRadius);
        sunGradient.addColorStop(0, 'rgba(255, 244, 180, 1)');
        sunGradient.addColorStop(0.4, 'rgba(255, 210, 110, 0.95)');
        sunGradient.addColorStop(1, 'rgba(255, 170, 60, 0.08)');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffe8a8';
        ctx.beginPath();
        ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
}
