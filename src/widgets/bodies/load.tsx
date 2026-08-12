/**
 * Load average: the three run-queue figures, streaming or as rows.
 *
 * Load is not a percentage — it is a queue length — so normalizing it by core count is offered
 * rather than assumed. A load of 8 means something entirely different on 4 cores and on 64, and
 * the heading says which reading is on screen instead of leaving it to be inferred.
 */
import { useMemo } from 'react';

import { useLatest } from '@/data/feed-store';
import { useTelemetry } from '@/theme/use-telemetry';
import type { LoadStats } from '@/types/glances';
import { formatLooseNumber } from '@/utils/widgetData';

import { SeriesPanel, reading } from '../panels';
import { TextReadout, type ReadoutRow } from '../readout';
import type { WidgetProps } from '../types';
import { useMultiSeries } from '../use-series';
import { windowFromConfig } from './common';

/** `cpucore` can be absent or zero on an odd host; dividing by it must not produce Infinity. */
function normalized(value: number, cores: number, on: boolean): number {
  if (!on) return value;
  return cores > 0 ? (value / cores) * 100 : value;
}

export function LoadChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const load = useLatest<LoadStats>(endpointId, 'load');
  const normalize = config.normalize === true;

  const selectors = useMemo(
    () => ({
      min1: (stats: LoadStats) => normalized(stats.min1, stats.cpucore, normalize),
      min5: (stats: LoadStats) => normalized(stats.min5, stats.cpucore, normalize),
      min15: (stats: LoadStats) => normalized(stats.min15, stats.cpucore, normalize),
    }),
    [normalize],
  );
  const series = useMultiSeries<LoadStats>(endpointId, 'load', selectors);

  const unit = normalize ? '%' : null;
  const value = (raw: number | undefined) =>
    raw == null || !load ? null : normalized(raw, load.cpucore, normalize);

  const readings = [
    reading('min1', '1 min', value(load?.min1), { unit, percent: normalize ? value(load?.min1) : null }),
    reading('min5', '5 min', value(load?.min5), { unit }),
    reading('min15', '15 min', value(load?.min15), { unit }),
  ];

  return (
    <SeriesPanel
      readings={readings}
      series={series}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
      // Three windows of the same queue: the instant reading leads in the accent, the smoothed
      // ones recede — same rule as the CPU chart's user/system split.
      colors={{ min1: accentColor, min5: t.signal.info, min15: t.signal.muted }}
      {...(testID ? { testID } : {})}
    />
  );
}

export function LoadTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const load = useLatest<LoadStats>(endpointId, 'load');
  const normalize = config.normalize === true;

  const show = (raw: number | undefined): string | null => {
    if (raw == null || !load) return null;
    const value = normalized(raw, load.cpucore, normalize);
    return normalize ? `${formatLooseNumber(value)}%` : formatLooseNumber(value);
  };

  const rows: ReadoutRow[] = [
    { label: '1 minute', value: show(load?.min1) },
    { label: '5 minutes', value: show(load?.min5) },
    { label: '15 minutes', value: show(load?.min15) },
    { label: 'Cores', value: load ? String(load.cpucore) : null },
  ];

  return (
    <TextReadout
      // The heading carries "per core" when normalized, because the same three numbers mean two
      // different things and nothing else on the panel would say which.
      groups={[{ label: normalize ? 'Load, per core' : 'Load average', rows }]}
      mode={mode}
      height={height}
      testID={testID}
    />
  );
}
