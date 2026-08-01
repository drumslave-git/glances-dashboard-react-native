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
| `npm run build:web` | Static web export to `dist/` |
| `npm test` | Jest unit + component tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Requirements

- A reachable Glances server running its web/REST API: `glances -w` (default port `61208`).
- For the **web** build only: Glances must allow cross-origin requests from the app's origin,
  or the browser will block the API calls. Native Android builds are unaffected.

## Documentation

- [REWRITE_PLAN.md](REWRITE_PLAN.md) — architecture, decisions, milestones
- [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md) — current status
- [AGENTS.md](AGENTS.md) — conventions and rules for working in this repo
