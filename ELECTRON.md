# SoL Local Desktop Runner

SoL remains a browser-first Webpack/TypeScript game that deploys the built `dist/` folder to GitHub Pages. The Electron setup is only a local desktop wrapper around the same production build.

## Install Dependencies

```bash
npm install
```

If you want a clean install from the lockfile, use:

```bash
npm ci
```

## Run In Browser Locally

```bash
npm run dev
```

This starts the existing Webpack development watch flow. Open the repo's `index.html` or serve the built `dist/` folder with a static server after `npm run build`.

## Run In Electron

The desktop flow builds first, then launches Electron:

```bash
npm run desktop
```

To launch Electron against an already-built `dist/` folder:

```bash
npm run electron
```

Electron loads `dist/index.html` through a private `sol://game/` protocol so relative assets, JSON map fetches, images, audio, and localStorage keep a stable browser-like origin without exposing Node APIs to the game renderer.

## Windows Batch Files

`run-desktop.bat` is the easiest Windows entry point. Double-click it from File Explorer to install dependencies when needed, build the game, and launch the desktop version.

`run-browser-dev.bat` installs dependencies when needed and starts the normal browser development watch command.

`build-game.bat` installs dependencies when needed and runs the production build, then pauses so you can read the result.

## GitHub Pages Build

GitHub Pages should continue to use:

```bash
npm run build
```

The build still outputs to `dist/`, and the root `index.html` still redirects to `dist/index.html` for the hosted page at `https://sethrimer3.github.io/SoL/`.

## Troubleshooting

If the Electron window shows a black screen, run `build-game.bat` first and confirm `dist/index.html` exists.

If assets are missing, check that `dist/ASSETS/` exists after `npm run build`. The Webpack config copies the root `ASSETS/` folder into `dist/ASSETS/`.

If maps fail to load, launch through `npm run desktop` or `run-desktop.bat` rather than opening `dist/index.html` directly with `file://`.

Existing browser saves and settings use localStorage and are not migrated. Electron keeps its own app-origin localStorage for the `sol://game/` desktop origin.
