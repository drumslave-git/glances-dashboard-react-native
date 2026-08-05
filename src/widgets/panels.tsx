/**
 * The two graphical panels the typed widgets share: a ring gauge and a streaming series.
 *
 * Lifted from `components/widgets/widget-content.tsx` as the generic widget model around it is
 * retired. What moved is only the *presentation* — both are driven by `FieldReading[]`, which is a
 * data shape rather than anything to do with hand-picked fields, so the typed widgets simply build
 * the readings themselves instead of a field picker doing it.
 *
 * The ladders inside them are M8's and already tested: the ring's 72pt floor below which it becomes
 * a bar, and the chart's full → grid → sparkline → pulse rungs.
 */
import { useMemo } from 'react';
import { XStack, YStack } from 'tamagui';

import { ChartView } from '@/components/charts/chart-view';
import { HeroValue, StatCluster, StatFooterLine } from '@/components/telemetry/hero';
import { Meter } from '@/components/telemetry/meter';
import { MonoText } from '@/components/telemetry/text';
import {
  recentSamples,
  seriesDomain,
  seriesStats,
  TIME_WINDOWS,
  type Sample,
  type TimeWindow,
} from '@/utils/sampleBuffer';
import { chartRung, ringDiameter, statClusterRung, type WidgetSizeClass } from '@/utils/typeScale';
import { formatStat, type FieldReading } from '@/utils/widgetPresentation';

/** The rows under a ring — the design's SWAP / CACHED lines. */
function FieldRows({ readings, height }: { readings: FieldReading[]; height: number }) {
  if (readings.length === 0) return null;
  return (
    <YStack gap={0} height={height}>
      {readings.map((reading) => (
        <XStack
          key={reading.name}
          items="center"
          justify="space-between"
          gap={10}
          py={7}
          borderTopWidth={1}
          borderColor="$hairline"
          testID={`row-${reading.name}`}
        >
          <MonoText variant="metric" color="$textSecondary" numberOfLines={1} shrink={1}>
            {reading.label}
          </MonoText>
          <MonoText variant="metric" color="$textStrong" numberOfLines={1}>
            {reading.text}
          </MonoText>
        </XStack>
      ))}
    </YStack>
  );
}

export interface RingPanelProps {
  /** The first reading is the ring; the rest become the rows beneath it. */
  readings: FieldReading[];
  width: number;
  height: number;
  accentColor: string;
  testID?: string;
}

/**
 * A ring gauge with its supporting rows.
 *
 * Below the handoff's 72pt ring floor it becomes a hero numeral over a horizontal bar, rather than
 * a ring too small to read — the last rung of the reference's ring ladder (ref §7.4).
 */
export function RingPanel({ readings, width, height, accentColor, testID }: RingPanelProps) {
  const [primary, ...others] = readings;
  if (!primary) return null;

  // The rows get the space they need and the ring keeps the rest.
  const rowsHeight = Math.min(height * 0.4, others.length * 26);
  const diameter = ringDiameter(width, height - rowsHeight);

  if (diameter == null) {
    return (
      <YStack flex={1} gap={8} justify="center" testID={testID ? `${testID}-body` : undefined}>
        <HeroValue
          value={primary.text}
          {...(primary.unit ? { unit: primary.unit } : {})}
          widgetWidth={width}
          testID={testID ? `${testID}-hero` : undefined}
        />
        <Meter
          label={primary.label}
          percent={primary.percent ?? 0}
          value={primary.text + (primary.unit ?? '')}
          rung="inline"
          color={accentColor}
          testID={testID ? `${testID}-bar` : undefined}
        />
        <FieldRows readings={others} height={rowsHeight} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} gap={8} testID={testID ? `${testID}-body` : undefined}>
      <ChartView
        kind="gauge"
        segments={[]}
        metric={primary.name}
        percent={primary.percent ?? 0}
        gaugeValue={primary.text}
        {...(primary.unit ? { gaugeUnit: primary.unit } : {})}
        gaugeCaption={primary.label}
        accentColor={accentColor}
        explicitSize={{ width: diameter, height: diameter }}
        {...(testID ? { testID: `${testID}-chart` } : {})}
      />
      <FieldRows readings={others} height={rowsHeight} />
    </YStack>
  );
}

