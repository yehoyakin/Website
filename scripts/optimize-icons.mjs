/**
 * Rewrites the pixel icon set as WebP.
 *
 * WHY: public/images/Icons/<Colour>/*.png are 120x120 pixel-art icons saved
 * without real compression — 56.5KB each, which is about the raw RGBA size
 * (120 * 120 * 4 = 57.6KB). The whole set is 122MB, and a single page pulls
 * several hundred KB of it for a handful of 120px glyphs.
 *
 * Lossless WebP stores the same pixels in roughly 300 bytes per icon (the set
 * is flat pixel art, so it compresses about 170x better), which is what makes
 * the swap worth doing rather than merely re-saving the PNGs.
 *
 * Each icon is verified after encoding: the decoded WebP has to be pixel-for-
 * pixel identical to the PNG it replaces. The PNG is only deleted once it has
 * matched, so a bad encode leaves the source in place.
 *
 * `exact: true` is what makes that comparison possible: by default the WebP
 * encoder rewrites the colour of fully transparent pixels (they render the
 * same, but the bytes differ, so an exact check would reject every icon).
 *
 * Run: node scripts/optimize-icons.mjs          (convert + verify + drop PNGs)
 *      node scripts/optimize-icons.mjs --keep   (convert + verify, keep PNGs)
 *
 * Components resolve icons through src/config/icons.ts, which asks for `.webp`;
 * keep this script and that module in step.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ICON_ROOT = path.join("public", "images", "Icons");
const KEEP_PNGS = process.argv.includes("--keep");

const colors = fs
  .readdirSync(ICON_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

let converted = 0;
let alreadyDone = 0;
let failed = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const color of colors) {
  const dir = path.join(ICON_ROOT, color);
  const pngs = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort();

  for (const png of pngs) {
    const pngPath = path.join(dir, png);
    const webpPath = pngPath.replace(/\.png$/i, ".webp");

    try {
      const source = fs.readFileSync(pngPath);
      const encoded = await sharp(source)
        .webp({ lossless: true, exact: true })
        .toBuffer();

      /* Verify: identical dimensions and identical pixels. */
      const [original, rewritten] = await Promise.all([
        sharp(source).raw().toBuffer({ resolveWithObject: true }),
        sharp(encoded).raw().toBuffer({ resolveWithObject: true }),
      ]);

      const samePixels =
        original.info.width === rewritten.info.width &&
        original.info.height === rewritten.info.height &&
        original.data.equals(rewritten.data);

      if (!samePixels) {
        console.error(`pixels differ, keeping the PNG: ${pngPath}`);
        failed++;
        continue;
      }

      fs.writeFileSync(webpPath, encoded);

      bytesBefore += source.length;
      bytesAfter += encoded.length;
      converted++;

      if (!KEEP_PNGS) fs.unlinkSync(pngPath);
    } catch (error) {
      console.error(`${pngPath}: ${error.message}`);
      failed++;
    }
  }

  /* Re-runs find only .webp files here; they are counted, not re-encoded. */
  alreadyDone += fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".webp")).length;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

console.log(
  `converted ${converted} icons: ${mb(bytesBefore)} → ${mb(bytesAfter)}` +
    (KEEP_PNGS ? " (PNGs kept)" : " (PNGs removed)"),
);

if (alreadyDone) console.log(`${alreadyDone} icons already in WebP.`);

if (failed) {
  console.error(`${failed} icon(s) left as PNG — see above.`);
  process.exitCode = 1;
}
