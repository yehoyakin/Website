/**
 * Gallery equal height.
 *
 * For multi-media galleries (`.markdown-gallery` without
 * `.markdown-gallery--single`), removes the fixed aspect-ratio constraint and
 * sets every card's media area to the height of the tallest media, so there is
 * no letterboxing dead space.
 *
 * Handles all three gallery kinds in ONE up-front pass at load, not lazily when
 * a card is scrolled into focus:
 *   - `<img>`   : forced to decode (`.load()`), measured from naturalWidth/Height.
 *   - `<video>` : forced to fetch metadata, measured from videoWidth/Height
 *                 (`loadedmetadata` fires for `preload="metadata"`; the old
 *                 `loadeddata` wait never resolved until playback, which left
 *                 the whole gallery undetermined until the reader reached it).
 *   - `<iframe>`: embeds (YouTube etc.) are cross-origin, so they expose no
 *                 intrinsic size; they are assumed a fixed 16:9 ratio and are
 *                 NOT force-loaded — the height is reserved from the ratio.
 *
 * Any media that fails or stalls past a short timeout falls back to a known
 * ratio instead of blocking the pass, so the gallery is always measured once,
 * at load, for every card — embed-only and mixed included.
 */

/* Standard video-embed ratio (YouTube, Vimeo). Used for every gallery `<iframe>`
   because a cross-origin embed cannot be measured. Overridable per card with
   `data-media-aspect="W/H"` on the media element for non-16:9 embeds. */
const EMBED_ASPECT = 16 / 9;

/* Per-item media dimensions are only needed for videos that never decoded and
   images that never loaded; a short timeout keeps the up-front pass from
   hanging on a broken/stalled asset. */
const MEDIA_TIMEOUT_MS = 3500;

/**
 * Read a media element's width/height aspect ratio, or null if it has no usable
 * intrinsic size yet. Embeds return the assumed (or `data-media-aspect`) ratio.
 */
function aspectOf(el) {
  if (el.tagName === "VIDEO") {
    return el.videoWidth > 0 && el.videoHeight > 0
      ? el.videoWidth / el.videoHeight
      : null;
  }
  if (el.tagName === "IMG") {
    return el.naturalWidth > 0 && el.naturalHeight > 0
      ? el.naturalWidth / el.naturalHeight
      : null;
  }
  if (el.tagName === "IFRAME") {
    const a = el.dataset && el.dataset.mediaAspect;
    if (a) {
      const parts = String(a).split("/").map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return parts[0] / parts[1];
      }
    }
    return EMBED_ASPECT;
  }
  return null;
}

/**
 * Force the images and videos in a gallery to expose their dimensions, then
 * resolve. Embeds are intentionally left out — their ratio is assumed, so they
 * never need to load for the measurement.
 */
function waitForMedia(gallery) {
  const media = Array.from(
    gallery.querySelectorAll(".thumb-carousel-img, .thumb-carousel-video")
  );

  return Promise.all(
    media.map((el) => {
      // Already measurable — nothing to wait for.
      if (aspectOf(el)) return Promise.resolve();

      const settled = new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        if (el.tagName === "VIDEO") {
          // `loadedmetadata` is the event that actually fires for
          // preload="metadata"; `loadeddata` is a backup for streams that jump
          // straight to current data. `error` resolves too so a broken clip
          // can never stall the whole gallery.
          el.addEventListener("loadedmetadata", finish, { once: true });
          el.addEventListener("loadeddata", finish, { once: true });
          el.addEventListener("error", finish, { once: true });
          try {
            el.load();
          } catch (e) {}
        } else {
          el.addEventListener("load", finish, { once: true });
          el.addEventListener("error", finish, { once: true });
        }
        window.setTimeout(finish, MEDIA_TIMEOUT_MS);
      });
      return settled;
    })
  ).then(() => media);
}

/**
 * Equalize the image-wrap height for every card in a single gallery to the
 * tallest rendered media height. Removes all CSS constraints first, then
 * measures actual rendered heights, then applies equal heights.
 *
 * The CSS gives the image wrap a fixed `aspect-ratio: 21 / 10` and uses
 * `object-fit: contain` on images — both create letterboxing dead space.
 * The script removes aspect-ratio, switches to object-fit: cover, clears
 * themed backgrounds, then measures each image's actual rendered height
 * and equalizes all cards to the tallest.
 */
