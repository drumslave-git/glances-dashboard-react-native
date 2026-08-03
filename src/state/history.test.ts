import { selectSeries, seriesKey, useHistoryStore } from './history';

const cpu = seriesKey('s-1', '/api/4/cpu', 'total');
const mem = seriesKey('s-2', '/api/4/mem', 'percent');

beforeEach(() => {
  useHistoryStore.getState().reset();
});

describe('seriesKey', () => {
  it('puts the server first so a prefix match is by server', () => {
    expect(cpu.startsWith('s-1|')).toBe(true);
  });
});

describe('recording', () => {
  it('accumulates samples per key', () => {
    const { record } = useHistoryStore.getState();
    record(cpu, 10, 1000);
    record(cpu, 20, 2000);
    record(mem, 40, 1000);

    expect(selectSeries(useHistoryStore.getState(), cpu).map((s) => s.v)).toEqual([10, 20]);
    expect(selectSeries(useHistoryStore.getState(), mem).map((s) => s.v)).toEqual([40]);
  });

  it('leaves the store untouched for a repeated poll', () => {
    const { record } = useHistoryStore.getState();
    record(cpu, 10, 1000);
    const before = useHistoryStore.getState().series;

    // Two more widgets on the same server and endpoint reporting the same poll.
    record(cpu, 10, 1000);
    record(cpu, 10, 1000);

    expect(useHistoryStore.getState().series).toBe(before);
  });

  it('returns a stable empty array for a series with no samples', () => {
    const state = useHistoryStore.getState();
    expect(selectSeries(state, 'nothing|here|yet')).toBe(selectSeries(state, 'other|key|still'));
  });
});

describe('clearServer', () => {
  it('drops only that server’s series', () => {
    const { record, clearServer } = useHistoryStore.getState();
    record(cpu, 10, 1000);
    record(mem, 40, 1000);

    clearServer('s-1');

    expect(selectSeries(useHistoryStore.getState(), cpu)).toEqual([]);
    expect(selectSeries(useHistoryStore.getState(), mem)).toHaveLength(1);
  });

  it('retains only the keys still on screen, so churning PIDs do not pile up', () => {
    const { record, retainOnly } = useHistoryStore.getState();
    record(seriesKey('s-1', '/api/4/processlist', 'pid:1'), 5, 1000);
    record(seriesKey('s-1', '/api/4/processlist', 'pid:2'), 5, 1000);
    record(mem, 40, 1000);

    retainOnly('s-1|/api/4/processlist|', [seriesKey('s-1', '/api/4/processlist', 'pid:2')]);

    const keys = Object.keys(useHistoryStore.getState().series).sort();
    expect(keys).toEqual([mem, seriesKey('s-1', '/api/4/processlist', 'pid:2')].sort());
  });

  it('leaves the store untouched when the server had no series', () => {
    const { record, clearServer } = useHistoryStore.getState();
    record(cpu, 10, 1000);
    const before = useHistoryStore.getState().series;

    clearServer('s-99');

    expect(useHistoryStore.getState().series).toBe(before);
  });
});
