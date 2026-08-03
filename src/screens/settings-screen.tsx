import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H2, Paragraph, ScrollView, Separator, SizableText, XStack, YStack } from 'tamagui';

import { useServersStore } from '@/state/servers';
import { useWidgetsStore } from '@/state/widgets';
import type { GlancesServer } from '@/types/dashboard';

function describeRefresh(refreshMs: number): string {
  if (refreshMs === 0) return 'no auto-refresh';
  if (refreshMs % 1000 === 0) return `every ${refreshMs / 1000}s`;
  return `every ${refreshMs}ms`;
}

interface ServerRowProps {
  server: GlancesServer;
  isDefault: boolean;
  widgetCount: number;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}

function ServerRow({
  server,
  isDefault,
  widgetCount,
  onEdit,
  onMakeDefault,
  onDelete,
}: ServerRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <YStack gap="$2" py="$3" testID={`server-row-${server.id}`}>
      <XStack items="center" gap="$2">
        <SizableText size="$6" flex={1} numberOfLines={1}>
          {server.name}
        </SizableText>
        {isDefault && (
          <SizableText size="$1" opacity={0.7} testID={`server-default-${server.id}`}>
            DEFAULT
          </SizableText>
        )}
      </XStack>

      <Paragraph size="$2" opacity={0.7} numberOfLines={1}>
        {server.url}
      </Paragraph>
      <Paragraph size="$2" opacity={0.5}>
        {describeRefresh(server.refreshMs)}
        {widgetCount > 0 ? ` · ${widgetCount} widget${widgetCount === 1 ? '' : 's'}` : ''}
      </Paragraph>

      {confirming ? (
        <YStack gap="$2">
          <Paragraph size="$2">
            {widgetCount > 0
              ? `Delete this server and its ${widgetCount} widget${widgetCount === 1 ? '' : 's'}?`
              : 'Delete this server?'}
          </Paragraph>
          <XStack gap="$2">
            <Button
              size="$3"
              theme="red"
              onPress={onDelete}
              testID={`server-confirm-delete-${server.id}`}
            >
              Delete
            </Button>
            <Button size="$3" onPress={() => setConfirming(false)}>
              Cancel
            </Button>
          </XStack>
        </YStack>
      ) : (
        <XStack gap="$2" flexWrap="wrap">
          <Button size="$3" onPress={onEdit} testID={`server-edit-${server.id}`}>
            Edit
          </Button>
          {!isDefault && (
            <Button size="$3" onPress={onMakeDefault} testID={`server-make-default-${server.id}`}>
              Make default
            </Button>
          )}
          <Button
            size="$3"
            theme="red"
            onPress={() => setConfirming(true)}
            testID={`server-delete-${server.id}`}
          >
            Remove
          </Button>
        </XStack>
      )}
    </YStack>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const servers = useServersStore((state) => state.servers);
  const defaultServerId = useServersStore((state) => state.defaultServerId);
  const setDefaultServer = useServersStore((state) => state.setDefaultServer);
  const removeServer = useServersStore((state) => state.removeServer);
  const widgets = useWidgetsStore((state) => state.widgets);
  const removeWidgetsForServer = useWidgetsStore((state) => state.removeWidgetsForServer);

  const handleDelete = (id: string) => {
    // Widgets bound to a removed server would have nothing to read from.
    removeWidgetsForServer(id);
    removeServer(id);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} p="$4" gap="$3">
        <XStack items="center" gap="$3">
          <H2 flex={1}>Servers</H2>
          <Button size="$3" onPress={() => router.back()} testID="settings-close">
            Done
          </Button>
        </XStack>

        {servers.length === 0 ? (
          <YStack flex={1} justify="center" items="center" gap="$3">
            <Paragraph text="center" opacity={0.7} testID="servers-empty">
              No servers yet. Add the address of a machine running `glances -w`.
            </Paragraph>
          </YStack>
        ) : (
          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack>
              {servers.map((server, index) => (
                <YStack key={server.id}>
                  {index > 0 && <Separator />}
                  <ServerRow
                    server={server}
                    isDefault={server.id === defaultServerId}
                    widgetCount={widgets.filter((w) => w.serverId === server.id).length}
                    onEdit={() =>
                      router.push({
                        pathname: '/settings/server/[id]',
                        params: { id: server.id },
                      })
                    }
                    onMakeDefault={() => setDefaultServer(server.id)}
                    onDelete={() => handleDelete(server.id)}
                  />
                </YStack>
              ))}
            </YStack>
          </ScrollView>
        )}

        <Button
          size="$4"
          theme="blue"
          onPress={() => router.push({ pathname: '/settings/server/[id]', params: { id: 'new' } })}
          testID="add-server"
        >
          Add server
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
