import { resetServerIdCounter, useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';
import { CHART_PALETTE } from '@/utils/chartColors';
import { resetWidgetIdCounter } from '@/utils/widgetFactory';

import { WidgetConfigScreen } from './widget-config-screen';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
let mockParams: { id: string; kind?: string } = { id: 'new', kind: 'text' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockParams,
}));

const originalFetch = global.fetch;

/** Serve pluginslist and metric payloads the way Glances would. */
function mockGlances(payloads: Record<string, unknown>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = payloads[path];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    }
    return Promise.resolve({ ok: true, json: async () => body });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockBack.mockClear();
  mockDismissTo.mockClear();
  mockParams = { id: 'new', kind: 'text' };
  resetServerIdCounter();
  resetWidgetIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
  useWidgetsStore.setState({ widgets: [] });
  useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('WidgetConfigScreen — creating', () => {
  it('lists metrics from pluginslist, excluding processlist', async () => {
    mockGlances({
      '/api/4/pluginslist': ['cpu', 'mem', 'processlist'],
      '/api/4/cpu': { total: 12 },
    });

    const { findByTestId, queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);

    expect(await findByTestId('widget-metric-option-mem')).toBeTruthy();
    expect(queryByTestId('widget-metric-option-processlist')).toBeNull();
  });

  it('discovers fields from the live payload and saves the selected ones', async () => {
    mockGlances({
      '/api/4/pluginslist': ['cpu'],
      '/api/4/cpu': { total: 12, user: 4, system: 2 },
    });

    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-save'));

    const [widget] = useWidgetsStore.getState().widgets;
    expect(widget).toMatchObject({
      kind: 'text',
      metric: 'cpu',
      endpointPath: '/api/4/cpu',
      fields: ['total', 'user'],
    });
    expect(mockDismissTo).toHaveBeenCalledWith('/');
  });

  it('previews the payload with the chosen fields', async () => {
    mockGlances({
      '/api/4/pluginslist': ['cpu'],
      '/api/4/cpu': { total: 12, user: 4 },
    });

    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));

    // The summary body labels the field and prints its value, rather than dumping
    // 'key = value' lines as the pre-redesign text widget did.
    expect(getByTestId('widget-preview-content-hero')).toHaveTextContent(/12/);
  });

  it('falls back to a generated title', async () => {
    mockGlances({ '/api/4/pluginslist': ['cpu'], '/api/4/cpu': { total: 12 } });

    const { findByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);
    await user.press(await findByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].title).toBe('cpu (text)');
  });

  it('resolves title tokens in the preview', async () => {
    mockGlances({ '/api/4/pluginslist': ['cpu'], '/api/4/cpu': { total: 12.34 } });

    const { findByTestId, getByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    // Typed character-by-character, userEvent swallows one of the braces, so set
    // the value directly — the behaviour under test is token resolution.
    fireEvent.changeText(await findByTestId('widget-title-input'), 'CPU {{total:round(1)}}%');

    await waitFor(() => expect(getByTestId('widget-preview')).toHaveTextContent(/CPU 12\.3%/));
  });

  it('clears selected fields when the metric changes', async () => {
    mockGlances({
      '/api/4/pluginslist': ['cpu', 'mem'],
      '/api/4/cpu': { total: 12 },
      '/api/4/mem': { percent: 40 },
    });

    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-metric-option-mem'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fields).toBeUndefined();
  });

  it('surfaces a failed field fetch', async () => {
    mockGlances({ '/api/4/pluginslist': ['cpu'] });

    const { findByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    const empty = await findByTestId('widget-fields-empty');

    await waitFor(() => expect(empty).toHaveTextContent(/Could not read fields/));
  });
});

