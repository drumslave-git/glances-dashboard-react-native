import { useMemo } from 'react';
import { BarGroup, CartesianChart } from 'victory-native';

import { barDomain } from '@/utils/chartGeometry';
import type { ChartSegment } from '@/utils/widgetData';

/**
 * The x value of the single bar group. Prefixed so it cannot collide with a
 * Glances field name, which is what every other key in the row is.
 */
const X_KEY = '__group';

interface BarCanvasProps {
  segments: ChartSegment[];
  width: number;
  height: number;
}

/**
 * One bar per numeric field, side by side — the same shape the reference app
 * produced with a single-row Mantine `BarChart`.
 *
 * Axes are deliberately omitted: Victory only renders them when an axis prop is
 * supplied, and drawing tick labels would need a Skia font asset. `ChartView`
 * puts a legend underneath instead.
 */
export function BarCanvas({ segments, width, height }: BarCanvasProps) {
  const data = useMemo(() => {
    const row: Record<string, number> = { [X_KEY]: 0 };
    for (const segment of segments) row[segment.name] = segment.value;
    return [row];
  }, [segments]);

  const yKeys = useMemo(() => segments.map((segment) => segment.name), [segments]);
  const domain = useMemo(() => ({ y: barDomain(segments) }), [segments]);

  return (
    <CartesianChart
      data={data}
      xKey={X_KEY}
      yKeys={yKeys}
      domain={domain}
      domainPadding={{ left: 12, right: 12, top: 8 }}
      explicitSize={{ width, height }}
    >
      {({ points, chartBounds }) => (
        <BarGroup
          chartBounds={chartBounds}
          betweenGroupPadding={0.2}
          withinGroupPadding={0.15}
          roundedCorners={{ topLeft: 3, topRight: 3 }}
        >
          {segments.map((segment) => (
            <BarGroup.Bar
              key={segment.name}
              points={points[segment.name] ?? []}
              color={segment.color}
            />
          ))}
        </BarGroup>
      )}
    </CartesianChart>
  );
}
