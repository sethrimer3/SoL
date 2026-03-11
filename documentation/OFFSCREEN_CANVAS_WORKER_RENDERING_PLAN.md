# OffscreenCanvas & Web Worker Rendering — Implementation Plan

> **For AI Agents**: This is a live task-tracking document. As you complete each step, check it off by changing `- [ ]` to `- [x]`. After completing each step, add a brief `> **Agent note (YYYY-MM-DD):** <what you did>` line immediately below it. Before moving to the next phase, complete every verification checkbox in the current phase's "Phase Verification" section. Record each session in the [Agent Progress Log](#agent-progress-log) at the bottom of this file.
>
> **Do not skip steps.** Each step was written with knowledge of the actual code. If a step says to read a specific file or line range, do so before proceeding.
>
> **Stopping is fine.** Each phase is independently shippable. If you run out of context or hit a blocker, commit your progress, check off what is done, and leave a note explaining the blocker.

---

## Overview

The game renderer (`src/renderer.ts`) runs entirely on the main thread using Canvas 2D. Even with the existing quality-gating and caching optimisations, the star layer alone redraws ~4,840 individual star glyphs every frame. This plan migrates background layers off the main thread in four incrementally-shippable phases.

| Phase | What changes | Files touched | Difficulty | Prerequisite |
|-------|-------------|---------------|------------|--------------|
| 1 | Star layer frame cache (main thread) | `src/render/starfield-renderer.ts` | 2/10 | None |
| 2 | Sun body offscreen cache (main thread) | `src/render/sun-renderer.ts` | 4/10 | None |
| 3 | Star layer rendered in a Web Worker | `starfield-renderer.ts`, new `starfield-worker.ts`, new `starfield-worker-bridge.ts`, `renderer.ts` | 6/10 | Phase 1 |
| 4 | Sun rays rendered in a Web Worker | `sun-renderer.ts`, new `sun-ray-worker.ts`, new `sun-ray-worker-bridge.ts`, `renderer.ts` | 8/10 | Phase 3 |

**Recommended stopping point for a single agent session: end of Phase 3.**

---

## Phase 1 — Star Layer Frame Cache (Main Thread)

### Rationale

