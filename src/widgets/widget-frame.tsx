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
import { Platform, Pressable, type LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AccentTick, EndpointChip } from '@/components/telemetry/chips';
import { GlyphButton, GradientSurface } from '@/components/telemetry/surfaces';
import { Label, UiText } from '@/components/telemetry/text';
import { useEndpointStatus } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { GEOMETRY } from '@/theme/telemetry';
import {
  DEFAULT_APPEARANCE,
  colorFor,
  parseWidgetAppearance,
  widgetSurface,
} from '@/theme/appearance';
import { useAppearance, useTelemetry } from '@/theme/use-telemetry';
import type { WidgetInstance } from '@/types/dashboard';
import { endpointIsStale, endpointOverlay } from '@/utils/endpointStatus';
import { headerRung, sizeModeFor } from '@/utils/typeScale';
import {
  FOOTPRINTS,
  FOOTPRINT_LABELS,
  footprintSize,
  isWidgetType,
  parseWidgetConfig,
  widgetDefinition,
  type Footprint,
} from '@/widgets/catalog';
import { widgetRenderer } from '@/widgets/registry';

import { WidgetErrorBoundary } from './widget-error-boundary';
import { WidgetMenu, type WidgetMenuItem } from '@/components/dashboard/widget-menu';

/** Header and padding, subtracted from the card to size the body. */
const HEADER_HEIGHT = 26;

/** How far a headerless body steps aside for the corner mark: the tick, plus the header's gap. */
const CORNER_MARK_INSET = 9;

/** What a card is assumed to be before it has been measured — one column at ordinary stretch. */
const UNMEASURED_BOX = { width: 360, height: 180 };

export interface WidgetFrameProps {
  widget: WidgetInstance;
  editMode: boolean;
  /** Which of the three footprints this card currently matches, if any. */
  footprint: Footprint | null;
  onEdit: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  /** Resize to a named footprint — the corner grip's edit, for anyone who has no grip. */
  onFootprint: (widgetId: string, footprint: Footprint) => void;
}

