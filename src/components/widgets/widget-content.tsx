import { useMemo } from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';

import { ChartView, type ChartKind } from '@/components/charts/chart-view';
import { useTelemetry } from '@/theme/use-telemetry';
import { HeroValue, StatCluster, StatFooterLine, type StatBlock } from '@/components/telemetry/hero';
import { Meter } from '@/components/telemetry/meter';
import { MonoText, UiText } from '@/components/telemetry/text';
import { ProcessesTable } from '@/components/widgets/processes-table';
import type { DonutChartOptions, WidgetKind } from '@/types/dashboard';
import {
  recentSamples,
  seriesDomain,
  seriesStats,
  TIME_WINDOWS,
  type Sample,
  type TimeWindow,
} from '@/utils/sampleBuffer';
import {
  chartRung,
  meterRung,
  ringDiameter,
  sizeClassForWidth,
  statClusterRung,
  type WidgetSizeClass,
} from '@/utils/typeScale';
import { getChartData, getTextBody, resolveTitleTokens } from '@/utils/widgetData';
import {
  formatStat,
  gaugeReading,
  heroReading,
  readFields,
  type FieldReading,
} from '@/utils/widgetPresentation';

export interface WidgetContentConfig {
  metric: string;
  fields?: string[];
  fieldColors?: Record<string, string>;
  fieldFormatters?: Record<string, string>;
  donutChartOptions?: DonutChartOptions;
  chartLabel?: string;
  splitPercentageIntoUsedFree?: boolean;
  timeWindow?: TimeWindow;
  processSort?: string;
}

export interface WidgetContentProps {
  kind: WidgetKind;
  data: unknown;
  config: WidgetContentConfig;
  /**
   * Measured widget box — the display channel and every degrade ladder key off
   * this. Optional so a preview pane (the config screen) can render a body
   * without measuring; `WidgetCard` always passes real numbers.
   */
  width?: number;
  /** Height available for the body, after the header and footer. */
  height?: number;
  /** Defaults to whatever `width` implies. */
  sizeClass?: WidgetSizeClass;
  /** The endpoint's colour, used for lines, arcs and meter fills. Defaults to lime. */
  accentColor?: string;
  /** Sample history for the selected fields, keyed by field name. */
  series?: Record<string, Sample[]>;
  /** Per-process CPU history, keyed by pid. */
  trends?: Record<string, Sample[]>;
  /** No server is configured for this widget at all. */
  noServer?: boolean;
  loading?: boolean;
  error?: string | null;
  testID?: string;
}

/**
 * Which message replaces the body, if any. Ported from the reference app so the
 * precedence (no server → loading → error → no data) stays identical.
 */
export function getStatusMessage({
  noServer,
  loading,
  error,
  data,
}: {
  noServer?: boolean;
  loading?: boolean;
  error?: string | null;
  data: unknown;
}): string | null {
  if (noServer) return 'Pick a server for this widget.';
  if (loading && data == null) return 'Loading…';
  if (error) return `Error: ${error}`;
  if (data == null) return 'No data yet.';
  return null;
}

export function isChartKind(kind: WidgetKind): kind is ChartKind {
  return kind === 'donut' || kind === 'pie' || kind === 'bar' || kind === 'gauge' || kind === 'line';
}

/** The stat blocks and footer line a widget derives from its own data. */
export interface WidgetDerived {
  stats: StatBlock[];
  footer: string | null;
}

/** A regular-class card, for callers that render a body without measuring one. */
const PREVIEW_BOX = { width: 360, height: 180 };

/** Stable identity, so "no fields selected" is not a new array every render. */
const EMPTY_FIELDS: string[] = [];

