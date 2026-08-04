import type { EndpointSnapshot, EndpointStatus, PluginName } from '@/types/glances';
import { resetBuffers } from './buffers';
import {
  DEFAULT_PLUGINS,
  HEAVY_TIER_MIN_MS,
  HIDDEN_TIER_MS,
  PollerService,
  SLOW_TIER_MS,
  STATIC_TIER_MS,
  type PollerClock,
  type PollerDeps,
  type PollerEndpoint,
} from './poller';
import type { HttpGet } from './transport';

/**
 * A hand-driven clock. `advance` runs every timer due within the span, one at a time, awaiting
 * microtasks between them — the poller reschedules from an async `.finally`, so a fake clock that
 * did not drain the microtask queue would never see the next timer registered.
 */
class FakeClock implements PollerClock {
  #now = 1_000_000;
  #seq = 0;
  #timers = new Map<number, { at: number; fn: () => void }>();

  now = (): number => this.#now;

  setTimeout = (fn: () => void, ms: number): number => {
    const id = ++this.#seq;
    this.#timers.set(id, { at: this.#now + Math.max(0, ms), fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.#timers.delete(handle as number);
  };

  get pending(): number {
    return this.#timers.size;
  }

  /** Run everything due up to `now + ms`, in time order. */
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    for (;;) {
      const due = [...this.#timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      this.#timers.delete(id);
      this.#now = Math.max(this.#now, timer.at);
      timer.fn();
      await flush();
    }
    this.#now = target;
  }
}

/** Let every pending promise settle. Several ticks, because the poller awaits a chain of them. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

const PROBE_ROUTES: Record<string, unknown> = {
  '/api/4/status': { version: '4.5.6' },
  '/api/4/pluginslist': ['cpu', 'mem', 'network', 'quicklook', 'processlist'],
  '/api/4/all/limits': { cpu: { cpu_total_warning: 75 } },
};

interface Harness {
  clock: FakeClock;
  deps: PollerDeps;
  service: PollerService;
  requests: string[];
  snapshots: EndpointSnapshot[];
  status: Map<string, Partial<EndpointStatus>>;
  /** Paths (not full urls) requested since the last call, probe traffic excluded. */
  takePolls: () => string[];
  fail: (failing: boolean) => void;
  /**
   * `sync` plus the first tick. Every tier is scheduled with a zero delay rather than run inline,
   * so the opening poll is a timer like any other and the fake clock has to reach it.
   */
  start: (endpoints: PollerEndpoint[]) => Promise<void>;
}

function harness(options: { plugins?: PluginName[]; retentionSec?: number } = {}): Harness {
  const clock = new FakeClock();
  const requests: string[] = [];
  const snapshots: EndpointSnapshot[] = [];
  const status = new Map<string, Partial<EndpointStatus>>();
  let failing = false;

  const get: HttpGet = async (url) => {
    requests.push(url);
    if (failing) throw new Error('Network request failed');
    const route = Object.keys(PROBE_ROUTES).find((suffix) => url.endsWith(suffix));
    if (route) return { status: 200, ok: true, text: JSON.stringify(PROBE_ROUTES[route]) };
    // Every plugin answers with something shaped enough to normalize.
    if (url.endsWith('/uptime')) return { status: 200, ok: true, text: JSON.stringify('1 day') };
    return { status: 200, ok: true, text: JSON.stringify({ total: 1, user: 1, system: 1, idle: 97 }) };
  };

  const deps: PollerDeps = {
    get,
    clock,
    resolvePlugins: () => options.plugins ?? [],
    resolveRetentionSec: () => options.retentionSec ?? 300,
    ingest: (snapshot) => snapshots.push(snapshot),
    patchStatus: (endpointId, patch) => status.set(endpointId, { ...status.get(endpointId), ...patch }),
    getStatus: (endpointId) => status.get(endpointId) as EndpointStatus | undefined,
  };

  let seen = 0;
  const service = new PollerService(deps);
  return {
    clock,
    deps,
    service,
    requests,
    snapshots,
    status,
    takePolls: () => {
      const fresh = requests.slice(seen).filter((url) => !Object.keys(PROBE_ROUTES).some((s) => url.endsWith(s)));
      seen = requests.length;
      return fresh.map((url) => url.replace('http://h/api/4/', ''));
    },
    fail: (value) => {
      failing = value;
    },
    start: async (endpoints) => {
      service.sync(endpoints);
      await clock.advance(0);
    },
  };
}

