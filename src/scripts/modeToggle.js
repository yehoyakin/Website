/**
 * Day / night switch hook.
 *
 * Drives `components/shared/ModeToggle.astro`: every click flips
 * `data-mode` on <html> between "day" and "night", and the choice is stored
 * under `time-mode` so the next visit (and the next page, thanks to the inline
 * script in MyLayout.astro) starts in the same mode.
 *
 * Before the visitor ever clicks, there is nothing stored: the first visit
 * follows the OS colour-scheme preference (`prefers-color-scheme: dark`). The
 * same resolution runs in the inline head script, so both agree.
 *
 * The click listener is delegated from `document` because Astro's ClientRouter
 * replaces the button on every navigation, while module scripts only run once
 * per full page load. `astro:after-swap` re-applies the attribute in case the
 * swapped-in <html> element dropped it.
 *
 * Markup contract:
 *   #mode-toggle — the button; gets aria-pressed / aria-label / title updated
 */

const STORAGE_KEY = "time-mode";

/** The visitor's explicit choice, or null before they ever use the toggle. */
function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "night" || stored === "day" ? stored : null;
  } catch {
    /* Storage blocked (private mode, embedded webview). */
    return null;
  }
}

function prefersNight() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Stored choice wins; a first visit follows the OS colour scheme. */
function resolveMode() {
  return readStoredMode() ?? (prefersNight() ? "night" : "day");
}

function storeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* Not being able to remember the choice must not break the switch. */
  }
}

function applyMode(mode) {
  const isNight = mode === "night";
  document.documentElement.dataset.mode = isNight ? "night" : "day";

  const button = document.getElementById("mode-toggle");
  if (!button) return;

  const label = isNight ? "Switch to day mode" : "Switch to night mode";
  button.setAttribute("aria-pressed", String(isNight));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function onDocumentClick(event) {
  const button = event.target.closest?.("#mode-toggle");
  if (!button) return;

  const next =
    document.documentElement.dataset.mode === "night" ? "day" : "night";
  applyMode(next);
  storeMode(next);
}

document.addEventListener("click", onDocumentClick);
document.addEventListener("astro:after-swap", () => applyMode(resolveMode()));

applyMode(resolveMode());
