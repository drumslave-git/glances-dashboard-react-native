import { Suspense } from 'react';
import { YStack } from 'tamagui';

import { useTelemetry } from '@/theme/use-telemetry';
import type { Sample } from '@/utils/sampleBuffer';
import { seriesDomain } from '@/utils/sampleBuffer';

import { SeriesCanvas } from './canvases';

interface SparklineProps {
  samples: readonly Sample[];
  width: number;
  height: number;
  color: string;
  /**
   * Pin the scale to 0–100 instead of following the data.
   *
   * What a stack of sparklines is for: with each row scaled to its own peak, an idle process draws
   * the same busy silhouette as a saturated one, and comparing two rows becomes impossible.
   */
  percentage?: boolean;
  testID?: string;
}

/**
 * A bare line in a box: no grid, no axis, no marker — the process table's TREND
 * column, and the bottom rung of the chart degrade ladder.
 *
 * It goes through the same canvas as the full chart rather than a second
 * implementation, so a sparkline and the chart it degrades from cannot drift
 * apart. The `sparkline` rung is what turns everything else off.
 */
export function Sparkline({
  samples,
  width,
  height,
  color,
  percentage = false,
  testID,
}: SparklineProps) {
  const { t } = useTelemetry();

  if (samples.length === 0 || width <= 0 || height <= 0) {
    // An empty box rather than nothing, so the column keeps its width and the
    // rows do not jump as history accumulates.
    return <YStack width={width} height={height} testID={testID} />;
  }

  return (
    <YStack width={width} height={height} testID={testID}>
      <Suspense fallback={null}>
        <SeriesCanvas
          width={width}
          height={height}
          layers={[{ samples, color, fill: false }]}
          domain={seriesDomain(samples, { percentage })}
          tokens={t}
          rung="sparkline"
        />
      </Suspense>
    </YStack>
  );
}
