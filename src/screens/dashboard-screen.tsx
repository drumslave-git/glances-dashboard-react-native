import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useMemo } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Paragraph, YStack } from 'tamagui';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { useImmersiveExit } from '@/hooks/useImmersiveMode';
import { useSystemInfo } from '@/hooks/useGlancesQuery';
import { selectServerById, useServersStore } from '@/state/servers';
import { useUiStore } from '@/state/ui';
import { selectOrderedWidgets, useWidgetsStore } from '@/state/widgets';
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

  const defaultServer = useServersStore((state) => selectServerById(state, state.defaultServerId));
  const serverCount = useServersStore((state) => state.servers.length);
  // Selecting the sorted array directly would hand useSyncExternalStore a new
  // reference on every render and loop, so sort outside the selector.
  const storedWidgets = useWidgetsStore((state) => state.widgets);
  const widgets = useMemo(() => selectOrderedWidgets({ widgets: storedWidgets }), [storedWidgets]);
  const removeWidget = useWidgetsStore((state) => state.removeWidget);
  const setWidgetSize = useWidgetsStore((state) => state.setWidgetSize);
  const reorderWidgets = useWidgetsStore((state) => state.reorderWidgets);

  const { data: system, isError } = useSystemInfo(defaultServer);
  const hostname = typeof system?.hostname === 'string' ? system.hostname : undefined;
  const distro = typeof system?.linux_distro === 'string' ? system.linux_distro : undefined;

  const handleExitImmersive = useCallback(() => exitImmersive(), [exitImmersive]);
  useImmersiveExit(immersive, handleExitImmersive);

  const handleResize = (widgetId: string) => {
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) setWidgetSize(widgetId, nextSize(widget.size));
  };

  const grid = (
    <WidgetGrid
      widgets={widgets}
      editMode={editMode}
      onEdit={(id) => router.push({ pathname: '/widget/[id]', params: { id } })}
      onRemove={removeWidget}
      onResize={handleResize}
      onReorder={reorderWidgets}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {immersive && <KeepScreenAwake />}
      <YStack flex={1} p="$3" gap="$3">
        {!immersive && (
          <DashboardHeader
            server={defaultServer}
            hostname={hostname}
            linuxDistro={distro}
            unreachable={Boolean(defaultServer) && isError}
            editMode={editMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={() => router.push('/settings')}
            onEnterImmersive={enterImmersive}
          />
        )}

        {serverCount === 0 ? (
          <YStack flex={1} justify="center" items="center" gap="$3">
            <Paragraph text="center" opacity={0.7} testID="dashboard-no-servers">
              No servers configured. Add one to start reading metrics.
            </Paragraph>
            <Button theme="blue" onPress={() => router.push('/settings')} testID="dashboard-add-server">
              Open settings
            </Button>
          </YStack>
        ) : widgets.length === 0 ? (
          <YStack flex={1} justify="center" items="center" gap="$3">
            <Paragraph text="center" opacity={0.7} testID="dashboard-no-widgets">
              No widgets yet.
            </Paragraph>
            <Button theme="blue" onPress={() => router.push('/widget/pick')} testID="dashboard-add-first-widget">
              Add a widget
            </Button>
          </YStack>
        ) : immersive ? (
          // A tap anywhere leaves immersive mode. Scrolling still works: a press
          // that turns into a drag is cancelled before onPress fires.
          <Pressable
            style={{ flex: 1 }}
            onPress={handleExitImmersive}
            accessibilityLabel="Exit immersive mode"
            testID="dashboard-immersive-exit"
          >
            {grid}
          </Pressable>
        ) : (
          grid
        )}

        {editMode && !immersive && widgets.length > 0 && (
          <Button theme="blue" onPress={() => router.push('/widget/pick')} testID="dashboard-add-widget">
            Add widget
          </Button>
        )}
      </YStack>
    </SafeAreaView>
  );
}
