import {
  METRIC_DEFINITIONS,
  WIDGET_DEFINITIONS,
  WIDGET_TYPES,
  WIDGET_VARIANTS,
  ENDPOINT_SCOPED_CONFIG_KEYS,
  ENDPOINT_SCOPED_SELECTIONS,
  clearEndpointScopedConfig,
  isWidgetAvailable,
  isWidgetType,
  metricsByGroup,
  parseWidgetConfig,
  optionChoices,
  pluginsForEndpoint,
  requestedWindowSec,
  retentionSecForEndpoint,
  widgetsForMetric,
} from './catalog';
import { WIDGET_RENDERERS } from './registry';

describe('definitions', () => {
  it('derives the group from the metric, so a rendering cannot change category', () => {
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      expect(definition.group).toBe(METRIC_DEFINITIONS[definition.metric].group);
    }
  });

  it('defaults to the regular footprint, never a declared one', () => {
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      expect(definition.defaultSize).toEqual(definition.sizes.regular);
    }
  });

  it('keeps compact equal to regular — compact is a state, not a placeable size', () => {
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      expect(definition.sizes.compact).toEqual(definition.sizes.regular);
    }
  });

  it('makes every wide footprint wider than its regular one', () => {
    // The tables start at two columns rather than one — a five-column grid in a single column
    // would shed almost everything before it drew a row.
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      expect(definition.sizes.wide.w).toBeGreaterThan(definition.sizes.regular.w);
    }
  });

  it('never asks for a plugin it does not also require', () => {
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      for (const plugin of definition.capabilityPlugins) {
        expect(definition.requiredPlugins).toContain(plugin);
      }
    }
  });

  it('gives every metric at least one rendering', () => {
    for (const metric of Object.keys(METRIC_DEFINITIONS)) {
      expect(widgetsForMetric(metric as never).length).toBeGreaterThan(0);
    }
  });

  it('identifies a widget type, and rejects a retired generic kind', () => {
    expect(isWidgetType('cpuGauge')).toBe(true);
    // The generic model M0–M9 used. A stored row of this shape is no longer a widget.
    expect(isWidgetType('donut')).toBe(false);
    expect(isWidgetType(undefined)).toBe(false);
  });
});

