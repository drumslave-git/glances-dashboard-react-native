import type { WidgetInstance } from '@/types/dashboard';
import { WIDGET_DEFINITIONS } from '@/widgets/catalog';

import {
  migrateWidgets,
  resetWidgetIdCounter,
  selectOrderedWidgets,
  useWidgetsStore,
} from './widgets';

beforeEach(() => {
  useWidgetsStore.setState({ widgets: [] });
  resetWidgetIdCounter();
});

const store = () => useWidgetsStore.getState();

/** A fully-formed row, for the cases that seed state rather than build it. */
const row = (over: Partial<WidgetInstance> & Pick<WidgetInstance, 'id'>): WidgetInstance => ({
  type: 'cpu',
  endpointId: 'e1',
  title: null,
  config: {},
  x: 0,
  y: 0,
  w: 1,
  h: 3,
  createdAt: 0,
  ...over,
});

describe('addWidget', () => {
  it('takes the type default footprint and appends to the flow', () => {
    const first = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    const second = store().addWidget({ type: 'memoryGauge', endpointId: 'e1' });

    expect(first).toMatchObject({ type: 'cpu', endpointId: 'e1', y: 0 });
    expect(first.w).toBe(WIDGET_DEFINITIONS.cpu.defaultSize.w);
    expect(first.h).toBe(WIDGET_DEFINITIONS.cpu.defaultSize.h);
    expect(second.y).toBe(1);
  });

  it('accepts an explicit footprint, e.g. the picker wide card', () => {
    expect(store().addWidget({ type: 'cpu', endpointId: 'e1', w: 2, h: 3 })).toMatchObject({
      w: 2,
      h: 3,
    });
  });

  it('parses the config on the way in, not only on the way out', () => {
    // A widget is never stored carrying options its own schema would reject.
    const widget = store().addWidget({
      type: 'cpu',
      endpointId: 'e1',
      config: { split: true, windowSec: 'nonsense' },
    });
    expect(widget.config).toEqual({ split: true, perCoreOverlay: false, windowSec: 300 });
  });

  it('fills the schema defaults when no config is given', () => {
    expect(store().addWidget({ type: 'load', endpointId: 'e1' }).config).toEqual({
      normalize: false,
      windowSec: 300,
    });
  });

  it('defaults the title to null, meaning "use the type label"', () => {
    expect(store().addWidget({ type: 'cpu', endpointId: 'e1' }).title).toBeNull();
  });

  it('gives each widget a distinct id', () => {
    const ids = [
      store().addWidget({ type: 'cpu', endpointId: 'e1' }).id,
      store().addWidget({ type: 'load', endpointId: 'e1' }).id,
    ];
    expect(new Set(ids).size).toBe(2);
  });
});

describe('updateWidget', () => {
  it('re-parses a patched config', () => {
    const widget = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().updateWidget(widget.id, { config: { split: true } });
    expect(store().widgets[0].config).toEqual({ split: true, perCoreOverlay: false, windowSec: 300 });
  });

  it('rebinds to another endpoint', () => {
    const widget = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().updateWidget(widget.id, { endpointId: 'e2' });
    expect(store().widgets[0].endpointId).toBe('e2');
  });

  it('leaves other widgets alone', () => {
    const first = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().addWidget({ type: 'load', endpointId: 'e1' });
    store().updateWidget(first.id, { title: 'Renamed' });
    expect(store().widgets[1].title).toBeNull();
  });
});

describe('removeWidget', () => {
  it('keeps the flow dense, so no hole is left behind', () => {
    const first = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().addWidget({ type: 'load', endpointId: 'e1' });
    store().addWidget({ type: 'memory', endpointId: 'e1' });

    store().removeWidget(first.id);
    expect(store().widgets.map((widget) => widget.y)).toEqual([0, 1]);
  });
});

describe('setGeometry', () => {
  it('patches only what it is given', () => {
    const widget = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().setGeometry(widget.id, { w: 2 });
    expect(store().widgets[0]).toMatchObject({ w: 2, h: widget.h });
  });
});

