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

export type SpriteDrawSource = {
    image: CanvasImageSource;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
};

type SpriteAtlasRegion = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export class SpriteManager {
    private static readonly SPRITE_ATLAS_SIZE_PX = 2048;
    private static readonly SPRITE_ATLAS_PADDING_PX = 2;

    private spriteImageCache = new Map<string, HTMLImageElement>();
    private tintedSpriteCache = new Map<string, HTMLCanvasElement>();
    private graphemeMaskCache = new Map<string, ImageData>();
    private spriteAtlasRegionCache = new Map<string, SpriteAtlasRegion>();
    private solEnergyIcon: HTMLImageElement | null = null;
    private spriteAtlasCanvas: HTMLCanvasElement | null = null;
    private spriteAtlasContext: CanvasRenderingContext2D | null = null;
    private spriteAtlasCursorX = 0;
    private spriteAtlasCursorY = 0;
    private spriteAtlasRowHeight = 0;

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

    getSpriteDrawSource(path: string): SpriteDrawSource | null {
        const resolvedPath = resolveAssetPath(path);
        const image = this.getSpriteImage(resolvedPath);
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return null;
        }

        const atlasRegion = this.getOrCreateAtlasRegion(resolvedPath, image);
        if (atlasRegion && this.spriteAtlasCanvas) {
            return {
                image: this.spriteAtlasCanvas,
                sourceX: atlasRegion.x,
                sourceY: atlasRegion.y,
                sourceWidth: atlasRegion.width,
                sourceHeight: atlasRegion.height,
                width: atlasRegion.width,
                height: atlasRegion.height
            };
        }

        return {
            image,
            sourceX: 0,
            sourceY: 0,
            sourceWidth: image.naturalWidth,
            sourceHeight: image.naturalHeight,
            width: image.naturalWidth,
            height: image.naturalHeight
        };
    }

    drawSprite(
        ctx: CanvasRenderingContext2D,
        path: string,
        x: number,
        y: number,
        width: number,
        height: number
    ): boolean {
        const spriteSource = this.getSpriteDrawSource(path);
        if (!spriteSource) {
            return false;
        }

        ctx.drawImage(
            spriteSource.image,
            spriteSource.sourceX,
            spriteSource.sourceY,
            spriteSource.sourceWidth,
            spriteSource.sourceHeight,
            x,
            y,
            width,
            height
        );
        return true;
    }

    getTintedSprite(path: string, color: string): HTMLCanvasElement | null {
        const resolvedPath = resolveAssetPath(path);
        const cacheKey = `${resolvedPath}|${color}`;
        const cached = this.tintedSpriteCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const spriteSource = this.getSpriteDrawSource(resolvedPath);
        if (!spriteSource) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = spriteSource.width;
        canvas.height = spriteSource.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        ctx.drawImage(
            spriteSource.image,
            spriteSource.sourceX,
            spriteSource.sourceY,
            spriteSource.sourceWidth,
            spriteSource.sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(
            spriteSource.image,
            spriteSource.sourceX,
            spriteSource.sourceY,
            spriteSource.sourceWidth,
            spriteSource.sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );
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

        const spriteSource = this.getSpriteDrawSource(resolvedPath);
        if (!spriteSource) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = spriteSource.width;
        canvas.height = spriteSource.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }
        ctx.drawImage(
            spriteSource.image,
            spriteSource.sourceX,
            spriteSource.sourceY,
            spriteSource.sourceWidth,
            spriteSource.sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );
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

    private getOrCreateAtlasRegion(resolvedPath: string, image: HTMLImageElement): SpriteAtlasRegion | null {
        const cached = this.spriteAtlasRegionCache.get(resolvedPath);
        if (cached) {
            return cached;
        }

        const atlasContext = this.getOrCreateAtlasContext();
        const paddingPx = SpriteManager.SPRITE_ATLAS_PADDING_PX;
        const atlasSizePx = SpriteManager.SPRITE_ATLAS_SIZE_PX;
        const requiredWidthPx = image.naturalWidth + paddingPx * 2;
        const requiredHeightPx = image.naturalHeight + paddingPx * 2;

        if (requiredWidthPx > atlasSizePx || requiredHeightPx > atlasSizePx) {
            return null;
        }

        if (this.spriteAtlasCursorX + requiredWidthPx > atlasSizePx) {
            this.spriteAtlasCursorX = 0;
            this.spriteAtlasCursorY += this.spriteAtlasRowHeight;
            this.spriteAtlasRowHeight = 0;
        }

        if (this.spriteAtlasCursorY + requiredHeightPx > atlasSizePx) {
            return null;
        }

        const region: SpriteAtlasRegion = {
            x: this.spriteAtlasCursorX + paddingPx,
            y: this.spriteAtlasCursorY + paddingPx,
            width: image.naturalWidth,
            height: image.naturalHeight
        };

        atlasContext.drawImage(image, region.x, region.y);
        this.spriteAtlasRegionCache.set(resolvedPath, region);

        this.spriteAtlasCursorX += requiredWidthPx;
        this.spriteAtlasRowHeight = Math.max(this.spriteAtlasRowHeight, requiredHeightPx);
        return region;
    }

    private getOrCreateAtlasContext(): CanvasRenderingContext2D {
        if (this.spriteAtlasContext && this.spriteAtlasCanvas) {
            return this.spriteAtlasContext;
        }

        const canvas = document.createElement('canvas');
        canvas.width = SpriteManager.SPRITE_ATLAS_SIZE_PX;
        canvas.height = SpriteManager.SPRITE_ATLAS_SIZE_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create sprite atlas context');
        }

        this.spriteAtlasCanvas = canvas;
        this.spriteAtlasContext = ctx;
        return ctx;
    }
}
