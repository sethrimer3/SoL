import * as Constants from './constants';
import { Faction, GameState, GatlingTower, Marine, SubsidiaryFactory, Vector2D } from './game-core';

const FORGE_CHARGE_LEAD_TIME_SEC = 5;
const STARLING_ATTACK_MIN_INTERVAL_SEC = 0.12;
const STARLING_ATTACK_MAX_SIMULTANEOUS = 4;
const STARLING_ATTACK_BASE_VOLUME = 1 / 3;
const FORGE_CRUNCH_MIN_INTERVAL_SEC = 0.35;
const OFFSCREEN_VOLUME_FALLOFF_DISTANCE_FACTOR = 0.75;
const LOOP_CROSSFADE_DURATION_SEC = 0.1;
const MARINE_LOOP_BASE_VOLUME = 0.4;
const GATLING_LOOP_BASE_VOLUME = 0.35;
const FORGE_CHARGE_BASE_VOLUME = 1 / 3;

export type AudioListenerView = {
    cameraWorld: Vector2D;
    zoom: number;
    viewportWidthPx: number;
    viewportHeightPx: number;
};

type SpatialAudioNodes = {
    gainNode: GainNode;
    stereoPannerNode: StereoPannerNode | null;
};

type LoopPairState = {
    active: HTMLAudioElement;
    inactive: HTMLAudioElement;
};

export class GameAudioController {
    private readonly starlingAttackAudioPoolByFaction = new Map<Faction, HTMLAudioElement[]>();
    private readonly marineFiringLoopState: LoopPairState;
    private readonly gatlingTowerFiringLoopState: LoopPairState;
    private readonly forgeCrunchAudio: HTMLAudioElement;
    private readonly forgeChargeAudio: HTMLAudioElement;
    private readonly foundryPowerUpAudio: HTMLAudioElement;
    private readonly foundryPowerDownAudio: HTMLAudioElement;

    private readonly forgeChargePlayedByForge = new WeakMap<object, boolean>();
    private readonly forgeWasCrunchingByForge = new WeakMap<object, boolean>();
    private readonly foundryWasUpgrading = new WeakMap<object, boolean>();
    private readonly spatialAudioNodesByElement = new WeakMap<HTMLAudioElement, SpatialAudioNodes>();
    private readonly baseVolumeByElement = new WeakMap<HTMLAudioElement, number>();
    private readonly loopBlendByElement = new WeakMap<HTMLAudioElement, number>();

    private marineLoopGraceRemainingSec = 0;
    private starlingAttackCooldownRemainingSec = 0;
    private forgeCrunchCooldownRemainingSec = 0;
    private isSoundEnabled = true;
    private soundVolume = 1;
    private audioContext: AudioContext | null = null;

    constructor() {
        this.starlingAttackAudioPoolByFaction.set(
            Faction.RADIANT,
            this.createOneShotPool('ASSETS/SFX/radiantSFX/starling_firing.mp3', STARLING_ATTACK_MAX_SIMULTANEOUS, STARLING_ATTACK_BASE_VOLUME)
        );
        this.starlingAttackAudioPoolByFaction.set(
            Faction.AURUM,
            this.createOneShotPool('ASSETS/SFX/aurumSFX/starling_firing.mp3', STARLING_ATTACK_MAX_SIMULTANEOUS, STARLING_ATTACK_BASE_VOLUME)
        );
        this.starlingAttackAudioPoolByFaction.set(
            Faction.VELARIS,
            this.createOneShotPool('ASSETS/SFX/velarisSFX/starling_firing.mp3', STARLING_ATTACK_MAX_SIMULTANEOUS, STARLING_ATTACK_BASE_VOLUME)
        );

        this.marineFiringLoopState = this.createCrossfadeLoopPair('ASSETS/SFX/radiantSFX/hero_marine_firing.ogg', MARINE_LOOP_BASE_VOLUME);
        this.gatlingTowerFiringLoopState = this.createCrossfadeLoopPair('ASSETS/SFX/radiantSFX/gatling_firing.ogg', GATLING_LOOP_BASE_VOLUME);
        this.forgeCrunchAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_crunch.ogg');
        this.forgeChargeAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_charge.ogg');
        this.baseVolumeByElement.set(this.forgeChargeAudio, FORGE_CHARGE_BASE_VOLUME);
        this.foundryPowerUpAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_up.ogg');
        this.foundryPowerDownAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_down.ogg');
    }

    setSoundEnabled(isEnabled: boolean): void {
        this.isSoundEnabled = isEnabled;
        if (!isEnabled) {
            this.stopAllAudio();
        }
    }

    setSoundVolume(volume: number): void {
        this.soundVolume = Math.max(0, Math.min(1, volume));
    }

