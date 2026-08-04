/**
 * Connects the poller to the stores, once, for the lifetime of the app.
 *
 * Deliberately **not** a hook and not owned by a screen. The poller keeps ring buffers and backoff
 * state that must outlive any particular view — binding it to a component's mount would restart
 * polling on every navigation and throw away the history a chart is drawing.
 *
 * The subscription is the whole wiring: the endpoints store is the source of truth for what should
 * be polled, so a change to it — added, edited, paused, deleted — reconciles the schedulers rather
 * than any call site having to remember to.
 */
import { useEndpointsStore } from '@/state/endpoints';
import { feedStore } from './feed-store';
import { watchVisibility } from './lifecycle';
import { poller, type PollerEndpoint } from './poller';

let started = false;

function toPollerEndpoints(): PollerEndpoint[] {
  return useEndpointsStore.getState().endpoints.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    pollIntervalMs: endpoint.pollIntervalMs,
    enabled: endpoint.enabled,
  }));
}

/**
 * Start polling. Idempotent — a second call is a no-op, so a Fast Refresh or a remount cannot end
 * up with two sets of schedulers racing each other.
 */
export function startPolling(): () => void {
  if (started) return () => undefined;
  started = true;

  const stopVisibility = watchVisibility(poller);

  const unsubscribe = useEndpointsStore.subscribe((state, previous) => {
    if (state.endpoints === previous.endpoints) return;

    // An endpoint that is gone takes its buffers and its status with it. Done here rather than in
    // the poller because eviction is a store concern: the scheduler only knows it should stop.
    const live = new Set(state.endpoints.map((endpoint) => endpoint.id));
    for (const endpoint of previous.endpoints) {
      if (!live.has(endpoint.id)) feedStore.getState().dropEndpoint(endpoint.id);
    }

    poller.sync(toPollerEndpoints());
  });

  poller.sync(toPollerEndpoints());

  return () => {
    started = false;
    unsubscribe();
    stopVisibility();
    poller.stopAll();
  };
}
