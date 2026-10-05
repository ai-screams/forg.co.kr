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

// The shown era's chrome loads eagerly. Every <img> is lazy so that the
// hidden eras' art (display: none) is never fetched, but Safari makes a lazy
// picture wait for its viewport check even when it is cached (WebKit PR
// 67352), so the header, buttons and sidebar art blinked on every reload. As
// the parser adds them, lazy pictures outside the hidden eras' containers
// turn eager; the hidden eras' stay lazy. Only <LazyImg> is lazy, and it
// draws only chrome and skin art.
var era = root.getAttribute("data-era");
var hidden = ERAS.filter(function (e) {
  return e !== era;
})
  .map(function (e) {
    return ".era-" + e + "-only";
  })
  .concat(".era-not-" + era)
  .join(",");

function wake(img) {
  if (img.loading === "lazy" && !img.closest(hidden)) img.loading = "eager";
}

var parsing = new MutationObserver(function (records) {
  records.forEach(function (record) {
    record.addedNodes.forEach(function (node) {
      if (node.nodeName === "IMG") wake(node);
      else if (node.querySelectorAll) node.querySelectorAll("img").forEach(wake);
    });
  });
});
parsing.observe(root, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", function () {
  parsing.disconnect();
});
