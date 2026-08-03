import { create } from 'zustand';

import { pushSample, type Sample } from '@/utils/sampleBuffer';

/**
 * Live sample history, per server + endpoint + field.
 *
 * **Not persisted, by design** — the handoff keeps the reference app's behaviour
 * of memory-only history that resets on restart. Persisting it would mean
 * writing a few hundred numbers to AsyncStorage every five seconds for charts
 * that are only interesting while you are looking at them.
 */

interface HistoryState {
  series: Record<string, Sample[]>;
  /**
   * Record one poll. `at` should be the query's `dataUpdatedAt`, which is what
   * lets several widgets on the same endpoint report the same poll without
   * duplicating it — `pushSample` ignores anything not newer than the last.
   */
  record: (key: string, value: number, at: number) => void;
  /** Drop every series belonging to a server that was removed. */
  clearServer: (serverId: string) => void;
  /**
   * Keep only `keys` among the series starting with `prefix`.
   *
   * Per-process trend sparklines are keyed by PID, and PIDs churn — without this
   * the store would accumulate a series for every process that has ever appeared
   * in a table. Callers pass the rows they are actually showing, which bounds it
   * to the visible row count.
   */
  retainOnly: (prefix: string, keys: readonly string[]) => void;
  /** Test seam. */
  reset: () => void;
}

/** `serverId|endpointPath|field` — the field is last so a prefix match is by server. */
export function seriesKey(serverId: string, endpointPath: string, field: string): string {
  return `${serverId}|${endpointPath}|${field}`;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  series: {},

  record: (key, value, at) => {
    set((state) => {
      const next = pushSample(state.series[key], { t: at, v: value });
      // Same reference means the sample was a repeat: leave the store alone so
      // no subscriber re-renders.
      if (next === state.series[key]) return state;
      return { series: { ...state.series, [key]: next } };
    });
  },

  clearServer: (serverId) => {
    set((state) => {
      const prefix = `${serverId}|`;
      const entries = Object.entries(state.series).filter(([key]) => !key.startsWith(prefix));
      if (entries.length === Object.keys(state.series).length) return state;
      return { series: Object.fromEntries(entries) };
    });
  },

  retainOnly: (prefix, keys) => {
    set((state) => {
      const keep = new Set(keys);
      const entries = Object.entries(state.series).filter(
        ([key]) => !key.startsWith(prefix) || keep.has(key),
      );
      if (entries.length === Object.keys(state.series).length) return state;
      return { series: Object.fromEntries(entries) };
    });
  },

  reset: () => set({ series: {} }),
}));

/** Stable empty array, so a series with no samples yet does not loop the store. */
const EMPTY: Sample[] = [];

export function selectSeries(state: Pick<HistoryState, 'series'>, key: string): Sample[] {
  return state.series[key] ?? EMPTY;
}
