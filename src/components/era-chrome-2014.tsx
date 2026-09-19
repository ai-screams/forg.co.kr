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

export const TOP_MENU: MenuConfig[] = [
  {
    id: "UoBoard2",
    asset: "t_b_freeboard.gif",
    hoverAsset: "t_b_freeboard_1.gif",
    label: "자유게시판",
  },
  { id: "porato", asset: "t_b_photo.gif", hoverAsset: "t_b_photo_1.gif", label: "포토갤러리" },
  { id: "FunBoard", asset: "t_b_fun.gif", hoverAsset: "t_b_fun_1.gif", label: "펀게시판" },
  { id: "Reveal", asset: "t_b_movie.gif", hoverAsset: "t_b_movie_1.gif", label: "스포일러" },
  { id: "Boo", asset: "t_b_boo.gif", hoverAsset: "t_b_boo_1.gif", label: "검색·문서함" },
  { id: "Shop", asset: "t_b_tra.gif", hoverAsset: "t_b_tra_1.gif", label: "거래" },
  { id: "Trash", asset: "t_b_trash.gif", hoverAsset: "t_b_trash_1.gif", label: "트래쉬" },
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
  return <div className="bg-forg-slate hidden w-[10px] shrink-0 sm:block" />;
}

export function RightRail() {
  const bgUrl = chromeUrl("right_bg.gif", ERA);
  return (
    <div
      className="bg-forg-slate hidden w-[7px] shrink-0 sm:block"
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
      className="hidden w-[100px] shrink-0 flex-col gap-[3px] bg-(--era-sidebar-bg) py-3 pl-[5px] text-(--era-sidebar-fg) sm:flex"
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
    </aside>
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
      <div className="grid grid-cols-[100px_1fr] items-stretch">
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

        <nav aria-label="2014 상단 메뉴" className="bg-forg-menu flex h-[20px] items-center px-2">
          {TOP_MENU.map((item) => (
            <MenuButton key={item.id} item={item} />
          ))}
        </nav>
      </div>
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