    update(game: GameState, deltaTimeSec: number, listenerView: AudioListenerView | null = null): void {
        this.starlingAttackCooldownRemainingSec = Math.max(0, this.starlingAttackCooldownRemainingSec - deltaTimeSec);
        this.forgeCrunchCooldownRemainingSec = Math.max(0, this.forgeCrunchCooldownRemainingSec - deltaTimeSec);

        let didMarineFireThisFrame = false;
        let marineSoundSource: Vector2D | null = null;
        let starlingFactionWithAttack: Faction | null = null;
        let starlingSoundSource: Vector2D | null = null;
        let didGatlingTowerFireThisFrame = false;
        let gatlingSoundSource: Vector2D | null = null;

        for (const player of game.players) {
            const forge = player.stellarForge;
            if (forge) {
                const isCrunching = forge.currentCrunch !== null;
                const wasCrunching = this.forgeWasCrunchingByForge.get(forge) === true;
                if (isCrunching && !wasCrunching) {
                    this.playOneShot(this.forgeCrunchAudio, forge.position, listenerView);
                }
                this.forgeWasCrunchingByForge.set(forge, isCrunching);

                const shouldPlayCharge =
                    forge.health > 0
                    && forge.isReceivingLight
                    && forge.currentCrunch === null
                    && forge.crunchTimer > 0
                    && forge.crunchTimer <= FORGE_CHARGE_LEAD_TIME_SEC;
                const hasPlayedCharge = this.forgeChargePlayedByForge.get(forge) === true;
                if (shouldPlayCharge && !hasPlayedCharge) {
                    this.playOneShot(this.forgeChargeAudio, forge.position, listenerView);
                    this.forgeChargePlayedByForge.set(forge, true);
                }
                if (!shouldPlayCharge && forge.crunchTimer > FORGE_CHARGE_LEAD_TIME_SEC) {
                    this.forgeChargePlayedByForge.set(forge, false);
                }
            }

            for (const building of player.buildings) {
                if (building instanceof GatlingTower && building.target) {
                    const distanceToTarget = building.position.distanceTo(building.target.position);
                    if (distanceToTarget <= building.attackRange + 1) {
                        didGatlingTowerFireThisFrame = true;
                        gatlingSoundSource = building.position;
                    }
                }

                if (!(building instanceof SubsidiaryFactory)) {
                    continue;
                }
                const isUpgradeItem =
                    building.currentProduction === Constants.FOUNDRY_STRAFE_UPGRADE_ITEM
                    || building.currentProduction === Constants.FOUNDRY_REGEN_UPGRADE_ITEM
                    || building.currentProduction === Constants.FOUNDRY_ATTACK_UPGRADE_ITEM
                    || building.currentProduction === Constants.FOUNDRY_BLINK_UPGRADE_ITEM;
                const isUpgrading = building.isComplete && isUpgradeItem;
                const wasUpgrading = this.foundryWasUpgrading.get(building) === true;
                if (isUpgrading && !wasUpgrading) {
                    this.playOneShot(this.foundryPowerUpAudio, building.position, listenerView);
                } else if (!isUpgrading && wasUpgrading) {
                    this.playOneShot(this.foundryPowerDownAudio, building.position, listenerView);
                }
                this.foundryWasUpgrading.set(building, isUpgrading);
            }

            for (const unit of player.units) {
                if (!(unit instanceof Marine) || !unit.target) {
                    continue;
                }
                const distanceToTarget = unit.position.distanceTo(unit.target.position);
                if (distanceToTarget <= unit.attackRange + 1) {
                    didMarineFireThisFrame = true;
                    marineSoundSource = unit.position;
                    break;
                }
            }
        }

        for (const laserBeam of game.laserBeams) {
            if (laserBeam.owner.faction) {
                starlingFactionWithAttack = laserBeam.owner.faction;
                starlingSoundSource = laserBeam.startPos;
                break;
            }
        }

        if (starlingFactionWithAttack && this.starlingAttackCooldownRemainingSec <= 0) {
            const starlingAudioPool = this.starlingAttackAudioPoolByFaction.get(starlingFactionWithAttack);
            if (starlingAudioPool && this.playOneShotFromPool(starlingAudioPool, starlingSoundSource, listenerView)) {
                this.starlingAttackCooldownRemainingSec = STARLING_ATTACK_MIN_INTERVAL_SEC;
            }
        }

        if (didMarineFireThisFrame) {
            this.marineLoopGraceRemainingSec = 0.2;
            this.applySpatialAudioToLoopPair(this.marineFiringLoopState, marineSoundSource, listenerView);
            this.ensureLoopPairPlaying(this.marineFiringLoopState);
            this.updateLoopCrossfade(this.marineFiringLoopState);
        } else {
            this.marineLoopGraceRemainingSec = Math.max(0, this.marineLoopGraceRemainingSec - deltaTimeSec);
            if (this.marineLoopGraceRemainingSec <= 0) {
                this.stopLoopPair(this.marineFiringLoopState);
            }
        }

        if (didGatlingTowerFireThisFrame) {
            this.applySpatialAudioToLoopPair(this.gatlingTowerFiringLoopState, gatlingSoundSource, listenerView);
            this.ensureLoopPairPlaying(this.gatlingTowerFiringLoopState);
            this.updateLoopCrossfade(this.gatlingTowerFiringLoopState);
        } else {
            this.stopLoopPair(this.gatlingTowerFiringLoopState);
        }
    }

