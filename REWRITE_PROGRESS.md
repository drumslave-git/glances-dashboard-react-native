# Rewrite Progress

Tracks execution of [REWRITE_PLAN.md](REWRITE_PLAN.md). Update this file in the same
commit as the work it describes. One line per task; add dated notes under each milestone
when something non-obvious happened.

**Current status:** M0 complete (except on-device Android check â€” see note). Next up: M1 domain, storage, data layer.

## Milestones

### M0 â€” Scaffold â€” `done` (2026-08-01)
- [x] git init + .gitignore + initial commit of docs
- [x] create-expo-app (SDK 57, TS) + expo-router + strict tsconfig + ESLint flat config
- [x] Tamagui configured (`@tamagui/config/v5`, dark default) â€” `src/theme/tamagui.config.ts`
- [x] Victory Native XL + Skia + Reanimated + gesture-handler + Zustand + TanStack Query + AsyncStorage installed
- [x] Jest + jest-expo + RNTL 14 with a component smoke test that renders through the real providers
- [x] Bundles for Android (`expo export --platform android`, 5.2 MB hbc) and web
- [x] Web verified running: static export renders the real UI text and Tamagui CSS; dev server returns 200
- [x] **Runs on Android** â€” verified on the Pixel_7 emulator (API 36, x86_64): the dashboard screen renders with the dark Tamagui theme and `ReactNativeJS: Running "main"` in logcat. Uses a **dev build**, not Expo Go (see below).

**Android dev environment (2026-08-01) â€” configured and working**
- Android Studio + SDK at `%LOCALAPPDATA%\Android\Sdk`: platform-tools, emulator, cmdline-tools, build-tools, platforms `android-36`/`36.1`/`37.0`, system image `android-36.1/google_apis/x86_64`
- AVD `Pixel_10` boots and is reachable: `adb devices` â†’ `emulator-5554`, API 36, `sdk_gphone64_x86_64`
- User-level `ANDROID_HOME` set, and `platform-tools` + `emulator` added to the user `Path`
- Hardware acceleration is available (`HypervisorPresent` = true), so no HAXM/AEHD setup is needed

Start the emulator with:
`%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd Pixel_10`

**Notes (2026-08-01)**
- SDK 57 ships React Native 0.86, React 19.2, TypeScript 6, with typed routes and the React Compiler enabled.
- Expo Router treats **every** file under `src/app` as a route, including `*.test.tsx`. Routes are therefore thin re-export files and the real components live in `src/screens`, where tests can sit beside them.
- TypeScript 6 does not auto-include `@types` globals the way TS 5 did; `types: ["jest", "node"]` is now explicit in tsconfig.
- Small cleanup deferred to M1: the template pulled in `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-web-browser`, `expo-image` and `expo-font`, none of which this app uses. Removing them should shrink the bundle; re-run both exports afterwards.

### M1 â€” Domain, storage, data layer â€” `not started`
- [ ] Types: GlancesServer, WidgetConfig (size/order model)
- [ ] Zustand stores + AsyncStorage persistence
- [ ] Port widgetData.ts / chartColors.ts / widgetFactory.ts with unit tests
- [ ] Glances API client + useGlancesQuery (TanStack Query polling)
- [ ] pluginslist + system endpoints wired
- [ ] Settings: server list CRUD + refresh interval + connection test

### M2 â€” Dashboard shell + text widget â€” `not started`
- [ ] Dashboard screen + header + empty state
- [ ] Widget card frame (tokens in title, edit-mode actions, loading/error)
- [ ] Add-widget flow: type picker â†’ config screen
- [ ] Config screen v1 (server, metric, title, fields, live preview)
- [ ] Text widget end-to-end

### M3 â€” Chart widgets â€” `not started`
- [ ] ChartView abstraction over Victory Native XL
- [ ] Donut (options + center label), pie, bar
- [ ] Per-field colors + picker; formatter display labels
- [ ] Used/Free split; chart label tokens
- [ ] Component tests per chart kind
- [ ] Early web smoke check of charts (risk item)

