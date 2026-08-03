import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { MOTION, withAlpha, type TelemetryTokens } from '@/theme/telemetry';
import type { Sample } from '@/utils/sampleBuffer';
import { gridLines, plotMirrored, plotSeries, type SeriesPlot } from '@/utils/seriesGeometry';
import type { ChartRung } from '@/utils/typeScale';

/**
 * The telemetry time series: gridlines, an unsmoothed polyline, a gradient area
 * fill and the current-value marker.
 *
 * **No smoothing.** The handoff is explicit about it — this is telemetry, and a
 * spline through sampled values invents readings that never happened.
 *
 * Text lives outside this canvas: Skia cannot host React Native text and drawing
 * its own would need a bundled `SkFont`, so `ChartView` overlays the Y and time
 * labels using the same plot maths from `utils/seriesGeometry.ts`.
 */

export interface SeriesLayer {
  samples: readonly Sample[];
  color: string;
  /** Area fill under the line. The upload half of a mirrored chart has none. */
  fill?: boolean;
}

export interface SeriesCanvasProps {
  width: number;
  height: number;
  layers: SeriesLayer[];
  domain: readonly [number, number];
  tokens: TelemetryTokens;
  rung: ChartRung;
  /** Room at the left for the inline Y labels. */
  paddingLeft?: number;
  /** Draw both layers from a shared centre baseline — the network widget. */
  mirrored?: boolean;
  testID?: string;
}

const LINE_WIDTH = 1.5;
const MIRROR_LINE_WIDTH = 0.9;
const MARKER_RADIUS = 3.2;
const HALO_RADIUS = 7;

