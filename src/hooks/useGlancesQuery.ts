import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchGlances, GLANCES_ENDPOINTS } from '@/api/glances';
import type { GlancesEndpoint } from '@/types/dashboard';

export interface UseGlancesQueryOptions {
  /**
   * Poll interval override in ms. Defaults to the server's own pollIntervalMs.
   * 0 fetches once and then stops.
   */
  pollIntervalMs?: number;
  enabled?: boolean;
}

/**
 * The single way this app reads from Glances.
 *
 * The query key is [serverId, url, endpointPath], so several widgets pointing at
 * the same metric on the same server share one request instead of each polling.
 * The url is part of the key so that editing a server's address refetches at once
 * rather than serving the old address's cached result until the next poll.
 */
export function useGlancesQuery<T = unknown>(
  server: GlancesEndpoint | undefined,
  endpointPath: string | null | undefined,
  options: UseGlancesQueryOptions = {},
): UseQueryResult<T, Error> {
  const pollIntervalMs = options.pollIntervalMs ?? server?.pollIntervalMs ?? 0;
  // A paused endpoint means paused, everywhere. Until M12 moves the widgets onto the poller there
  // are two things fetching, and a Pause button that visibly stopped one while the other kept
  // going would be worse than no button at all.
  const enabled =
    (options.enabled ?? true) &&
    Boolean(server?.url) &&
    Boolean(endpointPath) &&
    server?.enabled !== false;

  return useQuery<T, Error>({
    queryKey: [server?.id ?? 'no-server', server?.url ?? '', endpointPath ?? 'no-endpoint'],
    queryFn: ({ signal }) => fetchGlances<T>(server!.url, endpointPath!, signal),
    enabled,
    refetchInterval: pollIntervalMs > 0 ? pollIntervalMs : false,
    // Polling replaces the data anyway; keeping the last payload avoids the
    // widget flashing an empty state on every tick.
    placeholderData: (previous) => previous,
  });
}

/** Available plugin names for the metric picker. */
export function usePluginsList(server: GlancesEndpoint | undefined) {
  return useGlancesQuery<string[]>(server, GLANCES_ENDPOINTS.pluginsList, { pollIntervalMs: 0 });
}

/** Hostname and distro for the dashboard header. */
export function useSystemInfo(server: GlancesEndpoint | undefined) {
  return useGlancesQuery<Record<string, unknown>>(server, GLANCES_ENDPOINTS.system, {
    pollIntervalMs: 10_000,
  });
}

/**
 * The summary strip's five live sources.
 *
 * Deliberately slower than the widgets: uptime, kernel and disk totals do not
 * change between polls, and the strip is chrome rather than telemetry. `enabled`
 * turns the requests off entirely when the strip is hidden, so a user who does
 * not want it does not pay for it.
 */
export function useSummarySources(server: GlancesEndpoint | undefined, enabled = true) {
  const options = { pollIntervalMs: enabled ? 15_000 : 0, enabled };
  return {
    system: useGlancesQuery<Record<string, unknown>>(server, GLANCES_ENDPOINTS.system, options).data,
    uptime: useGlancesQuery<unknown>(server, GLANCES_ENDPOINTS.uptime, options).data,
    load: useGlancesQuery<Record<string, unknown>>(server, GLANCES_ENDPOINTS.load, options).data,
    processCount: useGlancesQuery<Record<string, unknown>>(
      server,
      GLANCES_ENDPOINTS.processCount,
      options,
    ).data,
    fs: useGlancesQuery<unknown>(server, GLANCES_ENDPOINTS.fs, options).data,
  };
}