### M4 â€” Processes widget + parity sweep â€” `not started`
- [ ] Processes table (columns, labels, 50-row cap, scrolling)
- [ ] Per-field formatter UI
- [ ] Parity checklist sweep (REWRITE_PLAN.md Â§2)

### M5 â€” Layout, reorder, immersive, tablet â€” `not started`
- [ ] Responsive columns; S/M/L/XL size presets
- [ ] Long-press drag reorder, persisted order
- [ ] Immersive mode (keep-awake, tap/back exit)
- [ ] Tablet pass

### M6 â€” Web target â€” `not started`
- [ ] CanvasKit/Skia web setup; charts verified in browser
- [ ] Reorder fallback decision for web
- [ ] PWA manifest + icons; Esc exits immersive
- [ ] Glances CORS requirement documented

### M7 â€” Windows desktop â€” `not started`
- [ ] Tauri wrapper of web build (or Electron fallback â€” record the decision here)
- [ ] Icon, window config, reproducible .exe build

### M8 â€” Hardening & release â€” `not started`
- [ ] Component tests: settings + config screens, error paths
- [ ] Perf pass (memoization, background polling pause, processlist cost)
- [ ] EAS Android build profile
- [ ] README for all targets

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-08-01 | Expo, Android+tablet+web+Windows-desktop, Tamagui, Victory Native XL, multi-server per widget, reorderable grid with size presets, Tauri/Electron for desktop, no migration, logic+component tests | Confirmed with owner during planning (see REWRITE_PLAN.md Â§1) |
| 2026-08-01 | Routes under `src/app` are thin re-exports; screen components live in `src/screens` | Expo Router turns any file in the app directory into a route, so colocated `*.test.tsx` would become routes |
| 2026-08-01 | Test helper `renderWithProviders` is async | RNTL 14 changed `render` to return a Promise; the global `screen` stays empty unless it is awaited |
| 2026-08-01 | Style props use Tamagui v5 shorthands (`p`, `px`, `text`, `items`, `justify`) | The v5 config drops the React Native long names `padding` and `textAlign`; the shorthands are what typecheck accepts |
| 2026-08-02 | Local Android runs use a **dev build** (`expo run:android`), not Expo Go | The emulator's broken host routing makes Expo Go unable to download a bundle at all; a dev build plus an adb tunnel works. Expo Go compatibility is now a library-selection guideline rather than a runtime requirement. |

## Blockers / open questions

_None. Android, web and the test suite all run._

## Android emulator: solved

**Root cause.** The API 36 emulator images bring up both `eth0` (10.0.2.15) and `wlan0`
(10.0.2.16) on `10.0.2.0/24` **with no default route**. Android prefers `wlan0`, whose
network has no host alias, so nothing on the device can reach the host: not `10.0.2.2`, not
the LAN IP, and DNS fails outright (`Unable to resolve host "localhost"`). Check with
`adb shell ip route` — no `default via ...` line means you are hitting this.

That single fault explains every symptom seen along the way: Expo Go's endless spinner and
its `java.io.IOException: Failed to download remote update`, and the dev build's
`Unable to load script`. Our code was never involved — a bare `<View><Text>` screen failed
identically.

**Fix (automated in `scripts/run-android.ps1`, run via `npm run android:emulator`):**
1. `adb reverse tcp:8081 tcp:8081` — tunnels Metro over adb, needing no device routing.
2. Write `debug_http_host=127.0.0.1:8081` into the app's shared preferences so React Native
   uses the tunnel instead of `10.0.2.2`.
3. Build `x86_64` only and with **JDK 17**.

**Two build traps**
- Android Studio ships **JDK 25**, and AGP's CMake step fails on it with "a restricted method
  in `java.lang.System` has been called". Gradle provisions a JDK 17 under `~/.gradle/jdks`;
  the script auto-detects it.
- Building all four ABIs takes ~3x longer and arm64 fails first. Use
  `-PreactNativeArchitectures=x86_64`.

**Also worth knowing:** `expo start --localhost` binds Metro to `::1` (IPv6 loopback) only,
which `adb reverse` (IPv4) cannot reach. Leave Metro on its default dual-stack `::` bind.
