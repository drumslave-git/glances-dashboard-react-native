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
}

export interface DonutChartOptions {
  size?: number;
  thickness?: number;
  paddingAngle?: number;
  withLabels?: boolean;
}

export type WidgetKind = 'text' | 'donut' | 'bar' | 'pie' | 'processes';

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
}
