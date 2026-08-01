import { renderWithProviders } from '@/test-utils/render';

import { DashboardScreen } from './dashboard-screen';

describe('DashboardScreen', () => {
  it('renders inside the app providers', async () => {
    const { getByText, getByTestId } = await renderWithProviders(<DashboardScreen />);

    expect(getByText('Glances Dashboard')).toBeTruthy();
    expect(getByTestId('scaffold-hint')).toBeTruthy();
  });
});
