/**
 * Network and disk throughput — the two metrics whose readings are **rates**.
 *
 * Both come from cumulative counters, and the normalizer has already done the hard part (ref §4.3):
 * a rate is `delta / time_since_update`, never a `_gauge` diff, and it is `null` on the server's
 * first refresh. That `null` reaches the screen as a dash rather than a zero, because plotting a
 * counter as a rate draws a spike and plotting "no reading" as zero draws a trough.
 */
import { useMemo } from 'react';

import { useLatest } from '@/data/feed-store';
import { withAlpha } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { DiskIoItem, NetworkItem } from '@/types/glances';

import { SeriesPanel, reading, type HeroStat } from '../panels';
import { TextReadout, type ReadoutGroup, type ReadoutRow } from '../readout';
import { formatRate, formatTotal, pickBusiest, type RateUnit } from '../rates';
import type { WidgetProps } from '../types';
import { useMultiSeries } from '../use-series';
import { windowFromConfig } from './common';

/** How many interfaces or disks a chart draws before it becomes unreadable. */
const CHART_LIMIT = 2;
const TEXT_LIMIT = 4;

function selectedNames(config: Record<string, unknown>, key: string): string[] {
  const value = config[key];
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : [];
}

function unitOf(config: Record<string, unknown>): RateUnit {
  return config.unit === 'bits' ? 'bits' : 'bytes';
}

/** Combined throughput, for "the busiest few" — a null rate counts as no activity, not as a gap. */
const netActivity = (item: NetworkItem) => (item.rxRatePerSec ?? 0) + (item.txRatePerSec ?? 0);
const diskActivity = (item: DiskIoItem) => (item.readRatePerSec ?? 0) + (item.writeRatePerSec ?? 0);

/**
 * Direction is a colour, not a legend: cyan down, green up — the reference's rule, and the one
 * job `signal.up` exists for. A second item keeps the direction hues at reduced alpha, so
 * direction stays readable before "which item" does.
 */
function directionColors(
  names: readonly string[],
  suffixes: readonly [string, string],
  down: string,
  up: string,
): Record<string, string> {
  const colors: Record<string, string> = {};
  names.forEach((name, index) => {
    const fade = index === 0 ? 1 : 0.45;
    colors[`${name}-${suffixes[0]}`] = index === 0 ? down : withAlpha(down, fade);
    colors[`${name}-${suffixes[1]}`] = index === 0 ? up : withAlpha(up, fade);
  });
  return colors;
}

export function NetworkChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const items = useLatest<NetworkItem[]>(endpointId, 'network') ?? [];
  const unit = unitOf(config);
  const shown = pickBusiest(items, selectedNames(config, 'interfaces'), (i) => i.interfaceName, netActivity, CHART_LIMIT);
  // The payload is a fresh array every poll, so the *names* are the identity that matters: without
  // this the selectors would be rebuilt on every tick and every series re-derived with them.
  const shownNames = shown.map((item) => item.interfaceName).join(',');

  const selectors = useMemo(() => {
    const map: Record<string, (list: NetworkItem[]) => number | null> = {};
    for (const item of shown) {
      const name = item.interfaceName;
      map[`${name}-rx`] = (list) => list.find((i) => i.interfaceName === name)?.rxRatePerSec ?? null;
      map[`${name}-tx`] = (list) => list.find((i) => i.interfaceName === name)?.txRatePerSec ?? null;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownNames]);

  const series = useMultiSeries<NetworkItem[]>(endpointId, 'network', selectors);

  const readings = shown.flatMap((item) => [
    reading(`${item.interfaceName}-rx`, `${item.interfaceName} ↓`, item.rxRatePerSec, {
      text: formatRate(item.rxRatePerSec, unit),
    }),
    reading(`${item.interfaceName}-tx`, `${item.interfaceName} ↑`, item.txRatePerSec, {
      text: formatRate(item.txRatePerSec, unit),
    }),
  ]);

  // The heroes name the interface the widget picked, which is the answer to "busiest of what?" —
  // an auto-selected item the panel never named was indistinguishable from a total.
  const lead = shown[0];
  const heroStats: HeroStat[] = lead
    ? [
        {
          label: `${lead.alias ?? lead.interfaceName} ↓`,
          value: formatRate(lead.rxRatePerSec, unit),
          color: t.signal.info,
        },
        {
          label: `${lead.alias ?? lead.interfaceName} ↑`,
          value: formatRate(lead.txRatePerSec, unit),
          color: t.signal.up,
        },
      ]
    : [];

  return (
    <SeriesPanel
      readings={readings}
      series={series}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
      colors={directionColors(shown.map((item) => item.interfaceName), ['rx', 'tx'], t.signal.info, t.signal.up)}
      heroStats={heroStats}
      formatStatValue={(value) => formatRate(value, unit)}
      {...(testID ? { testID } : {})}
    />
  );
}

