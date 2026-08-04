import { StyleSheet, Text } from 'react-native';

import { GradientSurface } from '@/components/telemetry/surfaces';
import { renderWithProviders } from '@/test-utils/render';

/**
 * These assertions look like they are testing CSS, and on native they are inert —
 * every view is a containing block and children already paint over an earlier
 * sibling. They exist because the web build (which the Tauri desktop target also
 * runs) obeys neither rule: without `position: relative` the absolutely-filled
 * gradient escapes its box and covers the entire window, and without the stacking
 * context it paints over `children` instead of behind them. Both shipped once, and
 * the whole app rendered as a blank dark rectangle.
 */
describe('GradientSurface', () => {
  it('is a containing block and a stacking context', async () => {
    const { getByTestId } = await renderWithProviders(
      <GradientSurface colors={['#0d1011', '#0a0c0d']} testID="surface">
        <Text>content</Text>
      </GradientSurface>
    );

    const style = StyleSheet.flatten(getByTestId('surface').props.style);
    expect(style.position).toBe('relative');
    expect(style.zIndex).toBe(0);
  });

  it('keeps the gradient filled and behind the content', async () => {
    const { getByTestId } = await renderWithProviders(
      <GradientSurface colors={['#0d1011', '#0a0c0d']} testID="surface">
        <Text>content</Text>
      </GradientSurface>
    );

    // The gradient is the surface's first child — it has to stay first so tree
    // order keeps it behind the content on native, where zIndex is not consulted.
    const [gradient] = getByTestId('surface').children;
    if (typeof gradient === 'string') throw new Error('expected the gradient element');
    const style = StyleSheet.flatten(gradient.props.style);
    expect(style.position).toBe('absolute');
    expect(style.zIndex).toBe(-1);
  });
});
