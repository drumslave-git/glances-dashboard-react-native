import type { GlancesMetricType, WidgetConfig, WidgetKind, WidgetSize } from '@/types/dashboard';

/** Glances serves every plugin under the same versioned prefix. */
export function metricToEndpoint(metric: GlancesMetricType): string {
  return `/api/4/${metric}`;
}

let widgetIdCounter = 1;

/** Reset the id counter so ids stay unique after rehydrating persisted widgets. */
export function setWidgetIdCounterFrom(widgets: { id: string }[]): void {
  const maxId = widgets.reduce((max, w) => {
    const match = /^w-(\d+)$/.exec(w.id);
    if (!match) return max;
    const num = Number.parseInt(match[1] ?? '0', 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  widgetIdCounter = maxId + 1;
}

/** Test seam — only for tests that need deterministic ids. */
export function resetWidgetIdCounter(): void {
  widgetIdCounter = 1;
}

export function nextWidgetId(): string {
  return `w-${widgetIdCounter++}`;
}

export function defaultWidgetTitle(kind: WidgetKind, metric: GlancesMetricType): string {
  switch (kind) {
    case 'processes':
      return 'Processes';
    case 'donut':
      return `${metric} (donut)`;
    case 'bar':
      return `${metric} (bar)`;
    case 'pie':
      return `${metric} (pie)`;
    case 'gauge':
      return `${metric} (gauge)`;
    case 'line':
      return `${metric} (line)`;
    default:
      return `${metric} (text)`;
  }
}

/** Process widgets always read the process list, whatever metric was picked. */
export function resolveMetricForKind(
  kind: WidgetKind,
  metric: GlancesMetricType,
): GlancesMetricType {
  return kind === 'processes' ? 'processlist' : metric;
}

export interface CreateWidgetInput {
  serverId: string;
  metric: GlancesMetricType;
  kind?: WidgetKind;
  title?: string;
  size?: WidgetSize;
  order?: number;
}

export function createWidget({
  serverId,
  metric,
  kind = 'text',
  title,
  size = 'M',
  order = 0,
}: CreateWidgetInput): WidgetConfig {
  const resolvedMetric = resolveMetricForKind(kind, metric);
  return {
    id: nextWidgetId(),
    serverId,
    title: title ?? defaultWidgetTitle(kind, resolvedMetric),
    kind,
    metric: resolvedMetric,
    endpointPath: metricToEndpoint(resolvedMetric),
    size,
    order,
  };
}
