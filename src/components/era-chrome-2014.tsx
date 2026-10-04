/**
 * 2014-era chrome, from the 2014-12-18 capture: `FrameTop2014` (logo, login
 * bar, seven-button menu), `FrameLeft2014` (the game-category sidebar) and
 * `FrameBottom2014` (the visitor counter strip). `<EraShell>` puts them
 * around every page; nothing here fetches data.
 *
 * Every dimension below is a value the original markup declares, not a
 * measurement of the artwork. The distinction matters: `t_bar.gif` is
 * 20×5 but sits in `<td height="4px">`, and getting that wrong pushes the
 * header rows out of alignment with the 42px logo.
 */

import { Fragment } from "react";

import Link from "@/components/link";

import {
  InertJumpMenu,
  LoginBar,
  MenuRow,
  MobileMenu,
  TBarRow,
} from "@/components/chrome-primitives";
import { LazyImg } from "@/components/lazy-img";
import { chromeUrl, optionalChrome, tileStyle } from "@/lib/chrome";
import type { Era } from "@/lib/era";
import { FAMILY_SITES_2014, GAME_CATEGORIES_2014, TOP_MENU_2014 } from "@/lib/era-menus";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: Era = "2014";

/** The 2014-12-18 footer's total, kept as the exhibit shows it. */
const TOTAL_VISITORS = 52_916_713;

/* ──────────────────────────────────────────────────────────────────── */
/*  Game category sidebar (100px)                                         */
/* ──────────────────────────────────────────────────────────────────── */

export function FrameLeft2014() {
  const sidebarStyle = tileStyle(chromeUrl("left_bg.gif", ERA), "repeat");

  return (
    <aside
      aria-label="게임 카테고리"
      className="hidden w-[100px] shrink-0 flex-col gap-[3px] bg-(--era-sidebar-bg) py-3 pl-[5px] text-(--era-sidebar-fg) frame:flex"
      style={sidebarStyle}
    >
      {/* The 2014 sidebar opened with an 86×2 rule, not a mascot: l_forg_logo.gif
          appears only in frame-left-2007 and never in 2014-12-18. */}
      <LazyImg src={chromeUrl("l_bar.gif", ERA)} alt="" width={86} height={2} className="block" />
      <nav className="flex flex-col text-left text-[12px]">
        {GAME_CATEGORIES_2014.map((cat, i) => (
          <Fragment key={cat.id}>
            {/* The original spaced these with blank_l_line.gif: 86×6 under the
                rule, 86×4 between entries. */}
            <SidebarSpacer height={i === 0 ? 6 : 4} />
            <Link
              href={`/${cat.id}`}
              title={cat.title}
              className="block leading-tight text-(--era-sidebar-link) hover:underline"
            >
              {cat.label}
            </Link>
          </Fragment>
        ))}
      </nav>
      <FamilySiteSelect />
    </aside>
  );
}

/**
 * The sidebar's Family Site menu. The original opened the chosen site in a
 * new window; ncity.net, kritz.mulple.com and daoc.mulple.com have all been
 * dead for years.
 */
function FamilySiteSelect() {
  return (
    <p className="mt-3">
      <InertJumpMenu
        id="family-site-note"
        label="Family Site"
        options={["Family Site", null, ...FAMILY_SITES_2014, null]}
        sites={FAMILY_SITES_2014}
        className="w-[88px] border border-forg-ink/30 bg-white text-[11px] text-forg-ink/70"
      />
    </p>
  );
}

