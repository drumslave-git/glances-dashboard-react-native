/**
 * The process table, the container table, and the cross-endpoint alerts feed.
 *
 * All three are `DataGrid` tables. The process one carries the two cells a plain table cannot —
 * a per-row trend and a CPU bar with its number beside it — which is why the grid exists.
 *
 * Every heading here sorts. That is not a convenience: these are the three widgets whose rows are
 * a *ranking* rather than a fixed set, so the question "by what?" is the widget's main control,
 * and burying it in the config screen would make answering it a four-tap round trip.
 */
import { useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { Sparkline } from '@/components/charts/sparkline';
import { MonoText } from '@/components/telemetry/text';
import { getBuffer, sliceKey } from '@/data/buffers';
import { useFeed, useLatest, useLatestByEndpoint } from '@/data/feed-store';
import { thresholdLevel, thresholdTone } from '@/data/thresholds';
import { useEndpointsStore } from '@/state/endpoints';
import { useTelemetry } from '@/theme/use-telemetry';
import type { AlertItem, ContainerItem, ProcessCountStats, ProcessItem } from '@/types/glances';
import type { Sample } from '@/utils/sampleBuffer';
import { formatFieldValue } from '@/utils/widgetData';

import { DataGrid, GridStack } from '../data-grid';
import type { GridColumn } from '../grid-columns';
import { formatElapsed, formatPercent, formatRate } from '../rates';
import type { WidgetProps } from '../types';

const bytes = (value: number | null | undefined) =>
  value == null ? '—' : formatFieldValue(value, 'bytes');

/* ------------------------------------------------------------------ *
 * processes
 * ------------------------------------------------------------------ */

/**
 * Reading order is the design's: which process, where it has been, then what it is costing.
 *
 * Single-line rows, unlike the other two tables here. A process row has no qualifier to put under
 * its name — the command line is the obvious candidate and it is the one string that will not fit
 * on any line, so it belongs in a config-chosen column, not under every row.
 */
const PROCESS_COLUMNS: GridColumn[] = [
  { key: 'pid', label: 'PID', width: 54, priority: 3, sortable: true },
  // The command and its CPU figure are the question this table answers; they never leave.
  { key: 'name', label: 'Command', priority: 0, sortable: true },
  { key: 'trend', label: 'Trend', width: 54, priority: 4 },
  { key: 'cpu', label: 'CPU', width: 96, align: 'right', priority: 0, sortable: true },
  { key: 'mem', label: 'Mem', width: 74, align: 'right', priority: 1, sortable: true },
  { key: 'time', label: 'Time', width: 70, align: 'right', priority: 2, sortable: true },
  { key: 'memPercent', label: 'Mem %', width: 60, align: 'right', priority: 5, sortable: true },
  { key: 'user', label: 'User', width: 78, priority: 6, sortable: true },
];

/** Samples behind each row's trace — about a minute at the heavy tier's 3 s floor. */
const TREND_SAMPLES = 24;

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
    for (const sample of buffer.toArray().slice(-TREND_SAMPLES)) {
      for (const process of sample.value) {
        const series = out[process.pid];
        if (series && process.cpuPercent != null) series.push({ t: sample.ts, v: process.cpuPercent });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointId, key, seq]);
}

/**
 * Ties break by name then pid, so the row order is deterministic.
 *
 * Without it, a sample where the server reports 0% CPU for everything — which it does whenever
 * `/processlist` is polled faster than its own refresh — reshuffles the entire table for a frame.
 */
function compareProcesses(a: ProcessItem, b: ProcessItem, key: string): number {
  const primary =
    key === 'name'
      ? a.name.localeCompare(b.name)
      : key === 'user'
        ? (a.username ?? '').localeCompare(b.username ?? '')
        : key === 'mem'
          ? (b.rss ?? -1) - (a.rss ?? -1)
          : key === 'time'
            ? (b.cpuTimeSec ?? -1) - (a.cpuTimeSec ?? -1)
            : key === 'pid'
              ? a.pid - b.pid
              : (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1);
  return primary || a.name.localeCompare(b.name) || a.pid - b.pid;
}