    private resolveAssetPath(path: string): string {
        if (!path.startsWith('ASSETS/')) {
            return path;
        }
        const isDistBuild = window.location.pathname.includes('/dist/');
        return isDistBuild ? `../${path}` : path;
    }

    private createAudio(path: string, loop: boolean = false): HTMLAudioElement {
        const audio = new Audio(this.resolveAssetPath(path));
        audio.loop = loop;
        audio.preload = 'auto';
        this.baseVolumeByElement.set(audio, 1);
        this.loopBlendByElement.set(audio, 1);
        return audio;
    }

    private createCrossfadeLoopPair(path: string, baseVolume: number): LoopPairState {
        const primary = this.createAudio(path, false);
        const secondary = this.createAudio(path, false);
        this.baseVolumeByElement.set(primary, baseVolume);
        this.baseVolumeByElement.set(secondary, baseVolume);
        this.loopBlendByElement.set(primary, 1);
        this.loopBlendByElement.set(secondary, 0);
        return { active: primary, inactive: secondary };
    }

    private createOneShotPool(path: string, maxSimultaneous: number, baseVolume: number): HTMLAudioElement[] {
        return Array.from({ length: maxSimultaneous }, () => {
            const audio = this.createAudio(path, false);
            this.baseVolumeByElement.set(audio, baseVolume);
            return audio;
        });
    }

    private playOneShot(
        audio: HTMLAudioElement,
        sourcePositionWorld: Vector2D | null,
        listenerView: AudioListenerView | null,
        forceIgnoreCooldown: boolean = false
    ): void {
        if (!this.isSoundEnabled) {
            return;
        }
        if (audio === this.forgeCrunchAudio && !forceIgnoreCooldown && this.forgeCrunchCooldownRemainingSec > 0) {
            return;
        }
        if (audio === this.forgeCrunchAudio) {
            this.forgeCrunchCooldownRemainingSec = FORGE_CRUNCH_MIN_INTERVAL_SEC;
        }
        this.applySpatialAudio(audio, sourcePositionWorld, listenerView);
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
    }

    private applySpatialAudio(
        audio: HTMLAudioElement,
        sourcePositionWorld: Vector2D | null,
        listenerView: AudioListenerView | null
    ): void {
        if (!listenerView || !sourcePositionWorld) {
            this.applySpatialMix(audio, 0, 1);
            return;
        }

        const centerX = listenerView.viewportWidthPx / 2;
        const worldOffsetX = sourcePositionWorld.x - listenerView.cameraWorld.x;
        const screenX = centerX + (worldOffsetX * listenerView.zoom);
        const halfWidth = Math.max(1, centerX);
        const normalizedHorizontalOffset = (screenX - centerX) / halfWidth;
        const pan = Math.max(-1, Math.min(1, normalizedHorizontalOffset));

        const horizontalOffscreenPx = Math.max(0, Math.abs(screenX - centerX) - halfWidth);
        const offscreenDistanceFactor = horizontalOffscreenPx / Math.max(1, halfWidth * OFFSCREEN_VOLUME_FALLOFF_DISTANCE_FACTOR);
        const offscreenVolumeScale = 1 / (1 + offscreenDistanceFactor);

        this.applySpatialMix(audio, pan, offscreenVolumeScale);
    }

    private playOneShotFromPool(
        audioPool: HTMLAudioElement[],
        sourcePositionWorld: Vector2D | null,
        listenerView: AudioListenerView | null
    ): boolean {
        const availableAudio = audioPool.find((audio) => audio.paused || audio.ended);
        if (!availableAudio) {
            return false;
        }

        this.playOneShot(availableAudio, sourcePositionWorld, listenerView);
        return true;
    }

    private applySpatialMix(audio: HTMLAudioElement, pan: number, volumeScale: number): void {
        const nodes = this.ensureSpatialAudioNodes(audio);
        const clampedPan = Math.max(-1, Math.min(1, pan));
        const clampedVolume = Math.max(0, Math.min(1, volumeScale));
        const baseVolume = this.baseVolumeByElement.get(audio) ?? 1;
        const blend = this.loopBlendByElement.get(audio) ?? 1;
        const finalVolume = Math.max(0, Math.min(1, clampedVolume * baseVolume * blend * this.soundVolume));

        if (nodes) {
            nodes.gainNode.gain.value = finalVolume;
            if (nodes.stereoPannerNode) {
                nodes.stereoPannerNode.pan.value = clampedPan;
            }
            audio.volume = 1;
            return;
        }

        audio.volume = finalVolume;
    }

