import * as Constants from './constants';
import { Faction, GameState, GatlingTower, Marine, SubsidiaryFactory, Vector2D } from './game-core';

const FORGE_CHARGE_LEAD_TIME_SEC = 5;
const STARLING_ATTACK_MIN_INTERVAL_SEC = 0.12;
const FORGE_CRUNCH_MIN_INTERVAL_SEC = 0.35;
const OFFSCREEN_VOLUME_FALLOFF_DISTANCE_FACTOR = 0.75;

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

export class GameAudioController {
    private readonly starlingAttackAudioByFaction = new Map<Faction, HTMLAudioElement>();
    private readonly marineFiringLoopAudio: HTMLAudioElement;
    private readonly gatlingTowerFiringLoopAudio: HTMLAudioElement;
    private readonly forgeCrunchAudio: HTMLAudioElement;
    private readonly forgeChargeAudio: HTMLAudioElement;
    private readonly foundryPowerUpAudio: HTMLAudioElement;
    private readonly foundryPowerDownAudio: HTMLAudioElement;

    private readonly forgeChargePlayedByForge = new WeakMap<object, boolean>();
    private readonly forgeWasCrunchingByForge = new WeakMap<object, boolean>();
    private readonly foundryWasUpgrading = new WeakMap<object, boolean>();
    private readonly spatialAudioNodesByElement = new WeakMap<HTMLAudioElement, SpatialAudioNodes>();

    private marineLoopGraceRemainingSec = 0;
    private starlingAttackCooldownRemainingSec = 0;
    private forgeCrunchCooldownRemainingSec = 0;
    private isSoundEnabled = true;
    private audioContext: AudioContext | null = null;

    constructor() {
        this.starlingAttackAudioByFaction.set(Faction.RADIANT, this.createAudio('ASSETS/SFX/radiantSFX/starling_firing.mp3'));
        this.starlingAttackAudioByFaction.set(Faction.AURUM, this.createAudio('ASSETS/SFX/aurumSFX/starling_firing.mp3'));
        this.starlingAttackAudioByFaction.set(Faction.VELARIS, this.createAudio('ASSETS/SFX/velarisSFX/starling_firing.mp3'));

        this.marineFiringLoopAudio = this.createAudio('ASSETS/SFX/radiantSFX/hero_marine_firing.ogg', true);
        this.gatlingTowerFiringLoopAudio = this.createAudio('ASSETS/SFX/radiantSFX/gatling_firing.ogg', true);
        this.forgeCrunchAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_crunch.ogg');
        this.forgeChargeAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_charge.ogg');
        this.foundryPowerUpAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_up.ogg');
        this.foundryPowerDownAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_down.ogg');
    }

    setSoundEnabled(isEnabled: boolean): void {
        this.isSoundEnabled = isEnabled;
        if (!isEnabled) {
            this.stopAllAudio();
        }
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
                    this.playOneShot(this.forgeCrunchAudio, forge.position, listenerView, true);
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
            const starlingAudio = this.starlingAttackAudioByFaction.get(starlingFactionWithAttack);
            if (starlingAudio) {
                this.playOneShot(starlingAudio, starlingSoundSource, listenerView);
                this.starlingAttackCooldownRemainingSec = STARLING_ATTACK_MIN_INTERVAL_SEC;
            }
        }

        if (didMarineFireThisFrame) {
            this.marineLoopGraceRemainingSec = 0.2;
            this.applySpatialAudio(this.marineFiringLoopAudio, marineSoundSource, listenerView);
            this.ensureLoopPlaying(this.marineFiringLoopAudio);
        } else {
            this.marineLoopGraceRemainingSec = Math.max(0, this.marineLoopGraceRemainingSec - deltaTimeSec);
            if (this.marineLoopGraceRemainingSec <= 0) {
                this.stopLoop(this.marineFiringLoopAudio);
            }
        }

        if (didGatlingTowerFireThisFrame) {
            this.applySpatialAudio(this.gatlingTowerFiringLoopAudio, gatlingSoundSource, listenerView);
            this.ensureLoopPlaying(this.gatlingTowerFiringLoopAudio);
        } else {
            this.stopLoop(this.gatlingTowerFiringLoopAudio);
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
        return audio;
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

    private applySpatialMix(audio: HTMLAudioElement, pan: number, volumeScale: number): void {
        const nodes = this.ensureSpatialAudioNodes(audio);
        const clampedPan = Math.max(-1, Math.min(1, pan));
        const clampedVolume = Math.max(0, Math.min(1, volumeScale));

        if (nodes) {
            nodes.gainNode.gain.value = clampedVolume;
            if (nodes.stereoPannerNode) {
                nodes.stereoPannerNode.pan.value = clampedPan;
            }
            audio.volume = 1;
            return;
        }

        audio.volume = clampedVolume;
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

    private stopLoop(audio: HTMLAudioElement): void {
        if (audio.paused) {
            return;
        }
        audio.pause();
        audio.currentTime = 0;
    }

    private stopAllAudio(): void {
        this.stopLoop(this.marineFiringLoopAudio);
        this.stopLoop(this.gatlingTowerFiringLoopAudio);
        this.stopLoop(this.forgeCrunchAudio);
        this.stopLoop(this.forgeChargeAudio);
        this.stopLoop(this.foundryPowerUpAudio);
        this.stopLoop(this.foundryPowerDownAudio);
        for (const audio of this.starlingAttackAudioByFaction.values()) {
            this.stopLoop(audio);
        }
    }
}