function WidgetFrameInner({
  widget,
  editMode,
  footprint,
  onEdit,
  onRemove,
  onFootprint,
}: WidgetFrameProps) {
  const { t, mode: themeMode, accentFor } = useTelemetry();
  const appearance = useAppearance();
  const endpoint = useEndpointsStore((state) => selectEndpointById(state, widget.endpointId));
  const status = useEndpointStatus(widget.endpointId);
  const endpointState = useEndpointState(endpoint);

  const [menuOpen, setMenuOpen] = useState(false);
  // Two ways back to a hidden header, because two kinds of machine run this: a pointer over the
  // panel, and a press on the corner mark that replaces the header.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
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

  /**
   * The design's panel padding is asymmetric — more at the top than the bottom, more at the sides
   * than either. The appearance offers **one** number, so the user's value scales the four rather
   * than flattening them: at the default this is the handoff's panel to the point, and at any other
   * value it is the same panel, differently spaced.
   */
  const padScale = appearance.widgetPadding / DEFAULT_APPEARANCE.widgetPadding;
  const padding = {
    top: Math.round(GEOMETRY.widgetPadding.top * padScale),
    right: Math.round(GEOMETRY.widgetPadding.right * padScale),
    bottom: Math.round(GEOMETRY.widgetPadding.bottom * padScale),
    left: Math.round(GEOMETRY.widgetPadding.left * padScale),
  };

  // Edit mode ignores hidden headers: the header is what a widget is configured and sized by, and
  // a board you cannot edit because you hid the controls is not a preference, it is a trap.
  const headerShown = !appearance.hideWidgetHeaders || editMode || hovered || pinned;

  const bodyHeight = Math.max(
    0,
    box.height - padding.top - padding.bottom - (headerShown ? HEADER_HEIGHT : 0),
  );

  // The footprints are here on every platform, not only where there is no corner grip: a grip is a
  // mouse gesture even on a desktop window, and "make this one two columns wide" should not require
  // aiming at 10 points of hairline.
  const sizeItems: WidgetMenuItem[] = definition
    ? FOOTPRINTS.map((entry) => {
        const size = footprintSize(definition.type, entry);
        return {
          key: `size-${entry}`,
          label: FOOTPRINT_LABELS[entry],
          value: entry === footprint ? 'Current' : `${size.w}×${size.h}`,
          disabled: entry === footprint,
          onPress: () => onFootprint(widget.id, entry),
        };
      })
    : [];

  const menuItems: WidgetMenuItem[] = [
    { key: 'edit', label: 'Edit widget', onPress: () => onEdit(widget.id) },
    ...sizeItems,
    { key: 'remove', label: 'Remove widget', destructive: true, onPress: () => onRemove(widget.id) },
  ];

  const hoverProps: Record<string, unknown> =
    Platform.OS === 'web' && appearance.hideWidgetHeaders
      ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
      : {};

  const overlay = widget.endpointId ? endpointOverlay(endpointState) : null;
  const stale = widget.endpointId ? endpointIsStale(endpointState) : false;

  return (
    <GradientSurface
      // One widget may override the background; everything else is the board's own appearance.
      colors={widgetSurface(appearance, themeMode, parseWidgetAppearance(widget.appearance).background)}
      rounded={appearance.widgetRadius}
      borderWidth={appearance.widgetBorder.width}
      flex={1}
      minH={0}
      pt={padding.top}
      pb={padding.bottom}
      pr={padding.right}
      pl={padding.left}
      onLayout={onLayout}
      // Hover is the pointer's way back to a hidden header. Spread rather than passed, because
      // Tamagui types the mouse handlers as web-only and the native build must not see them.
      {...hoverProps}
      // An arbitrary colour cannot go through Tamagui's `borderColor` token prop.
      style={{
        borderColor: editMode
          ? t.border.widgetRaised
          : colorFor(appearance.widgetBorder.color, themeMode),
      }}
      testID={`widget-${widget.id}`}
    >
      {!headerShown && (
        // The corner mark: what keeps a headerless panel identifiable, and the touch route back to
        // the header — the same mark in the same place, so there is one thing to learn.
        //
        // A `Pressable`, not a Tamagui stack with `onPress`: a plain stack does not reliably take a
        // press on web, which is the platform where this mark is most likely to be aimed at.
        <Pressable
          onPress={() => setPinned(true)}
          aria-label={`Show header for ${title}`}
          style={{ position: 'absolute', top: padding.top, left: padding.left, zIndex: 1, cursor: 'pointer' }}
          testID={`widget-corner-${widget.id}`}
        >
          <AccentTick color={endpoint?.color ?? null} state={endpointState} />
        </Pressable>
      )}

      {headerShown && (
      <XStack items="center" gap={9} height={HEADER_HEIGHT} flexWrap="nowrap">
        {/* The same mark, still doing the same thing: pressing it puts the header away again. */}
        <Pressable
          onPress={appearance.hideWidgetHeaders && !editMode ? () => setPinned(false) : undefined}
          disabled={!appearance.hideWidgetHeaders || editMode}
          style={appearance.hideWidgetHeaders && !editMode ? { cursor: 'pointer' } : undefined}
          aria-label={
            appearance.hideWidgetHeaders && !editMode ? `Hide header for ${title}` : undefined
          }
        >
          <AccentTick
            color={endpoint?.color ?? null}
            state={endpointState}
            testID={`widget-accent-${widget.id}`}
          />
        </Pressable>
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
      )}

      {/* The corner mark sits in the panel's corner, which is where the body's first line starts —
          so a headerless body is nudged clear of it rather than printed under it. */}
      <YStack flex={1} minH={0} pl={headerShown ? 0 : CORNER_MARK_INSET} opacity={stale ? 0.55 : 1}>
        <WidgetBody
          // Re-binding a widget to another host **remounts the body** (ref §7.1). A chart holds a
          // series it has been accumulating from one endpoint's buffer; without this it would keep
          // drawing the old host's history under the new host's name, and the two would interleave
          // as the new samples arrived.
          key={widget.endpointId ?? 'global'}
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

  if (!isWidgetType(widget.type)) {
    // A row of a type this build does not have — a downgrade, or a widget removed from the
    // catalog. Saying so beats an empty panel that looks like a rendering fault.
    return (
      <UiText variant="metric" color="$textDim" testID={`widget-status-${widget.id}`}>
        Unknown widget type “{widget.type}”.
      </UiText>
    );
  }

  const definition = widgetDefinition(widget.type);
  // A **global** widget reads from every endpoint, so having no `endpointId` is its normal state
  // rather than a misconfiguration. Asked of the catalog rather than hardcoded against a type
  // name, so the next cross-endpoint widget needs no change here.
  if (!widget.endpointId && definition.scope !== 'global') {
    return (
      <UiText variant="metric" color="$textDim" testID={`widget-status-${widget.id}`}>
        Pick an endpoint for this widget.
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
