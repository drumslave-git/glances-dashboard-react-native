/**
 * The panel every widget is drawn in (ref §7.4).
 *
 * The header is one row that never wraps — accent tick, label, endpoint chip, the widget's own meta
 * chips, ⋮ menu — over a body that fills the rest. Only the **label** may truncate: the endpoint
 * chip is the one thing saying which machine a number came from, and the toolbar that would
 * otherwise say so hides in immersive mode.
 *
 * Everything below the header keys off the panel's *measured* box, not the window. Two cards of
 * different sizes on one screen therefore degrade independently, which is what the web original got
 * from container queries.
 */
import { memo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AccentTick, EndpointChip } from '@/components/telemetry/chips';
import { GlyphButton, GradientSurface } from '@/components/telemetry/surfaces';
import { Label, UiText } from '@/components/telemetry/text';
import { useEndpointStatus } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { WidgetInstance } from '@/types/dashboard';
import { endpointIsStale, endpointOverlay } from '@/utils/endpointStatus';
import { headerRung, sizeModeFor } from '@/utils/typeScale';
import { isWidgetType, parseWidgetConfig, widgetDefinition } from '@/widgets/catalog';
import { widgetRenderer } from '@/widgets/registry';

import { WidgetErrorBoundary } from './widget-error-boundary';
import { WidgetMenu, type WidgetMenuItem } from '@/components/dashboard/widget-menu';

/** Header and padding, subtracted from the card to size the body. */
const HEADER_HEIGHT = 26;

/** What a card is assumed to be before it has been measured — one column at ordinary stretch. */
const UNMEASURED_BOX = { width: 360, height: 180 };

export interface WidgetFrameProps {
  widget: WidgetInstance;
  editMode: boolean;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  /** Step this card one position along the flow. */
  onMove: (widgetId: string, offset: number) => void;
  index: number;
  count: number;
}

function WidgetFrameInner({
  widget,
  editMode,
  onEdit,
  onRemove,
  onMove,
  index,
  count,
}: WidgetFrameProps) {
  const { t, accentFor } = useTelemetry();
  const endpoint = useEndpointsStore((state) => selectEndpointById(state, widget.endpointId));
  const status = useEndpointStatus(widget.endpointId);
  const endpointState = useEndpointState(endpoint);

  const [menuOpen, setMenuOpen] = useState(false);
  // A regular-class box until the first layout lands. Starting at zero would render an empty body
  // for a frame — every ladder budgets rows and chart height from this — and an empty panel that
  // fills in a moment later is indistinguishable from one that failed. The same reason M8's
  // preview box exists.
  const [box, setBox] = useState(UNMEASURED_BOX);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const definition = isWidgetType(widget.type) ? widgetDefinition(widget.type) : null;
  const title = widget.title ?? definition?.label ?? widget.type;

  // `UNMEASURED_BOX` is regular-class, so the header does not flash a degraded rung — a bare
  // colour dot becoming a chip — on every mount.
  const mode = sizeModeFor(box.width, box.height);
  const rung = headerRung(mode.tier);

  // The body keeps an accent even when the endpoint has none: this colours traces and meter fills,
  // where the question is what a healthy reading looks like, not which machine this is.
  const accent = accentFor(endpoint?.color ?? 'lime');

  const bodyHeight = Math.max(
    0,
    box.height - GEOMETRY.widgetPadding.top - GEOMETRY.widgetPadding.bottom - HEADER_HEIGHT,
  );

  const menuItems: WidgetMenuItem[] = [
    { key: 'edit', label: 'Edit widget', onPress: () => onEdit(widget.id) },
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

  const overlay = widget.endpointId ? endpointOverlay(endpointState) : null;
  const stale = widget.endpointId ? endpointIsStale(endpointState) : false;

  return (
    <GradientSurface
      colors={t.bg.widget}
      rounded={GEOMETRY.radius.widget}
      borderWidth={1}
      borderColor={editMode ? '$borderRaised' : '$borderColor'}
      flex={1}
      minH={0}
      pt={GEOMETRY.widgetPadding.top}
      pb={GEOMETRY.widgetPadding.bottom}
      pr={GEOMETRY.widgetPadding.right}
      pl={GEOMETRY.widgetPadding.left}
      onLayout={onLayout}
      testID={`widget-${widget.id}`}
    >
      <XStack items="center" gap={9} height={HEADER_HEIGHT} flexWrap="nowrap">
        <AccentTick
          color={endpoint?.color ?? null}
          state={endpointState}
          testID={`widget-accent-${widget.id}`}
        />
        <Label numberOfLines={1} shrink={1} minW={0} testID={`widget-title-${widget.id}`}>
          {/* The metric's short name at compact, where the full label would truncate to nothing. */}
          {mode.tier === 'compact' && definition ? (definition.label ?? title) : title}
        </Label>

        {endpoint && (
          <EndpointChip
            name={endpoint.name}
            color={endpoint.color}
            state={endpointState}
            variant={rung === 'dot' ? 'dot' : 'chip'}
            testID={`widget-endpoint-${widget.id}`}
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

      <YStack flex={1} minH={0} opacity={stale ? 0.55 : 1}>
        <WidgetBody
          widget={widget}
          width={box.width}
          height={bodyHeight}
          mode={mode}
          accentColor={accent.stroke}
          overlay={overlay}
          {...(status ? { status } : {})}
        />
      </YStack>

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

function WidgetBody({
  widget,
  width,
  height,
  mode,
  accentColor,
  overlay,
  status,
}: {
  widget: WidgetInstance;
  width: number;
  height: number;
  mode: ReturnType<typeof sizeModeFor>;
  accentColor: string;
  overlay: string | null;
  status?: ReturnType<typeof useEndpointStatus>;
}) {
  if (overlay) {
    return (
      <UiText variant="metric" color="$textDim" testID={`widget-status-${widget.id}`}>
        {overlay}
      </UiText>
    );
  }

  if (!widget.endpointId && widget.type !== 'alerts') {
    return (
      <UiText variant="metric" color="$textDim" testID={`widget-status-${widget.id}`}>
        Pick an endpoint for this widget.
      </UiText>
    );
  }

  if (!isWidgetType(widget.type)) {
    // A row of a type this build does not have — a downgrade, or a widget removed from the
    // catalog. Saying so beats an empty panel that looks like a rendering fault.
    return (
      <UiText variant="metric" color="$textDim" testID={`widget-status-${widget.id}`}>
        Unknown widget type “{widget.type}”.
      </UiText>
    );
  }

  const { component: Body } = widgetRenderer(widget.type);

  return (
    <WidgetErrorBoundary widgetId={widget.id}>
      <Body
        endpointId={widget.endpointId}
        config={parseWidgetConfig(widget.type, widget.config)}
        mode={mode}
        width={width}
        height={height}
        accentColor={accentColor}
        {...(status ? { status } : {})}
        testID={`widget-content-${widget.id}`}
      />
    </WidgetErrorBoundary>
  );
}

export const WidgetFrame = memo(WidgetFrameInner);
