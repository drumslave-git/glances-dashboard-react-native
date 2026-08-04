import { useEndpointStatus } from '@/data/feed-store';
import type { GlancesEndpoint } from '@/types/dashboard';
import type { EndpointState } from '@/types/glances';

/**
 * The state to draw an endpoint in.
 *
 * Two sources have to agree and only one of them is the poller. `enabled` is **config** — the user
 * has just flipped a switch and expects the chip to say so immediately, before any scheduler has
 * stopped or any status has been written. So config wins here, and the poller's own `disabled`
 * write is the same answer arriving a moment later rather than the authority.
 *
 * With no status at all — first launch, or an endpoint added seconds ago — `connecting` is the
 * honest answer. `online` would be a guess, and `offline` would be an accusation.
 */
export function useEndpointState(endpoint: GlancesEndpoint | undefined): EndpointState {
  const status = useEndpointStatus(endpoint?.id);
  if (!endpoint) return 'connecting';
  if (!endpoint.enabled) return 'disabled';
  return status?.state ?? 'connecting';
}
