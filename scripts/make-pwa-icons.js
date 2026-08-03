// Regenerates the PWA icons in `public/icons/` from the app icons in `assets/`.
//
// The output is committed, so this only needs running when the source art
// changes — `npm run icons:web`. jimp-compact comes in with Expo's own image
// tooling; if it ever disappears, the committed PNGs still ship and this script
// is the only thing that breaks.
const fs = require('node:fs/promises');
const path = require('node:path');

const Jimp = require('jimp-compact');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets', 'images');
const outDir = path.join(root, 'public', 'icons');

async function resized(src, size, out) {
  const image = await Jimp.read(path.join(assets, src));
  image.resize(size, size);
  await image.writeAsync(path.join(outDir, out));
  return out;
}

/**
 * A maskable icon is cropped to whatever shape the platform likes, so it needs
 * art that already keeps clear of the edges. The Android adaptive icon layers
 * are exactly that, so compose them rather than padding the square icon.
 */
async function maskable(size, out) {
  const background = await Jimp.read(path.join(assets, 'android-icon-background.png'));
  const foreground = await Jimp.read(path.join(assets, 'android-icon-foreground.png'));
  background.resize(size, size);
  foreground.resize(size, size);
  background.composite(foreground, 0, 0);
  await background.writeAsync(path.join(outDir, out));
  return out;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const written = [
    await resized('icon.png', 192, 'icon-192.png'),
    await resized('icon.png', 512, 'icon-512.png'),
    // iOS ignores the manifest and reads <link rel="apple-touch-icon"> instead.
    await resized('icon.png', 180, 'apple-touch-icon.png'),
    await maskable(512, 'maskable-512.png'),
  ];
  console.log(`wrote ${written.length} icons to public/icons: ${written.join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
