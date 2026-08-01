# AGENTS.md — How to work in this repo

This repo is a **React Native (Expo) rewrite** of the web app at
`E:\projects\glances-dashboard` ([GitHub](https://github.com/drumslave-git/glances-dashboard)).
The web app is the **behavioral reference** — when in doubt about what a feature should do,
read its source. Never modify the reference project.

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
npx expo start            # dev server (press a = Android, w = web)
npx expo start --web      # web only
npm test                  # jest
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
```

(If a script is missing in package.json during early milestones, add it — these names are the contract.)

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

## Hard rules

- **TypeScript strict**, no `any` (use `unknown` + narrowing, as the source app does).
- **Expo Go compatibility**: do not add a library that requires a custom dev client or config-plugin native code without flagging it to the owner first. Chosen deps (Skia, Reanimated, gesture-handler, Tamagui, AsyncStorage) are all Expo Go-safe.
- **Ported logic stays pure and tested**: `src/utils/` (formatters, token resolution, chart segments, colors) must remain platform-free pure TS with unit tests. Port behavior verbatim from the reference before "improving" it.
- **Charts only through `ChartView`**: no Victory Native XL imports outside `src/components/charts/`. This boundary is the planned escape hatch if web rendering fails (see plan §5 Risks).
- **UI only through Tamagui** components/tokens — no ad-hoc `StyleSheet` styling except where a library demands raw views.
- **Data fetching only through `useGlancesQuery`** (TanStack Query). Never `fetch` directly from components; query keys are `[serverId, endpointPath]`.
- All persisted state goes through the Zustand stores in `src/state/` — no direct AsyncStorage calls elsewhere. Persisted shapes are user data: when changing `WidgetConfig`/`GlancesServer`, add a versioned migration in the store.

## Testing expectations

- Pure logic: unit tests colocated (`*.test.ts`), written **with or before** the port.
- Screens/widgets: React Native Testing Library tests with fixture Glances payloads (capture real payloads into `__fixtures__/` once and reuse).
- Don't mock what you can use for real; mock only the network boundary (TanStack Query test wrapper or msw-style fetch stubs).

## Glances API cheatsheet

- Base: `http://<host>:61208`, REST under `/api/4/…`, all plain GET returning JSON.
- `/api/4/pluginslist` → string[] of available plugins/metrics.
- `/api/4/system` → `{ hostname, linux_distro, os_name, ... }`.
- `/api/4/{plugin}` (e.g. `cpu`, `mem`, `load`, `fs`, `gpu`, `processlist`) → object **or array** (fs/gpu/processlist are arrays; widget logic takes the first element except processes, which uses the whole array).
- No auth in scope. CORS matters only for web/desktop-webview targets.

## Reference map (web app → this repo)

| Web app file | Becomes |
|---|---|
| `src/utils/widgetData.ts`, `chartColors.ts`, `widgetFactory.ts` | `src/utils/` — verbatim port + tests |
| `src/hooks/useGlancesEndpoint.ts` | `src/hooks/useGlancesQuery.ts` (TanStack Query) |
| `src/hooks/useSettingsStorage.ts`, `useWidgetsStorage.ts` | `src/state/` Zustand persisted stores |
| `src/components/WidgetGrid.tsx` (react-grid-layout) | reorderable grid + size presets (plan §3/§4 M5) |
| `src/components/WidgetContent/*` | `src/components/widgets/` + `charts/` |
| `src/components/*Modal*` | expo-router screens/sheets under `app/` |
| Mantine UI | Tamagui |
| Mantine charts (Recharts) | Victory Native XL behind `ChartView` |
