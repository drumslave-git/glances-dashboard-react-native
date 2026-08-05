/**
 * The process table, the container table, and the cross-endpoint alerts feed.
 *
 * All three are `DataGrid` tables. The process one carries the two cells a plain table cannot —
 * a per-row trend and a CPU bar with its number beside it — which is why the grid exists.
 */
import { useMemo } from 'react';
import { XStack, YStack } from 'tamagui';

import { Sparkline } from '@/components/charts/sparkline';
import { MonoText } from '@/components/telemetry/text';
import { getBuffer, sliceKey } from '@/data/buffers';
import { useFeed, useLatest, useLatestByEndpoint } from '@/data/feed-store';
import { useEndpointsStore } from '@/state/endpoints';
import { useTelemetry } from '@/theme/use-telemetry';
import type { AlertItem, ContainerItem, ProcessCountStats, ProcessItem } from '@/types/glances';
import type { Sample } from '@/utils/sampleBuffer';
import { formatFieldValue, formatLooseNumber } from '@/utils/widgetData';

import { DataGrid } from '../data-grid';
import type { GridColumn } from '../grid-columns';
import { formatRate } from '../rates';
import type { WidgetProps } from '../types';

const bytes = (value: number | null | undefined) =>
  value == null ? '—' : formatFieldValue(value, 'bytes');

/* ------------------------------------------------------------------ *
 * processes
 * ------------------------------------------------------------------ */

const PROCESS_COLUMNS: GridColumn[] = [
  { key: 'pid', label: 'PID', width: 54, priority: 3 },
  // The command is what makes a row a row; it never leaves.
  { key: 'name', label: 'Command', priority: 0, sortable: true },
  { key: 'trend', label: 'Trend', width: 54, priority: 4 },
  { key: 'cpu', label: 'CPU %', width: 88, align: 'right', priority: 0, sortable: true },
  { key: 'mem', label: 'Mem', width: 72, align: 'right', priority: 1, sortable: true },
  { key: 'user', label: 'User', width: 84, priority: 2 },
];

/**
 * Per-process CPU history, from the buffered process lists.
 *
 * Pruned to the rows on screen: keeping a series for every pid the machine has ever run would grow
 * without bound, and nothing would ever read most of it.
 */
function useProcessTrends(endpointId: string | null, pids: number[]): Record<number, Sample[]> {
  const seq = useFeed((state) =>
    endpointId ? (state.slices[sliceKey(endpointId, 'processlist')]?.seq ?? 0) : 0,
  );
  const key = pids.join(',');

  return useMemo(() => {
    const out: Record<number, Sample[]> = {};
    if (!endpointId || key === '') return out;
    const buffer = getBuffer<ProcessItem[]>(endpointId, 'processlist');
    if (!buffer) return out;

    const wanted = key.split(',').map(Number);
    for (const pid of wanted) out[pid] = [];
    for (const sample of buffer.toArray()) {
      for (const process of sample.value) {
        const series = out[process.pid];
        if (series && process.cpuPercent != null) series.push({ t: sample.ts, v: process.cpuPercent });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointId, key, seq]);
}

function sortProcesses(rows: ProcessItem[], sort: string): ProcessItem[] {
  const sorted = [...rows];
  if (sort === 'memory') sorted.sort((a, b) => (b.memoryPercent ?? 0) - (a.memoryPercent ?? 0));
  else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0));
  return sorted;
}