describe('widgetsForMetric', () => {
  it('orders renderings richest first, with text last', () => {
    const variants = widgetsForMetric('cpu').map((definition) => definition.variant);
    expect(variants).toEqual(['chart', 'gauge', 'text']);
  });

  it('gives system info a single text rendering — identity has no graph', () => {
    const system = widgetsForMetric('system');
    expect(system).toHaveLength(1);
    expect(system[0].variant).toBe('text');
  });

  it('sorts by the catalog variant order rather than by declaration', () => {
    for (const metric of Object.keys(METRIC_DEFINITIONS)) {
      const order = widgetsForMetric(metric as never).map((d) => WIDGET_VARIANTS.indexOf(d.variant));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });
});

describe('metricsByGroup', () => {
  it('lists groups in catalog order', () => {
    const groups = metricsByGroup().map((entry) => entry.group);
    expect(groups).toEqual(['core', 'system', 'io', 'processes', 'alerts']);
  });
});

describe('isWidgetAvailable', () => {
  it('offers a widget whose plugins the host reports', () => {
    expect(isWidgetAvailable('cpuGauge', ['cpu', 'mem'])).toBe(true);
  });

  it('withholds one whose plugin the host does not have', () => {
    expect(isWidgetAvailable('percpu', ['cpu', 'mem'])).toBe(false);
  });

  it('treats unknown capabilities as available', () => {
    // The probe may simply not have answered yet; greying out the whole catalog while waiting
    // would be worse than offering a widget that renders "not available".
    expect(isWidgetAvailable('percpu', undefined)).toBe(true);
    expect(isWidgetAvailable('percpu', [])).toBe(true);
  });

  it('ignores a merely nice-to-have plugin', () => {
    // memoryGauge requires memswap but only declares mem as a capability: a host without swap
    // still draws the ring, it just has no swap row.
    expect(WIDGET_DEFINITIONS.memoryGauge.requiredPlugins).toContain('memswap');
    expect(isWidgetAvailable('memoryGauge', ['mem'])).toBe(true);
  });
});

describe('parseWidgetConfig', () => {
  it('fills in the schema defaults for an empty config', () => {
    expect(parseWidgetConfig('cpu', {})).toEqual({ split: false, perCoreOverlay: false, windowSec: 300 });
  });

  it('keeps values the user chose', () => {
    expect(parseWidgetConfig('cpu', { split: true, windowSec: 900 })).toMatchObject({
      split: true,
      windowSec: 900,
    });
  });

  it('falls back per key, so one bad option does not undo the others', () => {
    // Resetting a whole config because a single field went bad would quietly discard settings the
    // user made deliberately.
    expect(parseWidgetConfig('cpu', { split: true, windowSec: 'yesterday' })).toEqual({
      split: true,
      perCoreOverlay: false,
      windowSec: 300,
    });
  });

  it('falls back to defaults rather than throwing on something that is not a config at all', () => {
    // A widget with the wrong options is recoverable — the user re-picks them. One that refuses to
    // render is not.
    expect(parseWidgetConfig('cpu', null)).toMatchObject({ windowSec: 300, split: false });
    expect(parseWidgetConfig('cpu', 42)).toMatchObject({ windowSec: 300 });
    expect(parseWidgetConfig('cpu', ['nope'])).toMatchObject({ windowSec: 300 });
  });

  it('accepts a config left over from a type that had different options', () => {
    expect(parseWidgetConfig('memoryText', { showSwap: false, someRetiredKey: 1 })).toMatchObject({
      showSwap: false,
    });
  });
});

describe('requestedWindowSec', () => {
  it('reads a window a widget asked for', () => {
    expect(requestedWindowSec({ windowSec: 900 })).toBe(900);
  });

  it('resolves the legacy 0 to the cap rather than to no history', () => {
    expect(requestedWindowSec({ windowSec: 0 })).toBe(1800);
  });

  it('is undefined when the widget keeps no series', () => {
    expect(requestedWindowSec({})).toBeUndefined();
    expect(requestedWindowSec({ windowSec: 'x' })).toBeUndefined();
  });
});

describe('clearEndpointScopedConfig', () => {
  it('drops host-specific selections and keeps the rest', () => {
    // Carrying `enp5s0` to a host without one would draw an empty chart with no explanation.
    expect(
      clearEndpointScopedConfig({ interfaces: ['enp5s0'], disks: ['sda'], unit: 'bits', windowSec: 900 }),
    ).toEqual({ unit: 'bits', windowSec: 900 });
  });

  it('does not mutate its input', () => {
    const config = { interfaces: ['eth0'] };
    clearEndpointScopedConfig(config);
    expect(config).toEqual({ interfaces: ['eth0'] });
  });
});

describe('pluginsForEndpoint', () => {
  const widgets = [
    { type: 'cpu', endpointId: 'e1' },
    { type: 'memoryGauge', endpointId: 'e1' },
    { type: 'load', endpointId: 'e2' },
  ];

  it('unions what this endpoint widgets require, and nothing else', () => {
    expect(pluginsForEndpoint('e1', widgets).sort()).toEqual(['cpu', 'mem', 'memswap', 'percpu']);
    expect(pluginsForEndpoint('e2', widgets)).toEqual(['load']);
  });

  it('is empty for an endpoint with no widgets', () => {
    expect(pluginsForEndpoint('e3', widgets)).toEqual([]);
  });

  it('ignores a row whose type is no longer in the catalog', () => {
    // A generic widget left over from before the migration must not crash the poller.
    expect(pluginsForEndpoint('e1', [{ type: 'donut', endpointId: 'e1' }])).toEqual([]);
  });

  it('de-duplicates across widgets sharing a plugin', () => {
    const two = [
      { type: 'cpu', endpointId: 'e1' },
      { type: 'cpuGauge', endpointId: 'e1' },
    ];
    expect(pluginsForEndpoint('e1', two).filter((plugin) => plugin === 'cpu')).toHaveLength(1);
  });
});

describe('retentionSecForEndpoint', () => {
  it('takes the widest window this endpoint widgets ask for', () => {
    expect(
      retentionSecForEndpoint('e1', [
        { type: 'cpu', endpointId: 'e1', config: { windowSec: 300 } },
        { type: 'memory', endpointId: 'e1', config: { windowSec: 900 } },
      ]),
    ).toBe(900);
  });

  it('is undefined when nothing on the endpoint keeps a series', () => {
    // The buffers then apply their own floor; the catalog does not invent a retention.
    expect(
      retentionSecForEndpoint('e1', [{ type: 'cpuGauge', endpointId: 'e1', config: {} }]),
    ).toBeUndefined();
  });

  it('ignores widgets belonging to another endpoint', () => {
    expect(
      retentionSecForEndpoint('e1', [{ type: 'memory', endpointId: 'e2', config: { windowSec: 1800 } }]),
    ).toBeUndefined();
  });
});

describe('catalog coverage', () => {
  it('defines every declared type exactly once', () => {
    expect(Object.keys(WIDGET_DEFINITIONS).sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('covers all 26 of the reference renderings', () => {
    // 13 from M12, 10 in M13, 3 in M14 — the reference's own count (ref §8).
    expect(WIDGET_TYPES).toHaveLength(26);
  });

  it('marks exactly one type as cross-endpoint', () => {
    // Scope belongs to the type, never the instance, and the alerts feed is the only global one:
    // it answers for the whole fleet, so filing it under one host would be wrong twice over.
    const global = Object.values(WIDGET_DEFINITIONS).filter((d) => d.scope === 'global');
    expect(global.map((d) => d.type)).toEqual(['alerts']);
  });

  it('offers a text rendering for every metric that has a graphical one', () => {
    // "A picture is an argument and a table is not" — every metric with a chart, ring or bars also
    // answers in plain rows (ref §8).
    for (const metric of Object.keys(METRIC_DEFINITIONS)) {
      const renderings = widgetsForMetric(metric as never);
      if (renderings.length === 1) continue;
      expect(renderings.some((definition) => definition.variant === 'text')).toBe(true);
    }
  });
});

describe('registry coverage', () => {
  it('gives every catalog type a renderer, and adds none the catalog does not know', () => {
    // The two halves are edited separately, so drift between them is the failure mode this guards.
    expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual([...WIDGET_TYPES].sort());
  });
});

describe('endpoint-scoped selections', () => {
  it('covers every scoped key, so a picker can never be missing for one', () => {
    expect(Object.keys(ENDPOINT_SCOPED_SELECTIONS).sort()).toEqual(
      [...ENDPOINT_SCOPED_CONFIG_KEYS].sort(),
    );
  });

  it('reads the options a host is currently reporting', () => {
    expect(ENDPOINT_SCOPED_SELECTIONS.interfaces.options([
      { interfaceName: 'eth0', alias: null },
      { interfaceName: 'lo', alias: null },
    ])).toEqual([
      { value: 'eth0', label: 'eth0' },
      { value: 'lo', label: 'lo' },
    ]);
  });

  it('prefers a friendly name where the payload carries one', () => {
    expect(ENDPOINT_SCOPED_SELECTIONS.gpus.options([{ gpu_id: 'x', gpuId: 'nvidia0', name: 'RTX 3090' }])).toEqual([
      { value: 'nvidia0', label: 'RTX 3090' },
    ]);
  });

  it('de-duplicates, which is the whole point for sensor types', () => {
    // A host reports dozens of sensors across three types; the picker offers the three.
    const options = ENDPOINT_SCOPED_SELECTIONS.types.options([
      { type: 'temperature_core' },
      { type: 'temperature_core' },
      { type: 'fan_speed' },
    ]);
    expect(options.map((option) => option.value)).toEqual(['fan_speed', 'temperature_core']);
  });

  it('is empty rather than throwing when the endpoint has not answered', () => {
    for (const source of Object.values(ENDPOINT_SCOPED_SELECTIONS)) {
      expect(source.options(undefined)).toEqual([]);
      expect(source.options({ not: 'a list' })).toEqual([]);
    }
  });

  it('names a plugin the metric actually requires', () => {
    // A picker reading a plugin nothing fetches would list nothing, for ever.
    expect(WIDGET_DEFINITIONS.network.requiredPlugins).toContain(ENDPOINT_SCOPED_SELECTIONS.interfaces.plugin);
    expect(WIDGET_DEFINITIONS.diskio.requiredPlugins).toContain(ENDPOINT_SCOPED_SELECTIONS.disks.plugin);
    expect(WIDGET_DEFINITIONS.filesystem.requiredPlugins).toContain(ENDPOINT_SCOPED_SELECTIONS.mounts.plugin);
    expect(WIDGET_DEFINITIONS.sensors.requiredPlugins).toContain(ENDPOINT_SCOPED_SELECTIONS.types.plugin);
    expect(WIDGET_DEFINITIONS.gpu.requiredPlugins).toContain(ENDPOINT_SCOPED_SELECTIONS.gpus.plugin);
  });
});

describe('a global widget belongs to no endpoint', () => {
  it('contributes its plugins to every endpoint, not one', () => {
    // It has no `endpointId` to derive them from, so without this rule the alerts feed would poll
    // /alert nowhere at all (ref §4.4).
    const widgets = [{ type: 'alerts', endpointId: null }];
    expect(pluginsForEndpoint('e1', widgets)).toEqual(['alert']);
    expect(pluginsForEndpoint('e2', widgets)).toEqual(['alert']);
  });

  it('is not confused with an endpoint-scoped widget that has lost its host', () => {
    const orphan = [{ type: 'cpu', endpointId: null }];
    expect(pluginsForEndpoint('e1', orphan)).toEqual([]);
  });
});

describe('optionChoices', () => {
  it('reads an enum option’s cases off the schema, through its default wrapper', () => {
    expect(optionChoices('processes', 'sort')).toEqual(['cpu', 'memory', 'name']);
    expect(optionChoices('alerts', 'severity')).toEqual(['all', 'critical']);
  });

  it('returns nothing for an option that is not a set of choices', () => {
    // The config screen renders a control per *shape*; these two have their own.
    expect(optionChoices('processes', 'rows')).toBeNull();
    expect(optionChoices('alerts', 'includeResolved')).toBeNull();
    expect(optionChoices('cpu', 'nothingByThisName')).toBeNull();
  });

  it('offers a choice for every string option any widget declares', () => {
    // A string with no cases renders no control at all, so the option would be unreachable.
    for (const definition of Object.values(WIDGET_DEFINITIONS)) {
      const defaults = parseWidgetConfig(definition.type, {});
      for (const [key, value] of Object.entries(defaults)) {
        if (typeof value !== 'string') continue;
        expect(optionChoices(definition.type, key)).not.toBeNull();
      }
    }
  });
});
