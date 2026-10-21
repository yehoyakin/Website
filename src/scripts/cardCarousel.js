/**
 * Card carousel.
 *
 * Turns a horizontally scrolling strip into a one-card-at-a-time carousel.
 * Swiping/dragging stays native (the strip keeps its `overflow-x` and gains
 * CSS scroll-snap in `styles/base/responsive.css`); this script only adds and
 * syncs the controls — prev/next arrows plus position dots — because the
 * browser scrollbar is hidden.
 *
 * Runs at every screen width. On wide screens the CSS caps the slide width so
 * a card cannot stretch to the whole viewport (see `--carousel-slide`).
 *
 * The controls wrap: prev from the first slide moves to the last one and next
 * from the last moves back to the first, so neither arrow ever runs out of
 * places to go and neither is ever disabled.
 *
 * Markup contract (all optional except `data-carousel` + the track):
 *   <div data-carousel data-carousel-item=".slide" data-carousel-label="Projects">
 *     <div data-carousel-track>
 *       <div class="slide">...</div>
 *     </div>
 *   </div>
 */

/* Motion settings. `SCROLL_DURATION` is deliberately in the same range as the
   site's other transitions — native `behavior: "smooth"` picks its own,
   browser-defined duration, which is what made the arrows feel sluggish. */
const SCROLL_DURATION_MS = 360;
const MEASURE_DEBOUNCE_MS = 120;

