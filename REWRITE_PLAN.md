# Glances Dashboard — React Native Rewrite Plan

Rewrite of [drumslave-git/glances-dashboard](https://github.com/drumslave-git/glances-dashboard)
(local copy: `E:\projects\glances-dashboard`) from a Vite + React + Mantine web app into a
cross-platform React Native app.

## 1. Goals & decisions (confirmed with the owner)

| Decision | Choice |
|---|---|
| Toolchain | **Expo** (managed workflow, Expo Go-compatible library choices) |
| Platforms | **Android phone, tablet/large screen, Web (Expo Web), Windows desktop** (Tauri/Electron wrapper around the web build). iOS is *not* a release target but must not be deliberately broken — Expo keeps it nearly free. |
| Dashboard layout | **Reorderable list/grid**: 1–2 columns on phone, more on tablet; long-press drag to reorder; widget **size presets** (S/M/L/XL) instead of free-form drag-resize |
| Scope | **Full feature parity** with the web app (delivered in milestones, parity is the finish line) |
| UI library | **Tamagui** |
| Charts | **Victory Native XL** (Skia-based) |
| Servers | **Multi-server, per widget** — a managed list of Glances servers; each widget binds to one |
| Desktop delivery | **Tauri (preferred) or Electron wrapper** of the web build, as a late milestone |
| Migration from web app | **None** — dashboards are rebuilt by hand |
| Testing | **Jest unit tests for logic + React Native Testing Library component tests** |

## 2. What the source app does (parity checklist)

Everything below must exist in the rewrite for parity. Items marked *(adapted)* change shape
for mobile but keep the capability. Checkboxes were swept at the end of M4 (2026-08-03);
everything still open is layout work scheduled for M5–M6.

### Settings & servers
- [x] Glances server configuration: URL + refresh interval (ms). *(adapted: becomes a **server list** — `{ id, name, url, refreshMs }` — with add/edit/delete and a default server)*
- [x] Settings persisted locally (web: localStorage → RN: AsyncStorage via persisted store)
- [x] "Set Glances URL in settings to load data" empty-state hint *(adapted: "No servers configured" plus a button into Settings)*

### Data layer (Glances REST API v4)
- [x] Generic polling of `GET {base}/api/4/{plugin}` with configurable interval, loading/error state, URL normalization
- [x] `/api/4/pluginslist` → available metric options (fallback list: `cpu, mem, load, fs, gpu`)
- [x] `/api/4/system` polled every 10 s → hostname + `linux_distro` shown in the header
- [x] Widgets sharing the same server+endpoint must not duplicate requests *(improvement over source, required once N widgets × M servers exist)*

### Widget kinds
- [x] **text** — payload rendered as `field = value` lines (selected fields) or pretty-printed JSON (no fields selected)
- [x] **donut** — segments per numeric field; options: size, thickness, paddingAngle, withLabels; center label
- [x] **pie** — segments per numeric field, with/without labels
- [x] **bar** — one bar group, one bar per numeric field
- [x] **processes** — table over `/api/4/processlist`; default columns `name, cpu_percent, memory_percent, username`; friendly header labels (`cpu_percent` → "CPU %", etc.); capped at 50 rows; scrollable

### Widget configuration
- [x] Add-widget flow: pick widget type → configure *(adapted: modals become screens/sheets)*
- [x] Metric select (from pluginslist; `processlist` excluded for non-process widgets, forced for process widgets)
- [x] Title with live tokens: `{{field}}` and `{{field:formatter}}` (e.g. `VRAM {{mem:round(2)}}%`)
- [x] Field multi-select, populated from a **live fetch** of the chosen endpoint's payload keys
- [x] Per-field color overrides (missing fields get a deterministic default color — port `chartColors.ts`)
- [x] Per-field formatters: `round(n)`, `bytes`, `kb`, `mb`, `gb`, `shorten`, `truncate(len, start|middle|end)`
- [x] Donut chart options section (size/thickness/paddingAngle/withLabels)
- [x] Chart center label with token support
- [x] "Split percentage into Used/Free" toggle (single 0–100 field → Used + Free segments)
- [x] Live preview of the widget inside the config UI
- [x] Per-widget **server select** *(new — multi-server feature)*
- [x] Legacy `dataKey` handling can be dropped (no migration), but keep the `fields` semantics
- [x] Selected-field display order, changed with move up/down *(reference: `FieldsSection`)*

### Dashboard & modes
- [x] Edit mode toggle: shows Add widget, per-widget configure/remove, and enables reordering
- [ ] Reorderable widget list/grid with size presets *(adapted from 12-col drag/resize grid)* — size presets done, drag reorder is **M5**
- [ ] Responsive columns: 1–2 on phone, 3–4 on tablet/web by window width — **M5**
- [ ] Immersive mode: hide header/chrome *(adapted: exit via tap or back gesture instead of Esc; on web, Esc still works)* — **M5**
- [x] Header: hostname, distro, server info, refresh indicator, edit toggle, settings *(immersive button lands with immersive mode in M5)*
- [x] Per-widget loading / error / no-server states

## 3. Architecture

### Stack
- **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6 strict) + **expo-router** (typed routes + React Compiler enabled)
- **Tamagui** — UI components + theming (dark theme default, matching the source's look)
- **Victory Native XL** + `@shopify/react-native-skia` + `react-native-reanimated` + `react-native-gesture-handler` — charts
- **Zustand** with `persist` middleware over **AsyncStorage** — settings, servers, widgets (Expo Go-compatible; MMKV deliberately avoided)
- **TanStack Query** — polling data layer; query key `[serverId, endpointPath]` gives automatic request de-duplication across widgets and per-query `refetchInterval`
- **react-native-sortables** (or `react-native-draggable-flatlist` if grid support disappoints) — long-press reorder
- **Jest (`jest-expo`) + React Native Testing Library** — tests

### Data model (new types, evolved from `src/types/dashboard.ts`)
```ts
interface GlancesServer {
  id: string
  name: string
  url: string        // e.g. http://192.168.1.10:61208
  refreshMs: number  // default 5000
}

type WidgetKind = 'text' | 'donut' | 'pie' | 'bar' | 'processes'
type WidgetSize = 'S' | 'M' | 'L' | 'XL'   // replaces free-form {x,y,w,h}

interface WidgetConfig {
  id: string
  serverId: string            // NEW: multi-server per widget
  title: string
  kind: WidgetKind
  metric: string
  endpointPath: string        // "/api/4/{metric}"
  fields?: string[]
  fieldColors?: Record<string, string>
  fieldFormatters?: Record<string, string>
  donutChartOptions?: { size?: number; thickness?: number; paddingAngle?: number; withLabels?: boolean }
  chartLabel?: string
  splitPercentageIntoUsedFree?: boolean
  size: WidgetSize            // replaces layout {i,x,y,w,h}
  order: number               // position in the reorderable grid
}
```

### Project structure
Routes live under `src/app` (the Expo SDK 57 default-template convention), and `@/*` is a
TypeScript path alias for `src/*`.
```
src/
  app/                        # expo-router routes
    _layout.tsx               # providers: Tamagui, QueryClient, gesture root, safe area
    index.tsx                 # dashboard screen
    settings/index.tsx        # server list + app settings
    settings/server/[id].tsx  # add/edit server
    widget/new.tsx            # widget type picker
    widget/[id].tsx           # widget config (create/edit)
  api/                        # glances client: url normalization, typed endpoints
  state/                      # zustand stores: servers, widgets, ui (editMode, immersive)
  hooks/                      # useGlancesQuery(serverId, path, refreshMs), useResponsiveColumns
  components/
    dashboard/                # DashboardHeader, WidgetGrid, WidgetCard
    widgets/                  # TextWidget, ChartWidget, ProcessesTable
    charts/                   # ChartView abstraction over Victory Native XL
    config/                   # FieldsSection, DonutOptionsSection, ServerSelect, LivePreview
  screens/                    # screen components (routes above are thin re-exports of these)
  utils/                      # ported nearly verbatim: widgetData.ts, chartColors.ts, widgetFactory.ts
  types/
  theme/                      # tamagui.config.ts
  test-utils/                 # renderWithProviders
  __fixtures__/               # captured Glances payloads for tests
```
Tests are colocated as `*.test.ts(x)` next to the code they cover — except for screens, which
must not live under `src/app` because Expo Router would publish the test file as a route.

### Porting notes
- `src/utils/widgetData.ts` (formatters, token resolution, chart segment building) and
  `src/utils/chartColors.ts` are **pure TypeScript — port verbatim** and cover with unit tests first.
  They are the highest-value, lowest-risk carryover.
- `useGlancesEndpoint` is replaced by TanStack Query; keep the same URL normalization rules
  (strip trailing `/`, ensure leading `/` on path).
- `ChartView` must stay an **abstraction boundary**: props in → chart out, no Victory types leaking
  upward. This is the web-fallback insurance (see Risks).

## 4. Milestones

Each milestone ends with: tests green, `npm run typecheck` + `lint` clean, verified on Android
(Expo Go or emulator) and — from M6 — web. Update `REWRITE_PROGRESS.md` as tasks complete.

### M0 — Scaffold
- `git init`, `.gitignore`, initial commit of the plan docs
- `create-expo-app` (TypeScript template), expo-router, strict tsconfig, ESLint
- Tamagui installed and configured (dark theme default); Victory Native XL + Skia + Reanimated + gesture-handler installed
- Jest + jest-expo + RNTL wired up with one smoke test
- App boots in Expo Go (Android) and `npx expo start --web`

### M1 — Domain, storage, data layer
- Types (`GlancesServer`, `WidgetConfig`), Zustand stores with AsyncStorage persistence
- Port `widgetData.ts` + `chartColors.ts` + `widgetFactory.ts` **with full unit tests** (formatters, tokens, segments, used/free split)
- Glances API client + `useGlancesQuery` polling hook (TanStack Query), pluginslist + system endpoints
- Settings screens: server list CRUD, per-server refresh interval, connection test button

### M2 — Dashboard shell + text widget
- Dashboard screen: header (hostname/distro of default server, edit toggle, settings/immersive buttons), empty state
- Widget card frame (title with resolved tokens, edit-mode configure/remove buttons, loading/error states)
- Add-widget flow: type picker screen → config screen
- Config screen v1: server select, metric select, title input, field multi-select from live payload, live preview
- **Text widget** fully working end-to-end

### M3 — Chart widgets
- `ChartView` over Victory Native XL: donut (size/thickness/paddingAngle/labels/center label), pie, bar
- Per-field colors + color picker in config; formatters as segment display labels
- Used/Free split; chart label tokens
- Component tests for each chart kind (render with fixture payloads)

### M4 — Processes widget + parity sweep
- Processes table (default columns, header labels, 50-row cap, horizontal + vertical scroll)
- Field formatters UI (per-field formatter input with validation hint)
- Walk the §2 checklist; fix every unchecked parity item that isn't layout-related

### M5 — Layout, reorder, immersive, tablet
- Responsive column count (`useWindowDimensions`); size presets S/M/L/XL mapped to spans/heights
- Long-press drag reorder (edit mode only), persisted `order`
- Immersive mode (hide header, keep-awake via `expo-keep-awake`, tap/back to exit)
- Tablet pass: 3–4 columns, larger touch targets verified

### M6 — Web target
- Expo Web build: Skia/CanvasKit wasm setup for charts, verify Tamagui web output
- Reorder fallback for web if the drag library misbehaves (move up/down buttons is acceptable)
- PWA manifest + icons; Esc exits immersive mode
- Document the Glances **CORS requirement** for browser use (native apps are unaffected)

### M7 — Windows desktop
- Wrap the static web build in **Tauri** (fallback: Electron if Tauri fights the router/wasm)
- App icon, window sizing, `.exe`/installer build documented and reproducible

### M8 — Hardening & release
- Component-test coverage for settings + config screens; error-path tests (server down, bad URL, empty payload)
- Perf pass: memoized widget cards, throttled re-renders at fast refresh intervals, processlist payload cost
- EAS build profile for Android APK; README with setup/build instructions for all targets

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Victory Native XL on web** is not first-class (Skia web = CanvasKit wasm; Reanimated web quirks) | Keep all chart rendering behind `ChartView`. If web rendering fails, swap a web-only SVG implementation behind the same props. Test web early in M3, not at M6. |
| **Drag-reorder libraries on web** are unreliable | Acceptable fallback: up/down move buttons on web (decided in M6) |
| **CORS** blocks the web/desktop-webview build from calling Glances | Document Glances CORS config; Tauri can use its Rust-side HTTP client to bypass CORS if needed |
| **Expo Go incompatibility** creeping in via a native dep | Rule in AGENTS.md: any library requiring a dev client must be flagged before adding |
| `processlist` payloads are large; many widgets × short intervals strain phones | Query de-dup via TanStack Query; consider pausing polling when app is backgrounded (`AppState`) |
| Tamagui setup complexity (compiler config per platform) | Start with the runtime (non-compiler) setup; enable the optimizing compiler later only if perf demands |

## 6. Out of scope

- iOS release (kept compiling, never gated on)
- Migration/import of web-app localStorage dashboards
- Glances authentication schemes beyond plain HTTP(S) endpoints (password-protected servers can be a future feature)
- Historical data / time-series charts (source app has none — parity only)
