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
import type { DiskIoItem, NetworkItem } from '@/types/glances';

import { SeriesPanel, reading } from '../panels';
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

export function NetworkChartWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
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

  return (
    <SeriesPanel
      readings={readings}
      series={series}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
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

  return (
    <SeriesPanel
      readings={readings}
      series={series}
      width={width}
      height={height}
      sizeClass={mode.tier}
      accentColor={accentColor}
      timeWindow={windowFromConfig(config)}
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
