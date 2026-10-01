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

import { Fragment, type ReactNode } from "react";

import Link from "@/components/link";

import { type BoardId } from "@/lib/boards";
import { chromeUrl, type ChromeEra } from "@/lib/chrome";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: ChromeEra = "2014";

export interface MenuConfig {
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
export const TOTAL_VISITORS = 52_916_713;

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
      style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundRepeat: "repeat" } : undefined}
    />
  );
}

export function AdSenseColumn() {
  // `<td width="*" bgcolor="61748b">` held a 120×600 AdSense unit. A
  // non-commercial museum shows neither an ad nor a sign advertising its
  // absence, and to a 2014 visitor with a blocker this column *was* plain
  // slate. Keeping the column matters: it is what makes the 680px content
  // read as a narrow band rather than a centred page.
  return <aside aria-hidden className="bg-forg-slate hidden flex-1 lg:block" />;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Game category sidebar (100px)                                         */
/* ──────────────────────────────────────────────────────────────────── */

export function GameCategorySidebar() {
  const sidebarStyle = chromeUrl("left_bg.gif", ERA)
    ? {
        backgroundImage: `url(${chromeUrl("left_bg.gif", ERA)})`,
        backgroundRepeat: "repeat",
      }
    : undefined;

  // The 2014 sidebar opened with an 86×2 rule, not a mascot: l_forg_logo.gif
  // appears only in frame-left-2007 and never in 2014-12-18.
  const barUrl = chromeUrl("l_bar.gif", ERA);

  return (
    <aside
      aria-label="게임 카테고리"
      className="hidden w-[100px] shrink-0 flex-col gap-[3px] bg-(--era-sidebar-bg) py-3 pl-[5px] text-(--era-sidebar-fg) min-[800px]:flex"
      style={sidebarStyle}
    >
      {barUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, 53 B rule
        <img src={barUrl} alt="" width={86} height={2} className="block" />
      )}
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
 * The sidebar's `<select onchange="namosw_goto_byselect(…)">`. The original
 * opened the chosen site in a new window; ncity.net, kritz.mulple.com and
 * daoc.mulple.com have all been dead for years, so this one renders the same
 * control with nothing behind it — the same treatment Login / Sign Up get.
 */
function FamilySiteSelect() {
  return (
    <p className="mt-3">
      {/* `disabled` takes the control out of the tab order, so the reason it
          is dead has to live in the accessibility tree, not just `title`. */}
      {/* The names are repeated here because a disabled control is out of the
          tab order: this keeps what the sidebar preserved — the three site
          names — reachable even when the select itself is not. */}
      <span id="family-site-note" className="sr-only">
        Family Site 목록: {FAMILY_SITES.join(", ")}. 세 사이트 모두 사라져 이동할 수 없습니다.
      </span>
      <select
        aria-label="Family Site"
        aria-describedby="family-site-note"
        title="박물관 모드 — 연결된 사이트가 모두 사라졌습니다"
        disabled
        defaultValue="Family Site"
        className="border-forg-ink/30 text-forg-ink/70 w-[88px] border bg-white text-[11px]"
      >
        <option>Family Site</option>
        <option disabled>---------</option>
        {FAMILY_SITES.map((name) => (
          <option key={name}>{name}</option>
        ))}
        <option disabled>---------</option>
      </select>
    </p>
  );
}

function SidebarSpacer({ height }: { height: number }) {
  const url = chromeUrl("blank_l_line.gif", ERA);
  if (!url) return <div style={{ height }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- static export, 49 B spacer
  return <img src={url} alt="" width={86} height={height} className="block" />;
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
  const tBarUrl = chromeUrl("t_bar.gif", ERA);
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
            // eslint-disable-next-line @next/next/no-img-element -- static export, ~3 KB GIF, no LCP cost
            <img src={logoUrl} alt="forg.co.kr" width={100} height={42} />
          ) : (
            <span className="font-forg flex flex-col leading-tight">
              <span className="text-forg-ink text-base font-bold tracking-tight">forg.co.kr</span>
              <span className="text-forg-muted text-[10px]">Forg&apos;s World</span>
            </span>
          )}
        </Link>

        <div className="bg-forg-gold flex h-[18px] items-center justify-end gap-[2px] px-2 text-[10px]">
          <InertChrome asset="t_login.gif" label="Login" title="박물관 모드 — 로그인 비활성" />
          <InertChrome asset="t_sign.gif" label="Sign Up" title="박물관 모드 — 회원가입 비활성" />
        </div>

        <div
          className="bg-forg-gold h-[4px] w-full"
          style={
            tBarUrl
              ? { backgroundImage: `url(${tBarUrl})`, backgroundRepeat: "repeat-x" }
              : undefined
          }
        />

        {/* No side padding: seven 80px buttons and the 20px cap fill the 580px
            cell exactly, as the original's left-floated images did. Padding
            pushed the cap 8px past the column edge. */}
        <div className="relative min-w-0">
          <nav
            aria-label="2014 상단 메뉴"
            className="bg-forg-menu flex h-[20px] items-center overflow-x-auto overflow-y-hidden [contain:paint] [scrollbar-width:none]"
          >
            {TOP_MENU.map((item) => (
              <MenuButton key={item.id} item={item} />
            ))}
            <MenuTailCap />
          </nav>
          <ScrollFade />
        </div>
      </div>
      <MobileMenu label="게임 카테고리">
        {GAME_CATEGORIES.map((cat) => (
          <Link key={cat.id} href={`/${cat.id}`} title={cat.title} className="block py-[6px]">
            {cat.label}
          </Link>
        ))}
      </MobileMenu>
      {tLineUrl && (
        <div
          aria-hidden
          className="h-[12px] w-full"
          style={{
            backgroundImage: `url(${tLineUrl})`,
            backgroundRepeat: "repeat-x",
          }}
        />
      )}
    </div>
  );
}

