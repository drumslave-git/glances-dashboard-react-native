import { cpuFixture, memFixture } from '@/__fixtures__/glances';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';
import { getChartData } from '@/utils/widgetData';

import { ChartView, type ChartKind, type ChartViewProps } from './chart-view';

/**
 * Charts only draw once their container has been measured, which React Native
 * Testing Library never does on its own.
 */
async function measure(element: Parameters<typeof fireEvent>[0], size = 200) {
  fireEvent(element, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: size, height: size } },
  });
  // React 19 renders concurrently, so the resize has to be flushed before asserting.
  await waitFor(() => undefined);
}

// `system` is 0.8% of this payload — a sliver too thin to carry a label, which
// is exactly what `sliceLabels` filters out, so the label tests use the two big ones.
const cpuSegments = getChartData(cpuFixture, ['user', 'idle'], 'dark');

async function renderChart(kind: ChartKind, props: Partial<ChartViewProps> = {}) {
  const view = await renderWithProviders(
    <ChartView kind={kind} segments={cpuSegments} metric="cpu" testID="chart" {...props} />,
  );
  await measure(view.getByTestId('chart'));
  return view;
}

describe('ChartView — donut', () => {
  it('draws a labelled slice per numeric field', async () => {
    const { getByTestId } = await renderChart('donut');

    expect(getByTestId('chart-label-user')).toHaveTextContent('user');
    expect(getByTestId('chart-label-idle')).toHaveTextContent('idle');
  });

  it('falls back to the metric name in the centre', async () => {
    const { getByTestId } = await renderChart('donut');

    expect(getByTestId('chart-centre-label')).toHaveTextContent('cpu');
  });

  it('shows the resolved chart label in the centre when there is one', async () => {
    const { getByTestId } = await renderChart('donut', { chartLabel: 'CPU 46.8%' });

    expect(getByTestId('chart-centre-label')).toHaveTextContent('CPU 46.8%');
  });

  it('labels segments with their formatted value when a formatter is set', async () => {
    const segments = getChartData(memFixture, ['percent'], 'dark', null, false, { percent: 'round(0)' });
    const { getByTestId } = await renderChart('donut', { segments, metric: 'mem' });

    expect(getByTestId('chart-label-percent')).toHaveTextContent('16');
  });

  it('honours the withLabels option', async () => {
    const { queryByTestId } = await renderChart('donut', { options: { withLabels: false } });

    expect(queryByTestId('chart-label-user')).toBeNull();
    expect(queryByTestId('chart-centre-label')).toBeTruthy();
  });

  it('draws nothing until the container has been measured', async () => {
    const { queryByTestId } = await renderWithProviders(
      <ChartView kind="donut" segments={cpuSegments} metric="cpu" testID="chart" />,
    );

    expect(queryByTestId('chart-centre-label')).toBeNull();
  });

  it('draws immediately when a fixed size is configured', async () => {
    const { getByTestId } = await renderWithProviders(
      <ChartView
        kind="donut"
        segments={cpuSegments}
        metric="cpu"
        options={{ size: 160, thickness: 24, paddingAngle: 6 }}
        testID="chart"
      />,
    );

    expect(getByTestId('chart-centre-label')).toBeTruthy();
  });
});

describe('ChartView — pie', () => {
  it('labels its slices but has no centre label', async () => {
    const { getByTestId, queryByTestId } = await renderChart('pie');

    expect(getByTestId('chart-label-idle')).toBeTruthy();
    expect(queryByTestId('chart-centre-label')).toBeNull();
  });

  it('splits a single percentage into Used and Free', async () => {
    const segments = getChartData(memFixture, ['percent'], 'dark', null, true);
    const { getByTestId } = await renderChart('pie', { segments, metric: 'mem' });

    expect(getByTestId('chart-label-Used')).toHaveTextContent('Used');
    expect(getByTestId('chart-label-Free')).toHaveTextContent('Free');
  });
});

describe('ChartView — bar', () => {
  it('lists every bar in the legend', async () => {
    const { getByTestId } = await renderChart('bar');

    expect(getByTestId('chart-legend')).toBeTruthy();
    expect(getByTestId('chart-label-user')).toHaveTextContent('user');
    expect(getByTestId('chart-label-idle')).toHaveTextContent('idle');
  });

  it('hides the legend when labels are off', async () => {
    const { queryByTestId } = await renderChart('bar', { options: { withLabels: false } });

    expect(queryByTestId('chart-legend')).toBeNull();
  });
});
