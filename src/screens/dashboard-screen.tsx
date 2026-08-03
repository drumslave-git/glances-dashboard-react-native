import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, SizableText, XStack, YStack } from 'tamagui';

import { selectServerById, useServersStore } from '@/state/servers';
import { useSystemInfo } from '@/hooks/useGlancesQuery';

/**
 * Placeholder dashboard: proves the data layer end to end until M2 replaces it
 * with the real header and widget grid.
 */
export function DashboardScreen() {
  const router = useRouter();
  const defaultServer = useServersStore((state) =>
    selectServerById(state, state.defaultServerId),
  );
  const serverCount = useServersStore((state) => state.servers.length);
  const { data: system, isError } = useSystemInfo(defaultServer);

  const hostname = typeof system?.hostname === 'string' ? system.hostname : undefined;
  const distro = typeof system?.linux_distro === 'string' ? system.linux_distro : undefined;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <YStack flex={1} p="$4" gap="$4">
        <XStack items="center" gap="$3">
          <H1 size="$8" flex={1}>
            Glances
          </H1>
          <Button size="$3" onPress={() => router.push('/settings')} testID="open-settings">
            Settings
          </Button>
        </XStack>

        <YStack flex={1} justify="center" items="center" gap="$2">
          {serverCount === 0 ? (
            <Paragraph text="center" opacity={0.7} testID="dashboard-no-servers">
              No servers configured. Add one in Settings to load data.
            </Paragraph>
          ) : (
            <>
              <SizableText size="$6" testID="dashboard-server-name">
                {defaultServer?.name}
              </SizableText>
              {hostname && (
                <Paragraph opacity={0.8} testID="dashboard-hostname">
                  {hostname}
                  {distro ? ` · ${distro}` : ''}
                </Paragraph>
              )}
              {isError && (
                <Paragraph theme="red" text="center" testID="dashboard-error">
                  Could not reach {defaultServer?.url}
                </Paragraph>
              )}
              <Paragraph size="$2" opacity={0.5} text="center">
                Widgets arrive in the next milestone.
              </Paragraph>
            </>
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
