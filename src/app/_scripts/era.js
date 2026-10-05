// The era, without React: content pages ship no React runtime
// (scripts/postbuild/strip-react-runtime.mjs). src/app/layout.tsx inlines
// this at the top of every page with ERA_STORAGE_KEY and ERAS from
// src/lib/era.ts, so it runs before the page paints and before any era
// button can be clicked:
// - <html data-era> takes the saved era, so the page never shows the default
//   first (the pressed button's colour follows it, src/styles/eras.css);
// - a click on an era button (<EraToggle>, [data-era-option]) switches and
//   saves the era, and another tab's change arrives as a storage event;
// - aria-pressed follows, once the buttons exist.
var root = document.documentElement;

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
} catch {
  // private mode and the like: the default era stays
}

document.addEventListener("click", function (event) {
  var button =
    event.target instanceof Element ? event.target.closest("button[data-era-option]") : null;
  if (!button) return;
  var era = button.getAttribute("data-era-option");
  try {
    localStorage.setItem(ERA_STORAGE_KEY, era);
  } catch {
    // private mode and the like: the choice lasts for this page only
  }
  show(era);
});

window.addEventListener("storage", function (event) {
  if (event.key === ERA_STORAGE_KEY && ERAS.indexOf(event.newValue) >= 0) show(event.newValue);
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", press);
else press();
