# Glances Dashboard (React Native)

A dashboard for [Glances](https://nicolargo.github.io/glances/) system monitors. Point it at one
or more machines running `glances -w`, then build a board out of **26 purpose-built widgets** —
CPU traces and ring gauges, memory, load, per-core bars, network and disk throughput, filesystems,
sensors, GPUs, process and container tables, and a cross-host alerts feed.

Built with Expo, and running as an Android app, an installable web app, and a Windows desktop app
from one codebase.

Rewrite of [drumslave-git/glances-dashboard](https://github.com/drumslave-git/glances-dashboard),
tracking that project's Electron version feature for feature.

**Status:** at parity with the reference's v1.13.0 feature set — see
[REWRITE_PROGRESS.md](REWRITE_PROGRESS.md).

## What it does

**Endpoints.** As many Glances servers as you like, each with its own poll interval, accent colour
and pause switch. A connection test reports the server's version and plugin count before you
commit to it. Every widget says which host it is reading, so a board can mix machines without
becoming a guessing game.

**Widgets.** Fourteen metrics, each with two or three renderings — a chart, a gauge, a table, a
plain readout. The add-widget picker asks two questions in order: *what do you want to see*, then
*how do you want it drawn*, with every option drawn live from the real endpoint at the size it
would be placed. Widgets know what they measure, so they degrade sensibly: a chart sheds its axis
then its grid then becomes a pulse strip, a table drops columns by priority and never half-cuts a
row, a ring becomes a bar.

**The grid.** Free placement with drag and resize over coarse columns that follow the window: as
many as clear a 290pt floor, stretched to fill it exactly, with rows sized so a windowful fills the
viewport. A phone gets one column and picks widget footprints from the ⋮ menu instead of a corner
grip.

**Full screen.** Hands the whole window to the board. The toolbar slides back when the pointer
reaches the top edge; on touch, where there is no pointer, a strip along the top edge leaves full
screen outright — as do the back button, `Esc` and `F11`. On web and desktop it takes the actual
window with it.

**Appearance.** Colours are stored for both light and dark, each with its own opacity, alongside
spacing, corner radius, border and reading-text size. Every control previews on the board as you
move it, each has its own reset, and one widget can override the board's background. On Windows,
an opacity below 100% makes the desktop visible through the grid.

**Keyboard** (web and desktop): `F11` full screen, `Esc` to leave it, `Ctrl`+`N` add widget,
`Ctrl`+`E` edit layout, `Ctrl`+`,` settings.

## Targets

| Target | How it runs |
| --- | --- |
| Android (phone + tablet) | Native build; a dev build locally, an APK from CI |
| Web | Self-contained SPA, installable as a PWA |
| Windows desktop | The web build in a [Tauri](https://tauri.app) window (~7 MB, on WebView2) |
| iOS | Kept compiling, never gated on — not a release target |

## Development

```bash
npm install
npm start
```

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Dev server, opens Android |
| `npm run android:emulator` | Build, install and launch the dev build on a running emulator |
| `npm run web` | Dev server, opens web |
| `npm run build:web` | Web export (SPA) to `dist/` |
| `npm run desktop` | Windows desktop app against the dev server (hot reload) |
| `npm run build:desktop` | Windows `.exe` + installer, from a fresh web export |
| `npm run setup:skia-web` | Copy `canvaskit.wasm` into `public/` — the charts need it on web |
| `npm run icons:web` | Regenerate the PWA icons in `public/icons/` from `assets/images/` |
| `npm test` | Jest unit + component tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run release:patch` | Bump the version to cut a release — see [Releases](#releases) |

## Requirements

A reachable Glances server running its web/REST API: `glances -w` (default port `61208`).
Glances **4.x**; the app detects a 3.x server and says so rather than failing obscurely.

## Running on Android

Use a **dev build**, not Expo Go — the emulator cannot deliver Expo Go's bundle over its NAT.

```bash
npx expo start
```

then, in a second shell:

```bash
npm run android:emulator
```

`scripts/run-android.ps1` does the whole dance: builds and installs the debug APK, sets up the adb
tunnel, points React Native's dev-server setting at it, and launches the app. It also works around
an API 36 emulator bug that otherwise leaves the device with no route to the host — without which
the app cannot reach a Glances server at all. [AGENTS.md](AGENTS.md) has the details, including
what to do when Metro cannot bind port 8081.

Building the release APK the way CI does needs **JDK 17** — Android Studio ships a newer one, and
AGP's CMake step fails on it:

```bash
npx expo prebuild --platform android --no-install
```

```bash
cd android && ./gradlew assembleRelease
```

`android/` is generated and gitignored, so prebuild recreates it from `app.json` and the config
plugins.

## Web build

`npm run build:web` writes a self-contained SPA to `dist/`. Serve it from any static host — every
route is client-side, so the host must fall back to `index.html` for unknown paths.

It is an installable PWA: `public/manifest.json` plus the icons in `public/icons/`, wired into the
page by `public/index.html` (Expo prefers that file over its own HTML template). `npm run
icons:web` regenerates the icons if the app icon changes.

`public/sw.js` is a service worker that **caches nothing** — it exists because Chrome will not
offer "Install app" without one. Offline support is deliberately absent: every number on the
dashboard comes from a live server, so a cached shell would only show a faster "cannot reach the
server". Browsers register workers over https or on localhost only, so a plain-http deployment
still runs, just without the install prompt.

Charts are Skia, which on web means CanvasKit compiled to WebAssembly. `npm run web` and `npm run
build:web` both copy `canvaskit.wasm` into `public/` first, so it is served from the site root;
without it the charts silently do not draw.

## Windows desktop

The desktop app is the web build in a Tauri window — a native shell around the system's WebView2,
so the `.exe` is ~7 MB rather than a bundled Chromium.

```bash
npm run build:desktop
```

writes two things, after re-running `npm run build:web` so the bundle is never stale:

| Artifact | Path |
| --- | --- |
| Portable executable | `src-tauri/target/release/glances-dashboard.exe` |
| Installer | `src-tauri/target/release/bundle/nsis/Glances Telemetry_<version>_x64-setup.exe` |

The installer is per-user: it needs no administrator rights, installs to `%LOCALAPPDATA%\Glances
Dashboard`, adds a Start Menu entry, and ships its own `uninstall.exe`. Both artifacts embed the
whole frontend, so neither needs `dist/` at runtime.

`npm run desktop` runs the same window against the Metro dev server instead, with hot reload — it
starts Expo for you.

**The window is created transparent** so the appearance settings' opacity can show the desktop
through the grid. It cannot be toggled after the window exists, so it is always on; a fully opaque
grid colour — the default — is what makes the window look solid.

### Building it

Windows only, and it needs a Rust toolchain alongside the Node one. Two prerequisites, both once
per machine — first Rust itself:

```bash
winget install Rustlang.Rustup
```

then the MSVC linker and Windows SDK, which come from Visual Studio's *Desktop development with
C++* workload:

```bash
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Everything else — NSIS, the Tauri CLI — is fetched automatically on first build. A cold release
build takes a few minutes; an incremental one is well under that, though the release profile's
link-time optimization means it is never instant.

**WebView2** is what actually renders the app. Windows 11 and current Windows 10 ship it; where it
is missing, the installer downloads it during setup.

`src-tauri/` holds the shell: `tauri.conf.json` (window, icons, bundle settings), a `main.rs` that
does nothing but open the window, and `capabilities/default.json`, which scopes what the HTTP
plugin below may reach. There is no Rust-side application logic and the frontend is unmodified —
the desktop build serves the same `dist/` a browser gets.

## Talking to Glances

The answer differs by target, and the difference is the whole reason the desktop build exists.

| Target | How requests are made | CORS? |
| --- | --- | --- |
| Android | The platform's `fetch` | No — not a browser |
| Windows desktop | Tauri's Rust HTTP client | No — the request is made outside the WebView |
| Web (hosted) | The browser's `fetch` | **Yes**, plus the mixed-content rule |

### Android and Windows desktop

Nothing to configure. On Android the app is not a browser. On desktop the poller and the
connection test both go through Tauri's Rust client, which has no origin, follows redirects and
ignores private-network gating — the desktop equivalent of the reference app polling from its main
process. A Glances that a browser refuses to read is readable here, including the common case of a
plain-http address that 301s to https behind a reverse proxy.

The URLs it may reach are `http://*` and `https://*`, scoped in
`src-tauri/capabilities/default.json`. That is the honest floor: an endpoint is whatever address
the user types, and Tauri evaluates capability scopes at build time. What it still buys is written
in that file — no `file://`, no custom schemes.

### Web (hosted)

A browser will only let the page read a Glances server that says the page is allowed to. A default
`glances -w` **already permits every origin** (`cors_origins=*` in the `[outputs]` section of
`glances.conf`), so a hosted build normally works with no server-side change. If the server has
been locked down, or sits behind a proxy that sets its own CORS headers, allow the origin the
dashboard is served from:

```ini
[outputs]
cors_origins=https://dashboard.example.com
```

Glances 4.5.2 and later default `cors_credentials` to `False`
([GHSA-9jfm-9rc6-2hfq](https://github.com/nicolargo/glances/security/advisories/GHSA-9jfm-9rc6-2hfq)).
This app sends no cookies or credentials, so leave it off.

Two limits a hosted build cannot work around, and the desktop build does not have:

- **A redirect is opaque.** If `http://host` 301s to `https://host`, the redirect response carries
  no `Access-Control-Allow-Origin` and the browser refuses to follow it. Use the final URL.
- **Mixed content.** A dashboard served over https cannot call a Glances over http. Serve the
  dashboard over http too, or put the Glances behind a TLS-terminating proxy.

A blocked request and an unreachable server look identical to a browser — both surface as
`TypeError: Failed to fetch` with no detail — so widgets and the connection test name both
possibilities on web. The browser console has the actual CORS message.

## Releases

**The version field in `package.json` is the release trigger.** Bump it, commit, push to `main` —
[`.github/workflows/release.yml`](.github/workflows/release.yml) does the rest:

```bash
npm run release:patch
```

(`release:minor` and `release:major` for the other two; pick by semver intent.) The bump
deliberately creates **no git tag** — the workflow owns tags, so a local one can never disagree
with what shipped. `npm version` runs `scripts/sync-version.js` on the way through, which
propagates the new version into `app.json` (including a monotonic Android `versionCode`) and
`src-tauri/tauri.conf.json`. Commit all four files together.

On push, the workflow asks whether the current version is **already tagged**. Tagged means nothing
runs, so ordinary dependency edits to `package.json` are free. Untagged means it has not shipped
yet, whatever the commit history looks like:

1. **Gate** — `lint`, `typecheck`, `test`, plus a check that the three version fields agree.
2. **Build**, in parallel — the web export, the Android APK, and the Windows installer.
3. **Publish** — tag `vX.Y.Z`, create the GitHub Release, attach everything.

| Asset | Built by |
| --- | --- |
| `Glances Telemetry_<version>_x64-setup.exe` | `windows-latest`, Rust + `npm run build:desktop` |
| `glances-dashboard-<version>-portable.exe` | the same build, unpacked |
| `glances-dashboard-<version>.apk` | `expo prebuild` + `gradlew assembleRelease` |
| `glances-dashboard-web-<version>.zip` | `npm run build:web`, zipped `dist/` |

The tag is pushed only after all three builds succeed, so a broken build leaves no tag and no
half-empty release — and, because the tag is also what the first job looks for, the next push
simply tries again. Re-running the workflow on the same version is safe: the tag, the release and
each upload all check for what is already there.

If a release is ever missed, **Actions → Release → Run workflow** publishes whatever version
`main` is on right now; a manual run skips the tag check entirely.

A release needs no code change: bumping the version alone is enough to rebuild, which is how you
pick up a base-image or toolchain fix.

**There are no in-app updates.** The reference checks for and installs its own updates; this app
deliberately does not, and has no Updates settings tab. Updating means downloading the new
installer or APK from the release page — a deliberate scope decision (see
[REWRITE_PLAN.md](REWRITE_PLAN.md) §6), not an omission: it would cost a new native surface on
desktop, a separate story on Android, and it is a delivery feature rather than a dashboard one.

**The APK is debug-signed.** Expo's generated project points its `release` buildType at the
template's debug keystore, and CI leaves it there — no secrets to manage, and the signature is
stable across builds so upgrades install over each other. It is fine for sideloading and not fine
for a store listing. Moving to a real keystore means generating one, adding it base64-encoded plus
its passwords as repository secrets, and giving `android/app/build.gradle` a proper `signingConfig`
via a config plugin (the `android/` directory is generated, so the edit cannot simply be committed).

## Documentation

- [REWRITE_PLAN.md](REWRITE_PLAN.md) — architecture, decisions, milestones
- [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md) — current status
- [AGENTS.md](AGENTS.md) — conventions and rules for working in this repo
