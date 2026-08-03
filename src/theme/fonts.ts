import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

/**
 * The design's two families, bundled rather than fetched at runtime — the app
 * ships as a desktop and offline-capable web build, and a dashboard that has to
 * reach Google Fonts before it can render a number is not one.
 *
 * The weights here are exactly the ones `tamagui.config.ts` names in its `face`
 * maps. Adding a weight there without adding it here silently falls back to the
 * regular cut, which on a monospace face is easy to miss.
 */
export function useTelemetryFonts(): boolean {
  const [loaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  return loaded;
}
