/**
 * The widget catalog — **data only**.
 *
 * Nothing here imports React. That is the same split the reference keeps across its process
 * boundary (ref §10.1) and it survives the port for the same reason: the poller has to compute each
 * endpoint's plugin set from the placed widget rows, and it must not drag a component tree along to
 * do it. The renderer half — `registry.tsx`, with the component, config form and header chips —
 * extends these entries.
 *
 * A widget type is a **metric** (what is measured) crossed with a **variant** (how it is drawn),
 * ref §8. The metric owns the group, so a rendering can never end up in a different category from
 * the number it draws.
 */
import { z } from 'zod';
import { MAX_WINDOW_SEC } from '@/data/buffers';
import type { PluginName } from '@/types/glances';

/** Catalog grouping, which is also the order the picker lists metrics in. */
export const WIDGET_GROUPS = ['core', 'system', 'io', 'processes', 'alerts'] as const;
export type WidgetGroup = (typeof WIDGET_GROUPS)[number];

export const GROUP_LABELS: Record<WidgetGroup, string> = {
  core: 'Core',
  system: 'System',
  io: 'Network, disk and filesystem',
  processes: 'Processes',
  alerts: 'Alerts',
};

/** Every metric the reference has. */
export const METRIC_IDS = [
  'cpu',
  'percpu',
  'memory',
  'load',
  'system',
  'summary',
  'network',
  'diskio',
  'filesystem',
  'sensors',
  'gpu',
  'processes',
  'containers',
  'alerts',
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDefinition {
  id: MetricId;
  label: string;
  /**
   * The name a compact panel wears when `label` is too long for the single header row it has.
   * Absent means `label` is already short enough.
   */
  compactLabel?: string;
  group: WidgetGroup;
  /** What the reading *is*. How it is drawn belongs to the variant, not here. */
  description: string;
}

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  cpu: {
    id: 'cpu',
    label: 'CPU',
    group: 'core',
    description: 'Total processor utilization and its user / system / iowait breakdown.',
  },
  percpu: {
    id: 'percpu',
    label: 'Per-core CPU',
    compactLabel: 'Cores',
    group: 'core',
    description: 'Utilization of every logical core, one reading each.',
  },
  memory: {
    id: 'memory',
    label: 'Memory',
    group: 'core',
    description: 'Used, free and cached memory, with swap.',
  },
  load: {
    id: 'load',
    label: 'Load average',
    compactLabel: 'Load',
    group: 'core',
    description: '1 / 5 / 15 minute run-queue length, optionally per core.',
  },
  system: {
    id: 'system',
    label: 'System info',
    compactLabel: 'System',
    group: 'system',
    description: 'Host name, OS, CPU model and uptime.',
  },
  summary: {
    id: 'summary',
    label: 'Endpoint summary',
    compactLabel: 'Summary',
    group: 'system',
    description: 'CPU, memory, swap and load for the whole host in one panel.',
  },
  network: {
    id: 'network',
    label: 'Network',
    group: 'io',
    description: 'Receive and transmit throughput per interface.',
  },
  diskio: {
    id: 'diskio',
    label: 'Disk I/O',
    compactLabel: 'Disk',
    group: 'io',
    description: 'Read and write throughput per disk.',
  },
  filesystem: {
    id: 'filesystem',
    label: 'Filesystem',
    compactLabel: 'Disks',
    group: 'io',
    description: 'Mount points with size, used and free.',
  },
  sensors: {
    id: 'sensors',
    label: 'Sensors',
    group: 'system',
    description: 'Temperatures, fans and battery.',
  },
  gpu: {
    id: 'gpu',
    label: 'GPU',
    group: 'system',
    description: 'Per-GPU utilization, memory and temperature.',
  },
  processes: {
    id: 'processes',
    label: 'Processes',
    group: 'processes',
    description: 'The busiest processes, with a count of everything running.',
  },
  containers: {
    id: 'containers',
    label: 'Containers',
    group: 'processes',
    description: 'Docker / Podman containers and what they are using.',
  },
  alerts: {
    id: 'alerts',
    label: 'Alerts',
    group: 'alerts',
    description: 'Warning and critical events from every endpoint.',
  },
};

