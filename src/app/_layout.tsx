import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';

import { useTelemetryFonts } from '@/theme/fonts';
import { tamaguiConfig } from '@/theme/tamagui.config';
import { tokensFor } from '@/theme/telemetry';
import { useThemeMode } from '@/theme/use-telemetry';

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
  const mode = useThemeMode();
  const tokens = tokensFor(mode);

  // The web shell's `<html>`/`<body>` background is a hard-coded near-black so a
  // cold start does not flash white. Once the theme is known it has to follow,
  // or a light-mode board sits inside a dark frame wherever the page overscrolls.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = tokens.bg.app;
    document.body.style.backgroundColor = tokens.bg.app;
  }, [tokens.bg.app]);
  // Space Grotesk and JetBrains Mono are bundled, so this resolves in a frame or
  // two. Rendering before then would flash the platform font at a different
  // metric and reflow every number on the board.
  const fontsLoaded = useTelemetryFonts();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.bg.app }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={mode}>
        <Theme name={mode}>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
              {fontsLoaded && (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: tokens.bg.app },
                  }}
                />
              )}
            </SafeAreaProvider>
          </QueryClientProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