export function WidgetContent({
  kind,
  data,
  config,
  width = PREVIEW_BOX.width,
  height = PREVIEW_BOX.height,
  sizeClass,
  accentColor,
  series,
  trends,
  noServer = false,
  loading = false,
  error = null,
  testID,
}: WidgetContentProps) {
  const { mode, accent } = useTelemetry();
  const resolvedAccent = accentColor ?? accent('lime').stroke;
  const resolvedSizeClass = sizeClass ?? sizeClassForWidth(width);
  const statusMessage = getStatusMessage({ noServer, loading, error, data });
  // Memoised because it is a dependency below: a fresh `[]` every render would
  // recompute the readings on every poll of every other widget on the board.
  const fields = useMemo(
    () => (config.fields && config.fields.length > 0 ? config.fields : EMPTY_FIELDS),
    [config.fields],
  );

  const readings = useMemo(
    () => (statusMessage ? [] : readFields(data, fields, config.fieldFormatters)),
    [config.fieldFormatters, data, fields, statusMessage],
  );

  if (statusMessage) {
    return (
      <YStack flex={1} justify="center" testID={testID ? `${testID}-status` : undefined}>
        <UiText variant="metric" color="$textDim">
          {statusMessage}
        </UiText>
      </YStack>
    );
  }

  if (kind === 'processes') {
    return (
      <ProcessesTable
        data={data}
        fields={fields}
        width={width}
        height={height}
        accentColor={resolvedAccent}
        {...(config.fieldFormatters ? { fieldFormatters: config.fieldFormatters } : {})}
        {...(config.processSort ? { sortKey: config.processSort } : {})}
        {...(trends ? { trends } : {})}
        {...(testID ? { testID: `${testID}-processes` } : {})}
      />
    );
  }

  if (kind === 'line') {
    return (
      <LineBody
        readings={readings}
        series={series ?? {}}
        width={width}
        height={height}
        sizeClass={resolvedSizeClass}
        accentColor={resolvedAccent}
        timeWindow={config.timeWindow ?? '15m'}
        {...(testID ? { testID } : {})}
      />
    );
  }

  if (kind === 'gauge') {
    return (
      <GaugeBody
        readings={readings}
        width={width}
        height={height}
        accentColor={resolvedAccent}
        {...(testID ? { testID } : {})}
      />
    );
  }

  if (isChartKind(kind)) {
    const segments = getChartData(
      data,
      fields,
      mode,
      config.fieldColors,
      config.splitPercentageIntoUsedFree,
      config.fieldFormatters,
    );

    if (segments.length === 0) {
      return (
        <UiText variant="metric" color="$textDim" testID={testID ? `${testID}-status` : undefined}>
          No numeric fields to display.
        </UiText>
      );
    }

    return (
      <ChartView
        kind={kind}
        segments={segments}
        metric={config.metric}
        accentColor={resolvedAccent}
        {...(config.chartLabel
          ? { chartLabel: resolveTitleTokens(config.chartLabel, data) }
          : {})}
        {...(config.donutChartOptions ? { options: config.donutChartOptions } : {})}
        {...(testID ? { testID: `${testID}-chart` } : {})}
      />
    );
  }

  return (
    <SummaryBody
      readings={readings}
      data={data}
      fields={fields}
      width={width}
      height={height}
      accentColor={resolvedAccent}
      {...(config.fieldFormatters ? { fieldFormatters: config.fieldFormatters } : {})}
      {...(testID ? { testID } : {})}
    />
  );
}

/* ------------------------------------------------------------------ *
 * text → the design's "endpoint summary" archetype
 * ------------------------------------------------------------------ */

interface SummaryBodyProps {
  readings: FieldReading[];
  data: unknown;
  fields: string[];
  width: number;
  height: number;
  accentColor: string;
  fieldFormatters?: Record<string, string>;
  testID?: string;
}

/**
 * Key/value rows, with a meter wherever a field reads as a percentage and a hero
 * numeral when the widget is about a single number.
 *
 * With no fields selected there is nothing to infer from, so this falls back to
 * the reference app's raw payload dump — still useful for finding out what a
 * plugin actually returns.
 */
function SummaryBody({
  readings,
  data,
  fields,
  width,
  height,
  accentColor,
  fieldFormatters,
  testID,
}: SummaryBodyProps) {
  const hero = heroReading(readings);

  if (fields.length === 0) {
    return (
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <MonoText variant="row" color="$textTertiary" testID={testID ? `${testID}-body` : undefined}>
          {getTextBody(data, fields, fieldFormatters)}
        </MonoText>
      </ScrollView>
    );
  }

  if (hero) {
    const others = readings.filter((reading) => reading.name !== hero.name);
    return (
      <YStack flex={1} gap={10} testID={testID ? `${testID}-body` : undefined}>
        <HeroValue
          value={hero.text}
          {...(hero.unit ? { unit: hero.unit } : {})}
          widgetWidth={width}
          testID={testID ? `${testID}-hero` : undefined}
        />
        {hero.percent != null && (
          <Meter
            label={hero.label}
            percent={hero.percent}
            value={hero.text + (hero.unit ?? '')}
            rung="inline"
            color={accentColor}
          />
        )}
        <FieldRows readings={others} height={height} accentColor={accentColor} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} testID={testID ? `${testID}-body` : undefined}>
      <FieldRows readings={readings} height={height} accentColor={accentColor} />
    </YStack>
  );
}

