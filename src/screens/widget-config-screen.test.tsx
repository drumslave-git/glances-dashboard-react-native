import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { resetWidgetIdCounter, useWidgetsStore } from '@/state/widgets';
import { feedStore } from '@/data/feed-store';
import { renderWithProviders } from '@/test-utils/render';
import type { WidgetType } from '@/widgets/catalog';
import { paletteFor } from '@/components/settings/appearance-fields';

import { WidgetConfigScreen } from './widget-config-screen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
let mockParams: { id: string } = { id: 'w-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: mockReplace,
    dismissAll: mockDismissAll,
  }),
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockDismissAll.mockClear();
  mockParams = { id: 'w-1' };
  resetEndpointIdCounter();
  resetWidgetIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
  feedStore.getState().reset();
  useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
});

const widgets = () => useWidgetsStore.getState().widgets;

/**
 * Place a widget and point the screen at it.
 *
 * The screen edits, and only edits: the picker places the widget itself, at the footprint its size
 * cards previewed, so there is no creation path left here to test.
 */
function seed(type: WidgetType) {
  const widget = useWidgetsStore.getState().addWidget({ type, endpointId: 's-1' });
  mockParams = { id: widget.id };
  return widget;
}

describe('WidgetConfigScreen — the type’s own options', () => {
  beforeEach(() => {
    seed('cpu');
  });

  it('describes the type being edited', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-config-description')).toHaveTextContent(/Streaming total CPU/);
  });

  it('saves the type schema defaults untouched', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-save'));

    expect(widgets()).toHaveLength(1);
    expect(widgets()[0]).toMatchObject({ type: 'cpu', endpointId: 's-1', title: null });
    expect(widgets()[0].config).toEqual({ split: false, perCoreOverlay: false, windowSec: 300 });
  });

  it('keeps a blank title as null, meaning "use the type label"', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.type(getByTestId('widget-title-input'), '   ');
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].title).toBeNull();
  });

  it('saves a title the user typed', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.type(getByTestId('widget-title-input'), 'Build box');
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].title).toBe('Build box');
  });

  it('offers only the options this type declares', async () => {
    // The generic model asked every widget the same questions. A typed one asks its own.
    const { getByTestId, queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-option-split')).toBeTruthy();
    expect(queryByTestId('widget-option-showSwap')).toBeNull();
  });

  it('saves a toggled option', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-option-split'));
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].config).toMatchObject({ split: true });
  });

  it('saves a chosen time window, in seconds', async () => {
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-window-15m'));
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].config).toMatchObject({ windowSec: 900 });
  });

  it('shows no options at all for a type that declares none', async () => {
    seed('systemInfo');
    const { queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(queryByTestId('widget-options')).toBeNull();
  });

  it('says so rather than rendering a form for a type this build lacks', async () => {
    // `donut` was a kind in the retired generic model — a stored row could still name one.
    useWidgetsStore.setState({
      widgets: [
        {
          id: 'w-9',
          type: 'donut',
          endpointId: 's-1',
          title: null,
          config: {},
          x: 0,
          y: 0,
          w: 1,
          h: 3,
          createdAt: 0,
        },
      ],
    });
    mockParams = { id: 'w-9' };

    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-config-unknown')).toHaveTextContent(/not available in this build/);
  });

  it('says so when the widget has been removed from under it', async () => {
    useWidgetsStore.setState({ widgets: [] });
    mockParams = { id: 'w-404' };

    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-config-unknown')).toHaveTextContent(/no longer on the dashboard/);
  });
});

describe('WidgetConfigScreen — editing', () => {
  it('pre-fills from the existing widget and updates in place', async () => {
    const widget = useWidgetsStore
      .getState()
      .addWidget({ type: 'memoryText', endpointId: 's-1', title: 'RAM' });
    mockParams = { id: widget.id };

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-title-input')).toHaveDisplayValue('RAM');

    await user.press(getByTestId('widget-option-showSwap'));
    await user.press(getByTestId('widget-save'));

    expect(widgets()).toHaveLength(1);
    expect(widgets()[0].config).toMatchObject({ showSwap: false });
  });

  it('rebinds to another endpoint and clears host-specific selections', async () => {
    // Carrying a selection naming something on the old host would draw an empty panel with no
    // explanation, rather than degrading visibly.
    const second = useEndpointsStore.getState().addEndpoint({ name: 'Other', url: '10.0.0.2' });
    const widget = useWidgetsStore.getState().addWidget({ type: 'cpu', endpointId: 's-1' });
    useWidgetsStore.getState().updateWidget(widget.id, {
      config: { ...widget.config, interfaces: ['enp5s0'] },
    });
    mockParams = { id: widget.id };

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId(`widget-endpoint-${second.id}`));
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].endpointId).toBe(second.id);
    expect(widgets()[0].config).not.toHaveProperty('interfaces');
  });
});

