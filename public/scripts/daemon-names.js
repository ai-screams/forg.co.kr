// <DaemonName>'s behaviour (src/components/daemon-name.tsx): content pages
// ship no React (scripts/postbuild/strip-react-runtime.mjs), so a guest's
// name on these boards is server markup, `<span data-daemon={seed}>`, and
// this draws a fresh name for it on every view, as the board did. One draw
// per seed: a post's or comment's copies (the phone list, the 2014/2003
// table, the 2001 skin) keep one name.
//
// The names forg's 초보자게시판 (Newbie) and 휴지통 (Trash) boards showed for
// a non-member: one of Ultima Online's daemon names, drawn again on every
// view. The same comment carries a different one in each capture (Newbie
// 490: "Nebirots", then "Molech").
//
// The list is every name the captures show where a comment's name changed
// between two captures. It covers every non-member name on the two boards —
// posts, comments and list rows, 2002–2016 — so it is taken to be the whole
// of the original list.
(function () {
  var NAMES = [
    "Aamon",
    "Agalierept",
    "Agares",
    "Aglasis",
    "Aiwaz",
    "Astaroth",
    "Ayperos",
    "Azatoth",
    "Azmodaeus",
    "Azrael",
    "Ba'al",
    "Baal",
    "Barbatos",
    "Bathim",
    "Bathsin",
    "Be'elzebub",
    "Be'elzebubba",
    "Bechard",
    "Beechard",
    "Beelzebuth",
    "Botis",
    "Brulefer",
    "Bucon",
    "Buer",
    "Clauneck",
    "Clitheret",
    "Cthulhu",
    "Eleogap",
    "Eliezer",
    "Eligor",
    "Faraii",
    "Fleurety",
    "Frimost",
    "Frucissiere",
    "Fruitimiere",
    "Guland",
    "Gusoyn",
    "Hael",
    "Haristum",
    "Heramael",
    "Hiepacth",
    "Huictiigara",
    "Humots",
    "Khil",
    "Marbas",
    "Mersilde",
    "Minoson",
    "Molech",
    "Moloch",
    "Morail",
    "Moroch",
    "Musisin",
    "Naberrs",
    "Nebiros",
    "Nebirots",
    "Nyarlathotep",
    "Pentagnony",
    "Proculo",
    "Pruslas",
    "Pursan",
    "Rofocale",
    "Sargatans",
    "Satanchia",
    "Satanciae",
    "Segal",
    "Sergulath",
    "Sergutthy",
    "Sirchade",
    "Starr",
    "Surgat",
    "Sustugriel",
    "Tarchimache",
    "Tarihimal",
    "Trimasel",
    "Vaelfar",
    "Wormius",
    "Zoray",
    "a cacodaemon",
    "a daemon",
  ];

  function draw() {
    var drawn = Object.create(null);
    document.querySelectorAll("[data-daemon]").forEach(function (el) {
      var seed = el.getAttribute("data-daemon");
      if (!(seed in drawn)) drawn[seed] = NAMES[Math.floor(Math.random() * NAMES.length)];
      el.textContent = drawn[seed];
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else draw();
})();
