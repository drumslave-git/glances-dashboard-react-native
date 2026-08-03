import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { MicroLabel, MonoText } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import { buildSummaryCells, type SummarySources } from '@/utils/summaryStrip';

/**
 * The six-cell summary strip: HOST · UPTIME · KERNEL · LOAD AVG · PROCESSES · DISK.
 *
 * The desktop design lays these out as six equal columns with a hairline between
 * them. That is unreadable at phone widths, so the strip **wraps into a grid**
 * instead of scrolling: three columns on a phone, six when there is room. Every
 * cell stays on screen, which matters because the strip is the only place the
 * machine's identity and uptime appear once the toolbar is hidden.
 */

/**
 * Column counts by width. Three columns on a 393pt phone leaves ~95pt for a
 * 13.5pt mono readout, which truncates `6.17.0-40-generic` and every load
 * average — so a phone gets two columns and three rows instead.
 */
const SIX_COLUMN_WIDTH = 700;
const THREE_COLUMN_WIDTH = 460;

function columnsForWidth(width: number): number {
  if (width === 0 || width >= SIX_COLUMN_WIDTH) return 6;
  return width >= THREE_COLUMN_WIDTH ? 3 : 2;
}

interface SummaryStripProps extends SummarySources {
  testID?: string;
}

export function SummaryStrip({ testID, ...sources }: SummaryStripProps) {
  const { t } = useTelemetry();
  const [width, setWidth] = useState(0);
  const columns = columnsForWidth(width);
  // The design's 18pt cell padding is a third of a phone cell's usable width.
  const cellPaddingX = columns === 6 ? GEOMETRY.summaryCellPadding.horizontal : 12;

  const cells = useMemo(() => buildSummaryCells(sources), [sources]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (current === next ? current : next));
  };

  return (
    <YStack
      bg="$railBg"
      borderBottomWidth={1}
      borderColor="$chromeBorder"
      onLayout={onLayout}
      testID={testID}
    >
      <XStack flexWrap="wrap">
        {cells.map((cell, index) => (
          <YStack
            key={cell.key}
            width={`${100 / columns}%`}
            gap={3}
            px={cellPaddingX}
            py={GEOMETRY.summaryCellPadding.vertical}
            // The design's left divider on every cell — except the first of each
            // row, where it would sit against the strip's own edge.
            borderLeftWidth={index % columns === 0 ? 0 : 1}
            borderTopWidth={index >= columns ? 1 : 0}
            style={{ borderColor: t.border.hairline }}
            testID={testID ? `${testID}-${cell.key}` : undefined}
          >
            <MicroLabel>{cell.label}</MicroLabel>
            <MonoText variant="readout" color="$textStrong" numberOfLines={1}>
              {cell.value}
            </MonoText>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}
