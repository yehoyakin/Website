/**
 * Turns the pattern tiles into alpha masks.
 *
 * WHY: public/patterns/256/*.webp are opaque black-and-white silhouettes. A CSS
 * `mask-image` reads the ALPHA channel by default, and an opaque image is 100%
 * opaque everywhere — so masking the page-transition snapshot with one did
 * nothing at all. `mask-mode: luminance` is the fix on paper, but it is not
 * honoured by every engine in a view-transition pseudo-element.
 *
 * So each tile is baked into an alpha mask here: white → alpha 255 (visible),
 * black → alpha 0 (gone). That works with the default mask mode everywhere, and
 * the masks stay webp so the asset set is one format.
 *
 * Run: node scripts/generate-pattern-masks.mjs
 * Output: public/patterns/masks/pattern_XXXX.webp
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = path.join("public", "patterns", "256");
const OUT_DIR = path.join("public", "patterns", "masks");

fs.mkdirSync(OUT_DIR, { recursive: true });

const tiles = fs
  .readdirSync(SRC_DIR)
  .filter((name) => /^pattern_\d+\.webp$/.test(name))
  .sort();

/* Masks that never reach alpha 0. The page dissolve needs some fully clear
   pixels, otherwise the old snapshot only fades and the pattern never reads;
   scripts/patternTransition.js keeps these out of its random pick. */
const nearSolid = [];

for (const tile of tiles) {
  const { data, info } = await sharp(path.join(SRC_DIR, tile))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  const rgba = Buffer.alloc(pixels * 4, 255);
  let minAlpha = 255;

  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    /* Luminance → alpha; the colour is irrelevant for an alpha mask. */
    const alpha = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    rgba[i * 4 + 3] = alpha;
    if (alpha < minAlpha) minAlpha = alpha;
  }

  if (minAlpha > 0) nearSolid.push(tile);

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ lossless: true })
    .toFile(path.join(OUT_DIR, tile));
}

console.log(`wrote ${tiles.length} masks to ${OUT_DIR}`);

if (nearSolid.length) {
  console.log(
    `near-solid, keep out of the page dissolve: ${nearSolid.join(", ")}`,
  );
}
