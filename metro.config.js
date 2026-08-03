// Expo's default Metro config, plus one exclusion.
//
// `src-tauri/target/` is Cargo's build directory for the desktop wrapper (M7).
// It lives inside the Metro project root, holds several gigabytes across tens of
// thousands of files, and is rewritten on every `npm run build:desktop` — so
// without this Metro crawls all of it on startup and then watches it for changes
// it can never care about.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...config.resolver.blockList,
  /(^|[\\/])src-tauri[\\/]target[\\/]/,
];

module.exports = config;
