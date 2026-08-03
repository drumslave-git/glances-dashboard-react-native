import { cpuFixture, memFixture } from '@/__fixtures__/glances';
import { renderWithProviders } from '@/test-utils/render';

import { getStatusMessage, WidgetContent } from './widget-content';

describe('getStatusMessage', () => {
  it('prioritises a missing server above everything else', () => {
    expect(getStatusMessage({ noServer: true, loading: true, error: 'x', data: {} })).toBe(
      'Pick a server for this widget.',
    );
  });

  it('reports loading only while there is no data yet', () => {
    expect(getStatusMessage({ loading: true, data: null })).toBe('Loading…');
    expect(getStatusMessage({ loading: true, data: { a: 1 } })).toBeNull();
  });

  it('reports errors', () => {
    expect(getStatusMessage({ error: 'HTTP 500', data: null })).toBe('Error: HTTP 500');
  });

  it('reports missing data', () => {
    expect(getStatusMessage({ data: null })).toBe('No data yet.');
  });

  it('returns null when there is data', () => {
    expect(getStatusMessage({ data: { a: 1 } })).toBeNull();
  });
});

describe('WidgetContent', () => {
  it('renders selected fields as text', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="text"
        data={{ total: 12.5, user: 8 }}
        config={{ metric: 'cpu', fields: ['total', 'user'] }}
        testID="w"
      />,
    );

    expect(getByTestId('w-body')).toHaveTextContent(/total = 12\.5/);
    expect(getByTestId('w-body')).toHaveTextContent(/user = 8/);
  });

  it('applies field formatters', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="text"
        data={{ total: 12.3456 }}
        config={{ metric: 'cpu', fields: ['total'], fieldFormatters: { total: 'round(1)' } }}
        testID="w"
      />,
    );

    expect(getByTestId('w-body')).toHaveTextContent('total = 12.3');
  });

  it('shows the raw payload when no fields are selected', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent kind="text" data={{ a: 1 }} config={{ metric: 'cpu' }} testID="w" />,
    );

    expect(getByTestId('w-body')).toHaveTextContent(/"a": 1/);
  });

  it('shows a status message instead of a body', async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <WidgetContent kind="text" data={null} config={{ metric: 'cpu' }} error="boom" testID="w" />,
    );

    expect(getByTestId('w-status')).toHaveTextContent('Error: boom');
    expect(queryByTestId('w-body')).toBeNull();
  });

  it('is explicit about kinds that are not built yet', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent kind="processes" data={[{ a: 1 }]} config={{ metric: 'processlist' }} testID="w" />,
    );

    expect(getByTestId('w-pending')).toHaveTextContent(/M4/);
  });
});

describe('WidgetContent — charts', () => {
  it('renders a donut with a slice per selected field', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="donut"
        data={cpuFixture}
        config={{
          metric: 'cpu',
          fields: ['user', 'system', 'idle'],
          donutChartOptions: { size: 160 },
        }}
        testID="w"
      />,
    );

    expect(getByTestId('w-chart-label-user')).toBeTruthy();
    expect(getByTestId('w-chart-centre-label')).toHaveTextContent('cpu');
  });

  it('resolves tokens in the chart label against live data', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="donut"
        data={memFixture}
        config={{
          metric: 'mem',
          fields: ['percent'],
          chartLabel: 'RAM {{percent:round(0)}}%',
          donutChartOptions: { size: 160 },
        }}
        testID="w"
      />,
    );

    expect(getByTestId('w-chart-centre-label')).toHaveTextContent('RAM 16%');
  });

  it('splits a single percentage into Used and Free when asked', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="pie"
        data={memFixture}
        config={{
          metric: 'mem',
          fields: ['percent'],
          splitPercentageIntoUsedFree: true,
          donutChartOptions: { size: 160 },
        }}
        testID="w"
      />,
    );

    expect(getByTestId('w-chart-label-Used')).toBeTruthy();
    expect(getByTestId('w-chart-label-Free')).toBeTruthy();
  });

  it('lists bars in a legend', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="bar"
        data={cpuFixture}
        config={{ metric: 'cpu', fields: ['user', 'system'] }}
        testID="w"
      />,
    );

    expect(getByTestId('w-chart-legend')).toBeTruthy();
    expect(getByTestId('w-chart-label-system')).toHaveTextContent('system');
  });

  it('says so when nothing in the payload is numeric', async () => {
    const { getByTestId } = await renderWithProviders(
      <WidgetContent
        kind="donut"
        data={{ hostname: 'TCloud' }}
        config={{ metric: 'system' }}
        testID="w"
      />,
    );

    expect(getByTestId('w-status')).toHaveTextContent('No numeric fields to display.');
  });
});
