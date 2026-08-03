import { DEFAULT_REFRESH_MS, resetServerIdCounter, useServersStore } from '@/state/servers';
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
  resetServerIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
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

    const [server] = useServersStore.getState().servers;
    expect(server).toMatchObject({
      name: 'NAS',
      url: 'http://192.168.1.10:61208',
      refreshMs: DEFAULT_REFRESH_MS,
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('converts the refresh interval from seconds to milliseconds', async () => {
    const { getByTestId, user } = await renderWithProviders(<ServerFormScreen />);

    await user.type(getByTestId('server-url-input'), 'host');
    await user.clear(getByTestId('server-refresh-input'));
    await user.type(getByTestId('server-refresh-input'), '2');
    await user.press(getByTestId('server-save'));

    expect(useServersStore.getState().servers[0].refreshMs).toBe(2000);
  });

  it('does not save without an address', async () => {
    const { getByTestId, user } = await renderWithProviders(<ServerFormScreen />);

    await user.press(getByTestId('server-save'));

    expect(useServersStore.getState().servers).toHaveLength(0);
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
    const server = useServersStore
      .getState()
      .addServer({ name: 'Old', url: '10.0.0.1', refreshMs: 3000 });
    mockParams = { id: server.id };

    const { getByTestId, getByDisplayValue, user } = await renderWithProviders(<ServerFormScreen />);

    expect(getByDisplayValue('Old')).toBeTruthy();
    expect(getByDisplayValue('3')).toBeTruthy();

    await user.clear(getByTestId('server-name-input'));
    await user.type(getByTestId('server-name-input'), 'New name');
    await user.press(getByTestId('server-save'));

    expect(useServersStore.getState().servers).toHaveLength(1);
    expect(useServersStore.getState().servers[0].name).toBe('New name');
  });
});

describe('ServerFormScreen — connection test', () => {
  it('reports the hostname when the server answers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'nas' }),
    }) as unknown as typeof fetch;

    const { getByTestId, findByTestId, user } = await renderWithProviders(<ServerFormScreen />);
    await user.type(getByTestId('server-url-input'), '10.0.0.5');
    await user.press(getByTestId('server-test'));

    expect(await findByTestId('server-test-ok')).toHaveTextContent('Connected to nas');
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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'nas' }),
    }) as unknown as typeof fetch;

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