`StarfieldRenderer.drawReworkedParallaxStars()` ([`src/render/starfield-renderer.ts` L194–L267](https://github.com/sethrimer3/SoL/blob/main/src/render/starfield-renderer.ts#L194-L267)) currently redraws all ~4,840 stars on every frame directly to the game canvas. The legacy `drawStarfield()` method in the same class (L402–L510) already demonstrates a correct caching pattern: render to an offscreen `HTMLCanvasElement`, invalidate when the camera moves, and blit the cache with a single `drawImage`. The active reworked-parallax system just never adopted this pattern.

Stars flicker at 0.08–0.18 Hz. At 30 fps this is imperceptible. At low quality, a 200 ms cache TTL (5 fps redraw) is indistinguishable from per-frame drawing.

**No new files needed. One file changed.**

### Steps

- [x] **1.1 — Read the existing cache pattern** in `drawStarfield()` (L402–L510 of `src/render/starfield-renderer.ts`). Understand how `starfieldCacheCanvas`, `starfieldCacheCtx`, `starfieldCacheWidth/Height`, and `starfieldCacheCameraX/Y` are used. This is exactly the pattern you will replicate for the reworked system.
> **Agent note (2026-03-11):** Reviewed `drawStarfield()` first and reused its cache invalidation structure for the active reworked-parallax path.

- [x] **1.2 — Add cache state fields** to `StarfieldRenderer` alongside the existing `starfieldCacheCanvas` group (after L79). Add:
  ```typescript
  // Cache for reworked parallax star system
  private reworkedStarCacheCanvas: HTMLCanvasElement | null = null;
  private reworkedStarCacheCtx: CanvasRenderingContext2D | null = null;
  private reworkedStarCacheWidthPx = 0;
  private reworkedStarCacheHeightPx = 0;
  private reworkedStarCacheCameraX = Number.NaN;
  private reworkedStarCacheCameraY = Number.NaN;
  private reworkedStarCacheQuality: string = '';
  private reworkedStarCacheLastRefreshMs = 0;
  ```
> **Agent note (2026-03-11):** Added the reworked cache canvas/context plus width, height, camera, quality, and refresh timestamp tracking fields.

- [x] **1.3 — Add a per-quality refresh interval constant** inside the class body (near the top, after the palette declaration):
  ```typescript
  private readonly REWORKED_STAR_CACHE_REFRESH_INTERVAL_Ms: Record<string, number> = {
      low:    200,  // ~5 fps — star flicker invisible at this rate
      medium: 100,  // ~10 fps
      high:    33,  // ~30 fps
      ultra:   16,  // ~60 fps (effectively no throttle)
  };
  ```
> **Agent note (2026-03-11):** Added the quality-based refresh interval map from the plan so low/medium quality star redraws can stay throttled.

- [x] **1.4 — Rewrite `drawReworkedParallaxStars`** to use the cache. The new body should:
  1. Lazily create `reworkedStarCacheCanvas` via `document.createElement('canvas')` if null
  2. Resize the cache canvas when `screenWidth` or `screenHeight` has changed (update `reworkedStarCacheWidthPx/HeightPx`)
  3. Determine `needsRefresh` as: `cameraX !== reworkedStarCacheCameraX || cameraY !== reworkedStarCacheCameraY || graphicsQuality !== reworkedStarCacheQuality || screenWidth !== reworkedStarCacheWidthPx || screenHeight !== reworkedStarCacheHeightPx`
  4. Also apply the time throttle: only allow a refresh when `performance.now() - reworkedStarCacheLastRefreshMs >= REWORKED_STAR_CACHE_REFRESH_INTERVAL_Ms[graphicsQuality]`
  5. If refreshing: draw all stars to `reworkedStarCacheCtx` (move the existing inner loop body there verbatim, replacing `ctx` with `cacheCtx`), then update all cache-tracking fields including `reworkedStarCacheLastRefreshMs = performance.now()`
  6. Blit the cache to the caller's `ctx` with: `ctx.drawImage(this.reworkedStarCacheCanvas, 0, 0, screenWidth, screenHeight)`
> **Agent note (2026-03-11):** Moved the expensive per-star work onto the cache context and left the caller path as a single cache blit. Camera/quality/resize invalidations refresh immediately, while the interval gate still updates star flicker over time.

- [x] **1.5 — Verify the `globalCompositeOperation`** is correctly set on `reworkedStarCacheCtx` (not on the caller's `ctx`) for the cache-fill pass, and that it is reset to `'source-over'` after drawing so the cache context is clean for the next refresh.
> **Agent note (2026-03-11):** The cache-fill pass now switches only the cache context to `lighter` and restores it to `source-over` after the refresh completes.

- [x] **1.6 — Build the project** (`npm run build` or the equivalent from `package.json`) and confirm there are no TypeScript errors.
> **Agent note (2026-03-11):** Ran `npm run build` successfully after installing the repo's existing dependencies. Webpack emitted only the existing bundle-size warnings; there were no TypeScript errors.

- [ ] **1.7 — Smoke test in browser**: Start a game. Confirm stars are visible. Pan the camera and confirm the star field parallaxes correctly. Check that stars still flicker (may be subtle). Check the in-game FPS overlay and confirm frame time has decreased on `low`/`medium` quality.

### Phase 1 Verification

Before marking this phase complete, confirm all of the following:

- [x] `drawReworkedParallaxStars` no longer calls `ctx.drawImage` per-star directly to the game canvas — it only calls one `ctx.drawImage` at the end (the blit)
- [x] Cache is invalidated when the camera position changes (parallax still works)
- [x] Cache is invalidated when `graphicsQuality` changes
- [x] Cache is invalidated when the viewport is resized
- [x] No TypeScript strict-mode errors (`noImplicitAny`, etc.)
- [ ] `npm run build` passes cleanly
- [x] Stars visible in-game

- [ ] **Phase 1 complete** ✓

---

## Phase 2 — Sun Body Offscreen Cache (Main Thread)

### Rationale

`SunRenderer` ([`src/render/sun-renderer.ts`](https://github.com/sethrimer3/SoL/blob/main/src/render/sun-renderer.ts)) already allocates internal `lightingLayerCanvas` and `lightingSunPassCanvas` for compositing, so the pattern of offscreen drawing is established here. The sun body (plasma gradient, corona rings, bloom) is animated by `gameTime` at low frequency and does not depend on game-entity state. At `low` and `medium` quality, the body can be cached and blitted when the sun's screen position hasn't changed.

**No new files needed. One file changed.**

### Steps

- [ ] **2.1 — Read `SunRenderer`** fully, particularly:
  - The `drawSun` entry point and what it dispatches to
  - How `lightingLayerCanvas` and `lightingSunPassCanvas` are used
  - Where `gameTime` is used (animation) vs where `sun.position` is used (placement)
  - The `clearFrameCache()` method and what it clears

  Understanding this fully before touching anything is critical — `SunRenderer` is complex.

- [ ] **2.2 — Identify the "sun body" draw surface** — the portion of `drawSun` that renders the plasma gradient and corona but does **not** include the sun ray shafts (those are in `drawSunRays`). Confirm the exact method boundaries.

- [ ] **2.3 — Add cache fields** to `SunRenderer` for a per-sun body cache keyed on a stable sun identifier:
  ```typescript
  private sunBodyCacheByKey = new Map<string, {
      canvas: HTMLCanvasElement;
      screenX: number;
      screenY: number;
      radiusPx: number;
      lastRefreshMs: number;
  }>();
  ```
  The key should be derived from the sun's world position (`sun.position.x + '_' + sun.position.y`) since sun positions are fixed for the duration of a match.

- [ ] **2.4 — Add a per-quality sun body cache TTL constant:**
  ```typescript
  private readonly SUN_BODY_CACHE_REFRESH_INTERVAL_MS: Record<string, number> = {
      low:    100,
      medium:  50,
      high:    16,
      ultra:    0,  // no cache at ultra — full fidelity every frame
  };
  ```

- [ ] **2.5 — Wrap the sun body draw path** with cache logic at `low` and `medium` quality:
  1. At `high`/`ultra`: execute existing draw path unchanged
  2. At `low`/`medium`: check if a valid cache entry exists for this sun key
  3. If stale (TTL expired or screen position moved more than 1px): redraw to an offscreen canvas, update cache entry
  4. Blit the cached canvas to the game `ctx` at the correct screen position

- [ ] **2.6 — Ensure `clearFrameCache()`** does NOT clear the sun body cache (it should only clear per-frame shadow quad caches, as it does now). The sun body cache persists across frames intentionally.

- [ ] **2.7 — Build and smoke test**: Confirm suns are visible. Pan the camera and confirm suns move correctly. Switch graphics quality settings in the in-game menu and confirm the sun appearance updates. Check no visual regression at `ultra`.

### Phase 2 Verification

- [ ] Suns render correctly at all four quality levels
- [ ] Sun screen position tracks camera movement with no lag/ghosting artefacts
- [ ] `clearFrameCache()` does not evict the sun body cache
- [ ] No TypeScript strict-mode errors
- [ ] `npm run build` passes cleanly
- [ ] FPS overlay shows improvement at `low`/`medium` when suns are on screen

- [ ] **Phase 2 complete** ✓

---

## Phase 3 — Star Layer Rendered in a Web Worker

### Rationale

Phase 1 caches star rendering on the main thread, which reduces CPU time per frame. Phase 3 moves that rendering entirely off the main thread. The star layer is uniquely suited for this because its inputs are five primitive values — no game-object references — so no serialisation cost.

**Key constraint**: `StarfieldRenderer` currently uses `document.createElement('canvas')` to build its per-palette core/halo texture caches. This DOM API is unavailable in a Worker. The fix is to inject a `canvasFactory` function at construction time (defaulting to `document.createElement`), so the Worker can inject `(w, h) => new OffscreenCanvas(w, h)` instead.

**New files**: `src/render/workers/starfield-worker.ts`, `src/render/workers/starfield-worker-bridge.ts`  
**Modified files**: `src/render/starfield-renderer.ts`, `src/renderer.ts`

### Steps

- [ ] **3.1 — Check the bundler config** (`webpack.config.js` at repo root). Confirm whether it supports the `new Worker(new URL(...), { type: 'module' })` syntax natively (Webpack 5 does; check the version in `package.json`). If it does not, note what shim is needed and add it before proceeding.

- [ ] **3.2 — Refactor `StarfieldRenderer` to accept a canvas factory**. Modify the constructor signature:
  ```typescript
  constructor(
      private readonly canvasFactory: (widthPx: number, heightPx: number) => HTMLCanvasElement | OffscreenCanvas =
          (w, h) => {
              const c = document.createElement('canvas');
              c.width = w;
              c.height = h;
              return c;
          }
  ) { ... }
  ```
  Replace every `document.createElement('canvas')` call inside the class with `this.canvasFactory(w, h)` calls. Confirm this covers `createStarCoreCacheCanvas` (L539) and `createStarHaloCacheCanvas` (L565) and any other locations. Run a `grep` for `createElement('canvas')` to be sure none are missed.

- [ ] **3.3 — Update the Phase 1 cache** in `drawReworkedParallaxStars` to use `this.canvasFactory(screenWidth, screenHeight)` when lazily creating `reworkedStarCacheCanvas` (replacing the `document.createElement('canvas')` added in Phase 1 step 1.4).

- [ ] **3.4 — Confirm `StarfieldRenderer` still works on the main thread** with no argument to the constructor (the default factory should make it backward-compatible). The existing call site in `src/renderer.ts` (`new StarfieldRenderer()`) must continue to work unchanged. Build and smoke test.

- [ ] **3.5 — Create `src/render/workers/` directory** (create a placeholder or the first worker file to establish the directory).

- [ ] **3.6 — Create `src/render/workers/starfield-worker.ts`**. This is the Worker entry point. It must:
  1. Import `StarfieldRenderer` from `'../starfield-renderer'`
  2. Define the message input type:
     ```typescript
     type StarfieldWorkerInput = {
         type: 'render';
         cameraX: number;
         cameraY: number;
         screenWidthPx: number;
         screenHeightPx: number;
         graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
         nowSec: number;
     };
     ```
  3. Instantiate `StarfieldRenderer` once at module level with an `OffscreenCanvas` factory:
     ```typescript
     const renderer = new StarfieldRenderer((w, h) => new OffscreenCanvas(w, h));
     ```
  4. Create a single `OffscreenCanvas` for output (sized to a reasonable default; resize on demand)
  5. On each `message` event with `type === 'render'`: call `renderer.drawReworkedParallaxStars(ctx, { x: cameraX, y: cameraY }, screenWidthPx, screenHeightPx, graphicsQuality)` using the input `nowSec` for time (not `performance.now()` — the main thread passes time to keep it decoupled), then call `canvas.transferToImageBitmap()` and post it back:
     ```typescript
     const bitmap = offscreen.transferToImageBitmap();
     self.postMessage({ type: 'frame', bitmap }, [bitmap]);
     ```
  6. Handle `type === 'resize'` messages to recreate the `OffscreenCanvas` at the new dimensions

  > **Note**: `drawReworkedParallaxStars` currently reads `performance.now()` internally for star flicker. For the worker version, this should continue to work fine since `performance.now()` is available in Workers. However, confirm this does not cause any issues.

- [ ] **3.7 — Create `src/render/workers/starfield-worker-bridge.ts`**. This class runs on the main thread and manages the worker lifecycle:
  ```typescript
  export class StarfieldWorkerBridge {
      private readonly worker: Worker;
      private latestBitmap: ImageBitmap | null = null;
      private lastSentCameraX = Number.NaN;
      private lastSentCameraY = Number.NaN;
      private lastSentQuality: string = '';
      private lastSentWidthPx = 0;
      private lastSentHeightPx = 0;

      constructor() {
          this.worker = new Worker(
              new URL('./starfield-worker.ts', import.meta.url),
              { type: 'module' }
          );
          this.worker.onmessage = (e) => {
              if (e.data.type === 'frame') {
                  this.latestBitmap?.close(); // Release previous bitmap
                  this.latestBitmap = e.data.bitmap;
              }
          };
      }

      requestFrame(
          cameraX: number,
          cameraY: number,
          screenWidthPx: number,
          screenHeightPx: number,
          graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
      ): void {
          const dimensionsChanged = screenWidthPx !== this.lastSentWidthPx || screenHeightPx !== this.lastSentHeightPx;
          if (dimensionsChanged) {
              this.worker.postMessage({ type: 'resize', screenWidthPx, screenHeightPx });
          }
          this.worker.postMessage({
              type: 'render',
              cameraX, cameraY, screenWidthPx, screenHeightPx, graphicsQuality,
              nowSec: performance.now() * 0.001
          });
          this.lastSentCameraX = cameraX;
          this.lastSentCameraY = cameraY;
          this.lastSentQuality = graphicsQuality;
          this.lastSentWidthPx = screenWidthPx;
          this.lastSentHeightPx = screenHeightPx;
      }

      getLatestBitmap(): ImageBitmap | null {
          return this.latestBitmap;
      }

      dispose(): void {
          this.worker.terminate();
          this.latestBitmap?.close();
          this.latestBitmap = null;
      }
  }
  ```

- [ ] **3.8 — Integrate the bridge into `GameRenderer`** (`src/renderer.ts`):
  1. Import `StarfieldWorkerBridge`
  2. Add a private field: `private readonly starfieldWorkerBridge = new StarfieldWorkerBridge();`
  3. In the `render()` method, find the existing star draw call:
     ```typescript
     this.starfieldRenderer.drawReworkedParallaxStars(this.ctx, this.parallaxCamera, screenWidth, screenHeight, this.graphicsQuality);
     ```
     Replace it with:
     ```typescript
     this.starfieldWorkerBridge.requestFrame(
         this.parallaxCamera.x, this.parallaxCamera.y,
         screenWidth, screenHeight, this.graphicsQuality
     );
     const starBitmap = this.starfieldWorkerBridge.getLatestBitmap();
     if (starBitmap) {
         this.ctx.drawImage(starBitmap, 0, 0, screenWidth, screenHeight);
     } else {
         // Fallback: synchronous render until the first worker frame arrives
         this.starfieldRenderer.drawReworkedParallaxStars(
             this.ctx, this.parallaxCamera, screenWidth, screenHeight, this.graphicsQuality
         );
     }
     ```

- [ ] **3.9 — Add a `dispose()` call** for the bridge. Find where `GameRenderer` is torn down (if there is a `destroy()` or cleanup method) and call `this.starfieldWorkerBridge.dispose()`. If no such method exists, add one and ensure it is called when the game ends.

- [ ] **3.10 — Build the project** and confirm no TypeScript errors. Pay particular attention to type errors in the worker file — Workers have a different TypeScript lib (`lib: ["webworker"]`). Check whether `tsconfig.json` needs a separate worker tsconfig or if the existing config covers it.

- [ ] **3.11 — Smoke test**:
  - Stars appear on the first frame (fallback path)
  - Within ~1 frame, worker bitmap replaces fallback — no visible flash or gap
  - Camera panning: stars parallax correctly
  - Quality switching: star appearance updates correctly
  - No console errors about missing DOM APIs in the worker
  - Open browser DevTools → Performance tab → confirm main thread `drawReworkedParallaxStars` time is gone from the flame graph

### Phase 3 Verification

- [ ] Worker starts without errors in browser console
- [ ] Stars render correctly via worker bitmap
- [ ] Synchronous fallback works on first frame (no black rectangle where stars should be)
- [ ] Camera parallax is correct
- [ ] Quality levels render correctly
- [ ] `ImageBitmap.close()` is called on previous bitmap before replacing (no memory leak)
- [ ] `dispose()` terminates the worker cleanly
- [ ] No TypeScript strict-mode errors
- [ ] `npm run build` passes cleanly
- [ ] Main-thread frame time (in browser DevTools) is reduced compared to before Phase 3

- [ ] **Phase 3 complete** ✓

---

## Phase 4 — Sun Rays Rendered in a Web Worker (Advanced)

### Rationale

Sun ray rendering (`SunRenderer.drawSunRays`) is one of the most expensive per-frame passes. It traces shadow quads for every asteroid relative to every sun, fills composited light shafts, and at `ultra` quality runs a full warm/cool colour grade pass. Moving this off the main thread would have significant impact.

This phase is **harder than Phase 3** due to two problems:
1. `drawSunRays` takes the full `game` object, which is a live JS object tree and cannot be sent to a Worker. You must serialise only the fields it reads.
2. `SunRenderer` uses `WeakMap<Sun, ...>` caches keyed on live `Sun` object identity. Deserialised sun plain-objects are different references — the WeakMap will miss every frame. You must migrate those caches to string-keyed `Map`s.

**Do not attempt this phase without first completing Phase 3 and having it stable.**

### Steps

- [ ] **4.1 — Audit every input to `drawSunRays`**. Open `src/render/sun-renderer.ts` and read `drawSunRays` in full. List every field it reads from the `game` argument (`game.suns`, `game.asteroids`, etc.) and confirm the complete list. Do the same for `drawUltraSunParticleLayers` and any other `game`-consuming methods you plan to move.

- [ ] **4.2 — Define `SunRayWorkerInput`** as a serialisable type containing only the fields identified in step 4.1. Example structure:
  ```typescript
  type SerializableSun = {
      id: string;  // stable key: `${position.x}_${position.y}`
      positionX: number;
      positionY: number;
      radius: number;
      type: string;
      // ... all other fields read by drawSunRays
  };
  type SerializableAsteroid = {
      positionX: number;
      positionY: number;
      rotation: number;
      vertices: Array<{ x: number; y: number }>;
      // ... all other fields read by drawSunRays
  };
  type SunRayWorkerInput = {
      type: 'render';
      suns: SerializableSun[];
      asteroids: SerializableAsteroid[];
      cameraX: number;
      cameraY: number;
      zoomLevel: number;
      canvasWidthPx: number;
      canvasHeightPx: number;
      graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
      isFancyGraphicsEnabled: boolean;
      gameTimeSec: number;
  };
  ```

- [ ] **4.3 — Fix the `WeakMap` cache key problem** in `SunRenderer`. Identify every `WeakMap<Sun, ...>` field (there are at least two: `ultraSunParticleCacheBySun` and `sunShadowQuadFrameCache`). Replace each with `Map<string, ...>` keyed on the sun's stable `id` string (`${sun.position.x}_${sun.position.y}`). Ensure the existing main-thread code path (used during Phase 4 development as fallback) still works correctly after this change. This is a safe refactor with no behaviour change.

- [ ] **4.4 — Build and verify** after the WeakMap migration that sun rendering still works correctly on the main thread at all quality levels. The shadow quads and ultra particle caches must still hit after the key change.

- [ ] **4.5 — Add a `canvasFactory` parameter to `SunRenderer`** (same pattern as Phase 3 step 3.2 for `StarfieldRenderer`) to allow the Worker to use `OffscreenCanvas` for its internal compositing canvases (`lightingLayerCanvas`, `lightingSunPassCanvas`, and the texture caches). Default to `document.createElement`.

- [ ] **4.6 — Create `src/render/workers/sun-ray-worker.ts`**. Mirror the structure of `starfield-worker.ts`:
  1. Import `SunRenderer`
  2. Instantiate with an `OffscreenCanvas` factory
  3. On `'render'` messages: reconstruct the minimal game-like object from the serialised input, call `drawSunRays` (and `drawUltraSunParticleLayers` if applicable), transfer the resulting `ImageBitmap`

- [ ] **4.7 — Create `src/render/workers/sun-ray-worker-bridge.ts`**. Mirror `StarfieldWorkerBridge` but with:
  - Serialisation of `game.suns` and `game.asteroids` each frame (shallow copy of needed fields only)
  - Frame-skip logic: only re-send if `zoom`, camera, or `gameTimeSec` has changed meaningfully (add a `MIN_RESEND_DELTA_SEC` threshold)
  - `measureSerializationCostMs()` helper that times a dry-run serialisation so you can confirm serialisation cost < draw cost saved

- [ ] **4.8 — Profile serialisation cost** before wiring up the bridge in `renderer.ts`. Call `bridge.measureSerializationCostMs(game)` once and log it. If the cost is >= 2ms on a representative machine, reconsider whether this phase is worth completing for the given map size.

- [ ] **4.9 — Integrate into `GameRenderer`** using the same fallback pattern as Phase 3 step 3.8.

- [ ] **4.10 — Add `dispose()` to `SunRayWorkerBridge`** and call it in `GameRenderer`'s teardown alongside `starfieldWorkerBridge.dispose()`.

- [ ] **4.11 — Build and smoke test**: Sun rays and shadows must be visually identical to the pre-Phase-4 render. Pay special attention to:
  - Shadow quad geometry (asteroid shadows behind the sun)
  - Warm/cool colour grade at `ultra` quality
  - Correct compositing (sun rays must appear behind asteroids but in front of stars)

### Phase 4 Verification

- [ ] Sun rays and asteroid shadows render correctly at all quality levels
- [ ] `WeakMap → Map` migration has no cache-miss regression (shadow quads are not recomputed every frame unnecessarily)
- [ ] Serialisation cost < draw cost saved (confirmed by profiling)
- [ ] `ImageBitmap.close()` called on previous bitmaps (no memory leak)
- [ ] Both workers disposed cleanly on game teardown
- [ ] No TypeScript strict-mode errors
- [ ] `npm run build` passes cleanly
- [ ] Main-thread frame time (DevTools) is reduced compared to before Phase 4

- [ ] **Phase 4 complete** ✓

---

## Agent Progress Log

> **Instructions**: Add an entry here at the start and end of every session. Use the format below.

```
### Session YYYY-MM-DD — [Agent name or "anonymous"]
**Started**: [HH:MM UTC]
**Ended**: [HH:MM UTC]
**Phases touched**: [e.g. "Phase 1"]
**Steps completed this session**: [e.g. "1.1 through 1.6"]
**Steps remaining in current phase**: [e.g. "1.7 (smoke test)"]
**Blockers / notes**: [Any issues encountered, decisions made, or things the next agent should know]
```

```text
### Session 2026-03-11 — OpenAI Codex
**Started**: 19:30 UTC
**Ended**: 19:30 UTC
**Phases touched**: Phase 1
**Steps completed this session**: 1.1 through 1.5
**Steps remaining in current phase**: 1.7 and the remaining clean-build/full-smoke verification checkboxes
**Blockers / notes**: Began the plan from the first unchecked phase in the document. The reworked starfield now renders through a main-thread cache, the build passes without TypeScript errors, and an in-game screenshot confirms stars are visible. Full pan/flicker/FPS smoke testing is still pending.
```

---

## Reference: Key Files

| File | Purpose |
|------|---------|
| [`src/render/starfield-renderer.ts`](https://github.com/sethrimer3/SoL/blob/main/src/render/starfield-renderer.ts) | Star layer renderer — Phases 1 & 3 |
| [`src/render/sun-renderer.ts`](https://github.com/sethrimer3/SoL/blob/main/src/render/sun-renderer.ts) | Sun body & ray renderer — Phases 2 & 4 |
| [`src/renderer.ts`](https://github.com/sethrimer3/SoL/blob/main/src/renderer.ts) | `GameRenderer` — integration point for all phases |
| `src/render/workers/starfield-worker.ts` | _(to be created in Phase 3)_ |
| `src/render/workers/starfield-worker-bridge.ts` | _(to be created in Phase 3)_ |
| `src/render/workers/sun-ray-worker.ts` | _(to be created in Phase 4)_ |
| `src/render/workers/sun-ray-worker-bridge.ts` | _(to be created in Phase 4)_ |
| [`webpack.config.js`](https://github.com/sethrimer3/SoL/blob/main/webpack.config.js) | Bundler config — check Worker support in Phase 3 step 3.1 |
| [`tsconfig.json`](https://github.com/sethrimer3/SoL/blob/main/tsconfig.json) | TypeScript config — may need worker lib additions in Phase 3 step 3.10 |
| [`agents.md`](https://github.com/sethrimer3/SoL/blob/main/agents.md) | General agent guidelines for this repo — read before starting |
