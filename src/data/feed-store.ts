/**
 * The coordination layer between the ring buffers and the widgets (ref §7.2).
 *
 * The store holds only tiny per-slice objects — a monotonic `seq` and the latest value. **Series
 * data never enters it.** Two ways to read, and picking the right one is the whole point:
 *
 * - **Chart widgets** subscribe transiently to `seq` (`subscribeToSlice`) and push straight into
 *   their canvas, so a tick costs zero React re-renders.
 * - **Stat and table widgets** use ordinary selector hooks (`useLatest`) and re-render only when
 *   *their own* slice ticks, because selector equality keeps the other slices inert.
 *
 * Endpoint status lives here too. In the reference it is main-process state pushed over IPC; here
 * there is no process boundary, so the poller writes it directly and widgets read it the same way
 * they read data.
 */
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { EndpointSnapshot, EndpointState, EndpointStatus, PluginName } from '@/types/glances';
import { evictEndpoint, pushSnapshot, sliceKey, type SliceKey } from './buffers';

export interface SliceState {
  seq: number;
  latest: unknown;
  /** Client receive time of `latest`. */
  ts: number;
}

interface FeedState {
  slices: Record<SliceKey, SliceState>;
  endpointStatus: Record<string, EndpointStatus>;
  ingest: (snapshot: EndpointSnapshot) => void;
  patchStatus: (endpointId: string, patch: Partial<Omit<EndpointStatus, 'endpointId'>>) => void;
  dropEndpoint: (endpointId: string) => void;
  reset: () => void;
}

export const feedStore = createStore<FeedState>()(
  subscribeWithSelector((set) => ({
    slices: {},
    endpointStatus: {},

    ingest(snapshot) {
      const touched = pushSnapshot(snapshot.endpointId, snapshot.ts, snapshot.plugins);
      if (touched.length === 0) return;
      set((state) => {
        const slices = { ...state.slices };
        for (const key of touched) {
          // The plugin name is everything after the first colon; endpoint ids may contain none,
          // but slicing from the first is what keeps this correct if one ever does.
          const plugin = key.slice(key.indexOf(':') + 1) as PluginName;
          slices[key] = {
            seq: (state.slices[key]?.seq ?? 0) + 1,
            latest: snapshot.plugins[plugin],
            ts: snapshot.ts,
          };
        }
        return { slices };
      });
    },

    patchStatus(endpointId, patch) {
      set((state) => {
        const previous = state.endpointStatus[endpointId];
        const next: EndpointStatus = {
          ...(previous ?? { endpointId, state: 'connecting' as const }),
          ...patch,
          endpointId,
        };
        // Bail out when nothing moved, so a steady online endpoint does not re-render its chip on
        // every successful poll.
        if (
          previous &&
          previous.state === next.state &&
          previous.lastError === next.lastError &&
          previous.glancesVersion === next.glancesVersion &&
          previous.capabilities === next.capabilities &&
          previous.limits === next.limits &&
          previous.lastSuccessAt === next.lastSuccessAt
        ) {
          return state;
        }
        return { endpointStatus: { ...state.endpointStatus, [endpointId]: next } };
      });
    },

    dropEndpoint(endpointId) {
      evictEndpoint(endpointId);
      set((state) => {
        const endpointStatus = { ...state.endpointStatus };
        delete endpointStatus[endpointId];
        return {
          slices: Object.fromEntries(
            Object.entries(state.slices).filter(([key]) => !key.startsWith(`${endpointId}:`)),
          ) as Record<SliceKey, SliceState>,
          endpointStatus,
        };
      });
    },

    reset() {
      set({ slices: {}, endpointStatus: {} });
    },
  })),
);

export function useFeed<T>(selector: (state: FeedState) => T): T {
  return useStore(feedStore, selector);
}

/** Latest value for one slice, typed by the caller. Re-renders only when that slice ticks. */
export function useLatest<T>(endpointId: string | null | undefined, plugin: PluginName): T | undefined {
  return useFeed((state) =>
    endpointId ? (state.slices[sliceKey(endpointId, plugin)]?.latest as T | undefined) : undefined,
  );
}

/**
 * The same, across several endpoints at once — what a **global** widget reads. Endpoints that have
 * not reported this plugin yet are simply absent from the map.
 *
 * What the store is watched for is a single number, not a map: a selector building a fresh `Map`
 * would compare unequal every time *any* slice ticked, so a cross-endpoint widget would re-render
 * on every sample of every plugin on every host. The sum of just these slices' counters changes
 * exactly when one of them receives a sample, and nothing else does.
 *
 * `endpointIds` should be memoized by the caller — a fresh array only costs a rebuilt map, but it
 * costs one on every render.
 */
export function useLatestByEndpoint<T>(endpointIds: string[], plugin: PluginName): Map<string, T> {
  const seq = useFeed((state) =>
    endpointIds.reduce((sum, id) => sum + (state.slices[sliceKey(id, plugin)]?.seq ?? 0), 0),
  );
  return useMemo(() => {
    const { slices } = feedStore.getState();
    const latest = new Map<string, T>();
    for (const id of endpointIds) {
      const value = slices[sliceKey(id, plugin)]?.latest as T | undefined;
      if (value !== undefined) latest.set(id, value);
    }
    return latest;
    // `seq` is not read inside — it *is* the dependency. The map is rebuilt from the store's
    // current state, so the counter is the only thing that can tell us the state moved. Dropping
    // it, as the rule suggests, would freeze a cross-endpoint widget on its first sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointIds, plugin, seq]);
}

export function useEndpointStatus(endpointId: string | null | undefined): EndpointStatus | undefined {
  return useFeed((state) => (endpointId ? state.endpointStatus[endpointId] : undefined));
}

/** Convenience for the many places that only care whether data can be trusted right now. */
export function endpointStateOf(endpointId: string): EndpointState {
  return feedStore.getState().endpointStatus[endpointId]?.state ?? 'connecting';
}

/** Tick counter for one slice — the value chart widgets subscribe to. */
export function sliceSeq(endpointId: string, plugin: PluginName): number {
  return feedStore.getState().slices[sliceKey(endpointId, plugin)]?.seq ?? 0;
}

/**
 * Transient subscription for chart widgets: fires on every tick of one slice without involving
 * React. Returns an unsubscribe function.
 */
export function subscribeToSlice(
  endpointId: string,
  plugin: PluginName,
  listener: (slice: SliceState) => void,
): () => void {
  const key = sliceKey(endpointId, plugin);
  return feedStore.subscribe(
    (state) => state.slices[key]?.seq ?? 0,
    (seq) => {
      if (seq === 0) return;
      const slice = feedStore.getState().slices[key];
      if (slice) listener(slice);
    },
  );
}