const endpoint = (over: Partial<PollerEndpoint> = {}): PollerEndpoint => ({
  id: 'e1',
  url: 'http://h',
  pollIntervalMs: 2000,
  enabled: true,
  ...over,
});

beforeEach(resetBuffers);

describe('plugin selection', () => {
  it('still polls something when no widget has asked for anything yet', async () => {
    // It cannot poll nothing: degraded and offline are derived from polls failing, so an endpoint
    // fetching nothing could never be noticed going down.
    const h = harness();
    await h.start([endpoint()]);
    expect(h.takePolls().sort()).toEqual([...DEFAULT_PLUGINS].sort());
    expect(DEFAULT_PLUGINS.length).toBeGreaterThan(0);
  });

  it('polls exactly what the placed widgets require, and nothing else', async () => {
    const h = harness({ plugins: ['cpu', 'sensors'] });
    await h.start([endpoint()]);
    expect(h.takePolls().sort()).toEqual(['cpu', 'sensors']);
  });

  it('slices the process list server-side', async () => {
    const h = harness({ plugins: ['processlist'] });
    await h.start([endpoint()]);
    expect(h.takePolls()).toEqual(['processlist/top/50']);
  });
});

describe('tiers', () => {
  it('gives each tier its own cadence', async () => {
    const h = harness({ plugins: ['cpu', 'processlist', 'fs', 'system'] });
    await h.start([endpoint({ pollIntervalMs: 2000 })]);
    expect(h.takePolls().sort()).toEqual(['cpu', 'fs', 'processlist/top/50', 'system']);

    // 2 s: only the fast tier is due.
    await h.clock.advance(2000);
    expect(h.takePolls()).toEqual(['cpu']);

    // 4 s: fast again, and the heavy tier reaches its 3 s floor.
    await h.clock.advance(2000);
    expect(h.takePolls().sort()).toEqual(['cpu', 'processlist/top/50']);
  });

  it('floors the heavy tier at 3 s even when the endpoint asks for 1 s', async () => {
    // Not a safety margin: polling faster makes Glances report 0% CPU for every process.
    const h = harness({ plugins: ['processlist'] });
    await h.start([endpoint({ pollIntervalMs: 1000 })]);
    h.takePolls();

    await h.clock.advance(HEAVY_TIER_MIN_MS - 1);
    expect(h.takePolls()).toEqual([]);
    await h.clock.advance(1);
    expect(h.takePolls()).toEqual(['processlist/top/50']);
  });

  it('lets a slower endpoint interval override the heavy floor upward', async () => {
    const h = harness({ plugins: ['processlist'] });
    await h.start([endpoint({ pollIntervalMs: 10_000 })]);
    h.takePolls();

    await h.clock.advance(HEAVY_TIER_MIN_MS);
    expect(h.takePolls()).toEqual([]);
    await h.clock.advance(10_000 - HEAVY_TIER_MIN_MS);
    expect(h.takePolls()).toEqual(['processlist/top/50']);
  });

  it('enforces the 1 s floor the server own stat cache implies', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint({ pollIntervalMs: 100 })]);
    h.takePolls();
    await h.clock.advance(999);
    expect(h.takePolls()).toEqual([]);
    await h.clock.advance(1);
    expect(h.takePolls()).toEqual(['cpu']);
  });

  it('holds slow and static plugins to their own cadences', async () => {
    const h = harness({ plugins: ['fs', 'system'] });
    await h.start([endpoint()]);
    h.takePolls();

    await h.clock.advance(SLOW_TIER_MS);
    expect(h.takePolls()).toEqual(['fs']);

    // Over the remaining 50 s the slow tier fires five more times and the static tier exactly once.
    await h.clock.advance(STATIC_TIER_MS - SLOW_TIER_MS);
    const polls = h.takePolls();
    expect(polls.filter((path) => path === 'fs')).toHaveLength(5);
    expect(polls.filter((path) => path === 'system')).toHaveLength(1);
  });

  it('schedules no timer for a tier with no plugins', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    // Only the fast tier should hold a timer.
    expect(h.clock.pending).toBe(1);
  });
});