/** The config's sort names, in the column keys the headings use. */
const CONFIG_SORT: Record<string, string> = { cpu: 'cpu', memory: 'mem', name: 'name' };

export function ProcessesWidget({
  endpointId,
  config,
  width,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const { t } = useTelemetry();
  const processes = useLatest<ProcessItem[]>(endpointId, 'processlist');
  const counts = useLatest<ProcessCountStats>(endpointId, 'processcount');

  const configured = typeof config.sort === 'string' ? (CONFIG_SORT[config.sort] ?? 'cpu') : 'cpu';
  // The heading overrides the configured sort for this session without rewriting the widget: a
  // glance at "who is eating the memory" should not be a permanent change to the board.
  const [chosen, setChosen] = useState<string | null>(null);
  const sort = chosen ?? configured;

  const limit = typeof config.rows === 'number' ? config.rows : 20;
  const rows = useMemo(
    () => [...(processes ?? [])].sort((a, b) => compareProcesses(a, b, sort)),
    [processes, sort],
  );
  const trends = useProcessTrends(
    endpointId,
    rows.slice(0, limit).map((row) => row.pid),
  );

  const footer = counts
    ? `${counts.total} processes · ${counts.running} running · ${counts.sleeping} sleeping · ${counts.thread} threads` +
      // The server slices `top/50` by CPU and ignores sort parameters, so sorting by anything else
      // reorders that CPU-selected set rather than searching every process. Saying so beats
      // implying a completeness the data does not have (ref §9).
      (sort === 'cpu' ? '' : ` · sorted within the server's top ${rows.length} by CPU`)
    : null;

  return (
    <DataGrid
      columns={PROCESS_COLUMNS}
      rows={rows}
      keyOf={(row) => String(row.pid)}
      width={width}
      height={height}
      maxRows={limit}
      sortKey={sort}
      onSort={setChosen}
      footer={footer}
      // "No processes" is a claim about the host; before the first poll we have no basis for it.
      emptyMessage={processes === undefined ? 'Waiting for data…' : 'No processes reported.'}
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
            // RSS rather than the share of RAM: "how much memory is this using" is a size. The
            // percentage keeps its own column, where it can take a threshold colour.
            return bytes(row.rss);
          case 'memPercent': {
            const tone = thresholdTone(
              thresholdLevel(status?.limits, 'processlist_mem', row.memoryPercent),
            );
            return (
              <MonoText
                variant="row"
                numberOfLines={1}
                text="right"
                style={{ color: tone === 'accent' ? t.text.strong : t.signal[tone] }}
              >
                {formatPercent(row.memoryPercent)}
              </MonoText>
            );
          }
          case 'time':
            return formatElapsed(row.cpuTimeSec);
          case 'trend':
            return (
              <Sparkline
                samples={trends[row.pid] ?? []}
                width={column.width ?? 54}
                height={12}
                color={t.chart.spark}
                // Fixed to 0–100 so a row's trace is comparable to the row above it rather than
                // only to its own past.
                percentage
              />
            );
          case 'cpu': {
            const tone = thresholdTone(
              thresholdLevel(status?.limits, 'processlist_cpu', row.cpuPercent),
            );
            const color = tone === 'accent' ? accentColor : t.signal[tone];
            return (
              <XStack items="center" gap={6} justify="flex-end">
                {/* A bar beside the number, not instead of it — process CPU can exceed 100 on a
                    multi-core host, so the bar saturates while the number keeps going. */}
                <YStack flex={1} minW={20} height={3} bg="$trackBg" rounded={2} overflow="hidden">
                  <YStack
                    height={3}
                    width={`${Math.min(100, Math.max(0, row.cpuPercent ?? 0))}%`}
                    style={{ backgroundColor: color }}
                  />
                </YStack>
                {/* The number takes what it needs and the bar yields, rather than the number
                    being pinned to a width a four-digit reading overflows. A 32-core host really
                    does report 2686%, and a clipped figure is worse than a shorter bar. */}
                <MonoText
                  variant="row"
                  color="$textStrong"
                  numberOfLines={1}
                  shrink={0}
                  text="right"
                >
                  {formatPercent(row.cpuPercent)}
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

/* ------------------------------------------------------------------ *
 * containers
 * ------------------------------------------------------------------ */

const CONTAINER_COLUMNS: GridColumn[] = [
  { key: 'name', label: 'Container', priority: 0, sortable: true },
  { key: 'status', label: 'State', width: 76, priority: 2, sortable: true },
  { key: 'cpu', label: 'CPU', width: 62, align: 'right', priority: 0, sortable: true },
  { key: 'memory', label: 'Memory', width: 92, align: 'right', priority: 1, sortable: true },
  { key: 'net', label: 'Net ↓↑', width: 82, align: 'right', priority: 3, sortable: true },
  { key: 'io', label: 'IO r/w', width: 82, align: 'right', priority: 4, sortable: true },
];

function compareContainers(a: ContainerItem, b: ContainerItem, key: string): number {
  const primary =
    key === 'name'
      ? a.name.localeCompare(b.name)
      : key === 'status'
        ? (a.status ?? '').localeCompare(b.status ?? '')
        : key === 'memory'
          ? (b.memoryUsage ?? -1) - (a.memoryUsage ?? -1)
          : key === 'net'
            ? (b.networkRx ?? -1) - (a.networkRx ?? -1)
            : key === 'io'
              ? (b.ioRx ?? -1) - (a.ioRx ?? -1)
              : (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1);
  return primary || a.name.localeCompare(b.name);
}

export function ContainersWidget({ endpointId, width, height, testID }: WidgetProps) {
  const containers = useLatest<ContainerItem[]>(endpointId, 'containers');
  const { t } = useTelemetry();
  const [sort, setSort] = useState('cpu');

  const rows = useMemo(
    () => [...(containers ?? [])].sort((a, b) => compareContainers(a, b, sort)),
    [containers, sort],
  );

  return (
    <DataGrid
      columns={CONTAINER_COLUMNS}
      rows={rows}
      keyOf={(row) => row.id ?? row.name}
      width={width}
      height={height}
      stacked
      sortKey={sort}
      onSort={setSort}
      // A host with no container engine is not a host in error — it simply has none. But that is
      // a claim about the host, so it waits until the host has actually answered.
      emptyMessage={
        containers === undefined
          ? 'Waiting for data…'
          : 'No container engine on this endpoint, or no containers running.'
      }
      testID={testID}
      cell={(row, column) => {
        switch (column.key) {
          case 'name':
            return <GridStack value={row.name} meta={row.engine ?? row.image ?? null} />;
          case 'status':
            return (
              <MonoText
                variant="row"
                numberOfLines={1}
                style={{
                  // A running container is the accent; anything else is neutral rather than red.
                  // A stopped container is a fact, not a failure, and colouring it as one would
                  // cry wolf on every dashboard. `healthy` counts as running — it is running *and*
                  // passing its healthcheck, so drawing it dimmer than a plain `running` would
                  // rank the better state lower (the reference accents only `running`).
                  color:
                    row.status === 'running' || row.status === 'healthy' ? t.signal.up : t.text.dim,
                }}
              >
                {row.status ?? '—'}
              </MonoText>
            );
          case 'cpu':
            return formatPercent(row.cpuPercent);
          case 'memory':
            return (
              <GridStack
                value={bytes(row.memoryUsage)}
                // Usually the whole host's RAM, unless a limit was set on the container.
                meta={`of ${bytes(row.memoryLimit)}`}
                align="right"
              />
            );
          // Both pairs are bytes per second. The Glances docs describe `network_rx`/`network_tx`
          // as bits/s and are wrong about it — 4.5.x computes them exactly like `io_rx` (ref §9).
          case 'net':
            return (
              <GridStack
                value={formatRate(row.networkRx)}
                meta={formatRate(row.networkTx)}
                align="right"
              />
            );
          case 'io':
            return (
              <GridStack value={formatRate(row.ioRx)} meta={formatRate(row.ioWx)} align="right" />
            );
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
  { key: 'state', label: 'State', width: 62, priority: 1 },
  { key: 'host', label: 'Host', width: 88, priority: 2 },
  { key: 'type', label: 'Event', priority: 0 },
  { key: 'peak', label: 'Peak %', width: 66, align: 'right', priority: 3 },
  { key: 'when', label: 'Started', width: 74, align: 'right', priority: 0 },
  { key: 'duration', label: 'Duration', width: 74, align: 'right', priority: 4 },
];

/**
 * Glances names an event after the stat that raised it — the plugin, sometimes suffixed with the
 * field. The fixed set below is worth translating. The open-ended ones (`SENSORS_<label>`,
 * `FS_<mount>`) name something only the host knows, so they are shown exactly as the server wrote
 * them rather than prettified into prose we would be inventing.
 */
const TYPE_LABELS: Record<string, string> = {
  CPU: 'CPU usage',
  CPU_USER: 'CPU in user mode',
  CPU_SYSTEM: 'CPU in kernel mode',
  CPU_IOWAIT: 'CPU waiting on I/O',
  CPU_STEAL: 'CPU stolen by hypervisor',
  CPU_NICED: 'CPU on niced processes',
  GPU_MEM: 'GPU memory',
  GPU_PROC: 'GPU utilization',
  LOAD: 'Load average',
  MEM: 'Memory usage',
  MEMSWAP: 'Swap usage',
  PERCPU: 'Per-core CPU usage',
};

/**
 * The line under the event name: which processes were on top while it was critical, or — when
 * there were none to record — the server's own name for it, which is the key its limit is
 * configured under. A type we did not rename is already on the line above, so it is not repeated.
 */
function eventDetail(alert: AlertItem): string {
  if (alert.top.length > 0) return alert.top.join(', ');
  return TYPE_LABELS[alert.type] ? alert.type : '—';
}

function clockTime(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * The date an event started, shown only when it was not today — the clock alone would quietly
 * present yesterday evening's event as this evening's.
 */
function startedOn(begin: number, now: number): string {
  const day = new Date(begin);
  const today = new Date(now);
  const sameDay =
    day.getFullYear() === today.getFullYear() &&
    day.getMonth() === today.getMonth() &&
    day.getDate() === today.getDate();
  return sameDay ? 'today' : day.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/**
 * How long the event ran, in seconds.
 *
 * A finished event is measured entirely in the server's own clock, so it is exact. A running one
 * has to be measured against *ours*, which is a different clock — a host whose time is off would
 * otherwise report a negative age, so that case returns nothing rather than a confident wrong
 * number.
 */
function durationSec(alert: AlertItem, now: number): number | null {
  const elapsed = ((alert.end ?? now) - alert.begin) / 1000;
  return elapsed < 0 ? null : elapsed;
}

interface AlertRow extends AlertItem {
  endpointName: string;
}

export function AlertsWidget({ config, width, height, testID }: WidgetProps) {
  const { t } = useTelemetry();
  const endpoints = useEndpointsStore((state) => state.endpoints);
  // Memoized: a fresh array would rebuild the map on every render of every host's every tick.
  const endpointIds = useMemo(() => endpoints.map((endpoint) => endpoint.id), [endpoints]);
  const byEndpoint = useLatestByEndpoint<AlertItem[]>(endpointIds, 'alert');

  const criticalOnly = config.severity === 'critical';
  const includeResolved = config.includeResolved !== false;

  const all: AlertRow[] = useMemo(() => {
    const rows: AlertRow[] = [];
    for (const endpoint of endpoints) {
      for (const alert of byEndpoint.get(endpoint.id) ?? []) {
        rows.push({ ...alert, endpointName: endpoint.name });
      }
    }
    // Ongoing first, then newest first. Severity is deliberately not a sort key: reordering a feed
    // by anything but time makes it impossible to follow what happened when, and the state chip
    // already separates the two (ref §8).
    return rows.sort((a, b) => {
      if ((a.end === null) !== (b.end === null)) return a.end === null ? -1 : 1;
      return b.begin - a.begin;
    });
  }, [byEndpoint, endpoints]);

  const rows = useMemo(
    () =>
      all.filter(
        (row) =>
          (!criticalOnly || row.state === 'CRITICAL') && (includeResolved || row.end === null),
      ),
    [all, criticalOnly, includeResolved],
  );

  // "Now" is the newest moment any endpoint reported, not the device's clock: one reading for the
  // whole table so two rows that started together stay together, and no `Date.now()` during
  // render. It is also the more honest number — an ongoing event's age is only known as far as the
  // last poll, and pretending otherwise would tick the duration up while the endpoint was offline.
  const now = useFeed((state) => {
    let latest = 0;
    for (const id of endpointIds) {
      const ts = state.slices[sliceKey(id, 'alert')]?.ts ?? 0;
      if (ts > latest) latest = ts;
    }
    return latest;
  });
  const ongoing = all.filter((row) => row.end === null).length;

  return (
    <DataGrid
      columns={ALERT_COLUMNS}
      rows={rows}
      keyOf={(row) => `${row.endpointName}:${row.id}`}
      width={width}
      height={height}
      stacked
      footer={
        all.length > 0
          ? `${ongoing} ongoing · ${all.length - ongoing} resolved · ${byEndpoint.size}/${endpoints.length} endpoints reporting`
          : null
      }
      // A silent event log is the good outcome, and reads as one — not as a widget with no data.
      emptyMessage={
        endpoints.length === 0
          ? 'No endpoints configured.'
          : byEndpoint.size === 0
            ? 'Waiting for data…'
            : all.length === 0
              ? 'No events on any endpoint.'
              : 'No events match this filter.'
      }
      testID={testID}
      cell={(row, column) => {
        const critical = row.state === 'CRITICAL';
        const severity = critical ? t.signal.error : t.signal.warning;
        switch (column.key) {
          case 'state':
            return (
              <MonoText
                variant="row"
                numberOfLines={1}
                // A closed event keeps its severity colour but loses its urgency, so it fades
                // rather than changing hue — the row still says at a glance how bad it got.
                style={{ color: severity, opacity: row.end === null ? 1 : 0.55 }}
              >
                {critical ? 'CRIT' : 'WARN'}
              </MonoText>
            );
          case 'host':
            return row.endpointName;
          case 'type':
            return (
              <GridStack value={TYPE_LABELS[row.type] ?? row.type} meta={eventDetail(row)} />
            );
          case 'peak':
            // Glances records every event's min/avg/max as a percentage of that stat's own
            // ceiling, whatever the plugin — so this is a share, not a raw reading.
            return (
              <GridStack
                value={formatPercent(row.max)}
                meta={`avg ${formatPercent(row.avg)}`}
                align="right"
              />
            );
          case 'when':
            return (
              <GridStack
                value={clockTime(row.begin)}
                meta={startedOn(row.begin, now)}
                align="right"
              />
            );
          case 'duration':
            return (
              <GridStack
                value={formatElapsed(durationSec(row, now))}
                meta={row.end === null ? 'ongoing' : 'resolved'}
                metaColor={row.end === null ? severity : undefined}
                align="right"
              />
            );
          default:
            return '—';
        }
      }}
    />
  );
}
