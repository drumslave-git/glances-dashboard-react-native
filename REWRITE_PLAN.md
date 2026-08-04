# Glances Dashboard — React Native Rewrite Plan

Rewrite of [drumslave-git/glances-dashboard](https://github.com/drumslave-git/glances-dashboard)
(local copy: `E:\projects\glances-dashboard`) as a cross-platform React Native app.

## 0. Realignment, 2026-08-04

**The reference app this was ported from no longer exists.** M0–M9 were built against a
Vite + React + **Mantine** web app whose dashboard was a grid of five *generic* widgets — pick a
Glances plugin, pick some fields, pick a rendering. That app has since become an **Electron
desktop app at v1.13.0**: MUI + ECharts + SQLite, a main-process poller, and **26 purpose-built
widget types** covering fourteen metrics. Its own design document is
[`E:\projects\glances-dashboard\DESIGN.md`](file:///E:/projects/glances-dashboard/DESIGN.md);
section numbers below of the form *(ref §7.4)* point there.

The owner's instruction is that **looks, features and behaviours must match the current
reference**. So §2's parity checklist is replaced wholesale, and milestones **M10–M17** below
carry the work. §1 records which of the original decisions survive and which are superseded.

What already matches: the **visual language**. The reference calls its design system "Telemetry"
(ref §7.5) and this app's M8 implemented the same handoff — near-black canvas, one lime signal
accent, flat outlined panels, tracked uppercase micro-labels, JetBrains Mono numerals with
tabular figures, per-widget container-query degrade ladders. The token values agree almost
literally (`#07080a` canvas, `#b6f24a` accent, `#5e8a2e` accent-dim, `#3d4a2b` marker). The gap
is what the app *does*, not how it looks — with the exceptions recorded in §2.7.

The verification setup used to establish all of this is in §7.

---

## 1. Goals & decisions

### Still settled (unchanged from the original plan)

| Decision | Choice |
|---|---|
| Toolchain | **Expo** (SDK 57, RN 0.86, React 19.2, TS 6 strict) |
| Platforms | **Android phone, tablet, Web, Windows desktop** (Tauri). iOS is not a release target but must not be deliberately broken |
| UI library | **Tamagui** |
| Charts | **Victory Native XL** + Skia, behind `ChartView` |
| Servers | **Multi-endpoint**, each widget bound to one |
| Migration from the web app | **None** |
| Testing | Jest unit tests for logic + RNTL component tests |
| Design system | The "Telemetry" tokens in `src/theme/telemetry.ts` |

### Superseded by the realignment (confirmed with the owner, 2026-08-04)

| Was | Now | Why |
|---|---|---|
| Five generic widget kinds over any plugin + any fields | **A fixed catalog of 26 typed widgets** — `MetricId × WidgetVariant` (ref §8). The generic kinds are retired | The reference dropped the generic model; a widget that knows what it is measuring can lay itself out, degrade properly, and colour against real thresholds. Owner chose "replace them" |
| Size presets S/M/L/XL + `order` | **Free drag *and* resize** over `{x, y, w, h}`, density-driven column count (ref §7.4) | Parity. See the open question in §6 about what this means on a phone |
| Data fetching only through `useGlancesQuery` (TanStack Query), one query per widget | **A tiered poller feeding ring buffers outside React**, plugin sets derived from the placed widgets (ref §4.4, §7.2) | Per-widget polling cannot express the reference's four cadence tiers, its 3 s process floor, or history |
| Fetches stay plain `fetch`; the Tauri Rust HTTP client is not used | **Desktop fetches route through Tauri's Rust HTTP client** | The reference polls from the Electron main process, which is outside CORS. Owner chose this. See §2.6 |
| Charts only through `ChartView` over Victory Native XL | Unchanged as a rule, but the surface grows a lot — streaming line/area, threshold rings, bar lists, heatmap, sparklines | The catalog needs renderings the current `ChartView` does not have |

### New decisions

| Decision | Choice | Why |
|---|---|---|
| Config storage | **Stays AsyncStorage + Zustand `persist`.** No SQLite | The reference's own DESIGN.md §2 admits SQLite is "more machinery than the data needs" for config-only persistence. Porting drizzle would add a native module for nothing |
| Metric history | **In-memory ring buffers, lost on restart** — same as the reference (ref §7.2) | Already how `src/utils/sampleBuffer.ts` behaves |
| The alerts widget | Bound to **no** endpoint (`serverId: null`), reading every endpoint at once | Parity; it also has to survive the deletion of any one host |
| Resize gesture | **Free drag + resize on web, desktop and tablet. On a phone: one column, and the kebab menu offers the same footprints the picker does** | The geometry is identical either way — only the gesture differs. A 20 px corner grip is not a touch target, and the original plan chose presets for exactly that reason |
| In-app updates | **Out of scope.** The reference's update subsystem (ref §13) is not ported | Owner's call. Tauri's updater is new native surface and Android would need a separate story, for a feature that is about *delivery*, not about what the dashboard does |
| The transparent window | **In scope.** A translucent grid background shows the desktop through the Tauri window | Owner's call. It is a real feature of the reference's appearance model, and Tauri supports it directly |
| App identity | **This app replaces the Electron one.** Same product name, same install location; no rename | Owner's call. They are not meant to coexist, so a collision is not a scenario to design around |

---

## 2. Parity checklist against reference v1.13.0

Everything below must exist for parity. *(adapted)* marks a capability kept but reshaped for
touch or for React Native. Nothing here is checked yet — this is the M10+ scope.

### 2.1 Endpoints

- [ ] Fields: `id, name, url, pollIntervalMs (default 2000, min 1000), enabled, color, sortOrder, createdAt` — the current `GlancesServer` has none of `enabled`, `color` as a free hex, or `sortOrder`
- [ ] **Enable/disable** an endpoint: polling pauses, widgets stay on the grid and show a *distinct* "endpoint disabled" state, never the failure styling
- [ ] Per-endpoint accent colour, restricted to the design's accent swatches, clearing = reset
- [ ] **Test connection** reporting the Glances version and the available plugins, or the failure reason
- [ ] Probe `/api/4/status`; on 404 probe `/api/3/status` purely to report "Glances 3.x unsupported"
- [ ] Fetch `/api/4/pluginslist` (capabilities) and `/api/4/all/limits` (thresholds) once per connection
- [ ] Status state machine: `connecting | online | degraded (1–2 failures) | offline (3+, backoff) | unsupported-version | disabled`
- [ ] Consecutive-failure backoff 2 s → 30 s cap
- [ ] Deleting an endpoint **cascades its widgets**, behind a confirmation listing them
- [ ] Endpoint chip is one component, used identically in the toolbar roster, on every widget header, and in the endpoint list; the accent colours a *healthy* chip only — state wins on a failing one

### 2.2 Polling and data (ref §4)

- [ ] Only the plugins the placed widgets need are fetched, recomputed whenever widgets or endpoints change
- [ ] Four tiers: **fast** (endpoint interval, default 2 s, floor 1 s) · **heavy** (`max(3 s, interval)`) · **slow** (10 s) · **static** (60 s)
- [ ] The **3 s heavy floor is load-bearing**: polling `/processlist` or `/containers` faster makes Glances report `cpu_percent: 0` for every row
- [ ] Parallel per-plugin GETs with a 5 s timeout each; never `/api/4/all` (it always carries the full processlist)
- [ ] A gained plugin is fetched **immediately**, not on the next tier tick
- [ ] Newest value per plugin cached and replayed on reload, so static-tier widgets are not blank for a minute
- [ ] Cadence drops to 30 s when the app is hidden/backgrounded; an immediate poll on return *(adapted: `AppState` on Android, `visibilitychange` on web, Tauri window events on desktop)*
- [ ] **Rate semantics**: prefer `plain_field / time_since_update`, or `_rate_per_sec`; **never** diff `_gauge` across our own polls; treat a missing `_rate_per_sec` as "no data yet" and skip the point
- [ ] Normalization happens **before** the data reaches widgets: list plugins re-keyed by their own `key` member, sensors keyed `type:label` (labels are not unique), rates resolved to one number or `null`
- [ ] A 404/501 on one plugin is a *missing section*, not a connection failure
- [ ] Ring buffer per `(endpointId, plugin)`, capacity `ceil(windowSec / pollIntervalSec)`, `windowSec` = the widest window any widget on that endpoint asks for (floor 5 min)
- [ ] Buffers and series data **never enter React state**; charts subscribe transiently and repaint without re-rendering
- [ ] Threshold colouring from `limits`: `careful → info`, `warning → warning`, `critical → error`, **`ok → the accent`, not green**

### 2.3 The widget catalog (ref §8)

26 types = 14 metrics × their renderings. Every metric with a graphical rendering also has a
**text** one (a label-and-value table); `processes`, `containers` and `alerts` have none, and
`system` has *only* text.

| Metric | Types | Notes |
|---|---|---|
| CPU | `cpu` (chart) · `cpuGauge` · `cpuText` | streaming total %, optional user/system/iowait split, optional per-core overlay |
| Per-core CPU | `percpu` (bars) · `percpuText` | bar list **or heatmap** |
| Memory | `memory` (chart) · `memoryGauge` · `memoryText` | used % + swap %, bytes in the tooltip |
| Load average | `load` (chart) · `loadText` | min1/5/15, optional ÷ `cpucore` normalization |
| System info | `systemInfo` (text only) | `hr_name`, uptime at **minute** granularity |
| Endpoint summary | `endpointSummary` (bars) · `endpointSummaryText` | cpu/mem/swap/load meters from `quicklook` |
| Network | `network` (chart) · `networkText` | per-interface rx/tx, unit auto-scaled, B/s ↔ bits/s |
| Disk I/O | `diskio` (chart) · `diskioText` | per-disk read/write |
| Filesystem | `filesystem` (table) · `filesystemText` | configurable columns; mount path always shown, device/type as its second line |
| Sensors | `sensors` (table) · `sensorsText` | grouped temperature / fan / battery, per-item thresholds |
| GPU | `gpu` (bars) · `gpuText` | temperature hero + thermal histogram over utilization/memory/fan rails; every field nullable → "—" |
| Processes | `processes` (table) | sortable; name, **per-row CPU sparkline**, CPU bar+number, mem %/RSS, pid, user, threads, status; `processcount` footer |
| Containers | `containers` (table) | name, engine, status, CPU %, mem used/limit, net rx/tx, io r/w. All four rate fields are **bytes/s** — the Glances docs are wrong about `network_rx` |
| Alerts | `alerts` (table, **global**) | every endpoint's events in one table; ongoing first, then newest first; never greyed out for one failing endpoint |

Per-type behaviour that is easy to miss:

- [ ] A **text** variant asks for no time window and registers no header chip
- [ ] Missing plugin on a host → a quiet "not available on this endpoint" body, never a crash
- [ ] GPU/containers absent → `[]`, which is an empty state, not an error
- [ ] `uptime` is a **preformatted string**, displayed verbatim
- [ ] `/processlist/top/50` is sorted **by CPU descending by the server** and ignores sort params — sorting the table by memory reorders that CPU-selected set, and the widget must say so
- [ ] Per-process trend buffers pruned to the visible rows

### 2.4 Grid and widget frame (ref §7.4)

- [ ] Free **drag and resize** over `{x, y, w, h}`, edit-mode gated, drag by the header handle only *(adapted: on a phone the grid is one column and the kebab offers the footprints instead of a resize grip — the stored geometry is the same either way)*
- [ ] **Density-driven columns**: one widget per column, `MIN_COL_WIDTH_PX = 290`, columns stretch to fill the measured width exactly so a row always ends at the window edge
- [ ] Rows stretch to fill the **scroll viewport**, `MIN_ROW_HEIGHT_PX = 70`; row height must not depend on how deep the layout is
- [ ] **The widget is the breakpoint**: each panel measures its own box. Width → `compact (<300) | regular | wide (≥520)`; height → `short (<200)`, composing with any tier. Never stored — dragging smaller *is* the configuration
- [ ] Degrade ladders per family, all "degrade, don't clip": charts → grid+axis+marker → grid → bare trace → a 3 px pulse strip; dual-rate pairs → stacked → arrow-only → two strips; meters → 2×2 → stacked → label+value rows; rings 140 → 122 → 108 px → a bar at short; tables drop columns by priority and never half-cut a row
- [ ] Headers never wrap: the title truncates, the endpoint chip does not, and the widget's meta chips **retreat into the kebab menu** rather than off the panel
- [ ] Widget chrome: accent tick · tracked title · endpoint chip · widget meta chips · kebab. `headerMeta` is registered **by the widget**, not the frame
- [ ] Status overlay covers the **whole panel**, header included
- [ ] Per-widget **error boundary** — one widget crashing must not blank the window
- [ ] Optional **hidden headers**, revealed on hover/press, keyed by a corner mark
- [ ] Minimum footprint 1 column × 2 rows; nothing smaller

### 2.5 Shell, dialogs, settings

- [ ] Toolbar: brand mark, `GLANCES · TELEMETRY` wordmark, endpoint chip rail, Add widget, Edit layout, Endpoints, theme toggle, settings
- [ ] **Two-step add-widget picker**: pick a metric → pick a rendering from cards **each mounting the real widget against the real endpoint with live data**, then size cards at their true footprint. Unavailable plugins disabled with an explanatory tooltip
- [ ] The picker's previews need plugins nothing is polling yet — a **transient** preview plugin set, one slot, last request wins, cleared when the picker closes
- [ ] **Widget config**: title, endpoint **rebind**, per-type options, appearance override. Rebinding clears endpoint-scoped selections (interfaces, disks, mounts, sensor types, GPU ids) and **remounts the body** keyed on endpoint id
- [ ] Endpoints list + form with test connection
- [ ] Settings, two tabs: **General** (theme mode, network unit bytes/bits) · **Appearance**. The reference's third tab, **Updates**, is out of scope (§1)
- [ ] **Appearance** (ref §7.6): interface scale (10–300%), grid background, widget background, grid gap, widget corner radius, content padding, widget border, hide-widget-headers. Every colour stored **per scheme with its own alpha**; every size in `rem`; live preview via a draft that Cancel simply clears; a per-setting reset plus "Reset everything"
- [ ] Per-widget background override from its own kebab → Configure
- [ ] **The transparent window** (ref §7.6): below full opacity the grid background shows the
      *desktop* through the Tauri window, and the app bar stays opaque because it is also the title
      bar. Note the reference's own trade — a transparent window cannot be resized by its edges and
      loses the WM drop shadow, so it only asks for one when an alpha is actually below 1
- [ ] Full screen: the bar leaves the flow and slides back when the pointer reaches the top edge *(adapted: this app's immersive mode; on touch, a tap at the top edge)*
- [ ] Keyboard: `Ctrl/Cmd+N` add · `+E` edit layout · `+K` endpoints · `+,` settings · `F11` full screen · `Esc` leave *(web and desktop only)*
- [ ] Empty states: no endpoints → centred call to action; endpoint offline → dimmed last data under a status overlay

### 2.6 Cross-cutting: how requests are made

The reference is immune to CORS because it polls from the Electron main process (ref §3). This
app has no such process, and the difference is not theoretical — **it is why the RN build could
not read the owner's own server**: `http://glances.tcloud.monster` 301-redirects to `https://`,
and the **301 carries no `Access-Control-Allow-Origin`**, so the browser blocks the redirect
before it can be followed.

- [ ] **Desktop**: route fetches through Tauri's Rust HTTP client — no CORS, redirects followed, private-IP requests unrestricted. This is the main-process equivalent
- [ ] **Android**: unaffected, plain `fetch`
- [ ] **Hosted web**: keeps the browser's rules. Document them, and keep `describeNetworkError`'s CORS wording
- [ ] `coerceServerUrl` must stop turning a bare `glances.example.com` into `http://…:61208` when the host answers on 443 — probe, or prefer `https` for a name that is not an IP literal

### 2.7 Deliberate divergences to keep

These are places where this app should **not** match the reference, and the plan says so up front
rather than letting a future pass "fix" them:

- **No grey text.** `src/theme/telemetry.test.ts` asserts every text token clears 4.5:1 against
  every surface it lands on. The reference's `textLabel` (`#545c59`) and `textFaint` (`#454c49`)
  do not clear it against `#0c0f10`; this app's equivalents are brightened. The contrast floor wins
- **`shorten` handles negatives.** The reference rendered `-1500` as `--1.5k`
- **Unformatted numbers cap at 2 decimals** (`formatLooseNumber`)
- **No SQLite** (§1)

---

## 3. Architecture after the realignment

### 3.1 What replaces the main process

The reference's split is *main polls, renderer draws*. Here the split becomes *a platform-agnostic
poller module, driven by one owner*:

```
src/
  data/
    poller.ts        # tiered scheduler per endpoint; the port of main/services/poller.ts
    transport.ts     # platform-resolved fetch: fetch | fetch.web | fetch.tauri (Rust client)
    normalize.ts     # PLUGIN_SPECS: path, tier, re-keying, rate resolution — port of main/services/normalize.ts
    probe.ts         # /status version detection, pluginslist, all/limits
    buffers.ts       # RingBuffer per (endpointId, plugin) — outside React, never in a store
    feed-store.ts    # zustand: { slices: { seq, latest }, endpointStatus } — coordination only
    thresholds.ts    # limits → careful/warning/critical → info/warning/error, ok → accent
  types/
    glances.ts       # normalized snapshot types — port of shared/glances.ts
  widgets/
    catalog.ts       # DATA-ONLY registry: type → { metric, variant, requiredPlugins,
                     #   capabilityPlugins, sizes, configSchema } — importable by the poller
    registry.tsx     # the same entries extended with { component, configForm, headerMeta }
```

The registry split survives the port even without a process boundary: the poller must compute
plugin sets from widget rows without importing a single React component.

`useGlancesQuery` and its TanStack Query layer are **retired** for metric data. TanStack Query
stays only where a request really is request/response — the connection test and the probe.

### 3.2 Data model (replaces §3 of the original plan)

```ts
interface GlancesEndpoint {          // was GlancesServer
  id: string
  name: string
  url: string
  pollIntervalMs: number             // was refreshMs; default 2000, floor 1000
  enabled: boolean                   // NEW
  color: string | null               // NEW — a hex from the accent swatches; was accentIndex
  sortOrder: number                  // NEW
  createdAt: number                  // NEW
}

interface WidgetInstance {           // replaces WidgetConfig entirely
  id: string
  type: WidgetType                   // one of the 26; no more kind + metric + fields
  endpointId: string | null          // null for a global widget (alerts)
  title: string | null               // null = the type's own label
  config: Record<string, unknown>    // per-type, zod-validated on read
  appearance: WidgetAppearance | null// null = inherit the app settings
  x: number; y: number; w: number; h: number
  createdAt: number
}
```

Both are persisted user data, so both need a **versioned migration**. The widgets store's is a
one-way door: there is no honest mapping from `{ kind: 'donut', metric: 'mem', fields: [...] }`
onto a typed catalog entry, so **v1 widgets are dropped** and the user rebuilds — which is what
"no migration" in §1 has always meant.

### 3.3 What survives from M0–M9

Most of the design layer and roughly half the utilities:

- `src/theme/telemetry.ts`, `src/utils/typeScale.ts`, `src/components/telemetry/*` — the whole
  primitive set (endpoint chip, accent tick, state chips, meters, hero/stat numerals, logo,
  toolbar buttons). This is why "looks the same" is mostly already true
- `src/utils/sampleBuffer.ts` (becomes `data/buffers.ts`), `chartGeometry.ts`, `widgetLayout.ts`
  (partly), `dragReorder.ts` (superseded by free drag/resize, but its measured-rect approach is
  the right one)
- `src/components/charts/*` — the `ChartView` boundary and the web CanvasKit gate stay exactly as
  they are; the set of chart kinds behind them grows
- The Tauri wrapper, the release pipeline, `scripts/sync-version.js`, the Android run script

What goes: `src/utils/widgetData.ts`, `chartColors.ts`, `widgetFactory.ts`,
`widgetPresentation.ts`, the formatter editor and field-picker config UI, `useGlancesQuery`, and
the generic widget bodies. All of it exists to serve a widget model that is being retired.

---

## 4. Milestones

Each ends with: tests green, `typecheck` + `lint` clean, **and the app looked at on Android *and*
web** — the M9 lesson, now a rule (§5 of REWRITE_PROGRESS's decisions log).

### M10 — Data layer
Normalized types and `PLUGIN_SPECS`; the tiered poller with backoff, hidden-cadence and immediate
fetch of gained plugins; ring buffers and the coordination store; probe with version detection,
capabilities and limits; threshold resolution; the transport seam with the Tauri client behind it.
*Done when: a test endpoint's buffers grow at the right cadence per tier, status chips walk
`connecting → online → degraded → offline`, and the desktop build reads
`http://glances.tcloud.monster` without a CORS error.*

### M11 — Endpoint model
`GlancesEndpoint` with the new fields and its store migration; enable/disable; accent colour;
endpoints screen with test connection; cascade delete with confirmation; the endpoint chip
unified across toolbar, widget header and list.
*Done when: a disabled endpoint's widgets show the disabled state and nothing polls it.*

### M12 — Widget framework + core metrics
The registry split; the widget frame rebuilt to the reference anatomy with measured tier/short and
the degrade ladders; per-widget error boundary; `cpu`/`cpuGauge`/`cpuText`, `percpu`/`percpuText`,
`memory`/`memoryGauge`/`memoryText`, `load`/`loadText`, `systemInfo`,
`endpointSummary`/`endpointSummaryText`.
*Done when: core widgets stream live, and one resized down a column at a time walks its ladder.*

### M13 — Rate and table metrics
`network`/`networkText`, `diskio`/`diskioText` including the first-sample rule,
`filesystem`/`filesystemText`, `sensors`/`sensorsText`, `gpu`/`gpuText`; the `DualRateReadout`,
`MetricBar`, `RingGauge` and `DataGrid` primitives.
*Done when: throughput matches the Glances web UI on a loaded host.*

### M14 — Processes, containers, alerts
The process table with per-row sparklines and the `processcount` footer; containers; `alerts` as
the first **global** widget, which is also what forces `endpointId: null` through the stores.
*Done when: the tables stay smooth at the 3 s heavy cadence on a phone.*

### M15 — Grid and shell
Free drag + resize over `{x,y,w,h}`, density-driven columns, viewport-filling rows; the two-step
add-widget picker with live previews, size cards and the transient preview plugin set; the widget
config dialog including endpoint rebind; full screen with the auto-hiding bar; keyboard shortcuts.
*Done when: a layout survives a restart, and the picker previews draw live data for a plugin no
placed widget uses.*

### M16 — Appearance and settings
The appearance model (per-scheme colours with alpha, rem sizes, interface scale, draft-based live
preview, per-setting reset); per-widget background override; the two settings tabs; hidden widget
headers; the transparent Tauri window, requested only when an alpha is below 1.
*Done when: every control previews live, Cancel restores, light and dark both hold, and a
translucent grid shows the desktop through the desktop build.*

### M17 — Release parity
CORS story documented per target; README rewritten for all four targets; the reference's in-app
update story assessed (see §6); version bump and a release across Windows, Android and web.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| **Free drag *and* resize has no react-grid-layout on RN.** M5 already established that no sortable library fits, and this is strictly harder | The measured-rectangle approach in `src/utils/dragReorder.ts` generalises: keep the geometry pure and unit-tested in `src/utils/gridLayout.ts`, and let gesture-handler drive it. Budget M15 accordingly — it is the single largest unknown in the plan |
| **Resize handles are a mouse interaction.** A 20 px corner grip is not a touch target | See §6 — this needs an owner decision, not a workaround invented mid-milestone |
| **26 widgets is a lot of surface**, and each has a degrade ladder to honour | The ladders are pure functions of a measured box, as in M8. Test the ladder, snapshot-test one widget per family, do not test 26 × 4 renderings |
| ECharts renderings (heatmap, gauge, thermal histogram) have no Victory equivalent | They go behind `ChartView` like everything else; Skia draws them directly where Victory has no chart type. The boundary is what makes that a local decision |
| The poller is now this app's most complex module and runs on three platforms | It is platform-free TypeScript over a `transport` seam. Unit-test it against a fake clock and a stub transport, as the reference does not and wishes it did |
| Rate semantics are easy to get subtly wrong | Port `normalize.ts` verbatim, with the reference's own measured notes (ref §4.3) as test cases |
| Dropping every saved v1 widget | Called out in §3.2 and in the migration itself. The dashboards are small and hand-built |

---

## 6. Questions the owner has resolved (2026-08-04)

All four are folded into §1's decision table and into the checklists above; they are repeated
here only so the reasoning is not lost.

1. **Resize on a phone** — free drag + resize on web, desktop and tablet; on a phone one column
   with the kebab offering the picker's footprints. Approved as proposed.
2. **In-app updates** — **out of scope.** Not ported, and the Updates settings tab does not exist
   here. This app's own release pipeline (M9) is unaffected: it still builds and publishes.
3. **The transparent window** — **in scope.** M16.
4. **Naming** — this app **replaces** the Electron one. No rename, and the install collision is
   not a case to design around.

Nothing is open. The plan is complete.

---

## 7. Verification setup

Established 2026-08-04 and worth keeping:

- **Live server**: `https://glances.tcloud.monster` — Glances **4.5.6**, 28 plugins including
  `containers`, `gpu`, `sensors` and `alert`. Use `https`; the `http` URL 301s and the redirect
  is CORS-opaque
- **Running the reference**: `npm install`, then `npm run setup` — which on this machine
  reported success **without** downloading the Electron binary, so `node
  node_modules/electron/install.js` is the actual fix. Then
  `npx electron-vite dev --remoteDebuggingPort=9333`
- **Driving either app**: both are CDP-attachable — the reference via the flag above, the RN Tauri
  build via `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9444`. Both windows are
  genuinely visible, so Skia and ECharts both paint and screenshots work
- **Seeding a board without clicking**: the reference takes `window.api.invoke('widgets:save', …)`;
  the RN app takes `localStorage['glances-dashboard:widgets']`

---

## 8. Out of scope

- iOS release (kept compiling, never gated on)
- Importing dashboards from either the old web app or the current Electron app's `config.db`
- Glances authentication beyond plain HTTP(S)
- Persisted metric history — the reference has none either
- **In-app updates** (ref §13), and the Updates settings tab with them — §1. Publishing releases
  is unaffected; only checking for and installing them from inside the app is out
- SQLite/drizzle config storage — §1
