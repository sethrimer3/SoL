# Steam Production Checklist — SoL

Status of the codebase today: SoL builds to `dist/` via webpack and already runs as a desktop app through
Electron (`electron/main.cjs`, `npm run desktop`). **Steam is by far the closer of the two storefronts** —
the desktop build essentially exists. The gap is packaging, store paperwork, and Valve's review process.

---

## Phase 1 — Steamworks account and fee

- [ ] Create a Steamworks partner account at partner.steamgames.com.
- [ ] Pay the **Steam Direct fee: $100 USD per app**, recoupable once the app earns $1,000 in adjusted gross revenue.
- [ ] Complete **tax and banking**: W-9 (US) or W-8BEN, bank details, and identity verification. This can take days to weeks and **blocks release, not store page setup** — start it early.
- [ ] Accept the Steam Distribution Agreement.
- [ ] Note the **30-day rule**: after your store page goes live, you cannot release for at least 30 days. Plan the store page launch ≥30 days before your intended release date.

---

## Phase 2 — Packaging the build

### 2.1 Ship an installable desktop build
`npm run desktop` runs Electron from source. For distribution you need a packaged, self-contained binary:

- [ ] Add **electron-builder** (or electron-forge): `npm i -D electron-builder`.
- [ ] Configure `build` in `package.json` — `appId`, `productName: "SoL"`, `directories.output`, `files` (include `dist/` and `ASSETS/`, exclude `node_modules` dev deps, tests, `documentation/`, `Archive/`).
- [ ] Targets: **Windows x64** first (`nsis` or, for Steam, prefer a plain `dir`/portable output — Steam handles installation itself, so you do *not* want an NSIS installer inside the depot). Linux (`AppImage`/`dir`) and macOS optional.
- [ ] Verify the packaged build launches with no dev server and loads all `ASSETS/` from the packaged path — asset paths that work in `npm run dev` frequently break under `asar`. Either set `asar: false` for `ASSETS` or add it to `asarUnpack`.
- [ ] Reconcile the version: `package.json` says `1.0.0`, `game_config.json` says `0.1.0`.

### 2.2 Security hardening
`electron/main.cjs` already sets `contextIsolation: true` and `nodeIntegration: false` — good, keep it.
Also confirm: no remote content loaded into the main window, `webSecurity` left on, and a CSP on `index.html`.

### 2.3 Secrets
Ensure `COLYSEUS_SERVER_URL` points to the production server endpoint. Do not bundle sensitive server keys into client builds.

### 2.4 Code signing (recommended, not required by Valve)
Unsigned Windows binaries trigger SmartScreen warnings. An OV/EV code-signing certificate runs roughly
$200–600/year. macOS builds **must** be signed and notarized by Apple or they will not open at all.

---

## Phase 3 — Steamworks SDK integration

Minimum viable is *no* SDK integration — Steam will happily launch an unmodified executable. But for a
competitive RTS, integrate at least:

- [ ] **Steamworks init + ownership check** — `greenworks` or `steamworks.js` (the latter is maintained and works with modern Electron). Call `SteamAPI_RestartAppIfNecessary` so launching the exe directly re-routes through Steam.
- [ ] **Achievements & stats** — defined in Steamworks under App Admin, then unlocked from code.
- [ ] **Cloud saves** — map Steam Auto-Cloud to the settings/profile directory; cheapest possible win.
- [ ] **Steam Input** — controller support, optional for an RTS.
- [ ] **Rich Presence / Steam Overlay** — the overlay needs a compatible rendering path; test it, Electron overlay support is imperfect.
- [ ] Strongly consider for multiplayer:
  - **Steam Auth (session tickets)** — a real identity to bind to multiplayer sessions, which fixes a chunk of the account-spoofing surface.
  - **Steam Networking Sockets / Relay** — solves NAT traversal for P2P far better than a hand-rolled solution (see `P2P_MULTIPLAYER_ARCHITECTURE.md`).
  - **Steam Lobbies / Matchmaking** — replaces custom matchmaking.