function FieldRows({
  readings,
  height,
  accentColor,
}: {
  readings: FieldReading[];
  height: number;
  accentColor: string;
}) {
  if (readings.length === 0) return null;
  const rung = meterRung(readings.length, height);

  return (
    <YStack gap={rung === 'stacked' ? 9 : 4} flex={1}>
      {readings.map((reading) =>
        reading.percent != null ? (
          <Meter
            key={reading.name}
            label={reading.label}
            percent={reading.percent}
            value={reading.text + (reading.unit ?? '')}
            rung={rung}
            color={accentColor}
            testID={`meter-${reading.name}`}
          />
        ) : (
          <XStack
            key={reading.name}
            items="center"
            justify="space-between"
            gap={10}
            py={rung === 'stacked' ? 4 : 1}
            testID={`row-${reading.name}`}
          >
            <MonoText variant="metric" color="$textSecondary" numberOfLines={1} shrink={1}>
              {reading.label}
            </MonoText>
            <MonoText variant="metric" color="$textStrong" numberOfLines={1}>
              {reading.text}
            </MonoText>
          </XStack>
        ),
      )}
    </YStack>
  );
}

/* ------------------------------------------------------------------ *
 * gauge → the memory ring
 * ------------------------------------------------------------------ */

function GaugeBody({
  readings,
  width,
  height,
  accentColor,
  testID,
}: {
  readings: FieldReading[];
  width: number;
  height: number;
  accentColor: string;
  testID?: string;
}) {
  const primary = gaugeReading(readings);
  if (!primary || primary.value == null) {
    return (
      <UiText variant="metric" color="$textDim" testID={testID ? `${testID}-status` : undefined}>
        No numeric field to gauge.
      </UiText>
    );
  }

  const others = readings.filter((reading) => reading.name !== primary.name);
  // The rows below the ring are the design's SWAP / CACHED lines; they get the
  // space they need and the ring keeps the rest.
  const rowsHeight = Math.min(height * 0.4, others.length * 26);
  const diameter = ringDiameter(width, height - rowsHeight);

  // The handoff's ring floor is 72pt: below that it becomes a horizontal bar
  // rather than an illegible ring.
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
        <FieldRows readings={others} height={rowsHeight} accentColor={accentColor} />
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
      {others.length > 0 && (
        <YStack gap={0} height={rowsHeight}>
          {others.map((reading) => (
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
      )}
    </YStack>
  );
}

/* ------------------------------------------------------------------ *
 * line → the CPU / network time series
 * ------------------------------------------------------------------ */

interface LineBodyProps {
  readings: FieldReading[];
  series: Record<string, Sample[]>;
  width: number;
  height: number;
  sizeClass: WidgetSizeClass;
  accentColor: string;
  timeWindow: TimeWindow;
  testID?: string;
}

const HERO_ROW_HEIGHT = 52;

function LineBody({
  readings,
  series,
  width,
  height,
  sizeClass,
  accentColor,
  timeWindow,
  testID,
}: LineBodyProps) {
  const primary = readings.find((reading) => reading.value != null) ?? null;

  const layers = useMemo(
    () =>
      readings
        .filter((reading) => reading.value != null)
        .map((reading, index) => ({
          // The window is measured back from the newest sample, not the wall
          // clock — which keeps this pure and means a stalled poller shows its
          // last window of data rather than an emptying chart.
          samples: recentSamples(series[reading.name], TIME_WINDOWS[timeWindow]),
          color: accentColor,
          // Only the first series is filled; stacked translucent areas turn to mud.
          fill: index === 0,
        })),
    [accentColor, readings, series, timeWindow],
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
