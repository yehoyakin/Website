/**
 * Socials panel hook.
 *
 * Drives the floating tab in `components/sections/ContactPanel.astro`: tap or
 * hover the chainlink handle to slide the panel in, tap anywhere else to close
 * it. The panel itself is styled by Tailwind utilities in that component, keyed
 * off the `socials-open` class toggled here.
 *
 * Why this is a script and not an inline handler in the component: the markup
 * is replaced on every client-side navigation, so the listeners have to be
 * re-bound to the new elements. Astro only re-runs module scripts on a full
 * page load, so this hook re-attaches itself after each `astro:after-swap`.
 *
 * Markup contract:
 *   #socials-container  — the sliding wrapper, receives `socials-open`
 *   #socials-toggle     — the handle that opens/closes it
 */

let boundContainer = null;

/** Pointer-only affordance: on touch, a tap fires `mouseenter` before `click`,
 *  so the hover handlers would instantly undo the tap's toggle. */
function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function onToggle(event) {
  event.stopPropagation();
  boundContainer?.classList.toggle("socials-open");
}

function onPointerEnter() {
  boundContainer?.classList.add("socials-open");
}

function onPointerLeave() {
  boundContainer?.classList.remove("socials-open");
}

function onDocumentClick(event) {
  if (!boundContainer?.contains(event.target)) {
    boundContainer?.classList.remove("socials-open");
  }
}

function detach() {
  if (!boundContainer) return;

  const container = boundContainer;
  const toggle = container.querySelector("#socials-toggle");

  toggle?.removeEventListener("click", onToggle);
  container.removeEventListener("mouseenter", onPointerEnter);
  container.removeEventListener("mouseleave", onPointerLeave);
  document.removeEventListener("click", onDocumentClick);

  boundContainer = null;
}

function attach() {
  const container = document.getElementById("socials-container");
  if (!container || container === boundContainer) return;

  detach();
  boundContainer = container;

  container
    .querySelector("#socials-toggle")
    ?.addEventListener("click", onToggle);

  if (canHover()) {
    container.addEventListener("mouseenter", onPointerEnter);
    container.addEventListener("mouseleave", onPointerLeave);
  }

  document.addEventListener("click", onDocumentClick);
}

attach();

document.addEventListener("astro:after-swap", attach);
