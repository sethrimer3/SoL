# Starfield Rendering Upgrade Index

## Modules touched

- `src/constants.ts`
  - Expanded star layer configuration from 4 layers to 5 layers.
  - Raised star counts to support dense fields (~5,000 total).
  - Added per-layer brightness scaling + blur variance knobs.

- `src/renderer.ts`
  - Replaced simple random star generation with clustered generation.
  - Added power-law star sizing.
  - Added weighted color temperature sampling with a precomputed LUT.
  - Added Poisson-like neighborhood rejection + fractal/value noise density bias.
  - Reworked star draw path with additive blending and two-layer star rendering (core + halo).
  - Added subtle flicker and selective chromatic aberration for brightest large stars.
  - Added an ultra-low-opacity nebula background wash.

## Distribution math

### Power-law star size
Each star size is sampled with:

`size = minSize * (1 - r)^(-1 / alpha)`

Then clamped to each layer’s configured max size.

Why: this creates many small stars and very few large stars, which is closer to astrophotography distributions than uniform random sizes.

### Non-uniform spatial distribution
Placement uses two mechanisms:

1. **Noise density bias**
   - Fractal noise (`fractalNoise2D`) + ridge term from value noise create spatial bias.
   - Only candidates above a density gate are accepted.

2. **Poisson-like local spacing**
   - A lightweight grid neighborhood check enforces minimum spacing for nearby candidates.
   - This prevents obvious overlap and regular patterns while retaining clusters.

Result: sparse pockets + denser structures, avoiding even spacing/repetition.

## Shader/lighting logic (canvas approximation)

The render path approximates shader-style star optics in Canvas2D:

- **Additive blending** via `globalCompositeOperation = 'lighter'`.
- **Two-layer star model**:
  - Halo: wide, soft radial stops tuned to resemble Gaussian falloff.
  - Core: tighter high-intensity center with color-to-white transition.
- **No hard cutoff**: all gradients end in alpha 0 with smooth transitions.
- **Selective chromatic aberration**: tiny RGB split only on top-end stars.

Note: this codebase’s background path is Canvas2D, so we emulate the fragment behavior (Gaussian-like exponential decay) using carefully chosen radial gradient stops and minimal blur.

## Performance decisions

- Star properties are generated once during initialization (no per-frame allocations).
- Rendering stays batched by layer and drawn to a cache canvas.
- Cache refresh triggers on camera movement / resize.
- Noise is only used during star generation, not in the per-frame hot path.
- Flicker is very low-frequency and low-amplitude; computed with a single sine per star draw.

## Known tradeoffs

- Full GPU instanced rendering + fragment shader Gaussian was not introduced because the current renderer path is Canvas2D.
- Since cache refresh occurs on parallax camera changes, moving camera frames still redraw stars; however, hot-path operations are minimized.
- Gaussian falloff is approximated in Canvas2D rather than analytically evaluated per pixel as in GLSL.
