import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchGlances, GLANCES_ENDPOINTS } from '@/api/glances';
import type { GlancesServer } from '@/types/dashboard';

export interface UseGlancesQueryOptions {
  /**
   * Poll interval override in ms. Defaults to the server's own refreshMs.
   * 0 fetches once and then stops.
   */
  refreshMs?: number;
  enabled?: boolean;
}

/**
 * The single way this app reads from Glances.
 *
 * The query key is [serverId, endpointPath], so several widgets pointing at the
 * same metric on the same server share one request instead of each polling.
 */
export function useGlancesQuery<T = unknown>(
  server: GlancesServer | undefined,
  endpointPath: string | null | undefined,
  options: UseGlancesQueryOptions = {},
): UseQueryResult<T, Error> {
  const refreshMs = options.refreshMs ?? server?.refreshMs ?? 0;
  const enabled = (options.enabled ?? true) && Boolean(server?.url) && Boolean(endpointPath);

  return useQuery<T, Error>({
    queryKey: [server?.id ?? 'no-server', endpointPath ?? 'no-endpoint'],
    queryFn: ({ signal }) => fetchGlances<T>(server!.url, endpointPath!, signal),
    enabled,
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    // Polling replaces the data anyway; keeping the last payload avoids the
    // widget flashing an empty state on every tick.
    placeholderData: (previous) => previous,
  });
}

/** Available plugin names for the metric picker. */
export function usePluginsList(server: GlancesServer | undefined) {
  return useGlancesQuery<string[]>(server, GLANCES_ENDPOINTS.pluginsList, { refreshMs: 0 });
}

/** Hostname and distro for the dashboard header. */
export function useSystemInfo(server: GlancesServer | undefined) {
  return useGlancesQuery<Record<string, unknown>>(server, GLANCES_ENDPOINTS.system, {
    refreshMs: 10_000,
  });
}
