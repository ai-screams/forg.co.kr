/**
 * 2014-era chrome: the frame the exhibit sits in.
 *
 * Extracted from `src/app/page.tsx` so the board and post routes can wear
 * the same frame as the home page (`<EraShell>` in `era-shell.tsx`).
 * Nothing here fetches data — these are the rails, the sidebar, the header
 * and the counter strip, all reproduced from the 2014-12-18 capture.
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
import { type BoardId } from "@/lib/boards";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import type { Era } from "@/lib/era";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: Era = "2014";

interface MenuConfig {
  id: BoardId;
  asset: string;
  hoverAsset: string;
  label: string;
}

const TOP_MENU: MenuConfig[] = [
  {
    id: "UoBoard2",
    asset: "t_b_freeboard.gif",
    hoverAsset: "t_b_freeboard_1.gif",
    label: "자유게시판",
  },
  { id: "porato", asset: "t_b_photo.gif", hoverAsset: "t_b_photo_1.gif", label: "포토갤러리" },
  { id: "FunBoard", asset: "t_b_fun.gif", hoverAsset: "t_b_fun_1.gif", label: "펀보드" },
  { id: "Reveal", asset: "t_b_movie.gif", hoverAsset: "t_b_movie_1.gif", label: "스포일러게시판" },
  { id: "Boo", asset: "t_b_boo.gif", hoverAsset: "t_b_boo_1.gif", label: "뽐뿌" },
  { id: "Shop", asset: "t_b_tra.gif", hoverAsset: "t_b_tra_1.gif", label: "거래" },
  { id: "Trash", asset: "t_b_trash.gif", hoverAsset: "t_b_trash_1.gif", label: "휴지통게시판" },
];

// Labels and `title`s are the 2014-12-18 sidebar verbatim, including the
// leading dash the original used as its bullet.
const GAME_CATEGORIES: { id: BoardId; label: string; title: string }[] = [
  { id: "Ultima", label: "-울티마온라인", title: ":::UltimaOnline:::" },
  { id: "Diablo", label: "-디아블로3", title: ":::Diablo3:::" },
  { id: "DF", label: "-던전앤파이터", title: ":::DF Board:::" },
  { id: "LoL", label: "-리그오브레전드", title: ":::LoL:::" },
  { id: "Star2", label: "-스타크래프트2", title: ":::Starcraft2:::" },
  { id: "Console", label: "-콘솔게임", title: ":::XBOX,PS3,Wii,PSP:::" },
];

/** Static carry-over from the 2014-12-18 snapshot footer. HITL #3:
 *  keep faithful museum number, plug in live tracking later. */
const TOTAL_VISITORS = 52_916_713;

/* ──────────────────────────────────────────────────────────────────── */
/*  Site rails                                                            */
/* ──────────────────────────────────────────────────────────────────── */

export function LeftRail() {
  return <div className="bg-forg-slate hidden w-[10px] shrink-0 min-[800px]:block" />;
}

