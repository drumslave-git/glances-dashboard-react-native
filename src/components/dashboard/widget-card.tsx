import { memo, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AccentTick, EndpointChip, StateChip } from '@/components/telemetry/chips';
import { GlyphButton, GradientSurface } from '@/components/telemetry/surfaces';
import { Label, MonoText } from '@/components/telemetry/text';
import { WidgetContent } from '@/components/widgets/widget-content';
import { useGlancesQuery } from '@/hooks/useGlancesQuery';
import { useFieldHistory, useProcessHistory } from '@/hooks/useWidgetHistory';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import { useEndpointState } from '@/hooks/useEndpointState';
import { endpointOverlay } from '@/utils/endpointStatus';
import type { WidgetConfig } from '@/types/dashboard';
import { buildProcessTable, DEFAULT_PROCESS_SORT } from '@/utils/processTable';
import { recentSamples, seriesStats, TIME_WINDOWS } from '@/utils/sampleBuffer';
import { headerRung, sizeClassForWidth, type WidgetSizeClass } from '@/utils/typeScale';
import { resolveTitleTokens } from '@/utils/widgetData';
import { formatDeltaFromAvg, readFields } from '@/utils/widgetPresentation';
import { heightForSize } from '@/utils/widgetLayout';

import { WidgetMenu, type WidgetMenuItem } from './widget-menu';

interface WidgetCardProps {
  widget: WidgetConfig;
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onResize: (widgetId: string) => void;
  onCycleTimeWindow: (widgetId: string) => void;
  /** Step this card one position along the order. */
  onMove: (widgetId: string, offset: number) => void;
  /** Position in the grid, so the controls can disable themselves at the ends. */
  index: number;
  count: number;
}

/** Header, footer and padding, subtracted from the card to size the body. */
const HEADER_HEIGHT = 26;
const FOOTER_HEIGHT = 22;

/**
 * The Telemetry widget shell.
 *
 * The header is one row that never wraps: accent tick, label, endpoint chip,
 * state chips, and the ⋮ menu. Only the **label** may truncate — the endpoint
 * chip is `flex: none` because it is the one thing identifying which machine the
 * number came from, and the toolbar that would otherwise say so hides in
 * immersive mode.
 *
 * Everything below the header keys off the card's *measured* width. The web
 * original used container queries; a measured box is the same idea, and it is
 * what makes a widget's appearance depend on the widget rather than on the
 * window — two cards of different sizes on one screen degrade independently.
 */
