import type { TimeWindow } from '@/utils/sampleBuffer';

/**
 * Glances exposes its plugin list at runtime, so a metric is any plugin name
 * rather than a closed union.
 */
export type GlancesMetricType = string;

/** A configured Glances server. Widgets bind to one by id. */
export interface GlancesServer {
  id: string;
  name: string;
  /** Base URL, e.g. "http://192.168.1.10:61208". Stored without a trailing slash. */
  url: string;
  /** Polling interval in milliseconds. 0 disables polling (fetch once). */
  refreshMs: number;
  /**
   * Index into the accent palette (lime → cyan → amber, cycling). Persisted with
   * the server so a machine keeps its colour across restarts and reorders — the
   * endpoint chip and the widget's accent tick are the only things on screen
   * saying which machine a number came from.
   */
  accentIndex: number;
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
