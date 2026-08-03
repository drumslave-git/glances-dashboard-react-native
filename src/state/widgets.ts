import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WidgetConfig, WidgetSize } from '@/types/dashboard';
import {
  createWidget,
  metricToEndpoint,
  resolveMetricForKind,
  setWidgetIdCounterFrom,
  type CreateWidgetInput,
} from '@/utils/widgetFactory';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

/**
 * Fields the config screen can change. `metric` and `kind` drive `endpointPath`,
 * so that is recomputed here rather than trusted from the caller.
 */
export type WidgetPatch = Partial<
  Pick<
    WidgetConfig,
    | 'serverId'
    | 'title'
    | 'metric'
    | 'fields'
    | 'fieldColors'
    | 'fieldFormatters'
    | 'donutChartOptions'
    | 'chartLabel'
    | 'splitPercentageIntoUsedFree'
    | 'size'
    | 'timeWindow'
    | 'processSort'
  >
>;

interface WidgetsState {
  widgets: WidgetConfig[];
  hasHydrated: boolean;
  addWidget: (input: Omit<CreateWidgetInput, 'order'>) => WidgetConfig;
  updateWidget: (id: string, patch: WidgetPatch) => void;
  removeWidget: (id: string) => void;
  setWidgetSize: (id: string, size: WidgetSize) => void;
  /** Persist a new order, e.g. after a drag. Ids not present are appended. */
  reorderWidgets: (orderedIds: string[]) => void;
  /** Drop widgets whose server no longer exists. */
  removeWidgetsForServer: (serverId: string) => void;
}

function withSequentialOrder(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets.map((widget, index) => ({ ...widget, order: index }));
}

export const useWidgetsStore = create<WidgetsState>()(
  persist(
    (set, get) => ({
      widgets: [],
      hasHydrated: false,

      addWidget: (input) => {
        const widget = createWidget({ ...input, order: get().widgets.length });
        set((state) => ({ widgets: [...state.widgets, widget] }));
        return widget;
      },

      updateWidget: (id, patch) => {
        set((state) => ({
          widgets: state.widgets.map((widget) => {
            if (widget.id !== id) return widget;
            const metric = resolveMetricForKind(widget.kind, patch.metric ?? widget.metric);
            return {
              ...widget,
              ...patch,
              metric,
              endpointPath: metricToEndpoint(metric),
            };
          }),
        }));
      },

      removeWidget: (id) => {
        set((state) => ({
          widgets: withSequentialOrder(state.widgets.filter((widget) => widget.id !== id)),
        }));
      },

      setWidgetSize: (id, size) => {
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id ? { ...widget, size } : widget,
          ),
        }));
      },

      reorderWidgets: (orderedIds) => {
        set((state) => {
          const byId = new Map(state.widgets.map((widget) => [widget.id, widget]));
          const ordered: WidgetConfig[] = [];
          for (const id of orderedIds) {
            const widget = byId.get(id);
            if (widget) {
              ordered.push(widget);
              byId.delete(id);
            }
          }
          // Anything the caller did not mention keeps its relative position at the end.
          return { widgets: withSequentialOrder([...ordered, ...byId.values()]) };
        });
      },

      removeWidgetsForServer: (serverId) => {
        set((state) => ({
          widgets: withSequentialOrder(
            state.widgets.filter((widget) => widget.serverId !== serverId),
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEYS.widgets,
      storage: asyncStorageJSON(),
      version: 1,
      partialize: (state) => ({ widgets: state.widgets }),
      onRehydrateStorage: () => (state) => {
        if (state) setWidgetIdCounterFrom(state.widgets);
        useWidgetsStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Widgets in display order. */
export function selectOrderedWidgets(state: Pick<WidgetsState, 'widgets'>): WidgetConfig[] {
  return [...state.widgets].sort((a, b) => a.order - b.order);
}