---

## Phase 4 — Depots, builds, uploads

- [ ] Configure **depots** in Steamworks (one per platform: Windows content depot, Linux depot, …).
- [ ] Set **launch options** per OS: executable path, arguments, working directory.
- [ ] Install **SteamPipe** (ContentBuilder). Write `app_build_XXXX.vdf` and `depot_build_XXXX.vdf` scripts.
- [ ] Upload with `steamcmd +login <user> +run_app_build ..\scripts\app_build_XXXX.vdf +quit`.
- [ ] Use **branches**: push to a `beta` branch first, test, then set live.
- [ ] Redistributables: Electron needs none beyond the OS baseline. Confirm on a clean VM.

---

## Phase 5 — Store page assets

Valve's required capsule set (all PNG/JPG, no transparency in capsules):

| Asset | Size |
|---|---|
| Small capsule | 462 × 174 |
| Header capsule | 920 × 430 |
| Main capsule | 1232 × 706 |
| Vertical capsule | 748 × 896 |
| Page background | 1438 × 810 |
| Library capsule | 600 × 900 |
| Library header | 920 × 430 |
| Library hero | 3840 × 1240 |
| Library logo | up to 1280 × 720, transparent PNG |
| Community icon | 184 × 184 |
| Client icon | 32 × 32 `.ico` |

Plus:
- [ ] **Screenshots** — minimum 5, at least 1920×1080, no debug overlays, no UI mockups.
- [ ] **Trailer** — strongly recommended; must show actual gameplay, 30s+, mp4/webm, ≥1080p. Valve reviews trailers.
- [ ] **Short description** (≤300 chars) and **About This Game** (Steam BBCode).
- [ ] Genre/tags (Strategy, RTS, Space, Multiplayer, Indie), features (Single-player, Online PvP, Steam Cloud).
- [ ] **System requirements**, min and recommended — Electron's real floor is higher than you'd guess; measure it.
- [ ] Legal / EULA text, developer & publisher names, website, support email.

---

## Phase 6 — Review and release

1. **Store page review** — Valve checks assets, description, and legal text. Typically 1–5 business days; expect at least one round of feedback.
2. Store page goes live → **30-day countdown to earliest release** begins.
3. **Build review** — Valve installs and launches your game to confirm it works and matches the store page. Provide a build on the default branch plus review notes and any test credentials for online features.
4. Set price (or Free To Play) and region pricing.
5. Pick a release date; set the build live on the default branch.
6. Post-launch: Steam Community, discussions moderation, patch cadence, refund window (2 hrs played / 14 days) — a short RTS campaign that finishes under 2 hours yields high refund rates.

---

## Phase 7 — Pre-launch nice-to-haves

- [ ] **Steam Playtest** or a **demo** app (a separate appid, free) — best wishlist driver for a strategy game.
- [ ] Wishlists open as soon as the store page is live; this is the main reason to publish the page early.
- [ ] **Steam Next Fest** — must register in advance for a specific fest, requires a working demo.

---

## Realistic timeline

| Work | Estimate |
|---|---|
| electron-builder packaging + asset-path fixes | 3–7 days |
| Steamworks SDK (auth, cloud, achievements) | 1–2 weeks |
| Steam Networking migration for P2P (optional) | 2–4 weeks |
| Capsule art + trailer + screenshots | 1–2 weeks (often the bottleneck if no artist) |
| Steamworks setup, tax/banking, depots | 3–5 days of work, weeks of latency |
| Store review + mandatory 30-day wait | 30+ days, blocking |

**~6–10 weeks** from today to release, with the 30-day store-page rule as the hard floor.

## Immediate next steps

1. Add electron-builder and produce a working packaged Windows build — this proves the game ships and surfaces the asset-path bugs early.
2. Pay the $100 Steam Direct fee and start tax/banking verification now; the latency is the long pole.
3. Commission or produce the capsule art set — it's the most common non-code blocker.
4. Publish the store page ≥30 days before your target release date to start the clock and open wishlists.
