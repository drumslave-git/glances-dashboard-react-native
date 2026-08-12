/**
 * The memory renderings: a streaming trend, a ring, and the plain readings.
 *
 * Swap is part of the readout rather than an extra: it is what separates "memory is full" from
 * "memory is full and the host has started paying for it".
 */
import { useLatest } from '@/data/feed-store';
import { useTelemetry } from '@/theme/use-telemetry';
import type { MemStats, MemSwapStats } from '@/types/glances';
import { formatFieldValue, formatLooseNumber } from '@/utils/widgetData';

import { RingPanel, SeriesPanel, reading } from '../panels';
import { TextReadout, type ReadoutRow } from '../readout';
import type { WidgetProps } from '../types';
import { useMultiSeries } from '../use-series';
import { windowFromConfig } from './common';

/** The `bytes` formatter, which is a spec the shared formatter interprets. */
const formatBytes = (value: number) => formatFieldValue(value, 'bytes');
const bytes = (value: number | null | undefined) => (value == null ? null : formatBytes(value));

const MEMORY_SELECTORS = { used: (mem: MemStats) => mem.percent };
const SWAP_SELECTORS = { swap: (swap: MemSwapStats) => swap.percent };

export function MemoryChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const mem = useLatest<MemStats>(endpointId, 'mem');
  const swap = useLatest<MemSwapStats>(endpointId, 'memswap');
  const showSwap = config.showSwap !== false;

  const memSeries = useMultiSeries<MemStats>(endpointId, 'mem', MEMORY_SELECTORS);
  const swapSeries = useMultiSeries<MemSwapStats>(endpointId, 'memswap', SWAP_SELECTORS);

  const readings = [
    reading('used', 'Used', mem?.percent ?? null, { unit: '%', percent: mem?.percent ?? null }),
    ...(showSwap && swap
      ? [reading('swap', 'Swap', swap.percent, { unit: '%', percent: swap.percent })]
      : []),
  ];

  return (
    <SeriesPanel
      readings={readings}
      series={{ ...memSeries, ...swapSeries }}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
      // Swap in the warning hue: it is the "started paying for it" line, not a second memory.
      colors={{ used: accentColor, swap: t.signal.warning }}
      {...(testID ? { testID } : {})}
    />
  );
}

export function MemoryGaugeWidget({ endpointId, width, height, accentColor, testID }: WidgetProps) {
  const mem = useLatest<MemStats>(endpointId, 'mem');
  const swap = useLatest<MemSwapStats>(endpointId, 'memswap');

  const readings = [
    reading('used', 'USED', mem?.percent ?? null, {
      text: mem ? formatLooseNumber(mem.percent) : '—',
      unit: '%',
      percent: mem?.percent ?? null,
    }),
    ...(mem
      ? [reading('total', 'TOTAL', mem.used, { text: `${formatBytes(mem.used)} / ${formatBytes(mem.total)}` })]
      : []),
    ...(swap && swap.total > 0
      ? [reading('swap', 'SWAP', swap.used, { text: `${formatBytes(swap.used)} / ${formatBytes(swap.total)}` })]
      : []),
  ];

  return (
    <RingPanel
      readings={readings}
      width={width}
      height={height}
      accentColor={accentColor}
      {...(testID ? { testID } : {})}
    />
  );
}

export function MemoryTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const mem = useLatest<MemStats>(endpointId, 'mem');
  const swap = useLatest<MemSwapStats>(endpointId, 'memswap');
  const showSwap = config.showSwap !== false;

  const rows: ReadoutRow[] = [
    { label: 'Used %', value: mem ? `${formatLooseNumber(mem.percent)}%` : null },
    { label: 'Used', value: bytes(mem?.used) },
    // `available` before `free`: free excludes reclaimable cache and reads alarmingly low on a
    // healthy Linux host, which is exactly the misreading this order avoids.
    { label: 'Available', value: bytes(mem?.available) },
    { label: 'Free', value: bytes(mem?.free) },
    ...(mem?.cached != null ? [{ label: 'Cached', value: bytes(mem.cached) }] : []),
    { label: 'Total', value: bytes(mem?.total) },
  ];

  const groups = [{ rows }];
  if (showSwap && swap) {
    groups.push({
      label: 'Swap',
      rows: [
        { label: 'Used %', value: `${formatLooseNumber(swap.percent)}%` },
        { label: 'Used', value: bytes(swap.used) },
        { label: 'Free', value: bytes(swap.free) },
      ],
    } as never);
  }

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}
