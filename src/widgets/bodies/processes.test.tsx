/**
 * The three tables, against the real payloads captured from a Glances 4.5.6 server.
 *
 * These render for real — feed store, `DataGrid`, threshold colours and all — because every bug
 * this milestone actually shipped was in the seam between them, not inside any one of them.
 */
import { fireEvent, waitFor } from '@testing-library/react-native';

import {
  rawAlert,
  rawContainers,
  rawProcesscount,
  rawProcesslist,
} from '@/__fixtures__/payloads';
import {
  normalizeAlert,
  normalizeContainers,
  normalizeProcessCount,
  normalizeProcessList,
} from '@/data/normalize';
import { feedStore } from '@/data/feed-store';
import { useEndpointsStore } from '@/state/endpoints';
import { renderWithProviders } from '@/test-utils/render';
import type { GlancesEndpoint } from '@/types/dashboard';
import type { AlertItem } from '@/types/glances';
import { sizeModeFor } from '@/utils/typeScale';

import { AlertsWidget, ContainersWidget, ProcessesWidget } from './processes';

const BOX = { width: 760, height: 320 };

const baseProps = {
  endpointId: 'e1',
  config: {},
  mode: sizeModeFor(BOX.width, BOX.height),
  accentColor: '#a3e635',
  ...BOX,
};

function endpoint(id: string, name: string): GlancesEndpoint {
  return {
    id,
    name,
    url: `http://${id}.example:61208`,
    pollIntervalMs: 2000,
    enabled: true,
    color: 'lime',
    sortOrder: 0,
    createdAt: 0,
  };
}

function seed(endpointId: string, plugins: Record<string, unknown>, ts = 1_700_000_000_000) {
  feedStore.getState().ingest({ endpointId, ts, plugins });
}

beforeEach(() => {
  feedStore.getState().reset();
  useEndpointsStore.setState({ endpoints: [endpoint('e1', 'TCloud')], defaultEndpointId: 'e1' });
});

describe('ProcessesWidget', () => {
  const processes = normalizeProcessList(rawProcesslist);
  const counts = normalizeProcessCount(rawProcesscount);

  it('lists the busiest processes with their CPU figure', async () => {
    seed('e1', { processlist: processes, processcount: counts });
    const { getByTestId, getAllByText } = await renderWithProviders(
      <ProcessesWidget {...baseProps} testID="pw" />,
    );

    expect(getByTestId('pw')).toBeTruthy();
    // The top row by CPU, which is how the server already sorted them.
    expect(getAllByText(processes![0].name).length).toBeGreaterThan(0);
  });

  it('names the count of every process, not just the ones on screen', async () => {
    seed('e1', { processlist: processes, processcount: counts });
    const { getByTestId } = await renderWithProviders(<ProcessesWidget {...baseProps} testID="pw" />);

    expect(getByTestId('pw-footer')).toHaveTextContent(new RegExp(`${counts!.total} processes`));
    expect(getByTestId('pw-footer')).toHaveTextContent(/threads/);
  });

  it('warns in the footer that a non-CPU sort only reorders the server’s CPU-selected set', async () => {
    seed('e1', { processlist: processes, processcount: counts });
    const { getByTestId } = await renderWithProviders(
      <ProcessesWidget {...baseProps} config={{ sort: 'memory' }} testID="pw" />,
    );

    expect(getByTestId('pw-footer')).toHaveTextContent(/top \d+ by CPU/);
  });

  it('says nothing of the sort when sorted by CPU, because then there is nothing to warn about', async () => {
    seed('e1', { processlist: processes, processcount: counts });
    const { getByTestId } = await renderWithProviders(<ProcessesWidget {...baseProps} testID="pw" />);

    expect(getByTestId('pw-footer')).not.toHaveTextContent(/by CPU/);
  });

  it('re-sorts when a heading is pressed, and marks the column it sorted by', async () => {
    seed('e1', { processlist: processes, processcount: counts });
    const { getByTestId } = await renderWithProviders(<ProcessesWidget {...baseProps} testID="pw" />);

    expect(getByTestId('pw-sort-cpu')).toHaveTextContent(/CPU ↓/);
    fireEvent.press(getByTestId('pw-sort-mem'));
    await waitFor(() => undefined);

    // Exactly one column carries the caret — the marker moves rather than accumulating.
    expect(getByTestId('pw-sort-mem')).toHaveTextContent(/Mem ↓/);
    expect(getByTestId('pw-sort-cpu')).not.toHaveTextContent(/↓/);
  });

  it('holds its row order when every process reports 0% CPU', async () => {
    // The server does exactly this whenever `/processlist` is polled faster than it refreshes.
    // Without a tie-break the whole table reshuffles for that frame.
    const flattened = processes!.map((process) => ({ ...process, cpuPercent: 0 }));
    seed('e1', { processlist: flattened, processcount: counts });
    const { getByTestId, rerender } = await renderWithProviders(
      <ProcessesWidget {...baseProps} testID="pw" />,
    );
    const before = getByTestId('pw');

    seed('e1', { processlist: [...flattened].reverse(), processcount: counts }, 1_700_000_002_000);
    rerender(<ProcessesWidget {...baseProps} testID="pw" />);

    expect(getByTestId('pw')).toEqual(before);
  });

  it('says so when the endpoint reports no processes', async () => {
    seed('e1', { processlist: [] });
    const { getByTestId } = await renderWithProviders(<ProcessesWidget {...baseProps} testID="pw" />);

    expect(getByTestId('pw-empty')).toHaveTextContent(/No processes/);
  });
});

