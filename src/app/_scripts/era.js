// The era, without React: content pages ship no React runtime
// (scripts/postbuild/strip-react-runtime.mjs). src/app/layout.tsx inlines
// this at the top of every page with ERA_STORAGE_KEY and ERAS from
// src/lib/era.ts, so it runs before the page paints and before any era
// button can be clicked:
// - <html data-era> takes the saved era, so the page never shows the default
//   first (the pressed button's colour follows it, src/styles/eras.css);
// - a click on an era button (<EraToggle>, [data-era-option]) switches and
//   saves the era, and another tab's change arrives as a storage event;
// - aria-pressed follows, once the buttons exist;
// - the first page a visitor opens (no era saved, the hint never shown) shows
//   the hint under the era buttons (<EraHint>, `html.forg-era-hint-on`) and
//   remembers it was shown, so no later page does; on that page, closing it
//   or choosing an era takes it down, in every tab.
var root = document.documentElement;
var HINT = "forg-era-hint-on";

function press() {
  var era = root.getAttribute("data-era");
  document.querySelectorAll("button[data-era-option]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.getAttribute("data-era-option") === era));
  });
}

function show(era) {
  root.setAttribute("data-era", era);
  press();
}

try {
  var saved = localStorage.getItem(ERA_STORAGE_KEY);
  if (ERAS.indexOf(saved) >= 0) root.setAttribute("data-era", saved);
  if (saved === null && localStorage.getItem(ERA_HINT_KEY) === null) {
    localStorage.setItem(ERA_HINT_KEY, "shown");
    root.classList.add(HINT);
  }
} catch {
  // private mode and the like: the default era stays, and no hint that
  // could not remember being shown
}

document.addEventListener("click", function (event) {
  var target = event.target instanceof Element ? event.target : null;
  if (target && target.closest("[data-era-hint-close]")) {
    root.classList.remove(HINT);
    // The button is gone; keyboard focus goes back to the buttons it was about.
    var pressed = document.querySelector('button[data-era-option][aria-pressed="true"]');
    if (pressed) pressed.focus();
  }
  var button = target ? target.closest("button[data-era-option]") : null;
  if (!button) return;
  root.classList.remove(HINT);
  var era = button.getAttribute("data-era-option");
  try {
    localStorage.setItem(ERA_STORAGE_KEY, era);
  } catch {
    // private mode and the like: the choice lasts for this page only
  }
  show(era);
});

window.addEventListener("storage", function (event) {
  if (event.key !== ERA_STORAGE_KEY) return;
  root.classList.remove(HINT);
  if (ERAS.indexOf(event.newValue) >= 0) show(event.newValue);
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", press);
else press();