    private applySpatialAudioToLoopPair(
        loopPair: LoopPairState,
        sourcePositionWorld: Vector2D | null,
        listenerView: AudioListenerView | null
    ): void {
        this.applySpatialAudio(loopPair.active, sourcePositionWorld, listenerView);
        this.applySpatialAudio(loopPair.inactive, sourcePositionWorld, listenerView);
    }

    private ensureSpatialAudioNodes(audio: HTMLAudioElement): SpatialAudioNodes | null {
        const cachedNodes = this.spatialAudioNodesByElement.get(audio);
        if (cachedNodes) {
            return cachedNodes;
        }

        const context = this.getAudioContext();
        if (!context) {
            return null;
        }

        try {
            const mediaSourceNode = context.createMediaElementSource(audio);
            const gainNode = context.createGain();
            let stereoPannerNode: StereoPannerNode | null = null;

            if (typeof context.createStereoPanner === 'function') {
                stereoPannerNode = context.createStereoPanner();
                mediaSourceNode.connect(stereoPannerNode);
                stereoPannerNode.connect(gainNode);
            } else {
                mediaSourceNode.connect(gainNode);
            }

            gainNode.connect(context.destination);

            const nodes: SpatialAudioNodes = { gainNode, stereoPannerNode };
            this.spatialAudioNodesByElement.set(audio, nodes);
            return nodes;
        } catch {
            return null;
        }
    }

    private getAudioContext(): AudioContext | null {
        if (this.audioContext) {
            return this.audioContext;
        }
        if (typeof window.AudioContext === 'function') {
            this.audioContext = new window.AudioContext();
            return this.audioContext;
        }
        return null;
    }

    private ensureLoopPlaying(audio: HTMLAudioElement): void {
        if (!this.isSoundEnabled || !audio.paused) {
            return;
        }
        void audio.play().catch(() => undefined);
    }

    private ensureLoopPairPlaying(loopPair: LoopPairState): void {
        this.ensureLoopPlaying(loopPair.active);
    }

    private updateLoopCrossfade(loopPair: LoopPairState): void {
        const active = loopPair.active;
        const duration = active.duration;
        if (!Number.isFinite(duration) || duration <= LOOP_CROSSFADE_DURATION_SEC) {
            this.loopBlendByElement.set(active, 1);
            this.loopBlendByElement.set(loopPair.inactive, 0);
            return;
        }

        const crossfadeStart = duration - LOOP_CROSSFADE_DURATION_SEC;
        if (active.currentTime < crossfadeStart) {
            this.loopBlendByElement.set(active, 1);
            this.loopBlendByElement.set(loopPair.inactive, 0);
            if (!loopPair.inactive.paused) {
                loopPair.inactive.pause();
                loopPair.inactive.currentTime = 0;
            }
            return;
        }

        if (loopPair.inactive.paused) {
            loopPair.inactive.currentTime = 0;
            void loopPair.inactive.play().catch(() => undefined);
        }

        const progress = Math.max(0, Math.min(1, (active.currentTime - crossfadeStart) / LOOP_CROSSFADE_DURATION_SEC));
        this.loopBlendByElement.set(active, 1 - progress);
        this.loopBlendByElement.set(loopPair.inactive, progress);

        if (progress >= 1) {
            active.pause();
            active.currentTime = 0;
            this.loopBlendByElement.set(active, 0);

            loopPair.active = loopPair.inactive;
            loopPair.inactive = active;
            this.loopBlendByElement.set(loopPair.active, 1);
            this.loopBlendByElement.set(loopPair.inactive, 0);
        }
    }

    private stopLoop(audio: HTMLAudioElement): void {
        if (audio.paused) {
            return;
        }
        audio.pause();
        audio.currentTime = 0;
    }

    private stopLoopPair(loopPair: LoopPairState): void {
        this.stopLoop(loopPair.active);
        this.stopLoop(loopPair.inactive);
        this.loopBlendByElement.set(loopPair.active, 1);
        this.loopBlendByElement.set(loopPair.inactive, 0);
    }

    private stopAllAudio(): void {
        this.stopLoopPair(this.marineFiringLoopState);
        this.stopLoopPair(this.gatlingTowerFiringLoopState);
        this.stopLoop(this.forgeCrunchAudio);
        this.stopLoop(this.forgeChargeAudio);
        this.stopLoop(this.foundryPowerUpAudio);
        this.stopLoop(this.foundryPowerDownAudio);
        for (const pool of this.starlingAttackAudioPoolByFaction.values()) {
            for (const audio of pool) {
                this.stopLoop(audio);
            }
        }
    }
}
