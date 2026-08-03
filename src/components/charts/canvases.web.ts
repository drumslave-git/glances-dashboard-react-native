import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { lazy } from 'react';

/**
 * On web, Skia is CanvasKit compiled to WebAssembly, and
 * `@shopify/react-native-skia` builds its whole API object from `global.CanvasKit`
 * **as its module body runs**. Importing a chart before `canvaskit.wasm` has
 * landed therefore produces an API bound to `undefined`, and the first draw call
 * throws `Cannot read properties of undefined (reading 'XYWHRect')` — which takes
 * down the entire app, not just the chart.
 *
 * Waiting at render time is not enough; the wait has to happen before the import.
 * Hence: start the download as this module is evaluated, and only then pull in the
 * canvases. `ChartView` renders them inside a `<Suspense>`.
 *
 * `npm run setup:skia-web` copies the wasm into `public/`, from where Expo's web
 * export serves it at the site root.
 */
const canvasKitReady = LoadSkiaWeb();

export const PieCanvas = lazy(async () => {
  await canvasKitReady;
  return { default: (await import('./pie-canvas')).PieCanvas };
});

export const BarCanvas = lazy(async () => {
  await canvasKitReady;
  return { default: (await import('./bar-canvas')).BarCanvas };
});
