import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WidgetInstance } from '@/types/dashboard';
import type { GridItem } from '@/utils/gridLayout';
import { isWidgetType, parseWidgetConfig, widgetDefinition, type WidgetType } from '@/widgets/catalog';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

/** Whether a stored type belongs to no endpoint. An unknown type is treated as endpoint-scoped. */
const isGlobalWidgetType = (type: string): boolean =>
  isWidgetType(type) && widgetDefinition(type).scope === 'global';

export interface AddWidgetInput {
  type: WidgetType;
  /** `null` only for a widget whose type is `global`. */
  endpointId: string | null;
  title?: string | null;
  config?: Record<string, unknown>;
  /** Footprint; defaults to the type's `regular` tier. */
  w?: number;
  h?: number;
}

/** What the config screen may change. Geometry moves through `applyLayout`. */
export type WidgetPatch = Partial<
  Pick<WidgetInstance, 'endpointId' | 'title' | 'config' | 'appearance'>
>;

interface WidgetsState {
  widgets: WidgetInstance[];
  hasHydrated: boolean;
  addWidget: (input: AddWidgetInput) => WidgetInstance;
  updateWidget: (id: string, patch: WidgetPatch) => void;
  removeWidget: (id: string) => void;
  /**
   * Commit a whole layout — the grid is the only thing entitled to write geometry, because every
   * drag and every resize moves more than the widget under the finger.
   */
  applyLayout: (items: readonly GridItem[]) => void;
  /** Drop widgets bound to a removed endpoint. General widgets survive it. */
  removeWidgetsForEndpoint: (endpointId: string) => void;
}

let widgetIdCounter = 1;

function nextWidgetId(): string {
  return `w-${widgetIdCounter++}`;
}

function syncWidgetIdCounter(widgets: { id: string }[]): void {
  const maxId = widgets.reduce((max, widget) => {
    const match = /^w-(\d+)$/.exec(widget.id);
    if (!match) return max;
    const num = Number.parseInt(match[1] ?? '0', 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  widgetIdCounter = maxId + 1;
}

/** Test seam. */
export function resetWidgetIdCounter(): void {
  widgetIdCounter = 1;
}

/**
 * Where a new widget lands: the bottom of the board, in the first column.
 *
 * The grid's vertical gravity then lifts it into the first slot that fits, which is what makes this
 * "the first free slot" without the store having to know how many columns the window currently has
 * — a fact about the *viewport*, which no persisted record should depend on.
 */
function bottomRow(widgets: readonly WidgetInstance[]): number {
  return widgets.reduce((bottom, widget) => Math.max(bottom, widget.y + widget.h), 0);
}

type PersistedWidgets = { widgets: WidgetInstance[] };

/**
 * v1 → v2: **every stored widget is dropped.**
 *
 * There is no honest mapping from the generic model — `{ kind: 'donut', metric: 'mem', fields: [...] }`
 * — onto a typed catalog entry. A donut over two hand-picked fields is not a Memory gauge; guessing
 * would hand the user a board that looks like theirs and reads differently, which is worse than an
 * empty one they rebuild deliberately. Confirmed with the owner, and "no migration" has been the
 * plan's position since §1.
 *
 * Exported and tested because dropping user data on purpose still has to be *only* what was
 * intended: a v2 store must pass through untouched.
 */
export function migrateWidgets(persisted: unknown, version: number): PersistedWidgets {
  const state = (persisted ?? {}) as Partial<PersistedWidgets>;
  if (version >= 2) {
    const rows = Array.isArray(state.widgets) ? state.widgets : [];
    return { widgets: rows };
  }
  return { widgets: [] };
}

export const useWidgetsStore = create<WidgetsState>()(
  persist(
    (set, get) => ({
      widgets: [],
      hasHydrated: false,

      addWidget: (input) => {
        const definition = widgetDefinition(input.type);
        const widget: WidgetInstance = {
          id: nextWidgetId(),
          type: input.type,
          endpointId: definition.scope === 'global' ? null : input.endpointId,
          title: input.title ?? null,
          // Parsed on the way in as well as on the way out, so a widget is never stored with
          // options its own schema would reject.
          config: parseWidgetConfig(input.type, input.config ?? {}),
          // `null` is "inherit the board", which is what a new widget always wants.
          appearance: null,
          x: 0,
          y: bottomRow(get().widgets),
          w: input.w ?? definition.defaultSize.w,
          h: input.h ?? definition.defaultSize.h,
          createdAt: Date.now(),
        };
        set((state) => ({ widgets: [...state.widgets, widget] }));
        return widget;
      },

      updateWidget: (id, patch) => {
        set((state) => ({
          widgets: state.widgets.map((widget) => {
            if (widget.id !== id) return widget;
            const next = { ...widget, ...patch };
            if (patch.config !== undefined && isWidgetType(widget.type)) {
              next.config = parseWidgetConfig(widget.type, patch.config);
            }
            return next;
          }),
        }));
      },

      // The hole a removal leaves is not filled here: gravity is the grid's, and it runs on every
      // render. Rewriting the survivors' rows from a store that cannot see the window would fight
      // it — and would turn a delete on a phone into a re-layout of the desktop board.
      removeWidget: (id) => {
        set((state) => ({ widgets: state.widgets.filter((widget) => widget.id !== id) }));
      },

      applyLayout: (items) => {
        const byId = new Map(items.map((item) => [item.id, item]));
        set((state) => ({
          widgets: state.widgets.map((widget) => {
            const placement = byId.get(widget.id);
            if (!placement) return widget;
            const { x, y, w, h } = placement;
            return widget.x === x && widget.y === y && widget.w === w && widget.h === h
              ? widget
              : { ...widget, x, y, w, h };
          }),
        }));
      },

      removeWidgetsForEndpoint: (endpointId) => {
        set((state) => ({
          widgets: state.widgets.filter(
            (widget) =>
              // `endpointId === null` is a general widget, which belongs to no host and outlives
              // the deletion of any of them. The *type* is checked as well, so a record written
              // before the config screen stopped offering an endpoint for a global widget is not
              // collateral damage — the scope is the authority, not what happens to be stored.
              widget.endpointId !== endpointId || isGlobalWidgetType(widget.type),
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEYS.widgets,
      storage: asyncStorageJSON(),
      version: 2,
      migrate: migrateWidgets,
      partialize: (state) => ({ widgets: state.widgets }),
      onRehydrateStorage: () => (state) => {
        if (state) syncWidgetIdCounter(state.widgets);
        useWidgetsStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Widgets in reading order: top row first, then left to right. */
export function selectOrderedWidgets(state: Pick<WidgetsState, 'widgets'>): WidgetInstance[] {
  return [...state.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
}