export function NetworkTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const items = useLatest<NetworkItem[]>(endpointId, 'network') ?? [];
  const unit = unitOf(config);
  const shown = pickBusiest(items, selectedNames(config, 'interfaces'), (i) => i.interfaceName, netActivity, TEXT_LIMIT);

  const groups: ReadoutGroup[] = shown.map((item) => ({
    label: item.alias ?? item.interfaceName,
    rows: [
      { label: 'Download', value: formatRate(item.rxRatePerSec, unit) },
      { label: 'Upload', value: formatRate(item.txRatePerSec, unit) },
      // The lifetime counters, which are totals and not rates — hence no "/s".
      { label: 'Received', value: formatTotal(item.bytesRecvGauge, unit) },
      { label: 'Sent', value: formatTotal(item.bytesSentGauge, unit) },
    ] satisfies ReadoutRow[],
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}

export function DiskIoChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const items = useLatest<DiskIoItem[]>(endpointId, 'diskio') ?? [];
  const shown = pickBusiest(items, selectedNames(config, 'disks'), (i) => i.diskName, diskActivity, CHART_LIMIT);
  const shownNames = shown.map((item) => item.diskName).join(',');

  const selectors = useMemo(() => {
    const map: Record<string, (list: DiskIoItem[]) => number | null> = {};
    for (const item of shown) {
      const name = item.diskName;
      map[`${name}-read`] = (list) => list.find((i) => i.diskName === name)?.readRatePerSec ?? null;
      map[`${name}-write`] = (list) => list.find((i) => i.diskName === name)?.writeRatePerSec ?? null;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownNames]);

  const series = useMultiSeries<DiskIoItem[]>(endpointId, 'diskio', selectors);

  const readings = shown.flatMap((item) => [
    reading(`${item.diskName}-read`, `${item.diskName} read`, item.readRatePerSec, {
      text: formatRate(item.readRatePerSec),
    }),
    reading(`${item.diskName}-write`, `${item.diskName} write`, item.writeRatePerSec, {
      text: formatRate(item.writeRatePerSec),
    }),
  ]);

  const lead = shown[0];
  const heroStats: HeroStat[] = lead
    ? [
        {
          label: `${lead.diskName} read`,
          value: formatRate(lead.readRatePerSec),
          color: t.signal.info,
        },
        {
          label: `${lead.diskName} write`,
          value: formatRate(lead.writeRatePerSec),
          color: t.signal.up,
        },
      ]
    : [];

  return (
    <SeriesPanel
      readings={readings}
      series={series}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
      colors={directionColors(shown.map((item) => item.diskName), ['read', 'write'], t.signal.info, t.signal.up)}
      heroStats={heroStats}
      formatStatValue={(value) => formatRate(value)}
      {...(testID ? { testID } : {})}
    />
  );
}

export function DiskIoTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const items = useLatest<DiskIoItem[]>(endpointId, 'diskio') ?? [];
  const shown = pickBusiest(items, selectedNames(config, 'disks'), (i) => i.diskName, diskActivity, TEXT_LIMIT);

  const groups: ReadoutGroup[] = shown.map((item) => ({
    label: item.diskName,
    rows: [
      { label: 'Read', value: formatRate(item.readRatePerSec) },
      { label: 'Write', value: formatRate(item.writeRatePerSec) },
      { label: 'Read total', value: formatTotal(item.readBytesGauge) },
      { label: 'Written total', value: formatTotal(item.writeBytesGauge) },
    ] satisfies ReadoutRow[],
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}
