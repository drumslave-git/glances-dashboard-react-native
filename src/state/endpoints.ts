import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { coerceServerUrl } from '@/api/glances';
import { DEFAULT_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS } from '@/data/poller';
import { ACCENT_ORDER, accentNameForIndex, type AccentName } from '@/theme/telemetry';
import type { GlancesEndpoint } from '@/types/dashboard';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

export interface EndpointInput {
  name: string;
  url: string;
  pollIntervalMs?: number;
  enabled?: boolean;
  color?: AccentName | null;
  sortOrder?: number;
}

interface EndpointsState {
  endpoints: GlancesEndpoint[];
  /** Endpoint pre-selected for new widgets, and the one the header describes. */
  defaultEndpointId: string | null;
  hasHydrated: boolean;
  addEndpoint: (input: EndpointInput) => GlancesEndpoint;
  updateEndpoint: (id: string, patch: Partial<EndpointInput>) => void;
  removeEndpoint: (id: string) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  setDefaultEndpoint: (id: string) => void;
}

let endpointIdCounter = 1;

function nextEndpointId(): string {
  return `s-${endpointIdCounter++}`;
}

/**
 * Keep generated ids unique after rehydrating.
 *
 * The `s-` prefix is kept deliberately even though the concept is now "endpoint": these ids are
 * **persisted** and are what every widget stores to name its host. Re-prefixing them would either
 * orphan every widget or need a second migration to rewrite the references, for a string nobody
 * sees.
 */
