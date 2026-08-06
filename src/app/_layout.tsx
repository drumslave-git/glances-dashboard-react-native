import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';

import { startPolling } from '@/data/start-polling';
import { useTelemetryFonts } from '@/theme/fonts';
import { tamaguiConfig } from '@/theme/tamagui.config';
import { colorFor } from '@/theme/appearance';
import { useAppearance, useThemeMode } from '@/theme/use-telemetry';

/**
 * Polling cadence is set per query from each server's pollIntervalMs, so the client
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
  const appearance = useAppearance();
  const canvas = colorFor(appearance.gridBackground, mode);
  /**
   * A translucent grid has to be translucent *all the way down*.
   *
   * The desktop window is created transparent, so the only thing between the board and the desktop
   * is what the page paints. If the shell keeps an opaque colour the user's alpha blends onto that
   * instead and simply looks pale — which is the same reason the reference forces `html, body,
   * #root` transparent over its CssBaseline.
   */
  const seeThrough = appearance.gridBackground[mode].alpha < 1;
  const shell = seeThrough ? 'transparent' : canvas;

  // The web shell's `<html>`/`<body>` background is a hard-coded near-black so a
  // cold start does not flash white. Once the theme is known it has to follow,
  // or a light-mode board sits inside a dark frame wherever the page overscrolls.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = shell;
    document.body.style.backgroundColor = shell;
  }, [shell]);
  // The poller outlives every screen — it holds the ring buffers a chart draws from and the
  // backoff state a failing endpoint accumulates — so it is started once here and torn down only
  // when the app itself goes. `startPolling` is idempotent for the same reason.
  useEffect(() => startPolling(), []);

  // Space Grotesk and JetBrains Mono are bundled, so this resolves in a frame or
  // two. Rendering before then would flash the platform font at a different
  // metric and reflow every number on the board.
  const fontsLoaded = useTelemetryFonts();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: shell }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={mode}>
        <Theme name={mode}>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
              {fontsLoaded && (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: shell },
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
