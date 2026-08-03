/**
 * React Native's Jest environment plus a real CanvasKit instance.
 *
 * `@shopify/react-native-skia/jestSetup.js` swaps the native module for its web
 * (CanvasKit) implementation and reads `global.CanvasKit`. Without it every Skia
 * call — including the path maths Victory Native does for pie slices and bars —
 * throws, so chart component tests could not run at all. CanvasKit initialises
 * asynchronously, which `setupFiles` cannot await, so it has to happen here.
 */
const ReactNativeEnv = require('@react-native/jest-preset/jest/react-native-env');
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit');

module.exports = class SkiaEnvironment extends ReactNativeEnv {
  async setup() {
    await super.setup();
    this.global.CanvasKit = await CanvasKitInit({});
  }
};
