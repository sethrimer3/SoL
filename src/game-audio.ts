import * as Constants from './constants';
import { Faction, GameState, GatlingTower, Marine, SubsidiaryFactory } from './game-core';

const FORGE_CHARGE_LEAD_TIME_SEC = 5;
const STARLING_ATTACK_MIN_INTERVAL_SEC = 0.12;
const FORGE_CRUNCH_MIN_INTERVAL_SEC = 0.35;

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

    private marineLoopGraceRemainingSec = 0;
    private starlingAttackCooldownRemainingSec = 0;
    private forgeCrunchCooldownRemainingSec = 0;
    private isSoundEnabled = true;

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

    update(game: GameState, deltaTimeSec: number): void {
        this.starlingAttackCooldownRemainingSec = Math.max(0, this.starlingAttackCooldownRemainingSec - deltaTimeSec);
        this.forgeCrunchCooldownRemainingSec = Math.max(0, this.forgeCrunchCooldownRemainingSec - deltaTimeSec);

        let didMarineFireThisFrame = false;
        let starlingFactionWithAttack: Faction | null = null;
        let didGatlingTowerFireThisFrame = false;

        for (const player of game.players) {
            const forge = player.stellarForge;
            if (forge) {
                const isCrunching = forge.currentCrunch !== null;
                const wasCrunching = this.forgeWasCrunchingByForge.get(forge) === true;
                if (isCrunching && !wasCrunching) {
                    this.playOneShot(this.forgeCrunchAudio, true);
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
                    this.playOneShot(this.forgeChargeAudio);
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
                    this.playOneShot(this.foundryPowerUpAudio);
                } else if (!isUpgrading && wasUpgrading) {
                    this.playOneShot(this.foundryPowerDownAudio);
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
                    break;
                }
            }
        }

        for (const laserBeam of game.laserBeams) {
            if (laserBeam.owner.faction) {
                starlingFactionWithAttack = laserBeam.owner.faction;
                break;
            }
        }

        if (starlingFactionWithAttack && this.starlingAttackCooldownRemainingSec <= 0) {
            const starlingAudio = this.starlingAttackAudioByFaction.get(starlingFactionWithAttack);
            if (starlingAudio) {
                this.playOneShot(starlingAudio);
                this.starlingAttackCooldownRemainingSec = STARLING_ATTACK_MIN_INTERVAL_SEC;
            }
        }

        if (didMarineFireThisFrame) {
            this.marineLoopGraceRemainingSec = 0.2;
            this.ensureLoopPlaying(this.marineFiringLoopAudio);
        } else {
            this.marineLoopGraceRemainingSec = Math.max(0, this.marineLoopGraceRemainingSec - deltaTimeSec);
            if (this.marineLoopGraceRemainingSec <= 0) {
                this.stopLoop(this.marineFiringLoopAudio);
            }
        }

        if (didGatlingTowerFireThisFrame) {
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

    private playOneShot(audio: HTMLAudioElement, forceIgnoreCooldown: boolean = false): void {
        if (!this.isSoundEnabled) {
            return;
        }
        if (audio === this.forgeCrunchAudio && !forceIgnoreCooldown && this.forgeCrunchCooldownRemainingSec > 0) {
            return;
        }
        if (audio === this.forgeCrunchAudio) {
            this.forgeCrunchCooldownRemainingSec = FORGE_CRUNCH_MIN_INTERVAL_SEC;
        }
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
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
