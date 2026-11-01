/**
 * Desktop-view request.
 *
 * The site LAYS OUT AT THE DEVICE WIDTH by default, so a phone gets the phone
 * rules: full-width columns, phone type sizes, stacked cards. That is the right
 * default, and it is what most sites do.
 *
 * Some visitors want the old fixed-width page anyway. This hook is that
 * request: one control in the chrome rail switches `<html>` to the desktop
 * layout, and swapping the viewport meta is what actually does it —
 * `width=1280` makes a phone lay the page out at 1280px and scale it down,
 * exactly like the site behaved before the responsive pass.
 *
 * The choice is remembered under `site-view`, and an inline script in
 * MyLayout.astro applies it before first paint so a returning desktop-view
 * visitor never sees the mobile layout flash past.
 *
 * A viewport change only re-lays out reliably when the document is reloaded
 * (iOS Safari reuses the current layout otherwise), so the click reloads.
 *
 * Markup contract:
 *   #view-toggle — the button; gets aria-pressed / aria-label / title updated
 */

const STORAGE_KEY = "site-view";

/** What the page is laid out against: the device, or a fixed 1280px. */
const VIEWPORT = {
  mobile: "width=device-width, initial-scale=1, viewport-fit=cover",
  desktop: "width=1280, shrink-to-fit=yes",
};

function readView() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "desktop" ? "desktop" : "mobile";
  } catch {
    /* Storage blocked: the default layout is always available. */
    return "mobile";
  }
}

function storeView(view) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    /* Not being able to remember the choice must not break the control. */
  }
}

/** Reflects the view in the document, the viewport meta and the control. */
function applyView(view) {
  const isDesktop = view === "desktop";

  document.documentElement.dataset.view = isDesktop ? "desktop" : "mobile";

  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.setAttribute("content", isDesktop ? VIEWPORT.desktop : VIEWPORT.mobile);

  const button = document.getElementById("view-toggle");
  if (!button) return;

  /* The label names what the button DOES, like the day / night switch. */
  const label = isDesktop ? "Switch to mobile view" : "Switch to desktop view";
  button.setAttribute("aria-pressed", String(isDesktop));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function onDocumentClick(event) {
  const button = event.target.closest?.("#view-toggle");
  if (!button) return;

  const next = readView() === "desktop" ? "mobile" : "desktop";
  storeView(next);
  applyView(next);

  /* Reload so the browser lays the page out against the new viewport. */
  window.location.reload();
}

document.addEventListener("click", onDocumentClick);
document.addEventListener("astro:after-swap", () => applyView(readView()));

applyView(readView());