export function RightRail() {
  const bgUrl = chromeUrl("right_bg.gif", ERA);
  return (
    <div
      className="bg-forg-slate hidden w-[7px] shrink-0 min-[800px]:block"
      style={tileStyle(bgUrl, "repeat")}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Game category sidebar (100px)                                         */
/* ──────────────────────────────────────────────────────────────────── */

export function GameCategorySidebar() {
  const sidebarStyle = tileStyle(chromeUrl("left_bg.gif", ERA), "repeat");

  // The 2014 sidebar opened with an 86×2 rule, not a mascot: l_forg_logo.gif
  // appears only in frame-left-2007 and never in 2014-12-18.
  const barUrl = chromeUrl("l_bar.gif", ERA);

  return (
    <aside
      aria-label="게임 카테고리"
      className="hidden w-[100px] shrink-0 flex-col gap-[3px] bg-(--era-sidebar-bg) py-3 pl-[5px] text-(--era-sidebar-fg) min-[800px]:flex"
      style={sidebarStyle}
    >
      {barUrl && <LazyImg src={barUrl} alt="" width={86} height={2} className="block" />}
      <nav className="flex flex-col text-left text-[12px]">
        {GAME_CATEGORIES.map((cat, i) => (
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

/** The three sites forg's sidebar linked as family, verbatim from the
 *  2014-12-18 capture. All three are gone; the museum keeps the names. */
const FAMILY_SITES = ["Zeme", "Kritz", "Cindee"];

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
        options={["Family Site", null, ...FAMILY_SITES, null]}
        note={
          <>
            Family Site 목록: {FAMILY_SITES.join(", ")}. 세 사이트 모두 사라져 이동할 수 없습니다.
          </>
        }
        className="border-forg-ink/30 text-forg-ink/70 w-[88px] border bg-white text-[11px]"
      />
    </p>
  );
}

function SidebarSpacer({ height }: { height: number }) {
  const url = chromeUrl("blank_l_line.gif", ERA);
  if (!url) return <div style={{ height }} aria-hidden />;
  return <LazyImg src={url} alt="" width={86} height={height} className="block" />;
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
export function SiteHeader2014() {
  const logoUrl = chromeUrl("left_logo1.gif", ERA);
  const tLineUrl = chromeUrl("t_line.gif", ERA);

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
          {logoUrl ? (
            <LazyImg src={logoUrl} alt="forg.co.kr" width={100} height={42} />
          ) : (
            <span className="font-forg flex flex-col leading-tight">
              <span className="text-forg-ink text-base font-bold tracking-tight">forg.co.kr</span>
              <span className="text-forg-muted text-[10px]">Forg&apos;s World</span>
            </span>
          )}
        </Link>

        <LoginBar era={ERA} height={15} />

        <TBarRow era={ERA} />

        {/* No side padding: seven 80px buttons and the 20px cap fill the 580px
            cell exactly, as the original's left-floated images did. Padding
            pushed the cap 8px past the column edge. */}
        <MenuRow label="2014 상단 메뉴">
          {TOP_MENU.map((item) => (
            <MenuButton key={item.id} item={item} />
          ))}
          <MenuTailCap />
        </MenuRow>
      </div>
      <MobileMenu label="게임 카테고리">
        {GAME_CATEGORIES.map((cat) => (
          <Link key={cat.id} href={`/${cat.id}`} title={cat.title} className="block py-[6px]">
            {cat.label}
          </Link>
        ))}
      </MobileMenu>
      {tLineUrl && (
        <div aria-hidden className="h-[12px] w-full" style={tileStyle(tLineUrl, "repeat-x")} />
      )}
    </div>
  );
}

/**
 * `t_b_right.gif` — the 20×20 cap that closed the 2014 menu bar. It carried
 * `onclick="click_menu(9)"`, and `click_menu` has no branch for 9: the button
 * was already dead on the live site, so the museum draws it and nothing else.
 */
function MenuTailCap() {
  const url = chromeUrl("t_b_right.gif", ERA);
  if (!url) return null;
  return <LazyImg src={url} alt="" aria-hidden width={20} height={20} className="block shrink-0" />;
}

function MenuButton({ item }: { item: MenuConfig }) {
  const baseUrl = chromeUrl(item.asset, ERA);
  const hoverUrl = chromeUrl(item.hoverAsset, ERA);

  if (baseUrl) {
    // CSS-only hover swap via background-image overlay (SSG-safe).
    return (
      <Link
        href={`/${item.id}`}
        aria-label={item.label}
        className="group relative h-[20px] w-[80px] shrink-0 overflow-hidden"
        style={tileStyle(baseUrl, "no-repeat")}
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

  return (
    <Link
      href={`/${item.id}`}
      className="border-forg-gold/40 hover:bg-forg-gold/20 hover:border-forg-gold flex h-[20px] w-[80px] shrink-0 items-center justify-center border-b-2 bg-white text-[10px] font-bold transition-colors"
    >
      {item.label}
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Footer counter (24px)                                                 */
/* ──────────────────────────────────────────────────────────────────── */

export function VisitorCounter() {
  const bgUrl = chromeUrl("bgm_bg.gif", ERA);
  const rightUrl = chromeUrl("bgm_right.gif", ERA);

  return (
    <footer
      role="group"
      aria-label="누적 방문 (2014-12-18 기준 박제)"
      className="text-forg-cream bg-forg-bgm flex h-[24px] items-center justify-between pl-[15px] text-[11px]"
      style={tileStyle(bgUrl, "repeat-x")}
    >
      <span className="font-mono tabular-nums">Total : {TOTAL_VISITORS}</span>
      <span className="text-forg-cream/60 hidden text-[9px] sm:inline">
        2014-12-18 · 박물관 박제 · 후속 ADR 에서 라이브 카운터 검토
      </span>
      {rightUrl && (
        <LazyImg
          src={rightUrl}
          alt=""
          width={150}
          height={24}
          className="hidden h-[24px] w-auto sm:block"
        />
      )}
    </footer>
  );
}
