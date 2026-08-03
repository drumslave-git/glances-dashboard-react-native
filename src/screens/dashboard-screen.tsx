import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useMemo } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { Toolbar } from '@/components/dashboard/toolbar';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { ToolbarButton } from '@/components/telemetry/surfaces';
import { UiText } from '@/components/telemetry/text';
import { useImmersiveExit } from '@/hooks/useImmersiveMode';
import { useSummarySources } from '@/hooks/useGlancesQuery';
import { usePreferencesStore } from '@/state/preferences';
import { selectServerById, useServersStore } from '@/state/servers';
import { useUiStore } from '@/state/ui';
import { selectOrderedWidgets, useWidgetsStore } from '@/state/widgets';
import { nextTimeWindow } from '@/utils/sampleBuffer';
import { nextSize } from '@/utils/widgetLayout';

/**
 * `useKeepAwake` holds the lock for as long as it is mounted, so gating the
 * whole component is what scopes the lock to immersive mode.
 */
function KeepScreenAwake() {
  useKeepAwake();
  return null;
}

export function DashboardScreen() {
  const router = useRouter();

  const editMode = useUiStore((state) => state.editMode);
  const toggleEditMode = useUiStore((state) => state.toggleEditMode);
  const immersive = useUiStore((state) => state.immersive);
  const enterImmersive = useUiStore((state) => state.enterImmersive);
  const exitImmersive = useUiStore((state) => state.exitImmersive);

  const summaryStripVisible = usePreferencesStore((state) => state.summaryStripVisible);

  const servers = useServersStore((state) => state.servers);
  const defaultServer = useServersStore((state) => selectServerById(state, state.defaultServerId));
  // Selecting the sorted array directly would hand useSyncExternalStore a new
  // reference on every render and loop, so sort outside the selector.
  const storedWidgets = useWidgetsStore((state) => state.widgets);
  const widgets = useMemo(() => selectOrderedWidgets({ widgets: storedWidgets }), [storedWidgets]);
  const removeWidget = useWidgetsStore((state) => state.removeWidget);
  const setWidgetSize = useWidgetsStore((state) => state.setWidgetSize);
  const updateWidget = useWidgetsStore((state) => state.updateWidget);
  const reorderWidgets = useWidgetsStore((state) => state.reorderWidgets);

  // Immersive mode hides the strip along with the toolbar: it is chrome, and the
  // requests behind it stop with it.
  const showStrip = summaryStripVisible && !immersive && servers.length > 0;
  const summary = useSummarySources(defaultServer, showStrip);

  const handleExitImmersive = useCallback(() => exitImmersive(), [exitImmersive]);
  useImmersiveExit(immersive, handleExitImmersive);

  const handleResize = (widgetId: string) => {
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) setWidgetSize(widgetId, nextSize(widget.size));
  };

  const handleCycleTimeWindow = (widgetId: string) => {
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) updateWidget(widgetId, { timeWindow: nextTimeWindow(widget.timeWindow ?? '15m') });
  };

  const refreshLabel =
    defaultServer && defaultServer.refreshMs > 0
      ? `${Math.round(defaultServer.refreshMs / 100) / 10}s refresh`
      : null;

  const grid = (
    <WidgetGrid
      widgets={widgets}
      editMode={editMode}
      onEdit={(id) => router.push({ pathname: '/widget/[id]', params: { id } })}
      onRemove={removeWidget}
      onResize={handleResize}
      onCycleTimeWindow={handleCycleTimeWindow}
      onReorder={reorderWidgets}
    />
  );

  return (
    // `bg.app` sits behind the grid; the toolbar and strip paint their own
    // surfaces over it, edge to edge, as they do in the design.
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {immersive && <KeepScreenAwake />}
      <YStack flex={1} bg="$appBg">
        {!immersive && (
          <Toolbar
            servers={servers}
            editMode={editMode}
            refreshLabel={refreshLabel}
            onAddWidget={() => router.push('/widget/pick')}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={() => router.push('/settings')}
            onEnterImmersive={enterImmersive}
          />
        )}

        {showStrip && <SummaryStrip {...summary} testID="dashboard-summary" />}

        {servers.length === 0 ? (
          <EmptyState
            message="No endpoints configured. Add one to start reading metrics."
            action="Add an endpoint"
            onPress={() => router.push('/settings')}
            testID="dashboard-no-servers"
            actionTestID="dashboard-add-server"
          />
        ) : widgets.length === 0 ? (
          <EmptyState
            message="No widgets yet."
            action="Add a widget"
            onPress={() => router.push('/widget/pick')}
            testID="dashboard-no-widgets"
            actionTestID="dashboard-add-first-widget"
          />
        ) : immersive ? (
          // A tap anywhere leaves immersive mode. Scrolling still works: a press
          // that turns into a drag is cancelled before onPress fires.
          <Pressable
            style={{ flex: 1 }}
            onPress={handleExitImmersive}
            aria-label="Exit immersive mode"
            testID="dashboard-immersive-exit"
          >
            {grid}
          </Pressable>
        ) : (
          grid
        )}
      </YStack>
    </SafeAreaView>
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
