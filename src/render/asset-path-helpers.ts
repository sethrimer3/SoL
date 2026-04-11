/**
 * Asset path helpers – maps entity types to sprite paths and display names.
 * Extracted from GameRenderer to reduce monolithic file size.
 * These are pure helper functions with no rendering state of their own.
 */

import {
    Unit,
    Marine,
    Grave,
    Dagger,
    Beam,
    Mortar,
    Ray,
    Nova,
    InfluenceBall,
    TurretDeployer,
    Driller,
    Preist,
    Tank,
    Spotlight,
    Mothership,
    Sly,
    Chrono,
    Shadow,
    Occlude,
    VelarisHero,
    Splendor,
    Dash,
    Blink,
    Shroud,
    AurumHero,
    Radiant,
    StellarForge,
    SolarMirror,
    Starling,
    Building,
    Minigun,
    GatlingTower,
    SpaceDustSwirler,
    SubsidiaryFactory,
    StrikerTower,
    LockOnLaserTower,
    ShieldTower,
    Faction,
} from '../game-core';
import type { GraphicKey } from './graphics-options';

/** Callback type matching GameRenderer.getGraphicAssetPath */
export type GraphicAssetPathResolver = (key: GraphicKey) => string | null;

/**
 * Get the sprite path for a hero unit.
 * Returns null for unrecognized hero types.
 */
export function getHeroSpritePath(unit: Unit, getGraphicAssetPath: GraphicAssetPathResolver): string | null {
    if (unit instanceof Marine) {
        return getGraphicAssetPath('heroMarine');
    }
    if (unit instanceof Grave) {
        return getGraphicAssetPath('heroGrave');
    }
    if (unit instanceof Dagger) {
        return getGraphicAssetPath('heroDagger');
    }
    if (unit instanceof Beam) {
        return getGraphicAssetPath('heroBeam');
    }
    if (unit instanceof Mortar) {
        return getGraphicAssetPath('heroMortar');
    }
    if (unit instanceof Ray) {
        return getGraphicAssetPath('heroRay');
    }
    if (unit instanceof Nova) {
        return getGraphicAssetPath('heroNova');
    }
    if (unit instanceof InfluenceBall) {
        return getGraphicAssetPath('heroInfluenceBall');
    }
    if (unit instanceof TurretDeployer) {
        return getGraphicAssetPath('heroTurretDeployer');
    }
    if (unit instanceof Driller) {
        return getGraphicAssetPath('heroDriller');
    }
    if (unit instanceof Preist) {
        return getGraphicAssetPath('heroPreist');
    }
    if (unit instanceof Tank) {
        return getGraphicAssetPath('heroTank');
    }
    if (unit instanceof Spotlight) {
        return getGraphicAssetPath('heroSpotlight');
    }
    if (unit instanceof Mothership) {
        return getGraphicAssetPath('heroMothership');
    }
    if (unit instanceof Sly) {
        return getGraphicAssetPath('heroSly');
    }
    if (unit instanceof Chrono) {
        return getGraphicAssetPath('heroChrono');
    }
    if (unit instanceof Shadow) {
        return getGraphicAssetPath('heroShadow');
    }
    if (unit instanceof Occlude) {
        return getGraphicAssetPath('heroOcclude');
    }
    if (unit instanceof VelarisHero) {
        return getGraphicAssetPath('heroVelarisHero');
    }
    if (unit instanceof Splendor) {
        return getGraphicAssetPath('heroSplendor');
    }
    if (unit instanceof Dash) {
        return getGraphicAssetPath('heroDash');
    }
    if (unit instanceof Blink) {
        return getGraphicAssetPath('heroBlink');
    }
    if (unit instanceof Shroud) {
        return getGraphicAssetPath('heroShroud');
    }
    if (unit instanceof AurumHero) {
        return getGraphicAssetPath('heroAurumHero');
    }
    if (unit instanceof Radiant) {
        return getGraphicAssetPath('heroRadiant');
    }
    return null;
}

/**
 * Get the sprite path for a Stellar Forge (Radiant faction only).
 */
export function getForgeSpritePath(forge: StellarForge, getGraphicAssetPath: GraphicAssetPathResolver): string | null {
    if (forge.owner.faction === Faction.RADIANT) {
        return getGraphicAssetPath('stellarForge');
    }
    return null;
}

