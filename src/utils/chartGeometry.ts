import type { DonutChartOptions } from '@/types/dashboard';

import type { ChartSegment } from './widgetData';

/**
 * Pure layout maths for the chart widgets.
 *
 * Two jobs: reproduce the reference app's chart sizing rules, and work out where
 * segment labels belong. Victory Native draws the slices inside a Skia canvas
 * where React Native text cannot go, so labels are rendered as an overlay and
 * have to be positioned with the same angle maths Victory uses internally
 * (`victory-native/src/pie/PieChart.tsx`): degrees, starting at 3 o'clock and
 * sweeping clockwise, each slice taking `value / total` of the circle.
 */

/** Below this the reference app refused to draw a chart at all. */
export const MIN_CHART_SIZE = 120;
export const DEFAULT_CHART_THICKNESS = 20;

/** A slice value at or below this fraction of the circle has no room for a label. */
const MIN_LABELLED_SWEEP_DEGREES = 18;

export interface ResolvedChartOptions {
  /** Fixed diameter in points, or undefined to fill the container. */
  size?: number;
  thickness: number;
  paddingAngle: number;
  withLabels: boolean;
}

/** Apply the reference app's defaults to a partially-filled options object. */
export function resolveChartOptions(options?: DonutChartOptions | null): ResolvedChartOptions {
  const size = options?.size;
  return {
    ...(size != null && size > 0 ? { size } : {}),
    thickness: options?.thickness ?? DEFAULT_CHART_THICKNESS,
    paddingAngle: options?.paddingAngle ?? 0,
    withLabels: options?.withLabels ?? true,
  };
}

/**
 * Diameter of a round chart, or null while the container has not been measured.
 * Ported from the reference `ChartView`: an explicit size wins, otherwise the
 * chart is as large as the smaller container axis but never thinner than the ring.
 */
export function resolveChartSize({
  width,
  height,
  size,
  thickness,
}: {
  width: number;
  height: number;
  size?: number;
  thickness: number;
}): number | null {
  if (size != null && size > 0) return size;
  if (!(width > 0) || !(height > 0)) return null;
  return Math.max(thickness, Math.min(width, height));
}

/** Inner radius of a donut. Zero (a full pie) once the ring is thicker than the radius. */
export function donutInnerRadius(size: number, thickness: number): number {
  const radius = size / 2;
  return Math.max(0, radius - Math.max(0, thickness));
}

export interface SliceGeometry {
  name: string;
  /** Degrees, 3 o'clock is 0 and the sweep is clockwise — Skia's convention. */
  startAngle: number;
  endAngle: number;
  midAngle: number;
  sweepAngle: number;
}

/** Slice angles, matching what Victory Native computes for the same data. */
export function sliceGeometry(segments: Pick<ChartSegment, 'name' | 'value'>[]): SliceGeometry[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!(total > 0)) return [];

  let startAngle = 0;
  return segments.map((segment) => {
    const sweepAngle = (segment.value / total) * 360;
    const geometry: SliceGeometry = {
      name: segment.name,
      startAngle,
      endAngle: startAngle + sweepAngle,
      midAngle: startAngle + sweepAngle / 2,
      sweepAngle,
    };
    startAngle += sweepAngle;
    return geometry;
  });
}

export interface SliceLabel {
  name: string;
  text: string;
  /** Centre of the label, in points from the top-left of the square chart box. */
  x: number;
  y: number;
}

/** The reference app labelled a segment with its formatted value when it had one. */
export function segmentLabelText(segment: ChartSegment): string {
  return segment.displayLabel ?? segment.name;
}

/**
 * Where each slice's label goes inside a `size` × `size` box. Slivers are dropped
 * rather than overlapped into an unreadable pile.
 */
export function sliceLabels(
  segments: ChartSegment[],
  { size, innerRadius }: { size: number; innerRadius: number },
): SliceLabel[] {
  const centre = size / 2;
  const radius = size / 2;
  // A donut labels the middle of its ring; a full pie sits the label between the
  // centre and the rim, where a horizontal label is least likely to overflow.
  const labelRadius = innerRadius > 0 ? (innerRadius + radius) / 2 : radius * 0.6;

  const byName = new Map(segments.map((segment) => [segment.name, segment]));
  return sliceGeometry(segments)
    .filter((slice) => slice.sweepAngle >= MIN_LABELLED_SWEEP_DEGREES)
    .map((slice) => {
      const radians = (slice.midAngle * Math.PI) / 180;
      const segment = byName.get(slice.name);
      return {
        name: slice.name,
        text: segment ? segmentLabelText(segment) : slice.name,
        x: centre + labelRadius * Math.cos(radians),
        y: centre + labelRadius * Math.sin(radians),
      };
    });
}

/**
 * The reference app's `paddingAngle` is a gap in degrees; Victory Native's
 * equivalent (`Pie.SliceAngularInset`) is a stroke width in points. Convert via
 * the chord the angle subtends at the rim so the gap looks the same size.
 */
export function paddingAngleToGap(paddingAngle: number, radius: number): number {
  if (!(paddingAngle > 0) || !(radius > 0)) return 0;
  const clamped = Math.min(paddingAngle, 60);
  return 2 * radius * Math.sin((clamped * Math.PI) / 360);
}

/**
 * Y domain for the bar chart. Always includes zero so bars are read against a
 * baseline, and never collapses to a single point when every value is the same.
 */
export function barDomain(segments: Pick<ChartSegment, 'value'>[]): [number, number] {
  const values = segments.map((segment) => segment.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (min === max) return [0, 1];
  return [min, max];
}
