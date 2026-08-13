/**
 * Filesystem, sensors and GPU — the three metrics that are *lists of things a host happens to have*.
 *
 * All three share a shape the core metrics do not: the rows depend on the machine, so every one of
 * them can be empty, and every reading can be absent. "Not reported" is drawn as a dash and never
 * as zero — a GPU whose vendor omits fan speed is not a GPU with a stopped fan.
 */
import { useMemo } from 'react';

import { ChartView } from '@/components/charts/chart-view';
import { useLatest } from '@/data/feed-store';
import { sensorThresholdLevel, thresholdLevel, thresholdTone } from '@/data/thresholds';
import { useTelemetry } from '@/theme/use-telemetry';
import type { FsItem, GpuItem, SensorItem } from '@/types/glances';
import { recentSamples, TIME_WINDOWS } from '@/utils/sampleBuffer';
import { chartRung } from '@/utils/typeScale';
import { formatFieldValue, formatLooseNumber } from '@/utils/widgetData';

import { ScrollView, XStack, YStack } from 'tamagui';

import { MicroLabel, MonoText } from '@/components/telemetry/text';

import { DataGrid, GridStack } from '../data-grid';
import { flexibleColumnWidth, visibleColumns, type GridColumn } from '../grid-columns';
import {
  MeterList,
  TextReadout,
  meterRowHeights,
  type MeterRow,
  type ReadoutGroup,
  type ReadoutRow,
} from '../readout';
import { dedupeMounts, shortenMountPath } from '../rates';
import type { WidgetProps } from '../types';
import { useMultiSeries } from '../use-series';

const bytes = (value: number | null | undefined) =>
  value == null ? null : formatFieldValue(value, 'bytes');

function selectedNames(config: Record<string, unknown>, key: string): string[] {
  const value = config[key];
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : [];
}

/** Mounts, after the bind-mount collapse and any explicit selection. */
function visibleMounts(items: FsItem[], config: Record<string, unknown>): FsItem[] {
  const selected = selectedNames(config, 'mounts');
  const chosen = selected.length > 0 ? items.filter((item) => selected.includes(item.mntPoint)) : items;
  return dedupeMounts(
    chosen,
    (item) => item.deviceName,
    (item) => item.mntPoint,
    config.showEveryMount === true,
  ).sort((a, b) => b.size - a.size || a.mntPoint.localeCompare(b.mntPoint));
}

/**
 * The mount path always survives — it names the row — and the bar is what the table is for.
 *
 * The device and its filesystem type get **no column**: they identify a mount rather than measure
 * it, so they go on the small second line under the path, where they cost the table no width.
 * Giving them a track of their own was the first cut of this table and it was wrong — it took a
 * third of the row from the one string that tells three mounts of the same disk apart (ref §8).
 */
const FILESYSTEM_COLUMNS: GridColumn[] = [
  { key: 'mount', label: 'Mount', priority: 0 },
  { key: 'size', label: 'Size', width: 74, align: 'right', priority: 3 },
  { key: 'used', label: 'Used', width: 74, align: 'right', priority: 1 },
  { key: 'free', label: 'Free', width: 74, align: 'right', priority: 2 },
  // No separate `Use %` column: the bar already prints that figure beside itself, and a table
  // that states the same number twice in adjacent columns reads as a bug in the table.
  { key: 'usage', label: 'Usage', width: 92, align: 'right', priority: 0 },
];

/** Roughly the advance width of one JetBrains Mono glyph, as a fraction of the font size. */
const MONO_ADVANCE = 0.6;

