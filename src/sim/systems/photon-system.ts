/**
 * Photon System
 *
 * Handles all photon simulation logic:
 * - Deterministic spawning from suns using the golden angle
 * - Progressively faster ejection throughout the match
 * - Photon-photon repulsion at medium range
 * - Hero absorption via gravity-like suction
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { Sun } from '../entities/sun';
import { Player } from '../entities/player';
import { Unit } from '../entities/unit';
import { Photon } from '../entities/photon';
import { SolarMirror } from '../entities/solar-mirror';

/**
 * Minimal context required by the PhotonSystem
 */
export interface PhotonSystemContext {
    suns: Sun[];
    photons: Photon[];
    players: Player[];
    gameTime: number;
    mapSize: number;
    photonSpawnAccumulator: number;
    photonSpawnIndex: number;
}

export class PhotonSystem {
    /**
     * Update all photon logic for one tick
     */
    static update(ctx: PhotonSystemContext, deltaTime: number): void {
        PhotonSystem.spawnPhotons(ctx, deltaTime);
        PhotonSystem.applyRepulsion(ctx, deltaTime);
        PhotonSystem.applyHeroAbsorption(ctx, deltaTime);
        PhotonSystem.applyMirrorAbsorption(ctx, deltaTime);
        PhotonSystem.updateAndCleanup(ctx, deltaTime);
    }

    /**
     * Spawn photons from suns at an accelerating rate using the golden angle
     */
    private static spawnPhotons(ctx: PhotonSystemContext, deltaTime: number): void {
        if (ctx.suns.length === 0) return;

        // Calculate current spawn interval (gets faster over the match)
        const matchProgress = Math.min(1, ctx.gameTime / Constants.MATCH_TIME_LIMIT_SEC);
        const currentIntervalSec = Constants.PHOTON_BASE_SPAWN_INTERVAL_SEC
            - (Constants.PHOTON_BASE_SPAWN_INTERVAL_SEC - Constants.PHOTON_MIN_SPAWN_INTERVAL_SEC) * matchProgress;

        ctx.photonSpawnAccumulator += deltaTime;

        while (ctx.photonSpawnAccumulator >= currentIntervalSec && ctx.photons.length < Constants.PHOTON_MAX_COUNT) {
            ctx.photonSpawnAccumulator -= currentIntervalSec;

            // Pick sun deterministically (round-robin)
            const sun = ctx.suns[ctx.photonSpawnIndex % ctx.suns.length];

            // Golden-angle based ejection direction for a visually "random" but deterministic spiral
            const angleRad = ctx.photonSpawnIndex * Constants.PHOTON_GOLDEN_ANGLE_RAD;

            // Speed varies in a deterministic wave pattern
            const speedFactor = 0.5 + 0.5 * Math.sin(ctx.photonSpawnIndex * 0.618033988749); // golden ratio fraction
            const speed = Constants.PHOTON_SPEED_MIN + (Constants.PHOTON_SPEED_MAX - Constants.PHOTON_SPEED_MIN) * speedFactor;

            const vx = Math.cos(angleRad) * speed;
            const vy = Math.sin(angleRad) * speed;

            // Spawn at sun edge
            const spawnX = sun.position.x + Math.cos(angleRad) * sun.radius;
            const spawnY = sun.position.y + Math.sin(angleRad) * sun.radius;

            ctx.photons.push(new Photon(
                new Vector2D(spawnX, spawnY),
                new Vector2D(vx, vy)
            ));

            ctx.photonSpawnIndex += 1;
        }
    }

