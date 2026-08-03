import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { coerceServerUrl } from '@/api/glances';
import type { GlancesServer } from '@/types/dashboard';

import { asyncStorageJSON, STORAGE_KEYS } from './storage';

export const DEFAULT_REFRESH_MS = 5000;

export interface ServerInput {
  name: string;
  url: string;
  refreshMs?: number;
  accentIndex?: number;
}

interface ServersState {
  servers: GlancesServer[];
  /** Server used for the dashboard header and pre-selected for new widgets. */
  defaultServerId: string | null;
  hasHydrated: boolean;
  addServer: (input: ServerInput) => GlancesServer;
  updateServer: (id: string, patch: Partial<ServerInput>) => void;
  removeServer: (id: string) => void;
  setDefaultServer: (id: string) => void;
}

let serverIdCounter = 1;

function nextServerId(): string {
  return `s-${serverIdCounter++}`;
}

/** Keep generated ids unique after rehydrating persisted servers. */
function syncServerIdCounter(servers: { id: string }[]): void {
  const maxId = servers.reduce((max, s) => {
    const match = /^s-(\d+)$/.exec(s.id);
    if (!match) return max;
    const num = Number.parseInt(match[1] ?? '0', 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  serverIdCounter = maxId + 1;
}

/** Test seam. */
export function resetServerIdCounter(): void {
  serverIdCounter = 1;
}

function normalizeRefresh(refreshMs: number | undefined): number {
  if (typeof refreshMs !== 'number' || Number.isNaN(refreshMs) || refreshMs < 0) {
    return DEFAULT_REFRESH_MS;
  }
  return refreshMs;
}

/** `accentNameForIndex` cycles, so any whole number is valid — junk is not. */
function normalizeAccentIndex(accentIndex: number | undefined, fallback: number): number {
  if (typeof accentIndex !== 'number' || !Number.isFinite(accentIndex)) return fallback;
  return Math.max(0, Math.trunc(accentIndex));
}

type PersistedServers = Pick<ServersState, 'servers' | 'defaultServerId'>;

/**
 * v1 → v2: servers gained `accentIndex`. Existing servers are coloured by their
 * position in the list, which is the same assignment a fresh install would make,
 * so an upgraded dashboard looks like one that was always on this version.
 *
 * Exported for the test — persisted shapes are user data, and a migration that
 * silently drops a server is a data-loss bug, not a styling one.
 */
export function migrateServers(persisted: unknown, version: number): PersistedServers {
  const state = (persisted ?? {}) as Partial<PersistedServers>;
  const servers = Array.isArray(state.servers) ? state.servers : [];

  if (version >= 2) {
    return { servers: servers as GlancesServer[], defaultServerId: state.defaultServerId ?? null };
  }

  return {
    servers: servers.map((server, index) => ({
      ...(server as GlancesServer),
      accentIndex:
        typeof (server as Partial<GlancesServer>).accentIndex === 'number'
          ? (server as GlancesServer).accentIndex
          : index,
    })),
    defaultServerId: state.defaultServerId ?? null,
  };
}

export const useServersStore = create<ServersState>()(
  persist(
    (set, get) => ({
      servers: [],
      defaultServerId: null,
      hasHydrated: false,

      addServer: (input) => {
        const server: GlancesServer = {
          id: nextServerId(),
          name: input.name.trim() || 'Glances',
          url: coerceServerUrl(input.url),
          refreshMs: normalizeRefresh(input.refreshMs),
          // Next colour along, so the first three servers are visibly distinct
          // without the user choosing anything.
          accentIndex: input.accentIndex ?? get().servers.length,
        };
        set((state) => ({
          servers: [...state.servers, server],
          // First server added becomes the default automatically.
          defaultServerId: state.defaultServerId ?? server.id,
        }));
        return server;
      },

      updateServer: (id, patch) => {
        set((state) => ({
          servers: state.servers.map((server) =>
            server.id === id
              ? {
                  ...server,
                  ...(patch.name !== undefined && { name: patch.name.trim() || server.name }),
                  ...(patch.url !== undefined && { url: coerceServerUrl(patch.url) }),
                  ...(patch.refreshMs !== undefined && {
                    refreshMs: normalizeRefresh(patch.refreshMs),
                  }),
                  ...(patch.accentIndex !== undefined && {
                    accentIndex: normalizeAccentIndex(patch.accentIndex, server.accentIndex),
                  }),
                }
              : server,
          ),
        }));
      },

      removeServer: (id) => {
        const remaining = get().servers.filter((server) => server.id !== id);
        set((state) => ({
          servers: remaining,
          defaultServerId:
            state.defaultServerId === id ? (remaining[0]?.id ?? null) : state.defaultServerId,
        }));
      },

      setDefaultServer: (id) => {
        if (!get().servers.some((server) => server.id === id)) return;
        set({ defaultServerId: id });
      },
    }),
    {
      name: STORAGE_KEYS.servers,
      storage: asyncStorageJSON(),
      version: 2,
      migrate: migrateServers,
      partialize: (state) => ({
        servers: state.servers,
        defaultServerId: state.defaultServerId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) syncServerIdCounter(state.servers);
        useServersStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Look a server up by id — widgets store only the id. */
export function selectServerById(
  state: Pick<ServersState, 'servers'>,
  id: string | null | undefined,
): GlancesServer | undefined {
  if (!id) return undefined;
  return state.servers.find((server) => server.id === id);
}
