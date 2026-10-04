/**
 * 2003-era chrome: the frames the exhibit sits in (Zeroboard frameset).
 *
 * Faithful structural reconstruction of `frame-{top,left,main,bottom}-2003.html`
 * captures (forg.co.kr Wayback 2003-06-03). The original site used a real
 * HTML4 `<frameset>` with 4 child frames; we emulate the same visual
 * layout with modern CSS flex/grid because framesets are deprecated and
 * incompatible with React + Next.js static export.
 *
 * Layout (mirrors the Wayback render visible in `.docs/research/
 * era-screenshots/`):
 *
 *   ┌── frame-top ─────────────────────────────────────────────────────┐
 *   │  [forg-logo]                                  (clock) Login│Sign Up │
 *   │  Free Board · Question?! · UO.Roleplay · UO.Essay ·               │
 *   │  HouseInterior · ScreenShot · Kal Ort Por · (?)                   │
 *   ├──────────────┬──────────────────────┬────────────────────────────┤
 *   │ Information  │ "We Created World."  │  FreeBoard                 │
 *   │ -지침서      │  game artwork        │  · post …                  │
 *   │ -게시판      │                      │  UO.Roleplay               │
 *   │ ...          │ NOTICE - UO          │  · post …                  │
 *   │ Cooperation  │ · post                │  UO.Essay                  │
 *   │ -벤더광고란  │  Roleplay & Events    │  · post …                  │
 *   │ ...          │ · post                │  BestScreenShot            │
 *   │ Reminisce    │  Online News          │  [thumbnail]               │
 *   │ Forg.Board   │ · post                │                            │
 *   │ Friend Site  │                       │                            │
 *   ├──────────────┴──────────────────────┴────────────────────────────┤
 *   │  Copyright 1999-2002 Forg.                                        │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * `FrameTop2003`, `FrameLeft2003` and `FrameBottom2003` are the top, left
 * and bottom frames, worn by every route through `<EraShell>`; the main
 * frame's home content is `Home2003Content` in `home-2003.tsx`.
 *
 * Chrome assets come from `public/img/chrome/` (recovered from Wayback). The
 * one piece of this frame Wayback never kept, the BGM bar's `bgm_en.gif`
 * ENTER button, is drawn as a text button.
 */

import {
  InertJumpMenu,
  LoginBar,
  MenuRow,
  MobileMenu,
  TBarRow,
} from "@/components/chrome-primitives";
import Link from "@/components/link";

import { LazyImg } from "@/components/lazy-img";
import { chromeUrl, optionalChrome, tileStyle } from "@/lib/chrome";
import type { Era } from "@/lib/era";
import { SIDEBAR_2003, TOP_MENU_2003 } from "@/lib/era-menus";

/** Every asset on this surface is asked for at its 2003 capture. Without it
 *  the newest capture wins and the exhibit wears 2007 artwork — see
 *  `lib/chrome`. */
const ERA: Era = "2003";

/** Visitor total shown by frame-bottom-2003 on 2003-06-03. Frozen, like
 *  the 2014 counter's 52,916,713. */
