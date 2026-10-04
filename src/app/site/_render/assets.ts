/**
 * What `/site/` documents carry besides the archived page (ETL Stage 2g): the
 * museum bar's CSS, the scripts and CSS for features the originals had, the
 * narrow-screen reflow, and the doctype of each rendering mode. Inserted into
 * the HTML verbatim by `document.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { SitePage } from "@/lib/site-pages";

/**
 * The longer pieces are files in `assets/`, read once at build. They go into
 * every document byte for byte, so Prettier leaves them alone (formatting
 * them would change all 1,256 documents); ESLint still checks the scripts.
 */
const ASSETS = path.join(process.cwd(), "src", "app", "site", "_render", "assets");
// Line endings as a template literal had them: LF, whatever the checkout.
const read = (file: string) =>
  readFileSync(path.join(ASSETS, file), "utf8").replaceAll("\r\n", "\n");

// `!important` throughout: the archived page's own CSS follows this block and
// must not be able to restyle or hide the bar (rules naming it are also
// dropped by the ETL).
export const BAR_CSS = read("bar.css");

export const IN_FRAME_SCRIPT =
  "if(window.top!==window.self)document.documentElement.className+=' in-frame';";

// Namo WebEditor's jump menus (`namosw_goto_byselect`), kept by the ETL as
// `<select data-goto>`: choosing an option opens its URL where the original
// did — this frame (`self`), the frame around it (`parent`) or the named
// window `win1` (`blank`). Header and separator options carry no `value` and do
// nothing, where the original would have tried to open their text.
export const GOTO_SCRIPT = read("goto.js");

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
export const COMBO_CSS = read("combo.css");
export const COMBO_SCRIPT = read("combo.js");

// An image Wayback never kept fills the slot the page gave it, in the
// placeholder's own colours, so a column of menu buttons keeps its rhythm
// (the 64×48 picture alone left a small icon in a blank 110×20 slot). One
// that had alt text, or a button whose link names its page, is a box with
// those words instead (02g). The box sits on the baseline as the picture did
// (an inline block that hides its overflow has its bottom edge as its
// baseline), with its words centred by a line height of the slot's (02g).
export const PLACEHOLDER_CSS = read("placeholder.css");

// The archived documents are fixed-width table layouts (630px and up, some
// over 2000px) made for a desktop window, and forg had no mobile site to be
// faithful to. On a phone they are reflowed: tables, cells and images give up
// their fixed widths and fit the screen (`nowrap` cells wrap), absolutely
// placed blocks (the town maps cut into layers) stack, and long words
// break. From 800px up the page is exactly the original. A document in a
// frame keeps its layout at any width: the frame sets it (the 2003
// frameset's columns are 100 and 680px wide), not the phone.
export const VIEWPORT = "width=device-width, initial-scale=1";
export const NARROW_CSS = read("narrow.css");

// What the reflow leaves wider than the screen (a quarter of the documents
// at 390px) is a table of several columns: a picture capped at the screen's
// width beside a column of menu buttons, or a main page's three columns.
// Images keep the screen as their cap rather than their cell so that a 110px
// button is not squeezed to 49px (a picture capped by its cell adds nothing
// to its column's minimum width). Below 800px the script measures the page
// after the reflow. If it is wider than the screen, images wider than 120px
// shrink with their cells (`forg-fit-shrink`), which fits a map beside its
// menu at the text's own size. Shrinking is undone when it leaves an image
// of 300px or less (a heading, a button) under 60% of its size, as on the
// three-column pages. Whatever is still too wide is the document, not the
// museum bar, scaled down to the screen's width with its layout kept. The
// page is measured once it is parsed, before its images arrive (an image
// that sets the layout carries its width), again once every image has
// loaded or failed, and when the screen's width changes. A failed image is
// drawn at its width attribute and does not shrink with its cell, so a page
// that fitted by shrinking needs the zoom after all (PR previews have no
// images; a phone may block them).
// The documents in the museum's frames (`diablo`, `uo`, `wow`, `holy/index`,
// all fixed-width columns) fit their frames, so there is no frame exception.
export const FIT_SCRIPT = read("fit.js");

// A doctype that puts the browser in the mode it drew the capture in (02g,
// RENDERING MODE): none for quirks mode, as most of the originals had none.
export const DOCTYPE: Record<SitePage["mode"], string> = {
  quirks: "",
  "limited-quirks":
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  "no-quirks": "<!doctype html>",
};
