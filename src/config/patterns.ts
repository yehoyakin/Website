/**
 * Panel pattern textures
 *
 * HOW TO CHANGE A PANEL'S TEXTURE:
 * 1. Pick a tile from public/patterns/256/ (256x256, light shapes on black).
 * 2. Swap the file name in THEME_PATTERNS — the path is relative to public/,
 *    without a leading slash.
 * 3. Done — the component that asks for `patternForTheme()` picks it up.
 *
 * The tiles are Kenney's pattern pack (https://kenney-assets.itch.io), credited
 * on the landing page. Each theme owns one tile, so a card's texture belongs to
 * the same colour as its border, tag and icons — the way a Nintendo UI repeats a
 * motif across a panel instead of blurring artwork behind it.
 *
 * Tiles are opaque black-and-white silhouettes, so they are never painted
 * directly: styles/chrome/pixelChrome/patternPlates.css blends them in `screen`
 * mode, which leaves the black areas untouched and turns the shapes into light
 * texture.
 *
 * Paths go through utils/asset.ts, which prefixes BASE_URL. The site is served
 * from a subpath (/Website/), so a raw "/patterns/x.png" 404s and the layer
 * silently paints nothing — which is exactly how these tiles went missing.
 */

import { asset } from "../utils/asset";

/** One tile per theme colour, in theme order. */
const THEME_PATTERNS: Record<string, string> = {
  orange: "patterns/256/pattern_06.webp",
  purple: "patterns/256/pattern_48.webp",
  yellow: "patterns/256/pattern_32.webp",
  green: "patterns/256/pattern_40.webp",
  pink: "patterns/256/pattern_48.webp",
  blue: "patterns/256/pattern_32.webp",
  lightgreen: "patterns/256/pattern_28.webp",
  red: "patterns/256/pattern_51.webp",
  gray: "patterns/256/pattern_08.webp",
  lightblue: "patterns/256/pattern_55.webp",
  white: "patterns/256/pattern_25.webp",
  black: "patterns/256/pattern_11.webp",
};

/** Any theme without an entry — and any unthemed card — gets this one. */
const DEFAULT_PATTERN = "patterns/256/pattern_0012.webp";

/** Base-aware URL of the pattern tile for a theme name. */
export function patternForTheme(theme?: string): string {
  if (typeof theme !== "string" || !theme.trim()) return asset(DEFAULT_PATTERN);

  return asset(THEME_PATTERNS[theme.trim().toLowerCase()] ?? DEFAULT_PATTERN);
}
