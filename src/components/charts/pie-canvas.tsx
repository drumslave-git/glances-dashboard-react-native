import { useMemo } from 'react';
import { Pie, PolarChart } from 'victory-native';

import type { ChartSegment } from '@/utils/widgetData';

interface PieCanvasProps {
  segments: ChartSegment[];
  /** Diameter in points. The canvas is square. */
  size: number;
  /** 0 draws a filled pie. */
  innerRadius: number;
  /** Gap between slices, in points. */
  gap: number;
}

/**
 * The Skia half of the donut/pie widgets: slices only, no text — React Native
 * text cannot be placed inside a Skia canvas, so `ChartView` overlays the labels.
 *
 * Only files in this directory may import `victory-native` (see AGENTS.md): the
 * boundary is the escape hatch if Skia-on-web ever has to be swapped for SVG.
 */
export function PieCanvas({ segments, size, innerRadius, gap }: PieCanvasProps) {
  const data = useMemo(
    () =>
      segments.map((segment) => ({
        label: segment.name,
        value: segment.value,
        color: segment.color,
      })),
    [segments],
  );

  return (
    <PolarChart
      data={data}
      labelKey="label"
      valueKey="value"
      colorKey="color"
      explicitSize={{ width: size, height: size }}
    >
      <Pie.Chart innerRadius={innerRadius}>
        {() => (
          <>
            <Pie.Slice />
            {gap > 0 && (
              // `clear` punches the gap straight through to the transparent canvas,
              // so the card background shows through whatever theme is active — no
              // need to guess a matching stroke colour.
              <Pie.SliceAngularInset
                angularInset={{ angularStrokeWidth: gap, angularStrokeColor: 'black' }}
                blendMode="clear"
              />
            )}
          </>
        )}
      </Pie.Chart>
    </PolarChart>
  );
}
