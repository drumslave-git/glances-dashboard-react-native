# Glances Dashboard (React Native)

A configurable dashboard for [Glances](https://nicolargo.github.io/glances/) system monitors,
built with Expo. Point it at one or more Glances servers, then build a dashboard out of
text, donut, pie, bar and process-list widgets.

Rewrite of the web app [drumslave-git/glances-dashboard](https://github.com/drumslave-git/glances-dashboard).

**Status:** in development — see [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md).

## Targets

Android (phone + tablet), Web, and Windows desktop (a Tauri window around the web build).
iOS is kept building but is not a release target.

## Development

```bash
npm install
npm start
```

Then press `a` for Android (Expo Go or an emulator) or `w` for web.

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Dev server, opens Android |
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

## Web build

`npm run build:web` writes a self-contained SPA to `dist/`. Serve it from any static host
— every route is client-side, so the host must fall back to `index.html` for unknown paths.

It is an installable PWA: `public/manifest.json` plus the icons in `public/icons/`, wired
into the page by `public/index.html` (Expo prefers that file over its own HTML template).
`npm run icons:web` regenerates the icons if the app icon changes.

`public/sw.js` is a service worker that **caches nothing** — it exists because Chrome will
not offer "Install app" without one. Offline support is deliberately absent: every number
on the dashboard comes from a live server, so a cached shell would only show a faster
"cannot reach the server". Browsers register workers over https or on localhost only, so a
plain-http deployment still runs, just without the install prompt.

Charts are Skia, which on web means CanvasKit compiled to WebAssembly. `npm run web` and
`npm run build:web` both copy `canvaskit.wasm` into `public/` first, so it is served from
the site root; without it the charts silently do not draw.

### Glances and CORS

A browser will only let the page read a Glances server that says the page is allowed to.
Native Android builds are not browsers and are unaffected by any of this.

A default `glances -w` **already permits every origin** (`cors_origins=*` in the `[outputs]`
section of `glances.conf`), so the web build normally works with no server-side change. If
the server has been locked down, or sits behind a reverse proxy that sets its own CORS
headers, allow the origin the dashboard is served from:

```ini
[outputs]
cors_origins=https://dashboard.example.com
```

Glances 4.5.2 and later default `cors_credentials` to `False`
([GHSA-9jfm-9rc6-2hfq](https://github.com/nicolargo/glances/security/advisories/GHSA-9jfm-9rc6-2hfq)).
This app sends no cookies or credentials, so leave it off.

A blocked request and an unreachable server look identical to a browser — both surface as
`TypeError: Failed to fetch` with no detail — so widgets and the connection test name both
possibilities on web. Check the browser console for the actual CORS message.

One more browser-only rule: a dashboard served over **https** cannot call a Glances over
**http** (mixed content). Either serve the dashboard over http too, or put the Glances
behind a TLS-terminating proxy.

## Windows desktop

The desktop app is the web build in a [Tauri](https://tauri.app) window — a native shell
around the system's WebView2, so the `.exe` is ~7 MB rather than a bundled Chromium.

```bash
npm run build:desktop
```

writes two things, after re-running `npm run build:web` so the bundle is never stale:

| Artifact | Path |
| --- | --- |
| Portable executable | `src-tauri/target/release/glances-dashboard.exe` |
| Installer | `src-tauri/target/release/bundle/nsis/Glances Dashboard_<version>_x64-setup.exe` |

The installer is per-user: it needs no administrator rights, installs to
`%LOCALAPPDATA%\Glances Dashboard`, adds a Start Menu entry, and ships its own
`uninstall.exe`. Both artifacts embed the whole frontend, so neither needs `dist/` at
runtime.

`npm run desktop` runs the same window against the Metro dev server instead, with hot
reload — it starts Expo for you.

### Building it

Windows only, and it needs a Rust toolchain alongside the Node one. Two prerequisites, both
once per machine — first Rust itself:

```bash
winget install Rustlang.Rustup
```

then the MSVC linker and Windows SDK, which come from Visual Studio's *Desktop development
with C++* workload:

```bash
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Everything else — NSIS, the Tauri CLI — is fetched automatically on first build. A cold
release build takes a few minutes; an incremental one is well under that, though the release
profile's link-time optimization means it is never instant.

**WebView2** is what actually renders the app. Windows 11 and current Windows 10 ship it;
where it is missing, the installer downloads it during setup.

`src-tauri/` holds the shell: `tauri.conf.json` (window size, icons, bundle settings) and a
`main.rs` that does nothing but open the window. There is no Rust-side application logic,
and the frontend is unmodified — the desktop build is the same `dist/` a browser gets.

### Glances, CORS and the desktop app

A WebView2 is a browser, so **everything in "Glances and CORS" above applies here too**.
The origin to allow is the one Tauri serves the app from:

```ini
[outputs]
cors_origins=http://tauri.localhost
```

Again, a default `glances -w` already allows every origin and needs no change.

The one way desktop is *better* than a hosted PWA: that origin is `http://`, so there is no
mixed-content rule stopping it from reading a plain-http Glances on the LAN. (Tauri's
`useHttpsScheme` would switch the origin to `https://tauri.localhost` and reintroduce
exactly that problem, which is why it is left off.)

## Releases

**The version field in `package.json` is the release trigger.** Bump it, commit, push to
`main` — [`.github/workflows/release.yml`](.github/workflows/release.yml) does the rest:

```bash
npm run release:patch
```

(`release:minor` and `release:major` for the other two; pick by semver intent.) The bump
deliberately creates **no git tag** — the workflow owns tags, so a local one can never
disagree with what shipped. `npm version` runs `scripts/sync-version.js` on the way through,
which propagates the new version into `app.json` (including a monotonic Android
`versionCode`) and `src-tauri/tauri.conf.json`. Commit all four files together.

On push, the workflow compares the version against the previous commit. Unchanged means
nothing runs, so ordinary dependency edits to `package.json` are free. Changed means:

1. **Gate** — `lint`, `typecheck`, `test`, plus a check that the three version fields agree.
2. **Build**, in parallel — the web export, the Android APK, and the Windows installer.
3. **Publish** — tag `vX.Y.Z`, create the GitHub Release, attach everything.

| Asset | Built by |
| --- | --- |
| `Glances Dashboard_<version>_x64-setup.exe` | `windows-latest`, Rust + `npm run build:desktop` |
| `glances-dashboard-<version>-portable.exe` | the same build, unpacked |
| `glances-dashboard-<version>.apk` | `expo prebuild` + `gradlew assembleRelease` |
| `glances-dashboard-web-<version>.zip` | `npm run build:web`, zipped `dist/` |

The tag is pushed only after all three builds succeed, so a broken build leaves no tag and
no half-empty release. Re-running the workflow on the same version is safe — the tag, the
release and each upload all check for what is already there.

A release needs no code change: bumping the version alone is enough to rebuild, which is how
you pick up a base-image or toolchain fix.

**The APK is debug-signed.** Expo's generated project points its `release` buildType at the
template's debug keystore, and CI leaves it there — no secrets to manage, and the signature
is stable across builds so upgrades install over each other. It is fine for sideloading and
not fine for a store listing. Moving to a real keystore means generating one, adding it
base64-encoded plus its passwords as repository secrets, and giving `android/app/build.gradle`
a proper `signingConfig` via a config plugin (the `android/` directory is generated, so the
edit cannot simply be committed).

## Documentation

- [REWRITE_PLAN.md](REWRITE_PLAN.md) — architecture, decisions, milestones
- [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md) — current status
- [AGENTS.md](AGENTS.md) — conventions and rules for working in this repo
