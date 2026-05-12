/**
 * Museum landing — 2014 main page reproduction (ROADMAP P2.4).
 *
 * Faithful reconstruction of forg.co.kr 2014-12-18 (Gnuboard4 era):
 *   ┌─10─┬─100─┬───────────680───────────┬─7─┬─AdSense─┐
 *   │left│game │  header (53px)          │   │ 120×600 │
 *   │side│cats │  8-box latest grid      │ │ │ slot    │
 *   │    │     │  visitor counter (24px) │   │         │
 *   └────┴─────┴─────────────────────────┴───┴─────────┘
 *
 * The site shell rendered in `src/app/layout.tsx` is the modern museum
 * frame; this page is the exhibit inside. Visitors see both, which is
 * intentional — the museum acknowledges the curated reproduction rather
 * than pretending to be the live 2014 site.
 *
 * Boards linked here are mostly Gnuboard4 (P2.2 deferred) and Phase B
 * downloads (P3.3 pending). Their /[board] URLs render `<BoardPlaceholder>`
 * until parsers + downloads land.
 *
 * Chrome assets (logo, header bars, hover GIFs) come from Wayback via
 * `scripts/etl/recover-chrome.py`. When an asset is missing the page
 * falls back to typography / OKLCH CSS — see `chromeUrl` in `lib/chrome`.
 */

import Link from "next/link";

import { Home2003 } from "@/components/home-2003";
import { getBoard, type BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { getBoardIndex } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

interface BoxConfig {
  id: BoardId;
  label: string;
  asset: string;
}

/** Snapshot order in `2014-12-18.html`: 4 rows × 2 cols → 8 boxes. */
const MAIN_BOXES: BoxConfig[] = [
  { id: "UoBoard2", label: "자유게시판", asset: "main_list_1.gif" },
  { id: "FunBoard", label: "펀게시판", asset: "main_list_2.gif" },
  { id: "Reveal", label: "스포일러게시판", asset: "main_list_3.gif" },
  { id: "porato", label: "포토갤러리", asset: "main_list_4.gif" },
  { id: "Trash", label: "트래쉬게시판", asset: "main_list_5.gif" },
  { id: "Ultima", label: "울티마온라인", asset: "main_list_6.gif" },
  { id: "Console", label: "콘솔게임", asset: "main_list_7.gif" },
  { id: "Shop", label: "상점 (거래)", asset: "main_list_8.gif" },
];

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
  { id: "FunBoard", asset: "t_b_fun.gif", hoverAsset: "t_b_fun_1.gif", label: "펀게시판" },
  { id: "Reveal", asset: "t_b_movie.gif", hoverAsset: "t_b_movie_1.gif", label: "스포일러" },
  { id: "Boo", asset: "t_b_boo.gif", hoverAsset: "t_b_boo_1.gif", label: "검색·문서함" },
  { id: "Shop", asset: "t_b_tra.gif", hoverAsset: "t_b_tra_1.gif", label: "거래" },
  { id: "Trash", asset: "t_b_trash.gif", hoverAsset: "t_b_trash_1.gif", label: "트래쉬" },
];

const GAME_CATEGORIES: { id: BoardId; label: string }[] = [
  { id: "Ultima", label: "울티마온라인" },
  { id: "Diablo", label: "디아블로3" },
  { id: "DF", label: "던전파이터" },
  { id: "LoL", label: "리그오브레전드" },
  { id: "Star2", label: "스타크래프트2" },
  { id: "Console", label: "콘솔게임" },
];

const BOX_RECENT_COUNT = 8;
/** Static carry-over from the 2014-12-18 snapshot footer. HITL #3:
 *  keep faithful museum number, plug in live tracking later. */
const TOTAL_VISITORS = 52_916_713;

interface BoxData {
  config: BoxConfig;
  totalPosts: number | null;
  entries: BoardIndexEntry[];
}

async function loadBox(config: BoxConfig): Promise<BoxData> {
  const index = await getBoardIndex(config.id, 1);
  if (!index) {
    return { config, totalPosts: null, entries: [] };
  }
  return {
    config,
    totalPosts: index.totalPosts,
    entries: index.entries.slice(0, BOX_RECENT_COUNT),
  };
}

