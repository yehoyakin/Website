/**
 * Turns the pattern tiles into alpha masks.
 *
 * WHY: public/patterns/*.png are opaque black-and-white silhouettes. A CSS
 * `mask-image` reads the ALPHA channel by default, and an opaque image is 100%
 * opaque everywhere — so masking the page-transition snapshot with one did
 * nothing at all. `mask-mode: luminance` is the fix on paper, but it is not
 * honoured by every engine in a view-transition pseudo-element.
 *
 * So each tile is baked into an alpha mask here: white → alpha 255 (visible),
 * black → alpha 0 (gone). That works with the default mask mode everywhere.
 *
 * Run: node scripts/generate-pattern-masks.mjs
 * Output: public/patterns/masks/pattern_XX.png
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const SRC_DIR = path.join("public", "patterns");
const OUT_DIR = path.join(SRC_DIR, "masks");

/* ── PNG reading (only what these tiles use: 8-bit indexed, any bit depth) ── */

function readChunks(buf) {
  let off = 8;
  const out = { idat: [], palette: null, header: null };

  while (off < buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + length);

    if (type === "IHDR") out.header = data;
    if (type === "IDAT") out.idat.push(data);
    if (type === "PLTE") out.palette = data;
    if (type === "IEND") break;

    off += 12 + length;
  }

  return out;
}

function decodeIndexed(buf) {
  const chunks = readChunks(buf);
  const width = chunks.header.readUInt32BE(0);
  const height = chunks.header.readUInt32BE(4);
  const depth = chunks.header[8];
  const colorType = chunks.header[9];

  if (colorType !== 3) throw new Error("not an indexed png");

  const raw = zlib.inflateSync(Buffer.concat(chunks.idat));
  const stride = Math.ceil((width * depth) / 8);
  const indices = Buffer.alloc(width * height);

  let p = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;

    const cur = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= 1 ? cur[x - 1] : 0;
      const b = prev[x];
      const c = x >= 1 ? prev[x - 1] : 0;
      let v = line[x];

      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }

      cur[x] = v & 255;
    }

    for (let x = 0; x < width; x++) {
      let index;

      if (depth === 8) index = cur[x];
      else if (depth === 4) index = (cur[x >> 1] >> (x % 2 === 0 ? 4 : 0)) & 15;
      else if (depth === 2) index = (cur[x >> 2] >> (6 - (x % 4) * 2)) & 3;
      else index = (cur[x >> 3] >> (7 - (x % 8))) & 1;

      indices[y * width + x] = index;
    }

    prev = cur;
  }

  return { width, height, indices, palette: chunks.palette };
}

/* ── PNG writing (8-bit RGBA, filter 0) ─────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }

  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);

  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

function encodeRgba(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Convert ────────────────────────────────────────────────────────────── */

fs.mkdirSync(OUT_DIR, { recursive: true });

const tiles = fs
  .readdirSync(SRC_DIR)
  .filter((name) => /^pattern_\d+\.png$/.test(name))
  .sort();

for (const tile of tiles) {
  const { width, height, indices, palette } = decodeIndexed(
    fs.readFileSync(path.join(SRC_DIR, tile)),
  );

  const rgba = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const index = indices[i];
    const r = palette ? palette[index * 3] : 0;
    const g = palette ? palette[index * 3 + 1] : 0;
    const b = palette ? palette[index * 3 + 2] : 0;

    /* Luminance → alpha; the colour itself is irrelevant for an alpha mask. */
    const alpha = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alpha;
  }

  fs.writeFileSync(path.join(OUT_DIR, tile), encodeRgba(width, height, rgba));
}

console.log(`wrote ${tiles.length} masks to ${OUT_DIR}`);
