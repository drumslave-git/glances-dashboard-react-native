/**
 * Per-field history, derived from the poller's ring buffers.
 *
 * This replaces M8's `useWidgetHistory`, which kept its own sample store fed from each widget's
 * query. There is now exactly one place samples live — `data/buffers.ts` — so a chart added to a
 * board that has been running for ten minutes draws ten minutes of history immediately, instead of
 * starting from empty because its own buffer had only just been created.
 *
 * The store is watched for a single number (the slice's tick counter) rather than for the samples
 * themselves: series data never enters the store, and a selector returning a fresh array would
 * re-render on every tick of every plugin (ref §7.2).
 */
import { useMemo } from 'react';

import { getBuffer, sliceKey } from '@/data/buffers';
import { useFeed } from '@/data/feed-store';
import type { PluginName } from '@/types/glances';
import type { Sample } from '@/utils/sampleBuffer';

/**
 * Samples of one derived number, oldest → newest.
 *
 * `select` runs over each stored plugin payload. Returning `null` drops that point rather than
 * plotting a zero — a field the host stopped reporting is a gap, not a crash to the floor.
 */
export function useSeries<T>(
  endpointId: string | null | undefined,
  plugin: PluginName,
  select: (value: T) => number | null,
): Sample[] {
  const seq = useFeed((state) =>
    endpointId ? (state.slices[sliceKey(endpointId, plugin)]?.seq ?? 0) : 0,
  );

  return useMemo(() => {
    if (!endpointId) return [];
    const buffer = getBuffer<T>(endpointId, plugin);
    if (!buffer) return [];
    const out: Sample[] = [];
    for (const sample of buffer.toArray()) {
      const value = select(sample.value);
      if (value !== null && Number.isFinite(value)) out.push({ t: sample.ts, v: value });
    }
    return out;
    // `seq` is not read here — it *is* the dependency. The samples are re-derived from the buffer,
    // so the tick counter is the only thing that can say the buffer moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointId, plugin, seq]);
}

/**
 * Several fields of one plugin at once, keyed for `SeriesPanel`.
 *
 * `selectors` should be a stable object — a fresh one each render only costs a rebuilt map, but it
 * costs one every render.
 */
export function useMultiSeries<T>(
  endpointId: string | null | undefined,
  plugin: PluginName,
  selectors: Record<string, (value: T) => number | null>,
): Record<string, Sample[]> {
  const seq = useFeed((state) =>
    endpointId ? (state.slices[sliceKey(endpointId, plugin)]?.seq ?? 0) : 0,
  );

  return useMemo(() => {
    const out: Record<string, Sample[]> = {};
    if (!endpointId) return out;
    const buffer = getBuffer<T>(endpointId, plugin);
    if (!buffer) return out;

    const samples = buffer.toArray();
    for (const [name, select] of Object.entries(selectors)) {
      const series: Sample[] = [];
      for (const sample of samples) {
        const value = select(sample.value);
        if (value !== null && Number.isFinite(value)) series.push({ t: sample.ts, v: value });
      }
      out[name] = series;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointId, plugin, selectors, seq]);
}
