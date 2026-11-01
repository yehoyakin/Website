/**
 * Random pattern for the page dissolve.
 *
 * The outgoing page dissolves through one of the pixel tiles instead of a flat
 * fade (see foundation/pageDissolveTransition.css). One tile is chosen per
 * navigation, so consecutive page changes never resolve the same way twice.
 *
 * How it hooks in: Astro's ClientRouter fires `astro:before-preparation` before
 * it captures the two snapshots, so the custom property is already on <html>
 * when the browser builds the view-transition pseudo-elements. It is left in
 * place afterwards — the next navigation overwrites it, and while no navigation
 * is running nothing reads it.
 *
 * Markup contract: none. This writes `--transition-pattern` on <html>, which
 * the transition CSS reads with a `none` fallback, so a page that never
 * navigates still gets the plain dissolve.
 */

/** Masks in public/patterns/masks — pattern_0000.webp … pattern_0029.webp. */
const PATTERN_COUNT = 30;

/* Two tiles never reach black: pattern_0007 is a blank white square and
   pattern_0013 only goes down to alpha 1. The outgoing page therefore never
   fully clears through them, so the dissolve reads as a plain fade. They are
   skipped so every navigation shows a pattern. The mask generator reports
   these ("near-solid") on every run — keep this list in step with it. */
const SKIPPED_MASKS = new Set([7, 13]);

/** Every mask that actually opens up. */
const MASK_INDICES = Array.from({ length: PATTERN_COUNT }, (_, i) => i).filter(
  (index) => !SKIPPED_MASKS.has(index),
);

/* The MASK copies, not the tiles themselves. The tiles are opaque, so using
   them directly is a no-op for `mask-image` (an opaque image is 100% opaque
   everywhere). scripts/generate-pattern-masks.mjs bakes each tile's luminance
   into the alpha channel, which is what the default mask mode reads. */
const PATTERN_DIR = "patterns/masks";

const CSS_VAR = "--transition-pattern";

/** A random tile, as a base-aware url() ready for `mask-image`. */
function randomPattern() {
  const index = MASK_INDICES[Math.floor(Math.random() * MASK_INDICES.length)];
  const file = `pattern_${String(index).padStart(4, "0")}.webp`;

  return `url("${import.meta.env.BASE_URL}${PATTERN_DIR}/${file}")`;
}

function setPattern() {
  document.documentElement.style.setProperty(CSS_VAR, randomPattern());
}

setPattern();

document.addEventListener("astro:before-preparation", setPattern);
