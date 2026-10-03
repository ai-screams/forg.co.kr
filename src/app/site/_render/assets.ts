/**
 * What `/site/` documents carry besides the archived page (ETL Stage 2g): the
 * museum bar's CSS, the scripts and CSS for features the originals had, the
 * narrow-screen reflow, and the doctype of each rendering mode. Inserted into
 * the HTML verbatim by `document.ts`.
 */

import type { SitePage } from "@/lib/site-pages";

// `!important` throughout: the archived page's own CSS follows this block and
// must not be able to restyle or hide the bar (rules naming it are also
// dropped by the ETL).
export const BAR_CSS = `
#forg-museum-bar{font:12px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif!important;
background:#2b2b2b!important;color:#eee!important;padding:4px 10px!important;display:flex!important;
flex-wrap:wrap!important;gap:4px 12px!important;align-items:center!important;visibility:visible!important}
#forg-museum-bar a{color:#ffc73b!important;text-decoration:underline!important}
#forg-museum-bar b{color:#ffc73b!important}
#forg-museum-bar select{font:inherit!important;color:#222!important;background:#eee!important;border:1px solid #888!important;margin:0 0 0 4px!important;padding:0 2px!important;width:auto!important;height:auto!important}
html.in-frame #forg-museum-bar{display:none!important}`;

export const IN_FRAME_SCRIPT =
  "if(window.top!==window.self)document.documentElement.className+=' in-frame';";

// Namo WebEditor's jump menus (`namosw_goto_byselect`), kept by the ETL as
// `<select data-goto>`: choosing an option opens its URL where the original
// did — this frame (`self`), the frame around it (`parent`) or the named
// window `win1` (`blank`). Header and separator options carry no `value` and do
// nothing, where the original would have tried to open their text.
export const GOTO_SCRIPT = `document.querySelectorAll("select[data-goto]").forEach(function(s){
s.addEventListener("change",function(){var o=s.options[s.selectedIndex];
if(!o.hasAttribute("value"))return;
var t=s.getAttribute("data-goto");
if(t==="blank")window.open(o.value,"win1");else(t==="parent"?window.parent:window).location.href=o.value;});});`;

// The "Catalog*******" pop-up list on the Diablo item and UO skill guides
// (`font#combos` + `div#myDIV`, "FlatStyle PopUp ComboList" in their script).
// The page hid the list with `visibility=hidden`, which is not CSS and is
// dropped, and its margins (`margin-left:-125px`) put it left of the Catalog
// box, so it showed open, over the text. Here it opens under the Catalog box
// on hover, tap or focus and closes on leaving it, as the script's
// mouseover/mouseout handlers did. Moving from the box down into the list
// leaves one and enters the other in the same pointer move, so it stays open.
// Focus moving from the box into the list keeps it open (a link in a hidden
// list could not take the focus), and the list itself takes the focus when
// clicked between its links. A mouse leaving does not close a list opened
// from the keyboard. A press anywhere else closes it (a pen hover or an
// iPhone tap may move no focus); so do Tab past it and Escape, which puts
// the focus back on the box. A resize moves an open list under the box again.
// Every page with the list is in quirks mode, where the page's own rules give
// the colours. As an inline block the box takes `.combo{width:120px}`, and
// border-box sizing (IE's) makes the box and the list both 120px wide. The
// list's `height:10` would draw a 10px box with the links spilling out (IE
// grew a box to its content). Chromium reads the box's `cursor:hand` in
// quirks mode, Firefox does not. The box is drawn as a flat combo box: its
// label ("Catalog", 02g drops the asterisks that padded it) on the left, an
// arrow cell on the right that turns the links' orange while the list is
// open. Without script the class is never set and the list stays visible.
export const COMBO_HEAD_SCRIPT = "document.documentElement.className+=' forg-combo';";
export const COMBO_CSS = `#combos{display:inline-block;box-sizing:border-box;cursor:pointer;position:relative;text-align:left;padding-left:6px}
#combos::before{content:"";position:absolute;top:0;bottom:0;right:14px;border-left:1px solid #666}
#combos::after{content:"";position:absolute;right:3px;top:50%;margin-top:-2px;border:4px solid transparent;border-top-color:#666;border-bottom:0}
#combos[aria-expanded=true]::after{border-top-color:#ef5900}
#myDIV{box-sizing:border-box;height:auto}
html.forg-combo #myDIV{visibility:hidden}
html.forg-combo #myDIV.forg-open{visibility:visible}`;
export const COMBO_SCRIPT = `(function(){var c=document.getElementById("combos"),m=document.getElementById("myDIV");
c.tabIndex=0;m.tabIndex=-1;c.setAttribute("role","button");c.setAttribute("aria-controls","myDIV");c.setAttribute("aria-expanded","false");
function show(){var r=c.getBoundingClientRect();m.style.left="0px";m.style.top="0px";var o=m.getBoundingClientRect();
m.style.left=(r.left-o.left)+"px";m.style.top=(r.bottom-o.top)+"px";m.classList.add("forg-open");c.setAttribute("aria-expanded","true");}
function hide(){m.classList.remove("forg-open");c.setAttribute("aria-expanded","false");}
[c,m].forEach(function(e){
e.addEventListener("pointerenter",show);
e.addEventListener("pointerleave",function(v){if(v.pointerType==="mouse"&&!document.querySelector("#combos:focus-visible,#myDIV :focus-visible"))hide();});
e.addEventListener("focusin",show);
e.addEventListener("focusout",function(v){if(!m.contains(v.relatedTarget))hide();});});
document.addEventListener("pointerdown",function(v){if(!c.contains(v.target)&&!m.contains(v.target))hide();});
document.addEventListener("keydown",function(v){if(v.key!=="Escape")return;if(m.contains(document.activeElement))c.focus();hide();});
window.addEventListener("resize",function(){if(m.classList.contains("forg-open"))show();});})();`;

