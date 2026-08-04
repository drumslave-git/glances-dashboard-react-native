/**
 * One scheduler per enabled endpoint (ref §4.4) — the port of the reference's main-process poller.
 *
 * The reference runs this in Electron's main process because `net.fetch` there is outside CORS, is
 * not gated on private-IP requests, and is not throttled when the window hides. React Native has no
 * such process, so the same properties are reached differently: the transport seam
 * (`transport.ts`) escapes CORS on the platforms where it can, and `setHidden` replaces the
 * window-lifecycle hooks. Everything else — the tiers, the backoff, the plugin derivation — is the
 * same design, and is deliberately platform-free so it can be unit-tested against a fake clock.
 */
import type { EndpointSnapshot, EndpointStatus, PluginName, SnapshotPlugins } from '@/types/glances';
import { PLUGIN_SPECS, type PollTier } from './normalize';
import { apiUrl, probeEndpoint } from './probe';
import { httpGet, type HttpGet } from './transport';
import { feedStore } from './feed-store';
import { capacityFor, setEndpointCapacity } from './buffers';

/**
 * Floor for the process and container plugins.
 *
 * Measured by the reference against Glances 4.5.5, and not a safety margin: polling `/processlist`
 * every 1 s makes the server report `cpu_percent: 0` for **every** process from the third poll
 * onward, and `processcount` starts returning nonsense (`sleeping` flipping between 373, 1 and 0).
 * At 2 s it is still mostly broken; at 3 s both are stable. Glances derives per-process CPU across
 * its own refresh interval, so asking faster leaves it no interval to measure.
 */
export const HEAVY_TIER_MIN_MS = 3000;
export const SLOW_TIER_MS = 10_000;
export const STATIC_TIER_MS = 60_000;
/** Cheap keep-warm cadence for every tier while the app is hidden or backgrounded. */
export const HIDDEN_TIER_MS = 30_000;
/** The server caches stats for `cached_time` (1 s by default); polling faster returns the same data. */
export const MIN_POLL_INTERVAL_MS = 1000;
export const DEFAULT_POLL_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 5000;

const BACKOFF_START_MS = 2000;
const BACKOFF_MAX_MS = 30_000;
/** 1–2 consecutive failures read as `degraded`; 3+ as `offline` (ref §9). */
const OFFLINE_AFTER_FAILURES = 3;

/**
 * What an endpoint with nothing asking for anything still polls.
 *
 * It has to be *something*: `degraded` and `offline` are derived from polls failing, so an endpoint
 * that fetched nothing could never be noticed going down — the probe only runs at connect.
 *
 * `quicklook` alone, because it is the most informative single request Glances offers: cpu, memory,
 * swap and load in one payload. The reference bootstraps with four plugins here, but it has no
 * second polling mechanism running beside it; until M12 retires `useGlancesQuery`, every extra
 * plugin in this list is a request to someone's server that nothing on screen displays.
 */
export const DEFAULT_PLUGINS: PluginName[] = ['quicklook'];

const TIERS: PollTier[] = ['fast', 'heavy', 'slow', 'static'];

/**
 * The endpoint fields the poller needs, structurally — not the persisted `GlancesEndpoint` (M11).
 * Keeping it minimal means the store's shape can grow without touching the scheduler.
 */
export interface PollerEndpoint {
  id: string;
  url: string;
  pollIntervalMs: number;
  enabled: boolean;
}

export type TimerHandle = unknown;

/** Injectable so tests drive time by hand instead of waiting for it. */
export interface PollerClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}

export const systemClock: PollerClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

type PatchStatus = (
  endpointId: string,
  patch: Partial<Omit<EndpointStatus, 'endpointId'>>,
) => void;

export interface PollerDeps {
  get: HttpGet;
  clock: PollerClock;
  /** Which plugins this endpoint's placed widgets require. Empty falls back to `DEFAULT_PLUGINS`. */
  resolvePlugins: (endpointId: string) => PluginName[];
  /** The widest history window this endpoint's widgets ask for, in seconds. */
  resolveRetentionSec: (endpointId: string) => number;
  ingest: (snapshot: EndpointSnapshot) => void;
  patchStatus: PatchStatus;
  /** Read back what was last written — `#onSuccess` needs to know what it is about to overwrite. */
  getStatus: (endpointId: string) => EndpointStatus | undefined;
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
}

class EndpointPoller {
  #endpoint: PollerEndpoint;
  #plugins: PluginName[];
  readonly #deps: PollerDeps;
  readonly #timers = new Map<PollTier, TimerHandle>();
  /** Guards against overlapping runs when a tier is slower than its own interval. */
  readonly #inFlight = new Set<PollTier>();
  #consecutiveFailures = 0;
  #backoffMs = 0;
  #hidden = false;
  #stopped = false;
  /** Plugins something is previewing right now, on top of what the placed widgets need. */
  #preview: PluginName[] = [];

