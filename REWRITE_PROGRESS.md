# Rewrite Progress

Tracks execution of [REWRITE_PLAN.md](REWRITE_PLAN.md). Update this file in the same
commit as the work it describes. One line per task; add dated notes under each milestone
when something non-obvious happened.

**Current status:** M8 complete — the "Telemetry" redesign is implemented across every target: token layer for dark and light with the contrast floor under test, bundled Space Grotesk / JetBrains Mono, two-channel type scaling, the widget shell anatomy with its degrade ladders, per-endpoint accent colours, the toolbar and summary strip, and two new widget archetypes (ring gauge, time series). M9 is under way: the release pipeline is in place (a `package.json` version bump on `main` gates, builds and publishes the Windows installer, Android APK and web bundle). **v0.1.1 shipped a desktop (and web) build that rendered a blank window** — `GradientSurface` covered the app; fixed and verified in the real Tauri window, details under M9. Still open in M9: component tests for the settings and config screens, the perf pass, and the README pass over every target.

## Milestones

### M0 — Scaffold — `done` (2026-08-01)
- [x] git init + .gitignore + initial commit of docs
- [x] create-expo-app (SDK 57, TS) + expo-router + strict tsconfig + ESLint flat config
- [x] Tamagui configured (`@tamagui/config/v5`, dark default) — `src/theme/tamagui.config.ts`
- [x] Victory Native XL + Skia + Reanimated + gesture-handler + Zustand + TanStack Query + AsyncStorage installed
- [x] Jest + jest-expo + RNTL 14 with a component smoke test that renders through the real providers
- [x] Bundles for Android (`expo export --platform android`, 5.2 MB hbc) and web
- [x] Web verified running: static export renders the real UI text and Tamagui CSS; dev server returns 200
- [x] **Runs on Android** — verified on the emulator (API 36, x86_64): the dashboard screen renders with the dark Tamagui theme and `ReactNativeJS: Running "main"` in logcat. Uses a **dev build**, not Expo Go (see below).

**Android dev environment — configured and working**
- Android Studio + SDK at `%LOCALAPPDATA%\Android\Sdk`: platform-tools, emulator, cmdline-tools, build-tools, platforms `android-36`/`36.1`/`37.0`
- AVDs: `Pixel_10` (android-36.1, **google_apis** — rootable, preferred) and `Pixel_7` (android-36, google_apis_playstore — cannot `adb root`)
- User-level `ANDROID_HOME` set, and `platform-tools` + `emulator` added to the user `Path`
- Hardware acceleration is available (`HypervisorPresent` = true), so no HAXM/AEHD setup is needed

Start the emulator with:
`%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd Pixel_10`

then `npx expo start` in one shell and `npm run android:emulator` in another.

**Notes (2026-08-01)**
- SDK 57 ships React Native 0.86, React 19.2, TypeScript 6, with typed routes and the React Compiler enabled.
- Expo Router treats **every** file under `src/app` as a route, including `*.test.tsx`. Routes are therefore thin re-export files and the real components live in `src/screens`, where tests can sit beside them.
- TypeScript 6 does not auto-include `@types` globals the way TS 5 did; `types: ["jest", "node"]` is now explicit in tsconfig.
- Small cleanup deferred to M1: the template pulled in `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-web-browser`, `expo-image` and `expo-font`, none of which this app uses. Removing them should shrink the bundle; re-run both exports afterwards.

