# Google Play Store Production Checklist — SoL

Status of the codebase today: SoL is a TypeScript/webpack **web** game (`dist/bundle.js` + `index.html`)
with an Electron desktop shell (`electron/main.cjs`). **There is no Android project of any kind in this
repo.** Everything in Phase 1 below is net-new engineering work; Phases 2–5 are store paperwork.

---

## Phase 1 — Make an Android build exist (the big one)

### 1.1 Pick a wrapper
The game already runs in a browser canvas, so the cheapest path is a WebView wrapper rather than a port.

| Option | Notes |
|---|---|
| **Capacitor** (recommended) | `npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap init`, point `webDir` at `dist`, `npx cap add android`. Gives a real Gradle project you own, plus plugins for filesystem/haptics/back-button. |
| Cordova | Older, fewer maintained plugins. Only if a needed plugin is Cordova-only. |
| TWA / Bubblewrap | Requires the game to be hosted online as a PWA. Rejects offline play and forces a live server. Not recommended for an RTS. |
| Native port | Months of work. Not justified. |

### 1.2 Bundle assets offline
`ASSETS/` (SPRITES, SFX, music, fonts, maps) must ship inside the APK/AAB, not be fetched from a host.
Verify every asset load path is relative and works from `file://`/`capacitor://`. Audit the total size —
if the AAB exceeds **200 MB**, move music/large sprites to **Play Asset Delivery** (install-time or
fast-follow packs).

### 1.3 Touch input
`src/input/input-controller.ts` and the menu views have some touch handling, but the game is designed
around mouse + keyboard RTS controls. Required work:
- Tap = select, drag = box-select, two-finger pinch = zoom, two-finger drag = pan.
- Long-press for context/attack-move.
- Replace every hotkey-only action with an on-screen control; nothing may be keyboard-exclusive.
- Handle the Android **back button** (should open pause menu, never kill the activity).

### 1.4 Screen and performance
- Support arbitrary aspect ratios and notches/cutouts (`viewport-fit=cover`, safe-area insets). The
  Electron window is hardcoded to 1600px wide (`electron/main.cjs:112`) — the layout must not assume that.
- Lock to landscape unless a portrait layout is built.
- Target 60 fps on a mid-range device (~Snapdragon 6-series). Profile the render loop; the offscreen-canvas
  worker plan in `documentation/OFFSCREEN_CANVAS_WORKER_RENDERING_PLAN.md` is relevant here.
- Handle app suspend/resume: pause the sim, don't desync multiplayer, save on `pause`.

### 1.5 Multiplayer on mobile
P2P/online play (see `ONLINE_PLAY.md`, `P2P_MULTIPLAYER_ARCHITECTURE.md`) must survive mobile network
conditions: NAT traversal on cellular, background disconnects, reconnection. Decide now whether mobile
players are matched against desktop players (input parity is a balance concern) or pooled separately.

### 1.6 Server Configuration
Ensure `COLYSEUS_SERVER_URL` points to the production WebSocket server endpoint. Sensitive secrets should never be embedded in the client build.

---

## Phase 2 — Signing and build pipeline

- [ ] Generate an upload keystore (`keytool -genkey -v -keystore sol-upload.jks -keyalg RSA -keysize 2048 -validity 10000`).
- [ ] Store the keystore + passwords outside the repo; add `*.jks`, `key.properties` to `.gitignore`. Losing this key is unrecoverable without Play App Signing recovery.
- [ ] Enrol in **Play App Signing** (Google holds the release key, you hold the upload key).
- [ ] Set `applicationId` (e.g. `com.<yourname>.sol`) — permanent, cannot be changed after publish.
- [ ] `versionCode` (integer, must increase every upload) and `versionName` (currently `1.0.0` in `package.json` / `0.1.0` in `game_config.json` — reconcile these).
- [ ] `minSdk` 24+, **`targetSdk` must meet Google's current requirement** (raised annually; check the Play Console target API level policy at submission time).
- [ ] Build an **AAB** (`./gradlew bundleRelease`), not an APK. Enable R8/minification.
- [ ] Add an `npm run android:build` script so the pipeline is reproducible.

