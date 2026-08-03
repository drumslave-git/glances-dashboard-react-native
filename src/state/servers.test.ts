import {
  DEFAULT_REFRESH_MS,
  migrateServers,
  resetServerIdCounter,
  selectServerById,
  useServersStore,
} from './servers';

beforeEach(() => {
  resetServerIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
});

describe('addServer', () => {
  it('normalises the url and fills in the default refresh interval', () => {
    const server = useServersStore.getState().addServer({ name: 'NAS', url: '192.168.1.10' });

    expect(server).toMatchObject({
      id: 's-1',
      name: 'NAS',
      url: 'http://192.168.1.10:61208',
      refreshMs: DEFAULT_REFRESH_MS,
    });
    expect(useServersStore.getState().servers).toHaveLength(1);
  });

  it('falls back to a placeholder name when blank', () => {
    const server = useServersStore.getState().addServer({ name: '  ', url: 'host' });
    expect(server.name).toBe('Glances');
  });

  it('makes the first server the default but leaves it alone afterwards', () => {
    const first = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().addServer({ name: 'B', url: 'b' });

    expect(useServersStore.getState().defaultServerId).toBe(first.id);
  });

  it('rejects nonsensical refresh intervals', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a', refreshMs: -5 });
    expect(server.refreshMs).toBe(DEFAULT_REFRESH_MS);
  });

  it('allows zero to mean "do not poll"', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a', refreshMs: 0 });
    expect(server.refreshMs).toBe(0);
  });
});

describe('updateServer', () => {
  it('patches only the given fields', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().updateServer(server.id, { name: 'Renamed' });

    const updated = useServersStore.getState().servers[0];
    expect(updated.name).toBe('Renamed');
    expect(updated.url).toBe('http://a:61208');
  });

  it('re-normalises an updated url', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().updateServer(server.id, { url: '10.0.0.5:1234' });

    expect(useServersStore.getState().servers[0].url).toBe('http://10.0.0.5:1234');
  });

  it('ignores unknown ids', () => {
    useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().updateServer('nope', { name: 'X' });

    expect(useServersStore.getState().servers[0].name).toBe('A');
  });
});

describe('removeServer', () => {
  it('promotes another server when the default is removed', () => {
    const first = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    const second = useServersStore.getState().addServer({ name: 'B', url: 'b' });

    useServersStore.getState().removeServer(first.id);

    expect(useServersStore.getState().servers).toHaveLength(1);
    expect(useServersStore.getState().defaultServerId).toBe(second.id);
  });

  it('clears the default when the last server goes', () => {
    const only = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().removeServer(only.id);

    expect(useServersStore.getState().defaultServerId).toBeNull();
  });
});

describe('setDefaultServer', () => {
  it('switches the default', () => {
    useServersStore.getState().addServer({ name: 'A', url: 'a' });
    const second = useServersStore.getState().addServer({ name: 'B', url: 'b' });

    useServersStore.getState().setDefaultServer(second.id);
    expect(useServersStore.getState().defaultServerId).toBe(second.id);
  });

  it('ignores ids that do not exist', () => {
    const first = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    useServersStore.getState().setDefaultServer('nope');

    expect(useServersStore.getState().defaultServerId).toBe(first.id);
  });
});

describe('selectServerById', () => {
  it('finds a server, or returns undefined', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a' });
    const state = useServersStore.getState();

    expect(selectServerById(state, server.id)?.name).toBe('A');
    expect(selectServerById(state, 'nope')).toBeUndefined();
    expect(selectServerById(state, null)).toBeUndefined();
  });
});

describe('endpoint accents', () => {
  it('gives each new server the next colour along', () => {
    const store = useServersStore.getState();
    expect(store.addServer({ name: 'A', url: 'a' }).accentIndex).toBe(0);
    expect(useServersStore.getState().addServer({ name: 'B', url: 'b' }).accentIndex).toBe(1);
    expect(useServersStore.getState().addServer({ name: 'C', url: 'c' }).accentIndex).toBe(2);
  });

  it('honours an explicitly chosen colour', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a', accentIndex: 2 });
    expect(server.accentIndex).toBe(2);
  });

  it('lets the colour be changed and ignores junk', () => {
    const server = useServersStore.getState().addServer({ name: 'A', url: 'a' });

    useServersStore.getState().updateServer(server.id, { accentIndex: 1 });
    expect(selectServerById(useServersStore.getState(), server.id)?.accentIndex).toBe(1);

    useServersStore.getState().updateServer(server.id, { accentIndex: Number.NaN });
    expect(selectServerById(useServersStore.getState(), server.id)?.accentIndex).toBe(1);
  });
});

describe('migrateServers', () => {
  it('colours pre-accent servers by their position', () => {
    const migrated = migrateServers(
      {
        servers: [
          { id: 's-1', name: 'A', url: 'http://a', refreshMs: 5000 },
          { id: 's-2', name: 'B', url: 'http://b', refreshMs: 5000 },
        ],
        defaultServerId: 's-1',
      },
      1,
    );

    expect(migrated.servers.map((s) => s.accentIndex)).toEqual([0, 1]);
    expect(migrated.defaultServerId).toBe('s-1');
  });

  it('leaves an already-migrated store alone', () => {
    const migrated = migrateServers(
      { servers: [{ id: 's-1', name: 'A', url: 'http://a', refreshMs: 5000, accentIndex: 2 }] },
      2,
    );
    expect(migrated.servers[0].accentIndex).toBe(2);
    expect(migrated.defaultServerId).toBeNull();
  });

  it('survives an empty or absent persisted payload', () => {
    expect(migrateServers(undefined, 1)).toEqual({ servers: [], defaultServerId: null });
    expect(migrateServers({}, 0)).toEqual({ servers: [], defaultServerId: null });
  });
});