### M1 — Domain, storage, data layer — `done` (2026-08-03)
- [x] Types: GlancesServer, WidgetConfig (size/order model) — `src/types/dashboard.ts`
- [x] Zustand stores + AsyncStorage persistence — `src/state/{servers,widgets,storage}.ts`
- [x] Port widgetData.ts / chartColors.ts / widgetFactory.ts with unit tests
- [x] Glances API client + useGlancesQuery (TanStack Query polling)
- [x] pluginslist + system endpoints wired (`usePluginsList`, `useSystemInfo`)
- [x] Settings: server list CRUD + refresh interval + connection test
- [x] Removed the unused template deps (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-web-browser`, `expo-image`, `expo-font`)
- [x] 119 tests across 10 suites; typecheck and lint clean; verified on the emulator including a persistence round-trip across an app restart

**Notes (2026-08-03)**
- **Bug fixed rather than ported**: the reference app's `shorten` formatter rendered `-1500` as
  `--1.5k` (it prefixed a sign onto an already-negative quotient). Ours divides the absolute
  value. Everything else in `widgetData.ts` is a verbatim port.
- **Web output switched from `static` to `single`.** Static rendering executes the app in Node
  during export, where AsyncStorage's web backend touches `localStorage` and the export died
  with `ReferenceError: window is not defined`. A live dashboard gains nothing from
  prerendering, so SPA output is the right trade.
- Expo Router's typed routes reject template-literal hrefs for dynamic segments. Use the object
  form: `router.push({ pathname: '/settings/server/[id]', params: { id } })`. Route types are
  regenerated by running the dev server, so `typecheck` fails on new routes until Metro has run.
- Jest's mock factories cannot close over non-`mock`-prefixed variables — name router spies
  `mockPush`/`mockBack`.
- Query keys are `[serverId, endpointPath]`, and there is a test proving two widgets on the same
  server and endpoint share a single request.

### M2 — Dashboard shell + text widget — `done` (2026-08-03)
- [x] Dashboard screen + header (server name, hostname/distro, unreachable state) + empty states
- [x] Widget card frame: title with resolved tokens, edit-mode edit/remove/resize, loading and error states
- [x] Add-widget flow: type picker (`/widget/pick`) → config screen (`/widget/[id]`)
- [x] Config screen v1: server select, metric list from `pluginslist`, title, field picker discovered from the live payload, live preview
- [x] Text widget end-to-end
- [x] Responsive grid with S/M/L/XL size presets (`src/utils/widgetLayout.ts`); drag-reorder still M5
- [x] 159 tests across 14 suites; typecheck and lint clean
- [x] Verified on the emulator against a stub Glances server: metric discovery, field discovery, preview, save, and a widget polling live values

**Notes (2026-08-03)**
- Charts and the process table are offered in the type picker but disabled, labelled with the
  milestone they arrive in (M3/M4), and `WidgetContent` says the same in place of a body.
- **Two real bugs the tests and the device run caught:**
  - `useWidgetsStore(selectOrderedWidgets)` looped forever — the selector sorts into a new array
    each call, which `useSyncExternalStore` treats as a change. Sorting now happens in a `useMemo`.
  - A static `/widget/new` route swallowed `push({pathname:'/widget/[id]', params:{id:'new'}})`,
    so choosing a widget type navigated back to the picker. The picker moved to `/widget/pick`.
- The query key gained the server URL (`[serverId, url, endpointPath]`) so editing a server's
  address refetches immediately instead of showing the old address's cached error until the
  next poll. De-duplication across widgets is unaffected and still covered by a test.
- Verification used a stub Glances server (`node scripts/../fake-glances.js` in the scratchpad)
  tunnelled to the emulator with `adb reverse tcp:61208 tcp:61208`. Handy for M3/M4 too.

### M3 — Chart widgets — `done` (2026-08-03)
- [x] ChartView abstraction over Victory Native XL — `src/components/charts/`
- [x] Donut (size / thickness / gap / labels + centre label), pie, bar
- [x] Per-field colours + palette picker in the config screen
- [x] Formatter display labels on segments (formatter *UI* stays M4)
- [x] Used/Free split toggle; chart label tokens
- [x] Component tests per chart kind, driven from the real payload fixtures
- [x] **Web smoke check passed** — `expo export --platform web` plus a browser run: CanvasKit
      loads, all three chart kinds draw, no fallback renderer needed
- [x] 208 tests across 16 suites; typecheck and lint clean
- [x] Verified on the emulator against the live TCloud server: donut, pie, bar and a
      Used/Free split donut with a `{{percent:round(0)}}` centre label, all polling live

**Notes (2026-08-03)**
- **The web risk in plan §5 turned out to be real, and fixable.** Skia on web is CanvasKit
  compiled to wasm, and `@shopify/react-native-skia` builds its API object from
  `global.CanvasKit` *as its module body runs*. Importing a chart before `canvaskit.wasm` has
  landed therefore yields an API bound to `undefined`, and the first draw throws
  `Cannot read properties of undefined (reading 'XYWHRect')` — which killed the **whole app**
  on web, not just the chart. Gating at render time is not enough; the wait has to happen
  before the import. `src/components/charts/canvases.web.ts` starts `LoadSkiaWeb()` at module
  scope and `React.lazy`-imports the canvases behind it, with `ChartView` rendering them in a
  `<Suspense>`. `npm run setup:skia-web` copies the 8 MB wasm into `public/` (gitignored).
- **Metro platform resolution picked `.web.ts` but not `.web.tsx`.** The first version of that
  file was `canvases.web.tsx`; Metro silently resolved `./canvases` to the native `.ts` instead
  and nothing changed. Renaming to `.web.ts` fixed it. Suspect anything platform-specific that
  "has no effect" of being the wrong extension — check the export output for the module.
- **Charts do not live in the Skia canvas alone.** React Native text cannot be placed inside a
  Skia canvas, and Victory's own `Pie.Label` needs an `SkFont` asset. Slice labels and the donut
  centre label are therefore React Native text overlaid on the canvas, positioned by
  `src/utils/chartGeometry.ts`, which reproduces Victory's angle maths (degrees, 3 o'clock,
  clockwise). Bar charts get a legend row underneath instead of axis labels — axes would need a
  font too, and Victory only draws them when an axis prop is passed.
- `paddingAngle` is degrees in the reference and points in Victory (`Pie.SliceAngularInset`
  takes a stroke width), so it is converted through the chord the angle subtends at the rim.
  The gap itself is drawn with `blendMode="clear"`, which punches a real hole through to the
  card background rather than guessing a matching stroke colour.
- Jest needed three changes before Victory would render at all: a composed resolver
  (`jest.resolver.js`) so react-native-worklets stops resolving its JSI-backed `.native` entry
  points, gesture-handler's and Skia's own `jestSetup` files, and a **custom test environment**
  (`jest.environment.js`) that boots real CanvasKit — Skia's jest mock reads `global.CanvasKit`,
  and CanvasKit initialises asynchronously, which `setupFiles` cannot await. Chart tests
  therefore exercise the real Skia path maths, not a stub.
- Two cosmetic things that are working as designed, not bugs: slices thinner than 18° drop
  their label rather than pile up unreadably, and `defaultColorForField` can hand two fields the
  same colour (15-entry palette, hashed) — `used` and `free` collide on `mem`. The colour picker
  is the fix.
- Victory Native calls deprecated `SkPath` methods internally, so every chart logs
  `[react-native-skia] SkPath.arcToOval() is deprecated …` once. Ours to ignore until Victory
  moves to `PathBuilder`.

### M4 — Processes widget + parity sweep — `done` (2026-08-03)
- [x] Processes table: default columns, friendly headers, 50-row cap, horizontal + vertical scroll — `src/components/widgets/processes-table.tsx` over pure `src/utils/processTable.ts`
- [x] Per-field formatter UI (`FormatterEditor`) covering every formatter `formatFieldValue` understands
- [x] Selected-field ordering with move up/down, plus colours, merged into one `FieldOptionsSection`
- [x] Formatters apply to every widget kind, not just charts — text bodies, chart labels and table cells
- [x] Processes enabled in the type picker; the "arrives in M4" placeholder and its gating are gone
- [x] Refresh-cadence indicator in the header (the reference app's "5s refresh" badge)
- [x] Parity checklist sweep (REWRITE_PLAN.md §2) — everything still open there is M5/M6 layout work
- [x] 255 tests across 19 suites; typecheck and lint clean
- [x] Verified on the emulator against the live TCloud server: the type picker offers processes,
      the config screen discovers process keys, reorder and the Round formatter drive the live
      preview, and two saved process widgets poll real data — one with default columns
      (Name / CPU % / Mem % / User), one with `name` + `cmdline`
- [ ] **Open:** one Fabric mount crash observed during that run, not reproduced (see below)

**Notes (2026-08-03)**
- **Process payloads are not flat**, and the reference app's `String(proc[field])` showed it:
  `cmdline` is an array (rendered `a,b,c`) and `memory_info` a nested object (rendered
  `[object Object]`). `formatProcessCell` joins arrays with spaces and JSON-encodes objects,
  then applies the field's formatter — so `truncate(40,middle)` on a command line now does
  something useful instead of trimming `[object Object]`.
- **Columns are fixed-width by field**, which is what makes the header line up with the rows
  and the whole table scroll sideways as one piece. Widths live in `processColumnWidth` so
  they stay testable.
- Tamagui's `ScrollView` types reject `contentContainerStyle: { flexGrow: 1 }` — the v5 config
  has no `flexGrow` and no `grow` shorthand. It was not needed: a horizontal ScrollView already
  stretches its child vertically, which is what gives the inner vertical ScrollView its height.
- The formatter editor round-trips through strings rather than storing structured options, so
  `WidgetConfig.fieldFormatters` keeps the reference app's shape and `formatFieldValue` stays
  the single interpreter. `parseFormatterSpec` deliberately matches that function's own
  tolerance — `round ( 1 )` is not a valid spec anywhere in the app, because `formatFieldValue`
  gates on `startsWith('round(')` before its regex runs.
- `FieldColorsSection` became `FieldOptionsSection`: three separate lists of the same fields
  (order, colour, formatter) would have been three places to look. Colours are hidden for
  non-chart kinds, where they mean nothing.
- **One unexplained Fabric mount crash, seen once and not reproduced** — see the open question
  below. Not a reason to hold M4, but it is unresolved, not fixed.

**Emulator note (2026-08-03):** the Pixel_10 AVD died repeatedly on app launch with the
default (host GPU) renderer, taking the adb connection with it. Launching with
`-gpu swiftshader_indirect` is stable. Worth reaching for the moment the emulator starts
disappearing mid-session; `scripts/run-android.ps1` does not set it.

### M5 — Layout, reorder, immersive, tablet — `done` (2026-08-03)
- [x] Responsive columns; S/M/L/XL size presets (landed in M2, revised here — see below)
- [x] Long-press drag reorder over measured card rects, persisted through `reorderWidgets`
- [x] Immersive mode: hides the header and edit chrome, keeps the screen awake, exits on tap,
      Android back, or Esc on web
- [x] `src/state/ui.ts` holds `editMode` and `immersive`, per plan §3
- [x] Tablet pass: the 3-column tier is gone, so the default size tiles instead of stranding
      a third of every row
- [x] 291 tests across 23 suites; typecheck and lint clean
- [x] Verified on the emulator against the live TCloud server: a long-press drag moved a widget
      and the order survived a restart; immersive mode entered, kept polling, and exited by both
      tap and back; landscape now fits two M cards per row

**Notes (2026-08-03)**
- **No sortable library fits this grid.** `react-native-sortables` and
  `react-native-draggable-flatlist` model uniform lists or uniform grids, but the dashboard is a
  wrap flow of cards spanning 1–4 columns. The drag is therefore hand-rolled on
  gesture-handler + Reanimated (both already present, so no new native surface): each cell
  reports its measured rectangle and `src/utils/dragReorder.ts` turns a pointer position into a
  drop index. That logic is pure and unit tested; the gesture itself is driven in tests by
  gesture-handler's own `fireGestureHandler`.
- **The dragged card's origin has to be frozen at drag start.** The grid reflows live underneath
  the finger, so the card's own measured rectangle moves; tracking the pointer from the live
  rectangle makes it oscillate. Freezing the origin and comparing against the other cards' fresh
  rectangles is also self-stabilising — once a swap happens the pointer sits over the dragged
  card's new slot, which resolves to a no-op move.
- **Three columns was the wrong tablet layout.** The presets span 1–4 columns and the default is
  M (span 2), so a 3-column grid fit one card per row and left a third empty with nothing able to
  fill it. `columnsForWidth` now goes 1 → 2 → 4, and a test asserts the count is never odd above
  one.
- **`fireEvent(…, 'layout')` several times in a row wedges the renderer.** Each one opens its own
  act scope and they overlap, which breaks *every later test in the file* with a mystifying
  "unable to find element" on the next render. Await between them. This is the same family of
  trap as the existing note about bare `act`, but it bites on repeated `fireEvent` too.
- **The first ACTIVE event in `fireGestureHandler` triggers `onStart`, not `onUpdate`.** A pan
  needs two ACTIVE entries — one to activate, one to move — or the gesture appears to do nothing.
- Writing a ref during render (to keep gesture callbacks off a stale order) is a lint error under
  `react-hooks/refs`. It was unnecessary: no drag is in flight before `beginDrag` runs, so the
  order on screen is just the `widgets` prop, and closing over it is both correct and simpler.
- `useKeepAwake` holds its lock for as long as it is mounted, so immersive mode gates a tiny
  `KeepScreenAwake` component rather than calling the hook conditionally.
- React Native defines a `window` global that has no DOM listener methods, so the Esc handler
  checks for `window.addEventListener` itself rather than for `window`.

### M6 — Web target — `done` (2026-08-03)
- [x] CanvasKit/Skia web setup is no longer a manual step — `npm run web` and `npm run build:web`
      both copy `canvaskit.wasm` into `public/` first
- [x] Reorder on web: the drag stays, plus explicit ←/→ move buttons in edit mode (`stepOrder`)
- [x] PWA manifest + icons + a deliberately cache-free service worker; Esc exits immersive
      (landed in M5, verified in the browser here)
- [x] Glances CORS requirement documented, and named in the error message a browser cannot explain
- [x] `accessibilityLabel` on a Tamagui `Button` leaked to the DOM — now `aria-label`
- [x] Chart slice labels landed beside the chart on web instead of on their slices — fixed
- [x] 305 tests across 23 suites; typecheck and lint clean
- [x] Verified in the browser against the stub Glances server, on both the dev server and the
      exported `dist/`: add server + connection test, add a donut and a text widget, live polling,
      move buttons reordering and persisting to localStorage, immersive mode entering and leaving
      by Esc, SPA fallback on a deep link, manifest parsed and service worker active
- [x] Verified visually in a real browser: the exported build in the emulator's Chrome draws
      donut, pie, bar and the processes table against a live server, with a tokenised title
- [x] Android re-checked after the changes: charts, labels and live polling unaffected

**Notes (2026-08-03)**
- **`app/+html.tsx` does nothing when `web.output` is `single`.** It is only consulted by the
  rendered output modes. The shell for a single-output export comes from
  `public/index.html` if that file exists (what `npx expo customize index.html` creates) and
  from `@expo/cli`'s template otherwise — see `webTemplate.js`'s `getTemplateIndexHtmlAsync`.
  So the PWA `<head>` lives in real HTML, and `app.json` → `expo.web.themeColor` /
  `.description` / `.lang` are injected into it during export.
- **Never name `%WEB_TITLE%` or `%LANG_ISO_CODE%` twice in that file.** The substitution is
  `String.replace` with a string needle, which replaces the *first* occurrence only. Mentioning
  them in an explanatory comment consumed both, and the real `<title>` shipped as the literal
  placeholder.
- **Tamagui forwards unknown props straight to the DOM element on web**, so
  `accessibilityLabel` reached React as an invalid attribute and logged an error on every
  render. `aria-label` is the spelling both platforms understand (React Native has taken it
  since 0.71).
- **Move buttons, not just a drag, on web** — the plan's sanctioned fallback (§5 Risks), taken
  as an addition rather than a replacement. A mouse has no long press to discover and a keyboard
  has no drag at all; the gesture still works for touch-screen browsers. They are ←/→ rather
  than ↑/↓ because the grid is a left-to-right wrap flow, so "earlier" is the slot to the left
  far more often than the row above.
- **A minimal service worker buys installability and nothing else.** Chrome still gates
  "Install app" on a registered worker with a fetch handler. `public/sw.js` passes every request
  through and caches nothing on purpose: every number on this dashboard comes from a live
  server, so an app-shell cache would only reach "cannot reach the server" faster, at the cost
  of a permanent stale-bundle hazard.
- **A browser will not say why a cross-origin fetch failed** — a blocked origin and an
  unplugged server are both `TypeError: Failed to fetch`. `describeNetworkError` appends the
  CORS possibility on web only, so the Android build's error text is unchanged. The good news
  is that a default `glances -w` sets `cors_origins=*`, so the web build usually needs no
  server-side change at all.
- **Chart slice labels were positioned against the wrong box on web.** React Native makes every
  `View` a containing block, so an absolutely-positioned child resolves against its parent;
  Tamagui emits **no** `position` for a plain `YStack` on web, which leaves it `static` and
  sends the labels off to some ancestor further out — they rendered in a column beside the
  chart instead of on their slices. `position="relative"` on the chart square fixes it, and is
  a no-op on native. Worth suspecting for **any** `position="absolute"` in this codebase.
- **Verifying web needed a visible browser, and the automation pane was not one.** A tab at
  `document.visibilityState === 'hidden'` never fires `requestAnimationFrame`, so Skia's canvas
  stayed at its default 300×150 backing store and painted nothing, real clicks stopped
  hit-testing, and screenshots timed out — while the DOM stayed perfectly inspectable, which
  makes the failure look like an app bug. The way through: serve `dist/` on the host, `adb
  reverse` that port plus the Glances port, and open it in the **emulator's Chrome**, which
  composites for real and screenshots through `adb exec-out screencap`. That is how the label
  bug above was both found and confirmed fixed.

### M7 — Windows desktop — `done` (2026-08-03)
- [x] **Tauri**, not Electron — `src-tauri/`, wrapping the `dist/` web export
- [x] App icon generated from `assets/images/icon.png`; dark 1280×800 window with a floor of
      420×360, centred, `#101113` behind the webview so a cold start does not flash white
- [x] `npm run desktop` (dev server + hot reload) and `npm run build:desktop` (release)
- [x] Reproducible build: `build:desktop` re-runs `build:web` first, so the shipped bundle is
      never a stale `dist/`
- [x] 6.8 MB portable `.exe` + 5 MB per-user NSIS installer, both with the frontend embedded
- [x] Metro no longer crawls Cargo's multi-gigabyte `target/` — `metro.config.js`
- [x] Desktop CORS story documented, including the origin to allow (`http://tauri.localhost`)
- [x] 305 tests across 23 suites; typecheck and lint clean
- [x] Verified in the built app against the stub Glances server on a **LAN address**, driven
      over CDP: add server, connection test ("Connected to TCloud"), add a donut widget with
      live metric and field discovery, a `{{total:round(1)}}` title resolving live, Skia
      drawing a real canvas, immersive mode in and out by Esc, and the whole dashboard
      surviving a process restart. No console errors beyond Victory's known `SkPath`
      deprecation warnings.
- [x] Installer verified by installing it, running the installed copy, and uninstalling —
      clean removal of files, Start Menu entry and registry key
- [x] Android re-verified on the emulator after the `metro.config.js` change: Metro bundled
      3212 modules, the dev build launched with Fabric, and the saved dashboard came back
      against the live TCloud server — donut, text, pie, bar, a Used/Free split donut and four
      process tables, all polling. No JS errors; the only warnings are Victory's `SkPath`
      deprecations. The M4 `SurfaceMountingManager.addViewAt` crash did not recur.

**Notes (2026-08-03)**

- **Tauri needed a toolchain this machine did not have**: Rust (1.97.1, MSVC host) and Visual
  Studio Build Tools with the C++ workload, for the linker and Windows SDK. Both are now
  installed and the install commands are in the README. That cost is once-per-machine; the
  payoff is a 6.8 MB exe against Electron's ~150 MB, on a WebView2 that Windows 11 already
  ships. Electron stayed the sanctioned fallback (plan §4 M7) and was not needed.
- **The desktop target is the web target.** Tauri serves `dist/` unmodified, so
  `Platform.OS === 'web'` inside the window and there is no desktop branch anywhere in `src/`.
  Every M6 fix — the `position: relative` chart square, `aria-label`, the CORS wording in
  `describeNetworkError` — applies here for free. The corollary is that M7 shipped **zero**
  changes to application code.
- **A WebView2 enforces CORS like any browser.** Proved rather than assumed: a stub serving
  `Access-Control-Allow-Origin: *` is readable from the window, and an otherwise identical
  stub without the header fails with `TypeError: Failed to fetch`. So the desktop build has
  the same Glances requirement as the web build, and the origin to allow is
  `http://tauri.localhost`.
- **But desktop escapes the mixed-content rule**, which is the one place it beats a hosted
  PWA: the origin's scheme is `http`, so reading a plain-http Glances on the LAN is allowed.
  Tauri's `useHttpsScheme` would make it `https://tauri.localhost` and break exactly that, so
  it is deliberately left at its default of off.
- **`src-tauri/target/` sits inside the Metro project root.** It is several gigabytes across
  tens of thousands of files and is rewritten on every desktop build, so the project gained
  its first `metro.config.js` purely to add it to `resolver.blockList`.
- **Verification drove the real window over CDP.** Launching with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` exposes the standard
  DevTools protocol, so the app could be clicked, typed into, screenshotted and inspected for
  real. This is the tool M6 wanted and did not have: the automation pane's hidden tab never
  fired `requestAnimationFrame`, whereas a Tauri window is genuinely on screen and Skia paints.
- **`tauri init` is close but not right out of the box.** Its `Cargo.toml` names the crate
  `app`, the config identifier is the placeholder `com.tauri.dev`, `beforeDevCommand` and
  `beforeBuildCommand` assume Vite script names, and `bundle.targets: "all"` would build an
  MSI as well. `tauri icon` additionally writes whole Android and iOS icon trees, which are
  Expo's business here, and a 1.25 MB macOS `.icns`; all three were deleted, and the `.icns`
  dropped from `bundle.icon` with it.
- **`npm run desktop` and the built app do not share a dashboard.** Dev mode's origin is
  `http://localhost:8081` and the release window's is `http://tauri.localhost`, and
  `localStorage` is per-origin — so servers and widgets configured in one are invisible to the
  other. Expected, but surprising the first time a dev window opens to an empty dashboard.
- **The service worker registers on `http://tauri.localhost`** and, since `public/sw.js`
  caches nothing, does nothing. Left alone rather than special-cased: suppressing it would
  need a desktop-only branch in the HTML shell for no behavioural gain.
- The release profile is tuned for size (`lto`, `opt-level = "s"`, `strip`, `panic = "abort"`).
  There is no Rust in the hot path — `main.rs` opens a window — so nothing trades away.
- **A black screen a minute into an Android launch is normal, not a failure.** The first
  bundle after a cold Metro is 3212 modules and took 67 s here, during which logcat shows
  `loadJSBundleFromMetro()` and nothing else. Wait for Metro's `Android Bundled …` line
  before concluding anything from a screenshot.

### M8 — "Telemetry" redesign — `done` (2026-08-03)

Implements the external design handoff (`Glances Telemetry — final delivery`, direction `2a`
dark with `2b` as its light mode). The design was drawn for a desktop window; the adaptations
for phone, tablet, web and the Tauri window are listed under *Adapted from desktop* below.

- [x] Token layer for both modes — `src/theme/telemetry.ts`, pure and unit tested
- [x] **Contrast floor enforced by test**: every text token clears 4.5:1 against every surface
      it lands on, including the gradient ones. It found a real bug on the first run.
- [x] Space Grotesk + JetBrains Mono bundled (`@expo-google-fonts/*` + `expo-font`); `$mono`
      is a first-class Tamagui family and every numeral uses it with tabular figures
- [x] Two font-size channels — `src/utils/typeScale.ts`, with the design's floors
- [x] Degrade ladders (header, chart, stat cluster, meters, ring, table columns, row count),
      all pure functions driven by each widget's measured box
- [x] Telemetry primitives — `src/components/telemetry/`: endpoint chip (+ dot rung), accent
      tick, state chip, meters, hero/stat/gauge display numerals, logo mark, toolbar buttons
- [x] Toolbar with the endpoint roster, and the six-cell summary strip fed from live payloads
- [x] Widget shell rebuilt to the handoff's anatomy; the edit-mode button row is replaced by
      the ⋮ menu on every platform
- [x] Per-endpoint accent colours, persisted on `GlancesServer` with a v1 → v2 migration
- [x] Two new widget kinds — `gauge` (ring) and `line` (time series over an in-memory sample
      buffer) — plus the process table's TREND sparkline
- [x] Processes table rebuilt: columns drop by priority instead of scrolling horizontally,
      rows are sorted descending and never half-cut, CPU gets an inline bar
- [x] Persisted preferences: theme (dark/light/system), reading scale, summary-strip visibility
- [x] 454 tests across 30 suites; typecheck and lint clean
- [x] Settings, widget picker, widget config and the server form restyled to the tokens —
      near-black surfaces, hairline-bordered cards, uppercase tracked labels, lime filled
      primary action, outlined secondary
- [x] Verified in the browser against the stub server: the whole board renders with live data —
      toolbar roster, summary strip, hero numerals, meters, ring gauge, time series, process
      table with priority columns — in both dark and light, with no console errors
- [x] **Verified on the Android emulator** after rebuilding the dev APK for the two new native
      modules: the toolbar, summary strip and widget shells render against the live TCloud
      server; Skia draws the ring gauge for real (bezel, track, lime arc from twelve o'clock,
      centre value); the widget picker offers all seven kinds; the settings screen's appearance
      controls work; and **light mode `2b` renders correctly end to end**, down to the darkened
      lime fill and the bone-white diamond in the logo tile.

**Adapted from desktop**
- **Toolbar splits into two rows below ~760pt**, so a phone with several endpoints does not
  crush the action buttons. The roster scrolls horizontally rather than wrapping.
- **No window controls.** `⤢ — ▢ ✕` belong to a frameless desktop window; Android has none and
  the Tauri build keeps its native title bar.
- **The separate ENDPOINTS button is folded into the gear**, because this app has one settings
  screen that already contains the endpoint list.
- **The summary strip wraps into a grid** (three columns on a phone, six when there is room)
  instead of six equal columns, which are unreadable at phone widths.
- **Hover becomes press and edit mode.** Touch has no hover, so the design's one-step border
  lift is used for the edit-mode state and `pressStyle` opacity elsewhere.
- **The ⋮ menu is a bottom sheet**, not a popover — that is where a thumb already is.
- Controls keep a 34pt minimum height even where the design's padding implies less.

**Notes (2026-08-03)**
- **The design assumes fixed widget types; this app does not have any.** The handoff is written
  against CPU / MEMORY / GPU / NETWORK / PROCESSES widgets, whereas here a widget is built over
  *any* Glances plugin and *any* fields. Rather than lose that, the archetypes are reached by
  **inference** (`src/utils/widgetPresentation.ts`): a field that reads like a percentage gets a
  meter, a lone numeric field becomes the hero, everything else is a key/value row. Two
  archetypes had no generic equivalent at all and became new kinds: `gauge` and `line`.
- **`looksLikePercent` needs the name *and* the range to agree.** `cpu.total` is a percentage;
  `mem.total` is 132 GB and would have been drawn as a full meter the moment it dipped under
  100. The name list also carries the cpu plugin's unlabelled percentages (`user`, `system`,
  `idle`, …) and the gpu plugin's `proc`/`fan`.
