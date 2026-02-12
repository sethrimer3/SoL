export type MenuScreenAudioState =
    | 'main'
    | 'maps'
    | 'settings'
    | 'faction-select'
    | 'loadout-customization'
    | 'loadout-select'
    | 'game-mode-select'
    | 'lan'
    | 'online'
    | 'p2p'
    | 'p2p-host'
    | 'p2p-join'
    | 'match-history'
    | 'custom-lobby'
    | '2v2-matchmaking'
    | 'lobby-detail';

type TrackId =
    | 'constant-piano'
    | 'main-menu'
    | 'faction-selection'
    | 'game-mode-selection'
    | 'ambient-1'
    | 'searching-for-match'
    | 'sun-rumble-left'
    | 'sun-rumble-right';

const TRACK_PATH_BY_ID: Record<TrackId, string> = {
    'constant-piano': 'ASSETS/music/Music_Constant_Piano.ogg',
    'main-menu': 'ASSETS/music/Music_Main_Menu.ogg',
    'faction-selection': 'ASSETS/music/Music_Faction_Selection.ogg',
    'game-mode-selection': 'ASSETS/music/Music_Gamemode_Selection.ogg',
    'ambient-1': 'ASSETS/music/Music_Ambient_1.ogg',
    'searching-for-match': 'ASSETS/music/Music_Searching_For_Match.ogg',
    'sun-rumble-left': 'ASSETS/SFX/SoL_Ambient_Sun_Rumble.mp3',
    'sun-rumble-right': 'ASSETS/SFX/SoL_Ambient_Sun_Rumble.mp3',
};

interface AudioTrack {
    element: HTMLAudioElement;
    crossfadeElement: HTMLAudioElement | null;
    targetVolume: number;
    smoothedVolume: number;
    isPlaying: boolean;
    hasEndedListener: boolean;
    hasCanPlayThroughListener: boolean;
    isCrossfadeActive: boolean;
}

const LOOP_DURATION_SEC = 26;
const LOOP_CROSSFADE_DURATION_SEC = 2;
const LOOP_CROSSFADE_START_SEC = LOOP_DURATION_SEC - LOOP_CROSSFADE_DURATION_SEC;

export class MenuAudioController {
    private readonly resolveAssetPath: (path: string) => string;
    private readonly tracksById: Record<TrackId, AudioTrack>;
    private animationFrameId: number | null = null;
    private hasInteractionUnlock = false;
    private isMusicEnabled = true;
    private isVisible = false;
    private currentScreen: MenuScreenAudioState = 'main';
    private isMatchmakingSearching = false;
    private sunFocusLevel = 0.05;
    private sunCenterNormalizedX = 0;
    private sunCenterNormalizedY = 0;

    constructor(resolveAssetPath: (path: string) => string) {
        this.resolveAssetPath = resolveAssetPath;
        this.tracksById = this.createTracks();
    }