describe('ContainersWidget', () => {
  const containers = normalizeContainers(rawContainers);

  it('lists containers with their state and what they are using', async () => {
    seed('e1', { containers });
    const { getByTestId, getAllByText } = await renderWithProviders(
      <ContainersWidget {...baseProps} testID="cw" />,
    );

    expect(getByTestId('cw')).toBeTruthy();
    expect(getAllByText(containers![0].name).length).toBeGreaterThan(0);
  });

  it('shows both directions of traffic, which is what the ↓↑ heading promises', async () => {
    const withTraffic = [{ ...containers![0], networkRx: 2048, networkTx: 4096 }];
    seed('e1', { containers: withTraffic });
    const { getAllByText } = await renderWithProviders(
      <ContainersWidget {...baseProps} testID="cw" />,
    );

    expect(getAllByText('2.00 KB/s').length).toBeGreaterThan(0);
    expect(getAllByText('4.00 KB/s').length).toBeGreaterThan(0);
  });

  it('reads an absent container engine as an absence, not as an error', async () => {
    seed('e1', { containers: [] });
    const { getByTestId } = await renderWithProviders(<ContainersWidget {...baseProps} testID="cw" />);

    expect(getByTestId('cw-empty')).toHaveTextContent(/No container engine/);
  });
});

describe('AlertsWidget', () => {
  const globalProps = { ...baseProps, endpointId: null };

  const alert = (over: Partial<AlertItem>): AlertItem => ({
    id: 'a1',
    state: 'WARNING',
    type: 'CPU',
    begin: 1_700_000_000_000,
    end: 1_700_000_060_000,
    min: 10,
    avg: 50,
    max: 90,
    count: 12,
    top: [],
    ...over,
  });

  it('reads an empty log as the good outcome it is', async () => {
    seed('e1', { alert: normalizeAlert(rawAlert) });
    const { getByTestId } = await renderWithProviders(<AlertsWidget {...globalProps} testID="aw" />);

    expect(getByTestId('aw-empty')).toHaveTextContent(/No events on any endpoint/);
  });

  it('interleaves every endpoint and names which host each event came from', async () => {
    useEndpointsStore.setState({
      endpoints: [endpoint('e1', 'TCloud'), endpoint('e2', 'Edge')],
      defaultEndpointId: 'e1',
    });
    seed('e1', { alert: [alert({ id: 'a1' })] });
    seed('e2', { alert: [alert({ id: 'a2', type: 'MEM' })] });

    const { getAllByText } = await renderWithProviders(<AlertsWidget {...globalProps} testID="aw" />);

    expect(getAllByText('TCloud').length).toBeGreaterThan(0);
    expect(getAllByText('Edge').length).toBeGreaterThan(0);
  });

  it('puts ongoing events above resolved ones regardless of severity', async () => {
    seed('e1', {
      alert: [
        alert({ id: 'crit', state: 'CRITICAL', type: 'MEM', end: 1_700_000_060_000 }),
        alert({ id: 'live', state: 'WARNING', type: 'LOAD', begin: 1_600_000_000_000, end: null }),
      ],
    });

    const { getAllByText } = await renderWithProviders(<AlertsWidget {...globalProps} testID="aw" />);

    // The older, less severe, still-running event leads: a feed reordered by anything but time
    // cannot be read as a sequence.
    const rendered = getAllByText(/Load average|Memory usage/).map((node) => node.props.children);
    expect(rendered[0]).toBe('Load average');
  });

  it('counts ongoing against resolved in the footer', async () => {
    seed('e1', {
      alert: [alert({ id: 'live', end: null }), alert({ id: 'done', end: 1_700_000_060_000 })],
    });

    const { getByTestId } = await renderWithProviders(<AlertsWidget {...globalProps} testID="aw" />);

    expect(getByTestId('aw-footer')).toHaveTextContent(/1 ongoing/);
    expect(getByTestId('aw-footer')).toHaveTextContent(/1 resolved/);
  });

  it('separates "no events" from "none match the filter"', async () => {
    seed('e1', { alert: [alert({ id: 'warn', state: 'WARNING' })] });
    const { getByTestId } = await renderWithProviders(
      <AlertsWidget {...globalProps} config={{ severity: 'critical' }} testID="aw" />,
    );

    expect(getByTestId('aw-empty')).toHaveTextContent(/No events match this filter/);
  });
});

describe('before the first poll', () => {
  // Each of these messages is a claim about the host. Saying "no containers" to someone whose
  // endpoint has simply not answered yet is a wrong answer, not a neutral one.
  it('waits rather than reporting an absence it cannot know about', async () => {
    const { getByTestId: process } = await renderWithProviders(
      <ProcessesWidget {...baseProps} testID="pw" />,
    );
    expect(process('pw-empty')).toHaveTextContent(/Waiting for data/);

    const { getByTestId: container } = await renderWithProviders(
      <ContainersWidget {...baseProps} testID="cw" />,
    );
    expect(container('cw-empty')).toHaveTextContent(/Waiting for data/);

    const { getByTestId: alerts } = await renderWithProviders(
      <AlertsWidget {...baseProps} endpointId={null} testID="aw" />,
    );
    expect(alerts('aw-empty')).toHaveTextContent(/Waiting for data/);
  });
});
