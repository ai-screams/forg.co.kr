// The era, without React: content pages ship no React runtime
// (scripts/postbuild/strip-react-runtime.mjs). src/app/layout.tsx inlines
// this at the top of every page with ERA_STORAGE_KEY and ERAS from
// src/lib/era.ts and FONTS_2026, so it runs before the page paints and
// before any era button can be clicked:
// - <html data-era> takes the saved era, so the page never shows the default
//   first (the pressed button's colour follows it, src/styles/eras.css);
// - a click on an era button (<EraToggle>, [data-era-option]) switches and
//   saves the era, and another tab's change arrives as a storage event;
// - aria-pressed follows, once the buttons exist; when the button pressed
//   hides with the era it left (a 2026 note, the 2026 bar, the museum bar on
//   a phone), keyboard focus moves to a pressed button that shows, or to the
//   summary of the closed fold that holds one;
// - while the era is 2026 the page links its fonts (public/fonts/2026/2026.css,
//   FONTS_2026 with its version), once: no other era fetches them, and the
//   link stays when the era changes again;
// - the first page a visitor opens (no era saved, the hint never shown) shows
//   the hint under the era buttons (<EraHint>, `html.forg-era-hint-on`) and
//   remembers it was shown, so no later page does; on that page, closing it,
//   opening a fold of era buttons (which it would cover) or choosing an era
//   takes it down, in every tab;
// - a fold (<EraFold>, the 2026 bar's `.w26-pop`) closes once an era is
//   chosen from it, on Escape (focus back on its summary) and on a tap
//   outside it.
var root = document.documentElement;
var HINT = "forg-era-hint-on";
var OPEN_FOLDS = ".forg-era-fold[open], .w26-pop[open]";

function press() {
  var era = root.getAttribute("data-era");
  document.querySelectorAll("button[data-era-option]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.getAttribute("data-era-option") === era));
  });
}

function fonts() {
  if (root.getAttribute("data-era") !== "2026" || document.querySelector("link[data-fonts-2026]")) {
    return;
  }
  var link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", FONTS_2026);
  link.setAttribute("data-fonts-2026", "");
  document.head.appendChild(link);
}

// A browser without checkVisibility (Safari before 17.4) is taken to show
// everything: focus then stays where the click left it.
function visible(element) {
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}

function focusEra() {
  var pressed = document.querySelectorAll('button[data-era-option][aria-pressed="true"]');
  for (var i = 0; i < pressed.length; i++) {
    var details = pressed[i].closest("details");
    var target = visible(pressed[i]) ? pressed[i] : details && details.querySelector("summary");
    if (target && visible(target)) {
      target.focus();
      return;
    }
  }
}

function show(era) {
  root.setAttribute("data-era", era);
  fonts();
  press();
}

try {
  var saved = localStorage.getItem(ERA_STORAGE_KEY);
  if (ERAS.indexOf(saved) >= 0) root.setAttribute("data-era", saved);
  fonts();
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
  // A tap outside an open fold closes it; one on its own summary is left to
  // close it itself.
  document.querySelectorAll(OPEN_FOLDS).forEach(function (fold) {
    if (!fold.contains(target)) fold.open = false;
  });
  if (target && target.closest("[data-era-hint-close]")) {
    root.classList.remove(HINT);
    // The button is gone; keyboard focus goes back to the buttons it was about.
    focusEra();
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
  var fold = button.closest(OPEN_FOLDS);
  if (fold) fold.open = false;
  if (!visible(button)) focusEra();
});

// `toggle` does not bubble: caught on its way down.
document.addEventListener(
  "toggle",
  function (event) {
    if (event.target.matches(OPEN_FOLDS)) root.classList.remove(HINT);
  },
  true,
);

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  var active = document.activeElement;
  document.querySelectorAll(OPEN_FOLDS).forEach(function (fold) {
    fold.open = false;
    if (fold.contains(active)) fold.querySelector("summary").focus();
  });
});

window.addEventListener("storage", function (event) {
  if (event.key !== ERA_STORAGE_KEY) return;
  root.classList.remove(HINT);
  if (ERAS.indexOf(event.newValue) >= 0) show(event.newValue);
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", press);
else press();