    public async preloadTracks(): Promise<void> {
        const preloadPromises: Promise<void>[] = [];
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            preloadPromises.push(this.preloadTrack(trackId));
        }
        await Promise.all(preloadPromises);
    }

    public setVisible(isVisible: boolean): void {
        this.isVisible = isVisible;
        this.updateTargetVolumes();
        this.ensurePlaybackState();
    }

    public setMusicEnabled(isMusicEnabled: boolean): void {
        this.isMusicEnabled = isMusicEnabled;
        this.updateTargetVolumes();
        this.ensurePlaybackState();
    }

    public setScreen(screen: MenuScreenAudioState, isMatchmakingSearching: boolean): void {
        this.currentScreen = screen;
        this.isMatchmakingSearching = isMatchmakingSearching;
        this.updateTargetVolumes();
    }

    public setSunRumbleContext(sunFocusLevel: number, sunCenterNormalizedX: number, sunCenterNormalizedY: number): void {
        this.sunFocusLevel = Math.max(0, Math.min(1, sunFocusLevel));
        this.sunCenterNormalizedX = Math.max(0, Math.min(1, sunCenterNormalizedX));
        this.sunCenterNormalizedY = Math.max(0, Math.min(1, sunCenterNormalizedY));
        this.updateTargetVolumes();
    }

    public unlockFromUserGesture(): void {
        if (this.hasInteractionUnlock) {
            return;
        }
        this.hasInteractionUnlock = true;
        this.ensurePlaybackState();
        this.startAnimationLoop();
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            const track = this.tracksById[trackId];
            track.element.pause();
            track.element.src = '';
            if (track.crossfadeElement) {
                track.crossfadeElement.pause();
                track.crossfadeElement.src = '';
            }
        }
    }

    private createTracks(): Record<TrackId, AudioTrack> {
        const tracksById = {} as Record<TrackId, AudioTrack>;
        for (const trackId of Object.keys(TRACK_PATH_BY_ID) as TrackId[]) {
            const element = new Audio(this.resolveAssetPath(TRACK_PATH_BY_ID[trackId]));
            const crossfadeElement = this.isCrossfadeTrack(trackId)
                ? new Audio(this.resolveAssetPath(TRACK_PATH_BY_ID[trackId]))
                : null;
            element.loop = !this.isCrossfadeTrack(trackId);
            element.preload = 'auto';
            element.volume = 0;
            if (crossfadeElement) {
                crossfadeElement.loop = false;
                crossfadeElement.preload = 'auto';
                crossfadeElement.volume = 0;
            }
            tracksById[trackId] = {
                element,
                crossfadeElement,
                targetVolume: 0,
                smoothedVolume: 0,
                isPlaying: false,
                hasEndedListener: false,
                hasCanPlayThroughListener: false,
                isCrossfadeActive: false,
            };
        }
        return tracksById;
    }

    private isCrossfadeTrack(trackId: TrackId): boolean {
        return trackId !== 'sun-rumble-left' && trackId !== 'sun-rumble-right';
    }


    private preloadTrack(trackId: TrackId): Promise<void> {
        const track = this.tracksById[trackId];
        const element = track.element;

        if (element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const cleanup = () => {
                element.removeEventListener('canplaythrough', onCanPlayThrough);
                element.removeEventListener('error', onError);
                track.crossfadeElement?.removeEventListener('canplaythrough', onCanPlayThrough);
                track.crossfadeElement?.removeEventListener('error', onError);
                track.hasCanPlayThroughListener = false;
            };

            const onCanPlayThrough = () => {
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                resolve();
            };

            if (!track.hasCanPlayThroughListener) {
                element.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
                element.addEventListener('error', onError, { once: true });
                track.crossfadeElement?.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
                track.crossfadeElement?.addEventListener('error', onError, { once: true });
                track.hasCanPlayThroughListener = true;
            }

            element.load();
            track.crossfadeElement?.load();
        });
    }

    private updateTargetVolumes(): void {
        const targetVolumesById: Record<TrackId, number> = {
            'constant-piano': 0,
            'main-menu': 0,
            'faction-selection': 0,
            'game-mode-selection': 0,
            'ambient-1': 0,
            'searching-for-match': 0,
            'sun-rumble-left': 0,
            'sun-rumble-right': 0,
        };

        if (!this.isMusicEnabled || !this.isVisible) {
            this.applyTargetVolumes(targetVolumesById);
            return;
        }

        const isLobbyOrSearching =
            this.currentScreen === 'custom-lobby' ||
            this.currentScreen === 'lobby-detail' ||
            this.currentScreen === 'lan' ||
            this.currentScreen === 'p2p' ||
            this.currentScreen === 'p2p-host' ||
            this.currentScreen === 'p2p-join' ||
            this.isMatchmakingSearching;

        if (isLobbyOrSearching) {
            targetVolumesById['searching-for-match'] = 0.9;
        } else {
            targetVolumesById['constant-piano'] = 0.65;
            targetVolumesById['main-menu'] = this.currentScreen === 'main' ? 0.62 : 0;
            targetVolumesById['faction-selection'] = this.currentScreen === 'faction-select' ? 0.75 : 0;
            targetVolumesById['game-mode-selection'] = this.currentScreen === 'game-mode-select' ? 0.78 : 0;
            targetVolumesById['ambient-1'] = this.currentScreen === 'settings' ? 0.6 : 0;
        }

        const screenCenterDistance = Math.hypot(this.sunCenterNormalizedX - 0.5, this.sunCenterNormalizedY - 0.5);
        const normalizedDistance = Math.max(0, Math.min(1, screenCenterDistance / 0.7071));
        const centerPresence = 1 - normalizedDistance;
        const rumbleTotalVolume = 0.01 + 0.18 * (this.sunFocusLevel * 0.7 + centerPresence * 0.3);
        const panValue = Math.max(-1, Math.min(1, (this.sunCenterNormalizedX - 0.5) * 2));
        const leftGain = Math.max(0, Math.min(1, (1 - panValue) * 0.5));
        const rightGain = Math.max(0, Math.min(1, (1 + panValue) * 0.5));
        targetVolumesById['sun-rumble-left'] = rumbleTotalVolume * leftGain;
        targetVolumesById['sun-rumble-right'] = rumbleTotalVolume * rightGain;

        this.applyTargetVolumes(targetVolumesById);
    }

    private applyTargetVolumes(targetVolumesById: Record<TrackId, number>): void {
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            this.tracksById[trackId].targetVolume = targetVolumesById[trackId];
        }
    }

    private ensurePlaybackState(): void {
        if (!this.hasInteractionUnlock) {
            return;
        }
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            const track = this.tracksById[trackId];
            const shouldBeAudible = track.targetVolume > 0.001;
            if (shouldBeAudible && !track.isPlaying) {
                void track.element.play().then(() => {
                    track.isPlaying = true;
                }).catch(() => {
                    track.isPlaying = false;
                });
            }
            if (!shouldBeAudible && track.isPlaying && track.element.volume <= 0.001) {
                track.element.pause();
                if (track.crossfadeElement) {
                    track.crossfadeElement.pause();
                    track.crossfadeElement.currentTime = 0;
                }
                track.isCrossfadeActive = false;
                track.isPlaying = false;
            }
            if (!this.isCrossfadeTrack(trackId)) {
                this.ensureLoopConsistency(trackId);
            }
        }
    }

    private ensureLoopConsistency(trackId: TrackId): void {
        const track = this.tracksById[trackId];
        if (track.hasEndedListener) {
            return;
        }
        track.hasEndedListener = true;
        track.element.addEventListener('ended', () => {
            track.element.currentTime = 0;
            if (track.targetVolume > 0.001) {
                void track.element.play();
            }
        });
    }

    private startAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            return;
        }
        const updateAudioFrame = () => {
            this.syncLayerProgress();
            this.updateLoopCrossfades();
            this.interpolateVolumes();
            this.ensurePlaybackState();
            this.animationFrameId = requestAnimationFrame(updateAudioFrame);
        };
        this.animationFrameId = requestAnimationFrame(updateAudioFrame);
    }

    private syncLayerProgress(): void {
        const referenceTrack = this.tracksById['constant-piano'];
        const referenceDurationSec = referenceTrack.element.duration;
        if (!Number.isFinite(referenceDurationSec) || referenceDurationSec <= 0) {
            return;
        }
        const normalizedProgress = (referenceTrack.element.currentTime % referenceDurationSec) / referenceDurationSec;
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            if (trackId === 'sun-rumble-left' || trackId === 'sun-rumble-right' || trackId === 'constant-piano') {
                continue;
            }
            const track = this.tracksById[trackId];
            if (track.isCrossfadeActive) {
                continue;
            }
            const durationSec = track.element.duration;
            if (!Number.isFinite(durationSec) || durationSec <= 0) {
                continue;
            }
            const desiredTimeSec = normalizedProgress * durationSec;
            const deltaSec = Math.abs(track.element.currentTime - desiredTimeSec);
            if (deltaSec > 0.25) {
                track.element.currentTime = desiredTimeSec;
            }
        }
    }

    private interpolateVolumes(): void {
        const smoothFactor = 0.03;
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            const track = this.tracksById[trackId];
            const nextVolume = track.smoothedVolume + (track.targetVolume - track.smoothedVolume) * smoothFactor;
            track.smoothedVolume = Math.max(0, Math.min(1, nextVolume));
            if (!track.isCrossfadeActive || !track.crossfadeElement) {
                track.element.volume = track.smoothedVolume;
                continue;
            }

            const crossfadeProgress = Math.max(
                0,
                Math.min(1, (track.element.currentTime - LOOP_CROSSFADE_START_SEC) / LOOP_CROSSFADE_DURATION_SEC)
            );
            track.element.volume = track.smoothedVolume * (1 - crossfadeProgress);
            track.crossfadeElement.volume = track.smoothedVolume * crossfadeProgress;
        }
    }

    private updateLoopCrossfades(): void {
        for (const trackId of Object.keys(this.tracksById) as TrackId[]) {
            const track = this.tracksById[trackId];
            const crossfadeElement = track.crossfadeElement;
            if (!crossfadeElement || !track.isPlaying) {
                continue;
            }

            if (!track.isCrossfadeActive && track.element.currentTime >= LOOP_CROSSFADE_START_SEC) {
                track.isCrossfadeActive = true;
                crossfadeElement.currentTime = 0;
                crossfadeElement.volume = 0;
                void crossfadeElement.play().catch(() => undefined);
            }

            if (track.isCrossfadeActive && track.element.currentTime >= LOOP_DURATION_SEC) {
                track.element.pause();
                track.element.currentTime = 0;
                track.element.volume = 0;

                const previousPrimary = track.element;
                track.element = crossfadeElement;
                track.crossfadeElement = previousPrimary;
                track.isCrossfadeActive = false;
            }
        }
    }
}