describe('reacting to config changes', () => {
  it('fetches a newly required plugin immediately rather than at the next tier tick', async () => {
    // A Sensors widget added now must not sit empty for ten seconds.
    let plugins: PluginName[] = ['cpu'];
    const h = harness();
    h.deps.resolvePlugins = () => plugins;
    await h.start([endpoint()]);
    h.takePolls();

    plugins = ['cpu', 'sensors'];
    h.service.refreshPlugins();
    await flush();
    expect(h.takePolls()).toEqual(['sensors']);
  });

  it('restarts through connecting when the url changes', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.service.sync([endpoint({ url: 'http://other' })]);
    expect(h.status.get('e1')?.state).toBe('connecting');
    await flush();
    expect(h.requests.some((url) => url.startsWith('http://other'))).toBe(true);
  });

  it('stops polling a disabled endpoint and says so, distinctly from a failure', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.takePolls();

    h.service.sync([endpoint({ enabled: false })]);
    expect(h.status.get('e1')?.state).toBe('disabled');
    expect(h.service.activeEndpointIds()).toEqual([]);
    await h.clock.advance(60_000);
    expect(h.takePolls()).toEqual([]);
  });

  it('drops a removed endpoint scheduler', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.service.sync([]);
    expect(h.service.activeEndpointIds()).toEqual([]);
  });
});

describe('visibility', () => {
  it('drops every tier to a keep-warm cadence while hidden', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint({ pollIntervalMs: 2000 })]);
    h.takePolls();

    h.service.setHidden(true);
    await h.clock.advance(HIDDEN_TIER_MS - 1);
    expect(h.takePolls()).toEqual([]);
    await h.clock.advance(1);
    expect(h.takePolls()).toEqual(['cpu']);
  });

  it('polls immediately on becoming visible again', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.service.setHidden(true);
    h.takePolls();

    h.service.setHidden(false);
    await h.clock.advance(0);
    expect(h.takePolls()).toEqual(['cpu']);
  });
});