// An image Wayback never kept fills the slot the page gave it, in the
// placeholder's own colours, so a column of menu buttons keeps its rhythm
// (the 64×48 picture alone left a small icon in a blank 110×20 slot). One
// that had alt text, or a button whose link names its page, is a box with
// those words instead (02g). The box sits on the baseline as the picture did
// (an inline block that hides its overflow has its bottom edge as its
// baseline), with its words centred by a line height of the slot's (02g).
export const PLACEHOLDER_CSS = `img[data-recovery="missing"]{background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;object-fit:contain}
.forg-missing{display:inline-block;text-align:center;box-sizing:border-box;max-width:100%;padding:0 2px;overflow:hidden;white-space:nowrap;vertical-align:baseline;background:#f5f1e8;outline:1px dashed #a89e85;outline-offset:-1px;color:#6b614b;font:bold 11px/1.2 Verdana,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}`;

// The archived documents are fixed-width table layouts (630px and up, some
// over 2000px) made for a desktop window, and forg had no mobile site to be
// faithful to. On a phone they are reflowed: tables, cells and images give up
// their fixed widths and fit the screen (`nowrap` cells wrap), absolutely
// placed blocks (the town maps cut into layers) stack, and long words
// break. From 800px up the page is exactly the original. A document in a
// frame keeps its layout at any width: the frame sets it (the 2003
// frameset's columns are 100 and 680px wide), not the phone.
export const VIEWPORT = "width=device-width, initial-scale=1";
export const NARROW_CSS = `@media (max-width:799px){
html:not(.in-frame) body{margin:8px!important;min-width:0!important}
html:not(.in-frame) table{width:100%!important;max-width:100%!important;height:auto!important}
html:not(.in-frame) td,html:not(.in-frame) th{width:auto!important;height:auto!important;white-space:normal!important}
html:not(.in-frame) img{max-width:calc(100vw - 16px)!important;height:auto!important}
html:not(.in-frame) [style*="position:absolute"],html:not(.in-frame) [style*="position: absolute"]{position:static!important;width:auto!important;height:auto!important}
body *{overflow-wrap:break-word;word-break:break-word}
}`;

// A doctype that puts the browser in the mode it drew the capture in (02g,
// RENDERING MODE): none for quirks mode, as most of the originals had none.
export const DOCTYPE: Record<SitePage["mode"], string> = {
  quirks: "",
  "limited-quirks":
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  "no-quirks": "<!doctype html>",
};
