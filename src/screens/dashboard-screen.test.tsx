import { usePreferencesStore } from '@/state/preferences';
import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { useUiStore } from '@/state/ui';
import { useWidgetsStore } from '@/state/widgets';
import { renderWithProviders, waitFor } from '@/test-utils/render';
import { resetWidgetIdCounter } from '@/utils/widgetFactory';

import { DashboardScreen } from './dashboard-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const originalFetch = global.fetch;

function mockGlances(payloads: Record<string, unknown>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = payloads[path];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    }
    return Promise.resolve({ ok: true, text: async () => JSON.stringify(body) });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockPush.mockClear();
  resetEndpointIdCounter();
  resetWidgetIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
  useWidgetsStore.setState({ widgets: [] });
  // Edit and immersive mode live in a module-level store now, so without this
  // each test would inherit whatever the previous one toggled.
  useUiStore.setState({ editMode: false, immersive: false });
  usePreferencesStore.setState({ theme: 'dark', readingScale: 1, summaryStripVisible: true });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function addServerAndWidget(fields?: string[]) {
  const server = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
  const widget = useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });
  useWidgetsStore.getState().updateWidget(widget.id, {
    title: 'CPU',
    ...(fields ? { fields } : {}),
  });
  return { server, widget };
}

describe('DashboardScreen - empty states', () => {
  it('asks for a server when none exist', async () => {
    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-no-endpoints')).toBeTruthy();
  });

  it('asks for a widget once a server exists', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-no-widgets')).toBeTruthy();
  });

  it('routes to the widget type picker', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('dashboard-add-first-widget'));

    expect(mockPush).toHaveBeenCalledWith('/widget/pick');
  });
});

describe('DashboardScreen - toolbar', () => {
  it('lists every configured endpoint as a chip', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    const a = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    const b = useEndpointsStore.getState().addEndpoint({ name: 'Builder', url: '10.0.0.2' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId(`toolbar-endpoint-${a.id}`)).toHaveTextContent('NAS');
    expect(getByTestId(`toolbar-endpoint-${b.id}`)).toHaveTextContent('Builder');
  });

  it('carries only static configuration, never live data', async () => {
    // The toolbar auto-hides in immersive mode, so nothing that has to stay
    // readable may live here. The polling cadence is configuration, not telemetry.
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1', pollIntervalMs: 2500 });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('toolbar-refresh')).toHaveTextContent('2.5s refresh');
  });

  it('floors an unreasonably fast cadence at one second', async () => {
    // There is no "fetch once" any more — stopping an endpoint is what pausing it is for. An
    // interval below a second only costs requests, because the server caches its stats for that
    // long and returns the same numbers.
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1', pollIntervalMs: 100 });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('toolbar-refresh')).toHaveTextContent('1s refresh');
  });
});

describe('DashboardScreen - summary strip', () => {
  it('fills its cells from the live payloads', async () => {
    mockGlances({
      '/api/4/system': { hostname: 'tcloud-01', os_version: '6.8.0-45' },
      '/api/4/uptime': { seconds: 31 * 86400 + 12 * 3600 },
      '/api/4/load': { min1: 1.92, min5: 1.44, min15: 1.1 },
      '/api/4/processcount': { total: 412, running: 3 },
      '/api/4/fs': [{ device_name: '/dev/sda1', used: 1.2 * 1024 ** 4, size: 3.6 * 1024 ** 4 }],
    });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() =>
      expect(getByTestId('dashboard-summary-host')).toHaveTextContent(/tcloud-01/),
    );
    expect(getByTestId('dashboard-summary-uptime')).toHaveTextContent(/31d 12h/);
    expect(getByTestId('dashboard-summary-kernel')).toHaveTextContent(/6\.8\.0-45/);
    expect(getByTestId('dashboard-summary-load')).toHaveTextContent(/1\.92/);
    expect(getByTestId('dashboard-summary-processes')).toHaveTextContent(/412/);
    expect(getByTestId('dashboard-summary-disk')).toHaveTextContent(/1\.2 \/ 3\.6 TB/);
  });

  it('can be turned off', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    usePreferencesStore.setState({ summaryStripVisible: false });

    const { queryByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(queryByTestId('dashboard-summary')).toBeNull();
  });
});

describe('DashboardScreen - widgets', () => {
  it('renders a widget with live data', async () => {
    mockGlances({
      '/api/4/system': { hostname: 'nas' },
      '/api/4/cpu': { total: 12.5 },
    });
    const { widget } = addServerAndWidget(['total']);

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() =>
      expect(getByTestId(`widget-content-${widget.id}-hero`)).toHaveTextContent(/12\.5/),
    );
  });

  it('resolves tokens in the widget title', async () => {
    mockGlances({
      '/api/4/system': { hostname: 'nas' },
      '/api/4/cpu': { total: 12.5 },
    });
    const server = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    const widget = useWidgetsStore.getState().addWidget({ serverId: server.id, metric: 'cpu' });
    useWidgetsStore.getState().updateWidget(widget.id, { title: 'CPU {{total}}%' });

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    await waitFor(() =>
      expect(getByTestId(`widget-title-${widget.id}`)).toHaveTextContent('CPU 12.5%'),
    );
  });

  it('shows which endpoint a widget is bound to, on the widget itself', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    // The toolbar hides in immersive mode, so provenance has to live here.
    expect(getByTestId(`widget-endpoint-${widget.id}`)).toHaveTextContent('NAS');
    expect(getByTestId(`widget-accent-${widget.id}`)).toBeTruthy();
  });

  it('removes a widget from the overflow menu', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId(`widget-menu-${widget.id}`));
    await user.press(getByTestId(`widget-menu-sheet-${widget.id}-remove`));

    expect(useWidgetsStore.getState().widgets).toHaveLength(0);
  });

  it('cycles the widget size from the overflow menu', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId(`widget-menu-${widget.id}`));
    await user.press(getByTestId(`widget-menu-sheet-${widget.id}-size`));

    expect(useWidgetsStore.getState().widgets[0].size).toBe('L');
  });

  it('opens the config screen from the overflow menu', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId(`widget-menu-${widget.id}`));
    await user.press(getByTestId(`widget-menu-sheet-${widget.id}-edit`));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: widget.id },
    });
  });
});

describe('DashboardScreen - immersive mode', () => {
  it('hides the header and edit chrome, and shows the widgets', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, queryByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toolbar-immersive'));

    expect(queryByTestId('dashboard-toolbar')).toBeNull();
    expect(queryByTestId('dashboard-summary')).toBeNull();
    expect(queryByTestId('toolbar-edit-layout')).toBeNull();
    expect(getByTestId(`widget-${widget.id}`)).toBeTruthy();
  });

  it('leaves edit mode behind on the way in', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toolbar-edit-layout'));
    await user.press(getByTestId('toolbar-immersive'));

    expect(useUiStore.getState()).toMatchObject({ immersive: true, editMode: false });
  });

  it('exits on a tap', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    addServerAndWidget();

    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('toolbar-immersive'));
    await user.press(getByTestId('dashboard-immersive-exit'));

    expect(useUiStore.getState().immersive).toBe(false);
    expect(getByTestId('dashboard-toolbar')).toBeTruthy();
  });

  // The back and Esc routes out are covered against the hook itself, in
  // src/hooks/useImmersiveMode.test.tsx.
});
