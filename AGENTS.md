# AGENTS.md — How to work in this repo

This repo is a **React Native (Expo) rewrite** of the app at
`E:\projects\glances-dashboard` ([GitHub](https://github.com/drumslave-git/glances-dashboard)).
That project is the **behavioral reference** — when in doubt about what a feature should do,
read its source. Never modify the reference project.

**The reference changed underneath this port.** M0–M9 were built against a Vite + React +
**Mantine** web app with five *generic* widgets (pick a plugin, pick some fields). It is now an
**Electron desktop app at v1.13.0** — MUI + ECharts + SQLite, a main-process poller, and **26
purpose-built widget types**. Its design document is `E:\projects\glances-dashboard\DESIGN.md`,
and it is the authority: cite it as *(ref §7.4)*. Realigning this app onto it is milestones
M10–M17. **Anything in this file or in the docs that describes the old Mantine app is history,
not a specification** — the "Reference map" table below is kept only to explain existing code.

## Start of every session

0. **Expo has changed.** This project is on **Expo SDK 57 / React Native 0.86 / React 19.2**. Consult the versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing Expo code — older tutorials and memorized APIs are frequently wrong.
1. Read [REWRITE_PLAN.md](REWRITE_PLAN.md) — architecture, decisions, milestones. Decisions in §1 are settled; don't relitigate them without asking the owner.
2. Read [REWRITE_PROGRESS.md](REWRITE_PROGRESS.md) — what's done, what's next, known blockers.
3. Work the milestones **in order**. Within a milestone, task order is flexible.

## End of every task / milestone

- Update REWRITE_PROGRESS.md (checkboxes, status line, dated notes for anything surprising) **in the same commit** as the code.
- Record architecture-affecting choices in the Decisions log with a one-line "why".
- Milestone is done only when: tests pass, `typecheck` and `lint` are clean, and the app was actually run on Android (Expo Go/emulator) — plus web from M6 on.

## Commands

```bash
npx expo start            # dev server (Metro) — leave running
npx expo start --web      # web only
npm test                  # jest
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run setup:skia-web    # copy canvaskit.wasm into public/ (once per clone; charts need it on web)
npm run build:web         # expo export --platform web
npm run desktop           # Tauri window against the dev server (starts Expo itself)
npm run build:desktop     # Windows .exe + NSIS installer, from a fresh web export
npm run release:patch     # bump package.json (also :minor/:major) — this is the release trigger
npm run sync:version      # propagate that version into app.json + tauri.conf.json (--check in CI)
```

(If a script is missing in package.json during early milestones, add it — these names are the contract.)

## Running on Android (read this before trying)

**Use the dev build, not Expo Go.** Expo Go cannot load this project on the local
emulators — it fails with `java.io.IOException: Failed to download remote update` and shows
its spinner forever. The cause is the emulator, not the app (see below), but the dev build
works around it and Expo Go cannot.

```bash
npx expo start
```

then, in a second shell:

```bash
npm run android:emulator
```

`scripts/run-android.ps1` does the whole dance: builds and installs the debug APK, sets up
the adb tunnel, points React Native's dev-server setting at it, and launches the app.

**The emulator bug this works around.** The API 36 system images bring up *both* `eth0`
(10.0.2.15) and `wlan0` (10.0.2.16) on `10.0.2.0/24` with **no default route**. Android
prefers `wlan0`, whose network has no host alias, so nothing on the device can reach the
host — not `10.0.2.2`, not the LAN IP, not DNS (`localhost` does not even resolve). Verify
with `adb shell ip route`: if there is no `default via …` line, this is what you are hitting.

Two independent fixes, both applied by the script:
1. **`adb root` + `svc wifi disable`** drops the phantom `wlan0`, so `eth0` becomes the
   default network and `ip route show table eth0` gains `default via 10.0.2.2`. **This one
   matters beyond Metro** — without it the app has no working network at all and cannot
   reach a Glances server. It requires a **`google_apis`** system image; `google_apis_playstore`
   images refuse `adb root` (the `Pixel_10` AVD is google_apis, `Pixel_7` is playstore).
2. **`adb reverse tcp:8081 tcp:8081` + `debug_http_host=127.0.0.1:8081`** in the app's shared
   preferences, so Metro is reached over adb rather than the emulator's NAT.

Fix 2 is not redundant: even with routing repaired, the emulator's NAT stalls on large
transfers. Small responses come through, but the ~11 MB dev bundle never finishes — which is
exactly why **Expo Go cannot work here** (it has no adb tunnel to fall back on) while the dev
build does. Lowering the MTU to 1400 does not help.

Two more traps worth knowing:
- **Build with JDK 17.** Android Studio ships JDK 25, and AGP's CMake step dies on it with
  "a restricted method in java.lang.System has been called". Gradle provisions a JDK 17 under
  `~/.gradle/jdks`; the script finds and uses it.
- **Build `x86_64` only** (`-PreactNativeArchitectures=x86_64`). Building all four ABIs takes
  ~3x longer and the arm64 native builds fail first anyway.

`android/` is generated by prebuild and is gitignored — regenerate it with
`npx expo prebuild --platform android` if it goes missing.

## Releasing

The **`package.json` version field is the release trigger** — nothing ships until it changes
on `main`. `npm run release:patch` bumps it **without** creating a git tag; the `Release`
workflow owns tags, so local and remote can never diverge. `npm version`'s lifecycle hook runs
`scripts/sync-version.js`, which writes the same version into `app.json` (plus a monotonic
Android `versionCode`) and `src-tauri/tauri.conf.json` — commit all of them together, and CI
fails the release if they disagree. See README → Releases for what gets built and attached.

## Layout conventions

- Routes are **`src/app/`** (expo-router, typed routes on). Everything else lives under `src/`.
- Import with the **`@/` alias** (`@/state/servers`, `@/utils/widgetData`) — not deep relative paths.
- Tests are colocated: `foo.ts` → `foo.test.ts`.
- **Route files are thin re-exports.** Expo Router turns every file under `src/app` into a route — a colocated `index.test.tsx` would become the route `/index.test`. So screens live in `src/screens/` with their tests beside them, and the route file is one line:
  ```tsx
  // src/app/index.tsx
  import { DashboardScreen } from '@/screens/dashboard-screen';
  export default DashboardScreen;
  ```

## Toolchain gotchas found the hard way

Verify against installed types (`node_modules/**/*.d.ts`) rather than memory — these versions moved:

- **Tamagui v5 config drops React Native's long style prop names.** `padding` and `textAlign` do not typecheck; use the shorthands `p`/`px`/`py`/`m`/`mx`, `text`, `items`, `justify`, `self`, `rounded`, `bg`. (`flex`, `gap`, `opacity`, `justifyContent`, `alignItems` still work.) The full shorthand map is in `@tamagui/config` v5's `defaultConfig.shorthands`.
- **RNTL 14's `render` is async.** It returns a Promise, and the global `screen` stays unbound until it resolves. Always `await renderWithProviders(...)` and prefer the returned queries over `screen`.
- **TypeScript 6 does not auto-include `@types` globals.** Anything needed globally must be listed in `tsconfig.json` → `compilerOptions.types` (currently `["jest", "node"]`).
- **Shell working directory persists between tool calls.** Use absolute paths for npm commands; a stray `cd` into `node_modules/...` will silently install into the wrong package.
- **Never run Metro with `CI=1` while developing.** CI mode disables the file watcher, so Metro keeps serving a stale cached bundle and your changes never reach the device — even after reinstalling the app. Plain `npx expo start` works fine in a background process.
- **A static route beats a dynamic one.** `/widget/new` as a file would swallow `router.push({ pathname: '/widget/[id]', params: { id: 'new' } })`, which navigates to itself instead of the config screen. The picker therefore lives at `/widget/pick` and `id: 'new'` means "create".
- **`toHaveTextContent` compares the whole string.** Use a regex for substring assertions: `toHaveTextContent(/total = 12/)`.
- **Tamagui `Card` does not reliably receive touches** even with `onPress`; component tests pass because they call the handler directly. Use `Button` (with `height="auto"`) for anything tappable.
- **Zustand selectors must return stable references.** `useStore(selectOrderedWidgets)` sorts into a new array each call and loops via `useSyncExternalStore`. Select raw state and derive with `useMemo`.
- **Edit source files with the editor tools, not PowerShell `Set-Content`** — it writes a BOM and can double-encode UTF-8, which trips the `unicode-bom` lint rule and mangles em-dashes.
- **Metro resolves `foo.web.ts` but missed `foo.web.tsx`** (SDK 57, `expo export --platform web`). A platform-specific file that "has nothing to do with anything" is probably being shadowed by its base file — check the export output for your module's strings before debugging anything else.
- **Skia on web binds `global.CanvasKit` at module-eval time.** `LoadSkiaWeb()` has to finish *before* anything that imports `@shopify/react-native-skia` is imported, not before it renders. See `src/components/charts/canvases.web.ts`; run `npm run setup:skia-web` once so `public/canvaskit.wasm` exists.
- **Tamagui's `bg` only takes theme tokens.** Arbitrary hex (chart colours) has to go through `style={{ backgroundColor }}`, and a `Button` will paint over it — put a plain `YStack` swatch inside the button instead.
- **Jest renders charts for real, and that took setup**: `jest.resolver.js` (react-native-worklets must not resolve its `.native` entries), gesture-handler + Skia `jestSetup` files, and `jest.environment.js`, which boots CanvasKit asynchronously because `setupFiles` cannot await. Don't "simplify" these away.
- **Firing `layout` in a test needs a flush.** `fireEvent(el, 'layout', …)` then `await waitFor(() => undefined)`; a bare `await act(async () => {})` collides with RNTL 14's own act scope and silently breaks every later test in the file. The same applies to **several `fireEvent`s in a row** — await between each, or the overlapping act scopes wedge the renderer and every later test in the file fails with "unable to find element" on its *own* render.
- **`fireGestureHandler`'s first ACTIVE event fires `onStart`, not `onUpdate`.** A pan needs two ACTIVE entries — one to activate, one to move — or the gesture silently does nothing. Give the gesture a `.withTestId()` so `getByGestureTestId` can find it.
- **Tamagui v5 drops `zIndex` as a prop** (no `z` shorthand either). It has to go through `style={{ zIndex }}`, like arbitrary colours.
- **Don't write refs during render** — `react-hooks/refs` fails the lint. If it was to dodge a stale closure in a callback, check whether the prop it mirrors is already stable enough to close over.
- **Write accessibility labels as `aria-label`, not `accessibilityLabel`.** Tamagui forwards props it does not recognise straight to the DOM element on web, where React rejects the React Native spelling and logs an error on every render. React Native has understood `aria-label` since 0.71.
- **`app/+html.tsx` does nothing here** — it is only consulted by the rendered web output modes, and this app exports `web.output: "single"`. The HTML shell is `public/index.html` (`npx expo customize index.html` writes the stock one); everything else in `public/` is copied to the site root verbatim. `app.json` → `expo.web.themeColor`/`.description`/`.lang` are injected into that shell at export time, and `%WEB_TITLE%`/`%LANG_ISO_CODE%` are substituted **first-occurrence-only** — naming either in a comment eats the substitution and ships the literal placeholder.
- **A hidden browser tab cannot draw.** With `document.visibilityState === 'hidden'`, `requestAnimationFrame` never fires: Skia's canvas never sizes itself or paints, real clicks stop hit-testing, and screenshots time out. The DOM is still fully inspectable and synthetic pointer events still drive the app, but a blank chart in a hidden tab proves nothing. To see the web build for real without a visible browser: serve `dist/`, `adb reverse` that port and `61208`, open it in the **emulator's Chrome**, and screenshot with `adb exec-out screencap -p`.
- **Tamagui does not set `position` on web**, so a plain `YStack` is `static` and absolutely-positioned children escape it — on native every `View` is a containing block, so the same tree lays out correctly there. Any `position="absolute"` needs an explicit `position="relative"` on the box it is meant to be measured against.
- **An absolute child also paints *over* its in-flow siblings on web**, which native does not do — there, tree order alone puts an earlier child behind. So a "background" layer needs both halves: `position="relative"` plus `style={{ zIndex: 0 }}` on the parent to make it a stacking context, and `zIndex: -1` on the layer itself. Without the stacking context the `-1` sends the layer behind an *ancestor's* background instead. `GradientSurface` in `components/telemetry/surfaces.tsx` is the worked example; it shipped in v0.1.1 with neither half, and the toolbar's gradient covered the entire desktop window — the app was fully laid out, themed and clickable underneath (the gradient is `pointerEvents="none"`), just invisible. **A blank window whose DOM is correct is this bug, not a crash.** Diagnose it by promoting everything to its own compositor layer — inject `#root, #root * { will-change: transform }` over CDP; if the UI appears, something is painting on top of it.
- **The desktop target runs the *web* bundle**, so `Platform.OS === 'web'` is true inside the Tauri window and there is no desktop-specific branch to write. It is a real WebView2: it enforces CORS exactly like a browser, from the origin `http://tauri.localhost`.
- **Tamagui v5 *does* have `shrink` and `grow` shorthands** (for `flexShrink`/`flexGrow`), even
  though the long names are not props. The earlier note about "no `grow` shorthand" applied to a
  plain style object passed to `contentContainerStyle`, which is a different type.
- **`role` is taken.** Tamagui's `Text` already accepts `role` (the ARIA one), so a component
  prop of that name collides. The type-scale role on the text primitives is called `variant`.
- **`react-hooks/purity` forbids `Date.now()` during render**, which rules it out of a `useMemo`
  as well. For anything time-windowed, measure back from the newest sample instead — purer, and
  usually more correct.
- **`react-hooks/immutability` forbids two effects writing the same shared value** when one is
  also a dependency of the other. Animations that share a `useSharedValue` go in one effect.
- **"Port 8081 is being used by another process" can be a lie.** Windows reserves TCP ranges for
  Hyper-V/WSL, and on this machine that included **8081–8580** — so Metro cannot bind, `netstat`
  shows nothing listening, and `tauri dev` dies in its `beforeDevCommand`. Check with
  `netsh int ipv4 show excludedportrange protocol=tcp`; the ranges change on reboot. Either pick a
  port outside them or verify against the built desktop app, which serves `dist/` from
  `tauri.localhost` and needs no dev server at all.
- **A Tauri window can be driven over CDP.** Launch the exe with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and attach to `http://127.0.0.1:9222/json/list`. Unlike the automation pane's hidden tab, this window is genuinely visible, so Skia paints and `Page.captureScreenshot` works. Mouse events are dispatched in viewport coordinates — an element scrolled below the fold gets a click at a `y` outside the window, which silently does nothing.

## The "Telemetry" design system (M8)

The visual language is an external design handoff, implemented in `src/theme/telemetry.ts`
(tokens, both modes), `src/utils/typeScale.ts` (type channels + degrade ladders) and
`src/components/telemetry/` (primitives). Three rules matter more than the rest:

- **No grey text.** Every text colour clears 4.5:1 against its surface, and
  `src/theme/telemetry.test.ts` asserts it for every token × surface pair. Hierarchy comes from
  size, weight, letter-spacing and accent — never from fading text toward the background. If you
  add a token, the test will tell you whether it is legal.
- **Font size has two channels.** The *reading* channel (labels, chips, rows, footers, axis
  ticks) scales with the user's setting; the *display* channel (hero numerals, gauge centres)
  sizes off the widget box and must never see that multiplier. `components/telemetry/text.tsx`
  is the first, `hero.tsx` the second — there is deliberately no `scale` parameter in `hero.tsx`.
- **Breakpoints are per widget, not per window.** The web original used container queries; here
  every ladder takes a *measured* box, so two differently-sized cards on one screen degrade
  independently. Never reach for `useWindowDimensions` to decide what a widget shows.

Numbers are always JetBrains Mono with tabular figures, and every unformatted number goes
through `formatLooseNumber` — Glances serves full float precision and raw values do not read.

## Hard rules

- **TypeScript strict**, no `any` (use `unknown` + narrowing, as the source app does).
- **Keep the native surface small**: local runs use a dev build, so a library needing native code will *work* — but it still costs a rebuild, an EAS build for anyone else, and it forecloses Expo Go as a fallback. Prefer libraries that would run in Expo Go, and flag anything that would not to the owner first. Chosen deps (Skia, Reanimated, gesture-handler, Tamagui, AsyncStorage) all qualify.
- **Ported logic stays pure and tested**: `src/utils/` (formatters, token resolution, chart segments, colors) must remain platform-free pure TS with unit tests. Port behavior verbatim from the reference before "improving" it.
- **Charts only through `ChartView`**: no Victory Native XL imports outside `src/components/charts/`. This boundary is the planned escape hatch if web rendering fails (see plan §5 Risks). Chart geometry (sizing, slice angles, label positions) is pure TS in `src/utils/chartGeometry.ts` so it stays testable without a canvas.
- **UI only through Tamagui** components/tokens — no ad-hoc `StyleSheet` styling except where a library demands raw views.
- **Data fetching only through `useGlancesQuery`** (TanStack Query). Never `fetch` directly from components; query keys are `[serverId, endpointPath]`.
- All persisted state goes through the Zustand stores in `src/state/` — no direct AsyncStorage calls elsewhere. Persisted shapes are user data: when changing `WidgetConfig`/`GlancesServer`, add a versioned migration in the store.

## Testing expectations

- Pure logic: unit tests colocated (`*.test.ts`), written **with or before** the port.
- Screens/widgets: React Native Testing Library tests with fixture Glances payloads (capture real payloads into `__fixtures__/` once and reuse).
- Don't mock what you can use for real; mock only the network boundary (TanStack Query test wrapper or msw-style fetch stubs).

## Glances API cheatsheet

- Base: `http://<host>:61208`, REST under `/api/4/…`, all plain GET returning JSON.
- A Glances behind a reverse proxy is served on the scheme's default port (`https://host/api/4/…`), so **only default the port when the user omitted the scheme** — see `coerceServerUrl`.
- Real captured payloads live in `src/__fixtures__/glances.ts` — use them in tests rather than inventing shapes. Two traps they record: `fs` leads with bind mounts rather than real disks on a containerised server, and `processlist` entries carry an array `cmdline` and a nested `memory_info`.
- `/api/4/pluginslist` → string[] of available plugins/metrics.
- `/api/4/system` → `{ hostname, linux_distro, os_name, ... }`.
- `/api/4/{plugin}` (e.g. `cpu`, `mem`, `load`, `fs`, `gpu`, `processlist`) → object **or array** (fs/gpu/processlist are arrays; widget logic takes the first element except processes, which uses the whole array).
- No auth in scope. CORS matters only for web/desktop-webview targets.

## Running the reference (v1.13.0)

```bash
npm install && npm run setup
```

`npm run setup` is documented as mandatory (`.npmrc` sets `ignore-scripts=true`), but on this
machine it reported success **without** downloading the Electron binary and `electron-vite dev`
then died with `Error: Electron uninstall`. The actual fix is
`node node_modules/electron/install.js`.

```bash
npx electron-vite dev --remoteDebuggingPort=9333
```

Both apps are **CDP-drivable and genuinely visible**, which is the only way to see either one
render for real (the RN Tauri build via
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9444`). Seed a board without
clicking: the reference takes `window.api.invoke('widgets:save', …)`, this app takes
`localStorage['glances-dashboard:widgets']`.

Test server: **`https://glances.tcloud.monster`** (Glances 4.5.6, 28 plugins including
`containers`, `gpu`, `sensors`, `alert`). Use `https` — the `http` URL 301s and **the redirect
response carries no CORS header**, so a browser blocks it before following. That single fact is
why the reference polls from its main process and why this app's desktop target has to go
through Tauri's Rust HTTP client.

## Reference map (the *old* Mantine web app → this repo)

Historical. It explains why the current `src/utils/` looks the way it does; it is not a spec for
new work — see REWRITE_PLAN.md §3.3 for what survives the realignment and what goes.

| Old web app file | Became |
|---|---|
| `src/utils/widgetData.ts`, `chartColors.ts`, `widgetFactory.ts` | `src/utils/` — verbatim port + tests |
| `src/hooks/useGlancesEndpoint.ts` | `src/hooks/useGlancesQuery.ts` (TanStack Query) |
| `src/hooks/useSettingsStorage.ts`, `useWidgetsStorage.ts` | `src/state/` Zustand persisted stores |
| `src/components/WidgetGrid.tsx` (react-grid-layout) | reorderable grid + size presets (plan §3/§4 M5) |
| `src/components/WidgetContent/*` | `src/components/widgets/` + `charts/` |
| `src/components/*Modal*` | expo-router screens/sheets under `app/` |
| Mantine UI | Tamagui |
| Mantine charts (Recharts) | Victory Native XL behind `ChartView` |
