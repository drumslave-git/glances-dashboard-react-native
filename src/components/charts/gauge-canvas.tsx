import { Canvas, Circle, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION, type TelemetryTokens } from '@/theme/telemetry';
import { GAUGE_START_ANGLE, bezelTicks, ringRadius } from '@/utils/seriesGeometry';

/**
 * The ring gauge: a 60-tick bezel, a full track circle, and a value arc that
 * starts at twelve o'clock and sweeps clockwise with a round cap.
 *
 * The centre value is React Native text overlaid by `ChartView` — same reason as
 * every other chart here, Skia has no text without a bundled font.
 */

export interface GaugeCanvasProps {
  /** Box side in points. The gauge is square. */
  size: number;
  /** 0–100. */
  percent: number;
  color: string;
  tokens: TelemetryTokens;
  strokeWidth?: number;
  testID?: string;
}

const DEFAULT_STROKE = 9;

export function GaugeCanvas({
  size,
  percent,
  color,
  tokens,
  strokeWidth = DEFAULT_STROKE,
  testID,
}: GaugeCanvasProps) {
  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(reducedMotion ? 1 : 0);

  // Mount only, like the line draw-in: a live value should move the arc, not
  // replay its entrance.
  useEffect(() => {
    if (reducedMotion) {
      sweep.value = 1;
      return;
    }
    sweep.value = withTiming(1, {
      duration: MOTION.ringDrawIn,
      easing: Easing.bezier(...MOTION.easing),
    });
  }, [reducedMotion, sweep]);

  const radius = ringRadius(size, strokeWidth);
  // Plain numbers rather than a `{ x, y }` literal: an object rebuilt every
  // render is a new memo dependency every render.
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));

  const ticks = useMemo(() => bezelTicks({ x: cx, y: cy }, radius), [cx, cy, radius]);

  const arc = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
      GAUGE_START_ANGLE,
      // Skia's own trim (`end` below) handles the draw-in; the arc itself is the
      // value, so a full circle at 100% closes exactly.
      (clamped / 100) * 360,
    );
    return path;
  }, [clamped, cx, cy, radius]);

  if (size <= 0 || radius <= 0) return null;

  return (
    <Canvas style={{ width: size, height: size }} testID={testID}>
      <Group>
        {ticks.map((tick, index) => (
          <Line
            key={`tick-${index}`}
            p1={vec(tick.x1, tick.y1)}
            p2={vec(tick.x2, tick.y2)}
            color={tokens.chart.bezel}
            strokeWidth={1}
          />
        ))}
      </Group>

      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={tokens.bg.track}
        style="stroke"
        strokeWidth={strokeWidth}
      />

      <Path
        path={arc}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        color={color}
        end={sweep}
      />
    </Canvas>
  );
}