export function FilesystemWidget({
  endpointId,
  config,
  width,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const reported = useLatest<FsItem[]>(endpointId, 'fs');
  const mounts = visibleMounts(reported ?? [], config);
  const { t, size } = useTelemetry();

  // How many characters the mount column can actually show, from the width it actually got. A
  // fixed budget cannot work: it has to match the pixels, and the pixels depend on which columns
  // survived the drop ladder.
  const mountChars = Math.max(
    12,
    Math.floor(
      flexibleColumnWidth(visibleColumns(FILESYSTEM_COLUMNS, width), width) /
        (size('row') * MONO_ADVANCE),
    ),
  );

  return (
    <DataGrid
      columns={FILESYSTEM_COLUMNS}
      rows={mounts}
      keyOf={(mount) => mount.mntPoint}
      width={width}
      height={height}
      stacked
      emptyMessage={reported === undefined ? 'Waiting for data…' : 'No mount points reported.'}
      testID={testID}
      cell={(mount, column) => {
        const tone = thresholdTone(thresholdLevel(status?.limits, 'fs', mount.percent));
        const color = tone === 'accent' ? accentColor : t.signal[tone];
        switch (column.key) {
          case 'mount':
            return (
              <GridStack
                // Shortened from the *left*, in the string rather than by the text layer: mount
                // paths agree at the start and differ at the end, so cutting the tail destroys
                // exactly what identifies the row — and `ellipsizeMode="head"` is a no-op on web,
                // where React Native DOM has only CSS `text-overflow`, which cuts the tail.
                value={shortenMountPath(mount.mntPoint, mountChars)}
                meta={[mount.deviceName, mount.fsType].filter(Boolean).join(' · ') || '—'}
                ellipsize="head"
              />
            );
          case 'size':
            return bytes(mount.size) ?? '—';
          case 'used':
            return bytes(mount.used) ?? '—';
          case 'free':
            return bytes(mount.free) ?? '—';
          case 'usage': {
            return (
              <XStack items="center" gap={6} justify="flex-end">
                <YStack flex={1} minW={20} height={3} bg="$trackBg" rounded={2} overflow="hidden">
                  <YStack height={3} width={`${Math.min(100, mount.percent)}%`} style={{ backgroundColor: color }} />
                </YStack>
                <MonoText variant="row" numberOfLines={1} width={34} text="right" style={{ color }}>
                  {`${Math.round(mount.percent)}%`}
                </MonoText>
              </XStack>
            );
          }
          default:
            return '—';
        }
      }}
    />
  );
}

export function FilesystemTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const mounts = visibleMounts(useLatest<FsItem[]>(endpointId, 'fs') ?? [], config);

  const groups: ReadoutGroup[] = mounts.map((mount) => ({
    label: mount.mntPoint,
    rows: [
      { label: 'Usage', value: `${formatLooseNumber(mount.percent)}%` },
      { label: 'Used', value: bytes(mount.used) },
      { label: 'Free', value: bytes(mount.free) },
      { label: 'Size', value: bytes(mount.size) },
      // Device and type are one line, as in the reference: they qualify the mount rather than
      // being two more figures to read.
      {
        label: 'Device',
        value: [mount.deviceName, mount.fsType].filter(Boolean).join(' · ') || null,
      },
    ] satisfies ReadoutRow[],
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}

/** Human names for the sensor types Glances reports. Anything else is shown as it arrives. */
const SENSOR_GROUPS: Record<string, string> = {
  temperature_core: 'Temperature',
  fan_speed: 'Fans',
  battery: 'Battery',
};

function groupSensors(items: SensorItem[], config: Record<string, unknown>): Map<string, SensorItem[]> {
  const selected = selectedNames(config, 'types');
  const grouped = new Map<string, SensorItem[]>();
  for (const sensor of items) {
    if (selected.length > 0 && !selected.includes(sensor.type)) continue;
    const label = SENSOR_GROUPS[sensor.type] ?? sensor.type;
    const bucket = grouped.get(label);
    if (bucket) bucket.push(sensor);
    else grouped.set(label, [sensor]);
  }
  return grouped;
}

function sensorValue(sensor: SensorItem): string | null {
  if (sensor.value == null) return null;
  return `${formatLooseNumber(sensor.value)}${sensor.unit ? ` ${sensor.unit}` : ''}`;
}

/**
 * Temperatures, fans and battery, **grouped under type headings** rather than tabled (ref §8).
 *
 * This one deliberately does not use `DataGrid`, unlike the filesystem table beside it. A sensor
 * row is a label and one reading — there is no second column to line up — and the grouping is the
 * structure: on real hardware `Core 0` appears under temperatures *and* under fans, so a flat
 * table has to carry a `Type` column that repeats itself down the whole widget to say what a
 * heading says once.
 */
export function SensorsWidget({ endpointId, config, height, testID }: WidgetProps) {
  const sensors = useLatest<SensorItem[]>(endpointId, 'sensors');
  const { t } = useTelemetry();

  const groups = [...groupSensors(sensors ?? [], config)];

  if (groups.length === 0) {
    return (
      <MonoText variant="row" color="$textDim" testID={testID ? `${testID}-empty` : undefined}>
        {sensors === undefined ? 'Waiting for data…' : 'No sensors reported by this endpoint.'}
      </MonoText>
    );
  }

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false} testID={testID}>
      <YStack gap={12} maxH={height}>
        {groups.map(([label, items]) => (
          <YStack key={label} gap={3}>
            <MicroLabel borderBottomWidth={1} borderColor="$hairline" pb={3}>
              {label}
            </MicroLabel>
            {items.map((sensor) => {
              // Per-item limits, because a fan and a CPU core share no scale — a global threshold
              // key could not describe either.
              const tone = thresholdTone(
                sensorThresholdLevel(sensor.value, sensor.warning, sensor.critical),
              );
              return (
                // Labels repeat across types on real hardware, so the key is composite.
                <XStack key={sensor.id} items="baseline" justify="space-between" gap={8}>
                  <MonoText variant="row" color="$textDim" numberOfLines={1} shrink={1}>
                    {sensor.label}
                  </MonoText>
                  <MonoText
                    variant="row"
                    numberOfLines={1}
                    style={{ color: tone === 'accent' ? t.text.strong : t.signal[tone] }}
                  >
                    {sensorValue(sensor) ?? '—'}
                  </MonoText>
                </XStack>
              );
            })}
          </YStack>
        ))}
      </YStack>
    </ScrollView>
  );
}

export function SensorsTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const sensors = useLatest<SensorItem[]>(endpointId, 'sensors') ?? [];

  // Deliberately the same rows without the colouring: the text variant is for someone who wants
  // the numbers and none of the ink.
  const groups: ReadoutGroup[] = [...groupSensors(sensors, config)].map(([label, items]) => ({
    label,
    rows: items.map((sensor) => ({ label: sensor.label, value: sensorValue(sensor) })),
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}

function visibleGpus(items: GpuItem[], config: Record<string, unknown>): GpuItem[] {
  const selected = selectedNames(config, 'gpus');
  return selected.length > 0 ? items.filter((gpu) => selected.includes(gpu.gpuId)) : items;
}

/**
 * Leftover height below the rails that earns a utilization trace — the reference's
 * `TRACE_FROM_PX` (ref GpuWidget). Measured from the box the meters leave behind, not from the
 * size tier, because how much is left depends on how many GPUs share the panel.
 */
const GPU_TRACE_FROM_PX = 72;

/** The stacked meter list's gap, matching `MeterList`. */
const METER_STACKED_GAP = 4;

export function GpuWidget({
  endpointId,
  config,
  mode,
  width,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const gpus = visibleGpus(useLatest<GpuItem[]>(endpointId, 'gpu') ?? [], config);
  const { t, size } = useTelemetry();

  // Utilization history per visible GPU. Keyed by the ids, so a fresh payload array every poll
  // does not rebuild the selectors — the same identity rule as the network chart.
  const gpuIds = gpus.map((gpu) => gpu.gpuId).join(',');
  const selectors = useMemo(() => {
    const map: Record<string, (list: GpuItem[]) => number | null> = {};
    for (const gpu of gpus) {
      const id = gpu.gpuId;
      map[id] = (list) => list.find((item) => item.gpuId === id)?.proc ?? null;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpuIds]);
  const series = useMultiSeries<GpuItem[]>(endpointId, 'gpu', selectors);

  const toneFor = (key: string, value: number | null) => {
    const tone = thresholdTone(thresholdLevel(status?.limits, key, value));
    return tone === 'accent' ? accentColor : t.signal[tone];
  };

  const rows: MeterRow[] = gpus.flatMap((gpu) => {
    const prefix = gpus.length > 1 ? `${gpu.gpuId} ` : '';
    return [
      {
        label: `${prefix}Utilization`,
        percent: gpu.proc,
        color: toneFor('gpu_proc', gpu.proc),
      },
      { label: `${prefix}Memory`, percent: gpu.mem, color: toneFor('gpu_mem', gpu.mem) },
      {
        label: `${prefix}Temperature`,
        // Not a percentage — a temperature has no full scale, so the track stays empty and the
        // reading carries the meaning. Drawing 24 °C as a 24% bar would be inventing a ceiling.
        percent: null,
        value: gpu.temperature == null ? null : `${formatLooseNumber(gpu.temperature)} °C`,
        color: toneFor('gpu_temperature', gpu.temperature),
      },
      ...(gpu.fanSpeed != null
        ? [{ label: `${prefix}Fan`, percent: gpu.fanSpeed, color: accentColor }]
        : []),
    ];
  });

  // The rails at their stacked height, then the label row, then the trace in whatever is left —
  // but only when "whatever is left" is a chart worth reading rather than a sliver.
  const stackedRow = meterRowHeights(size('metric')).stacked;
  const metersHeight = rows.length * stackedRow + Math.max(0, rows.length - 1) * METER_STACKED_GAP;
  // The label's *rendered* line, pinned below so the arithmetic cannot drift from the layout —
  // the default line height is the platform's, and guessing it is how the trace overflowed the
  // card and lost its time axis in 0.2.3.
  const labelLineHeight = Math.round(size('micro') * 1.4);
  // What the column spends around the trace: two 4pt gaps and the label's 4pt top margin.
  const traceChrome = 4 + 4 + 4;
  const traceHeight = height - metersHeight - labelLineHeight - traceChrome;
  const showTrace = !mode.short && gpus.length > 0 && traceHeight >= GPU_TRACE_FROM_PX;

  if (!showTrace) {
    return (
      <MeterList rows={rows} mode={mode} height={height} accentColor={accentColor} testID={testID} />
    );
  }

  const layers = gpus.map((gpu, index) => ({
    samples: recentSamples(series[gpu.gpuId] ?? [], TIME_WINDOWS['5m']),
    color: index === 0 ? accentColor : t.signal.info,
    fill: index === 0,
  }));

  return (
    <YStack flex={1} minH={0} gap={4} testID={testID}>
      <YStack height={metersHeight}>
        <MeterList
          rows={rows}
          mode={mode}
          height={metersHeight}
          accentColor={accentColor}
          {...(testID ? { testID: `${testID}-meters` } : {})}
        />
      </YStack>
      <MicroLabel mt={4} numberOfLines={1} style={{ lineHeight: labelLineHeight }}>
        Utilization · 5m
      </MicroLabel>
      {/* The trace's box is the arithmetic's answer, not a flex leftover: the two must agree
          exactly or the canvas paints past the card bottom. */}
      <YStack height={Math.max(0, traceHeight)}>
        <ChartView
          kind="line"
          segments={[]}
          metric="gpu-utilization"
          series={layers}
          domain={[0, 100]}
          rung={chartRung(mode.tier, traceHeight)}
          accentColor={accentColor}
          explicitSize={{ width: width - 34, height: traceHeight }}
          {...(testID ? { testID: `${testID}-trace` } : {})}
        />
      </YStack>
    </YStack>
  );
}

export function GpuTextWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const gpus = visibleGpus(useLatest<GpuItem[]>(endpointId, 'gpu') ?? [], config);

  const groups: ReadoutGroup[] = gpus.map((gpu) => ({
    label: gpu.name ?? gpu.gpuId,
    rows: [
      { label: 'Utilization', value: gpu.proc == null ? null : `${formatLooseNumber(gpu.proc)}%` },
      { label: 'Memory', value: gpu.mem == null ? null : `${formatLooseNumber(gpu.mem)}%` },
      {
        label: 'Temperature',
        value: gpu.temperature == null ? null : `${formatLooseNumber(gpu.temperature)} °C`,
      },
      { label: 'Fan', value: gpu.fanSpeed == null ? null : `${formatLooseNumber(gpu.fanSpeed)}%` },
    ] satisfies ReadoutRow[],
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
}