export function ProcessesWidget({
  endpointId,
  config,
  width,
  height,
  accentColor,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const processes = useLatest<ProcessItem[]>(endpointId, 'processlist') ?? [];
  const counts = useLatest<ProcessCountStats>(endpointId, 'processcount');

  const sort = typeof config.sort === 'string' ? config.sort : 'cpu';
  const limit = typeof config.rows === 'number' ? config.rows : 20;
  const rows = sortProcesses(processes, sort).slice(0, limit);
  const trends = useProcessTrends(endpointId, rows.map((row) => row.pid));

  const footer = counts
    ? `${counts.total} processes · ${counts.running} running · ${counts.thread} threads` +
      // The server slices `top/50` by CPU and ignores sort parameters, so sorting by memory
      // reorders that CPU-selected set rather than searching every process. Saying so beats
      // implying a completeness the data does not have (ref §9).
      (sort === 'cpu' ? '' : ` · top 50 by CPU, re-sorted`)
    : null;

  return (
    <DataGrid
      columns={PROCESS_COLUMNS}
      rows={rows}
      keyOf={(row) => String(row.pid)}
      width={width}
      height={height}
      sortKey={sort === 'name' ? 'name' : sort === 'memory' ? 'mem' : 'cpu'}
      footer={footer}
      emptyMessage="No processes reported."
      testID={testID}
      cell={(row, column) => {
        switch (column.key) {
          case 'pid':
            return String(row.pid);
          case 'name':
            return row.name;
          case 'user':
            return row.username ?? '—';
          case 'mem':
            // RSS rather than the percentage: "how much memory is this using" is a size.
            return bytes(row.rss);
          case 'trend':
            return (
              <Sparkline
                samples={trends[row.pid] ?? []}
                width={column.width ?? 54}
                height={12}
                color={t.chart.spark}
              />
            );
          case 'cpu':
            return (
              <XStack items="center" gap={6} justify="flex-end">
                {/* A bar beside the number, not instead of it — process CPU can exceed 100 on a
                    multi-core host, so the bar saturates while the number keeps going. */}
                <YStack flex={1} height={3} bg="$trackBg" rounded={2} overflow="hidden">
                  <YStack
                    height={3}
                    width={`${Math.min(100, row.cpuPercent ?? 0)}%`}
                    style={{ backgroundColor: accentColor }}
                  />
                </YStack>
                <MonoText variant="row" color="$textStrong" numberOfLines={1}>
                  {row.cpuPercent == null ? '—' : formatLooseNumber(row.cpuPercent)}
                </MonoText>
              </XStack>
            );
          default:
            return '—';
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * containers
 * ------------------------------------------------------------------ */

const CONTAINER_COLUMNS: GridColumn[] = [
  { key: 'name', label: 'Container', priority: 0 },
  { key: 'status', label: 'State', width: 78, priority: 2 },
  { key: 'cpu', label: 'CPU %', width: 66, align: 'right', priority: 0 },
  { key: 'memory', label: 'Memory', width: 84, align: 'right', priority: 1 },
  { key: 'net', label: 'Net ↓↑', width: 96, align: 'right', priority: 3 },
];

export function ContainersWidget({ endpointId, width, height, testID }: WidgetProps) {
  const containers = useLatest<ContainerItem[]>(endpointId, 'containers') ?? [];
  const { t } = useTelemetry();

  const rows = [...containers].sort((a, b) => (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0));

  return (
    <DataGrid
      columns={CONTAINER_COLUMNS}
      rows={rows}
      keyOf={(row) => row.id ?? row.name}
      width={width}
      height={height}
      // A host with no container engine is not a host in error — it simply has none.
      emptyMessage="No containers on this endpoint."
      testID={testID}
      cell={(row, column) => {
        switch (column.key) {
          case 'name':
            return row.name;
          case 'status':
            return (
              <MonoText
                variant="row"
                numberOfLines={1}
                style={{
                  color: row.status === 'running' || row.status === 'healthy' ? t.signal.up : t.text.dim,
                }}
              >
                {row.status ?? '—'}
              </MonoText>
            );
          case 'cpu':
            return row.cpuPercent == null ? '—' : `${formatLooseNumber(row.cpuPercent)}%`;
          case 'memory':
            return bytes(row.memoryUsage);
          case 'net':
            // All four container rate fields are bytes/s — the Glances docs say bits for network
            // and are wrong about it (ref §9).
            return `${formatRate(row.networkRx)}`;
          default:
            return '—';
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * alerts — the one cross-endpoint widget
 * ------------------------------------------------------------------ */

const ALERT_COLUMNS: GridColumn[] = [
  { key: 'state', label: 'State', width: 74, priority: 1 },
  { key: 'host', label: 'Host', width: 90, priority: 2 },
  { key: 'type', label: 'Event', priority: 0 },
  { key: 'peak', label: 'Peak', width: 64, align: 'right', priority: 3 },
  { key: 'when', label: 'Started', width: 78, align: 'right', priority: 0 },
];

function clockTime(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

interface AlertRow extends AlertItem {
  endpointName: string;
}

export function AlertsWidget({ width, height, testID }: WidgetProps) {
  const { t } = useTelemetry();
  const endpoints = useEndpointsStore((state) => state.endpoints);
  // Memoized: a fresh array would rebuild the map on every render of every host's every tick.
  const endpointIds = useMemo(() => endpoints.map((endpoint) => endpoint.id), [endpoints]);
  const byEndpoint = useLatestByEndpoint<AlertItem[]>(endpointIds, 'alert');

  const rows: AlertRow[] = useMemo(() => {
    const all: AlertRow[] = [];
    for (const endpoint of endpoints) {
      for (const alert of byEndpoint.get(endpoint.id) ?? []) {
        all.push({ ...alert, endpointName: endpoint.name });
      }
    }
    // Ongoing first, then newest first. Severity is deliberately not a sort key: reordering a feed
    // by anything but time makes it impossible to follow what happened when, and the state chip
    // already separates the two (ref §8).
    return all.sort((a, b) => {
      if ((a.end === null) !== (b.end === null)) return a.end === null ? -1 : 1;
      return b.begin - a.begin;
    });
  }, [byEndpoint, endpoints]);

  return (
    <DataGrid
      columns={ALERT_COLUMNS}
      rows={rows}
      keyOf={(row) => `${row.endpointName}:${row.id}`}
      width={width}
      height={height}
      emptyMessage="No events on any endpoint."
      testID={testID}
      cell={(row, column) => {
        switch (column.key) {
          case 'state':
            return (
              <MonoText
                variant="row"
                numberOfLines={1}
                style={{ color: row.state === 'CRITICAL' ? t.signal.error : t.signal.warning }}
              >
                {row.state === 'CRITICAL' ? 'CRIT' : 'WARN'}
              </MonoText>
            );
          case 'host':
            return row.endpointName;
          case 'type':
            return row.type;
          case 'peak':
            // Glances records every event's min/avg/max as a percentage of that stat's own
            // ceiling, whatever the plugin — so this is a share, not a raw reading.
            return row.max == null ? '—' : `${formatLooseNumber(row.max)}%`;
          case 'when':
            return row.end === null ? `${clockTime(row.begin)} •` : clockTime(row.begin);
          default:
            return '—';
        }
      }}
    />
  );
}
