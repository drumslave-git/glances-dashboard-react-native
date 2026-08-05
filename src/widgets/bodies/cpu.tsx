/** Every CPU rendering: the streaming chart, the ring, the readings, and the per-core bars. */
import { useMemo } from 'react';

import { useLatest } from '@/data/feed-store';
import { thresholdLevel, thresholdTone } from '@/data/thresholds';
import { useTelemetry } from '@/theme/use-telemetry';
import type { CpuStats, QuicklookStats } from '@/types/glances';
import { formatLooseNumber } from '@/utils/widgetData';

import { RingPanel, SeriesPanel, reading } from '../panels';
import { MeterList, TextReadout, type ReadoutRow } from '../readout';
import type { WidgetProps } from '../types';
import { useMultiSeries } from '../use-series';
import { windowFromConfig } from './common';

/** A percentage, or `null` when the host does not report that field at all. */
function percentRow(label: string, value: number | null | undefined): ReadoutRow {
  return { label, value: value == null ? null : `${formatLooseNumber(value)}%` };
}

export function CpuTextWidget({ endpointId, mode, height, testID }: WidgetProps) {
  const cpu = useLatest<CpuStats>(endpointId, 'cpu');
  const quicklook = useLatest<QuicklookStats>(endpointId, 'quicklook');

  const rows: ReadoutRow[] = [
    percentRow('Total', cpu?.total),
    percentRow('User', cpu?.user),
    percentRow('System', cpu?.system),
    percentRow('Idle', cpu?.idle),
    // Only the fields this host actually reports. A platform that has no iowait is not a host at
    // 0% iowait, and a row of dashes for every optional field would bury the four that matter.
    ...(cpu?.iowait != null ? [percentRow('I/O wait', cpu.iowait)] : []),
    ...(cpu?.nice != null ? [percentRow('Nice', cpu.nice)] : []),
    ...(cpu?.irq != null ? [percentRow('IRQ', cpu.irq)] : []),
    ...(cpu?.steal != null ? [percentRow('Steal', cpu.steal)] : []),
    ...(quicklook?.cpuCoresLog != null
      ? [{ label: 'Threads', value: String(quicklook.cpuCoresLog) }]
      : []),
  ];

  return <TextReadout groups={[{ rows }]} mode={mode} height={height} testID={testID} />;
}

export function PerCpuWidget({ endpointId, mode, height, accentColor, status, testID }: WidgetProps) {
  const cores = useLatest<{ cpuNumber: number; total: number }[]>(endpointId, 'percpu');
  const { t } = useTelemetry();

  const rows = (cores ?? []).map((core) => {
    const tone = thresholdTone(thresholdLevel(status?.limits, 'percpu_user', core.total));
    return {
      label: `#${core.cpuNumber}`,
      percent: core.total,
      color: tone === 'accent' ? accentColor : t.signal[tone],
    };
  });

  return (
    <MeterList rows={rows} mode={mode} height={height} accentColor={accentColor} testID={testID} />
  );
}

export function PerCpuTextWidget({ endpointId, mode, height, testID }: WidgetProps) {
  const cores = useLatest<{ cpuNumber: number; total: number }[]>(endpointId, 'percpu');
  const rows: ReadoutRow[] = (cores ?? []).map((core) =>
    percentRow(`Core ${core.cpuNumber}`, core.total),
  );
  return <TextReadout groups={[{ rows }]} mode={mode} height={height} testID={testID} />;
}

/**
 * The streaming total, optionally split into its user / system / iowait parts.
 *
 * The split is off by default: three stacked traces answer "what is the CPU doing" but make "how
 * busy is it" harder to read at a glance, and the latter is why most people place this widget.
 */
export function CpuChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const cpu = useLatest<CpuStats>(endpointId, 'cpu');
  const split = config.split === true;
  const { t } = useTelemetry();

  const selectors = useMemo(() => {
    const map: Record<string, (stats: CpuStats) => number | null> = {
      total: (stats) => stats.total,
    };
    if (split) {
      map.user = (stats) => stats.user;
      map.system = (stats) => stats.system;
      map.iowait = (stats) => stats.iowait ?? null;
    }
    return map;
  }, [split]);
  const series = useMultiSeries<CpuStats>(endpointId, 'cpu', selectors);

  const readings = [
    reading('total', 'Total', cpu?.total ?? null, { unit: '%', percent: cpu?.total ?? null }),
    ...(split
      ? [
          reading('user', 'User', cpu?.user ?? null, { unit: '%' }),
          reading('system', 'System', cpu?.system ?? null, { unit: '%' }),
          ...(cpu?.iowait != null ? [reading('iowait', 'I/O wait', cpu.iowait, { unit: '%' })] : []),
        ]
      : []),
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
      colors={{ user: t.signal.info, system: t.signal.warning, iowait: t.signal.error }}
      {...(testID ? { testID } : {})}
    />
  );
}

/** The instantaneous total as a threshold-coloured ring. */
export function CpuGaugeWidget({ endpointId, width, height, accentColor, status, testID }: WidgetProps) {
  const cpu = useLatest<CpuStats>(endpointId, 'cpu');
  const { t } = useTelemetry();
  const tone = thresholdTone(thresholdLevel(status?.limits, 'cpu_total', cpu?.total));
  const color = tone === 'accent' ? accentColor : t.signal[tone];

  return (
    <RingPanel
      readings={[
        reading('total', 'BUSY', cpu?.total ?? null, {
          text: cpu ? formatLooseNumber(cpu.total) : '—',
          unit: '%',
          percent: cpu?.total ?? null,
        }),
      ]}
      width={width}
      height={height}
      accentColor={color}
      {...(testID ? { testID } : {})}
    />
  );
}
