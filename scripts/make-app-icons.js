// Regenerates every app icon in `assets/images/` from the in-app logo mark.
//
// The mark is drawn in code on the dashboard (`LogoMark` in
// src/components/telemetry/surfaces.tsx): a lime rounded square with a 45°-rotated
// square punched out of it. Until 0.2.2 the shipped icons were still the stock
// Expo template chevron, so the taskbar, the installer and the dashboard heading
// all disagreed about what this app looks like. This script renders the same
// geometry (side ratios 6/25 corner radius, 0.32 inner square) at icon sizes, so
// there is exactly one piece of logo art and it lives in the component.
//
// Output is committed. Re-run with `npm run icons:app` when the mark changes,
// then `npm run icons:web` (PWA set) and `npx tauri icon assets/images/icon.png`
// (Windows set) to propagate.
const path = require('node:path');

const Jimp = require('jimp-compact');

const out = path.join(path.resolve(__dirname, '..'), 'assets', 'images');

/** Dark-mode tokens from src/theme/telemetry.ts — the icon is the dark mark. */
const LIME = { r: 0xb6, g: 0xf2, b: 0x4a };
const APP_BG = { r: 0x07, g: 0x08, b: 0x0a };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

/** LogoMark's proportions: corner radius 6/25 of the tile, inner square 0.32 of it. */
const CORNER_RATIO = 6 / 25;
const DIAMOND_HALF_DIAG = 0.32 * Math.SQRT1_2; // rotated square's half-diagonal, in tile sides

/** Coverage of the mark at a point, in tile-relative coordinates centred on 0. */
function insideMark(x, y, half) {
  const radius = 2 * half * CORNER_RATIO;
  const dx = Math.abs(x) - (half - radius);
  const dy = Math.abs(y) - (half - radius);
  const inTile =
    dx <= 0 && dy <= 0 ? true : Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) <= radius;
  if (!inTile) return false;
  const inDiamond = Math.abs(x) + Math.abs(y) <= 2 * half * DIAMOND_HALF_DIAG;
  return !inDiamond;
}

/**
 * Render the mark into a square canvas.
 *
 * 4×4 supersampling instead of a vector rasterizer: the two shapes are a rounded
 * rectangle and an L1 ball, both trivial coverage tests, and jimp has no vector
 * API to reach for anyway.
 */
async function render({ size, tileFraction, fill, background }) {
  const image = await new Promise((resolve, reject) => {
    // eslint-disable-next-line no-new
    new Jimp(size, size, 0x00000000, (error, created) =>
      error ? reject(error) : resolve(created),
    );
  });

  const half = (size * tileFraction) / 2;
  const centre = size / 2;
  const SS = 4;
  const { data } = image.bitmap;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = px + (sx + 0.5) / SS - centre;
          const y = py + (sy + 0.5) / SS - centre;
          if (insideMark(x, y, half)) hits += 1;
        }
      }
      const coverage = hits / (SS * SS);
      const index = (py * size + px) * 4;
      if (background) {
        // Opaque canvas: the mark over the app background.
        data[index] = Math.round(background.r + (fill.r - background.r) * coverage);
        data[index + 1] = Math.round(background.g + (fill.g - background.g) * coverage);
        data[index + 2] = Math.round(background.b + (fill.b - background.b) * coverage);
        data[index + 3] = 255;
      } else {
        // Transparent canvas: the hole is a real hole.
        data[index] = fill.r;
        data[index + 1] = fill.g;
        data[index + 2] = fill.b;
        data[index + 3] = Math.round(255 * coverage);
      }
    }
  }

  return image;
}

async function solid(size, color) {
  const image = await new Promise((resolve, reject) => {
    // eslint-disable-next-line no-new
    new Jimp(size, size, 0x00000000, (error, created) =>
      error ? reject(error) : resolve(created),
    );
  });
  const { data } = image.bitmap;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
    data[index + 3] = 255;
  }
  return image;
}

async function main() {
  const write = async (image, name) => {
    await image.writeAsync(path.join(out, name));
    return name;
  };

  const written = [
    // The app icon and favicon: the tile is the icon, on a transparent canvas.
    await write(await render({ size: 1024, tileFraction: 0.92, fill: LIME }), 'icon.png'),
    await write(await render({ size: 64, tileFraction: 1, fill: LIME }), 'favicon.png'),
    await write(await render({ size: 512, tileFraction: 1, fill: LIME }), 'splash-icon.png'),
    // Android adaptive icon: the mark inside the 66% safe zone over a solid app-background layer;
    // the monochrome layer is the same geometry in white, alpha carrying the shape.
    await write(
      await render({ size: 1024, tileFraction: 0.44, fill: LIME }),
      'android-icon-foreground.png',
    ),
    await write(
      await render({ size: 1024, tileFraction: 0.44, fill: WHITE }),
      'android-icon-monochrome.png',
    ),
    await write(await solid(1024, APP_BG), 'android-icon-background.png'),
  ];

  console.log(`wrote ${written.length} icons to assets/images: ${written.join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