    /**
     * Apply repulsion between nearby photons
     */
    private static applyRepulsion(ctx: PhotonSystemContext, deltaTime: number): void {
        const photons = ctx.photons;
        const rangeSquared = Constants.PHOTON_REPULSION_RANGE_PX * Constants.PHOTON_REPULSION_RANGE_PX;

        for (let i = 0; i < photons.length; i++) {
            for (let j = i + 1; j < photons.length; j++) {
                const dx = photons[j].position.x - photons[i].position.x;
                const dy = photons[j].position.y - photons[i].position.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < rangeSquared && distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const invDist = 1 / dist;
                    // Force falls off linearly with distance
                    const forceMag = Constants.PHOTON_REPULSION_STRENGTH * (1 - dist / Constants.PHOTON_REPULSION_RANGE_PX) * deltaTime;
                    const fx = dx * invDist * forceMag;
                    const fy = dy * invDist * forceMag;

                    photons[i].velocity.x -= fx;
                    photons[i].velocity.y -= fy;
                    photons[j].velocity.x += fx;
                    photons[j].velocity.y += fy;
                }
            }
        }
    }

    /**
     * Apply gravity-like absorption of photons toward hero units.
     * Heroes absorb photons that come within capture range.
     */
    private static applyHeroAbsorption(ctx: PhotonSystemContext, deltaTime: number): void {
        const absorbRangeSq = Constants.PHOTON_HERO_ABSORB_RANGE_PX * Constants.PHOTON_HERO_ABSORB_RANGE_PX;
        const captureRangeSq = Constants.PHOTON_HERO_CAPTURE_RANGE_PX * Constants.PHOTON_HERO_CAPTURE_RANGE_PX;

        for (const player of ctx.players) {
            if (player.isDefeated()) continue;

            for (const unit of player.units) {
                if (!unit.isHero) continue;

                for (let i = ctx.photons.length - 1; i >= 0; i--) {
                    const photon = ctx.photons[i];
                    const dx = unit.position.x - photon.position.x;
                    const dy = unit.position.y - photon.position.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < captureRangeSq) {
                        // Absorb the photon
                        unit.photonCount += 1;
                        ctx.photons.splice(i, 1);
                        continue;
                    }

                    if (distSq < absorbRangeSq && distSq > 0.01) {
                        const dist = Math.sqrt(distSq);
                        const invDist = 1 / dist;
                        // Gravity: force ∝ 1/dist (stronger when closer)
                        const forceMag = Constants.PHOTON_HERO_ABSORB_STRENGTH * invDist * deltaTime;
                        photon.velocity.x += dx * invDist * forceMag;
                        photon.velocity.y += dy * invDist * forceMag;
                    }
                }
            }
        }
    }

    /**
     * Apply gravity-like absorption of photons toward solar mirrors.
     * Mirrors absorb photons that come within capture range and become overcharged.
     */
    private static applyMirrorAbsorption(ctx: PhotonSystemContext, deltaTime: number): void {
        const absorbRangeSq = Constants.PHOTON_MIRROR_ABSORB_RANGE_PX * Constants.PHOTON_MIRROR_ABSORB_RANGE_PX;
        const captureRangeSq = Constants.PHOTON_MIRROR_CAPTURE_RANGE_PX * Constants.PHOTON_MIRROR_CAPTURE_RANGE_PX;

        for (const player of ctx.players) {
            if (player.isDefeated()) continue;

            for (const mirror of player.solarMirrors) {
                for (let i = ctx.photons.length - 1; i >= 0; i--) {
                    const photon = ctx.photons[i];
                    const dx = mirror.position.x - photon.position.x;
                    const dy = mirror.position.y - photon.position.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < captureRangeSq) {
                        // Absorb the photon and trigger overcharge
                        mirror.absorbPhoton();
                        ctx.photons.splice(i, 1);
                        continue;
                    }

                    if (distSq < absorbRangeSq && distSq > 0.01) {
                        const dist = Math.sqrt(distSq);
                        const invDist = 1 / dist;
                        // Gravity: net acceleration ∝ 1/dist² (direction × invDist, magnitude × invDist)
                        // Matches hero absorption behavior intentionally.
                        const forceMag = Constants.PHOTON_MIRROR_ABSORB_STRENGTH * invDist * deltaTime;
                        photon.velocity.x += dx * invDist * forceMag;
                        photon.velocity.y += dy * invDist * forceMag;
                    }
                }
            }
        }
    }

    /**
     * Update photon positions and remove despawned photons
     */
    private static updateAndCleanup(ctx: PhotonSystemContext, deltaTime: number): void {
        for (let i = ctx.photons.length - 1; i >= 0; i--) {
            ctx.photons[i].update(deltaTime, ctx.mapSize);
            if (ctx.photons[i].shouldDespawn()) {
                ctx.photons.splice(i, 1);
            }
        }
    }
}