- **Unformatted numbers are now capped to 2 decimals** (`formatLooseNumber`), a deliberate
  deviation from the reference app's `String(value)`. Glances serves full float precision, and
  `85.40915631665675` beside a 5pt meter or in a tabular column is not a readout. It is a *cap*
  and not a pad — `12.5` stays `12.5` — and an explicit field formatter always wins.
- **The processes table no longer scrolls horizontally.** The handoff forbids it, so columns
  leave by priority (PID, command and CPU always survive) and the row count follows the
  available height. That also retires the nested-`ScrollView` construct the one unexplained M4
  Fabric mount crash pointed at.
- **Sample history is memory-only**, per the handoff and the reference app. `pushSample` ignores
  anything not newer than the last sample, which is what lets several widgets bound to the same
  server and endpoint all report the same poll (they pass the query's `dataUpdatedAt`) without
  duplicating it. Per-process trend buffers are pruned to the visible rows, or the store would
  grow a series for every PID the machine has ever run.
- **Time windows are measured back from the newest sample, not `Date.now()`.** That started as a
  lint fix — `react-hooks/purity` rightly refuses `Date.now()` during render — and turned out to
  be more correct: if polling stalled two minutes ago, a 5-minute window should still show the
  last five minutes of *data* rather than three minutes of data and a gap.
- **`react-hooks/immutability` forbids splitting two animations across two effects** when both
  write the same shared values: one effect then modifies a value the other depends on. The
  chart's draw-in and the marker's breathe live in one effect for that reason.
- **Tamagui v5 has `shrink`/`grow` shorthands** even though it has no `flexShrink`/`flexGrow`
  prop — the M4 note about "no `grow` shorthand" was about a plain style object passed to
  `contentContainerStyle`, which is a different type.
- **`role` is not available as a component prop name.** Tamagui's `Text` already takes `role`
  (the ARIA one), so the type-scale role prop on the text primitives is called `variant`.
- **The web shell's hard-coded background has to follow the theme.** `public/index.html` paints
  near-black so a cold start does not flash white; without repainting it from the resolved
  theme, a light-mode board sits inside a dark frame wherever the page overscrolls.
- **Surfaces the design specifies as gradients are drawn with `expo-linear-gradient`** rather
  than flattened to a mid-tone. It runs in Expo Go, so it costs nothing in native surface, and
  it is also what draws the CPU meter's `#5e8a2e → #b6f24a` fill.
- Charts still go only through `ChartView`; the two new canvases sit beside the existing ones
  and the web build lazy-loads them behind the same CanvasKit gate. `ChartView` gained an
  `explicitSize` prop so the widget shell's own measurement is reused — one fewer layout pass,
  and deterministic geometry in tests, where no layout event ever fires.

### M9 — Hardening & release — `in progress`
- [ ] Component tests: settings + config screens, error paths
- [ ] Perf pass (memoization, background polling pause, processlist cost)
- [x] Release pipeline — `.github/workflows/release.yml` + `scripts/sync-version.js`
- [x] Fix: v0.1.1 desktop rendered a blank window (`GradientSurface` covered it)
- [ ] README for all targets

**v0.1.1 shipped a blank desktop window (found and fixed 2026-08-04)**
- **Symptom.** The installed Windows app opened to an empty dark rectangle with a single
  ~5px dot in the top-left corner. No console errors, no failed requests.
- **Cause.** `GradientSurface` (`components/telemetry/surfaces.tsx`) hit *both* halves of the
  Tamagui-on-web positioning trap at once. Its wrapper `YStack` had no `position="relative"`,
  so the `StyleSheet.absoluteFill` gradient escaped to the nearest positioned ancestor and
  sized itself to the whole window; and because CSS paints positioned boxes after in-flow
  ones, it then painted *over* everything. The toolbar's `#0d1011 → #0a0c0d` gradient was
  covering the entire app. The dot was the logo's inner square — it carries `rotate="45deg"`,
  which promotes it to its own compositor layer, so it alone composited above the gradient.
- **Why nothing caught it.** Native is immune to both halves (every view is a containing
  block; tree order alone keeps an earlier child behind), so Android looked perfect, and the
  desktop target runs the *web* bundle. The Jest suite renders through the native preset, so
  all 472 tests passed against a build that rendered nothing at all.
- **Fix.** `position="relative"` plus `style={{ zIndex: 0 }}` on the wrapper (containing block
  *and* stacking context — without the latter, `-1` sends the layer behind an ancestor's
  background instead), and `zIndex: -1` on the gradient. Both are inert on native.
  `surfaces.test.tsx` now asserts all three.
- **Technique worth reusing.** The app was fully laid out, themed and clickable underneath the
  whole time — `elementFromPoint` returned the real controls, because the gradient is
  `pointerEvents="none"`. A blank window whose DOM is correct is an occlusion bug, not a crash.
  Injecting `#root, #root * { will-change: transform }` over CDP promotes everything to its own
  layer; if the UI appears, something is painting on top of it. Driving the Tauri window over
  CDP (per the AGENTS.md note) is what made all of this observable.
- **Audited the rest:** the four `position="absolute"` uses in `charts/chart-view.tsx` all sit
  inside an explicit `position="relative"` parent, and `meter.tsx`'s gradient is in-flow
  (`flex: 1`). `GradientSurface` was the only instance.

**Notes (2026-08-04)**
- The release trigger is the **`package.json` version field**, not a tag or a manual dispatch:
  `npm run release:patch` bumps it with `--no-git-tag-version`, and the workflow tags only
  after every build has passed. Local and remote tags therefore cannot disagree, and a broken
  desktop build leaves no tag and no half-empty release rather than something to clean up.
- Three files carry a version (`package.json`, `app.json`, `src-tauri/tauri.conf.json`), so
  `scripts/sync-version.js` runs from `npm version`'s lifecycle hook and CI re-checks it with
  `--check`. It edits the JSON by targeted string replacement rather than round-tripping it,
  which keeps the files' hand-written formatting. Android's `versionCode` is derived —
  `major*10000 + minor*100 + patch` — because Android refuses to install over an equal or
  higher code and a hand-maintained counter would drift.
- **The APK is debug-signed** (chosen with the owner). Expo's generated `release` buildType
  already points at the template's debug keystore, so CI needs no secrets and the signature is
  stable enough that upgrades install over each other. Not a distribution signature; the README
  records what moving to a real keystore would take.
- CI installs **NDK 27.1.12297006** explicitly: `expo-modules-autolinking`'s
  `ExpoRootProjectPlugin` pins that exact version and Gradle will not substitute the runner
  image's patch release. Java is pinned to **17** for the same reason the local build is.
- `npm install`, not `npm ci`, everywhere in CI — the lockfile is generated on Windows and
  omits the Linux-only optional native builds that `npm ci`'s strict sync check then rejects.

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-08-01 | Expo, Android+tablet+web+Windows-desktop, Tamagui, Victory Native XL, multi-server per widget, reorderable grid with size presets, Tauri/Electron for desktop, no migration, logic+component tests | Confirmed with owner during planning (see REWRITE_PLAN.md §1) |
| 2026-08-01 | Routes under `src/app` are thin re-exports; screen components live in `src/screens` | Expo Router turns any file in the app directory into a route, so colocated `*.test.tsx` would become routes |
| 2026-08-01 | Test helper `renderWithProviders` is async | RNTL 14 changed `render` to return a Promise; the global `screen` stays empty unless it is awaited |
| 2026-08-01 | Style props use Tamagui v5 shorthands (`p`, `px`, `text`, `items`, `justify`) | The v5 config drops the React Native long names `padding` and `textAlign`; the shorthands are what typecheck accepts |
| 2026-08-02 | Local Android runs use a **dev build** (`expo run:android`), not Expo Go | The emulator's NAT cannot deliver an 11 MB bundle; a dev build pulls it over adb instead. Expo Go compatibility is now a library-selection guideline rather than a runtime requirement. |
| 2026-08-03 | Prefer the **google_apis** AVD (`Pixel_10`) over the Play Store one | Only google_apis images allow `adb root`, which is required to repair the emulator's networking so the app can reach a Glances server |
| 2026-08-03 | Web output is `single` (SPA), not `static` | Static rendering runs the app in Node during export, where AsyncStorage touches `localStorage` and crashes the build; a live dashboard gains nothing from prerendering |
| 2026-08-03 | `shorten` formatter fixed instead of ported verbatim | The reference rendered negatives as `--1.5k`; a visibly wrong output is not behaviour worth preserving |
| 2026-08-03 | Servers carry their own `refreshMs`; widgets store only `serverId` | Multi-server-per-widget means polling cadence belongs to the server, and keeps widget config free of duplicated connection details |
| 2026-08-03 | Query key is `[serverId, url, endpointPath]` | Without the url, editing a server's address kept serving the previous address's cached result until the next poll |
| 2026-08-03 | Widget type picker lives at `/widget/pick`, not `/widget/new` | A static `/widget/new` route takes precedence over `/widget/[id]` with `id: 'new'`, so the picker navigated to itself |
| 2026-08-03 | `coerceServerUrl` only defaults the port when the scheme was inferred | A typed-out `https://glances.example.com` is served on 443 behind a reverse proxy; appending `:61208` broke it. A bare host still gets `http://…:61208`. |
| 2026-08-03 | Chart labels are React Native text overlaid on the Skia canvas, not Skia text | RN text cannot live inside a Skia canvas and Victory's `Pie.Label` needs a bundled `SkFont`; overlaying keeps labels themeable, testable and font-asset-free on every platform |
| 2026-08-03 | Web loads CanvasKit *before* importing the canvases (`canvases.web.ts` + `Suspense`) | Skia binds `global.CanvasKit` at module-eval time, so any render-time gate is too late and the first draw takes the whole web app down |
| 2026-08-03 | Jest boots real CanvasKit via a custom `testEnvironment` | Skia's jest mock needs `global.CanvasKit`, which loads asynchronously; with it the chart tests run Victory's real path maths instead of a stub |
| 2026-08-03 | Colour picker and chart options are offered for pie and bar, not just donut | The reference only exposed them for donuts even though its own `ChartView` honoured them for every chart kind — an oversight, not a design |
| 2026-08-03 | Slice labels are dropped below an 18° sweep | On a phone-sized donut, labels for sub-5% slices overlap into an unreadable pile |
| 2026-08-03 | Process cells join arrays and JSON-encode objects before formatting | The reference rendered `cmdline` as `a,b,c` and `memory_info` as `[object Object]`; both are readable this way and can then be truncated |
| 2026-08-03 | Field order, colour and formatter live in one `FieldOptionsSection` | They all key off the same selected-field list; three parallel lists would be three places to look for one field's settings |
| 2026-08-03 | Formatters are offered for every widget kind, colours only for charts | `getTextBody` and the process table already honoured `fieldFormatters`; only colour is chart-specific |
| 2026-08-03 | Formatter state is stored as the spec string, not structured options | Keeps `WidgetConfig` identical to the reference and leaves `formatFieldValue` the single interpreter of a spec |
| 2026-08-03 | Drag reorder is hand-rolled on gesture-handler + Reanimated, not a sortable library | The grid is a wrap flow of 1–4 column cards; the available libraries model uniform lists or grids, and adding one would cost a native dep for a worse fit |
| 2026-08-03 | The drop target comes from measured card rectangles, not row/column arithmetic | Variable spans mean there is no regular grid to compute against, and rectangles keep the decision pure and testable |
| 2026-08-03 | `columnsForWidth` skips 3 columns (1 → 2 → 4) | With the default M size spanning 2, a 3-column grid strands a third of every row and nothing can fill it |
| 2026-08-03 | `editMode`/`immersive` live in a non-persisted `ui` store | Restoring into immersive mode with no visible way out, or into edit mode with remove buttons everywhere, are both bad surprises |
| 2026-08-03 | Entering immersive mode also leaves edit mode | Editing chrome has no place in a display-only view, and hiding a still-active edit state would be worse than clearing it |
| 2026-08-03 | Web keeps the drag **and** gains ←/→ move buttons | A mouse has no long press to discover and a keyboard has no drag; the gesture still serves touch-screen browsers, so this is an addition rather than the plan's either/or fallback |
| 2026-08-03 | The web `<head>` lives in `public/index.html`, not `app/+html.tsx` | `+html.tsx` is only consulted by the rendered output modes; a `single` export takes its shell from `public/index.html` when present |
| 2026-08-03 | `public/sw.js` registers a service worker that caches nothing | Chrome gates "Install app" on a worker with a fetch handler, but a dashboard of live values gains nothing from an offline cache and would inherit stale-bundle bugs |
| 2026-08-03 | Accessibility labels are written `aria-label` | Tamagui forwards unknown props to the DOM on web, so `accessibilityLabel` is an invalid attribute there; `aria-label` works on both platforms |
| 2026-08-03 | `setup:skia-web` runs from `web` and `build:web` | A fresh clone that forgot the manual step got a web build whose charts silently did not draw |
| 2026-08-03 | The chart square carries an explicit `position="relative"` | Tamagui emits no `position` on web, so the absolutely-positioned slice labels escaped the chart box; native was unaffected because every RN `View` is already a containing block |
| 2026-08-03 | Desktop is **Tauri**, not Electron | A 6.8 MB exe on the WebView2 Windows already ships, against ~150 MB of bundled Chromium. The cost — Rust plus MSVC build tools — is once per build machine, and nothing about the app fought it |
| 2026-08-03 | The desktop build ships `dist/` unmodified; no Rust-side application code | Keeping the wrapper empty means desktop inherits every web fix automatically and there is no second implementation to keep in step |
| 2026-08-03 | Fetches stay plain `fetch`; the Rust HTTP client (plan §5) is not used | A default `glances -w` already allows every origin, so routing requests through Rust would buy nothing for the normal case and cost a desktop-only branch in the data layer |
| 2026-08-03 | `useHttpsScheme` stays off, so the origin is `http://tauri.localhost` | An https origin would make every plain-http Glances on the LAN a mixed-content error — the exact problem a hosted PWA has and desktop otherwise avoids |
| 2026-08-03 | NSIS only (no MSI), installing per user | One installer is enough, NSIS needs no WiX, and a personal dashboard should not demand administrator rights to install |
| 2026-08-03 | The project gained a `metro.config.js` to block `src-tauri/target/` | Cargo's build directory is gigabytes inside the Metro root; without this Metro crawls and watches all of it on every start |
| 2026-08-03 | The Telemetry design's fixed widget types are reached by **inference** over the generic widget model, not by replacing it | The app builds widgets over any plugin and any fields; hard-coding CPU/MEMORY/GPU widgets would have been a capability regression, and the archetypes are recoverable from the data |
| 2026-08-03 | Two new widget kinds — `gauge` and `line` | The ring gauge and the time series are the only archetypes in the handoff with no generic equivalent at all |
| 2026-08-03 | The 4.5:1 contrast floor is a **unit test**, not a review step | The handoff makes it a hard requirement; asserting it caught a failing light-mode button fill on the first run |
| 2026-08-03 | `accentIndex` lives on the server, not the widget | The endpoint chip and accent tick answer "which machine", so the colour has to be stable per machine across restarts and reorders |
| 2026-08-03 | Degrade ladders key off each widget's **measured** box, never the window | The web original used container queries; measuring is the RN equivalent and keeps two differently-sized cards on one screen independent |
| 2026-08-03 | The user's font-size setting reaches the reading channel only | A 46pt hero multiplied to ~90pt inside a 450pt card is what the handoff says broke the first implementation |
| 2026-08-03 | Preferences (theme, reading scale, summary strip) are persisted; `editMode`/`immersive` stay transient | A theme the user chose should survive a restart; a mode they were in should not |
| 2026-08-03 | The edit-mode button row is replaced by the ⋮ menu on **every** platform | The header now carries identity only, which is what makes a dense board readable — and it retires the web-only move buttons in favour of one interaction everywhere |
| 2026-08-03 | The processes table drops columns by priority instead of scrolling horizontally | The handoff forbids horizontal scroll, and it removes the nested-ScrollView the M4 mount crash pointed at |
| 2026-08-03 | Unformatted numbers are capped to 2 decimals (`formatLooseNumber`) | Glances serves full float precision; `85.40915631665675` in a tabular column or beside a 5pt meter is not a readout. A cap, not a pad — and a field formatter still wins |
| 2026-08-03 | Sample history is in-memory and time windows measure back from the newest sample | Matches the handoff and the reference app; measuring from the data rather than the clock is also pure, and shows the last window of data when polling stalls |
| 2026-08-03 | `expo-linear-gradient` added for the surfaces and meter fills the design specifies as gradients | It runs in Expo Go, so it costs nothing in native surface, and flattening the CPU meter's `#5e8a2e → #b6f24a` would lose a visibly meaningful gradient |
| 2026-08-03 | Chart segments take a Telemetry palette, assigned by position, with the remainder of a used/free pair on the track colour | The ported Mantine primaries read as noise on a near-black instrument surface; hashing also gave collisions (the M3 notes recorded used/free colliding on mem) |
| 2026-08-04 | Releases are triggered by the `package.json` version field; CI creates the tag, not the developer | A tag pushed only after all three builds pass cannot describe a release that does not exist, and there is no local tag to diverge from the remote |
| 2026-08-04 | The Android APK is debug-signed in CI | Confirmed with the owner: the artifact is for sideloading, and the template keystore keeps CI secret-free while staying stable enough for in-place upgrades |
| 2026-08-03 | Space Grotesk and JetBrains Mono are bundled, not fetched | The app ships as a desktop and offline-capable web build; a dashboard that must reach Google Fonts before it can render a number is not one |
| 2026-08-04 | A milestone is not done until the **web build** has been looked at, not only Android | v0.1.1 shipped a desktop window that rendered nothing. The bug was web-only in both of its halves, Android was flawless, and the native-preset Jest suite passed 472/472 against it |

## Blockers / open questions

- Expo Go does not work on the local emulator (details below). The dev build does, so this
  does not block development. Untested on a physical device.
- **Fabric mount crash seen once during M4 verification, cause unknown (2026-08-03).**
  Saving a process widget and returning to the dashboard threw
  `addViewAt: failed to insert view [3716] into parent [4564] at index 0 — The specified
  child already has a parent`, from `SurfaceMountingManager.addViewAt`, at the moment two
  `ProcessesTable`s mounted into the grid. It did **not** reproduce: a cold start renders
  both tables fine, and three further add-and-save cycles produced no new occurrence
  (the log still holds exactly one incident).
  The one unusual construct in that subtree is `ProcessesTable`'s vertical `ScrollView`
  nested inside a horizontal one — which the §2 requirement for horizontal + vertical
  scrolling makes hard to avoid, and which is the standard RN table pattern.
  `nestedScrollEnabled` is now set on the inner one, but that addresses gesture ownership,
  **not** this error, so it should not be read as a fix. If it resurfaces, suspect the
  nesting first and consider a flat single-axis table with column widths that fit the card.

## Android emulator networking

**Root cause.** The API 36 emulator images bring up both `eth0` (10.0.2.15) and `wlan0`
(10.0.2.16) on `10.0.2.0/24` **with no default route**. Android prefers `wlan0`, whose
network has no host alias, so nothing on the device can reach the host: not `10.0.2.2`, not
the LAN IP, and DNS fails outright (`Unable to resolve host "localhost"`). Check with
`adb shell ip route` — no `default via ...` line means you are hitting this.

Our code was never involved: a bare `<View><Text>` screen with no providers failed identically.

**Fixes (automated in `scripts/run-android.ps1`, run via `npm run android:emulator`):**
1. `adb root` + `svc wifi disable` — drops the phantom `wlan0` so `eth0` becomes the default
   network and gains `default via 10.0.2.2`. **Needed for the app to reach a Glances server
   at all**, not just Metro. Requires a `google_apis` image (`Pixel_10`); `google_apis_playstore`
   images (`Pixel_7`) refuse `adb root`.
2. `adb reverse tcp:8081 tcp:8081` + `debug_http_host=127.0.0.1:8081` in the app's shared
   preferences — reaches Metro over adb instead of the emulator's NAT.
3. Build `x86_64` only and with **JDK 17**.

**Two build traps**
- Android Studio ships **JDK 25**, and AGP's CMake step fails on it with "a restricted method
  in `java.lang.System` has been called". Gradle provisions a JDK 17 under `~/.gradle/jdks`;
  the script auto-detects it.
- Building all four ABIs takes ~3x longer and arm64 fails first. Use
  `-PreactNativeArchitectures=x86_64`.

**Expo Go remains unusable on this emulator** (2026-08-03). After the routing fix the device
genuinely reaches Metro — Chrome on the emulator loads `packager-status:running`, and Expo Go
gets far enough to trigger a full 2469-module build. But the ~11 MB bundle transfer then
stalls over the emulator's NAT and never completes; earlier it surfaced as
`java.io.IOException: Failed to download remote update`. Tried: `10.0.2.2`, the LAN IP,
`127.0.0.1` over `adb reverse`, cleared app data, and MTU lowered to 1400. The dev build is
immune because it pulls the bundle through adb. Expo Go on a **physical device over Wi-Fi**
is untested and would likely work, since the fault is the emulator's NAT.

**Also worth knowing:** `expo start --localhost` binds Metro to `::1` (IPv6 loopback) only,
which `adb reverse` (IPv4) cannot reach. Leave Metro on its default dual-stack `::` bind.
