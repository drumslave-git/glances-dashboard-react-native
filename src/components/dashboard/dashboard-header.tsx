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
}

export function DashboardHeader({
  server,
  hostname,
  linuxDistro,
  unreachable,
  editMode,
  onToggleEditMode,
  onOpenSettings,
}: DashboardHeaderProps) {
  const subtitle = (() => {
    if (!server) return 'No server configured';
    if (unreachable) return `Cannot reach ${server.url}`;
    if (hostname) return linuxDistro ? `${hostname} · ${linuxDistro}` : hostname;
    return server.url;
  })();

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
        <Button size="$3" onPress={onOpenSettings} testID="open-settings">
          Settings
        </Button>
      </XStack>
      <Paragraph
        size="$2"
        opacity={0.7}
        numberOfLines={1}
        theme={unreachable ? 'red' : undefined}
        testID="dashboard-subtitle"
      >
        {subtitle}
      </Paragraph>
    </YStack>
  );
}
