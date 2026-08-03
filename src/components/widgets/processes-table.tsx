import { useMemo } from 'react';
import { XStack, YStack } from 'tamagui';

import { Sparkline } from '@/components/charts/sparkline';
import { MicroLabel, MonoText } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { Sample } from '@/utils/sampleBuffer';
import {
  DEFAULT_PROCESS_SORT,
  buildProcessTable,
  getProcessHeaderLabel,
  processColumnPriority,
  processColumnWidth,
} from '@/utils/processTable';
import { fittingRowCount, visibleColumns, type TableColumn } from '@/utils/typeScale';

interface ProcessesTableProps {
  data: unknown;
  /** Columns to show. Empty or omitted falls back to the default four. */
  fields?: string[];
  fieldFormatters?: Record<string, string>;
  sortKey?: string;
  /**
   * Measured body box. Both axes drive what the table shows — width decides
   * which columns survive, height how many rows fit. Defaults match a regular
   * card so a preview can render without measuring.
   */
  width?: number;
  height?: number;
  accentColor?: string;
  /** Per-process CPU history for the TREND column, keyed by pid. */
  trends?: Record<string, Sample[]>;
  testID?: string;
}

/** The TREND column is synthetic — it has no field in the payload. */
const TREND_KEY = '__trend';
const TREND_WIDTH = 78;
const HEADER_HEIGHT = 22;
const ROW_HEIGHT = 30;
/** The inline CPU bar and its right-aligned percentage. */
const CPU_BAR_MIN = 40;
const CPU_VALUE_WIDTH = 48;

/**
 * The process list as a table.
 *
 * **It never scrolls horizontally.** That is the handoff's rule and it is the
 * one real behaviour change from the previous implementation, which put the
 * whole table inside a horizontal `ScrollView`. Instead columns leave by
 * priority as the card narrows — PID, command and CPU always survive — and the
 * row count follows the available height so a row is never cut in half.
 *
 * Dropping the horizontal scroll also retires the nested-ScrollView construct
 * that the one unexplained Fabric mount crash in M4 pointed at.
 */
export function ProcessesTable({
  data,
  fields,
  fieldFormatters,
  sortKey = DEFAULT_PROCESS_SORT,
  width = 360,
  height = 180,
  accentColor,
  trends,
  testID,
}: ProcessesTableProps) {
  const { t, accent } = useTelemetry();
  const fill = accentColor ?? accent('lime').stroke;

  const { columns, rows } = useMemo(
    () => buildProcessTable(data, fields, fieldFormatters, sortKey),
    [data, fields, fieldFormatters, sortKey],
  );

  const hasTrends = trends != null && Object.keys(trends).length > 0;

  const layout = useMemo(() => {
    const candidates: TableColumn[] = columns.map((field) => ({
      key: field,
      priority: processColumnPriority(field),
      width: processColumnWidth(field),
    }));
    // TREND sits after the command, as it does in the design, and is the third
    // thing to go — it is decoration on top of the CPU figure beside it.
    if (hasTrends) {
      const cpuIndex = candidates.findIndex((column) => column.key === 'cpu_percent');
      const trend: TableColumn = { key: TREND_KEY, priority: 3, width: TREND_WIDTH };
      candidates.splice(cpuIndex === -1 ? candidates.length : cpuIndex, 0, trend);
    }
    return visibleColumns(candidates, width);
  }, [columns, hasTrends, width]);

  const rowCount = fittingRowCount(height - HEADER_HEIGHT, ROW_HEIGHT, 8);
  const visibleRows = rows.slice(0, rowCount);

  if (rows.length === 0) {
    return (
      <MonoText variant="row" color="$textDim" testID={testID ? `${testID}-empty` : undefined}>
        No processes to show.
      </MonoText>
    );
  }

  return (
    <YStack flex={1} testID={testID}>
      <XStack
        height={HEADER_HEIGHT}
        items="center"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        {layout.map((column) => (
          <Cell key={column.key} column={column}>
            <MicroLabel
              numberOfLines={1}
              testID={testID ? `${testID}-header-${column.key}` : undefined}
            >
              {column.key === TREND_KEY ? 'Trend' : getProcessHeaderLabel(column.key)}
            </MicroLabel>
          </Cell>
        ))}
      </XStack>

      {visibleRows.map((row) => (
        <XStack
          key={row.key}
          height={ROW_HEIGHT}
          items="center"
          borderBottomWidth={1}
          borderColor="$rowBorder"
          testID={testID ? `${testID}-row-${row.key}` : undefined}
        >
          {layout.map((column) => {
            if (column.key === TREND_KEY) {
              return (
                <Cell key={column.key} column={column}>
                  <Sparkline
                    samples={(row.pid != null ? trends?.[row.pid] : undefined) ?? []}
                    width={TREND_WIDTH - 8}
                    height={16}
                    color={t.chart.spark}
                  />
                </Cell>
              );
            }

            if (column.key === 'cpu_percent') {
              return (
                <Cell key={column.key} column={column}>
                  <CpuCell
                    percent={row.cpuPercent}
                    text={row.cells[columns.indexOf('cpu_percent')] ?? ''}
                    width={column.width}
                    accentColor={fill}
                  />
                </Cell>
              );
            }

            const value = row.cells[columns.indexOf(column.key)] ?? '';
            return (
              <Cell key={column.key} column={column}>
                <MonoText
                  variant="row"
                  numberOfLines={1}
                  color={cellColour(column.key)}
                >
                  {value}
                </MonoText>
              </Cell>
            );
          })}
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * The command is the row's subject and gets `text.primary`; PIDs and the trailing
 * columns are dimmer — but still above the 4.5:1 floor, because this design has
 * no grey text.
 */
function cellColour(field: string): '$textPrimary' | '$textSecondary' | '$textDim' {
  if (field === 'name' || field === 'cmdline') return '$textPrimary';
  if (field === 'pid' || field === 'username') return '$textDim';
  return '$textSecondary';
}

function Cell({ column, children }: { column: TableColumn; children: React.ReactNode }) {
  // The command column takes whatever is left, so a narrow card spends its width
  // on the one field that identifies the process.
  const flexible = column.key === 'name' || column.key === 'cmdline';
  return (
    <YStack
      {...(flexible ? { flex: 1, minW: 0 } : { width: column.width })}
      px={6}
      justify="center"
    >
      {children}
    </YStack>
  );
}

/** A flexible track with the percentage right-aligned so decimals line up. */
function CpuCell({
  percent,
  text,
  width,
  accentColor,
}: {
  percent: number | null;
  text: string;
  width: number;
  accentColor: string;
}) {
  const filled = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const trackWidth = Math.max(CPU_BAR_MIN, width - CPU_VALUE_WIDTH - 18);

  return (
    <XStack items="center" gap={8}>
      <YStack
        width={trackWidth}
        height={GEOMETRY.processCpuTrack}
        rounded={2}
        bg="$trackBg"
        overflow="hidden"
      >
        <YStack width={`${filled}%`} height="100%" style={{ backgroundColor: accentColor }} />
      </YStack>
      <MonoText variant="row" width={CPU_VALUE_WIDTH} text="right" numberOfLines={1}>
        {text}
      </MonoText>
    </XStack>
  );
}
