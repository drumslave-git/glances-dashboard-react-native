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
export function Sparkline({ samples, width, height, color, testID }: SparklineProps) {
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
          domain={seriesDomain(samples)}
          tokens={t}
          rung="sparkline"
        />
      </Suspense>
    </YStack>
  );
}
