import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * The ways out of immersive mode that are not a tap on the dashboard itself:
 * the Android back gesture, and Esc in a browser (which is what the reference
 * web app used).
 *
 * Tap-to-exit lives in the screen, because only it knows what is tappable.
 */
export function useImmersiveExit(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!active) return;

    // Returning true marks the press handled, so it exits immersive mode
    // instead of backing out of the dashboard.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });

    return () => subscription.remove();
  }, [active, onExit]);

  useEffect(() => {
    if (!active || Platform.OS !== 'web') return;
    // React Native defines a `window` global that is not a DOM window, so the
    // listener itself has to be the thing checked for, not `window`.
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onExit]);
}
