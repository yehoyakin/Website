/**
 * Panel pattern textures
 *
 * HOW TO CHANGE A PANEL'S TEXTURE:
 * 1. Pick a tile from public/patterns/ (256×256, shape on black).
 * 2. Swap the file name in THEME_PATTERNS — the path is relative to public/,
 *    without a leading slash.
 * 3. Done — the component that asks for `patternForTheme()` picks it up.
 *
 * These replace the blurred screenshots that used to sit inside the project
 * panels. Each theme owns one tile, so a card's texture belongs to the same
 * colour as its border, tag and icons — the way a Nintendo UI repeats a motif
 * across a panel instead of blurring artwork behind it.
 *
 * Tiles are opaque black-and-white silhouettes, so they are never painted
 * directly: styles/components/callCard.css blends them in `screen` mode, which
 * leaves the black areas untouched and turns the shapes into light texture.
 *
 * Paths go through utils/asset.ts, which prefixes BASE_URL. The site is served
 * from a subpath (/Website/), so a raw "/patterns/x.png" 404s and the layer
 * silently paints nothing — which is exactly how these tiles went missing.
 */

import { asset } from "../utils/asset";

/** Big, readable motifs for the large surfaces — rings, dots, bricks, hexes. */
const THEME_PATTERNS: Record<string, string> = {
  orange: "patterns/pattern_45.png", // scattered triangles
  purple: "patterns/pattern_23.png", // octagon rings
  yellow: "patterns/pattern_70.png", // dot grid
  green: "patterns/pattern_32.png", // brick grid
  pink: "patterns/pattern_24.png", // blobs
  blue: "patterns/pattern_84.png", // cross hatch
  lightgreen: "patterns/pattern_38.png", // rounded squares
  red: "patterns/pattern_11.png", // blocky maze
  gray: "patterns/pattern_02.png", // diagonal stripes
  lightblue: "patterns/pattern_05.png", // vertical bars
  white: "patterns/pattern_57.png", // pentagons
  black: "patterns/pattern_31.png", // waves
};

/** Any theme without an entry — and any untitled card — gets the dot grid. */
const DEFAULT_PATTERN = "patterns/pattern_70.png";

/** Base-aware URL of the pattern tile for a theme name ("green" → pattern_19). */
export function patternForTheme(theme?: string): string {
  if (typeof theme !== "string" || !theme.trim()) return asset(DEFAULT_PATTERN);

  return asset(THEME_PATTERNS[theme.trim().toLowerCase()] ?? DEFAULT_PATTERN);
}
