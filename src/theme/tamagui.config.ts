import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

/**
 * App-wide Tamagui configuration.
 *
 * Built on the stock v5 config for now — tokens, media queries and themes are
 * inherited. Customise here (not at call sites) when the dashboard needs its own
 * spacing scale or accent colours.
 */
export const tamaguiConfig = createTamagui(defaultConfig);

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
