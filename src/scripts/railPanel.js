/**
 * Rail panels.
 *
 * One behaviour for every right-edge panel: the contacts tab on the landing and
 * the links tab on a blog post (components/shared/RailPanel.astro). Those two
 * used to carry separate handlers — scripts/socialsHook.js for one, an inline
 * block in pages/blog/[slug].astro for the other — and had already drifted
 * apart: only the contacts panel peeked on hover, only one of them updated
 * `aria-expanded`, and each kept its own document click listener.
 *
 * Collapsed, only the handle is on screen: the panel waits off-canvas, one
 * handle width inside the window. It slides out while the reader is engaged
 * with it — hover with a pointer, tap on a touch screen, focus from a keyboard —
 * and slides back the moment they are not, so it can never sit over the page.
 *
 * Markup contract:
 *   [data-rail]          the sliding wrapper; receives `is-open`
 *   [data-rail-handle]   the tab that opens / pins it
 *   #<id>-panel          the panel itself (for aria-controls)
 */

const OPEN_CLASS = "is-open";

/** Pointer-only affordance: on touch a tap fires `mouseenter` before `click`,
 *  so the hover handlers would instantly undo the tap's toggle. */
const canHover = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const handleFor = (rail) => rail.querySelector("[data-rail-handle]");

function setOpen(rail, open) {
  rail.classList.toggle(OPEN_CLASS, open);
  handleFor(rail)?.setAttribute("aria-expanded", String(open));
}

function closeOpenRails(except = null) {
  document.querySelectorAll(`[data-rail].${OPEN_CLASS}`).forEach((rail) => {
    if (rail !== except) setOpen(rail, false);
  });
}

function attach(root = document) {
  root.querySelectorAll("[data-rail]").forEach((rail) => {
    // The router swaps markup in, so a fresh node arrives without listeners.
    if (rail.dataset.railReady === "true") return;

    const handle = handleFor(rail);
    if (!handle) return;
    rail.dataset.railReady = "true";

    // Tap / click selects the panel: it stays out until something else is
    // clicked (or Escape), which is what a touch screen can offer.
    handle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !rail.classList.contains(OPEN_CLASS);
      closeOpenRails(rail);
      setOpen(rail, open);
    });

    // Hover peeks it out and puts it away again on the way out.
    if (canHover()) {
      rail.addEventListener("mouseenter", () => {
        closeOpenRails(rail);
        setOpen(rail, true);
      });
      rail.addEventListener("mouseleave", () => setOpen(rail, false));
    }

    // Keyboard focus is engagement too.
    rail.addEventListener("focusin", () => {
      closeOpenRails(rail);
      setOpen(rail, true);
    });
  });
}

attach();

// Astro only runs a module once per document, so the panels of every page after
// the first have to be picked up by the router's own lifecycle events.
document.addEventListener("astro:page-load", () => attach());
document.addEventListener("astro:after-swap", () => attach());

// Engagement anywhere outside the rail ends the selection.
document.addEventListener("click", (event) => {
  document.querySelectorAll(`[data-rail].${OPEN_CLASS}`).forEach((rail) => {
    if (!rail.contains(event.target)) setOpen(rail, false);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeOpenRails();
});
