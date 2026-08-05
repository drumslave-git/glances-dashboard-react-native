/**
 * The tabular readout, ported from the reference's `ui/DataGrid` (ref §7.4).
 *
 * The reference uses CSS grid rather than a `<table>` because its rows carry things a table cell
 * handles badly — a sparkline, a bar with a number beside it, a two-line name. React Native has no
 * grid, so the same job is done with flex rows over a shared column spec: header and body read the
 * same `GridColumn[]`, which is what stops a column drifting between the two.
 *
 * Two behaviours are the point of the component rather than decoration:
 *
 * - **Columns drop by priority, they never clip.** The measured width decides which survive
 *   (`visibleColumns`), and a priority-0 column survives everything.
 * - **Rows are never half-cut.** The row count follows the measured height, so the table ends on a
 *   whole row and a partial one is simply not drawn.
 *
 * The header sits outside the scroll view, which is how a sticky header is spelled here.
 */
import type { ReactNode } from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';

import { MicroLabel, MonoText } from '@/components/telemetry/text';
import { useTelemetry } from '@/theme/use-telemetry';

import { columnStyle, visibleColumns, type GridColumn } from './grid-columns';

const HEADER_HEIGHT = 20;
const ROW_HEIGHT = 22;
const COLUMN_GAP = 10;

export interface DataGridProps<Row> {
  columns: readonly GridColumn[];
  rows: readonly Row[];
  /** Stable identity per row, so a re-sort does not re-key every row. */
  keyOf: (row: Row) => string;
  /** What one cell draws. A string is rendered as the standard mono value. */
  cell: (row: Row, column: GridColumn) => ReactNode | string;
  /** Measured box of the widget body. */
  width: number;
  height: number;
  /** The column currently sorted, if the table sorts. */
  sortKey?: string;
  onSort?: (key: string) => void;
  /** A line under the table — the reference's processcount footer. */
  footer?: string | null;
  emptyMessage?: string;
  testID?: string;
}

export function DataGrid<Row>({
  columns,
  rows,
  keyOf,
  cell,
  width,
  height,
  sortKey,
  onSort,
  footer,
  emptyMessage = 'Nothing to show.',
  testID,
}: DataGridProps<Row>) {
  const { t } = useTelemetry();
  const shown = visibleColumns(columns, width);

  const bodyHeight = Math.max(0, height - HEADER_HEIGHT - (footer ? ROW_HEIGHT : 0));
  // Whole rows only: a half-cut row reads as a rendering fault, where a shorter table plainly
  // says there was no room.
  const capacity = Math.max(0, Math.floor(bodyHeight / ROW_HEIGHT));
  const visible = rows.slice(0, capacity);

  if (rows.length === 0) {
    return (
      <MonoText variant="row" color="$textDim" testID={testID ? `${testID}-empty` : undefined}>
        {emptyMessage}
      </MonoText>
    );
  }

  return (
    <YStack flex={1} minH={0} testID={testID} role="table">
      <XStack
        items="center"
        gap={COLUMN_GAP}
        height={HEADER_HEIGHT}
        borderBottomWidth={1}
        borderColor="$hairline"
        role="row"
      >
        {shown.map((column) => {
          const sortable = column.sortable === true && onSort !== undefined;
          const active = sortKey === column.key;
          return (
            <MicroLabel
              key={column.key}
              numberOfLines={1}
              text={column.align === 'right' ? 'right' : 'left'}
              {...columnStyle(column)}
              {...(sortable
                ? {
                    onPress: () => onSort(column.key),
                    role: 'button' as const,
                    // The caret is drawn rather than left to a component's own indicator, which is
                    // what keeps exactly one column marked after the sort moves.
                    'aria-label': `Sort by ${column.label}`,
                    testID: testID ? `${testID}-sort-${column.key}` : undefined,
                  }
                : {})}
              style={active ? { color: t.text.primary } : undefined}
            >
              {active ? `${column.label} ↓` : column.label}
            </MicroLabel>
          );
        })}
      </XStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false} scrollEnabled={capacity < rows.length}>
        {visible.map((row) => (
          <XStack
            key={keyOf(row)}
            items="center"
            gap={COLUMN_GAP}
            height={ROW_HEIGHT}
            borderBottomWidth={1}
            borderColor="$rowBorder"
            role="row"
          >
            {shown.map((column) => {
              const content = cell(row, column);
              return (
                <YStack key={column.key} {...columnStyle(column)} minW={0}>
                  {typeof content === 'string' ? (
                    <MonoText
                      variant="row"
                      color="$textStrong"
                      numberOfLines={1}
                      text={column.align === 'right' ? 'right' : 'left'}
                    >
                      {content}
                    </MonoText>
                  ) : (
                    content
                  )}
                </YStack>
              );
            })}
          </XStack>
        ))}
      </ScrollView>

      {footer && (
        <MonoText
          variant="footer"
          color="$textDim"
          numberOfLines={1}
          height={ROW_HEIGHT}
          testID={testID ? `${testID}-footer` : undefined}
        >
          {footer}
        </MonoText>
      )}
    </YStack>
  );
}
