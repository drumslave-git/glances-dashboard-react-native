import { Suspense, useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Paragraph, SizableText, XStack, YStack } from 'tamagui';

import {
  donutInnerRadius,
  paddingAngleToGap,
  resolveChartOptions,
  resolveChartSize,
  segmentLabelText,
  sliceLabels,
} from '@/utils/chartGeometry';
import type { ChartSegment } from '@/utils/widgetData';
import type { DonutChartOptions } from '@/types/dashboard';

import { BarCanvas, PieCanvas } from './canvases';

export type ChartKind = 'donut' | 'pie' | 'bar';

export interface ChartViewProps {
  kind: ChartKind;
  segments: ChartSegment[];
  /** Fallback for the donut's centre label, as in the reference app. */
  metric: string;
  /** Centre label with its tokens already resolved. */
  chartLabel?: string;
  options?: DonutChartOptions;
  testID?: string;
}

/**
 * The one way charts are drawn in this app. Nothing above this component knows
 * that Victory Native and Skia exist — swapping in an SVG renderer for the web
 * would mean replacing the two canvas components beside this file and nothing else.
 */
export function ChartView(props: ChartViewProps) {
  return props.kind === 'bar' ? <BarChartView {...props} /> : <RoundChartView {...props} />;
}

/** Slice labels sit on top of coloured slices, so they carry their own contrast. */
const LABEL_TEXT_STYLE = {
  textShadowColor: 'rgba(0, 0, 0, 0.85)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 3,
} as const;

const LABEL_LINE_HEIGHT = 14;

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
  const gap = size != null ? paddingAngleToGap(opts.paddingAngle, size / 2) : 0;
  // Only the donut has a hole to write in — the reference app did the same.
  const centreLabel = kind === 'donut' ? (chartLabel ?? metric) : null;

  return (
    <YStack flex={1} items="center" justify="center" onLayout={onLayout} testID={testID}>
      {size != null && (
        // `position="relative"` is a no-op on native, where every View is already
        // a containing block — but Tamagui emits no `position` on web, so without
        // it the labels below resolve against some ancestor further out and land
        // beside the chart instead of on their slices.
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
              <SizableText
                size="$3"
                numberOfLines={1}
                style={LABEL_TEXT_STYLE}
                testID={testID ? `${testID}-centre-label` : undefined}
              >
                {centreLabel}
              </SizableText>
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
              <SizableText
                size="$1"
                numberOfLines={1}
                color="white"
                style={LABEL_TEXT_STYLE}
                testID={testID ? `${testID}-label-${label.name}` : undefined}
              >
                {label.text}
              </SizableText>
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
        <XStack flexWrap="wrap" gap="$2" testID={testID ? `${testID}-legend` : undefined}>
          {segments.map((segment) => (
            <XStack key={segment.name} items="center" gap="$1.5">
              {/* Segment colours are arbitrary hex, which Tamagui's token-typed
                  `bg` will not take — hence the raw style. */}
              <YStack
                width={8}
                height={8}
                rounded={2}
                style={{ backgroundColor: segment.color }}
              />
              <Paragraph
                size="$1"
                opacity={0.8}
                testID={testID ? `${testID}-label-${segment.name}` : undefined}
              >
                {segmentLabelText(segment)}
              </Paragraph>
            </XStack>
          ))}
        </XStack>
      )}
    </YStack>
  );
}
