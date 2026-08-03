import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import { EndpointChip } from '@/components/telemetry/chips';
import { MicroLabel, MonoText } from '@/components/telemetry/text';
import {
  GlyphButton,
  GradientSurface,
  LogoMark,
  ToolbarButton,
  Wordmark,
} from '@/components/telemetry/surfaces';
import { GEOMETRY } from '@/theme/telemetry';
import { useTelemetry } from '@/theme/use-telemetry';
import type { GlancesServer } from '@/types/dashboard';

/**
 * The dashboard toolbar.
 *
 * **It carries no live data and no animation**, which is a rule rather than an
 * omission: the toolbar hides in immersive mode, so anything that has to stay
 * continuously readable belongs in the grid. The roster chips are static
 * identity — a machine's name and colour — not telemetry, and there is no
 * pulsing connection dot here. A widget whose endpoint is unreachable says so on
 * the widget.
 *
 * Adapted from the desktop design in three ways:
 *
 * - **Two rows below ~760pt.** Row one is identity plus the two icon controls;
 *   row two is the endpoint roster, which scrolls, followed by the labelled
 *   actions. On a 393pt phone the desktop's single row overflows the screen —
 *   the action buttons simply run off the right-hand edge.
 * - **No window controls.** ⤢ — ▢ ✕ belong to a frameless desktop window;
 *   Android has none and the Tauri build keeps its native title bar.
 * - **The separate ENDPOINTS button is folded into the gear**, because this app
 *   has a single settings screen that already contains the endpoint list.
 */

/** Below this the toolbar splits into two rows. */
const WIDE_TOOLBAR = 760;
/** Below this the wordmark drops its second word. */
const COMPACT_WORDMARK = 520;

interface ToolbarProps {
  servers: GlancesServer[];
  editMode: boolean;
  /** Polling cadence of the default server, e.g. `5s`. */
  refreshLabel?: string | null;
  onAddWidget: () => void;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  onEnterImmersive: () => void;
}

export function Toolbar({
  servers,
  editMode,
  refreshLabel,
  onAddWidget,
  onToggleEditMode,
  onOpenSettings,
  onEnterImmersive,
}: ToolbarProps) {
  const { t } = useTelemetry();
  const [width, setWidth] = useState(0);
  const wide = width === 0 || width >= WIDE_TOOLBAR;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (current === next ? current : next));
  };

  const roster = <EndpointRoster servers={servers} />;

  // Labels shorten before anything is dropped: a narrow toolbar loses words, not
  // controls, because every one of these is the only route to what it does.
  const labelledActions = (
    <XStack items="center" gap={8} shrink={0}>
      <ToolbarButton
        label={wide ? 'Add widget' : 'Add'}
        glyph="+"
        variant="primary"
        onPress={onAddWidget}
        testID="toolbar-add-widget"
      />
      <ToolbarButton
        label={wide ? 'Edit layout' : 'Edit'}
        active={editMode}
        onPress={onToggleEditMode}
        testID="toolbar-edit-layout"
      />
    </XStack>
  );

  const glyphActions = (
    <XStack items="center" gap={4} shrink={0}>
      <GlyphButton
        glyph="⛶"
        label="Enter immersive mode"
        onPress={onEnterImmersive}
        color={t.text.secondary}
        testID="toolbar-immersive"
      />
      <GlyphButton
        glyph="⚙"
        label="Endpoints and settings"
        onPress={onOpenSettings}
        color={t.text.secondary}
        testID="toolbar-settings"
      />
    </XStack>
  );

  return (
    <GradientSurface
      colors={t.bg.chrome}
      borderBottomWidth={1}
      borderColor="$chromeBorder"
      onLayout={onLayout}
      testID="dashboard-toolbar"
    >
      <XStack
        items="center"
        gap={14}
        px={GEOMETRY.toolbarPaddingX}
        py={9}
        minH={wide ? GEOMETRY.toolbarHeight : undefined}
      >
        <XStack items="center" gap={10} shrink={0}>
          <LogoMark testID="toolbar-logo" />
          <Wordmark compact={width > 0 && width < COMPACT_WORDMARK} />
        </XStack>

        {wide ? (
          <XStack
            items="center"
            gap={10}
            pl={14}
            borderLeftWidth={1}
            borderColor="$chromeBorder"
            flex={1}
            shrink={1}
          >
            {roster}
          </XStack>
        ) : (
          <YStack flex={1} />
        )}

        {refreshLabel != null && wide && (
          <MonoText variant="footer" color="$textDim" testID="toolbar-refresh">
            {refreshLabel}
          </MonoText>
        )}

        {wide && labelledActions}
        {glyphActions}
      </XStack>

      {!wide && (
        <XStack
          items="center"
          gap={10}
          px={GEOMETRY.toolbarPaddingX}
          pb={10}
          borderTopWidth={1}
          borderColor="$chromeBorder"
          pt={9}
        >
          {roster}
          {labelledActions}
        </XStack>
      )}
    </GradientSurface>
  );
}

function EndpointRoster({ servers }: { servers: GlancesServer[] }) {
  if (servers.length === 0) {
    return (
      <MicroLabel testID="toolbar-roster-empty" color="$textFaint">
        No endpoints
      </MicroLabel>
    );
  }

  return (
    <XStack items="center" gap={10} flex={1} shrink={1}>
      <MicroLabel>Endpoints</MicroLabel>
      {/* Horizontal, because a phone with four machines would otherwise wrap the
          roster into a second line and push the grid down. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        flex={1}
        testID="toolbar-roster"
      >
        <XStack items="center" gap={7}>
          {servers.map((server) => (
            <EndpointChip
              key={server.id}
              name={server.name}
              accentIndex={server.accentIndex}
              testID={`toolbar-endpoint-${server.id}`}
            />
          ))}
        </XStack>
      </ScrollView>
    </XStack>
  );
}
