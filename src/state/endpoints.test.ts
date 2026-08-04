import {
  DEFAULT_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  migrateEndpoints,
  resetEndpointIdCounter,
  selectEndpointById,
  sortedEndpoints,
  useEndpointsStore,
} from './endpoints';
import type { EndpointInput } from './endpoints';
import type { GlancesEndpoint } from '@/types/dashboard';

beforeEach(() => {
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  resetEndpointIdCounter();
});

const add = (over: Partial<EndpointInput> = {}) =>
  useEndpointsStore.getState().addEndpoint({ name: 'A', url: '10.0.0.1', ...over });

describe('addEndpoint', () => {
  it('normalises the url and fills the defaults', () => {
    const endpoint = add();
    expect(endpoint).toMatchObject({
      name: 'A',
      url: 'http://10.0.0.1:61208',
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      enabled: true,
      sortOrder: 0,
    });
    expect(endpoint.createdAt).toBeGreaterThan(0);
  });

  it('starts with no accent, so the chip shows connection state', () => {
    // Telling hosts apart is what an accent is for; a lone endpoint has nothing to be told apart
    // from, and its state is the more useful thing to show.
    expect(add().color).toBeNull();
  });

  it('makes the first endpoint the default and leaves it there', () => {
    const first = add();
    add({ name: 'B' });
    expect(useEndpointsStore.getState().defaultEndpointId).toBe(first.id);
  });

  it('numbers sortOrder by position', () => {
    add();
    const second = add({ name: 'B' });
    expect(second.sortOrder).toBe(1);
  });

  it('falls back to a name rather than storing an empty one', () => {
    expect(add({ name: '   ' }).name).toBe('Glances');
  });

  it('floors the poll interval at a second', () => {
    // Below that the server returns its cached stats and the extra requests buy nothing.
    expect(add({ pollIntervalMs: 100 }).pollIntervalMs).toBe(MIN_POLL_INTERVAL_MS);
    expect(add({ pollIntervalMs: 0 }).pollIntervalMs).toBe(MIN_POLL_INTERVAL_MS);
  });

  it('rejects an unusable interval instead of polling in a tight loop', () => {
    expect(add({ pollIntervalMs: Number.NaN }).pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  it('ignores a colour outside the design palette', () => {
    expect(add({ color: 'hotpink' as never }).color).toBeNull();
  });
});

describe('updateEndpoint', () => {
  it('patches only the given fields', () => {
    const endpoint = add({ color: 'cyan' });
    useEndpointsStore.getState().updateEndpoint(endpoint.id, { name: 'Renamed' });

    expect(useEndpointsStore.getState().endpoints[0]).toMatchObject({
      name: 'Renamed',
      url: 'http://10.0.0.1:61208',
      color: 'cyan',
    });
  });

  it('re-normalises an updated url', () => {
    const endpoint = add();
    useEndpointsStore.getState().updateEndpoint(endpoint.id, { url: 'glances.example.com' });
    expect(useEndpointsStore.getState().endpoints[0].url).toBe('https://glances.example.com');
  });

  it('treats an explicit null colour as a clear, not as an absent field', () => {
    // Clearing the accent *is* its reset, so `null` and `undefined` cannot mean the same thing.
    const endpoint = add({ color: 'amber' });
    useEndpointsStore.getState().updateEndpoint(endpoint.id, { color: null });
    expect(useEndpointsStore.getState().endpoints[0].color).toBeNull();
  });

  it('leaves the colour alone when the patch omits it', () => {
    const endpoint = add({ color: 'amber' });
    useEndpointsStore.getState().updateEndpoint(endpoint.id, { name: 'B' });
    expect(useEndpointsStore.getState().endpoints[0].color).toBe('amber');
  });
});

describe('setEnabled', () => {
  it('pauses and resumes without touching anything else', () => {
    const endpoint = add({ color: 'lime' });
    useEndpointsStore.getState().setEnabled(endpoint.id, false);
    expect(useEndpointsStore.getState().endpoints[0]).toMatchObject({ enabled: false, color: 'lime' });

    useEndpointsStore.getState().setEnabled(endpoint.id, true);
    expect(useEndpointsStore.getState().endpoints[0].enabled).toBe(true);
  });
});

describe('removeEndpoint', () => {
  it('hands the default to whatever is left', () => {
    const first = add();
    const second = add({ name: 'B' });
    useEndpointsStore.getState().removeEndpoint(first.id);
    expect(useEndpointsStore.getState().defaultEndpointId).toBe(second.id);
  });

  it('clears the default when nothing is left', () => {
    const only = add();
    useEndpointsStore.getState().removeEndpoint(only.id);
    expect(useEndpointsStore.getState().defaultEndpointId).toBeNull();
  });
});

describe('selectors', () => {
  it('finds by id, and tolerates a missing one', () => {
    const endpoint = add();
    const state = useEndpointsStore.getState();
    expect(selectEndpointById(state, endpoint.id)?.name).toBe('A');
    expect(selectEndpointById(state, 'nope')).toBeUndefined();
    expect(selectEndpointById(state, null)).toBeUndefined();
  });

  it('orders by sortOrder, breaking ties on creation so nothing jumps about', () => {
    const rows: GlancesEndpoint[] = [
      { id: 'c', name: 'C', url: '', pollIntervalMs: 2000, enabled: true, color: null, sortOrder: 1, createdAt: 3 },
      { id: 'a', name: 'A', url: '', pollIntervalMs: 2000, enabled: true, color: null, sortOrder: 0, createdAt: 2 },
      { id: 'b', name: 'B', url: '', pollIntervalMs: 2000, enabled: true, color: null, sortOrder: 1, createdAt: 1 },
    ];
    expect(sortedEndpoints(rows).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('migrateEndpoints', () => {
  const legacy = {
    servers: [
      { id: 's-1', name: 'A', url: 'http://a', refreshMs: 5000, accentIndex: 1 },
      { id: 's-2', name: 'B', url: 'http://b', refreshMs: 5000, accentIndex: 2 },
    ],
    defaultServerId: 's-2',
  };

  it('carries every v2 server across, under the new names', () => {
    // Losing one of these is data loss, not a styling regression — hence the export and this test.
    const { endpoints, defaultEndpointId } = migrateEndpoints(legacy, 2);
    expect(endpoints.map((e) => e.id)).toEqual(['s-1', 's-2']);
    expect(defaultEndpointId).toBe('s-2');
  });

  it('renames refreshMs to pollIntervalMs, keeping the value the user chose', () => {
    expect(migrateEndpoints(legacy, 2).endpoints[0].pollIntervalMs).toBe(5000);
  });

  it('keeps the colour each endpoint already had on screen', () => {
    // A fresh install defaults to no accent, but taking one away from an existing endpoint would
    // look like a bug rather than a new default.
    const { endpoints } = migrateEndpoints(legacy, 2);
    expect(endpoints[0].color).toBe('cyan');
    expect(endpoints[1].color).toBe('amber');
  });

  it('fills in the fields v2 had no idea about', () => {
    const [first] = migrateEndpoints(legacy, 2).endpoints;
    expect(first.enabled).toBe(true);
    expect(first.sortOrder).toBe(0);
    expect(first.createdAt).toBeGreaterThan(0);
  });

  it('migrates a v1 row that never had an accent at all', () => {
    const v1 = { servers: [{ id: 's-1', name: 'A', url: 'http://a', refreshMs: 5000 }], defaultServerId: null };
    expect(migrateEndpoints(v1, 1).endpoints[0].color).toBe('lime');
  });

  it('passes a current version through untouched', () => {
    const current = {
      endpoints: [
        { id: 's-1', name: 'A', url: 'http://a', pollIntervalMs: 2000, enabled: false, color: null, sortOrder: 0, createdAt: 5 },
      ],
      defaultEndpointId: 's-1',
    };
    expect(migrateEndpoints(current, 3)).toEqual(current);
  });

  it('survives junk rather than throwing away the store', () => {
    expect(migrateEndpoints(undefined, 2)).toEqual({ endpoints: [], defaultEndpointId: null });
    expect(migrateEndpoints({ servers: 'nope' }, 2).endpoints).toEqual([]);
    const [row] = migrateEndpoints({ servers: [{}] }, 2).endpoints;
    expect(row.name).toBe('Glances');
    expect(row.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
  });
});
