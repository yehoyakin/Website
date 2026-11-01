/**
 * Caps content images at the size they are actually displayed.
 *
 * WHY: the layout is a fixed 1280px wide, so the widest a scene, card or
 * portrait can ever be drawn is the article column (max 90vw). Content images
 * were being shipped at full source resolution anyway — two 3840x2160 frames
 * alone were 6.8MB on one post, and that post pulled ~9MB of pictures.
 *
 * Anything wider than MAX_WIDTH is resized to it and re-encoded in its own
 * format, in place, under its own file name — content refers to these files by
 * path, so nothing else has to change. Images already at or under the cap are
 * left untouched (no quality loss for no gain), and a rewrite only happens when
 * the result is actually smaller.
 *
 * Animated files are skipped: re-encoding can drop frames.
 *
 * Run: node scripts/optimize-images.mjs
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Twice the widest column the site can draw, to stay sharp on hi-dpi. */
const MAX_WIDTH = 1600;
const QUALITY = 82;

const ROOTS = [
  path.join("public", "images", "blog"),
  path.join("public", "images", "projects"),
  path.join("public", "images", "frontPage"),
];

const EXTENSIONS = /\.(webp|jpe?g|png)$/i;

const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXTENSIONS.test(entry.name)) files.push(full);
  }
};

ROOTS.forEach(walk);

let resized = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const file of files) {
  const source = fs.readFileSync(file);
  const meta = await sharp(source).metadata();

  /* Animated image: resizing it could drop frames. */
  if ((meta.pages ?? 1) > 1) continue;
  if (!meta.width || meta.width <= MAX_WIDTH) continue;

  let image = sharp(source).resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  const extension = path.extname(file).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    image = image.jpeg({ quality: QUALITY, mozjpeg: true });
  } else if (extension === ".png") {
    image = image.png({ compressionLevel: 9 });
  } else {
    image = image.webp({ quality: QUALITY });
  }

  const encoded = await image.toBuffer();

  if (encoded.length >= source.length) continue;

  fs.writeFileSync(file, encoded);

  bytesBefore += source.length;
  bytesAfter += encoded.length;
  resized++;

  const { width, height } = await sharp(encoded).metadata();
  console.log(
    `${file}: ${meta.width}x${meta.height} → ${width}x${height}, ` +
      `${(source.length / 1024).toFixed(0)}KB → ${(encoded.length / 1024).toFixed(0)}KB`,
  );
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

console.log(
  resized
    ? `resized ${resized} images: ${mb(bytesBefore)} → ${mb(bytesAfter)}`
    : `nothing to do: every image is within ${MAX_WIDTH}px`,
);
