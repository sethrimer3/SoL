# Starfield Rendering Upgrade Index

## Modules touched

- `src/menu/atmosphere.ts`
  - Rebuilt menu star rendering into a multi-layer additive starfield with power-law star size distribution.
  - Added density-biased placement via lightweight fractal/value noise to produce sparse regions and subtle clusters.
  - Added weighted color-temperature mapping (warm/yellow/white/blue-white) and cached star sprites per temperature band.
  - Added two-pass star rendering (halo + core) with soft Gaussian-like falloff and no hard-edged circles.
  - Added subtle low-amplitude flicker and selective chromatic aberration for only the brightest, largest stars.
  - Added graphics-quality-aware star budgets (low/medium/high/ultra) so ultra renders the richest menu space background.

- `src/menu.ts`
  - Changed default menu graphics quality to `ultra`.
  - Wired graphics quality updates to the menu atmosphere layer so sun/space visuals react immediately to quality changes.
  - Ensured the atmosphere layer initializes with the current menu graphics setting.

- `src/renderer.ts`
  - Changed renderer default graphics quality to `ultra` so new games start with ultra graphics by default.

## Distribution math

### Power-law star size
Each star size is sampled with:

`size = minSize * (1 - r)^(-1 / alpha)`

Then clamped to a sane max size.

Why: this creates many tiny stars and few large stars, matching deep-space photography better than uniform random sizing.

### Non-uniform spatial distribution
Placement is biased by low-cost fractal/value noise:

- Multiple octaves provide broad voids + fine structure.
- A ridge component adds filament-like clustering.
- Candidates under a density gate are mostly rejected.

Result: sparse pockets and subtle clusters, not even spacing.

## Shader/lighting logic (canvas approximation)

This path is Canvas2D, so shader goals are approximated with cached sprites and additive blending:

- Additive blend via `globalCompositeOperation = 'lighter'`.
- Two-layer star model:
  - Halo sprite for broad bloom.
  - Core sprite for bright center.
- Gradients always ease to alpha 0 (no sharp radial cutoffs).
- Optional tiny chromatic split on a small bright-star subset only.

## Performance decisions

- Star attributes are generated once per resize/quality change.
- Star core/halo textures are precomputed per temperature bucket.
- No per-frame allocations in the draw loop.
- Math per star per frame is intentionally small (parallax + sine flicker + image draws).

## Known tradeoffs

- A real GLSL fragment Gaussian (`exp(-d*d*k)`) was not introduced because this menu background uses Canvas2D.
- Density clustering uses a compact value-noise approach (not full simplex/perlin implementation), trading strict realism for performance and simplicity.
- Ultra quality increases star count significantly; low-end devices can still drop to lower presets in settings.
