import { usePreferencesStore } from '@/state/preferences';
import { resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { useUiStore } from '@/state/ui';
import { resetWidgetIdCounter, useWidgetsStore } from '@/state/widgets';
import { feedStore } from '@/data/feed-store';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';


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
  // Edit mode and full screen live in a module-level store now, so without this
  // each test would inherit whatever the previous one toggled.
  useUiStore.setState({ editMode: false, fullScreen: false });
  usePreferencesStore.setState({ theme: 'dark', readingScale: 1, summaryStripVisible: true });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function addServerAndWidget(type: 'cpuText' | 'cpuGauge' = 'cpuText') {
  const server = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
  const widget = useWidgetsStore.getState().addWidget({ type, endpointId: server.id, title: 'CPU' });
  return { server, widget };
}

/**
 * Render the dashboard and hand the grid a viewport.
 *
 * The grid draws nothing until it has been measured: the column count and the row height are facts
 * about the box it was given, and rendering a guess would flash the wrong layout on every mount. A
 * test that never fires `layout` therefore sees an empty board.
 */
async function renderDashboard() {
  const view = await renderWithProviders(<DashboardScreen />);
  const grid = view.queryByTestId('widget-grid');
  if (grid) {
    fireEvent(grid, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 700, height: 800 } } });
    await waitFor(() => undefined);
  }
  return view;
}

describe('DashboardScreen - empty states', () => {
  it('asks for a server when none exist', async () => {
    const { getByTestId } = await renderDashboard();

    expect(getByTestId('dashboard-no-endpoints')).toBeTruthy();
  });

  it('asks for a widget once a server exists', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId } = await renderDashboard();

    expect(getByTestId('dashboard-no-widgets')).toBeTruthy();
  });

  it('routes to the widget type picker', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId('dashboard-add-first-widget'));

    expect(mockPush).toHaveBeenCalledWith('/widget/pick');
  });
});

describe('DashboardScreen - toolbar', () => {
  it('lists every configured endpoint as a chip', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    const a = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    const b = useEndpointsStore.getState().addEndpoint({ name: 'Builder', url: '10.0.0.2' });

    const { getByTestId } = await renderDashboard();

    expect(getByTestId(`toolbar-endpoint-${a.id}`)).toHaveTextContent('NAS');
    expect(getByTestId(`toolbar-endpoint-${b.id}`)).toHaveTextContent('Builder');
  });

  it('carries only static configuration, never live data', async () => {
    // The toolbar leaves the flow in full screen, so nothing that has to stay
    // readable may live here. The polling cadence is configuration, not telemetry.
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1', pollIntervalMs: 2500 });

    const { getByTestId } = await renderDashboard();

    expect(getByTestId('toolbar-refresh')).toHaveTextContent('2.5s refresh');
  });

  it('floors an unreasonably fast cadence at one second', async () => {
    // There is no "fetch once" any more — stopping an endpoint is what pausing it is for. An
    // interval below a second only costs requests, because the server caches its stats for that
    // long and returns the same numbers.
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1', pollIntervalMs: 100 });

    const { getByTestId } = await renderDashboard();

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

    const { getByTestId } = await renderDashboard();

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

    const { queryByTestId } = await renderDashboard();

    expect(queryByTestId('dashboard-summary')).toBeNull();
  });
});

describe('DashboardScreen - widgets', () => {
  it('renders a widget from the feed, not from its own request', async () => {
    // Widget bodies read the poller's store now, so seeding it is what drives them — there is no
    // per-widget query left to mock.
    mockGlances({ '/api/4/system': { hostname: 'nas' } });
    const { server, widget } = addServerAndWidget();
    feedStore.getState().ingest({
      endpointId: server.id,
      ts: Date.now(),
      plugins: { cpu: { total: 12.5, user: 4, system: 2, idle: 93.5 } },
    });

    const { getByTestId } = await renderDashboard();

    expect(getByTestId(`widget-content-${widget.id}`)).toHaveTextContent(/12\.5/);
  });

  it('falls back to the type own label when the widget has no title', async () => {
    mockGlances({ '/api/4/system': { hostname: 'nas' }, '/api/4/cpu': { total: 12.5 } });
    const server = useEndpointsStore.getState().addEndpoint({ name: 'NAS', url: '10.0.0.1' });
    const widget = useWidgetsStore.getState().addWidget({ type: 'cpuText', endpointId: server.id });

    const { getByTestId } = await renderDashboard();

    expect(getByTestId(`widget-title-${widget.id}`)).toHaveTextContent('CPU readings');
  });

  it('shows which endpoint a widget is bound to, on the widget itself', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId } = await renderDashboard();

    // The toolbar hides in immersive mode, so provenance has to live here.
    expect(getByTestId(`widget-endpoint-${widget.id}`)).toHaveTextContent('NAS');
    expect(getByTestId(`widget-accent-${widget.id}`)).toBeTruthy();
  });

  it('removes a widget from the overflow menu', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId(`widget-menu-${widget.id}`));
    await user.press(getByTestId(`widget-menu-sheet-${widget.id}-remove`));

    expect(useWidgetsStore.getState().widgets).toHaveLength(0);
  });

  it('opens the config screen from the overflow menu', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId(`widget-menu-${widget.id}`));
    await user.press(getByTestId(`widget-menu-sheet-${widget.id}-edit`));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/widget/[id]',
      params: { id: widget.id },
    });
  });
});

describe('DashboardScreen - full screen', () => {
  it('takes the toolbar and the strip out of the flow, and keeps the widgets', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, queryByTestId, user } = await renderDashboard();
    await user.press(getByTestId('toolbar-full-screen'));

    expect(queryByTestId('dashboard-toolbar')).toBeNull();
    expect(queryByTestId('dashboard-summary')).toBeNull();
    expect(queryByTestId('toolbar-edit-layout')).toBeNull();
    expect(getByTestId(`widget-${widget.id}`)).toBeTruthy();
  });

  it('does not remount the grid on the way in — the board is measured once', async () => {
    // The grid draws nothing until it has been measured, so a re-parented grid would blank the
    // board for a frame and take every widget's mounted state with it.
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    const { widget } = addServerAndWidget();

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId('toolbar-full-screen'));

    expect(getByTestId(`widget-cell-${widget.id}`)).toBeTruthy();
  });

  it('leaves edit mode behind on the way in', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    addServerAndWidget();

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId('toolbar-edit-layout'));
    await user.press(getByTestId('toolbar-full-screen'));

    expect(useUiStore.getState()).toMatchObject({ fullScreen: true, editMode: false });
  });

  it('leaves by the reveal strip, which is the only chrome full screen keeps', async () => {
    mockGlances({ '/api/4/system': {}, '/api/4/cpu': { total: 1 } });
    addServerAndWidget();

    const { getByTestId, user } = await renderDashboard();
    await user.press(getByTestId('toolbar-full-screen'));
    await user.press(getByTestId('dashboard-reveal-bar'));

    expect(useUiStore.getState().fullScreen).toBe(false);
    expect(getByTestId('dashboard-toolbar')).toBeTruthy();
  });

  // The back button, Escape, F11 and the browser's own fullscreen are covered against the hooks
  // themselves, in src/hooks/useFullScreen.test.tsx.
});
