/**
 * Rewrites the page backdrops as WebP.
 *
 * WHY: public/images/pageBackgrounds/*.gif are the site's animated backdrops.
 * The landing one alone is 1.5MB, and every listing page ships a day / night
 * pair, so the artwork was the largest thing on those pages after the icons.
 * GIF is a 1987 format with a 256-colour palette and no inter-frame
 * prediction, so the same animation is far smaller as WebP: lossless animated
 * WebP cut the set from 2.1MB to about 0.5MB with no change in what is drawn.
 *
 * Lossy WebP is the wrong tool here — on dithered pixel art it came out BIGGER
 * than the GIF it replaced (BlogDay: 267KB -> 529KB). Lossless keeps every
 * pixel and still wins, because GIF's compression is the weak part.
 *
 * VERIFICATION: the WebP encoder merges runs of identical consecutive frames
 * and adds their delays together, so the frame count and per-frame timings can
 * differ from the source even though the animation is unchanged. The check
 * below therefore compares by TIME, not by index: each output frame is matched
 * to the source frame that was on screen at that moment, and must be
 * pixel-identical to it. A file that fails is left as a GIF, untouched.
 *
 * Still backdrops (the .jpg night artwork) are simply re-encoded as WebP.
 *
 * Run: node scripts/optimize-backgrounds.mjs
 * Output: the same file names with a .webp extension; originals are removed
 * once verified. Reference them from pages/components by their new name.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join("public", "images", "pageBackgrounds");
const STILL_QUALITY = 88;

/** Decodes an image into its frames, plus each frame's on-screen start time. */
const decode = async (buffer) => {
  const meta = await sharp(buffer, { animated: true }).metadata();
  const pageHeight = meta.pageHeight ?? meta.height;
  const raw = await sharp(buffer, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const frameBytes = meta.width * pageHeight * 4;
  const count = Math.round(raw.length / frameBytes);
  const delays = meta.delay ?? [];

  const frames = [];
  let start = 0;
  for (let index = 0; index < count; index++) {
    frames.push({
      pixels: raw.subarray(index * frameBytes, (index + 1) * frameBytes),
      /* GIF delays are in 1/100s; a 0 means "as fast as possible", which
         browsers treat as 100ms. */
      start,
    });
    start += delays[index] || 10;
  }

  return { width: meta.width, pageHeight, frames, total: start };
};

/** The source frame on screen at `time`, or undefined if the two disagree. */
const frameAt = (decoded, time) => {
  for (let index = decoded.frames.length - 1; index >= 0; index--) {
    if (decoded.frames[index].start <= time) return decoded.frames[index];
  }

  return undefined;
};

const bytes = (value) => `${(value / 1024).toFixed(0)}KB`;

let before = 0;
let after = 0;
let converted = 0;
const failures = [];

for (const name of fs.readdirSync(DIR)) {
  if (!/\.(gif|jpe?g)$/i.test(name)) continue;

  const source = path.join(DIR, name);
  const target = source.replace(/\.(gif|jpe?g)$/i, ".webp");
  const input = fs.readFileSync(source);
  const animated = /\.gif$/i.test(name);

  let encoded;

  if (animated) {
    const original = await decode(input);
    encoded = await sharp(input, { animated: true })
      .webp({ lossless: true, effort: 4 })
      .toBuffer();
    const rewritten = await decode(encoded);

    if (Math.abs(original.total - rewritten.total) > 1) {
      failures.push(
        `${name}: total duration ${original.total} vs ${rewritten.total}`,
      );
      continue;
    }

    let mismatch = 0;
    for (const frame of rewritten.frames) {
      const reference = frameAt(original, frame.start);

      if (!reference || !reference.pixels.equals(frame.pixels)) mismatch++;
    }

    if (mismatch) {
      failures.push(`${name}: ${mismatch} frame(s) do not match by time`);
      continue;
    }
  } else {
    encoded = await sharp(input).webp({ quality: STILL_QUALITY }).toBuffer();
  }

  if (encoded.length >= input.length) {
    console.log(`${name}: WebP is not smaller, keeping the original`);
    continue;
  }

  fs.writeFileSync(target, encoded);
  fs.unlinkSync(source);

  before += input.length;
  after += encoded.length;
  converted++;

  console.log(
    `${name} → ${path.basename(target)}: ${bytes(input.length)} → ${bytes(encoded.length)}`,
  );
}

console.log(
  `\nconverted ${converted} backdrop(s): ${bytes(before)} → ${bytes(after)}`,
);

if (failures.length) {
  console.error(`\n${failures.length} kept as-is:`);
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exitCode = 1;
}
