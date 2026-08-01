import { SafeAreaView } from 'react-native-safe-area-context';
import { H1, Paragraph, YStack } from 'tamagui';

/**
 * Placeholder dashboard.
 *
 * Replaced in milestone M2 by the real dashboard (header + widget grid).
 */
export function DashboardScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} gap="$4" p="$4" justify="center" items="center">
        <H1 text="center">Glances Dashboard</H1>
        <Paragraph text="center" opacity={0.7} testID="scaffold-hint">
          Scaffold ready. Add a Glances server to get started.
        </Paragraph>
      </YStack>
    </SafeAreaView>
  );
}