function syncEndpointIdCounter(endpoints: { id: string }[]): void {
  const maxId = endpoints.reduce((max, endpoint) => {
    const match = /^s-(\d+)$/.exec(endpoint.id);
    if (!match) return max;
    const num = Number.parseInt(match[1] ?? '0', 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  endpointIdCounter = maxId + 1;
}

/** Test seam. */
export function resetEndpointIdCounter(): void {
  endpointIdCounter = 1;
}

/**
 * The server caches its own stats for about a second, so a faster interval returns identical data
 * and only costs requests. Anything unusable falls back to the default rather than to zero — a
 * zero here would mean a tight loop.
 */
function normalizePollInterval(pollIntervalMs: number | undefined): number {
  if (typeof pollIntervalMs !== 'number' || !Number.isFinite(pollIntervalMs)) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return Math.max(MIN_POLL_INTERVAL_MS, Math.round(pollIntervalMs));
}

function normalizeColor(color: AccentName | null | undefined): AccentName | null {
  if (color === null || color === undefined) return null;
  return ACCENT_ORDER.includes(color) ? color : null;
}

type PersistedEndpoints = { endpoints: GlancesEndpoint[]; defaultEndpointId: string | null };

/**
 * Migrate the persisted shape.
 *
 * These are user data, so a migration that silently drops one is a data-loss bug rather than a
 * styling one — hence the export and the tests.
 *
 * - **v1 → v2** gave servers an `accentIndex`, coloured by list position.
 * - **v2 → v3** (M11) renames the concept to *endpoint* and adopts the reference's model:
 *   `refreshMs` becomes `pollIntervalMs`, and the endpoint gains `enabled`, `sortOrder` and
 *   `createdAt`. `accentIndex` becomes a named `color` **carrying the colour the endpoint already
 *   had on screen**, so an upgraded board looks unchanged — a fresh install defaults to no accent,
 *   but taking one away from an existing endpoint would look like a bug, not a default.
 */
export function migrateEndpoints(persisted: unknown, version: number): PersistedEndpoints {
  const state = (persisted ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(state.endpoints)
    ? (state.endpoints as Record<string, unknown>[])
    : Array.isArray(state.servers)
      ? (state.servers as Record<string, unknown>[])
      : [];
  const defaultId =
    (typeof state.defaultEndpointId === 'string' ? state.defaultEndpointId : undefined) ??
    (typeof state.defaultServerId === 'string' ? state.defaultServerId : null);

  if (version >= 3) {
    return { endpoints: rows as unknown as GlancesEndpoint[], defaultEndpointId: defaultId };
  }

  const createdAt = Date.now();
  const endpoints: GlancesEndpoint[] = rows.map((row, index) => {
    const accentIndex = typeof row.accentIndex === 'number' ? row.accentIndex : index;
    const legacyRefresh = typeof row.refreshMs === 'number' ? row.refreshMs : undefined;
    return {
      id: String(row.id ?? `s-${index + 1}`),
      name: typeof row.name === 'string' ? row.name : 'Glances',
      url: typeof row.url === 'string' ? row.url : '',
      pollIntervalMs: normalizePollInterval(
        typeof row.pollIntervalMs === 'number' ? row.pollIntervalMs : legacyRefresh,
      ),
      enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
      color: normalizeColor(
        (typeof row.color === 'string' ? (row.color as AccentName) : undefined) ??
          accentNameForIndex(accentIndex),
      ),
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : createdAt,
    };
  });

  return { endpoints, defaultEndpointId: defaultId };
}

export { DEFAULT_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS } from '@/data/poller';

export const useEndpointsStore = create<EndpointsState>()(
  persist(
    (set, get) => ({
      endpoints: [],
      defaultEndpointId: null,
      hasHydrated: false,

      addEndpoint: (input) => {
        const endpoints = get().endpoints;
        const endpoint: GlancesEndpoint = {
          id: nextEndpointId(),
          name: input.name.trim() || 'Glances',
          url: coerceServerUrl(input.url),
          pollIntervalMs: normalizePollInterval(input.pollIntervalMs),
          enabled: input.enabled ?? true,
          // No accent by default — the chip then shows status, which is what a lone endpoint
          // needs. Telling hosts apart is what the accent is for, so it is the user's to add.
          color: normalizeColor(input.color),
          sortOrder: input.sortOrder ?? endpoints.length,
          createdAt: Date.now(),
        };
        set((state) => ({
          endpoints: [...state.endpoints, endpoint],
          // The first endpoint added becomes the default automatically.
          defaultEndpointId: state.defaultEndpointId ?? endpoint.id,
        }));
        return endpoint;
      },

      updateEndpoint: (id, patch) => {
        set((state) => ({
          endpoints: state.endpoints.map((endpoint) =>
            endpoint.id === id
              ? {
                  ...endpoint,
                  ...(patch.name !== undefined && { name: patch.name.trim() || endpoint.name }),
                  ...(patch.url !== undefined && { url: coerceServerUrl(patch.url) }),
                  ...(patch.pollIntervalMs !== undefined && {
                    pollIntervalMs: normalizePollInterval(patch.pollIntervalMs),
                  }),
                  ...(patch.enabled !== undefined && { enabled: patch.enabled }),
                  // `color` is patched on an explicit `null` too — clearing the accent *is* its
                  // reset, so `undefined` (absent) and `null` (cleared) cannot be conflated.
                  ...(patch.color !== undefined && { color: normalizeColor(patch.color) }),
                  ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
                }
              : endpoint,
          ),
        }));
      },

      removeEndpoint: (id) => {
        const remaining = get().endpoints.filter((endpoint) => endpoint.id !== id);
        set((state) => ({
          endpoints: remaining,
          defaultEndpointId:
            state.defaultEndpointId === id ? (remaining[0]?.id ?? null) : state.defaultEndpointId,
        }));
      },

      setEnabled: (id, enabled) => {
        get().updateEndpoint(id, { enabled });
      },

      setDefaultEndpoint: (id) => {
        if (!get().endpoints.some((endpoint) => endpoint.id === id)) return;
        set({ defaultEndpointId: id });
      },
    }),
    {
      name: STORAGE_KEYS.servers,
      storage: asyncStorageJSON(),
      version: 3,
      migrate: migrateEndpoints,
      partialize: (state) => ({
        endpoints: state.endpoints,
        defaultEndpointId: state.defaultEndpointId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) syncEndpointIdCounter(state.endpoints);
        useEndpointsStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Look an endpoint up by id — widgets store only the id. */
export function selectEndpointById(
  state: Pick<EndpointsState, 'endpoints'>,
  id: string | null | undefined,
): GlancesEndpoint | undefined {
  if (!id) return undefined;
  return state.endpoints.find((endpoint) => endpoint.id === id);
}

/** Roster order: `sortOrder`, then creation, so two endpoints never swap places at random. */
export function sortedEndpoints(endpoints: GlancesEndpoint[]): GlancesEndpoint[] {
  return [...endpoints].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}
