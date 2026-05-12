/**
 * Museum landing — 2003 era home (Zeroboard frameset reproduction).
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
 * Chrome assets come from `public/img/chrome/` (Wayback-recovered in P2.4).
 * Most section headers (`m_*.gif`, `r_*.gif`) and menu buttons
 * (`t_b_*.gif`, `t_hi.gif`) are present. Missing decorative assets
 * (`m_middle_logo.gif`, `r_logo_1.gif`, `forg_main_logo_1.gif`) fall back
 * to typography so the layout never breaks.
 */

import Link from "next/link";

import type { BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { getBoardIndex } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

const BOX_RECENT_COUNT = 6;

interface BoardBoxConfig {
  /** Board id matching `src/lib/boards.ts`. Drives the data fetch. */
  id: BoardId;
  /** Korean label used as accessible name (alt fallback). */
  label: string;
  /** Chrome asset filename in `public/img/chrome/`. */
  asset: string;
}

// Left content column — m_* assets in the original frame-main-2003.
const LEFT_BOXES: BoardBoxConfig[] = [
  { id: "Notice", label: "NOTICE - ULTIMA ONLINE", asset: "m_notice.gif" },
  { id: "Role", label: "ROLEPLAY & EVENTS", asset: "m_role.gif" },
  { id: "column", label: "ONLINE NEWS", asset: "m_column.gif" },
];

// Right content column — r_* assets in the original.
const RIGHT_BOXES: BoardBoxConfig[] = [
  { id: "UoBoard", label: "FreeBoard", asset: "r_freeboard.gif" },
  { id: "Role", label: "UO.Roleplay", asset: "r_role.gif" },
  { id: "UOForum", label: "UO.Essay", asset: "r_essay.gif" },
];

// Top 7-button menu (frame-top-2003.html) — 80×20 each + 20×20 FAQ icon.
interface TopMenuConfig {
  id: BoardId;
  asset: string;
  label: string;
}
const TOP_MENU_2003: TopMenuConfig[] = [
  { id: "UoBoard", asset: "t_b_freeboard.gif", label: "자유게시판" },
  { id: "Q_A", asset: "t_b_question.gif", label: "질답란" },
  { id: "Role", asset: "t_b_roleplay.gif", label: "롤플레이게시판" },
  { id: "UOForum", asset: "t_b_essay.gif", label: "울온에세이란" },
  { id: "HouseScreenshot", asset: "t_hi.gif", label: "하우스인테리어란" },
  { id: "ScreenShot", asset: "t_b_screenshot.gif", label: "스크린샷란" },
  { id: "Items", asset: "t_b_kal.gif", label: "울온자료실" },
];

// Sidebar (frame-left-2003) — 5 sections with English chrome-bar
// headers and Korean dash-prefixed link rows. Static-page links route
// to `/` because the museum doesn't reproduce skill/dungeon HTML.
const SIDEBAR_SECTIONS: {
  /** Section header asset (English-titled GIF in chrome dir). */
  asset: string;
  /** Plain-text fallback when the asset can't load. */
  fallback: string;
  links: { label: string; href: string }[];
}[] = [
  {
    asset: "m_info.gif",
    fallback: "Information",
    links: [
      { label: "-초보자지침서", href: "/" },
      { label: "-초보자게시판", href: "/Q_A" },
      { label: "-쿠폰,시디구입처", href: "/" },
      { label: "-울온전투기술", href: "/" },
      { label: "-울온협력기술", href: "/" },
      { label: "-울온직업기술", href: "/" },
      { label: "-각종유용한정보", href: "/column" },
      { label: "-UO.퀘스트정보", href: "/Events" },
      { label: "-몬스터&던전란", href: "/monster" },
      { label: "-울온지도란", href: "/Recall" },
    ],
  },
  {
    asset: "m_co.gif",
    fallback: "Cooperation",
    links: [
      { label: "-벤더광고란", href: "/Vendor" },
      { label: "-아리랑장터란", href: "/Tarirang" },
      { label: "-발해장터란", href: "/Tbalhae" },
      { label: "-길드정보란", href: "/" },
      { label: "-벌크디드정보란", href: "/" },
    ],
  },
  {
    asset: "m_remember.gif",
    fallback: "Reminisce",
    links: [
      { label: "-UO.만화", href: "/" },
      { label: "-UO.여행기", href: "/" },
      { label: "-인테리어정보", href: "/" },
      { label: "-아이템스샷란", href: "/Items" },
    ],
  },
  {
    asset: "m_forg.gif",
    fallback: "Forg.Board",
    links: [
      { label: "-공동작업란", href: "/monster" },
      { label: "-포토갤러리", href: "/porato" },
      { label: "-휴지통게시판", href: "/Trash" },
      { label: "-유머게시판", href: "/FunBoard" },
      { label: "-Forg.멤버란", href: "/" },
      { label: "-울온설문조사란", href: "/" },
    ],
  },
  {
    asset: "m_friend.gif",
    fallback: "Friend Site",
    links: [
      { label: "SiteMap", href: "/" },
      { label: "EA Korea", href: "https://www.ea.com" },
    ],
  },
];

interface BoxData {
  config: BoardBoxConfig;
  entries: BoardIndexEntry[];
  totalPosts: number | null;
}

async function loadBox(config: BoardBoxConfig): Promise<BoxData> {
  const index = await getBoardIndex(config.id, 1);
  if (!index) {
    return { config, entries: [], totalPosts: null };
  }
  return {
    config,
    entries: index.entries.slice(0, BOX_RECENT_COUNT),
    totalPosts: index.totalPosts,
  };
}

export async function Home2003() {
  const [leftBoxes, rightBoxes] = await Promise.all([
    Promise.all(LEFT_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);

  return (
    <div className="flex w-full flex-1 justify-center bg-[#dcdcdc] py-3">
      <div
        className="border-forg-gold/60 flex w-full max-w-[920px] flex-col gap-0 border bg-white text-[11px] shadow-md"
        style={{ fontFamily: "Verdana, '돋움', Dotum, '굴림', Gulim, sans-serif" }}
      >
        <FrameTop2003 />
        <div className="flex flex-1">
          <FrameLeft2003 />
          <FrameMain2003 leftBoxes={leftBoxes} rightBoxes={rightBoxes} />
        </div>
        <FrameBottom2003 />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — forg logo + small login/signup links + 7-button menu     */
/* ────────────────────────────────────────────────────────────────────── */
function FrameTop2003() {
  const leftLogo = chromeUrl("left_logo1.gif"); // 100×42 forg logo
  return (
    <header className="border-b border-(--era-input-border) bg-[#FFC73B]">
      {/* Header row — logo on left, tiny login/signup on right. */}
      <div className="flex items-end justify-between px-2 pt-1 pb-0">
        <Link href="/" aria-label="forg.co.kr 메인" className="shrink-0">
          {leftLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export
            <img
              src={leftLogo}
              alt="Forg's World"
              width={100}
              height={42}
              className="block h-[42px] w-[100px]"
            />
          ) : (
            <span className="text-forg-ink block font-mono text-base leading-tight font-bold tracking-tight">
              forg<span className="text-forg-ink/70">&apos;s World</span>
            </span>
          )}
        </Link>
        <div
          aria-label="로그인 / 가입 (박물관 모드, 비활성)"
          className="text-forg-ink mb-1 flex items-center gap-1 text-[10px] select-none"
          title="박물관 모드 — 로그인 비활성"
        >
          <span aria-hidden className="text-[9px] opacity-60">
            ⌚
          </span>
          <span className="font-bold">Login</span>
          <span className="opacity-60">|</span>
          <span className="font-bold">Sign Up</span>
        </div>
      </div>

      {/* 7-button menu bar — gray background matches the original
         frame-top-2003 chrome (the GIF buttons themselves are
         transparent / cream so the surrounding bar reads gray). */}
      <nav
        aria-label="2003 상단 메뉴"
        className="flex items-center gap-[1px] bg-[#dcdcdc] px-2 py-[1px]"
      >
        {TOP_MENU_2003.map((item) => (
          <TopMenuButton2003 key={item.id} item={item} />
        ))}
        <span className="grow" />
        <FaqIcon2003 />
      </nav>
    </header>
  );
}

function TopMenuButton2003({ item }: { item: TopMenuConfig }) {
  const assetUrl = chromeUrl(item.asset);
  if (assetUrl) {
    return (
      <Link
        href={`/${item.id}`}
        className="hover:bg-forg-gold/15 inline-block shrink-0"
        title={item.label}
      >
        {/* `mix-blend-mode: multiply` turns the GIF's opaque white background
           into the chrome bar's gray (white × gray = gray), so the buttons
           blend instead of floating as white tiles. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img
          src={assetUrl}
          alt={item.label}
          width={80}
          height={20}
          className="block h-[20px] w-[80px]"
          style={{ mixBlendMode: "multiply" }}
        />
        <span className="sr-only">{item.label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/${item.id}`}
      className="border-forg-gold/40 hover:bg-forg-gold/20 inline-block h-[20px] w-[80px] shrink-0 border-b-2 bg-white px-1 text-[10px] leading-[16px] font-bold"
    >
      {item.label}
    </Link>
  );
}

function FaqIcon2003() {
  const url = chromeUrl("t_b_right.gif");
  if (!url) return null;
  return (
    <span
      aria-label="Site FAQ (박물관 모드, 비활성)"
      title="Site FAQ"
      className="inline-block shrink-0 opacity-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
      <img
        src={url}
        alt="Site FAQ"
        width={20}
        height={20}
        className="block h-[20px] w-[20px]"
        style={{ mixBlendMode: "multiply" }}
      />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: left — Information / Cooperation / Reminisce / Forg.Board ...  */
/* ────────────────────────────────────────────────────────────────────── */
function FrameLeft2003() {
  return (
    <aside
      aria-label="2003 사이드바 — Information · Cooperation · Reminisce · Forg.Board · Friend Site"
      className="hidden w-[140px] shrink-0 border-r border-(--era-input-border) bg-[#1f3147] px-2 py-2 text-white sm:block"
    >
      <nav className="flex flex-col gap-2.5">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSection2003 key={section.fallback} section={section} />
        ))}
        {/* Footer-of-sidebar links from frame-left-2003 (Login?(SP2), EA Korea) */}
        <div className="mt-1 space-y-0.5 border-t border-white/15 pt-2 text-[10px]">
          <p className="text-forg-gold-hover font-bold opacity-80">Login?(SP2)</p>
          <Link
            href="https://www.ea.com"
            rel="noopener noreferrer external"
            target="_blank"
            className="hover:text-forg-gold-hover block text-white"
          >
            EA Korea
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function SidebarSection2003({ section }: { section: (typeof SIDEBAR_SECTIONS)[number] }) {
  const headerUrl = chromeUrl(section.asset);
  return (
    <div>
      {headerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export
        <img
          src={headerUrl}
          alt={section.fallback}
          width={100}
          height={25}
          className="mb-1 block h-[25px] w-[100px]"
        />
      ) : (
        <h3 className="text-forg-gold-hover mb-1 text-[11px] font-bold tracking-wide uppercase">
          {section.fallback}
        </h3>
      )}
      <ul className="space-y-[1px] pl-1">
        {section.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="hover:text-forg-gold-hover block text-[10.5px] leading-tight text-white/85"
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
/*  Frame: main — 3-column content (left m_*, right r_*, no decoration)   */
/* ────────────────────────────────────────────────────────────────────── */
function FrameMain2003({ leftBoxes, rightBoxes }: { leftBoxes: BoxData[]; rightBoxes: BoxData[] }) {
  return (
    <section
      aria-label="2003 메인 콘텐츠"
      className="flex flex-1 flex-col gap-2 bg-white px-3 py-2"
    >
      <MainHeading />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          {leftBoxes.map((box) => (
            <SectionBox2003 key={box.config.asset} box={box} />
          ))}
        </div>
        <div className="space-y-2">
          {rightBoxes.map((box) => (
            <SectionBox2003 key={box.config.asset} box={box} compact />
          ))}
          <BestScreenShotBox />
        </div>
      </div>
    </section>
  );
}

function MainHeading() {
  return (
    <div className="border-b border-(--era-input-border) pb-1">
      <p className="text-[11px] font-bold">
        <span className="text-forg-ink">We Created World.</span>{" "}
        <span className="text-forg-muted">Origin System Inc.</span>
      </p>
    </div>
  );
}

function SectionBox2003({ box, compact = false }: { box: BoxData; compact?: boolean }) {
  const headerUrl = chromeUrl(box.config.asset);
  return (
    <section className="border-forg-gold/40 border-b bg-white" aria-label={box.config.label}>
      <Link
        href={`/${box.config.id}`}
        className="bg-forg-gold/10 hover:bg-forg-gold/20 flex h-[20px] items-center px-1"
        style={
          headerUrl
            ? {
                backgroundImage: `url(${headerUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left center",
              }
            : undefined
        }
      >
        {!headerUrl && (
          <span className="text-forg-ink text-[11px] font-bold">{box.config.label}</span>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <ul className="px-1 py-1.5">
        {box.totalPosts === null ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">준비 중</li>
        ) : box.entries.length === 0 ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">아직 게시글이 없습니다.</li>
        ) : (
          box.entries.slice(0, compact ? 5 : BOX_RECENT_COUNT).map((entry) => (
            <li key={entry.postId}>
              <Link
                href={`/${box.config.id}/${entry.postId}`}
                className="hover:text-forg-gold-hover block truncate text-[10.5px] leading-[1.45] text-(--era-link)"
                style={{ color: "#3563a6" }}
              >
                <span className="text-forg-muted mr-1.5 font-mono text-[9px]">
                  {monthDayFromIso(entry.createdAt)}
                </span>
                {entry.title}
                {entry.commentCount > 0 && (
                  <span className="text-forg-gold-hover ml-1 font-mono text-[9px] tabular-nums">
                    [{entry.commentCount}]
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function BestScreenShotBox() {
  const headerUrl = chromeUrl("r_essay.gif"); // closest available — actual was r_screen.gif (missing)
  return (
    <section className="border-forg-gold/40 border-b bg-white" aria-label="BestScreenShot">
      <div
        className="bg-forg-gold/10 flex h-[20px] items-center px-1"
        style={
          headerUrl
            ? {
                backgroundImage: `url(${headerUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left center",
              }
            : undefined
        }
      >
        {!headerUrl && <span className="text-forg-ink text-[11px] font-bold">BestScreenShot</span>}
        <span className="sr-only">BestScreenShot</span>
      </div>
      <div className="text-forg-muted flex h-[80px] items-center justify-center bg-[#f6f4e8] text-[10px] italic">
        스크린샷 박물관 준비 중
      </div>
    </section>
  );
}

function monthDayFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "—";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: bottom — copyright                                              */
/* ────────────────────────────────────────────────────────────────────── */
function FrameBottom2003() {
  return (
    <footer
      aria-label="2003 푸터"
      className="border-t border-(--era-input-border) bg-[#dcdcdc] px-3 py-2 text-center text-[10px]"
    >
      <span className="text-forg-muted">
        All Contents Copyright 1999~2015 Forg. All Rights Reserved. ·{" "}
      </span>
      <span className="text-forg-muted/80">디지털 박물관 박제 — forg.co.kr 2003</span>
    </footer>
  );
}
