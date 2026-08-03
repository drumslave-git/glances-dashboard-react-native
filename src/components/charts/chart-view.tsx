import { Suspense, useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { GaugeValue } from '@/components/telemetry/hero';
import { MicroLabel, MonoText } from '@/components/telemetry/text';
import { onColorText } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import {
  donutInnerRadius,
  paddingAngleToGap,
  resolveChartOptions,
  resolveChartSize,
  segmentLabelText,
  sliceLabels,
} from '@/utils/chartGeometry';
import { formatClock, timeAxisTicks, type Sample } from '@/utils/sampleBuffer';
import { gridLines } from '@/utils/seriesGeometry';
import type { ChartRung } from '@/utils/typeScale';
import type { ChartSegment } from '@/utils/widgetData';
import type { DonutChartOptions } from '@/types/dashboard';

import { BarCanvas, GaugeCanvas, PieCanvas, SeriesCanvas } from './canvases';

export type ChartKind = 'donut' | 'pie' | 'bar' | 'gauge' | 'line';

/** One plotted series — the CPU line, or the download half of a network chart. */
export interface ChartSeries {
  samples: readonly Sample[];
  color: string;
  /** Area fill under the line. The upload half of a mirrored chart has none. */
  fill?: boolean;
}

export interface ChartViewProps {
  kind: ChartKind;
  segments: ChartSegment[];
  /** Fallback for the donut's centre label, as in the reference app. */
  metric: string;
  /** Centre label with its tokens already resolved. */
  chartLabel?: string;
  options?: DonutChartOptions;

  /** `line` only. */
  series?: ChartSeries[];
  domain?: readonly [number, number];
  mirrored?: boolean;
  /** Which rung of the chart degrade ladder to draw. */
  rung?: ChartRung;

  /** `gauge` only — 0–100, plus the text for the middle of the ring. */
  percent?: number;
  gaugeValue?: string;
  gaugeUnit?: string;
  gaugeCaption?: string;

  /** Endpoint or metric-family colour. Defaults to the primary lime. */
  accentColor?: string;
  /**
   * Skip the measurement pass for the `line` and `gauge` kinds.
   *
   * The widget shell has already measured itself — passing that down draws the
   * chart on the first frame instead of the second, and keeps the geometry
   * deterministic in tests, where no layout event ever fires.
   */
  explicitSize?: { width: number; height: number };
  testID?: string;
}

/**
 * The one way charts are drawn in this app. Nothing above this component knows
 * that Victory Native and Skia exist — swapping in an SVG renderer for the web
 * would mean replacing the canvas components beside this file and nothing else.
 *
 * Text is always overlaid rather than drawn into the canvas: React Native text
 * cannot live inside a Skia canvas, and Skia's own text needs a bundled font
 * asset. So every label here — slice labels, the gauge centre, the Y and time
 * axes — is a Tamagui `Text` positioned from the same pure geometry the canvas
 * drew with.
 */
export function ChartView(props: ChartViewProps) {
  switch (props.kind) {
    case 'bar':
      return <BarChartView {...props} />;
    case 'gauge':
      return <GaugeChartView {...props} />;
    case 'line':
      return <LineChartView {...props} />;
    default:
      return <RoundChartView {...props} />;
  }
}

/** Slice labels sit on top of coloured slices, so they carry their own contrast. */
const LABEL_TEXT_STYLE = {
  textShadowColor: 'rgba(0, 0, 0, 0.85)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
} as const;

const LABEL_LINE_HEIGHT = 14;
/** Room at the left of a series plot for the inline Y labels. */
const Y_LABEL_GUTTER = 26;
const AXIS_ROW_HEIGHT = 14;

function useMeasuredBox() {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }, []);
  return { box, onLayout };
}

/* ------------------------------------------------------------------ *
 * Time series
 * ------------------------------------------------------------------ */

