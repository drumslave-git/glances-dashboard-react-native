import type { AccentName } from '@/theme/telemetry';
import type { TimeWindow } from '@/utils/sampleBuffer';

/**
 * Glances exposes its plugin list at runtime, so a metric is any plugin name
 * rather than a closed union.
 */
export type GlancesMetricType = string;

/**
 * A configured Glances endpoint. Widgets bind to one by id.
 *
 * "Endpoint" rather than "server" throughout, matching the reference and the vocabulary the UI
 * already used in its toolbar (ref §6).
 */
export interface GlancesEndpoint {
  id: string;
  name: string;
  /** Base URL, e.g. "http://192.168.1.10:61208". Stored without a trailing slash. */
  url: string;
  /**
   * Polling interval in milliseconds for the fast tier. Floored at 1000 by the poller, because the
   * server caches its own stats for a second and asking faster returns the same numbers.
   */
  pollIntervalMs: number;
  /**
   * Paused by the user. A disabled endpoint keeps its widgets on the board and shows them a
   * *distinct* state — telling "I turned this off" apart from "this host is down" is the whole
   * point, and conflating them would make a deliberate pause look like an outage.
   */
  enabled: boolean;
  /**
   * Accent, or `null` for none.
   *
   * `null` is a real default, not a missing value: with no accent the chip falls back to its
   * **status** colour, which is the more useful thing to show. An accent is what tells three
   * *healthy* hosts apart — so it colours a healthy chip only, and a failing one always wears its
   * state instead (ref §7.1).
   *
   * Stored as the accent's **name**, where the reference stores a hex restricted to its own
   * swatches. Same guarantee — an endpoint can only wear a colour the design already speaks — but
   * a name re-resolves on a theme switch, and this palette's light and dark values genuinely
   * differ. A stored hex would be right in one scheme and wrong in the other.
   */
  color: AccentName | null;
  /** Position in the endpoint roster and the settings list. */
  sortOrder: number;
  /** Epoch ms. */
  createdAt: number;
}

/**
 * A placed widget.
 *
 * Replaces the generic `WidgetConfig` (kind × metric × hand-picked fields) with the reference's
 * model: the **type** says what this is and how it is drawn, and `config` holds only that type's
 * own options, validated by its schema on read (ref §6).
 *
 * Geometry is `{x, y, w, h}` from the start even though M12's grid is still a wrap flow that reads
 * it as "sort by row, then column, and span `w`". Storing the final shape now means M15's free
 * drag-and-resize changes how the grid *renders*, not what it persists — one migration instead of
 * two, and this one already costs the user their board.
 */
export interface WidgetInstance {
  id: string;
  /** A `WidgetType` from the catalog. Kept as a string so a row of a retired type still parses. */
  type: string;
  /**
   * The host this widget reads from, or `null` for a **general** widget — one whose type reads
   * from every endpoint at once. A general widget survives the deletion of any single endpoint,
   * which is why it is not filed under one. The first arrives with the alerts feed in M14.
   */
  endpointId: string | null;
  /** Overrides the type's own label. `null` means use the label. */
  title: string | null;
  /** Per-type options. Opaque here; `parseWidgetConfig` is the only thing that interprets it. */
  config: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: number;
}

export interface DonutChartOptions {
  size?: number;
  thickness?: number;
  paddingAngle?: number;
  withLabels?: boolean;
}

/**
 * `gauge` and `line` arrived with the Telemetry redesign. They are the two
 * archetypes the design has that the generic kinds could not express: a ring
 * gauge reading one percentage, and a time series over sampled history.
 */
export type WidgetKind = 'text' | 'donut' | 'bar' | 'pie' | 'processes' | 'gauge' | 'line';

/**
 * Replaces the web app's free-form {x,y,w,h} grid position. Touch dragging a
 * 12-column grid is unpleasant, so widgets pick a size preset and are ordered.
 */
export type WidgetSize = 'S' | 'M' | 'L' | 'XL';

export interface WidgetConfig {
  id: string;
  /** Which server this widget reads from — the dashboard can mix machines. */
  serverId: string;
  title: string;
  kind: WidgetKind;
  metric: GlancesMetricType;
  /** Relative Glances API path, e.g. "/api/4/cpu". */
  endpointPath: string;
  /**
   * Top-level keys to display. When omitted or empty the whole payload is shown.
   */
  fields?: string[];
  /** Field name → hex colour. Missing fields get a deterministic default. */
  fieldColors?: Record<string, string>;
  /** Field name → formatter spec, e.g. "round(2)", "bytes", "truncate(10,end)". */
  fieldFormatters?: Record<string, string>;
  donutChartOptions?: DonutChartOptions;
  /** Label for the chart centre (donut). Supports {{field}} tokens. */
  chartLabel?: string;
  /** When one numeric field is a 0–100 percentage, split it into Used and Free. */
  splitPercentageIntoUsedFree?: boolean;
  size: WidgetSize;
  /** Position in the dashboard grid, ascending. */
  order: number;
  /**
   * How much history a `line` widget's chart covers, and what its time-window
   * state chip reads. Drives the sample count and the axis labels.
   */
  timeWindow?: TimeWindow;
  /** Which column a `processes` widget sorts by, descending. */
  processSort?: string;
}

/** Re-exported so `WidgetConfig` is readable without chasing the import. */
export type { TimeWindow } from '@/utils/sampleBuffer';
