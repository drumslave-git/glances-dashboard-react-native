import { Platform } from 'react-native';
import { Paragraph, ScrollView, Text } from 'tamagui';

import { ChartView, type ChartKind } from '@/components/charts/chart-view';
import type { DonutChartOptions, WidgetKind } from '@/types/dashboard';
import { getChartData, getTextBody, resolveTitleTokens } from '@/utils/widgetData';

export interface WidgetContentConfig {
  metric: string;
  fields?: string[];
  fieldColors?: Record<string, string>;
  fieldFormatters?: Record<string, string>;
  donutChartOptions?: DonutChartOptions;
  chartLabel?: string;
  splitPercentageIntoUsedFree?: boolean;
}

export interface WidgetContentProps {
  kind: WidgetKind;
  data: unknown;
  config: WidgetContentConfig;
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
  return kind === 'donut' || kind === 'pie' || kind === 'bar';
}

/** The process table lands in M4; until then it says so plainly. */
const NOT_YET_IMPLEMENTED: Partial<Record<WidgetKind, string>> = {
  processes: 'The process table arrives in milestone M4.',
};

export function WidgetContent({
  kind,
  data,
  config,
  noServer = false,
  loading = false,
  error = null,
  testID,
}: WidgetContentProps) {
  const statusMessage = getStatusMessage({ noServer, loading, error, data });
  const fields = config.fields && config.fields.length > 0 ? config.fields : [];

  if (statusMessage) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-status` : undefined}>
        {statusMessage}
      </Paragraph>
    );
  }

  const pending = NOT_YET_IMPLEMENTED[kind];
  if (pending) {
    return (
      <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-pending` : undefined}>
        {pending}
      </Paragraph>
    );
  }

  if (isChartKind(kind)) {
    const segments = getChartData(
      data,
      fields,
      config.fieldColors,
      config.splitPercentageIntoUsedFree,
      config.fieldFormatters,
    );

    if (segments.length === 0) {
      return (
        <Paragraph size="$2" opacity={0.6} testID={testID ? `${testID}-status` : undefined}>
          No numeric fields to display.
        </Paragraph>
      );
    }

    return (
      <ChartView
        kind={kind}
        segments={segments}
        metric={config.metric}
        {...(config.chartLabel
          ? { chartLabel: resolveTitleTokens(config.chartLabel, data) }
          : {})}
        {...(config.donutChartOptions ? { options: config.donutChartOptions } : {})}
        {...(testID ? { testID: `${testID}-chart` } : {})}
      />
    );
  }

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <Text
        // The Tamagui config ships only body and heading fonts, but `key = value`
        // dumps need a monospace face to line up, so this one comes from the platform.
        style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}
        fontSize={12}
        lineHeight={18}
        testID={testID ? `${testID}-body` : undefined}
      >
        {getTextBody(data, fields, config.fieldFormatters)}
      </Text>
    </ScrollView>
  );
}
