import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { Toolbar } from '@/components/dashboard/toolbar';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { UiText } from '@/components/telemetry/text';
import {
  useBrowserFullScreen,
  useHardwareBackExit,
  usePointerReveal,
  useShortcuts,
} from '@/hooks/useFullScreen';
import { useSummarySources } from '@/hooks/useGlancesQuery';
import { usePreferencesStore } from '@/state/preferences';
import { colorFor } from '@/theme/appearance';
import { useAppearance, useTelemetry } from '@/theme/use-telemetry';
import { selectEndpointById, useEndpointsStore } from '@/state/endpoints';
import { useUiStore } from '@/state/ui';
import { selectOrderedWidgets, useWidgetsStore } from '@/state/widgets';

/** The strip a thumb reaches for when there is no pointer to put at the top edge. */
const REVEAL_STRIP_HEIGHT = 20;

/**
 * `useKeepAwake` holds the lock for as long as it is mounted, so gating the
 * whole component is what scopes the lock to full screen.
 */
function KeepScreenAwake() {
  useKeepAwake();
  return null;
}

export function DashboardScreen() {
  const router = useRouter();
  const { mode } = useTelemetry();
  const appearance = useAppearance();

  const editMode = useUiStore((state) => state.editMode);
  const toggleEditMode = useUiStore((state) => state.toggleEditMode);
  const fullScreen = useUiStore((state) => state.fullScreen);
  const toggleFullScreen = useUiStore((state) => state.toggleFullScreen);
  const exitFullScreen = useUiStore((state) => state.exitFullScreen);

  const summaryStripVisible = usePreferencesStore((state) => state.summaryStripVisible);

  const endpoints = useEndpointsStore((state) => state.endpoints);
  const defaultServer = useEndpointsStore((state) => selectEndpointById(state, state.defaultEndpointId));
  // Selecting the sorted array directly would hand useSyncExternalStore a new
  // reference on every render and loop, so sort outside the selector.
  const storedWidgets = useWidgetsStore((state) => state.widgets);
  const widgets = useMemo(() => selectOrderedWidgets({ widgets: storedWidgets }), [storedWidgets]);
  const removeWidget = useWidgetsStore((state) => state.removeWidget);
  const applyLayout = useWidgetsStore((state) => state.applyLayout);

  // Full screen hides the strip along with the toolbar: it is chrome, and the requests behind it
  // stop with it.
  const showStrip = summaryStripVisible && !fullScreen && endpoints.length > 0;
  const summary = useSummarySources(defaultServer, showStrip);

  const handleExitFullScreen = useCallback(() => exitFullScreen(), [exitFullScreen]);
  const handleToggleFullScreen = useCallback(() => toggleFullScreen(), [toggleFullScreen]);
  const openPicker = useCallback(() => router.push('/widget/pick'), [router]);
  const openSettings = useCallback(() => router.push('/settings'), [router]);

  useHardwareBackExit(fullScreen, handleExitFullScreen);
  useBrowserFullScreen(fullScreen, handleExitFullScreen);
  useShortcuts({
    onAddWidget: openPicker,
    onToggleEditMode: toggleEditMode,
    onToggleFullScreen: handleToggleFullScreen,
    onOpenSettings: openSettings,
    onEscape: handleExitFullScreen,
  });
  const pointerReveal = usePointerReveal(fullScreen);

  const refreshLabel =
    defaultServer && defaultServer.pollIntervalMs > 0
      ? `${Math.round(defaultServer.pollIntervalMs / 100) / 10}s refresh`
      : null;

  const toolbar = (
    <Toolbar
      endpoints={endpoints}
      editMode={editMode}
      refreshLabel={refreshLabel}
      fullScreen={fullScreen}
      onAddWidget={openPicker}
      onToggleEditMode={toggleEditMode}
      onOpenSettings={openSettings}
      onToggleFullScreen={handleToggleFullScreen}
    />
  );

  return (
    // `bg.app` sits behind the grid; the toolbar and strip paint their own
    // surfaces over it, edge to edge, as they do in the design.
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {fullScreen && <KeepScreenAwake />}
      {/* The grid background is the user's, and it is the one surface the desktop window can be
          seen through — so it goes through `style`, where an alpha survives. */}
      <YStack
        flex={1}
        position="relative"
        style={{ zIndex: 0, backgroundColor: colorFor(appearance.gridBackground, mode) }}
      >
        {/* Out of the flow in full screen, never out of the tree: re-parenting the grid would
            remount every widget and re-measure the board, which is a blank frame and a lost
            second of history each way. */}
        {!fullScreen && toolbar}

        {showStrip && <SummaryStrip {...summary} testID="dashboard-summary" />}

        {endpoints.length === 0 ? (
          <EmptyState
            message="No endpoints configured. Add one to start reading metrics."
            action="Add an endpoint"
            onPress={openSettings}
            testID="dashboard-no-endpoints"
            actionTestID="dashboard-add-server"
          />
        ) : widgets.length === 0 ? (
          <EmptyState
            message="No widgets yet."
            action="Add a widget"
            onPress={openPicker}
            testID="dashboard-no-widgets"
            actionTestID="dashboard-add-first-widget"
          />
        ) : (
          <WidgetGrid
            widgets={widgets}
            editMode={editMode}
            onEdit={(id) => router.push({ pathname: '/widget/[id]', params: { id } })}
            onRemove={removeWidget}
            onLayoutChange={applyLayout}
          />
        )}

        {fullScreen && (
          <FullScreenBar revealed={pointerReveal} onToggle={handleToggleFullScreen}>
            {toolbar}
          </FullScreenBar>
        )}
      </YStack>
    </SafeAreaView>
  );
}

/**
 * The auto-hiding bar (ref §7.1).
 *
 * Two ways back to it, because two kinds of machine run this: a pointer at the very top edge, and —
 * where there is no pointer — a strip to tap. The strip is deliberately unpainted: it is a target,
 * not a control, and a visible sliver of chrome would defeat the point of hiding the chrome.
 */
function FullScreenBar({
  revealed,
  onToggle,
  children,
}: {
  revealed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <YStack position="absolute" t={0} l={0} r={0} style={{ zIndex: 20 }}>
      {revealed ? (
        children
      ) : (
        <YStack
          height={REVEAL_STRIP_HEIGHT}
          onPress={onToggle}
          role="button"
          aria-label="Leave full screen"
          testID="dashboard-reveal-bar"
        />
      )}
    </YStack>
  );
}

function EmptyState({
  message,
  action,
  onPress,
  testID,
  actionTestID,
}: {
  message: string;
  action: string;
  onPress: () => void;
  testID: string;
  actionTestID: string;
}) {
  return (
    <YStack flex={1} justify="center" items="center" gap={16} p={24}>
      <UiText variant="readout" color="$textDim" text="center" testID={testID}>
        {message}
      </UiText>
      <ToolbarButton label={action} variant="primary" onPress={onPress} testID={actionTestID} />
    </YStack>
  );
}
