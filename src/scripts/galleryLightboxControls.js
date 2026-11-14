/**
 * Gallery lightbox controls.
 *
 * The enlarged view used to be image-only: any click closed it and the only way
 * to reach another picture was the keyboard arrow keys. It now carries the same
 * navigator the gallery strip has — prev / next arrows through the rest of that
 * gallery's media, the strip's numbered position index, and a close button — so
 * a pointer can browse the enlarged view without leaving it.
 *
 * The buttons are the site's own themed gradient plate (`.retro-link.pixel-frame`
 * plus `data-link-theme`), exactly the recipe scripts/cardCarousel.js builds for
 * the strip's arrows and numbered index, and the direction / close glyphs are
 * text like those arrows are. The index is the strip's own component class for
 * class (`card-carousel-dots` / `card-carousel-dot`), so a lightbox counter is
 * the same row of numbered squares, with the current one wearing the same white
 * `aria-current` ring. scripts/galleryPanelShell.css sizes and places them with
 * the carousel's own `--gallery-nav-size` token, so the enlarged view's controls
 * sit at the same scale as the ones under the strip.
 *
 * The overlay closes on any click (the page scripts bind that), so every button
 * stops its click from reaching that handler.
 *
 * Markup contract:
 *   lightbox    — the `[data-gallery-lightbox]` overlay
 *   count       — how many media items this gallery holds
 *   onSelect    — jump to an index (the numbered squares)
 *   onPrev/onNext/onClose — the page's own move / close functions
 *
 * Returns `{ setIndex }`: the page calls it whenever the visible media changes,
 * so the numbered square's selected ring follows the arrows, the keys and the
 * media currently on screen.
 */

const NAV_BUTTON = "retro-link pixel-frame";

const makeArrow = (modifier, label, glyph) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `blog-gallery-lightbox__nav blog-gallery-lightbox__nav--${modifier} ${NAV_BUTTON}`;
  button.setAttribute("data-link-theme", "");
  button.setAttribute("aria-label", label);
  button.textContent = glyph;
  return button;
};

export function buildLightboxControls(
  lightbox,
  { count = 0, onSelect, onPrev, onNext, onClose } = {},
) {
  if (!lightbox || lightbox.querySelector(".blog-gallery-lightbox__controls")) return;

  const controls = document.createElement("div");
  controls.className = "blog-gallery-lightbox__controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Gallery navigation");

  // Black pointing triangles as text — the same left / right reading the
  // strip's arrows carry.
  const prev = makeArrow("prev", "Previous media", "\u25C4");
  const next = makeArrow("next", "Next media", "\u25BA");

  /* THE COUNTER — the strip's numbered index, class for class. One square per */
     /* media item, the 1-based position as its label, and the selected one is */
     /* marked by `aria-current` exactly as scripts/cardCarousel.js marks it, */
     /* so the same stylesheet rule draws the same white pixel ring. */
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "blog-gallery-lightbox__dots card-carousel-dots";

  const dots = Array.from({ length: count }, (_entry, index) => {
    const square = document.createElement("button");
    square.type = "button";
    square.className = `card-carousel-dot ${NAV_BUTTON}`;
    square.setAttribute("data-link-theme", "");
    square.setAttribute("aria-label", `Go to media ${index + 1}`);
    square.setAttribute("aria-current", "false");
    square.textContent = String(index + 1);
    square.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect?.(index);
    });
    dotsWrap.appendChild(square);
    return square;
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = `blog-gallery-lightbox__close ${NAV_BUTTON}`;
  close.setAttribute("data-link-theme", "");
  close.setAttribute("aria-label", "Close preview");
  close.textContent = "\u2715";

  /* A gallery with one item has nowhere to go, so it gets the close button */
     /* only — the same rule the strip's navigator follows. */
  if (count > 1) {
    controls.append(prev, next);
    lightbox.append(dotsWrap);
  }

  // The overlay's click-anywhere handler also has to stay away from a press
  // that starts on a control, or the overlay would close on it.
  [prev, next, close].forEach((button) => {
    button.addEventListener("click", (event) => event.stopPropagation());
  });

  prev.addEventListener("click", () => onPrev?.());
  next.addEventListener("click", () => onNext?.());
  close.addEventListener("click", () => onClose?.());

  lightbox.append(controls, close);

  const setIndex = (index) => {
    dots.forEach((square, position) => {
      square.setAttribute("aria-current", position === index ? "true" : "false");
    });
  };

  return { setIndex };
}
