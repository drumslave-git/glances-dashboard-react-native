# Rewrite Progress

Tracks execution of [REWRITE_PLAN.md](REWRITE_PLAN.md). Update this file in the same
commit as the work it describes. One line per task; add dated notes under each milestone
when something non-obvious happened.

**Current status:** M0 complete (except on-device Android check — see note). Next up: M1 domain, storage, data layer.

## Milestones

### M0 — Scaffold — `done` (2026-08-01)
- [x] git init + .gitignore + initial commit of docs
- [x] create-expo-app (SDK 57, TS) + expo-router + strict tsconfig + ESLint flat config
- [x] Tamagui configured (`@tamagui/config/v5`, dark default) — `src/theme/tamagui.config.ts`
- [x] Victory Native XL + Skia + Reanimated + gesture-handler + Zustand + TanStack Query + AsyncStorage installed
- [x] Jest + jest-expo + RNTL 14 with a component smoke test that renders through the real providers
- [x] Bundles for Android (`expo export --platform android`, 5.2 MB hbc) and web
- [x] Web verified running: static export renders the real UI text and Tamagui CSS; dev server returns 200
- [ ] **Open:** run on a physical Android device / emulator. This machine has no Android SDK or emulator, so only the bundle was verified. Needs a run through Expo Go before M1 is called finished.

**Notes (2026-08-01)**
- SDK 57 ships React Native 0.86, React 19.2, TypeScript 6, with typed routes and the React Compiler enabled.
- Expo Router treats **every** file under `src/app` as a route, including `*.test.tsx`. Routes are therefore thin re-export files and the real components live in `src/screens`, where tests can sit beside them.
- TypeScript 6 does not auto-include `@types` globals the way TS 5 did; `types: ["jest", "node"]` is now explicit in tsconfig.
- Small cleanup deferred to M1: the template pulled in `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-web-browser`, `expo-image` and `expo-font`, none of which this app uses. Removing them should shrink the bundle; re-run both exports afterwards.

### M1 — Domain, storage, data layer — `not started`
- [ ] Types: GlancesServer, WidgetConfig (size/order model)
- [ ] Zustand stores + AsyncStorage persistence
- [ ] Port widgetData.ts / chartColors.ts / widgetFactory.ts with unit tests
- [ ] Glances API client + useGlancesQuery (TanStack Query polling)
- [ ] pluginslist + system endpoints wired
- [ ] Settings: server list CRUD + refresh interval + connection test

### M2 — Dashboard shell + text widget — `not started`
- [ ] Dashboard screen + header + empty state
- [ ] Widget card frame (tokens in title, edit-mode actions, loading/error)
- [ ] Add-widget flow: type picker → config screen
- [ ] Config screen v1 (server, metric, title, fields, live preview)
- [ ] Text widget end-to-end

### M3 — Chart widgets — `not started`
- [ ] ChartView abstraction over Victory Native XL
- [ ] Donut (options + center label), pie, bar
- [ ] Per-field colors + picker; formatter display labels
- [ ] Used/Free split; chart label tokens
- [ ] Component tests per chart kind
- [ ] Early web smoke check of charts (risk item)

### M4 — Processes widget + parity sweep — `not started`
- [ ] Processes table (columns, labels, 50-row cap, scrolling)
- [ ] Per-field formatter UI
- [ ] Parity checklist sweep (REWRITE_PLAN.md §2)

### M5 — Layout, reorder, immersive, tablet — `not started`
- [ ] Responsive columns; S/M/L/XL size presets
- [ ] Long-press drag reorder, persisted order
- [ ] Immersive mode (keep-awake, tap/back exit)
- [ ] Tablet pass

### M6 — Web target — `not started`
- [ ] CanvasKit/Skia web setup; charts verified in browser
- [ ] Reorder fallback decision for web
- [ ] PWA manifest + icons; Esc exits immersive
- [ ] Glances CORS requirement documented

### M7 — Windows desktop — `not started`
- [ ] Tauri wrapper of web build (or Electron fallback — record the decision here)
- [ ] Icon, window config, reproducible .exe build

### M8 — Hardening & release — `not started`
- [ ] Component tests: settings + config screens, error paths
- [ ] Perf pass (memoization, background polling pause, processlist cost)
- [ ] EAS Android build profile
- [ ] README for all targets

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-08-01 | Expo, Android+tablet+web+Windows-desktop, Tamagui, Victory Native XL, multi-server per widget, reorderable grid with size presets, Tauri/Electron for desktop, no migration, logic+component tests | Confirmed with owner during planning (see REWRITE_PLAN.md §1) |
| 2026-08-01 | Routes under `src/app` are thin re-exports; screen components live in `src/screens` | Expo Router turns any file in the app directory into a route, so colocated `*.test.tsx` would become routes |
| 2026-08-01 | Test helper `renderWithProviders` is async | RNTL 14 changed `render` to return a Promise; the global `screen` stays empty unless it is awaited |
| 2026-08-01 | Style props use Tamagui v5 shorthands (`p`, `px`, `text`, `items`, `justify`) | The v5 config drops the React Native long names `padding` and `textAlign`; the shorthands are what typecheck accepts |

## Blockers / open questions

- Android on-device run is unverified — no Android SDK or emulator on the development machine. Needs a pass through Expo Go on a real phone.