  constructor(endpoint: PollerEndpoint, deps: PollerDeps) {
    this.#endpoint = endpoint;
    this.#deps = deps;
    this.#plugins = this.#resolvePlugins();
    this.#applyCapacity();
  }

  get endpointId(): string {
    return this.#endpoint.id;
  }

  #resolvePlugins(): PluginName[] {
    const fromWidgets = this.#deps.resolvePlugins(this.#endpoint.id);
    const base = fromWidgets.length > 0 ? fromWidgets : DEFAULT_PLUGINS;
    return [...new Set([...base, ...this.#preview])];
  }

  #applyCapacity(): void {
    const retentionSec = this.#deps.resolveRetentionSec(this.#endpoint.id);
    setEndpointCapacity(this.#endpoint.id, capacityFor(this.#pollIntervalMs, retentionSec));
  }

  get #pollIntervalMs(): number {
    return Math.max(MIN_POLL_INTERVAL_MS, this.#endpoint.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
  }

  /**
   * Add (or drop) the plugins a preview needs. Transient by construction — nothing persists it, so
   * closing the picker returns the endpoint to exactly the set its widgets justify.
   */
  setPreviewPlugins(plugins: PluginName[]): void {
    const same =
      plugins.length === this.#preview.length && plugins.every((plugin) => this.#preview.includes(plugin));
    if (same) return;
    this.#preview = [...plugins];
    // `update` fetches whatever is newly required immediately — a preview that filled in on the
    // next slow-tier tick would be ten seconds of "waiting for data".
    this.refreshPlugins();
  }

  #pluginsForTier(tier: PollTier): PluginName[] {
    return this.#plugins.filter((plugin) => PLUGIN_SPECS[plugin].tier === tier);
  }

  #intervalFor(tier: PollTier): number {
    if (this.#hidden) return HIDDEN_TIER_MS;
    if (this.#backoffMs > 0) return Math.max(this.#backoffMs, this.#baseInterval(tier));
    return this.#baseInterval(tier);
  }

  #baseInterval(tier: PollTier): number {
    switch (tier) {
      case 'fast':
        return this.#pollIntervalMs;
      // Never faster than the heavy floor, but a slower endpoint interval still wins.
      case 'heavy':
        return Math.max(HEAVY_TIER_MIN_MS, this.#pollIntervalMs);
      case 'slow':
        return SLOW_TIER_MS;
      case 'static':
        return STATIC_TIER_MS;
    }
  }

  start(): void {
    this.#stopped = false;
    this.#deps.patchStatus(this.#endpoint.id, { state: 'connecting', lastError: undefined });
    void this.#probe();
    for (const tier of TIERS) this.#schedule(tier, 0);
  }

  stop(): void {
    this.#stopped = true;
    for (const timer of this.#timers.values()) this.#deps.clock.clearTimeout(timer);
    this.#timers.clear();
  }

  /**
   * Apply a config change in place. A changed URL restarts through `connecting`; a changed plugin
   * set fetches the newly required plugins immediately, so a freshly added Sensors widget does not
   * sit empty for a whole tier interval.
   */
  update(endpoint: PollerEndpoint): void {
    const urlChanged = endpoint.url !== this.#endpoint.url;
    const previous = new Set(this.#plugins);
    this.#endpoint = endpoint;
    this.#plugins = this.#resolvePlugins();
    this.#applyCapacity();

    if (urlChanged) {
      this.stop();
      this.#consecutiveFailures = 0;
      this.#backoffMs = 0;
      this.start();
      return;
    }

    const gained = this.#plugins.filter((plugin) => !previous.has(plugin));
    if (gained.length > 0) void this.#run('fast', gained);
    for (const tier of TIERS) this.#schedule(tier, this.#intervalFor(tier));
  }

  refreshPlugins(): void {
    this.update(this.#endpoint);
  }

  setHidden(hidden: boolean): void {
    if (this.#hidden === hidden) return;
    this.#hidden = hidden;
    // Becoming visible fires an immediate poll, so the user never watches a stale board fill in.
    for (const tier of TIERS) this.#schedule(tier, hidden ? this.#intervalFor(tier) : 0);
  }

  async #probe(): Promise<void> {
    const result = await probeEndpoint(this.#endpoint.url, this.#deps.get);
    if (this.#stopped) return;
    if (result.ok) {
      this.#deps.patchStatus(this.#endpoint.id, {
        state: 'online',
        lastError: undefined,
        glancesVersion: result.glancesVersion,
        capabilities: result.capabilities,
        limits: result.limits,
      });
      return;
    }
    this.#deps.patchStatus(this.#endpoint.id, {
      // A version we cannot speak is a terminal state, not a transient failure — retrying would
      // never help and the chip must not pretend otherwise.
      state: result.reason === 'unsupported-version' ? 'unsupported-version' : 'offline',
      lastError: result.message,
    });
  }

  #schedule(tier: PollTier, delay: number): void {
    if (this.#stopped) return;
    const existing = this.#timers.get(tier);
    if (existing !== undefined) this.#deps.clock.clearTimeout(existing);
    if (this.#pluginsForTier(tier).length === 0) {
      this.#timers.delete(tier);
      return;
    }

    this.#timers.set(
      tier,
      this.#deps.clock.setTimeout(() => {
        void this.#run(tier).finally(() => this.#schedule(tier, this.#intervalFor(tier)));
      }, delay),
    );
  }

