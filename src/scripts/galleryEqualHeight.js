/**
 * Gallery equal height.
 *
 * For multi-image blog slug galleries (`.markdown-gallery` without
 * `.markdown-gallery--single`), removes the fixed aspect-ratio constraint and
 * sets every card's image area to the height of the tallest rendered image or
 * video, so there is no letterboxing dead space.
 *
 * Works with both `<img>` and `<video>` elements inside `.thumb-carousel`.
 */

/**
 * Wait for all images and videos in a gallery to finish loading, then return
 * the list of media elements.
 */
function waitForMedia(gallery) {
  const images = Array.from(gallery.querySelectorAll(".thumb-carousel-img"));
  const videos = Array.from(gallery.querySelectorAll(".thumb-carousel-video"));
  const media = [...images, ...videos];

  return Promise.all(
    media.map((el) => {
      if (el.tagName === "VIDEO") {
        if (el.readyState >= 1) return Promise.resolve();
        return new Promise((resolve) => {
          el.addEventListener("loadeddata", resolve, { once: true });
          el.load();
        });
      } else {
        // img
        if (el.complete && el.naturalHeight > 0) return Promise.resolve();
        return new Promise((resolve, reject) => {
          el.addEventListener("load", resolve, { once: true });
          el.addEventListener("error", reject, { once: true });
        });
      }
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
  if (items.length <= 1) return;

  // Collect all media elements, wraps, carousel wrappers, and cards across the gallery
  const allMedia = [];
  const wraps = [];
  const carouselWrappers = [];
  const cards = [];

  items.forEach((item) => {
    const media = item.querySelector(".thumb-carousel-img, .thumb-carousel-video");
    const wrap = item.querySelector(".blog-card-image-wrap");
    const carouselWrapper = item.querySelector(".thumb-carousel-media");
    const card = item.querySelector(".gallery-thumb");
    if (media) allMedia.push(media);
    if (wrap) wraps.push(wrap);
    if (carouselWrapper) carouselWrappers.push(carouselWrapper);
    if (card) cards.push(card);
  });

  if (allMedia.length === 0) return;

  // STEP 1: Remove all CSS constraints so images render at their natural size
  // Clear themed backgrounds so no dead space color shows behind images
  wraps.forEach((wrap) => {
    wrap.style.setProperty("aspect-ratio", "unset", "important");
    wrap.style.setProperty("height", "auto", "important");
    wrap.style.setProperty("min-height", "0", "important");
    wrap.style.background = "transparent";
  });

  // Switch all media to object-fit: cover so they fill the wrap without dead space
  allMedia.forEach((el) => {
    el.style.objectFit = "cover";
    el.style.background = "transparent";
  });

  // Clear themed background on carousel wrapper divs
  carouselWrappers.forEach((wrapper) => {
    wrapper.style.background = "transparent";
  });

  // STEP 2: Force a reflow so the browser recalculates layout without constraints
  void gallery.offsetHeight;

  // STEP 3: Now measure each image's actual rendered height in its card
  // The image width is determined by the card width. The height is determined
  // by the image's natural aspect ratio since aspect-ratio is now unset.
  let maxHeight = 0;
  allMedia.forEach((el) => {
    const wrap = el.closest(".blog-card-image-wrap");
    if (!wrap) return;

    const wrapWidth = wrap.getBoundingClientRect().width;
    if (wrapWidth < 1) return;

    // Use natural dimensions for images, video dimensions for videos
    let naturalWidth, naturalHeight;
    if (el.tagName === "VIDEO") {
      naturalWidth = el.videoWidth;
      naturalHeight = el.videoHeight;
    } else {
      naturalWidth = el.naturalWidth;
      naturalHeight = el.naturalHeight;
    }

    if (!naturalWidth || !naturalHeight) return;

    // Calculate the height this image should have to fill the wrap width
    // without letterboxing, based on its natural aspect ratio
    const aspectRatio = naturalWidth / naturalHeight;
    const idealHeight = wrapWidth / aspectRatio;
    if (idealHeight > maxHeight) maxHeight = idealHeight;
  });

  if (maxHeight < 1) return;

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

    // Check if media is already loaded
    const images = Array.from(gallery.querySelectorAll(".thumb-carousel-img"));
    const videos = Array.from(gallery.querySelectorAll(".thumb-carousel-video"));
    const allLoaded =
      images.every((img) => img.complete && img.naturalHeight > 0) &&
      videos.every((v) => v.readyState >= 1);

    if (allLoaded) {
      // Media already loaded — measure after a frame so layout is settled
      requestAnimationFrame(() => equalizeGallery(gallery));
    } else {
      // Wait for media to load
      waitForMedia(gallery)
        .then(() => {
          requestAnimationFrame(() => equalizeGallery(gallery));
        })
        .catch(() => {
          // On error, still try to equalize with whatever is available
          requestAnimationFrame(() => equalizeGallery(gallery));
        });
    }
  });
}

/* ------------------------------------------------------------------
 * Re-init after every Astro client-side navigation
 * ------------------------------------------------------------------ */
document.addEventListener("astro:page-load", () => initGalleryEqualHeight());