function equalizeGallery(gallery) {
  if (gallery.dataset.equalHeightReady === "true") return;

  const items = gallery.querySelectorAll(".gallery-project-item");
  if (items.length <= 1) {
    // Nothing to equalize; allow a later pass to re-check if items appear.
    gallery.dataset.equalHeightScheduled = "false";
    return;
  }

  // Collect all media elements, wraps, carousel wrappers, and cards across the gallery
  const allMedia = [];
  const wraps = [];
  const carouselWrappers = [];
  const cards = [];

  items.forEach((item) => {
    const media = item.querySelector(
      ".thumb-carousel-img, .thumb-carousel-video, .thumb-carousel-frame"
    );
    const wrap = item.querySelector(".blog-card-image-wrap");
    const carouselWrapper = item.querySelector(".thumb-carousel-media");
    const card = item.querySelector(".gallery-thumb");
    if (media) allMedia.push(media);
    if (wrap) wraps.push(wrap);
    if (carouselWrapper) carouselWrappers.push(carouselWrapper);
    if (card) cards.push(card);
  });

  if (allMedia.length === 0) {
    // No media at all (not even an embed); permit a future retry.
    gallery.dataset.equalHeightScheduled = "false";
    return;
  }

  // STEP 1: Remove all CSS constraints so media render at their natural size
  // Clear themed backgrounds so no dead space color shows behind media
  wraps.forEach((wrap) => {
    wrap.style.setProperty("aspect-ratio", "unset", "important");
    wrap.style.setProperty("height", "auto", "important");
    wrap.style.setProperty("min-height", "0", "important");
    wrap.style.background = "transparent";
  });

  // Switch images and videos to object-fit: cover so they fill the wrap without
  // dead space. Embeds (iframes) are left alone — they already stretch to the
  // wrap box, and `object-fit` does not apply to them.
  allMedia.forEach((el) => {
    if (el.tagName === "IFRAME") return;
    el.style.objectFit = "cover";
    el.style.background = "transparent";
  });

  // Clear themed background on carousel wrapper divs
  carouselWrappers.forEach((wrapper) => {
    wrapper.style.background = "transparent";
  });

  // STEP 2: Force a reflow so the browser recalculates layout without constraints
  void gallery.offsetHeight;

  // STEP 3: Now measure each media's ideal height in its card. The width is set
  // by the card; the height follows the media's own aspect ratio (natural for
  // images, decoded for videos, assumed for embeds) since aspect-ratio is unset.
  let maxHeight = 0;
  allMedia.forEach((el) => {
    const wrap = el.closest(".blog-card-image-wrap");
    if (!wrap) return;

    const wrapWidth = wrap.getBoundingClientRect().width;
    if (wrapWidth < 1) return;

    // Embeds always yield a ratio; images/videos fall back to the assumed ratio
    // only if they never decoded, so the up-front pass is never blocked.
    const ratio = aspectOf(el) || EMBED_ASPECT;
    const idealHeight = wrapWidth / ratio;
    if (idealHeight > maxHeight) maxHeight = idealHeight;
  });

  if (maxHeight < 1) {
    // No media had decoded dimensions yet — this pass measured nothing, so
    // release the schedule lock and let a later pass try again (once).
    gallery.dataset.equalHeightScheduled = "false";
    return;
  }

  // STEP 4: Apply the equal height to all image wraps
  wraps.forEach((wrap) => {
    wrap.style.setProperty("height", `${maxHeight}px`, "important");
  });

  // STEP 5: Measure the caption bar height from the first card that has one
  let captionHeight = 0;
  items.forEach((item) => {
    const bar = item.querySelector(".blog-card-bar, .blog-card-info-bar");
    if (bar) {
      const barRect = bar.getBoundingClientRect();
      if (barRect.height > captionHeight) captionHeight = barRect.height;
    }
  });

  // STEP 6: Set each card's height to image wrap + caption bar (overrides CSS !important)
  const cardHeight = maxHeight + captionHeight;
  cards.forEach((card) => {
    card.style.setProperty("height", `${cardHeight}px`, "important");
    card.style.setProperty("max-height", `${cardHeight}px`, "important");
    card.style.setProperty("min-height", `${cardHeight}px`, "important");
  });

  gallery.dataset.equalHeightReady = "true";
}

/**
 * Initialize equal-height for all multi-image galleries in the given root.
 */
export function initGalleryEqualHeight(root = document) {
  const galleries = root.querySelectorAll(
    ".markdown-gallery:not(.markdown-gallery--single)"
  );

  galleries.forEach((gallery) => {
    if (gallery.dataset.equalHeightReady === "true") return;
    // A gallery is measured exactly once. This init runs from several
    // redundant entry points (the module's own `astro:page-load` plus each
    // page's `astro:page-load` / `DOMContentLoaded` / immediate call), and
    // without this lock every one of them re-armed `waitForMedia` and re-ran
    // the whole measure-and-apply pass. The flag is released inside
    // `equalizeGallery` whenever a pass can succeed nothing (nothing loaded
    // yet), so a later trigger can still try — but only ever one run at a time.
    if (gallery.dataset.equalHeightScheduled === "true") return;

    gallery.dataset.equalHeightScheduled = "true";

    // Decide whether we can measure right now. Images need their natural size
    // and videos need decoded metadata; embeds always have a usable ratio, so
    // they never make us wait. If anything still needs loading, force it and
    // equalize as soon as it resolves (or times out) — still all at load.
    const measurable = Array.from(
      gallery.querySelectorAll(".thumb-carousel-img, .thumb-carousel-video")
    ).every((el) => aspectOf(el) !== null);

    if (measurable) {
      // Media already sized — measure after a frame so layout is settled.
      requestAnimationFrame(() => equalizeGallery(gallery));
    } else {
      // Wait for media to expose dimensions, then run the single pass.
      waitForMedia(gallery).then(() => {
        requestAnimationFrame(() => equalizeGallery(gallery));
      });
    }
  });
}

/* ------------------------------------------------------------------
 * Re-init after every Astro client-side navigation
 * ------------------------------------------------------------------ */
document.addEventListener("astro:page-load", () => initGalleryEqualHeight());
