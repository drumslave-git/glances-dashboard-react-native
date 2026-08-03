import { resetServerIdCounter, useServersStore } from '@/state/servers';
import { renderWithProviders } from '@/test-utils/render';

import { DashboardScreen } from './dashboard-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  mockPush.mockClear();
  resetServerIdCounter();
  useServersStore.setState({ servers: [], defaultServerId: null });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('DashboardScreen', () => {
  it('prompts for a server when none are configured', async () => {
    const { getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-no-servers')).toBeTruthy();
  });

  it('opens settings', async () => {
    const { getByTestId, user } = await renderWithProviders(<DashboardScreen />);
    await user.press(getByTestId('open-settings'));

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('shows the default server and its hostname once reachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'nas', linux_distro: 'Debian 12' }),
    }) as unknown as typeof fetch;

    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { getByTestId, findByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-server-name')).toHaveTextContent('NAS');
    expect(await findByTestId('dashboard-hostname')).toHaveTextContent('nas · Debian 12');
  });

  it('reports an unreachable server', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed')) as unknown as typeof fetch;

    useServersStore.getState().addServer({ name: 'NAS', url: '10.0.0.1' });

    const { findByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(await findByTestId('dashboard-error')).toHaveTextContent(
      'Could not reach http://10.0.0.1:61208',
    );
  });
});
