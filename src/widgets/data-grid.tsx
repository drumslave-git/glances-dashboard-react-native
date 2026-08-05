/**
 * The tabular readout, ported from the reference's `ui/DataGrid` (ref §7.4).
 *
 * The reference uses CSS grid rather than a `<table>` because its rows carry things a table cell
 * handles badly — a sparkline, a bar with a number beside it, a two-line name. React Native has no
 * grid, so the same job is done with flex rows over a shared column spec: header and body read the
 * same `GridColumn[]`, which is what stops a column drifting between the two.
 *
 * Three behaviours are the point of the component rather than decoration:
 *
 * - **Columns drop by priority, they never clip.** The measured width decides which survive
 *   (`visibleColumns`), and a priority-0 column survives everything.
 * - **Rows are never half-cut.** The row count follows the measured height, so the table ends on a
 *   whole row and a partial one is simply not drawn.
 * - **A row is two lines.** Every table in the reference puts a qualifier under its value — the
 *   device under the mount, the engine under the container, the average under the peak. It is what
 *   lets a five-column table carry ten figures, and it is why `stacked` changes the row height
 *   rather than each cell deciding for itself: rows that disagree about their height cannot be
 *   counted against the available space.
 *
 * Row heights are derived from the reading scale rather than fixed, so a larger interface size
 * gives fewer, taller rows instead of clipping every one of them.
 *
 * The header sits outside the scroll view, which is how a sticky header is spelled here.
 */
import type { ReactNode } from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';

import { MicroLabel, MonoText } from '@/components/telemetry/text';
import { useTelemetry } from '@/theme/use-telemetry';

import { columnStyle, visibleColumns, type GridColumn } from './grid-columns';

const COLUMN_GAP = 10;

/** Line box for a font size — the leading this design uses for dense rows. */
const lineHeight = (size: number) => Math.ceil(size * 1.35);

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
  /** Rows carry a second line (see the module comment), so they are taller. */
  stacked?: boolean;
  /** The column currently sorted, if the table sorts. */
  sortKey?: string;
  onSort?: (key: string) => void;
  /** A line under the table — the reference's processcount footer. */
  footer?: ReactNode | string | null;
  emptyMessage?: string;
  /** Cap on rows drawn, on top of whatever the height allows. */
  maxRows?: number;
  testID?: string;
}

export function DataGrid<Row>({
  columns,
  rows,
  keyOf,
  cell,
  width,
  height,
  stacked = false,
  sortKey,
  onSort,
  footer,
  emptyMessage = 'Nothing to show.',
  maxRows,
  testID,
}: DataGridProps<Row>) {
  const { t, size } = useTelemetry();
  const shown = visibleColumns(columns, width);

  const headerHeight = lineHeight(size('micro')) + 6;
  const footerHeight = lineHeight(size('footer')) + 4;
  const rowHeight = lineHeight(size('row')) + (stacked ? lineHeight(size('device')) : 0) + 6;

  const bodyHeight = Math.max(0, height - headerHeight - (footer ? footerHeight : 0));
  // Whole rows only: a half-cut row reads as a rendering fault, where a shorter table plainly
  // says there was no room.
  const capacity = Math.max(0, Math.floor(bodyHeight / rowHeight));
  const visible = rows.slice(0, Math.min(capacity, maxRows ?? capacity));

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
        height={headerHeight}
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
            height={rowHeight}
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

      {footer != null &&
        (typeof footer === 'string' ? (
          <MonoText
            variant="footer"
            color="$textDim"
            numberOfLines={1}
            height={footerHeight}
            testID={testID ? `${testID}-footer` : undefined}
          >
            {footer}
          </MonoText>
        ) : (
          <YStack height={footerHeight} testID={testID ? `${testID}-footer` : undefined}>
            {footer}
          </YStack>
        ))}
    </YStack>
  );
}

/**
 * A cell's value with its qualifier underneath — the reference's two-line row.
 *
 * The second line is the `device` type role, the same one the widget header's device line uses:
 * it is the same relationship (this is *what* the thing above is), so it reads at the same weight.
 * `ellipsize` exists for the one case where the tail identifies the row — mount paths agree at the
 * start and differ at the end, so cutting the end destroys exactly what names it.
 */
export function GridStack({
  value,
  meta,
  align = 'left',
  color,
  metaColor,
  ellipsize = 'tail',
}: {
  value: ReactNode | string;
  meta?: ReactNode | string | null;
  align?: 'left' | 'right';
  color?: string;
  metaColor?: string;
  ellipsize?: 'head' | 'tail';
}) {
  return (
    <YStack minW={0} gap={1}>
      {typeof value === 'string' ? (
        <MonoText
          variant="row"
          color="$textStrong"
          numberOfLines={1}
          ellipsizeMode={ellipsize}
          text={align}
          style={color ? { color } : undefined}
        >
          {value}
        </MonoText>
      ) : (
        value
      )}
      {meta != null &&
        (typeof meta === 'string' ? (
          <MonoText
            variant="device"
            color="$textDim"
            numberOfLines={1}
            ellipsizeMode={ellipsize}
            text={align}
            style={metaColor ? { color: metaColor } : undefined}
          >
            {meta}
          </MonoText>
        ) : (
          meta
        ))}
    </YStack>
  );
}
