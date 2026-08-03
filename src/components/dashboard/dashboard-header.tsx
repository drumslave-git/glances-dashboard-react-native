import { Button, H1, Paragraph, XStack, YStack } from 'tamagui';

import type { GlancesServer } from '@/types/dashboard';

interface DashboardHeaderProps {
  server: GlancesServer | undefined;
  hostname?: string;
  linuxDistro?: string;
  unreachable: boolean;
  editMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  onEnterImmersive: () => void;
}

export function DashboardHeader({
  server,
  hostname,
  linuxDistro,
  unreachable,
  editMode,
  onToggleEditMode,
  onOpenSettings,
  onEnterImmersive,
}: DashboardHeaderProps) {
  const subtitle = (() => {
    if (!server) return 'No server configured';
    if (unreachable) return `Cannot reach ${server.url}`;
    if (hostname) return linuxDistro ? `${hostname} · ${linuxDistro}` : hostname;
    return server.url;
  })();

  // The reference app shows the polling cadence as a badge; the same information
  // fits beside the subtitle here. 0 means "fetch once", which has no cadence.
  const refresh =
    server && server.refreshMs > 0 ? `${Math.round(server.refreshMs / 100) / 10}s` : null;

  return (
    <YStack gap="$1">
      <XStack items="center" gap="$2">
        <H1 size="$8" flex={1} numberOfLines={1}>
          {server?.name ?? 'Glances'}
        </H1>
        <Button
          size="$3"
          theme={editMode ? 'blue' : undefined}
          onPress={onToggleEditMode}
          testID="toggle-edit-mode"
        >
          {editMode ? 'Done' : 'Edit'}
        </Button>
        <Button
          size="$3"
          onPress={onEnterImmersive}
          // `aria-label`, not `accessibilityLabel`: Tamagui forwards unknown props
          // straight to the DOM element on web, where React rejects the RN spelling.
          // React Native has understood `aria-label` since 0.71.
          aria-label="Enter immersive mode"
          testID="enter-immersive"
        >
          ⛶
        </Button>
        <Button size="$3" onPress={onOpenSettings} testID="open-settings">
          Settings
        </Button>
      </XStack>
      <XStack items="center" gap="$2">
        <Paragraph
          size="$2"
          opacity={0.7}
          flex={1}
          numberOfLines={1}
          theme={unreachable ? 'red' : undefined}
          testID="dashboard-subtitle"
        >
          {subtitle}
        </Paragraph>
        {refresh && (
          <Paragraph size="$1" opacity={0.6} testID="dashboard-refresh">
            {refresh} refresh
          </Paragraph>
        )}
      </XStack>
    </YStack>
  );
}