describe('reorderWidgets', () => {
  it('applies the given order', () => {
    const a = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    const b = store().addWidget({ type: 'load', endpointId: 'e1' });
    store().reorderWidgets([b.id, a.id]);
    expect(store().widgets.map((widget) => widget.id)).toEqual([b.id, a.id]);
    expect(store().widgets.map((widget) => widget.y)).toEqual([0, 1]);
  });

  it('keeps unmentioned widgets at the end in their relative order', () => {
    const a = store().addWidget({ type: 'cpu', endpointId: 'e1' });
    const b = store().addWidget({ type: 'load', endpointId: 'e1' });
    const c = store().addWidget({ type: 'memory', endpointId: 'e1' });
    store().reorderWidgets([c.id]);
    expect(store().widgets.map((widget) => widget.id)).toEqual([c.id, a.id, b.id]);
  });
});

describe('removeWidgetsForEndpoint', () => {
  it('drops that endpoint widgets and re-flows', () => {
    store().addWidget({ type: 'cpu', endpointId: 'e1' });
    store().addWidget({ type: 'load', endpointId: 'e2' });
    store().removeWidgetsForEndpoint('e1');

    expect(store().widgets).toHaveLength(1);
    expect(store().widgets[0]).toMatchObject({ endpointId: 'e2', y: 0 });
  });

  it('spares a general widget, which belongs to no host', () => {
    useWidgetsStore.setState({ widgets: [row({ id: 'w-1', type: 'alerts', endpointId: null })] });
    store().removeWidgetsForEndpoint('e1');
    expect(store().widgets).toHaveLength(1);
  });
});

describe('selectOrderedWidgets', () => {
  it('sorts by row then column', () => {
    const widgets = [row({ id: 'c', x: 1, y: 1 }), row({ id: 'a' }), row({ id: 'b', y: 1 })];
    expect(selectOrderedWidgets({ widgets }).map((widget) => widget.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('migrateWidgets', () => {
  it('drops every widget stored under the generic model', () => {
    // There is no honest mapping from `{kind, metric, fields}` onto a typed catalog entry — a donut
    // over two hand-picked fields is not a Memory gauge. Guessing would hand the user a board that
    // looks like theirs and reads differently, which is worse than an empty one they rebuild.
    const v1 = {
      widgets: [
        { id: 'w-1', kind: 'donut', metric: 'mem', serverId: 's-1', fields: ['used', 'free'], size: 'M', order: 0 },
        { id: 'w-2', kind: 'processes', metric: 'processlist', serverId: 's-1', size: 'L', order: 1 },
      ],
    };
    expect(migrateWidgets(v1, 1)).toEqual({ widgets: [] });
  });

  it('passes a current store through untouched', () => {
    // Dropping on purpose still has to be *only* what was intended.
    const v2 = { widgets: [row({ id: 'w-1', createdAt: 5 })] };
    expect(migrateWidgets(v2, 2)).toEqual(v2);
  });

  it('survives junk', () => {
    expect(migrateWidgets(undefined, 1)).toEqual({ widgets: [] });
    expect(migrateWidgets({ widgets: 'nope' }, 2)).toEqual({ widgets: [] });
  });
});

describe('a global widget is not collateral damage', () => {
  it('survives the deletion of an endpoint it was mistakenly bound to', () => {
    // Config screens written before the global scope existed saved an endpoint id on every widget.
    // The scope is the authority, not what happens to be stored.
    useWidgetsStore.setState({
      widgets: [
        row({ id: 'w1', type: 'cpu', endpointId: 'e1' }),
        row({ id: 'w2', type: 'alerts', endpointId: 'e1' }),
        row({ id: 'w3', type: 'alerts', endpointId: null }),
      ],
    });

    useWidgetsStore.getState().removeWidgetsForEndpoint('e1');

    expect(useWidgetsStore.getState().widgets.map((widget) => widget.id)).toEqual(['w2', 'w3']);
  });
});
