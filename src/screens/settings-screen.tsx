import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, ScrollView, Separator, SizableText, XStack, YStack } from 'tamagui';

import { ToolbarButton } from '@/components/telemetry/surfaces';
import { Label } from '@/components/telemetry/text';
import { GEOMETRY, type AccentName } from '@/theme/telemetry';

import { AccentPicker, AppearanceSection } from '@/components/settings/appearance-section';
import { AccentTick } from '@/components/telemetry/chips';
import { useEndpointStatus } from '@/data/feed-store';
import { useEndpointState } from '@/hooks/useEndpointState';
import { useEndpointsStore } from '@/state/endpoints';
import { useWidgetsStore } from '@/state/widgets';
import type { GlancesEndpoint } from '@/types/dashboard';
import { endpointStateLabel } from '@/utils/endpointStatus';

/**
 * There is no "off" here any more. An interval of zero used to mean "fetch once", which was a
 * second way of saying "do not poll this" — and a worse one, because it left the endpoint looking
 * live. Pausing is now the way to stop an endpoint, and the interval is floored at a second
 * because the server caches its own stats for that long anyway.
 */
function describeRefresh(pollIntervalMs: number): string {
  if (pollIntervalMs % 1000 === 0) return `every ${pollIntervalMs / 1000}s`;
  return `every ${pollIntervalMs}ms`;
}

interface ServerRowProps {
  server: GlancesEndpoint;
  isDefault: boolean;
  widgetCount: number;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
  onAccentChange: (color: AccentName | null) => void;
  onToggleEnabled: () => void;
}

function ServerRow({
  server,
  isDefault,
  widgetCount,
  onEdit,
  onMakeDefault,
  onDelete,
  onAccentChange,
  onToggleEnabled,
}: ServerRowProps) {
  const [confirming, setConfirming] = useState(false);
  const state = useEndpointState(server);
  const status = useEndpointStatus(server.id);

  return (
    <YStack gap="$2" py="$3" testID={`server-row-${server.id}`}>
      <XStack items="center" gap="$2">
        {/* The accent tick, as it appears at the head of every widget bound to
            this endpoint. The name stays plain text — a chip here would repeat
            it in 9pt uppercase and truncate the long ones. */}
        <AccentTick
          color={server.color}
          state={state}
          testID={`server-accent-tick-${server.id}`}
        />
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

      {/* State first, because it answers the question someone opens this screen with. The version
          rides along once the probe has reported it — it is how you tell "reachable" from
          "reachable and speaking a dialect we support". */}
      <XStack items="center" gap="$2" flexWrap="wrap">
        <SizableText size="$2" testID={`server-state-${server.id}`}>
          {endpointStateLabel(state)}
        </SizableText>
        {status?.glancesVersion && (
          <Paragraph size="$2" opacity={0.6} testID={`server-version-${server.id}`}>
            Glances {status.glancesVersion}
          </Paragraph>
        )}
      </XStack>
      {status?.lastError && state !== 'disabled' && (
        <Paragraph size="$2" opacity={0.6} testID={`server-error-${server.id}`}>
          {status.lastError}
        </Paragraph>
      )}

      <Paragraph size="$2" opacity={0.5}>
        {describeRefresh(server.pollIntervalMs)}
        {widgetCount > 0 ? ` · ${widgetCount} widget${widgetCount === 1 ? '' : 's'}` : ''}
      </Paragraph>

      <AccentPicker
        color={server.color}
        onChange={onAccentChange}
        testID={`server-accent-${server.id}`}
      />

      {confirming ? (
        <YStack gap="$2">
          <Paragraph size="$2">
            {widgetCount > 0
              ? `Delete this endpoint and its ${widgetCount} widget${widgetCount === 1 ? '' : 's'}?`
              : 'Delete this endpoint?'}
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
          {/* Pausing keeps the widgets on the board and stops the polling. It is deliberately
              not a delete: the distinction between "I turned this off" and "this host is down"
              is the whole reason the state exists. */}
          <ToolbarButton
            label={server.enabled ? 'Pause' : 'Resume'}
            active={!server.enabled}
            onPress={onToggleEnabled}
            testID={`server-toggle-enabled-${server.id}`}
          />
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
  const servers = useEndpointsStore((state) => state.endpoints);
  const defaultEndpointId = useEndpointsStore((state) => state.defaultEndpointId);
  const setDefaultEndpoint = useEndpointsStore((state) => state.setDefaultEndpoint);
  const removeEndpoint = useEndpointsStore((state) => state.removeEndpoint);
  const updateEndpoint = useEndpointsStore((state) => state.updateEndpoint);
  const setEnabled = useEndpointsStore((state) => state.setEnabled);
  const widgets = useWidgetsStore((state) => state.widgets);
  const removeWidgetsForServer = useWidgetsStore((state) => state.removeWidgetsForServer);

  const handleDelete = (id: string) => {
    // Widgets bound to a removed server would have nothing to read from.
    removeWidgetsForServer(id);
    removeEndpoint(id);
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
                <Paragraph text="center" opacity={0.7} testID="endpoints-empty">
                  No endpoints yet. Add the address of a machine running `glances -w`.
                </Paragraph>
              </YStack>
            ) : (
              <YStack>
                {servers.map((server, index) => (
                  <YStack key={server.id}>
                    {index > 0 && <Separator />}
                    <ServerRow
                      server={server}
                      isDefault={server.id === defaultEndpointId}
                      widgetCount={widgets.filter((w) => w.serverId === server.id).length}
                      onEdit={() =>
                        router.push({
                          pathname: '/settings/server/[id]',
                          params: { id: server.id },
                        })
                      }
                      onMakeDefault={() => setDefaultEndpoint(server.id)}
                      onDelete={() => handleDelete(server.id)}
                      onAccentChange={(color) => updateEndpoint(server.id, { color })}
                      onToggleEnabled={() => setEnabled(server.id, !server.enabled)}
                    />
                  </YStack>
                ))}
              </YStack>
            )}
          </YStack>
        </ScrollView>

        <ToolbarButton
          label="Add endpoint"
          glyph="+"
          variant="primary"
          onPress={() => router.push({ pathname: '/settings/server/[id]', params: { id: 'new' } })}
          testID="add-server"
        />
      </YStack>
    </SafeAreaView>
  );
}