const VISITORS_2003 = 3399428;

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — forg logo + small login/signup links + 7-button menu     */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameTop2003() {
  // frame-top-2003: `<table width="680">` with `<td width="100" height="37"
  // rowspan="3">` holding left_logo.gif (100×42 — the 2003 logo, distinct
  // from 2014's left_logo1.gif), then three 580px rows: the #FFC73B login
  // bar, a 4px t_bar.gif rule and the menu row of 80×20 buttons. 18+4+20
  // equals the logo height, so the art spans all three rows.
  const tLineUrl = chromeUrl("t_line.gif", ERA);

  return (
    <header>
      {/* `minmax(0,1fr)` + a scrolling menu row: see era-chrome-2014's header. */}
      <div className="grid grid-cols-[100px_minmax(0,1fr)] items-stretch">
        <Link
          href="/"
          aria-label="forg.co.kr 메인"
          className="row-span-3 flex items-start justify-start"
        >
          <LazyImg
            src={chromeUrl("left_logo.gif", ERA)}
            alt="Forg's World"
            width={100}
            height={42}
            className="block"
          />
        </Link>

        <LoginBar era={ERA} height={18} />

        <TBarRow era={ERA} />

        <MenuRow label="2003 상단 메뉴">
          {TOP_MENU_2003.map((item) => (
            <TopMenuButton2003 key={item.id} item={item} />
          ))}
          <span className="grow" />
          <FaqIcon2003 />
        </MenuRow>
      </div>
      <MobileMenu label="사이드바">
        {SIDEBAR_2003.map((section) => (
          <div key={section.label} className="col-span-2 mt-1">
            <p className="mb-[2px] text-[11px] font-bold tracking-wide text-forg-gold-hover">
              {section.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              {section.links.map((link) => (
                <Link key={link.label} href={link.href} className="block py-[5px]">
                  {link.label.replace(/^-/, "")}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </MobileMenu>
      {/* `<td width="680" height="12" background=t_line.gif bgcolor="#F1F1F2">` */}
      <div
        aria-hidden
        className="h-[12px] w-full bg-forg-menu"
        style={tileStyle(tLineUrl, "repeat-x")}
      />
    </header>
  );
}

function TopMenuButton2003({ item }: { item: (typeof TOP_MENU_2003)[number] }) {
  return (
    <Link
      href={`/${item.id}`}
      className="inline-block shrink-0 hover:bg-forg-gold/15"
      title={item.label}
    >
      {/* `mix-blend-mode: multiply` turns the GIF's opaque white background
         into the chrome bar's gray (white × gray = gray), so the buttons
         blend instead of floating as white tiles. */}
      <LazyImg
        src={chromeUrl(item.asset, ERA)}
        alt={item.label}
        width={80}
        height={20}
        className="block h-[20px] w-[80px]"
      />
      <span className="sr-only">{item.label}</span>
    </Link>
  );
}

function FaqIcon2003() {
  return (
    <span
      aria-label="Site FAQ (박물관 모드, 비활성)"
      title="Site FAQ"
      className="inline-block shrink-0 opacity-80"
    >
      <LazyImg
        src={chromeUrl("t_b_right.gif", ERA)}
        alt="Site FAQ"
        width={20}
        height={20}
        className="block h-[20px] w-[20px]"
      />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: left — Information / Cooperation / Reminisce / Forg.Board ...  */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameLeft2003() {
  // frameset cols="10, 100, 680, 7, 1*" and left_background.gif is 100×45.
  const tileUrl = chromeUrl("left_background.gif", ERA);
  return (
    <aside
      aria-label="2003 사이드바 — Information · Cooperation · Reminisce · Forg.Board · Friend Site"
      className="hidden w-[100px] shrink-0 bg-(--era-sidebar-bg) py-2 pl-[3px] text-(--era-sidebar-fg) frame:block"
      style={tileStyle(tileUrl, "repeat")}
    >
      <nav className="flex flex-col gap-2.5">
        {SIDEBAR_2003.map((section) => (
          <SidebarSection2003 key={section.label} section={section} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarSection2003({ section }: { section: (typeof SIDEBAR_2003)[number] }) {
  return (
    <div>
      <LazyImg
        src={chromeUrl(section.asset, ERA)}
        alt={section.label}
        width={100}
        height={25}
        className="mb-1 block h-[25px] w-[100px]"
      />
      {section.jumpMenu && (
        <p className="mb-1 pl-1">
          <InertJumpMenu
            id={section.jumpMenu.id}
            label={section.label}
            options={section.jumpMenu.options}
            sites={section.jumpMenu.options.filter((name) => name !== null)}
            className="border border-forg-ink/30 bg-white text-[11px] text-forg-ink/70"
          />
        </p>
      )}
      <ul className="space-y-[1px] pl-1">
        {section.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="block text-[10.5px] leading-tight text-white/85 hover:text-forg-gold-hover"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: bottom — copyright                                              */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameBottom2003() {
  // frame-bottom-2003, 24px per the frameset's `rows="53, 80%, 24"`, on
  // `bgcolor="6B82A5"` with bgm/bgm_bg.gif tiled. Four cells: count.gif
  // ("Total :", 50px) · the visitor number (70px, #fafafa) · ser.gif
  // ("SEARCH") with a 150px text input and an en.gif submit · bgm_right.gif
  // right-aligned. The frame also started a Shoutcast stream on load
  // (`onload="cast()"`, mulple.com), which is the "bgm" in the filenames;
  // the museum keeps the counter and the search and drops the music.
  const enUrl = optionalChrome("bgm_en.gif", ERA); // never captured

  return (
    <footer
      role="group"
      aria-label="누적 방문 (2003-06-03 기준 박제) · 검색"
      className="flex h-[24px] w-full shrink-0 items-center bg-forg-bgm text-[11px] text-forg-cream"
      style={tileStyle(chromeUrl("bgm_bg.gif", ERA), "repeat-x")}
    >
      <div className="flex h-[24px] w-[50px] shrink-0 items-end">
        <LazyImg
          src={chromeUrl("count.gif", ERA)}
          alt="Total :"
          width={50}
          height={24}
          className="block"
        />
      </div>
      <span className="w-[70px] shrink-0 pt-[6px] font-mono text-[11px] tabular-nums">
        {VISITORS_2003}
      </span>
      <form action="/search" method="get" className="flex h-[24px] grow items-center gap-[4px]">
        <LazyImg
          src={chromeUrl("bgm_ser.gif", ERA)}
          alt="SEARCH"
          width={50}
          height={24}
          className="block"
        />
        <input
          type="search"
          name="q"
          aria-label="검색어"
          placeholder="Forg's World"
          className="h-[17px] w-[150px] border border-(--era-input-border) bg-(--era-content-bg) px-1 text-[12px] text-forg-ink"
        />
        {enUrl ? (
          <button type="submit" className="block">
            <LazyImg src={enUrl} alt="ENTER" className="block" />
          </button>
        ) : (
          <button
            type="submit"
            className="h-[17px] border border-(--era-input-border) bg-(--era-page-bg)/30 px-1 text-[10px] font-bold text-forg-cream/90"
          >
            ENTER
          </button>
        )}
      </form>
      <LazyImg
        src={chromeUrl("bgm_right.gif", ERA)}
        alt=""
        width={150}
        height={24}
        className="hidden h-[24px] w-auto shrink-0 sm:block"
      />
    </footer>
  );
}