describe('WidgetConfigScreen — per-field options', () => {
  beforeEach(() => {
    mockGlances({
      '/api/4/pluginslist': ['cpu'],
      '/api/4/cpu': { total: 12.3456, user: 4, system: 2 },
    });
  });

  it('saves a per-field formatter', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-field-total'));
    await user.press(getByTestId('widget-field-total-formatter-kind-round'));
    // Defaults to 2 decimals; step down to 1 to prove the stepper is wired up.
    await user.press(getByTestId('widget-field-total-formatter-decimals-decrease'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fieldFormatters).toEqual({ total: 'round(1)' });
  });

  it('applies the formatter to the live preview', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-field-total'));
    await user.press(getByTestId('widget-field-total-formatter-kind-round'));

    expect(getByTestId('widget-preview-content-hero')).toHaveTextContent(/12.35/);
  });

  it('offers truncate length and position, and summarises the choice', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-field-total'));
    await user.press(getByTestId('widget-field-total-formatter-kind-truncate'));
    await user.press(getByTestId('widget-field-total-formatter-position-middle'));

    expect(getByTestId('widget-field-total-formatter-summary')).toHaveTextContent(
      'Truncate 10 middle',
    );
  });

  it('clears a formatter when the kind goes back to none', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-field-total'));
    await user.press(getByTestId('widget-field-total-formatter-kind-gb'));
    await user.press(getByTestId('widget-field-total-formatter-kind-none'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fieldFormatters).toEqual({});
  });

  it('forgets formatters for fields that were deselected', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-field-total'));
    await user.press(getByTestId('widget-field-total-formatter-kind-gb'));
    await user.press(getByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fieldFormatters).toEqual({});
  });

  it('reorders the selected fields, which is also their display order', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-total'));
    await user.press(getByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-field-user-up'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fields).toEqual(['user', 'total']);
  });
});

describe('WidgetConfigScreen — chart widgets', () => {
  beforeEach(() => {
    mockParams = { id: 'new', kind: 'donut' };
    mockGlances({
      '/api/4/pluginslist': ['cpu', 'mem'],
      '/api/4/cpu': { total: 12, user: 4, system: 2 },
      '/api/4/mem': { percent: 40, used: 100, free: 200 },
    });
  });

  it('hides the chart sections for a text widget', async () => {
    mockParams = { id: 'new', kind: 'text' };

    const { findByTestId, queryByTestId } = await renderWithProviders(<WidgetConfigScreen />);
    await findByTestId('widget-metric-option-cpu');

    expect(queryByTestId('widget-split-used-free')).toBeNull();
    expect(queryByTestId('widget-chart-options-size-0')).toBeNull();
  });

  it('saves a picked segment colour', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-field-user'));
    // The third palette entry, so the assertion does not depend on the default.
    await user.press(getByTestId('widget-field-user-option-2'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fieldColors).toEqual({ user: CHART_PALETTE[2] });
  });

  it('forgets colours for fields that were deselected', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-field-user'));
    await user.press(getByTestId('widget-field-user-option-2'));
    await user.press(getByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0].fieldColors).toEqual({});
  });

  it('saves the used/free split, the chart label and the chart options', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-split-used-free'));
    fireEvent.changeText(getByTestId('widget-chart-label-input'), 'CPU {{total:round(0)}}%');
    await user.press(getByTestId('widget-chart-options-size-160'));
    await user.press(getByTestId('widget-chart-options-thickness-increase'));
    await user.press(getByTestId('widget-chart-options-labels'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets[0]).toMatchObject({
      kind: 'donut',
      splitPercentageIntoUsedFree: true,
      chartLabel: 'CPU {{total:round(0)}}%',
      donutChartOptions: { size: 160, thickness: 24, withLabels: false },
    });
  });

  it('previews the donut with the selected fields', async () => {
    const { findByTestId, getByTestId, user } = await renderWithProviders(<WidgetConfigScreen />);

    await user.press(await findByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-fields-option-system'));
    await user.press(getByTestId('widget-chart-options-size-160'));

    expect(getByTestId('widget-preview-content-chart-label-user')).toBeTruthy();
    expect(getByTestId('widget-preview-content-chart-centre-label')).toHaveTextContent('cpu');
  });
});

describe('WidgetConfigScreen — editing', () => {
  it('pre-fills from the existing widget and updates in place', async () => {
    mockGlances({
      '/api/4/pluginslist': ['cpu'],
      '/api/4/cpu': { total: 12, user: 4 },
    });

    const serverId = useServersStore.getState().servers[0].id;
    const widget = useWidgetsStore.getState().addWidget({ serverId, metric: 'cpu' });
    useWidgetsStore.getState().updateWidget(widget.id, { title: 'Original', fields: ['total'] });
    mockParams = { id: widget.id };

    const { findByTestId, getByTestId, getByDisplayValue, user } = await renderWithProviders(
      <WidgetConfigScreen />,
    );

    expect(getByDisplayValue('Original')).toBeTruthy();

    await user.press(await findByTestId('widget-fields-option-user'));
    await user.press(getByTestId('widget-save'));

    expect(useWidgetsStore.getState().widgets).toHaveLength(1);
    expect(useWidgetsStore.getState().widgets[0].fields).toEqual(['total', 'user']);
  });
});