/**
 * How a metric is drawn. The order is the order the variant picker offers them in, richest first —
 * `text` is deliberately last everywhere, because it is the fallback for someone who wants the
 * numbers and none of the ink.
 */
export const WIDGET_VARIANTS = ['chart', 'gauge', 'bars', 'table', 'text'] as const;
export type WidgetVariant = (typeof WIDGET_VARIANTS)[number];

export const VARIANT_LABELS: Record<WidgetVariant, string> = {
  chart: 'Chart',
  gauge: 'Gauge',
  bars: 'Bars',
  table: 'Table',
  text: 'Text',
};

export const WIDGET_TYPES = [
  'cpu',
  'cpuGauge',
  'cpuText',
  'percpu',
  'percpuText',
  'memory',
  'memoryGauge',
  'memoryText',
  'load',
  'loadText',
  'systemInfo',
  'endpointSummary',
  'endpointSummaryText',
  'network',
  'networkText',
  'diskio',
  'diskioText',
  'filesystem',
  'filesystemText',
  'sensors',
  'sensorsText',
  'gpu',
  'gpuText',
  'processes',
  'containers',
  'alerts',
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/**
 * Whether a widget reads from the one endpoint it is bound to, or from every endpoint at once.
 *
 * Almost everything is endpoint-scoped, so the field is absent there and only a cross-endpoint type
 * declares itself. Scope is a property of the *type*, never of the instance, so it is not the
 * user's to move. Nothing in M12 is global; the alerts feed (M14) is the first.
 */
export type WidgetScope = 'endpoint' | 'global';

export interface GridSize {
  w: number;
  h: number;
}

/**
 * The footprints a widget is offered at, and the presentation the placed widget answers with.
 *
 * A tier is a fact about **rendered size**, never a stored property: the frame measures its own
 * width and the widget dresses for the room it actually has, so a wide widget dragged down to one
 * column becomes the compact rendering without being told.
 */
export const SIZE_TIERS = ['wide', 'regular', 'compact'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export const SIZE_TIER_LABELS: Record<SizeTier, string> = {
  wide: 'Wide',
  regular: 'Regular',
  compact: 'Compact',
};

export type WidgetSizes = Record<SizeTier, GridSize>;

/**
 * The three footprints a type declares, as `[w, h]` pairs in **coarse grid units** — a column holds
 * one ordinary widget, so regular is one column and wide claims two.
 *
 * Compact is declared for completeness but always equals regular: it is what a one-column widget
 * *becomes* on a squeezed window, not a footprint anyone places, and the picker does not offer it.
 */
function tiers(compact: [number, number], regular: [number, number], wide: [number, number]): WidgetSizes {
  return {
    compact: { w: compact[0], h: compact[1] },
    regular: { w: regular[0], h: regular[1] },
    wide: { w: wide[0], h: wide[1] },
  };
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  /** What this widget measures. Two types sharing a metric are two renderings of one reading. */
  metric: MetricId;
  /** How it draws that reading — the second step of the catalog. */
  variant: WidgetVariant;
  /** Derived from the metric, never declared per type: a rendering cannot change its category. */
  group: WidgetGroup;
  /** Absent means `endpoint`. */
  scope?: WidgetScope;
  description: string;
  /** Plugins the poller must fetch for this widget. */
  requiredPlugins: PluginName[];
  /**
   * Plugins that must appear in the endpoint's `pluginslist` for the widget to be *offered*.
   * Usually `requiredPlugins` minus the merely nice-to-have — a host without `memswap` can still
   * draw a memory gauge, it just has no swap row.
   */
  capabilityPlugins: PluginName[];
  sizes: WidgetSizes;
  /** The footprint used when the caller names none — always `sizes.regular`, never declared. */
  defaultSize: GridSize;
  configSchema: z.ZodType<Record<string, unknown>>;
}

/**
 * `0` is the legacy "everything buffered" value, kept accepted so an existing row still parses —
 * without it the whole config would fall back to defaults. It resolves to the cap.
 */
const windowSec = z
  .union([z.literal(300), z.literal(900), z.literal(MAX_WINDOW_SEC), z.literal(0)])
  .default(300);

/** Seconds of history a widget config asks for, with `0` and absent values resolved. */
export function requestedWindowSec(config: Record<string, unknown>): number | undefined {
  const value = config['windowSec'];
  if (typeof value !== 'number') return undefined;
  return value === 0 ? MAX_WINDOW_SEC : value;
}

/**
 * Config keys naming items that belong to **one host** — interfaces, disks, mounts, sensor types,
 * GPU ids — each filled by a picker listing what that endpoint currently reports.
 *
 * They matter when a widget is re-bound to a different endpoint: a selection wins outright over the
 * "busiest few" fallback, so carrying `enp5s0` to a host without one would not degrade, it would
 * draw an empty chart with no explanation. Rebinding clears these and lets each re-default.
 */
export const ENDPOINT_SCOPED_CONFIG_KEYS = ['interfaces', 'disks', 'mounts', 'types', 'gpus'] as const;

export type EndpointScopedKey = (typeof ENDPOINT_SCOPED_CONFIG_KEYS)[number];

export interface SelectionOption {
  value: string;
  label: string;
}

/**
 * Where a selection key's options come from.
 *
 * The options are whatever the endpoint is **reporting right now**, not a fixed list: interfaces
 * come and go, a container host's mounts are its own, and a machine either has a GPU or does not.
 * That is also why this lives beside the keys rather than in the config screen — the screen renders
 * the picker, but what is selectable is a fact about the metric.
 *
 * Still no React here: these are pure functions over the normalized payloads.
 */
export interface SelectionSource {
  plugin: PluginName;
  label: string;
  /** Empty selection means "choose for me", and this is what the widget then falls back to. */
  autoLabel: string;
  options: (payload: unknown) => SelectionOption[];
}

function asArray(payload: unknown): Record<string, unknown>[] {
  return Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
}

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** De-duplicated, and ordered so a picker does not reshuffle itself between polls. */
function optionsFrom(payload: unknown, key: string, labelKey?: string): SelectionOption[] {
  const seen = new Map<string, string>();
  for (const row of asArray(payload)) {
    const value = stringField(row, key);
    if (value === null || seen.has(value)) continue;
    seen.set(value, (labelKey ? stringField(row, labelKey) : null) ?? value);
  }
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export const ENDPOINT_SCOPED_SELECTIONS: Record<EndpointScopedKey, SelectionSource> = {
  interfaces: {
    plugin: 'network',
    label: 'Interfaces',
    autoLabel: 'Busiest',
    options: (payload) => optionsFrom(payload, 'interfaceName', 'alias'),
  },
  disks: {
    plugin: 'diskio',
    label: 'Disks',
    autoLabel: 'Busiest',
    options: (payload) => optionsFrom(payload, 'diskName'),
  },
  mounts: {
    plugin: 'fs',
    label: 'Mounts',
    autoLabel: 'All',
    options: (payload) => optionsFrom(payload, 'mntPoint'),
  },
  types: {
    plugin: 'sensors',
    label: 'Sensor types',
    autoLabel: 'All',
    options: (payload) => optionsFrom(payload, 'type'),
  },
  gpus: {
    plugin: 'gpu',
    label: 'GPUs',
    autoLabel: 'All',
    options: (payload) => optionsFrom(payload, 'gpuId', 'name'),
  },
};

export function isEndpointScopedKey(key: string): key is EndpointScopedKey {
  return (ENDPOINT_SCOPED_CONFIG_KEYS as readonly string[]).includes(key);
}

/** A copy of `config` with every host-specific selection dropped, for a widget changing endpoint. */
export function clearEndpointScopedConfig(config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config };
  for (const key of ENDPOINT_SCOPED_CONFIG_KEYS) delete next[key];
  return next;
}

const emptyConfig = z.object({}).loose();

/**
 * Selection keys shared by a chart variant and its text twin, so the pair configures alike.
 *
 * Empty means "choose for me" — the widget then shows the busiest few rather than nothing, which
 * is why `ENDPOINT_SCOPED_CONFIG_KEYS` clears these on a rebind instead of carrying names that mean
 * nothing on the new host.
 */
const interfaces = z.array(z.string()).default([]);
const disks = z.array(z.string()).default([]);
const mounts = z.array(z.string()).default([]);
const sensorTypes = z.array(z.string()).default([]);
const gpus = z.array(z.string()).default([]);

/** A definition minus the fields that are not the type's to declare. */
type WidgetSpec = Omit<WidgetDefinition, 'group' | 'defaultSize'>;

const WIDGET_SPECS: Record<WidgetType, WidgetSpec> = {
  cpu: {
    type: 'cpu',
    label: 'CPU usage',
    metric: 'cpu',
    variant: 'chart',
    description: 'Streaming total CPU %, optionally split into user / system / iowait.',
    requiredPlugins: ['cpu', 'percpu'],
    capabilityPlugins: ['cpu'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({
      split: z.boolean().default(false),
      perCoreOverlay: z.boolean().default(false),
      windowSec,
    }),
  },
  cpuGauge: {
    type: 'cpuGauge',
    label: 'CPU gauge',
    metric: 'cpu',
    variant: 'gauge',
    description: 'Single threshold-coloured ring for total CPU %.',
    requiredPlugins: ['cpu'],
    capabilityPlugins: ['cpu'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: emptyConfig,
  },
  cpuText: {
    type: 'cpuText',
    label: 'CPU readings',
    metric: 'cpu',
    variant: 'text',
    description: 'Total, user, system, idle and iowait as plain rows.',
    requiredPlugins: ['cpu', 'quicklook'],
    capabilityPlugins: ['cpu'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },
  percpu: {
    type: 'percpu',
    label: 'Per-core CPU',
    metric: 'percpu',
    variant: 'bars',
    description: 'One bar per logical core.',
    requiredPlugins: ['percpu'],
    capabilityPlugins: ['percpu'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },
  percpuText: {
    type: 'percpuText',
    label: 'Per-core readings',
    metric: 'percpu',
    variant: 'text',
    description: 'One row per logical core, core number against its percentage.',
    requiredPlugins: ['percpu'],
    capabilityPlugins: ['percpu'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },
  memory: {
    // Named for what distinguishes it from the ring: this one is the series, not the instant.
    // The header is one dense line, and `Memory` on both would tell them apart nowhere.
    type: 'memory',
    label: 'Memory trend',
    metric: 'memory',
    variant: 'chart',
    description: 'Used memory % over time, optionally with swap.',
    requiredPlugins: ['mem', 'memswap'],
    capabilityPlugins: ['mem'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({
      showSwap: z.boolean().default(true),
      windowSec,
    }),
  },
  memoryGauge: {
    type: 'memoryGauge',
    label: 'Memory gauge',
    metric: 'memory',
    variant: 'gauge',
    description: 'Ring gauge with used / total, swap and cache.',
    // Swap is part of the readout, not an extra: it separates "memory is full" from "memory is
    // full and the host has started paying for it".
    requiredPlugins: ['mem', 'memswap'],
    capabilityPlugins: ['mem'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: emptyConfig,
  },
  memoryText: {
    type: 'memoryText',
    label: 'Memory readings',
    metric: 'memory',
    variant: 'text',
    description: 'Used, free, available, cached and swap as plain rows.',
    requiredPlugins: ['mem', 'memswap'],
    capabilityPlugins: ['mem'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({
      showSwap: z.boolean().default(true),
    }),
  },
  load: {
    type: 'load',
    label: 'Load average',
    metric: 'load',
    variant: 'chart',
    description: '1 / 5 / 15 minute load, optionally normalized per core.',
    requiredPlugins: ['load'],
    capabilityPlugins: ['load'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({
      normalize: z.boolean().default(false),
      windowSec,
    }),
  },
  loadText: {
    type: 'loadText',
    label: 'Load readings',
    metric: 'load',
    variant: 'text',
    description: 'The three averages and the core count they are measured against.',
    requiredPlugins: ['load'],
    capabilityPlugins: ['load'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({
      normalize: z.boolean().default(false),
    }),
  },
  systemInfo: {
    type: 'systemInfo',
    label: 'System info',
    metric: 'system',
    // Identity has no graph to draw — the text rendering *is* the widget, and saying so here is
    // what stops the variant picker offering a second one that would be the same panel twice.
    variant: 'text',
    description: 'Host name, OS, CPU model and uptime.',
    requiredPlugins: ['system', 'uptime', 'quicklook'],
    capabilityPlugins: ['system'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },
  endpointSummary: {
    type: 'endpointSummary',
    label: 'Endpoint summary',
    metric: 'summary',
    variant: 'bars',
    description: 'Compact CPU / memory / swap / load bars with the CPU model beneath.',
    requiredPlugins: ['quicklook'],
    capabilityPlugins: ['quicklook'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },
  endpointSummaryText: {
    type: 'endpointSummaryText',
    label: 'Endpoint readings',
    metric: 'summary',
    variant: 'text',
    description: 'The same four figures as rows, with the CPU model and clock.',
    requiredPlugins: ['quicklook'],
    capabilityPlugins: ['quicklook'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: emptyConfig,
  },

  network: {
    type: 'network',
    label: 'Network throughput',
    metric: 'network',
    variant: 'chart',
    description: 'Receive / transmit rate per selected interface.',
    requiredPlugins: ['network'],
    capabilityPlugins: ['network'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({
      interfaces,
      unit: z.enum(['bytes', 'bits']).default('bytes'),
      windowSec,
    }),
  },
  networkText: {
    type: 'networkText',
    label: 'Network readings',
    metric: 'network',
    variant: 'text',
    description: 'Current rate and lifetime total per direction, per interface.',
    requiredPlugins: ['network'],
    capabilityPlugins: ['network'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ interfaces, unit: z.enum(['bytes', 'bits']).default('bytes') }),
  },
  diskio: {
    type: 'diskio',
    label: 'Disk I/O',
    metric: 'diskio',
    variant: 'chart',
    description: 'Read / write rate per selected disk.',
    requiredPlugins: ['diskio'],
    capabilityPlugins: ['diskio'],
    sizes: tiers([1, 3], [1, 3], [2, 3]),
    configSchema: z.object({ disks, windowSec }),
  },
  diskioText: {
    type: 'diskioText',
    label: 'Disk I/O readings',
    metric: 'diskio',
    variant: 'text',
    description: 'Current rate and lifetime total per direction, per disk.',
    requiredPlugins: ['diskio'],
    capabilityPlugins: ['diskio'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ disks }),
  },
  filesystem: {
    type: 'filesystem',
    label: 'Filesystem usage',
    metric: 'filesystem',
    variant: 'table',
    description: 'Mount points with size, used, free and a usage bar.',
    requiredPlugins: ['fs'],
    capabilityPlugins: ['fs'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({
      mounts,
      // A containerised host reports the same device under dozens of bind-mount paths.
      showEveryMount: z.boolean().default(false),
    }),
  },
  filesystemText: {
    type: 'filesystemText',
    label: 'Filesystem readings',
    metric: 'filesystem',
    variant: 'text',
    description: 'One labelled block per mount, with device, size, used and free.',
    requiredPlugins: ['fs'],
    capabilityPlugins: ['fs'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ mounts, showEveryMount: z.boolean().default(false) }),
  },
  sensors: {
    type: 'sensors',
    label: 'Sensors',
    metric: 'sensors',
    variant: 'table',
    description: 'Temperatures, fans and battery with threshold colouring.',
    requiredPlugins: ['sensors'],
    capabilityPlugins: ['sensors'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ types: sensorTypes }),
  },
  sensorsText: {
    type: 'sensorsText',
    label: 'Sensor readings',
    metric: 'sensors',
    variant: 'text',
    description: 'Every sensor as a labelled row, without the colouring.',
    requiredPlugins: ['sensors'],
    capabilityPlugins: ['sensors'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ types: sensorTypes }),
  },
  gpu: {
    type: 'gpu',
    label: 'GPU',
    metric: 'gpu',
    variant: 'bars',
    description: 'Temperature over utilization / memory / fan rails.',
    requiredPlugins: ['gpu'],
    capabilityPlugins: ['gpu'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ gpus }),
  },
  gpuText: {
    type: 'gpuText',
    label: 'GPU readings',
    metric: 'gpu',
    variant: 'text',
    description: 'Utilization, memory, temperature and fan as rows, one block per GPU.',
    requiredPlugins: ['gpu'],
    capabilityPlugins: ['gpu'],
    sizes: tiers([1, 4], [1, 4], [2, 4]),
    configSchema: z.object({ gpus }),
  },

  processes: {
    type: 'processes',
    label: 'Processes',
    metric: 'processes',
    variant: 'table',
    description: 'The busiest processes, with a trend, a CPU bar and a count in the footer.',
    requiredPlugins: ['processlist', 'processcount'],
    capabilityPlugins: ['processlist'],
    sizes: tiers([1, 5], [1, 5], [2, 5]),
    configSchema: z.object({
      sort: z.enum(['cpu', 'memory', 'name']).default('cpu'),
      rows: z.number().int().min(5).max(50).default(20),
    }),
  },
  containers: {
    type: 'containers',
    label: 'Containers',
    metric: 'containers',
    variant: 'table',
    description: 'Every container, with its state, CPU, memory and traffic.',
    requiredPlugins: ['containers'],
    capabilityPlugins: ['containers'],
    sizes: tiers([2, 4], [2, 4], [3, 4]),
    configSchema: emptyConfig,
  },
  alerts: {
    type: 'alerts',
    label: 'Alerts',
    metric: 'alerts',
    variant: 'table',
    // The one cross-endpoint type: bound to no host, so it survives the deletion of any of them
    // and its plugins are pulled onto every endpoint rather than one (ref §4.4).
    scope: 'global',
    description: 'Warning and critical events from every endpoint, ongoing first.',
    requiredPlugins: ['alert'],
    capabilityPlugins: ['alert'],
    sizes: tiers([2, 4], [2, 4], [3, 4]),
    configSchema: z.object({
      includeResolved: z.boolean().default(true),
    }),
  },
};

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = Object.fromEntries(
  Object.values(WIDGET_SPECS).map((spec) => [
    spec.type,
    { ...spec, group: METRIC_DEFINITIONS[spec.metric].group, defaultSize: spec.sizes.regular },
  ]),
) as Record<WidgetType, WidgetDefinition>;

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && value in WIDGET_DEFINITIONS;
}

export function widgetDefinition(type: WidgetType): WidgetDefinition {
  return WIDGET_DEFINITIONS[type];
}

/** Every rendering of one metric, richest variant first. */
export function widgetsForMetric(metric: MetricId): WidgetDefinition[] {
  return Object.values(WIDGET_DEFINITIONS)
    .filter((definition) => definition.metric === metric)
    .sort((a, b) => WIDGET_VARIANTS.indexOf(a.variant) - WIDGET_VARIANTS.indexOf(b.variant));
}

/** Metrics in catalog order, for the picker's first screen. */
export function metricsByGroup(): { group: WidgetGroup; metrics: MetricDefinition[] }[] {
  return WIDGET_GROUPS.map((group) => ({
    group,
    metrics: Object.values(METRIC_DEFINITIONS).filter((metric) => metric.group === group),
  })).filter((entry) => entry.metrics.length > 0);
}

/**
 * Whether an endpoint can offer this widget.
 *
 * `capabilities` is what `/api/4/pluginslist` reported. **Unknown means available**: the probe may
 * simply not have answered yet, and greying out the whole catalog while waiting would be worse than
 * offering a widget that turns out to render "not available on this endpoint".
 */
export function isWidgetAvailable(type: WidgetType, capabilities: string[] | undefined): boolean {
  if (!capabilities || capabilities.length === 0) return true;
  return WIDGET_DEFINITIONS[type].capabilityPlugins.every((plugin) => capabilities.includes(plugin));
}

/**
 * Parse a stored config against its type's schema.
 *
 * Never throws, and **falls back per key**: one unreadable option reverts to its own default while
 * every other choice survives. Resetting the whole config because a single field went bad would
 * quietly undo settings the user made deliberately — the reference applies the same rule to stored
 * appearance, and the reasoning is identical (ref §7.6).
 *
 * A widget with the wrong options is recoverable — the user re-picks them — while a widget that
 * refuses to render is not, so the last resort is still the schema's defaults rather than a throw.
 */
export function parseWidgetConfig(type: WidgetType, config: unknown): Record<string, unknown> {
  const schema = WIDGET_DEFINITIONS[type].configSchema;
  const input: Record<string, unknown> =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};

  const result = schema.safeParse(input);
  if (result.success) return result.data;

  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') delete input[key];
  }
  const retry = schema.safeParse(input);
  if (retry.success) return retry.data;

  const fallback = schema.safeParse({});
  return fallback.success ? fallback.data : {};
}

/** What one widget row asks the poller to fetch. */
export function pluginsForWidget(type: WidgetType): PluginName[] {
  return WIDGET_DEFINITIONS[type].requiredPlugins;
}

/**
 * The plugin set one endpoint must poll, derived from the widget rows bound to it.
 *
 * This is the whole reason the catalog is data-only: the poller calls it, and must not import a
 * component to do so. A **global** widget contributes its plugins to *every* endpoint, because it
 * has no `endpointId` of its own to derive them from.
 */
export function pluginsForEndpoint(
  endpointId: string,
  widgets: readonly { type: string; endpointId: string | null }[],
): PluginName[] {
  const plugins = new Set<PluginName>();
  for (const widget of widgets) {
    if (!isWidgetType(widget.type)) continue;
    const definition = WIDGET_DEFINITIONS[widget.type];
    const isGlobal = definition.scope === 'global';
    if (!isGlobal && widget.endpointId !== endpointId) continue;
    for (const plugin of definition.requiredPlugins) plugins.add(plugin);
  }
  return [...plugins];
}

/**
 * The widest history window this endpoint's widgets ask for, in seconds, or `undefined` when none
 * of them keeps a series. The buffers floor and cap it.
 */
export function retentionSecForEndpoint(
  endpointId: string,
  widgets: readonly { type: string; endpointId: string | null; config: Record<string, unknown> }[],
): number | undefined {
  let widest: number | undefined;
  for (const widget of widgets) {
    if (!isWidgetType(widget.type)) continue;
    const isGlobal = WIDGET_DEFINITIONS[widget.type].scope === 'global';
    if (!isGlobal && widget.endpointId !== endpointId) continue;
    const requested = requestedWindowSec(widget.config);
    if (requested !== undefined) widest = Math.max(widest ?? 0, requested);
  }
  return widest;
}