/**
 * Get the sprite path for a Solar Mirror (Radiant faction only).
 */
export function getSolarMirrorSpritePath(mirror: SolarMirror, getGraphicAssetPath: GraphicAssetPathResolver): string | null {
    if (mirror.owner.faction === Faction.RADIANT) {
        return getGraphicAssetPath('solarMirror');
    }
    return null;
}

/**
 * Get the sprite path for a Starling unit (Radiant faction only).
 */
export function getStarlingSpritePath(starling: Starling): string | null {
    if (starling.owner.faction === Faction.RADIANT) {
        const level = Math.min(4, Math.max(1, starling.spriteLevel));
        return `ASSETS/sprites/RADIANT/starlings/starlingLevel (${level}).png`;
    }
    return null;
}

/**
 * Get the facing rotation for a Starling so stopped starlings keep their final heading.
 */
export function getStarlingFacingRotationRad(starling: Starling): number | null {
    return starling.rotation;
}

/**
 * Get a human-readable display name for a production unit type.
 */
export function getProductionDisplayName(unitType: string): string {
    const nameMap: { [key: string]: string } = {
        'marine': 'Marine',
        'grave': 'Grave',
        'ray': 'Ray',
        'influenceball': 'Influence Ball',
        'turretdeployer': 'Turret Deployer',
        'driller': 'Driller',
        'dagger': 'Dagger',
        'beam': 'Beam',
        'spotlight': 'Spotlight',
        'splendor': 'Splendor',
        'shroud': 'Shroud',
        'solar-mirror': 'Solar Mirror',
        'strafe-upgrade': 'Strafe Upgrade',
        'regen-upgrade': 'Regen Upgrade',
        'attack-upgrade': '+1 ATK',
        'blink-upgrade': 'Blink Upgrade'
    };
    return nameMap[unitType.toLowerCase()] || unitType;
}

/**
 * Get a human-readable display name for a building.
 */
export function getBuildingDisplayName(building: Building): string {
    if (building instanceof GatlingTower) {
        return 'Gatling Tower';
    } else if (building instanceof Minigun) {
        return 'Cannon';
    } else if (building instanceof SpaceDustSwirler) {
        return 'Cyclone';
    } else if (building instanceof SubsidiaryFactory) {
        return 'Foundry';
    } else if (building instanceof StrikerTower) {
        return 'Striker Tower';
    } else if (building instanceof LockOnLaserTower) {
        return 'Lock-on Tower';
    } else if (building instanceof ShieldTower) {
        return 'Shield Tower';
    }
    return 'Building';
}

/**
 * Detect and draw edges from an offscreen canvas with filled shapes.
 * Used for Aurum outline rendering effect.
 * Skips expensive edge detection on low/medium quality for performance.
 */
export function detectAndDrawEdges(
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    cropWidth: number,
    cropHeight: number,
    minX: number,
    minY: number,
    displayColor: string,
    graphicsQuality: string,
    alphaThreshold: number
): void {
    if (graphicsQuality === 'low' || graphicsQuality === 'medium') {
        return;
    }

    const data = imageData.data;

    ctx.save();
    ctx.strokeStyle = displayColor;
    ctx.shadowColor = displayColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.fillStyle = displayColor;

    for (let y = 1; y < cropHeight - 1; y++) {
        for (let x = 1; x < cropWidth - 1; x++) {
            const idx = (y * cropWidth + x) * 4;
            const alpha = data[idx + 3];

            if (alpha > alphaThreshold) {
                const hasEmptyNeighbor =
                    data[((y - 1) * cropWidth + x) * 4 + 3] < alphaThreshold ||
                    data[((y + 1) * cropWidth + x) * 4 + 3] < alphaThreshold ||
                    data[(y * cropWidth + (x - 1)) * 4 + 3] < alphaThreshold ||
                    data[(y * cropWidth + (x + 1)) * 4 + 3] < alphaThreshold;

                if (hasEmptyNeighbor) {
                    ctx.fillRect(minX + x, minY + y, 1, 1);
                }
            }
        }
    }

    ctx.restore();
}
