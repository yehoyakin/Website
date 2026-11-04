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

/* HOVER COOLDOWN.

   The handle is a normal control and gets the site hover (a short grow), so
   sliding the panel at the same moment made the two transforms fight: the
   handle was still growing as the rail left its hiding position, and still
   shrinking as it went back, which clipped the edge that was crossing the
   window. These delays let the pointer settle before the rail moves, and give
   it a moment to be re-entered on the way out without flickering. */
const OPEN_DELAY_MS = 140;
const CLOSE_DELAY_MS = 240;

/* FORGIVING HOVER TARGET.

   The scroll icon is the trigger, but the pointer should not have to land on
   the glyph itself: a band this wide around the handle counts as hovering it,
   so approaching the tab from the page side opens the panel instead of asking
   for a pixel-perfect hit. Once the panel is out, the whole rail counts, so
   crossing from the icon onto the content never reads as a leave. */
const HOVER_PAD_PX = 24;

/** Pointer-only affordance: on touch a tap fires `mouseenter` before `click`,
 *  so the hover handlers would instantly undo the tap's toggle. */
const canHover = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const handleFor = (rail) => rail.querySelector("[data-rail-handle]");

/* Pending hover timers, per rail: { open, close }. A map keeps them off the
   DOM and lets `closeOpenRails` cancel another rail's queued open before two
   panels can appear at once. */
const pending = new WeakMap();

/* The last pointer position, so a queued hover move can be re-tested against
   where the tab actually is when it is about to run. */
let lastPointer = null;

function clearTimer(rail, kind) {
  const timers = pending.get(rail);
  if (!timers || timers[kind] === undefined) return;
  clearTimeout(timers[kind]);
  delete timers[kind];
  if (timers.open === undefined && timers.close === undefined) pending.delete(rail);
}

function cancelPending(rail) {
  clearTimer(rail, "open");
  clearTimer(rail, "close");
}

function hasTimer(rail, kind) {
  return pending.get(rail)?.[kind] !== undefined;
}

function schedule(rail, kind, run) {
  /* One timer of each kind per rail. Re-scheduling the same kind replaces it;
     the opposite kind is left alone, because `clearTimer` is what cancels a
     queued move. */
  clearTimer(rail, kind);
  const timers = pending.get(rail) ?? {};
  timers[kind] = window.setTimeout(() => {
    delete timers[kind];
    if (timers.open === undefined && timers.close === undefined) pending.delete(rail);
    run();
  }, kind === "open" ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  pending.set(rail, timers);
}

function setOpen(rail, open) {
  rail.classList.toggle(OPEN_CLASS, open);
  handleFor(rail)?.setAttribute("aria-expanded", String(open));
}

function openRail(rail) {
  cancelPending(rail);
  closeOpenRails(rail);
  setOpen(rail, true);
}

function closeRail(rail) {
  cancelPending(rail);
  setOpen(rail, false);
}

function closeOpenRails(except = null) {
  document.querySelectorAll("[data-rail]").forEach((rail) => {
    if (rail === except) return;
    /* Also drop a queued open/close, so a panel that is on its way out does not
       come back after another one has taken the screen. */
    cancelPending(rail);
    if (rail.classList.contains(OPEN_CLASS)) setOpen(rail, false);
  });
}

function withinRect(x, y, rect, pad) {
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

/* Closed, the tab is what calls the panel out (plus its margin); open, the
   whole rail keeps it, because the pointer is on the content by then. */
function nearHandle(rail, pointer) {
  const handle = handleFor(rail);
  return handle
    ? withinRect(pointer.x, pointer.y, handle.getBoundingClientRect(), HOVER_PAD_PX)
    : false;
}

function nearRail(rail, pointer) {
  /* The rail's own box is only the handle: the panel is positioned against it
     (styles/chrome/sideRails.css), so it has to be measured on its own — the
     pointer is on the panel's content once the rail is open. */
  const panel = rail.querySelector(".rail-panel");
  const handle = handleFor(rail);

  return [panel, handle].some(
    (node) =>
      node &&
      withinRect(pointer.x, pointer.y, node.getBoundingClientRect(), HOVER_PAD_PX),
  );
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
      if (rail.classList.contains(OPEN_CLASS)) closeRail(rail);
      else openRail(rail);
    });

    // Keyboard focus is engagement too, and should not wait.
    rail.addEventListener("focusin", () => openRail(rail));
  });
}

attach();

/* HOVER IS MEASURED BY PROXIMITY, NOT BY `mouseenter`.

   The handle is a small tab, so the pointer gets a margin: anywhere within
   HOVER_PAD_PX of it counts as hovering the icon. One document listener does
   the measuring for every rail instead of one listener per node — the router
   swaps rails in and out, and a handler bound to a node would outlive it. */
if (canHover()) {
  document.addEventListener(
    "pointermove",
    (event) => {
      const { clientX: x, clientY: y } = event;
      lastPointer = { x, y };

      document.querySelectorAll("[data-rail]").forEach((rail) => {
        if (rail.dataset.railReady !== "true") return;
        const handle = handleFor(rail);
        if (!handle) return;

        const open = rail.classList.contains(OPEN_CLASS);
        const inside = open
          ? nearRail(rail, { x, y })
          : nearHandle(rail, { x, y });

        if (inside) {
          // Re-entry cancels a queued close before it can flicker.
          clearTimer(rail, "close");
          if (!open && !hasTimer(rail, "open")) {
            schedule(rail, "open", () => {
              /* The tab slides while the panel closes, so the pointer can pass
                 over it on the way out without meaning to come back. Test
                 where the tab actually is when the timer fires, not where it
                 was when it was queued. */
              if (nearHandle(rail, lastPointer ?? { x, y })) openRail(rail);
            });
          }
          return;
        }

        if (open && !hasTimer(rail, "close")) {
          schedule(rail, "close", () => {
            if (!nearRail(rail, lastPointer ?? { x, y })) closeRail(rail);
          });
        }
      });
    },
    { passive: true },
  );

  // A pointer that leaves the window is a leave `pointermove` never reports.
  document.documentElement.addEventListener("pointerleave", () => {
    lastPointer = null;
    document.querySelectorAll("[data-rail]").forEach((rail) => {
      if (rail.dataset.railReady !== "true") return;
      if (!rail.classList.contains(OPEN_CLASS)) return;
      if (!hasTimer(rail, "close")) schedule(rail, "close", () => closeRail(rail));
    });
  });
}

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