/** A slide is a fraction of the strip's width, so geometry is stable between
 *  resizes; remeasuring is only needed when the strip itself changes size. */
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initStrip(scroller) {
  if (scroller.dataset.carouselReady === "true") return;

  const track = scroller.querySelector("[data-carousel-track]");
  if (!track) return;

  const itemSelector = scroller.dataset.carouselItem;
  const getItems = () =>
    itemSelector
      ? Array.from(track.querySelectorAll(`:scope > ${itemSelector}`))
      : Array.from(track.children);

  const items = getItems();

  // A single card has nothing to rotate through.
  if (items.length <= 1) return;

  scroller.dataset.carouselReady = "true";

  /* ---------------------------------------------------------
   * Controls
   * --------------------------------------------------------- */

  const controls = document.createElement("div");
  controls.className = "card-carousel-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute(
    "aria-label",
    scroller.dataset.carouselLabel || "Carousel navigation",
  );

  // Crisp SVG chevrons rather than text glyphs. Text arrows render with
  // whatever font ends up applied, which the pixel themes turn into odd or
  // missing shapes; the SVG is the same on every platform. Square caps keep
  // the corners sharp, matching the site's no-border-radius look.
  const ARROW_PATHS = {
    prev: "M15 6 9 12 15 18",
    next: "M9 6 15 12 9 18",
  };

  const makeArrow = (label, direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-carousel-arrow";
    button.setAttribute("aria-label", label);
    button.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter" ` +
      `aria-hidden="true" focusable="false">` +
      `<path d="${ARROW_PATHS[direction]}" /></svg>`;
    return button;
  };

  const prev = makeArrow("Previous slide", "prev");
  const next = makeArrow("Next slide", "next");

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "card-carousel-dots";

  // -1 rather than 0: it makes the first `sync()` write the initial dot state
  // instead of early-returning as if nothing had changed.
  let current = -1;

  const dots = items.map((_item, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "card-carousel-dot";
    dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
    dot.addEventListener("click", () => goTo(index));
    dotsWrap.appendChild(dot);
    return dot;
  });

  controls.append(prev, dotsWrap, next);

  // Sits right after the strip, before any expandable panels.
  scroller.insertAdjacentElement("afterend", controls);

  /* ---------------------------------------------------------
   * Geometry — measured from rects so it does not depend on
   * which ancestor happens to be each item's offsetParent.
   *
   * Measured on demand instead of per scroll frame: offsets are relative to
   * the scrolling content, so they do not change as the strip scrolls. The
   * old per-frame version read a rect per card on every frame, which forced a
   * layout each time the user dragged the strip.
   * --------------------------------------------------------- */

  let metrics = [];
  let viewportWidth = 0;

  function measure() {
    const scrollRect = scroller.getBoundingClientRect();
    viewportWidth = scroller.clientWidth;

    metrics = items.map((item) => {
      const rect = item.getBoundingClientRect();
      const left = rect.left - scrollRect.left + scroller.scrollLeft;

      return {
        left,
        width: rect.width,
        center: left + rect.width / 2,
      };
    });
  }

  const offsetFor = (index) => {
    const position = metrics[index];
    if (!position) return 0;

    return position.left - (viewportWidth - position.width) / 2;
  };

  /* ---------------------------------------------------------
   * Movement — rAF with a cubic ease-out
   * --------------------------------------------------------- */

  let scrollFrame = 0;

  function stopScrollAnimation() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    scroller.classList.remove("is-carousel-animating");
  }

  function animateScrollTo(target, duration = SCROLL_DURATION_MS) {
    // Also drops `is-carousel-animating`, so an interrupted run can never
    // leave scroll snapping switched off.
    stopScrollAnimation();

    const start = scroller.scrollLeft;
    const distance = target - start;

    if (!distance || prefersReducedMotion()) {
      scroller.scrollLeft = target;
      return;
    }

    /* `scroll-snap-stop: always` + a mandatory snap axis makes the browser
       pull a programmatic scroll back to the slide it started on, so snapping
       is suspended for the duration of the animation. The animation lands
       exactly on a snap point, which makes turning it back on a no-op. */
    scroller.classList.add("is-carousel-animating");

    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // easeOutCubic — fast start, long settle. Same feel as the site's
      // hover/reveal easing, and it covers the distance in 360ms instead of
      // however long the browser's built-in smooth scroll decides to take.
      const eased = 1 - Math.pow(1 - progress, 3);

      scroller.scrollLeft = start + distance * eased;

      if (progress < 1) {
        scrollFrame = requestAnimationFrame(step);
      } else {
        stopScrollAnimation();
      }
    };

    scrollFrame = requestAnimationFrame(step);
  }

  function goTo(index) {
    const count = items.length;
    if (!count) return;

    // Wrap around, in both directions: -1 -> last, count -> 0.
    const target = ((index % count) + count) % count;

    animateScrollTo(offsetFor(target));
  }

  function sync() {
    if (!metrics.length) return;

    const viewCenter = scroller.scrollLeft + viewportWidth / 2;

    let best = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < metrics.length; i++) {
      const distance = Math.abs(metrics[i].center - viewCenter);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    if (best === current) return;
    current = best;

    dots.forEach((dot, index) => {
      dot.setAttribute("aria-current", index === current ? "true" : "false");
    });
  }

  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));

  /* ---------------------------------------------------------
   * Track position while the user swipes
   * --------------------------------------------------------- */

  let frame = 0;

  scroller.addEventListener(
    "scroll",
    () => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    },
    { passive: true },
  );

  // A drag or a wheel gesture means the user is driving: drop any in-flight
  // arrow animation instead of letting the two fight over scrollLeft.
  ["pointerdown", "touchstart", "wheel"].forEach((type) => {
    scroller.addEventListener(type, stopScrollAnimation, { passive: true });
  });

  /* ---------------------------------------------------------
   * Re-measure when the strip changes size (rotation, resize,
   * layout shifts) and re-centre the active slide
   * --------------------------------------------------------- */

  let measureTimer = 0;

  function refresh({ realign = true } = {}) {
    stopScrollAnimation();
    measure();
    if (realign) scroller.scrollLeft = offsetFor(current < 0 ? 0 : current);
    sync();
  }

  function scheduleRefresh() {
    window.clearTimeout(measureTimer);

    measureTimer = window.setTimeout(() => {
      refresh({ realign: false });
    }, MEASURE_DEBOUNCE_MS);
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(measureTimer);

    measureTimer = window.setTimeout(() => {
      // Keep the active slide centred after the slide width changes.
      refresh();
    }, MEASURE_DEBOUNCE_MS);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleRefresh).observe(track);
  }

  // No forced scroll here: on a back/forward navigation the browser restores
  // the strip's previous position, and `sync()` reads that position to set the
  // active dot.
  measure();
  sync();

  return { sync, goTo };
}

export function initCardCarousels(root = document) {
  root.querySelectorAll("[data-carousel]").forEach(initStrip);
}

/* -------------------------------------------------------------------------
 * Re-init after every Astro navigation
 * -------------------------------------------------------------------------
 * Page scripts run once per document, so the second time a listing is shown
 * (back/forward, or any client-side navigation) the router swaps in the
 * server markup — which has no controls — and nothing rebuilds them. The
 * listener is registered as soon as this module loads and stays for the life
 * of the document, so whichever page imported it can rebuild the controls of
 * every carousel that comes into view afterwards. `initStrip` sets
 * `data-carousel-ready`, so the pages' own load-time call is not repeated. */

document.addEventListener("astro:page-load", () => initCardCarousels());
