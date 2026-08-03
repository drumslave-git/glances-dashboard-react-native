import {
  createWidget,
  defaultWidgetTitle,
  metricToEndpoint,
  nextWidgetId,
  resetWidgetIdCounter,
  resolveMetricForKind,
  setWidgetIdCounterFrom,
} from './widgetFactory';

beforeEach(() => {
  resetWidgetIdCounter();
});

describe('metricToEndpoint', () => {
  it('builds the versioned plugin path', () => {
    expect(metricToEndpoint('cpu')).toBe('/api/4/cpu');
    expect(metricToEndpoint('processlist')).toBe('/api/4/processlist');
  });
});

describe('resolveMetricForKind', () => {
  it('forces processlist for process widgets', () => {
    expect(resolveMetricForKind('processes', 'cpu')).toBe('processlist');
  });

  it('leaves other kinds alone', () => {
    expect(resolveMetricForKind('donut', 'mem')).toBe('mem');
  });
});

describe('defaultWidgetTitle', () => {
  it('names each kind', () => {
    expect(defaultWidgetTitle('text', 'cpu')).toBe('cpu (text)');
    expect(defaultWidgetTitle('donut', 'cpu')).toBe('cpu (donut)');
    expect(defaultWidgetTitle('bar', 'cpu')).toBe('cpu (bar)');
    expect(defaultWidgetTitle('pie', 'cpu')).toBe('cpu (pie)');
    expect(defaultWidgetTitle('processes', 'processlist')).toBe('Processes');
  });
});

describe('createWidget', () => {
  it('creates a text widget with sensible defaults', () => {
    const widget = createWidget({ serverId: 's1', metric: 'cpu' });

    expect(widget).toMatchObject({
      id: 'w-1',
      serverId: 's1',
      kind: 'text',
      metric: 'cpu',
      endpointPath: '/api/4/cpu',
      title: 'cpu (text)',
      size: 'M',
      order: 0,
    });
  });

  it('issues unique ids', () => {
    const a = createWidget({ serverId: 's1', metric: 'cpu' });
    const b = createWidget({ serverId: 's1', metric: 'mem' });
    expect(a.id).not.toBe(b.id);
  });

  it('respects explicit title, size and order', () => {
    const widget = createWidget({
      serverId: 's1',
      metric: 'mem',
      kind: 'donut',
      title: 'Memory',
      size: 'L',
      order: 3,
    });
    expect(widget).toMatchObject({ title: 'Memory', size: 'L', order: 3, kind: 'donut' });
  });

  it('points process widgets at processlist regardless of metric', () => {
    const widget = createWidget({ serverId: 's1', metric: 'cpu', kind: 'processes' });
    expect(widget.metric).toBe('processlist');
    expect(widget.endpointPath).toBe('/api/4/processlist');
  });
});

describe('setWidgetIdCounterFrom', () => {
  it('continues after the highest persisted id', () => {
    setWidgetIdCounterFrom([{ id: 'w-3' }, { id: 'w-7' }, { id: 'w-1' }]);
    expect(nextWidgetId()).toBe('w-8');
  });

  it('ignores ids that do not match the pattern', () => {
    setWidgetIdCounterFrom([{ id: 'legacy' }, { id: 'w-2' }]);
    expect(nextWidgetId()).toBe('w-3');
  });

  it('starts from one when there are no widgets', () => {
    setWidgetIdCounterFrom([]);
    expect(nextWidgetId()).toBe('w-1');
  });
});
