import { useEffect } from 'react';

import { poller } from '@/data/poller';
import type { PluginName } from '@/types/glances';

/**
 * Ask the poller to fetch some plugins for as long as a screen is open (ref §4.4).
 *
 * The config screen's selection pickers list what an endpoint is *reporting*, and an endpoint only
 * reports what its placed widgets require — so configuring the first GPU widget on a host would
 * otherwise show "nothing reported yet" for the very list you are trying to choose from. That is
 * the exact hole the reference's `metrics:preview` fills, and the poller has supported it since
 * M10; this is what finally asks.
 *
 * Transient by construction: one slot in the poller, last request wins, cleared on unmount. A
 * standing request that could accumulate would mean an endpoint quietly polling `/gpu` forever
 * because a screen was closed the wrong way — and nothing persists it, so it cannot survive a
 * restart either.
 */
export function useMetricsPreview(endpointId: string | null, plugins: readonly PluginName[]): void {
  // Joined so a fresh array of the same names does not re-request on every render.
  const key = plugins.join(',');

  useEffect(() => {
    if (!endpointId || key === '') return;
    poller.setPreview({ endpointId, plugins: key.split(',') as PluginName[] });
    return () => poller.setPreview({ endpointId: null, plugins: [] });
  }, [endpointId, key]);
}
