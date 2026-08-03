# Glances Dashboard (React Native)

A configurable dashboard for [Glances](https://nicolargo.github.io/glances/) system monitors,
built with Expo. Point it at one or more Glances servers, then build a dashboard out of
text, donut, pie, bar and process-list widgets.

Rewrite of the web app [drumslave-git/glances-dashboard](https://github.com/drumslave-git/glances-dashboard).

**Status:** in development — see [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md).

## Targets

Android (phone + tablet), Web, and Windows desktop (via a wrapper around the web build).
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
| `npm run setup:skia-web` | Copy `canvaskit.wasm` into `public/` — the charts need it on web |
| `npm run icons:web` | Regenerate the PWA icons in `public/icons/` from `assets/images/` |
| `npm test` | Jest unit + component tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

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

## Documentation

- [REWRITE_PLAN.md](REWRITE_PLAN.md) — architecture, decisions, milestones
- [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md) — current status
- [AGENTS.md](AGENTS.md) — conventions and rules for working in this repo
