/**
 * Tells the poller when nobody is looking (ref §4.4).
 *
 * The reference hooks the BrowserWindow's `hide`/`minimize`/`show`/`restore` and `powerMonitor`.
 * There is no window here, so the equivalent signals differ by platform and this module is the one
 * place that knows which:
 *
 * - **Native** — `AppState`. `background` is the app genuinely out of view; `inactive` is the iOS
 *   app switcher or a permission sheet, which is a moment, not an absence, so it is treated as
 *   visible. Dropping cadence for a half-second overlay would only make coming back feel stale.
 * - **Web and desktop** — `visibilitychange`. In the Tauri window this fires on minimize, which is
 *   the desktop signal the reference gets from the window itself.
 *
 * Backgrounding does **not** stop polling: it drops every tier to a keep-warm cadence, so buffers
 * stay warm and returning shows a live board rather than one that has to fill in.
 */
import { AppState, Platform } from 'react-native';

interface VisibilityTarget {
  setHidden: (hidden: boolean) => void;
}

/**
 * Start listening. Returns an unsubscribe function.
 *
 * Deliberately not a hook: the poller is a module-level singleton with a lifetime longer than any
 * screen, and binding its cadence to a component's mount would pause polling on navigation.
 */
export function watchVisibility(target: VisibilityTarget): () => void {
  if (Platform.OS === 'web') {
    // React Native defines a `window` global with no DOM listener methods, so the presence of
    // `addEventListener` is the real check — not the presence of `window`.
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
      return () => undefined;
    }
    const onChange = (): void => target.setHidden(document.visibilityState === 'hidden');
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }

  const subscription = AppState.addEventListener('change', (state) => {
    target.setHidden(state === 'background');
  });
  return () => subscription.remove();
}