  /** Fetch and normalize one plugin. Returns `false` only when the request itself failed. */
  async #fetchPlugin(plugin: PluginName, target: SnapshotPlugins): Promise<boolean> {
    const spec = PLUGIN_SPECS[plugin];
    try {
      const response = await this.#deps.get(apiUrl(this.#endpoint.url, spec.path), timeoutSignal());
      if (!response.ok) {
        // A plugin disabled server-side 404s while the endpoint itself is perfectly healthy —
        // that is a missing section, not a connection failure (ref §9).
        return response.status === 404 || response.status === 501;
      }
      spec.apply(target, JSON.parse(response.text));
      return true;
    } catch {
      return false;
    }
  }

  async #run(tier: PollTier, only?: PluginName[]): Promise<void> {
    if (this.#stopped || this.#inFlight.has(tier)) return;
    const plugins = only ?? this.#pluginsForTier(tier);
    if (plugins.length === 0) return;

    this.#inFlight.add(tier);
    try {
      const target: SnapshotPlugins = {};
      // Parallel per-plugin GETs: each endpoint is tiny and refreshes only its own plugin
      // server-side, unlike `/all` (ref §4.4).
      const results = await Promise.all(plugins.map((plugin) => this.#fetchPlugin(plugin, target)));
      if (this.#stopped) return;

      if (results.every((ok) => !ok)) {
        this.#onFailure();
        return;
      }
      this.#onSuccess();

      this.#deps.ingest({ endpointId: this.#endpoint.id, ts: this.#deps.clock.now(), plugins: target });
    } finally {
      this.#inFlight.delete(tier);
    }
  }

  #onSuccess(): void {
    const wasFailing = this.#consecutiveFailures > 0;
    this.#consecutiveFailures = 0;
    this.#backoffMs = 0;
    const previous = this.#deps.getStatus(this.#endpoint.id);

    // A version we cannot speak is terminal. A plugin request that happens to succeed against such
    // a server must not promote it to `online` — the probe is the only thing entitled to decide
    // whether this endpoint is usable at all, and it has already decided.
    if (previous?.state === 'unsupported-version') return;

    if (wasFailing || previous?.state !== 'online') {
      // Coming back, or arriving for the first time, re-probes rather than just flipping the chip:
      // the server may have restarted with a different plugin set or version, and stale
      // capabilities would mis-filter the catalog. Only a probe that has already reported
      // capabilities lets us skip it.
      if (wasFailing || !previous?.capabilities) {
        void this.#probe();
        return;
      }
      this.#deps.patchStatus(this.#endpoint.id, {
        state: 'online',
        lastError: undefined,
        lastSuccessAt: this.#deps.clock.now(),
      });
      return;
    }
    this.#deps.patchStatus(this.#endpoint.id, { lastSuccessAt: this.#deps.clock.now() });
  }

  #onFailure(): void {
    this.#consecutiveFailures += 1;
    this.#backoffMs = this.#backoffMs === 0 ? BACKOFF_START_MS : Math.min(BACKOFF_MAX_MS, this.#backoffMs * 2);
    this.#deps.patchStatus(this.#endpoint.id, {
      state: this.#consecutiveFailures >= OFFLINE_AFTER_FAILURES ? 'offline' : 'degraded',
      lastError: `No response from ${this.#endpoint.url} (${this.#consecutiveFailures} consecutive failures).`,
    });
  }
}

/** One standing preview request — see `setPreview`. */
export interface PreviewRequest {
  /** `null` applies to every endpoint; an id narrows it to that host. */
  endpointId: string | null;
  /** Empty clears the standing request. */
  plugins: PluginName[];
}