function WidgetCardInner({
  widget,
  editMode,
  onEdit,
  onRemove,
  onResize,
  onCycleTimeWindow,
  onMove,
  index,
  count,
}: WidgetCardProps) {
  const { t, accentFor } = useTelemetry();
  const server = useEndpointsStore((state) => selectEndpointById(state, widget.serverId));
  const { data, isLoading, error, dataUpdatedAt } = useGlancesQuery(server, widget.endpointPath);

  const [menuOpen, setMenuOpen] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const endpointState = useEndpointState(server);
  // The *body* keeps an accent even when the endpoint has none: this colours chart lines and
  // meter fills, where the question is "what does a healthy reading look like", not "which
  // machine is this". Identity is the tick and the chip, and those do go colourless.
  const accent = accentFor(server?.color ?? 'lime');
  // Before the first layout there is nothing to classify. Assuming `regular`
  // rather than the smallest class means the header does not flash a degraded
  // rung — a bare colour dot appearing and then becoming a chip — on every mount.
  const sizeClass: WidgetSizeClass = box.width > 0 ? sizeClassForWidth(box.width) : 'regular';
  const rung = headerRung(sizeClass);

  const fields = useMemo(
    () => (widget.fields && widget.fields.length > 0 ? widget.fields : []),
    [widget.fields],
  );

  // History is only worth keeping for the kinds that draw it.
  const seriesFields = widget.kind === 'line' ? fields : [];
  const series = useFieldHistory(
    server?.id,
    widget.endpointPath,
    seriesFields,
    data,
    dataUpdatedAt,
    widget.kind === 'line',
  );

  const processRows = useMemo(
    () =>
      widget.kind === 'processes'
        ? buildProcessTable(
            data,
            fields,
            widget.fieldFormatters,
            widget.processSort ?? DEFAULT_PROCESS_SORT,
          ).rows
        : [],
    [data, fields, widget.fieldFormatters, widget.kind, widget.processSort],
  );

  const trends = useProcessHistory(
    server?.id,
    widget.endpointPath,
    processRows,
    dataUpdatedAt,
    widget.kind === 'processes',
  );

  // Titles may embed live values, e.g. "CPU {{total:round(1)}}%".
  const title = resolveTitleTokens(widget.title, data);

  /**
   * The footer is "a one-line derived readout, not a repeat of the number", so
   * it only appears where there is something derived to say — and only at the
   * `wide` rung, where the stat cluster has moved inline and left this space
   * free. Deciding that from the size class alone keeps it out of the height
   * calculation it would otherwise depend on.
   */
  const showFooter = widget.kind === 'line' && sizeClass === 'wide';

  const bodyHeight = Math.max(
    0,
    box.height -
      GEOMETRY.widgetPadding.top -
      GEOMETRY.widgetPadding.bottom -
      HEADER_HEIGHT -
      (showFooter ? FOOTER_HEIGHT : 0),
  );

  const footer = useMemo(() => {
    if (!showFooter) return null;
    const primary = readFields(data, fields).find((reading) => reading.value != null);
    if (!primary) return null;

    const stats = seriesStats(
      recentSamples(series[primary.name], TIME_WINDOWS[widget.timeWindow ?? '15m']),
    );
    // One sample is not a window to compare against.
    if (!stats || stats.count < 2) return null;
    return formatDeltaFromAvg(stats.deltaFromAvg, primary.percent != null);
  }, [data, fields, series, showFooter, widget.timeWindow]);

  const menuItems: WidgetMenuItem[] = [
    { key: 'edit', label: 'Edit widget', onPress: () => onEdit(widget.id) },
    { key: 'size', label: 'Size', value: widget.size, onPress: () => onResize(widget.id) },
    ...(widget.kind === 'line'
      ? [
          {
            key: 'window',
            label: 'Time window',
            value: widget.timeWindow ?? '15m',
            onPress: () => onCycleTimeWindow(widget.id),
          },
        ]
      : []),
    {
      key: 'move-earlier',
      label: 'Move earlier',
      disabled: index === 0,
      onPress: () => onMove(widget.id, -1),
    },
    {
      key: 'move-later',
      label: 'Move later',
      disabled: index >= count - 1,
      onPress: () => onMove(widget.id, 1),
    },
    { key: 'remove', label: 'Remove widget', destructive: true, onPress: () => onRemove(widget.id) },
  ];

  return (
    <GradientSurface
      colors={t.bg.widget}
      rounded={GEOMETRY.radius.widget}
      borderWidth={1}
      // The design's hover step, taken as a press/edit state: touch has no hover,
      // and edit mode is when a card most needs to look picked-up-able.
      borderColor={editMode ? '$borderRaised' : '$borderColor'}
      height={heightForSize(widget.size)}
      pt={GEOMETRY.widgetPadding.top}
      pr={GEOMETRY.widgetPadding.right}
      pb={GEOMETRY.widgetPadding.bottom}
      pl={GEOMETRY.widgetPadding.left}
      onLayout={onLayout}
      testID={`widget-${widget.id}`}
    >
      <XStack items="center" gap={9} height={HEADER_HEIGHT} flexWrap="nowrap">
        <AccentTick
          color={server?.color ?? null}
          state={endpointState}
          testID={`widget-accent-${widget.id}`}
        />
        <Label
          numberOfLines={1}
          shrink={1}
          minW={0}
          testID={`widget-title-${widget.id}`}
        >
          {title}
        </Label>

        {server && (
          <EndpointChip
            name={server.name}
            color={server.color}
            state={endpointState}
            variant={rung === 'dot' ? 'dot' : 'chip'}
            testID={`widget-endpoint-${widget.id}`}
          />
        )}

        {/* State chips are the first rung to go: below `wide` they live in the
            ⋮ menu, where their current value is still shown. */}
        {rung === 'full' && widget.kind === 'line' && (
          <StateChip
            label={widget.timeWindow ?? '15m'}
            accent="lime"
            onPress={() => onCycleTimeWindow(widget.id)}
            testID={`widget-window-${widget.id}`}
          />
        )}
        {rung === 'full' && widget.kind === 'processes' && (
          <StateChip
            label={`${shortSortLabel(widget.processSort ?? DEFAULT_PROCESS_SORT)} ↓`}
            accent="lime"
            testID={`widget-sort-${widget.id}`}
          />
        )}

        <YStack flex={1} />

        <GlyphButton
          glyph="⋮"
          label={`Widget menu for ${title}`}
          onPress={() => setMenuOpen(true)}
          size={26}
          testID={`widget-menu-${widget.id}`}
        />
      </XStack>

      <YStack flex={1} minH={0}>
        <WidgetContent
          kind={widget.kind}
          data={data ?? null}
          {...(box.width > 0 ? { width: box.width } : {})}
          {...(box.height > 0 ? { height: bodyHeight } : {})}
          sizeClass={sizeClass}
          accentColor={accent.stroke}
          series={series}
          trends={trends}
          config={{
            metric: widget.metric,
            ...(widget.fields ? { fields: widget.fields } : {}),
            ...(widget.fieldColors ? { fieldColors: widget.fieldColors } : {}),
            ...(widget.fieldFormatters ? { fieldFormatters: widget.fieldFormatters } : {}),
            ...(widget.donutChartOptions ? { donutChartOptions: widget.donutChartOptions } : {}),
            ...(widget.chartLabel ? { chartLabel: widget.chartLabel } : {}),
            ...(widget.splitPercentageIntoUsedFree
              ? { splitPercentageIntoUsedFree: widget.splitPercentageIntoUsedFree }
              : {}),
            ...(widget.timeWindow ? { timeWindow: widget.timeWindow } : {}),
            ...(widget.processSort ? { processSort: widget.processSort } : {}),
          }}
          noServer={!server}
          endpointMessage={endpointOverlay(endpointState)}
          loading={isLoading}
          error={error ? error.message : null}
          testID={`widget-content-${widget.id}`}
        />
      </YStack>

      {footer != null && (
        <YStack
          height={FOOTER_HEIGHT}
          justify="center"
          pt={9}
          borderTopWidth={1}
          borderColor="$hairline"
        >
          <MonoText
            variant="footer"
            color="$textTertiary"
            numberOfLines={1}
            testID={`widget-footer-${widget.id}`}
          >
            {footer}
          </MonoText>
        </YStack>
      )}

      <WidgetMenu
        open={menuOpen}
        title={title}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
        testID={`widget-menu-sheet-${widget.id}`}
      />
    </GradientSurface>
  );
}

const SORT_LABELS: Record<string, string> = {
  cpu_percent: 'CPU',
  memory_percent: 'MEM',
  name: 'NAME',
  pid: 'PID',
};

function shortSortLabel(field: string): string {
  return SORT_LABELS[field] ?? field.toUpperCase();
}

export const WidgetCard = memo(WidgetCardInner);
