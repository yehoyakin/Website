/**
 * ONE SWITCH FOR EVERY CAROUSEL NAVIGATOR.
 *
 * Galleries and listing strips appear on the blog and portfolio pages. They can
 * be moved in two ways, and this flag picks which one the whole site uses:
 *
 *   true  — the custom navigator: pixel-art prev/next arrows plus the dot
 *           index under the strip. The browser's scrollbar is hidden.
 *   false — no custom navigation and no index anywhere (strips and the enlarged
 *           view alike). The browser's own scrollbar is the only way to move a
 *           strip, so nothing on the page is a dead control.
 *
 * Every reader of this flag treats it as the single source of truth:
 * `scripts/cardCarousel.js` (whether to build the controls) and the root
 * `data-carousel-controls` attribute rendered by `layouts/MyLayout.astro`
 * (whether the stylesheet hides the native scrollbar or shows it).
 */
export const CUSTOM_CAROUSEL_CONTROLS = false;