---

## Phase 3 — Play Console account and app setup

- [ ] Google Play Developer account — **$25 one-time**.
- [ ] **Personal accounts created after Nov 2023 must run a closed test with 12+ testers for 14 consecutive days before production access is granted.** Budget for this; it is the single biggest schedule risk. An organization account (requires a D-U-N-S number) skips it.
- [ ] Identity verification (government ID / business docs) and a verified developer contact address — this address is public.
- [ ] Create the app in Play Console: name (30 chars), default language, "Game", free/paid (irreversible).

---

## Phase 4 — Store listing assets

- [ ] **App name** — max 30 characters ("SoL — Speed of Light" fits).
- [ ] **Short description** — max 80 characters.
- [ ] **Full description** — max 4000 characters.
- [ ] **App icon** — 512×512 PNG, 32-bit. Source from `ASSETS/icon`.
- [ ] **Feature graphic** — 1024×500 PNG/JPG, no alpha. Required.
- [ ] **Phone screenshots** — 2 to 8, 16:9 or 9:16, each side 320–3840 px.
- [ ] **Tablet screenshots** — required to appear as tablet-optimized (7" and 10").
- [ ] Optional but valuable: 30s–2min YouTube trailer.
- [ ] Category: Games → Strategy. Tags.

---

## Phase 5 — Policy, declarations, compliance

- [ ] **Privacy policy URL** — mandatory. Must cover multiplayer data, what is collected, retention, deletion requests.
- [ ] **Data safety form** — declare every data type collected/shared, encryption in transit, deletion mechanism. Must match actual app behavior; mismatches cause rejection.
- [ ] **Account deletion**: if the game has accounts, you must provide an in-app deletion path *and* a public web URL for deletion requests.
- [ ] **Content rating questionnaire** (IARC) — sci-fi combat, online interaction, user-to-user chat if present.
- [ ] **Target audience & content** — if any part targets under-13, Families Policy applies (stricter ads/SDK rules).
- [ ] **Ads declaration**, and **Google Play Billing** if there is ever monetization (third-party payment for digital goods is prohibited).
- [ ] **News/COVID/financial declarations** — all "no".
- [ ] Permissions: request the minimum. Justify anything sensitive.
- [ ] **Pre-launch report** — Play runs your build on real devices; fix crashes it reports.
- [ ] **App integrity / Play Integrity API** — optional but worth considering given the anti-cheat concerns already documented in `MULTIPLAYER_SECURITY.md`.

---

## Phase 6 — Release

1. Internal testing track (up to 100 testers, instant) — smoke test the AAB.
2. Closed testing — satisfies the 14-day/12-tester requirement if applicable.
3. Open testing (optional).
4. Production, **staged rollout** starting at 5–10%. Watch Android vitals (ANR rate < 0.47%, crash rate < 1.09% — exceeding these hurts discoverability).
5. Review typically takes a few days for a first submission; longer for new developer accounts.

---

## Realistic timeline

| Work | Estimate |
|---|---|
| Capacitor wrapper + offline assets | 1–2 weeks |
| Touch controls + UI reflow for mobile | 3–6 weeks (largest item) |
| Mobile perf tuning | 1–3 weeks |
| Signing, store assets, policy forms | 1 week |
| 14-day closed test (personal account) | 2+ weeks, blocking |

**~2–3 months** of focused work to a production listing, dominated by touch-control design rather than
store paperwork.

## Immediate next steps

1. Decide: Capacitor wrapper vs. no mobile version at all.
2. Prototype touch controls in the browser build (Chrome device emulation) *before* setting up Android — that's where the design risk is.
3. Register the Play Developer account early; the closed-testing clock and identity verification run in parallel with development.
