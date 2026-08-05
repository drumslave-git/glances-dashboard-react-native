/**
 * Filesystem, sensors and GPU — the three metrics that are *lists of things a host happens to have*.
 *
 * All three share a shape the core metrics do not: the rows depend on the machine, so every one of
 * them can be empty, and every reading can be absent. "Not reported" is drawn as a dash and never
 * as zero — a GPU whose vendor omits fan speed is not a GPU with a stopped fan.
 */
import { useLatest } from '@/data/feed-store';
import { sensorThresholdLevel, thresholdLevel, thresholdTone } from '@/data/thresholds';
import { useTelemetry } from '@/theme/use-telemetry';
import type { FsItem, GpuItem, SensorItem } from '@/types/glances';
import { formatFieldValue, formatLooseNumber } from '@/utils/widgetData';

import { MeterList, TextReadout, type MeterRow, type ReadoutGroup, type ReadoutRow } from '../readout';
import { dedupeMounts } from '../rates';
import type { WidgetProps } from '../types';

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

export function FilesystemWidget({
  endpointId,
  config,
  mode,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const mounts = visibleMounts(useLatest<FsItem[]>(endpointId, 'fs') ?? [], config);
  const { t } = useTelemetry();

  const rows: MeterRow[] = mounts.map((mount) => {
    const tone = thresholdTone(thresholdLevel(status?.limits, 'fs', mount.percent));
    return {
      label: mount.mntPoint,
      percent: mount.percent,
      // The figure people read off a disk is how much is left, not the percentage — the bar
      // already says the percentage.
      value: `${bytes(mount.used)} / ${bytes(mount.size)}`,
      color: tone === 'accent' ? accentColor : t.signal[tone],
    };
  });

  return (
    <MeterList rows={rows} mode={mode} height={height} accentColor={accentColor} testID={testID} />
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

export function SensorsWidget({ endpointId, config, mode, height, testID }: WidgetProps) {
  const sensors = useLatest<SensorItem[]>(endpointId, 'sensors') ?? [];
  const { t } = useTelemetry();

  const groups: ReadoutGroup[] = [...groupSensors(sensors, config)].map(([label, items]) => ({
    label,
    rows: items.map((sensor) => {
      // Per-item limits, because a fan and a CPU core share no scale — a global threshold key
      // could not describe either.
      const tone = thresholdTone(sensorThresholdLevel(sensor.value, sensor.warning, sensor.critical));
      return {
        label: sensor.label,
        value: sensorValue(sensor),
        ...(tone === 'accent' ? {} : { color: t.signal[tone] }),
      };
    }),
  }));

  return <TextReadout groups={groups} mode={mode} height={height} testID={testID} />;
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

export function GpuWidget({
  endpointId,
  config,
  mode,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const gpus = visibleGpus(useLatest<GpuItem[]>(endpointId, 'gpu') ?? [], config);
  const { t } = useTelemetry();

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

  return (
    <MeterList rows={rows} mode={mode} height={height} accentColor={accentColor} testID={testID} />
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
