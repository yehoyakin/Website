/**
 * Random pattern for the page dissolve.
 *
 * The outgoing page dissolves through one of the pixel tiles in public/patterns/
 * instead of a flat fade (see base/viewTransitions.css). One tile is chosen per
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

/** Tiles in public/patterns/ — pattern_01.png … pattern_84.png. */
const PATTERN_COUNT = 84;

/* The MASK copies, not the tiles themselves. The tiles are opaque, so using
   them directly is a no-op for `mask-image` (an opaque image is 100% opaque
   everywhere). scripts/generate-pattern-masks.mjs bakes each tile's luminance
   into the alpha channel, which is what the default mask mode reads. */
const PATTERN_DIR = "patterns/masks";

const CSS_VAR = "--transition-pattern";

/** A random tile, as a base-aware url() ready for `mask-image`. */
function randomPattern() {
  const index = 1 + Math.floor(Math.random() * PATTERN_COUNT);
  const file = `pattern_${String(index).padStart(2, "0")}.png`;

  return `url("${import.meta.env.BASE_URL}${PATTERN_DIR}/${file}")`;
}

function setPattern() {
  document.documentElement.style.setProperty(CSS_VAR, randomPattern());
}

setPattern();

document.addEventListener("astro:before-preparation", setPattern);