const HERO_ROW_HEIGHT = 52;

export interface SeriesPanelProps {
  /** The first reading leads as the hero; every reading with a value gets a trace. */
  readings: FieldReading[];
  /** Sampled history, keyed by reading name. */
  series: Record<string, Sample[]>;
  width: number;
  height: number;
  sizeClass: WidgetSizeClass;
  accentColor: string;
  timeWindow: TimeWindow;
  /** Per-series colours, keyed by reading name. Falls back to the accent. */
  colors?: Record<string, string>;
  testID?: string;
}

/**
 * A hero numeral over a streaming trace.
 *
 * "A live line answers *is it moving?* but not *what is it right now?* without tracing the trace
 * back to an axis" — so every streaming widget leads with the number and two derived facts
 * (ref §7.5).
 */
export function SeriesPanel({
  readings,
  series,
  width,
  height,
  sizeClass,
  accentColor,
  timeWindow,
  colors,
  testID,
}: SeriesPanelProps) {
  const primary = readings.find((reading) => reading.value != null) ?? null;

  const layers = useMemo(
    () =>
      readings
        .filter((reading) => reading.value != null)
        .map((reading, index) => ({
          // The window is measured back from the newest sample, not the wall clock — which keeps
          // this pure and means a stalled poller shows its last window of data rather than an
          // emptying chart.
          samples: recentSamples(series[reading.name], TIME_WINDOWS[timeWindow]),
          color: colors?.[reading.name] ?? accentColor,
          // Only the first series is filled; stacked translucent areas turn to mud.
          fill: index === 0,
        })),
    [accentColor, colors, readings, series, timeWindow],
  );

  const percentage = primary?.percent != null;
  const domain = useMemo(
    () => seriesDomain(layers[0]?.samples ?? [], { percentage }),
    [layers, percentage],
  );

  const statsRung = statClusterRung(sizeClass, height);
  const chartHeight = Math.max(0, height - (primary ? HERO_ROW_HEIGHT : 0));
  // The body sits inside the card's 17pt side padding.
  const chartWidth = Math.max(0, width - 34);
  const rung = chartRung(sizeClass, chartHeight);

  const stats = useMemo(() => {
    const computed = seriesStats(layers[0]?.samples ?? []);
    if (!computed) return [];
    return [
      { label: 'Peak', value: formatStat(computed.peak, primary?.unit ?? null) },
      { label: 'Avg', value: formatStat(computed.avg, primary?.unit ?? null) },
    ];
  }, [layers, primary?.unit]);

  return (
    <YStack flex={1} gap={6} testID={testID ? `${testID}-body` : undefined}>
      {primary && (
        <XStack items="flex-end" gap={20}>
          <HeroValue
            value={primary.text}
            {...(primary.unit ? { unit: primary.unit } : {})}
            widgetWidth={width}
            testID={testID ? `${testID}-hero` : undefined}
          />
          {statsRung === 'inline' && <StatCluster stats={stats} />}
        </XStack>
      )}

      {statsRung === 'footer' && stats.length > 0 && <StatFooterLine stats={stats} />}

      <YStack flex={1} minH={0}>
        <ChartView
          kind="line"
          segments={[]}
          metric={primary?.name ?? ''}
          series={layers}
          domain={domain}
          rung={rung}
          accentColor={accentColor}
          explicitSize={{ width: chartWidth, height: chartHeight }}
          {...(testID ? { testID: `${testID}-chart` } : {})}
        />
      </YStack>
    </YStack>
  );
}

/** Build a reading without going through the generic field discovery. */
export function reading(
  name: string,
  label: string,
  value: number | null,
  options: { text?: string; unit?: string | null; percent?: number | null } = {},
): FieldReading {
  return {
    name,
    label,
    value,
    text: options.text ?? (value == null ? '—' : formatStat(value, options.unit ?? null)),
    unit: options.unit ?? null,
    percent: options.percent ?? null,
  };
}
