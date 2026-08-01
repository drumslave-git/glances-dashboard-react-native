import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';

import { tamaguiConfig } from '@/theme/tamagui.config';

/**
 * Polling cadence is set per query from each server's refreshMs, so the client
 * only carries cross-cutting behaviour.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <Theme name="dark">
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#101113' },
                }}
              />
            </SafeAreaProvider>
          </QueryClientProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
