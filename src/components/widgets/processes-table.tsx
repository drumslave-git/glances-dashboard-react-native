import { useMemo } from 'react';
import { Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import {
  buildProcessTable,
  getProcessHeaderLabel,
  processColumnWidth,
} from '@/utils/processTable';

interface ProcessesTableProps {
  data: unknown;
  /** Columns to show. Empty or omitted falls back to the default four. */
  fields?: string[];
  fieldFormatters?: Record<string, string>;
  testID?: string;
}

/**
 * The process list as a table. Columns are fixed-width so the header lines up
 * with the rows, which is also what makes the horizontal scroll work: the whole
 * table is wider than the card and slides under a header that scrolls with it
 * sideways but stays put vertically.
 */
export function ProcessesTable({ data, fields, fieldFormatters, testID }: ProcessesTableProps) {
  const { columns, rows } = useMemo(
    () => buildProcessTable(data, fields, fieldFormatters),
    [data, fields, fieldFormatters],
  );

  if (rows.length === 0) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-empty` : undefined}>
        No processes to show.
      </Paragraph>
    );
  }

  return (
    // A horizontal ScrollView stretches its content vertically, so the table
    // below gets the card's full height without a contentContainerStyle.
    <ScrollView horizontal flex={1} showsHorizontalScrollIndicator={false} testID={testID}>
      <YStack flex={1}>
        <XStack borderBottomWidth={1} borderColor="$borderColor" pb="$1">
          {columns.map((field) => (
            <Paragraph
              key={field}
              size="$1"
              width={processColumnWidth(field)}
              px="$1"
              opacity={0.7}
              numberOfLines={1}
              testID={testID ? `${testID}-header-${field}` : undefined}
            >
              {getProcessHeaderLabel(field)}
            </Paragraph>
          ))}
        </XStack>

        {/* Nested inside a horizontal ScrollView, so Android needs telling that
            this one owns vertical drags. */}
        <ScrollView flex={1} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {rows.map((row, index) => (
            <XStack
              key={row.key}
              py="$1"
              // Striping stands in for the reference table's `striped` prop.
              bg={index % 2 === 1 ? '$color2' : 'transparent'}
              testID={testID ? `${testID}-row-${row.key}` : undefined}
            >
              {row.cells.map((cell, cellIndex) => (
                <Paragraph
                  key={columns[cellIndex]}
                  size="$1"
                  width={processColumnWidth(columns[cellIndex])}
                  px="$1"
                  numberOfLines={1}
                >
                  {cell}
                </Paragraph>
              ))}
            </XStack>
          ))}
        </ScrollView>
      </YStack>
    </ScrollView>
  );
}
