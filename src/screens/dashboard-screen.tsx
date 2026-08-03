import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Paragraph, YStack } from 'tamagui';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { useSystemInfo } from '@/hooks/useGlancesQuery';
import { selectServerById, useServersStore } from '@/state/servers';
import { selectOrderedWidgets, useWidgetsStore } from '@/state/widgets';
import { nextSize } from '@/utils/widgetLayout';

export function DashboardScreen() {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);

  const defaultServer = useServersStore((state) => selectServerById(state, state.defaultServerId));
  const serverCount = useServersStore((state) => state.servers.length);
  // Selecting the sorted array directly would hand useSyncExternalStore a new
  // reference on every render and loop, so sort outside the selector.
  const storedWidgets = useWidgetsStore((state) => state.widgets);
  const widgets = useMemo(() => selectOrderedWidgets({ widgets: storedWidgets }), [storedWidgets]);
  const removeWidget = useWidgetsStore((state) => state.removeWidget);
  const setWidgetSize = useWidgetsStore((state) => state.setWidgetSize);

  const { data: system, isError } = useSystemInfo(defaultServer);
  const hostname = typeof system?.hostname === 'string' ? system.hostname : undefined;
  const distro = typeof system?.linux_distro === 'string' ? system.linux_distro : undefined;

  const handleResize = (widgetId: string) => {
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) setWidgetSize(widgetId, nextSize(widget.size));
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} p="$3" gap="$3">
        <DashboardHeader
          server={defaultServer}
          hostname={hostname}
          linuxDistro={distro}
          unreachable={Boolean(defaultServer) && isError}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((previous) => !previous)}
          onOpenSettings={() => router.push('/settings')}
        />

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
        ) : (
          <WidgetGrid
            widgets={widgets}
            editMode={editMode}
            onEdit={(id) => router.push({ pathname: '/widget/[id]', params: { id } })}
            onRemove={removeWidget}
            onResize={handleResize}
          />
        )}

        {editMode && widgets.length > 0 && (
          <Button theme="blue" onPress={() => router.push('/widget/pick')} testID="dashboard-add-widget">
            Add widget
          </Button>
        )}
      </YStack>
    </SafeAreaView>
  );
}