function LineChartView({
  series = [],
  domain = [0, 100],
  mirrored = false,
  rung = 'full',
  accentColor,
  explicitSize,
  testID,
}: ChartViewProps) {
  const { t, accent } = useTelemetry();
  const { box: measured, onLayout } = useMeasuredBox();
  const box = explicitSize ?? measured;
  const lime = accent('lime');

  const layers = series.length > 0 ? series : [{ samples: [], color: accentColor ?? lime.stroke }];
  const showAxis = rung === 'full';
  const showYLabels = rung === 'full' || rung === 'grid';
  const canvasHeight = Math.max(0, box.height - (showAxis ? AXIS_ROW_HEIGHT : 0));
  const paddingLeft = showYLabels && !mirrored ? Y_LABEL_GUTTER : 0;

  const ticks = timeAxisTicks(layers[0].samples);
  const yRules = gridLines(domain, 0, canvasHeight).filter((rule) => rule.value > domain[0]);

  return (
    <YStack flex={1} onLayout={onLayout} testID={testID}>
      {box.width > 0 && canvasHeight > 0 && (
        <YStack width={box.width} height={canvasHeight} position="relative">
          <Suspense fallback={null}>
            <SeriesCanvas
              width={box.width}
              height={canvasHeight}
              layers={layers.map((layer) => ({
                samples: layer.samples,
                color: layer.color,
                ...(layer.fill !== undefined ? { fill: layer.fill } : {}),
              }))}
              domain={domain}
              tokens={t}
              rung={rung}
              paddingLeft={paddingLeft}
              mirrored={mirrored}
              testID={testID ? `${testID}-canvas` : undefined}
            />
          </Suspense>

          {/* Inline Y labels at x=4, as in the design — inside the plot, not
              beside it, which is what lets the line use the full width. */}
          {showYLabels &&
            !mirrored &&
            yRules.map((rule) => (
              <YStack
                key={`y-${rule.value}`}
                position="absolute"
                l={4}
                t={rule.y - 6}
                pointerEvents="none"
              >
                <MonoText variant="axis" color="$textFaint">
                  {formatAxisValue(rule.value)}
                </MonoText>
              </YStack>
            ))}
        </YStack>
      )}

      {showAxis && ticks.length > 0 && (
        <XStack justify="space-between" height={AXIS_ROW_HEIGHT} items="center">
          {ticks.map((tick, index) => (
            <MonoText
              key={`tick-${tick.t}-${index}`}
              variant="axis"
              color="$textFaint"
              testID={testID ? `${testID}-axis-${index}` : undefined}
            >
              {formatClock(tick.t)}
            </MonoText>
          ))}
        </XStack>
      )}
    </YStack>
  );
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

/* ------------------------------------------------------------------ *
 * Ring gauge
 * ------------------------------------------------------------------ */

function GaugeChartView({
  percent = 0,
  gaugeValue,
  gaugeUnit,
  gaugeCaption,
  accentColor,
  explicitSize,
  testID,
}: ChartViewProps) {
  const { t, accent } = useTelemetry();
  const { box: measured, onLayout } = useMeasuredBox();
  const box = explicitSize ?? measured;
  const size = Math.min(box.width, box.height);

  return (
    <YStack flex={1} items="center" justify="center" onLayout={onLayout} testID={testID}>
      {size > 0 && (
        // `position: relative` is a no-op on native, where every View is already
        // a containing block — but Tamagui emits no `position` on web, so the
        // centred overlay would otherwise resolve against an ancestor further out.
        <YStack width={size} height={size} position="relative">
          <Suspense fallback={null}>
            <GaugeCanvas
              size={size}
              percent={percent}
              color={accentColor ?? accent('lime').stroke}
              tokens={t}
              testID={testID ? `${testID}-canvas` : undefined}
            />
          </Suspense>

          <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            gap={2}
            pointerEvents="none"
          >
            <GaugeValue
              value={gaugeValue ?? `${Math.round(percent)}`}
              {...(gaugeUnit != null ? { unit: gaugeUnit } : {})}
              diameter={size}
              {...(testID ? { testID: `${testID}-value` } : {})}
            />
            {gaugeCaption != null && gaugeCaption !== '' && (
              <MicroLabel>{gaugeCaption}</MicroLabel>
            )}
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

/* ------------------------------------------------------------------ *
 * Donut / pie / bar — the reference app's charts, restyled
 * ------------------------------------------------------------------ */

function RoundChartView({ kind, segments, metric, chartLabel, options, testID }: ChartViewProps) {
  const { box, onLayout } = useMeasuredBox();
  const opts = resolveChartOptions(options);
  const size = resolveChartSize({
    width: box.width,
    height: box.height,
    ...(opts.size != null && { size: opts.size }),
    thickness: opts.thickness,
  });

  const innerRadius = size != null && kind === 'donut' ? donutInnerRadius(size, opts.thickness) : 0;
  const labels = size != null && opts.withLabels ? sliceLabels(segments, { size, innerRadius }) : [];
  const colorByName = new Map(segments.map((segment) => [segment.name, segment.color]));
  const gap = size != null ? paddingAngleToGap(opts.paddingAngle, size / 2) : 0;
  // Only the donut has a hole to write in — the reference app did the same.
  const centreLabel = kind === 'donut' ? (chartLabel ?? metric) : null;

  return (
    <YStack flex={1} items="center" justify="center" onLayout={onLayout} testID={testID}>
      {size != null && (
        <YStack width={size} height={size} position="relative">
          <Suspense fallback={null}>
            <PieCanvas segments={segments} size={size} innerRadius={innerRadius} gap={gap} />
          </Suspense>

          {centreLabel != null && centreLabel !== '' && (
            <YStack
              position="absolute"
              t={0}
              l={0}
              r={0}
              b={0}
              items="center"
              justify="center"
              pointerEvents="none"
            >
              <MonoText
                variant="readout"
                color="$textPrimary"
                numberOfLines={1}
                style={LABEL_TEXT_STYLE}
                testID={testID ? `${testID}-centre-label` : undefined}
              >
                {centreLabel}
              </MonoText>
            </YStack>
          )}

          {labels.map((label) => (
            // A full-width band centred on the slice midpoint: the text centres
            // itself inside it, which puts its middle exactly on the midpoint
            // without having to measure the glyphs.
            <YStack
              key={label.name}
              position="absolute"
              t={label.y - LABEL_LINE_HEIGHT / 2}
              l={label.x - size / 2}
              width={size}
              items="center"
              pointerEvents="none"
            >
              <MonoText
                variant="footer"
                numberOfLines={1}
                // Chosen from the slice it sits on, not fixed to white: segment
                // fills are user-configurable, and a light slice in light mode
                // used to carry white text.
                color={onColorText(colorByName.get(label.name) ?? '#000000')}
                style={LABEL_TEXT_STYLE}
                testID={testID ? `${testID}-label-${label.name}` : undefined}
              >
                {label.text}
              </MonoText>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function BarChartView({ segments, options, testID }: ChartViewProps) {
  const { box, onLayout } = useMeasuredBox();
  const opts = resolveChartOptions(options);
  const width = box.width > 0 ? box.width : null;
  const height = opts.size ?? (box.height > 0 ? box.height : null);

  return (
    <YStack flex={1} gap="$1">
      {/* The testID sits on the measured element, as it does for round charts. */}
      <YStack flex={1} minH={40} onLayout={onLayout} testID={testID}>
        {width != null && height != null && (
          <Suspense fallback={null}>
            <BarCanvas segments={segments} width={width} height={height} />
          </Suspense>
        )}
      </YStack>

      {opts.withLabels && (
        <XStack flexWrap="wrap" gap={10} testID={testID ? `${testID}-legend` : undefined}>
          {segments.map((segment) => (
            <XStack key={segment.name} items="center" gap={5}>
              {/* Segment colours are arbitrary hex, which Tamagui's token-typed
                  `bg` will not take — hence the raw style. */}
              <YStack
                width={8}
                height={8}
                rounded={2}
                style={{ backgroundColor: segment.color }}
              />
              <MonoText
                variant="footer"
                color="$textTertiary"
                testID={testID ? `${testID}-label-${segment.name}` : undefined}
              >
                {segmentLabelText(segment)}
              </MonoText>
            </XStack>
          ))}
        </XStack>
      )}
    </YStack>
  );
}