export default async function HomePage() {
  const boxes = await Promise.all(MAIN_BOXES.map(loadBox));

  // Both era variants render server-side; the runtime `<html data-era>`
  // attribute hides one via CSS in globals.css (`.era-2014-only` /
  // `.era-2003-only`). This keeps the era toggle instantaneous (CSS-only,
  // no React re-render) and lets the static export ship both layouts.
  return (
    <>
      <div className="era-2014-only flex flex-1 justify-center bg-(--era-page-bg)">
        <div className="forg-2014-shell flex w-full max-w-[900px] gap-0">
          <LeftRail />
          <GameCategorySidebar />
          <main className="flex flex-1 flex-col bg-(--era-content-bg)">
            <SiteHeader2014 />
            <BoxGrid boxes={boxes} />
            <VisitorCounter total={TOTAL_VISITORS} />
          </main>
          <RightRail />
          <AdSenseColumn />
        </div>
      </div>
      <div className="era-2003-only flex flex-1">
        <Home2003 />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Site rails                                                            */
/* ──────────────────────────────────────────────────────────────────── */

function LeftRail() {
  return <div className="bg-forg-slate hidden w-[10px] shrink-0 sm:block" />;
}

function RightRail() {
  return <div className="bg-forg-slate hidden w-[7px] shrink-0 sm:block" />;
}

function AdSenseColumn() {
  return (
    <aside
      aria-label="광고 영역 (2014 원본 자리)"
      className="bg-forg-slate hidden shrink-0 px-2 py-6 lg:block lg:w-[120px]"
    >
      <div className="bg-forg-cream/10 text-forg-cream/60 mx-auto flex h-[600px] w-[120px] items-center justify-center rounded text-[10px] tracking-wide">
        AdSense
        <br />
        120×600
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Game category sidebar (100px)                                         */
/* ──────────────────────────────────────────────────────────────────── */

function GameCategorySidebar() {
  const sidebarStyle = chromeUrl("left_bg.gif")
    ? {
        backgroundImage: `url(${chromeUrl("left_bg.gif")})`,
        backgroundRepeat: "repeat",
      }
    : undefined;

  const logoUrl = chromeUrl("l_forg_logo.gif");

  return (
    <aside
      aria-label="게임 카테고리"
      className="hidden w-[100px] shrink-0 flex-col items-center gap-2 bg-(--era-sidebar-bg) px-1 py-4 text-(--era-sidebar-fg) sm:flex"
      style={sidebarStyle}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export, ~16 KB GIF, no LCP cost
        <img
          src={logoUrl}
          alt="forg 마스코트"
          width={90}
          height={160}
          className="block opacity-90"
        />
      ) : (
        <div className="bg-forg-gold/20 text-forg-cream/80 mb-3 flex h-[120px] w-[80px] items-center justify-center rounded text-center text-[10px] leading-tight">
          forg
          <br />
          mascot
        </div>
      )}
      <nav className="mt-2 flex flex-col gap-1 text-center text-[11px]">
        {GAME_CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/${cat.id}`}
            className="hover:text-forg-gold-hover block rounded px-1 py-1 leading-tight text-(--era-sidebar-fg) transition-colors hover:bg-(--era-page-bg)/40"
          >
            {cat.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Header (53px) — logo + login bar + 7-button menu                      */
/* ──────────────────────────────────────────────────────────────────── */

function SiteHeader2014() {
  const logoUrl = chromeUrl("left_logo1.gif");
  const tBarUrl = chromeUrl("t_bar.gif");
  const tLineUrl = chromeUrl("t_line.gif");

  return (
    <div className="border-b border-(--era-input-border) bg-white">
      <div className="grid grid-cols-[100px_1fr] items-stretch">
        <div className="row-span-3 flex items-center justify-center px-2 py-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, ~3 KB GIF, no LCP cost
            <img src={logoUrl} alt="forg.co.kr" width={100} height={42} />
          ) : (
            <Link href="/" className="font-forg flex flex-col leading-tight">
              <span className="text-forg-ink text-base font-bold tracking-tight">forg.co.kr</span>
              <span className="text-forg-muted text-[10px]">Forg&apos;s World</span>
            </Link>
          )}
        </div>

        <div className="bg-forg-gold flex h-[18px] items-center justify-end gap-2 px-2 text-[10px]">
          <span
            aria-disabled
            className="text-forg-ink/80 rounded-sm bg-white/60 px-2 py-[1px] font-bold uppercase select-none"
          >
            Login (박물관 모드)
          </span>
          <span
            aria-disabled
            className="text-forg-ink/80 rounded-sm bg-white/60 px-2 py-[1px] font-bold uppercase select-none"
          >
            Sign-up
          </span>
        </div>

        <div
          className="bg-forg-gold h-[4px] w-full"
          style={
            tBarUrl
              ? { backgroundImage: `url(${tBarUrl})`, backgroundRepeat: "repeat-x" }
              : undefined
          }
        />

        <nav
          aria-label="2014 상단 메뉴"
          className="flex h-[24px] items-center gap-[1px] bg-[#F1F1F2] px-2"
        >
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

function MenuButton({ item }: { item: MenuConfig }) {
  const baseUrl = chromeUrl(item.asset);
  const hoverUrl = chromeUrl(item.hoverAsset);

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
/*  8-box main grid                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function BoxGrid({ boxes }: { boxes: BoxData[] }) {
  return (
    <div className="grow bg-(--era-content-bg) px-3 py-4">
      <div className="mx-auto grid max-w-[640px] grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
        {boxes.map((box) => (
          <BoxCard key={box.config.id} box={box} />
        ))}
      </div>
    </div>
  );
}

function BoxCard({ box }: { box: BoxData }) {
  const headerUrl = chromeUrl(box.config.asset);
  const meta = getBoard(box.config.id);

  return (
    <section className="border-forg-gold/30 flex flex-col border-b" aria-label={box.config.label}>
      <Link
        href={`/${box.config.id}`}
        className="bg-forg-gold/10 hover:bg-forg-gold/20 group block h-[25px] w-full overflow-hidden"
        style={
          headerUrl
            ? {
                backgroundImage: `url(${headerUrl})`,
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      >
        {!headerUrl && (
          <div className="flex h-full items-center justify-between px-2">
            <span className="text-forg-ink text-xs font-bold tracking-tight">
              {box.config.label}
            </span>
            <span className="text-forg-muted font-mono text-[9px] uppercase">
              {meta?.engine ?? "—"}
            </span>
          </div>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <div className="space-y-[2px] px-2 py-2">
        {box.totalPosts === null ? (
          <p className="text-forg-muted py-2 text-[11px] italic">
            준비 중 — Phase B 다운로드 + Gnuboard4 파서 후 활성화
          </p>
        ) : box.entries.length === 0 ? (
          <p className="text-forg-muted py-2 text-[11px] italic">아직 게시글이 없습니다.</p>
        ) : (
          box.entries.map((entry) => (
            <BoxRow key={entry.postId} board={box.config.id} entry={entry} />
          ))
        )}
        {box.totalPosts !== null && box.totalPosts > BOX_RECENT_COUNT && (
          <Link
            href={`/${box.config.id}`}
            className="text-forg-muted hover:text-forg-gold-hover mt-1 inline-block text-[10px]"
          >
            전체 {box.totalPosts.toLocaleString("ko-KR")}건 →
          </Link>
        )}
      </div>
    </section>
  );
}

function BoxRow({ board, entry }: { board: BoardId; entry: BoardIndexEntry }) {
  return (
    <Link
      href={`/${board}/${entry.postId}`}
      className="text-forg-muted hover:text-forg-gold-hover block truncate text-[11px] leading-tight"
    >
      <span className="line-clamp-1">{entry.title}</span>
      {entry.commentCount > 0 && (
        <span className="text-forg-gold-hover ml-1 font-mono text-[9px] tabular-nums">
          ({entry.commentCount})
        </span>
      )}
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Footer counter (24px)                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function VisitorCounter({ total }: { total: number }) {
  const bgUrl = chromeUrl("bgm_bg.gif");
  const rightUrl = chromeUrl("bgm_right.gif");

  return (
    <footer
      role="contentinfo"
      aria-label="누적 방문 (2014-12-18 기준 박제)"
      className="text-forg-cream flex h-[24px] items-center justify-between bg-[#5A6269] px-3 text-[11px]"
      style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundRepeat: "repeat-x" } : undefined}
    >
      <span className="font-mono tabular-nums">Total : {total.toLocaleString("en-US")}</span>
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
