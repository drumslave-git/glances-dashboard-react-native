import { DEFAULT_POLL_INTERVAL_MS, resetEndpointIdCounter, useEndpointsStore } from '@/state/endpoints';
import { renderWithProviders } from '@/test-utils/render';

import { ServerFormScreen } from './server-form-screen';

const mockBack = jest.fn();
let mockParams: { id: string } = { id: 'new' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const originalFetch = global.fetch;

beforeEach(() => {
  mockBack.mockClear();
  mockParams = { id: 'new' };
  resetEndpointIdCounter();
  useEndpointsStore.setState({ endpoints: [], defaultEndpointId: null });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('ServerFormScreen — adding', () => {
  it('saves a new server, filling in scheme and port', async () => {
    const { getByTestId, user } = await renderWithProviders(<ServerFormScreen />);

    await user.type(getByTestId('server-name-input'), 'NAS');
    await user.type(getByTestId('server-url-input'), '192.168.1.10');
    await user.press(getByTestId('server-save'));

    const [server] = useEndpointsStore.getState().endpoints;
    expect(server).toMatchObject({
      name: 'NAS',
      url: 'http://192.168.1.10:61208',
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('converts the refresh interval from seconds to milliseconds', async () => {
    const { getByTestId, user } = await renderWithProviders(<ServerFormScreen />);

    await user.type(getByTestId('server-url-input'), 'host');
    await user.clear(getByTestId('server-refresh-input'));
    await user.type(getByTestId('server-refresh-input'), '2');
    await user.press(getByTestId('server-save'));

    expect(useEndpointsStore.getState().endpoints[0].pollIntervalMs).toBe(2000);
  });

  it('does not save without an address', async () => {
    const { getByTestId, user } = await renderWithProviders(<ServerFormScreen />);

    await user.press(getByTestId('server-save'));

    expect(useEndpointsStore.getState().endpoints).toHaveLength(0);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('previews the normalised address', async () => {
    const { getByTestId, getByText, user } = await renderWithProviders(<ServerFormScreen />);

    await user.type(getByTestId('server-url-input'), '10.0.0.5');

    expect(getByText('http://10.0.0.5:61208')).toBeTruthy();
  });
});

describe('ServerFormScreen — editing', () => {
  it('pre-fills the form and updates in place', async () => {
    const server = useEndpointsStore
      .getState()
      .addEndpoint({ name: 'Old', url: '10.0.0.1', pollIntervalMs: 3000 });
    mockParams = { id: server.id };

    const { getByTestId, getByDisplayValue, user } = await renderWithProviders(<ServerFormScreen />);

    expect(getByDisplayValue('Old')).toBeTruthy();
    expect(getByDisplayValue('3')).toBeTruthy();

    await user.clear(getByTestId('server-name-input'));
    await user.type(getByTestId('server-name-input'), 'New name');
    await user.press(getByTestId('server-save'));

    expect(useEndpointsStore.getState().endpoints).toHaveLength(1);
    expect(useEndpointsStore.getState().endpoints[0].name).toBe('New name');
  });
});

describe('ServerFormScreen — connection test', () => {
  it('reports the Glances version and how many plugins the host offers', async () => {
    // "Did something reply" is not the question — which version, and what can it do, is.
    // The test now probes: /status for the version, then pluginslist and limits.
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          url.endsWith('/api/4/status')
            ? JSON.stringify({ version: '4.5.6' })
            : url.endsWith('/api/4/pluginslist')
              ? JSON.stringify(['cpu', 'mem', 'gpu'])
              : JSON.stringify({}),
      }),
    ) as unknown as typeof fetch;

    const { getByTestId, findByTestId, user } = await renderWithProviders(<ServerFormScreen />);
    await user.type(getByTestId('server-url-input'), '10.0.0.5');
    await user.press(getByTestId('server-test'));

    const ok = await findByTestId('server-test-ok');
    expect(ok).toHaveTextContent(/Glances 4\.5\.6/);
    expect(ok).toHaveTextContent(/3 plugins/);
  });

  it('names a Glances 3.x server as unsupported rather than failing cryptically', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: url.includes('/api/3/'),
        status: url.includes('/api/3/') ? 200 : 404,
        text: async () => '',
      }),
    ) as unknown as typeof fetch;

    const { getByTestId, findByTestId, user } = await renderWithProviders(<ServerFormScreen />);
    await user.type(getByTestId('server-url-input'), '10.0.0.5');
    await user.press(getByTestId('server-test'));

    expect(await findByTestId('server-test-error')).toHaveTextContent(/3\.x/);
  });

  it('shows the failure reason when unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed')) as unknown as typeof fetch;

    const { getByTestId, findByTestId, user } = await renderWithProviders(<ServerFormScreen />);
    await user.type(getByTestId('server-url-input'), '10.0.0.5');
    await user.press(getByTestId('server-test'));

    expect(await findByTestId('server-test-error')).toHaveTextContent('Network request failed');
  });

  it('clears a previous result when the address changes', async () => {
    // The test now probes: /status for the version, then pluginslist and limits.
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          url.endsWith('/api/4/status')
            ? JSON.stringify({ version: '4.5.6' })
            : url.endsWith('/api/4/pluginslist')
              ? JSON.stringify(['cpu', 'mem', 'gpu'])
              : JSON.stringify({}),
      }),
    ) as unknown as typeof fetch;

    const { getByTestId, findByTestId, queryByTestId, user } = await renderWithProviders(
      <ServerFormScreen />,
    );
    await user.type(getByTestId('server-url-input'), '10.0.0.5');
    await user.press(getByTestId('server-test'));
    await findByTestId('server-test-ok');

    await user.type(getByTestId('server-url-input'), '9');

    expect(queryByTestId('server-test-ok')).toBeNull();
  });
});
