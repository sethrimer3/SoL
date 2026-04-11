import * as Constants from './constants';
import { Faction, GameState, GatlingTower, Marine, Minigun, LockOnLaserTower, SubsidiaryFactory, Vector2D } from './game-core';

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
const BLOCKED_PING_BASE_VOLUME = 0.32;

// Stub volumes – placeholder values until final assets are tuned
const MINIGUN_LOOP_BASE_VOLUME = 0.35;
const LOCK_ON_LASER_BASE_VOLUME = 0.45;
const EXPLOSION_BASE_VOLUME = 0.5;
const MORTAR_LAUNCH_BASE_VOLUME = 0.35;
const CRESCENT_WAVE_BASE_VOLUME = 0.4;
const UNIT_DEATH_BASE_VOLUME = 0.3;
const UNIT_DEATH_MAX_SIMULTANEOUS = 3;
const BUILDING_DESTROYED_BASE_VOLUME = 0.5;
const WARP_GATE_BASE_VOLUME = 0.35;
const COUNTDOWN_TICK_BASE_VOLUME = 0.7;
const MATCH_START_BASE_VOLUME = 0.6;
const EXPLOSION_MAX_SIMULTANEOUS = 4;

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
    private readonly minigunFiringLoopState: LoopPairState;
    private readonly forgeCrunchAudio: HTMLAudioElement;
    private readonly forgeChargeAudio: HTMLAudioElement;
    private readonly foundryPowerUpAudio: HTMLAudioElement;
    private readonly foundryPowerDownAudio: HTMLAudioElement;
    private readonly blockedPingAudioPool: HTMLAudioElement[];
    // Stub SFX – mapped to existing assets as placeholders until dedicated sounds are created
    private readonly lockOnLaserAudioPool: HTMLAudioElement[];
    private readonly explosionAudioPool: HTMLAudioElement[];
    private readonly mortarLaunchAudio: HTMLAudioElement;
    private readonly crescentWaveAudio: HTMLAudioElement;
    private readonly unitDeathAudioPool: HTMLAudioElement[];
    private readonly buildingDestroyedAudio: HTMLAudioElement;
    private readonly warpGateAudio: HTMLAudioElement;
    private readonly countdownTickAudio: HTMLAudioElement;
    private readonly matchStartAudio: HTMLAudioElement;

    private readonly playedBlockedDamageNumbers = new WeakSet<object>();
    // Stub tracking – WeakSets so GC can reclaim removed entities automatically
    private readonly playedLockOnLaserBeams = new WeakSet<object>();
    private readonly playedStrikerExplosions = new WeakSet<object>();
    private readonly playedMiniMothershipExplosions = new WeakSet<object>();
    private readonly playedMortarProjectiles = new WeakSet<object>();
    private readonly playedCrescentWaves = new WeakSet<object>();

    private readonly forgeChargePlayedByForge = new WeakMap<object, boolean>();
    private readonly forgeWasCrunchingByForge = new WeakMap<object, boolean>();
    private readonly foundryWasUpgrading = new WeakMap<object, boolean>();
    private readonly prevUnitCountByPlayer = new WeakMap<object, number>();
    private readonly prevBuildingCountByPlayer = new WeakMap<object, number>();
    private readonly spatialAudioNodesByElement = new WeakMap<HTMLAudioElement, SpatialAudioNodes>();
    private readonly baseVolumeByElement = new WeakMap<HTMLAudioElement, number>();
    private readonly loopBlendByElement = new WeakMap<HTMLAudioElement, number>();

    private marineLoopGraceRemainingSec = 0;
    private minigunLoopGraceRemainingSec = 0;
    private starlingAttackCooldownRemainingSec = 0;
    private forgeCrunchCooldownRemainingSec = 0;
    private prevCountdownSecond = 4;
    private wasCountdownActive = true;
    private isSoundEnabled = true;
    private isFocusMuted = false;
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
        // Stub: minigun uses the marine firing sound as a placeholder until a dedicated asset exists
        this.minigunFiringLoopState = this.createCrossfadeLoopPair('ASSETS/SFX/radiantSFX/hero_marine_firing.ogg', MINIGUN_LOOP_BASE_VOLUME);
        this.forgeCrunchAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_crunch.ogg');
        this.forgeChargeAudio = this.createAudio('ASSETS/SFX/radiantSFX/forge_charge.ogg');
        this.baseVolumeByElement.set(this.forgeChargeAudio, FORGE_CHARGE_BASE_VOLUME);
        this.foundryPowerUpAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_up.ogg');
        this.foundryPowerDownAudio = this.createAudio('ASSETS/SFX/radiantSFX/foundry_charge_down.ogg');
        this.blockedPingAudioPool = [
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (1).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (2).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (3).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (4).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (5).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (6).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (7).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (8).wav'),
            this.createAudio('ASSETS/SFX/allFactionsSFX/ping (9).wav')
        ];
        for (const pingAudio of this.blockedPingAudioPool) {
            this.baseVolumeByElement.set(pingAudio, BLOCKED_PING_BASE_VOLUME);
        }

        // Stub SFX – each references an existing asset as a placeholder.
        // Replace with dedicated audio files when available.
        this.lockOnLaserAudioPool = this.createOneShotPool(
            'ASSETS/SFX/radiantSFX/forge_charge.ogg', 2, LOCK_ON_LASER_BASE_VOLUME
        );
        this.explosionAudioPool = this.createOneShotPool(
            'ASSETS/SFX/Echo_Sound_Effects.mp3', EXPLOSION_MAX_SIMULTANEOUS, EXPLOSION_BASE_VOLUME
        );
        this.mortarLaunchAudio = this.createAudio('ASSETS/SFX/environment/lordsonny-punch-a-rock-161647.mp3');
        this.baseVolumeByElement.set(this.mortarLaunchAudio, MORTAR_LAUNCH_BASE_VOLUME);
        this.crescentWaveAudio = this.createAudio('ASSETS/SFX/Echo_Sound_Effects (2).mp3');
        this.baseVolumeByElement.set(this.crescentWaveAudio, CRESCENT_WAVE_BASE_VOLUME);
        this.unitDeathAudioPool = this.createOneShotPool(
            'ASSETS/SFX/environment/lordsonny-small-rock-break-194553.mp3', UNIT_DEATH_MAX_SIMULTANEOUS, UNIT_DEATH_BASE_VOLUME
        );
        this.buildingDestroyedAudio = this.createAudio('ASSETS/SFX/environment/lordsonny-rock-cinematic-161648.mp3');
        this.baseVolumeByElement.set(this.buildingDestroyedAudio, BUILDING_DESTROYED_BASE_VOLUME);
        this.warpGateAudio = this.createAudio('ASSETS/SFX/THERO/note_D#.mp3');
        this.baseVolumeByElement.set(this.warpGateAudio, WARP_GATE_BASE_VOLUME);
        this.countdownTickAudio = this.createAudio('ASSETS/SFX/SFX_Timer_Tick.m4a');
        this.baseVolumeByElement.set(this.countdownTickAudio, COUNTDOWN_TICK_BASE_VOLUME);
        this.matchStartAudio = this.createAudio('ASSETS/SFX/THERO/enterGameMode.mp3');
        this.baseVolumeByElement.set(this.matchStartAudio, MATCH_START_BASE_VOLUME);
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

    /** Silently mute/unmute all in-game audio (e.g. when the tab loses focus). */
    setFocusMuted(isMuted: boolean): void {
        if (isMuted) {
            this.stopAllAudio();
        }
        this.isFocusMuted = isMuted;
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
        let didMinigunFireThisFrame = false;
        let minigunSoundSource: Vector2D | null = null;

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

                if (building instanceof Minigun && building.target) {
                    const distanceToTarget = building.position.distanceTo(building.target.position);
                    if (distanceToTarget <= building.attackRange + 1) {
                        didMinigunFireThisFrame = true;
                        minigunSoundSource = building.position;
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

            // Unit and building death detection
            const prevUnitCount = this.prevUnitCountByPlayer.get(player) ?? player.units.length;
            if (player.units.length < prevUnitCount) {
                this.playOneShotFromPool(this.unitDeathAudioPool, null, listenerView);
            }
            this.prevUnitCountByPlayer.set(player, player.units.length);

            const prevBuildingCount = this.prevBuildingCountByPlayer.get(player) ?? player.buildings.length;
            if (player.buildings.length < prevBuildingCount) {
                this.playOneShot(this.buildingDestroyedAudio, null, listenerView);
            }
            this.prevBuildingCountByPlayer.set(player, player.buildings.length);
        }

        for (const laserBeam of game.laserBeams) {
            if (laserBeam.owner.faction) {
                starlingFactionWithAttack = laserBeam.owner.faction;
                starlingSoundSource = laserBeam.startPos;
                break;
            }
        }

        // LockOnLaserTower fires beams with a distinctive wider width
        for (const laserBeam of game.laserBeams) {
            if (laserBeam.widthPx === Constants.LOCKON_TOWER_LASER_WIDTH_PX && !this.playedLockOnLaserBeams.has(laserBeam)) {
                this.playedLockOnLaserBeams.add(laserBeam);
                this.playOneShotFromPool(this.lockOnLaserAudioPool, laserBeam.startPos, listenerView);
            }
        }

        if (starlingFactionWithAttack && this.starlingAttackCooldownRemainingSec <= 0) {
            const starlingAudioPool = this.starlingAttackAudioPoolByFaction.get(starlingFactionWithAttack);
            if (starlingAudioPool && this.playOneShotFromPool(starlingAudioPool, starlingSoundSource, listenerView)) {
                this.starlingAttackCooldownRemainingSec = STARLING_ATTACK_MIN_INTERVAL_SEC;
            }
        }

        for (const damageNumber of game.damageNumbers) {
            if (!damageNumber.isBlocked) {
                continue;
            }
            if (this.playedBlockedDamageNumbers.has(damageNumber)) {
                continue;
            }
            this.playedBlockedDamageNumbers.add(damageNumber);
            const randomIndex = Math.floor(Math.random() * this.blockedPingAudioPool.length);
            const pingAudio = this.blockedPingAudioPool[randomIndex];
            this.playOneShot(pingAudio, damageNumber.position, listenerView, true);
        }

        // Striker tower missile explosions
        for (const explosion of game.strikerTowerExplosions) {
            if (!this.playedStrikerExplosions.has(explosion)) {
                this.playedStrikerExplosions.add(explosion);
                this.playOneShotFromPool(this.explosionAudioPool, explosion.position, listenerView);
            }
        }

        // Mini-mothership explosions
        for (const explosion of game.miniMothershipExplosions) {
            if (!this.playedMiniMothershipExplosions.has(explosion)) {
                this.playedMiniMothershipExplosions.add(explosion);
                this.playOneShotFromPool(this.explosionAudioPool, explosion.position, listenerView);
            }
        }

        // Mortar projectile launches (new projectile objects)
        for (const mortar of game.mortarProjectiles) {
            if (!this.playedMortarProjectiles.has(mortar)) {
                this.playedMortarProjectiles.add(mortar);
                this.playOneShot(this.mortarLaunchAudio, mortar.position, listenerView);
            }
        }

        // Crescent wave casts
        for (const wave of game.crescentWaves) {
            if (!this.playedCrescentWaves.has(wave)) {
                this.playedCrescentWaves.add(wave);
                this.playOneShot(this.crescentWaveAudio, wave.position, listenerView);
            }
        }

        // Countdown ticks (3, 2, 1) and match-start sound
        if (game.isCountdownActive) {
            const currentSecond = Math.ceil(game.countdownTime);
            if (currentSecond < this.prevCountdownSecond && currentSecond >= 1) {
                this.playOneShot(this.countdownTickAudio, null, null);
            }
            this.prevCountdownSecond = currentSecond;
            this.wasCountdownActive = true;
        } else if (this.wasCountdownActive) {
            this.wasCountdownActive = false;
            this.prevCountdownSecond = 4;
            this.playOneShot(this.matchStartAudio, null, null);
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

        if (didMinigunFireThisFrame) {
            this.minigunLoopGraceRemainingSec = 0.2;
            this.applySpatialAudioToLoopPair(this.minigunFiringLoopState, minigunSoundSource, listenerView);
            this.ensureLoopPairPlaying(this.minigunFiringLoopState);
            this.updateLoopCrossfade(this.minigunFiringLoopState);
        } else {
            this.minigunLoopGraceRemainingSec = Math.max(0, this.minigunLoopGraceRemainingSec - deltaTimeSec);
            if (this.minigunLoopGraceRemainingSec <= 0) {
                this.stopLoopPair(this.minigunFiringLoopState);
            }
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
        if (!this.isSoundEnabled || this.isFocusMuted) {
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
        this.stopLoopPair(this.minigunFiringLoopState);
        this.stopLoop(this.forgeCrunchAudio);
        this.stopLoop(this.forgeChargeAudio);
        this.stopLoop(this.foundryPowerUpAudio);
        this.stopLoop(this.foundryPowerDownAudio);
        this.stopLoop(this.mortarLaunchAudio);
        this.stopLoop(this.crescentWaveAudio);
        this.stopLoop(this.buildingDestroyedAudio);
        this.stopLoop(this.warpGateAudio);
        this.stopLoop(this.countdownTickAudio);
        this.stopLoop(this.matchStartAudio);
        for (const pool of this.starlingAttackAudioPoolByFaction.values()) {
            for (const audio of pool) {
                this.stopLoop(audio);
            }
        }
        for (const audio of this.lockOnLaserAudioPool) {
            this.stopLoop(audio);
        }
        for (const audio of this.explosionAudioPool) {
            this.stopLoop(audio);
        }
        for (const audio of this.unitDeathAudioPool) {
            this.stopLoop(audio);
        }
    }
}