/**
 * On a screen narrower than the 580px menu row, a fade on its right edge says
 * the row scrolls. Not part of the original, which never met a phone.
 */
export function ScrollFade() {
  return (
    <span
      aria-hidden
      className="from-forg-menu pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent min-[680px]:hidden"
    />
  );
}

/**
 * Below 800px the sidebar is gone; its links fold into a "메뉴" bar under the
 * header, in the sidebar's own colours. A `<details>`, so it works without
 * JavaScript. The museum's own addition — forg had no mobile layout.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group bg-(--era-sidebar-bg) text-(--era-sidebar-fg) min-[800px]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] font-bold [&::-webkit-details-marker]:hidden">
        <span>메뉴 · {label}</span>
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-x-4 px-3 pb-3 text-[13px] text-(--era-sidebar-link)">
        {children}
      </div>
    </details>
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
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 20×20 chrome
    <img src={url} alt="" aria-hidden width={20} height={20} className="block shrink-0" />
  );
}

/** A recovered chrome button the museum deliberately does not wire up. */
function InertChrome({ asset, label, title }: { asset: string; label: string; title: string }) {
  const url = chromeUrl(asset, ERA);
  if (!url) {
    return (
      <span
        aria-disabled
        title={title}
        className="text-forg-ink/80 rounded-sm bg-white/60 px-2 py-[1px] text-[10px] font-bold uppercase select-none"
      >
        {label}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 70×15 chrome
    <img src={url} alt={label} title={title} width={70} height={15} className="block" />
  );
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
        className="forg-2014-menu group relative h-[20px] w-[80px] shrink-0 overflow-hidden"
        style={{
          backgroundImage: `url(${baseUrl})`,
          backgroundRepeat: "no-repeat",
        }}
      >
        {hoverUrl && (
          <span
            aria-hidden
            className="absolute inset-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
            style={{
              backgroundImage: `url(${hoverUrl})`,
              backgroundRepeat: "no-repeat",
            }}
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

export function VisitorCounter({ total }: { total: number }) {
  const bgUrl = chromeUrl("bgm_bg.gif", ERA);
  const rightUrl = chromeUrl("bgm_right.gif", ERA);

  return (
    <footer
      role="contentinfo"
      aria-label="누적 방문 (2014-12-18 기준 박제)"
      className="text-forg-cream bg-forg-bgm flex h-[24px] items-center justify-between pl-[15px] text-[11px]"
      style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundRepeat: "repeat-x" } : undefined}
    >
      <span className="font-mono tabular-nums">Total : {total}</span>
      <span className="text-forg-cream/60 hidden text-[9px] sm:inline">
        2014-12-18 · 박물관 박제 · 후속 ADR 에서 라이브 카운터 검토
      </span>
      {rightUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, decorative footer chrome
        <img
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