function SidebarSpacer({ height }: { height: number }) {
  return (
    <LazyImg
      src={chromeUrl("blank_l_line.gif", ERA)}
      alt=""
      width={86}
      height={height}
      className="block"
    />
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Header (53px) — logo + login bar + 7-button menu                      */
/* ──────────────────────────────────────────────────────────────────── */

// Row heights come straight from the original: `<td height="18px">` gold
// login bar, `<td height="4px" background="t_bar.gif">`, then the menu row
// whose 80×20 buttons make it 20px. 18+4+20 = 42, exactly the height of
// left_logo1.gif — the logo art is drawn to span all three rows, its top
// edge #FFC73B and its bottom edge #F1F1F2. Any extra row height shows up
// as a white gap under the logo and breaks that blend.
export function FrameTop2014() {
  return (
    <div className="border-b border-(--era-input-border) bg-white">
      {/* `minmax(0,1fr)`: a plain `1fr` cannot shrink below the 580px menu row,
          which pushed a phone-width page to 680px. On a phone the menu row
          scrolls sideways instead; from 680px up it fits exactly as before.
          `contain:paint` on the row: without it mobile Chrome still sized
          the page to the 2003 row's 580px of buttons, scroller or not. */}
      <div className="grid grid-cols-[100px_minmax(0,1fr)] items-stretch">
        {/* `<td height="37px" width="100px" rowspan="3">` held the 100×42 logo
            with no padding. */}
        <Link href="/" className="row-span-3 flex items-start justify-start">
          <LazyImg
            src={chromeUrl("left_logo1.gif", ERA)}
            alt="forg.co.kr"
            width={100}
            height={42}
          />
        </Link>

        <LoginBar era={ERA} height={15} />

        <TBarRow era={ERA} />

        {/* No side padding: seven 80px buttons and the 20px cap fill the 580px
            cell exactly, as the original's left-floated images did. Padding
            pushed the cap 8px past the column edge. */}
        <MenuRow label="2014 상단 메뉴">
          {TOP_MENU_2014.map((item) => (
            <MenuButton key={item.id} item={item} />
          ))}
          <MenuTailCap />
        </MenuRow>
      </div>
      <MobileMenu label="게임 카테고리">
        {GAME_CATEGORIES_2014.map((cat) => (
          <Link key={cat.id} href={`/${cat.id}`} title={cat.title} className="block py-[6px]">
            {cat.label}
          </Link>
        ))}
      </MobileMenu>
      <div
        aria-hidden
        className="h-[12px] w-full"
        style={tileStyle(chromeUrl("t_line.gif", ERA), "repeat-x")}
      />
    </div>
  );
}

/**
 * `t_b_right.gif` — the 20×20 cap that closed the 2014 menu bar. It carried
 * `onclick="click_menu(9)"`, and `click_menu` has no branch for 9: the button
 * was already dead on the live site, so the museum draws it and nothing else.
 */
function MenuTailCap() {
  return (
    <LazyImg
      src={chromeUrl("t_b_right.gif", ERA)}
      alt=""
      aria-hidden
      width={20}
      height={20}
      className="block shrink-0"
    />
  );
}

function MenuButton({ item }: { item: (typeof TOP_MENU_2014)[number] }) {
  // Wayback kept three of the seven hover images (freeboard, boo, trash).
  const hoverUrl = optionalChrome(item.hoverAsset, ERA);
  // CSS-only hover swap via background-image overlay (SSG-safe).
  return (
    <Link
      href={`/${item.id}`}
      aria-label={item.label}
      className="group relative h-[20px] w-[80px] shrink-0 overflow-hidden"
      style={tileStyle(chromeUrl(item.asset, ERA), "no-repeat")}
    >
      {hoverUrl && (
        <span
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          style={tileStyle(hoverUrl, "no-repeat")}
        />
      )}
      <span className="sr-only">{item.label}</span>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Footer counter (24px)                                                 */
/* ──────────────────────────────────────────────────────────────────── */

export function FrameBottom2014() {
  return (
    <footer
      role="group"
      aria-label="누적 방문 (2014-12-18 기준 박제)"
      className="flex h-[24px] items-center justify-between bg-forg-bgm pl-[15px] text-[11px] text-forg-cream"
      style={tileStyle(chromeUrl("bgm_bg.gif", ERA), "repeat-x")}
    >
      <span className="font-mono tabular-nums">Total : {TOTAL_VISITORS}</span>
      <span className="hidden text-[9px] text-forg-cream/60 sm:inline">
        2014-12-18 기준 · 박물관 박제
      </span>
      <LazyImg
        src={chromeUrl("bgm_right.gif", ERA)}
        alt=""
        width={150}
        height={24}
        className="hidden h-[24px] w-auto sm:block"
      />
    </footer>
  );
}
