import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, userEvent, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';

import { tamaguiConfig } from '@/theme/tamagui.config';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

/**
 * Wraps a subject in the same providers the app mounts at its root, so component
 * tests exercise real theming and query wiring instead of mocks.
 *
 * `render` is asynchronous in React Native Testing Library 14 — always await this.
 */
export async function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <Theme name="dark">
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </Theme>
        </TamaguiProvider>
      </SafeAreaProvider>
    );
  }

  const view = await render(ui, { wrapper: Wrapper, ...options });

  return { queryClient, user: userEvent.setup(), ...view };
}

export * from '@testing-library/react-native';