describe('failure handling', () => {
  it('walks degraded then offline, and backs off', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint({ pollIntervalMs: 2000 })]);
    h.fail(true);

    await h.clock.advance(2000);
    expect(h.status.get('e1')?.state).toBe('degraded');
    // Backoff starts at 2 s and doubles; the fast tier's own 2 s no longer applies.
    await h.clock.advance(2000);
    expect(h.status.get('e1')?.state).toBe('degraded');
    await h.clock.advance(4000);
    expect(h.status.get('e1')?.state).toBe('offline');
    expect(h.status.get('e1')?.lastError).toMatch(/consecutive failures/);
  });

  it('re-probes on recovery, because the server may have restarted differently', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.fail(true);
    await h.clock.advance(2000);
    expect(h.status.get('e1')?.state).toBe('degraded');

    h.fail(false);
    const before = h.requests.filter((url) => url.endsWith('/api/4/status')).length;
    await h.clock.advance(30_000);
    const after = h.requests.filter((url) => url.endsWith('/api/4/status')).length;
    expect(after).toBeGreaterThan(before);
    expect(h.status.get('e1')?.state).toBe('online');
  });

  it('treats a 404 on one plugin as a missing section, not a failed endpoint', async () => {
    // A plugin disabled server-side 404s while the endpoint itself is perfectly healthy.
    const h = harness({ plugins: ['cpu', 'gpu'] });
    h.deps.get = async (url) => {
      if (url.endsWith('/gpu')) return { status: 404, ok: false, text: '' };
      if (url.endsWith('/api/4/status')) return { status: 200, ok: true, text: '{"version":"4.5.6"}' };
      return { status: 200, ok: true, text: '{"total":1,"user":1,"system":1,"idle":97}' };
    };
    await h.start([endpoint()]);
    await h.clock.advance(2000);
    expect(h.status.get('e1')?.state).toBe('online');
    expect(h.snapshots.at(-1)?.plugins.cpu).toBeDefined();
    expect(h.snapshots.at(-1)?.plugins.gpu).toBeUndefined();
  });

  it('reports an unsupported version as terminal, not as an outage', async () => {
    const h = harness({ plugins: ['cpu'] });
    h.deps.get = async (url) => {
      if (url.endsWith('/api/4/status')) return { status: 200, ok: true, text: '{"version":"3.4.0"}' };
      return { status: 200, ok: true, text: '{}' };
    };
    await h.start([endpoint()]);
    expect(h.status.get('e1')?.state).toBe('unsupported-version');
  });

  it('records the capabilities and limits the probe found', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    expect(h.status.get('e1')?.capabilities).toContain('processlist');
    expect(h.status.get('e1')?.limits).toEqual({ cpu_total_warning: 75 });
  });
});

describe('snapshots', () => {
  it('emits one snapshot per tier run, carrying only that tier sections', async () => {
    const h = harness({ plugins: ['cpu', 'system'] });
    await h.start([endpoint()]);
    // The opening tick runs every tier, so it produces one snapshot per tier rather than one
    // combined snapshot — the fast one carries cpu, the static one carries system.
    expect(h.snapshots).toHaveLength(2);
    expect(h.snapshots.some((snapshot) => snapshot.plugins.cpu)).toBe(true);
    expect(h.snapshots.some((snapshot) => snapshot.plugins.system)).toBe(true);
    expect(h.snapshots.every((snapshot) => !(snapshot.plugins.cpu && snapshot.plugins.system))).toBe(true);

    await h.clock.advance(2000);
    const fast = h.snapshots.at(-1);
    expect(fast?.plugins.cpu).toBeDefined();
    expect(fast?.plugins.system).toBeUndefined();
  });

  it('stamps the snapshot with the clock, not the server', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    expect(h.snapshots[0].ts).toBe(h.clock.now());
  });
});

describe('preview plugins', () => {
  it('layers preview plugins on top and fetches them at once', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.takePolls();

    h.service.setPreview({ endpointId: 'e1', plugins: ['sensors'] });
    await flush();
    expect(h.takePolls()).toEqual(['sensors']);
  });

  it('clears them again, so a closed picker stops the extra polling', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.service.setPreview({ endpointId: 'e1', plugins: ['sensors'] });
    await flush();
    h.takePolls();

    h.service.setPreview({ endpointId: null, plugins: [] });
    await h.clock.advance(SLOW_TIER_MS * 2);
    expect(h.takePolls().filter((path) => path === 'sensors')).toEqual([]);
  });

  it('does not accumulate — the last request replaces the previous one', async () => {
    const h = harness({ plugins: ['cpu'] });
    await h.start([endpoint()]);
    h.service.setPreview({ endpointId: 'e1', plugins: ['sensors'] });
    await flush();
    h.service.setPreview({ endpointId: 'e1', plugins: ['fs'] });
    await flush();
    h.takePolls();

    await h.clock.advance(SLOW_TIER_MS);
    const polls = h.takePolls();
    expect(polls).toContain('fs');
    expect(polls).not.toContain('sensors');
  });
});
