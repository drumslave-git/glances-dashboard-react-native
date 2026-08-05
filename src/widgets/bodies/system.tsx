/**
 * Host identity, and the endpoint summary.
 *
 * `systemInfo` has only a text rendering: identity has no graph to draw, and the catalog says so
 * rather than letting the variant picker offer a second card that would be the same panel twice.
 */
import { useLatest } from '@/data/feed-store';
import { thresholdLevel, thresholdTone } from '@/data/thresholds';
import { useTelemetry } from '@/theme/use-telemetry';
import type { QuicklookStats, SystemStats } from '@/types/glances';
import { formatLooseNumber } from '@/utils/widgetData';

import { MeterList, TextReadout, type MeterRow, type ReadoutRow } from '../readout';
import type { WidgetProps } from '../types';

/**
 * Uptime at **minute** granularity.
 *
 * The string arrives preformatted from the server and is displayed verbatim in every other
 * respect — but it refreshes on the 60 s static tier, so leaving the seconds on screen would show
 * a clock that is wrong for most of every minute and looks frozen for the rest.
 */
function uptimeToMinutes(uptime: string | undefined): string | null {
  if (!uptime) return null;
  return uptime.replace(/(\d+:\d+):\d+/, '$1');
}

function hz(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  return `${(value / 1_000_000_000).toFixed(2)} GHz`;
}

export function SystemInfoWidget({ endpointId, mode, height, testID }: WidgetProps) {
  const system = useLatest<SystemStats>(endpointId, 'system');
  const uptime = useLatest<string>(endpointId, 'uptime');
  const quicklook = useLatest<QuicklookStats>(endpointId, 'quicklook');

  const cores =
    quicklook?.cpuCoresPhys != null && quicklook.cpuCoresLog != null
      ? `${quicklook.cpuCoresPhys} / ${quicklook.cpuCoresLog}`
      : (quicklook?.cpuCoresLog?.toString() ?? null);

  const rows: ReadoutRow[] = [
    // `hr_name` is a ready-made display string — "Ubuntu 25.10 64bit / Linux 6.17.0-40-generic".
    { label: 'System', value: system?.hrName ?? null },
    { label: 'Host', value: system?.hostname ?? null },
    { label: 'CPU', value: quicklook?.cpuName ?? null },
    { label: 'Cores', value: cores },
    { label: 'Clock', value: hz(quicklook?.cpuHz) },
    { label: 'Uptime', value: uptimeToMinutes(uptime) },
  ];

  return <TextReadout groups={[{ rows }]} mode={mode} height={height} testID={testID} />;
}

/** The four figures quicklook reports for the whole host, in the order the design lists them. */
function summaryRows(quicklook: QuicklookStats | undefined) {
  return [
    { key: 'cpu', label: 'CPU', percent: quicklook?.cpu ?? null, limit: 'quicklook_cpu' },
    { key: 'mem', label: 'Memory', percent: quicklook?.mem ?? null, limit: 'quicklook_mem' },
    { key: 'swap', label: 'Swap', percent: quicklook?.swap ?? null, limit: 'quicklook_swap' },
    { key: 'load', label: 'Load', percent: quicklook?.load ?? null, limit: 'quicklook_load' },
  ];
}

export function EndpointSummaryWidget({
  endpointId,
  mode,
  height,
  accentColor,
  status,
  testID,
}: WidgetProps) {
  const quicklook = useLatest<QuicklookStats>(endpointId, 'quicklook');
  const { t } = useTelemetry();

  const rows: MeterRow[] = summaryRows(quicklook).map((entry) => {
    const tone = thresholdTone(thresholdLevel(status?.limits, entry.limit, entry.percent));
    return {
      label: entry.label,
      percent: entry.percent,
      color: tone === 'accent' ? accentColor : t.signal[tone],
    };
  });

  return (
    <MeterList rows={rows} mode={mode} height={height} accentColor={accentColor} testID={testID} />
  );
}

export function EndpointSummaryTextWidget({ endpointId, mode, height, testID }: WidgetProps) {
  const quicklook = useLatest<QuicklookStats>(endpointId, 'quicklook');

  const rows: ReadoutRow[] = summaryRows(quicklook).map((entry) => ({
    label: entry.label,
    value: entry.percent == null ? null : `${formatLooseNumber(entry.percent)}%`,
  }));

  const detail: ReadoutRow[] = [
    { label: 'CPU', value: quicklook?.cpuName ?? null },
    { label: 'Clock', value: hz(quicklook?.cpuHzCurrent ?? quicklook?.cpuHz) },
    { label: 'Threads', value: quicklook?.cpuCoresLog?.toString() ?? null },
  ];

  return (
    <TextReadout groups={[{ rows }, { label: 'Processor', rows: detail }]} mode={mode} height={height} testID={testID} />
  );
}