export class PollerService {
  readonly #pollers = new Map<string, EndpointPoller>();
  readonly #deps: PollerDeps;
  #endpoints: PollerEndpoint[] = [];
  /**
   * A single slot rather than a set: only one picker can be open, and a leaked request would keep
   * an endpoint polling `/processlist` forever because a dialog closed the wrong way. A slot the
   * next request overwrites cannot accumulate, and nothing persists it.
   */
  #preview: PreviewRequest = { endpointId: null, plugins: [] };
  #hidden = false;

  constructor(deps: PollerDeps) {
    this.#deps = deps;
  }

  /** Reconcile the running schedulers against the configured endpoints. Idempotent. */
  sync(endpoints: PollerEndpoint[]): void {
    this.#endpoints = endpoints;
    const wanted = new Map(endpoints.filter((endpoint) => endpoint.enabled).map((e) => [e.id, e]));

    for (const [id, poller] of this.#pollers) {
      if (!wanted.has(id)) {
        poller.stop();
        this.#pollers.delete(id);
      }
    }

    for (const endpoint of endpoints) {
      if (!endpoint.enabled) {
        // Paused by the user — a distinct state from any failure, and widgets must show it as one.
        this.#deps.patchStatus(endpoint.id, { state: 'disabled', lastError: undefined });
        continue;
      }
      const existing = this.#pollers.get(endpoint.id);
      if (existing) {
        existing.update(endpoint);
      } else {
        const poller = new EndpointPoller(endpoint, this.#deps);
        this.#pollers.set(endpoint.id, poller);
        poller.setHidden(this.#hidden);
        poller.start();
      }
    }

    // A poller created just now knows nothing of a request made before it existed.
    this.#applyPreview();
  }

  /** Called after widgets change: plugin sets are derived from the placed widgets (ref §4.4). */
  refreshPlugins(): void {
    for (const poller of this.#pollers.values()) poller.refreshPlugins();
  }

  /** Replaces any previous preview request, including clearing it. */
  setPreview(request: PreviewRequest): void {
    this.#preview = request;
    this.#applyPreview();
  }

  #applyPreview(): void {
    const { endpointId, plugins } = this.#preview;
    for (const [id, poller] of this.#pollers) {
      // Every endpoint left out of the request has its preview set cleared, so switching hosts in
      // the picker stops polling the old one rather than adding to it.
      const wanted = plugins.length > 0 && (endpointId === null || endpointId === id) ? plugins : [];
      poller.setPreviewPlugins(wanted);
    }
  }

  remove(endpointId: string): void {
    this.#pollers.get(endpointId)?.stop();
    this.#pollers.delete(endpointId);
    this.#endpoints = this.#endpoints.filter((endpoint) => endpoint.id !== endpointId);
  }

  setHidden(hidden: boolean): void {
    if (this.#hidden === hidden) return;
    this.#hidden = hidden;
    for (const poller of this.#pollers.values()) poller.setHidden(hidden);
  }

  stopAll(): void {
    for (const poller of this.#pollers.values()) poller.stop();
    this.#pollers.clear();
  }

  /** Stop, then start again from the current config — what a machine waking from sleep needs. */
  restart(): void {
    this.stopAll();
    this.sync(this.#endpoints);
  }

  /** Which endpoints currently have a running scheduler. Test and debug affordance. */
  activeEndpointIds(): string[] {
    return [...this.#pollers.keys()];
  }
}

/**
 * The app's poller. Plugin derivation is injected rather than imported so this module never
 * depends on the widget catalog — the same split the reference keeps across its process boundary,
 * and the reason `catalog.ts` will be data-only when it arrives in M12.
 */
let resolvePluginsImpl: (endpointId: string) => PluginName[] = () => [];
let resolveRetentionImpl: (endpointId: string) => number = () => 300;

export function setPluginResolver(
  resolvePlugins: (endpointId: string) => PluginName[],
  resolveRetentionSec: (endpointId: string) => number,
): void {
  resolvePluginsImpl = resolvePlugins;
  resolveRetentionImpl = resolveRetentionSec;
}

export const poller = new PollerService({
  get: httpGet,
  clock: systemClock,
  resolvePlugins: (endpointId) => resolvePluginsImpl(endpointId),
  resolveRetentionSec: (endpointId) => resolveRetentionImpl(endpointId),
  ingest: (snapshot) => feedStore.getState().ingest(snapshot),
  patchStatus: (endpointId, patch) => feedStore.getState().patchStatus(endpointId, patch),
  getStatus: (endpointId) => feedStore.getState().endpointStatus[endpointId],
});
