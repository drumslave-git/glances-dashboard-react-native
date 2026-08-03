import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, ScrollView, Separator, SizableText, XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label } from '@/components/telemetry/text';
import { GEOMETRY } from '@/theme/telemetry';

import { AccentPicker, AppearanceSection } from '@/components/settings/appearance-section';
import { AccentTick } from '@/components/telemetry/chips';
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
  onAccentChange: (accentIndex: number) => void;
}

function ServerRow({
  server,
  isDefault,
  widgetCount,
  onEdit,
  onMakeDefault,
  onDelete,
  onAccentChange,
}: ServerRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <YStack gap="$2" py="$3" testID={`server-row-${server.id}`}>
      <XStack items="center" gap="$2">
        {/* The accent tick, as it appears at the head of every widget bound to
            this endpoint. The name stays plain text — a chip here would repeat
            it in 9pt uppercase and truncate the long ones. */}
        <AccentTick accentIndex={server.accentIndex} testID={`server-accent-tick-${server.id}`} />
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

      <AccentPicker
        accentIndex={server.accentIndex}
        onChange={onAccentChange}
        testID={`server-accent-${server.id}`}
      />

      {confirming ? (
        <YStack gap="$2">
          <Paragraph size="$2">
            {widgetCount > 0
              ? `Delete this server and its ${widgetCount} widget${widgetCount === 1 ? '' : 's'}?`
              : 'Delete this server?'}
          </Paragraph>
          <XStack gap="$2">
            <ToolbarButton
              label="Delete"
              variant="primary"
              onPress={onDelete}
              testID={`server-confirm-delete-${server.id}`}
            />
            <ToolbarButton label="Cancel" onPress={() => setConfirming(false)} />
          </XStack>
        </YStack>
      ) : (
        <XStack gap="$2" flexWrap="wrap">
          <ToolbarButton label="Edit" onPress={onEdit} testID={`server-edit-${server.id}`} />
          {!isDefault && (
            <ToolbarButton
              label="Make default"
              onPress={onMakeDefault}
              testID={`server-make-default-${server.id}`}
            />
          )}
          <ToolbarButton
            label="Remove"
            onPress={() => setConfirming(true)}
            testID={`server-delete-${server.id}`}
          />
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
  const updateServer = useServersStore((state) => state.updateServer);
  const widgets = useWidgetsStore((state) => state.widgets);
  const removeWidgetsForServer = useWidgetsStore((state) => state.removeWidgetsForServer);

  const handleDelete = (id: string) => {
    // Widgets bound to a removed server would have nothing to read from.
    removeWidgetsForServer(id);
    removeServer(id);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} bg="$appBg" p={GEOMETRY.gridPadding} gap="$3">
        <XStack items="center" gap="$3">
          <Label flex={1} variant="readout">
            Endpoints
          </Label>
          <ToolbarButton label="Done" onPress={() => router.back()} testID="settings-close" />
        </XStack>

        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack gap="$3">
            <AppearanceSection />
            <Separator />

            {servers.length === 0 ? (
              <YStack py="$6" justify="center" items="center" gap="$3">
                <Paragraph text="center" opacity={0.7} testID="servers-empty">
                  No servers yet. Add the address of a machine running `glances -w`.
                </Paragraph>
              </YStack>
            ) : (
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
                      onAccentChange={(accentIndex) => updateServer(server.id, { accentIndex })}
                    />
                  </YStack>
                ))}
              </YStack>
            )}
          </YStack>
        </ScrollView>

        <ToolbarButton
          label="Add server"
          glyph="+"
          variant="primary"
          onPress={() => router.push({ pathname: '/settings/server/[id]', params: { id: 'new' } })}
          testID="add-server"
        />
      </YStack>
    </SafeAreaView>
  );
}
