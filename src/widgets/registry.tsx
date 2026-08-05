/**
 * The renderer half of the registry.
 *
 * `catalog.ts` says what a widget *is* — its metric, plugins, footprint and options — and imports
 * no React so the poller can read it. This half says how it *draws*, and is the only place a widget
 * type is mapped to a component. Adding a type touches its body plus one entry in each half.
 */
import type { ComponentType } from 'react';

import { CpuChartWidget, CpuGaugeWidget, CpuTextWidget, PerCpuTextWidget, PerCpuWidget } from './bodies/cpu';
import { LoadChartWidget, LoadTextWidget } from './bodies/load';
import { MemoryChartWidget, MemoryGaugeWidget, MemoryTextWidget } from './bodies/memory';
import {
  EndpointSummaryTextWidget,
  EndpointSummaryWidget,
  SystemInfoWidget,
} from './bodies/system';
import type { WidgetType } from './catalog';
import type { WidgetProps } from './types';

export interface WidgetRenderer {
  component: ComponentType<WidgetProps>;
  /**
   * The chips a widget contributes to its own header — the time window, the unit, the sort.
   *
   * They come from the widget rather than the frame because only the widget knows what qualifies
   * its own readout (ref §7.4). Optional: a text rendering registers none, having already said
   * which unit and which interface in its rows.
   */
  headerMeta?: ComponentType<WidgetProps>;
}

export const WIDGET_RENDERERS: Record<WidgetType, WidgetRenderer> = {
  cpu: { component: CpuChartWidget },
  cpuGauge: { component: CpuGaugeWidget },
  cpuText: { component: CpuTextWidget },
  percpu: { component: PerCpuWidget },
  percpuText: { component: PerCpuTextWidget },
  memory: { component: MemoryChartWidget },
  memoryGauge: { component: MemoryGaugeWidget },
  memoryText: { component: MemoryTextWidget },
  load: { component: LoadChartWidget },
  loadText: { component: LoadTextWidget },
  systemInfo: { component: SystemInfoWidget },
  endpointSummary: { component: EndpointSummaryWidget },
  endpointSummaryText: { component: EndpointSummaryTextWidget },
};

export function widgetRenderer(type: WidgetType): WidgetRenderer {
  return WIDGET_RENDERERS[type];
}
