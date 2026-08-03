import { resetWidgetIdCounter } from '@/utils/widgetFactory';

import { selectOrderedWidgets, useWidgetsStore } from './widgets';

beforeEach(() => {
  resetWidgetIdCounter();
  useWidgetsStore.setState({ widgets: [] });
});

function add(metric: string, serverId = 's-1') {
  return useWidgetsStore.getState().addWidget({ serverId, metric });
}

describe('addWidget', () => {
  it('appends widgets with increasing order', () => {
    const first = add('cpu');
    const second = add('mem');

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
    expect(useWidgetsStore.getState().widgets).toHaveLength(2);
  });

  it('derives the endpoint from the metric', () => {
    expect(add('cpu').endpointPath).toBe('/api/4/cpu');
  });
});

describe('updateWidget', () => {
  it('recomputes the endpoint when the metric changes', () => {
    const widget = add('cpu');
    useWidgetsStore.getState().updateWidget(widget.id, { metric: 'mem' });

    const updated = useWidgetsStore.getState().widgets[0];
    expect(updated.metric).toBe('mem');
    expect(updated.endpointPath).toBe('/api/4/mem');
  });

  it('keeps process widgets on processlist even if a metric is passed', () => {
    const widget = useWidgetsStore
      .getState()
      .addWidget({ serverId: 's-1', metric: 'cpu', kind: 'processes' });

    useWidgetsStore.getState().updateWidget(widget.id, { metric: 'cpu' });

    const updated = useWidgetsStore.getState().widgets[0];
    expect(updated.metric).toBe('processlist');
    expect(updated.endpointPath).toBe('/api/4/processlist');
  });

  it('patches presentation fields', () => {
    const widget = add('cpu');
    useWidgetsStore.getState().updateWidget(widget.id, {
      title: 'CPU {{total}}%',
      fields: ['total'],
      fieldColors: { total: '#123456' },
      splitPercentageIntoUsedFree: true,
    });

    expect(useWidgetsStore.getState().widgets[0]).toMatchObject({
      title: 'CPU {{total}}%',
      fields: ['total'],
      fieldColors: { total: '#123456' },
      splitPercentageIntoUsedFree: true,
    });
  });

  it('can move a widget to another server', () => {
    const widget = add('cpu');
    useWidgetsStore.getState().updateWidget(widget.id, { serverId: 's-2' });

    expect(useWidgetsStore.getState().widgets[0].serverId).toBe('s-2');
  });
});

describe('removeWidget', () => {
  it('removes and closes the gap in order', () => {
    const first = add('cpu');
    add('mem');
    add('load');

    useWidgetsStore.getState().removeWidget(first.id);

    const widgets = useWidgetsStore.getState().widgets;
    expect(widgets.map((w) => w.metric)).toEqual(['mem', 'load']);
    expect(widgets.map((w) => w.order)).toEqual([0, 1]);
  });
});

describe('setWidgetSize', () => {
  it('changes only the target widget', () => {
    const first = add('cpu');
    add('mem');

    useWidgetsStore.getState().setWidgetSize(first.id, 'XL');

    expect(useWidgetsStore.getState().widgets[0].size).toBe('XL');
    expect(useWidgetsStore.getState().widgets[1].size).toBe('M');
  });
});

describe('reorderWidgets', () => {
  it('applies the given order', () => {
    const a = add('cpu');
    const b = add('mem');
    const c = add('load');

    useWidgetsStore.getState().reorderWidgets([c.id, a.id, b.id]);

    const widgets = selectOrderedWidgets(useWidgetsStore.getState());
    expect(widgets.map((w) => w.metric)).toEqual(['load', 'cpu', 'mem']);
    expect(widgets.map((w) => w.order)).toEqual([0, 1, 2]);
  });

  it('appends widgets missing from the given order', () => {
    const a = add('cpu');
    const b = add('mem');

    useWidgetsStore.getState().reorderWidgets([b.id]);

    expect(selectOrderedWidgets(useWidgetsStore.getState()).map((w) => w.id)).toEqual([b.id, a.id]);
  });

  it('ignores unknown ids', () => {
    const a = add('cpu');
    useWidgetsStore.getState().reorderWidgets(['nope', a.id]);

    expect(useWidgetsStore.getState().widgets.map((w) => w.id)).toEqual([a.id]);
  });
});

describe('removeWidgetsForServer', () => {
  it('drops every widget bound to that server', () => {
    add('cpu', 's-1');
    add('mem', 's-2');
    add('load', 's-1');

    useWidgetsStore.getState().removeWidgetsForServer('s-1');

    const widgets = useWidgetsStore.getState().widgets;
    expect(widgets.map((w) => w.metric)).toEqual(['mem']);
    expect(widgets[0].order).toBe(0);
  });
});

describe('selectOrderedWidgets', () => {
  it('sorts by order regardless of array position', () => {
    useWidgetsStore.setState({
      widgets: [
        { ...add('cpu'), order: 2 },
        { ...add('mem'), order: 0 },
      ],
    });

    expect(selectOrderedWidgets(useWidgetsStore.getState()).map((w) => w.order)).toEqual([0, 2]);
  });
});
