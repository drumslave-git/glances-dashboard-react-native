import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { resetWidgetIdCounter, useWidgetsStore } from '@/state/widgets';
import { feedStore } from '@/data/feed-store';
import { renderWithProviders } from '@/test-utils/render';

import { WidgetConfigScreen } from './widget-config-screen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
let mockParams: { id: string; type?: string; endpointId?: string } = { id: 'new', type: 'cpu' };

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
  mockParams = { id: 'new', type: 'cpu' };
  resetEndpointIdCounter();
  resetWidgetIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
  feedStore.getState().reset();
  useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
});

const widgets = () => useWidgetsStore.getState().widgets;

describe('WidgetConfigScreen — creating', () => {
  it('describes the type being added', async () => {
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-config-description')).toHaveTextContent(/Streaming total CPU/);
  });

  it('adds the widget with the type schema defaults', async () => {
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
    mockParams = { id: 'new', type: 'systemInfo' };
    const { queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(queryByTestId('widget-options')).toBeNull();
  });

  it('says so rather than rendering a form for a type this build lacks', async () => {
    // `donut` was a kind in the retired generic model — a stored row could still name one.
    mockParams = { id: 'new', type: 'donut' };
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-config-unknown')).toBeTruthy();
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
    mockParams = { id: 'new', type: 'network' };
    reportInterfaces();

    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-selection-interfaces-eth0')).toBeTruthy();
    expect(getByTestId('widget-selection-interfaces-docker0')).toBeTruthy();
  });

  it('saves a chosen interface, which then beats the busiest-few fallback', async () => {
    mockParams = { id: 'new', type: 'network' };
    reportInterfaces();

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-selection-interfaces-docker0'));
    await user.press(getByTestId('widget-save'));

    expect(widgets()[0].config).toMatchObject({ interfaces: ['docker0'] });
  });

  it('goes back to choosing for you', async () => {
    mockParams = { id: 'new', type: 'network' };
    reportInterfaces();

    const { getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(getByTestId('widget-selection-interfaces-eth0'));
    await user.press(getByTestId('widget-selection-interfaces-auto'));
    await user.press(getByTestId('widget-save'));

    // Empty is a real choice — "choose for me" — not an unset field.
    expect(widgets()[0].config).toMatchObject({ interfaces: [] });
  });

  it('says so when the endpoint has reported nothing yet', async () => {
    mockParams = { id: 'new', type: 'gpu' };
    const { getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    expect(getByTestId('widget-selection-gpus')).toHaveTextContent(/Nothing reported yet/);
  });
});

describe('WidgetConfigScreen — a global widget', () => {
  beforeEach(() => {
    mockParams = { id: 'new', type: 'alerts' };
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