export function SeriesCanvas({
  width,
  height,
  layers,
  domain,
  tokens,
  rung,
  paddingLeft = 0,
  mirrored = false,
  testID,
}: SeriesCanvasProps) {
  const reducedMotion = useReducedMotion();

  // The line draws itself in once, on mount — never again. Re-running it on
  // every data tick would turn a live chart into a strobe.
  const draw = useSharedValue(reducedMotion ? 1 : 0);
  const halo = useSharedValue(1);

  const dark = tokens.mode === 'dark';

  // One effect for both animations: they are written to the same pair of shared
  // values, and splitting them means one effect modifies a value the other
  // depends on — which the immutability lint rule rightly refuses.
  useEffect(() => {
    if (reducedMotion) {
      draw.value = 1;
      halo.value = 1;
      return;
    }

    draw.value = withTiming(1, {
      duration: MOTION.chartDrawIn,
      easing: Easing.bezier(...MOTION.easing),
    });

    // 2.2s breathe, dark mode only — the one looping animation in the design.
    halo.value =
      dark && rung === 'full'
        ? withRepeat(
            withSequence(
              withTiming(0.35, {
                duration: MOTION.markerBreathe / 2,
                easing: Easing.inOut(Easing.ease),
              }),
              withTiming(1, {
                duration: MOTION.markerBreathe / 2,
                easing: Easing.inOut(Easing.ease),
              }),
            ),
            -1,
            false,
          )
        : 1;
  }, [dark, draw, halo, reducedMotion, rung]);

  const box = useMemo(
    () => ({
      width,
      height,
      paddingLeft: rung === 'full' || rung === 'grid' ? paddingLeft : 0,
      paddingTop: 2,
      paddingBottom: 2,
    }),
    [height, paddingLeft, rung, width],
  );

  const plots = useMemo(
    () =>
      layers.map((layer, index) =>
        mirrored
          ? plotMirrored(layer.samples, domain, box, index === 0 ? 'upper' : 'lower')
          : plotSeries(layer.samples, domain, box),
      ),
    [box, domain, layers, mirrored],
  );

  const rules = useMemo(() => {
    if (rung === 'sparkline' || rung === 'pulse' || rung === 'none') return [];
    const reference = plots[0];
    if (!reference) return [];
    return gridLines(domain, reference.top, reference.bottom);
  }, [domain, plots, rung]);

  if (width <= 0 || height <= 0 || rung === 'none') return null;

  const centreY = height / 2;

  return (
    <Canvas style={{ width, height }} testID={testID}>
      {/* Gridlines. Solid at the domain ends, dashed 2/5 at the quarters. */}
      {!mirrored &&
        rules.map((rule) => (
          <Line
            key={`grid-${rule.value}`}
            p1={vec(plots[0]?.left ?? 0, rule.y)}
            p2={vec(plots[0]?.right ?? width, rule.y)}
            color={tokens.border.gridline}
            strokeWidth={1}
          >
            {rule.dashed && <DashPathEffect intervals={[2, 5]} />}
          </Line>
        ))}

      {/* A mirrored chart has a solid centre rule and dashed guides instead. */}
      {mirrored && rung !== 'sparkline' && rung !== 'pulse' && (
        <Group>
          <Line
            p1={vec(0, centreY)}
            p2={vec(width, centreY)}
            color={tokens.chart.baseline}
            strokeWidth={1}
          />
          {rung === 'full' && (
            <>
              <Line
                p1={vec(0, centreY - height / 4)}
                p2={vec(width, centreY - height / 4)}
                color={tokens.border.gridline}
                strokeWidth={1}
              >
                <DashPathEffect intervals={[2, 5]} />
              </Line>
              <Line
                p1={vec(0, centreY + height / 4)}
                p2={vec(width, centreY + height / 4)}
                color={tokens.border.gridline}
                strokeWidth={1}
              >
                <DashPathEffect intervals={[2, 5]} />
              </Line>
            </>
          )}
        </Group>
      )}

      {layers.map((layer, index) => {
        const plot = plots[index];
        if (!plot || plot.points.length === 0) return null;

        const stroke = mirrored ? MIRROR_LINE_WIDTH : LINE_WIDTH;
        const linePath = buildLinePath(plot);
        const baseline = mirrored && index === 1 ? plot.top : plot.bottom;

        return (
          <Group key={`layer-${index}`}>
            {layer.fill !== false && rung !== 'pulse' && (
              <Path path={buildAreaPath(plot, baseline)} style="fill" end={draw}>
                <LinearGradient
                  start={vec(0, plot.top)}
                  end={vec(0, plot.bottom)}
                  colors={[
                    withAlpha(layer.color, tokens.mode === 'dark' ? 0.26 : 0.18),
                    withAlpha(layer.color, 0),
                  ]}
                />
              </Path>
            )}
            <Path
              path={linePath}
              style="stroke"
              strokeWidth={rung === 'pulse' ? 3 : stroke}
              strokeJoin="round"
              color={layer.color}
              // `end` trims the path, which is Skia's equivalent of the
              // stroke-dashoffset draw-in the design specifies.
              end={draw}
            />
          </Group>
        );
      })}

      {/* Current-value marker: dashed rule at the newest sample, plus a dot and
          (dark mode only) a halo that breathes. */}
      {rung === 'full' && !mirrored && plots[0]?.last && (
        <Group>
          <Line
            p1={vec(plots[0].last.x, plots[0].top)}
            p2={vec(plots[0].last.x, plots[0].bottom)}
            color={tokens.chart.marker}
            strokeWidth={1}
          >
            <DashPathEffect intervals={[3, 4]} />
          </Line>
          {tokens.mode === 'dark' && (
            <Circle
              cx={plots[0].last.x}
              cy={plots[0].last.y}
              r={HALO_RADIUS}
              color={layers[0]?.color ?? tokens.chart.spark}
              style="stroke"
              strokeWidth={1}
              opacity={halo}
            />
          )}
          <Circle
            cx={plots[0].last.x}
            cy={plots[0].last.y}
            r={MARKER_RADIUS}
            color={layers[0]?.color ?? tokens.chart.spark}
          />
        </Group>
      )}
    </Canvas>
  );
}

function buildLinePath(plot: SeriesPlot) {
  const path = Skia.Path.Make();
  plot.points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  // A single sample has no line; give it a hairline so the marker has something
  // to sit on rather than the chart looking broken on the first poll.
  if (plot.points.length === 1) path.lineTo(plot.points[0].x, plot.points[0].y);
  return path;
}

function buildAreaPath(plot: SeriesPlot, baseline: number) {
  const path = buildLinePath(plot).copy();
  const first = plot.points[0];
  const last = plot.points[plot.points.length - 1];
  path.lineTo(last.x, baseline);
  path.lineTo(first.x, baseline);
  path.close();
  return path;
}
