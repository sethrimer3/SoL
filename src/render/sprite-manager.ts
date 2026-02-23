/**
 * SpriteManager - Handles sprite loading, caching, tinting, and grapheme rendering
 */

import { getVelarisGraphemeSpritePath } from './faction-utilities';
import { resolveAssetPath } from './asset-utilities';

export const VELARIS_FORGE_GRAPHEME_SPRITE_PATHS = [
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-A.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-B.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-C.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-D.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-E.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-F.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-G.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-H.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-I.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-J.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-K.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-L.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-M.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-N.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-O.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-P.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Q.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-R.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-S.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-T.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-U.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-V.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-W.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-X.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Y.png',
    'ASSETS/sprites/VELARIS/velarisAncientScript/grapheme-Z.png'
];

export class SpriteManager {
    private spriteImageCache = new Map<string, HTMLImageElement>();
    private tintedSpriteCache = new Map<string, HTMLCanvasElement>();
    private graphemeMaskCache = new Map<string, ImageData>();
    private solEnergyIcon: HTMLImageElement | null = null;

    getSpriteImage(path: string): HTMLImageElement {
        const resolvedPath = resolveAssetPath(path);
        const cached = this.spriteImageCache.get(resolvedPath);
        if (cached) {
            return cached;
        }
        const image = new Image();
        image.src = resolvedPath;
        this.spriteImageCache.set(resolvedPath, image);
        return image;
    }

    getSolEnergyIcon(): HTMLImageElement {
        if (!this.solEnergyIcon) {
            this.solEnergyIcon = this.getSpriteImage('ASSETS/sprites/interface/SoL_icon.png');
        }
        return this.solEnergyIcon;
    }

    getTintedSprite(path: string, color: string): HTMLCanvasElement | null {
        const resolvedPath = resolveAssetPath(path);
        const cacheKey = `${resolvedPath}|${color}`;
        const cached = this.tintedSpriteCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const image = this.getSpriteImage(resolvedPath);
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        this.tintedSpriteCache.set(cacheKey, canvas);
        return canvas;
    }

    getVelarisGraphemeSpritePath(letter: string): string | null {
        return getVelarisGraphemeSpritePath(letter, VELARIS_FORGE_GRAPHEME_SPRITE_PATHS);
    }

    getGraphemeMaskData(spritePath: string): ImageData | null {
        const resolvedPath = resolveAssetPath(spritePath);
        const cached = this.graphemeMaskCache.get(resolvedPath);
        if (cached) {
            return cached;
        }

        const image = this.getSpriteImage(resolvedPath);
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.graphemeMaskCache.set(resolvedPath, imageData);
        return imageData;
    }

    isPointInsideGraphemeMask(x: number, y: number, mask: ImageData): boolean {
        const width = mask.width;
        const height = mask.height;
        const sampleX = Math.round((x + 0.5) * (width - 1));
        const sampleY = Math.round((y + 0.5) * (height - 1));
        if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
            return false;
        }
        const alpha = mask.data[(sampleY * width + sampleX) * 4 + 3];
        return alpha > 24;
    }

    drawVelarisGraphemeSprite(
        ctx: CanvasRenderingContext2D,
        spritePath: string,
        centerX: number,
        centerY: number,
        targetSize: number,
        color: string
    ): boolean {
        const tintedSprite = this.getTintedSprite(spritePath, color);
        if (!tintedSprite) {
            return false;
        }
        const scale = targetSize / Math.max(tintedSprite.width, tintedSprite.height);
        const drawWidth = tintedSprite.width * scale;
        const drawHeight = tintedSprite.height * scale;
        ctx.drawImage(
            tintedSprite,
            centerX - drawWidth / 2,
            centerY - drawHeight / 2,
            drawWidth,
            drawHeight
        );
        return true;
    }
}