describe('WidgetConfigScreen — host-specific selections', () => {
  /** The picker lists what the endpoint is reporting, so the feed is what drives it. */
  function reportInterfaces() {
    feedStore.getState().ingest({
      endpointId: 's-1',
      ts: Date.now(),
      plugins: {
        network: [
          { interfaceName: 'eth0', alias: null, rxRatePerSec: 10, txRatePerSec: 1, bytesRecvGauge: null, bytesSentGauge: null, speed: null },
          { interfaceName: 'docker0', alias: null, rxRatePerSec: 0, txRatePerSec: 0, bytesRecvGauge: null, bytesSentGauge: null, speed: null },
        ],
      },
    });
  }

  it('offers the interfaces this endpoint reports', async () => {
    seed('network');
    reportInterfaces();

    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-selection-interfaces-eth0')).toBeTruthy();
    expect(getByTestId('widget-selection-interfaces-docker0')).toBeTruthy();
  });

  it('saves a chosen interface, which then beats the busiest-few fallback', async () => {
    seed('network');
    reportInterfaces();

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-selection-interfaces-docker0'));
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].config).toMatchObject({ interfaces: ['docker0'] });
  });

  it('goes back to choosing for you', async () => {
    seed('network');
    reportInterfaces();

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-selection-interfaces-eth0'));
    await user.press(getByTestId('widget-selection-interfaces-auto'));
    await user.press(getByTestId('widget-save'));

    // Empty is a real choice — "choose for me" — not an unset field.
    expect(widgets()[0].config).toMatchObject({ interfaces: [] });
  });

  it('says so when the endpoint has reported nothing yet', async () => {
    seed('gpu');
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-selection-gpus')).toHaveTextContent(/Nothing reported yet/);
  });
});

describe('WidgetConfigScreen — a global widget', () => {
  beforeEach(() => {
    seed('alerts');
  });

  it('offers no endpoint to bind to, and says why', async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);

    expect(queryByTestId('widget-endpoint-s-1')).toBeNull();
    expect(getByTestId('widget-endpoint-global')).toHaveTextContent(/every endpoint/);
  });

  it('saves with no endpoint, so deleting a host cannot take it down', async () => {
    // `removeWidgetsForEndpoint` deletes by endpoint id. A global widget stored against a host
    // would be deleted with that host — the exact outcome the global scope exists to prevent.
    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-save'));

    expect(widgets()).toHaveLength(1);
    expect(widgets()[0]).toMatchObject({ type: 'alerts', endpointId: null });
  });

  it('renders the options its schema declares', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);

    expect(getByTestId('widget-option-includeResolved')).toBeTruthy();
    expect(getByTestId('widget-option-severity-critical')).toBeTruthy();
  });
});

describe('WidgetConfigScreen — the widget own background', () => {
  it('inherits the board by default, and stores nothing for it', async () => {
    const widget = seed('cpu');

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-save'));

    expect(widgets().find((entry) => entry.id === widget.id)?.appearance).toBeNull();
  });

  it('overrides it with one of the design own surfaces', async () => {
    const widget = seed('cpu');
    const swatch = paletteFor('dark')[2];

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId(`widget-background-${swatch.replace('#', '')}`));
    await user.press(getByTestId('widget-save'));

    const saved = widgets().find((entry) => entry.id === widget.id);
    // Both schemes get the same hex: a per-widget override is a mark on one card, and the board
    // colours every panel inherits are the ones edited per scheme.
    expect(saved?.appearance?.background?.dark.color).toBe(swatch);
    expect(saved?.appearance?.background?.light.color).toBe(swatch);
  });

  it('goes back to inheriting', async () => {
    const widget = seed('cpu');
    const swatch = paletteFor('dark')[2];

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId(`widget-background-${swatch.replace('#', '')}`));
    await user.press(getByTestId('widget-background-inherit'));
    await user.press(getByTestId('widget-save'));

    expect(widgets().find((entry) => entry.id === widget.id)?.appearance).toBeNull();
  });
});
