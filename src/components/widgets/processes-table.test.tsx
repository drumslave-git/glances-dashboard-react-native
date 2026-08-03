import { processListFixture } from '@/__fixtures__/glances';
import { renderWithProviders } from '@/test-utils/render';

import { ProcessesTable } from './processes-table';

describe('ProcessesTable', () => {
  it('renders the default columns with friendly headers', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} width={800} testID="pt" />,
    );

    expect(getByTestId('pt-header-name')).toHaveTextContent('Name');
    expect(getByTestId('pt-header-cpu_percent')).toHaveTextContent('CPU %');
    expect(getByTestId('pt-header-memory_percent')).toHaveTextContent('Mem %');
    expect(getByTestId('pt-header-username')).toHaveTextContent('User');
  });

  it('drops columns by priority as the card narrows, and never scrolls', async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} width={220} testID="pt" />,
    );

    // Name and CPU are priority 1 and survive at any width.
    expect(getByTestId('pt-header-name')).toBeTruthy();
    expect(getByTestId('pt-header-cpu_percent')).toBeTruthy();
    expect(queryByTestId('pt-header-memory_percent')).toBeNull();
    expect(queryByTestId('pt-header-username')).toBeNull();
  });

  it('sorts by CPU descending, so the biggest consumer leads', async () => {
    const { getAllByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} width={800} height={400} testID="pt" />,
    );

    // llama-server is at 534.1%, systemd at 0.
    const rows = getAllByTestId(/^pt-row-/);
    expect(rows[0].props.testID).toBe('pt-row-3144580');
  });

  it('shows only as many rows as fit, never a half one', async () => {
    const { getAllByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} width={800} height={60} testID="pt" />,
    );

    // 60pt less the 22pt header leaves room for one 30pt row.
    expect(getAllByTestId(/^pt-row-/)).toHaveLength(1);
  });

  it('renders a row per process, keyed by pid', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} testID="pt" />,
    );

    expect(getByTestId('pt-row-3144580')).toHaveTextContent(/llama-server/);
    expect(getByTestId('pt-row-1')).toHaveTextContent(/systemd/);
  });

  it('honours configured columns', async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} fields={['name', 'pid']} width={800} testID="pt" />,
    );

    expect(getByTestId('pt-header-pid')).toHaveTextContent('PID');
    expect(queryByTestId('pt-header-username')).toBeNull();
    expect(getByTestId('pt-row-1')).toHaveTextContent(/systemd/);
  });

  it('applies per-column formatters', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProcessesTable
        data={processListFixture}
        fields={['name', 'memory_percent']}
        fieldFormatters={{ memory_percent: 'round(1)' }}
        testID="pt"
      />,
    );

    expect(getByTestId('pt-row-3144580')).toHaveTextContent(/12\.8/);
  });

  it('renders the array cmdline as a readable command line', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProcessesTable data={processListFixture} fields={['cmdline']} testID="pt" />,
    );

    expect(getByTestId('pt-row-1')).toHaveTextContent('/sbin/init');
  });

  it('says so when the payload holds no processes', async () => {
    const { getByTestId } = await renderWithProviders(<ProcessesTable data={[]} testID="pt" />);

    expect(getByTestId('pt-empty')).toHaveTextContent('No processes to show.');
  });

  it('says so when the payload is not a list at all', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProcessesTable data={{ nope: true }} testID="pt" />,
    );

    expect(getByTestId('pt-empty')).toHaveTextContent('No processes to show.');
  });
});
